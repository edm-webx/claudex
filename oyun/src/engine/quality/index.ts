/**
 * engine/quality: tier table (v2 C.TIERS + GDD budgets), first guess, auto-watch, manual setting.
 * Owner: Builder A.
 * Decisions:
 * - Persisted in platform.storage key 'marti-quality' as {setting, autoTier}; boot mirrors it into GameState.settings.
 * - Priority at start: ?tier= (why 'url', not persisted) > manual setting > saved autoTier > guess (v2 guessTier).
 * - No boot probe in M0 (guess + runtime watch only); 'probe' stays reserved in the onChange why union.
 * - Auto-watch: 1 s buckets, 10 s rolling average of frame time. avg > 1.5x target -> drop one tier;
 *   avg < 0.8x target for 120 s -> rise one tier; at most one change per 60 s (first drop may happen after 10 s).
 *   Target = 1000 / effective fps (battery saver forces 30). Only active when setting is 'auto'.
 * PRF-12 dynamic resolution (auto mode, no ?tier=): a fast layer scales the pixel ratio SCALE_MIN..1 in 0.05 steps, no shader relink.
 *   1 s buckets: bucket frame time > 1.1x target -> one step down (at most every 2 s); work time < 0.7x target for 3 s in a row
 *   and no step down in the last 6 s -> one step up. The slow layer (tier drop) only starts once the scale sits at SCALE_MIN;
 *   a tier change resets the scale to 1.
 *   Second fast rung (B-082 "bloom kapanır"): on a bloom tier, once the scale sits at SCALE_MIN and a bucket is still slow, the
 *   bloom pass is cut (postCut, pass.enabled = false: no relink, no target rebuild); recovery restores bloom first, then the
 *   scale (reverse order, same 3 s calm / 6 s since the last step down). The tier drop waits until both rungs are used.
 * PRF-03: with deferAuto(inPlay) set (boot), an automatic tier change during play is saved (next load starts there) but applied
 *   only at flushAuto() - hidden tab or a full-screen overlay covering the world - because it relinks every material.
 */
import type { Quality, QualityDeps, QualitySetting, TierDef, TierName, Disposer } from '../api';

export const SCALE_MIN = 0.7, SCALE_STEP = 0.05;
const ORDER: TierName[] = ['akici', 'dengeli', 'sahane'];
export const TIER_TABLE: Readonly<Record<TierName, TierDef>> = Object.freeze({
  akici: { name: 'akici', label: 'Akıcı', crowd: 25, gullsNear: 4, gullsFar: 12, pigeons: 8, pixelRatio: 0.85, antialias: false, shadows: false, shadowSize: 0, fps: 30, particles: 120, buildBudgetMs: 3, maxLiveZones: 2, flags: {} },
  dengeli: { name: 'dengeli', label: 'Dengeli', crowd: 50, gullsNear: 8, gullsFar: 24, pigeons: 16, pixelRatio: 1.25, pixelRatioMin: 1.0, antialias: true, shadows: true, shadowSize: 1024, fps: 60, particles: 400, buildBudgetMs: 4, maxLiveZones: 3, flags: { bloom: true, reflect: true } },
  sahane: { name: 'sahane', label: 'Şahane', crowd: 90, gullsNear: 16, gullsFar: 40, pigeons: 30, pixelRatio: 2.0, pixelRatioMin: 1.5, antialias: true, shadows: true, shadowSize: 2048, fps: 60, particles: 1000, buildBudgetMs: 6, maxLiveZones: 4, flags: { bloom: true, reflect: true, reflectHi: true } },
} satisfies Record<TierName, TierDef>);

/** GRS-17: render pixel ratio of a tier on a screen: the tier floor lifts DPR 1 screens (1080p PC: akıcı 0.85, dengeli 1.0, şahane 1.5),
 *  the tier ceiling caps phones (DPR 3: 0.85 / 1.25 / 2.0). Labels are HTML, so text size does not change. */
export function renderScale(t: TierDef, dpr: number): number { return Math.min(Math.max(dpr || 1, t.pixelRatioMin ?? 0), t.pixelRatio); }

/** GRS-17: every TIER_TABLE flag has a consumer, written here (a flag missing from this list fails quality.test). */
export const TIER_FLAG_DOC: Readonly<Record<string, { konum: string; canli: 'uniform' | 'gorunurluk' | 'rt-yeniden-boyut'; paket: string }>> = Object.freeze({
  bloom: { konum: 'src/engine/render/index.ts setupPost/setPostCut (bloom pass)', canli: 'gorunurluk', paket: 'B-082' },
  reflect: { konum: 'src/engine/render/reflect.ts reflectBudget (su yansıması RT) + game/view/world/glb.ts setGlbEnvK (boot applyTier)', canli: 'rt-yeniden-boyut', paket: 'GRS-05/GRS-17' },
  reflectHi: { konum: 'src/engine/render/reflect.ts reflectBudget (yarım çözünürlük, her kare)', canli: 'rt-yeniden-boyut', paket: 'GRS-05' },
});

/** 2026-11-23 laptop kasması: GPU class from the WebGL renderer name. 'yazilim' = CPU raster (SwiftShader, llvmpipe, Microsoft Basic
 *  Render), 'zayif' = plain Intel HD/UHD iGPU, 'entegre' = stronger shared-memory GPUs (Iris, AMD APU Radeon Graphics/Vega, Apple),
 *  'harici' = NVIDIA / Radeon RX-Pro / Intel Arc, '' = unknown (old memory + cores rule). */
export type GpuSinif = 'yazilim' | 'zayif' | 'entegre' | 'harici' | '';
export function gpuSinif(name: string | undefined): GpuSinif {
  const n = String(name || '').toLowerCase();
  if (!n) return '';
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(n)) return 'yazilim';
  if (/nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx|pro)|\bintel\(r\)? arc|\barc\s*a\d/.test(n)) return 'harici';
  if (/iris|radeon\(tm\) graphics|radeon graphics|vega|apple/.test(n)) return 'entegre';
  if (/intel|uhd|hd graphics|mesa/.test(n)) return 'zayif';
  return '';
}

export function guessTier(memoryGB: number, cores: number, mobile = false, gpu = ''): TierName {
  // PRF-13: on a phone the first guess is never 'sahane' (iOS Safari reports no deviceMemory, the fallback would read as a big PC);
  // 'dengeli' only with 6+ GB and 8+ cores. The auto-watch can still raise it later. Desktop guess unchanged.
  if (mobile) return memoryGB >= 6 && cores >= 8 ? 'dengeli' : 'akici';
  const g = gpuSinif(gpu);
  if (g === 'yazilim' || g === 'zayif') return 'akici';
  if (memoryGB <= 3 || cores <= 4) return 'akici';
  if (memoryGB <= 4 || g === 'entegre') return 'dengeli';
  return 'sahane';
}

/** First seconds of play (auto mode): a slow start drops the tier at once, not at the next menu. PROBE_SKIP s are ignored (shader
 *  warm-up, zone streaming), then every 1 s bucket is checked; the median of the last 3 above PROBE_SLOW x target drops one tier.
 *  Each drop restarts the window so the next tier gets its own 3 s look; the probe never raises a tier. */
export const PROBE_SKIP = 3, PROBE_END = 20, PROBE_SLOW = 1.5;

const KEY = 'marti-quality';
type Why = 'auto' | 'manual' | 'probe' | 'url';

export function createQuality(deps: QualityDeps): Quality {
  const p = deps.platform;
  let saved: { setting?: QualitySetting; autoTier?: TierName | null } = {};
  try { saved = JSON.parse(p.storage.get(KEY) || '{}') || {}; } catch { saved = {}; }
  let setting: QualitySetting = saved.setting && (saved.setting === 'auto' || ORDER.includes(saved.setting)) ? saved.setting : 'auto';
  let downThisSession = false;
  let autoTier: TierName | null = saved.autoTier && ORDER.includes(saved.autoTier) ? saved.autoTier : null;
  const guess = () => guessTier(p.device.memoryGB, p.device.cores, p.device.mobile, p.device.gpu);
  const kisaGpu = (n: string) => n.replace(/^ANGLE \(([^,]*,\s*)?/, '').replace(/\s*(Direct3D|vs_|\(0x|OpenGL|,).*$/, '').replace(/\((R|TM)\)/gi, '').trim().slice(0, 40);
  let neden = p.params.tier ? 'adres satırı' : setting !== 'auto' ? '' : autoTier ? 'önceki oyundaki ölçüm' : (p.device.gpu ? 'ekran kartı: ' + kisaGpu(p.device.gpu) : 'cihaz belleği ve işlemci');
  let cur: TierName = p.params.tier ?? (setting !== 'auto' ? setting : autoTier ?? guess());
  const subs = new Set<(t: TierDef, why: Why) => void>();
  const scaleSubs = new Set<(s: number) => void>();
  let scale = 1, scaleHold = 0, scaleCalm = 0, scaleLastDown = -1e9, scaleLastStep = -1e9;
  const postSubs = new Set<(cut: boolean) => void>();
  let postCut = false;
  const setPostCut = (v: boolean) => {
    if (v === postCut) return;
    postCut = v;
    for (const cb of [...postSubs]) { try { cb(postCut); } catch (e) { deps.log?.error('quality post cb', e); } }
  };
  const setScale = (v: number) => {
    v = Math.round(Math.max(SCALE_MIN, Math.min(1, v)) * 100) / 100;
    if (v === scale) return;
    scale = v;
    for (const cb of [...scaleSubs]) { try { cb(scale); } catch (e) { deps.log?.error('quality scale cb', e); } }
  };
  let battery = false;
  // PRF-03: an auto tier change relinks every material (shadows + night-light pool). During play it waits for a pause/menu moment.
  let inPlay: (() => boolean) | null = null, pendingAuto: TierName | null = null;
  const autoApply = (n: TierName) => {
    let playing = false; try { playing = !!inPlay?.(); } catch { playing = false; }
    if (playing) { pendingAuto = n === cur ? null : n; return; }
    pendingAuto = null; apply(n, 'auto');
  };

  // watch state
  const buckets: number[] = []; // avg ms per completed 1 s bucket
  let bSum = 0, bN = 0, bT = 0, t = 0, lastChange = -1e9, calm = 0;
  let probeT = 0, probeEnd = deps.probe === false ? -1 : PROBE_END; const probeBuf: number[] = [];

  const persist = () => { p.storage.set(KEY, JSON.stringify({ setting, autoTier })); };
  const apply = (n: TierName, why: Why) => {
    if (n === cur) return;
    cur = n;
    buckets.length = 0; bSum = 0; bN = 0; bT = 0; calm = 0; scaleCalm = 0;
    setScale(1); setPostCut(false);
    for (const cb of [...subs]) { try { cb(TIER_TABLE[cur], why); } catch (e) { deps.log?.error('quality cb', e); } }
  };

  return {
    table: TIER_TABLE,
    current: () => TIER_TABLE[cur],
    setting: () => setting,
    set(s) {
      setting = s;
      persist();
      neden = s === 'auto' ? (autoTier ? 'önceki oyundaki ölçüm' : neden) : '';
      apply(s === 'auto' ? autoTier ?? guess() : s, 'manual');
    },
    neden: () => neden,
    onChange(cb): Disposer { subs.add(cb); return () => { subs.delete(cb); }; },
    scale: () => scale,
    onScale(cb): Disposer { scaleSubs.add(cb); return () => { scaleSubs.delete(cb); }; },
    postCut: () => postCut,
    onPostCut(cb): Disposer { postSubs.add(cb); return () => { postSubs.delete(cb); }; },
    feed(frameMs, dt, workMs) {
      t += dt;
      if (setting !== 'auto' || p.params.tier) { if (scale !== 1) setScale(1); setPostCut(false); return; }
      bSum += frameMs; bN++; bT += dt; scaleHold += workMs ?? frameMs;
      if (bT < 1) return;
      const avg1 = bSum / bN, work1 = scaleHold / bN; bSum = 0; bN = 0; bT = 0; scaleHold = 0;
      buckets.push(avg1); if (buckets.length > 10) buckets.shift();
      const fps = battery ? 30 : TIER_TABLE[cur].fps;
      const target = 1000 / fps;
      // açılış sınaması (probe): applied at once, the player has only just started
      probeT += 1;
      if (probeT <= probeEnd) {
        if (probeT <= PROBE_SKIP) return;
        probeBuf.push(avg1); if (probeBuf.length > 3) probeBuf.shift();
        const i = ORDER.indexOf(cur);
        if (probeBuf.length === 3 && i > 0) {
          const med = [...probeBuf].sort((a, b) => a - b)[1];
          if (med > target * PROBE_SLOW) {
            probeBuf.length = 0; probeEnd = probeT + PROBE_SKIP + 4; lastChange = t; downThisSession = true;
            neden = 'açılış ölçümü: ' + Math.round(1000 / med) + ' FPS';
            autoTier = ORDER[i - 1]; persist(); pendingAuto = null; apply(autoTier, 'probe'); return;
          }
        }
        return;   // the fast layer waits for the probe: a tier drop helps more than a smaller picture
      }
      if (avg1 < target * 0.8) calm += 1; else calm = 0;
      // fast layer: resolution scale, then the bloom cut
      const canCut = !!TIER_TABLE[cur].flags.bloom;
      const atFloor = scale <= SCALE_MIN + 1e-6;
      if (avg1 > target * 1.1 && (!atFloor || (canCut && !postCut))) {
        if (t - scaleLastStep >= 2) { scaleLastStep = scaleLastDown = t; if (!atFloor) setScale(scale - SCALE_STEP); else setPostCut(true); }
        scaleCalm = 0;
      } else if (work1 < target * 0.7 && avg1 <= target * 1.1) {
        if (++scaleCalm >= 3 && (postCut || scale < 1) && t - scaleLastDown >= 6) { scaleCalm = 0; scaleLastStep = t; if (postCut) setPostCut(false); else setScale(scale + SCALE_STEP); }
      } else scaleCalm = 0;
      if (t - lastChange < 60) return;
      if (buckets.length >= 10) {
        const avg = buckets.reduce((a, b) => a + b, 0) / buckets.length;
        const i = ORDER.indexOf(cur);
        if (avg > target * 1.5 && i > 0 && atFloor && (postCut || !canCut)) {   // slow layer waits until both fast rungs are used
          lastChange = t; downThisSession = true; autoTier = ORDER[i - 1]; persist(); neden = 'oyun içi ölçüm: ' + Math.round(1000 / avg) + ' FPS';
          // 2026-11-23: under 30 fps on a 60 tier waiting for a menu means minutes of stutter; with the shared post chain (GRS-17)
          // a tier change relinks nothing, so it is applied at once. Milder cases still wait (PRF-03).
          if (avg > target * 2) { pendingAuto = null; apply(autoTier, 'auto'); } else autoApply(autoTier);
          return; }
      }
      // 2026-11-09 Chrome freeze: auto mode used to step back up after 120 calm seconds; a tier change toggles shadows,
      // which recompiles every material (multi-second freeze), then the heavier tier missed its target and stepped down
      // again: a freeze loop. Auto mode now only steps down within a session (the user can still pick a tier by hand).
      if (calm >= 120 && cur !== 'sahane' && !downThisSession && !pendingAuto) { lastChange = t; autoTier = ORDER[ORDER.indexOf(cur) + 1]; persist(); autoApply(autoTier); }
    },
    deferAuto(fn) { inPlay = fn; },
    flushAuto() {
      if (!pendingAuto || setting !== 'auto') { pendingAuto = null; return false; }
      const n = pendingAuto; pendingAuto = null; if (n === cur) return false;
      apply(n, 'auto'); return true;
    },
    batterySaver(on) {
      if (battery === on) return;
      battery = on;
      for (const cb of [...subs]) { try { cb(TIER_TABLE[cur], 'manual'); } catch { /* ignore */ } }
    },
  };
}

/** Effective fps for the loop (battery saver forces 30). */
export function effectiveFps(q: Quality, batterySaver: boolean): 60 | 30 { return batterySaver ? 30 : q.current().fps; }
