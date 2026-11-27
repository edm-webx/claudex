// 2026-11-27 QA-3: restoran-carpisma.mjs hedef listesi (restoran-carpisma-hedef.json) 11-22 yerleşiminden kalmıştı; 11-25 ters U'dan sonra
// salon masaları 0.9 m / 2 m kaymıştı ve bot boş zemini "masanın içine girdi" sayıyordu (aşama 10'da 75 sahte hit). Liste artık
// icKatiEsya'dan (oyunun kendi çarpışma kutuları) üretilir; bu test eskirse kırmızı olur. Yenilemek: HEDEF_YAZ=1 npx vitest run tests/unit/carpisma-hedef.test.ts
import { it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { IC_BY_ID, icKatiEsya } from '../../src/content/ic-mekan';

const DOSYA = new URL('../browser/restoran-carpisma-hedef.json', import.meta.url);
const SAHIP = ['semaver_dev', 'tas_firin', 'gozleme', 'bal_kaymak', 'buz_tezgah', 'mangal_e', 'akvaryum_e', 'meze_dolap', 'piyano_s', 'sarkuteri'];   // bot bunları alır
const r2 = (v: number) => Math.round(v * 100) / 100;
it('çarpışma botu hedefleri oyunun aşama 10 katı eşyalarıyla aynı', () => {
  const H = (['salonW', 'salonE', 'mutfak'] as const).flatMap(oda => icKatiEsya(IC_BY_ID[oda], 10, SAHIP).map(e => ({ oda, k: e.k, x0: r2(e.r.x0), x1: r2(e.r.x1), z0: r2(e.r.z0), z1: r2(e.r.z1) })));
  if (process.env.HEDEF_YAZ) writeFileSync(DOSYA, JSON.stringify(H) + '\n');
  expect(JSON.parse(readFileSync(DOSYA, 'utf8'))).toEqual(H);
  expect(H.filter(h => h.k === 'salonMasa').length).toBeGreaterThanOrEqual(16);
});
