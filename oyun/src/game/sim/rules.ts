/**
 * createRules: wires every M1 rule module into one `Rules` object (the sim's second half), registers the 'rules' system
 * (order 20), dispatches commands and answers `v2State()`. Owner: Builder A. Pure: no three, no DOM, no wall clock.
 * Tick order (30 Hz): walk (10, engine dwell registry fires here) -> rules (20): player flags, spawner, customers, ferry/window,
 * tadilat, day end, slow monitor, pads, tutorial, 1 s / 5 s housekeeping, agents-SoA sync -> C's systems (39..46).
 */
import { VENUE } from '../../content/ekonomi2';
import { installGider } from './gider';
import { installRestoran } from './restoran';
import { installYatirim } from './yatirim';
import { installKiyafet } from './kiyafet';
import { installEsnafim } from './esnafim';
import { installTabela } from './tabela';
import { installMantar } from './mantar';
import { installMulk } from './mulk';
import { installLig } from './lig';
import { installGizem } from './gizem';
import { installYetenek } from './yetenek';
import { installZemin } from './zemin';
import { installHaliSaha } from './halisaha';
import { installZincir } from './zincir';
import type { AmbientSystem, Bus, Entity, GameClock, InteractionRegistry, Nav, Rng, SimCtx, SoAStore, System, Vec2 } from '../../engine/api';
import type { SimEvents } from '../events';
import type { Content } from '../../content/types';
import { P } from '../../content/economy';
import { PRODUCT_IDS } from '../../content/products';
import { CITIZENS } from '../../content/citizens';
import { STAGE_TABLES } from '../../content/pads';
import { stageLayout } from '../../content/prefabs/iskele/layout';
import { defaultState, type GameState, type ProductId } from './schema';
import { emptyRuntime, type Kernel, type Rules, type Item, type Order } from './state';
import type { SimCmd } from './commands';
import { installLevels } from './levels';
import { installAchievements } from './achievements';
import { installStations, standAt } from './stations';
import { installCounter } from './counter';
import { installMoney } from './money';
import { installEconomy } from './economy';
import { installCustomers } from './customers';
import { installWindow } from './window';
import { installFerry } from './ferry';
import { installPads } from './pads';
import { installTadilat } from './tadilat';
import { installDecor } from './decor';
import { installOrders } from './orders';
import { installKarne } from './karne';
import { installQueue } from './queue';
import { installBoard } from './board';
import { installOffline } from './offline';
import { installPlayer } from './player';
import { installTutorial } from './clock';
import { installEsnaf } from './esnaf';
import { installMusteri } from './musteri';
import { installHedef } from './goals';
import { installDekorEv } from './dekor-ev';
import { installMini } from './mini';
import { installYiyecek } from './yiyecek';
import { installHava } from './hava';
import { installKoleksiyon } from './koleksiyon';
import { installDisari } from './disari';
import { installDeniz } from './deniz';
import { installHikaye } from './hikaye';
import { installCalisan } from './calisan';
import { applySetting } from './settings';
import { normalizeState } from './save';
import { hourOf, clamp } from './util';

export interface RulesDeps {
  state: GameState; ctx: SimCtx; bus: Bus<SimEvents>; content: Content; rng: (name: string) => Rng; nav: Nav; agents: SoAStore;
  interactions: InteractionRegistry; player: Entity; clock: GameClock; ambient: AmbientSystem | null;
  walk: { readonly pos: Vec2; readonly speed: number; teleport(x: number, z: number): void };
  addSystem(s: System): void;
}
export interface RulesFull extends Rules {
  /** true when the command was handled here. */
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  /** Called by the headless tick instead of the scheduler while `rt.paused` (ceremony fallback timers). */
  pausedStep(dt: number): void;
  /** Re-sync runtime from state (after load / reset). */
  restore(): void;
  /** Small plain object folded into sim.hash(). */
  hashParts(): unknown;
}

const vxz = (v: Vec2 | null | undefined) => (v ? { x: +v.x.toFixed(2), z: +v.z.toFixed(2) } : null);

export function createRules(d: RulesDeps): RulesFull {
  const S = d.state;
  const layout0 = stageLayout(S.stage || 1);
  const rt = emptyRuntime(layout0);
  const streams: Record<string, Rng> = {};
  const rng = (n: string) => streams[n] || (streams[n] = d.rng(n));
  const R = { main: rng('sim.main'), money: rng('sim.money'), orders: rng('sim.orders'), board: rng('sim.board'), fx: rng('sim.fx') };
  const views: (() => Record<string, unknown>)[] = [];
  const toastSeen: Record<string, number> = {};
  const TOAST_SAME_S = 60, TOAST_GAP_S = 2.5; let lastToast = -1e9;
  let dirtyFlag = false;
  const K = {
    get state() { return d.state; }, rt, ctx: d.ctx, bus: d.bus, content: d.content, rng, nav: d.nav, agents: d.agents, interactions: d.interactions,
    player: d.player, get playerPos() { return d.walk.pos; }, clock: d.clock, ambient: d.ambient, R,
  } as unknown as Kernel & { ext: Rules['ext'] };
  K.command = c => { rulesObj.handle(c); };
  K.logEv = (ev, extra) => { d.bus.emit(ev as never, (extra || {}) as never); };
  K.toast = (text, kind = 'info') => {
    const t = d.ctx.t;
    if (toastSeen[text] !== undefined && t - toastSeen[text] < 2.5) return;
    // calm (2 h play: 1.569 toasts): the same sentence (numbers ignored) repeats at most every TOAST_SAME_S, and anything
    // that is not a warning waits TOAST_GAP_S after the previous toast. First-time hints always pass (never seen before).
    const norm = text.replace(/[0-9.,]+/g, '#');
    const same = /^(Vapur|Pencere)/.test(norm) ? TOAST_SAME_S * 3 : TOAST_SAME_S;
    if (kind !== 'bad') {
      if (toastSeen[norm] !== undefined && t - toastSeen[norm] < same) return;
      if (t - lastToast < TOAST_GAP_S) return;
    }
    toastSeen[text] = t; toastSeen[norm] = t; lastToast = t;
    d.bus.emit('toast', { text, kind });
  };
  K.spend = v => { S.money = Math.max(0, S.money - Math.max(0, v)); };
  K.openProducts = () => PRODUCT_IDS.filter(p => rt.stations[p].built);
  K.tablesBuilt = () => rt.tables.filter(t => t.built).length;
  K.hiredCount = () => S.workers.length;
  K.hour = () => hourOf(S.dayT);
  // Faz 2: additive and capped (ekonomi2.ts VENUE); the old product of multipliers was the inflation engine
  K.venueMult = () => Math.min(VENUE.cap, 1 + ((P.TAD_TOTAL[clamp(S.stage, 1, 6) - 1] || 1) - 1) + (P.PLAQUE_X - 1) * (S.plaque || 0) + P.STAR_PCT * (S.stars || 0) + K.siklikBonus());
  K.dirty = () => { dirtyFlag = true; };
  K.saveNow = () => { dirtyFlag = true; };
  K.setTrackedOwner = () => { /* reserved */ };
  K.addStateView = fn => { views.push(fn); };
  K.addSystem = s => d.addSystem(s);
  K.openOverlay = (id, model) => { rt.uiLast[id] = model; };

  K.addXP = installLevels(K);
  const ach = installAchievements(K);
  K.stat = ach.stat; K.statMax = ach.statMax;
  const st = installStations(K);
  K.stations = st.api;
  const reserved = (): Partial<Record<ProductId, number>> => {
    const r: Partial<Record<ProductId, number>> = {};
    for (const fn of rt.reserved) { let o: Order = {}; try { o = fn(); } catch { o = {}; } for (const p in o) r[p as ProductId] = (r[p as ProductId] || 0) + (o[p as ProductId] || 0); }
    if (rt.window && rt.window.open) rt.winq.slice(0, 3).forEach(c => { const l = K.orderLeft(c); for (const p in l) r[p as ProductId] = (r[p as ProductId] || 0) + (l[p as ProductId] || 0); });
    return r;
  };
  const cn = installCounter(K, reserved, st.carryCap);
  K.counterApi = cn.counterApi; K.carry = cn.carryApi;
  const mo = installMoney(K);
  K.moneyApi = mo.api;
  const ec = installEconomy(K, mo.addMoneyTo);
  K.salesApi = ec.sales; K.earn = ec.earn; K.incomePerMin = ec.incomePerMin;
  const cu = installCustomers(K, ec.tipMult, mo.addMoneyTo, (c, items) => ec.settleSale(c, items));
  K.orderLeft = cu.orderLeft;
  const win = installWindow(K, cu, (c, items, o) => ec.settleSale(c, items, o));
  const fe = installFerry(K, cu, win);
  K.registerStations = () => { st.register(); };
  K.syncTablesReg = () => { mo.syncTables(); };
  const tad = installTadilat(K);
  const dec = installDecor(K);
  const ord = installOrders(K);
  K.ext = {
    upgradeCost: K.upgradeCost, orderProgress: ord.progress as never, orderReward: ord.reward, isbulHint: () => K.isbulHint(), tadilatReady: () => K.tadilatReady(),
    boardModel: () => board.model() as unknown as Record<string, unknown>, siklikBonus: () => K.siklikBonus(), takeDirty: () => { const f = dirtyFlag; dirtyFlag = false; return f; },
  };
  const kar = installKarne(K);
  const board = installBoard(K);
  const padsM = installPads(K);
  const slow = installQueue(K, cu.orderLeft);
  const off = installOffline(K);
  const player = installPlayer(K, board, () => d.walk.speed);
  const tut = installTutorial(K);
  const esnafM = installEsnaf(K);
  installMusteri(K, cu); // müşteri istekleri, turistler, kalpler
  const hedefM = installHedef(K);
  installGider(K); // Faz 2: gün sonu kira + fatura (gider.ts)
  const zincirM = installZincir(K); // Faz 2: dükkan zinciri
  const yatirimM = installYatirim(K);
  const kiyafetM = installKiyafet(K);
  const esnafimM = installEsnafim(K);
  const tabelaM = installTabela(K);
  installMantar(K);
  const mulkM = installMulk(K);
  const yetenekM = installYetenek(K);
  const zeminM = installZemin(K);
  const ligM = installLig(K);
  const gizemM = installGizem(K);
  const haliSahaM = installHaliSaha(K, ligM as never); // maç günü + halı saha (user 2026-10-24)
  const restoranM = installRestoran(K, cu, (c, items) => ec.settleSale(c, items), mo.addMoneyTo); // Faz 2: stantlar + adisyon
  const dekorEv = installDekorEv(K); (rt as unknown as { dekorEv?: unknown }).dekorEv = dekorEv; // Dekor 2.0 + Sabri'nin Evi
  const miniM = installMini(K); // mini oyunlar + içecek ustalık hareketleri
  const yiyecekM = installYiyecek(K); // tarifler, Gezgin Aşçı, Deney Tezgahı, tazelik, Anlaşma Masası (yiyecek.ts)
  const havaM = installHava(K); // hava, mevsimler, etkinlikler, Gece Pazarı (hava.ts)
  // Faz 2: paket servis (PaketMartı) kaldırıldı; kurye.ts kayıt uyumu için duruyor, kurulmuyor.
  const kolM = installKoleksiyon(K); // koleksiyonlar, Altın Simit, Altın Fırın
  const disariM = installDisari(K, (x, z) => d.walk.teleport(x, z)); // Martıköy haritası, mahalleler, dolmuş, buluntular (disari.ts)
  const denizM = installDeniz(K, cu as never); // deniz canlıları, tekneler, güverte koşusu, iskele büyümesi (deniz.ts)
  const hikayeM = installHikaye(K); // hikaye bölümleri, rakipler, karakterli öğreticiler (hikaye.ts)
  const calisanM = installCalisan(K); // Kurs Merkezi, Dinlenme Bankı, ekip etkinlikleri, Ayın Elemanı (calisan.ts)

  K.onLayout = () => {
    rt.layout = stageLayout(S.stage);
    while (rt.tables.length < rt.layout.tables.length) rt.tables.push({ built: false, seats: [{ occ: 0 }, { occ: 0 }], pile: [], dirty: 0, dirtyT: 0 });
    for (const k of PRODUCT_IDS) { const it = d.interactions.get('station.' + k); if (it) it.pos = standAt(rt.layout, k); }
    const w = d.interactions.get('window'); if (w) w.pos = rt.layout.window.standAt;
    mo.register(); mo.syncTables(); restoranM.register();
    rt.queue.forEach(q => { q.qi = -1; }); rt.winq.forEach(q => { q.qi = -1; });
    K.syncPads();
  };

  // ───────── restore ─────────
  function restore(): void {
    normalizeState(S);
    rt.layout = stageLayout(S.stage);
    rt.tables = rt.layout.tables.map(() => ({ built: false, seats: [{ occ: 0 }, { occ: 0 }], pile: [], dirty: 0, dirtyT: 0 }));
    for (const k of PRODUCT_IDS) rt.stations[k] = { built: k === 'doner', out: [], grabT: 0, opT: -99, prog: {} };
    for (const k of PRODUCT_IDS) rt.counter[k] = [];
    rt.carry = []; rt.kasa = []; rt.floor = []; rt.pads.splice(0).forEach(p => d.interactions.unregister('pad.' + p.key));
    rt.queue = []; rt.winq = []; rt.window = null; rt.streak = 0; rt.slow = null; rt.slowCard = null;
    if (rt.customers.length) cu.clearAll();
    rt.customers = [];
    for (const key of Object.keys(S.owned)) if (S.owned[key]) K.unlock(key, true);
    for (let s = 2; s <= S.stage; s++) (STAGE_TABLES[s] || []).forEach(i => K.setTableBuilt(i, true));
    K.registerStations();
    cn.register(); mo.register(); win.register(); mo.syncTables(); restoranM.register();
    K.refreshSiklik();
    if (S.pile > 0) { mo.addMoneyTo(rt.kasa, S.pile); S.pile = 0; }
    if (S.playT > 0) S.tut.firstCustomer = 1;
    S.workers.forEach(w => { if (w.morale == null) w.morale = P.MORALE_START; });
    K.syncOrders(); K.syncPads();
    rt.started = !!S.hero && S.playT > 0 ? rt.started : rt.started;
  }

  // ───────── per tick ─────────
  let t1 = 0, t5 = 0, tT = 0, followT = 0;
  let introGull = false, lastDay = S.day, tanidikAt: number | null = null;
  const system: System = {
    id: 'rules', order: 20, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt;
      if (!introGull && S.playT > 1.5) { introGull = true; K.logEv('introGull', {}); }
      player.update(dt);
      cu.updateSpawner(dt);
      cu.update(dt);
      fe.update(dt);
      if (rt.followers > 0) {
        followT -= dt;
        if (followT <= 0) {
          followT = 1.2; rt.followers--;
          if (rt.queue.length < rt.layout.queue.length) cu.spawnCustomer({ type: CITIZENS.find(t => t.id === (R.main.chance(0.5) ? 'vlogcu' : 'universiteli')), n: 1, follower: true, say: 'Tayfun\'u gördük, geldik!' });
        }
      }
      if (S.day !== lastDay) { lastDay = S.day; tanidikAt = S.workers.some(w => w.trait === 'cevresi') ? R.main.range(30, 170) : null; }
      if (tanidikAt != null && S.dayT >= tanidikAt) {
        tanidikAt = null; const w = S.workers.find(x => x.trait === 'cevresi');
        if (w && rt.queue.length < rt.layout.queue.length - 1) { cu.spawnCustomer({ type: CITIZENS.find(t => t.id === 'teyze'), n: R.main.int(3, 5), say: w.name + '\'in tanıdıkları geldi!' }); K.stat('tanidik'); }
      }
      tad.update(dt);
      restoranM.update(dt);
      kar.update(dt);
      zeminM.update(dt);
      yetenekM.update();
      haliSahaM.update();
      slow.update(dt);
      padsM.update(dt);
      if ((tT -= dt) <= 0) { tT = 0.2; tut.update(); }
      if ((t1 -= dt) <= 0) { t1 = 1; ord.notify(); }
      if ((t5 -= dt) <= 0) { t5 = 5; rt.rate = ec.incomePerMin(); }
      cu.syncAgents();
    },
  };
  d.addSystem(system);

  // ───────── commands ─────────
  function freshStart(): void {
    const st0 = rt.layout.playerStart, dn = standAt(rt.layout, 'doner');
    for (const [dx, dz] of [[-2.2, 0], [2.2, 0], [-1.8, 0.6], [1.8, 0.6], [0, 1.8], [-2.8, 0]]) {
      const p = { x: st0.x + dx, z: st0.z + dz };
      if (!d.nav.walkable(p) || Math.hypot(p.x - dn.x, p.z - dn.z) < 1.6 || Math.hypot(p.x - rt.layout.counter.standAt.x, p.z - rt.layout.counter.standAt.z) < 1.0) continue;
      d.walk.teleport(p.x, p.z); return;
    }
    d.walk.teleport(st0.x, st0.z);
  }
  function resetAll(): void {
    cu.clearAll();
    const seed = S.seed;
    const fresh = defaultState(seed);
    for (const k of Object.keys(S)) delete (S as unknown as Record<string, unknown>)[k];
    Object.assign(S, JSON.parse(JSON.stringify(fresh)));
    rt.started = false; rt.paused = false; rt.pauseWhy = ''; rt.uiLast = {}; rt.panel = null; rt.boardOpen = false; rt.movedTotal = 0; rt.tutStep = null; rt.dayHistory = [];
    rt.incomeWin = []; introGull = false;
    restore();
  }
  const closeAllModals = () => { rt.panel = null; rt.boardOpen = false; };
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind === 'esnaf') return esnafM.handle(c);
    if (c.kind === 'hedef') return hedefM.handle(c);
    if (c.kind === 'restoran') return restoranM.handle(c);
    if (c.kind === 'pencere' && c.op === 'hire') { // new hire for the ferry window: open the board, the next hire is posted there
      if (!S.owned.pencere) { K.toast('Önce vapur penceresini aç.', 'info'); return true; }
      if (!S.owned.isbul) { K.toast(K.isbulHint(), 'info'); return true; }
      S.zones.pencere = { wid: Number((S.zones.pencere as { wid?: number } | undefined)?.wid) || 0, want: 1 } as never; board.open();
      K.toast('Pencere için bir eleman seç, seçtiğin pencerede çalışır.', 'info'); return true;
    }
    if (c.kind === 'pencere') { // Faz 2: post a worker at the ferry window (same id again = take them back)
      const wid = Number(c.wid) || 0, cur = Number((S.zones.pencere as { wid?: number } | undefined)?.wid) || 0;
      S.zones.pencere = { wid: wid === cur ? 0 : wid }; const w = S.workers.find(x => x.id === wid);
      K.toast(wid === cur || !w ? 'Pencereye kimse bakmayacak, vapur gelince sen koş.' : w.name + ' vapur gelince pencereye geçecek.', 'info'); K.saveNow(); return true;
    }
    if (c.kind === 'zincir') return zincirM.handle(c);
    if (c.kind === 'mini') return miniM.handle(c);
    if (c.kind === 'yiyecek') return yiyecekM.handle(c);
    if (c.kind === 'hava') return havaM.handle(c);
    if (c.kind === 'koleksiyon') return kolM.handle(c);
    if (c.kind === 'disari') return disariM.handle(c);
    if (c.kind === 'deniz') return denizM.handle(c);
    if (c.kind === 'hikaye') return hikayeM.handle(c);
    if (c.kind === 'calisan') return calisanM.handle(c);
    if (c.kind === 'dekor2') { dekorEv.handle(String(c.arg || '')); return true; }
    switch (c.kind as SimCmd['kind']) {
      case 'play': {
        const hero = c.hero === 'sabriye' ? 'sabriye' : 'sabri';
        const fresh = !S.hero;
        if (fresh) { S.playT = 0; S.dayT = 0; }
        S.hero = (S.hero || hero) as GameState['hero'];
        if (fresh && !S.tut.firstCut) freshStart();
        rt.started = true;
        K.logEv('heroPick', { hero: S.hero });
        K.logEv('start', {});
        return true;
      }
      case 'setHero': if (c.hero === 'sabri' || c.hero === 'sabriye') { S.hero = c.hero; K.saveNow(); } return true;
      case 'resetSave': resetAll(); return true;
      case 'setStage': {
        S.stage = clamp(Math.round(Number(c.stage)) || 1, 1, 5);
        for (let s = 2; s <= S.stage; s++) (STAGE_TABLES[s] || []).forEach(i => K.setTableBuilt(i, true));
        K.onLayout(); K.refreshSiklik();
        d.bus.emit('stage', { stage: S.stage });
        return true;
      }
      case 'openPanel': rt.boardOpen = false; rt.panel = String(c.id); K.logEv('panel', { id: c.id }); return true;
      case 'closePanel': rt.panel = null; return true;
      case 'openJobBoard': if (S.owned.isbul) board.open(); else K.toast(K.isbulHint(), 'info'); return true;
      case 'closeJobBoard': board.close(); return true;
      case 'upgradeTier': tad.upgrade(String(c.id)); return true;
      case 'invest': yatirimM.buy(String(c.id)); return true;
      case 'kiyafet': kiyafetM.run(c.op as 'buy' | 'wear' | 'take', String(c.id)); return true;
      case 'yetenek': yetenekM.run({ op: String(c.op) }); return true;
      case 'tabela': tabelaM.run({ op: String(c.op), value: c.value }); return true;
      case 'mulk': return mulkM.handle(c as never);
      case 'gizem': return gizemM.handle(c as never);
      case 'esnafim': esnafimM.run({ op: String(c.op), data: c.data as Record<string, unknown> | undefined }); return true;
      case 'halisaha': haliSahaM.run({ op: String(c.op), biz: (c as { biz?: unknown }).biz, onlar: (c as { onlar?: unknown }).onlar, ist: (c as { ist?: unknown }).ist }); return true;
      case 'zemin': zeminM.run({ op: String(c.op), value: c.value }); return true;
      case 'startTadilat': K.startTadilat(false); return true;
      case 'startTadilatSelf': K.startTadilat(false, true); return true;
      case 'skipTadilat': tad.skip(); return true;
      case 'claimOrder': ord.claim(String(c.id)); return true;
      case 'ordersRefresh': K.syncOrders(true); return true;
      case 'hireCandidate': board.hire(String(c.id), !!c.free); return true;
      case 'refreshBoard': board.refresh(); return true;
      case 'fire': board.fire(Number(c.id)); return true;
      case 'train': board.train(Number(c.id)); return true;
      case 'decorBuy': dec.buy(String(c.id)); return true;
      case 'decorPlace': dec.place(String(c.id)); return true;
      case 'decorRemove': dec.remove(Number(c.slot)); return true;
      case 'decorRotate': dec.rotate(Number(c.slot)); return true;
      case 'saveSign': dec.saveSign(String(c.text ?? ''), c.font as string | undefined); return true;
      case 'tapSlow': slow.tap(); return true;
      case 'acceptSolution': K.acceptSolution(); return true;
      case 'collectWelcome': off.collect(!!c.doubled); return true;
      case 'yeniGun': if (rt.uiLast.gunSonu) { delete rt.uiLast.gunSonu; if (rt.pauseWhy === 'gunSonu') { rt.paused = false; rt.pauseWhy = ''; } } return true;
      case 'skipCeremony': kar.finishKasa(); delete rt.uiLast.dayCard; if (off.isPending()) off.collect(false); return true;
      case 'setSetting': applySetting(S.settings, c.key as never, c.value); K.dirty(); return true;
      case 'force': {
        const what = String(c.what), v = c.value;
        if (what === 'ferry') fe.force(v);
        else if (what === 'endDay') S.dayT = P.GAME_DAY_S - 0.05;
        else if (what === 'day') S.day = Math.max(S.day, Number(v) || 1);
        else if (what === 'money') S.money += Number(v) || 0;
        else if (what === 'gold') S.gold += Number(v) || 0;
        else if (what === 'stars') S.stars = Math.max(S.stars, Number(v) || 0);
        else if (what === 'offline') off.welcome(Number(v) || 0);
        else if (what === 'unlock') { const key = String(v); if (!S.owned[key]) K.unlock(key); }
        else if (what === 'stage') { const to = clamp(Number(v) || 1, 1, 5); for (let st = S.stage + 1; st <= to; st++) (STAGE_TABLES[st] || []).forEach(i => K.setTableBuilt(i, true)); S.stage = to; K.bus.emit('stage', { stage: to }); K.onLayout(); }
        else (rt as unknown as { forceAgent?: (w: string, v?: unknown) => void }).forceAgent?.(what, v);
        return true;
      }
      default: return false;
    }
  }

  function v2State(): Record<string, unknown> {
    const lay = rt.layout;
    const need = (c: { order: Order; got: Order }) => cu.orderLeft(c);
    const clockText = () => { const h = K.hour(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60); return String(hh % 24).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
    const anchors = {
      counter: vxz(lay.counter.standAt), kasa: vxz(lay.kasa.pile), job: vxz(lay.job.pos), 'window': vxz(lay.window.standAt), start: vxz(lay.playerStart),
      stations: Object.fromEntries(PRODUCT_IDS.map(k => [k, vxz(standAt(lay, k))])),
      tables: lay.tables.map(t => vxz(t)), queue0: vxz(lay.queue[0]),
    };
    const pileV = (p: { value: number }[]) => p.reduce((a, b) => a + b.value, 0);
    const base: Record<string, unknown> = {
      t: +S.playT.toFixed(1), day: S.day, dayT: +S.dayT.toFixed(1), clock: clockText(), money: Math.floor(S.money), gold: S.gold, level: S.level, xp: S.xp, stars: S.stars, stage: S.stage, tadilat: S.tadilat,
      paused: rt.paused, pauseWhy: rt.pauseWhy, started: rt.started,
      pos: vxz(d.walk.pos), carry: rt.carry.map(it => it.type), cap: st.carryCap(),
      counter: Object.fromEntries(PRODUCT_IDS.map(p => [p, rt.counter[p].length])),
      out: Object.fromEntries(PRODUCT_IDS.map(p => [p, rt.stations[p].out.length])),
      built: K.openProducts(), tiers: { ...S.tiers },
      kasaPile: rt.kasa.length, kasaValue: Math.round(pileV(rt.kasa)), floor: rt.floor.map(f => vxz(f)),
      tablePiles: rt.tables.map((t, i) => (t.built ? { i, n: t.pile.length, dirty: t.dirty, pos: vxz(lay.tables[i]) } : null)).filter(Boolean),
      queue: rt.queue.map(c => ({ id: c.id, type: c.typeId, need: need(c), state: c.state, pat: +(c.patience / c.patMax).toFixed(2) })),
      winq: rt.winq.map(c => ({ id: c.id, need: need(c), state: c.state })),
      'window': rt.window ? { open: rt.window.open, t: +rt.window.t.toFixed(1), sales: rt.window.sales } : null,
      pads: rt.pads.map(p => ({ key: p.key, price: p.price, paid: Math.round(S.padPaid[p.key] || 0), pos: vxz(p.pos) })),
      owned: Object.keys(S.owned).filter(k => S.owned[k]),
      workers: [], reg: null, vip: null, kap: null, cat: null, cats: [], gull: null, sleeper: null,
      slow: rt.slow ? { link: rt.slow.link, at: vxz(rt.slow.at) } : null,
      tut: rt.tutStep, boardOpen: !!rt.boardOpen, panel: rt.panel,
      customers: rt.customers.length, grades: { ...S.grades }, siklik: rt.siklik, ach: Object.keys(S.ach).length, orders: S.orders, rate: Math.round(rt.rate || 0),
      streak: rt.streak, anchors,
    };
    for (const v of views) { try { Object.assign(base, v()); } catch { /* a view must never break the state read */ } }
    return base;
  }

  const rulesObj: RulesFull = Object.assign(K, {
    handle, restore,
    pausedStep(dt: number) { kar.kasaTick(dt); },
    hashParts: () => ({
      c: PRODUCT_IDS.map(p => rt.counter[p].length), o: PRODUCT_IDS.map(p => rt.stations[p].out.length), k: rt.kasa.length, q: rt.queue.length,
      cu: rt.customers.map(c => [c.id, c.state, +c.x.toFixed(2), +c.z.toFixed(2), +c.patience.toFixed(2)]), carry: rt.carry.length, started: rt.started, f: rt.ferry.state,
    }),
    v2State,
    snapshot(wall: number) {
      S.lastSeen = wall;
      S.pile = Math.round(rt.kasa.reduce((a, b) => a + b.value, 0) + rt.floor.reduce((a, b) => a + b.value, 0) + rt.tables.reduce((a, t) => a + t.pile.reduce((x, y) => x + y.value, 0), 0));
      S.rate = Math.round(ec.incomePerMin());
    },
    welcomeBack(away: number) { off.welcome(away); },
  }) as unknown as RulesFull;
  restore();
  void ({} as Item);
  return rulesObj;
}
