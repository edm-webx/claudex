/** Small pure helpers shared by the M1 rule modules. Owner: Builder A. */
import type { Vec2 } from '../../engine/api';
import { GAME_DAY_S, DAY_START_H, DAY_END_H } from '../../engine/api';
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const near2 = (a: Vec2, b: Vec2, r: number): boolean => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r;
export const dist2d = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const hourOf = (dayT: number): number => DAY_START_H + (DAY_END_H - DAY_START_H) * clamp(dayT / GAME_DAY_S, 0, 1);
export const inHours = (hrs: [number, number][] | undefined, h: number): boolean => (hrs || []).some(([a, b]) => h >= a && h < b);
export const r1 = (v: number): number => Math.round(v * 10) / 10;
export const compactNum = (v: number): string => {
  const a = Math.abs(v);
  const q = (d: number, u: string) => { const x = Math.round((a / d) * 10) / 10; return (v < 0 ? '-' : '') + (x % 1 === 0 ? String(x) : x.toFixed(1)) + u; };
  if (a >= 1e12) return q(1e12, 'T'); if (a >= 1e9) return q(1e9, 'B'); if (a >= 1e6) return q(1e6, 'M');
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};
export const fmtMoney = (v: number): string => compactNum(v) + ' ₺';
/** Point `dist` metres before the end of the polyline from->...->to (or `from` when shorter). */
export function pointBack(pts: Vec2[], dist: number): Vec2 {
  let acc = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    const d = dist2d(pts[i], pts[i - 1]);
    if (acc + d >= dist && d > 0) { const k = (dist - acc) / d; return { x: lerp(pts[i].x, pts[i - 1].x, k), z: lerp(pts[i].z, pts[i - 1].z, k) }; }
    acc += d;
  }
  return { x: pts[0].x, z: pts[0].z };
}
export const hashStr = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
