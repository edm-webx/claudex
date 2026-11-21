/**
 * Yiyecek, içecek, tarifler ve markalar (survey yiyecek-1..11, icecek-1..7, icecek-10, tarif-1,2,4,6,7,8, marka-1..7).
 * Pure sim module (no three, no DOM, seeded rng only). Runs as system 'yiyecek' (order 22, after rules and musteri).
 * - Tarifs (content/yiyecek.ts): the six station products stay the economy core; customers ordering a station product
 *   may ask for an unlocked tarif of that station by name ("Bir kokoreç lütfen!"). When that order is served the tarif's
 *   extra (unit price x (x - 1), x2 for 'Duble olsun!') goes to the kasa. Unlocks follow stations, tadilat stages and
 *   station kademe (yiyecek-3), with a toast and a "Yeni" tag in the Tarif Defteri.
 * - Gezgin Aşçı (yiyecek-4/5): every 7 game days a regional recipe is on the menu; learn it for good with money or free
 *   after selling it GEZGIN_FREE_N times that week.
 * - Deney Tezgahı (tarif-8): pick 2-3 ingredients, mix: a matching combination unlocks a secret tarif, anything else
 *   gives a comic line (deterministic per combination, no chance involved). DENEY_FREE per day free, then DENEY_COST.
 * - Freshness line (tarif-4): food on the counter turns stale after STALE_S (sold at STALE_X) and a cat takes it after
 *   CAT_S. Nothing is thrown away.
 * - Çay ustalığı (icecek-1/2): sold çay count raises the demlik level, small extra on çay sales, a taze demleme now
 *   and then (+tips for 20 s).
 * - Anlaşma Masası (marka-5): one brand per category, small extra on that category's sales, name on the kiosk sign.
 *   Changeable once per category per game day. Brand-loyal customers (marka-6) tip more for their brand.
 * - Ads (marka-7): `reklam()` gives the view the weekly poster brand, the ferry ad brand and the signed brands.
 * Persistent state: GameState.zones['yiyecek'].y (created with defaults, so old saves load). Commands:
 * { kind: 'yiyecek', arg: 'op:id' } with ops tab, st, sel, ing, mix, clear, deal, learn.
 */
import type { System } from '../../engine/api';
import type { Kernel, Customer, CustomerState, Item } from './state';
import type { ProductId } from './schema';
import { PRODUCT_IDS, PRODUCTS, STATIONS, price } from '../../content/products';
import { CITIZENS } from '../../content/citizens';
import {
  TARIFLER, TARIF_BY_ID, MENU_TARIFLER, AY_TARIFLER, GEZGIN_ORDER, FAM_LOOKS, TIER_LABELS, TARIF_ASK, DUBLE_ASK, LIKE_W, GEZGIN_W, SEASON_W,
  GEZGIN_LEARN_X, GEZGIN_FREE_N, ASK_LINES, DUBLE_LINE, TARIF_THANKS, STALE_S, CAT_S, STALE_X, STALE_TOAST, CAT_LINES, FRESH_PRODUCTS,
  CAY_USTA, TAZE_DEMLEME_S, TAZE_DEMLEME_TOAST, MALZEMELER, DENEY_TARIFLERI, DENEY_IPUCU, DENEY_FAIL, DENEY_FREE, DENEY_COST, type TarifDef,
} from '../../content/yiyecek';
import {
  MARKALAR, MARKA_BY_ID, MASKOTLAR, KAT_NAMES, DEAL_KATS, dealBrands, DEAL_LEVEL, DEAL_TOAST, LOYAL_CHANCE, LOYAL_KATS, LOYAL_TIP, LOYAL_ASK, LOYAL_YES, LOYAL_NO,
  AD_BRANDS, PANKART, type MarkaKat,
} from '../../content/markalar';

export const YIYECEK_ZONE = 'yiyecek';

interface YSave {
  open: string[]; seen: string[]; sold: Record<string, number>;
  deals: Record<string, string>; dealDay: Record<string, number>;
  learned: string[]; gezWeek: number; gezSold: number; gezToast: number;
  found: string[]; tried: string[]; deneyDay: number; deneyN: number;
  bayat: number; kedi: number;
}
interface Tag { p: ProductId | null; tid: string | null; duble: boolean; brand: string | null; kat: MarkaKat | null; said: boolean; }
interface Seen { st: CustomerState; }
export interface DeneyResult { ok: boolean; text: string; tid: string | null; again: boolean; }
export interface ReklamModel { week: number; poster: string; ferry: string; deals: { id: string; name: string; color: string; ink: string }[]; pankart: string; }
export interface YiyecekApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  model(): Record<string, any>;
  reklam(): ReklamModel;
  /** open + in season tarifs of a station (for other modules / bots) */
  available(p: ProductId): string[];
}

const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const tl = (n: number): string => fmt(n) + ' ₺';
const fill = (s: string, k: string, v: string) => s.split('{' + k + '}').join(v);
const typeName = (id: string) => CITIZENS.find(t => t.id === id)?.name || id;
const MONTHS = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const monthsText = (m?: number[]) => (m && m.length ? MONTHS[m[0]] + ' - ' + MONTHS[m[m.length - 1]] : '');

export function yiyecekApi(r: unknown): YiyecekApi | null {
  return ((r as { rt?: { yiyecek?: YiyecekApi } } | null)?.rt?.yiyecek) ?? null;
}

/** Faz 2 (user items 12/14): Tarif Defteri, Deney Tezgahı, Anlaşma Masası, Gezgin Aşçı and the freshness line are off.
 *  Kept in code (saves stay compatible); new food comes as stands (content/restoran.ts) instead. */
export const YIYECEK_ON = false;

export function installYiyecek(K: Kernel): YiyecekApi {
  const rt = K.rt;
  const rng = K.rng('sim.yiyecek');
  const seen = new Map<number, Seen>();
  const tags = new Map<number, Tag>();
  const born = new WeakMap<Item, number>();
  const stale = new WeakSet<Item>();
  const ui = { tab: 'kademe', st: 'doner' as string, sel: '' as string, picks: [] as string[], last: null as DeneyResult | null };
  let t = 0, tick = 0, staleToastT = -99, demlemeT = 0;

  function save(): YSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    const z = (S.zones[YIYECEK_ZONE] ||= {});
    let y = z.y as YSave | undefined;
    if (!y || typeof y !== 'object') { y = {} as YSave; z.y = y; }
    if (!Array.isArray(y.open)) y.open = [];
    if (!Array.isArray(y.seen)) y.seen = [];
    if (!y.sold || typeof y.sold !== 'object') y.sold = {};
    if (!y.deals || typeof y.deals !== 'object') y.deals = {};
    if (!y.dealDay || typeof y.dealDay !== 'object') y.dealDay = {};
    if (!Array.isArray(y.learned)) y.learned = [];
    if (!Array.isArray(y.found)) y.found = [];
    if (!Array.isArray(y.tried)) y.tried = [];
    for (const k of ['gezWeek', 'gezSold', 'gezToast', 'deneyDay', 'deneyN', 'bayat', 'kedi'] as const) if (typeof y[k] !== 'number' || !isFinite(y[k])) y[k] = k === 'gezWeek' || k === 'gezToast' ? -1 : 0;
    return y;
  }

  // ───────── helpers ─────────
  const month = () => Number((K.state.calendar || '').slice(5, 7)) || 6;
  const inSeason = (d: TarifDef) => !d.months || d.months.includes(month());
  const built = (p: ProductId) => !!rt.stations[p]?.built;
  const unitPrice = (p: ProductId) => price(p, K.state.tiers[p] || 1) * K.venueMult();
  const week = () => Math.floor(Math.max(0, K.state.day - 1) / 7);
  const gezginId = (): string | null => (K.state.day >= 3 ? GEZGIN_ORDER[week() % GEZGIN_ORDER.length] : null);
  const condMet = (d: TarifDef) => built(d.station) && K.state.stage >= (d.open.stage || 1) && (K.state.tiers[d.station] || 1) >= (d.open.tier || 1);
  function isOpen(d: TarifDef): boolean {
    const y = save();
    if (d.how === 'ay') return false;
    if (d.how === 'gezgin') return y.learned.includes(d.id) || gezginId() === d.id;
    if (d.how === 'deney') return y.found.includes(d.id);
    return y.open.includes(d.id);
  }
  const available = (p: ProductId): string[] => (built(p) ? MENU_TARIFLER.filter(d => d.station === p && isOpen(d) && inSeason(d)).map(d => d.id) : []);
  function lockText(d: TarifDef): string {
    if (d.how === 'gezgin') return 'Gezgin Aşçı haftasında gelir, öğrenince kalıcı olur.';
    if (d.how === 'deney') return 'Deney Tezgahında keşfedilir.';
    if (d.how === 'ay') return 'Ay şubesi açılınca.';
    const parts: string[] = [];
    if (!built(d.station)) parts.push(STATIONS[d.station].name + ' kurulunca');
    if ((d.open.stage || 1) > K.state.stage) parts.push((d.open.stage || 1) - 1 + '. tadilattan sonra');
    if ((d.open.tier || 1) > (K.state.tiers[d.station] || 1)) parts.push(STATIONS[d.station].name + ' ' + TIER_LABELS[(d.open.tier || 1) - 1] + ' kademesinde');
    return parts.length ? parts.join(', ') + ' açılır.' : 'Yakında.';
  }

  // ───────── unlocks ─────────
  function syncUnlocks(): void {
    const y = save();
    const fresh: TarifDef[] = [];
    for (const d of MENU_TARIFLER) {
      if (d.how && d.how !== 'temel') continue;
      if (y.open.includes(d.id) || !condMet(d)) continue;
      y.open.push(d.id); fresh.push(d);
    }
    if (!fresh.length) return;
    // the starting tarifs of a station come quietly with it; tadilat / kademe ones get a toast
    const loud = fresh.filter(d => (d.open.stage || 1) > 1 || (d.open.tier || 1) > 1);
    if (loud.length === 1) K.toast('Yeni tarif: ' + loud[0].name + '! Tarif Defterine eklendi.', 'good');
    else if (loud.length > 1) K.toast(loud.length + ' yeni tarif açıldı! Menü > Tarif Defteri.', 'good');
    K.dirty();
  }

  // ───────── customers: tarif asks, duble, brand loyalty ─────────
  function pickTarif(c: Customer, p: ProductId): string | null {
    const ids = available(p);
    if (!ids.length) return null;
    const gz = gezginId(), m = month(), winter = m >= 11 || m <= 3, summer = m >= 5 && m <= 9;
    let sum = 0; const w: number[] = [];
    for (const id of ids) {
      const d = TARIF_BY_ID[id];
      let v = 1;
      if (d.likes.includes(c.typeId)) v *= LIKE_W;
      if (id === gz) v *= GEZGIN_W;
      if ((winter && d.hot) || (summer && d.cold)) v *= SEASON_W;
      w.push(v); sum += v;
    }
    let x = rng.next() * sum;
    for (let i = 0; i < ids.length; i++) { x -= w[i]; if (x <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }
  function tag(c: Customer): Tag {
    const tg: Tag = { p: null, tid: null, duble: false, brand: null, kat: null, said: false };
    const prods = (Object.keys(c.order) as ProductId[]).filter(p => (c.order[p] || 0) > 0);
    for (const p of prods) {
      if (!rng.chance(TARIF_ASK)) continue;
      const tid = pickTarif(c, p);
      if (!tid) continue;
      tg.p = p; tg.tid = tid; tg.duble = !!TARIF_BY_ID[tid].duble && rng.chance(DUBLE_ASK);
      break;
    }
    if (!tg.tid && c.kind === 'q' && rng.chance(LOYAL_CHANCE)) {
      const ks = LOYAL_KATS.filter(k => (c.order[k.product] || 0) > 0);
      if (ks.length) {
        const k = rng.pick(ks), bs = dealBrands(k.kat);
        if (bs.length) {
          // famous (advertised) brands are asked for more often
          let sum = 0; const w = bs.map(b => { const v = b.ad ? 3 : 1; sum += v; return v; });
          let x = rng.next() * sum, pick = bs[0];
          for (let i = 0; i < bs.length; i++) { x -= w[i]; if (x <= 0) { pick = bs[i]; break; } }
          tg.brand = pick.id; tg.kat = k.kat;
        }
      }
    }
    return tg;
  }
  function announce(c: Customer, tg: Tag): void {
    tg.said = true;
    if (tg.tid) { c.say = fill(rng.pick(ASK_LINES), 't', TARIF_BY_ID[tg.tid].name) + (tg.duble ? DUBLE_LINE : ''); c.sayT = 3; }
    else if (tg.brand) { c.say = fill(rng.pick(LOYAL_ASK), 'b', MARKA_BY_ID[tg.brand].name); c.sayT = 3; }
  }
  function served(c: Customer, tg: Tag): void {
    const y = save();
    if (tg.tid && tg.p) {
      const d = TARIF_BY_ID[tg.tid], unit = unitPrice(tg.p);
      const bonus = Math.round(unit * (d.x - 1) + (tg.duble ? unit * d.x : 0));
      if (bonus > 0) K.moneyApi.addToKasa(bonus);
      y.sold[d.id] = (y.sold[d.id] || 0) + 1;
      if (d.id === gezginId() && !y.learned.includes(d.id)) {
        y.gezSold++;
        if (y.gezSold === GEZGIN_FREE_N) K.toast('Gezgin Aşçı: "' + d.name + ' artık senin de tarifin!" Öğrenmek bedava oldu.', 'good');
      }
      K.stat('tarifSatis'); if (tg.duble) K.stat('dubleSatis');
      if (c.sayT <= 0.3 || !c.req) { c.say = rng.pick(TARIF_THANKS); c.sayT = 2.4; }
    } else if (tg.brand && tg.kat) {
      const b = MARKA_BY_ID[tg.brand];
      if (y.deals[tg.kat] === tg.brand) {
        const bonus = Math.max(2, Math.round(c.value * LOYAL_TIP));
        K.moneyApi.addToKasa(bonus);
        c.say = fill(rng.pick(LOYAL_YES), 'b', b.name); c.sayT = 2.6; c.heartT = Math.max(c.heartT || 0, 2.4);
        K.stat('markaSadik');
      } else { c.say = fill(rng.pick(LOYAL_NO), 'b', b.name); c.sayT = 2.4; }
    }
  }

  // ───────── sale extras: deals + çay ustalığı ─────────
  const cayLevel = () => { const n = K.state.stats.sold_cay || 0; let l = 0; CAY_USTA.forEach((u, i) => { if (n >= u.n) l = i; }); return l; };
  K.bus.on('sale', data => {
    const value = Number((data as { value?: number }).value) || 0;
    if (!YIYECEK_ON || value <= 0) return;
    const prods = rt.lastSaleProducts || [];
    const y = save();
    let pct = 0;
    for (const dk of DEAL_KATS) {
      const bid = y.deals[dk.kat]; if (!bid) continue;
      const b = MARKA_BY_ID[bid]; if (!b || b.pct == null) continue;
      if (dk.products === '*' || dk.products.some(p => prods.includes(p))) pct += b.pct;
    }
    if (prods.includes('cay')) pct += CAY_USTA[cayLevel()].pct / Math.max(1, prods.length);
    const bonus = Math.round(value * pct);
    if (bonus > 0) { K.moneyApi.addToKasa(bonus); K.stat('markaBonus', bonus); }
  });

  // ───────── freshness line ─────────
  function freshness(): void {
    const S = K.state;
    for (const p of FRESH_PRODUCTS) {
      const box = rt.counter[p]; if (!box) continue;
      for (let i = box.length - 1; i >= 0; i--) {
        const it = box[i];
        let b = born.get(it);
        if (b == null) { born.set(it, t); continue; }
        const age = t - b;
        if (age > CAT_S) {
          box.splice(i, 1);
          const y = save(); y.kedi++;
          K.toast(fill(rng.pick(CAT_LINES), 'p', PRODUCTS[p].short.toLocaleLowerCase('tr')), 'info');
          K.stat('kediyeBayat');
          const cat = S.cats[0] as { trust?: number } | undefined;
          if (cat) cat.trust = Math.min(100, (cat.trust || 0) + 1);
          K.logEv('catFed' as never, { p } as never);
        } else if (age > STALE_S && !stale.has(it)) {
          stale.add(it); it.priceX = (it.priceX || 1) * STALE_X;
          save().bayat++;
          if (t - staleToastT > 45) { staleToastT = t; K.toast(STALE_TOAST, 'info'); }
        }
      }
    }
  }
  const staleNow = () => { let n = 0; for (const p of FRESH_PRODUCTS) for (const it of rt.counter[p] || []) if (stale.has(it)) n++; return n; };

  // ───────── Gezgin Aşçı week ─────────
  function gezginWeek(): void {
    const y = save(), id = gezginId();
    if (!id) return;
    const w = week();
    if (y.gezWeek !== w) { y.gezWeek = w; y.gezSold = 0; }
    if (y.gezToast !== w && built(TARIF_BY_ID[id].station)) {
      y.gezToast = w;
      const d = TARIF_BY_ID[id];
      K.toast('Gezgin Aşçı geldi! Bu hafta ' + d.region + ' konuk tarifi: ' + d.name + '.', 'good');
    }
  }
  function learnCost(): number { const id = gezginId(); if (!id) return 0; const d = TARIF_BY_ID[id]; return Math.round(price(d.station, K.state.tiers[d.station] || 1) * GEZGIN_LEARN_X); }

  // ───────── Deney Tezgahı ─────────
  function mix(): void {
    const y = save(), S = K.state;
    if (ui.picks.length < 2) { K.toast('En az iki malzeme seç.', 'info'); return; }
    if (y.deneyDay !== S.day) { y.deneyDay = S.day; y.deneyN = 0; }
    const free = y.deneyN < DENEY_FREE;
    if (!free) {
      if (S.money < DENEY_COST) { K.toast('Deney için kasada ' + DENEY_COST + ' ₺ olmalı. Yarın yine bedava!', 'info'); return; }
      K.spend(DENEY_COST);
    }
    y.deneyN++;
    const key = ui.picks.slice().sort().join('+');
    const names = ui.picks.map(id => MALZEMELER.find(m => m.id === id)?.name || id).join(' + ');
    if (!y.tried.includes(key)) { y.tried.push(key); if (y.tried.length > 80) y.tried.shift(); }
    const tid = DENEY_TARIFLERI[key];
    if (tid) {
      const d = TARIF_BY_ID[tid];
      if (y.found.includes(tid)) ui.last = { ok: true, text: d.name + ' zaten defterde. Ellerin ezberlemiş!', tid, again: true };
      else {
        y.found.push(tid);
        ui.last = { ok: true, text: 'Tuttu! Yeni tarif: ' + d.name + '. ' + STATIONS[d.station].name + ' menüsüne eklendi.', tid, again: false };
        K.toast('Deney tuttu! ' + d.name + ' menüde.', 'good'); K.addXP(2); K.stat('deneyOk');
      }
    } else {
      let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      ui.last = { ok: false, text: fill(DENEY_FAIL[h % DENEY_FAIL.length], 'm', names), tid: null, again: false };
      K.stat('deneyFail');
    }
    ui.picks = [];
    K.dirty();
  }

  // ───────── commands ─────────
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'yiyecek') return false;
    const raw = String(c.arg ?? c.op ?? ''), i = raw.indexOf(':');
    const op = i < 0 ? raw : raw.slice(0, i), id = i < 0 ? String(c.id ?? '') : raw.slice(i + 1);
    const y = save(), S = K.state;
    switch (op) {
      case 'tab': ui.tab = ['kademe', 'defter', 'deney', 'anlasma'].includes(id) ? id : 'kademe'; if (ui.tab !== 'deney') ui.last = null; break;
      case 'st': ui.st = id; ui.sel = ''; break;
      case 'sel': ui.sel = ui.sel === id ? '' : id; if (id && !y.seen.includes(id)) y.seen.push(id); break;
      case 'ing': {
        const k = ui.picks.indexOf(id);
        if (k >= 0) ui.picks.splice(k, 1);
        else if (ui.picks.length < 3 && MALZEMELER.some(m => m.id === id)) ui.picks.push(id);
        else if (ui.picks.length >= 3) K.toast('En fazla üç malzeme.', 'info');
        break;
      }
      case 'clear': ui.picks = []; ui.last = null; break;
      case 'mix': mix(); break;
      case 'learn': {
        const gid = gezginId(); if (!gid || y.learned.includes(gid)) break;
        const freeNow = y.gezSold >= GEZGIN_FREE_N, cost = freeNow ? 0 : learnCost();
        if (S.money < cost) { K.toast('Tarifi öğrenmek için kasada ' + tl(cost) + ' olmalı. Ya da ' + GEZGIN_FREE_N + ' tane sat, bedava öğren.', 'info'); break; }
        if (cost) K.spend(cost);
        y.learned.push(gid);
        K.toast(TARIF_BY_ID[gid].name + ' artık kalıcı menüde! Gezgin Aşçı el salladı.', 'good'); K.addXP(2); K.stat('gezginTarif');
        break;
      }
      case 'deal': {
        const b = MARKA_BY_ID[id];
        if (!b || b.pct == null) break;
        if (S.level < DEAL_LEVEL) { K.toast('Anlaşma Masası Seviye ' + DEAL_LEVEL + '\'te açılır.', 'info'); break; }
        if (y.deals[b.kat] === id) break;
        if (y.deals[b.kat] && y.dealDay[b.kat] === S.day) { K.toast(KAT_NAMES[b.kat] + ' anlaşmasını bugün değiştirdin. Yarın tekrar bakarız.', 'info'); break; }
        y.deals[b.kat] = id; y.dealDay[b.kat] = S.day;
        K.toast(fill(DEAL_TOAST, 'b', b.name), 'good'); K.stat('anlasma');
        K.logEv('brandDeal' as never, { id } as never);
        break;
      }
      default: return true;
    }
    K.dirty();
    return true;
  }

  // ───────── panel model ─────────
  function card(d: TarifDef) {
    const y = save(), open = isOpen(d), unit = unitPrice(d.station);
    return {
      id: d.id, name: d.name, veg: !!d.veg, duble: !!d.duble, open, season: open && !inSeason(d), months: monthsText(d.months),
      how: d.how || 'temel', price: Math.round(unit * d.x), plus: Math.round((d.x - 1) * 100), sold: y.sold[d.id] || 0,
      isNew: open && !y.seen.includes(d.id), lock: open ? '' : lockText(d), sel: ui.sel === d.id,
    };
  }
  function detail(d: TarifDef) {
    const looks = FAM_LOOKS[d.fam], tier = K.state.tiers[d.station] || 1;
    return {
      id: d.id, name: d.name, story: d.story, note: d.note, region: d.region || '', brand: d.brand ? MARKA_BY_ID[d.brand]?.name || '' : '',
      looks: TIER_LABELS.map((n, i) => ({ name: n, text: looks[i], on: i + 1 === tier, done: i + 1 < tier })),
      likes: d.likes.map(typeName), station: STATIONS[d.station].name, veg: !!d.veg, duble: !!d.duble, months: monthsText(d.months),
    };
  }
  function model(): Record<string, any> {
    const y = save(), S = K.state;
    const stations = PRODUCT_IDS.map(p => {
      const all = MENU_TARIFLER.filter(d => d.station === p);
      return { id: p, name: STATIONS[p].name, short: PRODUCTS[p].short, open: all.filter(isOpen).length, total: all.length, isNew: all.some(d => isOpen(d) && !y.seen.includes(d.id)), built: built(p) };
    });
    const st = ui.st;
    let list: TarifDef[];
    if (st === 'ay') list = AY_TARIFLER;
    else if (st === 'gezgin') list = MENU_TARIFLER.filter(d => d.how === 'gezgin');
    else list = MENU_TARIFLER.filter(d => d.station === st && d.how !== 'gezgin');
    const sel = ui.sel && TARIF_BY_ID[ui.sel] && list.some(d => d.id === ui.sel) ? detail(TARIF_BY_ID[ui.sel]) : null;
    const gid = gezginId(), gd = gid ? TARIF_BY_ID[gid] : null;
    const cl = cayLevel(), cNext = CAY_USTA[cl + 1];
    const openN = MENU_TARIFLER.filter(isOpen).length;
    const undiscovered = Object.values(DENEY_TARIFLERI).filter(id => !y.found.includes(id));
    if (y.deneyDay !== S.day) { y.deneyDay = S.day; y.deneyN = 0; }
    return {
      tab: ui.tab, st, openN, total: MENU_TARIFLER.length, stations, list: list.map(card), sel,
      gezgin: gd ? {
        id: gd.id, name: gd.name, region: gd.region, station: STATIONS[gd.station].name, story: gd.story, learned: y.learned.includes(gd.id), stationBuilt: built(gd.station),
        cost: y.gezSold >= GEZGIN_FREE_N ? 0 : learnCost(), sold: Math.min(GEZGIN_FREE_N, y.gezSold), need: GEZGIN_FREE_N, daysLeft: 7 - (Math.max(0, S.day - 1) % 7),
      } : { soon: true, from: 3 },
      fresh: { bayat: y.bayat, kedi: y.kedi, now: staleNow(), staleS: STALE_S, catS: CAT_S },
      cay: { name: CAY_USTA[cl].name, line: CAY_USTA[cl].line, level: cl + 1, of: CAY_USTA.length, sold: S.stats.sold_cay || 0, next: cNext ? cNext.n : 0, nextName: cNext ? cNext.name : '', pct: Math.round(CAY_USTA[cl].pct * 100) },
      deney: {
        ings: MALZEMELER.map(m => ({ id: m.id, name: m.name, color: m.color, on: ui.picks.includes(m.id) })), picks: ui.picks.length,
        last: ui.last ? { ...ui.last, name: ui.last.tid ? TARIF_BY_ID[ui.last.tid].name : '' } : null,
        free: Math.max(0, DENEY_FREE - y.deneyN), cost: DENEY_COST, found: y.found.map(id => ({ id, name: TARIF_BY_ID[id]?.name || id })), total: Object.keys(DENEY_TARIFLERI).length,
        hints: undiscovered.slice(0, 2).map(id => DENEY_IPUCU[id] || ''), tried: y.tried.length,
      },
      deal: {
        open: S.level >= DEAL_LEVEL, level: DEAL_LEVEL,
        kats: DEAL_KATS.map(dk => ({
          kat: dk.kat, name: KAT_NAMES[dk.kat], cur: y.deals[dk.kat] || '', curName: y.deals[dk.kat] ? MARKA_BY_ID[y.deals[dk.kat]]?.name || '' : '',
          lockedToday: !!y.deals[dk.kat] && y.dealDay[dk.kat] === S.day,
          what: dk.products === '*' ? 'bütün satışlar' : dk.products.map(p => PRODUCTS[p].short).join(', '),
          brands: dealBrands(dk.kat).map(b => ({ id: b.id, name: b.name, color: b.color, ink: b.ink, slogan: b.slogan, pct: Math.round((b.pct || 0) * 100), maskot: b.maskot || '', famous: !!b.ad, signed: y.deals[dk.kat] === b.id })),
        })),
        maskots: MASKOTLAR.map(m => ({ ...m, brand: MARKALAR.find(b => b.maskot === m.id)?.name || '' })),
        brandN: MARKALAR.length,
      },
      ay: AY_TARIFLER.map(d => ({ id: d.id, name: d.name, story: d.story })),
      money: S.money,
    };
  }

  function reklam(): ReklamModel {
    const S = K.state, y = save(), w = week();
    const poster = AD_BRANDS[w % AD_BRANDS.length];
    const ferry = AD_BRANDS[(S.day * 3 + Math.floor((S.dayT || 0) / 60)) % AD_BRANDS.length];
    const deals = Object.values(y.deals).map(id => MARKA_BY_ID[id]).filter(Boolean).map(b => ({ id: b.id, name: b.name, color: b.color, ink: b.ink }));
    return { week: w, poster, ferry, deals, pankart: PANKART[(S.day + w) % PANKART.length] };
  }

  const sys: System = {
    id: 'yiyecek', order: 22, phase: 'sim',
    step(ctx) {
      if (!YIYECEK_ON || !rt.started || rt.paused) return;
      const dt = ctx.dt;
      t += dt;
      if ((tick -= dt) <= 0) {
        tick = 0.5;
        syncUnlocks(); gezginWeek(); freshness();
        if (built('cay') && cayLevel() >= 1 && (demlemeT += 0.5) >= TAZE_DEMLEME_S) { demlemeT = 0; rt.tipBoostT = Math.max(rt.tipBoostT, 20); K.toast(TAZE_DEMLEME_TOAST, 'good'); }
      }
      for (const c of rt.customers) {
        let s = seen.get(c.id);
        if (!s) { s = { st: c.state }; seen.set(c.id, s); tags.set(c.id, tag(c)); }
        const tg = tags.get(c.id)!;
        const prev = s.st, now = c.state;
        if (!tg.said && (tg.tid || tg.brand) && (now === 'queue' || now === 'wqueue')) announce(c, tg);
        if ((prev === 'queue' || prev === 'wqueue') && (now === 'toSeat' || (now === 'leave' && c.mood !== 'angry')) && c.value > 0) served(c, tg);
        s.st = now;
      }
      if (seen.size > rt.customers.length + 8) {
        const alive = new Set(rt.customers.map(c => c.id));
        for (const id of [...seen.keys()]) if (!alive.has(id)) { seen.delete(id); tags.delete(id); }
      }
    },
  };
  K.addSystem(sys);
  K.addStateView(() => { const y = save(); return { yiyecek: { open: MENU_TARIFLER.filter(isOpen).length, deals: { ...y.deals }, found: y.found.length, gezgin: gezginId(), bayat: y.bayat, kedi: y.kedi } }; });

  const api: YiyecekApi = { handle, model, reklam, available };
  (rt as unknown as { yiyecek?: YiyecekApi }).yiyecek = api;
  void TARIFLER;
  return api;
}

/** Panel model for the Menü sheet (null before the module is installed). */
export function yiyecekPanelModel(r: unknown): Record<string, any> | null {
  const a = yiyecekApi(r);
  try { return a ? a.model() : null; } catch { return null; }
}
