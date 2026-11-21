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
import { ROLES, RANKS, rankOf, garsonTasima } from '../../../content/ranks';
import { ADISYON, GARSON_ACT, type GarsonTur } from '../../../content/restoran';
import { LINES } from '../../../content/lines';
import type { Actor, CarryItem } from './types';
import { Walker, near2, side } from './move';
import { traitFx, traitId, workerSpeed } from './traits';
import type { AgentEnv } from './env';
import { zeminSave } from '../zemin';
import { IC_BY_ID, icWorld, icDim, icIcinde, icKapi, mutfakRota, mutfakStand, mutfakKoridor, mutfakOda, mutfakIcine, MUTFAK_NOKTA, MUTFAK_YER } from '../../../content/ic-mekan';
import { isProduct } from '../../../content/yemek-menu';
import { BULASIK, MUTFAK_MIN_STAGE } from '../../../content/mutfak';
import { createRoller, type ValeCar } from './roller';
import { kasaDurus } from '../../../content/musteri';
import { kanatOf, masaCati, catiAyak, catiYukari, catiAsagi, catiIc, catiTaraf, katY, ACIK_MUTFAK } from '../../../content/kanat';
/** BUF-05: masa biletindeki yiyecek (FoodId) mutfakta kendi tabağıyla pişer ve garsonla taşınır (taşıyıcı ürün köprüsü yok). */
export type { DishId, FoodId } from '../../../content/yemek-menu';

interface WRt {
  w: WorkerSave; a: Actor; wk: Walker; st: ProductId | null;
  state: string; t: number; boostT: number; boostX: number; made: number; pauseT: number;
  job: { index: number } | null; loadT: number; /** BUF-09: seconds since the garson claimed its current task */ isT: number; nextSleep: number; selfieNext: number; songNext: number; chatNext: number; sleepFor: number; selfieFor: number;
  jobKey: string;
}

export interface WorkersSystem extends System {
  /** Live runtime rows for state views / tests. */
  rows(): { id: number; name: string; role: string; state: string; x: number; z: number; rank: number; /** BUF-05: kitchen station the cook/komi is working at or walking to */ ist?: string }[];
  /** Fraction the queue's patience drains slower near (x,z): Geveze / Güler yüzlü / Türkü; BUF-14: güvenlik (kalabalık), müzisyen, hostes. */
  aura(x: number, z: number): number;
  /** BUF-14: vale'nin park ettiği / sürdüğü arabalar (görünüm), müdür vekil modunda mı, kalabalık mı */
  valeCars(): readonly ValeCar[];
  vekil(): boolean;
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
// BUF-12: kasiyer kasa başında (L.kasa) durur; müşteri kasaya gelip öder (sim/customers.ts kasa sırası)
FRONT_LINES.kasiyer = ['Buyurun, kasa burada!', 'Nakit mi, kart mı?', 'Fişinizi unutmayın.', 'Hesap hemen tamam.'];
const angLerpTo = (a: number, b: number, k: number): number => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2; return a + d * Math.min(1, k); };
export function createWorkers(env: AgentEnv): WorkersSystem {
  const rows: WRt[] = [];
  let first = true;
  const { host, book, reg } = env;
  const rng = env.rng('workers');
  const roller = createRoller(env);   // BUF-14: güvenlik, müzisyen, hostes, vale, müdür

  const say = (rt: WRt, text: string, t = 2.2) => { rt.a.say = text; rt.a.sayT = t; };
  const emit = env.emit;

  function home(rt: WRt, S: GameState): Vec2 {
    if (rt.st) return book.stationStand(rt.st);
    if (rt.w.role === 'garson') {
      const post = host.garsonPost?.(rt.w.id);   // BUF-19: bölgesi kanat / salon olan garson orada bekler (çay bahçesi: çay ocağında çaycı)
      if (post) return { x: post.x, z: post.z };
      const i = rows.filter((x) => x.w.role === 'garson').indexOf(rt);
      return side(book.get('counter.standAt'), 1.3 + i * 0.7, 0.1);
    }
    if (rt.w.role === 'kasiyer') {   // BUF-12: kasa başı (L.kasa), birden çok kasiyer yan yana
      const i = rows.filter((x) => x.w.role === 'kasiyer').indexOf(rt), k = book.get('kasa'), kp = book.get('kasa.pile');
      return kasaDurus({ pos: k, pile: kp }, Math.max(0, i));
    }
    if (ROLES[rt.w.role]?.on) {   // front-of-house posts around the counter
      const c = book.get('counter.standAt'), i = rows.filter((x) => x.w.role === rt.w.role).indexOf(rt);
      const o: Record<string, [number, number]> = { guvenlik: [4.2, 3.2], muzisyen: [-5.5, 4.2], hostes: [2.6, 4.4], mudur: [1.2, 1.8], vale: [7.5, 6.5] };
      const [dx, dz] = o[rt.w.role] || [0, 3];
      return { x: c.x + dx + i * 1.1, z: c.z + dz };
    }
    return book.get('jobCorner');
  }
  /** Eski kayıtlardaki müşteri tipi görünümü (lookType) rol kıyafetini ezmesin: lookType/lookSeed/önlük atılır, isim ve başörtüsü kalır. */
  const rolGorunumu = (l?: Record<string, unknown>) => {
    if (!l || l.lookType == null) return l;
    const { lookType: _t, lookSeed: _s, apron: _a, ...rest } = l; void _t; void _s; void _a; return rest;
  };
  function spawn(w: WorkerSave, S: GameState, instant: boolean): WRt {
    const role = ROLES[w.role];
    const st = (role && role.station ? role.station : null) as ProductId | null;
    const km = !!role?.mutfak, start = km ? icWorld(IC_BY_ID.mutfak, 0, icDim(IC_BY_ID.mutfak).D / 2 + 0.8) : book.get('jobCorner');
    const seed = (w.id * 977) % 10007;
    const a = reg.add('worker', String(w.id), { kind: 'worker', role: w.role, look: rolGorunumu((w as { look?: Record<string, unknown> }).look), seed }, start,
      { role: w.role, trait: traitId(w), name: w.name, rank: rankOf(w.xp || 0), rarity: w.rarity });
    const rt: WRt = {
      w, a, wk: new Walker(a, env.nav), st, state: 'arrive', t: 0, boostT: 0, boostX: 1, made: 0, pauseT: 0,
      job: null, loadT: 0, isT: 0, nextSleep: 0, selfieNext: S.playT + 100, songNext: S.playT + 70, chatNext: S.playT + 25, sleepFor: 0, selfieFor: 0, jobKey: '',
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
    if (ROLES[rt.w.role]?.mutfak) host.kitchenDrop?.(rt.w.id);   // fired cook/komi: its station and plate are released (no stuck job)
    if (rt.w.role === 'garson') host.isBirak?.(rt.w.id);          // fired garson: table tasks back to the pool, plates back to the rack
    if (rt.w.role === 'kurye') host.paketBirak?.(rt.w.id);        // BUF-15: fired courier: the parcel is reopened, plates back on the pass
    reg.remove(rt.a);
  }
  function checkRank(rt: WRt) {
    const w = rt.w, r = rankOf(w.xp || 0);
    if (r > Number(w.rank || 0)) {
      w.rank = r;
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
  function claimed(index: number, except: WRt) { return rows.some((o) => o !== except && o.w.role === 'temizlik' && o.job && o.job.index === index); }   // cleaners only (garson wipes go through restoran isAl)

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
  /** çatı masasının garson tarafı (silmek için de masanın yanında durur, masanın içinde değil) */
  const sideOf = (table: number): Vec2 => { const tb = kanatOf(table); return tb ? (tb.ax === 'z' ? { x: tb.x + 0.95, z: tb.z } : { x: tb.x, z: tb.z + 0.95 }) : { x: 0, z: 0 }; };
  /** BUF-09: plates in hand -> the nearest target table, or (all leftovers) back to the pass / counter; nothing left -> idle */
  function garsonDevam(rt: WRt) {
    const a = rt.a, tp = host.tepsi?.(rt.w.id) || [];
    a.carry = tp.map((g) => ({ type: g.p, tier: 1 }));
    if (!tp.length) { rt.job = null; rt.state = 'idle'; rt.loadT = 0.3; return; }
    const hedef = tp.filter((g) => !g.geri);
    if (hedef.length) {
      hedef.sort((u, v) => Math.hypot(u.x - a.x, u.z - a.z) - Math.hypot(v.x - a.x, v.z - a.z) || u.id - v.id);
      rt.job = { index: hedef[0].table }; rt.state = 'toTable'; goVia(rt, { x: hedef[0].x, z: hedef[0].z }, hedef[0].table); return;
    }
    rt.job = null; rt.state = 'toGeri'; goVia(rt, { x: tp[0].gx, z: tp[0].gz });
  }
  const GARSON_IS = new Set(['toPass', 'pickJob', 'toTable', 'serve', 'toGeri', 'toMasa', 'masaAct', 'toClean', 'wipe']);
  function garsonWork(rt: WRt, S: GameState, dt: number) {
    const fx = traitFx(rt.w), a = rt.a, wid = rt.w.id;
    a.y = katY(S.stage || 1, a.x, a.z, (a.y || 0) > 0.5);   // BUF-20: merdiven / çatı terası yüksekliği
    const speed = 2.6 * (1 + (fx.walk || 0)) * (rt.boostT > 0 ? rt.boostX : 1);
    const cap = (ROLES.garson.carry || 4) + (fx.carry || 0);   // TEZGAH_TASIMA: istasyon -> tezgâh (büfe) taşıması; masa tepsisi garsonTasima
    a.act = rt.a.carry.length ? 'carry' : 'idle';
    // masaClaim zaman aşımı: iş garsonun aldığı andan sayılır; dolarsa her şeyi bırak, idle'a dön (kilitlenme yok)
    if (GARSON_IS.has(rt.state)) {
      rt.isT += dt;
      if (rt.isT > ADISYON.isZamanAsimiS) { host.isBirak?.(wid); a.carry.length = 0; a.info.tasi = ''; rt.job = null; rt.state = 'idle'; rt.loadT = 0.3; host.stat('garsonZamanAsimi'); return; }
    }
    switch (rt.state) {
      case 'idle': {
        if (rt.wk.walk(dt, speed)) { a.act = a.carry.length ? 'carry' : 'walk'; return; }
        rt.loadT -= dt; if (rt.loadT > 0) return;
        rt.loadT = 0.4;
        if ((host.tepsi?.(wid) || []).length) { rt.isT = 0; garsonDevam(rt); return; }   // elde masa tabağı var: işine devam
        if (a.carry.length) { rt.state = 'toCounter'; goVia(rt, side(book.get('counter.standAt'), 0.5, 0)); return; }
        const is = host.isAl?.(wid, { cap: garsonTasima(rankOf(rt.w.xp || 0), fx.carry || 0), at: { x: a.x, z: a.z } });
        if (is) {
          rt.isT = 0; rt.t = 0; rt.jobKey = is.tur; rt.job = { index: is.id };
          if (is.tur === 'tabak') { rt.state = 'toPass'; goVia(rt, host.passDurak?.(wid) ?? { x: is.x, z: is.z }); }
          else if (is.tur === 'sil') { rt.state = 'toClean'; goVia(rt, masaCati(is.table) ? sideOf(is.table) : { x: is.x, z: is.z }, is.table); }
          else { rt.state = 'toMasa'; a.info.tasi = is.tur === 'hesap' ? 'hesap' : is.tur === 'menu' ? 'menu' : 'not'; goVia(rt, { x: is.x, z: is.z }, is.table); }
          return;
        }
        const p = garsonPick(rt);
        if (p) { rt.job = null; rt.jobKey = p; rt.state = 'toSrc'; goVia(rt, side(book.stationStand(p), 0.55, 0.2)); return; }
        const h = home(rt, S); if (!near2(a, h, 0.4)) goVia(rt, h); else rt.wk.face(book.queue(0), dt);
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
            if (isProduct(it.type) && host.counterFree(it.type) && host.counterPut(it as CarryItem)) { a.carry.splice(i, 1); rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt); moved = true; break; }
          }
          if (!a.carry.length || (!moved && rt.t > 3)) { rt.state = 'idle'; rt.loadT = 0.3; if (a.carry.length) a.carry.length = 0; }
        }
        return;
      }
      // ── masa işleri: menü, sipariş (not alır), hesap (hesap kâğıdı) ──
      case 'toMasa': if (!rt.wk.walk(dt, speed)) { rt.state = 'masaAct'; rt.t = 0; } else a.act = 'walk'; return;
      case 'masaAct': {
        const tur = rt.jobKey as GarsonTur;
        a.act = GARSON_ACT[tur] || 'pour'; if (rt.t < (ADISYON.adim[tur] ?? 1.3)) return;
        const r = rt.job ? host.isTamam?.(wid, rt.job.index, { x: a.x, z: a.z }) : null;
        rt.job = null; a.info.tasi = '';
        if (r?.durum === 'tamam') {
          if (tur === 'menu') say(rt, rng.pick(['Menümüz, buyurun!', 'Günün yemeği döner, tavsiye ederim.', 'Hemen geliyorum.']), 2);
          else if (tur === 'siparis') say(rt, rng.pick(['Not aldım, hemen geliyor.', 'Mutfağa iletiyorum.', 'Afiyet olsun şimdiden!']), 2);
          else say(rt, rng.pick(['Hesabınız efendim.', 'Afiyet olsun!', 'Yine bekleriz.']), 2);
          rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt);
        }
        rt.state = 'idle'; rt.loadT = 0.3; return;
      }
      // ── sıcak tabak: pass'tan (ya da tezgâhtan) al, masalara yürü (2-3 tabak) ──
      case 'toPass': if (!rt.wk.walk(dt, speed)) { rt.state = 'pickJob'; rt.t = 0; } else a.act = 'walk'; return;
      case 'pickJob': {
        a.act = 'carry'; if (rt.t < 0.5) return;
        const ps = host.tabakAl?.(wid) || [];
        if (!ps.length) { a.carry.length = 0; rt.job = null; rt.state = 'idle'; rt.loadT = 0.3; return; }
        garsonDevam(rt); return;
      }
      case 'toTable': if (!rt.wk.walk(dt, speed)) { rt.state = 'serve'; rt.t = 0; } else a.act = 'carry'; return;
      case 'serve': {
        a.act = 'carry'; if (rt.t < ADISYON.adim.tabak) return;
        const table = rt.job?.index ?? -1;
        for (const g of (host.tepsi?.(wid) || []).filter((k) => !k.geri && k.table === table)) {
          const r = host.isTamam?.(wid, g.id, { x: a.x, z: a.z });
          if (r?.durum === 'tamam') { rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); }
        }
        rt.isT = 0; garsonDevam(rt); return;
      }
      case 'toGeri': if (!rt.wk.walk(dt, speed)) { host.tabakGeri?.(wid); rt.isT = 0; garsonDevam(rt); } else a.act = 'carry'; return;
      case 'toClean': if (!rt.wk.walk(dt, speed)) { rt.state = 'wipe'; rt.t = 0; } else a.act = 'walk'; return;
      case 'wipe': {
        a.act = 'sweep';
        if (rt.t >= ADISYON.adim.sil / (1 + (fx.clean || 0)) * (host.dishCeza?.() ?? 1)) {   // BUF-13: bulaşıkçı yoksa yığın masa hazırlığını yavaşlatır
          const r = rt.job ? host.isTamam?.(wid, rt.job.index, { x: a.x, z: a.z }) : null;
          if (r?.durum === 'tamam') { rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); }
          rt.job = null; rt.state = 'idle'; rt.loadT = 0.3;
        }
        return;
      }
      default: rt.state = 'idle';
    }
  }
  function cleanerWork(rt: WRt, S: GameState, dt: number) {
    const fx = traitFx(rt.w), a = rt.a;
    const speed = 2.4 * (1 + (fx.walk || 0));
    a.act = 'idle';
    a.y = katY(S.stage || 1, a.x, a.z, (a.y || 0) > 0.5);   // 2026-11-21: temizlikçi de çatı terasına çıkar (garsonla aynı merdiven rotası)
    if (rt.state === 'idle') {
      if (rt.wk.walk(dt, speed)) { a.act = 'walk'; return; }
      const d = host.dirtyTables().filter((t) => !claimed(t.index, rt));
      if (d.length) {
        // BUF-28: eskiden hep ilk (en düşük index) masa seçiliyordu: yüksek index'li kanat masaları yoğunlukta 200 sn+ kirli kalıyordu. Şimdi 45 sn'i geçen en eski masa, yoksa en yakın masa.
        const eski = d.filter((t) => (t.age || 0) > 45).sort((p, q) => (q.age || 0) - (p.age || 0))[0];
        const pick = eski || d.reduce((b, t) => (Math.hypot(t.x - a.x, t.z - a.z) < Math.hypot(b.x - a.x, b.z - a.z) ? t : b));
        rt.job = { index: pick.index }; rt.state = 'toClean'; goVia(rt, masaCati(pick.index) ? sideOf(pick.index) : pick, pick.index); return;   // çatı masası: merdivenden, masanın yanına
      }
      // 2026-10-24 user: "dükkanın içi kirli duruyor, temizlikçi paspas atsın": with tables clean, mop the kiosk floor
      if (zeminSave(S as unknown as { zones: Record<string, Record<string, unknown>> }).kir > 0.2) { rt.state = 'mop'; rt.t = 0; rt.loadT = 0; rt.jobKey = '0'; say(rt, rng.pick(['Paspas zamanı!', 'Basmayın, ıslak!', 'Pırıl pırıl olacak.']), 2.2); return; }
      // BUF-13: kiosk is clean: the kitchen floor (dirt from cooks and dishwashers, zemin.ts mutfakKir) is mopped next
      if (S.stage >= MUTFAK_MIN_STAGE && (zeminSave(S as unknown as { zones: Record<string, Record<string, unknown>> }).mutfakKir || 0) > 0.25) { rt.state = 'mopK'; rt.t = 0; rt.loadT = 0; rt.jobKey = '0'; say(rt, 'Mutfak kayganmış, paspas!', 2.2); return; }
      const h = home(rt, S); if (!near2(a, h, 0.5)) goVia(rt, h);   // çatıdaysa önce iner
      return;
    }
    if (rt.state === 'mopK') {
      // three stops along the back aisle (the walkable one): through the kitchen door, back out through it when done
      const spots: [number, number][] = [[-6, ROW], [0, ROW], [6, ROW]], i = Number(rt.jobKey) || 0;
      if (rt.wk.walk(dt, speed * 0.8)) { a.act = 'walk'; return; }
      if (rt.loadT === 0) { rt.loadT = 0.01; goVia(rt, kw(spots[i][0], spots[i][1])); return; }
      a.act = 'sweep'; rt.loadT += dt;
      if (rt.loadT >= 2.2 / (1 + (fx.clean || 0))) {
        const z = zeminSave(S as unknown as { zones: Record<string, Record<string, unknown>> });
        z.mutfakKir = Math.max(0, (z.mutfakKir || 0) - 0.3); rt.loadT = 0; rt.jobKey = String(i + 1);
        if (z.mutfakKir <= 0.02 || i + 1 >= spots.length) { z.mutfakKir = Math.max(0, z.mutfakKir); rt.state = 'idle'; rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); say(rt, 'Mutfak pırıl pırıl!', 2); goVia(rt, home(rt, S)); }
      }
      return;
    }
    if (rt.state === 'mop') {
      // walk a small loop between the stations and the counter, mopping at each stop; every stop takes dirt off
      const spots = ['doner', 'cay', 'tost'].filter((k) => host.stationBuilt(k as ProductId)).map((k) => book.stationStand(k as ProductId) as Vec2).concat([book.get('counter.standAt') as Vec2]);
      const i = Number(rt.jobKey) || 0;
      if (rt.wk.walk(dt, speed * 0.8)) { a.act = 'walk'; return; }
      if (rt.loadT === 0) { rt.loadT = 0.01; const sp = spots[i % spots.length]; goVia(rt, side(sp, 0.5 - (i % 2), 0.45)); return; }
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
      if (rt.t >= 1.4 / (1 + (fx.clean || 0)) * (host.dishCeza?.() ?? 1)) {   // BUF-13: aynı ceza
        if (rt.job) { host.cleanTable(rt.job.index, rt.w.id); rt.w.xp = (rt.w.xp || 0) + 2; checkRank(rt); }
        rt.job = null; rt.state = 'idle';
      }
      return;
    }
    rt.state = 'idle';
  }

  // ---- kitchen crew (survey 2026-11-09, BUF-05 mutfak hattı): real hired actors inside the mutfak room, routes along the aisles ----
  // Aşçı: boştaki aşçı en eski bilet kalemini alır (uzmanlık yok), o yiyeceğin istasyonuna yürür, bekle-al pişirir (yanma/kalite yok),
  // tabak istasyon tepsisine iner. Komi varsa tabağı komi pass rafına taşır (aşçı hemen yeni iş alır), yoksa aşçı kendisi taşır.
  // Şef pasoda durur, her tabak pass'a konunca seslenir; hız etkisi yalnız pişirme süresinde (host.kitchenSure -> content/mutfak.ts sefHizi).
  const KM = IC_BY_ID.mutfak, KD = icDim(KM);
  /** BUF-22: the kitchen room of the current stage (walls move as it grows; x, door and depth stay) */
  const KMs = () => mutfakOda(env.rules.state.stage || 1);
  const kw = (u: number, v: number): Vec2 => icWorld(KM, u, v);
  const ROW = mutfakKoridor().arka;   // aisle in front of the back-row stations
  const uvOf = (p: Vec2): [number, number] => [p.x - KM.x, p.z - KM.z];   // the room faces +z: u = x - room x, v = z - room z
  const KOMI_YAS = 6;   // a tray plate the komi leaves this long is taken by an idle cook
  /**
   * BUF-22: inside the stage room. 2026-11-21 (denetçi: komi, bulaşıkçı ve boştaki aşçılar bulaşık hattının önünde omuz omuza üst üste
   * duruyordu): fixed posts first (şef, devralınmış istasyonun aşçısı, ilk bulaşıkçı / barista), the rest slide along their aisle in
   * 0.9 m steps until no other kitchen worker's post is closer than 0.75 m.
   */
  const kIdlePost = (rt: WRt): [number, number] => {
    const st = env.rules.state.stage || 1, taken: [number, number][] = [], km = rows.filter((o) => ROLES[o.w.role]?.mutfak);
    const sabit = (o: WRt) => o.w.role === 'sef' || (o.w.role === 'asci' && !!host.kitchenDevir?.(o.w.id)) || ((o.w.role === 'bulasikci' || o.w.role === 'barista') && km.filter((x) => x.w.role === o.w.role).indexOf(o) === 0);
    for (const o of km) if (sabit(o)) { const q = mutfakIcine(kIdlePost0(o), st); if (o === rt) return q; taken.push(q); }
    for (const o of km) {
      if (sabit(o)) continue;
      const b0 = mutfakIcine(kIdlePost0(o), st); let q = b0;
      for (let k = 0; k < 10 && taken.some((t) => Math.hypot(t[0] - q[0], t[1] - q[1]) < 0.75); k++) q = mutfakIcine([b0[0] + (k % 2 ? 0.9 : -0.9) * (Math.floor(k / 2) + 1), b0[1]], st);
      if (o === rt) return q; taken.push(q);
    }
    return mutfakIcine(kIdlePost0(rt), st);
  };
  const kIdlePost0 = (rt: WRt): [number, number] => {
    const i = rows.filter((x) => x.w.role === rt.w.role).indexOf(rt);
    if (rt.w.role === 'bulasikci') { const [u, v] = mutfakStand('bulasik'); return [u - i * 1.2, v]; }   // BUF-22: bulaşık arka hatta
    if (rt.w.role === 'barista') { const [u, v] = mutfakStand('cay_bar'); return [u - i * 1.2, v]; }   // BUF-13: çay barı postu
    if (rt.w.role === 'kasiyer') return [2.0 - i * 1.2, ROW];
    if (rt.w.role === 'sef') { const d = MUTFAK_NOKTA.sefDurak; return i < d.length ? d[i] : [d[0][0] - 1.3 * i, d[0][1]]; }
    if (rt.w.role === 'komi') { const d = MUTFAK_NOKTA.komiDurak; return i < d.length ? d[i] : [d[d.length - 1][0] - 1.7 * (i - d.length + 1), d[0][1]]; }
    if (rt.w.role === 'asci') { const d = host.kitchenDevir?.(rt.w.id); if (d) return mutfakStand(d); }   // BUF-06: devralınan istasyonda durur
    return [-3.4 + i * 1.7, ROW];
  };
  /** walk along the kitchen aisles (content/ic-mekan.ts mutfakRota: never through the solid prep tables) */
  function kGo(rt: WRt, u: number, v: number) {
    const to = kw(u, v), wp = mutfakRota(uvOf(rt.a), [u, v]).map(([pu, pv]) => kw(pu, pv));
    rt.wk.path = wp; rt.wk.goal = to;
  }
  /** garson: walk to a target, through the kitchen door when either end is inside the kitchen room */
  function goVia(rt: WRt, target: Vec2, table = -1) {
    // BUF-20: çatı terası: merdivenin ayağına kadar yerden (mutfak kapısı dahil), basamaklar, çatı koridoru; çatıdaki garson önce iner
    const up = (rt.a.y || 0) > 0.5 ? catiTaraf(rt.a) : null, tc = table >= 0 ? masaCati(table) : null;
    if (up || tc) {
      if (up && tc === up) { rt.wk.path = catiIc(rt.a, target); rt.wk.goal = { x: target.x, z: target.z }; return; }
      const pre = up ? catiAsagi(up, rt.a) : [], from = up ? catiAyak(up) : { x: rt.a.x, z: rt.a.z }, g = tc ? catiAyak(tc) : target;
      rt.wk.path = [...pre, ...zeminYol(from, g), ...(tc ? catiYukari(tc, target) : [])]; rt.wk.goal = { x: target.x, z: target.z }; return;
    }
    const inK = icIcinde(KMs(), rt.a, 0), tIn = icIcinde(KMs(), target, 0), doorIn: [number, number] = [0, KD.D / 2 - 0.4], door = icKapi(KM, 0.7);
    if (!inK && !tIn) { rt.wk.goTo(target); return; }
    if (inK && tIn) { const t = uvOf(target); kGo(rt, t[0], t[1]); return; }
    if (inK) {
      const pre = mutfakRota(uvOf(rt.a), doorIn).map(([u, v]) => kw(u, v)), rest = env.nav.path(door, target);
      rt.wk.path = [...pre, door, ...(rest.length ? rest.slice(1) : []), { x: target.x, z: target.z }]; rt.wk.goal = { x: target.x, z: target.z }; return;
    }
    rt.wk.goTo(door);
    rt.wk.path.push(...mutfakRota(doorIn, uvOf(target)).map(([u, v]) => kw(u, v)));
    rt.wk.goal = { x: target.x, z: target.z };
  }
  /** yerde from -> to yolu (mutfak odasına girip çıkarken kapıdan, koridorlardan): goVia ile aynı kurallar, nokta listesi olarak */
  function zeminYol(from: Vec2, to: Vec2): Vec2[] {
    const nav = (a: Vec2, b: Vec2) => { const p = env.nav.path(a, b); return (p.length ? p : [b]).map((v) => ({ x: v.x, z: v.z })); };
    const inK = icIcinde(KMs(), from, 0), tIn = icIcinde(KMs(), to, 0), doorIn: [number, number] = [0, KD.D / 2 - 0.4], door = icKapi(KM, 0.7);
    if (!inK && !tIn) return nav(from, to);
    if (inK && tIn) return mutfakRota(uvOf(from), uvOf(to)).map(([u, v]) => kw(u, v));
    if (inK) return [...mutfakRota(uvOf(from), doorIn).map(([u, v]) => kw(u, v)), door, ...nav(door, to)];
    return [...nav(from, door), ...mutfakRota(doorIn, uvOf(to)).map(([u, v]) => kw(u, v))];
  }
  /** aşama 9+ açık ızgarada duran şef: şeflerin ilki */
  const acikSef = (rt: WRt, S: GameState) => (S.stage || 1) >= 9 && rows.find((x) => x.w.role === 'sef') === rt;
  const komiVar = () => rows.some((x) => x.w.role === 'komi');
  const kStand = (ist: string) => mutfakStand(ist);
  let sefSira = 0;
  const sefSay = (rt: WRt) => {   // şef pasoda: her tabak pass'a konunca seslenir (BUF-28: iki şef varsa sırayla, ikinci şef boş durmasın)
    const sefler = rows.filter((x) => x.w.role === 'sef'); if (!sefler.length) return;
    const s = sefler[sefSira++ % sefler.length];
    say(s, rng.pick(['Servis!', 'Sıcak tabak, servis!', 'Pass, servis lütfen!', 'Tabak hazır, alın!']), 1.8); void rt;
  };
  function kTake(rt: WRt, opt: { kendi?: boolean; yas?: number }): boolean {   // carry duty: reserve a tray plate, walk to its station
    const j = host.kitchenTasi?.(rt.w.id, opt); if (!j) return false;
    rt.jobKey = j.ist; const [u, v] = kStand(j.ist); kGo(rt, u, v); rt.state = 'kTasiAl'; rt.t = 0; return true;
  }
  function kToPass(rt: WRt) { const [u, v] = MUTFAK_NOKTA.passAsci; kGo(rt, u, v); rt.state = 'kPass'; rt.t = 0; }
  function kitchenWork(rt: WRt, S: GameState, dt: number) {
    const a = rt.a, role = rt.w.role, speed = 2.1 * (1 + 0.04 * rankOf(rt.w.xp || 0));
    const walking = rt.wk.walk(dt, speed);
    if (walking) { a.act = a.carry.length ? 'carry' : 'walk'; return; }
    a.speed = 0;
    switch (rt.state) {
      case 'kArrive': { const [u, v] = kIdlePost(rt); kGo(rt, u, v); rt.state = 'kBack'; return; }
      case 'kBack': rt.state = 'kIdle'; rt.t = 0; rt.loadT = 0; a.rot = Math.PI; a.act = 'idle'; return;
      case 'kIdle': {
        a.act = 'idle';
        if (role === 'bulasikci') {   // BUF-13: dirty plates at the dishwashing station are washed one by one (no player work); idle when the pile is empty
          if ((host.dishCount?.() || 0) > 0) { rt.state = 'kWash'; rt.loadT = 0; rt.pauseT = 1.5; }
          return;
        }
        if (role === 'asci' || role === 'komi' || role === 'barista') {
          if (rt.t < 0.3) return;
          rt.t = 0;
          if (role === 'komi') { if (kTake(rt, {})) return; }
          else {
            // the barista only carries her own drinks (BUF-13); a cook takes any tray plate when there is no komi
            if ((!komiVar() || host.kitchenBekleyen?.(KOMI_YAS)) && kTake(rt, { yas: komiVar() ? KOMI_YAS : 0, kendi: role === 'barista' })) return;
            const p = host.kitchenClaim?.(rt.w.id, { from: { x: a.x, z: a.z } });
            if (p) {
              const ist = host.kitchenIst?.(rt.w.id) || 'ocak';
              rt.jobKey = ist; const [u, v] = kStand(ist); kGo(rt, u, v); rt.state = 'kGoCook'; rt.loadT = 0; return;
            }
          }
          rt.loadT += 0.3;   // nothing to do: after a while walk back to the post
          if (rt.loadT > 3) { const [u, v] = kIdlePost(rt), h = kw(u, v); if (!near2(a, h, 0.4)) { kGo(rt, u, v); rt.state = 'kBack'; } rt.loadT = 0; }
          return;
        }
        if (role === 'sef' && acikSef(rt, S)) {   // BUF-19: aşama 9 açık ızgara mutfağı: ilk şef doğu terasındaki ızgarada (gerçek aktör, mutfak kapısından çıkar)
          rt.state = 'kAcik'; goVia(rt, { x: ACIK_MUTFAK.x, z: ACIK_MUTFAK.z }); return;
        }
        if (role === 'sef') {   // şef pasoda durur (gezinme yok), mutfağa döner
          const [u, v] = kIdlePost(rt), h = kw(u, v);
          if (!near2(a, h, 0.4)) { kGo(rt, u, v); rt.state = 'kBack'; return; }
          a.rot = Math.PI; a.act = 'idle'; return;
        }
        if (role === 'kasiyer' && rt.t > 14) { a.rot = Math.PI; rt.t = 0; }
        return;
      }
      case 'kAcik': {
        if (!acikSef(rt, S)) { const [u, v] = kIdlePost(rt); goVia(rt, kw(u, v)); rt.state = 'kBack'; return; }
        if (!near2(a, ACIK_MUTFAK, 0.4)) { goVia(rt, { x: ACIK_MUTFAK.x, z: ACIK_MUTFAK.z }); return; }
        a.rot = ACIK_MUTFAK.rot; a.act = 'cut';
        if (rt.t > 11) { rt.t = 0; if (rng.chance(0.4)) say(rt, rng.pick(['Izgara harlı!', 'Közde levrek, iki dakika!', 'Şef önerisi: kuzu şiş.', 'Ateş tamam, servis!']), 2.2); }
        return;
      }
      case 'kWash': {
        const n = host.dishCount?.() || 0;
        if (n <= 0) { rt.state = 'kIdle'; rt.t = 0; rt.loadT = 0; a.act = 'idle'; return; }
        a.act = 'wipe'; rt.loadT += dt;
        // a sparse clink while washing (sound layer rate-limits too): about every 4.5 s
        rt.pauseT -= dt; if (rt.pauseT <= 0) { rt.pauseT = 4.5; const at = kw(...mutfakStand('bulasik')); emit('bulasikSes', { x: at.x, z: at.z }); }
        if (rt.loadT >= BULASIK.washS / Math.max(0.2, speedOf(rt, S))) {
          rt.loadT = 0;
          if (host.dishWash?.()) { rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt); }
        }
        return;
      }
      case 'kGoCook': {
        if (!host.kitchenIst?.(rt.w.id)) { rt.state = 'kIdle'; rt.t = 0; return; }   // the job went away
        rt.state = 'kCook'; rt.t = 0; rt.loadT = 0; a.rot = MUTFAK_YER[rt.jobKey]?.sira === 'on' ? 0 : Math.PI; return;
      }
      case 'kCook': {   // wait-and-take: no burning, no quality; rank + chef shorten it (one formula, host.kitchenSure)
        if (!host.kitchenIst?.(rt.w.id)) { rt.state = 'kIdle'; rt.t = 0; return; }
        a.act = rt.jobKey === 'cay_bar' ? 'pour' : 'cut'; rt.loadT += dt;
        if (rt.loadT < (host.kitchenSure?.(rt.w.id) || 4.5)) return;
        host.kitchenReady?.(rt.w.id); rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt);
        if (komiVar()) { rt.state = 'kIdle'; rt.t = 0.3; rt.loadT = 0; return; }   // the komi carries it, the cook takes the next job
        if (host.kitchenTasi?.(rt.w.id, { kendi: true })) { const it = host.kitchenTasiAl?.(rt.w.id); if (it) { a.carry.push(it); kToPass(rt); return; } }
        rt.state = 'kIdle'; rt.t = 0; return;
      }
      case 'kTasiAl': {   // at the station: take the tray plate in hand (real carry), walk it to the pass
        const it = host.kitchenTasiAl?.(rt.w.id);
        if (it) { a.carry.push(it); kToPass(rt); } else { rt.state = 'kIdle'; rt.t = 0; }
        return;
      }
      case 'kPass': {
        a.act = 'carry';
        if (host.kitchenPass?.(rt.w.id)) {
          a.carry.length = 0; rt.w.xp = (rt.w.xp || 0) + 1; checkRank(rt); sefSay(rt);
          rt.state = 'kIdle'; rt.t = 0.3; rt.loadT = 0; return;
        }
        if (rt.t > 30) { host.kitchenDrop?.(rt.w.id); a.carry.length = 0; rt.state = 'kIdle'; rt.t = 0; }   // pass full for long: give up (no stuck cook)
        return;
      }
      default: rt.state = 'kArrive';
    }
  }
  // ---- BUF-15 kurye (paket servis): pass'tan paketi al, bisikletle adrese git, teslim et, dön; gelir dönüşte kasaya yazılır (sim/kurye.ts) ----
  // Durumlar: idle (evde bekler) -> qPass (pass'a yürür) -> qAl (tabakları alır) -> qYol (bisikletle adrese) -> qTeslim -> qDon (bisikletle döner, gelir yatar)
  const BISIKLET = 4.8, YAYA = 2.6;
  function kuryeWork(rt: WRt, S: GameState, dt: number) {
    const a = rt.a, wid = rt.w.id, fx = traitFx(rt.w);
    const hiz = (b: boolean) => (b ? BISIKLET : YAYA) * (1 + (fx.walk || 0)) * (rt.boostT > 0 ? rt.boostX : 1);
    const iceri = () => icIcinde(KMs(), a, 0);
    const sur = (b: boolean) => { a.fx = b && !iceri() ? 'bike' : ''; };
    switch (rt.state) {
      case 'idle': {
        a.fx = '';
        if (rt.wk.walk(dt, hiz(false))) { a.act = 'walk'; return; }
        a.act = 'idle';
        rt.loadT -= dt; if (rt.loadT > 0) return;
        rt.loadT = 0.6;
        if (host.paketHazir?.()) { rt.state = 'qPass'; rt.t = 0; goVia(rt, kw(MUTFAK_NOKTA.passGarson[0], MUTFAK_NOKTA.passGarson[1])); say(rt, 'Paket hazır mı?', 2); return; }
        const h = home(rt, S); if (!near2(a, h, 0.4)) goVia(rt, h); else rt.wk.face(book.queue(0), dt);
        return;
      }
      case 'qPass': {
        if (rt.wk.walk(dt, hiz(false))) { a.act = 'walk'; if (rt.t > 45) { rt.state = 'idle'; rt.loadT = 0.6; } return; }
        rt.state = 'qAl'; rt.t = 0; return;
      }
      case 'qAl': {
        a.act = 'carry'; if (rt.t < 0.8) return;
        const ps = host.paketAl?.(wid), ad = ps ? host.paketAdres?.(wid) : null;
        if (!ps || !ad) { host.paketBirak?.(wid); a.carry.length = 0; rt.state = 'idle'; rt.loadT = 0.6; return; }   // biri paketi kaptı: iş yok
        a.carry = ps.map((p) => ({ type: p.type, tier: p.tier || 1 }));
        rt.jobKey = ad.ad; rt.state = 'qYol'; rt.t = 0; goVia(rt, ad); say(rt, 'Paket bende, gidiyorum!', 2.2); return;
      }
      case 'qYol': {
        sur(true); a.act = 'walk';
        if (rt.wk.walk(dt, hiz(true))) { if (rt.t > 90) { rt.state = 'qDon'; rt.t = 0; goVia(rt, home(rt, S)); } return; }
        rt.state = 'qTeslim'; rt.t = 0; a.fx = ''; say(rt, rng.pick(['Siparişiniz, buyurun!', 'Afiyet olsun!', 'Paket servis geldi!']), 2.4); return;
      }
      case 'qTeslim': {
        a.act = 'serve'; a.fx = ''; a.speed = 0;
        if (rt.t < 1.8) return;
        a.carry.length = 0; a.info.tasi = '';
        rt.state = 'qDon'; rt.t = 0; goVia(rt, home(rt, S)); return;
      }
      case 'qDon': {
        sur(true); a.act = 'walk';
        if (rt.wk.walk(dt, hiz(true))) { if (rt.t > 90) { rt.wk.stop(); } else return; }
        a.fx = ''; a.act = 'idle';
        const v = host.paketTeslim?.(wid) ?? 0;   // gelir yalnız dönüşte kasaya yazılır
        if (v > 0) { rt.w.xp = (rt.w.xp || 0) + 3; checkRank(rt); say(rt, 'Teslim tamam, kasaya yazıldı!', 2.4); }
        rt.state = 'idle'; rt.loadT = 0.6; return;
      }
      default: rt.state = 'idle';
    }
  }
  const posted = new Set<number>();   // Faz 2: workers currently at the ferry window
  function update(rt: WRt, S: GameState, dt: number, pl: Vec2) {
    const w = rt.w, fx = traitFx(w), a = rt.a;
    if (ROLES[w.role]?.mutfak) { rt.t += dt; kitchenWork(rt, S, dt); return; }
    rt.t += dt; rt.boostT -= dt; rt.pauseT -= dt;
    a.mood = rt.state === 'sleep' ? 'asleep' : 'ok';
    if (S.playT > rt.chatNext) {
      rt.chatNext = S.playT + rng.range(25, 45);
      if (fx.chat) say(rt, rng.pick(LINES.workers.chat), 2); else if (fx.phone) say(rt, rng.pick(LINES.workers.phone), 2);
    }
    // Faz 2 (user item 28): the worker posted at the ferry window walks there while it is open, then goes back
    const post = host.windowPost?.() ?? null;
    if (post && post.wid === w.id && rt.state !== 'arrive' && rt.state !== 'watch') {
      if (rt.state === 'sleep') wake(rt, S, false);
      if (!posted.has(w.id)) { posted.add(w.id); host.isBirak?.(w.id); rt.a.carry.length = 0; rt.job = null; rt.a.info.tasi = ''; rt.wk.goTo(post.at); say(rt, 'Vapur geldi, pencereye!', 2); }
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
      case 'front': {   // front roles (BUF-14): her rol gerçek iş yapar, ayrıntı agents/roller.ts
        if (w.role === 'kasiyer') {   // BUF-12: kasa başında müşteriye dönük durur, kasada işlem varken para sayar; rütbe kasa işleminden gelen xp ile yükselir
          if (rt.wk.walk(dt, 2.2)) { a.act = 'walk'; break; }
          { const h = home(rt, S); if (!near2(a, h, 0.5)) { rt.wk.goTo(h); break; } }   // yerleşim değişince (aşama) yeni kasa başına yürür
          a.rot = angLerpTo(a.rot, 0, dt * 6); a.speed = 0; a.act = host.kasaMesgul?.() ? 'count' : 'idle'; checkRank(rt);
          if (rt.t > 9) { rt.t = 0; if (rng.chance(0.3)) say(rt, rng.pick(FRONT_LINES.kasiyer), 2.2); }
          break;
        }
        roller.front(rt, S, dt, home(rt, S));
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
        else if (w.role === 'kurye') kuryeWork(rt, S, dt);
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
      roller.step(S, dt, rows);
      host.setMutfakBusy?.(rows.reduce((n, r) => n + (r.state === 'kCook' || r.state === 'kWash' ? 1 : 0), 0));   // BUF-13: kitchen floor dirt
      host.setMutfakMop?.(rows.some((r) => r.state === 'mopK'));
      // 2026-10-25 user: waiters followed each other like a train and walked through one another: soft push-apart
      for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
        const p = rows[i].a, q = rows[j].a, dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz), R = 0.7;
        if (d >= R || Math.abs((p.y || 0) - (q.y || 0)) > 1) continue;   // BUF-20: çatıdaki ile salondaki birbirini itmez
        // BUF-05: the kitchen aisles are one body wide: two people meeting head-on there squeeze past (no push, no aisle deadlock)
        if ((rows[i].wk.moving || rows[j].wk.moving) && icIcinde(KMs(), p, 0) && icIcinde(KMs(), q, 0)) continue;
        const nx = d > 0.001 ? dx / d : 1, nz = d > 0.001 ? dz / d : 0, push = (R - d) * Math.min(1, dt * 6) * 0.5;
        p.x -= nx * push; p.z -= nz * push; q.x += nx * push; q.z += nz * push;
      }
    },
    rows: () => rows.map((r) => ({ id: r.w.id, name: r.w.name, role: r.w.role, state: r.state, x: r.a.x, z: r.a.z, rank: Number(r.w.rank || 0), ist: r.state === 'kGoCook' || r.state === 'kCook' || r.state === 'kTasiAl' ? r.jobKey : undefined })),
    aura(x, z) {
      let best = 0;
      for (const r of rows) {
        const fx = traitFx(r.w); if (!fx.patienceAura) continue;
        if (Math.hypot(r.a.x - x, r.a.z - z) <= (fx.auraR || 6)) best = Math.max(best, fx.patienceAura);
      }
      return Math.max(best, roller.aura(x, z));
    },
    valeCars: () => roller.valeCars(),
    vekil: () => roller.vekil(),
    recheck(id) { const r = rows.find((x) => x.w.id === id); if (r) { checkRank(r); say(r, LINES.workers.gift, 2.5); } },
    forceSleep(id) { const r = rows.find((x) => x.w.id === id); if (r) { r.state = 'sleep'; r.t = 0; r.sleepFor = 20; r.a.act = 'sleep'; } },
    say(id, t, s) { const r = rows.find((x) => x.w.id === id); if (r) say(r, t, s); },
  };
  return sys;
}
export type { CarryItem };
