// FUT-01: 24 maçlık hızlı kalite seti (3 formasyon çifti x 2 beceri x bot-bot + 3 insan botu), sabit 1/60 adım.
// Tam set (~500 maç + güç farkı): node tools/mac-metrik.mjs --out <klasör>. Eşikler src/game/sim/mac-olcum.ts ESIK.
import { describe, it, expect } from 'vitest';
import { createMatch, L } from '../../src/game/sim/macmotor';
import { macKos, olcer, topla, kalipYolu, ESIK, FORM_CIFTLERI, KISILIKLER, type MacMetrik } from '../../src/game/sim/mac-olcum';

const SET: MacMetrik[] = [];
FORM_CIFTLERI.forEach((f, fi) => [[0.6, 0.6], [0.66, 0.54]].forEach((sk, si) => [null, ...KISILIKLER].forEach((bot, bi) => {
  SET.push(macKos({ seed: 11 + fi * 1000 + si * 100 + bi * 7, formations: f, skill: sk as [number, number], bot }));
})));
const OZ = topla(SET), BB = topla(SET.filter(x => !x.bot));

describe('maç kalitesi (24 maç)', () => {
  it('rapor', () => { console.log('kalite', JSON.stringify({ ...OZ, botBotPas: BB.pasIsabet, botBotSut: BB.sutTakimOrt })); expect(SET.length).toBe(24); });
  it('kaleci uzaktaki topçuyu kovalamaz, alanını terk etmez (her maç < %1)', () => {
    for (const x of SET) { expect(x.kaleciKovalama, `seed ${x.seed}`).toBeLessThan(ESIK.kaleciKovalama); expect(x.kaleciAlanDisi).toBeLessThan(ESIK.kaleciAlanDisi); }
  });
  it('kimse 3 sn takılmaz, duvara/çizgiye yapışmaz', () => {
    for (const x of SET) { expect(x.takilma, `seed ${x.seed}`).toBeLessThan(ESIK.takilmaSn); expect(x.duvar).toBeLessThan(3); expect(x.tasiyiciCizgi).toBeLessThan(0.8); }
  });
  it('titreme yok (yön değişimi < 2/sn)', () => { for (const x of SET) expect(x.jitter).toBeLessThan(ESIK.jitter); });
  it('pas, şut, gol hedef bantlarında', () => {
    expect(BB.pasIsabet).toBeGreaterThan(ESIK.pasIsabet[0]); expect(BB.pasIsabet).toBeLessThan(ESIK.pasIsabet[1]);
    expect(BB.sutTakimOrt).toBeGreaterThan(ESIK.sutTakim[0]); expect(BB.sutTakimOrt).toBeLessThan(ESIK.sutTakim[1]);
    expect(OZ.golOrt).toBeGreaterThan(ESIK.golMac[0]); expect(OZ.golOrt).toBeLessThan(ESIK.golMac[1]);
    expect(BB.sahipMin).toBeGreaterThan(25); expect(BB.sahipMax).toBeLessThan(75); expect(OZ.yigilmaOrt).toBeLessThan(0.3);
  });
  it('kalıp yok: farklı seed farklı yol ve skor', () => { expect(kalipYolu([1, 2, 3, 4, 5, 6])).toBeGreaterThan(4); expect(OZ.skorCesit).toBeGreaterThan(8); });
  it('determinizm: aynı seed + aynı bot = birebir aynı metrik', () => {
    const a = macKos({ seed: 4242, bot: 'pasci', formations: ['1-2-1', '2-2'] }), b = macKos({ seed: 4242, bot: 'pasci', formations: ['1-2-1', '2-2'] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(macKos({ seed: 4243, bot: 'pasci', formations: ['1-2-1', '2-2'] }))).not.toBe(JSON.stringify(a));
  });
});

// Negatif kontrol: ölçer bozuk davranışı gerçekten yakalıyor mu? (eski "kaleci topçuyu izler" mantığı + donmuş oyuncu)
describe('negatif kontrol', () => {
  function bozuk(fn: (m: ReturnType<typeof createMatch>, t: number) => void) {
    const m = createMatch({ seed: 77, halfS: 40 }), o = olcer(m, { seed: 77, formations: ['2-2', '2-2'], skill: [0.6, 0.6], bot: null }); let t = 0;
    for (let i = 0; i < 60 * 100 && !m.over; i++) { m.step(1 / 60); if (m.freeze <= 0) t += 1 / 60; fn(m, t); o.tick(1 / 60); }
    return o.bitir();
  }
  it('topçuyu izleyen kaleci KIRMIZI', () => {
    const r = bozuk(m => { for (const p of m.pls) if (p.gk) { const og = p.team === 0 ? 0 : L; p.y += (m.ball.y - p.y) * 0.2; p.x += (og + (m.ball.x - og) * 0.25 - p.x) * 0.2; } });
    expect(r.kaleciKovalama).toBeGreaterThan(ESIK.kaleciKovalama * 10); expect(r.kaleciEgim).toBeGreaterThan(0.5);
  });
  it('12 sn donan oyuncu KIRMIZI', () => {
    let fx = -1, fy = 0;
    const r = bozuk((m, t) => { const p = m.pls[2]; if (t > 20 && t < 32 && m.ball.owner !== 2) { if (fx < 0) { fx = p.x; fy = p.y; } p.x = fx; p.y = fy; p.vx = p.vy = 0; p.tx = fx + 5; p.ty = fy; } });
    expect(r.takilma).toBeGreaterThan(ESIK.takilmaSn);
  });
});
