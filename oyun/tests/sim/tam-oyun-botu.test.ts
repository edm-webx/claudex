// Tam oyun botu (tests/sim/tam-oyun-botu.ts): admin'siz, yalnız oyuncu akışıyla. Varsayılan (her koşuda, ~1 dk): sıfırdan 200 oyun dakikası,
// aşama 3'e varır, her aşamada kaydet/yükle turu, hiç bulgu yok. TAM=1: aşama 10'a kadar (uzun, ~30-60 dk), rapor calisma/tam-oyun-botu/rapor.json.
import { it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { tamOyun } from './tam-oyun-botu';

const TAM = !!process.env.TAM;

it(TAM ? 'tam oyun: aşama 1 → 10, tıkanma ve bulgu yok' : 'oyuncu akışı: 200 dk, aşama 3, kayıt/yükle turu, bulgu yok', async () => {
  const r = await tamOyun({ tohum: 11, maxDk: TAM ? 9000 : 200, hedefAsama: TAM ? 10 : 3, tikanmaDk: 150 });
  if (TAM) { const d = resolve(__dirname, '../../calisma/tam-oyun-botu'); mkdirSync(d, { recursive: true }); writeFileSync(d + '/rapor.json', JSON.stringify(r, null, 1) + '\n'); }
  expect(r.bulgular, JSON.stringify(r.bulgular, null, 1)).toEqual([]);
  expect(r.tikanma).toBeNull();
  expect(r.son.asama).toBeGreaterThanOrEqual(TAM ? 10 : 3);
  expect(r.kayitTuru).toBeGreaterThanOrEqual(TAM ? 9 : 2);
}, TAM ? 7_200_000 : 300_000);
