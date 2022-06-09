
export function showNotification(message) {
    chrome.notifications.create("cake-notification", {
        "type": "basic",
        "iconUrl": chrome.runtime.getURL("res/icon.svg"),
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