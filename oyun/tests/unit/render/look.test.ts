import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { applyLookDefaults, LOOK_EXPOSURE } from '../../../src/engine/render/look';

describe('ortak renk çıkışı (PRF-04)', () => {
  it('ikincil tuval ana sahneyle aynı sRGB + ACES + pozlamayı alır', () => {
    const r = { outputColorSpace: T.LinearSRGBColorSpace, toneMapping: T.NoToneMapping, toneMappingExposure: 1 } as unknown as T.WebGLRenderer;
    applyLookDefaults(r);
    expect([r.outputColorSpace, r.toneMapping, r.toneMappingExposure]).toEqual([T.SRGBColorSpace, T.ACESFilmicToneMapping, LOOK_EXPOSURE]);
    applyLookDefaults(r, { exposure: 0.85 });
    expect(r.toneMappingExposure).toBe(0.85);
  });
});
