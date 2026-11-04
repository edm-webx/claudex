// Esnaf Yatırımları: the long money ladder. Level n needs kiosk stage n; effects feed arrivals, patience, costs and tips.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { yatirimLv, yatirimFx } from '../../src/game/sim/yatirim';

describe('esnaf yatırımları', () => {
  it('para gider, seviye çıkar, kademe kapısı çalışır', () => {
    const sim: any = played(4);
    sim.command({ kind: 'force', what: 'money', value: 1_000_000 });
    sim.command({ kind: 'invest', id: 'reklam' });
    expect(yatirimLv(sim.state, 'reklam')).toBe(1);
    expect(sim.state.money).toBeLessThan(1_000_000);
    sim.command({ kind: 'invest', id: 'reklam' });                    // level 2 needs stage 2
    expect(yatirimLv(sim.state, 'reklam')).toBe(1);
    sim.command({ kind: 'force', what: 'stage', value: 2 });
    sim.command({ kind: 'invest', id: 'reklam' });
    expect(yatirimLv(sim.state, 'reklam')).toBe(2);
    expect(yatirimFx(sim.state, 'reklam')).toBeCloseTo(0.12, 5);
  });
  it('parası yetmezse almaz, bilinmeyen id zararsız', () => {
    const sim: any = played(4);
    sim.command({ kind: 'force', what: 'money', value: 10 });
    sim.command({ kind: 'invest', id: 'konfor' });
    sim.command({ kind: 'invest', id: 'yok' });
    expect(yatirimLv(sim.state, 'konfor')).toBe(0);
    expect(sim.state.money).toBe(10);
  });
});
