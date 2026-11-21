import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createPrefabs, stableKey } from '../../../src/engine/prefab';
import { createDress } from '../../../src/engine/dress';
import type { PrefabDef } from '../../../src/engine/api';
import { GREYBOX_PREFABS } from '../../../src/content/prefabs/common/greybox';

const mk = () => createPrefabs({ dress: createDress({ noart: true } as Parameters<typeof createDress>[0]) });
const stool: PrefabDef = {
  id: 't.stool', params: { h: 0.45 },
  parts: [
    { shape: 'cyl', size: [0.2, 0.06, 0.18], pos: [0, 0.45, 0], color: '#c9a05a', name: 'seat' },
    { shape: 'cyl', size: [0.02, 0.43, 0.02], pos: [0.1, 0.21, 0], color: '#5a3d28', mat: 'wood' },
  ],
  colliders: [{ x0: -0.2, x1: 0.2, z0: -0.2, z1: 0.2 }],
  anchors: { sit: { pos: { x: 0, z: 0 }, y: 0.45, kind: 'seat' } },
};
const meshes = (o: T.Object3D) => { const out: T.Mesh[] = []; o.traverse(n => { if ((n as T.Mesh).isMesh) out.push(n as T.Mesh); }); return out; };

describe('prefab system', () => {
  it('stableKey ignores key order', () => {
    expect(stableKey({ b: 1, a: 'x' })).toBe(stableKey({ a: 'x', b: 1 }));
  });
  it('define/build merges parts per material', () => {
    const p = mk(); p.define(stool);
    const b = p.build('t.stool');
    const ms = meshes(b.object);
    expect(ms.length).toBe(2); // atlas batch + wood batch
    expect(b.colliders).toEqual(stool.colliders);
    expect(b.anchors.sit.kind).toBe('seat');
  });
  it('caches templates per params and shares geometry between clones', () => {
    const p = mk(); p.define(stool);
    const a = p.build('t.stool'), b = p.build('t.stool');
    expect(meshes(a.object)[0].geometry).toBe(meshes(b.object)[0].geometry);
    const c = p.build('t.stool', { h: 0.5 });
    expect(p.cached()).toBe(2);
    expect(c.object).not.toBe(a.object);
  });
  it('place / setPlacement / remove', () => {
    const p = mk(); p.define(stool);
    const root = new T.Group();
    const inst = p.place({ id: 's1', prefab: 't.stool', pos: { x: 2, z: 3 }, rotY: 0.5 }, root);
    expect(root.children.length).toBe(1);
    expect(inst.object.position.x).toBe(2);
    const built = inst.object.children[0];
    inst.setPlacement({ pos: { x: 5, z: 1 } });
    expect(inst.object.position.x).toBe(5);
    expect(inst.object.children[0]).toBe(built); // transform only, no rebuild
    inst.setPlacement({ overrides: { h: 0.6 } });
    expect(inst.object.children[0]).not.toBe(built);
    expect(p.instance('s1')).toBe(inst);
    inst.remove();
    expect(root.children.length).toBe(0);
    expect(p.instance('s1')).toBeUndefined();
  });
  it('redefine rebuilds every instance', () => {
    const p = mk(); p.define(stool);
    const root = new T.Group();
    const i1 = p.place({ id: 'a', prefab: 't.stool', pos: { x: 0, z: 0 } }, root);
    const i2 = p.place({ id: 'b', prefab: 't.stool', pos: { x: 1, z: 0 } }, root);
    const before = meshes(i1.object)[0].geometry.attributes.position.count;
    p.redefine({ ...stool, parts: [...stool.parts, { shape: 'box', size: [0.1, 0.1, 0.1], pos: [0, 0.6, 0], color: '#ff0000' }] });
    expect(meshes(i1.object)[0].geometry.attributes.position.count).toBeGreaterThan(before);
    expect(meshes(i2.object)[0].geometry.attributes.position.count).toBeGreaterThan(before);
  });
  it('instanced defs share one InstancedMesh per parent', () => {
    const p = mk(); p.define({ ...stool, id: 't.inst', instanced: true });
    const root = new T.Group();
    for (let i = 0; i < 5; i++) p.place({ id: 'n' + i, prefab: 't.inst', pos: { x: i, z: 0 } }, root);
    const im: T.InstancedMesh[] = []; root.traverse(n => { if ((n as T.InstancedMesh).isInstancedMesh) im.push(n as T.InstancedMesh); });
    expect(im.length).toBe(2);
    expect(im[0].count).toBe(5);
    p.instance('n2')!.remove();
    expect(im[0].count).toBe(4);
  });
  it('children placements inherit transforms', () => {
    const p = mk(); p.define(stool);
    p.define({ id: 't.set', parts: [], children: [{ id: 'c1', prefab: 't.stool', pos: { x: 1, z: 0 } }, { id: 'c2', prefab: 't.stool', pos: { x: -1, z: 0 } }] });
    const b = p.build('t.set');
    expect(meshes(b.object).length).toBeGreaterThanOrEqual(2);
  });
  it('greybox prefabs build', () => {
    const p = mk(); GREYBOX_PREFABS.forEach(d => p.define(d));
    GREYBOX_PREFABS.forEach(d => { const b = p.build(d.id); expect(meshes(b.object).length).toBeGreaterThan(0); });
    expect(p.colliders('ts.block-a')[0]).toEqual({ x0: -3, x1: 3, z0: -2, z1: 2 });
  });
  it('disposeGpu keeps the CPU template usable', () => {
    const p = mk(); p.define(stool);
    const root = new T.Group();
    p.place({ id: 'g', prefab: 't.stool', pos: { x: 0, z: 0 } }, root);
    let disposed = 0; meshes(root).forEach(m => m.geometry.addEventListener('dispose', () => { disposed++; }));
    p.disposeGpu(root);
    expect(disposed).toBeGreaterThan(0);
    const again = p.build('t.stool');
    expect(meshes(again.object)[0].geometry.attributes.position.count).toBeGreaterThan(0);
  });
});
