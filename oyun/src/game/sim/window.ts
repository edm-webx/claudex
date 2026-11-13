/**
 * Vapur Penceresi (v2 window): opens for 20 s when the ferry docks (if the pad was bought); only the player serves it,
 * carrying exactly what the window customers want. Dwell rule: `window` interactable (radius 1.25, dwell 0.25 s,
 * one item per 0.25 s). Owner: Builder A. Pure. Faz 2: an assigned worker can serve it from the counter.
 */
import { DWELL_DEFAULTS } from '../../engine/api';
import { P } from '../../content/economy';
import { LINES } from '../../content/lines';
import type { ProductId } from './schema';
import type { Kernel, Customer, Item } from './state';
import type { installCustomers } from './customers';

/** Worker id posted at the ferry window (0 = nobody). */
export const pencereWid = (S: { zones?: Record<string, unknown>; workers: { id: number }[] }): number => {
  const w = Number((S.zones?.pencere as { wid?: number } | undefined)?.wid) || 0;
  return w && S.workers.some(x => x.id === w) ? w : 0;
};

export function installWindow(K: Kernel, cu: ReturnType<typeof installCustomers>, settle: (c: Customer, items: Item[], opts: { direct?: boolean; at?: { x: number; z: number } }) => number) {
  const rt = K.rt, S = K.state;
  const open = () => {
    rt.window = { open: true, t: P.WINDOW_S, sales: 0 };
    K.toast(LINES.ferry.open, 'good'); K.logEv('windowOpen');
  };
  const close = () => {
    if (!rt.window) return;
    const sales = rt.window.sales;
    rt.window.open = false;
    // 2026-10-25 user: the window counter keeps its stock like the main counter (nothing is sent back at closing)
    K.statMax('windowBest', sales);
    rt.winq.slice().forEach(c => cu.leave(c, false));
    K.toast(LINES.ferry.close + (sales ? ' ' + sales + ' satış!' : ''), sales ? 'good' : 'info');
    K.logEv('windowClose', { sales });
    rt.window = null;
  };
  // Faz 2 (user item 28): a worker can be posted at the window (S.zones.pencere.wid). While the window is open and the
  // worker stands there (rt.pencereAt, set by agents/workers.ts), they serve the first window customer from the counter.
  // The posted worker first lays the wanted items out on the window counter (rt.winShelf, max SHELF_N, drawn by
  // view/world/stant-look.ts), then hands them out to the first window customer.
  const SHELF_N = 10;
  let layT = 0, staffT = 0;
  const shelf = (): ProductId[] => { const r = rt as unknown as { winShelf?: ProductId[] }; return (r.winShelf ??= []); };
  const staffServe = (dt: number) => {
    const wid = pencereWid(S); if (!wid || !(rt as unknown as { pencereAt?: boolean }).pencereAt || !rt.window) return;
    const sh = shelf();
    // lay out: what the queue wants and the shelf does not hold yet, taken from the main counter
    if ((layT -= dt) <= 0 && sh.length < SHELF_N) {
      layT = 0.9;
      const want: Partial<Record<ProductId, number>> = {};
      for (const c of rt.winq.slice(0, 3)) { const l = cu.orderLeft(c); for (const p in l) want[p as ProductId] = (want[p as ProductId] || 0) + (l[p as ProductId] || 0); }
      for (const p of sh) if (want[p]) want[p] = (want[p] || 0) - 1;
      const p = (Object.keys(want) as ProductId[]).find(k => (want[k] || 0) > 0 && rt.counter[k] && rt.counter[k].length);
      if (p) { rt.counter[p].pop(); sh.push(p); }
    }
    if ((staffT -= dt) > 0) return; staffT = 1.1;
    const c = rt.winq[0]; if (!c || c.state !== 'wqueue') return;
    const left = cu.orderLeft(c);
    const i = sh.findIndex(p => (left[p] || 0) > 0); if (i < 0) return;
    const [p] = sh.splice(i, 1); c.got[p] = (c.got[p] || 0) + 1;
    if (!Object.keys(cu.orderLeft(c)).length) {
      settle(c, [{ type: p, tier: S.tiers[p] || 1 } as Item], { direct: true, at: rt.layout.window.standAt });
      rt.window.sales++; K.stat('windowSales');
      cu.say(c, K.R.main.pick(['Sağ ol!', 'Eline sağlık!', 'Hızlıymışsınız!']), 1.5);
      cu.leave(c, false);
    }
  };
  const update = (dt: number) => { if (rt.window && rt.window.open) { rt.window.t -= dt; staffServe(dt); if (rt.window.t <= 0) close(); } };
  let reg = false;
  const register = () => {
    if (reg) return; reg = true;
    K.interactions.register({
      id: 'window', pos: rt.layout.window.standAt, radius: 1.25, kind: 'counter', dwell: DWELL_DEFAULTS.counter, interval: 0.25,
      canAct: () => (!!rt.window && rt.window.open && rt.winq.length > 0 && rt.winq[0].state === 'wqueue') || (rt.carry.length > 0 && shelf().length < SHELF_N),
      act: () => {
        const c = rt.winq[0];
        if (!c || c.state !== 'wqueue' || !rt.window || !rt.window.open) {
          // nobody to serve right now: stock the window counter (like the main counter)
          if (rt.carry.length && shelf().length < SHELF_N) { const it = rt.carry.pop()!; shelf().push(it.type as ProductId); }
          return 'continue';
        }
        const left = cu.orderLeft(c);
        // stock on the window counter goes first (one item per tick)
        { const sh = shelf(), si = sh.findIndex(p => (left[p] || 0) > 0);
          if (si >= 0) {
            const [p] = sh.splice(si, 1); c.got[p] = (c.got[p] || 0) + 1;
            if (!Object.keys(cu.orderLeft(c)).length) {
              settle(c, [{ type: p, tier: S.tiers[p] || 1 } as Item], { direct: true, at: rt.layout.window.standAt });
              rt.window.sales++; K.stat('windowSales'); cu.say(c, K.R.main.pick(['Sağ ol abi!', 'Yetiştim!', 'Eline sağlık!']), 1.5); cu.leave(c, false);
            }
            return 'continue';
          } }
        for (const p of Object.keys(left) as ProductId[]) {
          const i = rt.carry.findIndex(it => it.type === p);
          if (i < 0) continue;
          const it = rt.carry.splice(i, 1)[0]; c.got[p] = (c.got[p] || 0) + 1;
          if (!Object.keys(cu.orderLeft(c)).length) {
            const v = settle(c, [{ ...it }], { direct: true, at: rt.layout.window.standAt });
            rt.window.sales++; K.stat('windowSales');
            cu.say(c, K.R.main.pick(['Sağ ol abi!', 'Yetiştim!', 'Eline sağlık!']), 1.5);
            if (!S.tut.windowSale) { S.tut.windowSale = 1; K.logEv('firstWindowSale', { v }); }
            cu.leave(c, false);
          }
          break;
        }
        // 2026-10-30 user: "vapur tezgahına bişey koyamadım". A customer waiting for something else used to make the
        // window ignore everything else in Sabri's hands (canAct true, act did nothing). Whatever he cannot hand over now is stocked.
        if (rt.carry.length && shelf().length < SHELF_N && !Object.keys(left).some(p => rt.carry.some(it => it.type === p))) { const it = rt.carry.pop()!; shelf().push(it.type as ProductId); }
        return 'continue';
      },
    });
  };
  return { open, close, update, register };
}
