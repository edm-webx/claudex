/**
 * Komşu esnaf dostluğu (survey esnaf-1..10, hikaye-2, tarif-3). Pure sim module: no three, no DOM, seeded rng only.
 * - Persistent state lives in GameState.zones['test-sokak'].esnaf (created with defaults, so old saves load).
 * - Friendship points per esnaf -> 5 levels (content DOST_XP). Gains: talk (tap, once a day), gift, shopping,
 *   their büfe visit ("her zamankinden", served through the regulars system), favours, morning shutter greeting,
 *   evening esnaf çayı, refereeing a rivalry.
 * - Büfe visits: one RegularDef per esnaf is appended to content REGULARS at install; its `fromDay` is kept at 1
 *   while the esnaf is at VISIT_LEVEL or higher, else 99999 (the regulars system skips it). Decision: reuse the
 *   existing hand-over flow instead of a second visitor system (one 'npc.regular' interactable at a time).
 * - Supply bonus (tarif-3): on every 'sale' the related esnaf add SUPPLY_PCT[level] (and FRESH_PCT on the day you
 *   shopped from them) of the sale value to the kasa as "taze malzeme" money.
 * - Favours: one open favour at a time, at most 2 offered per game day, kinds rotate (goz, teslim, kedi, mektup).
 * - Commands: { kind: 'esnaf', op, id?, arg? } (ops: open, sel, talk, gift, buy, accept, drop, claim, pick, hakem).
 * - Views/UI read `rt.esnaf` (EsnafApi): panelModel(), komsuSummary(), view().
 */
import type { Rules } from './state';
import type { ProductId } from './schema';
import { ESNAF, placeFronts, streetAnchors } from '../../content/carsi/street';
import {
  DOST_LEVELS, DOST_XP, SUPPLY_PCT, GENERAL_PCT, VISIT_LEVEL, DOST_GAIN, GIFT_COST, BUY_COST, FRESH_PCT, ESNAF_DOST, DOST_IDS,
  FAVOURS, FAVOUR_ORDER, GOZ_SECONDS, LETTER_STEPS, CAT_SPOTS, RIVALRIES, HAKEM_WIN, HAKEM_LOSE, MORNING_H, EVENING_H,
  MORNING_TOAST, CAY_TOAST, GOSSIP, type FavourKind,
} from '../../content/carsi/esnaf-dostluk';
import { REGULARS, type RegularDef } from '../../content/regulars';
import { PRODUCTS } from '../../content/products';

export const ESNAF_ZONE = 'test-sokak';
const STREET_X0 = 62;

interface DostSave { xp: number; talkDay: number; giftDay: number; buyDay: number; freshDay: number; met: number; seen: number }
interface FavourSave { kind: FavourKind; from: string; to: string; spot: number; t: number; picks: number[]; state: 'ask' | 'active' | 'done' }
interface EsnafSave {
  dost: Record<string, DostSave>; fav: FavourSave | null; favDay: number; favToday: number; favN: number;
  morningDay: number; cayDay: number; hakemDay: number; rivalDay: number; rival: number;
}

export interface EsnafView {
  levels: Record<string, number>;
  favFrom: string | null; favAsk: boolean; favDone: boolean;
  teslimTo: string | null;
  cat: { x: number; z: number; name: string } | null;
  rival: { a: string; b: string; lineA: string; lineB: string } | null;
  lines: Record<string, string>;
}
export interface EsnafApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  panelModel(): Record<string, any>;
  komsuSummary(): Record<string, any>;
  view(): EsnafView;
  level(id: string): number;
  /** Supply bonus fraction for a product (tarif-3). */
  supplyPct(p: ProductId): number;
}

const hhmm = (h: number) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return String(hh % 24).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
const orderText = (o: Partial<Record<ProductId, number>>) => (Object.keys(o) as ProductId[]).map(p => (o[p] || 0) + ' ' + PRODUCTS[p].short).join(', ');

export function levelOf(xp: number): number { let l = 1; for (let i = 0; i < DOST_XP.length; i++) if (xp >= DOST_XP[i]) l = i + 1; return l; }

export function installEsnaf(r: Rules): EsnafApi {
  const rng = r.rng('esnaf');
  const placed = placeFronts();
  const anchors = streetAnchors(placed);
  const standOf = (id: string) => { const a = anchors['esnaf.' + id]; return a ? a.pos : { x: 90, z: 9 }; };
  const nameOf = (id: string) => ESNAF.find(e => e.id === id)?.name || id;
  const roleOf = (id: string) => ESNAF.find(e => e.id === id)?.role || '';
  let sel = DOST_IDS[0];
  const lines: Record<string, string> = {};

  function save(): EsnafSave {
    const S = r.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    const z = (S.zones[ESNAF_ZONE] ||= {});
    let e = z.esnaf as EsnafSave | undefined;
    if (!e || typeof e !== 'object') { e = { dost: {}, fav: null, favDay: 0, favToday: 0, favN: 0, morningDay: 0, cayDay: 0, hakemDay: 0, rivalDay: 0, rival: 0 }; z.esnaf = e; }
    if (!e.dost) e.dost = {};
    for (const id of DOST_IDS) e.dost[id] ||= { xp: 0, talkDay: 0, giftDay: 0, buyDay: 0, freshDay: 0, met: 0, seen: 0 };
    return e;
  }
  const lvl = (id: string) => levelOf(save().dost[id]?.xp || 0);

  function gain(id: string, n: number, quiet = false): void {
    const d = save().dost[id]; if (!d || n <= 0) return;
    const before = levelOf(d.xp);
    d.xp += n;
    const after = levelOf(d.xp);
    if (after > before) {
      r.toast(ESNAF_DOST[id].short + ' ile artık ' + DOST_LEVELS[after - 1] + '! Hikayenin ' + after + '. parçası açıldı.', 'good');
      if (after === VISIT_LEVEL) r.toast(ESNAF_DOST[id].short + ' artık büfene uğrayacak: "her zamankinden!"', 'info');
      r.stat('esnafLevel');
    } else if (!quiet) r.toast(ESNAF_DOST[id].short + ': dostluk +' + n, 'info');
  }

  // ───────── büfe visits through the regulars system ─────────
  const visitDefs: RegularDef[] = [];
  for (const id of DOST_IDS) {
    const D = ESNAF_DOST[id], E = ESNAF.find(e => e.id === id);
    const rid = 'esnaf_' + id;
    let def = REGULARS.find(x => x.id === rid);
    if (!def) {
      def = { id: rid, name: E ? E.name : D.short, fromDay: 99999, hour: D.hour, look: { lookType: E ? E.type : 'emekli', lookSeed: E ? E.seed : 7 }, order: D.order as Record<string, number>, likes: [], voice: 100 + id.length * 7, hint: D.visitHint, story: D.visitLines };
      REGULARS.push(def);
    }
    visitDefs.push(def);
  }
  const syncVisits = () => { for (const d of visitDefs) d.fromDay = lvl(d.id.slice(6)) >= VISIT_LEVEL ? 1 : 99999; };

  r.bus.on('regularOk', (data) => {
    const id = String((data as { id?: string }).id || '');
    if (!id.startsWith('esnaf_')) return;
    const eid = id.slice(6);
    if (ESNAF_DOST[eid]) { gain(eid, DOST_GAIN.visit, true); r.toast(ESNAF_DOST[eid].short + ' her zamankini aldı. Dostluk +' + DOST_GAIN.visit, 'good'); }
  });

  // ───────── supply bonus (tarif-3) ─────────
  function supplyPct(p: ProductId): number {
    const e = save(), day = r.state.day;
    let best = 0;
    for (const id of DOST_IDS) {
      const D = ESNAF_DOST[id];
      if (!D.products.includes(p)) continue;
      const d = e.dost[id];
      const v = SUPPLY_PCT[levelOf(d.xp) - 1] + (d.freshDay === day ? FRESH_PCT : 0);
      if (v > best) best = v;
    }
    return best;
  }
  function generalPct(): number {
    const e = save(), day = r.state.day;
    let v = 0;
    for (const id of DOST_IDS) if (!ESNAF_DOST[id].products.length) { const d = e.dost[id]; v += GENERAL_PCT[levelOf(d.xp) - 1] + (d.freshDay === day ? FRESH_PCT / 5 : 0); }
    return v;
  }
  r.bus.on('sale', (data) => {
    const value = Number((data as { value?: number }).value) || 0;
    if (value <= 0) return;
    const prods = r.rt.lastSaleProducts || [];
    let pct = 0;
    for (const p of prods) pct += supplyPct(p);
    if (prods.length) pct /= prods.length;
    pct += generalPct();
    const bonus = Math.round(value * pct);
    if (bonus > 0) { r.moneyApi.addToKasa(bonus); r.stat('tedarikBonus', bonus); }
  });

  // ───────── favours ─────────
  function offerFavour(): void {
    const e = save(), S = r.state;
    if (e.fav) return;
    if (e.favDay !== S.day) { e.favDay = S.day; e.favToday = 0; }
    if (e.favToday >= 2) return;
    const met = DOST_IDS.filter(id => e.dost[id].met);
    const pool = met.length ? met : DOST_IDS;
    const from = rng.pick(pool);
    const kind = FAVOUR_ORDER[e.favN % FAVOUR_ORDER.length];
    const others = DOST_IDS.filter(x => x !== from);
    e.fav = { kind, from, to: rng.pick(others), spot: rng.int(0, CAT_SPOTS.length - 1), t: 0, picks: [], state: 'ask' };
    e.favN++; e.favToday++;
  }
  function favProgress(f: FavourSave): string {
    if (f.state === 'done') return 'Tamam! ' + ESNAF_DOST[f.from].short + '\'e uğra, teşekkürünü al.';
    if (f.state === 'ask') return FAVOURS[f.kind].howTo;
    switch (f.kind) {
      case 'goz': return 'Sokakta bekle: ' + Math.min(GOZ_SECONDS, Math.floor(f.t)) + ' / ' + GOZ_SECONDS + ' sn';
      case 'teslim': return 'Paketi ' + nameOf(f.to) + ' tezgahına götür.';
      case 'kedi': return ESNAF_DOST[f.from].cat + ' en son ' + CAT_SPOTS[f.spot].where + ' görülmüş.';
      case 'mektup': return 'Mektup: ' + f.picks.length + ' / ' + LETTER_STEPS.length + ' cümle';
    }
  }

  // ───────── daily rivalry ─────────
  function rivalToday(): number {
    const e = save();
    if (e.rivalDay !== r.state.day) { e.rivalDay = r.state.day; e.rival = rng.int(0, RIVALRIES.length - 1); }
    return e.rival;
  }

  // ───────── system ─────────
  let acc = 0;
  r.addSystem({
    id: 'esnaf', order: 47, phase: 'sim',
    step(ctx) {
      if (!r.rt.started || r.rt.paused) return;
      acc += ctx.dt;
      if (acc < 0.25) return;
      const dt = acc; acc = 0;
      syncVisits();
      const e = save(), S = r.state, p = r.playerPos, h = r.hour();
      const inStreet = p.x > STREET_X0;
      if (!e.fav && S.playT > 30) offerFavour();
      const f = e.fav;
      if (f && f.state === 'active') {
        if (f.kind === 'goz' && inStreet) { f.t += dt; if (f.t >= GOZ_SECONDS) { f.state = 'done'; r.toast('Dükkan emin ellerde kaldı. ' + ESNAF_DOST[f.from].short + ' dönüyor!', 'good'); } }
        else if (f.kind === 'teslim') { const s = standOf(f.to); if (Math.hypot(p.x - s.x, p.z - (s.z + (s.z > 9 ? -1.4 : 1.4))) < 2.2 || Math.hypot(p.x - s.x, p.z - s.z) < 2.2) { f.state = 'done'; gain(f.to, 3, true); r.toast(nameOf(f.to) + ': "Paket mi? Ooo, sağ olsun!" Dostluk +3', 'good'); } }
        else if (f.kind === 'kedi') { const c = CAT_SPOTS[f.spot]; if (Math.hypot(p.x - c.x, p.z - c.z) < 1.8) { f.state = 'done'; r.toast(ESNAF_DOST[f.from].cat + ' bulundu! Mırr.', 'good'); } }
      }
      if (inStreet) {
        if (h >= MORNING_H[0] && h < MORNING_H[1] && e.morningDay !== S.day) {
          e.morningDay = S.day; for (const id of DOST_IDS) gain(id, DOST_GAIN.morning, true); r.toast(MORNING_TOAST, 'good'); r.stat('kepenkSelam');
        }
        if (h >= EVENING_H[0] && h < EVENING_H[1] && e.cayDay !== S.day) {
          e.cayDay = S.day; for (const id of DOST_IDS) gain(id, DOST_GAIN.cay, true); r.toast(CAY_TOAST, 'good'); r.toast(rng.pick(GOSSIP), 'info'); r.stat('esnafCayi');
        }
      }
    },
  });

  // ───────── commands ─────────
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'esnaf') return false;
    const op = String(c.op || ''), e = save(), S = r.state;
    const id = c.id != null && ESNAF_DOST[String(c.id)] ? String(c.id) : sel;
    const d = e.dost[id], D = ESNAF_DOST[id], L = levelOf(d.xp);
    switch (op) {
      case 'open': case 'talk': {
        sel = id;
        if (!d.met) { d.met = 1; r.toast(nameOf(id) + ' ile tanıştın! Komşu Defteri\'ne eklendi.', 'good'); }
        if (d.talkDay !== S.day) { d.talkDay = S.day; lines[id] = rng.pick(D.talk); gain(id, DOST_GAIN.talk); }
        else lines[id] = rng.pick(D.talk);
        if (op === 'open') { r.rt.boardOpen = false; r.rt.panel = 'esnaf'; }
        return true;
      }
      case 'sel': sel = id; return true;
      case 'gift': {
        if (d.giftDay === S.day) { r.toast('Bugün zaten hediye verdin, yarın yine!', 'info'); return true; }
        const cost = GIFT_COST[L - 1];
        if (S.money < cost) { r.toast('Hediye için kasada ' + cost + ' ₺ olmalı.', 'bad'); return true; }
        S.money -= cost; d.giftDay = S.day; lines[id] = rng.pick(D.giftThanks); gain(id, DOST_GAIN.gift); r.stat('esnafGift');
        return true;
      }
      case 'buy': {
        if (d.buyDay === S.day) { r.toast('Bugünlük alışveriş tamam, malzeme taze taze tezgahta.', 'info'); return true; }
        const cost = BUY_COST[L - 1];
        if (S.money < cost) { r.toast('Alışveriş için kasada ' + cost + ' ₺ olmalı.', 'bad'); return true; }
        S.money -= cost; d.buyDay = S.day; d.freshDay = S.day; lines[id] = D.buyLine; gain(id, DOST_GAIN.buy);
        r.toast('Taze malzeme! Bugün ' + (D.products.length ? D.products.map(p => PRODUCTS[p].short).join(' ve ') : 'bütün satışlar') + ' biraz daha kazandırır.', 'good');
        r.stat('esnafBuy');
        return true;
      }
      case 'accept': {
        const f = e.fav; if (!f || f.state !== 'ask') return true;
        f.state = 'active'; f.t = 0; f.picks = [];
        lines[f.from] = 'Sağ ol komşu, sana güveniyorum!';
        r.toast(FAVOURS[f.kind].title + ': ' + favProgress(f), 'info');
        return true;
      }
      case 'drop': { const f = e.fav; if (f && f.state !== 'done') { e.fav = null; r.toast('Rica sonraya kaldı, dert değil.', 'info'); } return true; }
      case 'pick': {
        const f = e.fav; if (!f || f.kind !== 'mektup' || f.state !== 'active') return true;
        const i = Math.max(0, Math.min(2, Math.round(Number(c.arg ?? c.id) || 0)));
        f.picks.push(i);
        if (f.picks.length >= LETTER_STEPS.length) { f.state = 'done'; r.toast('Mektup yazıldı! Şimdi ' + ESNAF_DOST[f.from].short + '\'e teslim et.', 'good'); }
        return true;
      }
      case 'claim': {
        const f = e.fav; if (!f || f.state !== 'done') return true;
        const F = FAVOURS[f.kind];
        const money = F.money + 15 * levelOf(e.dost[f.from].xp);
        r.earn(money); if (F.gold) S.gold += F.gold;
        lines[f.from] = F.done;
        e.fav = null;
        gain(f.from, DOST_GAIN.favour, true);
        r.toast(F.done + ' +' + money + ' ₺' + (F.gold ? ' +' + F.gold + ' Altın Simit' : '') + ', dostluk +' + DOST_GAIN.favour, 'good');
        r.stat('esnafFavour');
        return true;
      }
      case 'hakem': {
        if (e.hakemDay === S.day) { r.toast('Bugünkü maçın hakemi oldun, yarın yeni atışma!', 'info'); return true; }
        const R = RIVALRIES[rivalToday()];
        const win = String(c.id) === R.b ? R.b : R.a, other = win === R.a ? R.b : R.a;
        e.hakemDay = S.day;
        gain(win, DOST_GAIN.hakemWin, true); gain(other, DOST_GAIN.hakemOther, true);
        lines[win] = rng.pick(HAKEM_WIN); lines[other] = rng.pick(HAKEM_LOSE);
        r.toast('Hakem kararı: ' + ESNAF_DOST[win].short + '! ' + ESNAF_DOST[other].short + ' de güldü, kimse küsmedi.', 'good');
        return true;
      }
    }
    return true;
  }

  // ───────── models ─────────
  function favModel(): Record<string, any> | null {
    const f = save().fav; if (!f) return null;
    const F = FAVOURS[f.kind];
    const step = f.kind === 'mektup' && f.state === 'active' && f.picks.length < LETTER_STEPS.length ? LETTER_STEPS[f.picks.length] : null;
    return {
      kind: f.kind, title: F.title, from: f.from, fromName: nameOf(f.from), ask: F.ask, state: f.state, progress: favProgress(f),
      pct: f.kind === 'goz' ? Math.min(1, f.t / GOZ_SECONDS) : f.kind === 'mektup' ? f.picks.length / LETTER_STEPS.length : f.state === 'done' ? 1 : 0,
      reward: (F.money + 15 * lvl(f.from)) + ' ₺' + (F.gold ? ' + ' + F.gold + ' Altın Simit' : '') + ' + dostluk',
      letter: step ? { prompt: step.prompt, options: step.options } : null,
      letterSoFar: f.kind === 'mektup' ? f.picks.map((p, i) => LETTER_STEPS[i].options[p]) : [],
      toName: f.kind === 'teslim' ? nameOf(f.to) : '',
    };
  }
  function panelModel(): Record<string, any> {
    const e = save(), S = r.state, id = sel, d = e.dost[id], D = ESNAF_DOST[id], L = levelOf(d.xp);
    const R = RIVALRIES[rivalToday()];
    const next = L < 5 ? DOST_XP[L] : DOST_XP[4];
    const base = DOST_XP[L - 1];
    const bonus = D.products.length ? '%' + Math.round(SUPPLY_PCT[L - 1] * 100) + ' tedarik bonusu (' + D.products.map(p => PRODUCTS[p].short).join(', ') + ')' : '%' + (GENERAL_PCT[L - 1] * 100).toFixed(1).replace('.', ',') + ' bütün satışlara';
    d.seen = Math.max(d.seen, L);
    return {
      sel: id, money: S.money,
      list: DOST_IDS.map(x => ({ id: x, short: ESNAF_DOST[x].short, role: roleOf(x), level: lvl(x), met: !!e.dost[x].met, fav: !!(e.fav && e.fav.from === x) })),
      cur: {
        id, name: nameOf(id), role: roleOf(id), level: L, levelName: DOST_LEVELS[L - 1], levels: DOST_LEVELS.slice(),
        pct: L >= 5 ? 1 : (d.xp - base) / Math.max(1, next - base), xpText: L >= 5 ? 'En yüksek seviye: Aile' : (d.xp - base) + ' / ' + (next - base) + ' puan, sonraki: ' + DOST_LEVELS[L],
        perk: D.perk, bonus, line: lines[id] || '',
        talkDone: d.talkDay === S.day,
        gift: D.gift, giftCost: GIFT_COST[L - 1], giftDone: d.giftDay === S.day,
        buy: D.buy, buyCost: BUY_COST[L - 1], buyDone: d.buyDay === S.day,
        visit: { on: L >= VISIT_LEVEL, text: hhmm(D.hour[0]) + ' - ' + hhmm(D.hour[1]) + ' arası büfeye uğrar, ' + orderText(D.order) + ' ister.', need: DOST_LEVELS[VISIT_LEVEL - 1] + ' olunca büfene uğramaya başlar.' },
        story: D.story.map((s, i) => ({ title: s.title, text: i < L ? s.text : '', open: i < L, need: DOST_LEVELS[i] })),
      },
      fav: favModel(),
      rival: { a: R.a, b: R.b, aName: ESNAF_DOST[R.a].short, bName: ESNAF_DOST[R.b].short, lineA: R.lineA, lineB: R.lineB, topic: R.topic, done: e.hakemDay === S.day, here: R.a === id || R.b === id },
    };
  }
  function komsuSummary(): Record<string, any> {
    const e = save();
    return { fav: favModel(), list: DOST_IDS.map(x => ({ id: x, short: ESNAF_DOST[x].short, level: lvl(x), levelName: DOST_LEVELS[lvl(x) - 1], met: !!e.dost[x].met })) };
  }
  function view(): EsnafView {
    const e = save(), f = e.fav, R = RIVALRIES[rivalToday()];
    const levels: Record<string, number> = {};
    for (const id of DOST_IDS) levels[id] = levelOf(e.dost[id].xp);
    return {
      levels, favFrom: f ? f.from : null, favAsk: !!f && f.state === 'ask', favDone: !!f && f.state === 'done',
      teslimTo: f && f.kind === 'teslim' && f.state === 'active' ? f.to : null,
      cat: f && f.kind === 'kedi' && f.state === 'active' ? { x: CAT_SPOTS[f.spot].x, z: CAT_SPOTS[f.spot].z, name: ESNAF_DOST[f.from].cat } : null,
      rival: e.hakemDay === r.state.day ? null : { a: R.a, b: R.b, lineA: R.lineA, lineB: R.lineB },
      lines,
    };
  }

  syncVisits();
  const api: EsnafApi = { handle, panelModel, komsuSummary, view, level: lvl, supplyPct };
  (r.rt as unknown as { esnaf: EsnafApi }).esnaf = api;
  r.addStateView(() => ({ esnaf: Object.fromEntries(DOST_IDS.map(id => [id, lvl(id)])) }));
  return api;
}

/** Read the esnaf API from rules runtime (null before install). */
export function esnafApi(r: { rt: unknown }): EsnafApi | null { return ((r.rt as { esnaf?: EsnafApi }).esnaf) || null; }
/** panelModel('esnaf') helper used by sim/panels.ts. */
export function esnafPanelModel(r: { rt: unknown }): Record<string, any> { const a = esnafApi(r); return a ? a.panelModel() : {}; }
export function komsuSummary(r: { rt: unknown }): Record<string, any> | null { const a = esnafApi(r); return a ? a.komsuSummary() : null; }
