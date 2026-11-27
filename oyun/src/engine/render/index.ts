/**
 * Render pipeline: reproduces the v2 look 1:1 (game.js renderer setup + world.js light/fog/sky/time of day/shadows).
 * Owns the Scene, the camera rig, hemisphere + sun lights, fog and the sky dome. Zones and views add their roots.
 * Decisions where MOTOR/CONTRACT are silent:
 * - The renderer is created in createRender when `deps.canvas` is given (init() with the same canvas is then a no-op),
 *   so `render.scene`/`render.camera` are usable right away. WebGL failure throws (boot shows #fail / fallback).
 * - setTier: GRS-17: antialias is the composer target's MSAA (live), not a canvas attribute; the post chain, shadow map and
 *   sun.castShadow are the same in every tier, so a tier change relinks no program. Pixel ratio, shadows apply live.
 * - Extras beyond RenderPipeline (typed as MotorRender): onTime(cb) for views that tint their own materials (sea,
 *   night glow), tod()/night/hour/phase, horizon (camera sees the horizon; skyline culling), setFocus(x, z)
 *   (shadow box follows the camera, also done automatically every 10 frames like v2), sun/hemi/sky handles.
 * - Context loss: the canvas events pause rendering; three re-uploads geometry/textures from their CPU copies on the
 *   next frame after restore (all our textures are canvas/image backed), so nothing has to be rebuilt by hand.
 */
import * as T from 'three';
import type { RenderPipeline, RenderDeps, TierDef, Season, WeatherState, RenderInfo, Vec3, ScreenPt, Disposer, DayPhase } from '../api';
import { DAY_START_H, DAY_END_H } from '../api';
import { createCameraRig, type MotorCameraRig } from '../camera';
import { makeSky } from './sky';
import { createShadowCull } from './shadow-cull';
import { createWarmGate } from './warm-gate';
import { createLookRenderer, lookAt, LOOK_POZ, AKICI_POZ, installLookToneMap } from './look';
import { todAt, phaseAt, DAWN_EXTRA, type Tod } from './tod';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { akisGuncelle } from './doku-akis';
import { groundRadius, nextShadowExt } from './shadow-fit';
import { renderScale } from '../quality';
import { createReflector, reflectBudget, REFLECT_LAYER, type Reflector } from './reflect';

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
  /** GRS-01: light colour multiplier for the akıcı grade (golden hour / night tint without the GRADE pass); [1,1,1] when GRADE runs */
  readonly lightTint: readonly [number, number, number];
  /** GRS-02: weather saturation multiplier for the GRADE pass (hava-look: rain / fog / snow wash the colours a little); 1 = clear */
  weatherSat: number;
  /** PRF-06: leave out shadow casters whose shadow cannot reach the camera view (default on; off only for A/B measurement) */
  shadowCull: boolean;
  shadowStats(): { casters: number; culled: number };
  /** GRS-05: planar water reflection. The sea view hands over its mesh (hidden during the mirrored pass) and reads texture/matrix/on each frame. */
  readonly reflector: Reflector;
  reflectSea: T.Object3D | null;
  /** PRF-12: dynamic resolution; multiplies the tier's pixel ratio (0.6..1). Resizes targets only, no shader relink. */
  setScale(s: number): void;
  /** PRF-12: bloom pass on/off inside the existing composer (pass.enabled; no relink, no target rebuild). */
  setPostCut(cut: boolean): void;
  /** PRF-03: parallel shader compile of everything visible, in both shadow states (so a later tier change links nothing). Never draws. */
  warm(sc: T.Scene, cam: T.Camera): Promise<void>;
  /** PRF-03: programs born in warm() vs inside a frame (blocking), a warm still compiling, and the last frame-born program names */
  warmStats(): { born: { draw: number; warm: number }; busy: boolean; lastDrawBorn: string[] };
  /** GRS-17: what the current tier really switched on (test hook 'gfx') */
  gfxState(): Record<string, unknown>;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const NO_TINT = [1, 1, 1] as const;

/** PRF-03: OutputPass picks its defines inside its first render() (a define change = relink inside the frame). Same rule as
 *  three 0.160 OutputPass.render, done ahead so warm() compiles the program the first frame really uses. */
function primeOutputPass(op: OutputPass, r: T.WebGLRenderer): void {
  const o = op as unknown as { _outputColorSpace: string | null; _toneMapping: T.ToneMapping | null; material: T.ShaderMaterial };
  if (o._outputColorSpace === r.outputColorSpace && o._toneMapping === r.toneMapping) return;
  o._outputColorSpace = r.outputColorSpace; o._toneMapping = r.toneMapping;
  const d: Record<string, string> = {};
  if (T.ColorManagement.getTransfer(r.outputColorSpace) === T.SRGBTransfer) d.SRGB_TRANSFER = '';
  const tm: Partial<Record<T.ToneMapping, string>> = { [T.LinearToneMapping]: 'LINEAR', [T.ReinhardToneMapping]: 'REINHARD', [T.CineonToneMapping]: 'CINEON', [T.ACESFilmicToneMapping]: 'ACES_FILMIC', [T.AgXToneMapping]: 'AGX' };
  const k = tm[r.toneMapping]; if (k) d[k + '_TONE_MAPPING'] = '';
  o.material.defines = d; o.material.needsUpdate = true;
}

/** Display-space colour grade after OutputPass: saturation, contrast around a pivot, tint, soft vignette (values: look.ts lookAt). */
const L0 = lookAt(11, 0);
const GRADE = {
  uniforms: { tDiffuse: { value: null }, uSat: { value: L0.sat }, uCon: { value: L0.con }, uPiv: { value: L0.pivot }, uTint: { value: new T.Vector3(...L0.tint) }, uVig: { value: L0.vig } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat; uniform float uCon; uniform float uPiv; uniform vec3 uTint; uniform float uVig; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  col = (col - uPiv) * uCon + uPiv;
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
  // GRS-05: three r160 culls lights by camera layers too; the mirrored pass needs the same light set (lit, and no second program variant)
  hemi.layers.enable(REFLECT_LAYER); sun.layers.enable(REFLECT_LAYER);
  const focus = new T.Vector3(-0.8, 0, -3.5), sunDir = new T.Vector3(0.3, 0.8, 0.4).normalize();
  const placeSun = () => { sun.target.position.copy(focus); sun.position.copy(focus).addScaledVector(sunDir, 32); sun.target.updateMatrixWorld(); sun.updateMatrixWorld(); };
  placeSun();

  const sky = makeSky(); sky.userData.parity = 'sky'; env.add(sky);
  let horizon = true;
  {
    const skyOBR = sky.onBeforeRender.bind(sky), fwd = new T.Vector3();
    sky.onBeforeRender = (r, s, cam, g, m, gr) => {
      skyOBR(r, s, cam, g, m, gr);
      if (cam === reflector.camera) return;   // GRS-05: the mirrored pass looks up through the water; horizon stays the player's
      cam.getWorldDirection(fwd);
      const half = (cam as T.PerspectiveCamera).isPerspectiveCamera ? (cam as T.PerspectiveCamera).fov * Math.PI / 360 : 0.6;
      horizon = Math.asin(Math.max(-1, Math.min(1, -fwd.y))) - half < 0.12;
    };
  }

  let renderer: T.WebGLRenderer | null = null;
  // PRF-01: GPU frame time via EXT_disjoint_timer_query_webgl2 (only while the perf recorder is on; absent = not measured).
  // PRF-03: every shader program three links is counted once, by where it was born: 'warm' (compileAsync, parallel, off the
  // frame) or 'draw' (first sight inside a frame = the blocking compile that froze Chrome). Target in play: draw births = 0.
  const seenProg = new WeakSet<object>(), born = { draw: 0, warm: 0 }, lastDrawBorn: string[] = [];
  const keyHash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };
  const progNames = new WeakMap<object, string>();
  const progName = (pg: { name: string; cacheKey: string }) => { let s = progNames.get(pg); if (!s) { s = (pg.name || '') + '#' + keyHash(pg.cacheKey || ''); progNames.set(pg, s); } return s; };
  const progList = () => ((renderer?.info as { programs?: { name: string; cacheKey: string }[] } | undefined)?.programs || []);
  const scanProgs = (kind: 'draw' | 'warm', sc?: T.Object3D) => {
    let n = 0; const fresh: object[] = [];
    for (const pg of progList()) {
      if (!pg || seenProg.has(pg)) continue;
      seenProg.add(pg); n++; born[kind]++;
      if (kind === 'draw') fresh.push(pg);
    }
    // a frame-born program is rare (that is the bug): name who owns it (object path + material) for the perf record
    if (fresh.length && sc && renderer) {
      const pr = renderer.properties, who = new Map<object, string>();
      sc.traverse(o => { const mt = (o as T.Mesh).material; if (!mt) return; for (const m of Array.isArray(mt) ? mt : [mt]) { const cp = (pr.get(m) as { currentProgram?: object }).currentProgram; if (cp && fresh.includes(cp) && !who.has(cp)) { let path = o.name || o.type, q = o.parent; for (let k = 0; q && k < 3; k++, q = q.parent) path = (q.name || q.type) + '/' + path; who.set(cp, path + ':' + m.type + (m.name ? '(' + m.name + ')' : '')); } } });
      for (const pg of fresh) { lastDrawBorn.push(progName(pg as { name: string; cacheKey: string }) + '@' + (who.get(pg) || 'geçiş/pmrem')); if (lastDrawBorn.length > 24) lastDrawBorn.shift(); }
    }
    return n;
  };
  let warmJobs = 0;
  // compileAsync against the target the frame really draws into (see warm()); `objs` = compile only these objects' materials
  // three 0.160 compileAsync polls properties.get(m).currentProgram.isReady() and throws (inside a setTimeout, so the promise never
  // settles) when a material was disposed while linking: a streamed zone left again within the compile window (PRF-07 pop-in
  // probe, 2026-11-21). The warm job then stayed busy forever and its meshes waited for the 3 s gate safety. Same steps, but a
  // material without a program any more counts as done.
  const compileSafe = (s: T.Object3D, c: T.Camera, target?: T.Scene | null): Promise<unknown> => {
    const rr = renderer as unknown as { compile(s: T.Object3D, c: T.Camera, t?: T.Scene | null): Set<T.Material>; properties: { get(m: object): { currentProgram?: { isReady(): boolean } } }; extensions: { get(n: string): unknown } };
    const mats = rr.compile(s, c, target ?? null);
    return new Promise<void>(resolve => {
      const check = () => {
        mats.forEach(m => { const cp = rr.properties.get(m).currentProgram; if (!cp || cp.isReady()) mats.delete(m); });
        if (!mats.size) { resolve(); return; }
        setTimeout(check, 10);
      };
      if (rr.extensions.get('KHR_parallel_shader_compile') !== null) check(); else setTimeout(check, 10);
    });
  };
  const compileFor = (sc: T.Scene, cam: T.Camera, objs: T.Object3D[] | null): Promise<unknown> => {
    const r = renderer ? { compileAsync: compileSafe } : null;
    if (!r || lost) return Promise.resolve();
    const rt = composer && rpass ? (composer as unknown as { readBuffer: T.WebGLRenderTarget }).readBuffer : null, prevRt = renderer!.getRenderTarget();
    let job: Promise<unknown> = Promise.resolve();
    try {
      if (rt) renderer!.setRenderTarget(rt);
      // a list: duck-typed root whose traverse walks only the new objects (no lights in it, so the light state of `sc` stays exact)
      job = objs ? r.compileAsync({ traverse: (cb: (o: T.Object3D) => void) => objs.forEach(cb), traverseVisible: () => { /* lights come from sc */ } } as unknown as T.Object3D, cam, sc) : r.compileAsync(sc, cam);
      // full warm: the post passes too (bloom blur/composite, OutputPass, grade). Their full-screen quads are not in the scene,
      // so they used to link inside the first frame. The pass that draws to the screen compiles against the screen.
      if (!objs) pmrem ||= new T.PMREMGenerator(renderer!);   // its blur shader starts linking now, not inside the first env refresh
      if (!objs && composer) {
        const toScreen = new T.Scene(), toTarget = new T.Scene(), quad = new T.PlaneGeometry(2, 2);
        const last = composer.passes.filter(ps => ps.enabled).pop();   // the composer sets renderToScreen only while rendering
        for (const ps of composer.passes) {
          if (ps instanceof OutputPass) primeOutputPass(ps, renderer!);
          const mats = new Set<T.Material>();
          for (const v of Object.values(ps as unknown as Record<string, unknown>)) {
            const list = Array.isArray(v) ? v : [v, (v as { material?: unknown } | null)?.material];
            for (const m of list) if (m && (m as T.Material).isMaterial) mats.add(m as T.Material);
          }
          mats.forEach(m => (ps === last ? toScreen : toTarget).add(new T.Mesh(quad, m)));
        }
        const jobs = [job];
        if (toTarget.children.length) jobs.push(r.compileAsync(toTarget, cam));
        if (toScreen.children.length) { renderer!.setRenderTarget(null); jobs.push(r.compileAsync(toScreen, cam)); }
        job = Promise.all(jobs).finally(() => quad.dispose());
      }
    } catch (err) { deps.log?.warn('[render] warm', err); }
    finally { if (rt || composer) renderer!.setRenderTarget(prevRt); }
    scanProgs('warm');
    warmJobs++;
    return job.then(() => { warmJobs--; }, () => { warmJobs--; });
  };
  // PRF-03 gate: new meshes whose program is not linked yet wait off-camera until compileAsync is done (warm-gate.ts)
  const gate = createWarmGate();
  let gateUntil = 0, gateN = 0;
  const gateStep = (sc: T.Scene, cam: T.Camera) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (gate.held() && now > gateUntil) gate.release();   // safety: never hide anything longer than 3 s
    if (!gate.dirty() || !renderer) return;
    const pr = renderer.properties;
    type Prog = { isReady(): boolean };
    const got = gate.collect(sc, m => !(pr.get(m) as { currentProgram?: Prog }).currentProgram);
    if (!got.length) return;
    gateUntil = now + 3000;
    void compileFor(sc, cam, got).then(() => { gate.release(got); });
    // a new material instance whose program already exists (cache hit) is ready right after the sync part: show it this frame,
    // only objects whose program is really still linking wait (else a view that respawns meshes would blink for a frame)
    const ready = got.filter(o => { const mt = (o as T.Mesh).material; return (Array.isArray(mt) ? mt : [mt]).every(m => { const cp = (pr.get(m) as { currentProgram?: Prog }).currentProgram; return !!cp && cp.isReady(); }); });
    if (ready.length) gate.release(ready);
    if (got.length > ready.length) { gateN += got.length - ready.length; deps.perf?.count('shaderBekletilen', gateN); }
  };
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
  let hour = 11, tod = todAt(11), night = 0;
  let frameNo = 0, lost = false, resScale = 1, postCut = false;
  // PRF-12: on a post-chain tier (bloom) the dynamic resolution scale shrinks only the composer's targets: the scene is drawn
  // smaller and the last full-screen pass (GRADE) stretches it to the full canvas with linear filtering. Resizing the canvas
  // itself is a synchronous drawing-buffer reallocation (1-16 s per step in headless SwiftShader, olcek-gecis.mjs) and it was
  // done twice per step (setPixelRatio + resize). Akıcı has no post chain, so its canvas still follows the scale, once.
  const basePR = (t: TierDef) => renderScale(t, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);   // GRS-17: tier floor on DPR 1 screens
  // GRS-17: the post chain runs in EVERY tier when the GPU can (WebGL2 + float colour buffer): the same program path in all tiers, so a
  // tier change relinks nothing (screen vs target toneMapping is in every program key). Akıcı only switches the bloom pass off and
  // gets the GRADE look too. Without float targets the old direct path stays (tier changes then relink; logged once).
  let postOk = false;
  const postTier = (t: TierDef) => postOk || !!(t.flags && t.flags.bloom);
  const canvasPR = (t: TierDef) => postTier(t) ? basePR(t) : basePR(t) * resScale;
  const _rs = new T.Vector2();
  const timeSubs = new Set<(t: Tod, h: number) => void>();
  const lostSubs = new Set<() => void>(), restoredSubs = new Set<() => void>();
  let loseExt: { loseContext(): void; restoreContext(): void } | null = null;
  const lastInfo: RenderInfo = { calls: 0, tris: 0, geos: 0, texs: 0 };
  /** GRS-05: last frame's mirrored pass (calls/tris it added, main-pass calls before it); `ever` = a target was ever drawn */
  const reflInfo = { ran: false, ever: false, calls: 0, tris: 0, main: 0 };

  // post-process (tier flag `bloom`): MSAA half-float target -> bloom -> OutputPass (tone mapping + sRGB)
  let composer: EffectComposer | null = null, rpass: RenderPass | null = null, bloom: UnrealBloomPass | null = null, grade: ShaderPass | null = null, fxaa: ShaderPass | null = null;
  // 2026-11-25 public çıkış: akıcı (no MSAA) had no AA at all = jagged edges on every silhouette; a last FXAA pass smooths them there only
  const fxaaSize = () => { if (!fxaa || !composer) return; const rb = (composer as unknown as { readBuffer: T.WebGLRenderTarget }).readBuffer; fxaa.uniforms.resolution.value.set(1 / Math.max(1, rb.width), 1 / Math.max(1, rb.height)); };
  function setupPost(t: TierDef) {
    const want = !!renderer && postTier(t);
    // PRF-15: EffectComposer.dispose frees only its own two targets; the bloom pass keeps ~10 half-float mip targets and every
    // pass its material, so each switch to a no-bloom tier leaked them on the GPU. Passes are disposed first now.
    // GRS-01: without the post chain (akıcı) the grade runs inside tone mapping (look.ts CustomToneMapping); with it, ACES + GRADE pass
    if (renderer) { renderer.toneMapping = want ? T.ACESFilmicToneMapping : T.CustomToneMapping; renderer.toneMappingExposure = want ? LOOK_POZ.ana : LOOK_POZ.ana * AKICI_POZ; }
    if (!want) { if (composer) { composer.passes.forEach(ps => { try { ps.dispose(); } catch { /* */ } }); composer.dispose(); composer = null; rpass = null; bloom = null; grade = null; fxaa = null; } return; }
    if (composer) {
      if (bloom) bloom.enabled = !!t.flags?.bloom && !postCut;
      // GRS-17: MSAA follows the tier live (only the scene target is multisampled; samples are not in any program key)
      const rb = (composer as unknown as { renderTarget2: T.WebGLRenderTarget }).renderTarget2, ns = t.antialias ? 4 : 0;
      if (rb.samples !== ns) { rb.samples = ns; rb.dispose(); }
      if (fxaa) fxaa.enabled = !t.antialias;
      return;
    }
    const { w, h } = size(), pr = basePR(t) * resScale;
    const target = new T.WebGLRenderTarget(Math.round(w * pr), Math.round(h * pr), { type: T.HalfFloatType, samples: t.antialias ? 4 : 0 });
    composer = new EffectComposer(renderer!, target);
    // PRF-15: the composer clones its target, so both ping-pong buffers were 4x MSAA half-float with a depth buffer (~69 MB of
    // renderbuffers each at 1600x900). Only the scene pass needs that: it draws into readBuffer (rt2), the bloom pass blends back
    // into rt2, OutputPass writes rt1 and the grade quad reads rt1 to the screen. rt1 keeps the same half-float format (same
    // pixels) without MSAA and depth.
    { const c = composer as unknown as { renderTarget1: T.WebGLRenderTarget; writeBuffer: T.WebGLRenderTarget };
      const rt1 = new T.WebGLRenderTarget(target.width, target.height, { type: T.HalfFloatType, depthBuffer: false });
      rt1.texture.name = 'EffectComposer.rt1'; target.dispose(); c.renderTarget1 = rt1; c.writeBuffer = rt1; }
    rpass = new RenderPass(scene, rig.camera); composer.addPass(rpass);
    bloom = new UnrealBloomPass(new T.Vector2(w, h), 0.22, 0.4, 0.92); composer.addPass(bloom);
    composer.addPass(new OutputPass());
    grade = new ShaderPass(GRADE); composer.addPass(grade);
    fxaa = new ShaderPass(FXAAShader); fxaa.enabled = !t.antialias; composer.addPass(fxaa);
    composer.setPixelRatio(pr); composer.setSize(w, h); fxaaSize();
    tuneBloom();
    bloom.enabled = !!t.flags?.bloom && !postCut;
  }
  // 2026-11-27 epilepsi flaşı: the composer keeps its ping-pong order between frames. With FXAA on (akıcı: no MSAA) a frame had 3
  // swapping passes (OutputPass, GRADE, FXAA) = odd, so every other frame the scene was drawn into rt1 (no depth buffer): the
  // picture flipped between two images each frame (30-60 Hz strobe). The scene pass must always start on rt2 (MSAA + depth).
  const postBufOk = () => { const c = composer as unknown as { readBuffer: T.WebGLRenderTarget; renderTarget2: T.WebGLRenderTarget } | null; return !c || c.readBuffer === c.renderTarget2; };
  const postBufFix = () => { if (composer && !postBufOk()) composer.swapBuffers(); };
  let look = lookAt(hour, night);
  function tuneBloom() {
    look = lookAt(hour, night);   // colour grade follows the day: warm golden hour, cool blue night (look.ts)
    if (grade) {
      const u = grade.uniforms;
      u.uSat.value = look.sat; u.uCon.value = look.con; u.uPiv.value = look.pivot;
      u.uTint.value.set(look.tint[0], look.tint[1], look.tint[2]); u.uVig.value = look.vig;
    }
    // 2026-11-08 user: glare made in-game text unreadable (threshold floor 0.90 at night: a sign's glow does not swallow its text)
    if (!bloom) return; bloom.strength = look.bloom.strength; bloom.threshold = look.bloom.threshold; bloom.radius = look.bloom.radius; }

  // sky environment map (PMREM from the sky dome): reflections on standard materials (Kenney models, metal props)
  const sCull = createShadowCull();
  let pmrem: T.PMREMGenerator | null = null, envRT: T.WebGLRenderTarget | null = null, envKey = -1;
  const envSubs = new Set<(t: T.Texture | null) => void>();
  function refreshEnv() {
    if (!renderer) return;
    // PRF-08 (B-082): akıcı re-renders the PMREM sky every 2 game hours instead of every half hour (reflections still follow day/night)
    // GRS-17: a tier without `reflect` makes the PMREM once (envMap stays in the program key) and never refreshes it (envK = 0 there)
    const key = !tier?.flags?.reflect ? -2 : Math.round(hour * 2); if ((key === envKey || key === -2) && envRT) return; envKey = key;
    pmrem ||= new T.PMREMGenerator(renderer);
    const s = new T.Scene(); s.add(new T.Mesh(sky.geometry, sky.material));
    const old = envRT; envRT = pmrem.fromScene(s, 0.02);
    // PRF-15: the generator keeps its blur ping-pong target (768x1024 half float, 6 MB on the GPU) between regenerations, which
    // come every half game hour. Free its GPU copy now; three re-creates the framebuffer on the next fromScene (target object,
    // blur material and program stay, so no shader relink). three 0.160 private field.
    (pmrem as unknown as { _pingPongRenderTarget: T.WebGLRenderTarget | null })._pingPongRenderTarget?.dispose();
    envSubs.forEach(cb => { try { cb(envRT!.texture); } catch (err) { deps.log?.warn('[render] env cb', err); } });
    if (old) old.dispose();
  }

  // screen-space pick list (no mesh raycast)
  const picks = new Map<string, { p: T.Vector3; r: number }>();
  const _v = new T.Vector3(), _v2 = new T.Vector3();
  const reflector = createReflector(-1.0);   // WATER_Y of the iskele sea

  let offResize: (() => void) | null = null;
  function size(): { w: number; h: number } {
    const c = canvasEl;
    const w = (c && c.clientWidth) || (typeof window !== 'undefined' ? window.innerWidth : 390) || 390;
    const h = (c && c.clientHeight) || (typeof window !== 'undefined' ? window.innerHeight : 844) || 844;
    return { w, h };
  }

  // GRS-06: shadow box half size follows the camera's ground footprint (shadow-fit.ts), in steps with hysteresis
  let shadowExt = 15;
  function fitShadowBox(ext: number) {
    shadowExt = ext;
    if (tier && !tier.shadows) {
      // GRS-17: akıcı keeps castShadow (same programs in every tier: no relink on a tier change) but its 64 px map sees only the
      // empty 1..1.6 m slab right at the light, 32 m above the focus: nothing casts, every receiver is past the far plane = lit
      Object.assign(sun.shadow.camera, { left: -1, right: 1, top: 1, bottom: -1, near: 1, far: 1.6 }); sun.shadow.camera.updateProjectionMatrix();
      return;
    }
    const sz = (tier && tier.shadowSize) || 1024;
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 80 }); sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = 1.5 * (2 * ext / sz);   // 1.5 texel (was a fixed 0.035 = ~1.2 texel at ±15/1024)
  }
  function applyShadows(t: TierDef) {
    const sh = !!t.shadows, sz = sh ? t.shadowSize || 1024 : 64;
    sun.castShadow = true;
    if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); (sun.shadow as { map: T.WebGLRenderTarget | null }).map = null; } }
    sun.shadow.bias = -0.0005; fitShadowBox(shadowExt);
    // PRF-03: renderer.shadowMap.enabled stays true for the whole session (set in init). Flipping it forced
    // scene.traverse(needsUpdate) = every material re-linked on a tier change (seconds of freeze on ANGLE).
    // GRS-17: sun.castShadow too (it is in the program key: numDirLightShadows); the shadow-off look is the empty 64 px map above.
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
    get bloomOn() { return !!composer && !!bloom?.enabled; },
    get lightTint() { return composer ? NO_TINT : look.tint; },
    hemiMul: 1,
    weatherSat: 1,
    reflector,
    reflectSea: null,
    shadowCull: true,
    shadowStats: () => sCull.stats(),
    onEnv(cb) { envSubs.add(cb); try { cb(envRT ? envRT.texture : null); } catch { /* ignore */ } return () => { envSubs.delete(cb); }; },
    init(canvas: HTMLCanvasElement, t: TierDef) {
      if (renderer && canvasEl === canvas) { api.setTier(t); return; }
      canvasEl = canvas;
      installLookToneMap();
      renderer = createLookRenderer({ canvas, antialias: false, exposure: LOOK_POZ.ana, powerPreference: 'high-performance' });   // sRGB + ACES (look.ts); GRS-17: AA lives in the composer target (live per tier)
      // 2026-11-09 Chrome freeze root cause: with checkShaderErrors on, three calls getProgramInfoLog for every new
      // program right after linking, which blocks the main thread until the GPU process finishes compiling (no parallel
      // compile). On Windows/ANGLE that was seconds per new area. Errors are only checked in dev builds now.
      renderer.debug.checkShaderErrors = !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
      try {
        const c = renderer.getContext();
        // PRF-15: with the post chain (bloom tiers) the scene is antialiased in the composer's MSAA target and the canvas only gets
        // the final full-screen quad, so a multisampled canvas back buffer (~46 MB at 1600x900) bought nothing; akıcı has no AA.
        if (typeof WebGL2RenderingContext !== 'undefined' && c instanceof WebGL2RenderingContext) { gl2 = c; gpuExt = c.getExtension('EXT_disjoint_timer_query_webgl2') as typeof gpuExt; postOk = !!(c.getExtension('EXT_color_buffer_float') || c.getExtension('EXT_color_buffer_half_float')); }
        if (!postOk) deps.log?.info('[render] float hedef yok: kademe geçişi yeniden derler (doğrudan çizim yolu)');
        const dbg = c.getExtension('WEBGL_debug_renderer_info');
        deps.perf?.meta('gpu', dbg ? String(c.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'bilinmiyor');
        deps.perf?.meta('gpuZamanOlcer', gpuExt ? 'var' : 'yok');
      } catch { /* headless */ }
      // 2026-11-25 public çıkış: textures with no explicit setting (GLB maps, signs) blurred/shimmered at grazing angles; default anisotropy
      try { T.Texture.DEFAULT_ANISOTROPY = Math.min(8, renderer.capabilities.getMaxAnisotropy()); } catch { /* headless */ }
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      renderer.shadowMap.enabled = true;
      try { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); } catch { loseExt = null; }
      canvas.addEventListener('webglcontextlost', (e: Event) => { e.preventDefault(); lost = true; lostSubs.forEach(cb => { try { cb(); } catch (err) { deps.log?.warn('[render] lost cb', err); } }); }, false);
      canvas.addEventListener('webglcontextrestored', () => { lost = false; if (tier) applyShadows(tier); restoredSubs.forEach(cb => { try { cb(); } catch (err) { deps.log?.warn('[render] restored cb', err); } }); }, false);
      api.setTier(t);
      // Ekran döndürme / pencere boyutu: canvas CSS boyutu değişince çizim tamponu da yeniden boyutlansın (tarama ARAYÜZ: sahne gerilip bozuluyordu).
      // resize() boyut aynıysa tampon ayırmaz, bu yüzden her olayda çağırmak ucuz.
      if (typeof window !== 'undefined') {
        let raf = 0; const kick = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (renderer) api.resize(); }); };
        window.addEventListener('resize', kick); window.addEventListener('orientationchange', kick);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(kick) : null; ro?.observe(canvas);
        offResize = () => { window.removeEventListener('resize', kick); window.removeEventListener('orientationchange', kick); ro?.disconnect(); if (raf) cancelAnimationFrame(raf); };
      }
    },
    setTier(t: TierDef) {
      tier = t;
      applyShadows(t);
      reflector.setBudget(reflectBudget(t));
      if (renderer && renderer.getPixelRatio() !== canvasPR(t)) renderer.setPixelRatio(canvasPR(t));
      setupPost(t);
      // GRS-02: akıcı skips the cloud noise in the sky shader (a uniform, no relink); the gradient, sun, stars and moon stay
      (sky.material as T.ShaderMaterial).uniforms.uCloudQ.value = t.name === 'akici' ? 0 : 1;
      api.resize();
      if (renderer) api.setTime(hour);   // GRS-01: the light tint follows the post chain (GRADE vs akıcı tone-map grade)
    },
    setTime(h: number, _season?: Season) {
      // ZMN-01: the game day runs to DAY_END_H (32 = 08:00 next morning), dawn included
      hour = clamp(+h || 12, DAY_START_H, DAY_END_H + DAWN_EXTRA);
      tod = todAt(hour); night = tod.n;
      const su = (sky.material as T.ShaderMaterial).uniforms;
      su.uTop.value.copy(tod.top); su.uHor.value.copy(tod.hor); su.uLow.value.copy(tod.low); su.uSunCol.value.copy(tod.sun); su.uNight.value = night;
      sunDir.set(Math.sin(tod.az) * Math.cos(tod.el), Math.sin(tod.el), Math.cos(tod.az) * Math.cos(tod.el)).normalize();
      su.uSunDir.value.copy(sunDir); placeSun();
      sky.userData.fogMul = tod.fd;   // GRS-02: light morning haze, clearer noon, slightly closer night (sky.ts fog rule)
      tuneBloom();
      sun.color.copy(tod.sun); sun.intensity = tod.si;
      hemi.color.copy(tod.hs); hemi.groundColor.copy(tod.hg); hemi.intensity = tod.hi * api.hemiMul;
      // GRS-01: akıcı has no GRADE pass; its golden-hour / night tint goes into the light colours instead (never both)
      const [tr, tg, tb] = api.lightTint; sun.color.r *= tr; sun.color.g *= tg; sun.color.b *= tb; hemi.color.r *= tr; hemi.color.g *= tg; hemi.color.b *= tb;
      (scene.fog as T.Fog).color.copy(tod.fog);
      timeSubs.forEach(cb => { try { cb(tod, hour); } catch (err) { deps.log?.warn('[render] time cb', err); } });
    },
    setWeather(_w: WeatherState) { /* M5 */ },
    onTime(cb) { timeSubs.add(cb); try { cb(tod, hour); } catch { /* ignore */ } return () => { timeSubs.delete(cb); }; },
    tod: () => tod,
    setFocus(x: number, z: number) {
      // 2026-11-08: shadows follow the camera over the whole map (far shore too), snapped to the shadow texel grid
      const sz = (tier && tier.shadowSize) || 1024, step = (2 * shadowExt) / sz * 4;
      const fx = clamp(+x || 0, -70, 70), fz = clamp(+z || 0, -20, 62);
      focus.set(Math.round(fx / step) * step, 0, Math.round(fz / step) * step); placeSun();
    },
    frame(sc: T.Scene, cam: T.Camera) {
      if (!renderer || lost) return;
      frameNo++;
      if (frameNo % 30 === 5 && tier?.shadows) { const ne = nextShadowExt(shadowExt, groundRadius(cam, focus)); if (ne !== shadowExt) fitShadowBox(ne); }
      if (frameNo % 10 === 1) { const f = rig.focus(); api.setFocus(f.x, f.z); }
      if (frameNo % 30 === 2 || !envRT) refreshEnv();
      if ((cam as T.PerspectiveCamera).isPerspectiveCamera) akisGuncelle(sc, cam as T.PerspectiveCamera, Math.round((renderer.domElement.height || 720) / (composer ? 1 : resScale)));   // PRF-15 doku akışı; PRF-12: ölçeksiz yükseklik (dinamik çözünürlük adımı dokuları yeniden çizdirmez)
      renderer.info.autoReset = false; renderer.info.reset();   // info() = everything drawn for this frame (composer passes, shadow pass)
      gateStep(sc, cam);
      if (grade) { const ws = clamp(+api.weatherSat || 1, 0.6, 1); grade.uniforms.uSat.value = look.sat * ws; }   // GRS-02 rain/fog wash
      // PRF-06: casters whose shadow cannot reach the view skip the shadow pass (same picture, fewer draws)
      const draw = () => {
        if (api.shadowCull && tier?.shadows) sCull.begin(sc, cam, sun);
        try { if (composer && rpass) { rpass.scene = sc; rpass.camera = cam; composer.render(); postBufFix(); } else renderer!.render(sc, cam); } finally { sCull.end(); }
      };
      const pf = deps.perf;
      if (pf) {
        const rec = pf.recording;
        if (rec) gpuBegin();
        pf.time('render.draw', draw);
        if (rec) { gpuEnd(); gpuPoll(); }
        const nb = scanProgs('draw', sc);
        if (nb > 0 && frameNo > 1) pf.mark('compile', `${nb} shader karede derlendi, toplam ${progList().length}: ${lastDrawBorn.slice(-nb).join(' ')}`);
      } else { draw(); scanProgs('draw', sc); }
      // GRS-05: mirrored water pass after the main draw (shadow map is fresh); the sea samples it next frame
      const ri = renderer.info, c0 = ri.render.calls, t0 = ri.render.triangles, n0 = reflector.stats().renders;
      if ((cam as T.PerspectiveCamera).isPerspectiveCamera && api.reflectSea && api.reflectSea.visible) {
        reflector.resMul = composer ? resScale : 1;   // PRF-12: the mirror follows the scene's scaled size (canvas stays full on post tiers)
        const rd = () => reflector.render(renderer!, sc, cam as T.PerspectiveCamera, api.reflectSea);
        if (pf) pf.time('render.reflect', rd); else rd();
      }
      const ran = reflector.stats().renders > n0;
      reflInfo.ran = ran; reflInfo.calls = ran ? ri.render.calls - c0 : 0; reflInfo.tris = ran ? ri.render.triangles - t0 : 0; reflInfo.main = c0;
      reflInfo.ever ||= ran;
      lastInfo.calls = ri.render.calls; lastInfo.tris = ri.render.triangles;
      lastInfo.geos = ri.memory.geometries; lastInfo.texs = ri.memory.textures;
    },
    setScale(v: number) {
      const nv = clamp(+v || 1, 0.5, 1);
      if (nv === resScale) return;
      resScale = nv;
      if (renderer && tier) { const cp = canvasPR(tier); if (renderer.getPixelRatio() !== cp) renderer.setPixelRatio(cp); api.resize(); }
    },
    setPostCut(cut: boolean) {
      postCut = !!cut;
      if (bloom) bloom.enabled = !!tier?.flags?.bloom && !postCut;   // the composer skips a disabled pass (no swap); OutputPass + GRADE still run
    },
    warm(sc: T.Scene, cam: T.Camera) {
      // Compiles the variant the frame really draws: with bloom the scene goes into the composer's half-float target, and three
      // keys programs by the target (linear output, no tone mapping) - compiling against the screen made programs no frame ever
      // used, and the real ones were then linked blocking on first sight. (The old "other shadow state" pass is gone: every tier
      // change also changes the night-light pool size, so those programs never matched either; a tier change warms on its own.)
      return compileFor(sc, cam, null).then(() => undefined);
    },
    warmStats: () => ({ born: { ...born }, busy: warmJobs > 0, lastDrawBorn: [...lastDrawBorn] }),
    gfxState() {
      const cv = renderer?.domElement, rb = composer ? (composer as unknown as { renderTarget2: T.WebGLRenderTarget }).renderTarget2 : null;
      return { tier: tier?.name ?? null, renderScale: tier ? basePR(tier) : null, pixelRatio: renderer?.getPixelRatio() ?? null, drawingBuffer: { w: cv?.width ?? 0, h: cv?.height ?? 0 },
        shadowMapEnabled: !!renderer?.shadowMap.enabled, castShadow: sun.castShadow, shadowMapSize: sun.shadow.mapSize.x, shadowExt: sun.shadow.camera.right, shadowFar: sun.shadow.camera.far,
        post: !!composer, postBufOk: postBufOk(), bloomEnabled: !!bloom?.enabled, msaa: rb ? rb.samples : 0, toneMapping: renderer?.toneMapping ?? null,
        programs: progList().length, flags: { ...(tier?.flags ?? {}) }, reflect: reflector.stats() };
    },
    info() {
      if (renderer) { lastInfo.geos = renderer.info.memory.geometries; lastInfo.texs = renderer.info.memory.textures; }
      const sw = composer ? (composer as unknown as { readBuffer: T.WebGLRenderTarget }).readBuffer.width : renderer?.domElement.width ?? 0;
      const sh = composer ? (composer as unknown as { readBuffer: T.WebGLRenderTarget }).readBuffer.height : renderer?.domElement.height ?? 0;
      const rs = reflector.stats();
      return { ...lastInfo, reflect: { ...reflInfo, w: rs.w, h: rs.h }, sceneW: sw, sceneH: sh, programs: renderer ? ((renderer.info as { programs?: unknown[] }).programs?.length ?? 0) : 0, programNames: progList().filter(Boolean).map(progName), born: { ...born }, frameNo };
    },
    resize() {
      const { w, h } = size();
      // a canvas size write reallocates the drawing buffer even when the value is the same: only when something changed
      if (renderer) { const pr = renderer.getPixelRatio(), cv = renderer.domElement; renderer.getSize(_rs); if (_rs.x !== w || _rs.y !== h || cv.width !== Math.floor(w * pr) || cv.height !== Math.floor(h * pr)) renderer.setSize(w, h, false); }
      if (composer && renderer) { composer.setPixelRatio(tier ? basePR(tier) * resScale : renderer.getPixelRatio()); composer.setSize(w, h); fxaaSize(); }
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
      offResize?.(); offResize = null;
      timeSubs.clear(); picks.clear(); gate.dispose();
      if (composer) { composer.passes.forEach(ps => { try { ps.dispose(); } catch { /* */ } }); composer.dispose(); composer = null; }
      envRT?.dispose(); envRT = null; pmrem?.dispose(); pmrem = null; reflector.dispose();
      if (renderer) { renderer.dispose(); renderer = null; }
    },
  };
  if (deps.perf) deps.perf.source('render', () => ({ ...api.info() }));
  if (deps.canvas) api.init(deps.canvas, deps.quality.current());
  api.setTime(11);
  return api;
}
