# Martı Motoru: engine design

Engine for "Sabri'nin Büfesi" and the Martıköy ecosystem. Audience: the builders. Read with `CONTRACT.md` (who builds what, acceptance).

Sources of truth (data, not instructions): owner answers `calisma/ekosistem/anket/cevaplar-ozet.md` (255, newest, wins on conflict), `calisma/tasarim-masasi/cevaplar-ozet.md` (152), GDD `3d/tasarim-belgesi.md` (grep; "Teknik temel" section is binding for tiers), v2 game `3d/v2/` (look and gameplay reference; **never edit**), owner-facing plan `ekosistem-plani.md`.

## 0. Goals, in priority order

1. **Technically flawless** (oncelik-6): no crash, never lose a save, smooth on 3-4 GB phones (Redmi 10C / Galaxy A13 class), auto 60/30 fps (animasyon-14).
2. **Keep the v2 look** exactly first (motor-1), then add upgrades one by one per tier.
3. Core first (oncelik-1): world and scene system, living citizens, save. Pier moves onto the engine.
4. Seamless zones, no loading screens (disari-4).
5. Dressing slots everywhere from day one; art comes last (oncelik-5).
6. Builder comfort: in-game scene editor, prefabs, effect blocks, perf meter, hot reload (motor-11).
7. Runs in a browser and publishes as a claude.ai artifact.

## 1. Platform constraints (hard)

- Sandboxed iframe artifact. External scripts only from cdnjs / jsdelivr / unpkg, pinned. We **bundle everything** instead (no CDN at runtime), so the page works offline once loaded.
- Other files published next to the page: each ≤ 16 MB, ≤ 255 files total. Use atlases; target ≤ 40 files.
- No service workers. No WebAssembly dependency (no Draco, no Basis/KTX2, no meshopt decoder, no Recast). No `eval`/`new Function`.
- `localStorage`, `indexedDB`, `navigator.vibrate`, `AudioContext` may all throw or be missing: every access goes through `engine/platform` guards.
- WebGL2 required (three r160). If context creation fails: the v2-style Turkish `#fail` message. Handle `webglcontextlost/restored`: pause, rebuild GPU resources from the scene description, resume, no save loss.
- Page contract for `dist/index.html`: no doctype/html/head/body tags, `<title>Sabri'nin Büfesi</title>` first, base `<style>`, `<div id="app"><canvas id="c"></canvas></div>`, hidden `#fail`, then `<script src="game.js"></script>` (classic script, IIFE bundle).

## 2. Stack and packages

TypeScript (strict) compiled and bundled by Vite into one IIFE `dist/game.js` (three.js tree-shaken inside). Tests: Vitest for unit + headless sim (Node), Playwright (already installed globally, 1.56) for browser screenshots and bot runs in SwiftShader.

| Package | Version | Why |
|---|---|---|
| three | 0.160.1 | Same as v2: look parity. Upgrade only later, behind the parity test. |
| @types/three | 0.160.0 | Types |
| typescript | 5.6.3 | Language |
| vite | 5.4.10 | Dev server with HMR (hot reload), IIFE production build |
| vitest | 2.1.4 | Unit, headless sim, golden replays |
| pixelmatch | 6.0.0 | Screenshot diff images for parity |
| pngjs | 7.0.0 | Read/write PNG in tools |
| @types/pngjs | 6.0.5 | Types |
| lil-gui | 0.19.2 | Editor inspector panels (dev and `?edit=1` only, lazy) |
| playwright | 1.56.x (global, already present) | Browser tests; do not add to package.json unless the lead wants it |

No other runtime dependencies. GLTFLoader and BufferGeometryUtils come from `three/examples/jsm` (same package).

## 3. Folder layout

```
motor/
  MOTOR.md  CONTRACT.md  package.json  tsconfig.json  vite.config.ts
  index.html                 dev entry (Vite); tools/build-artifact.mjs writes dist/index.html in page-contract form
  src/
    engine/                  generic, knows nothing about kiosks
      platform/              guards: storage, idb, audio ctx, vibrate, visibility, device hints, clock
      core/                  rng, events, math, pools, assert, log, ids
      loop/                  fixed-step loop, frame pacing
      ecs/                   entities, component stores, queries, system scheduler
      save/                  SaveStore, slots, backups, checksum, migrations runner, export/import
      quality/               tier detect, probe, auto-watch, tier table
      input/                 pointer/keys/joystick/pinch/tap-pick, interaction zones (dwell rule)
      camera/                v2 rig, pans, intro, photo mode
      zones/                 zone registry, streaming states, build job queue, portals
      nav/                   walk grids, A*, smoothing, flow fields, portal graph, avoidance
      anim/                  procedural rig, gaits, springs, clips (authored), emotes, face
      render/                renderer, lights/day, materials (Lambert + chunks), water, sky, fog, shadows, post, instancing, culling
      dress/                 dressing slot registry, art manifest, lazy loaders
      prefab/                prefab defs -> geometry builders, instances, overrides, merge/batch
      fx/                    particle system, effect blocks, effect graph
      ui/                    DOM layer base: styles tokens, sheet/panel, toast, labels pool, transitions (kepenk)
      audio/                 buses, synth SFX, sample slots, music layers, ambience zones
      editor/                scene editor, inspector, prefab editor, content overrides
      perf/                  perf meter, timers, counters, report
      debug/                 test hooks (window.__marti), headless entry
    game/                    Sabri'nin Büfesi rules and views
      sim/                   pure simulation (no three, no DOM): state, systems
      view/                  three views that read sim state (pier, crowd, heroes, items)
      ui/                    game panels (port of v2 ui.js)
      boot.ts                wires engine + game; main entry
      headless.ts            sim-only entry for Node and bots
    content/                 data tables, typed TS modules (hot-reloadable)
      zones/ prefabs/ citizens/ products/ esnaf/ brands/ decor/ effects/ clips/ lines/ economy/ art-manifest.ts
  tools/   build-artifact.mjs  check-dist.mjs  lint-sim.mjs  shot-compare.mjs  content-lint.mjs  v2-shots.mjs
  tests/   unit/  sim/  browser/  golden/  fixtures/ (saves, v2 shots)  vendor/ (local three for offline pages if needed)
  dist/    publishable artifact: index.html, game.js, img/*, parity.html (M0)
```

Rule: `src/game/sim/**` and `src/engine/{core,ecs,save,nav}/**` must not import `three` or touch `window`/`document`/`Math.random`/`Date.now`/`performance.now`. `tools/lint-sim.mjs` greps and fails the build.

## 4. Loop: fixed-step sim, interpolated render

```ts
// engine/loop
export interface LoopOpts {
  simHz: 30;                       // GDD: 30 steps/s, seeded
  maxStepsPerFrame: 5;             // spiral-of-death guard; excess time is dropped (sim slows, never explodes)
  step(dt: number): void;          // sim tick
  render(frameDt: number, alpha: number): void;   // alpha = interpolation 0..1 between last two sim states
  targetFps(): 60 | 30;            // from quality; 30 = render every second rAF
}
export function startLoop(o: LoopOpts): { stop(): void; pause(why: string): void; resume(): void; readonly paused: boolean };
```
- Render-side transforms interpolate: every moving entity keeps `prev` and `cur` (x, z, rotY, plus anim phase); views lerp with `alpha`. Sim never reads render state.
- `visibilitychange` hidden / `pagehide`: pause loop, mute audio, save now. On return, offline time is applied by **analytic catch-up** (kepenk earnings ladder, courier 50%, ekonomi-3), never by running thousands of steps. Short gaps (< 5 s) are simply skipped.
- Every step and render are wrapped: an exception in one system is logged, the system is disabled for 1 s and retried (3 strikes then stays off with a perf-meter warning). The game never stops because of one bug.

## 5. Entities and components

Small, fast, explicit. Not a general ECS framework.

```ts
// engine/ecs
export type Entity = number;                         // index + generation (stale handles detected)
export interface ComponentStore<T> { has(e: Entity): boolean; get(e: Entity): T; add(e: Entity, v: T): T; remove(e: Entity): void; each(fn: (e: Entity, v: T) => void): void; }
export interface SoAStore { readonly cap: number; f32(name: string): Float32Array; u8(name: string): Uint8Array; }  // hot crowd data
export class World {
  create(): Entity; destroy(e: Entity): void; alive(e: Entity): boolean;
  store<T>(name: string): ComponentStore<T>;
  soa(name: string, cap: number): SoAStore;          // e.g. 'agents' with x,z,vx,vz,rot,speed,anim
}
export interface System { id: string; order: number; phase: 'sim' | 'view'; step(ctx: SimCtx): void; }
export interface SimCtx { tick: number; dt: number; t: number; world: World; rng: RngStreams; bus: Bus<SimEvents>; state: GameState; content: Content; clock: GameClock; }
export class Scheduler { add(s: System): void; replace(id: string, s: System): void /* hot reload */; run(phase, ctx): void; timings(): Record<string, number>; }
```
- `GameState` is plain JSON-able data (what gets saved). Runtime-only data lives in component stores and is rebuilt from `GameState` + content on load.
- Events: typed bus `bus.emit('sale', {...})`; views, audio and UI subscribe. Bot tests read the event log (v2 used `R.log`; keep the same event names where v2 had them: `heroPick, firstCut, siftah, firstCollect, padShown, unlock, ferryDock, firstStreak, catRub, catPet, set, dayEnd, tip, boardOpen, hire, takeover, firstWindowSale, gullStare, gullChased, gullSnatch, workerSleep, wake, slowIcon, slowTap, star`).

## 6. Zones and seamless streaming

A zone is data: `content/zones/<id>.ts`.

```ts
export interface ZoneDef {
  id: 'iskele' | 'carsi' | string;
  bounds: { x0: number; z0: number; x1: number; z1: number };   // world metres, zones share one coordinate space
  walk: WalkGridDef;                       // baked from props + painted overrides
  props: PrefabPlacement[];                // { prefab, pos, rotY, overrides?, id }  (editor writes these)
  anchors: Record<string, AnchorDef>;      // queue spots, shop doors, benches, perches, decor slots, spawn points
  portals: { id: string; to: string; a: Vec2; b: Vec2 }[];      // walkable seams between zones
  ambience: { music: string; loops: string[]; lightMood?: string };
  dressing: string[];                      // slot ids used by this zone (for preloading art)
  schedule?: ShopHours[];                  // esnaf open/close
}
export type ZoneState = 'cold' | 'sim' | 'warm' | 'hot';
// cold: only persistent data. sim: agents simulated coarsely (no meshes). warm: meshes built, hidden or far. hot: visible, full detail.
export interface ZoneManager {
  register(def: ZoneDef): void;
  update(playerPos: Vec2, camFrustum: Frustum): void;   // decides target states by distance to bounds
  state(id: string): ZoneState;
  onState(cb: (id: string, s: ZoneState) => void): void;
}
```
- **Streaming:** target state by distance from the player to zone bounds: ≤ 0 m hot, ≤ 25 m warm (start building), ≤ 60 m sim, else cold. Hysteresis 8 m.
- **Build job queue:** building a zone is split into jobs (merge static geometry per material chunk, create instanced batches, canvas textures, nav grid). The queue runs inside `render` with a budget per frame (akici 3 ms, dengeli 4 ms, sahane 6 ms). A zone must reach warm before the player crosses its portal; walking speed (~4 m/s, 25 m lead) gives ≥ 5 s of budget. If a zone is somehow not ready, the portal seam has a soft gate: an esnaf cart or a cat blocks the gap until ready (never a loading screen).
- Memory cap: max hot+warm zones per tier (akici 2, dengeli 3, sahane 4). Zones leaving warm are disposed (geometries, materials not shared, textures) with `renderer.info.memory` checked by tests.
- Seams are hidden by street bends, arches and props; one shared fog/skyline; one sun.
- The **pier zone is never fully unloaded**: when the player is away, it drops to `sim` (workers keep working, disari-5), with its sim at full logic but no views.

## 7. Camera rig (v2 framing, exact)

Port of v2 `updateCamera` (game.js ~2508):
```ts
export interface CameraRig {
  fov: 38; pitch: 0.92;                    // radians
  zoom: number;                            // 0.65..1.5, pinch / wheel, default 1
  follow(target: Vec2, dt: number): void;  // lerp factor min(1, dt*4)
  pan(at: Vec2, dur?: number): void;       // 1.2..2 s ease in, hold, ease out (unlock pans, slow-spot tap)
  intro(seconds: 3.2): void;               // descent: dist x2.6 -> x1, pitch 1.25 -> 0.92
  photoMode(on: boolean): void;            // free offset, DOF on, UI hidden
}
// dist = clamp(max(6.6/(tanV*aspect), 6.2/tanV), 13, 40) * zoom
// position = (cx, sin(pitch)*dist, cz + 0.4 + cos(pitch)*dist); lookAt(cx, 0.6, cz + 0.4)
```
Fixed isometric-like angle, no rotation (kamera-2). Interpolated with render alpha. Camera position also feeds zone streaming and fog distances (v2 world.js line 423 rule).

## 8. Input and the pause-before-pickup rule

```ts
export interface InputState { move: Vec2 /* -1..1 joystick */; moving: boolean; taps: TapEvent[]; pinch?: number; hand: 'left' | 'right'; }
export interface Interactable {
  id: string; pos: Vec2; radius: number;            // metres
  kind: 'station' | 'counter' | 'pad' | 'table' | 'npc' | 'door' | 'pickup';
  dwell: number;                                     // seconds before acting; content-tunable
  canAct(actor: Entity): boolean;
  act(actor: Entity, ctx: SimCtx): 'continue' | 'done';   // called every transfer tick while dwelling
}
```
- Floating joystick anywhere (kontrol-1), taps on 3D icons via screen-space pick list (no raycast against meshes), pinch/wheel zoom. Left/right hand layout setting. Inputs are converted to **sim commands** per tick (`{tick, move:{x,z}}`), logged for replays.
- **Dwell rule (owner note on motor-11, binding):** stations and other auto take/give points do not act on contact. They act when the player is inside `radius` AND speed < 0.6 m/s for `dwell` seconds (default **0.4 s** for stations, 0.25 s for counter drop-off, 0 for money pickup and pads keep v2 fill behaviour). Passing through at walking speed never picks anything up. A small ring fills on the ground during the dwell so the pause is readable. After the dwell, items transfer one per 0.18 s (v2 cadence) and stop immediately when the player moves away or the joystick is pushed out of the zone. Per-station `takeLimit` (default: until hands full) is content data so special orders can be tuned.
- Tests: bot walks straight past every station at full speed → carry unchanged; bot stops 0.5 s → first item taken by 0.6 s; bot stops 0.3 s and leaves → nothing taken.

## 9. Navigation and crowd

No WASM. Grid + graph, all in pure TS (sim side).

```ts
export interface WalkGrid { cell: 0.5; w: number; h: number; origin: Vec2; cost: Uint8Array /* 0 blocked, 1..254 */; }
export interface Nav {
  path(from: Vec2, to: Vec2, opts?: { maxNodes?: number }): Vec2[];     // A* (octile) + string-pulling smoothing
  flowTo(targetId: string): FlowField;                                  // cached for hot targets: counter queue, ferry door, shop doors
  zonePath(fromZone: string, toZone: string): string[];                 // portal graph, for cross-zone trips
  setBlocked(rect: Rect, on: boolean): void;                            // stage/decor changes; invalidates caches
}
export interface Steering { separate(agents: SoAStore, hash: SpatialHash, i: number): Vec2; }   // light RVO-like avoidance
```
- **Agent LOD:** A = near camera (full path following, avoidance, anim); B = in a warm/hot zone but off-screen (path following, no avoidance, anim paused); C = in a sim/cold zone (schedule timeline only: position derived from "leg start, leg end, start time" without stepping). Agents are promoted/demoted smoothly; an agent entering view from C gets a real path from its derived position.
- **Living citizens:** each persistent citizen has `{ id, typeId (v2 24 ids), look seed, home anchor, job anchor, schedule template }`. Schedule templates from content (yasam-1): e.g. plaza: 08:30 ferry in → 09:00 office (offstage portal) → 12:30 simit at a shop/your kiosk → 18:00 ferry out. Esnaf follow shop hours (sabah kepenk açma toplu selam, akşam esnaf çayı). Time = game clock (4-min day, 08:00-24:00, 1 game hour = 15 s).
- Budgets: visible crowd 25 / 50 / 90 by tier (GDD). Persistent population can be larger (≈ 150 across zones); only A/B agents cost real CPU.
- Interaction with economy: shoppers pick destinations by demand weights (time of day, weather later, decor attraction, brand loyalty). Neighbour shops are sinks/sources with simple queues.

## 10. Animation

Procedural first (motor-10), short authored clips for special moments.

```ts
export interface RigPose { root: Vec3; lean: number; bob: number; head: Euler; armL: Euler; armR: Euler; legL: Euler; legR: Euler; torsoTwist: number; }
export interface Gait { id: 'normal' | 'waddle' | 'brisk' | 'slow' | 'shuffle' | 'kid' | 'run'; stride: number; freq: number; bob: number; sway: number; armSwing: number; }
export interface AnimLayerInput { speed: number; carry: number /* stack height 0..1 */; act: ActId; mood: Mood; expr?: ExprId; brow?: BrowId; emote?: EmoteId; t: number; }
export interface Animator {
  update(dt: number, inp: AnimLayerInput): RigPose;     // base gait + carry lean + idles + acts
  play(clip: ClipId, opts?: { additive?: boolean; speed?: number }): void;   // authored clip over procedural
}
export interface Spring1D { k: number; d: number; step(target: number, dt: number): number; }
```
- Gaits per citizen type (animasyon-2): teyze waddle, plaza brisk, dede slow. Carry lean grows with stack height. Run dust puff (fx block). Stop stumble: short overshoot spring on stop.
- **Carried stack:** each item offset driven by a damped spring chain, max lateral 6 cm, clamped; items never detach (animasyon-3).
- Idles (animasyon-4): `twirlMustache, sipTea, stretchYawn, phone, stareGull, tapFoot`, chosen by weighted random from the view-side rng (not the sim rng) after 4-8 s still.
- Emotes: `clap, shrug, facepalm ("eyvah"), raiseTea`. Prep rituals: tost lid down + steam, çay pour + saucer "tık", döner cut + wrap ritual, customer blows on tea and sips, bite mark on dürüm (swap mesh).
- Worker trait motions (animasyon-8): sleepy head drop and jolt, chatty gestures, gull-whisperer nod exchange, master tosses dürüm, clumsy stumble.
- Animals (animasyon-9): gull glide and flap, rooftop head-back scream, ground waddle toward simit; cat stretch, lick, box; dog wag, belly up. Ferry bob, docking bump, rope throw, wake foam; moored boats rock (animasyon-10).
- Secondary motion (animasyon-11): apron, awning, flags, hair, moustache tips, scarf via vertex-shader wind (cheap, all tiers) + per-hero 3-node springs on dengeli+. Sliding cup on a rocking ferry, tray stops it. Dropped simit rolls (simple 2D physics on deck), gull chases.
- Toy feel + slight springiness on important moments (animasyon-1): `squashPop(entity)` helper used by unlocks, purchases, item lands.
- **Authored clips:** compact JSON `{ id, len, loop, tracks: { [joint]: [t, x, y, z][] } }` Hermite-interpolated, ≤ 2 s each, blended additive or override with 0.15 s fade. Stored in `content/clips/`. A clip recorder in the editor lets a builder pose joints with sliders and key them.
- **Crowd on GPU:** like v2, the crowd is drawn with InstancedMesh per body part; walk phase, gait params and expression index are per-instance attributes, limb swing computed in the vertex shader, so CPU only writes position/rot/phase. Heroes (Sabri, workers, VIPs, regulars, esnaf near the player) are individual rigs, max 12 (+4 esnaf on dengeli+).

### Faces: 12 expressions + brows (animasyon-5)
`ExprId = 'neutral' | 'smile' | 'grin' | 'laugh' | 'surprised' | 'sleepy' | 'pout' | 'grumpy' | 'love' | 'wink' | 'thinking' | 'bliss'` (pout = the sulking walk-away, never angry shouting; bliss = eyes closed sipping tea).
`BrowId = 'flat' | 'up' | 'down' | 'worried' | 'oneUp'`.
- Face atlas (canvas-drawn now, dressing slot later): eyes row × mouth row; crowd uses atlas indices per instance; heroes have separate brow quads animated by springs (raise on surprise, knit on thinking), blinks every 2-6 s, eye look-at toward the player or the thing they want.
- Crowd far LOD uses only 4 expressions (GDD: simple faces in the crowd, detailed on heroes).

## 11. Render pipeline

Reproduce v2 exactly first, then add upgrades behind tier flags.

**Parity baseline (from v2):** `WebGLRenderer({ antialias: tier !== 'akici', powerPreference: 'high-performance' })`, `outputColorSpace = SRGBColorSpace`, `PCFSoftShadowMap`, `MeshLambertMaterial` with vertex colors and canvas atlases (plank, stone, tile, floor, signs, faces), `HemisphereLight('#dcefff', '#9a8a74', 1.45)`, sun `DirectionalLight('#fff4e2', 2.3)` following the camera focus, `Fog('#c6e3f2', 70, 190)` with camera-distance near/far rule, skyline mesh with atlas, rounded boxes (`roundBox`) for toy shapes, glass `opacity 0.32 depthWrite false`, emissive neon sign at night, day lighting table 08:00-24:00 from v2 `world.setTime`. Port the v2 builders (world.js, chars.js) as prefab builders so geometry is identical; the M0 parity test compares screenshots.

```ts
export interface RenderPipeline {
  init(canvas: HTMLCanvasElement, tier: TierDef): void;
  setTier(t: TierDef): void;                         // pixel ratio, shadows on/off + size, AA (recreate renderer only if AA changes; v2 did same)
  setTime(hour: number, season: Season): void;       // 4 phases blended: morning, noon, sunset, night (motor-4)
  setWeather(w: WeatherState): void;                 // later milestones
  frame(scene: Scene, cam: Camera, alpha: number): void;
  info(): { calls: number; tris: number; geos: number; texs: number; gpuMs?: number };
}
```

**Upgrades (motor-2..8), each a separate flag, added only after parity passes:**
| Upgrade | akici | dengeli | sahane | How |
|---|---|---|---|---|
| Soft edge glow on selected/tappable (motor-2) | on (cheap) | on | on | Fresnel rim term injected via `onBeforeCompile` chunk, uniform per material group; no outline pass |
| Sea: sun glitter, ferry foam, light reflections (motor-3) | glitter only | + foam trail + light streaks | + fake planar reflection of skyline/lights | Custom water ShaderMaterial; reflections are stretched emissive quads, not a second render |
| 4-phase day blend (motor-4) | on | on | on | Light + fog + sky gradient keyframes per phase, smooth lerp |
| Baked soft corner darkening (motor-5) | on | on | on | Vertex-color AO computed at prefab build time |
| Blob shadows under characters (motor-5) | on (only shadows) | on | on | Instanced decal quads |
| Shadow maps | off | 1024 kiosk+heroes | 2048 soft | v2 rule |
| Cloud shadows (motor-5) | off | on | on | Scrolling noise sampled in the Lambert light chunk |
| Warm pastel grade, seasonal (motor-6) | in-material tint | in-material tint | post pass | Uniform grade in shader chunk (no extra pass) on low tiers |
| Night bloom (motor-6) | off | off | on (half-res) | Single combined post pass (grade + bloom), only at night |
| Photo-mode DOF (motor-6) | photo mode only | photo mode only | photo mode only | One-off render with blur pass |
| Rain + wet glossy ground, lodos, snow, fog (motor-7) | light | full | full | Particles + material uniforms (wetness, snow cover mask) |

Batching: static props merged per zone chunk per material (target < 60 calls for a zone's statics); repeated props (stools, bollards, lamps) instanced; frustum culling per chunk; crowd parts instanced (15-20 calls total). Shared material cache (v2 `C.mat`). No per-frame allocations in render code.

## 12. Dressing slots (art last, slots first)

Every visual piece is created through a slot so art can replace code-made shapes later without code changes.

```ts
export type SlotKind = 'mesh' | 'texture' | 'atlasRect' | 'sound' | 'music' | 'portrait' | 'panorama';
export interface SlotDef { id: string; kind: SlotKind; fallback: () => Object3D | Texture | AudioBuffer | null; hints?: { size?: Vec3; anchor?: Vec3; maxTris?: number; texSize?: number } }
export interface Dress {
  define(def: SlotDef): void;
  get<T>(id: string): T;                       // returns fallback immediately; swaps in art when loaded
  when<T>(id: string, cb: (v: T) => void): void;
  manifest(m: ArtManifest): void;              // content/art-manifest.ts: slot id -> { file, rect?, scale?, offset? }
  missing(): string[];                         // for the editor: which slots still use code art
}
```
- Slot id convention: `char.<who>.<part>` (`char.sabri.head`, `char.crowd.teyze.top`), `prop.<zone>.<thing>.<stage>`, `tex.<name>`, `sky.<phase>`, `ui.<icon>`, `sfx.<name>`, `music.<zone>.<variant>`, `ad.<surface>` (marka-7 billboard/poster/umbrella surfaces, also ready for future real sponsors).
- Loaders: images (webp/jpg/png) via `ImageBitmap` when available; GLB via GLTFLoader (no Draco). Loads are lazy and per zone (`ZoneDef.dressing`), never block play. `#noart` query = code art only (v2 convention) for A/B shots.
- v2 `img/` art (art.json) is imported as the first manifest so current hand-made textures keep working.

## 13. Prefabs

```ts
export interface PrefabDef {
  id: string; params?: Record<string, number | string | boolean>;
  parts: PartDef[];                // { shape: 'roundBox'|'cyl'|'sphere'|'capsule'|'lathe'|'extrude'|'plane'|'slot', size, pos, rot, color|mat, slot?, children? }
  children?: PrefabPlacement[];    // nested prefabs
  colliders?: Rect[]; anchors?: Record<string, AnchorDef>; interact?: InteractDef[];
  lod?: { far: string /* simpler prefab id */; dist: number };
  paint?: { material: string[]; color: string[]; pattern: string[] };   // decor 3-layer paint (dekor-3)
}
export interface PrefabSystem {
  define(def: PrefabDef): void;
  build(id: string, overrides?: Partial<PrefabDef['params']>): BuiltPrefab;   // geometry merged per material, cached by (id, params hash)
  instances(id: string): PrefabInstance[];
  redefine(def: PrefabDef): void;   // all instances rebuild (editor + hot reload): "change one table, all hundred change"
}
```
Decor uses prefabs with paint layers; placement on a half-tile grid with 45° steps (dekor-4) and stack sockets (table top, wall, awning, shelf: dekor-5).

## 14. Effect building blocks

```ts
export interface EmitterBlock { kind: 'burst' | 'stream' | 'ring' | 'trail'; rate?: number; count?: number; shape?: 'point' | 'disc' | 'box'; size?: Vec3 }
export type ModuleBlock =
  | { kind: 'velocity'; dir: Vec3; spread: number; speed: [number, number] }
  | { kind: 'gravity'; g: number } | { kind: 'drag'; k: number } | { kind: 'wind'; scale: number }
  | { kind: 'colorOverLife'; stops: [number, string, number][] } | { kind: 'sizeOverLife'; stops: [number, number][] }
  | { kind: 'spin'; speed: [number, number] } | { kind: 'sprite'; atlas: string; frames: number[] }
  | { kind: 'flash'; color: string; intensity: number; dur: number };
export interface EffectDef { id: string; life: [number, number]; emitters: EmitterBlock[]; modules: ModuleBlock[]; children?: { effect: string; delay: number }[]; tierScale?: [number, number, number] }
export interface Fx { define(d: EffectDef): void; play(id: string, at: Vec3 | Object3D, opts?: { scale?: number }): FxHandle; }
```
One GPU-instanced particle buffer per atlas, pooled; caps 200 / 500 / 1000 live particles by tier. Content effects for now: `steam`, `tostSteam`, `sesame`, `feather`, `foamSplash`, `dust`, `coinSparkle`, `confetti`, `heartPop`, `zzz`, `rainDrop`, `snowFlake`. Editor can combine blocks into a new effect live (motor-11 "duman + ışıltı").

## 15. UI layer (v2 style)

DOM over the canvas exactly like v2 (`ui.js` CSS tokens: warm toy panels, big bold type, finger-size buttons). TS port with the same look; v2 screenshots `test/game-p1-*.png` are the reference.
```ts
export interface Ui {
  hud(p: HudPatch): void; toast(text: string, kind: 'good'|'bad'|'info'): void;    // 3 s top strip (kontrol-5)
  label(): WorldLabel;                       // pooled, max 8 bubbles visible
  card(c: CenterCard): Promise<void>;        // big moments only
  sheet(id: string, model: unknown, actions: Record<string, Function>): void; close(): void;
  bell: { push(n: Notice): void };           // notice history
  transition(kind: 'kepenk' | 'spring'): Promise<void>;   // animasyon-12
  settings: { textScale: number; hand: 'left'|'right'; colorBlindIcons: boolean; haptics: boolean; batterySaver: boolean };
}
```
Max 5 fixed buttons + "Büfe Defteri" (kontrol-4). Red dot only for genuinely new things. Tutorial: no text, arrows + a familiar character demo 10 s, skippable, replay from the book (kontrol-7). All player text Turkish, no em-dashes, never the word "zam".

## 16. Audio

```ts
export interface Audio {
  buses: { music: Bus; sfx: Bus; voice: Bus };         // separate sliders (ses-5)
  sfx(id: string, opts?: { at?: Vec2; vol?: number; pitch?: number }): void;   // synth fallback (v2) or sample slot
  music: { setZone(id: string): void; setPhase(p: DayPhase): void; setIntensity(0..1): void };   // stems layered by crowd, version by time of day
  ambience: { setListener(pos: Vec2): void };          // per-zone loops, crossfade by distance
  voice(lineId: string): void;                         // rate-limited: ≤ 1 per 10 s (ses-3)
  ownMusicMode(on: boolean): void;                     // music off, effects stay
}
```
AudioContext created on first gesture; suspended when hidden. Must-have ambience (ses-2): ferry horn, gulls, teaspoon on tulip glass, distant "taze simiiit", waves + plank creak, grill sizzle. Lo-fi İstanbul music with record crackle and 2000s nods (genel-6). İskele Radyosu jingles as sample slots.

## 17. Save: versioning, backups, migration

Never lose a save. Layered, defensive.
```ts
export interface SaveStore<S> {
  load(): Promise<{ data: S; from: 'idb' | 'ls' | 'backup' | 'fresh'; repaired: string[] }>;
  save(reason: 'interval' | 'purchase' | 'hidden' | 'manual'): Promise<boolean>;
  exportCode(): Promise<string>;          // base64 of JSON (CompressionStream gzip when available), with checksum
  importCode(code: string): Promise<boolean>;
  backups(): Promise<BackupInfo[]>;       // rotating + daily
  restore(id: string): Promise<boolean>;
}
export interface Migration { from: number; to: number; up(old: any): any }   // pure, tested with fixtures
```
- **Writes:** serialize → checksum (FNV-1a 32 over the JSON) → write to the next of 3 rotating slots in IndexedDB → mirror to localStorage (same rotation, v2 scheme `key:0..2`) → mark slot pointer last. Load picks the newest slot whose checksum verifies; falls back across stores; then to daily backups; then fresh.
- **Backups:** one daily snapshot kept for 7 days; a pre-migration snapshot always written before migrating.
- **When:** every 10 s if dirty, after purchases/unlocks, on `visibilitychange` hidden and `pagehide`.
- **Validation/repair:** schema check on load; clamp money ≥ 0, stars never drop, unknown ids dropped with a note; repairs listed in the perf meter log.
- **Migration:** `version` integer; chain of `Migration`s; each has a fixture save test (`tests/fixtures/saves/v<N>.json`). v2 save (`sabrinin-bufesi-v2`, version 1) importer maps money, gold, day, tiers, owned pads, workers, cats, decor, sign, settings. In the artifact the origin differs from v2, so import works via exported JSON only (and directly in local dev).
- Storage all failing → in-memory session with a gentle Turkish warning and the export code button.
- Save holds only persistent state, never derived/runtime data. Real calendar date (seasons, daily rituals) is read once per session start/day boundary and passed into sim as an input.

## 18. Editor, prefabs, perf meter, hot reload

- **Scene editor** (`?edit=1`, or long-press the logo 3 s in dev builds): tap to select a prop/anchor/decor slot; drag on the ground (half-tile snap, 45° rotate, alt free); inspector (lil-gui) for prefab params, paint layers, anchors, nav cost paint; undo/redo. **Save positions**: writes a content override to IndexedDB (applies live) and offers "Kopyala" to copy the TS/JSON patch; builders paste it into `src/content/zones/*.ts`. Content overrides are versioned by content hash and ignored when content changes underneath.
- **Prefab editor:** edit a prefab def; `redefine()` rebuilds all instances.
- **Effect editor:** combine blocks, preview, copy def.
- **Clip recorder:** key joint sliders into a short clip.
- **Perf meter** (motor-11 "Hız ölçer"; Turkish label "Hız ölçer"): fps, frame ms (p50/p95), sim ms, render ms, draw calls, triangles, geometries, textures, JS heap if available, live particles, agents by LOD, zone states, build queue ms, and the **top 5 slowest systems** with a plain Turkish hint ("Kalabalık çizimi yavaşlatıyor"). "Raporu kopyala" button so the owner can paste numbers from their phone. Always available via settings, off by default.
- **Hot reload:** dev server (Vite HMR): content modules call `import.meta.hot.accept` → `content.replace(table)`; systems are re-registered with `Scheduler.replace` keeping `GameState` and component stores; views rebuild affected prefabs. In the published artifact, the editor's live content overrides give the same "no full reload" feel.

## 19. Quality auto-detect

Tier table = v2 `C.TIERS` + GDD budget table: akici (25 crowd, pr 1.0, no AA, blob shadows only, 30 fps), dengeli (50, pr 1.5, AA, 1024 shadows, 60 fps), sahane (90, pr 2.0, AA, 2048 soft, 60 fps).
1. Guess from `deviceMemory`/`hardwareConcurrency` (v2 `guessTier`).
2. 3 s hidden probe during boot (off-screen 90 citizens + kiosk; GDD thresholds: > 28 ms akici, 17-28 ms dengeli, else sahane).
3. Runtime watch on "Otomatik": 10 s average frame time > 1.5× target → drop one tier; back up only after 2 min calm; at most one change per minute. Result saved.
4. Settings: Otomatik / Düşük / Orta / Yüksek (motor-9), battery saver forces 30 fps.
5. 60/30 pacing: in 30 mode the loop renders every second rAF; sim is unaffected.

## 20. Determinism, headless sim, bot tests

- Sim is deterministic: seeded `RngStreams` (`sfc32`, one stream per system: `crowd`, `orders`, `gulls`, `events`, ...), no wall clock, fixed dt, stable iteration order (arrays, not object key order of untrusted maps), no floating dependency on render.
- `createSim({ seed, content, save?, startClock? }) -> Sim` runs in Node (`src/game/headless.ts`): `sim.step(sec)`, `sim.input(move)`, `sim.events()`, `sim.state()`, `sim.hash()`.
- **Replays:** `{ seed, contentHash, inputs[] }` → final `sim.hash()` must match golden files (`tests/golden/*.json`).
- Same hooks in the browser as `window.__marti` (superset of v2 `window.__bufe`: `ready, play(hero), input(x,z), step(sec), render(), renderFrames(n,dt), state(), info(), events(since), force.{ferry,gull,kapkac,regular,vip,endDay,money,gold,stars,sleep}, save(), resetSave(), path(a,b), zone(id), teleport(x,z), setTime(hour), setTier(name), camera(at,zoom)`), so v2 bot scripts port with minimal changes.
- URL params: `?seed=&fresh=1&tier=&save=<key>&noloop&noart&edit=1&time=<hour>&zone=<id>&parity=1`.
- Headless bots run fast in Node (target: one 4-minute game day in < 2 s); browser bots validate visuals, UI and real wiring.
