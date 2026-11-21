// 2026-11-21: prefab sistemi yerleştirme kimliklerini sahne genelinde tek sayıyordu; iki bölgenin 'ground' yerleştirmesi
// birbirini siliyordu ve Belgrad Ormanı zemini hiç çizilmiyordu (arkada gökyüzü rengi, açık mavi boşluk).
import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createPrefabs } from '../../src/engine/prefab';
import { createDress } from '../../src/engine/dress';
import { disariZones } from '../../src/content/zones/disari';

const mk = () => createPrefabs({ dress: createDress({ noart: true } as Parameters<typeof createDress>[0]) });
describe('bölge yerleştirme kimlikleri', () => {
  it('farklı bölge köklerinde aynı kimlik birbirini silmez', () => {
    const p = mk(); p.define({ id: 't.zemin', parts: [{ shape: 'box', size: [2, 0.1, 2], pos: [0, 0, 0], color: '#6f9e55', name: 'g' }] });
    const a = new T.Group(), b = new T.Group();
    p.place({ id: 'ground', prefab: 't.zemin', pos: { x: 0, z: 0 } }, a);
    p.place({ id: 'ground', prefab: 't.zemin', pos: { x: 800, z: 0 } }, b);
    expect(a.children.length).toBe(1); expect(b.children.length).toBe(1);
    expect(a.children[0].parent).toBe(a);
  });
  it('aynı kök içinde aynı kimlik yine eskisini değiştirir', () => {
    const p = mk(); p.define({ id: 't.zemin', parts: [{ shape: 'box', size: [2, 0.1, 2], pos: [0, 0, 0], color: '#6f9e55', name: 'g' }] });
    const a = new T.Group();
    p.place({ id: 'x', prefab: 't.zemin', pos: { x: 0, z: 0 } }, a); p.place({ id: 'x', prefab: 't.zemin', pos: { x: 5, z: 0 } }, a);
    expect(a.children.length).toBe(1);
  });
  it('bir bölge içinde kimlikler benzersiz', () => {
    for (const z of disariZones()) { const ids = z.props.map(q => q.id); expect(ids.length, z.id).toBe(new Set(ids).size); }
  });
});
