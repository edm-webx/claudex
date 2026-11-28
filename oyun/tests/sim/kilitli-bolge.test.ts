// 2026-11-21: promenadın iki ucundaki kilitli inşaat sahaları: veri tutarlı, işçiler gerçek actor ve çalışıyor, açılış kancası çalışıyor
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { KILITLI_BOLGELER, bolgeEngelleri, acikBolgeler, dunya } from '../../src/content/kilitli-bolge';
import { WALKABLE } from '../../src/content/prefabs/iskele/layout';

const belediye = (sim: any) => sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.info.role === 'belediye');

it('iki ayrı bölge var, ikisi de kilitli başlar ve promenadı tam keser', () => {
  expect(KILITLI_BOLGELER.map(b => b.id).sort()).toEqual(['insaat-bati', 'insaat-dogu']);
  expect(acikBolgeler({})).toEqual([]);
  const r = bolgeEngelleri({});
  expect(r).toHaveLength(2);
  const prom = WALKABLE[1];
  for (const k of r) { expect(k.z0).toBeLessThanOrEqual(prom.z0); expect(k.z1).toBeGreaterThanOrEqual(prom.z1); }
  // müşteri doğuş noktaları (±50) engelin dışında
  for (const k of r) expect(50 > k.x0 && 50 < k.x1).toBe(false), expect(-50 > k.x0 && -50 < k.x1).toBe(false);
});

it('açılış kancası: acikBolgeler listesindeki bölge kilitten çıkar', () => {
  expect(bolgeEngelleri({ acikBolgeler: ['insaat-dogu'] }).length).toBe(1);
  expect(bolgeEngelleri({ acikBolgeler: ['insaat-dogu', 'insaat-bati'] }).length).toBe(0);
});

it('işçi noktaları sahanın içinde (çitin arkası ya da dolgu), çitin önüne çıkmaz', () => {
  for (const b of KILITLI_BOLGELER) for (const p of b.isciler) for (const q of p.yol) {
    const onProm = q.z >= b.saha.z0 && q.z <= b.saha.z1, inDolgu = q.z <= b.dolgu.z1 && q.z >= b.dolgu.z0 && q.u >= b.dolgu.u0;
    expect(onProm ? q.u > b.citU : inDolgu).toBe(true);
    expect(Math.sign(dunya(b, q).x)).toBe(b.taraf);
  }
});

it('belediye işçileri gerçek actor: bölge başına 4, yürür ve çalışır; bölge açılınca giderler', () => {
  const sim = played(1) as any; sim.step(0.25);
  expect(belediye(sim)).toHaveLength(8);
  const acts = new Set<string>(), fx = new Set<string>(), start = new Map<number, [number, number]>();
  for (let i = 0; i < 600; i++) { sim.step(0.1); for (const a of belediye(sim)) { acts.add(a.act); fx.add(a.fx); if (!start.has(a.id)) start.set(a.id, [a.x, a.z]); } }
  for (const k of ['carry', 'cut', 'wipe', 'walk']) expect(acts.has(k)).toBe(true);
  for (const k of ['kalas', 'cekic', 'kurek', 'bayrak']) expect(fx.has(k)).toBe(true);
  expect(belediye(sim).filter((a: any) => Math.hypot(a.x - start.get(a.id)![0], a.z - start.get(a.id)![1]) > 0.5).length).toBeGreaterThan(2);
  sim.state.acikBolgeler = ['insaat-dogu']; sim.step(0.25);
  expect(belediye(sim)).toHaveLength(4);
  expect(belediye(sim).every((a: any) => a.x < 0)).toBe(true);
});

it('bayrakçı oyuncu bariyere gelince durur, ona döner, el sallar', () => {
  const sim = played(1) as any; sim.step(0.25);
  sim.command({ kind: 'teleport', x: 48.5, z: 9.3 }); sim.step(0.1);
  let wave = false; for (let i = 0; i < 20; i++) { sim.step(0.1); const f = belediye(sim).find((a: any) => a.fx === 'bayrak' && a.x > 0); if (f?.act === 'wave') wave = true; }
  expect(wave).toBe(true);
});

/* ---------- üst geçit inşaatı (2026-11-21) ---------- */
import { UST_GECIT, gecitAcik, gecitEngeli } from '../../src/content/kilitli-bolge';
import { UG } from '../../src/content/ustgecit';
import { sokakRun } from './sokak-harness';
import { AGENT_FLAG } from '../../src/game/sim/schema';

it('üst geçit: seviye 1 kapalı, seviye 2 ya da açılış listesiyle açık; engel yalnız orta açıklıkta', () => {
  expect(gecitAcik({ level: 1 })).toBe(false);
  expect(gecitAcik({ level: UST_GECIT.seviye })).toBe(true);
  expect(gecitAcik({ level: 1, acikBolgeler: ['ust-gecit'] })).toBe(true);
  expect(gecitAcik({})).toBe(true);   // seviye bilgisi olmayan araç durumu kilitlemez
  const r = gecitEngeli(), inR = (x: number, z: number) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  expect(inR(UG.x, 20.7)).toBe(true);
  // iki merdiven ve promenad (yürüme yolu) açık kalır
  for (const z of [UG.zA, 12, UG.zB, 16, 25.5, UG.zC, UG.zD]) expect(inR(UG.x, z)).toBe(false);
  expect(r.z0).toBeGreaterThan(UG.zB + 1); expect(r.z1).toBeLessThan(UG.zC - 1);
});

it('üst geçit kapalıyken oyuncu açıklıktan geçemez; seviye 2 olunca geçer ve haber gelir', () => {
  const sim = played(1) as any; sim.step(0.25);
  sim.state.level = 1; sim.step(0.25);
  sim.command({ kind: 'teleport', x: UG.x, z: 15.6 }); sim.step(0.1);
  sim.input({ x: 0, z: 1 }); for (let i = 0; i < 40; i++) sim.step(0.1);
  expect(sim.state.player.z).toBeLessThan(UST_GECIT.z0);
  sim.input({ x: 0, z: 0 }); sim.state.level = UST_GECIT.seviye; for (let i = 0; i < 20; i++) sim.step(0.25);
  expect(sim.events(0).some((e: any) => e.name === 'toast' && /Üst geçit tamamlandı/.test(e.data?.text ?? e.text ?? ''))).toBe(true);
  sim.input({ x: 0, z: 1 }); for (let i = 0; i < 40; i++) sim.step(0.1);
  expect(sim.state.player.z).toBeGreaterThan(UST_GECIT.z1);
});

it('üst geçit kapalıyken yayalar karşıya geçmez, kimse takılmaz', () => {
  const r = sokakRun(5, 13); (r.state as any).level = 1;
  const X = r.s.f32('x'), Z = r.s.f32('z'), F = r.s.u16('flags');
  let gap = 0;
  r.tick(30 * 240, () => { for (let i = 0; i < r.s.hi; i++) if (r.s.alive(i) && (F[i] & AGENT_FLAG.ambient) && Math.abs(X[i] - UG.x) < UG.hw + 0.3 && Z[i] > UST_GECIT.z0 && Z[i] < UST_GECIT.z1) gap++; });
  expect(gap).toBe(0);
  expect(r.amb.sokak).toBe(true);
}, 120000);
