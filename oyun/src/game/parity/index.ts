// Parity mode (Builder D). ?parity=1: fixed seed, v2 playerStart, v2 default zoom, crowd from fixture.ts, HUD only,
// intro skipped (boot does seed/zoom/intro/HUD-only; this module supplies the data and the test hooks).
//
// - applyCrowd(agents): writes the v2 crowd snapshot (fixture.ts, captured by tools/v2-shots.mjs) into the agents SoA
//   for the current stage (default 1). Seated citizens get act 'sit' + seated flag; others idle.
// - playerStart(stage): v2 player position in the reference shots (teleport target).
// - Hooks (when deps.hooks + deps.render): 'parity.handles' -> { scene, camera, renderer, T } for the page-side mask
//   kit in tools/shot-compare.mjs (T carries only the three classes the kit needs, so three stays tree-shaken);
//   'parity.crowd' -> fixture for a stage; 'parity.player' -> v2 player pos.
import { MeshBasicMaterial, Color, DoubleSide } from 'three';
import type { SoAStore, RenderPipeline, TestHooks, ZoneManager, PrefabSystem, Vec2 } from '../../engine/api';
import { ACT_ORDER, AGENT_FLAG } from '../sim/schema';
import { PARITY_CROWD, PARITY_PLAYER, V2_CITIZEN_IDS } from './fixture';

export interface Parity {
  readonly on: boolean;
  applyCrowd(agents: SoAStore, stage?: number): number;
  playerStart(stage?: number): Vec2;
}
export interface ParityDeps { on: boolean; render?: RenderPipeline; hooks?: TestHooks; zones?: ZoneManager; prefab?: PrefabSystem; }

const V2_PLAYER_START: Vec2 = { x: -0.6, z: -1.6 };

export function createParity(deps: ParityDeps): Parity {
  const p: Parity = {
    on: !!deps.on,
    applyCrowd(agents, stage = 1) {
      const list = PARITY_CROWD[stage] || PARITY_CROWD[1] || [];
      const F = (n: string) => agents.f32(n), U = (n: string) => agents.u8(n);
      let n = 0;
      for (const c of list) {
        const i = agents.alloc(); if (i < 0) break;
        F('x')[i] = F('px')[i] = c.x; F('z')[i] = F('pz')[i] = c.z;
        F('rot')[i] = F('prot')[i] = c.rot; F('speed')[i] = 0;
        const ti = (V2_CITIZEN_IDS as readonly string[]).indexOf(c.type);
        U('typeId')[i] = ti < 0 ? 0 : ti;
        const act = c.sit ? 'sit' : 'idle';
        U('act')[i] = Math.max(0, (ACT_ORDER as readonly string[]).indexOf(act));
        agents.u16('flags')[i] = AGENT_FLAG.visible | AGENT_FLAG.ambient | (c.sit ? AGENT_FLAG.seated : 0);
        n++;
      }
      return n;
    },
    playerStart(stage = 1) {
      const pl = PARITY_PLAYER[stage] || PARITY_PLAYER[1];
      return pl ? { x: pl.pos.x, z: pl.pos.z } : { ...V2_PLAYER_START };
    },
  };
  const { hooks, render } = deps;
  if (hooks) {
    if (render) hooks.register('parity.handles', () => ({ scene: render.scene, camera: render.camera.camera, renderer: render.renderer, T: { MeshBasicMaterial, Color, DoubleSide } }));
    hooks.register('parity.crowd', (stage?: number) => PARITY_CROWD[stage || 1] || []);
    hooks.register('parity.player', (stage?: number) => p.playerStart(stage));
    hooks.register('parity.on', () => p.on);
  }
  return p;
}
