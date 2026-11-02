/** Worker speed and trait helpers (v2 traitFx / workerSpeed / pickTrait). Pure. */
import type { WorkerSave, GameState } from '../schema';
import { TRAITS, type TraitFx, type TraitDef } from '../../../content/traits';
import { RARITY, RANKS, rankOf, moraleFactor, MORALE_START } from '../../../content/ranks';

/** Worker save entries come from v2 (`trait`) or the new schema (`traits[]`); both are read. */
export function traitId(w: Pick<WorkerSave, 'traits'> & { trait?: unknown }): string {
  const t = (w as { trait?: unknown }).trait;
  if (typeof t === 'string' && t) return t;
  return (w.traits && w.traits[0]) || 'hamarat';
}
export function traitDef(w: Pick<WorkerSave, 'traits'> & { trait?: unknown }): TraitDef { return TRAITS[traitId(w)] || TRAITS.hamarat; }
export function traitFx(w: Pick<WorkerSave, 'traits'> & { trait?: unknown }): TraitFx { return traitDef(w).fx; }
export const moraleOf = (w: WorkerSave): number => (w.morale == null ? MORALE_START : w.morale);

export interface SpeedCtx { hour: number; station: string | null; teamWin: boolean; teamDay: number; day: number; boostT: number; boostX: number }
/** v2 workerSpeed: rarity x rank x morale x (1 + trait terms), then the wake-up boost. Never below 0.4 of base. */
export function workerSpeed(w: WorkerSave, c: SpeedCtx): number {
  const fx = traitFx(w), rar = RARITY[w.rarity || 'gri'] || RARITY.gri;
  let s = rar.x * RANKS[rankOf(w.xp || 0)].x * moraleFactor(moraleOf(w));
  let k = 1 + (fx.speed || 0);
  if (fx.cutSpeed && (c.station === 'doner' || c.station === 'tost')) k += fx.cutSpeed;
  if (c.hour < 12 && fx.morningSpeed) k += fx.morningSpeed;
  if (c.hour >= 17 && fx.eveningSpeed) k += fx.eveningSpeed;
  if (fx.football && c.teamWin && c.teamDay === c.day) k += fx.football;
  s *= Math.max(0.4, k);
  if (c.boostT > 0) s *= c.boostX;
  return s;
}
/** Patience aura of the workers on duty at a point (geveze / güler yüzlü / türkü): fraction the queue's patience drains slower. */
export function patienceAura(state: GameState, workers: { w: WorkerSave; x: number; z: number }[], at: { x: number; z: number }): number {
  let best = 0;
  for (const r of workers) {
    const fx = traitFx(r.w);
    if (!fx.patienceAura) continue;
    if (Math.hypot(r.x - at.x, r.z - at.z) <= (fx.auraR || 6)) best = Math.max(best, fx.patienceAura);
  }
  return best;
}
/** Sum of tip bonuses of hired workers (güler yüzlü, bahşiş avcısı). */
export function tipBonus(state: GameState): number { let s = 0; for (const w of state.workers) s += traitFx(w).tip || 0; return s; }
