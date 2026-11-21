/** Esnaf Seviyesi (XP): addXP, level-up unlocks. Owner: Builder A. Pure. */
import { xpForLevel, LEVEL_UNLOCKS } from '../../content/economy';
import type { Kernel } from './state';
export function installLevels(K: Kernel): (n: number) => void {
  const S = K.state;
  return (n: number) => {
    S.xp += n;
    let need = xpForLevel(S.level);
    while (S.xp >= need) {
      S.xp -= need; S.level++;
      const u = LEVEL_UNLOCKS.find(x => x.level === S.level);
      K.toast('Esnaf Seviyesi ' + S.level + '!' + (u ? ' ' + u.text : ''), 'good');
      K.logEv('level', { level: S.level });
      need = xpForLevel(S.level);
    }
  };
}
