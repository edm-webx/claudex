/**
 * Deniz, vapur ekstraları ve iskele büyümesi (survey vapur-4..7, iskele-3, iskele-5, iskele-10, yasam-2).
 * Pure sim module: no three, no DOM, no wall clock, seeded rng only ('sim.deniz').
 *
 * - Güverte koşusu (vapur-4): while the ferry is docked, stand at the gangway with a full tray and a 10 s deck sale
 *   starts: one carried item sells every 0.75 s at a +40 % deck premium. One run per docking.
 * - Vapur Büfesi (vapur-5): bought from stage 3; passive deck sales on every docking, a longer run.
 *   a small interior overlay (decks + passengers to serve) while the ferry is docked.
 * - Deniz canlıları (vapur-6): a seeded roll every 70-140 s (season / hour / pier-expansion weights); while one is on
 *   screen the player can take a photo (one tap) for ₺, first sighting also Altın Simit. Logged in the Deniz Defteri.
 * - Hayvanlar (yasam-2): ship cat on some dockings, cat-gull stare duel, the rest is view-only (seen-list for the Defter).
 * - Büfenin dışı (iskele-3), masa çeşitleri (iskele-5), iskele genişlemesi (iskele-10): purchases with small capped
 *   sale bonuses (added on every 'sale' with K.earn, like hava.ts extras); the view draws them.
 * - Persistent: GameState.zones['deniz'] (defaults on read, old saves load). Runtime: `denizApi(rules)`.
 * - Commands: { kind: 'deniz', op, id? } op = open | ext | seatBuy | seatSet | tez | pier | bufe | photo.
 */
import type { Kernel, Item } from './state';
import type { ProductId } from './schema';
import { PRODUCT_IDS } from '../../content/products';
import { CITIZENS } from '../../content/citizens';
import {
  DECK_RUN, VAPUR_BUFE, SEA_LIFE, SEA_EVERY, ANIMALS, DUEL, SHIP_CAT,
  EXTERIOR, WINDOW_NOTE, SEATS, TEZGAH, PIER_EXP, DENIZ_BONUS_CAP, type SeatKind, type DenizSeason,
} from '../../content/deniz';
import { havaApi } from './hava';
import { fmtMoney, clamp } from './util';

export const DENIZ_KEY = 'deniz';
const DOOR = { x: 8.1, z: -7.1 };

interface DenizSave {
  ext: string[]; seatOwn: string[]; seats: Record<string, string>; tez: number; pier: string[]; bufe: boolean;
  seen: Record<string, number>; boats: Record<string, number>; animals: string[];
  runs: number; runBest: number; deckSales: number; deckEarned: number; duel: { kedi: number; marti: number };
  nestDay: number; photos: number;
}
export interface DenizRun { left: number; sold: number; earned: number; next: number; max: number }
export interface DenizSight { id: string; t: number; dur: number; x: number; z: number; photo: boolean; seed: number }
export interface DenizView {
  run: DenizRun | null; sight: DenizSight | null;
  duel: { t: number; dur: number; winner: 'kedi' | 'marti' } | null; shipCat: { t: number } | null;
  ext: string[]; seats: Record<string, string>; tez: number; pier: string[]; bufe: boolean; chicks: number; nestAge: number;
  docked: boolean; canRun: boolean;
  season: DenizSeason;
}
export interface DenizApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): DenizView;
  model(): Record<string, unknown>;
  summary(): Record<string, unknown>;
  bonus(): number;
}
type CuLike = { spawnCustomer(o: Record<string, unknown>): unknown } | null | undefined;

export function installDeniz(K: Kernel, cu?: CuLike): DenizApi {
  const rng = K.rng('sim.deniz');
  const S = () => K.state, rt = K.rt;
  const KX = K as unknown as { spend(v: number): void; saveNow(): void; logEv(ev: string, x?: Record<string, unknown>): void };
  const D = (): DenizSave => {
    const st = S();
    if (!st.zones || typeof st.zones !== 'object') st.zones = {};
    let h = st.zones[DENIZ_KEY] as unknown as DenizSave | undefined;
    if (!h || typeof h !== 'object') { h = {} as DenizSave; st.zones[DENIZ_KEY] = h as unknown as Record<string, unknown>; }
    if (!Array.isArray(h.ext)) h.ext = []; if (!Array.isArray(h.seatOwn)) h.seatOwn = []; if (!h.seats || typeof h.seats !== 'object') h.seats = {};
    h.tez = clamp(Number(h.tez) || 0, 0, TEZGAH.max); if (!Array.isArray(h.pier)) h.pier = []; h.bufe = !!h.bufe;
    if (!h.seen || typeof h.seen !== 'object') h.seen = {}; if (!h.boats || typeof h.boats !== 'object') h.boats = {}; if (!Array.isArray(h.animals)) h.animals = [];
    h.runs = Number(h.runs) || 0; h.runBest = Number(h.runBest) || 0; h.deckSales = Number(h.deckSales) || 0; h.deckEarned = Number(h.deckEarned) || 0;
    if (!h.duel || typeof h.duel !== 'object') h.duel = { kedi: 0, marti: 0 };
    h.nestDay = Number(h.nestDay) || 0; h.photos = Number(h.photos) || 0;
    return h;
  };
  const has = (arr: string[], id: string) => arr.indexOf(id) >= 0;
  const seeAnimal = (id: string) => { const h = D(); if (!has(h.animals, id)) { h.animals.push(id); K.dirty(); } };
  const season = (): DenizSeason => (havaApi(K as never)?.view().season as DenizSeason) || 'yaz';
  const built = (): ProductId[] => PRODUCT_IDS.filter(p => rt.stations[p] && rt.stations[p].built);
  const scale = () => Math.max(1, K.venueMult());
  const near = (p: { x: number; z: number }, r: number) => { const q = K.playerPos; return (q.x - p.x) ** 2 + (q.z - p.z) ** 2 <= r * r; };

  // ───────── runtime ─────────
  let run: DenizRun | null = null, sight: DenizSight | null = null;
  let duel: DenizView['duel'] = null, shipCat: { t: number } | null = null;
  let sightNext = 40, duelNext = rng.range(DUEL.every[0], DUEL.every[1]);
  let lastFerry = rt.ferry.state, runDone = false, selling = false, hintN = 0;

  // ───────── sale bonuses ─────────
  function bonus(): number {
    const h = D(); let b = 0;
    for (const e of EXTERIOR) if (has(h.ext, e.id)) b += e.bonus;
    for (const p of PIER_EXP) if (has(h.pier, p.id)) b += p.bonus;
    rt.tables.forEach((t, i) => { if (!t.built) return; const sd = SEATS.find(s => s.id === h.seats[String(i)]); if (sd) b += sd.bonus; });
    b += h.tez * TEZGAH.bonus;
    if (h.bufe) b += 0.03;
    return Math.min(DENIZ_BONUS_CAP, b);
  }
  K.bus.on('sale', ((e: { value: number }) => {
    if (selling || !rt.started) return;
    const h = D(), b = bonus();
    if (b > 0) { const v = Math.round((e.value || 0) * b); if (v >= 1) K.earn(v); }
  }) as never);

  // ───────── deck run (vapur-4) ─────────
  function startRun(): void {
    const h = D(), max = h.bufe ? DECK_RUN.timeBufe : DECK_RUN.time;
    run = { left: max, sold: 0, earned: 0, next: 0.2, max }; runDone = true;
    K.toast(rng.pick(DECK_RUN.lines.start), 'good'); KX.logEv('denizRun', { on: 1 });
  }
  function endRun(why: 'time' | 'empty' | 'leave'): void {
    if (!run) return;
    const h = D(), r = run; run = null;
    h.runs++; h.runBest = Math.max(h.runBest, r.sold); h.deckSales += r.sold; h.deckEarned += r.earned;
    K.stat('guverte', r.sold);
    K.toast(why === 'empty' && r.sold ? DECK_RUN.lines.empty + ' ' + r.sold + ' satış, ' + fmtMoney(r.earned) + '.' : DECK_RUN.lines.end.replace('{n}', String(r.sold)).replace('{money}', fmtMoney(r.earned)), r.sold ? 'good' : 'info');
    KX.logEv('denizRun', { on: 0, n: r.sold }); KX.saveNow();
  }
  function stepRun(dt: number): void {
    if (!run) return;
    if (rt.ferry.state !== 'docked') { endRun('leave'); return; }
    run.left -= dt; run.next -= dt;
    if (run.next <= 0) {
      run.next = DECK_RUN.every;
      const it = rt.carry[0];
      if (!it) { endRun('empty'); return; }
      const got = K.carry.takeFromPlayer(it.type);
      if (got) {
        selling = true;
        let v = 0; try { v = K.salesApi.settle([got], { direct: true, at: DOOR }); } finally { selling = false; }
        const extra = Math.round(v * DECK_RUN.premium); if (extra > 0) K.earn(extra, DOOR);
        run.sold++; run.earned += v + extra;
      }
      if (!rt.carry.length) { endRun('empty'); return; }
    }
    if (run && run.left <= 0) endRun('time');
  }

  // ───────── ferry hooks ─────────
  function onDock(): void {
    runDone = false;
    const h = D();
    if (h.bufe) { const v = Math.round(VAPUR_BUFE.perDock * S().stage * Math.sqrt(scale())); K.earn(v, DOOR); K.toast('Vapur Büfesi seferde sattı: +' + fmtMoney(v), 'good'); }
    if (hintN < 2 && h.runs < 3) { hintN++; K.toast(DECK_RUN.lines.hint, 'info'); }
    if (rng.chance(SHIP_CAT.chance)) { shipCat = { t: 0 }; seeAnimal('vapurkedisi'); K.toast(rng.pick(SHIP_CAT.line), 'info'); }
  }
  function onLeave(): void {
    if (shipCat) { shipCat = null; K.toast(SHIP_CAT.back, 'info'); }
  }

  // ───────── sea life (vapur-6) ─────────
  function rollSight(): void {
    const h = D(), ss = season(), hr = K.hour();
    const list = SEA_LIFE.filter(s => (!s.seasons || s.seasons.indexOf(ss) >= 0) && (!s.hours || (hr >= s.hours[0] && hr < s.hours[1])));
    if (!list.length) return;
    const wOf = (s: typeof SEA_LIFE[number]) => s.w * ((s.id === 'lufer' || s.id === 'istavrit') && has(h.pier, 'mendirek') ? 2 : 1) * (hr >= 20 && has(h.pier, 'platform') ? 1.6 : 1);
    let tot = 0; for (const s of list) tot += wOf(s);
    let x = rng.next() * tot, pick = list[0];
    for (const s of list) { x -= wOf(s); if (x <= 0) { pick = s; break; } }
    const spots: Record<string, [number, number][]> = {
      yunus: [[-6, -22], [4, -24]], denizanasi: [[-13, -7], [11.5, -2], [-2, -16]], lufer: [[-14, -3], [-4, -17]], istavrit: [[-12.5, -9], [2, -15.5]],
      fok: [[-13.5, 1.5], [-12.5, -11]], ahtapot: [[7.6, -12.85]],
    };
    const sp = rng.pick(spots[pick.id] || [[-12, -6]]);
    sight = { id: pick.id, t: 0, dur: pick.dur, x: sp[0], z: sp[1], photo: false, seed: rng.int(0, 9999) };
    K.toast(pick.icon + ' ' + pick.line, 'info'); KX.logEv('denizSight', { id: pick.id, x: sp[0], z: sp[1] });
  }
  function photo(): void {
    if (!sight || sight.photo) { K.toast('Şu an denizde bakılacak bir şey yok. Martı Cemil poz veriyor ama.', 'info'); return; }
    const def = SEA_LIFE.find(s => s.id === sight!.id); if (!def) return;
    const h = D(), first = !h.seen[def.id];
    sight.photo = true; h.seen[def.id] = (h.seen[def.id] || 0) + 1; h.photos++;
    const v = Math.round(def.money * (first ? 2 : 1) * Math.sqrt(scale()));
    K.earn(v, { x: sight.x, z: sight.z });
    if (first) S().gold += def.gold;
    K.stat('denizFoto');
    K.toast('📸 ' + def.photo + ' +' + fmtMoney(v) + (first ? ' · Deniz Defteri\'ne yeni sayfa! +' + def.gold + ' Altın Simit' : ''), 'good');
    KX.logEv('denizPhoto', { id: def.id }); KX.saveNow();
  }

  // ───────── tick ─────────
  K.addSystem({
    id: 'deniz', order: 27, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt, h = D();
      if (!h.nestDay) h.nestDay = S().day || 1;
      // ferry transitions
      const fs = rt.ferry.state;
      if (fs !== lastFerry) { if (fs === 'docked') onDock(); else if (lastFerry === 'docked') onLeave(); lastFerry = fs; }
      if (fs === 'docked' && !run && !runDone && rt.carry.length && S().stage >= DECK_RUN.minStage && near(DOOR, DECK_RUN.radius)) startRun();
      stepRun(dt);
      if (shipCat) shipCat.t += dt;
      // sea life
      if (sight) { sight.t += dt; if (sight.t >= sight.dur) sight = null; }
      else if ((sightNext -= dt) <= 0) { sightNext = rng.range(SEA_EVERY[0], SEA_EVERY[1]); if (S().playT > 60) rollSight(); }
      // cat-gull duel
      if (K.hour() >= 20 && !has(h.animals, 'kirpi')) seeAnimal('kirpi');
    },
  });

  // ───────── commands ─────────
  function buyFixed(cost: number, label: string): boolean {
    if (S().money < cost) { K.toast(label + ' için kasada ' + fmtMoney(cost) + ' olmalı.', 'info'); return false; }
    KX.spend(cost); return true;
  }
  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    const op = String(c.op || ''), id = String(c.id ?? ''), h = D();
    switch (op) {
      case 'open': rt.boardOpen = false; rt.panel = 'deniz'; KX.logEv('panel', { id: 'deniz' }); return true;
      case 'ext': {
        const e = EXTERIOR.find(x => x.id === id); if (!e || has(h.ext, e.id)) return true;
        if (S().stage < e.minStage) { K.toast(e.name + ' için büfe ' + e.minStage + '. aşamada olmalı.', 'info'); return true; }
        if (!buyFixed(e.cost, e.name)) return true;
        h.ext.push(e.id); K.toast(e.icon + ' ' + e.line, 'good'); KX.logEv('denizBuy', { id: e.id }); KX.saveNow(); return true;
      }
      case 'seatBuy': {
        const sd = SEATS.find(x => x.id === id); if (!sd || sd.id === 'standart' || has(h.seatOwn, sd.id)) return true;
        if (!buyFixed(sd.cost, sd.name)) return true;
        h.seatOwn.push(sd.id);
        const free = rt.tables.findIndex((t, i) => t.built && !h.seats[String(i)]); if (free >= 0) h.seats[String(free)] = sd.id;
        K.toast(sd.icon + ' ' + sd.name + ' geldi! Masalara yerleştirebilirsin.', 'good'); KX.saveNow(); return true;
      }
      case 'seatSet': {
        const [ti, kind] = id.split(':'); const i = Number(ti);
        if (!rt.tables[i] || !rt.tables[i].built) return true;
        if (kind === 'standart') delete h.seats[String(i)];
        else if (has(h.seatOwn, kind)) h.seats[String(i)] = kind as SeatKind;
        K.dirty(); return true;
      }
      case 'tez': {
        if (h.tez >= TEZGAH.max) return true;
        if (!buyFixed(TEZGAH.cost, TEZGAH.name)) return true;
        h.tez++; K.toast(TEZGAH.icon + ' Korkuluğa bir tezgah daha asıldı. Denize karşı ayakta çay!', 'good'); KX.saveNow(); return true;
      }
      case 'pier': {
        const p = PIER_EXP.find(x => x.id === id); if (!p || has(h.pier, p.id)) return true;
        const idx = PIER_EXP.indexOf(p); if (idx > 0 && !has(h.pier, PIER_EXP[idx - 1].id)) { K.toast('Önce ' + PIER_EXP[idx - 1].name + ' yapılmalı.', 'info'); return true; }
        if (S().stage < p.minStage) { K.toast(p.name + ' için büfe ' + p.minStage + '. aşamada olmalı.', 'info'); return true; }
        if (!buyFixed(p.cost, p.name)) return true;
        h.pier.push(p.id); K.toast(p.icon + ' ' + p.line, 'good'); K.stat('iskeleGenis'); KX.logEv('denizBuy', { id: p.id }); KX.saveNow(); return true;
      }
      case 'bufe': {
        if (h.bufe) return true;
        if (S().stage < VAPUR_BUFE.minStage) { K.toast('Vapur Büfesi için büfe ' + VAPUR_BUFE.minStage + '. aşamada olmalı.', 'info'); return true; }
        if (!buyFixed(VAPUR_BUFE.cost, VAPUR_BUFE.name)) return true;
        h.bufe = true; K.toast('⛴ Vapur Büfesi açıldı! Vapur yanaşınca "Vapura bin" ile gezebilirsin.', 'good'); KX.saveNow(); return true;
      }
      case 'photo': photo(); return true;
    }
    return true;
  }

  // ───────── views / models ─────────
  function view(): DenizView {
    const h = D();
    const age = Math.max(0, S().day - (h.nestDay || S().day));
    return {
      run, sight, duel, shipCat, ext: h.ext, seats: h.seats, tez: h.tez, pier: h.pier, bufe: h.bufe,
      chicks: clamp(1 + Math.floor(age / 2), 1, 3), nestAge: age,
      docked: rt.ferry.state === 'docked', canRun: rt.ferry.state === 'docked' && !run && !runDone && S().stage >= DECK_RUN.minStage,
      season: season(),
    };
  }
  function model(): Record<string, unknown> {
    const h = D(), st = S(), money = st.money;
    const why = (minStage: number, cost: number) => st.stage < minStage ? 'Büfe ' + minStage + '. aşamada açılır.' : money < cost ? 'Kasada ' + fmtMoney(cost) + ' olmalı.' : '';
    return {
      money, stage: st.stage, bonus: Math.round(bonus() * 1000) / 10, cap: Math.round(DENIZ_BONUS_CAP * 100),
      exterior: EXTERIOR.map(e => ({ id: e.id, name: e.name, icon: e.icon, text: e.text, cost: e.cost, bonus: Math.round(e.bonus * 100), owned: has(h.ext, e.id), why: why(e.minStage, e.cost) })),
      pencere: { name: WINDOW_NOTE.name, icon: WINDOW_NOTE.icon, text: WINDOW_NOTE.text, owned: !!st.owned.pencere },
      seats: SEATS.filter(s => s.id !== 'standart').map(s => ({ id: s.id, name: s.name, icon: s.icon, text: s.text, cost: s.cost, bonus: s.bonus * 100, owned: has(h.seatOwn, s.id), why: why(1, s.cost) })),
      tables: rt.tables.map((t, i) => ({ i, built: t.built, kind: h.seats[String(i)] || 'standart' })).filter(t => t.built),
      kinds: ['standart', ...h.seatOwn].map(k => { const s = SEATS.find(x => x.id === k)!; return { id: s.id, icon: s.icon, name: s.name }; }),
      tez: { n: h.tez, max: TEZGAH.max, cost: TEZGAH.cost, name: TEZGAH.name, icon: TEZGAH.icon, text: TEZGAH.text, why: why(1, TEZGAH.cost) },
      pier: PIER_EXP.map((p, i) => ({ id: p.id, name: p.name, icon: p.icon, text: p.text, perk: p.perk, cost: p.cost, bonus: Math.round(p.bonus * 100), owned: has(h.pier, p.id),
        why: i > 0 && !has(h.pier, PIER_EXP[i - 1].id) ? 'Önce ' + PIER_EXP[i - 1].name + '.' : why(p.minStage, p.cost) })),
      vapur: { runs: h.runs, best: h.runBest, sales: h.deckSales, earned: Math.round(h.deckEarned), bufe: h.bufe, bufeCost: VAPUR_BUFE.cost, bufeText: VAPUR_BUFE.blurb, bufeWhy: why(VAPUR_BUFE.minStage, VAPUR_BUFE.cost), docked: rt.ferry.state === 'docked' },
      life: SEA_LIFE.map(s => ({ id: s.id, name: s.name, icon: s.icon, rare: s.rare, n: h.seen[s.id] || 0, when: (s.seasons ? s.seasons.join(', ') : 'her mevsim') + (s.hours ? ' · ' + s.hours[0] + ':00 sonrası' : '') })),
      animals: ANIMALS.map(a => ({ id: a.id, name: a.name, icon: a.icon, text: a.text, seen: a.id === 'martiyuvasi' || a.id === 'karabatak' || a.id === 'kaplumbaga' || has(h.animals, a.id) })),
      duel: h.duel, photos: h.photos,
      now: { sight: sight && !sight.photo ? SEA_LIFE.find(s => s.id === sight!.id)?.name : '' },
    };
  }
  function summary(): Record<string, unknown> {
    const h = D();
    const seen = SEA_LIFE.filter(s => h.seen[s.id]).length;
    return {
      bonus: Math.round(bonus() * 1000) / 10, seen, total: SEA_LIFE.length,
      line: sight && !sight.photo ? 'Şu an denizde: ' + (SEA_LIFE.find(s => s.id === sight!.id)?.name || '') : (h.ext.length + h.pier.length) + ' iskele eklentisi · ' + h.runs + ' güverte koşusu',
    };
  }
  const api: DenizApi = { handle, view, model, summary, bonus };
  (rt as unknown as { deniz: DenizApi }).deniz = api;
  return api;
}

/** Views, UI and panels read the installed module through the runtime. */
export function denizApi(r: { rt: unknown } | null | undefined): DenizApi | null { return r ? ((r.rt as { deniz?: DenizApi }).deniz || null) : null; }
