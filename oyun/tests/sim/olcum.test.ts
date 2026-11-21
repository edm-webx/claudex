import { it, expect } from 'vitest';
import { sakin, yuzdelik } from './olcum';

// Sentetik: taban 0.4 ms. Gürültü her turda başka tick'e düşer (CPU yarışması). Gerçek sıçrama her turda tick 700'de.
function tur(seed: number, gercek: number) {
  let s = seed; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const a = new Array(1000).fill(0).map(() => 0.4 + r() * 0.1);
  for (let k = 0; k < 20; k++) a[Math.floor(r() * 1000)] += 30;   // rastgele işletim sistemi sıçramaları
  if (gercek) a[700] += gercek;
  return a;
}

it('kararlı ölçüm: rastgele gürültüyü siler, her turda tekrarlanan gerçek sıçramayı korur', () => {
  const gurultu = [1, 2, 3, 4, 5].map(i => tur(i * 7919, 0));
  expect(Math.max(...gurultu[0])).toBeGreaterThan(20);              // ham tur gürültülü
  expect(Math.max(...sakin(gurultu))).toBeLessThan(1);             // sakin seri temiz
  const gercek = [1, 2, 3, 4, 5].map(i => tur(i * 7919, 40));
  expect(Math.max(...sakin(gercek))).toBeGreaterThan(35);          // gerçek sıçrama kalır
  expect(yuzdelik(sakin(gercek), 0.5)).toBeLessThan(1);
});
