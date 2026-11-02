/** Shared environment handed to every agents system. */
import type { Nav, Rng, SimCtx, Vec2, InteractionRegistry, Entity } from '../../../engine/api';
import type { AnchorBook } from './anchors';
import type { ActorRegistry, AgentHost } from './types';
import type { EventName } from '../../events';

export interface AgentEnv {
  host: AgentHost;
  nav: Nav;
  book: AnchorBook;
  reg: ActorRegistry;
  interactions: InteractionRegistry;
  /** The player's entity (interaction actor). */
  playerEntity: Entity;
  rng(name: string): Rng;
  /** Player position (live). */
  player(): Vec2;
  emit(name: EventName, data?: Record<string, unknown>): void;
  /** Runtime side channels shared with A / views (followers, tip boost...). */
  shared: { followers: number; tipBoostT: number; dogDuty: boolean; dogBark: number; dogPos: Vec2 | null; force: { reg: string | boolean | null; vip: boolean; kap: boolean; gull: boolean; sleep: boolean; noDog?: boolean } };
}
export type StepCtx = SimCtx;

/** Distance (path metres) past which walk-ins vanish (v2 P.LEAVE_M) and where they appear (P.ENTRY_M). */
export const LEAVE_M = 18;
export const ENTRY_M: [number, number] = [13, 17];
