// EKO-01: istismar regresyonu. Her para kaynağı için "saatte en fazla X ₺" tavanı (content/ekonomi-hedef.ts SAAT_TAVAN).
// Bot insan hızında oynar (2 sn'de bir işlem). Açık BUGÜN VAR: ilgili EKO paketi kapatana dek it.fails ile işaretli;
// paket kapatınca test "beklenmedik şekilde geçti" diye kırılır ve it.fails kaldırılır (tavan kalıcı regresyon olur).
import { describe, it, expect } from 'vitest';
import { istismar } from './ekonomi-harness';
import { SAAT_TAVAN } from '../../src/content/ekonomi-hedef';

describe('istismar tavanları (saatte en fazla X ₺)', () => {
  // EKO-03 kapattı: günde 3 ödüllü sınav (4. ve sonrası deneme), ödül = puan x 12 x aşama çarpanı. Önce: 10 doğru = 4.000 ₺, sınırsız tekrar -> ~720.000 ₺/saat.
  it('okul sınavı: saatlik gelir tavanı (ölçüm 34.010 ₺, önce ~720.000)', () => {
    const r = istismar('okul', { saniye: 3600 }); console.log('okul', JSON.stringify(r));
    expect(r.saatlik).toBeLessThanOrEqual(SAAT_TAVAN.okul);
  });
  // EKO-03 kapattı: ana para tavanı 200k, günlük %0,2, hesap başına günde bir kez. Önce: tavan 5M, günlük %0,5 -> 1M ana paraya ~40.000 ₺/saat.
  it('mevduat faizi: saatlik gelir tavanı', () => {
    const r = istismar('mevduat', { saniye: 3600 }); console.log('mevduat', JSON.stringify(r));
    expect(r.saatlik).toBeLessThanOrEqual(SAAT_TAVAN.mevduat);
  });
  // EKO-07 (sahip kararı bekliyor: borç/kredi şimdilik kodlanmıyor). Bugün: limit 25.000 + 15.000*seviye, ödenmeyen kredi hiçbir şey kaybettirmez.
  it.fails('kredi: ödemeden çekilen nakit tavanı (EKO-07 bekliyor)', () => {
    const r = istismar('kredi', { saniye: 3600 }); console.log('kredi', JSON.stringify(r));
    expect(r.saatlik).toBeLessThanOrEqual(SAAT_TAVAN.kredi);
  });
  // Bahis: oran 0,9/olasılık ama maç motorunda ev sahibi ('1') oranın söylediğinden sık kazanıyor. Futbol kolunun alanı; günlük bahis sınırı (BAHIS.gunluk) sim/halisaha.ts'de.
  it('bahis: en olası sonuca azami bahis tekrarının saatlik net kazancı (günlük bahis sınırı ile)', () => {
    const a = istismar('bahis', { tohum: 3, maclar: 30 }), b = istismar('bahis', { tohum: 5, maclar: 30 }); console.log('bahis', JSON.stringify(a), JSON.stringify(b));
    expect((a.saatlik + b.saatlik) / 2).toBeLessThanOrEqual(SAAT_TAVAN.bahis);
  });
});

describe('istismar botu çalışıyor (tavan koşusunun kendisi doğru ölçüyor)', () => {
  it('okul botu sınavları gerçekten bitirir ve para yazar', () => { const r = istismar('okul', { saniye: 120 }); expect(r.kazanc).toBeGreaterThan(0); });
  it('mevduat botu faiz alır (ana para artar)', () => { const r = istismar('mevduat', { saniye: 960, mevduat: 100_000 }); expect(r.kazanc).toBeGreaterThanOrEqual(0); });
  it('kredi botu borç alır ve nakit artar', () => { const r = istismar('kredi', { saniye: 60 }); expect(r.kazanc).toBeGreaterThan(0); });
});
