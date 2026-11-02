// Audio map (Builder D, M1): subscribes to the sim bus and plays the v2 sounds via engine audio. View side only;
// it never writes sim state. Sounds far from the player are panned/attenuated by audio.sfx `at` when the event
// carries a position. Music/ambience follow zone and day phase (engine/audio does the crossfade).
import type { Audio, Bus, DayPhase } from '../engine/api';
import { EVENT_SFX, EVENT_VOICE } from '../content/sfx';
import type { MotorAudio } from '../engine/audio';

export interface AudioMapDeps {
  bus: Bus<any>;
  audio: Audio;
  /** Current player position (listener). */
  playerPos?: () => { x: number; z: number };
  zone?: () => string;
  phase?: () => DayPhase;
  /** ses-1: crowd size 0..1 (music layers). */
  crowd?: () => number;
  /** Active calendar event id (event music) and weather kind (muffle / wobble). */
  event?: () => string | null;
  weather?: () => string;
  /** survey 2026-10-24: season for the ambience calls (ilkbahar / yaz / sonbahar / kis). */
  season?: () => string;
  /** Grill (döner) world position for the sizzle loop. */
  grill?: () => { x: number; z: number } | null;
  /** DOM root that carries 'sb:radio' (İskele Radyosu line changed) events. */
  root?: HTMLElement | null;
}
export interface AudioMap { update(): void; dispose(): void; }

export function createAudioMap(deps: AudioMapDeps): AudioMap {
  const { bus, audio } = deps;
  const offs: Array<() => void> = [];
  let lastTransferSfx = -1e9;
  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  for (const name of Object.keys(EVENT_SFX)) {
    const rule = EVENT_SFX[name];
    if (rule == null) continue;
    offs.push(bus.on(name, (d: any) => {
      const id = typeof rule === 'function' ? rule(d) : rule;
      if (!id) return;
      // the sim transfers every 0.08-0.1 s; one pop per ~0.16 s reads as a soft roll instead of a rattle
      if (name === 'transfer' || name === 'pick') { const now = clockNow(); if (now - lastTransferSfx < 160) return; lastTransferSfx = now; }
      const at = d && typeof d.x === 'number' && typeof d.z === 'number' ? { x: d.x, z: d.z } : undefined;
      try { audio.sfx(id, at ? { at } : undefined); } catch { /* audio is optional */ }
    }) as () => void);
  }
  // ses-3: few voiced lines, only for regulars' hellos and big moments (engine rate limit: one per 10 s)
  for (const name of Object.keys(EVENT_VOICE)) {
    offs.push(bus.on(name, () => { try { audio.voice(EVENT_VOICE[name]); } catch { /* */ } }) as () => void);
  }
  const ma = audio as Partial<MotorAudio>;
  const onRadio = () => { try { ma.jingle?.(); setTimeout(() => { try { audio.voice('radyo'); } catch { /* */ } }, 900); } catch { /* */ } };
  if (deps.root) { deps.root.addEventListener('sb:radio', onRadio); offs.push(() => deps.root?.removeEventListener('sb:radio', onRadio)); }
  let lastZone = '', lastPhase = '', lastEvent: string | null | undefined, lastWeather = '', crowdS = 0.5, slowT = 0;
  return {
    update() {
      slowT -= 1;
      if (slowT <= 0) {
        slowT = 15;
        try {
          if (deps.crowd) { crowdS += (deps.crowd() - crowdS) * 0.25; audio.music.setIntensity(crowdS); }
          if (deps.event && ma.music?.setEvent) { const e = deps.event(); if (e !== lastEvent) { lastEvent = e; ma.music.setEvent(e); } }
          if (deps.weather && ma.music?.setWeather) { const w = deps.weather(); if (w !== lastWeather) { lastWeather = w; ma.music.setWeather(w); } }
          if (deps.season && ma.ambience?.setSeason) ma.ambience.setSeason(deps.season());
          if (deps.grill && ma.ambience?.setGrill) ma.ambience.setGrill(deps.grill());
        } catch { /* optional */ }
      }
      const p = deps.playerPos?.(); if (p) audio.ambience.setListener({ x: p.x, z: p.z });
      const z = deps.zone?.(); if (z && z !== lastZone) { lastZone = z; audio.music.setZone(z); }
      const ph = deps.phase?.(); if (ph && ph !== lastPhase) { lastPhase = ph; audio.music.setPhase(ph); }
    },
    dispose() { offs.forEach(o => { try { o(); } catch { /* */ } }); offs.length = 0; },
  };
}
