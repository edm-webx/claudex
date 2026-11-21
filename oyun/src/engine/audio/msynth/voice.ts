// Mırıltı: old-arcade style character babble (one blip per syllable, pitch from the vowel, a tick for hard
// consonants). Built for the characters still to come: each has a voice profile in ses-db.json `voices`.
// Live WebAudio (a handful of tiny nodes per line), rate limited by the caller.

export interface VoiceProfile { base: number; wave?: OscillatorType; speed?: number; range?: number; formant?: number; vol?: number; wobble?: number }
const VOWEL_ST: Record<string, number> = { a: 0, ı: 1, o: 2, u: 3, e: 5, ö: 4, ü: 6, i: 7 };
const HARD = /[kptçşsfhgc]/;

/** Speak `text` as babble. Returns the line length in seconds (for mouth flaps / bubbles). */
export function babble(ac: BaseAudioContext, out: AudioNode, text: string, p: VoiceProfile, mood: 'ok' | 'happy' | 'angry' = 'ok'): number {
  const sylls: { st: number; hard: boolean }[] = [];
  let hard = false;
  for (const ch of text.toLocaleLowerCase('tr').slice(0, 60)) {
    if (ch in VOWEL_ST) { sylls.push({ st: VOWEL_ST[ch], hard }); hard = false; }
    else if (HARD.test(ch)) hard = true;
    else if (ch === ' ' && sylls.length) sylls.push({ st: -99, hard: false });
  }
  if (!sylls.length) sylls.push({ st: 2, hard: false });
  const spd = (p.speed ?? 14) * (mood === 'angry' ? 1.15 : 1), step = 1 / spd;
  const base = p.base * (mood === 'happy' ? 1.1 : mood === 'angry' ? 0.88 : 1), range = (p.range ?? 7) / 7;
  let t = ac.currentTime + 0.02;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600 * (p.formant ?? 1); lp.connect(out);
  const vol = p.vol ?? 0.07;
  for (let i = 0; i < sylls.length; i++) {
    const s = sylls[i];
    if (s.st === -99) { t += step * 0.6; continue; }
    const f = base * Math.pow(2, (s.st * range + (i === sylls.length - 1 ? (mood === 'angry' ? -2 : 2) : 0)) / 12) * (1 + (Math.random() - 0.5) * (p.wobble ?? 0.04));
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = p.wave ?? 'square'; o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.94, t + step * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.setValueAtTime(vol * 0.8, t + step * 0.55); g.gain.linearRampToValueAtTime(0.0001, t + step * 0.85);
    o.connect(g); g.connect(lp); o.start(t); o.stop(t + step);
    if (s.hard) { const c = ac.createOscillator(), cg = ac.createGain(); c.type = 'square'; c.frequency.value = f * 3; cg.gain.setValueAtTime(vol * 0.5, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.012); c.connect(cg); cg.connect(lp); c.start(t); c.stop(t + 0.02); }
    t += step;
  }
  return t - ac.currentTime;
}
