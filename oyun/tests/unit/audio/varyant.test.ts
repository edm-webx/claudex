import { describe, it, expect } from 'vitest';
import db from '../../../src/content/ses/ses-db.json';
import { varyasyon, renderTrack, taban, varyantNo, VARYANT_SAYISI } from '../../../src/engine/audio/msynth/music';
import type { MusicDb } from '../../../src/engine/audio/msynth/music';

const M = db.music as unknown as MusicDb;
const dist = (a: Float32Array, b: Float32Array) => { let d = 0; const n = Math.min(a.length, b.length, 24000 * 20); for (let i = 0; i < n; i++) d += Math.abs(a[i] - b[i]); return d / n; };

describe('müzik varyantları', () => {
  it('anahtar ayrıştırma', () => { expect(taban('gunduz~3')).toBe('gunduz'); expect(varyantNo('gunduz~3')).toBe(3); expect(varyantNo('gunduz')).toBe(0); });
  it('v0 özgün, aynı v her seferinde aynı tarif, farklı v farklı', () => {
    const T = M.tracks.gunduz;
    expect(varyasyon('gunduz', T, 0)).toBe(T);
    expect(varyasyon('gunduz', T, 4)).toEqual(varyasyon('gunduz', T, 4));
    const set = new Set<string>(); for (let v = 1; v < VARYANT_SAYISI; v++) set.add(JSON.stringify(varyasyon('gunduz', T, v)));
    expect(set.size).toBeGreaterThanOrEqual(VARYANT_SAYISI - 2);
  });
  it('varyant gerçekten farklı ses üretir, uzunluk bar sayısına uygun, sonlu', () => {
    const T = M.tracks.karsi_gece, a = renderTrack('karsi_gece', T), b = renderTrack('karsi_gece~2', varyasyon('karsi_gece', T, 2));
    expect(dist(a, b)).toBeGreaterThan(0.01);
    expect(b.length).toBeGreaterThan(24000 * 20);
    expect(b.every(Number.isFinite)).toBe(true);
  }, 60000);
  it('coklu yapılandırması geçerli', () => { const c = M.coklu!; expect(c.minSn).toBeLessThan(c.maxSn); expect(c.araMin).toBeLessThan(c.araMax); });
});
