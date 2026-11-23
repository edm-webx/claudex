// 2026-11-23 yürüyüş turu (tests/browser/yuruyus-turu.mjs) bulgusu: halı sahanın doğu çitindeki tek kapı boşluğunu doğu kale ağı,
// tesis binasının kapısını batı kale ağı kapatıyordu: sahaya ve Tesis Kafeteryası'na (k6) girilemiyordu. Kilit: prefab
// çarpıştırıcıları dünyaya konunca doğu çit hattında oyuncu gövdesinin (0.36 m yarıçap) geçeceği boşluk var, tesis kapısının önü boş.
import { it, expect } from 'vitest';
import { karsiPrefabs, karsiProps } from '../../../src/content/zones/karsi';
import { placeRect } from '../../../src/engine/zones/index';

const defs = new Map(karsiPrefabs().map(d => [d.id, d]));
const rects = karsiProps().flatMap(p => (defs.get(p.prefab)?.colliders || []).map(r => placeRect(r, p)));
const dolu = (x: number, z: number, r: number) => rects.some(q => x + r > q.x0 && x - r < q.x1 && z + r > q.z0 && z - r < q.z1);

it('halı saha doğu çitinde gövdenin geçtiği kapı boşluğu var (dışarı → içeri düz geçiş)', () => {
  const R = 0.38;
  const gecer = (z: number) => { for (let x = -24.5; x >= -29; x -= 0.05) if (dolu(x, z, R)) return false; return true; };
  let acik = 0; for (let z = 36.5; z <= 54.3; z += 0.05) if (gecer(z)) acik++;
  expect(acik, 'çit hattında geçilebilir şerit (0.05 m adım)').toBeGreaterThan(4);
});
it('tesis kapısının önü (x -52.25 hattı) kale ağıyla kapalı değil', () => {
  let bos = 0; for (let z = 43; z <= 48; z += 0.1) if (!dolu(-51.2, z, 0.36)) bos++;
  expect(bos).toBeGreaterThan(3);
});
