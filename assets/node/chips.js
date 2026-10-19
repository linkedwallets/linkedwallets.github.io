// The node's three focus chips, built in the board frame: the CPU, the M.2 SSD and the key
// module. Units are cm and components point to +Z. Markings use only the strings in the brief.

import { THREE, palette, rbox, box, cylZ, mesh, many, decal, rng, MONO, ORANGE } from "./kit.js";

const ETCH = "rgba(46,47,50,0.92)"; // laser etch on nickel
const LASER = "rgba(150,153,158,0.8)"; // laser etch on black epoxy
const SILK = "#e8e5dc"; // white silkscreen
const PRINT = "#dcd9d0"; // print on the graphite label
const COPPER = "#c39a52"; // bare plated copper (test pads, fiducials)

// ---------- helpers ----------

// The returned group stays at the origin so the page can move it. The inner group holds the offset.
function placed(name, x, y) {
  const root = new THREE.Group();
  root.name = name;
  const g = new THREE.Group();
  g.position.set(x, y, 0);
  root.add(g);
  return [root, g];
}

// A flat slab from a 2D outline: bottom face at z = 0, top face at z = depth.
function slab(shape, depth, curve = 8) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: curve });
}

// A copy of a material that draws over the face it lies on (lands, pads, fingers).
function onFace(mat) {
  const m = mat.clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
  return m;
}

// A decal whose clear pixels write no depth, so thin parts under it (fingers, pads) still show.
function ink(wcm, hcm, draw, pxPerCm) {
  const d = decal(wcm, hcm, draw, pxPerCm);
  d.material.alphaTest = 0.04;
  return d;
}

function write(c, text, x, y, px, color, align = "left") {
  c.font = Math.round(px) + "px " + MONO;
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = "alphabetic";
  c.fillText(text, x, y);
}

// A 2D matrix code: solid finder edges left and bottom, clock marks top and right.
function matrixCode(c, x, y, size, n, seed, color) {
  const r = rng(seed);
  const cell = size / n;
  c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const finder = j === 0 || i === n - 1;
      const clock = (i === 0 && j % 2 === 0) || (j === n - 1 && i % 2 === 0);
      const data = i > 0 && j < n - 1 && r() < 0.47;
      if (finder || clock || data) c.fillRect(x + j * cell, y + i * cell, cell + 0.4, cell + 0.4);
    }
  }
}

function barcode(c, x, y, w, h, seed, color) {
  const r = rng(seed);
  const unit = w / 170;
  c.fillStyle = color;
  let at = x;
  for (;;) {
    const bar = unit * (1 + Math.floor(r() * 3));
    if (at + bar > x + w) break;
    c.fillRect(at, y, bar, h);
    at += bar + unit * (1 + Math.floor(r() * 3));
  }
}

function dot(c, x, y, r, color) {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

// Two-terminal SMD parts (capacitors, resistors): one instanced body and one instanced set of
// metal ends. at: [[x, y, rotZ], ...] on a face at height z. dir -1 hangs them under the face.
function passives(at, z, [l, w, h], bodyMat, endMat, dir = 1) {
  const body = many(box(l * 0.64, w * 0.98, h * 0.98), bodyMat, at.map(([x, y, a = 0]) => [x, y, z + dir * h * 0.49, a]));
  const ends = [];
  at.forEach(([x, y, a = 0]) => {
    const dx = Math.cos(a) * l * 0.41;
    const dy = Math.sin(a) * l * 0.41;
    ends.push([x + dx, y + dy, z + dir * h / 2, a], [x - dx, y - dy, z + dir * h / 2, a]);
  });
  const end = many(box(l * 0.18, w, h), endMat, ends);
  body.userData.edges = false;
  end.userData.edges = false;
  return [body, end];
}

// The outline of the heat spreader's flange: a rounded rectangle with a stepped notch in each
// long side, where the socket's load plate presses.
function flangeShape(w, h, r, cut, len) {
  const x = w / 2;
  const y = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.quadraticCurveTo(x, -y, x, -y + r);
  s.lineTo(x, -len / 2 - cut);
  s.lineTo(x - cut, -len / 2);
  s.lineTo(x - cut, len / 2);
  s.lineTo(x, len / 2 + cut);
  s.lineTo(x, y - r);
  s.quadraticCurveTo(x, y, x - r, y);
  s.lineTo(-x + r, y);
  s.quadraticCurveTo(-x, y, -x, y - r);
  s.lineTo(-x, len / 2 + cut);
  s.lineTo(-x + cut, len / 2);
  s.lineTo(-x + cut, -len / 2);
  s.lineTo(-x, -len / 2 - cut);
  s.lineTo(-x, -y + r);
  s.quadraticCurveTo(-x, -y, -x + r, -y);
  return s;
}

// ---------- the CPU ----------

// The processor in its package, centre (0.5, 2.5): substrate Z [0.30, 0.42], spreader top Z 0.75.
export function buildCpu() {
  const M = palette();
  const [root, g] = placed("cpu", 0.5, 2.5);
  const Z0 = 0.3;
  const Z1 = 0.42;
  const TOP = 0.75;
  const H = 2.25;

  // The substrate: dark green-brown laminate, with a key notch in each side edge.
  const laminate = M.pcb.clone();
  laminate.color.set(0x2b2f1d);
  laminate.roughness = 0.62;
  laminate.metalness = 0.04;
  const cr = 0.05;
  const notchY = 1.05;
  const notchR = 0.1;
  const s = new THREE.Shape();
  s.moveTo(-H + cr, -H);
  s.lineTo(H - cr, -H);
  s.quadraticCurveTo(H, -H, H, -H + cr);
  s.absarc(H, notchY, notchR, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(H, H - cr);
  s.quadraticCurveTo(H, H, H - cr, H);
  s.lineTo(-H + cr, H);
  s.quadraticCurveTo(-H, H, -H, H - cr);
  s.absarc(-H, notchY, notchR, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(-H, -H + cr);
  s.quadraticCurveTo(-H, -H, -H + cr, -H);
  g.add(mesh(slab(s, Z1 - Z0), laminate, 0, 0, Z0));

  const top = ink(4.5, 4.5, (c, w) => {
    const k = w / 4.5;
    const X = (x) => (x + H) * k;
    const Y = (y) => (H - y) * k;
    c.strokeStyle = "rgba(205,214,170,0.12)";
    c.lineWidth = 2;
    c.strokeRect(0.04 * k, 0.04 * k, 4.42 * k, 4.42 * k);
    [[-2.05, 2.05], [2.05, 2.05], [2.05, -2.05]].forEach(([x, y]) => {
      dot(c, X(x), Y(y), 0.035 * k, COPPER);
      c.strokeStyle = "rgba(195,154,82,0.45)";
      c.beginPath();
      c.arc(X(x), Y(y), 0.07 * k, 0, Math.PI * 2);
      c.stroke();
    });
    matrixCode(c, X(1.78), Y(-1.86), 0.28 * k, 14, 31, "rgba(222,218,200,0.85)");
  }, 200);
  top.position.set(0, 0, Z1);
  g.add(top);

  // The gold pin-1 triangle in one corner.
  const tri = new THREE.Shape();
  tri.moveTo(-H + 0.1, -H + 0.1);
  tri.lineTo(-H + 0.46, -H + 0.1);
  tri.lineTo(-H + 0.1, -H + 0.46);
  tri.lineTo(-H + 0.1, -H + 0.1);
  g.add(mesh(slab(tri, 0.004), M.gold, 0, 0, Z1));

  // Capacitors on the substrate, in groups round the spreader.
  const caps = [];
  [-0.95, 0.95].forEach((at) => {
    for (let i = 0; i < 6; i++) {
      const t = at + (i - 2.5) * 0.11;
      caps.push([t, -2.03, Math.PI / 2], [t, 2.03, Math.PI / 2], [-1.98, t, 0], [1.98, t, 0]);
    }
  });
  passives(caps, Z1, [0.1, 0.05, 0.05], M.ceramic, M.nickel).forEach((m) => g.add(m));

  // The integrated heat spreader: a sealant bead, a stepped flange, then the raised top.
  const bead = mesh(slab(flangeShape(3.36, 3.56, 0.22, 0.16, 1.3), 0.012), M.black, 0, 0, Z1);
  bead.userData.edges = false;
  g.add(bead);
  const flangeTop = Z1 + 0.012 + 0.1;
  const nickel = M.nickel.clone();
  nickel.roughnessMap = M.nickel.roughnessMap.clone();
  nickel.roughnessMap.repeat.set(0.45, 0.45); // a finer brush at this size
  g.add(mesh(slab(flangeShape(3.4, 3.6, 0.24, 0.16, 1.3), 0.1), nickel, 0, 0, Z1 + 0.012));
  g.add(mesh(rbox(2.92, 3.12, TOP - flangeTop, 0.2, 0.045), nickel, 0, 0, (TOP + flangeTop) / 2));

  const etch = ink(2.66, 2.86, (c, w, h) => {
    const k = w / 2.66;
    write(c, "LW-CPU", 0.2 * k, 0.62 * k, 0.36 * k, ETCH);
    write(c, "programs · 3", 0.2 * k, 0.98 * k, 0.19 * k, ETCH);
    write(c, "9xrQ…YAtY", 0.2 * k, 1.27 * k, 0.19 * k, ETCH);
    c.fillStyle = ETCH;
    c.fillRect(0.2 * k, 1.43 * k, 1.3 * k, 0.012 * k);
    matrixCode(c, 1.86 * k, 2.06 * k, 0.6 * k, 16, 5, ETCH);
    c.beginPath();
    c.moveTo(0.16 * k, h - 0.16 * k);
    c.lineTo(0.44 * k, h - 0.16 * k);
    c.lineTo(0.16 * k, h - 0.44 * k);
    c.closePath();
    c.fill();
  }, 230);
  etch.position.set(0, 0, TOP);
  g.add(etch);

  // The land side: a staggered grid of gold lands, a field of capacitor pads in the middle.
  const gold = onFace(M.gold);
  const lands = [];
  for (let row = 0; ; row++) {
    const y = -2.08 + row * 0.0866;
    if (y > 2.09) break;
    for (let x = -2.08 + (row % 2) * 0.05; x <= 2.09; x += 0.1) {
      if (Math.abs(x) < 0.62 && Math.abs(y) < 0.62) continue;
      if (x + y < -3.75) continue;
      lands.push([x, y, Z0]);
    }
  }
  const land = many(new THREE.CircleGeometry(0.028, 8).rotateX(Math.PI), gold, lands);
  land.userData.edges = false;
  g.add(land);
  const pads = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const x = -0.5 + i * 0.2;
      const y = -0.5 + j * 0.2;
      pads.push([x - 0.04, y, Z0], [x + 0.04, y, Z0]);
    }
  }
  const pad = many(new THREE.PlaneGeometry(0.035, 0.05).rotateX(Math.PI), gold, pads);
  pad.userData.edges = false;
  g.add(pad);
  const under = ink(4.5, 4.5, (c, w) => {
    const k = w / 4.5;
    c.strokeStyle = SILK;
    c.lineWidth = 0.012 * k;
    c.strokeRect(1.6 * k, 1.6 * k, 1.3 * k, 1.3 * k);
    c.fillStyle = SILK;
    c.beginPath();
    c.moveTo(0.12 * k, 0.12 * k);
    c.lineTo(0.4 * k, 0.12 * k);
    c.lineTo(0.12 * k, 0.4 * k);
    c.closePath();
    c.fill();
  }, 200);
  under.rotation.x = Math.PI;
  under.position.set(0, 0, Z0);
  g.add(under);

  return root;
}

// ---------- the SSD ----------

// An M.2 2280 drive: PCB X [-2.0, 6.0], centre Y -2.6, PCB bottom at Z 0.45, edge fingers at X 6.0.
export function buildSsd() {
  const M = palette();
  const [root, g] = placed("ssd", 2.0, -2.6);
  const hx = 4.0;
  const hy = 1.1;
  const Z0 = 0.45;
  const Z1 = 0.6;
  const keyY = 0.6125; // the M key, between pins 58 and 67
  const keyW = 0.115;
  const keyD = 0.3;
  const screwR = 0.175;
  const ch = 0.06;
  const cr = 0.06;

  const s = new THREE.Shape();
  s.moveTo(-hx + cr, -hy);
  s.lineTo(hx - ch, -hy);
  s.lineTo(hx, -hy + ch);
  s.lineTo(hx, keyY - keyW / 2);
  s.lineTo(hx - keyD + keyW / 2, keyY - keyW / 2);
  s.absarc(hx - keyD + keyW / 2, keyY, keyW / 2, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(hx, keyY + keyW / 2);
  s.lineTo(hx, hy - ch);
  s.lineTo(hx - ch, hy);
  s.lineTo(-hx + cr, hy);
  s.quadraticCurveTo(-hx, hy, -hx, hy - cr);
  s.absarc(-hx, 0, screwR, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(-hx, -hy + cr);
  s.quadraticCurveTo(-hx, -hy, -hx + cr, -hy);
  g.add(mesh(slab(s, Z1 - Z0), M.pcbBlack, 0, 0, Z0));

  const board = ink(2 * hx, 2 * hy, (c, w) => {
    const k = w / (2 * hx);
    const X = (x) => (x + hx) * k;
    const Y = (y) => (hy - y) * k;
    const r = rng(11);
    c.strokeStyle = "rgba(255,255,255,0.07)";
    c.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const y0 = -0.5 + i * 0.04;
      const y1 = -0.9 + i * 0.072;
      c.beginPath();
      c.moveTo(X(3.0), Y(y0));
      c.lineTo(X(3.18), Y(y0));
      c.lineTo(X(3.5), Y(y1));
      c.lineTo(X(3.74), Y(y1));
      c.stroke();
    }
    for (let i = 0; i < 80; i++) {
      const x = r() < 0.5 ? 1.25 + r() * 0.55 : -3.95 + r() * 0.38;
      const y = (r() - 0.5) * 1.95;
      if (x < -3.55 && Math.abs(y) < 0.36) continue;
      dot(c, X(x), Y(y), 0.013 * k, "rgba(165,165,160,0.55)");
    }
    c.strokeStyle = SILK;
    c.lineWidth = 0.012 * k;
    const m = 0.14;
    [[1.79, -0.63, 1, 1], [3.05, -0.63, -1, 1], [1.79, 0.63, 1, -1], [3.05, 0.63, -1, -1]].forEach(([x, y, dx, dy]) => {
      c.beginPath();
      c.moveTo(X(x + dx * m), Y(y));
      c.lineTo(X(x), Y(y));
      c.lineTo(X(x), Y(y + dy * m));
      c.stroke();
    });
    dot(c, X(1.72), Y(0.7), 0.028 * k, SILK);
    c.strokeRect(X(3.1), Y(0.68), 0.4 * k, 0.4 * k);
    [[-3.82, 0.98], [-3.66, 0.98], [-3.82, -0.98]].forEach(([x, y]) => dot(c, X(x), Y(y), 0.035 * k, COPPER));
  }, 200);
  board.position.set(0, 0, Z1);
  g.add(board);

  // Gold edge fingers: odd pins on top, even pins below, none in the M key.
  const top = [];
  const bottom = [];
  for (let p = 1; p <= 75; p++) {
    if (p >= 59 && p <= 66) continue;
    const y = -0.925 + (p - 1) * 0.025;
    if (p % 2) top.push([hx - 0.145, y, Z1 + 0.002]);
    else bottom.push([hx - 0.145, y, Z0]);
  }
  g.add(many(box(0.26, 0.032, 0.004), M.gold, top));
  const under = many(new THREE.PlaneGeometry(0.26, 0.032).rotateX(Math.PI), onFace(M.gold), bottom);
  under.userData.edges = false;
  g.add(under);

  // The plated half-ring round the screw notch, both faces.
  const gold = onFace(M.gold);
  const ring = new THREE.RingGeometry(screwR, screwR + 0.11, 16, 1, -Math.PI / 2, Math.PI);
  const ringTop = mesh(ring, gold, -hx, 0, Z1);
  const ringBottom = mesh(ring.clone().rotateX(Math.PI), gold, -hx, 0, Z0);
  ringTop.userData.edges = false;
  ringBottom.userData.edges = false;
  g.add(ringTop, ringBottom);

  // Two NAND packages, the DRAM and the controller.
  g.add(mesh(rbox(1.62, 1.75, 0.12, 0.03, 0.014), M.chip, -2.6, 0, Z1 + 0.06));
  g.add(mesh(rbox(1.62, 1.75, 0.12, 0.03, 0.014), M.chip, -0.8, 0, Z1 + 0.06));
  g.add(mesh(rbox(0.9, 1.2, 0.11, 0.025, 0.012), M.chip, 0.72, 0.05, Z1 + 0.055));
  g.add(mesh(rbox(1.15, 1.15, 0.11, 0.03, 0.014), M.chip, 2.42, 0, Z1 + 0.055));
  const mark = ink(1.0, 1.0, (c, w) => {
    const k = w;
    c.strokeStyle = LASER;
    c.lineWidth = 0.014 * k;
    c.beginPath();
    c.arc(0.12 * k, 0.12 * k, 0.05 * k, 0, Math.PI * 2);
    c.stroke();
    matrixCode(c, 0.58 * k, 0.58 * k, 0.3 * k, 14, 41, LASER);
  }, 300);
  mark.position.set(2.42, 0, Z1 + 0.11);
  g.add(mark);

  // The power stage beside the edge fingers: a PMIC and a moulded inductor.
  g.add(mesh(rbox(0.36, 0.36, 0.11, 0.05, 0.02), M.graphite, 3.3, 0.48, Z1 + 0.055));
  g.add(mesh(rbox(0.34, 0.34, 0.06, 0.015, 0.008), M.chip, 3.3, -0.48, Z1 + 0.03));

  const caps = [];
  for (let i = 0; i < 8; i++) caps.push([1.95 + i * 0.13, 0.8, 0], [1.95 + i * 0.13, -0.8, 0]);
  for (let i = 0; i < 12; i++) caps.push([3.62, -0.88 + i * 0.16, Math.PI / 2]);
  for (let i = 0; i < 6; i++) caps.push([1.6, -0.5 + i * 0.2, Math.PI / 2]);
  [0.5, 0.66, 0.82, -0.5, -0.66, -0.82].forEach((y) => caps.push([-3.8, y, 0]));
  const res = [];
  for (let i = 0; i < 8; i++) res.push([1.95 + i * 0.13, 0.96, 0], [1.95 + i * 0.13, -0.96, 0]);
  passives(caps, Z1, [0.1, 0.05, 0.05], M.ceramic, M.nickel).forEach((m) => g.add(m));
  passives(res, Z1, [0.1, 0.05, 0.035], M.black, M.nickel).forEach((m) => g.add(m));

  // The label, laid on the NAND and DRAM tops.
  const LX0 = -3.55;
  const LX1 = 1.4;
  const LW = LX1 - LX0;
  const LH = 1.96;
  const LZ = Z1 + 0.12;
  const paper = M.graphite.clone();
  paper.roughness = 0.68;
  paper.metalness = 0.3;
  g.add(mesh(rbox(LW, LH, 0.008, 0.06, 0.002), paper, (LX0 + LX1) / 2, 0, LZ + 0.004));
  const print = ink(LW - 0.02, LH - 0.02, (c, w, h) => {
    const k = w / (LW - 0.02);
    write(c, "linkedwallets", 0.22 * k, 0.55 * k, 0.34 * k, PRINT);
    c.fillStyle = PRINT;
    c.fillRect(0.22 * k, 0.72 * k, w - 0.44 * k, 0.01 * k);
    write(c, "writings · 3", 0.22 * k, 1.04 * k, 0.2 * k, PRINT);
    write(c, "tx 3cR8…Zrn2", 0.22 * k, 1.33 * k, 0.18 * k, PRINT);
    barcode(c, 0.22 * k, 1.5 * k, 2.7 * k, 0.2 * k, 9, PRINT);
    matrixCode(c, w - 0.85 * k, h - 0.85 * k, 0.62 * k, 18, 23, PRINT);
    c.fillStyle = ORANGE;
    c.fillRect(w - 0.48 * k, 0.24 * k, 0.24 * k, 0.24 * k);
  }, 240);
  print.position.set((LX0 + LX1) / 2, 0, LZ + 0.008);
  g.add(print);

  return root;
}

// ---------- the key module ----------

// A daughterboard parallel to the mainboard, centre (-6.4, -6.9): PCB Z [0.9, 1.02] on a 2 x 5
// pin header from Z 0.16.
export function buildKey() {
  const M = palette();
  const [root, g] = placed("key", -6.4, -6.9);
  const hx = 1.5;
  const hy = 1.2;
  const Z0 = 0.9;
  const Z1 = 1.02;
  const BASE = 0.16;
  const cr = 0.1;
  const castR = 0.045;
  const castX = [];
  for (let i = -5; i <= 5; i++) castX.push(i * 0.254);

  // The PCB, with castellated half-holes along both long edges.
  const s = new THREE.Shape();
  s.moveTo(-hx + cr, -hy);
  s.lineTo(castX[0] - castR, -hy);
  castX.forEach((x) => s.absarc(x, -hy, castR, Math.PI, 0, true));
  s.lineTo(hx - cr, -hy);
  s.quadraticCurveTo(hx, -hy, hx, -hy + cr);
  s.lineTo(hx, hy - cr);
  s.quadraticCurveTo(hx, hy, hx - cr, hy);
  castX.slice().reverse().forEach((x) => s.absarc(x, hy, castR, 0, Math.PI, true));
  s.lineTo(-hx + cr, hy);
  s.quadraticCurveTo(-hx, hy, -hx, hy - cr);
  s.lineTo(-hx, -hy + cr);
  s.quadraticCurveTo(-hx, -hy, -hx + cr, -hy);
  g.add(mesh(slab(s, Z1 - Z0), M.pcbBlack, 0, 0, Z0));

  const plating = M.gold.clone();
  plating.side = THREE.DoubleSide;
  const halfHole = new THREE.CylinderGeometry(castR, castR, Z1 - Z0, 10, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2);
  const walls = many(halfHole, plating, [
    ...castX.map((x) => [x, -hy, (Z0 + Z1) / 2, 0]),
    ...castX.map((x) => [x, hy, (Z0 + Z1) / 2, Math.PI]),
  ]);
  walls.userData.edges = false;
  g.add(walls);
  const padShape = new THREE.Shape();
  padShape.moveTo(-0.07, 0);
  padShape.lineTo(-castR, 0);
  padShape.absarc(0, 0, castR, Math.PI, 0, true);
  padShape.lineTo(0.07, 0);
  padShape.lineTo(0.07, 0.17);
  padShape.lineTo(-0.07, 0.17);
  padShape.lineTo(-0.07, 0);
  const padTops = many(slab(padShape, 0.004), M.gold, [
    ...castX.map((x) => [x, -hy, Z1, 0]),
    ...castX.map((x) => [x, hy, Z1, Math.PI]),
  ]);
  padTops.userData.edges = false;
  g.add(padTops);

  const hdrX = -1.08;
  const qx = 0.38;
  const qy = 0.12;
  const silk = ink(2 * hx, 2 * hy, (c, w) => {
    const k = w / (2 * hx);
    const X = (x) => (x + hx) * k;
    const Y = (y) => (hy - y) * k;
    c.strokeStyle = "rgba(255,255,255,0.07)";
    c.lineWidth = 2;
    castX.forEach((x, i) => {
      if (i < 3 || i > 9) return;
      [[-1, -hy + 0.17], [1, hy - 0.17]].forEach(([side, edge]) => {
        const lead = qx + (i - 6) * 0.1;
        c.beginPath();
        c.moveTo(X(x), Y(edge));
        c.lineTo(X(x), Y(edge - side * 0.12));
        c.lineTo(X(lead), Y(qy + side * 0.64));
        c.stroke();
      });
    });
    const r = rng(3);
    for (let i = 0; i < 26; i++) {
      const x = -0.75 + r() * 0.3;
      const y = -0.6 + r() * 1.3;
      dot(c, X(x), Y(y), 0.012 * k, "rgba(165,165,160,0.55)");
    }
    c.strokeStyle = SILK;
    c.lineWidth = 0.012 * k;
    c.strokeRect(X(hdrX - 0.27), Y(0.66), 0.54 * k, 1.32 * k);
    dot(c, X(hdrX - 0.36), Y(0.6), 0.03 * k, SILK);
    const m = 0.14;
    const q = 0.64;
    [[-q, -q, 1, 1], [q, -q, -1, 1], [-q, q, 1, -1], [q, q, -1, -1]].forEach(([dx, dy, sx, sy]) => {
      c.beginPath();
      c.moveTo(X(qx + dx + sx * m), Y(qy + dy));
      c.lineTo(X(qx + dx), Y(qy + dy));
      c.lineTo(X(qx + dx), Y(qy + dy + sy * m));
      c.stroke();
    });
    c.strokeRect(X(1.02), Y(-0.1), 0.32 * k, 0.4 * k);
    write(c, "KEY", X(-1.38), Y(0.74), 0.22 * k, SILK);
    write(c, "4csr…VNVu", X(-0.78), Y(-0.86), 0.13 * k, SILK);
    write(c, "████████", X(0.2), Y(-0.86), 0.13 * k, SILK);
  }, 260);
  silk.position.set(0, 0, Z1);
  g.add(silk);

  // The 2 x 5 header: a black body on the mainboard, gold pins up through the module.
  const pins = [];
  for (let i = 0; i < 5; i++) {
    pins.push([hdrX - 0.127, (i - 2) * 0.254, BASE + 0.4625], [hdrX + 0.127, (i - 2) * 0.254, BASE + 0.4625]);
  }
  g.add(mesh(rbox(0.5, 1.262, 0.25, 0.02, 0.012), M.black, hdrX, 0, BASE + 0.125));
  g.add(many(box(0.064, 0.064, 0.925), M.gold, pins));
  const joints = many(new THREE.CylinderGeometry(0.036, 0.07, 0.035, 10).rotateX(Math.PI / 2), M.nickel, pins.map(([x, y]) => [x, y, Z1 + 0.0175]));
  joints.userData.edges = false;
  g.add(joints);

  // The secure element: a QFN with side leads, an etched key glyph and an orange pin-1 dot.
  const qs = 1.1;
  const qh = 0.1;
  g.add(mesh(rbox(qs, qs, qh, 0.02, 0.01), M.chip, qx, qy, Z1 + qh / 2));
  const leads = [];
  for (let i = 0; i < 18; i++) {
    const t = -0.425 + i * 0.05;
    leads.push(
      [qx + t, qy - 0.565, Z1 + 0.006, 0],
      [qx + t, qy + 0.565, Z1 + 0.006, 0],
      [qx - 0.565, qy + t, Z1 + 0.006, Math.PI / 2],
      [qx + 0.565, qy + t, Z1 + 0.006, Math.PI / 2],
    );
  }
  const leadMesh = many(box(0.026, 0.05, 0.012), M.nickel, leads);
  leadMesh.userData.edges = false;
  g.add(leadMesh);
  const glyph = ink(1.0, 1.0, (c, w) => {
    const k = w;
    c.strokeStyle = LASER;
    c.fillStyle = LASER;
    c.lineWidth = 0.045 * k;
    c.beginPath();
    c.arc(0.33 * k, 0.5 * k, 0.115 * k, 0, Math.PI * 2);
    c.stroke();
    c.fillRect(0.445 * k, 0.475 * k, 0.34 * k, 0.05 * k);
    c.fillRect(0.62 * k, 0.5 * k, 0.05 * k, 0.11 * k);
    c.fillRect(0.73 * k, 0.5 * k, 0.055 * k, 0.15 * k);
  }, 300);
  glyph.position.set(qx, qy, Z1 + qh);
  g.add(glyph);
  g.add(mesh(cylZ(0.045, 0.004, 12), M.orange, qx - 0.42, qy + 0.42, Z1 + qh + 0.001));

  // A tiny crystal: a steel lid on a ceramic base.
  g.add(mesh(rbox(0.27, 0.34, 0.03, 0.02, 0.006), M.ceramic, 1.18, -0.3, Z1 + 0.015));
  g.add(mesh(rbox(0.23, 0.3, 0.05, 0.03, 0.012), M.steel, 1.18, -0.3, Z1 + 0.055));

  passives([[1.2, 0.3, Math.PI / 2], [1.2, 0.52, Math.PI / 2], [-0.52, 0.3, Math.PI / 2]], Z1, [0.1, 0.05, 0.05], M.ceramic, M.nickel).forEach((m) => g.add(m));
  passives([[-0.52, -0.08, Math.PI / 2]], Z1, [0.1, 0.05, 0.035], M.black, M.nickel).forEach((m) => g.add(m));

  return root;
}
