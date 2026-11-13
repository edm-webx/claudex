/**
 * Stations (v2 STN): trays of finished products, worker production, player pickup/prep via the dwell rule.
 * Owner: Builder A. Pure. Positions come from B's pure layout data (stageLayout); the stand-at point uses a fixed
 * station depth (0.8 m) because the exact depth lives in B's three-based station model (error below the 0.85 m radius).
 * Dwell rule: `station.<k>` interactable at the stand-at point, dwell 0.4 s, then a transfer every 0.18 s.
 */
import { mutfakEtki } from '../../content/mutfak';
import type { Vec2, Interactable } from '../../engine/api';
import { yetenekFxOf } from './yetenek';
import { DWELL_DEFAULTS } from '../../engine/api';
import type { StageLayout } from '../../content/prefabs/iskele/layout';
import { local2world } from '../../content/prefabs/iskele/layout';
import { PRODUCT_IDS, PRODUCTS, STATIONS } from '../../content/products';
import type { ProductId } from './schema';
import type { Kernel, Item, StationApi } from './state';

const D_ST = 0.8;
export function stationPose(L: StageLayout, k: ProductId): { x: number; z: number; ry: number } {
  const s = L.stations[k];
  return { x: s.x, z: s.z != null ? s.z : -2.75 - 0.42 - D_ST / 2, ry: s.rotY };
}
export function standAt(L: StageLayout, k: ProductId): Vec2 {
  const p = stationPose(L, k);
  const w = local2world(p.x, p.z, p.ry, 0, D_ST / 2 + 0.42);
  return { x: w.x, z: w.z };
}
export function outAt(L: StageLayout, k: ProductId): Vec2 {
  const p = stationPose(L, k);
  const w = local2world(p.x, p.z, p.ry, 0.3, 0.1);
  return { x: w.x, z: w.z };
}

export function installStations(K: Kernel): { api: StationApi; register(): void; unregister(k: ProductId): void; carryCap(): number } {
  const rt = K.rt, S = K.state;
  const carryCap = () => 4 + (S.owned.tepsi1 ? 2 : 0) + (S.owned.tepsi2 ? 2 : 0);
  const reservedNeeds = (): Partial<Record<ProductId, number>> => {
    const r: Partial<Record<ProductId, number>> = {};
    for (const fn of rt.reserved) { let o; try { o = fn(); } catch { o = {}; } for (const p in o) r[p as ProductId] = (r[p as ProductId] || 0) + (o[p as ProductId] || 0); }
    if (rt.window && rt.window.open) rt.winq.slice(0, 3).forEach(c => { const l = K.orderLeft(c); for (const p in l) r[p as ProductId] = (r[p as ProductId] || 0) + (l[p as ProductId] || 0); });
    return r;
  };
  /** Sabri'nin Evi: rested Sabri works a bit faster in the morning (rt.restBoost, capped, set by dekor-ev.ts). */
  const restX = () => (1 + Math.min(0.1, Math.max(0, (rt as unknown as { restBoost?: number }).restBoost || 0))) * (1 + yetenekFxOf(rt).station) * (1 + mutfakEtki(S.workers).hiz);   // + class skill (yetenek.ts)
  const carryCount = (p: ProductId) => rt.carry.reduce((n, it) => n + (it.type === p ? 1 : 0), 0);
  const newItem = (p: ProductId, extra?: Partial<Item>): Item => ({ type: p, tier: S.tiers[p] || 1, ...extra });
  const onPick = (it: Item) => {
    K.logEv('pick', { type: it.type });   // one sound per item really picked up (act() also runs while cutting)
    if (it.type === 'doner' && !S.tut.firstCut) { S.tut.firstCut = 1; K.logEv('firstCut'); }
    if (it.type === 'cay' && !S.tut.cayUsed) { S.tut.cayUsed = 1; K.logEv('cayUsed'); }
  };
  const api: StationApi = {
    isBuilt: k => !!rt.stations[k]?.built,
    operate(k, wid, dt, speed = 1, priceX = 1) {
      const st = rt.stations[k];
      if (!st || !st.built || st.out.length >= 8) return 0;
      st.opT = K.ctx.t;
      const p = (st.prog[wid] || 0) + dt * speed / PRODUCTS[k].prep;
      if (p >= 1) { st.prog[wid] = 0; st.out.push(newItem(k, { by: wid, priceX })); return 1; }
      st.prog[wid] = p;
      return 0;
    },
    outCount: k => rt.stations[k].out.length,
    outFull: k => rt.stations[k].out.length >= 8,
    takeOut(k, carrier) { const it = rt.stations[k].out.pop(); if (!it) return null; it.carrier = carrier; return it; },
    isGrab: k => !!STATIONS[k].grab,
    grabTime: k => Math.max(0.3, PRODUCTS[k].prep * 0.55),
    makeGrab: (k, carrier) => newItem(k, { carrier }),
  };
  const ids: string[] = [];
  const state = { work: 0, workSt: '' as string, lastAct: -99, fullT: -99, msgT: -99 };
  const register = () => {
    for (const k of PRODUCT_IDS) {
      const id = 'station.' + k;
      if (ids.includes(id) || !rt.stations[k].built) continue;
      ids.push(id);
      const it: Interactable = {
        id, pos: standAt(rt.layout, k), radius: 0.6, kind: 'station', dwell: DWELL_DEFAULTS.station, interval: 0.1,
        canAct: () => {
          if (k === 'doner' && !S.tut.firstCut && rt.movedTotal < 0.5) return false;
          if (rt.carry.length >= carryCap()) return false;
          return 8 - rt.counter[k].length + (reservedNeeds()[k] || 0) - carryCount(k) > 0;
        },
        act: (_a, ctx) => {
          const st = rt.stations[k], prod = PRODUCTS[k];
          if (state.workSt !== k) { state.workSt = k; state.work = 0; }
          const el = ctx.t - state.lastAct < 0.5 ? ctx.t - state.lastAct : DWELL_DEFAULTS.station + 0.1;   // the dwell time counts as work already done
          if (ctx.t - state.lastAct >= 0.5) state.work = 0;
          state.lastAct = ctx.t;
          it.pos = standAt(rt.layout, k);
          if (rt.carry.length >= carryCap()) { state.work = 0; if (ctx.t - state.fullT > 3) { state.fullT = ctx.t; K.bus.emit('toast', { text: 'Eller dolu!', kind: 'info' }); } return 'continue'; }
          const room = 8 - rt.counter[k].length + (reservedNeeds()[k] || 0) - carryCount(k);
          if (room <= 0) { state.work = 0; if (ctx.t - state.fullT > 3) { state.fullT = ctx.t; K.bus.emit('toast', { text: 'Tezgahta yer yok, önce sat!', kind: 'info' }); } return 'continue'; }
          if (st.out.length) { const x = st.out.pop()!; rt.carry.push(x); state.work = 0; onPick(x); return 'continue'; }
          if (STATIONS[k].grab) {
            state.work += el * restX() / Math.max(0.3, prod.prep * 0.5); rt.act = STATIONS[k].act as string; rt.actT = 0.4;
            if (state.work >= 1) { state.work = 0; const x = newItem(k); rt.carry.push(x); onPick(x); }
            return 'continue';
          }
          if (ctx.t - st.opT < 0.4) { state.work = 0; return 'continue'; }   // a worker is on it
          rt.act = prod.ritual === 'pour' ? 'pour' : 'cut'; rt.actT = 0.4;
          state.work += el * restX() / prod.prep;
          if (state.work >= 1) { state.work = 0; const x = newItem(k); rt.carry.push(x); onPick(x); }
          return 'continue';
        },
      };
      K.interactions.register(it);
    }
  };
  return { api, register, unregister(k) { const i = ids.indexOf('station.' + k); if (i >= 0) { ids.splice(i, 1); K.interactions.unregister('station.' + k); } }, carryCap };
}
export { };
