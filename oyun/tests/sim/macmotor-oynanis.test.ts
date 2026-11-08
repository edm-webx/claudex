// 2026-11-08 user: "rakip kaleci hala futbolcuyu takip ediyor, pas şut çalım kullanışsız". A scripted human plays real matches.
import { it, expect } from 'vitest';
import { createMatch, L, WD, M0, M1 } from '../../src/game/sim/macmotor';

function bot(seed: number) {
  const m = createMatch({ seed, human: 0, humanSlot: 3, halfS: 75 }); const dt = 1 / 30;
  let gkOut = 0, gkFollow = 0, frames = 0, passes = 0, passOk0 = 0, bursts = 0;
  for (let i = 0; i < 14000 && !m.over; i++) {
    const p = m.pls[m.ctrl], b = m.ball;
    if (b.owner === m.ctrl) {
      const dx = L - p.x; m.input.ix = 1; m.input.iy = (WD / 2 - p.y) / 8;
      const opp = m.pls.filter(q => q.team === 1 && !q.gk).reduce((d, q) => Math.min(d, Math.hypot(q.x - p.x, q.y - p.y)), 99);
      if (dx < 13) m.act('sut', 0.55);
      else if (opp < 1.6 && p.cd2 <= 0) { m.act('calim'); bursts++; }
      else if (opp < 1.3) { m.act('pas'); passes++; }
    } else { const d = Math.hypot(b.x - p.x, b.y - p.y) || 1; m.input.ix = (b.x - p.x) / d; m.input.iy = (b.y - p.y) / d; if (d < 1.4 && b.owner >= 0 && m.pls[b.owner].team === 1) m.act('sut'); }
    m.step(dt);
    if (m.freeze > 0) continue; frames++;
    const gk = m.pls.find(q => q.gk && q.team === 1)!;
    if (L - gk.x > 6) gkOut++;
    const car = b.owner >= 0 ? m.pls[b.owner] : null;
    if (car && car.team === 0 && L - car.x > 12 && (L - gk.x > 1.6 || gk.y < M0 - 0.1 || gk.y > M1 + 0.1)) gkFollow++;
  }
  passOk0 = m.teamStats(0).passesOk;
  return { m, gkOut: gkOut / frames, gkFollow: gkFollow / frames, passes, passOk0, bursts };
}
it('kaleci kalesini terk etmez, uzaktaki topçuyu takip etmez; insan oyuncu gol atabilir', () => {
  const r = [11, 22, 33, 44, 55, 66].map(bot);
  console.log('golBiz', r.map(x => x.m.score[0]), 'golOnlar', r.map(x => x.m.score[1]), 'sut', r.map(x => x.m.teamStats(0).shots), 'isabet', r.map(x => x.m.teamStats(0).onTarget), 'calim', r.map(x => x.bursts), 'gkOut', r.map(x => x.gkOut.toFixed(3)), 'gkFollow', r.map(x => x.gkFollow.toFixed(3)));
  for (const x of r) { expect(x.m.over).toBe(true); expect(x.gkOut).toBeLessThan(0.01); expect(x.gkFollow).toBeLessThan(0.01); }
  const goals = r.reduce((s, x) => s + x.m.score[0], 0); expect(goals).toBeGreaterThan(6);
  const sh = r.reduce((s, x) => s + x.m.teamStats(0).shots, 0), on = r.reduce((s, x) => s + x.m.teamStats(0).onTarget, 0); expect(on / sh).toBeGreaterThan(0.5);
});
it('pas: idle stick, receiver runs onto the ball', () => {
  const m = createMatch({ seed: 5, human: 0, humanSlot: 3 }); for (let i = 0; i < 60; i++) m.step(1 / 30);
  for (const q of m.pls) if (q.team === 1) { q.x = 36 + (q.gk ? 3 : 0); q.vx = q.vy = 0; q.stun = 3; }
  m.ball.owner = m.ctrl; const from = m.ctrl; m.input.ix = 0; m.input.iy = 0; m.act('pas');
  expect(m.ctrl).not.toBe(from); const to = m.ctrl;
  for (let i = 0; i < 90 && m.ball.owner < 0; i++) m.step(1 / 30);
  expect(m.ball.owner === to || m.pls[m.ball.owner]?.team === 0).toBe(true);
});
