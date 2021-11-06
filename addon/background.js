import {DEFAULT_SETTINGS} from "./constants.js";
import {UTorrentClient} from "./utorrent.js";
import {QBittorrentClient} from "./qbittorrent.js";

function withSettings(callback) {
    chrome.storage.local.get("settings", ({settings}) => {
        if (!settings)
            settings = DEFAULT_SETTINGS;

        callback(settings);
    });
}

function selectClient(settings) {
    switch (settings.client) {
        case "qbittorrent":
            return new QBittorrentClient();
        default:
            return new UTorrentClient();
    }
}

function addTorrent(link, category) {
    withSettings(settings => {
        const client = selectClient(settings);

        if (link.startsWith("magnet:"))
            return client.addMagnet(settings, link, category);
        else
            return client.addTorrent(settings, link, category);
    });
}

withSettings(settings => {
    settings.folders.split(":").forEach((folder) => {
        if (folder) {
            chrome.contextMenus.create({
                id: folder,
                title: folder,
                contexts: ["link"]
            });
        }
    });
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.linkUrl)
        addTorrent(info.linkUrl, info.menuItemId);
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case "ADD_TORRENT":
            if (message.url)
                addTorrent(message.url, message.folder);
            break;
    }
});

chrome.webRequest.onBeforeSendHeaders.addListener(
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

chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
        return {
            requestHeaders: details.requestHeaders.filter(x => !originWithId(x))
        }
    },
    {urls: ["<all_urls>"]},
    ["blocking", "requestHeaders"]
);