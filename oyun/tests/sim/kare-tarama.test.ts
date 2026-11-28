// 2026-11-23 sahip: "sarı kare görünüyor ama üstüne gidince para yatmıyor, öylece görsel olarak var". Gerçek akış taraması:
// admin kısayolu yok (rt.acilisSerbest kapalı), her büfe aşamasında görünen HER sarı kareye oyuncu yürür (ışınlanır) ve durur.
// Kural: kilitsiz kare ya para çeker ya da işini yapıp kaybolur; kilitli kare para çekmez ve kilidini yazar. "Ölü kare" = hata.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { ARSALAR } from '../../src/content/esya';

type Pad = { key: string; pos: { x: number; z: number }; kat?: number; sub?: string; price: number };
const pads = (sim: any): Pad[] => [...sim.rules.rt.pads];

function tara(stage: number, gorevler = false) {
  const sim = played(7) as any, S = sim.state; sim.step(1);
  S.stage = stage; S.level = 3 + stage * 3; S.stars = 5;
  if (gorevler) for (const k of ['served', 'ferries', 'sinav', 'cleaned', 'macOyun', 'miniPlay', 'turistFoto', 'paketTeslim', 'tips']) S.stats[k] = 1e6;
  sim.step(0.6);
  const olu: string[] = [], seen = new Set<string>(), kilitli: string[] = []; let alindi = 0;
  for (let tur = 0; tur < 400; tur++) {
    const p = pads(sim).find(q => !seen.has(q.key)); if (!p) break; seen.add(p.key);
    S.money = 5e8; const m0 = S.money;
    sim.command({ kind: 'teleport', x: p.pos.x, z: p.pos.z, kat: p.kat || 0 });
    let gitti = false;
    for (let i = 0; i < 60; i++) { sim.step(0.25); if (!pads(sim).some(q => q.key === p.key)) { gitti = true; break; } }
    const cekti = S.money < m0 - 0.5 || (S.padPaid[p.key] || 0) > 0;
    const kilit = String(p.sub || '').startsWith('🔒');
    if (gitti) alindi++; if (kilit) kilitli.push(p.key + ' ' + p.sub);
    if (!kilit && !gitti && !cekti) olu.push(p.key + ' (' + (p.sub || '') + ')');
    if (kilit && cekti) olu.push(p.key + ' kilitli ama para çekti');
    sim.command({ kind: 'teleport', x: 0, z: 0, kat: 0 }); sim.step(0.3);
  }
  return { olu, n: seen.size, alindi, kilitli, sim };
}

for (const st of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  it('aşama ' + st + ': görünen her sarı kare ya çalışır ya kilidini söyler (ölü kare yok)', () => {
    const r = tara(st);
    console.log('aşama', st, 'kare', r.n, 'alındı', r.alindi, 'ölü', r.olu, 'kilitli', r.kilitli);
    expect(r.olu).toEqual([]);
  }, 120000);
}

it('holding yolu uçtan uca: görevler bitmiş oyuncu 10. aşamada bütün dükkânları sarı karelerinden sırayla alır', () => {
  const r = tara(10, true);
  const plots = r.sim.state.zones.arsa?.plots || {};
  const eksik = ARSALAR.filter((a: any) => a.sabit && !plots[a.id]).map((a: any) => a.id);
  console.log('holding', r.n, r.alindi, r.olu, r.kilitli, eksik);
  expect(r.olu).toEqual([]); expect(r.kilitli).toEqual([]); expect(eksik).toEqual([]);
}, 120000);

it('yönetici "Bütün kareleri aç" dükkân karelerini de açar (görev şartı kalkar); "Aşama N" esnaf seviyesini de o aşamaya taşır (üst geçit açık)', () => {
  const sim = played(7) as any, S = sim.state; sim.step(1);
  S.stage = 2; S.level = 5; sim.step(0.6);
  expect([...sim.rules.rt.pads].find((q: any) => q.key === 'isl.k1')?.sub).toMatch(/^🔒/);
  sim.command({ kind: 'force', what: 'serbest', value: 1 }); sim.step(0.6);
  expect(String([...sim.rules.rt.pads].find((q: any) => q.key === 'isl.k1')?.sub || '')).not.toMatch(/🔒/);
  // admin-panel "Aşama 3" = stage + level 9 komutları
  sim.command({ kind: 'force', what: 'stage', value: 3 }); sim.command({ kind: 'force', what: 'level', value: 9 });
  expect(S.level).toBeGreaterThanOrEqual(3);
});

it('kilitli dükkân karesine her basışta (6 sn arayla) neyin eksik olduğu söylenir, oturumda bir kez değil', () => {
  const sim = played(7) as any, S = sim.state; sim.step(1);
  S.stage = 2; S.level = 10; S.money = 1e6; sim.step(0.6);
  const p = [...sim.rules.rt.pads].find((q: any) => q.key === 'isl.k1') as any;
  const say = () => sim.events(0).filter((e: any) => e.name === 'toast' && /Meydan Kafe: önce/.test(JSON.stringify(e.data))).length;
  const n0 = say();
  for (let k = 0; k < 2; k++) {
    sim.command({ kind: 'teleport', x: p.pos.x, z: p.pos.z, kat: 0 }); for (let i = 0; i < 8; i++) sim.step(0.25);
    sim.command({ kind: 'teleport', x: 0, z: 0, kat: 0 }); for (let i = 0; i < 24; i++) sim.step(0.25);
  }
  expect(say() - n0).toBe(2); expect(S.money).toBe(1e6);
});
