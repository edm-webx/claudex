// M1 offline: welcome-back card (kepenk earnings), collect / collect doubled, short absences are ignored.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';

describe('offline', () => {
  it('under two minutes away: no card', () => {
    const sim = played(1);
    sim.state.rate = 600;
    sim.rules.welcomeBack(60);
    expect(sim.rules.rt.paused).toBe(false);
    expect(sim.rules.rt.uiLast.welcomeBack).toBeUndefined();
  });
  it('survey 2026-10-24: a long absence pays nothing and does not pause the sim', () => {
    const sim = played(1);
    sim.state.rate = 600; sim.state.kepenk = 0;
    const money0 = sim.state.money;
    sim.rules.welcomeBack(3 * 3600);
    expect(sim.rules.rt.paused).toBe(false);
    expect(sim.rules.rt.uiLast.welcomeBack).toBeUndefined();
    expect(sim.state.money).toBe(money0);
  });
  it('a running tadilat timer is shortened by the time away', () => {
    const sim = played(1);
    sim.state.rate = 600;
    sim.state.tadilat = { part: 'stage2', endsAt: 0, to: 2, left: 5000, total: 5400 } as any;
    sim.rules.welcomeBack(1000);
    expect((sim.state.tadilat as any).left).toBe(4000);   // the clock still runs while away (not income)
  });
});
