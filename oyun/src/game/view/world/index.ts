/**
 * Pier world view (v2 world.js build() runtime half): reads GameState and drives the iskele zone's prefab instances.
 * - Setup: defines the iskele + grey-box prefabs, registers the iskele and test-sokak zones and builds the pier at
 *   once (zones.flush at the player start) so boot can add walk grids right after createWorldView.
 * - Stage / renewed parts / sign: kiosk placement overrides (template-cached per combination); the zone def is kept
 *   in sync so streaming back in rebuilds the current kiosk. Stools: tabure-s1 shows at stage 1, tabure-s2 from 2.
 * - Stations, tables and decor are view-owned placements under the iskele zone root (re-placed whenever the zone is
 *   built again); their colliders go to zones.setColliders('iskele', 'dyn', ...) which re-bakes the walk grid.
 * - Anchors: v2 W.anchors flattened into the zone anchors ('queue.0', 'counter.standAt', 'stations.cay.standAt',
 *   'tables.2.seat.1', 'ferryWindow.queue.0', 'pads.masa1', 'catSpots.awning', 'gullPerches.3', 'decorSlots.0', ...).
 * - Animation (v2 W.update): sea time, docking ferry (auto cycle: arrives 40 s after leaving unless `ferry.auto` is
 *   false), far ferry, boats, clouds, meat/spin, steam, floresan flicker, bunting, shutter, sparkles, markers.
 * - Night (v2 applyNight) and sea colours follow render.onTime; skyline culling follows render.horizon.
 * Never writes sim state.
 */
import * as T from 'three';
import type { GameView, RenderPipeline, ZoneManager, PrefabSystem, Dress, Vec2, AnchorDef, Rect, PrefabInstance, ZoneDef } from '../../../engine/api';
import type { GameState } from '../../sim/schema';
import type { MotorPrefabSystem } from '../../../engine/prefab';
import type { MotorZones } from '../../../engine/zones';
import type { MotorRender, Tod } from '../../../engine/render';
import { defineIskelePrefabs, animBunting, glowSet } from '../../../content/prefabs/iskele';
import { GREYBOX_PREFABS } from '../../../content/prefabs/common/greybox';
import { carsiPrefabs } from '../../../content/carsi/street';
import { iskeleZone, ISKELE_PLAYER_START } from '../../../content/zones/iskele';
import { testSokakZone } from '../../../content/zones/test-sokak';
import { registerDisariZones } from '../../../content/zones/disari';
import { stageLayout, STATION_KINDS, PARTS, TABLE_PADS, PAD_KEYS_FALLBACK, SEAT_H, WATER_Y, local2world, rectAABB, benchSeats, BENCHES, type StageLayout, type P3v, type Obstacle, staticObstacles } from '../../../content/prefabs/iskele/layout';
import { paintKey } from '../../../content/dekor-katalog';
import { stationBuilt, tableBuilt, decorBuild, itemGeo, ITEM_HT, moneyGeo, makeMarker, MARKERS, bez, FOOT, DECOR_SIZE } from '../../../content/prefabs/iskele/props';
import { restoranApi } from '../../sim/restoran';
import { createRtView, type RtView } from './rtview';
import type { Rules } from '../../sim/state';
import { partPos } from '../../../content/prefabs/iskele/kiosk';
import { BUFE } from '../../../content/prefabs/iskele/layout';
import { ensureKit, MAT, radialTex } from '../../../content/prefabs/common/v2kit';
import { mixc, col, clamp, lerp, easeInOut, HP, PI, TAU } from '../../../engine/prefab/batch';

export interface WorldViewDeps { render: RenderPipeline; zones: ZoneManager; prefab: PrefabSystem; dress: Dress; }
export type FerryState = 'away' | 'arriving' | 'docked' | 'leaving';
export interface WorldView extends GameView {
  readonly stage: number;
  /** Bind the sim rules (rules.rt drives ferry, window, items, pads, dwell ring). `pose` = interpolated hero pose. */
  bindRules(get: (() => Rules | null) | null, pose?: () => { x: number; z: number; rot: number } | null): void;
  readonly renewed: string[];
  setStage(n: number, renewed?: readonly string[]): void;
  renew(part: string, on?: boolean): boolean;
  setSign(text?: string | null, font?: string | null): void;
  setStation(kind: string, o: { visible?: boolean; tier?: number }): boolean;
  setTable(i: number, on: boolean): boolean;
  placeDecor(slot: number, id: string | null): boolean;
  setWindow(open: boolean): void;
  playerStart(stage?: number): Vec2;
  layout(): StageLayout;
  obstacles(): Obstacle[];
  makeItem(product: string, tier?: number): T.Mesh;
  makeMoneyStack(): T.Mesh;
  marker(kind?: string, o?: Record<string, unknown>): T.Object3D;
  sparkle(pos: { x: number; y?: number; z: number }, n?: number, color?: string): void;
  ferry: { state: FerryState; t: number; auto: boolean; arrive(): boolean; onEvent(cb: (e: 'horn' | 'dock' | 'leave') => void): () => void; readonly doorPos: Vec2 };
  zones: { iskele: ZoneDef; 'test-sokak': ZoneDef };
}

const DOCK = { x: 10.75, z: -7.1 };
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const PATH_IN = [V(46, 0, -60), V(28, 0, -36), V(10.75, 0, -28), V(10.75, 0, -7.1)];
const PATH_OUT = [V(10.75, 0, -7.1), V(10.75, 0, -24), V(2, 0, -36), V(-50, 0, -50)];
const IN_T = 10, DOCK_T = 25, OUT_T = 16, GANG_T = 1.4, AUTO_AWAY = 40;
const STEAM_PER = 5, STEAM_MAX = 24, SPK = 120;

export function createWorldView(deps: WorldViewDeps): WorldView {
  const prefab = deps.prefab as MotorPrefabSystem;
  const zones = deps.zones as MotorZones;
  const render = deps.render as Partial<MotorRender> & RenderPipeline;

  defineIskelePrefabs(prefab);
  GREYBOX_PREFABS.forEach(d => { if (!prefab.has(d.id)) prefab.define(d); });
  carsiPrefabs().forEach(d => { if (!prefab.has(d.id)) prefab.define(d); });
  ensureKit();
  const ZI = iskeleZone(), ZT = testSokakZone();
  if (!zones.def('iskele')) zones.register(ZI); else zones.replace(ZI);
  if (!zones.def('test-sokak')) zones.register(ZT);
  zones.prewarm?.('test-sokak'); // CPU templates now, so streaming it in only clones
  // 2026-10-24 açık dünya: the Martıköy districts east of Çarşı (sahil, yokuş, meydan, barınak) stream in again
  registerDisariZones(zones as never, prefab as never);
  const STATIC_ANCHORS = { ...ZI.anchors };

  /* ---- state ---- */
  let winOwned = false;
  let standPoll = 0;
  let standsOwned: { x: number; z: number; ry: number }[] = [], standsKey = '';
  let stage = 1, renewed: Record<string, boolean> = {}, layout = stageLayout(1);
  let signText = 'Sabri\'nin Büfesi', signFont = 'vapur', signTier = 0, signRenk = '#ffe08a';
  const stationState: Record<string, { visible: boolean; tier: number }> = {};
  STATION_KINDS.forEach(k => { stationState[k] = { visible: k === 'doner', tier: 1 }; });
  const tableVis = new Array(8).fill(false) as boolean[];
  const decorAt = new Array(12).fill(null) as (string | null)[];
  const decorPaint = new Array(12).fill('') as string[], decorRot = new Array(12).fill(0) as number[]; // Dekor 2.0: paint key + 45° steps per slot
  const poses: Record<string, { x: number; z: number; ry: number }> = {};
  let dynDirty = true;
  let time = 0, winOpen = 0, winTarget = 0, floOn = true, floT = 1;
  let roofMesh: T.Mesh | null = null, roofA = 1;   // survey 2026-10-24: çatı kesiti (stage 1 roof fades near the player)
  let floorKey = '';
  const floorTexCache = new Map<string, T.CanvasTexture>();
  /** survey 2026-10-24: real floor patterns (ahşap / fayans / mermer) with visible dirt stains. One texture spans 4 m. */
  function floorPatternTex(desen: string, kir: number): T.CanvasTexture {
    const key = desen + ':' + kir; const hit = floorTexCache.get(key); if (hit) return hit;
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d')!;
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (desen === 'fayans') {
      const n = 8, c = N / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#2f6f8f' : '#eef4f2'; g.fillRect(i * c, j * c, c, c);
        if ((i + j) % 2 === 0) { g.fillStyle = '#7fb6c9'; g.beginPath(); g.moveTo(i * c + c / 2, j * c + c * 0.22); g.lineTo(i * c + c * 0.78, j * c + c / 2); g.lineTo(i * c + c / 2, j * c + c * 0.78); g.lineTo(i * c + c * 0.22, j * c + c / 2); g.fill(); } }
      g.strokeStyle = 'rgba(80,90,95,.55)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, N); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(N, i * c); g.stroke(); }
    } else if (desen === 'mermer') {
      const n = 4, c = N / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? '#f4f1ea' : '#e6e1d6'; g.fillRect(i * c, j * c, c, c); }
      for (let v = 0; v < 26; v++) { g.strokeStyle = `rgba(120,115,110,${0.18 + rnd() * 0.3})`; g.lineWidth = 0.8 + rnd() * 2.2; g.beginPath(); let x = rnd() * N, y = rnd() * N; g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { const nx = x + (rnd() - 0.3) * 110, ny = y + (rnd() - 0.5) * 70; g.quadraticCurveTo((x + nx) / 2 + (rnd() - 0.5) * 40, (y + ny) / 2 + (rnd() - 0.5) * 40, nx, ny); x = nx; y = ny; } g.stroke(); }
      g.strokeStyle = 'rgba(150,140,125,.6)'; g.lineWidth = 2.5; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * c, 0); g.lineTo(i * c, N); g.stroke(); g.beginPath(); g.moveTo(0, i * c); g.lineTo(N, i * c); g.stroke(); }
    } else {
      const rows = 16, rh = N / rows;
      for (let r = 0; r < rows; r++) { let x = -rnd() * 160; while (x < N) { const w = 120 + rnd() * 120, l = 0.85 + rnd() * 0.25; g.fillStyle = `rgb(${Math.round(196 * l)},${Math.round(146 * l)},${Math.round(98 * l)})`; g.fillRect(x, r * rh, w, rh);
        g.strokeStyle = 'rgba(90,55,30,.25)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const yy = r * rh + 4 + rnd() * (rh - 8); g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy + (rnd() - 0.5) * 4); g.stroke(); }
        g.fillStyle = 'rgba(70,40,20,.55)'; g.fillRect(x, r * rh, 2, rh); x += w; } g.fillRect(0, r * rh, N, 2); }
    }
    if (kir > 0) {
      seed = 99;
      for (let k = 0; k < Math.round(70 * kir); k++) { const x = rnd() * N, y = rnd() * N, r = 10 + rnd() * 34; const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(92,70,45,${0.28 * kir + 0.06})`); gr.addColorStop(1, 'rgba(92,70,45,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = `rgba(60,45,30,${0.22 * kir})`;
      for (let k = 0; k < Math.round(24 * kir); k++) { const x = rnd() * N, y = rnd() * N, a = rnd() * 6.28; for (let s = 0; s < 4; s++) { g.beginPath(); g.ellipse(x + Math.cos(a) * s * 22, y + Math.sin(a) * s * 22, 6, 10, a, 0, Math.PI * 2); g.fill(); } }
      g.fillStyle = `rgba(80,60,40,${0.1 * kir})`; g.fillRect(0, 0, N, N);
    }
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(0.25, 0.25); t.anisotropy = 4;
    floorTexCache.set(key, t); return t;
  }
  let kioskFloorMat: { color: T.Color } | null = null;   // survey 2026-10-24: büfe zemin tonu (sim zemin)
  let tod: Tod | null = null, night = 0;
  const renewedCsv = () => PARTS.filter(p => renewed[p]).join(',');
  const tableStyle = (i: number) => stage >= 5 ? 5 : stage === 4 ? 4 : stage === 3 ? 3 : (i <= 1 ? 1 : 2);

  /* ---- handles inside the iskele zone (refreshed on build / rebuild) ---- */
  interface H {
    sea: T.Mesh | null; skySky: T.Object3D | null; skyWin: T.Object3D | null; clouds: T.Mesh | null;
    kayik: T.Object3D | null; sail: T.Object3D | null; buoys: T.Object3D[];
    ferry: T.Object3D | null; gangway: T.Object3D | null; ferryGlow: T.Object3D | null; far: T.Object3D | null; farGlow: T.Object3D | null;
    kiosk: T.Object3D | null; sign: T.Mesh | null; flo: T.Mesh | null; floPool: T.Mesh | null; shutter: T.Object3D | null; bunting: T.Mesh | null;
    nightNodes: T.Object3D[]; meats: T.Object3D[]; spins: T.Object3D[];
  }
  const h: H = { sea: null, skySky: null, skyWin: null, clouds: null, kayik: null, sail: null, buoys: [], ferry: null, gangway: null, ferryGlow: null, far: null, farGlow: null,
    kiosk: null, sign: null, flo: null, floPool: null, shutter: null, bunting: null, nightNodes: [], meats: [], spins: [] };
  const inner = (id: string): T.Object3D | null => prefab.instance(id)?.object.children[0] ?? null;

  // view-owned scene pieces (re-added to the zone root on every build)
  const steamGeo = new T.BufferGeometry();
  steamGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(STEAM_MAX * STEAM_PER * 3), 3));
  steamGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(STEAM_MAX * STEAM_PER * 4), 4));
  const steam = new T.Points(steamGeo, new T.PointsMaterial({ map: radialTex, size: 0.26, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  steam.frustumCulled = false; steam.name = 'steam'; steam.renderOrder = 4; steam.userData.parity = 'dyn';
  let steamSrc: P3v[] = [];
  const spkGeo = new T.BufferGeometry(), spkV = new Float32Array(SPK * 3), spkL = new Float32Array(SPK), spkM = new Float32Array(SPK);
  spkGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(SPK * 3), 3));
  spkGeo.setAttribute('color', new T.BufferAttribute(new Float32Array(SPK * 4), 4));
  const sparkles = new T.Points(spkGeo, new T.PointsMaterial({ map: radialTex, size: 0.32, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
  sparkles.frustumCulled = false; sparkles.visible = false; sparkles.renderOrder = 8; sparkles.name = 'sparkles';
  let spkNext = 0;
  let decorGlow: T.Group | null = null;

  function refreshHandles() {
    const sea = inner('sea') as T.Mesh | null; h.sea = sea;
    const sk = inner('skyline');
    h.skySky = sk?.getObjectByName('skyline') ?? null; h.skyWin = sk?.getObjectByName('skylineWindows') ?? null; h.clouds = (sk?.getObjectByName('clouds') as T.Mesh) ?? null;
    const bo = inner('boats'); h.kayik = bo?.getObjectByName('kayik') ?? null; h.sail = bo?.getObjectByName('sail') ?? null;
    h.buoys = []; bo?.children.forEach(c => { if (c.name === 'buoy') h.buoys.push(c); });
    h.ferry = inner('ferry'); h.gangway = h.ferry?.getObjectByName('gangway') ?? null; h.ferryGlow = h.ferry?.getObjectByName('ferryGlow') ?? null;
    h.far = inner('ferryFar'); h.farGlow = h.far?.getObjectByName('ferryGlow') ?? null;
    const k = inner('kiosk'); h.kiosk = k;
    h.sign = (k?.getObjectByName('sign') as T.Mesh) ?? null; h.flo = (k?.getObjectByName('floresan') as T.Mesh) ?? null; h.floPool = (k?.getObjectByName('floPool') as T.Mesh) ?? null;
    const fl = (k?.getObjectByName('kioskFloor') as T.Mesh | undefined) ?? null;
    if (fl && fl.material && !Array.isArray(fl.material)) { fl.material = (fl.material as T.Material).clone(); kioskFloorMat = fl.material as T.MeshStandardMaterial | T.MeshBasicMaterial; floorKey = ''; }
    roofMesh = (k?.getObjectByName('kioskRoof') as T.Mesh | undefined) ?? null; roofA = 1;
    h.shutter = k?.getObjectByName('shutter') ?? null; h.bunting = (k?.getObjectByName('bunting') as T.Mesh) ?? null;
    h.nightNodes = [];
    const root = zones.root('iskele'); root?.traverse(o => { if (o.userData.night) h.nightNodes.push(o); });
    if (h.shutter) h.shutter.scale.y = lerp(1, 0.07, easeInOut(winOpen));
    if (h.ferry) { h.ferry.visible = ferry.state !== 'away'; placeFerryNow(); }
    stools();
    applyNight();
  }
  function stools() {
    const s1 = prefab.instance('tabure-s1'), s2 = prefab.instance('tabure-s2');
    if (s1) s1.object.visible = stage === 1;
    if (s2) s2.object.visible = stage >= 2;
  }

  /* ---- layout -> poses, anchors, colliders ---- */
  function applyLayout() {
    layout = stageLayout(stage);
    STATION_KINDS.forEach(kind => {
      const L = layout.stations[kind], S1 = stationBuilt(kind, 1, stage);
      poses[kind] = { x: L.x, z: L.z != null ? L.z : -2.75 - 0.42 - S1.d / 2, ry: L.rotY };
    });
  }
  function anchorsNow(): Record<string, AnchorDef> {
    const a: Record<string, AnchorDef> = { ...STATIC_ANCHORS };
    const put = (k: string, p: P3v | { x: number; y?: number; z: number }, rotY?: number, kind?: string) => { a[k] = { pos: { x: p.x, z: p.z }, y: (p as P3v).y || 0, rotY, kind }; };
    const L = layout;
    L.queue.forEach((v, i) => put('queue.' + i, v, undefined, 'queue'));
    put('counter', L.counter.pos); put('counter.drop', L.counter.drop); put('counter.standAt', L.counter.standAt);
    put('kasa', L.kasa.pos); put('kasa.pile', L.kasa.pile);
    STATION_KINDS.forEach(k => {
      const P = poses[k], S = stationBuilt(k, stationState[k].tier, stage);
      put('stations.' + k, { x: P.x, z: P.z }, P.ry, 'station');
      put('stations.' + k + '.standAt', local2world(P.x, P.z, P.ry, 0, S.d / 2 + 0.42), P.ry);
      put('stations.' + k + '.out', local2world(P.x, P.z, P.ry, S.out.x, S.out.z, S.out.y));
    });
    L.tables.forEach((tb, i) => {
      const ry = tb.ax === 'z' ? HP : 0, st = tableStyle(i), sx = st === 1 ? 0.75 : 0.78, top = tableBuilt(st, stage >= 3 && i >= 6).top;
      put('tables.' + i, tb as unknown as P3v, ry);
      [-sx, sx].forEach((lx, j) => { const s = local2world(tb.x, tb.z, ry, lx, 0); a['tables.' + i + '.seat.' + j] = { pos: { x: s.x, z: s.z }, y: 0, rotY: ry, kind: 'seat' }; });
      put('tables.' + i + '.pile', { x: tb.x, y: top + 0.03, z: tb.z });
    });
    put('ferryWindow.standAt', L.window.standAt); put('ferryWindow.serve', L.window.serve);
    L.window.queue.forEach((v, i) => put('ferryWindow.queue.' + i, v, undefined, 'queue'));
    put('jobCorner', L.job.pos); put('jobCorner.board', { x: L.job.board[0], z: L.job.board[1] }, L.job.board[2]);
    PAD_KEYS_FALLBACK.forEach(k => {
      if (a['pads.' + k]) return;
      if ((STATION_KINDS as readonly string[]).includes(k)) put('pads.' + k, { x: poses[k].x, z: poses[k].z });
      else if (k in TABLE_PADS) { const tb = L.tables[TABLE_PADS[k]]; put('pads.' + k, tb as unknown as P3v); }
      else if (k === 'isbul') put('pads.' + k, L.job.pos);
      else if (L.extraPads[k]) put('pads.' + k, L.extraPads[k]);
      else put('pads.' + k, { x: L.playerStart.x + 1.8, z: L.playerStart.z + 2.2 });
      a['pads.' + k].kind = 'pad';
    });
    for (const k in L.cat) put('catSpots.' + k, L.cat[k]);
    const bs = benchSeats(BENCHES[2])[1]; put('catSpots.bench', { x: bs.x, y: SEAT_H, z: bs.z });
    put('dogSpot', L.dog);
    L.perch.forEach(([x, y, z, r], i) => put('gullPerches.' + i, { x, y, z }, r, 'perch'));
    L.slots.forEach((s, i) => { put('decorSlots.' + i, s.pos, s.rotY, 'decor'); a['decorSlots.' + i].tags = [s.size]; });
    L.walkways.forEach((w, i) => w.forEach((v, j) => put('walkways.' + i + '.' + j, v)));
    put('playerStart', L.playerStart, undefined, 'spawn');
    if (L.door) { put('door.outside', L.door.outside, undefined, 'door'); put('door.inside', L.door.inside, undefined, 'door'); }
    put('ferry.door', { x: 8.1, z: -7.1 }, undefined, 'door'); put('ferry.dock', { x: DOCK.x, z: DOCK.z });
    return a;
  }
  function dynObstacles(): Obstacle[] {
    const out: Obstacle[] = [];
    STATION_KINDS.forEach(k => { if (!stationState[k].visible) return; const P = poses[k], S = stationBuilt(k, stationState[k].tier, stage); out.push(rectAABB(P.x, P.z, S.w, S.d, P.ry, 'station')); });
    layout.tables.forEach((tb, i) => { if (!tableVis[i]) return; const w = tableStyle(i) === 1 ? 0.78 : 0.9; out.push(rectAABB(tb.x, tb.z, w, w, 0, 'table')); });
    decorAt.forEach((id, i) => { const sl = layout.slots[i]; if (!id || !sl) return; const f = (FOOT as Record<string, number>)[DECOR_SIZE[id] || 'm'] * 0.85; out.push(rectAABB(sl.pos.x, sl.pos.z, f, f, 0, 'decor')); });
    // owner playtest: ghosting through the counter, the cash desk and the ferry window. Footprints follow the placements
    // (the player stands on standAt, which stays free); kept small so the kiosk front stays passable.
    const C = layout.counter.pos, K = layout.kasa.pos, W = layout.window.serve;
    out.push({ x0: C.x - 0.8, x1: C.x + 0.8, z0: C.z - 0.22, z1: C.z + 0.22, tag: 'counter' });
    out.push({ x0: K.x - 0.32, x1: K.x + 0.32, z0: K.z - 0.32, z1: K.z + 0.32, tag: 'kasa' });
    out.push({ x0: W.x - 0.3, x1: W.x + 0.3, z0: W.z - 0.36, z1: W.z + 0.36, tag: 'window' });
    // ferry-window stall: the whole sill and (stage 2+) the prep cabinet behind it are solid, not just the middle (owner: "hayalet gibi geçiliyor")
    out.push({ x0: W.x - 0.3, x1: W.x + 0.5, z0: W.z - 0.85, z1: W.z + 0.85, tag: 'window' });
    // owned stands (midye, ıslak hamburger...) are solid too: the 1.1 x 0.65 m table, turned with the stand
    for (const sv of standsOwned) { const side = Math.abs(Math.sin(sv.ry)) > 0.5; const hx = side ? 0.4 : 0.6, hz = side ? 0.6 : 0.4; out.push({ x0: sv.x - hx, x1: sv.x + hx, z0: sv.z - hz, z1: sv.z + hz, tag: 'stant' }); }
    if (stage >= 2 && winOwned) out.push({ x0: W.x - 0.62, x1: W.x - 0.36, z0: W.z - 0.78, z1: W.z + 0.78, tag: 'window' });
    return out;
  }

  /* ---- view-owned placements ---- */
  const dyn = new Map<string, PrefabInstance>();
  let dynRoot: T.Object3D | null = null;
  function desired(): { id: string; prefab: string; pos: Vec2; rotY: number; overrides: Record<string, string | number | boolean> }[] {
    const out: ReturnType<typeof desired> = [];
    STATION_KINDS.forEach(k => { const st = stationState[k]; if (!st.visible) return; const P = poses[k]; out.push({ id: 'station-' + k, prefab: 'iskele.station', pos: { x: P.x, z: P.z }, rotY: P.ry, overrides: { kind: k, tier: st.tier, stage } }); });
    layout.tables.forEach((tb, i) => { if (!tableVis[i]) return; out.push({ id: 'table-' + i, prefab: 'iskele.table', pos: { x: tb.x, z: tb.z }, rotY: tb.ax === 'z' ? HP : 0, overrides: { style: tableStyle(i), tavla: stage >= 3 && i >= 6 } }); });
    decorAt.forEach((id, i) => { const sl = layout.slots[i]; if (!id || !sl) return; out.push({ id: 'decor-' + i, prefab: 'iskele.decor', pos: { x: sl.pos.x, z: sl.pos.z }, rotY: sl.rotY + decorRot[i], overrides: decorPaint[i] ? { id, paint: decorPaint[i] } : { id } }); });
    return out;
  }
  function syncDyn(data = true) {
    dynDirty = false;
    const root = zones.root('iskele');
    const want = desired();
    // colliders + anchors are pure data: kept current even at 'sim'; a zone rebuild (onBuilt) only re-places meshes
    if (data) {
      ZI.anchors = anchorsNow();
      zones.setColliders?.('iskele', 'dyn', dynObstacles().map(o => ({ x0: o.x0, x1: o.x1, z0: o.z0, z1: o.z1 } as Rect)));
    }
    if (!root) return; // meshes follow on the next onBuilt (a detached root keeps the view's instances)
    if (root !== dynRoot) { clearDyn(); dynRoot = root; decorGlow = null; }
    const keep = new Set(want.map(w => w.id));
    dyn.forEach((inst, id) => { if (!keep.has(id)) { inst.remove(); dyn.delete(id); } });
    want.forEach(w => {
      const cur = dyn.get(w.id);
      if (cur && cur.object.parent === root) cur.setPlacement({ prefab: w.prefab, pos: w.pos, rotY: w.rotY, overrides: w.overrides });
      else { if (cur) cur.remove(); dyn.set(w.id, prefab.place({ id: w.id, prefab: w.prefab, pos: w.pos, rotY: w.rotY, overrides: w.overrides }, root)); }
    });
    // per-station animated bits + steam sources (world space)
    h.meats = []; h.spins = []; steamSrc = [];
    STATION_KINDS.forEach(k => {
      const inst = dyn.get('station-' + k); if (!inst) return;
      const g = inst.object.children[0]; if (!g) return;
      g.children.forEach(c => { if (c.name === 'meat') h.meats.push(c); else if (c.name.startsWith('spin-')) h.spins.push(c); });
      const P = poses[k];
      ((g.userData.steam || []) as number[][]).forEach(v => { if (steamSrc.length < STEAM_MAX) steamSrc.push(local2world(P.x, P.z, P.ry, v[0], v[2], v[1])); });
    });
    steamGeo.setDrawRange(0, steamSrc.length * STEAM_PER); steam.visible = steamSrc.length > 0;
    // decor lamps -> glow pools (v2 dynLights.decor)
    if (decorGlow) { decorGlow.parent?.remove(decorGlow); decorGlow.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); }); decorGlow = null; }
    const lights: { x: number; y: number; z: number; r: number; s: number }[] = [];
    decorAt.forEach((id, i) => {
      const sl = layout.slots[i]; if (!id || !sl) return;
      const d = decorBuild(id); if (!d.info.light) return;
      const L = d.info.light, p = local2world(sl.pos.x, sl.pos.z, sl.rotY, L.x, L.z, L.y);
      lights.push({ x: p.x, y: p.y, z: p.z, r: d.info.pool ? 2.1 : 0, s: d.info.pool ? 1 : 0.7 });
    });
    if (lights.length) { decorGlow = glowSet(lights, 'decorGlow'); decorGlow.userData.night = true; root.add(decorGlow); }
    if (steam.parent !== root) root.add(steam);
    if (sparkles.parent !== root) root.add(sparkles);
    refreshHandles();
  }
  function clearDyn() { dyn.forEach(i => i.remove()); dyn.clear(); h.meats = []; h.spins = []; }

  zones.onBuilt?.((id) => { if (id === 'iskele') syncDyn(dynDirty); });

  /* ---- kiosk overrides ---- */
  function kioskOverrides() { return { stage, renewed: renewedCsv(), sign: signText, font: signFont }; }
  function applyKiosk() {
    const ov = kioskOverrides();
    // the registered def can be a copy of ZI (editor overrides): update both so the re-bake sees this stage
    [ZI, zones.def('iskele')].forEach(d => { const pl = d?.props.find(p => p.id === 'kiosk'); if (pl) pl.overrides = ov; });
    prefab.instance('kiosk')?.setPlacement({ overrides: ov });
  }

  /* ---- ferry ---- */
  const ferrySubs = new Set<(e: 'horn' | 'dock' | 'leave') => void>();
  const fire = (e: 'horn' | 'dock' | 'leave') => ferrySubs.forEach(cb => { try { cb(e); } catch { /* ignore */ } });
  const ferry: WorldView['ferry'] = {
    state: 'away', t: 0, auto: true, doorPos: { x: 8.1, z: -7.1 },
    arrive() { if (ferry.state !== 'away') return false; ferry.state = 'arriving'; ferry.t = 0; if (h.ferry) h.ferry.visible = true; placeFerry(0, false); fire('horn'); return true; },
    onEvent(cb) { ferrySubs.add(cb); return () => { ferrySubs.delete(cb); }; },
  };
  const fpos = { x: DOCK.x, z: DOCK.z, head: 0 }, _fa = new T.Vector3(), _fb = new T.Vector3(), _fc = new T.Vector3();
  let ferrySpeed = 0, gangRot = -HP, ferryAway = AUTO_AWAY - 8;
  function placeFerry(e: number, out: boolean) {
    const Pp = out ? PATH_OUT : PATH_IN, e1 = Math.max(0, Math.min(1, e) - 0.004), e2 = Math.min(1, e1 + 0.004);
    bez(Pp[0], Pp[1], Pp[2], Pp[3], e, _fa); bez(Pp[0], Pp[1], Pp[2], Pp[3], e1, _fb); bez(Pp[0], Pp[1], Pp[2], Pp[3], e2, _fc);
    const tx = _fc.x - _fb.x, tz = _fc.z - _fb.z;
    if (Math.abs(tx) + Math.abs(tz) > 1e-6) fpos.head = Math.atan2(tx, tz) + (out ? PI : 0);
    fpos.x = _fa.x; fpos.z = _fa.z;
  }
  function placeFerryNow() {
    const f = h.ferry; if (!f) return;
    f.position.x = fpos.x; f.position.z = fpos.z; f.rotation.y = fpos.head;
    if (h.gangway) h.gangway.rotation.z = gangRot;
  }
  function stepFerry(dt: number) {
    const rl = getRules?.();
    if (rl) { const r = rl.rt.ferry; if (r.state !== ferry.state) { const prev = ferry.state; ferry.state = r.state; if (r.state === 'arriving' && prev === 'away') fire('horn'); else if (r.state === 'docked') fire('dock'); else if (r.state === 'leaving') fire('leave'); } ferry.t = r.t; }
    const f = ferry; if (!rl) f.t += dt;
    const px = fpos.x, pz = fpos.z;
    let sign = 1;
    if (rl) {
      if (f.state === 'arriving') { const k = clamp(f.t / IN_T, 0, 1); placeFerry(1 - Math.pow(1 - k, 2.4), false); }
      else if (f.state === 'docked') { fpos.x = DOCK.x; fpos.z = DOCK.z; fpos.head = 0; gangRot = -HP * (1 - easeInOut(clamp(f.t / GANG_T, 0, 1))); }
      else if (f.state === 'leaving') { gangRot = -HP * easeInOut(clamp(f.t / GANG_T, 0, 1)); const k = clamp((f.t - GANG_T) / (OUT_T - GANG_T), 0, 1); placeFerry(Math.pow(k, 1.8), true); sign = -1; }
      else gangRot = -HP;
    } else if (f.state === 'away') { if (f.auto) { ferryAway += dt; if (ferryAway >= AUTO_AWAY) { ferryAway = 0; f.arrive(); } } }
    else if (f.state === 'arriving') {
      const k = clamp(f.t / IN_T, 0, 1); placeFerry(1 - Math.pow(1 - k, 2.4), false);
      if (f.t >= IN_T) { f.state = 'docked'; f.t = 0; fpos.x = DOCK.x; fpos.z = DOCK.z; fpos.head = 0; fire('dock'); }
    } else if (f.state === 'docked') {
      gangRot = -HP * (1 - easeInOut(clamp(f.t / GANG_T, 0, 1)));
      if (f.t >= DOCK_T) { f.state = 'leaving'; f.t = 0; fire('leave'); }
    } else if (f.state === 'leaving') {
      gangRot = -HP * easeInOut(clamp(f.t / GANG_T, 0, 1));
      const k = clamp((f.t - GANG_T) / (OUT_T - GANG_T), 0, 1); placeFerry(Math.pow(k, 1.8), true); sign = -1;
      if (f.t >= OUT_T) { f.state = 'away'; f.t = 0; gangRot = -HP; ferryAway = 0; }
    }
    if (dt > 0) ferrySpeed = Math.hypot(fpos.x - px, fpos.z - pz) / dt;
    const o = h.ferry;
    if (o) {
      o.visible = f.state !== 'away';
      placeFerryNow();
      o.position.y = WATER_Y + Math.sin(time * 1.1) * 0.035;
      o.rotation.z = Math.sin(time * 0.8) * 0.008 * (f.state === 'docked' ? 0.3 : 1);
    }
    const U = (h.sea?.material as T.ShaderMaterial | undefined)?.uniforms;
    if (U) { U.uFerryOn.value = f.state !== 'away' ? 1 : 0; (U.uFerry.value as T.Vector4).set(fpos.x, fpos.z, fpos.head, sign * clamp(ferrySpeed / 7, 0, 1)); }
  }
  let getRules: (() => Rules | null) | null = null, rtv: RtView | null = null, poseFn: (() => { x: number; z: number; rot: number } | null) | undefined;
  let farX = -40, farDir = 1, farWait = 0;

  /* ---- night (v2 applyNight) + sea colours ---- */
  function applyTime(t: Tod) {
    tod = t; night = t.n;
    const U = (h.sea?.material as T.ShaderMaterial | undefined)?.uniforms;
    if (U) {
      const el = t.el, az = t.az, sunDir = new T.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
      U.uDeep.value.copy(t.deep); U.uShallow.value.copy(t.sh); U.uSky.value.copy(t.sky2); U.uSunCol.value.copy(t.sun); U.uSunDir.value.copy(sunDir); U.uNight.value = night;
    }
    applyNight();
  }
  function applyNight() {
    const n = night;
    MAT.bulb.color.copy(mixc('#ddd8cc', '#fff1c0', n));
    MAT.win.color.set('#ffffff'); MAT.win.opacity = n * 0.95;
    MAT.glow.opacity = n * 0.55; MAT.halo.opacity = n * 0.9;
    h.nightNodes.forEach(o => { o.visible = n > 0.01; });
    if (h.clouds && tod) (h.clouds.material as T.MeshBasicMaterial).color.copy(mixc('#ffffff', tod.hor, 0.35)).multiplyScalar(1 - n * 0.62);
    if (h.sign) {
      // tabela seviyesi (sim/tabela.ts): lit tiers glow in their colour at night, the LED pano also by day
      const sm = h.sign.material as T.MeshLambertMaterial, base = renewed.tabela ? 1.5 : stage === 1 ? 0 : 0.22;
      sm.emissiveIntensity = n * (signTier >= 2 ? 2.4 : signTier === 1 ? Math.max(base, 1.4) : base) + (signTier >= 3 ? 0.45 : 0);
      if (signTier >= 1 && sm.emissive) sm.emissive.set(signRenk);
    }
    if (h.ferryGlow) h.ferryGlow.visible = n > 0.05;
    if (h.farGlow) h.farGlow.visible = n > 0.05;
    horizonVis();
  }
  let lastHorizon: boolean | null = null;
  function horizonVis() {
    const hz = render.horizon != null ? render.horizon : true;
    lastHorizon = hz;
    if (h.skySky) h.skySky.visible = hz;
    if (h.clouds) h.clouds.visible = hz;
    if (h.skyWin) h.skyWin.visible = hz && night > 0.01;
  }
  render.onTime?.((t: Tod) => applyTime(t));

  function animFloresan(dt: number) {
    if (!h.flo || !h.floPool) return;
    // Survey 2026-10-24: "ışık titremesi ASLA". The tube stays steady; only the night glow changes.
    floOn = true;
    let on = stage === 1 ? night : Math.max(0.3, night);
    if (!floOn) on *= 0.06;
    (h.flo.material as T.MeshBasicMaterial).color.copy(mixc('#c3c8cd', '#f6fdff', on));
    (h.floPool.material as T.MeshBasicMaterial).opacity = on * (stage === 1 ? 0.42 : 0.3); h.floPool.visible = on > 0.02;
  }
  function animSteam(t: number) {
    if (!steam.visible) return;
    const P = steamGeo.attributes.position.array as Float32Array, Cc = steamGeo.attributes.color.array as Float32Array;
    steamSrc.forEach((s, j) => {
      for (let k = 0; k < STEAM_PER; k++) {
        const ph = (t * 0.42 + k / STEAM_PER + j * 0.37) % 1, i = j * STEAM_PER + k;
        P[i * 3] = s.x + Math.sin(ph * 5 + j) * 0.07 * ph; P[i * 3 + 1] = s.y + ph * 0.6; P[i * 3 + 2] = s.z + Math.cos(ph * 4 + j) * 0.05 * ph;
        Cc[i * 4] = Cc[i * 4 + 1] = Cc[i * 4 + 2] = 1; Cc[i * 4 + 3] = Math.sin(ph * PI) * 0.5;
      }
    });
    steamGeo.attributes.position.needsUpdate = true; steamGeo.attributes.color.needsUpdate = true;
  }
  function animSparkles(dt: number) {
    if (!sparkles.visible) return;
    const P = spkGeo.attributes.position.array as Float32Array, Cc = spkGeo.attributes.color.array as Float32Array; let alive = 0;
    for (let i = 0; i < SPK; i++) {
      if (spkL[i] <= 0) { Cc[i * 4 + 3] = 0; continue; }
      spkL[i] -= dt; alive++;
      spkV[i * 3 + 1] -= 4.5 * dt;
      P[i * 3] += spkV[i * 3] * dt; P[i * 3 + 1] += spkV[i * 3 + 1] * dt; P[i * 3 + 2] += spkV[i * 3 + 2] * dt;
      Cc[i * 4 + 3] = clamp(spkL[i] / spkM[i], 0, 1);
    }
    spkGeo.attributes.position.needsUpdate = true; spkGeo.attributes.color.needsUpdate = true;
    if (!alive) sparkles.visible = false;
  }

  function animate(dtIn: number) {
    const dt = Math.min(0.1, Math.max(0, +dtIn || 0)); time += dt;
    if (render.horizon != null && render.horizon !== lastHorizon) horizonVis();
    const U = (h.sea?.material as T.ShaderMaterial | undefined)?.uniforms;
    if (U) U.uTime.value = time;
    stepFerry(dt);
    if (farWait > 0) { farWait -= dt; if (h.far) h.far.visible = false; }
    else { if (h.far) h.far.visible = true; farX += farDir * dt * 3.2; if (Math.abs(farX) > 150) { farDir = -farDir; farWait = 20; } }
    if (h.far) { h.far.position.set(farX, WATER_Y + Math.sin(time * 0.9 + 1) * 0.04, -46); h.far.rotation.y = farDir > 0 ? HP : -HP; }
    if (h.kayik) { h.kayik.position.y = WATER_Y + Math.sin(time * 1.3) * 0.06; h.kayik.rotation.z = Math.sin(time * 0.9) * 0.05; h.kayik.rotation.x = Math.sin(time * 0.7 + 1) * 0.03; }
    if (h.sail) { h.sail.position.x += dt * 0.35; if (h.sail.position.x > 70) h.sail.position.x = -70; h.sail.position.y = WATER_Y + Math.sin(time * 1.1 + 2) * 0.05; h.sail.rotation.z = Math.sin(time * 0.6) * 0.04; }
    h.buoys.forEach((b, i) => { b.position.y = WATER_Y + Math.sin(time * 1.6 + i * 2) * 0.07; b.rotation.z = Math.sin(time * 1.2 + i) * 0.12; });
    if (h.clouds) h.clouds.position.x = Math.sin(time * 0.01) * 12;
    h.meats.forEach(m => { m.rotation.y += dt * 0.9; });
    h.spins.forEach((m, i) => { m.rotation.y += dt * (m.userData.kind === 'ring' ? 1.6 : 1.1); m.position.y = (m.userData.y0 as number) + Math.sin(time * 2 + i) * 0.04; });
    animSteam(time); animFloresan(dt); if (h.bunting) animBunting(h.bunting, time); animSparkles(dt);
    if (winOpen !== winTarget) { winOpen = winTarget > winOpen ? Math.min(winTarget, winOpen + dt * 1.6) : Math.max(winTarget, winOpen - dt * 1.6); if (h.shutter) h.shutter.scale.y = lerp(1, 0.07, easeInOut(winOpen)); }
    MARKERS.forEach((g0: unknown) => {
      const g = g0 as T.Object3D, u = g.userData as { t: number; kind: string; inner: T.Mesh }; if (!g.parent) return; u.t += dt;
      if (u.kind === 'arrow') { u.inner.position.y = 0.35 + Math.abs(Math.sin(u.t * 3.4)) * 0.45; u.inner.rotation.y += dt * 1.5; }
      else if (u.kind === 'ring') { const s = 1 + Math.sin(u.t * 4) * 0.07; u.inner.scale.set(s, s, 1); (u.inner.material as T.MeshBasicMaterial).opacity = 0.65 + Math.sin(u.t * 4) * 0.2; }
    });
  }

  /* ---- public API ---- */
  const parseRenewed = (rn?: readonly string[] | null) => { const o: Record<string, boolean> = {}; (rn || []).forEach(p => { if (PARTS.includes(p)) o[p] = true; }); return o; };
  let lastStateKey = '';
  const view: WorldView = {
    bindRules(get, pose) { getRules = get; poseFn = pose; },
    get stage() { return stage; },
    get renewed() { return PARTS.filter(p => renewed[p]); },
    zones: { iskele: ZI, 'test-sokak': ZT },
    ferry,
    setStage(n, rn) {
      stage = clamp(Math.round(+n) || 1, 1, 5);
      renewed = parseRenewed(rn);
      applyLayout(); applyKiosk(); dynDirty = true; syncDyn();
    },
    renew(part, on = true) {
      if (!PARTS.includes(part)) return false;
      if (on) renewed[part] = true; else delete renewed[part];
      applyKiosk(); syncDyn();
      if (on) { const k2 = h.kiosk?.userData.k2; view.sparkle(partPos(part, stage, k2), 34); }
      return true;
    },
    setSign(text, font) { if (text != null) signText = String(text); if (font != null) signFont = String(font); applyKiosk(); refreshHandles(); },
    setStation(kind, o) {
      const st = stationState[kind]; if (!st) return false;
      if (o.visible != null) st.visible = !!o.visible;
      if (o.tier != null) st.tier = clamp(Math.round(+o.tier) || 1, 1, 4);
      dynDirty = true; return true;
    },
    setTable(i, on) { if (!(i >= 0 && i < 8)) return false; tableVis[i] = !!on; dynDirty = true; return true; },
    placeDecor(slot, id) { if (!layout.slots[slot] && id) return false; decorAt[slot] = id || null; dynDirty = true; return true; },
    setWindow(open) { winTarget = open ? 1 : 0; },
    playerStart(s?: number) { const L = s == null || s === stage ? layout : stageLayout(clamp(Math.round(+s) || 1, 1, 5)); return { x: L.playerStart.x, z: L.playerStart.z }; },
    layout: () => layout,
    obstacles: () => staticObstacles().concat(prefab.colliders('iskele.kiosk', kioskOverrides()).map(r => ({ ...r, tag: 'kiosk' })), dynObstacles()),
    makeItem(product, tierN = 1) {
      const HT = ITEM_HT as Record<string, number[]>;
      const p = HT[product] ? product : 'cay', t = clamp(Math.round(+tierN) || 1, 1, 4);
      const m = new T.Mesh(itemGeo(p, t), MAT.atlas); m.castShadow = true; m.name = 'item-' + p;
      m.userData = { h: HT[p][t - 1], product: p, tier: t }; return m;
    },
    makeMoneyStack() { const m = new T.Mesh(moneyGeo(), MAT.atlas); m.castShadow = true; m.name = 'money'; m.userData = { h: 0.045, product: 'money' }; return m; },
    marker: (kind, o) => makeMarker(kind || 'ring', o || {}) as T.Object3D,
    sparkle(pos, n = 26, color) {
      if (!pos) return;
      const P = spkGeo.attributes.position.array as Float32Array, Cc = spkGeo.attributes.color.array as Float32Array, c = col(color || '#ffe27a');
      const y0 = pos.y != null && pos.y > 0.05 ? pos.y : 0.6;
      for (let k = 0; k < n; k++) {
        const i = spkNext; spkNext = (spkNext + 1) % SPK;
        const a = Math.random() * TAU, r = 0.2 + Math.random() * 0.5;
        P.set([pos.x + Math.cos(a) * r * 0.5, y0 + Math.random() * 0.4, pos.z + Math.sin(a) * r * 0.5], i * 3);
        spkV.set([Math.cos(a) * r * 1.6, 1.6 + Math.random() * 1.8, Math.sin(a) * r * 1.6], i * 3);
        spkL[i] = spkM[i] = 0.7 + Math.random() * 0.6;
        const w = Math.random() < 0.35 ? 1 : 0; Cc.set([lerp(c.r, 1, w), lerp(c.g, 1, w), lerp(c.b, 1, w), 1], i * 4);
      }
      sparkles.visible = true;
    },
    update(state: GameState, dt: number) {
      if (state) {
        const rk = (state.renewed || []).slice().sort().join(',');
        if (state.stage !== stage || rk !== PARTS.filter(p => renewed[p]).slice().sort().join(',')) {
          const added = (state.renewed || []).filter(p => !renewed[p]);
          if (state.stage === stage && added.length === 1) view.renew(added[0], true); else view.setStage(state.stage, state.renewed);
        }
        const tb = (state.zones as Record<string, { tier?: number; renk?: string }> | undefined)?.tabela;
        if (tb && (tb.tier !== signTier || tb.renk !== signRenk)) { signTier = tb.tier || 0; signRenk = tb.renk || signRenk; applyNight(); }
        const sg = state.sign as { text?: string; font?: string } | null;
        if (sg && ((sg.text != null && sg.text !== signText) || (sg.font != null && sg.font !== signFont))) view.setSign(sg.text, sg.font);
        // purchases -> stations, tables, decor (v2 restore/onLayout rules)
        const owned = state.owned || {}, tiers = (state.tiers || {}) as Record<string, number>;
        let key = stage + '#';
        STATION_KINDS.forEach(k => { key += (k === 'doner' || owned[k] ? 1 : 0) + ':' + (tiers[k] || 1) + ';'; });
        for (const k in TABLE_PADS) key += owned[k] ? 1 : 0;
        (state.decorSlots || []).forEach(d => { key += '|' + d.slot + '=' + d.item + '@' + (d.rotY || 0) + paintKey(d.paint); });
        const zm = (state.zones as Record<string, Record<string, unknown>> | undefined)?.zemin as { desen?: string; kir?: number } | undefined;
        key += '|zemin=' + (zm?.desen || 'ahsap') + ':' + Math.round((zm?.kir || 0) * 10);
        // survey 2026-10-24: floor pattern + dirt (sim/zemin.ts). Tint only: the tile and wood textures stay.
        if (kioskFloorMat) {
          const fk = (zm?.desen || 'ahsap') + ':' + Math.round((zm?.kir || 0) * 8);
          if (fk !== floorKey) { floorKey = fk; const m = kioskFloorMat as T.MeshLambertMaterial; m.map = floorPatternTex(zm?.desen || 'ahsap', Math.round((zm?.kir || 0) * 8) / 8); m.color.set('#ffffff'); m.needsUpdate = true; }
        }
        if (key !== lastStateKey) {
          lastStateKey = key;
          STATION_KINDS.forEach(k => view.setStation(k, { visible: k === 'doner' || !!owned[k], tier: tiers[k] || 1 }));
          tableVis.fill(false);
          for (const k in TABLE_PADS) if (owned[k]) tableVis[TABLE_PADS[k]] = true;
          if (stage >= 3) { tableVis[6] = tableVis[7] = true; }
          decorAt.fill(null);
          decorPaint.fill(''); decorRot.fill(0);
          (state.decorSlots || []).forEach(d => { const i = +d.slot; if (i >= 0 && i < decorAt.length && layout.slots[i]) { decorAt[i] = d.item; decorPaint[i] = paintKey(d.paint); decorRot[i] = +(d.rotY || 0) || 0; } });
          dynDirty = true;
        }
      }
      if ((standPoll = (standPoll + 1) % 15) === 0) { const rr = getRules?.(), api = restoranApi(rr);
        const so = api ? api.view().stands.filter(s => s.owned).map(s => ({ x: s.x, z: s.z, ry: s.ry })) : [];
        const key = so.map(s => s.x + ',' + s.z).join('|'); if (key !== standsKey) { standsKey = key; standsOwned = so; dynDirty = true; } }
      { const rr = getRules?.(); if (rr && !!(rr.state.owned as Record<string, number>).pencere !== winOwned) { winOwned = !winOwned; dynDirty = true; } }
      if (dynDirty) syncDyn();
      const rl = getRules?.();
      if (rl) {
        winTarget = rl.rt.window?.open ? 1 : 0;
        if (!rtv) rtv = createRtView({ root: () => zones.root('iskele') ?? null, anchors: () => ZI.anchors, layout: () => layout, pose: () => poseFn?.() ?? null });
        rtv.update(rl, Math.min(0.1, Math.max(0, dt)));
      }
      if (roofMesh) {
        const pp = poseFn?.(), dx = pp ? Math.max(BUFE.x0 - pp.x, 0, pp.x - BUFE.x1) : 99, dz = pp ? Math.max(BUFE.z0 - pp.z, 0, pp.z - BUFE.z1) : 99;
        // 16:52 user: the closed kiosk opened its roof and blinked its name whenever Sabri walked past the cart.
        // Cut away only once the kiosk is open (stage 2+) and Sabri is really inside it.
        const tgt = stage >= 2 && Math.hypot(dx, dz) < 0.25 ? 0 : 1;
        roofA += (tgt - roofA) * Math.min(1, dt * 5);
        const m = roofMesh.material as T.MeshLambertMaterial; m.opacity = roofA; m.depthWrite = roofA > 0.95; roofMesh.visible = roofA > 0.03;
        if (h.sign) h.sign.visible = roofMesh.visible; if (h.bunting) h.bunting.visible = roofMesh.visible;
      }
      animate(dt);
    },
    dispose() {
      clearDyn(); rtv?.dispose();
      steam.parent?.remove(steam); sparkles.parent?.remove(sparkles);
      steamGeo.dispose(); spkGeo.dispose();
    },
  };

  /* ---- first state: stage 1, pier built now ---- */
  applyLayout();
  ZI.anchors = anchorsNow();
  zones.update(ISKELE_PLAYER_START);
  zones.flush?.(ISKELE_PLAYER_START);
  if (zones.root('iskele')) syncDyn();
  if (render.tod) applyTime(render.tod());
  return view;
}
