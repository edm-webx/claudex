// Martı AVM eğlence katı ve yaşamı (2026-11-21 21:07 sahip: AVM içi ayrı âlem; insanlar, konser, sinema salonları).
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { AVM, HOL, katY, avmIcinde, avmYol } from '../../src/content/avm-kat';
import { EGLENCE_KAT, SALONLAR, SAHNE, MUZISYEN, KULIS, seans, konser, eglenceEngel } from '../../src/content/avm-eglence';
import { icBina } from '../../src/content/ic-mekan';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state, y: sim.rules.rt.agents.avmYasam }; };
const gir = (sim: any, kat = 0) => { sim.command({ kind: 'teleport', x: AVM.cx, z: 47, kat }); sim.step(0.25); };

it('eğlence katı: en üst kat, tek dükkân Sinema Büfesi (doğu lobi); iki sinema salonu (15 koltuk) ve sahne binanın içinde, kapılar holde', () => {
  expect(EGLENCE_KAT).toBe(AVM.KAT - 1); expect(icBina('avm').filter(m => (m.kat || 0) === EGLENCE_KAT).map(m => m.arsa)).toEqual(['k18']);
  for (const s of SALONLAR) { expect(s.koltuk.length).toBeGreaterThanOrEqual(15); for (const k of s.koltuk) { expect(avmIcinde(k)).toBe(true); expect(k.x).toBeLessThan(HOL.x0); expect(k.z).toBeGreaterThan(s.z0); expect(k.z).toBeLessThan(s.z1); } }
  expect(SAHNE.x0).toBeGreaterThan(HOL.x1); expect(SAHNE.x1).toBeLessThan(AVM.x1);
  const r = eglenceEngel(), ic = (p: { x: number; z: number }) => r.some(q => p.x > q.x0 && p.x < q.x1 && p.z > q.z0 && p.z < q.z1);
  for (const s of SALONLAR) { expect(ic(s.kapi)).toBe(false); expect(ic(s.ici)).toBe(false); for (const k of s.koltuk) expect(ic(k)).toBe(false); }
  expect(ic({ x: (SAHNE.x0 + SAHNE.x1) / 2, z: 51.8 })).toBe(true); expect(ic(KULIS)).toBe(false);
  const p = avmYol(0, { x: AVM.cx, z: 47 }, EGLENCE_KAT, SALONLAR[0].kapi); expect(p[p.length - 1].y).toBe(katY(EGLENCE_KAT));
  const q = avmYol(EGLENCE_KAT, SALONLAR[0].kapi, 1, { x: HOL.x1 - 0.7, z: 49 }); expect(q[q.length - 1].y).toBe(katY(1));
});

it('takvim: salonlar sırayla seans açar (giriş, film, çıkış), gece kapalı; günde üç konser, öncesinde hazırlık', () => {
  expect(seans(SALONLAR[0], 10.1).durum).toBe('giris'); expect(seans(SALONLAR[0], 11).durum).toBe('film'); expect(seans(SALONLAR[0], 11.9).durum).toBe('cikis');
  expect(seans(SALONLAR[1], 11.1).durum).toBe('giris'); expect(seans(SALONLAR[0], 3).durum).toBe('kapali'); expect(seans(SALONLAR[0], 25.5).durum).toBe('kapali');
  expect(konser(13.5).durum).toBe('sahnede'); expect(konser(16.8).durum).toBe('hazirlik'); expect(konser(15).durum).toBe('yok');
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

it('sinema: seansta seyirci salona girip koltuğa oturur ve perdeye bakar, film bitince çıkar', () => {
  const { sim, y } = mk(); sim.command({ kind: 'setTime', hour: 9.95 }); gir(sim, EGLENCE_KAT);
  sim.command({ kind: 'setTime', hour: 10.05 });
  let oturan = 0;
  for (let i = 0; i < 1200 && !oturan; i++) { sim.step(0.25); if (i % 40 === 0) sim.command({ kind: 'setTime', hour: 10.05 + (i % 200) / 2000 }); oturan = y.rows().filter((r: any) => r.st === 'film').length; }
  expect(oturan).toBeGreaterThan(0);
  const f = y.rows().find((r: any) => r.st === 'film'); expect(f.act).toBe('sit'); expect(f.x).toBeLessThan(HOL.x0); expect(f.y).toBeCloseTo(katY(EGLENCE_KAT), 3);
  sim.command({ kind: 'setTime', hour: 11.85 }); sim.step(0.25); sim.step(0.25);
  expect(y.rows().filter((r: any) => r.st === 'film' && r.z < SALONLAR[0].z1)).toHaveLength(0);   // salon 2 bir saat kaydırılmış, o hâlâ oynuyor
});

it('konser: müzisyenler kulisten gelip sahneye çıkar, sazla / mikrofonla / davulla çalar; izleyici alkışlar; bitince giderler', () => {
  const { sim, y } = mk(); sim.command({ kind: 'setTime', hour: 16.7 }); gir(sim, EGLENCE_KAT);
  expect(y.muzisyen()).toHaveLength(3); expect(y.muzisyen()[0].y).toBeCloseTo(katY(EGLENCE_KAT), 3);   // kulis, kat zemini
  for (let i = 0; i < 80; i++) sim.step(0.25);
  sim.command({ kind: 'setTime', hour: 17.2 }); sim.step(0.25);
  const m = y.muzisyen(); expect(m.map((x: any) => x.act)).toEqual(['perform', 'perform', 'perform']); expect(m.map((x: any) => x.fx)).toEqual(MUZISYEN.map(x => x.fx));
  for (const x of m) { expect(x.y).toBeCloseTo(katY(EGLENCE_KAT) + SAHNE.h, 3); expect(x.x).toBeGreaterThan(SAHNE.x0); }
  let alkis = 0; for (let i = 0; i < 600 && !alkis; i++) { sim.step(0.25); if (i % 40 === 0) sim.command({ kind: 'setTime', hour: 17.3 }); alkis = y.rows().filter((r: any) => r.st === 'konser' && (r.act === 'cheer' || r.act === 'dance')).length; }
  expect(alkis).toBeGreaterThan(0);
  sim.command({ kind: 'setTime', hour: 18.6 }); for (let i = 0; i < 120 && y.muzisyen().length; i++) sim.step(0.25);
  expect(y.muzisyen()).toHaveLength(0);
});
