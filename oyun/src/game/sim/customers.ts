/**
 * Customers (v2 spawnCustomer / updateCustomers / payAndGo / finishMeal): logical parties with an order, patience,
 * a queue spot, then maybe a seat. Bodies are agents-SoA slots recruited from C's ambient pool (best effort: the economy
 * never depends on how many bodies exist). Owner: Builder A. Pure; randomness only from ctx.rng streams.
 * queue.ts holds the counter-buying step, window.ts the ferry-window customers.
 */
import { RESTORAN_ASAMA } from '../../content/prefabs/iskele/layout';
import type { Vec2 } from '../../engine/api';
import { angLerp } from '../../engine/core';
import { CITIZENS } from '../../content/citizens';
import { PRODUCT_IDS, TEZGAH_SINIR } from '../../content/products';
import { P, PATIENCE_S, decorKeyif } from '../../content/economy';
import { LINES } from '../../content/lines';
import { ISKELE_ZONE } from '../../content/zones/iskele';
import type { CitizenTypeDef } from '../../content/types';
import { AGENT_FLAG, ACT_ORDER, MOOD_ORDER, type ProductId } from './schema';
import type { Kernel, Customer, Order, Item } from './state';
import { isProduct } from '../../content/yemek-menu';
import { clamp, dist2d, hourOf, inHours, near2, pointBack } from './util';
import { setChance, setById } from './sets';
import { SETS } from '../../content/products';
import { havaOf, oyunTakvim } from './hava';
import { STAGE_ARRIVAL } from '../../content/ekonomi2';
import { yatirimFx } from './yatirim';
import { tabelaFx } from './tabela';
import { yetenekFxOf } from './yetenek';
import { RANKS } from '../../content/ranks';
import { masaCati, catiAyak, catiYukari, catiAsagi, catiTaraf, katY } from '../../content/kanat';
import { davranisOf, KASA, KASA_SOZ, kasaSure, kasaSiraNokta, GRUP, HAFTA_SONU, MAC_DALGA, macDalgaX, macDalgaAdi, KALABALIK_UST } from '../../content/musteri';

const A_IDLE = ACT_ORDER.indexOf('idle'), A_WALK = ACT_ORDER.indexOf('walk'), A_CARRY = ACT_ORDER.indexOf('carry'), A_SIT = ACT_ORDER.indexOf('sit'), A_EAT = ACT_ORDER.indexOf('eat');

/** BUF-25: how far (m) a hungry citizen may be and still come to the büfe on its own */
const HUNGRY_M = 45;
/** 2026-11-25: 8-10. aşamanın müşterisi farklı (sahibi: "8 9 10 hiç fark yok") */
const TURIST = { kruvaziyer: 2.5, gezgin: 2.5, turgrubu: 2.5, balayi: 3 }, IS = { isinsani: 3, plaza: 2.5 };
const ASAMA_MUSTERI: Record<number, Record<string, number>> = { 8: TURIST, 9: { ...TURIST, ...IS }, 10: { ...TURIST, ...IS, vlogcu: 4, balayi: 4 } };
export interface SpawnOpts { type?: CitizenTypeDef; n?: number; order?: Order; set?: string | null; from?: Vec2; near?: Vec2; kind?: 'q' | 'win' | 'masa'; patienceX?: number; say?: string; follower?: boolean; tag?: string; body?: number }

export function installCustomers(K: Kernel, tipMult: () => number, addMoneyTo: (p: { value: number }[], v: number) => void, settle: (c: Customer, items: import('./state').Plate[]) => number) {
  const rt = K.rt, S = K.state;
  void tipMult; void addMoneyTo;   // BUF-10: tips go to the shared jar (restoran.ts); kept in the signature for rules.ts
  const rng = K.R.main;
  let seq = 1;
  const restoranHook = () => (rt as unknown as { restoran?: { wantMasa(): boolean; rezerve?(p: ProductId): number } }).restoran;
  const spawns: Vec2[] = (() => {
    const a = (K.content.zones?.iskele?.anchors) ?? ISKELE_ZONE.anchors;
    const l: Vec2[] = [];
    for (const k of ['spawn.0', 'spawn.1']) if (a[k]) l.push({ x: a[k].pos.x, z: a[k].pos.z });
    return l.length ? l : [{ x: -60, z: 8.8 }, { x: 60, z: 8.8 }];
  })();
  const month = () => Number(oyunTakvim(S).slice(5, 7)) || 6;   // ZMN-02: game calendar, not the wall clock
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
      x *= ASAMA_MUSTERI[Math.min(10, S.stage || 1)]?.[t.id] ?? 1;   // 8 turist ve sevgililer, 9 gurme ve iş yemeği, 10 ünlü ve kutlama
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
    for (const p of Object.keys(type.prefer)) if (open.includes(p as ProductId)) prefs[p] = (type.prefer[p as ProductId] as number) * (havaOf(rt)?.pref(p as ProductId) ?? 1) * (davranisOf(type.id).urun?.[p as ProductId] ?? 1);   // BUF-23: öğrenci ucuz, iş insanı pahalı eğilimi
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
    // ZMN-01: the day is 24 h (08 -> 08) in the same 480 s, so daytime got 20 % fewer seconds; the night keeps a living pier (night owls,
    // taxi drivers, fishermen, early workers) and the whole-day sum of this curve x seconds equals the old 08-03 day within 1 % (economy unchanged)
    // 2026-11-26 (vapur kalktı + jo0q11): daytime 08-21 a bit busier, 21-08 thinner, whole-day sum within 3 % (20.65 vs 21.2 h-units);
    // first döner+ayran set seeds 1-12 <= 287 s, day 1/3/5 parity 5570/23246/50726
    k *= h < 10 ? 0.95 : h < 12 ? 1.1 : h < 14 ? 1.35 : h < 18 ? 1.1 : h < 21 ? 1.2 : h < 24 ? 0.7 : h < 25 ? 0.55 : h < 26 ? 0.4 : h < 29 ? 0.25 : h < 30 ? 0.45 : h < 31 ? 0.7 : 0.9;
    k *= 1 + K.siklikBonus() + yatirimFx(S, 'reklam') + tabelaFx(S as never, h) + yetenekFxOf(rt).arrival;
    // BUF-24: hafta sonu çarpanı x maç günü dalgaları (öncesi / sonrası); birlikte KALABALIK_UST'u geçmez (açık bilet ve sabır payı korunur)
    let crowd = 1;
    if (h >= HAFTA_SONU.from && h < HAFTA_SONU.to && havaOf(rt)?.weekend()) crowd *= HAFTA_SONU.arrival;
    if ((rt as unknown as { macGunu?: unknown }).macGunu) crowd *= macDalgaX(h);
    k *= Math.min(KALABALIK_UST, crowd);
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
  function goTo(c: Customer, to: Vec2): void {
    if ((c.y || 0) > 0.5) { const s = catiTaraf(c); c.path = [...catiAsagi(s, c), ...pathTo(catiAyak(s), to)]; return; }   // BUF-20: çatıdan önce merdivenden iner
    c.path = pathTo({ x: c.x, z: c.z }, to);
  }
  /** masaya yürü: çatı terası masasına merdivenin ayağına kadar yerden, sonra basamaklar ve çatı koridoru (content/kanat.ts) */
  function goSeat(c: Customer, table: number, to: Vec2): void {
    const s = masaCati(table);
    if (!s) { goTo(c, to); return; }
    c.path = [...pathTo({ x: c.x, z: c.z }, catiAyak(s)), ...catiYukari(s, to)];
  }
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

  const macDay = () => !!(rt as unknown as { macGunu?: unknown }).macGunu;
  const haftaSonu = () => !!havaOf(rt)?.weekend();
  /** BUF-24: grup boyu 1..6. Tip tablosundaki büyük grup (doğum günü, okul gezisi, aile, tur, taraftar) yalnız oyuncu bunalmazken gelir. */
  function pickN(type: CitizenTypeDef): { n: number; ad?: string } {
    let n = rng.int(type.group[0], type.group[1]);
    const b = davranisOf(type.id).buyuk;
    if (!b || S.playT < 400 || rt.queue.length >= GRUP.kuyrukMax) return { n };
    if (rt.customers.filter(c => c.n >= 5 && c.state !== 'leave').length >= GRUP.esZamanli) return { n };
    let ch = b.sans * (haftaSonu() ? GRUP.haftaSonuX : 1);
    if (macDay() && macDalgaAdi(K.hour())) ch *= GRUP.macDalgaX;
    if (type.id === 'taraftar' && !macDay()) ch = 0;
    if (!rng.chance(ch)) return { n };
    n = rng.int(b.n[0], b.n[1]);
    return { n, ad: b.ad };
  }
  /**
   * BUF-24 masa birleştirme: n kişilik grup için ceil(n/2) boş, temiz, yakın masa (ana masa + yakın komşular). Hepsi bulunamazsa mevcut kümeyle yetinir
   * (çağıran grubu küçültür); hiç boş masa yoksa null.
   */
  function masaKume(n: number): number[] | null {
    const need = Math.max(1, Math.ceil(n / GRUP.masaKisi)), TL = rt.layout.tables;
    const frees: number[] = [];
    const catiOk = S.workers.some(w => w.role === 'garson');   // BUF-20: çatı masasına yalnız garson varken oturulur (servis ve silme garsonun)
    for (let i = 0; i < rt.tables.length; i++) { const t = rt.tables[i]; if (t && t.built && t.dirty <= 0 && t.seats.every(sx => !sx.occ) && (catiOk || !masaCati(i))) frees.push(i); }
    if (!frees.length) return null;
    const near = (a: number) => frees.filter(b => b !== a && TL[a] && TL[b] && masaCati(a) === masaCati(b) && dist2d(TL[a], TL[b]) <= GRUP.birlesM).sort((p, q) => dist2d(TL[a], TL[p]) - dist2d(TL[a], TL[q]));   // çatı ile salon masası birleşmez; en yakın önce
    let best = frees[0];
    if (need > 1) { let bn = -1; for (const a of frees) { const k = Math.min(need - 1, near(a).length); if (k > bn) { bn = k; best = a; } } }
    return [best, ...(need > 1 ? near(best).slice(0, need - 1) : [])];
  }
  /** kümeyi müşteriye bağlar: ana masada koltuk 0 müşteri, kalan koltuklar üyeler; ek masaların bütün koltukları grubun */
  function seatCluster(c: Customer, kume: number[]): void {
    const t = rt.tables[kume[0]];
    c.seat = { table: kume[0], seat: 0 }; t.seats[0].occ = c.id;
    let m = 0; t.seats.forEach(sx => { if (!sx.occ && m < c.members.length) { sx.occ = c.id; m++; } });
    c.ekMasa = kume.slice(1);
    for (const ti of c.ekMasa) { const et = rt.tables[ti]; et.seats.forEach(sx => { if (m < c.members.length) { sx.occ = c.id; m++; } }); }
  }
  /** grubun oturduğu koltuklar (ana koltuk hariç): önce ana masa, sonra ek masalar */
  function partySeats(c: Customer): { table: number; seat: number }[] {
    const out: { table: number; seat: number }[] = [];
    if (!c.seat) return out;
    for (const ti of [c.seat.table, ...(c.ekMasa || [])]) { const t = rt.tables[ti]; if (t) t.seats.forEach((sx, k) => { if (sx.occ === c.id && !(ti === c.seat!.table && k === c.seat!.seat)) out.push({ table: ti, seat: k }); }); }
    return out;
  }

  function spawnCustomer(o: SpawnOpts = {}): Customer {
    const type = o.type || pickType();
    let kind = o.kind || 'q';
    const pn = o.n ? { n: o.n } as { n: number; ad?: string } : kind === 'win' ? { n: rng.int(type.group[0], type.group[1]) } : pickN(type);
    let n = clamp(pn.n, 1, GRUP.max);
    // Faz 2 adisyon: table guests walk straight to a free table (falls back to the queue if none is free)
    const kume = kind === 'masa' ? masaKume(n) : null;
    if (kind === 'masa' && !kume) kind = 'q';
    if (kume) n = Math.min(n, kume.length * GRUP.masaKisi);   // BUF-24: bulunan masalara sığmayan grup küçülür (kimse ayakta kalmaz)
    const mk = o.order ? { order: { ...o.order }, set: o.set || null } : makeOrder(type, n);
    let from = o.from || (o.near ? nearestSpawn(o.near) : spawnPoint());
    if (!o.from && kind === 'q') {
      const spot = queueSpot(rt.queue.length);
      from = pointBack([from, ...pathTo(from, spot)], rng.range(P.ENTRY_M[0], P.ENTRY_M[1]));
    }
    const decorPat = clamp(decorKeyif(K.placedDecor()) * P.DECOR_PATIENCE_PER_KEYIF, 0, P.DECOR_PATIENCE_CAP);
    const dv = davranisOf(type.id), grupPay = 1 + Math.min(GRUP.sabirUst, GRUP.sabirKisi * Math.max(0, n - 2));   // BUF-23 tip sabrı, BUF-24 büyük grubun sabır payı
    const pat = (PATIENCE_S[type.patience] || 40) * (1 + decorPat + yatirimFx(S, 'konfor')) * (o.patienceX || 1) * dv.sabir * (n > 2 ? grupPay : 1);
    const c: Customer = {
      id: seq++, typeId: type.id, typeIdx: CITIZENS.indexOf(type), kind, n, order: mk.order, got: {}, set: mk.set, value: 0, state: 'walk',
      t: 0, takeT: 0, eatT: 0, patience: pat, patMax: pat, sit: rng.chance(type.sit) && (havaOf(rt)?.sitOk() ?? true), mood: 'ok', x: from.x, z: from.z, rot: 0, speed: 0, path: [],
      agent: -1, members: [], items: [], seat: null, say: '', sayT: 0, calm: false, follower: !!o.follower, tag: o.tag || null, qi: -1,
    };
    if (pn.ad) c.grupAd = pn.ad;
    c.agent = o.body !== undefined && o.body >= 0 ? o.body : recruitBody(type, from);
    for (let i = 1; i < Math.min(n, GRUP.max); i++) { const m = recruitBody(type, from); if (m < 0) break; c.members.push(m); }   // BUF-24: gövde sayısı grup kadar (en çok 6)
    rt.customers.push(c);
    if (kind === 'masa' && kume) {
      seatCluster(c, kume); c.state = 'toSeat'; c.sit = true;
      const tb = rt.layout.tables[kume[0]];
      goSeat(c, kume[0], seatPos(kume[0], 0) ?? { x: tb.x, z: tb.z });
    } else if (kind === 'q') { rt.queue.push(c); goTo(c, queueSpot(rt.queue.length - 1)); }
    else { rt.winq.push(c); goTo(c, winSpot(rt.winq.length - 1)); }
    if (o.say) say(c, o.say, 3);
    return c;
  }
  const remove = (arr: Customer[], c: Customer) => { const i = arr.indexOf(c); if (i >= 0) arr.splice(i, 1); };
  function freeSeats(c: Customer) {
    if (!c.seat) return;
    for (const ti of [c.seat.table, ...(c.ekMasa || [])]) { const t = rt.tables[ti]; if (t) t.seats.forEach(s => { if (s.occ === c.id) s.occ = 0; }); }
    c.seat = null; c.ekMasa = [];
  }
  function removeCustomer(c: Customer) {
    remove(rt.customers, c); remove(rt.queue, c); remove(rt.winq, c); remove(rt.kasaQueue, c);
    freeSeats(c);
    [c.agent, ...c.members].forEach(a => { if (a >= 0) K.ambient?.release(a); });
    c.agent = -1; c.members = [];
  }
  function leave(c: Customer, angry: boolean) {
    if (c.state === 'leave') return;
    const masa = !!c.seat;
    remove(rt.queue, c); remove(rt.winq, c); remove(rt.kasaQueue, c); c.kasa = false;
    if (angry) K.logEv('kizginAyril', { x: c.x, z: c.z, masa, type: c.typeId });   // BUF-23: masaya / tezgâha vurup kızgın ayrılma (görünüm 💢)
    c.state = 'leave'; c.mood = angry ? 'angry' : 'happy';
    freeSeats(c);
    goTo(c, angry ? nearestSpawn({ x: c.x, z: c.z }) : spawnPoint());
  }
  const returnItemsToCounter = (c: Customer) => {
    c.items.splice(0).forEach(it => { if (!isProduct(it.type)) return; const b = rt.counter[it.type]; if (b && b.length < TEZGAH_SINIR) b.push(it as Item); });   // tezgâh sınırı counter.ts ile aynı (12); mutfak tabağı tezgâha stok olarak dönmez (BUF-05)
    c.got = {};
  };
  function freeSeat(n: number): { t: number; seat: number } | null {
    let best: { t: number; free: number[] } | null = null;
    for (let i = 0; i < rt.tables.length; i++) {
      const t = rt.tables[i];
      if (!t || !t.built || t.dirty > 0 || masaCati(i)) continue;   // tezgâhtan alıp oturan çatıya çıkmaz (çatı masa servisi)
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
    if (rng.chance(0.08)) { // Faz 2: customers comment rarely (owner: just show the order)
      const lines = LINES.type[c.typeId as keyof typeof LINES.type];
      say(c, rng.pick(lines && rng.chance(0.4) ? lines : LINES.happy), 2);
    }
    remove(rt.queue, c); remove(rt.kasaQueue, c); c.kasa = false;
    const kume = c.sit && c.n > GRUP.masaKisi ? masaKume(c.n) : null;   // BUF-24: büyük grup yakın masaları birleştirir
    const fs = !kume && c.sit ? freeSeat(c.n) : null;
    if (kume) {
      seatCluster(c, kume); c.state = 'toSeat';
      const tb = rt.layout.tables[kume[0]];
      goSeat(c, kume[0], seatPos(kume[0], 0) ?? { x: tb.x, z: tb.z });
    } else if (fs) {
      const t = rt.tables[fs.t];
      c.seat = { table: fs.t, seat: fs.seat }; t.seats[fs.seat].occ = c.id; c.state = 'toSeat';
      const tb = rt.layout.tables[fs.t];
      goSeat(c, fs.t, seatPos(fs.t, fs.seat) ?? { x: tb.x, z: tb.z });
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
    // BUF-09: the plates stay on the table as dirty dishes until a garson / cleaner (or the player) clears and wipes it.
    // Only while someone on the team can wipe: no invisible cleaning, and a solo player never gets locked tables.
    // (Tips: BUF-10 shared jar in restoran.ts odemeYap; the old dead tip-pile block is gone.)
    const plates = c.items.length;
    if (t && t.built && plates > 0 && S.workers.some(w => w.role === 'garson' || w.role === 'temizlik')) {
      t.dirty = Math.min(8, t.dirty + plates); K.stat('kirliMasa');
      for (const ei of c.ekMasa || []) { const et = rt.tables[ei]; if (et && et.built) et.dirty = Math.min(8, et.dirty + 1); }   // birleşen masalar da kirlenir
    }
    c.items.length = 0;
    K.logEv('mealDone', { table: ti });
    if (rng.chance(0.06)) say(c, rng.pick(LINES.happy), 2);
    leave(c, false);
  }
  const outOfSight = (c: Customer) => dist2d(c, rt.layout.counter.pos) > P.LEAVE_M;

  function patienceRate(c: Customer): number {
    let k = c.kasa ? KASA.sabirAkis : 1;   // BUF-12: kasa kuyruğunda sabır daha yavaş akar
    if (!c.kasa && rt.queue.indexOf(c) > 2) k *= 0.5;
    let aura = 0;
    for (const f of rt.auras) aura = Math.max(aura, f(c.x, c.z));
    if (aura > 0) { k *= 1 - aura; c.calm = true; }
    if ((c.typeId === 'okul' || c.typeId === 'bebekarabali') && S.cats.some(x => x.id === 'boncuk')) k *= 0.9;
    return k;
  }

  // ───────── BUF-12 kasa: kasiyer kasa başındayken ürünleri alan müşteri kasa sırasına girer ─────────
  type WRow = { id: number; role: string; state: string; x: number; z: number; rank: number };
  /** kasa başında (yerinde) duran kasiyerler: sayısı kadar kasa açık, işlem hızı rütbe çarpanından (en iyisi ilk gişe) */
  function kasalar(): { n: number; rankX: number[]; ids: number[] } {
    const w = (rt as unknown as { agents?: { workers?: { rows(): WRow[] } } }).agents?.workers;
    const rows = w ? w.rows() : [];
    const kp = rt.layout.kasa.pile, xs: { x: number; id: number }[] = [];
    for (const r of rows) {
      if (r.role !== 'kasiyer' || r.state !== 'front') continue;
      if (Math.hypot(r.x - kp.x, r.z - kp.z) > KASA.yerindeM + 1.1 * 2 + 0.75) continue;   // kasa duruşları kasa.pile yanında sıralanır
      xs.push({ x: RANKS[Math.max(0, Math.min(RANKS.length - 1, r.rank | 0))].x, id: r.id });
    }
    xs.sort((a, b) => b.x - a.x || a.id - b.id);
    return { n: xs.length, rankX: xs.map(q => q.x), ids: xs.map(q => q.id) };
  }
  const kasaPos = (): Vec2 => ({ x: rt.layout.kasa.pos.x, z: rt.layout.kasa.pos.z });
  /** tezgâhtan ürünleri alan müşteri: kasiyer varsa ve kasa sırası boşsa kasaya yürür (true), yoksa eski gibi anında ödenir (false) */
  function kasayaGir(c: Customer): boolean {
    if (c.kind !== 'q' || rt.kasaQueue.length >= KASA.maxKuyruk || !kasalar().n) return false;
    remove(rt.queue, c);
    c.kasa = true; c.kasaT = 0; c.qi = -1;
    c.odeme = rng.chance(davranisOf(c.typeId).kart) ? 'kart' : 'nakit';
    c.patience = Math.min(c.patMax, c.patience + c.patMax * KASA.sabirPayi);
    rt.kasaQueue.push(c);
    c.state = 'walk';
    return true;
  }
  function kasaOde(c: Customer, wid = 0) {
    const w = wid ? S.workers.find(x => x.id === wid) : null;
    if (w) w.xp = (w.xp || 0) + 1;   // kasiyer işlem yaptıkça rütbe kazanır (workers.ts rütbe kontrolü yapar)
    K.logEv('kasaOde', { yontem: c.odeme || 'nakit', x: c.x, z: c.z });
    payAndGo(c);
  }
  let kasaRR = 0;
  function kasaGuncelle(dt: number) {
    if (!rt.kasaQueue.length) return;
    const T = kasalar(), L = rt.layout;
    if (!T.n) { for (const c of rt.kasaQueue.slice()) if (c.state === 'queue' || c.state === 'walk') kasaOde(c); return; }   // kasiyer gitti: eski gibi anında ödeme
    rt.kasaQueue.forEach((c, i) => { if (c.state !== 'leave' && c.qi !== i) { c.qi = i; if (c.state === 'queue' || c.state === 'walk') { c.state = 'walk'; goTo(c, kasaSiraNokta(L.kasa, i)); } } });
    for (let i = 0; i < Math.min(T.n, rt.kasaQueue.length); i++) {
      const c = rt.kasaQueue[i];
      if (c.state !== 'queue' || !near2(c, kasaSiraNokta(L.kasa, i), 0.45)) continue;
      c.kasaT = (c.kasaT || 0) + dt;
      // BUF-28: sıra gişelere dönüşümlü dağılır (i + kasaRR) % n: eskiden hep ilk gişeler çalışıyordu, üçüncü kasiyer kuyruk 3'ü bulmadıkça hiç işlem yapmıyordu
      const d = T.n > 1 ? (i + kasaRR) % T.n : 0;
      if (c.kasaT >= kasaSure(c.items.length, T.rankX[d] ?? 1, davranisOf(c.typeId).kasa)) { kasaOde(c, T.ids[d]); kasaRR++; i--; }
    }
  }

  let spawnT = 6;
  let duyuruKey = '';
  /** BUF-24: maç günü dalgaları ve hafta sonu için günde bir kez kısa bilgi (hata değil, oyuncuyu hazırlar) */
  function duyuru() {
    const h = K.hour();
    if (macDay()) { const a = macDalgaAdi(h); if (a && duyuruKey !== S.day + a) { duyuruKey = S.day + a; K.toast(MAC_DALGA.say[a], 'info'); } }
    else if (h >= HAFTA_SONU.from && h < HAFTA_SONU.to && haftaSonu() && duyuruKey !== S.day + 'hs') { duyuruKey = S.day + 'hs'; K.toast(HAFTA_SONU.say, 'info'); }
  }
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
    duyuru();
    spawnT -= dt;
    if (spawnT > 0) return;
    spawnT = 60 / arrivalPerMin() * rng.range(0.75, 1.25);
    if (rt.queue.length >= Math.min(P.QUEUE_MAX, rt.layout.queue.length)) { spawnT = 1.5; return; }
    // 2026-11-22: from stage 6 there is no counter queue: a guest comes only when a table is free (restoran.wantMasa)
    const hepMasa = (S.stage || 1) >= RESTORAN_ASAMA && !!restoranHook();
    if (hepMasa && !restoranHook()!.wantMasa()) { spawnT = 2; return; }
    // BUF-25: a hungry street citizen walks over by own will (same arrival count: it replaces one formula spawn)
    const amb = K.ambient, hb = amb?.recruitHungry ? amb.recruitHungry(queueSpot(0), HUNGRY_M) : -1;
    if (hb >= 0) {
      const a = K.agents, ty = CITIZENS[a.u8('typeId')[hb]];
      if (ty && !ty.scenery) { spawnCustomer({ type: ty, n: 1, from: { x: a.f32('x')[hb], z: a.f32('z')[hb] }, body: hb, say: 'Acıktım ya...', ...(hepMasa || restoranHook()?.wantMasa() ? { kind: 'masa' as const } : {}) }); return; }
      amb!.release(hb);
    }
    spawnCustomer(hepMasa || restoranHook()?.wantMasa() ? { kind: 'masa' } : {});
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
        if (box.length > (restoranHook()?.rezerve?.(p) ?? 0)) { c.items.push(box.pop()!); c.got[p] = (c.got[p] || 0) + 1; c.patience = Math.min(c.patMax, c.patience + 1.5); break; }
      }
      if (!Object.keys(orderLeft(c)).length) { if (!kasayaGir(c)) payAndGo(c); i--; }
    }
    kasaGuncelle(dt);
    for (let k = rt.customers.length - 1; k >= 0; k--) {
      const c = rt.customers[k];
      c.sayT -= dt; c.t += dt; c.speed = 0;
      switch (c.state) {
        case 'walk': if (!walkPath(c, dt, 1.6)) c.state = c.kind === 'win' ? 'wqueue' : 'queue'; break;
        case 'queue': {
          faceTo(c, c.kasa ? kasaPos() : L.counter.pos, dt);
          c.patience -= dt * patienceRate(c);
          const dv = davranisOf(c.typeId);
          if (c.kasa && dv.sohbet && c.sayT < -6 && rng.chance(dt * 0.12)) say(c, rng.pick(dv.sohbet), 2.6);   // BUF-23: yaşlılar kasada sohbet eder (işlem de yavaş)
          if (c.patience <= 0) { say(c, rng.pick(c.kasa ? KASA_SOZ.sinirli : LINES.angry), 2.5); S.today!.angry++; K.logEv('angry', { type: c.typeId }); returnItemsToCounter(c); leave(c, true); }
          else if (c.patience < c.patMax * 0.35 && c.sayT < -12 && rng.chance(dt * 0.05)) say(c, rng.pick(LINES.bored), 2);
          break;
        }
        case 'wqueue': faceTo(c, L.window.standAt, dt); if (!rt.window || !rt.window.open) leave(c, false); break;
        case 'toSeat': if (!walkPath(c, dt, 1.6)) { if (c.kind === 'masa') { c.state = 'wait'; c.t = 0; } else { c.state = 'eat'; c.t = 0; c.eatT = rng.range(6, 9) * (havaOf(rt)?.eatX() ?? 1) * davranisOf(c.typeId).ye; } } break;
        case 'wait': if (c.seat) { const tb = rt.layout.tables[c.seat.table]; if (tb) faceTo(c, tb, dt); } break; // restoran.ts runs the adisyon
        case 'eat': if (c.t >= c.eatT && !(c as unknown as { hesapBekle?: boolean }).hesapBekle) finishMeal(c); break;   // waits for the waiter's bill (restoran.ts)
        case 'leave': if (!walkPath(c, dt, 1.8) || (outOfSight(c) && !((c.y || 0) > 0.05))) removeCustomer(c); break;   // BUF-20: çatıdaki / merdivendeki önce iner (gövde yerde gezinmeye döner)
      }
      c.y = katY(S.stage || 1, c.x, c.z, (c.y || 0) > 0.5);
    }
  }

  const anyOfSpot = () => ({ x: 0, z: 0 });
  void anyOfSpot; void hourOf; void setById; void A_EAT;
  /** Write customers into the agents SoA (positions, gait, act, flags). */
  /** BUF-20: per agent-slot height for the crowd view (çatı terası, merdiven); 0 everywhere else */
  const agentY = new Float32Array(256);
  (rt as unknown as { agentY?: Float32Array }).agentY = agentY;
  function syncAgents() {
    const a = K.agents;
    agentY.fill(0);
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
      const cy = c.y || 0;
      if (cy > 0) for (const sl of [c.agent, ...c.members]) if (sl >= 0 && sl < 256) agentY[sl] = cy;
      let sp: Vec2 | null = null;
      if (sit && c.seat) sp = seatPos(c.seat.table, c.seat.seat);
      // 2026-11-02: seated guests face the table (they used to keep whatever heading they walked in with)
      const faceTable = (ti: number, q: Vec2) => { const tb = rt.layout.tables[ti]; return tb ? Math.atan2(tb.x - q.x, tb.z - q.z) : c.rot; };
      write(c.agent, sit && sp ? sp.x : c.x, sit && sp ? sp.z : c.z, sit && sp && c.seat ? faceTable(c.seat.table, sp) : c.rot, sit);
      c.members.forEach((m, i) => {
        // ana masanın VE birleştirilen ek masaların koltukları (eskiden yalnız ana masa: 6 kişilik grubun 4'ü ayakta kalıyordu)
        if (sit && c.seat) { const ps = partySeats(c); const ps_i = ps[i]; const q = ps_i ? seatPos(ps_i.table, ps_i.seat) : null; if (q && ps_i) { write(m, q.x, q.z, faceTable(ps_i.table, q), true); return; } }
        const sd = (i % 2 ? 1 : -1) * 0.5, bk = -0.45 * (Math.floor(i / 2) + 1);
        write(m, c.x + Math.cos(c.rot) * sd + Math.sin(c.rot) * bk, c.z - Math.sin(c.rot) * sd + Math.cos(c.rot) * bk, c.rot, false);
      });
    }
  }
  /** BUF-23 sabır çubuğu verisi: kuyruk ve kasa sırası (masalar: restoran.view().masalar). frac 1 = sabır dolu, 0 = bitti */
  const sabirFrac = (c: Customer) => +clamp(c.patience / Math.max(0.01, c.patMax), 0, 1).toFixed(2);
  K.addStateView(() => ({
    sabir: {
      kuyruk: rt.queue.filter(c => c.state === 'queue').map(c => ({ id: c.id, tip: davranisOf(c.typeId).etiket, frac: sabirFrac(c) })),
      kasa: { acik: kasalar().n, bekleyen: rt.kasaQueue.map(c => ({ id: c.id, tip: davranisOf(c.typeId).etiket, frac: sabirFrac(c), yontem: c.odeme || 'nakit' })) },
    },
  }));
  function clearAll() { for (const c of rt.customers.slice()) removeCustomer(c); }
  const api = { spawnCustomer, arrivalPerMin, update, updateSpawner, syncAgents, orderLeft, leave, removeCustomer, clearAll, farthestSpawn, nearestSpawn, spawnPoint, seatPos, say, faceTo, near: near2 };
  (rt as unknown as { customersApi?: typeof api }).customersApi = api;   // testler ve görünüm için (kontrollü müşteri doğurma)
  return api;
}
