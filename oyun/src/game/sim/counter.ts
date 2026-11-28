/**
 * Counter, player hands (carry) and the counter drop interactable. Owner: Builder A. Pure.
 * v2: products stack 8 high per product; Sabri keeps reserved items in hand (waiting regular/VIP/window customers).
 * Dwell: `counter` interactable at the counter stand-at point (radius 1.0, dwell 0.25 s), one drop per transfer.
 */
import { DWELL_DEFAULTS } from '../../engine/api';
import { PRODUCT_IDS, TEZGAH_SINIR } from '../../content/products';
import type { ProductId } from './schema';
import type { Kernel, CounterApi, CarryApi, Item, Order } from './state';

export function installCounter(K: Kernel, reserved: () => Partial<Record<ProductId, number>>, carryCap: () => number): { counterApi: CounterApi; carryApi: CarryApi; register(): void } {
  const rt = K.rt, S = K.state;
  const counterApi: CounterApi = {
    count: p => rt.counter[p].length,
    put(it) { const b = rt.counter[it.type]; if (!b || b.length >= TEZGAH_SINIR) return false; b.push(it); return true; },
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
  /**
   * Which carried item goes down next (index in rt.carry, -1 = none). 2026-11-21 owner (angry, long-standing): "tepsimde
   * bişey varken HALA tezgaha koyamıyorum ki sıradaki müşteri alsın". Root cause: every open table ticket (stage 3+, up to
   * 48 tables with the wings), the VIP and the window queue RESERVED the matching items in Sabri's hands, so on a busy day
   * the whole tray counted as reserved and nothing was put down while the counter queue stood there wanting exactly
   * those items. Now the counter queue comes first: whatever the first five queued customers still need (minus what is
   * already on the counter) is always put down. Only the surplus beyond that stays in hand for table / window service.
   */
  function pickDrop(): number {
    if (!rt.carry.length) return -1;
    const qNeed = counterApi.need() as Record<string, number>;
    const res = { ...reserved() } as Record<string, number>;
    let fallback = -1;
    for (let i = rt.carry.length - 1; i >= 0; i--) {
      const p = rt.carry[i].type, box = rt.counter[p];
      if (!box || box.length >= 12) continue;
      if ((qNeed[p] || 0) > 0) return i;
      if ((res[p] || 0) > 0) { res[p]--; continue; }
      if (fallback < 0) fallback = i;
    }
    return fallback;
  }
  let reg = false;
  const register = () => {
    if (reg) return; reg = true;
    K.interactions.register({
      id: 'counter', pos: cpos, radius: 1.0, kind: 'counter', dwell: DWELL_DEFAULTS.counter, interval: 0.08,
      canAct: () => pickDrop() >= 0,
      act: () => {
        const i = pickDrop();
        if (i >= 0) { const it = rt.carry.splice(i, 1)[0]; rt.counter[it.type].push(it); if (!S.tut.firstDrop) { S.tut.firstDrop = 1; K.logEv('firstDrop'); } }
        // 2026-10-25 user: 'elimdekiler tezgaha gitmiyor' - say why nothing was put down
        if (rt.carry.length && pickDrop() < 0) K.toast(rt.carry.some(it => rt.counter[it.type] && rt.counter[it.type].length < 12) ? 'Bunlar pencere ya da masa siparişine ayrıldı: elden servis et.' : 'Tezgah dolu. Müşteriler alana kadar bekle.', 'info');
        return 'continue';
      },
    });
  };
  return { counterApi, carryApi, register };
}
