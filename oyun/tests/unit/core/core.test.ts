import { describe, it, expect } from 'vitest';
import { createRngStreams, createRng, createBus, fnv1a, stableStringify, angLerp } from '../../../src/engine/core';

describe('rng', () => {
  it('is deterministic per seed and stream, independent of creation order', () => {
    const a = createRngStreams(42), b = createRngStreams(42);
    b.stream('gulls'); // created first in b only
    const xa = Array.from({ length: 5 }, () => a.stream('crowd').next());
    const xb = Array.from({ length: 5 }, () => b.stream('crowd').next());
    expect(xa).toEqual(xb);
    expect(createRngStreams(43).stream('crowd').next()).not.toBe(xa[0]);
  });
  it('save/restore state and helpers stay in range', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    const s = r.getState(); const n1 = r.next(); r.setState(s); expect(r.next()).toBe(n1);
    for (let i = 0; i < 200; i++) { const k = r.int(2, 4); expect(k >= 2 && k <= 4).toBe(true); }
    expect(['a', 'b']).toContain(r.weighted({ a: 1, b: 2 }));
  });
});

describe('bus', () => {
  it('emits, logs with absolute indices, survives trimming', () => {
    let tick = 0;
    const bus = createBus<{ a: { n: number } }>({ maxLog: 10, clock: () => ({ tick, t: tick / 30 }) });
    const got: number[] = [];
    const off = bus.on('a', d => got.push(d.n));
    for (let i = 0; i < 30; i++) { tick = i; bus.emit('a', { n: i }); }
    off(); bus.emit('a', { n: 99 });
    expect(got.length).toBe(30);
    expect(bus.count).toBe(31);
    const tail = bus.log(28);
    expect(tail.map(r => (r.data as { n: number }).n)).toEqual([28, 29, 99]);
  });
  it('a throwing subscriber does not break emit', () => {
    const bus = createBus<{ a: undefined }>();
    let ok = 0;
    bus.on('a', () => { throw new Error('x'); });
    bus.on('a', () => { ok++; });
    const orig = console.error; console.error = () => {};
    bus.emit('a', undefined);
    console.error = orig;
    expect(ok).toBe(1);
  });
});

describe('helpers', () => {
  it('fnv1a, stableStringify, angLerp', () => {
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(angLerp(3, -3, 0.5)).toBeCloseTo(Math.PI, 1);
  });
});
