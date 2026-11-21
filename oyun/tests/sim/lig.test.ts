// Boğaz Ligi: deterministic pairings, tables, tie-breaks, season rollover, no duplicate result.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { eslesme, tablo, simMac, uyeler, BASLANGIC, KULUP, type Mac } from '../../src/content/lig';

it('round-robin: 5 rounds, every club meets every other exactly once', () => {
  const ids = uyeler(BASLANGIC, 1), seen = new Set<string>();
  for (let k = 0; k < 5; k++) { const ps = eslesme(ids, k); expect(ps.length).toBe(3); for (const [a, b] of ps) seen.add([a, b].sort().join('|')); }
  expect(seen.size).toBe(15);
});
it('table: points, goal difference, goals scored, then name', () => {
  const ms: Mac[] = [
    { s: 0, k: 0, b: 0, ev: 'lodosspor', dep: 'vapurspor', eg: 2, dg: 2 },
    { s: 0, k: 1, b: 0, ev: 'poyrazspor', dep: 'lodosspor', eg: 0, dg: 3 },
    { s: 0, k: 2, b: 0, ev: 'vapurspor', dep: 'poyrazspor', eg: 1, dg: 0 },
  ];
  const t = tablo(['lodosspor', 'vapurspor', 'poyrazspor'], ms);
  expect(t.map(r => r.id)).toEqual(['lodosspor', 'vapurspor', 'poyrazspor']);
  expect(t[0]).toMatchObject({ p: 4, av: 3, o: 2, g: 1, b: 1 });
});
it('AI results are pure functions of season, round and clubs', () => {
  expect(simMac(2, 3, 'lodosspor', 'kedispor')).toEqual(simMac(2, 3, 'lodosspor', 'kedispor'));
});
it('sim: a week forfeits without a match, a recorded match counts once, season ends with promotion swap', () => {
  const sim = played(1) as any; sim.step(1);
  const S = sim.state, lig = sim.rules.rt.lig;
  S.zones.arsa = { ...(S.zones.arsa || {}), takim: { ad: 'Deneme SK', renk: '#e0533c', renk2: '#f2c230' } };   // the league runs only for a founded club
  expect(lig.model().tablo[1].length).toBe(6);
  // play round 0 for real (day 3) and try to submit it twice
  S.day = 3; const g = 0;
  expect(lig.sonuc(g, 4, 0)).toBe(true); expect(lig.sonuc(g, 9, 0)).toBe(false);
  S.day = 4; sim.step(1);
  const me = lig.model().tablo[1].find((r: any) => r.id === KULUP.id);
  expect(me).toMatchObject({ o: 1, g: 1, ag: 4 });
  // skip four more match days: forfeits, then the season rolls over
  S.day = 3 + 7 * 5 + 1; sim.step(1);
  const m = lig.model();
  expect(m.sezon).toBe(2); expect(m.gecmis.length).toBe(1);
  expect(m.tablo[0].length).toBe(6); expect(m.tablo[1].length).toBe(6);
});
it('sim: kulüp kurulmadan lig işlemez: teklif yok, hükmen yazılmaz, tabloya satır eklenmez', () => {
  const sim = played(1) as any; sim.step(1);
  const S = sim.state, lig = sim.rules.rt.lig;
  S.zones.arsa = { ...(S.zones.arsa || {}), takim: undefined };
  S.day = 3; expect(lig.mac(3)).toBeNull(); expect(lig.siradaki(3)).toBeNull();
  S.day = 3 + 7 * 3 + 1; sim.step(1);
  expect(lig.model().benimMaclar.length).toBe(0);
  expect(lig.model().tablo[1].every((r: any) => r.o === 0)).toBe(true);
});

const kur = () => { const sim = played(1) as any; sim.step(1); const S = sim.state; S.zones.arsa = { ...(S.zones.arsa || {}), takim: { ad: 'Deneme SK', renk: '#e0533c', renk2: '#f2c230' } }; return { sim, S, lig: sim.rules.rt.lig }; };
it('FUT-12: 10 sezon: her sezon sonunda tam 1 çıkan 1 düşen, bölümler 6+6 kalır, oyuncu hep kazanırsa üst lige çıkar', () => {
  const { sim, S, lig } = kur(); let yukseldi = 0;
  for (let g = 0; g < 50; g++) {
    S.day = 3 + 7 * g; sim.step(1); if (lig.mac(S.day)) expect(lig.sonuc(g, 5, 0)).toBe(true);
    S.day += 1; sim.step(1);
    const md = lig.model(); expect(md.tablo[0].length).toBe(6); expect(md.tablo[1].length).toBe(6);
  }
  const m = lig.model(); expect(m.gecmis.length).toBe(5);   // the model shows the last five
  const tum = S.zones.lig.gecmis; expect(tum.length).toBe(10);
  for (const h of tum) { if (h.sonuc === 'yukseldi') yukseldi++; expect(['yukseldi', 'dustu', 'sampiyon', 'kaldi']).toContain(h.sonuc); }
  expect(yukseldi).toBeGreaterThanOrEqual(1); expect(tum[0]).toMatchObject({ s: 1, sonuc: 'yukseldi', odul: 10000, bolum: 1, sira: 1 });
  expect(Object.values(S.zones.lig.bolum).filter(b => b === 0).length).toBe(6);
});
it('FUT-12: hiç maça çıkmayan kulüp hükmenle sondan gider, ligden çıkamaz', () => {
  const { sim, S, lig } = kur();
  S.day = 3 + 7 * 50 + 1; sim.step(1);
  const tum = S.zones.lig.gecmis; expect(tum.length).toBe(10);
  expect(tum.every((h: any) => h.sonuc !== 'yukseldi' && h.puan === 0)).toBe(true); expect(lig.model().benBolum).toBe(1);
});
it('FUT-12: tablo bölgeleri, fikstür ve hafta sonuçları (AI maçları maç gününün akşamı görünür, sonra tur kapanışıyla aynı sonuç)', () => {
  const { sim, S, lig } = kur(); S.day = 3; S.zones.lig.fin = 0;
  const m0 = lig.model(); expect(m0.tablo[0].map((r: any) => r.bolge)).toEqual(['', '', '', '', '', 'dus']); expect(m0.tablo[1].map((r: any) => r.bolge)).toEqual(['yuksel', '', '', '', '', '']);
  expect(m0.fikstur.length).toBe(5); expect(m0.fikstur[0]).toMatchObject({ k: 1, durum: 'sirada', skor: null }); expect(m0.fikstur.map((f: any) => f.gun)).toEqual([3, 10, 17, 24, 31]);
  const ai = (m: any) => m.hafta.filter((x: any) => !x.ben);
  expect(m0.hafta.length).toBe(6); expect(ai(m0).every((x: any) => x.eg === null)).toBe(true);   // not played yet
  sim.step(1);
  S.day = 4; sim.step(1);   // round closed: results come from the record
  const m1 = lig.model(); expect(m1.hafta.length).toBe(6); expect(m1.hafta.every((x: any) => x.eg !== null)).toBe(true);
  const me = m1.hafta.find((x: any) => x.ben); expect(me.ev === 'Deneme SK' ? me.eg : me.dg).toBe(0); expect(m1.fikstur[0].durum).toBe('oynandi'); expect(m1.fikstur[0].skor).toEqual([0, 3]);
});
it('FUT-12: hükmen uyarısı maç gününde ve bir gün önce, oynanınca kalkar', () => {
  const { S, lig } = kur(); S.day = 9; S.zones.lig.fin = 1;
  expect(lig.model().uyari).toContain('Yarın'); S.day = 10; expect(lig.model().uyari).toContain('hükmen'); expect(lig.sonuc(1, 1, 0)).toBe(true); expect(lig.model().uyari).toBe('');
  S.day = 11; expect(lig.model().sonraki).toBeNull();
});
it('FUT-12: sezon sonu özeti son sezonu ayrıntılı verir, kulüpsüz oyuncuda tablo ve hafta boş', () => {
  const { sim, S, lig } = kur();
  for (let g = 0; g < 5; g++) { S.day = 3 + 7 * g; sim.step(1); lig.sonuc(g, 2, 1); }
  S.day = 3 + 7 * 4 + 1; sim.step(1);
  const o = lig.model().ozet; expect(o).toMatchObject({ s: 1, sira: 1, sonuc: 'yukseldi', g: 5, b: 0, m: 0 }); expect(o.sampiyon.length).toBe(2);
  S.zones.arsa.takim = undefined; expect(lig.model().hafta).toBeNull(); expect(lig.model().fikstur).toEqual([]);
});
