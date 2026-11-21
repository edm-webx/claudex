import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createShadowCull, shadowReaches } from '../../../src/engine/render/shadow-cull';

function setup() {
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(40, 16 / 9, 0.5, 200); cam.position.set(0, 20, 12); cam.lookAt(0, 0, 0);
  const sun = new T.DirectionalLight('#fff', 1); sun.castShadow = true; sun.position.set(10, 30, 10); sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target, cam);
  scene.updateMatrixWorld(true); cam.updateMatrixWorld();
  return { scene, cam, sun };
}
const box = (x: number, y: number, z: number, s = 1) => { const m = new T.Mesh(new T.BoxGeometry(s, s, s), new T.MeshLambertMaterial()); m.position.set(x, y, z); m.castShadow = true; return m; };

describe('shadow-pass culling (PRF-06)', () => {
  it('görüşe gölgesi düşmeyen gölgeden çıkar, sonra geri gelir', () => {
    const { scene, cam, sun } = setup();
    const inView = box(0, 0.5, 0), behind = box(0, 0.5, 60), tall = box(30, 20, 30, 2);
    scene.add(inView, behind, tall); scene.updateMatrixWorld(true);
    const c = createShadowCull();
    const n = c.begin(scene, cam, sun);
    expect(inView.castShadow).toBe(true);
    expect(behind.castShadow).toBe(false);
    expect(n).toBeGreaterThanOrEqual(1);
    c.end();
    expect(behind.castShadow).toBe(true);
  });
  it('görüş dışındaki uzun nesnenin gölgesi görüşe uzanıyorsa kalır', () => {
    const { cam, sun } = setup();
    const f = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const L = new T.Vector3().subVectors(sun.target.position, sun.position).normalize();
    // a point high above, up-sun of the view centre: its shadow ray lands at the origin
    const c = new T.Vector3(0, 0, 0).addScaledVector(L, -25);
    expect(shadowReaches(f, c, 0.3, L, -1.2)).toBe(true);
    expect(shadowReaches(f, new T.Vector3(0, 0.5, 80), 0.5, L, -1.2)).toBe(false);
  });
  it('güneş gölgesi kapalıysa hiçbir şeye dokunmaz', () => {
    const { scene, cam, sun } = setup(); sun.castShadow = false;
    const b = box(0, 0.5, 90); scene.add(b); scene.updateMatrixWorld(true);
    const c = createShadowCull(); expect(c.begin(scene, cam, sun)).toBe(0); expect(b.castShadow).toBe(true); c.end();
  });
});
