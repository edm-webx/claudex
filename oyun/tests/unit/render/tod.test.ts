import { describe, it, expect } from 'vitest';
import { todAt, TOD, DAWN_EXTRA } from '../../../src/engine/render/tod';
import { createRender } from '../../../src/engine/render/index';

const COLS = ['top', 'hor', 'low', 'fog', 'sun', 'hs', 'hg'] as const;

describe('gün döngüsü tablosu (GRS-01 / GRS-02)', () => {
  it('tablo değeri = ekran değeri (eski çarpan 0.8 / 0.66 tabloya işlendi)', () => {
    const raw: Record<number, [number, number]> = { 8: [2.1, 1.45], 11: [2.4, 1.45], 16: [2.35, 1.4], 18: [2.1, 1.2], 19.5: [1.35, 1.0], 20.6: [0.6, 0.95], 24: [0.55, 0.9], 27: [0.42, 0.75] };
    for (const [h, [si, hi]] of Object.entries(raw)) {
      const t = todAt(+h);
      expect(t.si, 'si ' + h).toBeCloseTo(si * 0.8, 2);
      expect(t.hi, 'hi ' + h).toBeCloseTo(hi * 0.66, 2);
    }
  });

  // the v2 dusk (19.5 -> 20.6, sunset to night in ~1 game hour) is the fastest stretch: up to 0.06 per 0.05 h (~1.2 per game hour) there is still a fade;
  // the dawn corridor 27..32 runs in 5 real seconds (boot-saat) and gets 0.03; everywhere else 0.02
  it('todAt 8..32 sıçramasız (0.05 saat adım)', () => {
    let p = todAt(8);
    for (let h = 8.05; h <= 27 + DAWN_EXTRA + 1e-9; h += 0.05) {
      const t = todAt(h);
      for (const c of COLS) { const a = t[c], b = p[c]; expect(Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)), `${c} @${h.toFixed(2)}`).toBeLessThanOrEqual(h > 19.5 && h < 20.7 ? 0.06 : h > 27 ? 0.03 : 0.02); }
      expect(Math.abs(t.si - p.si)).toBeLessThanOrEqual(0.06); expect(Math.abs(t.hi - p.hi)).toBeLessThanOrEqual(0.06);
      expect(Math.abs(t.el - p.el), 'el @' + h.toFixed(2)).toBeLessThanOrEqual(h > 19.5 && h < 20.7 ? 0.05 : 0.03); expect(Math.abs(t.n - p.n)).toBeLessThanOrEqual(0.05);
      p = t;
    }
  });

  it('24-27 derin gece gerçekten farklı', () => {
    const s = (c: { r: number; g: number; b: number }) => c.r + c.g + c.b;
    const a = todAt(24).top, b = todAt(25.5).top, c = todAt(27).top;
    expect(Math.abs(s(a) - s(b))).toBeGreaterThan(0.005); expect(Math.abs(s(b) - s(c))).toBeGreaterThan(0.005);
    expect(todAt(25.5).n).toBe(1);
  });

  it('şafak koridoru: 32 = 08:00, sınırda sıçrama yok', () => {
    expect(TOD[TOD.length - 1].h).toBe(32);
    const a = todAt(32), b = todAt(8);
    for (const c of COLS) { expect(a[c].r).toBeCloseTo(b[c].r, 9); expect(a[c].g).toBeCloseTo(b[c].g, 9); expect(a[c].b).toBeCloseTo(b[c].b, 9); }
    for (const k of ['si', 'hi', 'el', 'az', 'n'] as const) expect(a[k]).toBeCloseTo(b[k], 9);
    const x = todAt(31.99), y = todAt(8.01);
    for (const c of COLS) expect(Math.abs(x[c].r - y[c].r) + Math.abs(x[c].g - y[c].g) + Math.abs(x[c].b - y[c].b)).toBeLessThanOrEqual(0.06);
  });

  it('render.setTime 24 üstünü gösterir, sınırlar 8..32', () => {
    const R = createRender({ quality: { current: () => ({ name: 'dengeli' }) }, dress: null, canvas: undefined } as never);
    const su = (R.sky.material as unknown as { uniforms: { uTop: { value: { r: number; g: number; b: number } } } }).uniforms;
    R.setTime(24); const u1 = { ...su.uTop.value };
    R.setTime(25.5); const u2 = { ...su.uTop.value };
    expect(Math.abs(u1.r - u2.r) + Math.abs(u1.g - u2.g) + Math.abs(u1.b - u2.b)).toBeGreaterThanOrEqual(0.005);
    R.setTime(99); expect(R.hour).toBe(32);
    R.setTime(5); expect(R.hour).toBe(8);
  });
});
