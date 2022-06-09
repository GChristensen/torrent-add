# Add Torrent

This is a development page. Please visit the main site at: https://gchristensen.github.io/torrent-add/

#### About 

Allows to instantly begin download of a torrent or a magnet link into a 
configurable set of directories in uTorrent or qBittorrent with enabled WebUI. 

#### Automation

The following call will add provided URL to the specified torrent download directory:

```javascript
browser.runtime.sendMessage("torrent-add-we@gchristensen.github.io", {
     type: "ADD_TORRENT", 
     url: "http://example.com/download.torrent",
     folder: "software"
});
```