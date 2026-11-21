/**
 * Dwell rule registry (MOTOR §8, binding). Owner: Builder A. Pure: no DOM, no three, no wall clock.
 * Semantics per actor, per sim tick (update):
 * - Eligible = inside radius AND canAct(actor). Only the nearest eligible interactable dwells.
 * - speed >= DWELL_SPEED_MAX, or leaving the radius, or a different nearest target -> timer resets and transfers stop
 *   in the same tick ('dwellCancel' emitted if a dwell/transfer was in progress).
 * - Timer accumulates ctx.dt; on the tick it reaches `dwell` (dwell 0 = first tick of contact) act() fires,
 *   then every `interval` (default TRANSFER_INTERVAL) until act() returns 'done' or `takeLimit` transfers happened.
 *   After that nothing more happens until the actor leaves/moves and comes back.
 * - Emits 'dwellStart' when the timer starts and 'transfer' after each act().
 * - passBy interactables (money) skip all of this: they act on contact at any speed, then every `interval` inside.
 * - Primed: every interactable the actor completed a dwell on (>= 1 transfer) stays primed while the actor keeps still
 *   inside its radius. When the nearest eligible target changes between primed ones (tray empty, hands full, a station
 *   spot that overlaps the counter) the transfer resumes at once without a new dwell, so standing still works like v2
 *   and the ring does not refill and blink per unit. Moving (speed >= DWELL_SPEED_MAX) or leaving clears it.
 */
import type { DwellStatus, Entity, Interactable, InteractionRegistry, SimCtx, Vec2, Disposer } from '../api';
import { DWELL_SPEED_MAX, TRANSFER_INTERVAL } from '../api';

interface ActorState { id: string | null; t: number; since: number; transferring: boolean; transfers: number; finished: boolean; primed: Set<string>; pass: Map<string, number>; status: DwellStatus; }
const EPS = 1e-6;

export function createInteractions(): InteractionRegistry {
  const items = new Map<string, Interactable>();
  let list: Interactable[] = [];
  const actors = new Map<Entity, ActorState>();
  const relist = () => { list = [...items.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); };

  const reset = (a: ActorState, actor: Entity, ctx: SimCtx | null) => {
    if (a.id && (a.t > 0 || a.transferring) && !a.finished && ctx) {
      try { ctx.bus.emit('dwellCancel', { id: a.id, actor }); } catch { /* ignore */ }
    }
    a.id = null; a.t = 0; a.since = 0; a.transferring = false; a.transfers = 0; a.finished = false;
  };

  const reg: InteractionRegistry = {
    register(i): Disposer { items.set(i.id, i); relist(); return () => reg.unregister(i.id); },
    unregister(id) {
      if (items.delete(id)) relist();
      actors.forEach((a, actor) => { if (a.id === id) reset(a, actor, null); a.primed.delete(id); a.pass.delete(id); });
    },
    get: id => items.get(id),
    all: () => list,
    update(actor, pos: Vec2, speed, ctx) {
      let a = actors.get(actor);
      if (!a) { a = { id: null, t: 0, since: 0, transferring: false, transfers: 0, finished: false, primed: new Set<string>(), pass: new Map<string, number>(), status: { id: '', progress: 0, transferring: false, transfers: 0 } }; actors.set(actor, a); }
      // primed targets: kept only while the actor is still and inside their radius
      if (a.primed.size) {
        if (speed >= DWELL_SPEED_MAX) a.primed.clear();
        else a.primed.forEach(pid => {
          const pi = items.get(pid);
          const pdx = pi ? pos.x - pi.pos.x : 0, pdz = pi ? pos.z - pi.pos.z : 0;
          if (!pi || pdx * pdx + pdz * pdz > pi.radius * pi.radius) a!.primed.delete(pid);
        });
      }
      // pass-by pickups (money): any speed, no dwell; first act on contact, then every interval while inside
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        if (!it.passBy) continue;
        const dx = pos.x - it.pos.x, dz = pos.z - it.pos.z;
        let ok = dx * dx + dz * dz <= it.radius * it.radius;
        if (ok) { try { ok = it.canAct(actor); } catch { ok = false; } }
        if (!ok) { a.pass.delete(it.id); continue; }
        const iv = it.interval ?? TRANSFER_INTERVAL;
        const since = (a.pass.get(it.id) ?? iv) + (a.pass.has(it.id) ? ctx.dt : 0);
        if (since + EPS >= iv) {
          a.pass.set(it.id, 0);
          try { it.act(actor, ctx); } catch { /* ignore */ }
          try { ctx.bus.emit('transfer', { id: it.id, actor, n: 1 }); } catch { /* ignore */ }
        } else a.pass.set(it.id, since);
      }
      // nearest eligible (dwell targets)
      let best: Interactable | null = null, bd = Infinity;
      for (let k = 0; k < list.length; k++) {
        const it = list[k];
        if (it.passBy) continue;
        const dx = pos.x - it.pos.x, dz = pos.z - it.pos.z, d2 = dx * dx + dz * dz;
        if (d2 > it.radius * it.radius || d2 >= bd) continue;
        let ok = false;
        try { ok = it.canAct(actor); } catch { ok = false; }
        if (ok) { best = it; bd = d2; }
      }
      if (!best || speed >= DWELL_SPEED_MAX) {
        if (a.id) {
          if (speed < DWELL_SPEED_MAX && a.primed.has(a.id)) { a.id = null; a.t = 0; a.since = 0; a.transferring = false; a.transfers = 0; a.finished = false; }
          else reset(a, actor, ctx);
        }
        return;
      }
      if (a.id !== best.id) {
        if (a.id) { if (a.primed.has(a.id)) { a.id = null; a.t = 0; a.since = 0; a.transferring = false; a.transfers = 0; a.finished = false; } else reset(a, actor, ctx); }
        a.id = best.id;
        if (a.primed.has(best.id)) {
          // resume at once: no new dwell (progress stays 0 so the ring does not refill), first act this tick
          a.transferring = true; a.since = best.interval ?? TRANSFER_INTERVAL;
        } else {
          try { ctx.bus.emit('dwellStart', { id: best.id, actor }); } catch { /* ignore */ }
        }
      } else a.t += ctx.dt;
      if (a.finished) return;
      const it = best;
      const doAct = () => {
        let r: 'continue' | 'done' = 'done';
        try { r = it.act(actor, ctx); } catch { r = 'done'; }
        if (a!.id !== it.id) return;   // act() unregistered its own interactable (pad bought): state was reset
        a!.transfers++; a!.since = 0; a!.primed.add(it.id);
        try { ctx.bus.emit('transfer', { id: it.id, actor, n: a!.transfers }); } catch { /* ignore */ }
        if (r === 'done' || (it.takeLimit !== undefined && a!.transfers >= it.takeLimit)) { a!.finished = true; a!.transferring = false; }
      };
      if (!a.transferring) {
        if (a.t + EPS >= it.dwell) { a.transferring = true; doAct(); }
      } else {
        a.since += ctx.dt;
        if (a.since + EPS >= (it.interval ?? TRANSFER_INTERVAL)) doAct();
      }
    },
    status(actor) {
      const a = actors.get(actor);
      if (!a || !a.id) return null;
      const it = items.get(a.id);
      const s = a.status;
      s.id = a.id;
      s.progress = !it || it.dwell <= 0 ? 1 : Math.min(1, a.t / it.dwell);
      s.transferring = a.transferring; s.transfers = a.transfers;
      return s;
    },
  };
  return reg;
}
