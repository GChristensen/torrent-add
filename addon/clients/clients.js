import {settings} from "../settings.js";
import {QBittorrentClient} from "./qbittorrent.js";
import {UTorrentClient} from "./utorrent.js";
import {TransmissionClient} from "./transmission.js";
import {CATEGORY_SOURCE_CLIENT_CATEGORIES} from "../constants.js";

export function createClient() {
    switch (settings.client()) {
        case "qbittorrent":
            return new QBittorrentClient();
        case "transmission":
            return new TransmissionClient();
        default:
            return new UTorrentClient();
    }
}

export function downloadToUserCategories() {
    const categorySource = settings.category_source();
    return !categorySource || categorySource !== CATEGORY_SOURCE_CLIENT_CATEGORIES;
}