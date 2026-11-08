/**
 * Economy core: venue multiplier, item value, the sale (streak, sets, siftah, wages), earn/spend, tips, income window.
 * Owner: Builder A. Pure. Ported from v2 game.js venueMult / settleSale / tipMult / earn / incomePerMin.
 * (streak.ts and sets.ts hold the small rules this file calls.)
 */
import { P, TIP_FRAC, decorKeyif } from '../../content/economy';
import { yetenekFxOf } from './yetenek';
import { MALIYET, BONUS_MIN, BONUS_FRAC } from '../../content/ekonomi2';
import { price } from '../../content/products';
import { RANKS, rankOf } from '../../content/ranks';
import { TRAITS } from '../../content/traits';
import { RARITY } from '../../content/ranks';
import type { Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Item, Customer, SalesApi, MoneyStack } from './state';
import { clamp, r1 } from './util';
import { streakStep, streakMult } from './streak';
import { setHit } from './sets';
import { yatirimFx } from './yatirim';

export function installEconomy(K: Kernel, addMoneyTo: (pile: MoneyStack[], v: number) => void): { sales: SalesApi; settleSale(c: Customer | null, items: Item[], opts?: { direct?: boolean; at?: Vec2 }): number; tipMult(): number; earn(v: number, at?: Vec2): void; earnTam(v: number): void; incomePerMin(): number } {
  const rt = K.rt, S = K.state;
  const itemValue = (it: Item): number => price(it.type, it.tier || S.tiers[it.type] || 1) * (it.priceX || 1);
  const pay = (v: number) => {
    S.money += v; S.today!.earned += v; S.week.earned += v; S.totalEarned += v; rt.incomeWin.push([S.playT, v]);
    K.statMax('moneyMax', S.money);
  };
  // Faz 2: side income (anything that isn't a counter sale or a tip) is a faucet capped per game day
  const T = () => S.today as unknown as { sales?: number; bonus?: number; cost?: number };
  const earn = (v: number, _at?: Vec2) => {
    v = Math.max(0, Math.round(v)); if (!v) return;
    const t = T(), cap = Math.max(BONUS_MIN, BONUS_FRAC * (t.sales || 0));
    v = Math.min(v, Math.max(0, Math.round(cap - (t.bonus || 0)))); if (!v) return;
    t.bonus = (t.bonus || 0) + v;
    pay(v);
  };
  /** Ingredients of the sold items (₺), paid out of the sale. */
  const costOf = (items: Item[]) => items.reduce((s, it) => s + itemValue(it) * (MALIYET[it.type] ?? 0.4), 0) * (1 - yatirimFx(S, 'hammadde'));
  function settleSale(c: Customer | null, items: Item[], opts: { direct?: boolean; at?: Vec2 } = {}): number {
    let sum = 0; const prods: ProductId[] = [];
    items.forEach(it => { sum += itemValue(it); if (!prods.includes(it.type)) prods.push(it.type); });
    const st = streakStep(rt, S.playT, prods);
    let mult = K.venueMult() * streakMult(st) * (1 + yetenekFxOf(K.rt).price);   // class skill (yetenek.ts)
    const hit = c ? setHit(c.set, c.got) : null;
    if (hit) mult *= hit.x;
    let siftah = false;
    if (S.siftahDate !== (S.calendar || 'x')) { S.siftahDate = S.calendar || 'x'; siftah = true; mult *= P.SIFTAH_X; }
    let value = sum * mult;
    items.forEach(it => {
      const wid = it.by || it.carrier; if (!wid) return;
      const w = S.workers.find(x => x.id === wid); if (!w) return;
      const fx = (TRAITS[w.trait as string] || { fx: {} }).fx;
      const share = RANKS[rankOf(w.xp || 0)].wage * (1 + (fx.wage || 0));
      const wage = itemValue(it) * mult * share;
      (w as { paidToday?: number }).paidToday = ((w as { paidToday?: number }).paidToday || 0) + wage; value -= wage;
    });
    const cost = costOf(items);
    { const t = T(); t.sales = (t.sales || 0) + value; t.cost = (t.cost || 0) + cost; }
    value = Math.max(1, Math.round(value - cost));
    S.today!.customers++; S.week.customers = (S.week.customers || 0) + 1;
    K.stat('sales'); K.stat('served');
    items.forEach(it => K.stat('sold_' + it.type));
    if (hit) { K.stat('sets'); S.today!.sets++; K.logEv('set', { set: hit.id }); }
    if (rt.streak >= 2 && !S.tut.firstStreak) { S.tut.firstStreak = 1; K.logEv('firstStreak'); K.toast('Seri! Art arda satış, fazladan para.', 'good'); }
    if (rt.streak >= 4) K.statMax('streak5', 1);
    if (siftah) { K.toast('Siftah! Bereketli olsun. ×2', 'good'); K.logEv('siftah', { value }); }
    if (c && c.calm) K.stat('chatCalm');
    if (c && c.typeId === 'emekli' && (c.order.cay || 0) >= 3) K.statMax('emekli3', 1);
    K.addXP(1);
    if (opts.direct) pay(value);
    else { addMoneyTo(rt.kasa, value); S.today!.earned += value; S.week.earned += value; S.totalEarned += value; rt.incomeWin.push([S.playT, value]); }
    K.logEv('sale', { value, n: items.length, streak: rt.streak, kind: c ? c.kind : '-' });
    return value;
  }
  const tipMult = (): number => {
    let k = 1;
    S.workers.forEach(w => { const fx = (TRAITS[w.trait as string] || { fx: {} }).fx; if (fx.tip) k += fx.tip * (RARITY[w.rarity as string] || RARITY.gri).x; });
    k += clamp(decorKeyif(K.placedDecor()) * P.DECOR_TIP_PER_KEYIF, 0, P.DECOR_TIP_CAP);
    if (rt.tipBoostT > 0) k += 0.10;
    k += yatirimFx(S, 'kasa');
    return k;
  };
  const incomePerMin = (): number => {
    const t0 = S.playT - 180;
    while (rt.incomeWin.length && rt.incomeWin[0][0] < t0 - 60) rt.incomeWin.shift();
    const sum = rt.incomeWin.filter(e => e[0] >= t0).reduce((s, e) => s + e[1], 0);
    const span = Math.min(180, Math.max(30, S.playT));
    return sum / (span / 60);
  };
  return { sales: { settle: (items, o) => settleSale(null, items, o), itemValue }, settleSale, tipMult, earn, earnTam: (v: number) => { v = Math.max(0, Math.round(v)); if (v) pay(v); }, incomePerMin };
  void r1; void TIP_FRAC;
}
