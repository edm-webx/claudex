// FUT-03: top fiziği (z/vz, sekme, direk/üst direk, ağ), dokun-kovala top sürme, çalım, uzun top, vuruş animasyon bayrağı.
import { describe, it, expect } from 'vitest';
import { createMatch, L, WD, M0, M1, GH, GD } from '../../src/game/sim/macmotor';

const dt = 1 / 60;
function bos(seed = 1, human: 0 | null = null) {
  const m = createMatch({ seed, human, halfS: 300 }); m.freeze = 0; m.restart = null;
  for (const p of m.pls) { p.x = p.team ? 2 : 1; p.y = p.gk ? 10 : 1 + m.pls.indexOf(p); p.stun = 99; }
  return m;
}
function serbest(m: ReturnType<typeof createMatch>, x: number, y: number, vx: number, vy: number, z = 0, vz = 0) {
  const b = m.ball; b.owner = -1; b.x = x; b.y = y; b.z = z; b.vx = vx; b.vy = vy; b.vz = vz; b.lastTouch = 0;
}

describe('top fiziği', () => {
  it('havadaki top yere düşer ve küçülerek seker', () => {
    const m = bos(); serbest(m, 20, 10, 3, 0, 0, 5); let peaks = 0, prev = 0, up = true, maxZ = 0;
    for (let i = 0; i < 180; i++) { m.step(dt); const z = m.ball.z; maxZ = Math.max(maxZ, z); if (up && z < prev) { peaks++; up = false; } if (!up && z > prev) up = true; prev = z; }
    expect(maxZ).toBeGreaterThan(1.1); expect(maxZ).toBeLessThan(1.4); expect(peaks).toBeGreaterThanOrEqual(2); expect(m.ball.z).toBe(0);
  });
  it('direğe 8 m/s çarpan top geri döner ve post olayı çıkar', () => {
    const m = bos(); serbest(m, L - 3, M0, 8, 0); let post = false;
    for (let i = 0; i < 60 && !post; i++) { m.step(dt); if (m.events.some(e => e.k === 'post')) post = true; }
    expect(post).toBe(true); expect(m.ball.vx).toBeLessThan(0); expect(m.score[0]).toBe(0);
  });
  it('üst direğe çarpan top geri döner, üstünden aşan gol değildir', () => {
    const m = bos(); serbest(m, L - 1, 10, 15, 0, GH, 0); let post = false;
    for (let i = 0; i < 20 && !post; i++) { m.step(dt); if (m.events.some(e => e.k === 'post')) post = true; }
    expect(post).toBe(true); expect(m.ball.vx).toBeLessThan(0); expect(m.score[0]).toBe(0);
    const m2 = bos(); serbest(m2, L - 2, 10, 15, 0, 3, 0); for (let i = 0; i < 30; i++) m2.step(dt);
    expect(m2.score[0]).toBe(0); expect(m2.restart?.kind).toBe('kale');
  });
  it('gol olan top ağda yavaşlar ve ağ içinde durur', () => {
    const m = bos(); serbest(m, L - 2, 10, 20, 0, 0.5, 0); let g = false;
    for (let i = 0; i < 100; i++) { m.step(dt); if (m.events.some(e => e.k === 'goal')) g = true; if (g) { expect(m.ball.x).toBeLessThanOrEqual(L + GD); expect(m.ball.y).toBeGreaterThan(M0); expect(m.ball.y).toBeLessThan(M1); expect(m.ball.z).toBeLessThan(GH); } }
    expect(g).toBe(true); expect(Math.hypot(m.ball.vx, m.ball.vy)).toBeLessThan(0.5); expect(m.ball.x).toBeGreaterThan(L);
  });
});

describe('top sürme ve vuruşlar', () => {
  it("yapışık top: sürerken top ayağın 0.3-0.9 m önünde kalır ve sahiplik kaybolmaz", () => {
    const m = bos(3, 0), me = m.pls[m.ctrl]; me.stun = 0; me.x = 5; me.y = 10; me.fx = 1; me.fy = 0; m.ball.owner = m.ctrl; m.ball.x = 5.5; m.ball.y = 10;
    const ds: number[] = [];
    for (let i = 0; i < 200 && m.ball.owner === m.ctrl; i++) { m.input.ix = 1; m.input.iy = 0; m.step(dt); if (i > 40) ds.push(Math.hypot(m.ball.x - me.x, m.ball.y - me.y)); }
    expect(m.ball.owner).toBe(m.ctrl); expect(ds.length).toBeGreaterThan(100); expect(Math.min(...ds)).toBeGreaterThan(0.3); expect(Math.max(...ds)).toBeLessThan(0.9);
  });
  it('vuruşta p.act = kick, uzun top savunmanın üstünden uçar', () => {
    const m = bos(4, 0), me = m.pls[m.ctrl]; me.stun = 0; me.x = 10; me.y = 10; m.ball.owner = m.ctrl; m.ball.x = 10.5; m.ball.y = 10;
    const mate = m.pls.find(p => p.team === 0 && !p.gk && p !== me)!; mate.stun = 0; mate.x = 26; mate.y = 10;
    m.input.ix = 1; m.input.iy = 0; m.act('uzun');
    expect(me.act).toBe('kick'); expect(m.ball.vz).toBeGreaterThan(2); let maxZ = 0;
    for (let i = 0; i < 40; i++) { m.step(dt); maxZ = Math.max(maxZ, m.ball.z); }
    expect(maxZ).toBeGreaterThan(1.2);
  });
  it('çalım: önündeki savunmacıyı geçme oranı > %40 (bot)', () => {
    let gec = 0; const N = 30;
    for (let s = 0; s < N; s++) {
      const m = bos(50 + s, 0), me = m.pls[m.ctrl], d = m.pls.find(p => p.team === 1 && !p.gk)!;
      me.stun = 0; d.stun = 0; me.x = 14; me.y = 10; me.fx = 1; me.fy = 0; m.ball.owner = m.ctrl; m.ball.x = 14.5; m.ball.y = 10;
      d.x = 18 + (s % 3) * 0.4; d.y = 10 + ((s % 5) - 2) * 0.3; let did = false;
      for (let i = 0; i < 150; i++) {
        m.input.ix = 1; m.input.iy = 0;
        if (!did && Math.hypot(d.x - me.x, d.y - me.y) < 1.8 && m.ball.owner === m.ctrl) { m.input.iy = s % 2 ? 1 : -1; m.act('calim'); did = true; }
        m.step(dt);
        if (m.ball.owner === m.ctrl && me.x > d.x + 1.5) { gec++; break; }
        if (m.ball.owner >= 0 && m.pls[m.ball.owner].team === 1) break;
      }
    }
    console.log('çalım geçme', gec, '/', N); expect(gec / N).toBeGreaterThan(0.4);
  });
  it('arkadan müdahale topu alamaz, önden temiz müdahale alır', () => {
    const m = bos(6, 0), me = m.pls[m.ctrl], o = m.pls.find(p => p.team === 1 && !p.gk)!, oi = m.pls.indexOf(o);
    me.stun = 0; o.stun = 0; o.x = 20; o.y = 10; o.fx = 1; o.fy = 0; m.ball.owner = oi; m.ball.x = 20.5; m.ball.y = 10;
    me.x = 19.4; me.y = 10; m.act('kap'); expect(m.ball.owner).toBe(oi); expect(me.act).toBe('tackle');
    const m2 = bos(6, 0), me2 = m2.pls[m2.ctrl], o2 = m2.pls.find(p => p.team === 1 && !p.gk)!, oi2 = m2.pls.indexOf(o2);
    me2.stun = 0; o2.stun = 0; o2.x = 20; o2.y = 10; o2.fx = 1; o2.fy = 0; m2.ball.owner = oi2; m2.ball.x = 20.6; m2.ball.y = 10;
    me2.x = 21.2; me2.y = 10.2; m2.act('kap'); expect(m2.ball.owner).toBe(m2.ctrl);
  });
  it('şut yüksekliği gücüyle artar', () => {
    const z = (pw: number) => { const m = bos(7, 0), me = m.pls[m.ctrl]; me.stun = 0; me.x = 25; me.y = 10; m.ball.owner = m.ctrl; m.ball.x = 25.5; m.ball.y = 10; m.input.ix = 1; m.input.iy = 0.5; m.act('sut', pw); return m.ball.vz; };
    expect(z(1)).toBeGreaterThan(z(0.1));
  });
});
void WD;
