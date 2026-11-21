// FUT-05: hakem ve kurallar: faul (arkadan / aşırı sert), serbest vuruş, penaltı, kale vuruşu, taç, korner; sarı kart yalnız uyarı.
import { describe, it, expect } from 'vitest';
import { createMatch, L, WD, PEN_D, type Ev } from '../../src/game/sim/macmotor';
import { macKos, FORM_CIFTLERI } from '../../src/game/sim/mac-olcum';

const dt = 1 / 60;
function sahne(seed = 1) {
  const m = createMatch({ seed, human: 0, halfS: 300 }); m.freeze = 0; m.restart = null;
  for (const p of m.pls) { p.x = p.team ? 30 : 10; p.y = 1 + m.pls.indexOf(p) * 1.8; p.stun = 99; }
  const me = m.pls[m.ctrl], o = m.pls.find(p => p.team === 1 && p.role !== 'GK')!; me.stun = 0; o.stun = 0;
  return { m, me, o, oi: m.pls.indexOf(o) };
}
const evs = (m: ReturnType<typeof createMatch>, k: Ev['k']) => m.events.filter(e => e.k === k);

describe('hakem', () => {
  it('arkadan temaslı müdahale faul: serbest vuruş, hakem işareti, olay', () => {
    const { m, me, o, oi } = sahne(); o.x = 20; o.y = 10; o.fx = 1; o.fy = 0; m.ball.owner = oi; m.ball.x = 20.6; m.ball.y = 10;
    me.x = 19.3; me.y = 10; me.vx = 6.5; m.act('kap'); m.step(dt);
    const f = evs(m, 'foul')[0] as Extract<Ev, { k: 'foul' }>;
    expect(f).toBeTruthy(); expect(f.team).toBe(0); expect(f.pen).toBe(false);
    expect(m.restart?.kind).toBe('serbest'); expect(m.pls[m.restart!.taker].team).toBe(1); expect(m.ref.signal).toBe('foul'); expect(m.ref.t).toBeGreaterThan(0);
  });
  it('önden temiz topa giriş faul değil', () => {
    const { m, me, o, oi } = sahne(); o.x = 20; o.y = 10; o.fx = 1; o.fy = 0; m.ball.owner = oi; m.ball.x = 20.6; m.ball.y = 10;
    me.x = 21.2; me.y = 10.2; m.act('kap'); m.step(dt);
    expect(evs(m, 'foul').length).toBe(0); expect(m.ball.owner).toBe(m.ctrl);
  });
  it('ceza alanında faul = penaltı; top noktada, kaleci çizgide, diğerleri alan dışında; kaleci vuruşta yön seçer', () => {
    const { m, me, o, oi } = sahne(2); const gx = 0;   // takım 0'ın kalesi x=0, faulü takım 0 yapar
    o.x = 3; o.y = 10; o.fx = -1; o.fy = 0; m.ball.owner = oi; m.ball.x = 2.4; m.ball.y = 10; me.x = 3.9; me.y = 10; me.vx = -6.5;
    m.act('kap'); m.step(dt);
    expect((evs(m, 'foul')[0] as Extract<Ev, { k: 'foul' }>).pen).toBe(true); expect(m.restart?.kind).toBe('penalti'); expect(m.ref.signal).toBe('penalti');
    expect(m.ball.x).toBeCloseTo(gx + PEN_D, 5); expect(m.ball.y).toBe(WD / 2);
    const k = m.pls.find(p => p.gk && p.team === 0)!; expect(k.x).toBeLessThan(1);
    for (const p of m.pls) if (!p.gk && m.pls.indexOf(p) !== m.restart!.taker) expect(p.x > 6 || p.y < 5 || p.y > 15).toBe(true);
    let dove = false; for (let i = 0; i < 240 && !dove; i++) { m.step(dt); if (k.dive > 0) dove = true; }
    expect(dove).toBe(true);
  });
  it('insan penaltıda pasa bassa da şut çeker', () => {
    // insan takımı lehine penaltı: rakip bot (takım 1) kendi ceza alanında (x=L) insanın arkasından girer
    const { m, me, o } = sahne(3); me.fx = 1; me.fy = 0; m.ball.owner = m.ctrl;
    for (let i = 0; i < 240 && m.restart?.kind !== 'penalti'; i++) {
      me.x = L - 3; me.y = 10; me.vx = me.vy = 0; me.fx = 1; me.fy = 0; m.ball.x = L - 2.45; m.ball.y = 10; o.x = me.x - 0.3; o.y = me.y + 0.5; o.vx = 1; o.kickCd = 0; o.stun = 0;
      m.input.ix = 0; m.input.iy = 0; m.step(dt);
    }
    expect(m.restart?.kind).toBe('penalti'); expect(m.pls[m.restart!.taker].team).toBe(0);
    while (m.freeze > 0) m.step(dt);
    m.ctrl = m.restart!.taker; const sh = m.pls[m.ctrl].st.shots; m.act('pas'); expect(m.pls[m.ctrl].st.shots).toBe(sh + 1);
  });
  it('kale çizgisini hücumcu geçirirse kale vuruşu; savunmacı geçirirse korner; taç', () => {
    const a = sahne(4).m; a.ball.owner = -1; a.ball.x = L - 1; a.ball.y = 3; a.ball.vx = 10; a.ball.vy = 0; a.ball.lastTouch = 0;
    for (let i = 0; i < 20 && !a.restart; i++) a.step(dt);
    expect(a.restart?.kind).toBe('kale'); expect(a.pls[a.restart!.taker].gk).toBe(true); expect(a.ref.signal).toBe('kale');
    const b = sahne(4).m; b.ball.owner = -1; b.ball.x = L - 1; b.ball.y = 3; b.ball.vx = 10; b.ball.vy = 0; b.ball.lastTouch = 1;
    for (let i = 0; i < 20 && !b.restart; i++) b.step(dt);
    expect(b.restart?.kind).toBe('korner'); expect(b.ref.signal).toBe('korner');
    const c = sahne(4).m; c.ball.owner = -1; c.ball.x = 20; c.ball.y = 1; c.ball.vx = 0; c.ball.vy = -10; c.ball.lastTouch = 1;
    for (let i = 0; i < 20 && !c.restart; i++) c.step(dt);
    expect(c.restart?.kind).toBe('tac'); expect(c.pls[c.restart!.taker].team).toBe(0); expect(c.ref.signal).toBe('tac');
  });
  it('aynı oyuncunun 3. faulü sarı kart: yalnız uyarı, kimse oyundan çıkmaz', () => {
    const { m, me, o, oi } = sahne(5); let cards = 0;
    for (let k = 0; k < 3; k++) {
      m.restart = null; m.freeze = 0; o.stun = 0; me.stun = 0; me.kickCd = 0; o.x = 20; o.y = 10; o.fx = 1; o.fy = 0; m.ball.owner = oi; m.ball.x = 20.6; m.ball.y = 10;
      me.x = 19.3; me.y = 10; me.vx = 2; me.vy = 0; m.act('kap'); m.step(dt); cards += evs(m, 'card').length;
    }
    expect(cards).toBe(1); expect(m.pls.length).toBe(10);
  });
  it('bot-bot 60 maçta faul/maç 2-6', () => {
    const r: number[] = []; for (let s = 0; s < 60; s++) r.push(macKos({ seed: 900 + s * 13, formations: FORM_CIFTLERI[s % 3] }).faul);
    const ort = r.reduce((a, b) => a + b, 0) / r.length; console.log('faul/maç', ort.toFixed(2), 'max', Math.max(...r));
    expect(ort).toBeGreaterThan(2); expect(ort).toBeLessThan(6);
  });
});
