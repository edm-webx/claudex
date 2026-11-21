// Survey 2026-10-24: kıyafet dolabı. Buy with Altın Simit, wear one item per slot, take it off again.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { kiyafetSave } from '../../src/game/sim/kiyafet';

describe('kıyafet dolabı', () => {
  it('buying needs Altın Simit, then the item is owned and can be worn', () => {
    const sim = played(1);
    sim.state.gold = 0;
    sim.command({ kind: 'kiyafet', op: 'buy', id: 'lc_gomlek_mavi' });
    expect(kiyafetSave(sim.state).owned).not.toContain('lc_gomlek_mavi');
    sim.state.gold = 50;
    sim.command({ kind: 'kiyafet', op: 'buy', id: 'lc_gomlek_mavi' });
    expect(kiyafetSave(sim.state).owned).toContain('lc_gomlek_mavi');
    expect(sim.state.gold).toBe(50 - 6);
    sim.command({ kind: 'kiyafet', op: 'wear', id: 'lc_gomlek_mavi' });
    expect(kiyafetSave(sim.state).worn.ust).toBe('lc_gomlek_mavi');
    sim.command({ kind: 'kiyafet', op: 'take', id: 'lc_gomlek_mavi' });
    expect(kiyafetSave(sim.state).worn.ust).toBeUndefined();
  });
  it('wearing an item you do not own does nothing', () => {
    const sim = played(1);
    sim.command({ kind: 'kiyafet', op: 'wear', id: 'zr_ceket' });
    expect(kiyafetSave(sim.state).worn.ust).toBeUndefined();
  });
});
