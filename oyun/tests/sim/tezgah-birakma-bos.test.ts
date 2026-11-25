import { it, expect } from 'vitest';
import { kur } from './garson-yardimci';
// 2026-11-25 sahip: "elimdeki döner, çay tezgaha hala bırakamıyorum, sadece müşteri varsa alıyor; başlarda biriktirebiliyorduk".
// Kök neden: açık her masa adisyonu (aşama 3+, 48 masaya kadar) elde taşınan ürünü "ayırıyordu"; sırada kimse yokken hiçbir şey inmiyordu.
// Şimdi yalnız en eski 3 adisyon elde servis için ayrılır; fazlası tezgâha biriktirilir (hazır ürün, depo/stok yok, tezgâh 12'de dolar).
for (const stage of [3, 6, 8]) it(`aşama ${stage}: çok masa açıkken ve sırada kimse yokken fazla ürün tezgâha biriktirilir`, () => {
  const k = kur(4), { sim, r } = k;
  sim.command({ kind: 'force', what: 'stage', value: stage }); k.step(0.5);
  for (let i = 0; i < 6; i++) k.musteri(i, { doner: 1 });
  k.step(6);
  expect(r.queue.length, 'sırada kimse yok').toBe(0);
  r.carry.length = 0; for (const p of Object.keys(r.counter)) r.counter[p].length = 0;
  for (let i = 0; i < 6; i++) r.carry.push({ type: 'doner', tier: 1 });
  const ctr = sim.interactions.get('counter') as any;
  sim.command({ kind: 'teleport', x: ctr.pos.x + 0.9, z: ctr.pos.z });
  for (let i = 0; i < 60 && Math.abs(sim.walk.pos.x - ctr.pos.x) > 0.15; i++) { sim.input({ x: -1, z: 0 }); sim.step(1 / 30); }
  sim.input({ x: 0, z: 0 });
  sim.step(0.5);
  expect(r.counter.doner.length, 'tezgâha inenler').toBeGreaterThanOrEqual(2);
  expect(r.carry.length, 'elde ayrılmışlar elde').toBeLessThanOrEqual(4);
});
it('boş büfede (adisyon yok) her şey tezgâha iner', () => {
  const k = kur(4), { sim, r } = k;
  sim.command({ kind: 'force', what: 'stage', value: 3 }); k.step(0.5);
  r.carry.length = 0; for (let i = 0; i < 4; i++) r.carry.push({ type: 'doner', tier: 1 });
  const ctr = sim.interactions.get('counter') as any;
  sim.command({ kind: 'teleport', x: ctr.pos.x + 0.9, z: ctr.pos.z });
  for (let i = 0; i < 60 && Math.abs(sim.walk.pos.x - ctr.pos.x) > 0.15; i++) { sim.input({ x: -1, z: 0 }); sim.step(1 / 30); }
  sim.input({ x: 0, z: 0 }); sim.step(1);
  expect(r.carry.length).toBe(0);
});
