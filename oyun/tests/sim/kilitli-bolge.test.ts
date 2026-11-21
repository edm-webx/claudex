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
