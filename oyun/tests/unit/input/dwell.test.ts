import { describe, it, expect } from 'vitest';
import { createSim } from '../../../src/game/headless';
import { emptyContent } from '../../../src/content/index';
import { DWELL_DEFAULTS, type Interactable } from '../../../src/engine/api';

const quiet = { info() {}, warn() {}, error() {} };
// a full-stick run is well past the dwell speed (walk.ts: 4.6 m/s at full stick)
const STICK_4MS = 1;

function setup() {
  const sim = createSim({ seed: 1, content: emptyContent() }, { log: quiet, ambient: null, nav: null, startPos: { x: 0, z: 0 } });
  const taken: number[] = []; // tick of each transfer
  const station: Interactable = {
    id: 'stub', pos: { x: 5, z: 0 }, radius: 0.9, kind: 'station', dwell: DWELL_DEFAULTS.station,
    canAct: () => true,
    act: () => { taken.push(sim.tick); return taken.length >= 20 ? 'done' : 'continue'; },
  };
  sim.interactions.register(station);
  const t = () => sim.tick / 30;
  /** walk with the stick until x >= target */
  const walkTo = (x: number, stick = 1) => { sim.input({ x: Math.sign(x - sim.walk.pos.x) * stick, z: 0 }); while (Math.abs(sim.walk.pos.x - x) > 0.1) sim.step(1 / 30); };
  return { sim, taken, t, walkTo };
}

describe('dwell rule', () => {
  it('passing a station at 4 m/s takes nothing', () => {
    const { sim, taken, walkTo } = setup();
    sim.input({ x: STICK_4MS, z: 0 });
    for (let i = 0; i < 60; i++) sim.step(1 / 30);   // speed eases up to the target over ~2 s
    expect(sim.walk.speed).toBeGreaterThan(3.5);
    walkTo(10, STICK_4MS);
    expect(taken.length).toBe(0);
    expect(sim.events().some(e => e.name === 'transfer')).toBe(false);
  });

  it('stopping 0.5 s takes the first item by 0.6 s', () => {
    const { sim, taken, t, walkTo } = setup();
    walkTo(5, 0.5);
    sim.input({ x: 0, z: 0 });
    const stopAt = t();
    sim.step(0.5);
    expect(taken.length).toBeGreaterThanOrEqual(1);
    expect(taken[0] / 30 - stopAt).toBeLessThanOrEqual(0.6);
    expect(taken[0] / 30 - stopAt).toBeGreaterThanOrEqual(0.39);
    expect(sim.interactions.status(sim.player)?.transferring).toBe(true);
    // v2 cadence after the first item: one per 0.18 s
    sim.step(1);
    const gaps = taken.slice(1).map((x, i) => (x - taken[i]) / 30);
    for (const g of gaps) expect(g).toBeCloseTo(0.2, 1); // 0.18 s rounded up to whole 30 Hz ticks
  });

  it('stopping 0.3 s and leaving takes nothing', () => {
    const { sim, taken, walkTo } = setup();
    walkTo(5, 0.5);
    sim.input({ x: 0, z: 0 });
    sim.step(0.3);
    expect(sim.interactions.status(sim.player)?.progress).toBeGreaterThan(0.5);
    walkTo(9);
    expect(taken.length).toBe(0);
    expect(sim.events().some(e => e.name === 'dwellCancel')).toBe(true);
  });

  it('moving away mid-transfer stops transfers within one tick', () => {
    const { sim, taken, walkTo } = setup();
    walkTo(5, 0.5);
    sim.input({ x: 0, z: 0 });
    sim.step(0.8);
    const n = taken.length;
    expect(n).toBeGreaterThanOrEqual(2);
    sim.input({ x: 1, z: 0 });
    sim.step(1 / 30); // first moving tick: speed > 0.6 -> reset in this tick
    expect(taken.length).toBe(n);
    sim.step(1);
    expect(taken.length).toBe(n);
    expect(sim.interactions.status(sim.player)).toBeNull();
  });

  it('takeLimit, done, dwell 0 acts on contact, nearest only', () => {
    const { sim, taken } = setup();
    let pad = 0;
    sim.interactions.register({ id: 'pad', pos: { x: 0, z: 0.3 }, radius: 1, kind: 'pad', dwell: 0, takeLimit: 2, canAct: () => true, act: () => { pad++; return 'continue'; } });
    sim.interactions.register({ id: 'far', pos: { x: 0, z: 0.8 }, radius: 1, kind: 'pad', dwell: 0, canAct: () => true, act: () => { throw new Error('not nearest'); } });
    sim.step(1 / 30);
    expect(pad).toBe(1);
    sim.step(2);
    expect(pad).toBe(2);
    expect(taken.length).toBe(0);
  });
});
