// 2026-11-22 sahibi: "sağda solda farklı restoran gibi görünen her yere masa alalım tek tek sarı karelerle müşteriler oturabilsin".
// Kanat / salon / çatı masaları aşama açınca kendiliğinden kurulmaz: her bölgenin ilk masası hediye, gerisi masanın yerinde (çatıda
// merdiven ayağında) sarı kareyle tek tek alınır; alınan masa sim masasıdır (oturulur), çizilir ve katıdır.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { kanatKurulu, kanatAcik, kanatOf, masaHediye, masaFiyat, setMasaAlinan, KANAT_BASE } from '../../src/content/kanat';
import { icColliders, IC_BY_ID } from '../../src/content/ic-mekan';

const kareler = (sim: ReturnType<typeof played>) => sim.rules.rt.pads.filter(p => p.key.startsWith('masa.'));
describe('kanat ve salon masaları sarı karelerle', () => {
  it('yeni oyunda aşama 3: çay bahçesinin yalnız ilk masası kurulu, sıradaki masa kendi yerinde karede; alınca oturulabilir', () => {
    const sim = played(11); sim.step(1);
    sim.state.stage = 3; sim.state.money = 1e8; sim.step(1);
    const ac = kanatAcik(3), kur = kanatKurulu(3);
    expect(kur).toEqual(ac.filter(masaHediye)); expect(kur.length).toBe(1);
    expect(sim.rules.rt.tables[kur[0]].built).toBe(true);
    expect(ac.filter(i => !masaHediye(i)).every(i => !sim.rules.rt.tables[i]?.built)).toBe(true);
    const k = kareler(sim); expect(k.length).toBe(1);   // bölge başına bir kare
    const i = Number(k[0].key.slice(5)), m = kanatOf(i)!;
    expect(Math.hypot(k[0].pos.x - m.x, k[0].pos.z - m.z)).toBeLessThan(0.01); expect(k[0].price).toBe(masaFiyat(i)); expect(k[0].price).toBeGreaterThan(0);
    const m0 = sim.state.money;
    sim.command({ kind: 'mulk', op: 'masaAl', e: i } as never); sim.step(1);
    expect(kanatKurulu(3)).toContain(i); expect(sim.rules.rt.tables[i].built).toBe(true); expect(sim.state.money).toBe(m0 - masaFiyat(i));
    expect(kareler(sim).some(p => p.key === 'masa.' + i)).toBe(false); expect(kareler(sim).length).toBe(1);   // sıradaki masa
  });
  it('aşama 8: her bölgenin karesi var, çatınınki merdiven ayağında; salon masası alınınca katı olur', () => {
    const sim = played(12); sim.step(1);
    sim.state.stage = 8; sim.state.money = 1e9; sim.step(1);
    const k = kareler(sim), bolge = new Set(k.map(p => kanatOf(Number(p.key.slice(5)))!.bolge));
    expect([...bolge].sort()).toEqual(['catiE', 'catiW', 'cay', 'dondurma', 'salonE', 'salonW']);
    for (const p of k) { const m = kanatOf(Number(p.key.slice(5)))!; if (m.cati) expect(Math.abs(p.pos.z - m.z)).toBeGreaterThan(2); }
    const s = k.find(p => kanatOf(Number(p.key.slice(5)))!.bolge === 'salonW')!, i = Number(s.key.slice(5));
    const n0 = icColliders(IC_BY_ID.salonW, 8).length;
    sim.command({ kind: 'mulk', op: 'masaAl', e: i } as never); sim.step(1);
    expect(icColliders(IC_BY_ID.salonW, 8).length).toBe(n0 + 1);
  });
  it('eski kayıt (masa alanı yok): o aşamaya kadar açılmış bütün masalar kurulu; yönetici aşaması da masaları kurar', () => {
    const sim = played(13); sim.state.stage = 7; delete (sim.state.zones as Record<string, unknown>).masa; sim.step(1);
    expect(kanatKurulu(7)).toEqual(kanatAcik(7)); expect(kareler(sim).length).toBe(0);
    for (const i of kanatAcik(7)) expect(sim.rules.rt.tables[i].built).toBe(true);
    const s2 = played(14); s2.step(1); s2.command({ kind: 'force', what: 'stage', value: 9 } as never); s2.step(1);
    expect(kanatKurulu(9)).toEqual(kanatAcik(9));
    setMasaAlinan(null); expect(kanatKurulu(10).length).toBe(kanatAcik(10).length); expect(KANAT_BASE).toBe(8);
  });
});
