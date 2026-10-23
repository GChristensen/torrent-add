import {settings} from "../settings.js"
import {ROOT_FOLDER} from "../constants.js";
import {fetchWithTimeout, showNotification} from "../utils.js";
import {TorrentClient} from "./client_base.js";

// CSRF token of the Transmission RPC, kept between client instances
let sessionId;

export class TransmissionClient extends TorrentClient {
    #adjustHostURL(url) {
        let result = url.replace(/\/+$/, "");

        if (!/^https?:\/\//.exec(result))
            result = "http://" + result;

        result = result.replace(/\/transmission\/(web|rpc)$/, "");

        return result;
    }

    #makeRPCURL() {
        return `${this.#adjustHostURL(settings.host())}/transmission/rpc`;
    }

    #makeHeaders() {
        const headers = new Headers();
        headers.append("Content-Type", "application/json");

        if (settings.user())
            headers.append("Authorization", "Basic " + btoa(settings.user() + ":" + settings.password()));

        if (sessionId)
            headers.append("X-Transmission-Session-Id", sessionId);

        return headers;
    }

    // returns the "arguments" of the response, throws on failure
    async #rpc(method, args = {}, timeout = 10000) {
        const body = JSON.stringify({method, arguments: args});
        const request = () => fetchWithTimeout(this.#makeRPCURL(), {
            timeout,
            method: "POST",
            headers: this.#makeHeaders(),
            body
        });

        let response = await request();

        // Transmission responds with 409 and a new session ID when the current one is missing or stale
        if (response.status === 409) {
            sessionId = response.headers.get("X-Transmission-Session-Id");
            response = await request();
        }

        if (!response.ok) {
            const error = new Error(`HTTP error: ${response.status}`);

            if (response.status === 401)
                error.addTorrentMessage = "Please check Transmission authentication credentials.";
            else if (response.status === 403 || response.status === 421)
                error.addTorrentMessage = "Transmission rejected the connection, please check its whitelist settings.";

            throw error;
        }

        const json = await response.json();

        if (json.result !== "success")
            throw new Error(json.result);

        return json.arguments;
    }

    async #createSavePath(category) {
        const {"download-dir": path} = await this.#rpc("session-get", {fields: ["download-dir"]});

        if (category === ROOT_FOLDER)
            return path;

        const separator = path.includes("\\") && !path.includes("/")? "\\": "/";
        return path.replace(/[\\/]+$/, "") + separator + category;
    }

    #toBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";

        for (let i = 0; i < bytes.length; i += 0x8000)
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));

        return btoa(binary);
    }

    // returns "added" or "exists"
    async #addRequest(args, savePath) {
        const result = await this.#rpc("torrent-add", {...args, "download-dir": savePath});
        return result["torrent-duplicate"]? "exists": "added";
    }

    async #addTorrent(args, category) {
        try {
            const status = await this.#addRequest(args, await this.#createSavePath(category));

            if (status === "exists" && settings.notification_mode() !== "never")
                showNotification("The torrent is already added.");
            else if (status === "added" && settings.notification_mode() === "success")
                showNotification("Successfully added torrent.");
        }
        catch (e) {
            console.error(e);

            if (settings.notification_mode() !== "never")
                showNotification(e.addTorrentMessage || "Error adding torrent.");
        }
    }

    async testConnection() {
        let result = false;

        try {
            await this.#rpc("session-get", {fields: ["version"]}, 1000);
            showNotification("Successfully connected to Transmission.");
            result = true;
        }
        catch (e) {
            console.error(e);
            showNotification(e.addTorrentMessage || "Can not access Transmission.");
        }

        return result;
    }

    async _queryClientCategories() {
        return [];
    }

    async addMagnet(link, category) {
        return this.#addTorrent({filename: link}, category);
    }

    async addTorrent(link, category) {
        if (!this._checkLink(link)) return;

        let file;
        try {
            file = await this._downloadFile(link);
        }
        catch (e) {
            console.error(e);

            if (settings.notification_mode() === "failure")
                showNotification(`Error downloading torrent file.`);

            return;
        }

        return this.#addTorrent({metainfo: this.#toBase64(file.buffer)}, category);
    }

    // Transmission adds one torrent per request, so the links are sent one by one
    async addTorrents(links, category, onProgress) {
        let savePath;
        try {
            savePath = await this.#createSavePath(category);
        }
        catch (e) {
            console.error(e);
            links.forEach(url => onProgress(url, "failed", e.addTorrentMessage || "Can not access Transmission."));
            return;
        }

        const items = await this._prepareBulkItems(links, onProgress);

        for (const item of items) {
            if (item.error)
                continue;

            onProgress(item.url, "sending");

            try {
                const args = item.magnet
                    ? {filename: item.url}
                    : {metainfo: this.#toBase64(item.file.buffer)};

                onProgress(item.url, await this.#addRequest(args, savePath));
            }
            catch (e) {
                console.error(e);
                onProgress(item.url, "failed", e.addTorrentMessage || `Rejected by Transmission: ${e.message}`);
            }
        }
    }
}
