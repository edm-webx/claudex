import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { yildirimEk, yildirimAra, YILDIRIM_TEPE, YILDIRIM_TEPE_AZ } from '../../../src/game/view/world/hava-look';
import { MORG_PARLAKLIK } from '../../../src/game/view/world/karsi-yasam';

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
  it('Flaşı azalt: şimşek yumuşak, düşük, tek ve 60 fps karede adımı çok küçük', () => {
    let mx = 0, adim = 0, prev = 0;
    for (let t = 0; t <= 3; t += 1 / 60) { const v = yildirimEk(t, true); mx = Math.max(mx, v); adim = Math.max(adim, Math.abs(v - prev)); prev = v; }
    expect(mx).toBeLessThanOrEqual(YILDIRIM_TEPE_AZ + 1e-6); expect(YILDIRIM_TEPE_AZ).toBeLessThanOrEqual(0.12);
    expect(adim).toBeLessThan(0.02);                       // gece tabanı ~0.5: kare başına <%4
    expect(yildirimEk(2.6, true)).toBe(0); expect(yildirimEk(-1, true)).toBe(0);
    // tek tepe: yükseldikten sonra hiç tekrar artmaz
    let artis = 0, p2 = yildirimEk(0.5, true); for (let t = 0.5; t <= 3; t += 1 / 60) { const v = yildirimEk(t, true); if (v > p2 + 1e-9) artis++; p2 = v; }
    expect(artis).toBe(0);
  });
  it('morg lambası: çok yavaş nefes, yanıp sönme yok', () => {
    let mn = 9, mx = 0, sign = 0, degisim = 0, prev = MORG_PARLAKLIK(0);
    for (let t = 0; t < 20; t += 1 / 60) { const v = MORG_PARLAKLIK(t); mn = Math.min(mn, v); mx = Math.max(mx, v); const s2 = Math.sign(v - prev); if (s2 && s2 !== sign) { degisim++; sign = s2; } prev = v; }
    expect(mn).toBeGreaterThan(0.7); expect(mx).toBeLessThanOrEqual(1);
    expect(degisim / 20).toBeLessThan(1);                  // saniyede 1'den az yön değişimi (0.25 Hz)
    const s = readFileSync(new URL('../../../src/game/view/world/karsi-yasam.ts', import.meta.url), 'utf8');
    expect(s).not.toMatch(/morgLight\.visible\s*=\s*Math\.sin/); expect(s).not.toMatch(/Math\.random\(\)\s*<\s*0\.08\s*\?\s*'#ffffff'/);
  });
  it('bekçi: sinema fırtına filminde beyaz ekran flaşı yok; ayar kayda bağlı ve varsayılan AÇIK', () => {
    const f = readFileSync(new URL('../../../src/game/view/world/sinema-perde.ts', import.meta.url), 'utf8');
    expect(f).not.toMatch(/rgba\(255,255,255,\.55\)/);
    const sch = readFileSync(new URL('../../../src/game/sim/schema.ts', import.meta.url), 'utf8');
    expect(sch).toMatch(/flasAzalt: true/);
  });
});
