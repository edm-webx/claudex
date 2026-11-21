/**
 * Zones and seamless streaming (MOTOR §6).
 * Decisions where MOTOR/CONTRACT are silent:
 * - Target state by distance from the player to the zone bounds: inside hot, <= 25 m warm, <= 60 m sim, else cold.
 *   Dropping a state needs the distance to exceed that state's limit + 8 m (hysteresis). minState and force() win.
 * - Reported state follows the build: a zone that should be warm/hot but is still building reports 'sim' until its
 *   last job ran, so 'warm'/'hot' always mean "meshes exist". warm and hot zones are both visible (seamless: a warm
 *   zone is what you see down the street); hot additionally means "the player is in it" (views animate hot zones).
 * - Build jobs: one per prop placement (prefab.place under the zone root) plus a final job (picks, onBuilt, then
 *   the root is shown; it stays hidden while building so a half-built zone never draws).
 *   update() runs jobs until the tier budget (quality.current().buildBudgetMs) is used. A job is started only if its
 *   estimated cost (last measured cost of the same prefab+params) fits half the budget (headroom for spikes),
 *   except the first job of a frame. Prefab templates are cached CPU-side, so return trips cost ~0.1 ms per placement.
 * - Leaving warm (to sim/cold): the zone's GPU buffers are freed (geometries + textures not used by another live
 *   zone root) and the root is detached. The detached root and its instances stay CPU-side (LRU, `retain`, default
 *   2 zones), so a return trip is one attach job; older ones drop their instances and rebuild from the cached
 *   templates. GPU memory counters return to baseline; three re-uploads on the next visit.
 * - Memory cap: at most quality.current().maxLiveZones zones warm/hot; the farthest extra ones are held at sim.
 * - Walk grid (pure data): cells start walkable (cost 1); prop colliders (prefab colliders / collidersFor, placed
 *   with the placement transform, AABB) are baked to 0; then walk.paint rects are applied in order (override).
 *   Available from registration on, independent of meshes.
 * - Anchors: zone anchors plus every placement's prefab anchors in world space as '<placementId>.<name>'.
 * - Extra deps (MotorZonesDeps): now() for tests, picks (render.registerPick) so props are tappable while built.
 */
import * as T from 'three';
import type { ZoneManager, ZonesDeps, ZoneDef, ZoneState, Vec2, Rect, AnchorDef, InteractDef, WalkGrid, PrefabInstance, Disposer, Vec3, PrefabPlacement } from '../api';
import { ZONE_DIST } from '../api';
import type { MotorPrefabSystem, Params } from '../prefab';

export interface MotorZonesDeps extends ZonesDeps {
  now?: () => number;
  /** Detached zone roots kept CPU-side after leaving (default 2); 0 rebuilds from templates on every visit. */
  retain?: number;
  picks?: { registerPick(id: string, p: Vec3, r: number): Disposer };
}
export interface MotorZones extends ZoneManager {
  /** Runs every pending build job now, ignoring the budget (boot, tests). With a position, decides targets first. */
  flush(playerPos?: Vec2): void;
  /** Dynamic colliders (stations, tables, decor placed by views) baked into the zone walk grid under `key`. */
  setColliders(id: string, key: string, rects: Rect[]): void;
  /** Re-bakes the walk grid in place (same WalkGrid object, cost array rewritten) and anchors; fires onGrid. */
  rebake(id: string): void;
  onGrid(cb: (id: string, grid: WalkGrid) => void): Disposer;
  /** Exact world-space collider rects of a zone (prop colliders, dynamic ones, blocked paint) for player collision. */
  colliders(id: string): Rect[];
  /** Instances placed in a zone (empty unless warm/hot). */
  instancesOf(id: string): PrefabInstance[];
  /** Target state (what streaming wants) vs state (what is built). */
  target(id: string): ZoneState;
  distance(id: string, p: Vec2): number;
  onBuilt(cb: (id: string, root: T.Object3D) => void): Disposer;
  /** Builds the CPU templates of every placement of a zone now (boot / loading time, not budgeted), so streaming
   *  the zone in later only clones (~0.1-0.3 ms per placement) and never pays a first-time template build. */
  prewarm(id: string): void;
  /** Slowest single build job since the last reset (tests, perf meter). */
  slowestJob(reset?: boolean): { key: string; ms: number };
  /** Max per-frame build slice seen since the last reset (tests). */
  maxBuildMs(reset?: boolean): number;
}

const RANK: Record<ZoneState, number> = { cold: 0, sim: 1, warm: 2, hot: 3 };
const LIMIT: Record<ZoneState, number> = { hot: ZONE_DIST.hot, warm: ZONE_DIST.warm, sim: ZONE_DIST.sim, cold: Infinity };

interface Job { zone: string; key: string; run(): void; }
interface ZoneRt {
  def: ZoneDef;
  state: ZoneState;      // reported
  target: ZoneState;     // wanted
  forced: ZoneState | null;
  root: T.Group | null;
  built: boolean;
  building: boolean;
  insts: PrefabInstance[];
  /** Detached root kept CPU-side after leaving (GPU freed); re-attached on the next visit. */
  cached: T.Group | null;
  cachedAt: number;
  picks: Disposer[];
  grid: WalkGrid | null;
  anchors: Record<string, AnchorDef> | null;
  dist: number;
  extra: Map<string, Rect[]>;
}

export function distToRect(p: Vec2, b: Rect): number {
  const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dz = Math.max(b.z0 - p.z, 0, p.z - b.z1);
  return Math.hypot(dx, dz);
}
function rawTarget(d: number): ZoneState { return d <= ZONE_DIST.hot ? 'hot' : d <= ZONE_DIST.warm ? 'warm' : d <= ZONE_DIST.sim ? 'sim' : 'cold'; }

/** Transforms a local rect by placement (rotY, scale, pos) into a world AABB. */
export function placeRect(r: Rect, pl: PrefabPlacement): Rect {
  const c = Math.cos(pl.rotY || 0), s = Math.sin(pl.rotY || 0), k = pl.scale || 1;
  const xs: number[] = [], zs: number[] = [];
  [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].forEach(([x, z]) => {
    // rotation about +Y by rotY: x' = x cos + z sin, z' = -x sin + z cos (three.js convention)
    xs.push(pl.pos.x + (x * c + z * s) * k); zs.push(pl.pos.z + (-x * s + z * c) * k);
  });
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}
function placePoint(x: number, z: number, pl: PrefabPlacement): Vec2 {
  const c = Math.cos(pl.rotY || 0), s = Math.sin(pl.rotY || 0), k = pl.scale || 1;
  return { x: pl.pos.x + (x * c + z * s) * k, z: pl.pos.z + (-x * s + z * c) * k };
}

export function createZones(deps: MotorZonesDeps): MotorZones {
  const prefab = deps.prefab as MotorPrefabSystem;
  const now = deps.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const zones = new Map<string, ZoneRt>();
  const order: string[] = [];
  const jobs: Job[] = [];
  const est = new Map<string, number>();
  const stateSubs = new Set<(id: string, s: ZoneState) => void>();
  const builtSubs = new Set<(id: string, root: T.Object3D) => void>();
  let lastBuildMs = 0, maxMs = 0, slowKey = '', slowMs = 0;

  const setState = (z: ZoneRt, s: ZoneState) => {
    if (z.state === s) return;
    z.state = s;
    stateSubs.forEach(cb => { try { cb(z.def.id, s); } catch (e) { deps.log?.warn('[zones] cb', e); } });
  };

  const gridSubs = new Set<(id: string, g: WalkGrid) => void>();
  function bakeGrid(def: ZoneDef, extra?: Map<string, Rect[]>): WalkGrid {
    const cell = def.walk.cell || 0.5;
    const origin = def.walk.origin || { x: def.bounds.x0, z: def.bounds.z0 };
    const w = Math.max(1, Math.ceil((def.bounds.x1 - origin.x) / cell)), h = Math.max(1, Math.ceil((def.bounds.z1 - origin.z) / cell));
    const cost = new Uint8Array(w * h).fill(1);
    const span = (a: number, b: number, o: number, n: number, solid: boolean): [number, number] => {
      let i0 = Math.ceil((a - o) / cell - 0.5), i1 = Math.floor((b - o) / cell - 0.5);
      // a collider thinner than a cell covers no cell centre: block the cell row under its midline (thin walls)
      if (solid && i0 > i1) i0 = i1 = Math.floor(((a + b) / 2 - o) / cell);
      return [Math.max(0, i0), Math.min(n - 1, i1)];
    };
    const fill = (r: Rect, v: number, solid = false) => {
      const [ix0, ix1] = span(Math.min(r.x0, r.x1), Math.max(r.x0, r.x1), origin.x, w, solid);
      const [iz0, iz1] = span(Math.min(r.z0, r.z1), Math.max(r.z0, r.z1), origin.z, h, solid);
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) cost[iz * w + ix] = v;
    };
    solidRects(def, extra).forEach(r => fill(r, 0, true));
    (def.walk.paint || []).forEach(p => fill(p.rect, Math.max(0, Math.min(254, p.cost | 0))));
    return { cell, w, h, origin: { ...origin }, cost, zone: def.id };
  }

  /** Every collider of a zone in world space: baked prop colliders plus the views' dynamic ones. */
  function solidRects(def: ZoneDef, extra?: Map<string, Rect[]>): Rect[] {
    const out: Rect[] = [];
    if (def.walk.bake) def.props.forEach(pl => {
      if (!prefab.has(pl.prefab)) return;
      prefab.colliders(pl.prefab, pl.overrides as Params | undefined).forEach(r => out.push(placeRect(r, pl)));
    });
    if (extra) extra.forEach(list => list.forEach(r => out.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 })));
    return out;
  }
  /** Colliders plus blocked paint (kerbs, water strips) that no later walkable paint opens again. */
  function playerSolids(def: ZoneDef, extra?: Map<string, Rect[]>): Rect[] {
    const out = solidRects(def, extra), paint = def.walk.paint || [];
    const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
    paint.forEach((p, i) => { if ((p.cost | 0) <= 0 && !paint.slice(i + 1).some(q => (q.cost | 0) > 0 && hit(p.rect, q.rect))) out.push({ ...p.rect }); });
    return out;
  }

  function computeAnchors(def: ZoneDef): Record<string, AnchorDef> {
    const out: Record<string, AnchorDef> = {};
    for (const k in def.anchors) out[k] = { ...def.anchors[k], pos: { ...def.anchors[k].pos } };
    def.props.forEach(pl => {
      if (!prefab.has(pl.prefab)) return;
      const a = prefab.anchors(pl.prefab, pl.overrides as Params | undefined);
      for (const k in a) out[pl.id + '.' + k] = { ...a[k], pos: placePoint(a[k].pos.x, a[k].pos.z, pl), rotY: (a[k].rotY || 0) + (pl.rotY || 0), y: (a[k].y || 0) + (pl.y || 0) };
    });
    return out;
  }

  function liveRoots(except: ZoneRt): T.Object3D[] {
    const out: T.Object3D[] = [];
    zones.forEach(z => { if (z !== except && z.root && (z.built || z.building)) out.push(z.root); });
    return out;
  }

  let cacheTick = 0;
  const retain = deps.retain != null ? Math.max(0, deps.retain | 0) : 2;
  function destroyInsts(z: ZoneRt) { z.insts.forEach(i => i.remove()); z.insts = []; z.cached = null; }
  /** Keeps at most `retain` detached roots (least recently left dropped first). */
  function trimCache() {
    const c = [...zones.values()].filter(z => z.cached).sort((a, b) => b.cachedAt - a.cachedAt);
    c.slice(retain).forEach(destroyInsts);
  }
  function unload(z: ZoneRt, dropCache = false) {
    // cancel queued jobs of this zone
    for (let i = jobs.length - 1; i >= 0; i--) if (jobs[i].zone === z.def.id) jobs.splice(i, 1);
    z.picks.forEach(d => d()); z.picks = [];
    if (z.root) {
      const keep = new Set<unknown>();
      liveRoots(z).forEach(r => r.traverse(n => {
        const m = n as T.Mesh; if (m.geometry) keep.add(m.geometry);
        const mat = m.material as T.Material | T.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(mm => {
          const rr = mm as unknown as Record<string, unknown>;
          ['map', 'emissiveMap', 'alphaMap'].forEach(k => { if (rr[k]) keep.add(rr[k]); });
          const u = (mm as T.ShaderMaterial).uniforms; if (u) Object.values(u).forEach(v => { if (v && (v as { value: unknown }).value) keep.add((v as { value: unknown }).value); });
        });
      }));
      prefab.disposeGpu(z.root, keep);
      deps.scene.remove(z.root);
      if (retain > 0 && !dropCache && z.built) { z.cached = z.root as T.Group; z.cachedAt = ++cacheTick; trimCache(); }
      else destroyInsts(z);
      z.root = null;
    }
    z.built = false; z.building = false;
  }

  function enqueueBuild(z: ZoneRt) {
    z.building = true;
    const id = z.def.id;
    if (z.cached) {
      const c = z.cached;
      jobs.push({ zone: id, key: id + ':attach', run() { z.cached = null; c.visible = false; deps.scene.add(c); z.root = c; } });
    } else jobs.push({ zone: id, key: id + ':root', run() {
      const root = new T.Group(); root.name = 'zone:' + id; root.userData.zone = id;
      root.visible = false; // shown by the done job: no partial pop-in, views fix up visibility (onBuilt) first
      deps.scene.add(root); z.root = root;
    } });
    if (!z.cached) z.def.props.forEach(pl => {
      jobs.push({ zone: id, key: pl.prefab + '|' + JSON.stringify(pl.overrides || {}), run() {
        if (!z.root) return;
        if (!prefab.has(pl.prefab)) { deps.log?.warn('[zones] unknown prefab', pl.prefab); return; }
        try { z.insts.push(prefab.place(pl, z.root)); } catch (e) { deps.log?.warn('[zones] place failed', pl.id, e); }
      } });
    });
    jobs.push({ zone: id, key: id + ':done', run() {
      if (!z.root) return;
      if (deps.picks) z.insts.forEach(i => {
        const p = i.placement; z.picks.push(deps.picks!.registerPick(i.id, { x: p.pos.x, y: (p.y || 0) + 0.5, z: p.pos.z }, 0.6));
      });
      z.building = false; z.built = true;
      builtSubs.forEach(cb => { try { cb(id, z.root!); } catch (e) { deps.log?.warn('[zones] built cb', e); } });
      z.root.visible = true;
      setState(z, RANK[z.target] >= RANK.warm ? z.target : 'sim');
    } });
  }

  function runJobs(budget: number) {
    const t0 = now();
    let ran = 0;
    while (jobs.length) {
      const j = jobs[0];
      const spent = now() - t0;
      const e = est.get(j.key) ?? 0.5;
      // soft target: later jobs only start while the slice stays under half the budget, leaving headroom for GC /
      // upload spikes inside a job (measured clone jobs are 0.1-0.3 ms; spikes up to ~3 ms on software GL)
      if (ran > 0 && spent + e > budget * 0.5) break;
      jobs.shift();
      const a = now();
      try { j.run(); } catch (err) { deps.log?.warn('[zones] job failed', j.key, err); }
      const took = now() - a; est.set(j.key, took);
      if (took > slowMs) { slowMs = took; slowKey = j.key; }
      ran++;
      if (now() - t0 >= budget) break;
    }
    lastBuildMs = ran ? now() - t0 : 0;
    if (lastBuildMs > maxMs) maxMs = lastBuildMs;
  }

  function decide(playerPos: Vec2) {
    const minRank = (z: ZoneRt) => RANK[z.def.minState || 'cold'];
    zones.forEach(z => {
      z.dist = distToRect(playerPos, z.def.bounds);
      let t = rawTarget(z.dist);
      const cur = z.target;
      if (RANK[t] < RANK[cur] && z.dist <= LIMIT[cur] + ZONE_DIST.hysteresis) t = cur;
      if (RANK[t] < minRank(z)) t = z.def.minState as ZoneState;
      if (z.forced) t = z.forced;
      z.target = t;
    });
    const cap = Math.max(1, deps.quality.current().maxLiveZones || 3);
    const live = [...zones.values()].filter(z => RANK[z.target] >= RANK.warm && !z.forced).sort((a, b) => a.dist - b.dist);
    live.slice(cap).forEach(z => { z.target = RANK.sim >= RANK[z.def.minState || 'cold'] ? 'sim' : (z.def.minState as ZoneState); });
  }

  function apply() {
    zones.forEach(z => {
      const want = RANK[z.target] >= RANK.warm;
      if (want) {
        if (!z.built && !z.building) enqueueBuild(z);
        if (z.built) setState(z, z.target);
        else if (RANK[z.state] > RANK.sim) setState(z, 'sim');
      } else {
        if (z.built || z.building) unload(z);
        setState(z, z.target);
      }
    });
  }

  const api: MotorZones = {
    register(def: ZoneDef) {
      if (zones.has(def.id)) { api.replace(def); return; }
      const z: ZoneRt = { def, state: 'cold', target: 'cold', forced: null, root: null, built: false, building: false, insts: [], cached: null, cachedAt: 0, picks: [], grid: null, anchors: null, dist: Infinity, extra: new Map() };
      zones.set(def.id, z); order.push(def.id);
      if (def.minState && RANK[def.minState] > 0) { z.target = def.minState; setState(z, RANK[def.minState] >= RANK.warm ? 'sim' : def.minState); }
    },
    replace(def: ZoneDef) {
      const z = zones.get(def.id);
      if (!z) { api.register(def); return; }
      const wasBuilt = z.built || z.building;
      if (wasBuilt) unload(z, true);
      if (z.cached) destroyInsts(z);
      const hadGrid = !!z.grid;
      z.def = def; z.grid = null; z.anchors = null;
      if (wasBuilt) enqueueBuild(z);
      // a nav that holds the old grid must hear about the new one (editor overrides, hot reload)
      if (hadGrid) { const g = api.walkGrid(def.id); gridSubs.forEach(cb => { try { cb(def.id, g); } catch (e) { deps.log?.warn('[zones] grid cb', e); } }); }
    },
    def: id => zones.get(id)?.def,
    ids: () => order.slice(),
    update(playerPos: Vec2) {
      decide(playerPos);
      apply();
      const budget = deps.quality.current().buildBudgetMs || 4;
      const run = () => runJobs(budget);
      if (deps.perf) deps.perf.time('zones.build', run); else run();
      if (deps.perf) deps.perf.count('zones.pending', jobs.length);
    },
    state: id => zones.get(id)?.state ?? 'cold',
    target: id => zones.get(id)?.target ?? 'cold',
    states() { const o: Record<string, ZoneState> = {}; zones.forEach((z, k) => { o[k] = z.state; }); return o; },
    onState(cb) { stateSubs.add(cb); return () => { stateSubs.delete(cb); }; },
    onBuilt(cb) { builtSubs.add(cb); return () => { builtSubs.delete(cb); }; },
    force(id, s) {
      const z = zones.get(id); if (!z) return;
      z.forced = s;
      if (s) z.target = s;
      apply();
    },
    root: id => zones.get(id)?.root ?? null,
    anchors(id) {
      const z = zones.get(id); if (!z) return {};
      if (!z.anchors) z.anchors = computeAnchors(z.def);
      return z.anchors;
    },
    walkGrid(id) {
      const z = zones.get(id);
      if (!z) return { cell: 0.5, w: 0, h: 0, origin: { x: 0, z: 0 }, cost: new Uint8Array(0), zone: id };
      if (!z.grid) z.grid = bakeGrid(z.def, z.extra);
      return z.grid;
    },
    interactables(id) {
      const z = zones.get(id); if (!z) return [];
      const out: InteractDef[] = [];
      z.def.props.forEach(pl => {
        if (!prefab.has(pl.prefab)) return;
        prefab.interact(pl.prefab, pl.overrides as Params | undefined).forEach(it => out.push({ ...it, id: pl.id + '.' + it.id, at: placePoint(it.at.x, it.at.z, pl) }));
      });
      return out;
    },
    zoneAt(p) {
      for (const id of order) { const b = zones.get(id)!.def.bounds; if (p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1) return id; }
      return null;
    },
    buildMs: () => lastBuildMs,
    maxBuildMs(reset?: boolean) { const m = maxMs; if (reset) maxMs = 0; return m; },
    slowestJob(reset?: boolean) { const r = { key: slowKey, ms: slowMs }; if (reset) { slowKey = ''; slowMs = 0; } return r; },
    pending: () => jobs.length,
    prewarm(id) {
      const z = zones.get(id); if (!z) return;
      const seen = new Set<string>();
      z.def.props.forEach(pl => {
        const k = pl.prefab + '|' + JSON.stringify(pl.overrides || {}); if (seen.has(k) || !prefab.has(pl.prefab)) return; seen.add(k);
        try { prefab.build(pl.prefab, pl.overrides as Params | undefined).dispose(); } catch (e) { deps.log?.warn('[zones] prewarm', pl.prefab, e); }
      });
    },
    flush(playerPos?: Vec2) {
      if (playerPos) decide(playerPos);
      apply();
      while (jobs.length) { const j = jobs.shift()!; const a = now(); try { j.run(); } catch (err) { deps.log?.warn('[zones] job failed', j.key, err); } est.set(j.key, now() - a); }
    },
    setColliders(id, key, rects) {
      const z = zones.get(id); if (!z) return;
      if (rects.length) z.extra.set(key, rects.map(r => ({ ...r }))); else z.extra.delete(key);
      api.rebake(id);
    },
    rebake(id) {
      const z = zones.get(id); if (!z) return;
      z.anchors = null;
      if (!z.grid) return;
      const g = bakeGrid(z.def, z.extra);
      if (g.w === z.grid.w && g.h === z.grid.h) z.grid.cost.set(g.cost); else z.grid = g;
      const grid = z.grid;
      gridSubs.forEach(cb => { try { cb(id, grid); } catch (e) { deps.log?.warn('[zones] grid cb', e); } });
    },
    onGrid(cb) { gridSubs.add(cb); return () => { gridSubs.delete(cb); }; },
    colliders(id) { const z = zones.get(id); return z ? playerSolids(z.def, z.extra) : []; },
    instancesOf: id => { const z = zones.get(id); return z && z.root ? z.insts.slice() : []; },
    distance: (id, p) => { const z = zones.get(id); return z ? distToRect(p, z.def.bounds) : Infinity; },
  };
  return api;
}
