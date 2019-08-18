# Add Torrent

This is a development page. Please visit the main site at: https://gchristensen.github.io/torrent-add/

#### About 
Allows to instantly begin download of a torrent or magnet link into a configurable set of
directories in uTorrent. Very useful, if you have uTorrent on a dedicated machine.

#### Automation

The following call will add provided URL to the specified uTorrent download direcotory:

```javascript
browser.runtime.sendMessage("torrent-add@firefox", {
     type: "ADD_TORRENT", 
     url: "http://example.com/download.torrent",
     folder: "software"
});
```