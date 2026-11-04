// Martı Synth music: 90s / early 2000s İstanbul atmosphere (rainy ferry windows, string pads, saz and nylon guitar
// arpeggios, a sad keman or ney line, soft darbuka). Each track is composed from its JSON spec (ses-db.json
// `music`) with a seeded generator, rendered ONCE into a loopable AudioBuffer, then crossfaded by game state:
// day phase (gündüz / akşam / gece), weather (yağmur, kar) and events. No per-frame synthesis.
import { Rng, Svf, env, reverbGen, pluck, mtof, noteHz, hashSeed, osc, noiseSrc, normalize, SR_LOOP } from './dsp';

export type Inst = 'saz' | 'nylon' | 'epiano' | 'kutu' | 'keman' | 'ney' | 'klarnet' | 'none';
export interface TrackSpec {
  bpm: number; root: string; scale: number[];
  /** [chord root in semitones from `root`, chord intervals], one chord per `chordBars` bars */
  chords: [number, number[]][]; chordBars?: number; bars?: number;
  arp?: Inst; arpPattern?: number[]; lead?: Inst; leadBars?: number[]; leadOct?: number;
  pad?: number; bass?: number; perc?: 'darbuka' | 'dum' | 'none'; tef?: boolean;
  lpf?: number; rev?: number; swing?: number; gain?: number; density?: number; note?: string;
}
export interface MusicDb { tracks: Record<string, TrackSpec>; map: { phase: Record<string, string | string[]>; weather: Record<string, string>; place?: Record<string, string>; event?: string } }

// ───────── instruments (all add into `o` at sample i0) ─────────
function* padVoice(o: Float32Array, sr: number, i0: number, dur: number, f: number, v: number, rng: Rng, cut: number) {
  const n = Math.min(o.length - i0, Math.round((dur + 1.2) * sr)), flt = new Svf(sr);
  let p1 = rng.next(), p2 = rng.next(), p3 = rng.next(), cf = cut;
  const k1 = Math.pow(2, 7 / 1200), k2 = Math.pow(2, -9 / 1200);
  for (let s = 0; s < n; s++) {
    const t = s / sr, d = f / sr;
    p1 = (p1 + d * k1) % 1; p2 = (p2 + d * k2) % 1; p3 = (p3 + d * 0.5) % 1;
    let x = (osc('sawtooth', p1, d) + osc('sawtooth', p2, d)) * 0.5 + osc('triangle', p3, d * 0.5) * 0.35;
    if ((s & 31) === 0) cf = cut * (0.85 + 0.15 * Math.sin(t * 0.7));
    x = flt.run(x, cf, 0.6, 'lp');
    o[i0 + s] += x * v * env(t, 0.7, 2, 0.85, dur, 1.1);
    if ((s & 8191) === 8191) yield;
  }
}
function epiano(o: Float32Array, sr: number, i0: number, dur: number, f: number, v: number) {
  const n = Math.min(o.length - i0, Math.round((dur + 1.4) * sr));
  let pc = 0, pm = 0, pt = 0;
  for (let s = 0; s < n; s++) {
    const t = s / sr;
    pm = (pm + f / sr) % 1; pc = (pc + f / sr) % 1; pt = (pt + f * 14 / sr) % 1;
    const idx = 1.6 * Math.exp(-t / 0.5) + 0.2;
    const x = Math.sin(pc * Math.PI * 2 + Math.sin(pm * Math.PI * 2) * idx) + Math.sin(pt * Math.PI * 2) * 0.12 * Math.exp(-t / 0.05);
    o[i0 + s] += x * v * env(t, 0.003, 2.2, 0.0, dur, 0.5) * (1 + 0.04 * Math.sin(t * 5 * Math.PI * 2));
  }
}
function kutu(o: Float32Array, sr: number, i0: number, f: number, v: number) {
  const n = Math.min(o.length - i0, Math.round(1.6 * sr));
  for (let s = 0; s < n; s++) {
    const t = s / sr, e = Math.exp(-t / 0.45);
    const x = Math.sin(t * f * Math.PI * 2) + 0.35 * Math.sin(t * f * 3.01 * Math.PI * 2) * Math.exp(-t / 0.12) + 0.18 * Math.sin(t * f * 4.2 * Math.PI * 2) * Math.exp(-t / 0.06);
    o[i0 + s] += x * v * e * Math.min(1, t / 0.002);
  }
}
function leadVoice(o: Float32Array, sr: number, i0: number, dur: number, f: number, v: number, inst: Inst, rng: Rng, from?: number) {
  const n = Math.min(o.length - i0, Math.round((dur + 0.35) * sr)), flt = new Svf(sr), fb = new Svf(sr), ns = noiseSrc('white', rng);
  let ph = 0;
  for (let s = 0; s < n; s++) {
    const t = s / sr;
    // grace: slide in from the neighbour note (Turkish ornament)
    let fr = from && t < 0.07 ? from + (f - from) * (t / 0.07) : f;
    const vibOn = Math.min(1, Math.max(0, (t - 0.18) / 0.25));
    fr *= 1 + (inst === 'ney' ? 0.005 : 0.007) * vibOn * Math.sin(t * (inst === 'ney' ? 4.6 : 5.6) * Math.PI * 2);
    const d = fr / sr; ph = (ph + d) % 1;
    let x: number;
    if (inst === 'keman') { x = flt.run(osc('sawtooth', ph, d), 2400, 0.7, 'lp'); x += fb.run(x, 1200, 2, 'bp') * 0.6; }
    else if (inst === 'klarnet') x = flt.run(osc('square', ph, d), 1700, 0.9, 'lp');
    else { x = Math.sin(ph * Math.PI * 2) + 0.12 * Math.sin(ph * 4 * Math.PI) + fb.run(ns(), fr * 2, 3, 'bp') * 0.25; } // ney: breathy
    const a = inst === 'klarnet' ? 0.04 : inst === 'keman' ? 0.09 : 0.12;
    o[i0 + s] += x * v * env(t, a, 0.6, 0.8, dur, 0.22);
  }
}
function dum(o: Float32Array, sr: number, i0: number, v: number, rng: Rng) {
  const n = Math.min(o.length - i0, Math.round(0.35 * sr)), ns = noiseSrc('white', rng), fl = new Svf(sr); let ph = 0;
  for (let s = 0; s < n; s++) { const t = s / sr, f = 60 + 80 * Math.exp(-t / 0.03); ph = (ph + f / sr) % 1; o[i0 + s] += (Math.sin(ph * Math.PI * 2) * Math.exp(-t / 0.14) + fl.run(ns(), 400, 1, 'lp') * 0.4 * Math.exp(-t / 0.02)) * v; }
}
function tek(o: Float32Array, sr: number, i0: number, v: number, rng: Rng, hi = 3800) {
  const n = Math.min(o.length - i0, Math.round(0.09 * sr)), ns = noiseSrc('white', rng), fl = new Svf(sr);
  for (let s = 0; s < n; s++) { const t = s / sr; o[i0 + s] += (fl.run(ns(), hi, 2.2, 'bp') * Math.exp(-t / 0.025) + Math.sin(t * 820 * Math.PI * 2) * 0.3 * Math.exp(-t / 0.012)) * v; }
}
function zil(o: Float32Array, sr: number, i0: number, v: number, rng: Rng) {
  const n = Math.min(o.length - i0, Math.round(0.12 * sr)), ns = noiseSrc('white', rng), fl = new Svf(sr);
  for (let s = 0; s < n; s++) { const t = s / sr; o[i0 + s] += fl.run(ns(), 7500, 0.8, 'hp') * Math.exp(-t / 0.04) * v; }
}

const PATTERNS = [[1, 1, 2, 1, 1, 2], [2, 1, 1, 2, 2], [3, 1, 2, 2], [1, 1, 1, 1, 4], [2, 2, 1, 1, 2], [4, 2, 2]];

/** Compose and render one track; returns mono samples whose length is exactly the musical loop. */
export function renderTrack(id: string, T: TrackSpec, sr = SR_LOOP): Float32Array {
  const g = renderTrackGen(id, T, sr); let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
/** Generator form: yields between notes / chunks so the bank can spread the work over idle slices. */
export function* renderTrackGen(id: string, T: TrackSpec, sr = SR_LOOP): Generator<void, Float32Array> {
  const rng = new Rng(hashSeed('muzik.' + id));
  const beat = 60 / T.bpm, bar = beat * 4, bars = T.bars ?? 16, cb = T.chordBars ?? 2;
  const len = Math.round(bars * bar * sr), tail = Math.round(2.5 * sr), out = new Float32Array(len + tail);
  const root = Math.round(69 + 12 * Math.log2(noteHz(T.root) / 440));
  const at = (sec: number) => Math.round(sec * sr);
  const sw = (eighth: number) => (eighth % 2 ? (T.swing ?? 0.06) * beat : 0);
  const dens = T.density ?? 0.7;
  const chordAt = (b: number) => T.chords[Math.floor(b / cb) % T.chords.length];
  const padV = T.pad ?? 0.11, bassV = T.bass ?? 0.22;
  for (let b = 0; b < bars; b += cb) {
    const [cr, iv] = chordAt(b), t0 = b * bar, dur = cb * bar;
    // pad: chord tones around the 3rd octave, slightly spread
    if (padV > 0) { const tones = iv.slice(0, 4); for (let k = 0; k < tones.length; k++) yield* padVoice(out, sr, at(t0), dur - 0.15, mtof(root + cr + tones[k] - (k === 0 ? 12 : 0)), padV / Math.sqrt(iv.length), rng, T.lpf ? Math.min(T.lpf, 1800) : 1500); }
    // bass: root on 1 and 3 (and the "and" of 4 now and then)
    if (bassV > 0) for (let bb = 0; bb < cb; bb++) for (const q of [0, 2]) {
      const f = mtof(root + cr - 24), i0 = at(t0 + bb * bar + q * beat), n = Math.round(beat * 1.6 * sr);
      for (let s = 0; s < n && i0 + s < out.length; s++) { const t = s / sr; out[i0 + s] += (Math.sin(t * f * Math.PI * 2) + 0.3 * Math.sin(t * f * 2 * Math.PI * 2)) * bassV * env(t, 0.01, 0.9, 0.3, beat * 1.2, 0.2); }
    }
  }
  // arpeggio
  const arp = T.arp ?? 'nylon', pat = T.arpPattern ?? [0, 1, 2, 1, 3, 1, 2, 1];
  if (arp !== 'none') for (let b = 0; b < bars; b++) {
    const [cr, iv] = chordAt(b), notes = [...iv, iv[0] + 12, iv[1] + 12];
    for (let e = 0; e < 8; e++) {
      if (arp === 'epiano' && e % 2) continue;
      if (rng.next() > dens + 0.25) continue;
      const m = root + cr + notes[pat[e % pat.length] % notes.length];
      const t = b * bar + e * beat / 2 + sw(e), i0 = at(t);
      if (arp === 'saz') pluck(out, sr, i0, mtof(m + 12), 1.1, 0.16, rng, 0.8, 0.994);
      else if (arp === 'nylon') pluck(out, sr, i0, mtof(m), 1.6, 0.19, rng, 0.25, 0.997);
      else if (arp === 'kutu') kutu(out, sr, i0, mtof(m + 24), 0.07);
      else if (arp === 'epiano') { epiano(out, sr, i0, beat * 1.6, mtof(m), 0.07); yield; }
    }
    yield;
  }
  // lead melody: phrases on `leadBars`
  const lead = T.lead ?? 'none';
  if (lead !== 'none') {
    const lb = T.leadBars ?? [4, 5, 6, 7, 12, 13, 14, 15];
    const scale = T.scale, oct = (T.leadOct ?? 1) * 12;
    let deg = 7, prevF = 0;
    const degToMidi = (d: number) => root + oct + Math.floor(d / scale.length) * 12 + scale[((d % scale.length) + scale.length) % scale.length];
    for (const b of lb) {
      if (b >= bars) continue;
      const p = rng.pick(PATTERNS); let e = 0;
      const [cr] = chordAt(b);
      p.forEach((len8, k) => {
        if (k === p.length - 1) { // land on a chord tone
          const target = scale.findIndex(s => (s - cr + 120) % 12 === 0); if (target >= 0) deg = Math.round(deg / scale.length) * scale.length + target;
        } else deg += rng.pick([-2, -1, -1, 1, 1, 2, 0]);
        deg = Math.max(3, Math.min(12, deg));
        const f = mtof(degToMidi(deg));
        if (rng.next() < 0.85) leadVoice(out, sr, at(b * bar + e * beat / 2 + sw(e)), len8 * beat / 2 * 0.95, f, 0.085, lead, rng, rng.next() < 0.3 ? f * 1.06 : (prevF && rng.next() < 0.2 ? prevF : undefined));
        prevF = f; e += len8;
      });
      yield;
    }
  }
  // percussion
  const perc = T.perc ?? 'none';
  if (perc !== 'none') for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    // maqsum: DÜM tek . tek DÜM . tek .
    const hits: [number, 'D' | 'T'][] = perc === 'darbuka' ? [[0, 'D'], [1, 'T'], [3, 'T'], [4, 'D'], [6, 'T']] : [[0, 'D'], [4, 'D']];
    for (const [e, k] of hits) { const i0 = at(t0 + e * beat / 2 + sw(e)); if (k === 'D') dum(out, sr, i0, 0.32, rng); else tek(out, sr, i0, 0.11 * (0.7 + 0.3 * rng.next()), rng); }
    if (perc === 'darbuka' && rng.next() < 0.3) tek(out, sr, at(t0 + 7 * beat / 2 + beat / 4), 0.06, rng, 4500);
    if (T.tef) for (let e = 1; e < 8; e += 2) zil(out, sr, at(t0 + e * beat / 2), 0.04, rng);
  }
  yield;
  // master: gentle tone + room
  if (T.lpf) { const f = new Svf(sr); for (let i = 0; i < out.length; i++) { out[i] = f.run(out[i], T.lpf, 0.6, 'lp'); if ((i & 65535) === 65535) yield; } }
  yield* reverbGen(out, sr, T.rev ?? 0.3, 0.82, 0.4);
  // wrap the tail into the head so the loop is seamless
  for (let i = 0; i < tail; i++) out[i] += out[len + i];
  const res = out.slice(0, len);
  normalize(res, T.gain ?? 0.6);
  return res;
}

/** Pick the track key for the current game state. */
/** 16:52 user ("hep aynı şeyler çalıyor, atmosfere göre değişecekti"): place + time of day first ('orman.gece'),
 *  then the place, then the phase, where a phase can hold several tracks that rotate (variant). */
export function pickTrack(db: MusicDb, phase: string, weather: string, place: string, event: string | null, variant = 0): string {
  if (event && db.map.event && db.tracks[db.map.event]) return db.map.event;
  const w = db.map.weather[weather]; if (w && db.tracks[w]) return w;
  const grp = phase === 'sunset' ? 'aksam' : phase === 'night' ? 'gece' : 'gunduz';
  const pp = db.map.place?.[place + '.' + grp] || db.map.place?.[place]; if (pp && db.tracks[pp]) return pp;
  const ph = db.map.phase[phase];
  const list = Array.isArray(ph) ? ph.filter(k => db.tracks[k]) : ph ? [ph] : [];
  return list.length ? list[variant % list.length] : Object.keys(db.tracks)[0];
}
