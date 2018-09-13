function saveOptions(e) {
  if (e) {
      e.preventDefault();
      browser.storage.local.set({
          settings: {
              folders: document.querySelector("#folders").value,
              host: document.querySelector("#host").value,
              user: document.querySelector("#user").value,
              password: document.querySelector("#password").value
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
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.local.get("settings");
  getting.then(setCurrentChoice, onError);
}

function removeMenus(items, callback) {
  if (items.length > 0)
      browser.contextMenus.remove(items.pop()).then(() => removeMenus(items, callback));
  else
    callback();
}

function createMenus() {
    let getting = browser.storage.local.get("settings");

    getting.then(({settings}) => {
        chrome.contextMenus.removeAll(() => {
          document.querySelector("#folders").value.split(":").forEach((folder) => {
              if (folder) {
                  browser.contextMenus.create({
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

createMenus();