import { describe, it, expect } from 'vitest';
import { createGorselSaat, SAFAK_SN } from '../../../src/game/boot-saat';
import { todAt } from '../../../src/engine/render/tod';

const DT = 1 / 60;

describe('görsel saat: gün sonu ve şafak (GRS-02)', () => {
  it('gün sonu kartı açıkken dünya gece kalır', () => {
    const g = createGorselSaat(26.9, 3);
    expect(g.update(26.99, 3, false, DT)).toBeCloseTo(26.99, 9);
    for (let i = 0; i < 200; i++) expect(g.update(8, 4, true, DT)).toBeCloseTo(26.99, 9);
    expect(g.gecis).toBe(true);
  });

  it('kart kapanınca şafak sürekli ve sonunda gerçek saate geçer', () => {
    const g = createGorselSaat(27, 1);
    g.update(27, 1, false, DT); g.update(8, 2, true, DT);
    let prev = 27, n = 0;
    for (; n < Math.ceil(SAFAK_SN / DT) + 5; n++) {
      const v = g.update(8, 2, false, DT);
      if (!g.gecis) { expect(v).toBe(8); break; }
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(v - prev).toBeLessThanOrEqual(0.05);
      prev = v;
    }
    expect(prev).toBeGreaterThan(31.9);
    // corridor end == 08:00: the hand-over draws the same sky
    const a = todAt(prev), b = todAt(8);
    expect(Math.abs(a.top.r - b.top.r) + Math.abs(a.top.g - b.top.g) + Math.abs(a.top.b - b.top.b)).toBeLessThan(0.02);
  });

  it('kapanış 22 olsa da çalışır', () => {
    const g = createGorselSaat(21.9, 5);
    g.update(21.99, 5, false, DT); g.update(8, 6, true, DT);
    expect(g.update(8, 6, true, DT)).toBeCloseTo(21.99, 9);
    let prev = 21.99;
    for (let i = 0; i < 400 && g.gecis; i++) { const v = g.update(8, 6, false, DT); if (g.gecis) { expect(v).toBeGreaterThanOrEqual(prev - 1e-9); expect(v - prev).toBeLessThanOrEqual(0.07); prev = v; } }
    expect(g.gecis).toBe(false); expect(g.saat).toBe(8);
  });

  it('aynı gün içinde saat atlaması şafak başlatmaz', () => {
    const g = createGorselSaat(12, 2);
    expect(g.update(20, 2, false, DT)).toBe(20);
    expect(g.gecis).toBe(false);
  });

  it('kartsız (başsız) gün dönüşü de şafakla açılır', () => {
    const g = createGorselSaat(26.98, 1);
    const v = g.update(8, 2, false, DT);
    expect(v).toBeGreaterThan(26.9); expect(g.gecis).toBe(true);
  });

  it('sifirla bekleyen geceyi bırakır', () => {
    const g = createGorselSaat(26.9, 1);
    g.update(8, 2, true, DT); g.sifirla(14, 2);
    expect(g.update(14, 2, true, DT)).toBe(14);
  });
});
