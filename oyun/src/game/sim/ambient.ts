/**
 * M0 ambient walkers: a pool of citizens that stroll between anchors, sit on benches, stop to idle or look at
 * the phone, and write themselves into the shared agents SoA for the crowd view. Owner: Builder C.
 * Pure sim: no three, window, document, Math.random, Date.now, performance.now. Randomness only from
 * ctx.rng.stream('ambient'), so a replay with the same seed and inputs walks the same way.
 *
 * The walker count is a sim constant (not the quality tier) so the sim stays identical on every device; the crowd
 * view culls by its own budget. Anchors may be empty (headless): walkers then pick walkable points inside `area`.
 * M1 customers take walkers with recruit() (the slot keeps its look, the ambient flag is cleared) and hand them
 * back with release() (the walker resumes strolling, or despawns when the pool is full).
 */
import type { AmbientSystem, AnchorDef, Nav, Rect, Rng, SimCtx, SoAStore, Vec2, ZoneManager } from '../../engine/api';
import { AGENTS, AGENT_CAP, AGENT_SCHEMA, AGENT_FLAG, AGENT_LOD, ACT_ORDER, GAIT_ORDER, MOOD_ORDER, ZONE_ORDER } from './schema';
import { CITIZENS, CROWD_BUDGET } from '../../content/citizens';
import { BUFE as BUFE_BOX } from '../../content/prefabs/iskele/layout';

export interface AmbientDeps {
  nav: Nav;
  anchors: ZoneManager['anchors'];
  /** Zones to populate (default ['iskele']). */
  zones?: string[];
  /** Pool size (default dengeli ambient + passers = 24). */
  count?: number;
  /** Fallback wander area when a zone has no spawn/walk anchors. */
  area?: Rect;
  /** Spawn ramp: walkers added per second until the pool is full (default 4). */
  spawnRate?: number;
}

/** Walking speed per gait (m/s), matched to the animator stride * freq so feet do not skate. */
export const GAIT_SPEED: Record<(typeof GAIT_ORDER)[number], number> = {
  normal: 1.15, waddle: 0.75, brisk: 1.55, slow: 0.7, shuffle: 0.85, kid: 1.25, run: 2.8,
};

const ACT = (a: (typeof ACT_ORDER)[number]) => ACT_ORDER.indexOf(a);
const A_WALK = ACT('walk'), A_IDLE = ACT('idle'), A_SIT = ACT('sit'), A_PHONE = ACT('phone'), A_SIP = ACT('sip');
const M_OK = MOOD_ORDER.indexOf('ok'), M_HAPPY = MOOD_ORDER.indexOf('happy');
const S_WALK = 0, S_PAUSE = 1, S_SIT = 2, S_GONE = 3;
const DEFAULT_AREA: Rect = { x0: -16, z0: -13, x1: 16, z1: 10 };

interface Walker { slot: number; zone: string; state: number; t: number; path: Vec2[]; wp: number; seat: number; speed: number; exit: boolean; }

export function createAmbient(deps: AmbientDeps): AmbientSystem {
  const zones = deps.zones && deps.zones.length ? deps.zones.slice() : ['iskele'];
  const target = deps.count ?? (CROWD_BUDGET.dengeli.ambient + CROWD_BUDGET.dengeli.passers);
  const area = deps.area ?? DEFAULT_AREA;
  const spawnRate = deps.spawnRate ?? 4;
  const walkers = new Map<number, Walker>();
  const recruited = new Set<number>();
  const seatTaken = new Map<string, number>();     // "zone:anchorId" -> slot
  let spawnAcc = target;                           // the first tick fills the pool at once, inside the wander area
  let filled = false;
  let store: SoAStore | null = null;
  const tmp: Vec2 = { x: 0, z: 0 }, sep: Vec2 = { x: 0, z: 0 };
  const hash = deps.nav.hash(1);
  const nbr: number[] = [];

  // Candidate types: no scenery stands (they belong to props), weighted by v2 `w`.
  const pool = CITIZENS.map((c, i) => ({ i, w: c.scenery ? 0 : c.w })).filter((p) => p.w > 0);
  const poolW = pool.reduce((s, p) => s + p.w, 0);
  const pickType = (rng: Rng) => {
    let r = rng.next() * poolW;
    for (const p of pool) { r -= p.w; if (r <= 0) return p.i; }
    return pool[pool.length - 1].i;
  };

  const anchorsOf = (zone: string): { id: string; a: AnchorDef }[] => {
    let rec: Record<string, AnchorDef> | undefined;
    try { rec = deps.anchors(zone); } catch { rec = undefined; }
    if (!rec) return [];
    return Object.keys(rec).sort().map((id) => ({ id, a: rec![id] }));
  };
  const isKind = (a: AnchorDef, ...k: string[]) => (a.kind && k.includes(a.kind)) || (a.tags ?? []).some((t) => k.includes(t));

  // Citizens never walk into the büfe: its interior is staff only (owner: only workers and the player go in and out).
  // Ambient targets are filtered here; the kiosk walls and the single door are solid in the walk grid.
  const insideBufe = (p: Vec2): boolean => p.x > BUFE_BOX.x0 - 0.5 && p.x < BUFE_BOX.x1 + 0.5 && p.z > BUFE_BOX.z0 - 0.5 && p.z < BUFE_BOX.z1 + 0.5;
  const randomPoint = (zone: string, rng: Rng, out: Vec2, spawn: boolean): Vec2 => {
    const list = anchorsOf(zone).filter(({ id, a }) => id !== 'playerStart' && !insideBufe(a.pos) && (spawn ? isKind(a, 'spawn', 'walkway', 'door') : isKind(a, 'walkway', 'decor', 'marker', 'perch')));
    if (list.length && rng.chance(spawn ? 0.85 : 0.5)) {
      const { a } = list[rng.int(0, list.length - 1)];
      out.x = a.pos.x + rng.range(-0.6, 0.6); out.z = a.pos.z + rng.range(-0.6, 0.6);
    } else {
      for (let k = 0; k < 12; k++) {
        out.x = rng.range(area.x0, area.x1); out.z = rng.range(area.z0, area.z1);
        if (deps.nav.walkable(out)) break;
      }
    }
    if (!deps.nav.walkable(out)) deps.nav.nearestWalkable(out, out);
    return out;
  };

  /** Seat anchors when the zone has them, else whole benches. */
  const seatsOf = (zone: string) => {
    const all = anchorsOf(zone);
    const seats = all.filter(({ a }) => isKind(a, 'seat'));
    return seats.length ? seats : all.filter(({ a }) => isKind(a, 'bench'));
  };
  const exitsOf = (zone: string) => anchorsOf(zone).filter(({ id, a }) => isKind(a, 'spawn') && id !== 'playerStart');

  const plan = (w: Walker, rng: Rng, X: Float32Array, Z: Float32Array) => {
    w.wp = 0;
    w.state = S_WALK;
    w.exit = false;
    const from = { x: X[w.slot], z: Z[w.slot] };
    const r = rng.next();
    // 30%: head for a free seat if the zone has one.
    if (r < 0.3) {
      const seats = seatsOf(w.zone);
      const freeSeats = seats.filter(({ id }) => !seatTaken.has(w.zone + ':' + id));
      if (freeSeats.length) {
        const s = freeSeats[rng.int(0, freeSeats.length - 1)];
        const p = deps.nav.path(from, s.a.pos);
        if (p.length) { w.path = p; w.seat = seats.indexOf(s); seatTaken.set(w.zone + ':' + s.id, w.slot); return; }
      }
    } else if (r < 0.42) {
      // 12%: a passer leaves through a zone edge; the ramp brings a new one in from another edge.
      const ex = exitsOf(w.zone);
      if (ex.length) {
        const e = ex[rng.int(0, ex.length - 1)];
        const p = deps.nav.path(from, e.a.pos, { maxNodes: 20000 });
        if (p.length) { w.path = p; w.seat = -1; w.exit = true; return; }
      }
    }
    w.seat = -1;
    const to = randomPoint(w.zone, rng, { x: 0, z: 0 }, false);
    const p = deps.nav.path(from, to);
    w.path = p.length ? p : [to];
  };

  const releaseSeat = (w: Walker) => {
    for (const [k, v] of seatTaken) if (v === w.slot) seatTaken.delete(k);
    w.seat = -1;
  };

  const spawn = (s: SoAStore, rng: Rng): Walker | null => {
    const slot = s.alloc();
    if (slot < 0) return null;
    const zone = zones[rng.int(0, zones.length - 1)];
    const ty = pickType(rng);
    const def = CITIZENS[ty];
    const p = randomPoint(zone, rng, { x: 0, z: 0 }, filled);
    const gait = Math.max(0, GAIT_ORDER.indexOf((def.gait ?? 'normal') as (typeof GAIT_ORDER)[number]));
    s.f32('x')[slot] = s.f32('px')[slot] = p.x;
    s.f32('z')[slot] = s.f32('pz')[slot] = p.z;
    s.f32('rot')[slot] = s.f32('prot')[slot] = rng.range(-Math.PI, Math.PI);
    s.f32('speed')[slot] = 0;
    s.u8('gait')[slot] = gait;
    s.u8('act')[slot] = A_IDLE;
    s.u8('mood')[slot] = rng.chance(0.3) ? M_HAPPY : M_OK;
    s.u8('expr')[slot] = 0;
    s.u8('carry')[slot] = 0;
    s.u8('typeId')[slot] = ty;
    s.u8('lod')[slot] = AGENT_LOD.B;
    s.u8('zone')[slot] = Math.max(0, ZONE_ORDER.indexOf(zone as (typeof ZONE_ORDER)[number]));
    s.u16('flags')[slot] = AGENT_FLAG.visible | AGENT_FLAG.ambient;
    const w: Walker = {
      slot, zone, state: S_PAUSE, t: rng.range(0, 1.5), path: [], wp: 0, seat: -1, exit: false,
      speed: GAIT_SPEED[GAIT_ORDER[gait]] * rng.range(0.9, 1.1),
    };
    walkers.set(slot, w);
    return w;
  };

  const despawn = (s: SoAStore, w: Walker) => {
    releaseSeat(w);
    walkers.delete(w.slot);
    if (s.alive(w.slot)) { s.u16('flags')[w.slot] = 0; s.free(w.slot); }
  };

  const sys: AmbientSystem = {
    id: 'ambient', order: 20, phase: 'sim',
    step(ctx: SimCtx) {
      const s = store ?? (store = ctx.world.soa(AGENTS, AGENT_CAP, AGENT_SCHEMA));
      const rng = ctx.rng.stream('ambient');
      const dt = ctx.dt;
      const X = s.f32('x'), Z = s.f32('z'), R = s.f32('rot'), SP = s.f32('speed');
      const act = s.u8('act'), flags = s.u16('flags');

      // Ramp the pool up to its size.
      if (walkers.size < target) {
        spawnAcc += dt * spawnRate;
        while (spawnAcc >= 1 && walkers.size < target) { spawnAcc -= 1; if (!spawn(s, rng)) { spawnAcc = 0; break; } }
      } else spawnAcc = 0;
      filled = true;

      hash.clear();
      for (const w of walkers.values()) hash.insert(w.slot, X[w.slot], Z[w.slot]);

      for (const w of walkers.values()) {
        const i = w.slot;
        if (!s.alive(i)) { walkers.delete(i); continue; }
        w.t -= dt;
        if (w.state === S_PAUSE || w.state === S_SIT) {
          SP[i] = 0;
          if (w.t <= 0) {
            if (w.state === S_SIT) { releaseSeat(w); flags[i] &= ~AGENT_FLAG.seated; }
            plan(w, rng, X, Z);
            act[i] = A_WALK;
          }
          continue;
        }
        if (w.state !== S_WALK) continue;
        const wp = w.path[w.wp];
        if (!wp) { arrive(w, i); continue; }
        const dx = wp.x - X[i], dz = wp.z - Z[i];
        const d = Math.hypot(dx, dz);
        const stepLen = w.speed * dt;
        if (d <= Math.max(0.08, stepLen)) {
          X[i] = wp.x; Z[i] = wp.z;
          w.wp++;
          if (w.wp >= w.path.length) arrive(w, i);
          SP[i] = d / Math.max(1e-4, dt);
          continue;
        }
        let vx = dx / d, vz = dz / d;
        // Light separation so strollers do not overlap; walkers on the last leg into a seat skip it.
        if (w.seat < 0) {
          nbr.length = 0;
          deps.nav.steering.separate(s, hash, i, sep);
          vx += sep.x * 0.6; vz += sep.z * 0.6;
          const m = Math.hypot(vx, vz) || 1; vx /= m; vz /= m;
        }
        tmp.x = X[i] + vx * stepLen; tmp.z = Z[i] + vz * stepLen;
        const from = { x: X[i], z: Z[i] };
        deps.nav.move(from, tmp, 0.2, tmp);
        X[i] = tmp.x; Z[i] = tmp.z;
        SP[i] = Math.hypot(tmp.x - from.x, tmp.z - from.z) / Math.max(1e-4, dt);
        const want = Math.atan2(vx, vz);
        let da = want - R[i];
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        R[i] += da * Math.min(1, dt * 8);
        act[i] = A_WALK;
      }

      function arrive(w: Walker, i: number) {
        SP[i] = 0;
        if (w.exit) { despawn(s, w); return; }
        if (w.seat >= 0) {
          const seats = seatsOf(w.zone);
          const a = seats[w.seat]?.a;
          if (a && typeof a.rotY === 'number') R[i] = a.rotY;
          w.state = S_SIT; w.t = rng.range(8, 22);
          act[i] = rng.chance(0.4) ? A_SIP : A_SIT;
          flags[i] |= AGENT_FLAG.seated;
          return;
        }
        w.state = S_PAUSE;
        w.t = rng.range(0.8, 4.5);
        act[i] = rng.chance(0.2) ? A_PHONE : A_IDLE;
      }
    },
    recruit(filter) {
      const s = store;
      if (!s) return -1;
      const ty = s.u8('typeId');
      // Lowest slot first keeps it deterministic.
      const slots = [...walkers.keys()].sort((a, b) => a - b);
      for (const slot of slots) {
        if (filter && !filter(CITIZENS[ty[slot]]?.id ?? '')) continue;
        const w = walkers.get(slot)!;
        releaseSeat(w);
        walkers.delete(slot);
        recruited.add(slot);
        const f = s.u16('flags');
        f[slot] = (f[slot] & ~(AGENT_FLAG.ambient | AGENT_FLAG.seated)) | AGENT_FLAG.visible;
        s.u8('act')[slot] = A_IDLE;
        s.f32('speed')[slot] = 0;
        return slot;
      }
      return -1;
    },
    release(agent) {
      const s = store;
      if (!s || !s.alive(agent)) { recruited.delete(agent); return; }
      recruited.delete(agent);
      if (walkers.has(agent)) return;
      const f = s.u16('flags');
      if (walkers.size >= target) { f[agent] = 0; s.free(agent); return; }
      f[agent] = (f[agent] & ~(AGENT_FLAG.customer | AGENT_FLAG.queued | AGENT_FLAG.seated | AGENT_FLAG.leaving)) | AGENT_FLAG.visible | AGENT_FLAG.ambient;
      const zi = s.u8('zone')[agent];
      const zone = zones.includes(ZONE_ORDER[zi]) ? ZONE_ORDER[zi] : zones[0];
      const gait = GAIT_ORDER[s.u8('gait')[agent]] ?? 'normal';
      walkers.set(agent, { slot: agent, zone, state: S_PAUSE, t: 0.5, path: [], wp: 0, seat: -1, speed: GAIT_SPEED[gait], exit: false });
    },
  };
  // Test/debug helpers (not part of the contract).
  Object.defineProperty(sys, 'count', { get: () => walkers.size });
  Object.defineProperty(sys, 'dispose', { value: () => { if (store) for (const w of [...walkers.values()]) despawn(store, w); } });
  return sys;
}
