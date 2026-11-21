/**
 * Shared types of the M1 agents layer (Builder C): the actor registry the individual-rig views read, the host
 * interface A's economy side implements, and small value types. Pure: no three, no DOM.
 *
 * Decisions (contract silent):
 * - Everything that is drawn as an individual rig (workers, regulars, VIP, kapkaççı, cats, dog, gulls) is an
 *   `Actor` in a plain registry (`ActorRegistry`), not in the shared agents SoA (that is for the instanced crowd).
 *   Views diff the registry by `id` each frame (add / remove rigs) and lerp prev -> cur with alpha.
 * - The agents layer never owns items or money. Everything it needs from the economy side goes through
 *   `AgentHost` (A implements it over stations/carry/counter/orders/money). Items it carries are plain
 *   `{ type, tier }` records: A converts them on `counterPut`.
 */
import type { Vec2, Vec3 } from '../../../engine/api';
import type { ProductId } from '../schema';

export type ActorKind = 'worker' | 'regular' | 'vip' | 'kapkac' | 'cat' | 'dog' | 'gull' | 'parrot';

export interface CarryItem { type: ProductId; tier: number; by?: number; carrier?: number; priceX?: number }

/** One individually drawn character. All fields are plain numbers/strings so the sim stays serialisable. */
export interface Actor {
  /** Unique, never reused within a session. */
  readonly id: number;
  readonly kind: ActorKind;
  /** Stable key: worker id as text, regular/vip id, cat id, 'karamel', 'gull-3', 'kapkac'. */
  readonly key: string;
  /** Rig options for chars.makeHero / makeCat / makeDog / makeGull (v2 names: kind, role, look, seed, coat, name). */
  readonly rig: Record<string, unknown>;
  x: number; z: number; px: number; pz: number;
  y: number; py: number;
  rot: number; prot: number;
  /** m/s along the ground (drives gait). */
  speed: number;
  /** ActId for people ('idle','walk','pour',...), v2 animal act / mode names for animals ('sleep','rub','stand','glide'...). */
  act: string;
  mood: 'happy' | 'ok' | 'impatient' | 'sad' | 'asleep';
  /** Items shown in the carried stack (people only). */
  carry: CarryItem[];
  /** Speech bubble text and seconds left. */
  say: string; sayT: number;
  /** Heart / emote hints for the view: 'heart', 'zzz', 'bark', 'selfie'. */
  fx: string;
  /** Seconds the actor has been 'in view' state-wise, for fade; not used by sim rules. */
  state: string;
  /** Free-form per-kind data the view may read (rank, role, trait, gait). */
  info: Record<string, unknown>;
  /** The view removes the rig when this is true; the registry drops the record afterwards. */
  dead: boolean;
}

export interface ActorRegistry {
  readonly list: Actor[];
  /** Bumps on every add/remove so views know to re-sync cheaply. */
  readonly version: number;
  get(id: number): Actor | undefined;
  byKey(kind: ActorKind, key: string): Actor | undefined;
  add(kind: ActorKind, key: string, rig: Record<string, unknown>, at: Vec2, info?: Record<string, unknown>): Actor;
  remove(a: Actor): void;
  /** Copies cur -> prev for every actor (start of tick). */
  beginTick(): void;
}

/** What the agents layer needs from the economy side. `hostFromRules` (host.ts) implements it over A's `Rules`; tests use a stub. */
export interface AgentHost {
  /** Faz 2: while the ferry window is open and a worker is posted there: who and where (else null). */
  windowPost?(): { wid: number; at: Vec2 } | null;
  /** Faz 2: the posted worker reached the window (window.ts serves from the counter then). */
  setPencereAt?(on: boolean): void;
  hour(): number;
  player(): { x: number; z: number; moving: boolean };
  stationBuilt(p: ProductId): boolean;
  openProducts(): ProductId[];
  tablesBuilt(): number;
  /** Tables with dirty plates. */
  dirtyTables(): { index: number; x: number; z: number }[];
  cleanTable(index: number, workerId: number): void;
  /** Products the first queued customers still want, minus counter stock. */
  need(): Partial<Record<ProductId, number>>;
  counterStock(p: ProductId): number;
  counterFree(p: ProductId): boolean;
  queueLength(): number;
  // ---- stations (A's StationApi)
  operate(p: ProductId, workerId: number, dt: number, speed: number, priceX: number): 0 | 1;
  /** Remove the unit just made (aceleci drops it and redoes it). */
  dropLast(p: ProductId): void;
  outCount(p: ProductId): number;
  outFull(p: ProductId): boolean;
  takeOut(p: ProductId, carrier: number): CarryItem | null;
  isGrab(p: ProductId): boolean;
  grabTime(p: ProductId): number;
  makeGrab(p: ProductId, carrier: number): CarryItem;
  counterPut(item: CarryItem): boolean;
  /** garson flow (restoran.ts): plates waiting at the pass for a table */
  garsonClaim?(wid: number, n: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonOpen?(wid: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonDone?(wid: number, id: number): boolean;
  /** kitchen: claim the oldest ticket item nobody cooks yet; done puts the finished plate on the pass */
  masaClaim?(wid: number): { id: number; kind: 'menu' | 'hesap'; x: number; z: number } | null;
  masaDone?(wid: number, id: number): void;
  kitchenClaim?(wid: number): ProductId | null;
  kitchenDone?(wid: number, ok: boolean): void;
  // ---- specials
  playerHas(p: ProductId): boolean;
  playerTake(p: ProductId): CarryItem | null;
  settle(items: CarryItem[], at: Vec2): number;
  earn(value: number, at: Vec2): void;
  kasaCount(): number;
  kasaValue(): number;
  grabHalf(): number;
  dropFloor(value: number, x: number, z: number): void;
  addOwedBack(v: number): void;
  addToKasa(v: number): void;
  /** Free gag; true when something was there to snatch. */
  counterTake(p: ProductId): boolean;
  venueMult(): number;
  // ---- feedback
  toast(text: string, kind: 'info' | 'good' | 'bad'): void;
  stat(key: string, n?: number): void;
  statMax(key: string, v: number): void;
  heroSay(text: string, t?: number): void;
  heroAct(act: string, t: number): void;
  tipBoost(seconds: number): void;
  addFollowers(n: number): void;
  laughNearby(): void;
  hero(): 'sabri' | 'sabriye';
  windowOpen(): boolean;
}

export type { Vec2, Vec3 };
