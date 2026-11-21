import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { yildirimEk, yildirimAra, YILDIRIM_TEPE } from '../../../src/game/view/world/hava-look';

describe('ışık titremesi ve şimşek (GRS-02)', () => {
  it('şimşek tavanı +0.35 ve kısa', () => {
    let mx = 0; for (let t = 0; t <= 1; t += 0.001) mx = Math.max(mx, yildirimEk(t));
    expect(mx).toBeLessThanOrEqual(YILDIRIM_TEPE + 1e-6); expect(YILDIRIM_TEPE).toBeLessThanOrEqual(0.35);
    expect(yildirimEk(0.7)).toBe(0); expect(yildirimEk(-1)).toBe(0);
  });
  it('şimşek seyrek: fırtına >= 20 sn, sağanak >= 40 sn', () => {
    for (const r of [0, 0.3, 1]) { expect(yildirimAra('firtina', r)).toBeGreaterThanOrEqual(20); expect(yildirimAra('saganak', r)).toBeGreaterThanOrEqual(40); }
  });
  it('bekçi: büfe floresanı titremez', () => {
    const s = readFileSync(new URL('../../../src/game/view/world/index.ts', import.meta.url), 'utf8');
    const i = s.indexOf('animFloresan'); expect(i).toBeGreaterThan(0);
    const body = s.slice(i, i + 900);
    expect(body).not.toMatch(/Math\.random|Math\.sin\(t\s*\*/);
  });
  it('bekçi: morg lambası yanıp sönmez', () => {
    const s = readFileSync(new URL('../../../src/game/view/world/ic-mekan-look.ts', import.meta.url), 'utf8');
    expect(s).not.toMatch(/lamps\.visible\s*=\s*Math\.sin/);
    expect(s).not.toMatch(/Math\.sin\(t \* (?:1[6-9]|[2-9]\d)\b/);   // nothing in the rooms pulses faster than ~2.5 Hz
  });
});
