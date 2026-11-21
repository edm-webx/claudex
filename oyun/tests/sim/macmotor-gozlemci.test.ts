// 10 gözlemci bot: her biri kendi tohumuyla bir maçı baştan sona izler ve takılma / saçma davranış arar.
// Senaryo A (bot-bot): kimse kale çizgisine yapışıp kalmaz, top taşıyıcı çizgide sıkışmaz.
// Senaryo B (insan): oyuncu topla kaleye düz koşar (ortaya ya da kenara), sıkışmadan gol / aut / korner olmalı.
import { describe, it, expect } from 'vitest';
import { createMatch, L, WD } from '../../src/game/sim/macmotor';

const SEEDS = Array.from({ length: 10 }, (_, i) => 1000 + i * 7919);

function observeBots(seed: number) {
  const m = createMatch({ seed, formations: [['2-2', '1-2-1', '2-1-1'][seed % 3], ['2-1-1', '2-2', '1-2-1'][seed % 3]], halfS: 75 }); const dt = 1 / 30;
  const wall = m.pls.map(() => 0); let worst = 0, carrierStuck = 0, ctr = 0;
  for (let i = 0; i < 6000 && !m.over; i++) {
    m.step(dt); if (m.freeze > 0) continue;
    m.pls.forEach((p, k) => {
      const atWall = !p.gk && (p.x < 0.6 || p.x > L - 0.6 || p.y < 0.6 || p.y > WD - 0.6) && Math.hypot(p.vx, p.vy) < 0.8;
      wall[k] = atWall ? wall[k] + dt : 0; worst = Math.max(worst, wall[k]);
    });
    if (m.ball.owner >= 0) { const o = m.pls[m.ball.owner]; const stuck = (o.x < 0.5 || o.x > L - 0.5) && Math.hypot(o.vx, o.vy) < 0.8; ctr = stuck ? ctr + dt : 0; carrierStuck = Math.max(carrierStuck, ctr); } else ctr = 0;
  }
  return { over: m.over, worst, carrierStuck, goals: m.score[0] + m.score[1] };
}

function humanRun(seed: number, aimY: number) {
  const m = createMatch({ seed, human: 0, halfS: 60 }); const dt = 1 / 30;
  const me = m.pls[m.ctrl]; m.ball.owner = m.ctrl; me.x = L - 9; me.y = aimY; me.fx = 1; me.fy = 0; me.vx = me.vy = 0; m.freeze = 0; m.restart = null;
  const before = m.score[0] + m.score[1] + m.corners[0] + m.corners[1];
  let t = 0, resolved = false;
  for (let i = 0; i < 30 * 12; i++) {
    m.input.ix = 1; m.input.iy = 0; m.step(dt); t += dt;
    if (m.freeze > 0 || m.restart || m.score[0] + m.score[1] > 0) { resolved = true; break; }
  }
  return { resolved, t, before };
}

describe('10 gözlemci bot', () => {
  const runs = SEEDS.map(observeBots);
  it('hepsi maçı bitirir', () => runs.forEach(r => expect(r.over).toBe(true)));
  it('kimse duvara/çizgiye yapışıp kalmaz', () => runs.forEach(r => expect(r.worst).toBeLessThan(5)));
  it('top taşıyıcı kale çizgisinde sıkışmaz', () => runs.forEach(r => expect(r.carrierStuck).toBeLessThan(0.8)));
  it('insan: topla kaleye düz koşunca sıkışmaz (orta, kenar, köşe)', () => {
    for (const s of SEEDS) for (const y of [10, 4, 16, 1.5]) { const r = humanRun(s, y); expect(r.resolved, `seed ${s} y ${y}`).toBe(true); expect(r.t).toBeLessThan(8); }
  });
});
