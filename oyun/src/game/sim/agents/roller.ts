/**
 * Salon rolleri (BUF-14): güvenlik, müzisyen, hostes, vale ve müdür gerçek iş yapar. Hepsi gerçek yürüyen çalışan (workers.ts satırı),
 * prop yok; burada yalnız rol davranışı ve kural etkisi var. workers.ts 'front' durumu rt'yi buraya verir.
 *
 * - Güvenlik: kapı/kuyruk yanında durur, ara sıra kuyruk başına gidip düzenler. Kalabalık (maç günü, kuyruk >= 5, grup >= 4) iken
 *   yakınındaki müşterinin sabrı yavaş düşer (aura). Kalabalık yokken etkisi yok.
 * - Müzisyen: çalar (canlı müzik olayı, enstrüman hareketi), 6.5 m içinde yemek yiyen masa müşterisi daha uzun yer (yemek süresi +%25),
 *   sabır az düşer. Ses katmanı yalnız 'canliMuzik' olayını dinler (mevcut müzik sistemine dokunulmaz).
 * - Hostes: kapıda karşılar; kalabalık günde (maç günü / kuyruk >= 4) masaya yürüyen müşteriyi masasına kadar götürür (sabrı biraz yenilenir).
 * - Vale: aşama 8+, her üç müşteriden biri arabalıdır (kimlikten türetilir). Vale yolda müşteriyi karşılar, anahtarı alır, arabaya biner,
 *   park alanına sürer ve yürüyerek postuna döner. Araba hafif bir kutu (görünüm rt.valeCars).
 * - Müdür: oyuncu büfe bölgesinden uzaktayken (iskele dışı: Belgrad, karşı yaka) sahipsiz istasyonları düşük hızla işletir, kasayı toplar.
 *   Yalnız sim zamanında çalışır: oyun kapalıyken gelir YOK (offline kararı).
 * Deterministik: rng 'roller'.
 */
import { masaCati } from '../../../content/kanat';
import type { Vec2 } from '../../../engine/api';
import type { GameState, ProductId } from '../schema';
import { RANKS, ROLES, rankOf } from '../../../content/ranks';
import type { Actor } from './types';
import type { Walker } from './move';
import { near2, side } from './move';
import type { AgentEnv } from './env';

/** workers.ts WRt'nin bu modülün okuduğu kısmı */
export interface RolRt { w: { id: number; role: string; xp?: number; name: string }; a: Actor; wk: Walker; state: string; t: number }
export interface ValeCar { id: number; x: number; z: number; rot: number; /** vale içinde sürüyor */ surus: boolean; ttl: number }

const AWAY_M = 60, BACK_M = 48;                  // müdür: oyuncu iskele bölgesinden bu kadar uzaksa vekil olur (geri dönünce BACK_M)
const MUSIK_R = 6.5, MUSIK_YEME = 0.2;           // müzisyen: yemek süresi +%25 (c.t her sn'de %20 geri kalır)
const VEKIL_HIZ = 0.4, VEKIL_KASA_S = 2.5;       // müdür: istasyon hızı (1 = tam), kasadan bir yığın alma aralığı
const VEKIL_ISTASYON: ProductId[] = ['doner', 'cay', 'tost'];

interface Sub { ph: string; t: number; next: number; cid: number; to: Vec2 | null; car: ValeCar | null; away: boolean; kasaT: number; ist: string; say: number }

export function createRoller(env: AgentEnv) {
  const rng = env.rng('roller');
  const host = env.host, book = env.book;
  const subs = new Map<number, Sub>();
  let rows: RolRt[] = [];
  const cars: ValeCar[] = [];
  let carSeq = 1;
  const handled = new Set<number>();                 // vale'nin anahtarını aldığı müşteriler
  const sub = (rt: RolRt): Sub => {
    let s = subs.get(rt.w.id);
    if (!s) { s = { ph: 'post', t: 0, next: 4 + rng.range(0, 5), cid: -1, to: null, car: null, away: false, kasaT: 0, ist: '', say: 0 }; subs.set(rt.w.id, s); }
    return s;
  };
  const R = () => env.rules.rt;
  const rankX = (rt: RolRt) => RANKS[rankOf(rt.w.xp || 0)].x;
  const say = (rt: RolRt, t: string, s = 2.2) => { rt.a.say = t; rt.a.sayT = s; };
  const counterAt = () => book.get('counter.standAt');
  const withRole = (role: string) => rows.filter((r) => r.w.role === role);

  /** kalabalık: maç günü, uzun kuyruk ya da büyük grup */
  function kalabalik(): boolean {
    const rt = R();
    if ((rt as unknown as { macGunu?: unknown }).macGunu) return true;
    if (rt.queue.length >= 5) return true;
    return rt.customers.some((c) => c.n >= 4 && c.state !== 'leave');
  }
  const hostesGunu = () => !!(R() as unknown as { macGunu?: unknown }).macGunu || R().queue.length >= 4;

  /** sabır yavaşlatma oranı 0..1 (customers.ts patienceRate: k *= 1 - aura) */
  function aura(x: number, z: number): number {
    let best = 0;
    const kal = rows.length ? kalabalik() : false;
    for (const r of rows) {
      const d = Math.hypot(r.a.x - x, r.a.z - z), k = rankX(r);
      if (r.w.role === 'guvenlik' && kal && d <= 14) best = Math.max(best, Math.min(0.35, 0.18 + 0.05 * (k - 1) + ((R() as unknown as { macGunu?: unknown }).macGunu ? 0.06 : 0)));
      else if (r.w.role === 'muzisyen' && sub(r).ph === 'cal' && d <= MUSIK_R) best = Math.max(best, Math.min(0.2, 0.1 + 0.04 * (k - 1)));
      else if (r.w.role === 'hostes' && hostesGunu() && d <= 7) best = Math.max(best, Math.min(0.15, 0.08 + 0.03 * (k - 1)));
    }
    return best;
  }

  function walk(rt: RolRt, dt: number, speed = 2.2): boolean {
    if (rt.wk.walk(dt, speed)) { rt.a.act = 'walk'; return true; }
    return false;
  }

  // ── güvenlik ──
  function guvenlik(rt: RolRt, s: Sub, dt: number, home: Vec2) {
    const a = rt.a, rt0 = R();
    if (s.ph === 'post') {
      a.act = 'idle'; a.fx = '';
      if (!near2(a, home, 0.4)) { rt.wk.goTo(home); s.ph = 'don'; return; }
      rt.wk.face(book.queue(0), dt);
      s.t += dt;
      if (s.t >= s.next) { s.t = 0; s.next = (kalabalik() ? 5 : 11) + rng.range(0, 4); s.ph = 'ronda'; const q = book.queue(Math.min(rt0.queue.length, 2)); s.to = side(q, 1.3, 0.2); rt.wk.goTo(s.to); }
      return;
    }
    if (s.ph === 'ronda') {
      if (walk(rt, dt)) return;
      s.ph = 'yonlendir'; s.t = 0; return;
    }
    if (s.ph === 'yonlendir') {
      a.act = 'wave'; rt.wk.face(book.queue(0), dt);
      if (s.t === 0) { say(rt, kalabalik() ? 'Sıraya lütfen, itişmeyelim!' : 'Gözüm üzerinizde.', 2.2); host.stat('guvenlikRonda'); }
      s.t += dt;
      if (s.t >= 1.8) { s.t = 0; s.ph = 'don'; rt.wk.goTo(home); }
      return;
    }
    if (walk(rt, dt)) return;
    s.ph = 'post'; s.t = 0;
  }

  // ── müzisyen ──
  function muzisyen(rt: RolRt, s: Sub, dt: number, home: Vec2) {
    const a = rt.a;
    if (!near2(a, home, 0.5) && s.ph !== 'cal') { rt.wk.goTo(home); if (walk(rt, dt)) return; }
    s.t += dt;
    if (s.ph === 'cal') {
      a.act = 'dance'; a.fx = 'saz'; a.speed = 0;
      s.say -= dt;
      if (s.say <= 0) { s.say = 12; env.emit('canliMuzik', { x: a.x, z: a.z }); if (rng.chance(0.4)) say(rt, rng.pick(['Bir türkü de sizin için!', 'Boğaz’da akşam olur...', 'Alkışlar!']), 2.4); }
      if (s.t >= 26) { s.t = 0; s.ph = 'ara'; }
    } else {
      a.act = 'idle'; a.fx = '';
      if (s.t >= 7) { s.t = 0; s.ph = 'cal'; s.say = 0; }
    }
  }

  // ── hostes ──
  function hostes(rt: RolRt, s: Sub, dt: number, home: Vec2) {
    const a = rt.a, rt0 = R();
    const cust = () => rt0.customers.find((c) => c.id === s.cid && c.state !== 'leave') || null;
    if (s.ph === 'post') {
      a.act = 'idle';
      if (!near2(a, home, 0.4)) { rt.wk.goTo(home); s.ph = 'don'; return; }
      rt.wk.face(book.queue(0), dt);
      // kapıdan geçen müşteriyi karşıla (kalabalık günde masasına götür)
      const kalab = hostesGunu();
      const hedef = rt0.customers.find((c) => c.state !== 'leave' && Math.hypot(c.x - a.x, c.z - a.z) < 9 && (kalab && c.kind === 'masa' && c.state === 'toSeat' && !!c.seat && !masaCati(c.seat.table)) && !handled.has(c.id));   // çatı masasına merdivenden kendisi çıkar
      if (hedef) { s.cid = hedef.id; handled.add(hedef.id); s.ph = 'goster'; const tb = rt0.layout.tables[hedef.seat!.table]; s.to = tb ? { x: tb.x + 0.9, z: tb.z + 0.9 } : counterAt(); rt.wk.goTo(s.to); say(rt, 'Buyurun, masanız hazır!', 2.4); return; }
      s.t += dt;
      if (s.t > 9) { s.t = 0; const g = rt0.customers.find((c) => c.state !== 'leave' && Math.hypot(c.x - a.x, c.z - a.z) < 5); if (g) { a.act = 'wave'; say(rt, rng.pick(['Hoş geldiniz!', 'Kaç kişisiniz?']), 2.2); host.stat('hostesKarsilama'); } }
      return;
    }
    if (s.ph === 'goster') {
      if (walk(rt, dt, 2.4)) { const c = cust(); if (!c) { s.ph = 'don'; rt.wk.goTo(home); } return; }
      const c = cust();
      if (c) {   // masasına götürülen müşteri rahat eder: sipariş bekleme sabrı +8 sn (restoran bekleT), sıra sabrı biraz dolar
        const f = c as unknown as { bekleT?: number }; f.bekleT = Math.min(f.bekleT ?? 0, 0) - 8;
        c.patience = Math.min(c.patMax, c.patience + 0.1 * c.patMax); host.stat('hostesMasaGosterdi');
      }
      a.act = 'wave'; s.ph = 'don'; s.t = 0; rt.wk.goTo(home); return;
    }
    if (walk(rt, dt)) return;
    s.ph = 'post'; s.t = 0;
  }

  // ── vale ──
  const hash = (id: number) => (id * 2654435761 >>> 0) % 3;
  const lot = (i: number): Vec2 => { const c = counterAt(); return { x: c.x + 10 + 2.3 * (i % 4), z: c.z + 9.2 }; };
  function vale(rt: RolRt, s: Sub, dt: number, home: Vec2, S: GameState) {
    const a = rt.a, rt0 = R();
    const aday = () => rt0.customers.find((c) => c.state === 'walk' && !handled.has(c.id) && hash(c.id) === 0 && Math.hypot(c.x - home.x, c.z - home.z) < 34 && Math.hypot(c.x - counterAt().x, c.z - counterAt().z) > 7);
    const arabaKaldir = () => { if (s.car) { s.car.surus = false; s.car = null; } a.fx = ''; };
    if (s.ph === 'post') {
      a.act = 'idle'; a.fx = '';
      if (!near2(a, home, 0.4)) { rt.wk.goTo(home); s.ph = 'don'; return; }
      rt.wk.face(book.queue(0), dt);
      if (S.stage < 8) return;
      const c = aday();
      if (c && cars.length < 4) { s.cid = c.id; handled.add(c.id); s.ph = 'git'; s.t = 0; s.say = 0; rt.wk.goTo({ x: c.x, z: c.z }); return; }
      return;
    }
    if (s.ph === 'git') {
      s.t += dt; s.say -= dt;
      const c = rt0.customers.find((k) => k.id === s.cid && k.state !== 'leave');
      if (!c || s.t > 16) { s.ph = 'don'; rt.wk.goTo(home); return; }
      if (s.say <= 0) { s.say = 0.5; rt.wk.goTo({ x: c.x, z: c.z + 0.9 }); }
      if (Math.hypot(c.x - a.x, c.z - a.z) > 1.7) { walk(rt, dt, 3); return; }
      rt.wk.stop(); s.ph = 'anahtar'; s.t = 0;
      s.car = { id: carSeq++, x: c.x, z: c.z + 2.1, rot: Math.PI / 2, surus: false, ttl: 80 }; cars.push(s.car);
      c.patMax *= 1.15; c.patience = Math.min(c.patMax, c.patience + 0.15 * c.patMax); c.say = 'Teşekkürler!'; c.sayT = 2;   // park derdi yok: sabrı %15 geniş
      host.stat('valeAnahtar'); say(rt, rng.pick(['Anahtarınız bende.', 'Arabanız emin ellerde!']), 2.4);
      return;
    }
    if (s.ph === 'anahtar') {
      a.act = 'serve'; s.t += dt;
      if (s.car) rt.wk.face(s.car, dt);
      if (s.t >= 1.4) { s.ph = 'surus'; const i = cars.indexOf(s.car!); s.to = lot(Math.max(0, i)); rt.wk.goTo(s.to); s.car!.surus = true; a.fx = 'araba'; }
      return;
    }
    if (s.ph === 'surus') {
      const c = s.car!;
      if (rt.wk.walk(dt, 3.4)) { a.act = 'walk'; c.x = a.x; c.z = a.z; c.rot = a.rot; return; }
      c.surus = false; c.x = a.x; c.z = a.z; s.car = null; a.fx = ''; host.stat('valePark');
      say(rt, 'Park ettim.', 1.6); s.ph = 'don'; rt.wk.goTo(home); return;
    }
    if (walk(rt, dt)) return;
    arabaKaldir(); s.ph = 'post'; s.t = 0;
  }

  // ── müdür ──
  function mudur(rt: RolRt, s: Sub, dt: number, home: Vec2, S: GameState) {
    const a = rt.a, rt0 = R(), pl = env.player();
    const dx = Math.abs(pl.x - counterAt().x);
    if (!s.away && dx > AWAY_M) { s.away = true; s.ph = 'post'; say(rt, 'Ben bakarım, sen işine bak!', 2.6); host.stat('mudurVekil'); }
    else if (s.away && dx < BACK_M) { s.away = false; s.ph = 'don'; rt.wk.goTo(home); s.ist = ''; }
    if (!s.away) {
      if (s.ph === 'don') { if (walk(rt, dt)) return; s.ph = 'post'; }
      a.act = 'idle'; a.fx = '';
      if (!near2(a, home, 0.5)) { rt.wk.goTo(home); walk(rt, dt); return; }
      rt.wk.face(counterAt(), dt);
      if (rt.t > 12) { rt.t = 0; if (rng.chance(0.35)) say(rt, rng.pick(['Herkes yerine!', 'Bugün rekor kıracağız.']), 2.2); }
      return;
    }
    // vekil: sahipsiz istasyon > kasa
    const sahipsiz = (k: ProductId) => !S.workers.some((w) => ROLES[w.role]?.station === k);
    const bos = (k: ProductId) => host.stationBuilt(k) && !host.isGrab(k) && sahipsiz(k) && !host.outFull(k);
    if (!s.ist || !bos(s.ist as ProductId)) {
      s.ist = '';
      let best: ProductId | null = null, bd = 1e9;
      for (const k of VEKIL_ISTASYON) if (bos(k)) { const p = book.stationStand(k), d = Math.hypot(p.x - a.x, p.z - a.z); if (d < bd) { bd = d; best = k; } }
      if (best) { s.ist = best; rt.wk.goTo(book.stationStand(best)); }
    }
    if (s.ist) {
      if (rt.wk.walk(dt, 2.4)) { a.act = 'walk'; return; }
      const k = s.ist as ProductId, stand = book.stationStand(k);
      if (!near2(a, stand, 0.35)) { rt.wk.goTo(stand); return; }
      rt.wk.face(book.stationPos(k), dt);
      a.act = k === 'cay' ? 'pour' : 'cut';
      if (host.operate(k, rt.w.id, dt, VEKIL_HIZ * rankX(rt), 1)) { rt.w.xp = (rt.w.xp || 0) + 1; host.stat('mudurIs'); }
      return;
    }
    // istasyon yok: kasayı topla
    if (rt0.kasa.length) {
      const pile = rt0.layout.kasa.pile;
      if (!near2(a, pile, 0.9)) { rt.wk.goTo(pile); walk(rt, dt, 2.4); return; }
      a.act = 'count'; s.kasaT += dt;
      if (s.kasaT >= VEKIL_KASA_S) { s.kasaT = 0; const st = rt0.kasa.shift(); if (st) { host.cashIn?.(st.value); host.statMax('moneyMax', S.money); host.stat('mudurKasa'); } }   // EKO-02: kasa yığını satışta deftere yazıldı, burada yalnız cebe girer
      return;
    }
    a.act = 'idle';
    if (!near2(a, home, 0.5)) { rt.wk.goTo(home); walk(rt, dt); }
  }

  return {
    /** workers.ts 'front' durumu: rolün davranışı */
    front(rt: RolRt, S: GameState, dt: number, home: Vec2): void {
      const s = sub(rt);
      switch (rt.w.role) {
        case 'guvenlik': guvenlik(rt, s, dt, home); break;
        case 'muzisyen': muzisyen(rt, s, dt, home); break;
        case 'hostes': hostes(rt, s, dt, home); break;
        case 'vale': vale(rt, s, dt, home, S); break;
        case 'mudur': mudur(rt, s, dt, home, S); break;
        default: if (!near2(rt.a, home, 0.4)) { rt.wk.goTo(home); walk(rt, dt); } else rt.a.act = 'idle';
      }
    },
    /** her tick: roller listesi, yemek uzatma (müzik), park edilmiş arabalar, işten çıkanların kalıntısı */
    step(_S: GameState, dt: number, list: RolRt[]): void {
      rows = list;
      for (const [id] of subs) if (!list.some((r) => r.w.id === id)) { const s = subs.get(id)!; if (s.car) { s.car.surus = false; s.car = null; } subs.delete(id); }
      for (let i = cars.length - 1; i >= 0; i--) { const c = cars[i]; if (!c.surus && (c.ttl -= dt) <= 0) cars.splice(i, 1); }
      const musik = list.filter((r) => r.w.role === 'muzisyen' && subs.get(r.w.id)?.ph === 'cal');
      if (musik.length) for (const c of R().customers) {
        if (c.state !== 'eat' || c.t <= 0) continue;
        if (musik.some((r) => Math.hypot(r.a.x - c.x, r.a.z - c.z) <= MUSIK_R)) c.t = Math.max(0, c.t - dt * MUSIK_YEME);
      }
      if (handled.size > 400) handled.clear();
    },
    aura,
    valeCars: (): readonly ValeCar[] => cars,
    /** müdür şu an vekil mi (oyuncu uzakta) */
    vekil: (): boolean => withRole('mudur').some((r) => subs.get(r.w.id)?.away),
    kalabalik,
  };
}
export type Roller = ReturnType<typeof createRoller>;
