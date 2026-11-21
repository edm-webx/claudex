/** Tadilat (renovation), tier upgrades, plaque, kepenk, magnet (v2 startTadilat..buyMagnet). Owner: Builder A. Pure. */
import { KIOSK_STAGES } from '../../content/stages';
import { STAGE_TABLES } from '../../content/pads';
import { P, skipGold } from '../../content/economy';
import { PRODUCT_IDS, PRODUCTS, TIER_NAMES, tierCost } from '../../content/products';
import { TRAITS } from '../../content/traits';
import { LINES } from '../../content/lines';
import type { ProductId } from './schema';
import type { Kernel } from './state';
import { fmtMoney } from './util';

type Tad = { part: string; endsAt: number; to: number; left: number; total: number; self?: boolean };

export function installTadilat(K: Kernel) {
  const rt = K.rt, S = K.state;
  const nextStage = () => KIOSK_STAGES[S.stage] || null;
  K.tadilatReady = () => {
    if (S.tadilat) return false;
    const n = nextStage(); if (!n || n.soon || !n.cost) return false;
    return S.stars >= ((n.req && n.req.stars) || 0);
  };
  function finish(): void {
    const t = S.tadilat as unknown as Tad; const to = t.to; S.tadilat = null;
    S.stage = to; S.renewed = [];
    (STAGE_TABLES[to] || []).forEach(i => K.setTableBuilt(i, true));
    K.stat('tadilat'); K.addXP(P.XP.tadilat); S.gold += P.AS_TAD; S.money += 3000 * to;
    K.toast(LINES.tadilat.done + ' Artık: ' + KIOSK_STAGES[to - 1].short + '! Gelir ×' + P.TAD_TOTAL[to - 1] + (t.self ? ' (kendin kurdun, emeğin kazandı)' : ''), 'good');
    K.logEv('tadilatDone', { stage: to });
    K.bus.emit('stage', { stage: to });
    K.onLayout(); K.refreshSiklik(); K.saveNow();
  }
  // Faz 2 (kendin kur): the owner does the work with own hands. Half the price, twice the time, no crew.
  K.startTadilat = (paid: boolean, self = false) => {
    const n = nextStage(); if (!n || n.soon || S.tadilat) return false;
    if (S.stars < ((n.req && n.req.stars) || 0)) { K.toast('Önce ' + n.req!.stars + ' yıldız lazım.', 'info'); return false; }
    const cost = self ? Math.round((n.cost || 0) / 2) : (n.cost || 0), time = self ? n.timeS * 2 : n.timeS;
    if (!paid) { if (S.money < cost) { K.toast('Tadilat için ' + fmtMoney(cost) + ' lazım.', 'bad'); return false; } K.spend(cost); }
    S.tadilat = { part: 'stage' + n.id, endsAt: S.playT + time, to: n.id, left: time, total: time, self } as unknown as typeof S.tadilat;
    K.toast(LINES.tadilat.start, 'good'); K.logEv('tadilatStart', { to: n.id });
    K.saveNow();
    if (time <= 0) finish();
    return true;
  };
  const update = (dt: number) => { const t = S.tadilat as unknown as Tad | null; if (!t) return; t.left -= dt; if (t.left <= 0) finish(); };
  const skip = () => {
    const t = S.tadilat as unknown as Tad | null; if (!t) return;
    const g = skipGold(t.left);
    if (S.gold < g) { K.toast(g + ' Altın Simit lazım.', 'bad'); return; }
    S.gold -= g; finish();
  };
  K.upgradeCost = (p: ProductId) => {
    const t = S.tiers[p]; if (t >= 4) return 0;
    let c = tierCost(p, t + 1);
    if (S.workers.some(w => w.trait === 'cevresi')) c *= 1 - (TRAITS.cevresi.fx.upgradeDiscount || 0);
    return Math.round(c);
  };
  function checkPlaque(): void {
    const open = PRODUCT_IDS.filter(p => rt.stations[p].built);
    if (open.length < PRODUCT_IDS.length) return;
    const minT = Math.min(...open.map(p => S.tiers[p]));
    const pl = Math.max(0, minT - 1);
    if (pl > (S.plaque || 0)) { S.plaque = pl; K.addXP(P.XP.plaque); K.toast('Esnaf Plaketi! Bütün istasyonlar ' + TIER_NAMES[minT - 1] + ': gelir ×2', 'good'); K.logEv('plaque', { plaque: pl }); }
  }
  function upgrade(id: string): void {
    if (id === 'miknatis') {
      const lv = S.magnet + 1, c = P.MAGNET_COST[lv];
      if (!c) return;
      if (S.money < c) { K.toast('Para yetmiyor abi: ' + fmtMoney(c), 'bad'); return; }
      K.spend(c); S.magnet = lv; K.renewNext(); K.toast('Mıknatıs ' + P.MAGNET_M[lv] + ' m oldu!', 'good'); K.saveNow(); return;
    }
    const p = id as ProductId;
    if (!rt.stations[p] || !rt.stations[p].built || S.tiers[p] >= 4) return;
    const c = K.upgradeCost(p);
    if (S.money < c) { K.toast('Para yetmiyor abi: ' + fmtMoney(c), 'bad'); return; }
    K.spend(c); S.tiers[p]++;
    K.addXP(P.XP.buy * 3); K.renewNext();
    K.toast(PRODUCTS[p].tiers[S.tiers[p] - 1].name + ' hazır! (' + TIER_NAMES[S.tiers[p] - 1] + ')', 'good');
    if (p === 'simit' && S.tiers[p] >= 4) K.statMax('simitK4', 1);
    K.logEv('tier', { p, tier: S.tiers[p] });
    checkPlaque(); K.saveNow();
  }
  return { update, skip, upgrade, finish };
}
