import { describe, it, expect } from 'vitest';
import { makeSandbox } from './agents-harness';

describe('cats', () => {
  it('Pamuk wakes at 160 s, comes, and the pet needs standing still (dwell)', () => {
    const sb = makeSandbox(1);
    sb.step(1);
    expect(sb.h.cats.rows().map((c) => c.id)).toEqual(['pamuk']);
    sb.state.playT = 159;
    sb.moving.v = true;
    sb.step(25);
    expect(sb.events).toContain('catWake');
    expect(sb.events).toContain('catRub');
    // moving: no pet
    expect(sb.events).not.toContain('catPet');
    sb.moving.v = false;
    sb.step(4);
    expect(sb.events).toContain('catPet');
    expect((sb.state.cats as { id: string }[])[0].id).toBe('pamuk');
    expect(sb.state.tut.catPet).toBe(1);
  });
  it('more cats arrive with achievements', () => {
    const sb = makeSandbox(2, (s) => { for (let i = 0; i < 13; i++) s.ach['a' + i] = 1; });
    sb.step(2);
    expect(sb.h.cats.rows().length).toBe(2);
  });
});
describe('dog', () => {
  it('Karamel appears when state.dog is set and keeps position at the kasa', () => {
    const sb = makeSandbox(3, (s) => { s.dog = true; });
    sb.step(2);
    const a = sb.h.dog.actor()!;
    expect(a).toBeTruthy();
    expect(['sit', 'sleep', 'wag', 'bark']).toContain(a.act);
  });
  it('arrives the day after the first kapkaç', () => {
    const sb = makeSandbox(4, (s) => { s.day = 5; s.karamelDay = 5; });
    sb.step(1);
    expect(sb.events).toContain('dogArrive');
  });
});
describe('gulls', () => {
  it('stare then chase: leaves, customers laugh, +15', () => {
    const sb = makeSandbox(5);
    sb.player.x = -20; sb.player.z = 8;
    sb.step(1);
    sb.h.force('gull');
    sb.step(6);
    expect(sb.events).toContain('gullStare');
    const g = sb.h.gulls.stare()!;
    const m0 = sb.host.money;
    sb.player.x = g.x; sb.player.z = g.z; sb.step(0.5);
    expect(sb.events).toContain('gullChased');
    expect(sb.host.money).toBeGreaterThan(m0);
    expect(sb.h.gulls.stare()).toBeNull();
  });
  it('unchased gull snatches a simit as a free gag after 14 s the first time', () => {
    const sb = makeSandbox(6);
    sb.player.x = -20; sb.player.z = 8;
    sb.step(1); sb.h.force('gull'); sb.step(25);
    expect(sb.events).toContain('gullSnatch');
    expect(sb.host.money).toBe(5000);
  });
  it('is deterministic for a seed', () => {
    const run = () => { const sb = makeSandbox(9); sb.step(60); return sb.h.registry.list.map((a) => [a.key, a.x.toFixed(3), a.z.toFixed(3), a.act].join(':')).join('|'); };
    expect(run()).toBe(run());
  });
});
