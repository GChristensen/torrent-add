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

// Promise.all over items with at most `limit` calls of fn in flight
export async function mapLimit(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;

    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    }

    await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
    return results;
}

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Returns a function whose returned promises resolve at least `interval` ms apart, in call order.
// The start time is reserved synchronously, so concurrent callers can't get the same slot.
export function spacer(interval) {
    let nextStart = 0;

    return () => {
        const now = Date.now();
        const start = Math.max(now, nextStart);
        nextStart = start + interval;
        return delay(start - now);
    };
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
