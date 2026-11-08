/**
 * Kenney CC0 models (public/modeller, copied to dist/modeller by tools/build-artifact.mjs). Optional art: a failed load
 * leaves the procedural stand-in in place. Models are loaded once and cloned; materials are shared.
 */
import * as T from 'three';

const cache = new Map<string, Promise<T.Object3D | null>>();
/* sky environment map (render.onEnv) shared by every GLB material: low-poly cars and buildings pick up sky reflections */
const envMats = new Set<T.MeshStandardMaterial>(); let envTex: T.Texture | null = null;
export function setGlbEnv(t: T.Texture | null) { envTex = t; envMats.forEach(m => { m.envMap = t; m.needsUpdate = true; }); }
/* tinted building materials get a daylight-only emissive lift (Kenney colormaps are dark); night dims it so walls do not glow */
const liftMats = new Set<T.MeshStandardMaterial>(); let nightK = 0;
export function setGlbNight(n: number) { nightK = Math.max(0, Math.min(1, n)); liftMats.forEach(m => { m.emissiveIntensity = 0.32 * (1 - nightK) + 0.03; }); }
type EnvKind = 'glossy' | 'matte' | 'skip';
function envReg(m: T.MeshStandardMaterial, kind: EnvKind) {
  if (!m.isMeshStandardMaterial || envMats.has(m) || kind === 'skip') return;
  const glossy = kind === 'glossy';
  m.envMapIntensity = glossy ? 0.7 : 0.35; m.roughness = Math.min(m.roughness, glossy ? 0.42 : 0.85); if (glossy) m.metalness = Math.max(m.metalness, 0.15);
  if (envTex) { m.envMap = envTex; m.needsUpdate = true; } envMats.add(m);
}
export function loadGlb(name: string): Promise<T.Object3D | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const g = await new GLTFLoader().loadAsync('modeller/' + name + '.glb');
        const kind: EnvKind = name.startsWith('auto/') ? 'glossy' : name.startsWith('dogal/') ? 'skip' : 'matte';   // trees keep their own greens
        g.scene.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => envReg(mm as T.MeshStandardMaterial, kind)); } });
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
  if (tint) c.traverse(o => { const m = o as T.Mesh; if (m.isMesh && !Array.isArray(m.material)) { const mm = (m.material as T.MeshStandardMaterial).clone(); mm.color.multiply(new T.Color(tint)); if (mm.map) { mm.emissiveMap = mm.map; mm.emissive = new T.Color('#ffffff'); mm.emissiveIntensity = 0.32 * (1 - nightK) + 0.03; liftMats.add(mm); } envMats.delete(mm); envReg(mm, 'matte'); m.material = mm; } });
  box3.setFromObject(c); box3.getSize(sz);
  const sx = w / sz.x, sz2 = d / sz.z, sy = h ? h / sz.y : Math.min(sx, sz2);
  c.scale.set(sx, sy, sz2);
  box3.setFromObject(c); c.position.set(-(box3.min.x + box3.max.x) / 2, -box3.min.y, -(box3.min.z + box3.max.z) / 2);
  g.rotation.y = yaw;
  return g;
}
