// HUD view (Builder D): reads GameState each render frame and patches the v2-style HUD (engine/ui).
// Same numbers as v2 hudNow(): money floored, clock from dayT (4-min day 08:00..24:00), day progress, stars, level.
// Decision: level progress uses deps.xpForLevel when given (M1 economy), else hidden ring (0).
import type { GameView, Ui } from '../../engine/api';
import { GAME_DAY_S, DAY_START_H, DAY_END_H } from '../../engine/api';
import type { GameState } from '../sim/schema';

export interface HudDeps { ui: Ui; xpForLevel?: (level: number) => number; streak?: () => number; }

export function createHud(deps: HudDeps): GameView {
  const { ui } = deps;
  let last = '';
  return {
    update(state: GameState, _dt: number, _alpha: number) {
      const dp = Math.max(0, Math.min(1, state.dayT / GAME_DAY_S));
      const hour = DAY_START_H + (DAY_END_H - DAY_START_H) * dp;
      const need = deps.xpForLevel ? deps.xpForLevel(state.level) : 0;
      const levelProgress = need > 0 ? Math.max(0, Math.min(1, state.xp / need)) : 0;
      const streak = deps.streak ? deps.streak() : 0;
      // cheap change check (the ui also diffs per field)
      const key = `${Math.floor(state.money)}|${state.gold}|${state.day}|${Math.floor(hour * 6)}|${state.stars}|${state.level}|${levelProgress.toFixed(2)}|${streak}|${state.settings.muted}`;
      if (key === last) return;
      last = key;
      ui.hud({
        money: Math.floor(state.money), gold: state.gold, day: state.day, hour, dayProgress: dp,
        stars: state.stars, level: state.level, levelProgress, streak: streak + (streak > 0 ? 1 : 0), muted: !!state.settings.muted,
      });
    },
    dispose() { /* HUD lives with the ui root */ },
  };
}
