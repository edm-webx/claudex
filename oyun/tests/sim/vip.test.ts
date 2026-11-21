import { describe, it, expect } from 'vitest';
import { makeSandbox } from './agents-harness';

function near(sb: ReturnType<typeof makeSandbox>, x: number, z: number) { sb.player.x = x; sb.player.z = z; }

describe('vip', () => {
  it('Gurme passes with K2 items (x5)', () => {
    const sb = makeSandbox(3, (s) => { s.day = 6; });
    sb.host.hour_ = 14; sb.h.force('vip');
    sb.step(15);
    const v = sb.h.vip.current()!;
    expect(v.state).toBe('wait');
    sb.host.hand.push({ type: 'doner', tier: 2 }, { type: 'ayran', tier: 3 });
    near(sb, v.pos.x + 0.5, v.pos.z);
    sb.step(12);
    expect(sb.events).toContain('vipArrive');
    expect(sb.events).toContain('gurmePass');
    expect(sb.state.gurmePass).toBe(true);
  });
  it('K1 items give only a partial sale', () => {
    const sb = makeSandbox(4, (s) => { s.day = 6; });
    sb.host.hour_ = 14; sb.h.force('vip'); sb.step(15);
    const v = sb.h.vip.current()!;
    sb.host.hand.push({ type: 'doner', tier: 1 }, { type: 'ayran', tier: 1 });
    near(sb, v.pos.x + 0.5, v.pos.z); sb.step(12);
    expect(sb.events).toContain('gurmePartial');
    expect(sb.state.gurmePass).toBe(false);
  });
});
describe('kaldırılan müdavim ve kapkaççı', () => {
  it('ajan katmanında müdavim ve kapkaççı sistemi yok, 3 oyun günü olaysız geçer', () => {
    const sb = makeSandbox(8, (s) => { s.day = 4; });
    sb.host.hour_ = 14;
    expect('regulars' in sb.h).toBe(false);
    expect('kapkac' in sb.h).toBe(false);
    sb.h.force('kapkac'); sb.h.force('regular');
    sb.step(120);
    for (const n of ['kapkacArrive', 'kapkacGrab', 'regularArrive']) expect(sb.events).not.toContain(n);
  });
});
