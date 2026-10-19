// linkedwallets.github.io — the chain ticks, the ⌘K explorer searches one person, the stack comes apart, the graph lights up.

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

  // Exploded view: scrolling takes the stack apart, then brings each plate into focus in turn.
  // Plate positions are worked out from the same angles and sizes the CSS uses, so a frame
  // reads scrollY and writes styles, with no layout reads.
  var xv = document.querySelector(".xv");
  if (xv) {
    var stage = xv.querySelector(".xv-stage");
    var cam = xv.querySelector(".xv-cam");
    var stack = xv.querySelector(".xv-stack");
    var plates = xv.querySelectorAll(".plate");
    var calls = xv.querySelectorAll(".call");
    var steps = xv.querySelectorAll(".step");
    var meter = xv.querySelector(".xv-now");
    var bars = xv.querySelectorAll(".xv-bar i");
    var still = window.matchMedia("(prefers-reduced-motion: reduce)");
    var NAMES = ["assembled", "shell", "transfers", "contracts", "graph", "address", "key"];
    var TILT = 58 * Math.PI / 180;
    var SPIN = -42 * Math.PI / 180;
    var CORNER_X = (Math.cos(SPIN) - Math.sin(SPIN)) / 2;
    var CORNER_Y = ((Math.cos(SPIN) + Math.sin(SPIN)) / 2) * Math.cos(TILT);
    var HALF_H = ((Math.abs(Math.cos(SPIN)) + Math.abs(Math.sin(SPIN))) / 2) * Math.cos(TILT);
    var THICK = 7;
    var m = null;
    var queued = false;

    function clamp(v) {
      return v < 0 ? 0 : v > 1 ? 1 : v;
    }

    function ease(v) {
      return v * v * (3 - 2 * v);
    }

    function measure() {
      var vh = window.innerHeight;
      var stageH = stage.offsetHeight;
      var phone = stageH < vh * 0.8;
      var widths = [];
      for (var i = 0; i < plates.length; i++) widths.push(plates[i].offsetWidth);
      var centers = [];
      for (var j = 0; j < steps.length; j++) {
        var r = steps[j].getBoundingClientRect();
        centers.push(r.top + window.scrollY + r.height / 2);
      }
      m = {
        W: stage.offsetWidth,
        H: stageH,
        ox: stack.offsetLeft,
        oy: stack.offsetTop,
        gap: widths[0] * 0.24,
        widths: widths,
        centers: centers,
        line: phone ? stageH + (vh - stageH) * 0.45 : vh * 0.5,
        camY: phone ? stageH * 0.54 : stageH * 0.5,
        zoom: phone ? 0.18 : 0.26,
        start: phone ? 0.12 : 0.3,
        callH: calls[0].offsetHeight,
      };
    }

    function position() {
      var y = window.scrollY + m.line;
      var c = m.centers;
      var pos = 0;
      if (y >= c[c.length - 1]) pos = c.length - 1;
      else {
        for (var k = 0; k < c.length - 1; k++) {
          if (y < c[k + 1]) {
            pos = k + Math.max(0, (y - c[k]) / (c[k + 1] - c[k]));
            break;
          }
        }
      }
      return pos;
    }

    function draw(pos, motion) {
      var n = plates.length;
      var raw = motion ? clamp(pos) : 1;
      var dimming = motion ? clamp((pos - 0.4) / 0.4) : 0;
      var ys = [];
      var f = [];
      var sumF = 0;
      var sumFY = 0;

      for (var j = 0; j < n; j++) {
        var e = ease(clamp((raw - j * 0.05) / (1 - (n - 1) * 0.05)));
        var focus = motion ? ease(clamp((0.6 - Math.abs(pos - (j + 1))) / 0.35)) : 0;
        var level = n - 1 - j;
        var z = level * (THICK + m.gap * e) + focus * m.gap * 0.45;
        var ink = 1 - 0.72 * dimming * (1 - focus);
        ys.push(m.oy - z * Math.sin(TILT));
        f.push(focus);
        sumF += focus;
        sumFY += focus * ys[j];
        plates[j].style.setProperty("--e", e.toFixed(4));
        plates[j].style.setProperty("--f", focus.toFixed(4));
        plates[j].style.setProperty("--o", ink.toFixed(3));
        plates[j].classList.toggle("on", focus > 0.5);
        plates[j].classList.toggle("dim", ink < 0.6);
      }
      xv.style.setProperty("--e", ease(raw).toFixed(4));

      // Camera: centre the stack, then lean in on the focused plate.
      var top = ys[0] - m.widths[0] * HALF_H;
      var bottom = ys[n - 1] + m.widths[n - 1] * HALF_H + THICK;
      var mid = (top + bottom) / 2;
      var F = Math.min(1, sumF);
      var ty = F > 0 ? mid + (sumFY / sumF - mid) * F * 0.65 : mid;
      // Assembled, the stack sits large in the middle. It moves aside to make room for the labels.
      var apart = ease(raw);
      var Z = 1 + m.start * (1 - apart) + m.zoom * F;
      var cx = m.W / 2 + (m.ox - m.W / 2) * apart;
      var dx = cx - m.ox * Z;
      var dy = m.camY - ty * Z;
      cam.style.transform = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px) scale(" + Z.toFixed(4) + ")";

      // Callouts sit outside the camera: one column of pills, a leader line to each plate corner.
      var xs = [];
      var colX = 0;
      for (var p = 0; p < n; p++) {
        xs.push(cx + m.widths[p] * CORNER_X * Z);
        colX = Math.max(colX, xs[p]);
      }
      colX += 26;
      var shown = motion ? clamp((raw - 0.55) / 0.35) : 1;
      for (var q = 0; q < calls.length; q++) {
        var py = (ys[q] + m.widths[q] * CORNER_Y) * Z + dy;
        calls[q].style.transform = "translate(" + colX.toFixed(1) + "px," + (py - m.callH / 2).toFixed(1) + "px)";
        calls[q].style.setProperty("--lead", (colX - xs[q]).toFixed(1) + "px");
        calls[q].style.opacity = shown.toFixed(3);
        calls[q].style.pointerEvents = shown > 0.5 ? "auto" : "none";
        calls[q].classList.toggle("on", f[q] > 0.5);
      }

      var at = motion ? Math.round(pos) : 0;
      for (var s = 0; s < steps.length; s++) steps[s].classList.toggle("on", s === at);
      meter.textContent = (motion ? "0" + at : "06") + " / 06 · " + (motion ? NAMES[at] : "exploded");
      for (var b = 0; b < bars.length; b++) {
        bars[b].classList.toggle("on", !motion || b < at);
        bars[b].classList.toggle("now", motion && b === at - 1);
      }
    }

    function frame() {
      queued = false;
      draw(position(), !still.matches);
    }

    function queue() {
      if (!queued) {
        queued = true;
        window.requestAnimationFrame(frame);
      }
    }

    function relayout() {
      xv.classList.toggle("live", !still.matches);
      measure();
      frame();
    }

    for (var c = 0; c < calls.length; c++) {
      calls[c].addEventListener("click", function (ev) {
        var step = document.getElementById(this.getAttribute("href").slice(1));
        var idx = Array.prototype.indexOf.call(steps, step);
        if (idx < 0) return;
        ev.preventDefault();
        window.scrollTo({ top: m.centers[idx] - m.line, behavior: still.matches ? "auto" : "smooth" });
      });
    }

    relayout();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", relayout);
    window.addEventListener("load", relayout);
    if (document.fonts) document.fonts.ready.then(relayout);
    if (still.addEventListener) still.addEventListener("change", relayout);
  }

  // 404: show which path reverted.
  var slots = document.querySelectorAll("[data-path]");
  for (var sp = 0; sp < slots.length; sp++) {
    slots[sp].textContent = window.location.pathname || "/";
  }
})();
