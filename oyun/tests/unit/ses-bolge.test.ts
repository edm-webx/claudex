// DNY-17: konum -> ses bölgesi (karşı yaka noktaları, iç mekan, şerit bölgeleri)
import { describe, it, expect } from 'vitest';
import { sesBolgesi } from '../../src/content/ses/bolgeler';

describe('ses bölgesi', () => {
  it.each([
    [{ x: 0, z: 10 }, 'iskele'],
    [{ x: -3.9, z: 40 }, 'karsi.meydan'],
    [{ x: -39, z: 45 }, 'karsi.halisaha'],
    [{ x: 45, z: 31 }, 'karsi.okul'],
    [{ x: 34, z: 46 }, 'karsi'],
    [{ x: -17.5, z: 37.9 }, 'ic.kafe'],
    [{ x: -17.5, z: 51.5 }, 'ic.bistro'],
    [{ x: 57.3, z: 55.5 }, 'ic.morg'],
    [{ x: 11.7, z: 36.8 }, 'ic.banka'],
    [{ x: 840, z: 10 }, 'orman'],
    [{ x: 420, z: 10 }, 'stadyum'],
    [{ x: 100, z: 10 }, 'carsi'],
  ])('%o -> %s', (p, z) => { expect(sesBolgesi(p)).toBe(z); });
});
