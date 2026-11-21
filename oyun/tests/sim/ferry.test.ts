// M1 ferry rhythm and the Vapur Penceresi: horn -> dock (10 s) -> wave -> leave, window opens for 20 s, only the player serves it.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';
import { FERRY_T } from '../../src/game/sim/ferry';

describe('ferry', () => {
  it('first ferry at 120 s: horn at 110 s, dock at 120 s, leave 25 s later', () => {
    const sim = played(1);
    sim.step(109);
    expect(events(sim, 'ferryHorn').length).toBe(0);
    sim.step(2);
    expect(events(sim, 'ferryHorn').length).toBe(1);
    expect(sim.rules.rt.ferry.state).toBe('arriving');
    sim.step(FERRY_T.arriving);
    expect(events(sim, 'ferryDock').length).toBe(1);
    expect(sim.rules.rt.ferry.state).toBe('docked');
    sim.step(FERRY_T.docked + 0.5);
    expect(events(sim, 'ferryLeave').length).toBe(1);
    sim.step(FERRY_T.leaving + 1);
    expect(sim.rules.rt.ferry.state).toBe('away');
  });
  it('the dock brings a wave of buyers into the queue', () => {
    const sim = played(2);
    sim.state.tut.firstCustomer = 1;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(11);
    const q0 = sim.rules.rt.customers.length;
    sim.step(8);
    expect(sim.rules.rt.customers.length).toBeGreaterThan(q0);
  });
  it('without the window pad, nothing opens; with it, the window opens for 20 s and closes', () => {
    const sim = played(3);
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(25);
    expect(events(sim, 'windowOpen').length).toBe(0);
    sim.step(40);
    expect(sim.rules.rt.ferry.state).toBe('away');
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul', 'pencere']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(30);
    sim.step(0);
    expect(events(sim, 'windowOpen').length).toBe(1);
    sim.step(25);
    expect(events(sim, 'windowClose').length).toBe(1);
    expect(sim.rules.rt.window).toBeNull();
  });
  it('the player serves a window customer from his hands after the dwell', () => {
    const sim = played(4);
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul', 'pencere']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.tut.firstCustomer = 1;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(14);
    const r = sim.rules;
    expect(r.rt.window?.open).toBe(true);
    sim.step(6);
    expect(r.rt.winq.length).toBeGreaterThan(0);
    for (let i = 0; i < 4; i++) r.rt.carry.push({ type: 'cay', tier: 1 }, { type: 'simit', tier: 1 }, { type: 'ayran', tier: 1 });
    sim.command({ kind: 'teleport', x: r.rt.layout.window.standAt.x, z: r.rt.layout.window.standAt.z });
    const m0 = sim.state.money;
    sim.step(4);
    expect(events(sim, 'firstWindowSale').length).toBe(1);
    expect(sim.state.money).toBeGreaterThan(m0);
  });
});
