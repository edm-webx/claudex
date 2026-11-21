// Faz 2 (şekil): a shape is a fourth paint part; the built decor scales with it.
import { describe, it, expect } from 'vitest';
import { paintKey, PAINT_SHAPES } from '../../src/content/dekor-katalog';
import { decorBuild } from '../../src/content/prefabs/iskele/props';

describe('decor shape', () => {
  it('the default shape keeps the old key; a chosen shape adds a fourth part', () => {
    expect(paintKey({ shape: 'orijinal' })).toBe('');
    expect(paintKey({ material: 'ahsap', shape: 'uzun' })).toBe('ahsap.yok.duz.uzun');
  });
  it('a tall shape is taller than the original, a wide one is wider', () => {
    const size = (paint?: string) => { const g = decorBuild('saksi_sardunya', paint).geo; g.computeBoundingBox(); const b = g.boundingBox!; return { h: b.max.y - b.min.y, w: b.max.x - b.min.x }; };
    const base = size(undefined), tall = size('dogal.yok.duz.uzun'), wide = size('dogal.yok.duz.genis');
    expect(PAINT_SHAPES.length).toBeGreaterThanOrEqual(3);
    expect(tall.h).toBeGreaterThan(base.h * 1.2);
    expect(wide.w).toBeGreaterThan(base.w * 1.2);
  });
});
