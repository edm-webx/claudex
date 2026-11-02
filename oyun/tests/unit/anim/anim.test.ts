import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { createAnim, createSpring, sampleTrack, GAITS, JOINTS } from '../../../src/engine/anim';
import { CLIPS } from '../../../src/content/clips';
import { FACES } from '../../../src/content/faces';
import { EXPR_ORDER } from '../../../src/game/sim/schema';
import type { AnimLayerInput } from '../../../src/engine/api';

const inp = (o: Partial<AnimLayerInput> = {}): AnimLayerInput => ({ speed: 0, carry: 0, act: 'idle', mood: 'ok', ...o }) as AnimLayerInput;

describe('spring', () => {
  it('settles on the target with a toy overshoot, stable at 30 fps', () => {
    const s = createSpring(260, 14);
    let max = 0;
    for (let i = 0; i < 90; i++) { s.step(1, 1 / 30); max = Math.max(max, s.value); }
    expect(max).toBeGreaterThan(1.0);       // overshoots a bit
    expect(max).toBeLessThan(1.4);
    expect(s.value).toBeCloseTo(1, 3);
    const stiff = createSpring(2000, 20);
    for (let i = 0; i < 60; i++) stiff.step(1, 0.1);
    expect(Number.isFinite(stiff.value)).toBe(true);
    expect(stiff.value).toBeCloseTo(1, 2);
  });
});

describe('clip sampling', () => {
  it('hits keys exactly and interpolates smoothly between them', () => {
    const keys: [number, number, number, number][] = [[0, 0, 0, 0], [0.5, 1, 2, -1], [1, 0, 0, 0]];
    const o = [0, 0, 0];
    expect(sampleTrack(keys, 0, o)).toEqual([0, 0, 0]);
    expect(sampleTrack(keys, 0.5, o)).toEqual([1, 2, -1]);
    expect(sampleTrack(keys, 5, o)).toEqual([0, 0, 0]);
    const a = sampleTrack(keys, 0.25, [0, 0, 0])[0], b = sampleTrack(keys, 0.26, [0, 0, 0])[0];
    expect(a).toBeGreaterThan(0.3); expect(a).toBeLessThan(1);
    expect(Math.abs(b - a)).toBeLessThan(0.05);
  });

  it('every authored clip is <= 2 s with sorted keys inside its length', () => {
    for (const c of Object.values(CLIPS)) {
      expect(c.len).toBeLessThanOrEqual(2);
      for (const keys of Object.values(c.tracks)) {
        for (let i = 1; i < keys.length; i++) expect(keys[i][0]).toBeGreaterThan(keys[i - 1][0]);
        expect(keys[keys.length - 1][0]).toBeLessThanOrEqual(c.len + 1e-6);
      }
    }
  });
});

describe('animator', () => {
  it('gaits table has all seven gaits', () => {
    expect(Object.keys(GAITS).sort()).toEqual(['brisk', 'kid', 'normal', 'run', 'shuffle', 'slow', 'waddle']);
  });

  it('is deterministic for a seed and does not allocate a new pose', () => {
    const run = (seed: number) => {
      const api = createAnim(); for (const c of Object.values(CLIPS)) api.defineClip(c);
      const a = api.createAnimator('normal', seed);
      const first = a.update(1 / 30, inp());
      const out: number[] = [];
      for (let i = 0; i < 600; i++) {
        const p = a.update(1 / 30, inp({ speed: i % 200 < 100 ? 1.2 : 0 }));
        expect(p).toBe(first);
        out.push(p.armL.x, p.legR.x, p.root.y, p.lean);
      }
      return out;
    };
    const a = run(3), b = run(3);
    expect(a).toEqual(b);
    expect(a.every(Number.isFinite)).toBe(true);
  });

  it('walking swings the legs, standing does not', () => {
    const a = createAnim().createAnimator('normal', 1);
    let maxW = 0, maxS = 0;
    for (let i = 0; i < 90; i++) maxW = Math.max(maxW, Math.abs(a.update(1 / 30, inp({ speed: 1.3 })).legL.x));
    for (let i = 0; i < 90; i++) a.update(1 / 30, inp());
    for (let i = 0; i < 30; i++) maxS = Math.max(maxS, Math.abs(a.update(1 / 30, inp()).legL.x));
    expect(maxW).toBeGreaterThan(0.2);
    expect(maxS).toBeLessThan(0.02);
  });

  it('carry brings both arms forward and leans back with a tall stack', () => {
    const a = createAnim().createAnimator('normal', 1);
    let p = a.update(1 / 30, inp());
    for (let i = 0; i < 60; i++) p = a.update(1 / 30, inp({ carry: 1 }));
    expect(p.armL.x).toBeLessThan(-0.8);
    expect(p.armR.x).toBeLessThan(-0.8);
    expect(p.lean).toBeLessThan(0);
  });

  it('a sudden stop springs a stumble that settles', () => {
    const a = createAnim().createAnimator('normal', 1);
    for (let i = 0; i < 60; i++) a.update(1 / 30, inp({ speed: 1.3 }));
    let peak = 0;
    const add = a.additive();
    for (let i = 0; i < 20; i++) { a.update(1 / 30, inp()); peak = Math.max(peak, Math.abs(add.spX)); }
    expect(peak).toBeGreaterThan(0.02);
    for (let i = 0; i < 60; i++) a.update(1 / 30, inp());
    expect(Math.abs(add.spX)).toBeLessThan(0.01);
  });

  it('plays clips additively with a fade and ends them', () => {
    const api = createAnim(); api.defineClip(CLIPS.clap);
    const a = api.createAnimator('normal', 1);
    a.play('clap');
    expect(a.playing()).toEqual(['clap']);
    a.update(0.05, inp());
    const w1 = Math.abs(a.additive().lsX);
    a.update(0.15, inp());
    expect(Math.abs(a.additive().lsX)).toBeGreaterThan(w1);
    for (let i = 0; i < 60; i++) a.update(1 / 30, inp());
    expect(a.playing()).toEqual([]);
    for (const j of JOINTS) if (j !== 'spX') expect(a.additive()[j]).toBe(0);
  });

  it('starts an idle clip after standing still for 4-8 s', () => {
    const api = createAnim(); for (const c of Object.values(CLIPS)) api.defineClip(c);
    const a = api.createAnimator('normal', 5);
    let saw = false;
    for (let i = 0; i < 30 * 9; i++) { a.update(1 / 30, inp()); if (a.playing().length) { saw = true; expect(i / 30).toBeGreaterThan(3.9); break; } }
    expect(saw).toBe(true);
  });
});

describe('squashPop', () => {
  it('squashes, pops and returns exactly to the original scale', () => {
    const api = createAnim();
    const o = new Object3D(); o.scale.set(2, 2, 2);
    api.squashPop(o);
    api.update(1 / 60);
    expect(o.scale.y).toBeLessThan(2);
    let maxY = 0;
    for (let i = 0; i < 120; i++) { api.update(1 / 60); maxY = Math.max(maxY, o.scale.y); }
    expect(maxY).toBeGreaterThan(2);
    expect(o.scale.x).toBe(2); expect(o.scale.y).toBe(2); expect(o.scale.z).toBe(2);
  });
});

describe('faces table', () => {
  it('covers the 12 sim expressions in order, with a crowd row each', () => {
    expect(FACES.map(f => f.id)).toEqual([...EXPR_ORDER]);
    for (const f of FACES) { expect(f.crowdRow).toBeGreaterThanOrEqual(0); expect(f.crowdRow).toBeLessThan(8); }
  });
});
