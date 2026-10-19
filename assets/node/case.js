// The case of the node, in the case frame: two side panels, the inner chassis and the front bezel.
import { THREE, palette, rbox, box, cylZ, mesh, many, decal, MONO } from "./kit.js";

const PI = Math.PI;

// The points of a rounded rectangle, counter-clockwise, centred at (cx, cy), with no repeated point.
// (absarc leaves near-duplicate points at the joins, and the extrude bevel goes wrong on them.)
function rrectPts(cx, cy, w, h, r, n = 8) {
  r = Math.min(r, w / 2, h / 2);
  const pts = [];
  const corners = [[cx + w / 2 - r, cy - h / 2 + r, -PI / 2], [cx + w / 2 - r, cy + h / 2 - r, 0], [cx - w / 2 + r, cy + h / 2 - r, PI / 2], [cx - w / 2 + r, cy - h / 2 + r, PI]];
  corners.forEach(([x, y, a0]) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (PI / 2);
      const p = new THREE.Vector2(x + r * Math.cos(a), y + r * Math.sin(a));
      const last = pts[pts.length - 1];
      if (!last || last.distanceTo(p) > 1e-6) pts.push(p);
    }
  });
  if (pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();
  return pts;
}

function rrect(p, cx, cy, w, h, r, n) {
  return p.setFromPoints(rrectPts(cx, cy, w, h, r, n));
}

function circle(cx, cy, r, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(cx + r * Math.cos((i / n) * 2 * PI), cy + r * Math.sin((i / n) * 2 * PI)));
  return new THREE.Path(pts);
}

// The outline of an IEC C14 inlet: a rectangle with its two lower corners cut off.
function keystone(p, cx, cy, w, h, c) {
  const pts = [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2], [-w / 2, h / 2], [-w / 2, -h / 2 + c]];
  pts.forEach(([x, y], i) => (i ? p.lineTo(cx + x, cy + y) : p.moveTo(cx + x, cy + y)));
  return p;
}

// One slot of a stamped fan grille: a ring segment between two spokes of constant width.
function arcSlot(cx, cy, r1, r2, a1, a2, spoke) {
  const g1 = Math.asin(spoke / 2 / r1);
  const g2 = Math.asin(spoke / 2 / r2);
  const p = new THREE.Path();
  p.absarc(cx, cy, r2, a1 + g2, a2 - g2, false);
  p.absarc(cx, cy, r1, a2 - g1, a1 + g1, true);
  return p;
}

// A Phillips pan head, 0.3 in radius, that points to +Z from z = 0.
function panHead(r = 0.3) {
  const pts = [[0, 0], [r, 0], [r, 0.035], [r * 0.9, 0.09], [r * 0.6, 0.13], [0, 0.145]];
  const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 16);
  g.rotateX(PI / 2);
  return g;
}

// A knurled ring of teeth, extruded along +Z from z = 0.
function knurl(rOut, rIn, teeth, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * 2 * PI;
    const r = i % 2 ? rIn : rOut;
    if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a));
    else s.moveTo(r * Math.cos(a), r * Math.sin(a));
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

function inset(mat, units) {
  const m = mat.clone();
  m.polygonOffset = true;
  m.polygonOffsetFactor = -1;
  m.polygonOffsetUnits = units;
  return m;
}

// Fit the brushed grain of a face into one tile of the kit's brush texture (12.5 cm a tile, and its
// strokes stop at the tile edge), so no seam crosses the face. u runs along the grain.
function oneTile(geo, lo, hi, swap = false) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = swap ? uv.getY(i) : uv.getX(i);
    const v = swap ? uv.getX(i) : uv.getY(i);
    uv.setXY(i, 0.4 + ((u - lo) / (hi - lo)) * 11.7, v);
  }
  return geo;
}

// ---------- the side panel ----------

export function buildSidePanel(side = 1) {
  const M = palette();
  const s = side < 0 ? -1 : 1;
  const g = new THREE.Group();
  g.name = s > 0 ? "side-panel-right" : "side-panel-left";
  const face = s * 8.5;

  // A rounded slab in YZ, 0.3 thick. The rbox is rounded in its own XY, so the mesh turns, not the geometry.
  const panel = mesh(oneTile(rbox(29, 26, 0.3, 1.0, 0.06, 8), -14.5, 14.5), M.alu, s * 8.35, 13, -0.5);
  panel.rotation.y = PI / 2;
  g.add(panel);

  // The perforated vent field: a hex grid of holes in a rounded rectangle.
  const fz0 = -12.5;
  const fz1 = 6;
  const fy0 = 13;
  const fy1 = 24;
  const fr = 1.2;
  const pitch = 0.55;
  const rowH = (pitch * Math.sqrt(3)) / 2;
  const hr = 0.175;
  const zc = (fz0 + fz1) / 2;
  const yc = (fy0 + fy1) / 2;
  const inField = (z, y, m) => {
    const cz = Math.min(Math.max(z, fz0 + fr), fz1 - fr);
    const cy = Math.min(Math.max(y, fy0 + fr), fy1 - fr);
    return Math.hypot(z - cz, y - cy) <= fr - m;
  };
  const walls = [];
  const darks = [];
  for (let j = -30; j <= 30; j++) {
    const y = yc + j * rowH;
    for (let i = -40; i <= 40; i++) {
      const z = zc + i * pitch + (j & 1 ? pitch / 2 : 0);
      if (!inField(z, y, hr + 0.22)) continue;
      walls.push([face + s * 0.004, y, z]);
      darks.push([face + s * 0.008, y + 0.022, z]);
    }
  }
  // Each hole is a dark disc with a lit crescent of its wall at the bottom.
  const wallGeo = new THREE.CircleGeometry(hr, 10);
  wallGeo.rotateY((s * PI) / 2);
  const darkGeo = new THREE.CircleGeometry(hr * 0.86, 10);
  darkGeo.rotateY((s * PI) / 2);
  const holeWall = many(wallGeo, inset(M.aluDark, -2), walls);
  const holeDark = many(darkGeo, inset(M.black, -4), darks);
  holeDark.material.roughness = 0.95;
  holeWall.userData.edges = false;
  holeDark.userData.edges = false;
  g.add(holeWall, holeDark);

  // The outline of the vent field for the blueprint, hidden just under the outer face.
  const outline = mesh(rbox(fz1 - fz0, fy1 - fy0, 0.01, fr, 0), M.alu, s * 8.45, yc, zc);
  outline.rotation.y = PI / 2;
  g.add(outline);

  // A black dust filter on the inner face, behind the holes.
  const filter = mesh(rbox(fz1 - fz0 + 0.8, fy1 - fy0 + 0.8, 0.08, fr + 0.4, 0.02), M.black, s * 8.16, yc, zc);
  filter.rotation.y = PI / 2;
  g.add(filter);

  // Two knurled thumb screws at the back edge.
  const at = (dx) => [[face + s * dx, 3, -14.2], [face + s * dx, 23, -14.2]];
  const collar = cylZ(0.34, 0.12, 20);
  collar.rotateY((s * PI) / 2);
  g.add(many(collar, M.nickel, at(0.06)));
  const head = knurl(0.46, 0.43, 22, 0.42);
  head.rotateY((s * PI) / 2);
  const heads = many(head, M.aluDark, at(0.12));
  heads.userData.edgeAngle = 70;
  g.add(heads);
  const slot = many(box(0.04, 0.07, 0.56), M.black, at(0.53));
  slot.userData.edges = false;
  g.add(slot);

  return g;
}

// ---------- the chassis ----------

export function buildChassis() {
  const M = palette();
  const g = new THREE.Group();
  g.name = "chassis";

  // Top and bottom plates in brushed aluminium, grain from front to back.
  [25.85, 0.15].forEach((y) => {
    const p = mesh(oneTile(rbox(29, 16.4, 0.3, 0.06, 0.03), -14.5, 14.5), M.alu, 0, y, -0.5);
    p.rotation.set(-PI / 2, 0, PI / 2);
    g.add(p);
  });

  // The back plate with its openings cut through.
  const back = new THREE.Shape();
  back.moveTo(-8.2, 0.3);
  back.lineTo(8.2, 0.3);
  back.lineTo(8.2, 25.7);
  back.lineTo(-8.2, 25.7);
  back.holes.push(rrect(new THREE.Path(), -5.15, 20.65, 3.9, 9.7, 0.12)); // rear I/O
  back.holes.push(rrect(new THREE.Path(), -3.3, 9.7, 7.8, 2.2, 0.1)); // expansion slot
  back.holes.push(keystone(new THREE.Path(), 4.5, 3.5, 2.7, 1.9, 0.55)); // power inlet
  const fan = [2.5, 19];
  [[0.8, 1.4], [1.7, 2.3], [2.6, 3.2], [3.5, 4.0]].forEach(([r1, r2]) => {
    for (let k = 0; k < 4; k++) {
      const a = PI / 4 + (k * PI) / 2;
      back.holes.push(arcSlot(fan[0], fan[1], r1, r2, a, a + PI / 2, 0.34));
    }
  });
  for (let i = 0; i < 7; i++) back.holes.push(rrect(new THREE.Path(), 2.6 + i * 0.8, 10.1, 0.36, 5.2, 0.18));
  g.add(mesh(new THREE.ExtrudeGeometry(back, { depth: 0.3, bevelEnabled: false, curveSegments: 6 }), M.graphite, 0, 0, -15));

  // The board tray on the left.
  g.add(mesh(box(0.3, 25.4, 28.7), M.graphite, -8.05, 13, -0.35));

  // Front rails round the bezel opening, in anodized dark metal.
  g.add(many(box(1.0, 25.4, 0.6), M.aluDark, [[-7.4, 13, 13.7], [7.7, 13, 13.7]]));
  g.add(many(box(14.1, 0.8, 0.6), M.aluDark, [[0.15, 25.3, 13.7], [0.15, 0.7, 13.7]]));
  const clips = many(box(0.36, 1.0, 0.02), M.black, [[-7.4, 4, 14.0], [-7.4, 22, 14.0], [7.7, 4, 14.0], [7.7, 22, 14.0]]);
  clips.userData.edges = false;
  g.add(clips);

  // Four rubber feet.
  const foot = new THREE.CylinderGeometry(1.0, 0.85, 0.6, 20);
  g.add(many(foot, M.rubber, [[-6.2, -0.3, -12.6], [6.2, -0.3, -12.6], [-6.2, -0.3, 11.6], [6.2, -0.3, 11.6]]));

  // The power inlet: a black flange, the shroud through the plate, the floor and three blades.
  const ix = 4.5;
  const iy = 3.5;
  const shroud = keystone(new THREE.Shape(), 0, 0, 2.7, 1.9, 0.55);
  shroud.holes.push(keystone(new THREE.Path(), 0, 0, 2.4, 1.6, 0.45));
  g.add(mesh(new THREE.ExtrudeGeometry(shroud, { depth: 0.9, bevelEnabled: false }), M.black, ix, iy, -15));
  const flange = rrect(new THREE.Shape(), 0, 0, 3.9, 2.3, 0.3);
  flange.holes.push(keystone(new THREE.Path(), 0, 0, 2.44, 1.64, 0.47));
  const flangeGeo = new THREE.ExtrudeGeometry(flange, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 4 });
  g.add(mesh(flangeGeo, M.black, ix, iy, -15.13));
  const floorGeo = new THREE.ShapeGeometry(keystone(new THREE.Shape(), 0, 0, 2.4, 1.6, 0.45));
  floorGeo.rotateY(PI);
  const floor = mesh(floorGeo, M.chip, ix, iy, -14.12);
  floor.userData.edges = false;
  g.add(floor);
  const blades = many(box(0.2, 0.42, 0.75), M.nickel, [[ix - 0.7, iy + 0.22, -14.5], [ix + 0.7, iy + 0.22, -14.5], [ix, iy - 0.28, -14.5]]);
  g.add(blades);

  // Phillips screws: four on the fan grille, one on the expansion slot, two on the inlet flange.
  const screws = [
    [fan[0] - 3.75, fan[1] - 3.75, -15],
    [fan[0] + 3.75, fan[1] - 3.75, -15],
    [fan[0] - 3.75, fan[1] + 3.75, -15],
    [fan[0] + 3.75, fan[1] + 3.75, -15],
    [1.4, 9.7, -15],
    [ix - 1.62, iy, -15.15],
    [ix + 1.62, iy, -15.15],
  ];
  const headGeo = panHead(0.3);
  headGeo.rotateY(PI);
  g.add(many(headGeo, M.steel, screws));
  const cross = [];
  screws.forEach(([x, y, z]) => cross.push([x, y, z - 0.13], [x, y, z - 0.13, PI / 2]));
  const crosses = many(box(0.26, 0.055, 0.05), M.chip, cross);
  crosses.userData.edges = false;
  g.add(crosses);

  return g;
}

// ---------- the front bezel ----------

export function buildBezel() {
  const M = palette();
  const g = new THREE.Group();
  g.name = "bezel";
  const b = 0.08; // the chamfer round every edge of the front face
  const front = 15.2;
  const top = 22.8;

  // The slab: the shape is the front face, the bevel adds the chamfer, and holes are cut through.
  const s = rrect(new THREE.Shape(), 0, 13, 17 - 2 * b, 26 - 2 * b, 1.0 - b);
  s.holes.push(circle(0, top, 0.76 + b)); // power button
  s.holes.push(rrect(new THREE.Path(), -4.5, top, 0.84 + 2 * b, 0.26 + 2 * b, 0.13 + b)); // USB-C
  s.holes.push(rrect(new THREE.Path(), 4.5, top, 0.08 + 2 * b, 2.0, 0.04 + b)); // slit
  const slotYs = [5.22, 5.74, 6.26, 6.78];
  slotYs.forEach((y) => s.holes.push(rrect(new THREE.Path(), 0, y, 13, 0.14 + 2 * b, 0.07 + b)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: 1.2 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 10 });
  geo.translate(0, 0, 14 + b);
  oneTile(geo, 0, 26, true); // the grain runs vertical
  g.add(mesh(geo, M.alu));

  // The power button: steel, flat face with a small chamfer, set just under the front face.
  const bf = front - 0.015;
  const prof = [[0, 0], [0.64, 0], [0.7, -0.06], [0.7, -0.7], [0, -0.7]];
  const btnGeo = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 24);
  btnGeo.rotateX(PI / 2);
  g.add(mesh(btnGeo, M.steel, 0, top, bf));
  const icon = decal(0.62, 0.62, (c, w, h) => {
    const k = w / 0.62;
    c.strokeStyle = "rgba(58,60,64,0.9)";
    c.lineWidth = 0.045 * k;
    c.lineCap = "round";
    c.beginPath();
    c.arc(w / 2, h / 2, 0.2 * k, -PI / 2 + 0.75, -PI / 2 - 0.75 + 2 * PI);
    c.stroke();
    c.beginPath();
    c.moveTo(w / 2, h / 2 - 0.26 * k);
    c.lineTo(w / 2, h / 2 - 0.02 * k);
    c.stroke();
  }, 256);
  icon.material.alphaTest = 0.02;
  icon.position.set(0, top, bf + 0.002);
  g.add(icon);
  // The one orange accent: a thin LED ring in the gap round the button.
  const ring = mesh(new THREE.RingGeometry(0.703, 0.76, 24), M.orange, 0, top, front - b - 0.03);
  ring.userData.edges = false;
  g.add(ring);

  // USB-C: a steel shell lining the hole, a black cavity and a tongue with gold contacts.
  const shell = rrect(new THREE.Shape(), 0, 0, 0.84, 0.26, 0.13);
  shell.holes.push(rrect(new THREE.Path(), 0, 0, 0.77, 0.19, 0.095));
  g.add(mesh(new THREE.ExtrudeGeometry(shell, { depth: 0.5, bevelEnabled: false, curveSegments: 6 }), M.steel, -4.5, top, front - 0.62));
  const cavity = mesh(new THREE.ShapeGeometry(rrect(new THREE.Shape(), 0, 0, 0.84, 0.26, 0.13), 6), M.chip, -4.5, top, 14.6);
  cavity.userData.edges = false;
  g.add(cavity);
  g.add(mesh(rbox(0.56, 0.06, 0.4, 0.02, 0.01), M.black, -4.5, top, 14.82));
  const pads = mesh(box(0.46, 0.074, 0.2), M.gold, -4.5, top, 14.74);
  pads.userData.edges = false;
  g.add(pads);

  // The slit: a dark light pipe sitting deep in its hole.
  const slit = mesh(box(0.08, 1.84, 0.5), M.chip, 4.5, top, 14.8);
  slit.userData.edges = false;
  g.add(slit);

  // A black filter mesh inside the slab, seen only through the intake slots.
  const filter = mesh(new THREE.PlaneGeometry(13.4, 2.3), M.black, 0, 6, 14.05);
  filter.userData.edges = false;
  g.add(filter);

  // The wordmark, laser-etched: cap height 0.55 cm, centred at Y = 3.2.
  const ppc = 220;
  const word = decal(8, 1.4, (c, w, h) => {
    c.font = "100px " + MONO;
    const cap = c.measureText("H").actualBoundingBoxAscent || 70;
    const px = (100 * 0.55 * ppc) / cap;
    c.font = px.toFixed(1) + "px " + MONO;
    c.letterSpacing = (0.06 * px).toFixed(1) + "px";
    c.textAlign = "center";
    c.textBaseline = "alphabetic";
    c.fillStyle = "rgba(54,55,58,0.92)";
    c.fillText("linkedwallets", w / 2, h / 2 + (0.55 * ppc) / 2);
  }, ppc);
  word.material.alphaTest = 0.02;
  word.position.set(0, 3.2, front + 0.002);
  g.add(word);

  return g;
}
