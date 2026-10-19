// The network card (board frame) and the power supply (case frame) of the node.

import { THREE, palette, rbox, box, cylZ, mesh, many, decal, rng, MONO } from "./kit.js";

// ---------- the network card ----------

// The card's PCB is Y -6.68..-6.52. Its components are on the -Y face.
const FACE = -6.68;
const BACK = -6.52;
// The PCB above the finger tongue, in X and Z.
const CARD = { x0: -3.5, x1: 8.5, z0: 1.35, z1: 7.0 };
const SILK = "#e8e5da";
const PX = 160;

// Many axis-aligned boxes of one material in one draw: [x, y, z, w, h, d] each.
function boxes(mat, list, edges = false) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
  const m = new THREE.Matrix4();
  list.forEach((b, i) => {
    m.makeScale(b[3], b[4], b[5]);
    m.setPosition(b[0], b[1], b[2]);
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.userData.edges = edges;
  return im;
}

// A rounded box lying on the card: footprint w (X) by d (Z), height h along Y.
function slab(w, d, h, r, mat, x, y, z) {
  const m = mesh(rbox(w, d, h, r, Math.min(0.03, h / 4)), mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}

// A slot with round ends, along Y, for a shape drawn in (Z, Y).
function slotPath(zc, y0, y1, r) {
  const p = new THREE.Path();
  p.moveTo(zc - r, y0 + r);
  p.lineTo(zc - r, y1 - r);
  p.absarc(zc, y1 - r, r, Math.PI, 0, true);
  p.lineTo(zc + r, y0 + r);
  p.absarc(zc, y0 + r, r, 0, Math.PI, true);
  return p;
}

function rectPath(a0, b0, a1, b1) {
  const p = new THREE.Path();
  p.moveTo(a0, b0);
  p.lineTo(a0, b1);
  p.lineTo(a1, b1);
  p.lineTo(a1, b0);
  p.lineTo(a0, b0);
  return p;
}

function circlePath(a, b, r) {
  const p = new THREE.Path();
  p.absarc(a, b, r, 0, Math.PI * 2, true);
  return p;
}

// The solder mask under a decal: opaque, so the decal draws the face of the PCB itself.
function maskFace(c, w, h) {
  c.fillStyle = "#1d2924";
  c.beginPath();
  c.roundRect(0, 0, w + 4, h, [0.15 * PX, 0, 0, 0.15 * PX]);
  c.fill();
}

function via(c, x, y, r) {
  c.fillStyle = "rgba(150,175,160,0.42)";
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#121a17";
  c.beginPath();
  c.arc(x, y, r * 0.45, 0, Math.PI * 2);
  c.fill();
}

export function buildNic() {
  const M = palette();
  const g = new THREE.Group();
  g.name = "nic";
  const R = rng(1405);

  const tin = [];
  const ceramicB = [];
  const blackB = [];
  const chipB = [];
  const steelB = [];
  const cageB = [];
  const darkB = [];
  const pads = [];
  const silk = [];
  const used = [];
  const isFree = (x, z, w, d, m) => used.every(([a, b, c, e]) => Math.abs(x - a) > (w + c) / 2 + m || Math.abs(z - b) > (d + e) / 2 + m);
  const claim = (x, z, w, d, outline) => {
    used.push([x, z, w, d]);
    if (outline) silk.push([x, z, w, d]);
  };

  // A two-terminal SMD part on the component face, L long along X (or Z), W wide, H high.
  const smd = (x, z, [L, W, H], alongZ, list) => {
    const y = FACE - H / 2;
    const w = alongZ ? W : L;
    const d = alongZ ? L : W;
    list.push([x, y, z, w, H, d]);
    const e = L * 0.24;
    for (const s of [-1, 1]) {
      const o = s * (L - e) / 2;
      tin.push([alongZ ? x : x + o, y, alongZ ? z + o : z, alongZ ? W + 0.006 : e, H + 0.006, alongZ ? e : W + 0.006]);
      const po = s * (L / 2 - e / 2 + 0.012);
      pads.push([alongZ ? x : x + po, alongZ ? z + po : z, alongZ ? W + 0.03 : e + 0.05, alongZ ? e + 0.05 : W + 0.03]);
    }
    used.push([x, z, w, d]);
  };
  const C0402 = [0.1, 0.05, 0.05];
  const C0603 = [0.16, 0.08, 0.08];
  const C1206 = [0.32, 0.16, 0.12];

  // The PCB, with the finger tongue and the key notch.
  const s = new THREE.Shape();
  s.moveTo(-3.35, 1.35);
  s.lineTo(-2.45, 1.35);
  s.lineTo(-2.35, 1.25);
  s.lineTo(-2.35, 0.65);
  s.lineTo(-2.25, 0.55);
  s.lineTo(4.95, 0.55);
  s.lineTo(4.95, 0.93);
  s.absarc(5.05, 0.93, 0.1, Math.PI, 0, true);
  s.lineTo(5.15, 0.55);
  s.lineTo(6.35, 0.55);
  s.lineTo(6.45, 0.65);
  s.lineTo(6.45, 1.25);
  s.lineTo(6.55, 1.35);
  s.lineTo(8.5, 1.35);
  s.lineTo(8.5, 7.0);
  s.lineTo(-3.35, 7.0);
  s.quadraticCurveTo(-3.5, 7.0, -3.5, 6.85);
  s.lineTo(-3.5, 1.5);
  s.quadraticCurveTo(-3.5, 1.35, -3.35, 1.35);
  const pcb = new THREE.ExtrudeGeometry(s, { depth: BACK - FACE, bevelEnabled: false, curveSegments: 6 });
  pcb.rotateX(Math.PI / 2);
  pcb.translate(0, BACK, 0);
  g.add(mesh(pcb, M.pcb));

  // Gold fingers on both faces: 71 pins, the key, 11 pins. A few presence pins are short.
  const fx = [];
  for (let k = 0; k < 71; k++) fx.push(-2.15 + k * 0.1);
  for (let k = 0; k < 11; k++) fx.push(5.25 + k * 0.1);
  const fingers = [];
  fx.forEach((x, i) => {
    const z0 = i % 23 === 16 ? 0.7 : 0.6;
    fingers.push([x, FACE - 0.003, (z0 + 1.04) / 2, 0.07, 0.006, 1.04 - z0]);
    fingers.push([x, BACK + 0.003, (z0 + 1.04) / 2, 0.07, 0.006, 1.04 - z0]);
  });
  g.add(boxes(M.gold, fingers));

  // The controller under a finned heatsink, held by two push pins.
  const hx = 0.95;
  const hz = 4.25;
  g.add(mesh(box(2.7, 0.1, 2.7), M.pcbBlack, hx, FACE - 0.05, hz));
  const lid = mesh(box(1.8, 0.09, 1.8), M.nickel, hx, FACE - 0.145, hz);
  lid.userData.edges = false;
  g.add(lid);
  g.add(slab(3.5, 3.5, 0.2, 0.14, M.graphite, hx, FACE - 0.3, hz));
  const fins = [];
  for (let k = 0; k < 13; k++) fins.push([hx, FACE - 0.875, 2.85 + k * (2.8 / 12), 3.5, 0.95, 0.07]);
  const finMat = M.graphite.clone();
  finMat.roughness = 0.3;
  g.add(boxes(finMat, fins, true));
  claim(hx, hz, 3.5, 3.5, false);
  const pins = [[hx - 1.45, hz - 1.6], [hx + 1.45, hz + 1.6]];
  const heads = many(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 16), M.black, pins.map(([x, z]) => [x, FACE - 0.695, z]));
  g.add(heads);
  const springs = many(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 10), M.steel, pins.map(([x, z]) => [x, FACE - 0.53, z]));
  springs.userData.edges = false;
  g.add(springs);

  // Two SFP+ cages at the bracket, with vent holes, EMI fingers and a collar.
  const CZ = [2.85, 4.65];
  const cx0 = 4.4;
  const cx1 = 8.6;
  const cw = 1.4;
  const ch = 0.95;
  const t = 0.03;
  const top = new THREE.Shape();
  top.moveTo(cx0, -cw / 2);
  top.lineTo(cx1, -cw / 2);
  top.lineTo(cx1, cw / 2);
  top.lineTo(cx0, cw / 2);
  top.lineTo(cx0, -cw / 2);
  for (let i = 0; i < 9; i++) for (const k of [-1, 0, 1]) top.holes.push(circlePath(4.72 + i * 0.25, k * 0.36, 0.055));
  for (const k of [-1, 1]) top.holes.push(rectPath(7.05, k * 0.36 - 0.05, 7.75, k * 0.36 + 0.05));
  const tg = new THREE.ExtrudeGeometry(top, { depth: t, bevelEnabled: false, curveSegments: 4 });
  tg.rotateX(Math.PI / 2);
  tg.translate(0, FACE - ch + t, 0);
  g.add(many(tg, M.steel, CZ.map((z) => [0, 0, z])));
  CZ.forEach((z) => {
    for (const k of [-1, 1]) cageB.push([(cx0 + cx1) / 2, FACE - ch / 2, z + k * (cw / 2 - t / 2), cx1 - cx0, ch, t]);
    cageB.push([cx0 + t / 2, FACE - ch / 2, z, t, ch, cw]);
    steelB.push([(cx0 + cx1) / 2, FACE - t / 2, z, cx1 - cx0, t, cw]);
    cageB.push([8.525, FACE - ch - 0.025, z, 0.15, 0.05, cw + 0.1]);
    for (const k of [-1, 1]) cageB.push([8.525, FACE - ch / 2 - 0.025, z + k * (cw / 2 + 0.025), 0.15, ch + 0.05, 0.05]);
    for (let k = 0; k < 6; k++) steelB.push([8.2, FACE - ch - 0.01, z + (k - 2.5) * 0.21, 0.36, 0.02, 0.13]);
    for (const k of [-1, 1]) for (let j = 0; j < 3; j++) steelB.push([8.2, FACE - ch / 2 + (j - 1) * 0.28, z + k * (cw / 2 + 0.01), 0.36, 0.13, 0.02]);
    darkB.push([(cx0 + 7.95) / 2, FACE - ch / 2, z, 7.95 - cx0, ch - 2 * t - 0.004, cw - 2 * t - 0.004]);
    claim((cx0 + cx1) / 2, z, cx1 - cx0, cw + 0.1, true);
  });

  // The link LEDs, one per port, behind small holes in the bracket.
  const ledZ = [CZ[0] - 0.95, CZ[1] + 0.95];
  g.add(mesh(box(0.26, 0.17, 0.16), M.white, 8.34, FACE - 0.085, ledZ[0]));
  g.add(mesh(box(0.26, 0.17, 0.16), M.orange, 8.34, FACE - 0.085, ledZ[1]));
  ledZ.forEach((z) => claim(8.34, z, 0.26, 0.16, true));

  // The low-profile bracket: a steel plate in (Z, Y) with the cut-outs, and the screw tab on top.
  const bs = new THREE.Shape();
  bs.moveTo(0, -7.85);
  bs.lineTo(0, -7.05);
  bs.lineTo(0.35, -7.05);
  bs.lineTo(0.75, -6.5);
  bs.lineTo(8.0, -6.5);
  bs.lineTo(8.0, -8.4);
  bs.lineTo(0.75, -8.4);
  bs.lineTo(0.35, -7.85);
  bs.lineTo(0, -7.85);
  CZ.forEach((z) => bs.holes.push(rectPath(z - 0.76, FACE - ch - 0.06, z + 0.76, FACE + 0.03)));
  ledZ.forEach((z) => bs.holes.push(circlePath(z, FACE - 0.085, 0.075)));
  for (const z of [6.55, 6.85, 7.15]) bs.holes.push(slotPath(z, -8.05, -7.05, 0.065));
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.08, bevelEnabled: false, curveSegments: 6 });
  bg.rotateY(-Math.PI / 2);
  bg.translate(8.6, 0, 0);
  g.add(mesh(bg, M.steel));
  const tab = new THREE.Shape();
  tab.moveTo(8.52, -8.4);
  tab.lineTo(8.97, -8.4);
  tab.lineTo(8.97, -7.61);
  tab.lineTo(8.76, -7.61);
  tab.absarc(8.76, -7.45, 0.16, -Math.PI / 2, Math.PI / 2, true);
  tab.lineTo(8.97, -7.29);
  tab.lineTo(8.97, -6.5);
  tab.lineTo(8.52, -6.5);
  tab.lineTo(8.52, -8.4);
  const tbg = new THREE.ExtrudeGeometry(tab, { depth: 0.08, bevelEnabled: false, curveSegments: 6 });
  tbg.translate(0, 0, 7.92);
  g.add(mesh(tbg, M.steel));
  const screws = [[-7.45, 1.15], [-7.45, 6.1]];
  const head = new THREE.CylinderGeometry(0.13, 0.15, 0.05, 16);
  head.rotateZ(-Math.PI / 2);
  g.add(many(head, M.nickel, screws.map(([y, z]) => [8.625, y, z])));
  screws.forEach(([y, z]) => {
    chipB.push([8.651, y, z, 0.006, 0.16, 0.035]);
    chipB.push([8.651, y, z, 0.006, 0.035, 0.16]);
  });

  // The magnetics block, the SPI flash, two crystals.
  g.add(slab(1.0, 0.62, 0.4, 0.05, M.black, 3.5, FACE - 0.23, 6.3));
  for (let k = 0; k < 6; k++) for (const j of [-1, 1]) {
    const x = 3.5 + (k - 2.5) * 0.15;
    tin.push([x, FACE - 0.012, 6.3 + j * 0.385, 0.06, 0.024, 0.13]);
    tin.push([x, FACE - 0.1, 6.3 + j * 0.32, 0.06, 0.18, 0.024]);
  }
  claim(3.5, 6.3, 1.0, 0.9, true);
  chipB.push([-2.55, FACE - 0.085, 3.6, 0.49, 0.15, 0.39]);
  for (let k = 0; k < 4; k++) for (const j of [-1, 1]) {
    const x = -2.55 + (k - 1.5) * 0.127;
    tin.push([x, FACE - 0.012, 3.6 + j * 0.27, 0.042, 0.024, 0.09]);
    tin.push([x, FACE - 0.06, 3.6 + j * 0.215, 0.042, 0.1, 0.03]);
  }
  claim(-2.55, 3.6, 0.55, 0.62, true);
  g.add(slab(1.1, 0.42, 0.32, 0.2, M.nickel, -2.45, FACE - 0.2, 4.7));
  blackB.push([-2.45, FACE - 0.02, 4.7, 1.2, 0.04, 0.5]);
  for (const j of [-1, 1]) tin.push([-2.45 + j * 0.62, FACE - 0.01, 4.7, 0.12, 0.02, 0.2]);
  claim(-2.45, 4.7, 1.3, 0.5, true);
  ceramicB.push([3.3, FACE - 0.015, 1.85, 0.32, 0.03, 0.25]);
  steelB.push([3.3, FACE - 0.05, 1.85, 0.28, 0.045, 0.21]);
  claim(3.3, 1.85, 0.32, 0.25, true);

  // Power: three inductors, two regulators, bulk capacitors.
  const ind = new THREE.Group();
  ind.rotation.x = Math.PI / 2;
  const indX = [-3.0, -2.3, -1.6];
  ind.add(many(rbox(0.55, 0.55, 0.38, 0.06, 0.03), M.graphite, indX.map((x) => [x, 1.8, -(FACE - 0.19)])));
  g.add(ind);
  indX.forEach((x) => {
    for (const j of [-1, 1]) tin.push([x + j * 0.25, FACE - 0.02, 1.8, 0.08, 0.04, 0.4]);
    claim(x, 1.8, 0.62, 0.55, true);
    smd(x, 2.45, C1206, false, ceramicB);
  });
  for (const x of [-0.8, 0.0]) {
    chipB.push([x, FACE - 0.045, 1.85, 0.4, 0.09, 0.4]);
    claim(x, 1.85, 0.4, 0.4, true);
  }

  // Passives: decoupling round the controller, AC coupling to the cages, and many small ones.
  for (let k = 0; k < 17; k++) smd(-1.0, 2.65 + k * 0.2, k % 4 === 3 ? C0603 : C0402, false, ceramicB);
  for (let k = 0; k < 16; k++) smd(-0.55 + k * 0.2, 2.3, C0402, true, k % 3 === 2 ? blackB : ceramicB);
  for (let k = 0; k < 16; k++) smd(-0.55 + k * 0.2, 6.2, C0402, true, k % 2 ? blackB : ceramicB);
  for (let k = 0; k < 13; k++) smd(2.88, 2.7 + k * 0.25, C0402, false, ceramicB);
  CZ.forEach((z) => {
    for (const o of [-0.36, -0.24, 0.24, 0.36]) smd(3.6, z + o, C0402, false, ceramicB);
    for (const o of [-0.55, 0.55]) smd(4.15, z + o, C0402, true, blackB);
  });
  claim(-2.1, 6.3, 2.8, 1.25, false);
  claim(6.4, 6.3, 2.9, 1.25, false);
  claim(3.23, 3.75, 0.4, 0.4, false);
  for (let n = 0; n < 220; n++) {
    const x = -3.3 + R() * 11.4;
    const z = 1.5 + R() * 5.35;
    const size = R() < 0.8 ? C0402 : C0603;
    const alongZ = R() < 0.5;
    const w = alongZ ? size[1] : size[0];
    const d = alongZ ? size[0] : size[1];
    if (isFree(x, z, w + 0.1, d + 0.1, 0.05)) smd(x, z, size, alongZ, R() < 0.65 ? ceramicB : blackB);
  }

  g.add(boxes(M.nickel, tin));
  g.add(boxes(M.ceramic, ceramicB));
  g.add(boxes(M.black, blackB));
  g.add(boxes(M.chip, chipB, true));
  g.add(boxes(M.steel, steelB));
  g.add(boxes(M.steel, cageB, true));
  g.add(boxes(M.black, darkB));

  // The component face: traces, pads, silkscreen, the markings.
  const W = CARD.x1 - CARD.x0;
  const H = CARD.z1 - CARD.z0;
  const front = decal(W, H, (c, w, h) => {
    const u = (x) => (x - CARD.x0) * PX;
    const v = (z) => (CARD.z1 - z) * PX;
    const path = (pts) => {
      c.beginPath();
      pts.forEach(([x, z], i) => (i ? c.lineTo(u(x), v(z)) : c.moveTo(u(x), v(z))));
      c.stroke();
    };
    maskFace(c, w, h);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = "rgba(125,180,150,0.10)";
    c.lineWidth = 0.14 * PX;
    indX.forEach((x) => path([[x, 1.8], [x, 2.2], [x + 0.35, 2.55], [hx - 0.5, 2.55]]));
    c.strokeStyle = "rgba(125,180,150,0.17)";
    c.lineWidth = 0.014 * PX;
    CZ.forEach((z) => {
      for (const o of [-0.36, -0.24, 0.24, 0.36]) {
        const z0 = hz + (z - hz) * 0.45 + o * 0.6;
        const z1 = z + o;
        path([[2.2, z0], [3.0, z0], [3.0 + Math.abs(z1 - z0), z1], [4.45, z1]]);
      }
    });
    for (let k = 0; k < 4; k++) path([[-2.25, 3.47 + k * 0.09], [-1.6 - k * 0.05, 3.47 + k * 0.09], [-1.3, 3.2 + k * 0.1], [-0.3, 3.2 + k * 0.1]]);
    for (let k = 0; k < 2; k++) path([[-1.85, 4.62 + k * 0.16], [-1.2, 4.62 + k * 0.16], [-0.3, 4.3 + k * 0.12]]);
    fx.forEach((x, i) => {
      if (i % 2) return;
      const top = 1.55 + (i % 6) * 0.06;
      path([[x, 1.35], [x, top]]);
      via(c, u(x), v(top), 0.026 * PX);
    });
    for (let x = -3.3; x < 8.4; x += 0.3) via(c, u(x), v(6.9), 0.022 * PX);
    for (let z = 1.6; z < 6.8; z += 0.3) via(c, u(-3.38), v(z), 0.022 * PX);
    for (let n = 0; n < 140; n++) via(c, u(-3.3 + R() * 11.5), v(1.5 + R() * 5.3), 0.022 * PX);
    c.fillStyle = "#bfbdb3";
    pads.forEach(([x, z, pw, pd]) => c.fillRect(u(x - pw / 2), v(z + pd / 2), pw * PX, pd * PX));
    c.strokeStyle = SILK;
    c.lineWidth = 0.012 * PX;
    silk.forEach(([x, z, sw, sd]) => c.strokeRect(u(x - sw / 2 - 0.05), v(z + sd / 2 + 0.05), (sw + 0.1) * PX, (sd + 0.1) * PX));
    c.fillStyle = SILK;
    [[-2.88, 3.98], [-0.95, 2.1], [0.2, 2.1]].forEach(([x, z]) => {
      c.beginPath();
      c.arc(u(x), v(z), 0.035 * PX, 0, Math.PI * 2);
      c.fill();
    });
    c.font = `${0.36 * PX}px ${MONO}`;
    c.letterSpacing = `${0.05 * PX}px`;
    c.fillText("NETWORK", u(-3.3), v(6.42));
    c.font = `${0.165 * PX}px ${MONO}`;
    c.letterSpacing = "0px";
    c.fillText("9 peers · 14 edges", u(-3.3), v(6.0));
    c.fillRect(u(-3.3), v(6.27), 1.78 * PX, 0.012 * PX);
    const nodes = [[5.2, 6.3], [5.7, 6.75], [5.9, 6.0], [6.4, 6.55], [6.5, 5.85], [7.0, 6.8], [7.1, 6.2], [7.6, 6.55], [7.7, 5.9]];
    const edges = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [3, 6], [4, 6], [5, 6], [5, 7], [6, 8], [7, 8]];
    c.lineWidth = 0.012 * PX;
    edges.forEach(([a, b]) => path([nodes[a], nodes[b]]));
    nodes.forEach(([x, z], i) => {
      c.fillStyle = "#1d2924";
      c.beginPath();
      c.arc(u(x), v(z), 0.07 * PX, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = SILK;
      c.beginPath();
      c.arc(u(x), v(z), (i === 3 ? 0.07 : 0.045) * PX, 0, Math.PI * 2);
      c.fill();
    });
    [[-3.2, 5.0], [8.15, 6.72], [4.15, 1.6]].forEach(([x, z]) => {
      c.fillStyle = "#101614";
      c.beginPath();
      c.arc(u(x), v(z), 0.11 * PX, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#cfa766";
      c.beginPath();
      c.arc(u(x), v(z), 0.05 * PX, 0, Math.PI * 2);
      c.fill();
    });
    const dm = rng(9);
    c.fillStyle = SILK;
    const cell = 0.36 / 12;
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      if (i === 0 || j === 11 || (dm() < 0.5 && !(i === 11 && j % 2) && !(j === 0 && i % 2))) {
        c.fillRect(u(3.05 + i * cell), v(3.93 - j * cell), cell * PX + 0.5, cell * PX + 0.5);
      }
    }
  }, PX);
  front.rotation.x = Math.PI / 2;
  front.position.set((CARD.x0 + CARD.x1) / 2, FACE - 0.001, (CARD.z0 + CARD.z1) / 2);
  front.material.roughness = 0.42;
  g.add(front);

  // The back face: traces, vias, press-fit pins of the cages, a barcode label.
  const back = decal(W, H, (c, w, h) => {
    const u = (x) => (x - CARD.x0) * PX;
    const v = (z) => (z - CARD.z0) * PX;
    maskFace(c, w, h);
    c.lineCap = "round";
    c.strokeStyle = "rgba(125,180,150,0.15)";
    c.lineWidth = 0.014 * PX;
    for (let k = 0; k < 26; k++) {
      const z = 2.0 + k * 0.17;
      c.beginPath();
      c.moveTo(u(-3.2), v(z));
      c.lineTo(u(-0.6 + (k % 5) * 0.08), v(z));
      c.lineTo(u(-0.3), v(hz + (z - hz) * 0.7));
      c.stroke();
    }
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) via(c, u(hx + (i - 4) * 0.27), v(hz + (j - 4) * 0.27), 0.024 * PX);
    pins.forEach(([x, z]) => {
      c.fillStyle = "#0e0f10";
      c.beginPath();
      c.arc(u(x), v(z), 0.12 * PX, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "#3a3c3e";
      c.lineWidth = 0.02 * PX;
      c.beginPath();
      c.moveTo(u(x - 0.1), v(z));
      c.lineTo(u(x + 0.1), v(z));
      c.stroke();
    });
    CZ.forEach((z) => {
      for (let x = 4.55; x < 8.4; x += 0.42) for (const k of [-1, 1]) {
        c.fillStyle = "#c8c6bd";
        c.beginPath();
        c.arc(u(x), v(z + k * 0.66), 0.045 * PX, 0, Math.PI * 2);
        c.fill();
      }
      c.strokeStyle = SILK;
      c.lineWidth = 0.012 * PX;
      c.strokeRect(u(cx0 - 0.05), v(z - cw / 2 - 0.05), (cx1 - cx0) * PX, (cw + 0.1) * PX);
    });
    for (let n = 0; n < 160; n++) via(c, u(-3.3 + R() * 11.5), v(1.5 + R() * 5.3), 0.022 * PX);
    c.fillStyle = "#efede6";
    c.fillRect(u(-3.1), v(5.3), 2.2 * PX, 0.8 * PX);
    c.fillStyle = "#2a2a2a";
    const bar = rng(31);
    for (let x = -2.95; x < -1.55;) {
      const bw = (1 + Math.floor(bar() * 3)) * 0.012;
      c.fillRect(u(x), v(5.42), bw * PX, 0.4 * PX);
      x += bw + (1 + Math.floor(bar() * 3)) * 0.012;
    }
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) if (i === 0 || j === 0 || bar() < 0.5) c.fillRect(u(-1.45 + i * 0.045), v(5.42 + j * 0.045), 0.045 * PX, 0.045 * PX);
  }, PX);
  back.rotation.x = -Math.PI / 2;
  back.position.set((CARD.x0 + CARD.x1) / 2, BACK + 0.001, (CARD.z0 + CARD.z1) / 2);
  back.material.roughness = 0.42;
  g.add(back);

  return g;
}

// ---------- the power supply ----------

// An SFX power supply in the case frame: X [-6.25, 6.25], Y [0.3, 6.65], Z [3.0, 13.0].
// The shell is inset a little: screw heads reach the side and top bounds, the sockets the back,
// the AC inlet the front.
export function buildPsu() {
  const M = palette();
  const g = new THREE.Group();
  g.name = "psu";

  const X0 = 6.2;
  const YB = 0.3;
  const YT = 6.6;
  const ZB = 3.35;
  const ZF = 12.6;
  const CZ = (ZB + ZF) / 2;
  const BEV = 0.07;
  const FAN_R = 4.25;
  const V2 = (x, y) => new THREE.Vector2(x, y);

  // ---- the shell: painted steel, rounded corners, a real fan opening in the top ----
  {
    const hw = X0 - BEV;
    const hd = (ZF - ZB) / 2 - BEV;
    const rr = 0.3 - BEV;
    const pts = [];
    [[hw - rr, -hd + rr, -Math.PI / 2], [hw - rr, hd - rr, 0], [-hw + rr, hd - rr, Math.PI / 2], [-hw + rr, -hd + rr, Math.PI]].forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= 2; i++) {
        const a = a0 + (i * Math.PI) / 4;
        pts.push(V2(cx + rr * Math.cos(a), cy + rr * Math.sin(a)));
      }
    });
    const shape = new THREE.Shape(pts);
    const hole = [];
    for (let i = 0; i < 48; i++) {
      const a = (-i / 48) * Math.PI * 2;
      hole.push(V2((FAN_R + BEV) * Math.cos(a), (FAN_R + BEV) * Math.sin(a)));
    }
    shape.holes.push(new THREE.Path(hole));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: YT - YB - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 2, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, YB + BEV, CZ);
    g.add(new THREE.Mesh(geo, M.graphite));
  }

  // ---- the fan well: a black frame ring and a dark floor ----
  const floorY = 5.0;
  const linerMat = M.black.clone();
  linerMat.side = THREE.DoubleSide;
  const liner = mesh(new THREE.CylinderGeometry(FAN_R - 0.01, FAN_R - 0.01, 1.5, 48, 1, true), linerMat, 0, YT - 0.06 - 0.75, CZ);
  liner.userData.edges = false;
  g.add(liner);
  const fill = mesh(new THREE.CylinderGeometry(FAN_R - 0.02, FAN_R - 0.02, floorY - YB - 0.06, 48), M.pcbBlack, 0, (floorY + YB + 0.06) / 2, CZ);
  fill.userData.edges = false;
  g.add(fill);

  // ---- the fan and the wire grille, built with the fan axis on local +Z (world +Y) ----
  const fan = new THREE.Group();
  fan.rotation.x = -Math.PI / 2;
  fan.position.set(0, 0, CZ);
  g.add(fan);

  const strutLen = FAN_R - 1.3;
  const strutGeo = box(strutLen, 0.22, 0.1);
  strutGeo.translate(1.3 + strutLen / 2, 0, 0);
  const struts = many(strutGeo, M.black, [0, 1, 2, 3].map((i) => [0, 0, floorY + 0.05, Math.PI / 4 + (i * Math.PI) / 2]));
  struts.userData.edges = false;
  fan.add(struts);

  fan.add(mesh(cylZ(1.4, 0.9, 24), M.black, 0, 0, floorY + 0.45));
  const sticker = decal(2.2, 2.2, (c, w, h) => {
    c.fillStyle = "#202125";
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#5f6268";
    c.lineWidth = 3;
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2 - 16, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#8e9197";
    c.font = `500 ${Math.round(w * 0.085)}px ${MONO}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("linkedwallets", w / 2, h / 2);
  }, 120);
  sticker.position.set(0, 0, floorY + 0.905);
  fan.add(sticker);

  // twisted blades: a helical strip, swept forward toward the tip
  const bladeGeo = (() => {
    const nr = 8;
    const ns = 6;
    const pos = [];
    const idx = [];
    for (let k = 0; k < 7; k++) {
    const rot = (k * Math.PI * 2) / 7;
    const base = pos.length / 3;
    for (let i = 0; i <= nr; i++) {
      const t = i / nr;
      const r = 1.42 + (FAN_R - 0.16 - 1.42) * t;
      const mid = 0.5 * t;
      const half = 0.4 - 0.06 * t;
      const pitch = 0.62 - 0.22 * t;
      for (let j = 0; j <= ns; j++) {
        const s = (j / ns) * 2 - 1;
        const a = rot + mid + s * half;
        pos.push(r * Math.cos(a), r * Math.sin(a), s * half * r * Math.tan(pitch) * 0.55 + 0.05 * (1 - s * s));
      }
    }
    for (let i = 0; i < nr; i++) {
      for (let j = 0; j < ns; j++) {
        const a = base + i * (ns + 1) + j;
        const b = a + ns + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  })();
  const bladeMat = M.graphite.clone();
  bladeMat.side = THREE.DoubleSide;
  const blades = mesh(bladeGeo, bladeMat, 0, 0, 5.55);
  blades.userData.edges = false;
  fan.add(blades);

  [0.78, 1.45, 2.12, 2.79, 3.46, 4.12].forEach((r) => {
    fan.add(mesh(new THREE.TorusGeometry(r, 0.042, 6, r < 2 ? 40 : 64), M.steel, 0, 0, 6.5));
  });
  const spokeLen = 4.12 - 0.5;
  const spokeGeo = new THREE.CylinderGeometry(0.036, 0.036, spokeLen, 6);
  spokeGeo.rotateZ(Math.PI / 2);
  spokeGeo.translate(0.5 + spokeLen / 2, 0, 0);
  fan.add(many(spokeGeo, M.steel, [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [0, 0, 6.43, (i * Math.PI) / 4])));
  fan.add(mesh(cylZ(0.42, 0.04, 20), M.steel, 0, 0, 6.5));

  // ---- Phillips screws: 4 fan screws on the top, 4 cover screws on each side ----
  const slotMat = M.black.clone();
  slotMat.polygonOffset = true;
  slotMat.polygonOffsetFactor = -3;
  slotMat.polygonOffsetUnits = -3;
  const cross = new THREE.Shape([[0.022, 0.105], [0.022, 0.022], [0.105, 0.022], [0.105, -0.022], [0.022, -0.022], [0.022, -0.105], [-0.022, -0.105], [-0.022, -0.022], [-0.105, -0.022], [-0.105, 0.022], [-0.022, 0.022], [-0.022, 0.105]].map(([x, y]) => V2(x, y)));

  const headTop = new THREE.CylinderGeometry(0.165, 0.2, 0.05, 16);
  const crossTop = new THREE.ExtrudeGeometry(cross, { depth: 0.012, bevelEnabled: false });
  crossTop.rotateX(-Math.PI / 2);
  const topPts = [[-4.125, CZ - 4.125], [4.125, CZ - 4.125], [-4.125, CZ + 4.125], [4.125, CZ + 4.125]];
  g.add(many(headTop, M.steel, topPts.map(([x, z]) => [x, YT + 0.025, z])));
  const topSlots = many(crossTop, slotMat, topPts.map(([x, z]) => [x, YT + 0.05 - 0.012, z]));
  topSlots.userData.edges = false;
  g.add(topSlots);

  const headSide = new THREE.CylinderGeometry(0.165, 0.2, 0.05, 16);
  headSide.rotateZ(-Math.PI / 2);
  const crossSide = new THREE.ExtrudeGeometry(cross, { depth: 0.012, bevelEnabled: false });
  crossSide.rotateY(Math.PI / 2);
  const sidePts = [];
  [[5.85, ZB + 0.55], [5.85, ZF - 0.55], [1.05, ZB + 0.55], [1.05, ZF - 0.55]].forEach(([y, z]) => {
    sidePts.push([1, y, z], [-1, y, z]);
  });
  g.add(many(headSide, M.steel, sidePts.map(([s, y, z]) => [s * (X0 + 0.025), y, z, s > 0 ? 0 : Math.PI])));
  const sideSlots = many(crossSide, slotMat, sidePts.map(([s, y, z]) => [s * (X0 + 0.05 - 0.012), y, z, s > 0 ? 0 : Math.PI]));
  sideSlots.userData.edges = false;
  g.add(sideSlots);

  // ---- the rating label on the +X side ----
  const label = decal(7.4, 3.7, (c, w, h) => {
    const k = w / 7.4;
    const ink = "#3e4045";
    const mid = "#7f8186";
    const light = "#a9abaf";
    const R = rng(11);
    c.fillStyle = "#ebe9e4";
    c.beginPath();
    c.roundRect(0, 0, w, h, 0.16 * k);
    c.fill();
    c.strokeStyle = light;
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(0.14 * k, 0.14 * k, w - 0.28 * k, h - 0.28 * k, 0.08 * k);
    c.stroke();

    const L = 0.34 * k;
    const Rt = w - 0.34 * k;
    c.fillStyle = ink;
    c.textBaseline = "alphabetic";
    c.font = `500 ${Math.round(0.4 * k)}px ${MONO}`;
    c.textAlign = "left";
    c.fillText("linkedwallets", L, 0.78 * k);
    c.font = `700 ${Math.round(0.46 * k)}px ${MONO}`;
    c.textAlign = "right";
    c.fillText("PSU", Rt, 0.8 * k);
    c.fillStyle = mid;
    c.fillRect(L, 0.98 * k, Rt - L, 2);

    c.strokeStyle = ink;
    c.lineWidth = 3;
    c.strokeRect(L, 1.2 * k, 1.9 * k, 1.2 * k);
    c.fillStyle = ink;
    c.textAlign = "center";
    c.font = `600 ${Math.round(0.56 * k)}px ${MONO}`;
    c.fillText("12V", L + 0.95 * k, 2.0 * k);

    const tx = L + 2.15 * k;
    const tw = Rt - tx;
    const ty = 1.2 * k;
    const rh = 0.3 * k;
    c.strokeStyle = mid;
    c.lineWidth = 1.5;
    for (let i = 0; i <= 4; i++) {
      c.beginPath();
      c.moveTo(tx, ty + i * rh);
      c.lineTo(Rt, ty + i * rh);
      c.stroke();
      const x = tx + (tw * i) / 4;
      c.beginPath();
      c.moveTo(x, ty);
      c.lineTo(x, ty + 4 * rh);
      c.stroke();
    }
    c.fillStyle = mid;
    c.font = `500 ${Math.round(0.17 * k)}px ${MONO}`;
    c.textAlign = "left";
    c.fillText("12V", tx + 0.08 * k, ty + rh * 0.68);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (row === 0 && col === 0) continue;
        const len = (0.25 + R() * 0.45) * (tw / 4);
        c.fillStyle = light;
        c.fillRect(tx + (col * tw) / 4 + 0.08 * k, ty + row * rh + rh * 0.42, len, 0.06 * k);
      }
    }

    // symbols: double insulation, a warning triangle, a crossed bin
    c.strokeStyle = ink;
    c.lineWidth = 2.5;
    c.strokeRect(L, 2.72 * k, 0.55 * k, 0.55 * k);
    c.strokeRect(L + 0.12 * k, 2.84 * k, 0.31 * k, 0.31 * k);
    const tcx = L + 1.05 * k;
    c.beginPath();
    c.moveTo(tcx, 2.7 * k);
    c.lineTo(tcx + 0.32 * k, 3.27 * k);
    c.lineTo(tcx - 0.32 * k, 3.27 * k);
    c.closePath();
    c.stroke();
    c.beginPath();
    c.moveTo(tcx + 0.06 * k, 2.86 * k);
    c.lineTo(tcx - 0.06 * k, 3.06 * k);
    c.lineTo(tcx + 0.05 * k, 3.06 * k);
    c.lineTo(tcx - 0.06 * k, 3.2 * k);
    c.stroke();
    const bcx = L + 1.75 * k;
    c.strokeRect(bcx - 0.16 * k, 2.84 * k, 0.32 * k, 0.4 * k);
    c.beginPath();
    c.moveTo(bcx - 0.22 * k, 2.79 * k);
    c.lineTo(bcx + 0.22 * k, 2.79 * k);
    c.moveTo(bcx - 0.28 * k, 2.7 * k);
    c.lineTo(bcx + 0.28 * k, 3.3 * k);
    c.moveTo(bcx + 0.28 * k, 2.7 * k);
    c.lineTo(bcx - 0.28 * k, 3.3 * k);
    c.stroke();

    // fine print as thin grey rules, then a barcode
    for (let i = 0; i < 4; i++) {
      c.fillStyle = light;
      c.fillRect(L + 2.25 * k, 2.76 * k + i * 0.15 * k, (0.6 + R() * 0.5) * k, 0.05 * k);
    }
    const bx = Rt - 2.15 * k;
    let x = bx;
    c.fillStyle = ink;
    while (x < Rt - 4) {
      const bw = (1 + Math.floor(R() * 3)) * 2.4;
      if (R() > 0.35) c.fillRect(x, 2.72 * k, Math.min(bw, Rt - x), 0.5 * k);
      x += bw + 2.4;
    }
  }, 120);
  label.rotation.y = Math.PI / 2;
  label.position.set(X0, 3.45, CZ);
  g.add(label);

  // ---- the modular connector panel on the back (-Z) ----
  g.add(mesh(rbox(11.0, 4.9, 0.06, 0.14, 0.02), M.pcbBlack, 0, 3.45, ZB - 0.03));
  const sockets = [[9, -2.85, 4.5], [5, 0.75, 4.5], [4, 3.55, 4.5], [4, -3.85, 2.3], [4, -1.45, 2.3], [4, 0.95, 2.3], [3, 3.35, 2.3]];
  const SD = ZB - 0.06 - 3.03;
  sockets.forEach(([n, x, y]) => g.add(mesh(rbox(n * 0.42 + 0.34, 1.2, SD, 0.07, 0.025), M.black, x, y, 3.03 + SD / 2)));
  g.add(many(box(0.46, 0.12, 0.22), M.black, sockets.map(([, x, y]) => [x, y + 0.66, 3.13])));
  const pins = decal(11.0, 4.9, (c, w, h) => {
    const k = w / 11.0;
    sockets.forEach(([n, sx, sy]) => {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          const xw = sx + (i - (n - 1) / 2) * 0.42;
          const yw = sy + (j - 0.5) * 0.42;
          const u = (5.5 - xw) * k;
          const v = (5.9 - yw) * k;
          const s = (0.31 * k) / 2;
          const ch = (i + j) % 2 ? 0.09 * k : 0;
          c.beginPath();
          c.moveTo(u - s + ch, v - s);
          c.lineTo(u + s - ch, v - s);
          c.lineTo(u + s, v - s + ch);
          c.lineTo(u + s, v + s);
          c.lineTo(u - s, v + s);
          c.lineTo(u - s, v - s + ch);
          c.closePath();
          const gr = c.createLinearGradient(u, v - s, u, v + s);
          gr.addColorStop(0, "#020202");
          gr.addColorStop(1, "#151515");
          c.fillStyle = gr;
          c.fill();
          c.strokeStyle = "rgba(130,130,130,0.35)";
          c.lineWidth = 1.5;
          c.stroke();
          c.fillStyle = "#6d6e70";
          c.fillRect(u - 0.06 * k, v + 0.02 * k, 0.12 * k, 0.035 * k);
        }
      }
    });
  }, 120);
  pins.rotation.y = Math.PI;
  pins.renderOrder = 1;
  pins.position.set(0, 3.45, 3.0);
  g.add(pins);

  // ---- the front (+Z): honeycomb vent, mounting holes, AC inlet, switch, one orange LED ----
  const front = decal(11.8, 5.9, (c, w, h) => {
    const k = w / 11.8;
    const U = (x) => (x + 5.9) * k;
    const V = (y) => (6.4 - y) * k;
    const p = 0.44;
    const Rh = 0.36 / Math.sqrt(3);
    for (let r = 0; r < 40; r++) {
      const y = 5.9 - r * p * 0.866;
      if (y < 1.0) break;
      for (let q = 0; q < 40; q++) {
        const x = -4.85 + q * p + ((r % 2) * p) / 2;
        if (x > 0.5) break;
        c.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 2 + (i * Math.PI) / 3;
          const px = U(x) + Rh * k * Math.cos(a);
          const py = V(y) + Rh * k * Math.sin(a);
          if (i) c.lineTo(px, py);
          else c.moveTo(px, py);
        }
        c.closePath();
        c.fillStyle = "#070708";
        c.fill();
        c.strokeStyle = "rgba(150,152,156,0.28)";
        c.lineWidth = 1.2;
        c.stroke();
      }
    }
    [[-5.5, 0.95], [5.5, 0.95], [-5.5, 5.9], [5.5, 5.9]].forEach(([x, y]) => {
      c.fillStyle = "#86898e";
      c.beginPath();
      c.arc(U(x), V(y), 0.2 * k, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#08080a";
      c.beginPath();
      c.arc(U(x), V(y), 0.145 * k, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(160,160,165,0.5)";
      c.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(U(x), V(y), (0.06 + i * 0.03) * k, 0.4 + i, 2.6 + i);
        c.stroke();
      }
    });
  }, 110);
  front.position.set(0, 3.45, ZF);
  g.add(front);

  const IX = 3.75;
  const IY = 3.5;
  {
    const b = 0.025;
    const ow = 3.1 / 2 - b;
    const oh = 2.3 / 2 - b;
    const r = 0.22;
    const pts = [];
    [[ow - r, -oh + r, -Math.PI / 2], [ow - r, oh - r, 0], [-ow + r, oh - r, Math.PI / 2], [-ow + r, -oh + r, Math.PI]].forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (i * Math.PI) / 8;
        pts.push(V2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
      }
    });
    const shape = new THREE.Shape(pts);
    const hw = 1.2 + b;
    const hh = 0.81 + b;
    shape.holes.push(new THREE.Path([V2(-hw, hh), V2(hw, hh), V2(hw, -hh + 0.42), V2(hw - 0.42, -hh), V2(-hw + 0.42, -hh), V2(-hw, -hh + 0.42)]));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.4 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
    geo.translate(IX, IY, ZF + b);
    g.add(new THREE.Mesh(geo, M.black));
    const recess = mesh(box(2.5, 1.7, 0.02), M.chip, IX, IY, ZF + 0.012);
    recess.userData.edges = false;
    g.add(recess);
    g.add(many(box(0.11, 0.38, 0.26), M.nickel, [[IX - 0.7, IY - 0.22, ZF + 0.15], [IX + 0.7, IY - 0.22, ZF + 0.15], [IX, IY + 0.3, ZF + 0.15]]));
  }

  const SX = 1.45;
  const SY = 3.5;
  g.add(mesh(rbox(1.0, 1.5, 0.2, 0.14, 0.03), M.black, SX, SY, ZF + 0.1));
  const rocker = mesh(rbox(0.78, 1.24, 0.12, 0.08, 0.02), M.rubber, SX, SY, ZF + 0.24);
  rocker.rotation.x = 0.14;
  const markI = mesh(box(0.05, 0.26, 0.012), M.white, 0, 0.3, 0.062);
  const markO = mesh(new THREE.TorusGeometry(0.085, 0.016, 4, 16), M.white, 0, -0.3, 0.062);
  markI.userData.edges = false;
  markO.userData.edges = false;
  rocker.add(markI, markO);
  g.add(rocker);
  g.add(mesh(cylZ(0.07, 0.12, 12), M.orange, SX, SY + 1.15, ZF + 0.06));

  return g;
}
