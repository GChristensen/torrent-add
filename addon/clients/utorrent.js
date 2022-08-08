import {settings} from "../settings.js"
import {ROOT_FOLDER} from "../constants.js";
import {downloadFileAsForm, showNotification} from "../utils.js";

function adjustHostURL(url) {
    let result = url;

    if (!url.endsWith("/"))
        result += "/";

    if (!/^https?:\/\//.exec(result))
        result = "http://" + result;

    if (!/.*\/gui\/?$/.exec(result))
        result += "gui/";

    return result;
}

function makeuTorrentAuthHeaders() {
    const headers = new Headers();
    headers.append('Authorization', 'Basic ' + btoa(settings.user() + ':' + settings.password()));
    return headers;
}

async function getAPIToken(host) {
    try {
        const tokenURL = host + "token.html";
        const response = await fetch(tokenURL, {headers: makeuTorrentAuthHeaders()});

        if (response.ok) {
            const doc = await response.text();
            return doc.match(/<div id=['"]token['"][^>]*>([^<]*)</)[1];
        }
        else if (response.status === 401) {
            const error = new Error();
            error.addTorrentMessage = `Please check uTorrent authentication credentials.`;
            throw error;
        }
        else
            showNotification(`Web client HTTP API error: ${response.statusText}.`);
    }
    catch (e) {
        console.error(e);
        showNotification(e.addTorrentMessage || `Error authenticating uTorrent.`);
        throw e;
    }
}

async function makeAPIURL(action, category) {
    const host = adjustHostURL(settings.host());
    const token = await getAPIToken(host);
    const path = category === ROOT_FOLDER? "": category;
    return `${host}?token=${token}&action=${action}&download_dir=0${path? "&path=" + path: ""}`;
}

export class UTorrentClient {
    async addMagnet(link, category) {
        const apiURL = await makeAPIURL("add-url", category);
        const response = await fetch(apiURL + "&s=" +  encodeURIComponent(link), {
            headers: makeuTorrentAuthHeaders()
        });

        if (!response.ok)
            showNotification("Error adding torrent.");
    }

    async addTorrent(link, category) {
        const form = await downloadFileAsForm(link, "torrent_file");

        if (form) {
            const apiURL = await makeAPIURL("add-file", category);
            const response = await fetch(apiURL, {
                method: "POST",
                body: form,
                headers: makeuTorrentAuthHeaders()
            });

            if (!response.ok)
                showNotification("Error adding torrent.");
        }
    }
}
