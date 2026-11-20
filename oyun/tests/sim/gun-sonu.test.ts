// BUF-26: gün sonu raporu kalem kalem; satırlar birbirini tutar (brüt - maliyet - maaş + yan = ciro, ciro - gider = net kâr, kasa).
import { describe, it, expect } from 'vitest';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
const log = { info() {}, warn() {}, error() {} };
function mk() {
  const sim: any = createSim({ seed: 11, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  sim.rules.rt.gunSonuCard = true;
  return sim;
}
const gunBitir = (sim: any) => { sim.rules.state.dayT = 1e9; sim.step(0.1); return sim.rules.rt.uiLast.gunSonu; };

describe('gün sonu raporu', () => {
  it('kalemler tutar: brüt, birim maliyet, personel, kira/fatura, net kâr, kasa', () => {
    const sim = mk(), S = sim.rules.state;
    S.stage = 4; S.money = 1e6;
    const w = S.workers[0] || (S.workers.push({ id: 901, name: 'Ali', role: 'garson', xp: 0 }), S.workers[0]);
    w.paidToday = 120;
    const T = S.today; T.sales = 5000; T.cost = 800; T.earned = 5000 - 800 + 300; T.salonGelir = 300; T.salonMis = 12; T.masaServis = 4; T.masaBekleS = 100;
    const m = gunBitir(sim);
    expect(m).toBeTruthy();
    expect(m.brut).toBe(5120); expect(m.birimMaliyet).toBe(800); expect(m.maas).toBe(120);
    expect(m.kisiler[0]).toMatchObject({ ad: w.name, maas: 120 });
    expect(m.brut - m.birimMaliyet - m.maas + m.salon.gelir + m.yan).toBe(m.earned);
    expect(m.salon).toEqual({ gelir: 300, misafir: 12 });
    expect(m.masa).toEqual({ servis: 4, bekleS: 25 });
    expect(m.gider.odenen).toBe(m.gider.kira + m.gider.fatura); expect(m.gider.ertelendi).toBe(0);
    expect(m.netKar).toBe(m.earned - m.gider.odenen);
    expect(m.money).toBe(Math.round(S.money));   // kart gider kesildikten SONRA yazıldı
    expect(m.money).toBe(1e6 - m.gider.odenen);
  });
  it('kasa yetmezse gider ertelendi olarak kartta görünür, kasa negatif olmaz', () => {
    const sim = mk(), S = sim.rules.state;
    S.stage = 5; S.money = 500; S.today.sales = 100000; S.today.earned = 0;
    const m = gunBitir(sim);
    expect(m.gider.odenen).toBe(500); expect(m.gider.ertelendi).toBe(m.gider.kira + m.gider.fatura - 500);
    expect(m.gider.ertelendi).toBeGreaterThan(0);
    expect(m.money).toBe(0);
  });
  it('opsiyonel alanlar yoksa gizli: hijyen ve işletme undefined; varsa gün eşleşirse gelir', () => {
    const sim = mk();
    expect(gunBitir(sim).hijyen).toBeUndefined();
    const sim2 = mk(), R = sim2.rules.rt, day = sim2.rules.state.day;
    R.uiLast.hijyenGun = { day, not: 'A', marti: 3 };
    const m = gunBitir(sim2);
    expect(m.hijyen).toEqual({ not: 'A', mufettis: undefined, marti: 3 });
    expect(m.isletme).toBeUndefined();   // işletme kadrosu yok: gün sonu maaş satırı kartta görünmez (mulk.ts günü kendi hesaplar, kart bunu okur)
  });
});
