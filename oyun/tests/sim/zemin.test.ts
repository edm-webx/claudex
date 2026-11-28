// Survey 2026-10-24: büfe zemini. Dirt rises with customers and is wiped by the player; pattern can change.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { zeminSave } from '../../src/game/sim/zemin';

describe('büfe zemini', () => {
  it('dirt grows over time and a wipe resets it to zero', () => {
    const sim = played(1);
    sim.step(60);
    expect(zeminSave(sim.state).kir).toBeGreaterThan(0);
    sim.command({ kind: 'zemin', op: 'temizle' });
    expect(zeminSave(sim.state).kir).toBe(0);
  });
  it('wiping a clean floor does nothing', () => {
    const sim = played(1);
    zeminSave(sim.state).kir = 0;
    sim.command({ kind: 'zemin', op: 'temizle' });
    expect(zeminSave(sim.state).kir).toBe(0);
  });
  it('pattern changes to a known pattern only', () => {
    const sim = played(1);
    sim.command({ kind: 'zemin', op: 'desen', value: 'fayans' });
    expect(zeminSave(sim.state).desen).toBe('fayans');
    sim.command({ kind: 'zemin', op: 'desen', value: 'uzay' });
    expect(zeminSave(sim.state).desen).toBe('fayans');
  });
});
