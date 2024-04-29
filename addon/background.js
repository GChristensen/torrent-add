import {settings} from "./settings.js";
import {createClient} from "./clients/clients.js";
import {REFRESH_MENU} from "./constants.js";
import {createContextMenu} from "./ui/context_menu.js";

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

browser.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.linkUrl)
        return addTorrent(info.linkUrl, info.menuItemId);
});

browser.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "ADD_TORRENT":
            if (message.url)
                return addTorrent(message.url, message.folder || "");
    }
});

if (browser.webRequest) {
    browser.webRequest.onBeforeSendHeaders.addListener(
        (requestDetails) => {
            for (var header of requestDetails.requestHeaders) {
                if (header.name.toLowerCase() === "cookie") {
                    if (header.value && header.value.indexOf("bb_dl=") === -1)
                        header.value = header.value + "; bb_dl=" + requestDetails.url.split("=")[1];
                }
            }
            return {requestHeaders: requestDetails.requestHeaders};
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