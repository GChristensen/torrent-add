import {showNotification} from "./utils.js";

// a rule returns true if the link is acceptable, or a reason string otherwise
function preferMagnet(url) {
    if (url.protocol === "http:" || url.protocol === "https:")
        return "On rutracker, add torrents using the magnet link instead.";
    return true;
}

const SITE_RULES = {
    "rutracker.org": preferMagnet,
    "rutracker.net": preferMagnet,
    "rutracker.nl":  preferMagnet,
};

export function checkLink(link, notify = true) {
    let url;
    try {
        url = new URL(link);
    }
    catch (e) {
        return {ok: true}; // unparseable link — let the download path surface the error
    }

    const host = url.hostname.replace(/^www\./, "");

    for (const site in SITE_RULES) {
        if (host === site || host.endsWith("." + site)) {
            const result = SITE_RULES[site](url);

            if (result === true)
                return {ok: true};

            if (notify)
                showNotification(result);

            return {ok: false, reason: result};
        }
    }

    return {ok: true};
}
