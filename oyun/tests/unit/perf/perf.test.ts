import { describe, it, expect } from 'vitest';
import { createPerf } from '../../../src/engine/perf';

describe('perf recorder (PRF-01)', () => {
  it('records nothing until record(true)', () => {
    const p = createPerf({});
    p.frame(200); p.mark('x');
    const d = p.dump();
    expect(d.schema).toBe(1); expect(d.kayit).toBe(false); expect(d.kare.esik100).toBe(0);
  });
  it('counts hitches by threshold and keeps context + top timers', () => {
    const p = createPerf({});
    p.context(() => ({ x: 1, saat: 12 }));
    p.record(true);
    p.time('zones.build', () => { /* instant */ });
    for (let i = 0; i < 10; i++) p.frame(16);
    p.frame(40); p.frame(60); p.frame(120);
    const d = p.dump();
    expect(d.kayit).toBe(true);
    expect(d.kare.n).toBe(13);
    expect([d.kare.esik33, d.kare.esik50, d.kare.esik100]).toEqual([3, 2, 1]);
    expect(d.kare.max).toBe(120);
    expect(d.takilmalar).toHaveLength(3);
    expect(d.takilmalar[2].ctx).toEqual({ x: 1, saat: 12 });
    expect(d.takilmalar[2].t).toBeGreaterThan(0.1);
  });
  it('marks events, meta and gpu samples; auto-stops after 60 s', () => {
    const p = createPerf({});
    p.meta('gpu', 'test');
    p.record(true);
    p.mark('compile', '2 shader'); p.gpu(4); p.gpu(8);
    expect(p.recording).toBe(true);
    for (let i = 0; i < 4000; i++) p.frame(16);
    expect(p.recording).toBe(false);
    const d = p.dump();
    expect(d.olaylar[0]).toMatchObject({ tur: 'compile', detay: '2 shader' });
    expect(d.cihaz.gpu).toBe('test');
    expect(d.gpu).toMatchObject({ olculdu: true, ortMs: 6 });
    expect(d.kayitSn).toBeGreaterThanOrEqual(60); expect(d.kayitSn).toBeLessThan(61);
    p.mark('late'); expect(p.dump().olaylar.some(e => e.tur === 'late')).toBe(false);
    expect(JSON.parse(JSON.stringify(d)).schema).toBe(1);
  });
  it('record(true) again starts a fresh recording', () => {
    const p = createPerf({});
    p.record(true); p.frame(90); p.record(false);
    p.record(true);
    expect(p.dump().kare.n).toBe(0);
  });
});
