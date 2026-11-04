/**
 * Pigeons and the far flock are purely visual in v2 (they scatter from Sabri's footsteps, never touch rules). The sim
 * only publishes the area they live in; the view (view/chars/agents-view.ts) reads the player position itself.
 */
import type { AnchorBook } from './anchors';
export interface PigeonArea { x0: number; x1: number; z0: number; z1: number; cx: number; cz: number; radius: number }
/** v2: x -8..8, z = mean spawn z +-2. */
export function pigeonArea(book: AnchorBook): PigeonArea {
  const sp = book.spawns();
  const pz = sp.length ? sp.reduce((s, v) => s + v.z, 0) / sp.length : 8;
  return { x0: -8, x1: 8, z0: pz - 2, z1: pz + 2, cx: 0, cz: pz, radius: 6 };
}
export const FLOCK = { y: 16, z: -30, radius: 26 };
