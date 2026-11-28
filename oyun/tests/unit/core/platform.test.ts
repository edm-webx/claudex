import { describe, it, expect } from 'vitest';
import { parseParams, createPlatform } from '../../../src/engine/platform';
import { createHooks } from '../../../src/engine/debug';
import { createPerf } from '../../../src/engine/perf';

describe('platform', () => {
  it('parses the URL contract', () => {
    const p = parseParams('?parity=1&time=19&stage=2&seed=5&noloop&tier=akici&edit=1&fresh=1&save=x&zone=test-sokak');
    expect(p).toMatchObject({ parity: true, time: 19, stage: 2, seed: 5, noloop: true, noart: false, tier: 'akici', edit: true, fresh: true, save: 'x', zone: 'test-sokak' });
    expect(parseParams('', '#noart').noart).toBe(true);
    expect(parseParams('?tier=ultra').tier).toBeUndefined();
  });
  it('never throws in Node without browser APIs', async () => {
    const p = createPlatform({ search: '', localStorage: null, indexedDB: null });
    expect(p.storage.available).toBe(false);
    expect(p.storage.set('a', 'b')).toBe(false);
    expect(await p.idb.available()).toBe(false);
    expect(await p.idb.get('a')).toBeUndefined();
    expect(p.audioCtx()).toBeNull();
    p.vibrate(10);
    const seen: string[] = [];
    p.visibility.onChange((h, why) => seen.push(`${h}:${why}`));
    p.visibility.simulate(true);
    expect(seen).toEqual(['true:test']); expect(p.visibility.hidden).toBe(true);
    expect(await p.copyText('x')).toBe(false);
  });
});

describe('hooks + perf', () => {
  it('register nests dotted names; ready reflects setReady', () => {
    const t: Record<string, any> = {};
    const h = createHooks({ target: t });
    h.register('editor.select', () => 1);
    expect(t.editor.select()).toBe(1);
    expect(t.ready()).toBe(false); h.setReady(true); expect(t.ready()).toBe(true);
  });
  it('perf timers, frames, sources, report', () => {
    let now = 0;
    const p = createPerf({ platform: { clock: { now: () => now, wall: () => 0 } } as never });
    p.time('crowd', () => { now += 5; });
    p.begin('zones.build'); now += 2; expect(p.end('zones.build')).toBe(2);
    for (let i = 0; i < 60; i++) p.frame(16);
    p.source('render', () => ({ calls: 42, tier: 'akici' }));
    p.warn('x'); p.warn('x');
    const s = p.snapshot();
    expect(s.fps).toBeCloseTo(62.5, 0); expect(s.calls).toBe(42); expect(s.buildMs).toBe(2);
    expect(s.slowest[0]).toMatchObject({ id: 'crowd', hint: 'Kalabalık çizimi yavaşlatıyor' });
    expect(s.warnings).toEqual(['x']);
    expect(p.report()).toContain('Hız ölçer');
  });
});
