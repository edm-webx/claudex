/**
 * Faz 2 restoran sistemi (content/restoran.ts): the adisyon (ticket) table service. Pure sim: no three, no DOM, seeded rng only. Persistent bits live in GameState.zones['restoran']
 * (created on first read, so old saves load untouched); tickets are runtime only (table guests don't survive a reload).
 *
 * Interactables (dwell rule like everything else):
 *   `servis.<i>`   at table i: hand over one item from the hands that the table's ticket still wants.
 * Hooks used by customers.ts: rt.restoran.wantMasa() (spawner).
 * Views/UI read restoranApi(rules).view().
 */
import { mutfakEtki } from '../../content/mutfak';
import { ADISYON, ADISYON_LINES, SERVIS, FAZ2_UI } from '../../content/restoran';
import { PRODUCTS } from '../../content/products';
import type { Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Customer, Item, Order } from './state';
import { clamp } from './util';

export const RESTORAN_KEY = 'restoran';
interface Save { servis: number; no: number }
export interface Ticket { no: number; table: number; cid: number; want: Order; all: Order; t: number; max: number }
export interface TicketView { no: number; table: number; items: { p: ProductId; name: string; n: number; left: number }[]; frac: number }
/** Kaldırılan stant sisteminden kalan boş sözleşme: stant-look.ts / world/index.ts / boot.ts temizlenene kadar. */
export interface StantView { id: string; name: string; short: string; owned: boolean; buyable: boolean; cost: number; price: number; stock: number; max: number; x: number; z: number; ry: number; look: string; color: string }
export interface RestoranView { active: boolean; tickets: TicketView[]; servis: number; stands: StantView[] }
export interface RestoranApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): RestoranView;
  wantMasa(): boolean;
  update(dt: number): void;
  register(): void;
  /** 2026-11-09 garson flow: claim up to n plates waiting at the pass (counter), deliver one at its table */
  garsonClaim?(wid: number, n: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonOpen?(wid: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonDone?(wid: number, id: number): boolean;
  kitchenClaim?(wid: number): ProductId | null;
  kitchenDone?(wid: number, ok: boolean): void;
  /** waiter table visits: bring the menu, bring the bill (survey waiter flow menü→sipariş→pass→masa→hesap→sil) */
  masaClaim?(wid: number): { id: number; kind: 'menu' | 'hesap'; x: number; z: number } | null;
  masaDone?(wid: number, id: number): void;
}
type Cu = { leave(c: Customer, angry: boolean): void; say(c: Customer, t: string, s?: number): void; seatPos(t: number, s: number): Vec2 | null };

export function restoranApi(r: { rt: unknown } | null | undefined): RestoranApi | null { return r ? ((r.rt as { restoran?: RestoranApi }).restoran || null) : null; }

export function installRestoran(K: Kernel, cu: Cu, settle: (c: Customer, items: Item[]) => number, addMoneyTo: (p: { value: number }[], v: number) => void): RestoranApi {
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
  type Job = { id: number; ticket: Ticket; p: ProductId; item: Item; t: number; wid: number };
  const jobs: Job[] = []; let jobId = 1;
  type Masa = { id: number; kind: 'menu' | 'hesap'; cid: number; table: number; t: number; wid: number };
  const masaJobs: Masa[] = [];
  type CF = { tk?: boolean; menuJob?: boolean; menuOk?: boolean; hesapJob?: boolean; hesapBekle?: boolean };
  const cooking: { wid: number; ticket: Ticket; p: ProductId; t: number }[] = [];   // plates a kitchen cook is making for a ticket
  const active = () => (S.stage || 1) >= ADISYON.fromStage;
  const custOf = (t: Ticket) => rt.customers.find(c => c.id === t.cid) || null;
  const add = (o: Order, p: ProductId, n = 1) => { o[p] = (o[p] || 0) + n; };
  const left = (t: Ticket) => Object.values(t.want).reduce((s, n) => s + (n || 0), 0);

  // stations produce for open tickets too (room above the counter stock)
  rt.reserved.push(() => { const r: Order = {}; for (const t of tickets) for (const p in t.want) add(r, p as ProductId, t.want[p as ProductId] || 0); return r; });

  function freeTable(): number {
    for (let i = 0; i < rt.tables.length; i++) {
      const t = rt.tables[i];
      if (t && t.built && t.dirty <= 0 && t.seats.every(s => !s.occ) && !tickets.some(k => k.table === i)) return i;
    }
    return -1;
  }
  function openTicket(c: Customer): void {
    if (!c.seat) return;
    const g = G();
    const want: Order = {};
    let n = 0;
    for (const p in c.order) { const k = Math.min(c.order[p as ProductId] || 0, ADISYON.maxItems - n); if (k > 0) { want[p as ProductId] = k; n += k; } }
    if (!Object.keys(want).length) want[K.openProducts()[0] || 'cay'] = 1;
    c.order = { ...want }; c.got = {};
    g.no = (g.no % 99) + 1;
    tickets.push({ no: g.no, table: c.seat.table, cid: c.id, want: { ...want }, all: { ...want }, t: 0, max: ADISYON.patience });
    K.logEv('ticket', { no: g.no, table: c.seat.table, x: c.x, z: c.z });
  }
  function deliver(t: Ticket, c: Customer, it: Item): void {
    const p = it.type;
    c.items.push(it); add(c.got, p);
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
    for (let i = cooking.length - 1; i >= 0; i--) { cooking[i].t += dt; if (cooking[i].t > 40 || !tickets.includes(cooking[i].ticket)) cooking.splice(i, 1); }
    // garsons carry plates from the pass (counter stock) to the tables: a job is a plate taken off the counter, a garson walks it over
    const g = S.workers.filter(w => w.role === 'garson').length;
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i], c = custOf(j.ticket); j.t += dt;
      if (!tickets.includes(j.ticket) || !c) { (rt.counter[j.p] ||= []).push(j.item); jobs.splice(i, 1); continue; }
      if ((!j.wid && j.t > 12) || j.t > 30) { jobs.splice(i, 1); deliver(j.ticket, c, j.item); }
    }
    if (g > 0 && tickets.length && jobs.length < g * 3) {
      garsonT -= dt;
      if (garsonT <= 0) {
        garsonT = 0.8;
        for (const t of tickets) {
          const p = (Object.keys(t.want) as ProductId[]).find(q => (rt.counter[q]?.length || 0) > 0 && jobs.filter(j => j.ticket === t && j.p === q).length < (t.want[q] || 0));
          if (!p) continue;
          jobs.push({ id: jobId++, ticket: t, p, item: rt.counter[p].pop()!, t: 0, wid: 0 });
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
  function view(): RestoranView {
    const g = G();
    return {
      active: active(), servis: Math.round(g.servis * 10) / 10,
      tickets: tickets.map(t => ({ no: t.no, table: t.table, frac: clamp(t.t / t.max, 0, 1),
        items: (Object.keys(t.all) as ProductId[]).map(p => ({ p, name: PRODUCTS[p].short, n: t.all[p] || 0, left: t.want[p] || 0 })) })),
      stands: [],
    };
  }
  const api: RestoranApi = {
    garsonClaim(wid, n) {
      const out: { id: number; p: ProductId; x: number; z: number }[] = [];
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
    kitchenClaim(wid) {
      if (cooking.some(c => c.wid === wid)) return null;
      // tezgahtaki hazır tabaklar da hesaba katılır: toplam ihtiyaç - yoldaki işler - pişen - tezgah
      const spare: Partial<Record<ProductId, number>> = {};
      for (const t of tickets) for (const p of Object.keys(t.want) as ProductId[]) {
        spare[p] ??= rt.counter[p]?.length || 0;
        let left = (t.want[p] || 0) - jobs.filter(j => j.ticket === t && j.p === p).length - cooking.filter(c => c.ticket === t && c.p === p).length;
        const use = Math.min(Math.max(0, left), spare[p]!); spare[p]! -= use; left -= use;
        if (left > 0) { cooking.push({ wid, ticket: t, p, t: 0 }); return p; }
      }
      return null;
    },
    kitchenDone(wid, ok) {
      const i = cooking.findIndex(c => c.wid === wid); if (i < 0) return;
      const c = cooking.splice(i, 1)[0];
      if (ok && tickets.includes(c.ticket)) { const b = (rt.counter[c.p] ||= []); if (b.length < 8) b.push({ type: c.p, tier: S.tiers[c.p] || 1 } as Item); }
    },
    garsonOpen(wid) { return jobs.filter(j => j.wid === wid).map(j => { const tb = rt.layout.tables[j.ticket.table]; return { id: j.id, p: j.p, x: tb?.x ?? 0, z: tb?.z ?? 0 }; }); },
    garsonDone(wid, id) {
      const i = jobs.findIndex(j => j.id === id && j.wid === wid); if (i < 0) return false;
      const j = jobs.splice(i, 1)[0], c = custOf(j.ticket);
      if (c && tickets.includes(j.ticket)) deliver(j.ticket, c, j.item); else (rt.counter[j.p] ||= []).push(j.item);
      return true;
    },
    handle() { return false; },
    view, wantMasa, update, register,
  };
  (rt as unknown as { restoran?: RestoranApi }).restoran = api;
  return api;
}
