import { describe, it, expect } from 'vitest';
import { createInteractions } from '../../../src/engine/input/interactions';

// A station tray that refills over time: standing still must pick each new unit without a new dwell or ring refill.
function setup() {
  const ev: string[] = [];
  const bus = { emit: (n: string) => { ev.push(n); } } as any;
  const ctx = { dt: 1 / 30, bus } as any;
  const reg = createInteractions();
  let tray = 2;
  reg.register({ id: 'station.doner', pos: { x: 0, z: 0 }, radius: 0.85, kind: 'station', dwell: 0.4, interval: 0.1,
    canAct: () => tray > 0, act: () => { tray--; return tray > 0 ? 'continue' : 'done'; } } as any);
  return { reg, ctx, ev, refill: () => { tray++; }, tray: () => tray };
}
const ticks = (n: number, f: () => void) => { for (let i = 0; i < n; i++) f(); };

describe('interactions primed resume', () => {
  it('standing still picks refilled units at once, no second dwellStart', () => {
    const s = setup();
    ticks(30, () => s.reg.update(1, { x: 0.1, z: 0 }, 0, s.ctx));
    expect(s.tray()).toBe(0);
    expect(s.ev.filter(e => e === 'dwellStart').length).toBe(1);
    s.refill();
    s.reg.update(1, { x: 0.1, z: 0 }, 0, s.ctx);
    expect(s.tray()).toBe(0);
    expect(s.ev.filter(e => e === 'dwellStart').length).toBe(1);
    expect(s.reg.status(1)?.progress ?? 0).toBe(0); // ring stays hidden on a primed resume
  });
  it('moving clears primed: next refill needs a full dwell again', () => {
    const s = setup();
    ticks(30, () => s.reg.update(1, { x: 0.1, z: 0 }, 0, s.ctx));
    s.reg.update(1, { x: 0.1, z: 0 }, 2, s.ctx); // moved
    s.refill();
    s.reg.update(1, { x: 0.1, z: 0 }, 0, s.ctx);
    expect(s.tray()).toBe(1);
    ticks(13, () => s.reg.update(1, { x: 0.1, z: 0 }, 0, s.ctx));
    expect(s.tray()).toBe(0);
  });
  it('walking past at speed never acts', () => {
    const s = setup();
    for (let x = -1; x <= 1; x += 0.1) s.reg.update(1, { x, z: 0 }, 3, s.ctx);
    expect(s.tray()).toBe(2);
  });
});
