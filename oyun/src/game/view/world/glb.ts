/**
 * Kenney CC0 models (public/modeller, copied to dist/modeller by tools/build-artifact.mjs). Optional art: a failed load
 * leaves the procedural stand-in in place. Models are loaded once and cloned; materials are shared.
 */
import * as T from 'three';

const cache = new Map<string, Promise<T.Object3D | null>>();
/* sky environment map (render.onEnv) shared by every GLB material: low-poly cars and buildings pick up sky reflections */
const envMats = new Set<T.MeshStandardMaterial>(); let envTex: T.Texture | null = null;
// GRS-05: a texture swap is a uniform change; only null <-> texture changes the program (USE_ENVMAP), so only that recompiles
// (was needsUpdate on every half-hour refresh = every env material relinked twice per game hour)
export function setGlbEnv(t: T.Texture | null) { envTex = t; envMats.forEach(m => { const relink = !m.envMap !== !t; m.envMap = t; if (relink) m.needsUpdate = true; }); }
/* GRS-17: tier gate for sky reflections (akıcı 0). envMapIntensity is a uniform: no relink; the base per material is kept once. */
const envBase = new WeakMap<T.MeshStandardMaterial, number>(); let envK = 1;
export function setGlbEnvK(k: number) { envK = Math.max(0, Math.min(1, +k)); envMats.forEach(m => { if (!envBase.has(m)) envBase.set(m, m.envMapIntensity); m.envMapIntensity = envBase.get(m)! * envK; }); }
export const glbEnvK = () => envK;
const envKApply = (m: T.MeshStandardMaterial) => { envBase.set(m, m.envMapIntensity); m.envMapIntensity *= envK; };
/* tinted building materials get a daylight-only emissive lift (Kenney colormaps are dark); night dims it so walls do not glow */
const liftMats = new Set<T.MeshStandardMaterial>(); let nightK = 0;
export function setGlbNight(n: number) { nightK = Math.max(0, Math.min(1, n)); liftMats.forEach(m => { m.emissiveIntensity = 0.32 * (1 - nightK) + 0.03; }); }
type EnvKind = 'glossy' | 'matte' | 'skip';
function envReg(m: T.MeshStandardMaterial, kind: EnvKind) {
  if (!m.isMeshStandardMaterial || envMats.has(m) || kind === 'skip') return;
  const glossy = kind === 'glossy';
  m.envMapIntensity = glossy ? 0.7 : 0.35; m.roughness = Math.min(m.roughness, glossy ? 0.42 : 0.85); if (glossy) m.metalness = Math.max(m.metalness, 0.15);
  if (envTex) { m.envMap = envTex; m.needsUpdate = true; } envMats.add(m); envKApply(m);
}
/** Let a non-GLB material (procedural buildings) pick up the same sky reflections. */
export function useSkyEnv(m: T.MeshStandardMaterial, kind: 'matte' | 'glass') {
  if (kind === 'glass') { if (envMats.has(m)) return; m.envMapIntensity = 1.15; envMats.add(m); envKApply(m); if (envTex) { m.envMap = envTex; m.needsUpdate = true; } return; }
  envReg(m, 'matte');
}
/* PRF-15: every Kenney kit file points at the same Textures/colormap.png with the same material; each GLTFLoader load made its own
   texture (one 512x512+mip GPU copy per car/building, ~1.4 MB each) and material. Identical materials of one kit folder are shared. */
const kitMats = new Map<string, T.MeshStandardMaterial>();
function sharedMat(name: string, m: T.MeshStandardMaterial): T.MeshStandardMaterial {
  if (!m.isMeshStandardMaterial) return m;
  const k = name.split('/')[0] + '|' + [m.name, m.color.getHexString(), m.emissive.getHexString(), m.metalness, m.roughness, m.side, m.transparent ? 1 : 0, m.opacity, m.map?.name ?? '-', m.map ? 1 : 0, m.normalMap ? 1 : 0, m.vertexColors ? 1 : 0].join(',');
  const have = kitMats.get(k);
  if (!have) { kitMats.set(k, m); return m; }
  if (have !== m) { if (m.map && m.map !== have.map) m.map.dispose(); m.dispose(); }   // never uploaded: nothing on the GPU yet
  return have;
}
export function loadGlb(name: string): Promise<T.Object3D | null> {
  let p = cache.get(name);
  if (!p) {
    p = (async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const g = await new GLTFLoader().loadAsync('modeller/' + name + '.glb');
        const kind: EnvKind = name.startsWith('auto/') ? 'glossy' : name.startsWith('dogal/') ? 'skip' : 'matte';   // trees keep their own greens
        g.scene.traverse(o => { const m = o as T.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; if (!Array.isArray(m.material)) m.material = sharedMat(name, m.material as T.MeshStandardMaterial); (Array.isArray(m.material) ? m.material : [m.material]).forEach(mm => envReg(mm as T.MeshStandardMaterial, kind)); } });
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
