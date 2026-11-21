/**
 * Esnaf Yatırımları: the long money ladder (MMORPG/tycoon mix). Every investment has 5 levels, each level unlocks with
 * a kiosk stage (level n needs stage n), so there is always something dearer to save for until stage 5 and beyond.
 * Effects are small per level and multiply nothing else (ekonomi2.ts keeps income capped): they buy comfort and capacity.
 * Survey 2026-10-24: only the mahalle afişi (reklam) stays; the other three were answered "Hiç".
 * Pure data; the save keeps only { id: level } in state.zones.yatirim.
 */
export interface YatirimDef { id: string; name: string; desc: string; icon: string; cost: number[]; perLevel: number; unit: string }
export const YATIRIM_MAX = 5;
export const YATIRIM: YatirimDef[] = [
  { id: 'reklam', name: 'Mahalle afişleri', desc: 'Telgraf direklerine ilan, bakkala el ilanı. Daha çok kişi uğrar.', icon: 'ferry', cost: [6000, 30000, 140000, 700000, 3500000], perLevel: 0.06, unit: 'müşteri sıklığı' },
];
export const yatirimDef = (id: string): YatirimDef | undefined => YATIRIM.find(y => y.id === id);
