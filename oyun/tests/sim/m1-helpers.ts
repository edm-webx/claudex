// Shared helpers for A's M1 sim tests (not a test file).
import { createSim, type SimFull } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
import type { GameState } from '../../src/game/sim/schema';

export const log = { info() {}, warn() {}, error() {} };
export function mkSim(seed = 1, save?: GameState): SimFull {
  return createSim({ seed, content: emptyContent(), save }, { log });
}
export function played(seed = 1): SimFull { const s = mkSim(seed); s.command({ kind: 'play', hero: 'sabri' }); return s; }
export const events = (sim: SimFull, name: string) => sim.events(0).filter(e => e.name === name);
export function fakePlatform() {
  const m = new Map<string, string>(), db = new Map<string, unknown>();
  let wall = Date.UTC(2026, 9, 17, 12);
  return {
    m, db, setWall(v: number) { wall = v; },
    platform: {
      storage: { available: true, get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => { m.set(k, v); return true; }, del: (k: string) => { m.delete(k); }, keys: (p: string) => [...m.keys()].filter(k => k.startsWith(p)).sort() },
      idb: { available: async () => true, get: async (k: string) => db.get(k) as never, set: async (k: string, v: unknown) => { db.set(k, v); return true; }, del: async (k: string) => { db.delete(k); }, keys: async (p: string) => [...db.keys()].filter(k => k.startsWith(p)).sort() },
      clock: { now: () => 0, wall: () => wall },
    } as never,
  };
}
