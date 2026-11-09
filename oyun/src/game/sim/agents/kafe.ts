/**
 * Café / bistro room sim (survey 2026-11-09 + user "cafe ve bistro büfe gibi, içine müşteri gelecek, ben ve tuttuğum
 * işçiler sunacak"): the same logic as the büfe with different content. Guests are real actors: they walk in through the
 * door, queue at the counter, show a patience bar via mood, get served by the PLAYER (stand at the machine, dwell) or by
 * the café's HIRED workers (real actors behind the counter: brew, hand over), pay into the café till, and half of them sit
 * down at a table for a while before they leave. No guest, no income: an unattended café with no workers earns nothing.
 * Numbers come from mulk.ts (`rt.kafeHost`): customers per hour, price, stock. Rooms: content/ic-mekan.ts kafe1 / kafe2.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { IC_BY_ID, icWorld, icDim, icLayout } from '../../../content/ic-mekan';
import type { AgentEnv } from './env';
import type { Actor } from './types';

interface KafeHostApi {
  live: boolean; fp: boolean; pending: Record<string, number>; fpDone?: (arsa: string, ok: boolean) => void;
  info(id: string): { lv: number; isci: number; stok: number; tema: string; fiyat: number; menu: string[] } | null;
  sell(id: string, bonus?: number): number;
}
const ROOMS: { arsa: string; room: string; bistro: boolean }[] = [{ arsa: 'k1', room: 'kafe1', bistro: false }, { arsa: 'k2', room: 'kafe2', bistro: true }, { arsa: 'k4', room: 'okul', bistro: false }, { arsa: 'k5', room: 'avm', bistro: false }, { arsa: 'k6', room: 'tesis', bistro: false }, { arsa: 'k3', room: 'kirtasiye', bistro: false }];
const PAT = 45, LOOKS = ['universiteli', 'teyze', 'emekli', 'plaza', 'turgrubu', 'gezgin', 'balayi', 'taraftar'];
const LINES_IN = ['Selam, bir şey alabilir miyim?', 'Kahve kokusu buraya kadar geldi.', 'Bugün de geldik!', 'Boş masa var mı?'];
const LINES_OUT = ['Eline sağlık!', 'Çok güzel olmuş.', 'Yine geleceğiz!', 'Tam kıvamında.'];
const LINES_ANGRY = ['Çok bekledim, gidiyorum!', 'Kimse yok mu?', 'Bu kadar beklenmez.'];

interface Guest { a: Actor; st: 'in' | 'queue' | 'served' | 'toSeat' | 'sit' | 'out'; t: number; path: Vec2[]; slot: number; claimed: number; seat: Vec2 | null; want: string }
interface Wk { a: Actor; idx: number; st: 'post' | 'brew' | 'hand'; t: number; guest: Guest | null; path: Vec2[] }
interface Room { arsa: string; room: string; bistro: boolean; guests: Guest[]; wk: Wk[]; seatTaken: Set<number> }

export interface KafeSystem extends System { rooms(): { room: string; guests: number; waiting: number; workers: number }[]; serveByPlayer(room: string): number }

export function createKafe(env: AgentEnv, rt: Record<string, unknown>): KafeSystem {
  const rng = env.rng('kafe');
  const rooms: Room[] = ROOMS.map(r => ({ ...r, guests: [], wk: [], seatTaken: new Set<number>() }));
  const host = () => rt.kafeHost as KafeHostApi | undefined;
  const geom = (r: Room) => {
    const m = IC_BY_ID[r.room], D = icDim(m).D, W = icDim(m).W, lay = icLayout(m), tz = lay.find(i => i.k === 'tezgah')!;
    const vert = (tz.ry || 0) % 2 === 1;   // kırtasiye: the counter stands across the east end, customers queue on its west side
    const w = (u: number, v: number): Vec2 => icWorld(m, u, v);
    /** a = position ALONG the counter, b = distance from the counter on the customer side (negative = staff side) */
    const P = (a: number, b: number): Vec2 => vert ? w(tz.u - b, a) : w(a, tz.v + b);
    const cu = vert ? tz.v - tz.w / 2 + 0.3 : tz.u - tz.w / 2 + 1.0, endU = vert ? tz.v + tz.w / 2 + 0.5 : tz.u + tz.w / 2 + 0.6;
    const tables = lay.filter(i => i.k.startsWith('masa')).map(i => ({ u: i.u, v: i.v }));
    return { m, D, W, bv: tz.v, cu, endU, w, P, vert, door: w(0, D / 2 + 2.6), inside: w(0, D / 2 - 1.0), tables, sdv: D < 5 ? -0.6 : 0.7, wide: !vert && !(m.tur === 'kafe' || m.tur === 'bistro'), gap: vert ? 0.5 : 0.85, maxQ: vert ? 3 : 5 };
  };
  const slotU = (g: { cu: number; gap: number; vert: boolean }, i: number) => g.cu + (g.vert ? 0 : 0.7) + Math.max(0, i) * g.gap;
  const slotPos = (r: Room, i: number) => { const g = geom(r); return g.P(slotU(g, i), 1.15); };
  const approach = (r: Room, i: number): Vec2[] => { const g = geom(r); return g.wide ? [g.inside, g.w(slotU(g, i), g.D / 2 - 1.0), slotPos(r, i)] : [g.inside, slotPos(r, i)]; };
  const step1 = (a: Actor, to: Vec2, sp: number, dt: number) => {   // straight-line step, returns true when arrived
    const dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { a.speed = 0; return true; }
    const k = Math.min(1, sp * dt / d); a.x += dx * k; a.z += dz * k; a.rot = Math.atan2(dx, dz); a.speed = sp; return false;
  };
  const follow = (a: Actor, path: Vec2[], sp: number, dt: number) => { if (!path.length) return true; if (step1(a, path[0], sp, dt)) path.shift(); a.act = 'walk'; return !path.length; };

  function spawnGuest(r: Room) {
    const g = geom(r), seed = Math.floor(rng.next() * 1e6), look = LOOKS[Math.floor(rng.next() * LOOKS.length)];
    const a = env.reg.add('regular', 'kafe-' + r.room + '-' + seed, { kind: 'regular', look: { lookType: look, lookSeed: seed }, seed }, g.door, { name: '' });
    const slot = r.guests.filter(x => x.st === 'queue' || x.st === 'in').length;
    r.guests.push({ a, st: 'in', t: 0, path: approach(r, slot), slot, claimed: 0, seat: null, want: '' });
    if (rng.chance(0.4)) { a.say = LINES_IN[Math.floor(rng.next() * LINES_IN.length)]; a.sayT = 2.5; }
  }
  function leave(r: Room, gu: Guest, angry: boolean) {
    const g = geom(r); gu.st = 'out'; gu.t = 0; gu.claimed = 0; gu.path = [g.inside, g.door]; gu.a.mood = angry ? 'impatient' : 'happy';
    if (gu.seat) { const i = g.tables.findIndex(t => { const p = g.w(t.u, t.v + g.sdv); return Math.hypot(p.x - gu.seat!.x, p.z - gu.seat!.z) < 0.01; }); if (i >= 0) r.seatTaken.delete(i); gu.seat = null; }
    gu.a.say = (angry ? LINES_ANGRY : LINES_OUT)[Math.floor(rng.next() * 3)]; gu.a.sayT = 2.2;
  }
  function served(r: Room, gu: Guest, by: 'player' | 'worker') {
    const h = host(); if (!h) return 0;
    const v = h.sell(r.arsa, by === 'player' ? 1.15 : 1); if (!v) { leave(r, gu, true); return 0; }
    const g = geom(r);
    const free = g.tables.map((_, i) => i).filter(i => !r.seatTaken.has(i));
    if (free.length && rng.chance(0.55)) {
      const i = free[Math.floor(rng.next() * free.length)]; r.seatTaken.add(i); const p = g.w(g.tables[i].u, g.tables[i].v + g.sdv);
      gu.st = 'toSeat'; gu.seat = p; gu.path = [g.w(g.tables[i].u + 0.9, g.bv + 1.6), g.w(g.tables[i].u + 0.9, g.tables[i].v + g.sdv), p]; gu.t = 0;
    } else leave(r, gu, false);
    gu.a.mood = 'happy'; gu.a.carry = [];
    return v;
  }
  /** waiting guests in arrival order */
  const waiting = (r: Room) => r.guests.filter(x => x.st === 'queue').sort((p, q) => p.slot - q.slot);

  function syncWorkers(r: Room) {
    const h = host(), info = h?.info(r.arsa), want = info ? Math.min(3, info.isci) : 0;
    while (r.wk.length > want) { const w = r.wk.pop()!; env.reg.remove(w.a); }
    while (r.wk.length < want) {
      const g = geom(r), idx = r.wk.length, seed = 31 * idx + (r.bistro ? 7 : 3), role = idx === 0 ? 'barista' : 'garson';
      const a = env.reg.add('worker', 'kafe-' + r.room + '-w' + idx, { kind: 'worker', role, seed }, g.w(0, g.D / 2 + 0.6), { role, name: 'Çalışan', rank: 0 });
      r.wk.push({ a, idx, st: 'post', t: 0, guest: null, path: [g.inside, g.P(g.endU, 1.4), g.P(g.endU, -0.7), g.P(g.cu + (g.vert ? 0.6 : 2.3) + idx * (g.vert ? 0.5 : 1.4), -0.7)] });
    }
  }
  const postOf = (r: Room, idx: number): Vec2 => { const g = geom(r); return g.P(g.cu + (g.vert ? 0.6 : 1.5) + idx * (g.vert ? 0.5 : 1.4), -0.7); };

  function tickRoom(r: Room, dt: number) {
    const h = host(), info = h?.info(r.arsa);
    if (!h || !info) { for (const gu of r.guests) env.reg.remove(gu.a); for (const w of r.wk) env.reg.remove(w.a); r.guests.length = 0; r.wk.length = 0; r.seatTaken.clear(); return; }
    syncWorkers(r);
    // new guests from the hourly customer flow (mulk.ts accrues them into pending)
    const open = r.guests.filter(x => x.st === 'in' || x.st === 'queue').length;
    if ((h.pending[r.arsa] || 0) > 0 && open < geom(r).maxQ && info.stok > 0) { h.pending[r.arsa]--; spawnGuest(r); }
    // guests
    for (let i = r.guests.length - 1; i >= 0; i--) {
      const gu = r.guests[i], a = gu.a; gu.t += dt;
      if (gu.st === 'in') { if (follow(a, gu.path, 1.5, dt)) { gu.st = 'queue'; gu.t = 0; a.act = 'idle'; a.speed = 0; a.rot = Math.PI * 0 + geomYaw(r); } }
      else if (gu.st === 'queue') {
        const ahead = waiting(r).indexOf(gu); const tp = slotPos(r, ahead < 0 ? gu.slot : ahead);
        if (Math.hypot(tp.x - a.x, tp.z - a.z) > 0.08) step1(a, tp, 1.4, dt), a.act = 'walk'; else { a.act = 'idle'; a.speed = 0; a.rot = geomYaw(r); }
        const left = 1 - gu.t / PAT; a.mood = left < 0.3 ? 'impatient' : 'ok';
        if (gu.t >= PAT && !gu.claimed) leave(r, gu, true);
      } else if (gu.st === 'toSeat') { if (follow(a, gu.path, 1.4, dt)) { gu.st = 'sit'; gu.t = 0; a.act = 'sit'; a.speed = 0; } }
      else if (gu.st === 'sit') { a.act = 'sit'; if (gu.t > 14 + (gu.slot % 3) * 3) { a.act = 'idle'; leave(r, gu, false); } }
      else if (gu.st === 'out') { if (follow(a, gu.path, 1.6, dt)) { env.reg.remove(a); r.guests.splice(i, 1); } }
    }
    // workers: take the oldest unclaimed waiting guest, brew at the machine, hand over
    const brew = 3.0 / (1 + 0.12 * info.lv);
    for (const w of r.wk) {
      const a = w.a; w.t += dt;
      if (w.st === 'post') {
        if (w.path.length) { follow(a, w.path, 1.9, dt); continue; }
        const p = postOf(r, w.idx); if (Math.hypot(p.x - a.x, p.z - a.z) > 0.1) { step1(a, p, 1.6, dt); a.act = 'walk'; continue; }
        a.act = 'idle'; a.speed = 0; a.rot = geomYaw(r) + Math.PI;
        const gu = waiting(r).find(x => !x.claimed);
        if (gu && info.stok > 0 && !(h.fp && r.arsa === 'k3')) { gu.claimed = w.a.id; w.guest = gu; w.st = 'brew'; w.t = 0; }
      } else if (w.st === 'brew') {
        const g = geom(r), mp = g.P(g.cu + (g.vert ? 0.2 : 0.2) + w.idx * 0.5, -0.7);
        if (Math.hypot(mp.x - a.x, mp.z - a.z) > 0.1) { step1(a, mp, 1.8, dt); a.act = 'walk'; w.t = 0; continue; }
        a.act = 'pour'; a.speed = 0; if (w.t >= brew) { w.st = 'hand'; w.t = 0; }
        if (!w.guest || w.guest.st !== 'queue') { w.guest = null; w.st = 'post'; }
      } else if (w.st === 'hand') {
        const gu = w.guest; if (!gu || gu.st !== 'queue') { w.guest = null; w.st = 'post'; continue; }
        const g = geom(r), tp = g.P(slotU(g, waiting(r).indexOf(gu)), -0.7);
        if (Math.hypot(tp.x - a.x, tp.z - a.z) > 0.1) { step1(a, tp, 1.8, dt); a.act = 'carry'; a.carry = [{ type: 'cay', tier: 1 } as never]; continue; }
        a.act = 'idle'; a.carry = []; if (w.t > 0.9) { served(r, gu, 'worker'); w.guest = null; w.st = 'post'; a.say = 'Buyurun!'; a.sayT = 1.6; }
      }
    }
  }
  const geomYaw = (r: Room) => { const m = IC_BY_ID[r.room], g = geom(r); const a = icWorld(m, 0, 0), b = g.vert ? icWorld(m, 1, 0) : icWorld(m, 0, -1); return Math.atan2(b.x - a.x, b.z - a.z); };   // facing the counter (-v)

  // the player serves from the machine (dwell interaction = brewing time)
  for (const r of rooms) {
    const reg = () => {
      const g = geom(r), id = 'kafeYap.' + r.room;
      env.interactions.register({
        id, pos: g.P(g.vert ? g.bv : g.cu, 0.85), radius: 1.0, kind: 'station', dwell: 2.2, interval: 2.2,
        canAct: () => !!host()?.info(r.arsa) && waiting(r).length > 0,
        act: () => {
          const gu = waiting(r).find(x => !x.claimed) || waiting(r)[0]; if (!gu) return 'done';
          const v = served(r, gu, 'player'); if (v) { rt.toastKafe = { room: r.room, v }; }
          return waiting(r).length ? 'continue' : 'done';
        },
      });
    };
    reg();
  }
  let on = false;
  return {
    id: 'kafe', order: 47, phase: 'sim',
    step(ctx: SimCtx) {
      const h = host(); if (!h) return;
      if (!on) {
        on = true; h.live = true;
        h.fpDone = (arsa, ok) => { const r = rooms.find(x => x.arsa === arsa); const gu = r && waiting(r)[0]; if (r && gu) { leave(r, gu, !ok); if (ok) gu.a.mood = 'happy'; } };   // first-person counter: the head of the queue is the one being served there
      }
      for (const r of rooms) tickRoom(r, Math.min(ctx.dt, 0.25));
    },
    rooms: () => rooms.map(r => ({ room: r.room, guests: r.guests.length, waiting: waiting(r).length, workers: r.wk.length })),
    serveByPlayer(room) { const r = rooms.find(x => x.room === room); if (!r) return 0; const gu = waiting(r)[0]; return gu ? served(r, gu, 'player') : 0; },
  };
}
