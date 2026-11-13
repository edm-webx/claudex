/**
 * Kuryeler ve teslimat, sim side (survey kurye-1..9, ekonomi-3, calisan-2). Pure: no three, no DOM, seeded rng only.
 * Decisions:
 * - Persistent state lives in GameState.zones.kurye (created with defaults, so old saves load). Runtime (tablet orders,
 *   runs on the road, feed) is not saved: a reload simply starts with an empty tablet and couriers back home.
 * - PaketMartı opens at KURYE_OPEN_LEVEL with one free courier; 2nd and 3rd are hired from the Kurye panel.
 * - Orders pop on the counter tablet (max TABLET_MAX) and expire gently (no penalty). 'Kabul' queues it; a free
 *   courier picks the items from the counter (or the station tray / grab stations). After WAIT_MAX seconds Sabri's
 *   spare stock covers the rest, so nothing ever gets stuck. Then out (trip time from district, vehicle, terrain,
 *   weather, quirk, speed upgrade), deliver (money straight into the pocket, stars + comment), back home.
 * - 'Sen götür!': some orders carry the card; the player plays a 20 s route game in the overlay (sim paused with
 *   pauseWhy 'kurye'); the score sets pay bonus and stars. Quitting or timing out still delivers (a courier runs it).
 * - Weather is a daily pick by real-calendar season (sim has no weather system yet): speed, order rate, tips, cold drinks.
 * - Offline (ekonomi-3): the courier line keeps earning at OFFLINE_RATE of its measured per-minute rate, capped by the
 *   same kepenk hours as the kiosk. offline.ts asks rt.kurye.offline(awaySec).
 * - Ratings never cost money (no losing): bad stars only mean a smaller tip and a funny comment.
 * - Commands: { kind: 'kurye', op, id?, arg? } ops: open, accept, decline, self, selfResult, selfQuit, hire, veh,
 *   buyVeh, upg, sus, seen.
 */
import type { Kernel } from './state';
import type { ProductId } from './schema';
import { price } from '../../content/products';
import { KEPENK } from '../../content/economy';
import {
  SEMTLER, SEMT_BY_ID, ARACLAR, ARAC_BY_ID, HUYLAR, HUY_IDS, KURYE_ADLARI, KURYE_OPEN_LEVEL, KURYE_HIRE, KURYE_MAX,
  YUKSELTMELER, BAG_BASE, SPEED_PER_LVL, SUSLER, SUS_KIND_NAME, HAVALAR, HAVA_WEIGHTS, ORDER_EVERY, ORDER_TTL, TABLET_MAX,
  WAIT_MAX, OFFLINE_RATE, SEN_GOTUR_CHANCE, SEN_GOTUR_LEVEL, MUSTERI_ADLARI, ADRES_NOTU, YORUMLAR, YOKUS_ANLARI,
  KEDI_GETIRDI, SEN_GOTUR, PAKETMARTI_LINES, TERRAIN_NAME, type HavaId, type HuyId, type Terrain,
} from '../../content/kurye';
import { fmtMoney } from './util';

interface CourierSave { id: number; name: string; huy: HuyId; arac: string; trips: number; stars: number }
interface Rating { s: number; text: string; who: string; semt: string; kurye: string }
interface KuryeSave {
  on: boolean; couriers: CourierSave[]; nextId: number;
  upg: Record<string, number>; owned: string[]; sus: Record<string, string>;
  ratings: Rating[]; starSum: number; starN: number; earned: number; trips: number; workSec: number; cats: number;
  day: number; hava: HavaId; offNote: string; selfWins: number;
}
export interface KOrder { id: number; semt: string; items: Partial<Record<ProductId, number>>; value: number; until: number; sen: boolean; who: string; note: string; accepted: boolean }
export interface KRun { order: KOrder; courier: number; phase: 'wait' | 'out' | 'back'; t: number; dur: number; need: Partial<Record<ProductId, number>>; value: number; waitT: number }
export interface KFeed { n: number; kind: 'rate' | 'moment' | 'cat' | 'self' | 'info'; text: string; stars?: number; money?: number; who?: string }
export interface KuryeView {
  on: boolean; hava: { id: HavaId; name: string; note: string; gear: string };
  tablet: { id: number; semt: string; semtName: string; terrain: string; items: string; value: number; left: number; sen: boolean; who: string; note: string }[];
  queued: number;
  couriers: { id: number; name: string; arac: string; aracName: string; color: string; huy: string; state: 'idle' | 'wait' | 'out' | 'back'; semt: string; k: number; mx: number; my: number; waitFor: string }[];
  feed: KFeed[]; feedN: number; self: { order: KOrder; n: number } | null; selfLast: { score: number; stars: number; money: number; text: string; n: number } | null;
  boya: string; bayrak: string;
}
export interface KuryeApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  panelModel(): Record<string, any>;
  summary(): Record<string, any> | null;
  view(): KuryeView;
  /** offline courier earnings for awaySec seconds (ekonomi-3) */
  offline(awaySec: number): number;
}

const PNAME: Record<string, string> = { doner: 'döner', cay: 'çay', ayran: 'ayran', simit: 'simit', tost: 'tost', gazoz: 'gazoz' };
const BUFE_XY = { x: 0.5, y: 0.88 };
/** shared weather kinds (content/hava.ts) mapped to the courier weather */
const HAVA_FROM_SHARED: Record<string, HavaId> = { acik: 'gunes', gokkusagi: 'gunes', sis: 'gunes', lodos: 'yagmur', saganak: 'yagmur', firtina: 'yagmur', kar: 'kar', sicak: 'sicak' };
const itemsText = (o: Partial<Record<ProductId, number>>) => Object.entries(o).filter(([, n]) => (n || 0) > 0).map(([p, n]) => n + ' ' + (PNAME[p] || p)).join(', ');
const sumItems = (o: Partial<Record<ProductId, number>>) => Object.values(o).reduce((a: number, b) => a + (b || 0), 0);

export function installKurye(K: Kernel): KuryeApi {
  const rng = K.rng('kurye');
  const rt = K.rt;
  let tablet: KOrder[] = [];
  let queue: KOrder[] = [];
  let runs: KRun[] = [];
  let feed: KFeed[] = [];
  let feedN = 0, orderN = 0, selfN = 0;
  let nextOrderT = 20;
  let self: { order: KOrder; n: number } | null = null;
  let selfLast: { score: number; stars: number; money: number; text: string; n: number } | null = null;
  let seenLvl = K.state.level || 0;
  let now = 0, havaPoll = 0;

  function save(): KuryeSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let m = S.zones.kurye as unknown as KuryeSave | undefined;
    if (!m || typeof m !== 'object') {
      m = { on: false, couriers: [], nextId: 1, upg: {}, owned: ['bisiklet', 'boya-sari', 'korna-dit', 'bayrak-yok'], sus: { boya: 'boya-sari', korna: 'korna-dit', bayrak: 'bayrak-yok' }, ratings: [], starSum: 0, starN: 0, earned: 0, trips: 0, workSec: 0, cats: 0, day: 0, hava: 'gunes', offNote: '', selfWins: 0 };
      S.zones.kurye = m as unknown as Record<string, unknown>;
    }
    if (!Array.isArray(m.couriers)) m.couriers = [];
    if (!Array.isArray(m.owned)) m.owned = ['bisiklet'];
    if (!Array.isArray(m.ratings)) m.ratings = [];
    m.upg ||= {}; m.sus ||= { boya: 'boya-sari', korna: 'korna-dit', bayrak: 'bayrak-yok' };
    for (const k of ['nextId', 'starSum', 'starN', 'earned', 'trips', 'workSec', 'cats', 'day', 'selfWins'] as const) if (typeof m[k] !== 'number' || !isFinite(m[k])) m[k] = 0;
    if (!HAVALAR[m.hava]) m.hava = 'gunes';
    if (typeof m.offNote !== 'string') m.offNote = '';
    return m;
  }
  function rollHava(): HavaId {
    const w = HAVA_WEIGHTS[K.clock.season] || HAVA_WEIGHTS.ilkbahar;
    return rng.weighted<HavaId>(w);
  }
  const upg = (id: string) => save().upg[id] || 0;
  const bagCap = (c?: CourierSave) => BAG_BASE + upg('canta') + (c ? (ARAC_BY_ID[c.arac]?.bag || 0) : 0);
  const pushFeed = (f: Omit<KFeed, 'n'>) => { feed.push({ ...f, n: ++feedN }); if (feed.length > 8) feed.shift(); };

  function newCourier(m: KuryeSave): CourierSave {
    const used = new Set(m.couriers.map(c => c.name));
    const names = KURYE_ADLARI.filter(n => !used.has(n));
    const huys = HUY_IDS.filter(h => !m.couriers.some(c => c.huy === h));
    const c: CourierSave = { id: m.nextId++, name: rng.pick(names.length ? names : KURYE_ADLARI), huy: rng.pick(huys.length ? huys : HUY_IDS), arac: 'bisiklet', trips: 0, stars: 0 };
    m.couriers.push(c);
    return c;
  }
  function ensureOpen(): void {
    const m = save();
    if (m.on || K.state.level < KURYE_OPEN_LEVEL) return;
    m.on = true;
    if (!m.couriers.length) {
      const c = newCourier(m);
      if (m.couriers.length === 1 && !m.couriers.some(x => x.huy === 'kestirmeci')) c.huy = 'kestirmeci'; // the survey's "zaten var" quirk first
    }
    nextOrderT = now + 6;
    K.toast(PAKETMARTI_LINES.open + ' Ekip > Kuryeler', 'good');
    K.dirty();
  }

  // ───── orders ─────
  function makeOrder(): KOrder | null {
    const m = save(), S = K.state;
    const open = K.openProducts();
    if (!open.length) return null;
    const semts = SEMTLER.filter(s => s.range <= upg('menzil'));
    const semt = rng.pick(semts);
    const hava = HAVALAR[m.hava];
    const cap = Math.max(...m.couriers.map(c => bagCap(c)), BAG_BASE);
    const n = rng.int(1, Math.max(1, Math.min(cap, 1 + Math.floor(S.level / 3) + semt.range)));
    const items: Partial<Record<ProductId, number>> = {};
    const cold = open.filter(p => p === 'ayran' || p === 'gazoz');
    for (let i = 0; i < n; i++) {
      const p = hava.cold && cold.length && rng.chance(0.65) ? rng.pick(cold) : rng.pick(open);
      items[p] = (items[p] || 0) + 1;
    }
    let base = 0;
    for (const [p, k] of Object.entries(items)) base += price(p as ProductId, S.tiers[p as ProductId] || 1) * (k || 0);
    const value = Math.max(5, Math.round(base * K.venueMult() * semt.payX * 1.15));
    const sen = S.level >= SEN_GOTUR_LEVEL && rng.chance(SEN_GOTUR_CHANCE);
    return { id: ++orderN, semt: semt.id, items, value, until: now + ORDER_TTL, sen, who: rng.pick(MUSTERI_ADLARI), note: rng.pick(ADRES_NOTU), accepted: false };
  }
  function accept(id: number): void {
    const i = tablet.findIndex(o => o.id === id);
    if (i < 0) return;
    const o = tablet.splice(i, 1)[0];
    o.accepted = true;
    queue.push(o);
    K.logEv('kuryeAccept', { semt: o.semt });
    dispatch();
  }
  function decline(id: number): void {
    const i = tablet.findIndex(o => o.id === id);
    if (i >= 0) { tablet.splice(i, 1); K.toast('Sipariş başka büfeye gitti. Gönül koymak yok!', 'info'); }
  }
  const busy = (cid: number) => runs.some(r => r.courier === cid);
  function dispatch(): void {
    const m = save();
    while (queue.length) {
      const c = m.couriers.find(x => !busy(x.id));
      if (!c) return;
      const o = queue.shift()!;
      runs.push({ order: o, courier: c.id, phase: 'wait', t: 0, dur: 0, need: { ...o.items }, value: o.value, waitT: 0 });
    }
  }
  function tripDur(c: CourierSave, semtId: string, back: boolean): number {
    const s = SEMT_BY_ID[semtId] || SEMTLER[0], a = ARAC_BY_ID[c.arac] || ARACLAR[0], h = HUYLAR[c.huy], w = HAVALAR[save().hava];
    let sp = a.speed * (a.terrain[s.terrain] || 1) * h.speed * (1 + SPEED_PER_LVL * upg('hiz'));
    sp *= (w.speed.all || 1) * ((w.speed as Partial<Record<Terrain, number>>)[s.terrain] || 1);
    if (c.huy === 'haritasiz') sp *= rng.range(0.7, 1.45);
    return Math.max(4, s.dist / Math.max(0.2, sp)) * (back ? 0.6 : 1);
  }
  function pickItems(r: KRun): void {
    for (const p of Object.keys(r.need) as ProductId[]) {
      let left = r.need[p] || 0;
      while (left > 0) {
        if (K.counterApi.count(p) > 0) { const got = K.counterApi.take(p, 1, 'customer'); if (got.length) { left--; continue; } }
        if (K.stations.isBuilt(p) && K.stations.outCount(p) > 0) { const it = K.stations.takeOut(p, -1); if (it) { left--; continue; } }
        if (K.stations.isBuilt(p) && K.stations.isGrab(p)) { K.stations.makeGrab(p, -1); left--; continue; }
        break;
      }
      if (left > 0) r.need[p] = left; else delete r.need[p];
    }
  }

  function deliver(r: KRun, c: CourierSave, selfScore?: number): void {
    const m = save(), s = SEMT_BY_ID[r.order.semt] || SEMTLER[0], h = HUYLAR[c.huy], w = HAVALAR[m.hava];
    let stars: number;
    if (selfScore != null) stars = selfScore >= 70 ? 5 : selfScore >= 40 ? 4 : 3;
    else {
      let q = 3.4 + (c.huy === 'caysever' ? 0.9 : 0) + (c.huy === 'kedici' ? 0.3 : 0) + (upg('hiz') * 0.1) + cosBonus() - (r.waitT > 20 ? 0.6 : 0);
      if (c.huy === 'haritasiz' && rng.chance(0.3)) q -= 1.2;
      stars = Math.max(1, Math.min(5, Math.round(q + rng.range(-1.6, 1.4))));
    }
    const tip = r.value * (stars - 2) * 0.08 * h.tipX * w.tipX;
    const money = Math.max(1, Math.round(r.value + Math.max(0, tip)));
    K.earn(money);
    K.stat('kuryeTeslim');
    m.earned += money; m.trips++; c.trips++; c.stars += stars; m.starSum += stars; m.starN++;
    const text = rng.pick(YORUMLAR[stars]);
    m.ratings.unshift({ s: stars, text, who: r.order.who, semt: s.name, kurye: c.name }); if (m.ratings.length > 12) m.ratings.length = 12;
    pushFeed({ kind: 'rate', text, stars, money, who: r.order.who + ' · ' + s.name });
    if (selfScore == null) {
      if ((s.terrain === 'yokus' || s.terrain === 'merdiven' || s.terrain === 'tepe') && rng.chance(0.45)) pushFeed({ kind: 'moment', text: c.name + ': ' + rng.pick(YOKUS_ANLARI[s.terrain]) });
      else if (rng.chance(0.25)) pushFeed({ kind: 'moment', text: c.name + ': ' + rng.pick(h.lines) });
      if (m.hava === 'kar' && (s.terrain === 'yokus' || s.terrain === 'merdiven') && rng.chance(0.5)) pushFeed({ kind: 'moment', text: c.name + ' kızakla vızzz diye indi, paket bile şaşırdı!' });
      if (m.hava === 'yagmur' && rng.chance(0.2)) pushFeed({ kind: 'moment', text: c.name + ' şemsiyeyi pakete tuttu, kendisi sırılsıklam.' });
    }
    K.addXP(1);
    K.dirty();
  }
  function catBack(c: CourierSave): void {
    if (c.huy !== 'kedici' || !rng.chance(0.35)) return;
    const m = save(); m.cats++;
    pushFeed({ kind: 'cat', text: c.name + ': ' + rng.pick(KEDI_GETIRDI) });
    K.stat('kuryeKedi');
  }

  // ───── Sen götür! ─────
  function startSelf(id: number): void {
    const i = tablet.findIndex(o => o.id === id);
    if (i < 0) return;
    const o = tablet[i];
    if (!o.sen) { accept(id); return; }
    tablet.splice(i, 1);
    self = { order: o, n: ++selfN };
    rt.panel = null;
    if (!rt.paused) { rt.paused = true; rt.pauseWhy = 'kurye'; }
  }
  function endPause(): void { if (rt.paused && rt.pauseWhy === 'kurye') { rt.paused = false; rt.pauseWhy = ''; } }
  function selfResult(score0: number, quit: boolean): void {
    if (!self) { endPause(); return; }
    const o = self.order; self = null; endPause();
    const m = save();
    const score = Math.max(0, Math.min(100, Math.round(Number(score0) || 0)));
    if (quit || score <= 0) {
      // a courier runs it instead, nothing lost
      o.sen = false; o.accepted = true; queue.unshift(o); dispatch();
      selfLast = { score: 0, stars: 0, money: 0, text: rng.pick(SEN_GOTUR.fail), n: selfN };
      return;
    }
    const fake: CourierSave = { id: -1, name: K.state.hero === 'sabriye' ? 'Sabriye' : 'Sabri', huy: 'kestirmeci', arac: 'bisiklet', trips: 0, stars: 0 };
    const bonus = 1 + score / 100;
    const before = m.earned;
    deliver({ order: o, courier: -1, phase: 'out', t: 0, dur: 0, need: {}, value: Math.round(o.value * bonus), waitT: 0 }, fake, score);
    if (score >= 70) m.selfWins++;
    K.stat('kuryeSen');
    selfLast = { score, stars: score >= 70 ? 5 : score >= 40 ? 4 : 3, money: Math.round(m.earned - before), text: rng.pick(score >= 55 ? SEN_GOTUR.win : SEN_GOTUR.meh), n: selfN };
  }

  // ───── shop ─────
  function hire(): void {
    const m = save(), S = K.state;
    if (!m.on) return;
    if (m.couriers.length >= KURYE_MAX) { K.toast('Üç kurye yeter, dördüncüye bisiklet sığmaz.', 'info'); return; }
    const [lvl, cost] = KURYE_HIRE[m.couriers.length - 1] || KURYE_HIRE[KURYE_HIRE.length - 1];
    if (S.level < lvl) { K.toast('Yeni kurye Esnaf Seviyesi ' + lvl + ' olunca.', 'info'); return; }
    if (S.money < cost) { K.toast('Kasada ' + fmtMoney(cost) + ' olmalı.', 'info'); return; }
    K.spend(cost);
    const c = newCourier(m);
    K.toast(c.name + ' kuryelere katıldı! Huyu: ' + HUYLAR[c.huy].name, 'good');
    dispatch(); K.saveNow();
  }
  function buyVeh(id: string): void {
    const m = save(), a = ARAC_BY_ID[id];
    if (!a || m.owned.includes(id)) return;
    if (K.state.level < a.level) { K.toast(a.name + ' Esnaf Seviyesi ' + a.level + ' olunca.', 'info'); return; }
    if (K.state.money < a.price) { K.toast('Kasada ' + fmtMoney(a.price) + ' olmalı.', 'info'); return; }
    K.spend(a.price); m.owned.push(id);
    const idle = m.couriers.find(c => !busy(c.id) && (ARAC_BY_ID[c.arac]?.price || 0) < a.price) || m.couriers.find(c => !busy(c.id));
    if (idle) idle.arac = id;
    K.toast(a.name + ' alındı!' + (idle ? ' ' + idle.name + ' hemen bindi.' : ''), 'good');
    K.saveNow();
  }
  function setVeh(arg: string): void {
    const [cid, vid] = arg.split(':'); const m = save();
    const c = m.couriers.find(x => String(x.id) === cid);
    if (!c || !m.owned.includes(vid)) return;
    if (busy(c.id)) { K.toast(c.name + ' yolda. Dönünce değiştiririz.', 'info'); return; }
    c.arac = vid; K.dirty();
  }
  function buyUpg(id: string): void {
    const y = YUKSELTMELER.find(u => u.id === id), m = save();
    if (!y) return;
    const l = m.upg[id] || 0;
    if (l >= y.max) return;
    const cost = Math.round(y.cost(l));
    if (K.state.money < cost) { K.toast('Kasada ' + fmtMoney(cost) + ' olmalı.', 'info'); return; }
    K.spend(cost); m.upg[id] = l + 1;
    if (id === 'menzil') { const s = SEMTLER.filter(x => x.range === l + 1).map(x => x.name).join(', '); K.toast('Yeni semtler: ' + s, 'good'); }
    else K.toast(y.name + ' ' + (l + 1) + '. seviye!', 'good');
    K.saveNow();
  }
  function cosBonus(): number { const m = save(); return ['boya', 'korna', 'bayrak'].reduce((a, k) => a + ((SUSLER.find(s => s.id === m.sus[k])?.price || 0) > 0 ? 0.12 : 0), 0); }
  function buySus(id: string): void {
    const s = SUSLER.find(x => x.id === id), m = save();
    if (!s) return;
    if (!m.owned.includes(id)) {
      if (K.state.money < s.price) { K.toast('Kasada ' + fmtMoney(s.price) + ' olmalı.', 'info'); return; }
      K.spend(s.price); m.owned.push(id);
    }
    m.sus[s.kind] = id;
    if (s.kind === 'korna') pushFeed({ kind: 'info', text: 'Korna denemesi: ' + s.name + '! Martılar dönüp baktı.' });
    K.dirty();
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'kurye') return false;
    const op = String(c.op || ''), id = String(c.id ?? '');
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'kurye'; ensureOpen(); return true;
      case 'accept': accept(Number(id)); return true;
      case 'decline': decline(Number(id)); return true;
      case 'self': startSelf(Number(id)); return true;
      case 'selfResult': selfResult(Number(c.arg), false); return true;
      case 'selfQuit': selfResult(0, true); return true;
      case 'hire': hire(); return true;
      case 'buyVeh': buyVeh(id); return true;
      case 'veh': setVeh(id); return true;
      case 'upg': buyUpg(id); return true;
      case 'sus': buySus(id); return true;
      case 'seen': save().offNote = ''; return true;
      default: return true;
    }
  }

  K.addSystem({
    id: 'kurye', order: 22, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt, m = save();
      now = ctx.t;
      // weather: follow the shared hava system (sim/hava.ts) when it is installed, else a daily roll of our own
      const hv = (rt as unknown as { hava?: { view(): { kind: string } } }).hava;
      if (hv && (havaPoll -= dt) <= 0) {
        havaPoll = 2;
        let k: HavaId | undefined; try { k = HAVA_FROM_SHARED[hv.view().kind]; } catch { k = undefined; }
        if (k && k !== m.hava) { m.hava = k; m.day = K.state.day; }
      } else if (!hv && m.day !== K.state.day) { m.day = K.state.day; m.hava = rollHava(); }
      if (K.state.level !== seenLvl) {
        const was = seenLvl; seenLvl = K.state.level;
        const a = ARACLAR.find(x => x.level > was && x.level <= seenLvl && x.price > 0);
        if (a && was > 0 && m.on) K.toast('Yeni kurye aracı: ' + a.name + '! Ekip > Kuryeler', 'good');
        const h = KURYE_HIRE.find(([l]) => l > was && l <= seenLvl);
        if (h && m.on && m.couriers.length < KURYE_MAX) K.toast('Yeni kurye alabilirsin! Ekip > Kuryeler', 'good');
      }
      if (!m.on) { if (K.state.level >= KURYE_OPEN_LEVEL) ensureOpen(); return; }
      // tablet
      for (let i = tablet.length - 1; i >= 0; i--) if (now > tablet[i].until) tablet.splice(i, 1);
      if (now >= nextOrderT) {
        const w = HAVALAR[m.hava];
        const every = rng.range(ORDER_EVERY[0], ORDER_EVERY[1]) / (w.orderX * (1 + 0.25 * (m.couriers.length - 1)));
        nextOrderT = now + every;
        const h = K.hour();
        if (tablet.length < TABLET_MAX && h >= 8.5 && h < 23.5) {
          const o = makeOrder();
          if (o) { tablet.push(o); K.logEv('kuryeOrder', { semt: o.semt }); }
        }
      }
      dispatch();
      // runs
      if (runs.length) m.workSec += dt;
      for (let i = runs.length - 1; i >= 0; i--) {
        const r = runs[i];
        const c = m.couriers.find(x => x.id === r.courier);
        if (!c) { runs.splice(i, 1); continue; }
        r.t += dt;
        if (r.phase === 'wait') {
          r.waitT += dt;
          pickItems(r);
          if (sumItems(r.need) <= 0 || r.waitT >= WAIT_MAX) {
            if (sumItems(r.need) > 0) pushFeed({ kind: 'info', text: c.name + ' tezgahı bekledi, sonunda Sabri\'nin yedek dolabından tamamladı.' });
            r.need = {}; r.phase = 'out'; r.t = 0; r.dur = tripDur(c, r.order.semt, false);
          }
        } else if (r.phase === 'out' && r.t >= r.dur) {
          deliver(r, c);
          r.phase = 'back'; r.t = 0; r.dur = tripDur(c, r.order.semt, true);
        } else if (r.phase === 'back' && r.t >= r.dur) {
          catBack(c);
          runs.splice(i, 1);
        }
      }
    },
  });

  function offline(away: number): number {
    const m = save();
    if (!m.on || !m.couriers.length) return 0;
    const k = KEPENK[Math.max(0, Math.min(KEPENK.length - 1, K.state.kepenk || 0))];
    const s = Math.max(0, Math.min(away, k[0] * 3600));
    const measured = m.workSec > 60 ? m.earned / (m.workSec / 60) : 0;
    const perMin = Math.min(measured || 0, 40 * m.couriers.length * Math.max(1, K.state.level)) || 6 * m.couriers.length;
    const amount = Math.floor(perMin * OFFLINE_RATE * (s / 60) * 0.35);
    if (amount > 0) {
      const trips = Math.max(1, Math.round(s / 90 * m.couriers.length * 0.35));
      m.offNote = 'Kepenk kapalıyken kuryeler yaklaşık ' + trips + ' paket götürdü: +' + fmtMoney(amount);
      pushFeed({ kind: 'info', text: m.offNote });
    }
    return amount;
  }

  function view(): KuryeView {
    const m = save(), h = HAVALAR[m.hava];
    const couriers = m.couriers.map(c => {
      const r = runs.find(x => x.courier === c.id), a = ARAC_BY_ID[c.arac] || ARACLAR[0];
      let k = 0, mx = BUFE_XY.x, my = BUFE_XY.y, semt = '';
      if (r) {
        const s = SEMT_BY_ID[r.order.semt] || SEMTLER[0]; semt = s.name;
        k = r.phase === 'wait' ? 0 : Math.min(1, r.t / Math.max(0.01, r.dur));
        const f = r.phase === 'back' ? 1 - k : r.phase === 'out' ? k : 0;
        // simple L-shaped street route: up the main street, then across
        const midY = BUFE_XY.y + (s.my - BUFE_XY.y) * 0.5;
        if (f < 0.5) { const g = f / 0.5; mx = BUFE_XY.x; my = BUFE_XY.y + (midY - BUFE_XY.y) * g; if (f > 0.35) mx = BUFE_XY.x + (s.mx - BUFE_XY.x) * (f - 0.35) * 0.4; }
        else { const g = (f - 0.5) / 0.5; mx = BUFE_XY.x + (s.mx - BUFE_XY.x) * (0.06 + 0.94 * g); my = midY + (s.my - midY) * g; }
      }
      return { id: c.id, name: c.name, arac: a.id, aracName: a.name, color: a.color, huy: HUYLAR[c.huy].name, state: (r ? r.phase : 'idle') as 'idle' | 'wait' | 'out' | 'back', semt, k, mx, my, waitFor: r && r.phase === 'wait' ? itemsText(r.need) : '' };
    });
    return {
      on: m.on, hava: { id: h.id, name: h.name, note: h.note, gear: h.gear },
      tablet: tablet.map(o => { const s = SEMT_BY_ID[o.semt]; return { id: o.id, semt: o.semt, semtName: s.name, terrain: TERRAIN_NAME[s.terrain], items: itemsText(o.items), value: o.value, left: Math.max(0, Math.ceil(o.until - now)), sen: o.sen, who: o.who, note: o.note }; }),
      queued: queue.length, couriers, feed, feedN, self, selfLast,
      boya: SUSLER.find(s => s.id === m.sus.boya)?.color || '#ffd23f', bayrak: SUSLER.find(s => s.id === m.sus.bayrak)?.color || '#ffffff',
    };
  }

  function panelModel(): Record<string, any> {
    const m = save(), S = K.state, v = view();
    const nextHire = m.couriers.length < KURYE_MAX ? KURYE_HIRE[Math.max(0, m.couriers.length - 1)] : null;
    return {
      on: m.on, openLevel: KURYE_OPEN_LEVEL, level: S.level, money: S.money, hava: v.hava,
      avg: m.starN ? +(m.starSum / m.starN).toFixed(1) : 0, starN: m.starN, trips: m.trips, earned: Math.round(m.earned), cats: m.cats, selfWins: m.selfWins, offNote: m.offNote,
      tablet: v.tablet, queued: v.queued,
      couriers: m.couriers.map(c => { const cv = v.couriers.find(x => x.id === c.id)!; return { id: c.id, name: c.name, huy: HUYLAR[c.huy].name, huyFx: HUYLAR[c.huy].effect, arac: c.arac, aracName: cv.aracName, color: cv.color, trips: c.trips, avg: c.trips ? +(c.stars / c.trips).toFixed(1) : 0, state: cv.state, semt: cv.semt, waitFor: cv.waitFor, bag: bagCap(c) }; }),
      max: KURYE_MAX, hire: nextHire ? { level: nextHire[0], cost: nextHire[1], can: S.level >= nextHire[0] && S.money >= nextHire[1] } : null,
      araclar: ARACLAR.map(a => ({ id: a.id, name: a.name, blurb: a.blurb, level: a.level, price: a.price, owned: m.owned.includes(a.id), open: S.level >= a.level, color: a.color, bag: a.bag, best: Object.entries(a.terrain).filter(([, x]) => (x || 0) > 1).map(([t]) => TERRAIN_NAME[t as Terrain]).join(', ') })),
      upg: YUKSELTMELER.map(y => { const l = m.upg[y.id] || 0; return { id: y.id, name: y.name, what: y.what, lvl: l, max: y.max, cost: l < y.max ? Math.round(y.cost(l)) : 0 }; }),
      sus: SUSLER.map(s => ({ id: s.id, kind: s.kind, kindName: SUS_KIND_NAME[s.kind], name: s.name, price: s.price, color: s.color, owned: m.owned.includes(s.id), on: m.sus[s.kind] === s.id })),
      semtler: SEMTLER.map(s => ({ id: s.id, name: s.name, terrain: TERRAIN_NAME[s.terrain], open: s.range <= (m.upg.menzil || 0), range: s.range, payX: s.payX, blurb: s.blurb, mx: s.mx, my: s.my })),
      ratings: m.ratings.slice(0, 8),
      live: v.couriers.map(c => ({ name: c.name, mx: c.mx, my: c.my, state: c.state, color: c.color })),
    };
  }
  function summary(): Record<string, any> | null {
    const m = save();
    if (!m.on) return { on: false, openLevel: KURYE_OPEN_LEVEL };
    return { on: true, n: m.couriers.length, max: KURYE_MAX, out: runs.length, tablet: tablet.length, avg: m.starN ? +(m.starSum / m.starN).toFixed(1) : 0, hava: HAVALAR[m.hava].name };
  }

  const api: KuryeApi = { handle, panelModel, summary, view, offline };
  (rt as unknown as { kurye: KuryeApi }).kurye = api;
  K.addStateView(() => ({ kurye: { on: save().on, tablet: tablet.length, runs: runs.length, couriers: save().couriers.length, self: self ? self.order.id : null } }));
  return api;
}

/** Read the kurye API from rules runtime (null before install). */
export function kuryeApi(r: { rt: unknown } | null | undefined): KuryeApi | null { return r ? ((r.rt as { kurye?: KuryeApi }).kurye) || null : null; }
export function kuryePanelModel(r: { rt: unknown }): Record<string, any> { const a = kuryeApi(r); return a ? a.panelModel() : {}; }
export function kuryeSummary(r: { rt: unknown }): Record<string, any> | null { const a = kuryeApi(r); return a ? a.summary() : null; }
