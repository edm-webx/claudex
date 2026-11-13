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
 */
import type { Quality, QualityDeps, QualitySetting, TierDef, TierName, Disposer } from '../api';

const ORDER: TierName[] = ['akici', 'dengeli', 'sahane'];
export const TIER_TABLE: Readonly<Record<TierName, TierDef>> = Object.freeze({
  akici: { name: 'akici', label: 'Akıcı', crowd: 25, gullsNear: 4, gullsFar: 12, pigeons: 8, pixelRatio: 0.85, antialias: false, shadows: false, shadowSize: 0, fps: 30, particles: 120, buildBudgetMs: 3, maxLiveZones: 2, heroes: 12, flags: {} },
  dengeli: { name: 'dengeli', label: 'Dengeli', crowd: 50, gullsNear: 8, gullsFar: 24, pigeons: 16, pixelRatio: 1.25, antialias: true, shadows: true, shadowSize: 1024, fps: 60, particles: 400, buildBudgetMs: 4, maxLiveZones: 3, heroes: 16, flags: { bloom: true } },
  sahane: { name: 'sahane', label: 'Şahane', crowd: 90, gullsNear: 16, gullsFar: 40, pigeons: 30, pixelRatio: 2.0, antialias: true, shadows: true, shadowSize: 2048, fps: 60, particles: 1000, buildBudgetMs: 6, maxLiveZones: 4, heroes: 16, flags: { softShadows: true, bloom: true } },
} satisfies Record<TierName, TierDef>);

export function guessTier(memoryGB: number, cores: number): TierName {
  if (memoryGB <= 3 || cores <= 4) return 'akici';
  if (memoryGB <= 4) return 'dengeli';
  return 'sahane';
}

const KEY = 'marti-quality';
type Why = 'auto' | 'manual' | 'probe' | 'url';

export function createQuality(deps: QualityDeps): Quality {
  const p = deps.platform;
  let saved: { setting?: QualitySetting; autoTier?: TierName | null } = {};
  try { saved = JSON.parse(p.storage.get(KEY) || '{}') || {}; } catch { saved = {}; }
  let setting: QualitySetting = saved.setting && (saved.setting === 'auto' || ORDER.includes(saved.setting)) ? saved.setting : 'auto';
  let downThisSession = false;
  let autoTier: TierName | null = saved.autoTier && ORDER.includes(saved.autoTier) ? saved.autoTier : null;
  const guess = () => guessTier(p.device.memoryGB, p.device.cores);
  let cur: TierName = p.params.tier ?? (setting !== 'auto' ? setting : autoTier ?? guess());
  const subs = new Set<(t: TierDef, why: Why) => void>();
  let battery = false;

  // watch state
  const buckets: number[] = []; // avg ms per completed 1 s bucket
  let bSum = 0, bN = 0, bT = 0, t = 0, lastChange = -1e9, calm = 0;

  const persist = () => { p.storage.set(KEY, JSON.stringify({ setting, autoTier })); };
  const apply = (n: TierName, why: Why) => {
    if (n === cur) return;
    cur = n;
    buckets.length = 0; bSum = 0; bN = 0; bT = 0; calm = 0;
    for (const cb of [...subs]) { try { cb(TIER_TABLE[cur], why); } catch (e) { deps.log?.error('quality cb', e); } }
  };

  return {
    table: TIER_TABLE,
    current: () => TIER_TABLE[cur],
    setting: () => setting,
    set(s) {
      setting = s;
      persist();
      apply(s === 'auto' ? autoTier ?? guess() : s, 'manual');
    },
    onChange(cb): Disposer { subs.add(cb); return () => { subs.delete(cb); }; },
    feed(frameMs, dt) {
      t += dt;
      if (setting !== 'auto' || p.params.tier) return;
      bSum += frameMs; bN++; bT += dt;
      if (bT < 1) return;
      const avg1 = bSum / bN; bSum = 0; bN = 0; bT = 0;
      buckets.push(avg1); if (buckets.length > 10) buckets.shift();
      const fps = battery ? 30 : TIER_TABLE[cur].fps;
      const target = 1000 / fps;
      if (avg1 < target * 0.8) calm += 1; else calm = 0;
      if (t - lastChange < 60) return;
      if (buckets.length >= 10) {
        const avg = buckets.reduce((a, b) => a + b, 0) / buckets.length;
        const i = ORDER.indexOf(cur);
        if (avg > target * 1.5 && i > 0) { lastChange = t; downThisSession = true; autoTier = ORDER[i - 1]; persist(); apply(autoTier, 'auto'); return; }
      }
      // 2026-11-09 Chrome freeze: auto mode used to step back up after 120 calm seconds; a tier change toggles shadows,
      // which recompiles every material (multi-second freeze), then the heavier tier missed its target and stepped down
      // again: a freeze loop. Auto mode now only steps down within a session (the user can still pick a tier by hand).
      if (calm >= 120 && cur !== 'sahane' && !downThisSession) { lastChange = t; autoTier = ORDER[ORDER.indexOf(cur) + 1]; persist(); apply(autoTier, 'auto'); }
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
