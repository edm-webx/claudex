// EKO-01: ilerleme eğrisi ölçümü. Üç strateji (normal, yarı etkin) sabit tohumlarla koşar; çıktı: tablo, CSV, tek sayfalık HTML.
// Varsayılan: 3 oyun saati, 2 tohum, bugünkü dengenin gerileme bandı. EKO_HEDEF=1: tasarım hedefi bantları (bugün KIRMIZI, EKO-05 bekliyor).
// EKO_UZUN=<saat>: uzun koşu (gece koşusu). EKO_CIKTI=<klasör>: CSV ve eğri HTML'i oraya yazar (repoya değil).
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { kosu, ortalama, paylar, toplamDk, csv, tablo, egriHtml, type Kosu } from './ekonomi-harness';
import { HEDEF_ASAMA_DK, HEDEF_ASAMA_TOLERANS, HEDEF_ILK_ISLETME_DK, ETKIN_ORAN, KAYNAK_PAY, HEDEF_GIDER_ORAN, OLU_BOLGE_DK, MEVCUT_TOPLAM_KAZANC, MEVCUT_ASAMA2_DK } from '../../src/content/ekonomi-hedef';

const HEDEF = !!process.env.EKO_HEDEF, SAAT = Number(process.env.EKO_UZUN) || 3, TOHUMLAR = [3, 7];
const sonuc: { normal: Kosu; yari: Kosu; bos: Kosu } = {} as never;

beforeAll(() => {
  const saniye = SAAT * 3600;
  sonuc.normal = ortalama(TOHUMLAR.map(t => kosu({ tohum: t, saniye, strateji: 'normal' })));
  sonuc.yari = ortalama(TOHUMLAR.map(t => kosu({ tohum: t, saniye, strateji: 'yari' })));
  sonuc.bos = ortalama(TOHUMLAR.map(t => kosu({ tohum: t, saniye: Math.min(saniye, 7200), strateji: 'bos' })));
  console.log(tablo(sonuc.normal) + '\n' + tablo(sonuc.yari) + '\n' + tablo(sonuc.bos));
  const dir = process.env.EKO_CIKTI;
  if (dir) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(dir + '/egri-normal.csv', csv(sonuc.normal)); writeFileSync(dir + '/egri-yari.csv', csv(sonuc.yari)); writeFileSync(dir + '/egri-bos.csv', csv(sonuc.bos));
    writeFileSync(dir + '/egri.html', egriHtml([sonuc.normal, sonuc.yari, sonuc.bos], 'Ekonomi eğrisi: normal ve yarı etkin oyuncu'));
  }
}, 3_000_000);

const gunlukNetGelir = (k: Kosu) => k.gunler.length ? k.gunler.reduce((t, g) => t + g.kazanc, 0) / k.gunler.length : 0;

describe('ekonomi eğrisi: bugünkü denge (gerileme bandı)', () => {
  it('toplam kazanç 30/60/90. dakikada bantın içinde', () => {
    for (const [dk, [lo, hi]] of Object.entries(MEVCUT_TOPLAM_KAZANC)) {
      if (+dk > SAAT * 60) continue;
      const v = toplamDk(sonuc.normal, +dk);
      expect(v, dk + '. dk toplam ' + v).toBeGreaterThanOrEqual(lo); expect(v, dk + '. dk toplam ' + v).toBeLessThanOrEqual(hi);
    }
  });
  it('2. aşamaya varış penceresi', () => {
    const v = sonuc.normal.asamaDk[2]; expect(v).toBeDefined();
    expect(v).toBeGreaterThanOrEqual(MEVCUT_ASAMA2_DK[0]); expect(v).toBeLessThanOrEqual(MEVCUT_ASAMA2_DK[1]);
  });
  it('eğri tek yönlü artar, para eksiye düşmez, kaynak payları toplamı 1', () => {
    for (const k of [sonuc.normal, sonuc.yari]) {
      let p = -1; for (const s of k.satirlar) { expect(s.toplam).toBeGreaterThanOrEqual(p); p = s.toplam; expect(s.para).toBeGreaterThanOrEqual(0); }
      const t = paylar(k); expect(t.tezgah + t.salon + t.isletme + t.diger).toBeCloseTo(1, 6);
    }
  });
  it('yarı etkin oyuncu normal oyuncudan fazla kazanamaz, sıfır da değil (bugün oran ~1,05: talep sınırlı)', () => {
    const o = toplamDk(sonuc.normal, SAAT * 60) / Math.max(1, toplamDk(sonuc.yari, SAAT * 60));
    console.log('etkin/yarı etkin toplam gelir oranı: ' + o.toFixed(2));
    expect(o).toBeGreaterThanOrEqual(0.95); expect(o).toBeLessThan(6);
  });
  it('hiç dokunmayan oyuncu pasif gelir kazanmaz (çevrimdışı/pasif gelir yok kuralı)', () => {
    const sure = Math.min(SAAT, 2) * 60; expect(toplamDk(sonuc.bos, sure)).toBeLessThan(0.02 * toplamDk(sonuc.normal, sure));
  });
  it('ilk işletme alınır (büfe 2. aşama + seviye + para) ve bu eğri satırlarına yansır', () => {
    // 3 saatlik koşuda en az bir tohum ilk işletmeyi almış olmalı; yoksa para akışı holdinge yetmiyor demektir
    expect(sonuc.normal.ilkIsletmeDk, 'ilk işletme dk').not.toBeNull();
    const son = sonuc.normal.satirlar[sonuc.normal.satirlar.length - 1]; expect(son.holdingDeger).toBeGreaterThan(0);
  });
});

describe.skipIf(!HEDEF)('ekonomi eğrisi: tasarım hedefi (EKO_HEDEF=1, EKO-05 sonrası yeşil olmalı)', () => {
  it('aşamaya varış süreleri EKO-05 hedef bandında', () => {
    for (const [a, dk] of Object.entries(HEDEF_ASAMA_DK)) {
      if (+a > Math.max(...Object.keys(sonuc.normal.asamaDk).map(Number), 1) + 1) continue;
      const v = sonuc.normal.asamaDk[+a]; expect(v, 'aşama ' + a + ' varış').toBeDefined();
      expect(v).toBeGreaterThanOrEqual(dk * (1 - HEDEF_ASAMA_TOLERANS)); expect(v).toBeLessThanOrEqual(dk * (1 + HEDEF_ASAMA_TOLERANS));
    }
  });
  it('ilk işletme hedef penceresinde', () => { const v = sonuc.normal.ilkIsletmeDk!; expect(v).toBeGreaterThanOrEqual(HEDEF_ILK_ISLETME_DK[0]); expect(v).toBeLessThanOrEqual(HEDEF_ILK_ISLETME_DK[1]); });
  it('etkin / yarı etkin gelir oranı 1,5-3', () => { const o = toplamDk(sonuc.normal, SAAT * 60) / toplamDk(sonuc.yari, SAAT * 60); expect(o).toBeGreaterThanOrEqual(ETKIN_ORAN[0]); expect(o).toBeLessThanOrEqual(ETKIN_ORAN[1]); });
  it('tek kaynak payı en çok %60', () => { const p = paylar(sonuc.normal); expect(Math.max(p.tezgah, p.salon, p.isletme, p.diger)).toBeLessThanOrEqual(KAYNAK_PAY.tekKaynakMax); });
  it('gider / satış oranı aşama bandında', () => {
    for (const { asama, band } of HEDEF_GIDER_ORAN) {
      const s = sonuc.normal.satirlar.filter(x => x.asama === asama && x.satis > 0); if (!s.length) continue;
      const o = s.reduce((t, x) => t + x.gider, 0) / s.reduce((t, x) => t + x.satis, 0); expect(o).toBeGreaterThanOrEqual(band[0]); expect(o).toBeLessThanOrEqual(band[1]);
    }
  });
  it('ölü bölge: hiçbir aşama aralığı 90 dakikadan uzun değil', () => {
    const dk = Object.entries(sonuc.normal.asamaDk).map(([, v]) => v).sort((a, b) => a - b); let p = 0;
    for (const v of dk) { expect(v - p).toBeLessThanOrEqual(OLU_BOLGE_DK); p = v; }
  });
});

void gunlukNetGelir;
