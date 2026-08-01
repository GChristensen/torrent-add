test:
    cd addon; cmd //c start web-ext run -p "${FIREFOX_PROFILES}/debug" --keep-profile-changes

test-nightly:
    cd addon; cmd //c start web-ext run -p "${FIREFOX_PROFILES}/debug.nightly" --firefox=nightly --keep-profile-changes

set-version version:
    echo {{version}} > ./addon/version.txt

get-version:
    @cat ./addon/version.txt

sign: firefox-mv2
    cd addon && web-ext sign --channel unlisted -a ../build -i web-ext-artifacts .web-extension-id *.mv2* *.mv3* background_worker.js version.txt `cat $HOME/.amo/creds`

build:
    cd addon && python ../scripts/mkmanifest.py manifest.json.mv2 manifest.json `cat version.txt` --public
    cd addon && web-ext build -a ../build -i web-ext-artifacts .web-extension-id *.mv2* *.mv3* background_worker.js version.txt
    just firefox-mv2

build-chrome: chrome-mv3
    rm -f build/AddTorrentTo.zip
    7za a build/AddTorrentTo-`cat ./addon/version.txt`-chrome.zip ./addon/* -xr!web-ext-artifacts -xr!.web-extension-id -xr!_metadata -xr!*.mv2* -xr!*.mv3* -xr!version.txt

firefox-mv2:
    cd addon && python ../scripts/mkmanifest.py manifest.json.mv2 manifest.json `cat version.txt`

firefox-mv3:
    cd addon && python ../scripts/mkmanifest.py manifest.json.mv3 manifest.json `cat version.txt`

chrome-mv3:
    cd addon && python ../scripts/mkmanifest.py manifest.json.mv3.chrome manifest.json `cat version.txt`
