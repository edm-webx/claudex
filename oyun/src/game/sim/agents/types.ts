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
import type { FoodId } from '../../../content/yemek-menu';

export type ActorKind = 'worker' | 'regular' | 'sakin' | 'vip' | 'kapkac' | 'cat' | 'dog' | 'gull' | 'parrot';

/** a plate in a garson's hands: x,z = the target table's side, gx,gz = where to bring it back (geri) */
export interface GarsonTabak { id: number; p: FoodId; table: number; x: number; z: number; geri: boolean; gx: number; gz: number }

export interface CarryItem<T extends string = ProductId> { type: T; tier: number; by?: number; carrier?: number; priceX?: number }

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
  /** Items shown in the carried stack (people only). BUF-05: kitchen/garson plates may be dishes (FoodId). */
  carry: CarryItem<FoodId>[];
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
  dirtyTables(): { index: number; x: number; z: number; /** s the table has been dirty (BUF-28: cleaners take the oldest first) */ age?: number }[];
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
  /**
   * BUF-09 garson task queue (restoran.ts): priority hot plate > take order > menu > bill > wipe. `isAl` claims the next task
   * (plates: up to `cap`, from one source), `tabakAl` takes the claimed plates off the pass / counter when the garson stands
   * there, `isTamam` finishes a task at the table (plate: 'tasi' = carry it to another table, 'geri' = bring it back to the rack),
   * `tabakGeri` puts returned plates back, `isBirak` releases everything (timeout, fired, window post).
   */
  isAl?(wid: number, o: { cap: number; at?: Vec2 & { kat?: 'W' | 'E' | null } }): { id: number; tur: 'tabak' | 'siparis' | 'menu' | 'hesap' | 'sil'; table: number; x: number; z: number; n?: number; bekle?: number } | null;
  tabakAl?(wid: number): GarsonTabak[];
  tepsi?(wid: number): GarsonTabak[];
  isTamam?(wid: number, id: number, at: Vec2): { durum: 'tamam' | 'tasi' | 'geri' | 'yok'; table?: number; x?: number; z?: number };
  tabakGeri?(wid: number): number;
  isBirak?(wid: number): void;
  /** BUF-05: where the garson picks his claimed plates up: the kitchen pass (world point) or null (front counter) */
  passDurak?(wid: number): Vec2 | null;
  /** BUF-19: boştaki garsonun bölge postu (kanat / salon bölgesi; yoksa null: tezgâh yanı) */
  garsonPost?(wid: number): (Vec2 & { bolge?: string }) | null;
  /** boştaki garsonun bölge devriye noktaları (restoran.ts garsonDevriye) */
  garsonDevriye?(wid: number): Vec2[];
  /** kitchen line (sim/mutfak-hat.ts): claim the oldest ticket item + a free station for it (nearest to `from`) */
  kitchenClaim?(wid: number, opt?: { from?: Vec2 }): FoodId | null;
  /** legacy one-step finish (ok) / give the job up (!ok) */
  kitchenDone?(wid: number, ok: boolean): void;
  /** station id the cook reserved */
  kitchenIst?(wid: number): string | null;
  /** real cooking time (s): DishDef.hazirlik / (1 + rank + chef), chef bonus counted only here */
  kitchenSure?(wid: number): number;
  /** cooking finished: the plate goes on the station tray */
  kitchenReady?(wid: number): boolean;
  /** reserve a tray plate to carry to the pass (komi, or the cook) */
  kitchenTasi?(wid: number, opt?: { kendi?: boolean; yas?: number }): { ist: string; p: FoodId } | null;
  kitchenTasiAl?(wid: number): CarryItem<FoodId> | null;
  /** put the carried plate on the pass (false: pass full, wait) */
  kitchenPass?(wid: number): boolean;
  /** 2026-11-21: elindeki tabağın gideceği pass penceresi ('on' sokak, 'W'/'E' salon) */
  kitchenPassYer?(wid: number): 'on' | 'W' | 'E' | null;
  kitchenDrop?(wid: number): void;
  /** BUF-13 dish pile: dirty plates waiting at the dishwashing station; wash one (false: pile empty); table-wipe time factor (1..2) */
  dishCount?(): number;
  /** BUF-12: kasada işlem bekleyen / işlenen müşteri var (kasiyer para sayar) */
  kasaMesgul?(): boolean;
  dishWash?(): boolean;
  dishCeza?(): number;
  /** BUF-13: kitchen workers busy cooking / washing now (kitchen floor dirt), a cleaner mopping the kitchen now (wet-floor sign) */
  setMutfakBusy?(n: number): void;
  setMutfakMop?(on: boolean): void;
  /** BUF-06: the station the player handed over to this cook (null: none) */
  kitchenDevir?(wid: number): string | null;
  /** a tray plate nobody took for `yas` s (an idle cook takes it) */
  kitchenBekleyen?(yas: number): boolean;
  /** BUF-15 paket servis (sim/kurye.ts): hazır paket var mı, tabakları pass'tan al, adres, teslim (dönüşte gelir), bırak (işten çıkış) */
  paketHazir?(): boolean;
  paketAl?(wid: number): CarryItem<FoodId>[] | null;
  paketAdres?(wid: number): { ad: string; x: number; z: number } | null;
  paketTeslim?(wid: number): number;
  paketBirak?(wid: number): void;
  // ---- specials
  playerHas(p: ProductId): boolean;
  playerTake(p: ProductId): CarryItem | null;
  settle(items: CarryItem<FoodId>[], at: Vec2): number;
  earn(value: number, at: Vec2): void;
  kasaCount(): number;
  kasaValue(): number;
  grabHalf(): number;
  dropFloor(value: number, x: number, z: number): void;
  addOwedBack(v: number): void;
  addToKasa(v: number): void;
  /** EKO-02: already-booked money (a kasa stack) into the pocket; not income */
  cashIn?(v: number): void;
  /** Free gag; true when something was there to snatch. */
  counterTake(p: ProductId): boolean;
  venueMult(): number;
  // ---- feedback
  toast(text: string, kind: 'info' | 'good' | 'bad'): void;
  stat(key: string, n?: number): void;
  statMax(key: string, v: number): void;
  heroSay(text: string, t?: number): void;
  heroAct(act: string, t: number): void;
  /** Esnaf XP (sinema bölümü izleme gibi küçük keyif ödülleri) */
  addXP?(n: number): void;
  tipBoost(seconds: number): void;
  addFollowers(n: number): void;
  laughNearby(): void;
  hero(): 'sabri' | 'sabriye';
  windowOpen(): boolean;
}

export type { Vec2, Vec3 };
