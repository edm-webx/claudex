/**
 * Economy core: venue multiplier, item value, the sale (streak, sets, siftah, wages), earn/spend, tips, income window.
 * Owner: Builder A. Pure. Ported from v2 game.js venueMult / settleSale / tipMult / earn / incomePerMin.
 * (streak.ts and sets.ts hold the small rules this file calls.)
 */
import { P, TIP_FRAC, decorKeyif } from '../../content/economy';
import { yetenekFxOf } from './yetenek';
import { MALIYET, BONUS_MIN, BONUS_FRAC, KAYNAKLAR, fmtTL } from '../../content/ekonomi2';
import { price } from '../../content/products';
import { RANKS, rankOf } from '../../content/ranks';
import { TRAITS } from '../../content/traits';
import { RARITY } from '../../content/ranks';
import type { Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Plate, Customer, SalesApi, MoneyStack } from './state';
import { DISH_BY_ID, isProduct, yemekMaliyet } from '../../content/yemek-menu';
import { clamp, r1 } from './util';
import { streakStep, streakMult } from './streak';
import { setHit } from './sets';
import { yatirimFx } from './yatirim';
import { MISAFIR_KAPALI_KAYNAK, MISAFIR_IS, MISAFIR_MAAS } from './misafir-kural';

export function installEconomy(K: Kernel, addMoneyTo: (pile: MoneyStack[], v: number) => void): { sales: SalesApi; settleSale(c: Customer | null, items: Plate[], opts?: { direct?: boolean; at?: Vec2 }): number; tipMult(): number; earn(v: number, at?: Vec2): number; earnTam(v: number, kaynak?: string): void; credit(kaynak: string, tutar: number, o?: { tavanli?: boolean; at?: Vec2 }): number; book(kaynak: string, tutar: number): void; cashIn(tutar: number): void; incomePerMin(): number } {
  const rt = K.rt, S = K.state;
  /** BUF-05: a kitchen dish plate sells at its menu price (DishDef.fiyat), a counter product at its tier price */
  const itemValue = (it: Plate): number => (isProduct(it.type) ? price(it.type, it.tier || S.tiers[it.type] || 1) : (DISH_BY_ID[it.type]?.fiyat ?? 0)) * (it.priceX || 1);
  const costRate = (it: Plate): number => (isProduct(it.type) ? MALIYET[it.type] : DISH_BY_ID[it.type] ? yemekMaliyet(DISH_BY_ID[it.type]) : 0.4);
  // EKO-02: tek gelir kapısı. Para kaynağı ne olursa olsun deftere (S.today.src, S.stats.kaynak_*) ve S.today/S.week/totalEarned/gelir penceresine buradan yazılır.
  const bilinen = new Set<string>(KAYNAKLAR);
  // Gelir penceresi (incomePerMin) yalnız düzenli işten beslenir: ödül, sandık, hedef, faiz gibi tek seferlik paralar pencereye girmez.
  // Yoksa "dakikalık gelir x dakika" ile ödenen ödüller kendi kendini büyütür (gelir gelir doğurur).
  const duzenli = new Set<string>(['tezgah', 'adisyon', 'bahsis', 'salon', 'isletme']);
  const book = (kaynak: string, v: number) => {
    if (!(v > 0)) return;
    const k = bilinen.has(kaynak) ? kaynak : 'diger', t = S.today!;
    S.today!.earned += v; S.week.earned += v; S.totalEarned += v; if (duzenli.has(k)) rt.incomeWin.push([S.playT, v]);
    const src = (t.src ||= {}); src[k] = (src[k] || 0) + v;
    S.stats['kaynak_' + k] = (S.stats['kaynak_' + k] || 0) + v;
    // QA 2026-11-27: ev sahibine bildirilen yalnız misafirin ev sahibinin büfesindeki SATIŞI (MISAFIR_IS); maç / bahis gibi kendi kazancı değil (eskiden totalEarned farkı yollanıyordu: çift sayım)
    if (misafir() && MISAFIR_IS.has(k)) { const r = rt as unknown as { misafirSatis?: number }; r.misafirSatis = (r.misafirSatis || 0) + v; }
  };
  // odada misafir (sim/misafir-kural.ts): ev sahibinin büfesindeki satış ev sahibinindir, misafirin cebine oyunun bastığı maaş girer
  const misafir = () => !!(rt as unknown as { misafir?: boolean }).misafir;
  const cashIn = (v: number) => { if (!(v > 0)) return; S.money += misafir() ? v * MISAFIR_MAAS : v; K.statMax('moneyMax', S.money); };
  const pay = (v: number, kaynak = 'tezgah') => { S.money += misafir() && MISAFIR_IS.has(kaynak) ? v * MISAFIR_MAAS : v; book(kaynak, v); K.statMax('moneyMax', S.money); };
  // Yan gelir tavanı yalnız rastgele küçük bonuslara: max(600, %10 x günlük hedef geliri), dünden devreden pay ile.
  const T = () => S.today as unknown as { sales?: number; bonus?: number; cost?: number; bonusDoldu?: boolean };
  const bonusTavan = (): number => {
    const t = T(), dun = rt.dayHistory.length ? rt.dayHistory[rt.dayHistory.length - 1].earned : 0;
    const hedef = Math.max(dun, t.sales || 0), tavan = Math.max(BONUS_MIN, BONUS_FRAC * hedef);
    return tavan + Math.min(tavan, Math.max(0, S.stats.bonusDevir || 0));
  };
  const credit = (kaynak: string, tutar: number, o: { tavanli?: boolean; at?: Vec2 } = {}): number => {
    let v = Math.max(0, Math.round(tutar)); if (!v) return 0;
    if (misafir() && MISAFIR_KAPALI_KAYNAK.has(kaynak)) return 0;   // ev sahibinin pasif geliri / ödülü misafire ikiz para olmasın
    if (o.tavanli) {
      const t = T(), kalan = Math.max(0, Math.round(bonusTavan() - (t.bonus || 0)));
      if (v > kalan) { v = kalan; if (!t.bonusDoldu) { t.bonusDoldu = true; K.toast('Bugünlük bonus doldu.', 'info'); } }
      if (!v) return 0;
      t.bonus = (t.bonus || 0) + v;
    }
    pay(v, kaynak);
    return v;   // toast'lar kırpılmış tutarı yazsın
  };
  K.bus.on('dayEnd', () => { const t = T(); S.stats.bonusDevir = Math.max(0, Math.round(bonusTavan() - (t.bonus || 0))); });
  const earn = (v: number, at?: Vec2): number => credit('diger', v, { tavanli: true, at });
  /** Ingredients of the sold items (₺), paid out of the sale. */
  const costOf = (items: Plate[]) => items.reduce((s, it) => s + itemValue(it) * costRate(it), 0) * (1 - yatirimFx(S, 'hammadde'));
  function settleSale(c: Customer | null, items: Plate[], opts: { direct?: boolean; at?: Vec2 } = {}): number {
    let sum = 0; const prods: ProductId[] = [];
    items.forEach(it => { sum += itemValue(it); if (isProduct(it.type) && !prods.includes(it.type)) prods.push(it.type); });
    { const sold = ((S.today as unknown as { sold?: Record<string, number> }).sold ||= {}); items.forEach(it => { sold[it.type] = (sold[it.type] || 0) + 1; }); }   // day-end report: best seller
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
    if (siftah) { K.toast('Siftah! Bereketli olsun. ×' + String(P.SIFTAH_X).replace('.', ','), 'good'); K.logEv('siftah', { value }); }
    if (c && c.calm) K.stat('chatCalm');
    if (c && c.typeId === 'emekli' && (c.order.cay || 0) >= 3) K.statMax('emekli3', 1);
    K.addXP(1);
    if (opts.direct) pay(value, 'tezgah');
    else { addMoneyTo(rt.kasa, value); book('tezgah', value); }
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
  return { sales: { settle: (items, o) => settleSale(null, items, o), itemValue }, settleSale, tipMult, earn, earnTam: (v: number, kaynak = 'diger') => { credit(kaynak, v); }, credit, book, cashIn, incomePerMin };
  void r1; void TIP_FRAC; void fmtTL;
}
