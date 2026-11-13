/**
 * Deniz view (survey vapur-4..7, iskele-3/5/10, yasam-2, animasyon-9/10, motor-3). Reads `rules.rt.deniz` (denizApi) and
 * `rt.ferry` / `rt.tables` / `rt.layout` only; never writes the sim.
 * - Sea life: dolphins arcing, glowing jellyfish, fish schools swirling, a lost seal, a tiny octopus climbing a bollard.
 * - Animals: ship cat walking the pier, rooftop gull nest with growing chicks, karabatak drying its wings on a post,
 *   a night hedgehog by the hedge, an old tortoise around a little fountain, the cat-gull stare duel, gulls circling the ferry.
 * - Ferry: a small docking bump and a thrown mooring rope; extra moored rowing boats rocking; sun glitter on the water.
 * - Kiosk exterior: side shed with a smoking tea stove,
 *   roof terrace; table kinds (hasır tabure + sehpa, ortak masa, tavla), railing counters; pier expansions (yan iskele,
 *   mendirek with a lighthouse, floating platform with lanterns).
 * Everything is code-made low-poly, no colliders (nav and zones untouched): expansions stand over water or beyond rails.
 * Visual variety uses Math.random (view code, not sim).
 */
import * as T from 'three';
import { denizApi, type DenizView } from '../../sim/deniz';
import { TEZGAH } from '../../../content/deniz';
import type { Rules } from '../../sim/state';

export interface DenizLookDeps { root: () => T.Object3D | null; rules: () => Rules | null; hour: () => number }
export interface DenizLookView { update(dt: number): void; debug(): Record<string, unknown>; dispose(): void }

const WY = -1.0, PI = Math.PI, HP = PI / 2;
const DOOR = { x: 22.4, z: -7.1 }, BOLLARD = { x: 22.05, z: -8.55 };
const mats = new Map<string, T.Material>();
const lam = (c: string) => { let m = mats.get('l' + c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); mats.set('l' + c, m); } return m; };
const glow = (c: string, op = 0.8) => { const k = 'g' + c + op; let m = mats.get(k); if (!m) { m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: op, depthWrite: false, blending: T.AdditiveBlending }); mats.set(k, m); } return m; };
const bas = (c: string) => { let m = mats.get('b' + c); if (!m) { m = new T.MeshBasicMaterial({ color: c }); mats.set('b' + c, m); } return m; };
function box(p: T.Object3D, w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number): T.Mesh { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); p.add(o); return o; }
function cyl(p: T.Object3D, r1: number, r2: number, h: number, m: T.Material, x: number, y: number, z: number, seg = 10): T.Mesh { const o = new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg), m); o.position.set(x, y, z); p.add(o); return o; }
function ball(p: T.Object3D, r: number, m: T.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): T.Mesh { const o = new T.Mesh(new T.SphereGeometry(r, 10, 8), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); p.add(o); return o; }
function cone(p: T.Object3D, r: number, h: number, m: T.Material, x: number, y: number, z: number, seg = 6): T.Mesh { const o = new T.Mesh(new T.ConeGeometry(r, h, seg), m); o.position.set(x, y, z); p.add(o); return o; }
function disposeTree(o: T.Object3D): void { o.traverse(c => { const m = c as T.Mesh; if (m.isMesh) m.geometry.dispose(); }); }
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** 0..1 appear / disappear envelope over a lifetime. */
const env = (t: number, dur: number, edge = 2.5) => Math.min(smooth(t / edge), smooth((dur - t) / edge));

/* ───────── builders ───────── */
function gull(): T.Group {
  const g = new T.Group();
  ball(g, 0.12, lam('#ffffff'), 0, 0, 0, 1.6, 0.9, 1);
  ball(g, 0.08, lam('#ffffff'), 0.17, 0.06, 0);
  cone(g, 0.025, 0.09, lam('#f2b632'), 0.27, 0.05, 0).rotation.z = -HP;
  const wl = box(g, 0.14, 0.02, 0.36, lam('#c9ced3'), 0, 0.04, 0.2); wl.name = 'wl';
  const wr = box(g, 0.14, 0.02, 0.36, lam('#c9ced3'), 0, 0.04, -0.2); wr.name = 'wr';
  return g;
}
function cat(color = '#e8964a'): T.Group {
  const g = new T.Group();
  ball(g, 0.14, lam(color), 0, 0.16, 0, 1.5, 0.9, 0.9);
  ball(g, 0.1, lam(color), 0.2, 0.28, 0);
  cone(g, 0.035, 0.07, lam(color), 0.2, 0.39, 0.05); cone(g, 0.035, 0.07, lam(color), 0.2, 0.39, -0.05);
  const tail = cyl(g, 0.02, 0.025, 0.28, lam(color), -0.24, 0.26, 0); tail.rotation.z = 0.6; tail.name = 'tail';
  [[0.1, 0.06], [0.1, -0.06], [-0.1, 0.06], [-0.1, -0.06]].forEach(([x, z]) => cyl(g, 0.025, 0.025, 0.12, lam(color), x, 0.06, z, 5));
  return g;
}
function person(shirt: string, skin = '#f2c9a0'): T.Group {
  const g = new T.Group();
  box(g, 0.24, 0.32, 0.16, lam(shirt), 0, 0.16, 0);
  ball(g, 0.1, lam(skin), 0, 0.42, 0);
  return g;
}
function rowboat(hull = '#c0533c', trim = '#fbfaf6'): T.Group {
  const g = new T.Group();
  const h = box(g, 0.9, 0.28, 2.0, lam(hull), 0, 0.1, 0); h.scale.set(1, 1, 1);
  box(g, 0.94, 0.06, 2.04, lam(trim), 0, 0.26, 0);
  cone(g, 0.45, 0.6, lam(hull), 0, 0.1, 1.25, 4).rotation.x = HP;
  box(g, 0.8, 0.05, 0.25, lam('#8a5d3b'), 0, 0.22, 0.2);
  return g;
}

/* sea life */
function buildLife(id: string): T.Group {
  const g = new T.Group(); g.name = 'life-' + id;
  if (id === 'yunus') {
    for (let i = 0; i < 3; i++) {
      const d = new T.Group(); d.name = 'd'; d.userData.ph = i * 0.8; d.userData.off = (i - 1) * 1.4;
      ball(d, 0.35, lam('#7d8fa3'), 0, 0, 0, 2.6, 0.8, 0.9);
      ball(d, 0.2, lam('#dfe6ea'), 0.05, -0.12, 0, 2.2, 0.5, 0.7);
      const fin = cone(d, 0.14, 0.32, lam('#6d7f93'), -0.1, 0.32, 0, 4); fin.rotation.z = 0.35;
      const tail = box(d, 0.08, 0.04, 0.55, lam('#6d7f93'), -0.95, 0, 0); tail.name = 'tail';
      g.add(d);
    }
  } else if (id === 'denizanasi') {
    for (let i = 0; i < 9; i++) {
      const j = new T.Group(); j.name = 'j'; j.userData.ph = Math.random() * 6; j.position.set((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
      const dome = new T.Mesh(new T.SphereGeometry(0.22, 12, 8, 0, PI * 2, 0, HP), glow(i % 2 ? '#7fd8ff' : '#ff8fd8', 0.7)); j.add(dome);
      ball(j, 0.32, glow(i % 2 ? '#2f9fd8' : '#d84fb0', 0.25), 0, 0, 0, 1, 0.3, 1);
      for (let k = 0; k < 4; k++) { const t = cyl(j, 0.012, 0.012, 0.35, glow('#ffffff', 0.45), Math.cos(k * 1.6) * 0.1, -0.18, Math.sin(k * 1.6) * 0.1, 4); t.name = 'tent'; }
      g.add(j);
    }
  } else if (id === 'lufer' || id === 'istavrit') {
    const n = id === 'lufer' ? 14 : 26, s = id === 'lufer' ? 0.22 : 0.12, col = id === 'lufer' ? '#5c7f9e' : '#c7d3dc';
    for (let i = 0; i < n; i++) {
      const f = new T.Group(); f.name = 'f'; f.userData.ph = Math.random() * PI * 2; f.userData.r = 0.6 + Math.random() * 1.6; f.userData.h = Math.random();
      ball(f, s, lam(col), 0, 0, 0, 2.2, 0.7, 0.5);
      cone(f, s * 0.7, s * 1.1, lam(col), -s * 2.2, 0, 0, 3).rotation.z = HP;
      g.add(f);
    }
    const rip = new T.Mesh(new T.RingGeometry(1.6, 2.4, 24), glow('#ffffff', 0.18)); rip.rotation.x = -HP; rip.position.y = 0.02; rip.name = 'rip'; g.add(rip);
  } else if (id === 'fok') {
    const b = new T.Group(); b.name = 'seal';
    ball(b, 0.32, lam('#6f6a66'), 0, 0, 0, 1.9, 0.8, 0.9);
    const hd = ball(b, 0.22, lam('#7b7671'), 0.5, 0.25, 0); hd.name = 'head';
    ball(b, 0.04, bas('#1b1b1b'), 0.66, 0.32, 0.09); ball(b, 0.04, bas('#1b1b1b'), 0.66, 0.32, -0.09); ball(b, 0.05, bas('#2b2b2b'), 0.72, 0.24, 0);
    for (const z of [0.1, -0.1]) { const w = box(b, 0.12, 0.01, 0.08, lam('#e8e1d6'), 0.74, 0.24, z * 1.4); w.rotation.y = z * 4; }
    g.add(b);
  } else if (id === 'ahtapot') {
    const o = new T.Group(); o.name = 'oct';
    ball(o, 0.13, lam('#f07a3c'), 0, 0.16, 0, 1, 1.2, 1);
    ball(o, 0.03, bas('#ffffff'), 0.1, 0.18, 0.05); ball(o, 0.03, bas('#ffffff'), 0.1, 0.18, -0.05);
    for (let k = 0; k < 8; k++) { const l = cyl(o, 0.02, 0.012, 0.22, lam('#f07a3c'), Math.cos(k * PI / 4) * 0.1, 0.02, Math.sin(k * PI / 4) * 0.1, 4); l.rotation.set(Math.sin(k * PI / 4) * 0.8, 0, -Math.cos(k * PI / 4) * 0.8); l.name = 'leg'; }
    g.add(o);
  }
  return g;
}

/* kiosk exterior, in the kiosk object's local frame (front = +z) */
interface KBox { x0: number; x1: number; z0: number; z1: number; top: number }
function buildShed(k: KBox): T.Group {
  const g = new T.Group(); g.name = 'kulube';
  const x = k.x1 + 0.85, z = k.z0 + 1.0;
  box(g, 1.5, 1.5, 1.8, lam('#c9a06b'), x, 0.75, z);
  for (let i = 0; i < 6; i++) box(g, 1.52, 0.03, 1.82, lam('#a77d4f'), x, 0.2 + i * 0.25, z);
  // flat roof slab sitting on the body (the old tilted panels floated above it)
  box(g, 1.7, 0.08, 1.86, lam('#7c4a32'), x, 1.54, z);
  box(g, 0.5, 0.9, 0.04, lam('#7c4a32'), x + 0.76, 0.45, z + 0.3).rotation.y = HP;
  box(g, 0.4, 0.28, 0.4, lam('#d9d4cc'), x + 0.45, 0.14, z + 1.1); box(g, 0.36, 0.3, 0.36, lam('#c9a06b'), x + 0.45, 0.43, z + 1.1); // sacks / crates
  cyl(g, 0.08, 0.08, 0.7, lam('#33373b'), x - 0.4, 2.0, z - 0.4, 8); // stove pipe
  const sm = new T.Group(); sm.name = 'smoke'; sm.position.set(x - 0.4, 2.4, z - 0.4); g.add(sm);
  for (let i = 0; i < 5; i++) { const s = ball(sm, 0.1, new T.MeshBasicMaterial({ color: '#e8e4dc', transparent: true, opacity: 0.6, depthWrite: false }), 0, 0, 0); s.userData.ph = i / 5; }
  return g;
}
function buildNest(): T.Group {
  const g = new T.Group(); g.name = 'nest';
  const n = new T.Mesh(new T.TorusGeometry(0.2, 0.08, 6, 12), lam('#a77d4f')); n.rotation.x = HP; n.position.y = 0.06; g.add(n);
  cyl(g, 0.18, 0.15, 0.06, lam('#8a6a45'), 0, 0.03, 0, 10);
  const mom = gull(); mom.name = 'mom'; mom.position.set(-0.32, 0.12, 0); mom.scale.setScalar(1.3); g.add(mom);
  for (let i = 0; i < 3; i++) { const c = new T.Group(); c.name = 'chick'; ball(c, 0.06, lam('#bfb8ae'), 0, 0, 0); ball(c, 0.04, lam('#cfc8be'), 0.04, 0.06, 0); cone(c, 0.015, 0.04, lam('#f2b632'), 0.09, 0.06, 0).rotation.z = -HP; c.position.set(-0.05 + i * 0.07, 0.12, (i - 1) * 0.07); c.userData.ph = i * 1.7; g.add(c); }
  return g;
}

/* table kinds (world frame) */
function buildSeat(kind: string, ax: 'x' | 'z'): T.Group {
  const g = new T.Group(); g.name = 'seat-' + kind; g.rotation.y = ax === 'z' ? HP : 0;
  const top = 0.74;
  if (kind === 'hasir') {
    cyl(g, 0.42, 0.42, 0.03, lam('#d9b77a'), 0, top + 0.02, 0, 16);
    for (let i = 0; i < 6; i++) { const r = new T.Mesh(new T.TorusGeometry(0.06 + i * 0.06, 0.008, 4, 20), lam('#b8925a')); r.rotation.x = HP; r.position.y = top + 0.04; g.add(r); }
    [[-0.85, 0.25], [0.85, -0.25], [-0.75, -0.35]].forEach(([x, z]) => { cyl(g, 0.17, 0.15, 0.3, lam('#c9a06b'), x, 0.15, z, 10); cyl(g, 0.18, 0.18, 0.04, lam('#e2c48f'), x, 0.31, z, 10); });
    cyl(g, 0.06, 0.05, 0.1, glow('#c0533c', 0.9), 0.1, top + 0.09, 0.05, 8); // çay
  } else if (kind === 'ortak') {
    box(g, 2.6, 0.07, 0.95, lam('#a77d4f'), 0, top + 0.04, 0);
    for (let i = 0; i < 5; i++) box(g, 2.6, 0.072, 0.02, lam('#8a5d3b'), 0, top + 0.04, -0.4 + i * 0.2);
    [-0.75, 0.75].forEach(z => { box(g, 2.5, 0.06, 0.32, lam('#a77d4f'), 0, 0.42, z * 1.05); [-1.1, 1.1].forEach(x => box(g, 0.08, 0.4, 0.26, lam('#8a5d3b'), x, 0.21, z * 1.05)); });
    for (let i = 0; i < 4; i++) cyl(g, 0.04, 0.035, 0.1, glow('#c0533c', 0.9), -0.9 + i * 0.6, top + 0.13, (i % 2 ? 0.2 : -0.2), 8);
  } else if (kind === 'tavla') {
    const b = new T.Group(); b.position.y = top + 0.06; g.add(b);
    box(b, 0.66, 0.05, 0.46, lam('#7c4a32'), 0, 0, 0);
    box(b, 0.3, 0.052, 0.4, lam('#e9d3ae'), -0.165, 0.004, 0); box(b, 0.3, 0.052, 0.4, lam('#e9d3ae'), 0.165, 0.004, 0);
    for (let i = 0; i < 6; i++) { cone(b, 0.022, 0.15, lam(i % 2 ? '#c0533c' : '#33373b'), -0.29 + i * 0.05, 0.03, 0.12, 3).rotation.x = HP; cone(b, 0.022, 0.15, lam(i % 2 ? '#33373b' : '#c0533c'), 0.04 + i * 0.05, 0.03, -0.12, 3).rotation.x = -HP; }
    for (let i = 0; i < 5; i++) cyl(b, 0.025, 0.025, 0.015, lam(i % 2 ? '#fbfaf6' : '#1d1d1d'), -0.1 + i * 0.05, 0.035, 0.05 * (i % 2 ? 1 : -1), 10);
    box(b, 0.04, 0.04, 0.04, lam('#fbfaf6'), 0.2, 0.05, 0.08); box(b, 0.04, 0.04, 0.04, lam('#fbfaf6'), 0.25, 0.05, 0.05);
    [-0.5, 0.5].forEach(x => cyl(g, 0.045, 0.04, 0.1, glow('#c0533c', 0.9), x * 0.9, top + 0.1, 0.2, 8));
  }
  return g;
}

/* pier expansions (world frame) */
function buildYan(): T.Group {
  const g = new T.Group(); g.name = 'yanIskele';
  const x0 = -18.5, x1 = -10.4, z0 = -1.6, z1 = 1.2;
  box(g, x1 - x0, 0.14, z1 - z0, lam('#b98a5a'), (x0 + x1) / 2, -0.07, (z0 + z1) / 2);
  for (let x = x0 + 0.3; x < x1; x += 0.5) box(g, 0.04, 0.145, z1 - z0, lam('#9a6f45'), x, -0.07, (z0 + z1) / 2);
  for (let x = x0 + 0.3; x < x1; x += 1.6) { cyl(g, 0.14, 0.15, 1.4, lam('#6e4c33'), x, -0.75, z0 + 0.1); cyl(g, 0.14, 0.15, 1.4, lam('#6e4c33'), x, -0.75, z1 - 0.1); cyl(g, 0.06, 0.06, 0.7, lam('#6e4c33'), x, 0.35, z0 + 0.05, 6); cyl(g, 0.06, 0.06, 0.7, lam('#6e4c33'), x, 0.35, z1 - 0.05, 6); }
  const rope = box(g, x1 - x0 - 0.6, 0.03, 0.03, lam('#d9c39a'), (x0 + x1) / 2 - 0.2, 0.62, z0 + 0.05); void rope;
  box(g, x1 - x0 - 0.6, 0.03, 0.03, lam('#d9c39a'), (x0 + x1) / 2 - 0.2, 0.62, z1 - 0.05);
  cyl(g, 0.12, 0.14, 0.3, lam('#33373b'), x0 + 0.4, 0.15, z0 + 0.3, 8); // bollard
  return g;
}
function buildMendirek(): T.Group {
  const g = new T.Group(); g.name = 'mendirek';
  for (let x = -38; x <= 3; x += 1.7) { const b = box(g, 1.8, 1.4, 2.4, lam(Math.random() < 0.5 ? '#bdb6ab' : '#cfc8be'), x, WY + 0.3, -28 + Math.sin(x * 0.7) * 0.15); b.rotation.y = (Math.random() - 0.5) * 0.2; }
  box(g, 42, 0.12, 1.6, lam('#a9a297'), -17.5, WY + 1.05, -28);
  const lh = new T.Group(); lh.position.set(4.5, WY + 1.0, -28); lh.name = 'fener'; g.add(lh);
  for (let i = 0; i < 5; i++) cyl(lh, 0.62 - i * 0.06, 0.66 - i * 0.06, 0.8, lam(i % 2 ? '#fbfaf6' : '#d8433a'), 0, 0.4 + i * 0.8, 0, 14);
  cyl(lh, 0.45, 0.45, 0.6, lam('#33373b'), 0, 4.3, 0, 10);
  const lamp = ball(lh, 0.3, bas('#fff1a8'), 0, 4.3, 0); lamp.name = 'lamp';
  const beam = new T.Mesh(new T.ConeGeometry(0.9, 7, 12, 1, true), glow('#fff1a8', 0.18)); beam.rotation.z = HP; beam.position.set(3.5, 4.3, 0); const pivot = new T.Group(); pivot.name = 'beam'; pivot.position.set(0, 0, 0); pivot.add(beam); lh.add(pivot);
  cone(lh, 0.55, 0.6, lam('#d8433a'), 0, 4.9, 0, 10);
  // karabatak posts on the breakwater
  for (const x of [-8, -20]) { const k = karabatak(); k.position.set(x, WY + 1.1, -27.4); g.add(k); }
  return g;
}
function karabatak(): T.Group {
  const g = new T.Group(); g.name = 'karabatak';
  ball(g, 0.14, lam('#1f2226'), 0, 0.3, 0, 0.9, 1.5, 0.9);
  const nk = cyl(g, 0.04, 0.05, 0.25, lam('#1f2226'), 0.04, 0.55, 0, 6); nk.rotation.z = -0.2;
  ball(g, 0.07, lam('#1f2226'), 0.08, 0.68, 0); cone(g, 0.02, 0.14, lam('#c9a24a'), 0.18, 0.67, 0, 4).rotation.z = -HP;
  ball(g, 0.02, bas('#7fd8a0'), 0.11, 0.7, 0.05);
  const wl = box(g, 0.06, 0.32, 0.45, lam('#2a2e33'), -0.02, 0.38, 0.26); wl.rotation.x = -0.5; wl.name = 'wl';
  const wr = box(g, 0.06, 0.32, 0.45, lam('#2a2e33'), -0.02, 0.38, -0.26); wr.rotation.x = 0.5; wr.name = 'wr';
  return g;
}
function buildPlatform(): T.Group {
  const g = new T.Group(); g.name = 'platform'; g.position.set(-3.5, WY, -20.5);
  box(g, 4.2, 0.3, 4.2, lam('#d9c39a'), 0, 0.15, 0);
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) cyl(g, 0.3, 0.3, 0.4, lam('#e0533c'), x, 0.05, z, 10);
  for (const [x, z] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { cyl(g, 0.04, 0.04, 1.3, lam('#33373b'), x, 0.95, z, 5); const l = ball(g, 0.14, glow('#ffcf6b', 0.95), x, 1.65, z); l.name = 'lantern'; }
  cyl(g, 0.04, 0.04, 1.3, lam('#33373b'), 0.4, 0.95, 0.3, 5); const u = new T.Mesh(new T.ConeGeometry(1.0, 0.4, 8), lam('#2f9e8f')); u.position.set(0.4, 1.7, 0.3); g.add(u);
  const lg = gull(); lg.position.set(-0.8, 0.42, -0.6); lg.rotation.y = 1; g.add(lg);
  const ring = new T.Mesh(new T.TorusGeometry(0.28, 0.08, 6, 14), lam('#fbfaf6')); ring.position.set(1.0, 0.4, -1.0); ring.rotation.x = HP; g.add(ring);
  return g;
}

export function createDenizLook(d: DenizLookDeps): DenizLookView {
  const grp = new T.Group(); grp.name = 'denizLook';
  const lifeG = new T.Group(), animG = new T.Group(), seatG = new T.Group(), pierG = new T.Group();
  grp.add(lifeG, animG, seatG, pierG);
  grp.traverse(o => { o.userData.parity = 'dyn'; });
  let t = 0;

  /* --- static animals --- */
  // karabatak on its own post in the water near the north-west corner
  const kPost = new T.Group(); kPost.position.set(-12.2, 0, -12.6); animG.add(kPost);
  cyl(kPost, 0.16, 0.18, 2.2, lam('#6e4c33'), 0, WY + 0.6, 0, 8);
  const kara = karabatak(); kara.position.y = WY + 1.7; kara.rotation.y = 0.8; kPost.add(kara);
  // fountain + tortoise beyond the promenade rail (park side)
  const fount = new T.Group(); fount.position.set(-16.5, 0, 14.4); animG.add(fount);
  cyl(fount, 0.6, 0.66, 0.35, lam('#cfc8be'), 0, 0.17, 0, 16); cyl(fount, 0.52, 0.52, 0.04, glow('#7fc6e8', 0.7), 0, 0.33, 0, 16);
  cyl(fount, 0.08, 0.1, 0.7, lam('#bdb6ab'), 0, 0.6, 0, 8); cyl(fount, 0.24, 0.1, 0.1, lam('#bdb6ab'), 0, 0.95, 0, 12);
  const jet = ball(fount, 0.08, glow('#bfe6f5', 0.8), 0, 1.05, 0); jet.name = 'jet';
  const tort = new T.Group(); tort.name = 'tortoise'; animG.add(tort);
  ball(tort, 0.2, lam('#6f7d3a'), 0, 0.12, 0, 1.3, 0.7, 1.1); ball(tort, 0.22, lam('#8a6a45'), 0, 0.16, 0, 1.15, 0.55, 1.0);
  ball(tort, 0.07, lam('#9aa65a'), 0.3, 0.1, 0);
  // hedgehog (night)
  const hog = new T.Group(); hog.name = 'kirpi'; animG.add(hog);
  ball(hog, 0.13, lam('#6b5440'), 0, 0.1, 0, 1.3, 0.8, 1);
  for (let i = 0; i < 10; i++) { const s = cone(hog, 0.025, 0.12, lam('#4a3a2c'), -0.05 + Math.cos(i) * 0.08, 0.17 + Math.sin(i * 2) * 0.03, Math.sin(i * 1.3) * 0.08, 3); s.rotation.z = 0.9; }
  ball(hog, 0.05, lam('#c9a27a'), 0.17, 0.08, 0); ball(hog, 0.02, bas('#111'), 0.22, 0.09, 0);
  // moored rowing boats
  const moored: T.Group[] = [];
  [[-11.7, -9.5, 0.1, '#e0533c'], [-11.9, 2.6, -0.15, '#ffd23f']].forEach(([x, z, r, c]) => { const b = rowboat(c as string); b.position.set(x as number, WY, z as number); b.rotation.y = r as number; b.userData.ph = Math.random() * 6; animG.add(b); moored.push(b); });
  // gulls circling the ferry
  const fgulls: T.Group[] = []; for (let i = 0; i < 3; i++) { const g = gull(); g.visible = false; animG.add(g); fgulls.push(g); }
  // ship cat + duel actors
  const shipCat = cat('#3b3b3b'); shipCat.visible = false; animG.add(shipCat);
  ball(shipCat, 0.04, bas('#fbfaf6'), 0.3, 0.24, 0); // white muzzle
  // mooring rope
  const ropeMat = new T.LineBasicMaterial({ color: '#d9c39a' });
  const ropeGeo = new T.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => new T.Vector3()));
  const rope = new T.Line(ropeGeo, ropeMat); rope.visible = false; rope.frustumCulled = false; animG.add(rope);
  // sun glitter
  const GL = 140, glPos = new Float32Array(GL * 3), glCol = new Float32Array(GL * 3), glPh = new Float32Array(GL);
  for (let i = 0; i < GL; i++) {
    const side = i % 3; let x = 0, z = 0;
    if (side === 0) { x = -40 + Math.random() * 80; z = -16 - Math.random() * 26; } else if (side === 1) { x = -30 + Math.random() * 18; z = -14 + Math.random() * 18; } else { x = 10 + Math.random() * 20; z = -14 + Math.random() * 18; }
    glPos[i * 3] = x; glPos[i * 3 + 1] = WY + 0.03; glPos[i * 3 + 2] = z; glPh[i] = Math.random() * 10;
  }
  const glGeo = new T.BufferGeometry(); glGeo.setAttribute('position', new T.BufferAttribute(glPos, 3)); glGeo.setAttribute('color', new T.BufferAttribute(glCol, 3));
  const glit = new T.Points(glGeo, new T.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true }));
  glit.frustumCulled = false; glit.name = 'glitter'; grp.add(glit);

  /* --- dynamic --- */
  let lifeObj: T.Group | null = null, lifeKey = '';
  let kiosk: T.Object3D | null = null, kb: KBox | null = null;
  const kGrp = new T.Group(); kGrp.name = 'denizKiosk';
  let extKey = '', shed: T.Group | null = null, nest: T.Group | null = null;
  let seatKey = '', pierKey = '', tezKey = '';
  const tezG = new T.Group(); grp.add(tezG);
  let ferryObj: T.Object3D | null = null, bump: { x: number; rz: number } | null = null;
  const _v = new T.Vector3();

  function findKiosk(root: T.Object3D): T.Object3D | null { let k: T.Object3D | null = null; root.traverse(o => { if (!k && o.userData && o.userData.k2) k = o; }); return k; }
  function mine(o: T.Object3D): boolean { let p: T.Object3D | null = o; while (p) { if (p === kGrp || p.name === 'dekorLook') return true; p = p.parent; } return false; }
  function measure(k: T.Object3D): KBox {
    k.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(k.matrixWorld).invert(), bb = new T.Box3(), tmp = new T.Box3(), m4 = new T.Matrix4();
    k.traverse(o => {
      const m = o as T.Mesh; if (!m.isMesh || !m.geometry || mine(o)) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      tmp.copy(m.geometry.boundingBox!).applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
      if (tmp.max.y - tmp.min.y > 8 || tmp.max.x - tmp.min.x > 14) return;
      bb.union(tmp);
    });
    if (bb.isEmpty()) return { x0: -4.2, x1: 4.2, z0: -3, z1: 3, top: 3 };
    return { x0: bb.min.x, x1: bb.max.x, z0: bb.min.z, z1: bb.max.z, top: Math.min(bb.max.y, 4.2) };
  }
  function syncKiosk(root: T.Object3D, v: DenizView, stage: number): void {
    const k = findKiosk(root);
    if (k !== kiosk) { kiosk = k; extKey = ''; if (k) { kb = measure(k); k.add(kGrp); } }
    if (!kiosk || !kb) return;
    if (kGrp.parent !== kiosk) kiosk.add(kGrp);
    const key = stage + '|' + v.ext.join(',');
    if (key !== extKey) {
      extKey = key;
      [shed, nest].forEach(o => { if (o) { kGrp.remove(o); disposeTree(o); } });
      shed = null;
      if (stage >= 2 && v.ext.indexOf('kulube') >= 0) { shed = buildShed(kb); kGrp.add(shed); }
      
    }
  }
  function syncSeats(rl: Rules, v: DenizView): void {
    const L = rl.rt.layout, key = rl.state.stage + '|' + rl.rt.tables.map((tb, i) => (tb.built ? (v.seats[String(i)] || '-') : 'x')).join(',');
    if (key === seatKey) return; seatKey = key;
    while (seatG.children.length) { const c = seatG.children.pop()!; disposeTree(c); }
    rl.rt.tables.forEach((tb, i) => {
      const kind = v.seats[String(i)], at = L.tables[i]; if (!tb.built || !kind || !at) return;
      const g = buildSeat(kind, at.ax); g.position.set(at.x, 0, at.z); seatG.add(g);
    });
  }
  function syncTez(n: number): void {
    const key = String(n); if (key === tezKey) return; tezKey = key;
    while (tezG.children.length) { const c = tezG.children.pop()!; disposeTree(c); }
    for (let i = 0; i < n && i < TEZGAH.spots.length; i++) {
      const s = TEZGAH.spots[i], g = new T.Group(); g.position.set(s.x, 0, s.z); tezG.add(g);
      box(g, 1.2, 0.06, 0.32, lam('#a77d4f'), 0, 1.05, 0.12);
      [-0.45, 0.45].forEach(x => { const b = box(g, 0.05, 0.25, 0.05, lam('#8a5d3b'), x, 0.92, 0.22); b.rotation.x = 0.6; });
      cyl(g, 0.04, 0.035, 0.1, glow('#c0533c', 0.9), -0.25, 1.13, 0.12, 8); cyl(g, 0.04, 0.035, 0.1, glow('#c0533c', 0.9), 0.2, 1.13, 0.15, 8);
      box(g, 0.3, 0.16, 0.02, lam('#1d5fa8'), 0, 0.95, 0.27);
    }
  }
  function syncPier(list: string[]): void {
    const key = list.join(','); if (key === pierKey) return; pierKey = key;
    while (pierG.children.length) { const c = pierG.children.pop()!; disposeTree(c); }
    if (list.indexOf('yan') >= 0) {
      pierG.add(buildYan());
      [[-15.5, -2.6, 0.2, '#2f9e8f'], [-12.9, -2.5, -0.1, '#fbfaf6']].forEach(([x, z, r, c]) => { const b = rowboat(c as string); b.position.set(x as number, WY, z as number); b.rotation.y = HP + (r as number); b.userData.ph = Math.random() * 6; pierG.add(b); });
    }
    if (list.indexOf('mendirek') >= 0) pierG.add(buildMendirek());
    if (list.indexOf('platform') >= 0) pierG.add(buildPlatform());
  }

  function placeLife(v: DenizView, night: number): void {
    const s = v.sight, key = s ? s.id + ':' + s.seed : '';
    if (key !== lifeKey) {
      lifeKey = key;
      if (lifeObj) { lifeG.remove(lifeObj); disposeTree(lifeObj); lifeObj = null; }
      if (s) { lifeObj = buildLife(s.id); lifeObj.position.set(s.x, WY, s.z); lifeG.add(lifeObj); }
    }
    if (!s || !lifeObj) return;
    const k = env(s.t, s.dur, 2), lt = s.t;
    if (s.id === 'yunus') {
      lifeObj.position.x = s.x - 10 + (lt / s.dur) * 20;
      lifeObj.children.forEach(c => {
        const ph = (lt * 0.9 + (c.userData.ph as number)) % 2.2, up = ph < 1.2 ? Math.sin((ph / 1.2) * PI) : -0.4;
        c.position.set((c.userData.off as number) * 0.6, up * 1.1 * k - 0.35 + (1 - k) * -1, c.userData.off as number);
        c.rotation.z = ph < 1.2 ? Math.cos((ph / 1.2) * PI) * 0.9 : 0;
        const tail = c.getObjectByName('tail'); if (tail) tail.rotation.y = Math.sin(lt * 10) * 0.3;
      });
    } else if (s.id === 'denizanasi') {
      lifeObj.children.forEach(c => {
        const ph = c.userData.ph as number, p = 1 + Math.sin(lt * 2.2 + ph) * 0.15;
        c.position.y = -0.18 + Math.sin(lt * 0.8 + ph) * 0.08; c.scale.set(p * k, (2 - p) * k, p * k);
        c.children.forEach(m => { const mt = (m as T.Mesh).material as T.MeshBasicMaterial; if (mt && mt.blending === T.AdditiveBlending) mt.opacity = (m.name === 'tent' ? 0.45 : 0.75) * (0.4 + 0.6 * Math.max(night, 0.35)); });
      });
    } else if (s.id === 'lufer' || s.id === 'istavrit') {
      lifeObj.children.forEach(c => {
        if (c.name === 'rip') { c.scale.setScalar(1 + Math.sin(lt * 3) * 0.08); ((c as T.Mesh).material as T.MeshBasicMaterial).opacity = 0.18 * k; return; }
        const a = lt * 1.6 + (c.userData.ph as number), r = c.userData.r as number;
        c.position.set(Math.cos(a) * r + Math.sin(lt * 0.4) * 0.8, -0.12 - (c.userData.h as number) * 0.25 + (Math.sin(lt * 5 + a) > 0.97 ? 0.25 : 0), Math.sin(a) * r * 0.6);
        c.rotation.y = -a - HP; c.scale.setScalar(k);
      });
    } else if (s.id === 'fok') {
      const seal = lifeObj.getObjectByName('seal');
      if (seal) { seal.position.y = -0.18 + Math.sin(lt * 1.6) * 0.06 - (1 - k) * 0.8; seal.rotation.y = Math.sin(lt * 0.3) * 0.8; seal.rotation.x = Math.sin(lt * 0.9) * 0.15; const hd = seal.getObjectByName('head'); if (hd) hd.rotation.z = Math.sin(lt * 2.4) * 0.25; }
    } else if (s.id === 'ahtapot') {
      const o = lifeObj.getObjectByName('oct');
      if (o) {
        const climb = smooth((lt - 1) / (s.dur * 0.6));
        o.position.set(0.22 * Math.cos(lt * 0.6), (1 - k) * -0.6 + climb * 1.6, 0.22 * Math.sin(lt * 0.6));
        o.children.forEach((l, i) => { if (l.name === 'leg') l.rotation.y = Math.sin(lt * 6 + i) * 0.4; });
        o.scale.setScalar(Math.max(0.01, k));
      }
    }
  }
  function animKiosk(hour: number, night: number): void {
    if (shed) { const sm = shed.getObjectByName('smoke'); if (sm) sm.children.forEach(o => { const k = (t * 0.3 + (o.userData.ph as number)) % 1; o.position.set(Math.sin(k * 6) * 0.1, k * 1.3, 0); o.scale.setScalar(0.6 + k * 1.6); ((o as T.Mesh).material as T.MeshBasicMaterial).opacity = 0.6 * (1 - k); }); }
    if (nest) {
      const v = denizApi(d.rules())?.view(); const n = v ? v.chicks : 1, grow = v ? Math.min(1, 0.6 + v.nestAge * 0.08) : 0.6;
      let i = 0; nest.children.forEach(c => { if (c.name !== 'chick') return; c.visible = i < n; c.scale.setScalar(grow); c.position.y = 0.12 + Math.max(0, Math.sin(t * 4 + (c.userData.ph as number))) * 0.04; i++; });
      const mom = nest.getObjectByName('mom'); if (mom) { const cry = (t % 9) < 1.2; mom.rotation.z = cry ? -0.7 : 0; mom.rotation.y = Math.sin(t * 0.4) * 0.5; }
    }
  }
  function animAnimals(rl: Rules, v: DenizView, hour: number): void {
    // karabatak wings flap-dry
    const fl = Math.sin(t * 2) * 0.25; [kara, ...pierG.children.flatMap(c => c.children.filter(o => o.name === 'karabatak'))].forEach(k => { const wl = k.getObjectByName('wl'), wr = k.getObjectByName('wr'); if (wl) wl.rotation.x = -0.9 - fl; if (wr) wr.rotation.x = 0.9 + fl; });
    // tortoise: one lap around the fountain takes a long while
    const ta = t * 0.03; tort.position.set(fount.position.x + Math.cos(ta) * 1.1, 0, fount.position.z + Math.sin(ta) * 1.1); tort.rotation.y = -ta - PI;
    (jet as T.Mesh).scale.setScalar(1 + Math.sin(t * 6) * 0.25);
    // hedgehog at night along the hedge (park side)
    hog.visible = hour >= 20 || hour < 8.2;
    if (hog.visible) { const hx = Math.sin(t * 0.12) * 7; hog.position.set(hx, 0, 13.85); hog.rotation.y = Math.cos(t * 0.12) > 0 ? 0 : PI; hog.position.y = Math.abs(Math.sin(t * 8)) * 0.02; }
    // moored boats rock
    const rk = (b: T.Object3D, i: number) => { const ph = (b.userData.ph as number) || i; b.position.y = WY + Math.sin(t * 1.3 + ph) * 0.06; b.rotation.z = Math.sin(t * 0.9 + ph) * 0.06; b.rotation.x = Math.sin(t * 0.7 + ph) * 0.03; };
    moored.forEach(rk); pierG.children.forEach((c, i) => { if (c.userData.ph != null) rk(c, i); });
    const platform = pierG.getObjectByName('platform');
    if (platform) { platform.position.y = WY + Math.sin(t * 1.1) * 0.05; platform.rotation.z = Math.sin(t * 0.7) * 0.02; platform.children.forEach((c, i) => { if (c.name === 'lantern') ((c as T.Mesh).material as T.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.max(0.2, nightOf(hour)) * (0.85 + 0.15 * Math.sin(t * 7 + i)); }); }
    const fen = pierG.getObjectByName('fener'); if (fen) { const bm = fen.getObjectByName('beam'); if (bm) { bm.rotation.y = t * 0.9; bm.visible = nightOf(hour) > 0.15; } }
    // ferry gulls + rope + bump
    const f = rl.rt.ferry;
    if (ferryObj && ferryObj.visible) {
      ferryObj.getWorldPosition(_v);
      if (f.state === 'docked' && f.t < 1.4) { const k = f.t / 1.4; if (!bump) bump = { x: ferryObj.position.x, rz: ferryObj.rotation.z }; ferryObj.position.x = bump.x + Math.sin(k * PI * 3) * 0.12 * (1 - k); ferryObj.rotation.z = bump.rz + Math.sin(k * PI * 4) * 0.02 * (1 - k); }
      else if (bump) { ferryObj.position.x = bump.x; ferryObj.rotation.z = bump.rz; bump = null; }
      fgulls.forEach((g, i) => {
        g.visible = f.state !== 'away';
        const a = t * (0.6 + i * 0.15) + i * 2.1, r = 3.5 + i;
        g.position.set(_v.x + Math.cos(a) * r, 5 + i * 0.6 + Math.sin(t * 1.3 + i) * 0.4, _v.z + Math.sin(a) * r - (f.state === 'leaving' ? 4 : 0));
        g.rotation.y = -a; const w = Math.sin(t * 9 + i) * 0.5; const wl = g.getObjectByName('wl'), wr = g.getObjectByName('wr'); if (wl) wl.rotation.x = w; if (wr) wr.rotation.x = -w;
      });
      rope.visible = f.state === 'docked' && f.t < 24.5;
      if (rope.visible) {
        const k = smooth(f.t / 1.0), ax = _v.x - 2.1, ay = 0.9, az = BOLLARD.z - 0.3, bx = BOLLARD.x, by = 0.45, bz = BOLLARD.z;
        const pos = ropeGeo.attributes.position as T.BufferAttribute;
        for (let i = 0; i < 12; i++) { const u = (i / 11) * k; pos.setXYZ(i, ax + (bx - ax) * u, ay + (by - ay) * u + Math.sin(u * PI) * (k < 1 ? 0.8 : -0.12), az + (bz - az) * u); }
        pos.needsUpdate = true;
      }
    } else { fgulls.forEach(g => { g.visible = false; }); rope.visible = false; }
    // ship cat: hops off, a little loop on the pier, back before leaving
    shipCat.visible = !!v.shipCat && f.state === 'docked';
    if (shipCat.visible && v.shipCat) {
      const ct = v.shipCat.t, loop = 18, k = Math.min(ct, loop) / loop;
      const pts: [number, number][] = [[DOOR.x + 0.4, DOOR.z], [6.4, -6.2], [5.6, -3.0], [6.8, -1.2], [7.4, -4.6], [DOOR.x + 0.4, DOOR.z]];
      const seg = k * (pts.length - 1), si = Math.min(pts.length - 2, Math.floor(seg)), u = seg - si, a = pts[si], b = pts[si + 1];
      shipCat.position.set(a[0] + (b[0] - a[0]) * u, Math.abs(Math.sin(ct * 9)) * 0.03, a[1] + (b[1] - a[1]) * u);
      shipCat.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]) - HP;
      if (ct > loop) { shipCat.rotation.y = PI; const tail = shipCat.getObjectByName('tail'); if (tail) tail.rotation.x = Math.sin(t * 3) * 0.5; }
    }
  }
  const nightOf = (h: number) => (h >= 19.5 ? Math.min(1, (h - 19.5) / 1.5) : h < 8.2 ? 1 : 0);
  function animGlitter(hour: number): void {
    const day = hour >= 8 && hour < 19.5 ? Math.min(1, (hour - 8) / 0.8, (19.5 - hour) / 1.2) : 0;
    const warm = hour > 17 ? Math.min(1, (hour - 17) / 2) : 0;
    glit.visible = day > 0.02;
    if (!glit.visible) return;
    for (let i = 0; i < GL; i++) {
      const s = Math.max(0, Math.sin(t * 3.2 + glPh[i] * 7) * 1.6 - 0.6) * day;
      glCol[i * 3] = s; glCol[i * 3 + 1] = s * (1 - warm * 0.25); glCol[i * 3 + 2] = s * (1 - warm * 0.55);
    }
    (glGeo.attributes.color as T.BufferAttribute).needsUpdate = true;
  }

  return {
    debug: () => ({ parent: grp.parent?.name ?? null, life: lifeKey, ext: extKey, seats: seatKey, pier: pierKey, kiosk: !!kiosk, kb }),
    update(dt) {
      const rl = d.rules(), root = d.root(), api = denizApi(rl);
      if (!rl || !root || !api) return;
      t += dt;
      if (grp.parent !== root) root.add(grp);
      if (!ferryObj || !ferryObj.parent) { ferryObj = root.getObjectByName('ferry') ?? null; while (ferryObj) { const c = ferryObj.children.find(k => k.name === 'ferry'); if (!c) break; ferryObj = c; } }
      const v = api.view(), hour = d.hour(), night = nightOf(hour);
      syncKiosk(root, v, rl.state.stage);
      syncSeats(rl, v); syncTez(v.tez); syncPier(v.pier);
      placeLife(v, night);
      animKiosk(hour, night); animAnimals(rl, v, hour); animGlitter(hour);
    },
    dispose() {
      grp.parent?.remove(grp); kGrp.parent?.remove(kGrp);
      disposeTree(grp); disposeTree(kGrp); glGeo.dispose(); ropeGeo.dispose();
    },
  };
}
