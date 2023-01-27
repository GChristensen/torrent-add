import {settings} from "./settings.js";

export function merge(to, from) {
    for (const [k, v] of Object.entries(from)) {
        if (!to.hasOwnProperty(k))
            to[k] = v;
    }
    return to;
}

export function showNotification(message) {
    const icon = settings.platform.firefox
        ? chrome.runtime.getURL("ui/icons/logo.svg")
        : chrome.runtime.getURL("ui/icons/logo128.png");

    chrome.notifications.create("cake-notification", {
        "type": "basic",
        "iconUrl": icon,
        "title": "Add Torrent",
        "message": message
    });
}

export async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;
    delete options.timeout;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(resource, {
        ...options,
        signal: controller.signal
    });
    clearTimeout(id);

    return response;
}
