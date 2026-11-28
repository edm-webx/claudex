import { describe, it, expect } from 'vitest';
import { Scene, Vector3, Object3D } from 'three';
import { createFx } from '../../../src/engine/fx';
import { EFFECTS } from '../../../src/content/effects';
import { TIER_TABLE } from '../../../src/engine/quality';
import type { Quality, TierDef, TierName } from '../../../src/engine/api';

function mk(tier: TierName = 'dengeli') {
  let cur: TierDef = TIER_TABLE[tier];
  const quality = { current: () => cur, onChange: () => () => {} } as unknown as Quality;
  const counts: Record<string, number> = {};
  const perf = { count: (k: string, v: number) => { counts[k] = v; } } as never;
  const fx = createFx({ scene: new Scene(), quality, perf });
  for (const d of Object.values(EFFECTS)) fx.define(d);
  return { fx, counts, set(t: TierName) { cur = TIER_TABLE[t]; fx.setTier(cur); } };
}
const at = new Vector3(0, 1, 0);

describe('fx', () => {
  it('defines every content effect', () => {
    const { fx } = mk();
    for (const id of Object.keys(EFFECTS)) expect(fx.has(id)).toBe(true);
    expect(fx.has('nope')).toBe(false);
    const dead = fx.play('nope', at);
    expect(dead.alive).toBe(false);
  });

  it('caps live particles per tier', () => {
    for (const t of ['akici', 'dengeli', 'sahane'] as TierName[]) {
      const { fx } = mk(t);
      expect(fx.capacity()).toBe(Math.min(1000, TIER_TABLE[t].particles));
      for (let i = 0; i < 200; i++) fx.play('confetti', at);
      fx.update(1 / 60);
      expect(fx.live()).toBe(fx.capacity());
      expect(fx.live()).toBeLessThanOrEqual(1000);
    }
  });

  it('burst counts follow tierScale', () => {
    const counts: number[] = [];
    for (const t of ['akici', 'dengeli', 'sahane'] as TierName[]) {
      const { fx } = mk(t);
      fx.play('sesame', at); fx.update(0);
      counts.push(fx.live());
    }
    const base = (EFFECTS.sesame.emitters[0].count ?? 0);
    const ts = EFFECTS.sesame.tierScale!;
    expect(counts).toEqual(ts.map(s => Math.max(1, Math.round(base * s))));
  });

  it('streams run until stopped, then drain to zero', () => {
    const { fx, counts } = mk();
    const h = fx.play('steam', at);
    for (let i = 0; i < 60; i++) fx.update(1 / 30);
    expect(h.alive).toBe(true);
    expect(fx.live()).toBeGreaterThan(5);
    h.stop();
    for (let i = 0; i < 4; i++) fx.update(1 / 30);
    expect(h.alive).toBe(false);
    for (let i = 0; i < 90; i++) fx.update(1 / 30);
    expect(fx.live()).toBe(0);
    expect(counts['fx.live']).toBe(0);
  });

  it('a duration stream ends on its own; children fire after their delay', () => {
    const { fx } = mk();
    const h = fx.play('tostSteam', at);
    for (let i = 0; i < 40; i++) fx.update(1 / 30);
    expect(h.alive).toBe(false);
    const c = fx.play('confetti', at);
    fx.update(1 / 60);
    const n0 = fx.live();
    for (let i = 0; i < 30; i++) fx.update(1 / 60);
    expect(c.alive).toBe(false);
    expect(fx.live()).toBeGreaterThan(0);
    expect(n0).toBeGreaterThan(0);
  });

  it('does not grow: hundreds of plays settle back to zero with the same capacity', () => {
    const { fx } = mk('sahane');
    const ids = Object.keys(EFFECTS);
    for (let k = 0; k < 600; k++) {
      const h = fx.play(ids[k % ids.length], new Vector3((k % 7) - 3, 0.5, 0));
      if (k % 3 === 0) h.stop();
      fx.update(1 / 30);
      expect(fx.live()).toBeLessThanOrEqual(fx.capacity());
    }
    fx.clear();
    expect(fx.live()).toBe(0);
    for (let k = 0; k < 10; k++) { fx.play('dust', at); fx.update(1 / 30); }
    for (let i = 0; i < 120; i++) fx.update(1 / 30);
    expect(fx.live()).toBe(0);
  });

  it('tier change shrinks the live pool at once', () => {
    const m = mk('sahane');
    for (let i = 0; i < 100; i++) m.fx.play('confetti', at);
    m.fx.update(1 / 60);
    expect(m.fx.live()).toBe(TIER_TABLE.sahane.particles);
    m.set('akici');
    expect(m.fx.live()).toBeLessThanOrEqual(TIER_TABLE.akici.particles);
  });

  it('follows an Object3D and moves with moveTo', () => {
    const { fx } = mk();
    const o = new Object3D(); o.position.set(5, 0, 5); o.updateMatrixWorld();
    const h = fx.play('steam', o);
    for (let i = 0; i < 10; i++) fx.update(1 / 30);
    expect(fx.live()).toBeGreaterThan(0);
    h.moveTo({ x: -5, y: 0, z: -5 });
    fx.update(1 / 30);
    h.stop();
  });
});
