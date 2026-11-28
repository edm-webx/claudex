import { describe, it, expect } from 'vitest';
import { Scene } from 'three';
import { createFx, FX_SPRITES, FX_ATLAS_COLS, AMBIENT_SHARE } from '../../../src/engine/fx';
import { EFFECTS } from '../../../src/content/effects';
import { TIER_TABLE } from '../../../src/engine/quality';
import type { Quality, TierDef, TierName, EffectDef } from '../../../src/engine/api';
import { createFxNoktalar, saatIcinde, menzildeMi, FX_NOKTALARI } from '../../../src/game/view/world/fx-noktalar';

const NEW = ['mutfakBuhar', 'izgaraDuman', 'kivilcim', 'semaverBuhar', 'bacaDumani', 'fiskiye', 'fiskiyeKol', 'fiskiyeSis', 'atesBocegi', 'polen', 'yagmurSicrama', 'insaatTozu'];
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
  it('duman ve buhar normal karışım; yalnız kıvılcım ve ateşböceği additive ve alfa tepesi <= 0.9; hiçbir parçacık 0.08 m altında değil', () => {
    for (const id of NEW) {
      const d = EFFECTS[id];
      for (const m of d.modules) {
        if (m.kind === 'flash') throw new Error(id + ' flash kullanıyor');
        if (m.kind === 'sizeOverLife') expect(Math.max(...m.stops.map(x => x[1])), id).toBeGreaterThanOrEqual(0.08);
        if (m.kind === 'colorOverLife' && d.additive) expect(Math.max(...m.stops.map(x => x[2])), id).toBeLessThanOrEqual(0.9);
      }
      expect(!!d.additive, id).toBe(id === 'kivilcim' || id === 'atesBocegi');
      expect(d.ambient, id).toBe(true);
    }
    for (const id of ['ocakAlev', 'fritozKabarcik', 'tozZerresi']) expect(EFFECTS[id], id).toBeUndefined();
  });
  it('fıskiye tepesi >= 2.4 m ve dengeli kademede 80-180 canlı parçacık', () => {
    const v = EFFECTS.fiskiye.modules.find(m => m.kind === 'velocity') as { speed: [number, number] }, g = EFFECTS.fiskiye.modules.find(m => m.kind === 'gravity') as { g: number };
    expect(v.speed[0] ** 2 / (2 * -g.g)).toBeGreaterThanOrEqual(2.4);
    const fx = mk('dengeli');
    for (const id of ['fiskiye', 'fiskiyeKol', 'fiskiyeSis']) fx.play(id, { x: 0, y: 0.6, z: 0 });
    for (let i = 0; i < 150; i++) fx.update(1 / 30);
    expect(fx.live()).toBeGreaterThanOrEqual(80); expect(fx.live()).toBeLessThanOrEqual(180);
  });
  it('ortam akışları tavanın %60ını geçmez; ortam doluyken olay efekti (konfeti/para) yine doğar', () => {
    for (const t of ['akici', 'dengeli', 'sahane'] as TierName[]) {
      const fx = mk(t) as ReturnType<typeof mk> & { liveAmbient(): number };
      for (const id of NEW) for (let i = 0; i < 6; i++) fx.play(id, { x: i, y: 1, z: 0 }, { scale: 3 });
      for (let i = 0; i < 90; i++) fx.update(1 / 30);
      expect(fx.liveAmbient()).toBeLessThanOrEqual(Math.floor(fx.capacity() * AMBIENT_SHARE));
      const before = fx.live(); fx.play('confetti', { x: 0, y: 1, z: 0 }); fx.update(1 / 60);
      expect(fx.live()).toBeGreaterThan(before - 20);
      expect(fx.live() - fx.liveAmbient()).toBeGreaterThan(0);
    }
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
    let hero = { x: -4, z: 40 }, hour = 13;
    const n = createFxNoktalar({ fx, heroPos: () => hero, anchors: () => ({ 'stations.cay.out': { pos: { x: 3, z: -2 }, y: 1 } }), hour: () => hour });
    n.update(0.6);
    expect(n.active()).toContain('fiskiye'); expect(n.active()).toContain('polen'); expect(n.active()).not.toContain('semaver');
    for (let i = 0; i < 20; i++) fx.update(0.05);
    expect(fx.live()).toBeGreaterThan(0);
    hero = { x: 200, z: 20 }; n.update(0.6);
    expect(n.active()).toEqual([]);
    hour = 21; hero = { x: 2, z: -3 }; n.update(0.6);
    expect(n.active()).toEqual(['semaver']);   // gece polen yok, iskelede fıskiye yok
    n.dispose(); expect(n.active()).toEqual([]);
    const nofx = createFxNoktalar({ fx: null, heroPos: () => hero, anchors: () => ({}), hour: () => 12 });
    nofx.update(1); expect(nofx.active()).toEqual([]);
  });
});
