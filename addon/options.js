function saveOptions(e) {
  if (e) {
      e.preventDefault();
      chrome.storage.local.set({
          settings: {
              folders: document.querySelector("#folders").value,
              host: document.querySelector("#host").value,
              user: document.querySelector("#user").value,
              password: document.querySelector("#password").value,
              client: document.querySelector("#client").value
          }
      })
  }
}

function restoreOptions() {
  function setCurrentChoice(result) {
    document.querySelector("#folders").value = result.settings.folders;
    document.querySelector("#host").value = result.settings.host;
    document.querySelector("#user").value = result.settings.user;
    document.querySelector("#password").value = result.settings.password;
    if (result.settings.client)
        document.querySelector("#client").value = result.settings.client;
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  chrome.storage.local.get("settings", setCurrentChoice);
}

function createMenus() {
    chrome.storage.local.get("settings", ({settings}) => {
        chrome.contextMenus.removeAll(() => {
          document.querySelector("#folders").value.split(":").forEach((folder) => {
              if (folder) {
                  chrome.contextMenus.create({
                      id: folder,
                      title: folder,
                      contexts: ["link"]
                  });
              }
          });
      });
    });
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document.getElementById("folders").addEventListener("blur", (e) => {createMenus(); saveOptions(e);});
document.getElementById("host").addEventListener("blur", saveOptions);
document.getElementById("user").addEventListener("blur", saveOptions);
document.getElementById("password").addEventListener("blur", saveOptions);
document.getElementById("client").addEventListener("blur", saveOptions);

createMenus();