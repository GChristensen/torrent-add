import {settings} from "../settings.js"
import {fetchWithTimeout, showNotification} from "../utils.js";
import {CATEGORY_SOURCE_USER, CATEGORY_SOURCE_USER_CATEGORIES, ROOT_FOLDER} from "../constants.js";
import {TorrentClient} from "./client_base.js";
import {downloadToUserCategories} from "./clients.js";

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

    async #addTorrent(category, form) {
        try {
            await this.#login();

            const prefs = await this.#fetchJSON("app", "preferences");

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

            const apiURL = this.#makeAPIURL("torrents", "add");
            const response = await fetch(apiURL, {method: "POST", body: form});

            if (!response.ok)
                showNotification("Error adding torrent.");
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
            await this.#logout();
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
            await this.#logout();
        }

        return result;
    }

    async addMagnet(link, category) {
        const form = new FormData();
        form.append("urls", link);
        return this.#addTorrent(category, form);
    }

    async addTorrent(link, category) {
        const form = await this._downloadFileAsForm(link, "torrents");
        return this.#addTorrent(category, form);
    }
}
