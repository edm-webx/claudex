import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { mergeStatic } from '../../../src/engine/render/merge-static';

const box = (m: T.Material, x: number, y = 0, ry = 0) => { const o = new T.Mesh(new T.BoxGeometry(1, 2, 0.5), m); o.position.set(x, y, 0); o.rotation.y = ry; return o; };
const meshes = (o: T.Object3D) => { const r: T.Mesh[] = []; o.traverse(n => { if ((n as T.Mesh).isMesh) r.push(n as T.Mesh); }); return r; };
const worldBox = (o: T.Object3D) => { o.updateMatrixWorld(true); return new T.Box3().setFromObject(o, true); };

describe('mergeStatic (PRF-06)', () => {
  it('malzeme başına tek mesh, köşe sayısı ve dünya sınırı aynı', () => {
    const a = new T.MeshLambertMaterial({ color: '#f00' }), b = new T.MeshLambertMaterial({ color: '#0f0' });
    const g = new T.Group(); g.position.set(5, 1, -3); g.rotation.y = 0.7;
    const sub = new T.Group(); sub.position.set(0, 2, 0); g.add(sub);
    for (let i = 0; i < 6; i++) (i % 2 ? sub : g).add(box(i < 4 ? a : b, i * 1.5, 0, i * 0.3));
    const v0 = meshes(g).reduce((s, m) => s + m.geometry.attributes.position.count, 0);
    const bb0 = worldBox(g);
    const saved = mergeStatic(g);
    const ms = meshes(g);
    expect(saved).toBe(4); expect(ms.length).toBe(2);
    expect(ms.reduce((s, m) => s + m.geometry.attributes.position.count, 0)).toBe(v0);
    const bb1 = worldBox(g);
    expect(bb1.min.distanceTo(bb0.min)).toBeLessThan(1e-4); expect(bb1.max.distanceTo(bb0.max)).toBeLessThan(1e-4);
  });
  it('şeffaf, tek kalan ve noMerge dokunulmaz; gölge bayrağı ayrı tutulur', () => {
    const op = new T.MeshLambertMaterial(), gl = new T.MeshLambertMaterial({ transparent: true, opacity: 0.4 });
    const g = new T.Group();
    const s1 = box(op, 0), s2 = box(op, 2); s2.castShadow = true;
    const t1 = box(gl, 4), t2 = box(gl, 6), k = box(op, 8); k.userData.noMerge = true;
    g.add(s1, s2, t1, t2, k);
    expect(mergeStatic(g)).toBe(0);
    expect(meshes(g).length).toBe(5);
  });
});
