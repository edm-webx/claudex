/**
 * Render pipeline: reproduces the v2 look 1:1 (game.js renderer setup + world.js light/fog/sky/time of day/shadows).
 * Owns the Scene, the camera rig, hemisphere + sun lights, fog and the sky dome. Zones and views add their roots.
 * Decisions where MOTOR/CONTRACT are silent:
 * - The renderer is created in createRender when `deps.canvas` is given (init() with the same canvas is then a no-op),
 *   so `render.scene`/`render.camera` are usable right away. WebGL failure throws (boot shows #fail / fallback).
 * - setTier: antialias is a context attribute and cannot change on a live canvas; an AA change is stored and applies
 *   on the next page load (v2 did the same: AA was decided once from guessTier). Pixel ratio, shadows apply live.
 * - Extras beyond RenderPipeline (typed as MotorRender): onTime(cb) for views that tint their own materials (sea,
 *   night glow), tod()/night/hour/phase, horizon (camera sees the horizon; skyline culling), setFocus(x, z)
 *   (shadow box follows the camera, also done automatically every 10 frames like v2), sun/hemi/sky handles.
 * - Context loss: the canvas events pause rendering; three re-uploads geometry/textures from their CPU copies on the
 *   next frame after restore (all our textures are canvas/image backed), so nothing has to be rebuilt by hand.
 */
import * as T from 'three';
import type { RenderPipeline, RenderDeps, TierDef, Season, WeatherState, RenderInfo, Vec3, ScreenPt, Disposer, DayPhase } from '../api';
import { createCameraRig, type MotorCameraRig } from '../camera';
import { makeSky } from './sky';
import { todAt, phaseAt, type Tod } from './tod';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export { todAt, phaseAt, TOD } from './tod';
export type { Tod } from './tod';

export interface MotorRender extends RenderPipeline {
  readonly camera: MotorCameraRig;
  onTime(cb: (tod: Tod, hour: number) => void): Disposer;
  tod(): Tod;
  readonly hour: number;
  readonly night: number;
  readonly phase: DayPhase;
  /** True when the camera can see the horizon (wide/intro shots); updated during each frame (v2 rule). */
  readonly horizon: boolean;
  readonly sun: T.DirectionalLight;
  readonly hemi: T.HemisphereLight;
  readonly sky: T.Mesh;
  readonly tier: TierDef | null;
  setFocus(x: number, z: number): void;
  readonly frameNo: number;
  readonly lost: boolean;
  /** Sky-based environment map (PMREM, refreshed every half game hour); null before the renderer exists. */
  onEnv(cb: (tex: T.Texture | null) => void): Disposer;
  readonly bloomOn: boolean;
  /** PRF-08: outdoor hemisphere multiplier (night-lights eases it to 0.85 inside a room); setTime and hava-look multiply it in. */
  hemiMul: number;
  /** PRF-12: dynamic resolution; multiplies the tier's pixel ratio (0.6..1). Resizes targets only, no shader relink. */
  setScale(s: number): void;
  /** PRF-03: parallel shader compile of everything visible, in both shadow states (so a later tier change links nothing). Never draws. */
  warm(sc: T.Scene, cam: T.Camera): Promise<void>;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Display-space colour grade after OutputPass: saturation, contrast around mid grey, tint, soft vignette. */
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: 1.1 }, uCon: { value: 1.06 }, uTint: { value: new T.Vector3(1, 1, 1) }, uVig: { value: 0.2 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uCon; uniform vec3 uTint; uniform float uVig; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uCon + 0.5;
  col *= uTint;
  vec2 d = vUv - 0.5; col *= 1.0 - uVig * smoothstep(0.35, 0.85, length(d * vec2(1.25, 1.0)));
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
};

export function createRender(deps: RenderDeps): MotorRender {
  const scene = new T.Scene();
  scene.name = 'scene';
  scene.background = new T.Color('#bfe3f7');
  scene.fog = new T.Fog('#c6e3f2', 70, 190);
  const env = new T.Group(); env.name = 'env'; scene.add(env);
  const rig = createCameraRig({ aspect: 1 });

  // v2 world.js light rig
  const hemi = new T.HemisphereLight('#dcefff', '#9a8a74', 1.45); hemi.name = 'hemi'; env.add(hemi);
  const sun = new T.DirectionalLight('#fff4e2', 2.3); sun.name = 'sun'; env.add(sun, sun.target);
  const focus = new T.Vector3(-0.8, 0, -3.5), sunDir = new T.Vector3(0.3, 0.8, 0.4).normalize();
  const placeSun = () => { sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 32); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); };
  placeSun();

  const sky = makeSky(); sky.userData.parity = 'sky'; env.add(sky);
  let horizon = true;
  {
    const skyOBR = sky.onBeforeRender.bind(sky), fwd = new T.Vector3();
    sky.onBeforeRender = (r, s, cam, g, m, gr) => {
      skyOBR(r, s, cam, g, m, gr);
      cam.getWorldDirection(fwd);
      const half = (cam as T.PerspectiveCamera).isPerspectiveCamera ? (cam as T.PerspectiveCamera).fov * Math.PI / 360 : 0.6;
      horizon = Math.asin(Math.max(-1, Math.min(1, -fwd.y))) - half < 0.12;
    };
  }

  let renderer: T.WebGLRenderer | null = null;
  // PRF-01: GPU frame time via EXT_disjoint_timer_query_webgl2 (only while the perf recorder is on; absent = not measured).
  let progSeen = 0;
  let gl2: WebGL2RenderingContext | null = null, gpuExt: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  let gpuQ: WebGLQuery | null = null; const gpuPending: WebGLQuery[] = [];
  const gpuBegin = () => { if (!gl2 || !gpuExt || gpuQ || gpuPending.length > 4) return; try { gpuQ = gl2.createQuery(); if (gpuQ) gl2.beginQuery(gpuExt.TIME_ELAPSED_EXT, gpuQ); } catch { gpuQ = null; } };
  const gpuEnd = () => { if (!gl2 || !gpuExt || !gpuQ) return; try { gl2.endQuery(gpuExt.TIME_ELAPSED_EXT); gpuPending.push(gpuQ); } catch { /* ignore */ } gpuQ = null; };
  const gpuPoll = () => {
    if (!gl2 || !gpuExt) return;
    while (gpuPending.length) {
      const q = gpuPending[0];
      try {
        if (!gl2.getQueryParameter(q, gl2.QUERY_RESULT_AVAILABLE)) break;
        const bad = gl2.getParameter(gpuExt.GPU_DISJOINT_EXT);
        if (!bad) deps.perf?.gpu(gl2.getQueryParameter(q, gl2.QUERY_RESULT) / 1e6);
        gl2.deleteQuery(q);
      } catch { /* ignore */ }
      gpuPending.shift();
    }
  };
  let canvasEl: HTMLCanvasElement | null = null;
  let tier: TierDef | null = null;
  let wantAA: boolean | null = null;
  let hour = 11, tod = todAt(11), night = 0;
  let frameNo = 0, lost = false, resScale = 1;
  const timeSubs = new Set<(t: Tod, h: number) => void>();
  const lostSubs = new Set<() => void>(), restoredSubs = new Set<() => void>();
  let loseExt: { loseContext(): void; restoreContext(): void } | null = null;
  const lastInfo: RenderInfo = { calls: 0, tris: 0, geos: 0, texs: 0 };

  // post-process (tier flag `bloom`): MSAA half-float target -> bloom -> OutputPass (tone mapping + sRGB)
  let composer: EffectComposer | null = null, rpass: RenderPass | null = null, bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null;
  function setupPost(t: TierDef) {
    const want = !!(renderer && t.flags && t.flags.bloom);
    if (!want) { if (composer) { composer.dispose(); composer = null; rpass = null; bloom = null; grade = null; } return; }
    if (composer) return;
    const { w, h } = size(), pr = renderer!.getPixelRatio();
    const target = new T.WebGLRenderTarget(Math.round(w * pr), Math.round(h * pr), { type: T.HalfFloatType, samples: t.antialias ? 4 : 0 });
    composer = new EffectComposer(renderer!, target);
    rpass = new RenderPass(scene, rig.camera); composer.addPass(rpass);
    bloom = new UnrealBloomPass(new T.Vector2(w, h), 0.22, 0.4, 0.92); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE); composer.addPass(grade);
    composer.setPixelRatio(pr); composer.setSize(w, h);
    tuneBloom();
  }
  function tuneBloom() {
    if (grade) {   // colour grade follows the day: warm golden hour, cool blue night
      const u = grade.uniforms, gold = clamp(1 - Math.abs(hour - 18.5) / 2.2, 0, 1) * (1 - night);
      u.uSat.value = 1.06 - 0.1 * night; u.uCon.value = 1.03;
      u.uTint.value.set(1 + 0.05 * gold - 0.04 * night, 1 + 0.01 * gold - 0.01 * night, 1 - 0.05 * gold + 0.06 * night);
      u.uVig.value = 0.2 + 0.12 * night;
    }
    if (!bloom) return; bloom.strength = 0.1 + 0.22 * night; bloom.threshold = 0.97 - 0.12 * night; bloom.radius = 0.3 + 0.08 * night; }   // 2026-11-08 user: glare made in-game text unreadable

  // sky environment map (PMREM from the sky dome): reflections on standard materials (Kenney models, metal props)
  let pmrem: T.PMREMGenerator | null = null, envRT: T.WebGLRenderTarget | null = null, envKey = -1;
  const envSubs = new Set<(t: T.Texture | null) => void>();
  function refreshEnv() {
    if (!renderer) return;
    // PRF-08 (B-082): akıcı re-renders the PMREM sky every 2 game hours instead of every half hour (reflections still follow day/night)
    const key = tier?.name === 'akici' ? 1000 + Math.round(hour / 2) : Math.round(hour * 2); if (key === envKey && envRT) return; envKey = key;
    pmrem ||= new T.PMREMGenerator(renderer);
    const s = new T.Scene(); s.add(new T.Mesh(sky.geometry, sky.material));
    const old = envRT; envRT = pmrem.fromScene(s, 0.02);
    envSubs.forEach(cb => { try { cb(envRT!.texture); } catch (err) { deps.log?.warn('[render] env cb', err); } });
    if (old) old.dispose();
  }

  // screen-space pick list (no mesh raycast)
  const picks = new Map<string, { p: T.Vector3; r: number }>();
  const _v = new T.Vector3(), _v2 = new T.Vector3();

  function size(): { w: number; h: number } {
    const c = canvasEl;
    const w = (c && c.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 390) || 390;
    const h = (c && c.clientHeight) || (typeof window !== 'undefined' ? window.innerHeight : 844) || 844;
    return { w, h };
  }

  function applyShadows(t: TierDef) {
    const sh = !!t.shadows, sz = t.shadowSize || 1024, ext = sz >= 2048 ? 17 : 15;
    sun.castShadow = sh;
    if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); (sun.shadow as { map: T.WebGLRenderTarget | null }).map = null; } }
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035;
    // PRF-03: renderer.shadowMap.enabled stays true for the whole session (set in init). Flipping it forced
    // scene.traverse(needsUpdate) = every material re-linked on a tier change (seconds of freeze on ANGLE). Now only the
    // sun's castShadow follows the tier; three re-evaluates its light hash by itself. A shadow-off tier frees the map.
    if (!sh && sun.shadow.map) { sun.shadow.map.dispose(); (sun.shadow as { map: T.WebGLRenderTarget | null }).map = null; }
  }

  const api: MotorRender = {
    scene,
    camera: rig,
    get renderer() { return renderer; },
    get hour() { return hour; },
    get night() { return night; },
    get phase() { return phaseAt(hour); },
    get horizon() { return horizon; },
    get tier() { return tier; },
    get frameNo() { return frameNo; },
    get lost() { return lost; },
    sun, hemi, sky,
    get bloomOn() { return !!composer; },
    hemiMul: 1,
    onEnv(cb) { envSubs.add(cb); try { cb(envRT ? envRT.texture : null); } catch { /* ignore */ } return () => { envSubs.delete(cb); }; },
    init(canvas: HTMLCanvasElement, t: TierDef) {
      if (renderer && canvasEl === canvas) { api.setTier(t); return; }
      canvasEl = canvas;
      renderer = new T.WebGLRenderer({ canvas, antialias: !!t.antialias, powerPreference: 'high-performance' });
      // 2026-11-09 Chrome freeze root cause: with checkShaderErrors on, three calls getProgramInfoLog for every new
      // program right after linking, which blocks the main thread until the GPU process finishes compiling (no parallel
      // compile). On Windows/ANGLE that was seconds per new area. Errors are only checked in dev builds now.
      renderer.debug.checkShaderErrors = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
      try {
        const c = renderer.getContext();
        if (typeof WebGL2RenderingContext !== 'undefined' && c instanceof WebGL2RenderingContext) { gl2 = c; gpuExt = c.getExtension('EXT_disjoint_timer_query_webgl2') as typeof gpuExt; }
        const dbg = c.getExtension('WEBGL_debug_renderer_info');
        deps.perf?.meta('gpu', dbg ? String(c.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'bilinmiyor');
        deps.perf?.meta('gpuZamanOlcer', gpuExt ? 'var' : 'yok');
      } catch { /* headless */ }
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.98;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.enabled = true;
      wantAA = !!t.antialias;
      try { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); } catch { loseExt = null; }
      canvas.addEventListener('webglcontextlost', (e: Event) => { e.preventDefault(); lost = true; lostSubs.forEach(cb => { try { cb(); } catch (err) { deps.log?.warn('[render] lost cb', err); } }); }, false);
      canvas.addEventListener('webglcontextrestored', () => { lost = false; if (tier) applyShadows(tier); restoredSubs.forEach(cb => { try { cb(); } catch (err) { deps.log?.warn('[render] restored cb', err); } }); }, false);
      api.setTier(t);
    },
    setTier(t: TierDef) {
      tier = t;
      if (wantAA !== null && !!t.antialias !== wantAA) deps.log?.info('[render] antialias change applies on next load');
      applyShadows(t);
      if (renderer) renderer.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, t.pixelRatio) * resScale);
      setupPost(t);
      api.resize();
    },
    setTime(h: number, _season?: Season) {
      hour = clamp(+h || 12, 8, 24);
      tod = todAt(hour); night = tod.n;
      const su = (sky.material as T.ShaderMaterial).uniforms;
      su.uTop.value.copy(tod.top); su.uHor.value.copy(tod.hor); su.uLow.value.copy(tod.low); su.uSunCol.value.copy(tod.sun); su.uNight.value = night;
      sunDir.set(Math.sin(tod.az) * Math.cos(tod.el), Math.sin(tod.el), Math.cos(tod.az) * Math.cos(tod.el)).normalize();
      su.uSunDir.value.copy(sunDir); placeSun();
      sun.color.copy(tod.sun); sun.intensity = tod.si;
      hemi.color.copy(tod.hs); hemi.groundColor.copy(tod.hg); hemi.intensity = tod.hi * api.hemiMul;
      (scene.fog as T.Fog).color.copy(tod.fog);
      tuneBloom();
      timeSubs.forEach(cb => { try { cb(tod, hour); } catch (err) { deps.log?.warn('[render] time cb', err); } });
    },
    setWeather(_w: WeatherState) { /* M5 */ },
    onTime(cb) { timeSubs.add(cb); try { cb(tod, hour); } catch { /* ignore */ } return () => { timeSubs.delete(cb); }; },
    tod: () => tod,
    setFocus(x: number, z: number) {
      // 2026-11-08: shadows follow the camera over the whole map (far shore too), snapped to the shadow texel grid
      const sz = (tier && tier.shadowSize) || 1024, ext = sz >= 2048 ? 17 : 15, step = (2 * ext) / sz * 4;
      const fx = clamp(+x || 0, -70, 70), fz = clamp(+z || 0, -20, 62);
      focus.set(Math.round(fx / step) * step, 0, Math.round(fz / step) * step); placeSun();
    },
    frame(sc: T.Scene, cam: T.Camera) {
      if (!renderer || lost) return;
      frameNo++;
      if (frameNo % 10 === 1) { const f = rig.focus(); api.setFocus(f.x, f.z); }
      if (frameNo % 30 === 2 || !envRT) refreshEnv();
      renderer.info.autoReset = false; renderer.info.reset();   // info() = everything drawn for this frame (composer passes, shadow pass)
      const draw = () => { if (composer && rpass) { rpass.scene = sc; rpass.camera = cam; composer.render(); } else renderer!.render(sc, cam); };
      const pf = deps.perf;
      if (pf) {
        const rec = pf.recording;
        if (rec) gpuBegin();
        pf.time('render.draw', draw);
        if (rec) { gpuEnd(); gpuPoll(); }
        const np = (renderer.info as { programs?: unknown[] }).programs?.length ?? 0;
        if (np > progSeen) { if (progSeen > 0) pf.mark('compile', `${np - progSeen} shader, toplam ${np}`); progSeen = np; }
      } else draw();
      const ri = renderer.info;
      lastInfo.calls = ri.render.calls; lastInfo.tris = ri.render.triangles;
      lastInfo.geos = ri.memory.geometries; lastInfo.texs = ri.memory.textures;
    },
    setScale(v: number) {
      const nv = clamp(+v || 1, 0.5, 1);
      if (nv === resScale) return;
      resScale = nv;
      if (renderer && tier) { renderer.setPixelRatio(Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, tier.pixelRatio) * resScale); api.resize(); }
    },
    warm(sc: T.Scene, cam: T.Camera) {
      const r = renderer as unknown as { compileAsync?: (s: T.Scene, c: T.Camera) => Promise<unknown> } | null;
      if (!r || !r.compileAsync || lost) return Promise.resolve();
      const was = sun.castShadow, jobs: Promise<unknown>[] = [];
      try {
        jobs.push(r.compileAsync(sc, cam));
        // the other shadow state too: three keys programs by the shadow-casting light count, and the sync part of compileAsync reads it right now
        if (tier && tier.name !== 'akici') { sun.castShadow = !was; jobs.push(r.compileAsync(sc, cam)); }
      } catch (err) { deps.log?.warn('[render] warm', err); }
      sun.castShadow = was;
      return Promise.all(jobs).then(() => undefined, () => undefined);
    },
    info() {
      if (renderer) { lastInfo.geos = renderer.info.memory.geometries; lastInfo.texs = renderer.info.memory.textures; }
      return { ...lastInfo, programs: renderer ? ((renderer.info as { programs?: unknown[] }).programs?.length ?? 0) : 0, programNames: renderer ? ((renderer.info as { programs?: { name: string; cacheKey: string }[] }).programs || []).filter(Boolean).map(p => p.name + '|' + (p.cacheKey || '').length) : [] };
    },
    resize() {
      const { w, h } = size();
      if (renderer) renderer.setSize(w, h, false);
      if (composer && renderer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
      rig.setAspect(w / h);
    },
    registerPick(id: string, p: Vec3, radius: number) {
      picks.set(id, { p: new T.Vector3(p.x, p.y, p.z), r: radius });
      return () => { picks.delete(id); };
    },
    updatePick(id: string, p: Vec3) { const e = picks.get(id); if (e) e.p.set(p.x, p.y, p.z); },
    pick(sp: ScreenPt) {
      const { w, h } = size(); const cam = rig.camera;
      let best: string | null = null, bestD = Infinity;
      picks.forEach((e, id) => {
        _v.copy(e.p).project(cam); if (_v.z > 1) return;
        const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h;
        // screen radius: project a point offset by r along camera right
        _v2.set(e.p.x + e.r, e.p.y, e.p.z).project(cam);
        const rpx = Math.max(18, Math.abs((_v2.x * 0.5 + 0.5) * w - sx));
        const d = Math.hypot(sp.x - sx, sp.y - sy);
        if (d <= rpx && d < bestD) { bestD = d; best = id; }
      });
      return best;
    },
    worldToScreen(p: Vec3, out: ScreenPt) {
      const { w, h } = size();
      _v.set(p.x, p.y, p.z).project(rig.camera);
      out.x = (_v.x * 0.5 + 0.5) * w; out.y = (-_v.y * 0.5 + 0.5) * h;
      return _v.z <= 1 && _v.z >= -1;
    },
    onContextLost(cb) { lostSubs.add(cb); return () => { lostSubs.delete(cb); }; },
    onContextRestored(cb) { restoredSubs.add(cb); return () => { restoredSubs.delete(cb); }; },
    loseContext() { if (loseExt) loseExt.loseContext(); },
    restoreContext() { if (loseExt) loseExt.restoreContext(); },
    dispose() {
      timeSubs.clear(); picks.clear();
      if (renderer) { renderer.dispose(); renderer = null; }
    },
  };
  if (deps.perf) deps.perf.source('render', () => ({ ...api.info() }));
  if (deps.canvas) api.init(deps.canvas, deps.quality.current());
  api.setTime(11);
  return api;
}
