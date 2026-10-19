// The node on the home page. Scroll takes it apart in two moves (the side panels slide out, then
// every part floats out), then the camera visits five parts in turn: that part stays a render,
// the rest of the machine turns into a blueprint, and the part's callout opens beside it.
// Nothing catches the wheel: the stage is a sticky box, and scrollY picks the frame.

import { THREE, stage, outline, setLook, fontsReady, floorShadow } from "./kit.js";
import { buildSidePanel, buildChassis, buildBezel } from "./case.js";
import { buildBoard, buildRam, buildCooler } from "./board.js";
import { buildCpu, buildSsd, buildKey } from "./chips.js";
import { buildNic, buildPsu } from "./cards.js";

const DEG = Math.PI / 180;
// Case coordinates put the floor at Y = 0. The scene puts the middle of the closed case at 0.
const ROOT = new THREE.Vector3(0, -12.7, -0.1);
// The board frame inside the case: turned a quarter about Y, against the left wall.
const BOARD_TURN = Math.PI / 2;
const BOARD_AT = new THREE.Vector3(-7.2, 17, -6);

// Where each part floats when the node is fully apart, in screen-aligned centimetres
// (u to the right, v up, w toward the camera), for a wide screen and for a tall one.
// turn: how the part turns as it floats out, in degrees about X, Y, Z.
const PARTS = [
  { id: "panelL", build: () => buildSidePanel(-1), frame: "case", wide: [-48, 0, -6], tall: [-12, 50, -8], open: [-15, 0, 0], turn: [0, 170, 0] },
  { id: "bezel", build: buildBezel, frame: "case", wide: [-32, 0, 0], tall: [-13, 24, 0], turn: [0, -12, 0] },
  { id: "board", build: buildBoard, frame: "board", wide: [-15, 7, -6], tall: [-9, 1, -6] },
  { id: "psu", build: buildPsu, frame: "case", wide: [-15, -13, 4], tall: [-8, -38, 0] },
  { id: "ram", build: buildRam, frame: "board", wide: [-3, 9, 0], tall: [9, 4, 0], turn: [0, -20, 0] },
  { id: "cpu", build: buildCpu, frame: "board", wide: [-2, -3, 6], tall: [-10, -14, 6], turn: [0, -38, 0] },
  { id: "cooler", build: buildCooler, frame: "board", wide: [8, 8, 0], tall: [9, -10, 0] },
  { id: "ssd", build: buildSsd, frame: "board", wide: [-1, -12, 8], tall: [2, -21, 8], turn: [0, -40, 0] },
  { id: "key", build: buildKey, frame: "board", wide: [8, -3, 10], tall: [-10, -25, 10], turn: [0, -40, 0] },
  { id: "nic", build: buildNic, frame: "board", wide: [12, -13, 6], tall: [6, -31, 6], turn: [0, -35, 90] },
  { id: "chassis", build: buildChassis, frame: "case", wide: [31, 0, -8], tall: [12, 24, -8] },
  { id: "panelR", build: () => buildSidePanel(1), frame: "case", wide: [49, 0, -4], tall: [12, 50, -4], open: [15, 0, 0] },
];

// The parts that the camera visits, in order, with the name used by the callouts.
// share: how much of the screen height the part fills (the rest shows the blueprint around it).
const FOCUS = [
  ["bezel", "case", 0.5],
  ["ssd", "storage", 0.34],
  ["cpu", "cpu", 0.3],
  ["nic", "network", 0.4],
  ["key", "key", 0.26],
];

// The timeline, in screens of scroll: each stop holds still for `hold`, then moves to the next.
function timeline() {
  const t = [
    { at: 0, hold: 0.12, e: 0, cam: "closed" },
    { at: 0.6, hold: 0.08, e: 1, cam: "open" },
    { at: 1.45, hold: 0.3, e: 2, cam: "apart" },
  ];
  FOCUS.forEach((f, i) => t.push({ at: 2.2 + i * 0.75, hold: 0.32, e: 2, cam: f[0], focus: i }));
  return t;
}
const STOPS = timeline();
const END = STOPS[STOPS.length - 1].at + STOPS[STOPS.length - 1].hold + 0.1;
// The stage stays pinned while the page scrolls through END screens.

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const smooth = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;

const root = document.querySelector(".nv");
const canvas = root && root.querySelector(".nv-gl");

if (root && canvas) start().catch((e) => {
  root.classList.add("still", "flat");
  console.warn("the node did not load:", e);
});

async function start() {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  await fontsReady;
  const { renderer, scene, camera } = stage(canvas);
  const node = new THREE.Group();
  scene.add(node);

  const shadow = floorShadow(46, 52);
  shadow.position.set(0, ROOT.y - 0.62, 0);
  scene.add(shadow);

  // Build every part, then hang it from a pivot at its own centre, so it can float and turn.
  const parts = PARTS.map((p) => {
    const built = p.build();
    const inner = new THREE.Group();
    if (p.frame === "board") {
      inner.rotation.y = BOARD_TURN;
      inner.position.copy(BOARD_AT);
    }
    inner.add(built);
    inner.position.add(ROOT);
    inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(inner);
    const home = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(home);
    inner.position.sub(home);
    pivot.add(inner);
    node.add(pivot);
    const look = outline(pivot);
    const turn = p.turn || [0, 0, 0];
    return Object.assign({}, p, {
      pivot,
      home,
      size,
      radius: size.length() / 2,
      look,
      r: 1,
      openAt: home.clone().add(new THREE.Vector3().fromArray(p.open || [0, 0, 0])),
      apart: new THREE.Vector3(),
      q0: new THREE.Quaternion(),
      q1: new THREE.Quaternion().setFromEuler(new THREE.Euler(turn[0] * DEG, turn[1] * DEG, turn[2] * DEG, "YXZ")),
    });
  });
  const byId = {};
  parts.forEach((p) => (byId[p.id] = p));

  const calls = Array.from(root.querySelectorAll(".call"));
  const callFor = {};
  calls.forEach((c) => (callFor[c.getAttribute("data-part")] = c));
  const intro = root.querySelector(".nv-intro");
  const cue = root.querySelector(".nv-cue");
  const meter = root.querySelector(".nv-now");
  const stageBox = root.querySelector(".nv-stage");

  let W = 1;
  let H = 1;
  let tall = false;
  let views = {};
  let shown = "";
  let p = 0;
  let goal = 0;
  let last = 0;
  let running = false;

  // The camera always looks along one of a few fixed directions; a view is a target point,
  // a distance, two angles and a lens shift (so the focused part can sit left of the callout).
  function dir(az, el) {
    return new THREE.Vector3(Math.cos(el * DEG) * Math.sin(az * DEG), Math.sin(el * DEG), Math.cos(el * DEG) * Math.cos(az * DEG));
  }

  function fit(radius, share) {
    const t = Math.tan((camera.fov / 2) * DEG);
    return Math.max(radius / (share * t), radius / (share * t * camera.aspect));
  }

  function layout() {
    W = stageBox.clientWidth;
    H = stageBox.clientHeight;
    tall = W / H < 0.8;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, W * H > 1.4e6 ? 1.5 : 2));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;

    // The screen-aligned axes of the "apart" view, for the floating layout.
    const f = dir(30, 12);
    const right = new THREE.Vector3(0, 1, 0).cross(f).normalize().negate();
    right.set(f.z, 0, -f.x).normalize();
    const up = new THREE.Vector3().crossVectors(f, right).negate().normalize();
    up.set(0, 1, 0);
    const spread = new THREE.Box3();
    parts.forEach((q) => {
      const a = tall ? q.tall : q.wide;
      q.apart.set(0, 0, 0).addScaledVector(right, a[0]).addScaledVector(up, a[1]).addScaledVector(f, a[2]);
      spread.expandByPoint(q.apart.clone().addScalar(q.radius * 0.7));
      spread.expandByPoint(q.apart.clone().subScalar(q.radius * 0.7));
    });

    const caseR = 21.5;
    const sCentre = spread.getCenter(new THREE.Vector3());
    const sSize = spread.getSize(new THREE.Vector3());
    const t = Math.tan((camera.fov / 2) * DEG);
    const apartD = tall
      ? Math.max(sSize.y / 2 / (0.86 * t), 0) + 10
      : Math.max((sSize.x * 0.5) / (0.9 * t * camera.aspect), (sSize.y * 0.5) / (0.8 * t)) + 10;

    views = {
      closed: { at: new THREE.Vector3(0, tall ? -1 : 0, 0), d: fit(caseR, tall ? 0.78 : 0.72), az: 36, el: 15, sx: 0, sy: tall ? -0.1 : 0 },
      open: { at: new THREE.Vector3(0, 0, 0), d: fit(caseR * (tall ? 1.15 : 1.5), 0.9), az: 33, el: 14, sx: 0, sy: 0 },
      apart: { at: sCentre, d: apartD, az: 30, el: 12, sx: 0, sy: 0 },
    };
    FOCUS.forEach(([id, , share]) => {
      const q = byId[id];
      views[id] = {
        at: q.apart.clone(),
        d: fit(q.radius, tall ? share * 1.5 : share),
        az: 34,
        el: 16,
        sx: tall ? 0 : -0.3,
        sy: tall ? 0.34 : 0.04,
      };
    });
  }

  const tmp = new THREE.Vector3();
  const corner = new THREE.Vector3();

  function view(a, b, t) {
    const at = a.at.clone().lerp(b.at, t);
    const d = Math.exp(lerp(Math.log(a.d), Math.log(b.d), t));
    const az = lerp(a.az, b.az, t);
    const el = lerp(a.el, b.el, t);
    camera.position.copy(at).addScaledVector(dir(az, el), d);
    camera.up.set(0, 1, 0);
    camera.lookAt(at);
    camera.near = Math.max(1, d - 120);
    camera.far = d + 160;
    camera.updateProjectionMatrix();
    // A lens shift moves the picture without turning the camera.
    camera.projectionMatrix.elements[8] = -lerp(a.sx, b.sx, t);
    camera.projectionMatrix.elements[9] = -lerp(a.sy, b.sy, t);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  // The look of each part at one stop: 1 = render, 0 = blueprint.
  function looks(stop) {
    return parts.map((q) => (stop.focus === undefined ? 1 : FOCUS[stop.focus][0] === q.id ? 1 : 0));
  }

  function partState(q, i, e) {
    const k = clamp(e);
    q.pivot.position.copy(q.home).lerp(q.openAt, smooth(k));
    if (e > 1) {
      const delay = (i % 4) * 0.06;
      const k2 = smooth(clamp((e - 1 - delay) / (1 - 0.18)));
      q.pivot.position.lerp(q.apart, k2);
      q.pivot.quaternion.copy(q.q0).slerp(q.q1, k2);
    } else {
      q.pivot.quaternion.copy(q.q0);
    }
  }

  function screenBox(q) {
    const b = new THREE.Box3().setFromObject(q.pivot);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
      const x = (corner.x * 0.5 + 0.5) * W;
      const y = (-corner.y * 0.5 + 0.5) * H;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, y0, x1, y1 };
  }

  function draw(pos) {
    let i = 0;
    while (i < STOPS.length - 1 && pos > STOPS[i + 1].at) i++;
    const A = STOPS[i];
    const B = STOPS[Math.min(i + 1, STOPS.length - 1)];
    const moveFrom = A.at + A.hold;
    const t = B === A || pos <= moveFrom ? 0 : smooth(clamp((pos - moveFrom) / (B.at - moveFrom)));

    const e = lerp(A.e, B.e, t);
    parts.forEach((q, n) => partState(q, n, e));
    view(views[A.cam], views[B.cam], t);

    const la = looks(A);
    const lb = looks(B);
    parts.forEach((q, n) => {
      const r = lerp(la[n], lb[n], t);
      if (Math.abs(r - q.r) > 0.001 || r === 0 || r === 1) {
        q.r = r;
        setLook(q.look, r);
      }
    });
    shadow.material.opacity = 1 - clamp(e / 1.4);

    // Intro, tags and callouts live outside the 3D scene, so their text stays sharp.
    const introOut = clamp(pos / 0.4);
    intro.style.opacity = (1 - introOut).toFixed(3);
    intro.style.visibility = introOut >= 1 ? "hidden" : "visible";
    cue.style.opacity = (1 - clamp(pos / 0.2)).toFixed(3);
    const tags = clamp((pos - 1.75) / 0.3);
    const active = A.focus !== undefined && t < 0.5 ? A.focus : B.focus !== undefined && t >= 0.5 ? B.focus : -1;
    FOCUS.forEach(([id, name], n) => {
      const q = byId[id];
      const c = callFor[name];
      const sb = screenBox(q);
      let x, y;
      if (n === active) {
        if (tall) {
          x = 16;
          y = clamp(sb.y1 + 14, H * 0.5, H - c.offsetHeight - 16);
        } else {
          x = clamp(sb.x1 + 28, 16, W - c.offsetWidth - 16);
          y = clamp((sb.y0 + sb.y1) / 2 - 40, 70, H - c.offsetHeight - 24);
        }
      } else {
        x = (sb.x0 + sb.x1) / 2 - 30;
        y = sb.y0 - 34;
      }
      c.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
      c.style.opacity = (n === active ? 1 : tags * (active >= 0 ? 0.9 : 0.75)).toFixed(3);
      c.classList.toggle("on", n === active);
    });
    const now = (active >= 0 ? "0" + (active + 1) : "00") + " / 05 · " + (active >= 0 ? FOCUS[active][1] : e < 0.5 ? "closed" : e < 1.5 ? "open" : "apart");
    if (now !== shown) {
      shown = now;
      meter.textContent = now;
    }

    renderer.render(scene, camera);
  }

  function progress() {
    const top = root.getBoundingClientRect().top;
    const room = root.offsetHeight - stageBox.offsetHeight;
    return room > 0 ? clamp(-top / room) * END : 0;
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    last = now;
    const k = 1 - Math.exp(-dt * 8);
    p += (goal - p) * k;
    if (Math.abs(goal - p) < 0.0008) p = goal;
    draw(p);
    if (p !== goal) requestAnimationFrame(tick);
    else running = false;
  }

  function wake() {
    goal = progress();
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function setMode() {
    const flat = still.matches;
    root.classList.toggle("still", flat);
    root.style.height = flat ? "" : (END + 1) * 100 + "svh";
    root.classList.add("ready");
    layout();
    if (flat) {
      // Reduced motion: one drawing of the node fully apart, every part a render, all callouts open.
      draw(STOPS[2].at);
      calls.forEach((c) => {
        c.style.transform = "";
        c.style.opacity = "";
        c.classList.add("on");
      });
      return;
    }
    p = goal = progress();
    draw(p);
  }

  // Draw once with both looks on, so every shader compiles and every buffer uploads before
  // the first scroll.
  layout();
  view(views.apart, views.apart, 0);
  parts.forEach((q) => setLook(q.look, 0.5));
  renderer.render(scene, camera);
  parts.forEach((q) => setLook(q.look, 1));
  setMode();
  window.addEventListener("scroll", () => !still.matches && wake(), { passive: true });
  window.addEventListener("resize", setMode);
  if (still.addEventListener) still.addEventListener("change", setMode);
  root.querySelectorAll(".call .pill").forEach((a, n) => {
    a.addEventListener("click", (ev) => {
      if (still.matches) return;
      ev.preventDefault();
      const stop = STOPS[3 + n];
      const room = root.offsetHeight - stageBox.offsetHeight;
      const top = root.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + ((stop.at + stop.hold / 2) / END) * room, behavior: "smooth" });
    });
  });
}
