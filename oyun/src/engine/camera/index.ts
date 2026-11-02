/**
 * Camera rig: 1:1 port of v2 game.js `updateCamera` (follow, pinch zoom, event pans, intro descent).
 * Decisions:
 * - follow(target, dt) only records the target; update(dt, alpha) does the v2 work once per render frame
 *   (pan blend, lerp factor min(1, dt*4), intro countdown, position/lookAt). follow+update = v2 updateCamera.
 *   Callers pass an already alpha-interpolated target (v2 used the interpolated player PL.vx/vz).
 * - The intro countdown runs on render dt (v2 decremented it in the sim step; visually identical).
 * - snap(target) jumps without lerp (v2 `updateCamera(dt, true)` on the first frames).
 * - photoMode(on): free orbit is M6+; for now it lowers the pitch slightly (UI hiding is D's).
 */
import * as T from 'three';
import { CAMERA_FOV, CAMERA_PITCH, ZOOM_MIN, ZOOM_MAX, type CameraRig, type CameraDeps, type Vec2 } from '../api';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export interface MotorCameraRig extends CameraRig {
  /** v2 dist for the current aspect and zoom (metres). */
  distance(): number;
  zoomRaw(z: number): void;
  tilt(delta: number): void;
  readonly introLeft: number;
  readonly yaw: number;
  /** Orbit the view around the büfe by `delta` radians (immediate). */
  turn(delta: number): void;
  /** Ease the orbit back to the flat default angle. */
  recenter(): void;
}

export function createCameraRig(deps: CameraDeps): MotorCameraRig {
  const camera = new T.PerspectiveCamera(CAMERA_FOV, deps.aspect || 1, 0.1, 400);
  camera.position.set(0, 18, 14);
  const CAM = { x: 0, z: 0, zoom: 1, intro: 0, pitch: CAMERA_PITCH, photo: false };
  const target = { x: 0, z: 0 };
  let yaw = 0, yawTo: number | null = null;
  let tilt = 0, tiltTo: number | null = null;
  const PITCH_MIN = 0.3, PITCH_MAX = 1.4;
  let pan: { x: number; z: number; t: number; dur: number; resolve: () => void } | null = null;
  let introResolve: (() => void) | null = null;
  let snapNext = true;
  const frustum = new T.Frustum(), pv = new T.Matrix4();

  const baseDist = () => {
    const tanV = Math.tan(camera.fov * Math.PI / 360), asp = camera.aspect;
    return clamp(Math.max(6.6 / (tanV * asp), 6.2 / tanV), 13, 40) * CAM.zoom;
  };

  const rig: MotorCameraRig = {
    camera,
    get fov() { return camera.fov; },
    get pitch() { return CAM.pitch; },
    get zoom() { return CAM.zoom; },
    set zoom(z: number) { CAM.zoom = clamp(+z || 1, ZOOM_MIN, ZOOM_MAX); },
    get introLeft() { return CAM.intro; },
    get yaw() { return yaw; },
    turn(delta: number) { yaw += delta; },
    /** dev/screenshot only: zoom without the ZOOM_MAX clamp */
    zoomRaw(z: number) { CAM.zoom = z; },
    tilt(delta: number) { tiltTo = null; tilt = clamp(tilt + delta, PITCH_MIN - CAM.pitch, PITCH_MAX - CAM.pitch); },
    recenter() { yawTo = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; tiltTo = 0; },
    follow(t: Vec2) { target.x = t.x; target.z = t.z; },
    snap(t: Vec2) { target.x = t.x; target.z = t.z; CAM.x = t.x; CAM.z = t.z; snapNext = true; },
    pan(at: Vec2, dur?: number) {
      if (pan) pan.resolve();
      return new Promise<void>(resolve => { pan = { x: at.x, z: at.z, t: 0, dur: Math.min(2, Math.max(1.2, dur || 1.6)), resolve }; });
    },
    intro(seconds = 3.2) {
      if (introResolve) introResolve();
      CAM.intro = seconds;
      return new Promise<void>(resolve => { introResolve = resolve; });
    },
    photoMode(on: boolean) { CAM.photo = !!on; CAM.pitch = on ? CAMERA_PITCH - 0.25 : CAMERA_PITCH; },
    setAspect(a: number) { if (a > 0 && isFinite(a)) { camera.aspect = a; camera.updateProjectionMatrix(); } },
    distance: baseDist,
    update(dt: number) {
      let tx = target.x, tz = target.z;
      if (pan) {
        const p = pan; p.t += dt;
        const a = p.dur * 0.3, b = p.dur * 0.75;
        const k = p.t < a ? easeInOut(p.t / a) : p.t < b ? 1 : 1 - easeInOut((p.t - b) / (p.dur - b));
        tx = lerp(tx, p.x, k); tz = lerp(tz, p.z, k);
        if (p.t >= p.dur) { pan = null; p.resolve(); }
      }
      const f = snapNext ? 1 : Math.min(1, dt * 4);
      snapNext = false;
      CAM.x = lerp(CAM.x, tx, f); CAM.z = lerp(CAM.z, tz, f);
      let dist = baseDist();
      if (tiltTo !== null) { tilt += (tiltTo - tilt) * (1 - Math.exp(-6 * dt)); if (Math.abs(tilt) < 0.002) { tilt = 0; tiltTo = null; } }
      let pitch = clamp(CAM.pitch + tilt, PITCH_MIN, PITCH_MAX);
      if (CAM.intro > 0) {
        const k = easeInOut(1 - CAM.intro / 3.2); dist *= lerp(2.6, 1, k); pitch = lerp(1.25, CAM.pitch, k);
        CAM.intro -= dt;
        if (CAM.intro <= 0) { CAM.intro = 0; if (introResolve) { const r = introResolve; introResolve = null; r(); } }
      }
      if (yawTo !== null) {
        yaw += (yawTo - yaw) * (1 - Math.exp(-6 * dt));
        if (Math.abs(yawTo - yaw) < 0.002) { yaw = 0; yawTo = null; }
      }
      const off = Math.cos(pitch) * dist;
      camera.position.set(CAM.x + Math.sin(yaw) * off, Math.sin(pitch) * dist, CAM.z + 0.4 + Math.cos(yaw) * off);
      camera.lookAt(CAM.x, 0.6, CAM.z + 0.4);
      camera.updateMatrixWorld();
    },
    focus() { return { x: CAM.x, z: CAM.z }; },
    frustum() {
      camera.updateMatrixWorld();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      return frustum.setFromProjectionMatrix(pv);
    },
  };
  return rig;
}
