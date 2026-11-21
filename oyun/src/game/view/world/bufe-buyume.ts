/**
 * Büfe büyümesi 2-10 (2026-11-08 rework). Owner: "ilk büfenin 10 seviyesi olacak şekilde o iskelenin tüm alanını kaplayacak
 * şekilde büyümeli, çeşit artmalı, çalışanlar artmalı" and "her seviyede wow dedirtecek değişiklik". The v52 sea platform
 * west of the pier is gone: the business now grows out of the kiosk over the empty pier wings, cumulative per stage:
 *   2 flower boxes, menu easel, bistro sets at the pier mouth
 *   3 west wing: Çay bahçesi (deck, 4 umbrella tables, çay ocağı with semaver; the çaycı is the zone's hired garson)
 *   4 east wing: Dondurma & gazoz terası (deck, 4 tables, cold cabinet stall; served by a hired garson)
 *   5 west wing full: 8 tables (under the pergola), pergola with vines, string lights over the front
 *   6 west hall: Kahvaltı salonu (glass pavilion, interior tables, warm light)
 *   7 east hall: Balık lokantası + east terrace full (6 tables)
 *   8 roof terraces on both halls (4 sim tables each, umbrellas, railings, the outside stair is the only way up)
 *   9 open grill kitchen on the east terrace, covered arcade behind the kiosk, rooftop sign on the kiosk
 *  10 Fine dining: navy and gold restyle, chandeliers, gold entrance arch, red carpet, valet, topiaries, uplights
 * BUF-19/20: no prop figures. Every table here is a sim table (content/kanat.ts KANAT_MASALAR, drawn where the sim seats people,
 * two chairs on the sim seat axis); guests are real customers, the çaycı / terrace garson / grill şef are hired workers (sim
 * agents/workers.ts posts). Roof terraces are reached by the outside stair (sim route catiYukari). Colliders: buyumeEngel(stage).
 * Keeps clear: the ferry corridor (east, z -9.2..-4.8), the customer walkway behind the kiosk (z ~-12) and along x ~7.
 */
import * as T from 'three';
import { IC_BY_ID, icColliders, icIcinde, mutfakOda, MUTFAK_YER, passAcik, servisKoridor } from '../../../content/ic-mekan';
import { KIOSK_STAGES } from '../../../content/stages';
import { WB, WT, EB, ET, insaatAlani } from '../../../content/insaat';
import { Batch } from '../../../engine/prefab/batch';
import { PIER, BUFE } from '../../../content/prefabs/iskele/layout';
import { KANAT_MASALAR, merdivenKutu, type KanatMasa } from '../../../content/kanat';
import { useSkyEnv } from './glb';
import { radialTex, ensureKit } from '../../../content/prefabs/common/v2kit';

export interface BuyumeDeps { root: () => T.Object3D | null; night: () => number; stage: () => number; /** running tadilat: target stage and 0..1 progress */ tadilat?: () => { to: number; p: number } | null; /** the player's club (sim/mulk takim) */ takim?: () => { ad: string; renk: string; renk2?: string } | null; /** player position: a hall's roof/upper floor hides while inside */ hero?: () => { x: number; z: number } }
export interface BuyumeView { update(dt: number): void; dispose(): void }

const UMB = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#f4f2ec', '#c94f6d'];
const HP = Math.PI / 2;
/** wing footprints on the pier (content/insaat.ts: shared with the tadilat site and the sim ustalar) */
const cx = (r: { x0: number; x1: number }) => (r.x0 + r.x1) / 2, cz = (r: { z0: number; z1: number }) => (r.z0 + r.z1) / 2;
/** open-air wing tables built at this stage (sim tables, content/kanat.ts); salon tables are ic-mekan items, roof tables drawn by hall() */
const acikMasalar = (st: number, b: 'cay' | 'dondurma'): KanatMasa[] => KANAT_MASALAR.filter(m => m.bolge === b && st >= m.asama);
/** BUF-21: aşama adları tek kaynaktan (content/stages.ts short); 0 ve 1 boş (büyüme 2'den başlar) */
export const BUYUME_AD = ['', '', ...KIOSK_STAGES.slice(1).map(s => s.short)];

/**
 * 2026-11-21 service passage between the büfe back wall (z -10.6) and the kitchen front (z -13.0), as wide as the büfe: roofed, side
 * walls, one staff door in the west wall (kz0..kz1). The pass window and the kitchen door open into it.
 */
export const GECIT = { x0: BUFE.x0 - 0.05, x1: BUFE.x1 + 0.05, z0: -13.0, z1: BUFE.z0, kz0: -12.55, kz1: -11.05 };
/** 2026-11-21 büfe interior: bread / dessert cabinet against the east wall (stage 6+), clear of the tost station and the window post */
export const BUFE_VITRIN = { x0: BUFE.x1 - 0.62, x1: BUFE.x1 - 0.14, z0: -9.55, z1: -8.15 };
export const gecitIcinde = (p: { x: number; z: number }) => p.x > GECIT.x0 && p.x < GECIT.x1 && p.z > GECIT.z0 && p.z < GECIT.z1;
/** passage side walls (walk grid): west wall split by the staff door, east wall closed */
export function gecitDuvar(): { x0: number; x1: number; z0: number; z1: number }[] {
  const G = GECIT, t = 0.2;
  return [{ x0: G.x0, x1: G.x0 + t, z0: G.z0, z1: G.kz0 }, { x0: G.x0, x1: G.x0 + t, z0: G.kz1, z1: G.z1 }, { x0: G.x1 - t, x1: G.x1, z0: G.z0, z1: G.z1 }];
}
/** Solid parts of the growth for the walk grid (halls, counters, kitchen, tables). */
export function buyumeEngel(stage: number): { x0: number; x1: number; z0: number; z1: number; tag: string }[] {
  const o: { x0: number; x1: number; z0: number; z1: number; tag: string }[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number, tag = 'buyume') => o.push({ x0, x1, z0, z1, tag });
  // table top only (as the kiosk tables, view/world/index.ts): the seats (±0.78 on the seat axis) and the garson spot stay walkable
  for (const m of [...acikMasalar(stage, 'cay'), ...acikMasalar(stage, 'dondurma')]) add(m.x - 0.45, m.x + 0.45, m.z - 0.45, m.z + 0.45, 'buyume-masa');
  if (stage >= 3) add(WT.x0 + 0.2, WT.x0 + 1.4, -9.0, -6.4, 'buyume-ocak');
  if (stage >= 4) add(ET.x1 - 1.3, ET.x1 - 0.1, ET.z0 + 0.3, ET.z0 + 2.0, 'buyume-dolap');
  // 2026-11-09 "her yere girilebilmeli": the halls are rooms with a door on the promenade side (content/ic-mekan.ts)
  if (stage >= 6) icColliders(IC_BY_ID.salonW, stage).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  if (stage >= 7) icColliders(IC_BY_ID.salonE, stage).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  // roof terrace stairs (stage 8): closed on the ground grid, only the scripted roof route (sim content/kanat.ts) uses them
  if (stage >= 8) for (const sd of ['W', 'E'] as const) { const k = merdivenKutu(sd); add(k.x0, k.x1, k.z0, k.z1, 'buyume-merdiven'); }
  if (stage >= 3) icColliders(IC_BY_ID.mutfak, stage).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-bufemutfak'));   // 2026-11-09 büfe mutfağı (BUF-22: walls follow the stage room)
  // 2026-11-21 restoran: mutfak ile salonlar arasındaki kapalı servis koridorları (yalnız mutfak personeli, senaryolu rota)
  for (const y of ['W', 'E'] as const) if (passAcik(y, stage)) { const r = servisKoridor(y, stage); add(r.x0, r.x1, r.z0, r.z1, 'buyume-servis'); }
  if (stage >= 6) add(BUFE_VITRIN.x0, BUFE_VITRIN.x1, BUFE_VITRIN.z0, BUFE_VITRIN.z1, 'buyume-bufe-ic');   // 2026-11-21 büfe interior cabinet
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

interface Built { g: T.Group }
function build(stage: number, signMats: T.MeshStandardMaterial[], flames: T.Object3D[]): Built {
  const root = new T.Group(); root.name = 'bufe-buyume-' + stage;
  let grp = root, b = new Batch(), gl = new Batch(), lit = new Batch(), wm = new Batch(); const pl = new Batch();
  /** upper floors + roofs of the halls: own meshes, hidden while the player is inside that hall (2026-11-09) */
  const catis: { g: T.Group; b: Batch; gl: Batch; lit: Batch; wm: Batch }[] = [];
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
  /** a sim table: two chairs on the sim seat axis (customers.ts seatPos ±0.78), no figures (the seats are taken by real customers) */
  const table = (x: number, z: number, ax: 'x' | 'z', c: string, umb: boolean, cloth: boolean, y = 0.12) => {
    b.cyl(0.05, 0.08, 0.72, '#3a3d42', x, y + 0.36, z, { seg: 6 }); b.cyl(0.42, 0.42, 0.05, cloth ? '#fbfaf6' : '#d6aa78', x, y + 0.74, z, { seg: 14 });
    if (cloth) b.cyl(0.44, 0.47, 0.18, '#fbfaf6', x, y + 0.66, z, { seg: 14 });
    b.cyl(0.05, 0.05, 0.1, '#fbfaf6', x + 0.12, y + 0.81, z, { seg: 6 }); b.cyl(0.04, 0.035, 0.09, '#c0392b', x - 0.1, y + 0.81, z + 0.08, { seg: 6 });
    for (const a of ax === 'x' ? [0, Math.PI] : [HP, -HP]) {
      const ccx = x + Math.cos(a) * 0.78, ccz = z + Math.sin(a) * 0.78;
      b.box(0.36, 0.05, 0.36, fine ? '#6b1f2a' : '#7d5638', ccx, y + 0.45, ccz); b.box(0.36, 0.42, 0.05, fine ? '#6b1f2a' : '#7d5638', ccx + Math.cos(a) * 0.17, y + 0.66, ccz + Math.sin(a) * 0.17, { ry: -a + HP });
      for (const [dx, dz] of [[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]]) b.box(0.03, 0.45, 0.03, '#3a3d42', ccx + dx, y + 0.22, ccz + dz);
    }
    if (umb) { b.cyl(0.03, 0.03, 2.2, '#f4f2ec', x, y + 1.1, z, { seg: 6 }); b.cone(1.25, 0.5, c, x, y + 2.35, z, { seg: 8 }); b.cyl(1.26, 1.26, 0.12, c, x, y + 2.05, z, { seg: 8 }); }
    if (fine) lit.sph(0.05, '#ffcf6a', x, y + 0.86, z, { ws: 6, hs: 4 });
    glowAt(x, z, 1.8);
  };
  const lights = (pts: [number, number][], h = 2.9) => {
    pts.forEach(([x, z]) => b.cyl(0.05, 0.06, h + 0.1, '#33373b', x, (h + 0.1) / 2 + 0.12, z, { seg: 6 }));
    for (let p = 0; p < pts.length - 1; p++) { const [xa, za] = pts[p], [xb, zb] = pts[p + 1]; for (let i = 1; i < 10; i++) { const t = i / 10, sag = Math.sin(t * Math.PI) * 0.4; lit.sph(0.06, i % 2 ? '#ffd890' : '#fff3d6', xa + (xb - xa) * t, h - sag, za + (zb - za) * t, { ws: 6, hs: 4 }); } }
  };
  const hall = (r: { x0: number; x1: number; z0: number; z1: number }, floors: number, txt: string, roofTerrace: boolean, interiorCol: string, tema: { floor: string; back: string }) => {
    const pw = r.x1 - r.x0, pd = r.z1 - r.z0, ph = 3.4, X = cx(r), Z = cz(r);
    b.box(pw, 0.14, pd, tema.floor, X, 0.07, Z);   // 2026-11-21: each hall its own floor / back wall (kahvaltı warm wood, balık sea blue)
    const cat = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; cat.g.name = 'cati-' + (X < 0 ? 'W' : 'E'); catis.push(cat);
    const main = { grp, b, gl, lit, wm }, toCati = () => { grp = cat.g; b = cat.b; gl = cat.gl; lit = cat.lit; wm = cat.wm; }, toMain = () => { grp = main.grp; b = main.b; gl = main.gl; lit = main.lit; wm = main.wm; };
    for (let f = 0; f < floors; f++) {
      const y0 = f * ph; if (f > 0) toCati();
      gl.box(pw - 0.1, ph - 0.3, 0.04, '#a9d6ec', X, y0 + ph / 2, r.z1); gl.box(0.04, ph - 0.3, pd - 0.1, '#a9d6ec', r.x0, y0 + ph / 2, Z); gl.box(0.04, ph - 0.3, pd - 0.1, '#a9d6ec', r.x1, y0 + ph / 2, Z);
      b.box(pw, ph, 0.22, tema.back, X, y0 + ph / 2, r.z0 + 0.11);   // solid back wall (sea side)
      for (let i = 0; i <= 6; i++) b.box(0.14, ph, 0.14, frame, r.x0 + pw * i / 6, y0 + ph / 2, r.z1);
      for (let i = 1; i < 4; i++) { b.box(0.14, ph, 0.14, frame, r.x0, y0 + ph / 2, r.z0 + pd * i / 4); b.box(0.14, ph, 0.14, frame, r.x1, y0 + ph / 2, r.z0 + pd * i / 4); }
      { const mb = b; b = cat.b; b.box(pw + 0.3, 0.22, pd + 0.3, frame, X, y0 + ph, Z); b = mb; }   // ceiling slab hides with the roof
      if (f > 0) wm.box(pw - 0.4, ph - 0.6, pd - 0.4, interiorCol, X, y0 + ph / 2, Z);   // ground floor: a real room (view/world/ic-mekan-look.ts)
      for (let i = 0; i < 3; i++) { const x = r.x0 + pw * (i + 0.5) / 3; if (fine) { b.cyl(0.02, 0.02, 0.6, '#c9a24a', x, y0 + ph - 0.3, Z, { seg: 4 }); b.tor(0.38, 0.03, '#c9a24a', x, y0 + ph - 0.62, Z, { rx: HP, rs: 4, ts: 16 }); for (let k = 0; k < 8; k++) lit.sph(0.06, '#ffe6b0', x + Math.cos(k * 0.785) * 0.38, y0 + ph - 0.55, Z + Math.sin(k * 0.785) * 0.38, { ws: 6, hs: 4 }); } else { lit.cyl(0.22, 0.3, 0.2, '#fff3d6', x, y0 + ph - 0.3, Z, { seg: 10 }); b.cyl(0.012, 0.012, 0.22, '#3a3d42', x, y0 + ph - 0.1, Z, { seg: 4 }); } }   // pendant cord (2026-11-21)
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
      KANAT_MASALAR.filter(m => m.cati === (X < 0 ? 'W' : 'E')).forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : UMB[(i + 2) % UMB.length], true, fine, ry));   // sim roof tables (BUF-20)
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
    acikMasalar(stage, 'cay').forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : UMB[i % UMB.length], stage < 5 || m.z < -4.4, fine)   /* no umbrellas under the pergola */);
    // çay ocağı: counter, semaver, tulip glasses, awning
    const ox = WT.x0 + 0.8; b.box(1.2, 1.0, 2.6, fine ? '#2a2a30' : '#8a5a3a', ox, 0.62, -7.7); b.box(1.3, 0.06, 2.7, '#e9e0c8', ox, 1.15, -7.7);
    b.cyl(0.24, 0.3, 0.7, '#c9a23a', ox, 1.53, -8.4, { seg: 14 }); b.cyl(0.1, 0.16, 0.25, '#c9a23a', ox, 2.0, -8.4, { seg: 10 });
    for (let i = 0; i < 6; i++) b.cyl(0.04, 0.03, 0.1, '#b0281e', ox + 0.25, 1.24, -7.2 + i * 0.16, { seg: 6 });
    for (let i = 0; i < 6; i++) b.box(1.5, 0.05, 0.46, i % 2 ? '#fbfaf6' : '#c0392b', ox + 0.1, 2.5, -9.0 + i * 0.46, { rz: -0.25 });
    b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -9.2); b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -6.2);
    sign('SABRİ ÇAY BAHÇESİ', ox + 0.8, 3.05, -7.7, 3.2, HP);
    planter(WT.x0 + 0.4, r.z1 - 1.6, 0.5, 2.4); planter(cx(WT), WT.z0 + 0.3, 6.0, 0.5);
  }
  /* 4: east Dondurma & gazoz terası */
  if (stage >= 4) {
    const r = stage >= 7 ? ET : { ...ET, x1: 17.2 };
    deck(r);
    acikMasalar(stage, 'dondurma').forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : UMB[(i + 3) % UMB.length], true, fine));
    const dx = ET.x1 - 0.7; b.box(1.2, 1.5, 1.7, fine ? '#1f2a44' : '#3fb5b0', dx, 0.87, ET.z0 + 1.15); gl.box(0.04, 1.0, 1.4, '#cfeaf5', dx - 0.62, 1.0, ET.z0 + 1.15);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(0.12, 0.2, 0.12, ['#e0533c', '#ffd23f', '#7ed957', '#f2a2b3'][(i + j) % 4], dx - 0.5, 0.6 + j * 0.3, ET.z0 + 0.6 + i * 0.32);
    sign('DONDURMA · GAZOZ', dx - 0.2, 1.95, ET.z0 + 1.15, 1.9, -HP);
    planter(cx(r), ET.z1 + 0.3, Math.min(6.5, r.x1 - r.x0 - 1), 0.5);
  }
  /* 5: pergola with vines over the west deck, string lights over the pier mouth */
  if (stage >= 5) {
    const px0 = WT.x0 + 1.8, px1 = WT.x1 - 0.4, pz0 = -4.4, pz1 = WT.z1 - 0.4;
    for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1], [(px0 + px1) / 2, pz0], [(px0 + px1) / 2, pz1]]) b.box(0.16, 2.9, 0.16, frame, x, 1.57, z);
    for (let i = 0; i < 10; i++) b.box(px1 - px0 + 0.3, 0.08, 0.1, '#8a6a4a', (px0 + px1) / 2, 3.0, pz0 + i * (pz1 - pz0) / 9);
    for (let i = 0; i < 40; i++) { const x = px0 + ((i * 37) % 97) / 97 * (px1 - px0), z = pz0 + ((i * 53) % 89) / 89 * (pz1 - pz0); b.box(0.9 + (i % 3) * 0.25, 0.07, 0.6 + (i % 2) * 0.3, ['#4f8f3a', '#5f9f45', '#3f7a34'][i % 3], x, 3.07 + (i % 4) * 0.015, z, { ry: i * 0.7 }); if (i % 5 === 0) b.sph(0.07, i % 10 ? '#c94f6d' : '#f2a2b3', x + 0.2, 3.12, z, { ws: 5, hs: 3 }); }
    lights([[-10.3, 3.7], [-5.0, 3.9], [0.0, 4.0], [4.6, 3.9], [7.9, 3.7]], 3.4);
  }
  /* 3+: büfe mutfağı shell behind the roofed service passage (interior: view/world/ic-mekan-look.ts, door on the walkway side).
     BUF-22: the shell grows with the stage room (content/ic-mekan.ts mutfakOda: esnaf 9.2 m, lokanta 13.8 m, iki hatlı 18 m). The
     front is a shop window (low wall + glass) with the pass window behind the büfe counter: garsons take plates there from the
     service passage (GECIT). Walls live in 'duvar-K' (hidden while the player is inside), the roof in 'cati-K' (2026-11-21: off
     only while the player is inside the kitchen; from the büfe the passage roof lifts and the kitchen shows through the glass front). */
  if (stage >= 3) {
    const steel = stage >= 7, esnaf = !steel;
    // 2026-11-21 (sahibi: "büfe ile mutfağın mimarisi bir mi?"): mutfak büfenin değil RESTORANIN binası: salonlarla aynı dil (beyaz sıva,
    // salon mavisi bant, beyaz çerçeve; aşama 10 lacivert-altın), büfenin kırmızı/sarı çizgisi yok. İç donanım esnaf -> çelik (ic-mekan-look).
    const wallC = fine ? '#1f2a44' : '#ece6da', bandC = accent, stripeC = fine ? '#e8c76a' : frame, roofC = fine ? '#3c4d70' : '#5f6e7a';
    const mull = fine ? '#c9a24a' : '#e9eef2'; void steel;
    const cat = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; cat.g.name = 'cati-K'; catis.push(cat);
    const duv = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; duv.g.name = 'duvar-K'; catis.push(duv);
    const k = mutfakOda(stage), X0 = k.x - k.wx / 2, X1 = k.x + k.wx / 2, Z0 = k.z - k.wz / 2, Z1 = k.z + k.wz / 2, Hh = 3.0, kb = duv.b, rb = cat.b;
    const PU = MUTFAK_YER.pass.u, PW = 2.0, DG = 0.85;   // pass window (behind the büfe counter) and door gap
    kb.box(k.wx, Hh, 0.25, wallC, k.x, Hh / 2, Z0 + 0.125); kb.box(0.25, Hh, k.wz, wallC, X0 + 0.125, Hh / 2, k.z); kb.box(0.25, Hh, k.wz, wallC, X1 - 0.125, Hh / 2, k.z);
    // front: low wall 0..1.0 (not across the door), glass 1.0..2.5 with mullions, header 2.5..3.0; the pass window is open glass-free
    const zf = Z1 - 0.125, seg = (xa: number, xb: number, y0: number, y1: number, c = wallC) => { if (xb - xa > 0.01) kb.box(xb - xa, y1 - y0, 0.25, c, (xa + xb) / 2, (y0 + y1) / 2, zf); };
    seg(X0, -DG, 0, 1.0); seg(DG, X1, 0, 1.0); seg(X0, -DG, 2.5, Hh); seg(DG, X1, 2.5, Hh); kb.box(2 * DG, Hh - 2.4, 0.25, wallC, 0, 2.4 + (Hh - 2.4) / 2, zf);
    for (const [xa, xb] of [[X0 + 0.25, PU - PW / 2], [PU + PW / 2, -DG], [DG, X1 - 0.25]] as [number, number][]) {
      if (xb - xa < 0.2) continue;
      duv.gl.box(xb - xa, 1.5, 0.04, '#cfe8f4', (xa + xb) / 2, 1.75, Z1 - 0.05);
      const n = Math.max(1, Math.round((xb - xa) / 1.3)); for (let i = 0; i <= n; i++) kb.box(0.08, 1.5, 0.12, mull, xa + (xb - xa) * i / n, 1.75, Z1 - 0.02);
    }
    kb.box(PU - PW / 2 - X0, 0.06, 0.06, bandC, (X0 + PU - PW / 2) / 2, 1.0, Z1 + 0.02); kb.box(-DG - PU - PW / 2, 0.06, 0.06, bandC, (PU + PW / 2 - DG) / 2, 1.0, Z1 + 0.02); kb.box(X1 - DG, 0.06, 0.06, bandC, (X1 + DG) / 2, 1.0, Z1 + 0.02);
    // pass window: open hatch, serving ledge outside with plates and a bell, heat lamp glow, awning (esnaf stripes / steel canopy)
    kb.box(PW + 0.3, 0.08, 0.55, fine ? '#c9a24a' : steel ? '#e9eef2' : '#a8794e', PU, 1.02, Z1 + 0.22); kb.box(PW + 0.2, 0.1, 0.1, mull, PU, 2.5, Z1 + 0.02);
    for (const s2 of [-1, 1]) kb.box(0.1, 1.5, 0.14, mull, PU + s2 * PW / 2, 1.75, Z1 - 0.02);
    duv.lit.box(PW - 0.2, 0.05, 0.25, '#ffcf8a', PU, 2.4, Z1 - 0.2);
    for (let i = 0; i < 3; i++) kb.cyl(0.17, 0.17, 0.03, '#ffffff', PU - 0.7 + i * 0.45, 1.08, Z1 + 0.25, { seg: 12 });
    kb.cyl(0.06, 0.07, 0.05, '#c9a24a', PU + 0.95, 1.09, Z1 + 0.25, { seg: 8 });
    kb.box(PW + 0.5, 0.06, 0.7, accent, PU, 2.72, Z1 + 0.32, { rx: 0.3 }); void esnaf;
    sign(passAcik('W', stage) ? 'TERAS SERVİSİ' : 'SERVİS', PU, 2.8, Z1 + 0.2, 1.5);   // sokak pass'ı: büfe önü masaları + salonu olmayan teras
    kb.box(1.9, 0.07, 0.5, accent, k.x, 2.75, Z1 + 0.3, { rx: 0.25 });   // door canopy
    // roof (+ chimneys / extractor units / skylights), hidden with the cutaway
    rb.box(k.wx + 0.3, 0.22, k.wz + 0.3, roofC, k.x, Hh + 0.11, k.z);
    { const seamC = fine ? '#5a6f98' : steel ? '#98a0a8' : '#a0694a', ns = Math.round(k.wx / 0.9); for (let i = 1; i < ns; i++) rb.box(0.05, 0.05, k.wz + 0.3, seamC, X0 + i * k.wx / ns, Hh + 0.24, k.z); }   // 2026-11-21 görsel: üstten bakınca düz kara levha → bindirme derzli çatı rb.box(k.wx + 0.4, 0.3, 0.12, bandC, k.x, Hh + 0.3, Z1 + 0.16);
    for (const f of stage >= 4 ? [-0.6, -0.2, 0.3] : [-0.6]) { const cxm = f * (k.wx / 2); rb.cyl(0.32, 0.36, 1.1, steel ? '#9aa2ab' : '#6b5a4a', cxm, Hh + 0.85, k.z - 0.6, { seg: 8 }); rb.cyl(0.4, 0.4, 0.1, '#33373b', cxm, Hh + 1.45, k.z - 0.6, { seg: 8 }); }
    if (stage >= 9) for (const f of [-0.85, 0.75]) { rb.box(1.6, 0.8, 1.2, fine ? '#2a3550' : '#c9ced6', f * (k.wx / 2), Hh + 0.62, k.z - 0.4); rb.box(1.2, 0.08, 0.9, '#5b6068', f * (k.wx / 2), Hh + 1.06, k.z - 0.4); }
    if (stage >= 10) for (let i = 0; i < 4; i++) cat.lit.box(1.2, 0.06, 0.8, '#fff3d6', -4.5 + i * 3, Hh + 0.25, k.z + 0.3);
    { const mb = b; const mg = grp; b = kb; grp = duv.g; sign('MUTFAK · PERSONEL', k.x, Hh + 0.5, Z1 + 0.24, 2.6); b = mb; grp = mg; }   // ara yola bakan servis cephesi: personel kapısı + teras pass'ı
    glowAt(k.x, Z1 + 0.9, 2.4); glowAt(PU, Z1 + 0.9, 1.8);
    /* 2026-11-21 (2. tur, sahibi: "yapışık da duramaz, büfe ayrı restoran ve mutfağı ayrı çalışsın"): the kitchen is the restaurant's
       back of house. Same language as the salons (white plaster, salon-blue bands), high windows and extractor grilles on the sea
       side; the büfe stands on its own in front across an OPEN service alley (the roofed passage that glued them together is gone),
       the salons join the kitchen through closed service corridors (servisKoridor) with a pass window into each salon. */
    const ob = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => kb.box(w, h, d, c, x, y, z);
    for (const [y, h, c] of [[0.18, 0.36, bandC], [1.02, 0.08, stripeC], [2.62, 0.08, stripeC], [2.86, 0.28, bandC]] as [number, number, string][]) {
      ob(k.wx + 0.06, h, 0.04, c, k.x, y, Z0 - 0.02);   // back (sea side)
      ob(0.04, h, k.wz + 0.06, c, X0 - 0.02, y, k.z); ob(0.04, h, k.wz + 0.06, c, X1 + 0.02, y, k.z);   // sides
    }
    const nw = Math.max(2, Math.round(k.wx / 3.2));
    for (let i = 0; i < nw; i++) {   // high kitchen windows (sea side) with a navy frame, every other bay an extractor grille
      const wx = X0 + k.wx * (i + 0.5) / nw;
      if (i % 2 === 1 && nw > 2) { ob(0.9, 0.6, 0.06, '#5b6068', wx, 1.95, Z0 - 0.05); for (let j = 0; j < 5; j++) ob(0.82, 0.04, 0.08, '#33373b', wx, 1.72 + j * 0.115, Z0 - 0.07); continue; }
      duv.gl.box(1.4, 0.7, 0.03, '#cfe8f4', wx, 1.95, Z0 - 0.04); ob(1.56, 0.08, 0.08, bandC, wx, 2.34, Z0 - 0.06); ob(1.56, 0.08, 0.1, bandC, wx, 1.56, Z0 - 0.07); ob(0.07, 0.78, 0.07, bandC, wx, 1.95, Z0 - 0.06);
      for (const s2 of [-1, 1]) ob(0.07, 0.78, 0.07, bandC, wx + s2 * 0.74, 1.95, Z0 - 0.06);
    }
    for (const sx of [X0, X1]) { duv.gl.box(0.03, 0.7, 1.4, '#cfe8f4', sx + (sx < 0 ? -0.04 : 0.04), 1.95, k.z); ob(0.08, 0.08, 1.56, bandC, sx + (sx < 0 ? -0.06 : 0.06), 2.34, k.z); ob(0.1, 0.08, 1.56, bandC, sx + (sx < 0 ? -0.07 : 0.07), 1.56, k.z); }
    { const mb = b, mg = grp; b = kb; grp = duv.g; sign(fine ? 'SABRİ\'NİN SOFRASI' : stage >= 6 ? 'SABRİ RESTORAN' : 'SABRİ MUTFAĞI', k.x, Hh + 0.62, Z0 - 0.24, 3.6, Math.PI); b = mb; grp = mg; }
    // 2026-11-21 servis koridorları: mutfağın yan duvarından salonun duvarına kapalı, çatılı blok (salonla aynı dil); içinden aşçı/komi
    // tabağı salonun pass penceresine taşır (ic-mekan.ts servisKoridor / passAsciUV). Batı aşama 6, doğu aşama 7; çatı merdiveni üstünden geçer.
    for (const y of ['W', 'E'] as const) {
      if (!passAcik(y, stage)) continue;
      const r = servisKoridor(y, stage), w = r.x1 - r.x0, d = r.z1 - r.z0, x = (r.x0 + r.x1) / 2, z = (r.z0 + r.z1) / 2;
      b.box(w + 0.1, Hh, d, wallC, x, Hh / 2, z);
      b.box(w + 0.3, 0.2, d + 0.3, roofC, x, Hh + 0.1, z);
      for (const zz of [r.z0 - 0.02, r.z1 + 0.02]) { b.box(w + 0.12, 0.3, 0.04, bandC, x, 0.15, zz); b.box(w + 0.12, 0.26, 0.04, bandC, x, Hh - 0.13, zz); b.box(w + 0.12, 0.06, 0.05, stripeC, x, Hh - 0.3, zz); }
      const nwin = Math.max(1, Math.floor(w / 1.8));   // high service windows on the promenade side, warm light inside
      for (let i = 0; i < nwin; i++) { const wx2 = r.x0 + w * (i + 0.5) / nwin; gl.box(0.8, 0.45, 0.03, '#cfe8f4', wx2, 2.2, r.z1 + 0.03); b.box(0.9, 0.06, 0.06, bandC, wx2, 1.95, r.z1 + 0.05); lit.box(0.7, 0.03, 0.02, '#ffd9a0', wx2, 2.4, r.z1 + 0.02); }
      sign(fine ? 'SERVİS' : 'MUTFAK → SALON', x, Hh - 0.75, r.z1 + 0.06, Math.min(1.8, w - 0.3));
    }
  }
  /* 6+: büfe interior (2026-11-21 "büfenin içi koca boş zemin"): the kitchen moved behind, so the büfe gets a bread / dessert
     cabinet on the east wall (BUFE_VITRIN, solid), a glass and jar shelf with the old photo on the west wall (wall-mounted) and a
     floor inlay; the middle stays free for the staff walking between the stations and the counter. */
  if (stage >= 6) {
    const V = BUFE_VITRIN, vx = (V.x0 + V.x1) / 2, vz = (V.z0 + V.z1) / 2, vw = V.x1 - V.x0, vd = V.z1 - V.z0;
    b.box(vw, 0.8, vd, fine ? '#1f2a44' : '#8a5a3a', vx, 0.4, vz); b.box(vw + 0.04, 0.05, vd + 0.04, fine ? '#c9a24a' : '#e9e0c8', vx, 0.82, vz);
    gl.box(vw - 0.06, 0.55, vd - 0.06, '#d8eef6', vx, 1.12, vz); lit.box(vw - 0.1, 0.02, vd - 0.1, '#fff8e8', vx, 1.38, vz);
    const P = ['#e0a95a', '#c9853a', '#f2d29a', '#6b3a20', '#f2a2b3', '#fbfaf6'];
    for (let i = 0; i < 8; i++) b.cyl(0.1, 0.1, 0.08, P[i % 6], vx + (i % 2 ? 0.1 : -0.1), 0.9 + Math.floor(i / 4) * 0.22, V.z0 + 0.25 + (i % 4) * (vd - 0.5) / 3, { seg: 10 });
    sign(fine ? 'TATLI · FIRIN' : 'TAZE SİMİT · TATLI', V.x1 - 0.06, 1.75, vz, 1.3, -HP);
    const wx = BUFE.x0 + 0.12;   // west wall shelf above the free strip behind the ayran station
    for (const y of [1.55, 2.0]) { b.box(0.26, 0.04, 1.0, fine ? '#c9a24a' : '#a8794e', wx + 0.1, y, -9.05); for (let i = 0; i < 6; i++) b.cyl(0.035, 0.03, 0.1, y < 1.8 ? '#b0281e' : '#e9c88a', wx + 0.12, y + 0.07, -9.45 + i * 0.16, { seg: 6 }); }
    b.box(0.04, 0.5, 0.65, fine ? '#c9a24a' : '#5a3b2a', wx, 2.55, -9.05); b.box(0.02, 0.4, 0.55, '#c9b48a', wx + 0.03, 2.55, -9.05);   // framed 1987 photo
    b.cyl(0.62, 0.62, 0.006, fine ? '#c9a24a' : '#c8693e', 0.15, 0.003, -8.55, { seg: 24 }); b.cyl(0.52, 0.52, 0.008, fine ? '#1f2a44' : '#efe3c8', 0.15, 0.005, -8.55, { seg: 24 });   // floor inlay
    b.box(0.5, 0.009, 0.08, fine ? '#c9a24a' : '#c8693e', 0.15, 0.007, -8.55); b.box(0.08, 0.009, 0.5, fine ? '#c9a24a' : '#c8693e', 0.15, 0.007, -8.55);
  }
  /* 6: west hall: Kahvaltı salonu */
  if (stage >= 6) { hall(WB, 1, fine ? 'SABRİ\'NİN SOFRASI · KAHVALTI' : stage >= 8 ? 'SABRİ KAHVALTI & MEZE' : 'SABRİ KAHVALTI SALONU', stage >= 8, '#ffcf8a', { floor: fine ? '#c9a77c' : '#e9e0c8', back: fine ? '#f3e6c8' : '#efe6d2' }); }
  /* 7: east hall: Balık lokantası */
  if (stage >= 7) { hall(EB, stage >= 8 ? 2 : 1, fine ? 'SABRİ\'NİN SOFRASI · BALIK' : stage >= 8 ? 'SABRİ BOĞAZ LOKANTASI' : 'SABRİ BALIK LOKANTASI', stage >= 8, '#ffd9a0', { floor: fine ? '#dfe8ec' : '#e3ebee', back: fine ? '#1d4f86' : '#d8e6ee' }); }
  /* 9: rooftop sign on the büfe (the büfe keeps its own name: it is NOT the restaurant), restaurant crest on the kitchen roof.
     2026-11-21: the old stage-9 "Şef Mutfağı · Izgara" counter on the east terrace is gone (an orphan grill cut off from the real
     kitchen, owner: "iskelenin sağında şef mutfağı ızgara diye bir yer var neden?"); stage 9 is the two-line kitchen (ocak2 / izgara2). */
  if (stage >= 9) {
    // rooftop sign over the kiosk
    { const tb = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; tb.g.name = 'tabela-B'; catis.push(tb);   // 2026-11-21: hides with the büfe cutaway (it floated over the open büfe and hid its inside)
      const mb = b, mg = grp; b = tb.b; grp = tb.g;
      sign('SABRİ\'NİN BÜFESİ · 1987', 0, 3.75, BUFE.z0 + 0.35, 7.0, 0, '#e0533c', '#fff6e6');   // büfe hep büfe: kırmızı tabela, Sofrası değil   // 2026-11-21 görsel: direkler kalktı, tabela arka duvarın üstüne monte
      for (const x of [-3.0, 3.0]) b.box(0.12, 0.7, 0.12, '#9aa2ab', x, 3.3, BUFE.z0 + 0.3);   // kısa çelik konsollar
      b = mb; grp = mg; }
  }
  /* 6+: restaurant crest on the kitchen roof, facing the promenade over the büfe: the back row (salon + kitchen + salon) is one
     restaurant, "Sabri Restoran", at stage 10 "Sabri'nin Sofrası". Hidden from inside the büfe / kitchen (cutaway). */
  if (stage >= 6) {
    const tr = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; tr.g.name = 'tabela-R'; catis.push(tr);
    const mb = b, mg = grp; b = tr.b; grp = tr.g; const zf = mutfakOda(stage).z + mutfakOda(stage).wz / 2 - 0.5;
    sign(fine ? 'SABRİ\'NİN SOFRASI' : 'SABRİ RESTORAN', 0, 4.55, zf, 6.4, 0);
    for (const x of [-2.6, 2.6]) b.box(0.12, 1.2, 0.12, fine ? '#c9a24a' : '#9aa2ab', x, 3.75, zf - 0.08);
    b = mb; grp = mg;
  }
  /* 10: fine dining arrival: at the RESTAURANT doors (salon fronts), not along the büfe queue (2026-11-21) */
  if (fine) {
    for (const r of [WB, EB]) {
      const X = cx(r); b.box(1.6, 0.025, 1.15, '#9a1f2a', X, 0.02, r.z1 + 0.6); b.box(1.68, 0.02, 1.2, '#c9a24a', X, 0.012, r.z1 + 0.6);   // red carpet at the door
      for (const s2 of [-1, 1]) { const x = X + s2 * 1.05; b.cyl(0.03, 0.03, 0.9, '#c9a24a', x, 0.45, r.z1 + 0.9, { seg: 6 }); b.sph(0.06, '#c9a24a', x, 0.92, r.z1 + 0.9, { ws: 6, hs: 4 }); }
    }
    b.box(0.6, 1.1, 0.4, '#1f2a44', 4.2, 0.55, 5.6); b.box(0.66, 0.06, 0.46, '#c9a24a', 4.2, 1.12, 5.6);   // valet podium on the promenade
    for (const [x, z] of [[cx(WB) - 1.7, WB.z1 + 0.5], [cx(WB) + 1.7, WB.z1 + 0.5], [cx(EB) - 1.7, EB.z1 + 0.5], [cx(EB) + 1.7, EB.z1 + 0.5], [WT.x0 + 0.6, WT.z1 + 0.2], [ET.x1 - 0.4, ET.z1 + 0.3]]) { b.cyl(0.32, 0.26, 0.6, '#f4f2ec', x, 0.3, z, { seg: 10 }); b.sph(0.42, '#3f7a34', x, 0.95, z, { ws: 8, hs: 6 }); b.sph(0.3, '#4f8f3a', x, 1.5, z, { ws: 8, hs: 6 }); }
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
  return { g: root };
}

/** Construction site while a tadilat (to 2..10) runs, on the part that stage builds (content/insaat.ts SITE_AREA): scaffold towers
 *  with planks and safety netting, a tower crane with a swinging load (from stage 3), barriers, the site board with a live progress
 *  bar. BUF-21: the hard-hat workers are real walking actors (sim/agents/ustalar.ts), no statues here. Deck planks appear with the
 *  progress (stages 3-5). */
function buildSite(to: number): { g: T.Group; hook: T.Object3D | null; planks: T.Object3D[]; bar: { set(p: number): void } } {
  const R = insaatAlani(to), X0 = R.x0, X1 = R.x1, Z0 = R.z0, Z1 = R.z1, XC = cx(R), small = to <= 2;
  const g = new T.Group(); g.name = 'insaat'; const b = new Batch(); const planks: T.Object3D[] = [];
  const towers: [number, number][] = small ? [[X0 + 0.9, Z0 + 0.5], [X1 - 0.9, Z0 + 0.5]] : [[X0 + 0.9, Z0 + 0.9], [X1 - 0.9, Z0 + 0.9], [X0 + 0.9, Z1 - 0.9], [X1 - 0.9, Z1 - 0.9]];
  const th = small ? 2.6 : 4.2;
  for (const [x, z] of towers) {   // scaffold towers: tubes, plank decks, toe boards, diagonal braces, green netting
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box(0.06, th, 0.06, '#c9ced6', x + dx, th / 2, z + dz);
    for (let y = 0.8; y < th + 0.1; y += 1.1) { b.box(1.3, 0.05, 1.3, '#a8794e', x, y, z); b.box(1.25, 0.04, 0.04, '#e0533c', x, y + 0.5, z - 0.6); b.box(1.25, 0.04, 0.04, '#e0533c', x, y + 0.5, z + 0.6); }
    for (const s2 of [-1, 1]) b.box(0.04, 1.6, 0.04, '#9aa2ab', x + s2 * 0.6, th * 0.45, z + 0.62, { rz: 0.7 * s2 });
    b.box(1.22, th * 0.7, 0.02, '#4f8f5a', x, th * 0.55, z + 0.64);
  }
  // tower crane at the sea-side corner of the site (not for the small stage-2 job)
  let hook: T.Object3D | null = null;
  if (!small) {
    const ccx = X0 < 0 ? X0 + 0.6 : X1 - 0.6, ccz = Math.max(PIER.z0 + 0.8, Z0 - 0.2), dir = X0 < 0 ? 1 : -1;
    b.box(0.8, 0.4, 0.8, '#5b6068', ccx, 0.2, ccz); for (let y = 0; y < 11; y += 1) { for (const [ox, oz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) b.box(0.06, 1, 0.06, '#ffd23f', ccx + ox, y + 0.9, ccz + oz); b.box(0.66, 0.05, 0.05, '#ffd23f', ccx, y + 0.5, ccz - 0.3, { rz: 0.8 }); }
    b.box(13, 0.35, 0.5, '#ffd23f', ccx + dir * 5.5, 11.6, ccz); b.box(1.4, 1.0, 1.0, '#e0533c', ccx, 12.2, ccz); b.box(1.5, 0.9, 0.9, '#5b6068', ccx - dir * 2.2, 11.3, ccz);
    hook = new T.Group(); hook.position.set(ccx + dir * 8, 11.4, ccz); const cable = new T.Mesh(new T.BoxGeometry(0.03, 6, 0.03), new T.MeshLambertMaterial({ color: '#222' })); cable.position.y = -3; hook.add(cable);
    const load = new T.Mesh(new T.BoxGeometry(1.6, 0.3, 0.8), new T.MeshLambertMaterial({ color: '#a8794e' })); load.position.y = -6.2; hook.add(load); g.add(hook);
  }
  // barriers along the open (promenade) side, material pile, cement mixer, site board
  for (let x = X0 + 0.8; x < X1 - 0.6; x += 1.6) { b.box(1.3, 0.8, 0.2, '#f4f2ec', x, 0.4, Z1 + 0.35); b.box(1.32, 0.18, 0.22, '#e0533c', x, 0.55, Z1 + 0.35); }
  for (let i = 0; i < 5; i++) b.box(2.0, 0.08, 0.3, i % 2 ? '#c8955a' : '#b07d48', X1 - 1.6, 0.06 + i * 0.09, Z0 + 1.8 + (i % 2) * 0.05);
  b.cyl(0.38, 0.3, 0.7, '#e0533c', X0 + 2.2, 0.75, Z1 - 0.8, { seg: 10, rz: 0.5 }); b.box(0.9, 0.35, 0.6, '#5b6068', X0 + 2.2, 0.2, Z1 - 0.8);
  const bx = XC, bz = Z1 + 0.55, by = small ? 1.2 : 1.45;
  b.box(2.5, 1.5, 0.08, '#ffd23f', bx, by, bz); b.box(0.08, by, 0.08, '#3a3d42', bx - 0.95, by / 2, bz); b.box(0.08, by, 0.08, '#3a3d42', bx + 0.95, by / 2, bz);
  const m = b.mesh(mats().solid, true, true); g.add(m);
  // site board face: "İNŞAAT · <next stage>" + a live progress bar (canvas, redrawn on whole percents)
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const c2 = cv.getContext('2d')!, tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const ad = KIOSK_STAGES[to - 1]?.short || '';
  let last = -1;
  const bar = { set(p: number) {
    const pc = Math.max(0, Math.min(100, Math.floor(p * 100))); if (pc === last) return; last = pc;
    c2.fillStyle = '#ffd23f'; c2.fillRect(0, 0, 512, 300); for (let i = -6; i < 20; i++) { c2.fillStyle = '#1d1d1d'; c2.beginPath(); c2.moveTo(i * 40, 0); c2.lineTo(i * 40 + 20, 0); c2.lineTo(i * 40 - 20, 36); c2.lineTo(i * 40 - 40, 36); c2.fill(); }
    c2.fillStyle = '#1d1d1d'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.font = '900 46px system-ui,sans-serif'; c2.fillText('İNŞAAT', 256, 78);
    c2.font = '800 34px system-ui,sans-serif'; c2.fillText('Aşama ' + to + ' · ' + ad, 256, 128, 480);
    c2.fillStyle = '#3a3d42'; c2.fillRect(40, 168, 432, 52); c2.fillStyle = '#2f9e5a'; c2.fillRect(46, 174, 420 * pc / 100, 40);
    c2.fillStyle = '#fbfaf6'; c2.font = '900 30px system-ui,sans-serif'; c2.fillText('%' + pc, 256, 195);
    c2.fillStyle = '#1d1d1d'; c2.font = '700 26px system-ui,sans-serif'; c2.fillText('Kolay gelsin ustalar!', 256, 258);
    tex.needsUpdate = true;
  } };
  bar.set(0);
  const face = new T.Mesh(new T.PlaneGeometry(2.4, 1.4), new T.MeshBasicMaterial({ map: tex })); face.position.set(bx, by, bz + 0.05); face.name = 'pano'; g.add(face);
  if (to >= 3 && to <= 5) for (let i = 0; i < 12; i++) { const W = X1 - X0, D = Z1 - Z0; const pk = new T.Mesh(new T.BoxGeometry(W, 0.12, D / 12), new T.MeshLambertMaterial({ color: i % 2 ? '#a8794e' : '#9c6f46' })); pk.position.set(XC, 0.06, Z0 + (i + 0.5) * D / 12); pk.visible = false; g.add(pk); planks.push(pk); }
  return { g, hook, planks, bar };
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
      const td = deps.tadilat?.() ?? null, wantSite = td && td.to >= 2 ? td.to : 0;
      if (wantSite !== siteTo || (site && site.g.parent !== root)) { if (site) { site.g.removeFromParent(); site.g.traverse(o => { const mm = o as T.Mesh; mm.geometry?.dispose(); if (mm.name === 'pano') { const mt = mm.material as T.MeshBasicMaterial; mt.map?.dispose(); mt.dispose(); } }); site = null; } siteTo = wantSite; if (wantSite) { site = buildSite(wantSite); root.add(site.g); } }
      if (site && td) {
        if (site.hook) { site.hook.rotation.y = Math.sin(t * 0.3) * 0.5; site.hook.children[1].position.y = -6.2 + Math.sin(t * 0.7) * 1.5; }
        site.planks.forEach((pk, i) => { pk.visible = i < Math.floor(td.p * site!.planks.length); });
        site.bar.set(td.p);
      }
      const tk = deps.takim?.() ?? null, sk = tk && st >= 3 ? tk.ad + tk.renk + (tk.renk2 || '') + (st >= 10 ? 'a' : st >= 6 ? 'b' : 'c') : '';
      if (sk !== sponKey || (spon && spon.parent !== root)) { if (spon) { spon.removeFromParent(); spon = null; } sponKey = sk; if (sk && tk) { spon = buildSponsor(tk, st); root.add(spon); } }
      if (spon) { const f = spon.getObjectByName('kflag') as T.Mesh | null; if (f) { const p = f.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.8; p.setZ(i, Math.sin(t * 3 + x * 2.6) * 0.1 * x); } p.needsUpdate = true; } }
      const mk = mevsim() ?? '';
      if (mk !== mevKey || (mev && mev.parent !== root)) { if (mev) { mev.removeFromParent(); mev = null; } mevKey = mk; if (mk) { mev = buildMevsim(mk as 'bayrak'); root.add(mev); } }
      if (!grp) return;
      const hp = deps.hero?.();
      if (hp) {
        for (const [nm, m] of [['cati-W', IC_BY_ID.salonW], ['cati-E', IC_BY_ID.salonE], ['duvar-K', mutfakOda(st)]] as const) { const o = grp.getObjectByName(nm); if (o) o.visible = !icIcinde(m, hp, 0.2); }
        const ck = grp.getObjectByName('cati-K'), inK = icIcinde(mutfakOda(st), hp, 0.2); if (ck) ck.visible = !inK;   // 2026-11-21: the kitchen roof lifts only while the player is inside the kitchen
        const inB = hp.x > BUFE.x0 - 0.2 && hp.x < BUFE.x1 + 0.2 && hp.z > BUFE.z0 - 0.2 && hp.z < BUFE.z1, tbB = grp.getObjectByName('tabela-B'); if (tbB) tbB.visible = !inB && !gecitIcinde(hp);
        const tbR = grp.getObjectByName('tabela-R'); if (tbR) tbR.visible = !inB && !inK && !gecitIcinde(hp);
      }
      const n = deps.night();
      const M = mats(); M.glow.color.setScalar(0.55 + 0.45 * n); M.pool.opacity = 0.75 * n; M.warm.opacity = 0.35 * n;
      for (const s of signMats) s.emissiveIntensity = 0.25 + n * 0.5;
      for (const f of flames) { const k = 0.8 + 0.3 * Math.sin(t * 13 + f.userData.ph) + 0.15 * Math.sin(t * 29 + f.userData.ph * 2); f.scale.set(1, k, 1); }
    },
    dispose() { clear(); },
  };
}
