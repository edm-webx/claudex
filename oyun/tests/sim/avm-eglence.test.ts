// Martı AVM sinema katı ve yaşamı (2026-11-21: AVM içi ayrı âlem; 2026-11-22 22:55 sahip: konser sahnesi kalktı, salonlar büyüdü,
// bekleme salonu + iki bilet alınabilen gişe, açık mısır standı, perdede bölüm bölüm animasyon dizisi).
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { AVM, HOL, katY, avmIcinde, avmYol } from '../../src/content/avm-kat';
import { EGLENCE_KAT, SALONLAR, GISELER, KANEPELER, BILET_FIYAT, seans, eglenceEngel } from '../../src/content/avm-eglence';
import { DIZILER, SAHNE_N, bolumOf, diziOf, anOf } from '../../src/content/sinema-dizi';
import { icBina, icColliders } from '../../src/content/ic-mekan';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state, y: sim.rules.rt.agents.avmYasam }; };
const gir = (sim: any, kat = 0) => { sim.command({ kind: 'teleport', x: AVM.cx, z: 47, kat }); sim.step(0.25); };

it('sinema katı: tek dükkân açık Sinema Büfesi standı; iki büyük salon (lobi dahil, 50+ koltuk), gişeler ve kanepeler binada, kapılar holde', () => {
  expect(EGLENCE_KAT).toBe(AVM.KAT - 1);
  const b = icBina('avm').filter(m => (m.kat || 0) === EGLENCE_KAT); expect(b.map(m => m.arsa)).toEqual(['k18']); expect(b[0].acik).toBe(true);
  expect(icColliders(b[0]).length).toBeLessThan(icColliders(icBina('avm').find(m => m.arsa === 'k17')!).length);   // yan ve ön duvar yok
  for (const s of SALONLAR) { expect(s.koltuk.length).toBeGreaterThanOrEqual(50); expect(s.z1 - s.z0).toBeGreaterThan(10.5); for (const k of s.koltuk) { expect(avmIcinde(k)).toBe(true); expect(k.x).toBeLessThan(HOL.x0); expect(k.z).toBeGreaterThan(s.z0); expect(k.z).toBeLessThan(s.z1); } }
  expect(SALONLAR[0].z0).toBe(AVM.z0);   // lobinin batısı da salona katıldı
  for (const g of GISELER) { expect(g.x).toBeGreaterThan(HOL.x1); expect(avmIcinde(g)).toBe(true); }
  const r = eglenceEngel(), ic = (p: { x: number; z: number }) => r.some(q => p.x > q.x0 && p.x < q.x1 && p.z > q.z0 && p.z < q.z1);
  for (const s of SALONLAR) { expect(ic(s.kapi)).toBe(false); expect(ic(s.ici)).toBe(false); for (const k of s.koltuk) expect(ic(k)).toBe(false); }
  for (const g of GISELER) { expect(ic(g)).toBe(true); expect(ic(g.musteri)).toBe(false); }
  for (const k of KANEPELER) expect(ic(k)).toBe(true);
  const p = avmYol(0, { x: AVM.cx, z: 47 }, EGLENCE_KAT, SALONLAR[0].kapi); expect(p[p.length - 1].y).toBe(katY(EGLENCE_KAT));
  const q = avmYol(EGLENCE_KAT, SALONLAR[0].kapi, 1, { x: HOL.x1 - 0.7, z: 49 }); expect(q[q.length - 1].y).toBe(katY(1));
});

it('takvim: 3 saatlik seanslar (giriş, bölüm, çıkış), gece kapalı; günün her seansı dizinin bir sonraki bölümü', () => {
  expect(seans(SALONLAR[0], 9.1).durum).toBe('giris'); expect(seans(SALONLAR[0], 10).durum).toBe('film'); expect(seans(SALONLAR[0], 11.9).durum).toBe('cikis');
  expect(seans(SALONLAR[1], 10.6).durum).toBe('giris'); expect(seans(SALONLAR[0], 3).durum).toBe('kapali'); expect(seans(SALONLAR[0], 25.5).durum).toBe('kapali');
  expect(seans(SALONLAR[0], 10).bolum).toBe(0); expect(seans(SALONLAR[0], 13).bolum).toBe(1); expect(seans(SALONLAR[0], 22).bolum).toBe(4);
  expect(seans(SALONLAR[0], 10.55).f).toBeCloseTo(0.5, 1);
});

it('diziler: iki dizi, her biri 5 bölüm x 7 sahne, her sahnede konuşan / altyazı var; açılış kartı, sahneler, son kartı sırayla', () => {
  expect(DIZILER).toHaveLength(2); expect(diziOf(1)).not.toBe(diziOf(2));
  for (const d of DIZILER) { expect(d.bolumler).toHaveLength(5); for (const b of d.bolumler) { expect(b.sahneler).toHaveLength(SAHNE_N); expect(b.ozet.length).toBeGreaterThan(10); for (const s of b.sahneler) { expect(s.soz.length).toBeGreaterThan(5); expect(s.roller.length).toBeGreaterThan(0); if (s.kim) expect(s.roller.some(r => r.k === s.kim)).toBe(true); } } }
  expect(anOf(0.01).tur).toBe('acilis'); expect(anOf(0.5).tur).toBe('sahne'); expect(anOf(0.99).tur).toBe('son');
  const sahneler = new Set<number>(); for (let f = 0.08; f < 0.95; f += 0.01) sahneler.add(anOf(f).i); expect(sahneler.size).toBe(SAHNE_N);
  expect(bolumOf(DIZILER[0], 6).no).toBe(2);   // bölümler döner
});

it('ziyaretçiler: oyuncu AVM\'ye girince içerisi dolu (her katta gerçek yürüyen aktörler), çıkınca kaldırılır', () => {
  const { sim, y } = mk(); sim.command({ kind: 'setTime', hour: 15 });
  expect(y.rows()).toHaveLength(0);
  gir(sim); expect(y.rows().length).toBeGreaterThanOrEqual(10);
  const kats = new Set(y.rows().map((r: any) => r.kat)); expect(kats.size).toBeGreaterThanOrEqual(3);
  const once = y.rows().map((r: any) => [r.x, r.z]);
  for (let i = 0; i < 40; i++) sim.step(0.25);
  const sonra = y.rows(); expect(sonra.filter((r: any, i: number) => once[i] && (Math.abs(r.x - once[i][0]) + Math.abs(r.z - once[i][1])) > 0.5).length).toBeGreaterThan(3);
  for (const r of sonra) { expect(avmIcinde(r, 1.5), JSON.stringify(r)).toBe(true); expect(r.y).toBeGreaterThanOrEqual(0); expect(r.y).toBeLessThanOrEqual(katY(EGLENCE_KAT) + 0.6); }
  sim.command({ kind: 'teleport', x: 20.15, z: 40 }); sim.step(0.25); expect(y.rows()).toHaveLength(0);
  expect(sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.key.startsWith('avm-z-'))).toHaveLength(0);
});

it('sinema: seyirci önce gişeden bilet alır, salona girip koltuğa oturur ve perdeye bakar, bölüm bitince çıkar; gişeciler gerçek çalışan', () => {
  const { sim, y } = mk(); sim.command({ kind: 'setTime', hour: 8.95 }); gir(sim, EGLENCE_KAT);
  sim.command({ kind: 'setTime', hour: 9.02 });
  expect(y.giseci()).toHaveLength(2);
  let oturan = 0, gisede = 0;
  for (let i = 0; i < 1600 && !oturan; i++) { sim.step(0.25); if (i % 40 === 0) sim.command({ kind: 'setTime', hour: 9.02 + (i % 200) / 1000 }); if (y.rows().some((r: any) => r.st === 'gise')) gisede++; oturan = y.rows().filter((r: any) => r.st === 'film').length; }
  expect(gisede).toBeGreaterThan(0); expect(oturan).toBeGreaterThan(0);
  const f = y.rows().find((r: any) => r.st === 'film'); expect(f.act).toBe('sit'); expect(f.x).toBeLessThan(HOL.x0); expect(f.y).toBeCloseTo(katY(EGLENCE_KAT), 3);
  sim.command({ kind: 'setTime', hour: 11.85 }); sim.step(0.25); sim.step(0.25);
  expect(y.rows().filter((r: any) => r.st === 'film' && r.z < SALONLAR[0].z1)).toHaveLength(0);   // salon 2 bir buçuk saat kaydırılmış, o hâlâ oynuyor
});

it('oyuncu: gişede durunca bilet alır (para düşer), salon kapısındaki görevli bileti alır', () => {
  const { sim, S, y } = mk(); sim.command({ kind: 'setTime', hour: 9.05 }); gir(sim, EGLENCE_KAT);
  S.money = 1000; const g = GISELER[0];
  sim.command({ kind: 'teleport', x: g.musteri.x, z: g.musteri.z, kat: EGLENCE_KAT }); for (let i = 0; i < 25 && !y.bilet(); i++) sim.step(0.1);
  expect(y.bilet()).toBeTruthy(); expect(S.money).toBe(1000 - BILET_FIYAT);
  const s = SALONLAR.find(x => x.id === y.bilet().salon)!;
  sim.command({ kind: 'teleport', x: s.kapi.x, z: s.kapi.z, kat: EGLENCE_KAT }); for (let i = 0; i < 12 && y.bilet(); i++) sim.step(0.1);
  expect(y.bilet()).toBeNull();
});

it('oyuncu: gişenin önünden geçerken (kısa durak) bilet kesilmez', () => {
  const { sim, S, y } = mk(); sim.command({ kind: 'setTime', hour: 9.05 }); gir(sim, EGLENCE_KAT);
  S.money = 1000; const g = GISELER[0];
  sim.command({ kind: 'teleport', x: g.musteri.x, z: g.musteri.z, kat: EGLENCE_KAT }); for (let i = 0; i < 6; i++) sim.step(0.1);
  sim.command({ kind: 'teleport', x: g.musteri.x + 4, z: g.musteri.z, kat: EGLENCE_KAT }); for (let i = 0; i < 20; i++) sim.step(0.1);
  expect(y.bilet()).toBeNull(); expect(S.money).toBe(1000);
});
