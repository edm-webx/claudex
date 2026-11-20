import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createWarmGate } from '../../../src/engine/render/warm-gate';

const mesh = (m: T.Material) => new T.Mesh(new T.BoxGeometry(1, 1, 1), m);

describe('shader kapısı (PRF-03)', () => {
  it('programı olmayan yeni ağ kameradan saklanır, derleme bitince kendi katmanına döner', () => {
    const g = createWarmGate();
    const scene = new T.Scene(), ready = new T.MeshLambertMaterial(), fresh = new T.MeshStandardMaterial();
    const has = new Set<T.Material>([ready]);
    g.clear();
    const old = mesh(ready), room = new T.Group(), a = mesh(fresh), b = mesh(ready);
    room.add(a, b);
    scene.add(old, room);
    expect(g.dirty()).toBe(true);
    const held = g.collect(scene, m => !has.has(m));
    expect(held).toEqual([a]);
    expect(a.layers.mask).toBe(0);
    expect(b.layers.mask).toBe(1); expect(old.layers.mask).toBe(1);
    expect(g.dirty()).toBe(false);
    has.add(fresh);
    expect(g.release(held)).toBe(1);
    expect(a.layers.mask).toBe(1); expect(g.held()).toBe(0);
    g.dispose();
  });
  it('başka sahneye eklenen nesneye dokunmaz; tek seferde çok ekleme tam taramaya düşer', () => {
    const g = createWarmGate();
    const main = new T.Scene(), other = new T.Scene(), m = new T.MeshBasicMaterial();
    g.clear();
    const x = mesh(m); other.add(x);
    expect(g.collect(main, () => true)).toEqual([]);
    expect(x.layers.mask).toBe(1);
    const many: T.Object3D[] = []; for (let i = 0; i < 5000; i++) many.push(new T.Object3D());
    const y = mesh(m); main.add(y); main.add(...many);
    const held = g.collect(main, () => true);
    expect(held).toContain(y);
    g.release(); expect(y.layers.mask).toBe(1);
    g.dispose();
  });
  it('görünürlüğü görünüm değiştirdiyse kapı geri açarken katmanı ezmez', () => {
    const g = createWarmGate();
    const s = new T.Scene(), m = new T.MeshBasicMaterial(); g.clear();
    const z = mesh(m); s.add(z);
    g.collect(s, () => true);
    z.layers.set(3);   // view moved it meanwhile
    g.release();
    expect(z.layers.mask).toBe(1 << 3);
    g.dispose();
  });
});
