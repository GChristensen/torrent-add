import {settings} from "./settings.js";
import {createClient, downloadToUserCategories} from "./clients/clients.js";
import {BULK_ADD_MENU, MENU_SEPARATOR, REFRESH_MENU, SETTINGS_MENU} from "./constants.js";
import {createContextMenu} from "./ui/context_menu.js";
import {showNotification} from "./utils.js";

async function openClientWebUI() {
    await settings.load();

    const clientWebUIURL = settings.host();

    if (clientWebUIURL) {
        browser.tabs.create({
            "url": clientWebUIURL, "active": true
        });
    }
    else {
        browser.tabs.create({
            "url": browser.runtime.getURL("/ui/options.html?init=true"), "active": true
        });
    }
}

const action = _MANIFEST_V3
    ? browser.action
    : browser.browserAction;

action.onClicked.addListener(openClientWebUI);


async function addTorrent(link, category) {
    await settings.load();
    const client = createClient();

    if (category.endsWith(REFRESH_MENU)) {
        await createMenus();
    }
    else {
        if (link.startsWith("magnet:"))
            return client.addMagnet(link, category);
        else
            return client.addTorrent(link, category);
    }
}

async function createMenus() {
    await settings.load();
    const client = createClient();
    const categories = await client.getTorrentCategories(false);

    await createContextMenu(categories);
}

settings.load().then(async () => {
    await createMenus();
});

async function injectBulkDialog(tab, frameId = 0) {
    try {
        if (browser.scripting)
            await browser.scripting.executeScript({
                target: {tabId: tab.id, frameIds: [frameId]},
                files: ["ui/bulk_add.js"]
            });
        else
            await browser.tabs.executeScript(tab.id, {file: "/ui/bulk_add.js", frameId});
    }
    catch (e) {
        console.error(e);
        showNotification("Bulk Add is not available on this page.");
    }
}

browser.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === SETTINGS_MENU)
        browser.tabs.create({
            "url": browser.runtime.getURL("/ui/options.html"), "active": true
        });
    else if (info.menuItemId === BULK_ADD_MENU)
        return injectBulkDialog(tab, info.frameId);
    else if (info.linkUrl)
        return addTorrent(info.linkUrl, info.menuItemId);
});

async function getBulkCategories() {
    await settings.load();
    const categories = await createClient().getTorrentCategories(true);
    return categories.filter(c => c && c !== MENU_SEPARATOR);
}

const BULK_FINAL_STATUSES = ["added", "sent", "exists", "failed"];

function notifyBulkSummary({total, added, exists, failed}) {
    const mode = settings.notification_mode();

    if (mode === "never" || (!failed && mode !== "success"))
        return;

    const details = [];
    if (exists)
        details.push(`${exists} already present`);
    if (failed)
        details.push(`${failed} failed`);

    showNotification(`Added ${added} of ${total} torrent${total === 1? "": "s"}`
        + (details.length? ` (${details.join(", ")}).`: "."));
}

const bulkHandlers = {
    async BULK_INIT() {
        const categories = await getBulkCategories();
        return {categories, refreshable: !downloadToUserCategories(), filter: settings.bulk_filter()};
    },

    async BULK_REFRESH() {
        await createMenus();
        return {categories: await getBulkCategories()};
    },

    async BULK_ADD({links, category, filter}, sender) {
        await settings.load();

        if (filter)
            await settings.bulk_filter(filter);

        const statuses = new Map(links.map(url => [url, "queued"]));
        const onProgress = (url, status, detail) => {
            statuses.set(url, status);

            // the dialog may already be closed
            try {
                browser.tabs.sendMessage(sender.tab.id, {type: "BULK_PROGRESS", url, status, detail},
                    {frameId: sender.frameId})?.catch(() => {});
            }
            catch (e) {
            }
        };

        let error = "Error adding torrent.";
        try {
            await createClient().addTorrents(links, category, onProgress);
        }
        catch (e) {
            console.error(e);
            error = e.addTorrentMessage || e.message || error;
        }

        for (const [url, status] of statuses)
            if (!BULK_FINAL_STATUSES.includes(status))
                onProgress(url, "failed", error);

        const count = (...names) => [...statuses.values()].filter(s => names.includes(s)).length;
        const summary = {
            total: statuses.size,
            added: count("added", "sent"),
            exists: count("exists"),
            failed: count("failed")
        };

        notifyBulkSummary(summary);
        return summary;
    }
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handler = bulkHandlers[message?.type];

    if (handler) {
        // Chrome does not accept a returned promise here
        handler(message, sender).then(sendResponse, e => {
            console.error(e);
            sendResponse({error: e.message});
        });
        return true;
    }
});

browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "ADD_TORRENT":
            if (message.url)
                return addTorrent(message.url, message.folder || "");
    }
});

if (browser.webRequest) {
    function setRequestHeader(headers, name, value) {
        const lowerName = name.toLowerCase();
        const header = headers.find(h => h.name.toLowerCase() === lowerName);

        if (header)
            header.value = value;
        else
            headers.push({name, value});
    }

    async function getActiveTabURL() {
        const [tab] = await browser.tabs.query({active: true, currentWindow: true});
        return tab?.url;
    }

    browser.webRequest.onBeforeSendHeaders.addListener(
        async (requestDetails) => {
            const headers = requestDetails.requestHeaders;

            for (let header of headers) {
                if (header.name.toLowerCase() === "cookie") {
                    if (header.value && header.value.indexOf("bb_dl=") === -1)
                        header.value = header.value + "; bb_dl=" + requestDetails.url.split("=")[1];
                }
            }

            setRequestHeader(headers, "Origin", new URL(requestDetails.url).origin);
            setRequestHeader(headers, "Sec-Fetch-Dest", "document");

            const activeTabURL = await getActiveTabURL();
            if (activeTabURL)
                setRequestHeader(headers, "Referer", activeTabURL);

            return {requestHeaders: headers};
        },
        {urls: ["*://*/forum/dl.php?t=*"]},
        ["blocking", "requestHeaders"]
    );


    function originWithId(header) {
        return header.name.toLowerCase() === 'origin' &&
            (header.value.indexOf('moz-extension://') === 0 ||
                header.value.indexOf('chrome-extension://') === 0);
    }

    browser.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
            return {
                requestHeaders: details.requestHeaders.filter(x => !originWithId(x))
            }
        },
        {urls: ["<all_urls>"]},
        ["blocking", "requestHeaders"]
    );
}