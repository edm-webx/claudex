// J3-J8 sim: inventory, shared bank, chests, daily board, plots + shops, stadium ticket.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { BANKA, ARSALAR, arsaKapi, STADYUM } from '../../src/content/esya';

const mk = () => { const sim = played(1) as any; sim.step(1); const m = mulkApi(sim.rules)!; return { sim, m, S: sim.state, rt: sim.rules.rt, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };

it('bank: only at the door, deposits and withdraws money and items, never negative', () => {
  const { sim, m, S, rt, c } = mk();
  S.money = 1000; c({ op: 'tlYatir', n: 500 });
  expect(S.money).toBe(1000);                       // not at the bank
  sim.command({ kind: 'teleport', x: BANKA.kapi.x, z: BANKA.kapi.z });
  c({ op: 'tlYatir', n: 500 }); expect(S.money).toBe(500); expect(rt.banka.tl).toBe(500); expect(rt.banka.dirty).toBe(true);
  c({ op: 'tlCek', n: 9999 }); expect(S.money).toBe(1000); expect(rt.banka.tl).toBe(0);
  c({ op: 'ver', id: 'tahta', n: 4 }); c({ op: 'esyaYatir', id: 'tahta', n: 3 });
  expect(m.have('tahta')).toBe(1); expect(rt.banka.esya.tahta).toBe(3);
  c({ op: 'esyaCek', id: 'tahta', n: 2 }); expect(m.have('tahta')).toBe(3);
});
it('chests drop from activities and open for money + items; gold chest needs the key', () => {
  const { sim, m, S, c } = mk();
  for (let i = 0; i < 4; i++) sim.rules.K?.stat?.('mantar');
  const env = S.zones.envanter;
  c({ op: 'sandikVer', id: 'tahta' });
  expect(env.sandik.tahta).toBeGreaterThan(0);
  const m0 = S.money; c({ op: 'sandikAc', id: 'tahta' });
  expect(S.money).toBeGreaterThan(m0); expect(Object.keys(env.esya).length).toBeGreaterThan(0);
  c({ op: 'sandikVer', id: 'altin' }); const n0 = env.sandik.altin; c({ op: 'sandikAc', id: 'altin' });
  expect(env.sandik.altin).toBe(n0);                // no key
  c({ op: 'ver', id: 'altin_anahtar' }); c({ op: 'sandikAc', id: 'altin' });
  expect(env.sandik.altin ?? 0).toBe(n0 - 1);
  void m;
});
it('daily board: 3 goals, claim pays, all three give a chest', () => {
  const { sim, S, c } = mk(); sim.step(1);
  const g = S.zones.envanter.gunluk; expect(g.liste.length).toBe(3);
  for (const h of g.liste) h.sayi = h.hedef;
  for (const h of g.liste) c({ op: 'gunlukAl', id: h.id });
  expect(g.liste.every((h: any) => h.alindi)).toBe(true); expect(S.zones.envanter.sandik.gumus).toBe(1);
});
it('plots: buy needs level + money + the 3 plot limit; a shop sells stock into its till', () => {
  const { sim, m, S, c } = mk();
  const a1 = ARSALAR[0]; S.money = 5e6; S.level = 1; c({ op: 'arsaAl', id: 'a1' }); expect(S.zones.arsa?.plots?.a1).toBeUndefined();
  S.level = 8; c({ op: 'arsaAl', id: 'a1' }); c({ op: 'arsaAl', id: 'a2' }); c({ op: 'arsaAl', id: 'a3' }); c({ op: 'arsaAl', id: 'a4' });
  expect(Object.keys(S.zones.arsa.plots).length).toBe(3);
  c({ op: 'arsaKur', id: 'a1', tur: 'dukkan', tip: 'cay_ocagi' }); expect(S.zones.arsa.plots.a1.tur).toBe('dukkan');
  c({ op: 'stokAl', id: 'a1', n: 40 }); expect(S.zones.arsa.plots.a1.stok).toBe(40);
  sim.command({ kind: 'teleport', x: 0, z: -7 });
  sim.step(300);
  const p = S.zones.arsa.plots.a1; expect(p.sat + p.stok).toBe(40); expect(p.sat).toBeGreaterThan(0);
  const m0 = S.money; sim.command({ kind: 'teleport', x: arsaKapi(a1).x, z: arsaKapi(a1).z }); sim.step(1);
  expect(S.money).toBeGreaterThan(m0);
  void m;
});
it('stadium: ticket costs 5000 at the gate and starts a match', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000;
  c({ op: 'bilet' }); expect(S.money).toBe(20000);
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'bilet' }); expect(S.money).toBe(15000); expect(rt.uiLast.haliSahaMac).toBeTruthy();
});
it('karşı yaka kafe: satın alınca hemen kafe olur, arsa hakkından düşmez, işçi tutulur ve rafı kasadan doldurur', () => {
  const { sim, m, S, c } = mk();
  const k1 = ARSALAR.find(a => a.id === 'k1')!;
  S.level = 5; S.money = 200000;
  c({ op: 'arsaAl', id: 'k1' });
  const p = S.zones.arsa.plots.k1; expect(p.tur).toBe('dukkan'); expect(p.tip).toBe('kafe'); expect(p.stok).toBe(20);
  expect(m.model().sahip).toBe(0);
  c({ op: 'isciAl', id: 'k1' }); expect(p.isci).toBe(1); expect(S.money).toBe(200000 - k1.fiyat - 12000);
  for (let i = 0; i < 3; i++) c({ op: 'isciAl', id: 'k1' }); expect(p.isci).toBe(2);   // lv1 café: 2 workers
  p.lv = 2; c({ op: 'isciAl', id: 'k1' }); expect(p.isci).toBe(3);
  p.till = 5000; p.stok = 0; sim.step(240);
  expect(p.stok).toBeGreaterThan(0); expect(p.sat).toBeGreaterThan(0);   // workers restocked from the till and the shelf sold
  expect(m.view().plots.find((x: any) => x.id === 'k1')!.isci).toBe(3);
  const row = m.model().arsa.find((x: any) => x.id === 'k1'); expect(row!.menu.map((x: any) => x.id)).toEqual(['turk_kahvesi', 'demlik_cay', 'kasarli_tost', 'su_boregi']);
  S.money = 1e6; c({ op: 'kafeEsya', id: 'k1', e: 'espresso' }); expect(p.esya).toEqual(['espresso']); c({ op: 'kafeEsya', id: 'k1', e: 'barista' }); expect(p.esya).toEqual(['espresso']);   // barista needs lv5
  const k2 = m.model().arsa.find((x: any) => x.id === 'k2'); expect(k2!.owned).toBe(false);
});
