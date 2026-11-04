/**
 * Agents layer (Builder C, M1): workers, regulars, Gurme VIP, kapkaççı, cats, Karamel, gulls (and the pigeon area).
 * `installAgents(rules)` is called by A's headless after the rules exist; it adds the systems to the scheduler,
 * registers the v2 state view (reg, vip, kap, cat, cats, gull, sleeper, workers) and the reserved-order provider,
 * and hangs `rt.agents` (ActorRegistry + handles) on the runtime for views and tests.
 */
import type { AnchorDef } from '../../../engine/api';
import type { Rules } from '../state';
import { hostFromRules } from './host';
import { createActorRegistry } from './registry';
import { createAnchorBook, layoutAnchors, type AnchorFn } from './anchors';
import type { AgentEnv } from './env';
import type { ActorRegistry, AgentHost } from './types';
import { createWorkers, type WorkersSystem } from './workers';
import { createRegulars, type RegularsSystem } from './regulars';
import { createVip, type VipSystem } from './vip';
import { createKapkac, type KapkacSystem } from './kapkac';
import { createCats, type CatsSystem } from './cats';
import { createDog } from './dog';
import { createParrot } from './parrot';
import { createGulls, type GullsSystem } from './gulls';
import { pigeonArea, type PigeonArea } from './pigeons';

export interface AgentsHandle {
  registry: ActorRegistry;
  workers: WorkersSystem; regulars: RegularsSystem; vip: VipSystem; kapkac: KapkacSystem; cats: CatsSystem; gulls: GullsSystem;
  dog: ReturnType<typeof createDog>;
  /** Pigeon / flock home area for the view. */
  pigeons(): PigeonArea;
  /** v2 `force` hooks: reg (id or true), vip, kapkac, gull, sleep. */
  force(what: string, value?: unknown): void;
  env: AgentEnv;
}
export interface InstallOpts {
  /** Zone anchors (B's flattened names). Optional: the stage layout is used when missing. */
  anchors?: AnchorFn;
  host?: AgentHost;
}

export function createAgents(rules: Rules, opts: InstallOpts = {}): AgentsHandle {
  const rt = rules.rt;
  let cacheL: unknown = null, cacheRec: Record<string, AnchorDef> = {};
  const anchors: AnchorFn = (zone) => {
    const z = opts.anchors ? opts.anchors(zone) : null;
    if (z && z['counter.standAt']) return z;
    if (cacheL !== rt.layout) { cacheL = rt.layout; cacheRec = layoutAnchors(rt.layout); }
    return cacheRec;
  };
  const host = opts.host ?? hostFromRules(rules);
  const reg = createActorRegistry();
  const book = createAnchorBook(anchors);
  const env: AgentEnv = {
    host, nav: rules.nav, book, reg, interactions: rules.interactions, playerEntity: rules.player,
    rng: (n) => rules.rng(n), player: () => rules.playerPos,
    emit: (name, data) => { rules.bus.emit(name, data as never); },
    shared: { followers: 0, tipBoostT: 0, dogDuty: false, dogBark: 0, dogPos: null, force: { reg: null, vip: false, kap: false, gull: false, sleep: false } },
  };
  const workers = createWorkers(env), regulars = createRegulars(env), vip = createVip(env), kapkac = createKapkac(env), cats = createCats(env), dog = createDog(env), parrot = createParrot(env), gulls = createGulls(env);  // NPC Erim removed 2026-10-24 (user: sinir bozucu, tamamen sil)
  const handle: AgentsHandle = {
    registry: reg, workers, regulars, vip, kapkac, cats, gulls, dog, env,
    pigeons: () => pigeonArea(book),
    force(what, value) {
      const f = env.shared.force;
      if (what === 'regular' || what === 'reg') f.reg = typeof value === 'string' ? value : true;
      else if (what === 'vip') f.vip = true;
      else if (what === 'kapkac') f.kap = true;
      else if (what === 'gull') f.gull = true;
      else if (what === 'sleep') {
        const s = workers.rows().find((r) => r.state !== 'sleep' && r.role !== 'garson' && r.role !== 'temizlik');
        if (s) workers.forceSleep(s.id);
      }
    },
  };
  cats.prime(rules.state);
  // registry tick bookkeeping runs first, then the systems (orders 40..46)
  rules.addSystem({ id: 'agents.begin', order: 39, phase: 'sim', step: () => reg.beginTick() });
  for (const s of [workers, regulars, vip, kapkac, cats, dog, parrot, gulls]) rules.addSystem(s);
  rules.addStateView(() => {
    const r = regulars.current(), v = vip.current(), k = kapkac.current(), pam = cats.rows().find((c) => c.id === 'pamuk');
    const stareG = gulls.stare();
    const sl = workers.rows().find((w) => w.state === 'sleep');
    return {
      workers: workers.rows().map((w) => ({ id: w.id, name: w.name, role: w.role, state: w.state, pos: { x: w.x, z: w.z }, rank: w.rank, morale: Math.round(w.morale) })),
      reg: r ? { id: r.id, state: r.state, need: r.need, pos: r.pos } : null,
      vip: v ? { state: v.state, need: v.need, pos: v.pos } : null,
      kap: k ? { state: k.state, pos: k.pos, value: Math.round(k.value) } : null,
      cat: pam ? { state: pam.state, pos: { x: pam.x, z: pam.z } } : null,
      cats: cats.rows().map((c) => ({ id: c.id, state: c.state, pos: { x: c.x, z: c.z }, found: (rules.state.cats as unknown[]).some((e) => (typeof e === 'string' ? e : (e as { id: string }).id) === c.id) })),
      gull: stareG ? { mode: 'stare', pos: stareG } : null,
      sleeper: sl ? { x: sl.x, z: sl.z } : null,
    };
  });
  // Sabri keeps the waiting specials' items in hand (v2 reservedNeeds)
  rt.reserved.push(() => {
    const out: Record<string, number> = {};
    for (const c of [regulars.current(), vip.current()]) if (c && c.state === 'wait') for (const p in c.need) out[p] = (out[p] || 0) + c.need[p];
    return out;
  });
  (rt as unknown as { agents: AgentsHandle; forceAgent: AgentsHandle['force'] }).agents = handle;
  (rt as unknown as { forceAgent: AgentsHandle['force'] }).forceAgent = handle.force;
  return handle;
}

/** Hook A calls from headless (M1-API.md section 5). */
export function installAgents(rules: Rules, opts: InstallOpts = {}): AgentsHandle { return createAgents(rules, opts); }
export type { Actor, ActorRegistry, AgentHost } from './types';
