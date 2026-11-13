/** Adapter: A's `Rules` -> the narrow `AgentHost` the agents layer codes against. Pure. */
import { pencereWid } from '../window';
import { restoranApi } from '../restoran';
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
      const out: { index: number; x: number; z: number }[] = [];
      rt.tables.forEach((t, i) => { if (t.built && t.dirty > 0) { const l = rt.layout.tables[i]; out.push({ index: i, x: l.x, z: l.z }); } });
      return out;
    },
    cleanTable: (i) => { const t = rt.tables[i]; if (t && t.dirty > 0) { t.dirty = 0; t.dirtyT = 0; r.stat('cleaned'); } },
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
    garsonClaim: (w, n) => restoranApi(r)?.garsonClaim?.(w, n) ?? [],
    garsonOpen: (w) => restoranApi(r)?.garsonOpen?.(w) ?? [],
    garsonDone: (w, id) => restoranApi(r)?.garsonDone?.(w, id) ?? false,
    masaClaim: (w) => restoranApi(r)?.masaClaim?.(w) ?? null,
    masaDone: (w, id) => restoranApi(r)?.masaDone?.(w, id),
    kitchenClaim: (w) => restoranApi(r)?.kitchenClaim?.(w) ?? null,
    kitchenDone: (w, ok) => restoranApi(r)?.kitchenDone?.(w, ok),
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
