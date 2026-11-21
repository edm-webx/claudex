/** Save glue: validation / normalisation of GameState and `createGameSave` over the engine SaveStore. Owner: Builder A. Pure (wall clock only via platform.clock). */
import type { Platform, SaveStore, Logger } from '../../engine/api';
import { createSave } from '../../engine/save';
import { defaultState, defaultSettings, newToday, SAVE_KEY, SAVE_VERSION, type GameState } from './schema';
import type { SimFull } from '../headless';
import { normalizeZones } from './zones-norm';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fill missing fields from defaults and clamp (v2 normalizeSave). Mutates and returns `d`; notes list the repairs. */
export function normalizeState(d: GameState, notes: string[] = []): string[] {
  const def = defaultState(d.seed || 1);
  const rec = d as unknown as Record<string, unknown>, dr = def as unknown as Record<string, unknown>;
  for (const k of Object.keys(dr)) if (rec[k] === undefined || rec[k] === null && dr[k] !== null) { rec[k] = dr[k]; notes.push('fill ' + k); }
  for (const k of ['xp', 'totalEarned'] as const) { const r = d as unknown as Record<string, unknown>; if (typeof r[k] !== 'number' || !Number.isFinite(r[k] as number)) { r[k] = Math.max(0, Number(r[k]) || 0); notes.push('num ' + k); } }
  d.tiers = { ...def.tiers, ...(isObj(d.tiers) ? d.tiers : {}) };
  d.grades = { ...def.grades, ...(isObj(d.grades) ? d.grades : {}) };
  d.settings = { ...defaultSettings(), ...(isObj(d.settings) ? d.settings : {}) };
  for (const k of ['owned', 'padPaid', 'stats', 'ach', 'regulars', 'tut', 'zones'] as const) if (!isObj(d[k])) { (d as unknown as Record<string, unknown>)[k] = {}; notes.push('obj ' + k); }
  for (const k of ['workers', 'renewed', 'cats', 'decorOwned', 'decorSlots', 'citizens'] as const) if (!Array.isArray(d[k])) { (d as unknown as Record<string, unknown>)[k] = []; notes.push('arr ' + k); }
  normalizeZones(d.zones, notes);
  if (!isObj(d.week)) d.week = { earned: 0, customers: 0 };
  if (!isObj(d.player)) d.player = def.player;
  if (!d.today) d.today = newToday();
  d.money = Math.max(0, Number(d.money) || 0); d.gold = Math.max(0, Math.floor(Number(d.gold) || 0));
  d.stars = Math.max(0, Math.floor(Number(d.stars) || 0)); d.stage = Math.min(10, Math.max(1, Math.floor(Number(d.stage) || 1)));
  d.level = Math.max(1, Math.floor(Number(d.level) || 1)); d.day = Math.max(1, Math.floor(Number(d.day) || 1));
  d.playT = Math.max(0, Number(d.playT) || 0); d.dayT = Math.max(0, Number(d.dayT) || 0);
  if (d.rngState !== undefined) {   // bozuk RNG durumu oyunu bozmasın: geçersizse at, akışlar tohumdan başlar
    const ok = isObj(d.rngState) && Object.values(d.rngState).every(v => Array.isArray(v) && v.length === 4 && v.every(x => Number.isFinite(x)));
    if (!ok) { delete d.rngState; notes.push('rngState'); }
  }
  d.version = SAVE_VERSION;
  return notes;
}

/** RNG akışlarının durumunu kayda yaz: yükleme sonrası sandık/hava/müşteri dizisi tohumdan baştan başlamasın. */
function snapshotRng(sim: SimFull): void {
  if (!sim.rng) return;
  const m: Record<string, [number, number, number, number]> = {};
  for (const n of sim.rng.names()) m[n] = sim.rng.stream(n).getState();
  sim.state.rngState = m;
}

/** v1 -> v2: ölü zones.zincir ve Plot.stok silinir (stok/zincir kırmızı çizgi); gerisini normalizeState onarır. Premigration yedeği engine/save'de. */
export const MIGRATIONS = [{
  from: 1, to: 2,
  up(old: Record<string, unknown>): Record<string, unknown> {
    const z = isObj(old.zones) ? old.zones : (old.zones = {}) as Record<string, unknown>;
    delete z.zincir;
    const pl = isObj(z.arsa) && isObj(z.arsa.plots) ? z.arsa.plots : null;
    if (pl) for (const id of Object.keys(pl)) { const p = pl[id]; if (isObj(p)) delete p.stok; }
    return old;
  },
}];

export function createGameSave(sim: SimFull, platform: Pick<Platform, 'storage' | 'idb' | 'clock'>, o: { key?: string; log?: Logger } = {}): SaveStore<GameState> {
  return createSave<GameState>({
    key: o.key || SAVE_KEY, version: SAVE_VERSION, defaults: () => defaultState(sim.state.seed || 1), migrations: MIGRATIONS,
    validate: d => normalizeState(d),
    get: () => { sim.rules?.snapshot(platform.clock.wall()); snapshotRng(sim); return sim.state; },
    platform, log: o.log,
  });
}
