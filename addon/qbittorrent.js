import {downloadFileAsForm, showNotification} from "./utils.js";

function adjustHostURL(url) {
    let result = url;

    if (/.*\/gui\/?$/.exec(result))
        result = result.replace(/\/gui\/?$/, "");

    if (url.endsWith("/"))
        result = result.replace(/\/$/, "");

    if (!/^https?:\/\//.exec(result))
        result = "http://" + result;

    return result;
}

function makeAPIURL(settings, api, method) {
    return `${adjustHostURL(settings.host)}/api/v2/${api}/${method}`;
}

function fetchAPI(settings, api, method) {
    return fetch(makeAPIURL(settings, api, method))
}

function fetchJSON(settings, api, method) {
    return fetchAPI(settings, api, method).then(r => r.json());
}

async function login(settings) {
    try {
        const loginURL = makeAPIURL(settings, "auth", "login");
        const resp = await fetch(loginURL + `?username=${settings.user}&password=${settings.password}`);

        if (!resp.ok)
            throw new Error(`HTTP error: ${resp.status}`);
    }
    catch (e) {
        console.log(e);
        showNotification("Can not login qBittorrent.");
    }
}

function logout(settings) {
    return fetchAPI(settings, "auth", "logout");
}

async function createSavePath(settings, category) {
    const prefs = await fetchJSON(settings, "app", "preferences");
    let path = prefs.save_path;

    if (!path.endsWith("/") && !path.endsWith("\\"))
        path += "/"

    return path + category;
}

async function addTorrent(settings, category, form) {
    try {
        await login(settings);
        const savePath = await createSavePath(settings, category);
        form.append("savepath", savePath);

        const apiURL = makeAPIURL(settings, "torrents", "add");
        const resp = await fetch(apiURL, {method: "POST", body: form});

        if (!resp.ok)
            showNotification("Error adding torrent.");
    }
    finally {
        await logout(settings);
    }
}

export class QBittorrentClient {
    async addMagnet(settings, link, category) {
        const form = new FormData();
        form.append("urls", link);
        return addTorrent(settings, category, form);
    }

    async addTorrent(settings, link, category) {
        const form = await downloadFileAsForm(link, "torrents");
        return addTorrent(settings, category, form);
    }
}