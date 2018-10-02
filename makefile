test:
	start web-ext run -p "%APPDATA%/Mozilla/Firefox/Profiles/debug" --keep-profile-changes --browser-console

sign:
	web-ext sign -i web-ext-artifacts marketing screen.png *.md *.iml updates.json `cat $(HOME)/.amo/creds`

chrome:
	rm -f AddTorrent.zip
	7za a AddTorrent.zip res/* *.html *.js manifest.json
