import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createPrefabs } from '../../../src/engine/prefab';
import { createDress } from '../../../src/engine/dress';
import type { PrefabDef } from '../../../src/engine/api';

const mk = () => createPrefabs({ dress: createDress({ noart: true } as Parameters<typeof createDress>[0]) });
const stool: PrefabDef = {
  id: 't.stool', instanced: true, params: { h: 0.45 },
  parts: [{ shape: 'cyl', size: [0.2, 0.06, 0.18], pos: [0, 0.45, 0], color: '#c9a05a', name: 'seat' }],
};
const pools = (o: T.Object3D) => o.children.filter(c => (c as T.InstancedMesh).isInstancedMesh) as T.InstancedMesh[];

describe('instanced prefab pool culling (PRF-06)', () => {
  it('havuz gerçek frustum culling yapar, örnek değişince sınır küresi yenilenir', () => {
    const p = mk(); p.define(stool);
    const root = new T.Group();
    p.place({ id: 'a', prefab: 't.stool', pos: { x: 0, z: 0 } }, root);
    p.place({ id: 'b', prefab: 't.stool', pos: { x: 200, z: 0 } }, root);
    p.place({ id: 'c', prefab: 't.stool', pos: { x: 1, z: 0 } }, root);
    const im = pools(root)[0];
    expect(im.frustumCulled).toBe(true);
    im.computeBoundingSphere();
    expect(im.boundingSphere!.radius).toBeGreaterThan(90);
    p.instance('b')!.remove();
    expect(pools(root)[0].boundingSphere).toBeNull();
    pools(root)[0].computeBoundingSphere();
    expect(pools(root)[0].boundingSphere!.radius).toBeLessThan(5);
    // a camera at the origin looking down -z does not see a pool that sits at z=+500
    const far = new T.Group(); p.place({ id: 'z', prefab: 't.stool', pos: { x: 0, z: 500 } }, far);
    const cam = new T.PerspectiveCamera(60, 1, 0.1, 1000); cam.updateMatrixWorld();
    const f = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    far.updateMatrixWorld(true);
    expect(f.intersectsObject(pools(far)[0])).toBe(false);
    // moved into view: the stale sphere is dropped and the pool is drawn again
    p.instance('z')!.setPlacement({ pos: { x: 0, z: -20 } });
    expect(pools(far)[0].boundingSphere).toBeNull();
    far.updateMatrixWorld(true); expect(f.intersectsObject(pools(far)[0])).toBe(true);
  });
});
