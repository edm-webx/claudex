/**
 * Hired workers (v2 game.js "Workers": spawnWorkerRig, updateWorker, stationWork, garsonWork, cleanerWork, wake, rank).
 * One walker per `state.workers` entry (a new entry walks in from the job corner, watches Sabri for 3 s, then takes
 * over). Production goes through A's `StationApi.operate` (progress lives there), carrying through the host.
 * Traits: uykucu (sleeps, wake by walking next to him), fenomen (selfie, followers), geveze/çevresi (chat lines),
 * türkü (song pause), bıçak (show), aceleci (drops one in 20), plus the speed terms in traits.ts.
 * Deterministic: rng stream 'workers'. The actor registry carries the pose for the view.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import type { WorkerSave, GameState, ProductId } from '../schema';
import { ROLES, RANKS, rankOf, moraleFactor, MORALE_START } from '../../../content/ranks';
import { LINES } from '../../../content/lines';
import type { Actor, CarryItem } from './types';
import { Walker, near2, side } from './move';
import { traitFx, traitId, workerSpeed, moraleOf } from './traits';
import type { AgentEnv } from './env';
import { zeminSave } from '../zemin';
import { IC_BY_ID, icWorld, icDim } from '../../../content/ic-mekan';

interface WRt {
  w: WorkerSave; a: Actor; wk: Walker; st: ProductId | null;
  state: string; t: number; boostT: number; boostX: number; made: number; nearT: number; moraleCd: number; pauseT: number; workT: number;
  job: { index: number } | null; loadT: number; nextSleep: number; selfieNext: number; songNext: number; chatNext: number; sleepFor: number; selfieFor: number;
  jobKey: string;
}

export interface WorkersSystem extends System {
  /** Live runtime rows for state views / tests. */
  rows(): { id: number; name: string; role: string; state: string; x: number; z: number; rank: number; morale: number }[];
  /** Fraction the queue's patience drains slower near (x,z): Geveze / Güler yüzlü / Türkü. */
  aura(x: number, z: number): number;
  /** Rank check after external xp changes (training). */
  recheck(workerId: number): void;
  say(workerId: number, text: string, t?: number): void;
  /** Test/force hook: put a sleeper-trait worker to sleep now. */
  forceSleep(workerId: number): void;
}

const FRONT_LINES: Record<string, string[]> = {
  guvenlik: ['Gözüm kasada.', 'Burada kapkaç yok.', 'Sıraya lütfen.'], muzisyen: ['Bir türkü de sizin için!', 'Boğaz’da akşam olur...', 'Alkışlar!'],
  hostes: ['Hoş geldiniz, buyurun masanız!', 'Kaç kişisiniz?'], barista: ['Köpüğü tam kıvamında.', 'Demli çay geliyor!'], mudur: ['Herkes yerine!', 'Bugün rekor kıracağız.'], vale: ['Anahtarınız bende.', 'Arabanız hazır!'],
};
export function createWorkers(env: AgentEnv): WorkersSystem {
  const rows: WRt[] = [];
  let first = true;
  const { host, book, reg } = env;
  const rng = env.rng('workers');

  const say = (rt: WRt, text: string, t = 2.2) => { rt.a.say = text; rt.a.sayT = t; };
  const emit = env.emit;

  function home(rt: WRt, S: GameState): Vec2 {
    if (rt.st) return book.stationStand(rt.st);
    if (rt.w.role === 'garson') {
      const i = rows.filter((x) => x.w.role === 'garson').indexOf(rt);
      return side(book.get('counter.standAt'), 1.3 + i * 0.7, 0.1);
    }
    if (ROLES[rt.w.role]?.on) {   // front-of-house posts around the counter
      const c = book.get('counter.standAt'), i = rows.filter((x) => x.w.role === rt.w.role).indexOf(rt);
      const o: Record<string, [number, number]> = { guvenlik: [4.2, 3.2], muzisyen: [-5.5, 4.2], hostes: [2.6, 4.4], barista: [-2.2, 0.4], mudur: [1.2, 1.8], vale: [7.5, 6.5] };
      const [dx, dz] = o[rt.w.role] || [0, 3];
      return { x: c.x + dx + i * 1.1, z: c.z + dz };
    }
    return book.get('jobCorner');
  }
  function spawn(w: WorkerSave, S: GameState, instant: boolean): WRt {
    const role = ROLES[w.role];
    const st = (role && role.station ? role.station : null) as ProductId | null;
    const km = !!role?.mutfak, start = km ? icWorld(IC_BY_ID.mutfak, 0, icDim(IC_BY_ID.mutfak).D / 2 + 0.8) : book.get('jobCorner');
    const seed = (w.id * 977) % 10007;
    const a = reg.add('worker', String(w.id), { kind: 'worker', role: w.role, look: (w as { look?: unknown }).look, seed }, start,
      { role: w.role, trait: traitId(w), name: w.name, rank: rankOf(w.xp || 0), rarity: w.rarity });
    const rt: WRt = {
      w, a, wk: new Walker(a, env.nav), st, state: 'arrive', t: 0, boostT: 0, boostX: 1, made: 0, nearT: 0, moraleCd: 30, pauseT: 0, workT: 0,
      job: null, loadT: 0, nextSleep: 0, selfieNext: S.playT + 100, songNext: S.playT + 70, chatNext: S.playT + 25, sleepFor: 0, selfieFor: 0, jobKey: '',
    };
    const fx = traitFx(w);
    if (fx.sleep) rt.nextSleep = S.tut.rizaSleep ? S.playT + rng.range(80, 100) : Math.max(660, S.playT + 60);
    rows.push(rt);
    if (km) { rt.state = 'kArrive'; if (instant) { const [u, v] = kIdlePost(rt), q = icWorld(IC_BY_ID.mutfak, u, v); a.x = a.px = q.x; a.z = a.pz = q.z; rt.state = 'kBack'; } return rt; }
    if (instant) {
      const h = home(rt, S); a.x = a.px = h.x; a.z = a.pz = h.z;
      rt.state = role?.on ? 'front' : st ? 'work' : 'idle';
    } else {
      const h = home(rt, S);
      rt.wk.goTo(st ? side(h, 0.9, 0.35) : h);
      say(rt, rng.pick(LINES.workers.hello), 2.5);
    }
    return rt;
  }
  function remove(rt: WRt) {
    const i = rows.indexOf(rt); if (i >= 0) rows.splice(i, 1);
    reg.remove(rt.a);
  }
  function checkRank(rt: WRt) {
    const w = rt.w, r = rankOf(w.xp || 0);
    if (r > Number(w.rank || 0)) {
      w.rank = r; w.morale = Math.min(100, moraleOf(w) + 8);
      rt.a.info.rank = r;
      say(rt, LINES.workers.rankUp[r - 1] || 'Terfi!', 3);
      host.toast(w.name + ' artık ' + RANKS[r].name + '!', 'good');
      emit('rankUp', { name: w.name, rank: r });
      if (r >= 1) host.statMax('kalfa', 1);
      if (r >= 2) host.statMax('usta', 1);
    }
  }
  function wake(rt: WRt, S: GameState, bySabri: boolean) {
    const fx = traitFx(rt.w);
    rt.state = 'work'; rt.a.act = 'idle'; rt.a.mood = 'ok';
    if (bySabri) {
      rt.boostT = 20; rt.boostX = 3; say(rt, LINES.workers.wake, 3); host.stat('wakes'); host.heroSay('Uyan bakalım!', 1.5);
      if (!S.tut.rizaSleep) S.tut.rizaSleep = 1;
      emit('wake', { name: rt.w.name });
    } else { rt.boostT = 10; rt.boostX = 2; say(rt, 'Hah! Dinç uyandım.', 2); }
    rt.nextSleep = S.playT + rng.range(85, 100) + (bySabri ? 20 : 10);
    if (!fx.sleep) rt.nextSleep = 1e12;
  }
  const speedOf = (rt: WRt, S: GameState) => workerSpeed(rt.w, { hour: host.hour(), station: rt.st, teamWin: S.teamWin, teamDay: S.teamDay, day: S.day, boostT: rt.boostT, boostX: rt.boostX });
  const inTransit = (p: string, except: WRt) => { let n = 0; for (const o of rows) if (o !== except) for (const it of o.a.carry) if (it.type === p) n++; return n; };

  function garsonPick(rt: WRt): ProductId | null {
    const need = host.need();
    let best: ProductId | null = null, bs = 0;
    for (const p of host.openProducts()) {
      const grab = host.isGrab(p);
      if (!grab && host.outCount(p) === 0) continue;
      const transit = inTransit(p, rt);
      const stock = host.counterStock(p) + transit;
      if (stock >= 7) continue;
      let score = (need[p] || 0) - transit;
      if (score <= 0 && stock < 2) score = 0.4;
      if (!grab && host.outCount(p) >= 5) score += 1.2;
      if (score > bs) { bs = score; best = p; }
    }
    return best;
  }
  function claimed(index: number, except: WRt) { return rows.some((o) => o !== except && o.job && o.job.index === index); }

  function stationWork(rt: WRt, S: GameState, dt: number) {
    const fx = traitFx(rt.w), a = rt.a;
    if (rt.wk.walk(dt, 2.4)) { a.act = 'walk'; return; }
    a.act = 'idle';
    const k = rt.st!;
    if (!host.stationBuilt(k)) return;
    const stand = book.stationStand(k);
    if (!near2(a, stand, 0.3)) { rt.wk.goTo(stand); return; }
    rt.wk.face(book.stationPos(k), dt);
    if (fx.sleep && S.playT >= rt.nextSleep) { rt.state = 'sleep'; rt.t = 0; rt.sleepFor = rng.range(15, 25); say(rt, LINES.workers.sleep, 2); emit('workerSleep', { name: rt.w.name }); return; }
    if (fx.selfie && S.playT >= rt.selfieNext) { rt.state = 'selfie'; rt.t = 0; rt.selfieFor = rng.chance(0.35) ? 10 : 5; rt.selfieNext = S.playT + 120; say(rt, LINES.workers.selfie, 3); return; }
    if (fx.songPause && S.playT >= rt.songNext) { rt.songNext = S.playT + rng.range(60, 90); rt.pauseT = 4; say(rt, LINES.workers.song, 4); }
    if (rt.pauseT > 0 || host.outFull(k)) { a.act = 'idle'; return; }
    a.act = ROLES[rt.w.role].act === 'pour' ? 'pour' : 'cut';
    const made = host.operate(k, rt.w.id, dt, speedOf(rt, S), fx.price ? 1 + fx.price : 1);
    if (made) {
      rt.made++;
      rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt);
      if (fx.dropEvery && rt.made % fx.dropEvery === 0) { host.dropLast(k); say(rt, LINES.workers.drop, 2); return; }
      if (fx.showEvery && rt.made % fx.showEvery === 0) { rt.pauseT = 1; say(rt, LINES.workers.show, 1.5); }
    }
  }
  function garsonWork(rt: WRt, S: GameState, dt: number) {
    const fx = traitFx(rt.w), a = rt.a;
    const speed = 2.6 * (1 + (fx.walk || 0)) * moraleFactor(moraleOf(rt.w)) * (rt.boostT > 0 ? rt.boostX : 1);
    const cap = (ROLES.garson.carry || 4) + (fx.carry || 0);
    a.act = rt.a.carry.length ? 'carry' : 'idle';
    switch (rt.state) {
      case 'idle': {
        if (rt.wk.walk(dt, speed)) { a.act = a.carry.length ? 'carry' : 'walk'; return; }
        rt.loadT -= dt; if (rt.loadT > 0) return;
        rt.loadT = 0.4;
        if (a.carry.length) { rt.state = 'toCounter'; rt.wk.goTo(side(book.get('counter.standAt'), 0.5, 0)); return; }
        if (!a.carry.length && host.garsonClaim && host.garsonClaim(rt.w.id, 0).length === 0 && !host.garsonOpen?.(rt.w.id).length) { const cap2 = Math.min(3, 1 + Math.floor(rankOf(rt.w.xp || 0) / 3) + (fx.carry ? 1 : 0)); const js = host.garsonClaim(rt.w.id, cap2); if (js.length) { rt.state = 'toPass'; rt.t = 0; rt.wk.goTo(side(book.get('counter.standAt'), 0.5, 0)); return; } }
        const p = garsonPick(rt);
        if (p) { rt.job = null; rt.jobKey = p; rt.state = 'toSrc'; rt.wk.goTo(side(book.stationStand(p), 0.55, 0.2)); return; }
        const dirty = host.dirtyTables().filter((t) => !claimed(t.index, rt));
        if (dirty.length && !rows.some((o) => o.w.role === 'temizlik')) { rt.job = { index: dirty[0].index }; rt.state = 'toClean'; rt.wk.goTo(dirty[0]); return; }
        const h = home(rt, S); if (!near2(a, h, 0.4)) rt.wk.goTo(h); else rt.wk.face(book.queue(0), dt);
        return;
      }
      case 'toSrc': if (!rt.wk.walk(dt, speed)) { rt.state = 'load'; rt.t = 0; rt.loadT = 0; } else a.act = 'walk'; return;
      case 'load': {
        const p = rt.jobKey as ProductId;
        rt.loadT += dt;
        const full = a.carry.length >= cap;
        if (!full && host.isGrab(p)) {
          if (rt.loadT >= Math.max(0.3, host.grabTime(p))) { rt.loadT = 0; a.carry.push(host.makeGrab(p, rt.w.id)); }
        } else if (!full && host.outCount(p) > 0) {
          if (rt.loadT >= 0.15) { rt.loadT = 0; const it = host.takeOut(p, rt.w.id); if (it) a.carry.push(it); }
        }
        const need = garsonPick(rt);
        if (full || (a.carry.length && (rt.t > 1.6 || (need !== p && rt.t > 0.6))) || rt.t > 5) {
          if (a.carry.length) { rt.state = 'toCounter'; rt.wk.goTo(side(book.get('counter.standAt'), 0.5, 0)); }
          else rt.state = 'idle';
        }
        return;
      }
      case 'toCounter': if (!rt.wk.walk(dt, speed)) { rt.state = 'unload'; rt.loadT = 0; rt.t = 0; } else a.act = 'carry'; return;
      case 'unload': {
        a.act = 'carry';
        rt.loadT += dt;
        if (rt.loadT >= 0.1) {
          rt.loadT = 0;
          let moved = false;
          for (let i = a.carry.length - 1; i >= 0; i--) {
            const it = a.carry[i];
            if (host.counterFree(it.type) && host.counterPut(it)) { a.carry.splice(i, 1); rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt); moved = true; break; }
          }
          if (!a.carry.length || (!moved && rt.t > 3)) { rt.state = 'idle'; rt.loadT = 0.3; if (a.carry.length) a.carry.length = 0; }
        }
        return;
      }
      case 'toPass': if (!rt.wk.walk(dt, speed)) { rt.state = 'pickJob'; rt.t = 0; } else a.act = 'walk'; return;
      case 'pickJob': {   // plates off the pass, 2-3 at once by level (survey g_tepsi)
        a.act = 'carry'; if (rt.t < 0.5) return;
        const js = host.garsonOpen?.(rt.w.id) || []; if (!js.length) { rt.state = 'idle'; return; }
        for (const j of js) a.carry.push({ type: j.p, tier: 1 });
        const at = { x: a.x, z: a.z }; js.sort((u, v) => Math.hypot(u.x - at.x, u.z - at.z) - Math.hypot(v.x - at.x, v.z - at.z));
        const j0 = js[0]; rt.job = { index: j0.id }; rt.state = 'toTable'; rt.wk.goTo({ x: j0.x, z: j0.z + 0.95 }); return;
      }
      case 'toTable': if (!rt.wk.walk(dt, speed)) { rt.state = 'serve'; rt.t = 0; } else a.act = 'carry'; return;
      case 'serve': {
        a.act = 'carry'; if (rt.t < 0.5) return;
        const id = rt.job?.index ?? -1; if (id >= 0 && host.garsonDone?.(rt.w.id, id)) { rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); }
        a.carry.pop(); rt.job = null;
        const js = host.garsonOpen?.(rt.w.id) || [];
        if (js.length && a.carry.length) { const at = { x: a.x, z: a.z }; js.sort((u, v) => Math.hypot(u.x - at.x, u.z - at.z) - Math.hypot(v.x - at.x, v.z - at.z)); rt.job = { index: js[0].id }; rt.state = 'toTable'; rt.wk.goTo({ x: js[0].x, z: js[0].z + 0.95 }); }
        else { a.carry.length = 0; rt.state = 'idle'; rt.loadT = 0.3; }
        return;
      }
      case 'toClean': if (!rt.wk.walk(dt, speed)) { rt.state = 'wipe'; rt.t = 0; } else a.act = 'walk'; return;
      case 'wipe': {
        a.act = 'sweep';
        if (rt.t >= 1.6 / (1 + (fx.clean || 0))) { if (rt.job) host.cleanTable(rt.job.index, rt.w.id); rt.job = null; rt.state = 'idle'; }
        return;
      }
      default: rt.state = 'idle';
    }
  }
  function cleanerWork(rt: WRt, S: GameState, dt: number) {
    const fx = traitFx(rt.w), a = rt.a;
    const speed = 2.4 * (1 + (fx.walk || 0)) * moraleFactor(moraleOf(rt.w));
    a.act = 'idle';
    if (rt.state === 'idle') {
      if (rt.wk.walk(dt, speed)) { a.act = 'walk'; return; }
      const d = host.dirtyTables().filter((t) => !claimed(t.index, rt));
      if (d.length) { rt.job = { index: d[0].index }; rt.state = 'toClean'; rt.wk.goTo(d[0]); return; }
      // 2026-10-24 user: "dükkanın içi kirli duruyor, temizlikçi paspas atsın": with tables clean, mop the kiosk floor
      if (zeminSave(S as unknown as { zones: Record<string, Record<string, unknown>> }).kir > 0.2) { rt.state = 'mop'; rt.t = 0; rt.loadT = 0; rt.jobKey = '0'; say(rt, rng.pick(['Paspas zamanı!', 'Basmayın, ıslak!', 'Pırıl pırıl olacak.']), 2.2); return; }
      const h = home(rt, S); if (!near2(a, h, 0.5)) rt.wk.goTo(h);
      return;
    }
    if (rt.state === 'mop') {
      // walk a small loop between the stations and the counter, mopping at each stop; every stop takes dirt off
      const spots = ['doner', 'cay', 'tost'].filter((k) => host.stationBuilt(k as ProductId)).map((k) => book.stationStand(k as ProductId) as Vec2).concat([book.get('counter.standAt') as Vec2]);
      const i = Number(rt.jobKey) || 0;
      if (rt.wk.walk(dt, speed * 0.8)) { a.act = 'walk'; return; }
      if (rt.loadT === 0) { rt.loadT = 0.01; const sp = spots[i % spots.length]; rt.wk.goTo(side(sp, 0.5 - (i % 2), 0.45)); return; }
      a.act = 'sweep'; rt.loadT += dt;
      if (rt.loadT >= 2.2 / (1 + (fx.clean || 0))) {
        const z = zeminSave(S as unknown as { zones: Record<string, Record<string, unknown>> });
        z.kir = Math.max(0, z.kir - 0.3); rt.loadT = 0; rt.jobKey = String(i + 1);
        if (z.kir <= 0.02 || i + 1 >= spots.length + 2) { z.kir = 0; rt.state = 'idle'; rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); say(rt, 'Pırıl pırıl!', 2); }
      }
      return;
    }
    if (rt.state === 'toClean') { if (!rt.wk.walk(dt, speed)) { rt.state = 'wipe'; rt.t = 0; } else a.act = 'walk'; return; }
    if (rt.state === 'wipe') {
      a.act = 'sweep';
      if (rt.t >= 1.4 / (1 + (fx.clean || 0))) {
        if (rt.job) { host.cleanTable(rt.job.index, rt.w.id); rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); }
        rt.job = null; rt.state = 'idle';
      }
      return;
    }
    rt.state = 'idle';
  }

  // ---- kitchen crew (survey 2026-11-09): real hired actors inside the mutfak room, no nav (the room is an open floor) ----
  const KM = IC_BY_ID.mutfak, KD = icDim(KM);
  const kw = (u: number, v: number): Vec2 => icWorld(KM, u, v);
  const ROW = -KD.D / 2 + 1.5;   // aisle in front of the back-row stations
  const KPOST: Record<ProductId, [number, number]> = { doner: [4.5, ROW], cay: [6.5, KD.D / 2 - 1.3], ayran: [6.5, KD.D / 2 - 1.3], simit: [2.7, ROW], tost: [-2.7, ROW], gazoz: [-8.1, ROW] };
  const kIdlePost = (rt: WRt): [number, number] => {
    const i = rows.filter((x) => x.w.role === rt.w.role).indexOf(rt);
    if (rt.w.role === 'bulasikci') return [-7.2 + i * 1.2, KD.D / 2 - 1.3];
    if (rt.w.role === 'kasiyer') return [7.8 - i * 1.2, ROW];
    if (rt.w.role === 'sef') return [i * 1.8, -0.3];
    return [-6.3 + i * 1.8, ROW];
  };
  /** straight moves along the aisle: first to the aisle, then along it, then to the target */
  function kGo(rt: WRt, u: number, v: number) {
    const cur = rt.a, here = { x: cur.x, z: cur.z }, to = kw(u, v), wp: Vec2[] = [];
    const aisle = (uu: number) => kw(uu, ROW);
    const dv = Math.abs(here.z - KM.z - ROW);   // the room faces +z: v = z - room z
    const fromU = here.x - KM.x;
    if (dv > 0.25) wp.push(aisle(fromU));
    wp.push(aisle(u)); wp.push(to);
    rt.wk.path = wp; rt.wk.goal = to;
  }
  function kitchenWork(rt: WRt, S: GameState, dt: number) {
    const a = rt.a, role = rt.w.role, speed = 2.1 * (1 + 0.04 * rankOf(rt.w.xp || 0));
    const walking = rt.wk.walk(dt, speed);
    if (walking) { a.act = a.carry.length ? 'carry' : 'walk'; return; }
    a.speed = 0;
    switch (rt.state) {
      case 'kArrive': { const [u, v] = kIdlePost(rt); kGo(rt, u, v); rt.state = 'kBack'; return; }
      case 'kBack': rt.state = 'kIdle'; rt.t = 0; a.rot = Math.PI; a.act = role === 'bulasikci' ? 'wipe' : 'idle'; return;
      case 'kIdle': {
        if (role === 'asci' || role === 'komi') {
          if (rt.t > 0.6 && host.kitchenClaim) { const p = host.kitchenClaim(rt.w.id); if (p) { rt.jobKey = p; const [u, v] = KPOST[p] || [0, ROW]; kGo(rt, u, v); rt.state = 'kCook'; rt.t = 0; rt.loadT = 0; return; } rt.t = 0.2; }
        } else if (role === 'sef' && rt.t > 8) { const u = (rng.next() - 0.5) * 12; kGo(rt, u, -0.3); rt.t = 0; }
        else if (role === 'kasiyer' && rt.t > 14) { a.rot = Math.PI; rt.t = 0; }
        a.act = role === 'bulasikci' ? 'wipe' : 'idle'; return;
      }
      case 'kCook': {   // wait-and-take: no burning, no quality; chef + rank shorten it
        a.act = 'cut'; rt.loadT += dt;
        const need = 4.5 / (1 + 0.12 * rankOf(rt.w.xp || 0) + 0.25 * S.workers.filter((x) => x.role === 'sef').length);
        if (rt.loadT >= need) { a.carry.push({ type: rt.jobKey as ProductId, tier: 1 } as CarryItem); const [u, v] = [7.0, ROW]; kGo(rt, u, v); rt.state = 'kPass'; rt.t = 0; }
        return;
      }
      case 'kPass': {
        a.carry.length = 0; host.kitchenDone?.(rt.w.id, true); rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt);
        const [u, v] = kIdlePost(rt); kGo(rt, u, v); rt.state = 'kBack'; return;
      }
      default: rt.state = 'kArrive';
    }
  }
  const posted = new Set<number>();   // Faz 2: workers currently at the ferry window
  function update(rt: WRt, S: GameState, dt: number, pl: Vec2) {
    const w = rt.w, fx = traitFx(w), a = rt.a;
    if (ROLES[w.role]?.mutfak) { rt.t += dt; kitchenWork(rt, S, dt); return; }
    rt.t += dt; rt.boostT -= dt; rt.moraleCd -= dt; rt.pauseT -= dt;
    a.mood = rt.state === 'sleep' ? 'asleep' : 'ok';
    if (rt.state !== 'sleep' && near2(pl, a, 1.6)) {
      rt.nearT += dt;
      if (rt.nearT > 1.5 && rt.moraleCd <= 0) { rt.moraleCd = 60; w.morale = Math.min(100, moraleOf(w) + 4); }
    } else rt.nearT = 0;
    if (['work', 'idle', 'toSrc', 'toCounter'].includes(rt.state)) { rt.workT += dt; if (rt.workT > 120) { rt.workT = 0; w.morale = Math.max(10, moraleOf(w) - 1); } }
    if (S.playT > rt.chatNext) {
      rt.chatNext = S.playT + rng.range(25, 45);
      if (fx.chat) say(rt, rng.pick(LINES.workers.chat), 2); else if (fx.phone) say(rt, rng.pick(LINES.workers.phone), 2);
    }
    // Faz 2 (user item 28): the worker posted at the ferry window walks there while it is open, then goes back
    const post = host.windowPost?.() ?? null;
    if (post && post.wid === w.id && rt.state !== 'arrive' && rt.state !== 'watch') {
      if (rt.state === 'sleep') wake(rt, S, false);
      if (!posted.has(w.id)) { posted.add(w.id); rt.a.carry.length = 0; rt.job = null; rt.wk.goTo(post.at); say(rt, 'Vapur geldi, pencereye!', 2); }
      if (rt.wk.walk(dt, 2.6)) { a.act = 'walk'; host.setPencereAt?.(false); }
      else { a.act = 'idle'; a.speed = 0; host.setPencereAt?.(true); }
      return;
    }
    if (posted.has(w.id) && (!post || post.wid !== w.id)) { posted.delete(w.id); host.setPencereAt?.(false); rt.state = rt.st ? 'work' : 'idle'; rt.wk.goTo(home(rt, S)); }
    switch (rt.state) {
      case 'arrive':
        if (!rt.wk.walk(dt, 2.4)) { rt.state = 'watch'; rt.t = 0; say(rt, LINES.workers.watch, 3); emit('workerWatch', { name: w.name }); } else a.act = 'walk';
        break;
      case 'watch':
        rt.wk.face(pl, dt); a.act = 'idle';
        if (rt.t >= 3) {
          rt.state = ROLES[w.role]?.on ? 'front' : rt.st ? 'work' : 'idle'; rt.t = 0; say(rt, LINES.workers.takeover, 2.5); if (ROLES[w.role]?.on) rt.wk.goTo(home(rt, S));
          rt.wk.goTo(home(rt, S)); emit('takeover', { name: w.name });
        }
        break;
      case 'work': stationWork(rt, S, dt); break;
      case 'front': {   // front roles: stand at the post, small idle life; their effect is in content/mutfak.ts (mutfakEtki) and kapkac.ts
        if (rt.wk.walk(dt, 2.2)) { a.act = 'walk'; break; }
        a.act = w.role === 'muzisyen' ? 'cheer' : w.role === 'barista' ? 'pour' : 'idle';
        if (rt.t > 9) { rt.t = 0; if (rng.chance(0.35)) say(rt, rng.pick(FRONT_LINES[w.role] || ['Hoş geldiniz!']), 2.2); }
        break;
      }
      case 'sleep':
        a.act = 'sleep'; a.speed = 0;
        if (near2(pl, a, 1.4)) wake(rt, S, true);
        else if (rt.t >= rt.sleepFor) wake(rt, S, false);
        break;
      case 'selfie':
        a.act = 'phone'; a.speed = 0;
        if (rt.t >= rt.selfieFor) {
          rt.state = 'work'; a.act = 'idle';
          const f = fx.followers || [3, 5];
          const n = rng.int(f[0], f[1]);
          host.addFollowers(n); host.stat('followers', n);
          host.toast(LINES.workers.followers + ' (' + n + ')', 'good'); emit('selfie', { n });
        }
        break;
      default:
        if (w.role === 'garson') garsonWork(rt, S, dt);
        else if (w.role === 'temizlik') cleanerWork(rt, S, dt);
    }
    if (rt.state !== 'sleep' && rt.state !== 'selfie' && !rt.wk.moving) a.speed = 0;
  }
  const sys: WorkersSystem = {
    id: 'workers', order: 40, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, pl = env.player();
      // roster sync: new entries walk in, removed ones disappear
      for (const rt of [...rows]) if (!S.workers.includes(rt.w)) {
        const same = S.workers.find((w) => w.id === rt.w.id);
        if (same) rt.w = same; else remove(rt);
      }
      for (const w of S.workers) if (!rows.some((r) => r.w.id === w.id)) spawn(w, S, first);
      first = false;
      for (const rt of rows) {
        rt.a.sayT -= dt; if (rt.a.sayT <= 0) { rt.a.say = ''; rt.a.sayT = 0; }
        update(rt, S, dt, pl);
        rt.a.info.carryN = rt.a.carry.length;
      }
      // 2026-10-25 user: waiters followed each other like a train and walked through one another: soft push-apart
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
        const p = rows[i].a, q = rows[j].a, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), R = 0.7;
        if (d >= R) continue;
        const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0, push = (R - d) * Math.min(1, dt * 6) * 0.5;
        p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
      }
    },
    rows: () => rows.map((r) => ({ id: r.w.id, name: r.w.name, role: r.w.role, state: r.state, x: r.a.x, z: r.a.z, rank: Number(r.w.rank || 0), morale: moraleOf(r.w) })),
    aura(x, z) {
      let best = 0;
      for (const r of rows) {
        const fx = traitFx(r.w); if (!fx.patienceAura) continue;
        if (Math.hypot(r.a.x - x, r.a.z - z) <= (fx.auraR || 6)) best = Math.max(best, fx.patienceAura);
      }
      return best;
    },
    recheck(id) { const r = rows.find((x) => x.w.id === id); if (r) { checkRank(r); say(r, LINES.workers.gift, 2.5); } },
    forceSleep(id) { const r = rows.find((x) => x.w.id === id); if (r) { r.state = 'sleep'; r.t = 0; r.sleepFor = 20; r.a.act = 'sleep'; } },
    say(id, t, s) { const r = rows.find((x) => x.w.id === id); if (r) say(r, t, s); },
  };
  return sys;
}
export type { CarryItem };
