/**
 * engine/core: seeded RNG streams (sfc32), typed event bus, logger, small math + hashing helpers.
 * Owner: Builder A. Pure: no three, no DOM, no wall clock, no unseeded randomness.
 * Decisions:
 * - Stream seeds derive from FNV-1a(name) mixed with the master seed, so stream order of creation never matters.
 * - Bus log is bounded (default 4000 records); `log(since)` indexes by absolute event count so trimming is invisible.
 */
import type { Bus, EventRecord, Logger, Rng, RngStreams, Disposer } from '../api';

// ───────────── hashing ─────────────

/** FNV-1a 32-bit over a string (UTF-16 code units). Returns unsigned int. */
export function fnv1a(s: string, h = 0x811c9dc5): number {
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
export function hex8(n: number): string { return (n >>> 0).toString(16).padStart(8, '0'); }

/** Feeds numbers into a running FNV-1a hash (float bits, exact). Reusable, no allocation per value. */
export function createHasher() {
  const f = new Float64Array(1);
  const u = new Uint32Array(f.buffer);
  let h = 0x811c9dc5;
  const mix = (x: number) => { h ^= x; h = Math.imul(h, 0x01000193); };
  return {
    reset() { h = 0x811c9dc5; },
    num(x: number) { f[0] = x; mix(u[0]); mix(u[1]); },
    str(s: string) { h = fnv1a(s, h); },
    arr(a: ArrayLike<number>, n = a.length) { for (let i = 0; i < n; i++) { f[0] = a[i]; mix(u[0]); mix(u[1]); } },
    value(): number { return h >>> 0; },
  };
}

/** Stable JSON (sorted object keys) for hashing/checksums independent of key insertion order. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).filter(k => o[k] !== undefined).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

// ───────────── rng ─────────────

function splitmix32(a: number) {
  return () => {
    a |= 0; a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16); t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15; t = Math.imul(t, 0x735a2d97);
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  const sm = splitmix32(seed >>> 0);
  let a = sm(), b = sm(), c = sm(), d = sm();
  const next = (): number => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const r = (t + d) | 0;
    c = (c + r) | 0;
    return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    weighted<K extends string>(w: Partial<Record<K, number>>): K {
      const keys = (Object.keys(w) as K[]).sort();
      let total = 0;
      for (const k of keys) total += Math.max(0, w[k] ?? 0);
      let r = next() * total;
      for (const k of keys) { r -= Math.max(0, w[k] ?? 0); if (r < 0) return k; }
      return keys[keys.length - 1];
    },
    chance: p => next() < p,
    getState: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
    setState(s) { [a, b, c, d] = s; },
  };
}

export interface RngStreamsExt extends RngStreams {
  /** Names of streams created so far (sorted) — used by sim.hash() and save. */
  names(): string[];
}
export function createRngStreams(seed: number): RngStreamsExt {
  const map = new Map<string, Rng>();
  return {
    seed,
    stream(name) {
      let r = map.get(name);
      if (!r) { r = createRng((fnv1a(name) ^ Math.imul(seed | 0, 0x9e3779b1)) >>> 0); map.set(name, r); }
      return r;
    },
    names: () => [...map.keys()].sort(),
  };
}

// ───────────── bus ─────────────

export function createBus<E extends object>(opts: { maxLog?: number; clock?: () => { tick: number; t: number } } = {}): Bus<E> {
  const maxLog = opts.maxLog ?? 4000;
  const clock = opts.clock ?? (() => ({ tick: 0, t: 0 }));
  const subs = new Map<string, Set<(d: unknown, r: EventRecord) => void>>();
  const any = new Set<(r: EventRecord) => void>();
  let logArr: EventRecord[] = [];
  let base = 0; // absolute index of logArr[0]
  let count = 0;
  const bus: Bus<E> = {
    emit(name, data) {
      const c = clock();
      const rec: EventRecord = { tick: c.tick, t: c.t, name, data };
      logArr.push(rec); count++;
      if (logArr.length > maxLog + (maxLog >> 2)) { const drop = logArr.length - maxLog; logArr = logArr.slice(drop); base += drop; }
      const s = subs.get(name);
      if (s) for (const cb of [...s]) { try { cb(data, rec); } catch (e) { console.error('[bus]', name, e); } }
      for (const cb of [...any]) { try { cb(rec); } catch (e) { console.error('[bus]', name, e); } }
    },
    on(name, cb) {
      let s = subs.get(name);
      if (!s) { s = new Set(); subs.set(name, s); }
      const f = cb as (d: unknown, r: EventRecord) => void;
      s.add(f);
      return () => { s!.delete(f); };
    },
    onAny(cb) { any.add(cb); return () => { any.delete(cb); }; },
    log(since = 0) { return logArr.slice(Math.max(0, since - base)); },
    get count() { return count; },
  };
  return bus;
}

// ───────────── logger ─────────────

export function createLogger(prefix: string): Logger {
  const p = `[${prefix}]`;
  return {
    info: (...a) => console.info(p, ...a),
    warn: (...a) => console.warn(p, ...a),
    error: (...a) => console.error(p, ...a),
  };
}
export const silentLogger: Logger = { info() {}, warn() {}, error() {} };

// ───────────── math ─────────────

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function angLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function once(fn: () => void): Disposer { let done = false; return () => { if (!done) { done = true; fn(); } }; }
