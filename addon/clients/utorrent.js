import {settings} from "../settings.js"
import {ROOT_FOLDER} from "../constants.js";
import {fetchWithTimeout, showNotification} from "../utils.js";
import {TorrentClient} from "./client_base.js";

export class UTorrentClient extends TorrentClient {
    #adjustHostURL(url) {
        let result = url;

        if (!url.endsWith("/"))
            result += "/";

        if (!/^https?:\/\//.exec(result))
            result = "http://" + result;

        if (!/.*\/gui\/?$/.exec(result))
            result += "gui/";

        return result;
    }

    #makeuTorrentAuthHeaders() {
        const headers = new Headers();
        headers.append('Authorization', 'Basic ' + btoa(settings.user() + ':' + settings.password()));
        return headers;
    }

    async #getAPIToken(host) {
        try {
            const tokenURL = host + "token.html";
            const response = await fetch(tokenURL, {headers: this.#makeuTorrentAuthHeaders()});

            if (response.ok) {
                const doc = await response.text();
                return doc.match(/<div id=['"]token['"][^>]*>([^<]*)</)[1];
            }
            else if (response.status === 401) {
                const error = new Error();
                error.addTorrentMessage = `Please check uTorrent authentication credentials.`;
                throw error;
            }
            else
                showNotification(`Web client HTTP API error: ${response.statusText}.`);
        }
        catch (e) {
            console.error(e);
            showNotification(e.addTorrentMessage || `Can not access uTorrent.`);
            throw e;
        }
    }

    async #makeAPIURL(params, token) {
        const host = this.#adjustHostURL(settings.host());
        token = token || await this.#getAPIToken(host);
        return `${host}?token=${token}&${params}`;
    }

    async #makeActionURL(action, category, token) {
        const path = category === ROOT_FOLDER? "": category;
        const params = `action=${action}&download_dir=0${path? "&path=" + path: ""}`;
        return this.#makeAPIURL(params, token);
    }

    async #addURLRequest(link, category, token) {
        const apiURL = await this.#makeActionURL("add-url", category, token);
        const response = await fetch(apiURL + "&s=" +  encodeURIComponent(link), {
            headers: this.#makeuTorrentAuthHeaders()
        });

        return response.ok;
    }

    async #addFileRequest(form, category, token) {
        const apiURL = await this.#makeActionURL("add-file", category, token);
        const response = await fetch(apiURL, {
            method: "POST",
            body: form,
            headers: this.#makeuTorrentAuthHeaders()
        });

        return response.ok;
    }

    #notifyAdded(ok) {
        if (!ok && settings.notification_mode() === "failure")
            showNotification("Error adding torrent.");
        else if (ok && settings.notification_mode() === "success")
            showNotification("Successfully added torrent.");
    }

    async testConnection() {
        let result = false;

        try {
            const apiURL = await this.#makeAPIURL("list=1");
            const response = await fetchWithTimeout(apiURL, {
                timeout: 1000,
                headers: this.#makeuTorrentAuthHeaders()
            });

            if (response.ok) {
                showNotification("Successfully connected to uTorrent.");
                result = true;
            }
        }
        finally {
        }

        return result;
    }

    async _queryClientCategories() {
        return [];
    }

    async addMagnet(link, category) {
        this.#notifyAdded(await this.#addURLRequest(link, category));
    }

    async addTorrent(link, category) {
        if (!this._checkLink(link)) return;

        const form = await this._downloadFileAsForm(link, "torrent_file");

        if (form)
            this.#notifyAdded(await this.#addFileRequest(form, category));
    }

    // uTorrent adds one torrent per request, so the links are sent one by one with a shared token
    async addTorrents(links, category, onProgress) {
        let token;
        try {
            token = await this.#getAPIToken(this.#adjustHostURL(settings.host()));
        }
        catch (e) {
            console.error(e);
        }

        if (!token) {
            links.forEach(url => onProgress(url, "failed", "Can not access uTorrent."));
            return;
        }

        const items = await this._prepareBulkItems(links, onProgress);

        for (const item of items) {
            if (item.error)
                continue;

            onProgress(item.url, "sending");

            try {
                let ok;

                if (item.magnet)
                    ok = await this.#addURLRequest(item.url, category, token);
                else {
                    const form = new FormData();
                    form.append("torrent_file", item.file.blob, item.file.fileName);
                    ok = await this.#addFileRequest(form, category, token);
                }

                if (ok)
                    onProgress(item.url, "added");
                else
                    onProgress(item.url, "failed", "Rejected by uTorrent.");
            }
            catch (e) {
                console.error(e);
                onProgress(item.url, "failed", "Can not access uTorrent.");
            }
        }
    }
}
