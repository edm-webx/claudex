/** Player flags per tick (moving, stillT, movedTotal, say/act timers) and the job-board proximity (v2 updatePlayer tail). Owner: Builder A. Pure. */
import { dist2d } from './util';
import type { Kernel } from './state';

export function installPlayer(K: Kernel, board: { open(): void; close(): void }, speed: () => number) {
  const rt = K.rt, S = K.state;
  let near = false;
  return {
    update(dt: number): void {
      const m = Math.hypot(K.ctx.input.move.x, K.ctx.input.move.z);
      rt.moving = m > 0.12;
      const sp = speed();
      if (sp > 0.05) { rt.movedTotal += sp * dt; rt.stillT = 0; } else rt.stillT += dt;
      rt.sayT -= dt; rt.actT -= dt;
      if (rt.actT <= 0 && rt.act !== 'idle') rt.act = 'idle';
      if (rt.tipBoostT > 0) rt.tipBoostT -= dt;
      if (S.owned.isbul) {
        const d = dist2d(K.playerPos, rt.layout.job.pos);
        if (d < 1.1 && !near) { near = true; board.open(); }
        else if (d > 2.0 && near) { near = false; if (rt.boardOpen) board.close(); }
      } else near = false;
    },
  };
}
