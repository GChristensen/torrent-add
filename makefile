test:
	cd addon; start web-ext run -p "${HOME}/../firefox/debug" --keep-profile-changes --browser-console

sign:
	cd addon; web-ext sign -i web-ext-artifacts `cat $(HOME)/.amo/creds`

chrome:
	cd addon; rm -f AddTorrent.zip
	cd addon; 7za a AddTorrent.zip res/* *.html *.js manifest.json
