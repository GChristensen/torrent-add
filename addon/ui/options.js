import {settings} from "../settings.js";
import {createClient, downloadToUserCategories} from "../clients/clients.js";
import {createContextMenu} from "./context_menu.js";
import {BULK_ADD_TITLE, CATEGORY_SOURCE_USER, MENU_SEPARATOR, REFRESH_MENU, ROOT_FOLDER} from "../constants.js";

const $ = selector => document.querySelector(selector);
const radios = name => document.querySelectorAll(`input[name='${name}']`);

const REMOVE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;

let folders = [];
let draggedFolder = null;

init();

async function init() {
    $("#addon-version").textContent = `Version ${_ADDON_VERSION}`;

    for (const id of ["host", "user", "password"])
        $(`#${id}`).addEventListener("input", e => { resetConnectionTest(); settings[id](e.target.value); });

    $("#password-toggle").addEventListener("click", onPasswordToggleClick);
    $("#test-connection").addEventListener("click", onTestConnectionClick);

    radios("client").forEach(r => r.addEventListener("change", onClientChanged));
    radios("category-source").forEach(r => r.addEventListener("change", onCategorySourceChanged));
    radios("notifications").forEach(r => r.addEventListener("change", e => settings.notification_mode(e.target.value)));

    $("#category-refresh").addEventListener("click", () => refreshCategories());
    $("#add-root").addEventListener("click", () => setFolders([ROOT_FOLDER, ...folders]));

    const folderInput = $("#folder-input");
    folderInput.addEventListener("keydown", onFolderInputKeyDown);
    folderInput.addEventListener("input", onFolderInputInput);
    folderInput.addEventListener("blur", () => commitFolderInput());
    const foldersField = $("#folders-field");
    foldersField.addEventListener("click", e => {
        if (e.target === e.currentTarget && !folderInput.hidden)
            folderInput.focus();
    });
    foldersField.addEventListener("dragover", onFieldDragOver);
    foldersField.addEventListener("dragleave", onFieldDragLeave);
    foldersField.addEventListener("drop", onFieldDrop);

    await restoreOptions();
}

async function restoreOptions() {
    await settings.load();

    $("#host").value = settings.host();
    $("#user").value = settings.user();
    $("#password").value = settings.password();

    setRadio("client", settings.client() || "qbittorrent");
    setRadio("category-source", settings.category_source() || CATEGORY_SOURCE_USER);
    setRadio("notifications", settings.notification_mode() || "failure");

    folders = parseFolders(settings.folders());

    await configureClient();
    await configureCategorySource();
}

function getRadio(name) {
    return [...radios(name)].find(r => r.checked)?.value;
}

function setRadio(name, value) {
    radios(name).forEach(r => r.checked = r.value === value);
}

async function onClientChanged(e) {
    resetConnectionTest();
    await settings.client(e.target.value);
    await configureClient();
    await configureCategorySource();
}

async function configureClient() {
    const uTorrent = getRadio("client") === "utorrent";

    $("#host").placeholder = uTorrent
        ? "For example: http://localhost:8080/gui/"
        : "For example: http://localhost:8080/";

    radios("category-source").forEach(r => r.disabled = uTorrent && r.value !== CATEGORY_SOURCE_USER);

    if (uTorrent && getRadio("category-source") !== CATEGORY_SOURCE_USER) {
        setRadio("category-source", CATEGORY_SOURCE_USER);
        await settings.category_source(CATEGORY_SOURCE_USER);
    }
}

async function onCategorySourceChanged(e) {
    await settings.category_source(e.target.value);
    await configureCategorySource();
}

async function configureCategorySource() {
    const source = getRadio("category-source");
    const editable = downloadToUserCategories();

    $("#folders-label").textContent = source === CATEGORY_SOURCE_USER
        ? "Folders"
        : editable ? "Categories" : "Categories in qBittorrent";

    $("#folders-field").classList.toggle("locked", !editable);
    $("#folder-input").hidden = !editable;
    $("#folders-help").hidden = !editable;
    $("#client-categories-hint").hidden = editable;

    await refreshCategories();
}

async function refreshCategories() {
    const client = createClient();
    const categories = (await client.getTorrentCategories()).filter(c => c);

    const locked = !downloadToUserCategories();
    renderChips(locked ? categories : folders, locked);
    renderMenuPreview(categories);

    await createContextMenu(categories);
}

function parseFolders(text) {
    return (text || "").split(":").map(f => f.trim()).filter(f => f);
}

async function setFolders(list) {
    // separators may repeat, anything else is kept once
    folders = list.filter((f, i) => f === MENU_SEPARATOR || list.indexOf(f) === i);
    await settings.folders(folders.join(":"));
    await refreshCategories();
}

function commitFolderInput(text = $("#folder-input").value) {
    $("#folder-input").value = "";
    const added = parseFolders(text);

    if (added.length)
        return setFolders([...folders, ...added]);
}

function onFolderInputKeyDown(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        commitFolderInput();
    }
    else if (e.key === "Backspace" && !e.target.value && folders.length)
        setFolders(folders.slice(0, -1));
}

// ":" separates folders in the stored settings string, so it can't be a part of a name
function onFolderInputInput(e) {
    const input = e.target;

    if (input.value.includes(":")) {
        const caret = input.selectionStart - (input.value.slice(0, input.selectionStart).split(":").length - 1);
        input.value = input.value.replaceAll(":", "");
        input.setSelectionRange(caret, caret);
        showColonWarning();
    }
}

let colonWarningTimeout;
function showColonWarning() {
    $("#colon-warning").hidden = false;
    clearTimeout(colonWarningTimeout);
    colonWarningTimeout = setTimeout(() => $("#colon-warning").hidden = true, 3000);
}

function renderChips(categories, locked) {
    const list = $("#chip-list");
    list.replaceChildren();

    for (const [index, name] of categories.entries()) {
        const root = name === ROOT_FOLDER;
        const separator = name === MENU_SEPARATOR;
        const label = root ? "Default location" : separator ? "Separator" : name;

        const chip = document.createElement("span");
        chip.className = root ? "chip root" : separator ? "chip separator" : "chip";

        if (separator) {
            const line = document.createElement("span");
            line.className = "sep-line";
            line.setAttribute("aria-label", label);
            chip.append(line);
            chip.title = "Menu separator";
        }
        else
            chip.textContent = label;

        if (root)
            chip.title = `${ROOT_FOLDER}: the client's default download location`;

        if (!locked) {
            chip.dataset.index = index;
            chip.draggable = true;
            chip.title = chip.title || "Drag to reorder (or Alt+Left/Right)";
            chip.addEventListener("dragstart", onChipDragStart);
            chip.addEventListener("dragend", onChipDragEnd);
            chip.addEventListener("keydown", onChipKeyDown);

            const remove = document.createElement("button");
            remove.type = "button";
            remove.setAttribute("aria-label", `Remove ${separator ? "separator" : label}`);
            remove.innerHTML = REMOVE_ICON;
            remove.addEventListener("click", () => setFolders(folders.filter((_, i) => i !== index)));
            chip.append(remove);
        }

        list.append(chip);
    }

    const plainFolders = getRadio("category-source") === CATEGORY_SOURCE_USER;
    $("#add-root-group").hidden = !plainFolders || folders.includes(ROOT_FOLDER);
    $("#folder-input").placeholder = categories.length
        ? "Add…"
        : plainFolders ? "Add a folder, e.g. Movies" : "Add a category, e.g. movies";
}

// moves the folder at index "from" next to the one at index "to" (or to the end if "to" is null),
// returns its new index
async function moveFolder(from, to, after) {
    const list = [...folders];
    const [name] = list.splice(from, 1);
    const index = to === null ? list.length : to - (to > from ? 1 : 0) + (after ? 1 : 0);

    list.splice(index, 0, name);
    await setFolders(list);

    return index;
}

function onChipDragStart(e) {
    draggedFolder = Number(e.currentTarget.dataset.index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", folders[draggedFolder]);
    e.currentTarget.classList.add("dragging");
}

function onChipDragEnd(e) {
    draggedFolder = null;
    e.currentTarget.classList.remove("dragging");
    clearDropMarks();
}

function clearDropMarks() {
    document.querySelectorAll(".chip.drop-before, .chip.drop-after")
        .forEach(c => c.classList.remove("drop-before", "drop-after"));
}

// returns the chip to drop next to and the side, or null target for the end of the list
function findDropTarget(e) {
    const chip = e.target.closest?.(".chip[data-index]");

    if (chip) {
        const rect = chip.getBoundingClientRect();
        return {chip, after: e.clientX > rect.left + rect.width / 2};
    }

    const chips = document.querySelectorAll("#chip-list .chip[data-index]");
    return {chip: chips[chips.length - 1], after: true};
}

function onFieldDragOver(e) {
    if (draggedFolder === null)
        return;

    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const {chip, after} = findDropTarget(e);
    clearDropMarks();
    chip?.classList.add(after ? "drop-after" : "drop-before");
}

function onFieldDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget))
        clearDropMarks();
}

function onFieldDrop(e) {
    if (draggedFolder === null)
        return;

    e.preventDefault();
    clearDropMarks();

    const {chip, after} = findDropTarget(e);
    const target = chip ? Number(chip.dataset.index) : null;

    if (target !== draggedFolder)
        moveFolder(draggedFolder, target, after);
}

async function onChipKeyDown(e) {
    if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight"))
        return;

    e.preventDefault();

    const index = Number(e.currentTarget.dataset.index);
    const neighbor = index + (e.key === "ArrowLeft" ? -1 : 1);

    if (neighbor >= 0 && neighbor < folders.length) {
        const moved = await moveFolder(index, neighbor, e.key === "ArrowRight");
        $(`#chip-list .chip[data-index="${moved}"] button`)?.focus();
    }
}

function renderMenuPreview(categories) {
    const menu = $("#menu-preview");
    menu.replaceChildren();

    const item = (text, className = "mi") => {
        const element = document.createElement("div");
        element.className = className;
        element.textContent = text;
        menu.append(element);
    };

    item(BULK_ADD_TITLE, "mi action");
    item("", "msep");

    for (const category of categories)
        if (category === MENU_SEPARATOR)
            item("", "msep");
        else
            item(category);

    if (!downloadToUserCategories()) {
        if (categories.length)
            item("", "msep");
        item(REFRESH_MENU, "mi action");
    }
    else if (!categories.length)
        item("No destinations", "mi dim");
}

function onPasswordToggleClick(e) {
    const button = e.currentTarget;
    const show = $("#password").type === "password";

    $("#password").type = show ? "text" : "password";
    button.setAttribute("aria-pressed", String(show));
    button.setAttribute("aria-label", show ? "Hide password" : "Show password");
}

function resetConnectionTest() {
    $("#test-ok").hidden = true;
    $("#test-failed").hidden = true;
}

async function onTestConnectionClick(e) {
    const button = e.currentTarget;
    const label = $("#test-connection-label");

    resetConnectionTest();
    button.disabled = true;
    label.textContent = "Testing…";

    let connected = false;
    try {
        connected = await createClient().testConnection();
    }
    catch (e) {
        console.error(e);
    }

    button.disabled = false;
    label.textContent = "Test connection";
    $(connected ? "#test-ok" : "#test-failed").hidden = false;
}
