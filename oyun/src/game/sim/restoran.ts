/**
 * Faz 2 restoran sistemi (content/restoran.ts): the adisyon (ticket) table service. Pure sim: no three, no DOM, seeded rng only. Persistent bits live in GameState.zones['restoran']
 * (created on first read, so old saves load untouched); tickets are runtime only (table guests don't survive a reload).
 *
 * Interactables (dwell rule like everything else):
 *   `servis.<i>`   at table i: hand over one item from the hands that the table's ticket still wants.
 * Hooks used by customers.ts: rt.restoran.wantMasa() (spawner).
 * Views/UI read restoranApi(rules).view().
 */
import { mutfakEtki, sefHizi } from '../../content/mutfak';
import { ADISYON, ADISYON_LINES, SERVIS, FAZ2_UI } from '../../content/restoran';
import { YEMEK } from '../../content/ekonomi2';
import { DISH_BY_ID, acikYemekler, menuPano, yemekAgirlik, yemekAd, isProduct, type DishId, type FoodId, type MenuAsama } from '../../content/yemek-menu';
import { MUTFAK_NOKTA, mutfakDunya } from '../../content/ic-mekan';
import { installMutfakHat, type IstDurum, type MutfakHatApi } from './mutfak-hat';
import type { Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Customer, Item, Order, Plate } from './state';
import { clamp } from './util';

export const RESTORAN_KEY = 'restoran';
interface Save { servis: number; no: number }
/**
 * Bilet kalemi: ya eski tezgâh ürünü (dish null, food = ProductId) ya da menüdeki bir yemek (food = dish = DishId). BUF-05: yemek
 * kendi adıyla kendi istasyonunda pişer ve kendi tabağıyla (Plate.type = DishId) masaya gider; taşıyıcı ürün köprüsü yok.
 * Tadım menüsü: kurs>1, her servis ayrı kalem.
 */
export interface TicketLine { food: FoodId; dish: DishId | null; fiyat: number; done: boolean; kurs: number }
export type FoodOrder = Record<FoodId, number | undefined>;
export interface Ticket { no: number; table: number; cid: number; want: FoodOrder; all: FoodOrder; lines: TicketLine[]; t: number; max: number }
export interface TicketView { no: number; table: number; items: { p: FoodId; dish: DishId | null; name: string; n: number; left: number }[]; frac: number }
/** Kaldırılan stant sisteminden kalan boş sözleşme: stant-look.ts / world/index.ts / boot.ts temizlenene kadar. */
export interface StantView { id: string; name: string; short: string; owned: boolean; buyable: boolean; cost: number; price: number; stock: number; max: number; x: number; z: number; ry: number; look: string; color: string }
export interface RestoranView {
  active: boolean; tickets: TicketView[]; servis: number; stands: StantView[];
  /** BUF-05 mutfak: pass rafındaki tabaklar (FoodId, en eski önce), istasyon durumları, şef hızı (0..0.6) */
  pass: FoodId[]; ist: Record<string, IstDurum>; sefHizi: number;
}
export interface RestoranApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): RestoranView;
  /** menü panosu: aşama aşama açılan yemek listesi (kilitliler 'Aşama N'de açılır') */
  menu(): MenuAsama[];
  /** şu an masa biletinde çıkabilecek yemekler (aşama açık + taşıyıcı ürün yapılı) */
  openDishes(): DishId[];
  wantMasa(): boolean;
  update(dt: number): void;
  register(): void;
  /** 2026-11-09 garson flow: claim up to n plates waiting at the pass (counter), deliver one at its table */
  garsonClaim?(wid: number, n: number): { id: number; p: FoodId; x: number; z: number }[];
  garsonOpen?(wid: number): { id: number; p: FoodId; x: number; z: number }[];
  garsonDone?(wid: number, id: number): boolean;
  /** BUF-05: garsonun tabakları mutfak pass rafından alacaksa oradaki durak (dünya), tezgâhtan alacaksa null */
  passDurak?(wid: number): Vec2 | null;
  /** BUF-05 mutfak hattı (sim/mutfak-hat.ts): en eski bilet kalemini ve boş istasyonunu ayırır */
  kitchenClaim?(wid: number, opt?: { from?: Vec2 }): FoodId | null;
  /** legacy tek adım: ok=true pişen tabağı doğrudan pass'a koyar (ya da eldekini), ok=false işi bırakır */
  kitchenDone?(wid: number, ok: boolean): void;
  kitchenIst?(wid: number): string | null;
  kitchenSure?(wid: number): number;
  kitchenReady?(wid: number): boolean;
  kitchenTasi?(wid: number, opt?: { kendi?: boolean; yas?: number }): { ist: string; p: FoodId } | null;
  kitchenTasiAl?(wid: number): Plate | null;
  kitchenPass?(wid: number): boolean;
  kitchenDrop?(wid: number): void;
  kitchenBekleyen?(yas: number): boolean;
  /** mutfak hattının kendisi (testler, görünüm) */
  hat?: MutfakHatApi<Ticket>;
  /** waiter table visits: bring the menu, bring the bill (survey waiter flow menü→sipariş→pass→masa→hesap→sil) */
  masaClaim?(wid: number): { id: number; kind: 'menu' | 'hesap'; x: number; z: number } | null;
  masaDone?(wid: number, id: number): void;
}
type Cu = { leave(c: Customer, angry: boolean): void; say(c: Customer, t: string, s?: number): void; seatPos(t: number, s: number): Vec2 | null };

export function restoranApi(r: { rt: unknown } | null | undefined): RestoranApi | null { return r ? ((r.rt as { restoran?: RestoranApi }).restoran || null) : null; }

export function installRestoran(K: Kernel, cu: Cu, settle: (c: Customer, items: Plate[]) => number, addMoneyTo: (p: { value: number }[], v: number) => void): RestoranApi {
  const rt = K.rt, S = K.state, rng = K.rng('sim.restoran');
  const G = (): Save => {
    if (!S.zones || typeof S.zones !== 'object') S.zones = {};
    let g = S.zones[RESTORAN_KEY] as unknown as Save | undefined;
    if (!g || typeof g !== 'object') { g = {} as Save; S.zones[RESTORAN_KEY] = g as unknown as Record<string, unknown>; }
    g.servis = Number.isFinite(g.servis) ? g.servis : SERVIS.start; g.no = g.no | 0;
    return g;
  };
  const tickets: Ticket[] = [];
  // plates a garson carries from the pass to a table; unclaimed or stuck plates are delivered by the old abstract rule after a while
  // src: 'pass' (mutfak pass rafı, BUF-05) or 'counter' (ön tezgâh: tezgâh ürünü)
  type Job = { id: number; ticket: Ticket; p: FoodId; item: Plate; t: number; wid: number; src: 'pass' | 'counter' };
  const jobs: Job[] = []; let jobId = 1;
  type Masa = { id: number; kind: 'menu' | 'hesap'; cid: number; table: number; t: number; wid: number };
  const masaJobs: Masa[] = [];
  type CF = { tk?: boolean; menuJob?: boolean; menuOk?: boolean; hesapJob?: boolean; hesapBekle?: boolean };
  const active = () => (S.stage || 1) >= ADISYON.fromStage;
  const custOf = (t: Ticket) => rt.customers.find(c => c.id === t.cid) || null;
  const add = (o: Record<string, number | undefined>, p: string, n = 1) => { o[p] = (o[p] || 0) + n; };
  const left = (t: Ticket) => Object.values(t.want).reduce<number>((s, n) => s + (n || 0), 0);

  // stations produce for open tickets too (room above the counter stock)
  rt.reserved.push(() => { const r: Order = {}; for (const t of tickets) for (const p in t.want) if (isProduct(p)) add(r, p, t.want[p] || 0); return r; });
  // BUF-05: mutfak hattı (istasyonlar, tepsi, pass rafı)
  const hat = installMutfakHat<Ticket>(K, { tickets: () => tickets, jobs: (t, f) => jobs.filter(j => j.ticket === t && j.p === f).length });
  /** yemek masa biletine ancak mutfak pişirip getirebiliyorsa çıkar: aşçı (pişirir) ve garson (pass'tan taşır) işe alınmış olmalı */
  const mutfakHazir = () => S.workers.some(w => w.role === 'asci') && S.workers.some(w => w.role === 'garson');

  function freeTable(): number {
    for (let i = 0; i < rt.tables.length; i++) {
      const t = rt.tables[i];
      if (t && t.built && t.dirty <= 0 && t.seats.every(s => !s.occ) && !tickets.some(k => k.table === i)) return i;
    }
    return -1;
  }
  const dishesNow = () => acikYemekler(S.stage || 1);
  function openTicket(c: Customer): void {
    if (!c.seat) return;
    const g = G();
    const units: ProductId[] = [];
    for (const p in c.order) for (let k = 0; k < (c.order[p as ProductId] || 0) && units.length < ADISYON.maxItems; k++) units.push(p as ProductId);
    if (!units.length) units.push(K.openProducts()[0] || 'cay');
    // menü: kalemlerin bir kısmı açık aşamanın yemeği (tip tercihine göre), kalanı eski ürünler; tadım menüsü tek siparişin kendisi
    const avail = mutfakHazir() ? dishesNow() : [], pay = YEMEK.pay[Math.max(0, Math.min(9, (S.stage || 1) - 1))] ?? 0;
    let lines: TicketLine[] = [], kursN = 1;
    for (const u of units) {
      if (avail.length && rng.next() < pay) {
        const w: Record<string, number> = {}; for (const d of avail) w[d.id] = yemekAgirlik(d, c.typeId, u);
        const d = DISH_BY_ID[rng.weighted(w)];
        if (d.kurs) { kursN = rng.int(d.kurs[0], d.kurs[1]); lines = Array.from({ length: kursN }, () => ({ food: d.id, dish: d.id, fiyat: Math.round(d.fiyat / kursN), done: false, kurs: kursN })); break; }
        lines.push({ food: d.id, dish: d.id, fiyat: d.fiyat, done: false, kurs: 1 });
      } else lines.push({ food: u, dish: null, fiyat: 0, done: false, kurs: 1 });
    }
    const want: FoodOrder = {}, po: Order = {};
    for (const l of lines) { add(want, l.food); if (isProduct(l.food)) add(po, l.food); }
    c.order = po; c.got = {};   // müşterinin tezgâh ürünü siparişi (yemekler bilette, adıyla)
    g.no = (g.no % 99) + 1;
    tickets.push({ no: g.no, table: c.seat.table, cid: c.id, want: { ...want }, all: { ...want }, lines, t: 0, max: ADISYON.patience + (kursN - 1) * YEMEK.kursSabir });
    K.logEv('ticket', { no: g.no, table: c.seat.table, x: c.x, z: c.z });
  }
  function deliver(t: Ticket, c: Customer, it: Plate): void {
    const p = it.type;
    const ln = t.lines.find(l => !l.done && l.food === p);
    if (ln) { ln.done = true; if (ln.dish) { it.priceX = (it.priceX || 1) * ln.fiyat / DISH_BY_ID[ln.dish].fiyat; K.stat('yemek_' + ln.dish); } }   // tadım menüsü: servis başına payı
    c.items.push(it); if (isProduct(p)) add(c.got, p);
    t.want[p] = Math.max(0, (t.want[p] || 0) - 1); if (!t.want[p]) delete t.want[p];
    K.logEv('serve', { x: c.x, z: c.z });
    if (!left(t)) complete(t, c);
  }
  function complete(t: Ticket, c: Customer): void {
    tickets.splice(tickets.indexOf(t), 1);
    const g = G(), used = clamp(t.t / t.max, 0, 1);
    const value = settle(c, c.items.slice());
    let tipF = ADISYON.tip[ADISYON.tip.length - 1][1];
    for (const [u, f] of ADISYON.tip) if (used <= u) { tipF = f; break; }
    let tip = Math.round(value * tipF * (1 + mutfakEtki(S.workers).bahsis));
    const gs = S.workers.filter(w => w.role === 'garson');   // shared tip jar: the waiters' cut of every table tip, split evenly (survey g_bahsis)
    if (gs.length && tip > 1) { const cut = Math.floor(tip * 0.4); tip -= cut; for (const w of gs) { const q = w as { paidToday?: number }; q.paidToday = (q.paidToday || 0) + cut / gs.length; } }
    if (c.n >= 2 && rng.next() < ADISYON.fightChance) { tip *= 2; cu.say(c, rng.pick(ADISYON_LINES.fight), 2.5); K.stat('hesapKavgasi'); }
    else if (rng.next() < 0.1) cu.say(c, rng.pick(ADISYON_LINES.served), 2);
    const tb = rt.tables[t.table];
    if (tb && tip > 0) { addMoneyTo(tb.pile, tip); S.today!.earned += tip; S.week.earned += tip; S.totalEarned += tip; rt.incomeWin.push([S.playT, tip]); K.stat('tips'); }
    g.servis = clamp(g.servis * (1 - SERVIS.weight) + 5 * (1 - used * 0.8) * SERVIS.weight, 0, 5);
    c.value = 0; c.state = 'eat'; c.t = 0; c.eatT = rng.range(ADISYON.eat[0], ADISYON.eat[1]);
    K.stat('adisyon'); K.logEv('hesap', { value, tip, x: c.x, z: c.z });
  }
  function fail(t: Ticket, c: Customer | null): void {
    tickets.splice(tickets.indexOf(t), 1);
    const g = G(); g.servis = clamp(g.servis * (1 - SERVIS.weight), 0, 5);
    if (c) { cu.say(c, rng.pick(ADISYON_LINES.late), 2.5); c.items.splice(0); S.today!.angry++; K.logEv('angry', { type: c.typeId }); cu.leave(c, true); }
  }

  function register(): void {
    if (!FAZ2_UI) return;
    // table service plates
    rt.layout.tables.forEach((tb, i) => {
      const id = 'servis.' + i, ex = K.interactions.get(id);
      if (ex) { ex.pos = { x: tb.x, z: tb.z }; return; }
      K.interactions.register({
        id, pos: { x: tb.x, z: tb.z }, radius: 1.45, kind: 'table', dwell: 0.3, interval: 0.16,
        canAct: () => { const t = tickets.find(k => k.table === i); return !!t && rt.carry.some(it => (t.want[it.type] || 0) > 0); },
        act: () => {
          const t = tickets.find(k => k.table === i); if (!t) return 'done';
          const c = custOf(t); if (!c) return 'done';
          const k = rt.carry.findIndex(it => (t.want[it.type] || 0) > 0); if (k < 0) return 'done';
          const [it] = rt.carry.splice(k, 1); it.carrier = undefined as never;
          deliver(t, c, it);
          return tickets.includes(t) ? 'continue' : 'done';
        },
      });
    });
  }

  // ───────── per tick ─────────
  let garsonT = 0;
  function update(dt: number): void {
    // seated table guests: print the ticket after a short look at the menu
    const gN = S.workers.filter(w => w.role === 'garson').length;
    for (const c of rt.customers) {
      const f = c as unknown as CF;
      if (c.kind === 'masa' && c.seat && gN > 0) {
        if (c.state === 'wait' && !f.menuJob && c.t >= 0.5) { f.menuJob = true; masaJobs.push({ id: jobId++, kind: 'menu', cid: c.id, table: c.seat.table, t: 0, wid: 0 }); }
        if (c.state === 'eat' && !f.hesapJob && c.t >= c.eatT - 1) { f.hesapJob = true; f.hesapBekle = true; masaJobs.push({ id: jobId++, kind: 'hesap', cid: c.id, table: c.seat.table, t: 0, wid: 0 }); }
      }
      if (c.kind !== 'masa' || c.state !== 'wait') continue;
      const menuReady = gN === 0 || f.menuOk || c.t >= ADISYON.orderDelay + 14;
      if (!tickets.some(t => t.cid === c.id) && c.t >= ADISYON.orderDelay && menuReady && !f.tk) {
        (c as unknown as { tk?: boolean }).tk = true;
        if (rng.next() < 0.2) cu.say(c, rng.pick(ADISYON_LINES.call), 1.8);
        openTicket(c);
      }
    }
    for (let i = tickets.length - 1; i >= 0; i--) {
      const t = tickets[i], c = custOf(t);
      if (!c || c.state === 'leave') { tickets.splice(i, 1); continue; }
      t.t += dt;
      if (t.t >= t.max) fail(t, c);
    }
    for (let i = masaJobs.length - 1; i >= 0; i--) {   // stale table visits fall back to the old timing
      const j = masaJobs[i], c = rt.customers.find(k => k.id === j.cid); j.t += dt;
      if (!c || c.state === 'leave' || j.t > (j.wid ? 30 : 18)) { if (c) { const f = c as unknown as CF; if (j.kind === 'hesap') f.hesapBekle = false; else f.menuOk = true; } masaJobs.splice(i, 1); }
    }
    hat.update(dt);
    // garsons carry plates from the pass (counter stock) to the tables: a job is a plate taken off the counter, a garson walks it over
    const g = S.workers.filter(w => w.role === 'garson').length;
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i], c = custOf(j.ticket); j.t += dt;
      if (!tickets.includes(j.ticket) || !c) { geri(j); jobs.splice(i, 1); continue; }
      if ((!j.wid && j.t > 12) || j.t > 30) { jobs.splice(i, 1); deliver(j.ticket, c, j.item); }
    }
    if (g > 0 && tickets.length && jobs.length < g * 3) {
      garsonT -= dt;
      if (garsonT <= 0) {
        garsonT = 0.8;
        for (const t of tickets) {   // tabak kaynağı: önce mutfak pass rafı, yoksa ön tezgâh (pass'ı olmayan aşama / aşçısız oyun eskisi gibi)
          const p = Object.keys(t.want).find(q => (hat.passCount(q) > 0 || (isProduct(q) && (rt.counter[q]?.length || 0) > 0)) && jobs.filter(j => j.ticket === t && j.p === q).length < (t.want[q] || 0));
          if (!p) continue;
          const fromPass = hat.passTake(p);
          const item: Plate = fromPass || rt.counter[p as ProductId].pop()!;
          jobs.push({ id: jobId++, ticket: t, p, item, t: 0, wid: 0, src: fromPass ? 'pass' : 'counter' });
          break;
        }
      }
    }
  }
  function wantMasa(): boolean {
    if (!FAZ2_UI || !active() || tickets.length >= ADISYON.maxOpen + Math.max(0, Math.floor(((S.stage || 1) - 4) / 2))) return false;
    const sh = (ADISYON.share[(S.stage || 1) - 1] ?? 0) + Math.max(0, G().servis - 3) * SERVIS.sharePerStar;
    if (rng.next() >= sh) return false;
    return freeTable() >= 0;
  }
  /** bileti düşen tabak: tezgâh ürünü tezgâha döner (eski kural), mutfak yemeği sessizce gider (stok yok) */
  function geri(j: Job): void { if (j.src === 'counter' && isProduct(j.item.type)) (rt.counter[j.item.type] ||= []).push(j.item as Item); }
  function ticketItems(t: Ticket): TicketView['items'] {
    const m = new Map<string, TicketView['items'][number]>();
    for (const l of t.lines) {
      const key = l.food;
      let it = m.get(key);
      if (!it) { const d = l.dish ? DISH_BY_ID[l.dish] : null; it = { p: l.food, dish: l.dish, name: d ? (l.kurs > 1 ? d.ad + ' (' + l.kurs + ' servis)' : d.ad) : yemekAd(l.food), n: 0, left: 0 }; m.set(key, it); }
      it.n++; if (!l.done) it.left++;
    }
    return [...m.values()];
  }
  function view(): RestoranView {
    const g = G();
    return {
      active: active(), servis: Math.round(g.servis * 10) / 10,
      tickets: tickets.map(t => ({ no: t.no, table: t.table, frac: clamp(t.t / t.max, 0, 1),
        items: ticketItems(t) })),
      stands: [],
      ...hat.view(), sefHizi: sefHizi(S.workers),
    };
  }
  const api: RestoranApi = {
    hat,
    garsonClaim(wid, n) {
      const out: { id: number; p: FoodId; x: number; z: number }[] = [];
      for (const j of jobs) { if (out.length >= n) break; if (j.wid && j.wid !== wid) continue; j.wid = wid; const tb = rt.layout.tables[j.ticket.table]; if (tb) out.push({ id: j.id, p: j.p, x: tb.x, z: tb.z }); }
      return out;
    },
    masaClaim(wid) {
      const j = masaJobs.find(k => k.wid === wid) || masaJobs.find(k => !k.wid); if (!j) return null;
      j.wid = wid; j.t = 0;   // süre garsonun işi aldığı andan sayılır (yürürken silinmesin)
      const tb = rt.layout.tables[j.table]; return { id: j.id, kind: j.kind, x: tb?.x ?? 0, z: tb?.z ?? 0 };
    },
    masaDone(wid, id) {
      const i = masaJobs.findIndex(k => k.id === id && k.wid === wid); if (i < 0) return;
      const j = masaJobs.splice(i, 1)[0], c = rt.customers.find(k => k.id === j.cid); if (!c) return;
      const f = c as unknown as CF;
      K.stat(j.kind === 'menu' ? 'menuGetir' : 'hesapGetir');
      if (j.kind === 'menu') { f.menuOk = true; cu.say(c, rng.pick(['Teşekkürler, bakalım...', 'Ne güzel menü!', 'Hmm, ne yesek?']), 1.6); }
      else { f.hesapBekle = false; cu.say(c, rng.pick(['Hesap tamam, eline sağlık!', 'Üstü kalsın!', 'Çok iyiydi.']), 1.8); }
    },
    kitchenClaim: (wid, opt) => hat.claim(wid, opt?.from),
    kitchenIst: wid => hat.ist(wid),
    kitchenSure: wid => hat.sure(wid),
    kitchenReady: wid => hat.ready(wid),
    kitchenTasi: (wid, opt) => hat.tasiClaim(wid, opt),
    kitchenTasiAl: wid => hat.tasiAl(wid),
    kitchenPass: wid => hat.done(wid),
    kitchenDrop: wid => hat.drop(wid),
    kitchenBekleyen: yas => hat.bekleyenTepsi(yas),
    kitchenDone(wid, ok) {
      if (!ok) { hat.drop(wid); return; }
      if (hat.ist(wid) && hat.ready(wid) && hat.tasiClaim(wid, { kendi: true })) hat.tasiAl(wid);
      if (hat.elde(wid) && !hat.done(wid)) hat.drop(wid);
    },
    passDurak(wid) { return jobs.some(j => j.wid === wid && j.src === 'pass') ? mutfakDunya(MUTFAK_NOKTA.passGarson) : null; },
    garsonOpen(wid) { return jobs.filter(j => j.wid === wid).map(j => { const tb = rt.layout.tables[j.ticket.table]; return { id: j.id, p: j.p, x: tb?.x ?? 0, z: tb?.z ?? 0 }; }); },
    garsonDone(wid, id) {
      const i = jobs.findIndex(j => j.id === id && j.wid === wid); if (i < 0) return false;
      const j = jobs.splice(i, 1)[0], c = custOf(j.ticket);
      if (c && tickets.includes(j.ticket)) deliver(j.ticket, c, j.item); else geri(j);
      return true;
    },
    handle() { return false; },
    view, wantMasa, update, register,
    menu: () => menuPano(S.stage || 1),
    openDishes: () => dishesNow().map(d => d.id),
  };
  (rt as unknown as { restoran?: RestoranApi }).restoran = api;
  return api;
}
