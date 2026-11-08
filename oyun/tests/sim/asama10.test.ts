// 2026-11-08: büfe grows to 10 stages (6-10 around the kiosk), each tadilat costs more and brings more customers.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { KIOSK_STAGES, MAX_STAGE } from '../../src/content/stages';

it('stages run 1..10 with rising cost, time and arrival; stage 10 survives a setStage', () => {
  expect(KIOSK_STAGES.length).toBe(MAX_STAGE);
  for (let i = 2; i < MAX_STAGE; i++) { expect(KIOSK_STAGES[i].cost!).toBeGreaterThan(KIOSK_STAGES[i - 1].cost!); expect(KIOSK_STAGES[i].timeS).toBeGreaterThanOrEqual(KIOSK_STAGES[i - 1].timeS); }
  expect(KIOSK_STAGES[9].short).toBe('Fine dining');
  const sim = played(1) as any; sim.step(1);
  sim.command({ kind: 'setStage', stage: 10 }); sim.step(2);
  expect(sim.state.stage).toBe(10);
  expect(sim.rules.rt.layout.counter).toBeTruthy();          // kiosk layout stays the stage-5 one
  sim.command({ kind: 'setStage', stage: 5 }); sim.step(1);
  sim.state.stars = 5; sim.state.money = 20_000_000; sim.command({ kind: 'startTadilat' }); sim.step(1);
  expect((sim.state.tadilat as any)?.to).toBe(6);
  expect(sim.state.money).toBe(20_000_000 - KIOSK_STAGES[5].cost!);
});
