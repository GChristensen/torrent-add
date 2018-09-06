# Add torrent

[DOWNLOAD (Firefox Add-On)](https://github.com/GChristensen/torrent-add/releases/download/v0.1.0.4/add_torrent.xpi)

![screen](screen.png?raw=true)

Allows to instantly begin download of a torrent or magnet link into a configurable set of
directories in uTorrent. Very useful, if you have uTorrent on a dedicated machine.


There are couple of setting should be configured in uTorrent:
* Advanced/Webu UI/Enable Web UI
* Directories/Put new downloads in:

You also need to provide uTorrent API url, username and password in addon settings.

WARNING!: torrent links, which require `Referer' HTTP header, will not be added due
to Firefox restrictions. 