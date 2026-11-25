/**
 * Hava, mevsimler ve etkinlikler (survey etkinlik-1..8, yasam-5, motor-7, icecek-6, yiyecek-6, iskele-8, genel-4).
 * Pure sim module: no three, no DOM, no wall clock, seeded rng only.
 *
 * - In-game calendar (ZMN-02, 2026-11-25 owner: "gerçek ay hafta döngüsünden farklı, daha hızlı ama hızlı hissettirmesin"): one game day
 *   moves the date one WEEK (TAKVIM_ADIM days) while the weekday moves one day, so a month is ~4 game days, a season ~13 (~1.7 h of play),
 *   a year ~52. The real date (GameState.calendar) only picks where a new save starts; after that the calendar never follows the wall
 *   clock. Season edges blend: the last and first quarter of a season mix in the neighbour's weather weights, so the first snow comes
 *   late in autumn as a rare day, not as a switch. Without a calendar: 1 June 2026.
 * - Weather: one roll per game day (season weights), as hour windows ("segments"); a sağanak is followed by a
 *   gökkuşağı. Effects: arrival multiplier, hot/cold demand shift (season + weather), wet tables (customers sit only
 *   under umbrellas), sunny umbrellas (longer stay, bigger tips), fırtına skips one ferry wave, lodos makes an
 *   umbrella fly: walk to where it lands within UMBRELLA.catchS for a bonus.
 * - Events calendar: 3-4 limited items each, sold as extras with sales; a goal of specials sold gives a decor item,
 *   Altın Simit, a trophy and sometimes a Sabri outfit / a new cat name. Progress carries over to next year's run when
 *   missed. Every item sold once stays in the Tarif Defteri memories. 23 Nisan: kids run the büfe (patience aura).
 * - Gece Pazarı: every Saturday night 19-24 the stalls sell by themselves, no stock: each sale earns price minus unit
 *   cost (net).
 * - Persistent: GameState.zones['hava'] (defaults on read, old saves load). Runtime for views: `havaApi(rules).view()`.
 * - Commands: { kind: 'hava', op: 'open' | 'umb' }.
 */
import type { Kernel } from './state';
import type { ProductId } from './schema';
import {
  HAVA_KINDS, HAVA_WEIGHTS, HAVA_WINDOW, RAINBOW_H, SEASON_PREF, WEATHER_PREF, HAVA_PRICE_X,
  UMBRELLA, UMBRELLA_LINES, MARKET, MARKET_LINES, WEEKDAYS, MONTHS, SEASON_NAMES,
  type HavaKind, type HavaSeason,
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
  mkt: { day: number; sold: number; earned: number; open: boolean; closed: boolean };
  caught: number; skipDay: number;
  /** ZMN-02 calendar version: 2 = one game day is one week */ tv?: number;
}
/** ZMN-02: calendar days per game day */
export const TAKVIM_ADIM = 7;
/** ZMN-02: a weather window fades in and out over this many game hours (was 0.4 h = 10 s, now ~24 s), never more than a third of it */
export const HAVA_RAMPA = 1.2;
const rampOf = (s: Seg, hr: number) => { const r = Math.min(HAVA_RAMPA, (s.b - s.a) / 3); return smooth(Math.min((hr - s.a) / r, (s.b - hr) / r)); };
export interface YMD { y: number; m: number; d: number }
export interface FlyUmbrella { phase: 'fly' | 'down'; x0: number; z0: number; x: number; z: number; t: number; color: number }
export interface HavaView {
  kind: HavaKind; name: string; icon: string;
  /** ZMN-02 chip lines: "Kasım 2. hafta", "Salı" */ ayText: string; gunText: string;
  /** 0..1 cloud build-up: rises in the hour before a grey window and follows it (clouds come before the rain, not with it) */ bulut: number;
  /** 0..1 ramp in/out of the current weather window */ k: number;
  season: HavaSeason; date: YMD; dateText: string;
  market: { today: boolean; open: boolean };
  umbrellas: number; tables: number;
  fly: FlyUmbrella | null;
}
export interface HavaMods { /** BUF-24: Cumartesi / Pazar (oyun takvimi) */ weekend(): boolean; arrival(): number; pref(p: ProductId): number; sitOk(): boolean; eatX(): number; tipX(): number; skipFerry(): boolean }
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

/** ZMN-02: weather windows end before the next 08:00 */
const HAVA_SON = 31.8;
/** ZMN-02 game calendar, pure (also read by customers / yiyecek / koleksiyon / dekor so every season agrees). null before the first anchor. */
export function oyunTarihi(st: { zones?: unknown; day?: number; calendar?: string }): YMD | null {
  const h = (st.zones as Record<string, Partial<HavaSave>> | undefined)?.[HAVA_KEY];
  const a = parseYMD(h?.anchorDate || '') || parseYMD(st.calendar || '');
  if (!a) return null;
  const day = Number(st.day) || 1, ad = h?.anchorDate ? Number(h.anchorDay) || day : day;
  const step = h?.tv === 2 || !h?.anchorDate ? TAKVIM_ADIM : 1;
  return civilFromDays(daysFromCivil(a.y, a.m, a.d) + (day - ad) * step);
}
/** game weekday 0 = Pazar: moves one day per game day (weekends and the Saturday Gece Pazarı keep their rhythm) */
export function oyunHaftaGunu(st: { zones?: unknown; day?: number; calendar?: string }): number {
  const h = (st.zones as Record<string, Partial<HavaSave>> | undefined)?.[HAVA_KEY];
  const a = parseYMD(h?.anchorDate || '') || parseYMD(st.calendar || '') || { y: 2026, m: 6, d: 1 };
  const day = Number(st.day) || 1, ad = h?.anchorDate ? Number(h.anchorDay) || day : day;
  return (((weekday(a) + day - ad) % 7) + 7) % 7;
}
/** game calendar as 'YYYY-MM-DD' (falls back to the real date string) */
export const oyunTakvim = (st: { zones?: unknown; day?: number; calendar?: string }): string => { const v = oyunTarihi(st); return v ? ymdStr(v) : String(st.calendar || ''); };
/** weather weights with the neighbour season blended in over the edge quarters (max 50/50 right at the edge) */
const SIRA: HavaSeason[] = ['ilkbahar', 'yaz', 'sonbahar', 'kis'];
export function havaAgirlik(v: YMD): Partial<Record<HavaKind, number>> {
  const ss = seasonOfMonth(v.m), i = SIRA.indexOf(ss);
  const t = ((((v.m - 3) % 3) + 3) % 3 + (v.d - 1) / 31) / 3;   // 0..1 through the season
  const nb = t > 0.75 ? SIRA[(i + 1) % 4] : t < 0.25 ? SIRA[(i + 3) % 4] : null, x = nb ? (t > 0.75 ? (t - 0.75) * 2 : (0.25 - t) * 2) : 0;
  const a = HAVA_WEIGHTS[ss], b = nb ? HAVA_WEIGHTS[nb] : {}, o: Partial<Record<HavaKind, number>> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)]) as Set<HavaKind>) o[k] = (a[k] || 0) * (1 - x) + (b[k] || 0) * x;
  return o;
}

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
    if (!h.mkt || typeof h.mkt !== 'object') h.mkt = { day: 0, sold: 0, earned: 0, open: false, closed: false };
    h.caught = Number(h.caught) || 0; h.skipDay = Number(h.skipDay) || 0;
    // ZMN-02 migration: an old save keeps today's date and weekday, from here on a game day is a week
    if (h.tv !== 2) {
      const a = parseYMD(h.anchorDate);
      if (a) { const cur = civilFromDays(daysFromCivil(a.y, a.m, a.d) + (st.day - (h.anchorDay || st.day))); h.anchorDate = ymdStr(cur); h.anchorDay = st.day; }
      h.tv = 2;
    }
    return h;
  };

  // ───────── calendar ─────────
  function syncAnchor(): void {
    const h = H(), st = S();
    if (h.anchorDate) return;   // ZMN-02: the real date only places a new save; the game calendar runs on its own after that
    const real = parseYMD(st.calendar);
    h.anchorDate = real ? ymdStr(real) : '2026-06-01'; h.anchorDay = st.day;
  }
  const date = (): YMD => oyunTarihi(S()) || { y: 2026, m: 6, d: 1 };
  const wday = (): number => oyunHaftaGunu(S());
  const season = () => seasonOfMonth(date().m);
  const marketDay = () => wday() === MARKET.weekday;
  const priceX = () => HAVA_PRICE_X * Math.sqrt(Math.max(1, K.venueMult()));

  // ───────── weather ─────────
  function rollDay(): void {
    const h = H(), st = S();
    h.wDay = st.day; h.segs = [];
    // fixed per seed + day, so a reload rolls the same day
    const r = { v: hashStr(st.seed + ':' + st.day) };
    const rnd = () => { r.v = (Math.imul(r.v ^ (r.v >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (r.v >>> 8) / 16777216; };
    const w = havaAgirlik(date());
    if (st.day <= 2) return; // first days stay sunny (tutorial)
    let tot = 0; for (const k in w) tot += w[k as HavaKind] || 0;
    let x = rnd() * tot, kind: HavaKind = 'acik';
    for (const k in w) { x -= w[k as HavaKind] || 0; if (x <= 0) { kind = k as HavaKind; break; } }
    const win = HAVA_WINDOW[kind];
    if (kind === 'acik' || !win) return;
    // ZMN-02: windows cover the whole 24 h day (night rain, dawn fog) and end before 08:00 next morning
    const a = win[0] + rnd() * (win[1] - win[0]), b = Math.min(HAVA_SON, a + win[2] + rnd() * (win[3] - win[2]));
    h.segs.push({ k: kind, a, b });
    if (kind === 'saganak' && b > 8.5 && b < 18.5) h.segs.push({ k: 'gokkusagi', a: b, b: b + RAINBOW_H });   // a rainbow needs the sun up
  }
  function seg(): Seg | null { const hr = K.hour(); return H().segs.find(s => hr >= s.a && hr < s.b) || null; }
  const kind = (): HavaKind => seg()?.k ?? 'acik';
  const ramp = (): number => { const s = seg(); return s ? rampOf(s, K.hour()) : 0; };
  /** clouds gather over the hour before a grey window (rain, snow, storm, fog) and stay through it */
  const bulut = (): number => {
    const hr = K.hour(); let v = 0;
    for (const s of H().segs) {
      if (s.k === 'gokkusagi' || s.k === 'sicak') continue;
      const mid = (s.a + s.b) / 2;
      if (hr >= s.a && hr < s.b) v = Math.max(v, hr < mid ? 1 : rampOf(s, hr));
      else if (hr < s.a && s.a - hr < 1) v = Math.max(v, smooth(1 - (s.a - hr)));
    }
    return v;
  };

  // ───────── mods (customers.ts, ferry.ts) ─────────
  const tablesN = () => K.tablesBuilt();
  const umbN = () => Math.min(H().umb, tablesN());
  const mods: HavaMods = {
    weekend() { const w = wday(); return w === 0 || w === 6; },
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
    if (s0) K.toast(HAVA_KINDS[s0.k].icon + ' Bugün ' + HAVA_KINDS[s0.k].name.toLocaleLowerCase('tr') + ' bekleniyor, saat ' + (Math.floor(s0.a) % 24) + ' gibi.', 'info');
    if (marketDay()) { h.mkt = { day: S().day, sold: 0, earned: 0, open: false, closed: false }; K.toast(MARKET_LINES.morning, 'info'); }
    K.saveNow();
  }

  // ───────── Gece Pazarı ─────────
  let sellT = 3;
  function updateMarket(dt: number): void {
    const h = H(), m = h.mkt;
    if (!marketDay() || m.day !== S().day || m.closed) return;
    const hr = K.hour();
    if (hr < MARKET.fromH) return;
    if (!m.open) { m.open = true; K.toast(MARKET_LINES.open, 'good'); K.logEv('havaMarket', { open: true }); }
    if (hr >= 23.85) {
      m.closed = true;
      K.toast(MARKET_LINES.close.replace('{n}', String(m.sold)).replace('{money}', fmtMoney(m.earned)), 'good'); K.saveNow();
      return;
    }
    sellT -= dt; if (sellT > 0) return;
    sellT = rng.range(MARKET.sellEvery[0], MARKET.sellEvery[1]) / (1 + 0.15 * (S().stage - 1));
    const it = rng.pick(MARKET.items);
    const v = Math.round((it.price - it.cost) * priceX());
    K.earn(v); m.sold++; m.earned += v;
  }

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
    return false;
  }

  // ───────── views and panel ─────────
  const ayText = (v: YMD = date()) => MONTHS[v.m - 1] + ' ' + Math.ceil(v.d / 7) + '. hafta';
  function dateText(v: YMD = date()): string { return ayText(v) + ', ' + WEEKDAYS[wday()]; }
  function view(): HavaView {
    const v = date(), kd = HAVA_KINDS[kind()], m = H().mkt;
    return {
      kind: kd.id, name: kd.name, icon: kd.icon, ayText: ayText(v), gunText: WEEKDAYS[wday()], bulut: bulut(), k: ramp(), season: seasonOfMonth(v.m), date: v, dateText: dateText(v),
      market: { today: marketDay(), open: marketDay() && m.open && !m.closed },
      umbrellas: umbN(), tables: tablesN(), fly,
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
    const mDays = (MARKET.weekday - wday() + 7) % 7;
    return {
      dateText: dateText(v), season: SEASON_NAMES[ss], seasonId: ss,
      weather: { id: kd.id, name: kd.name, icon: kd.icon, effect: effectText(kd.id), on: ramp() > 0.05 },
      today: h.segs.map(s => ({ name: HAVA_KINDS[s.k].name, icon: HAVA_KINDS[s.k].icon, from: Math.floor(s.a) % 24, to: Math.ceil(s.b) % 24 || 24 })),
      umbrella: { n: h.umb, max: UMBRELLA.max, tables: tablesN(), cost: h.umb < UMBRELLA.max ? UMBRELLA.cost(h.umb) : 0, money: st.money },
      market: {
        today: marketDay(), days: mDays, open: marketDay() && h.mkt.open && !h.mkt.closed, closed: marketDay() && h.mkt.closed, sold: h.mkt.sold, earned: h.mkt.earned,
        items: MARKET.items.map(i => ({ id: i.id, name: i.name, color: i.color, net: Math.round((i.price - i.cost) * px) })),
      },
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
/** DNY-19: o saatin havası, kayıttan saf okuma (sokak vatandaşları için; installHava ile aynı segment ve rampa formülü).
 *  Sağanak/kar/fırtına `wet` (rampa 0,3 üstü), kar ayrıca `kar`, sıcak `sicak`. Hava kurulmamışsa açık. */
export function havaSokak(state: { zones?: unknown; day?: number }, hour: number): { kind: HavaKind; k: number; wet: boolean; kar: boolean; sicak: boolean } {
  const h = (state.zones as Record<string, { segs?: Seg[]; wDay?: number }> | undefined)?.[HAVA_KEY];
  const s = h && Array.isArray(h.segs) && (h.wDay === undefined || h.wDay === state.day) ? h.segs.find(g => hour >= g.a && hour < g.b) : undefined;
  if (!s) return { kind: 'acik', k: 0, wet: false, kar: false, sicak: false };
  const k = rampOf(s, hour);
  return { kind: s.k, k, wet: !!HAVA_KINDS[s.k]?.wet && k >= 0.3, kar: s.k === 'kar' && k > 0.05, sicak: s.k === 'sicak' && k > 0.05 };
}
