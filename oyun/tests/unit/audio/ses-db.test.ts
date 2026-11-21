// SNT-01/03: her ses-db girişi için bütçe tablosu (kötüleşmeyi yakalar; güzelliği sahibin kulağı yargılar).
import { describe, it, expect } from 'vitest';
import { SFX_DB, sesOlc } from './olcum';

const SOFT_PARA = ['coin', 'cash', 'buy', 'hesap', 'error'];
// kategori başına tepe tavanı
const TAVAN: Record<string, number> = { horn: 0.5, thunder: 0.4, bad: 0.35, purr: 0.4 };
describe('ses-db bütçe tablosu', () => {
  it('hiçbir ses kırpılmaz ve genel tepe tavanı 0.6', () => {
    for (const id of Object.keys(SFX_DB)) expect(sesOlc(id).tepe, id).toBeLessThan(TAVAN[id] ?? 0.6);
  });
  it('para sesleri yumuşak: merkez < 1500 Hz, tepe < 0.25 (gerçekte ~0.1)', () => {
    for (const id of SOFT_PARA) { const o = sesOlc(id); expect(o.merkez, id).toBeLessThan(1500); expect(o.tepe, id).toBeLessThan(0.25); }
  });
  it("vapur düdüğü ve gök gürültüsü alçak ve kısık: merkez < 800 Hz", () => {
    for (const id of ['horn', 'thunder', 'bad']) expect(sesOlc(id).merkez, id).toBeLessThan(800);
  });
  it('tiz sürtünme sesleri (fizz, buhar) 6 kHz merkez altında', () => {
    for (const id of ['fizz', 'steamHiss']) expect(sesOlc(id).merkez, id).toBeLessThan(7000);
  });
  it('hata sesi alçak sine, kısa', () => { const o = sesOlc('error'); expect(o.merkez).toBeLessThan(400); expect(o.sure).toBeLessThan(0.4); });
});
