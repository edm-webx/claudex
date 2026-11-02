// Procedural lo-fi İstanbul music (survey genel-6, ses-1). WebAudio only, no samples. View side (Math.random ok).
//
// Decisions:
// - A lookahead scheduler (timer every 60 ms, 0.3 s ahead) plays 16th steps with a little swing. Every 4 bars the
//   melody phrase is regenerated from the chord (pentatonic over the chord tones) and played twice, so it feels
//   like a song, not noise. Progressions are 2000s-style sevenths (ii-V-I-vi and friends).
// - Place signature (ses-1): each place has its own lead instrument and key: iskele = bağlama-ish pluck in D dorian,
//   çarşı = klarnet in A hicaz, ev (Sabri'nin evi) = müzik kutusu in F, anything else = mandolin.
// - Day phase variant: morning bright and light, noon fuller, sunset warm and slower, night = "fısıltı" (no drums,
//   soft pad and a sparse lead, quieter).
// - Layers follow intensity 0..1 (crowd size): chords + vinyl crackle always, bass >= .2, drums >= .4, lead >= .6,
//   extra darbuka/tef + counter melody >= .8. setEvent(id) adds the festive layer (darbuka + tef, +6 BPM) and a
//   brighter progression (ses-1 "etkinliklere özel müzik").
// - Weather: rain/snow/fog muffle the mix (lowpass), lodos/fırtına add a slow wobble. duck(sec) lowers the music for
//   radio jingles. Tape wobble: one slow LFO on every tonal oscillator's detune (lo-fi flutter).
// - Never throws; everything goes to `out` (the music bus), so the music slider / mute / own-music mode just work.

export type LofiPlace = 'iskele' | 'carsi' | 'ev' | string;
export type LofiPhase = 'morning' | 'noon' | 'sunset' | 'night';
export interface Lofi {
  start(): void;
  stop(): void;
  readonly playing: boolean;
  setPlace(id: LofiPlace): void;
  setPhase(p: LofiPhase): void;
  setIntensity(v: number): void;
  setEvent(id: string | null): void;
  setWeather(kind: string): void;
  duck(sec: number): void;
  /** Active layer names (debug / perf panel). */
  layers(): string[];
}

type Inst = 'baglama' | 'klarnet' | 'kutu' | 'mandolin';
interface PlaceDef { root: number; scale: number[]; lead: Inst; }
// root = MIDI note of the tonic; scale = semitone steps used for melodies
const PLACES: Record<string, PlaceDef> = {
  iskele: { root: 50, scale: [0, 2, 3, 5, 7, 9, 10], lead: 'baglama' },     // D dorian
  carsi: { root: 57, scale: [0, 1, 4, 5, 7, 8, 10], lead: 'klarnet' },      // A hicaz
  ev: { root: 53, scale: [0, 2, 4, 5, 7, 9, 11], lead: 'kutu' },            // F major
  other: { root: 55, scale: [0, 2, 3, 5, 7, 8, 10], lead: 'mandolin' },     // G minor
};
// chord = scale degree root (semitones from tonic) + chord tones (semitones from chord root)
type Chord = [number, number[]];
const M7 = [0, 4, 7, 11], m7 = [0, 3, 7, 10], D7 = [0, 4, 7, 10], m9 = [0, 3, 7, 10, 14], sus = [0, 5, 7, 10];
const PROGS: Record<string, Chord[]> = {
  morning: [[0, m9], [5, D7], [10, M7], [3, M7]],
  noon: [[0, m7], [3, M7], [5, m7], [7, D7]],
  sunset: [[8, M7], [3, M7], [0, m9], [7, sus]],
  night: [[0, m9], [8, M7], [3, M7], [10, D7]],
  event: [[0, m7], [5, D7], [3, M7], [7, D7]],
};
const BPM: Record<LofiPhase, number> = { morning: 80, noon: 84, sunset: 74, night: 64 };
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export function createLofi(ac: AudioContext, out: AudioNode): Lofi {
  let place: PlaceDef = PLACES.iskele, phase: LofiPhase = 'morning', intensity = 0.5, event: string | null = null, weather = 'acik';
  let on = false, timer: ReturnType<typeof setTimeout> | null = null;
  let step = 0, nextT = 0, bar = 0;
  let phrase: (number | null)[] = [], counter: (number | null)[] = [];

  // master chain: in -> tone (lowpass) -> duck gain -> out
  const input = ac.createGain(); input.gain.value = 0.9;
  const tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.3;
  const duckG = ac.createGain(); duckG.gain.value = 1;
  input.connect(tone); tone.connect(duckG); duckG.connect(out);
  // tape flutter LFO -> detune of every tonal voice
  const wob = ac.createOscillator(); wob.frequency.value = 0.55;
  const wobG = ac.createGain(); wobG.gain.value = 7; wob.connect(wobG);
  let wobStarted = false;

  // vinyl crackle: 4 s loop of sparse clicks + hiss
  let crackleSrc: AudioBufferSourceNode | null = null;
  const crackleG = ac.createGain(); crackleG.gain.value = 0.22; crackleG.connect(input);
  function crackleBuf(): AudioBuffer {
    const len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * 0.012;
    const pops = 70;
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(Math.random() * (len - 200)), amp = 0.15 + Math.random() * 0.5 * (Math.random() < 0.15 ? 1.6 : 1);
      for (let k = 0; k < 40; k++) ch[at + k] += amp * (Math.random() * 2 - 1) * Math.exp(-k / 6);
    }
    return b;
  }
  let crackle: AudioBuffer | null = null;

  // ───────── voices ─────────
  function osc(type: OscillatorType, f: number, t: number): OscillatorNode {
    const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    try { wobG.connect(o.detune); } catch { /* old browsers */ }
    return o;
  }
  function env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function rhodes(m: number, t: number, len: number, v: number) {
    const f = mtof(m), g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700;
    const o1 = osc('sine', f, t), o2 = osc('triangle', f * 2, t), g2 = ac.createGain(); g2.gain.value = 0.18;
    o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(lp); lp.connect(input);
    env(g, t, 0.02, v, len);
    o1.start(t); o2.start(t); o1.stop(t + len + 0.1); o2.stop(t + len + 0.1);
  }
  function bass(m: number, t: number, len: number, v: number) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const o = osc('triangle', mtof(m), t); o.connect(lp); lp.connect(g); g.connect(input);
    env(g, t, 0.01, v, len); o.start(t); o.stop(t + len + 0.05);
  }
  let nbuf: AudioBuffer | null = null;
  function noiseHit(t: number, d: number, v: number, type: BiquadFilterType, f: number, q = 0.8) {
    if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = nbuf.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = nbuf;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(input); s.start(t, Math.random() * 0.7); s.stop(t + d + 0.05);
  }
  function kick(t: number, v: number) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(input); o.start(t); o.stop(t + 0.32);
  }
  const snare = (t: number, v: number) => noiseHit(t, 0.16, v, 'bandpass', 1700, 0.7);
  const hat = (t: number, v: number) => noiseHit(t, 0.035, v, 'highpass', 7200);
  function darbuka(t: number, kind: 'dum' | 'tek', v: number) {
    if (kind === 'dum') { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(120, t + 0.12); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(input); o.start(t); o.stop(t + 0.22); }
    else noiseHit(t, 0.06, v * 0.8, 'bandpass', 3800, 2.5);
  }
  const tef = (t: number, v: number) => noiseHit(t, 0.12, v, 'highpass', 9000, 0.5);
  function lead(m: number, t: number, len: number, v: number, inst: Inst) {
    const f = mtof(m), g = ac.createGain();
    if (inst === 'baglama' || inst === 'mandolin') {
      // plucked: bright saw through a closing lowpass, tiny pitch fall (bağlama tezene feel); mandolin = tremolo pairs
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(3600, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.35);
      const o = osc('sawtooth', f * 1.006, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
      o.connect(lp); lp.connect(g); g.connect(input);
      env(g, t, 0.004, v * 0.55, inst === 'mandolin' ? 0.18 : Math.min(0.6, len));
      o.start(t); o.stop(t + len + 0.6);
      if (inst === 'mandolin' && len > 0.25) lead(m, t + 0.09, len - 0.09, v * 0.7, 'mandolin');
    } else if (inst === 'klarnet') {
      // klarnet: square (odd harmonics) + vibrato, soft attack
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
      const o = osc('square', f, t), vib = ac.createOscillator(), vg = ac.createGain();
      vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.25);
      vib.connect(vg); vg.connect(o.frequency);
      o.connect(lp); lp.connect(g); g.connect(input);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.28, t + 0.06); g.gain.setValueAtTime(v * 0.25, t + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.15);
      o.start(t); vib.start(t); o.stop(t + len + 0.2); vib.stop(t + len + 0.2);
    } else {
      // müzik kutusu: high sine bell with a quiet fifth partial
      const o = osc('sine', f * 2, t), o2 = osc('sine', f * 6, t), g2 = ac.createGain(); g2.gain.value = 0.12;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(input);
      env(g, t, 0.003, v * 0.45, 0.9); o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
    }
  }

  // ───────── composition ─────────
  const prog = () => PROGS[event ? 'event' : phase] || PROGS.morning;
  function makePhrase(ch: Chord, density: number): (number | null)[] {
    const out: (number | null)[] = [];
    const tones = ch[1].slice(0, 4).map(x => ch[0] + x);
    const pool = [...tones, ...place.scale.filter((_, i) => i % 2 === 0)];
    let last = tones[0];
    for (let i = 0; i < 16; i++) {           // 16 eighths = 2 bars, repeated
      if (Math.random() > density || (i % 8 === 7)) { out.push(null); continue; }
      const cand = pool[Math.floor(Math.random() * pool.length)];
      const n = Math.abs(cand - last) > 7 ? (cand + last) >> 1 : cand;
      last = n; out.push(n);
    }
    return out;
  }
  function nearestScale(n: number): number {
    const pc = ((n % 12) + 12) % 12; let best = place.scale[0], bd = 99;
    for (const s of place.scale) { const d = Math.abs(s - pc); if (d < bd) { bd = d; best = s; } }
    return n - pc + best;
  }

  function scheduleStep(t: number) {
    const spb = 60 / (BPM[phase] + (event ? 6 : 0)), s16 = spb / 4;
    const p = prog(), ch = p[bar % p.length], root = place.root + ch[0];
    const night = phase === 'night' && !event;
    const lvl = night ? Math.min(intensity, 0.35) : intensity;
    const st = step % 16;
    const vol = night ? 0.6 : 1;
    // chords: on 1 and the "and" of 2 (lazy lo-fi comp)
    if (st === 0 || st === 6) {
      const len = st === 0 ? spb * 1.4 : spb * 2.4;
      ch[1].forEach((x, i) => rhodes(root + x + (i > 2 ? 0 : 12), t + i * 0.012, len, 0.055 * vol));
    }
    if (lvl >= 0.2 && !night) {
      if (st === 0) bass(root - 12, t, spb * 1.2, 0.2);
      if (st === 10) bass(root - 12 + ch[1][2], t, spb * 0.6, 0.15);
      if (st === 14 && Math.random() < 0.5) bass(root - 12 + ch[1][1], t, spb * 0.4, 0.12);
    }
    if (lvl >= 0.4 && !night) {
      if (st === 0 || (st === 10 && Math.random() < 0.6)) kick(t, 0.32);
      if (st === 4 || st === 12) snare(t, 0.07);
      if (st % 2 === 0) hat(t, st % 4 === 2 ? 0.03 : 0.018);
    }
    const leadOn = lvl >= 0.6 || night || event;
    if (leadOn && st % 2 === 0) {
      const idx = ((bar % 2) * 8 + st / 2) % 16, n = phrase[idx];
      if (n != null && (!night || Math.random() < 0.6)) lead(nearestScale(place.root + 12 + n), t, s16 * 2 * (Math.random() < 0.3 ? 2 : 1), (night ? 0.5 : 0.8), place.lead);
    }
    if ((lvl >= 0.8 || event) && !night) {
      // darbuka: düm tek tek düm tek (çiftetelli-ish) + tef on the off beats
      if (st === 0 || st === 6) darbuka(t, 'dum', 0.22);
      if (st === 3 || st === 8 || st === 11 || st === 14) darbuka(t, 'tek', 0.12);
      if (event && st % 4 === 2) tef(t, 0.04);
      if (st % 4 === 0) { const c = counter[(st / 4 + (bar % 4) * 4) % counter.length]; if (c != null) lead(nearestScale(place.root + c), t, spb * 0.9, 0.45, place.lead === 'klarnet' ? 'mandolin' : 'klarnet'); }
    }
  }
  function tick() {
    if (!on) return;
    try {
      const now = ac.currentTime;
      if (nextT < now - 0.2) nextT = now + 0.05; // after a stall, resync instead of bursting
      while (nextT < now + 0.3) {
        const spb = 60 / (BPM[phase] + (event ? 6 : 0)), s16 = spb / 4;
        const swing = step % 2 === 1 ? s16 * 0.14 : 0;
        if (step % 16 === 0) {
          if (bar % 4 === 0) { const p = prog(); phrase = makePhrase(p[bar % p.length], phase === 'night' ? 0.35 : 0.55); counter = makePhrase(p[(bar + 2) % p.length], 0.4); }
        }
        scheduleStep(nextT + swing);
        nextT += s16; step++;
        if (step % 16 === 0) bar++;
      }
    } catch { /* closed context */ }
    timer = setTimeout(tick, 60);
  }
  function applyTone() {
    const muffled = weather === 'saganak' || weather === 'kar' || weather === 'sis' || weather === 'firtina';
    const night = phase === 'night' && !event;
    const f = muffled ? 1500 : night ? 2600 : 5200;
    try { tone.frequency.setTargetAtTime(f, ac.currentTime, 0.8); } catch { /* */ }
    wob.frequency.value = weather === 'lodos' || weather === 'firtina' ? 0.25 : 0.55;
    wobG.gain.value = weather === 'lodos' || weather === 'firtina' ? 16 : 7;
    try { input.gain.setTargetAtTime(night ? 0.6 : 0.9, ac.currentTime, 1); } catch { /* */ }
  }

  const api: Lofi = {
    get playing() { return on; },
    start() {
      if (on) return;
      on = true;
      try {
        if (!wobStarted) { wob.start(); wobStarted = true; }
        if (!crackle) crackle = crackleBuf();
        crackleSrc = ac.createBufferSource(); crackleSrc.buffer = crackle; crackleSrc.loop = true;
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
        crackleSrc.connect(hp); hp.connect(crackleG); crackleSrc.start();
        input.gain.setValueAtTime(0, ac.currentTime); input.gain.linearRampToValueAtTime(0.9, ac.currentTime + 2);
      } catch { /* */ }
      nextT = ac.currentTime + 0.1; step = 0; bar = 0;
      applyTone();
      tick();
    },
    stop() {
      on = false;
      if (timer) clearTimeout(timer); timer = null;
      try { crackleSrc?.stop(); } catch { /* */ }
      crackleSrc = null;
    },
    setPlace(id) { place = PLACES[id] || PLACES.other; },
    setPhase(p) { if (p !== phase) { phase = p; applyTone(); } },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, +v || 0)); },
    setEvent(id) { if (id !== event) { event = id; bar = 0; } applyTone(); },
    setWeather(k) { if (k !== weather) { weather = k; applyTone(); } },
    duck(sec) {
      try { const t = ac.currentTime; duckG.gain.cancelScheduledValues(t); duckG.gain.setTargetAtTime(0.3, t, 0.08); duckG.gain.setTargetAtTime(1, t + Math.max(0.3, sec), 0.4); } catch { /* */ }
    },
    layers() {
      const night = phase === 'night' && !event, l = night ? Math.min(intensity, 0.35) : intensity, out = ['akor', 'plak'];
      if (l >= 0.2 && !night) out.push('bas');
      if (l >= 0.4 && !night) out.push('davul');
      if (l >= 0.6 || night || event) out.push(place.lead);
      if ((l >= 0.8 || event) && !night) out.push('darbuka');
      return out;
    },
  };
  return api;
}
