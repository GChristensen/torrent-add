import {settings} from "../settings.js"
import {downloadFileAsForm, showNotification} from "../utils.js";
import {ROOT_FOLDER} from "../constants.js";

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

function makeAPIURL(api, method) {
    return `${adjustHostURL(settings.host())}/api/v2/${api}/${method}`;
}

function fetchAPI(api, method) {
    const apiURL = makeAPIURL(api, method);
    return fetch(apiURL);
}

function postAPI(api, method) {
    const apiURL = makeAPIURL(api, method);
    return fetch(apiURL, {method: "post"});
}

function fetchJSON(api, method) {
    return fetchAPI(api, method).then(r => r.json());
}

async function login() {
    try {
        const loginURL = makeAPIURL("auth", "login");
        const resp = await fetch(loginURL, {
            method: "post",
            headers: {"content-type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({
                    "username": settings.user(),
                    "password": settings.password()
                })
        });

        if (!resp.ok || (await resp.text()) === "Fails.") {
            const error = new Error(`HTTP error: ${resp.status}`);
            error.addTorrentMessage = `Please check qBittorrent authentication credentials.`;
            throw error;
        }
    }
    catch (e) {
        console.log(e);
        showNotification(e.addTorrentMessage || "Can not access qBittorrent.");
    }
}

function logout() {
    return postAPI("auth", "logout");
}

async function createSavePath(category) {
    const prefs = await fetchJSON("app", "preferences");
    let path = prefs.save_path;

    if (!path.endsWith("/") && !path.endsWith("\\"))
        path += "/";

    path = path + (category === ROOT_FOLDER? "": (category + "/"));

    return path;
}

async function addTorrent(category, form) {
    try {
        await login();
        const savePath = await createSavePath(category);
        form.append("savepath", savePath);

        const apiURL = makeAPIURL("torrents", "add");
        const response = await fetch(apiURL, {method: "POST", body: form});

        if (!response.ok)
            showNotification("Error adding torrent.");
    }
    finally {
        await logout();
    }
}

export class QBittorrentClient {
    async addMagnet(link, category) {
        const form = new FormData();
        form.append("urls", link);
        return addTorrent(category, form);
    }

    async addTorrent(link, category) {
        const form = await downloadFileAsForm(link, "torrents");
        return addTorrent(category, form);
    }
}