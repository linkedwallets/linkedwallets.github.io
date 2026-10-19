// Temporary stand-ins with the sizes of the zone table, for layout work only.
import { THREE, palette, box, mesh } from "./kit.js";
function at(x0, x1, y0, y1, z0, z1, mat) {
  const g = new THREE.Group();
  g.add(mesh(box(x1 - x0, y1 - y0, z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  return g;
}
export const buildSidePanel = (s = 1) => at(s > 0 ? 8.2 : -8.5, s > 0 ? 8.5 : -8.2, 0, 26, -15, 14, palette().alu);
export const buildChassis = () => { const M = palette(); const g = at(-8.2, 8.2, 25.7, 26, -15, 14, M.alu); g.add(at(-8.2, 8.2, 0, 0.3, -15, 14, M.alu)); g.add(at(-8.2, 8.2, 0, 26, -15, -14.7, M.graphite)); g.add(at(-8.2, -7.9, 0.3, 25.7, -14.7, 14, M.graphite)); return g; };
export const buildBezel = () => at(-8.5, 8.5, 0, 26, 14, 15.2, palette().alu);
export const buildPsu = () => at(-6.25, 6.25, 0.3, 6.65, 3, 13, palette().graphite);
export const buildBoard = () => at(-8.5, 8.5, -8.5, 8.5, 0, 0.16, palette().pcb);
export const buildRam = () => { const M = palette(); const g = at(-5.2, -4.8, -4.9, 8.4, 0.6, 3.7, M.graphite); g.add(at(-6.4, -6.0, -4.9, 8.4, 0.6, 3.7, M.graphite)); return g; };
export const buildCooler = () => at(-4.1, 5.1, -2.1, 7.1, 0.75, 6.9, palette().fin);
export const buildCpu = () => at(-1.75, 2.75, 0.25, 4.75, 0.3, 0.75, palette().nickel);
export const buildSsd = () => at(-2, 6, -3.7, -1.5, 0.45, 0.6, palette().pcbBlack);
export const buildKey = () => at(-7.9, -4.9, -8.1, -5.7, 0.16, 1.02, palette().orange);
export const buildNic = () => at(-3.5, 8.6, -8.4, -6.5, 0.55, 8, palette().pcb);
