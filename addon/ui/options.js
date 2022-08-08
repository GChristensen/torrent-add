import {settings} from "../settings.js";

async function saveOptions(e) {
    if (e) {
        e.preventDefault();

        await settings.folders(document.querySelector("#folders").value);
        await settings.host(document.querySelector("#host").value);
        await settings.user(document.querySelector("#user").value);
        await settings.password(document.querySelector("#password").value);
        await settings.client(document.querySelector("#client").value);
    }
}

async function restoreOptions() {
    await settings.load();

    document.querySelector("#folders").value = settings.folders();
    document.querySelector("#host").value = settings.host();
    document.querySelector("#user").value = settings.user();
    document.querySelector("#password").value = settings.password();

    const client = settings.client();
    if (client)
        document.querySelector("#client").value = client;
}

async function createMenus() {
    await browser.contextMenus.removeAll();
    const folders = document.querySelector("#folders").value.split(":");

    folders.forEach(folder => {
        if (folder) {
            browser.contextMenus.create({
              id: folder,
              title: folder,
              contexts: ["link"]
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await restoreOptions();

    document.getElementById("folders").addEventListener("blur", (e) => {createMenus(); saveOptions(e);});
    document.getElementById("host").addEventListener("blur", saveOptions);
    document.getElementById("user").addEventListener("blur", saveOptions);
    document.getElementById("password").addEventListener("blur", saveOptions);
    document.getElementById("client").addEventListener("blur", saveOptions);
    
    await createMenus();
});