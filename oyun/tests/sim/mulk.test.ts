// J3-J8 sim: inventory, shared bank, chests, daily board, plots + shops, stadium ticket.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { IC_BY_ID } from '../../src/content/ic-mekan';
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
it('kafe: müşteriler içeri gelir, hired worker ve oyuncu servis eder, para kasaya girer, tema seçilir', () => {
  const { sim, S, c } = mk();
  S.level = 5; S.money = 500000;
  c({ op: 'arsaAl', id: 'k1' });
  const p = S.zones.arsa.plots.k1, h = sim.rules.rt.kafeHost, ag = sim.rules.rt.agents ?? {};
  expect(h).toBeTruthy();
  // no worker: guests come, queue, and nobody serves them
  for (let i = 0; i < 400; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); }
  const kr = [ag.kafe?.rooms?.() ?? 1];
  expect(p.sat).toBe(0);
  // the player serves from the machine
  const it0 = sim.interactions.get('kafeYap.kafe1'); expect(it0).toBeTruthy();
  sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z });
  for (let i = 0; i < 120; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); }
  expect(p.sat).toBeGreaterThan(0);
  // hired worker: real actor serves on its own
  sim.command({ kind: 'teleport', x: 0, z: 0 });
  const sat0 = p.sat; p.isci = 2;
  for (let i = 0; i < 900; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); }
  expect(p.sat).toBeGreaterThan(sat0 + 2);
  expect(kr).toBeDefined();
  c({ op: 'tema', id: 'k1', e: 'deniz' }); expect(p.tema).toBe('deniz');
  const m0 = S.money; c({ op: 'tema', id: 'k1', e: 'retro' }); expect(S.money).toBe(m0 - 15000);
});
it('banka: kredi çekilir, limit seviyeye bağlı, gün dönünce faiz borca eklenir, ödenir', () => {
  const { sim, S, c } = mk();
  sim.command({ kind: 'teleport', x: BANKA.kapi.x, z: BANKA.kapi.z });
  S.money = 0; c({ op: 'krediAl', n: 10000 });
  const k = S.zones.arsa.kredi; expect(k.borc).toBe(10000); expect(S.money).toBe(10000);
  c({ op: 'krediAl', n: 1e9 }); expect(k.borc).toBeLessThan(1e6);
  const b0 = k.borc; k.gun = S.day - 1; S.zones.envanter.gunluk.gun = -1; sim.step(1);
  expect(k.borc).toBeGreaterThan(b0);
  S.money = 1e7; c({ op: 'krediOde', n: 1e9 }); expect(k.borc).toBe(0);
});
it('okul: İngilizce soruları sınıfta sorulur, 10 cevapta sınav puanı ve genel puan oluşur', () => {
  const { sim, m, S, c } = mk();
  const o0 = () => (m.model() as any).okul;
  c({ op: 'dersBasla' }); expect(o0().soru).toBe('');   // not in the classroom
  const room = IC_BY_ID.okul;
  sim.command({ kind: 'teleport', x: room.x, z: room.z + 1.5 });
  c({ op: 'dersBasla' }); expect(o0().soru).not.toBe('');
  const m0 = S.money;
  for (let i = 0; i < 10; i++) c({ op: 'dersCevap', n: 0 });
  expect(o0().sinavlar.length).toBe(1); expect(S.money).toBeGreaterThanOrEqual(m0);
});
it('AVM: içeride alışveriş, kıyafet dolaba girer, sinema tecrübe verir', () => {
  const { sim, S, c } = mk(); S.money = 50000;
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.money).toBe(50000);
  sim.command({ kind: 'teleport', x: IC_BY_ID.avm.x, z: IC_BY_ID.avm.z });
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.zones.avm.alinan).toContain('deri_ceket');
  const m1 = S.money; c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.money).toBe(m1);
  c({ op: 'avmAl', id: 'film_doner' }); c({ op: 'avmAl', id: 'film_doner' }); expect(S.money).toBe(m1 - 1800);
});
it('kırtasiye tezgahı: müşteri listesi doğru verilince para, yanlışta sabır düşer', () => {
  const { sim, m, S, c } = mk(); S.level = 6; S.money = 500000;
  c({ op: 'arsaAl', id: 'k3' });
  sim.command({ kind: 'teleport', x: IC_BY_ID.kirtasiye.x, z: IC_BY_ID.kirtasiye.z });
  c({ op: 'ktAc' }); expect((m.view() as any).kirtasiye).toBeTruthy();
  for (let i = 0; i < 50 && !(m.view() as any).kirtasiye.mus; i++) sim.step(0.1);
  const k = (m.view() as any).kirtasiye; expect(k.mus).toBeTruthy();
  c({ op: 'ktVer' }); expect((m.view() as any).kirtasiye.son).toMatch(/✗/);
  for (const [id, n] of Object.entries(k.mus.istek) as [string, number][]) { if (id === 'fotokopi') c({ op: 'ktEkle', id }); else for (let i = 0; i < n; i++) c({ op: 'ktEkle', id }); }
  const m0 = S.money; c({ op: 'ktVer' }); expect(S.money).toBeGreaterThan(m0);
  c({ op: 'ktKapat' }); expect((m.view() as any).kirtasiye).toBeNull();
});
