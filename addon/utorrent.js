import {ROOT_FOLDER} from "./constants.js";
import {downloadFileAsForm, showNotification} from "./utils.js";

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

async function getAPIToken(settings, host) {
    try {
        const headers = new Headers();
        headers.append('Authorization', 'Basic ' + btoa(settings.user + ':' + settings.password));

        const tokenURL = host + "token.html";
        const resp = await fetch(tokenURL, {headers: headers});

        if (resp.ok) {
            const doc = await resp.text();
            return doc.match(/<div id=['"]token['"][^>]*>([^<]*)</)[1];
        }
        else
            showNotification(`Web client HTTP API error: ${resp.statusText}.`);
    }
    catch (e) {
        console.error(e);
        showNotification(`Error authenticating torrent client.`);
        throw e;
    }
}

async function makeAPIURL(settings, action, category) {
    const host = adjustHostURL(settings.host);
    const token = await getAPIToken(settings, host);
    const path = category === ROOT_FOLDER? "": category;
    return `${host}?action=${action}&download_dir=0&token=${token}${path? "&path=" + path: ""}`;
}

export class UTorrentClient {
    constructor(settings) {
        this.settings = settings
    }

    async addMagnet(link, category) {
        const apiURL = await makeAPIURL(this.settings, "add-url", category);
        return fetch(apiURL + "&s=" +  encodeURIComponent(link));
    }

    async addTorrent(link, category) {
        const form = await downloadFileAsForm(link, "torrent_file");

        if (form) {
            const apiURL = await makeAPIURL(this.settings, "add-file", category);
            return fetch(apiURL, {method: "POST", body: form});
        }
    }
}
