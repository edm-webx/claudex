/**
 * Stadyum Mahallesi (dünya, x 392..452): bilet gişesi, kulüp binası, tribünler ve taraftar (2026-11-02; FUT-08/09 2026-11-21).
 * Pure view: reads mulkApi(rules).model() (takim, stad). The zone prefabs (content/zones/disari.ts: pitch, the low 4-row stand,
 * hedges, cages, two short floodlights) stay as they are; this view fills the district with the shared stadium module
 * (view/stadyum/ortak.ts) so the world stadium has the same quality as the match scene (owner audit: "dünyadaki stadyum hâlâ
 * çıplak: boş beyaz kulüp binası, ince tribünler"):
 * - a roofed upper tier behind the prefab stand and two end stands behind the goals, bucket seats and the instanced crowd
 *   (club colours, size follows the gate: stad.doluluk / tahmin; a few neutral fans before a club exists);
 * - a two-storey club building on the old office footprint: façade, sign with crest, windows, door canopy, flags, sponsor
 *   banners and a furnished, lit interior seen through the glass (grey "kulüp kurma ofisi" with a poster before the club);
 * - four lattice floodlight masts, parody ad boards inside the hedges, a car park with crowd barriers, trees.
 * Layout: the office and booth keep their old collider rects; new solids only where the walk grid was open plaza (end stands,
 * masts, cars, barriers, trees), nothing on the street band (z 4.85..13.3) or the pitch. The upper-tier roof fades out when
 * the hero walks north of the pitch so it never hides Sabri.
 */
import * as T from 'three';
import type { Rules } from '../../sim/state';
import { mulkApi } from '../../sim/mulk';
import type { Vec3, ScreenPt } from '../../../engine/api';
import type { HtmlLabels } from '../../ui/labels';
import { zeminDetay } from '../../../engine/render/zemin-detay';
import { createKit, tierNow, boxBatch, buildStand, buildSeats, createCrowd, buildMast, panoDoku, flagaDoku, formaRengi, REKLAM, REKLAM_RENK, type Kit, type Seat, type FanSeat, type Crowd } from './ortak';

export interface StadyumViewDeps { scene: T.Scene; labels: HtmlLabels; project(p: Vec3, out: ScreenPt): boolean; rules: () => Rules | null; hero: () => { x: number; z: number }; setSolid?: (r: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface StadyumView { update(dt: number): void; dispose(): void }
type Rect = { x0: number; x1: number; z0: number; z1: number };
type Takim = { ad: string; renk: string; renk2?: string; arma?: string };
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const OFIS = { x: 417, z: 8.5, w: 8, d: 5 }, GISE = { x: 404.5, z: 9, w: 3.2, d: 2.2 };
const PITCH = { x: 426, z: 19.5 };
// prefab stand (mk.stand at 426, 30.2, turned to face the pitch): 4 rows, 28 seats a row
const LOW_ROWS = 4, LOW_COLS = 28;
const R = (x: number, z: number, w: number, d: number): Rect => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
// static solids on open plaza only (checked against the zone walk grid): end stands, masts, cars, barriers, trees
const END_W: Rect = { x0: 404.6, x1: 410.1, z0: 13.9, z1: 27.1 }, END_E: Rect = { x0: 441.9, x1: 447.4, z0: 13.9, z1: 27.1 };
const MASTS: [number, number][] = [[403.4, 14.4], [448.6, 14.4], [407.6, 33.4], [444.4, 33.4]];
const CARS: [number, number, number, string][] = [[394.3, 29.0, Math.PI, '#c0392b'], [396.8, 29.0, Math.PI, '#e9ecef'], [401.8, 29.0, Math.PI, '#2b4a7a'], [400.6, 17.4, 0, '#3a3d42']];
const TREES: [number, number][] = [[393.4, 23.2], [450.6, 21.0], [450.6, 29.5], [399, 43], [406, 44], [414, 43.5], [422, 44.2], [430, 43.4], [438, 44], [446, 43.2], [452, 41]];

export function createStadyumView(d: StadyumViewDeps): StadyumView {
  const tier = tierNow(), lo = tier === 'akici';
  const kit = createKit();
  const root = new T.Group(); root.name = 'stadyum-kulup'; d.scene.add(root);
  const tmp: ScreenPt = { x: 0, y: 0 }, at: Vec3 = { x: 0, y: 0, z: 0 };
  const M = kit.mat;

  /** Painted crest plate: club colours, crest emoji and name. */
  function plate(k: Kit, w: number, h: number, c1: string, c2: string, arma: string, name: string): T.CanvasTexture {
    return k.canvas(512, Math.round(512 * h / w), (g, cw, ch) => {
      const gr = g.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, c1); gr.addColorStop(0.5, c1); gr.addColorStop(0.5, c2); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, cw, ch);
      g.fillStyle = 'rgba(255,255,255,.14)'; for (let i = -2; i < 12; i++) g.fillRect(i * 64, 0, 28, ch);
      g.font = `${ch * 0.62}px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(arma, ch * 0.62, ch / 2 + 4);
      g.font = `900 ${ch * 0.34}px system-ui,sans-serif`; g.textAlign = 'left'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,18,36,.85)'; g.strokeText(name, ch * 1.2, ch / 2, cw - ch * 1.3); g.fillStyle = '#fff'; g.fillText(name, ch * 1.2, ch / 2, cw - ch * 1.3);
    });
  }

  // ───────────── static structures (club independent) ─────────────
  const steel = M('#7d8792', { metalness: 0.6, roughness: 0.45 });
  // roofed upper tier right behind the prefab stand's back wall (outside the walk area, z > 32)
  const upper = buildStand(kit, root, { len: 34, rows: 7, depth: 0.9, rise: 0.55, base: 3.75, roof: true, aisle: 12, concrete: '#9097a0', id: 0 }, { x: PITCH.x, z: 34.55, rotY: Math.PI });
  const ends = [buildStand(kit, root, { len: 13, rows: 6, aisle: 8, concrete: '#9097a0', id: 1 }, { x: 410.0, z: 20.5, rotY: Math.PI / 2 }),
    buildStand(kit, root, { len: 13, rows: 6, aisle: 8, concrete: '#9097a0', id: 2 }, { x: 442.0, z: 20.5, rotY: -Math.PI / 2 })];
  const roofMats = new Set<T.Material>(); upper.roof.forEach(m => roofMats.add(m.material as T.Material));
  // back of the upper tier faces the default camera: ribs, two stair towers, gate signs
  {
    const b = boxBatch(kit), zb = 34.55 + upper.back + 0.32, wall = M('#8a919a', { roughness: 0.9 }), dark = M('#2a3038');
    for (let x = 410; x <= 442; x += 3.2) b.box(wall, 0.35, upper.top + 1.4, 0.3, x, (upper.top + 1.4) / 2, zb + 0.12);
    for (const sx of [-1, 1]) { const x = PITCH.x + sx * 18.6; b.box(wall, 2.6, upper.top + 2.2, 3.2, x, (upper.top + 2.2) / 2, 37.6); b.box(dark, 1.2, 2.2, 0.08, x, 1.1, 39.25); b.box(steel, 2.8, 0.15, 3.4, x, upper.top + 2.25, 37.6); }
    b.flush(root);
    for (const [x, txt] of [[PITCH.x - 8, 'TRİBÜN A'], [PITCH.x + 8, 'TRİBÜN B']] as const) {
      const sg = new T.Mesh(kit.geo(new T.PlaneGeometry(3.2, 0.7)), M('#ffffff', { map: kit.canvas(256, 56, (g, w, h) => { g.fillStyle = '#1d2a44'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd23f'; g.font = '900 34px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); }), roughness: 0.6 }));
      sg.position.set(x, 2.9, zb + 0.3); root.add(sg);
    }
  }
  // floodlight masts aimed at the pitch
  for (const [x, z] of MASTS) buildMast(kit, root, x, z, z > 30 ? 17 : 14, PITCH);
  // parody ad boards on the inside of the three hedges: one atlas texture, one merged mesh
  {
    const names = [...REKLAM, ...REKLAM]; const n = names.length;
    const atlas = kit.canvas(512, 96 * n, (g) => { names.forEach((s, i) => { const src = panoDoku(kit, s).image as HTMLCanvasElement; g.drawImage(src, 0, i * 96); }); });
    const parts: T.BufferGeometry[] = []; let k = 0;
    const board = (x: number, z: number, w: number, ry: number) => {
      const g = new T.PlaneGeometry(w, 0.85); const uv = g.attributes.uv as T.BufferAttribute, i = k++ % n;
      for (let j = 0; j < uv.count; j++) uv.setY(j, 1 - (i + 1 - uv.getY(j)) / n);
      g.rotateY(ry); g.translate(x, 0.5, z); parts.push(g);
      const back = new T.BoxGeometry(ry === 0 || ry === Math.PI ? w : 0.06, 0.9, ry === 0 || ry === Math.PI ? 0.06 : w); back.translate(x - Math.sin(ry) * 0.04, 0.47, z - Math.cos(ry) * 0.04); backs.push(back);
    };
    const backs: T.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) board(411.4 + 1.25 + i * 2.5, 27.15, 2.4, Math.PI);
    for (let i = 0; i < 6; i++) { board(411.15, 11.6 + 1.25 + i * 2.6, 2.5, Math.PI / 2); board(440.85, 11.6 + 1.25 + i * 2.6, 2.5, -Math.PI / 2); }
    const bm = M('#ffffff', { map: atlas, emissive: '#ffffff', emissiveMap: atlas, emissiveIntensity: 0.18, roughness: 0.6 });
    const b = boxBatch(kit); parts.forEach(g => b.add(bm, g)); backs.forEach(g => b.add(M('#2a3038'), g)); b.flush(root, false);
  }
  // car park: asphalt, painted bays, crowd barriers with an entrance gap and a barrier arm, parked cars
  {
    const asph = M('#62666e', { roughness: 0.95 }); zeminDetay(asph, { force: 0, ds: 0.7, ns: 0.8 });
    const ap = new T.Mesh(kit.geo(new T.PlaneGeometry(11.4, 17)), asph); ap.rotation.x = -Math.PI / 2; ap.position.set(398.2, 0.012, 23); ap.receiveShadow = true; root.add(ap);
    const b = boxBatch(kit), paint = M('#e9e6dc', { roughness: 0.8 });
    for (let i = 0; i <= 4; i++) { b.box(paint, 0.1, 0.01, 4.8, 393 + i * 2.5, 0.02, 29.0); if (i >= 2) b.box(paint, 0.1, 0.01, 4.8, 393 + i * 2.5, 0.02, 17.4); }
    b.box(paint, 10, 0.01, 0.1, 398, 0.02, 26.6); b.box(paint, 5, 0.01, 0.1, 400.5, 0.02, 19.8);
    for (const [x0, x1] of [[392.8, 397], [399.2, 403.6]]) { for (let x = x0; x < x1 - 0.1; x += 2.1) { const w = Math.min(2.1, x1 - x); b.box(steel, w, 0.05, 0.05, x + w / 2, 1.05, 14.2); b.box(steel, w, 0.05, 0.05, x + w / 2, 0.25, 14.2); for (let k = 1; k < 6; k++) b.box(steel, 0.025, 0.8, 0.025, x + k * w / 6, 0.65, 14.2); b.box(steel, 0.06, 1.1, 0.06, x, 0.55, 14.2); } }
    b.box(M('#d93a3a'), 0.3, 1.0, 0.3, 397.3, 0.5, 14.2); b.box(M('#f4f4f0'), 1.9, 0.08, 0.08, 398.2, 0.95, 14.2);
    for (const [x, z, ry, c] of CARS) {   // parked cars: body, cabin glass, roof, four tyres (local frame turned by ry)
      const body = M(c, { metalness: 0.5, roughness: 0.35 }), glassC = M('#1c2735', { metalness: 0.4, roughness: 0.15 }), tyre = M('#16171a');
      const part = (m: T.Material, g: T.BufferGeometry, lx: number, ly: number, lz: number) => { g.translate(lx, ly, lz); g.rotateY(ry); g.translate(x, 0, z); b.add(m, g); };
      part(body, new T.BoxGeometry(1.8, 0.62, 4.2), 0, 0.55, 0); part(glassC, new T.BoxGeometry(1.6, 0.55, 2.1), 0, 1.13, -0.2); part(body, new T.BoxGeometry(1.62, 0.08, 2.0), 0, 1.42, -0.2);
      for (const [lx, lz] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) { const g = new T.CylinderGeometry(0.33, 0.33, 0.22, 12); g.rotateZ(Math.PI / 2); part(tyre, g, lx, 0.33, lz); }
    }
    b.flush(root);
  }
  // trees: trunk + three canopy blobs, instanced
  {
    const trunkG = kit.geo(new T.CylinderGeometry(0.16, 0.24, 2.4, 7)); trunkG.translate(0, 1.2, 0);
    const leafG = kit.geo(new T.IcosahedronGeometry(1.3, 0));
    const tr = new T.InstancedMesh(trunkG, M('#5a3d26', { roughness: 0.9 }), TREES.length), lf = new T.InstancedMesh(leafG, M('#3f7a3a', { roughness: 0.85, flatShading: true }), TREES.length * 3);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), v = new T.Vector3(), sc = new T.Vector3(), c = new T.Color();
    TREES.forEach(([x, z], i) => {
      tr.setMatrixAt(i, m4.makeTranslation(x, 0, z));
      for (let k = 0; k < 3; k++) { const a = i * 2.1 + k * 2.09, s = 0.8 + ((i * 7 + k * 3) % 5) * 0.09; v.set(x + Math.cos(a) * 0.55, 3.0 + k * 0.45, z + Math.sin(a) * 0.55); q.setFromEuler(new T.Euler(a, a * 0.7, 0)); sc.set(s, s * 0.9, s); lf.setMatrixAt(i * 3 + k, m4.compose(v, q, sc)); lf.setColorAt(i * 3 + k, c.set(['#3f7a3a', '#4f8a3a', '#356b33'][(i + k) % 3])); }
    });
    tr.castShadow = true; lf.castShadow = true; root.add(tr, lf);
  }
  const staticSolids: Rect[] = [END_W, END_E, ...MASTS.filter(([, z]) => z < 32).map(([x, z]) => R(x, z, 1.0, 1.0)), ...CARS.map(([x, z]) => R(x, z, 2.0, 4.4)),
    { x0: 392.8, x1: 397.15, z0: 14.05, z1: 14.35 }, { x0: 399.2, x1: 403.6, z0: 14.05, z1: 14.35 }, ...TREES.filter(([, z]) => z < 32).map(([x, z]) => R(x, z, 0.6, 0.6))];

  // seats of every stand (prefab low stand too) in one list: crowd and bucket seats are rebuilt with the club colours
  const lowSeats: Seat[] = [];
  for (let r = 0; r < LOW_ROWS; r++) for (let c = 0; c < LOW_COLS; c++) lowSeats.push({ x: PITCH.x - (-13.5 + c * (27 / (LOW_COLS - 1))), y: 0.57 + r * 0.5, z: 30.25 + r * 1.0, rotY: Math.PI, col: c, row: r, stand: 3 });
  const allSeats: Seat[] = [...lowSeats, ...upper.seats, ...ends[0].seats, ...ends[1].seats];

  // ───────────── dynamic club parts, rebuilt when the club record or the gate changes ─────────────
  const dyn = new T.Group(); root.add(dyn);
  let dk: Kit | null = null, crowd: Crowd | null = null, flags: T.Mesh[] = [];
  let key = '#';
  const labGise = d.labels.label(), labOfis = d.labels.label();

  function build(t: Takim | null, doluluk: number) {
    dyn.clear(); dk?.dispose(); dk = createKit(); const k = dk, m = k.mat; flags = [];
    const c1 = t ? t.renk : '#7d8a99', c2 = t ? t.renk2 || '#f2c230' : '#c8ced6', arma = t ? t.arma || '🛡️' : '⚽', name = t ? t.ad : 'KULÜP KURMA OFİSİ';
    const b = boxBatch(k);
    // ---- club building (old footprint 8 x 5, two storeys, front +z)
    const o = new T.Group(); o.position.set(OFIS.x, 0, OFIS.z); dyn.add(o);
    const W = OFIS.w, D = OFIS.d, fz = D / 2, H1 = 3.3, H2 = 2.9;
    const wallC = t ? '#efe9dc' : '#c9c2b5', wall = m(wallC, { roughness: 0.85 }), stone = m('#9b958a', { roughness: 0.9 }), acc = m(c1, { roughness: 0.6 }), acc2 = m(c2, { roughness: 0.6 });
    const glass = m('#9ec3d8', { transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.2, depthWrite: false }), frame = m('#2a3038', { metalness: 0.5, roughness: 0.4 });
    const wood = m('#8a6242', { roughness: 0.7 }), floorM = m('#b48a5e', { roughness: 0.75 }), inner = m(t ? c1 : '#d9d4c7', { roughness: 0.8 });
    b.box(stone, W + 0.8, 0.25, D + 0.8, 0, 0.125, 0);
    // ground floor shell: back + sides solid, front = piers, glass shopfront, glass door, lintel band
    b.box(wall, W, H1, 0.2, 0, H1 / 2 + 0.25, -fz + 0.1); for (const sx of [-1, 1]) b.box(wall, 0.2, H1, D, sx * (W / 2 - 0.1), H1 / 2 + 0.25, 0);
    b.box(wall, 0.4, H1, 0.24, -W / 2 + 0.2, H1 / 2 + 0.25, fz - 0.12); b.box(wall, 0.5, H1, 0.24, 0.55, H1 / 2 + 0.25, fz - 0.12); b.box(wall, 1.0, H1, 0.24, W / 2 - 0.5, H1 / 2 + 0.25, fz - 0.12);
    b.box(acc, W + 0.1, 0.55, 0.3, 0, H1 - 0.05, fz - 0.1);                    // lintel band in club colour (sign sits on it)
    b.box(stone, 3.9, 0.45, 0.26, -1.95, 0.48, fz - 0.12);                      // stall riser under the shop window
    b.add(glass, (() => { const g = new T.BoxGeometry(3.9, 2.05, 0.04); g.translate(-1.95, 1.75, fz - 0.1); return g; })());
    for (const x of [-3.8, -1.95, -0.1]) b.box(frame, 0.07, 2.1, 0.08, x, 1.75, fz - 0.08); b.box(frame, 3.9, 0.07, 0.08, -1.95, 2.78, fz - 0.08);
    b.box(frame, 1.25, 2.35, 0.08, 1.45, 1.43, fz - 0.06); b.add(glass, (() => { const g = new T.BoxGeometry(1.05, 2.15, 0.04); g.translate(1.45, 1.43, fz - 0.03); return g; })());
    b.box(m('#c9a23a', { metalness: 0.8, roughness: 0.3 }), 0.05, 0.4, 0.06, 1.85, 1.3, fz + 0.03);
    b.box(acc2, 2.1, 0.12, 1.0, 1.45, 2.85, fz + 0.45); for (const sx of [-1, 1]) b.box(frame, 0.04, 0.04, 1.0, 1.45 + sx * 1.0, 2.75, fz + 0.45);   // door canopy
    // interior seen through the glass: floor, back wall in club colour, trophy cabinet with cups, desk and chairs, TV, plant, lamp
    b.box(floorM, W - 0.4, 0.05, D - 0.4, 0, 0.28, 0); b.box(inner, W - 0.5, H1 - 0.2, 0.04, 0, H1 / 2 + 0.3, -fz + 0.23);
    b.box(wood, 2.6, 1.9, 0.5, -2.3, 1.25, -fz + 0.5); b.add(glass, (() => { const g = new T.BoxGeometry(2.4, 1.6, 0.03); g.translate(-2.3, 1.35, -fz + 0.77); return g; })());
    for (const y of [0.85, 1.45]) b.box(m('#efe7d6'), 2.4, 0.04, 0.42, -2.3, y, -fz + 0.5);
    const gold = m('#d4a63a', { metalness: 0.9, roughness: 0.25 }), silver = m('#c9ced6', { metalness: 0.9, roughness: 0.25 });
    if (t) for (let i = 0; i < 5; i++) { const x = -3.3 + i * 0.5, y = i % 2 ? 1.47 : 0.87, mt = i === 2 ? gold : i % 2 ? silver : gold; b.cyl(mt, 0.05, 0.2, x, y + 0.12, -fz + 0.5, 8, 0.08); b.cyl(mt, 0.11, 0.14, x, y + 0.3, -fz + 0.5, 10, 0.06); b.box(wood, 0.16, 0.06, 0.16, x, y + 0.03, -fz + 0.5); }
    b.box(wood, 1.8, 0.08, 0.9, 1.2, 1.05, -0.4); for (const [x, z] of [[0.4, -0.8], [2.0, -0.8], [0.4, 0], [2.0, 0]]) b.box(frame, 0.06, 0.75, 0.06, x, 0.65, z);
    for (const x of [0.75, 1.65]) { b.box(m(c2), 0.45, 0.08, 0.45, x, 0.75, 0.3); b.box(m(c2), 0.45, 0.5, 0.06, x, 1.0, 0.52); b.box(frame, 0.05, 0.45, 0.05, x, 0.5, 0.3); }
    b.box(m('#2a3038'), 0.5, 0.35, 0.3, 1.2, 1.27, -0.6);   // desk screen
    b.cyl(m('#7a4a2a'), 0.22, 0.4, -3.3, 0.5, 1.6, 10, 0.17); const leaf = new T.IcosahedronGeometry(0.42, 0); leaf.translate(-3.3, 1.05, 1.6); b.add(m('#3f7a3a', { flatShading: true }), leaf);
    // upper storey: solid walls, three window bays (crest roundel in the middle), sills, cornice, parapet, roof units
    b.box(wall, W, H2, D, 0, H1 + 0.25 + H2 / 2, 0);
    b.box(acc2, W + 0.12, 0.14, D + 0.12, 0, H1 + 0.3, 0);
    for (const x of [-2.75, 2.75]) {
      b.box(frame, 1.7, 1.55, 0.06, x, H1 + 0.25 + 1.5, fz + 0.02); b.box(m('#ffe2a8', { emissive: '#ffcf7a', emissiveIntensity: 0.25, roughness: 0.5 }), 1.5, 1.35, 0.04, x, H1 + 0.25 + 1.5, fz + 0.04);
      b.box(frame, 0.05, 1.4, 0.07, x, H1 + 0.25 + 1.5, fz + 0.06); b.box(stone, 1.9, 0.1, 0.25, x, H1 + 0.25 + 0.68, fz + 0.1);
    }
    b.box(stone, W + 0.5, 0.3, D + 0.5, 0, H1 + H2 + 0.4, 0); b.box(wall, W + 0.3, 0.45, 0.15, 0, H1 + H2 + 0.75, fz + 0.1); b.box(wall, W + 0.3, 0.45, 0.15, 0, H1 + H2 + 0.75, -fz - 0.1);
    for (const sx of [-1, 1]) b.box(wall, 0.15, 0.45, D + 0.3, sx * (W / 2 + 0.08), H1 + H2 + 0.75, 0);
    b.box(m('#b9bec6', { metalness: 0.4, roughness: 0.5 }), 1.3, 0.8, 0.9, -2.2, H1 + H2 + 0.95, -0.8); b.box(m('#b9bec6', { metalness: 0.4, roughness: 0.5 }), 1.0, 0.7, 0.9, 1.6, H1 + H2 + 0.9, -1.0);
    b.box(m('#5d6672'), 1.2, 0.3, 1.2, 0.2, H1 + H2 + 0.7, 0.6);
    // flag poles beside the façade
    for (const sx of [-1, 1]) b.cyl(m('#cfd4da', { metalness: 0.7, roughness: 0.3 }), 0.06, 7.6, sx * (W / 2 + 0.7), 3.8, fz + 0.7, 8);
    b.flush(o);
    // sign, crest roundel, sponsor banners, poster (textured planes)
    const sign = new T.Mesh(k.geo(new T.PlaneGeometry(6.6, 1.0)), m('#ffffff', { map: plate(k, 6.6, 1.0, c1, c2, arma, name.toLocaleUpperCase('tr-TR')), roughness: 0.5, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 }));
    sign.position.set(-0.2, H1 + 0.55, fz + 0.06); o.add(sign);
    const crest = new T.Mesh(k.geo(new T.CircleGeometry(0.75, 28)), m('#ffffff', { map: k.canvas(128, 128, (g) => { g.fillStyle = c2; g.beginPath(); g.arc(64, 64, 63, 0, 7); g.fill(); g.fillStyle = c1; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.fill(); g.font = '68px system-ui,"Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(arma, 64, 70); }), roughness: 0.5 }));
    crest.position.set(0, H1 + 0.25 + 1.5, fz + 0.04); o.add(crest);
    const sponsor = (txt: string, sx: number) => { const p = new T.Mesh(k.geo(new T.PlaneGeometry(2.2, 2.4)), m('#ffffff', { map: k.canvas(220, 240, (g, w, h) => { const [bg, fg] = REKLAM_RENK[txt]; g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = '900 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h * 0.42, w * 0.9); g.font = '700 18px system-ui,sans-serif'; g.fillText(t ? 'RESMİ SPONSOR' : 'SPONSOR ARANIYOR', w / 2, h * 0.68, w * 0.9); }), roughness: 0.7 })); p.position.set(sx * (W / 2 + 0.02), H1 + 0.25 + H2 / 2, 0); p.rotation.y = sx * Math.PI / 2; o.add(p); };
    sponsor('MARTIKART', 1); sponsor('BOĞAZ GAZOZU', -1);
    if (!t) { const p = new T.Mesh(k.geo(new T.PlaneGeometry(1.6, 1.1)), m('#ffffff', { map: k.canvas(256, 176, (g, w, h) => { g.fillStyle = '#ffd23f'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a44'; g.font = '900 38px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KULÜBÜNÜ', w / 2, h * 0.32); g.fillText('KUR!', w / 2, h * 0.62); g.font = '700 20px system-ui,sans-serif'; g.fillText('100.000 ₺', w / 2, h * 0.86); }), roughness: 0.6 })); p.position.set(-1.95, 1.8, fz - 0.14); o.add(p); }
    else { const sc = new T.Mesh(k.geo(new T.PlaneGeometry(0.4, 1.2)), m('#ffffff', { map: k.canvas(32, 96, (g) => { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(0, i * 16, 32, 16); } }), side: T.DoubleSide, roughness: 0.8 })); sc.position.set(0.55, 1.6, fz + 0.01); o.add(sc); }   // club scarf hung on the pier
    const jersey = new T.Mesh(k.geo(new T.PlaneGeometry(0.9, 0.95)), m('#ffffff', { map: k.canvas(128, 136, (g) => { g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 128, 136); g.fillStyle = c1; g.beginPath(); g.moveTo(30, 18); g.lineTo(98, 18); g.lineTo(122, 42); g.lineTo(106, 58); g.lineTo(96, 50); g.lineTo(96, 124); g.lineTo(32, 124); g.lineTo(32, 50); g.lineTo(22, 58); g.lineTo(6, 42); g.closePath(); g.fill(); g.fillStyle = c2; g.font = '900 40px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText('10', 64, 92); }), roughness: 0.6 }));
    jersey.position.set(1.2, 2.2, -fz + 0.26); o.add(jersey);
    const lamp = new T.Mesh(k.geo(new T.BoxGeometry(1.6, 0.06, 0.3)), m('#fff1d0', { emissive: '#ffe2a8', emissiveIntensity: 0.9 })); lamp.position.set(0, H1 + 0.15, 0); o.add(lamp);
    for (const sx of [-1, 1]) { const fl = new T.Mesh(k.geo(new T.PlaneGeometry(1.5, 0.95, 6, 1)), m(t ? (sx < 0 ? c1 : c2) : '#e9ecef', { side: T.DoubleSide, roughness: 0.8 })); fl.position.set(sx * (W / 2 + 0.7) + 0.78, 7.1, fz + 0.7); o.add(fl); flags.push(fl); }
    // ---- ticket booth
    const bt = new T.Group(); bt.position.set(GISE.x, 0, GISE.z); dyn.add(bt);
    const bb = boxBatch(k);
    bb.box(stone, GISE.w + 0.4, 0.15, GISE.d + 0.4, 0, 0.08, 0); bb.box(m('#f1ece0'), GISE.w, 2.4, GISE.d, 0, 1.35, 0); bb.box(acc, GISE.w + 0.3, 0.2, GISE.d + 0.3, 0, 2.65, 0);
    bb.add(glass, (() => { const g = new T.BoxGeometry(1.6, 0.9, 0.06); g.translate(0, 1.7, GISE.d / 2 + 0.03); return g; })()); bb.box(wood, 1.9, 0.12, 0.45, 0, 1.15, GISE.d / 2 + 0.25);
    for (let i = 0; i < 8; i++) { const g = new T.BoxGeometry(0.4, 0.12, 1.6); g.rotateX(0.35); g.translate(-1.4 + i * 0.4, 2.35, GISE.d / 2 + 0.5); bb.add(i % 2 ? acc : m('#fbfaf6'), g); }
    for (const sx of [-0.9, 0, 0.9]) bb.box(m('#c9a23a', { metalness: 0.7, roughness: 0.3 }), 0.08, 0.9, 0.08, sx, 0.45, GISE.d / 2 + 1.7);
    bb.box(m('#a02a2a'), 1.9, 0.05, 0.05, 0, 0.85, GISE.d / 2 + 1.7);
    bb.flush(bt);
    const bs = new T.Mesh(k.geo(new T.PlaneGeometry(2.6, 0.5)), m('#ffffff', { map: plate(k, 2.6, 0.5, '#101c3a', '#16284c', '🎟️', 'BİLET'), roughness: 0.5 })); bs.position.set(0, 3.1, GISE.d / 2 + 0.16); bt.add(bs);
    // ---- banners hung on the stand rails (prefab low stand front rail and upper tier rail), tifo on the upper back wall
    const hang = (txt: string, a: string, bcol: string, w: number, x: number, y: number, z: number, ry: number) => { const p = new T.Mesh(k.geo(new T.PlaneGeometry(w, w * 0.22)), m('#ffffff', { map: flagaDoku(k, a, bcol, txt), side: T.DoubleSide, roughness: 0.85 })); p.position.set(x, y, z); p.rotation.y = ry; dyn.add(p); };
    hang(name.toLocaleUpperCase('tr-TR'), c1, c2, 8, PITCH.x - 6, 3.25, 34.5, Math.PI); hang(t ? 'HEP SENİNLE' : 'MARTIKÖY', c2, c1, 6, PITCH.x + 7, 3.25, 34.5, Math.PI);
    hang(t ? name.toLocaleUpperCase('tr-TR') : 'HALI SAHA', c1, c2, 5, 410.05, 0.75, 20.5, Math.PI / 2); hang(t ? arma + ' ' + name.toLocaleUpperCase('tr-TR') : 'STADYUM', c2, c1, 5, 441.95, 0.75, 20.5, -Math.PI / 2);
    hang('⚽ ' + name.toLocaleUpperCase('tr-TR') + ' ⚽', c1, c2, 16, PITCH.x, upper.top + 0.9, 34.55 + upper.back + 0.36, 0);
    // ---- bucket seats + crowd in club colours
    let rs = 3; const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
    const kitC: [string, string] = [c1, c2];
    buildSeats(k, dyn, allSeats, (s) => s.stand === 3 ? (s.row % 2 ? c2 : c1) : s.stand === 0 ? (s.row % 3 === 2 ? '#e9ecef' : c1) : c1);
    const fans: FanSeat[] = allSeats.map(s => { const home = !!t && rnd() < 0.8; return { ...s, team: home ? 0 : 2, shirt: home ? (s.stand === 1 ? ((s.row >> 1) % 2 ? c2 : c1) : formaRengi(kitC, rnd())) : ['#d8d2c4', '#5d6b7a', '#2b2d33', '#8aa0b8', '#b88a6a'][Math.floor(rnd() * 5)], acc: home ? kitC[rnd() < 0.5 ? 1 : 0] : '#c9c0b0' }; });
    crowd = createCrowd(k, dyn, fans, { seed: 9 });
    crowd.setFill((t ? Math.max(0.25, doluluk) : 0.08) * (lo ? 0.5 : 1));
    d.setSolid?.([R(OFIS.x, OFIS.z, OFIS.w, OFIS.d), R(GISE.x, GISE.z, GISE.w, GISE.d), ...staticSolids]);
  }
  const put = (lb: ReturnType<HtmlLabels['label']>, x: number, y: number, z: number, html: string) => { at.x = x; at.y = y; at.z = z; if (d.project(at, tmp)) lb.set(tmp.x, tmp.y, html, 'say'); else lb.hide(); };
  let tt = 0, chant = 0, chantT = 6, roofOp = 1;
  const crowdIn = { heat: 0, cheer: [0, 0] as [number, number] };

  return {
    update(dt) {
      const h = d.hero(), near = h.x > 380 && h.x < 465; root.visible = near;
      if (!near) { labGise.hide(); labOfis.hide(); return; }
      tt += dt;
      const rl = d.rules(), api = rl ? mulkApi(rl) : null, md = api ? api.model() as unknown as { takim: Takim | null; stad: { fiyat: number; tahmin: number; doluluk: number } | null } : null;
      const t = md?.takim ?? null, dol = md?.stad ? (md.stad.doluluk || md.stad.tahmin) : 0;
      const k = t ? [t.ad, t.renk, t.renk2, t.arma, Math.round(dol * 20)].join('|') : 'yok';
      if (k !== key) { key = k; build(t, dol); }
      // crowd: seated murmur with a chant every half minute or so (scarves up, a few stand), all on the GPU
      chantT -= dt; if (chantT <= 0) { chant = 1; chantT = 22 + (tt * 7.3 % 14); }
      chant = Math.max(0, chant - dt * 0.3);
      crowdIn.heat = t ? 0.22 : 0.08; crowdIn.cheer[0] = t ? Math.min(1, chant * 1.1) : 0; crowd?.update(dt, crowdIn);
      if (!lo) for (const fl of flags) { const p = fl.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.75; p.setZ(i, Math.sin(tt * 4 + x * 3 + fl.position.x) * 0.12 * x); } p.needsUpdate = true; }
      // upper-tier roof fades while Sabri walks north of the pitch (the camera looks over it from the north side)
      const op = h.z > 22 ? 0.15 : 1; if (Math.abs(op - roofOp) > 0.01) { roofOp += (op - roofOp) * Math.min(1, dt * 4); for (const mt of roofMats) { (mt as T.MeshStandardMaterial).opacity = roofOp; mt.depthWrite = roofOp > 0.95; } }
      const st = md?.stad;
      if (Math.hypot(h.x - GISE.x, h.z - GISE.z) < 24) put(labGise, GISE.x, 4.2, GISE.z + 1, st ? '🎟️ BİLET ' + st.fiyat.toLocaleString('tr') + ' ₺ · doluluk %' + Math.round(st.tahmin * 100) : '🎟️ Bilet gişesi (önce kulüp kur)'); else labGise.hide();
      if (Math.hypot(h.x - OFIS.x, h.z - OFIS.z) < 24) put(labOfis, OFIS.x, 8.2, OFIS.z + OFIS.d / 2 + 0.6, t ? esc((t.arma || '🛡️') + ' ' + t.ad) + ' · Kulüp Binası' : '🛡️ Kulüp kurma ofisi'); else labOfis.hide();
    },
    dispose() { root.removeFromParent(); dk?.dispose(); kit.dispose(); labGise.hide(); labOfis.hide(); },
  };
}
