import {merge} from "./utils.js";
import {ROOT_FOLDER} from "./constants.js";

const SETTINGS_KEY = "settings";

class Settings {
    constructor() {
        this._default = {
            folders: ROOT_FOLDER + ":music:movies:images",
            host: "http://localhost:8080/gui/",
            user: "",
            password: "",
            client: "qbittorrent",
            notification_mode: "failure"
        };

        this._bin = {};
        this._key = SETTINGS_KEY;
    }

    async _loadPlatform() {
        if (!this._platform) {
            this._platform = {};

            if (browser.runtime.getPlatformInfo) {
            const platformInfo = await browser.runtime.getPlatformInfo();

                this._platform[platformInfo.os] = true;
            }

            if (navigator.userAgent.indexOf("Firefox") >= 0)
                this._platform.firefox = true;

            if (navigator.userAgent.indexOf("Chrome") >= 0)
                this._platform.chrome = true;
        }
    }

    async _loadSettings() {
        const object = await browser.storage.local.get(this._key);
        this._bin = merge(object?.[this._key] || {}, this._default);
    }

    async _load() {
        await this._loadPlatform();
        await this._loadSettings();
    }

    async _save() {
        return browser.storage.local.set({[this._key]: this._bin});
    }

    async _get(k) {
        const v = await browser.storage.local.get(k);
        if (v)
            return v[k];
        return null;
    }

    async _set(k, v) { return browser.storage.local.set({[k]: v}) }

    get(target, key, receiver) {
        if (key === "load")
            return v => this._load(); // sic !
        else if (key === "default")
            return this._default;
        else if (key === "platform")
            return this._platform;
        else if (key === "get")
            return this._get;
        else if (key === "set")
            return this._set;
        else if (key === "_bin")
            return this._bin;

        return (val, save = true) => {
            let bin = this._bin;

            if (val === undefined)
                return bin[key];

            let deleted;
            if (val === null) {
                deleted = bin[key];
                delete bin[key]
            }
            else
                bin[key] = val;

            let result = key in bin? bin[key]: deleted;

            if (save)
                return this._save().then(() => result);
            else
                return result;
        }
    }

    has(target, key) {
        return key in this._bin;
    }

    * enumerate() {
        for (let key in this._bin) yield key;
    }
}

export const settings = new Proxy({}, new Settings());

chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (changes[SETTINGS_KEY])
        settings.load();
});

