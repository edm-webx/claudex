/**
 * Street in front of the pier (owner list item 23): a sidewalk on the büfe side, a 6-lane carriageway
 * (two car lanes each way, one metrobus lane each way in the middle), a pedestrian overpass above the metrobus,
 * a municipal bus stop with a parody name, and vehicles that loop along the road: buses, metrobus, a metro
 * train on a viaduct and a slow ferry on the water line. Pure view: no colliders, not walkable, nav untouched.
 */
import * as T from 'three';

export interface YolLookDeps { root: () => T.Object3D | null }
export interface YolLookView { update(dt: number): void; dispose(): void }

const Z_WALK = 13.3, Z_KERB = 15.0, LANE = 1.9, ROAD_W = LANE * 6;
const X0 = -62, X1 = 62;
const RX = 130;  // road/sidewalk reach well past the pier ends so no vehicle ever pops in or out of view
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
  g.add(box(RX * 2, 0.12, Z_KERB - Z_WALK, lam('#c9c1b0'), 0, 0.02, (Z_WALK + Z_KERB) / 2));
  g.add(box(RX * 2, 0.16, 0.25, lam('#8f8778'), 0, 0.06, Z_KERB));
  // carriageway with lane markings
  g.add(box(RX * 2, 0.08, ROAD_W, lam('#3a3d42'), 0, 0.0, zc));
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
  const x = 24, zA = Z_WALK + 0.9, zB = Z_KERB + ROAD_W + 1.0, h = 5.2, deckW = 2.2;
  const zm = (zA + zB) / 2, len = zB - zA;
  g.add(box(deckW, 0.3, len + 0.6, lam('#7b8189'), x, h, zm));
  g.add(box(deckW + 0.4, 0.5, len + 0.6, lam('#5b6068'), x, h - 0.4, zm));
  [-1, 1].forEach(sg => g.add(box(0.08, 0.9, len, lam('#c9ced6'), x + sg * (deckW / 2), h + 0.6, zm)));
  [zA, zB].forEach(z => {
    g.add(box(0.5, h, 0.5, lam('#6f747c'), x - 1.2, h / 2, z));
    g.add(box(0.5, h, 0.5, lam('#6f747c'), x + 1.2, h / 2, z));
  });
  return g;
}

type Vehicle = { mesh: T.Object3D; lane: number; speed: number; off: number; dir: 1 | -1; kind: 'bus' | 'metro' | 'metrobus' | 'car' };

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
  const add = (mesh: T.Object3D, lane: number, off: number, kind: Vehicle['kind']) => { mesh.position.set(X0 - 200, 0, laneZ(lane)); if (lane >= 3) mesh.rotation.y = Math.PI; group.add(mesh); list.push({ mesh, lane, speed: LS[lane], off, dir: lane >= 3 ? -1 : 1, kind }); };
  let ci = 0;
  for (const lane of [0, 1, 4, 5]) for (let k = 0; k < SPAN_V / SPACE; k++) { const bus = (k + lane) % 3 === 0; add(bus ? busBody(COLORS[ci++ % 3], 8.2, '42B') : carBody(COLORS[ci++ % COLORS.length]), lane, k * SPACE + lane * 7, bus ? 'bus' : 'car'); }
  for (const lane of [2, 3]) for (let k = 0; k < 2; k++) add(busBody('#e0533c', 14.5, 'MB'), lane, k * (SPAN_V / 2) + lane * 20, 'metrobus');
  // metro train on a viaduct behind the far sidewalk
  const vz = Z_KERB + ROAD_W + 6.0;
  for (let x = X0 - 100; x <= X1 + 100; x += 12) group.add(box(1.2, 5.6, 1.6, lam('#9a9ea6'), x, 2.8, vz));
  group.add(box(SPAN_V, 0.5, 3.4, lam('#7b8189'), 0, 5.75, vz));
  const metro = new T.Group();
  for (let i = 0; i < 3; i++) {
    metro.add(box(15, 2.3, 2.7, lam('#2c6fbf'), i * 15.4, 1.35, 0)); metro.add(box(14.2, 0.55, 2.74, GLASS(), i * 15.4, 1.65, 0)); metro.add(box(14.2, 0.2, 2.74, lam('#e9f1fb'), i * 15.4, 0.8, 0));
  }
  metro.position.set(X0, 6.0, vz);
  group.add(metro);
  list.push({ mesh: metro, lane: -1, speed: 14, off: 0, dir: 1, kind: 'metro' });
  return { group, list };
}
const SPAN_V = 320;

export function createYolLook(d: YolLookDeps): YolLookView {
  const road = buildRoad(), stop = buildBusStop(), bridge = buildOverpass();
  const { group: vehicles, list } = buildVehicles();
  const holder = new T.Group(); holder.name = 'yolKok';
  holder.position.y = STREET_Y;
  holder.add(road, stop, bridge, vehicles);
  let t = 0;
  return {
    update(dt) {
      const root = d.root();
      if (!root) return;
      if (holder.parent !== root) root.add(holder);
      t += dt;
      for (const v of list) {
        const p = ((v.off + v.speed * t) % SPAN_V + SPAN_V) % SPAN_V;
        v.mesh.position.x = v.dir === 1 ? X0 - 95 + p : X1 + 95 - p;
      }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
