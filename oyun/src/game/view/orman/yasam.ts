/**
 * Belgrad Ormanı yaşamı + 42B yolcuları (DNY-10/11, 2026-11-21). View only: walking people driven by the game clock.
 * - Every person is a spec: on(hour) says when they are out, pose(clock) where they are. A person is built when their
 *   hour comes and Sabri is in the forest, and released when it passes (no churn: checked once a second).
 * - Schedule: joggers early morning and evening, trekking groups and a dog walker by day, mangal families 11-19:30,
 *   bidon fillers at the fountain, bench sitters, a photographer at the monument oak, campers at the tents (round the
 *   fire after 18:00), two night walkers. Movement uses a clock that stops while the sim is paused.
 * - 42B: people wait at the shelter, walk to the front door and board when the doors open; two passengers step off
 *   at every stop (also with Sabri when the bus drops him), walk away and leave.
 */
import * as T from 'three';
import { ORMAN } from '../../../content/disari/martikoy';
import { BUS_REALMS as REALMS } from '../../../content/realm';
import type { BusView } from '../../sim/disari';

interface HeroLike { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void; dispose(): void }
export interface CharsLike { makeHero(o: never): unknown; makeDog?(o: Record<string, unknown>): unknown }
interface Pose { x: number; z: number; r: number; sp?: number; act?: string; carry?: number }
interface Spec { seed: number; dog?: boolean; on(h: number): boolean; pose(c: number): Pose }
export interface Yasam { update(dt: number, p: { x: number; z: number }, h: number, paused: boolean, bus: BusView | null): void; count(): number; dispose(): void }

const between = (h: number, a: number, b: number) => (a <= b ? h >= a && h < b : h >= a || h < b);
/** point at distance s along a closed polyline */
function along(pts: [number, number][], s: number): Pose {
  let L = 0; const seg: number[] = [];
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(l); L += l; }
  let d = ((s % L) + L) % L;
  for (let i = 0; i < pts.length; i++) { if (d <= seg[i]) { const a = pts[i], b = pts[(i + 1) % pts.length], k = d / seg[i]; return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, r: Math.atan2(b[0] - a[0], b[1] - a[1]) }; } d -= seg[i]; }
  return { x: pts[0][0], z: pts[0][1], r: 0 };
}
const pingpong = (x0: number, x1: number, z: number, v: number, c: number): Pose => { const L = x1 - x0, k = ((c * v) % (2 * L) + 2 * L) % (2 * L), fw = k < L; return { x: fw ? x0 + k : x1 - (k - L), z, r: fw ? Math.PI / 2 : -Math.PI / 2, sp: v }; };

export const MANGALS: { m: [number, number]; e: [number, number][] }[] = [
  { m: [826, 2.4], e: [[828.6, 4.2], [829.6, 3.4]] }, { m: [856, 2.0], e: [[853.6, 3.6], [854.6, 4.4]] }, { m: [865, 14.2], e: [[862.0, 13.4], [862.8, 12.4]] },
  { m: [838, -4.6], e: [[841.8, -5.4], [842.8, -6.4]] }, { m: [872, 5.4], e: [[874.2, 6.8], [870.4, 6.6]] }, { m: [846, 21.5], e: [[844.2, 20.2], [847.6, 20.0]] },
];

function forestSpecs(): Spec[] {
  const S: Spec[] = [], st = (x: number, z: number, r: number, act: string, carry = 0) => () => ({ x, z, r, act, carry });
  const C = ORMAN.cesme, K = ORMAN.kamp, fx = K.x + 0.4, fz = K.z + 1.2;
  MANGALS.forEach(({ m, e }, i) => {
    const on = (h: number) => between(h, 11 + (i % 3) * 0.4, 19.5 - (i % 2) * 0.5);
    S.push({ seed: 300 + i * 7, on, pose: st(m[0] - 0.9, m[1], Math.PI / 2, 'cut') });
    S.push({ seed: 320 + i * 5, on, pose: st(e[0][0], e[0][1], Math.atan2(m[0] - e[0][0], m[1] - e[0][1]), 'eat') });
    S.push({ seed: 340 + i * 3, on, pose: st(e[1][0], e[1][1], Math.atan2(m[0] - e[1][0], m[1] - e[1][1]), 'sip') });
  });
  // fountain: filling bidons, carrying them back
  S.push({ seed: 360, on: h => between(h, 7, 21), pose: st(C.x - 0.5, C.z + 1.45, Math.PI, 'pour') });
  S.push({ seed: 361, on: h => between(h, 8, 19), pose: c => { const k = (c * 0.05) % 1; return k < 0.5 ? { x: C.x + 1.3, z: C.z + 2.0, r: Math.PI + 0.4, act: 'pour' } : { ...pingpong(C.x + 1.3, C.x + 16, C.z + 1.9, 1.0, c), carry: 1 }; } });
  // trekking groups on the three trails (a guide leads, the group follows)
  for (let g = 0; g < 3; g++) for (let k = 0; k < 4; k++) {
    const z = ORMAN.trailsZ[g] + (k % 2 ? 0.45 : -0.35);
    S.push({ seed: 400 + g * 10 + k, on: h => between(h, 8.5 + g * 0.5, 18 - g * 0.5), pose: c => pingpong(806, 876, z, 1.0, c + g * 23 - k * 1.3) });
  }
  // joggers: two loops over the trails and cross paths; mornings and evenings
  const loopA: [number, number][] = [[818.4, -1.6], [850.6, -1.6], [850.6, 17.6], [818.4, 17.6]], loopB: [number, number][] = [[850.6, 9.4], [870.4, 9.4], [870.4, 17.4], [850.6, 17.4]];
  const jogOn = (h: number) => between(h, 6.5, 10.5) || between(h, 16.5, 20.5);
  S.push({ seed: 370, on: jogOn, pose: c => ({ ...along(loopA, c * 3.2), sp: 6, act: 'walk' }) });
  S.push({ seed: 371, on: jogOn, pose: c => ({ ...along(loopA, 51 - c * 3.0), sp: 6, act: 'walk' }) });
  S.push({ seed: 372, on: h => between(h, 7, 10) || between(h, 17, 20), pose: c => ({ ...along(loopB, c * 3.4 + 20), sp: 6, act: 'walk' }) });
  // dog walker on the middle trail
  S.push({ seed: 380, on: h => between(h, 7.5, 20), pose: c => ({ ...pingpong(812, 874, 9.7, 1.05, c + 9), act: 'walk' }) });
  S.push({ seed: 381, dog: true, on: h => between(h, 7.5, 20), pose: c => { const q = pingpong(812, 874, 9.7, 1.05, c + 9); return { ...q, x: q.x + Math.sin(q.r) * 1.2, z: 10.2 }; } });
  // bench sitters, photographer at the monument oak, campers
  ORMAN.bank.forEach((b, i) => S.push({ seed: 450 + i, on: h => between(h, 9 + i, 18 + i * 0.7), pose: st(b.x - 0.3 + i * 0.2, b.z + 0.08, 0, i === 1 ? 'phone' : 'sit') }));
  S.push({ seed: 455, on: h => between(h, 9, 18), pose: st(ORMAN.anit.x - 3.0, ORMAN.anit.z + 3.4, 2.5, 'phone') });
  S.push({ seed: 460, on: h => !between(h, 1.5, 7), pose: st(fx - 1.25, fz + 0.5, 1.9, 'sit') });
  S.push({ seed: 461, on: h => between(h, 8, 1.5), pose: st(fx + 1.2, fz + 0.6, -2.0, 'sip') });
  S.push({ seed: 462, on: h => between(h, 18, 1.5), pose: st(fx + 0.1, fz + 1.35, Math.PI, 'sit') });
  S.push({ seed: 463, on: h => between(h, 9.5, 17), pose: st(K.x - 2.6, K.z + 0.6, 0.3, 'phone') });
  // two night walkers with phone torches
  for (let k = 0; k < 2; k++) S.push({ seed: 470 + k, on: h => between(h, 20, 23.5), pose: c => ({ ...pingpong(810, 872, 9.0 + k * 0.6, 0.9, c - k * 0.9), act: 'walk' }) });
  return S;
}

export function createYasam(chars: CharsLike | null, parent: T.Group): Yasam {
  const group = new T.Group(); group.name = 'orman-yasam'; parent.add(group);
  const specs = forestSpecs();
  const live = new Map<number, HeroLike>();
  let clock = 0, checkT = 0, t = 0;
  const make = (sp: { seed: number; dog?: boolean }): HeroLike | null => {
    if (!chars) return null;
    try {
      const h = (sp.dog && chars.makeDog ? chars.makeDog({ coat: 'tan', name: 'Orman köpeği' }) : chars.makeHero({ kind: 'regular', seed: sp.seed } as never)) as HeroLike;
      group.add(h.object); return h;
    } catch { return null; }
  };
  const drop = (h: HeroLike) => { h.dispose(); group.remove(h.object); };
  // 42B passengers
  interface Pax { h: HeroLike; x: number; z: number; tx: number; tz: number; t: number; life: number; act: string }
  const pax: Pax[] = [];
  const waiting = new Map<string, HeroLike[]>(), cool = new Map<string, number>();
  let lastPhase = '';
  const door = (b: BusView) => ({ x: b.x + 1.5, z: b.z - 1.0 });
  const alight = (b: BusView, n: number) => {
    const d = door(b);
    for (let k = 0; k < n; k++) { const h = make({ seed: 500 + ((clock * 10) | 0) % 40 + k }); if (!h) continue; pax.push({ h, x: d.x + k * 0.4, z: d.z, tx: d.x + (k ? 5 : -4), tz: d.z + 4.2 + k * 0.6, t: 0, life: 7.5, act: 'walk' }); }
  };
  return {
    update(dt, p, h, paused, bus) {
      t += dt; if (!paused) clock += dt;
      const inForest = p.x > 780 && p.x < 900;
      if ((checkT -= dt) <= 0) {
        checkT = 1;
        specs.forEach((s, i) => { const want = inForest && s.on(h), have = live.get(i); if (want && !have) { const hh = make(s); if (hh) live.set(i, hh); } else if (!want && have) { drop(have); live.delete(i); } });
      }
      for (const [i, hh] of live) {
        const q = specs[i].pose(clock), moving = (q.sp || 0) > 0;
        hh.setPose({ x: q.x, z: q.z }, q.r);
        hh.setInput({ speed: q.sp || 0, carry: q.carry || 0, act: moving ? 'walk' : q.act || 'idle', mood: 'happy', t: t + i });
        hh.update(dt, 1);
      }
      // 42B: waiting people at the stop near Sabri, board when the doors open; passengers step off
      for (const r of REALMS) {
        const st = r.stop, near = Math.hypot(p.x - st.x, p.z - st.z) < 24, atThis = !!bus && Math.abs(bus.x - st.x) < 1 && Math.abs(bus.z - st.z) < 1;
        let w = waiting.get(r.id);
        const cd = (cool.get(r.id) || 0) - dt; cool.set(r.id, cd);
        if (near && !w && cd <= 0 && (!atThis || bus!.phase === 'geliyor')) { const a = make({ seed: 520 + r.id.length * 3 }), b = make({ seed: 527 + r.id.length }); w = [a, b].filter(Boolean) as HeroLike[]; waiting.set(r.id, w); }
        if (!w) continue;
        if (!near) { w.forEach(drop); waiting.delete(r.id); continue; }
        const boarding = atThis && bus!.phase === 'durakta' && !bus!.drop, k = boarding ? Math.min(1, bus!.t / 2.5) : 0, d = bus ? door(bus) : { x: st.x + 1.5, z: st.z - 1 };
        w.forEach((hh, j) => {
          const sx = st.x - 1.0 + j * 1.8, sz = st.z + 1.25 + j * 0.15, x = sx + (d.x - sx) * k, z = sz + (d.z - sz) * k;
          hh.setPose({ x, z }, boarding ? Math.atan2(d.x - sx, d.z - sz) : Math.PI); hh.setInput({ speed: boarding && k < 1 ? 1.2 : 0, act: boarding ? 'walk' : j ? 'sip' : 'phone', mood: 'happy', t: t + j }); hh.update(dt, 1);
        });
        if (boarding && bus!.t > 2.8) { w.forEach(drop); waiting.delete(r.id); cool.set(r.id, 45); }
      }
      const ph = bus ? bus.phase + (bus.drop ? 'd' : '') : '';
      if (ph !== lastPhase) { if (bus && (ph === 'durakta' || ph === 'gidiyord')) alight(bus, 2); lastPhase = ph; }
      for (let i = pax.length - 1; i >= 0; i--) {
        const q = pax[i]; q.t += dt;
        const dx = q.tx - q.x, dz = q.tz - q.z, L = Math.hypot(dx, dz), v = 1.25 * dt;
        if (L > 0.05) { q.x += dx / L * Math.min(v, L); q.z += dz / L * Math.min(v, L); }
        if (L < 0.3) { q.tx += Math.sign(q.tx - q.x || 1) * 6; }
        q.h.setPose({ x: q.x, z: q.z }, Math.atan2(dx, dz)); q.h.setInput({ speed: 1.2, act: 'walk', mood: 'happy', t: t + i }); q.h.update(dt, 1);
        if (q.t > q.life) { drop(q.h); pax.splice(i, 1); }
      }
    },
    count: () => live.size + pax.length + [...waiting.values()].reduce((a, w) => a + w.length, 0),
    dispose() { for (const h of live.values()) drop(h); live.clear(); pax.forEach(q => drop(q.h)); pax.length = 0; for (const w of waiting.values()) w.forEach(drop); waiting.clear(); parent.remove(group); },
  };
}
