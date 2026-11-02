/** Sıcak Tezgah streak: same product again within 10 s raises the multiplier (max 5 steps of +10%). Owner: Builder A. Pure. */
import { P } from '../../content/economy';
import type { ProductId } from './schema';
import type { Runtime } from './state';
export function streakStep(rt: Runtime, tNow: number, prods: ProductId[]): number {
  if (tNow - rt.lastSaleT <= P.STREAK_WINDOW_S && prods.some(p => rt.lastSaleProducts.includes(p))) rt.streak = Math.min(P.STREAK_MAX, rt.streak + 1);
  else rt.streak = 0;
  rt.lastSaleT = tNow; rt.lastSaleProducts = prods;
  return rt.streak;
}
export const streakMult = (streak: number): number => 1 + P.STREAK_STEP * streak;
