#### About 

The [Add Torrent To](https://gchristensen.github.io/torrent-add/) browser extension lets to instantly begin download of a torrent or a magnet link into a 
configurable set of directories in uTorrent or qBittorrent with enabled WebUI. 

The **Bulk Add…** context menu item lets to pick several links on a page, filtered by a wildcard or a regular
expression, and add them all to one directory at once.

#### Automation

The following call will add provided URL to the specified torrent download directory:

```javascript
// On Chrome the addon id is jlbkggamnpibjmibgcohffcncainphbj
browser.runtime.sendMessage("torrent-add-we@gchristensen.github.io", {
     type: "ADD_TORRENT", 
     url: "http://example.com/download.torrent",
     folder: "software"
});
```
