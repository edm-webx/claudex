import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { createFx, FX_SPRITES, FX_ATLAS_COLS } from '../../../src/engine/fx';
import { EFFECTS } from '../../../src/content/effects';
import { TIER_TABLE } from '../../../src/engine/quality';
import type { Quality, TierDef, TierName, EffectDef } from '../../../src/engine/api';
import { createFxNoktalar, saatIcinde, menzildeMi, FX_NOKTALARI } from '../../../src/game/view/world/fx-noktalar';

const NEW = ['mutfakBuhar', 'izgaraDuman', 'kivilcim', 'ocakAlev', 'fritozKabarcik', 'semaverBuhar', 'bacaDumani', 'fiskiye', 'fiskiyeSis', 'tozZerresi', 'atesBocegi', 'polen', 'yagmurSicrama', 'insaatTozu'];
function mk(tier: TierName) {
  const cur: TierDef = TIER_TABLE[tier];
  const quality = { current: () => cur, onChange: () => () => {} } as unknown as Quality;
  const fx = createFx({ scene: new Scene(), quality });
  for (const d of Object.values(EFFECTS)) fx.define(d);
  return fx;
}

describe('GRS-07 efekt tablosu', () => {
  it('yeni efektlerin hepsi tanımlı ve her sprite kimliği atlasta var', () => {
    for (const id of NEW) expect(EFFECTS[id], id).toBeTruthy();
    const max = Math.max(...Object.values(FX_SPRITES));
    expect(max).toBeLessThan(FX_ATLAS_COLS * FX_ATLAS_COLS);
    const used = new Set<number>(Object.values(FX_SPRITES));
    for (const d of Object.values(EFFECTS) as EffectDef[]) for (const m of d.modules) if (m.kind === 'sprite') for (const f of m.frames) expect(used.has(f), `${d.id} kare ${f}`).toBe(true);
  });
  it('sürekli akışların hepsinde kademe çarpanı var ve akıcıda yarıyı geçmez (yağmur dahil)', () => {
    for (const id of NEW) { const d = EFFECTS[id]; if (d.emitters.some(e => e.kind === 'stream')) { expect(d.tierScale, id).toBeTruthy(); expect(d.tierScale![0], id).toBeLessThanOrEqual(0.5); } }
  });
  it('duman ve buhar normal harmanlama: kıvılcım dışında parlak (additive) bayrak yok, yazı bloom ile yutulmaz', () => {
    for (const id of NEW) { const d = EFFECTS[id]; for (const m of d.modules) if (m.kind === 'flash') throw new Error(id + ' flash kullanıyor'); }
  });
  it('tüm yeni akışlar birlikte akıcıda tavanı (120) aşmaz, dengeli ve şahanede de kendi tavanını', () => {
    for (const t of ['akici', 'dengeli', 'sahane'] as TierName[]) {
      const fx = mk(t);
      for (const id of NEW) for (let i = 0; i < 4; i++) fx.play(id, { x: i, y: 1, z: 0 });
      for (let i = 0; i < 90; i++) fx.update(1 / 30);
      expect(fx.live()).toBeLessThanOrEqual(fx.capacity());
      expect(fx.capacity()).toBe(Math.min(1000, TIER_TABLE[t].particles));
    }
  });
});

describe('GRS-07 sabit efekt noktaları', () => {
  it('saat aralığı ve menzil histerezisi', () => {
    expect(saatIcinde(undefined, 3)).toBe(true);
    expect(saatIcinde([[7, 10.5], [16, 19.5]], 8)).toBe(true);
    expect(saatIcinde([[7, 10.5], [16, 19.5]], 13)).toBe(false);
    expect(saatIcinde([[7, 10.5]], 8 + 24)).toBe(true);
    expect(menzildeMi(30 * 30, 30, false)).toBe(true);
    expect(menzildeMi(32 * 32, 30, false)).toBe(false);
    expect(menzildeMi(32 * 32, 30, true)).toBe(true);
    expect(menzildeMi(35 * 35, 30, true)).toBe(false);
  });
  it('kahraman menzile girince akış başlar, uzaklaşınca durur; yoksa hiçbir şey çalmaz', () => {
    const fx = mk('dengeli');
    let hero = { x: -10, z: 8 }, hour = 13;
    const n = createFxNoktalar({ fx, heroPos: () => hero, anchors: () => ({ 'stations.cay.out': { pos: { x: 3, z: -2 }, y: 1 } }), hour: () => hour });
    n.update(0.6);
    expect(n.active()).toContain('fiskiye'); expect(n.active()).toContain('semaver'); expect(n.active()).not.toContain('toz');   // 13:00: no low sun
    for (let i = 0; i < 20; i++) fx.update(0.05);
    expect(fx.live()).toBeGreaterThan(0);
    hero = { x: 200, z: 20 }; n.update(0.6);
    expect(n.active()).toEqual([]);
    hour = 17; hero = { x: 0, z: 0 }; n.update(0.6);
    expect(n.active()).toContain('toz');
    n.dispose(); expect(n.active()).toEqual([]);
    const nofx = createFxNoktalar({ fx: null, heroPos: () => hero, anchors: () => ({}), hour: () => 12 });
    nofx.update(1); expect(nofx.active()).toEqual([]);
    expect(FX_NOKTALARI.length).toBeGreaterThanOrEqual(3);
  });
});
