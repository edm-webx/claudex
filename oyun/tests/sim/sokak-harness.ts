// DNY-01: gerçek iskele yürüme ızgarası (tarayıcıdan __marti.grid('iskele') dökümü, aşama 1, tests/fixtures/iskele-izgara.txt)
// ile ambient sokak kipini Node'da yürütür. Satır k: z = 58.5 - k*0.5; sütun c: x = -62 + c*0.5. '.' yürünür.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAmbient } from '../../src/game/sim/ambient';
import { createNav } from '../../src/engine/nav';
import { createWorld } from '../../src/engine/ecs';
import { createRngStreams } from '../../src/engine/core';
import { AGENTS, AGENT_CAP, AGENT_SCHEMA } from '../../src/game/sim/schema';
import { iskeleZone } from '../../src/content/zones/iskele';
import type { Nav, SimCtx, SoAStore, AmbientSystem } from '../../src/engine/api';

let grid: Uint8Array | null = null;
export function sokakNav(): Nav {
  if (!grid) {
    const rows = readFileSync(resolve(__dirname, '../fixtures/iskele-izgara.txt'), 'utf8').split('\n');
    grid = new Uint8Array(248 * 156);
    rows.forEach((r, k) => { const iz = 155 - k; if (iz < 0 || iz >= 156) return; for (let c = 0; c < 248; c++) grid![iz * 248 + c] = r[c] === '.' ? 1 : 0; });
  }
  const nav = createNav();
  nav.addGrid({ cell: 0.5, w: 248, h: 156, origin: { x: -62, z: -19 }, cost: grid.slice(), zone: 'iskele' });
  return nav;
}

export interface SokakRun { amb: AmbientSystem & { rows(): { slot: number; state: number; rol: number; x: number; z: number; inside: boolean; spot: string; seated: boolean; gizli: boolean; exit: boolean }[]; sokak: boolean; count: number }; s: SoAStore; nav: Nav; ctx: SimCtx; state: { player: { x: number; z: number }; zones: Record<string, unknown>; day: number }; clock: { hour: number }; tick(n?: number, each?: () => void): void }

export function sokakRun(seed: number, hour = 13, hero = { x: 0, z: 8 }): SokakRun {
  const nav = sokakNav();
  const anchors = iskeleZone().anchors;
  const amb = createAmbient({ nav, anchors: (id) => (id === 'iskele' ? anchors : {}) }) as SokakRun['amb'];
  const world = createWorld();
  const rng = createRngStreams(seed);
  const state = { player: { ...hero }, zones: {} as Record<string, unknown>, day: 1 };
  const clock = { hour };
  const ctx = { tick: 0, dt: 1 / 30, t: 0, world, rng, state, clock } as unknown as SimCtx;
  const s = world.soa(AGENTS, AGENT_CAP, AGENT_SCHEMA);
  let k = 0;
  const tick = (n = 1, each?: () => void) => {
    for (let j = 0; j < n; j++, k++) {
      ctx.tick = k; ctx.t = k / 30;
      for (let i = 0; i < s.hi; i++) { s.f32('px')[i] = s.f32('x')[i]; s.f32('pz')[i] = s.f32('z')[i]; s.f32('prot')[i] = s.f32('rot')[i]; }
      amb.step(ctx);
      each?.();
    }
  };
  return { amb, s, nav, ctx, state, clock, tick };
}
