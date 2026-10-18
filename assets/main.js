// linkedwallets.github.io — the chain ticks, the menu opens, the search jokes.

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

  // Mobile menu.
  var menuBtn = document.querySelector(".menu-btn");
  var menu = document.getElementById("menu");

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    document.body.classList.remove("menu-open");
    menuBtn.setAttribute("aria-expanded", "false");
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = menu.hidden;
      menu.hidden = !open;
      document.body.classList.toggle("menu-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      if (open) menu.querySelector("nav a").focus();
    });
    var closeBtn = menu.querySelector(".menu-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeMenu);
    }
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  // The explorer search: it indexes exactly one person.
  var search = document.querySelector(".search");
  if (search) {
    var input = search.querySelector("input");
    var msg = document.querySelector(".search-msg");
    var routes = {
      home: "/",
      writings: "/writings/",
      projects: "/projects/",
      x: "https://x.com/linkedwallets",
    };
    var timer = null;

    search.addEventListener("submit", function (e) {
      e.preventDefault();
      var q = (input.value || "").trim().toLowerCase();
      if (!q) return;
      if (routes[q]) {
        window.location.href = routes[q];
        return;
      }
      if (msg) {
        msg.textContent = "0 results — this explorer indexes one person";
        msg.hidden = false;
        clearTimeout(timer);
        timer = setTimeout(function () {
          msg.hidden = true;
        }, 3000);
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
      var node = nodes[k];
      var id = node.getAttribute("data-node");
      node.addEventListener("mouseenter", function () {
        setHot(this.getAttribute("data-node"));
      });
      node.addEventListener("mouseleave", function () {
        setHot(null);
      });
      node.addEventListener("focus", function () {
        setHot(this.getAttribute("data-node"));
      });
      node.addEventListener("blur", function () {
        setHot(null);
      });
    }
  }

  // 404: show which path reverted.
  var slot = document.querySelector("[data-path]");
  if (slot) {
    slot.textContent = window.location.pathname || "/";
  }
})();
