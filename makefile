test:
	cd addon; start web-ext run -p "${HOME}/../firefox/debug" --keep-profile-changes

test-nightly:
	cd addon; start web-ext run -p "$(HOME)/../firefox/debug.nightly" --firefox=nightly --keep-profile-changes

.PHONY: sign
sign:
	make firefox-mv2
	cd addon; web-ext sign -a ../build -i web-ext-artifacts .web-extension-id *.mv2* *.mv3* background_worker.js version.txt `cat $(HOME)/.amo/creds`

.PHONY: build
build:
	cd addon; python ../scripts/mkmanifest.py manifest.json.mv2 manifest.json `cat version.txt` --public
	cd addon; web-ext build -a ../build -i web-ext-artifacts .web-extension-id *.mv2* *.mv3* background_worker.js version.txt
	make firefox-mv2

.PHONY: build-chrome
build-chrome:
	make chrome-mv3
	rm -f build/AddTorrentTo.zip
	7za a build/AddTorrentTo.zip ./addon/* -xr!web-ext-artifacts -xr!.web-extension-id -xr!_metadata -xr!*.mv2* -xr!*.mv3* -xr!version.txt

.PHONY: firefox-mv2
firefox-mv2:
	cd addon; python ../scripts/mkmanifest.py manifest.json.mv2 manifest.json `cat version.txt`

.PHONY: firefox-mv3
firefox-mv3:
	cd addon; python ../scripts/mkmanifest.py manifest.json.mv3 manifest.json `cat version.txt`

.PHONY: chrome-mv3
chrome-mv3:
	cd addon; python ../scripts/mkmanifest.py manifest.json.mv3.chrome manifest.json `cat version.txt`
