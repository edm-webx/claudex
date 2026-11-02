/**
 * Content table types. Lead-owned, FROZEN at kickoff (CONTRACT.md).
 * Content modules (src/content/**) export typed tables; `Content` is the registry bag passed into sim and views.
 * Field names mirror v2 data.js (3d/v2/js/data.js) so ports keep numbers 1:1.
 * Decision: M1+ tables not fully specified yet are typed with the v2 fields known today plus an index signature,
 * so owners can add fields without a lead change; `extra` holds any brand-new table until promoted here.
 */
import type { ZoneDef, PrefabDef, EffectDef, ClipDef, GaitId, ArtManifest, TierName, InteractKind } from '../engine/api';
import type { ProductId } from '../game/sim/schema';

export type HourRange = [number, number];

export interface ProductTier { name: string; desc: string; }
export interface ProductDef {
  id: ProductId; name: string; short: string; base: number; prep: number;
  ritual: 'cut' | 'pour' | 'idle' | string; station: string; icon: string; h: number;
  tiers: ProductTier[];
  [k: string]: unknown;
}
export interface SetDef { id: string; items: ProductId[]; x: number; name: string; }
export interface StationDef {
  id: string; name: string; product: ProductId; role: string | null; act: 'cut' | 'pour' | 'idle' | string; grab: boolean;
  /** Dwell rule tuning (MOTOR §8). */
  dwell?: number; takeLimit?: number; kind?: InteractKind;
}
export interface CitizenTypeDef {
  id: string; name: string; patience: number; tip: number; w: number;
  hours: HourRange[]; peak: HourRange[]; prefer: Partial<Record<ProductId, number>>;
  group: [number, number]; items: [number, number]; sit: number; voice: number;
  scenery?: boolean; performer?: boolean; ferry?: boolean; wave?: number; months?: number[];
  gait?: GaitId;
  look?: Record<string, unknown>;
  [k: string]: unknown;
}
export interface CrowdBudgetRow { queue: number; seated: number; ambient: number; passers: number; }
/** v2 `D.P` economy constants and friends (numbers kept). */
export interface EconomyTable { [k: string]: number | number[] | Record<string, number> | unknown; }
export interface FaceDef { id: string; eyes: number; mouth: number; far?: boolean; }
export interface LineTable { [key: string]: string | string[]; }

export interface RoleDef { id: string; name: string; [k: string]: unknown; }
export interface TraitDef { id: string; name: string; desc?: string; [k: string]: unknown; }
export interface RankDef { name: string; xp: number; [k: string]: unknown; }
export interface RegularDef { id: string; name: string; [k: string]: unknown; }
export interface VipDef { id: string; name: string; [k: string]: unknown; }
export interface CatDef { id: string; name: string; story?: string; [k: string]: unknown; }
export interface DecorDef { id: string; name: string; prefab: string; price: number; keyif?: number; socket?: string; [k: string]: unknown; }
export interface PadDef { id: string; [k: string]: unknown; }
export interface StageDef { stage: number; [k: string]: unknown; }
export interface AchievementDef { id: string; name: string; [k: string]: unknown; }
export interface EsnafDef { id: string; name: string; shop: string; zone: string; hours: HourRange; [k: string]: unknown; }
export interface ScheduleTemplate { id: string; legs: { at: number; anchor: string; zone?: string; act?: string }[]; }
export interface SfxDef { id: string; [k: string]: unknown; }

export interface Content {
  /** Hash of all tables; replays and editor overrides are keyed by it. */
  hash: string;
  products: Record<ProductId, ProductDef>;
  productIds: readonly ProductId[];
  sets: SetDef[];
  stations: Record<string, StationDef>;
  citizens: CitizenTypeDef[];
  crowdBudget: Record<TierName, CrowdBudgetRow>;
  economy: EconomyTable;
  zones: Record<string, ZoneDef>;
  prefabs: Record<string, PrefabDef>;
  effects: Record<string, EffectDef>;
  clips: Record<string, ClipDef>;
  faces: FaceDef[];
  art: ArtManifest;
  lines: LineTable;
  uiText: LineTable;
  // M1+
  roles?: Record<string, RoleDef>;
  traits?: Record<string, TraitDef>;
  ranks?: RankDef[];
  names?: Record<string, string[]>;
  regulars?: RegularDef[];
  vips?: VipDef[];
  cats?: CatDef[];
  decor?: Record<string, DecorDef>;
  pads?: Record<string, PadDef>;
  stages?: StageDef[];
  achievements?: AchievementDef[];
  daily?: unknown[];
  sfx?: Record<string, SfxDef>;
  esnaf?: EsnafDef[];
  schedules?: Record<string, ScheduleTemplate>;
  extra?: Record<string, unknown>;
}

export type ContentTable = Exclude<keyof Content, 'hash'>;

/** Live registry for hot reload: `import.meta.hot.accept` -> `content.replace(table, value)`. */
export interface ContentRegistry {
  get(): Content;
  replace<K extends ContentTable>(table: K, value: Content[K]): void;
  onReplace(cb: (table: ContentTable) => void): () => void;
}
