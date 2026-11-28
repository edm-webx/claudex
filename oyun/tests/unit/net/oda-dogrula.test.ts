// QA 2026-11-27 teknik rapor 06: odada herkes `kasa` ile sınırsız para basabiliyor, sahte `dunya` misafiri ele geçiriyordu.
import { describe, it, expect } from 'vitest';
import { kasaKabul, dunyaKabul, KASA_TABAN_DK, DUNYA_MAX, type KasaDefter } from '../../../src/game/net/oda-dogrula';

describe('ev sahibi kasa doğrulaması', () => {
  it('yalnız gerçek sayı, pozitif, odadaki misafirden', () => {
    const d: KasaDefter = new Map();
    expect(kasaKabul(d, 'm1', '5000', true, 0, 0)).toBe(0);       // string (eskiden kabul ediliyordu)
    expect(kasaKabul(d, 'm1', -5000, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'm1', Infinity, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'm1', NaN, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'm1', null, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'yabanci', 500, false, 0, 0)).toBe(0);    // odada görünmeyen / ev sahibi görünen
    expect(kasaKabul(d, 7, 500, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'm1', 500.7, true, 0, 0)).toBe(500);
  });
  it('raporun saldırısı: 5 x 9M paket ev sahibine en çok bir dakikalık bütçe verir', () => {
    const d: KasaDefter = new Map(); let top = 0;
    for (let i = 0; i < 5; i++) top += kasaKabul(d, 'hileci', 9_000_000, true, i * 0.1, 0);
    expect(top).toBeLessThanOrEqual(KASA_TABAN_DK);
    // bir saat boyunca saniyede bir 1M: bütçe dakikada bir dolar, toplam ~60 dk x bütçe (eskiden 3.6 milyar)
    let saat = 0; for (let t = 1; t <= 3600; t++) saat += kasaKabul(d, 'hileci', 1_000_000, true, t, 0);
    expect(saat).toBeLessThanOrEqual(KASA_TABAN_DK * 61);
  });
  it('dürüst misafir: ev sahibinin gelirine göre bütçe, 2 sn de bir normal satış tam geçer', () => {
    const d: KasaDefter = new Map(); let top = 0, gonder = 0;
    const gelirDk = 40000;   // ev sahibinin dakikalık geliri
    for (let t = 0; t < 600; t += 2) { const n = 1200; gonder += n; top += kasaKabul(d, 'ali', n, true, t, gelirDk); }   // 36k/dk
    expect(top).toBe(gonder);
  });
  it('her misafirin ayrı kovası var', () => {
    const d: KasaDefter = new Map();
    expect(kasaKabul(d, 'a', KASA_TABAN_DK, true, 0, 0)).toBe(KASA_TABAN_DK);
    expect(kasaKabul(d, 'a', 100, true, 0, 0)).toBe(0);
    expect(kasaKabul(d, 'b', 100, true, 0, 0)).toBe(100);
    expect(kasaKabul(d, 'a', 100, true, 30, 0)).toBe(100);   // yarım dakikada yarı dolar
  });
});

describe('misafir dünya doğrulaması', () => {
  const pl = (id: string, w = '{}') => ({ id, w, sig: 's1', ad: 'Hoca' });
  const ev = new Set(['host']);
  it('yalnız presence ev sahibi olandan, ilk ev sahibine sabit', () => {
    expect(dunyaKabul(pl('hileci'), '', id => ev.has(id))).toBe(null);
    expect(dunyaKabul(pl('host'), '', id => ev.has(id))).toBe('host');
    // ikinci biri kendini ev sahibi diye duyursa da sabitlenen ev sahibinden başkası dünya dayatamaz
    expect(dunyaKabul(pl('hileci2'), 'host', () => true)).toBe(null);
    expect(dunyaKabul(pl('host'), 'host', id => ev.has(id))).toBe('host');
  });
  it('şekil ve boyut', () => {
    expect(dunyaKabul({ id: 'host', w: 5, sig: 's' }, '', () => true)).toBe(null);
    expect(dunyaKabul({ id: 'host', w: '{}' }, '', () => true)).toBe(null);
    expect(dunyaKabul(pl('host', 'x'.repeat(DUNYA_MAX + 1)), '', () => true)).toBe(null);
    expect(dunyaKabul({ w: '{}', sig: 's' }, '', () => true)).toBe(null);
  });
});
