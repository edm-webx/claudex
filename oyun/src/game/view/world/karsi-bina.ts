/**
 * Karşı yaka binaları (2026-11-08, owner: "kuş bakışı var gibi duruyor ama binalar yok ortada, modeller yapman lazım").
 * Every far-side building is a real procedural model on the footprint that content/zones/karsi.ts collides: plinth,
 * corner pilasters, floor cornices, framed windows with sills/lintels (some with shutters, balconies, flower boxes),
 * shop fronts with glass, mullions and striped awnings, entrances with canopies and steps, parapets, rooftop AC units,
 * water tanks and stair huts, lit signs, and window glow at night. Four faces are detailed (the camera turns).
 * Per building: one merged wall mesh (plaster texture with world UVs), one glass mesh (sky reflections), one glow mesh
 * (night only), plus sign planes. Pure view: no colliders, no sim.
 */
import * as T from 'three';
import { Batch, mtx } from '../../../engine/prefab/batch';
import { v2rng } from '../../../content/prefabs/common/v2kit';
import { useSkyEnv } from './glb';

export interface BinaDeps { root: () => T.Object3D | null; night: () => number }
export interface BinaView { update(dt: number): void; dispose(): void }

type Front = '+z' | '-z' | '+x' | '-x';
type Face = 'front' | 'back' | 'left' | 'right';
const YAW: Record<Front, number> = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };
const O = { r: 0 };

interface Win { w: number; h: number; gap: number; frame: string; shutter?: string; flower?: boolean; balcony?: boolean }
interface Spec {
  id: string; x: number; z: number; wx: number; wz: number; front: Front; floors: number; fh: number;
  wall: string; trim: string; accent: string; ground: 'shop' | 'entrance' | 'plain' | 'hatch' | 'garage';
  sign?: { text: string; bg: string; fg: string; w?: number }; win: Win; lit: number; roof: 'flat' | 'tile';
  curtain?: boolean; extra?: (k: Kit, L: Dim) => void;
}
interface Dim { w: number; d: number; H: number; y0: number }
interface Kit { b: Batch; g: Batch; n: Batch; grp: T.Group; rng: ReturnType<typeof v2rng>; face(f: Face, L: Dim, fn: (len: number) => void): void; sign(text: string, bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, ry?: number): void }

const GLOW = ['#ffd890', '#ffe6b0', '#fff3d6', '#ffcf8a', '#d8ecff'];
const GLASS = ['#2f4d66', '#35566f', '#2c4a5e', '#3b5f78'];

/* ---------- shared materials / textures (lazy: document only at runtime) ---------- */
let wallMat: T.MeshStandardMaterial | null = null, glassMat: T.MeshStandardMaterial | null = null, glowMat: T.MeshBasicMaterial | null = null;
const signMats: T.MeshStandardMaterial[] = [];
function plasterTex(): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 256, 256);
  const r = v2rng(91);
  for (let i = 0; i < 2600; i++) { const v = 222 + Math.floor(r.next() * 33); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r.next() * 256, r.next() * 256, 1 + r.next() * 2.5, 1 + r.next() * 2.5); }
  g.strokeStyle = 'rgba(0,0,0,0.05)'; g.lineWidth = 2; for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(90,80,70,0.04)'; g.fillRect(r.next() * 256, 0, 8 + r.next() * 20, 256); }   // weathering streaks
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; return t;
}
function mats() {
  if (!wallMat) {
    wallMat = new T.MeshStandardMaterial({ vertexColors: true, map: plasterTex(), roughness: 0.9, metalness: 0 }); useSkyEnv(wallMat, 'matte');
    glassMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.08, metalness: 0.55 }); useSkyEnv(glassMat, 'glass');
    glowMat = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  }
  return { wallMat: wallMat!, glassMat: glassMat!, glowMat: glowMat! };
}
function signTex(text: string, bg: string, fg: string, aspect: number): T.CanvasTexture {
  const h = 128, w = Math.round(h * aspect); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = fg; g.font = '900 78px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = w - 40; if (m > max) { g.save(); g.translate(w / 2, h / 2 + 4); g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, w / 2, h / 2 + 4);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/* ---------- the generic building ---------- */
function build(s: Spec): T.Group {
  const grp = new T.Group(); grp.name = 'bina-' + s.id;
  const swap = s.front === '+x' || s.front === '-x', w = swap ? s.wz : s.wx, d = swap ? s.wx : s.wz;
  const y0 = 0.32, H = y0 + s.floors * s.fh, L: Dim = { w, d, H, y0 };
  const b = new Batch(), g = new Batch(), n = new Batch(), rng = v2rng(s.id.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
  const FACE: Record<Face, [number, number, number, number]> = { front: [0, d / 2, 0, w], back: [0, -d / 2, Math.PI, w], right: [w / 2, 0, Math.PI / 2, d], left: [-w / 2, 0, -Math.PI / 2, d] };
  const k: Kit = {
    b, g, n, grp, rng,
    face(f, _L, fn) { const [x, z, ry, len] = FACE[f], M = mtx(x, 0, z, 0, ry, 0); b.push(M); g.push(M); n.push(M); fn(len); b.pop(); g.pop(); n.pop(); },
    sign(text, bg, fg, sw, sh, x, y, z, ry = 0) {
      const tex = signTex(text, bg, fg, sw / sh), m = new T.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.6 });
      signMats.push(m); const p = new T.Mesh(new T.PlaneGeometry(sw, sh), m); p.position.set(x, y, z); p.rotation.y = ry; grp.add(p);
      b.push(mtx(x, y, z, 0, ry, 0)); b.box(sw + 0.16, sh + 0.16, 0.12, '#2a2d33', 0, 0, -0.07, O); b.pop();
    },
  };
  // body, plinth, pilasters, cornices, parapet, roof slab
  b.box(w, H - y0, d, s.wall, 0, y0 + (H - y0) / 2, 0, { r: 0, world: 3 });
  b.box(w + 0.14, y0 + 0.08, d + 0.14, '#8f8a82', 0, (y0 + 0.08) / 2, 0, O);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(0.34, H - y0, 0.34, s.trim, cx * (w / 2 - 0.1), y0 + (H - y0) / 2, cz * (d / 2 - 0.1), O);
  for (let f = 1; f < s.floors; f++) b.box(w + 0.16, 0.16, d + 0.16, s.trim, 0, y0 + f * s.fh, 0, O);
  b.box(w + 0.3, 0.22, d + 0.3, s.trim, 0, H + 0.02, 0, O);                                                   // top cornice
  if (s.roof === 'flat') {
    for (const sg of [-1, 1]) { b.box(w + 0.3, 0.6, 0.22, s.trim, 0, H + 0.4, sg * (d / 2 + 0.04), O); b.box(0.22, 0.6, d + 0.3, s.trim, sg * (w / 2 + 0.04), H + 0.4, 0, O); }
    b.box(w, 0.08, d, '#77797e', 0, H + 0.16, 0, O);
    const nAC = Math.max(1, Math.round(w * d / 40));
    for (let i = 0; i < nAC; i++) { const ax = (rng.next() - 0.5) * (w - 2.4), az = (rng.next() - 0.5) * (d - 2.2); b.box(1.0, 0.7, 0.8, '#d3d7dc', ax, H + 0.55, az, O); b.cyl(0.3, 0.3, 0.04, '#3c4146', ax, H + 0.92, az, { seg: 12 }); }
    if (w * d > 30) { const tx = w / 2 - 1.4, tz = -d / 2 + 1.3; b.cyl(0.6, 0.6, 1.2, '#e8e4dc', tx, H + 0.8, tz, { seg: 14 }); b.cyl(0.62, 0.62, 0.08, '#9aa0a6', tx, H + 1.42, tz, { seg: 14 }); for (const q of [-1, 1]) b.box(0.08, 0.4, 0.08, '#5b6068', tx + q * 0.4, H + 0.3, tz, O); }
    if (s.floors >= 2 && w * d > 40) { const hx = -w / 2 + 1.6, hz = d / 2 - 1.5; b.box(2.2, 2.3, 2.0, s.wall, hx, H + 1.27, hz, { r: 0, world: 3 }); b.box(2.4, 0.15, 2.2, s.trim, hx, H + 2.45, hz, O); b.box(0.9, 1.8, 0.05, '#4a3a2c', hx, H + 1.02, hz + 1.02, O); }
    b.cyl(0.03, 0.03, 2.4, '#8c969e', w / 2 - 0.6, H + 1.4, d / 2 - 0.6, { seg: 5 });                               // antenna
  } else {
    const r = Math.hypot(w, d) / 2 + 0.25; b.cone(r, 1.6, '#c8693e', 0, H + 0.9, 0, { seg: 4, ry: Math.PI / 4, sx: (w + 0.6) / (r * 1.414), sz: (d + 0.6) / (r * 1.414) });
  }
  // downpipes on the back corners
  for (const sg of [-1, 1]) b.cyl(0.06, 0.06, H, '#8c969e', sg * (w / 2 - 0.05), H / 2, -d / 2 - 0.09, { seg: 6 });

  // windows on every face
  const W = s.win;
  const window = (u: number, y: number, ww: number, wh: number, balcony = false) => {
    b.box(ww + 0.18, wh + 0.18, 0.08, W.frame, u, y, 0.04, O);
    const gc = rng.pick(GLASS); g.plane(ww, wh, gc, u, y, 0.085);
    if (rng.chance(0.4)) g.plane(ww * 0.42, wh * 0.85, rng.pick(['#e9dcc2', '#d9c3a0', '#c9d6e3']), u - ww * 0.27, y - wh * 0.03, 0.088);   // curtain
    b.box(0.05, wh, 0.03, W.frame, u, y, 0.1, O); b.box(ww, 0.05, 0.03, W.frame, u, y + wh * 0.18, 0.1, O);
    b.box(ww + 0.34, 0.08, 0.2, '#e8e4dc', u, y - wh / 2 - 0.12, 0.1, O);
    b.box(ww + 0.3, 0.12, 0.1, s.trim, u, y + wh / 2 + 0.15, 0.05, O);
    if (W.shutter && !balcony) for (const sg of [-1, 1]) { b.box(ww * 0.48, wh + 0.1, 0.05, W.shutter, u + sg * (ww * 0.75 + 0.06), y, 0.06, O); for (let i = 0; i < 5; i++) b.box(ww * 0.42, 0.03, 0.02, '#5a4a3a', u + sg * (ww * 0.75 + 0.06), y - wh / 2 + 0.15 + i * wh / 5, 0.09, O); }
    if (W.flower && !balcony) { b.box(ww + 0.1, 0.22, 0.26, '#7d5638', u, y - wh / 2 - 0.3, 0.2, O); for (let i = 0; i < 4; i++) b.sph(0.11, rng.pick(['#e0533c', '#f2a2b3', '#ffd23f', '#6f9e4f']), u - ww * 0.36 + i * ww * 0.24, y - wh / 2 - 0.12, 0.2, { ws: 6, hs: 4 }); }
    if (balcony) {
      b.box(ww + 1.0, 0.12, 0.85, s.trim, u, y - wh / 2 - 0.06, 0.42, O);
      for (let i = 0; i <= 6; i++) b.box(0.04, 0.85, 0.04, '#3c4146', u - (ww + 0.9) / 2 + i * (ww + 0.9) / 6, y - wh / 2 + 0.42, 0.82, O);
      b.box(ww + 0.95, 0.05, 0.06, '#3c4146', u, y - wh / 2 + 0.86, 0.82, O);
      if (rng.chance(0.6)) b.cyl(0.16, 0.12, 0.3, '#c8693e', u + ww * 0.4, y - wh / 2 + 0.15, 0.55, { seg: 8 }), b.sph(0.22, '#6f9e4f', u + ww * 0.4, y - wh / 2 + 0.42, 0.55, { ws: 8, hs: 5 });
    }
    if (rng.chance(s.lit)) n.plane(ww * 0.94, wh * 0.94, rng.pick(GLOW), u, y, 0.095);
  };
  const row = (len: number, y: number, skip: (u: number) => boolean, balcony = false, ww = W.w, wh = W.h) => {
    const step = ww + W.gap, cols = Math.max(1, Math.floor((len - 1.0) / step)), u0 = -(cols - 1) * step / 2;
    for (let c = 0; c < cols; c++) { const u = u0 + c * step; if (!skip(u)) window(u, y, ww, wh, balcony && c % 2 === 0); }
  };
  const faces: Face[] = ['front', 'back', 'left', 'right'];
  for (const f of faces) k.face(f, L, len => {
    for (let fl = 0; fl < s.floors; fl++) {
      const y = y0 + fl * s.fh + s.fh * 0.55;
      if (f === 'front' && fl === 0 && s.ground !== 'plain') continue;
      if (f === 'front' && fl > 0 && s.curtain) continue;
      row(len, y, u => (f === 'front' && fl === 0 && Math.abs(u) < 1.2) || (f === 'back' && fl === 0 && Math.abs(u) < 0.9 && s.ground !== 'hatch'), f === 'front' && fl > 0 && !!W.balcony);
    }
    if (f === 'back' && s.ground !== 'hatch') { b.box(1.1, 2.1, 0.06, '#5b6068', 0, y0 + 1.05, 0.03, O); b.box(1.5, 0.1, 0.7, s.trim, 0, y0 + 2.35, 0.35, O); }   // service door
  });
  // ground floor of the front face
  k.face('front', L, len => {
    const gy = y0, gh = Math.min(s.fh - 0.5, 2.9);
    if (s.ground === 'shop') {
      const x0 = -len / 2 + 0.55, x1 = len / 2 - 0.55, span = x1 - x0, nP = Math.max(2, Math.round(span / 1.5));
      b.box(span + 0.2, 0.45, 0.12, '#3c4146', 0, gy + 0.22, 0.06, O);
      b.box(span + 0.2, gh + 0.2, 0.06, '#2a2d33', 0, gy + 0.45 + gh / 2, 0.03, O);
      g.plane(span, gh, '#3d6782', 0, gy + 0.45 + gh / 2, 0.07);
      for (let i = 0; i <= nP; i++) b.box(0.07, gh, 0.06, '#2a2d33', x0 + i * span / nP, gy + 0.45 + gh / 2, 0.09, O);
      b.box(1.1, gh - 0.1, 0.05, '#1f2226', 0, gy + 0.45 + (gh - 0.1) / 2, 0.1, O); g.plane(0.9, gh - 0.35, '#4b7a96', 0, gy + 0.45 + (gh - 0.35) / 2 + 0.1, 0.13); b.box(0.04, 0.4, 0.06, '#c9a23a', 0.36, gy + 1.5, 0.16, O);
      n.plane(span * 0.98, gh * 0.95, '#ffe2a8', 0, gy + 0.45 + gh / 2, 0.075);
      // striped awning
      const aw = s.accent, nS = Math.max(6, Math.round(span / 0.55)), sw = (span + 0.4) / nS;
      for (let i = 0; i < nS; i++) b.box(sw, 0.05, 1.35, i % 2 ? aw : '#fbfaf6', -span / 2 - 0.2 + sw * (i + 0.5), gy + gh + 0.85, 0.62, { r: 0, rx: 0.38 });
      for (let i = 0; i < nS; i++) b.box(sw, 0.22, 0.03, i % 2 ? aw : '#fbfaf6', -span / 2 - 0.2 + sw * (i + 0.5), gy + gh + 0.5, 1.26, O);
    } else if (s.ground === 'entrance') {
      for (const sg of [-1, 1]) b.box(0.6, gh + 0.4, 0.12, s.trim, sg * 1.5, gy + (gh + 0.4) / 2, 0.06, O);
      b.box(2.4, gh, 0.06, '#2a2d33', 0, gy + gh / 2, 0.03, O); g.plane(2.2, gh - 0.15, '#3d6782', 0, gy + gh / 2, 0.07); b.box(0.06, gh, 0.06, '#2a2d33', 0, gy + gh / 2, 0.09, O);
      n.plane(2.1, gh - 0.2, '#fff1d0', 0, gy + gh / 2, 0.075);
      b.box(4.2, 0.2, 2.0, s.trim, 0, gy + gh + 0.45, 1.0, O); for (const sg of [-1, 1]) b.cyl(0.09, 0.09, gh + 0.35, '#d3d7dc', sg * 1.9, gy + (gh + 0.35) / 2, 1.85, { seg: 8 });
      for (let i = 0; i < 3; i++) b.box(4.0 - i * 0.3, 0.12, 0.45, '#b9b3a6', 0, 0.06 + i * 0.12, 1.75 - i * 0.4, O);
      row(len, gy + gh * 0.55, u => Math.abs(u) < 2.4);
    } else if (s.ground === 'hatch') {
      b.box(2.2, 1.2, 0.08, '#2a2d33', 0, gy + 1.45, 0.04, O); g.plane(2.0, 1.0, '#ffe8c0', 0, gy + 1.45, 0.08); n.plane(2.0, 1.0, '#ffe2a8', 0, gy + 1.45, 0.09);
      b.box(2.5, 0.08, 0.5, '#b07a48', 0, gy + 0.85, 0.25, O); b.box(2.6, 0.06, 0.9, s.accent, 0, gy + 2.25, 0.42, { r: 0, rx: 0.3 });
      for (let i = 0; i < 6; i++) b.box(0.18, 0.24, 0.14, rng.pick(['#e0533c', '#ffd23f', '#2f6fdb', '#49b96a']), -0.9 + i * 0.36, gy + 1.0, 0.22, O);   // snacks on the counter
    } else if (s.ground === 'garage') {
      b.box(2.4, 2.4, 0.06, '#6f747c', 0, gy + 1.2, 0.03, O); for (let i = 0; i < 10; i++) b.box(2.3, 0.03, 0.04, '#5b6068', 0, gy + 0.15 + i * 0.23, 0.07, O);
      b.box(0.9, 2.0, 0.06, '#5b6068', len / 2 - 0.8, gy + 1.0, 0.03, O);
    } else {
      b.box(1.1, 2.1, 0.08, '#5a4030', 0, gy + 1.05, 0.04, O); b.box(1.6, 0.1, 0.8, s.trim, 0, gy + 2.35, 0.4, O); g.plane(0.5, 0.6, '#3d6782', 0, gy + 1.55, 0.09);
    }
    if (s.curtain) {
      const cy0 = y0 + s.fh, ch = H - cy0 - 0.25, cw = len - 1.0, nx = Math.round(cw / 1.6), ny = s.floors - 1;
      b.box(cw + 0.2, ch + 0.2, 0.06, '#2a2d33', 0, cy0 + ch / 2, 0.03, O); g.plane(cw, ch, '#44708e', 0, cy0 + ch / 2, 0.07);
      for (let i = 0; i <= nx; i++) b.box(0.08, ch, 0.08, '#c9ced6', -cw / 2 + i * cw / nx, cy0 + ch / 2, 0.1, O);
      for (let j = 0; j <= ny; j++) b.box(cw, 0.1, 0.1, '#c9ced6', 0, cy0 + j * ch / ny, 0.1, O);
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) if (rng.chance(s.lit * 0.55)) n.plane(cw / nx * 0.94, ch / ny * 0.92, rng.pick(GLOW), -cw / 2 + (i + 0.5) * cw / nx, cy0 + (j + 0.5) * ch / ny, 0.075);
    }
  });
  if (s.sign) { const sw = s.sign.w ?? Math.min(w - 1.2, 6.5); const [fx, , fz] = [0, 0, d / 2]; k.sign(s.sign.text, s.sign.bg, s.sign.fg, sw, sw / 5.2, fx, s.ground === 'shop' ? y0 + Math.min(s.fh - 0.5, 2.9) + 1.55 : s.ground === 'entrance' ? H - 0.45 : y0 + 2.75, fz + 0.16); }
  s.extra?.(k, L);

  const { wallMat: wm, glassMat: gm, glowMat: lm } = mats();
  const wallMesh = b.mesh(wm, false, true); grp.add(wallMesh);
  if (!g.empty) grp.add(g.mesh(gm, false, false));
  if (!n.empty) { const nm = n.mesh(lm, false, false); nm.renderOrder = 2; grp.add(nm); }
  grp.position.set(s.x, 0.12, s.z); grp.rotation.y = YAW[s.front];
  return grp;
}

/* ---------- the far side ---------- */
const SPECS: Spec[] = [
  { id: 'kafe1', x: -17.5, z: 37.9, wx: 7, wz: 9.4, front: '+x', floors: 2, fh: 3.1, wall: '#f3d2a2', trim: '#fbf3e4', accent: '#c2551f', ground: 'shop', lit: 0.7, roof: 'flat',
    sign: { text: '☕ MEYDAN KAFE', bg: '#7a3b1c', fg: '#ffe9c4' }, win: { w: 1.1, h: 1.45, gap: 1.0, frame: '#fbf3e4', shutter: '#3f7d5a', flower: true }, extra: cafeTerrace },
  { id: 'kafe2', x: -17.5, z: 51.5, wx: 7, wz: 9.4, front: '+x', floors: 2, fh: 3.1, wall: '#cfe3ea', trim: '#fbfaf6', accent: '#2f6fdb', ground: 'shop', lit: 0.7, roof: 'flat',
    sign: { text: '⚓ SAHİL KAFE', bg: '#1d4f86', fg: '#ffffff' }, win: { w: 1.1, h: 1.45, gap: 1.0, frame: '#fbfaf6', shutter: '#2b6fb8', flower: true }, extra: cafeTerrace },
  { id: 'kirtasiye', x: 28, z: 35.2, wx: 7.1, wz: 3.6, front: '-z', floors: 2, fh: 3.0, wall: '#bcd7ea', trim: '#f4f4f0', accent: '#ffd23f', ground: 'shop', lit: 0.6, roof: 'flat',
    sign: { text: '✏️ KIRTASİYE', bg: '#ffd23f', fg: '#1d3557' }, win: { w: 1.0, h: 1.4, gap: 0.9, frame: '#f4f4f0', balcony: true }, extra: stationeryRack },
  { id: 'okul', x: 48.85, z: 37.25, wx: 18.3, wz: 7.5, front: '+z', floors: 3, fh: 3.2, wall: '#efc98c', trim: '#a2472f', accent: '#a2472f', ground: 'entrance', lit: 0.25, roof: 'flat',
    sign: { text: 'MARTIKÖY İLKOKULU', bg: '#fbf3e4', fg: '#a2472f', w: 8.4 }, win: { w: 1.5, h: 1.7, gap: 0.8, frame: '#fbfaf6' }, extra: schoolExtras },
  { id: 'kantin', x: 56.15, z: 42.8, wx: 3.7, wz: 2.8, front: '-x', floors: 1, fh: 3.0, wall: '#f6efe1', trim: '#e0533c', accent: '#e0533c', ground: 'hatch', lit: 0.5, roof: 'tile',
    sign: { text: 'KANTİN', bg: '#e0533c', fg: '#ffffff', w: 2.4 }, win: { w: 0.8, h: 0.9, gap: 0.8, frame: '#fbfaf6' } },
  { id: 'avm', x: 20.15, z: 50.6, wx: 16.9, wz: 12.8, front: '-z', floors: 3, fh: 3.6, wall: '#d7dde8', trim: '#3f4a6b', accent: '#e0533c', ground: 'shop', lit: 0.8, roof: 'flat', curtain: true,
    sign: { text: 'MARTI AVM', bg: '#e0533c', fg: '#ffffff', w: 8.0 }, win: { w: 2.2, h: 2.2, gap: 0.6, frame: '#3f4a6b' }, extra: mallExtras },
  { id: 'hastane', x: 46.95, z: 53.55, wx: 16.9, wz: 6.7, front: '-z', floors: 4, fh: 3.0, wall: '#f2f4f6', trim: '#9aa5b0', accent: '#d93a3a', ground: 'entrance', lit: 0.65, roof: 'flat',
    sign: { text: 'DEVLET HASTANESİ', bg: '#ffffff', fg: '#d93a3a', w: 8.0 }, win: { w: 1.3, h: 1.5, gap: 0.7, frame: '#9fb9d0' }, extra: hospitalExtras },
  { id: 'acil', x: 57.3, z: 52.0, wx: 3.3, wz: 3.2, front: '-x', floors: 1, fh: 3.3, wall: '#f2f4f6', trim: '#d93a3a', accent: '#d93a3a', ground: 'entrance', lit: 0.9, roof: 'flat',
    sign: { text: 'ACİL', bg: '#d93a3a', fg: '#ffffff', w: 2.4 }, win: { w: 0.8, h: 1.0, gap: 0.7, frame: '#d93a3a' } },
  { id: 'banka', x: 11.7, z: 36.8, wx: 10, wz: 8.4, front: '+z', floors: 2, fh: 3.3, wall: '#e9dfc8', trim: '#fbf6ea', accent: '#c9a23a', ground: 'entrance', lit: 0.35, roof: 'flat',
    sign: { text: 'MARTI KASASI BANKASI', bg: '#1f3a5f', fg: '#f2c230', w: 6.6 }, win: { w: 1.2, h: 1.8, gap: 0.9, frame: '#c9a23a' }, extra: bankExtras },
  { id: 'morg', x: 57.3, z: 55.5, wx: 3.3, wz: 3.2, front: '-x', floors: 1, fh: 3.1, wall: '#b9bec6', trim: '#5b6068', accent: '#5b6068', ground: 'garage', lit: 0.05, roof: 'flat',
    sign: { text: 'MORG', bg: '#3c4146', fg: '#c9ced6', w: 1.8 }, win: { w: 0.5, h: 0.5, gap: 1.6, frame: '#5b6068' } },
];

function cafeTerrace(k: Kit, L: Dim) {
  const { b } = k, fz = L.d / 2;
  for (const u of [-L.w / 2 + 1.0, L.w / 2 - 1.0]) {
    const z = fz + 1.3; b.cyl(0.35, 0.35, 0.05, '#fbfaf6', u, 0.75, z, { seg: 12 }); b.cyl(0.04, 0.04, 0.72, '#3c4146', u, 0.38, z, { seg: 5 });
    for (const sg of [-1, 1]) { b.box(0.38, 0.05, 0.38, '#b07a48', u + sg * 0.6, 0.45, z, O); b.box(0.38, 0.4, 0.05, '#b07a48', u + sg * 0.78, 0.66, z, { r: 0, ry: Math.PI / 2 }); }
    b.cyl(0.03, 0.03, 2.1, '#d3d7dc', u, 1.05, z, { seg: 5 }); b.cone(1.1, 0.5, k.rng.pick(['#c2551f', '#2f6fdb', '#e0533c']), u, 2.25, z, { seg: 8 });
  }
  b.box(0.5, 1.0, 0.06, '#2a2d33', L.w / 2 - 0.3, 0.6, fz + 0.9, { r: 0, rx: -0.15 });   // A-board menu
}
function stationeryRack(k: Kit, L: Dim) {
  const { b } = k, fz = L.d / 2 + 0.45;
  b.box(1.2, 1.3, 0.4, '#7d5638', -L.w / 2 + 1.0, 0.65, fz, O);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) b.box(0.18, 0.3, 0.05, k.rng.pick(['#e0533c', '#2f6fdb', '#ffd23f', '#49b96a', '#8a6bbf']), -L.w / 2 + 0.6 + i * 0.2, 0.35 + r * 0.42, fz + 0.22, O);
}
function schoolExtras(k: Kit, L: Dim) {
  const { b, grp } = k, fz = L.d / 2;
  // clock above the entrance, flag pole in the yard, bike rack
  b.cyl(0.55, 0.55, 0.1, '#fbfaf6', 0, L.H - 1.6, fz + 0.08, { rx: Math.PI / 2, seg: 18 }); b.box(0.04, 0.38, 0.03, '#2a2d33', 0, L.H - 1.48, fz + 0.15, O); b.box(0.28, 0.04, 0.03, '#2a2d33', 0.12, L.H - 1.6, fz + 0.15, O);
  const px = L.w / 2 - 1.5, pz = fz + 3.0; b.cyl(0.06, 0.08, 9, '#d3d7dc', px, 4.5, pz, { seg: 8 }); b.box(1.2, 0.3, 1.2, '#b9b3a6', px, 0.15, pz, O);
  const flagTex = (() => { const c = document.createElement('canvas'); c.width = 192; c.height = 128; const g = c.getContext('2d')!; g.fillStyle = '#e30a17'; g.fillRect(0, 0, 192, 128); g.fillStyle = '#fff'; g.beginPath(); g.arc(70, 64, 32, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e30a17'; g.beginPath(); g.arc(78, 64, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 6 : 15; g.lineTo(112 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.fill(); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; })();
  const flag = new T.Mesh(new T.PlaneGeometry(1.8, 1.2, 8, 1), new T.MeshLambertMaterial({ map: flagTex, side: T.DoubleSide })); flag.position.set(px + 0.92, 8.3, pz); flag.name = 'bayrak'; grp.add(flag);
  for (let i = 0; i < 5; i++) b.tor(0.32, 0.03, '#5b6068', -L.w / 2 + 2 + i * 0.5, 0.35, fz + 1.2, { ry: Math.PI / 2, rs: 5, ts: 12, arc: Math.PI });
}
function bankExtras(k: Kit, L: Dim) {
  const { b } = k, fz = L.d / 2;
  // classical porch: six columns, architrave, pediment, ATM on the side, brass lamps
  for (let i = 0; i < 6; i++) { const u = -3.5 + i * 1.4; if (Math.abs(u) < 1.0) continue; b.cyl(0.24, 0.27, 3.6, '#f6f0e2', u, L.y0 + 1.8, fz + 1.4, { seg: 14 }); b.box(0.62, 0.18, 0.62, '#d9cfb8', u, L.y0 + 0.09, fz + 1.4, O); b.box(0.62, 0.2, 0.62, '#d9cfb8', u, L.y0 + 3.7, fz + 1.4, O); }
  b.box(8.4, 0.5, 2.0, '#fbf6ea', 0, L.y0 + 4.05, fz + 1.0, O);
  b.cyl(1.2, 1.2, 8.4, '#efe6d2', 0, L.y0 + 4.3, fz + 1.2, { seg: 3, rz: Math.PI / 2, sz: 0.5 });
  for (const sg of [-1, 1]) { b.cyl(0.06, 0.06, 2.6, '#2b2b2b', sg * 4.6, 1.3, fz + 2.6, { seg: 8 }); b.sph(0.2, '#ffe9a8', sg * 4.6, 2.75, fz + 2.6, { ws: 8, hs: 6 }); k.n.sph(0.32, '#ffd97a', sg * 4.6, 2.75, fz + 2.6, { ws: 8, hs: 6 }); }
}
function mallExtras(k: Kit, L: Dim) {
  const { b } = k, fz = L.d / 2;
  b.box(7.0, 0.3, 3.2, '#3f4a6b', 0, L.y0 + 3.55, fz + 1.6, O); for (const sg of [-1, 1]) b.box(0.25, 3.4, 0.25, '#c9ced6', sg * 3.2, L.y0 + 1.7, fz + 3.0, O);
  for (const [sg, c] of [[-1, '#ffd23f'], [1, '#2ec4c4']] as [number, string][]) { b.box(0.08, 5.5, 1.3, c, sg * (L.w / 2 + 0.05), L.H - 3.6, fz - 1.4, O); }
  for (let i = 0; i < 4; i++) { const u = -L.w / 2 + 1.5 + i * 1.2; b.cyl(0.3, 0.3, 0.5, '#7d8a96', u, 0.25, fz + 4.0, { seg: 10 }); b.sph(0.38, '#5f8f4a', u, 0.75, fz + 4.0, { ws: 8, hs: 5 }); }
  k.sign('İNDİRİM %50', '#ffd23f', '#e0533c', 3.0, 0.7, L.w / 2 - 2.6, L.y0 + 2.6, fz + 0.2);
}
function hospitalExtras(k: Kit, L: Dim) {
  const { b, grp } = k, fz = L.d / 2;
  for (const [x, w0, h0] of [[0, 2.4, 0.7], [0, 0.7, 2.4]]) b.box(w0, h0, 0.12, '#d93a3a', L.w / 2 - 2.0 + x, L.H - 1.7, fz + 0.1, O);
  // helipad on the roof
  b.cyl(2.4, 2.4, 0.06, '#5b6068', -L.w / 2 + 4.2, L.H + 0.24, 0, { seg: 24 }); b.tor(2.1, 0.06, '#ffd23f', -L.w / 2 + 4.2, L.H + 0.28, 0, { rx: Math.PI / 2, ts: 28 });
  b.box(0.25, 0.04, 1.6, '#fbfaf6', -L.w / 2 + 3.7, L.H + 0.29, 0, O); b.box(0.25, 0.04, 1.6, '#fbfaf6', -L.w / 2 + 4.7, L.H + 0.29, 0, O); b.box(1.0, 0.04, 0.25, '#fbfaf6', -L.w / 2 + 4.2, L.H + 0.29, 0, O);
  void grp;
}

export function createKarsiBina(d: BinaDeps): BinaView {
  const holder = new T.Group(); holder.name = 'karsiBina';
  let built = false, t = 0, flag: T.Mesh | null = null;
  return {
    update(dt) {
      const root = d.root(); if (!root) return;
      if (holder.parent !== root) root.add(holder);
      if (!built) { built = true; for (const s of SPECS) holder.add(build(s)); flag = holder.getObjectByName('bayrak') as T.Mesh | null; }
      const nk = d.night(); t += dt;
      if (glowMat) glowMat.opacity = Math.min(1, nk * 1.1) * 0.95;
      for (const m of signMats) m.emissiveIntensity = 0.25 + nk * 1.3;
      if (flag) { const p = flag.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.9; p.setZ(i, Math.sin(t * 3.2 + x * 2.4) * 0.12 * x); } p.needsUpdate = true; }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
