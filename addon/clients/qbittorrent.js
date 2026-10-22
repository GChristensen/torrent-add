import {settings} from "../settings.js"
import {delay, fetchWithTimeout, showNotification} from "../utils.js";
import {CATEGORY_SOURCE_USER, CATEGORY_SOURCE_USER_CATEGORIES, ROOT_FOLDER} from "../constants.js";
import {TorrentClient} from "./client_base.js";
import {downloadToUserCategories} from "./clients.js";
import {magnetTorrentIDs, torrentFileTorrentIDs} from "./infohash.js";

export class QBittorrentClient extends TorrentClient {
    #adjustHostURL(url) {
        let result = url;

        if (/.*\/gui\/?$/.exec(result))
            result = result.replace(/\/gui\/?$/, "");

        if (url.endsWith("/"))
            result = result.replace(/\/$/, "");

        if (!/^https?:\/\//.exec(result))
            result = "http://" + result;

        return result;
    }

    #makeAPIURL(api, method) {
        return `${this.#adjustHostURL(settings.host())}/api/v2/${api}/${method}`;
    }

    #fetchAPI(api, method) {
        const apiURL = this.#makeAPIURL(api, method);
        return fetch(apiURL);
    }

    #postAPI(api, method) {
        const apiURL = this.#makeAPIURL(api, method);
        return fetch(apiURL, {method: "post"});
    }

    #fetchJSON(api, method) {
        return this.#fetchAPI(api, method).then(r => r.json());
    }

    async #login(verbose = true, timeout = 10000) {
        let result = false;

        try {
            const versionURL = this.#makeAPIURL("app", "version")
            const versionResp = await fetchWithTimeout(versionURL, {timeout});

            if (versionResp.status === 200) {
                result = true;
            }
            if (versionResp.status === 403) {
                const loginURL = this.#makeAPIURL("auth", "login");
                const resp = await fetchWithTimeout(loginURL, {
                    timeout,
                    method: "post",
                    headers: {"content-type": "application/x-www-form-urlencoded"},
                    body: new URLSearchParams({
                        "username": settings.user(),
                        "password": settings.password()
                    })
                });

                if (!resp.ok || (await resp.text()) === "Fails.") {
                    const error = new Error(`HTTP error: ${resp.status}`);
                    error.addTorrentMessage = `Please check qBittorrent authentication credentials.`;
                    throw error;
                }
                else
                    result = true;
            }
        }
        catch (e) {
            console.log(e);

            if (verbose)
                showNotification(e.addTorrentMessage || "Can not access qBittorrent.");
        }

        return result;
    }

    #logout() {
        try {
            return this.#postAPI("auth", "logout");
        }
        catch (e) {
            console.error(e);
        }
    }

    async #createSavePath(prefs, category) {
        let path = prefs.save_path;

        if (!path.endsWith("/") && !path.endsWith("\\"))
            path += "/";

        path = path + (category === ROOT_FOLDER? "": (category + "/"));

        return path;
    }

    // returns the set of IDs (v1 and full/truncated v2 hashes) of the client's torrents matching the given IDs
    async #findTorrents(ids) {
        const found = new Set();

        if (!ids.length)
            return found;

        try {
            const apiURL = this.#makeAPIURL("torrents", "info") + "?" + new URLSearchParams({hashes: ids.join("|")});
            const response = await fetch(apiURL);

            if (response.ok)
                for (const torrent of await response.json())
                    for (const hash of [torrent.hash, torrent.infohash_v1, torrent.infohash_v2])
                        if (hash) {
                            found.add(hash.toLowerCase());
                            found.add(hash.toLowerCase().substring(0, 40));
                        }
        }
        catch (e) {
            console.error(e);
        }

        return found;
    }

    async #torrentExists(ids) {
        return (await this.#findTorrents(ids)).size > 0;
    }

    async #appendDestination(form, prefs, category) {
        if (downloadToUserCategories() /*|| !prefs.auto_tmm_enabled*/) {
            if (settings.category_source() === CATEGORY_SOURCE_USER) { // user's plain folders
                const savePath = await this.#createSavePath(prefs, category);
                form.append("savepath", savePath);
            }
            else if (settings.category_source() === CATEGORY_SOURCE_USER_CATEGORIES) { // user's categories
                form.append("category", category);
            }
        }
        else
            form.append("category", category);
    }

    async #addTorrent(category, form, getTorrentIDs) {
        try {
            await this.#login();

            const prefs = await this.#fetchJSON("app", "preferences");
            await this.#appendDestination(form, prefs, category);

            const apiURL = this.#makeAPIURL("torrents", "add");
            const response = await fetch(apiURL, {method: "POST", body: form});
            // qBittorrent < 5.1 responds with 200 "Fails." when nothing was added, newer versions with 409
            const failed = !response.ok || (await response.text()) === "Fails.";

            if (failed && settings.notification_mode() !== "never") {
                if (await this.#torrentExists(await getTorrentIDs()))
                    showNotification("The torrent is already added.");
                else
                    showNotification("Error adding torrent.");
            }
            else if (!failed && settings.notification_mode() === "success")
                showNotification("Successfully added torrent.");
        }
        finally {
            //await this.#logout();
        }
    }

    async _queryClientCategories(verbose) {
        let result = [];

        try {
            if (await this.#login(verbose)) {
                const apiURL = this.#makeAPIURL("torrents", "categories");
                const response = await fetch(apiURL);

                if (response.ok) {
                    const categories = await response.json();
                    result = Object.keys(categories);
                }
                else
                    showNotification("Error obtaining torrent categories from qBittorrent.");
            }
        }
        finally {
            //await this.#logout();
        }

        return result;
    }

    async testConnection() {
        let result = false;

        try {
            if (await this.#login(true, 1000)) {
                showNotification("Successfully connected to qBittorrent.");
                result = true;
            }
        }
        finally {
            //await this.#logout();
        }

        return result;
    }

    async addMagnet(link, category) {
        const form = new FormData();
        form.append("urls", link);
        return this.#addTorrent(category, form, async () => magnetTorrentIDs(link));
    }

    async addTorrent(link, category) {
        if (!this._checkLink(link)) return;

        const form = await this._downloadFileAsForm(link, "torrents");
        return this.#addTorrent(category, form,
            async () => torrentFileTorrentIDs(await form.get("torrents").arrayBuffer()));
    }

    // all links are sent in a single torrents/add request; since its response does not tell
    // which torrents were added, the outcome of each link is checked by its infohash
    async addTorrents(links, category, onProgress) {
        const failAll = (items, reason) => items.forEach(item => onProgress(item.url, "failed", reason));

        if (!await this.#login(false)) {
            failAll(links.map(url => ({url})), "Can not access qBittorrent.");
            return;
        }

        const prefs = await this.#fetchJSON("app", "preferences");
        const items = await this._prepareBulkItems(links, onProgress);
        const candidates = [];

        for (const item of items) {
            if (item.error)
                continue;

            item.ids = item.magnet
                ? magnetTorrentIDs(item.url)
                : await torrentFileTorrentIDs(item.file.buffer);

            // a non-torrent response (e.g. a login page) would make qBittorrent reject the whole batch
            if (!item.magnet && !item.ids.length)
                onProgress(item.url, "failed", "Not a valid torrent file.");
            else
                candidates.push(item);
        }

        const existing = await this.#findTorrents(candidates.flatMap(item => item.ids));
        const batch = [];

        for (const item of candidates) {
            if (item.ids.some(id => existing.has(id)))
                onProgress(item.url, "exists");
            else
                batch.push(item);
        }

        if (!batch.length)
            return;

        const form = new FormData();
        const magnets = batch.filter(item => item.magnet).map(item => item.url);

        if (magnets.length)
            form.append("urls", magnets.join("\n"));

        for (const item of batch)
            if (!item.magnet)
                form.append("torrents", item.file.blob, item.file.fileName);

        await this.#appendDestination(form, prefs, category);

        batch.forEach(item => onProgress(item.url, "sending"));

        let failed;
        try {
            const response = await fetch(this.#makeAPIURL("torrents", "add"), {method: "POST", body: form});
            // qBittorrent < 5.1 responds with 200 "Fails." when nothing was added, newer versions with 409
            failed = !response.ok || (await response.text()) === "Fails.";
        }
        catch (e) {
            console.error(e);
            failAll(batch, "Can not access qBittorrent.");
            return;
        }

        const verifiable = batch.filter(item => item.ids.length);
        const isAdded = (item, found) => item.ids.some(id => found.has(id));
        let found = new Set();

        // newer qBittorrent versions add torrents asynchronously
        for (let attempt = 0; attempt < (failed? 1: 3); attempt++) {
            if (attempt)
                await delay(500);

            found = await this.#findTorrents(verifiable.flatMap(item => item.ids));

            if (verifiable.every(item => isAdded(item, found)))
                break;
        }

        for (const item of batch) {
            if (!item.ids.length)
                onProgress(item.url, failed? "failed": "sent", failed? "Rejected by qBittorrent.": undefined);
            else if (isAdded(item, found))
                onProgress(item.url, "added");
            else
                onProgress(item.url, "failed", "Rejected by qBittorrent.");
        }
    }
}
