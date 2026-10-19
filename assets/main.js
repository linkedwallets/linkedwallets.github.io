// linkedwallets.github.io — the chain ticks, the ⌘K explorer searches one person, the graph lights up.
// The node on the home page lives in assets/node/scene.js.

(function () {
  "use strict";

  // A pretend chain: slot 440,000,000 at 2026-10-01T00:00:00Z, one slot per 400 ms.
  var GENESIS = Date.UTC(2026, 9, 1);
  var BASE_SLOT = 440000000;
  var SLOT_MS = 400;

  function slotNow() {
    return BASE_SLOT + Math.floor((Date.now() - GENESIS) / SLOT_MS);
  }

  function fmt(n) {
    return n.toLocaleString("en-US");
  }

  function tickChain() {
    var slot = slotNow();
    var nodes = document.querySelectorAll("[data-slot]");
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = fmt(slot);

    var confs = document.querySelectorAll("[data-conf-base]");
    for (var j = 0; j < confs.length; j++) {
      var base = parseInt(confs[j].getAttribute("data-conf-base"), 10);
      confs[j].textContent = fmt(Math.max(0, slot - base));
    }
  }

  tickChain();
  setInterval(tickChain, 400);

  // Light or dark. The head of each page sets the mode before the first paint; this switch flips
  // it and keeps the choice. Without a choice the page follows the system. The map and the node
  // listen for "themechange" on the document.
  var root = document.documentElement;
  var system = window.matchMedia("(prefers-color-scheme: dark)");
  var toggles = document.querySelectorAll("[data-theme-toggle]");

  function setTheme(t) {
    root.setAttribute("data-theme", t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t === "dark" ? "#1a1917" : "#e4e2dd";
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].setAttribute("aria-pressed", t === "dark" ? "true" : "false");
      toggles[i].querySelector("span").textContent = t === "dark" ? "Dark" : "Light";
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: t }));
  }

  function savedTheme() {
    try {
      return localStorage.getItem("theme");
    } catch (e) {
      return null;
    }
  }

  setTheme(root.getAttribute("data-theme") === "dark" ? "dark" : "light");
  for (var tg = 0; tg < toggles.length; tg++) {
    toggles[tg].addEventListener("click", function () {
      var t = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", t);
      } catch (e) {}
      setTheme(t);
    });
  }
  system.addEventListener("change", function () {
    var t = savedTheme();
    if (t !== "light" && t !== "dark") setTheme(system.matches ? "dark" : "light");
  });

  // The explorer: a ⌘K palette that indexes exactly one person. It is also the menu.
  var INDEX = [
    ["Home", "/", "01"],
    ["Writings", "/writings/", "02"],
    ["A name you can verify", "/writings/a-name-you-can-verify/", "tx"],
    ["Notes on block space", "/writings/notes-on-block-space/", "tx"],
    ["Change addresses", "/writings/change-addresses/", "tx"],
    ["Projects", "/projects/", "03"],
    ["sparse-forest", "/projects/#sparse-forest", "prg"],
    ["mempool.weather", "/projects/#mempool-weather", "prg"],
    ["dust", "/projects/#dust", "prg"],
    ["hexwords", "/projects/#hexwords", "prg"],
    ["X ↗ @linkedwallets", "https://x.com/linkedwallets", "04"],
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

  // The node (assets/node/scene.js) marks its section ready. If it never does (no WebGL, the
  // CDN is blocked, a script error), the section falls back to the parts as a plain list.
  var nv = document.querySelector(".nv");
  if (nv) {
    setTimeout(function () {
      if (!nv.classList.contains("ready")) nv.classList.add("still", "flat");
    }, 8000);
  }

  // 404: show which path failed.
  var slots = document.querySelectorAll("[data-path]");
  for (var sp = 0; sp < slots.length; sp++) {
    slots[sp].textContent = window.location.pathname || "/";
  }
})();
