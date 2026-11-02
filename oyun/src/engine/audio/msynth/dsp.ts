// Martı Synth DSP core: plain JS sample math, no WebAudio graph. Everything here renders into Float32Arrays that
// become AudioBuffers once (sfx, ambience loops, music), so playback is a cheap buffer source and nothing is
// synthesised per frame. Deterministic (seeded) so a sound is the same every session.

export const SR_SFX = 32000;
export const SR_LOOP = 24000;
export const TAU = Math.PI * 2;

export class Rng {
  private s: number;
  constructor(seed = 1) { this.s = (seed >>> 0) || 1; }
  next(): number { let x = this.s; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; this.s = x >>> 0; return this.s / 4294967296; }
  range(a: number, b: number): number { return a + (b - a) * this.next(); }
  int(a: number, b: number): number { return Math.floor(this.range(a, b + 1)); }
  pick<T>(l: readonly T[]): T { return l[Math.floor(this.next() * l.length)]; }
}
export const hashSeed = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

export type Wave = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse';
/** One oscillator sample for a phase in [0,1). Saw/square get a cheap polyBLEP so high notes stay clean. */
export function osc(w: Wave, ph: number, dt: number, pw = 0.5): number {
  switch (w) {
    case 'sine': return Math.sin(ph * TAU);
    case 'triangle': return 1 - 4 * Math.abs(ph - 0.5);
    case 'sawtooth': return 2 * ph - 1 - blep(ph, dt);
    case 'square': case 'pulse': {
      const p = w === 'square' ? 0.5 : pw;
      let v = ph < p ? 1 : -1;
      v += blep(ph, dt); v -= blep((ph + 1 - p) % 1, dt);
      return v;
    }
  }
  return 0;
}
function blep(t: number, dt: number): number {
  if (dt <= 0) return 0;
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

export type NoiseColor = 'white' | 'pink' | 'brown';
export function noiseSrc(color: NoiseColor, rng: Rng): () => number {
  if (color === 'brown') { let b = 0; return () => { b = (b + 0.02 * (rng.next() * 2 - 1)) / 1.02; return b * 3.5; }; }
  if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    return () => {
      const w = rng.next() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      const o = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; return o;
    };
  }
  return () => rng.next() * 2 - 1;
}

export type FilterMode = 'lp' | 'bp' | 'hp' | 'notch';
/** Zero-delay-feedback state variable filter (stable under fast cutoff sweeps). */
export class Svf {
  private ic1 = 0; private ic2 = 0; private lf = -1; private lq = -1; private a1 = 0; private a2 = 0; private a3 = 0; private k = 1;
  constructor(private sr: number) {}
  run(x: number, f: number, q: number, mode: FilterMode): number {
    if (f !== this.lf || q !== this.lq) {
      this.lf = f; this.lq = q;
      const g = Math.tan(Math.PI * Math.min(f, this.sr * 0.45) / this.sr); this.k = 1 / Math.max(0.05, q);
      this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
    }
    const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    if (mode === 'lp') return v2;
    if (mode === 'bp') return v1;
    if (mode === 'hp') return x - this.k * v1 - v2;
    return x - this.k * v1;
  }
}

/** Envelope level at time t. d = time to fall ~40 dB toward s; r = release after `hold`. */
export function env(t: number, a: number, d: number, s: number, hold: number, r: number): number {
  if (t < 0) return 0;
  const at = (x: number) => x < a ? x / Math.max(1e-4, a) : s + (1 - s) * Math.exp(-(x - a) * 4.6 / Math.max(1e-3, d));
  if (t <= hold) return at(t);
  return at(hold) * Math.exp(-(t - hold) * 4.6 / Math.max(1e-3, r));
}

/** Freeverb-style mono reverb applied in place (tail must already fit in the buffer). */
export function reverb(buf: Float32Array, sr: number, mix: number, size = 0.78, damp = 0.35): void {
  for (const _ of reverbGen(buf, sr, mix, size, damp)) { /* run to the end */ }
}
/** Same reverb as a generator that yields every ~16k samples (for idle-sliced background renders). */
export function* reverbGen(buf: Float32Array, sr: number, mix: number, size = 0.78, damp = 0.35): Generator<void> {
  if (mix <= 0) return;
  const sc = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map(n => ({ b: new Float32Array(Math.max(8, Math.round(n * sc))), i: 0, f: 0 }));
  const aps = [556, 441, 341].map(n => ({ b: new Float32Array(Math.max(4, Math.round(n * sc))), i: 0 }));
  for (let n = 0; n < buf.length; n++) {
    const x = buf[n] * 0.12;
    let o = 0;
    for (const c of combs) {
      const y = c.b[c.i]; c.f = y * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * size; c.i = (c.i + 1) % c.b.length; o += y;
    }
    for (const a of aps) { const y = a.b[a.i]; const v = -o + y; a.b[a.i] = o + y * 0.5; a.i = (a.i + 1) % a.b.length; o = v; }
    buf[n] = buf[n] * (1 - mix * 0.5) + o * mix;
    if ((n & 16383) === 16383) yield;
  }
}

/** Feedback echo in place. */
export function echo(buf: Float32Array, sr: number, time: number, fb: number, mix: number): void {
  if (mix <= 0) return;
  const d = Math.max(1, Math.round(time * sr)), line = new Float32Array(d); let i = 0;
  for (let n = 0; n < buf.length; n++) { const y = line[i]; line[i] = buf[n] + y * fb; i = (i + 1) % d; buf[n] += y * mix; }
}

/** Karplus-Strong plucked string (saz / nylon guitar / harp), added into `out` at sample `at`. */
export function pluck(out: Float32Array, sr: number, at: number, f: number, dur: number, v: number, rng: Rng, bright = 0.5, damp = 0.996): void {
  const p = Math.max(2, Math.round(sr / f)), line = new Float32Array(p);
  for (let i = 0; i < p; i++) line[i] = (rng.next() * 2 - 1) * (0.6 + 0.4 * bright);
  // soften the excitation so low brightness reads as nylon, high as metal strings
  for (let k = 0; k < (bright > 0.6 ? 0 : 2); k++) for (let i = 1; i < p; i++) line[i] = (line[i] + line[i - 1]) * 0.5;
  const n = Math.min(out.length - at, Math.round(dur * sr)); let i = 0, prev = 0;
  const fadeN = Math.round(0.03 * sr);
  for (let s = 0; s < n; s++) {
    const y = line[i], nx = line[(i + 1) % p];
    line[i] = ((y + nx) * 0.5 * (1 - bright * 0.12) + y * bright * 0.12) * damp;
    i = (i + 1) % p;
    const o = y * 0.75 + prev * 0.25; prev = y;
    const fade = s > n - fadeN ? (n - s) / fadeN : 1;
    out[at + s] += o * v * fade;
  }
}

/** Soft clip / drive. amt 0..1 */
export const drive = (x: number, amt: number): number => amt <= 0 ? x : Math.tanh(x * (1 + amt * 12)) / Math.tanh(1 + amt * 12);
export const dbToLin = (db: number): number => db <= -59 ? 0 : Math.pow(10, db / 20);
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** 'C4', 'F#3', 'Bb2' or a number (Hz) -> Hz */
export function noteHz(n: string | number | undefined, dflt = 220): number {
  if (typeof n === 'number') return n;
  if (!n) return dflt;
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(n.trim());
  if (!m) return dflt;
  const st = NOTE[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return mtof(12 * (Number(m[3]) + 1) + st);
}
/** Normalise a buffer to a peak level (keeps quiet sounds quiet if they're already under it when `onlyDown`). */
export function normalize(buf: Float32Array, peak = 0.9, onlyDown = false): void {
  let m = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
  if (m < 1e-6) return;
  const k = peak / m; if (onlyDown && k >= 1) return;
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
}
/** Make a buffer loop seamlessly: crossfade the last `xf` seconds into the start, then drop them. */
export function seamless(buf: Float32Array, sr: number, xf: number): Float32Array {
  const n = Math.min(Math.round(xf * sr), Math.floor(buf.length / 3)), len = buf.length - n, out = buf.slice(0, len);
  for (let i = 0; i < n; i++) { const t = i / n, a = Math.sin(t * Math.PI / 2), b = Math.cos(t * Math.PI / 2); out[i] = buf[i] * a + buf[len + i] * b; }
  return out;
}
