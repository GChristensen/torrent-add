import {UTorrentClient} from "./clients/utorrent.js";
import {QBittorrentClient} from "./clients/qbittorrent.js";
import {settings} from "./settings.js";

function createClient() {
    switch (settings.client()) {
        case "qbittorrent":
            return new QBittorrentClient();
        default:
            return new UTorrentClient();
    }
}

async function addTorrent(link, category) {
    await settings.load();

    const client = createClient();

    if (link.startsWith("magnet:"))
        return client.addMagnet(link, category);
    else
        return client.addTorrent(link, category);
}

settings.load().then(async () => {
    await browser.contextMenus.removeAll();

    settings.folders().split(":").forEach((folder) => {
        if (folder) {
            chrome.contextMenus.create({
                id: folder,
                title: folder,
                contexts: ["link"]
            });
        }
    });
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