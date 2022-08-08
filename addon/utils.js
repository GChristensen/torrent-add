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

function extractFileName(response) {
    let fileName = response.headers.get("Content-Disposition");
    fileName = fileName? fileName.split(/filename\*?=/)[1]: null;
    if (fileName)
        fileName = fileName.replace(/"/g, "").replace(/'/g, "");
    else
        fileName = (new Date().getTime()) + ".torrent";

    return fileName;
}

export async function downloadFileAsForm(link, formField) {
    try {
        const resp = await fetch(link);

        if (resp.ok) {
            const form = new FormData();
            const fileBlob = new Blob([await resp.arrayBuffer()]);
            const fileName = extractFileName(resp);
            form.append(formField, fileBlob, fileName);

            return form;
        }
        else
            throw new Error(`HTTP error: ${resp.status}`)
    }
    catch (e) {
        console.error(e);
        showNotification(`Error downloading torrent file.`);
    }
}