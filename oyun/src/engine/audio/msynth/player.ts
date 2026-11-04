// Music player on top of the bank: same surface as the old procedural lo-fi (engine/audio/lofi.ts) so the audio
// facade swaps it in place. Plays one pre-rendered loop at a time and crossfades (3 s) when phase / weather /
// place / event picks another track. Fog muffles through one lowpass; intensity (crowd) and duck move one gain.
import type { Bank } from './index';
import { pickTrack } from './music';
import type { Lofi, LofiPhase } from '../lofi';

export function createMusicPlayer(ac: AudioContext, out: AudioNode, bank: Bank): Lofi {
  let on = false, phase: LofiPhase = 'morning', place = 'iskele', weather = 'acik', event: string | null = null, intensity = 0.5;
  let cur: { key: string; src: AudioBufferSourceNode; g: GainNode } | null = null;
  let want = '', variant = 0, rotT: ReturnType<typeof setInterval> | null = null;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; lp.Q.value = 0.5;
  const master = ac.createGain(); master.gain.value = 0.9;
  lp.connect(master); master.connect(out);
  const level = () => 0.75 + 0.25 * intensity;
  function apply() {
    try {
      master.gain.setTargetAtTime(level(), ac.currentTime, 0.4);
      lp.frequency.setTargetAtTime(weather === 'sis' ? 1400 : weather === 'saganak' || weather === 'firtina' ? 5000 : 20000, ac.currentTime, 0.8);
    } catch { /* closed */ }
  }
  function sync() {
    if (!on) return;
    const key = pickTrack(bank.db.music, phase, weather, place, event, variant);
    if (cur && cur.key === key) return;
    want = key;
    bank.track(key, buf => {
      if (!on || want !== key || (cur && cur.key === key)) return;
      const t = ac.currentTime;
      if (cur) { const old = cur; try { old.g.gain.setTargetAtTime(0, t, 1); old.src.stop(t + 5); } catch { /* */ } }
      const g = ac.createGain(); g.gain.value = 0; g.connect(lp);
      const src = ac.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(g); src.start();
      g.gain.setTargetAtTime(1, t, 1);
      cur = { key, src, g };
    });
  }
  // render the likely next tracks in the background so changes are instant
  const warm = () => { for (const k of new Set(Object.values(bank.db.music.map.phase).flat())) bank.track(k, () => { /* cached */ }); };
  return {
    start() { if (on) return; on = true; apply(); sync(); setTimeout(warm, 4000); if (!rotT) rotT = setInterval(() => { variant++; sync(); }, 150000); },
    stop() { on = false; want = ''; if (rotT) { clearInterval(rotT); rotT = null; } if (cur) { const c = cur; cur = null; try { c.g.gain.setTargetAtTime(0, ac.currentTime, 0.3); c.src.stop(ac.currentTime + 1.5); } catch { /* */ } } },
    get playing() { return on; },
    setPlace(id) { place = id; sync(); },
    setPhase(p) { phase = p; sync(); },
    setIntensity(v) { intensity = Math.max(0, Math.min(1, v)); apply(); },
    setEvent(id) { event = id; sync(); },
    setWeather(k) { weather = k; apply(); sync(); },
    duck(sec) { try { const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setTargetAtTime(level() * 0.35, t, 0.15); master.gain.setTargetAtTime(level(), t + sec, 0.6); } catch { /* */ } },
    layers() { return cur ? [cur.key] : []; },
  };
}
