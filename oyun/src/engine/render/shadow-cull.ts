/**
 * PRF-06 shadow-pass culling, no visual change. three draws every shadow caster inside the sun's shadow box (30-34 m around the
 * focus), even when its shadow can only fall where the camera does not look (behind the camera, beside the view). A caster's shadow
 * lives in the volume swept from its bounding sphere along the light direction down to the ground; if that volume misses the camera
 * frustum, no visible receiver can be darkened by it, so it is left out of the shadow pass for this frame (castShadow off during the
 * draw, restored right after). Measured 2026-11-20: 60 % of the dengeli draw calls on the 10th-stage pier were shadow draws.
 * The caster list is rebuilt every REFRESH frames (scene changes slowly); per frame only sphere tests run, no allocation.
 * Skipped (always cast): frustumCulled=false objects (skinned/animated rigs with stale bounds), instanced meshes, sprites.
 */
import * as T from 'three';

/** MARGIN: matrixWorld is updated inside render(), so moving casters are tested one frame late */
const REFRESH = 20, MAX_SAMPLES = 6, MARGIN = 0.25;
const _fr = new T.Frustum(), _m = new T.Matrix4(), _s = new T.Sphere(), _c = new T.Vector3(), _L = new T.Vector3(), _p = new T.Vector3();

export interface ShadowCull {
  /** call right before renderer.render: turns castShadow off on casters whose shadow cannot reach the view; returns how many */
  begin(scene: T.Scene, cam: T.Camera, sun: T.DirectionalLight, groundY?: number): number;
  /** call right after the draw: restores castShadow */
  end(): void;
  stats(): { casters: number; culled: number };
}

/** does the shadow of a sphere (center c, radius r) swept along unit light dir L down to y=groundY touch the frustum? */
export function shadowReaches(f: T.Frustum, c: T.Vector3, r: number, L: T.Vector3, groundY: number): boolean {
  if (L.y > -0.05) return true;   // sun at the horizon: endless shadows, keep everything
  const len = Math.max(0, (c.y + r - groundY) / -L.y);
  const n = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(len / Math.max(0.5, 2 * r))));
  const step = len / n, rr = r + step * 0.5 + 1e-3;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * step;
    _s.center.set(c.x + L.x * t, c.y + L.y * t, c.z + L.z * t); _s.radius = rr;
    if (f.intersectsSphere(_s)) return true;
  }
  _s.center.copy(c); _s.radius = r;          // the caster itself (receiver of its own shadow, e.g. a roof seen from above)
  return f.intersectsSphere(_s);
}

export function createShadowCull(): ShadowCull {
  const casters: T.Mesh[] = [], off: T.Mesh[] = [];
  let frame = 0, culled = 0;
  function collect(scene: T.Scene): void {
    casters.length = 0;
    scene.traverseVisible(o => {
      const m = o as T.Mesh;
      if (!m.isMesh || !m.castShadow || !m.frustumCulled || (o as T.InstancedMesh).isInstancedMesh || (o as T.SkinnedMesh).isSkinnedMesh) return;
      casters.push(m);
    });
  }
  return {
    begin(scene, cam, sun, groundY = -1.2) {   // below the sea (WATER_Y -1): the water receives shadows too
      off.length = 0; culled = 0;
      if (!sun.castShadow) return 0;
      if (frame++ % REFRESH === 0) collect(scene);
      cam.updateMatrixWorld();
      _fr.setFromProjectionMatrix(_m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      _L.setFromMatrixPosition(sun.target.matrixWorld).sub(_p.setFromMatrixPosition(sun.matrixWorld)).normalize();
      for (let i = 0; i < casters.length; i++) {
        const m = casters[i];
        if (!m.castShadow || !m.parent) continue;
        const g = m.geometry; if (!g) continue;
        if (!g.boundingSphere) g.computeBoundingSphere();
        _s.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld);
        _c.copy(_s.center);
        if (!shadowReaches(_fr, _c, _s.radius + MARGIN, _L, groundY)) { m.castShadow = false; off.push(m); }
      }
      culled = off.length;
      return culled;
    },
    end() { for (let i = 0; i < off.length; i++) off[i].castShadow = true; off.length = 0; },
    stats: () => ({ casters: casters.length, culled }),
  };
}
