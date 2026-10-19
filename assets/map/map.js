// The map behind the node: a flat world in fine dots, the network's nodes, and the transfer graph
// drawn on it. On its own it draws a still map. scene.js zooms it: frame(x, y, s) puts the site's
// node at screen point (x, y) and scales the map s times around it, in step with the 3D camera.
// No three.js here, so the map and the graph still show when the node cannot load.

// land.png: a 1-bit land mask, equirectangular, 6 cells per degree, 84°N to 58°S. Column i is
// longitude -180 + (i + 0.5) / 6, row j is latitude 84 - (j + 0.5) / 6. Made once from
// world-atlas land-50m (Natural Earth), see LICENSE-world-atlas-ISC.txt.
const CELLS = 6;
const TOP = 84;
const BOTTOM = -58;
const MID = (TOP + BOTTOM) / 2;
const COLS = 360 * CELLS;
const ROWS = (TOP - BOTTOM) * CELLS;

// Three grids of dots, each three times finer than the one before (1.5°, 0.5°, 1/6°) and on the
// same points, so a finer grid fills in between the dots already shown as the map grows.
const GRIDS = [9, 3, 1];

// The other nodes of the network: decorative points around data-centre regions where many
// validators run. [longitude, latitude, how many]
const REGIONS = [
  [8.7, 50.1, 9], [4.9, 52.4, 7], [-0.1, 51.5, 6], [2.4, 48.9, 4], [-6.3, 53.3, 3], [21, 52.2, 3],
  [18.1, 59.3, 2], [24.9, 60.2, 3], [25.3, 54.7, 2], [8.5, 47.4, 2], [9.2, 45.5, 2], [-3.7, 40.4, 2],
  [26.1, 44.4, 1], [16.4, 48.2, 1], [14.4, 50.1, 1], [11.1, 49.5, 2], [12.4, 50.5, 1],
  [-77.5, 39, 6], [-74, 40.7, 5], [-87.6, 41.9, 4], [-96.8, 32.8, 3], [-118.2, 34.1, 3],
  [-122.3, 47.6, 2], [-121.9, 37.3, 2], [-111.9, 40.8, 2], [-80, 40.4, 2], [-80.2, 25.8, 2],
  [-84.4, 33.7, 1], [-79.4, 43.7, 2], [-73.6, 45.5, 2], [-105, 39.7, 1],
  [139.7, 35.7, 5], [135.5, 34.7, 1], [103.8, 1.4, 4], [114.2, 22.3, 2], [127, 37.6, 2],
  [72.9, 19.1, 1], [121.6, 25, 1], [-46.6, -23.6, 2], [151.2, -33.9, 1], [28, -26.2, 1], [55.3, 25.2, 1],
];

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const NODES = (() => {
  const r = seeded(11);
  const out = [];
  REGIONS.forEach(([lon, lat, n]) => {
    for (let i = 0; i < n; i++) {
      const spread = 0.15 + r() * (n > 3 ? 0.9 : 0.5);
      const a = r() * Math.PI * 2;
      out.push([lon + Math.cos(a) * spread * 1.4, lat + Math.sin(a) * spread]);
    }
  });
  return out;
})();

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const ramp = (v, a, b) => clamp((v - a) / (b - a));

const fig = document.querySelector(".nv-map");
const box = fig && fig.parentElement;
const canvas = fig && fig.querySelector(".nv-dots");
const svg = fig && fig.querySelector(".graph");

let land = null;
let W = 1;
let H = 1;
let tall = false;
let k = 1; // pixels per degree at scale 1
let lon0 = 0; // the longitude at the map's left edge
let ox = 0;
let cy = 0;
let home = { x: 0, y: 0 };
let view = null; // the last frame scene.js asked for, or null for the still map
let fog = null; // the intro's box, where the dots step back behind the text

const at = {}; // each graph node: its group, longitude and latitude
const edges = [];
const amounts = [];
const labels = []; // each peer's name, with where the markup puts it

if (svg) {
  svg.querySelectorAll(".g-node[data-at]").forEach((g) => {
    const [lon, lat] = g.getAttribute("data-at").split(" ").map(Number);
    at[g.getAttribute("data-node")] = { g, lon, lat, x: 0, y: 0 };
  });
  svg.querySelectorAll(".g-peers text:not(.n)").forEach((t) => {
    labels.push({ t, x: t.getAttribute("x") || "0", y: t.getAttribute("y") || "0", anchor: t.getAttribute("text-anchor") || "start" });
  });
  svg.querySelectorAll("path[data-link]").forEach((p) => edges.push({ p, ends: p.getAttribute("data-link").split(" ") }));
  svg.querySelectorAll("text[data-on]").forEach((t) => amounts.push({ t, on: t.getAttribute("data-on") }));
}

// Base projection, at scale 1, in pixels of the map's box.
const bx = (lon) => ox + (((lon - lon0) % 360) + 360) % 360 * k;
const by = (lat) => cy - (lat - MID) * k;

function layout() {
  const still = box.closest(".nv").classList.contains("still");
  W = fig.clientWidth || 1;
  H = fig.clientHeight || 1;
  tall = still ? W < 700 : W / H < 0.8;
  if (tall) {
    // A phone: the part of the world from the east of North America to Japan, under the intro.
    k = W / 230;
    lon0 = -84;
    ox = 0;
    cy = still ? H / 2 : H * 0.62;
  } else {
    // The whole world, cut in the Pacific so the ocean sits under the intro on the left.
    k = Math.min(W / 360, (H * 0.86) / (TOP - BOTTOM));
    lon0 = 155;
    ox = (W - 360 * k) / 2;
    cy = H / 2;
  }
  const c = at.c;
  home = c ? { x: bx(c.lon), y: by(c.lat) } : { x: W / 2, y: H / 2 };
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  const intro = !still && box.querySelector(".nv-intro");
  fog = null;
  if (intro) {
    const a = intro.getBoundingClientRect();
    const b = fig.getBoundingClientRect();
    if (tall) {
      // The map sits in the room between the intro and the caption.
      cy = clamp((a.bottom - b.top + H - 110) / 2, H * 0.45, H * 0.7);
      home.y = by(at.c ? at.c.lat : MID);
    } else {
      fog = { x0: a.left - b.left, y0: a.top - b.top, x1: a.right - b.left, y1: a.bottom - b.top };
    }
  }
  fitLabels();
}

// A peer's name that would run off the side of the map goes under its node instead.
function fitLabels() {
  labels.forEach((l) => {
    l.t.setAttribute("x", l.x);
    l.t.setAttribute("y", l.y);
    l.t.setAttribute("text-anchor", l.anchor);
  });
  place(home.x, home.y, 1);
  labels.forEach((l) => {
    const w = l.t.getComputedTextLength();
    const x = at[l.t.parentNode.getAttribute("data-node")].x + Number(l.x);
    const left = l.anchor === "end" ? x - w : l.anchor === "middle" ? x - w / 2 : x;
    if (left < 4 || left + w > W - 4) {
      l.t.setAttribute("x", "0");
      l.t.setAttribute("y", "22");
      l.t.setAttribute("text-anchor", "middle");
    }
  });
}

function paint(px, py, s, alpha, fogged) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, W, H);
  if (alpha <= 0) return;
  const ks = k * s;
  // Screen x of an unwrapped longitude (lon0 <= lon < lon0 + 360), and screen y of a latitude.
  const sx = (lon) => px + (ox + (lon - lon0) * k - home.x) * s;
  const sy = (lat) => py + (by(lat) - home.y) * s;
  // The part of the map on screen, in unwrapped longitude and in latitude.
  const lonA = lon0 + Math.max(0, (-px / s + home.x - ox) / k);
  const lonB = lon0 + Math.min(360, ((W - px) / s + home.x - ox) / k);
  const latA = Math.min(TOP, MID + (cy - (-py / s + home.y)) / k);
  const latB = Math.max(BOTTOM, MID + (cy - ((H - py) / s + home.y)) / k);
  const r = tall ? 0.5 : 0.7;
  g.fillStyle = "#7d86d6";
  if (land && lonB > lonA && latA > latB) {
    GRIDS.forEach((step, n) => {
      const gap = (step / CELLS) * ks;
      const level = n === 0 ? 1 : ramp(gap, 4.2, 7);
      if (level <= 0) return;
      g.globalAlpha = alpha * level * 0.62;
      const c = (step - 1) / 2;
      const coarser = n > 0 ? GRIDS[n - 1] : 0;
      const i0 = Math.ceil(((lonA + 180) * CELLS - 0.5 - c) / step) * step + c;
      const j0 = Math.max(c, Math.ceil(((TOP - latA) * CELLS - 0.5 - c) / step) * step + c);
      const j1 = Math.min(ROWS - 1, (TOP - latB) * CELLS);
      for (let i = i0; (i + 0.5) / CELLS - 180 <= lonB; i += step) {
        const col = ((i % COLS) + COLS) % COLS;
        const x = sx((i + 0.5) / CELLS - 180);
        const skipCol = coarser && (col - (coarser - 1) / 2) % coarser === 0;
        for (let j = j0; j <= j1; j += step) {
          if (!land[j * COLS + col]) continue;
          if (skipCol && (j - (coarser - 1) / 2) % coarser === 0) continue;
          g.fillRect(x - r, sy(TOP - (j + 0.5) / CELLS) - r, r * 2, r * 2);
        }
      }
    });
  }
  // The other nodes of the network.
  g.globalAlpha = alpha * 0.55;
  g.fillStyle = "#141413";
  NODES.forEach(([lon, lat]) => {
    const x = px + (bx(lon) - home.x) * s;
    const y = sy(lat);
    if (x > -4 && x < W + 4 && y > -4 && y < H + 4) g.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
  });
  // Behind the intro the dots step back (a soft oval wipes most of them), so the text stays easy
  // to read.
  if (fog && fogged > 0) {
    const rx = (fog.x1 - fog.x0) * 0.62 + 30;
    const ry = (fog.y1 - fog.y0) * 0.62 + 30;
    g.save();
    g.translate((fog.x0 + fog.x1) / 2, (fog.y0 + fog.y1) / 2);
    g.scale(rx / ry, 1);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, ry);
    grad.addColorStop(0, "rgba(0,0,0," + (0.8 * fogged).toFixed(3) + ")");
    grad.addColorStop(0.7, "rgba(0,0,0," + (0.6 * fogged).toFixed(3) + ")");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 1;
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = grad;
    g.fillRect(-ry, -ry, ry * 2, ry * 2);
    g.restore();
  }
  g.globalAlpha = 1;
}

// A transfer arc: a quadratic curve that bows up, away from the straight line.
function arc(a, b, bow) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = dy / len;
  let ny = -dx / len;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const cx = (a.x + b.x) / 2 + nx * len * bow;
  const cyy = (a.y + b.y) / 2 + ny * len * bow;
  return { cx, cy: cyy };
}

function place(px, py, s) {
  Object.keys(at).forEach((id) => {
    const n = at[id];
    n.x = px + (bx(n.lon) - home.x) * s;
    n.y = py + (by(n.lat) - home.y) * s;
    n.g.style.translate = n.x.toFixed(1) + "px " + n.y.toFixed(1) + "px";
  });
  const curves = {};
  edges.forEach(({ p, ends }) => {
    const a = at[ends[0]];
    const b = at[ends[1]];
    const key = ends.join(" ");
    if (!curves[key]) curves[key] = arc(a, b, 0.16);
    const c = curves[key];
    p.setAttribute("d", "M" + a.x.toFixed(1) + " " + a.y.toFixed(1) + "Q" + c.cx.toFixed(1) + " " + c.cy.toFixed(1) + " " + b.x.toFixed(1) + " " + b.y.toFixed(1));
  });
  amounts.forEach(({ t, on }) => {
    const ends = on.split(" ");
    const a = at[ends[0]];
    const b = at[ends[1]];
    const c = curves[on] || arc(a, b, 0.16);
    // A point a little past the middle of the curve, away from the site's own labels.
    const u = 0.62;
    const x = (1 - u) * (1 - u) * a.x + 2 * u * (1 - u) * c.cx + u * u * b.x;
    const y = (1 - u) * (1 - u) * a.y + 2 * u * (1 - u) * c.cy + u * u * b.y;
    t.setAttribute("x", (x + 6).toFixed(1));
    t.setAttribute("y", (y - 6).toFixed(1));
  });
}

const parts = svg ? {
  words: svg,
  lines: svg.querySelector(".g-edges"),
  peers: svg.querySelector(".g-peers"),
  mark: svg.querySelector(".g-mark"),
  caption: fig.querySelector("figcaption"),
} : {};

function draw() {
  if (!fig) return;
  const [px, py, s, intro, mark] = view || [home.x, home.y, 1, 1, 1];
  const dots = 1 - ramp(Math.log(s), Math.log(5), Math.log(26));
  paint(px, py, s, dots, intro);
  canvas.style.visibility = dots > 0 ? "" : "hidden";
  const net = 1 - ramp(s, 1.5, 4.5);
  svg.style.visibility = net > 0 || mark > 0 ? "" : "hidden";
  if (net <= 0 && mark <= 0) return;
  place(px, py, s);
  const words = (1 - ramp(s, 1.03, 1.6)).toFixed(3);
  svg.style.setProperty("--words", words);
  parts.caption.style.opacity = words;
  parts.lines.style.opacity = net.toFixed(3);
  parts.peers.style.opacity = net.toFixed(3);
  parts.mark.style.opacity = mark.toFixed(3);
}

export const map = {
  // The site's node on the screen at scale 1.
  get home() {
    return home;
  },
  layout() {
    if (fig) layout();
  },
  // One frame of the zoom: the site's node at (x, y), the map s times its size, how much of the
  // intro is still on screen (the dots step back behind it), and how much of the orange mark.
  // With no arguments: the still map.
  frame(x, y, s, intro, mark) {
    view = x === undefined ? null : [x, y, s, intro, mark];
    draw();
  },
};

if (fig) {
  new ResizeObserver(() => {
    layout();
    draw();
  }).observe(fig);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = COLS;
    c.height = ROWS;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, COLS, ROWS).data;
    land = new Uint8Array(COLS * ROWS);
    for (let i = 0; i < land.length; i++) land[i] = px[i * 4] > 127 ? 1 : 0;
    draw();
  };
  img.src = new URL("land.png", import.meta.url).href;
}
