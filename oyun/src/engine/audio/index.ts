// Engine audio (Builder D). Port of v2 core.js synth audio (C.tone / C.noise / C.speak / C.SFX, same numbers) behind
// three buses (music / sfx / voice, separate sliders, ses-5), plus sample slots, music stems and zone ambience.
//
// Decisions (contract silent):
// - The AudioContext comes from platform.audioCtx() (lazy, may be null); nothing is created before unlock() (first
//   gesture). Every call is a silent no-op without a context. Nothing here ever throws.
// - sfx(id): a loaded sample in dress slot `sfx.<id>` (AudioBuffer) wins; else the v2 synth recipe of the same name;
//   unknown ids fall back to 'pop'. opts.at pans by x relative to the ambience listener (±12 m = full pan) and
//   attenuates with distance (1 / (1 + d/10)).
// - music: stems are sample slots `music.<zone>.<phase>` (looped, crossfade 2 s). Without art: silence (v2 had none).
//   setIntensity scales the music bus gain 0.6..1.
// - ambience: procedural waves (filtered noise with a slow swell) + gull calls every 6..14 s + plank creak; listener
//   position only moves the stereo pan of the gull calls. Zone loops `amb.<zone>` (samples) replace the synth when present.
// - voice(lineId): rate limited to one per 10 s (ses-3); synth grumble (v2 speak) unless a `voice.<lineId>` sample exists.
// - ownMusicMode(true): music bus muted, effects stay. suspend(true): context.suspend() (hidden page).
// - ses builder additions: without a `music.*` sample the procedural lo-fi engine (lofi.ts) plays (place signature,
//   day-phase variant, crowd layers, event layer, weather muffle). It only runs while the music bus is audible (not
//   muted, volume > 0, not own-music mode, page visible). Ambience adds a distant vapur düdüğü, the simitçi's
//   "taze simiiit" call (morning/noon), çay kaşığı, gulls, creaks and a grill sizzle loop whose level follows the
//   listener's distance to the grill (ambience.setGrill). jingle() = İskele Radyosu jingle (ducks the music).
//   On iOS the session type is 'ambient' so the phone's silent switch keeps the game quiet (ses-5).
// Faz 2: Martı Synth (msynth/) is the main sound path now. Every sound in content/ses/ses-db.json is rendered once
//   into an AudioBuffer (one-shots on first use / idle pre-warm, loops and music in idle slices) and played from
//   the cache with a per-sound cooldown, so nothing is synthesised per frame and nothing can machine-gun. The old
//   v2 recipes below stay as a fallback for ids the database doesn't have. Ambience = cached sea loop + grill loop
//   (smooth; the old 13 Hz square "crackle" LFO that made the constant fısır fısır is gone) + weather loops (rain,
//   wind, thunder). Music = pre-rendered 90s İstanbul tracks (msynth/music.ts) instead of the live lo-fi engine.
import type { Audio, AudioDeps, AudioBus, Vec2, DayPhase } from '../api';
import type { Lofi } from './lofi';
import SES_DB from '../../content/ses/ses-db.json';
import { createBank, type Bank, type SesDb } from './msynth';
import { createMusicPlayer } from './msynth/player';
import { babble, type VoiceProfile } from './msynth/voice';

/** Engine audio with the ses extras (procedural music controls, grill ambience, radio jingle). */
export interface MotorAudio extends Audio {
  music: Audio['music'] & { setEvent(id: string | null): void; setWeather(kind: string): void; duck(sec: number): void; layers(): string[] };
  ambience: Audio['ambience'] & { setGrill(pos: Vec2 | null): void; setSeason(s: string): void };
  jingle(): void;
  /** Arcade babble for a line of text in a character's voice (ses-db `voices`). */
  speak(text: string, who?: string, mood?: 'ok' | 'happy' | 'angry'): void;
  /** Martı Synth bank (debug / editor sound list). */
  bank(): Bank | null;
}

type Ctx = AudioContext;
interface BusImpl extends AudioBus { node: GainNode | null; }

const VOWELS = [[800, 1200], [500, 1900], [320, 2300], [500, 900], [340, 800]];

export function createAudio(deps: AudioDeps): MotorAudio {
  let ac: Ctx | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let suspended = false;
  let ownMusic = false;
  let intensity = 0.5;
  const listener: Vec2 = { x: 0, z: 0 };
  let lastVoice = -1e9;
  let lofi: Lofi | null = null;
  let lofiPlace = 'iskele', lofiEvent: string | null = null, lofiWeather = 'acik';
  let hasSampleMusic = false;
  let grill: Vec2 | null = null;
  let bank: Bank | null = null;
  let ambWeather = 'acik', ambSeason = 'sonbahar';

  function mkBus(name: 'music' | 'sfx' | 'voice', vol: number): BusImpl {
    let volume = vol, muted = false;
    const b: BusImpl = {
      node: null,
      get volume() { return volume; },
      set volume(v: number) { volume = Math.max(0, Math.min(1, +v || 0)); apply(); },
      get muted() { return muted; },
      set muted(m: boolean) { muted = !!m; apply(); },
    };
    function apply() {
      if (!b.node || !ac) return;
      const extra = name === 'music' ? (ownMusic ? 0 : 0.6 + 0.4 * intensity) : 1;
      try { b.node.gain.setTargetAtTime(muted ? 0 : volume * extra, ac.currentTime, 0.05); } catch { /* closed ctx */ }
    }
    (b as unknown as { apply: () => void }).apply = () => { apply(); if (name === 'music') syncLofi(); };
    return b;
  }
  const buses = { music: mkBus('music', 0.8), sfx: mkBus('sfx', 1), voice: mkBus('voice', 1) };
  const applyAll = () => { for (const b of Object.values(buses)) (b as unknown as { apply: () => void }).apply(); };

  function ensure(): Ctx | null {
    if (ac) return ac;
    try {
      ac = deps.platform.audioCtx();
      if (!ac) return null;
      try { const n = navigator as unknown as { audioSession?: { type: string } }; if (n.audioSession) n.audioSession.type = 'ambient'; } catch { /* not iOS */ }
      master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
      for (const b of Object.values(buses)) { b.node = ac.createGain(); b.node.connect(master); }
      try { bank = createBank(ac, SES_DB as unknown as SesDb); } catch { bank = null; }
      applyAll();
    } catch { ac = null; }
    return ac;
  }
  const live = () => !!ac && !suspended && ac.state !== 'closed';
  const busOut = (b: BusImpl) => b.node as GainNode;
  const sfxSilent = () => !live() || buses.sfx.muted || buses.sfx.volume <= 0;

  // ---------- v2 synth primitives (same math as v2 core.js) ----------
  function tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.2, slide = 0, delay = 0, out?: AudioNode) {
    if (sfxSilent() || !ac) return;
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(out || busOut(buses.sfx)); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d: number, v = 0.15, freq = 3000, q = 0.8, delay = 0, out?: AudioNode) {
    if (sfxSilent() || !ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = noiseBuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const t = ac.currentTime + delay, s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(f); f.connect(g); g.connect(out || busOut(buses.sfx)); s.start(t); s.stop(t + d + 0.05);
  }
  function speak(V: { voice: number; wave?: OscillatorType; formant?: number }, mood: 'ok' | 'happy' | 'angry' = 'ok', n?: number) {
    if (!live() || !ac || buses.voice.muted) return;
    const syl = n || 2 + Math.floor(Math.random() * 3);
    const base = V.voice * (mood === 'angry' ? 0.82 : mood === 'happy' ? 1.12 : 1);
    let t = ac.currentTime + 0.02;
    for (let i = 0; i < syl; i++) {
      const d = 0.06 + Math.random() * 0.07, f0 = base * (0.85 + Math.random() * 0.35);
      const o = ac.createOscillator(); o.type = V.wave || 'sawtooth';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * (mood === 'angry' ? 0.7 : 0.88), t + d);
      const vw = VOWELS[Math.floor(Math.random() * VOWELS.length)], g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      vw.forEach((fq, k) => { const b = ac!.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq * (V.formant || 1); b.Q.value = 6; const bg = ac!.createGain(); bg.gain.value = k ? 0.7 : 1.4; o.connect(b); b.connect(bg); bg.connect(g); });
      g.connect(busOut(buses.voice)); o.start(t); o.stop(t + d + 0.02);
      t += d + 0.015 + Math.random() * 0.03;
    }
  }
  let coinGate = 0;
  type Recipe = (out?: AudioNode) => void;
  const SFX: Record<string, Recipe> = {
    pop: o => tone(420 + Math.random() * 90, 0.07, 'triangle', 0.12, 220, 0, o),
    drop: o => tone(300, 0.06, 'triangle', 0.1, -60, 0, o),
    cut: o => noise(0.06, 0.08, 5200, 2, 0, o),
    pour: o => noise(0.25, 0.06, 1400, 1.5, 0, o),
    fizz: o => noise(0.35, 0.07, 7000, 0.6, 0, o),
    coin: o => { const n = deps.platform.clock.now(); if (n - coinGate < 45) return; coinGate = n; tone(1180 + Math.random() * 200, 0.06, 'square', 0.04, 0, 0, o); },
    cash: o => { tone(880, 0.08, 'triangle', 0.13, 0, 0, o); tone(1320, 0.12, 'triangle', 0.11, 0, 0.07, o); tone(1760, 0.18, 'sine', 0.09, 0, 0.14, o); },
    buy: o => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, 0, i * 0.07, o)),
    bad: o => tone(180, 0.25, 'sawtooth', 0.08, -60, 0, o),
    wake: o => tone(300, 0.2, 'square', 0.06, 400, 0, o),
    flash: o => noise(0.12, 0.12, 6000, 1, 0, o),
    clean: o => noise(0.2, 0.08, 2600, 0.7, 0, o),
    gull: o => { tone(1500, 0.14, 'sawtooth', 0.04, -700, 0, o); tone(1650, 0.12, 'sawtooth', 0.035, -800, 0.16, o); },
    horn: o => { tone(196, 1.1, 'sawtooth', 0.07, -6, 0, o); tone(247, 1.1, 'sawtooth', 0.05, -6, 0, o); },
    purr: o => { for (let i = 0; i < 6; i++) tone(55 + Math.random() * 8, 0.09, 'sawtooth', 0.05, 0, i * 0.1, o); },
    bark: o => { tone(320, 0.09, 'square', 0.07, -150, 0, o); tone(300, 0.1, 'square', 0.06, -150, 0.16, o); },
    streak: o => [660, 880, 1175].forEach((f, i) => tone(f, 0.12, 'square', 0.06, 0, i * 0.05, o)),
    day: o => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, 0, i * 0.13, o)),
    // ses-2 must-haves (new, same synth style)
    spoon: o => { tone(2630, 0.09, 'sine', 0.05, 0, 0, o); tone(3950, 0.07, 'sine', 0.03, 0, 0.01, o); },
    sizzle: o => noise(0.6, 0.05, 6200, 0.5, 0, o),
    creak: o => tone(140 + Math.random() * 40, 0.22, 'sawtooth', 0.025, 60, 0, o),
    // ses / animasyon polish
    tik: o => { tone(3300, 0.05, 'sine', 0.06, 0, 0, o); tone(5100, 0.04, 'sine', 0.03, 0, 0.004, o); tone(2200, 0.06, 'triangle', 0.02, 0, 0.01, o); },
    steamHiss: o => { noise(0.55, 0.06, 5200, 0.4, 0, o); noise(0.3, 0.04, 8000, 0.6, 0.05, o); },
    press: o => { tone(120, 0.08, 'square', 0.05, -40, 0, o); noise(0.05, 0.05, 900, 1, 0, o); },
    blow: o => noise(0.45, 0.035, 700, 0.6, 0, o),
    shutter: o => { for (let i = 0; i < 7; i++) noise(0.05, 0.05, 700 + i * 60, 3, i * 0.045, o); tone(90, 0.3, 'sawtooth', 0.02, -20, 0, o); },
    sparkle: o => [1568, 2093, 2637].forEach((f, i) => tone(f, 0.12, 'sine', 0.05, 0, i * 0.05, o)),
    confetti: o => { noise(0.08, 0.12, 2500, 0.8, 0, o); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, 0, 0.05 + i * 0.06, o)); },
    feather: o => noise(0.25, 0.03, 3000, 0.5, 0, o),
    splash: o => { noise(0.4, 0.07, 1200, 0.5, 0, o); noise(0.25, 0.05, 4200, 0.8, 0.05, o); },
    puff: o => noise(0.08, 0.025, 500, 0.8, 0, o),
    jingle: o => { [784, 659, 523, 784, 1047].forEach((f, i) => tone(f, i === 4 ? 0.45 : 0.16, 'triangle', 0.09, 0, i * 0.13, o)); tone(1568, 0.5, 'sine', 0.03, 0, 0.52, o); },
    simitci: o => simitci(o),
    // halı saha (user 2026-10-24): hakem düdüğü, top vuruşu, direk, file, tribün
    whistle: o => { for (let i = 0; i < 3; i++) tone(2900 + (i % 2) * 140, 0.09, 'square', 0.035, 0, i * 0.08, o); },
    whistleLong: o => { tone(2950, 0.65, 'square', 0.04, -60, 0, o); tone(3080, 0.65, 'square', 0.025, -60, 0.02, o); tone(2950, 0.9, 'square', 0.04, -80, 0.75, o); },
    kick: o => { tone(150, 0.09, 'sine', 0.22, -80, 0, o); noise(0.05, 0.1, 1800, 1, 0, o); },
    post: o => { tone(880, 0.35, 'triangle', 0.09, -40, 0, o); tone(1320, 0.25, 'sine', 0.05, 0, 0, o); },
    net: o => { noise(0.3, 0.08, 900, 0.7, 0, o); noise(0.2, 0.05, 2400, 1, 0.04, o); },
    crowdCheer: o => { noise(1.6, 0.11, 1100, 0.4, 0, o); noise(1.4, 0.07, 2600, 0.5, 0.1, o); for (let i = 0; i < 5; i++) tone(500 + Math.random() * 300, 0.4, 'sawtooth', 0.012, 120, 0.1 + i * 0.12, o); },
    // 16:52 user: halı saha needs a real stand, the forest its birds, the bus its engine
    clapChant: o => { [0, 0.28, 0.56, 1.1, 1.38, 1.66, 1.94, 2.22].forEach((t, i) => noise(0.07, i % 4 === 3 ? 0.16 : 0.12, 1500, 0.8, t, o)); tone(220, 0.5, 'sawtooth', 0.02, 0, 0.0, o); tone(247, 0.5, 'sawtooth', 0.02, 0, 0.56, o); tone(196, 0.8, 'sawtooth', 0.02, 0, 1.1, o); },
    tribunDavul: o => { for (let i = 0; i < 8; i++) { tone(70, 0.18, 'sine', i % 2 ? 0.18 : 0.26, -20, i * 0.3, o); if (i % 2) noise(0.05, 0.05, 3000, 1, i * 0.3, o); } },
    birdTrill: o => { const b = 2400 + Math.random() * 900; for (let i = 0; i < 4 + Math.floor(Math.random() * 4); i++) tone(b + (i % 2) * 500, 0.07, 'sine', 0.05, 900, i * 0.11, o); },
    birdCall: o => { const b = 1600 + Math.random() * 500; tone(b, 0.22, 'sine', 0.05, 700, 0, o); tone(b * 0.8, 0.3, 'sine', 0.045, -300, 0.3, o); },
    woodpecker: o => { for (let i = 0; i < 9; i++) noise(0.02, 0.09, 2200, 3, i * 0.06, o); },
    busStart: o => { tone(55, 1.6, 'sawtooth', 0.06, 30, 0, o); tone(82, 1.4, 'square', 0.025, 40, 0.1, o); noise(0.5, 0.06, 4500, 0.7, 0, o); },
    busDoor: o => { noise(0.6, 0.08, 5200, 0.5, 0, o); tone(420, 0.12, 'square', 0.03, 0, 0.55, o); tone(420, 0.12, 'square', 0.03, 0, 0.75, o); },
    // karşı yaka morgu (gece): alçak inilti, kapı tıkırtısı, fısıltı
    moan: o => { tone(78, 1.8, 'sawtooth', 0.05, -22, 0, o); tone(117, 1.6, 'triangle', 0.035, -30, 0.2, o); noise(1.4, 0.03, 380, 0.5, 0.1, o); },
    knock: o => { [0, 0.34, 0.62].forEach(t => { tone(95, 0.09, 'sine', 0.2, -30, t, o); noise(0.04, 0.09, 700, 1, t, o); }); },
    whisper: o => { noise(1.2, 0.045, 3400, 1.4, 0, o); noise(0.9, 0.03, 5200, 2, 0.3, o); },
    crowdOoh: o => { noise(0.9, 0.06, 600, 0.6, 0, o); tone(260, 0.8, 'sawtooth', 0.014, -70, 0, o); tone(330, 0.8, 'sawtooth', 0.01, -80, 0.03, o); },
  };
  // distant street-vendor call "ta-ze si-miii-it": voice formants with a long falling last vowel (ses-2)
  function simitci(out?: AudioNode) {
    if (sfxSilent() || !ac) return;
    const syl: [number, number, number][] = [[230, 0.13, 0], [250, 0.16, 1], [215, 0.12, 2], [270, 0.6, 2], [200, 0.1, 2]];
    let t = ac.currentTime + 0.02;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.connect(out || busOut(buses.sfx));
    for (const [f0, d, vi] of syl) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * (d > 0.4 ? 0.82 : 0.95), t + d);
      const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.03); g.gain.setValueAtTime(0.045, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      VOWELS[vi].forEach((fq, k) => { const b = ac!.createBiquadFilter(); b.type = 'bandpass'; b.frequency.value = fq; b.Q.value = 7; const bg = ac!.createGain(); bg.gain.value = k ? 0.6 : 1.3; o.connect(b); b.connect(bg); bg.connect(g); });
      g.connect(lp); o.start(t); o.stop(t + d + 0.02);
      t += d + 0.03;
    }
  }

  function sample(slot: string): AudioBuffer | null {
    try {
      if (!deps.dress || !deps.dress.has(slot)) return null;
      const v = deps.dress.get<unknown>(slot);
      return v && typeof (v as AudioBuffer).getChannelData === 'function' ? (v as AudioBuffer) : null;
    } catch { return null; }
  }
  function playBuffer(buf: AudioBuffer, out: AudioNode, vol = 1, rate = 1, loop = false): AudioBufferSourceNode | null {
    if (!ac) return null;
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = loop; s.playbackRate.value = rate;
    const g = ac.createGain(); g.gain.value = vol; s.connect(g); g.connect(out); s.start();
    return s;
  }

  // ---------- music (stems as sample slots) ----------
  let zone = '', phase: DayPhase = 'morning';
  let musicSrc: { s: AudioBufferSourceNode; g: GainNode; key: string } | null = null;
  function refreshMusic() {
    if (!ac || !live()) return;
    const key = `music.${zone}.${phase}`;
    if (musicSrc && musicSrc.key === key) return;
    const buf = sample(key) || sample(`music.${zone}.day`);
    const old = musicSrc; musicSrc = null;
    const t = ac.currentTime;
    if (old) { try { old.g.gain.setTargetAtTime(0, t, 0.6); old.s.stop(t + 2.5); } catch { /* stopped */ } }
    hasSampleMusic = !!buf;
    syncLofi();
    if (!buf) return;
    const g = ac.createGain(); g.gain.value = 0; g.connect(busOut(buses.music));
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start();
    g.gain.setTargetAtTime(1, t, 0.6);
    musicSrc = { s, g, key };
  }

  // ---------- procedural lo-fi (no music sample) ----------
  function musicAudible() { return !!ac && live() && !ownMusic && !buses.music.muted && buses.music.volume > 0 && !hasSampleMusic; }
  function syncLofi() {
    try {
      if (!ac) return;
      if (musicAudible()) {
        if (!lofi) { if (!bank) return; lofi = createMusicPlayer(ac, busOut(buses.music), bank); }
        lofi.setPlace(lofiPlace); lofi.setPhase(phase); lofi.setIntensity(intensity); lofi.setEvent(lofiEvent); lofi.setWeather(lofiWeather);
        if (!lofi.playing) lofi.start();
      } else if (lofi && lofi.playing) lofi.stop();
    } catch { /* never throw */ }
  }

  // ---------- ambience (cached loops: sea, grill, weather; sparse one-shots) ----------
  let ambOn = false, ambNodes: AudioScheduledSourceNode[] = [], ambTimer: ReturnType<typeof setTimeout> | null = null;
  let sizzleG: GainNode | null = null, weatherG: GainNode | null = null, weatherSrc: AudioBufferSourceNode | null = null, weatherKey = '';
  function loopTo(id: string, out: AudioNode, vol: number, onNode?: (s: AudioBufferSourceNode, g: GainNode) => void) {
    if (!bank || !ac) return;
    bank.loop(id, buf => {
      if (!ambOn || !ac) return;
      const g = ac.createGain(); g.gain.value = 0; g.connect(out);
      const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g);
      s.start(ac.currentTime, Math.random() * buf.duration);
      g.gain.setTargetAtTime(vol, ac.currentTime, 1.2);
      ambNodes.push(s);
      onNode?.(s, g);
    });
  }
  function weatherLoop(): string { return ambWeather === 'saganak' || ambWeather === 'firtina' ? 'yagmur' : ambWeather === 'lodos' ? 'ruzgar' : ''; }
  function syncWeather() {
    if (!ambOn || !ac) return;
    const key = weatherLoop();
    if (key === weatherKey) return;
    weatherKey = key;
    if (weatherSrc && weatherG) { const s = weatherSrc, g = weatherG; try { g.gain.setTargetAtTime(0, ac.currentTime, 1.5); s.stop(ac.currentTime + 6); } catch { /* */ } }
    weatherSrc = null; weatherG = null;
    if (key) loopTo(key, busOut(buses.sfx), ambWeather === 'firtina' ? 0.75 : key === 'ruzgar' ? 0.4 : 0.55, (s, g) => { if (weatherLoop() === key) { weatherSrc = s; weatherG = g; } else { try { s.stop(); } catch { /* */ } } });
  }
  function startAmbience() {
    if (ambOn || !ac || !live()) return;
    ambOn = true;
    const out = busOut(buses.sfx);
    const loop = sample(`amb.${zone || 'iskele'}`);
    if (loop) { const s = playBuffer(loop, out, 0.5, 1, true); if (s) ambNodes.push(s); }
    else if (zone === 'orman') loopTo('ruzgar', out, 0.16);        // leaves in the wind, no sea
    else if (zone === 'halisaha' || zone === 'stadyum') crowdBed(out);
    else if (zone !== 'ev') {
      loopTo('deniz', out, 0.42);
      // grill: level follows the listener's distance to the döner (setGrill)
      if (ac) { sizzleG = ac.createGain(); sizzleG.gain.value = 0; sizzleG.connect(out); loopTo('izgara', sizzleG, 1); updateSizzle(); }
    }
    weatherKey = ''; syncWeather();
    const tick = () => {
      if (!ambOn) return;
      if (live() && ac && (zone === 'orman' || zone === 'halisaha' || zone === 'stadyum')) {
        const g = ac.createGain(); const pan = ac.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan); pan.connect(out);
        const r = Math.random(), day = phase === 'morning' || phase === 'noon';
        if (zone === 'orman') {
          g.gain.value = 0.5;
          if (!day && phase === 'night') { g.gain.value = 1; seasonCall(g, false); }
          else if (r < 0.45) SFX.birdTrill(g); else if (r < 0.75) SFX.birdCall(g); else if (r < 0.88) SFX.woodpecker(g); else { g.gain.value = 0.25; playId('sizzle', g); }
          ambTimer = setTimeout(tick, 2500 + Math.random() * 4000); return;
        }
        g.gain.value = 0.55;
        if (r < 0.35) SFX.clapChant(g); else if (r < 0.6) SFX.tribunDavul(g); else if (r < 0.8) SFX.crowdCheer(g); else SFX.crowdOoh(g);
        ambTimer = setTimeout(tick, 2600 + Math.random() * 2600); return;
      }
      if (live() && ac && zone !== 'ev') {
        const r = Math.random();
        const pan = ac.createStereoPanner(); pan.pan.value = Math.max(-1, Math.min(1, (Math.random() * 24 - 12 - listener.x * 0.1) / 12));
        const g = ac.createGain(); g.gain.value = 0.4; g.connect(pan); pan.connect(out);
        const day = phase === 'morning' || phase === 'noon';
        if (ambWeather === 'firtina' && r < 0.25) { g.gain.value = 0.7; playId('thunder', g); }
        else if (r < 0.4) playId('gull', g);
        else if (r < 0.55) playId('creak', g);
        else if (r < 0.66) { g.gain.value = 0.3; playId('spoon', g); }
        else if (r < 0.74) { g.gain.value = 0.22; playId('horn', g); }          // uzaktan vapur düdüğü
        else if (r < 0.84 && day) { g.gain.value = 0.4; SFX.simitci(g); }        // uzaktan 'taze simiiit'
        else seasonCall(g, day);
      }
      ambTimer = setTimeout(tick, 9000 + Math.random() * 9000);
    };
    ambTimer = setTimeout(tick, 4000);
  }
  /** halı saha / stadium: a constant murmuring crowd (band-passed noise, slow swell), kept in ambNodes. */
  function crowdBed(out: AudioNode) {
    if (!ac) return;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0.0; g.gain.setTargetAtTime(0.16, ac.currentTime, 1.5);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.13; const lg = ac.createGain(); lg.gain.value = 0.06; lfo.connect(lg); lg.connect(g.gain);
    n.connect(bp); bp.connect(g); g.connect(out); n.start(); lfo.start();
    ambNodes.push(n, lfo);
  }
  /** survey 2026-10-24 (mevsim sesleri): procedural season calls. Summer days: ağustos böceği; warm nights: cırcır
   *  böceği; autumn and winter: a wind gust through the pier; spring: a little bird trill. */
  function seasonCall(out: GainNode, day: boolean) {
    if (!ac || ambWeather === 'saganak' || ambWeather === 'firtina') return;
    const t0 = ac.currentTime;
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const env = ac.createGain(); env.gain.value = 0; env.connect(out);
    if ((ambSeason === 'yaz' || ambSeason === 'ilkbahar') && !day) {
      for (let k = 0; k < 6; k++) for (let p = 0; p < 3; p++) { const o = ac.createOscillator(); o.frequency.value = 4400; const g = ac.createGain(); g.gain.value = 0; o.connect(g); g.connect(env); const st = t0 + k * 0.55 + p * 0.07; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.12, st + 0.01); g.gain.linearRampToValueAtTime(0, st + 0.045); o.start(st); o.stop(st + 0.06); }
      env.gain.value = 1;
    } else if (ambSeason === 'yaz' && day) {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5200; bp.Q.value = 6;
      const am = ac.createGain(); am.gain.value = 0.5; const lfo = ac.createOscillator(); lfo.frequency.value = 38; const lg = ac.createGain(); lg.gain.value = 0.5; lfo.connect(lg); lg.connect(am.gain);
      n.connect(bp); bp.connect(am); am.connect(env);
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(0.35, t0 + 0.8); env.gain.setValueAtTime(0.35, t0 + 2.6); env.gain.linearRampToValueAtTime(0, t0 + 3.6);
      n.start(t0); lfo.start(t0); n.stop(t0 + 3.7); lfo.stop(t0 + 3.7);
    } else if (ambSeason === 'ilkbahar') {
      for (let k = 0; k < 5; k++) { const o = ac.createOscillator(); o.type = 'sine'; const st = t0 + k * 0.16; o.frequency.setValueAtTime(2600 + Math.random() * 600, st); o.frequency.exponentialRampToValueAtTime(3800, st + 0.08); const g = ac.createGain(); g.gain.value = 0; g.gain.setValueAtTime(0, st); g.gain.linearRampToValueAtTime(0.1, st + 0.02); g.gain.linearRampToValueAtTime(0, st + 0.1); o.connect(g); g.connect(env); o.start(st); o.stop(st + 0.12); }
      env.gain.value = 1;
    } else {
      const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const lp = ac.createBiquadFilter(); lp.type = 'bandpass'; lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(300, t0); lp.frequency.linearRampToValueAtTime(900, t0 + 1.8); lp.frequency.linearRampToValueAtTime(350, t0 + 4);
      n.connect(lp); lp.connect(env);
      const v = ambSeason === 'kis' ? 0.5 : 0.32;
      env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(v, t0 + 1.6); env.gain.linearRampToValueAtTime(0, t0 + 4.2);
      n.start(t0); n.stop(t0 + 4.3);
    }
  }
  function updateSizzle() {
    if (!sizzleG || !ac) return;
    const d = grill ? Math.hypot(grill.x - listener.x, grill.z - listener.z) : 99;
    const v = d < 8 ? 0.22 * (1 - d / 8) : 0;
    try { sizzleG.gain.setTargetAtTime(v, ac.currentTime, 0.4); } catch { /* */ }
  }
  function stopAmbience() {
    if (sizzleG) { try { sizzleG.disconnect(); } catch { /* */ } }
    sizzleG = null; weatherG = null; weatherSrc = null; weatherKey = '';
    ambOn = false; if (ambTimer) clearTimeout(ambTimer); ambTimer = null;
    for (const n of ambNodes) { try { n.stop(); } catch { /* already */ } }
    ambNodes = [];
  }
  /** Play a database sound (cached buffer) into `out`; false if the id isn't in the database or is cooling down. */
  function playId(id: string, out: AudioNode, pitch = 1): boolean {
    if (!bank || !bank.hasSfx(id) || !ac) return false;
    if (!bank.gate(id, deps.platform.clock.now())) return true;
    const buf = bank.sfx(id); if (!buf) return false;
    const pv = bank.pitchVar(id);
    playBuffer(buf, out, 1, pitch * (1 + (Math.random() * 2 - 1) * pv));
    return true;
  }

  const audio: MotorAudio = {
    buses,
    jingle() {
      try { if (sfxSilent() || !ac) return; if (!playId('jingle', busOut(buses.sfx))) SFX.jingle(busOut(buses.sfx)); lofi?.duck(3.5); } catch { /* */ }
    },
    speak(text, who, mood) {
      try {
        if (!live() || !ac || buses.voice.muted) return;
        const vs = (SES_DB as unknown as SesDb).voices as Record<string, VoiceProfile>;
        babble(ac, busOut(buses.voice), text, vs[who || ''] || vs.varsayilan, mood);
      } catch { /* */ }
    },
    bank: () => bank,
    sfx(id, opts) {
      try {
        if (sfxSilent() || !ac) return;
        let out: AudioNode = busOut(buses.sfx);
        if (opts && (opts.at || opts.vol != null)) {
          const g = ac.createGain(); let vol = opts.vol ?? 1;
          if (opts.at) {
            const dx = opts.at.x - listener.x, dz = opts.at.z - listener.z, d = Math.hypot(dx, dz);
            vol *= 1 / (1 + d / 10);
            const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, dx / 12)); g.connect(p); p.connect(out);
          } else g.connect(out);
          g.gain.value = vol; out = g;
        }
        const buf = sample('sfx.' + id);
        if (buf) { playBuffer(buf, out, 1, opts?.pitch ?? 1); return; }
        if (playId(id, out, opts?.pitch ?? 1)) return;
        (SFX[id] || SFX.pop)(out);
      } catch { /* never throw from audio */ }
    },
    music: {
      setZone(id) { if (id === zone) return; zone = id; lofiPlace = id; try { lofi?.setPlace(id); refreshMusic(); if (ambOn && id !== 'ev') { stopAmbience(); startAmbience(); } } catch { /* ignore */ } },
      setPhase(p) { if (p === phase) return; phase = p; try { lofi?.setPhase(p); refreshMusic(); } catch { /* ignore */ } },
      setIntensity(v) { intensity = Math.max(0, Math.min(1, +v || 0)); lofi?.setIntensity(intensity); (buses.music as unknown as { apply: () => void }).apply(); },
      setEvent(id) { lofiEvent = id; lofi?.setEvent(id); },
      setWeather(k) { lofiWeather = k; lofi?.setWeather(k); ambWeather = k; syncWeather(); },
      duck(sec) { lofi?.duck(sec); },
      layers() { return lofi && lofi.playing ? lofi.layers() : []; },
    },
    ambience: {
      setListener(pos) { listener.x = pos.x; listener.z = pos.z; updateSizzle(); },
      setGrill(pos) { grill = pos ? { x: pos.x, z: pos.z } : null; updateSizzle(); },
      setSeason(v) { ambSeason = String(v || 'sonbahar'); },
    },
    voice(lineId) {
      try {
        const now = deps.platform.clock.now();
        if (now - lastVoice < 10000 || !live()) return;
        lastVoice = now;
        const buf = sample('voice.' + lineId);
        if (buf) { playBuffer(buf, busOut(buses.voice)); return; }
        const mood = /kiz|ofke|angry/.test(lineId) ? 'angry' : /mutlu|happy|tesekkur/.test(lineId) ? 'happy' : 'ok';
        if (bank) audio.speak(lineId === 'selam' ? 'selamün aleyküm' : lineId === 'mutlu' ? 'oh be yaşasın' : lineId, 'varsayilan', mood);
        else speak({ voice: 150, wave: 'sawtooth', formant: 1 }, mood);
      } catch { /* ignore */ }
    },
    ownMusicMode(on) { ownMusic = !!on; (buses.music as unknown as { apply: () => void }).apply(); },
    suspend(on) {
      suspended = !!on;
      try { if (ac) { if (on) void ac.suspend().catch(() => {}); else void ac.resume().catch(() => {}); } } catch { /* ignore */ }
      if (on) stopAmbience(); else if (ac) { refreshMusic(); startAmbience(); }
      syncLofi();
    },
    unlock() {
      try {
        const c = ensure(); if (!c) return;
        if (c.state !== 'running' && !suspended) void c.resume().catch(() => {});
        if (!suspended) { refreshMusic(); startAmbience(); syncLofi(); }
        bank?.prewarm();
      } catch { /* ignore */ }
    },
  };
  // test/debug: which recipes exist (used by unit tests and the editor sound list)
  (audio as unknown as { recipes: string[] }).recipes = Object.keys(SFX);
  return audio;
}
