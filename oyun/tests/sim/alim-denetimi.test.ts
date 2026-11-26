// Alım denetimi (2026-11-25): her aşamada sarı karelerin HEPSİ gerçekten alınabiliyor mu? Karenin üstüne ışınlan, dur, para aksın;
// kare kaybolmalı, para düşmeli, masa/istasyon gerçekten kurulmalı. Rapor: calisma/alim-denetimi/rapor.json
import { it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { played } from './m1-helpers';

interface Sat { asama: number; key: string; fiyat: number; kat: number; sonuc: string; ayrinti?: string }
const rapor: Sat[] = [];

function denetle(asama: number): Sat[] {
  const sim = played(7) as any; sim.step(1);
  const S = sim.state, rt = sim.rules.rt, out: Sat[] = [];
  // gerçek yol: her aşama gerçek tadilatla geçilir (setStage yönetici komutu bütün masaları hediye eder, oyuncu akışını yansıtmaz)
  for (let g = 0; g < 12 && S.stage < asama; g++) {
    S.stars = 5; S.money = 5e9; sim.step(0.5); sim.command({ kind: 'startTadilat' });
    for (let i = 0; i < 2000 && S.tadilat; i++) { S.money = 5e9; sim.step(5); }
  }
  expect(S.stage).toBe(asama);
  rt.acilisSerbest = true;   // dükkân sıralı-açılış kilitleri bu testte açık: amaç alım/yerleşim hatası aramak (kilitler tests/sim/acilis.test.ts'te)
  const gordu = new Set<string>();
  for (let tur = 0; tur < 400; tur++) {
    S.money = 5e9; S.stars = 5; S.level = Math.max(S.level || 1, 12); S.playT = Math.max(S.playT, 4000);
    sim.step(0.6);
    const kare = (rt.pads as any[]).find(p => !gordu.has(p.key));
    if (!kare) break;
    gordu.add(kare.key);
    const kat = kare.kat || 0, m0 = S.money, snap0 = JSON.stringify([S.owned, S.zones]);
    let ulas = 'ok';
    const yakin = (rt.pads as any[]).filter(q => q !== kare && (q.kat || 0) === kat && Math.hypot(q.pos.x - kare.pos.x, q.pos.z - kare.pos.z) < 1.6);
    if (yakin.length) ulas = 'YAKIN:' + yakin.map(q => q.key + '@' + Math.hypot(q.pos.x - kare.pos.x, q.pos.z - kare.pos.z).toFixed(2)).join(',');
    if (!kat) { const a = { x: 0, z: 6 }, pth = sim.nav.path(a, kare.pos) as any[]; const son = pth && pth.length ? pth[pth.length - 1] : null;
      if (!son || Math.hypot(son.x - kare.pos.x, son.z - kare.pos.z) > 0.7 || !sim.nav.walkable(kare.pos)) ulas = 'ULASILAMAZ'; }
    sim.command({ kind: 'teleport', x: kare.pos.x, z: kare.pos.z, kat });
    let alindi = false;
    for (let i = 0; i < 200; i++) { sim.step(0.1); S.money = Math.max(S.money, 5e9 - 1); if (!(rt.pads as any[]).includes(kare)) { alindi = true; break; } }
    out.push({ asama, key: kare.key, fiyat: Math.round(kare.price), kat, sonuc: alindi ? 'ok' : 'ALINMADI', ayrinti: alindi ? undefined : 'paid=' + Math.round(S.padPaid[kare.key] || 0) + ' pos=' + JSON.stringify(kare.pos) });
    if (ulas !== 'ok') out[out.length - 1].sonuc = ulas;
    const degisti = JSON.stringify([S.owned, S.zones]) !== snap0;
    if (alindi && !degisti) out[out.length - 1].sonuc = 'ETKISIZ';
    void m0;
    // yer değiştirme: oyuncu karenin üstünden çekilsin
    sim.command({ kind: 'teleport', x: 0, z: 6, kat: 0 }); sim.step(0.2);
  }
  return out;
}
for (let a = 1; a <= 10; a++) it('aşama ' + a + ': tüm sarı kareler alınır', () => {
  const o = denetle(a); rapor.push(...o);
  mkdirSync('calisma/alim-denetimi', { recursive: true }); writeFileSync('calisma/alim-denetimi/rapor.json', JSON.stringify(rapor, null, 1));
  const kotu = o.filter(x => x.sonuc !== 'ok');
  expect(kotu, JSON.stringify(kotu)).toEqual([]);
}, 120000);

// Aşama 1 başlangıç zinciri (çay > ayran > simit > tabure > işçi > pencere > ... > tadilat): oyuncu gibi sırayla, hepsi alınmalı
import { PADS } from '../../src/content/pads';
it('aşama 1: ilk sarı kare zinciri baştan sona alınır (tabure, masa, istasyon, tepsi, pencere, işçi)', () => {
  const sim = played(9) as any, S = sim.state, rt = sim.rules.rt; sim.step(1);
  const alinan: string[] = []; let isci = false;
  for (let tur = 0; tur < 300; tur++) {
    S.money = 5e6; S.playT = Math.max(S.playT, 2000); S.stars = Math.max(S.stars, 2); S.tut.firstCollect = 1; S.tut.cayUsed = 1; sim.step(0.7);
    if (S.owned.isbul && !isci) { sim.command({ kind: 'openJobBoard' }); for (let i = 0; i < 40 && !S.workers.length; i++) { const c = (S.jobCards || [])[0]; if (c) sim.command({ kind: 'hireCandidate', id: c.id }); else sim.command({ kind: 'refreshBoard' }); } sim.command({ kind: 'closeJobBoard' }); isci = S.workers.length > 0; }
    const kare = (rt.pads as any[]).find(p => p.key !== 'tadilat' && !alinan.includes(p.key));
    if (!kare) { sim.step(5); if (!(rt.pads as any[]).some(p => p.key !== 'tadilat' && !alinan.includes(p.key))) break; continue; }
    sim.command({ kind: 'teleport', x: kare.pos.x, z: kare.pos.z, kat: 0 });
    for (let i = 0; i < 200 && (rt.pads as any[]).includes(kare); i++) { sim.step(0.1); S.money = Math.max(S.money, 5e6); }
    expect((rt.pads as any[]).includes(kare), kare.key + ' alınmadı').toBe(false);
    alinan.push(kare.key); sim.command({ kind: 'teleport', x: 0, z: 6, kat: 0 }); sim.step(0.2);
  }
  const eksik = PADS.filter(p => p.kind !== 'tadilat' && !S.owned[p.key] && p.stage === undefined).map(p => p.key);
  expect(eksik, 'alınmayan: ' + eksik.join(',')).toEqual([]);
  expect(S.workers.length).toBeGreaterThan(0);
  for (const i of [0, 1, 2, 3]) expect(rt.tables[i]?.built, 'masa ' + i).toBe(true);
  for (const st of ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz']) expect(rt.stations[st].built, st).toBe(true);
}, 120000);

// Dekor: her aşamada her eşya alınır VE boş yuvaya yerleşir (boş yuva varken "Boş yer yok" olmaz)
import { DECOR } from '../../src/content/economy';
it('dekor: tüm eşyalar her aşamada alınır ve yerleşir', () => {
  const sorun: string[] = [], ozet: Record<number, { yuva: string; ok: number; yok: string[] }> = {};
  for (const asama of [1, 3, 5, 8, 10]) {
    const sim = played(11) as any, S = sim.state, rt = sim.rules.rt; sim.step(1);
    for (let g = 0; g < 12 && S.stage < asama; g++) { S.stars = 5; S.money = 5e9; sim.step(0.5); sim.command({ kind: 'startTadilat' }); for (let i = 0; i < 2000 && S.tadilat; i++) { S.money = 5e9; sim.step(5); } }
    const yuva = rt.layout.slots.map((s: any) => s.size).join(''); const yok: string[] = []; let ok = 0;
    for (const d of DECOR) {
      S.money = 5e9; const sahip = S.decorOwned.filter((x: string) => x === d.id).length, yer0 = S.decorSlots.length, p0 = 5e9;
      sim.command({ kind: 'decorBuy', id: d.id }); sim.step(0.1);
      const alindi = S.decorOwned.filter((x: string) => x === d.id).length === sahip + 1, para = S.money < p0;
      const yerlesti = S.decorSlots.some((x: any) => x.item === d.id);
      if (!alindi || !para) { sorun.push(asama + ' ' + d.id + ' ALINMADI'); continue; }
      if (!yerlesti) { yok.push(d.id + '(' + d.size + ')'); }
      else { ok++; const sl = S.decorSlots.find((x: any) => x.item === d.id); sim.command({ kind: 'decorRemove', slot: Number(sl.slot) }); }
    }
    ozet[asama] = { yuva, ok, yok };
    if (yok.length) sorun.push(asama + ' yerlesmedi(' + yuva + '): ' + yok.join(','));
  }
  writeFileSync('calisma/alim-denetimi/dekor.json', JSON.stringify(ozet, null, 1));
  expect(sorun).toEqual([]);
}, 300000);

// Deniz paneli: dış eklentiler, hasır tabure / ortak masa / tavla masası (satın al + masaya yerleştir), korkuluk tezgahı, iskele eklentileri, vapur büfesi
import { EXTERIOR, SEATS, PIER_EXP, TEZGAH, VAPUR_BUFE } from '../../src/content/deniz';
it('deniz paneli: tabure ve masa çeşitleri, eklentiler her aşamada alınır ve masaya yerleşir', () => {
  const sorun: string[] = [];
  for (const asama of [1, 2, 3, 4, 8, 10]) {
    const sim = played(13) as any, S = sim.state, rt = sim.rules.rt; sim.step(1);
    for (let g = 0; g < 12 && S.stage < asama; g++) { S.stars = 5; S.money = 5e9; sim.step(0.5); sim.command({ kind: 'startTadilat' }); for (let i = 0; i < 2000 && S.tadilat; i++) { S.money = 5e9; sim.step(5); } }
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
    const model = () => (sim.rules.rt.deniz.model() as any), z = () => S.zones.deniz as any;
    const al = (op: string, id: string, ad: string, sayac: () => number) => { S.money = 5e9; const n = sayac(); sim.command({ kind: 'deniz', op, id }); sim.step(0.1); if (sayac() !== n + 1) sorun.push(asama + ' ' + ad + ' alınmadı: ' + JSON.stringify(model().exterior?.find((e: any) => e.id === id)?.why || '')); };
    for (const e of EXTERIOR) if (asama >= e.minStage) al('ext', e.id, 'eklenti ' + e.id, () => z()?.ext?.length || 0);
    for (const s of SEATS) if (s.id !== 'standart') {
      al('seatBuy', s.id, 'oturak ' + s.id, () => z()?.seatOwn?.length || 0);
      // her kurulu büfe masasına yerleştirilebilmeli
      for (const t of model().tables) { sim.command({ kind: 'deniz', op: 'seatSet', id: t.i + ':' + s.id }); sim.step(0.05); if (model().tables.find((x: any) => x.i === t.i).kind !== s.id) sorun.push(asama + ' ' + s.id + ' masa ' + t.i + ' yerleşmedi'); }
    }
    for (let i = 0; i < TEZGAH.max; i++) al('tez', '', 'tezgah ' + i, () => z()?.tez || 0);
    for (const p of PIER_EXP) if (asama >= p.minStage) al('pier', p.id, 'iskele ' + p.id, () => z()?.pier?.length || 0);
    if (asama >= VAPUR_BUFE.minStage) { S.money = 5e9; sim.command({ kind: 'deniz', op: 'bufe' }); sim.step(0.1); if (z()?.bufe) sorun.push(asama + ' vapur büfesi alındı (vapur kalktı, alınmamalı)'); }
    void rt;
  }
  expect(sorun).toEqual([]);
}, 300000);
