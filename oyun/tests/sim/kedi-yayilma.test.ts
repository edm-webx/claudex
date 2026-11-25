import { describe, it, expect } from 'vitest';
import { makeSandbox } from './agents-harness';

/** Kediler birbirinin içine girmemeli: çok kedili sahnede çakışma ölçümü (dokunan çift = mesafe < ESIK). */
const ESIK = 0.45;
function olc(seed: number, hareket: boolean) {
  const sb = makeSandbox(seed, (s) => { for (let i = 0; i < 300; i++) s.ach['a' + i] = 1; s.tut.catPet = 1; });
  sb.step(2);
  const n = sb.h.cats.rows().length;
  let kare = 0, ic = 0, enAz = 9;
  for (let t = 0; t < 1500; t++) {   // 1500 x 0.25 s ≈ 6 dk oyun
    sb.moving.v = hareket && (t % 40) < 6;
    if (hareket && t % 80 === 0) { sb.player.x += 0.5; sb.player.z -= 0.2; }
    sb.step(0.25);
    const r = sb.h.cats.rows(); kare++;
    let c = 0;
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) { const d = Math.hypot(r[i].x - r[j].x, r[i].z - r[j].z); enAz = Math.min(enAz, d); if (d < ESIK) { c++; if (process.env.KEDI_DBG) console.log('X', t, r[i].state, r[j].state, d.toFixed(2)); } }
    if (c) ic++;
  }
  return { n, kare, icIceKare: ic, oran: +(ic / kare).toFixed(3), enAz: +enAz.toFixed(2) };
}
describe('kedi yayılma', () => {
  it('çok kedili sahnede kediler iç içe girmez', () => {
    const a = olc(5, false), b = olc(6, true);
    console.log('KEDI-OLCUM', JSON.stringify({ duran: a, yuruyen: b }));
    expect(a.n).toBeGreaterThanOrEqual(6);
    expect(a.oran).toBeLessThan(0.02); expect(b.oran).toBeLessThan(0.02);
  });
});
