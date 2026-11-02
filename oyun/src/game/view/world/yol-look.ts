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
const X0 = -62, X1 = 62, SPAN = X1 - X0;
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
  g.add(box(X1 - X0, 0.12, Z_KERB - Z_WALK, lam('#c9c1b0'), 0, 0.02, (Z_WALK + Z_KERB) / 2));
  g.add(box(X1 - X0, 0.16, 0.25, lam('#8f8778'), 0, 0.06, Z_KERB));
  // carriageway with lane markings
  g.add(box(X1 - X0, 0.08, ROAD_W, lam('#3a3d42'), 0, 0.0, zc));
  for (let i = 1; i < 6; i++) {
    if (i === 2 || i === 4) continue;
    g.add(box(X1 - X0, 0.09, 0.12, lam('#e9e4d4'), 0, 0.05, Z_KERB + i * LANE));
  }
  // metrobus median: a raised kerb each side with a painted lane
  g.add(box(X1 - X0, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 2 * LANE));
  g.add(box(X1 - X0, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 4 * LANE));
  // far sidewalk
  g.add(box(X1 - X0, 0.12, 2.0, lam('#c9c1b0'), 0, 0.02, Z_KERB + ROAD_W + 1.0));
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

type Vehicle = { mesh: T.Object3D; lane: number; speed: number; off: number; dir: 1 | -1; kind: 'bus' | 'metro' | 'metrobus' };

function buildVehicles(): { group: T.Group; list: Vehicle[] } {
  const group = new T.Group(); group.name = 'yolArac';
  const list: Vehicle[] = [];
  const laneZ = (i: number) => Z_KERB + (i + 0.5) * LANE;
  const busBody = (c: string, len: number) => {
    const b = new T.Group();
    b.add(box(len, 1.5, 2.2, lam(c), 0, 1.0, 0));
    b.add(box(len * 0.92, 0.5, 2.25, lam('#cfe3f2'), 0, 1.45, 0));
    return b;
  };
  // car lanes: 0,1 (east), 4,5 (west); metrobus lanes: 2 (east), 3 (west)
  for (let k = 0; k < 4; k++) {
    const dir: 1 | -1 = k < 2 ? 1 : -1;
    const lane = k < 2 ? k : k + 1;
    const mesh = busBody(k % 2 ? '#ffd23f' : '#2f9d59', 5.6);
    mesh.position.set(X0, 0, laneZ(lane));
    group.add(mesh);
    list.push({ mesh, lane, speed: 6 + k, off: k * 19, dir, kind: 'bus' });
  }
  for (const dir of [1, -1] as const) {
    const lane = dir === 1 ? 2 : 3;
    const mb = busBody('#e0533c', 9.0);
    mb.add(box(9.0 * 0.6, 0.2, 2.0, lam('#fbfaf6'), 0, 1.8, 0));
    mb.position.set(X0, 0, laneZ(lane));
    group.add(mb);
    list.push({ mesh: mb, lane, speed: 9, off: dir === 1 ? 0 : 60, dir, kind: 'metrobus' });
  }
  const metro = new T.Group();
  metro.add(box(18, 1.8, 2.4, lam('#2c6fbf'), 0, 0, 0));
  metro.add(box(17.2, 0.4, 2.45, lam('#e9f1fb'), 0, 0.5, 0));
  metro.position.set(X0, 6.2, Z_KERB + ROAD_W + 6.0);
  group.add(metro);
  list.push({ mesh: metro, lane: -1, speed: 11, off: 0, dir: 1, kind: 'metro' });
  return { group, list };
}

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
        const span = SPAN + 12;
        const p = ((v.off + v.speed * t) % span + span) % span;
        const x = v.dir === 1 ? X0 - 6 + p : X1 + 6 - p;
        v.mesh.position.x = x;
      }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
