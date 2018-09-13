const ROOT_FOLDER = "[root]";

const defaultSettings = {
        folders: ROOT_FOLDER + ":music:movies:images",
        host: "http://localhost:8080/gui/",
        user: "",
        password: ""
      };

function makeHost(host) {
    if (host) {
        let result = host.replace(/^https?:\/\//, "");
        return result.endsWith("/") ? result : result + "/";
    }
}

function withSettings(callback) {
    browser.storage.local.get("settings").then(({settings}) => {
        if (!settings) {
            settings = defaultSettings;
            browser.storage.local.set({settings: defaultSettings});
        }

        callback(settings);
    });
}

function onAPIToken(settings, f) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", "http://" + settings.user + ":" + settings.password + "@"
    + makeHost(settings.host) + "token.html", true);
    xhr.responseType = "document";

    xhr.onload = function(e) {

        if (this.status === 200) {
            let token = this.response.getElementById("token").textContent;
            let cookie = this.getResponseHeader("Set-Cookie");
            if (cookie)
                cookie = cookie.split(";")[0];
            f(token, cookie);
        }
        else  {
            browser.notifications.create("cake-notification", {
                "type": "basic",
                "iconUrl": browser.extension.getURL("res/icon96.png"),
                "title": "Add Torrent",
                "message": "uTorrent Web API returns " + this.status + " status code. Please check your settings."
            });
        }
    };

    xhr.send();
}

function addMagnet(settings, tab, page, link, where) {
    onAPIToken(settings, function (token, cookie) {
      let params = "?action=add-url&download_dir=0&token=" + token + "&s=" +  encodeURI(link);

      if (where !== ROOT_FOLDER)
        params += "&path=" + where;

      xhr2 = new XMLHttpRequest();
      xhr2.open("GET", "http://" + makeHost(settings.host) + params, true);
      xhr2.send();

      xhr2.onload = function(e) {
        console.log(this.status);
        console.log(this.response);
      };

    });
}

function downloadLink (settings, tab, page, link, where) {
    let xhr = new XMLHttpRequest();
    xhr.open("GET", link, true);
    xhr.responseType = "blob";

    xhr.onload = function(e) {
        if (this.status === 200) {

            let name = this.getResponseHeader("Content-Disposition");
            name = name? name.split("filename=")[1]: null;
            if (name)
                name = name.replace(/"/g, "").replace(/'/g, "");
            else
                name = (new Date().getTime()) + ".torrent";

            let torrent_data = this.response;

            onAPIToken(settings, function (token, cookie) {
                let params = "?action=add-file&download_dir=0&token=" + token;

                if (where !== ROOT_FOLDER)
                    params += "&path=" + where;

                let form = new FormData();
                form.append("torrent_file", torrent_data, name);

                let xhr2 = new XMLHttpRequest();
                xhr2.open("POST", "http://" + makeHost(settings.host) + params, true);
                xhr2.send(form);

                xhr2.onload = function(e) {
                    console.log(this.status);
                    console.log(this.response);
                };

            });
        }
    };
    xhr.send();
}

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

browser.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.linkUrl && info.linkUrl.startsWith("magnet:"))
        withSettings(settings => {
            addMagnet(settings, tab, info.pageUrl, info.linkUrl, info.menuItemId)
        });
    else
        withSettings(settings => {
            downloadLink(settings, tab, info.pageUrl, info.linkUrl, info.menuItemId);
        });
});

withSettings(settings => {
    settings.folders.split(":").forEach((folder) => {
        if (folder) {
            browser.contextMenus.create({
                id: folder,
                title: folder,
                contexts: ["link"]
            });
        }
    });
});