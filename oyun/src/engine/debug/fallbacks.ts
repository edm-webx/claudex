/**
 * Boot fallbacks (CONTRACT: a missing or throwing module gets a fallback, never a crash). Owner: Builder A.
 * - fallbackRender: plain three renderer + v2 lights/sky colour + v2 camera formula; grey deck. Throws only when WebGL
 *   itself is unavailable (boot then shows #fail).
 * - fallbackWorld: grey box kiosk on a plank-coloured deck. fallbackHero: capsule character. fallbackUi: plain HUD.
 */
import * as THREE from 'three';
import type {
  RenderPipeline, CameraRig, TierDef, Vec2, Vec3, ScreenPt, Disposer, RenderInfo, Ui, HudPatch, WorldLabel, GameView, HeroHandle, Animator, AnimLayerInput, RigPose,
} from '../api';
import { CAMERA_FOV, CAMERA_PITCH, ZOOM_MIN, ZOOM_MAX } from '../api';

export function fallbackCameraRig(aspect: number): CameraRig {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.1, 400);
  const tanV = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const f = { x: 0, z: 0 };
  let zoom = 1;
  const frustum = new THREE.Frustum(), m = new THREE.Matrix4();
  const place = () => {
    const dist = Math.min(40, Math.max(13, Math.max(6.6 / (tanV * camera.aspect), 6.2 / tanV))) * zoom;
    camera.position.set(f.x, Math.sin(CAMERA_PITCH) * dist, f.z + 0.4 + Math.cos(CAMERA_PITCH) * dist);
    camera.lookAt(f.x, 0.6, f.z + 0.4);
    camera.updateMatrixWorld();
  };
  const rig: CameraRig = {
    camera, fov: CAMERA_FOV, pitch: CAMERA_PITCH,
    get zoom() { return zoom; }, set zoom(z: number) { zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)); },
    follow(t, dt) { const k = Math.min(1, dt * 4); f.x += (t.x - f.x) * k; f.z += (t.z - f.z) * k; },
    snap(t) { f.x = t.x; f.z = t.z; },
    pan: async () => {}, intro: async () => {}, photoMode() {},
    setAspect(a) { camera.aspect = a; camera.updateProjectionMatrix(); },
    update() { place(); },
    focus: () => ({ x: f.x, z: f.z }),
    frustum() { m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(m); return frustum; },
  };
  place();
  return rig;
}

export function fallbackRender(canvas: HTMLCanvasElement, tier: TierDef): RenderPipeline {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3f7');
  scene.add(new THREE.HemisphereLight('#dcefff', '#9a8a74', 1.45));
  const sun = new THREE.DirectionalLight('#fff4e2', 2.3); sun.position.set(5, 10, 4); scene.add(sun);
  const rig = fallbackCameraRig(1);
  const picks = new Map<string, { p: THREE.Vector3; r: number }>();
  const lost = new Set<() => void>(), restored = new Set<() => void>();
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost.forEach(f => f()); });
  canvas.addEventListener('webglcontextrestored', () => restored.forEach(f => f()));
  let ext: { loseContext(): void; restoreContext(): void } | null = null;
  const v = new THREE.Vector3();
  const resize = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(Math.min(tier.pixelRatio, devicePixelRatio || 1));
    renderer.setSize(w, h, false); rig.setAspect(w / Math.max(1, h));
  };
  addEventListener('resize', resize); resize();
  const toScreen = (p: Vec3, out: ScreenPt) => {
    v.set(p.x, p.y, p.z).project(rig.camera);
    out.x = (v.x * 0.5 + 0.5) * (canvas.clientWidth || innerWidth);
    out.y = (-v.y * 0.5 + 0.5) * (canvas.clientHeight || innerHeight);
    return v.z < 1;
  };
  const sp: ScreenPt = { x: 0, y: 0 };
  return {
    init() {}, setTier(t) { tier = t; resize(); },
    setTime() {}, setWeather() {},
    frame(s, c) { renderer.render(s, c); },
    info: (): RenderInfo => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, texs: renderer.info.memory.textures }),
    resize, scene, camera: rig, renderer,
    registerPick(id, p, r): Disposer { picks.set(id, { p: new THREE.Vector3(p.x, p.y, p.z), r }); return () => { picks.delete(id); }; },
    updatePick(id, p) { picks.get(id)?.p.set(p.x, p.y, p.z); },
    pick(pt) {
      let best: string | null = null, bd = 48 * 48;
      picks.forEach((k, id) => { if (toScreen(k.p, sp)) { const d = (sp.x - pt.x) ** 2 + (sp.y - pt.y) ** 2; if (d < bd) { bd = d; best = id; } } });
      return best;
    },
    worldToScreen: toScreen,
    onContextLost(cb) { lost.add(cb); return () => { lost.delete(cb); }; },
    onContextRestored(cb) { restored.add(cb); return () => { restored.delete(cb); }; },
    loseContext() { ext = ext ?? (renderer.getContext().getExtension('WEBGL_lose_context') as typeof ext); ext?.loseContext(); },
    restoreContext() { ext?.restoreContext(); },
    dispose() { renderer.dispose(); },
  };
}

export function fallbackWorld(scene: THREE.Scene): GameView {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 12), new THREE.MeshLambertMaterial({ color: '#b98b5e' }));
  deck.position.y = -0.15;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#3f8fc0' }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.6;
  const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 2.2), new THREE.MeshLambertMaterial({ color: '#9a9a9a' }));
  box.position.set(0, 1.3, -4.2);
  g.add(sea, deck, box);
  scene.add(g);
  return { update() {}, dispose() { scene.remove(g); } };
}

export function fallbackHero(scene: THREE.Scene): HeroHandle {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.9, 4, 10), new THREE.MeshLambertMaterial({ color: '#f7f7f2' }));
  body.position.y = 0.75;
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.05), new THREE.MeshLambertMaterial({ color: '#d63a2a' }));
  apron.position.set(0, 0.7, 0.3);
  g.add(body, apron); scene.add(g);
  const pose = { root: { x: 0, y: 0, z: 0 }, lean: 0, bob: 0, torsoTwist: 0, head: { x: 0, y: 0, z: 0 }, armL: { x: 0, y: 0, z: 0 }, armR: { x: 0, y: 0, z: 0 }, legL: { x: 0, y: 0, z: 0 }, legR: { x: 0, y: 0, z: 0 } } as RigPose;
  const animator: Animator = { gait: { id: 'normal', stride: 1, freq: 1, bob: 0, sway: 0, armSwing: 0 }, setGait() {}, update: (_d: number, _i: AnimLayerInput) => pose, play() {}, emote() {} };
  return {
    object: g, animator,
    setPose(p: Vec2, r: number) { g.position.set(p.x, 0, p.z); g.rotation.y = r; },
    setInput() {}, setExpr() {}, setCarry() {}, lookAt() {}, update() {},
    dispose() { scene.remove(g); },
  };
}

/** Plain HUD: money/day line, toasts in a top strip. Everything else is a no-op. */
export function fallbackUi(root: HTMLElement): Ui {
  const doc = root.ownerDocument;
  const hud = doc.createElement('div');
  hud.style.cssText = 'position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:5;background:#fffaf0;color:#4a3524;border-radius:12px;padding:6px 12px;font:800 16px system-ui,sans-serif;box-shadow:0 2px 0 rgba(0,0,0,.15)';
  root.appendChild(hud);
  const toastEl = doc.createElement('div');
  toastEl.style.cssText = 'position:fixed;left:50%;top:60px;transform:translateX(-50%);z-index:6;background:#4a3524;color:#fff;border-radius:10px;padding:6px 12px;font:700 14px system-ui,sans-serif;display:none';
  root.appendChild(toastEl);
  let tt: ReturnType<typeof setTimeout> | undefined;
  const label = (): WorldLabel => ({ set() {}, at() {}, show() {}, release() {} });
  const st: HudPatch = { money: 0, day: 1 };
  return {
    hud(p) { Object.assign(st, p); hud.textContent = `${Math.floor(Number(st.money) || 0)} ₺ · Gün ${st.day ?? 1}`; },
    toast(text) { toastEl.textContent = text; toastEl.style.display = 'block'; clearTimeout(tt); tt = setTimeout(() => { toastEl.style.display = 'none'; }, 3000); },
    label, card: async () => {}, sheet() {}, close() {},
    bell: { push() {}, list: () => [] },
    transition: async () => {},
    settings: { textScale: 1, hand: 'right', colorBlindIcons: false, haptics: true, batterySaver: false },
    update() {},
    setMode(m) { hud.style.display = m === 'hidden' ? 'none' : ''; },
    root,
  };
}

/** HUD view used with fallbackUi (or when createHud throws): pushes money/day each half second. */
export function fallbackHud(ui: Ui): GameView {
  let t = 0;
  return { update(s, dt) { t -= dt; if (t <= 0) { t = 0.5; ui.hud({ money: s.money, day: s.day }); } }, dispose() {} };
}
