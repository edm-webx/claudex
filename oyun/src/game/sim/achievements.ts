/** Stats counters and achievements (v2 stat/statMax/checkAch/awardAch). Owner: Builder A. Pure. */
import { ACHIEVEMENTS } from '../../content/achievements';
import { P } from '../../content/economy';
import type { Kernel } from './state';
export function installAchievements(K: Kernel): { stat(k: string, n?: number): void; statMax(k: string, v: number): void } {
  const S = K.state;
  const check = (k: string) => {
    for (const a of ACHIEVEMENTS) {
      if (a.stat !== k || S.ach[a.id]) continue;
      if ((S.stats[k] || 0) >= a.goal) {
        S.ach[a.id] = Math.round(S.playT);
        S.gold += P.AS_ACH; if (S.level >= 3) S.money += 600 * S.stage; K.addXP(P.XP.ach);   // 2026-10-25 user: quests pay coins too
        K.logEv('ach', { id: a.id, title: a.title, text: a.text, reward: '+' + P.AS_ACH + ' Altın Simit' + (S.level >= 3 ? ' + ' + 600 * S.stage + ' ₺' : '') });
      }
    }
  };
  return {
    stat(k, n) { S.stats[k] = (S.stats[k] || 0) + (n == null ? 1 : n); check(k); },
    statMax(k, v) { if ((S.stats[k] || 0) < v) { S.stats[k] = v; check(k); } },
  };
}
