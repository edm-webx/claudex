/**
 * Customers (v2 spawnCustomer / updateCustomers / payAndGo / finishMeal): logical parties with an order, patience,
 * a queue spot, then maybe a seat. Bodies are agents-SoA slots recruited from C's ambient pool (best effort: the economy
 * never depends on how many bodies exist). Owner: Builder A. Pure; randomness only from ctx.rng streams.
 * queue.ts holds the counter-buying step, window.ts the ferry-window customers.
 */
import type { Vec2 } from '../../engine/api';
import { angLerp } from '../../engine/core';
import { CITIZENS } from '../../content/citizens';
import { PRODUCT_IDS } from '../../content/products';
import { P, PATIENCE_S, TIP_FRAC, decorKeyif } from '../../content/economy';
import { LINES } from '../../content/lines';
import { ISKELE_ZONE } from '../../content/zones/iskele';
import type { CitizenTypeDef } from '../../content/types';
import { AGENT_FLAG, ACT_ORDER, MOOD_ORDER, type ProductId } from './schema';
import type { Kernel, Customer, Order } from './state';
import { clamp, dist2d, hourOf, inHours, near2, pointBack } from './util';
import { setChance, setById } from './sets';
import { SETS } from '../../content/products';
import { havaOf } from './hava';
import { STAGE_ARRIVAL } from '../../content/ekonomi2';
import { yatirimFx } from './yatirim';
import { tabelaFx } from './tabela';
import { yetenekFxOf } from './yetenek';

const A_IDLE = ACT_ORDER.indexOf('idle'), A_WALK = ACT_ORDER.indexOf('walk'), A_CARRY = ACT_ORDER.indexOf('carry'), A_SIT = ACT_ORDER.indexOf('sit'), A_EAT = ACT_ORDER.indexOf('eat');

export interface SpawnOpts { type?: CitizenTypeDef; n?: number; order?: Order; set?: string | null; from?: Vec2; near?: Vec2; kind?: 'q' | 'win' | 'masa'; patienceX?: number; say?: string; follower?: boolean; tag?: string }

export function installCustomers(K: Kernel, tipMult: () => number, addMoneyTo: (p: { value: number }[], v: number) => void, settle: (c: Customer, items: import('./state').Item[]) => number) {
  const rt = K.rt, S = K.state;
  const rng = K.R.main;
  let seq = 1;
  const restoranHook = () => (rt as unknown as { restoran?: { wantMasa(): boolean; impulse(c: Customer): void } }).restoran;
  const spawns: Vec2[] = (() => {
    const a = (K.content.zones?.iskele?.anchors) ?? ISKELE_ZONE.anchors;
    const l: Vec2[] = [];
    for (const k of ['spawn.0', 'spawn.1']) if (a[k]) l.push({ x: a[k].pos.x, z: a[k].pos.z });
    return l.length ? l : [{ x: -60, z: 8.8 }, { x: 60, z: 8.8 }];
  })();
  const month = () => Number(S.calendar.slice(5, 7)) || 6;
  const spawnPoint = (): Vec2 => spawns[Math.floor(K.R.main.next() * spawns.length)];
  const nearestSpawn = (p: Vec2): Vec2 => { let b = spawns[0], bd = 1e9; for (const s of spawns) { const d = dist2d(s, p); if (d < bd) { bd = d; b = s; } } return b; };
  const farthestSpawn = (p: Vec2): Vec2 => { let b = spawns[0], bd = -1; for (const s of spawns) { const d = dist2d(s, p); if (d > bd) { bd = d; b = s; } } return b; };
  const pathTo = (from: Vec2, to: Vec2): Vec2[] => { const p = K.nav.path(from, to); return p.length ? p.map(v => ({ x: v.x, z: v.z })) : [{ x: to.x, z: to.z }]; };
  const queueSpot = (i: number): Vec2 => { const q = rt.layout.queue; const v = q[Math.min(i, q.length - 1)]; return { x: v.x, z: v.z }; };
  const winSpot = (i: number): Vec2 => { const q = rt.layout.window.queue; const v = q[Math.min(i, q.length - 1)]; return { x: v.x, z: v.z }; };
  const openProducts = () => K.openProducts();
  const orderLeft = (c: { order: Order; got: Order }): Order => { const l: Order = {}; for (const p in c.order) { const k = (c.order[p as ProductId] || 0) - (c.got[p as ProductId] || 0); if (k > 0) l[p as ProductId] = k; } return l; };

  function pickType(): CitizenTypeDef {
    const h = K.hour(), open = openProducts();
    const w: Record<string, number> = {};
    for (const t of CITIZENS) {
      const fanHere = t.id === 'taraftar' && !!(rt as unknown as { macGunu?: unknown }).macGunu && h >= 11 && h < 26;
      if (t.scenery || t.ferry || (t.months && !t.months.includes(month())) || (!inHours(t.hours, h) && !fanHere)) continue;
      let x = t.w * (inHours(t.peak, h) ? 2 : 1);
      if (t.id === 'taraftar' && (rt as unknown as { macGunu?: unknown }).macGunu) x *= 9;   // maç günü: fans everywhere
      const pref = Object.keys(t.prefer).filter(p => open.includes(p as ProductId));
      x *= 0.35 + 0.65 * pref.length / Object.keys(t.prefer).length;
      if (x > 0) w[t.id] = x;
    }
    if (!Object.keys(w).length) return CITIZENS.find(t => t.id === 'universiteli')!;
    const id = K.R.main.weighted(w);
    return CITIZENS.find(t => t.id === id)!;
  }
  function makeOrder(type: CitizenTypeDef, n: number): { order: Order; set: string | null } {
    const open = openProducts(), order: Order = {};
    const prefs: Record<string, number> = {};
    for (const p of Object.keys(type.prefer)) if (open.includes(p as ProductId)) prefs[p] = (type.prefer[p as ProductId] as number) * (havaOf(rt)?.pref(p as ProductId) ?? 1);
    if (!Object.keys(prefs).length) prefs[open.includes('doner') ? 'doner' : open[0]] = 1;
    const per = rng.int(type.items[0], type.items[1]);
    const total = clamp(Math.round(n * per * (n > 2 ? 0.75 : 1)), 1, 6);
    for (let i = 0; i < total; i++) { const p = rng.weighted(prefs) as ProductId; order[p] = (order[p] || 0) + 1; }
    let set: string | null = null;
    if (rng.chance(setChance(!!(S.sign && S.sign.renamed)))) {
      const cands = SETS.filter(s => s.items.every(p => open.includes(p)) && s.items.some(p => order[p]));
      if (cands.length) { const sd = rng.pick(cands); set = sd.id; for (const p of sd.items) if (!order[p]) order[p] = 1; }
    }
    return { order, set };
  }
  function arrivalPerMin(): number {
    const open = openProducts().length, h = K.hour();
    // 2026-10-24 ("aşırı yavaş"): a few more walk-ins from the start (was 3.6 + 1.25 per open station)
    let k = 4.3 + 1.45 * (open - 1) + (STAGE_ARRIVAL[S.stage - 1] ?? 2.2 * (S.stage - 1)) + 0.45 * K.hiredCount() + 0.35 * K.tablesBuilt();
    k *= h < 10 ? 0.85 : h < 12 ? 1.0 : h < 14 ? 1.25 : h < 18 ? 1.0 : h < 21 ? 1.15 : h < 24 ? 0.8 : h < 25 ? 0.45 : h < 26 ? 0.22 : 0.08;   // after midnight the pier empties
    k *= 1 + K.siklikBonus() + yatirimFx(S, 'reklam') + tabelaFx(S as never, h) + yetenekFxOf(rt).arrival;
    if ((rt as unknown as { macGunu?: unknown }).macGunu && h >= 11 && h < 24) k *= 1.35;   // maç günü crowd
    k *= havaOf(rt)?.arrival() ?? 1; // hava.ts: weather, events, Gece Pazarı
    if (S.playT < 115) k = Math.min(k, 4.2);
    return k;
  }
  function recruitBody(type: CitizenTypeDef, at: Vec2): number {
    const amb = K.ambient; if (!amb) return -1;
    let slot = amb.recruit(id => id === type.id);
    if (slot < 0) slot = amb.recruit();
    if (slot < 0) return -1;
    const a = K.agents, idx = CITIZENS.indexOf(type);
    a.u8('typeId')[slot] = idx;
    a.f32('x')[slot] = a.f32('px')[slot] = at.x; a.f32('z')[slot] = a.f32('pz')[slot] = at.z;
    a.u16('flags')[slot] = (a.u16('flags')[slot] | AGENT_FLAG.customer | AGENT_FLAG.visible) & ~AGENT_FLAG.ambient;
    a.u8('zone')[slot] = 0;
    return slot;
  }
  function goTo(c: Customer, to: Vec2): void { c.path = pathTo({ x: c.x, z: c.z }, to); }
  function walkPath(c: Customer, dt: number, speed: number): boolean {
    let left = speed * dt; let moved = false;
    while (c.path.length && left > 0) {
      const p = c.path[0], dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
      if (d < 0.02) { c.path.shift(); continue; }
      c.rot = angLerp(c.rot, Math.atan2(dx, dz), Math.min(1, dt * 10));
      if (left >= d) { c.x = p.x; c.z = p.z; left -= d; c.path.shift(); } else { c.x += dx / d * left; c.z += dz / d * left; left = 0; }
      moved = true;
    }
    c.speed = moved ? speed : 0;
    return c.path.length > 0;
  }
  const faceTo = (c: Customer, t: Vec2, dt: number) => { c.rot = angLerp(c.rot, Math.atan2(t.x - c.x, t.z - c.z), Math.min(1, dt * 8)); };
  const say = (c: Customer, t: string, s = 2.2) => { c.say = t; c.sayT = s; };

  function spawnCustomer(o: SpawnOpts = {}): Customer {
    const type = o.type || pickType();
    const n = o.n || rng.int(type.group[0], type.group[1]);
    const mk = o.order ? { order: { ...o.order }, set: o.set || null } : makeOrder(type, n);
    let kind = o.kind || 'q';
    // Faz 2 adisyon: table guests walk straight to a free table (falls back to the queue if none is free)
    const masaSeat = kind === 'masa' ? (() => { for (let i = 0; i < rt.tables.length; i++) { const t = rt.tables[i]; if (t && t.built && t.dirty <= 0 && t.seats.every(s => !s.occ)) return { t: i, seat: 0 }; } return null; })() : null;
    if (kind === 'masa' && !masaSeat) kind = 'q';
    let from = o.from || (o.near ? nearestSpawn(o.near) : spawnPoint());
    if (!o.from && kind === 'q') {
      const spot = queueSpot(rt.queue.length);
      from = pointBack([from, ...pathTo(from, spot)], rng.range(P.ENTRY_M[0], P.ENTRY_M[1]));
    }
    const decorPat = clamp(decorKeyif(K.placedDecor()) * P.DECOR_PATIENCE_PER_KEYIF, 0, P.DECOR_PATIENCE_CAP);
    const pat = (PATIENCE_S[type.patience] || 40) * (1 + decorPat + yatirimFx(S, 'konfor')) * (o.patienceX || 1);
    const c: Customer = {
      id: seq++, typeId: type.id, typeIdx: CITIZENS.indexOf(type), kind, n, order: mk.order, got: {}, set: mk.set, value: 0, state: 'walk',
      t: 0, takeT: 0, eatT: 0, patience: pat, patMax: pat, sit: rng.chance(type.sit) && (havaOf(rt)?.sitOk() ?? true), mood: 'ok', x: from.x, z: from.z, rot: 0, speed: 0, path: [],
      agent: -1, members: [], items: [], seat: null, say: '', sayT: 0, calm: false, follower: !!o.follower, tag: o.tag || null, qi: -1,
    };
    c.agent = recruitBody(type, from);
    for (let i = 1; i < Math.min(n, 3); i++) { const m = recruitBody(type, from); if (m < 0) break; c.members.push(m); }
    rt.customers.push(c);
    if (kind === 'masa' && masaSeat) {
      const t = rt.tables[masaSeat.t];
      c.seat = { table: masaSeat.t, seat: masaSeat.seat }; t.seats[masaSeat.seat].occ = c.id; c.state = 'toSeat'; c.sit = true;
      let m = 0; t.seats.forEach(s => { if (!s.occ && m < c.members.length) { s.occ = c.id; m++; } });
      const tb = rt.layout.tables[masaSeat.t];
      goTo(c, seatPos(masaSeat.t, masaSeat.seat) ?? { x: tb.x, z: tb.z });
    } else if (kind === 'q') { rt.queue.push(c); goTo(c, queueSpot(rt.queue.length - 1)); }
    else { rt.winq.push(c); goTo(c, winSpot(rt.winq.length - 1)); }
    if (o.say) say(c, o.say, 3);
    return c;
  }
  const remove = (arr: Customer[], c: Customer) => { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); };
  function freeSeats(c: Customer) {
    if (!c.seat) return;
    const t = rt.tables[c.seat.table];
    if (t) t.seats.forEach(s => { if (s.occ === c.id) s.occ = 0; });
    c.seat = null;
  }
  function removeCustomer(c: Customer) {
    remove(rt.customers, c); remove(rt.queue, c); remove(rt.winq, c);
    freeSeats(c);
    [c.agent, ...c.members].forEach(a => { if (a >= 0) K.ambient?.release(a); });
    c.agent = -1; c.members = [];
  }
  function leave(c: Customer, angry: boolean) {
    if (c.state === 'leave') return;
    remove(rt.queue, c); remove(rt.winq, c);
    c.state = 'leave'; c.mood = angry ? 'angry' : 'happy';
    freeSeats(c);
    goTo(c, angry ? nearestSpawn({ x: c.x, z: c.z }) : spawnPoint());
  }
  const returnItemsToCounter = (c: Customer) => {
    c.items.splice(0).forEach(it => { const b = rt.counter[it.type]; if (b && b.length < 8) b.push(it); });
    c.got = {};
  };
  function freeSeat(n: number): { t: number; seat: number } | null {
    let best: { t: number; free: number[] } | null = null;
    for (let i = 0; i < rt.tables.length; i++) {
      const t = rt.tables[i];
      if (!t || !t.built || t.dirty > 0) continue;
      const free = t.seats.map((s, k) => (s.occ ? -1 : k)).filter(k => k >= 0);
      if (!free.length) continue;
      if (!best || free.length > best.free.length) best = { t: i, free };
      if (free.length >= n) return { t: i, seat: free[0] };
    }
    return best ? { t: best.t, seat: best.free[0] } : null;
  }
  function payAndGo(c: Customer) {
    const items = c.items.slice();
    const value = settle(c, items);
    c.value = value;
    restoranHook()?.impulse(c); // Faz 2: midye / ıslak burger... stands
    if (rng.chance(0.08)) { // Faz 2: customers comment rarely (owner: just show the order)
      const lines = LINES.type[c.typeId as keyof typeof LINES.type];
      say(c, rng.pick(lines && rng.chance(0.4) ? lines : LINES.happy), 2);
    }
    remove(rt.queue, c);
    const fs = c.sit ? freeSeat(c.n) : null;
    if (fs) {
      const t = rt.tables[fs.t];
      c.seat = { table: fs.t, seat: fs.seat }; t.seats[fs.seat].occ = c.id; c.state = 'toSeat';
      const tb = rt.layout.tables[fs.t];
      goTo(c, seatPos(fs.t, fs.seat) ?? { x: tb.x, z: tb.z });
      let m = 0; t.seats.forEach(s => { if (!s.occ && m < c.members.length) { s.occ = c.id; m++; } });
    } else {
      if (c.sit) { rt.slowSeat = (rt.slowSeat || 0) + 1; S.today!.slow.seats = (S.today!.slow.seats || 0) + 1; if (rng.chance(0.08)) say(c, rng.pick(LINES.sit), 2); }
      c.items.length = 0;
      leave(c, false);
    }
  }
  function seatPos(table: number, seat: number): Vec2 | null {
    const tb = rt.layout.tables[table]; if (!tb) return null;
    const sx = 0.78, s = seat === 0 ? -sx : sx;
    return tb.ax === 'z' ? { x: tb.x, z: tb.z - s } : { x: tb.x + s, z: tb.z };
  }
  function finishMeal(c: Customer) {
    const ti = c.seat ? c.seat.table : -1, t = ti >= 0 ? rt.tables[ti] : null;
    // Survey 2026-10-24: no tips ("bahşiş yok"). Flip TIPS_ON to bring the tip pile back.
    const TIPS_ON = false;
    const tipFrac = (TIP_FRAC[CITIZENS[c.typeIdx].tip] || 0.1) * tipMult() * (havaOf(rt)?.tipX() ?? 1);
    const tip = TIPS_ON ? Math.max(5, Math.round(c.value * tipFrac)) : 0;
    c.items.length = 0;
    if (t && tip > 0) {
      addMoneyTo(t.pile, tip);
      S.today!.earned += tip; S.week.earned += tip; S.totalEarned += tip; rt.incomeWin.push([S.playT, tip]);
      t.dirty++;
      K.stat('tips'); K.logEv('tip', { tip });
    }
    K.logEv('mealDone', { table: ti });
    if (rng.chance(0.06)) say(c, rng.pick(LINES.happy), 2);
    leave(c, false);
  }
  const outOfSight = (c: Customer) => dist2d(c, rt.layout.counter.pos) > P.LEAVE_M;

  function patienceRate(c: Customer): number {
    let k = 1;
    if (rt.queue.indexOf(c) > 2) k *= 0.5;
    let aura = 0;
    for (const f of rt.auras) aura = Math.max(aura, f(c.x, c.z));
    if (aura > 0) { k *= 1 - aura; c.calm = true; }
    if ((c.typeId === 'okul' || c.typeId === 'bebekarabali') && S.cats.some(x => x.id === 'boncuk')) k *= 0.9;
    return k;
  }

  let spawnT = 6;
  function updateSpawner(dt: number) {
    if (!S.tut.firstCustomer) {
      if (S.playT >= 3) {
        S.tut.firstCustomer = 1;
        const q0 = queueSpot(0);
        const start = pointBack([nearestSpawn(q0), ...pathTo(nearestSpawn(q0), q0)], 9);
        spawnCustomer({ type: CITIZENS.find(t => t.id === 'emekli'), n: 1, order: { doner: 1 }, from: start, patienceX: 4 });
        K.logEv('firstCustomer'); spawnT = 16;
      }
      return;
    }
    spawnT -= dt;
    if (spawnT > 0) return;
    spawnT = 60 / arrivalPerMin() * rng.range(0.75, 1.25);
    if (rt.queue.length >= Math.min(P.QUEUE_MAX, rt.layout.queue.length)) { spawnT = 1.5; return; }
    spawnCustomer(restoranHook()?.wantMasa() ? { kind: 'masa' } : {});
  }

  function update(dt: number) {
    const L = rt.layout;
    rt.queue.forEach((c, i) => { if (c.state !== 'leave' && c.qi !== i) { c.qi = i; if (c.state === 'queue' || c.state === 'walk') { c.state = 'walk'; goTo(c, queueSpot(i)); } } });
    rt.winq.forEach((c, i) => { if (c.state !== 'leave' && c.qi !== i) { c.qi = i; if (c.state === 'wqueue' || c.state === 'walk') { c.state = 'walk'; goTo(c, winSpot(i)); } } });
    // the first three in line buy from the counter
    for (let i = 0; i < Math.min(3, rt.queue.length); i++) {
      const c = rt.queue[i];
      if (c.state !== 'queue' || !near2(c, queueSpot(i), 0.35)) continue;
      c.takeT += dt;
      if (c.takeT < 0.22) continue;
      c.takeT = 0;
      const left = orderLeft(c);
      for (const p of PRODUCT_IDS) {
        if (!left[p]) continue;
        const box = rt.counter[p];
        if (box.length) { c.items.push(box.pop()!); c.got[p] = (c.got[p] || 0) + 1; c.patience = Math.min(c.patMax, c.patience + 1.5); break; }
      }
      if (!Object.keys(orderLeft(c)).length) { payAndGo(c); i--; }
    }
    for (let k = rt.customers.length - 1; k >= 0; k--) {
      const c = rt.customers[k];
      c.sayT -= dt; c.t += dt; c.speed = 0;
      switch (c.state) {
        case 'walk': if (!walkPath(c, dt, 1.6)) c.state = c.kind === 'win' ? 'wqueue' : 'queue'; break;
        case 'queue': {
          faceTo(c, L.counter.pos, dt);
          c.patience -= dt * patienceRate(c);
          if (c.patience <= 0) { say(c, rng.pick(LINES.angry), 2.5); S.today!.angry++; K.logEv('angry', { type: c.typeId }); returnItemsToCounter(c); leave(c, true); }
          else if (c.patience < c.patMax * 0.35 && c.sayT < -12 && rng.chance(dt * 0.05)) say(c, rng.pick(LINES.bored), 2);
          break;
        }
        case 'wqueue': faceTo(c, L.window.standAt, dt); if (!rt.window || !rt.window.open) leave(c, false); break;
        case 'toSeat': if (!walkPath(c, dt, 1.6)) { if (c.kind === 'masa') { c.state = 'wait'; c.t = 0; } else { c.state = 'eat'; c.t = 0; c.eatT = rng.range(6, 9) * (havaOf(rt)?.eatX() ?? 1); } } break;
        case 'wait': if (c.seat) { const tb = rt.layout.tables[c.seat.table]; if (tb) faceTo(c, tb, dt); } break; // restoran.ts runs the adisyon
        case 'eat': if (c.t >= c.eatT) finishMeal(c); break;
        case 'leave': if (!walkPath(c, dt, 1.8) || outOfSight(c)) removeCustomer(c); break;
      }
    }
  }

  const anyOfSpot = () => ({ x: 0, z: 0 });
  void anyOfSpot; void hourOf; void setById; void A_EAT;
  /** Write customers into the agents SoA (positions, gait, act, flags). */
  function syncAgents() {
    const a = K.agents;
    const X = a.f32('x'), Z = a.f32('z'), R = a.f32('rot'), SP = a.f32('speed'), ACT = a.u8('act'), MOOD = a.u8('mood'), CARRY = a.u8('carry'), FL = a.u16('flags');
    for (const c of rt.customers) {
      const sit = c.state === 'eat' || c.state === 'wait';
      const write = (slot: number, x: number, z: number, rot: number, seated: boolean) => {
        if (slot < 0 || !a.alive(slot)) return;
        X[slot] = x; Z[slot] = z; R[slot] = rot; SP[slot] = c.speed;
        ACT[slot] = seated ? A_SIT : c.speed > 0 ? (c.items.length ? A_CARRY : A_WALK) : A_IDLE;
        MOOD[slot] = MOOD_ORDER.indexOf(c.mood === 'angry' || (c.state === 'queue' && c.patience / c.patMax < 0.25) ? 'impatient' : c.mood === 'happy' ? 'happy' : 'ok');
        CARRY[slot] = Math.min(255, c.items.length);
        FL[slot] = (FL[slot] | AGENT_FLAG.customer | AGENT_FLAG.visible) & ~(AGENT_FLAG.queued | AGENT_FLAG.seated | AGENT_FLAG.leaving);
        if (c.state === 'queue' || c.state === 'wqueue') FL[slot] |= AGENT_FLAG.queued;
        if (seated) FL[slot] |= AGENT_FLAG.seated;
        if (c.state === 'leave') FL[slot] |= AGENT_FLAG.leaving;
      };
      let sp: Vec2 | null = null;
      if (sit && c.seat) sp = seatPos(c.seat.table, c.seat.seat);
      write(c.agent, sit && sp ? sp.x : c.x, sit && sp ? sp.z : c.z, c.rot, sit);
      c.members.forEach((m, i) => {
        if (sit && c.seat) { const t = rt.tables[c.seat.table]; const free = t.seats.map((s, k) => (s.occ === c.id && k !== c.seat!.seat ? k : -1)).filter(k => k >= 0); const q = free[i] != null ? seatPos(c.seat.table, free[i]) : null; if (q) { write(m, q.x, q.z, c.rot, true); return; } }
        const sd = (i % 2 ? 1 : -1) * 0.5, bk = -0.45 * (Math.floor(i / 2) + 1);
        write(m, c.x + Math.cos(c.rot) * sd + Math.sin(c.rot) * bk, c.z - Math.sin(c.rot) * sd + Math.cos(c.rot) * bk, c.rot, false);
      });
    }
  }
  function clearAll() { for (const c of rt.customers.slice()) removeCustomer(c); }
  return { spawnCustomer, update, updateSpawner, syncAgents, orderLeft, leave, removeCustomer, clearAll, farthestSpawn, nearestSpawn, spawnPoint, seatPos, say, faceTo, near: near2 };
}
