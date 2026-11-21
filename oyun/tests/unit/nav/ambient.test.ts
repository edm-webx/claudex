import { describe, it, expect } from 'vitest';
import { createAmbient } from '../../../src/game/sim/ambient';
import { createNav } from '../../../src/engine/nav';
import { createWorld } from '../../../src/engine/ecs';
import { createRngStreams } from '../../../src/engine/core';
import { AGENTS, AGENT_CAP, AGENT_SCHEMA, AGENT_FLAG, ACT_ORDER } from '../../../src/game/sim/schema';
import { CITIZENS } from '../../../src/content/citizens';
import type { AnchorDef, SimCtx, WalkGrid } from '../../../src/engine/api';

function grid(): WalkGrid {
  const w = 48, h = 40, cost = new Uint8Array(w * h).fill(1);
  for (let iz = 10; iz < 14; iz++) for (let ix = 20; ix < 28; ix++) cost[iz * w + ix] = 0;   // a kiosk block
  return { cell: 0.5, w, h, origin: { x: -12, z: -4 }, cost, zone: 'iskele' };
}

function run(seed: number, ticks: number, anchors: Record<string, AnchorDef> = {}) {
  const nav = createNav(); nav.addGrid(grid());
  const amb = createAmbient({ nav, anchors: () => anchors, count: 12 });
  const world = createWorld();
  const rng = createRngStreams(seed);
  const ctx = { tick: 0, dt: 1 / 30, t: 0, world, rng } as unknown as SimCtx;
  const s = world.soa(AGENTS, AGENT_CAP, AGENT_SCHEMA);
  for (let k = 0; k < ticks; k++) {
    ctx.tick = k; ctx.t = k / 30;
    // the sim copies cur -> prev at tick start (boot does this; mimic it)
    for (let i = 0; i < s.hi; i++) { s.f32('px')[i] = s.f32('x')[i]; s.f32('pz')[i] = s.f32('z')[i]; s.f32('prot')[i] = s.f32('rot')[i]; }
    amb.step(ctx);
  }
  return { amb, s, nav, ctx };
}

describe('ambient walkers', () => {
  it('fills its pool with visible ambient citizens on walkable ground (empty anchors)', () => {
    const { s, nav } = run(1, 30 * 20);
    expect(s.count).toBe(12);
    const flags = s.u16('flags');
    let moved = 0;
    for (let i = 0; i < s.hi; i++) {
      if (!s.alive(i)) continue;
      expect(flags[i] & AGENT_FLAG.visible).toBeTruthy();
      expect(flags[i] & AGENT_FLAG.ambient).toBeTruthy();
      expect(CITIZENS[s.u8('typeId')[i]].scenery).toBeFalsy();
      expect(nav.walkable({ x: s.f32('x')[i], z: s.f32('z')[i] })).toBe(true);
      if (s.u8('act')[i] === ACT_ORDER.indexOf('walk')) moved++;
      expect(Number.isFinite(s.f32('rot')[i])).toBe(true);
    }
    expect(moved).toBeGreaterThan(0);
  });

  it('is deterministic for a seed', () => {
    const a = run(7, 300).s, b = run(7, 300).s, c = run(8, 300).s;
    expect(Array.from(a.f32('x'))).toEqual(Array.from(b.f32('x')));
    expect(Array.from(a.u8('typeId'))).toEqual(Array.from(b.u8('typeId')));
    expect(Array.from(a.f32('x'))).not.toEqual(Array.from(c.f32('x')));
  });

  it('uses bench anchors to sit', () => {
    const anchors: Record<string, AnchorDef> = {};
    for (let k = 0; k < 6; k++) anchors['bench' + k] = { pos: { x: -8 + k * 3, z: 10 }, kind: 'bench', rotY: Math.PI };
    const { s, amb, ctx } = run(3, 30, anchors);
    let seen = 0;
    for (let k = 0; k < 30 * 90; k++) {
      amb.step(ctx);
      for (let i = 0; i < s.hi; i++) {
        if (!s.alive(i) || !(s.u16('flags')[i] & AGENT_FLAG.seated)) continue;
        seen++;
        expect(Math.abs(s.f32('z')[i] - 10)).toBeLessThan(0.6);
        expect(s.f32('rot')[i]).toBeCloseTo(Math.PI);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('passers leave through spawn edges and new ones come in', () => {
    const anchors: Record<string, AnchorDef> = { 'spawn.0': { pos: { x: -11, z: 8 }, kind: 'spawn' }, 'spawn.1': { pos: { x: 11, z: 8 }, kind: 'spawn' } };
    const { s, amb, ctx } = run(5, 30, anchors);
    let left = 0;
    for (let k = 0; k < 30 * 120; k++) { const before = s.count; amb.step(ctx); if (s.count < before) left++; }
    expect(left).toBeGreaterThan(0);
    for (let k = 0; k < 30 * 5; k++) amb.step(ctx);
    expect(s.count).toBe(12);
    for (let i = 0; i < s.hi; i++) if (!s.alive(i)) expect(s.u16('flags')[i]).toBe(0);
  });

  it('recruit hands out a slot and release takes it back', () => {
    const { amb, s, ctx } = run(2, 120);
    const before = (amb as unknown as { count: number }).count;
    const slot = amb.recruit((id) => id !== 'okul');
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(s.u16('flags')[slot] & AGENT_FLAG.ambient).toBe(0);
    expect(CITIZENS[s.u8('typeId')[slot]].id).not.toBe('okul');
    expect((amb as unknown as { count: number }).count).toBe(before - 1);
    expect(amb.recruit(() => false)).toBe(-1);
    // pool refills while the customer is out, so the release despawns it
    for (let k = 0; k < 60; k++) amb.step(ctx);
    amb.release(slot);
    expect(s.alive(slot)).toBe(false);
  });

  it('release back into a non-full pool resumes strolling', () => {
    const { amb, s, ctx } = run(4, 120);
    const slot = amb.recruit();
    amb.release(slot);
    expect(s.alive(slot)).toBe(true);
    expect(s.u16('flags')[slot] & AGENT_FLAG.ambient).toBeTruthy();
    for (let k = 0; k < 10; k++) amb.step(ctx);
  });
});
