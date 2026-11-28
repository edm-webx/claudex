// 2026-11-24 sahip: aşama 6+ büfe tadilat karesi yürüyüş yolunda, üstünden yürüyerek geçmek cebi boşaltıyordu.
// Kural: tadilat karesinden geçerken kısa duraksamak (yarım saniye) para çekmez; halka dolana kadar (1 sn) durunca ödeme başlar.
import { it, expect } from 'vitest';
import { defaultState } from '../../src/game/sim/schema';
import { PADS } from '../../src/content/pads';
import { mkSim } from './m1-helpers';

function hazir(stage: number) {
  const d = defaultState(5) as any;
  d.stage = stage; d.stars = 5; d.money = 50_000_000;
  for (const p of PADS) if (p.kind !== 'tadilat') d.owned[p.key] = 1;
  const sim = mkSim(5, d); sim.command({ kind: 'play', hero: 'sabri' }); sim.step(1);
  return sim as any;
}

for (const stage of [2, 6]) it('aşama ' + stage + ': tadilat karesinde geçerken/duraksarken para çekilmez, durunca öder', () => {
  const sim = hazir(stage);
  const it0 = sim.interactions.get('pad.tadilat'); expect(it0, 'tadilat karesi var').toBeTruthy();
  const p = it0.pos, para0 = sim.state.money;
  // karenin 2 m batısından doğusuna tam hızla yürü
  sim.command({ kind: 'teleport', x: p.x - 2, z: p.z });
  for (let i = 0; i < 40; i++) { sim.input({ x: 1, z: 0 }); sim.step(1 / 30); }
  sim.input({ x: 0, z: 0 }); sim.step(0.05);
  expect(sim.state.money, 'geçerken ödeme').toBe(para0);
  // üstünde yarım saniye duraksa da ödeme yok
  sim.command({ kind: 'teleport', x: p.x, z: p.z }); sim.step(0.5);
  expect(sim.state.money, 'kısa duraksamada ödeme').toBe(para0);
  sim.command({ kind: 'teleport', x: p.x - 3, z: p.z }); sim.step(0.2);
  // geri dön ve üstünde dur
  sim.command({ kind: 'teleport', x: p.x, z: p.z }); sim.step(1.5);
  expect(sim.state.money).toBeLessThan(para0);
});
