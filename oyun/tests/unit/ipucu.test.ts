import { describe, it, expect } from 'vitest';
import { ipucuFor } from '../../src/game/tutorial';

describe('ipucuFor', () => {
  const none = () => false;
  it('bankanın içinde banka ipucu verir', () => { expect(ipucuFor({ x: 11.7, z: 36.8 }, none)?.id).toBe('bina_banka'); });
  it('açık havada ipucu yok', () => { expect(ipucuFor({ x: 0, z: 9 }, none)).toBeNull(); });
  it('bir kez görülen ipucu tekrar çıkmaz', () => { expect(ipucuFor({ x: 11.7, z: 36.8 }, id => id === 'bina_banka')).toBeNull(); });
  it('ormanda bölge ipucu', () => { expect(ipucuFor({ x: 830, z: 9 }, none)?.id).toBe('bolge_orman'); });
});
