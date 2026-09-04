import {showNotification} from "./utils.js";

function preferMagnet(url) {
    if (url.protocol === "http:" || url.protocol === "https:") {
        showNotification("On rutracker, add torrents using the magnet link instead.");
        return false;
    }
    return true;
}

const SITE_RULES = {
    "rutracker.org": preferMagnet,
    "rutracker.net": preferMagnet,
    "rutracker.nl":  preferMagnet,
};

export function checkLink(link) {
    let url;
    try {
        url = new URL(link);
    }
    catch (e) {
        return true; // unparseable link — let the download path surface the error
    }

    const host = url.hostname.replace(/^www\./, "");

    for (const site in SITE_RULES) {
        if (host === site || host.endsWith("." + site))
            return SITE_RULES[site](url);
    }

    return true;
}
