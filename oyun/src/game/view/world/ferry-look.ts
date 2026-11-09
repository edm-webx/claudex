/**
 * Ferry variety + tarife tahtası view (survey vapur-1/2/8). Reads `rules.rt.ferryInfo` / `rt.ferry` only:
 * - a live timetable board on the pier next to the old static timetable sign (canvas texture, redrawn when the text
 *   changes, i.e. about once a second): next boat, mm:ss, "SON VAPUR" at night;
 * - cheap per-kind tweaks on B's shared ferry mesh: object scale, a coloured hull band with the boat's name, funnel
 *   sleeve/ring, tourist awning, deck cars, steam puffs, and a bulb string on the lit last ferry.
 * Added as children of the inner ferry object (prefab wrapper 'ferry' > built group 'ferry', the one the world view moves).
 * No colliders: the board stands on the existing sign post, nav and zones are untouched.
 */
import * as T from 'three';
import { FERRY_KINDS, type FerryKindId, type FerryLook } from '../../../content/ferries';
import { FERRY_T } from '../../sim/ferry';
import { ferryBoardModel, type FerryBoardModel } from '../../sim/ferry-kinds';
import type { Rules } from '../../sim/state';

export interface FerryLookDeps { root: () => T.Object3D | null; rules: () => Rules | null }
export interface FerryLookView { update(dt: number): void; board(): FerryBoardModel | null; debug(): Record<string, unknown>; dispose(): void }

const HP = Math.PI / 2;
// 2026-11-09 user: the ferry sign belongs at the pier edge by the ferry gangway, not at the büfe
const BOARD_POS = { x: 21.0, z: -10.6, ry: 0 };
const mats = new Map<string, T.Material>();
const lam = (c: string) => { let m = mats.get('l' + c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); mats.set('l' + c, m); } return m; };
const bas = (c: string, op = 1) => { let m = mats.get('b' + c + op); if (!m) { m = new T.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op, depthWrite: op >= 1 }); mats.set('b' + c + op, m); } return m; };
const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const cyl = (r: number, h: number, m: T.Material, y: number) => { const o = new T.Mesh(new T.CylinderGeometry(r, r, h, 16), m); o.position.y = y; return o; };

function nameTex(text: string, bg: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#fbfaf6'; g.font = '900 40px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text.toLocaleUpperCase('tr-TR'), 256, 34, 490);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

/** One deco group per kind, built lazily, hung under the ferry object. */
function buildDeco(kind: FerryKindId): T.Group {
  const L: FerryLook = FERRY_KINDS[kind].look, g = new T.Group(); g.name = 'ferryDeco-' + kind;
  if (L.hull) {
    g.add(box(4.34, 0.56, 12.4, lam(L.hull), 0, 0.62, 0));
    const tm = new T.MeshLambertMaterial({ map: nameTex(FERRY_KINDS[kind].name, L.hull) });
    [-1, 1].forEach(sg => { const p = new T.Mesh(new T.PlaneGeometry(4.6, 0.5), tm); p.position.set(sg * 2.18, 0.62, 0); p.rotation.y = sg * HP; g.add(p); });
  }
  if (L.funnel) {
    const h = L.tall ? 2.5 : 1.1, y = L.tall ? 5.0 : 4.3;
    g.add(cyl(0.54, h, lam(L.funnel), y));
    if (L.ring) g.add(cyl(0.555, 0.2, lam(L.ring), y + h / 2 - 0.3));
  }
  if (L.awning) {
    g.add(box(3.6, 0.1, 8.2, lam(L.awning), 0, 3.44, 0));
    for (let z = -3.5; z <= 3.6; z += 1.4) g.add(box(3.62, 0.11, 0.45, lam('#fbfaf6'), 0, 3.44, z));
  }
  if (L.cars) {
    const cols = ['#e0533c', '#2f6fdb', '#ffd23f', '#6f9e4f'];
    [[-0.9, -5.3], [0.9, -5.3], [-0.9, 5.3], [0.9, 5.3]].forEach(([x, z], i) => {
      g.add(box(0.9, 0.42, 1.4, lam(cols[i]), x, 2.64, z));
      g.add(box(0.8, 0.3, 0.7, lam('#cfe3f2'), x, 2.98, z - 0.1));
    });
  }
  if (L.smoke) {
    const puffs = new T.Group(); puffs.name = 'smoke';
    const geo = new T.SphereGeometry(0.32, 8, 6);
    for (let i = 0; i < 7; i++) { const m = new T.Mesh(geo, new T.MeshBasicMaterial({ color: '#d9d4cc', transparent: true, opacity: 0.8, depthWrite: false })); m.userData.ph = i / 7; puffs.add(m); }
    g.add(puffs);
  }
  return g;
}
function buildLights(): T.Group {
  const g = new T.Group(); g.name = 'ferryNightLights';
  const geo = new T.SphereGeometry(0.075, 6, 4);
  [-2.06, 2.06].forEach(x => { for (let i = 0; i < 15; i++) { const m = new T.Mesh(geo, bas(i % 2 ? '#ffb36b' : '#ffe9a0')); m.position.set(x, 3.0, -6.3 + i * 0.9); g.add(m); } });
  // a string from the bow to the funnel top and on to the stern
  for (let i = 0; i <= 12; i++) { const k = i / 12, z = -7 + 14 * k, y = 2.9 + 2.3 * (1 - Math.abs(k - 0.5) * 2); const m = new T.Mesh(geo, bas(i % 3 ? '#ffe9a0' : '#ff8a6b')); m.position.set(0, y, z); g.add(m); }
  return g;
}

export function createFerryLook(d: FerryLookDeps): FerryLookView {
  /* ---- board ---- */
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
  const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  const board = new T.Group(); board.name = 'tarifeTahtasi';
  board.position.set(BOARD_POS.x, 0, BOARD_POS.z); board.rotation.y = BOARD_POS.ry;
  // one post (at the east pier edge next to the gangway) and a face tilted back toward the steep play camera so it reads from above
  board.add(cyl(0.06, 2.2, lam('#33373b'), 1.1));
  const face = new T.Group(); face.position.set(0, 2.3, 0); face.rotation.x = -0.85; board.add(face);
  face.add(box(2.12, 1.32, 0.06, lam('#1d5fa8'), 0, 0, 0));
  face.add(box(2.26, 0.09, 0.22, lam('#e0533c'), 0, 0.68, 0.02));
  const screen = new T.Mesh(new T.PlaneGeometry(2.0, 1.22), new T.MeshLambertMaterial({ map: tex, emissive: new T.Color('#ffffff'), emissiveMap: tex, emissiveIntensity: 0.5 }));
  screen.position.set(0, -0.02, 0.035); face.add(screen);
  board.traverse(o => { o.userData.parity = 'dyn'; });
  let lastKey = '', model: FerryBoardModel | null = null;
  function draw(m: FerryBoardModel) {
    const g = cv.getContext('2d')!, W = 512, H = 320;
    g.fillStyle = '#14243d'; g.fillRect(0, 0, W, H);
    g.fillStyle = m.lit ? '#3b2f6b' : '#f2b632'; g.fillRect(0, 0, W, 62);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = m.lit ? '#ffe9a0' : '#14243d'; g.font = '900 34px system-ui, sans-serif';
    g.fillText(m.title, W / 2 + (m.lit ? 18 : 0), 33, 440);
    if (m.lit) { g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(70, 31, 17, 0, Math.PI * 2); g.fill(); g.fillStyle = '#3b2f6b'; g.beginPath(); g.arc(79, 25, 15, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#fbfaf6'; g.font = '800 40px system-ui, sans-serif'; g.fillText(m.name, W / 2, 110, 480);
    g.fillStyle = '#ffb33c'; g.font = '900 104px ui-monospace, Menlo, monospace'; g.fillText(m.time, W / 2, 200, 480);
    g.fillStyle = '#9fb6d6'; g.font = '700 28px system-ui, sans-serif'; g.fillText(m.status, W / 2, 280, 480);
    tex.needsUpdate = true;
  }
  /* ---- ferry ---- */
  let ferryObj: T.Object3D | null = null, deco: T.Group | null = null, decoKind: FerryKindId | null = null, lights: T.Group | null = null, t = 0;
  const decoCache = new Map<FerryKindId, T.Group>();
  function attached(o: T.Object3D, root: T.Object3D): boolean { let p: T.Object3D | null = o; while (p) { if (p === root) return true; p = p.parent; } return false; }

  return {
    board: () => model,
    debug: () => ({ boardIn: board.parent?.name ?? null, ferry: ferryObj ? ferryObj.name + '/' + ferryObj.type : null, ferryVisible: ferryObj?.visible ?? null, deco: decoKind, scale: ferryObj ? ferryObj.scale.toArray() : null, children: ferryObj?.children.map(c => c.name) ?? [] }),
    update(dt) {
      const rl = d.rules(), root = d.root();
      if (!rl || !root) return;
      t += dt;
      if (board.parent !== root) root.add(board);
      model = ferryBoardModel(rl.rt, rl.state.playT, rl.state.dayT, FERRY_T);
      const key = model.title + '|' + model.name + '|' + model.time + '|' + model.status;
      if (key !== lastKey) { lastKey = key; draw(model); }
      // ferry object (rebuilt with the zone): re-find when detached
      if (!ferryObj || !attached(ferryObj, root)) { ferryObj = root.getObjectByName('ferry') ?? null; while (ferryObj) { const c = ferryObj.children.find(k => k.name === 'ferry'); if (!c) break; ferryObj = c; } deco = null; decoKind = null; lights = null; }
      const f = ferryObj, info = rl.rt.ferryInfo; if (!f || !info) return;
      const kind = info.cur;
      if (kind !== decoKind) {
        if (deco) f.remove(deco);
        let g = decoCache.get(kind); if (!g) { g = buildDeco(kind); decoCache.set(kind, g); }
        deco = g; f.add(g); decoKind = kind;
        const s = FERRY_KINDS[kind].look.scale; f.scale.set(s[0], s[1], s[2]);
      }
      if (!lights) { lights = buildLights(); f.add(lights); }
      lights.visible = info.curLit && rl.rt.ferry.state !== 'away';
      if (lights.visible) lights.children.forEach((m, i) => { m.visible = ((t * 2 + i * 0.37) % 3) > 0.25; });
      const sm = deco?.getObjectByName('smoke');
      if (sm && f.visible) sm.children.forEach(o => {
        const k = ((t * 0.35 + (o.userData.ph as number)) % 1);
        o.position.set(Math.sin(k * 5 + (o.userData.ph as number) * 9) * 0.25, 6.4 + k * 3.2, k * 1.6);
        o.scale.setScalar(0.6 + k * 1.8);
        ((o as T.Mesh).material as T.MeshBasicMaterial).opacity = 0.8 * (1 - k);
      });
    },
    dispose() { board.parent?.remove(board); if (deco && ferryObj) ferryObj.remove(deco); if (lights && ferryObj) ferryObj.remove(lights); if (ferryObj) ferryObj.scale.set(1, 1, 1); tex.dispose(); },
  };
}
