/** Esnaf Yatırımları (content/yatirim.ts): levels live in state.zones.yatirim = { id: level }. Pure sim helpers + command. */
import { YATIRIM, YATIRIM_MAX, yatirimDef } from '../../content/yatirim';
import { fmtTL } from '../../content/ekonomi2';
import type { GameState } from './schema';
import type { Kernel } from './state';

type Z = Record<string, number>;
const zOf = (S: { zones?: Record<string, Record<string, unknown>> }): Z => ((S.zones ??= {}).yatirim ??= {}) as unknown as Z;
/** Current level of an investment (0 = none). */
export const yatirimLv = (S: { zones?: Record<string, Record<string, unknown>> }, id: string): number => Math.max(0, Math.min(YATIRIM_MAX, Math.floor(Number(S.zones?.yatirim?.[id]) || 0)));
/** Total effect (level × perLevel) of an investment. */
export const yatirimFx = (S: { zones?: Record<string, Record<string, unknown>> }, id: string): number => yatirimLv(S, id) * (yatirimDef(id)?.perLevel ?? 0);

export function yatirimModel(S: GameState) {
  return YATIRIM.map(y => {
    const lv = yatirimLv(S, y.id), next = lv < YATIRIM_MAX ? y.cost[lv] : null;
    return { id: y.id, name: y.name, desc: y.desc, icon: y.icon, level: lv, max: YATIRIM_MAX, unit: y.unit, effect: Math.round(lv * y.perLevel * 100), nextEffect: Math.round(Math.min(YATIRIM_MAX, lv + 1) * y.perLevel * 100),
      cost: next, needStage: lv < YATIRIM_MAX ? lv + 1 : null, locked: lv < YATIRIM_MAX && (S.stage || 1) < lv + 1 };
  });
}

export function installYatirim(K: Kernel) {
  const S = K.state;
  return {
    buy(id: string): boolean {
      const y = yatirimDef(id); if (!y) return false;
      const lv = yatirimLv(S, id);
      if (lv >= YATIRIM_MAX) { K.toast(y.name + ' zaten son seviyede.', 'info'); return false; }
      if ((S.stage || 1) < lv + 1) { K.toast(y.name + ' ' + (lv + 1) + '. seviye için ' + (lv + 1) + '. kademe büfe gerekir.', 'info'); return false; }
      const cost = y.cost[lv];
      if (S.money < cost) { K.toast('Biraz daha para lazım: ' + fmtTL(cost), 'info'); return false; }
      K.spend(cost); zOf(S)[id] = lv + 1; K.stat('yatirim');
      K.toast(y.name + ' ' + (lv + 1) + '. seviye! (+%' + Math.round((lv + 1) * y.perLevel * 100) + ' ' + y.unit + ')', 'good'); K.logEv('yatirim', { id, level: lv + 1, cost }); K.saveNow();
      return true;
    },
  };
}
