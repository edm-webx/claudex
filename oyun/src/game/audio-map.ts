// Audio map (Builder D, M1): subscribes to the sim bus and plays the v2 sounds via engine audio. View side only;
// it never writes sim state. Sounds far from the player are panned/attenuated by audio.sfx `at` when the event
// carries a position. Music/ambience follow zone and day phase (engine/audio does the crossfade).
import type { Audio, Bus, DayPhase } from '../engine/api';
import { EVENT_SFX, EVENT_VOICE } from '../content/sfx';
import type { MotorAudio } from '../engine/audio';
import { SES_ARALIK_MS } from '../engine/audio/mutfak-ses';

export interface AudioMapDeps {
  bus: Bus<any>;
  audio: Audio;
  /** Current player position (listener). */
  playerPos?: () => { x: number; z: number };
  zone?: () => string;
  /** İç mekân id (ic-mekan icinde()) ya da null: iç mekânda dış deniz/martı kesilir, yalnız iç atmosfer çalar. */
  interior?: () => string | null;
  phase?: () => DayPhase;
  /** ses-1: crowd size 0..1 (music layers). */
  crowd?: () => number;
  /** Active calendar event id (event music) and weather kind (muffle / wobble). */
  event?: () => string | null;
  weather?: () => string;
  /** survey 2026-10-24: season for the ambience calls (ilkbahar / yaz / sonbahar / kis). */
  season?: () => string;
  /** Grill (döner) world position: büfe döneri, yalnız oyuncu 'station.doner' ürettiği sırada cızırtı verir (BUF-08). */
  grill?: () => { x: number; z: number } | null;
  /** Tadilat / yapım süren şantiye konumları (ustalar çalışıyor): yakındayken matkap, çekiç, mala, zincir, el arabası ve geri bip seyrek çalar. */
  santiye?: () => { x: number; z: number }[];
  /** BUF-08: aktif pişiren mutfak istasyonları (sim view().ist'ten boot kurar); kimse pişirmiyorsa boş liste. */
  kitchen?: () => { x: number; z: number; w: number }[];
  /** DOM root that carries 'sb:radio' (İskele Radyosu line changed) events. */
  root?: HTMLElement | null;
}
export interface AudioMap { update(): void; dispose(): void; }

/** Sounds that lower the music (and for loud match sounds the ambience): [seconds, depth, ambience]. */
const DUCK: Record<string, [number, number, boolean]> = { confetti: [1.8, 0.4, false], whistle: [1.2, 0.5, true], whistleLong: [1.6, 0.5, true], crowdCheer: [2, 0.5, true], day: [1.8, 0.4, false], bell: [1, 0.5, false] };

export function createAudioMap(deps: AudioMapDeps): AudioMap {
  const { bus, audio } = deps;
  const ma = audio as Partial<MotorAudio>;
  const offs: Array<() => void> = [];
  let lastTransferSfx = -1e9, lastPickSfx = -1e9, lastDonerT = -1e9;
  const lastHiz: Record<string, number> = {};
  const clockNow = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  // BUF-08: oyuncunun döner üretimi (station.doner transferleri ~0.18 sn'de bir) cızırtı için yeterli kanıt
  offs.push(bus.on('transfer', (d: any) => { if (d && d.id === 'station.doner') lastDonerT = clockNow(); }) as () => void);
  for (const name of Object.keys(EVENT_SFX)) {
    const rule = EVENT_SFX[name];
    if (rule == null) continue;
    offs.push(bus.on(name, (d: any) => {
      const id = typeof rule === 'function' ? rule(d) : rule;
      if (!id) return;
      // the sim transfers every 0.08-0.1 s; one pop per ~0.16 s reads as a soft roll instead of a rattle
      if (name === 'transfer') { const now = clockNow(); if (now - lastTransferSfx < 160) return; lastTransferSfx = now; }
      else if (name === 'pick') { const now = clockNow(); if (now - lastPickSfx < 160) return; lastPickSfx = now; }   // ayrı kapı: tezgâha bırakma 'pick'i yutmasın
      // BUF-08: tava çarpması ve bulaşık şıngırtısı için en kısa aralık (SES_ARALIK_MS)
      if (name in SES_ARALIK_MS) { const now = clockNow(); if (now - (lastHiz[name] ?? -1e9) < SES_ARALIK_MS[name as keyof typeof SES_ARALIK_MS]) return; lastHiz[name] = now; }
      const at = d && typeof d.x === 'number' && typeof d.z === 'number' ? { x: d.x, z: d.z } : undefined;
      try { audio.sfx(id, at ? { at } : undefined); } catch { /* audio is optional */ }
      const dk = DUCK[id]; if (dk) { try { ma.duck?.(dk[0], dk[1], dk[2]); } catch { /* optional */ } }
    }) as () => void);
  }
  // ses-3: few voiced lines, only for regulars' hellos and big moments (engine rate limit: one per 10 s)
  for (const name of Object.keys(EVENT_VOICE)) {
    offs.push(bus.on(name, () => { try { audio.voice(EVENT_VOICE[name]); } catch { /* */ } }) as () => void);
  }
  // SNT-14: müzisyen çalıyor (sim her ~12 sn bildirir): konumlu canlı müzik kaynağı, sessizlik 14 sn sonra
  offs.push(bus.on('canliMuzik', (d: any) => { if (d && typeof d.x === 'number' && typeof d.z === 'number') try { ma.canliMuzik?.({ x: d.x, z: d.z }); } catch { /* */ } }) as () => void);
  // şimşek çaktığında (hava görünümü 'sb:simsek' yayar) gök gürültüsü gecikmeli gelir
  const onSimsek = () => { try { ma.simsek?.(); } catch { /* */ } };
  try { globalThis.addEventListener?.('sb:simsek', onSimsek); offs.push(() => globalThis.removeEventListener?.('sb:simsek', onSimsek)); } catch { /* */ }
  const onRadio = () => { try { ma.jingle?.(); setTimeout(() => { try { audio.voice('radyo'); } catch { /* */ } }, 900); } catch { /* */ } };
  if (deps.root) { deps.root.addEventListener('sb:radio', onRadio); offs.push(() => deps.root?.removeEventListener('sb:radio', onRadio)); }
  let lastInterior: string | null | undefined;
  // adim sesleri: katedilen yola gore (her ~1.15 birimde bir), zemin bolgeden: iskele=ahsap, orman=toprak, ic mekan=fayans, digeri=beton
  let stepX = NaN, stepZ = NaN, stepD = 0, stepFoot = 0;
  const surfaceOf = (z: string) => z.startsWith('ic.') ? 'adim_fayans' : z === 'orman' ? 'adim_toprak' : z === 'iskele' || z === 'ev' ? 'adim_ahsap' : 'adim_beton';
  const footsteps = (p: { x: number; z: number }) => {
    if (Number.isFinite(stepX)) {
      const d = Math.hypot(p.x - stepX, p.z - stepZ);
      if (d < 3) { stepD += d; if (stepD >= 1.15) { stepD = 0; stepFoot ^= 1; const zz = deps.zone?.() ?? 'iskele'; try { audio.sfx(surfaceOf(zz), { vol: stepFoot ? 0.85 : 1 }); } catch { /* optional */ } } }
      else stepD = 0;   // isinlanma (otobus, kapi): sayac sifirlanir
    }
    stepX = p.x; stepZ = p.z;
  };
  // şantiye sesleri: her şantiye için rastgele aralıkla (1.4-4 sn) bir alet sesi; konumlu, yalnız oyuncu yakınken (sfx 40 m'den uzağı zaten kurmaz)
  const SANTIYE_SES = ['matkap', 'cekic', 'mala', 'cekic', 'zincir', 'el_arabasi', 'mala', 'geri_bip'];
  const santiyeNext = new Map<string, number>();
  const santiyeTick = (p: { x: number; z: number }) => {
    const list = deps.santiye?.(); if (!list || !list.length) return;
    const now = clockNow();
    for (const s of list) {
      if (Math.hypot(s.x - p.x, s.z - p.z) > 36) continue;
      const k = s.x.toFixed(1) + ',' + s.z.toFixed(1), at = santiyeNext.get(k);
      if (at === undefined) { santiyeNext.set(k, now + 600 + Math.random() * 1800); continue; }
      if (now < at) continue;
      santiyeNext.set(k, now + 1400 + Math.random() * 2600);
      const id = SANTIYE_SES[Math.floor(Math.random() * SANTIYE_SES.length)];
      try { audio.sfx(id, { at: { x: s.x + (Math.random() - 0.5) * 3, z: s.z + (Math.random() - 0.5) * 3 } }); } catch { /* optional */ }
    }
  };
  const ZONE_HOLD_MS = 2500, WX_HOLD_MS = 20000;   // bölge 2.5 sn sabit kalmadan müzik değişmez (sınırda titreşme yok)
  let zonePending = '', zoneSince = 0, wxPending = '', wxSince = 0;
  let lastZone = '', lastPhase = '', lastEvent: string | null | undefined, lastWeather = '', crowdS = 0.5, slowT = 0;
  return {
    update() {
      slowT -= 1;
      if (slowT <= 0) {
        slowT = 15;
        try {
          if (deps.crowd) { crowdS += (deps.crowd() - crowdS) * 0.25; audio.music.setIntensity(crowdS); }
          if (deps.event && ma.music?.setEvent) { const e = deps.event(); if (e !== lastEvent) { lastEvent = e; ma.music.setEvent(e); } }
          if (deps.weather && ma.music?.setWeather) {   // histerezis: hava yeni değerde 20 sn kalmadan müzik/ambiyans değişmez (sağanak↔açık gidip gelmesi parçayı değiştirmesin)
            const w = deps.weather(), now = clockNow();
            if (w === lastWeather) wxPending = '';
            else if (!lastWeather) { lastWeather = w; ma.music.setWeather(w); }
            else if (w !== wxPending) { wxPending = w; wxSince = now; }
            else if (now - wxSince >= WX_HOLD_MS) { lastWeather = w; wxPending = ''; ma.music.setWeather(w); }
          }
          if (deps.season && ma.ambience?.setSeason) ma.ambience.setSeason(deps.season());
          // BUF-08: cızırtı yalnız aktif ısı kaynaklarından (mutfak pişirenler + büfe dönerini üreten oyuncu)
          if (ma.ambience?.setHeat) { const hs = [...(deps.kitchen?.() ?? [])]; const g = deps.grill?.(); if (g && clockNow() - lastDonerT < 600) hs.push({ x: g.x, z: g.z, w: 1 }); ma.ambience.setHeat(hs); }
        } catch { /* optional */ }
      }
      const p = deps.playerPos?.(); if (p) { audio.ambience.setListener({ x: p.x, z: p.z }); footsteps(p); if (slowT === 14 || slowT === 7) { try { santiyeTick(p); } catch { /* optional */ } } }
      const z = deps.zone?.();
      if (z && z !== lastZone) {
        const now = clockNow();
        if (!lastZone) { lastZone = z; audio.music.setZone(z); }
        else if (z !== zonePending) { zonePending = z; zoneSince = now; }
        else if (now - zoneSince >= ZONE_HOLD_MS) { lastZone = z; zonePending = ''; audio.music.setZone(z); }
      } else zonePending = '';
      if (deps.interior && ma.atmosphere) { const i = deps.interior() ?? null; if (i !== lastInterior) { if (lastInterior !== undefined) { try { audio.sfx(i ? 'kapi_ac' : 'kapi_kapa'); } catch { /* optional */ } } lastInterior = i; ma.atmosphere.setInterior(i); } }
      const ph = deps.phase?.(); if (ph && ph !== lastPhase) { lastPhase = ph; audio.music.setPhase(ph); }
    },
    dispose() { offs.forEach(o => { try { o(); } catch { /* */ } }); offs.length = 0; },
  };
}
