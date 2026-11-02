/**
 * Counter, player hands (carry) and the counter drop interactable. Owner: Builder A. Pure.
 * v2: products stack 8 high per product; Sabri keeps reserved items in hand (waiting regular/VIP/window customers).
 * Dwell: `counter` interactable at the counter stand-at point (radius 1.0, dwell 0.25 s), one drop per transfer.
 */
import { DWELL_DEFAULTS } from '../../engine/api';
import { PRODUCT_IDS } from '../../content/products';
import type { ProductId } from './schema';
import type { Kernel, CounterApi, CarryApi, Item, Order } from './state';

export function installCounter(K: Kernel, reserved: () => Partial<Record<ProductId, number>>, carryCap: () => number): { counterApi: CounterApi; carryApi: CarryApi; register(): void } {
  const rt = K.rt, S = K.state;
  const counterApi: CounterApi = {
    count: p => rt.counter[p].length,
    put(it) { const b = rt.counter[it.type]; if (!b || b.length >= 8) return false; b.push(it); return true; },
    take(p, n, who) {
      if (who === 'gull') {
        const b = rt.counter[p];
        const tier = b.length ? b[b.length - 1].tier : (S.tiers[p] || 1);
        return [{ type: p, tier }];
      }
      const out: Item[] = [];
      for (let i = 0; i < n && rt.counter[p].length; i++) out.push(rt.counter[p].pop()!);
      return out;
    },
    need() {
      const w: Order = {};
      rt.queue.slice(0, 5).forEach(c => { const l = K.orderLeft(c); for (const p in l) w[p as ProductId] = (w[p as ProductId] || 0) + (l[p as ProductId] || 0); });
      for (const p of PRODUCT_IDS) { const v = (w[p] || 0) - rt.counter[p].length; if (v > 0) w[p] = v; else delete w[p]; }
      return w;
    },
  };
  const carryApi: CarryApi = {
    count: p => (p ? rt.carry.filter(i => i.type === p).length : rt.carry.length),
    cap: carryCap,
    takeFromPlayer(p) { const i = rt.carry.findIndex(it => it.type === p); return i < 0 ? null : rt.carry.splice(i, 1)[0]; },
  };
  // The drop zone runs along the whole drawn counter, not a 1 m circle at its middle: from stage 2 the counter is a
  // 4.3 m marble top and leaning on most of it did nothing (2026-10-26 "tezgah hayalet gibi, tepsidekileri bırakmıyor";
  // workers walk to the stand point directly, so only they could serve). The point slides with Sabri along the span.
  const cpos = {
    get x() { const c = rt.layout.counter, px = S.player.x; return px < c.span[0] ? c.span[0] : px > c.span[1] ? c.span[1] : px; },
    get z() { return rt.layout.counter.standAt.z; },
  };
  let reg = false;
  const register = () => {
    if (reg) return; reg = true;
    K.interactions.register({
      id: 'counter', pos: cpos, radius: 1.0, kind: 'counter', dwell: DWELL_DEFAULTS.counter, interval: 0.08,
      canAct: () => {
        if (!rt.carry.length) return false;
        const res = { ...reserved() };
        for (let i = rt.carry.length - 1; i >= 0; i--) {
          const it = rt.carry[i];
          if ((res[it.type] || 0) > 0) { res[it.type] = (res[it.type] || 0) - 1; continue; }
          if (rt.counter[it.type] && rt.counter[it.type].length < 12) return true;
        }
        return false;
      },
      act: () => {
        const res = reserved();
        for (let i = rt.carry.length - 1; i >= 0; i--) {
          const it = rt.carry[i], box = rt.counter[it.type];
          if ((res[it.type] || 0) > 0) { res[it.type] = (res[it.type] || 0) - 1; continue; }
          if (box && box.length < 12) { box.push(rt.carry.splice(i, 1)[0]); if (!S.tut.firstDrop) { S.tut.firstDrop = 1; K.logEv('firstDrop'); } break; }
        }
        // 2026-10-25 user: 'elimdekiler tezgaha gitmiyor' - say why nothing was put down
        if (rt.carry.length && !rt.carry.some(it => (res[it.type] || 0) <= 0 && rt.counter[it.type] && rt.counter[it.type].length < 12)) K.toast(rt.carry.some(it => (res[it.type] || 0) > 0) ? 'Bunlar pencere ya da masa siparişine ayrıldı: elden servis et.' : 'Tezgah dolu. Müşteriler alana kadar bekle.', 'info');
        return 'continue';
      },
    });
  };
  return { counterApi, carryApi, register };
}
