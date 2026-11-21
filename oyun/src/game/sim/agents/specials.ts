/**
 * Shared bits of the visitors Sabri serves by hand (regulars, Gurme VIP): the walker, the order bookkeeping and the
 * hand-over interactable. The hand-over follows the dwell rule: Sabri must stand still 0.4 s next to them; then one
 * wanted item moves per 0.18 s from his hands. Walking past hands over nothing.
 */
import type { Vec2 } from '../../../engine/api';
import type { ProductId } from '../schema';
import type { Actor, CarryItem } from './types';
import type { AgentEnv } from './env';
import { ENTRY_M } from './env';
import { Walker, pointBack, dist2d } from './move';

export type Order = Partial<Record<ProductId, number>>;
export interface Special {
  def: { id: string; name: string; voice: number };
  a: Actor; wk: Walker; state: string; t: number;
  order: Order; got: Partial<Record<ProductId, number>>;
  visit: number; hinted: boolean; step: number; spot: Vec2;
}
export const orderDone = (o: Special): boolean => (Object.keys(o.order) as ProductId[]).every((p) => (o.got[p] || 0) >= (o.order[p] || 0));
export const orderLeft = (o: Special): Order => {
  const l: Order = {};
  for (const p of Object.keys(o.order) as ProductId[]) { const k = (o.order[p] || 0) - (o.got[p] || 0); if (k > 0) l[p] = k; }
  return l;
};
export const spawnPoint = (env: AgentEnv): Vec2 => { const s = env.book.spawns(); return s[env.rng('specials').int(0, s.length - 1)]; };
export const farthestSpawn = (env: AgentEnv, p: Vec2): Vec2 => { let b = env.book.spawns()[0], bd = -1; for (const s of env.book.spawns()) { const d = dist2d(s, p); if (d > bd) { bd = d; b = s; } } return b; };
export const outOfSight = (env: AgentEnv, a: Vec2): boolean => dist2d(a, env.book.get('counter')) > 18;

/** Spot beside the queue head: `sign` -1 = regulars (left), +1 = VIP (right). */
export function queueSide(env: AgentEnv, sign: 1 | -1): Vec2 {
  const q0 = env.book.queue(0), q1 = env.book.queueCount() > 1 ? env.book.queue(1) : q0;
  const dx = q1.x - q0.x, dz = q1.z - q0.z, L = Math.hypot(dx, dz) || 1;
  return sign < 0 ? { x: q0.x - dz / L * 1.3, z: q0.z + dx / L * 1.3 } : { x: q0.x + dz / L * 1.3, z: q0.z - dx / L * 1.3 };
}

export function makeSpecial(env: AgentEnv, kind: 'regular' | 'vip', def: Special['def'], look: Record<string, unknown>, spot: Vec2, order: Order): Special {
  const rng = env.rng('specials');
  const from = pointBack(env.nav, spawnPoint(env), spot, rng.range(ENTRY_M[0], ENTRY_M[1]));
  const a = env.reg.add(kind, def.id, { kind, look, seed: def.id.length * 131 }, from, { name: def.name });
  const o: Special = { def, a, wk: new Walker(a, env.nav), state: 'walk', t: 0, order, got: {}, visit: 0, hinted: false, step: 0, spot };
  o.wk.goTo(spot);
  // live position: the registry reads it every tick
  const pos = { get x() { return a.x; }, get z() { return a.z; } } as Vec2;
  const id = 'npc.' + kind;
  env.interactions.register({
    id, pos, radius: 2.2, kind: 'npc', dwell: 0.4,
    canAct: () => {
      return o.state === 'wait' && (Object.keys(orderLeft(o)) as ProductId[]).some((p) => env.host.playerHas(p));
    },
    act: () => {
      for (const p of Object.keys(orderLeft(o)) as ProductId[]) {
        const it = env.host.playerTake(p);
        if (it) { a.carry.push(it); o.got[p] = (o.got[p] || 0) + 1; return orderDone(o) ? 'done' : 'continue'; }
      }
      return 'done';
    },
  });
  return o;
}
export function freeSpecial(env: AgentEnv, kind: 'regular' | 'vip', o: Special): void {
  env.interactions.unregister('npc.' + kind);
  env.reg.remove(o.a);
}
export type { CarryItem };
