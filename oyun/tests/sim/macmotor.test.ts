import { describe, it, expect } from 'vitest';
import { createMatch, L, WD } from '../../src/game/sim/macmotor';

function play(seed: number, f: [string, string] = ['2-2', '2-2']) {
  const m = createMatch({ seed, formations: f, halfS: 75 }); const dt = 1 / 30;
  let ballNear = 0, steps = 0, spread = 0, spreadN = 0, bad = 0, stuck = 0;
  const lastPos = m.pls.map(p => [p.x, p.y]); let still = m.pls.map(() => 0);
  for (let i = 0; i < 150 / dt + 3000 && !m.over; i++) {
    m.step(dt);
    if (m.freeze > 0) continue; steps++;
    const near = m.pls.filter(p => !p.gk && Math.hypot(p.x - m.ball.x, p.y - m.ball.y) < 4).length; if (near >= 5) ballNear++;
    for (const t of [0, 1]) { const o = m.pls.filter(p => p.team === t && !p.gk); for (let a = 0; a < o.length; a++) for (let b = a + 1; b < o.length; b++) { spread += Math.hypot(o[a].x - o[b].x, o[a].y - o[b].y); spreadN++; } }
    if (m.pls.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) || !Number.isFinite(m.ball.x)) bad++;
    m.pls.forEach((p, k) => { const d = Math.hypot(p.x - lastPos[k][0], p.y - lastPos[k][1]); still[k] = d < 0.005 && !p.gk ? still[k] + dt : 0; lastPos[k] = [p.x, p.y]; if (still[k] > 12) stuck++; });
  }
  return { m, ballNearFrac: ballNear / steps, spread: spread / spreadN, bad, stuck };
}
describe('maç motoru', () => {
  const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(s => play(s * 7919, s % 3 === 0 ? ['1-2-1', '2-1-1'] : s % 3 === 1 ? ['2-2', '1-2-1'] : ['2-1-1', '2-2']));
  it('biter, NaN yok', () => { for (const r of runs) { expect(r.m.over).toBe(true); expect(r.bad).toBe(0); } });
  it('makul gol/şut/pas', () => {
    const g = runs.map(r => r.m.score[0] + r.m.score[1]), sh = runs.map(r => r.m.pls.reduce((s, p) => s + p.st.shots, 0)), pa = runs.map(r => r.m.pls.reduce((s, p) => s + p.st.passes, 0));
    const ok = runs.map(r => Math.round(r.m.pls.reduce((a, p) => a + p.st.passesOk, 0) / r.m.pls.reduce((a, p) => a + p.st.passes, 0) * 100)); console.log('pasIsabet', ok, 'goller', g, 'sut', sh, 'pas', pa, 'kornerler', runs.map(r => r.m.corners.join('-')), 'topla', runs.map(r => r.m.teamStats(0).possession), 'yigilma', runs.map(r => r.ballNearFrac.toFixed(2)), 'yayilim', runs.map(r => r.spread.toFixed(1)));
    const avg = g.reduce((a, b) => a + b, 0) / g.length; expect(avg).toBeGreaterThan(2); expect(avg).toBeLessThan(14);
    expect(Math.min(...sh)).toBeGreaterThan(3); expect(Math.min(...pa)).toBeGreaterThan(10);
  });
  it('yığılma ve yayılım', () => { for (const r of runs) { expect(r.ballNearFrac).toBeLessThan(0.3); expect(r.spread).toBeGreaterThan(6); } });
  it('kimse sıkışıp kalmaz', () => { for (const r of runs) expect(r.stuck).toBe(0); });
  it('topa sahip olma dengeli, tüm oyuncular koşar', () => { for (const r of runs) { const p = r.m.teamStats(0).possession; expect(p).toBeGreaterThan(25); expect(p).toBeLessThan(75); expect(r.m.pls.filter(x => !x.gk).every(x => x.st.dist > 40)).toBe(true); } });
  it('aynı seed aynı maç (determinizm)', () => { const a = play(99), b = play(99); expect(a.m.score).toEqual(b.m.score); expect(a.m.pls[3].x).toBe(b.m.pls[3].x); });
  it('seed değişince maç değişir', () => { const sc = new Set(runs.map(r => r.m.score.join('-') + ':' + r.m.pls.reduce((s, p) => s + p.st.passes, 0))); expect(sc.size).toBeGreaterThan(5); });
});
void L; void WD;

import { recordStats } from '../../src/game/sim/halisaha';
describe('istatistik çetelesi', () => {
  it('maç istatistiğini kariyere işler, bozuk girdiyi kırpar', () => {
    const m = play(5).m, z: Record<string, unknown> = {};
    const ist = { takim: [m.teamStats(0), m.teamStats(1)], oyuncu: m.pls.filter(p => p.team === 0).map(p => ({ ad: p.name, rol: p.role, ...p.st })) };
    recordStats(z as never, ist, m.score[0], m.score[1]); recordStats(z as never, ist, 3, 1);
    const P = z.players as Record<string, Record<string, number>>;
    expect(P['SABRİ'].oyun).toBe(2); expect((z.team as Record<string, number>).shots).toBe(2 * m.teamStats(0).shots);
    expect((z.form as string[]).length).toBe(2); expect((z.form as string[])[1]).toBe('G');
    recordStats(z as never, { takim: [{ shots: 1e9 }], oyuncu: [{ ad: '<b>x</b>', goals: -5 }] }, 0, 0);
    expect((z.team as Record<string, number>).shots).toBeLessThan(1000); expect(Object.keys(P).some(k => k.includes('<'))).toBe(false);
  });
});
