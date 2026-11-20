// Gün sonu: gider kesintisi kasayı sıfırın altına düşürmez (kart gerçek ödenen tutarı gösterir) ve
// hafta sonu kasa sayımı gün sonu kartı açıkken başlamaz, kart kapanınca başlar.
import { describe, it, expect } from 'vitest';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
import { GIDER } from '../../src/content/ekonomi2';
const log = { info() {}, warn() {}, error() {} };
function mk() {
  const sim: any = createSim({ seed: 7, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  return sim;
}
describe('gün sonu gider + kasa sayımı', () => {
  it('para yetmezse eksik ödenir, giderSon.paid gerçek kesintiyi taşır, kasa negatif olmaz', () => {
    const sim = mk(), S = sim.rules.state;
    S.stage = 5; S.today.sales = 100000;   // kira + fatura kasadan büyük
    S.money = 1234;
    sim.rules.bus.emit('dayEnd', {});
    const g = sim.rules.rt.uiLast.giderSon;
    expect(g).toBeTruthy();
    expect(g.kira + g.fatura).toBeGreaterThan(g.paid);
    expect(g.paid).toBe(1234);
    expect(S.money).toBe(0);
  });
  it('para yeterse kira + fatura tam kesilir', () => {
    const sim = mk(), S = sim.rules.state;
    S.stage = 3; S.today.sales = 10000; S.money = 1e6;
    sim.rules.bus.emit('dayEnd', {});
    const g = sim.rules.rt.uiLast.giderSon;
    expect(g.paid).toBe(g.kira + g.fatura);
    expect(g.fatura).toBe(Math.round(10000 * GIDER.fatura));
    expect(S.money).toBe(1e6 - g.paid);
  });
  it('gün sonu kartı açıkken kasa sayımı bekler, kart kapanınca başlar', () => {
    const sim = mk(), R = sim.rules.rt, S = sim.rules.state;
    R.gunSonuCard = true; S.level = 10;
    // hafta sınırına getir: endDay sonrası (S.day-1) % WEEK_GAME_DAYS === 0 olmalı
    for (let g = 0; g < 40 && !R.uiLast.kasaSayimi; g++) {
      S.dayT = 1e9; sim.step(0.1);
      if (R.pauseWhy === 'gunSonu') {
        expect(R.uiLast.kasaSayimi).toBeUndefined();   // kart açıkken kasa sayımı yok
        sim.command({ kind: 'yeniGun' }); sim.step(0.1);
      }
    }
    expect(R.uiLast.kasaSayimi).toBeTruthy();
    expect(R.pauseWhy).toBe('kasa');
  });
});
