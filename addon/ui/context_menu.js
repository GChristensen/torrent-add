import {ADDON_NAME, REFRESH_MENU} from "../constants.js";
import {downloadToUserCategories} from "../clients/clients.js";

export async function createContextMenu(categories) {
    await browser.contextMenus.removeAll();

    const useClientCategories = !downloadToUserCategories();

    if (useClientCategories && !categories.length) {
        chrome.contextMenus.create({
            id: ADDON_NAME,
            title: ADDON_NAME,
            contexts: ["link"]
        });
        chrome.contextMenus.create({
            id: REFRESH_MENU,
            parentId: ADDON_NAME,
            title: REFRESH_MENU,
            contexts: ["link"]
        });
    }
    else if (categories.length === 1) {
        chrome.contextMenus.create({
            id: ADDON_NAME,
            title: ADDON_NAME,
            contexts: ["link"]
        });
        chrome.contextMenus.create({
            id: categories[0],
            parentId: ADDON_NAME,
            title: categories[0],
            contexts: ["link"]
        });

        if (useClientCategories) {
            chrome.contextMenus.create({
                id: REFRESH_MENU + "-separator",
                type: "separator",
                contexts: ["link"]
            });
            chrome.contextMenus.create({
                id: REFRESH_MENU,
                title: REFRESH_MENU,
                contexts: ["link"]
            });
        }
    }
    else {
        categories.forEach(folder => {
            if (folder) {
                chrome.contextMenus.create({
                    id: folder,
                    title: folder,
                    contexts: ["link"]
                });
            }
        });

        if (useClientCategories) {
            chrome.contextMenus.create({
                id: REFRESH_MENU + "-separator",
                type: "separator",
                contexts: ["link"]
            });
            chrome.contextMenus.create({
                id: REFRESH_MENU,
                title: REFRESH_MENU,
                contexts: ["link"]
            });
        }
    }
}