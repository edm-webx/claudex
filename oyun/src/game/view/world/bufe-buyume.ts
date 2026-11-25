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
import { IC_BY_ID, icColliders, icIcinde, mutfakOda, MUTFAK_YER } from '../../../content/ic-mekan';
import { kanatDik, kanatKapi, kanatAcikMi, revakDirek, onDolgu, mutfakUc, restoranDuvar, restoranAlani, saksiYer, RES_H, TERAS_Y, TERAS_Z, VAPUR_GECIT, KANAT_W } from '../../../content/restoran-plan';
import { KIOSK_STAGES } from '../../../content/stages';
import { WB, WT, EB, ET, insaatAlani } from '../../../content/insaat';
import { Batch } from '../../../engine/prefab/batch';
import { PIER, BUFE_YEREL as BUFE } from '../../../content/prefabs/iskele/layout';   // every büfe part here is stage 6+: the büfe is then the restaurant's front hall at the v2 spot (layout.ts bufeDz)
import { KANAT_MASALAR, KANAT_BASE, kanatKurulu, merdivenKutu, type KanatMasa } from '../../../content/kanat';
import { useSkyEnv } from './glb';
import { radialTex, ensureKit } from '../../../content/prefabs/common/v2kit';

export interface BuyumeDeps { root: () => T.Object3D | null; night: () => number; stage: () => number; /** running tadilat: target stage and 0..1 progress */ tadilat?: () => { to: number; p: number } | null; /** the player's club (sim/mulk takim) */ takim?: () => { ad: string; renk: string; renk2?: string } | null; /** player position: a hall's roof/upper floor hides while inside */ hero?: () => { x: number; z: number } }
export interface BuyumeView { update(dt: number): void; dispose(): void }

const UMB = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#f4f2ec', '#c94f6d'];
const HP = Math.PI / 2;
/** wing footprints on the pier (content/insaat.ts: shared with the tadilat site and the sim ustalar) */
const cx = (r: { x0: number; x1: number }) => (r.x0 + r.x1) / 2, cz = (r: { z0: number; z1: number }) => (r.z0 + r.z1) / 2;
/** open-air wing tables built at this stage (sim tables, content/kanat.ts); salon tables are ic-mekan items, roof tables drawn by hall() */
const acikMasalar = (st: number, b: 'cay' | 'dondurma'): KanatMasa[] => { const on = new Set(kanatKurulu(st)); return KANAT_MASALAR.filter((m, k) => m.bolge === b && on.has(KANAT_BASE + k)); };   // 2026-11-22: bought one by one (yellow pads)
/** BUF-21: aşama adları tek kaynaktan (content/stages.ts short); 0 ve 1 boş (büyüme 2'den başlar) */
export const BUYUME_AD = ['', '', ...KIOSK_STAGES.slice(1).map(s => s.short)];

/**
 * 2026-11-21 service passage between the büfe back wall (z -10.6) and the kitchen front (z -13.0), as wide as the büfe: roofed, side
 * walls, one staff door in the west wall (kz0..kz1). The pass window and the kitchen door open into it.
 */
export const GECIT = { x0: BUFE.x0 - 0.05, x1: BUFE.x1 + 0.05, z0: -13.0, z1: -12.0, kz0: -12.55, kz1: -11.05 };   // 2026-11-22: only the strip in front of the kitchen (the rest is the park)
/** 2026-11-21 büfe interior: bread / dessert cabinet against the east wall (stage 6+), clear of the tost station and the window post */
export const BUFE_VITRIN = { x0: BUFE.x1 - 0.62, x1: BUFE.x1 - 0.14, z0: BUFE.z0 + 1.05, z1: BUFE.z0 + 2.45 };
export const gecitIcinde = (p: { x: number; z: number }) => p.x > GECIT.x0 && p.x < GECIT.x1 && p.z > GECIT.z0 && p.z < GECIT.z1;
/** passage side walls (walk grid): west wall split by the staff door, east wall closed */
export function gecitDuvar(): { x0: number; x1: number; z0: number; z1: number }[] {
  const G = GECIT, t = 0.2;
  return [{ x0: G.x0, x1: G.x0 + t, z0: G.z0, z1: G.kz0 }, { x0: G.x0, x1: G.x0 + t, z0: G.kz1, z1: G.z1 }, { x0: G.x1 - t, x1: G.x1, z0: G.z0, z1: G.z1 }];
}
/** Solid parts of the growth for the walk grid (halls, counters, kitchen, tables). */
export function buyumeEngel(stage: number, salonSahip?: readonly string[]): { x0: number; x1: number; z0: number; z1: number; tag: string }[] {
  const o: { x0: number; x1: number; z0: number; z1: number; tag: string }[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number, tag = 'buyume') => o.push({ x0, x1, z0, z1, tag });
  // table top only (as the kiosk tables, view/world/index.ts): the seats (±0.78 on the seat axis) and the garson spot stay walkable
  for (const m of [...acikMasalar(stage, 'cay'), ...acikMasalar(stage, 'dondurma')]) add(m.x - 0.45, m.x + 0.45, m.z - 0.45, m.z + 0.45, 'buyume-masa');
  if (stage >= 3) add(WT.x0 + 0.2, WT.x0 + 1.4, -9.0, -6.4, 'buyume-ocak');
  if (stage >= 4) add(ET.x1 - 1.3, ET.x1 - 0.1, ET.z0 + 0.3, ET.z0 + 2.0, 'buyume-dolap');
  // 2026-11-09 "her yere girilebilmeli": the halls are rooms with a door on the promenade side (content/ic-mekan.ts)
  for (const r of restoranDuvar(stage)) add(r.x0, r.x1, r.z0, r.z1, 'buyume-duvar');   // 2026-11-25 ters U: dış duvar + revak direkleri + ön tezgâh
  if (stage >= 6) icColliders(IC_BY_ID.salonW, stage, salonSahip).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  if (stage >= 7) icColliders(IC_BY_ID.salonE, stage, salonSahip).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-salon'));
  // roof terrace stairs (stage 8): closed on the ground grid, only the scripted roof route (sim content/kanat.ts) uses them
  if (stage >= 8) for (const sd of ['W', 'E'] as const) { const k = merdivenKutu(sd); add(k.x0, k.x1, k.z0, k.z1, 'buyume-merdiven'); }
  if (stage >= 3) icColliders(IC_BY_ID.mutfak, stage).forEach(r => add(r.x0, r.x1, r.z0, r.z1, 'buyume-bufemutfak'));   // 2026-11-09 büfe mutfağı (BUF-22: walls follow the stage room)
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
  const cati = (ad: string) => { const c = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; c.g.name = ad; catis.push(c); return c; };
  /* 2: flower boxes, menu easel, bistro sets at the pier mouth */
  if (stage >= 2) {
    for (const x of [-9.0, -6.6, 8.6]) planter(x, 3.95, 1.8, 0.5);   // 2026-11-22: the büfe front now stands on the pier mouth (x ±4.2)
    b.box(0.9, 1.25, 0.06, '#2b2b2b', -5.1, 0.75, 3.7, { rx: -0.18 }); b.box(0.8, 1.1, 0.02, '#3a4a3a', -5.1, 0.77, 3.74, { rx: -0.18 });   // menu easel (chalk board)
    for (let i = 0; i < 5; i++) lit.box(0.5 - i * 0.06, 0.02, 0.01, '#f4f2ec', -5.1, 1.1 - i * 0.16, 3.78, { rx: -0.18 });
  }
  /* 3: west Çay bahçesi */
  if (stage >= 3) {
    const r = stage >= 5 ? WT : { ...WT, z0: -9.4, z1: -0.6 };
    if (stage < 6) deck(r);   // 6+: kanadın tek zemini
    acikMasalar(stage, 'cay').forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : UMB[i % UMB.length], stage < 5 || (stage < 6 && m.z < -4.4), fine)   /* no umbrellas under the pergola */);
    // çay ocağı: counter, semaver, tulip glasses, awning
    const ox = WT.x0 + 0.8; b.box(1.2, 1.0, 2.6, fine ? '#2a2a30' : '#8a5a3a', ox, 0.62, -7.7); b.box(1.3, 0.06, 2.7, '#e9e0c8', ox, 1.15, -7.7);
    b.cyl(0.24, 0.3, 0.7, '#c9a23a', ox, 1.53, -8.4, { seg: 14 }); b.cyl(0.1, 0.16, 0.25, '#c9a23a', ox, 2.0, -8.4, { seg: 10 });
    for (let i = 0; i < 6; i++) b.cyl(0.04, 0.03, 0.1, '#b0281e', ox + 0.25, 1.24, -7.2 + i * 0.16, { seg: 6 });
    for (let i = 0; i < 6; i++) b.box(1.5, 0.05, 0.46, i % 2 ? '#fbfaf6' : '#c0392b', ox + 0.1, 2.5, -9.0 + i * 0.46, { rz: -0.25 });
    b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -9.2); b.box(0.06, 2.5, 0.06, '#3a3d42', ox + 0.75, 1.25, -6.2);
    sign('SABRİ ÇAY BAHÇESİ', ox + 0.8, 3.05, -7.7, 3.2, HP);
    if (stage < 6) { planter(WT.x0 + 0.4, r.z1 - 1.6, 0.5, 2.4); planter(cx(WT), WT.z0 + 0.3, 6.0, 0.5); }
  }
  /* 4: east Dondurma & gazoz terası */
  if (stage >= 4) {
    const r = stage >= 7 ? ET : { ...ET, x1: 17.2 };
    if (stage < 7) deck(r);
    acikMasalar(stage, 'dondurma').forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : UMB[(i + 3) % UMB.length], stage < 7, fine));
    const dx = ET.x1 - 0.7; b.box(1.2, 1.5, 1.7, fine ? '#1f2a44' : '#3fb5b0', dx, 0.87, ET.z0 + 1.15); gl.box(0.04, 1.0, 1.4, '#cfeaf5', dx - 0.62, 1.0, ET.z0 + 1.15);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) b.box(0.12, 0.2, 0.12, ['#e0533c', '#ffd23f', '#7ed957', '#f2a2b3'][(i + j) % 4], dx - 0.5, 0.6 + j * 0.3, ET.z0 + 0.6 + i * 0.32);
    sign('DONDURMA · GAZOZ', dx - 0.2, 1.95, ET.z0 + 1.15, 1.9, -HP);
    if (stage < 7) planter(cx(r), ET.z1 + 0.3, Math.min(6.5, r.x1 - r.x0 - 1), 0.5);
  }
  /* 5: pergola with vines over the west deck, string lights over the pier mouth */
  if (stage === 5) {
    const px0 = WT.x0 + 1.8, px1 = WT.x1 - 0.4, pz0 = -4.4, pz1 = WT.z1 - 0.4;
    for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1], [(px0 + px1) / 2, pz0], [(px0 + px1) / 2, pz1]]) b.box(0.16, 2.9, 0.16, frame, x, 1.57, z);
    for (let i = 0; i < 10; i++) b.box(px1 - px0 + 0.3, 0.08, 0.1, '#8a6a4a', (px0 + px1) / 2, 3.0, pz0 + i * (pz1 - pz0) / 9);
    // AR-GE 2026-11-22: asma yaprakları çıta boyunca düzenli sıralar (eskiden 40 rastgele dönük kutu: yukarıdan dağınık yeşil kareler gibiydi)
    for (let r = 0; r < 10; r++) {
      const z = pz0 + r * (pz1 - pz0) / 9, n = Math.max(2, Math.floor((px1 - px0) / 0.72));
      for (let c = 0; c <= n; c++) {
        const x = px0 + c * (px1 - px0) / n, q = (r * 7 + c * 3) % 5;
        b.box(0.62 + (q % 3) * 0.08, 0.06, 0.4, ['#4f8f3a', '#5f9f45', '#3f7a34'][(r + c) % 3], x, 3.07 + (q % 2) * 0.012, z, { ry: (q - 2) * 0.05 });
        if (q === 0 && c % 2 === 0) b.sph(0.06, r % 2 ? '#c94f6d' : '#f2a2b3', x + 0.18, 3.11, z + 0.1, { ws: 5, hs: 3 });
      }
    }
  }
  if (stage >= 5) {
    if (stage < 6) lights([[-10.3, 3.7], [-5.4, 3.9]], 3.4); lights([[5.2, 4.1], [8.6, 3.8]], 3.4);   // 2026-11-22: not across the büfe front
  }
  /* 3+: büfe mutfağı shell behind the roofed service passage (interior: view/world/ic-mekan-look.ts, door on the walkway side).
     BUF-22: the shell grows with the stage room (content/ic-mekan.ts mutfakOda: esnaf 9.2 m, lokanta 13.8 m, iki hatlı 18 m). The
     front is a shop window (low wall + glass) with the pass window behind the büfe counter: garsons take plates there from the
     service passage (GECIT). Walls live in 'duvar-K' (hidden while the player is inside), the roof in 'cati-K' (2026-11-21: off
     only while the player is inside the kitchen; from the büfe the passage roof lifts and the kitchen shows through the glass front). */
  if (stage >= 3 && stage < 6) {
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
    sign('SERVİS', PU, 2.8, Z1 + 0.2, 1.5);   // sokak pass'ı: büfe önü masaları + salonu olmayan teras
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
    for (const y of [1.55, 2.0]) { b.box(0.26, 0.04, 1.0, fine ? '#c9a24a' : '#a8794e', wx + 0.1, y, BUFE.z0 + 1.55); for (let i = 0; i < 6; i++) b.cyl(0.035, 0.03, 0.1, y < 1.8 ? '#b0281e' : '#e9c88a', wx + 0.12, y + 0.07, BUFE.z0 + 1.15 + i * 0.16, { seg: 6 }); }
    b.box(0.04, 0.5, 0.65, fine ? '#c9a24a' : '#5a3b2a', wx, 2.55, BUFE.z0 + 1.55); b.box(0.02, 0.4, 0.55, '#c9b48a', wx + 0.03, 2.55, BUFE.z0 + 1.55);   // framed 1987 photo
    b.cyl(0.62, 0.62, 0.006, fine ? '#c9a24a' : '#c8693e', 0.15, 0.003, BUFE.z0 + 2.05, { seg: 24 }); b.cyl(0.52, 0.52, 0.008, fine ? '#1f2a44' : '#efe3c8', 0.15, 0.005, BUFE.z0 + 2.05, { seg: 24 });   // floor inlay
    b.box(0.5, 0.009, 0.08, fine ? '#c9a24a' : '#c8693e', 0.15, 0.007, BUFE.z0 + 2.05); b.box(0.08, 0.009, 0.5, fine ? '#c9a24a' : '#c8693e', 0.15, 0.007, BUFE.z0 + 2.05);
  }
  /* 6+: ters U restoran (2026-11-25; content/restoran-plan.ts). 1'in görünüşü: kırmızı ahşap, krem söve, kırmızı kiremit tek çatı,
     kırmızı-beyaz tente. Alçak duvarlar, zemin, direkler ve tenteler hep durur; çatı ('cati-R') oyuncu restoranın alanındayken,
     teraslar ('teras-W' / 'teras-E') yalnız altındayken kalkar: alınan her alet her zaman görünür. */
  if (stage >= 6) {
    const RED = '#b93a2c', RED2 = '#a53125', CREAM = '#f3e6c8', TILE = '#a6432f', TILE2 = '#8f3626', PLK = '#b9814f', SEAM = '#8e5d36', GOLD = fine ? '#c9a24a' : CREAM;
    const ucu = (['W', 'E'] as const).filter(s => kanatAcikMi(s, stage)), R = cati('cati-R');
    const zemin = (x0: number, x1: number, z0: number, z1: number, y = 0.14) => { b.box(x1 - x0, y, z1 - z0, PLK, (x0 + x1) / 2, y / 2, (z0 + z1) / 2); const n = Math.round((x1 - x0) / 0.8); for (let i = 1; i < n; i++) b.box(0.025, 0.004, z1 - z0, SEAM, x0 + (x1 - x0) * i / n, y + 0.002, (z0 + z1) / 2); };
    const ex = stage >= 7 ? 8.0 : 8.55;
    zemin(KANAT_W.x1, -8.55, -17.4, -13.0); if (stage >= 7) zemin(8.55 - 0.55, 8.55, -17.4, -13.0); zemin(KANAT_W.x1, ex, -13.0, -10.6);
    /** kiremit çatı: sırt x ya da z boyunca iki eğim, bindirme derzleri, mahya, krem saçak, üçgen alın */
    const kiremit = (x0: number, x1: number, z0: number, z1: number, y: number, h: number, eks: 'x' | 'z') => {
      const bb = R.b, X = (x0 + x1) / 2, Z = (z0 + z1) / 2, L = eks === 'x' ? x1 - x0 : z1 - z0, G = (eks === 'x' ? z1 - z0 : x1 - x0) / 2, len = Math.hypot(G, h) + 0.15, ang = Math.atan2(h, G);
      for (const q of [-1, 1]) {
        if (eks === 'x') { bb.box(L, 0.16, len, TILE, X, y + h / 2, Z + q * G / 2, { rx: q * ang }); for (let t = -L / 2 + 0.35; t < L / 2; t += 0.7) bb.box(0.12, 0.1, len, TILE2, X + t, y + h / 2 + 0.1, Z + q * G / 2, { rx: q * ang }); for (let k = 1; k < 8; k++) bb.box(L, 0.04, 0.06, TILE2, X, y + h * (1 - k / 8) + 0.1, Z + q * G * k / 8, { rx: q * ang }); bb.box(L + 0.2, 0.16, 0.16, CREAM, X, y + 0.02, Z + q * (G + 0.02)); }
        else { bb.box(len, 0.16, L, TILE, X + q * G / 2, y + h / 2, Z, { rz: -q * ang }); for (let t = -L / 2 + 0.35; t < L / 2; t += 0.7) bb.box(len, 0.1, 0.12, TILE2, X + q * G / 2, y + h / 2 + 0.1, Z + t, { rz: -q * ang }); for (let k = 1; k < 8; k++) bb.box(0.06, 0.04, L, TILE2, X + q * G * k / 8, y + h * (1 - k / 8) + 0.1, Z, { rz: -q * ang }); bb.box(0.16, 0.16, L + 0.2, CREAM, X + q * (G + 0.02), y + 0.02, Z); }
      }
      if (eks === 'x') bb.box(L + 0.2, 0.2, 0.34, TILE2, X, y + h + 0.06, Z); else bb.box(0.34, 0.2, L + 0.2, TILE2, X, y + h + 0.06, Z);
      for (let i = 0; i < 6; i++) { const w = 2 * G * (1 - (i + 0.5) / 6), yy = y + h * (i + 0.5) / 6; for (const q of [-1, 1]) if (eks === 'x') bb.box(0.1, h / 6 + 0.02, w, RED, X + q * (L / 2 - 0.1), yy, Z); else bb.box(w, h / 6 + 0.02, 0.1, RED, X, yy, Z + q * (L / 2 - 0.1)); }
    };
    /** alçak duvar (hep), üstü cam + dikme (çatıyla kalkar) */
    const duvar = (x0: number, x1: number, z0: number, z1: number, dolu = false) => {
      const yat = x1 - x0 > z1 - z0, L = yat ? x1 - x0 : z1 - z0, X = (x0 + x1) / 2, Z = (z0 + z1) / 2, hh = dolu ? RES_H : 0.95; if (L < 0.2) return;
      b.box(yat ? L : 0.25, hh, yat ? 0.25 : L, RED, X, hh / 2, Z); const nb = Math.round(L / 0.5); for (let i = 1; i < nb; i++) b.box(yat ? 0.03 : 0.27, hh - 0.1, yat ? 0.27 : 0.03, RED2, yat ? x0 + L * i / nb : X, hh / 2, yat ? Z : z0 + L * i / nb);
      b.box(yat ? L + 0.06 : 0.33, 0.1, yat ? 0.33 : L + 0.06, CREAM, X, hh + 0.04, Z);
      if (dolu) { const n = Math.max(1, Math.round(L / 3.0)); for (let i = 0; i < n; i++) { const p = -L / 2 + L * (i + 0.5) / n, wx = yat ? X + p : X, wz = yat ? Z : Z + p; b.box(yat ? 1.5 : 0.3, 1.2, yat ? 0.3 : 1.5, CREAM, wx, 2.0, wz); lit.box(yat ? 1.3 : 0.32, 1.0, yat ? 0.32 : 1.3, '#cfe6f2', wx, 2.0, wz); } return; }
      R.gl.box(yat ? L : 0.04, RES_H - 1.2, yat ? 0.04 : L, '#a9d6ec', X, 1.0 + (RES_H - 1.2) / 2, Z); const n = Math.max(1, Math.round(L / 2.4)); for (let i = 0; i <= n; i++) R.b.box(0.18, RES_H - 0.95, 0.18, CREAM, yat ? x0 + L * i / n : X, 0.95 + (RES_H - 0.95) / 2, yat ? Z : z0 + L * i / n);
      R.b.box(yat ? L : 0.28, 0.3, yat ? 0.28 : L, RED, X, RES_H - 0.15, Z);
    };
    const tente = (x0: number, x1: number, z0: number, z1: number, yon: 'x+' | 'x-' | 'z+') => {
      const yat = yon === 'z+', L = yat ? x1 - x0 : z1 - z0, n = Math.max(2, Math.round(L / 0.55)), w = L / n;
      for (let i = 0; i < n; i++) { const c = i % 2 ? '#fbf3e2' : fine ? '#9c2a22' : '#c8402f', p = (i + 0.5) * w;
        if (yat) { b.box(w, 0.06, 1.0, c, x0 + p, 2.62, z1 + 0.45, { rx: 0.35 }); b.box(w, 0.2, 0.05, c, x0 + p, 2.36, z1 + 0.92); }
        else { const q = yon === 'x+' ? 1 : -1, X = q > 0 ? x1 : x0; b.box(1.0, 0.06, w, c, X + q * 0.45, 2.62, z0 + p, { rz: -q * 0.35 }); b.box(0.05, 0.2, w, c, X + q * 0.92, 2.36, z0 + p); } }
    };
    for (const s of ucu) {
      const k = kanatDik(s), kx = kanatKapi(s), ic = s === 'W' ? k.x1 : k.x0, q = s === 'W' ? 1 : -1, fz = stage >= 8 ? TERAS_Z : k.z1;
      zemin(k.x0, k.x1, k.z0, k.z1);
      duvar(k.x0, k.x1, k.z0, k.z0 + 0.25, true);
      if (s === 'W') duvar(k.x0, k.x0 + 0.25, k.z0, k.z1); else { duvar(k.x1 - 0.25, k.x1, k.z0, VAPUR_GECIT[0]); duvar(k.x1 - 0.25, k.x1, VAPUR_GECIT[1], k.z1); }
      duvar(k.x0, kx - 1, k.z1 - 0.25, k.z1); duvar(kx + 1, k.x1, k.z1 - 0.25, k.z1);
      for (const x of [kx - 1, kx + 1]) b.box(0.2, 2.7, 0.2, GOLD, x, 1.35, k.z1 - 0.12); b.box(2.2, 0.22, 0.22, GOLD, kx, 2.75, k.z1 - 0.12);   // promenad kapısı
      for (const z of revakDirek(s)) { b.box(0.2, 2.8, 0.2, CREAM, ic, 1.4, z); b.box(0.3, 0.16, 0.3, RED, ic, 0.2, z); }
      b.box(0.24, 0.26, k.z1 + 13.2, RED, ic, 2.85, (k.z1 - 13.2) / 2);   // revak kirişi
      for (const [x, z] of saksiYer(s, stage)) { b.cyl(0.3, 0.24, 0.55, fine ? '#c9a24a' : '#b5562f', x, 0.41, z, { seg: 10 }); b.sph(0.42, '#3f7a34', x, 1.05, z, { ws: 8, hs: 6 }); b.sph(0.3, '#4f8f3a', x + 0.12, 1.38, z - 0.05, { ws: 7, hs: 5 }); }
      for (const lx of [k.x0 + 2.6, kx, k.x1 - 2.6]) for (const lz of stage >= 8 ? [-12.4, -10.4, -7.0] : [-12.4, -10.4, -7.0, -2.4, 1.2]) { b.cyl(0.012, 0.012, 0.5, '#3a2a20', lx, 2.95, lz, { seg: 4 }); b.cone(0.2, 0.2, fine ? '#c9a24a' : '#b8733d', lx, 2.62, lz, { seg: 10 }); lit.sph(0.08, '#ffe6b0', lx, 2.5, lz, { ws: 6, hs: 4 }); glowAt(lx, lz, 1.5); }   // bakır sarkıtlar
      for (let z = -12.4; z < 3.8; z += 1.1) lit.sph(0.06, '#ffd890', ic + q * 0.16, 2.6, z, { ws: 6, hs: 4 });
      tente(k.x0, k.x1, -12.6, 3.9, s === 'W' ? 'x+' : 'x-'); tente(k.x0 + 0.2, k.x1 - 0.2, k.z1, k.z1, 'z+');
      kiremit(k.x0 - 0.3, k.x1 + 0.3, -13.6, fz + (stage >= 8 ? 0 : 0.35), RES_H, 2.2, 'z');
      { const g0 = grp; grp = R.g; const bb = b; b = R.b; sign(s === 'W' ? (fine ? 'KAHVALTI' : 'SABRİ KAHVALTI') : (fine ? 'BALIK' : 'SABRİ BALIK'), kx, RES_H + 0.55, (stage >= 8 ? k.z1 + 0.4 : k.z1 + 0.45), 4.2, 0, fine ? '#14192a' : '#8a2219', fine ? '#e8c76a' : '#fbf3e2'); b = bb; grp = g0; }
      if (stage >= 8) {
        const t = cati('teras-' + s), M0 = b, G0 = grp, L0 = lit, sx = s === 'W' ? -10.75 : 8.75, si = s === 'W' ? sx - 0.55 : sx + 0.55; b = t.b; grp = t.g; lit = t.lit;
        const dos = (x0: number, x1: number, z0: number, z1: number) => { b.box(x1 - x0, 0.3, z1 - z0, RED, (x0 + x1) / 2, TERAS_Y - 0.17, (z0 + z1) / 2); b.box(x1 - x0 - 0.1, 0.05, z1 - z0 - 0.1, '#b5834f', (x0 + x1) / 2, TERAS_Y, (z0 + z1) / 2); };
        if (s === 'W') { dos(k.x0, si, TERAS_Z, k.z1); dos(si, k.x1, TERAS_Z, -2.0); dos(si, k.x1, 2.9, k.z1); } else { dos(si, k.x1, TERAS_Z, k.z1); dos(k.x0, si, TERAS_Z, -2.0); dos(k.x0, si, 2.9, k.z1); }
        const rr = (xa: number, za: number, xb: number, zb: number) => { const len = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), n = Math.round(len / 1.1); b.box(0.1, 0.08, len, GOLD, (xa + xb) / 2, TERAS_Y + 0.95, (za + zb) / 2, { ry: a }); for (let i = 0; i <= n; i++) b.box(0.08, 0.95, 0.08, CREAM, xa + (xb - xa) * i / n, TERAS_Y + 0.47, za + (zb - za) * i / n); };
        rr(k.x0, TERAS_Z, k.x0, k.z1); rr(k.x1, TERAS_Z, k.x1, k.z1); rr(k.x0, k.z1, k.x1, k.z1); rr(si, -1.9, si, 2.9);
        KANAT_MASALAR.filter((m, i) => m.cati === s && kanatKurulu(stage).includes(KANAT_BASE + i)).forEach((m, i) => table(m.x, m.z, m.ax, fine ? '#f4f2ec' : i % 2 ? '#fbf3e2' : '#c8402f', true, fine, TERAS_Y));
        planter(kx, k.z1 - 0.6, 4.0, 0.4); lights([[k.x0, TERAS_Z], [k.x0, k.z1], [k.x1, k.z1], [k.x1, TERAS_Z]], TERAS_Y + 2.2);
        b = M0; grp = G0; lit = L0;
        for (let i = 0; i < 14; i++) b.box(0.9, 0.12, 0.38, '#a8673a', sx, 0.25 + i * (TERAS_Y - 0.14) / 14, 2.75 - i * 0.35);   // terasın merdiveni (kanadın içinde, revak kenarında)
        for (const r of [-1, 1]) { const dy = TERAS_Y - 0.3, run = 4.6; b.box(0.07, 0.24, Math.hypot(dy, run), '#7a4a2a', sx + r * 0.48, TERAS_Y / 2, 0.45, { rx: Math.atan2(dy, run) }); b.box(0.06, 0.06, Math.hypot(dy, run), GOLD, sx + r * 0.48, TERAS_Y / 2 + 0.9, 0.45, { rx: Math.atan2(dy, run) }); }
      }
    }
    duvar(KANAT_W.x1, ex, -17.4, -17.15, true); if (stage < 7) duvar(8.3, 8.55, -17.15, -13.0, true);
    for (const r of onDolgu(stage)) { b.box(r.x1 - r.x0, 1.0, r.z1 - r.z0, '#8a5a3a', (r.x0 + r.x1) / 2, 0.64, (r.z0 + r.z1) / 2); b.box(r.x1 - r.x0 + 0.08, 0.08, r.z1 - r.z0 + 0.1, CREAM, (r.x0 + r.x1) / 2, 1.18, (r.z0 + r.z1) / 2); for (let x = r.x0 + 0.5; x < r.x1 - 0.2; x += 0.8) b.cyl(0.17, 0.17, 0.03, '#ffffff', x, 1.24, (r.z0 + r.z1) / 2, { seg: 12 }); }   // U tezgâhın dolgusu
    for (const r of mutfakUc(stage)) { b.box(r.x1 - r.x0, 1.0, r.z1 - r.z0, RED, (r.x0 + r.x1) / 2, 0.6, (r.z0 + r.z1) / 2); b.box(r.x1 - r.x0 + 0.1, 0.08, r.z1 - r.z0 + 0.06, CREAM, (r.x0 + r.x1) / 2, 1.14, (r.z0 + r.z1) / 2); }
    kiremit(stage >= 6 ? KANAT_W.x0 - 0.3 : KANAT_W.x1, stage >= 7 ? 22.1 : 8.85, -17.7, -9.9, RES_H, 2.6, 'x');   // arka bandın tek çatısı
    for (const x of [-6.2, 0.6, 5.6]) { R.b.cyl(0.36, 0.42, 1.7, '#8a5a44', x, RES_H + 2.4, -14.6, { seg: 8 }); R.b.cyl(0.46, 0.46, 0.14, CREAM, x, RES_H + 3.3, -14.6, { seg: 8 }); }
    if (stage >= 9) { R.b.box(9.4, 1.5, 3.2, RED, 0, RES_H + 2.5, -13.6); for (const x of [-3.4, -1.1, 1.1, 3.4]) { R.b.box(1.3, 0.9, 0.1, CREAM, x, RES_H + 2.6, -11.97); R.lit.box(1.1, 0.7, 0.12, '#ffdf9a', x, RES_H + 2.6, -11.96); } kiremit(-5.0, 5.0, -15.5, -11.7, RES_H + 3.2, 1.3, 'x'); }   // şefin açık mutfağının fener çatısı
    glowAt(0, -11.8, 3.2);
  }
  /* 6-10: the büfe kiosk itself keeps growing (2026-11-22, owner: "büfe her seviyede değişim görmeli"). The kiosk prefab stops at
     stage 5 (index.ts kioskOverrides), so the later looks are dressed on here, all above head height or flat on the walls: nothing
     here needs a collider and the counter / queue stay as they are. 6 striped awning + spots, 7 digital menu boards + neon beam,
     8 brass pendants + slatted side cladding, 10 navy/gold awning and gold trim. High parts hide with the büfe cutaway ('susle-B'). */
  if (stage >= 6) {
    const sb = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; sb.g.name = 'susle-B'; catis.push(sb);
    const mb = b, ml = lit, mg = grp; b = sb.b; lit = sb.lit; grp = sb.g;
    const Z1 = BUFE.z1, n = 12, w = (BUFE.x1 - BUFE.x0 + 0.2) / n, c1 = fine ? '#1f2a44' : '#b93a2c', c2 = fine ? '#c9a24a' : '#fbf3e2';
    // 2026-11-22: the striped tente is gone (it hid the bar of the restaurant's front hall from the camera): a thin painted fascia
    for (let i = 0; i < n; i++) b.box(w, 0.16, 0.04, i % 2 ? c2 : c1, BUFE.x0 - 0.1 + (i + 0.5) * w, 3.38, Z1 + 0.04);
    for (const x of [-2.6, 0, 2.6]) { b.box(0.08, 0.1, 0.3, '#33373b', x, 3.12, Z1 + 0.12); lit.sph(0.07, '#fff3d6', x, 3.05, Z1 + 0.25, { ws: 6, hs: 4 }); }
    if (stage >= 7) lit.box(BUFE.x1 - BUFE.x0, 0.04, 0.03, fine ? '#e8c76a' : '#5ff0e0', 0, 3.33, Z1 + 0.03);   // neon line on the front beam
    if (stage >= 8) for (const x of [-1.4, 0.0, 1.4]) { b.cyl(0.01, 0.01, 0.9, '#3a3d42', x, 2.75, Z1 - 0.6, { seg: 4 }); b.cone(0.16, 0.18, fine ? '#c9a24a' : '#b8862f', x, 2.25, Z1 - 0.6, { seg: 10 }); lit.sph(0.06, '#ffe6b0', x, 2.17, Z1 - 0.6, { ws: 6, hs: 4 }); }
    if (fine) for (const x of [-4.1, 4.1]) b.box(0.19, 3.3, 0.04, '#c9a24a', x, 1.65, Z1 + 0.01);   // gold faced corner posts
    b = mb; lit = ml; grp = mg;
    if (stage >= 7) {   // digital menu boards on the inside of the back wall (above the tiles), seen through the open top
      for (const [i, x] of [-2.4, 0, 2.4].entries()) { b.box(1.5, 0.62, 0.05, '#1b1e22', x, 2.08, BUFE.z0 + 0.25); lit.box(1.38, 0.5, 0.01, ['#ffcf6a', '#ffe6b0', '#9fe3ff'][i], x, 2.08, BUFE.z0 + 0.28); for (let k = 0; k < 4; k++) b.box(0.9, 0.035, 0.01, '#2a2f36', x - 0.12, 2.24 - k * 0.1, BUFE.z0 + 0.29); }
    }
    if (stage >= 8) for (const xo of [BUFE.x0 - 0.03, BUFE.x1 + 0.03]) for (let k = 0; k < 9; k++) b.box(0.03, 2.5, 0.12, fine ? '#3a2a20' : '#9a6b45', xo, 1.25, BUFE.z0 + 0.2 + k * 0.17);   // slatted cladding on the tall side walls
  }
  /* 2026-11-22: no büfe sign any more from stage 6 (the büfe is the restaurant's front hall); the crest on the kitchen roof names it. */
  /* 6+: restaurant crest on the kitchen roof, facing the promenade over the büfe: the back row (salon + kitchen + salon) is one
     restaurant, "Sabri Restoran", at stage 10 "Sabri'nin Sofrası". Hidden from inside the büfe / kitchen (cutaway). */
  if (stage >= 6) {
    const tr = { g: new T.Group(), b: new Batch(), gl: new Batch(), lit: new Batch(), wm: new Batch() }; tr.g.name = 'tabela-R'; catis.push(tr);
    const mb = b, mg = grp; b = tr.b; grp = tr.g; const zf = -10.3;
    sign(fine ? 'SABRİ\'NİN SOFRASI' : 'SABRİ RESTORAN', 0, 4.75, zf, fine ? 9.0 : 7.2, 0, fine ? '#14192a' : '#8a2219', fine ? '#e8c76a' : '#fbf3e2');
    for (const x of [-2.6, 2.6]) b.box(0.12, 1.2, 0.12, fine ? '#c9a24a' : '#f3e6c8', x, 3.75, zf - 0.08);
    b = mb; grp = mg;
  }
  /* 10: fine dining arrival: at the RESTAURANT doors (salon fronts), not along the büfe queue (2026-11-21) */
  if (fine) {
    for (const s of ['W', 'E'] as const) { const X = kanatKapi(s), z1 = kanatDik(s).z1; b.box(1.6, 0.025, 1.15, '#9a1f2a', X, 0.02, z1 + 0.6); b.box(1.68, 0.02, 1.2, '#c9a24a', X, 0.012, z1 + 0.6); for (const s2 of [-1, 1]) { const x = X + s2 * 1.25; b.cyl(0.03, 0.03, 0.9, '#c9a24a', x, 0.45, z1 + 0.9, { seg: 6 }); b.sph(0.06, '#c9a24a', x, 0.92, z1 + 0.9, { ws: 6, hs: 4 }); } }
    b.box(0.6, 1.1, 0.4, '#1f2a44', 4.2, 0.55, 5.6); b.box(0.66, 0.06, 0.46, '#c9a24a', 4.2, 1.12, 5.6);   // valet podium on the promenade
    for (const [x, z] of [[kanatKapi('W') - 2.2, 4.9], [kanatKapi('W') + 2.2, 4.9], [kanatKapi('E') - 2.2, 4.9], [kanatKapi('E') + 2.2, 4.9]]) { b.cyl(0.32, 0.26, 0.6, '#f4f2ec', x, 0.3, z, { seg: 10 }); b.sph(0.42, '#3f7a34', x, 0.95, z, { ws: 8, hs: 6 }); b.sph(0.3, '#4f8f3a', x, 1.5, z, { ws: 8, hs: 6 }); }
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
  let built = -1, builtK = '', grp: T.Group | null = null, t = 0, cur: Built | null = null;
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
      const mk0 = kanatKurulu(st).join(',');   // a bought table is drawn at once
      if (st !== built || mk0 !== builtK || (grp && grp.parent !== root)) { clear(); built = st; builtK = mk0; cur = null; if (st >= 2) { cur = build(st, signMats, flames); grp = cur.g; root.add(grp); } }
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
        const inK = st < 6 && icIcinde(mutfakOda(st), hp, 0.2), inR = st >= 6 && restoranAlani(hp);
        for (const nm of ['duvar-K', 'cati-K']) { const o = grp.getObjectByName(nm); if (o) o.visible = !inK; }
        const cR = grp.getObjectByName('cati-R'); if (cR) cR.visible = !inR;   // 2026-11-25: oyuncu iskeledeyken restoranın içi hep açık
        for (const s of ['W', 'E'] as const) { const o = grp.getObjectByName('teras-' + s); if (o) { const k = kanatDik(s); o.visible = !(hp.x > k.x0 && hp.x < k.x1 && hp.z > TERAS_Z - 4 && hp.z < k.z1 + 0.4); } }
        const inB = hp.x > BUFE.x0 - 0.2 && hp.x < BUFE.x1 + 0.2 && hp.z > BUFE.z0 - 0.2 && hp.z < BUFE.z1, tbB = grp.getObjectByName('tabela-B'); if (tbB) tbB.visible = !inB && !gecitIcinde(hp);
        const sB = grp.getObjectByName('susle-B'); if (sB) sB.visible = !inB;
        const tbR = grp.getObjectByName('tabela-R'); if (tbR) tbR.visible = !inR;
      }
      const n = deps.night();
      const M = mats(); M.glow.color.setScalar(0.55 + 0.45 * n); M.pool.opacity = 0.75 * n; M.warm.opacity = 0.35 * n;
      for (const s of signMats) s.emissiveIntensity = 0.25 + n * 0.5;
      for (const f of flames) { const k = 0.8 + 0.3 * Math.sin(t * 13 + f.userData.ph) + 0.15 * Math.sin(t * 29 + f.userData.ph * 2); f.scale.set(1, k, 1); }
    },
    dispose() { clear(); },
  };
}
