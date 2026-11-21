import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { readFileSync } from 'node:fs';
import { applyLookDefaults, applyLook, lookAt, LOOK_EXPOSURE, LOOK_POZ, LOOK_TONEMAP_GLSL, installLookToneMap } from '../../../src/engine/render/look';

const src = (p: string) => readFileSync(new URL('../../../' + p, import.meta.url), 'utf8');

describe('ortak renk çıkışı (PRF-04)', () => {
  it('ikincil tuval ana sahneyle aynı sRGB + ACES + pozlamayı alır', () => {
    const r = { outputColorSpace: T.LinearSRGBColorSpace, toneMapping: T.NoToneMapping, toneMappingExposure: 1 } as unknown as T.WebGLRenderer;
    applyLookDefaults(r);
    expect([r.outputColorSpace, r.toneMapping, r.toneMappingExposure]).toEqual([T.SRGBColorSpace, T.ACESFilmicToneMapping, LOOK_EXPOSURE]);
    applyLookDefaults(r, { exposure: 0.85 });
    expect(r.toneMappingExposure).toBe(0.85);
  });
});

describe('tek look tablosu (GRS-01)', () => {
  it('lookAt eski GRADE formülünü korur (altın saat sıcak, gece mavi)', () => {
    const g = lookAt(18.5, 0);
    expect(g.tint[0]).toBeCloseTo(1.05, 9); expect(g.tint[2]).toBeCloseTo(0.95, 9);
    expect(lookAt(22, 1).vig - lookAt(22, 0).vig).toBeCloseTo(0.12, 9);
    expect(lookAt(22, 1).bloom.threshold).toBeGreaterThanOrEqual(0.9);
  });

  it('lookAt sınırları: doygunluk ve kontrast ölçülü, bloom kısık', () => {
    for (let h = 11; h <= 27; h += 0.05) for (const n of [0, 0.5, 1]) {
      const L = lookAt(h, n);
      expect(L.sat).toBeGreaterThanOrEqual(1.0); expect(L.sat).toBeLessThanOrEqual(1.25);
      expect(L.con).toBeGreaterThanOrEqual(1.0); expect(L.con).toBeLessThanOrEqual(1.15);
      expect(L.vig).toBeGreaterThanOrEqual(0.25); expect(L.vig).toBeLessThanOrEqual(0.5);
      expect(L.bloom.strength).toBeLessThanOrEqual(0.35);
    }
  });

  it('pastelden çıkış: eski CSS payı + ek doygunluk, eski değerlerden düşük değil', () => {
    // old: GRADE sat 1.06 x CSS saturate 1.06, con 1.03 x CSS contrast 1.04
    expect(lookAt(12, 0).sat).toBeGreaterThan(1.06 * 1.06);
    expect(lookAt(12, 0).con).toBeGreaterThanOrEqual(1.03 * 1.04);
    // contrast pivot under mid grey: highlights are not lifted more than shadows are deepened
    expect(lookAt(12, 0).pivot).toBeLessThanOrEqual(0.5);
  });

  it('applyLook ACES + sRGB + pozlama (GL gerekmez)', () => {
    const r = applyLook({ toneMapping: 0, toneMappingExposure: 1, outputColorSpace: 'x' }, LOOK_POZ.ev);
    expect(r.toneMapping).toBe(T.ACESFilmicToneMapping); expect(r.outputColorSpace).toBe('srgb'); expect(r.toneMappingExposure).toBe(0.95);
  });

  it('akıcı tonlama: CustomToneMapping ACES + doygunluk/kontrast olur', () => {
    installLookToneMap();
    const ch = T.ShaderChunk.tonemapping_pars_fragment;
    expect(ch).toContain(LOOK_TONEMAP_GLSL);
    expect(ch).not.toContain('vec3 CustomToneMapping( vec3 color ) { return color; }');
    expect(LOOK_TONEMAP_GLSL).toContain('ACESFilmicToneMapping( color )');
  });

  it('bekçi: oyun içi renderer yalnızca createLookRenderer ile kurulur', () => {
    for (const f of ['src/engine/render/index.ts', 'src/game/view/ev/ev-room.ts', 'src/game/ui/kulis.ts', 'src/game/ui/hali-saha-3d.ts']) {
      const s = src(f);
      expect(s, f).not.toContain('new T.WebGLRenderer(');
      expect(s, f).toContain('createLookRenderer');
    }
  });

  it('bekçi: skin.ts CSS filtresi ve DOM vinyet yok', () => {
    const s = src('src/engine/ui/skin.ts');
    expect(s).not.toContain('canvas{filter');
    expect(s).not.toMatch(/createElement\('div'\).*sb-vig|id = 'sb-vig'/);
  });

  it('tabela ışığı tavanlı: gece emissive 0.60 üstüne çıkmaz', () => {
    const s = src('src/game/view/world/karsi-bina.ts');
    expect(s).toMatch(/emissiveIntensity = Math\.min\(0\.25 \+ nk \* 0\.4, 0\.6\)/);
  });
});
