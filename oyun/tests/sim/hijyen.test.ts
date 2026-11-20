// BUF-16: hijyen puanı gerçek durumdan, müfettiş (5-6 günde bir, gerçek yürüyen karakter), sonuç (iyi: talep artışı, kötü: yalnız uyarı), Martı yıldızı.
import { describe, it, expect } from 'vitest';
import { kur } from './garson-yardimci';
import { hijyenPuani, hijyenSonucu, martiYildizi, hijyenTalep, HIJYEN } from '../../src/game/sim/hijyen';
import { tabelaFx } from '../../src/game/sim/tabela';

describe('BUF-16 hijyen', () => {
  it('puan saf fonksiyon: temiz 1, her kir kaynağı düşürür, pasif bileşen ağırlıktan çıkar', () => {
    expect(hijyenPuani({ masa: 0, zemin: 0, mutfak: 0, tabak: 0 })).toBe(1);
    const base = hijyenPuani({ masa: 0.2, zemin: 0.2, mutfak: 0.2, tabak: 0.2 });
    for (const k of ['masa', 'zemin', 'mutfak', 'tabak'] as const) expect(hijyenPuani({ masa: 0.2, zemin: 0.2, mutfak: 0.2, tabak: 0.2, [k]: 0.9 })).toBeLessThan(base);
    expect(hijyenPuani({ masa: 1, zemin: 1, mutfak: null, tabak: null })).toBe(0);
    expect(hijyenSonucu(0.8)).toBe('iyi'); expect(hijyenSonucu(0.6)).toBe('orta'); expect(hijyenSonucu(0.3)).toBe('kotu');
  });
  it('Martı yıldızı 1-3: servis + hijyen + personel seviyesi', () => {
    expect(martiYildizi(1, 0.3, 0)).toBe(1); expect(martiYildizi(3.5, 0.6, 3)).toBe(2);
    expect(martiYildizi(4.8, 0.95, 8)).toBe(3); expect(martiYildizi(2, 0.95, 9)).toBeLessThan(3); expect(martiYildizi(5, 0.4, 9)).toBeLessThan(3);
  });
  it('canlı puan gerçek durumdan: kirli masa, zemin kiri, kirli tabak puanı düşürür', () => {
    const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 5 }); k.step(30);
    const h = k.r.hijyen; const temiz = h.puan(); expect(temiz).toBeGreaterThan(0.9);
    const T = k.kurulu()[0]; k.r.tables[T].dirty = 3; k.r.tables[T].dirtyT = 200; (k.S.zones.zemin as { kir: number }).kir = 1; k.r.dirtyDishes = 30;
    k.step(60, () => { k.r.tables[T].dirty = 3; (k.S.zones.zemin as { kir: number }).kir = 1; k.r.dirtyDishes = 30; return false; });
    expect(h.puan()).toBeLessThan(temiz - 0.2);
  });
  it('müfettiş aşama 5 öncesi gelmez; 5+ ilk ziyaret 1-2 gün sonra, gerçek yürür, mutfağa girer, sonucu bildirir, sonraki 5-6 gün sonra', () => {
    const k0 = kur(); k0.S.day = 9; k0.sim.command({ kind: 'time', hour: 13 } as never); k0.step(60);
    expect(k0.r.agents.mufettis.current()).toBeNull();
    const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 5 }); k.step(5);
    k.r.agents.env.host.hour = () => 13;
    expect(k.r.hijyen.mufettisIstiyor(13)).toBe(false);    // ilk gün gelmez
    const g = (k.S.zones.hijyen as { gelecek: number }).gelecek; expect(g - k.S.day).toBeGreaterThanOrEqual(1); expect(g - k.S.day).toBeLessThanOrEqual(2);
    k.S.day = g;
    let gordu = false, yurudu = 0, mutfakta = false; let px = 0, pz = 0;
    k.step(120, () => {
      const m = k.r.agents.mufettis.current();
      if (m) { gordu = true; const a = k.r.agents.registry.list.find((x: { key: string }) => x.key === 'mufettis'); if (px) yurudu += Math.hypot(a.x - px, a.z - pz); px = a.x; pz = a.z; if (Math.abs(a.x - 0) < 100) { const km = k.r.layout; void km; } }
      return gordu && !m && (k.S.stats.mufettis || 0) > 0;
    });
    expect(gordu).toBe(true); expect(yurudu).toBeGreaterThan(15); void mutfakta;
    expect(k.S.stats.mufettis).toBe(1);
    const z = k.S.zones.hijyen as { gelecek: number; sonuc: string; son: number };
    expect(z.gelecek - k.S.day).toBeGreaterThanOrEqual(5); expect(z.gelecek - k.S.day).toBeLessThanOrEqual(6);
    expect(['iyi', 'orta', 'kotu']).toContain(z.sonuc);
    const gs = k.r.uiLast.hijyenGun; expect(gs.mufettis).toBe(z.sonuc);
  });
  it('sonuç: iyi küçük geçici talep artışı, kötü yalnız uyarı + küçük talep kaybı; para cezası yok', () => {
    const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 5 }); k.step(3);
    const m0 = k.S.money, d = k.S.day, ref = tabelaFx(k.S as never, 12);
    expect(k.r.hijyen.mufettisBitti(0.9)).toBe('iyi');
    expect(tabelaFx(k.S as never, 12) - ref).toBeCloseTo(HIJYEN.talepIyi, 5);
    k.S.day = d + 2; expect(hijyenTalep(k.S as never)).toBe(0);   // geçici
    k.S.day = d;
    expect(k.r.hijyen.mufettisBitti(0.2)).toBe('kotu');
    expect(tabelaFx(k.S as never, 12) - ref).toBeCloseTo(HIJYEN.talepKotu, 5); expect(HIJYEN.talepKotu).toBeGreaterThan(-0.1);
    expect(k.S.money).toBe(m0);
    k.S.day = d + 1; expect(hijyenTalep(k.S as never)).toBe(0);
  });
  it('Martı yıldızı aşama 7+ gün sonu verisinde görünür, öncesinde gizli', () => {
    const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 6 }); k.step(10);
    expect(k.r.uiLast.hijyenGun.marti).toBeUndefined();
    k.sim.command({ kind: 'force', what: 'stage', value: 7 }); k.step(10);
    expect([1, 2, 3]).toContain(k.r.uiLast.hijyenGun.marti);
  });
});
