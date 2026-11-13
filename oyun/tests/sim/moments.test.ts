// Canlı iskele anları director: chat pacing (one at a time, spaced), pair picking, events, radio, rituals, cancel.
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/engine/core';
import { createMomentDirector, createPairSource, pickPair, ritualFor } from '../../src/game/sim/moments';
import { CHATS, RADIO_LINES, EVENT_LINES, EVENT_KINDS, RITUALS, MOMENT_TIMING } from '../../src/content/moments';

const cands = () => {
  const s = createPairSource(8);
  const pts = [[0, 0, 1], [1.5, 0, 1], [20, 20, 1], [40, 0, 0]];
  pts.forEach(([x, z, still], i) => { s.slot[i] = 10 + i; s.x[i] = x; s.z[i] = z; s.still[i] = still; });
  s.count = pts.length;
  return s;
};
const live = { live: true, night: false };

describe('moments director', () => {
  it('content: 15+ chats of 2-4 lines, radio lines, event lines, no em-dash, never "zam"', () => {
    expect(CHATS.length).toBeGreaterThanOrEqual(15);
    for (const c of CHATS) { expect(c.lines.length).toBeGreaterThanOrEqual(2); expect(c.lines.length).toBeLessThanOrEqual(4); }
    const all = [...CHATS.flatMap(c => c.lines.map(l => l[1])), ...RADIO_LINES, ...EVENT_KINDS.flatMap(k => EVENT_LINES[k]), ...Object.values(RITUALS).flatMap(r => [r.title, r.body, r.radio])];
    for (const t of all) { expect(t).not.toMatch(/—/); expect(t.toLowerCase()).not.toMatch(/\bzam\b/); }
  });

  it('pickPair picks two still citizens within talking distance only', () => {
    const s = cands();
    const out = { a: -1, b: -1 };
    expect(pickPair(s, createRng(3), out)).toBe(true);
    expect([out.a, out.b].sort()).toEqual([10, 11]);
    s.still[0] = 0; s.still[1] = 0; s.still[2] = 1;
    expect(pickPair(s, createRng(3), out)).toBe(true);           // two walking side by side (1.5 m)
    expect([out.a, out.b].sort()).toEqual([10, 11]);
    s.x[1] = 3; s.z[1] = 0;                                        // 3 m apart and both walking: no chat
    expect(pickPair(s, createRng(3), out)).toBe(false);
  });

  it('runs one chat at a time, line by line, then waits 25-60 s before the next', () => {
    const d = createMomentDirector(createRng(7));
    const s = cands();
    let starts = 0, maxConcurrent = 0, lastEnd = -1, minGap = Infinity, t = 0, prev = false;
    for (let i = 0; i < 30 * 600; i++) {
      t += 1 / 30;
      const f = d.update(1 / 30, live, s);
      const on = !!f.chat;
      if (on && !prev) { starts++; if (lastEnd >= 0) minGap = Math.min(minGap, t - lastEnd); }
      if (!on && prev) lastEnd = t;
      if (on) { maxConcurrent = Math.max(maxConcurrent, 1); expect(f.chat!.line).toBeLessThan(f.chat!.def.lines.length); }
      prev = on;
    }
    expect(starts).toBeGreaterThanOrEqual(6);
    expect(maxConcurrent).toBe(1);
    expect(minGap).toBeGreaterThanOrEqual(MOMENT_TIMING.chatGap[0] - 0.1);
  });

  it('fires events every few minutes (blackout only at night, rainbow only by day) and radio about every 90 s', () => {
    const d = createMomentDirector(createRng(11));
    const s = cands();
    const day: string[] = [], night: string[] = [];
    let radios = 0;
    for (let i = 0; i < 30 * 1200; i++) {
      const env = { live: true, night: i > 30 * 600 };
      const f = d.update(1 / 30, env, s);
      if (f.event) (env.night ? night : day).push(f.event);
      if (f.radioChanged && f.radio) radios++;
    }
    expect(day.length + night.length).toBeGreaterThanOrEqual(5);
    expect(day).not.toContain('blackout');
    expect(night).not.toContain('rainbow');
    expect(radios).toBeGreaterThanOrEqual(10);
    expect(radios).toBeLessThanOrEqual(16);
  });

  it('cancels everything when the zone is not visible and holds timers', () => {
    const d = createMomentDirector(createRng(5));
    const s = cands();
    d.forceChat(); d.forceRadio();
    let f = d.update(0.1, live, s);
    expect(f.chat).not.toBeNull(); expect(f.radio).not.toBeNull();
    f = d.update(0.1, { live: false, night: false }, s);
    expect(f.chat).toBeNull(); expect(f.radio).toBeNull();
    for (let i = 0; i < 30 * 600; i++) { f = d.update(1 / 30, { live: false, night: false }, s); expect(f.event).toBeNull(); expect(f.chat).toBeNull(); }
    d.forceEvent('rainbow');
    expect(d.update(0.1, live, s).event).toBe('rainbow');
  });

  it('ritualFor maps the real hour: morning 06-11, night 22-05', () => {
    expect(ritualFor(6)).toBe('morning'); expect(ritualFor(10)).toBe('morning'); expect(ritualFor(11)).toBeNull();
    expect(ritualFor(15)).toBeNull(); expect(ritualFor(22)).toBe('night'); expect(ritualFor(2)).toBe('night'); expect(ritualFor(5)).toBeNull();
  });
});
