/**
 * Koleksiyonlar + Altın Simit + Altın Fırın sim side (survey koleksiyon-1..8, altin-1..9, marka-8). Pure: no three,
 * no DOM, seeded rng only. Content: src/content/koleksiyon.ts. UI: src/game/ui/koleksiyon-panel.ts (a 'koleksiyon'
 * sheet with tabs, opened from the Görevler panel section and by tapping the Altın Fırın on the pier).
 * Decisions:
 * - Persistent state lives in GameState.zones.koleksiyon (created with defaults, so old saves load).
 * - Sticker packs are earned by playing: every PACK_EVERY_SALES sales, each Sipariş Panosu claim, every level up,
 *   regulars served (1 in 3), and 6 duplicates. Packs are opened in the panel (never bought, never with Altın Simit).
 * - Olta: CASTS_PER_DAY free casts a game day + 1 per docked ferry (stored up to CAST_CAP).
 * - Caps drop on sales (CAP_CHANCE). Rare (shiny / Altın Hamsi / altın kapak) draws use a pity counter per collection.
 * - Postcards: stand still POST_STILL s at a place inside a time window (sabah / gün batımı / gece).
 * - Martıköy Hikayeleri: pages = REGULARS[].story lines unlocked by GameState.regulars[id].visits.
 * - Page complete -> reward once (decor into decorOwned, Altın Simit, next cat into cats, or +1 % sales bonus,
 *   paid as a kasa top-up on each sale like mini.ts does).
 * - Altın Fırın: 4 daily items picked from the pool by day number (no rng state) + fixed golden shelf. Gold is only
 *   spent here; nothing converts gold to ₺. Rewarded "Deneme reklamı" gives AD_GOLD_PER_DAY gold a day.
 * - rt.koleksiyon.lastGain: { n, id } bumps whenever gold is gained in this module (overlay listens to state.gold).
 * - Commands: { kind: 'koleksiyon', op, id?, arg? } ops: open (id = tab), tab, pack, cast, buy, ad, vitrin, seen.
 */
import type { Kernel } from './state';
import { CATS } from '../../content/cats';
import { DECOR } from '../../content/economy';
import { REGULARS } from '../../content/regulars';
import { ACHIEVEMENTS } from '../../content/achievements';
import { PIER } from '../../content/prefabs/iskele/layout';
import {
  STICKER_PAGES, FISH_PAGES, CAP_BRANDS, CAP_KINDS, PLACES, POST_TIMES, POST_STILL, PITY, SHINY_CHANCE, BONUS_PCT, BONUS_CAP,
  PAGE_GOLD, AD_GOLD_PER_DAY, AD_TEXT, PACK_SIZE, PACK_EVERY_SALES, DUPES_PER_PACK, CASTS_PER_DAY, CAST_CAP, CAP_CHANCE,
  FIRIN_LEVEL, FIRIN_SHELF, FIRIN_POOL, FIRIN_KIND_NAME, FIRIN_LINES, GOLD_SOURCES, GOLD_RULES, SEASON_NAME, STICKER_LINES, CAST_LINES,
  type CollPage, type CollItem, type PageReward, type Season, type FirinItem,
} from '../../content/koleksiyon';

interface KolSave {
  st: string[]; shiny: string[]; dupes: number; packs: number; salesN: number; regN: number;
  fish: string[]; casts: number; castDay: number;
  caps: string[]; post: string[]; pages: string[]; bonus: number;
  pity: Record<string, number>; firin: string[]; gifts: number; adDay: number; adUsed: number;
  vitrin: string[]; seenPages: number; goldGot: number;
}
export interface KolReveal { n: number; kind: 'pack' | 'cast'; items: { name: string; color: string; shiny: boolean; isNew: boolean; note?: string }[]; line: string }
export interface KolApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  panelModel(): Record<string, any>;
  summary(): Record<string, any>;
  /** world view: Fırın open?, today's 4 showcase colours, owned golden shelf ids, caps on the board, vitrin medals */
  view(): { open: boolean; showcase: string[]; shelf: string[]; caps: string[]; vitrin: string[] };
  lastReveal(): KolReveal | null;
  tab(): string;
}

function seasonOf(calendar: string, day: number): Season {
  const m = Number(String(calendar || '').slice(5, 7)) || 0;
  if (m) return m === 12 || m <= 2 ? 'kis' : m <= 5 ? 'ilkbahar' : m <= 8 ? 'yaz' : 'sonbahar';
  return (['ilkbahar', 'yaz', 'sonbahar', 'kis'] as Season[])[Math.floor((Math.max(1, day) - 1) / 7) % 4];
}
/** small integer hash for the daily showcase (no rng state) */
function hash(a: number, b: number): number { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }

/** Faz 2 (user items 25/31): the collection layer (sticker packs, kapak, olta, kartpostal toasts) is switched off. */
export const KOLEKSIYON_ON = false;

export function installKoleksiyon(K: Kernel): KolApi {
  const rng = K.rng('koleksiyon');
  const rt = K.rt;
  let reveal: KolReveal | null = null, revealN = 0, tab = 'album';
  let stillAt = 0, postKey = '';

  function save(): KolSave {
    const S = K.state;
    if (!S.zones || typeof S.zones !== 'object') (S as { zones: Record<string, Record<string, unknown>> }).zones = {};
    let m = S.zones.koleksiyon as unknown as KolSave | undefined;
    if (!m || typeof m !== 'object') {
      m = { st: [], shiny: [], dupes: 0, packs: 1, salesN: 0, regN: 0, fish: [], casts: CASTS_PER_DAY, castDay: S.day, caps: [], post: [], pages: [], bonus: 0, pity: {}, firin: [], gifts: 0, adDay: 0, adUsed: 0, vitrin: [], seenPages: 0, goldGot: 0 };
      S.zones.koleksiyon = m as unknown as Record<string, unknown>;
    }
    for (const k of ['st', 'shiny', 'fish', 'caps', 'post', 'pages', 'firin', 'vitrin'] as const) if (!Array.isArray(m[k])) m[k] = [];
    for (const k of ['dupes', 'packs', 'salesN', 'regN', 'casts', 'castDay', 'bonus', 'gifts', 'adDay', 'adUsed', 'seenPages', 'goldGot'] as const) if (typeof m[k] !== 'number' || !isFinite(m[k])) m[k] = 0;
    if (!m.pity || typeof m.pity !== 'object') m.pity = {};
    if (m.castDay !== S.day) { m.castDay = S.day; m.casts = Math.min(CAST_CAP, m.casts + CASTS_PER_DAY); }
    if (m.adDay !== S.day) { m.adDay = S.day; m.adUsed = 0; }
    return m;
  }
  const season = () => seasonOf(K.state.calendar, K.state.day);
  const isNight = () => K.hour() >= 21;
  const firinOpen = () => K.state.level >= FIRIN_LEVEL;

  function gainGold(n: number): void {
    if (n <= 0) return;
    K.state.gold += n; K.state.money += 800 * K.state.stage * n; save().goldGot += n;
  }

  // ── pages ──
  interface PageRef { coll: string; page: CollPage | null; id: string; name: string; have: number; total: number; done: boolean; reward: PageReward; hidden?: boolean }
  function stickerHiddenOpen(m: KolSave): boolean {
    const doneN = STICKER_PAGES.filter(p => !p.hidden && p.items.every(i => m.st.includes(i.id))).length;
    return m.shiny.length >= 3 || doneN >= 4;
  }
  function allPages(m: KolSave): PageRef[] {
    const out: PageRef[] = [];
    for (const p of STICKER_PAGES) { const have = p.items.filter(i => m.st.includes(i.id)).length; out.push({ coll: 'album', page: p, id: p.id, name: p.name, have, total: p.items.length, done: have === p.items.length, reward: p.reward, hidden: !!p.hidden && !stickerHiddenOpen(m) }); }
    for (const p of FISH_PAGES) { const can = p.items.filter(i => !i.locked); const have = can.filter(i => m.fish.includes(i.id)).length; out.push({ coll: 'balik', page: p, id: p.id, name: p.name, have, total: can.length, done: have === can.length, reward: p.reward }); }
    CAP_BRANDS.forEach(b => { const have = CAP_KINDS.filter(k => m.caps.includes(b.id + ':' + k.id)).length; out.push({ coll: 'kapak', page: null, id: 'cap_' + b.id, name: b.name + ' kapakları', have, total: CAP_KINDS.length, done: have === CAP_KINDS.length, reward: { kind: 'decor', ids: [b.decor] } }); });
    const allCaps = CAP_BRANDS.length * CAP_KINDS.length;
    out.push({ coll: 'kapak', page: null, id: 'cap_all', name: 'Kapak panosu tam', have: m.caps.length, total: allCaps, done: m.caps.length >= allCaps, reward: { kind: 'bonus' } });
    for (const pl of PLACES) { if (pl.locked) continue; const have = POST_TIMES.filter(t => m.post.includes(pl.id + ':' + t.id)).length; out.push({ coll: 'kartpostal', page: null, id: 'post_' + pl.id, name: pl.name, have, total: POST_TIMES.length, done: have === POST_TIMES.length, reward: pl.id === 'iskele' ? { kind: 'bonus' } : { kind: 'gold', n: PAGE_GOLD } }); }
    for (const r of REGULARS) { const st = K.state.regulars[r.id] as { visits?: number } | undefined; const total = (r.story || []).length || 1; const have = Math.min(total, st?.visits || 0); out.push({ coll: 'hikaye', page: null, id: 'hik_' + r.id, name: r.name, have, total, done: have >= total, reward: { kind: 'gold', n: PAGE_GOLD } }); }
    return out;
  }
  function rewardText(rw: PageReward): string {
    switch (rw.kind) {
      case 'gold': return '+' + rw.n + ' Altın Simit';
      case 'decor': return rw.ids.map(id => DECOR.find(d => d.id === id)?.name || id).join(', ') + ' (dekor)';
      case 'cat': return 'Yeni bir kedi gelir';
      case 'bonus': return 'Kalıcı satış +%1';
    }
  }
  function pay(rw: PageReward): string {
    const S = K.state, m = save();
    switch (rw.kind) {
      case 'gold': gainGold(rw.n); return '+' + rw.n + ' Altın Simit';
      case 'decor': for (const id of rw.ids) S.decorOwned.push(id); return rewardText(rw) + ' Dekor sekmesinde';
      case 'cat': {
        const has = (id: string) => (S.cats as (string | { id: string })[]).some(c => (typeof c === 'string' ? c === id : c.id === id));
        const c = CATS.find(x => !has(x.id));
        if (c) { (S.cats as unknown[]).push({ id: c.id }); return 'Yeni kedi: ' + c.name + '! Büfeye geliyor'; }
        gainGold(PAGE_GOLD); return 'Bütün kediler zaten burada, +' + PAGE_GOLD + ' Altın Simit';
      }
      case 'bonus': {
        if (m.bonus + BONUS_PCT <= BONUS_CAP + 1e-9) { m.bonus = Math.round((m.bonus + BONUS_PCT) * 100) / 100; return 'Kalıcı satış +%1 (toplam %' + Math.round(m.bonus * 100) + ')'; }
        gainGold(PAGE_GOLD); return '+' + PAGE_GOLD + ' Altın Simit';
      }
    }
  }
  function checkPages(): void {
    const m = save();
    for (const p of allPages(m)) {
      if (!p.done || m.pages.includes(p.id)) continue;
      m.pages.push(p.id);
      const got = pay(p.reward);
      K.toast('Sayfa tamam: ' + p.name + '! ' + got, 'good');
      K.stat('kolPage');
    }
  }

  // ── draws ──
  function rareDraw(key: string): boolean {
    const m = save();
    const n = (m.pity[key] || 0) + 1;
    m.pity[key] = n;
    return n >= PITY;
  }
  function gotRare(key: string): void { save().pity[key] = 0; }
  function drawSticker(): KolReveal['items'][number] {
    const m = save(), sea = season(), night = isNight();
    const hiddenOk = stickerHiddenOpen(m);
    const pool: CollItem[] = [];
    for (const p of STICKER_PAGES) {
      if (p.hidden && (!hiddenOk || !night)) continue;
      for (const it of p.items) { if (it.season && it.season !== sea) continue; pool.push(it); }
    }
    const forced = rareDraw('st');
    let it: CollItem;
    const rares = pool.filter(i => i.rare);
    if (forced && rares.length) it = rng.pick(rares);
    else {
      // missing ones are a bit likelier so the album keeps moving; rare ones are rare
      const w = pool.map(i => (i.rare ? 0.25 : 1) * (m.st.includes(i.id) ? 1 : 1.8));
      let x = rng.next() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && (x -= w[k]) > 0) k++;
      it = pool[k];
    }
    let shiny = rng.chance(SHINY_CHANCE) || (forced && !rares.length);
    if (it.rare || shiny) gotRare('st');
    const isNew = !m.st.includes(it.id);
    if (isNew) m.st.push(it.id); else if (!shiny || m.shiny.includes(it.id)) m.dupes++;
    if (shiny && !m.shiny.includes(it.id)) m.shiny.push(it.id); else shiny = shiny && m.shiny.includes(it.id);
    return { name: it.name + (shiny ? ' (parıltılı)' : ''), color: it.color, shiny, isNew };
  }
  function openPack(): void {
    const m = save();
    if (m.packs <= 0) { K.toast('Paket yok. Satış yap, sipariş tamamla, paket gelir!', 'info'); return; }
    m.packs--;
    const items: KolReveal['items'] = [];
    for (let i = 0; i < PACK_SIZE; i++) items.push(drawSticker());
    let line = rng.pick(STICKER_LINES);
    while (m.dupes >= DUPES_PER_PACK) { m.dupes -= DUPES_PER_PACK; m.packs++; line = 'Altı çift çıkartma yeni bir pakete dönüştü!'; }
    reveal = { n: ++revealN, kind: 'pack', items, line };
    K.stat('kolPack');
    checkPages(); K.dirty();
  }
  function cast(): void {
    const m = save();
    if (m.casts <= 0) { K.toast('Olta hakkı bitti. Vapur yanaşınca bir hak daha gelir!', 'info'); return; }
    m.casts--;
    const sea = season();
    const pool: CollItem[] = [];
    for (const p of FISH_PAGES) for (const it of p.items) { if (it.locked || (it.season && it.season !== sea)) continue; pool.push(it); }
    const forced = rareDraw('fish');
    const rares = pool.filter(i => i.rare);
    let it: CollItem;
    if (forced && rares.length) it = rng.pick(rares);
    else {
      const w = pool.map(i => (i.rare ? 0.12 : FISH_PAGES[1].items.includes(i) ? 0.7 : 1) * (m.fish.includes(i.id) ? 1 : 1.6));
      let x = rng.next() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < pool.length - 1 && (x -= w[k]) > 0) k++;
      it = pool[k];
    }
    if (it.rare) gotRare('fish');
    const isNew = !m.fish.includes(it.id);
    if (isNew) m.fish.push(it.id);
    reveal = { n: ++revealN, kind: 'cast', items: [{ name: it.name, color: it.color, shiny: !!it.rare, isNew, note: it.note }], line: isNew ? rng.pick(CAST_LINES) : 'Bu tanıdık. Selam verip denize geri bıraktın.' };
    K.stat('kolCast');
    checkPages(); K.dirty();
  }
  function dropCap(): void {
    const m = save();
    const forced = rareDraw('cap');
    const b = rng.pick(CAP_BRANDS);
    const kind = forced || rng.chance(0.08) ? 'a' : rng.chance(0.35) ? 'o' : 'n';
    if (kind === 'a') gotRare('cap');
    const key = b.id + ':' + kind;
    if (m.caps.includes(key)) return; // duplicate caps just roll into the sea, no message spam
    m.caps.push(key);
    const kn = CAP_KINDS.find(k => k.id === kind)!.name;
    K.toast('Kapak düştü: ' + b.name + ' ' + kn + '! Fırın\'ın panosuna asıldı.', 'good');
    checkPages();
  }

  // ── Fırın ──
  function showcase(): FirinItem[] {
    const S = K.state, out: FirinItem[] = [], used = new Set<number>();
    let i = 0;
    while (out.length < 4 && i < 40) { const k = hash(S.day, (S.seed || 1) + i++) % FIRIN_POOL.length; if (used.has(k)) continue; used.add(k); out.push(FIRIN_POOL[k]); }
    return out;
  }
  function buy(id: string): void {
    const m = save(), S = K.state;
    if (!firinOpen()) { K.toast('Altın Fırın Esnaf Seviyesi ' + FIRIN_LEVEL + ' olunca açılır.', 'info'); return; }
    const it = FIRIN_SHELF.find(x => x.id === id) || showcase().find(x => x.id === id);
    if (!it) { K.toast('Bu vitrin bugün değişti. Yarın yine bak!', 'info'); return; }
    if (!it.repeat && m.firin.includes(it.id)) return;
    if (S.gold < it.gold) { K.toast('Altın Simit yetmiyor: ' + it.gold + ' lazım.', 'bad'); return; }
    S.gold -= it.gold;
    if (it.repeat) m.gifts++; else m.firin.push(it.id);
    if (it.decor) for (const d of it.decor) S.decorOwned.push(d);
    K.toast(it.name + ' senin! ' + (it.decor ? 'Dekor sekmesinde yerleştir.' : it.kind === 'altin' ? 'Fırın vitrininde parlıyor.' : it.repeat ? 'Hediye kartı cebinde.' : 'Sandığına kondu.'), 'good');
    K.logEv('decorBuy', { id: 'firin.' + it.id });
    K.dirty();
  }
  function ad(): void {
    const m = save();
    if (m.adUsed >= AD_GOLD_PER_DAY) { K.toast('Bugünlük reklam bitti. Yarın yine gel!', 'info'); return; }
    m.adUsed++; gainGold(1);
    K.toast(AD_TEXT + ' +1 Altın Simit', 'good'); K.dirty();
  }
  function vitrin(id: string): void {
    const m = save(), S = K.state;
    if (!S.ach[id]) return;
    const i = m.vitrin.indexOf(id);
    if (i >= 0) m.vitrin.splice(i, 1);
    else { if (m.vitrin.length >= 3) m.vitrin.shift(); m.vitrin.push(id); }
    K.dirty();
  }

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'koleksiyon') return false;
    const op = String(c.op || ''), id = String(c.id || '');
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'koleksiyon'; if (id) tab = id; reveal = null; save().seenPages = save().pages.length; return true;
      case 'tab': if (id) tab = id; reveal = null; return true;
      case 'pack': openPack(); return true;
      case 'cast': cast(); return true;
      case 'buy': buy(id); return true;
      case 'ad': ad(); return true;
      case 'vitrin': vitrin(id); return true;
      case 'close': reveal = null; return true;
      default: return true;
    }
  }

  // ── sources ──
  K.bus.on('sale', data => { if (!KOLEKSIYON_ON) return;
    const v = Number(data && (data as { value?: number }).value) || 0;
    if (v <= 0) return;
    const m = save();
    if (++m.salesN >= PACK_EVERY_SALES) { m.salesN = 0; m.packs++; K.toast('Yeni çıkartma paketi! Görevler > Koleksiyon.', 'good'); }
    if (m.bonus > 0) { try { K.moneyApi.addToKasa(Math.max(1, Math.round(v * m.bonus))); } catch { /* kasa not ready */ } }
    if (rng.chance(CAP_CHANCE)) dropCap();
  });
  K.bus.on('orderClaim', () => { if (!KOLEKSIYON_ON) return; save().packs++; });
  K.bus.on('level', () => { if (!KOLEKSIYON_ON) return; save().packs++; K.toast('Seviye hediyesi: bir çıkartma paketi!', 'good'); });
  K.bus.on('regularOk', () => { if (!KOLEKSIYON_ON) return; const m = save(); if (++m.regN % 3 === 0) m.packs++; checkPages(); });
  K.bus.on('ferryDock', () => { if (!KOLEKSIYON_ON) return; const m = save(); if (m.casts < CAST_CAP) m.casts++; });

  // postcards + page checks for book chapters (visits change outside this module)
  let pageT = 0;
  K.addSystem({
    id: 'koleksiyon', order: 22, phase: 'sim',
    step(ctx) {
      if (!KOLEKSIYON_ON) return;   // Faz 2: collections (stickers, kapak, olta, kartpostal) are off
      if (!rt.started || rt.paused) return;
      if ((pageT -= ctx.dt) <= 0) { pageT = 3; checkPages(); }
      const p = K.playerPos, h = K.hour();
      const place = p.x > 62 ? 'carsi' : (p.x > PIER.x0 - 0.5 && p.x < PIER.x1 + 0.5 && p.z < PIER.z1 + 0.4) ? 'iskele' : p.z > PIER.z1 ? 'sahil' : '';
      const tm = POST_TIMES.find(t => h >= t.from && h < t.to);
      if (!place || !tm || rt.moving) { stillAt = 0; return; }
      const key = place + ':' + tm.id;
      if (key !== postKey) { postKey = key; stillAt = 0; }
      const m = save();
      if (m.post.includes(key)) return;
      stillAt += ctx.dt;
      if (stillAt < POST_STILL) return;
      m.post.push(key);
      K.toast('Kartpostal: ' + (PLACES.find(x => x.id === place)?.name || place) + ', ' + tm.name.toLocaleLowerCase('tr') + '! Koleksiyona eklendi.', 'good');
      K.stat('kolPost');
      checkPages();
    },
  });

  function panelModel(): Record<string, any> {
    const m = save(), S = K.state, sea = season();
    const pages = allPages(m);
    const pageInfo = (id: string) => { const p = pages.find(x => x.id === id)!; return { have: p.have, total: p.total, done: p.done, reward: rewardText(p.reward), hidden: !!p.hidden }; };
    const album = STICKER_PAGES.map(p => ({ id: p.id, name: p.name, ...pageInfo(p.id), hint: p.hidden?.hint || '',
      items: p.items.map(i => ({ id: i.id, name: i.name, color: i.color, got: m.st.includes(i.id), shiny: m.shiny.includes(i.id), rare: !!i.rare, season: i.season ? SEASON_NAME[i.season] : '', night: !!i.night })) }));
    const balik = FISH_PAGES.map(p => ({ id: p.id, name: p.name, ...pageInfo(p.id),
      items: p.items.map(i => ({ id: i.id, name: i.name, color: i.color, got: m.fish.includes(i.id), rare: !!i.rare, season: i.season ? SEASON_NAME[i.season] : '', locked: i.locked || '', note: i.note || '' })) }));
    const kapak = CAP_BRANDS.map(b => ({ id: b.id, name: b.name, color: b.color, ink: b.ink, ...pageInfo('cap_' + b.id), caps: CAP_KINDS.map(k => ({ id: k.id, name: k.name, got: m.caps.includes(b.id + ':' + k.id), rare: !!(k as { rare?: boolean }).rare })) }));
    const kartpostal = PLACES.map(pl => ({ id: pl.id, name: pl.name, locked: pl.locked || '', ...(pl.locked ? { have: 0, total: 3, done: false, reward: '' } : pageInfo('post_' + pl.id)),
      cards: POST_TIMES.map(t => ({ id: t.id, name: t.name, sky: t.sky, got: m.post.includes(pl.id + ':' + t.id), when: Math.floor(t.from) + ':' + (t.from % 1 ? '30' : '00') + ' sonrası' })) }));
    const hikaye = REGULARS.map(r => { const st = S.regulars[r.id] as { visits?: number } | undefined; const v = st?.visits || 0; const story = r.story || [];
      return { id: r.id, name: r.name, look: r.look, ...pageInfo('hik_' + r.id), pages: story.map((t, i) => ({ text: i < v ? t : '', open: i < v })), fromDay: r.fromDay, met: v > 0 }; });
    const done = Object.keys(S.ach).filter(id => S.ach[id]);
    const vitrinM = { slots: m.vitrin.slice(), list: ACHIEVEMENTS.filter(a => done.includes(a.id)).map(a => ({ id: a.id, title: a.title, text: a.text, on: m.vitrin.includes(a.id) })) };
    const sc = showcase();
    const item = (it: FirinItem) => ({ id: it.id, name: it.name, kind: FIRIN_KIND_NAME[it.kind], gold: it.gold, text: it.text, color: it.color, owned: !it.repeat && m.firin.includes(it.id), can: S.gold >= it.gold });
    const firin = {
      open: firinOpen(), level: FIRIN_LEVEL, showcase: sc.map(item), shelf: FIRIN_SHELF.map(item), line: FIRIN_LINES[S.day % FIRIN_LINES.length],
      adLeft: AD_GOLD_PER_DAY - m.adUsed, adMax: AD_GOLD_PER_DAY, gifts: m.gifts, sources: GOLD_SOURCES, rules: GOLD_RULES,
      sandik: FIRIN_POOL.filter(x => m.firin.includes(x.id)).map(x => x.name),
    };
    const counts = {
      album: m.st.length + ' / ' + STICKER_PAGES.reduce((a, p) => a + p.items.length, 0),
      balik: m.fish.length + ' / ' + FISH_PAGES.reduce((a, p) => a + p.items.filter(i => !i.locked).length, 0),
      kapak: m.caps.length + ' / ' + CAP_BRANDS.length * CAP_KINDS.length,
      kartpostal: m.post.length + ' / ' + PLACES.filter(p => !p.locked).length * POST_TIMES.length,
      hikaye: pages.filter(p => p.coll === 'hikaye' && p.done).length + ' / ' + REGULARS.length,
    };
    return {
      tab, gold: S.gold, packs: m.packs, dupes: m.dupes, dupesPer: DUPES_PER_PACK, salesLeft: PACK_EVERY_SALES - m.salesN, casts: m.casts, castCap: CAST_CAP,
      shinyN: m.shiny.length, bonus: Math.round(m.bonus * 100), bonusCap: Math.round(BONUS_CAP * 100), pity: PITY, pityLeft: { st: PITY - (m.pity.st || 0), fish: PITY - (m.pity.fish || 0), cap: PITY - (m.pity.cap || 0) },
      season: SEASON_NAME[sea], night: isNight(), pagesDone: m.pages.length, pagesTotal: pages.length,
      album, balik, kapak, kartpostal, hikaye, vitrin: vitrinM, firin, counts, reveal,
    };
  }
  function summary(): Record<string, any> {
    const m = save();
    return { packs: m.packs, casts: m.casts, pagesDone: m.pages.length, pagesTotal: allPages(m).length, gold: K.state.gold, firinOpen: firinOpen(), isNew: m.pages.length > m.seenPages || m.packs > 0 };
  }
  function view() {
    const m = save();
    return { open: firinOpen(), showcase: showcase().map(x => x.color), shelf: FIRIN_SHELF.filter(x => m.firin.includes(x.id)).map(x => x.id), caps: m.caps.slice(), vitrin: m.vitrin.slice() };
  }

  const api: KolApi = { handle, panelModel, summary, view, lastReveal: () => reveal, tab: () => tab };
  (rt as unknown as { koleksiyon: KolApi }).koleksiyon = api;
  K.addStateView(() => ({ koleksiyon: { packs: save().packs, casts: save().casts, pages: save().pages.length } }));
  return api;
}

/** Read the koleksiyon API from rules runtime (null before install). */
export function kolApi(r: { rt: unknown } | null | undefined): KolApi | null { return r ? ((r.rt as { koleksiyon?: KolApi }).koleksiyon) || null : null; }
export function kolPanelModel(r: { rt: unknown }): Record<string, any> { const a = kolApi(r); return a ? a.panelModel() : {}; }
export function kolSummary(r: { rt: unknown }): Record<string, any> | null { const a = kolApi(r); return a ? a.summary() : null; }
