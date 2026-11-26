/**
 * 2026-11-26 user: "arsa var ama alıyosun para veriyosun arsa nerde? ev yapılıyo sözde üstüne ev nerde? inşaat ya da tadilat
 * sürecinde olan her yerde çalışan makineler, araçlar ya da ustalar olmalı, büyüklüğüne göre projenin. Hayattan örnek al."
 *
 * Martı Evleri lot site (plot-local frame: x along the facade, +z towards the street, fence at ±3.1 / ±2.3) and the
 * Martı Emlak office. The build runs the way a real one does, phase by phase with the progress k (0..1):
 *   hafriyat (k < .3)  dirt pit; dükkân: mini excavator digging + dump truck; ev: dug by hand (ustalar) + el arabası
 *   temel + kolon     concrete slab, columns rising with rebar; dükkân: transmixer pouring at the kerb; ev: small drum mixer
 *   duvar (k > .55)   brick walls rising behind a scaffold; dükkân: truck crane lifting pallets over the fence
 *   çatı (k > .88)    roof goes on; scaffold comes down at the end
 * Büyütme ('yuk', an existing shop being enlarged): scaffold on the front and a truck crane, longer boom from level 3.
 * The ustalar are real actors (sim/agents/isletme-insaat.ts); nothing here is a worker prop.
 */
import * as T from 'three';
import { Batch, clamp } from '../../../engine/prefab/batch';

export type ProjeTur = 'ev' | 'dukkan' | 'yuk';
export interface Santiye { g: T.Group; update(k: number, t: number): void; dispose(): void }

let mat: T.MeshStandardMaterial | null = null;
const solid = () => mat || (mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.06 }));
const STEEL = '#aeb6c0', YEL = '#f2b632', DARK = '#2e3238', TYRE = '#1f2226', GLASS = '#9fc7d8', CONC = '#b9b6ae', BRICK = '#b6603f', DIRT = '#7a5a3c';
/** street parking spot (plot local): kerb side, shifted along the facade so facing lots never park nose to nose */
const PARK = { x: 1.3, z: 3.35 };

const wheels = (b: Batch, xs: number[], w: number, r = 0.42) => { for (const x of xs) for (const s of [-1, 1]) { b.cyl(r, r, 0.3, TYRE, x, r, s * w / 2, { rx: Math.PI / 2, seg: 12 }); b.cyl(r * 0.5, r * 0.5, 0.32, '#9aa1aa', x, r, s * w / 2, { rx: Math.PI / 2, seg: 8 }); } };
/** truck cab at +x end of a chassis; the windscreen faces +x */
const cab = (b: Batch, x: number, c: string, w = 1.9) => {
  b.box(1.5, 1.45, w, c, x, 1.4, 0); b.box(1.52, 0.55, w - 0.2, GLASS, x + 0.05, 1.75, 0); b.box(0.06, 0.5, w - 0.3, GLASS, x + 0.76, 1.72, 0);
  b.box(0.2, 0.3, w, DARK, x + 0.8, 0.75, 0); for (const s of [-1, 1]) b.box(0.1, 0.12, 0.25, '#fff4c2', x + 0.82, 0.95, s * (w / 2 - 0.25));
};
const add = (g: T.Object3D, b: Batch) => { const m = b.mesh(solid()); g.add(m); return m; };

/** mini excavator: tracks + slewing house + boom/stick/bucket; returns the animated joints */
function kepce(g: T.Group, x: number, z: number, ry: number) {
  const root = new T.Group(); root.position.set(x, 0, z); root.rotation.y = ry; g.add(root);
  const base = new Batch(); for (const s of [-1, 1]) { base.box(2.1, 0.42, 0.42, TYRE, 0, 0.24, s * 0.62); base.box(1.9, 0.08, 0.3, '#4a4f56', 0, 0.48, s * 0.62); } base.box(0.9, 0.25, 0.9, DARK, 0, 0.55, 0); base.box(0.3, 0.3, 1.5, YEL, 1.15, 0.22, 0);   // dozer blade
  add(root, base);
  const house = new T.Group(); house.position.y = 0.68; root.add(house);
  const hb = new Batch(); hb.box(1.5, 0.55, 1.35, YEL, -0.1, 0.3, 0); hb.box(0.5, 0.45, 1.3, DARK, -0.85, 0.3, 0);
  hb.box(0.8, 1.05, 0.75, YEL, 0.15, 1.05, -0.28); hb.box(0.82, 0.7, 0.62, GLASS, 0.17, 1.2, -0.28); hb.box(0.86, 0.06, 0.8, DARK, 0.15, 1.6, -0.28); add(house, hb);
  const boom = new T.Group(); boom.position.set(0.55, 0.55, 0.32); house.add(boom);
  const bb = new Batch(); bb.box(1.9, 0.22, 0.2, YEL, 0.95, 0, 0); bb.cyl(0.05, 0.05, 1.2, STEEL, 0.6, 0.18, 0, { rz: Math.PI / 2 }); add(boom, bb);
  const stick = new T.Group(); stick.position.set(1.85, 0, 0); boom.add(stick);
  const sb = new Batch(); sb.box(0.16, 1.3, 0.16, YEL, 0, -0.6, 0); add(stick, sb);
  const bucket = new T.Group(); bucket.position.set(0, -1.25, 0); stick.add(bucket);
  const kb = new Batch(); kb.box(0.45, 0.35, 0.5, DARK, 0.15, -0.1, 0); for (const s of [-1, 0, 1]) kb.box(0.08, 0.12, 0.06, '#ccd0d4', 0.35, -0.3, s * 0.18); add(bucket, kb);
  return (t: number) => { const c = Math.sin(t * 0.7); house.rotation.y = 0.5 * c; boom.rotation.z = 0.35 + 0.3 * Math.sin(t * 1.4); stick.rotation.z = -0.5 + 0.45 * Math.sin(t * 1.4 + 1.1); bucket.rotation.z = 0.4 * Math.sin(t * 1.4 + 2); };
}

/** vehicles at the kerb, long axis along the facade (x), cab towards +x */
function kamyonet(g: T.Group, yuk: 'tugla' | 'toprak') {
  const b = new Batch(), x0 = PARK.x, z0 = PARK.z;
  b.at(x0, 0, z0);
  b.box(4.0, 0.35, 1.8, DARK, 0, 0.62, 0); cab(b, 1.15, '#e9e4d8', 1.8);
  b.box(2.3, 0.6, 1.8, '#3c6e8f', -0.85, 1.05, 0); b.box(2.2, 0.08, 1.6, '#2a4c63', -0.85, 0.82, 0);
  if (yuk === 'tugla') for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) b.box(0.6, 0.35, 0.6, BRICK, -1.55 + i * 0.68, 1.05 + j * 0.36, 0.0 + (i % 2 ? 0.3 : -0.3));
  else b.ico(0.95, DIRT, -0.85, 1.15, 0, { sy: 0.45, sx: 1.2 } );
  wheels(b, [1.2, -1.3], 1.75);
  add(g, b);
}
function mikserKamyon(g: T.Group) {
  const b = new Batch(); b.at(PARK.x, 0, PARK.z);
  b.box(5.0, 0.4, 2.0, DARK, 0, 0.66, 0); cab(b, 1.75, '#e8e3d6');
  b.box(0.3, 1.4, 1.6, '#5b6068', 0.75, 1.5, 0); b.box(0.9, 0.12, 0.35, STEEL, -2.55, 1.05, 0.7, { ry: 0.6, rz: -0.35 });   // chute to the lot side
  wheels(b, [1.8, -0.9, -1.85], 1.95);
  add(g, b);
  const drum = new T.Group(); drum.position.set(PARK.x - 0.95, 1.95, PARK.z); drum.rotation.z = 0.22; g.add(drum);
  const db = new Batch(); db.lathe([[0.05, -1.7], [0.6, -1.35], [0.95, -0.4], [0.95, 0.4], [0.7, 1.2], [0.3, 1.6]], '#f1efe9', 0, 0, 0, { rz: Math.PI / 2, seg: 14 });
  for (let i = 0; i < 4; i++) db.box(2.4, 0.08, 0.12, '#e0533c', 0, Math.cos(i * 1.57) * 0.9, Math.sin(i * 1.57) * 0.9, { rx: i * 1.57, ry: 0.35 });
  add(drum, db);
  return (t: number) => { drum.rotation.x = t * 1.6; };
}
function damper(g: T.Group) {
  const b = new Batch(); b.at(PARK.x, 0, PARK.z);
  b.box(4.8, 0.4, 2.0, DARK, 0, 0.66, 0); cab(b, 1.7, '#d9473a');
  b.box(3.0, 1.0, 2.0, '#d9473a', -0.9, 1.4, 0); b.box(2.9, 0.1, 1.85, '#9e2f25', -0.9, 0.95, 0); b.ico(0.95, DIRT, -0.9, 1.8, 0, { sy: 0.4, sx: 1.4 } );
  wheels(b, [1.75, -0.9, -1.8], 1.95); add(g, b);
}
/** truck crane: turntable at the rear, boom swings over the lot (towards -z), hook lifts a pallet */
function vincKamyon(g: T.Group, boomL: number, yukT: 'tugla' | 'kiris') {
  const b = new Batch(); b.at(PARK.x, 0, PARK.z);
  b.box(5.4, 0.45, 2.1, '#4a4f56', 0, 0.7, 0); cab(b, 1.95, '#f0b429', 2.1);
  for (const sx of [-2.3, 1.0]) for (const s of [-1, 1]) { b.box(0.15, 0.12, 0.9, STEEL, sx, 0.75, s * 1.4); b.box(0.35, 0.08, 0.35, DARK, sx, 0.05, s * 1.85); b.box(0.12, 0.7, 0.12, STEEL, sx, 0.4, s * 1.85); }   // outriggers down
  wheels(b, [2.0, -0.6, -1.7], 2.05); add(g, b);
  const turn = new T.Group(); turn.position.set(PARK.x - 1.4, 1.0, PARK.z); g.add(turn);
  const tb = new Batch(); tb.cyl(0.75, 0.8, 0.35, DARK, 0, 0.15, 0, { seg: 16 }); tb.box(1.6, 0.9, 1.3, '#f0b429', -0.2, 0.75, 0.0); tb.box(0.7, 0.75, 0.65, GLASS, 0.35, 0.8, 0.45); add(turn, tb);
  const boom = new T.Group(); boom.position.set(0.2, 1.1, 0); turn.add(boom);
  const bb = new Batch(); bb.box(boomL, 0.38, 0.38, '#f0b429', boomL / 2, 0, 0); bb.box(boomL * 0.55, 0.26, 0.26, '#d89a1c', boomL * 0.72, 0.02, 0); bb.box(0.3, 0.3, 0.45, DARK, boomL, -0.05, 0); add(boom, bb);
  const cable = new T.Mesh(new T.BoxGeometry(0.03, 1, 0.03), new T.MeshLambertMaterial({ color: '#222' })); g.add(cable);
  const load = new T.Group(); g.add(load);
  const lb = new Batch(); lb.box(1.1, 0.12, 1.0, '#8a6a4a', 0, -0.06, 0);
  if (yukT === 'tugla') for (let i = 0; i < 2; i++) lb.box(1.0, 0.32, 0.9, BRICK, 0, 0.17 + i * 0.33, 0); else for (let i = 0; i < 3; i++) lb.box(1.6, 0.14, 0.18, STEEL, 0, 0.08 + i * 0.15, (i - 1) * 0.25);
  add(load, lb);
  const tip = new T.Vector3(), w = new T.Vector3();
  return (t: number) => {
    turn.rotation.y = -Math.PI / 2 - 0.55 + Math.sin(t * 0.22) * 0.75;   // swing over the fence into the lot
    boom.rotation.z = 0.62 + Math.sin(t * 0.17) * 0.08;
    boom.updateWorldMatrix(true, false); tip.set(boomL, -0.1, 0); boom.localToWorld(tip); g.worldToLocal(tip);
    const L = Math.max(1.2, tip.y - (1.4 + 1.2 * (0.5 + 0.5 * Math.sin(t * 0.5))));
    cable.position.set(tip.x, tip.y - L / 2, tip.z); cable.scale.y = L; load.position.set(tip.x, tip.y - L - 0.05, tip.z); load.rotation.y = Math.sin(t * 0.6) * 0.3; void w;
  };
}
function elArabasi(b: Batch, x: number, z: number, ry: number) {
  b.push(new T.Matrix4().makeRotationY(ry).setPosition(x, 0, z));
  b.box(0.9, 0.32, 0.6, '#2f7d4f', 0, 0.55, 0); b.box(0.8, 0.12, 0.5, '#7a5a3c', 0, 0.7, 0); b.cyl(0.18, 0.18, 0.08, TYRE, 0.55, 0.18, 0, { rx: Math.PI / 2 });
  for (const s of [-1, 1]) { b.box(0.9, 0.05, 0.05, '#555', -0.45, 0.6, s * 0.22, { rz: 0.25 }); b.box(0.05, 0.38, 0.05, '#555', -0.3, 0.2, s * 0.2); }
  b.pop();
}
function betoniyer(g: T.Group, x: number, z: number) {
  const b = new Batch(); b.box(0.7, 0.08, 0.06, '#555', x, 0.45, z - 0.3); b.box(0.7, 0.08, 0.06, '#555', x, 0.45, z + 0.3); for (const s of [-1, 1]) b.box(0.06, 0.9, 0.06, '#555', x + s * 0.3, 0.45, z); b.cyl(0.24, 0.24, 0.08, TYRE, x - 0.4, 0.24, z, { rx: Math.PI / 2 }); add(g, b);
  const drum = new T.Group(); drum.position.set(x, 1.05, z); drum.rotation.z = 0.7; g.add(drum);
  const db = new Batch(); db.lathe([[0.05, -0.45], [0.42, -0.25], [0.45, 0.1], [0.25, 0.45]], '#e0533c', 0, 0, 0, { seg: 12 }); add(drum, db);
  return (t: number) => { drum.rotation.y = t * 2.4; };
}

export function buildSantiye(tur: ProjeTur, lv: number, renk = '#c9a23a'): Santiye {
  const g = new T.Group(); g.name = 'santiye-' + tur;
  const anims: ((t: number) => void)[] = [];
  const st = new Batch();
  const big = tur === 'dukkan', W = big ? 5.0 : 4.2, D = big ? 3.2 : 3.0, cz = big ? -0.5 : -0.25, H = big ? 2.9 : 2.6;
  // site board on the front fence + barrier lamps at the gate (both kinds)
  st.box(0.08, 1.6, 0.08, '#7d5638', -2.4, 0.8, 2.35); st.box(1.5, 0.75, 0.06, '#ffd23f', -2.4, 1.85, 2.4); st.box(1.3, 0.12, 0.07, DARK, -2.4, 1.98, 2.42); st.box(1.0, 0.08, 0.07, DARK, -2.4, 1.72, 2.42);
  for (const s of [-1, 1]) st.cone(0.18, 0.5, '#ff7a1a', s * 0.6 + 0.4, 0.25, 2.75, { seg: 8 });
  const parts: { o: T.Object3D; f(k: number): void }[] = [];
  const part = (b: Batch, f: (o: T.Object3D, k: number) => void) => { const o = new T.Group(); o.add(b.mesh(solid())); g.add(o); parts.push({ o, f: k => f(o, k) }); return o; };

  if (tur !== 'yuk') {
    // hafriyat: dug pit + spoil heap
    const pit = new Batch(); pit.box(W + 0.4, 0.06, D + 0.4, '#5a4330', 0, 0.04, cz); pit.ico(0.9, DIRT, 2.35, 0.25, -1.6, { sy: 0.45 } ); pit.ico(0.6, '#86654a', 2.0, 0.2, -1.95, { sy: 0.5 } );
    part(pit, (o, k) => { o.visible = k < 0.6; });
    // temel: slab with formwork edge
    const slab = new Batch(); slab.box(W, 0.28, D, CONC, 0, 0.14, cz); for (const s of [-1, 1]) slab.box(W + 0.1, 0.32, 0.06, '#c79a5e', 0, 0.16, cz + s * (D / 2 + 0.03));
    part(slab, (o, k) => { o.visible = k >= 0.28; });
    // kolon: columns rising with rebar on top
    const colB = new Batch(), cx = [-W / 2 + 0.15, 0, W / 2 - 0.15], czs = [cz - D / 2 + 0.15, cz + D / 2 - 0.15];
    for (const x of cx) for (const z of czs) { colB.box(0.28, 1, 0.28, CONC, x, 0.5, z); for (const dx of [-0.08, 0.08]) colB.box(0.03, 0.25, 0.03, '#6b3b22', x + dx, 1.12, z); }
    part(colB, (o, k) => { const p = clamp((k - 0.3) / 0.25, 0, 1); o.visible = p > 0; o.scale.y = Math.max(0.01, p * H); o.position.y = 0.28; });
    // duvar: brick walls (door + windows in front) rising behind the columns
    const wall = new Batch(), ft = cz + D / 2 - 0.12, bk = cz - D / 2 + 0.12;
    wall.box(W - 0.3, 1, 0.2, BRICK, 0, 0.5, bk); for (const s of [-1, 1]) wall.box(0.2, 1, D - 0.3, BRICK, s * (W / 2 - 0.12), 0.5, cz);
    wall.box(W * 0.28, 1, 0.2, BRICK, -W * 0.36, 0.5, ft); wall.box(W * 0.28, 1, 0.2, BRICK, W * 0.36, 0.5, ft); wall.box(W * 0.44, 0.3, 0.2, BRICK, 0, 0.85, ft);   // door/shop opening
    part(wall, (o, k) => { const p = clamp((k - 0.55) / 0.33, 0, 1); o.visible = p > 0; o.scale.y = Math.max(0.01, p * H); o.position.y = 0.28; });
    // çatı
    const roof = new Batch();
    if (big) { roof.box(W + 0.3, 0.25, D + 0.3, CONC, 0, H + 0.4, cz); roof.box(W + 0.4, 0.12, 0.12, renk, 0, H + 0.58, cz + D / 2 + 0.12); }
    else roof.cone(3.3, 1.3, '#b8553a', 0, H + 0.95, cz, { seg: 4, ry: Math.PI / 4, sz: 0.78 });
    part(roof, (o, k) => { const p = clamp((k - 0.88) / 0.12, 0, 1); o.visible = p > 0; o.scale.setScalar(Math.max(0.01, 0.6 + 0.4 * p)); });
  }
  // scaffold on the front (and along the back for a new building): poles, decks, red/white rails
  {
    const sc = new Batch(), fz = tur === 'yuk' ? 1.75 : (big ? 1.45 : 1.6), x0 = -2.75, x1 = 2.75, SH = tur === 'yuk' ? 4.2 : 3.6;
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 4) for (const z of [fz, fz + 0.7]) sc.box(0.06, SH, 0.06, STEEL, x, SH / 2, z);
    for (const y of [1.3, 2.5, SH - 0.1]) { sc.box(x1 - x0, 0.06, 0.75, '#a8794e', 0, y, fz + 0.35); sc.box(x1 - x0, 0.05, 0.05, '#e0533c', 0, y + 0.55, fz + 0.7); sc.box(x1 - x0, 0.05, 0.05, '#f4f2ec', 0, y + 0.95, fz + 0.7); }
    for (let i = 0; i < 4; i++) { const a = x0 + i * (x1 - x0) / 4, c = a + (x1 - x0) / 4; sc.box(Math.hypot(c - a, 2.4), 0.04, 0.04, STEEL, (a + c) / 2, 1.9, fz + 0.72, { rz: Math.atan2(2.4, c - a) * (i % 2 ? -1 : 1) }); }
    if (tur === 'yuk') sc.box(x1 - x0, 1.6, 0.03, '#2f7d4f', 0, SH - 0.7, fz + 0.75);   // dust net on the top deck
    part(sc, (o, k) => { o.visible = tur === 'yuk' ? true : k > 0.45 && k < 0.97; });
  }
  // material yard by the pile (ustalar fetch from here): planks, cement bags, brick pallet
  for (let i = 0; i < 3; i++) st.box(1.3, 0.1, 0.4, i % 2 ? '#a8794e' : '#9c6f46', -2.35, 0.08 + i * 0.1, 1.1, { ry: Math.PI / 2 });
  for (let i = 0; i < 3; i++) st.box(0.45, 0.16, 0.3, '#d8d3c6', -2.5 + (i % 2) * 0.05, 0.09 + i * 0.15, -1.2, { ry: i * 0.3 });
  st.box(0.9, 0.1, 0.8, '#8a6a4a', -2.45, 0.05, -0.2); for (let i = 0; i < 2; i++) st.box(0.8, 0.28, 0.7, BRICK, -2.45, 0.24 + i * 0.29, -0.2);
  if (tur === 'ev') { elArabasi(st, 2.55, -1.55, 0.6); anims.push(betoniyer(g, 2.5, 1.45)); }
  add(g, st);

  // vehicles by phase: one at the kerb at a time, like a real narrow street
  const veh: { o: T.Group; on(k: number): boolean; a?: (t: number) => void }[] = [];
  const v = (on: (k: number) => boolean, mk: (o: T.Group) => ((t: number) => void) | void) => { const o = new T.Group(); g.add(o); const a = mk(o) || undefined; veh.push({ o, on, a }); };
  if (tur === 'ev') v(() => true, o => kamyonet(o, 'tugla'));
  else if (tur === 'dukkan') {
    v(k => k < 0.3, o => { damper(o); return kepce(o, 0.4, cz + 0.1, 0.15) as never; });
    v(k => k >= 0.3 && k < 0.58, o => mikserKamyon(o));
    v(k => k >= 0.58, o => vincKamyon(o, 7.5, 'tugla'));
  } else v(() => true, o => vincKamyon(o, lv >= 3 ? 9.5 : 7.5, 'kiris'));
  // the excavator lives inside the lot during hafriyat, the dump truck at the kerb: the first vehicle group holds both
  let lastK = -1;
  return {
    g,
    update(k, t) {
      if (Math.abs(k - lastK) > 0.004) { lastK = k; for (const p of parts) p.f(k); }
      for (const x of veh) { const on = x.on(k); if (x.o.visible !== on) x.o.visible = on; if (on && x.a) x.a(t); }
      for (const a of anims) a(t);
    },
    dispose() { g.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); if (m.material !== mat) (m.material as T.Material).dispose(); } }); g.removeFromParent(); },
  };
}

/** footprint of what blocks the hero at a site (plot local): the fenced lot plus the vehicle at the kerb */
export const SANTIYE_KATI = { lot: { x0: -3.15, x1: 3.15, z0: -2.35, z1: 2.35 }, arac: { x0: PARK.x - 2.8, x1: PARK.x + 2.8, z0: PARK.z - 1.1, z1: PARK.z + 1.1 } };

/* ---- Martı Emlak office (door towards -z world; built in a frame whose +z is the street front) ---- */
function tabela(ad: string): T.CanvasTexture {
  const w = 768, h = 160, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.fillStyle = '#1f5f5b'; x.fillRect(0, 0, w, h); x.fillStyle = '#e9c46a'; x.fillRect(0, h - 14, w, 14);
  x.fillStyle = '#fbf6ea'; x.font = '800 78px system-ui,"Segoe UI",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ad.toLocaleUpperCase('tr-TR'), w / 2 + 34, h / 2 - 4);
  x.strokeStyle = '#fbf6ea'; x.lineWidth = 9; x.beginPath(); x.moveTo(52, 92); x.lineTo(92, 56); x.lineTo(132, 92); x.stroke(); x.fillStyle = '#e9c46a'; x.fillRect(74, 88, 36, 34);   // little house mark
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
function ilanTex(): T.CanvasTexture {
  const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
  x.fillStyle = '#dfeef2'; x.fillRect(0, 0, w, h);
  const kart = (px: number, py: number, renk: string, yazi: string) => { x.fillStyle = '#fffdf6'; x.fillRect(px, py, 108, 104); x.fillStyle = renk; x.fillRect(px, py, 108, 26); x.fillStyle = '#fff'; x.font = '700 17px system-ui,sans-serif'; x.textAlign = 'center'; x.fillText(yazi, px + 54, py + 19); x.fillStyle = '#c9d6c0'; x.fillRect(px + 10, py + 34, 88, 40); x.fillStyle = '#7a8a90'; x.fillRect(px + 10, py + 80, 60, 6); x.fillRect(px + 10, py + 90, 76, 6); };
  [['#d9473a', 'SATILIK'], ['#1f5f5b', 'KİRALIK'], ['#d9473a', 'SATILIK'], ['#e0a32e', 'ARSA']].forEach(([r, y], i) => kart(14 + i * 124, 18, r, y));
  [['#e0a32e', 'ARSA'], ['#d9473a', 'SATILIK'], ['#1f5f5b', 'DÜKKÂN'], ['#1f5f5b', 'KİRALIK']].forEach(([r, y], i) => kart(14 + i * 124, 134, r, y));
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
export function buildEmlakOfis(ad: string, w: number, d: number): { g: T.Group; dispose(): void; night(n: number): void } {
  const g = new T.Group(); g.name = 'marti-emlak';
  const b = new Batch(), H = 3.5, F = d / 2;
  b.box(w + 0.6, 0.18, d + 1.4, '#c9c1b0', 0, 0.09, 0.35);                         // paved apron
  b.box(w, H, d, '#efe4cc', 0, H / 2 + 0.18, 0);                                   // body
  b.box(w + 0.3, 0.3, d + 0.3, '#7b5b43', 0, H + 0.33, 0); b.box(w + 0.1, 0.5, d + 0.1, '#e7dcc3', 0, H + 0.7, 0);   // cornice + parapet
  for (const s of [-1, 1]) b.box(0.35, H, 0.12, '#d9cdb2', s * (w / 2 - 0.18), H / 2 + 0.18, F + 0.06);
  b.box(w - 0.4, 0.18, 0.14, '#7b5b43', 0, 0.36, F + 0.08);                       // shop-front sill
  b.box(1.15, 2.25, 0.08, '#24403e', 1.85, 1.32, F + 0.05); b.box(0.9, 1.6, 0.04, GLASS, 1.85, 1.5, F + 0.1); b.box(0.06, 0.25, 0.08, '#e9c46a', 1.55, 1.25, F + 0.14);   // door
  for (let i = 0; i < 5; i++) b.box(w * 0.98 / 5, 0.1, 1.25, i % 2 ? '#fbf6ea' : '#1f5f5b', -w / 2 + w / 10 + i * w / 5, 2.75, F + 0.6, { rx: 0.3 });   // awning
  for (const s of [-1, 1]) { b.cyl(0.32, 0.26, 0.55, '#a65a3a', s * (w / 2 - 0.15) + (s > 0 ? -0.0 : 0), 0.46, F + 0.65, { seg: 10 }); b.ico(0.42, '#4f8a4a', s * (w / 2 - 0.15), 1.0, F + 0.65); }
  // sandwich board "ARSALAR / EVLER" at the kerb
  b.box(0.75, 1.0, 0.06, '#1f5f5b', -0.6, 0.6, F + 1.6, { rx: -0.18 }); b.box(0.75, 1.0, 0.06, '#1f5f5b', -0.6, 0.6, F + 1.9, { rx: 0.18 }); b.box(0.6, 0.3, 0.07, '#fbf6ea', -0.6, 0.8, F + 1.56, { rx: -0.18 });
  b.box(3.55, 0.08, 0.1, '#24403e', -0.85, 2.33, F + 0.07); b.box(3.55, 0.08, 0.1, '#24403e', -0.85, 0.58, F + 0.07);   // window frame
  g.add(b.mesh(solid()));
  const signM = new T.MeshStandardMaterial({ map: tabela(ad), roughness: 0.55, emissive: new T.Color('#ffffff'), emissiveIntensity: 0 }); signM.emissiveMap = signM.map;
  const sign = new T.Mesh(new T.PlaneGeometry(w - 0.9, (w - 0.9) * 160 / 768), signM); sign.position.set(0, 3.25, F + 0.04); g.add(sign);
  const winM = new T.MeshStandardMaterial({ map: ilanTex(), roughness: 0.3, emissive: new T.Color('#fff2d0'), emissiveIntensity: 0 }); winM.emissiveMap = winM.map;
  const win = new T.Mesh(new T.PlaneGeometry(3.4, 1.7), winM); win.position.set(-0.85, 1.45, F + 0.05); g.add(win);
  return {
    g,
    night(n) { signM.emissiveIntensity = 0.1 + n * 0.55; winM.emissiveIntensity = n * 0.5; },
    dispose() { g.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material as T.MeshStandardMaterial; if (mm !== mat) { mm.map?.dispose(); mm.dispose(); } } }); g.removeFromParent(); },
  };
}
