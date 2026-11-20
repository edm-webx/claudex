/**
 * Day clock end, report card (Karne), stars, day card, weekly kasa count (v2 updateDay / gradeScores / updateKarne /
 * endDay / onNewDay / weeklyCount). Owner: Builder A. Pure. `dayCard` and `kasaSayimi` overlays are models in rt.uiLast.
 */
import { P, GRADES, grade5, starsFor, TROPHIES } from '../../content/economy';
import { PRODUCT_IDS } from '../../content/products';
import { LINES } from '../../content/lines';
import { TEAMS } from '../../content/traits';
import { newToday } from './schema';
import type { Kernel } from './state';
import { clamp, fmtMoney } from './util';

export function installKarne(K: Kernel) {
  const rt = K.rt, S = K.state;
  const stationCount = () => PRODUCT_IDS.filter(p => rt.stations[p].built).length;
  const dirtyTables = () => rt.tables.filter(t => t.built && t.dirty > 0).length;
  function gradeScores() {
    const open = K.openProducts(), T0 = S.today!;
    const avgTier = open.reduce((s, p) => s + (S.tiers[p] - 1), 0) / Math.max(1, open.length);
    const angryFrac = T0.angry / Math.max(1, T0.customers + T0.angry);
    const snv = ((S.zones.okul as { sinavlar?: number[] } | undefined)?.sinavlar || []).filter(Number.isFinite), sinav = snv.length ? snv.reduce((x, y) => x + y, 0) / snv.length / 100 : 0;   // school exam average (0..1) feeds the general score
    const regs = Object.values(S.regulars).reduce((s, r) => s + ((r.visits as number) || 0), 0);
    return {
      lezzet: clamp(0.15 + 0.08 * open.length + 0.25 * avgTier, 0, 1),
      hiz: clamp(1.1 * (1 - angryFrac) - 0.3 + 0.04 * K.hiredCount(), 0, 1),
      siklik: clamp(rt.siklik / 100, 0, 1),
      sohret: clamp(T0.customers / 110 + 0.03 * regs + 0.01 * Object.keys(S.ach).length + 0.1 * (S.stage - 1) + 0.08 * sinav, 0, 1),
      temizlik: clamp(0.85 - T0.dirtyT / Math.max(60, P.GAME_DAY_S * Math.max(1, K.tablesBuilt())) * 1.5, 0.2, 1),
    };
  }
  const starReport = () => ({ stations: stationCount(), workers: S.workers.length, grades: S.grades, plaque: S.plaque || 0, gurme: !!S.gurmePass, tadilat: S.stage - 1, pads: Object.keys(S.owned).filter(k => S.owned[k]).length });
  function updateKarne(): void {
    const sc = gradeScores();
    for (const g of GRADES) S.grades[g.id] = Math.max(S.grades[g.id] || 1, grade5(sc[g.id]));
    const st = starsFor(starReport());
    if (st > S.stars) {
      for (let s = S.stars + 1; s <= st; s++) { S.gold += P.AS_STAR; S.money += 1500 * S.stage; K.addXP(P.XP.star); }
      S.stars = st; K.statMax('stars', st);
      K.toast('★ ' + st + '. yıldız! Büfe karnesi parlıyor.', 'good'); K.logEv('star', { stars: st });
    }
  }
  let kasa: { week: number; total: number; bonus: number; trophy: { id: string; name: string }; t: number } | null = null;
  let kasaBekle: { week: number; total: number; bonus: number; trophy: { id: string; name: string } } | null = null;
  function weeklyCount(): void {
    const week = Math.floor((S.day - 1) / P.WEEK_GAME_DAYS);
    const bonus = Math.round(Math.max(150, K.incomePerMin() * P.KASA_MIN));
    const tr = TROPHIES[(week - 1) % TROPHIES.length];
    const total = Math.round(S.week.earned || 0);
    K.logEv('kasaStart', { week, total, bonus });
    if (S.level < 7) { (K.earnTam || K.earn)(bonus); K.toast('Hafta bitti! Kasa: ' + fmtMoney(total) + ', bonus ' + fmtMoney(bonus), 'good'); S.week = { earned: 0, customers: 0 }; K.stat('kasaCount'); return; }
    kasaBekle = { week, total, bonus, trophy: { id: tr.id, name: tr.name } };
    // Gün sonu kartı açıkken kasa sayımı üst üste binmesin: kart kapanınca (yeniGun) başlar.
    if (rt.pauseWhy !== 'gunSonu') baslatKasa();
  }
  function baslatKasa(): void {
    if (!kasaBekle) return;
    const b = kasaBekle; kasaBekle = null;
    rt.paused = true; rt.pauseWhy = 'kasa';
    kasa = { ...b, t: 0 };
    rt.uiLast.kasaSayimi = { week: b.week, total: b.total, bonus: b.bonus, trophy: b.trophy };
  }
  function finishKasa(): void {
    if (!kasa) return;
    const k = kasa; kasa = null; rt.paused = false; rt.pauseWhy = ''; delete rt.uiLast.kasaSayimi;
    S.money += k.bonus; S.gold += P.AS_WEEKLY; K.stat('kasaCount');
    S.week = { earned: 0, customers: 0 };
    K.toast('Kasa sayıldı! Bonus ' + fmtMoney(k.bonus) + ' ve ' + P.AS_WEEKLY + ' Altın Simit. Kupa: ' + k.trophy.name, 'good');
    K.logEv('kasaDone', { week: k.week, bonus: k.bonus });
    K.saveNow();
  }
  function onNewDay(): void {
    const fan = S.workers.find(w => w.trait === 'futbol');
    if (fan) {
      S.teamDay = S.day; S.teamWin = K.R.main.chance(0.5);
      const team = TEAMS.find(t => t.id === fan.team) || TEAMS[0];
      K.toast(S.teamWin ? team.name + ' kazandı! ' + fan.name + ' bugün %30 hızlı.' : team.name + ' berabere kaldı. ' + fan.name + ' biraz dalgın.', 'info');
    }
    K.syncOrders();
  }
  function endDay(): void {
    const T0 = S.today!, day = S.day;
    updateKarne();
    const TX = T0 as unknown as { sales?: number; cost?: number; sold?: Record<string, number>; salonGelir?: number; salonMis?: number; masaServis?: number; masaBekleS?: number };
    const ham = S.workers.map(w => ({ id: w.id, ad: w.name, maas: (w as { paidToday?: number }).paidToday || 0 }));
    const maas = Math.round(ham.reduce((a, w) => a + w.maas, 0)), ekip = S.workers.length;
    S.workers.forEach(w => { (w as { paidToday?: number }).paidToday = 0; });
    // BUF-10: the waiters' shared tip jar is split at day end (restoran.ts); not player income, one report row
    const bahsis = (rt as unknown as { restoran?: { kumbaraDagit?(day: number): { toplam: number; pay: { wid: number; ad: string; tutar: number }[] } | null } }).restoran?.kumbaraDagit?.(day) ?? null;
    // BUF-26: önce dayEnd (gider.ts kira + faturayı keser), SONRA kart modeli: kartın kasası ve gider satırları aynı sayılardır.
    K.logEv('dayEnd', { day, customers: T0.customers, earned: Math.round(T0.earned), angry: T0.angry, money: Math.round(S.money) });
    const gs = rt.uiLast.giderSon as { day: number; kira: number; fatura: number; birimMaliyet: number; paid: number; due: number; ertelendi: number } | undefined;
    const gider = gs && gs.day === day ? { kira: gs.kira, fatura: gs.fatura, odenen: gs.paid, ertelendi: gs.ertelendi } : undefined;
    const kisiler = ham.map(w => ({ ad: w.ad, maas: Math.round(w.maas), bahsis: bahsis?.pay.find(p => p.wid === w.id)?.tutar || 0 }));
    // survey 2026-10-24 (reversed): at 03:00 the screen fades and the gün sonu card shows the day's ciro; the next
    // day starts behind it (morning) and the sim waits until the player presses "Yeni güne başla".
    const best = rt.dayHistory.reduce((m, d) => Math.max(m, d.earned), 0);
    // earned = brüt - personel payı - birim maliyet + yan gelir (salon/teras, günlük kazanç tavanlı bonus): satırlar buradan türer
    const brut = Math.round((TX.sales || 0) + ham.reduce((a, w) => a + w.maas, 0)), birimMaliyet = Math.round(TX.cost || 0);
    const yan = Math.round(T0.earned) - (brut - maas - birimMaliyet), salon = Math.round(TX.salonGelir || 0);
    // opsiyonel: işletme maaşları (DKN kolu) ve hijyen/müfettiş/Martı yıldızı (veri sonra gelir; yoksa kart satırı gizlenir)
    const im = rt.uiLast.isletmeMaas as { gun?: number; toplam?: number; odenen?: number; satirlar?: { ad: string; tutar: number; odenen: boolean | number }[] } | undefined;
    const hj = rt.uiLast.hijyenGun as { day?: number; not?: string | number; mufettis?: string; marti?: number } | undefined;
    const netKar = Math.round(T0.earned) - (gider ? gider.odenen : 0);
    if ((rt as unknown as { gunSonuCard?: boolean }).gunSonuCard) {
    rt.uiLast.gunSonu = { day, earned: Math.round(T0.earned), customers: T0.customers, angry: T0.angry, money: Math.round(S.money), record: Math.round(T0.earned) > best && day > 1, maas, ekip, sold: { ...(TX.sold || {}) }, borc: Math.floor((S.zones.arsa as { kredi?: { borc?: number } } | undefined)?.kredi?.borc || 0), bahsis: bahsis ? { toplam: bahsis.toplam, kisi: bahsis.pay.length } : undefined,
      brut, birimMaliyet, kisiler, salon: { gelir: salon, misafir: Math.round(TX.salonMis || 0) }, yan: yan - salon, gider, netKar,
      masa: { servis: TX.masaServis || 0, bekleS: TX.masaServis ? Math.round((TX.masaBekleS || 0) / TX.masaServis) : 0 },
      isletme: im && im.gun === day && im.satirlar && im.satirlar.length ? { toplam: Math.round(im.toplam || 0), odenen: Math.round(im.odenen || 0), satirlar: im.satirlar } : undefined,
      hijyen: hj && hj.day === day ? { not: hj.not, mufettis: hj.mufettis, marti: hj.marti } : undefined };
    rt.paused = true; rt.pauseWhy = 'gunSonu';
    }
    rt.dayHistory.push({ day, earned: Math.round(T0.earned), customers: T0.customers });
    S.day++; S.dayT = 0; S.today = newToday();
    onNewDay();
    if ((S.day - 1) % P.WEEK_GAME_DAYS === 0) weeklyCount();
    K.saveNow();
  }
  function update(dt: number): void {
    if (kasa) { kasa.t += dt; }
    else if (kasaBekle && rt.pauseWhy !== 'gunSonu') baslatKasa();
    if (S.dayT >= P.GAME_DAY_S) endDay();
    const d = dirtyTables(); if (d) S.today!.dirtyT += dt * d;
  }
  return { update, endDay, updateKarne, gradeScores, finishKasa, hasKasa: () => !!kasa, kasaTick(dt: number) { if (!kasa && kasaBekle && rt.pauseWhy !== 'gunSonu') baslatKasa(); if (kasa) { kasa.t += dt; if (kasa.t > 30) finishKasa(); } } };
}
