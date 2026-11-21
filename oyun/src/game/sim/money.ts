/**
 * Money piles: kasa (cash pile), table tips, floor money (after a kapkaç escape), pickup by the player.
 * Owner: Builder A. Pure. v2: stacks carry a value, piles show at most 30 stacks and merge the rest into random ones.
 * Dwell: `kasa` (radius 0.55 + magnet range), `table.<i>` (radius 1.5; tips within 0.75 + magnet, plates within 1.5)
 * and `floor.<n>` interactables, dwell 0.1 s then 4 stacks per 0.06 s (v2 took one stack per tick).
 */
import { DWELL_DEFAULTS } from '../../engine/api';
import { P } from '../../content/economy';
import type { Kernel, MoneyApi, MoneyStack } from './state';
import { dist2d, clamp } from './util';

export function installMoney(K: Kernel): { api: MoneyApi; addMoneyTo(pile: MoneyStack[], value: number): void; magnetR(): number; register(): void; syncTables(): void } {
  const rt = K.rt, S = K.state;
  const magnetR = () => P.MAGNET_M[clamp(S.magnet | 0, 0, 4)];
  function addMoneyTo(pile: MoneyStack[], value: number): void {
    if (value <= 0) return;
    const cap = P.MONEY_STACKS_MAX;
    const parts = value >= 400 ? 3 : value >= 90 ? 2 : 1;
    for (let k = 0; k < parts; k++) {
      const v = value / parts;
      if (pile.length >= cap) { pile[Math.floor(K.R.money.next() * pile.length)].value += v; continue; }
      pile.push({ value: v });
    }
  }
  const sum = (p: MoneyStack[]) => p.reduce((s, x) => s + x.value, 0);
  let floorSeq = 0;
  const api: MoneyApi = {
    kasaCount: () => rt.kasa.length,
    kasaValue: () => sum(rt.kasa),
    grabHalf() {
      const n = Math.max(1, Math.ceil(rt.kasa.length / 2));
      let v = 0;
      for (let i = 0; i < n && rt.kasa.length; i++) v += rt.kasa.pop()!.value;
      return v;
    },
    dropFloor(value, x, z) {
      const id = 'floor.' + (floorSeq++);
      const f = { value, x, z, id } as { value: number; x: number; z: number; id: string };
      rt.floor.push(f);
      K.interactions.register({
        id, pos: { x, z }, radius: 0.6, kind: 'pickup', dwell: 0, passBy: true, canAct: () => rt.floor.includes(f),
        act: () => {
          const i = rt.floor.indexOf(f);
          if (i >= 0) { rt.floor.splice(i, 1); S.money += f.value; K.stat('moneyMax', 0); K.statMax('moneyMax', S.money); }
          K.interactions.unregister(id);
          return 'done';
        },
      });
    },
    addOwedBack(v) { S.owedBack = (S.owedBack || 0) + v; },
    addToKasa(v) { addMoneyTo(rt.kasa, v); },
  };
  const collect = (pile: MoneyStack[], n: number): number => {
    let got = 0;
    for (let i = 0; i < n && pile.length; i++) got += pile.shift()!.value;
    if (got > 0) { S.money += got; if (!S.tut.firstCollect) { S.tut.firstCollect = 1; K.logEv('firstCollect'); } K.statMax('moneyMax', S.money); }
    return got;
  };
  let reg = false;
  const tableIds: string[] = [];
  const register = () => {
    if (reg) return; reg = true;
    K.interactions.register({
      id: 'kasa', pos: rt.layout.kasa.pile, radius: 0.55, kind: 'pickup', dwell: 0, interval: 0.06, passBy: true,
      canAct: () => rt.kasa.length > 0,
      act: () => { collect(rt.kasa, 4); return rt.kasa.length ? 'continue' : 'done'; },
    });
  };
  const syncTables = () => {
    rt.layout.tables.forEach((tb, i) => {
      const id = 'table.' + i;
      const pos = { x: tb.x, z: tb.z };
      const ex = K.interactions.get(id);
      if (ex) { ex.pos = pos; const tp = K.interactions.get('tip.' + i); if (tp) { tp.pos = pos; tp.radius = 0.75 + magnetR() + 0.4; } return; }
      tableIds.push(id);
      // tips on the table: pass-by money pickup (owner: money never needs a stop)
      K.interactions.register({
        id: 'tip.' + i, pos, radius: 0.75 + magnetR() + 0.4, kind: 'pickup', dwell: 0, interval: 0.06, passBy: true,
        canAct: () => { const t = rt.tables[i]; return !!t && t.built && t.pile.length > 0; },
        act: () => { const t = rt.tables[i]; if (t) collect(t.pile, 4); return 'continue'; },
      });
      // dirty plates: a short stop to clean (dwell rule)
      K.interactions.register({
        id, pos, radius: 1.5, kind: 'table', dwell: DWELL_DEFAULTS.table, interval: 0.1,
        canAct: () => { const t = rt.tables[i]; return !!t && t.built && t.dirty > 0; },
        act: () => {
          const t = rt.tables[i]; if (!t) return 'done';
          if (t.dirty > 0) { t.dirty = 0; t.dirtyT = 0; K.stat('cleaned'); }
          return 'done';
        },
      });
    });
  };
  // keep the kasa radius in step with the magnet level
  const tune = () => { const k = K.interactions.get('kasa'); if (k) { k.radius = 0.55 + magnetR(); k.pos = rt.layout.kasa.pile; } };
  return { api, addMoneyTo, magnetR, register: () => { register(); tune(); }, syncTables };
}
