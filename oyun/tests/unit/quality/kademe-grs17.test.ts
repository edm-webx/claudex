import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { TIER_TABLE, TIER_FLAG_DOC, renderScale } from '../../../src/engine/quality';
import { reflectBudget } from '../../../src/engine/render/reflect';
import { groundRadius, nextShadowExt, SHADOW_STEPS } from '../../../src/engine/render/shadow-fit';
import { kaliteSatiri, KALITE_METIN } from '../../../src/content/kalite-metin';

describe('GRS-17 kademe tablosu', () => {
  it('her bayrağın bir tüketicisi yazılı; ölü alanlar (heroes, softShadows) yok', () => {
    for (const t of Object.values(TIER_TABLE)) {
      for (const f of Object.keys(t.flags)) expect(TIER_FLAG_DOC[f], `${t.name}.${f}`).toBeTruthy();
      expect('heroes' in t).toBe(false); expect('softShadows' in t.flags).toBe(false);
    }
    expect(TIER_TABLE.akici.flags).toEqual({});
    expect(TIER_TABLE.dengeli.flags.reflect && TIER_TABLE.dengeli.flags.bloom).toBe(true);
  });
  it('1080p (DPR 1) ekranda Dengeli ile Şahane farklı: 0.85 / 1.0 / 1.5; telefonda tavan korunur', () => {
    expect([renderScale(TIER_TABLE.akici, 1), renderScale(TIER_TABLE.dengeli, 1), renderScale(TIER_TABLE.sahane, 1)]).toEqual([0.85, 1, 1.5]);
    expect([renderScale(TIER_TABLE.akici, 3), renderScale(TIER_TABLE.dengeli, 3), renderScale(TIER_TABLE.sahane, 3)]).toEqual([0.85, 1.25, 2]);
    expect(Math.round(1280 * renderScale(TIER_TABLE.akici, 1))).toBe(1088);
    expect(1280 * renderScale(TIER_TABLE.sahane, 1)).toBe(1920);
  });
  it('yansıma bütçesi bayraklardan: akıcı yok, dengeli çeyrek/2 kare, şahane yarım/her kare', () => {
    expect(reflectBudget(TIER_TABLE.akici)).toBeNull();
    expect(reflectBudget(TIER_TABLE.dengeli)).toEqual({ scale: 0.25, every: 2 });
    expect(reflectBudget(TIER_TABLE.sahane)).toEqual({ scale: 0.5, every: 1 });
  });
  it('ayar satırı: seçili kademenin cümlesi, Otomatikte "Şu an"', () => {
    expect(kaliteSatiri('dengeli', 'Şahane')).toBe(KALITE_METIN.dengeli);
    expect(kaliteSatiri('auto', 'Dengeli')).toBe('Şu an: Dengeli');
  });
});

describe('GRS-06 gölge kutusu uyumu', () => {
  it('basamaklar {12,15,19,24}, histerezisli', () => {
    expect([...SHADOW_STEPS]).toEqual([12, 15, 19, 24]);
    expect(nextShadowExt(15, 14)).toBe(19);    // 15.4 > 15: büyür
    expect(nextShadowExt(19, 14)).toBe(19);    // aradaki bölgede kalır
    expect(nextShadowExt(24, 10)).toBe(12);    // 11 < 16.8: küçülür
    expect(nextShadowExt(15, 40)).toBe(24);
  });
  it('ufka bakan kamera en büyük yarıçapı, yukarıdan bakan kamera dar yarıçapı verir', () => {
    const cam = new T.PerspectiveCamera(40, 16 / 9, 0.5, 300);
    cam.position.set(0, 30, 0.01); cam.lookAt(0, 0, 0);
    const r = groundRadius(cam, { x: 0, z: 0 });
    expect(r).toBeGreaterThan(5); expect(r).toBeLessThan(25);
    cam.position.set(0, 3, 10); cam.lookAt(0, 3, 0);
    expect(groundRadius(cam, { x: 0, z: 0 })).toBe(40);
  });
});
