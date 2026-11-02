/**
 * İskele geography and per-stage layout (pure data, no three, no DOM): v2 world.js constants, stageLayout(),
 * staticObstacles(), WALKABLE, benches, lamp posts, trophy spots. Ported 1:1 (numbers kept).
 * Vectors are plain {x, y, z} objects here (v2 used THREE.Vector3); views convert.
 */
export interface P3v { x: number; y: number; z: number; }
export interface Obstacle { x0: number; x1: number; z0: number; z1: number; tag?: string; }
export interface StageLayout {
  stations: Record<string, { x: number; z?: number; rotY: number }>;
  /** span: x range of the drawn counter top that Sabri can drop onto from behind (the drop zone runs along it) */
  counter: { pos: P3v; drop: P3v; standAt: P3v; span: [number, number] };
  queue: P3v[];
  kasa: { pos: P3v; pile: P3v };
  tables: { x: number; z: number; ax: 'x' | 'z' }[];
  window: { standAt: P3v; serve: P3v; queue: P3v[] };
  job: { board: [number, number, number]; pos: P3v };
  extraPads: Record<string, P3v>;
  cat: Record<string, P3v>;
  perch: [number, number, number, number][];
  dog: P3v;
  playerStart: P3v;
  door: { outside: P3v; inside: P3v } | null;
  slots: { pos: P3v; rotY: number; size: string }[];
  walkways: P3v[][];
}
const PI = Math.PI, HP = PI / 2;
export const WATER_Y = -1.0, SEAT_H = 0.45;
export const PIER = { x0: -10.5, x1: 8.4, z0: -13.4, z1: 4.4 };
export const BUFE = { x0: -4.2, x1: 4.2, z0: -10.6, z1: -4.4 };
export const GANG = { z0: -8.0, z1: -6.2 };
export const WIN_Z = -7.1;
export const NEXT_SIGN = { x: 6.3, z: -12.3, ry: 0.4 };
export const STATION_KINDS = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'] as const;
export type StationKind = typeof STATION_KINDS[number];
export const PARTS = ['kepenk', 'tabela', 'fayans', 'floresan', 'tezgah', 'boya'];
export const TABLE_PADS: Record<string, number> = { tabure1: 0, tabure2: 1, masa1: 2, masa2: 3, masa3: 4, masa4: 5 };
export const PAD_KEYS_FALLBACK = ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul', 'pencere', 'tepsi1', 'masa1', 'gazoz', 'miknatis', 'masa2', 'tost', 'tepsi2', 'tadilat', 'masa3', 'masa4'];
const V3 = (x = 0, y = 0, z = 0): P3v => ({ x, y, z });
const P3 = (x: number, z: number, y = 0): P3v => V3(x, y, z);
export const BENCHES: { pos: P3v; rotY: number }[] = [
  { pos: V3(-7.2, 0, -12.5), rotY: PI }, { pos: V3(1.2, 0, -12.55), rotY: PI }, { pos: V3(-9.85, 0, 3.0), rotY: -HP },
  { pos: V3(-30, 0, 5.95), rotY: PI }, { pos: V3(-12, 0, 5.95), rotY: PI }, { pos: V3(21, 0, 5.95), rotY: PI }, { pos: V3(41, 0, 5.95), rotY: PI }
];
export function benchSeats(bn: { pos: P3v; rotY: number }): P3v[] { const c = Math.cos(bn.rotY), s = Math.sin(bn.rotY); return [-0.55, 0, 0.55].map(lx => V3(bn.pos.x + lx * c + 0.05 * s, 0, bn.pos.z - lx * s + 0.05 * c)); }
/** Pier lamp posts (x, z). */
export const PIER_LAMPS: [number, number][] = [[-10.05, -10.6], [-10.05, -4.2], [-10.05, 2.2], [8.0, -11.4], [8.0, -3.4], [8.0, 2.4]];
export const local2world = (x: number, z: number, ry: number, lx: number, lz: number, y = 0): P3v => V3(x + lx * Math.cos(ry) + lz * Math.sin(ry), y, z - lx * Math.sin(ry) + lz * Math.cos(ry));
export function rectAABB(x: number, z: number, w: number, d: number, ry: number, tag?: string): Obstacle { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2; return { x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, tag }; }
export function trophySpots(stage: number): { x: number; y: number; z: number; s: number }[] {
  if (stage === 1) return Array.from({ length: 12 }, (_, i) => ({ x: -3.3 + i * 0.6, y: 2.52, z: -4.28, s: 1.5 }));
  return Array.from({ length: 12 }, (_, i) => ({ x: -1.6 + i * 0.36, y: 1.98, z: -10.25, s: 1.15 }));
}

export function stageLayout(stage: number): StageLayout {
  const s1 = stage === 1, s3 = stage >= 3;
  const L = {} as StageLayout;
  L.stations = s1 ? {
    gazoz: { x: -5.25, rotY: 0 }, simit: { x: -3.55, rotY: 0 }, cay: { x: -1.85, rotY: 0 }, doner: { x: 0.2, rotY: 0 }, ayran: { x: 2.35, rotY: 0 }, tost: { x: 3.95, rotY: 0 }
  } : {
    doner: { x: -2.75, z: -10.0, rotY: 0 }, cay: { x: -0.85, z: -10.0, rotY: 0 }, simit: { x: 1.05, z: -10.0, rotY: 0 }, tost: { x: 2.85, z: -10.0, rotY: 0 },
    ayran: { x: -3.61, z: -7.75, rotY: HP }, gazoz: { x: -3.61, z: -6.15, rotY: HP }
  };
  if (s1) {
    L.counter = { pos: P3(1.0, -1.35), drop: P3(1.0, -1.35, 0.91), standAt: P3(1.0, -2.05), span: [1.0, 1.0] };   // seyyar crate counter: the v2 circle (stations sit right behind it)
    L.queue = Array.from({ length: 8 }, (_, i) => P3(1.0, -0.45 + i * 0.8));
    L.kasa = { pos: P3(-0.2, -1.35, 0.98), pile: P3(-0.95, -2.2, 0.02) };
    L.tables = [[-2.4, 0.5], [-2.4, 2.7], [4.2, 0.5], [4.2, 2.7], [-6.0, 0.5], [-6.0, 2.7], [-8.4, -1.6], [-6.0, -1.6]].map(([x, z]) => ({ x, z, ax: 'x' as 'x' | 'z' }));
    L.window = { standAt: P3(4.95, WIN_Z), serve: P3(5.75, WIN_Z, 1.04), queue: [[6.5, WIN_Z], [7.2, WIN_Z], [7.05, -6.3], [7.05, -5.5], [7.05, -4.7], [7.05, -3.9]].map(([x, z]) => P3(x, z)) };
    L.job = { board: [-7.6, -3.5, 0], pos: P3(-7.6, -2.65) };
    L.extraPads = { tepsi1: P3(-4.4, -0.9), tepsi2: P3(6.0, -1.6), miknatis: P3(-0.55, 1.7), tadilat: P3(-7.2, -6.4), pencere: P3(5.75, -5.3) };
    L.cat = { awning: P3(-1.9, -3.75, 2.5), basket: P3(-4.85, -5.0, 0.2), stool: P3(2.95, -0.95, 0.48), roof: P3(2.8, -6.2, 2.85) };
    L.perch = [[-1.4, 4.22, -4.62, 0.2], [4.05, 2.86, -4.65, 0.6], [2.4, 0.91, -1.15, -0.5]];
    L.dog = P3(-1.35, -0.95);
    L.playerStart = P3(0.2, -2.6);
    L.door = null;
  } else {
    L.counter = { pos: P3(-0.25, -4.7), drop: P3(-0.25, -4.7, 1.06), standAt: P3(-0.25, -5.45), span: [-2.0, 2.0] };
    L.queue = Array.from({ length: 8 }, (_, i) => P3(-0.25, -3.75 + i * 0.8));
    L.kasa = { pos: P3(3.2, -4.55, 1.12), pile: P3(3.0, -5.35, 0.02) };
    L.tables = s3
      ? [[-2.0, -1.5, 'x'], [1.6, -1.5, 'x'], [-6.3, -8.8, 'z'], [-8.7, -8.8, 'z'], [-6.3, -5.9, 'z'], [-8.7, -5.9, 'z'], [-6.3, -3.0, 'z'], [-8.7, -3.0, 'z']].map(([x, z, ax]) => ({ x: x as number, z: z as number, ax: ax as 'x' | 'z' }))
      : [[-2.0, -1.5], [1.6, -1.5], [-3.0, 0.9], [2.6, 0.9], [-6.6, -1.4], [6.1, -0.9], [-6.6, 1.4], [-6.6, 3.5]].map(([x, z]) => ({ x, z, ax: 'x' as 'x' | 'z' }));
    L.window = { standAt: P3(3.45, WIN_Z), serve: P3(4.32, WIN_Z, 1.12), queue: [[4.95, WIN_Z], [5.75, WIN_Z], [6.55, WIN_Z], [6.6, -6.3], [6.6, -5.5], [6.6, -4.7]].map(([x, z]) => P3(x, z)) };
    L.job = s3 ? { board: [5.7, -1.0, -0.3], pos: P3(5.6, -0.1) } : { board: [-7.4, -4.6, 0], pos: P3(-7.4, -3.75) };
    L.extraPads = { tepsi1: P3(-0.9, -7.6), tepsi2: P3(1.1, -7.6), miknatis: P3(-1.4, 2.8), tadilat: s3 ? P3(3.0, 1.2) : P3(-7.4, -6.6), pencere: P3(5.6, -5.2) };
    L.cat = { awning: P3(-3.3, -4.0, 3.18), basket: P3(-4.85, -5.3, 0.2), stool: P3(-5.0, -3.55, 0.49), roof: P3(-3.4, -10.5, 2.7) };
    L.perch = [[1.5, 4.04, -10.56, 0.2], [4.1, 2.72, -10.5, 0.5], [2.1, 1.07, -4.45, -0.4], [-3.7, 3.31, -4.47, 0.3]];
    L.dog = P3(3.3, -3.75);
    L.playerStart = P3(0, -7.5);
    L.door = { outside: P3(-3.3, -3.7), inside: P3(-3.3, -5.2) };
  }
  L.perch.push([7.75, 0.58, -8.55, -HP], [7.75, 0.58, -5.65, -HP], [-10.4, 1.06, -6.0, HP], [-5.0, 1.06, -13.3, 0.3], [-10.4, 1.06, 1.0, HP]);
  const slots: [number, number, number, string][] = [
    [-9.6, -11.6, 0.6, 'm'], [-9.75, -8.0, HP, 'm'], [-9.75, -5.4, HP, 's'], [-9.75, -0.6, HP, 'm'], [-8.1, 3.6, 0.3, 's'], [-5.6, -6.2, 0, 's'],
    [6.4, -9.8, 0, 'm'], [7.75, -2.4, -HP, 's'], [7.75, 0.9, -HP, 'm'], [5.9, 3.8, -0.3, 's'], [-4.2, 3.7, 0, 's'], [-4.6, -12.2, 0, 'l']
  ];
  if (s3) { slots[1] = [-9.75, -7.35, HP, 's']; slots[2] = [-9.75, -4.45, HP, 's']; slots[3] = [-9.75, -1.4, HP, 'm']; slots[5] = [-5.2, -1.2, 0, 's']; }
  L.slots = slots.map(([x, z, r, s]) => ({ pos: P3(x as number, z as number), rotY: r as number, size: s as string }));
  L.walkways = [
    [P3(-60, 7.6), P3(60, 7.6)], [P3(60, 10.0), P3(-60, 10.0)],
    s3 ? [P3(2.5, 6.6), P3(6.6, 2.4), P3(7.0, -3.0), P3(7.0, -11.8), P3(-9.4, -11.95)]
       : [P3(2.5, 6.6), P3(6.6, 2.4), P3(7.0, -3.0), P3(7.0, -11.6), P3(-9.2, -11.8), P3(-9.3, -1.0), P3(-6.5, 3.4), P3(-3.0, 6.6)],
    s3 ? [P3(-3.0, 6.6), P3(-5.8, 2.8), P3(-5.8, -0.6)] : [P3(-1.8, 7.6), P3(-1.8, 3.6), P3(-4.6, 1.4)]
  ];
  return L;
}

export function staticObstacles(): Obstacle[] {
  const o: Obstacle[] = [];
  const add = (x0: number, x1: number, z0: number, z1: number, tag: string) => o.push({ x0, x1, z0, z1, tag });
  add(PIER.x0 - 0.4, PIER.x0 + 0.2, PIER.z0 - 0.4, PIER.z1, 'rail');
  add(PIER.x0 - 0.4, PIER.x1 + 0.4, PIER.z0 - 0.4, PIER.z0 + 0.2, 'rail');
  add(PIER.x1 - 0.2, PIER.x1 + 0.4, PIER.z0 - 0.4, GANG.z0, 'rail'); add(PIER.x1 - 0.2, PIER.x1 + 0.4, GANG.z1, PIER.z1, 'rail');
  add(-80, PIER.x0, PIER.z1 - 0.4, PIER.z1 + 0.45, 'rail'); add(PIER.x1, 80, PIER.z1 - 0.4, PIER.z1 + 0.45, 'rail');
  add(-80, 80, 13.3, 14.2, 'rail');
  [[-10.05, -10.6], [-10.05, -4.2], [-10.05, 2.2], [8.0, -11.4], [8.0, -3.4], [8.0, 2.4]].forEach(([x, z]) => add(x - 0.22, x + 0.22, z - 0.22, z + 0.22, 'lamp'));
  for (let x = -58; x <= 58; x += 10) if (x < PIER.x0 - 1 || x > PIER.x1 + 1) add(x - 0.22, x + 0.22, 4.83, 5.27, 'lamp');
  for (let x = -54; x <= 54; x += 9) add(x + 0.5 - 0.66, x + 0.5 + 0.66, 11.6 - 0.66, 11.6 + 0.66, 'tree');
  [[7.75, -8.55], [7.75, -5.65], [7.6, -12.85], [-9.95, -12.85]].forEach(([x, z]) => add(x - 0.25, x + 0.25, z - 0.25, z + 0.25, 'bollard'));
  BENCHES.forEach(b => { const c = Math.cos(b.rotY), s = Math.sin(b.rotY), bx = b.pos.x - 0.28 * s, bz = b.pos.z - 0.28 * c, hx = Math.abs(c) * 0.95 + Math.abs(s) * 0.12, hz = Math.abs(s) * 0.95 + Math.abs(c) * 0.12; add(bx - hx, bx + hx, bz - hz, bz + hz, 'bench'); });
  [[-9.75, 3.75], [7.65, 3.75]].forEach(([x, z]) => add(x - 0.58, x + 0.58, z - 0.3, z + 0.3, 'prop'));
  [[-14, 9.6], [12.5, 9.6]].forEach(([x, z]) => add(x - 1.12, x + 1.12, z - 0.52, z + 0.52, 'prop'));
  add(-10.0, -7.7, 3.6, 3.95, 'prop'); add(7.6, 7.9, -4.55, -4.25, 'prop');
  { const c = Math.cos(NEXT_SIGN.ry), s = Math.sin(NEXT_SIGN.ry), hx = c * 1.0 + s * 0.12, hz = s * 1.0 + c * 0.12; add(NEXT_SIGN.x - hx, NEXT_SIGN.x + hx, NEXT_SIGN.z - hz, NEXT_SIGN.z + hz, 'prop'); }
  add(-1.85, -1.35, -13.15, -12.65, 'prop');
  return o;
}
export const WALKABLE: Obstacle[] = [{ x0: PIER.x0 + 0.25, x1: PIER.x1 - 0.25, z0: PIER.z0 + 0.25, z1: PIER.z1 + 0.5 }, { x0: -62, x1: 62, z0: PIER.z1 + 0.45, z1: 13.3 }];
