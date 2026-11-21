// BUF-08 mutfak sesleri: ısı seviyesi fonksiyonu ve tepe sınırları (kulak testi sahibinde; burada yalnız sayılar).
import { describe, it, expect } from 'vitest';
import { heatLevel, HEAT_MAX, HEAT_R, SES_TEPE } from '../../../src/engine/audio/mutfak-ses';
import { SES_ISTASYON } from '../../../src/content/mutfak-ses';

const L = { x: 0, z: 0 };
describe('heatLevel', () => {
  it('kaynak yok ya da menzil dışı: sessiz', () => {
    expect(heatLevel(L, [])).toBe(0);
    expect(heatLevel(L, [{ x: HEAT_R, z: 0, w: 1 }])).toBe(0);
    expect(heatLevel(L, [{ x: 50, z: 0, w: 1 }])).toBe(0);
  });
  it('tek kaynak: yakında duyulur, tavanı aşmaz', () => {
    const v = heatLevel(L, [{ x: 0, z: 0, w: 1 }]);
    expect(v).toBeGreaterThan(0.15); expect(v).toBeLessThanOrEqual(HEAT_MAX);
  });
  it('kaynak sayısı artınca tepe büyümez (yumuşak tavan)', () => {
    const many = Array.from({ length: 10 }, () => ({ x: 0, z: 0, w: 1 }));
    expect(heatLevel(L, many)).toBeLessThanOrEqual(HEAT_MAX);
    expect(heatLevel(L, many)).toBeGreaterThan(heatLevel(L, many.slice(0, 1)));
  });
  it('mesafe arttıkça monoton azalır', () => {
    const d = [0, 2, 4, 6].map(x => heatLevel(L, [{ x, z: 0, w: 1 }]));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThan(d[i - 1]);
  });
  it('iki kaynak tek kaynaktan büyük ama iki katından küçük', () => {
    const one = heatLevel(L, [{ x: 0, z: 0, w: 1 }]), two = heatLevel(L, [{ x: 0, z: 0, w: 1 }, { x: 0, z: 0, w: 1 }]);
    expect(two).toBeGreaterThan(one); expect(two).toBeLessThan(2 * one);
  });
});

describe('tepe seviyeleri', () => {
  it('tek seferlik tarifler 0.08 altında, döngü tavanı 0.20', () => {
    for (const v of Object.values(SES_TEPE)) expect(v).toBeLessThanOrEqual(0.08);
    expect(HEAT_MAX).toBeLessThanOrEqual(0.2);
  });
  it('tava istasyonları yalnız ocak hattında', () => {
    const tava = Object.keys(SES_ISTASYON).filter(k => SES_ISTASYON[k].tava);
    expect(tava.sort()).toEqual(['ocak', 'ocak2']);
  });
});
