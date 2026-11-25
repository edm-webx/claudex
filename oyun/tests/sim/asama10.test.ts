import { WIN_Z } from '../../src/content/prefabs/iskele/layout';
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
  const m = sim.state.money - (20_000_000 - KIOSK_STAGES[5].cost!); expect(m).toBeGreaterThanOrEqual(0); expect(m).toBeLessThan(5000);   // + a little real income (BUF-19/20: no passive salon income)
});
import { salonOf } from '../../src/game/sim/salon';
import { buyumeEngel } from '../../src/game/view/world/bufe-buyume';
it('pier wings: salon income and staff grow every stage from 3; growth stays on the pier and off the ferry corridor', () => {
  for (let s = 4; s <= 10; s++) { expect(salonOf(s).mis * salonOf(s).adisyon).toBeGreaterThan(salonOf(s - 1).mis * salonOf(s - 1).adisyon); expect(salonOf(s).ekip).toBeGreaterThan(salonOf(s - 1).ekip); }
  for (let s = 2; s <= 10; s++) for (const r of buyumeEngel(s)) {
    if (/^kosk|^fiskiye|^buyume-sov/.test(r.tag || '')) continue;   // 2026-11-25: deniz köşkü (arkada), fıskiyeler (promenad) ve hol ortasındaki şov ızgarası bilerek buranın dışında
    expect(r.x0).toBeGreaterThan(-24); expect(r.x1).toBeLessThan(22.7); expect(r.z0).toBeGreaterThan(-18); expect(r.z1).toBeLessThan(4.4);
    const ferry = r.x1 > 8.6 && r.z1 > -9.2 && r.z0 < -4.8; expect(ferry).toBe(false);
    if (r.tag === 'buyume-bufemutfak') expect(r.z1).toBeLessThanOrEqual(-12.9);   // 2026-11-09 büfe mutfağı sits behind the covered walkway
    else if (r.tag === 'buyume-bufe-ic') { expect(r.x0).toBeGreaterThan(3.4); expect(r.x1).toBeLessThan(4.2); expect(r.z1).toBeLessThan(WIN_Z - 0.7); }   // 2026-11-21 büfe vitrini on the east wall, clear of the window post
    else if (r.tag === 'buyume-duvar' || r.tag === 'buyume-salon') { const avlu = r.x1 > -9.6 && r.x0 < 7.8 && r.z1 > -12.9; expect(avlu).toBe(false); }   // 2026-11-25 ters U: avlu boş kalır
    else if (r.tag === 'buyume-servis') { expect(r.z1).toBeLessThanOrEqual(-15.4); expect(Math.abs(r.x0) > 6.8 && Math.abs(r.x1) > 6.8).toBe(true); }   // 2026-11-21 kitchen-salon service corridors: behind, on the kitchen's sides
    else if (r.tag === 'buyume-gecit') throw new Error('büfe-mutfak geçidi geri geldi');
    else { const inner = r.x1 > -10.3 && r.x0 < 8.3; expect(inner).toBe(false); }   // the kiosk area and walkways stay free
  }
  expect(buyumeEngel(10).length).toBeGreaterThan(buyumeEngel(5).length);
});
