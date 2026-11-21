/** Welcome back: kepenk earnings while away (v2 welcomeBack). The caller supplies the away time (wall clock lives outside the sim). Owner: Builder A. Pure. */
import { P, offlineEarnings } from '../../content/economy';

import { LINES } from '../../content/lines';
import type { Kernel } from './state';
import { clamp, fmtMoney } from './util';

/** Survey 2026-10-24: off. Only the tadilat clock still runs while away. */
const OFFLINE_ON = false;

export const fmtAway = (s: number): string => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ' saat ' : '') + m + ' dk'; };

export function installOffline(K: Kernel) {
  const rt = K.rt, S = K.state;
  const idleRatePerMin = () => (S.rate || 0) * clamp(0.2 + 0.12 * S.workers.length, 0.2, 0.8);
  let pending: { amount: number } | null = null;
  function welcome(away: number): { amount: number; capped: boolean; capH: number } | null {
    if (away < P.WELCOME_MIN_S || away > 3600 * 24 * 60) return null;
    const t = S.tadilat as unknown as { left?: number } | null;
    if (t && typeof t.left === 'number') t.left = Math.max(0.1, t.left - away);
    // Survey 2026-10-24: no offline earnings ("çevrimdışı kazanç yok"), so no welcome card. Flip OFFLINE_ON to bring it back.
    if (!OFFLINE_ON) return null;
    const off = offlineEarnings(away, idleRatePerMin(), S.kepenk);
    // ekonomi-3: the PaketMartı courier line keeps earning at 50 % while the kepenk is down (sim/kurye.ts)
    try { const ky = (rt as unknown as { kurye?: { offline(a: number): number } }).kurye; if (ky) off.amount += Math.max(0, Math.floor(ky.offline(away) * 0.05) || 0); /* Faz 2: offline ~nothing */ } catch { /* courier line optional */ }
    K.logEv('welcome', { away: Math.round(away), amount: off.amount });
    if (off.amount < 1) return null;
    rt.paused = true; rt.pauseWhy = 'welcome';
    pending = { amount: off.amount };
    K.openOverlay('welcomeBack', { away: fmtAway(away), amount: off.amount, capped: off.capped, capH: off.capH });
    return off;
  }
  function collect(doubled: boolean): void {
    if (!pending) return;
    const v = pending.amount * (doubled ? 2 : 1); pending = null;
    rt.paused = false; rt.pauseWhy = ''; delete rt.uiLast.welcomeBack;
    S.money += v; K.toast(LINES.welcome + ' +' + fmtMoney(v), 'good'); K.logEv('welcomeCollect', { doubled: !!doubled, v });
    K.saveNow();
  }
  return { welcome, collect, idleRatePerMin, isPending: () => !!pending };
}
