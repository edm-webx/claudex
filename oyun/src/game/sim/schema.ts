/**
 * GameState shape, SAVE_VERSION and the shared `agents` SoA schema.
 * Lead-owned, FROZEN at kickoff (CONTRACT.md). Pure: no three, no DOM.
 *
 * GameState = persistent, JSON-able data only (what gets saved). Field names follow v2 DEFAULTS (3d/v2/js/game.js)
 * so the v2 importer (M1, migrate-v2.ts) maps 1:1. Runtime-only data lives in component stores / the agents SoA.
 * Decisions: v2 runtime-ish fields (`today`, `orders`, `jobCards`) stay persisted as in v2. Loose sub-shapes
 * (workers, cats, decor, orders...) are typed minimally with index signatures; M1 owners refine inside them without
 * changing this file. New top-level fields need a SAVE_VERSION bump + migration (request from lead).
 */
import type { SoASchema } from '../../engine/api';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'marti-bufe';
/** v2 localStorage key (import in local dev). */
export const V2_SAVE_KEY = 'sabrinin-bufesi-v2';

export type ProductId = 'doner' | 'cay' | 'ayran' | 'simit' | 'tost' | 'gazoz';
export const PRODUCT_IDS: readonly ProductId[] = ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'];
export type GradeId = 'lezzet' | 'hiz' | 'siklik' | 'sohret' | 'temizlik';
export type HeroId = 'sabri' | 'sabriye';

export interface WorkerSave { id: number; name: string; role: string; xp: number; morale: number; traits: string[]; rarity?: string; [k: string]: unknown; }
export interface CatSave { id: string; name?: string; trust?: number; [k: string]: unknown; }
export interface DecorSlotSave { slot: string; item: string; rotY?: number; paint?: { material?: string; color?: string; pattern?: string; shape?: string }; [k: string]: unknown; }
export interface TodaySave { earned: number; customers: number; angry: number; served: number; waitFrac: number; dirtyT: number; slow: Record<string, number>; sets: number; }
export interface PlayerSave { zone: string; x: number; z: number; rot: number; }
export interface CitizenSave { id: number; typeId: string; seed: number; home: string; job: string; schedule: string; zone: string; x: number; z: number; }
export interface SettingsSave {
  muted: boolean;
  quality: 'auto' | 'akici' | 'dengeli' | 'sahane';
  autoTier: 'akici' | 'dengeli' | 'sahane' | null;
  music: number; sfx: number; voice: number;
  textScale: number; hand: 'left' | 'right'; colorBlindIcons: boolean; haptics: boolean; batterySaver: boolean;
  perfMeter: boolean; ownMusic: boolean;
}

export interface GameState {
  version: number;
  seed: number;
  // v2 fields
  hero: HeroId | null;
  money: number; gold: number; xp: number; level: number;
  day: number; dayT: number; playT: number; totalEarned: number;
  owned: Record<string, number>; padPaid: Record<string, number>; tiers: Record<ProductId, number>;
  stage: number; renewed: string[]; tadilat: { part: string; endsAt: number; [k: string]: unknown } | null;
  workers: WorkerSave[]; nextWid: number; jobCards: unknown[] | null; jobRefreshAt: number; boards: number;
  stars: number; grades: Record<GradeId, number>; gurmePass: boolean; plaque: number;
  stats: Record<string, number>; ach: Record<string, number>; cats: CatSave[]; dog: boolean;
  decorOwned: string[]; decorSlots: DecorSlotSave[]; sign: Record<string, unknown> | null;
  magnet: number; kepenk: number;
  orders: unknown[] | null; regulars: Record<string, Record<string, unknown>>; vipLast: number;
  tut: Record<string, number>; settings: SettingsSave;
  pile: number; floor: number; owedBack: number;
  siftahDate: string; lastSeen: number; rate: number;
  week: { earned: number; customers: number }; today: TodaySave | null;
  kapkacDay: number; karamelDay: number; teamDay: number; teamWin: boolean; tanidikDay: number;
  // Martı Motoru additions
  player: PlayerSave;
  /** Persistent citizens (M2+); empty in M0/M1. */
  citizens: CitizenSave[];
  /** Per-zone persistent data (shop states, esnaf friendship, ...), keyed by zone id. */
  zones: Record<string, Record<string, unknown>>;
  /** Real-calendar date of the last session start (YYYY-MM-DD), input to sim. */
  calendar: string;
}

export function newToday(): TodaySave {
  return { earned: 0, customers: 0, angry: 0, served: 0, waitFrac: 0, dirtyT: 0, slow: {}, sets: 0 };
}

export function defaultSettings(): SettingsSave {
  return {
    muted: false, quality: 'auto', autoTier: null, music: 0.8, sfx: 1, voice: 1,
    textScale: 1, hand: 'right', colorBlindIcons: false, haptics: true, batterySaver: false, perfMeter: false, ownMusic: false,
  };
}

/** Fresh state (v2 DEFAULTS + additions). Pure. */
export function defaultState(seed = 1): GameState {
  return {
    version: SAVE_VERSION, seed,
    hero: null, money: 0, gold: 0, xp: 0, level: 1,
    day: 1, dayT: 0, playT: 0, totalEarned: 0,
    owned: {}, padPaid: {}, tiers: { doner: 1, cay: 1, ayran: 1, simit: 1, tost: 1, gazoz: 1 },
    stage: 1, renewed: [], tadilat: null,
    workers: [], nextWid: 1, jobCards: null, jobRefreshAt: 0, boards: 0,
    stars: 0, grades: { lezzet: 1, hiz: 1, siklik: 1, sohret: 1, temizlik: 1 }, gurmePass: false, plaque: 0,
    stats: {}, ach: {}, cats: [], dog: false,
    decorOwned: [], decorSlots: [], sign: null,
    magnet: 0, kepenk: 0,
    orders: null, regulars: {}, vipLast: 0,
    tut: {}, settings: defaultSettings(),
    pile: 0, floor: 0, owedBack: 0,
    siftahDate: '', lastSeen: 0, rate: 0,
    week: { earned: 0, customers: 0 }, today: newToday(),
    kapkacDay: 0, karamelDay: 0, teamDay: 0, teamWin: false, tanidikDay: 0,
    player: { zone: 'iskele', x: 0, z: 0, rot: 0 },
    citizens: [], zones: {}, calendar: '',
  };
}

// ───────────────────────────── agents SoA ─────────────────────────────
// One shared SoA for every moving character the crowd view draws (citizens, customers, walkers).
// Sim writes (x,z,rot,speed,...), copies cur->prev (px,pz,prot) at the start of each tick; views lerp with alpha.

export const AGENTS = 'agents';
export const AGENT_CAP = 256;
export const AGENT_SCHEMA = {
  x: 'f32', z: 'f32',           // current position (m)
  px: 'f32', pz: 'f32',         // previous tick position (render interpolation)
  rot: 'f32', prot: 'f32',      // yaw current / previous (rad)
  speed: 'f32',                 // m/s (drives gait phase)
  gait: 'u8',                   // index into GAIT_ORDER
  act: 'u8',                    // index into ACT_ORDER
  mood: 'u8',                   // index into MOOD_ORDER
  expr: 'u8',                   // index into EXPR_ORDER
  carry: 'u8',                  // items carried (stack count, 0..255)
  typeId: 'u8',                 // index into content citizens table (v2 24 ids order)
  lod: 'u8',                    // AGENT_LOD
  zone: 'u8',                   // zone index (ZONE_ORDER)
  flags: 'u16',                 // AGENT_FLAG bits
} as const satisfies SoASchema;
export type AgentField = keyof typeof AGENT_SCHEMA;

export const GAIT_ORDER = ['normal', 'waddle', 'brisk', 'slow', 'shuffle', 'kid', 'run'] as const;
export const ACT_ORDER = ['none', 'idle', 'walk', 'carry', 'cut', 'pour', 'serve', 'sit', 'sip', 'eat', 'wave', 'sleep', 'sweep', 'phone', 'grab', 'cheer', 'perform', 'dance'] as const;
export const MOOD_ORDER = ['happy', 'ok', 'impatient', 'sad', 'asleep'] as const;
export const EXPR_ORDER = ['neutral', 'smile', 'grin', 'laugh', 'surprised', 'sleepy', 'pout', 'grumpy', 'love', 'wink', 'thinking', 'bliss'] as const;
/** Zone index for the u8 `zone` field. Append only. */
export const ZONE_ORDER = ['iskele', 'test-sokak', 'carsi', 'meydan', 'barinak', 'sahil'] as const;
export const AGENT_LOD = { A: 0, B: 1, C: 2 } as const;
export const AGENT_FLAG = {
  visible: 1 << 0,      // view should draw it
  customer: 1 << 1,     // recruited by customers system (M1)
  seated: 1 << 2,
  queued: 1 << 3,
  leaving: 1 << 4,
  hero: 1 << 5,         // drawn as an individual rig, crowd skips it
  ambient: 1 << 6,      // ambient walker (C)
  group: 1 << 7,        // part of a group
  persistent: 1 << 8,   // a persistent citizen (M2)
  scenery: 1 << 9,      // scenery type (simitçi, oltacı...)
} as const;
