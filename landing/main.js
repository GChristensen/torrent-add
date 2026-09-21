// Makes the context menu mockup interactive: hover a folder to highlight it, click to "add" the torrent.
(function () {
  "use strict";

  var ISO = "debian-13.0.0-amd64-netinst.iso";

  var submenu = document.querySelector(".submenu");
  var toast = document.querySelector(".toast");
  if (!submenu || !toast) return;

  var items = submenu.querySelectorAll(".item");
  var title = toast.querySelector("strong");
  var file = toast.querySelector("span");

  function select(item) {
    for (var i = 0; i < items.length; i++)
      items[i].classList.toggle("active", items[i] === item);
  }

  function announce(item) {
    var folder = item.textContent.trim();
    title.textContent = folder === "[root]"
      ? "Torrent added to the default folder"
      : "Torrent added to “" + folder + "”";
    file.textContent = ISO;
    toast.classList.remove("pop");
    void toast.offsetWidth; // restart the animation
    toast.classList.add("pop");
  }

  for (var i = 0; i < items.length; i++) {
    (function (item) {
      item.addEventListener("mouseenter", function () { select(item); });
      item.addEventListener("click", function () { select(item); announce(item); });
    })(items[i]);
  }

  var dl = document.querySelector(".dl");
  if (dl) dl.addEventListener("click", function (e) { e.preventDefault(); });
})();
