/**
 * engine/ecs: entities (index + generation), Map-backed component stores, SoA stores, system scheduler.
 * Owner: Builder A. Pure: no three, no DOM, no wall clock (scheduler timing clock is injected).
 * Decisions:
 * - Entity = index (low 20 bits) | generation << 20 (generation 11 bits, wraps). Freed indices are reused FIFO.
 * - ComponentStore.each iterates in insertion order (Map), stable for determinism.
 * - SoA free list is LIFO-lowest: alloc() returns the lowest free slot, so iteration order is deterministic.
 * - Scheduler: a throwing system is skipped for 1 s of sim time then retried; 3rd strike = off for good + perf warning.
 */
import type { ComponentStore, Entity, Scheduler, SchedulerDeps, SimCtx, SoASchema, SoAStore, System, World, WorldDeps } from '../api';

const IDX_BITS = 20;
const IDX_MASK = (1 << IDX_BITS) - 1;
const GEN_MASK = 0x7ff;

function createStore<T>(name: string, alive: (e: Entity) => boolean): ComponentStore<T> & { _drop(e: Entity): void } {
  const m = new Map<Entity, T>();
  return {
    name,
    has: e => m.has(e) && alive(e),
    get(e) {
      const v = m.get(e);
      if (v === undefined) throw new Error(`component ${name} missing on entity ${e}`);
      return v;
    },
    add(e, v) { m.set(e, v); return v; },
    remove(e) { m.delete(e); },
    each(fn) { m.forEach((v, e) => fn(e, v)); },
    get size() { return m.size; },
    _drop(e) { m.delete(e); },
  };
}

export function createSoA(name: string, cap: number, schema: SoASchema): SoAStore {
  const arrays: Record<string, Float32Array | Uint8Array | Uint16Array | Int32Array> = {};
  for (const [f, k] of Object.entries(schema)) {
    arrays[f] = k === 'f32' ? new Float32Array(cap) : k === 'u8' ? new Uint8Array(cap) : k === 'u16' ? new Uint16Array(cap) : new Int32Array(cap);
  }
  const used = new Uint8Array(cap);
  let hi = 0, count = 0;
  const get = <A>(f: string, kind: string): A => {
    const a = arrays[f];
    if (!a) throw new Error(`soa ${name}: no field ${f}`);
    if (schema[f] !== kind) throw new Error(`soa ${name}: field ${f} is ${schema[f]}, not ${kind}`);
    return a as unknown as A;
  };
  return {
    name, cap,
    get hi() { return hi; },
    get count() { return count; },
    f32: f => get<Float32Array>(f, 'f32'),
    u8: f => get<Uint8Array>(f, 'u8'),
    u16: f => get<Uint16Array>(f, 'u16'),
    i32: f => get<Int32Array>(f, 'i32'),
    alloc() {
      for (let i = 0; i < cap; i++) {
        if (!used[i]) {
          used[i] = 1; count++;
          for (const f in arrays) arrays[f][i] = 0;
          if (i + 1 > hi) hi = i + 1;
          return i;
        }
      }
      return -1;
    },
    free(i) {
      if (i < 0 || i >= cap || !used[i]) return;
      used[i] = 0; count--;
      while (hi > 0 && !used[hi - 1]) hi--;
    },
    alive: i => i >= 0 && i < cap && used[i] === 1,
  };
}

export function createWorld(_deps: WorldDeps = {}): World {
  const gen: number[] = [];
  const free: number[] = [];
  let freeHead = 0;
  const stores = new Map<string, ComponentStore<unknown> & { _drop(e: Entity): void }>();
  const soas = new Map<string, SoAStore>();
  const alive = (e: Entity) => {
    const i = e & IDX_MASK;
    return i < gen.length && gen[i] >= 0 && gen[i] === ((e >>> IDX_BITS) & GEN_MASK);
  };
  return {
    create() {
      let i: number;
      if (freeHead < free.length) {
        i = free[freeHead++];
        if (freeHead > 1024 && freeHead * 2 > free.length) { free.splice(0, freeHead); freeHead = 0; }
        gen[i] = (-gen[i]) & GEN_MASK; // dead stored as -(g+1); revive with generation g+1
      } else {
        i = gen.length;
        if (i > IDX_MASK) throw new Error('entity index overflow');
        gen.push(0);
      }
      return ((gen[i] << IDX_BITS) | i) >>> 0;
    },
    destroy(e) {
      if (!alive(e)) return;
      const i = e & IDX_MASK;
      stores.forEach(s => s._drop(e));
      gen[i] = -(gen[i] + 1);
      free.push(i);
    },
    alive,
    store<T>(name: string) {
      let s = stores.get(name);
      if (!s) { s = createStore<unknown>(name, alive); stores.set(name, s); }
      return s as unknown as ComponentStore<T>;
    },
    soa(name, cap, schema) {
      let s = soas.get(name);
      if (!s) {
        if (!schema) throw new Error(`soa ${name}: schema required on first call`);
        s = createSoA(name, cap, schema);
        soas.set(name, s);
      }
      return s;
    },
  };
}

interface Slot { sys: System; strikes: number; offUntil: number; dead: boolean; }

export function createScheduler(deps: SchedulerDeps = {}): Scheduler {
  const slots: Slot[] = [];
  const timing: Record<string, number> = {};
  const now = deps.now;
  const sort = () => slots.sort((a, b) => (a.sys.order - b.sys.order) || (a.sys.id < b.sys.id ? -1 : a.sys.id > b.sys.id ? 1 : 0));
  return {
    add(s) {
      if (slots.some(x => x.sys.id === s.id)) throw new Error(`system ${s.id} already added`);
      slots.push({ sys: s, strikes: 0, offUntil: -1, dead: false }); sort();
    },
    replace(id, s) {
      const sl = slots.find(x => x.sys.id === id);
      if (!sl) { slots.push({ sys: s, strikes: 0, offUntil: -1, dead: false }); sort(); return; }
      sl.sys = s; sl.strikes = 0; sl.offUntil = -1; sl.dead = false; sort();
    },
    remove(id) {
      const i = slots.findIndex(x => x.sys.id === id);
      if (i >= 0) slots.splice(i, 1);
    },
    run(phase, ctx: SimCtx) {
      for (let i = 0; i < slots.length; i++) {
        const sl = slots[i];
        if (sl.sys.phase !== phase || sl.dead) continue;
        if (sl.offUntil > ctx.t) continue;
        const t0 = now ? now() : 0;
        try {
          sl.sys.step(ctx);
        } catch (e) {
          sl.strikes++;
          if (sl.strikes >= 3) {
            sl.dead = true;
            deps.perf?.warn(`Sistem kapandı: ${sl.sys.id}`);
          } else sl.offUntil = ctx.t + 1;
          deps.log?.error(`system ${sl.sys.id} threw (strike ${sl.strikes})`, e);
          try { ctx.bus.emit('systemError', { id: sl.sys.id, strikes: sl.strikes }); } catch { /* ignore */ }
        }
        if (now) timing[sl.sys.id] = now() - t0;
      }
    },
    timings: () => timing,
    disabled: () => slots.filter(s => s.dead).map(s => s.sys.id),
  };
}
