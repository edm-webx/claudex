// BUF-04: yemek kataloğu ve 10 aşamalı menü büyümesi.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { restoranApi } from '../../src/game/sim/restoran';
import { DISHES, DISH_BY_ID, acikYemekler, yeniYemekler, menuPano, istasyonAsama, tasiyiciOf } from '../../src/content/yemek-menu';
import { MUTFAK_ISTASYON } from '../../src/content/mutfak';
import { PRODUCT_IDS, PRODUCTS } from '../../src/content/products';
import { SALON, salonOf } from '../../src/game/sim/salon';
import { YEMEK, MALIYET } from '../../src/content/ekonomi2';
import { yemekAgirlik } from '../../src/content/yemek-menu';

describe('yemek kataloğu', () => {
  it('her aşamada menü büyür, aşama 10\'da en az 20 yemek', () => {
    for (let s = 4; s <= 10; s++) expect(acikYemekler(s).length).toBeGreaterThanOrEqual(acikYemekler(s - 1).length);
    for (let s = 3; s <= 10; s++) expect(yeniYemekler(s).length, 'aşama ' + s).toBeGreaterThanOrEqual(2);
    expect(acikYemekler(10).length).toBeGreaterThanOrEqual(20);
  });
  it('veri tutarlı: benzersiz id, geçerli istasyon, istasyon yemekten önce açılmış, fiyat ve taşıyıcı geçerli', () => {
    expect(new Set(DISHES.map(d => d.id)).size).toBe(DISHES.length);
    for (const d of DISHES) {
      expect(MUTFAK_ISTASYON.some(i => i.id === d.istasyon), d.id).toBe(true);
      expect(istasyonAsama(d), d.id).toBeLessThanOrEqual(d.asama);
      expect(d.fiyat).toBeGreaterThan(0); expect(d.hazirlik).toBeGreaterThan(0);
      for (const p of d.tasiyici) expect(PRODUCT_IDS).toContain(p);
      expect(DISH_BY_ID[d.id]).toBe(d);
    }
    expect(DISHES.filter(d => d.kurs).every(d => d.asama === 10 && d.kurs![0] >= 4 && d.kurs![1] <= 6)).toBe(true);
  });
  it('SALON.yeni gerçek menü açılışıyla aynı liste', () => {
    for (let s = 0; s <= 10; s++) expect(SALON[s].yeni).toEqual(yeniYemekler(s).map(d => d.ad));
    expect(salonOf(7).yeni).toContain('Hamsi tava');
  });
  it('menü panosu: aşama aşama açılır, kilitliler Türkçe etiketli', () => {
    const p = menuPano(5);
    expect(p.length).toBe(10);
    expect(p[4].yemekler.every(y => y.acik && y.kilit === '')).toBe(true);
    const k = p[6].yemekler[0]; expect(k.acik).toBe(false); expect(k.kilit).toBe('Aşama 7\'de açılır');
  });
  it('ortalama adisyon SALON.adisyon bandında kalır (ekonomi dengesi)', () => {
    const tipler = ['teyze', 'emekli', 'universiteli', 'taraftar', 'isinsani', 'balayi', 'plaza'];
    for (let s = 3; s <= 10; s++) {
      const dishes = acikYemekler(s); const pay = YEMEK.pay[s - 1];
      let sum = 0, w = 0;
      for (const t of tipler) {
        const ws = dishes.map(d => yemekAgirlik(d, t, null)), tw = ws.reduce((a, b) => a + b, 0);
        const dishAvg = dishes.reduce((a, d, i) => a + (d.kurs ? d.fiyat / 3 : d.fiyat) * ws[i] / tw, 0);
        sum += pay * dishAvg + (1 - pay) * 50; w++;   // eski ürünlerin ortalaması ~50 ₺
      }
      const kalem = sum / w, adisyon = kalem * 2.3, hedef = salonOf(s).adisyon;
      expect(adisyon, 'aşama ' + s).toBeGreaterThan(hedef * 0.2); expect(adisyon, 'aşama ' + s).toBeLessThan(hedef * (s < 6 ? 3 : 1.8));   // erken aşamalarda masa bileti zaten tezgâh fiyatlarıyla SALON'dan yüksek
    }
  });
  it('birim maliyet taşıyıcı oranından gelir (stok yok)', () => { for (const d of DISHES) expect(MALIYET[d.tasiyici[0]]).toBeGreaterThan(0); });
});

function kur(stage: number) {
  const sim: any = played(7);
  for (let i = 0; i < 60; i++) sim.step(0.1);
  sim.command({ kind: 'force', what: 'money', value: 2_000_000_000 });
  for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
  sim.command({ kind: 'force', what: 'stage', value: stage });
  sim.state.workers.push({ id: 501, name: 'Nazlı', role: 'garson', xp: 0, morale: 70, traits: ['hamarat'] });
  return sim;
}
describe('masa bileti yemekleri', () => {
  it('açık yemekler aşamayla artar', () => {
    const a = restoranApi(kur(4).rules)!.openDishes().length, b = restoranApi(kur(8).rules)!.openDishes().length;
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a);
  });
  it('aşama 8\'de masa biletleri yemek adıyla çıkar, servis edilir ve yemek fiyatıyla satılır', () => {
    const sim = kur(8), api = restoranApi(sim.rules)!;
    const goruldu = new Set<string>(); let dishBill = 0;
    for (let s = 0; s < 500; s++) {
      for (let i = 0; i < 10; i++) sim.step(0.1);
      const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; }
      for (const p of ['cay', 'ayran', 'simit', 'tost', 'gazoz', 'doner']) { const b = (r.counter[p] ||= []); if (b.length < 4) b.push({ type: p, tier: 1 }); }
      for (const t of api.view().tickets) for (const it of t.items) if (it.dish) goruldu.add(it.name);
    }
    for (const n of goruldu) expect(DISHES.some(d => d.ad === n)).toBe(true);
    expect(goruldu.size).toBeGreaterThan(0);
    dishBill = Object.keys(sim.state.stats).filter(k => k.startsWith('yemek_')).length;
    expect(dishBill).toBeGreaterThan(0);
    expect((sim.state.stats.adisyon || 0)).toBeGreaterThan(0);
  }, 120000);
  it('aşama 10\'da tadım menüsü art arda servis olarak tamamlanır', () => {
    const sim = kur(10), api = restoranApi(sim.rules)!;
    let tadim = 0, hesap = 0;
    for (let s = 0; s < 1500 && !tadim; s++) {
      for (let i = 0; i < 10; i++) sim.step(0.1);
      const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; }
      for (const p of ['cay', 'ayran', 'simit', 'tost', 'gazoz', 'doner']) { const b = (r.counter[p] ||= []); if (b.length < 6) b.push({ type: p, tier: 1 }); }
      for (const t of api.view().tickets) { const it = t.items.find(i => i.dish === 'tadim_menusu'); if (it) { tadim = it.n; expect(it.n).toBeGreaterThanOrEqual(4); expect(it.n).toBeLessThanOrEqual(6); } }
    }
    expect(tadim).toBeGreaterThan(0);
    for (let s = 0; s < 400; s++) { for (let i = 0; i < 10; i++) sim.step(0.1); const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; } for (const p of ['cay', 'ayran', 'simit', 'tost', 'gazoz', 'doner']) { const b = (r.counter[p] ||= []); if (b.length < 6) b.push({ type: p, tier: 1 }); } }
    hesap = sim.state.stats.yemek_tadim_menusu || 0;
    expect(hesap).toBeGreaterThanOrEqual(4);
  }, 300000);
  it('aşama 2\'de tezgâh ürünleri aynen kalır (yemek yok)', () => {
    const api = restoranApi(kur(2).rules)!; expect(api.openDishes().length).toBe(0);
    expect(PRODUCTS.doner.base).toBe(160);
  });
});
void tasiyiciOf;
