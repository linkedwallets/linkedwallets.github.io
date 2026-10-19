// The node's mainboard, RAM and CPU cooler, built in the board frame (see SPEC.md): origin at
// the centre of the board on the back face of the PCB, components toward +Z, rear I/O at X = +8.5.

import { THREE, palette, rbox, box, cylZ, mesh, many, decal, rng, MONO, ORANGE } from "./kit.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Bases that lay a 2D profile (u, v) into the board frame and extrude it along the third axis.
const ALONG_X = new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)); // u = Y, v = Z, depth = +X
const ALONG_Y = new THREE.Matrix4().makeBasis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0)); // u = X, v = Z, depth = -Y
const FACE_NX = new THREE.Matrix4().makeBasis(V(0, -1, 0), V(0, 0, 1), V(-1, 0, 0)); // a decal facing -X

function poly(pts, p = new THREE.Shape()) {
  p.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(([x, y]) => p.lineTo(x, y));
  p.closePath();
  return p;
}

function rrect(cx, cy, w, h, r, p = new THREE.Shape()) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], p);
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x1, y1 - r);
  p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y1);
  p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r);
  p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}

const hole = (cx, cy, w, h, r = 0) => rrect(cx, cy, w, h, r, new THREE.Path());

function circle(cx, cy, r, p = new THREE.Path()) {
  p.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return p;
}

function extrude(shape, depth, curve = 6) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: curve });
}

// A profile (u = Y, v = Z) extruded along X from x0 to x1.
function alongX(shape, x0, x1, curve) {
  const g = extrude(shape, x1 - x0, curve);
  g.applyMatrix4(ALONG_X);
  g.translate(x0, 0, 0);
  return g;
}

// A profile (u = X, v = Z) extruded along Y from y0 to y1.
function alongY(shape, y0, y1, curve) {
  const g = extrude(shape, y1 - y0, curve);
  g.applyMatrix4(ALONG_Y);
  g.translate(0, y1, 0);
  return g;
}

// A footprint in the board plane extruded up from z0 to z1.
function up(shape, z0, z1, curve) {
  const g = extrude(shape, z1 - z0, curve);
  g.translate(0, 0, z0);
  return g;
}

function span(x0, x1, y0, y1, z0, z1) {
  const g = box(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// One geometry from many, so one material is one draw.
function merge(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const count = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  let o = 0;
  parts.forEach((g) => {
    if (!g.attributes.normal) g.computeVertexNormals();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

// A heatsink profile: a base and n fins with chamfered tops, from u0 to u1, base top zb, fin top z1.
function comb(u0, u1, z0, zb, z1, n) {
  const fw = ((u1 - u0) / (2 * n - 1)) * 1.15;
  const step = (u1 - u0 - fw) / (n - 1);
  const ch = Math.min(0.05, fw / 4);
  const pts = [[u0, z0], [u1, z0]];
  for (let i = n - 1; i >= 0; i--) {
    const a = u0 + i * step;
    const b = a + fw;
    if (i < n - 1) pts.push([b, zb]);
    pts.push([b, z1 - ch], [b - ch, z1], [a + ch, z1], [a, z1 - ch]);
    if (i > 0) pts.push([a, zb]);
  }
  return poly(pts);
}

function quiet(m) {
  m.userData.edges = false;
  return m;
}

// ---------------------------------------------------------------- the mainboard

const SX = 0.5; // the socket centre
const SY = 2.5;
const PY = -6.6; // the PCIe slot centre line
const HOLES = [[-7.95, 7.95], [5.6, 8.0], [7.95, -7.95], [-7.95, -5.1]];
const CHOKES = [];
for (let i = 0; i < 8; i++) CHOKES.push([3.7, -0.25 + i * 0.74, 0.41]);
for (let i = 0; i < 7; i++) CHOKES.push([-1.9 + i * 0.74, 5.7, 0.41]);
CHOKES.push([3.7, 5.7, 0.41]);
const CAPS = [];
[-2.95, -3.55, -4.15].forEach((x) => {
  for (let i = 0; i < 7; i++) CAPS.push([x, 0.95 + i * 0.68]);
});
for (let i = 0; i < 8; i++) CAPS.push([-1.5 + i * 0.6, -0.78]);
for (let i = 0; i < 6; i++) CAPS.push([-2.6 + i * 0.68, 8.0]);
[[7.0, -5.0], [7.6, -5.0], [8.15, -5.0], [8.15, -2.9]].forEach((p) => CAPS.push(p));
// x, y, width, height, pins per side, sides with pins (0 = QFN)
const ICS = [
  [7.3, -2.0, 0.8, 0.8, 0, 0],
  [7.3, -3.75, 0.7, 0.7, 7, 4],
  [-7.45, 5.3, 1.0, 1.0, 9, 4],
  [1.2, -5.1, 0.6, 0.6, 0, 0],
  [3.2, -5.1, 0.55, 0.55, 0, 0],
  [-0.9, -5.15, 0.5, 0.4, 4, 2],
  [-7.45, 7.0, 0.5, 0.4, 4, 2],
];

function drawBoard(g, w) {
  const P = w / 17;
  const X = (x) => (x + 8.5) * P;
  const Y = (y) => (8.5 - y) * P;
  const R = rng(5);
  g.lineCap = "round";
  g.lineJoin = "round";
  const line = (pts) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    g.stroke();
  };
  // copper planes under the power stage, at very low contrast
  g.fillStyle = "rgba(150,170,110,0.06)";
  g.fillRect(X(3.2), Y(6.3), 2.6 * P, 7.1 * P);
  g.fillRect(X(-2.4), Y(6.3), 6.0 * P, 0.9 * P);
  // traces: thin gold-green, low contrast
  g.strokeStyle = "rgba(168,176,110,0.30)";
  g.lineWidth = 1.1;
  for (let i = 0; i < 36; i++) {
    const y = 0.75 + i * 0.12;
    line([[-2.2, y], [i % 2 ? -6.2 : -5.0, y]]);
  }
  for (let i = 0; i < 30; i++) {
    const x = -0.9 + i * 0.1;
    const yb = -3.7 + i * 0.0414;
    line([[x, -1.1], [x, yb], [x + 0.9, yb - 0.9], [x + 0.9, -6.2]]);
  }
  for (let i = 0; i < 10; i++) {
    const y = -1.75 - i * 0.1;
    line([[-1.5, y], [5.6, y]]);
  }
  for (let i = 0; i < 8; i++) {
    const y = -1.25 - i * 0.05;
    line([[-2.6, y - 2.0], [-2.0, y - 0.6], [4.8, y - 0.6], [6.4, y + 1.0]]);
  }
  for (let i = 0; i < 6; i++) {
    const x = -7.2 + i * 0.12;
    line([[x, 3.2], [x, 4.6], [x + 0.4, 5.0]]);
  }
  // short random traces with vias
  for (let i = 0; i < 260; i++) {
    const x = -8.2 + R() * 16.4;
    const y = -8.2 + R() * 16.4;
    const a = Math.floor(R() * 8) * (Math.PI / 4);
    const l1 = 0.2 + R() * 0.8;
    const l2 = 0.1 + R() * 0.5;
    const b = a + (R() < 0.5 ? 1 : -1) * (Math.PI / 4);
    const x1 = x + Math.cos(a) * l1;
    const y1 = y + Math.sin(a) * l1;
    const x2 = x1 + Math.cos(b) * l2;
    const y2 = y1 + Math.sin(b) * l2;
    line([[x, y], [x1, y1], [x2, y2]]);
    g.fillStyle = "rgba(190,186,130,0.35)";
    g.beginPath();
    g.arc(X(x2), Y(y2), 2.2, 0, Math.PI * 2);
    g.fill();
  }
  // silkscreen
  const silk = "rgba(232,230,218,0.72)";
  g.strokeStyle = silk;
  g.fillStyle = silk;
  g.lineWidth = 1.4;
  const rect = (x0, y0, x1, y1) => g.strokeRect(X(x0), Y(y1), (x1 - x0) * P, (y1 - y0) * P);
  // the socket: corner marks and the pin 1 triangle
  const s = 2.85;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => {
    line([[SX + a * s, SY + b * (s - 0.5)], [SX + a * s, SY + b * s], [SX + a * (s - 0.5), SY + b * s]]);
  });
  g.beginPath();
  g.moveTo(X(SX - s - 0.05), Y(SY - s + 0.6));
  g.lineTo(X(SX - s - 0.05), Y(SY - s - 0.05));
  g.lineTo(X(SX - s + 0.6), Y(SY - s - 0.05));
  g.closePath();
  g.fill();
  CHOKES.forEach(([x, y]) => rect(x - 0.37, y - 0.37, x + 0.37, y + 0.37));
  CAPS.forEach(([x, y]) => {
    g.beginPath();
    g.arc(X(x), Y(y), 0.3 * P, 0, Math.PI * 2);
    g.stroke();
  });
  [-5.0, -6.2].forEach((c) => rect(c - 0.36, -4.96, c + 0.36, 8.46));
  rect(-2.46, PY - 0.42, 6.56, PY + 0.42);
  rect(-8.46, -1.06, -7.54, 3.06);
  rect(3.5, 7.5, 5.2, 8.45);
  rect(-4.46, -4.26, -2.54, -1.74);
  ICS.forEach(([x, y, w2, h2]) => {
    rect(x - w2 / 2 - 0.12, y - h2 / 2 - 0.12, x + w2 / 2 + 0.12, y + h2 / 2 + 0.12);
    g.beginPath();
    g.arc(X(x - w2 / 2 - 0.2), Y(y + h2 / 2 + 0.2), 2.5, 0, Math.PI * 2);
    g.fill();
  });
  g.beginPath();
  g.arc(X(-3.5), Y(-5.5), 1.18 * P, 0, Math.PI * 2);
  g.stroke();
  // the M.2 module outline (dashed) with the pads for shorter modules
  g.setLineDash([6, 5]);
  rect(-2.0, -3.7, 6.0, -1.5);
  rect(-7.9, -8.1, -4.9, -5.7);
  g.setLineDash([]);
  [[0.0, -2.6], [1.8, -2.6]].forEach(([x, y]) => {
    g.fillStyle = "rgba(226,182,92,0.75)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.22 * P, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(20,30,26,1)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.1 * P, 0, Math.PI * 2);
    g.fill();
  });
  // cooler mounting holes round the socket, and three fiducials
  [[-3.25, -1.25], [4.25, -1.25], [-3.25, 6.25], [4.25, 6.25]].forEach(([x, y]) => {
    g.fillStyle = "rgba(226,182,92,0.7)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.24 * P, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(12,14,13,1)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.14 * P, 0, Math.PI * 2);
    g.fill();
  });
  [[-8.1, 1.0], [8.1, -6.4], [-1.0, 8.2]].forEach(([x, y]) => {
    g.fillStyle = "rgba(226,182,92,0.85)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.05 * P, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "rgba(232,230,218,0.35)";
    g.beginPath();
    g.arc(X(x), Y(y), 0.14 * P, 0, Math.PI * 2);
    g.stroke();
  });
  // reference marks
  g.fillStyle = silk;
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `${0.2 * P}px ${MONO}`;
  const text = (t, x, y, rot = 0) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(rot);
    g.fillText(t, 0, 0);
    g.restore();
  };
  text("CPU1", -1.55, -0.32);
  text("DIMM_A1", -5.05, -5.25);
  text("DIMM_B1", -6.25, -5.25);
  text("PCIE1", 0.1, -5.85);
  text("M2_1", 4.6, -4.25);
  text("BAT1", -4.8, -6.05, -Math.PI / 2);
  g.font = `${0.13 * P}px ${MONO}`;
  [["U7", 7.3, -2.6], ["U9", 7.3, -4.4], ["U3", -7.45, 6.1], ["U12", 1.2, -4.6], ["Q4", 3.2, -4.62], ["L1", 4.1, -0.75], ["C214", 7.6, -5.45], ["R87", -7.2, -2.0], ["FB3", 5.0, 8.3], ["C61", -2.95, 0.42]].forEach(([t, x, y]) => text(t, x, y));
}

function drawPins(g, w) {
  const P = w / 4.5;
  const n = 44;
  g.fillStyle = "rgba(226,182,92,0.92)";
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = ((i + 0.5) * 4.5) / n;
      const y = ((j + 0.5) * 4.5) / n;
      if (Math.abs(x - 2.25) < 0.75 && Math.abs(y - 2.25) < 0.5) continue;
      g.beginPath();
      g.arc(x * P, y * P, 0.027 * P, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.fillStyle = "rgba(181,154,110,0.95)";
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 3; j++) g.fillRect((1.65 + i * 0.2) * P, (1.95 + j * 0.22) * P, 0.1 * P, 0.06 * P);
  }
}

function drawVents(g, w, h) {
  const P = w / 2.3;
  g.fillStyle = "rgba(10,10,11,0.92)";
  for (let r = 0; r < 25; r++) {
    [0.62, 1.68].forEach((cx) => {
      g.beginPath();
      g.roundRect((cx - 0.42) * P, (0.75 + r * 0.31) * P, 0.84 * P, 0.12 * P, 0.06 * P);
      g.fill();
    });
  }
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 2;
  g.strokeRect(0.14 * P, 0.14 * P, w - 0.28 * P, h - 0.28 * P);
}

export function buildBoard() {
  const M = palette();
  const g = new THREE.Group();
  const grey = M.white.clone();
  grey.color.set(0x8e9092);
  grey.roughness = 0.7;
  const chokeMat = M.graphite.clone();
  chokeMat.color.set(0x5b5d61);
  chokeMat.metalness = 0.35;
  chokeMat.roughness = 0.62;
  const brushed = M.steel.clone();
  brushed.roughness = 0.34;
  brushed.roughnessMap = M.alu.roughnessMap;
  const black = [], steel = [], gold = [], graphite = [], dark = [], greys = [], shroud = [], nickel = [], tongue = [];

  // the PCB, its mounting holes and the silkscreen
  const outline = rrect(0, 0, 17, 17, 0.2);
  HOLES.forEach(([x, y]) => outline.holes.push(circle(x, y, 0.17)));
  g.add(mesh(up(outline, 0, 0.16, 8), M.pcb));
  g.add(many(new THREE.RingGeometry(0.17, 0.4, 24), M.gold, HOLES.map(([x, y]) => [x, y, 0.1615])));
  const silk = decal(17, 17, drawBoard, 64);
  silk.position.z = 0.1605;
  g.add(silk);

  // the CPU socket: housing, floor, the steel retention bracket, the lever
  const housing = rrect(SX, SY, 5.0, 5.0, 0.12);
  housing.holes.push(hole(SX, SY, 4.6, 4.6, 0.04));
  black.push(up(housing, 0.16, 0.42, 4), span(SX - 2.3, SX + 2.3, SY - 2.3, SY + 2.3, 0.16, 0.22));
  const bracket = rrect(SX, SY, 5.2, 5.2, 0.2);
  bracket.holes.push(hole(SX, SY, 4.66, 4.66, 0.1));
  steel.push(up(bracket, 0.4, 0.45, 4));
  const rod = new THREE.CylinderGeometry(0.045, 0.045, 5.3, 10);
  rod.translate(-2.38, 2.45, 0.3);
  const arm = new THREE.CylinderGeometry(0.045, 0.045, 0.75, 10);
  arm.rotateZ(Math.PI / 2);
  arm.translate(-2.75, -0.2, 0.3);
  const grip = new THREE.CylinderGeometry(0.075, 0.075, 0.32, 10);
  grip.rotateZ(Math.PI / 2);
  grip.translate(-3.0, -0.2, 0.3);
  steel.push(rod, arm, span(-2.52, -2.22, 4.95, 5.25, 0.16, 0.42), span(-2.48, -2.28, 0.05, 0.4, 0.16, 0.4));
  black.push(grip);
  const pins = decal(4.5, 4.5, drawPins, 120);
  pins.position.set(SX, SY, 0.2215);
  g.add(pins);

  // two DIMM slots with latches at both ends
  [-5.0, -6.2].forEach((c) => {
    black.push(alongY(poly([[c - 0.3, 0.16], [c + 0.3, 0.16], [c + 0.3, 0.9], [c + 0.25, 0.95], [c + 0.09, 0.95], [c + 0.09, 0.45], [c - 0.09, 0.45], [c - 0.09, 0.95], [c - 0.25, 0.95], [c - 0.3, 0.9]]), -4.55, 8.05));
    gold.push(span(c - 0.07, c + 0.07, -4.4, 7.9, 0.45, 0.48));
    [[8.05, 1], [-4.55, -1]].forEach(([yi, s]) => {
      const pts = [[0, 0.16], [0.35, 0.16], [0.35, 0.7], [0.27, 0.95], [0.07, 0.95], [0, 0.85]].map(([d, z]) => [yi + s * d, z]);
      greys.push(alongX(poly(pts), c - 0.28, c + 0.28));
    });
  });

  // the PCIe x16 slot: body, key, steel armour, latch
  const pcieU = (top, floor) => poly([[PY - 0.325, 0.16], [PY + 0.325, 0.16], [PY + 0.325, top], [PY + 0.1, top], [PY + 0.1, floor], [PY - 0.1, floor], [PY - 0.1, top], [PY - 0.325, top]]);
  black.push(alongX(pcieU(1.16, 0.5), -1.7, 6.5), span(5.15, 5.3, PY - 0.1, PY + 0.1, 0.5, 1.16));
  gold.push(span(-1.6, 6.4, PY - 0.08, PY + 0.08, 0.5, 0.53));
  [-1, 1].forEach((s) => {
    steel.push(alongX(poly([[PY + s * 0.375, 0.24], [PY + s * 0.325, 0.24], [PY + s * 0.325, 1.17], [PY + s * 0.12, 1.17], [PY + s * 0.12, 1.25], [PY + s * 0.33, 1.25], [PY + s * 0.375, 1.2]]), -1.5, 6.35));
  });
  greys.push(alongX(pcieU(1.0, 0.6), -2.2, -1.78), alongX(pcieU(1.25, 0.6), -2.4, -2.2));

  // the M.2 connector, the standoff and its screw
  black.push(alongY(poly([[5.6, 0.16], [6.4, 0.16], [6.4, 0.6], [5.6, 0.6], [5.6, 0.56], [6.15, 0.56], [6.15, 0.42], [5.6, 0.42]]), -3.9, -1.3));
  black.push(span(5.6, 6.15, -2.02, -1.9, 0.42, 0.56));
  gold.push(span(6.08, 6.15, -3.82, -1.38, 0.43, 0.55));
  const hex = cylZ(0.22, 0.29, 6);
  hex.translate(-2.0, -2.6, 0.305);
  gold.push(hex);
  const shaft = cylZ(0.1, 0.08, 10);
  shaft.translate(-2.0, -2.6, 0.49);
  const head = cylZ(0.27, 0.065, 16);
  head.translate(-2.0, -2.6, 0.5625);
  steel.push(shaft, head);
  black.push(span(-2.15, -1.85, -2.625, -2.575, 0.585, 0.6), span(-2.025, -1.975, -2.75, -2.45, 0.585, 0.6));

  // the rear I/O: shroud, face plate, ports
  const FX = 8.56;
  shroud.push(alongY(poly([[6.0, 0.16], [6.1, 0.16], [6.1, 3.48], [8.5, 3.48], [8.5, 3.6], [6.22, 3.6], [6.0, 3.38]]), -1.0, 8.4));
  shroud.push(span(6.1, 8.5, 8.3, 8.4, 0.16, 3.48), span(6.1, 8.5, -1.0, -0.9, 0.16, 3.48));
  const vents = decal(2.3, 9.2, drawVents, 64);
  vents.position.set(7.3, 3.7, 3.6015);
  g.add(vents);
  const hdmi = (cy, cz, w, h, p) => poly([[cy - w / 2, cz + h / 2], [cy + w / 2, cz + h / 2], [cy + w / 2, cz - h / 2 + 0.12], [cy + w / 2 - 0.12, cz - h / 2], [cy - w / 2 + 0.12, cz - h / 2], [cy - w / 2, cz - h / 2 + 0.12]], p);
  const shell = (outer, inner, x0) => {
    outer.holes.push(inner);
    steel.push(alongX(outer, x0, FX, 6));
  };
  // HDMI and USB-C
  shell(hdmi(0.4, 0.62, 1.52, 0.6), hdmi(0.4, 0.62, 1.44, 0.52, new THREE.Path()), 7.4);
  black.push(alongX(hdmi(0.4, 0.62, 1.44, 0.52), 7.4, 7.5));
  tongue.push(span(7.5, FX - 0.1, -0.15, 0.95, 0.62, 0.72));
  shell(rrect(0.4, 1.45, 0.92, 0.34, 0.17), rrect(0.4, 1.45, 0.84, 0.26, 0.13, new THREE.Path()), 7.7);
  black.push(alongX(rrect(0.4, 1.45, 0.84, 0.26, 0.13), 7.7, 7.8));
  tongue.push(span(7.8, FX - 0.06, 0.12, 0.68, 1.425, 1.475));
  // two USB-A
  [0.55, 1.25].forEach((z) => {
    shell(rrect(3.0, z, 1.32, 0.56, 0.03), hole(3.0, z, 1.24, 0.48, 0.02), 7.3);
    black.push(alongX(rrect(3.0, z, 1.24, 0.48, 0.02), 7.3, 7.4));
    tongue.push(span(7.4, FX - 0.1, 2.5, 3.5, z + 0.03, z + 0.15));
  });
  // RJ45 with its two LEDs
  const rj = [[2.42, 2.81], [3.58, 2.81], [3.58, 1.95], [3.25, 1.95], [3.25, 1.84], [2.75, 1.84], [2.75, 1.95], [2.42, 1.95]];
  shell(rrect(3.0, 2.45, 1.62, 1.4, 0.04), poly(rj, new THREE.Path()), 7.0);
  black.push(alongX(poly(rj), 7.0, 7.1));
  for (let i = 0; i < 8; i++) gold.push(span(7.6, 8.2, 2.58 + i * 0.12, 2.62 + i * 0.12, 2.74, 2.79));
  g.add(mesh(span(FX, FX + 0.03, 2.3, 2.56, 2.9, 3.06), M.orange));
  g.add(mesh(span(FX, FX + 0.03, 3.44, 3.7, 2.9, 3.06), M.white));
  // three audio jacks
  black.push(span(7.0, 8.5, 6.75, 8.05, 0.16, 3.15));
  [0.75, 1.7, 2.65].forEach((z) => {
    const ring = circle(7.4, z, 0.3, new THREE.Shape());
    ring.holes.push(circle(7.4, z, 0.19));
    nickel.push(alongX(ring, 8.5, FX, 10));
    dark.push(alongX(circle(7.4, z, 0.19, new THREE.Shape()), 8.47, 8.505, 10));
  });
  // the face plate with its cut-outs and a vent grid
  const plate = rrect(3.7, 1.8, 9.4, 3.6, 0.1);
  plate.holes.push(hdmi(0.4, 0.62, 1.62, 0.7, new THREE.Path()), hole(0.4, 1.45, 1.02, 0.44, 0.2), hole(3.0, 0.9, 1.42, 1.32, 0.05), hole(3.0, 2.45, 1.7, 1.48, 0.05));
  [0.75, 1.7, 2.65].forEach((z) => plate.holes.push(circle(7.4, z, 0.36)));
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 8; j++) plate.holes.push(circle(4.55 + i * 0.32 + (j % 2) * 0.16, 0.55 + j * 0.32, 0.1));
  }
  steel.push(alongX(plate, 8.5, 8.6, 8));
  black.push(span(8.4, 8.46, 4.3, 6.5, 0.3, 3.2));

  // VRM heatsinks, the chipset heatsink and their thermal pads
  graphite.push(alongY(comb(4.2, 5.6, 0.24, 0.95, 2.0, 5), -0.5, 7.5), alongX(comb(6.2, 7.6, 0.24, 0.95, 2.0, 5), -3.0, 3.5));
  greys.push(span(4.25, 5.55, -0.45, 7.45, 0.16, 0.24), span(-2.95, 3.45, 6.25, 7.55, 0.16, 0.24), span(-4.35, -2.65, -4.15, -1.85, 0.16, 0.22));
  tongue.push(alongY(comb(-4.4, -2.6, 0.22, 0.55, 1.0, 7), -4.2, -1.8));

  // chokes and capacitors round the socket
  g.add(many(rbox(0.62, 0.62, 0.5, 0.06, 0.025), chokeMat, CHOKES));
  g.add(many(cylZ(0.24, 0.56, 16), M.chip, CAPS.map(([x, y]) => [x, y, 0.44])));
  g.add(many(cylZ(0.225, 0.02, 16), M.steel, CAPS.map(([x, y]) => [x, y, 0.73])));

  // the 24-pin power connector, the 8-pin CPU power, a fan header, the front panel header
  const atx = rrect(-7.99, 1.0, 0.62, 4.0, 0.05);
  const atxPins = [];
  for (let i = 0; i < 12; i++) {
    [-0.16, 0.16].forEach((dx, k) => {
      const x = -7.99 + dx;
      const y = 1.0 + (i - 5.5) * 0.32;
      atx.holes.push(hole(x, y, 0.22, 0.22, (i + k) % 3 === 0 ? 0.07 : 0));
      atxPins.push([x, y, 0.45]);
    });
  }
  black.push(up(atx, 0.3, 1.2, 3), span(-8.3, -7.68, -1.0, 3.0, 0.16, 0.3), span(-8.4, -8.3, 0.65, 1.35, 0.55, 1.1));
  const eps = rrect(4.35, 8.0, 1.5, 0.78, 0.05);
  for (let i = 0; i < 4; i++) {
    [-0.17, 0.17].forEach((dy, k) => {
      const x = 4.35 + (i - 1.5) * 0.34;
      eps.holes.push(hole(x, 8.0 + dy, 0.24, 0.22, (i + k) % 2 ? 0.07 : 0));
      atxPins.push([x, 8.0 + dy, 0.45]);
    });
  }
  black.push(up(eps, 0.3, 1.2, 3), span(3.6, 5.1, 7.61, 8.39, 0.16, 0.3), span(4.05, 4.65, 8.39, 8.47, 0.55, 1.05));
  g.add(quiet(many(box(0.1, 0.1, 0.3), M.gold, atxPins)));
  black.push(span(1.55, 2.55, 7.78, 8.22, 0.16, 0.3), span(1.55, 2.55, 8.14, 8.22, 0.3, 0.75), span(1.55, 1.63, 7.78, 8.22, 0.3, 0.75), span(2.47, 2.55, 7.78, 8.22, 0.3, 0.75));
  black.push(span(-7.75, -7.25, -3.65, -2.35, 0.16, 0.4));
  const headerPins = [];
  for (let i = 0; i < 4; i++) headerPins.push([1.68 + i * 0.25, 7.98, 0.58]);
  for (let i = 0; i < 5; i++) [-0.127, 0.127].forEach((dx) => headerPins.push([-7.5 + dx, -3.0 + (i - 2) * 0.254, 0.68]));
  g.add(quiet(many(box(0.06, 0.06, 0.56), M.gold, headerPins)));

  // the coin cell in its holder
  const holder = cylZ(1.1, 0.12, 24);
  holder.translate(-3.5, -5.5, 0.22);
  const cell = cylZ(1.0, 0.3, 24);
  cell.translate(-3.5, -5.5, 0.43);
  black.push(holder);
  steel.push(cell, span(-3.68, -3.32, -6.0, -4.3, 0.58, 0.61), span(-3.68, -3.32, -4.38, -4.3, 0.16, 0.61));

  // chips with their pins
  const icPins = [];
  ICS.forEach(([x, y, w, h, n, sides]) => {
    dark.push(span(x - w / 2, x + w / 2, y - h / 2, y + h / 2, 0.16, n ? 0.3 : 0.25));
    for (let i = 0; i < n; i++) {
      const tx = (i - (n - 1) / 2) * ((w * 0.8) / Math.max(1, n - 1));
      const ty = (i - (n - 1) / 2) * ((h * 0.8) / Math.max(1, n - 1));
      icPins.push([x + tx, y + h / 2 + 0.06, 0.18, 0], [x + tx, y - h / 2 - 0.06, 0.18, 0]);
      if (sides === 4) icPins.push([x + w / 2 + 0.06, y + ty, 0.18, Math.PI / 2], [x - w / 2 - 0.06, y + ty, 0.18, Math.PI / 2]);
    }
  });
  g.add(quiet(many(box(0.04, 0.14, 0.03), M.steel, icPins)));

  // small SMD parts in short rows, clear of every zone
  const busy = [
    [-3.2, -0.45, 3.2, 5.3], [3.35, -0.6, 4.05, 6.05], [-2.25, 5.35, 4.05, 6.05], [-4.45, 0.6, -2.7, 5.2], [-1.8, -1.05, 2.98, -0.45],
    [4.2, -0.5, 5.6, 7.5], [-3.0, 6.2, 3.5, 7.6], [6.0, -1.0, 8.6, 8.4], [-6.5, -4.9, -4.7, 8.4], [-2.4, -6.975, 6.5, -6.225],
    [5.6, -3.9, 6.4, -1.3], [-2.35, -2.95, -1.65, -2.25], [-4.4, -4.2, -2.6, -1.8], [-7.9, -8.1, -4.9, -5.7], [-8.4, -1.0, -7.6, 3.0],
    [-4.6, -6.6, -2.4, -4.3], [3.55, 7.55, 5.15, 8.5], [1.5, 7.7, 2.6, 8.3], [-2.9, 7.7, 1.1, 8.3], [-7.8, -3.7, -7.2, -2.3],
    [6.7, -5.3, 8.4, -4.7], [7.9, -3.2, 8.4, -2.6], [-6.7, -5.45, -3.95, -5.05], [-0.45, -6.0, 0.65, -5.7], [4.1, -4.4, 5.1, -4.1],
    [-5.0, -6.3, -4.6, -5.6],
  ];
  ICS.forEach(([x, y, w, h]) => busy.push([x - w / 2 - 0.2, y - h / 2 - 0.2, x + w / 2 + 0.2, y + h / 2 + 0.2]));
  HOLES.forEach(([x, y]) => busy.push([x - 0.5, y - 0.5, x + 0.5, y + 0.5]));
  const free = (x, y) => Math.abs(x) < 8.3 && Math.abs(y) < 8.3 && busy.every(([a, b, c, d]) => x < a - 0.12 || x > c + 0.12 || y < b - 0.12 || y > d + 0.12);
  const placed = [];
  const clash = (x, y) => placed.some(([px, py]) => Math.abs(px - x) < 0.2 && Math.abs(py - y) < 0.2);
  const res = [];
  const mlcc = [];
  const R = rng(11);
  for (let k = 0; k < 900 && placed.length < 620; k++) {
    const cx = -8.3 + R() * 16.6;
    const cy = -8.3 + R() * 16.6;
    const n = 2 + Math.floor(R() * 7);
    const row = R() < 0.5;
    const list = R() < 0.5 ? res : mlcc;
    for (let i = 0; i < n; i++) {
      const x = cx + (row ? i * 0.22 : 0);
      const y = cy + (row ? 0 : i * 0.22);
      if (!free(x, y) || clash(x, y)) break;
      list.push([x, y, 0.185, row ? Math.PI / 2 : 0]);
      placed.push([x, y]);
    }
  }
  const ends = merge([span(-0.08, -0.05, -0.042, 0.042, -0.026, 0.026), span(0.05, 0.08, -0.042, 0.042, -0.026, 0.026)]);
  g.add(quiet(many(box(0.1, 0.08, 0.05), M.chip, res)));
  g.add(quiet(many(box(0.1, 0.08, 0.05), M.ceramic, mlcc)));
  g.add(quiet(many(ends, M.nickel, res.concat(mlcc))));

  const out = [[black, M.black], [steel, M.steel], [gold, M.gold], [graphite, M.graphite], [dark, M.chip], [greys, grey], [shroud, brushed], [nickel, M.nickel], [tongue, M.aluDark]];
  out.forEach(([list, mat]) => g.add(mesh(merge(list), mat)));
  return g;
}

// ---------------------------------------------------------------- the RAM

function drawSpreader(g, w, h) {
  const P = w / 13.0;
  g.save();
  g.beginPath();
  g.rect(0.25 * P, 0.25 * P, 8.6 * P, h - 0.5 * P);
  g.clip();
  g.strokeStyle = "rgba(255,255,255,0.07)";
  g.lineWidth = 1;
  for (let x = -h; x < w; x += 0.075 * P) {
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + h * 0.7, 0);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.17)";
  g.lineWidth = 1.5;
  g.strokeRect(0.25 * P, 0.25 * P, 8.6 * P, h - 0.5 * P);
  g.strokeRect(9.1 * P, 0.25 * P, 3.65 * P, h - 0.5 * P);
  g.fillStyle = "rgba(255,255,255,0.05)";
  g.fillRect(9.1 * P, 0.25 * P, 3.65 * P, h - 0.5 * P);
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.beginPath();
  g.moveTo(9.4 * P, h - 0.55 * P);
  g.lineTo(9.9 * P, h - 0.55 * P);
  g.lineTo(10.2 * P, h - 0.85 * P);
  g.lineTo(12.45 * P, h - 0.85 * P);
  g.stroke();
}

export function buildRam() {
  const M = palette();
  const g = new THREE.Group();
  const q = new THREE.Quaternion().setFromRotationMatrix(ALONG_X);
  const qn = new THREE.Quaternion().setFromRotationMatrix(FACE_NX);
  const pcb = [];
  const caps = [];
  const fingers = [];
  [-5.0, -6.2].forEach((x) => {
    const outline = [[-4.55, 0.6], [1.98, 0.6], [1.98, 0.85], [2.22, 0.85], [2.22, 0.6], [8.05, 0.6], [8.05, 1.0], [8.4, 1.0], [8.4, 3.6], [-4.9, 3.6], [-4.9, 1.0], [-4.55, 1.0]];
    pcb.push(alongX(poly(outline), x - 0.06, x + 0.06));
    for (let y = -4.45; y < 7.98; y += 0.085) {
      if (y > 1.92 && y < 2.28) continue;
      fingers.push([x - 0.065, y, 0.77], [x + 0.065, y, 0.77]);
    }
    [-1, 1].forEach((s) => {
      const plate = mesh(rbox(13.1, 2.45, 0.13, 0.12, 0.03), M.graphite, x + s * 0.125, 1.75, 2.375);
      plate.quaternion.copy(q);
      g.add(plate);
      const etch = decal(12.9, 2.3, drawSpreader, 48);
      etch.position.set(x + s * 0.1915, 1.75, 2.375);
      etch.quaternion.copy(s > 0 ? q : qn);
      g.add(etch);
    });
    caps.push(span(x - 0.19, x + 0.19, -4.8, 8.3, 3.6, 3.7));
  });
  g.add(mesh(merge(pcb), M.pcb));
  g.add(mesh(merge(caps), M.graphite));
  g.add(quiet(many(box(0.01, 0.055, 0.3), M.gold, fingers)));
  return g;
}

// ---------------------------------------------------------------- the CPU cooler

// A polyline as a curve, for TubeGeometry.
class Polyline extends THREE.Curve {
  constructor(pts) {
    super();
    this.pts = pts;
    this.len = [0];
    for (let i = 1; i < pts.length; i++) this.len.push(this.len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  getPoint(t, out = new THREE.Vector3()) {
    const d = t * this.len[this.len.length - 1];
    let i = 1;
    while (i < this.len.length - 1 && this.len[i] < d) i++;
    const a = this.len[i - 1];
    const k = (d - a) / Math.max(1e-6, this.len[i] - a);
    return out.copy(this.pts[i - 1]).lerp(this.pts[i], k);
  }
}

// A heat pipe along Y at X = x: along the base, a U bend at yb (toward s), back through the fins.
function pipePath(x, s, yb, yStart, yEnd) {
  const R = 1.15;
  const z0 = 1.45;
  const pts = [];
  for (let k = 0; k <= 6; k++) pts.push(V(x, yStart + ((yb - yStart) * k) / 6, z0));
  for (let k = 1; k <= 18; k++) {
    const a = (Math.PI * k) / 18;
    pts.push(V(x, yb + s * R * Math.sin(a), z0 + R - R * Math.cos(a)));
  }
  for (let k = 1; k <= 10; k++) pts.push(V(x, yb + ((yEnd - yb) * k) / 10, z0 + 2 * R));
  return new Polyline(pts);
}

// One blade: a thin warped surface, pitched the same from trailing to leading edge at every radius.
function bladeGeo(rot) {
  const r1 = 1.45;
  const r2 = 4.32;
  const lead = (t) => 0.42 + 0.3 * t * t;
  const trail = (t) => -0.3 + 0.38 * t * t;
  const geo = new THREE.PlaneGeometry(1, 1, 14, 8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) + 0.5;
    const v = p.getY(i) + 0.5;
    const r = r1 + (r2 - r1) * t;
    const a = rot + trail(t) + (lead(t) - trail(t)) * v;
    p.setXYZ(i, r * Math.cos(a), r * Math.sin(a), (v - 0.5) * 0.84);
  }
  geo.computeVertexNormals();
  return geo;
}

function drawSticker(g, w) {
  const c = w / 2;
  g.fillStyle = "#2c2d30";
  g.beginPath();
  g.arc(c, c, c * 0.98, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.24)";
  g.lineWidth = w * 0.012;
  g.beginPath();
  g.arc(c, c, c * 0.8, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.1)";
  g.beginPath();
  g.arc(c, c, c * 0.52, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = ORANGE;
  g.beginPath();
  g.arc(c, c * 0.34, w * 0.035, 0, Math.PI * 2);
  g.fill();
}

export function buildCooler() {
  const M = palette();
  const g = new THREE.Group();
  const cx = SX;
  const cy = SY;
  const bladeMat = M.black.clone();
  bladeMat.roughness = 0.4;
  bladeMat.side = THREE.DoubleSide;

  // the copper base, the clamp over the pipes and its two screws
  g.add(mesh(rbox(4, 4, 0.4, 0.2, 0.04), M.copper, cx, cy, 0.95));
  g.add(mesh(rbox(4.0, 2.6, 0.7, 0.18, 0.05), M.alu, cx, cy, 1.5));
  const heads = [];
  const slots = [];
  [-1.5, 1.5].forEach((dx) => {
    const h = cylZ(0.2, 0.1, 12);
    h.translate(cx + dx, cy, 1.9);
    heads.push(h);
    slots.push(span(cx + dx - 0.13, cx + dx + 0.13, cy - 0.025, cy + 0.025, 1.93, 1.955), span(cx + dx - 0.025, cx + dx + 0.025, cy - 0.13, cy + 0.13, 1.93, 1.955));
  });
  g.add(mesh(merge(heads), M.steel));
  g.add(quiet(mesh(merge(slots), M.black)));

  // four heat pipes: two bend up at the +Y side, two at the -Y side, then run through the fins
  const pipes = [];
  [-1.35, -0.45, 0.45, 1.35].forEach((dx, i) => {
    const s = i % 2 ? -1 : 1;
    const yb = cy + s * 2.0;
    const yStart = cy - s * 1.6;
    const yEnd = cy - s * 4.25;
    pipes.push(new THREE.TubeGeometry(pipePath(cx + dx, s, yb, yStart, yEnd), 90, 0.3, 8, false));
    const tip = new THREE.SphereGeometry(0.3, 8, 6);
    tip.translate(cx + dx, yEnd, 1.45 + 2.3);
    pipes.push(tip);
  });
  g.add(mesh(merge(pipes), M.copper));

  // the fin stack: 36 aluminium fins across Y
  const fin = alongY(poly([[cx - 4.6, 2.4], [cx + 4.6, 2.4], [cx + 4.6, 5.25], [cx + 4.45, 5.4], [cx - 4.45, 5.4], [cx - 4.6, 5.25]]), -0.0175, 0.0175);
  const finPos = [];
  for (let i = 0; i < 36; i++) finPos.push([0, cy - 4.6 + 0.0175 + (i * (9.2 - 0.035)) / 35, 0]);
  const inner = many(fin, M.fin, finPos.slice(1, 35));
  inner.userData.edges = false;
  g.add(inner);
  g.add(many(fin, M.fin, [finPos[0], finPos[35]]));

  // the 92 mm fan: two flanges, a ring, corner posts, struts, the hub with its sticker, 7 blades
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + a * 4.125, cy + b * 4.125]);
  const flange = () => {
    const f = rrect(cx, cy, 9.2, 9.2, 0.75);
    f.holes.push(circle(cx, cy, 4.42));
    corners.forEach(([x, y]) => f.holes.push(circle(x, y, 0.22)));
    return f;
  };
  const frame = [up(flange(), 5.4, 5.7, 16), up(flange(), 6.6, 6.9, 16)];
  const ring = circle(cx, cy, 4.6, new THREE.Shape());
  ring.holes.push(circle(cx, cy, 4.42));
  frame.push(up(ring, 5.7, 6.6, 24));
  corners.forEach(([x, y]) => {
    const post = rrect(x + Math.sign(x - cx) * -0.05, y + Math.sign(y - cy) * -0.05, 0.95, 0.95, 0.3);
    post.holes.push(circle(x, y, 0.22));
    frame.push(up(post, 5.7, 6.6, 6));
  });
  for (let k = 0; k < 4; k++) {
    const strut = box(3.1, 0.26, 0.2);
    strut.translate(2.95, 0, 0);
    strut.rotateZ(Math.PI / 4 + (k * Math.PI) / 2);
    strut.translate(cx, cy, 5.5);
    frame.push(strut);
  }
  const motor = cylZ(1.45, 0.2, 24);
  motor.translate(cx, cy, 5.5);
  frame.push(motor);
  g.add(mesh(merge(frame), M.black));
  g.add(mesh(cylZ(1.5, 1.0, 24), M.black, cx, cy, 6.3));
  const sticker = decal(2.2, 2.2, drawSticker, 120);
  sticker.position.set(cx, cy, 6.8015);
  g.add(sticker);
  const blades = [];
  for (let k = 0; k < 7; k++) blades.push(bladeGeo((k * Math.PI * 2) / 7));
  g.add(mesh(merge(blades), bladeMat, cx, cy, 6.3));
  return g;
}
