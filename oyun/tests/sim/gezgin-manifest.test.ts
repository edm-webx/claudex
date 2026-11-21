// KAL-13: gezgin botların bina/etkileşim manifesti içerik tablolarından türetilir ve repodaki kopyayla eşleşir.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error saf .mjs araç, tipi yok
import { manifestUret } from '../../tools/gezgin-manifest.mjs';
import { IC_MEKANLAR, IC_CANLI } from '../../src/content/ic-mekan';
import { ARSALAR } from '../../src/content/esya';

const m = manifestUret();
type B = { id: string; canli: boolean; merkez: { x: number; z: number }; boy: { wx: number; wz: number }; kapiDis: { x: number; z: number }; kapiIc: { x: number; z: number }; noktalar: { ad: string; x: number; z: number }[] };
const icinde = (b: B, p: { x: number; z: number }, pay = 0) => Math.abs(p.x - b.merkez.x) < b.boy.wx / 2 + pay && Math.abs(p.z - b.merkez.z) < b.boy.wz / 2 + pay;

describe('gezgin manifesti', () => {
  it('her iç mekan ve her arsa manifestte; canlı işletmeler IC_CANLI ile aynı', () => {
    expect(m.binalar.map((b: B) => b.id).sort()).toEqual(IC_MEKANLAR.map(x => x.id).sort());
    expect(m.arsalar.map((a: { id: string }) => a.id).sort()).toEqual(ARSALAR.map(a => a.id).sort());
    expect(m.binalar.filter((b: B) => b.canli).length).toBe(IC_CANLI.length);
  });
  it('kapı önü bina dışında, kapı içi ve iç noktalar bina içinde (bot kapıdan geçmek zorunda)', () => {
    for (const b of m.binalar as B[]) {
      expect(icinde(b, b.kapiDis), b.id + ' kapı önü').toBe(false);
      expect(icinde(b, b.kapiIc), b.id + ' kapı içi').toBe(true);
      for (const n of b.noktalar) expect(icinde(b, n, 0.2), `${b.id} ${n.ad}`).toBe(true);
    }
  });
  it('repodaki tests/browser/gezgin/manifest.json içerikle güncel (değişince: npx vite-node tools/gezgin-manifest.mjs --yaz)', () => {
    const kayit = JSON.parse(readFileSync(new URL('../browser/gezgin/manifest.json', import.meta.url), 'utf8'));
    expect(kayit).toEqual(JSON.parse(JSON.stringify(m)));
  });
});
