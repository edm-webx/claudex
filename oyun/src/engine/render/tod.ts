/**
 * Time-of-day key table (v2 world.js TOD, GDD "Gün içinde ışık"), 08:00..27:00 (03:00), eased blend between keys.
 * The four phases (morning 08-11, noon 11-16, sunset 18-19.5, night 20.6+) come out of these keys exactly as in v2.
 * GRS-01: table value = the value on screen. The 2026-11-02 darkening (owner: far too bright/glaring; sun 0.8x, ambient 0.66x)
 * used to be a multiplier inside todAt; it is baked into the si / hi columns now (hava-look reads the same numbers).
 * GRS-02: 27..32 is the visual dawn corridor after the gün sonu card (render/index.ts, boot-saat.ts): 29.5 cold grey-blue before
 * dawn, 32 = an exact copy of 08:00, so the hand-over from the corridor to the real morning has no step.
 */
import * as T from 'three';
import { clamp } from '../prefab/batch';
import type { DayPhase } from '../api';
export interface TodKey { h: number; top: string; hor: string; low: string; fog: string; sun: string; si: number; az: number; el: number; hs: string; hg: string; hi: number; deep: string; sh: string; sky2: string; n: number; /** fog distance multiplier (sky.ts v2 near/far rule): < 1 = closer haze, > 1 = clearer distance */ fd: number; }
export interface Tod { top: T.Color; hor: T.Color; low: T.Color; fog: T.Color; sun: T.Color; si: number; az: number; el: number; hs: T.Color; hg: T.Color; hi: number; deep: T.Color; sh: T.Color; sky2: T.Color; n: number; fd: number; }
/*
 * GRS-02 palette (owner S-019 "biraz koyuluk", S-060 "aşırı pastel", B-010/B-016): the v2 key hours, light strengths (si/hi) and sun path
 * stay; the sky / horizon / fog colours move out of the milky pastel band (less white, more colour) and two keys are added:
 * - 17.25 golden hour start: the sun turns amber and low an hour earlier, so 17.30-18.30 is a long warm stretch with long shadows;
 * - 20.05 blue hour: between the orange sunset and the night, a deep blue-violet sky instead of a straight fade to navy.
 * Morning is cold blue above a warm orange horizon; noon is a saturated blue; night stays the v2 blue-violet depth.
 */
export const TOD: TodKey[] = [
  { h: 8, top: '#5a9ddb', hor: '#f0c39a', low: '#a9c3d3', fog: '#d8cdbf', sun: '#ffdcaa', si: 1.68, az: 1.2, el: 0.45, hs: '#d2e6fb', hg: '#8a8070', hi: 0.957, deep: '#3486c0', sh: '#5fb8d4', sky2: '#c9dcea', n: 0, fd: 0.9 },
  { h: 11, top: '#3d92dc', hor: '#bad8ea', low: '#94bfd6', fog: '#bcd4e0', sun: '#fff0cf', si: 1.92, az: 0.55, el: 0.98, hs: '#d8ecff', hg: '#968670', hi: 0.957, deep: '#2a80be', sh: '#52b1d4', sky2: '#b4d8ee', n: 0, fd: 1.1 },
  { h: 16, top: '#4692d8', hor: '#d6d0bc', low: '#98bdd4', fog: '#c8d2d4', sun: '#ffe6b6', si: 1.88, az: -0.45, el: 0.8, hs: '#e0ecfc', hg: '#968670', hi: 0.924, deep: '#2a80be', sh: '#52b1d4', sky2: '#bcd8ea', n: 0, fd: 1.1 },
  { h: 17.25, top: '#5a86c8', hor: '#ffbb7c', low: '#c49c94', fog: '#ddb898', sun: '#ffbe76', si: 1.8, az: -0.8, el: 0.55, hs: '#eedcc6', hg: '#8a7062', hi: 0.86, deep: '#3080b6', sh: '#5eaec8', sky2: '#e6c6a6', n: 0, fd: 1.0 },
  { h: 18, top: '#6a7cc0', hor: '#ff9a58', low: '#d07e78', fog: '#e09c7c', sun: '#ff9c52', si: 1.68, az: -1.05, el: 0.34, hs: '#f2ccaa', hg: '#765a52', hi: 0.792, deep: '#367aac', sh: '#64a8c2', sky2: '#eeb48e', n: 0, fd: 0.98 },
  { h: 19.5, top: '#3e4290', hor: '#ec6a50', low: '#8e4e72', fog: '#9a5a74', sun: '#ff7a44', si: 1.08, az: -1.3, el: 0.12, hs: '#c0a0bc', hg: '#56405a', hi: 0.66, deep: '#2e5a8a', sh: '#5288ac', sky2: '#d4826c', n: 0.35, fd: 0.95 },
  { h: 20.05, top: '#262c6c', hor: '#90588e', low: '#33336a', fog: '#3e3e7a', sun: '#b490c4', si: 0.75, az: -1.0, el: 0.4, hs: '#948cc8', hg: '#3a2e48', hi: 0.64, deep: '#264c7c', sh: '#3a6a98', sky2: '#5e5494', n: 0.7, fd: 0.92 },
  { h: 20.6, top: '#1a2050', hor: '#313c7a', low: '#1e2852', fog: '#283268', sun: '#8fa8ff', si: 0.48, az: -0.6, el: 0.75, hs: '#7a80c8', hg: '#30283e', hi: 0.627, deep: '#1f3a66', sh: '#2f5a88', sky2: '#464680', n: 1, fd: 0.9 },
  { h: 24, top: '#181640', hor: '#2c285a', low: '#201d48', fog: '#2a265a', sun: '#8fa8ff', si: 0.44, az: -0.5, el: 0.8, hs: '#7078c0', hg: '#2a2438', hi: 0.594, deep: '#1b345e', sh: '#2a5282', sky2: '#3e3c78', n: 1, fd: 0.9 },
  // survey 2026-10-24: after midnight the pier goes deep and quiet until 03:00
  { h: 27, top: '#0e0d2c', hor: '#1c1940', low: '#141234', fog: '#1b1942', sun: '#7f96f0', si: 0.336, az: -0.45, el: 0.85, hs: '#5e66a8', hg: '#1e1a2c', hi: 0.495, deep: '#132a4e', sh: '#203f6a', sky2: '#2a285c', n: 1, fd: 0.88 },
  // GRS-02 dawn corridor (visual only, the sim is already at 08:00): cold grey-blue first light, then the 08:00 key again
  { h: 29.5, top: '#1b2146', hor: '#4a4470', low: '#2a2a52', fog: '#3a3a68', sun: '#9aa8ff', si: 0.4, az: -0.45, el: 0.85, hs: '#6a70b0', hg: '#26223a', hi: 0.52, deep: '#173055', sh: '#28486f', sky2: '#3a3a6a', n: 0.85, fd: 0.88 },
  { h: 32, top: '#5a9ddb', hor: '#f0c39a', low: '#a9c3d3', fog: '#d8cdbf', sun: '#ffdcaa', si: 1.68, az: 1.2, el: 0.45, hs: '#d2e6fb', hg: '#8a8070', hi: 0.957, deep: '#3486c0', sh: '#5fb8d4', sky2: '#c9dcea', n: 0, fd: 0.9 },
];
/** Interpolated time-of-day values (colours are fresh THREE.Color objects). Catmull-Rom through the keys: no sudden steps at key hours. */
const cr = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
const KC: Record<string, T.Color[]> = {};
for (const key of ['top', 'hor', 'low', 'fog', 'sun', 'hs', 'hg', 'deep', 'sh', 'sky2']) KC[key] = TOD.map(k => new T.Color((k as unknown as Record<string, string>)[key]));
/** visual hours past the end of the game day: 27..32 dawn corridor (32 = 08:00) */
export const DAWN_EXTRA = 5;
export function todAt(h: number): Tod {
  h = clamp(h, 8, 27 + DAWN_EXTRA);
  let i = 0; while (i < TOD.length - 2 && h > TOD[i + 1].h) i++;
  const a = TOD[i], b = TOD[i + 1], t = clamp((h - a.h) / (b.h - a.h), 0, 1);
  const i0 = Math.max(0, i - 1), i3 = Math.min(TOD.length - 1, i + 2);
  const o: Record<string, unknown> = {};
  for (const key in KC) {
    const c = KC[key], r = new T.Color();
    r.r = clamp(cr(c[i0].r, c[i].r, c[i + 1].r, c[i3].r, t), 0, 1); r.g = clamp(cr(c[i0].g, c[i].g, c[i + 1].g, c[i3].g, t), 0, 1); r.b = clamp(cr(c[i0].b, c[i].b, c[i + 1].b, c[i3].b, t), 0, 1);
    o[key] = r;
  }
  const num = (key: 'si' | 'hi' | 'az' | 'el' | 'fd'): number => cr(TOD[i0][key], a[key], b[key], TOD[i3][key], t);
  o.si = Math.max(0, num('si')); o.hi = Math.max(0, num('hi')); o.az = num('az'); o.el = num('el'); o.fd = clamp(num('fd'), 0.6, 1.1);
  o.n = clamp(cr(TOD[i0].n, a.n, b.n, TOD[i3].n, t), 0, 1);
  return o as unknown as Tod;
}

export function phaseAt(h: number): DayPhase { return h < 11 ? 'morning' : h < 17 ? 'noon' : h < 20.2 ? 'sunset' : 'night'; }
