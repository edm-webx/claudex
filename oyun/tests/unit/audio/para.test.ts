// SNT-02: tek para kapısı: yoğun serviste ses seyrekleşir ve kısılır, nota hiç iki kez art arda aynı olmaz.
import { describe, it, expect } from 'vitest';
import { createMoneyGate, isMoney, MONEY_IDS, PENTA_RATIOS } from '../../../src/engine/audio/gate';
import { EVENT_SFX } from '../../../src/content/sfx';

describe('para kapısı', () => {
  it('aynı saniyede 20 satış: en çok 6 para sesi', () => {
    const g = createMoneyGate(() => 0.3); let n = 0;
    for (let i = 0; i < 20; i++) if (g.pass(i * 50)) n++;
    expect(n).toBeLessThanOrEqual(6); expect(n).toBeGreaterThanOrEqual(2);
  });
  it('10 sn yoğun servis (her 100 ms): saniyede en çok 4 ses', () => {
    const g = createMoneyGate(() => 0.5); const per = new Array(10).fill(0);
    for (let t = 0; t < 10000; t += 100) if (g.pass(t)) per[Math.floor(t / 1000)]++;
    for (const c of per) expect(c).toBeLessThanOrEqual(4);
  });
  it('en az 160 ms aralık, seyrekken tam ses; yoğunken kısılır', () => {
    const g = createMoneyGate(() => 0.1);
    expect(g.pass(0)!.vol).toBe(1); expect(g.pass(100)).toBeNull();
    const a = g.pass(300)!; expect(a.vol).toBeLessThan(1);
    expect(g.pass(10000)!.vol).toBe(1);
  });
  it('perde pentatonik orandan, art arda aynı nota yok', () => {
    const g = createMoneyGate(() => 0); let last = -1;
    for (let t = 0; t < 20000; t += 1000) { const p = g.pass(t)!; expect(PENTA_RATIOS).toContain(p.pitch); expect(p.pitch).not.toBe(last); last = p.pitch; }
  });
  it('para olayları kapıdan geçen kimliklere bağlı; para dışı olaylar kapıda değil', () => {
    for (const id of ['coin', 'cash', 'hesap', 'buy', 'tip']) expect(isMoney(id)).toBe(true);
    for (const id of ['pop', 'tik', 'error', 'gull']) expect(isMoney(id)).toBe(false);
    expect(MONEY_IDS.length).toBe(6);
    expect(EVENT_SFX.sale).toBe('coin'); expect(EVENT_SFX.hesap).toBe('hesap');
  });
});
