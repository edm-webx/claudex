/**
 * Faz 2 restoran sistemi (content/restoran.ts): stantlar (buy / impulse sales / refill) and the adisyon (ticket)
 * table service. Pure sim: no three, no DOM, seeded rng only. Persistent bits live in GameState.zones['restoran']
 * (created on first read, so old saves load untouched); tickets are runtime only (table guests don't survive a reload).
 *
 * Interactables (dwell rule like everything else):
 *   `stantal.<id>` buy plate of a stand (0.8 s stand-still, then it's bought if the money is there),
 *   `stant.<id>`   refill one portion per tick, ingredients paid now (no money -> stops),
 *   `servis.<i>`   at table i: hand over one item from the hands that the table's ticket still wants.
 * Hooks used by customers.ts: rt.restoran.wantMasa() (spawner), .impulse(c) (after a counter sale).
 * Views/UI read restoranApi(rules).view().
 */
import { mutfakEtki } from '../../content/mutfak';
import { ADISYON, ADISYON_LINES, SERVIS, STANTLAR, STANT_SPOTS, STANT_STAND_D, type StantDef, FAZ2_UI } from '../../content/restoran';
import { PRODUCTS } from '../../content/products';
import type { Vec2 } from '../../engine/api';
import type { ProductId } from './schema';
import type { Kernel, Customer, Item, Order } from './state';
import { fmtMoney, clamp } from './util';

export const RESTORAN_KEY = 'restoran';
interface Save { pos?: Record<string, { x: number; z: number; ry: number }>; owned: string[]; stock: Record<string, number>; servis: number; no: number; sold: number }
export interface Ticket { no: number; table: number; cid: number; want: Order; all: Order; t: number; max: number; special: boolean }
export interface TicketView { no: number; table: number; items: { p: ProductId; name: string; n: number; left: number }[]; frac: number; special: boolean }
export interface StantView { id: string; name: string; short: string; owned: boolean; buyable: boolean; cost: number; price: number; stock: number; max: number; x: number; z: number; ry: number; look: StantDef['look']; color: string }
export interface RestoranView { active: boolean; tickets: TicketView[]; servis: number; special: ProductId | null; specialName: string; stands: StantView[] }
export interface RestoranApi {
  handle(c: { kind: string; [k: string]: unknown }): boolean;
  view(): RestoranView;
  wantMasa(): boolean;
  impulse(c: Customer): void;
  update(dt: number): void;
  register(): void;
  /** 2026-11-09 garson flow: claim up to n plates waiting at the pass (counter), deliver one at its table */
  garsonClaim?(wid: number, n: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonOpen?(wid: number): { id: number; p: ProductId; x: number; z: number }[];
  garsonDone?(wid: number, id: number): boolean;
}
type Cu = { leave(c: Customer, angry: boolean): void; say(c: Customer, t: string, s?: number): void; seatPos(t: number, s: number): Vec2 | null };

export function restoranApi(r: { rt: unknown } | null | undefined): RestoranApi | null { return r ? ((r.rt as { restoran?: RestoranApi }).restoran || null) : null; }

export function installRestoran(K: Kernel, cu: Cu, settle: (c: Customer, items: Item[]) => number, addMoneyTo: (p: { value: number }[], v: number) => void): RestoranApi {
  const rt = K.rt, S = K.state, rng = K.rng('sim.restoran');
  const G = (): Save => {
    if (!S.zones || typeof S.zones !== 'object') S.zones = {};
    let g = S.zones[RESTORAN_KEY] as unknown as Save | undefined;
    if (!g || typeof g !== 'object') { g = {} as Save; S.zones[RESTORAN_KEY] = g as unknown as Record<string, unknown>; }
    if (!Array.isArray(g.owned)) g.owned = [];
    if (!g.stock || typeof g.stock !== 'object') g.stock = {};
    g.servis = Number.isFinite(g.servis) ? g.servis : SERVIS.start; g.no = g.no | 0; g.sold = g.sold | 0;
    return g;
  };
  const tickets: Ticket[] = [];
  // plates a garson carries from the pass to a table; unclaimed or stuck plates are delivered by the old abstract rule after a while
  type Job = { id: number; ticket: Ticket; p: ProductId; item: Item; t: number; wid: number };
  const jobs: Job[] = []; let jobId = 1;
  const active = () => (S.stage || 1) >= ADISYON.fromStage;
  // 2026-10-25 user: stands can be moved in the editor; the moved place is part of the save (cloud), so it stays after teleporting away and back
  const spot = (d: StantDef) => { const o = G().pos?.[d.id]; if (o && Number.isFinite(o.x) && Number.isFinite(o.z)) return { x: o.x, z: o.z, ry: Number(o.ry) || 0 }; const s = STANT_SPOTS[d.spot % STANT_SPOTS.length]; return { x: s[0], z: s[1], ry: s[2] }; };
  const padAt = (d: StantDef): Vec2 => { const p = spot(d); return { x: p.x + Math.sin(p.ry) * 0.9, z: p.z + Math.cos(p.ry) * 0.9 }; };
  const standAt = (d: StantDef): Vec2 => { const p = spot(d); return { x: p.x + Math.sin(p.ry) * STANT_STAND_D, z: p.z + Math.cos(p.ry) * STANT_STAND_D }; };
  const owned = (id: string) => G().owned.includes(id);
  const custOf = (t: Ticket) => rt.customers.find(c => c.id === t.cid) || null;
  const special = (): ProductId | null => {
    const open = K.openProducts(); if (!open.length) return null;
    return open[(S.day * 7 + 3) % open.length];
  };
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
    const g = G(), sp = special();
    const want: Order = {};
    let n = 0;
    for (const p in c.order) { const k = Math.min(c.order[p as ProductId] || 0, ADISYON.maxItems - n); if (k > 0) { want[p as ProductId] = k; n += k; } }
    let isSp = false;
    if (sp && !want[sp] && n < ADISYON.maxItems && rng.next() < 0.35) { want[sp] = 1; isSp = true; cu.say(c, rng.pick(ADISYON_LINES.special), 2); }
    else if (sp && want[sp]) isSp = true;
    if (!Object.keys(want).length) want[K.openProducts()[0] || 'cay'] = 1;
    c.order = { ...want }; c.got = {};
    g.no = (g.no % 99) + 1;
    tickets.push({ no: g.no, table: c.seat.table, cid: c.id, want: { ...want }, all: { ...want }, t: 0, max: ADISYON.patience, special: isSp });
    K.logEv('ticket', { no: g.no, table: c.seat.table, x: c.x, z: c.z });
  }
  function deliver(t: Ticket, c: Customer, it: Item): void {
    const p = it.type;
    if (t.special && p === special()) it.priceX = (it.priceX || 1) * (1 + ADISYON.special);
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

  // ───────── stands ─────────
  function buyStant(id: string, prepaid = false): void {
    const d = STANTLAR.find(x => x.id === id), g = G();
    if (!d || owned(id)) return;
    if ((S.stage || 1) < 2) return;
    if (!prepaid && S.money < d.cost) { K.toast(d.name + ' için ' + fmtMoney(d.cost) + ' lazım.', 'bad'); return; }
    if (!prepaid) K.spend(d.cost);
    g.owned.push(id); g.stock[id] = Math.round(d.stock / 2);
    K.toast(d.name + ' kuruldu! Stok bitince başına geçip doldur.', 'good');
    K.logEv('stantBuy', { id }); K.saveNow(); register();
  }
  function impulse(c: Customer): void {
    if (c.kind !== 'q') return;
    const g = G(), h = K.hour();
    for (const d of STANTLAR) {
      if (!g.owned.includes(d.id) || (g.stock[d.id] || 0) <= 0) continue;
      const busy = d.hours && h >= d.hours[0] && h < d.hours[1] ? 1.6 : 1;
      if (rng.next() >= d.chance * busy) continue;
      g.stock[d.id]--; g.sold++;
      const v = d.price;
      addMoneyTo(rt.kasa, v); S.today!.earned += v; S.week.earned += v; S.totalEarned += v; rt.incomeWin.push([S.playT, v]);
      const tt = S.today as unknown as { sales?: number }; tt.sales = (tt.sales || 0) + v;
      K.stat('stant_' + d.id); K.logEv('stantSale', { id: d.id, v });
      return; // one impulse per guest
    }
  }
  let lastNoMoney = -99;
  const regIds = new Set<string>();
  function register(): void {
    if (!FAZ2_UI) return;
    for (const d of STANTLAR) {
      const buyId = 'stantal.' + d.id, refId = 'stant.' + d.id;
      if (!owned(d.id) && !regIds.has(buyId)) {
        regIds.add(buyId);
        // Faz 2: a yellow pad like every other unit: money flows from the pocket while the player stands on it
        // (same rate as pads.ts), the paid part is kept in S.padPaid, the stand is built when it is full.
        const pos = padAt(d), key = 'stant.' + d.id; let warned = false;
        K.interactions.register({
          id: buyId, pos, radius: 0.8, kind: 'pad', dwell: 0, interval: 0.05,
          canAct: () => !owned(d.id) && S.stage >= 2,
          act: () => {
            const paid = S.padPaid[key] || 0, left = d.cost - paid;
            if (S.money < 1) { if (!warned) { warned = true; K.toast('Para lazım: müşterilere satış yap, kasayı topla.', 'info'); } return 'continue'; }
            const amt = Math.min(Math.max(d.cost / 1.2, 250) * 0.05, S.money, left);
            S.money -= amt; S.padPaid[key] = paid + amt;
            if (S.padPaid[key] >= d.cost - 0.01) { delete S.padPaid[key]; S.money = Math.max(0, S.money); buyStant(d.id, true); return 'done'; }
            return 'continue';
          },
        });
      }
      if (owned(d.id)) {
        if (regIds.has(buyId)) { regIds.delete(buyId); K.interactions.unregister(buyId); }
        if (!regIds.has(refId)) {
          regIds.add(refId);
          K.interactions.register({
            id: refId, pos: standAt(d), radius: 0.8, kind: 'station', dwell: 0.4, interval: 0.15,
            canAct: () => (G().stock[d.id] || 0) < d.stock,
            act: (_a, ctx) => {
              const g = G(), cost = Math.max(1, Math.round(d.price * d.maliyet));
              if ((g.stock[d.id] || 0) >= d.stock) return 'done';
              if (S.money < cost) { if (ctx.t - lastNoMoney > 4) { lastNoMoney = ctx.t; K.toast('Malzemeye para yetmiyor abi.', 'bad'); } return 'done'; }
              K.spend(cost); g.stock[d.id] = (g.stock[d.id] || 0) + 1;
              K.logEv('stantRefill', { id: d.id });
              return 'continue';
            },
          });
        }
      }
    }
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
    // Faz 2: buyable stands show as yellow pads (drawn by view/world/rtview.ts with fill), like every other unit
    if (FAZ2_UI) for (const d of STANTLAR) {
      const key = 'stant.' + d.id, i = rt.pads.findIndex(p => p.key === key);
      const show = !owned(d.id) && S.stage >= 2;
      if (show && i < 0) rt.pads.push({ key, price: d.cost, paid: S.padPaid[key] || 0, pos: padAt(d), kind: 'stant', warned: false, label: d.short, sub: d.name });
      else if (!show && i >= 0) rt.pads.splice(i, 1);
      else if (show && i >= 0) rt.pads[i].pos = padAt(d);
    }
    // seated table guests: print the ticket after a short look at the menu
    for (const c of rt.customers) {
      if (c.kind !== 'masa' || c.state !== 'wait') continue;
      if (!tickets.some(t => t.cid === c.id) && c.t >= ADISYON.orderDelay && !(c as unknown as { tk?: boolean }).tk) {
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
    if (!FAZ2_UI || !active() || tickets.length >= ADISYON.maxOpen) return false;
    const sh = (ADISYON.share[(S.stage || 1) - 1] ?? 0) + Math.max(0, G().servis - 3) * SERVIS.sharePerStar;
    if (rng.next() >= sh) return false;
    return freeTable() >= 0;
  }
  function view(): RestoranView {
    const g = G(), sp = special();
    return {
      active: active(), servis: Math.round(g.servis * 10) / 10, special: active() ? sp : null, specialName: sp ? PRODUCTS[sp].short : '',
      tickets: tickets.map(t => ({ no: t.no, table: t.table, frac: clamp(t.t / t.max, 0, 1), special: t.special,
        items: (Object.keys(t.all) as ProductId[]).map(p => ({ p, name: PRODUCTS[p].short, n: t.all[p] || 0, left: t.want[p] || 0 })) })),
      stands: STANTLAR.map(d => { const s = spot(d); return { id: d.id, name: d.name, short: d.short, owned: g.owned.includes(d.id), buyable: (S.stage || 1) >= 2, cost: d.cost, price: d.price, stock: g.stock[d.id] || 0, max: d.stock, x: s.x, z: s.z, ry: s.ry, look: d.look, color: d.color }; }),
    };
  }
  const api: RestoranApi = {
    garsonClaim(wid, n) {
      const out: { id: number; p: ProductId; x: number; z: number }[] = [];
      for (const j of jobs) { if (out.length >= n) break; if (j.wid && j.wid !== wid) continue; j.wid = wid; const tb = rt.layout.tables[j.ticket.table]; if (tb) out.push({ id: j.id, p: j.p, x: tb.x, z: tb.z }); }
      return out;
    },
    garsonOpen(wid) { return jobs.filter(j => j.wid === wid).map(j => { const tb = rt.layout.tables[j.ticket.table]; return { id: j.id, p: j.p, x: tb?.x ?? 0, z: tb?.z ?? 0 }; }); },
    garsonDone(wid, id) {
      const i = jobs.findIndex(j => j.id === id && j.wid === wid); if (i < 0) return false;
      const j = jobs.splice(i, 1)[0], c = custOf(j.ticket);
      if (c && tickets.includes(j.ticket)) deliver(j.ticket, c, j.item); else (rt.counter[j.p] ||= []).push(j.item);
      return true;
    },
    handle(c) {
      if (c.op === 'buyStant') { buyStant(String(c.id)); return true; }
      if (c.op === 'stantMove') {
        const d = STANTLAR.find(x => x.id === String(c.id)); if (!d) return true;
        const p = spot(d), g = G(); if (!g.pos) g.pos = {};
        const cl = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
        g.pos[d.id] = { x: cl(p.x + (Number(c.dx) || 0), -16, 16), z: cl(p.z + (Number(c.dz) || 0), -8, 9), ry: p.ry + (Number(c.dry) || 0) };
        const it = K.interactions.get('stantal.' + d.id); if (it) it.pos = padAt(d);
        const rf = K.interactions.get('stant.' + d.id); if (rf) rf.pos = standAt(d);
        K.saveNow(); return true;
      }
      return false;
    },
    view, wantMasa, impulse, update, register,
  };
  (rt as unknown as { restoran?: RestoranApi }).restoran = api;
  return api;
}
