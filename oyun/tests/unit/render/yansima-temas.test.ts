import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { reflectBudget, markReflected, createReflector, REFLECT_LAYER } from '../../../src/engine/render/reflect';
import { createTemasGolge, temasOpaklik, temasYaricap, TEMAS_CAP } from '../../../src/game/view/world/temas-golge';
import { bakeFootAo, Batch, FOOT_AO } from '../../../src/engine/prefab/batch';

describe('su yansıması bütçesi (GRS-05)', () => {
  it('akıcıda yansıma yok, dengeli çeyrek çözünürlük 2 karede bir, şahane yarım çözünürlük her karede', () => {
    expect(reflectBudget('akici')).toBeNull();
    expect(reflectBudget('dengeli')).toEqual({ scale: 0.25, every: 2 });
    expect(reflectBudget('sahane')).toEqual({ scale: 0.5, every: 1 });
  });
  it('yalnız işaretli nesneler yansıma katmanına girer, ana kamera yine hepsini görür', () => {
    const root = new T.Group(), a = new T.Mesh(), b = new T.Mesh(), other = new T.Mesh();
    root.add(a, b); a.add(new T.Object3D());
    expect(markReflected(root)).toBe(4);
    expect(a.layers.isEnabled(REFLECT_LAYER)).toBe(true); expect(a.layers.isEnabled(0)).toBe(true);
    expect(other.layers.isEnabled(REFLECT_LAYER)).toBe(false);
    expect(new T.PerspectiveCamera().layers.test(a.layers)).toBe(true);
  });
  it('akıcıda hedef hiç oluşmaz; bütçe kalkınca hedef serbest kalır', () => {
    const r = createReflector(-1);
    r.setBudget(reflectBudget('akici'));
    expect(r.texture).toBeNull(); expect(r.on).toBe(false);
    r.setBudget(reflectBudget('dengeli')); r.setBudget(null);
    expect(r.texture).toBeNull();
  });
});

describe('temas gölgesi (GRS-06)', () => {
  it('karakter başına bir örnek, tavan aşılmaz, tek çizim çağrısı (tek InstancedMesh)', () => {
    const g = new T.Group(), t = createTemasGolge(g, 4);
    t.begin(); for (let i = 0; i < 6; i++) t.add(i, 0, 0.3); t.end();
    expect(t.count).toBe(4); expect(t.mesh.count).toBe(4); expect(g.children.length).toBe(1);
    t.begin(); t.end(); expect(t.mesh.visible).toBe(false);
    expect(TEMAS_CAP).toBeGreaterThanOrEqual(256);
    t.dispose();
  });
  it('gölge haritası açıkken leke hafif, kapalıyken belirgin; gece azalır; oturan geniş', () => {
    expect(temasOpaklik(true, 0)).toBeLessThan(temasOpaklik(false, 0));
    expect(temasOpaklik(false, 1)).toBeLessThan(temasOpaklik(false, 0));
    expect(temasOpaklik(false, 0)).toBeLessThanOrEqual(0.5);
    expect(temasYaricap(true, 0)).toBeGreaterThan(temasYaricap(false, 0));
  });
});

describe('pişirilmiş ayak AO (GRS-06)', () => {
  it('yan yüzün dibi kararır, tepesi ve üst yüz değişmez, ters yön kapalıyken değişiklik yok', () => {
    const p = [0, 0, 0, 0, 1, 0, 0, 0, 0], n = [1, 0, 0, 1, 0, 0, 0, 1, 0], c = [1, 1, 1, 1, 1, 1, 1, 1, 1];
    const o = bakeFootAo(p, n, c, 0.3, 0.5);
    expect(o[0]).toBeCloseTo(0.7, 5);      // side face at the floor
    expect(o[3]).toBeCloseTo(1, 5);        // side face above 0.5 m
    expect(o[6]).toBeCloseTo(1, 5);        // top face at the floor
    expect(FOOT_AO).toBeGreaterThan(0); expect(FOOT_AO).toBeLessThan(0.4);
  });
  it('ao 0 iken Batch eski renkleri aynen verir; ao açıkken yer yüzü karanlık, üst yüz aynı', () => {
    const mk = (ao: number) => { const b = new Batch(); b.ao = ao; b.box(1, 1, 1, '#ffffff', 0, 0.5, 0, { r: 0 }); return b.geometry().attributes.color as T.BufferAttribute; };
    const off = mk(0), on = mk(0.3);
    let darker = 0, same = 0;
    for (let i = 0; i < off.count; i++) { if (on.getX(i) < off.getX(i) - 1e-6) darker++; else same++; }
    expect(darker).toBeGreaterThan(0); expect(same).toBeGreaterThan(0);
    expect(Math.max(...Array.from({ length: on.count }, (_, i) => on.getX(i)))).toBeCloseTo(1, 5);
  });
});
