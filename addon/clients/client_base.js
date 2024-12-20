import {settings} from "../settings.js";
import {showNotification} from "../utils.js";
import {downloadToUserCategories} from "./clients.js";
import {CATEGORY_SOURCE_USER} from "../constants.js";

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

    async _downloadFileAsForm(link, formField) {
        try {
            const resp = await fetch(link);

            if (resp.ok) {
                const form = new FormData();
                const fileBlob = new Blob([await resp.arrayBuffer()]);
                const fileName = this.#extractFileName(resp);
                form.append(formField, fileBlob, fileName);

                return form;
            }
            else
                throw new Error(`HTTP error: ${resp.status}`)
        }
        catch (e) {
            console.error(e);

            if (settings.notification_mode() === "failure")
                showNotification(`Error downloading torrent file.`);
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