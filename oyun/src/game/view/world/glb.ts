/**
 * Kenney CC0 models (public/modeller, copied to dist/modeller by tools/build-artifact.mjs). Optional art: a failed load
 * leaves the procedural stand-in in place. Models are loaded once and cloned; materials are shared.
 */
import * as T from 'three';

const cache = new Map<string, Promise<T.Object3D | null>>();
export function loadGlb(name: string): Promise<T.Object3D | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const g = await new GLTFLoader().loadAsync('modeller/' + name + '.glb');
        g.scene.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
        return g.scene;
      } catch { return null; }
    })();
    cache.set(name, p);
  }
  return p;
}
const box3 = new T.Box3(), sz = new T.Vector3();
/** Clone wrapped in a group: bottom at y=0, centred on x/z, scaled to w (x) × d (z) [× h (y) when given], optional yaw. */
export function fitClone(src: T.Object3D, w: number, d: number, h?: number, yaw = 0, tint?: string): T.Group {
  const c = src.clone(true), g = new T.Group(); g.add(c);
  if (tint) c.traverse(o => { const m = o as T.Mesh; if (m.isMesh && !Array.isArray(m.material)) { const mm = (m.material as T.MeshStandardMaterial).clone(); mm.color.multiply(new T.Color(tint)); if (mm.map) { mm.emissiveMap = mm.map; mm.emissive = new T.Color('#ffffff'); mm.emissiveIntensity = 0.32; } m.material = mm; } });
  box3.setFromObject(c); box3.getSize(sz);
  const sx = w / sz.x, sz2 = d / sz.z, sy = h ? h / sz.y : Math.min(sx, sz2);
  c.scale.set(sx, sy, sz2);
  box3.setFromObject(c); c.position.set(-(box3.min.x + box3.max.x) / 2, -box3.min.y, -(box3.min.z + box3.max.z) / 2);
  g.rotation.y = yaw;
  return g;
}
