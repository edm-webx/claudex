/**
 * İskele prefab defs (v2 world.js ported as prefabs). Each `build` returns the same meshes, names and materials as
 * v2 `build()` assembled them, so the scene graph names match v2 (parity masks use them).
 * Prefabs:
 *   iskele.sea, iskele.skyline, iskele.boats, iskele.pier (deck, pier, promenade, pierFar, pierBulbs, lampGlow),
 *   iskele.kiosk {stage, renewed csv, sign, font} (kiosk meshes + sign + floresan + floPool + shutter + bunting),
 *   iskele.station {kind, tier, stage}, iskele.table {style, tavla}, iskele.decor {id}, iskele.ferry, iskele.ferryFar,
 *   iskele.tabure / iskele.tabure-kucuk (parts-based stools, editable; were inside the v2 kiosk batch).
 * Dynamic bits (sign night glow, floresan flicker, bunting wave, shutter, meat/spin, ferry docking) are animated by
 * the world view (src/game/view/world), which finds them by name inside the placed instance.
 * Colliders are pure-ish functions (collidersFor) so zones bake walk grids without building meshes.
 */
import * as T from 'three';
import type { MotorPrefabDef, MotorPrefabSystem, Params } from '../../../engine/prefab';
import { Batch, col, geoc, HP } from '../../../engine/prefab/batch';
import type { Rect } from '../../../engine/api';
import { ensureKit, MAT, R, K, radialTex, tileNewTex, tileWornTex } from '../common/v2kit';
import { UG } from '../../ustgecit';
import { PIER, WALKABLE, staticObstacles, stageLayout, PARTS, type Obstacle } from './layout';
import { makeSea, makeSeaMask, makeSkyline, makeBoats } from './scenery';
import { buildPier, LAMPS } from './pier';
import { buildKiosk, jobBoardInto, drawSign } from './kiosk';
import { stationBuilt, meatGeo, spinGeo, tableBuilt, decorBuild, makeFerryMesh, FOOT, DECOR_SIZE } from './props';
import { rectAABB } from './layout';

export const ISKELE_BOUNDS: Rect = { x0: -62, z0: -19, x1: 62, z1: 59 };

/** Pilings of the pier (same loops as buildPier), for the sea foam mask without building the pier. */
export function pilingList(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (let z = PIER.z0 + 0.3; z <= PIER.z1 - 0.5; z += 2.6) { out.push({ x: PIER.x0 + 0.1, z }); out.push({ x: PIER.x1 - 0.1, z }); }
  for (let x = PIER.x0 + 2.7; x < PIER.x1 - 1; x += 2.6) out.push({ x, z: PIER.z0 + 0.1 });
  return out;
}

/** Water and park (everything inside the zone bounds but outside the v2 walkable rects) as colliders. */
export function waterColliders(): Rect[] {
  const b = ISKELE_BOUNDS, p = WALKABLE[0], pr = WALKABLE[1];
  return [
    { x0: b.x0, x1: p.x0, z0: b.z0, z1: pr.z0 },
    { x0: p.x1, x1: b.x1, z0: b.z0, z1: pr.z0 },
    { x0: p.x0, x1: p.x1, z0: b.z0, z1: p.z0 },
    // the 6-lane road: closed everywhere except the footbridge corridor
    { x0: b.x0, x1: UG.x - UG.hw, z0: pr.z1, z1: 28.4 },
    { x0: UG.x + UG.hw, x1: b.x1, z0: pr.z1, z1: 28.4 },
  ];
}

const own = <M extends T.Object3D>(m: M): M => { m.userData.own = true; return m; };

/** v2 glowSet: ground glow pools (MAT.glow) + point halos (MAT.halo). list: {x,y,z,r?,s?,c?,hc?} */
export function glowSet(list: { x: number; y: number; z: number; r?: number; s?: number; c?: string; hc?: string }[], name: string): T.Group {
  ensureKit();
  const g = new T.Group(); g.name = name;
  const b = new Batch(); list.forEach(l => { if (l.r) b.plane(l.r * 2, l.r * 2, l.c || '#ffc46e', l.x, 0.025, l.z, { rx: -HP, uv: [0, 0, 1, 1] }); });
  if (!b.empty) { const m = own(b.mesh(MAT.glow, false, false)); m.renderOrder = 3; g.add(m); }
  if (list.length) {
    const pos: number[] = [], cc: number[] = []; list.forEach(l => { pos.push(l.x, l.y, l.z); const c = col(l.hc || '#ffd890'), k = l.s || 1; cc.push(c.r * k, c.g * k, c.b * k); });
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); pg.setAttribute('color', new T.Float32BufferAttribute(cc, 3));
    const p = own(new T.Points(pg, MAT.halo)); p.renderOrder = 4; g.add(p);
  }
  return g;
}

/** Parses the renewed param: csv string of PARTS ('kepenk,tabela'), array or object. */
export function renewedMap(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : v && typeof v === 'object' ? Object.keys(v).filter(k => (v as Record<string, unknown>)[k]) : [];
  list.forEach(p => { const k = String(p).trim(); if (PARTS.includes(k)) out[k] = true; });
  return out;
}

const kioskObCache = new Map<string, Obstacle[]>();
/** Kiosk obstacles for a stage (computed with the geometry builder; geometry discarded, result cached). */
export function kioskObstacles(stage: number, renewed: string): Obstacle[] {
  const key = stage + '|' + renewed;
  let o = kioskObCache.get(key);
  if (!o) {
    const kb = buildKiosk(stage, renewedMap(renewed));
    const jb = stageLayout(stage).job.board;
    // colliders are the drawn wall boxes as they are: the zone bake blocks the cell row under any wall thinner than a
    // cell, and the player collides with these exact rects (nav solids), so no padding is needed
    o = kb.K2.obstacles.map((r: Obstacle) => ({ ...r })).concat([rectAABB(jb[0], jb[1], 1.75, 0.3, jb[2], 'job')]);
    kioskObCache.set(key, o!);
  }
  return o!.map(r => ({ ...r }));
}

function buildKioskObject(params: Params): T.Group {
  ensureKit();
  const stage = Math.max(1, Math.min(5, Math.round(+params.stage || 1)));
  const renewed = renewedMap(params.renewed);
  const root = new T.Group(); root.name = 'kiosk'; root.userData.parity = 'kiosk';
  const kb = buildKiosk(stage, renewed);
  const K2 = kb.K2;
  const layout = stageLayout(stage);
  const jb = layout.job.board; jobBoardInto(kb.A, jb[0], jb[1], jb[2]);
  const f = K2.flo;
  if (f.hang) [-0.42, 0.42].forEach(k => kb.A.cyl(0.006, 0.006, f.hang + 0.08, '#4a4a4a', f.x + k * f.len, f.y + (f.hang + 0.08) / 2, f.z, { seg: 3 }));
  const add = (b: Batch, mat: T.Material, cast: boolean, recv: boolean, name: string) => { if (b.empty) return null; const m = own(b.mesh(mat, cast, recv)); m.name = name; root.add(m); return m; };
  // fayans: v2 swaps MAT.tile.map globally; here the kiosk gets its own tile material so stages don't fight
  const tileMat = MAT.tile.clone(); tileMat.map = renewed.fayans ? tileNewTex : tileWornTex;
  add(kb.A, MAT.atlas, true, true, 'kioskBody'); { const rf = add(kb.RF, MAT.atlas.clone(), true, true, 'kioskRoof'); if (rf) { (rf.material as T.Material).transparent = true; rf.userData.roof = true; } } add(kb.TL, tileMat, false, true, 'kioskTiles'); add(kb.FL, MAT.floor, false, true, 'kioskFloor'); add(kb.ST, MAT.stone, false, true, 'gardenFloor');
  add(kb.BU, MAT.bulb, false, false, 'kioskBulbs'); const gl = add(kb.GL, MAT.glass, false, false, 'kioskGlass'); if (gl) gl.renderOrder = 6;
  // sign
  const worn = !renewed.tabela;
  const text = String(params.sign || 'Sabri\'nin Büfesi'), font = params.font != null ? params.font : 'vapur';
  const signMat = new T.MeshLambertMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0 });
  signMat.map = drawSign(text, font, worn, stage, false); signMat.emissiveMap = drawSign(text, font, worn, stage, true);
  const sp = K2.sign;
  const signMesh = new T.Mesh(new T.PlaneGeometry(1, 1), signMat); signMesh.name = 'sign';
  signMesh.position.set(sp.x, sp.y, sp.z); signMesh.rotation.set(0, sp.ry, 0); signMesh.scale.set(sp.w, sp.h, 1);
  root.add(signMesh);
  // floresan + its pool
  const floMesh = new T.Mesh(geoc('floTube', () => new T.CapsuleGeometry(0.035, 1, 3, 8).rotateZ(HP)), new T.MeshBasicMaterial({ color: '#c8cdd2' })); floMesh.name = 'floresan';
  floMesh.position.set(f.x, f.y, f.z); floMesh.scale.set(f.len, 1, 1); root.add(floMesh);
  const floPool = new T.Mesh(geoc('unitFloor', () => new T.PlaneGeometry(1, 1).rotateX(-HP)), new T.MeshBasicMaterial({ map: radialTex, color: '#d6f0ff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
  floPool.renderOrder = 3; floPool.name = 'floPool'; floPool.position.set(K2.pool.x, 0.03, K2.pool.z); floPool.scale.set(K2.pool.r * 2, 1, K2.pool.r * 2); root.add(floPool);
  // shutter (ferry window); view animates scale.y
  const shutterG = new T.Group(); shutterG.name = 'shutter'; root.add(shutterG);
  const sh = K2.shutter;
  if (!sh) shutterG.visible = false;
  else {
    const wornK = !renewed.kepenk, b = new Batch(), h = sh.y1 - sh.y0, c = wornK ? '#ffffff' : K.red, uv = wornK ? R.kepenkWorn : R.kepenkNew;
    if (sh.kind === 'wall') { b.box(0.035, h, sh.z1 - sh.z0, c, 0, -h / 2, 0, { r: 0, uv }); b.box(0.06, 0.06, sh.z1 - sh.z0, wornK ? '#5e4a3e' : '#9c2f22', 0.01, -h + 0.03, 0, { r: 0.015 }); shutterG.position.set(sh.x, sh.y1, (sh.z0 + sh.z1) / 2); shutterG.rotation.y = 0; }
    else { b.box(sh.w, h, 0.035, c, 0, -h / 2, sh.off, { r: 0, uv }); b.box(sh.w, 0.06, 0.06, wornK ? '#5e4a3e' : '#9c2f22', 0, -h + 0.03, sh.off + 0.01, { r: 0.015 }); shutterG.position.set(sh.x, sh.y1, sh.z); shutterG.rotation.y = sh.rotY; }
    shutterG.add(own(b.mesh(MAT.atlas, true, true)));
  }
  // bunting (fresh paint); view animates the triangles
  const bt = K2.bunting;
  if (bt) {
    const n = 20, cols = [K.red, K.yellow, K.cini, '#fff6e6', K.pink, '#2f6fdb'];
    const pos = new Float32Array(n * 9), nor = new Float32Array(n * 9), cc = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) { const c = col(cols[i % cols.length]); for (let k = 0; k < 3; k++) { cc.set([c.r, c.g, c.b], i * 9 + k * 3); nor.set([0, 0, 1], i * 9 + k * 3); } }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('color', new T.BufferAttribute(cc, 3));
    const bunting = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }));
    bunting.userData = { n, bt: { ...bt } }; bunting.frustumCulled = false; bunting.name = 'bunting'; root.add(bunting);
    animBunting(bunting, 0);
  }
  // kiosk night lights (glow pools + halos)
  const lamps = K2.lamps.map((l: { x: number; y: number; z: number; r?: number; s?: number }) => ({ x: l.x, y: l.y, z: l.z, r: l.r || 0, s: l.s != null ? l.s : 0.5 }));
  if (lamps.length) { const gs = glowSet(lamps, 'kioskGlow'); gs.visible = false; gs.userData.night = true; root.add(gs); }
  root.userData.k2 = { flo: f, sign: K2.sign, pool: K2.pool, shutter: sh || null, bunting: bt || null, stage, renewed: Object.keys(renewed) };
  return root;
}

/** v2 animBunting (per frame). */
export function animBunting(bunting: T.Mesh, t: number): void {
  const { n, bt } = bunting.userData as { n: number; bt: { x0: number; x1: number; y: number; z: number } };
  const P = bunting.geometry.attributes.position as T.BufferAttribute, a = P.array as Float32Array, w = (bt.x1 - bt.x0) / n, PI = Math.PI;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 0.85) / n, um = (u0 + u1) / 2;
    const ya = bt.y - Math.sin(u0 * PI) * 0.2, yb = bt.y - Math.sin(u1 * PI) * 0.2, ym = bt.y - Math.sin(um * PI) * 0.2;
    const sw = Math.sin(t * 0.9 + i * 0.5) * 0.03, o = i * 9;
    a[o] = bt.x0 + u0 * n * w; a[o + 1] = ya; a[o + 2] = bt.z;
    a[o + 3] = bt.x0 + u1 * n * w; a[o + 4] = yb; a[o + 5] = bt.z;
    a[o + 6] = bt.x0 + um * n * w; a[o + 7] = ym - 0.2 + sw * 0.5; a[o + 8] = bt.z + sw;
  }
  P.needsUpdate = true;
}

const stoolParts = (seatR: number, seatR2: number, seatH: number, legOff: number): MotorPrefabDef['parts'] => [
  { shape: 'cyl', size: [seatR, seatH, seatR2], pos: [0, 0.45, 0], color: '#c9a05a', mat: 'atlas#hasir', segments: 10, name: 'seat' },
  ...[0, 1, 2, 3].map(k => ({ shape: 'cyl' as const, size: [0.02, 0.43, 0.02] as [number, number, number], pos: [Math.cos(k * HP + 0.7) * legOff, 0.21, Math.sin(k * HP + 0.7) * legOff] as [number, number, number], color: '#5a3d28', segments: 4, name: 'leg' + k })),
];

export const ISKELE_PREFABS: MotorPrefabDef[] = [
  { id: 'iskele.sea', parts: [], build: () => { ensureKit(); const m = makeSea(makeSeaMask(pilingList())); m.userData.parity = 'sea'; return m; } },
  { id: 'iskele.skyline', parts: [], build: () => {
    ensureKit(); const g = new T.Group(); g.name = 'skylineRoot'; g.userData.parity = 'dyn';
    const SK = makeSkyline(); g.add(SK.sky, SK.win, SK.clouds); return g;
  } },
  { id: 'iskele.boats', parts: [], build: () => { ensureKit(); const b = makeBoats(); b.group.userData.parity = 'dyn'; b.kayik.name = 'kayik'; b.sail.name = 'sail'; b.buoys.forEach((m: T.Object3D) => { m.name = 'buoy'; }); return b.group; } },
  { id: 'iskele.pier', parts: [], collidersFor: () => staticObstacles().map(o => ({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 })).concat(waterColliders()),
    build: () => {
      ensureKit();
      const PB = buildPier();
      const g = new T.Group(); g.name = 'pierRoot'; g.userData.parity = 'deck';
      const pierA = own(PB.A.mesh(MAT.atlas, true, true)); pierA.name = 'pier';
      const deck = own(PB.P.mesh(MAT.plank, false, true)); deck.name = 'deck';
      const prom = own(PB.S.mesh(MAT.stone, false, true)); prom.name = 'promenade';
      const pierFar = own(PB.F.mesh(MAT.atlas, false, true)); pierFar.name = 'pierFar';
      const pierBulbs = own(PB.BU.mesh(MAT.bulb, false, false)); pierBulbs.name = 'pierBulbs';
      g.add(pierA, pierFar, deck, prom, pierBulbs);
      const glow = glowSet(LAMPS.map((l: { x: number; y: number; z: number }) => ({ x: l.x, y: l.y, z: l.z, r: 2.6 })), 'lampGlow'); glow.visible = false; glow.userData.night = true; g.add(glow);
      return g;
    } },
  { id: 'iskele.kiosk', params: { stage: 1, renewed: '', sign: 'Sabri\'nin Büfesi', font: 'vapur' }, parts: [],
    collidersFor: p => kioskObstacles(Math.round(+p.stage || 1), String(p.renewed || '')).map(o => ({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 })),
    build: p => buildKioskObject(p) },
  { id: 'iskele.station', params: { kind: 'doner', tier: 1, stage: 1 }, parts: [],
    collidersFor: p => { const S = stationBuilt(String(p.kind), +p.tier || 1, +p.stage || 1); return [{ x0: -S.w / 2, x1: S.w / 2, z0: -S.d / 2, z1: S.d / 2 }]; },
    build: p => {
      ensureKit();
      const tier = Math.max(1, Math.min(4, Math.round(+p.tier || 1)));
      const S = stationBuilt(String(p.kind), tier, Math.round(+p.stage || 1));
      const g = new T.Group(); g.name = 'station-' + p.kind; g.userData.parity = 'kiosk';
      const a = new T.Mesh(S.a, MAT.atlas); a.castShadow = a.receiveShadow = true; a.name = 'stationsBody'; g.add(a);
      if (S.tl) { const tl = new T.Mesh(S.tl, MAT.tile); tl.receiveShadow = true; tl.name = 'stationsTiles'; g.add(tl); }
      if (S.meat) { const m = new T.Mesh(meatGeo(tier), MAT.atlas); m.position.set(S.meat.x, S.meat.y, S.meat.z); m.scale.setScalar(S.meat.s); m.castShadow = true; m.name = 'meat'; g.add(m); }
      if (S.spin) { const m = new T.Mesh(spinGeo(S.spin.kind), MAT.atlas); m.position.set(S.spin.x, S.spin.y, S.spin.z); m.userData.y0 = S.spin.y; m.userData.kind = S.spin.kind; m.name = 'spin-' + S.spin.kind; g.add(m); }
      g.userData.steam = S.steam.map((v: T.Vector3) => [v.x, v.y, v.z]);
      g.userData.out = [S.out.x, S.out.y, S.out.z]; g.userData.w = S.w; g.userData.d = S.d;
      return g;
    } },
  { id: 'iskele.table', params: { style: 1, tavla: false }, parts: [],
    collidersFor: p => { const w = +p.style === 1 ? 0.78 : 0.9; return [{ x0: -w / 2, x1: w / 2, z0: -w / 2, z1: w / 2 }]; },
    build: p => { ensureKit(); const TB = tableBuilt(+p.style || 1, !!p.tavla); const m = new T.Mesh(TB.geo, MAT.atlas); m.castShadow = m.receiveShadow = true; m.name = 'tablesMesh'; m.userData.top = TB.top; return m; } },
  { id: 'iskele.decor', params: { id: 'saksi_sardunya' }, parts: [],
    collidersFor: p => { const f = (FOOT as Record<string, number>)[DECOR_SIZE[String(p.id)] || 'm'] * 0.85; return [{ x0: -f / 2, x1: f / 2, z0: -f / 2, z1: f / 2 }]; },
    build: p => {
      ensureKit();
      const d = decorBuild(String(p.id), p.paint ? String(p.paint) : undefined), g = new T.Group(); g.name = 'decor-' + p.id;
      const m = new T.Mesh(d.geo, MAT.atlas); m.castShadow = true; m.receiveShadow = true; m.name = 'decorBody'; g.add(m);
      if (d.bulbs) { const bm = new T.Mesh(d.bulbs, MAT.bulb); bm.name = 'decorBulbs'; g.add(bm); }
      g.userData.size = d.size; g.userData.light = d.info.light ? [d.info.light.x, d.info.light.y, d.info.light.z] : null; g.userData.pool = !!d.info.pool;
      return g;
    } },
  { id: 'iskele.ferry', parts: [], build: () => {
    ensureKit();
    const f = makeFerryMesh(1); f.name = 'ferry'; f.userData.parity = 'dyn';
    const gw = new Batch();
    gw.box(0.8, 0.05, 1.2, '#b98a5e', -0.4, 0, 0, { r: 0.01, uv: R.grain });
    [-0.58, 0.58].forEach(z => { gw.box(0.8, 0.035, 0.035, '#fbfaf6', -0.4, 0.55, z, { r: 0 }); [-0.05, -0.75].forEach(x => gw.box(0.035, 0.55, 0.035, '#fbfaf6', x, 0.27, z, { r: 0 })); });
    const gangway = own(gw.mesh(MAT.atlas, true, true)); gangway.name = 'gangway'; gangway.position.set(-2.15, 1.07, 0); gangway.rotation.z = -HP; f.add(gangway);
    f.children[1].name = 'ferryGlow';
    return f;
  } },
  { id: 'iskele.ferryFar', parts: [], build: () => { ensureKit(); const f = makeFerryMesh(0.85); f.name = 'ferryFar'; f.userData.parity = 'dyn'; f.children[1].name = 'ferryGlow'; return f; } },
  // editable stools (parts): v2 stage-2 door stool and stage-1 counter stool
  { id: 'iskele.tabure', parts: stoolParts(0.2, 0.18, 0.06, 0.13) },
  { id: 'iskele.tabure-kucuk', parts: stoolParts(0.19, 0.18, 0.05, 0.12) },
];

/** Registers the shared v2 materials/atlas with a prefab system and defines every iskele prefab. */
export function defineIskelePrefabs(prefab: MotorPrefabSystem): void {
  const lazy = <M extends T.Material>(get: () => M) => () => { ensureKit(); return get(); };
  prefab.registerMaterial('atlas', lazy(() => MAT.atlas));
  prefab.registerMaterial('plank', lazy(() => MAT.plank));
  prefab.registerMaterial('stone', lazy(() => MAT.stone));
  prefab.registerMaterial('tile', lazy(() => MAT.tile));
  prefab.registerMaterial('floor', lazy(() => MAT.floor));
  prefab.registerMaterial('bulb', lazy(() => MAT.bulb));
  prefab.registerMaterial('glass', lazy(() => MAT.glass));
  prefab.registerMaterial('glow', lazy(() => MAT.glow));
  prefab.registerRegions(name => { ensureKit(); return R[name]; });
  ISKELE_PREFABS.forEach(d => { if (!prefab.has(d.id)) prefab.define(d); });
}
