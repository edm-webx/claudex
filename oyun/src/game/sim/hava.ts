/**
 * Hava, mevsimler ve etkinlikler (survey etkinlik-1..8, yasam-5, motor-7, icecek-6, yiyecek-6, iskele-8, genel-4).
 * Pure sim module: no three, no DOM, no wall clock, seeded rng only.
 *
 * - In-game calendar: one game day = one calendar day. It is anchored to GameState.calendar (the real date the host
 *   writes at session start); when the real date runs ahead of the in-game date the calendar jumps forward, so
 *   events follow real life for a slow player and come faster for a busy one. Without a calendar: 1 June 2026.
 * - Weather: one roll per game day (season weights), as hour windows ("segments"); a sağanak is followed by a
 *   gökkuşağı. Effects: arrival multiplier, hot/cold demand shift (season + weather), wet tables (customers sit only
 *   under umbrellas), sunny umbrellas (longer stay, bigger tips), fırtına skips one ferry wave, lodos makes an
 *   umbrella fly: walk to where it lands within UMBRELLA.catchS for a bonus.
 * - Seasonal foods: an extra with a sale now and then (seasonal cart next to the kiosk).
 * - Events calendar: 3-4 limited items each, sold as extras with sales; a goal of specials sold gives a decor item,
 *   Altın Simit, a trophy and sometimes a Sabri outfit / a new cat name. Progress carries over to next year's run when
 *   missed. Every item sold once stays in the Tarif Defteri memories. 23 Nisan: kids run the büfe (patience aura).
 * - Gece Pazarı: every Saturday night 19-24 a stall the player stocks in advance sells by itself; the last hour is half
 *   price (tazelik), leftovers go to the cats. Never negative money, nothing is lost.
 * - Persistent: GameState.zones['hava'] (defaults on read, old saves load). Runtime for views: `havaApi(rules).view()`.
 * - Commands: { kind: 'hava', op: 'open' | 'umb' | 'stock', id? }.
 */
import type { Kernel } from './state';
import type { ProductId } from './schema';
import {
  HAVA_KINDS, HAVA_WEIGHTS, HAVA_WINDOW, RAINBOW_H, SEASON_PREF, WEATHER_PREF, SEASON_FOODS, RAMAZAN, SEASON_FOOD_CHANCE, HAVA_PRICE_X,
  UMBRELLA, UMBRELLA_LINES, MARKET, MARKET_LINES, WEEKDAYS, MONTHS, SEASON_NAMES,
  type HavaKind, type HavaSeason, type SeasonFood,
} from '../../content/hava';
import { fmtMoney, hashStr } from './util';

export const HAVA_KEY = 'hava';

interface Seg { k: HavaKind; a: number; b: number }
interface EvSave { prog: number; done: boolean; year: number }
interface HavaSave {
  anchorDay: number; anchorDate: string;
  wDay: number; segs: Seg[];
  umb: number;
  ev: Record<string, EvSave>;
  mem: string[]; trophies: string[]; extras: string[];
  lastEv: string;
  mkt: { day: number; stock: Record<string, number>; sold: number; earned: number; open: boolean; fresh: boolean; closed: boolean };
  foodSold: number; caught: number; skipDay: number;
}
export interface YMD { y: number; m: number; d: number }
export interface FlyUmbrella { phase: 'fly' | 'down'; x0: number; z0: number; x: number; z: number; t: number; color: number }
export interface HavaView {
  kind: HavaKind; name: string; icon: string;
  /** 0..1 ramp in/out of the current weather window */ k: number;
  season: HavaSeason; date: YMD; dateText: string;
  market: { today: boolean; open: boolean; fresh: boolean; stock: number };
  umbrellas: number; tables: number;
  fly: FlyUmbrella | null;
  food: string;
}
export interface HavaMods { arrival(): number; pref(p: ProductId): number; sitOk(): boolean; eatX(): number; tipX(): number; skipFerry(): boolean }
export interface HavaApi extends HavaMods {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): HavaView;
  model(): Record<string, unknown>;
  summary(): Record<string, unknown>;
}

// ───────── calendar math (proleptic Gregorian, no Date object) ─────────
function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400), yoe = y - era * 400, mp = (m + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1, doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}
function civilFromDays(z: number): YMD {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100)), mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return { y: era * 400 + yoe + (m <= 2 ? 1 : 0), m, d };
}
const parseYMD = (s: string): YMD | null => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const ymdStr = (v: YMD) => v.y + '-' + String(v.m).padStart(2, '0') + '-' + String(v.d).padStart(2, '0');
const weekday = (v: YMD) => ((daysFromCivil(v.y, v.m, v.d) % 7) + 7 + 4) % 7; // 1970-01-01 was a Thursday
export const seasonOfMonth = (m: number): HavaSeason => (m >= 3 && m <= 5 ? 'ilkbahar' : m >= 6 && m <= 8 ? 'yaz' : m >= 9 && m <= 11 ? 'sonbahar' : 'kis');
const md = (m: number, d: number) => m * 100 + d;
const inRange = (v: YMD, from: [number, number], to: [number, number]) => { const x = md(v.m, v.d), a = md(from[0], from[1]), b = md(to[0], to[1]); return a <= b ? x >= a && x <= b : x >= a || x <= b; };
const smooth = (x: number) => { const t = x < 0 ? 0 : x > 1 ? 1 : x; return t * t * (3 - 2 * t); };

export function installHava(K: Kernel): HavaApi {
  const rng = K.rng('sim.hava');
  const S = () => K.state, rt = K.rt;
  const H = (): HavaSave => {
    const st = S();
    if (!st.zones || typeof st.zones !== 'object') st.zones = {};
    let h = st.zones[HAVA_KEY] as unknown as HavaSave | undefined;
    if (!h || typeof h !== 'object') { h = {} as HavaSave; st.zones[HAVA_KEY] = h as unknown as Record<string, unknown>; }
    h.anchorDay = Number(h.anchorDay) || 0; h.anchorDate = typeof h.anchorDate === 'string' ? h.anchorDate : '';
    h.wDay = Number(h.wDay) || 0; if (!Array.isArray(h.segs)) h.segs = [];
    h.umb = Math.max(0, Math.min(UMBRELLA.max, Number(h.umb) || 0));
    if (!h.ev || typeof h.ev !== 'object') h.ev = {};
    if (!Array.isArray(h.mem)) h.mem = []; if (!Array.isArray(h.trophies)) h.trophies = []; if (!Array.isArray(h.extras)) h.extras = [];
    h.lastEv = typeof h.lastEv === 'string' ? h.lastEv : '';
    if (!h.mkt || typeof h.mkt !== 'object') h.mkt = { day: 0, stock: {}, sold: 0, earned: 0, open: false, fresh: false, closed: false };
    if (!h.mkt.stock || typeof h.mkt.stock !== 'object') h.mkt.stock = {};
    h.foodSold = Number(h.foodSold) || 0; h.caught = Number(h.caught) || 0; h.skipDay = Number(h.skipDay) || 0;
    return h;
  };

  // ───────── calendar ─────────
  function syncAnchor(): void {
    const h = H(), st = S();
    const real = parseYMD(st.calendar);
    if (!h.anchorDate) { h.anchorDate = real ? ymdStr(real) : '2026-06-01'; h.anchorDay = st.day; return; }
    if (real) {
      const cur = date(), rd = daysFromCivil(real.y, real.m, real.d), cd = daysFromCivil(cur.y, cur.m, cur.d);
      if (rd > cd) { h.anchorDate = ymdStr(real); h.anchorDay = st.day; }
    }
  }
  function date(): YMD {
    const h = H(), a = parseYMD(h.anchorDate) || { y: 2026, m: 6, d: 1 };
    return civilFromDays(daysFromCivil(a.y, a.m, a.d) + (S().day - (h.anchorDay || S().day)));
  }
  const season = () => seasonOfMonth(date().m);
  const ramazan = (v: YMD) => { const s = ymdStr(v); return RAMAZAN.some(([a, b]) => s >= a && s <= b); };
  const foods = (): SeasonFood[] => { const v = date(); return [...SEASON_FOODS[seasonOfMonth(v.m)], ...(ramazan(v) ? SEASON_FOODS.ramazan : [])]; };
  const marketDay = () => weekday(date()) === MARKET.weekday;
  const priceX = () => HAVA_PRICE_X * Math.sqrt(Math.max(1, K.venueMult()));

  // ───────── weather ─────────
  function rollDay(): void {
    const h = H(), st = S();
    h.wDay = st.day; h.segs = [];
    // fixed per seed + day, so a reload rolls the same day
    const r = { v: hashStr(st.seed + ':' + st.day) };
    const rnd = () => { r.v = (Math.imul(r.v ^ (r.v >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (r.v >>> 8) / 16777216; };
    const ss = season(), w = HAVA_WEIGHTS[ss];
    if (st.day <= 2) return; // first days stay sunny (tutorial)
    let tot = 0; for (const k in w) tot += w[k as HavaKind] || 0;
    let x = rnd() * tot, kind: HavaKind = 'acik';
    for (const k in w) { x -= w[k as HavaKind] || 0; if (x <= 0) { kind = k as HavaKind; break; } }
    const win = HAVA_WINDOW[kind];
    if (kind === 'acik' || !win) return;
    const a = win[0] + rnd() * (win[1] - win[0]), b = Math.min(24, a + win[2] + rnd() * (win[3] - win[2]));
    h.segs.push({ k: kind, a, b });
    if (kind === 'saganak' && b < 23) h.segs.push({ k: 'gokkusagi', a: b, b: Math.min(24, b + RAINBOW_H) });
  }
  function seg(): Seg | null { const hr = K.hour(); return H().segs.find(s => hr >= s.a && hr < s.b) || null; }
  const kind = (): HavaKind => seg()?.k ?? 'acik';
  const ramp = (): number => { const s = seg(); if (!s) return 0; const hr = K.hour(); return smooth(Math.min((hr - s.a) / 0.4, (s.b - hr) / 0.4)); };

  // ───────── mods (customers.ts, ferry.ts) ─────────
  const tablesN = () => K.tablesBuilt();
  const umbN = () => Math.min(H().umb, tablesN());
  const mods: HavaMods = {
    arrival() {
      if (!rt.started) return 1;
      const kd = HAVA_KINDS[kind()];
      let k = 1 + (kd.arrival - 1) * ramp();
      if (marketDay() && K.hour() >= MARKET.fromH) k *= MARKET.arrival;
      return k;
    },
    pref(p) {
      const sp = SEASON_PREF[season()][p] ?? 1, wp = WEATHER_PREF[kind()]?.[p] ?? 1;
      return sp * (1 + (wp - 1) * ramp());
    },
    sitOk() {
      if (!HAVA_KINDS[kind()].wet || ramp() < 0.3) return true;
      const t = tablesN(); return t > 0 && umbN() > 0 && rng.chance(umbN() / t);
    },
    eatX() {
      const kd = HAVA_KINDS[kind()]; if (!umbN()) return 1;
      if (kd.wet) return UMBRELLA.wetEatX;
      if (kd.sunny && K.hour() < 19 && (season() === 'yaz' || kind() === 'sicak' || season() === 'ilkbahar')) return UMBRELLA.sunEatX;
      return 1;
    },
    tipX() {
      const kd = HAVA_KINDS[kind()];
      return umbN() && kd.sunny && K.hour() < 19 && (season() === 'yaz' || kind() === 'sicak') ? UMBRELLA.sunTipX : 1;
    },
    skipFerry() {
      const h = H();
      if (kind() !== 'firtina' || h.skipDay === S().day) return false;
      h.skipDay = S().day; K.toast('Fırtına! Bu vapur seferi iptal, kaptan çay içiyor.', 'info'); K.logEv('havaFerrySkip', {});
      return true;
    },
  };

  // ───────── flying umbrella (lodos) ─────────
  let fly: FlyUmbrella | null = null, flyT = 20;
  function updateFly(dt: number): void {
    if (fly) {
      fly.t += dt;
      if (fly.phase === 'fly' && fly.t >= 2.4) { fly.phase = 'down'; fly.t = 0; }
      if (fly.phase === 'down' || fly.t > 1.2) {
        const p = K.playerPos, cx = fly.phase === 'down' ? fly.x : fly.x0 + (fly.x - fly.x0) * fly.t / 2.4, cz = fly.phase === 'down' ? fly.z : fly.z0 + (fly.z - fly.z0) * fly.t / 2.4;
        if (Math.hypot(p.x - cx, p.z - cz) < UMBRELLA.catchR) {
          const v = Math.round(UMBRELLA.bonusBase + UMBRELLA.bonusPerStage * (S().stage - 1));
          K.earn(v, { x: cx, z: cz }); H().caught++; K.stat('semsiye');
          K.toast(rng.pick(UMBRELLA_LINES.caught) + ' +' + fmtMoney(v), 'good'); K.logEv('havaCatch', { x: cx, z: cz, v });
          fly = null; return;
        }
      }
      if (fly.phase === 'down' && fly.t > UMBRELLA.catchS) { K.toast(UMBRELLA_LINES.lost, 'info'); fly = null; }
      return;
    }
    return;   // 2026-10-25 user: flying umbrellas switched off
    if (kind() !== 'lodos' || ramp() < 0.5 || !umbN()) return;
    flyT -= dt; if (flyT > 0) return;
    flyT = rng.range(UMBRELLA.flyEvery[0], UMBRELLA.flyEvery[1]);
    const built = rt.tables.map((t, i) => (t.built ? i : -1)).filter(i => i >= 0).slice(0, umbN());
    if (!built.length) return;
    const ti = rng.pick(built), tb = rt.layout.tables[ti]; if (!tb) return;
    for (let k = 0; k < 8; k++) {
      const a = rng.range(-0.9, 0.9), d = rng.range(3, 6.5), x = tb.x + Math.cos(a) * d, z = tb.z + Math.sin(a) * d;
      if (!K.nav.walkable({ x, z })) continue;
      fly = { phase: 'fly', x0: tb.x, z0: tb.z, x, z, t: 0, color: ti % UMBRELLA.colors.length };
      K.toast(rng.pick(UMBRELLA_LINES.fly), 'info'); K.logEv('havaFly', { x, z });
      return;
    }
  }

  // ───────── day start ─────────
  function newDay(): void {
    syncAnchor();
    rollDay();
    const h = H();
    const s0 = H().segs[0];
    if (s0) K.toast(HAVA_KINDS[s0.k].icon + ' Bugün ' + HAVA_KINDS[s0.k].name.toLocaleLowerCase('tr') + ' bekleniyor, saat ' + Math.floor(s0.a) + ' gibi.', 'info');
    if (marketDay()) { h.mkt = { day: S().day, stock: h.mkt.day === S().day ? h.mkt.stock : (h.mkt.stock || {}), sold: 0, earned: 0, open: false, fresh: false, closed: false }; K.toast(MARKET_LINES.morning, 'info'); }
    K.saveNow();
  }

  // ───────── extras with a sale ─────────
  K.bus.on('sale', ((e: { value: number; kind: string }) => {
    if (!rt.started || !e || !(e.value > 0)) return;
    const h = H();
    if (rng.chance(SEASON_FOOD_CHANCE)) {
      const f = rng.pick(foods()); if (!f) return;
      K.earn(Math.round(f.price * priceX())); h.foodSold++;
    }
  }) as never);

  // ───────── Gece Pazarı ─────────
  let sellT = 3;
  function updateMarket(dt: number): void {
    const h = H(), m = h.mkt;
    if (!marketDay() || m.day !== S().day || m.closed) return;
    const hr = K.hour();
    if (hr < MARKET.fromH) return;
    if (!m.open) { m.open = true; K.toast(MARKET_LINES.open, 'good'); K.logEv('havaMarket', { open: true }); if (!stockN()) K.toast(MARKET_LINES.empty, 'info'); }
    if (hr >= MARKET.freshH && !m.fresh) { m.fresh = true; K.toast(MARKET_LINES.fresh, 'info'); }
    if (hr >= 23.85) {
      m.closed = true;
      K.toast(MARKET_LINES.close.replace('{n}', String(m.sold)).replace('{money}', fmtMoney(m.earned)), 'good');
      const left = stockN();
      if (left > 0) { K.toast(MARKET_LINES.cats.replace('{n}', String(left)), 'info'); K.stat('kediMama', left); }
      m.stock = {}; K.saveNow();
      return;
    }
    sellT -= dt; if (sellT > 0) return;
    sellT = rng.range(MARKET.sellEvery[0], MARKET.sellEvery[1]) / (1 + 0.15 * (S().stage - 1));
    const ids = MARKET.items.filter(i => (m.stock[i.id] || 0) > 0);
    if (!ids.length) return;
    const it = rng.pick(ids);
    m.stock[it.id]--;
    const v = Math.round(it.price * priceX() * (m.fresh ? 0.5 : 1));
    K.earn(v); m.sold++; m.earned += v;
  }
  const stockN = () => Object.values(H().mkt.stock).reduce((a, b) => a + (b || 0), 0);


  // ───────── tick ─────────
  let lastKind: HavaKind | '' = '';
  K.addSystem({
    id: 'hava', order: 26, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const h = H();
      if (h.wDay !== S().day) newDay();
      const dt = ctx.dt;
      updateFly(dt);
      updateMarket(dt);
      const kn = kind();
      if (kn !== lastKind) {
        const was = lastKind; lastKind = kn;
        if (kn !== 'acik') { const kd = HAVA_KINDS[kn]; K.toast(kd.icon + ' ' + rng.pick(kd.start), 'info'); K.logEv('havaStart', { kind: kn }); }
        else if (was) K.toast('☀ Hava açtı, güneş geri geldi.', 'info');
      }
    },
  });

  // ───────── commands ─────────
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    const op = String(c.op || ''), h = H();
    if (op === 'open') { rt.boardOpen = false; rt.panel = 'hava'; K.logEv('panel', { id: 'hava' }); return true; }
    if (op === 'umb') {
      if (h.umb >= UMBRELLA.max) { K.toast('Bütün masalarda şemsiye var.', 'info'); return true; }
      const cost = UMBRELLA.cost(h.umb);
      if (S().money < cost) { K.toast('Şemsiye için kasada ' + fmtMoney(cost) + ' olmalı.', 'info'); return true; }
      K.spend(cost); h.umb++; K.toast(UMBRELLA_LINES.buy, 'good'); K.logEv('havaUmb', { n: h.umb }); K.saveNow();
      return true;
    }
    if (op === 'stock') {
      const it = MARKET.items.find(i => i.id === String(c.id)); if (!it) return true;
      const m = h.mkt;
      if (m.day !== S().day && !marketDay()) { m.day = 0; }
      const have = m.stock[it.id] || 0;
      if (have >= MARKET.maxStock) { K.toast('Tezgahta ' + it.name + ' yeterince var.', 'info'); return true; }
      const cost = Math.round(it.cost * priceX() * MARKET.pack);
      if (S().money < cost) { K.toast(it.name + ' için kasada ' + fmtMoney(cost) + ' olmalı.', 'info'); return true; }
      K.spend(cost); m.stock[it.id] = have + MARKET.pack;
      if (marketDay()) m.day = S().day;
      K.toast('Tezgaha ' + MARKET.pack + ' ' + it.name + ' kondu.', 'good'); K.saveNow();
      return true;
    }
    return false;
  }

  // ───────── views and panel ─────────
  function dateText(v: YMD = date()): string { return v.d + ' ' + MONTHS[v.m - 1] + ' ' + WEEKDAYS[weekday(v)]; }
  function view(): HavaView {
    const v = date(), kd = HAVA_KINDS[kind()], m = H().mkt, f = foods();
    return {
      kind: kd.id, name: kd.name, icon: kd.icon, k: ramp(), season: seasonOfMonth(v.m), date: v, dateText: dateText(v),
      market: { today: marketDay(), open: marketDay() && m.open && !m.closed, fresh: m.fresh, stock: stockN() },
      umbrellas: umbN(), tables: tablesN(), fly, food: f.length ? f[(S().day + 7) % f.length].name : '',
    };
  }
  function effectText(k: HavaKind): string {
    switch (k) {
      case 'saganak': case 'kar': return 'Masalar ıslak: müşteri sadece şemsiye altına oturur. Sıcak içecek talebi artar.';
      case 'firtina': return 'Bir vapur seferi iptal olur. Az müşteri, bol çay.';
      case 'lodos': return 'Şapkalar uçar, şemsiyeler de! Uçan şemsiyeyi yakala, bonus kap.';
      case 'sis': return 'Vapur düdüğü uzaktan gelir. Çay ve simit daha çok gider.';
      case 'sicak': return 'Herkes gölgede. Ayran ve gazoz uçar, şemsiye altında uzun oturulur.';
      case 'gokkusagi': return 'Herkes fotoğraf için dışarıda, müşteri bol!';
      default: return 'Güzel hava, keyifli iskele.';
    }
  }
  function model(): Record<string, unknown> {
    const h = H(), v = date(), ss = seasonOfMonth(v.m), st = S(), kd = HAVA_KINDS[kind()];
    const px = priceX();
    const mDays = (MARKET.weekday - weekday(v) + 7) % 7;
    return {
      dateText: dateText(v), season: SEASON_NAMES[ss], seasonId: ss,
      weather: { id: kd.id, name: kd.name, icon: kd.icon, effect: effectText(kd.id), on: ramp() > 0.05 },
      today: h.segs.map(s => ({ name: HAVA_KINDS[s.k].name, icon: HAVA_KINDS[s.k].icon, from: Math.floor(s.a), to: Math.min(24, Math.ceil(s.b)) })),
      umbrella: { n: h.umb, max: UMBRELLA.max, tables: tablesN(), cost: h.umb < UMBRELLA.max ? UMBRELLA.cost(h.umb) : 0, money: st.money },
      market: {
        today: marketDay(), days: mDays, open: marketDay() && h.mkt.open && !h.mkt.closed, closed: marketDay() && h.mkt.closed, fresh: h.mkt.fresh, sold: h.mkt.sold, earned: h.mkt.earned,
        items: MARKET.items.map(i => ({ id: i.id, name: i.name, color: i.color, stock: h.mkt.stock[i.id] || 0, cost: Math.round(i.cost * px * MARKET.pack), price: Math.round(i.price * px), pack: MARKET.pack, max: MARKET.maxStock })),
        money: st.money,
      },
      foods: foods().map(f => ({ name: f.name, price: Math.round(f.price * px) })), foodSold: h.foodSold,
      trophies: h.trophies.slice(), extras: h.extras.slice(), caught: h.caught,
    };
  }
  function summary(): Record<string, unknown> {
    const v = date(), kd = HAVA_KINDS[kind()];
    return {
      dateText: dateText(v), season: SEASON_NAMES[seasonOfMonth(v.m)], icon: kd.icon, weather: kd.name,
      market: marketDay() ? 'Bu akşam Gece Pazarı!' : '',
    };
  }

  const api: HavaApi = { ...mods, handle, view, model, summary };
  (rt as unknown as { hava: HavaApi }).hava = api;
  return api;
}

/** Views, UI and the customers/ferry hooks read the installed module through the runtime. */
export function havaApi(r: { rt: unknown } | null | undefined): HavaApi | null { return r ? ((r.rt as { hava?: HavaApi }).hava || null) : null; }
export const havaOf = (rt: unknown): HavaMods | null => ((rt as { hava?: HavaMods }).hava || null);
