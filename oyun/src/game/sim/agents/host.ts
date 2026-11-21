/** Adapter: A's `Rules` -> the narrow `AgentHost` the agents layer codes against. Pure. */
import { pencereWid } from '../window';
import { restoranApi } from '../restoran';
import { teslimatApi } from '../kurye';
import type { Vec2 } from '../../../engine/api';
import type { Rules } from '../state';
import type { ProductId } from '../schema';
import { PRODUCT_IDS } from '../schema';
import { LINES } from '../../../content/lines';
import type { AgentHost, CarryItem } from './types';

export function hostFromRules(r: Rules): AgentHost {
  const rt = r.rt, st = r.state;
  const laughRng = r.rng('laugh');
  return {
    hour: () => r.hour(),
    windowPost: () => { const wid = pencereWid(st); return wid && rt.window && rt.window.open ? { wid, at: rt.layout.window.standAt } : null; },
    setPencereAt: (on) => { (rt as unknown as { pencereAt?: boolean }).pencereAt = on; },
    player: () => ({ x: r.playerPos.x, z: r.playerPos.z, moving: rt.moving }),
    stationBuilt: (p) => !!rt.stations[p]?.built,
    openProducts: () => PRODUCT_IDS.filter((p) => rt.stations[p]?.built),
    tablesBuilt: () => rt.tables.filter((t) => t.built).length,
    dirtyTables: () => {
      const out: { index: number; x: number; z: number; age: number }[] = [];
      rt.tables.forEach((t, i) => { if (t.built && t.dirty > 0) { const l = rt.layout.tables[i]; out.push({ index: i, x: l.x, z: l.z, age: t.dirtyT || 0 }); } });   // BUF-20 / 2026-11-21: çatı masasını temizlikçi de siler (merdivenden çıkar, workers.ts goVia çatı rotası)
      return out;
    },
    cleanTable: (i) => { const t = rt.tables[i]; if (t && t.dirty > 0) { (rt as unknown as { bulasik?: { masaSilindi(i: number): void } }).bulasik?.masaSilindi(i); t.dirty = 0; t.dirtyT = 0; r.stat('cleaned'); } },
    need: () => r.counterApi.need(),
    counterStock: (p) => r.counterApi.count(p),
    counterFree: (p) => r.counterApi.count(p) < 8,
    queueLength: () => rt.queue.length,
    operate: (p, w, dt, sp, px) => r.stations.operate(p, w, dt, sp, px),
    dropLast: (p) => { rt.stations[p].out.pop(); },
    outCount: (p) => r.stations.outCount(p),
    outFull: (p) => r.stations.outFull(p),
    takeOut: (p, c) => r.stations.takeOut(p, c),
    isGrab: (p) => r.stations.isGrab(p),
    grabTime: (p) => r.stations.grabTime(p),
    makeGrab: (p, c) => r.stations.makeGrab(p, c),
    counterPut: (it) => r.counterApi.put(it),
    isAl: (w, o) => restoranApi(r)?.isAl?.(w, o) ?? null,
    tabakAl: (w) => restoranApi(r)?.tabakAl?.(w) ?? [],
    tepsi: (w) => restoranApi(r)?.tepsi?.(w) ?? [],
    isTamam: (w, id, at) => restoranApi(r)?.isTamam?.(w, id, at) ?? { durum: 'yok' },
    tabakGeri: (w) => restoranApi(r)?.tabakGeri?.(w) ?? 0,
    isBirak: (w) => restoranApi(r)?.isBirak?.(w),
    passDurak: (w) => restoranApi(r)?.passDurak?.(w) ?? null,
    garsonPost: (w) => restoranApi(r)?.garsonPost?.(w) ?? null,
    kitchenClaim: (w, o) => restoranApi(r)?.kitchenClaim?.(w, o) ?? null,
    kitchenDone: (w, ok) => restoranApi(r)?.kitchenDone?.(w, ok),
    kitchenIst: (w) => restoranApi(r)?.kitchenIst?.(w) ?? null,
    kitchenSure: (w) => restoranApi(r)?.kitchenSure?.(w) ?? 0,
    kitchenReady: (w) => restoranApi(r)?.kitchenReady?.(w) ?? false,
    kitchenTasi: (w, o) => restoranApi(r)?.kitchenTasi?.(w, o) ?? null,
    kitchenTasiAl: (w) => restoranApi(r)?.kitchenTasiAl?.(w) ?? null,
    kitchenPass: (w) => restoranApi(r)?.kitchenPass?.(w) ?? false,
    kitchenDrop: (w) => restoranApi(r)?.kitchenDrop?.(w),
    dishCount: () => rt.dirtyDishes || 0,
    kasaMesgul: () => rt.kasaQueue.length > 0,
    dishWash: () => !!(rt as unknown as { bulasik?: { wash(): boolean } }).bulasik?.wash(),
    dishCeza: () => (rt as unknown as { bulasik?: { ceza(): number } }).bulasik?.ceza() ?? 1,
    setMutfakBusy: (n) => { rt.mutfakBusy = n; },
    setMutfakMop: (on) => { rt.mutfakMop = on; },
    kitchenDevir: (w) => restoranApi(r)?.kitchenDevir?.(w) ?? null,
    kitchenBekleyen: (y) => restoranApi(r)?.kitchenBekleyen?.(y) ?? false,
    paketHazir: () => !!teslimatApi(r)?.hazirVar(),
    paketAl: (w) => (teslimatApi(r)?.al(w) as CarryItem<import('../../../content/yemek-menu').FoodId>[] | null | undefined) ?? null,
    paketAdres: (w) => teslimatApi(r)?.adres(w) ?? null,
    paketTeslim: (w) => teslimatApi(r)?.teslim(w) ?? 0,
    paketBirak: (w) => teslimatApi(r)?.birak(w),
    playerHas: (p) => r.carry.count(p) > 0,
    playerTake: (p) => r.carry.takeFromPlayer(p),
    settle: (items, at) => r.salesApi.settle(items, { direct: true, at }),
    earn: (v, at) => r.earn(v, at),
    kasaCount: () => r.moneyApi.kasaCount(),
    kasaValue: () => r.moneyApi.kasaValue(),
    grabHalf: () => r.moneyApi.grabHalf(),
    dropFloor: (v, x, z) => r.moneyApi.dropFloor(v, x, z),
    addOwedBack: (v) => r.moneyApi.addOwedBack(v),
    addToKasa: (v) => r.moneyApi.addToKasa(v),
    counterTake: (p) => r.counterApi.take(p, 1, 'gull').length > 0,
    venueMult: () => r.venueMult(),
    toast: (t, k) => r.toast(t, k),
    stat: (k, n) => r.stat(k, n),
    statMax: (k, v) => r.statMax(k, v),
    heroSay: (t, s) => { rt.say = t; rt.sayT = s ?? 1.8; },
    heroAct: (a, t) => { rt.act = a; rt.actT = t; },
    tipBoost: (s) => { rt.tipBoostT = s;
    },
    addFollowers: (n) => { rt.followers += n; },
    laughNearby: () => {
      let n = 0;
      for (const c of rt.customers) { if (n >= 3) break; if (c.state === 'queue' || c.state === 'eat') { c.say = laughRng.pick(LINES.laugh); c.sayT = 2; n++; } }
    },
    hero: () => (st.hero === 'sabriye' ? 'sabriye' : 'sabri'),
    windowOpen: () => !!rt.window?.open,
  };
}
export type { Vec2, ProductId, CarryItem };
