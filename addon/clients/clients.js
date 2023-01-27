import {settings} from "../settings.js";
import {QBittorrentClient} from "./qbittorrent.js";
import {UTorrentClient} from "./utorrent.js";
import {CATEGORY_SOURCE_USER} from "../constants.js";

export function createClient() {
    switch (settings.client()) {
        case "qbittorrent":
            return new QBittorrentClient();
        default:
            return new UTorrentClient();
    }
}

export function downloadToUserCategories() {
    const categorySource = settings.category_source();
    return !categorySource || categorySource === CATEGORY_SOURCE_USER;
}