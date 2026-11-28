/**
 * Faces (animasyon-5): 12 expressions in EXPR_ORDER. `eyes`/`mouth` name the painted parts (documentation +
 * future art slots: atlas row = eyes, column = mouth). `crowdRow` is the row of the crowd face atlas
 * (0 normal, 1 blink, 2 happy, 3 angry, 4 talk, 5 surprised, 6 sleepy, 7 pout); `farRow` is the 4-expression far LOD
 * (GDD: simple faces in the crowd); `far: true` marks the 4 expressions that far LOD keeps. `brow` is the default brow for heroes (spring targets in chars). Owner: Builder C.
 */
import type { ExprId, BrowId } from '../../engine/api';
import type { FaceDef } from '../types';

export interface MotorFaceDef extends FaceDef { id: ExprId; crowdRow: number; farRow: number; brow: BrowId; blink: boolean; }
// eyes: 0 open, 1 arc-up (happy), 2 narrowed, 3 closed, 4 wide, 5 heart, 6 wink, 7 look-aside, 8 lidded
// mouth: 0 soft smile, 1 wide smile, 2 open grin, 3 laugh, 4 o, 5 small o, 6 pursed, 7 frown, 8 crooked smile, 9 flat
export const FACES: MotorFaceDef[] = [
  { id: 'neutral', far: true, eyes: 0, mouth: 0, crowdRow: 0, farRow: 0, brow: 'flat', blink: true },
  { id: 'smile', eyes: 0, mouth: 1, crowdRow: 0, farRow: 0, brow: 'flat', blink: true },
  { id: 'grin', far: true, eyes: 1, mouth: 2, crowdRow: 2, farRow: 2, brow: 'up', blink: false },
  { id: 'laugh', eyes: 1, mouth: 3, crowdRow: 2, farRow: 2, brow: 'up', blink: false },
  { id: 'surprised', eyes: 4, mouth: 4, crowdRow: 5, farRow: 0, brow: 'up', blink: true },
  { id: 'sleepy', far: true, eyes: 3, mouth: 5, crowdRow: 6, farRow: 6, brow: 'down', blink: false },
  { id: 'pout', eyes: 8, mouth: 6, crowdRow: 7, farRow: 3, brow: 'worried', blink: true },
  { id: 'grumpy', far: true, eyes: 2, mouth: 7, crowdRow: 3, farRow: 3, brow: 'down', blink: true },
  { id: 'love', eyes: 5, mouth: 0, crowdRow: 2, farRow: 2, brow: 'up', blink: false },
  { id: 'wink', eyes: 6, mouth: 8, crowdRow: 2, farRow: 2, brow: 'oneUp', blink: false },
  { id: 'thinking', eyes: 7, mouth: 9, crowdRow: 0, farRow: 0, brow: 'down', blink: true },
  { id: 'bliss', eyes: 3, mouth: 0, crowdRow: 6, farRow: 6, brow: 'flat', blink: false },
];
export default FACES;
