/**
 * Anchor lookups over the zone anchor record (names are B's flattened v2 W.anchors: 'queue.0', 'counter.standAt',
 * 'stations.cay.standAt', 'tables.2', 'catSpots.awning', 'gullPerches.3', 'dogSpot', 'jobCorner', 'kasa.pile',
 * 'walkways.0.4', 'spawn.1', 'benches.2.seat.1'). Every getter has a v2 stage-1 fallback so headless runs work
 * without a world view. Pure.
 */
import type { AnchorDef, Vec2 } from '../../../engine/api';
import type { StageLayout } from '../../../content/prefabs/iskele/layout';
import { STATION_KINDS } from '../../../content/prefabs/iskele/layout';
import { standAt, outAt, stationPose } from '../stations';

export type AnchorFn = (zone: string) => Record<string, AnchorDef>;
export interface P3 extends Vec2 { y: number; rotY: number }

const FALLBACK: Record<string, [number, number, number?, number?]> = {
  'queue.0': [3.4, -1.0], 'queue.1': [4.4, -1.0], 'counter': [2.0, -2.9], 'counter.drop': [2.0, -2.9], 'counter.standAt': [2.0, -2.2],
  'kasa': [3.4, -2.6], 'kasa.pile': [3.4, -2.2], 'jobCorner': [-2.8, -2.4],
  'stations.doner.standAt': [-1.4, -2.2], 'stations.doner.out': [-1.4, -3.0], 'stations.doner': [-1.4, -3.2],
  'stations.cay.standAt': [0.2, -2.2], 'stations.cay.out': [0.2, -3.0], 'stations.cay': [0.2, -3.2],
  'stations.ayran.standAt': [1.0, -2.2], 'stations.simit.standAt': [1.8, -2.2], 'stations.tost.standAt': [-0.6, -2.2], 'stations.gazoz.standAt': [2.6, -2.2],
  'catSpots.awning': [-0.5, -3.0, 1.2], 'catSpots.basket': [0.8, -3.0, 0.9], 'catSpots.stool': [2.95, -0.95, 0.4], 'catSpots.bench': [-8, 4, 0.5],
  'dogSpot': [3.9, -2.0], 'spawn.0': [-60, 8.8], 'spawn.1': [60, 8.8],
};

export interface AnchorBook {
  get(name: string): P3;
  has(name: string): boolean;
  /** All anchors whose name starts with `prefix`, sorted by name (natural order for indices). */
  list(prefix: string): { name: string; a: P3 }[];
  spawns(): P3[];
  stationStand(p: string): P3;
  stationOut(p: string): P3;
  stationPos(p: string): P3;
  queue(i: number): P3;
  queueCount(): number;
  tablePos(i: number): P3;
  catSpots(): { name: string; a: P3 }[];
  gullPerches(): P3[];
}

export function createAnchorBook(anchors: AnchorFn, zone = 'iskele'): AnchorBook {
  let rec: Record<string, AnchorDef> = {};
  const refresh = () => { try { rec = anchors(zone) || {}; } catch { rec = {}; } };
  const conv = (d: AnchorDef): P3 => ({ x: d.pos.x, z: d.pos.z, y: d.y || 0, rotY: d.rotY || 0 });
  const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
  const book: AnchorBook = {
    get(name) {
      refresh();
      const d = rec[name]; if (d) return conv(d);
      const f = FALLBACK[name]; if (f) return { x: f[0], z: f[1], y: f[2] || 0, rotY: f[3] || 0 };
      // station fallbacks by suffix
      const m = /^stations\.(\w+)\.(standAt|out)$/.exec(name);
      if (m) { const s = FALLBACK['stations.doner.standAt']; return { x: s[0], z: s[1], y: 0, rotY: 0 }; }
      return { x: 0, z: -2.2, y: 0, rotY: 0 };
    },
    has(name) { refresh(); return !!rec[name]; },
    list(prefix) {
      refresh();
      return Object.keys(rec).filter((k) => k.startsWith(prefix)).sort(natural).map((name) => ({ name, a: conv(rec[name]) }));
    },
    spawns() {
      const l = book.list('spawn.').map((e) => e.a);
      if (l.length) return l;
      return [book.get('spawn.0'), book.get('spawn.1')];
    },
    stationStand: (p) => book.get('stations.' + p + '.standAt'),
    stationOut: (p) => book.get('stations.' + p + '.out'),
    stationPos: (p) => book.get('stations.' + p),
    queue: (i) => book.get('queue.' + i),
    queueCount() { return Math.max(2, book.list('queue.').filter((e) => /^queue\.\d+$/.test(e.name)).length); },
    tablePos: (i) => book.get('tables.' + i),
    catSpots() {
      const l = book.list('catSpots.').filter((e) => /^catSpots\.\w+$/.test(e.name));
      if (l.length) return l;
      return ['awning', 'basket', 'stool', 'bench'].map((k) => ({ name: 'catSpots.' + k, a: book.get('catSpots.' + k) }));
    },
    gullPerches() {
      const l = book.list('gullPerches.').filter((e) => /^gullPerches\.\d+$/.test(e.name)).map((e) => e.a).filter((a) => a.y <= 2.2);   // 2026-10-25: nothing hangs on the roof
      if (l.length) return l;
      return [{ x: -6, z: -10, y: 2.4, rotY: 0 }, { x: -2, z: -10.5, y: 2.4, rotY: 0.4 }, { x: 4, z: -10, y: 2.4, rotY: -0.3 }, { x: 8, z: -9.5, y: 2.4, rotY: 0 }];
    },
  };
  return book;
}


/** Zone-anchor-shaped record built from the pure stage layout (headless runs, or before the world view exists). */
export function layoutAnchors(L: StageLayout): Record<string, AnchorDef> {
  const a: Record<string, AnchorDef> = {};
  const put = (k: string, p: { x: number; z: number; y?: number }, rotY?: number, kind?: string) => { a[k] = { pos: { x: p.x, z: p.z }, y: p.y || 0, rotY, kind }; };
  L.queue.forEach((v, i) => put('queue.' + i, v, undefined, 'queue'));
  put('counter', L.counter.pos); put('counter.drop', L.counter.drop); put('counter.standAt', L.counter.standAt);
  put('kasa', L.kasa.pos); put('kasa.pile', L.kasa.pile);
  for (const k of STATION_KINDS) {
    const p = stationPose(L, k);
    put('stations.' + k, p, p.ry, 'station'); put('stations.' + k + '.standAt', standAt(L, k), p.ry); put('stations.' + k + '.out', outAt(L, k));
  }
  L.tables.forEach((t, i) => put('tables.' + i, t));
  put('jobCorner', L.job.pos);
  for (const k in L.cat) put('catSpots.' + k, L.cat[k]);
  put('dogSpot', L.dog);
  L.perch.forEach(([x, y, z, r], i) => put('gullPerches.' + i, { x, y, z }, r, 'perch'));
  L.walkways.forEach((w, i) => w.forEach((v, j) => put('walkways.' + i + '.' + j, v)));
  put('playerStart', L.playerStart, undefined, 'spawn');
  return a;
}
