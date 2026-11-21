/**
 * GRS-05: planar water reflection (three Reflector idea, trimmed to what the sea needs).
 * The scene is drawn a second time from a camera mirrored across the water plane into a small half-float target; the sea
 * shader samples it with a projective matrix (no screen-size dependency). Only objects on REFLECT_LAYER are drawn (sky, far
 * shore, pier, kiosk, ferry, boats), so the extra pass stays a fraction of the main one: no crowd, no particles, no shadow pass.
 * Budget per tier (reflectBudget): akici none (the sea keeps its fresnel colour), dengeli quarter resolution every 2nd frame,
 * sahane half resolution every frame. The target is created on first use and freed when the tier drops it, nothing relinks:
 * the sea program is the same in every tier (uReflOn picks the path).
 */
import * as T from 'three';
import type { TierName } from '../api';

export const REFLECT_LAYER = 1;
export interface ReflectBudget { scale: number; every: number }
/** Resolution scale (vs the drawing buffer) and frame interval; null = no reflection pass in this tier. */
export function reflectBudget(tier: TierName | string): ReflectBudget | null {
  if (tier === 'sahane') return { scale: 0.5, every: 1 };
  if (tier === 'dengeli') return { scale: 0.25, every: 2 };
  return null;
}
/** Marks a whole subtree as reflected (layers are not inherited, so each node is enabled). Returns the node count. */
export function markReflected(root: T.Object3D | null | undefined): number {
  let n = 0;
  root?.traverse(o => { o.layers.enable(REFLECT_LAYER); n++; });
  return n;
}

export interface Reflector {
  readonly matrix: T.Matrix4;
  readonly texture: T.Texture | null;
  /** true when the last frame produced a usable image */
  readonly on: boolean;
  setBudget(b: ReflectBudget | null): void;
  /** Draws the mirrored view when due. `hide` objects (the sea itself) are hidden during the pass. */
  render(r: T.WebGLRenderer, scene: T.Scene, cam: T.PerspectiveCamera, hide: T.Object3D | null): void;
  stats(): { w: number; h: number; renders: number };
  dispose(): void;
}

export function createReflector(planeY: number): Reflector {
  const matrix = new T.Matrix4();
  const vcam = new T.PerspectiveCamera();
  const plane = new T.Plane(), n = new T.Vector3(0, 1, 0), pt = new T.Vector3(0, planeY, 0);
  const cp = new T.Vector3(), tgt = new T.Vector3(), look = new T.Vector3(), rot = new T.Matrix4(), clip = new T.Vector4(), q = new T.Vector4();
  let rt: T.WebGLRenderTarget | null = null, budget: ReflectBudget | null = null, tick = 0, renders = 0, on = false;
  vcam.layers.set(REFLECT_LAYER);

  const api: Reflector = {
    matrix,
    get texture() { return rt ? rt.texture : null; },
    get on() { return on; },
    setBudget(b) {
      budget = b;
      if (!b) { rt?.dispose(); rt = null; on = false; }
    },
    render(r, scene, cam, hide) {
      if (!budget) { on = false; return; }
      if (tick++ % budget.every !== 0 && rt) return;
      const sz = r.getDrawingBufferSize(new T.Vector2());
      const w = Math.max(64, Math.round(sz.x * budget.scale)), h = Math.max(64, Math.round(sz.y * budget.scale));
      if (!rt) { rt = new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, depthBuffer: true, generateMipmaps: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter }); rt.texture.name = 'sea-reflect'; }
      else if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      // camera below the plane looks up through it: nothing to mirror
      cam.updateMatrixWorld();
      cp.setFromMatrixPosition(cam.matrixWorld);
      if (cp.y <= planeY + 0.2) { on = false; return; }
      rot.extractRotation(cam.matrixWorld);
      look.set(0, 0, -1).applyMatrix4(rot).add(cp);
      const refl = (v: T.Vector3) => { v.y = 2 * planeY - v.y; return v; };
      refl(cp); tgt.copy(look); refl(tgt);
      vcam.position.copy(cp);
      vcam.up.set(0, 1, 0).applyMatrix4(rot); vcam.up.y = -vcam.up.y;
      vcam.lookAt(tgt);
      vcam.far = cam.far; vcam.near = cam.near; vcam.aspect = cam.aspect; vcam.fov = cam.fov;
      vcam.updateMatrixWorld(); vcam.projectionMatrix.copy(cam.projectionMatrix); vcam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      // texture matrix: world -> mirrored clip -> 0..1
      matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      matrix.multiply(vcam.projectionMatrix).multiply(vcam.matrixWorldInverse);
      // oblique near plane: whatever stands below the water (pier piles) is cut away
      plane.setFromNormalAndCoplanarPoint(n, pt).applyMatrix4(vcam.matrixWorldInverse);
      clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
      const pm = vcam.projectionMatrix.elements;
      q.x = (Math.sign(clip.x) + pm[8]) / pm[0]; q.y = (Math.sign(clip.y) + pm[9]) / pm[5]; q.z = -1; q.w = (1 + pm[10]) / pm[14];
      clip.multiplyScalar(2 / clip.dot(q));
      pm[2] = clip.x; pm[6] = clip.y; pm[10] = clip.z + 1 - 0.003; pm[14] = clip.w;
      // draw: no shadow-map refresh (it was just made by the main pass), sea hidden, previous state restored
      const prevRT = r.getRenderTarget(), prevAuto = r.shadowMap.autoUpdate, prevVis = hide ? hide.visible : true, prevXr = r.xr.enabled;
      const prevAutoClear = r.autoClear, prevBg = scene.background, prevInfo = r.info.autoReset;
      r.shadowMap.autoUpdate = false; r.xr.enabled = false; r.info.autoReset = false;
      if (hide) hide.visible = false;
      try {
        r.setRenderTarget(rt); r.autoClear = true; r.clear();
        r.render(scene, vcam);
        renders++; on = true;
      } finally {
        if (hide) hide.visible = prevVis;
        r.setRenderTarget(prevRT); r.shadowMap.autoUpdate = prevAuto; r.xr.enabled = prevXr; r.autoClear = prevAutoClear; scene.background = prevBg; r.info.autoReset = prevInfo;
      }
    },
    stats() { return { w: rt?.width ?? 0, h: rt?.height ?? 0, renders }; },
    dispose() { rt?.dispose(); rt = null; on = false; },
  };
  return api;
}
