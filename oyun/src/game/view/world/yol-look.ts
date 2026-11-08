/**
 * Street in front of the pier (owner list item 23): a sidewalk on the büfe side, a 6-lane carriageway
 * (two car lanes each way, one metrobus lane each way in the middle), a pedestrian overpass above the metrobus,
 * a municipal bus stop with a parody name, and vehicles that loop along the road: buses, metrobus, a metro
 * train on a viaduct and a slow ferry on the water line. Pure view: no colliders, not walkable, nav untouched.
 */
import * as T from 'three';
import { zeminDetay } from '../../../engine/render/zemin-detay';
import { loadGlb, fitClone } from './glb';
import { UG, ugY } from '../../../content/ustgecit';

export interface YolLookDeps { root: () => T.Object3D | null }
export interface YolLookView { update(dt: number): void; dispose(): void }

const Z_WALK = 13.3, Z_KERB = 15.0, LANE = 1.9, ROAD_W = LANE * 6;
const X0 = -62, X1 = 62;
const RX = 62;  // road/sidewalk reach well past the pier ends so no vehicle ever pops in or out of view
const STOP_NAME = 'BETT';
const STREET_Y = 0.35;

const mats = new Map<string, T.Material>();
const lam = (c: string) => { let m = mats.get(c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); mats.set(c, m); } return m; };
const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

function signTex(text: string, bg: string, fg: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = '900 72px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66, 480);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function buildRoad(): T.Group {
  const g = new T.Group(); g.name = 'yolRoad';
  const zc = Z_KERB + ROAD_W / 2;
  // sidewalk and kerb
  zeminDetay(lam('#c9c1b0'), { force: 1, ds: 0.7 });
  g.add(box(RX * 2, 0.12, Z_KERB - Z_WALK, lam('#c9c1b0'), 0, 0.02, (Z_WALK + Z_KERB) / 2));
  g.add(box(RX * 2, 0.16, 0.25, lam('#8f8778'), 0, 0.06, Z_KERB));
  // carriageway with lane markings
  { const am = new T.MeshLambertMaterial({ color: '#56595f' }); zeminDetay(am, { force: 0, ds: 0.85 }); g.add(box(RX * 2, 0.08, ROAD_W, am, 0, 0.0, zc)); }
  for (let i = 1; i < 6; i++) {
    if (i === 2 || i === 4) continue;
    g.add(box(RX * 2, 0.09, 0.12, lam('#e9e4d4'), 0, 0.05, Z_KERB + i * LANE));
  }
  // metrobus median: a raised kerb each side with a painted lane
  g.add(box(RX * 2, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 2 * LANE));
  g.add(box(RX * 2, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 4 * LANE));
  // far sidewalk
  g.add(box(RX * 2, 0.12, 2.0, lam('#c9c1b0'), 0, 0.02, Z_KERB + ROAD_W + 1.0));
  return g;
}

/** Tunnel blocks closing both road ends: vehicles come out of a dark mouth, nothing pops in view. */
function buildPortals(): T.Group {
  const g = new T.Group(); g.name = 'yolTunel';
  const zc = Z_KERB + ROAD_W / 2, zw = ROAD_W + 4.4;
  for (const sg of [-1, 1]) {
    g.add(box(24, 7, zw, lam('#9a9ea4'), sg * (RX + 12), 3.5, zc - 0.5));
    g.add(box(0.3, 3.6, ROAD_W, lam('#0d0f12'), sg * (RX + 0.01), 1.8, zc));
    g.add(box(0.5, 0.5, ROAD_W + 0.8, lam('#5b6068'), sg * (RX + 0.1), 3.85, zc));
  }
  return g;
}

function buildBusStop(): T.Group {
  const g = new T.Group(); g.name = 'yolDurak';
  const x = -20, z = Z_WALK + 0.9;
  [-1.2, 1.2].forEach(dx => g.add(box(0.12, 2.4, 0.12, lam('#5a5f66'), x + dx, 1.2, z)));
  g.add(box(3.0, 0.14, 1.3, lam('#2b9d6a'), x, 2.45, z));
  g.add(box(2.6, 0.9, 0.08, lam('#e9f6f0'), x, 1.6, z - 0.66));
  const sign = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshLambertMaterial({ map: signTex(STOP_NAME + ' DURAĞI', '#2b9d6a', '#fbfaf6') }));
  sign.position.set(x, 2.8, z + 0.02); sign.rotation.y = Math.PI; g.add(sign);
  return g;
}

function buildOverpass(): T.Group {
  const g = new T.Group(); g.name = 'yolUstGecit';
  const { x, hw, zA, zB, zC, zD, h } = UG, W = hw * 2 + 0.3, steel = lam('#7b8189'), dark = lam('#5b6068'), rail = lam('#c9ced6');
  const zm = (zB + zC) / 2, len = zC - zB;
  g.add(box(W, 0.3, len + 0.4, steel, x, h - 0.15, zm));
  g.add(box(W, 0.45, len, dark, x, h - 0.6, zm));
  // two flights of steps: every tread is a solid block down to the ground, so nothing floats
  const N = 14;
  const flight = (z0: number, z1: number) => {
    for (let i = 0; i < N; i++) {
      const za = z0 + (z1 - z0) * i / N, zb = z0 + (z1 - z0) * (i + 1) / N;
      const top = ugY(x, (za + zb) / 2) || 0.05, th = Math.max(0.12, top);
      g.add(box(W, th, Math.abs(zb - za) + 0.01, i % 2 ? lam('#8a9097') : lam('#979da4'), x, th / 2, (za + zb) / 2));
    }
  };
  flight(zA, zB); flight(zD, zC);
  // landing blocks and pillars under the deck
  // pillars only on the sidewalks and on the two metrobus medians (z = kerb + 2/4 lanes), never in a lane
  for (const z of [zB + 0.2, Z_KERB + 2 * LANE, Z_KERB + 4 * LANE, zC - 0.2]) for (const sg of [-1, 1]) g.add(box(0.3, h - 0.75, 0.3, lam('#6f747c'), x + sg * (hw - 0.1), (h - 0.75) / 2, z));
  // girders under the deck edges + a light strip so it reads as a bridge from the street
  for (const sg of [-1, 1]) g.add(box(0.18, 0.5, len, dark, x + sg * (hw + 0.05), h - 0.55, zm));
  // railings: along the deck and following both flights
  for (const sg of [-1, 1]) {
    const rx = x + sg * hw;
    g.add(box(0.07, 1.0, len + 0.4, rail, rx, h + 0.55, zm));
    g.add(box(0.07, 0.07, len + 0.4, rail, rx, h + 1.05, zm));
    for (const [z0, z1] of [[zA, zB], [zD, zC]]) {
      const dz = z1 - z0, dy = h, L = Math.hypot(dz, dy), ang = Math.atan2(dy, Math.abs(dz)) * Math.sign(dz) * -1;
      for (const yy of [0.55, 1.05]) { const r = box(0.07, 0.07, L, rail, rx, h / 2 + yy, (z0 + z1) / 2); r.rotation.x = ang; g.add(r); }
      for (let i = 0; i <= 4; i++) { const t = i / 4, zz = z0 + dz * t; g.add(box(0.06, 0.9, 0.06, rail, rx, ugY(x, zz) + 0.45, zz)); }
    }
  }
  // sign over the stairs
  const sgn = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshLambertMaterial({ map: signTex('ÜST GEÇİT', '#2b6fb8', '#fbfaf6') }));
  sgn.position.set(x, h + 1.7, zB + 0.2); g.add(sgn);
  return g;
}

type Vehicle = { mesh: T.Object3D; lane: number; speed: number; off: number; dir: 1 | -1; kind: 'bus' | 'metrobus' | 'car' };

const cyl = (rt: number, rb: number, h: number, m: T.Material, x: number, y: number, z: number, axis: 'x' | 'z' = 'z') => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, 14), m); o.rotation.x = axis === 'z' ? Math.PI / 2 : 0; o.position.set(x, y, z); return o; };
const GLASS = () => lam('#2a3a4c'), TYRE = () => lam('#17181b'), HUB = () => lam('#b9bec6');
const glow = (c: string) => { const k = 'glow' + c; let m = mats.get(k); if (!m) { m = new T.MeshBasicMaterial({ color: c }); mats.set(k, m); } return m; };
/** Wheels (axles at xs), headlights at the +x front, tail lights at the back; the model faces +x. */
function wheels(g: T.Group, len: number, wid: number, r: number, xs: number[]) {
  for (const x of xs) for (const sg of [-1, 1]) { g.add(cyl(r, r, 0.3, TYRE(), x, r, sg * (wid / 2 - 0.08))); g.add(cyl(r * 0.5, r * 0.5, 0.32, HUB(), x, r, sg * (wid / 2 - 0.08))); }
  for (const sg of [-1, 1]) { g.add(box(0.06, 0.2, 0.34, glow('#fff3c4'), len / 2 + 0.01, r + 0.5, sg * (wid / 2 - 0.35))); g.add(box(0.06, 0.2, 0.3, glow('#ff3b30'), -len / 2 - 0.01, r + 0.5, sg * (wid / 2 - 0.3))); }
}
/** City bus (and metrobus when len is long): body, window band with pillars, roof unit, doors, wheels, destination sign. */
function busBody(c: string, len: number, label: string): T.Group {
  const b = new T.Group(), wid = 2.5, H = 3.0, r = 0.5;
  b.add(box(len, 0.28, wid - 0.1, lam('#2b2d31'), 0, r + 0.1, 0));                       // chassis skirt
  b.add(box(len, H - 0.9, wid, lam(c), 0, 0.9 + (H - 0.9) / 2, 0));                       // body
  b.add(box(len - 0.2, 0.2, wid - 0.15, lam('#f4f2ec'), 0, H + 0.1, 0));                  // roof cap
  b.add(box(len * 0.34, 0.2, wid * 0.55, lam('#d9dde2'), -len * 0.15, H + 0.3, 0));        // AC unit
  for (const sg of [-1, 1]) {
    b.add(box(len - 0.9, 0.95, 0.05, GLASS(), -0.1, 2.25, sg * (wid / 2 + 0.015)));         // side windows
    const n = Math.floor((len - 1.2) / 1.5);
    for (let i = 1; i < n; i++) b.add(box(0.1, 1.0, 0.07, lam(c), -len / 2 + 0.6 + i * ((len - 1.2) / n), 2.25, sg * (wid / 2 + 0.02)));
    b.add(box(1.0, 1.9, 0.06, lam('#cfd8df'), len / 2 - 2.0, 1.55, sg * (wid / 2 + 0.02)));  // door
    b.add(box(len - 0.8, 0.1, 0.06, lam('#ffffff'), -0.1, 1.0, sg * (wid / 2 + 0.02)));      // stripe
  }
  b.add(box(0.05, 1.15, wid - 0.3, GLASS(), len / 2 + 0.015, 2.0, 0));                     // windscreen
  b.add(box(0.06, 0.3, 1.2, glow('#ffb347'), len / 2 + 0.02, 2.85, 0));                    // route sign
  b.add(box(0.05, 0.9, wid - 0.4, GLASS(), -len / 2 - 0.015, 2.1, 0));                     // rear window
  b.add(box(0.1, 0.25, wid, lam('#2b2d31'), len / 2 + 0.03, 0.75, 0));                     // front bumper
  const tx = signTex(label, '#111', '#ffb347'); const sg2 = new T.Mesh(new T.PlaneGeometry(1.1, 0.28), new T.MeshBasicMaterial({ map: tx })); sg2.position.set(len / 2 + 0.055, 2.85, 0); sg2.rotation.y = Math.PI / 2; b.add(sg2);
  wheels(b, len, wid, r, len > 7 ? [len / 2 - 1.4, 0, -len / 2 + 1.4] : [len / 2 - 1.3, -len / 2 + 1.5]);
  return b;
}
/** Small car: lower body, glass cabin, wheels. */
function carBody(c: string): T.Group {
  const b = new T.Group(), len = 4.2, wid = 1.8, r = 0.34;
  b.add(box(len, 0.6, wid, lam(c), 0, r + 0.3, 0));
  b.add(box(len * 0.5, 0.55, wid - 0.15, lam(c), -0.2, r + 0.85, 0));
  for (const sg of [-1, 1]) b.add(box(len * 0.44, 0.38, 0.04, GLASS(), -0.2, r + 0.88, sg * (wid / 2 - 0.05)));
  b.add(box(0.05, 0.38, wid - 0.35, GLASS(), len * 0.25 - 0.18, r + 0.88, 0));
  b.add(box(0.05, 0.38, wid - 0.35, GLASS(), -len * 0.25 - 0.22, r + 0.88, 0));
  wheels(b, len, wid, r, [len / 2 - 0.9, -len / 2 + 0.85]);
  return b;
}

function buildVehicles(): { group: T.Group; list: Vehicle[] } {
  const group = new T.Group(); group.name = 'yolArac';
  const list: Vehicle[] = [];
  const laneZ = (i: number) => Z_KERB + (i + 0.5) * LANE;
  // lanes: 0,1 east cars, 2 east metrobus, 3 west metrobus, 4,5 west cars. One constant speed per lane + fixed spacing: nothing overlaps or overtakes.
  const LS = [7, 9, 10, 10, 9, 7], SPACE = 36, COLORS = ['#2f9d59', '#ffd23f', '#3f7fd0', '#e0533c', '#f4f2ec', '#8a5fd0', '#2fb5b0'];
  // Kenney car models replace the box cars once loaded (the box body stays when a file is missing)
  const CARS = ['taxi', 'sedan', 'suv', 'hatchback-sports', 'van', 'sedan-sports', 'suv-luxury', 'delivery', 'police'];
  const skin = (g: T.Group, k: number) => { loadGlb('auto/' + CARS[k % CARS.length]).then(src => { if (!src) return; g.clear(); g.add(fitClone(src, 1.9, 4.4, undefined, CAR_YAW)); }); return g; };
  const add = (mesh: T.Object3D, lane: number, off: number, kind: Vehicle['kind']) => { mesh.position.set(X0 - 200, 0, laneZ(lane)); if (lane >= 3) mesh.rotation.y = Math.PI; group.add(mesh); list.push({ mesh, lane, speed: LS[lane], off, dir: lane >= 3 ? -1 : 1, kind }); };
  let ci = 0;
  for (const lane of [0, 1, 4, 5]) for (let k = 0; k < SPAN_V / SPACE; k++) { const bus = (k + lane) % 3 === 0; add(bus ? busBody(COLORS[ci++ % 3], 8.2, '42B') : skin(carBody(COLORS[ci % COLORS.length]), ci++), lane, k * SPACE + lane * 7, bus ? 'bus' : 'car'); }
  for (const lane of [2, 3]) for (let k = 0; k < 2; k++) add(busBody('#e0533c', 14.5, 'MB'), lane, k * (SPAN_V / 2) + lane * 20, 'metrobus');
  return { group, list };
}
const SPAN_V = 144;
const CAR_YAW = Math.PI / 2;   // Kenney cars face +z, the lane vehicles face +x

export function createYolLook(d: YolLookDeps): YolLookView {
  const road = buildRoad(), stop = buildBusStop(), bridge = buildOverpass();
  const { group: vehicles, list } = buildVehicles();
  const holder = new T.Group(); holder.name = 'yolKok';
  holder.position.y = STREET_Y;
  holder.add(road, stop, bridge, vehicles, buildPortals());
  let t = 0;
  return {
    update(dt) {
      const root = d.root();
      if (!root) return;
      if (holder.parent !== root) root.add(holder);
      t += dt;
      for (const v of list) {
        const p = ((v.off + v.speed * t) % SPAN_V + SPAN_V) % SPAN_V;
        v.mesh.position.x = v.dir === 1 ? X0 - 10 + p : X1 + 10 - p;
      }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
