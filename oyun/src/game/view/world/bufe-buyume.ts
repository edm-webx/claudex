/**
 * Büfe büyümesi 2-10 (2026-11-08 rework). Owner: "ilk büfenin 10 seviyesi olacak şekilde o iskelenin tüm alanını kaplayacak
 * şekilde büyümeli, çeşit artmalı, çalışanlar artmalı" and "her seviyede wow dedirtecek değişiklik". The v52 sea platform
 * west of the pier is gone: the business now grows out of the kiosk over the empty pier wings, cumulative per stage:
 *   2 flower boxes, menu easel, bistro sets at the pier mouth
 *   3 west wing: Çay bahçesi (deck, 4 umbrella tables, çay ocağı with semaver, a çaycı)
 *   4 east wing: Dondurma & gazoz terası (deck, 4 tables, cold cabinet stall, a garson)
 *   5 west wing full: 8 tables, pergola with vines, string lights over the front
 *   6 west hall: Kahvaltı salonu (glass pavilion, interior tables, warm light)
 *   7 east hall: Balık lokantası + east terrace full
 *   8 roof terraces on both halls (umbrellas, railings, stairs)
 *   9 open grill kitchen on the east terrace, covered arcade behind the kiosk, rooftop sign on the kiosk
 *  10 Fine dining: navy and gold restyle, chandeliers, gold entrance arch, red carpet, valet, topiaries, uplights
 * Staff and guests are simple figures (waiters walk their rounds, guests sit). Colliders: buyumeEngel(stage).
 * Keeps clear: the ferry corridor (east, z -9.2..-4.8), the customer walkway behind the kiosk (z ~-12) and along x ~7.
 */
import * as T from 'three';
import { IC_BY_ID, icColliders, icIcinde } from '../../../content/ic-mekan';
import { Batch } from '../../../engine/prefab/batch';
import { PIER } from '../../../content/prefabs/iskele/layout';
import { useSkyEnv } from './glb';
import { radialTex, ensureKit } from '../../../content/prefabs/common/v2kit';

export interface BuyumeDeps { root: () => T.Object3D | null; night: () => number; stage: () => number; /** running tadilat: target stage and 0..1 progress */ tadilat?: () => { to: number; p: number } | null; /** the player's club (sim/mulk takim) */ takim?: () => { ad: string; renk: string; renk2?: string } | null; /** player position: a hall's roof/upper floor hides while inside */ hero?: () => { x: number; z: number } }
export interface BuyumeView { update(dt: number): void; dispose(): void }

const UMB = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#f4f2ec', '#c94f6d'];
const HP = Math.PI / 2;
/** wing footprints on the pier */
const WB = { x0: -23.0, x1: -12.2, z0: -17.2, z1: -10.6 };   // west hall
const WT = { x0: -23.0, x1: -12.2, z0: -9.4, z1: 3.4 };      // west terrace
const EB = { x0: 9.6, x1: 21.6, z0: -17.2, z1: -10.6 };      // east hall
const ET = { x0: 9.6, x1: 21.4, z0: -3.9, z1: 3.4 };         // east terrace (north of it is the ferry corridor)
const cx = (r: { x0: number; x1: number }) => (r.x0 + r.x1) / 2, cz = (r: { z0: number; z1: number }) => (r.z0 + r.z1) / 2;
/** table spots per wing, filled in order as the stage grows */
const WT_TABLES: [number, number][] = [[-20.6, -6.6], [-16.2, -6.6], [-20.6, -2.6], [-16.2, -2.6], [-20.6, 1.2], [-16.2, 1.2], [-13.8, -4.6], [-13.8, 0.0]];
const ET_TABLES: [number, number][] = [[11.8, -1.6], [15.0, -1.6], [11.8, 1.6], [15.0, 1.6], [18.2, 1.6], [18.2, -1.6]];
const wtN = (st: number) => (st >= 5 ? 8 : st >= 3 ? 4 : 0), etN = (st: number) => (st >= 9 ? 4 : st >= 7 ? 6 : st >= 4 ? 4 : 0);
export const BUYUME_AD = ['', '', 'Çiçekli büfe', 'Çay bahçesi', 'Dondurma terası', 'Bahçeli büfe', 'Kahvaltı salonu', 'Balık lokantası', 'Teraslı lokanta', 'Şef mutfağı', 'Fine dining'];

/** Solid parts of the growth for the walk grid (halls, counters, kitchen, tables). */
export function buyumeEngel(stage: number): { x0: number; x1: number; z0: number; z1: number; tag: string }[] {
  const o: { x0: number; x1: number; z0: number; z1: number; tag: string }[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number, tag = 'buyume') => o.push({ x0, x1, z0, z1, tag });
  const t = (x: number, z: number) => add(x - 0.55, x + 0.55, z - 0.55, z + 0.55, 'buyume-masa');
  WT_TABLES.slice(0, wtN(stage)).forEach(([x, z]) => t(x, z)); ET_TABLES.slice(0, etN(stage)).forEach(([x, z]) => t(x, z));
  if (stage >= 3) add(WT.x0 + 0.2, WT.x0 + 1.4, -9.0, -6.4, 'buyume-ocak');
  if (stage >= 4) add(ET.x1 - 1.3, ET.x1 - 0.1, ET.z0 + 0.3, ET.z0 + 2.0, 'buyume-dolap');
  // 2026-11-09 "her yere girilebilmeli": the halls are rooms with a door on the promenade side (content/ic-mekan.ts)
  if (stage >= 6) icColliders(IC_BY_ID.salonW).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  if (stage >= 7) icColliders(IC_BY_ID.salonE).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  if (stage >= 9) add(ET.x1 - 3.0, ET.x1, -3.6, -2.4, 'buyume-mutfak');
  return o;
}

let pool: T.MeshBasicMaterial | null = null, warm: T.MeshBasicMaterial | null = null;
let solid: T.MeshStandardMaterial | null = null, glass: T.MeshStandardMaterial | null = null, glow: T.MeshBasicMaterial | null = null;
function mats() {
  if (!solid) {
    solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }); useSkyEnv(solid, 'matte');
    glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.5, transparent: true, opacity: 0.5 }); useSkyEnv(glass, 'glass');
    glow = new T.MeshBasicMaterial({ vertexColors: true });
    ensureKit();
    pool = new T.MeshBasicMaterial({ map: radialTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    warm = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  }
  return { solid: solid!, glass: glass!, glow: glow!, pool: pool!, warm: warm! };
}
function signTex(text: string, bg: string, fg: string, serif: boolean): T.CanvasTexture {
  const w = 1024, h = 160, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = serif ? 'italic 700 92px Georgia,"Times New Roman",serif' : '900 96px system-ui,"Segoe UI",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = w - 60; g.save(); g.translate(w / 2, h / 2 + 4); if (m > max) g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Simple figure: a seated guest or a walking waiter / chef. */
function figure(kind: 'guest' | 'waiter' | 'chef' | 'caycı', seed: number): T.Group {
  const g = new T.Group(), L = (c: string) => new T.MeshLambertMaterial({ color: c });
  const SK = ['#f1c9a5', '#d9a27a', '#b9805a', '#8a5a3c'], TOP = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#c94f6d', '#7d6bb0', '#f4f2ec', '#3a3d42'], HAIR = ['#1f1813', '#3a2416', '#6b4a2a', '#c9b08a'];
  const top = kind === 'guest' ? TOP[seed % TOP.length] : kind === 'chef' ? '#fbfaf6' : '#fbfaf6';
  const sit = kind === 'guest';
  const leg = new T.Mesh(new T.BoxGeometry(0.3, sit ? 0.42 : 0.8, sit ? 0.42 : 0.2), L(kind === 'guest' ? '#2f3a4a' : '#1d1d1d')); leg.position.set(0, sit ? 0.47 : 0.4, sit ? 0.12 : 0); g.add(leg);
  const body = new T.Mesh(new T.BoxGeometry(0.4, 0.52, 0.24), L(top)); body.position.y = sit ? 0.92 : 1.08; g.add(body);
  if (kind === 'waiter' || kind === 'caycı') { const ap = new T.Mesh(new T.BoxGeometry(0.36, 0.5, 0.02), L(kind === 'caycı' ? '#7a2a1d' : '#1d1d1d')); ap.position.set(0, sit ? 0.8 : 0.92, 0.13); g.add(ap); }
  const head = new T.Mesh(new T.SphereGeometry(0.15, 10, 8), L(SK[seed % 4])); head.position.y = (sit ? 0.92 : 1.08) + 0.42; g.add(head);
  if (kind === 'chef') { const hat = new T.Mesh(new T.CylinderGeometry(0.15, 0.13, 0.26, 10), L('#ffffff')); hat.position.y = head.position.y + 0.22; g.add(hat); }
  else { const hr = new T.Mesh(new T.SphereGeometry(0.155, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), L(HAIR[(seed >> 2) % 4])); hr.position.y = head.position.y + 0.02; g.add(hr); }
  if (kind === 'waiter') { const tray = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.02, 12), L('#c9ced6')); tray.position.set(0.28, 1.3, 0.1); g.add(tray); const gl = new T.Mesh(new T.CylinderGeometry(0.04, 0.035, 0.1, 8), L('#c0392b')); gl.position.set(0.28, 1.36, 0.1); g.add(gl); }
  g.traverse(o => { if ((o as T.Mesh).isMesh) (o as T.Mesh).castShadow = true; });
  return g;
}

interface Built { g: T.Group; walkers: { o: T.Object3D; path: [number, number][]; t: number; sp: number }[]; bobbers: T.Object3D[] }
function build(stage: number, signMats: T.MeshStandardMaterial[], flames: T.Object3D[]): Built {
  const root = new T.Group(); root.name = 'bufe-buyume-' + stage;
  let grp = root, b = new Batch(), gl = new Batch(), lit = new Batch(), wm = new Batch(); const pl = new Batch();
  /** upper floors + roofs of the halls: own meshes, hidden while the player is inside that hall (2026-11-09) */
  const catis: { g: T.Group; b: Batch; gl: Batch; lit: Batch; wm: Batch }[] = [];
  const walkers: Built['walkers'] = [], bobbers: T.Object3D[] = [];
  const glowAt = (x: number, z: number, r: number, c = '#ffb866', y = 0.13) => pl.plane(r * 2, r * 2, c, x, y, z, { rx: -HP, uv: [0, 0, 1, 1] });
  const fine = stage >= 10, frame = fine ? '#1f2a44' : '#f4f2ec', accent = fine ? '#c9a24a' : '#2f7fb3', wood = fine ? '#5a3b2a' : '#a8794e';
  const sign = (txt: string, x: number, y: number, z: number, w: number, ry = 0, bg = fine ? '#14192a' : '#2f7fb3', fg = fine ? '#e8c76a' : '#fbfaf6') => {
    const sm = new T.MeshStandardMaterial({ map: signTex(txt, bg, fg, fine), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 }); sm.emissiveMap = sm.map; signMats.push(sm);
    const sp = new T.Mesh(new T.PlaneGeometry(w, w * 0.156), sm); sp.position.set(x, y, z); sp.rotation.y = ry; grp.add(sp);
    b.box(w + 0.2, w * 0.156 + 0.14, 0.08, fine ? '#c9a24a' : '#f4f2ec', x - Math.sin(ry) * 0.05, y, z - Math.cos(ry) * 0.05, { ry });
  };
  const deck = (r: { x0: number; x1: number; z0: number; z1: number }, c = wood) => {
    const W = r.x1 - r.x0, D = r.z1 - r.z0; b.box(W, 0.12, D, c, cx(r), 0.06, cz(r));
    for (let i = 1; i < Math.round(W / 0.9); i++) b.box(0.025, 0.004, D, '#6f4a2c', r.x0 + i * W / Math.round(W / 0.9), 0.122, cz(r));
    b.box(W + 0.08, 0.05, 0.08, '#5a4330', cx(r), 0.1, r.z1); b.box(W + 0.08, 0.05, 0.08, '#5a4330', cx(r), 0.1, r.z0);
  };
  const planter = (x: number, z: number, w: number, d: number) => { b.box(w, 0.5, d, fine ? '#1f2a44' : '#f4f2ec', x, 0.37, z); const n = Math.max(1, Math.round(Math.max(w, d) / 0.7)); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n - 0.5; b.sph(0.32, ['#3f7a34', '#4f8f3a', '#5f9f45'][i % 3], x + (w > d ? t * w : 0), 0.82, z + (w > d ? 0 : t * d), { ws: 7, hs: 5 }); if (i % 2 === 0) b.sph(0.07, ['#e0533c', '#ffd23f', '#f2a2b3'][i % 3], x + (w > d ? t * w : 0) + 0.12, 1.05, z + (w > d ? 0 : t * d), { ws: 5, hs: 3 }); } };
  const table = (x: number, z: number, c: string, umb: boolean, cloth: boolean, guests: number, seed: number, y = 0.12) => {
    b.cyl(0.05, 0.08, 0.72, '#3a3d42', x, y + 0.36, z, { seg: 6 }); b.cyl(0.42, 0.42, 0.05, cloth ? '#fbfaf6' : '#d6aa78', x, y + 0.74, z, { seg: 14 });
    if (cloth) b.cyl(0.44, 0.47, 0.18, '#fbfaf6', x, y + 0.66, z, { seg: 14 });
    b.cyl(0.05, 0.05, 0.1, '#fbfaf6', x + 0.12, y + 0.81, z, { seg: 6 }); b.cyl(0.04, 0.035, 0.09, '#c0392b', x - 0.1, y + 0.81, z + 0.08, { seg: 6 });
    for (let k = 0; k < 4; k++) {
      const a = k * HP + 0.4, ccx = x + Math.cos(a) * 0.62, ccz = z + Math.sin(a) * 0.62;
      b.box(0.36, 0.05, 0.36, fine ? '#6b1f2a' : '#7d5638', ccx, y + 0.45, ccz); b.box(0.36, 0.42, 0.05, fine ? '#6b1f2a' : '#7d5638', ccx + Math.cos(a) * 0.17, y + 0.66, ccz + Math.sin(a) * 0.17, { ry: -a + HP });
      for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) b.box(0.03, 0.45, 0.03, '#3a3d42', ccx + dx, y + 0.22, ccz + dz);
      if (k < guests) { const f = figure('guest', seed * 7 + k); f.position.set(ccx, y, ccz); f.rotation.y = Math.atan2(x - ccx, z - ccz); grp.add(f); if (k === 0) bobbers.push(f); }
    }
    if (umb) { b.cyl(0.03, 0.03, 2.2, '#f4f2ec', x, y + 1.1, z, { seg: 6 }); b.cone(1.25, 0.5, c, x, y + 2.35, z, { seg: 8 }); b.cyl(1.26, 1.26, 0.12, c, x, y + 2.05, z, { seg: 8 }); }
    if (fine) lit.sph(0.05, '#ffcf6a', x, y + 0.86, z, { ws: 6, hs: 4 });
    glowAt(x, z, 1.8);
  };
  const walker = (kind: 'waiter' | 'chef' | 'caycı', path: [number, number][], seed: number, sp = 0.9) => { const f = figure(kind, seed); f.position.set(path[0][0], 0.12, path[0][1]); grp.add(f); walkers.push({ o: f, path, t: seed * 1.7 % path.length, sp }); };
  const lights = (pts: [number, number][], h = 2.9) => {
    pts.forEach(([x, z]) => b.cyl(0.05, 0.06, h + 0.1, '#33373b', x, (h + 0.1) / 2 + 0.12, z, { seg: 6 }));
    for (let p = 0; p < pts.length - 1; p++) { const [xa, za] = pts[p], [xb, zb] = pts[p + 1]; for (let i = 1; i < 10; i++) { const t = i / 10, sag = Math.sin(t * Math.PI) * 0.4; lit.sph(0.06, i % 2 ? '#ffd890' : '#fff3d6', xa + (xb - xa) * t, h - sag, za + (zb - za) * t, { ws: 6, hs: 4 }); } }
  };
  const hall = (r: { x0: number; x1: number; z0: number; z1: number }, floors: number, txt: string, roofTerrace: boolean, interiorCol: string) => {
    const pw = r.x1 - r.x0, pd = r.z1 - r.z0, ph = 3.4, X = cx(r), Z = cz(r);
    b.box(pw, 0.14, pd, fine ? '#2a2a30' : '#e9e0c8', X, 0.07, Z);
    const cat = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; cat.g.name = 'cati-' + (X < 0 ? 'W' : 'E'); catis.push(cat);
    const main = { grp, b, gl, lit, wm }, toCati = () => { grp = cat.g; b = cat.b; gl = cat.gl; lit = cat.lit; wm = cat.wm; }, toMain = () => { grp = main.grp; b = main.b; gl = main.gl; lit = main.lit; wm = main.wm; };
    for (let f = 0; f < floors; f++) {
      const y0 = f * ph; if (f > 0) toCati();
      gl.box(pw - 0.1, ph - 0.3, 0.04, '#a9d6ec', X, y0 + ph / 2, r.z1); gl.box(0.04, ph - 0.3, pd - 0.1, '#a9d6ec', r.x0, y0 + ph / 2, Z); gl.box(0.04, ph - 0.3, pd - 0.1, '#a9d6ec', r.x1, y0 + ph / 2, Z);
      b.box(pw, ph, 0.22, fine ? '#2a3550' : '#efe6d2', X, y0 + ph / 2, r.z0 + 0.11);   // solid back wall (sea side)
      for (let i = 0; i <= 6; i++) b.box(0.14, ph, 0.14, frame, r.x0 + pw * i / 6, y0 + ph / 2, r.z1);
      for (let i = 1; i < 4; i++) { b.box(0.14, ph, 0.14, frame, r.x0, y0 + ph / 2, r.z0 + pd * i / 4); b.box(0.14, ph, 0.14, frame, r.x1, y0 + ph / 2, r.z0 + pd * i / 4); }
      { const mb = b; b = cat.b; b.box(pw + 0.3, 0.22, pd + 0.3, frame, X, y0 + ph, Z); b = mb; }   // ceiling slab hides with the roof
      if (f > 0) wm.box(pw - 0.4, ph - 0.6, pd - 0.4, interiorCol, X, y0 + ph / 2, Z);   // ground floor: a real room (view/world/ic-mekan-look.ts)
      if (f > 0) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) table(r.x0 + 1.8 + i * (pw - 3.6) / 2, r.z0 + 1.7 + j * (pd - 3.2), '#fff', false, true, (i + j + f) % 3 === 0 ? 1 : 2, i * 3 + j + f * 11 + Math.round(X), y0 + 0.14);
      for (let i = 0; i < 3; i++) { const x = r.x0 + pw * (i + 0.5) / 3; if (fine) { b.cyl(0.02, 0.02, 0.6, '#c9a24a', x, y0 + ph - 0.3, Z, { seg: 4 }); b.tor(0.38, 0.03, '#c9a24a', x, y0 + ph - 0.62, Z, { rx: HP, rs: 4, ts: 16 }); for (let k = 0; k < 8; k++) lit.sph(0.06, '#ffe6b0', x + Math.cos(k * 0.785) * 0.38, y0 + ph - 0.55, Z + Math.sin(k * 0.785) * 0.38, { ws: 6, hs: 4 }); } else lit.cyl(0.22, 0.3, 0.2, '#fff3d6', x, y0 + ph - 0.3, Z, { seg: 10 }); }
    }
    const top = floors * ph; toCati();
    b.box(pw + 0.9, 0.3, pd + 0.9, frame, X, top + 0.15, Z); b.box(pw + 0.8, 0.06, pd + 0.8, roofTerrace ? wood : '#d9d4c8', X, top + 0.33, Z);
    for (const [w2, d2, ox, oz] of [[pw + 1.0, 0.12, 0, (pd + 0.9) / 2], [pw + 1.0, 0.12, 0, -(pd + 0.9) / 2], [0.12, pd + 1.0, (pw + 0.9) / 2, 0], [0.12, pd + 1.0, -(pw + 0.9) / 2, 0]]) b.box(w2, 0.36, d2, accent, X + ox, top + 0.16, Z + oz);
    toMain(); gl.box(1.6, 2.5, 0.04, '#cfe6f2', X - 0.95, 1.3, r.z1 + 0.3, { ry: 1.1 }); b.box(1.9, 0.1, 0.12, fine ? '#c9a24a' : frame, X, 2.6, r.z1 + 0.05);   // glass door standing open
    b.box(2.6, 0.12, 1.4, accent, X, 2.85, r.z1 + 0.7); for (const s2 of [-1, 1]) b.box(0.06, 0.06, 1.4, '#3a3d42', X + s2 * 1.2, 2.7, r.z1 + 0.7, { rx: 0.4 });   // door canopy
    glowAt(X, r.z1 + 1.6, 3.2); toCati();
    sign(txt, X, top + 0.9, r.z1 + 0.5, Math.min(7, pw - 1));
    if (roofTerrace) {
      const ry = top + 0.36, rr = (xa: number, za: number, xb: number, zb: number) => { const len = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), n = Math.round(len / 1.2); b.box(0.08, 0.07, len, accent, (xa + xb) / 2, ry + 1.0, (za + zb) / 2, { ry: a }); for (let i = 0; i <= n; i++) b.box(0.05, 1.0, 0.05, frame, xa + (xb - xa) * i / n, ry + 0.5, za + (zb - za) * i / n); };
      rr(r.x0 - 0.3, r.z0 - 0.3, r.x1 + 0.3, r.z0 - 0.3); rr(r.x0 - 0.3, r.z1 + 0.3, r.x1 + 0.3, r.z1 + 0.3); rr(r.x0 - 0.3, r.z0 - 0.3, r.x0 - 0.3, r.z1 + 0.3); rr(r.x1 + 0.3, r.z0 - 0.3, r.x1 + 0.3, r.z1 + 0.3);
      for (let i = 0; i < 4; i++) table(r.x0 + 1.5 + i * (pw - 3) / 3, Z, fine ? '#f4f2ec' : UMB[(i + 2) % UMB.length], true, fine, i % 2 ? 2 : 1, 40 + i + Math.round(X), ry);
      for (let s2 = 0; s2 < 14; s2++) b.box(0.9, 0.12, 0.34, '#8a6a4a', (r.x0 < 0 ? r.x1 + 0.55 : r.x0 - 0.55), 0.25 + s2 * (ry / 14), r.z1 - 0.3 - s2 * 0.4);   // outside stair
      lights([[r.x0 - 0.3, r.z0 - 0.3], [r.x0 - 0.3, r.z1 + 0.3], [r.x1 + 0.3, r.z1 + 0.3], [r.x1 + 0.3, r.z0 - 0.3]].map(([x, z]) => [x, z] as [number, number]), ry + 2.2);
    }
    toMain();
  };

  /* 2: flower boxes, menu easel, bistro sets at the pier mouth */
  if (stage >= 2) {
    for (const x of [-9.0, -6.6, 4.4, 6.8]) planter(x, 3.95, 1.8, 0.5);
    b.box(0.9, 1.25, 0.06, '#2b2b2b', 2.4, 0.75, 3.7, { rx: -0.18 }); b.box(0.8, 1.1, 0.02, '#3a4a3a', 2.4, 0.77, 3.74, { rx: -0.18 });   // menu easel (chalk board)
    for (let i = 0; i < 5; i++) lit.box(0.5 - i * 0.06, 0.02, 0.01, '#f4f2ec', 2.4, 1.1 - i * 0.16, 3.78, { rx: -0.18 });
  }
  /* 3: west Çay bahçesi */
  if (stage >= 3) {
    const r = stage >= 5 ? WT : { ...WT, z0: -9.4, z1: -0.6 };
    deck(r);
    WT_TABLES.slice(0, wtN(stage)).forEach(([x, z], i) => table(x, z, fine ? '#f4f2ec' : UMB[i % UMB.length], stage < 5 || z < -4.4 || x > WT.x1 - 1.5, fine, (i * 5 + stage) % 4, i + 3)   /* no umbrellas under the pergola */);
    // çay ocağı: counter, semaver, tulip glasses, awning
    const ox = WT.x0 + 0.8; b.box(1.2, 1.0, 2.6, fine ? '#2a2a30' : '#8a5a3a', ox, 0.62, -7.7); b.box(1.3, 0.06, 2.7, '#e9e0c8', ox, 1.15, -7.7);
    b.cyl(0.24, 0.3, 0.7, '#c9a23a', ox, 1.53, -8.4, { seg: 14 }); b.cyl(0.1, 0.16, 0.25, '#c9a23a', ox, 2.0, -8.4, { seg: 10 });
    for (let i = 0; i < 6; i++) b.cyl(0.04, 0.03, 0.1, '#b0281e', ox + 0.25, 1.24, -7.2 + i * 0.16, { seg: 6 });
    for (let i = 0; i < 6; i++) b.box(1.5, 0.05, 0.46, i % 2 ? '#fbfaf6' : '#c0392b', ox + 0.1, 2.5, -9.0 + i * 0.46, { rz: -0.25 });
    b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -9.2); b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -6.2);
    sign('SABRİ ÇAY BAHÇESİ', ox + 0.8, 3.05, -7.7, 3.2, HP);
    walker('caycı', [[ox + 1.1, -8.6], [-19.0, -4.6], [-14.6, -4.6], [-14.6, -8.4], [ox + 1.1, -8.6]], 3, 0.8);
    planter(WT.x0 + 0.4, r.z1 - 1.6, 0.5, 2.4); planter(cx(WT), WT.z0 + 0.3, 6.0, 0.5);
  }
  /* 4: east Dondurma & gazoz terası */
  if (stage >= 4) {
    const r = stage >= 7 ? ET : { ...ET, x1: 17.2 };
    deck(r);
    ET_TABLES.slice(0, etN(stage)).forEach(([x, z], i) => table(x, z, fine ? '#f4f2ec' : UMB[(i + 3) % UMB.length], true, fine, (i * 3 + stage) % 4, i + 20));
    const dx = ET.x1 - 0.7; b.box(1.2, 1.5, 1.7, fine ? '#1f2a44' : '#3fb5b0', dx, 0.87, ET.z0 + 1.15); gl.box(0.04, 1.0, 1.4, '#cfeaf5', dx - 0.62, 1.0, ET.z0 + 1.15);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(0.12, 0.2, 0.12, ['#e0533c', '#ffd23f', '#7ed957', '#f2a2b3'][(i + j) % 4], dx - 0.5, 0.6 + j * 0.3, ET.z0 + 0.6 + i * 0.32);
    sign('DONDURMA · GAZOZ', dx - 0.2, 1.95, ET.z0 + 1.15, 1.9, -HP);
    walker('waiter', [[12.0, 0.0], [17.0, 0.0], [17.0, -2.8], [12.0, -2.8]], 5, 0.9);
    planter(cx(r), ET.z1 + 0.3, Math.min(6.5, r.x1 - r.x0 - 1), 0.5);
  }
  /* 5: pergola with vines over the west deck, string lights over the pier mouth */
  if (stage >= 5) {
    const px0 = WT.x0 + 1.8, px1 = WT.x1 - 0.4, pz0 = -4.4, pz1 = WT.z1 - 0.4;
    for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1], [(px0 + px1) / 2, pz0], [(px0 + px1) / 2, pz1]]) b.box(0.16, 2.9, 0.16, frame, x, 1.57, z);
    for (let i = 0; i < 10; i++) b.box(px1 - px0 + 0.3, 0.08, 0.1, '#8a6a4a', (px0 + px1) / 2, 3.0, pz0 + i * (pz1 - pz0) / 9);
    for (let i = 0; i < 40; i++) { const x = px0 + ((i * 37) % 97) / 97 * (px1 - px0), z = pz0 + ((i * 53) % 89) / 89 * (pz1 - pz0); b.box(0.9 + (i % 3) * 0.25, 0.07, 0.6 + (i % 2) * 0.3, ['#4f8f3a', '#5f9f45', '#3f7a34'][i % 3], x, 3.07 + (i % 4) * 0.015, z, { ry: i * 0.7 }); if (i % 5 === 0) b.sph(0.07, i % 10 ? '#c94f6d' : '#f2a2b3', x + 0.2, 3.12, z, { ws: 5, hs: 3 }); }
    lights([[-10.3, 3.7], [-5.0, 3.9], [0.0, 4.0], [4.6, 3.9], [7.9, 3.7]], 3.4);
    walker('waiter', [[-14.0, -2.0], [-18.4, -2.0], [-18.4, 2.2], [-14.0, 2.2]], 7, 0.85);
  }
  /* 6: west hall: Kahvaltı salonu */
  if (stage >= 6) { hall(WB, 1, fine ? 'SABRİ\'NİN SOFRASI · SALON' : stage >= 8 ? 'SABRİ KAHVALTI & MEZE' : 'SABRİ KAHVALTI SALONU', stage >= 8, '#ffcf8a'); walker('waiter', [[-21.5, -9.9], [-13.0, -9.9], [-13.0, -8.0], [-21.0, -8.0]], 9, 1.0); }
  /* 7: east hall: Balık lokantası */
  if (stage >= 7) { hall(EB, stage >= 8 ? 2 : 1, fine ? 'SABRİ\'NİN SOFRASI' : stage >= 8 ? 'SABRİ BOĞAZ LOKANTASI' : 'SABRİ BALIK LOKANTASI', stage >= 8, '#ffd9a0'); walker('waiter', [[10.6, -10.0], [20.6, -10.0], [20.6, -9.4], [10.6, -9.4]], 11, 1.1); }
  /* 9: open grill kitchen, arcade behind the kiosk, rooftop sign on the kiosk */
  if (stage >= 9) {
    const kx = ET.x1 - 1.5, kz = -3.0;
    b.box(3.0, 0.95, 1.1, fine ? '#2a2a30' : '#c9ced6', kx, 0.6, kz); b.box(3.1, 0.06, 1.2, '#e9eef2', kx, 1.1, kz);
    b.box(3.0, 2.6, 0.18, fine ? '#1f2a44' : '#e9e0c8', kx, 1.42, kz - 0.7);
    for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) b.box(0.36, 0.3, 0.02, (i + j) % 2 ? '#3fb5b0' : '#f6f8fb', kx - 1.2 + i * 0.4, 1.3 + j * 0.34, kz - 0.6);
    b.box(2.4, 0.5, 1.0, '#9aa2ab', kx, 2.75, kz - 0.25); b.box(0.5, 2.6, 0.5, '#9aa2ab', kx + 0.8, 4.2, kz - 0.5);
    b.box(1.4, 0.08, 0.7, '#1a1a1a', kx - 0.6, 1.15, kz);
    for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.ConeGeometry(0.07, 0.3, 5), new T.MeshBasicMaterial({ color: i % 2 ? '#ffb347' : '#ff7a2f', transparent: true, opacity: 0.9, depthWrite: false })); f.position.set(kx - 1.1 + i * 0.2, 1.32, kz); f.userData.ph = i * 1.7; grp.add(f); flames.push(f); }
    sign('ŞEF MUTFAĞI · IZGARA', kx, 3.35, kz + 0.2, 2.8);
    walker('chef', [[kx - 0.8, kz + 0.75], [kx + 0.8, kz + 0.75]], 13, 0.5); walker('chef', [[kx + 0.6, kz + 0.75], [kx - 1.0, kz + 0.75]], 15, 0.4);
    // arcade over the customer walkway behind the kiosk (posts on the sea side only, so the path stays free)
    for (let x = -11.0; x <= 8.5; x += 3.9) b.box(0.14, 3.2, 0.14, frame, x, 1.72, -13.3);
    for (let i = 0; i < 26; i++) b.box(0.16, 0.1, 2.6, wood, -11.0 + i * 0.78, 3.3, -12.05); b.box(19.8, 0.14, 0.14, frame, -1.25, 3.22, -13.3); b.box(19.8, 0.22, 0.12, accent, -1.25, 3.25, -10.8);   // slatted arcade roof
    for (let x = -10.5; x <= 8.0; x += 1.5) lit.sph(0.07, '#ffe6b0', x, 3.12, -12.0, { ws: 6, hs: 4 });
    // rooftop sign over the kiosk
    sign(fine ? 'SABRİ\'NİN SOFRASI' : 'SABRİ\'NİN BÜFESİ · 1987', 0, 5.4, -7.6, 7.0, 0, fine ? '#14192a' : '#e0533c', fine ? '#e8c76a' : '#fff6e6');
    for (const x of [-3.0, 3.0]) b.box(0.12, 1.6, 0.12, '#3a3d42', x, 4.5, -7.7);
  }
  /* 10: fine dining arrival */
  if (fine) {
    b.box(1.5, 0.025, 7.4, '#9a1f2a', -0.25, 0.02, 0.6); b.box(1.58, 0.02, 7.44, '#c9a24a', -0.25, 0.012, 0.6);   // red carpet along the queue
    for (const s2 of [-1, 1]) for (let i = 0; i < 5; i++) { const z = -2.6 + i * 1.65, x = -0.25 + s2 * 1.0; b.cyl(0.03, 0.03, 0.9, '#c9a24a', x, 0.45, z, { seg: 6 }); b.sph(0.06, '#c9a24a', x, 0.92, z, { ws: 6, hs: 4 }); }
    // gold arch at the pier mouth
    for (const x of [-3.6, 3.1]) { b.box(0.4, 4.6, 0.4, '#1f2a44', x, 2.3, 4.15); b.box(0.5, 0.2, 0.5, '#c9a24a', x, 4.6, 4.15); b.box(0.5, 0.2, 0.5, '#c9a24a', x, 0.1, 4.15); lit.cyl(0.1, 0.12, 0.08, '#ffe6b0', x, 0.06, 4.6, { seg: 8 }); }
    b.box(7.1, 0.3, 0.3, '#c9a24a', -0.25, 4.75, 4.15); sign('SABRİ\'NİN SOFRASI', -0.25, 4.2, 4.33, 5.6, 0);
    b.box(0.6, 1.1, 0.4, '#1f2a44', 4.2, 0.55, 5.6); b.box(0.66, 0.06, 0.46, '#c9a24a', 4.2, 1.12, 5.6);   // valet podium on the promenade
    for (const [x, z] of [[-4.6, 3.3], [4.0, 3.3], [WT.x1 + 0.6, -9.6], [EB.x0 - 0.6, -9.6], [WT.x0 + 0.6, WT.z1 + 0.2], [ET.x1 - 0.4, ET.z1 + 0.3]]) { b.cyl(0.32, 0.26, 0.6, '#f4f2ec', x, 0.3, z, { seg: 10 }); b.sph(0.42, '#3f7a34', x, 0.95, z, { ws: 8, hs: 6 }); b.sph(0.3, '#4f8f3a', x, 1.5, z, { ws: 8, hs: 6 }); }
    walker('waiter', [[2.0, -2.0], [5.6, -2.0], [5.6, 2.6], [2.0, 2.6]], 17, 0.8);
  }

  const { solid: sm, glass: gm, glow: lm, pool: pm, warm: wmm } = mats();
  for (const c of catis) {
    if (!c.wm.empty) { const w2 = c.wm.mesh(wmm, false, false); w2.renderOrder = 1; c.g.add(w2); }
    if (!c.b.empty) c.g.add(c.b.mesh(sm, true, true));
    if (!c.gl.empty) { const g2 = c.gl.mesh(gm, false, false); g2.renderOrder = 2; c.g.add(g2); }
    if (!c.lit.empty) { const l = c.lit.mesh(lm, false, false); c.g.add(l); }
    grp.add(c.g);
  }
  if (!pl.empty) { const p2 = pl.mesh(pm, false, false); p2.renderOrder = 3; grp.add(p2); }
  if (!wm.empty) { const w2 = wm.mesh(wmm, false, false); w2.renderOrder = 1; grp.add(w2); }
  if (!b.empty) grp.add(b.mesh(sm, true, true));
  if (!gl.empty) { const g2 = gl.mesh(gm, false, false); g2.renderOrder = 2; grp.add(g2); }
  if (!lit.empty) { const l = lit.mesh(lm, false, false); l.name = 'lights'; grp.add(l); }
  return { g: root, walkers, bobbers };
}

/** Construction site while a wing tadilat (to 3..10) runs, on the wing that stage builds: scaffold towers, a tower crane with a
 *  swinging hook, barriers, a site sign and hard-hat workers hammering. Deck planks appear with the progress (stages 3-5). */
const SITE_AREA: Record<number, { x0: number; x1: number; z0: number; z1: number }> = { 3: { ...WT, z1: -0.6 }, 4: { ...ET, x1: 17.2 }, 5: WT, 6: WB, 7: EB, 8: EB, 9: ET, 10: { x0: -5, x1: 5, z0: -3.5, z1: 3.8 } };
function buildSite(to: number): { g: T.Group; workers: T.Object3D[]; hook: T.Object3D; planks: T.Object3D[] } {
  const R = SITE_AREA[to] || WT, X0 = R.x0, X1 = R.x1, Z0 = R.z0, Z1 = R.z1, XC = cx(R);
  const g = new T.Group(); g.name = 'insaat'; const b = new Batch(); const workers: T.Object3D[] = [], planks: T.Object3D[] = [];
  for (const [x, z] of [[X0 + 0.9, Z0 + 0.9], [X1 - 0.9, Z0 + 0.9], [X0 + 0.9, Z1 - 0.9], [X1 - 0.9, Z1 - 0.9]]) {   // scaffold towers
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box(0.06, 4.2, 0.06, '#c9ced6', x + dx, 2.1, z + dz);
    for (let y = 0.8; y < 4.3; y += 1.1) { b.box(1.3, 0.05, 1.3, '#a8794e', x, y, z); b.box(1.25, 0.04, 0.04, '#e0533c', x, y + 0.5, z - 0.6); }
  }
  // tower crane at the sea-side corner of the site
  const ccx = X0 < 0 ? X0 + 0.6 : X1 - 0.6, ccz = Math.max(PIER.z0 + 0.8, Z0 - 0.2), dir = X0 < 0 ? 1 : -1;
  b.box(0.8, 0.4, 0.8, '#5b6068', ccx, 0.2, ccz); for (let y = 0; y < 11; y += 1) { for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.box(0.06, 1, 0.06, '#ffd23f', ccx + ox, y + 0.9, ccz + oz); b.box(0.66, 0.05, 0.05, '#ffd23f', ccx, y + 0.5, ccz - 0.3, { rz: 0.8 }); }
  b.box(13, 0.35, 0.5, '#ffd23f', ccx + dir * 5.5, 11.6, ccz); b.box(1.4, 1.0, 1.0, '#e0533c', ccx, 12.2, ccz); b.box(1.5, 0.9, 0.9, '#5b6068', ccx - dir * 2.2, 11.3, ccz);
  const hook = new T.Group(); hook.position.set(ccx + dir * 8, 11.4, ccz); const cable = new T.Mesh(new T.BoxGeometry(0.03, 6, 0.03), new T.MeshLambertMaterial({ color: '#222' })); cable.position.y = -3; hook.add(cable);
  const load = new T.Mesh(new T.BoxGeometry(1.6, 0.3, 0.8), new T.MeshLambertMaterial({ color: '#a8794e' })); load.position.y = -6.2; hook.add(load); g.add(hook);
  // barriers along the open (promenade) side + site sign
  for (let x = X0 + 0.8; x < X1 - 0.6; x += 1.6) { b.box(1.3, 0.8, 0.2, '#f4f2ec', x, 0.4, Z1 + 0.35); b.box(1.32, 0.18, 0.22, '#e0533c', x, 0.55, Z1 + 0.35); }
  b.box(2.2, 1.3, 0.08, '#ffd23f', XC, 1.3, Z1 + 0.5); b.box(0.08, 1.2, 0.08, '#3a3d42', XC - 0.8, 0.6, Z1 + 0.5); b.box(0.08, 1.2, 0.08, '#3a3d42', XC + 0.8, 0.6, Z1 + 0.5);
  const m = b.mesh(mats().solid, true, true); g.add(m);
  const skin = new T.MeshLambertMaterial({ color: '#d9a27a' }), vest = new T.MeshLambertMaterial({ color: '#ff8a1f' }), hat = new T.MeshLambertMaterial({ color: '#ffd23f' }), pants = new T.MeshLambertMaterial({ color: '#2f4a6a' });
  const W = X1 - X0, D = Z1 - Z0;
  const spots: [number, number][] = [[X0 + W * 0.25, Z0 + D * 0.3], [X0 + W * 0.6, Z0 + D * 0.25], [X0 + W * 0.8, Z0 + D * 0.6], [X0 + W * 0.3, Z0 + D * 0.7], [X0 + W * 0.55, Z0 + D * 0.85], [X0 + W * 0.15, Z0 + D * 0.5]];
  spots.forEach(([x, z], i) => {
    const w = new T.Group(); w.position.set(x, 0, z); w.rotation.y = i * 1.3;
    const leg = new T.Mesh(new T.BoxGeometry(0.32, 0.8, 0.2), pants); leg.position.y = 0.4; w.add(leg);
    const body = new T.Mesh(new T.BoxGeometry(0.42, 0.55, 0.26), vest); body.position.y = 1.08; w.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.15, 8, 6), skin); head.position.y = 1.52; w.add(head);
    const h = new T.Mesh(new T.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), hat); h.position.y = 1.56; w.add(h);
    const arm = new T.Group(); arm.position.set(0.26, 1.3, 0); const a = new T.Mesh(new T.BoxGeometry(0.1, 0.5, 0.1), vest); a.position.y = -0.22; arm.add(a);
    const hm = new T.Mesh(new T.BoxGeometry(0.06, 0.06, 0.3), new T.MeshLambertMaterial({ color: '#5b6068' })); hm.position.set(0, -0.48, 0.1); arm.add(hm); w.add(arm);
    w.userData.arm = arm; w.userData.ph = i * 0.9; g.add(w); workers.push(w);
  });
  if (to <= 5) for (let i = 0; i < 12; i++) { const pk = new T.Mesh(new T.BoxGeometry(W, 0.12, D / 12), new T.MeshLambertMaterial({ color: i % 2 ? '#a8794e' : '#9c6f46' })); pk.position.set(XC, 0.06, Z0 + (i + 0.5) * D / 12); pk.visible = false; g.add(pk); planks.push(pk); }
  return { g, workers, hook, planks };
}

/** Sponsor banners: from stage 3 the büfe sponsors the player's club. Banners on the halı saha fences and a club flag
 *  on the pier (restaurant flagpole). Visual tie between the business and the league. */
function buildSponsor(tk: { ad: string; renk: string; renk2?: string }, stage: number): T.Group {
  const g = new T.Group(); g.name = 'sponsor';
  const tx = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const name = stage >= 10 ? 'SABRİ\'NİN SOFRASI' : stage >= 6 ? 'SABRİ RESTORAN' : 'SABRİ\'NİN BÜFESİ';
  const ban = tx(1024, 128, x => { x.fillStyle = tk.renk || '#2f7fb3'; x.fillRect(0, 0, 1024, 128); x.fillStyle = tk.renk2 || '#ffffff'; x.fillRect(0, 100, 1024, 28); x.fillStyle = '#fff'; x.font = '900 64px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name + '  ★  ' + tk.ad.toLocaleUpperCase('tr-TR'), 512, 54); });
  const bm = new T.MeshLambertMaterial({ map: ban, side: T.DoubleSide });
  for (const [x, z] of [[-45.5, 36.15], [-33.5, 36.15], [-45.5, 54.65], [-33.5, 54.65]]) { const m = new T.Mesh(new T.PlaneGeometry(9, 1.1), bm); m.position.set(x, 0.75, z); g.add(m); }
  const fl = tx(256, 160, x => { x.fillStyle = tk.renk || '#2f7fb3'; x.fillRect(0, 0, 256, 160); x.fillStyle = tk.renk2 || '#fff'; x.fillRect(0, 60, 256, 40); });
  const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 6, 6), new T.MeshLambertMaterial({ color: '#d6d9de' })); pole.position.set(PIER.x0 + 0.6, 3, 3.6); g.add(pole);
  const flag = new T.Mesh(new T.PlaneGeometry(1.6, 1.0, 8, 1), new T.MeshLambertMaterial({ map: fl, side: T.DoubleSide })); flag.position.set(PIER.x0 + 1.42, 5.4, 3.6); flag.name = 'kflag'; g.add(flag);
  return g;
}
/** Seasonal decor by the real date: national-day flag bunting (23 Nisan, 19 Mayıs, 30 Ağustos, 29 Ekim weeks),
 *  tulips in April (İstanbul lale zamanı), New Year lights and a tree in late December / early January. */
let zorla = '';
/** admin preview: '' = calendar, 'yok' = off, or a decor id. Returns the current override. */
export function mevsimZorla(k?: string): string { if (k !== undefined) zorla = k; return zorla; }
export function mevsim(d = new Date()): 'bayrak' | 'lale' | 'yilbasi' | null {
  if (zorla) return zorla === 'yok' ? null : zorla as 'bayrak';
  const m = d.getMonth() + 1, day = d.getDate(), near = (mm: number, dd: number) => m === mm && Math.abs(day - dd) <= 3;
  if (near(4, 23) || near(5, 19) || near(8, 30) || near(10, 29) || (m === 11 && day <= 1)) return 'bayrak';
  if ((m === 12 && day >= 20) || (m === 1 && day <= 6)) return 'yilbasi';
  if (m === 4) return 'lale';
  return null;
}
function buildMevsim(k: 'bayrak' | 'lale' | 'yilbasi'): T.Group {
  const g = new T.Group(); g.name = 'mevsim-' + k; const b = new Batch(), lit = new Batch();
  if (k === 'bayrak' || k === 'yilbasi') {
    for (const x of [PIER.x0 + 0.3, PIER.x1 - 0.3]) b.cyl(0.06, 0.07, 4.6, '#d6d9de', x, 2.3, 4.0, { seg: 6 });
    const n = 46;
    for (let i = 0; i <= n; i++) { const t = i / n, x = PIER.x0 + 0.3 + (PIER.x1 - PIER.x0 - 0.6) * t, y = 4.4 - Math.sin(t * Math.PI) * 0.9;
      if (k === 'bayrak') { b.cone(0.22, 0.42, i % 2 ? '#e30a17' : '#e30a17', x, y - 0.25, 4.0, { seg: 3, rz: Math.PI }); if (i % 2) b.sph(0.05, '#ffffff', x, y - 0.2, 4.03, { ws: 5, hs: 3 }); }
      else lit.sph(0.08, ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7dff6a', '#ff7ad9'][i % 5], x, y - 0.1, 4.0, { ws: 6, hs: 4 }); }
  }
  if (k === 'yilbasi') { const x = PIER.x0 - 4, z = 8.5; b.cyl(0.15, 0.2, 0.8, '#6b4a2e', x, 0.4, z, { seg: 8 }); for (let i = 0; i < 4; i++) b.cone(1.6 - i * 0.35, 1.3, '#2f7d3a', x, 1.2 + i * 0.85, z, { seg: 10 }); lit.sph(0.22, '#ffd23f', x, 4.6, z, { ws: 8, hs: 6 }); for (let i = 0; i < 24; i++) { const a = i * 2.4, h = 1.0 + (i / 24) * 3.2, r = 1.5 - (i / 24) * 1.2; lit.sph(0.08, ['#ff4d4d', '#ffd23f', '#4dd2ff'][i % 3], x + Math.cos(a) * r, h, z + Math.sin(a) * r, { ws: 5, hs: 3 }); } }
  if (k === 'lale') for (let x = -58; x <= 58; x += 4) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; b.box(1.6, 0.4, 0.6, '#8a6a4a', x, 0.2, 12.6); for (let i = 0; i < 7; i++) { b.cyl(0.015, 0.015, 0.4, '#3f7a34', x - 0.6 + i * 0.2, 0.6, 12.6, { seg: 4 }); b.sph(0.08, ['#e0533c', '#ffd23f', '#f2a2b3', '#c94f6d'][(i + x) & 3], x - 0.6 + i * 0.2, 0.84, 12.6, { ws: 6, hs: 4, sy: 1.4 } as never); } }
  const M = mats(); if (!b.empty) g.add(b.mesh(M.solid, true, true)); if (!lit.empty) g.add(lit.mesh(M.glow, false, false));
  return g;
}

export function createBufeBuyume(deps: BuyumeDeps): BuyumeView {
  let spon: T.Group | null = null, sponKey = '', mev: T.Group | null = null, mevKey = '';
  let site: ReturnType<typeof buildSite> | null = null, siteTo = 0;
  let built = -1, grp: T.Group | null = null, t = 0, cur: Built | null = null;
  const signMats: T.MeshStandardMaterial[] = [], flames: T.Object3D[] = [];
  const clear = () => {
    if (!grp) return; grp.parent?.remove(grp);
    grp.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material && signMats.includes(m.material as T.MeshStandardMaterial)) { const mm = m.material as T.MeshStandardMaterial; mm.map?.dispose(); mm.dispose(); } });
    grp = null; signMats.length = 0; flames.length = 0;
  };
  return {
    update(dt) {
      t += dt;
      const root = deps.root(), st = Math.round(deps.stage() || 1);
      if (!root) { if (grp) clear(); built = -1; return; }
      if (st !== built || (grp && grp.parent !== root)) { clear(); built = st; cur = null; if (st >= 2) { cur = build(st, signMats, flames); grp = cur.g; root.add(grp); } }
      const td = deps.tadilat?.() ?? null, wantSite = td && td.to >= 3 ? td.to : 0;
      if (wantSite !== siteTo || (site && site.g.parent !== root)) { if (site) { site.g.removeFromParent(); site.g.traverse(o => { (o as T.Mesh).geometry?.dispose(); }); site = null; } siteTo = wantSite; if (wantSite) { site = buildSite(wantSite); root.add(site.g); } }
      if (site && td) {
        for (const w of site.workers) { const arm = w.userData.arm as T.Object3D; arm.rotation.x = -0.6 - Math.max(0, Math.sin(t * 6 + w.userData.ph)) * 1.1; }
        site.hook.rotation.y = Math.sin(t * 0.3) * 0.5; site.hook.children[1].position.y = -6.2 + Math.sin(t * 0.7) * 1.5;
        site.planks.forEach((pk, i) => { pk.visible = i < Math.floor(td.p * site!.planks.length); });
      }
      const tk = deps.takim?.() ?? null, sk = tk && st >= 3 ? tk.ad + tk.renk + (tk.renk2 || '') + (st >= 10 ? 'a' : st >= 6 ? 'b' : 'c') : '';
      if (sk !== sponKey || (spon && spon.parent !== root)) { if (spon) { spon.removeFromParent(); spon = null; } sponKey = sk; if (sk && tk) { spon = buildSponsor(tk, st); root.add(spon); } }
      if (spon) { const f = spon.getObjectByName('kflag') as T.Mesh | null; if (f) { const p = f.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.8; p.setZ(i, Math.sin(t * 3 + x * 2.6) * 0.1 * x); } p.needsUpdate = true; } }
      const mk = mevsim() ?? '';
      if (mk !== mevKey || (mev && mev.parent !== root)) { if (mev) { mev.removeFromParent(); mev = null; } mevKey = mk; if (mk) { mev = buildMevsim(mk as 'bayrak'); root.add(mev); } }
      if (!grp) return;
      const hp = deps.hero?.();
      if (hp) for (const [nm, m] of [['cati-W', IC_BY_ID.salonW], ['cati-E', IC_BY_ID.salonE]] as const) { const o = grp.getObjectByName(nm); if (o) o.visible = !icIcinde(m, hp, 0.2); }
      const n = deps.night();
      const M = mats(); M.glow.color.setScalar(0.55 + 0.45 * n); M.pool.opacity = 0.75 * n; M.warm.opacity = 0.35 * n;
      for (const s of signMats) s.emissiveIntensity = 0.25 + n * 0.5;
      if (cur) {   // staff walk their rounds, guests shift in their seats
        for (const w of cur.walkers) {
          const P = w.path, n = P.length; w.t = (w.t + dt * w.sp / Math.max(0.5, Math.hypot(P[(Math.floor(w.t) + 1) % n][0] - P[Math.floor(w.t) % n][0], P[(Math.floor(w.t) + 1) % n][1] - P[Math.floor(w.t) % n][1]))) % n;
          const i = Math.floor(w.t), f = w.t - i, a = P[i % n], c = P[(i + 1) % n];
          w.o.position.set(a[0] + (c[0] - a[0]) * f, 0.12 + Math.abs(Math.sin(t * 8 + i)) * 0.03, a[1] + (c[1] - a[1]) * f); w.o.rotation.y = Math.atan2(c[0] - a[0], c[1] - a[1]);
        }
        cur.bobbers.forEach((o, i) => { o.rotation.z = Math.sin(t * 1.3 + i) * 0.05; });
      }
      for (const f of flames) { const k = 0.8 + 0.3 * Math.sin(t * 13 + f.userData.ph) + 0.15 * Math.sin(t * 29 + f.userData.ph * 2); f.scale.set(1, k, 1); }
    },
    dispose() { clear(); },
  };
}
