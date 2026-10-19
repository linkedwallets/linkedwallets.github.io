// linkedwallets.github.io — the chain ticks, the ⌘K explorer searches one person, the graph lights up.

(function () {
  "use strict";

  // A pretend chain: block 21,470,000 at 2026-10-01T00:00:00Z, one block per 12.1s.
  var GENESIS = Date.UTC(2026, 9, 1);
  var BASE_BLOCK = 21470000;
  var BLOCK_MS = 12100;

  function blockNow() {
    return BASE_BLOCK + Math.floor((Date.now() - GENESIS) / BLOCK_MS);
  }

  function fmt(n) {
    return n.toLocaleString("en-US");
  }

  function tickChain() {
    var block = blockNow();
    var nodes = document.querySelectorAll("[data-block]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = fmt(block);

    var confs = document.querySelectorAll("[data-conf-base]");
    for (var j = 0; j < confs.length; j++) {
      var base = parseInt(confs[j].getAttribute("data-conf-base"), 10);
      confs[j].textContent = fmt(Math.max(0, block - base));
    }
  }

  tickChain();
  setInterval(tickChain, 1000);

  // The explorer: a ⌘K palette that indexes exactly one person. It is also the menu.
  var INDEX = [
    ["Home", "/", "0x01"],
    ["Writings", "/writings/", "0x02"],
    ["A name you can verify", "/writings/a-name-you-can-verify/", "tx"],
    ["Notes on block space", "/writings/notes-on-block-space/", "tx"],
    ["Change addresses", "/writings/change-addresses/", "tx"],
    ["Projects", "/projects/", "0x03"],
    ["sparse-forest", "/projects/#sparse-forest", "ct"],
    ["mempool.weather", "/projects/#mempool-weather", "ct"],
    ["dust", "/projects/#dust", "ct"],
    ["hexwords", "/projects/#hexwords", "ct"],
    ["X ↗ @linkedwallets", "https://x.com/linkedwallets", "0x04"],
    ["source ↗", "https://github.com/linkedwallets/linkedwallets.github.io", "src"],
  ];

  var pal = document.getElementById("explorer");
  var openers = document.querySelectorAll("[data-explorer]");

  if (pal) {
    var input = pal.querySelector("input");
    var list = pal.querySelector(".pal-list");
    var lastFocus = null;
    var sel = 0;
    var hits = INDEX;

    function render() {
      var q = input.value.trim().toLowerCase();
      hits = INDEX.filter(function (it) {
        return !q || it[0].toLowerCase().indexOf(q) !== -1 || it[1].indexOf(q) !== -1;
      });
      if (sel >= hits.length) sel = 0;
      list.innerHTML = "";
      if (!hits.length) {
        var none = document.createElement("li");
        none.className = "pal-none";
        none.textContent = "0 results — this explorer indexes one person";
        list.appendChild(none);
        return;
      }
      hits.forEach(function (it, i) {
        var li = document.createElement("li");
        var a = document.createElement("a");
        a.href = it[1];
        if (it[1].indexOf("http") === 0) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        a.innerHTML = "<span></span><b></b>";
        a.firstChild.textContent = it[2];
        a.lastChild.textContent = it[0];
        if (i === sel) a.className = "sel";
        li.appendChild(a);
        list.appendChild(li);
      });
    }

    function open() {
      lastFocus = document.activeElement;
      pal.hidden = false;
      document.body.classList.add("pal-open");
      input.value = "";
      sel = 0;
      render();
      input.focus();
    }

    function close() {
      pal.hidden = true;
      document.body.classList.remove("pal-open");
      if (lastFocus) lastFocus.focus();
    }

    for (var o = 0; o < openers.length; o++) {
      openers[o].addEventListener("click", open);
    }

    input.addEventListener("input", function () {
      sel = 0;
      render();
    });

    pal.addEventListener("click", function (e) {
      if (e.target === pal || e.target.closest("a, .pal-x")) close();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        pal.hidden ? open() : close();
        return;
      }
      if (e.key === "/" && pal.hidden && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        open();
        return;
      }
      if (pal.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!hits.length) return;
        sel = (sel + (e.key === "ArrowDown" ? 1 : hits.length - 1)) % hits.length;
        render();
      }
      if (e.key === "Enter" && e.target === input && hits[sel]) {
        e.preventDefault();
        list.querySelectorAll("a")[sel].click();
      }
    });
  }

  // Graph: hovering or focusing a node lights its edges.
  var svg = document.querySelector(".graph");
  if (svg) {
    var edges = svg.querySelectorAll(".g-edge, .g-pulse");

    function setHot(id) {
      svg.classList.toggle("focused", !!id);
      for (var i = 0; i < edges.length; i++) {
        var link = edges[i].getAttribute("data-link") || "";
        edges[i].classList.toggle("hot", !!id && link.split(" ").indexOf(id) !== -1);
      }
    }

    var nodes = svg.querySelectorAll(".g-node");
    for (var k = 0; k < nodes.length; k++) {
      nodes[k].addEventListener("mouseenter", function () {
        setHot(this.getAttribute("data-node"));
      });
      nodes[k].addEventListener("mouseleave", function () {
        setHot(null);
      });
      nodes[k].addEventListener("focus", function () {
        setHot(this.getAttribute("data-node"));
      });
      nodes[k].addEventListener("blur", function () {
        setHot(null);
      });
    }
  }

  // 404: show which path reverted.
  var slots = document.querySelectorAll("[data-path]");
  for (var sp = 0; sp < slots.length; sp++) {
    slots[sp].textContent = window.location.pathname || "/";
  }
})();
