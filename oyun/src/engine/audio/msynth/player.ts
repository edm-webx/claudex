// Music player on top of the bank: same surface as the old procedural lo-fi (engine/audio/lofi.ts) so the audio
// facade swaps it in place. Plays one pre-rendered loop at a time and crossfades when phase / weather / place / event
// picks another track. Fog muffles through one lowpass; intensity (crowd) and duck move one gain.
// SNT-10: the candidates for a state come from trackAdaylari(); variety is a shuffle bag (no immediate repeat) that
// rotates every ROT_MS, the rotation swap waits for the next 4-bar phrase and crossfades ~5 s. '' (banka, hastane)
// fades to silence. Only the next likely track is pre-rendered (bank LRU keeps memory flat); stop() renders nothing.
// SNT-16: crowd liveliness with hysteresis opens the lowpass and lifts the level (calm = sparse, busy = present).
// SNT-14: kis(v) pulls the music down while a live musician is near (1 = no pull).
import type { Bank } from './index';
import { trackAdaylari, canlilik, canlilikKatman, taban, VARYANT_SAYISI } from './music';
import { Canta } from '../../../content/ses/ambiyans';
import { Rng, hashSeed } from './dsp';
import type { Lofi, LofiPhase } from '../lofi';

export const ROT_MS = 150000;
export const XF_TC = 1.1;   // setTargetAtTime time constant: ~5 s to silence

export interface MusicPlayer extends Lofi { kis(v: number): void; adaylar(): string[] }
/** duck: derinlik (çarpan) ve bırakma süresi sabit; üst üste gelen duck'lar en derini ve en geç bitişi alır. */
export const DUCK_DEPTH = 0.35;

export function createMusicPlayer(ac: AudioContext, out: AudioNode, bank: Bank): MusicPlayer {
  let on = false, phase: LofiPhase = 'morning', place = 'iskele', weather = 'acik', event: string | null = null, intensity = 0.5;
  let canli: 0 | 1 = 0, kisV = 1;
  let icKis = 1;   // iç mekân (müziksiz bölge): parça değişmez/başa sarmaz, yalnız kısılır
  let duckF = 1, duckEnd = 0, duckT: ReturnType<typeof setTimeout> | null = null;   // tek duck mekanizması: apply() onu hiç ezmez
  let cur: { key: string; src: AudioBufferSourceNode; g: GainNode; t0: number; dur: number } | null = null;
  let want = '', aday: string[] = [], adayKey = '', bag: Canta<string> | null = null;
  // çok-varyantlı mod (db.music.coklu.on): parça = taban~varyant, 1-2 tur çalar, sonra sessizlik/ambiyans arası, sonra yeni parça/varyant
  const cfg = bank.db.music.coklu, coklu = !!cfg?.on;
  let endAt = 0, gapUntil = 0, gapT: ReturnType<typeof setInterval> | null = null;
  const recent: string[] = [];
  const draw = (base: string): string => {
    if (!coklu) return base;
    let v = 0; for (let i = 0; i < 8; i++) { v = rng.int(0, VARYANT_SAYISI - 1); if (!recent.includes(base + '~' + v)) break; }
    const k = v ? base + '~' + v : base; recent.push(k); if (recent.length > 10) recent.shift(); return k;
  };
  let rotT: ReturnType<typeof setInterval> | null = null, phraseT: ReturnType<typeof setTimeout> | null = null;
  const rng = new Rng(hashSeed('muzik.canta'));
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
  const master = ac.createGain(); master.gain.value = 0.9;
  lp.connect(master); master.connect(out);
  const level = () => (0.75 + 0.25 * intensity) * canlilikKatman(canli).gain * kisV * duckF * icKis;
  function apply(tc = 0.4) {
    try {
      if (duckF < 1 && ac.currentTime >= duckEnd) { duckF = 1; tc = 1.2; }   // süre dolmuş (zamanlayıcı kısıtlandıysa da kurtarır): yavaş geri aç
      master.gain.setTargetAtTime(level(), ac.currentTime, tc);
      const wf = weather === 'sis' ? 1400 : weather === 'saganak' || weather === 'firtina' ? 5000 : 20000;
      lp.frequency.setTargetAtTime(Math.min(wf, canlilikKatman(canli).lpf), ac.currentTime, 2.5);
    } catch { /* closed */ }
  }
  function fadeOut(c: NonNullable<typeof cur>, tc = XF_TC) { try { const t = ac.currentTime; c.g.gain.setTargetAtTime(0, t, tc); c.src.stop(t + tc * 6); } catch { /* */ } }
  function play(key: string) {
    if (!on) return;
    if (!key) { want = ''; if (cur) { fadeOut(cur); cur = null; } return; }
    if (cur && cur.key === key) return;
    want = key;
    bank.track(key, buf => {
      if (!on || want !== key || (cur && cur.key === key)) return;
      const t = ac.currentTime;
      if (cur) fadeOut(cur);
      const g = ac.createGain(); g.gain.value = 0; g.connect(lp);
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(g); src.start();
      g.gain.setTargetAtTime(1, t, XF_TC);
      cur = { key, src, g, t0: t, dur: buf.duration };
      if (coklu && cfg) endAt = t + cfg.minSn + rng.next() * (cfg.maxSn - cfg.minSn);
      const nx = coklu ? undefined : bag?.peek(); if (nx && nx !== key) setTimeout(() => { if (on) bank.track(nx, () => { /* cached */ }); }, 8000);
    });
  }
  /** state changed: new candidate list -> keep the current track if it still fits, else draw from the bag */
  function sync() {
    if (!on) return;
    const l = trackAdaylari(bank.db.music, phase, weather, place, event), k = l.join('|');
    const degisti = k !== adayKey;
    if (degisti) { adayKey = k; aday = l; bag = l.length > 1 ? new Canta(l.map(v => ({ v, w: 1 })), () => rng.next()) : null; }
    if (!aday.length) { if (cur) { icKis = 0.1; apply(1.0); } else play(''); return; }   // çalan parçayı bırakma: çıkışta başa sarmasın
    if (icKis < 1) { icKis = 1; apply(1.0); }
    if (cur && aday.includes(taban(cur.key)) && want === cur.key) return;
    if (want && aday.includes(taban(want))) return;
    if (coklu && !cur && !event && gapUntil > ac.currentTime) { if (degisti) gapUntil = Math.min(gapUntil, ac.currentTime + 6); return; }   // ara: müzik yok, yalnız ambiyans
    play(draw(bag ? (bag.next() as string) : aday[0]));
  }
  /** çok-varyantlı mod: parça süresi dolunca döngü sonunda uzun solarak biter, arada sessizlik */
  function gapTick() {
    if (!on || !cfg) return;
    const t = ac.currentTime;
    if (cur) {
      if (event || t < endAt) return;
      const rem = cur.dur - ((t - cur.t0) % cur.dur);
      if (rem > 2.2) return;
      const calm = 1 + (1 - intensity) * 0.6;
      fadeOut(cur, 1.6); cur = null; want = '';
      gapUntil = t + (cfg.araMin + rng.next() * (cfg.araMax - cfg.araMin)) * calm;
    } else if (!want && t >= gapUntil && aday.length) sync();
  }
  /** variety: next bag track, swapped at the next 4-bar phrase of the current loop */
  function rotate() {
    if (!on || !bag || !cur) return;
    if (coklu) return;
    let nx = bag.next(); if (nx === cur.key) nx = bag.next();
    if (!nx || nx === cur.key) return;
    const phrase = cur.dur / 4, el = (ac.currentTime - cur.t0) % phrase, wait = Math.max(0, phrase - el) * 1000;
    if (phraseT) clearTimeout(phraseT);
    const key = nx;
    phraseT = setTimeout(() => { phraseT = null; if (on && aday.includes(taban(key))) play(key); }, wait);
  }
  return {
    start() { if (on) return; on = true; apply(); sync(); if (!rotT) rotT = setInterval(rotate, ROT_MS); if (coklu && !gapT) gapT = setInterval(gapTick, 2000); },
    stop() {
      on = false; want = ''; adayKey = '';
      if (rotT) { clearInterval(rotT); rotT = null; }
      if (phraseT) { clearTimeout(phraseT); phraseT = null; }
      if (gapT) { clearInterval(gapT); gapT = null; }
      if (duckT) { clearTimeout(duckT); duckT = null; }
      duckF = 1; duckEnd = 0; icKis = 1; gapUntil = 0;
      if (cur) { const c = cur; cur = null; fadeOut(c, 0.3); }
    },
    get playing() { return on; },
    setPlace(id) { place = id; sync(); },
    setPhase(p) { phase = p; sync(); },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); canli = canlilik(canli, intensity); apply(); },
    setEvent(id) { event = id; sync(); },
    setWeather(k) { weather = k; apply(); sync(); },
    duck(sec, depth = DUCK_DEPTH) {
      try {
        const t = ac.currentTime, active = duckF < 1 && t < duckEnd;
        duckF = active ? Math.min(duckF, depth) : depth;
        duckEnd = Math.max(active ? duckEnd : 0, t + Math.max(0.1, sec));
        apply(0.15);
        if (duckT) clearTimeout(duckT);
        duckT = setTimeout(() => { duckT = null; if (ac.currentTime >= duckEnd - 0.05) apply(); else apply(0.15); }, Math.max(0.1, duckEnd - t) * 1000 + 50);
      } catch { /* */ }
    },
    kis(v) { const nv = Math.max(0, Math.min(1, v)); if (Math.abs(nv - kisV) < 0.01) return; kisV = nv; apply(); },
    layers() { return cur ? [cur.key] : []; },
    adaylar() { return aday.slice(); },
  };
}
