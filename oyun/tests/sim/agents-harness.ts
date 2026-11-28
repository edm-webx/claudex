/** Test harness for the agents layer: a fake Rules + a small stub AgentHost (no A economy needed). */
import { createBus, createRngStreams } from '../../src/engine/core';
import { createInteractions } from '../../src/engine/input/interactions';
import { openNav } from '../../src/game/headless';
import { defaultState, type GameState, type ProductId } from '../../src/game/sim/schema';
import { emptyRuntime } from '../../src/game/sim/state';
import { stageLayout } from '../../src/content/prefabs/iskele/layout';
import { createAgents, type AgentsHandle } from '../../src/game/sim/agents';
import type { AgentHost, CarryItem } from '../../src/game/sim/agents/types';
import type { System, SimCtx } from '../../src/engine/api';

export interface Sandbox {
  state: GameState; h: AgentsHandle; host: StubHost; player: { x: number; z: number }; moving: { v: boolean };
  step(sec: number): void; events: string[]; toasts: string[]; tick: number; ctx: SimCtx;
}
export interface StubHost extends AgentHost {
  made: Record<string, number>; counter: Record<string, CarryItem[]>; out: Record<string, CarryItem[]>; money: number; dirty: Set<number>;
  hand: CarryItem[]; settled: number; kasa: number; floor: { v: number; x: number; z: number }[]; owed: number; hour_: number; heroSaid: string[];
}

export function makeSandbox(seed = 1, setup?: (s: GameState) => void): Sandbox {
  const state = defaultState(seed);
  state.hero = 'sabri';
  state.owned = { cay: 1, ayran: 1, simit: 1, tost: 1, gazoz: 1 };
  setup?.(state);
  const layout = stageLayout(state.stage);
  const rt = emptyRuntime(layout);
  const rng = createRngStreams(seed);
  const events: string[] = [], toasts: string[] = [];
  const bus = createBus<Record<string, unknown>>();
  bus.onAny((r) => events.push(r.name));
  const player = { x: layout.playerStart.x, z: layout.playerStart.z }, moving = { v: false };
  const systems: System[] = [];
  const nav = openNav();
  const stationsBuilt = new Set<string>(['doner', 'cay', 'simit', 'ayran', 'tost', 'gazoz']);
  const host: StubHost = {
    made: {}, counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] }, out: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] },
    money: 5000, dirty: new Set(), hand: [], settled: 0, kasa: 10, floor: [], owed: 0, hour_: 12, heroSaid: [],
    hour: () => host.hour_, player: () => ({ x: player.x, z: player.z, moving: moving.v }),
    stationBuilt: (p) => stationsBuilt.has(p), openProducts: () => [...stationsBuilt] as ProductId[], tablesBuilt: () => 3,
    dirtyTables: () => [...host.dirty].map((i) => ({ index: i, x: 0 + i, z: 1 })), cleanTable: (i) => { host.dirty.delete(i); },
    need: () => ({ doner: 2, cay: 1 }), counterStock: (p) => host.counter[p].length, counterFree: (p) => host.counter[p].length < 8, queueLength: () => 3,
    operate: (p, w, dt, sp) => { const k = (host as unknown as { prog: Record<string, number> }); k.prog ||= {}; k.prog[w] = (k.prog[w] || 0) + dt * sp / 3; if (k.prog[w] >= 1) { k.prog[w] = 0; host.out[p].push({ type: p, tier: 1, by: w }); host.made[p] = (host.made[p] || 0) + 1; return 1; } return 0; },
    dropLast: (p) => { host.out[p].pop(); }, outCount: (p) => host.out[p].length, outFull: (p) => host.out[p].length >= 8,
    takeOut: (p, c) => { const it = host.out[p].shift(); if (it) it.carrier = c; return it || null; },
    isGrab: (p) => p === 'simit' || p === 'gazoz', grabTime: () => 0.3, makeGrab: (p, c) => ({ type: p, tier: 1, carrier: c }),
    counterPut: (it) => { if (host.counter[it.type].length >= 8) return false; host.counter[it.type].push(it); return true; },
    playerHas: (p) => host.hand.some((i) => i.type === p), playerTake: (p) => { const i = host.hand.findIndex((x) => x.type === p); return i >= 0 ? host.hand.splice(i, 1)[0] : null; },
    settle: (items) => { host.settled += items.length; return items.length * 100; }, earn: (v) => { host.money += v; },
    kasaCount: () => host.kasa, kasaValue: () => host.kasa * 50, grabHalf: () => { const n = Math.ceil(host.kasa / 2); host.kasa -= n; return n * 50; },
    dropFloor: (v, x, z) => { host.floor.push({ v, x, z }); }, addOwedBack: (v) => { host.owed += v; }, addToKasa: (v) => { host.kasa += Math.ceil(v / 50); },
    counterTake: () => true, venueMult: () => 1, toast: (t) => { toasts.push(t); }, stat: () => {}, statMax: () => {},
    heroSay: (t) => { host.heroSaid.push(t); }, heroAct: () => {}, tipBoost: () => {}, addFollowers: () => {}, laughNearby: () => {}, hero: () => 'sabri', windowOpen: () => false,
  };
  const rules = {
    state, rt, rng: (n: string) => rng.stream(n), nav, bus, interactions: createInteractions(), player: 1, get playerPos() { return player; },
    addSystem: (s: System) => { systems.push(s); }, addStateView: () => {}, hour: () => host.hour_,
  } as unknown as import('../../src/game/sim/state').Rules;
  const h = createAgents(rules, { host });
  systems.sort((a, b) => a.order - b.order);
  const sb: Sandbox = {
    state, h, host, player, moving, events, toasts, tick: 0, ctx: null as unknown as SimCtx,
    step(sec: number) {
      const dt = 1 / 30;
      for (let i = 0; i < Math.round(sec / dt); i++) {
        state.playT += dt; sb.tick++;
        const ctx = { tick: sb.tick, dt, t: sb.tick * dt, state, rng, bus, world: null, content: null, clock: null, input: null } as unknown as SimCtx;
        sb.ctx = ctx;
        for (const s of systems) s.step(ctx);
        rules.interactions.update(1 as never, player, moving.v ? 2 : 0, ctx);
      }
    },
  };
  return sb;
}
export function addWorker(sb: Sandbox, role: string, trait: string, extra: Record<string, unknown> = {}) {
  const w = { id: sb.state.nextWid++, name: 'Deneme', role, trait, traits: [trait], rarity: 'gri', xp: 0, rank: 0, morale: 70, legend: null, look: {}, about: '', hiredDay: 1, team: null, ...extra };
  sb.state.workers.push(w as never);
  return w;
}
/**
 * BUF-05: a small stub of the kitchen line (sim/mutfak-hat.ts) on the sandbox host: `plan` is the queue of jobs handed to claims
 * ({ ist, p }); cooking takes `sure` s; plates go cook -> station tray -> hand -> pass like the real line.
 */
export function stubHat(sb: Sandbox, plan: { ist: string; p: string }[], sure = 2) {
  const cook = new Map<number, { ist: string; p: string }>(), tray: { ist: string; p: string; by: number; wid: number; t: number }[] = [], hand = new Map<number, CarryItem<string>>();
  const passed: { p: string; wid: number; tick: number }[] = [], claims: { wid: number; ist: string; p: string }[] = [];
  const h = sb.host;
  h.kitchenClaim = (wid) => { if (cook.has(wid) || !plan.length) return null; const j = plan.shift()!; cook.set(wid, j); claims.push({ wid, ...j }); return j.p; };
  h.kitchenIst = (wid) => cook.get(wid)?.ist ?? null;
  h.kitchenSure = () => sure;
  h.kitchenReady = (wid) => { const j = cook.get(wid); if (!j) return false; cook.delete(wid); tray.push({ ...j, by: wid, wid: 0, t: sb.state.playT }); return true; };
  h.kitchenTasi = (wid, o = {}) => { const t = tray.find((k) => k.wid === wid) || tray.find((k) => !k.wid && (!o.kendi || k.by === wid) && sb.state.playT - k.t >= (o.yas || 0)); if (!t) return null; t.wid = wid; return { ist: t.ist, p: t.p }; };
  h.kitchenTasiAl = (wid) => { const i = tray.findIndex((k) => k.wid === wid); if (i < 0) return null; const t = tray.splice(i, 1)[0], it = { type: t.p, tier: 1 }; hand.set(wid, it); return it; };
  h.kitchenPass = (wid) => { const it = hand.get(wid); if (!it) return false; hand.delete(wid); passed.push({ p: it.type, wid, tick: sb.tick }); return true; };
  h.kitchenBekleyen = (yas) => tray.some((k) => !k.wid && sb.state.playT - k.t >= yas);
  h.kitchenDrop = (wid) => { cook.delete(wid); hand.delete(wid); for (const t of tray) if (t.wid === wid) t.wid = 0; };
  return { cook, tray, hand, passed, claims };
}
