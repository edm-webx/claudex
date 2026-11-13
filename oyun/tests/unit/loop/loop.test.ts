import { describe, it, expect } from 'vitest';
import { createLoop } from '../../../src/engine/loop';
import { createSim } from '../../../src/game/headless';
import { createRngStreams } from '../../../src/engine/core';
import { emptyContent } from '../../../src/content/index';

/** Seeded input log: a new stick direction every 45 ticks (some idle). */
function inputLog(seed: number, ticks: number) {
  const r = createRngStreams(seed).stream('test-input');
  const out: { x: number; z: number }[] = [];
  let cur = { x: 0, z: 0 };
  for (let t = 0; t < ticks; t++) {
    if (t % 45 === 0) cur = r.chance(0.2) ? { x: 0, z: 0 } : { x: r.range(-1, 1), z: r.range(-1, 1) };
    out.push(cur);
  }
  return out;
}

function runAt(fps: number, seed = 7, seconds = 120) {
  const N = seconds * 30;
  const inputs = inputLog(seed, N + 10);
  const sim = createSim({ seed, content: emptyContent() }, { log: { info() {}, warn() {}, error() {} } });
  let hash = '';
  let renders = 0;
  const loop = createLoop({
    step: () => {
      if (sim.tick >= N) return;
      sim.input(inputs[sim.tick]);
      sim.tickOnce();
      if (sim.tick === N) hash = sim.hash();
    },
    render: () => { renders++; },
    targetFps: () => 60,
    raf: () => 0, cancelRaf: () => {},
  });
  const frameMs = 1000 / fps;
  for (let k = 0; !hash && k < fps * (seconds + 5); k++) loop.frame(k * frameMs);
  return { hash, renders, pos: { ...sim.walk.pos } };
}

describe('loop determinism', () => {
  it('same seed + input log -> identical hash at render rates 60, 30, 17 fps after 120 s', () => {
    const a = runAt(60), b = runAt(30), c = runAt(17);
    expect(a.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(b.hash).toBe(a.hash);
    expect(c.hash).toBe(a.hash);
    expect(a.renders).toBeGreaterThan(c.renders);
    // the player actually moved
    expect(Math.hypot(a.pos.x - 0.2, a.pos.z + 2.6)).toBeGreaterThan(0.5);
  });
  it('different seed -> different hash', () => {
    expect(runAt(60, 8, 10).hash).not.toBe(runAt(60, 7, 10).hash);
  });
});

describe('loop pacing', () => {
  const mk = (fps: 60 | 30) => {
    let steps = 0, renders = 0, lastAlpha = -1;
    const loop = createLoop({ step: () => { steps++; }, render: (_d, a) => { renders++; lastAlpha = a; }, targetFps: () => fps, raf: () => 0, cancelRaf: () => {} });
    return { loop, get steps() { return steps; }, get renders() { return renders; }, get alpha() { return lastAlpha; } };
  };
  it('30 fps mode renders every second frame, sim unaffected', () => {
    const a = mk(60), b = mk(30);
    for (let k = 0; k <= 120; k++) { a.loop.frame(k * 1000 / 60); b.loop.frame(k * 1000 / 60); }
    expect(a.steps).toBe(b.steps);
    expect(a.steps).toBeGreaterThanOrEqual(59);
    expect(b.renders).toBe(Math.floor(a.renders / 2));
    expect(a.alpha).toBeGreaterThanOrEqual(0); expect(a.alpha).toBeLessThanOrEqual(1);
  });
  it('caps steps per frame and drops excess; pause stops everything; advance runs whole ticks', () => {
    const a = mk(60);
    a.loop.frame(0); a.loop.frame(2000); // 2 s hitch, clamped 250 ms -> max 5 steps
    expect(a.steps).toBe(5);
    a.loop.pause('hidden');
    a.loop.frame(2100); a.loop.frame(5000);
    expect(a.steps).toBe(5); expect(a.loop.paused).toBe(true); expect(a.loop.pauseWhy).toBe('hidden');
    a.loop.resume(); a.loop.frame(5016);
    expect(a.steps).toBe(5); // no catch-up burst
    a.loop.advance(1); expect(a.steps).toBe(35);
    for (let i = 0; i < 10; i++) a.loop.advance(0.01);
    expect(a.steps).toBe(38);
  });
  it('a throwing step/render is reported and the loop keeps running', () => {
    const errs: string[] = [];
    let n = 0;
    const loop = createLoop({ step: () => { n++; throw new Error('x'); }, render: () => { throw new Error('y'); }, targetFps: () => 60, raf: () => 0, cancelRaf: () => {}, onError: w => errs.push(w) });
    loop.frame(0); loop.frame(100);
    expect(n).toBe(3); expect(errs).toContain('step'); expect(errs).toContain('render');
  });
});
