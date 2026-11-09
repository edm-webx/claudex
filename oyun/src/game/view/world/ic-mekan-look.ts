/**
 * İç mekanlar görünümü (2026-11-09, owner: "her binaya girilebilmeli, her birinde geliştirmeler, yeni aletler, kafede kahve
 * makinesi; her yerde bir şey olmalı"). One dollhouse room per building of content/ic-mekan.ts: floor, inward-facing walls
 * (the near walls cull away, so a 3rd-person camera sees in), a cut wall cap, windows, door frame, pendant lamps, the
 * furniture layout, the BOUGHT equipment of that business (sim/mulk plot esya, büfe salon esya), staff behind the counter
 * (hired workers), seated guests, students, patients. Built only near the player, shown while inside (far side: the
 * exterior shell hides, view/world/karsi-bina.ts) or always for the glass büfe halls. Pure view, no sim, no colliders.
 */
import * as T from 'three';
import { mutfakEsya, mutfakCelik } from '../../../content/mutfak';
import { Batch, mtx } from '../../../engine/prefab/batch';
import { IC_MEKANLAR, icLayout, icDim, icYaw, icIcinde, type IcMekan, type IcItem } from '../../../content/ic-mekan';
import { useSkyEnv } from './glb';

export interface IcDeps {
  root: () => T.Object3D | null; hero: () => { x: number; z: number }; night: () => number;
  /** owned fixed businesses by plot id */ isletme: () => Record<string, { lv: number; isci: number; esya: string[] }>;
  salon: () => { stage: number; esya: string[] };
  /** büfe mutfağı: hired kitchen staff + the live ticket lines for the KDS screen */
  mutfak: () => { ekip: { rol: string; rank: number }[]; kds: string[] };
}
export interface IcView { update(dt: number): void; dispose(): void; /** id of the room the player stands in */ icinde(): string | null }

const HP = Math.PI / 2, O = { r: 0 };
const FLOOR: Record<string, [string, string]> = { kafe: ['#9a6b45', '#7d5434'], bistro: ['#e6e0d4', '#2c3e57'], kirtasiye: ['#cfd8dc', '#b8c4c9'], okul: ['#c9b48a', '#b39e74'], lokanta: ['#e9e6e0', '#d4cfc6'],
  kafeterya: ['#8fb3a0', '#7aa08c'], banka: ['#efe9df', '#c9a23a'], hastane: ['#e3eef2', '#cfdde3'], acil: ['#e3eef2', '#cfdde3'], morg: ['#9aa3a8', '#878f94'], kahvalti: ['#c8a27a', '#b08860'], balik: ['#d8e2e6', '#2f6f8f'], mutfak: ['#b9a78c', '#a59377'] };
const WALL: Record<string, [string, string]> = { kafe: ['#f3e3c8', '#7a4a2a'], bistro: ['#e9f1f4', '#1d4f86'], kirtasiye: ['#f6f6ee', '#2b6fb8'], okul: ['#f4ead2', '#5f8f6a'], lokanta: ['#f2efe9', '#a2472f'],
  kafeterya: ['#eef2f4', '#2f9e5a'], banka: ['#f4efe2', '#1f3a5f'], hastane: ['#f2f6f8', '#7fb4d8'], acil: ['#f2f6f8', '#d93a3a'], morg: ['#b9c0c4', '#5b6068'], kahvalti: ['#f3e3c8', '#7a4a2a'], balik: ['#e9f1f4', '#1d4f86'], mutfak: ['#f3ead6', '#3f7f64'] };

let solid: T.MeshStandardMaterial | null = null, glass: T.MeshStandardMaterial | null = null, glow: T.MeshBasicMaterial | null = null, wallM: T.MeshStandardMaterial | null = null;
function mats() {
  if (!solid) {
    solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 }); useSkyEnv(solid, 'matte');
    wallM = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.45, depthWrite: false }); useSkyEnv(glass, 'glass');
    glow = new T.MeshBasicMaterial({ vertexColors: true });
  }
  return { solid: solid!, glass: glass!, glow: glow!, wall: wallM! };
}
const LM = new Map<string, T.MeshLambertMaterial>();
const lm = (c: string) => { let m = LM.get(c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); LM.set(c, m); } return m; };
const BOX = new T.BoxGeometry(1, 1, 1), SPH = new T.SphereGeometry(1, 10, 8);
function part(g: T.Object3D, geo: T.BufferGeometry, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const m = new T.Mesh(geo, lm(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; }

type Kind = 'guest' | 'staff' | 'chef' | 'student' | 'teacher' | 'nurse' | 'doctor' | 'clerk' | 'patient' | 'barista';
const SK = ['#f1c9a5', '#d9a27a', '#b9805a', '#8a5a3c'], TOPS = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#c94f6d', '#7d6bb0', '#f4f2ec', '#3a3d42'], HAIR = ['#1f1813', '#3a2416', '#6b4a2a', '#c9b08a'];
/** low-poly person: shared geometry + cached lambert materials (dozens per room stay cheap) */
function person(kind: Kind, seed: number, sit: boolean, apron = '#1d1d1d'): T.Group {
  const g = new T.Group(), top = kind === 'guest' || kind === 'student' ? TOPS[seed % TOPS.length] : kind === 'chef' || kind === 'nurse' || kind === 'doctor' ? '#fbfaf6' : kind === 'clerk' ? '#1f3a5f' : kind === 'teacher' ? '#7a5a3a' : kind === 'patient' ? '#a9cbe0' : '#fbfaf6';
  const s = kind === 'student' ? 0.8 : 1;
  if (kind === 'patient') {   // lying in bed
    part(g, BOX, top, 0, 0.72, 0.1, 0.42, 0.22, 1.2); part(g, SPH, SK[seed % 4], 0, 0.78, -0.62, 0.15, 0.15, 0.15); return g;
  }
  part(g, BOX, kind === 'guest' || kind === 'student' ? '#2f3a4a' : '#1d1d1d', 0, (sit ? 0.47 : 0.4) * s, sit ? 0.12 : 0, 0.3 * s, (sit ? 0.42 : 0.8) * s, (sit ? 0.42 : 0.2) * s);
  const by = (sit ? 0.92 : 1.08) * s; part(g, BOX, top, 0, by, 0, 0.4 * s, 0.52 * s, 0.24 * s);
  if (kind === 'staff' || kind === 'barista') part(g, BOX, apron, 0, by - 0.16 * s, 0.13, 0.36, 0.5, 0.02);
  if (kind === 'doctor') part(g, BOX, '#5fa8d0', 0, by + 0.12, 0.13, 0.12, 0.08, 0.02);
  const hy = by + 0.42 * s; part(g, SPH, SK[seed % 4], 0, hy, 0, 0.15 * s, 0.15 * s, 0.15 * s);
  if (kind === 'chef') part(g, new T.CylinderGeometry(0.15, 0.13, 0.26, 10), '#ffffff', 0, hy + 0.22, 0, 1, 1, 1);
  else if (kind === 'nurse') part(g, BOX, '#ffffff', 0, hy + 0.15, 0, 0.22, 0.06, 0.18);
  else part(g, SPH, HAIR[(seed >> 2) % 4], 0, hy + 0.04, -0.02, 0.155 * s, 0.11 * s, 0.155 * s);
  for (const sx of [-1, 1]) part(g, BOX, top, sx * 0.25 * s, by + 0.02, sit ? 0.12 : 0.02, 0.1 * s, 0.42 * s, 0.1 * s);   // arms
  return g;
}

function signTex(text: string, bg: string, fg: string, aspect: number, chalk = false): T.CanvasTexture {
  const h = 96, w = Math.max(96, Math.round(h * aspect)); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (chalk) { g.strokeStyle = '#c9a23a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  g.fillStyle = fg; g.font = (chalk ? 'italic 800 ' : '900 ') + '54px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = w - 30; if (m > max) { g.save(); g.translate(w / 2, h / 2 + 3); g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, w / 2, h / 2 + 3);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

interface Anim { spin: T.Object3D[]; fire: T.Object3D[]; fish: T.Object3D[]; screens: T.MeshBasicMaterial[]; flick: T.Object3D[]; walkers: { o: T.Object3D; p: [number, number][]; t: number; sp: number }[]; bob: T.Object3D[]; lamps: T.Object3D | null; kds?: { draw(lines: string[]): void }; kdsT?: number }
interface Ctx { b: Batch; g: Batch; l: Batch; grp: T.Group; m: IcMekan; an: Anim; seed: number; fine: boolean; lv: number; owned: boolean }

/* ---------- furniture & equipment builders (local frame: item faces +z, base at y=0) ---------- */
const chair = (b: Batch, x: number, z: number, a: number, c: string) => {
  b.box(0.38, 0.05, 0.38, c, x, 0.45, z); b.box(0.38, 0.42, 0.05, c, x + Math.sin(a) * 0.17, 0.68, z + Math.cos(a) * 0.17, { ry: a });
  for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) b.box(0.03, 0.45, 0.03, '#3a3d42', x + dx, 0.22, z + dz);
};
function masa(c: Ctx, it: IcItem, n: number) {
  const { b } = c, cloth = it.k === 'masa4', fine = c.fine, chc = fine ? '#6b1f2a' : c.m.tur === 'bistro' || c.m.tur === 'balik' ? '#1d4f86' : '#7d5638';
  b.cyl(0.05, 0.1, 0.72, '#2a2d33', 0, 0.36, 0, { seg: 8 }); b.cyl(cloth ? 0.5 : 0.4, cloth ? 0.5 : 0.4, 0.05, cloth ? '#fbfaf6' : '#d6aa78', 0, 0.74, 0, { seg: 16 });
  if (cloth) b.cyl(0.52, 0.55, 0.2, fine ? '#fbfaf6' : c.m.tur === 'balik' ? '#e8f1f6' : '#fbf3e4', 0, 0.65, 0, { seg: 16 });
  b.cyl(0.11, 0.11, 0.015, '#ffffff', 0.18, 0.775, 0.05, { seg: 12 }); b.cyl(0.035, 0.03, 0.1, '#c0392b', -0.12, 0.82, 0.1, { seg: 6 }); b.cyl(0.035, 0.03, 0.1, '#e9d27a', 0.05, 0.82, -0.14, { seg: 6 });
  if (fine) { b.cyl(0.03, 0.04, 0.12, '#c9a24a', 0, 0.83, 0, { seg: 6 }); c.l.sph(0.035, '#ffcf6a', 0, 0.92, 0, { ws: 6, hs: 4 }); }
  const seats = cloth ? 4 : 2;
  for (let k = 0; k < seats; k++) {
    const a = cloth ? k * HP + Math.PI / 4 : k * Math.PI + HP, x = Math.sin(a) * 0.68, z = Math.cos(a) * 0.68;
    chair(b, x, z, a, chc);
    if (k < n) { const p = person('guest', c.seed + k * 7, true); p.position.set(x, 0, z); p.rotation.y = a + Math.PI; c.grp.userData.cur.add(p); if (k === 0) c.an.bob.push(p); }
  }
}
function counter(c: Ctx, it: IcItem, col: string, top = '#e9e0c8') {
  const { b, g } = c, w = it.w, d = it.d;
  b.box(w, 1.0, d, col, 0, 0.5, 0); b.box(w + 0.08, 0.06, d + 0.12, top, 0, 1.02, 0.02);
  b.box(w - 0.1, 0.12, 0.04, '#2a2d33', 0, 0.06, d / 2 + 0.01);                                                  // kick plate
  for (let i = 0; i < Math.floor(w / 1.2); i++) b.box(0.02, 0.8, 0.02, top, -w / 2 + 0.6 + i * 1.2, 0.5, d / 2 + 0.005);   // panel lines
  void g;
}
const shelfGoods = (c: Ctx, w: number, rows: number, y0: number, dz: number, pal: string[]) => {
  for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 0.16); i++) { const h = 0.12 + ((i * 7 + r * 3 + c.seed) % 5) * 0.03; c.b.box(0.11, h, 0.12, pal[(i + r * 2 + c.seed) % pal.length], -w / 2 + 0.1 + i * 0.16, y0 + r * 0.42 + h / 2, dz); }
};

type Fn = (c: Ctx, it: IcItem) => void;
/** wall-mounted items place themselves at it.y */
const WALLY = new Set(['menuPano', 'tahta', 'pano', 'ekran', 'formaDuvar', 'kds', 'davlumbaz', 'asiliTava']);
const F: Record<string, Fn> = {
  tezgah: (c, it) => counter(c, it, it.c || '#7a3b1c'),
  bar: (c, it) => { counter(c, it, c.fine ? '#1f2a44' : '#2c3e57', c.fine ? '#c9a24a' : '#d8d2c4'); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.7 + i * (it.w - 1.4) / 3; c.b.cyl(0.18, 0.18, 0.06, '#7d5638', x, 0.75, it.d / 2 + 0.35, { seg: 12 }); c.b.cyl(0.04, 0.04, 0.72, '#9aa5b0', x, 0.37, it.d / 2 + 0.35, { seg: 6 }); } },
  acikBufe: (c, it) => { counter(c, it, c.fine ? '#1f2a44' : '#8a5a3a', '#f4f2ec'); const P = ['#ffd23f', '#e0533c', '#6f9e4f', '#f2e6c8', '#c94f6d', '#3a2416', '#fbfaf6']; for (let i = 0; i < 9; i++) { const x = -it.w / 2 + 0.35 + i * (it.w - 0.7) / 8; c.b.cyl(0.16, 0.14, 0.04, '#ffffff', x, 1.07, 0, { seg: 12 }); c.b.sph(0.1, P[i % P.length], x, 1.1, 0, { ws: 7, hs: 4, sy: 0.4 }); } c.g.box(it.w - 0.1, 0.02, 0.6, '#d8eef6', 0, 1.42, 0.02); for (const s of [-1, 1]) c.b.box(0.04, 0.4, 0.04, '#c9ced6', s * (it.w / 2 - 0.1), 1.24, 0.25); },
  rafArka: (c, it) => {
    const { b } = c, w = it.w, kirt = it.c === 'kirtasiye'; b.box(w, 2.1, it.d, kirt ? '#e9eef2' : '#5a3b2a', 0, 1.05, 0);
    for (let r = 0; r < 4; r++) b.box(w, 0.04, it.d + 0.04, kirt ? '#2b6fb8' : '#3a2416', 0, 0.35 + r * 0.42, 0.02);
    shelfGoods(c, w - 0.2, 4, 0.37, it.d / 2 - 0.08, kirt ? ['#e0533c', '#2f6fdb', '#ffd23f', '#49b96a', '#8a6bbf', '#f4f2ec'] : ['#c0392b', '#e9d27a', '#6f9e4f', '#f4f2ec', '#3a2416', '#2f7fb3']);
  },
  kasa: (c) => { c.b.box(0.34, 0.14, 0.3, '#2a2d33', 0, 0.07, 0); c.b.box(0.3, 0.2, 0.04, '#2a2d33', 0, 0.24, -0.12, { rx: -0.3 }); c.l.plane(0.24, 0.14, '#7fe0a8', 0, 0.25, -0.095, { rx: -0.3 }); },
  menuPano: (c, it) => { const tx = signTex(it.txt || 'MENÜ', '#22272b', '#f4ead2', it.w / 0.7, true), mm = new T.MeshBasicMaterial({ map: tx }); const p = new T.Mesh(new T.PlaneGeometry(it.w, 0.7), mm); p.position.set(0, it.y || 2.3, 0.03); c.grp.userData.cur.add(p); c.b.box(it.w + 0.1, 0.8, 0.04, '#5a3b2a', 0, it.y || 2.3, 0); },
  lamba: (c, it) => {
    if (c.m.salon) return;   // the halls hang their own lamps (bufe-buyume)
    const h = Math.min(3.2, c.m.h), nx = Math.max(1, Math.round(it.w / 3.6)), nz = Math.max(1, Math.round(it.d / 3.6)), shade = c.m.tur === 'hastane' || c.m.tur === 'acil' || c.m.tur === 'morg' || c.m.tur === 'okul' || c.m.tur === 'banka';
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -it.w / 2 + (i + 0.5) * it.w / nx, z = -it.d / 2 + (j + 0.5) * it.d / nz;
      if (shade) { c.b.box(0.9, 0.04, 0.22, '#c9ced6', x, h - 0.15, z); c.l.box(0.8, 0.02, 0.15, '#fffaf0', x, h - 0.18, z); }
      else { c.b.cyl(0.01, 0.01, 0.7, '#2a2d33', x, h - 0.35, z, { seg: 4 }); c.b.cone(0.18, 0.18, c.fine ? '#c9a24a' : '#b87333', x, h - 0.75, z, { seg: 12 }); c.l.sph(0.08, '#ffe6b0', x, h - 0.86, z, { ws: 8, hs: 6 }); }
    }
  },
  saksiB: (c) => { c.b.cyl(0.26, 0.2, 0.5, '#f4f2ec', 0, 0.25, 0, { seg: 10 }); c.b.sph(0.36, '#3f7a34', 0, 0.8, 0, { ws: 8, hs: 6 }); c.b.sph(0.26, '#4f8f3a', 0.1, 1.15, 0.05, { ws: 8, hs: 6 }); },
  saksi: (c) => { c.b.cyl(0.2, 0.16, 0.4, '#c8693e', 0, 0.2, 0, { seg: 10 }); for (let i = 0; i < 5; i++) c.b.box(0.05, 0.7, 0.18, '#3f7a34', Math.cos(i * 1.26) * 0.08, 0.7, Math.sin(i * 1.26) * 0.08, { ry: i * 1.26, rz: 0.25 }); c.b.sph(0.06, '#e0533c', 0.05, 1.05, 0, { ws: 5, hs: 4 }); },
  // café equipment
  espresso: (c) => { const { b, l } = c; b.box(0.56, 0.42, 0.42, '#c9ced6', 0, 0.21, 0, { r: 0.04, s: 2 }); b.box(0.56, 0.06, 0.44, '#2a2d33', 0, 0.45, 0); for (const x of [-0.14, 0.14]) { b.cyl(0.04, 0.04, 0.08, '#2a2d33', x, 0.24, 0.24, { seg: 8 }); b.cyl(0.035, 0.03, 0.07, '#ffffff', x, 0.05, 0.22, { seg: 8 }); } b.cyl(0.02, 0.02, 0.2, '#9aa5b0', 0.24, 0.32, 0.18, { seg: 5, rz: 0.4 }); l.plane(0.14, 0.05, '#7fe0a8', -0.12, 0.36, 0.215); for (let i = 0; i < 4; i++) b.cyl(0.035, 0.03, 0.06, '#ffffff', -0.2 + i * 0.13, 0.51, -0.1, { seg: 8 }); },
  barista: (c) => { const { b } = c; b.cyl(0.08, 0.1, 0.32, '#2a2d33', -0.25, 0.16, 0, { seg: 10 }); b.cone(0.1, 0.18, '#c9ced6', -0.25, 0.42, 0, { seg: 10, rx: Math.PI }); b.cyl(0.06, 0.06, 0.2, '#b87333', 0.05, 0.1, 0.05, { seg: 10 }); b.cone(0.07, 0.08, '#e9eef2', 0.25, 0.25, 0, { seg: 10, rx: Math.PI }); b.cyl(0.015, 0.015, 0.22, '#9aa5b0', 0.25, 0.1, 0, { seg: 4 }); for (let i = 0; i < 3; i++) b.box(0.1, 0.16, 0.1, ['#7a4a2a', '#3a2416', '#a8794e'][i], 0.05 + i * 0.12, 0.08, -0.15); },
  vitrin: (c, it) => { const { b, g, l } = c; b.box(it.w, 0.7, it.d, '#2a2d33', 0, 0.35, 0); g.box(it.w - 0.06, 0.55, it.d - 0.06, '#d8eef6', 0, 0.98, 0); l.box(it.w - 0.1, 0.02, it.d - 0.1, '#fff8e8', 0, 1.24, 0); const P = ['#f2a2b3', '#6b3a20', '#ffd23f', '#fbfaf6', '#c0392b']; for (let i = 0; i < 6; i++) { b.cyl(0.11, 0.11, 0.1, P[i % 5], -it.w / 2 + 0.25 + (i % 3) * (it.w - 0.5) / 2, 0.78 + Math.floor(i / 3) * 0.22, i < 3 ? 0.1 : -0.1, { seg: 12 }); } },
  koltuk: (c) => { const { b } = c, L = '#6b3a20'; b.box(1.6, 0.4, 0.8, L, 0, 0.25, -0.35); b.box(1.6, 0.5, 0.18, L, 0, 0.6, -0.68); for (const s of [-1, 1]) b.box(0.18, 0.55, 0.8, L, s * 0.8, 0.35, -0.35); b.box(0.9, 0.05, 0.5, '#3a2416', 0, 0.42, 0.45); for (const [x, z] of [[-0.4, 0.25], [0.4, 0.25], [-0.4, 0.65], [0.4, 0.65]]) b.box(0.04, 0.4, 0.04, '#3a2416', x, 0.2, z); b.cyl(0.04, 0.035, 0.1, '#ffffff', 0.1, 0.5, 0.45, { seg: 8 }); },
  muzik: (c) => { const { b } = c; b.box(0.7, 0.55, 0.45, '#5a3b2a', 0, 0.28, 0); b.cyl(0.17, 0.17, 0.02, '#111', -0.08, 0.57, 0, { seg: 18 }); const r = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.012, 18), lm('#1a1a1a')); r.position.set(-0.08, 0.58 + 0.1, 0); c.an.spin.push(r); c.grp.userData.curItem.add(r); for (const s of [-1, 1]) { b.box(0.3, 0.5, 0.26, '#2a2d33', s * 0.55, 1.6, -0.05); b.cyl(0.09, 0.09, 0.02, '#555', s * 0.55, 1.65, 0.09, { rx: HP, seg: 12 }); } },
  kitaplik: (c, it) => { const { b } = c; b.box(it.w, 2.2, it.d, '#5a3b2a', 0, 1.1, 0); for (let r = 0; r < 5; r++) b.box(it.w, 0.04, it.d + 0.02, '#3a2416', 0, 0.2 + r * 0.44, 0.01); shelfGoods(c, it.w - 0.2, 5, 0.22, it.d / 2 - 0.1, ['#7a2a1d', '#1d4f86', '#2f6f4a', '#c9a23a', '#f4ead2', '#5a3b2a']); },
  isikTavan: (c, it) => { const h = Math.min(3.0, c.m.h) - 0.05; for (const z of [-it.d / 3, 0, it.d / 3]) for (let i = 0; i <= 14; i++) { const t = i / 14, sag = Math.sin(t * Math.PI) * 0.25; c.l.sph(0.045, i % 2 ? '#ffd890' : '#fff3d6', -it.w / 2 + t * it.w, h - sag, z, { ws: 5, hs: 4 }); } },
  // bistro
  waffle: (c) => { c.b.box(0.5, 0.14, 0.4, '#2a2d33', 0, 0.07, 0, { r: 0.04, s: 2 }); c.b.box(0.5, 0.12, 0.4, '#c9ced6', 0, 0.22, -0.04, { rx: -0.35 }); c.b.box(0.22, 0.03, 0.22, '#d6aa58', 0.1, 0.16, 0.1); },
  bicak: (c) => { c.b.box(0.42, 0.22, 0.06, '#3a2416', 0, 0.11, 0); for (let i = 0; i < 4; i++) c.b.box(0.03, 0.22, 0.01, '#c9ced6', -0.15 + i * 0.1, 0.3, 0.035); c.b.box(0.5, 0.03, 0.3, '#a8794e', 0, 0.015, 0.2); },
  buzVitrin: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#c9ced6', 0, 0.4, 0); b.box(it.w - 0.1, 0.12, it.d - 0.1, '#eef6fa', 0, 0.86, 0); for (let i = 0; i < 7; i++) { const x = -it.w / 2 + 0.25 + i * (it.w - 0.5) / 6; b.sph(0.1, i % 2 ? '#9fb3c0' : '#c0cdd6', x, 0.96, (i % 2 ? 0.12 : -0.12), { ws: 7, hs: 5, sx: 2.2, sy: 0.6 }); b.cone(0.06, 0.1, '#9fb3c0', x + 0.24, 0.96, (i % 2 ? 0.12 : -0.12), { rz: HP, seg: 6 }); } for (let i = 0; i < 4; i++) b.sph(0.05, '#ffd23f', -it.w / 2 + 0.4 + i * 0.4, 0.95, 0.32, { ws: 5, hs: 4 }); g.box(it.w - 0.04, 0.4, 0.03, '#d8eef6', 0, 1.1, it.d / 2 - 0.05, { rx: -0.4 }); },
  akvaryum: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#2a2d33', 0, 0.4, 0); g.box(it.w - 0.04, 1.1, it.d - 0.04, '#5fb8e0', 0, 1.36, 0); b.box(it.w, 0.06, it.d, '#2a2d33', 0, 1.94, 0); b.box(it.w - 0.1, 0.06, it.d - 0.1, '#e9d8a8', 0, 0.84, 0); for (let i = 0; i < 5; i++) b.box(0.03, 0.3 + (i % 3) * 0.12, 0.03, '#3f7a34', -it.w / 2 + 0.3 + i * 0.6, 1.0, 0, { rz: (i % 2 - 0.5) * 0.3 });
    const fg = new T.Group(); c.grp.userData.curItem.add(fg); for (let i = 0; i < 6; i++) { const f = new T.Mesh(SPH, lm(['#ff8a3a', '#ffd23f', '#e0533c', '#2ec4c4'][i % 4])); f.scale.set(0.06, 0.04, 0.025); f.position.set(-it.w / 2 + 0.3 + i * (it.w - 0.6) / 5, 1.1 + (i % 3) * 0.2, 0); f.userData.ph = i * 1.3; f.userData.w = it.w; fg.add(f); c.an.fish.push(f); } },
  mangal: (c, it) => { const { b } = c; b.box(it.w, 0.85, it.d, '#2a2d33', 0, 0.42, 0); for (let i = 0; i < 8; i++) b.box(it.w - 0.1, 0.02, 0.02, '#9aa5b0', 0, 0.9, -it.d / 2 + 0.1 + i * (it.d - 0.2) / 7); b.box(it.w - 0.2, 0.04, it.d - 0.2, '#ff6a2a', 0, 0.86, 0); b.box(it.w + 0.1, 0.06, it.d + 0.1, '#5b6068', 0, 2.4, -0.05); b.box(0.4, 0.8, 0.4, '#5b6068', 0, 2.8, -0.1);
    for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.ConeGeometry(0.07, 0.22, 6), new T.MeshBasicMaterial({ color: i % 2 ? '#ffb43a' : '#ff6a2a' })); f.position.set(-it.w / 2 + 0.2 + i * (it.w - 0.4) / 3, 1.0, 0); f.userData.ph = i; c.an.fire.push(f); c.grp.userData.curItem.add(f); }
    for (let i = 0; i < 3; i++) b.box(0.6, 0.02, 0.05, '#c97a3a', -0.2 + i * 0.2, 0.93, 0.05, { ry: 0.2 }); },
  piyano: (c) => { const { b } = c; b.box(1.4, 0.3, 1.1, '#111', 0, 0.85, 0, { r: 0.08, s: 2 }); b.box(1.2, 0.04, 0.2, '#fbfaf6', 0, 1.02, 0.5); for (let i = 0; i < 8; i++) b.box(0.03, 0.02, 0.12, '#111', -0.5 + i * 0.14, 1.04, 0.47); for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [0, 0.45]]) b.cyl(0.04, 0.04, 0.72, '#111', x, 0.36, z, { seg: 6 }); b.box(1.3, 0.03, 1.0, '#111', 0, 1.2, -0.25, { rx: 0.7 }); b.box(0.5, 0.05, 0.3, '#111', 0, 0.48, 0.85); },
  // kırtasiye
  stand: (c, it) => { const { b } = c; b.box(it.w, 1.3, it.d, '#e9eef2', 0, 0.65, 0); for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) b.box(0.12, 0.25, 0.03, ['#e0533c', '#2f6fdb', '#ffd23f', '#49b96a', '#8a6bbf'][(i + r) % 5], -it.w / 2 + 0.15 + i * (it.w - 0.3) / 6, 0.35 + r * 0.38, s * (it.d / 2 + 0.02)); },
  fotokopi: (c) => { const { b, l } = c; b.box(0.8, 0.9, 0.6, '#e9eef2', 0, 0.45, 0); b.box(0.82, 0.12, 0.62, '#9aa5b0', 0, 0.96, 0); b.box(0.5, 0.04, 0.3, '#fbfaf6', 0.05, 0.62, 0.36); l.plane(0.16, 0.08, '#7fe0a8', 0.28, 0.98, 0.315); for (let i = 0; i < 3; i++) b.box(0.6, 0.02, 0.4, '#fbfaf6', 0, 0.2 + i * 0.05, 0.32); },
  pos: (c) => { c.b.box(0.1, 0.16, 0.06, '#2a2d33', 0, 0.08, 0, { rx: -0.3 }); c.l.plane(0.07, 0.05, '#7fd0ff', 0, 0.12, 0.035, { rx: -0.3 }); },
  laminasyon: (c) => { c.b.box(0.45, 0.12, 0.25, '#3a3d42', 0, 0.06, 0); c.b.box(0.35, 0.01, 0.2, '#fbfaf6', 0, 0.13, 0.12); c.l.sph(0.015, '#ff4a3a', 0.18, 0.12, 0.12, { ws: 5, hs: 4 }); },
  kalemVitrin: (c, it) => { const { b, g, l } = c; b.box(it.w, 0.9, it.d, '#2a2d33', 0, 0.45, 0); g.box(it.w - 0.04, 0.25, it.d - 0.04, '#d8eef6', 0, 1.03, 0); l.box(it.w - 0.1, 0.01, it.d - 0.1, '#fff8e8', 0, 1.14, 0); for (let i = 0; i < 10; i++) b.cyl(0.012, 0.012, 0.16, ['#111', '#c9a23a', '#7a2a1d', '#1d4f86'][i % 4], -it.w / 2 + 0.12 + i * (it.w - 0.24) / 9, 0.93, 0, { rx: HP, seg: 5 }); },
  oyuncak: (c, it) => { const { b } = c; b.box(it.w, 0.5, it.d, '#ffb627', 0, 0.25, 0); b.sph(0.18, '#a8794e', -0.35, 0.68, 0, { ws: 8, hs: 6 }); b.sph(0.13, '#a8794e', -0.35, 0.92, 0, { ws: 8, hs: 6 }); b.box(0.3, 0.2, 0.2, '#e0533c', 0.1, 0.6, 0.05); b.cyl(0.06, 0.06, 0.04, '#111', 0.0, 0.52, 0.15, { rx: HP, seg: 8 }); b.cyl(0.06, 0.06, 0.04, '#111', 0.2, 0.52, 0.15, { rx: HP, seg: 8 }); b.sph(0.12, '#2f6fdb', 0.42, 0.62, 0, { ws: 8, hs: 6 }); },
  yazici3d: (c) => { const { b, l } = c; b.box(0.5, 0.05, 0.45, '#2a2d33', 0, 0.025, 0); for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) b.box(0.03, 0.5, 0.03, '#9aa5b0', x, 0.27, z); b.box(0.5, 0.04, 0.45, '#2a2d33', 0, 0.52, 0); b.box(0.1, 0.08, 0.08, '#e0533c', 0.05, 0.42, 0); b.sph(0.06, '#e8e4dc', 0, 0.1, 0, { ws: 7, hs: 5 }); l.sph(0.012, '#7fe0a8', 0.2, 0.52, 0.23, { ws: 4, hs: 3 }); },
  okuma: (c) => { const { b, l } = c; for (const [x, cc] of [[-0.4, '#e0533c'], [0.4, '#2f7fb3']] as [number, string][]) b.sph(0.32, cc, x, 0.25, 0, { ws: 10, hs: 6, sy: 0.7 }); b.cyl(0.02, 0.02, 1.4, '#2a2d33', 0.0, 0.7, -0.4, { seg: 5 }); b.cone(0.18, 0.2, '#f4ead2', 0, 1.45, -0.4, { seg: 10 }); l.sph(0.06, '#ffe6b0', 0, 1.36, -0.4, { ws: 6, hs: 4 }); b.box(0.5, 0.06, 0.35, '#ffd23f', 0, 0.06, 0.4); },
  // okul + kantin
  tahta: (c, it) => { const { b } = c; b.box(it.w + 0.15, 1.25, 0.06, '#8a6a4a', 0, it.y || 1.6, 0); b.box(it.w, 1.1, 0.04, '#24453a', 0, it.y || 1.6, 0.03); for (let i = 0; i < 5; i++) b.box(0.6 + (i % 3) * 0.4, 0.03, 0.01, '#e8f0e8', -it.w / 2 + 0.7 + (i % 2) * 1.6, (it.y || 1.6) + 0.35 - i * 0.16, 0.055); b.box(it.w, 0.05, 0.12, '#8a6a4a', 0, (it.y || 1.6) - 0.62, 0.06); },
  ogretmen: (c, it) => { const { b } = c; b.box(it.w, 0.75, it.d, '#8a6a4a', 0, 0.375, 0); b.box(0.3, 0.06, 0.22, '#fbfaf6', 0.2, 0.78, 0); b.sph(0.08, '#e0533c', -0.4, 0.82, 0, { ws: 7, hs: 5 }); const p = person('teacher', c.seed + 3, false); p.position.set(0.4, 0, -0.65); p.rotation.y = 0; c.grp.userData.cur.add(p); c.an.bob.push(p); },
  sira: (c, it) => { const { b } = c; b.box(it.w, 0.05, it.d, '#c9a46a', 0, 0.68, 0); for (const s of [-1, 1]) b.box(0.04, 0.68, it.d - 0.1, '#3a3d42', s * (it.w / 2 - 0.05), 0.34, 0); b.box(it.w, 0.04, 0.3, '#c9a46a', 0, 0.42, 0.42); b.box(it.w, 0.3, 0.04, '#c9a46a', 0, 0.6, 0.58);
    if (c.m.tur === 'okul') for (const s of [-1, 1]) { const p = person('student', c.seed + Math.round(it.u * 3 + it.v * 7) + s, true); p.position.set(s * it.w / 4, 0, 0.45); p.rotation.y = Math.PI; c.grp.userData.cur.add(p); if (s < 0) c.an.bob.push(p); b.box(0.2, 0.01, 0.28, '#fbfaf6', s * it.w / 4, 0.71, 0); }
    else for (let i = 0; i < 3; i++) { const p = i === 1 ? null : person('guest', c.seed + i + Math.round(it.u * 5), true); if (p) { p.position.set(-it.w / 3 + i * it.w / 3, 0, 0.2); p.rotation.y = Math.PI; c.grp.userData.cur.add(p); } } },
  dolap: (c, it) => { const { b } = c; const n = Math.max(2, Math.round(it.w / 0.45)); for (let i = 0; i < n; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / n; b.box(it.w / n - 0.03, 1.8, it.d, i % 2 ? '#3f7fb3' : '#2f6f9a', x, 0.9, 0); b.box(0.04, 0.12, 0.02, '#c9ced6', x + 0.12, 1.0, it.d / 2 + 0.01); for (let k = 0; k < 3; k++) b.box(0.25, 0.02, 0.01, '#1f4f6f', x, 1.55 + k * 0.05, it.d / 2 + 0.01); } },
  pano: (c, it) => { const tx = signTex(it.txt || 'DUYURULAR', '#c9a46a', '#3a2416', it.w / 0.9), p = new T.Mesh(new T.PlaneGeometry(it.w, 0.9), new T.MeshBasicMaterial({ map: tx })); p.position.set(0, it.y || 1.6, 0.04); c.grp.userData.cur.add(p); for (let i = 0; i < 5; i++) c.b.box(0.25, 0.3, 0.01, ['#fbfaf6', '#ffd23f', '#f2a2b3', '#a9d6ec'][i % 4], -it.w / 2 + 0.3 + i * (it.w - 0.6) / 4, (it.y || 1.6) - 0.15, 0.05); },
  bolme: (c, it) => { c.b.box(it.w, 1.4, it.d, '#e9dfc8', 0, 0.7, 0); c.b.box(it.w + 0.04, 0.06, it.d, '#8a6a4a', 0, 1.42, 0); },
  tostMak: (c) => { c.b.box(0.42, 0.12, 0.36, '#c9ced6', 0, 0.06, 0, { r: 0.03, s: 2 }); c.b.box(0.42, 0.1, 0.36, '#9aa5b0', 0, 0.2, -0.05, { rx: -0.25 }); c.b.box(0.03, 0.03, 0.2, '#111', 0, 0.26, 0.2); c.l.sph(0.012, '#ff4a3a', 0.18, 0.1, 0.18, { ws: 4, hs: 3 }); },
  buzdolap: (c, it) => { const { b, g, l } = c; b.box(it.w, 1.9, it.d, '#e0533c', 0, 0.95, 0); g.box(it.w - 0.12, 1.5, 0.02, '#d8eef6', 0, 1.0, it.d / 2 + 0.01); l.box(it.w - 0.14, 0.02, 0.02, '#fff8e8', 0, 1.72, it.d / 2 - 0.02); for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) b.cyl(0.04, 0.04, 0.22, ['#fbfaf6', '#ffd23f', '#2f6fdb', '#49b96a'][(i + r) % 4], -it.w / 2 + 0.15 + i * (it.w - 0.3) / 4, 0.4 + r * 0.36, it.d / 2 - 0.15, { seg: 6 }); b.box(it.w, 0.3, it.d + 0.02, '#ffffff', 0, 1.85, 0); },
  semaver: (c) => { c.b.cyl(0.13, 0.16, 0.42, '#c9a23a', 0, 0.21, 0, { seg: 12 }); c.b.cyl(0.06, 0.1, 0.12, '#c9a23a', 0, 0.48, 0, { seg: 10 }); c.b.cyl(0.07, 0.06, 0.1, '#7a2a1d', 0, 0.6, 0, { seg: 10 }); c.b.cyl(0.015, 0.015, 0.1, '#c9a23a', 0.12, 0.12, 0.08, { rz: HP, seg: 4 }); for (let i = 0; i < 4; i++) c.b.cyl(0.025, 0.02, 0.07, '#b0281e', 0.25, 0.035, -0.12 + i * 0.08, { seg: 6 }); },
  semaverDev: (c) => { c.b.box(0.8, 0.8, 0.8, '#5a3b2a', 0, 0.4, 0); c.b.cyl(0.28, 0.34, 0.9, '#b87333', 0, 1.25, 0, { seg: 16 }); c.b.cyl(0.12, 0.22, 0.25, '#b87333', 0, 1.82, 0, { seg: 14 }); c.b.cyl(0.14, 0.12, 0.2, '#7a2a1d', 0, 2.04, 0, { seg: 12 }); c.b.cyl(0.03, 0.03, 0.2, '#c9a23a', 0, 1.0, 0.35, { rx: HP, seg: 6 }); for (let i = 0; i < 8; i++) c.b.cyl(0.025, 0.02, 0.07, '#b0281e', -0.3 + (i % 4) * 0.2, 0.84, 0.25 + Math.floor(i / 4) * 0.08, { seg: 6 }); },
  firinK: (c, it) => { const { b, l } = c; b.box(it.w, 0.9, it.d, '#5b6068', 0, 0.45, 0); b.box(it.w * 0.8, 0.45, it.d * 0.75, '#c9ced6', 0, 1.15, 0); c.g.box(it.w * 0.5, 0.25, 0.02, '#ffcf8a', -0.05, 1.15, it.d * 0.38); l.box(it.w * 0.46, 0.2, 0.01, '#ffb866', -0.05, 1.15, it.d * 0.37); },
  meyve: (c, it) => { c.b.box(it.w, 0.8, it.d, '#6f9e4f', 0, 0.4, 0); for (let i = 0; i < 9; i++) c.b.sph(0.07, ['#e0533c', '#ffd23f', '#49b96a', '#ff8a3a'][i % 4], -it.w / 2 + 0.15 + (i % 3) * 0.3, 0.86, -0.15 + Math.floor(i / 3) * 0.15, { ws: 6, hs: 5 }); },
  masaK: (c, it) => { const { b } = c; b.box(it.w, 0.05, it.d, '#e0533c', 0, 0.74, 0); for (const s of [-1, 1]) { b.box(0.05, 0.72, it.d - 0.1, '#5b6068', s * (it.w / 2 - 0.1), 0.36, 0); b.box(it.w, 0.04, 0.3, '#5b6068', 0, 0.44, s * (it.d / 2 + 0.25)); } const p = person('student', c.seed + Math.round(it.u * 9), true); p.position.set(-0.3, 0, it.d / 2 + 0.3); p.rotation.y = Math.PI; c.grp.userData.cur.add(p); },
  ekran: (c, it) => { c.b.box(it.w + 0.08, it.w * 0.58 + 0.08, 0.06, '#111', 0, it.y || 2.0, 0); const mm = new T.MeshBasicMaterial({ color: '#2a8fd0' }); const s = new T.Mesh(new T.PlaneGeometry(it.w, it.w * 0.58), mm); s.position.set(0, it.y || 2.0, 0.035); c.grp.userData.curItem.add(s); c.an.screens.push(mm); },
  izgara: (c, it) => F.mangal(c, it),
  // AVM
  zemin: (c, it) => { const [a, b2] = it.c === 'mermer' ? ['#efe9df', '#c9a23a'] : it.c === 'avm' ? ['#e9e6e0', '#b9b3a6'] : it.c === 'morg' ? ['#9aa3a8', '#7c858a'] : ['#e3eef2', '#bcd2dc']; void a; for (let i = 1; i < Math.round(it.w / 1.2); i++) c.b.box(0.02, 0.003, it.d, b2, -it.w / 2 + i * it.w / Math.round(it.w / 1.2), 0.002, 0); for (let i = 1; i < Math.round(it.d / 1.2); i++) c.b.box(it.w, 0.003, 0.02, b2, 0, 0.002, -it.d / 2 + i * it.d / Math.round(it.d / 1.2)); },
  magaza: (c, it) => { const { b, g, l } = c; b.box(it.w, 2.8, it.d, '#f2efe9', 0, 1.4, 0); g.plane(it.w - 0.3, 2.0, '#9cc3d6', 0, 1.15, it.d / 2 + 0.01); l.plane(it.w - 0.4, 1.9, '#fff3d6', 0, 1.15, it.d / 2 - 0.02); b.box(it.w, 0.5, 0.08, it.c || '#e0533c', 0, 2.5, it.d / 2 + 0.04);
    const tx = signTex(it.txt || 'MAĞAZA', it.c || '#e0533c', '#ffffff', it.w / 0.45), p = new T.Mesh(new T.PlaneGeometry(it.w - 0.2, 0.42), new T.MeshBasicMaterial({ map: tx })); p.position.set(0, 2.5, it.d / 2 + 0.09); c.grp.userData.curItem.add(p);
    for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.6 + i * (it.w - 1.2) / 3; b.cyl(0.12, 0.12, 0.9, ['#c94f6d', '#ffd23f', '#2f7fb3', '#49b96a'][(i + it.txt!.length) % 4], x, 0.9, it.d / 2 - 0.35, { seg: 8 }); b.sph(0.1, SK[i % 4], x, 1.45, it.d / 2 - 0.35, { ws: 6, hs: 5 }); } },
  yuruyen: (c, it) => { const { b, g } = c; for (let i = 0; i < 12; i++) b.box(it.w - 0.2, 0.12, it.d / 12, '#5b6068', 0, 0.1 + i * 0.28, -it.d / 2 + (i + 0.5) * it.d / 12); for (const s of [-1, 1]) { g.box(0.04, 1.0, it.d, '#d8eef6', s * (it.w / 2 - 0.05), 0.6 + 1.6, 0, { rx: -Math.atan2(3.3, it.d) }); b.box(0.08, 0.08, it.d * 1.1, '#2a2d33', s * (it.w / 2 - 0.05), 2.0, 0, { rx: -Math.atan2(3.3, it.d) }); } b.box(it.w, 0.2, 0.8, '#5b6068', 0, 3.3, -it.d / 2 - 0.2); },
  bank: (c, it) => { c.b.box(it.w, 0.06, it.d, '#a8794e', 0, 0.45, 0); c.b.box(0.06, 0.45, it.d - 0.05, '#3a3d42', -it.w / 2 + 0.2, 0.22, 0); c.b.box(0.06, 0.45, it.d - 0.05, '#3a3d42', it.w / 2 - 0.2, 0.22, 0); },
  dus: (c, it) => { const { b, g } = c; b.box(it.w, 0.06, it.d, '#cfdde3', 0, 0.03, 0); g.box(0.03, 2.0, it.d, '#d8eef6', -it.w / 2, 1.0, 0); b.cyl(0.02, 0.02, 0.4, '#c9ced6', 0, 2.0, -it.d / 2 + 0.2, { rx: HP, seg: 5 }); b.cyl(0.1, 0.1, 0.03, '#c9ced6', 0, 1.9, -it.d / 2 + 0.4, { seg: 10 }); },
  benmari: (c, it) => { const { b, g } = c; b.box(it.w, 0.08, it.d, '#c9ced6', 0, 0.04, 0); const P = ['#c0392b', '#e9d27a', '#7a4a2a', '#6f9e4f']; for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.box(0.34, 0.1, 0.4, '#9aa5b0', x, 0.1, 0); b.box(0.3, 0.02, 0.36, P[i], x, 0.15, 0); } g.box(it.w, 0.02, it.d * 0.8, '#d8eef6', 0, 0.45, 0.02, { rx: -0.2 }); },
  corba: (c) => { c.b.cyl(0.25, 0.22, 0.42, '#c9ced6', 0, 0.21, 0, { seg: 14 }); c.b.cyl(0.23, 0.23, 0.02, '#c8642a', 0, 0.4, 0, { seg: 14 }); c.b.cyl(0.015, 0.015, 0.5, '#9aa5b0', 0.1, 0.55, 0, { seg: 4, rz: 0.4 }); },
  tasFirin: (c, it) => { const { b, l } = c; b.box(it.w, 0.8, it.d, '#8a6a4a', 0, 0.4, 0); b.sph(it.w * 0.45, '#b9805a', 0, 0.8, -0.05, { ws: 14, hs: 7, sy: 0.75, sz: it.d / it.w }); b.box(0.5, 0.36, 0.06, '#2a1a10', 0, 1.0, it.d / 2 - 0.05); l.plane(0.42, 0.28, '#ff8a3a', 0, 0.98, it.d / 2 - 0.02); b.cyl(0.1, 0.12, 0.8, '#5a3b2a', 0.25, 1.9, -0.2, { seg: 8 });
    for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.ConeGeometry(0.06, 0.18, 6), new T.MeshBasicMaterial({ color: '#ffb43a' })); f.position.set(-0.12 + i * 0.12, 0.92, it.d / 2 - 0.18); f.userData.ph = i * 2; c.an.fire.push(f); c.grp.userData.curItem.add(f); } },
  doner: (c) => { const { b } = c; b.box(0.5, 0.06, 0.5, '#5b6068', 0, 0.9, 0); b.cyl(0.015, 0.015, 0.9, '#c9ced6', 0, 1.35, 0, { seg: 4 }); const d = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 0.7, 12), lm('#9a5a2a')); d.position.set(0, 1.3, 0); c.an.spin.push(d); c.grp.userData.curItem.add(d); b.box(0.5, 0.8, 0.12, '#2a2d33', 0, 1.3, -0.3); c.l.box(0.4, 0.6, 0.02, '#ff8a3a', 0, 1.3, -0.23); b.box(0.5, 0.9, 0.5, '#c9ced6', 0, 0.45, 0); },
  tatliVitrin: (c, it) => F.vitrin(c, it),
  ustaOcak: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, '#c9ced6', 0, 0.45, 0); for (const x of [-0.25, 0.25]) { b.cyl(0.14, 0.14, 0.02, '#111', x, 0.91, 0, { seg: 12 }); b.cyl(0.16, 0.14, 0.16, '#5b6068', x, 1.0, 0, { seg: 12 }); } const f = new T.Mesh(new T.ConeGeometry(0.1, 0.12, 8), new T.MeshBasicMaterial({ color: '#3a8fff' })); f.position.set(0.25, 0.94, 0); f.userData.ph = 1; c.an.fire.push(f); c.grp.userData.curItem.add(f); b.box(it.w + 0.1, 0.06, it.d + 0.1, '#9aa5b0', 0, 2.3, -0.05); },
  // kafeterya
  langirt: (c, it) => { const { b } = c; b.box(it.w, 0.2, it.d, '#5a3b2a', 0, 0.85, 0); b.box(it.w - 0.1, 0.02, it.d - 0.1, '#2f9e5a', 0, 0.96, 0); for (const [x, z] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) b.box(0.08, 0.75, 0.08, '#3a2416', x, 0.38, z); for (let i = 0; i < 4; i++) { b.cyl(0.012, 0.012, it.d + 0.5, '#c9ced6', -0.45 + i * 0.3, 1.02, 0, { rx: HP, seg: 4 }); for (let k = 0; k < 3; k++) b.box(0.04, 0.12, 0.05, i % 2 ? '#e0533c' : '#2f6fdb', -0.45 + i * 0.3, 1.0, -0.2 + k * 0.2); } b.sph(0.025, '#fbfaf6', 0.05, 0.99, 0.02, { ws: 6, hs: 4 }); },
  kupa: (c, it) => { const { b, g } = c; b.box(it.w, 0.9, it.d, '#2a2d33', 0, 0.45, 0); g.box(it.w - 0.04, 0.8, it.d - 0.04, '#d8eef6', 0, 1.3, 0); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.cyl(0.05, 0.08, 0.06, '#c9a23a', x, 0.94, 0, { seg: 8 }); b.cyl(0.02, 0.02, 0.12, '#c9a23a', x, 1.03, 0, { seg: 5 }); b.cyl(0.09, 0.04, 0.16, '#ffd23f', x, 1.17, 0, { seg: 10 }); } },
  formaDuvar: (c, it) => { for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.25 + i * (it.w - 0.5) / 3, cc = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e5a'][i]; c.b.box(0.4, 0.5, 0.03, cc, x, it.y || 1.6, 0.02); c.b.box(0.6, 0.15, 0.03, cc, x, (it.y || 1.6) + 0.2, 0.02); c.b.box(0.46, 0.56, 0.02, '#c9a23a', x, it.y || 1.6, 0.0); } },
  vip: (c, it) => { const { b } = c; for (let i = 0; i < 2; i++) { const z = -it.d / 2 + 0.35 + i * 0.7; b.box(it.w, 0.4, 0.55, '#c9a23a', 0, 0.25, z); b.box(it.w, 0.55, 0.12, '#1f2a44', 0, 0.62, z - 0.25); } },
  // banka
  gise: (c, it) => { const { b, g, l } = c; counter(c, it, '#1f3a5f', '#c9a23a'); for (let i = 0; i <= 3; i++) { const x = -it.w / 2 + i * it.w / 3; b.box(0.06, 1.1, 0.06, '#c9a23a', x, 1.6, 0); } g.box(it.w, 1.1, 0.03, '#d8eef6', 0, 1.6, 0.02); b.box(it.w + 0.1, 0.08, 0.2, '#c9a23a', 0, 2.18, 0);
    for (let i = 0; i < 3; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / 3; l.box(0.3, 0.2, 0.02, '#7fe0a8', x, 2.4, 0.05); b.box(0.32, 0.22, 0.04, '#111', x, 2.4, 0.02); b.box(0.5, 0.04, 0.3, '#2a2d33', x, 1.05, -0.2); const p = person('clerk', c.seed + i, true); p.position.set(x, 0, -0.75); c.grp.userData.cur.add(p); c.an.bob.push(p); } },
  atm: (c) => { const { b, l } = c; b.box(0.7, 1.6, 0.6, '#3a3d42', 0, 0.8, 0); b.box(0.7, 0.2, 0.6, '#c9a23a', 0, 1.65, 0); l.plane(0.38, 0.26, '#7fd0ff', 0, 1.25, 0.31); b.box(0.4, 0.06, 0.2, '#111', 0, 0.98, 0.35); },
  kasaKapi: (c) => { c.b.cyl(0.75, 0.75, 0.15, '#9aa5b0', 0, 1.1, 0.05, { rx: HP, seg: 24 }); c.b.cyl(0.6, 0.6, 0.06, '#c9ced6', 0, 1.1, 0.14, { rx: HP, seg: 24 }); c.b.tor(0.25, 0.03, '#c9a23a', 0, 1.1, 0.19, { ts: 16 }); for (let i = 0; i < 3; i++) c.b.box(0.5, 0.04, 0.04, '#c9a23a', 0, 1.1, 0.2, { rz: i * 1.047 }); },
  kuyruk: (c, it) => { const pts: [number, number][] = [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]]; for (const [x, z] of pts) { c.b.cyl(0.15, 0.15, 0.04, '#c9a23a', x, 0.02, z, { seg: 10 }); c.b.cyl(0.03, 0.03, 0.9, '#c9a23a', x, 0.45, z, { seg: 6 }); } c.b.box(it.w, 0.06, 0.02, '#9a1f2a', 0, 0.8, -it.d / 2); c.b.box(0.02, 0.06, it.d, '#9a1f2a', it.w / 2, 0.8, 0); for (let i = 0; i < 2; i++) { const p = person('guest', c.seed + 40 + i, false); p.position.set(-0.3 + i * 0.7, 0, -it.d / 2 + 0.5 + i * 0.6); p.rotation.y = Math.PI; c.grp.userData.cur.add(p); } },
  // hastane / acil / morg
  resepsiyon: (c, it) => { counter(c, it, '#7fb4d8', '#f4f6f8'); c.b.box(0.5, 0.3, 0.04, '#111', -0.6, 1.25, -0.15); c.l.plane(0.44, 0.24, '#7fd0ff', -0.6, 1.25, -0.125); const p = person('nurse', c.seed + 2, true); p.position.set(0.3, 0, -0.75); c.grp.userData.cur.add(p); c.an.bob.push(p); const d = person('doctor', c.seed + 5, false); d.position.set(-1.6, 0, 0.9); d.rotation.y = 0.8; c.grp.userData.cur.add(d); },
  yatak: (c, it) => { const { b } = c; b.box(it.w, 0.1, it.d, '#c9ced6', 0, 0.55, 0); b.box(it.w - 0.06, 0.12, it.d - 0.06, '#fbfaf6', 0, 0.64, 0); b.box(it.w, 0.5, 0.06, '#9aa5b0', 0, 0.8, -it.d / 2); for (const [x, z] of [[-0.42, -0.9], [0.42, -0.9], [-0.42, 0.9], [0.42, 0.9]]) b.box(0.04, 0.55, 0.04, '#9aa5b0', x, 0.27, z); b.box(0.36, 0.08, 0.24, '#ffffff', 0, 0.73, -it.d / 2 + 0.25);
    if ((Math.round(it.u * 10) + c.seed) % 3 !== 0) { const p = person('patient', c.seed + Math.round(it.u * 4), false); c.grp.userData.cur.add(p); } b.cyl(0.02, 0.02, 1.6, '#c9ced6', it.w / 2 + 0.15, 0.8, -it.d / 2 + 0.2, { seg: 5 }); b.box(0.12, 0.2, 0.06, '#d8eef6', it.w / 2 + 0.15, 1.5, -it.d / 2 + 0.2); },
  perde: (c, it) => { c.b.box(0.03, 0.03, it.d, '#c9ced6', 0, 2.3, 0); for (let i = 0; i < 6; i++) c.b.box(0.05, 1.7, it.d / 6, i % 2 ? '#a9cbe0' : '#bcd8ea', 0, 1.35, -it.d / 2 + (i + 0.5) * it.d / 6, { ry: (i % 2 - 0.5) * 0.4 }); },
  ilac: (c, it) => { const { b, g } = c; b.box(it.w, 1.9, it.d, '#f4f6f8', 0, 0.95, 0); g.box(it.w - 0.06, 0.9, 0.02, '#d8eef6', 0, 1.4, it.d / 2 + 0.01); shelfGoods(c, it.w - 0.2, 2, 1.0, it.d / 2 - 0.12, ['#fbfaf6', '#e0533c', '#7fb4d8', '#ffd23f']); b.box(0.2, 0.2, 0.02, '#d93a3a', 0, 1.75, it.d / 2 + 0.02); },
  sedye: (c, it) => F.yatak(c, it),
  monitor: (c) => { c.b.cyl(0.03, 0.03, 1.4, '#9aa5b0', 0, 0.7, 0, { seg: 6 }); c.b.box(0.4, 0.3, 0.12, '#2a2d33', 0, 1.5, 0); const mm = new T.MeshBasicMaterial({ color: '#1a9a4a' }); const s = new T.Mesh(new T.PlaneGeometry(0.34, 0.24), mm); s.position.set(0, 1.5, 0.065); c.grp.userData.curItem.add(s); c.an.screens.push(mm); },
  cekmece: (c, it) => { const { b } = c; b.box(it.w, 2.2, it.d, '#9aa5b0', 0, 1.1, 0); for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / 3, y = 0.4 + r * 0.7; b.box(it.w / 3 - 0.08, 0.6, 0.03, '#c9ced6', x, y, it.d / 2 + 0.01); b.box(0.2, 0.04, 0.05, '#5b6068', x, y + 0.1, it.d / 2 + 0.04); b.box(0.12, 0.08, 0.01, '#fbfaf6', x - 0.2, y - 0.12, it.d / 2 + 0.03); } },
  otopsi: (c, it) => { const { b } = c; b.box(it.w, 0.06, it.d, '#c9ced6', 0, 0.9, 0); b.cyl(0.1, 0.14, 0.88, '#9aa5b0', 0, 0.44, 0, { seg: 8 }); b.box(it.w - 0.2, 0.22, it.d - 0.15, '#e9eef2', 0, 1.03, 0, { r: 0.08, s: 2 }); b.box(0.12, 0.08, 0.06, '#e8c8a8', it.w / 2 - 0.15, 0.95, 0.15); },
  // büfe salonları
  gozleme: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#8a5a3a', 0, 0.4, 0); b.cyl(0.38, 0.38, 0.04, '#2a2d33', 0, 0.84, 0, { seg: 18 }); b.cyl(0.32, 0.32, 0.01, '#e9c88a', 0, 0.87, 0, { seg: 18 }); b.cyl(0.015, 0.015, 0.7, '#e9e0c8', -0.45, 0.88, 0.1, { rz: HP, seg: 4 }); g.box(it.w, 0.8, 0.03, '#d8eef6', 0, 1.4, it.d / 2); const p = person('staff', c.seed + 77, true, '#c0392b'); p.position.set(0, 0, -it.d / 2 - 0.2); c.grp.userData.cur.add(p); c.an.bob.push(p); },
  balKaymak: (c, it) => { const { b } = c; b.box(it.w, 0.85, it.d, '#5a3b2a', 0, 0.42, 0); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.cyl(0.12, 0.12, 0.04, '#fbfaf6', x, 0.88, 0, { seg: 12 }); b.box(0.14, 0.06, 0.1, i % 2 ? '#e8a52a' : '#fbf3e4', x, 0.92, 0); } b.box(0.3, 0.3, 0.06, '#e8a52a', 0, 1.1, -0.2); },
  sarkuteri: (c, it) => { F.vitrin(c, it); for (let i = 0; i < 5; i++) c.b.cyl(0.08, 0.08, 0.1, ['#f2d27a', '#e8c070', '#fbf3e4', '#6f9e4f', '#3a2416'][i], -it.w / 2 + 0.25 + i * (it.w - 0.5) / 4, 0.74, 0, { seg: 10 }); },
  buzTezgah: (c, it) => F.buzVitrin(c, it),
  mezeDolap: (c, it) => { F.vitrin(c, it); for (let i = 0; i < 8; i++) c.b.box(0.16, 0.05, 0.16, ['#e0533c', '#6f9e4f', '#fbf3e4', '#ffd23f'][i % 4], -it.w / 2 + 0.2 + (i % 4) * (it.w - 0.4) / 3, 0.73 + Math.floor(i / 4) * 0.2, 0); },
  // ---- büfe mutfağı (content/mutfak.ts) ----
  sogukOda: (c, it) => { const { b, l } = c; b.box(it.w, 2.3, it.d, '#e9eef2', 0, 1.15, 0); b.box(it.w - 0.2, 2.0, 0.05, '#cfd6dc', 0, 1.1, it.d / 2 + 0.02); b.box(0.06, 0.5, 0.06, '#5b6068', it.w / 2 - 0.25, 1.1, it.d / 2 + 0.07); l.box(0.34, 0.07, 0.01, '#bfe9ff', 0, 2.15, it.d / 2 + 0.03); for (let i = 0; i < 3; i++) b.box(0.5, 0.025, 0.02, '#9aa5b0', 0, 0.5 + i * 0.5, it.d / 2 + 0.05); },
  ocakK: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, '#c9ced6', 0, 0.45, 0); b.box(it.w - 0.1, 0.05, it.d - 0.1, '#8a9098', 0, 0.92, 0);
    for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.3 + i * (it.w - 0.6) / 3; b.cyl(0.14, 0.14, 0.02, '#111', x, 0.96, 0, { seg: 12 });
      if (i % 2 === 0) { b.cyl(0.17, 0.15, 0.26, '#9aa2ab', x, 1.1, 0, { seg: 12 }); b.cyl(0.18, 0.18, 0.03, '#5b6068', x, 1.24, 0, { seg: 12 }); const f = new T.Mesh(new T.ConeGeometry(0.08, 0.1, 6), new T.MeshBasicMaterial({ color: '#3a8fff' })); f.position.set(x, 0.97, it.d * 0.3); f.userData.ph = i; c.an.fire.push(f); c.grp.userData.curItem.add(f); }
      else { b.cyl(0.13, 0.1, 0.12, '#2a2d33', x, 1.02, 0, { seg: 10 }); } } },
  izgaraK: (c, it) => { const { b, l } = c; b.box(it.w, 0.9, it.d, '#8a9098', 0, 0.45, 0); b.box(it.w - 0.08, 0.06, it.d - 0.08, '#1d1d1d', 0, 0.93, 0); for (let i = 0; i < 7; i++) b.box(it.w - 0.2, 0.02, 0.025, '#5b6068', 0, 0.97, -it.d / 2 + 0.12 + i * (it.d - 0.24) / 6); l.box(it.w - 0.3, 0.02, 0.06, '#ff6a2a', 0, 0.9, it.d / 2 - 0.02); for (let i = 0; i < 3; i++) b.box(0.3, 0.05, 0.18, ['#8a3a2a', '#9a5a2a', '#7a2a1d'][i], -0.4 + i * 0.4, 0.99, 0.05); },
  fritoz: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, '#aab3bb', 0, 0.45, 0); for (const s of [-1, 1]) { b.box(it.w / 2 - 0.12, 0.06, it.d - 0.2, '#33373b', s * it.w / 4, 0.93, 0); b.box(it.w / 2 - 0.2, 0.02, it.d - 0.3, '#e9b84a', s * it.w / 4, 0.97, 0); b.box(0.04, 0.04, 0.34, '#1d1d1d', s * it.w / 4, 1.04, it.d / 2 - 0.05); } },
  pass: (c, it) => { const { b, l } = c; b.box(it.w, 0.95, it.d, '#9aa5b0', 0, 0.475, 0); b.box(it.w + 0.06, 0.06, it.d + 0.08, '#e9eef2', 0, 0.98, 0.02); for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.4 + i * (it.w - 0.8) / 2; b.cyl(0.02, 0.02, 0.55, '#c9ced6', x, 1.3, -0.2, { seg: 5 }); l.box(0.5, 0.05, 0.3, '#ff9a4a', x, 1.58, -0.12); for (let k = 0; k < 3; k++) b.cyl(0.18, 0.18, 0.02, '#ffffff', x, 1.03 + k * 0.025, 0.1, { seg: 12 }); }
    b.cyl(0.07, 0.08, 0.05, '#c9a24a', it.w / 2 - 0.25, 1.04, 0.3, { seg: 8 }); b.cyl(0.02, 0.02, 0.05, '#c9a24a', it.w / 2 - 0.25, 1.09, 0.3, { seg: 5 }); },
  bulasik: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, '#9aa5b0', 0, 0.45, 0); b.box(it.w + 0.04, 0.05, it.d + 0.04, '#e9eef2', 0, 0.93, 0); for (const s of [-1, 1]) b.box(0.7, 0.04, it.d - 0.3, '#33373b', s * (it.w / 4 + 0.05), 0.96, 0); b.cyl(0.02, 0.02, 0.4, '#c9ced6', 0, 1.15, -it.d / 2 + 0.15, { seg: 5 }); b.cyl(0.015, 0.015, 0.2, '#c9ced6', 0, 1.35, -it.d / 2 + 0.25, { rx: HP, seg: 5 }); for (let i = 0; i < 6; i++) b.cyl(0.17, 0.17, 0.018, '#fbfaf6', it.w / 2 - 0.3, 0.99 + i * 0.02, 0, { seg: 12 }); b.box(0.5, 0.35, 0.4, '#5b6068', -it.w / 2 + 0.3, 1.1, -it.d / 2 + 0.3); },
  salata: (c, it) => { F.buzVitrin(c, it); for (let i = 0; i < 4; i++) c.b.cyl(0.13, 0.1, 0.07, ['#6f9e4f', '#e0533c', '#ffd23f', '#8cc63e'][i], -it.w / 2 + 0.25 + i * (it.w - 0.5) / 3, 1.02, 0, { seg: 10 }); },
  cayBar: (c, it) => { const { b } = c; counter(c, it, '#7a3b1c'); b.cyl(0.13, 0.16, 0.42, '#c9a23a', -it.w / 2 + 0.35, 1.28, 0, { seg: 12 }); b.cyl(0.07, 0.06, 0.1, '#7a2a1d', -it.w / 2 + 0.35, 1.54, 0, { seg: 10 }); b.box(0.5, 0.4, 0.3, '#2a2d33', 0.1, 1.24, -0.05); b.box(0.46, 0.04, 0.26, '#c9ced6', 0.1, 1.46, -0.05); for (let i = 0; i < 5; i++) b.cyl(0.03, 0.025, 0.07, '#b0281e', it.w / 2 - 0.3 + (i % 2) * 0.05, 1.06, -0.12 + i * 0.07, { seg: 6 }); },
  sefMasa: (c, it) => { const { b, l } = c; counter(c, it, '#1f2a44', '#c9a24a'); for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.5 + i * (it.w - 1.0) / 2; b.cyl(0.02, 0.02, 0.5, '#c9a24a', x, 1.32, 0, { seg: 5 }); l.box(0.4, 0.05, 0.3, '#ffcf6a', x, 1.58, 0); b.cyl(0.17, 0.17, 0.02, '#ffffff', x, 1.06, 0.05, { seg: 12 }); } },
  davlumbaz: (c, it) => { const { b } = c; b.box(it.w, 0.45, 1.0, '#aab3bb', 0, 2.3, 0); b.box(it.w - 0.4, 0.5, 0.7, '#9aa2ab', 0, 2.75, -0.1); for (let i = 0; i < Math.round(it.w / 0.5); i++) b.box(0.3, 0.04, 0.02, '#5b6068', -it.w / 2 + 0.25 + i * 0.5, 2.1, 0.5); },
  asiliTava: (c, it) => { const { b } = c; b.cyl(0.015, 0.015, it.w, '#9aa5b0', 0, 2.0, 0.05, { rz: HP, seg: 5 }); for (let i = 0; i < 14; i++) { const x = -it.w / 2 + 0.6 + i * (it.w - 1.2) / 13, h = 0.2 + (i % 3) * 0.04; b.cyl(0.005, 0.005, 0.2, '#9aa5b0', x, 1.9, 0.05, { seg: 3 }); b.cyl(0.07 + (i % 2) * 0.03, 0.06, h, i % 3 ? '#8a9098' : '#b87333', x, 1.78 - h / 2 + 0.1, 0.05, { seg: 10 }); } },
  kds: (c, it) => { const { b } = c; b.box(it.w, 0.95, 0.06, '#111', 0, 2.05, 0); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g2 = cv.getContext('2d')!, tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; let last = '';
    c.an.kds = { draw: (lines: string[]) => { const key = lines.join('|'); if (key === last) return; last = key; g2.fillStyle = '#0d1b2a'; g2.fillRect(0, 0, 512, 256); g2.fillStyle = '#ffd23f'; g2.fillRect(0, 0, 512, 34); g2.fillStyle = '#14213d'; g2.font = '900 24px system-ui,sans-serif'; g2.textBaseline = 'middle'; g2.fillText('SİPARİŞ EKRANI', 12, 18);
      g2.fillStyle = '#e8f1f8'; g2.font = '700 20px system-ui,sans-serif'; if (!lines.length) { g2.fillStyle = '#7fa6c4'; g2.fillText('Bekleyen sipariş yok', 12, 70); } lines.slice(0, 6).forEach((t, i) => g2.fillText(t, 12, 62 + i * 31, 488)); tex.needsUpdate = true; } };
    c.an.kds.draw([]); const sc = new T.Mesh(new T.PlaneGeometry(it.w - 0.1, 0.85), new T.MeshBasicMaterial({ map: tex })); sc.position.set(0, 2.05, 0.04); c.grp.userData.curItem.add(sc); b.box(it.w, 0.05, 0.14, '#9aa5b0', 0, 1.52, 0.05); for (let i = 0; i < 6; i++) b.box(0.18, 0.2, 0.01, '#fbfaf6', -it.w / 2 + 0.2 + i * 0.3, 1.4, 0.13); },
  hazirlik: (c, it) => { const { b } = c; counter(c, it, '#9aa5b0', '#e9eef2'); b.box(0.5, 0.03, 0.3, '#d6aa78', -0.4, 1.07, 0); b.box(0.5, 0.03, 0.3, '#d6aa78', 0.5, 1.07, 0); for (let i = 0; i < 3; i++) b.cyl(0.05, 0.05, 0.04, ['#e0533c', '#6f9e4f', '#ffd23f'][i], -0.4 + i * 0.1, 1.11, 0, { seg: 8 }); b.box(0.3, 0.04, 0.04, '#c9ced6', 0.5, 1.1, 0); },
};

/* ---------- one room ---------- */
function buildRoom(m: IcMekan, own: { lv: number; isci: number; esya: string[] } | null, salonEsya: string[], fine: boolean, stage = 1, ekip: { rol: string; rank: number }[] = []): { g: T.Group; an: Anim } {
  const grp = new T.Group(); grp.name = 'ic-' + m.id; const cur = new T.Group(), curItem = new T.Group(); grp.add(cur); grp.userData.cur = cur;
  const hall = !!m.salon, { W, D } = icDim(m), h = Math.min(3.2, m.h), y0 = 0.14;   // above the ground detail layer
  grp.position.set(m.x, y0, m.z); grp.rotation.y = icYaw(m);
  const b = new Batch(), g = new Batch(), l = new Batch(), wb = new Batch();
  const an: Anim = { spin: [], fire: [], fish: [], screens: [], flick: [], walkers: [], bob: [], lamps: null };
  const seed = m.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const ctx: Ctx = { b, g, l, grp, m, an, seed: seed % 97, fine, lv: own?.lv || 0, owned: !!own };
  let [f1, f2] = FLOOR[m.tur], [w1, w2] = fine && hall ? ['#26304a', '#c9a24a'] : WALL[m.tur];
  if (m.mutfak && mutfakCelik(stage)) { [f1, f2] = fine ? ['#2a2a30', '#c9a24a'] : ['#8d949a', '#7a8186']; [w1, w2] = fine ? ['#e8ecef', '#c9a24a'] : ['#e8ecef', '#9aa5b0']; }
  if (!hall) {
    // floor: base + pattern
    b.box(W - 0.02, 0.06, D - 0.02, f1, 0, -0.03, 0);
    if (m.tur === 'kafe' || m.tur === 'kahvalti') for (let i = 1; i < Math.round(W / 0.22); i++) b.box(0.012, 0.004, D - 0.05, f2, -W / 2 + i * W / Math.round(W / 0.22), 0.002, 0);
    else if (m.tur === 'bistro') for (let i = 0; i < Math.round(W / 0.6); i++) for (let j = 0; j < Math.round(D / 0.6); j++) if ((i + j) % 2) b.box(0.6, 0.004, 0.6, f2, -W / 2 + 0.3 + i * 0.6, 0.002, -D / 2 + 0.3 + j * 0.6);
    else for (let i = 1; i < Math.round(W / 0.8); i++) b.box(0.015, 0.004, D - 0.05, f2, -W / 2 + i * W / Math.round(W / 0.8), 0.002, 0);
    // walls: inward faces only (near walls cull away from the outside camera), wainscot, skirting, cut cap, windows
    const t = 0.25, wall = (len: number, x: number, z: number, ry: number, gap = 0) => {
      const segs: [number, number][] = gap ? [[-len / 2, -gap / 2], [gap / 2, len / 2]] : [[-len / 2, len / 2]];
      wb.push(mtx(x, 0, z, 0, ry, 0));
      for (const [a, c2] of segs) { const L = c2 - a, cx = (a + c2) / 2; wb.plane(L, h, w1, cx, h / 2, 0); wb.plane(L, 1.0, w2, cx, 0.5, 0.01); wb.box(L, 0.1, 0.03, '#3a2416', cx, 0.05, 0.02); wb.box(L, 0.05, 0.03, w2, cx, 1.0, 0.02); wb.box(L, 0.08, t, '#e9e4da', cx, h + 0.04, -t / 2); }
      wb.pop();
    };
    wall(W, 0, -D / 2 + 0.25, 0); wall(D, -W / 2 + 0.25, 0, HP); wall(D, W / 2 - 0.25, 0, -HP); wall(W, 0, D / 2 - 0.25, Math.PI, 1.7);
    for (const [x, z, ry, len] of [[-W / 2 + 0.26, 0, HP, D], [W / 2 - 0.26, 0, -HP, D]] as [number, number, number, number][]) {   // windows on the side walls
      const n = Math.max(1, Math.floor((len - 1) / 2.4));
      for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5) * len / n; wb.push(mtx(x, 0, z, 0, ry, 0)); wb.box(1.1, 1.2, 0.04, '#fbfaf6', u, 1.75, 0.02); l.push(mtx(x, 0, z, 0, ry, 0)); l.plane(0.95, 1.05, '#bfe3f5', u, 1.75, 0.045); l.pop(); wb.pop(); }
    }
    for (const s of [-1, 1]) b.box(0.12, 2.4, 0.3, w2, s * 0.92, 1.2, D / 2 - 0.15); b.box(1.96, 0.16, 0.3, w2, 0, 2.45, D / 2 - 0.15);   // door frame
    b.box(1.2, 0.02, 0.8, '#9a1f2a', 0, 0.003, D / 2 - 0.8);   // door mat
  } else {
    b.box(W - 0.6, 0.012, D - 0.8, fine ? '#6b1f2a' : '#b5523a', 0, 0.006, 0.1);   // rug
    b.box(W - 0.75, 0.014, D - 0.95, fine ? '#c9a24a' : '#e9c88a', 0, 0.008, 0.1);
    b.box(W - 0.9, 0.016, D - 1.1, fine ? '#6b1f2a' : '#b5523a', 0, 0.01, 0.1);
  }
  const has = new Set(m.salon ? salonEsya : m.mutfak ? mutfakEsya(stage) : own?.esya || []);
  const items = icLayout(m), occ = own ? Math.min(0.9, 0.35 + 0.12 * own.lv) : m.salon ? (fine ? 0.85 : 0.65) : 0.4;
  let ti = 0;
  for (const it of items) {
    if (it.esya && !has.has(it.esya)) continue;
    if (it.k === 'masaK' || it.k === 'masa2' || it.k === 'masa4') ti++;
    const isMasa = it.k === 'masa2' || it.k === 'masa4', fn = F[it.k]; if (!fn && !isMasa) continue;
    grp.userData.cur = new T.Group(); grp.userData.curItem = grp.userData.cur;
    const iy = WALLY.has(it.k) ? 0 : it.y || 0;
    b.push(mtx(it.u, iy, it.v, 0, (it.ry || 0) * HP, 0)); g.push(b.st[b.st.length - 1].clone()); l.push(b.st[b.st.length - 1].clone());
    if (isMasa) masa(ctx, it, Math.floor(((ti * 37 + ctx.seed) % 100) / 100 * (it.k === 'masa4' ? 4 : 2) * occ * 1.6 + (occ > 0.6 ? 1 : 0)));
    else fn!(ctx, it);
    b.pop(); g.pop(); l.pop();
    const sub = grp.userData.cur as T.Group; sub.position.set(it.u, iy, it.v); sub.rotation.y = (it.ry || 0) * HP; cur.add(sub);
  }
  // staff behind the counter: hired workers (owned) or the house staff
  const ctr = items.find(i => i.k === 'tezgah' || i.k === 'bar' || i.k === 'acikBufe');
  if (ctr) {
    const n = m.salon ? (fine ? 3 : 2) : own ? Math.max(1, Math.min(3, own.isci || 1)) : 1;
    for (let i = 0; i < n; i++) {
      const p = person(i === 0 && (m.tur === 'kafe' || m.tur === 'bistro') && has.has(m.tur === 'kafe' ? 'barista' : 'kahve_bar') ? 'barista' : m.tur === 'lokanta' || m.salon || m.tur === 'kafeterya' ? (i === 0 ? 'chef' : 'staff') : 'staff', ctx.seed + i * 11, false, m.tur === 'bistro' ? '#1d4f86' : m.tur === 'kafeterya' ? '#2f9e5a' : '#7a3b1c');
      p.position.set(ctr.u - ctr.w / 2 + (i + 0.5) * ctr.w / n, 0, ctr.v - ctr.d / 2 - 0.45); cur.add(p); an.bob.push(p);
    }
    // a waiter walks the room when the business has extra hands (or always in the halls)
    const waiters = m.salon ? (fine ? 2 : 1) : own && own.isci >= 2 ? Math.min(2, own.isci - 1) : 0;
    for (let i = 0; i < waiters; i++) { const p = person('staff', ctx.seed + 50 + i, false); cur.add(p); const yv = ctr.v + ctr.d / 2 + 0.9; an.walkers.push({ o: p, p: [[-W / 2 + 1.2, yv], [W / 2 - 1.2, yv], [W / 2 - 1.2, D / 2 - 1.4], [-W / 2 + 1.2, D / 2 - 1.4]], t: i * 2, sp: 0.8 }); }
  }
  // kitchen crew: hired staff stand at their stations and work (content/mutfak.ts)
  if (m.mutfak) {
    const POST: Record<string, [number, number, number][]> = {   // [u, v, rotY]
      asci: [[-6.3, -0.75, Math.PI], [-2.7, -0.75, Math.PI], [0.8, -0.75, Math.PI], [2.7, -0.75, Math.PI], [-4.5, -0.75, Math.PI]],
      bulasikci: [[-7.2, 0.8, 0], [-6.0, 0.8, 0]], kasiyer: [[7.8, -0.75, Math.PI], [6.6, -0.75, Math.PI], [5.4, -0.75, Math.PI]], sef: [[0, -0.55, 0], [1.8, -0.55, Math.PI]],
    };
    const used: Record<string, number> = {};
    ekip.forEach((e, i) => {
      if (e.rol === 'komi') { const p = person('chef', ctx.seed + 70 + i, false); cur.add(p); an.walkers.push({ o: p, p: [[-3.4, 0.7], [3.9, 0.7], [7.0, 0.3], [-3.4, 0.7]], t: i, sp: 0.7 }); return; }
      const arr = POST[e.rol]; if (!arr) return; const k = used[e.rol] = (used[e.rol] || 0) + 1, post = arr[(k - 1) % arr.length];
      const p = person(e.rol === 'kasiyer' ? 'clerk' : e.rol === 'bulasikci' ? 'staff' : 'chef', ctx.seed + 90 + i * 5, false, e.rol === 'bulasikci' ? '#1d4f86' : '#1d1d1d'); p.position.set(post[0], 0, post[1]); p.rotation.y = post[2]; cur.add(p); an.bob.push(p);
      if (e.rank >= 4 && e.rol !== 'kasiyer') part(p, BOX, '#c9a24a', 0, 1.0, 0.14, 0.08, 0.2, 0.02);   // rank sash from level 5
    });
  }
  if (m.tur === 'morg') an.flick.push(grp);
  const M = mats();
  if (!wb.empty) { const wm = wb.mesh(M.wall, false, true); grp.add(wm); }
  if (!b.empty) grp.add(b.mesh(M.solid, true, true));
  if (!g.empty) { const gm = g.mesh(M.glass, false, false); gm.renderOrder = 2; grp.add(gm); }
  if (!l.empty) { const lmesh = l.mesh(M.glow, false, false); grp.add(lmesh); an.lamps = lmesh; }
  return { g: grp, an };
}

export function createIcMekan(d: IcDeps): IcView {
  const holder = new T.Group(); holder.name = 'icMekan';
  const rooms = new Map<string, { key: string; g: T.Group; an: Anim }>();
  let t = 0, inside: string | null = null, acc = 1;
  const keep = new Set<unknown>([BOX, SPH]);
  const kill = (id: string) => {
    const r = rooms.get(id); if (!r) return; r.g.removeFromParent();
    const M = mats(), shared = new Set<unknown>([M.solid, M.glass, M.glow, M.wall, ...LM.values()]);
    r.g.traverse(o => { const mm = o as T.Mesh; if (!mm.isMesh) return; if (!keep.has(mm.geometry)) mm.geometry.dispose(); const mt = mm.material as T.MeshBasicMaterial; if (!shared.has(mt)) { mt.map?.dispose(); mt.dispose(); } });
    rooms.delete(id);
  };
  return {
    icinde: () => inside,
    update(dt) {
      const root = d.root(); if (!root) return;
      if (holder.parent !== root) root.add(holder);
      t += dt; acc += dt;
      const hp = d.hero(); inside = null;
      for (const m of IC_MEKANLAR) if (icIcinde(m, hp, -0.1)) { inside = m.id; break; }
      if (acc >= 0.3) {   // (re)build what is near, drop what is far
        acc = 0;
        const own = d.isletme(), sl = d.salon();
        for (const m of IC_MEKANLAR) {
          const dist = Math.hypot(hp.x - m.x, hp.z - m.z), R = Math.max(m.wx, m.wz) / 2, exists = m.salon ? sl.stage >= (m.salon === 'W' ? 6 : 7) : m.mutfak ? sl.stage >= 3 : true;
          if (!exists || dist > R + 30) { kill(m.id); continue; }
          if (dist > R + 18) continue;
          const o = m.arsa ? own[m.arsa] || null : null, fine = (!!m.salon || !!m.mutfak) && sl.stage >= 10, mk = m.mutfak ? d.mutfak() : null;
          const key = (o ? o.lv + ':' + o.isci + ':' + [...o.esya].sort().join(',') : '-') + '|' + (m.salon ? sl.esya.filter(e => e).sort().join(',') + (fine ? 'F' : '') : '') + (mk ? 'M' + sl.stage + ':' + mk.ekip.map(e => e.rol + e.rank).join(',') : '');
          const r = rooms.get(m.id); if (r && r.key === key) continue;
          kill(m.id); const nb = buildRoom(m, o, sl.esya, fine, sl.stage, mk ? mk.ekip : []); holder.add(nb.g); rooms.set(m.id, { key, g: nb.g, an: nb.an });
        }
      }
      const nk = d.night();
      for (const [id, r] of rooms) {
        const m = IC_MEKANLAR.find(x => x.id === id)!;
        r.g.visible = !!m.salon || icIcinde(m, hp, 0.5);
        if (!r.g.visible) continue;
        const a = r.an;
        for (const s of a.spin) s.rotation.y += dt * 2.2;
        for (const f of a.fire) { const k = 0.75 + 0.35 * Math.sin(t * 13 + f.userData.ph) + 0.15 * Math.sin(t * 29 + f.userData.ph * 2); f.scale.set(1, k, 1); }
        for (const f of a.fish) { const w = f.userData.w as number, x = Math.sin(t * 0.4 + f.userData.ph) * (w / 2 - 0.25); f.position.x = x; f.rotation.y = Math.cos(t * 0.4 + f.userData.ph) > 0 ? 0 : Math.PI; f.position.y += Math.sin(t * 2 + f.userData.ph) * 0.0015; }
        for (let i = 0; i < a.screens.length; i++) a.screens[i].color.setHSL(((t * 0.05 + i * 0.3) % 1), 0.55, 0.42 + 0.06 * Math.sin(t * 3 + i));
        for (const p of a.bob) p.rotation.z = Math.sin(t * 1.4 + p.position.x * 3) * 0.04;
        for (const w of a.walkers) { const P = w.p, n = P.length, i0 = Math.floor(w.t) % n, i1 = (i0 + 1) % n, L = Math.max(0.5, Math.hypot(P[i1][0] - P[i0][0], P[i1][1] - P[i0][1])); w.t = (w.t + dt * w.sp / L) % n; const f = w.t - Math.floor(w.t); w.o.position.set(P[i0][0] + (P[i1][0] - P[i0][0]) * f, Math.abs(Math.sin(t * 8)) * 0.03, P[i0][1] + (P[i1][1] - P[i0][1]) * f); w.o.rotation.y = Math.atan2(P[i1][0] - P[i0][0], P[i1][1] - P[i0][1]); }
        if (a.kds && (a.kdsT = (a.kdsT || 0) - dt) <= 0) { a.kdsT = 0.7; a.kds.draw(d.mutfak().kds); }
        if (a.flick.length && a.lamps) a.lamps.visible = Math.sin(t * 23) + Math.sin(t * 7.3) > -1.2;
        void nk;
      }
    },
    dispose() { for (const id of [...rooms.keys()]) kill(id); holder.removeFromParent(); },
  };
}
