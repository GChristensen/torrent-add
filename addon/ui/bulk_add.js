// Bulk Add dialog, injected into the page by background.js (classic script, no imports).
// Lists the page's links filtered by a wildcard or regexp, and sends the checked ones
// to the selected category via the BULK_* messages handled in background.js.
(() => {
    if (globalThis.__addTorrentToBulk) {
        globalThis.__addTorrentToBulk.focus();
        return;
    }

    const api = globalThis.browser ?? globalThis.chrome;

    const TARGETS = [["text", "Text"], ["url", "URL"], ["both", "Both"]];

    const PLACEHOLDER_WILDCARD = "e.g. *.torrent   or   magnet:*";
    const PLACEHOLDER_REGEX = "e.g. \\.torrent$   or   ^magnet:";
    const HINT_WILDCARD = "Wildcards: * matches any characters, ? matches one character. "
        + "The whole text or URL must match; case-insensitive.";
    const HINT_REGEX = "JavaScript regular expression, case-insensitive, matches anywhere in the text or URL.";

    const STATUS = {
        queued:      {label: "Queued",            cls: "pending"},
        downloading: {label: "Downloading…",      cls: "active"},
        downloaded:  {label: "Downloaded",        cls: "pending"},
        sending:     {label: "Sending…",          cls: "active"},
        added:       {label: "Added",             cls: "ok"},
        sent:        {label: "Sent",              cls: "ok"},
        exists:      {label: "Already in client", cls: "exists"},
        failed:      {label: "Failed",            cls: "failed"}
    };
    const FINAL = ["added", "sent", "exists", "failed"];

    const ICONS = {
        logo: `<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>`,
        close: `<path d="M6 6l12 12M18 6 6 18"/>`,
        refresh: `<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>`,
        ok: `<path d="M5 12l5 5 9-10"/>`,
        exists: `<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>`,
        failed: `<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/>`,
        active: `<path d="M12 3a9 9 0 1 0 9 9"/>`,
        pending: `<circle cx="12" cy="12" r="9"/>`
    };

    const icon = (name, size = 20) =>
        `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" `
        + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

    const STYLE = `
        :host { all: initial; }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }

        .backdrop {
            position: fixed; inset: 0;
            display: flex; align-items: center; justify-content: center;
            padding: 16px;
            background: rgba(15, 18, 24, .5);
            font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Ubuntu, Cantarell, sans-serif;
            color: #1f1f1f;
            color-scheme: light;
        }

        .dialog {
            width: 900px; max-width: 100%;
            height: 620px; max-height: 100%;
            display: flex; flex-direction: column;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, .3);
            overflow: hidden;
        }

        button { font: inherit; color: inherit; }
        button:focus-visible, input:focus-visible { outline: 2px solid #0b57d0; outline-offset: 2px; }

        .header {
            display: flex; align-items: center; gap: 12px;
            padding: 20px 24px 16px;
            border-bottom: 1px solid #e3e3e3;
        }
        .header .logo { color: #0b57d0; display: flex; }
        .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        h2 { margin: 0; font-size: 18px; font-weight: 600; }
        .subtitle { font-size: 13px; color: #444746; }

        .icon-btn {
            width: 40px; height: 40px; flex: none;
            display: inline-flex; align-items: center; justify-content: center;
            border: 0; border-radius: 20px; padding: 0;
            background: transparent; color: #444746; cursor: pointer;
        }
        .icon-btn.small { width: 32px; height: 32px; }
        .icon-btn:hover { background: #e9eef6; }

        .filter {
            display: flex; flex-direction: column; gap: 8px;
            padding: 16px 24px;
            background: #f8fafd;
            border-bottom: 1px solid #e3e3e3;
        }
        .filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .filter-row > label { font-size: 13px; font-weight: 600; color: #444746; }

        #pattern {
            flex: 1 1 240px; min-width: 0; height: 40px;
            padding: 0 12px;
            font: 14px ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace;
            color: #1f1f1f; background: #ffffff;
            border: 1px solid #c4c7c5; border-radius: 8px;
        }
        #pattern:hover { border-color: #747775; }
        #pattern:focus { outline: none; border-color: #0b57d0; box-shadow: inset 0 0 0 1px #0b57d0; }
        #pattern.invalid { border-color: #b3261e; box-shadow: inset 0 0 0 1px #b3261e; }
        #pattern::placeholder { color: #747775; }

        .seg { display: inline-flex; height: 40px; border: 1px solid #747775; border-radius: 20px; overflow: hidden; }
        .seg button {
            min-width: 60px; padding: 0 14px;
            border: 0; background: #ffffff; color: #444746;
            font-size: 13px; font-weight: 500; cursor: pointer;
        }
        .seg button + button { border-left: 1px solid #747775; }
        .seg button:hover { background: #f1f3f4; }
        .seg button[aria-pressed="true"] { background: #d3e3fd; color: #041e49; font-weight: 600; }
        .seg button:focus-visible { outline-offset: -3px; }

        .check { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; cursor: pointer; white-space: nowrap; }
        input[type=checkbox], input[type=radio] { width: 18px; height: 18px; margin: 0; flex: none; accent-color: #0b57d0; cursor: pointer; }

        .hint { font-size: 12px; color: #444746; }
        .hint.error { color: #b3261e; }

        .body { flex: 1; min-height: 0; display: flex; }

        .links { flex: 1; min-width: 0; display: flex; flex-direction: column; border-right: 1px solid #e3e3e3; }
        .pane-head {
            display: flex; align-items: center; gap: 10px;
            min-height: 48px; padding: 0 24px;
            border-bottom: 1px solid #e3e3e3;
            font-size: 13px; color: #444746;
        }
        .pane-head .check { min-height: 0; color: #1f1f1f; font-weight: 600; }
        .pane-head .grow { flex: 1; }
        .list { flex: 1; overflow-y: auto; }

        .row {
            display: flex; align-items: center; gap: 12px;
            padding: 8px 24px;
            border-bottom: 1px solid #f1f3f4;
            cursor: pointer;
        }
        .row:hover { background: #f0f4fc; }
        .row.unchecked .texts { opacity: .55; }
        .texts { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .text, .url { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .url { font: 12px/1.4 ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace; color: #5f6368; }
        .badge {
            flex: none; padding: 3px 8px; border-radius: 10px;
            font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
            background: #d3e3fd; color: #0842a0;
        }
        .badge.magnet { background: #fde7d9; color: #8a3a00; }

        .empty { padding: 48px 24px; text-align: center; color: #444746; }

        .categories { width: 260px; flex: none; display: flex; flex-direction: column; }
        .categories .pane-head { padding: 0 8px 0 20px; color: #1f1f1f; font-weight: 600; }
        .cat-list { flex: 1; overflow-y: auto; padding: 6px 0; }
        .cat {
            display: flex; align-items: center; gap: 12px;
            min-height: 40px; padding: 0 20px;
            cursor: pointer; overflow-wrap: anywhere;
        }
        .cat:hover { background: #f0f4fc; }
        .cat.selected { background: #d3e3fd; color: #041e49; font-weight: 600; }
        .cat-status { padding: 16px 20px; color: #444746; font-size: 13px; }

        .progress-head { display: flex; flex-direction: column; gap: 12px; padding: 16px 24px; border-bottom: 1px solid #e3e3e3; }
        .progress { height: 6px; border-radius: 3px; background: #e3e3e3; overflow: hidden; }
        .progress > div { height: 100%; width: 0; background: #0b57d0; transition: width .2s; }
        .results { flex: 1; overflow-y: auto; }
        .result { display: flex; align-items: center; gap: 12px; padding: 12px 24px; border-bottom: 1px solid #f1f3f4; }
        .result .texts { gap: 2px; }
        .result .detail { font-size: 12px; color: #8c1d18; }
        .result .state { flex: none; font-size: 13px; }
        .result .status-icon { flex: none; display: flex; }
        .result.ok .status-icon, .result.ok .state { color: #137333; }
        .result.exists .status-icon, .result.exists .state { color: #444746; }
        .result.failed { background: #fcf1f0; }
        .result.failed .status-icon, .result.failed .state { color: #b3261e; }
        .result.active .status-icon, .result.active .state { color: #0b57d0; }
        .result.active .status-icon svg { animation: spin 1s linear infinite; }
        .result.pending .status-icon, .result.pending .state { color: #5f6368; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .footer {
            display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
            padding: 14px 24px;
            border-top: 1px solid #e3e3e3;
        }
        .footer .note { flex: 1; min-width: 160px; font-size: 13px; color: #444746; }
        .btn {
            height: 40px; padding: 0 20px;
            border-radius: 20px; border: 1px solid #747775;
            background: #ffffff; color: #0b57d0;
            font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .btn:hover { background: #f0f4fc; }
        .btn.primary { background: #0b57d0; border-color: #0b57d0; color: #ffffff; }
        .btn.primary:hover { background: #0842a0; }
        .btn.primary:disabled { background: #e3e3e3; border-color: #e3e3e3; color: #6b6e70; cursor: default; }

        @media (max-width: 640px) {
            .body { flex-direction: column; }
            .links { border-right: 0; border-bottom: 1px solid #e3e3e3; }
            .categories { width: auto; max-height: 40%; }
        }
    `;

    const TEMPLATE = `
        <style>${STYLE}</style>
        <div class="backdrop" id="backdrop">
            <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="title">
                <div class="header">
                    <span class="logo">${icon("logo", 28)}</span>
                    <div class="titles">
                        <h2 id="title">Bulk add torrents</h2>
                        <div class="subtitle" id="subtitle"></div>
                    </div>
                    <button type="button" class="icon-btn" id="close" aria-label="Close">${icon("close")}</button>
                </div>

                <div id="select-view" class="body-wrap" style="display: contents">
                    <div class="filter">
                        <div class="filter-row">
                            <label for="pattern">Filter</label>
                            <input id="pattern" type="text" spellcheck="false" autocomplete="off">
                            <div class="seg" role="group" aria-label="Match against" id="targets"></div>
                            <label class="check"><input type="checkbox" id="regex"> Regular expression</label>
                        </div>
                        <div class="hint" id="hint" aria-live="polite"></div>
                    </div>
                    <div class="body">
                        <div class="links">
                            <div class="pane-head">
                                <label class="check"><input type="checkbox" id="select-all" aria-label="Select all matching links"> Links</label>
                                <span class="grow"></span>
                                <span id="counts"></span>
                            </div>
                            <div class="list" id="list"></div>
                        </div>
                        <div class="categories">
                            <div class="pane-head">
                                <span id="cat-label" class="grow">Category</span>
                                <button type="button" class="icon-btn small" id="refresh" aria-label="Refresh categories from client" hidden>${icon("refresh", 16)}</button>
                            </div>
                            <div class="cat-list" id="cat-list" role="radiogroup" aria-labelledby="cat-label"></div>
                        </div>
                    </div>
                </div>

                <div id="results-view" style="display: contents" hidden>
                    <div class="progress-head">
                        <div class="progress" role="progressbar" aria-label="Progress" id="progressbar"><div id="progress"></div></div>
                    </div>
                    <div class="results" id="results"></div>
                </div>

                <div class="footer">
                    <div class="note" id="note" aria-live="polite"></div>
                    <button type="button" class="btn" id="cancel">Cancel</button>
                    <button type="button" class="btn" id="retry" hidden>Retry failed</button>
                    <button type="button" class="btn primary" id="add" disabled>Add</button>
                    <button type="button" class="btn primary" id="done" hidden>Close</button>
                </div>
            </div>
        </div>
    `;

    const links = collectLinks();

    const state = {
        pattern: "",
        target: "both",
        regex: false,
        unchecked: new Set(),
        categories: null, // null while loading
        refreshable: false,
        category: null,
        matched: [],
        // results phase
        results: new Map(), // url -> {status, detail}
        running: false
    };

    const host = document.createElement("add-torrent-to-bulk");
    host.style.setProperty("all", "initial", "important");
    host.style.setProperty("position", "fixed", "important");
    host.style.setProperty("inset", "0", "important");
    host.style.setProperty("z-index", "2147483647", "important");

    const root = host.attachShadow({mode: "closed"});
    root.innerHTML = TEMPLATE;
    const $ = id => root.getElementById(id);

    const dialog = root.querySelector(".dialog");

    function collectLinks() {
        const seen = new Set();
        const result = [];

        for (const a of document.querySelectorAll("a[href]")) {
            const url = a.href;

            // SVG <a> elements have a non-string href
            if (typeof url !== "string" || !/^(https?|magnet):/i.test(url) || seen.has(url))
                continue;

            seen.add(url);

            const text = (a.textContent || "").replace(/\s+/g, " ").trim() || a.title || url;
            result.push({url, text, magnet: /^magnet:/i.test(url)});
        }

        return result;
    }

    function globToRegExp(glob) {
        const source = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
        return new RegExp("^" + source + "$", "i");
    }

    function filterLinks() {
        if (!state.pattern)
            return {matched: [], error: null};

        let re;
        try {
            re = state.regex? new RegExp(state.pattern, "i"): globToRegExp(state.pattern);
        }
        catch (e) {
            return {matched: [], error: e.message};
        }

        const matched = links.filter(link => {
            switch (state.target) {
                case "text": return re.test(link.text);
                case "url": return re.test(link.url);
                default: return re.test(link.text) || re.test(link.url);
            }
        });

        return {matched, error: null};
    }

    const checkedLinks = () => state.matched.filter(link => !state.unchecked.has(link.url));

    function renderFilter() {
        const {matched, error} = filterLinks();
        state.matched = matched;

        $("pattern").placeholder = state.regex? PLACEHOLDER_REGEX: PLACEHOLDER_WILDCARD;
        $("pattern").classList.toggle("invalid", !!error);
        $("pattern").setAttribute("aria-invalid", String(!!error));
        $("regex").checked = state.regex;

        const hint = $("hint");
        hint.classList.toggle("error", !!error);
        hint.textContent = error
            ? `Invalid regular expression: ${error}`
            : (state.regex? HINT_REGEX: HINT_WILDCARD);

        for (const button of $("targets").children)
            button.setAttribute("aria-pressed", String(button.dataset.target === state.target));

        renderList();
    }

    function renderList() {
        const list = $("list");
        const fragment = document.createDocumentFragment();

        for (const link of state.matched) {
            const checked = !state.unchecked.has(link.url);

            const row = document.createElement("label");
            row.className = "row" + (checked? "": " unchecked");

            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = checked;
            checkbox.addEventListener("change", () => {
                if (checkbox.checked)
                    state.unchecked.delete(link.url);
                else
                    state.unchecked.add(link.url);

                row.classList.toggle("unchecked", !checkbox.checked);
                renderSelection();
            });

            const texts = document.createElement("div");
            texts.className = "texts";

            const text = document.createElement("div");
            text.className = "text";
            text.textContent = link.text;

            const url = document.createElement("div");
            url.className = "url";
            url.textContent = link.url;

            const badge = document.createElement("span");
            badge.className = "badge" + (link.magnet? " magnet": "");
            badge.textContent = link.magnet? "magnet": "file";

            texts.append(text, url);
            row.append(checkbox, texts, badge);
            fragment.append(row);
        }

        if (!state.matched.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = state.pattern
                ? "No links match the filter."
                : "Enter a wildcard or regular expression to list matching links.";
            fragment.append(empty);
        }

        list.replaceChildren(fragment);
        renderSelection();
    }

    function renderSelection() {
        const checked = checkedLinks().length;
        const matched = state.matched.length;

        const selectAll = $("select-all");
        selectAll.checked = matched > 0 && checked === matched;
        selectAll.indeterminate = checked > 0 && checked < matched;
        selectAll.disabled = !matched;

        $("counts").textContent = `${matched} match · ${checked} selected`;

        $("add").disabled = !checked || state.category === null;
        $("add").textContent = checked? `Add ${checked}`: "Add";

        $("note").textContent = !state.pattern? "Enter a filter to list links."
            : !checked? "Select at least one link."
            : state.category === null? "Pick a category to add to."
            : `${checked} torrent${checked === 1? "": "s"} → ${state.category}`;
    }

    function renderCategories() {
        const list = $("cat-list");
        $("refresh").hidden = !state.refreshable;

        if (state.categories === null || !state.categories.length) {
            const status = document.createElement("div");
            status.className = "cat-status";
            status.textContent = state.categories === null? "Loading…": "No categories available.";
            list.replaceChildren(status);
            return;
        }

        if (!state.categories.includes(state.category))
            state.category = null;

        const fragment = document.createDocumentFragment();

        for (const category of state.categories) {
            const label = document.createElement("label");
            label.className = "cat" + (category === state.category? " selected": "");

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "category";
            radio.checked = category === state.category;
            radio.addEventListener("change", () => {
                state.category = category;
                renderCategories();
                root.querySelector(".cat.selected input")?.focus();
                renderSelection();
            });

            const name = document.createElement("span");
            name.textContent = category;

            label.append(radio, name);
            fragment.append(label);
        }

        list.replaceChildren(fragment);
    }

    function renderResults() {
        const results = $("results");
        const fragment = document.createDocumentFragment();
        let done = 0, added = 0, exists = 0, failed = 0;

        for (const [url, {status, detail}] of state.results) {
            const link = links.find(l => l.url === url);
            const info = STATUS[status] || STATUS.queued;

            if (FINAL.includes(status)) done++;
            if (status === "added" || status === "sent") added++;
            if (status === "exists") exists++;
            if (status === "failed") failed++;

            const row = document.createElement("div");
            row.className = "result " + info.cls;

            const statusIcon = document.createElement("span");
            statusIcon.className = "status-icon";
            statusIcon.innerHTML = icon(info.cls === "ok"? "ok": info.cls);

            const texts = document.createElement("div");
            texts.className = "texts";

            const text = document.createElement("div");
            text.className = "text";
            text.textContent = link?.text || url;
            texts.append(text);

            if (status === "failed" && detail) {
                const detailEl = document.createElement("div");
                detailEl.className = "detail";
                detailEl.textContent = detail;
                texts.append(detailEl);
            }

            const stateEl = document.createElement("div");
            stateEl.className = "state";
            stateEl.textContent = info.label;

            row.append(statusIcon, texts, stateEl);
            fragment.append(row);
        }

        results.replaceChildren(fragment);

        const total = state.results.size;
        $("progress").style.width = total? `${done / total * 100}%`: "0";
        $("progressbar").setAttribute("aria-valuemax", String(total));
        $("progressbar").setAttribute("aria-valuenow", String(done));

        if (state.running) {
            $("title").textContent = `Adding ${total} torrent${total === 1? "": "s"} to ${state.category}`;
            $("subtitle").textContent = `${done} of ${total} done`;
            $("note").textContent = "You can close this; adding continues in the background.";
        }
        else {
            $("title").textContent = `Added ${added} of ${total} to ${state.category}`;
            const details = [];
            if (exists) details.push(`${exists} already in client`);
            if (failed) details.push(`${failed} failed`);
            $("subtitle").textContent = details.length? details.join(", "): "All done";
            $("note").textContent = "";
        }

        $("retry").hidden = state.running || !failed;
    }

    async function startAdd(urls) {
        for (const url of urls)
            state.results.set(url, {status: "queued"});

        state.running = true;
        $("select-view").hidden = true;
        $("results-view").hidden = false;
        $("cancel").hidden = true;
        $("add").hidden = true;
        $("done").hidden = false;
        $("done").focus();
        renderResults();

        try {
            await api.runtime.sendMessage({
                type: "BULK_ADD",
                links: urls,
                category: state.category,
                filter: {pattern: state.pattern, target: state.target, regex: state.regex}
            });
        }
        catch (e) {
            console.error(e);

            for (const url of urls)
                if (!FINAL.includes(state.results.get(url)?.status))
                    state.results.set(url, {status: "failed", detail: "The extension did not respond."});
        }

        state.running = false;

        if (globalThis.__addTorrentToBulk)
            renderResults();
    }

    function onMessage(message) {
        if (message?.type === "BULK_PROGRESS" && state.results.has(message.url)) {
            state.results.set(message.url, {status: message.status, detail: message.detail});
            renderResults();
        }
    }

    async function loadCategories(type) {
        try {
            const response = await api.runtime.sendMessage({type});

            if (response?.error)
                throw new Error(response.error);

            return response;
        }
        catch (e) {
            console.error(e);
            return {categories: []};
        }
    }

    function focusables() {
        return [...dialog.querySelectorAll("button, input")]
            .filter(el => !el.disabled && el.getClientRects().length);
    }

    function onKeyDown(e) {
        e.stopPropagation(); // keep page shortcuts from reacting to typing in the dialog

        if (e.key === "Escape") {
            e.preventDefault();
            close();
        }
        else if (e.key === "Tab") {
            const elements = focusables();
            if (!elements.length)
                return;

            const first = elements[0];
            const last = elements[elements.length - 1];
            const active = root.activeElement;

            if (e.shiftKey && (active === first || !dialog.contains(active))) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    const stopPropagation = e => e.stopPropagation();

    function close() {
        api.runtime.onMessage.removeListener(onMessage);
        host.remove();
        delete globalThis.__addTorrentToBulk;
    }

    // wiring

    $("subtitle").textContent = `${links.length} link${links.length === 1? "": "s"} found on this page`;

    for (const [target, label] of TARGETS) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.target = target;
        button.textContent = label;
        button.addEventListener("click", () => {
            state.target = target;
            renderFilter();
        });
        $("targets").append(button);
    }

    $("pattern").addEventListener("input", e => {
        state.pattern = e.target.value;
        renderFilter();
    });

    $("regex").addEventListener("change", e => {
        state.regex = e.target.checked;
        renderFilter();
    });

    $("select-all").addEventListener("change", e => {
        for (const link of state.matched)
            if (e.target.checked)
                state.unchecked.delete(link.url);
            else
                state.unchecked.add(link.url);

        renderList();
    });

    $("refresh").addEventListener("click", async () => {
        state.categories = null;
        renderCategories();
        state.categories = (await loadCategories("BULK_REFRESH")).categories || [];
        renderCategories();
        renderSelection();
    });

    $("add").addEventListener("click", () => {
        const urls = checkedLinks().map(link => link.url);
        if (urls.length && state.category !== null)
            startAdd(urls);
    });

    $("retry").addEventListener("click", () => {
        const failed = [...state.results].filter(([, r]) => r.status === "failed").map(([url]) => url);
        if (failed.length)
            startAdd(failed);
    });

    $("close").addEventListener("click", close);
    $("cancel").addEventListener("click", close);
    $("done").addEventListener("click", close);

    $("backdrop").addEventListener("mousedown", e => {
        if (e.target === e.currentTarget)
            close();
    });

    dialog.addEventListener("keydown", onKeyDown);
    for (const type of ["keyup", "keypress", "input"])
        dialog.addEventListener(type, stopPropagation);

    api.runtime.onMessage.addListener(onMessage);

    globalThis.__addTorrentToBulk = {
        focus: () => (focusables()[0] || dialog).focus()
    };

    renderFilter();
    renderCategories();

    (document.body || document.documentElement).append(host);
    $("pattern").focus();

    loadCategories("BULK_INIT").then(({categories, refreshable, filter}) => {
        state.categories = categories || [];
        state.refreshable = !!refreshable;

        if (filter && !state.pattern) {
            state.pattern = filter.pattern || "";
            state.target = TARGETS.some(([t]) => t === filter.target)? filter.target: "both";
            state.regex = !!filter.regex;
            $("pattern").value = state.pattern;
            $("pattern").select();
            renderFilter();
        }

        renderCategories();
        renderSelection();
    });
})();
