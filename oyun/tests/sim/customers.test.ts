// M1 customers: queue, counter purchase, patience, seating + tips, queue cap, dwell rule at the counter.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';

const stock = (sim: any, n = 8) => { for (const p of ['doner', 'cay']) while (sim.rules.rt.counter[p].length < n) sim.rules.rt.counter[p].push({ type: p, tier: 1 }); };

describe('customers', () => {
  it('the first customer (emekli amca) arrives at 3 s and is served from a stocked counter', () => {
    const sim = played(1);
    sim.step(2.5);
    expect(events(sim, 'firstCustomer').length).toBe(0);
    sim.step(1);
    expect(events(sim, 'firstCustomer').length).toBe(1);
    expect(sim.rules.rt.queue.length).toBe(1);
    const money0 = sim.state.totalEarned;
    for (let i = 0; i < 400; i++) { stock(sim); sim.step(0.1); }
    expect(sim.state.totalEarned).toBeGreaterThan(money0);
    expect(events(sim, 'sale').length).toBeGreaterThan(0);
    expect(events(sim, 'siftah').length).toBe(1);
  });
  it('patience runs out on an empty counter: the customer leaves angry and the queue moves on', () => {
    const sim = played(2);
    sim.rules.rt.layout; sim.step(200);
    expect(events(sim, 'angry').length).toBeGreaterThan(0);
    expect(sim.state.today!.angry).toBeGreaterThan(0);
  });
  it('the queue never holds more than 8 (even with tables and a ferry wave)', () => {
    const sim = played(3);
    sim.command({ kind: 'force', what: 'unlock', value: 'cay' });
    sim.command({ kind: 'force', what: 'unlock', value: 'ayran' });
    sim.command({ kind: 'force', what: 'unlock', value: 'tabure1' });
    sim.state.playT = 400;
    for (let i = 0; i < 2400; i++) {
      sim.step(0.1);
      const rt = sim.rules.rt;
      expect(rt.queue.length).toBeLessThanOrEqual(8);
    }
  });
  it('survey 2026-10-24: no tips; seated customers still finish their meal', () => {
    const sim = played(4);
    for (const k of ['cay', 'ayran', 'tabure1', 'tabure2']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.playT = 400;
    let tipped = false;
    for (let i = 0; i < 6000 && !tipped; i++) {
      stock(sim); for (const p of ['ayran']) while (sim.rules.rt.counter[p as 'ayran'].length < 8) sim.rules.rt.counter[p as 'ayran'].push({ type: p as 'ayran', tier: 1 });
      sim.step(0.1);
      if (events(sim, 'tip').length) tipped = true;
    }
    expect(tipped).toBe(false);
    expect(events(sim, 'mealDone').length).toBeGreaterThan(0);   // meals still finish and seat is freed
  });
  it('dwell rule: running past the counter with full hands drops nothing', () => {
    const sim = played(1);
    const r = sim.rules, L = r.rt.layout;
    r.rt.carry.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 });
    sim.command({ kind: 'teleport', x: L.counter.standAt.x - 3, z: L.counter.standAt.z });
    for (let i = 0; i < 15; i++) { sim.input({ x: 1, z: 0 }); sim.step(1 / 30); }
    expect(Math.abs(sim.walk.pos.x - L.counter.standAt.x)).toBeLessThan(1.0);   // inside the counter radius, moving fast
    expect(r.rt.counter.doner.length).toBe(0);
    expect(r.rt.carry.length).toBe(2);
    // the nearest dwell target after the fast pass is the doner station, so stand on the counter itself to test the drop
    sim.command({ kind: 'teleport', x: L.counter.standAt.x, z: L.counter.standAt.z });
    sim.input({ x: 0, z: 0 });
    sim.step(1.2);
    expect(r.rt.counter.doner.length).toBe(2);              // standing still drops after the dwell
  });
});
