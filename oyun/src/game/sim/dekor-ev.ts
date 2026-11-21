/**
 * Dekor 2.0 + Sabri'nin Evi (survey dekor-1..14, ev-1..9). Pure sim module: no three, no DOM, no wall clock;
 * randomness from the seeded stream 'sim.dekor'. Installed by rules.ts; commands arrive as { kind: 'dekor2', arg: 'op|a|b' }.
 *
 * Persistent data lives in `state.zones._dekor` and `state.zones._ev` (GameState.zones is a free per-zone bag, so no
 * schema bump; defaults are filled on read, old saves load as-is). Paint and 45° rotation ride on DecorSlotSave
 * (`paint`, `rotY`, already in the schema). Sign extras live in `_dekor.sign` (saveSign rewrites state.sign).
 *
 * Effects (all small, capped):
 * - Theme set tamam (4 placed of one set): extra tip on each sale (+3..5 %, cap 8 %), and the set's "set sever müdavim"
 *   drops by now and then: a waiting/seated customer says their line, tip, sometimes a gift item (müdavim hediyesi).
 * - Photo spots: customers pose in front of photo items (selfie event, +1 parça for Usta Atölyesi, tiny tip).
 * - A customer names a favourite placed item in a bubble. Lit decor at night draws passers-by (tiny tip + toast).
 * - Home: rest points of placed furniture -> rt.restBoost in the morning (08-11), cap 8 % (read by stations.ts).
 * UI state (tab, filters, selected slot, undo/redo, home open) is runtime only.
 */
import type { Kernel } from './state';
import type { DecorSlotSave } from './schema';
import { decorById } from '../../content/economy';
import {
  DECOR_EXTRA, DEKOR_CATS, BASE_CAT, PHOTO_BASE, LIGHT_BASE, THEME_SETS, SET_NEED, PAINT_MATERIALS, PAINT_COLORS, PAINT_PATTERNS, PAINT_SHAPES,
  SIGN_SLOGANS, SIGN_EMBLEMS, SIGN_FRAMES, SIGN_TEXT_COLORS, SIGN_BG_COLORS, seasonFor, PHOTO_LINES, LIGHT_LINES, extraById,
  HOME_AREAS, HOME_ITEMS, HOME_THEMES, HOME_REST, HOME_LINES, homeItemById, type DecorX,
} from '../../content/dekor-katalog';
import { fmtMoney } from './util';

export interface DekorData {
  season: boolean; layouts: (DecorSlotSave[] | null)[]; parca: number; lovers: Record<string, number>; photos: number;
  sign: { slogan: number; emblem: string; frame: string; text: string; bg: string }; before: number | null;
}
export interface EvData { areas: string[]; owned: Record<string, number>; placed: Record<string, string[]>; theme: string; visits: number }
export interface DekorEvApi {
  handle(arg: string): void;
  /** Selects a slot (used right after a shop purchase so the paint card opens on the new item). */
  select(i: number): void;
  model(): Record<string, unknown>;
  /** View reads these (never writes). */
  readonly evOpen: boolean; readonly evArea: string;
  data(): DekorData; ev(): EvData;
  completeSets(): string[];
}

const TAU = Math.PI * 2, STEP = Math.PI / 4;

export function installDekorEv(K: Kernel): DekorEvApi {
  const rt = K.rt;
  const rng = K.rng('sim.dekor');
  const ui = { tab: 'katalog', cat: 'hepsi', set: 'hepsi', sel: -1, evOpen: false, evArea: 'oda' };
  const undo: string[] = [], redo: string[] = [];
  let lastLayout = '', restoring = false;
  const timers = { lover: 90, photo: 60, fav: 45, light: 80, sec: 0 };

  const S = () => K.state;
  const zones = () => (S().zones || (S().zones = {})) as Record<string, Record<string, unknown>>;
  function data(): DekorData {
    const z = zones(); const d = (z._dekor || (z._dekor = {})) as unknown as Partial<DekorData>;
    if (typeof d.season !== 'boolean') d.season = true;
    if (!Array.isArray(d.layouts)) d.layouts = [null, null, null];
    if (typeof d.parca !== 'number') d.parca = 0;
    if (!d.lovers || typeof d.lovers !== 'object') d.lovers = {};
    if (typeof d.photos !== 'number') d.photos = 0;
    if (!d.sign || typeof d.sign !== 'object') d.sign = { slogan: 0, emblem: 'yok', frame: 'yok', text: 'kendi', bg: 'kendi' };
    if (d.before === undefined) d.before = null;
    return d as DekorData;
  }
  function ev(): EvData {
    const z = zones(); const e = (z._ev || (z._ev = {})) as unknown as Partial<EvData>;
    if (!Array.isArray(e.areas) || !e.areas.length) e.areas = ['oda'];
    if (!e.owned || typeof e.owned !== 'object') e.owned = {};
    if (!e.placed || typeof e.placed !== 'object') e.placed = {};
    if (typeof e.theme !== 'string') e.theme = 'yok';
    if (typeof e.visits !== 'number') e.visits = 0;
    return e as EvData;
  }

  const placedIds = () => S().decorSlots.map(d => d.item);
  const xOf = (id: string): DecorX | undefined => extraById(id);
  const catOf = (id: string): string => xOf(id)?.cat || BASE_CAT[id] || 'tema';
  const isPhoto = (id: string) => !!xOf(id)?.photo || PHOTO_BASE.includes(id);
  const isLight = (id: string) => !!xOf(id)?.light || LIGHT_BASE.includes(id);
  function completeSets(): string[] {
    const n: Record<string, number> = {};
    for (const id of placedIds()) { const d = decorById(id); if (d && d.set !== 'genel') n[d.set] = (n[d.set] || 0) + 1; }
    return THEME_SETS.filter(s => (n[s.id] || 0) >= s.need).map(s => s.id);
  }
  const setTip = () => Math.min(0.08, completeSets().reduce((a, id) => a + (THEME_SETS.find(s => s.id === id)?.bonusTip || 0), 0));

  // ── layout history (unlimited undo within the session, capped at 60 steps) ──
  const snap = () => JSON.stringify(S().decorSlots);
  function track(): void {
    const now = snap();
    if (now === lastLayout) return;
    if (!restoring && lastLayout) { undo.push(lastLayout); if (undo.length > 60) undo.shift(); redo.length = 0; }
    restoring = false; lastLayout = now;
  }
  function applyLayout(json: string): void {
    const owned: Record<string, number> = {};
    S().decorOwned.forEach(id => { owned[id] = (owned[id] || 0) + 1; });
    const want = JSON.parse(json) as DecorSlotSave[];
    const out: DecorSlotSave[] = [];
    for (const d of want) {
      if (!rt.layout.slots[+d.slot] || !(owned[d.item] > 0)) continue;
      owned[d.item]--; out.push(d);
    }
    S().decorSlots = out; K.refreshSiklik(); K.saveNow();
  }
  const slotEntry = (i: number) => S().decorSlots.find(d => d.slot === String(i)) || null;

  // ── commands ──
  /** Later repaints cost a fee (about 8 % of the item price, at least 150 ₺); the first one after buying is free. */
  function repaintFee(item: string): number {
    const e = S().decorSlots.find(d => d.item === item); if (!e) return 0;
    if (!(+(e.paintN || 0) > 0)) return 0;
    return Math.max(150, Math.round((decorById(item)?.price || 0) * 0.08));
  }
  function chargeRepaint(fee: number): boolean {
    if (S().money < fee) { K.toast('Boyamak için ' + fee + ' ₺ lazım.', 'bad'); return false; }
    K.spend(fee); return true;
  }

  function handle(arg: string): void {
    const [op, a = '', b = '', c = ''] = String(arg || '').split('|');
    const D = data(), E = ev();
    switch (op) {
      case 'tab': ui.tab = a || 'katalog'; return;
      case 'cat': ui.cat = a || 'hepsi'; return;
      case 'set': ui.set = a || 'hepsi'; return;
      case 'sel': ui.sel = Number(a); return;
      case 'buyGold': {
        const d = xOf(a); if (!d || !d.gold) return;
        if (S().gold < d.gold) { K.toast('Altın Simit yetmiyor: ' + d.gold + ' lazım.', 'bad'); return; }
        S().gold -= d.gold; S().decorOwned.push(a); K.toast(d.name + ' vitrinden geldi!', 'good'); K.command({ kind: 'decorPlace', id: a }); K.saveNow(); return;
      }
      case 'craft': {
        const d = xOf(a); if (!d || !d.workshop) return;
        if (D.parca < d.workshop) { K.toast('Parça yetmiyor: ' + d.workshop + ' lazım. Fotoğraf köşeleri parça getirir.', 'bad'); return; }
        D.parca -= d.workshop; S().decorOwned.push(a); K.toast('Usta Atölyesi: ' + d.name + ' hazır! Tornavida bile gülümsedi.', 'good'); K.command({ kind: 'decorPlace', id: a }); K.saveNow(); return;
      }
      case 'rot': {
        const e = slotEntry(Number(a)); if (!e) return;
        e.rotY = (((+(e.rotY || 0) || 0) + STEP) % TAU + TAU) % TAU; if (Math.abs(e.rotY - TAU) < 1e-3 || e.rotY < 1e-3) e.rotY = 0;
        K.saveNow(); return;
      }
      case 'paint': {
        const e = slotEntry(Number(a)); if (!e) return;
        const p = { material: 'dogal', color: 'yok', pattern: 'duz', shape: 'orijinal', ...(e.paint || {}) };
        let changed = false;
        if (b === 'material' && PAINT_MATERIALS.some(m => m.id === c)) { changed = p.material !== c; p.material = c; }
        else if (b === 'color' && PAINT_COLORS.some(m => m.id === c)) { changed = p.color !== c; p.color = c; }
        else if (b === 'pattern' && PAINT_PATTERNS.some(m => m.id === c)) { changed = p.pattern !== c; p.pattern = c; }
        else if (b === 'shape' && PAINT_SHAPES.some(m => m.id === c)) { changed = p.shape !== c; p.shape = c; }
        else if (b === 'reset') { if (!e.paint) return; const fee = repaintFee(e.item); if (fee && !chargeRepaint(fee)) return; delete e.paint; e.paintN = (+(e.paintN || 0) || 0) + 1; K.saveNow(); return; }
        if (!changed) return;
        // Faz 2 (dekor-shape): the first change right after the purchase is free; later changes cost a fee
        const fee = repaintFee(e.item);
        if (fee && !chargeRepaint(fee)) return;
        e.paintN = (+(e.paintN || 0) || 0) + 1;
        e.paint = p; K.saveNow(); return;
      }
      case 'undo': if (!undo.length) { K.toast('Geri alınacak bir şey yok.', 'info'); return; } redo.push(snap()); restoring = true; applyLayout(undo.pop()!); lastLayout = snap(); restoring = false; return;
      case 'redo': if (!redo.length) { K.toast('İleri alınacak bir şey yok.', 'info'); return; } undo.push(snap()); restoring = true; applyLayout(redo.pop()!); lastLayout = snap(); restoring = false; return;
      case 'saveLayout': { const n = Number(a); if (n < 0 || n > 2) return; D.layouts[n] = JSON.parse(snap()); K.toast('Düzen ' + (n + 1) + ' kaydedildi.', 'good'); K.saveNow(); return; }
      case 'loadLayout': { const n = Number(a), l = D.layouts[n]; if (!l) { K.toast('Bu yuva boş.', 'info'); return; } applyLayout(JSON.stringify(l)); K.toast('Düzen ' + (n + 1) + ' yerleştirildi.', 'good'); return; }
      case 'before': D.before = rt.siklik || 0; K.toast('Önce fotoğrafı çekildi: Şıklık ' + D.before + '. Şimdi düzenle, sonra bak!', 'info'); K.saveNow(); return;
      case 'season': D.season = !D.season; K.toast(D.season ? 'Mevsim süsleri açık.' : 'Mevsim süsleri kapandı.', 'info'); K.saveNow(); return;
      case 'sign': {
        const sg = D.sign;
        if (a === 'slogan') sg.slogan = Math.max(0, Math.min(SIGN_SLOGANS.length - 1, Number(b) || 0));
        else if (a === 'emblem' && SIGN_EMBLEMS.some(x => x.id === b)) sg.emblem = b;
        else if (a === 'frame' && SIGN_FRAMES.some(x => x.id === b)) sg.frame = b;
        else if (a === 'text' && SIGN_TEXT_COLORS.some(x => x.id === b)) sg.text = b;
        else if (a === 'bg' && SIGN_BG_COLORS.some(x => x.id === b)) sg.bg = b;
        K.logEv('sign', { text: String((S().sign as { text?: string } | null)?.text || '') }); K.saveNow(); return;
      }
      // ── home ──
      case 'evOpen': ui.evOpen = true; rt.panel = null; E.visits++; K.toast(HOME_LINES.enter[E.visits % HOME_LINES.enter.length], 'good'); return;
      case 'evClose': ui.evOpen = false; return;
      case 'evArea': if (E.areas.includes(a)) ui.evArea = a; return;
      case 'evBuyArea': {
        const ar = HOME_AREAS.find(x => x.id === a); if (!ar || E.areas.includes(a)) return;
        if (S().money < ar.price) { K.toast('Para yetmiyor abi: ' + fmtMoney(ar.price), 'bad'); return; }
        K.spend(ar.price); E.areas.push(a); ui.evArea = a; K.toast(HOME_LINES.buyArea.replace('{area}', ar.name), 'good'); K.saveNow(); return;
      }
      case 'evBuy': {
        const it = homeItemById(a); if (!it) return;
        if (it.gold) { if (S().gold < it.gold) { K.toast('Altın Simit yetmiyor: ' + it.gold + ' lazım.', 'bad'); return; } S().gold -= it.gold; }
        else { if (S().money < it.price) { K.toast('Para yetmiyor abi: ' + fmtMoney(it.price), 'bad'); return; } K.spend(it.price); }
        E.owned[a] = (E.owned[a] || 0) + 1; K.toast(it.name + ' eve geldi!', 'good');
        placeHome(a, true); K.saveNow(); return;
      }
      case 'evPlace': placeHome(a, false); K.saveNow(); return;
      case 'evRemove': { const l = E.placed[a]; const i = Number(b); if (l && i >= 0 && i < l.length) { l.splice(i, 1); K.saveNow(); } return; }
      case 'evTheme': if (HOME_THEMES.some(t => t.id === a)) { E.theme = a; K.saveNow(); } return;
    }
  }
  function placeHome(id: string, quiet: boolean): void {
    const E = ev(), it = homeItemById(id); if (!it) return;
    const areaId = it.area === '*' ? ui.evArea : it.area;
    const ar = HOME_AREAS.find(x => x.id === areaId);
    if (!ar || !E.areas.includes(areaId)) { if (!quiet) K.toast('Önce ' + (ar ? ar.name : 'o alanı') + ' aç.', 'info'); return; }
    const placedN = Object.values(E.placed).reduce((n, l) => n + l.filter(x => x === id).length, 0);
    if ((E.owned[id] || 0) <= placedN) return;
    const l = E.placed[areaId] || (E.placed[areaId] = []);
    if (l.length >= ar.slots) { if (!quiet) K.toast(ar.name + ' dolu. Bir eşyayı kaldır.', 'info'); return; }
    l.push(id);
  }
  function restPoints(): number {
    const E = ev(); let p = 0;
    for (const l of Object.values(E.placed)) for (const id of l) p += homeItemById(id)?.rest || 0;
    const th = HOME_THEMES.find(t => t.id === E.theme);
    if (th && th.key && Object.values(E.placed).some(l => l.includes(th.key))) p += 2;
    return p;
  }

  // ── decor moments ──
  const custPick = (states: string[]) => {
    const list = rt.customers.filter(c => states.includes(c.state) && !(c.sayT > 0));
    return list.length ? rng.pick(list) : null;
  };
  const say = (c: { say: string; sayT: number }, t: string, s = 3) => { c.say = t; c.sayT = s; };
  const smallTip = (mul: number) => Math.max(10, Math.round(K.incomePerMin() * mul));
  function step(dt: number): void {
    if (!rt.started || rt.paused) return;
    timers.sec -= dt;
    if (timers.sec <= 0) { timers.sec = 1; track(); }
    // rested Sabri (morning only)
    const h = K.hour();
    const morning = h >= HOME_REST.MORNING_FROM_H && h < HOME_REST.MORNING_TO_H;
    const want = morning ? Math.min(HOME_REST.CAP, restPoints() * HOME_REST.PER_POINT) : 0;
    const r2 = rt as unknown as { restBoost?: number; restToastDay?: number };
    if (want > 0 && !(r2.restBoost! > 0) && r2.restToastDay !== S().day) { r2.restToastDay = S().day; K.toast(HOME_LINES.morning + ' (+%' + Math.round(want * 100) + ')', 'good'); }
    r2.restBoost = want;

    if (!rt.customers.length) return;
    const placed = placedIds();
    if (!placed.length) return;
    const D = data();
    // set lover
    const sets = completeSets();
    timers.lover -= dt;
    if (timers.lover <= 0) {
      timers.lover = rng.range(70, 140);
      if (sets.length) {
        const ts = THEME_SETS.find(s => s.id === rng.pick(sets))!;
        const c = custPick(['eat', 'queue', 'wait', 'toSeat', 'leave']);
        const line = rng.pick(ts.lover.lines);
        if (c) say(c, line, 3.5);
        D.lovers[ts.id] = (D.lovers[ts.id] || 0) + 1;
        const tip = smallTip(0.6); K.earn(tip);
        K.toast(ts.lover.name + ' (' + ts.lover.job + ') ' + ts.name + ' setini gördü, ' + fmtMoney(tip) + ' bahşiş bıraktı!', 'good');
        K.stat('setLover');
        const gift = ts.lover.gift;
        if (D.lovers[ts.id] % 3 === 0 && !S().decorOwned.includes(gift)) {
          S().decorOwned.push(gift); const gd = decorById(gift);
          K.toast('Müdavim hediyesi: ' + ts.lover.name + ' sana "' + (gd ? gd.name : gift) + '" getirdi!', 'good');
        }
        K.saveNow();
      }
    }
    // photo spot
    timers.photo -= dt;
    if (timers.photo <= 0) {
      timers.photo = rng.range(50, 100);
      const spots = placed.filter(isPhoto);
      if (spots.length) {
        const id = rng.pick(spots), d = decorById(id), c = custPick(['eat', 'leave', 'queue']);
        if (c) say(c, rng.pick(['Çiiiz!', 'Bir poz daha!', 'Martıgram\'a atıyorum!', 'Simiiit!']), 2.5);
        D.photos++; D.parca++;
        K.earn(smallTip(0.15));
        K.toast(rng.pick(PHOTO_LINES).replace('{item}', d ? d.name : 'dekor') + ' (+1 parça)', 'good');
        K.bus.emit('selfie', { n: 1 } as never);
      }
    }
    // favourite item bubble
    timers.fav -= dt;
    if (timers.fav <= 0) {
      timers.fav = rng.range(40, 80);
      const favs = placed.map(xOf).filter((d): d is DecorX => !!d && !!d.line);
      const c = custPick(['eat', 'queue']);
      if (favs.length && c) say(c, rng.pick(favs).line!, 3.2);
    }
    // lights at night draw passers-by
    if (h >= 19 || h < 5) {
      timers.light -= dt;
      if (timers.light <= 0) {
        timers.light = rng.range(60, 120);
        const n = placed.filter(isLight).length;
        if (n) { K.earn(smallTip(0.1 * Math.min(3, n))); K.toast(rng.pick(LIGHT_LINES), 'info'); }
      }
    }
    void D.season;
  }
  K.addSystem({ id: 'dekor-ev', order: 21, phase: 'sim', step: ctx => step(ctx.dt) });
  K.bus.on('sale', e => {
    const k = setTip(); if (k <= 0 || !rt.started) return;
    const v = Math.round((e.value || 0) * k); if (v > 0) K.earn(v);
  });

  // ── panel model ──
  function select(i: number): void { ui.sel = i; }

  function model(): Record<string, unknown> {
    const st = S(), D = data(), E = ev();
    const ownedN = (id: string) => st.decorOwned.filter(x => x === id).length;
    const placedN = (id: string) => st.decorSlots.filter(x => x.item === id).length;
    const nset: Record<string, number> = {};
    for (const id of placedIds()) { const d = decorById(id); if (d) nset[d.set] = (nset[d.set] || 0) + 1; }
    const sel = ui.sel >= 0 ? slotEntry(ui.sel) : null;
    const season = seasonFor(st.calendar);
    return {
      tab: ui.tab, cat: ui.cat, setFilter: ui.set, sel: ui.sel, cats: DEKOR_CATS,
      catOf: Object.fromEntries(st.decorOwned.concat(DECOR_EXTRA.map(d => d.id)).map(id => [id, catOf(id)])),
      extra: Object.fromEntries(DECOR_EXTRA.map(d => [d.id, { cat: d.cat, gold: d.gold || 0, workshop: d.workshop || 0, gift: !!d.gift, photo: !!d.photo, light: !!d.light, owned: ownedN(d.id), placed: placedN(d.id) }])),
      gold: st.gold, parca: D.parca, photos: D.photos,
      sets: THEME_SETS.map(s => ({ id: s.id, name: s.name, have: nset[s.id] || 0, need: SET_NEED, done: (nset[s.id] || 0) >= s.need, bonus: '+%' + Math.round(s.bonusTip * 100) + ' bahşiş', lover: s.lover.name, job: s.lover.job, visits: D.lovers[s.id] || 0, gift: decorById(s.lover.gift)?.name || '' })),
      setTip: Math.round(setTip() * 100),
      slots: rt.layout.slots.map((s, i) => { const e = slotEntry(i); return { index: i, size: s.size, item: e ? e.item : null, name: e ? decorById(e.item)?.name || e.item : '', rot: e ? Math.round(((+(e.rotY || 0) || 0) / STEP)) * 45 : 0, paint: e?.paint || null }; }),
      selItem: sel ? { slot: ui.sel, id: sel.item, name: decorById(sel.item)?.name || sel.item, paint: { material: 'dogal', color: 'yok', pattern: 'duz', shape: 'orijinal', ...(sel.paint || {}) }, fee: repaintFee(sel.item), paid: !!(+(sel.paintN || 0) > 0) } : null,
      materials: PAINT_MATERIALS.map(m => ({ id: m.id, name: m.name, tint: m.tint })), colors: PAINT_COLORS, patterns: PAINT_PATTERNS, shapes: PAINT_SHAPES,
      undo: undo.length, redo: redo.length, layouts: D.layouts.map(l => (l ? l.length : -1)), before: D.before, now: rt.siklik || 0,
      season: { on: D.season, name: season ? season.name : 'Bu ara özel süs yok', id: season ? season.id : null, line: season ? season.line : '' },
      sign: { ...D.sign, sloganText: SIGN_SLOGANS[D.sign.slogan] || '' }, slogans: SIGN_SLOGANS, emblems: SIGN_EMBLEMS, frames: SIGN_FRAMES, textColors: SIGN_TEXT_COLORS, bgColors: SIGN_BG_COLORS,
      ev: {
        open: ui.evOpen, area: ui.evArea, areas: HOME_AREAS.map(a => ({ id: a.id, name: a.name, price: a.price, slots: a.slots, open: E.areas.includes(a.id), desc: a.desc, items: (E.placed[a.id] || []).map(id => homeItemById(id)?.name || id) })),
        items: HOME_ITEMS.map(h => { const pl = Object.values(E.placed).reduce((n, l) => n + l.filter(x => x === h.id).length, 0); return { id: h.id, name: h.name, area: h.area, areaName: h.area === '*' ? 'Her yere' : HOME_AREAS.find(a => a.id === h.area)?.name || '', price: h.price, gold: h.gold || 0, rest: h.rest, desc: h.desc, owned: E.owned[h.id] || 0, placed: pl }; }),
        themes: HOME_THEMES.map(t => ({ id: t.id, name: t.name })), theme: E.theme,
        rest: restPoints(), boost: Math.round(Math.min(HOME_REST.CAP, restPoints() * HOME_REST.PER_POINT) * 100), cap: Math.round(HOME_REST.CAP * 100),
      },
    };
  }

  return {
    handle, select, model, data, ev, completeSets,
    get evOpen() { return ui.evOpen; }, get evArea() { return ui.evArea; },
  };
}

/** Views/UI read the installed api from `rt.dekorEv` (set by rules.ts). */
export function dekorEvApi(r: { rt: unknown }): DekorEvApi | null { return ((r.rt as { dekorEv?: DekorEvApi }).dekorEv) || null; }
