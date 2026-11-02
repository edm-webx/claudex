/**
 * Martı Motoru: shared engine interfaces.
 * Lead-owned, FROZEN at kickoff (CONTRACT.md). Builders code against this file and request changes, never edit it.
 *
 * Conventions (decisions where MOTOR.md was silent):
 * - Ground plane is X/Z, Y up, metres. `Vec2` is a ground point `{ x, z }` (not x/y). Screen points use `ScreenPt { x, y }` in CSS px.
 * - Rotations are radians; `rotY`/`rot` is yaw around +Y, 0 = facing +Z.
 * - Every factory is `createX(deps: XDeps): X`, exported from the owning folder's `index.ts`.
 * - Only `import type` from three here, so pure modules (sim, core, ecs, save, nav) may import this file without pulling three.
 * - Pure-side interfaces (Loop, World, Scheduler, SaveStore, Nav, InteractionRegistry, Sim) never take DOM/three types.
 */
import type { Object3D, Texture, Scene, PerspectiveCamera, Camera, Frustum, WebGLRenderer, Material } from 'three';
import type { GameState } from '../game/sim/schema';
import type { SimEvents, EventName } from '../game/events';
import type { Content } from '../content/types';

// ───────────────────────────── basic types ─────────────────────────────

/** Ground point/vector in metres: x = east, z = south (toward camera). */
export interface Vec2 { x: number; z: number; }
export interface Vec3 { x: number; y: number; z: number; }
/** Euler angles in radians (XYZ order), pure replacement for THREE.Euler in sim/anim data. */
export interface Rot3 { x: number; y: number; z: number; }
/** Axis-aligned ground rectangle, x0 <= x1, z0 <= z1. */
export interface Rect { x0: number; z0: number; x1: number; z1: number; }
export interface ScreenPt { x: number; y: number; }
export type Disposer = () => void;

// ───────────────────────────── core (A) ─────────────────────────────

/** Seeded PRNG (sfc32). Deterministic; state can be saved/restored. */
export interface Rng {
  next(): number;                                  // [0,1)
  range(a: number, b: number): number;             // [a,b)
  int(a: number, b: number): number;               // inclusive
  pick<T>(arr: readonly T[]): T;
  weighted<K extends string>(w: Partial<Record<K, number>>): K;
  chance(p: number): boolean;
  getState(): [number, number, number, number];
  setState(s: [number, number, number, number]): void;
}
/** One stream per system (`crowd`, `orders`, `gulls`, `events`, ...). Streams derive from (seed, name), order-independent. */
export interface RngStreams { readonly seed: number; stream(name: string): Rng; }

export interface EventRecord<N extends string = string> { tick: number; t: number; name: N; data?: unknown; }
/** Typed event bus. Sim emits, views/audio/UI subscribe. Keeps a bounded log for bots (`events(since)`). */
export interface Bus<E extends object> {
  emit<K extends keyof E & string>(name: K, data: E[K]): void;
  on<K extends keyof E & string>(name: K, cb: (data: E[K], rec: EventRecord<K>) => void): Disposer;
  onAny(cb: (rec: EventRecord) => void): Disposer;
  /** Records with index >= since (index = position in the full history, survives log trimming). */
  log(since?: number): EventRecord[];
  readonly count: number;
}

export type DayPhase = 'morning' | 'noon' | 'sunset' | 'night';
export type Season = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';

/** Game clock: 4-min day, 08:00..24:00, 1 game hour = 15 s. Pure, stepped by sim. */
export interface GameClock {
  readonly day: number;        // 1-based
  readonly dayT: number;       // seconds into the current day, 0..GAME_DAY_S
  readonly hour: number;       // 8..27 (float; 24+ is after midnight)
  readonly phase: DayPhase;
  readonly season: Season;     // from the real calendar, passed in at session start
}
export const GAME_DAY_S = 480; // survey: ~8 min game day
export const DAY_START_H = 8;
export const DAY_END_H = 27;   // survey 2026-10-24: the day runs until 03:00 (night is seen), then the gün sonu card

export interface Logger { info(...a: unknown[]): void; warn(...a: unknown[]): void; error(...a: unknown[]): void; }

// ───────────────────────────── platform guards (A) ─────────────────────────────

/** Parsed URL params (`?parity=1&time=<h>&stage=<n>&seed=<s>&noloop&noart&tier=<name>&edit=1&fresh=1&save=<key>&zone=<id>`). `#noart` hash also sets noart. */
export interface UrlParams {
  parity: boolean; time?: number; stage?: number; seed?: number; noloop: boolean; noart: boolean;
  tier?: TierName; edit: boolean; fresh: boolean; save?: string; zone?: string;
  raw: Record<string, string>;
}
/** Every browser API that may throw or be missing goes through here. No method ever throws. */
export interface Platform {
  readonly params: UrlParams;
  storage: { available: boolean; get(key: string): string | null; set(key: string, v: string): boolean; del(key: string): void; keys(prefix: string): string[]; };
  idb: { available(): Promise<boolean>; get<T = unknown>(key: string): Promise<T | undefined>; set(key: string, v: unknown): Promise<boolean>; del(key: string): Promise<void>; keys(prefix: string): Promise<string[]>; };
  /** Created lazily on first user gesture; null if unavailable. */
  audioCtx(): AudioContext | null;
  vibrate(ms?: number): void;
  visibility: { readonly hidden: boolean; onChange(cb: (hidden: boolean, why: 'visibility' | 'pagehide' | 'test') => void): Disposer; simulate(hidden: boolean): void; };
  device: { memoryGB: number; cores: number; mobile: boolean; touch: boolean; reducedMotion: boolean; };
  /** Wall clocks: ONLY for loop pacing, perf and save timestamps. Never read from sim. */
  clock: { now(): number /* performance.now ms */; wall(): number /* Date.now ms */; };
  copyText(text: string): Promise<boolean>;
}

// ───────────────────────────── loop (A) ─────────────────────────────

export interface LoopOpts {
  simHz?: number;                  // default 30 (GDD)
  maxStepsPerFrame?: number;       // default 5; excess time dropped (sim slows, never explodes)
  step(dt: number): void;          // fixed sim tick, dt = 1/simHz
  render(frameDt: number, alpha: number): void;   // alpha 0..1 between previous and current sim state
  targetFps(): 60 | 30;            // 30 = render every second rAF
  /** Injected for tests/headless; default platform clock + requestAnimationFrame. */
  now?: () => number;
  raf?: (cb: (t: number) => void) => number;
  cancelRaf?: (id: number) => void;
  /** Called when a step/render throws (already caught). */
  onError?(where: 'step' | 'render', err: unknown): void;
}
export interface Loop {
  start(): void;
  stop(): void;
  pause(why: string): void;
  resume(): void;
  readonly paused: boolean;
  readonly pauseWhy: string;
  readonly tick: number;           // sim ticks run so far
  readonly simTime: number;        // seconds of sim time run
  /** Drive one frame manually at wall time `nowMs` (tests: render-rate independence). */
  frame(nowMs: number): void;
  /** Run whole fixed steps covering `sec` of sim time, no render (test hook `step(sec)`, `?noloop`). */
  advance(sec: number): void;
  /** Render once with alpha=1 (test hook `render()`). */
  renderNow(frameDt?: number): void;
}

// ───────────────────────────── ECS (A) ─────────────────────────────

/** index (low 20 bits) + generation (high bits); stale handles detected by `alive`. */
export type Entity = number;
export interface ComponentStore<T> {
  readonly name: string;
  has(e: Entity): boolean;
  get(e: Entity): T;               // throws in dev if missing; use has() first
  add(e: Entity, v: T): T;
  remove(e: Entity): void;
  each(fn: (e: Entity, v: T) => void): void;   // stable insertion order
  readonly size: number;
}
/** Struct-of-arrays store for hot data (crowd). Slots are reused; iterate 0..hi with alive(i). */
export interface SoAStore {
  readonly name: string;
  readonly cap: number;
  /** Highest used slot + 1. */
  readonly hi: number;
  readonly count: number;
  f32(field: string): Float32Array;
  u8(field: string): Uint8Array;
  u16(field: string): Uint16Array;
  i32(field: string): Int32Array;
  alloc(): number;                 // -1 when full; fields zeroed
  free(i: number): void;
  alive(i: number): boolean;
}
export type SoAFieldKind = 'f32' | 'u8' | 'u16' | 'i32';
export type SoASchema = Record<string, SoAFieldKind>;
export interface World {
  create(): Entity;
  destroy(e: Entity): void;
  alive(e: Entity): boolean;
  store<T>(name: string): ComponentStore<T>;
  /** Get or create; schema required on first call. */
  soa(name: string, cap: number, schema?: SoASchema): SoAStore;
}

export interface SimCtx {
  tick: number; dt: number; t: number;
  world: World;
  rng: RngStreams;
  bus: Bus<SimEvents>;
  state: GameState;
  content: Content;
  clock: GameClock;
  /** Input command for this tick (already logged for replay). */
  input: TickInput;
}
export interface System {
  id: string;
  order: number;                   // ascending within phase
  phase: 'sim' | 'view';
  step(ctx: SimCtx): void;
}
/** Runs systems; an exception disables the system for 1 s then retries; 3 strikes = off + perf warning. */
export interface Scheduler {
  add(s: System): void;
  replace(id: string, s: System): void;   // hot reload, keeps state
  remove(id: string): void;
  run(phase: 'sim' | 'view', ctx: SimCtx): void;
  timings(): Record<string, number>;      // last ms per system id
  disabled(): string[];
}
export interface WorldDeps { log?: Logger; }
export interface SchedulerDeps { perf?: PerfMeter; log?: Logger; now?: () => number; }

// ───────────────────────────── save (A) ─────────────────────────────

export type SaveReason = 'interval' | 'purchase' | 'hidden' | 'manual';
export interface BackupInfo { id: string; kind: 'daily' | 'premigration' | 'slot'; at: number; version: number; bytes: number; }
export interface Migration { from: number; to: number; up(old: any): any; }
export interface SaveLoadResult<S> { data: S; from: 'idb' | 'ls' | 'backup' | 'fresh'; repaired: string[]; }
export interface SaveStore<S> {
  load(): Promise<SaveLoadResult<S>>;
  save(reason: SaveReason): Promise<boolean>;
  markDirty(): void;
  /** Called by the loop owner each frame/tick with wall ms; saves every 10 s when dirty. */
  tick(nowMs: number): void;
  exportCode(): Promise<string>;
  importCode(code: string): Promise<boolean>;
  backups(): Promise<BackupInfo[]>;
  restore(id: string): Promise<boolean>;
  wipe(): Promise<void>;               // resetSave hook
  readonly mode: 'idb' | 'ls' | 'memory';
}
export interface SaveOpts<S> {
  key: string;                          // e.g. 'marti-bufe'
  version: number;                      // SAVE_VERSION
  defaults(): S;
  migrations: Migration[];
  /** Mutates in place (clamps money >= 0 etc.), returns repair notes. */
  validate(data: S): string[];
  /** Current persistent state to write. */
  get(): S;
  platform: Pick<Platform, 'storage' | 'idb' | 'clock'>;
  log?: Logger;
}

// ───────────────────────────── quality (A) ─────────────────────────────

export type TierName = 'akici' | 'dengeli' | 'sahane';
export type QualitySetting = 'auto' | TierName;   // Otomatik / Düşük / Orta / Yüksek
export interface TierDef {
  name: TierName; label: string;
  crowd: number;                 // 25 / 50 / 90
  gullsNear: number; gullsFar: number; pigeons: number;   // v2 C.TIERS
  pixelRatio: number;            // 1 / 1.5 / 2 (capped by devicePixelRatio)
  antialias: boolean;            // false / true / true
  shadows: boolean; shadowSize: number;   // off / 1024 / 2048
  fps: 60 | 30;                  // 30 / 60 / 60
  particles: number;             // 200 / 500 / 1000
  buildBudgetMs: number;         // 3 / 4 / 6
  maxLiveZones: number;          // hot+warm cap 2 / 3 / 4
  heroes: number;                // individual rigs 12 / 16 / 16
  flags: Record<string, boolean>; // render upgrades (MOTOR §11), e.g. cloudShadows, bloom
}
export interface Quality {
  current(): TierDef;
  setting(): QualitySetting;
  set(s: QualitySetting): void;            // persists
  onChange(cb: (t: TierDef, why: 'auto' | 'manual' | 'probe' | 'url') => void): Disposer;
  /** Feed every rendered frame; auto mode drops a tier after 10 s avg > 1.5x target, rises after 2 min calm, max 1 change/min. */
  feed(frameMs: number, dt: number): void;
  batterySaver(on: boolean): void;         // forces 30 fps
  table: Readonly<Record<TierName, TierDef>>;
}
export interface QualityDeps { platform: Platform; log?: Logger; }

// ───────────────────────────── input (A) ─────────────────────────────

export interface TapEvent { screen: ScreenPt; t: number; pickId: string | null; }
export interface InputState {
  move: Vec2;                    // joystick -1..1 in world X/Z (camera has no yaw)
  moving: boolean;
  taps: TapEvent[];              // drained each frame
  pinch?: number;                // zoom delta this frame (multiplicative, 1 = none)
  orbit?: number;                // camera yaw delta this frame, radians (two-finger twist or middle-drag)
  tilt?: number;                 // camera pitch delta this frame, radians (middle-drag vertical)
  recenter?: boolean;            // middle-click without drag: ease the camera back to its flat default
  hand: 'left' | 'right';
}
/** What the sim receives each tick (logged for replays). */
export interface TickInput { tick: number; move: Vec2; }

export type InteractKind = 'station' | 'counter' | 'pad' | 'table' | 'npc' | 'door' | 'pickup';
/** Dwell rule (MOTOR §8, binding): act only when actor inside `radius` AND speed < DWELL_SPEED_MAX for `dwell` s. */
export interface Interactable {
  id: string;
  pos: Vec2;
  radius: number;                // metres
  kind: InteractKind;
  dwell: number;                 // seconds; defaults in DWELL_DEFAULTS
  /** Max transfers per visit; undefined = until act() returns 'done' (hands full). */
  takeLimit?: number;
  /** Seconds between act() calls once dwell completed; default TRANSFER_INTERVAL. */
  interval?: number;
  /** Pass-by pickup (money): acts on contact at any speed, no dwell, no ring; every `interval` while inside. */
  passBy?: boolean;
  canAct(actor: Entity): boolean;
  act(actor: Entity, ctx: SimCtx): 'continue' | 'done';
}
export const DWELL_SPEED_MAX = 0.6;         // m/s
export const TRANSFER_INTERVAL = 0.18;      // s, v2 cadence
export const DWELL_DEFAULTS: Readonly<Record<InteractKind, number>> = {
  station: 0.4, counter: 0.25, pad: 0, pickup: 0, table: 0.4, npc: 0.4, door: 0.25,
};
export interface DwellStatus { id: string; progress: number /* 0..1 ring fill */; transferring: boolean; transfers: number; }
/**
 * Pure, sim-side registry (lives in engine/input but must not touch DOM).
 * Semantics: dwell timer runs while inside radius and speed < DWELL_SPEED_MAX; leaving the radius OR exceeding the speed resets it
 * and stops transfers in the same tick. First act() fires on the tick the dwell completes (dwell 0 = on contact), then every `interval`.
 * Only the nearest eligible interactable per actor dwells at a time.
 */
export interface InteractionRegistry {
  register(i: Interactable): Disposer;
  unregister(id: string): void;
  get(id: string): Interactable | undefined;
  /** Call once per sim tick per actor. */
  update(actor: Entity, pos: Vec2, speed: number, ctx: SimCtx): void;
  status(actor: Entity): DwellStatus | null;
  all(): readonly Interactable[];
}
export interface Input {
  state(): InputState;
  /** Called by boot each frame; drains taps. */
  poll(): InputState;
  onTap(cb: (e: TapEvent) => void): Disposer;
  setHand(h: 'left' | 'right'): void;
  /** Test hook `input(x,z)`: overrides joystick until cleared with null. */
  inject(move: Vec2 | null): void;
  /** Screen-space pick resolver (render.pick). */
  setPicker(fn: (p: ScreenPt) => string | null): void;
  readonly interactions: InteractionRegistry;
  dispose(): void;
}
export interface InputDeps { canvas: HTMLCanvasElement; root: HTMLElement; platform: Platform; }

// ───────────────────────────── perf + hooks (A) ─────────────────────────────

export interface PerfSnapshot {
  fps: number; frameP50: number; frameP95: number; simMs: number; renderMs: number;
  calls: number; tris: number; geos: number; texs: number; heapMB?: number; particles: number;
  agentsByLod: [number, number, number]; zones: Record<string, ZoneState>; buildMs: number;
  timers: Record<string, number>; counters: Record<string, number>; slowest: { id: string; ms: number; hint: string }[];
  warnings: string[]; tier: TierName;
}
/** "Hız ölçer". time/count are cheap no-allocation calls usable in hot loops. */
export interface PerfMeter {
  time<T>(name: string, fn: () => T): T;
  begin(name: string): void;
  end(name: string): number;
  count(name: string, n: number): void;
  frame(frameMs: number): void;
  warn(msg: string): void;
  /** Extra sources merged into snapshot (render.info, zones, fx). */
  source(name: string, fn: () => Partial<PerfSnapshot>): void;
  snapshot(): PerfSnapshot;
  report(): string;               // "Raporu kopyala" text
  show(on: boolean): void;        // DOM overlay (no-op headless)
  readonly visible: boolean;
}
export interface PerfDeps { platform?: Platform; root?: HTMLElement; }

/** `window.__marti` surface (M0). Builders register more via hooks.register; M1 adds the v2 `__bufe` surface. */
export interface MartiHooks {
  ready(): boolean;
  step(sec: number): void;
  render(): void;
  renderFrames(n: number, dt: number): void;
  state(): Record<string, unknown>;    // pos, tier, zones, time, fpsProxy, ...
  info(): Record<string, unknown>;     // calls, tris, geos, texs, perf timers
  setTime(hour: number): void;
  setStage(n: number): void;
  setTier(name: TierName): void;
  teleport(x: number, z: number): void;
  camera(o: { x?: number; z?: number; zoom?: number }): void;
  input(x: number, z: number): void;
  zone(id: string): unknown;
  events(since?: number): EventRecord[];
  save(): Promise<boolean>;
  resetSave(): Promise<void>;
  loseContext(): void;
  restoreContext(): void;
  hide(): void;
  show(): void;
  editor: { select(id: string): void; drag(id: string, x: number, z: number): void; save(): unknown };
  [extra: string]: unknown;
}
export interface TestHooks {
  /** Adds/overwrites `window.__marti[name]` (dotted names nest: 'editor.select'). Safe headless (plain object). */
  register(name: string, fn: unknown): void;
  get(): Partial<MartiHooks>;
  setReady(on: boolean): void;
}
export interface HooksDeps { target?: Record<string, unknown>; }

// ───────────────────────────── camera (B) ─────────────────────────────

export const CAMERA_FOV = 38;          // degrees
export const CAMERA_PITCH = 0.92;      // radians
export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2.1;
/**
 * v2 updateCamera port: dist = clamp(max(6.6/(tanV*aspect), 6.2/tanV), 13, 40) * zoom;
 * position = (cx, sin(pitch)*dist, cz + 0.4 + cos(pitch)*dist); lookAt(cx, 0.6, cz + 0.4). No rotation.
 */
export interface CameraRig {
  readonly camera: PerspectiveCamera;
  readonly fov: number;
  readonly pitch: number;
  zoom: number;                              // clamped ZOOM_MIN..ZOOM_MAX, default 1
  follow(target: Vec2, dt: number): void;    // lerp factor min(1, dt*4)
  snap(target: Vec2): void;
  pan(at: Vec2, dur?: number): Promise<void>; // 1.2..2 s ease in, hold, ease out
  intro(seconds?: number): Promise<void>;    // default 3.2: dist x2.6 -> x1, pitch 1.25 -> 0.92
  photoMode(on: boolean): void;
  setAspect(aspect: number): void;
  /** Applies interpolation and writes camera matrices; call once per render. */
  update(dt: number, alpha: number): void;
  focus(): Vec2;
  frustum(): Frustum;
}
export interface CameraDeps { aspect: number; }

// ───────────────────────────── dress (B) ─────────────────────────────

export type SlotKind = 'mesh' | 'texture' | 'atlasRect' | 'sound' | 'music' | 'portrait' | 'panorama';
export type SlotValue = Object3D | Texture | AudioBuffer | null;
/** Slot id convention: char.<who>.<part>, prop.<zone>.<thing>.<stage>, tex.<name>, sky.<phase>, ui.<icon>, sfx.<name>, music.<zone>.<variant>, ad.<surface>. */
export interface SlotDef {
  id: string;
  kind: SlotKind;
  fallback: () => SlotValue;
  hints?: { size?: Vec3; anchor?: Vec3; maxTris?: number; texSize?: number };
}
export interface ArtEntry { file: string; rect?: [number, number, number, number]; scale?: number; offset?: Vec3; }
export type ArtManifest = Record<string, ArtEntry>;
export interface Dress {
  define(def: SlotDef): void;
  has(id: string): boolean;
  get<T = SlotValue>(id: string): T;          // fallback immediately; art swapped in when loaded
  when<T = SlotValue>(id: string, cb: (v: T) => void): Disposer;
  manifest(m: ArtManifest): void;
  preload(slotIds: readonly string[]): Promise<void>;  // per zone; never blocks play
  missing(): string[];
  /** `?noart`: code art only. */
  readonly noart: boolean;
}
export interface DressDeps { platform: Platform; noart: boolean; baseUrl?: string; log?: Logger; }

// ───────────────────────────── prefab (B) ─────────────────────────────

export type PartShape = 'roundBox' | 'box' | 'cyl' | 'sphere' | 'capsule' | 'lathe' | 'extrude' | 'plane' | 'slot';
export interface PartDef {
  shape: PartShape;
  size: [number, number, number];     // roundBox/box: w,h,d; cyl: rTop,h,rBottom; sphere: r,-,-; capsule: r,len,-; plane: w,-,d
  pos?: [number, number, number];
  rot?: [number, number, number];
  color?: string;                      // vertex colour (shared Lambert material)
  mat?: string;                        // named material from the shared cache ('plank', 'glass', 'neon', ...)
  slot?: string;                       // dressing slot id (shape 'slot' or texture override)
  radius?: number;                     // roundBox corner radius
  segments?: number;
  points?: [number, number][];         // lathe/extrude profile
  castShadow?: boolean; receiveShadow?: boolean;
  name?: string;                       // addressable for editor/animation
  children?: PartDef[];
}
export interface AnchorDef {
  pos: Vec2; y?: number; rotY?: number;
  kind?: 'queue' | 'door' | 'bench' | 'perch' | 'decor' | 'spawn' | 'station' | 'seat' | 'marker' | string;
  tags?: string[];
}
export interface InteractDef { id: string; kind: InteractKind; at: Vec2; radius: number; dwell?: number; takeLimit?: number; }
export interface PrefabPlacement {
  id: string;                          // unique within zone; editor key
  prefab: string;
  pos: Vec2;
  y?: number;
  rotY?: number;
  scale?: number;
  overrides?: Record<string, number | string | boolean>;
  paint?: { material?: string; color?: string; pattern?: string };
}
export interface PrefabDef {
  id: string;
  params?: Record<string, number | string | boolean>;
  parts: PartDef[];
  children?: PrefabPlacement[];
  colliders?: Rect[];                  // local space, used to bake walk grids
  anchors?: Record<string, AnchorDef>; // local space
  interact?: InteractDef[];
  lod?: { far: string; dist: number };
  paint?: { material: string[]; color: string[]; pattern: string[] };
  /** Escape hatch for v2 builder ports that cannot be expressed as parts: returns geometry using the shared material cache. */
  build?: (params: Record<string, number | string | boolean>, kit: PrefabKit) => Object3D;
  /** Repeated props (stools, bollards) drawn instanced. */
  instanced?: boolean;
}
/** Helpers handed to custom prefab builders (shared materials, roundBox, dress). */
export interface PrefabKit {
  mat(name: string, color?: string): Material;
  roundBox(w: number, h: number, d: number, r?: number, seg?: number): import('three').BufferGeometry;
  dress: Dress;
}
export interface BuiltPrefab {
  id: string;
  object: Object3D;
  colliders: Rect[];
  anchors: Record<string, AnchorDef>;
  interact: InteractDef[];
  dispose(): void;
}
export interface PrefabInstance {
  readonly id: string;                 // placement id
  readonly prefab: string;
  readonly object: Object3D;
  placement: PrefabPlacement;
  setPlacement(p: Partial<PrefabPlacement>): void;
  remove(): void;
}
export interface PrefabSystem {
  define(def: PrefabDef): void;
  has(id: string): boolean;
  def(id: string): PrefabDef | undefined;
  /** Cached by (id, params hash); merged per material. */
  build(id: string, overrides?: Record<string, number | string | boolean>): BuiltPrefab;
  place(p: PrefabPlacement, parent: Object3D): PrefabInstance;
  instances(id?: string): PrefabInstance[];
  instance(placementId: string): PrefabInstance | undefined;
  redefine(def: PrefabDef): void;      // all instances rebuild
  kit: PrefabKit;
}
export interface PrefabDeps { dress: Dress; perf?: PerfMeter; log?: Logger; }

// ───────────────────────────── zones (B) ─────────────────────────────

export interface WalkGridDef {
  cell: number;                        // 0.5
  origin?: Vec2;                       // default bounds.x0/z0
  /** Bake blocked cells from prop colliders. */
  bake: boolean;
  /** Painted overrides applied after bake (cost 0 = blocked, 1..254). */
  paint?: { rect: Rect; cost: number }[];
}
export interface ShopHours { shop: string; open: number; close: number; days?: number[]; }
export interface Portal { id: string; to: string; a: Vec2; b: Vec2; }
export interface ZoneDef {
  id: 'iskele' | 'carsi' | 'test-sokak' | string;
  name?: string;
  bounds: Rect;                        // world metres; zones share one coordinate space
  walk: WalkGridDef;
  props: PrefabPlacement[];
  anchors: Record<string, AnchorDef>;
  portals: Portal[];
  ambience: { music: string; loops: string[]; lightMood?: string };
  dressing: string[];
  schedule?: ShopHours[];
  /** Never drops below this state (pier: 'sim'). */
  minState?: ZoneState;
  playerStart?: Vec2;
}
/** cold: persistent data only. sim: agents coarse, no meshes. warm: meshes built (hidden/far). hot: visible full detail. */
export type ZoneState = 'cold' | 'sim' | 'warm' | 'hot';
export const ZONE_DIST = { hot: 0, warm: 25, sim: 60, hysteresis: 8 } as const;
export interface ZoneManager {
  register(def: ZoneDef): void;
  replace(def: ZoneDef): void;                         // hot reload / editor
  def(id: string): ZoneDef | undefined;
  ids(): string[];
  /** Decides target states and runs the build job queue within the tier budget. Call once per render frame. */
  update(playerPos: Vec2, camFrustum?: Frustum): void;
  state(id: string): ZoneState;
  states(): Record<string, ZoneState>;
  onState(cb: (id: string, s: ZoneState) => void): Disposer;
  /** Test hook: force a state (bypasses distance). null releases. */
  force(id: string, s: ZoneState | null): void;
  /** Zone-root object (exists once warm). */
  root(id: string): Object3D | null;
  anchors(id: string): Record<string, AnchorDef>;      // world space, incl. prefab anchors
  walkGrid(id: string): WalkGrid;                      // baked; available from 'sim' (pure data)
  interactables(id: string): InteractDef[];
  zoneAt(p: Vec2): string | null;
  buildMs(): number;                                   // last frame's build slice
  pending(): number;                                   // queued jobs
}
export interface ZonesDeps { scene: Scene; prefab: PrefabSystem; dress: Dress; quality: Quality; perf?: PerfMeter; log?: Logger; }

// ───────────────────────────── nav (C) — pure ─────────────────────────────

/** cost: 0 blocked, 1..254 walkable cost; index = iz*w + ix; cell centre = origin + (i+0.5)*cell. */
export interface WalkGrid { cell: number; w: number; h: number; origin: Vec2; cost: Uint8Array; zone?: string; }
export interface FlowField {
  readonly target: string;
  /** Writes the unit direction toward the target into `out` (no allocation). Returns false if unreachable. */
  dirAt(p: Vec2, out: Vec2): boolean;
  distAt(p: Vec2): number;
}
export interface SpatialHash {
  clear(): void;
  insert(i: number, x: number, z: number): void;
  /** Fills `out` with indices within r; returns count. */
  query(x: number, z: number, r: number, out: Int32Array | number[]): number;
}
export interface Steering { separate(agents: SoAStore, hash: SpatialHash, i: number, out: Vec2): Vec2; }
export interface Nav {
  addGrid(g: WalkGrid): void;
  removeGrid(zone: string): void;
  path(from: Vec2, to: Vec2, opts?: { maxNodes?: number }): Vec2[];   // A* octile + string pulling; [] if none
  walkable(p: Vec2): boolean;
  nearestWalkable(p: Vec2, out: Vec2): boolean;
  /** Collision for player movement: slides `to` along blocked cells; writes result to out. With `solids`, the exact
   *  collider rects (setSolids) also stop the circle, whatever the grid resolution (thin walls, door jambs). */
  move(from: Vec2, to: Vec2, radius: number, out: Vec2, opts?: { solids?: boolean }): Vec2;
  /** Exact collider rects of a zone (walls, counters, props), used by move(..., { solids: true }). */
  setSolids(key: string, rects: Rect[]): void;
  defineTarget(id: string, at: Vec2): void;
  flowTo(targetId: string): FlowField;                   // cached
  zonePath(fromZone: string, toZone: string): string[];  // portal ids
  setBlocked(rect: Rect, on: boolean): void;             // invalidates caches
  hash(cell?: number): SpatialHash;
  steering: Steering;
}
export interface NavDeps { portals?: { zone: string; portal: Portal }[]; log?: Logger; }

// ───────────────────────────── anim (C) ─────────────────────────────

export type GaitId = 'normal' | 'waddle' | 'brisk' | 'slow' | 'shuffle' | 'kid' | 'run';
export interface Gait { id: GaitId; stride: number; freq: number; bob: number; sway: number; armSwing: number; }
export type ExprId = 'neutral' | 'smile' | 'grin' | 'laugh' | 'surprised' | 'sleepy' | 'pout' | 'grumpy' | 'love' | 'wink' | 'thinking' | 'bliss';
export type BrowId = 'flat' | 'up' | 'down' | 'worried' | 'oneUp';
export type ActId = 'none' | 'idle' | 'walk' | 'carry' | 'cut' | 'pour' | 'serve' | 'sit' | 'sip' | 'eat' | 'wave' | 'sleep' | 'sweep' | 'phone' | 'grab' | 'cheer' | 'perform' | 'dance';
export type Mood = 'happy' | 'ok' | 'impatient' | 'sad' | 'asleep';
export type EmoteId = 'clap' | 'shrug' | 'facepalm' | 'raiseTea';
export type IdleId = 'twirlMustache' | 'sipTea' | 'stretchYawn' | 'phone' | 'stareGull' | 'tapFoot';
export type ClipId = string;
export interface RigPose {
  root: Vec3; lean: number; bob: number; torsoTwist: number;
  head: Rot3; armL: Rot3; armR: Rot3; legL: Rot3; legR: Rot3;
}
export interface AnimLayerInput {
  speed: number;           // m/s
  carry: number;           // stack height 0..1
  act: ActId;
  mood: Mood;
  expr?: ExprId;
  brow?: BrowId;
  emote?: EmoteId;
  t: number;
}
export interface Animator {
  readonly gait: Gait;
  setGait(g: GaitId | Gait): void;
  /** Writes into and returns an internal pose object (no per-frame allocation). */
  update(dt: number, inp: AnimLayerInput): RigPose;
  play(clip: ClipId, opts?: { additive?: boolean; speed?: number }): void;
  emote(e: EmoteId): void;
}
export interface Spring1D { k: number; d: number; value: number; vel: number; step(target: number, dt: number): number; }
/** Authored clip, ≤ 2 s, Hermite-interpolated, blended additive or override with 0.15 s fade. */
export interface ClipDef { id: ClipId; len: number; loop: boolean; tracks: Record<string, [number, number, number, number][]>; }
export interface AnimApi {
  gaits: Readonly<Record<GaitId, Gait>>;
  createAnimator(gait: GaitId, seed?: number): Animator;
  spring(k: number, d: number, v0?: number): Spring1D;
  defineClip(c: ClipDef): void;
  clip(id: ClipId): ClipDef | undefined;
  /** Toy squash-and-pop on an object (unlocks, purchases, item lands). View side. */
  squashPop(o: Object3D, amount?: number): void;
  /** Advance view-side tweens (squashPop etc.). */
  update(dt: number): void;
}
export interface AnimDeps { log?: Logger; }

// ───────────────────────────── characters (C, views) ─────────────────────────────

/** Look options use the same names as v2 SB.chars so ports are 1:1. Unknown keys pass through. */
export interface CharLook {
  skin?: number; body?: string; hair?: string; hairColor?: string; top?: string; bottom?: string; hat?: string;
  apron?: string;           // apron text, e.g. 'SABRİ' / 'SABRİYE'
  typeId?: string; seed?: number; scale?: number;
  [k: string]: unknown;
}
export interface HeroHandle {
  readonly object: Object3D;
  readonly animator: Animator;
  setPose(pos: Vec2, rotY: number): void;
  setInput(inp: Partial<AnimLayerInput>): void;
  setExpr(e: ExprId, brow?: BrowId): void;
  setCarry(items: string[]): void;
  lookAt(p: Vec3 | null): void;
  update(dt: number, alpha: number): void;
  dispose(): void;
}
export interface CrowdView {
  readonly object: Object3D;
  /** Reads the agents SoA (prev/cur interpolated with alpha) and writes instance attributes. */
  update(agents: SoAStore, dt: number, alpha: number): void;
  setBudget(n: number): void;
  visible(): number;
  dispose(): void;
}
export interface AnimalOpts { [k: string]: unknown; }
export interface Chars {
  makeHero(opts: CharLook): HeroHandle;
  crowd: CrowdView;
  makeCat(opts?: AnimalOpts): HeroHandle;
  makeDog(opts?: AnimalOpts): HeroHandle;
  makeGull(opts?: AnimalOpts): HeroHandle;
  makeFlock(opts?: AnimalOpts): { object: Object3D; update(dt: number): void; dispose(): void };
  makePigeons(opts?: AnimalOpts): { object: Object3D; update(dt: number): void; dispose(): void };
  /** Face atlas texture (eyes row x mouth row). */
  faceAtlas(): Texture;
  update(dt: number, alpha: number): void;
}
export interface CharsDeps { scene: Scene; anim: AnimApi; dress: Dress; quality: Quality; fx?: Fx; perf?: PerfMeter; }

// ───────────────────────────── fx (C) ─────────────────────────────

export interface EmitterBlock { kind: 'burst' | 'stream' | 'ring' | 'trail'; rate?: number; count?: number; shape?: 'point' | 'disc' | 'box'; size?: Vec3; }
export type ModuleBlock =
  | { kind: 'velocity'; dir: Vec3; spread: number; speed: [number, number] }
  | { kind: 'gravity'; g: number }
  | { kind: 'drag'; k: number }
  | { kind: 'wind'; scale: number }
  | { kind: 'colorOverLife'; stops: [number, string, number][] }   // [t, colour, alpha]
  | { kind: 'sizeOverLife'; stops: [number, number][] }
  | { kind: 'spin'; speed: [number, number] }
  | { kind: 'sprite'; atlas: string; frames: number[] }
  | { kind: 'flash'; color: string; intensity: number; dur: number };
export interface EffectDef {
  id: string;
  life: [number, number];
  emitters: EmitterBlock[];
  modules: ModuleBlock[];
  children?: { effect: string; delay: number }[];
  tierScale?: [number, number, number];   // count multiplier akici/dengeli/sahane
  duration?: number;                      // stream length in s; undefined = until stopped
}
export interface FxHandle { readonly alive: boolean; stop(): void; moveTo(at: Vec3): void; }
export interface Fx {
  define(d: EffectDef): void;
  redefine(d: EffectDef): void;
  has(id: string): boolean;
  play(id: string, at: Vec3 | Object3D, opts?: { scale?: number }): FxHandle;
  update(dt: number): void;
  live(): number;                          // live particles (perf budget)
  setTier(t: TierDef): void;
}
export interface FxDeps { scene: Scene; quality: Quality; dress?: Dress; perf?: PerfMeter; }

// ───────────────────────────── render (B) ─────────────────────────────

export interface WeatherState { kind: 'clear' | 'rain' | 'lodos' | 'snow' | 'fog'; amount: number; wetness?: number; }
export interface RenderInfo { calls: number; tris: number; geos: number; texs: number; gpuMs?: number; }
export interface RenderPipeline {
  init(canvas: HTMLCanvasElement, tier: TierDef): void;
  setTier(t: TierDef): void;                        // recreates renderer only if AA changes
  setTime(hour: number, season?: Season): void;     // 4-phase blend, v2 world.setTime table
  setWeather(w: WeatherState): void;
  frame(scene: Scene, cam: Camera, alpha: number): void;
  info(): RenderInfo;
  resize(): void;
  readonly scene: Scene;
  readonly camera: CameraRig;
  readonly renderer: WebGLRenderer | null;
  /** Screen-space pick list (no mesh raycast). */
  registerPick(id: string, worldPos: Vec3, radius: number): Disposer;
  updatePick(id: string, worldPos: Vec3): void;
  pick(p: ScreenPt): string | null;
  worldToScreen(p: Vec3, out: ScreenPt): boolean;   // false if behind camera
  /** Context loss: pause rendering; restore rebuilds GPU resources from the scene description. */
  onContextLost(cb: () => void): Disposer;
  onContextRestored(cb: () => void): Disposer;
  loseContext(): void;                              // test hooks
  restoreContext(): void;
  dispose(): void;
}
export interface RenderDeps { canvas: HTMLCanvasElement; quality: Quality; dress: Dress; perf?: PerfMeter; log?: Logger; }

// ───────────────────────────── ui (D) ─────────────────────────────

export interface HudPatch { money?: number; gold?: number; stars?: number; level?: number; xp?: number; xpMax?: number; day?: number; hour?: number; rate?: number; carry?: string[]; [k: string]: unknown; }
export interface WorldLabel { set(text: string, kind?: 'say' | 'good' | 'bad' | 'info' | 'icon'): void; at(p: Vec3): void; show(on: boolean): void; release(): void; }
export interface CenterCard { title: string; body?: string; icon?: string; button?: string; kind?: 'unlock' | 'level' | 'day' | 'info'; }
export interface Notice { id: string; text: string; icon?: string; t: number; isNew?: boolean; }
export interface UiSettings { textScale: number; hand: 'left' | 'right'; colorBlindIcons: boolean; haptics: boolean; batterySaver: boolean; }
export interface Ui {
  hud(p: HudPatch): void;
  toast(text: string, kind: 'good' | 'bad' | 'info'): void;   // 3 s top strip
  label(): WorldLabel;                       // pooled, max 8 visible
  card(c: CenterCard): Promise<void>;
  sheet(id: string, model: unknown, actions: Record<string, (...a: any[]) => void>): void;
  close(): void;
  bell: { push(n: Notice): void; list(): Notice[] };
  transition(kind: 'kepenk' | 'spring'): Promise<void>;
  settings: UiSettings;
  /** Positions world labels; call once per render frame. */
  update(dt: number, project: (p: Vec3, out: ScreenPt) => boolean): void;
  /** Hide everything except HUD (parity mode) or everything (photo mode). */
  setMode(m: 'normal' | 'parity' | 'hidden'): void;
  root: HTMLElement;
}
export interface UiDeps { root: HTMLElement; platform: Platform; audio?: Audio; }

// ───────────────────────────── audio (D) ─────────────────────────────

export interface AudioBus { volume: number; muted: boolean; }
export interface Audio {
  buses: { music: AudioBus; sfx: AudioBus; voice: AudioBus };
  sfx(id: string, opts?: { at?: Vec2; vol?: number; pitch?: number }): void;
  music: { setZone(id: string): void; setPhase(p: DayPhase): void; setIntensity(v: number): void };
  ambience: { setListener(pos: Vec2): void };
  voice(lineId: string): void;              // ≤ 1 per 10 s
  ownMusicMode(on: boolean): void;
  /** Hidden page: suspend context. */
  suspend(on: boolean): void;
  /** Call on first user gesture. */
  unlock(): void;
}
export interface AudioDeps { platform: Platform; dress?: Dress; }

// ───────────────────────────── editor (D) ─────────────────────────────

export interface EditorAttach { render: RenderPipeline; prefab: PrefabSystem; zones: ZoneManager; dress: Dress; input: Input; fx?: Fx; anim?: AnimApi; }
export interface Editor {
  attach(o: EditorAttach): void;
  open(on: boolean): void;
  readonly active: boolean;
  select(id: string | null): void;
  drag(id: string, x: number, z: number): void;
  rotate(id: string, steps45: number): void;
  undo(): void;
  redo(): void;
  /** Writes content overrides to IndexedDB (applied live) and returns the TS/JSON patch text. */
  save(): Promise<string>;
  /** Content overrides keyed by placement id, applied by zones at register time. */
  overrides(zoneId: string): Record<string, Partial<PrefabPlacement>>;
}
export interface EditorDeps { platform: Platform; ui?: Ui; hooks?: TestHooks; }

// ───────────────────────────── sim (game) ─────────────────────────────

/** UI/bots -> sim. M1 narrows this with `src/game/sim/commands.ts` (A). */
export interface SimCommand { kind: string; [k: string]: unknown; }
/** Headless/browser sim facade (`createSim` in src/game/headless.ts). */
export interface Sim {
  readonly state: GameState;
  readonly world: World;
  readonly bus: Bus<SimEvents>;
  readonly clock: GameClock;
  step(sec: number): void;
  input(move: Vec2): void;
  command(c: SimCommand): void;
  events(since?: number): EventRecord<EventName>[];
  hash(): string;
}
export interface SimOpts { seed: number; content: Content; save?: GameState; startClock?: { day?: number; hour?: number }; season?: Season; }

/** A game-side view (pier world, HUD, ...): reads sim state, never writes it. */
export interface GameView {
  update(state: GameState, dt: number, alpha: number): void;
  dispose(): void;
}
/** Ambient walkers / citizen pool (C). M1 customers recruit from it. */
export interface AmbientSystem extends System {
  recruit(filter?: (typeId: string) => boolean): number;   // agent slot or -1
  release(agent: number): void;
}
/** M0 player movement + collision (A, src/game/sim/walk.ts). */
export interface PlayerWalk extends System {
  readonly pos: Vec2; readonly prev: Vec2; readonly rot: number; readonly speed: number;
  teleport(x: number, z: number): void;
}

/** Everything boot wires together; optional members may be fallbacks. */
export interface Engine {
  platform: Platform; loop: Loop; perf: PerfMeter; hooks: TestHooks; quality: Quality; input: Input;
  save: SaveStore<GameState>; render: RenderPipeline; dress: Dress; prefab: PrefabSystem; zones: ZoneManager;
  nav: Nav; anim: AnimApi; fx: Fx; chars: Chars; ui: Ui; audio: Audio; editor?: Editor; sim: Sim;
}
