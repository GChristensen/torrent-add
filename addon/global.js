if (!globalThis.browser)
    globalThis.browser = chrome;

globalThis._log = console.log;