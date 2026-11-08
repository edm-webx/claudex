/**
 * Karar paketi D/E/F/H (2026-10-27): inventory, account bank, chests, daily board, plots with homes and shops, stadium ticket.
 * Pure sim. State: S.zones.envanter (character: items, unopened chests, board) and S.zones.arsa (character: plots).
 * The account-shared bank is runtime `rt.banka` { tl, esya, dirty }: boot fills it from the cloud after login and writes it back
 * when `dirty` (net/slots.ts). Guests keep an in-memory bank.
 * Commands { kind: 'mulk', op, ... }:
 *   envanter: kullan id | uret id | sandikAc id
 *   banka (near the bank door): tlYatir n | tlCek n | esyaYatir id n | esyaCek id n
 *   gunluk: gunlukAl id
 *   arsa: arsaAl id | arsaKur id tur tip | stokAl id n | yukselt id | evAc id
 *   stadyum (near the gate): bilet | takim name
 */
import { stadSave, tahminDoluluk, fiyatAyarla, FORMASYONLAR, KAPASITE, FIYAT_MIN, FIYAT_MAX } from './stadyum';
import type { Kernel } from './state';
import {
  ESYA_BY_ID, TARIFLER, SANDIK_BY_ID, GUNLUK_HAVUZ, SANDIK_DUSER, BANKA, ARSALAR, ARSA_HAK, arsaKapi, DUKKAN_BY_ID, DUKKAN_MAX_SEVIYE,
  DUKKAN_STOK_MAX, dukkanYukselt, dukkanMusteri, STADYUM, HALI_SAHA_KAPI, ISCI_MAX, isciFiyat, ISCI_SAAT_UCRET, ISCI_MUSTERI, type Arsa,
} from '../../content/esya';
import { fmtMoney } from './util';

export interface Hedef { id: string; ad: string; stat: string; hedef: number; sayi: number; odul: number; alindi: boolean }
export interface Env {
  esya: Record<string, number>; sandik: Record<string, number>; sayac: Record<string, number>; sans: number; acilan: number;
  gunluk: { gun: number; liste: Hedef[]; sandikAlindi: boolean };
  /** last chest result, shown by the panel */
  son: { sandik: string; tl: number; esya: string[]; t: number } | null;
}
/** café growth names per level (same idea as the büfe stages) */
export const KAFE_ASAMA = ['Köşe kafe', 'Kafe', 'Bistro', 'Teraslı bistro', 'Gurme bistro'];
export interface Plot { tur: 'ev' | 'dukkan' | null; tip: string; lv: number; stok: number; till: number; sat: number; fr: number; isci?: number }
export interface ArsaSave { plots: Record<string, Plot>; takim: { ad: string; renk: string; renk2?: string; arma?: string; kurulus?: number } | null; lastH: number }
export interface BankaRt { tl: number; esya: Record<string, number>; dirty: boolean }

const flo = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export const BANKA_MENZIL = 4.5, KAPI_MENZIL = 3.2;

export function installMulk(K: Kernel) {
  const S = K.state, rt = K.rt as unknown as Record<string, unknown>, rng = K.rng('sim.mulk');
  const env = (): Env => {
    const z = (S.zones.envanter ||= {}) as unknown as Env;
    z.esya ||= {}; z.sandik ||= {}; z.sayac ||= {}; z.sans = flo(z.sans); z.acilan = flo(z.acilan);
    z.gunluk ||= { gun: -1, liste: [], sandikAlindi: false }; z.son ??= null;
    return z;
  };
  const arsa = (): ArsaSave => {
    const z = (S.zones.arsa ||= {}) as unknown as ArsaSave;
    z.plots ||= {}; z.takim ??= null; if (typeof z.lastH !== 'number') z.lastH = 8;
    return z;
  };
  const banka = (): BankaRt => { const b = (rt.banka ||= { tl: 0, esya: {}, dirty: false }) as BankaRt; b.esya ||= {}; return b; };
  const have = (id: string) => flo(env().esya[id]);
  const give = (id: string, n = 1) => { if (n > 0) env().esya[id] = have(id) + n; };
  const take = (id: string, n = 1): boolean => { if (have(id) < n) return false; const e = env(); e.esya[id] -= n; if (e.esya[id] <= 0) delete e.esya[id]; return true; };
  const nm = (id: string) => ESYA_BY_ID[id]?.ad || id;

  // ── chests ──
  function giveChest(id: string, why: string) {
    const sd = SANDIK_BY_ID[id]; if (!sd) return;
    const e = env(); e.sandik[id] = flo(e.sandik[id]) + 1;
    K.toast(sd.ikon + ' ' + sd.ad + ' düştü! (' + why + ') Envanterden aç.', 'good'); K.logEv('sandikDustu', { id });
  }
  function pick(h: [string, number][]): string { let t = 0; for (const [, w] of h) t += w; let r = rng.next() * t; for (const [id, w] of h) { r -= w; if (r <= 0) return id; } return h[0][0]; }
  function sandikAc(id: string) {
    const sd = SANDIK_BY_ID[id], e = env(); if (!sd || flo(e.sandik[id]) < 1) return;
    if (sd.anahtar && !take(sd.anahtar)) { K.toast(nm(sd.anahtar) + ' lazım. Günlük tahtayı bitirince gelir.', 'info'); return; }
    e.sandik[id]--; if (e.sandik[id] <= 0) delete e.sandik[id];
    const tl = Math.round((sd.tl[0] + rng.next() * (sd.tl[1] - sd.tl[0])) * (1 + S.level * 0.04));
    let n = rng.int(sd.adet[0], sd.adet[1]); if (e.sans > 0) { e.sans--; n++; }
    const got: string[] = [];
    for (let i = 0; i < n; i++) { const it = pick(sd.havuz); give(it, 1); got.push(it); }
    K.earn(tl); e.acilan++; K.stat('sandikAcildi');
    e.son = { sandik: sd.ad, tl, esya: got, t: S.playT };
    K.toast(sd.ikon + ' ' + sd.ad + ': +' + fmtMoney(tl) + ' ve ' + got.map(nm).join(', '), 'good');
  }
  /** stat key -> chest drops and board progress */
  function onStat(k: string, n: number) {
    const e = env();
    for (const d of SANDIK_DUSER) if (d.stat === k) { e.sayac[k] = flo(e.sayac[k]) + n; while (e.sayac[k] >= d.her) { e.sayac[k] -= d.her; giveChest(d.sandik, d.ad); } }
    for (const h of e.gunluk.liste) if (h.stat === k && h.sayi < h.hedef) { h.sayi = Math.min(h.hedef, h.sayi + n); if (h.sayi >= h.hedef) K.toast('📋 Günlük görev tamam: ' + h.ad, 'good'); }
  }
  const stat0 = K.stat;
  K.stat = (key: string, n = 1) => { stat0(key, n); onStat(key, n); };
  K.bus.on('sale', (() => onStat('sale', 1)) as never);

  // ── daily board ──
  function rollBoard(day: number) {
    const e = env(), pool = [...GUNLUK_HAVUZ];
    for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(0, i); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    e.gunluk = { gun: day, sandikAlindi: false, liste: pool.slice(0, 3).map(g => {
      const hedef = rng.int(g.hedef[0], g.hedef[1]);
      return { id: g.id, ad: g.ad.replace('{n}', String(hedef)), stat: g.stat, hedef, sayi: 0, odul: Math.round(g.odul * (1 + S.level * 0.05)), alindi: false };
    }) };
  }
  function gunlukAl(id: string) {
    const e = env(), h = e.gunluk.liste.find(x => x.id === id);
    if (!h || h.alindi || h.sayi < h.hedef) return;
    h.alindi = true; K.earn(h.odul); K.addXP(10); K.toast('📋 +' + fmtMoney(h.odul) + ' (' + h.ad + ')', 'good');
    if (!e.gunluk.sandikAlindi && e.gunluk.liste.every(x => x.alindi)) { e.gunluk.sandikAlindi = true; giveChest('gumus', 'günlük tahta'); if (S.day % 7 === 0) { give('altin_anahtar', 1); K.toast('🗝️ Haftalık ödül: Altın Anahtar!', 'good'); } }
  }

  // ── items ──
  function kullan(id: string) {
    const it = ESYA_BY_ID[id]; if (!it || have(id) < 1) return;
    if (id === 'bozuk_kese') { take(id); const v = rng.int(300, 1200) + S.level * 40; K.earn(v); K.toast('👛 Kesede ' + fmtMoney(v) + ' varmış!', 'good'); }
    else if (id === 'tecrube_simit') { take(id); K.addXP(30 + S.level * 5); K.toast('🥯 Tecrübe kazandın!', 'good'); }
    else if (id === 'sans_simidi') { take(id); env().sans++; K.toast('🍀 Sıradaki sandıktan 1 eşya fazla çıkacak.', 'good'); }
    else if (id === 'altin_kupon') { take(id); S.gold += 5; K.toast('🎟️ +5 Altın Simit', 'good'); }
    else K.toast(it.ad + ': ' + it.blurb, 'info');
  }
  function uret(id: string) {
    const r = TARIFLER.find(x => x.id === id); if (!r) return;
    for (const m in r.gir) if (have(m) < r.gir[m]) { K.toast('Malzeme eksik: ' + Object.entries(r.gir).map(([k, v]) => v + ' ' + nm(k)).join(', '), 'info'); return; }
    for (const m in r.gir) take(m, r.gir[m]);
    give(r.cik, 1); K.toast('🔨 ' + nm(r.cik) + ' üretildi!', 'good'); K.stat('uretim');
  }

  // ── bank (account shared) ──
  const nearBank = () => dist(K.playerPos, BANKA.kapi) < BANKA_MENZIL;
  function bankaOp(op: string, id: string, n: number) {
    if (!nearBank()) { K.toast('Banka binasının önüne git (karşı yaka, meydanın doğusu).', 'info'); return; }
    const b = banka();
    if (op === 'tlYatir') { n = Math.min(n, flo(S.money)); if (n < 1) return; S.money -= n; b.tl += n; K.toast('🏦 ' + fmtMoney(n) + ' yatırıldı. Bankada ' + fmtMoney(b.tl), 'good'); }
    else if (op === 'tlCek') { n = Math.min(n, b.tl); if (n < 1) return; b.tl -= n; S.money += n; K.toast('🏦 ' + fmtMoney(n) + ' çekildi.', 'good'); }
    else if (op === 'esyaYatir') { if (!ESYA_BY_ID[id]) return; n = Math.min(n, have(id)); if (n < 1) return; take(id, n); b.esya[id] = flo(b.esya[id]) + n; K.toast('🏦 ' + n + ' ' + nm(id) + ' depoya kondu (tüm karakterlerin görür).', 'good'); }
    else if (op === 'esyaCek') { n = Math.min(n, flo(b.esya[id])); if (n < 1) return; b.esya[id] -= n; if (b.esya[id] <= 0) delete b.esya[id]; give(id, n); K.toast('🏦 ' + n + ' ' + nm(id) + ' çantana alındı.', 'good'); }
    b.dirty = true;
  }

  // ── plots ──
  const plotOf = (id: string): { a: Arsa; p: Plot | undefined } | null => { const a = ARSALAR.find(x => x.id === id); return a ? { a, p: arsa().plots[id] } : null; };
  const ownedN = () => ARSALAR.filter(a => !a.sabit && arsa().plots[a.id]).length;
  function arsaAl(id: string) {
    const q = plotOf(id); if (!q || q.p) return;
    if (S.level < q.a.seviye) { K.toast('Bu arsa ' + q.a.seviye + '. seviyede açılır.', 'info'); return; }
    if (!q.a.sabit && ownedN() >= ARSA_HAK) { K.toast('Karakter başına en fazla ' + ARSA_HAK + ' arsa hakkın var.', 'info'); return; }
    if (S.money < q.a.fiyat) { K.toast((q.a.sabit ? 'Kafe' : 'Arsa') + ' için ' + fmtMoney(q.a.fiyat) + ' lazım.', 'bad'); return; }
    if (q.a.sabit) {
      K.spend(q.a.fiyat); arsa().plots[id] = { tur: 'dukkan', tip: q.a.sabit, lv: 1, stok: 20, till: 0, sat: 0, fr: 0, isci: 0 };
      K.toast('☕ ' + (q.a.ad || 'Kafe') + ' senin! Stok al, işçi tut: işçiler sen yokken rafı doldurur, satar.', 'good'); K.stat('mulkKuruldu'); K.addXP(60); K.saveNow(); return;
    }
    K.spend(q.a.fiyat); arsa().plots[id] = { tur: null, tip: '', lv: 1, stok: 0, till: 0, sat: 0, fr: 0 };
    K.toast('🏗️ Arsa senin! Şimdi ev mi dükkân mı kuracağına karar ver.', 'good'); K.stat('arsaAlindi'); K.addXP(30); K.saveNow();
  }
  function arsaKur(id: string, tur: string, tip: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur) return;
    if (tur === 'ev') { const f = 25000; if (S.money < f) { K.toast('Ev için ' + fmtMoney(f) + ' lazım.', 'bad'); return; } K.spend(f); q.p.tur = 'ev'; K.toast('🏠 Evin hazır! Kapıdan girip döşe.', 'good'); }
    else if (tur === 'dukkan') {
      const t = DUKKAN_BY_ID[tip]; if (!t) return;
      if (S.level < t.seviye) { K.toast(t.ad + ' ' + t.seviye + '. seviyede açılır.', 'info'); return; }
      if (S.money < t.kurulum) { K.toast('Kurulum için ' + fmtMoney(t.kurulum) + ' lazım.', 'bad'); return; }
      K.spend(t.kurulum); q.p.tur = 'dukkan'; q.p.tip = tip; K.toast(t.ikon + ' ' + t.ad + ' açıldı! Stok al, müşteri gelsin.', 'good');
    } else return;
    K.addXP(40); K.stat('mulkKuruldu'); K.saveNow();
  }
  function stokAl(id: string, n: number) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'dukkan') return;
    const t = DUKKAN_BY_ID[q.p.tip], max = DUKKAN_STOK_MAX[q.p.lv];
    n = Math.min(n, max - flo(q.p.stok)); if (n < 1) { K.toast('Raf dolu. Yükseltirsen daha çok alır.', 'info'); return; }
    const c = n * t.maliyet; if (S.money < c) { n = Math.floor(S.money / t.maliyet); if (n < 1) { K.toast('Stok için para yok.', 'bad'); return; } }
    K.spend(n * t.maliyet); q.p.stok += n;
  }
  function yukselt(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'dukkan') return;
    if (q.p.lv >= DUKKAN_MAX_SEVIYE) { K.toast('En üst seviyedesin.', 'info'); return; }
    const t = DUKKAN_BY_ID[q.p.tip], y = dukkanYukselt(t, q.p.lv);
    for (const m in y.esya) if (have(m) < y.esya[m]) { K.toast('Eksik: ' + Object.entries(y.esya).map(([k, v]) => v + ' ' + nm(k)).join(', ') + ' (envanter / üretim)', 'info'); return; }
    if (S.money < y.tl) { K.toast('Yükseltme ' + fmtMoney(y.tl), 'bad'); return; }
    K.spend(y.tl); for (const m in y.esya) take(m, y.esya[m]); q.p.lv++;
    K.toast('⬆️ ' + (q.a.sabit === 'kafe' ? (q.a.ad || t.ad) + ' artık ' + KAFE_ASAMA[q.p.lv - 1] + '! Terası büyüdü.' : t.ad + ' ' + q.p.lv + '. seviye!'), 'good'); K.addXP(40); K.saveNow();
  }
  function isciAl(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'dukkan') return;
    const n = flo(q.p.isci); if (n >= ISCI_MAX) { K.toast('En fazla ' + ISCI_MAX + ' işçi çalışır.', 'info'); return; }
    const f = isciFiyat(n); if (S.money < f) { K.toast('İşçi tutmak ' + fmtMoney(f) + '.', 'bad'); return; }
    K.spend(f); q.p.isci = n + 1; K.toast('👷 İşçi tutuldu (' + q.p.isci + '/' + ISCI_MAX + '). Saatlik ' + fmtMoney(ISCI_SAAT_UCRET) + ' kasadan ödenir.', 'good'); K.stat('isciTutuldu'); K.addXP(20); K.saveNow();
  }
  function evAc(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'ev') return;
    if (dist(K.playerPos, arsaKapi(q.a)) > KAPI_MENZIL + 1.5) { K.toast('Evin kapısına yaklaş.', 'info'); return; }
    K.command({ kind: 'dekor2', arg: 'evOpen' });
  }

  // ── stadium ──
  const nearGate = () => dist(K.playerPos, STADYUM.kapi) < 5 || dist(K.playerPos, HALI_SAHA_KAPI) < 4.5;
  function bilet() {
    if (!nearGate()) { K.toast('Bileti Maç Koordinatörü verir: karşı yakada halı saha girişi (üst geçitten geç).', 'info'); return; }
    if (S.money < STADYUM.bilet) { K.toast('Bilet ' + fmtMoney(STADYUM.bilet) + '.', 'bad'); return; }
    K.spend(STADYUM.bilet); K.toast('🎟️ Bilet alındı! Maç başlıyor.', 'good');
    K.command({ kind: 'halisaha', op: 'teklif' } as never); K.command({ kind: 'halisaha', op: 'kabul' } as never);
  }
  const HEX = /^#[0-9a-fA-F]{6}$/, ARMALAR = ['🦅', '🐟', '🦁', '⭐', '⚓', '🔥', '🐈', '🥙'];
  function takim(ad: string, r1?: string, r2?: string, arma?: string) {
    const a = arsa(); if (a.takim) { K.toast('Takımın zaten var: ' + a.takim.ad, 'info'); return; }
    if (!nearGate()) { K.toast('Kulübü Maç Koordinatörü kurar: karşı yakada halı saha girişi.', 'info'); return; }
    ad = String(ad || '').replace(/[<>]/g, '').trim().slice(0, 16); if (ad.length < 3) { K.toast('Takım adı en az 3 harf.', 'info'); return; }
    if (S.money < STADYUM.takim) { K.toast('Takım kurmak ' + fmtMoney(STADYUM.takim) + '.', 'bad'); return; }
    K.spend(STADYUM.takim); a.takim = { ad, renk: HEX.test(r1 || '') ? r1! : '#e0533c', renk2: HEX.test(r2 || '') ? r2! : '#f2c230', arma: ARMALAR.includes(arma || '') ? arma : '🦅', kurulus: S.day }; K.toast('⚽ ' + ad + ' kuruldu!', 'good'); K.addXP(60); K.saveNow();
  }

  // ── tick: board roll, shops, level-up chests, collecting tills ──
  let acc = 0, lastLevel = S.level;
  K.addSystem({
    id: 'mulk', order: 50, phase: 'sim',
    step(ctx) {
      if (!K.rt.started) return;
      acc += ctx.dt; if (acc < 0.25) return;
      const dt = acc; acc = 0;
      const e = env(); if (e.gunluk.gun !== S.day) rollBoard(S.day);
      if (S.level > lastLevel) { for (let l = lastLevel; l < S.level; l++) onStat('seviye', 1); }
      lastLevel = S.level;
      const a = arsa(), h = K.hour(), dh = Math.max(0, Math.min(1, h >= a.lastH ? h - a.lastH : (24 - a.lastH) + (h - 8))); a.lastH = h;
      void dt;
      for (const ar of ARSALAR) {
        const p = a.plots[ar.id]; if (!p || p.tur !== 'dukkan') continue;
        const t = DUKKAN_BY_ID[p.tip], isci = flo(p.isci);
        if (dh > 0 && isci > 0) {
          const ucret = isci * ISCI_SAAT_UCRET * dh; if (p.till >= ucret) p.till -= ucret;      // wages come out of the till
          const max = DUKKAN_STOK_MAX[p.lv]; if (p.stok < max * 0.25 && p.till >= t.maliyet * 10) { const n = Math.min(max - Math.floor(p.stok), Math.floor(p.till * 0.6 / t.maliyet)); if (n > 0) { p.till -= n * t.maliyet; p.stok += n; } }
        }
        if (dh > 0 && p.stok > 0) {
          p.fr += dukkanMusteri(t, p.lv) * (1 + ISCI_MUSTERI * isci) * dh; const n = Math.min(Math.floor(p.fr), p.stok); p.fr -= Math.floor(p.fr);
          if (n > 0) { p.stok -= n; p.sat += n; p.till += n * t.fiyat * (1 + p.lv * 0.04); }
        }
        if (p.till >= 1 && dist(K.playerPos, arsaKapi(ar)) < KAPI_MENZIL) {
          const v = Math.floor(p.till); p.till -= v; K.earn(v, arsaKapi(ar)); K.stat('mulkKasa');
          K.toast(t.ikon + ' ' + t.ad + ' kasası: +' + fmtMoney(v), 'good');
        }
      }
    },
  });

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'mulk') return false;
    const op = String(c.op || ''), id = String(c.id ?? ''), n = flo(c.n);
    switch (op) {
      case 'kullan': kullan(id); break; case 'uret': uret(id); break; case 'sandikAc': sandikAc(id); break;
      case 'tlYatir': case 'tlCek': case 'esyaYatir': case 'esyaCek': bankaOp(op, id, n); break;
      case 'gunlukAl': gunlukAl(id); break;
      case 'arsaAl': arsaAl(id); break; case 'arsaKur': arsaKur(id, String(c.tur ?? ''), String(c.tip ?? '')); break;
      case 'stokAl': stokAl(id, n || 10); break; case 'yukselt': yukselt(id); break; case 'evAc': evAc(id); break; case 'isciAl': isciAl(id); break;
      case 'bilet': bilet(); break;
      case 'biletFiyat': { const a = arsa(); if (!a.takim) { K.toast('Önce kulüp kurmalısın.', 'info'); break; } fiyatAyarla(stadSave(a as never), n || Number(c.n) || 0); K.saveNow(); break; }
      case 'formasyon': { const a = arsa(); if (!a.takim) { K.toast('Önce kulüp kurmalısın.', 'info'); break; } const f = FORMASYONLAR.find(x => x.id === String(c.name)); if (f) { stadSave(a as never).formasyon = f.id; K.toast('Diziliş: ' + f.ad, 'good'); K.saveNow(); } break; } case 'takim': takim(String(c.name ?? ''), c.renk as string | undefined, c.renk2 as string | undefined, c.arma as string | undefined); break;
      case 'ver': if (ESYA_BY_ID[id]) give(id, n || 1); break;   // test / admin
      case 'sandikVer': if (SANDIK_BY_ID[id]) giveChest(id, 'yönetici'); break;
      default: return false;
    }
    return true;
  }

  function view() {
    const a = arsa(), p = K.playerPos;
    return {
      bankaYakin: nearBank(), kapiYakin: ARSALAR.find(x => a.plots[x.id] && dist(p, arsaKapi(x)) < KAPI_MENZIL + 1.5)?.id || null,
      arsaYakin: ARSALAR.find(x => dist(p, arsaKapi(x)) < KAPI_MENZIL + 1.5)?.id || null, stadyumYakin: nearGate(), ipucuYakin: (rt.gizem as { view(): { yakin: string | null } } | undefined)?.view().yakin ?? null,
      plots: ARSALAR.map(x => ({ id: x.id, x: x.x, z: x.z, rotY: x.rotY, sabit: x.sabit || '', tur: a.plots[x.id]?.tur ?? null, tip: a.plots[x.id]?.tip || '', lv: a.plots[x.id]?.lv || 0, owned: !!a.plots[x.id], till: Math.floor(a.plots[x.id]?.till || 0), isci: flo(a.plots[x.id]?.isci) })),
    };
  }
  function model() {
    const e = env(), a = arsa(), b = banka();
    return {
      money: S.money, gold: S.gold, level: S.level, esya: { ...e.esya }, sandik: { ...e.sandik }, sans: e.sans, acilan: e.acilan, son: e.son,
      banka: { tl: b.tl, esya: { ...b.esya }, yakin: nearBank() },
      gunluk: e.gunluk.liste.map(h => ({ ...h })), gunlukSandik: e.gunluk.sandikAlindi,
      arsa: ARSALAR.map(x => { const p = a.plots[x.id]; return { id: x.id, ad: x.ad || '', sabit: x.sabit || '', fiyat: x.fiyat, seviye: x.seviye, owned: !!p, tur: p?.tur ?? null, tip: p?.tip || '', lv: p?.lv || 0, stok: Math.floor(p?.stok || 0), till: Math.floor(p?.till || 0), sat: Math.floor(p?.sat || 0), isci: flo(p?.isci), isciMax: ISCI_MAX, isciFiyat: isciFiyat(flo(p?.isci)),
        stokMax: p ? DUKKAN_STOK_MAX[p.lv] : 0, yakin: dist(K.playerPos, arsaKapi(x)) < KAPI_MENZIL + 1.5, yukselt: p && p.tur === 'dukkan' && p.lv < DUKKAN_MAX_SEVIYE ? dukkanYukselt(DUKKAN_BY_ID[p.tip], p.lv) : null }; }),
      gizem: (rt.gizem as { model(): unknown } | undefined)?.model() ?? null,
      lig: (rt.lig as { model(): unknown } | undefined)?.model() ?? null,
      hak: ARSA_HAK, sahip: ownedN(), takim: a.takim, stad: a.takim ? (() => { const s = stadSave(a as never), z = (S.zones.halisaha as { form?: string[] } | undefined)?.form || []; return { ...s, tahmin: tahminDoluluk(s.fiyat, z), kapasite: KAPASITE, min: FIYAT_MIN, max: FIYAT_MAX, formaylar: FORMASYONLAR }; })() : null, stadyum: { ...STADYUM, yakin: nearGate() },
    };
  }
  const api = { handle, view, model, give, have };
  rt.mulk = api;
  return api;
}
export type MulkApi = ReturnType<typeof installMulk>;
export const mulkApi = (r: { rt: unknown } | null | undefined): MulkApi | null => (r ? ((r.rt as { mulk?: MulkApi }).mulk || null) : null);
