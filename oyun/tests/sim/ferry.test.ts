// 2026-11-25: vapur kavramı kalktı (sahibi: "hiçbir zaman olmasın"). Eski vapur ritmi yerine aynı aralıkla promenattan kalabalık dalgası gelir;
// vapur hiç yanaşmaz, düdük / duyuru / pencere yoktur.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';

describe('vapur yok, kalabalık dalgası', () => {
  it('ilk dalga 120. saniyede gelir; vapur hep uzakta, düdük ve yanaşma olayı yok', () => {
    const sim = played(1);
    sim.state.tut.firstCustomer = 1;
    sim.step(119);
    const q0 = sim.rules.rt.customers.length;
    sim.step(10);
    expect(sim.rules.rt.customers.length).toBeGreaterThan(q0);
    expect(sim.rules.rt.ferry.state).toBe('away');
    for (const e of ['ferryHorn', 'ferryDock', 'ferryLeave']) expect(events(sim, e).length).toBe(0);
  });
  it('eski kayıtta pencere alınmış olsa da pencere hiç açılmaz', () => {
    const sim = played(3);
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.owned.pencere = 1 as never;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(60);
    expect(events(sim, 'windowOpen').length).toBe(0);
    expect(!!sim.rules.rt.window?.open).toBe(false);
  });
});
