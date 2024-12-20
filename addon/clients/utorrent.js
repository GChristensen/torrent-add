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

    async #makeAPIURL(params) {
        const host = this.#adjustHostURL(settings.host());
        const token = await this.#getAPIToken(host);
        return `${host}?token=${token}&${params}`;
    }

    async #makeActionURL(action, category) {
        const path = category === ROOT_FOLDER? "": category;
        const params = `action=${action}&download_dir=0${path? "&path=" + path: ""}`;
        return this.#makeAPIURL(params);
    }

    async testConnection() {
        let result = false;

        try {
            const apiURL = await this.#makeAPIURL("list=1");
            const response = await fetchWithTimeout(apiURL, {
                timeout: 1000,
                headers: this.#makeuTorrentAuthHeaders()
            });

            if (response.ok)
                showNotification("Successfully connected to uTorrent.");
        }
        finally {
        }

        return result;
    }

    async _queryClientCategories() {
        return [];
    }

    async addMagnet(link, category) {
        const apiURL = await this.#makeActionURL("add-url", category);
        const response = await fetch(apiURL + "&s=" +  encodeURIComponent(link), {
            headers: this.#makeuTorrentAuthHeaders()
        });

        if (!response.ok && settings.notification_mode() === "failure")
            showNotification("Error adding torrent.");
        else if (response.ok && settings.notification_mode() === "success")
            showNotification("Successfully added torrent.");
    }

    async addTorrent(link, category) {
        const form = await this._downloadFileAsForm(link, "torrent_file");

        if (form) {
            const apiURL = await this.#makeActionURL("add-file", category);
            const response = await fetch(apiURL, {
                method: "POST",
                body: form,
                headers: this.#makeuTorrentAuthHeaders()
            });

            if (!response.ok && settings.notification_mode() === "failure")
                showNotification("Error adding torrent.");
            else if (response.ok && settings.notification_mode() === "success")
                showNotification("Successfully added torrent.");
        }
    }
}
