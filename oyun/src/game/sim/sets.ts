/** Menu sets (Menü!): a customer that got every product of its set pays x1.3 / x1.4. Owner: Builder A. Pure. */
import { SETS } from '../../content/products';
import { P } from '../../content/economy';
import type { Order } from './state';
import type { SetDef } from '../../content/types';
export const setById = (id: string | null): SetDef | null => (id ? SETS.find(s => s.id === id) || null : null);
export function setHit(id: string | null, got: Order): SetDef | null {
  const s = setById(id);
  return s && s.items.every(p => (got[p] || 0) > 0) ? s : null;
}
export const setChance = (renamedSign: boolean): number => (renamedSign ? P.SET_CHANCE_SIGN : P.SET_CHANCE);
