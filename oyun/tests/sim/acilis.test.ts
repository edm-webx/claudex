// 2026-11-22 sahip: "kırtasiye ve okulun önünde sarı kareler var, onlar hemen açılmayacak; belirli bir düzene ve sıraya göre açacağız,
// aynı büfenin büyümesi belli aşamalarda yıldızlarda oluyor ya; hepsine bir koşul, bir görev bağlamak lazım".
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { ARSALAR, ISLETME, ARSA_ISLETME } from '../../src/content/esya';
import { ACILIS, acilisEksik, tadilatAsama } from '../../src/content/acilis';
import { hedefApi } from '../../src/game/sim/goals';
import { mulkApi } from '../../src/game/sim/mulk';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state }; };
const keys = (sim: any) => [...sim.rules.rt.pads].map((p: any) => p.key).filter((k: string) => /^(isl|avm)\.k\d+$/.test(k)).sort();
const pad = (sim: any, key: string) => [...sim.rules.rt.pads].find((p: any) => p.key === key);

it('tablo: satın alınabilen her yerin bir koşulu var; sıra döngüsüz, önceki dükkân hiçbir zaman sonrakinden geç açılmaz', () => {
  expect(Object.keys(ACILIS).sort()).toEqual(ARSALAR.map(a => a.id).sort());
  for (const [id, k] of Object.entries(ACILIS)) {
    expect(k.asama, id).toBeGreaterThanOrEqual(2);   // hiçbiri baştan açık değil
    const seen = new Set([id]); let o = k.once;
    while (o) { expect(seen.has(o), id + ' döngü').toBe(false); seen.add(o); expect(ACILIS[o].asama, id + ' > ' + o).toBeLessThanOrEqual(k.asama); o = ACILIS[o].once; }
  }
  expect(tadilatAsama('k1', 2)).toBe(2); expect(tadilatAsama('k1', 5)).toBe(4); expect(tadilatAsama('k17', 5)).toBe(10);
});

it('oyun başında hiçbir dükkân karesi yok; büfe 2. aşamada yalnız Meydan Kafe çıkar, görev bitene dek para almaz ve koşulu yazar', () => {
  const { sim, S } = mk(); S.money = 5e6; S.level = 20;
  sim.step(0.6); expect(keys(sim)).toEqual([]);
  S.stage = 2; S.stars = 2; S.stats.served = 120; sim.step(0.6);
  expect(keys(sim)).toEqual(['isl.k1']);
  expect(pad(sim, 'isl.k1').sub).toBe('🔒 500 müşteriye servis (120/500)');
  sim.command({ kind: 'mulk', op: 'arsaAl', id: 'k1' }); expect(S.zones.arsa?.plots?.k1).toBeUndefined();   // panelden de alınmaz
  S.stats.served = 500; sim.step(0.6); expect(pad(sim, 'isl.k1').sub).toBe('Dükkânı satın al');
  sim.command({ kind: 'mulk', op: 'arsaAl', id: 'k1' }); expect(S.zones.arsa.plots.k1).toMatchObject({ tur: 'dukkan', lv: 1 });
  sim.step(0.6); expect(keys(sim)).toEqual(['isl.k2']);   // sıradaki: Sahil Bistro, kilitli (4 yıldız + vapur görevi)
  expect(pad(sim, 'isl.k2').sub).toMatch(/^🔒 4★ karne \+ 50 vapur/);
  S.stars = 4; S.stats.ferries = 50; sim.step(0.6); expect(pad(sim, 'isl.k2').sub).toBe('Dükkânı satın al');
});

it('kırtasiye ve kantin büfe 3. aşamadan önce görünmez; AVM dükkânları karşı yaka bitmeden görünmez', () => {
  const { sim, S } = mk(); S.money = 9e7; S.level = 40; S.stars = 5; S.stats.served = 1e5; S.stats.ferries = 1e3; S.stats.cleaned = 1e4; S.stage = 2;
  for (const id of ['k1', 'k2']) sim.command({ kind: 'mulk', op: 'arsaAl', id });
  sim.step(0.6); expect(keys(sim)).toEqual([]);   // k4 (kantin) 3. aşamayı bekliyor
  S.stage = 3; sim.step(0.6); expect(keys(sim)).toEqual(['isl.k4']);
  const dur = { stage: 3, stars: 5, level: 40, stats: S.stats, sahip: (id: string) => !!S.zones.arsa.plots[id] };
  expect(acilisEksik(ARSALAR.find(a => a.id === 'k3')!, dur)).toEqual(['önce Okul Kantini', 'okulda 8 sınav ver (0/8)']);
  expect(acilisEksik(ARSALAR.find(a => a.id === 'k10')!, dur)[0]).toMatch(/^5\. aşama büfe/);
});

it('dükkân tadilatı büfe aşamasını bekler: kare kilitli görünür, para almaz', () => {
  const { sim, S } = mk(); S.money = 9e7; S.level = 40; S.stage = 2; S.stats.served = 600;
  sim.command({ kind: 'mulk', op: 'arsaAl', id: 'k1' });
  const p = S.zones.arsa.plots.k1; p.lv = 2; p.esya = ISLETME[ARSA_ISLETME.k1].esya.filter(e => e.lv <= 2).map(e => e.id);
  sim.step(0.6); expect(pad(sim, 'isl.k1.tadilat').sub).toMatch(/^🔒 3\. aşama büfe/);
  const m0 = S.money; sim.command({ kind: 'mulk', op: 'yukselt', id: 'k1' }); expect(S.money).toBe(m0); expect(p.tadilat).toBeFalsy();
  S.stage = 3; sim.step(0.6); expect(pad(sim, 'isl.k1.tadilat').sub).not.toMatch(/🔒/);
});

it('keyif: sıradaki dükkân hedef kartında çubukla; kare ilk çıkınca ve kilidi açılınca bir kez kutlanır (ses olayı + ışık)', () => {
  const { sim, S } = mk(); S.money = 0; S.level = 20; S.stage = 2; S.stats.served = 100;
  const ev: string[] = []; sim.bus.onAny((r: any) => { if (r.name === 'dukkanKare' || r.name === 'dukkanSatilik') ev.push(r.name); });
  for (const k of Object.keys(S.padPaid || {})) delete S.padPaid[k];
  sim.step(0.6); expect(ev).toEqual(['dukkanKare']);
  const goal = () => (hedefApi(sim.rules) as any).card().main;
  sim.command({ kind: 'hedef', op: 'pin' }); for (let i = 0; i < 12 && goal()?.key !== 'dukkan.k1'; i++) sim.command({ kind: 'hedef', op: 'pin' });
  expect(goal().key).toBe('dukkan.k1'); expect(goal().label).toBe('Sıradaki dükkân: Meydan Kafe'); expect(goal().sub).toBe('500 müşteriye servis (100/500)');
  const f0 = goal().frac; S.stats.served = 400; sim.step(0.6); expect(goal().frac).toBeGreaterThan(f0);
  S.stats.served = 500; sim.step(0.6); expect(ev).toEqual(['dukkanKare', 'dukkanSatilik']); expect(goal().label).toBe('Meydan Kafe satılık!');
  sim.step(2); expect(ev).toHaveLength(2);   // bir kez
});

it('dükkân alınınca açılış sandığı düşer; dükkânın kendi görev zinciri sırayla ödül verir, panelde ilerlemesi görünür', () => {
  const { sim, S } = mk(); S.money = 1e6; S.level = 20; S.stage = 2; S.stats.served = 600;
  sim.command({ kind: 'mulk', op: 'arsaAl', id: 'k1' });
  expect(S.zones.envanter.sandik.tahta).toBe(1);
  const p = S.zones.arsa.plots.k1, m0 = () => S.money;
  sim.step(0.6); expect(S.tut.dg_k1 || 0).toBe(0);   // henüz alet yok
  const a = m0(); p.esya = ['x']; sim.step(0.6); expect(S.tut.dg_k1).toBe(1); expect(m0()).toBeGreaterThan(a);
  p.isci = 1; p.sat = 60; sim.step(0.26); expect(S.tut.dg_k1).toBe(2); sim.step(0.26); expect(S.tut.dg_k1).toBe(3);   // tick başına bir görev
  const row = (mulkApi(sim.rules) as any).model().arsa.find((x: any) => x.id === 'k1');
  expect(row.dgorev).toMatchObject({ ad: '2. seviyeye çıkar', v: 1, n: 2, no: 4 });
});

it('AR-GE: görevlerden önce alınmış dükkân (eski kayıt) bir anda ödül yağdırmaz; tamamlanmış görevler ödülsüz atlanır, sonrakiler ödüllü', () => {
  const { sim, S } = mk(); S.money = 100; S.level = 20; S.stage = 6;
  S.zones.arsa ||= {}; S.zones.arsa.plots ||= {};
  S.zones.arsa.plots.k1 = { tur: 'dukkan', tip: 'kafe', lv: 3, till: 0, sat: 400, fr: 0, isci: 2, esya: ['a', 'b'] };   // eski kayıt: dg_k1 yok
  delete S.tut.dg_k1; const m0 = S.money;
  for (let i = 0; i < 12; i++) sim.step(0.26);
  expect(S.tut.dg_k1).toBe(6);   // 6 görev zaten tamam (alet, işçi, 50, lv2, 300, lv3): ödülsüz atlandı
  expect(S.money).toBeLessThan(m0 + 1000);
  S.zones.arsa.plots.k1.sat = 1200; sim.step(0.26); expect(S.tut.dg_k1).toBe(7); expect(S.money).toBeGreaterThan(m0 + 1000);   // sıradaki gerçekten ödüllü
});

it('AR-GE: sıralı açılmadan önce yarım ödenmiş ama artık gizli dükkân karesinin parası iade edilir', () => {
  const { sim, S } = mk(); S.money = 1000; S.padPaid['avm.k8'] = 25000;
  sim.step(0.6);
  expect(S.padPaid['avm.k8']).toBeUndefined(); expect(S.money).toBe(26000);
});
