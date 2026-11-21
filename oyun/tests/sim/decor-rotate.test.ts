// Survey 2026-10-24: placed decor turns a quarter turn per press (0, 90, 180, 270 degrees), and it can be worn-free of clutter.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';

describe('dekor döndürme', () => {
  it('each press adds a quarter turn and four presses come back to the start', () => {
    const sim = played(1);
    sim.state.decorOwned.push('tema_kus_kafesi');
    sim.state.decorSlots.push({ slot: '0', item: 'tema_kus_kafesi' });
    const d = () => sim.state.decorSlots.find(x => x.slot === '0')!;
    expect(d().rotY || 0).toBe(0);
    sim.command({ kind: 'decorRotate', slot: 0 });
    expect(d().rotY).toBeCloseTo(Math.PI / 2, 6);
    for (let i = 0; i < 3; i++) sim.command({ kind: 'decorRotate', slot: 0 });
    expect(d().rotY! % (Math.PI * 2)).toBeCloseTo(0, 6);
  });
  it('rotating an empty slot does nothing', () => {
    const sim = played(1);
    sim.command({ kind: 'decorRotate', slot: 5 });
    expect(sim.state.decorSlots.find(x => x.slot === '5')).toBeUndefined();
  });
});
