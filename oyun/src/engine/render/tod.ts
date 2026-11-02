/**
 * Time-of-day key table (v2 world.js TOD, GDD "Gün içinde ışık"), 08:00..24:00, eased blend between keys.
 * The four phases (morning 08-11, noon 11-16, sunset 18-19.5, night 20.6+) come out of these keys exactly as in v2.
 */
import * as T from 'three';
import { clamp } from '../prefab/batch';
import type { DayPhase } from '../api';
export interface TodKey { h: number; top: string; hor: string; low: string; fog: string; sun: string; si: number; az: number; el: number; hs: string; hg: string; hi: number; deep: string; sh: string; sky2: string; n: number; }
export interface Tod { top: T.Color; hor: T.Color; low: T.Color; fog: T.Color; sun: T.Color; si: number; az: number; el: number; hs: T.Color; hg: T.Color; hi: number; deep: T.Color; sh: T.Color; sky2: T.Color; n: number; }
export const TOD: TodKey[] = [
  { h: 8, top: '#6aaee3', hor: '#f4dfc6', low: '#b6cfdc', fog: '#e4e2da', sun: '#ffe6bd', si: 2.1, az: 1.2, el: 0.45, hs: '#d6ebff', hg: '#8d8578', hi: 1.45, deep: '#3a8cc4', sh: '#66bfd9', sky2: '#cfe6f2', n: 0 },
  { h: 11, top: '#4a9fe4', hor: '#d6e8f0', low: '#a2c9da', fog: '#cfe2ea', sun: '#fff1d2', si: 2.4, az: 0.55, el: 0.98, hs: '#dcefff', hg: '#9a8a74', hi: 1.45, deep: '#2f86c2', sh: '#5ab8d8', sky2: '#c4e4f4', n: 0 },
  { h: 16, top: '#559fe0', hor: '#e8e0cc', low: '#a6c8dc', fog: '#d8e0e2', sun: '#ffe9bd', si: 2.35, az: -0.45, el: 0.8, hs: '#e3efff', hg: '#9a8a74', hi: 1.4, deep: '#2f86c2', sh: '#5ab8d8', sky2: '#c8e2f0', n: 0 },
  { h: 18, top: '#7a8cc8', hor: '#ffab6b', low: '#d98f86', fog: '#eab08f', sun: '#ffa660', si: 2.1, az: -1.05, el: 0.34, hs: '#f6d6b8', hg: '#7a6058', hi: 1.2, deep: '#3c7fb0', sh: '#6cb0c8', sky2: '#f2c4a0', n: 0 },
  { h: 19.5, top: '#4a4e92', hor: '#f0785e', low: '#9c5c78', fog: '#a8687c', sun: '#ff8450', si: 1.35, az: -1.3, el: 0.12, hs: '#c8a8c0', hg: '#5a4458', hi: 1.0, deep: '#33608e', sh: '#5a8eb0', sky2: '#d8907a', n: 0.35 },
  { h: 20.6, top: '#1c2350', hor: '#35407a', low: '#202a52', fog: '#2a3468', sun: '#8fa8ff', si: 0.6, az: -0.6, el: 0.75, hs: '#7a80c8', hg: '#30283e', hi: 0.95, deep: '#1f3a66', sh: '#2f5a88', sky2: '#4a4880', n: 1 },
  { h: 24, top: '#1a1840', hor: '#2e2a5a', low: '#221f48', fog: '#2c285a', sun: '#8fa8ff', si: 0.55, az: -0.5, el: 0.8, hs: '#7078c0', hg: '#2a2438', hi: 0.9, deep: '#1b345e', sh: '#2a5282', sky2: '#403e78', n: 1 },
  // survey 2026-10-24: after midnight the pier goes deep and quiet until 03:00
  { h: 27, top: '#0f0e2c', hor: '#1d1a40', low: '#151334', fog: '#1c1a42', sun: '#7f96f0', si: 0.42, az: -0.45, el: 0.85, hs: '#5e66a8', hg: '#1e1a2c', hi: 0.75, deep: '#132a4e', sh: '#203f6a', sky2: '#2c2a5c', n: 1 },
];
/** Interpolated time-of-day values (colours are fresh THREE.Color objects). Catmull-Rom through the keys: no sudden steps at key hours. */
const cr = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const KC: Record<string, T.Color[]> = {};
for (const key of ['top', 'hor', 'low', 'fog', 'sun', 'hs', 'hg', 'deep', 'sh', 'sky2']) KC[key] = TOD.map(k => new T.Color((k as unknown as Record<string, string>)[key]));
export function todAt(h: number): Tod {
  h = clamp(h, 8, 27);
  let i = 0; while (i < TOD.length - 2 && h > TOD[i + 1].h) i++;
  const a = TOD[i], b = TOD[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const i0 = Math.max(0, i - 1), i3 = Math.min(TOD.length - 1, i + 2);
  const o: Record<string, unknown> = {};
  for (const key in KC) {
    const c = KC[key], r = new T.Color();
    r.r = clamp(cr(c[i0].r, c[i].r, c[i + 1].r, c[i3].r, t), 0, 1); r.g = clamp(cr(c[i0].g, c[i].g, c[i + 1].g, c[i3].g, t), 0, 1); r.b = clamp(cr(c[i0].b, c[i].b, c[i + 1].b, c[i3].b, t), 0, 1);
    o[key] = r;
  }
  const num = (key: 'si' | 'hi' | 'az' | 'el'): number => cr(TOD[i0][key], a[key], b[key], TOD[i3][key], t);
  o.si = Math.max(0, num('si')); o.hi = Math.max(0, num('hi')); o.az = num('az'); o.el = num('el');
  o.n = clamp(cr(TOD[i0].n, a.n, b.n, TOD[i3].n, t), 0, 1);
  return o as unknown as Tod;
}

export function phaseAt(h: number): DayPhase { return h < 11 ? 'morning' : h < 17 ? 'noon' : h < 20.2 ? 'sunset' : 'night'; }
