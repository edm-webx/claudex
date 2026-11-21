/**
 * M1 runtime types shared by every sim module and (read-only) by views and UI. Owner: Builder A.
 * `GameState` (schema.ts) is the persisted part; `Runtime` here is the non-persisted part (items on counters,
 * customers, ferry phase, ...). Views read `sim.rules.rt`; they never write it. Pure: no three, no DOM.
 */
import type { Bus, SimCtx, Vec2, Rng, Nav, InteractionRegistry, Entity, GameClock, SoAStore, AmbientSystem } from '../../engine/api';
import type { GameState, ProductId } from './schema';
import type { SimEvents } from '../events';
import type { Content } from '../../content/types';
import type { StageLayout } from '../../content/prefabs/iskele/layout';
import type { SimCmd } from './commands';
import type { FoodId } from '../../content/yemek-menu';

/**
 * One product unit (in hands, on a tray, on the counter). BUF-05: `T` widens to FoodId for kitchen plates (`Plate`: a DishId
 * plate cooked at its own station, on the pass, carried to a table, sold). Counter/stations/carry stay ProductId (runtime only, not saved).
 */
export interface Item<T extends string = ProductId> { type: T; tier: number; /** worker id who made it (wage share) */ by?: number; /** worker id who carried it */ carrier?: number; /** price multiplier (Titiz) */ priceX?: number; }
export type Order = Partial<Record<ProductId, number>>;
/** BUF-05: a plate of any food (tezgâh ürünü or mutfak yemeği, content/yemek-menu.ts FoodId); runtime only */
export type Plate = Item<FoodId>;
export interface MoneyStack { value: number; }
export interface FloorMoney { value: number; x: number; z: number; }

export type CustomerState = 'walk' | 'queue' | 'wqueue' | 'toSeat' | 'wait' | 'eat' | 'leave';   // wait: table guest waiting for the adisyon (Faz 2)
export interface Customer {
  id: number;
  typeId: string; typeIdx: number;
  kind: 'q' | 'win' | 'masa';
  n: number;                       // party size
  order: Order; got: Order;
  set: string | null;              // menu set id
  value: number;
  state: CustomerState;
  t: number; takeT: number; eatT: number;
  patience: number; patMax: number;
  sit: boolean; mood: 'happy' | 'ok' | 'angry';
  x: number; z: number; rot: number; speed: number;
  /** BUF-20: height above the pier (çatı terası / merdiven, content/kanat.ts katY); runtime only */
  y?: number;
  path: Vec2[];
  /** agents SoA slot (-1: logical only, no body) and party member slots */
  agent: number; members: number[];
  items: Plate[];
  seat: { table: number; seat: number } | null;
  say: string; sayT: number;
  calm: boolean; follower: boolean; tag: string | null;
  qi: number;
  /** musteri.ts (runtime only): special request line + its product, tourist flag, heart timer after a happy serve */
  tourist?: boolean; heartT?: number;
  /** BUF-12 kasa sırası: true = kasada sırada (state 'queue' kalır), kasaT = işlem süresi sayacı, odeme = nakit/kart (yalnız görsel) */
  kasa?: boolean; kasaT?: number; odeme?: 'nakit' | 'kart';
  /** BUF-24 büyük grup: birleştirilen ek masalar (ana masa seat.table) ve büyük grubun adı (Doğum günü kalabalığı...) */
  ekMasa?: number[]; grupAd?: string;
}

export interface StationRt { built: boolean; out: Item[]; grabT: number; /** sim time of the last worker operate() */ opT: number; /** worker id -> progress 0..1 */ prog: Record<number, number>; }
export interface TableRt { built: boolean; seats: { occ: number }[]; pile: MoneyStack[]; dirty: number; dirtyT: number; }
export interface PadRt { key: string; price: number; paid: number; pos: Vec2; kind: string; warned: boolean; label?: string; sub?: string; }   // label/sub: pads outside content/pads.ts (Faz 2 stands)
export type FerryPhase = 'away' | 'arriving' | 'docked' | 'leaving';
export interface SlowSpot { link: 'transport' | 'production' | 'queue' | 'kasa' | 'seats'; station?: string; at: Vec2; t: number; }

export interface Runtime {
  started: boolean;
  paused: boolean; pauseWhy: string;
  /** stick speed / dwell info of the player, for views */
  moving: boolean; stillT: number; movedTotal: number;
  /** player hands */
  carry: Item[];
  stations: Record<ProductId, StationRt>;
  counter: Record<ProductId, Item[]>;
  kasa: MoneyStack[];
  floor: FloorMoney[];
  tables: TableRt[];
  customers: Customer[];
  queue: Customer[]; winq: Customer[];
  /** BUF-12: kasada sırada bekleyen müşteriler (kasiyer kasa başındayken) */
  kasaQueue: Customer[];
  ferry: { state: FerryPhase; t: number; next: number; arriveAt: number; docked: boolean; /** dock +25 s etc. in sim seconds */ phaseLen: number };
  /** ferry kinds + timetable (ferry-kinds.ts); set by installFerry */
  ferryInfo?: import('./ferry-kinds').FerryInfo;
  'window': { open: boolean; t: number; sales: number } | null;
  streak: number; lastSaleT: number; lastSaleProducts: ProductId[];
  siklik: number;
  slow: SlowSpot | null;
  pads: PadRt[];
  panel: string | null; boardOpen: boolean;
  /** last model handed to the UI per overlay id (bots read these, like v2 uiLast) */
  uiLast: Record<string, unknown>;
  incomeWin: [number, number][];
  rate: number;
  /** player action label for the hero animation: 'idle' | 'cut' | 'pour' | 'pet' | 'count' */
  act: string;
  /** current stage layout (positions of counter, kasa, stations, tables, ...). Same as B's `stageLayout(stage)`. */
  layout: StageLayout;
  /** hero speech for the speech bubble */
  say: string; sayT: number;
  /** products reserved for waiting specials (C registers providers) */
  reserved: (() => Order)[];
  /** patience auras (Geveze, Türkü, Güler Yüzlü): C registers fn(x,z) -> fraction slower patience drain 0..1 */
  auras: ((x: number, z: number) => number)[];
  followers: number; tipBoostT: number; actT: number; slowCard: unknown; slowSeen: boolean;
  tutStep: string | null;
  slowSeat: number;
  dayHistory: { day: number; earned: number; customers: number }[];
  /** BUF-13: kirli tabak yığını (bulaşık istasyonunda), mutfakta çalışan sayısı (zemin kiri), temizlikçi mutfağı paspaslıyor mu; çalışma anı */
  dirtyDishes: number; mutfakBusy: number; mutfakMop: boolean;
}

/** Everything C's agents may ask of / tell A's rules. */
export interface Rules {
  readonly state: GameState;
  readonly rt: Runtime;
  readonly ctx: SimCtx;
  readonly bus: Bus<SimEvents>;
  readonly content: Content;
  readonly rng: (name: string) => Rng;
  readonly nav: Nav;
  readonly agents: SoAStore;
  readonly interactions: InteractionRegistry;
  readonly player: Entity;
  readonly playerPos: Vec2;
  readonly clock: GameClock;
  readonly ambient: AmbientSystem | null;
  /** Dispatch a command (same as sim.command). */
  command(c: SimCmd | { kind: string; [k: string]: unknown }): void;
  /** v2 `stat` / `statMax`: counters feed achievements and daily orders. */
  stat(key: string, n?: number): void;
  statMax(key: string, v: number): void;
  toast(text: string, kind?: 'good' | 'bad' | 'info'): void;
  /** Money straight into the player's pocket (window, gurme, kapkaç caught): adds to today/week/total and income window. */
  /** günlük yan gelir tavanına tabi; gerçekten ödenen tutarı döndürür (tavan kırpabilir) */
  earn(v: number, at?: Vec2): number;
  /** 2026-11-08: prize / bet payout that is not a side-income faucet, so it skips the daily bonus cap (match prizes were cut to 250 ₺). */
  earnTam?(v: number, kaynak?: string): void;
  /** EKO-02: tek gelir kapısı. Gelir defterine (S.today.src, S.stats.kaynak_*), S.today/S.week/totalEarned ve gelir penceresine yazar, cebe gerçekten ödenen tutarı döndürür. tavanli: günlük yan gelir tavanına tabi. */
  credit?(kaynak: string, tutar: number, o?: { tavanli?: boolean; at?: Vec2 }): number;
  /** EKO-02: yalnız deftere yazar, cebe dokunmaz (kasa/masa yığınına düşen satış ve bahşiş: para sonra toplanınca cashIn ile cebe girer). */
  book?(kaynak: string, tutar: number): void;
  /** EKO-02: gelir OLMAYAN cep girişi (yerden para toplama, kasa toplama, bankadan çekme, kredi, iade, yönetici): deftere yazılmaz. */
  cashIn?(tutar: number): void;
  /** `1 + ...` venue multiplier (stage, plaque, stars, şıklık). */
  venueMult(): number;
  /** Hour of day 8..24. */
  hour(): number;
  /** Register a provider merged into `v2State()` (C adds reg/vip/kap/cat/gull/sleeper/workers views). */
  addStateView(fn: () => Record<string, unknown>): void;
  /** Add a system to the sim scheduler (C uses it for its agent systems). */
  addSystem(s: import('../../engine/api').System): void;
  /** Station helpers for workers (C). */
  stations: StationApi;
  carry: CarryApi;
  counterApi: CounterApi;
  moneyApi: MoneyApi;
  salesApi: SalesApi;
  /** Test/bot surface (v2 `__bufe.state()` shape). */
  v2State(): Record<string, unknown>;
  /** Panel helpers (used by panels.ts). */
  ext: RulesExt;
  /** Host calls before writing a save: stamps lastSeen (wall ms), pile and rate into the state. */
  snapshot(wallMs: number): void;
  /** Host calls once after boot with the seconds spent away (offline earnings card). */
  welcomeBack(awaySec: number): void;
}
export interface RulesExt {
  upgradeCost(p: ProductId): number;
  orderProgress(o: { id: string; goal: number; base: number }): number;
  orderReward(): number;
  isbulHint(): string;
  tadilatReady(): boolean;
  boardModel(): Record<string, unknown>;
  siklikBonus(): number;
  takeDirty(): boolean;
}

export interface StationApi {
  isBuilt(k: ProductId): boolean;
  /** Worker produced work: advances that worker's progress at `speed` (1 = base); returns 1 when a unit finished and was put on the tray (if the tray has room), else 0. */
  operate(k: ProductId, workerId: number, dt: number, speed?: number, priceX?: number): 0 | 1;
  /** Tray (finished products) size / room. */
  outCount(k: ProductId): number;
  outFull(k: ProductId): boolean;
  /** Worker (garson) takes the oldest finished unit from the tray; grab stations make one on the spot (caller waits `grabTime`). */
  takeOut(k: ProductId, carrierId: number): Item | null;
  isGrab(k: ProductId): boolean;
  grabTime(k: ProductId): number;
  makeGrab(k: ProductId, carrierId: number): Item;
}
export interface CarryApi {
  /** Player hands. */
  count(p?: ProductId): number;
  cap(): number;
  /** Remove one unit of `p` from the player's hands (regular/VIP/window hand-over). */
  takeFromPlayer(p: ProductId): Item | null;
}
export interface CounterApi {
  count(p: ProductId): number;
  /** Put an item on the counter; false when the stack (8) is full. */
  put(it: Item): boolean;
  /** Take a unit. who='gull': the gag, nothing is removed (a fresh one is "replaced at once"); returns the tier of the snatched item. */
  take(p: ProductId, n: number, who?: 'gull' | 'customer'): Item[];
  /** Products still wanted by the first 5 customers, summed minus the counter stock (garson planning). */
  need(): Partial<Record<ProductId, number>>;
}
export interface MoneyApi {
  kasaCount(): number;
  kasaValue(): number;
  /** Kapkaççı grab: removes ceil(n/2) stacks and returns their total value. */
  grabHalf(): number;
  dropFloor(value: number, x: number, z: number): void;
  addOwedBack(v: number): void;
  /** Add `value` to the kasa pile (visual stacks capped at 30). */
  addToKasa(value: number): void;
}
export interface SalesApi {
  /** v2 settleSale for non-queue sales (regular, VIP): streak, sets, siftah, wages. Returns the money value. */
  settle(items: Plate[], opts?: { direct?: boolean; at?: Vec2 }): number;
  itemValue(it: Plate): number;
}

export const emptyRuntime = (layout: StageLayout): Runtime => ({
  started: false, paused: false, pauseWhy: '', moving: false, stillT: 0, movedTotal: 0,
  carry: [],
  stations: {
    doner: { built: true, out: [], grabT: 0, opT: -99, prog: {} }, cay: { built: false, out: [], grabT: 0, opT: -99, prog: {} }, ayran: { built: false, out: [], grabT: 0, opT: -99, prog: {} },
    simit: { built: false, out: [], grabT: 0, opT: -99, prog: {} }, tost: { built: false, out: [], grabT: 0, opT: -99, prog: {} }, gazoz: { built: false, out: [], grabT: 0, opT: -99, prog: {} },
  },
  counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] },
  kasa: [], floor: [], tables: [], customers: [], queue: [], winq: [], kasaQueue: [],
  ferry: { state: 'away', t: 0, next: 120, arriveAt: -1, docked: false, phaseLen: 0 },
  'window': null, streak: 0, lastSaleT: -99, lastSaleProducts: [], siklik: 0, slow: null, pads: [],
  panel: null, boardOpen: false, uiLast: {}, incomeWin: [], rate: 0, act: 'idle', layout, say: '', sayT: 0,
  reserved: [], auras: [], followers: 0, tipBoostT: 0, actT: 0, slowCard: null, slowSeen: false, tutStep: null, slowSeat: 0, dayHistory: [], dirtyDishes: 0, mutfakBusy: 0, mutfakMop: false,
});

/** Internal shared object of the sim modules (A only): Rules plus helpers that cross module borders. */
export interface Kernel extends Rules {
  R: { main: Rng; money: Rng; orders: Rng; board: Rng; fx: Rng };
  logEv(ev: string, extra?: Record<string, unknown>): void;
  spend(v: number): void;
  addXP(n: number): void;
  openProducts(): ProductId[];
  tablesBuilt(): number;
  hiredCount(): number;
  siklikBonus(): number;
  placedDecor(): (string | null)[];
  refreshSiklik(): void;
  todayKey(): string;
  syncOrders(force?: boolean): void;
  incomePerMin(): number;
  onLayout(): void;
  orderLeft(c: { order: Order; got: Order }): Order;
  syncPads(): void;
  unlock(key: string, load?: boolean): void;
  setTableBuilt(i: number, on: boolean): void;
  renewNext(): void;
  hasRole(role: string): boolean;
  slowSolution(link: string, station?: string): Record<string, unknown>;
  acceptSolution(): void;
  openOverlay(id: string, model: unknown): void;
  hiringHost(): import('./agents/hiring').HiringHost;
  startTadilat(paid: boolean, self?: boolean): boolean;
  /** register tick hooks in order */
  saveNow(): void;
  dirty(): void;
  setTrackedOwner(v: boolean): void;
  registerStations(): void;
  syncTablesReg(): void;
  isbulHint(): string;
  tadilatReady(): boolean;
  upgradeCost(p: ProductId): number;
}
