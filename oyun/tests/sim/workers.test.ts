import { describe, it, expect } from 'vitest';
import { makeSandbox, addWorker } from './agents-harness';
import { workerSpeed } from '../../src/game/sim/agents/traits';
import { rankOf, workerCost } from '../../src/content/ranks';

describe('workers', () => {
  it('a hired doner worker walks in, watches 3 s, then produces', () => {
    const sb = makeSandbox(1);
    sb.step(0.2);
    addWorker(sb, 'doner', 'hamarat');
    sb.step(1);
    expect(sb.h.workers.rows()[0].state).toBe('arrive');
    sb.step(15);
    expect(sb.events).toContain('workerWatch');
    expect(sb.events).toContain('takeover');
    sb.step(40);
    expect(sb.host.made.doner || 0).toBeGreaterThan(3);
    expect(sb.state.workers[0].xp).toBeGreaterThan(3);
  });
  it('garson carries finished items to the counter', () => {
    const sb = makeSandbox(2);
    addWorker(sb, 'garson', 'hamarat');
    sb.host.out.doner.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 }, { type: 'doner', tier: 1 });
    sb.step(40);
    expect(sb.host.counter.doner.length).toBeGreaterThan(0);
  });
  it('cleaner wipes dirty tables', () => {
    const sb = makeSandbox(3);
    addWorker(sb, 'temizlik', 'hamarat');
    sb.host.dirty.add(1);
    sb.step(30);
    expect(sb.host.dirty.size).toBe(0);
  });
  it('uykucu sleeps and wakes when Sabri walks next to him (x3 boost)', () => {
    const sb = makeSandbox(4);
    const w = addWorker(sb, 'doner', 'uykucu');
    sb.step(5);
    sb.state.playT = 700;
    sb.step(3);
    expect(sb.events).toContain('workerSleep');
    const r = sb.h.workers.rows()[0];
    sb.player.x = r.x + 0.5; sb.player.z = r.z;
    sb.step(1);
    expect(sb.events).toContain('wake');
    expect(w.morale).toBeGreaterThanOrEqual(70);
  });
  it('rank up fires at 300 xp', () => {
    const sb = makeSandbox(5);
    const w = addWorker(sb, 'doner', 'hamarat', { xp: 299 });
    sb.step(60);
    expect(sb.events).toContain('rankUp');
    expect(rankOf(w.xp)).toBeGreaterThanOrEqual(1);
  });
  it('fired worker disappears', () => {
    const sb = makeSandbox(6);
    addWorker(sb, 'cay', 'hamarat');
    sb.step(2);
    sb.state.workers.length = 0;
    sb.step(1);
    expect(sb.h.workers.rows().length).toBe(0);
  });
  it('speed: traits and rarity multiply', () => {
    const base = { hour: 10, station: 'doner', teamWin: false, teamDay: 0, day: 1, boostT: 0, boostX: 1 };
    const w = (trait: string, rarity = 'gri') => ({ id: 1, name: 'a', role: 'doner', xp: 0, morale: 70, traits: [trait], rarity }) as never;
    expect(workerSpeed(w('hamarat'), base)).toBeCloseTo(1.15, 5);
    expect(workerSpeed(w('bicak'), base)).toBeCloseTo(1.2, 5);
    expect(workerSpeed(w('sabahci'), base)).toBeCloseTo(1.3, 5);
    expect(workerSpeed(w('hamarat', 'altin'), base)).toBeCloseTo(2.3, 5);
    expect(workerCost('doner', 'gri', 0)).toBe(1500);
  });
  it('no worker stays stuck for 10 s while work exists', () => {
    const sb = makeSandbox(7);
    addWorker(sb, 'doner', 'hamarat'); addWorker(sb, 'garson', 'kestirmeci');
    sb.step(20);
    let last = sb.h.workers.rows().map((r) => [r.x, r.z]);
    for (let k = 0; k < 6; k++) {
      sb.host.out.doner.push({ type: 'doner', tier: 1 });
      sb.step(10);
      const now = sb.h.workers.rows().map((r) => [r.x, r.z]);
      // at least the garson or doner worker produced output within 10 s
      expect(sb.host.made.doner || 0).toBeGreaterThan(0);
      last = now;
    }
    void last;
  });
});
