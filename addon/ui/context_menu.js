import {ADDON_NAME, BULK_ADD_MENU, BULK_ADD_TITLE, MENU_SEPARATOR, REFRESH_MENU, SETTINGS_MENU} from "../constants.js";
import {downloadToUserCategories} from "../clients/clients.js";

function createBulkAddMenu(parentId) {
    const parent = parentId? {parentId}: {};

    chrome.contextMenus.create({
        id: BULK_ADD_MENU,
        ...parent,
        title: BULK_ADD_TITLE,
        contexts: ["page", "link"]
    });
    chrome.contextMenus.create({
        id: BULK_ADD_MENU + "-separator",
        ...parent,
        type: "separator",
        contexts: ["link"]
    });
}

export async function createContextMenu(categories) {
    await browser.contextMenus.removeAll();

    chrome.contextMenus.create({
        id: SETTINGS_MENU,
        title: "Settings",
        contexts: [_MANIFEST_V3? "action": "browser_action"]
    });

    const useClientCategories = !downloadToUserCategories();

    if (useClientCategories && !categories.length) {
        chrome.contextMenus.create({
            id: ADDON_NAME,
            title: ADDON_NAME,
            contexts: ["page", "link"]
        });
        createBulkAddMenu(ADDON_NAME);
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
            contexts: ["page", "link"]
        });
        createBulkAddMenu(ADDON_NAME);
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
        createBulkAddMenu();

        categories.forEach((folder, i) => {
            if (folder === MENU_SEPARATOR) {
                chrome.contextMenus.create({
                    id: `[separator-${i}]`,
                    type: "separator",
                    contexts: ["link"]
                });
            }
            else if (folder) {
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
