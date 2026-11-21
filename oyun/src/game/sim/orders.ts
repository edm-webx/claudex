/** Sipariş Panosu: 3 daily tasks (v2 syncOrders / claimOrder). Keyed by state.calendar (no wall clock). Owner: Builder A. Pure. */
import { DAILY_TASKS, ORDERS_FROM_DAY, taskGoal } from '../../content/daily';
import { P } from '../../content/economy';
import type { Kernel } from './state';
import { fmtMoney } from './util';

export interface OrderRow { id: string; goal: number; base: number; claimed: boolean; notified?: boolean }
export interface OrdersSave { date: string; list: OrderRow[]; allClaimed: boolean }

export function installOrders(K: Kernel) {
  const S = K.state;
  K.todayKey = () => S.calendar + '#' + S.day;
  const orders = () => S.orders as unknown as OrdersSave | null;
  K.syncOrders = (force?: boolean) => {
    if (S.day < ORDERS_FROM_DAY) return;
    const key = K.todayKey(), cur = orders();
    if (cur && cur.date === key && !force) return;
    const r = K.R.orders;
    const ok = DAILY_TASKS.filter(t => (!t.needs || S.owned[t.needs]) && (!t.minDay || S.day >= t.minDay));
    const picks: typeof ok = [];
    while (picks.length < 3 && ok.length) picks.push(ok.splice(r.int(0, ok.length - 1), 1)[0]);
    S.orders = { date: key, list: picks.map(t => ({ id: t.id, goal: taskGoal(t, S.day), base: S.stats[t.stat] || 0, claimed: false })), allClaimed: false } as unknown as unknown[];
    K.logEv('ordersNew', { ids: picks.map(t => t.id) });
  };
  const progress = (o: OrderRow) => { const t = DAILY_TASKS.find(x => x.id === o.id); return t ? Math.min(o.goal, (S.stats[t.stat] || 0) - o.base) : 0; };
  const reward = () => Math.round(Math.max(120, K.incomePerMin() * P.ORDER_MIN));
  function claim(id: string): void {
    const od = orders(); if (!od) return;
    if (id === 'all') {
      if (od.allClaimed || !od.list.every(o => o.claimed)) return;
      od.allClaimed = true; const v = Math.round(Math.max(250, K.incomePerMin() * P.ORDER_ALL_MIN));
      S.money += v; S.gold += P.AS_ORDER_ALL; K.toast('Bütün siparişler tamam! +' + fmtMoney(v) + ', +' + P.AS_ORDER_ALL + ' Altın Simit', 'good'); return;
    }
    const o = od.list.find(x => x.id === id); if (!o || o.claimed || progress(o) < o.goal) return;
    o.claimed = true;
    const v = reward();
    S.money += v; S.gold += P.AS_ORDER; K.addXP(P.XP.order); K.stat('ordersDone');
    K.toast('Sipariş tamam! +' + fmtMoney(v) + (P.AS_ORDER ? ', +' + P.AS_ORDER + ' Altın Simit' : ''), 'good'); K.logEv('orderClaim', { id, v });
    if (od.list.every(x => x.claimed)) claim('all');
    K.saveNow();
  }
  /** panelModel('gorevler') order list, and the notification pass (called once a second). */
  const notify = () => { const od = orders(); if (od) od.list.forEach(o => { (o as OrderRow & { done?: boolean }).done = progress(o) >= o.goal; if (!o.notified && !o.claimed && progress(o) >= o.goal) { o.notified = true; K.toast('Sipariş hazır: Görevler\'den ödülünü al!', 'good'); } }); };
  return { claim, progress, reward, notify, orders };
}
