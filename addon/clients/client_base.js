import {settings} from "../settings.js";
import {mapLimit, showNotification, spacer} from "../utils.js";
import {downloadToUserCategories} from "./clients.js";
import {CATEGORY_SOURCE_USER} from "../constants.js";
import {checkLink} from "../site_rules.js";

export const BULK_DOWNLOAD_CONCURRENCY = 4;
// minimal time between the starts of .torrent downloads, some trackers reject bursts of requests
export const BULK_DOWNLOAD_INTERVAL = 100;

export function isMagnet(link) {
    return link.startsWith("magnet:");
}

export class TorrentClient {
    #extractFileName(response) {
        let fileName = response.headers.get("Content-Disposition");
        fileName = fileName? fileName.split(/filename\*?=/)[1]: null;
        if (fileName)
            fileName = fileName.replace(/"/g, "").replace(/'/g, "");
        else
            fileName = (new Date().getTime()) + ".torrent";

        return fileName;
    }

    _checkLink(link) {
        return checkLink(link).ok;
    }

    // throws on failure, used where errors are reported per link
    async _downloadFile(link) {
        const resp = await fetch(link);

        if (!resp.ok)
            throw new Error(`HTTP error: ${resp.status}`);

        const buffer = await resp.arrayBuffer();
        return {buffer, blob: new Blob([buffer]), fileName: this.#extractFileName(resp)};
    }

    async _downloadFileAsForm(link, formField) {
        try {
            const {blob, fileName} = await this._downloadFile(link);
            const form = new FormData();
            form.append(formField, blob, fileName);

            return form;
        }
        catch (e) {
            console.error(e);

            if (settings.notification_mode() === "failure")
                showNotification(`Error downloading torrent file.`);
        }
    }

    // Downloads the .torrent files of the given links; magnet links and links rejected by
    // site rules are passed through. Reports "downloading"/"downloaded"/"failed" to onProgress.
    // Returns [{url, magnet, file?: {buffer, blob, fileName}, error?}]
    async _prepareBulkItems(links, onProgress) {
        const waitTurn = spacer(BULK_DOWNLOAD_INTERVAL);

        return mapLimit(links, BULK_DOWNLOAD_CONCURRENCY, async url => {
            if (isMagnet(url))
                return {url, magnet: true};

            const check = checkLink(url, false);
            if (!check.ok) {
                onProgress(url, "failed", check.reason);
                return {url, magnet: false, error: check.reason};
            }

            try {
                await waitTurn();
                onProgress(url, "downloading");
                const file = await this._downloadFile(url);
                onProgress(url, "downloaded");
                return {url, magnet: false, file};
            }
            catch (e) {
                console.error(e);
                const error = `Download failed: ${e.message}`;
                onProgress(url, "failed", error);
                return {url, magnet: false, error};
            }
        });
    }

    // Adds several links to the same category, reporting each link's status via
    // onProgress(url, status, detail). Overridden by the clients with batched versions.
    async addTorrents(links, category, onProgress) {
        for (const url of links) {
            onProgress(url, "sending");

            try {
                if (isMagnet(url))
                    await this.addMagnet(url, category);
                else
                    await this.addTorrent(url, category);

                onProgress(url, "sent");
            }
            catch (e) {
                console.error(e);
                onProgress(url, "failed", e.message);
            }
        }
    }

    async getTorrentCategories(verbose = true) {
        let categories = [];

        if (downloadToUserCategories())
            categories = settings.folders().split(":");
        else
            categories = await this._queryClientCategories(verbose);

        return categories;
    }
}
