/**
 * Café / bistro room sim (survey 2026-11-09 + user "cafe ve bistro büfe gibi, içine müşteri gelecek, ben ve tuttuğum
 * işçiler sunacak"): the same logic as the büfe with different content. Guests are real actors: they walk in through the
 * door, queue at the counter, show a patience bar via mood, get served by the PLAYER (stand at the machine, dwell) or by
 * the café's HIRED workers (real actors behind the counter: brew, hand over), pay into the café till, and half of them sit
 * down at a table for a while before they leave. No guest, no income: an unattended café with no workers earns nothing.
 * Numbers come from mulk.ts (`rt.kafeHost`): customers per hour, price. Rooms: content/ic-mekan.ts kafe1 / kafe2.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { IC_BY_ID, IC_MEKANLAR, icWorld, icDim, icLayout, icUV, icYol, personelGeo, personelDuraklari, icMagaza } from '../../../content/ic-mekan';
import { AVM_GIRIS, AVM_DIS, avmGelis, avmGidis } from '../../../content/avm-kat';
import { KAFE_ISCI_TAVAN, ARSA_ISLETME, kafeSatis, ARSALAR, arsaKapi } from '../../../content/esya';
import { kalemOf, ISTASYON_LAYOUT_K, ISTASYON_SIRA, MAKINE, MAKINE_TEPSI, MAKINE_ON, makineAdi, type IstasyonId } from '../../../content/isletme-istasyon';
import { ISLETME_ROL } from '../../../content/isletme-kadro';
import type { AgentEnv } from './env';
import type { Actor } from './types';

interface KafeHostApi {
  live: boolean; fp: boolean; pending: Record<string, number>; fpDone?: (arsa: string, ok: boolean) => void;
  info(id: string): { lv: number; isci: number; masa: number; kuyruk: number; kadro: { id: number; ad: string; rol: string; huy: string; look: { apronText: string; lookSeed: number; headscarf?: string }; rank: number }[]; tema: string; fiyat: number; menu: { id: string; ad: string; ikon: string }[] } | null;
  sell(id: string, kalem?: string, bonus?: number): number;
}
const ROOMS: { arsa: string; room: string; bistro: boolean }[] = [{ arsa: 'k1', room: 'kafe1', bistro: false }, { arsa: 'k2', room: 'kafe2', bistro: true }, { arsa: 'k4', room: 'okul', bistro: false }, { arsa: 'k6', room: 'tesis', bistro: false }, { arsa: 'k3', room: 'kirtasiye', bistro: false },
  // 2026-11-21 Martı AVM: 3 floors x 4 shops (content/avm-kat.ts). Guests and workers come in through the mall entrance and
  // ride the escalators up to their floor; shops (icMagaza) first look around the racks, then take one item to the till
  ...IC_MEKANLAR.filter(m => m.bina === 'avm' && m.arsa).map(m => ({ arsa: m.arsa!, room: m.id, bistro: false }))];
const PAT = 45, LOOKS = ['universiteli', 'teyze', 'emekli', 'plaza', 'turgrubu', 'gezgin', 'balayi', 'taraftar'];
const LINES_OUT = ['Eline sağlık!', 'Çok güzel olmuş.', 'Yine geleceğiz!', 'Tam kıvamında.'];
const LINES_ANGRY = ['Çok bekledim, gidiyorum!', 'Kimse yok mu?', 'Bu kadar beklenmez.'];
const LINES_GEZ = ['Şuna bir bakayım…', 'Bu güzelmiş.', 'Fiyatı ne kadar?', 'Hangisini alsam?'];

/** path point: y set = the AVM escalator / floor height along the way (content/avm-kat.ts) */
type Pt = Vec2 & { y?: number };
interface Guest { a: Actor; st: 'in' | 'gez' | 'queue' | 'served' | 'toSeat' | 'sit' | 'out'; t: number; gez: number; gezYaw: number; path: Pt[]; slot: number; claimed: number; seat: Vec2 | null; tbl: number; face: number; want: string }
interface Wk { a: Actor; cid: number; idx: number; st: 'post' | 'toSt' | 'brew' | 'hand' | 'pre'; t: number; guest: Guest | null; path: Pt[]; item: string }
/** 2026-11-22 makine (content/isletme-istasyon.ts MAKINE): koyulan ürün kendi kendine pişer, bitince hazır tepsisinde bekler */
interface Mak { ist: IstasyonId; cook: string; t: number; sure: number; ready: string[]; by: number }
export interface MakineGorunum { room: string; kat: number; ist: IstasyonId; ad: string; x: number; z: number; hx: number; hz: number; dx: number; dz: number; cook: string; p: number; kalan: number; ready: string[] }
/** BUF-25: a hungry street citizen walking to the shop door; the guest appears when it arrives (or after VISIT_MAX seconds, so the flow count never drops) */
interface Visitor { slot: number; t: number }
interface Room { arsa: string; room: string; bistro: boolean; guests: Guest[]; wk: Wk[]; seatTaken: Set<number>; visitors: Visitor[]; mak: Map<IstasyonId, Mak>; preT: number }
const HUNGRY_M = 40, VISIT_MAX = 50;

export interface KafeSystem extends System { rooms(): { room: string; guests: number; waiting: number; workers: number; siparisler: string[] }[]; siparisOf(room: string): string[]; makineler(room?: string): MakineGorunum[] }

export function createKafe(env: AgentEnv, rt: Record<string, unknown>): KafeSystem {
  const rng = env.rng('kafe');
  const rooms: Room[] = ROOMS.map(r => ({ ...r, guests: [], wk: [], seatTaken: new Set<number>(), visitors: [], mak: new Map<IstasyonId, Mak>(), preT: 0 }));
  const host = () => rt.kafeHost as KafeHostApi | undefined;
  const geom0 = (r: Room) => {
    const m = IC_BY_ID[r.room], D = icDim(m).D, W = icDim(m).W, lay = icLayout(m), tz = lay.find(i => i.k === 'tezgah')!;
    const vert = (tz.ry || 0) % 2 === 1;   // kırtasiye: the counter stands across the east end, customers queue on its west side
    const w = (u: number, v: number): Vec2 => icWorld(m, u, v);
    /** a = position ALONG the counter, b = distance from the counter on the customer side (negative = staff side) */
    const P = (a: number, b: number): Vec2 => vert ? w(tz.u - b, a) : w(a, tz.v + b);
    // 2026-11-21 denetim: tezgâh hattının ucu ve personel mesafesi content/ic-mekan.ts personelGeo'dan (sim, görünüm ve test aynı sayıyı okur)
    const pg = personelGeo(m)!, cu = pg.cu, endU = pg.endU, arka = pg.arka;
    const uv = (p: Vec2) => icUV(m, p.x, p.z);
    /** engelden kaçan yol (masa / dolap / duvarın içinden geçmez), dünya koordinatında */
    const yol = (from: Vec2, to: Vec2): Vec2[] => icYol(m, uv(from), uv(to), 0.2).map(q => w(q.u, q.v));
    const tables = lay.filter(i => i.k.startsWith('masa')).map(i => ({ u: i.u, v: i.v, k: i.k }));
    // a narrow room (the AVM lokanta strip) packs the line and the staff posts so they stay inside the walls
    const narrow = W < 7, gap = vert ? 0.5 : Math.min(0.85, Math.max(0.5, (W / 2 - 0.55 - (cu + 0.7)) / 4)), post = vert ? Math.min(0.75, Math.max(0.3, (pg.hi + 0.1 - (cu + 0.6)) / 2)) : narrow ? Math.min(1.4, (endU - 0.6 - (cu + 1.5)) / 2) : 1.4;
    // shops: where a guest stands to look at the goods (in front of the racks and the display table, on the customer side)
    const gez = icMagaza(m.tur) ? lay.filter(i => i.k === 'reyon' || i.k === 'teshir').flatMap(i => i.k === 'teshir' ? [{ u: i.u - i.w / 2 - 0.4, v: i.v, yaw: 1 }] : [-0.3, 0.3].map(f => ({ u: i.u + 0.6, v: i.v + f * i.w, yaw: -1 }))) : [];
    // AVM: actors appear at the mall entrance and walk / ride to the shop door on its floor (gel), and back out (git)
    const avm = m.bina === 'avm', kat = m.kat || 0, onKapi = w(0, D / 2 + 0.7);
    const gel = (): Pt[] => avm ? avmGelis(kat, onKapi) : [];
    const git = (): Pt[] => avm ? [onKapi, ...avmGidis(kat, onKapi)] : [];
    return { m, D, W, bv: tz.v, cu, endU, arka, yol, w, P, vert, door: avm ? { x: AVM_GIRIS.x, z: AVM_GIRIS.z } : w(0, D / 2 + 2.6), inside: w(0, D / 2 - 1.0), avm, kat, gel, git, tables, sdv: D < 5 ? -0.6 : 0.7, wide: !vert && !(m.tur === 'kafe' || m.tur === 'bistro'), gap, post, maxQ: vert ? 3 : 5, gez, pg, narrow };
  };
  const gCache = new Map<string, ReturnType<typeof geom0>>();   // the room geometry is static: build it once per room
  const geom = (r: Room) => { let g = gCache.get(r.room); if (!g) { g = geom0(r); gCache.set(r.room, g); } return g; };
  const slotU = (g: { cu: number; gap: number; vert: boolean }, i: number) => g.cu + (g.vert ? 0 : 0.7) + Math.max(0, i) * g.gap;
  const slotPos = (r: Room, i: number) => { const g = geom(r); return g.P(slotU(g, i), 1.15); };
  const approach = (r: Room, i: number): Pt[] => { const g = geom(r); return [...g.gel(), g.inside, ...g.yol(g.inside, slotPos(r, i))]; };
  const step1 = (a: Actor, to: Pt, sp: number, dt: number) => {   // straight-line step, returns true when arrived (y: escalator slope)
    const dx = to.x - a.x, dz = to.z - a.z, dy = to.y === undefined ? 0 : to.y - a.y, d = Math.hypot(dx, dz, dy);
    if (d < 0.05) { a.speed = 0; if (to.y !== undefined) a.y = to.y; return true; }
    const k = Math.min(1, sp * dt / d); a.x += dx * k; a.z += dz * k; a.y += dy * k; if (Math.abs(dx) + Math.abs(dz) > 1e-4) a.rot = Math.atan2(dx, dz); a.speed = sp; return false;
  };
  const follow = (a: Actor, path: Pt[], sp: number, dt: number) => { if (!path.length) return true; if (step1(a, path[0], sp, dt)) path.shift(); a.act = 'walk'; return !path.length; };

  // dolap içeceği (0,35 ağırlık): siparişlerin aşağı yukarı dörtte biri, pahalı ana yemeği çok itmesin
  /** what the next guest asks for: an item of this business's own menu (the level decides how many are on it), cheap ones more often */
  const menuOf = (r: Room) => { const info = host()?.info(r.arsa); return info ? kafeSatis(r.arsa, info.lv) : []; };
  function pickWant(r: Room): string {
    const menu = menuOf(r); if (!menu.length) return '';
    const w = menu.map(m => (kalemOf(m.id).ist === 'dolap' ? 0.35 : m.fiyat > 150 ? 0.5 : m.fiyat < 20 ? 1.5 : 1));   let x = rng.next() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < menu.length; i++) { x -= w[i]; if (x <= 0) return menu[i].id; }
    return menu[0].id;
  }
  const kalemAd = (r: Room, id: string) => (menuOf(r).find(m => m.id === id)?.ad || '').toLocaleLowerCase('tr');
  /** where a worker stands to make an item: the matching equipment's spot along the counter (staff side), else a fixed slot per station */
  /** position ALONG the counter of a station: the matching equipment's spot, else a fixed slot per station */
  function istasyonA(r: Room, ist: IstasyonId): number {
    const g = geom(r), hit = icLayout(g.m).find(i => ISTASYON_LAYOUT_K[ist].includes(i.k)), lo = g.cu + 0.2, hi = g.endU - 0.6;
    const a = hit && ist !== 'tezgah' && ist !== 'raf' ? (g.vert ? hit.v : hit.u) : lo + ((ISTASYON_SIRA.indexOf(ist) * 0.9) % Math.max(0.9, hi - lo));
    return Math.max(lo, Math.min(hi, a));
  }
  /** where a worker stands (staff side of the counter) to make an item of that station */
  const istasyonNoktasi = (r: Room, ist: IstasyonId, idx: number): Vec2 => { const g = geom(r), a = istasyonA(r, ist); return g.P(Math.max(g.cu + 0.2, Math.min(g.endU - 0.6, a + idx * 0.35)), -g.arka); };
  /* ---------- makineler ---------- */
  const lvOf = (r: Room) => host()?.info(r.arsa)?.lv ?? 1;
  const makSure = (r: Room, item: string) => kalemOf(item).sure / (1 + 0.12 * lvOf(r));
  const makOf = (r: Room, ist: IstasyonId): Mak => { let m = r.mak.get(ist); if (!m) { m = { ist, cook: '', t: 0, sure: 1, ready: [], by: 0 }; r.mak.set(ist, m); } return m; };
  /** ürünü makineye koy (makine boşsa); tepsi doluysa en eski ürün bayatlar, atılır (stok yok) */
  function makKoy(r: Room, m: Mak, item: string, by: number): boolean {
    if (m.cook) return false;
    if (m.ready.length >= MAKINE_TEPSI) m.ready.shift();
    m.cook = item; m.t = 0; m.sure = makSure(r, item); m.by = by; return true;
  }
  /** hazır tepsiden o ürünü al */
  const makAl = (m: Mak, item: string): boolean => { const i = m.ready.indexOf(item); if (i < 0) return false; m.ready.splice(i, 1); return true; };
  function tickMak(r: Room, dt: number) { for (const m of r.mak.values()) if (m.cook) { m.t += dt; if (m.t >= m.sure) { m.ready.push(m.cook); m.cook = ''; m.t = 0; } } }
  /** bu makinede yapılan menü kalemleri (seviyenin açtığı menüden), ucuzdan pahalıya */
  const makMenu = (r: Room, ist: IstasyonId) => menuOf(r).filter(x => kalemOf(x.id).ist === ist).sort((a, b) => a.fiyat - b.fiyat);
  /** boşta önceden yapılacak ürün: tepside olmayan en ucuz kalem (bekledikçe ürün gelir); yoksa '' */
  function onceden(r: Room, m: Mak): string {
    if (m.cook || m.ready.length >= MAKINE_ON) return '';
    const mm = makMenu(r, m.ist); if (!mm.length) return '';
    return (mm.find(x => !m.ready.includes(x.id)) || mm[0]).id;
  }
  /** makinenin odadaki adı (layout aleti) */
  const makAd = (r: Room, ist: IstasyonId) => { const hit = icLayout(geom(r).m).find(i => ISTASYON_LAYOUT_K[ist].includes(i.k)); return makineAdi(ist, hit?.k); };
  function spawnGuest(r: Room) {
    const g = geom(r), seed = Math.floor(rng.next() * 1e6), look = LOOKS[Math.floor(rng.next() * LOOKS.length)];
    const a = env.reg.add('regular', 'kafe-' + r.room + '-' + seed, { kind: 'regular', look: { lookType: look, lookSeed: seed }, seed }, g.door, { name: '' });
    a.y = a.py = 0;
    const slot = r.guests.filter(x => x.st === 'queue' || x.st === 'in').length;
    const want = pickWant(r);
    if (g.gez.length) {   // shop: first to a rack, look around for a while, then to the till
      const sp = g.gez[Math.floor(rng.next() * g.gez.length)], p = g.w(sp.u, sp.v), o = g.w(sp.u + sp.yaw, sp.v);
      r.guests.push({ a, st: 'in', t: 0, path: [...g.gel(), g.inside, ...g.yol(g.inside, p)], slot: 99, claimed: 0, seat: null, tbl: -1, face: 0, want, gez: 3 + rng.next() * 5, gezYaw: Math.atan2(p.x - o.x, p.z - o.z) + Math.PI });
      return;
    }
    r.guests.push({ a, st: 'in', t: 0, path: approach(r, slot), slot, claimed: 0, seat: null, tbl: -1, face: 0, want, gez: 0, gezYaw: 0 });
  }
  function leave(r: Room, gu: Guest, angry: boolean) {
    const g = geom(r); gu.st = 'out'; gu.t = 0; gu.claimed = 0; gu.path = [...g.yol({ x: gu.a.x, z: gu.a.z }, g.inside), ...(g.avm ? g.git() : [g.door])]; gu.a.mood = angry ? 'impatient' : 'happy';
    if (gu.seat) { if (gu.tbl >= 0) r.seatTaken.delete(gu.tbl); gu.seat = null; gu.tbl = -1; }
    gu.a.say = (angry ? LINES_ANGRY : LINES_OUT)[Math.floor(rng.next() * 3)]; gu.a.sayT = 2.2;
  }
  function served(r: Room, gu: Guest, by: 'player' | 'worker') {
    const h = host(); if (!h) return 0;
    const v = h.sell(r.arsa, gu.want, by === 'player' ? 1.15 : 1); if (!v) { leave(r, gu, true); return 0; }
    const g = geom(r);
    const masa = h.info(r.arsa)?.masa ?? 99, free = g.tables.map((_, i) => i).filter(i => i < masa && !r.seatTaken.has(i));   // stage decides how many tables are open
    if (free.length && rng.chance(0.55)) {
      // sit ON the chair at the table's +u side (masa(): chair at u+0.68, masa4 corner u+0.48 / v+0.48) and face the table centre
      const i = free[Math.floor(rng.next() * free.length)], t = g.tables[i], cu2 = t.k === 'masa4' ? 0.48 : 0.68, cv2 = t.k === 'masa4' ? 0.48 : 0;
      r.seatTaken.add(i); const p = g.w(t.u + cu2, t.v + cv2), c0 = g.w(t.u, t.v);
      gu.st = 'toSeat'; gu.seat = p; gu.tbl = i; gu.face = Math.atan2(c0.x - p.x, c0.z - p.z);
      gu.path = g.yol({ x: gu.a.x, z: gu.a.z }, p); gu.t = 0;
    } else leave(r, gu, false);
    gu.a.mood = 'happy'; gu.a.carry = [];
    return v;
  }
  /** waiting guests in arrival order */
  const waiting = (r: Room) => r.guests.filter(x => x.st === 'queue').sort((p, q) => p.slot - q.slot);

  /** DKN-03: one actor per named crew member, matched by id (hired = walks in with the name, fired = walks out and is gone) */
  function syncWorkers(r: Room) {
    const h = host(), info = h?.info(r.arsa), kad = (info ? info.kadro : []).slice(0, KAFE_ISCI_TAVAN);
    for (let i = r.wk.length - 1; i >= 0; i--) {
      const w = r.wk[i]; if (kad.some(c => c.id === w.cid)) continue;
      if (w.guest) { w.guest.claimed = 0; w.guest = null; }   // a guest claimed by the removed worker is released, never stuck in the queue
      env.reg.remove(w.a); r.wk.splice(i, 1);
    }
    kad.forEach((c) => {
      if (r.wk.some(w => w.cid === c.id)) return;
      const g = geom(r), idx = r.wk.length, role = c.rol === 'barista' || c.rol === 'garson' || c.rol === 'kasiyer' || c.rol === 'asci' ? c.rol : (ISLETME_ROL[ARSA_ISLETME[r.arsa]].find(x => x.rol === c.rol)?.gorunum || 'garson');
      const a = env.reg.add('worker', 'kafe-' + r.room + '-' + c.id, { kind: 'worker', role, look: c.look, seed: (c.id * 977) % 10007 }, g.w(0, g.D / 2 + 0.6), { role, name: c.ad, rank: c.rank, trait: c.huy });
      if (g.avm) { a.x = a.px = AVM_GIRIS.x; a.z = a.pz = AVM_GIRIS.z; } a.y = a.py = 0;   // AVM crew walks in from the mall entrance and rides up
      r.wk.push({ a, cid: c.id, idx, st: 'post', t: 0, guest: null, path: [], item: '' });
      { const w = r.wk[r.wk.length - 1]; w.path = [...g.gel(), g.inside, ...g.yol(g.inside, postOf(r, idx))]; }
    });
    r.wk.forEach((w, i) => { w.idx = i; });   // posts stay packed after somebody leaves
  }
  const postOf = (r: Room, idx: number): Vec2 => { const g = geom(r), L = personelDuraklari(g.pg, Math.max(r.wk.length, idx + 1), g.post, g.narrow); return g.P(L[Math.min(idx, L.length - 1)], -g.arka); };

  function tickRoom(r: Room, dt: number) {
    const h = host(), info = h?.info(r.arsa);
    if (!h || !info) { r.visitors.length = 0; for (const gu of r.guests) env.reg.remove(gu.a); for (const w of r.wk) env.reg.remove(w.a); r.guests.length = 0; r.wk.length = 0; r.seatTaken.clear(); r.mak.clear(); return; }
    syncWorkers(r); tickMak(r, dt);
    // new guests from the hourly customer flow (mulk.ts accrues them into pending)
    const open = r.guests.filter(x => x.st === 'in' || x.st === 'gez' || x.st === 'queue').length + r.visitors.length;
    const amb = env.rules.ambient;
    if ((h.pending[r.arsa] || 0) > 0 && open < Math.min(geom(r).maxQ, info.kuyruk)) {
      h.pending[r.arsa]--;
      // BUF-25: a hungry citizen of the street walks over by own will and becomes the guest at the door; none near = the guest appears as before
      const ar = ARSALAR.find(x => x.id === r.arsa), vs = amb?.sendHungry && ar ? amb.sendHungry(geom(r).avm ? AVM_DIS : arsaKapi(ar), HUNGRY_M) : -1;
      if (vs >= 0) r.visitors.push({ slot: vs, t: 0 }); else spawnGuest(r);
    }
    for (let i = r.visitors.length - 1; i >= 0; i--) {
      const v = r.visitors[i]; v.t += dt;
      const st = amb?.visitStatus ? amb.visitStatus(v.slot) : 'lost';
      if (st === 'in' || st === 'lost' || v.t > VISIT_MAX) { r.visitors.splice(i, 1); spawnGuest(r); }
    }
    // guests
    for (let i = r.guests.length - 1; i >= 0; i--) {
      const gu = r.guests[i], a = gu.a; gu.t += dt;
      if (gu.st === 'in' && gu.gez > 0) { if (follow(a, gu.path, 1.4, dt)) { gu.st = 'gez'; gu.t = 0; a.act = 'idle'; a.speed = 0; a.rot = gu.gezYaw; if (rng.chance(0.35)) { a.say = LINES_GEZ[Math.floor(rng.next() * LINES_GEZ.length)]; a.sayT = 2; } } }
      else if (gu.st === 'gez') {
        a.act = 'idle'; a.speed = 0; a.rot = gu.gezYaw + Math.sin(gu.t * 0.8) * 0.4;   // looking along the rack
        if (gu.t >= gu.gez) { const q = r.guests.filter(x => x !== gu && (x.st === 'queue' || (x.st === 'in' && x.gez <= 0))); gu.slot = q.reduce((mx, x) => Math.max(mx, x.slot), -1) + 1; gu.gez = 0; gu.st = 'in'; gu.t = 0; gu.path = geom(r).yol({ x: a.x, z: a.z }, slotPos(r, q.length)); }
      }
      else if (gu.st === 'in') { if (follow(a, gu.path, 1.5, dt)) { gu.st = 'queue'; gu.t = 0; a.act = 'idle'; a.speed = 0; a.rot = Math.PI * 0 + geomYaw(r); if (gu.want && (waiting(r).indexOf(gu) < 2 || rng.chance(0.4))) { a.say = 'Bir ' + kalemAd(r, gu.want) + ' alabilir miyim?'; a.sayT = 3; } } }
      else if (gu.st === 'queue') {
        const ahead = waiting(r).indexOf(gu); const tp = slotPos(r, ahead < 0 ? gu.slot : ahead);
        if (Math.hypot(tp.x - a.x, tp.z - a.z) > 0.08) step1(a, tp, 1.4, dt), a.act = 'walk'; else { a.act = 'idle'; a.speed = 0; a.rot = geomYaw(r); }
        const left = 1 - gu.t / PAT; a.mood = left < 0.3 ? 'impatient' : 'ok';
        if (gu.t >= PAT && !gu.claimed) leave(r, gu, true);
      } else if (gu.st === 'toSeat') { if (follow(a, gu.path, 1.4, dt)) { gu.st = 'sit'; gu.t = 0; a.act = 'sit'; a.speed = 0; a.rot = gu.face; } }
      else if (gu.st === 'sit') { a.act = 'sit'; a.rot = gu.face; if (gu.t > 14 + (gu.slot % 3) * 3) { a.act = 'idle'; leave(r, gu, false); } }
      else if (gu.st === 'out') { if (follow(a, gu.path, 1.6, dt)) { env.reg.remove(a); r.guests.splice(i, 1); } }
    }
    // workers: take the oldest unclaimed waiting guest, walk to the station of what that guest asked for, make it (its own time), carry it over
    for (const w of r.wk) {
      const a = w.a; w.t += dt; a.state = w.st;   // denetçi / hata ayıklama: çalışanın iş adımı
      if (w.st === 'post') {
        if (w.path.length) { follow(a, w.path, 1.9, dt); continue; }
        const p = postOf(r, w.idx); if (Math.hypot(p.x - a.x, p.z - a.z) > 0.1) { step1(a, p, 1.6, dt); a.act = 'walk'; continue; }
        a.x = p.x; a.z = p.z;   // 2026-11-22: 0.1 m kala durunca iki komşu çalışan birbirine 0.45 m'ye kadar yaklaşıyordu; durağa tam otur
        a.act = 'idle'; a.speed = 0; a.rot = geomYaw(r) + Math.PI; a.carry = [];
        const gu = waiting(r).find(x => !x.claimed);
        if (gu && !(h.fp && r.arsa === 'k3')) { gu.claimed = w.a.id; w.guest = gu; w.item = gu.want; w.st = 'toSt'; w.t = 0; }
        else if (!gu && w.t > 2.5 && r.preT <= 0 && !(h.fp && r.arsa === 'k3')) {
          // boşta: bir makineye önceden ürün koy (tepside beklesin); odada aynı anda tek çalışan, 4 sn arayla
          for (const ist of ISTASYON_SIRA) { if (!MAKINE.has(ist) || !makMenu(r, ist).length) continue; const it = onceden(r, makOf(r, ist)); if (it) { w.item = it; w.st = 'pre'; w.t = 0; r.preT = 4; break; } }
        }
      } else if (w.st === 'pre') {
        const kal = kalemOf(w.item), mp = istasyonNoktasi(r, kal.ist, w.idx), m = makOf(r, kal.ist);
        if (waiting(r).some(x => !x.claimed) && w.t > 0.2 && Math.hypot(mp.x - a.x, mp.z - a.z) > 0.6) { w.st = 'post'; w.t = 0; continue; }   // müşteri geldi: önce ona
        if (Math.hypot(mp.x - a.x, mp.z - a.z) > 0.1) { step1(a, mp, 1.8, dt); a.act = 'walk'; continue; }
        a.speed = 0; a.rot = geomYaw(r) + Math.PI; a.act = 'pour';
        if (w.t > 0.8) { makKoy(r, m, w.item, w.a.id); w.st = 'post'; w.t = 0; a.act = 'idle'; }
      } else if (w.st === 'toSt') {
        if (!w.guest || w.guest.st !== 'queue') { w.guest = null; w.st = 'post'; continue; }
        const kal = kalemOf(w.item), mp = istasyonNoktasi(r, kal.ist, w.idx);
        if (Math.hypot(mp.x - a.x, mp.z - a.z) > 0.1) { step1(a, mp, 1.8, dt); a.act = 'walk'; continue; }
        a.speed = 0; a.rot = geomYaw(r) + Math.PI; w.st = 'brew'; w.t = 0;
        if (MAKINE.has(kal.ist)) { const m = makOf(r, kal.ist); if (!m.ready.includes(w.item) && !(m.cook === w.item)) makKoy(r, m, w.item, w.a.id); }
      } else if (w.st === 'brew') {
        const kal = kalemOf(w.item); a.speed = 0;
        a.act = kal.ist === 'ocak' || kal.ist === 'izgara' || kal.ist === 'firin' || kal.ist === 'kopya' || kal.ist === 'dikis' ? 'cut' : 'pour';
        if (!w.guest || w.guest.st !== 'queue') { w.guest = null; w.st = 'post'; a.act = 'idle'; continue; }
        if (MAKINE.has(kal.ist)) {
          // makinede: hazırsa tepsiden al; makine boşaldıysa (başkasının ürünü çıktı) kendi ürününü koy; değilse başında bekle
          const m = makOf(r, kal.ist);
          if (makAl(m, w.item)) { w.st = 'hand'; w.t = 0; a.carry = [{ type: 'urun:' + w.item, tier: 1 } as never]; }
          else if (!m.cook) makKoy(r, m, w.item, w.a.id);
          else if (m.cook !== w.item) a.act = 'idle';
          continue;
        }
        if (w.t >= kal.sure / (1 + 0.12 * info.lv)) { w.st = 'hand'; w.t = 0; a.carry = [{ type: 'urun:' + w.item, tier: 1 } as never]; }
      } else if (w.st === 'hand') {
        const gu = w.guest; if (!gu || gu.st !== 'queue') { w.guest = null; w.st = 'post'; a.carry = []; continue; }
        const g = geom(r), tp = g.P(Math.min(g.endU - 0.6, slotU(g, waiting(r).indexOf(gu))), -g.arka);
        if (Math.hypot(tp.x - a.x, tp.z - a.z) > 0.1) { step1(a, tp, 1.8, dt); a.act = 'carry'; continue; }
        a.act = 'idle'; if (w.t > 0.9) { a.carry = []; served(r, gu, 'worker'); w.guest = null; w.st = 'post'; a.say = 'Buyurun!'; a.sayT = 1.6; }
      }
    }
  }
  const geomYaw = (r: Room) => { const m = IC_BY_ID[r.room], g = geom(r); const a = icWorld(m, 0, 0), b = g.vert ? icWorld(m, 1, 0) : icWorld(m, 0, -1); return Math.atan2(b.x - a.x, b.z - a.z); };   // facing the counter (-v)

  // the player serves from the station that makes what the first waiting guest asked for: stand there until the bar fills.
  // 2026-11-22 makine istasyonları: oyuncu ürünü makineye koyar (0.4 sn), makine kendi kendine yapar (oyuncu başka makineye
  // gidebilir); hazır olunca makinenin başına dönen oyuncu sıradaki müşteriye verir. Müşteri yoksa da koyabilir: tepside bekler.
  const kat0 = () => ((env.player() as { kat?: number }).kat || 0);
  const uygun = (r: Room, ist: IstasyonId) => waiting(r).filter(x => !!x.want && kalemOf(x.want).ist === ist);
  for (const r of rooms) {
    for (const ist of ISTASYON_SIRA) {
      const g = geom(r), head = () => waiting(r).find(x => !x.claimed) || waiting(r)[0];
      let work = 0, last = -99, who = 0;
      if (MAKINE.has(ist)) {
        /** tepsideki üründen bekleyen bir müşteri (önce kimsenin almadığı) */
        const hazirMus = () => { const m = r.mak.get(ist); if (!m || !m.ready.length) return null; const q = uygun(r, ist).filter(x => m.ready.includes(x.want)); return q.find(x => !x.claimed) || q[0] || null; };
        /** makine boşsa koyulacak ürün: bekleyen müşterinin istediği (tepside / makinede olmayan), yoksa önceden yapılacak */
        const koyulacak = () => {
          const m = makOf(r, ist); if (m.cook) return '';
          const q = uygun(r, ist).find(x => !m.ready.includes(x.want)); if (q) return q.want;
          return m.ready.length < MAKINE_TEPSI && makMenu(r, ist).length ? (onceden(r, m) || (m.ready.length < MAKINE_TEPSI ? makMenu(r, ist)[0].id : '')) : '';
        };
        env.interactions.register({
          id: 'kafeIst.' + r.room + '.' + ist, pos: g.P(istasyonA(r, ist), 0.85), radius: 1.0, kind: 'station', dwell: 0.4, interval: 0.1,
          canAct: () => kat0() === g.kat && !!host()?.info(r.arsa) && !(host()!.fp && r.arsa === 'k3') && (!!hazirMus() || !!koyulacak()),
          act: () => {
            const m = makOf(r, ist), gu = hazirMus();
            if (gu && makAl(m, gu.want)) {
              const ad = kalemAd(r, gu.want), v = served(r, gu, 'player');
              if (v) env.host.heroSay('Buyurun! ' + (ad ? ad.charAt(0).toLocaleUpperCase('tr') + ad.slice(1) + ' ' : '') + '+' + Math.round(v) + ' ₺ kasaya', 1.6);
              return 'continue';
            }
            const it = koyulacak();
            if (it && makKoy(r, m, it, -1)) {
              const ad = kalemAd(r, it); env.host.heroSay(makAd(r, ist) + ' çalışıyor: ' + ad + ' (' + Math.ceil(m.sure) + ' sn)', 1.8);
            }
            return 'done';
          },
        });
        continue;
      }
      env.interactions.register({
        id: 'kafeIst.' + r.room + '.' + ist, pos: g.P(istasyonA(r, ist), 0.85), radius: 1.0, kind: 'station', dwell: 0.4, interval: 0.1,
        canAct: () => { const gu = head(); return kat0() === g.kat && !!host()?.info(r.arsa) && !!gu && !!gu.want && kalemOf(gu.want).ist === ist; },
        act: (_a, ctx) => {
          const gu = head(), inf = host()?.info(r.arsa); if (!gu || !inf) return 'done';
          const el = ctx.t - last < 0.5 ? ctx.t - last : 0.5; last = ctx.t;
          if (who !== gu.a.id) { who = gu.a.id; work = 0; }
          work += el * (1 + 0.12 * inf.lv) / kalemOf(gu.want).sure;
          if (work < 1) return 'continue';
          work = 0; const ad = kalemAd(r, gu.want), v = served(r, gu, 'player');
          if (v) env.host.heroSay('Buyurun! ' + (ad ? ad.charAt(0).toLocaleUpperCase('tr') + ad.slice(1) + ' ' : '') + '+' + Math.round(v) + ' ₺ kasaya', 1.6);
          return waiting(r).length ? 'continue' : 'done';
        },
      });
    }
  }
  /** görünüm için: makinelerin yeri, pişen ürün ve ilerleme, hazır tepsi (yalnız kullanılmış makineler) */
  function makineler(room?: string): MakineGorunum[] {
    const o: MakineGorunum[] = [];
    for (const r of rooms) {
      if (room && r.room !== room) continue;
      for (const m of r.mak.values()) {
        if (!m.cook && !m.ready.length) continue;
        // ürünler tezgâhın müşteri yarısında, halka makinenin üstünde personel tarafında (yukarıdan bakınca ürünü örtmez); dx/dz tezgâh boyu yönü
        const g = geom(r), A = istasyonA(r, m.ist), Ai = A + (A + 0.5 < g.endU - 0.4 ? 0.48 : -0.48), at = g.P(Ai, 0.16), hl = g.P(A, -0.75), d1 = g.P(Ai + 1, 0.16);   // ürünler makinenin yanında (içinde kalmasın)
        o.push({ room: r.room, kat: g.kat, ist: m.ist, ad: makAd(r, m.ist), x: at.x, z: at.z, hx: hl.x, hz: hl.z, dx: d1.x - at.x, dz: d1.z - at.z, cook: m.cook, p: m.cook ? Math.min(1, m.t / m.sure) : 1, kalan: m.cook ? Math.max(0, m.sure - m.t) : 0, ready: [...m.ready] });
      }
    }
    return o;
  }
  const siparis = (r: Room) => waiting(r).slice(0, 4).map(gu => menuOf(r).find(m => m.id === gu.want)?.ad || '');
  let on = false;
  return {
    id: 'kafe', order: 47, phase: 'sim',
    step(ctx: SimCtx) {
      const h = host(); if (!h) return;
      if (!on) {
        on = true; h.live = true; rt.kafeMakineler = makineler;
        h.fpDone = (arsa, ok) => { const r = rooms.find(x => x.arsa === arsa); const gu = r && waiting(r)[0]; if (r && gu) { leave(r, gu, !ok); if (ok) gu.a.mood = 'happy'; } };   // first-person counter: the head of the queue is the one being served there
      }
      for (const r of rooms) { r.preT -= Math.min(ctx.dt, 0.25); tickRoom(r, Math.min(ctx.dt, 0.25)); }
    },
    rooms: () => rooms.map(r => ({ room: r.room, guests: r.guests.length, waiting: waiting(r).length, workers: r.wk.length, siparisler: siparis(r) })),
    siparisOf: (room: string) => { const r = rooms.find(x => x.room === room); return r ? siparis(r) : []; },
    makineler,
  };
}
