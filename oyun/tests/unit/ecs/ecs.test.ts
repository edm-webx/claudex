import { describe, it, expect } from 'vitest';
import { createWorld, createScheduler } from '../../../src/engine/ecs';
import { createBus, createRngStreams } from '../../../src/engine/core';
import type { SimCtx, System } from '../../../src/engine/api';

describe('world', () => {
  it('detects stale handles and drops components on destroy', () => {
    const w = createWorld();
    const pos = w.store<{ x: number }>('pos');
    const e = w.create(); pos.add(e, { x: 1 });
    expect(w.alive(e)).toBe(true);
    w.destroy(e);
    expect(w.alive(e)).toBe(false);
    expect(pos.has(e)).toBe(false);
    const e2 = w.create();
    expect(e2 & 0xfffff).toBe(e & 0xfffff);
    expect(e2).not.toBe(e);
    expect(w.alive(e)).toBe(false);
    expect(w.alive(e2)).toBe(true);
  });
  it('SoA alloc/free reuses lowest slots and zeroes fields', () => {
    const w = createWorld();
    const s = w.soa('agents', 4, { x: 'f32', f: 'u16' });
    const a = s.alloc(), b = s.alloc();
    s.f32('x')[b] = 5;
    s.free(a);
    expect(s.alloc()).toBe(0);
    s.free(b); expect(s.hi).toBe(1);
    expect(s.alloc()).toBe(1); expect(s.f32('x')[1]).toBe(0);
    s.alloc(); s.alloc(); expect(s.alloc()).toBe(-1);
    expect(() => s.u8('x')).toThrow();
    expect(w.soa('agents', 4)).toBe(s);
  });
});

describe('scheduler', () => {
  const mkCtx = (t: number): SimCtx => ({ tick: 0, dt: 1 / 30, t, world: createWorld(), rng: createRngStreams(1), bus: createBus(), state: {} as never, content: {} as never, clock: {} as never, input: { tick: 0, move: { x: 0, z: 0 } } });
  it('orders systems, disables a thrower for 1 s, 3 strikes = off', () => {
    const warns: string[] = [];
    const sch = createScheduler({ perf: { warn: (m: string) => warns.push(m) } as never, log: { info() {}, warn() {}, error() {} } });
    const seq: string[] = [];
    let calls = 0;
    const bad: System = { id: 'bad', order: 1, phase: 'sim', step() { calls++; throw new Error('boom'); } };
    sch.add({ id: 'b', order: 2, phase: 'sim', step: () => seq.push('b') });
    sch.add({ id: 'a', order: 0, phase: 'sim', step: () => seq.push('a') });
    sch.add({ id: 'v', order: 0, phase: 'view', step: () => seq.push('v') });
    sch.add(bad);
    sch.run('sim', mkCtx(0));
    expect(seq).toEqual(['a', 'b']);
    sch.run('sim', mkCtx(0.5)); expect(calls).toBe(1);
    sch.run('sim', mkCtx(1.0)); expect(calls).toBe(2);
    sch.run('sim', mkCtx(2.1)); expect(calls).toBe(3);
    sch.run('sim', mkCtx(9)); expect(calls).toBe(3);
    expect(sch.disabled()).toEqual(['bad']);
    expect(warns.length).toBe(1);
    sch.replace('bad', { ...bad, step() { calls += 10; } });
    sch.run('sim', mkCtx(10)); expect(calls).toBe(13);
  });
});
