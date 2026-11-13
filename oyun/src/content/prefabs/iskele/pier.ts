/**
 * İskele pier (static): deck, beams, pilings, railings, bollards, lamps, benches, promenade, park, signs.
 * Ported 1:1 from v2 world.js (read-only reference); geometry, colours and proportions are kept exactly (parity is measured).
 * Port note: parameters are typed loosely (`any`) where v2 passed option bags; behaviour is unchanged.
 */
import * as T from 'three';
import { Batch, mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox } from '../../../engine/prefab/batch';
import { K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex } from '../common/v2kit';
import { WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, local2world as l2w, rectAABB, type Obstacle } from './layout';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
void [mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox, K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex, WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, l2w, rectAABB, V3];
export type { Obstacle };

export const LAMPS: any[] = [];        // { x, y, z } bulb positions (glow pools + halos)
export function railLine(b?: any, x0?: any, z0?: any, x1?: any, z1?: any, skip?: any) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(len / 1.3)), ang = Math.atan2(x1 - x0, z1 - z0);
  for (let i = 0; i <= n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (skip && skip(x, z)) continue; b.box(0.08, 1.0, 0.08, '#f4f1ea', x, 0.5, z, { r: 0.02 }); }
  const seg = (a?: any, c?: any) => { const xa = lerp(x0, x1, a), za = lerp(z0, z1, a), xc = lerp(x0, x1, c), zc = lerp(z0, z1, c), l = Math.hypot(xc - xa, zc - za); if (l < 0.05) return;
    b.box(0.11, 0.09, l, '#4f8fcf', (xa + xc) / 2, 1.0, (za + zc) / 2, { ry: ang, r: 0.035 }); b.box(0.05, 0.05, l, '#f4f1ea', (xa + xc) / 2, 0.52, (za + zc) / 2, { ry: ang, r: 0.02 }); };
  if (!skip) seg(0, 1);
  else { let start = 0, inGap = false; const N = 200; for (let i = 0; i <= N; i++) { const t = i / N, s = skip(lerp(x0, x1, t), lerp(z0, z1, t)); if (s && !inGap) { seg(start, t); inGap = true; } else if (!s && inGap) { start = t; inGap = false; } } if (!inGap) seg(start, 1); }
}
export function lampPost(b?: any, bu?: any, x?: any, z?: any, h = 3.1) {
  b.cyl(0.17, 0.2, 0.42, K.lamp, x, 0.21, z, { seg: 10 }); b.cyl(0.07, 0.09, h - 0.5, K.lamp, x, h / 2, z, { seg: 8 });
  b.tor(0.09, 0.025, K.gold, x, h * 0.62, z, { rx: HP, rs: 4, ts: 10 }); b.cyl(0.1, 0.07, 0.12, K.lamp, x, h - 0.12, z, { seg: 8 });
  b.cyl(0.24, 0.13, 0.08, K.lamp, x, h + 0.02, z, { seg: 4, ry: PI / 4 });
  bu.cyl(0.21, 0.14, 0.42, '#ffffff', x, h + 0.27, z, { seg: 4, ry: PI / 4 });
  b.cone(0.3, 0.26, K.lamp, x, h + 0.6, z, { seg: 4, ry: PI / 4 }); b.sph(0.06, K.lamp, x, h + 0.78, z, { ws: 6, hs: 4 });
  LAMPS.push({ x, y: h + 0.27, z });
}
export function bench(b?: any, x?: any, z?: any, ry?: any) {
  b.push(mtx(x, 0, z, 0, ry, 0));
  [-0.75, 0.75].forEach(lx => { b.box(0.07, 0.45, 0.5, K.lamp, lx, 0.22, 0.02, { r: 0.02 }); b.box(0.07, 0.5, 0.07, K.lamp, lx, 0.62, -0.24, { rx: -0.12, r: 0.02 }); });
  for (let i = 0; i < 3; i++) b.box(1.8, 0.05, 0.13, '#c98a52', 0, 0.46, 0.15 - i * 0.15, { r: 0.02 });
  for (let i = 0; i < 2; i++) b.box(1.8, 0.12, 0.05, '#c98a52', 0, 0.68 + i * 0.17, -0.27 - i * 0.02, { rx: -0.12, r: 0.02 });
  b.pop();
}
export function tree(b?: any, x?: any, z?: any, s = 1) {
  b.cyl(0.62, 0.66, 0.42, '#bdb3a5', x, 0.21, z, { seg: 14 }); b.cyl(0.55, 0.55, 0.05, '#6b5040', x, 0.42, z, { seg: 14 });
  b.cyl(0.11 * s, 0.16 * s, 2.3 * s, '#8a6a4f', x, 1.15 * s, z, { seg: 7 });
  const cs = [[0, 2.7, 0, 1.25], [0.6, 2.4, 0.3, 0.9], [-0.55, 2.5, -0.2, 0.95], [0.1, 3.3, -0.1, 0.85]];
  cs.forEach(([a, y, c, r0], i) => b.ico(r0 * s, i % 2 ? '#7fae5e' : '#6f9e4f', x + a * s, y * s, z + c * s, { d: 1 }));
}
export function buildPier() {
  LAMPS.length = 0;
  const A = new Batch(), P = new Batch(), S = new Batch(), BU = new Batch(), F = new Batch();
  const pilings: any[] = [];
  // far scenery goes into F (no shadow casting, keeps the shadow pass light)
  const near = (x: any) => Math.abs(x) > 16 ? F : A;
  // deck (planks) with a darker fascia
  P.span(PIER.x0, PIER.x1, -0.32, 0, PIER.z0, PIER.z1, '#ffffff', { r: 0, world: 4 });
  A.span(PIER.x0 - 0.06, PIER.x1 + 0.06, -0.5, -0.18, PIER.z0 - 0.06, PIER.z1 - 0.02, '#8a6242', { r: 0.03 });
  // edge beams (kickboards)
  A.span(PIER.x0, PIER.x0 + 0.16, 0, 0.07, PIER.z0, PIER.z1, '#9a6e48', { r: 0.02 });
  A.span(PIER.x1 - 0.16, PIER.x1, 0, 0.07, PIER.z0, PIER.z1, '#9a6e48', { r: 0.02 });
  A.span(PIER.x0, PIER.x1, 0, 0.07, PIER.z0, PIER.z0 + 0.16, '#9a6e48', { r: 0.02 });
  // pilings with a dark wet band at the waterline
  const pile = (x?: any, z?: any) => { pilings.push({ x, z }); A.cyl(0.22, 0.24, 3.0, '#6e4c33', x, -1.9, z, { seg: 10 }); A.cyl(0.25, 0.25, 0.32, '#4d5638', x, WATER_Y + 0.05, z, { seg: 10 }); };
  for (let z = PIER.z0 + 0.3; z <= PIER.z1 - 0.5; z += 2.6) { pile(PIER.x0 + 0.1, z); pile(PIER.x1 - 0.1, z); }
  for (let x = PIER.x0 + 2.7; x < PIER.x1 - 1; x += 2.6) pile(x, PIER.z0 + 0.1);
  // railings (gap for the ferry gangway on the east side)
  railLine(A, PIER.x0 + 0.1, PIER.z1 - 0.2, PIER.x0 + 0.1, PIER.z0 + 0.1);
  railLine(A, PIER.x0 + 0.1, PIER.z0 + 0.1, PIER.x1 - 0.1, PIER.z0 + 0.1);
  railLine(A, PIER.x1 - 0.1, PIER.z0 + 0.1, PIER.x1 - 0.1, PIER.z1 - 0.2, (x: number, z: number) => z > GANG.z0 && z < GANG.z1);
  // bollards (babalar) and rope coils
  const bollard = (x?: any, z?: any) => { A.lathe([[0, 0], [0.22, 0], [0.2, 0.08], [0.14, 0.14], [0.13, 0.38], [0.21, 0.44], [0.22, 0.5], [0.14, 0.56], [0, 0.57]], '#33373b', x, 0, z, { seg: 12 }); };
  [[22.05, -8.55], [22.05, -5.65], [21.9, -12.85], [-23.45, -17.5]].forEach(([x, z]) => bollard(x, z));
  [[21.65, -9.2], [-23.0, -17.0]].forEach(([x, z]) => { for (let k = 0; k < 3; k++) A.tor(0.26 - k * 0.04, 0.045, '#d8c39a', x, 0.05 + k * 0.08, z, { rx: HP, rs: 5, ts: 16 }); });
  // lamps
  [[-10.05, -10.6], [-10.05, -4.2], [-10.05, 2.2], [8.0, -11.4], [8.0, -3.4], [8.0, 2.4]].forEach(([x, z]) => lampPost(A, BU, x, z));
  // benches on the pier
  BENCHES.forEach(bn => bench(A, bn.pos.x, bn.pos.z, bn.rotY));
  // pier name board and the ferry timetable
  A.push(mtx(-8.9, 0, 3.75, 0, 0.35, 0));
  [-1.0, 1.0].forEach(lx => A.box(0.1, 2.6, 0.1, K.lamp, lx, 1.3, 0, { r: 0.03 }));
  A.box(2.3, 0.62, 0.08, '#1d5fa8', 0, 2.3, 0, { r: 0.03 }); A.label(2.2, 0.55, R.pierName, 0, 2.3, 0.045);
  A.pop();
  A.push(mtx(22.05, 0, -4.4, 0, -0.25, 0)); A.box(0.08, 1.5, 0.08, K.lamp, 0, 0.75, 0, { r: 0.02 }); A.box(0.7, 0.55, 0.05, '#1d5fa8', 0, 1.65, 0, { r: 0.02 }); A.label(0.66, 0.5, R.timetable, 0, 1.65, 0.03); A.pop();
  // life rings on the railing, a fisherman's bucket, planters
  [[-23.8, -1.0, HP], [-1.0, -17.8, 0], [22.52, -10.2, -HP]].forEach(([x, z, ry]) => { A.push(mtx(x, 0.62, z, 0, ry, 0)); for (let k = 0; k < 8; k++) A.tor(0.26, 0.07, k % 2 ? '#fbfaf6' : '#e0533c', 0, 0, 0.05, { arc: TAU / 8, rz: k * TAU / 8, rs: 6, ts: 3 }); A.pop(); });
  A.cyl(0.18, 0.15, 0.3, '#2f6fdb', -1.6, 0.15, -12.9, { seg: 10 }); A.cyl(0.015, 0.015, 2.2, '#7d5638', -1.4, 1.0, -13.0, { rx: -0.45, seg: 4 }); A.cyl(0.015, 0.015, 2.2, '#5a3d28', -1.8, 1.0, -13.0, { rx: -0.5, rz: 0.2, seg: 4 });
  // "Yakında: Vapur Büfesi" sign at the pier end (next venue teaser)
  A.push(mtx(NEXT_SIGN.x, 0, NEXT_SIGN.z, 0, NEXT_SIGN.ry, 0));
  [-0.9, 0.9].forEach(lx => A.box(0.1, 2.2, 0.1, '#7d5638', lx, 1.1, 0, { r: 0.03, uv: R.grain }));
  A.box(2.2, 1.14, 0.08, '#7d5638', 0, 1.62, 0, { r: 0.03 }); A.label(2.08, 1.02, R.soon, 0, 1.62, 0.045);
  A.box(2.3, 0.08, 0.2, '#e0533c', 0, 2.24, 0, { r: 0.03 });
  A.pop();
  [[-9.75, 3.75], [22.0, 3.75]].forEach(([x, z]) => { A.box(1.1, 0.5, 0.55, '#a8774f', x, 0.25, z, { r: 0.04 }); for (let k = 0; k < 5; k++) A.ico(0.22, k % 2 ? '#6f9e4f' : '#7fae5e', x - 0.4 + k * 0.2, 0.6, z, { d: 0 }); [-0.3, 0, 0.3].forEach((dx, k) => A.sph(0.09, ['#e0533c', '#f2a2b3', '#ffd23f'][k], x + dx, 0.78, z + 0.05, { ws: 6, hs: 4 })); });
  // promenade: stone pavement, sea wall, railing, lamps, benches, trees, grass beyond
  S.span(-80, 80, -0.32, 0, PIER.z1, 13.5, '#ffffff', { r: 0, world: 4 });
  A.span(-80, PIER.x0, -1.6, -0.3, PIER.z1, PIER.z1 + 0.5, '#a9a094', { r: 0 }); A.span(PIER.x1, 80, -1.6, -0.3, PIER.z1, PIER.z1 + 0.5, '#a9a094', { r: 0 });
  A.span(-80, PIER.x0, -0.06, 0.06, PIER.z1 + 0.02, PIER.z1 + 0.42, '#e2dbd0', { r: 0.02 }); A.span(PIER.x1, 80, -0.06, 0.06, PIER.z1 + 0.02, PIER.z1 + 0.42, '#e2dbd0', { r: 0.02 });
  railLine(A, -62, PIER.z1 + 0.22, PIER.x0 - 0.2, PIER.z1 + 0.22); railLine(A, PIER.x1 + 0.2, PIER.z1 + 0.22, 62, PIER.z1 + 0.22);
  A.span(-80, 80, -0.3, 0.12, 13.5, 14.0, '#bdb3a5', { r: 0.03 });
  F.span(-80, 80, -0.3, 0.05, 14.0, 62, '#9cc47a', { r: 0 });
  // the far side of the road is built by content/zones/karsi.ts
  for (let x = -58; x <= 58; x += 10) if (x < PIER.x0 - 1 || x > PIER.x1 + 1) lampPost(near(x), BU, x, 5.05);
  [-50, -40, -30, -20, -12, 12, 21, 31, 41, 51].forEach((x, i) => { if (i % 2) bench(near(x), x, 5.95, PI); });
  [[-14, 9.6], [12.5, 9.6]].forEach(([x, z]) => { A.box(2.2, 0.35, 1.0, '#bdb3a5', x, 0.17, z, { r: 0.05 }); for (let k = 0; k < 8; k++) A.ico(0.2, ['#e0533c', '#f2a2b3', '#ffd23f', '#ffffff'][k % 4], x - 0.85 + k * 0.24, 0.42, z + (k % 2 ? 0.2 : -0.2), { d: 0 }); });
  return { A, P, S, BU, F, pilings };
}
