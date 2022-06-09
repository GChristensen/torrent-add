test:
	cd addon; start web-ext run -p "${HOME}/../firefox/debug" --keep-profile-changes --browser-console

test-nightly:
	cd addon; start web-ext run -p "$(HOME)/../firefox/debug.nightly" --firefox=nightly --keep-profile-changes

sign:
	cd addon; web-ext sign -i web-ext-artifacts `cat $(HOME)/.amo/creds`

build:
	cd addon; web-ext build -i web-ext-artifacts .web-extension-id

chrome:
	cd addon; rm -f AddTorrent.zip
	cd addon; 7za a AddTorrent.zip res/* *.html *.js manifest.json
