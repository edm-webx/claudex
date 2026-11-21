// FUT-04: kaleci durum makinesi (açıortay, dar aç, dalış, el kuralı) ve kale önü / köşe sıkışma güvencesi (40 senaryo).
import { describe, it, expect } from 'vitest';
import { createMatch, rng, L, WD, M0, M1, BOX_D, BOX_Y0, BOX_Y1 } from '../../src/game/sim/macmotor';

const dt = 1 / 60;
function sahne(seed: number, human: 0 | null = null) {
  const m = createMatch({ seed, human, halfS: 300 }); m.freeze = 0; m.restart = null;
  return m;
}

describe('kaleci', () => {
  it('açıortayda durur: uzak topta ağız ortasına yakın, yakın topta ağız içinde', () => {
    for (const [bx, by] of [[20, 3], [20, 17], [30, 10], [34, 2], [34, 18], [36, 7]]) {
      const m = sahne(3); const k = m.pls.find(p => p.gk && p.team === 1)!, a = m.pls.find(p => p.team === 0 && p.role === 'FWD')!;
      for (const p of m.pls) { if (p !== k && p !== a) { p.x = 5; p.y = p.team ? 1 : 19; p.stun = 99; } }
      a.x = bx - 0.6; a.y = by; m.ball.owner = m.pls.indexOf(a); m.ball.x = bx; m.ball.y = by;
      for (let i = 0; i < 90; i++) { a.vx = a.vy = 0; a.x = bx - 0.6; a.y = by; a.kickCd = 1; a.think = 1; m.step(dt); }
      // açıortay: kaleciden iki direğe olan açılar topun bakışında eşit
      const ang = (y: number) => Math.atan2(y - m.ball.y, L - m.ball.x), mid = (ang(M0) + ang(M1)) / 2, kAng = Math.atan2(k.y - m.ball.y, k.x - m.ball.x);
      expect(k.y).toBeGreaterThan(M0); expect(k.y).toBeLessThan(M1); expect(L - k.x).toBeLessThan(2.7);
      if (L - bx > 12) { expect(Math.abs(k.y - WD / 2)).toBeLessThan(1.2); expect(L - k.x).toBeLessThan(1.0); } else expect(Math.abs(kAng - mid)).toBeLessThan(0.12);
    }
  });
  it('yakındaki şutta dalar (p.dive, p.diveDir) ve ceza alanından çıkmaz', () => {
    let dives = 0, right = 0;
    for (let s = 0; s < 20; s++) {
      const m = sahne(100 + s), k = m.pls.find(p => p.gk && p.team === 1)!;
      for (const p of m.pls) if (p !== k) { p.x = 3; p.stun = 99; }
      k.x = L - 0.8; k.y = 10; const side = s % 2 ? 1 : -1, ty = side > 0 ? M1 - 0.3 : M0 + 0.3, sx = L - 8 - (s % 5), sy = 6 + (s % 7) * 1.3;
      const d = Math.hypot(L - sx, ty - sy), v = 18 + (s % 4) * 2; m.ball.owner = -1; m.ball.x = sx; m.ball.y = sy; m.ball.vx = (L - sx) / d * v; m.ball.vy = (ty - sy) / d * v; m.ball.lastTouch = 0; m.shot = { team: 0, t: 3 };
      let dv = 0; for (let i = 0; i < 60; i++) { m.step(dt); if (k.dive > 0 && !dv) { dv = k.diveDir; } expect(L - k.x).toBeLessThan(BOX_D); expect(k.y).toBeGreaterThan(BOX_Y0); expect(k.y).toBeLessThan(BOX_Y1); }
      if (dv) { dives++; if (dv === side) right++; }
    }
    expect(dives).toBeGreaterThan(12); expect(right / dives).toBeGreaterThan(0.9);
  });
  it('1v1 yakın şutlarda kurtarış oranı makul (%25-65)', () => {
    let isabet = 0, gol = 0; const R = rng(9);
    for (let s = 0; s < 60; s++) {
      const m = sahne(500 + s, 0), me = m.pls[m.ctrl];
      for (const p of m.pls) if (p !== me && !p.gk) { p.x = 3; p.stun = 99; }
      me.x = L - 7 - R() * 5; me.y = 6 + R() * 8; m.ball.owner = m.ctrl; m.ball.x = me.x + 0.6; m.ball.y = me.y; me.fx = 1; me.fy = 0;
      m.input.ix = 1; m.input.iy = R() < 0.5 ? -1 : 1; m.act('sut', 0.3 + R() * 0.7);
      if (!m.shot) continue; isabet++;
      for (let i = 0; i < 120 && m.score[0] === 0; i++) m.step(dt);
      if (m.score[0] > 0) gol++;
    }
    const kurtaris = 1 - gol / isabet; console.log('1v1 isabet', isabet, 'gol', gol, 'kurtarış', kurtaris.toFixed(2));
    expect(kurtaris).toBeGreaterThan(0.25); expect(kurtaris).toBeLessThan(0.65);
  });
  it('kalecinin elindeki topu ne insan ne bot çalamaz', () => {
    const m = sahne(8, 0), k = m.pls.find(p => p.gk && p.team === 1)!, ki = m.pls.indexOf(k), me = m.pls[m.ctrl];
    k.x = L - 1; k.y = 10; m.ball.owner = ki; m.ball.x = k.x - 0.6; m.ball.y = 10; k.think = 5; k.kickCd = 5;
    me.x = L - 1.8; me.y = 10; for (const p of m.pls) if (p.team === 0 && p !== me) { p.x = L - 2; p.y = 10.5; }
    for (let i = 0; i < 30; i++) { m.act('sut'); m.step(dt); k.think = 5; k.kickCd = 5; expect(m.ball.owner).toBe(ki); }
  });
});

// Kale çizgisinde ve köşe bayrağında sıkışma: 4 kenar x 10 seed, bot taşıyıcı ve insan taşıyıcı. Ya olay olur (gol, aut, korner,
// top kaybı) ya taşıyıcı oradan çıkar; kimse 2 sn'den uzun çizgiye yapışmaz.
const KENAR: [number, number][] = [[L - 1.2, 1.0], [L - 1.2, WD - 1.0], [L - 0.7, M0 - 1.2], [L - 0.7, M1 + 1.2]];
describe('kale önü / köşe sıkışma (40 senaryo)', () => {
  for (const [ki, [x, y]] of KENAR.entries()) it(`kenar ${ki + 1} (${x}, ${y})`, () => {
    for (let s = 0; s < 10; s++) for (const human of [null, 0] as const) {
      const m = sahne(2000 + ki * 100 + s, human), ci = human === 0 ? m.ctrl : m.pls.findIndex(p => p.team === 0 && p.role === 'FWD'), c = m.pls[ci];
      c.x = x; c.y = y; c.fx = 1; c.fy = 0; m.ball.owner = ci; m.ball.x = Math.min(L - 0.2, x + 0.5); m.ball.y = y;
      const wall = m.pls.map(() => 0); let ok = false, worst = 0;
      for (let i = 0; i < 8 / dt; i++) {
        if (human === 0) { m.input.ix = 1; m.input.iy = 0; }
        m.step(dt);
        if (m.restart || m.freeze > 0 || m.ball.owner !== ci || Math.hypot(c.x - x, c.y - y) > 3) { ok = true; break; }
        m.pls.forEach((p, k) => { const at = !p.gk && (p.x < 0.6 || p.x > L - 0.6 || p.y < 0.6 || p.y > WD - 0.6) && Math.hypot(p.vx, p.vy) < 0.8; wall[k] = at ? wall[k] + dt : 0; worst = Math.max(worst, wall[k]); });
      }
      expect(ok, `seed ${s} human ${human}`).toBe(true); expect(worst, `seed ${s} human ${human}`).toBeLessThan(2);
    }
  });
});
