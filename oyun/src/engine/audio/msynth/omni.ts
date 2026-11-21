// Omni-Synth 256 Pro compatibility: renders a patch made in the owner's omni_synth_256_pro page (its "copy JSON"
// output, same keys) with our own DSP, so no Tone.js / CDN is needed in the game.
// Analysis that led to Martı Synth (kept here for the next builder):
// - Omni is one monophonic Tone.js voice (3 osc + 2 noise -> one lowpass -> amp env -> fx chain). Good for drones,
//   engines and lasers; weak for natural sounds (sea, rain, splash, coins) that need several independent noise and
//   tone events with their own envelopes and filters.
// - Its applyMacros() overwrites cutoff / decay / release / drive on every update, so presets like "vapur" never
//   sound as written there. Here macros only apply when the patch itself sets macroSpeed / macroIntensity.
// - Tone.js from cdnjs may be blocked inside the game's sandbox. So: layered recipes in ses-db.json are the main
//   path, Omni patches are a supported layer type ({ k: 'omni', patch: 'vapur' }).
// Not ported (no audible use in game sounds): chorus, phaser, glide, arpeggiator.
import { Rng, Svf, osc, noiseSrc, env, reverb, echo, drive, dbToLin, type Wave } from './dsp';

export type OmniPatch = Record<string, number | string>;
const DEF: Record<string, number> = {
  masterVol: -10, macroSpeed: 0.5, macroIntensity: 0.5,
  osc1Vol: -6, osc1Oct: 0, osc1FmFreq: 0, osc1FmDep: 0, osc2Vol: -12, osc2Oct: 0, osc2Detune: 12, osc3Vol: -60, osc3Oct: -1,
  noise1Vol: -60, noise2Vol: -60, filtCutoff: 3000, filtRes: 1, filtEnvAmt: 2000, formantMix: 0,
  ampA: 0.05, ampD: 0.3, ampS: 0.8, ampR: 0.5, filtA: 0.1, filtD: 0.5, filtS: 0.5, filtR: 1,
  lfo1Rate: 5, lfo1Dep: 0, lfo2Rate: 1, lfo2Dep: 0, lfo3Rate: 2, lfo3Dep: 0, lfo4Rate: 6, lfo4Dep: 0,
  fxBit: 8, fxBitMix: 0, fxDist: 0, fxDistMix: 0, fxDelTime: 0.3, fxDelMix: 0, fxRevDec: 3, fxRevMix: 0.1,
};

/** Render `hold` seconds of a note (plus release + fx tail). Returns mono samples. */
export function renderOmni(patch: OmniPatch, freq: number, hold: number, sr: number, rng: Rng): Float32Array {
  const P: Record<string, number> = { ...DEF };
  for (const k in patch) if (typeof patch[k] === 'number') P[k] = patch[k] as number;
  if ('macroSpeed' in patch) { const s = P.macroSpeed; P.lfo1Rate = 0.5 + s * 20; P.lfo2Rate = 0.1 + s * 10; P.ampD = 2 - s * 1.8; P.ampR = 3 - s * 2.8; }
  if ('macroIntensity' in patch) { const i = P.macroIntensity; P.fxDistMix = i * 0.8; P.filtCutoff = 500 + i * 10000; if (P.osc1FmFreq > 0) P.osc1FmDep = i * 100; }
  const w1 = (patch.osc1Type as Wave) || 'sine', w2 = (patch.osc2Type as Wave) || 'sawtooth', w3 = (patch.osc3Type as Wave) || 'square';
  const tail = P.ampR + (P.fxRevMix > 0 ? Math.min(3, P.fxRevDec * 0.5) : 0) + (P.fxDelMix > 0 ? P.fxDelTime * 4 : 0);
  const n = Math.ceil((hold + tail) * sr), out = new Float32Array(n);
  const g1 = dbToLin(P.osc1Vol), g2 = dbToLin(P.osc2Vol), g3 = dbToLin(P.osc3Vol), gn1 = dbToLin(P.noise1Vol), gn2 = dbToLin(P.noise2Vol);
  const n1 = noiseSrc(((patch.noise1Type as string) || 'white') as 'white', rng), n2 = noiseSrc(((patch.noise2Type as string) || 'brown') as 'brown', rng);
  const vcf = new Svf(sr), f1 = new Svf(sr), f2 = new Svf(sr), f3 = new Svf(sr);
  const o2 = Math.pow(2, P.osc2Detune / 1200);
  let p1 = 0, p2 = 0, p3 = 0, fm = 0;
  const lfo = (t: number, r: number) => Math.sin(t * r * Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const det = Math.pow(2, P.lfo1Dep * lfo(t, P.lfo1Rate) / 1200);
    fm = (fm + P.osc1FmFreq / sr) % 1;
    const fA = (freq * Math.pow(2, P.osc1Oct) + Math.sin(fm * Math.PI * 2) * P.osc1FmDep) * det;
    const fB = freq * Math.pow(2, P.osc2Oct) * o2 * det, fC = freq * Math.pow(2, P.osc3Oct) * det;
    p1 = (p1 + Math.max(0, fA) / sr) % 1; p2 = (p2 + fB / sr) % 1; p3 = (p3 + fC / sr) % 1;
    let x = 0;
    if (g1) x += osc(w1, p1, fA / sr) * g1;
    if (g2) x += osc(w2, p2, fB / sr) * g2;
    if (g3) x += osc(w3, p3, fC / sr) * g3;
    if (gn1) x += n1() * gn1;
    if (gn2) x += n2() * gn2;
    const fe = env(t, P.filtA, P.filtD, P.filtS, hold, P.filtR);
    const cut = Math.max(20, Math.min(sr * 0.45, P.filtCutoff + P.filtEnvAmt * fe + P.lfo2Dep * lfo(t, P.lfo2Rate)));
    let y = vcf.run(x, cut, Math.max(0.3, P.filtRes), 'lp');
    if (P.formantMix > 0) { const fo = (f1.run(y, 730, 5, 'bp') + f2.run(y, 1090, 5, 'bp') + f3.run(y, 2440, 5, 'bp')) * 1.2; y = y * (1 - P.formantMix) + fo * P.formantMix; }
    y *= env(t, P.ampA, P.ampD, P.ampS, hold, P.ampR);
    if (P.lfo4Dep) y *= 1 + P.lfo4Dep * lfo(t, P.lfo4Rate);
    if (P.fxBit < 8 && P.fxBitMix > 0) { const q = Math.pow(2, P.fxBit - 1); y = y * (1 - P.fxBitMix) + Math.round(y * q) / q * P.fxBitMix; }
    if (P.fxDistMix > 0) y = y * (1 - P.fxDistMix) + drive(y, Math.max(P.fxDist, 0.2)) * P.fxDistMix;
    out[i] = y;
  }
  if (P.fxDelMix > 0) echo(out, sr, P.fxDelTime, 0.4, P.fxDelMix);
  if (P.fxRevMix > 0) reverb(out, sr, P.fxRevMix, Math.min(0.92, 0.6 + P.fxRevDec * 0.03));
  const mv = dbToLin(P.masterVol) * 2; for (let i = 0; i < n; i++) out[i] *= mv;
  return out;
}
