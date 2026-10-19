// The node's shared kit: one three.js build, one set of materials, a few shapes, the light,
// and the blueprint look. Units are centimetres. Every part module builds with this.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";

export { THREE };

export const INK = "#151514";
export const MONO = '"Commit Mono", ui-monospace, monospace';

// Markings on the parts are drawn in Commit Mono. Build the parts after this resolves.
export const fontsReady = (async () => {
  const face = new FontFace("Commit Mono", "url(/assets/fonts/CommitMono-400-Regular.woff2)");
  try {
    document.fonts.add(await face.load());
  } catch (e) {
    // the fallback monospace draws the same markings
  }
})();
export const ORANGE = "#ff5a1f";
export const BLUEPRINT = 0x7d86d6;

// A seeded random, so the textures (and the screenshots) are the same on every load.
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvasTexture(w, h, draw, color = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let shared = null;

function textures() {
  if (shared) return shared;
  const r = rng(7);
  const brush = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = "#8a8a8a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = r() * h;
      const x = r() * w - 60;
      const len = 40 + r() * 320;
      const v = Math.round(105 + r() * 70);
      g.strokeStyle = "rgba(" + v + "," + v + "," + v + ",0.5)";
      g.lineWidth = r() < 0.85 ? 1 : 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.stroke();
    }
  }, false);
  brush.wrapS = brush.wrapT = THREE.RepeatWrapping;
  brush.repeat.set(0.08, 0.08);
  shared = { brush };
  return shared;
}

// A fresh set of materials for one part, so each part can fade on its own.
// All are transparent from the start: the blueprint fade changes opacity only, never a shader.
export function palette() {
  const T = textures();
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ transparent: true }, o));
  return {
    alu: new THREE.MeshPhysicalMaterial({ transparent: true, color: 0xd4d5d6, metalness: 1, roughness: 0.36, roughnessMap: T.brush, anisotropy: 0.65 }),
    aluDark: std({ color: 0x45474c, metalness: 0.85, roughness: 0.44, roughnessMap: T.brush }),
    graphite: std({ color: 0x2a2b2e, metalness: 0.6, roughness: 0.5 }),
    steel: std({ color: 0xc6c9cd, metalness: 1, roughness: 0.22 }),
    nickel: std({ color: 0xdcdcdb, metalness: 1, roughness: 0.3, roughnessMap: T.brush }),
    fin: std({ color: 0xcfd2d5, metalness: 1, roughness: 0.28 }),
    gold: std({ color: 0xe2b65c, metalness: 1, roughness: 0.26 }),
    copper: std({ color: 0xd38b5b, metalness: 1, roughness: 0.3 }),
    pcb: std({ color: 0x1d2924, metalness: 0.1, roughness: 0.5 }),
    pcbBlack: std({ color: 0x161818, metalness: 0.1, roughness: 0.45 }),
    black: std({ color: 0x1c1d1f, metalness: 0.05, roughness: 0.55 }),
    chip: std({ color: 0x121314, metalness: 0.15, roughness: 0.3 }),
    rubber: std({ color: 0x242426, metalness: 0, roughness: 0.92 }),
    white: std({ color: 0xebe9e4, metalness: 0, roughness: 0.62 }),
    ceramic: std({ color: 0xb59a6e, metalness: 0, roughness: 0.5 }),
    orange: std({ color: 0xff5a1f, emissive: 0xff4a10, emissiveIntensity: 0.35, metalness: 0, roughness: 0.4 }),
  };
}

// A label or silkscreen: a plane with a canvas texture. Size in cm, drawn at px per cm.
// draw(g, w, h) paints on a transparent canvas. The plane faces +Z.
export function decal(wcm, hcm, draw, pxPerCm = 64) {
  const tex = canvasTexture(Math.round(wcm * pxPerCm), Math.round(hcm * pxPerCm), draw);
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    transparent: true,
    roughness: 0.6,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wcm, hcm), mat);
  m.userData.edges = false;
  return m;
}

// A box with rounded corners in XY and a small bevel all round, centred at the origin.
export function rbox(w, h, d, r = 0.2, bevel = 0.04, curve = 6) {
  const b = Math.min(bevel, d / 4, w / 4, h / 4);
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  const rr = Math.max(0.001, Math.min(r, iw / 2, ih / 2));
  const s = new THREE.Shape();
  s.moveTo(-iw / 2 + rr, -ih / 2);
  s.lineTo(iw / 2 - rr, -ih / 2);
  s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + rr);
  s.lineTo(iw / 2, ih / 2 - rr);
  s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - rr, ih / 2);
  s.lineTo(-iw / 2 + rr, ih / 2);
  s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - rr);
  s.lineTo(-iw / 2, -ih / 2 + rr);
  s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + rr, -ih / 2);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: d - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: curve,
  });
  g.translate(0, 0, -(d - 2 * b) / 2);
  g.userData.rbox = [w, h, d, Math.min(r, w / 2, h / 2)];
  return g;
}

// The blueprint of a rounded box: both outlines and one line along each corner.
function rboxEdges([w, h, d, r]) {
  const pts = [];
  const ring = [];
  const n = 6;
  const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 1], [-w / 2 + r, -h / 2 + r, 2], [w / 2 - r, -h / 2 + r, 3]];
  corners.forEach(([cx, cy, k]) => {
    for (let i = 0; i <= n; i++) {
      const a = (k + i / n) * Math.PI / 2;
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  });
  [-d / 2, d / 2].forEach((z) => {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      pts.push(p[0], p[1], z, q[0], q[1], z);
    }
  });
  corners.forEach(([cx, cy, k]) => {
    const a = (k + 0.5) * Math.PI / 2;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    pts.push(x, y, -d / 2, x, y, d / 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

// A cylinder along Z (most round things here stand out of a board).
export function cylZ(r, h, seg = 24) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// Many copies of one shape: positions is a list of [x, y, z] or [x, y, z, rotZ].
export function many(geo, mat, positions) {
  const im = new THREE.InstancedMesh(geo, mat, positions.length);
  const o = new THREE.Object3D();
  positions.forEach((p, i) => {
    o.position.set(p[0], p[1], p[2]);
    o.rotation.set(0, 0, p[3] || 0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.instanceMatrix.needsUpdate = true;
  return im;
}

// ---------- the blueprint look ----------

const EDGE_ANGLE = 32;

function edgesOf(m) {
  const base = m.geometry.userData.rbox ? rboxEdges(m.geometry.userData.rbox) : new THREE.EdgesGeometry(m.geometry, m.userData.edgeAngle || EDGE_ANGLE);
  if (!m.isInstancedMesh) return base;
  const src = base.attributes.position.array;
  const out = new Float32Array(src.length * m.count);
  const mat = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, mat);
    for (let j = 0; j < src.length; j += 3) {
      v.set(src[j], src[j + 1], src[j + 2]).applyMatrix4(mat);
      out.set([v.x, v.y, v.z], i * src.length + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(out, 3));
  return g;
}

// Adds a line drawing to every mesh of a part (skip a mesh with userData.edges = false).
// Returns the part's look: its render materials and its one line material.
export function outline(group) {
  const line = new THREE.LineBasicMaterial({ color: BLUEPRINT, transparent: true, opacity: 0, depthWrite: false });
  const mats = new Set();
  const meshes = [];
  const lines = [];
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push(o);
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
      m.transparent = true;
      mats.add(m);
    });
  });
  meshes.forEach((m) => {
    if (m.userData.edges === false) return;
    const l = new THREE.LineSegments(edgesOf(m), line);
    l.visible = false;
    m.add(l);
    lines.push(l);
  });
  return { meshes, lines, line, mats: Array.from(mats) };
}

// 1 = the full render, 0 = the blueprint only.
export function setLook(look, r) {
  const solid = r > 0.004;
  look.mats.forEach((m) => {
    m.opacity = r;
    m.depthWrite = r > 0.5;
  });
  look.meshes.forEach((m) => {
    m.material.visible = solid;
  });
  look.line.opacity = (1 - r) * 0.85;
  look.lines.forEach((l) => {
    l.visible = r < 0.996;
  });
}

// ---------- the light: a soft studio, made once ----------

function studio() {
  const room = new THREE.Scene();
  const wall = new THREE.MeshBasicMaterial({ color: 0xa3a19c, side: THREE.BackSide });
  room.add(new THREE.Mesh(new THREE.BoxGeometry(30, 16, 30), wall));
  const panel = (w, h, x, y, z, k) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    room.add(p);
  };
  panel(14, 3, 0, 7.9, 0, 6.5); // a long softbox overhead
  panel(5, 9, -14.9, 1, 4, 3.2); // key from the left
  panel(4, 8, 14.9, 2, -3, 1.8); // fill from the right
  panel(10, 2, 0, -2, 14.9, 1.4); // a low strip in front
  panel(9, 9, -8, 3, 14.9, 1.9); // a big soft card front left
  panel(6, 6, 6, 3, -14.9, 2.2); // a rim from behind
  return room;
}

// The renderer, the scene with its light, and a camera. One per page.
export function stage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.035).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-30, 60, 40);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a857c, 0.35));

  const camera = new THREE.PerspectiveCamera(22, 1, 1, 2000);
  return { renderer, scene, camera };
}

// A soft round shadow on the floor, for the closed object.
export function floorShadow(w, d) {
  const tex = canvasTexture(256, 256, (g, cw, ch) => {
    const grad = g.createRadialGradient(cw / 2, ch / 2, 0, cw / 2, ch / 2, cw / 2);
    grad.addColorStop(0, "rgba(40,36,30,0.55)");
    grad.addColorStop(0.45, "rgba(40,36,30,0.28)");
    grad.addColorStop(1, "rgba(40,36,30,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, cw, ch);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.userData.edges = false;
  return m;
}
