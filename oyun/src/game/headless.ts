/**
 * Sim-only entry for Node, bots and the browser (boot uses the same sim). Owner: Builder A.
 * Pure: no three, no DOM, no wall clock, no unseeded randomness.
 *
 * Tick order (30 Hz fixed, dt = 1/30): agents cur -> prev copy, clock advance, scheduler 'sim' phase
 * (walk order 10, ambient and later systems by their own order). Inputs are logged as changes {tick, x, z} for replays.
 * Decisions:
 * - M0 clock: dayT advances and wraps into the next day silently (no day-end rules yet). `?time=` / setTime freeze
 *   the clock by default so parity scenes stay still (command {kind:'freezeTime', on}).
 * - Day phase: morning < 12:00, noon < 17:00, sunset < 20:00, night after.
 * - hash() = FNV-1a over stable JSON of GameState + player pose + agents SoA (0..hi) + every RNG stream state + tick.
 * - Without a real Nav (C) a trivial open-floor nav is used, so headless always runs.
 */
import type {
  Sim, SimOpts, SimCtx, GameClock, DayPhase, Season, Vec2, Nav, AnchorDef, AmbientSystem, InteractionRegistry,
  PerfMeter, Logger, PlayerWalk, Scheduler, SoAStore, Entity, TickInput, EventRecord, SimCommand, World, FlowField, SpatialHash, WalkGrid,
} from '../engine/api';
import { GAME_DAY_S, DAY_START_H, DAY_END_H } from '../engine/api';
import { createBus, createRngStreams, createHasher, stableStringify, angLerp, type RngStreamsExt } from '../engine/core';
import { createWorld, createScheduler } from '../engine/ecs';
import { createInteractions } from '../engine/input/interactions';
import { createNav } from '../engine/nav';
import { createAmbient } from './sim/ambient';
import { createWalk, type WalkFull } from './sim/walk';
import { defaultState, AGENTS, AGENT_CAP, AGENT_SCHEMA, type GameState } from './sim/schema';
import type { SimEvents, EventName } from './events';
import { createRules, type RulesFull } from './sim/rules';
import { installAgents } from './sim/agents';

export const SIM_HZ = 30;

export interface SimExtra {
  nav?: Nav | null;
  anchors?: (zoneId: string) => Record<string, AnchorDef>;
  /** null = no ambient system; undefined = try C's createAmbient. */
  ambient?: AmbientSystem | null;
  interactions?: InteractionRegistry;
  perf?: PerfMeter;
  log?: Logger;
  startPos?: Vec2;
  /** Scheduler timing clock (browser only; keeps sim pure). */
  now?: () => number;
}

export interface SimFull extends Sim {
  readonly tick: number;
  readonly walk: WalkFull;
  readonly scheduler: Scheduler;
  readonly rng: RngStreamsExt;
  readonly agents: SoAStore;
  readonly player: Entity;
  readonly interactions: InteractionRegistry;
  readonly nav: Nav;
  readonly ctx: SimCtx;
  /** M1 rules (A): state, runtime, commands, v2State. */
  readonly rules: RulesFull;
  readonly timeFrozen: boolean;
  /** Exactly one fixed tick (the loop calls this). */
  tickOnce(): void;
  inputLog(): { tick: number; x: number; z: number }[];
  /** Replace the whole persistent state (save import/restore). */
  load(state: GameState): void;
}

export function phaseOf(hour: number): DayPhase {
  return hour < 12 ? 'morning' : hour < 17 ? 'noon' : hour < 20 ? 'sunset' : 'night';
}

/** Open-floor nav used when C's nav is missing (no blocking, straight paths). */
export function openNav(): Nav {
  const hash = (): SpatialHash => {
    const pts: [number, number, number][] = [];
    return {
      clear() { pts.length = 0; },
      insert(i, x, z) { pts.push([i, x, z]); },
      query(x, z, r, out) { let n = 0; for (const p of pts) if ((p[1] - x) ** 2 + (p[2] - z) ** 2 <= r * r) out[n++] = p[0]; return n; },
    };
  };
  const targets = new Map<string, Vec2>();
  return {
    addGrid(_g: WalkGrid) {}, removeGrid() {},
    path: (a, b) => [{ x: a.x, z: a.z }, { x: b.x, z: b.z }],
    walkable: () => true,
    nearestWalkable: (p, out) => { out.x = p.x; out.z = p.z; return true; },
    move: (_f, to, _r, out) => { out.x = to.x; out.z = to.z; return out; },
    defineTarget: (id, at) => { targets.set(id, { x: at.x, z: at.z }); },
    flowTo(id): FlowField {
      return {
        target: id,
        dirAt(p, out) { const t = targets.get(id); if (!t) return false; const dx = t.x - p.x, dz = t.z - p.z, m = Math.hypot(dx, dz) || 1; out.x = dx / m; out.z = dz / m; return true; },
        distAt(p) { const t = targets.get(id); return t ? Math.hypot(t.x - p.x, t.z - p.z) : Infinity; },
      };
    },
    zonePath: () => [], setBlocked() {}, setSolids() {}, hash,
    steering: { separate: (_a, _h, _i, out) => { out.x = 0; out.z = 0; return out; } },
  };
}

function seasonOf(calendar: string): Season {
  const m = Number(calendar.slice(5, 7)) || 6;
  return m >= 3 && m <= 5 ? 'ilkbahar' : m >= 6 && m <= 8 ? 'yaz' : m >= 9 && m <= 11 ? 'sonbahar' : 'kis';
}

export function createSim(o: SimOpts, extra: SimExtra = {}): SimFull {
  let state: GameState = o.save ? JSON.parse(JSON.stringify(o.save)) : defaultState(o.seed);
  if (!o.save) state.seed = o.seed;
  const dt = 1 / SIM_HZ;
  let tick = 0;
  const rng = createRngStreams(o.seed);
  const bus = createBus<SimEvents>({ maxLog: 100000, clock: () => ({ tick, t: tick * dt }) });
  const world: World = createWorld({ log: extra.log });
  const scheduler = createScheduler({ perf: extra.perf, log: extra.log, now: extra.now });
  const agents = world.soa(AGENTS, AGENT_CAP, AGENT_SCHEMA);
  const player = world.create();
  const interactions = extra.interactions ?? createInteractions();
  let nav: Nav;
  if (extra.nav) nav = extra.nav;
  else { try { nav = extra.nav === null ? openNav() : createNav({ log: extra.log }); } catch { nav = openNav(); } }

  if (o.startClock?.day) state.day = o.startClock.day;
  let timeFrozen = false;
  if (o.startClock?.hour !== undefined) { state.dayT = (o.startClock.hour - DAY_START_H) * (GAME_DAY_S / (DAY_END_H - DAY_START_H)); timeFrozen = true; }
  const season: Season = o.season ?? seasonOf(state.calendar);
  const clock: GameClock = {
    get day() { return state.day; },
    get dayT() { return state.dayT; },
    get hour() { return DAY_START_H + (DAY_END_H - DAY_START_H) * Math.min(1, Math.max(0, state.dayT / GAME_DAY_S)); },
    get phase() { return phaseOf(clock.hour); },
    season,
  };

  const zp = o.content.zones?.iskele?.playerStart;
  const start: Vec2 = extra.startPos ?? (o.save ? { x: state.player.x, z: state.player.z } : zp ? { x: zp.x, z: zp.z } : { x: 0.2, z: -2.6 });
  const walk = createWalk({ nav, start, interactions, actor: player });
  scheduler.add(walk);
  state.player.x = start.x; state.player.z = start.z;

  let ambientSys: AmbientSystem | null = null;
  if (extra.ambient !== null) {
    try {
      const amb = extra.ambient ?? createAmbient({ nav, anchors: extra.anchors ?? (id => o.content.zones?.[id]?.anchors ?? {}) });
      scheduler.add(amb); ambientSys = amb;
    } catch (e) { extra.log?.warn('ambient unavailable', (e as Error).message); extra.perf?.warn('Yürüyen kalabalık yok (yedek)'); }
  }

  const input: TickInput = { tick: 0, move: { x: 0, z: 0 } };
  const pendingMove: Vec2 = { x: 0, z: 0 };
  const log: { tick: number; x: number; z: number }[] = [];
  const ctx: SimCtx = { tick: 0, dt, t: 0, world, rng, bus, state, content: o.content, clock, input };

  const px = agents.f32('px'), pz = agents.f32('pz'), ax = agents.f32('x'), az = agents.f32('z'), prot = agents.f32('prot'), arot = agents.f32('rot');
  let acc = 0;

  const rules: RulesFull = createRules({
    state, ctx, bus, content: o.content, rng: n => rng.stream(n), nav, agents, interactions, player, clock, ambient: ambientSys, walk,
    addSystem: s => scheduler.add(s),
  });
  try { installAgents(rules); const wk = (rules.rt as unknown as { agents?: { workers?: { aura?: (x: number, z: number) => number } } }).agents?.workers; if (wk?.aura) rules.rt.auras.push((x, z) => wk.aura!(x, z)); } catch (e) { extra.log?.warn('agents unavailable', (e as Error).message); }

  const tickOnce = () => {
    for (let i = 0, n = agents.hi; i < n; i++) { px[i] = ax[i]; pz[i] = az[i]; prot[i] = arot[i]; }
    if (pendingMove.x !== input.move.x || pendingMove.z !== input.move.z) {
      input.move.x = pendingMove.x; input.move.z = pendingMove.z;
      log.push({ tick, x: input.move.x, z: input.move.z });
    }
    input.tick = tick;
    ctx.tick = tick; ctx.t = tick * dt; ctx.state = state;
    const live = rules.rt.started;
    if (live && rules.rt.paused) { rules.pausedStep(dt); tick++; return; }
    if (!timeFrozen) {
      state.dayT += dt;
      if (!live && state.dayT >= GAME_DAY_S) { state.dayT -= GAME_DAY_S; state.day++; }
    }
    if (live) state.playT += dt;
    scheduler.run('sim', ctx);
    tick++;
  };

  const sim: SimFull = {
    get state() { return state; },
    world, bus, clock,
    get tick() { return tick; },
    walk, scheduler, rng, agents, player, interactions, nav, ctx, rules,
    get timeFrozen() { return timeFrozen; },
    tickOnce,
    step(sec) {
      acc += sec;
      while (acc >= dt - 1e-9) { tickOnce(); acc -= dt; }
      if (acc < 0) acc = 0;
    },
    input(move) { pendingMove.x = move.x; pendingMove.z = move.z; },
    command(c: SimCommand) {
      if (rules.handle(c)) return;
      switch (c.kind) {
        case 'setTime': {
          const h = Math.min(24, Math.max(8, Number(c.hour)));
          state.dayT = (h - DAY_START_H) * (GAME_DAY_S / (DAY_END_H - DAY_START_H));
          timeFrozen = c.freeze !== false;
          bus.emit('timeSet', { hour: h });
          break;
        }
        case 'freezeTime': timeFrozen = !!c.on; break;
        case 'setStage': {
          state.stage = Math.max(1, Math.min(5, Math.round(Number(c.stage)) || 1));
          bus.emit('stage', { stage: state.stage });
          break;
        }
        case 'teleport': walk.teleport(Number(c.x), Number(c.z)); state.player.x = walk.pos.x; state.player.z = walk.pos.z; break;
        default: extra.log?.warn('unknown command', c.kind);
      }
    },
    events(since) { return bus.log(since) as EventRecord<EventName>[]; },
    hash() {
      const h = createHasher();
      h.str(stableStringify(state)); h.str(stableStringify(rules.hashParts()));
      h.num(walk.pos.x); h.num(walk.pos.z); h.num(walk.rot); h.num(tick);
      for (const f of Object.keys(AGENT_SCHEMA) as (keyof typeof AGENT_SCHEMA)[]) {
        const k = AGENT_SCHEMA[f];
        const a = k === 'f32' ? agents.f32(f) : k === 'u8' ? agents.u8(f) : agents.u16(f);
        h.arr(a, agents.hi);
      }
      for (const n of rng.names()) { h.str(n); h.arr(rng.stream(n).getState()); }
      return h.value().toString(16).padStart(8, '0');
    },
    inputLog: () => log,
    load(s) {
      const copy = JSON.parse(JSON.stringify(s)) as GameState;
      for (const k of Object.keys(state)) delete (state as unknown as Record<string, unknown>)[k];
      Object.assign(state, copy);
      rules.restore();
      walk.teleport(state.player.x, state.player.z);
    },
  };
  return sim;
}

/** Render-side interpolation of the player pose between the previous and current sim tick (position and yaw). */
export function lerpPose(w: PlayerWalk & { prevRot?: number }, alpha: number, out: { x: number; z: number; rot: number }): void {
  out.x = w.prev.x + (w.pos.x - w.prev.x) * alpha;
  out.z = w.prev.z + (w.pos.z - w.prev.z) * alpha;
  out.rot = angLerp(w.prevRot ?? w.rot, w.rot, alpha);
}
