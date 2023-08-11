import {settings} from "../settings.js";
import {createClient, downloadToUserCategories} from "../clients/clients.js";
import {createContextMenu} from "./context_menu.js";
import {CATEGORY_SOURCE_USER} from "../constants.js";

$(init);

async function init() {
    $("#host").on("input", saveOptions);
    $("#user").on("input", saveOptions);
    $("#password").on("input", saveOptions);
    $("#client").on("change", onClientChanged);

    $("#category-source").on("change", onCategorySourceChanged);
    $("#category-refresh-link").on("click", e => {e.preventDefault(); refreshCategories();});
    $("#test-connection-link").on("click", onTestConnectionClick);

    $("#folders").on("input", async e => {await saveOptions(e); await refreshCategories();});

    await restoreOptions();
}

async function saveOptions() {
    if (downloadToUserCategories())
        await settings.folders(document.querySelector("#folders").value, false);

    await settings.host(document.querySelector("#host").value, false);
    await settings.user(document.querySelector("#user").value, false);
    await settings.password(document.querySelector("#password").value, false);
    await settings.client(document.querySelector("#client").value, false);
    await settings.category_source(document.querySelector("#category-source").value);
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

    const categorySource = settings.category_source();

    document.querySelector("#category-source").value = categorySource || CATEGORY_SOURCE_USER;
    await configureCategorySource();
}

async function onClientChanged(e) {
    if (e.target.value === "utorrent") {
        $("#host").attr("placeholder", 'For example: http://localhost:8080/gui/');
        $("#category-source").val(CATEGORY_SOURCE_USER)
            .prop("disabled", true);
    }
    else {
        $("#host").attr("placeholder", 'For example: http://localhost:8080/');
        $("#category-source").prop("disabled", false);
    }

    await saveOptions();
    await configureCategorySource();
}

async function onTestConnectionClick(e) {
    e.preventDefault();

    const client = createClient();
    await client.testConnection();
}

async function onCategorySourceChanged(e) {
    await saveOptions(e);
    return configureCategorySource();
}

async function configureCategorySource() {
    if (downloadToUserCategories()) {
        $("#category-refresh-link").hide();
        $("#folders").prop("disabled", false);
    }
    else {
        $("#folders").prop("disabled", true);
        $("#category-refresh-link").show();
    }

    await refreshCategories();
}

async function refreshCategories() {
    const client = createClient();
    const categories = await client.getTorrentCategories();

    $("#folders").val(categories.join(":"));

    await createContextMenu(categories);
}