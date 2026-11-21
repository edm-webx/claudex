// 2026-11-08: own club plays league matches from the gate (points + prize), spectators bet on a seeded match.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { STADYUM } from '../../src/content/esya';
import { izleMac, KULUP_ODUL, MAC_ODUL, ODUL, BAHIS, macAyari, ceteleOf, recordStats } from '../../src/game/sim/halisaha';
import { tahminDoluluk } from '../../src/game/sim/stadyum';
import { LIG_BY_ID, KULUP, KULUP_GUC_TABAN, gucSkill } from '../../src/content/lig';
import { kapiGeliri } from '../../src/game/sim/stadyum';
import { createMatch } from '../../src/game/sim/macmotor';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state, rt: sim.rules.rt, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
it('kulüp maçı: bilet yok, kulüp adıyla lig maçı, galibiyet 3 puan ve para', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000;
  c({ op: 'adminTakim', name: 'Martı FK' });
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'bilet' }); expect(S.money).toBe(20000);
  const mac = rt.uiLast.haliSahaMac; expect(mac.name).toContain('Martı FK'); expect(mac.ligG).toBeGreaterThanOrEqual(0);
  const m0 = S.money; sim.command({ kind: 'halisaha', op: 'sonuc', biz: 3, onlar: 1 });
  expect(S.money).toBeGreaterThanOrEqual(20000 + KULUP_ODUL.win);
  const t = rt.lig.model().tablo.flat().find((r: any) => r.ben); expect(t.p).toBe(3);
  // gate fill is sold before this result (form going in = empty) and uses the rival's real strength
  expect(S.zones.arsa.stad.doluluk).toBeCloseTo(tahminDoluluk(S.zones.arsa.stad.fiyat, [], LIG_BY_ID[mac.rival].guc), 5);
});
it('bahis: sonuç motorla sabit, tutarsa oran kadar öder', () => {
  const a = izleMac(12345), b = izleMac(12345); expect(a.skor).toEqual(b.skor);
  const { sim, S, rt, c } = mk(); S.money = 10000;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'izle', bahis: '1', n: 1000 }); expect(S.money).toBe(9000);
  const iz = rt.uiLast.haliSahaIzle; const r = izleMac(iz.seed);
  sim.command({ kind: 'halisaha', op: 'izleSonuc' });
  expect(S.money).toBe(r.sonuc === '1' ? 9000 + Math.round(1000 * iz.oran['1']) : 9000);
  expect(rt.uiLast.haliSahaIzle).toBeUndefined();
});
it('bahis: maç sırasında sayfa yenilenirse bekleyen bahis kayıttan çözülür (iade hilesi yok, para yanmaz, çift ödeme yok)', () => {
  const { sim, S, rt, c } = mk(); S.money = 10000;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'izle', bahis: '2', n: 700 }); expect(S.money).toBe(9300); expect(S.zones.halisaha.bekleyen).toBe(700);
  const b = S.zones.halisaha.bahis; expect(b).toMatchObject({ bahis: '2', n: 700 }); expect(Number.isFinite(b.seed)).toBe(true);
  const r = izleMac(b.seed), beklenen = 9300 + (r.sonuc === '2' ? Math.round(700 * b.oran) : 0);
  delete rt._izle; delete rt.uiLast.haliSahaIzle; rt.paused = false; rt.pauseWhy = '';   // what a reload does: the save keeps the bet, the runtime is gone
  sim.step(1);
  expect(S.money).toBe(beklenen); expect(S.zones.halisaha.bekleyen).toBe(0); expect(S.zones.halisaha.bahis).toBeUndefined(); expect(rt.paused).toBe(false);
  sim.step(1); expect(S.money).toBe(beklenen);
});
it('bahis: bozuk bekleyen kayıt iade edilir', () => {
  const { sim, S } = mk(); S.money = 1000; S.zones.halisaha = { ...(S.zones.halisaha || {}), bekleyen: 500 };
  sim.step(1); expect(S.money).toBe(1500); expect(S.zones.halisaha.bekleyen).toBe(0);
});
it('bahis: günlük bahis sayısı sınırlı, ertesi gün yeniden açılır', () => {
  const { sim, S, rt, c } = mk(); S.money = 1e6;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  for (let i = 0; i < BAHIS.gunluk; i++) { c({ op: 'izle', bahis: '1', n: 100 }); expect(rt.uiLast.haliSahaIzle).toBeTruthy(); sim.command({ kind: 'halisaha', op: 'izleSonuc' }); }
  c({ op: 'izle', bahis: '1', n: 100 }); expect(rt.uiLast.haliSahaIzle).toBeUndefined();
  c({ op: 'izle', bahis: null, n: 0 }); expect(rt.uiLast.haliSahaIzle).toBeTruthy(); sim.command({ kind: 'halisaha', op: 'izleSonuc' });   // watching without a bet stays free
  S.day += 1; c({ op: 'izle', bahis: '1', n: BAHIS.max * 3 }); expect(rt.uiLast.haliSahaIzle.n).toBe(BAHIS.max);
});
it('para toplamı korunur: bahis + sonuç = kayıtlı kazanç', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000; const z0 = S.money;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  let net = 0;
  for (let i = 0; i < 4; i++) { c({ op: 'izle', bahis: 'X', n: 300 }); const b = S.zones.halisaha.bahis, r = izleMac(b.seed); sim.command({ kind: 'halisaha', op: 'izleSonuc' }); net += r.sonuc === 'X' ? Math.round(300 * b.oran) - 300 : -300; }
  expect(S.money - z0).toBe(net); expect(S.zones.halisaha.bahisKazanc).toBe(net); expect(rt.uiLast.haliSahaIzle).toBeUndefined();
});
it('bahis: tohum her izlemede farklı ve gün/saatten türetilemez', () => {
  const { sim, S, rt, c } = mk(); S.money = 50000;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'izle', bahis: '1', n: 100 }); const s1 = rt.uiLast.haliSahaIzle.seed; sim.command({ kind: 'halisaha', op: 'izleSonuc' });
  c({ op: 'izle', bahis: '1', n: 100 }); const s2 = rt.uiLast.haliSahaIzle.seed;
  expect(s1).not.toBe(s2);
});
it('maç teklifi kabul edilince tribün doluluğu (gişe tahmini) görünüme verilir', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000;
  c({ op: 'adminTakim', name: 'Martı FK' });
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'bilet' });
  const d = rt.uiLast.haliSahaMac.doluluk; expect(d).toBeGreaterThan(0.05); expect(d).toBeLessThanOrEqual(1);
});

const klup = (m: ReturnType<typeof mk>) => { m.S.money = 300000; m.c({ op: 'adminTakim', name: 'Martı FK' }); m.sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z }); };
it('FUT-15: ödül tek sabitte, kulüp maçı ödülü 6000 + kapı', () => { expect(MAC_ODUL).toBe(ODUL.anlik); expect(KULUP_ODUL).toBe(ODUL.kulup); expect(ODUL.kulup.win).toBe(6000); });
it('FUT-15: aynı lig maçı ikinci kez gönderilirse ödül yok, puan yok', () => {
  const m = mk(); klup(m); const { sim, S, rt, c } = m;
  c({ op: 'bilet' }); const teklif = { ...rt.uiLast.haliSahaMac };
  sim.command({ kind: 'halisaha', op: 'sonuc', biz: 2, onlar: 0 }); const para = S.money, oyun = S.zones.halisaha.played, p = rt.lig.model().tablo.flat().find((r: any) => r.ben).p;
  rt.uiLast.haliSahaMac = { ...teklif }; rt.paused = true; rt.pauseWhy = 'halisaha';   // the same offer comes back (tampered or replayed)
  sim.command({ kind: 'halisaha', op: 'sonuc', biz: 9, onlar: 0 });
  expect(S.money).toBe(para); expect(S.zones.halisaha.played).toBe(oyun); expect(rt.lig.model().tablo.flat().find((r: any) => r.ben).p).toBe(p); expect(rt.paused).toBe(false);
  expect(sim.command({ kind: 'halisaha', op: 'sonuc', biz: 1, onlar: 0 }) ?? true).toBeTruthy(); expect(S.money).toBe(para);   // no open offer: nothing happens
});
it('FUT-15: skor tavanı 30', () => {
  const m = mk(); klup(m); const { sim, S, c } = m; c({ op: 'bilet' }); sim.command({ kind: 'halisaha', op: 'sonuc', biz: 99, onlar: 0 });
  expect(S.zones.halisaha.goals).toBe(30);
});
it('FUT-15: yarım kalan maç oyunu kilitlemez, ödül vermez', () => {
  const m = mk(); klup(m); const { sim, S, rt, c } = m; c({ op: 'bilet' }); expect(rt.paused).toBe(true);
  const para = S.money; delete rt.uiLast.haliSahaMac; rt.paused = false; rt.pauseWhy = '';   // reload mid-match: the runtime offer and pause are gone, the save has no half result
  sim.step(1); expect(rt.paused).toBe(false); expect(S.money).toBe(para); expect(S.zones.halisaha.played).toBe(0);
  c({ op: 'bilet' }); expect(rt.uiLast.haliSahaMac).toBeTruthy();   // the same fixture can still be played: the round is not recorded
});
it('FUT-14: doluluk maç başlamadan hesaplanır, kapı geliri o doluluğa göre yazılır', () => {
  const m = mk(); klup(m); const { sim, S, rt, c } = m; c({ op: 'bilet' });
  const mac = rt.uiLast.haliSahaMac, fiyat = S.zones.arsa.stad.fiyat; expect(mac.doluluk).toBeCloseTo(tahminDoluluk(fiyat, [], LIG_BY_ID[mac.rival].guc), 5);
  mac.doluluk = 0.9; sim.command({ kind: 'halisaha', op: 'sonuc', biz: 0, onlar: 1 });
  expect(S.zones.arsa.stad.son).toBe(kapiGeliri(0.9, fiyat)); expect(S.zones.arsa.stad.doluluk).toBe(0.9);
  expect(tahminDoluluk(4000, [], 66)).toBeGreaterThan(tahminDoluluk(4000, [], 42));   // a strong rival fills the stands
});
it('FUT-11: kulüp yokken lig teklifi ve lig puanı yok; bilet anlık maçtır', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  expect(rt.lig.mac(3)).toBeNull(); expect(rt.lig.siradaki(3)).toBeNull();
  c({ op: 'bilet' }); expect(S.money).toBe(15000); expect(rt.uiLast.haliSahaMac.ligG).toBeUndefined();
  sim.command({ kind: 'halisaha', op: 'sonuc', biz: 1, onlar: 0 }); expect(S.money).toBe(15000 + MAC_ODUL.win);
  expect(rt.lig.model().tablo.flat().every((r: any) => r.o === 0)).toBe(true);
});
it('FUT-12: kulüp gücü çeteleyle büyür, skill 0.5-0.7, macAyari saf ve tutarlı', () => {
  const m = mk(); klup(m); const { sim, S, rt, c } = m; c({ op: 'bilet' });
  const t = rt.uiLast.haliSahaMac, a0 = macAyari(S, t), a1 = macAyari(S, t); expect(a1).toEqual(a0);
  expect(a0.skill[0]).toBeCloseTo(gucSkill(KULUP_GUC_TABAN), 5); for (const v of a0.skill) { expect(v).toBeGreaterThanOrEqual(0.5); expect(v).toBeLessThanOrEqual(0.7); }
  expect(a0.names[0]).toContain('SABRİ'); expect(a0.colors[0]).toEqual(t.colors); expect(['pres', 'dengeli', 'kontra']).toContain(a0.plan[1]);
  S.zones.arsa.stad.formasyon = '1-2-1'; expect(macAyari(S, t).formations[0]).toBe('1-2-1');
  expect(() => createMatch({ seed: 1, human: 0, humanSlot: 3, formations: a0.formations, names: a0.names, skill: a0.skill })).not.toThrow();
  sim.command({ kind: 'halisaha', op: 'sonuc', biz: 2, onlar: 0 }); S.zones.halisaha.played = 40; S.zones.halisaha.won = 30;
  rt.lig.model(); expect(KULUP.guc).toBeGreaterThan(KULUP_GUC_TABAN); expect(macAyari(S, t).skill[0]).toBeGreaterThan(a0.skill[0]);
});
it('FUT-13: çetele toplamları maç istatistiklerinin toplamına eşit, sezon/rakip/rekor işlenir', () => {
  const z: Record<string, any> = { played: 0, won: 0, drawn: 0, lost: 0, goals: 0 }; let gol = 0, sut = 0;
  for (const seed of [3, 4, 5]) {
    const mt = createMatch({ seed, human: null, halfS: 30 }); for (let i = 0; i < 60 * 70 && !mt.over; i++) mt.step(1 / 60);
    const ist = { takim: [mt.teamStats(0), mt.teamStats(1)], oyuncu: mt.pls.filter(p => p.team === 0).map(p => ({ ad: p.name, rol: p.role, ...p.st })) };
    const [a, b] = mt.score; z.played++; z.goals += a; if (a > b) z.won++; else if (a === b) z.drawn++; else z.lost++;
    recordStats(z as never, ist, a, b, { sezon: seed > 4 ? 1 : 0, rakip: 'lodosspor', rakipAd: 'Lodosspor', gun: 3 }); gol += a; sut += mt.teamStats(0).shots;
    expect(mt.pls.filter(p => p.team === 0).reduce((s, p) => s + p.st.goals, 0)).toBe(a);   // goals = sum of the scorers
  }
  const c = ceteleOf(z)!; expect(c.oyun).toBe(3); expect(c.oyuncu.reduce((s, p) => s + p.gol, 0)).toBe(gol); expect(c.takim.sut).toBe(sut);
  expect(c.sezon.map(x => x.sezon)).toEqual([2, 1]); expect(c.sezon[0].o + c.sezon[1].o).toBe(3); expect(c.rakip[0]).toMatchObject({ ad: 'Lodosspor', o: 3 });
  expect(c.oyuncu.find(p => p.no === 10)!.oyun).toBe(3); expect(c.son).toBeTruthy();
});
it('FUT-13: eski kayıt (yalnız ad anahtarlı players) okunur, kadro numarasına taşınır', () => {
  const z = { played: 4, won: 2, drawn: 1, lost: 1, goals: 7, conceded: 3, form: ['G', 'B', 'M', 'G'], team: { shots: 20, passes: 40, passesOk: 30, possSum: 200 }, players: { SABRİ: { oyun: 4, goals: 5, assists: 2 }, Tayyar: { oyun: 4, goals: 2 }, 'Bilinmeyen': { oyun: 1 } } };
  const c = ceteleOf(z)!; expect(c.oyuncu.find(p => p.no === 10)).toMatchObject({ gol: 5, asist: 2, oyun: 4 }); expect(c.oyuncu.find(p => p.no === 9)!.gol).toBe(2);
  expect(c.takim.sahiplik).toBe(50); expect(c.sezon).toEqual([]); expect(c.rekor.fark).toBeNull();
  recordStats(z as never, undefined, 3, 0, { sezon: 0 }); expect((z as any).oyuncu[10].goals).toBe(5); expect((z as any).rekor.fark).toBe(3);   // keeps counting on top
});
