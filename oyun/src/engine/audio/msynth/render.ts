// Martı Synth renderer: turns the JSON recipes of content/ses/ses-db.json into sample arrays.
// A recipe is a list of layers (tone / noise / pluck / omni / burst) mixed together, then optional echo + reverb.
// Ambience loops use the same layers with `swell` (slow amplitude waves) and are made seamless.
import { Rng, Svf, osc, noiseSrc, env, reverb, reverbGen, echo, pluck, drive, noteHz, normalize, seamless, hashSeed, type Wave, type NoiseColor, type FilterMode } from './dsp';
import { renderOmni, type OmniPatch } from './omni';

export interface FiltSpec { type: FilterMode; f: number; f1?: number; q?: number; gt?: number }
export interface SwellSpec { rate: number; depth: number; ph?: number; rand?: number }
interface LayerBase { at?: number; v?: number; a?: number; d?: number; s?: number; hold?: number; r?: number; filter?: FiltSpec; swell?: SwellSpec; drive?: number }
export interface ToneLayer extends LayerBase { k: 'tone'; wave?: Wave; f: number | string; f1?: number | string; gt?: number; pw?: number; detune?: number; fm?: { ratio: number; index: number; decay?: number }; vib?: { rate: number; depth: number }; harm?: number[] }
export interface NoiseLayer extends LayerBase { k: 'noise'; color?: NoiseColor }
export interface PluckLayer extends LayerBase { k: 'pluck'; f: number | string; bright?: number; damp?: number }
export interface OmniLayer extends LayerBase { k: 'omni'; patch: string | OmniPatch; note?: number | string }
export interface BurstLayer { k: 'burst'; at?: number; n: number; every: [number, number]; layer: Layer; fJit?: number; vJit?: number }
export type Layer = ToneLayer | NoiseLayer | PluckLayer | OmniLayer | BurstLayer;
export interface SfxDef { layers: Layer[]; gain?: number; rev?: number; echo?: [number, number, number]; pitchVar?: number; cooldown?: number; len?: number; note?: string }
export interface LoopDef { dur: number; layers: Layer[]; gain?: number; rev?: number; xf?: number; events?: { every: [number, number]; layer: Layer; vJit?: number }[]; note?: string }

export interface RenderCtx { sr: number; patches: Record<string, OmniPatch> }

function layerLen(L: Layer): number {
  if (L.k === 'burst') return (L.at || 0) + L.n * L.every[1] + layerLen(L.layer);
  const a = L.a ?? 0.004, d = L.d ?? 0.2, hold = L.hold ?? (a + d), r = L.r ?? 0.04;
  if (L.k === 'pluck') return (L.at || 0) + (L.hold ?? 1.2);
  return (L.at || 0) + hold + r;
}
export function recipeLen(def: SfxDef): number {
  const base = def.len ?? Math.max(0.02, ...def.layers.map(layerLen));
  return base + (def.rev ? 0.8 : 0) + (def.echo ? def.echo[0] * 4 : 0);
}

/** Mix one layer into `out`. `pitch` scales every frequency (variation), `span` forces a loop layer length. */
export function renderLayer(out: Float32Array, L: Layer, rc: RenderCtx, rng: Rng, off = 0, pitch = 1, span?: number): void {
  const sr = rc.sr;
  if (L.k === 'burst') {
    let t = off + (L.at || 0);
    for (let i = 0; i < L.n; i++) {
      const p = pitch * (1 + (rng.next() * 2 - 1) * (L.fJit ?? 0.1));
      const sub = { ...L.layer, v: ((L.layer as LayerBase).v ?? 0.3) * (1 - (L.vJit ?? 0.3) * rng.next()) } as Layer;
      renderLayer(out, sub, rc, rng, t, p);
      t += rng.range(L.every[0], L.every[1]);
    }
    return;
  }
  const at = off + (L.at || 0), i0 = Math.round(at * sr);
  const a = L.a ?? 0.004, d = L.d ?? 0.2, s = L.s ?? 0, r = L.r ?? 0.04;
  const hold = span ?? L.hold ?? (a + d);
  const v = L.v ?? 0.3;
  if (L.k === 'pluck') {
    const tmp = new Float32Array(Math.round((L.hold ?? 1.2) * sr) + 8);
    pluck(tmp, sr, 0, noteHz(L.f) * pitch, L.hold ?? 1.2, v, rng, L.bright ?? 0.5, L.damp ?? 0.996);
    if (L.filter) { const f = new Svf(sr); for (let n = 0; n < tmp.length; n++) tmp[n] = f.run(tmp[n], L.filter.f, L.filter.q ?? 0.7, L.filter.type); }
    for (let n = 0; n < tmp.length && i0 + n < out.length; n++) out[i0 + n] += tmp[n];
    return;
  }
  if (L.k === 'omni') {
    const patch = typeof L.patch === 'string' ? rc.patches[L.patch] : L.patch;
    if (!patch) return;
    const buf = renderOmni(patch, noteHz(L.note, 110) * pitch, hold, sr, rng);
    for (let n = 0; n < buf.length && i0 + n < out.length; n++) out[i0 + n] += buf[n] * v;
    return;
  }
  const total = Math.min(out.length - i0, Math.round((hold + r) * sr));
  if (total <= 0) return;
  const filt = L.filter ? new Svf(sr) : null;
  const sw = L.swell;
  const swPh = sw ? (sw.ph ?? rng.next()) : 0;
  // irregular swell: a second slower sine detuned by `rand` makes waves arrive at uneven intervals
  const swell = (t: number) => {
    if (!sw) return 1;
    const w1 = Math.sin((t * sw.rate + swPh) * Math.PI * 2), w2 = sw.rand ? Math.sin((t * sw.rate * (0.61 + sw.rand * 0.2) + swPh * 1.7) * Math.PI * 2) : 0;
    const m = (w1 * (1 - (sw.rand ?? 0) * 0.5) + w2 * (sw.rand ?? 0) * 0.5) * 0.5 + 0.5;
    return 1 - sw.depth + sw.depth * m * m;
  };
  const fAt = (t: number, F: FiltSpec) => F.f1 == null ? F.f : F.f * Math.pow(F.f1 / F.f, Math.min(1, t / (F.gt ?? (hold + r))));
  if (L.k === 'noise') {
    const ns = noiseSrc(L.color ?? 'white', rng);
    for (let n = 0; n < total; n++) {
      const t = n / sr;
      let x = ns();
      if (filt && L.filter) x = filt.run(x, fAt(t, L.filter) * pitch, L.filter.q ?? 0.7, L.filter.type);
      if (L.drive) x = drive(x, L.drive);
      out[i0 + n] += x * v * (span != null ? 1 : env(t, a, d, s, hold, r)) * swell(t);
    }
    return;
  }
  // tone
  const f0 = noteHz(L.f) * pitch, f1 = L.f1 != null ? noteHz(L.f1) * pitch : f0, gt = L.gt ?? (hold + r);
  const w: Wave = L.wave ?? 'sine';
  let ph = 0, ph2 = rng.next(), mph = 0;
  const det = L.detune ? Math.pow(2, L.detune / 1200) : 0;
  const harm = L.harm;
  for (let n = 0; n < total; n++) {
    const t = n / sr;
    let f = f1 === f0 ? f0 : f0 * Math.pow(f1 / f0, Math.min(1, t / gt));
    if (L.vib) f *= 1 + L.vib.depth * Math.sin(t * L.vib.rate * Math.PI * 2);
    let fmv = 0;
    if (L.fm) { mph = (mph + f * L.fm.ratio / sr) % 1; const idx = L.fm.index * (L.fm.decay ? Math.exp(-t / L.fm.decay) : 1); fmv = Math.sin(mph * Math.PI * 2) * idx; }
    const inc = f / sr;
    ph = (ph + inc) % 1;
    let x: number;
    if (harm) { x = 0; for (let h = 0; h < harm.length; h++) if (harm[h]) x += harm[h] * Math.sin((ph * (h + 1) + fmv / (Math.PI * 2)) * Math.PI * 2); }
    else if (L.fm) x = Math.sin(ph * Math.PI * 2 + fmv);
    else x = osc(w, ph, inc, L.pw);
    if (det) { ph2 = (ph2 + inc * det) % 1; x = (x + osc(w, ph2, inc * det, L.pw)) * 0.6; }
    if (filt && L.filter) x = filt.run(x, fAt(t, L.filter) * pitch, L.filter.q ?? 0.7, L.filter.type);
    if (L.drive) x = drive(x, L.drive);
    out[i0 + n] += x * v * (span != null ? 1 : env(t, a, d, s, hold, r)) * swell(t);
  }
}

/** Render a one-shot recipe into a mono sample array. */
export function renderSfx(id: string, def: SfxDef, rc: RenderCtx): Float32Array {
  const len = recipeLen(def), out = new Float32Array(Math.ceil(len * rc.sr) + 16);
  const rng = new Rng(hashSeed(id));
  for (const L of def.layers) renderLayer(out, L, rc, rng);
  if (def.echo) echo(out, rc.sr, def.echo[0], def.echo[1], def.echo[2]);
  if (def.rev) reverb(out, rc.sr, def.rev);
  normalize(out, 0.95, true);
  const g = def.gain ?? 1; if (g !== 1) for (let i = 0; i < out.length; i++) out[i] *= g;
  // tiny fade-out so a cut tail never clicks
  const fo = Math.min(out.length, Math.round(0.01 * rc.sr)); for (let i = 0; i < fo; i++) out[out.length - 1 - i] *= i / fo;
  return out;
}

/** Render an ambience loop: continuous layers span the whole loop, events are scattered, ends crossfaded. */
export function renderLoop(id: string, def: LoopDef, rc: RenderCtx): Float32Array {
  const g = renderLoopGen(id, def, rc); let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
export function* renderLoopGen(id: string, def: LoopDef, rc: RenderCtx): Generator<void, Float32Array> {
  const xf = def.xf ?? 1.5, total = def.dur + xf, out = new Float32Array(Math.ceil(total * rc.sr));
  const rng = new Rng(hashSeed(id));
  for (const L of def.layers) { renderLayer(out, L, rc, rng, 0, 1, L.k === 'burst' ? undefined : total); yield; }
  for (const ev of def.events || []) {
    let t = rng.range(0, ev.every[0]);
    while (t < total - 0.5) {
      const sub = { ...ev.layer, v: ((ev.layer as LayerBase).v ?? 0.3) * (1 - (ev.vJit ?? 0.4) * rng.next()) } as Layer;
      renderLayer(out, sub, rc, rng, t, 0.85 + rng.next() * 0.3);
      t += rng.range(ev.every[0], ev.every[1]);
    }
    yield;
  }
  if (def.rev) yield* reverbGen(out, rc.sr, def.rev);
  const res = seamless(out, rc.sr, xf);
  normalize(res, (def.gain ?? 0.7));
  return res;
}
