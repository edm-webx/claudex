// Saf DSP ölçüm yardımcıları (AudioContext yok): tepe, RMS, spektral ağırlık merkezi.
import DB from '../../../src/content/ses/ses-db.json';
import { renderSfx, type SfxDef } from '../../../src/engine/audio/msynth/render';
import { SR_SFX } from '../../../src/engine/audio/msynth/dsp';
export const SFX_DB = (DB as unknown as { sfx: Record<string, SfxDef>; patches: never }).sfx;
export function olc(x: Float32Array, sr = SR_SFX) {
  let pk = 0, ss = 0; for (const v of x) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
  const N = 4096, n = Math.min(N, x.length); let num = 0, den = 0;
  for (let k = 1; k < N / 2; k += 2) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), a = 2 * Math.PI * k * i / N; re += x[i] * w * Math.cos(a); im -= x[i] * w * Math.sin(a); }
    const m = Math.hypot(re, im); num += m * k * sr / N; den += m;
  }
  return { tepe: pk, rms: Math.sqrt(ss / Math.max(1, x.length)), merkez: num / (den || 1), sure: x.length / sr };
}
const cache = new Map<string, ReturnType<typeof olc>>();
export function sesOlc(id: string) {
  let r = cache.get(id);
  if (!r) { r = olc(renderSfx(id, SFX_DB[id], { sr: SR_SFX, patches: (DB as unknown as { patches: never }).patches })); cache.set(id, r); }
  return r;
}
