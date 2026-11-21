import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { vitrinLambalari, VITRIN_I } from '../../../src/game/view/world/night-lights-plan';
import { createNightLights } from '../../../src/game/view/world/night-lights';
import { IC_MEKANLAR, icIcinde } from '../../../src/content/ic-mekan';

describe('karşı yaka vitrin ışıkları (GRS-02)', () => {
  it('her karşı yaka binasının kapısı önünde bir sıcak ışık, binanın dışında ve sokak lambasından sönük', () => {
    const v = vitrinLambalari(IC_MEKANLAR);
    expect(v.length).toBeGreaterThanOrEqual(IC_MEKANLAR.filter(m => m.bina).length - 2);   // all but the morg and the acil annex
    for (const l of v) {
      expect(IC_MEKANLAR.some(m => icIcinde(m, l))).toBe(false);
      expect(l.i).toBe(VITRIN_I); expect(l.i).toBeLessThan(1); expect(l.y).toBeGreaterThan(2);
    }
  });
  it('gece karşı yakada havuz vitrin ışığını kullanır, ışık sayısı değişmez', () => {
    const scene = new T.Scene();
    const nl = createNightLights({ scene, zones: null, tier: { name: 'sahane' } });
    const pool = nl.stats().pool;
    const kafe = vitrinLambalari(IC_MEKANLAR)[0];
    for (let i = 0; i < 120; i++) nl.update({ x: kafe.x, z: kafe.z }, 23, 1 / 30);
    const lit = scene.children.filter(o => (o as T.PointLight).isPointLight && (o as T.PointLight).intensity > 0.5) as T.PointLight[];
    expect(lit.some(l => Math.abs(l.position.x - kafe.x) < 1e-6 && Math.abs(l.position.z - kafe.z) < 1e-6)).toBe(true);
    expect(nl.stats().pool).toBe(pool);
  });
});
