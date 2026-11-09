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
  DUKKAN_STOK_MAX, dukkanYukselt, dukkanMusteri, STADYUM, HALI_SAHA_KAPI, ISCI_MAX, isciFiyat, kafeMenu, kafeIsciMax, ISCI_SAAT_UCRET, ISCI_MUSTERI, type Arsa,
  isletmeOf, isletmeEsya, SALON_ESYA, SALON_ESYA_BY_ID,
} from '../../content/esya';
import { IC_CANLI, icOfArsa, icIcinde, bankaGise, IC_BY_ID, icDim, icWorld } from '../../content/ic-mekan';
import { OKUL_KELIME, OKUL_SINAV } from '../../content/okul';
import { AVM_URUN, AVM_BY_ID } from '../../content/avm';
import { KT_URUN, KT_BY_ID, KT_MUSTERI, KT_SABIR } from '../../content/kirtasiye';
export const KREDI_FAIZ = 0.03, MEVDUAT_FAIZ = 0.005, KREDI_LIMIT = (lv: number) => 25000 + lv * 15000;
export const KAFE_TEMA: Record<string, string> = { retro: 'Retro', modern: 'Modern', bohem: 'Bohem', deniz: 'Deniz' };
import { fmtMoney } from './util';
import { salonOf, salonKat } from './salon';

export interface Hedef { id: string; ad: string; stat: string; hedef: number; sayi: number; odul: number; alindi: boolean }
export interface Env {
  esya: Record<string, number>; sandik: Record<string, number>; sayac: Record<string, number>; sans: number; acilan: number;
  gunluk: { gun: number; liste: Hedef[]; sandikAlindi: boolean };
  /** last chest result, shown by the panel */
  son: { sandik: string; tl: number; esya: string[]; t: number } | null;
}
/** café growth names per level (same idea as the büfe stages) */
export const KAFE_ASAMA = ['Köşe kafe', 'Kafe', 'Bistro', 'Teraslı bistro', 'Gurme bistro'];
export interface Plot { tur: 'ev' | 'dukkan' | null; tip: string; lv: number; stok: number; till: number; sat: number; fr: number; isci?: number; esya?: string[]; tema?: string }
export interface ArsaSave { plots: Record<string, Plot>; takim: { ad: string; renk: string; renk2?: string; arma?: string; kurulus?: number } | null; lastH: number; kredi?: { borc: number; gun: number } }
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
  const nearBank = () => dist(K.playerPos, BANKA.kapi) < BANKA_MENZIL || dist(K.playerPos, bankaGise()) < 2.6;   // door or the teller window inside
  function bankaOp(op: string, id: string, n: number) {
    if (!nearBank()) { K.toast('Bankaya gir, gişeye yaklaş (karşı yaka, meydanın doğusu).', 'info'); return; }
    const b = banka();
    if (op === 'tlYatir') { n = Math.min(n, flo(S.money)); if (n < 1) return; S.money -= n; b.tl += n; K.toast('🏦 ' + fmtMoney(n) + ' yatırıldı. Bankada ' + fmtMoney(b.tl), 'good'); }
    else if (op === 'tlCek') { n = Math.min(n, b.tl); if (n < 1) return; b.tl -= n; S.money += n; K.toast('🏦 ' + fmtMoney(n) + ' çekildi.', 'good'); }
    else if (op === 'esyaYatir') { if (!ESYA_BY_ID[id]) return; n = Math.min(n, have(id)); if (n < 1) return; take(id, n); b.esya[id] = flo(b.esya[id]) + n; K.toast('🏦 ' + n + ' ' + nm(id) + ' depoya kondu (tüm karakterlerin görür).', 'good'); }
    else if (op === 'esyaCek') { n = Math.min(n, flo(b.esya[id])); if (n < 1) return; b.esya[id] -= n; if (b.esya[id] <= 0) delete b.esya[id]; give(id, n); K.toast('🏦 ' + n + ' ' + nm(id) + ' çantana alındı.', 'good'); }
    else if (op === 'krediAl') {   // survey: loans with daily interest; hard but no bankruptcy (the debt only grows, nothing is seized)
      const a = arsa(), k = (a.kredi ||= { borc: 0, gun: S.day }), lim = KREDI_LIMIT(S.level);
      n = Math.min(n, lim - k.borc); if (n < 1) { K.toast('Kredi limitin dolu (' + fmtMoney(lim) + ').', 'info'); return; }
      k.borc += n; S.money += n; K.toast('🏦 ' + fmtMoney(n) + ' kredi çekildi. Borç ' + fmtMoney(k.borc) + ', günlük faiz %' + KREDI_FAIZ * 100, 'good'); return;
    }
    else if (op === 'krediOde') {
      const k = arsa().kredi; if (!k || k.borc < 1) return;
      n = Math.min(n, k.borc, flo(S.money)); if (n < 1) return; S.money -= n; k.borc -= n; K.toast('🏦 ' + fmtMoney(n) + ' ödendi. Kalan borç ' + fmtMoney(k.borc), 'good'); return;
    }
    b.dirty = true;
  }
  /** day roll: loan interest grows the debt, savings earn a little */
  function faizGun() {
    const k = arsa().kredi; if (k && k.borc > 0 && k.gun !== S.day) { const f = Math.ceil(k.borc * KREDI_FAIZ); k.borc += f; K.toast('🏦 Kredi faizi: +' + fmtMoney(f) + ' borç (toplam ' + fmtMoney(k.borc) + ')', 'bad'); }
    if (k) k.gun = S.day;
    const b = banka(); if (b.tl >= 100) { const f = Math.floor(Math.min(b.tl, 5e6) * MEVDUAT_FAIZ); if (f > 0) { b.tl += f; b.dirty = true; } }
  }

  // ── plots ──
  /** Per-unit price, cost and customer multiplier of a shop; cafés use their own menu and equipment (2026-11-08). */
  function ekon(ar: Arsa, p: Plot) {
    const t = DUKKAN_BY_ID[p.tip];
    if (!ar.sabit) return { fiyat: t.fiyat, maliyet: t.maliyet, musK: 1, menu: [] as ReturnType<typeof kafeMenu> };
    const menu = kafeMenu(ar.id, p.lv), avg = (k: 'fiyat' | 'maliyet') => menu.reduce((s, m) => s + m[k], 0) / Math.max(1, menu.length);
    let fK = 1, mK = 1 + 0.08 * Math.max(0, menu.length - 2);
    for (const e of p.esya || []) { const d = isletmeEsya(ar.id, e); if (d) { fK += d.fiyatK || 0; mK += d.musteri || 0; } }
    return { fiyat: avg('fiyat') * fK, maliyet: avg('maliyet'), musK: mK * isletmeOf(ar.id).mus, menu };
  }
  const isciMaxOf = (ar: Arsa, p: Plot | undefined) => (ar.sabit && p ? kafeIsciMax(p.lv) : ISCI_MAX);
  function kafeEsya(id: string, e: string) {
    const q = plotOf(id), d = isletmeEsya(id, e); if (!q || !q.p || !q.a.sabit || !d) return;
    const own = (q.p.esya ||= []); if (own.includes(e)) { K.toast('Bu işletmede zaten var.', 'info'); return; }
    if (q.p.lv < d.lv) { K.toast(d.ad + ' için ' + (q.a.ad || 'işletme') + ' ' + d.lv + '. seviye olmalı.', 'info'); return; }
    if (S.money < d.fiyat) { K.toast(d.ad + ' ' + fmtMoney(d.fiyat) + '.', 'bad'); return; }
    K.spend(d.fiyat); own.push(e); K.toast(d.ikon + ' ' + d.ad + ' kuruldu: ' + d.desc, 'good'); K.addXP(15); K.saveNow();
  }
  // survey 2026-11-09: café theme (retro / modern / bohem / deniz) repaints the room; the player brews at the espresso machine (wait-and-take)
  function tema(id: string, e: string) {
    const q = plotOf(id); if (!q || !q.p || !q.a.sabit || !KAFE_TEMA[e]) return;
    if (q.p.tema === e) return; const fiyat = q.p.tema ? 15000 : 0;
    if (S.money < fiyat) { K.toast('Tema değiştirmek ' + fmtMoney(fiyat) + '.', 'bad'); return; }
    if (fiyat) K.spend(fiyat); q.p.tema = e; K.toast('🎨 ' + (q.a.ad || 'Kafe') + ': ' + KAFE_TEMA[e] + ' tema', 'good'); K.saveNow();
  }
  // ── okul: English lesson at the classroom (back half of the school room) ──
  type OkulSave = { soru: number; secenek: number[]; cevap: number; dogru: number; sinavlar: number[]; son: string };
  const okulZ = (): OkulSave => { const z = (S.zones ||= {}) as Record<string, unknown>; let o = z.okul as OkulSave | undefined; if (!o || !Array.isArray(o.sinavlar)) { o = { soru: -1, secenek: [], cevap: 0, dogru: 0, sinavlar: [], son: '' }; z.okul = o as never; } return o; };
  const okulYakin = () => { const m = IC_BY_ID.okul; return !!m && icIcinde(m, K.playerPos, -0.2) && K.playerPos.z > m.z - 0.5; };
  function okulSoru() {
    const o = okulZ(), n = OKUL_KELIME.length, q = rng.int(0, n - 1), set = new Set([q]);
    while (set.size < 4) set.add(rng.int(0, n - 1));
    o.soru = q; o.secenek = [...set].sort(() => rng.next() - 0.5);
  }
  function dersCevap(i: number) {
    if (!okulYakin()) { K.toast('Ders sınıfta: okula gir, sıralara geç.', 'info'); return; }
    const o = okulZ(); if (o.soru < 0) { okulSoru(); return; }
    const ok = o.secenek[i] === o.soru, w = OKUL_KELIME[o.soru];
    o.cevap++; if (ok) o.dogru++;
    o.son = ok ? '✓ Doğru: ' + w[0] + ' = ' + w[1] : '✗ ' + w[0] + ' = ' + w[1];
    if (o.cevap >= OKUL_SINAV) {
      const puan = Math.round(o.dogru / o.cevap * 100); o.sinavlar.push(puan); if (o.sinavlar.length > 20) o.sinavlar.shift();
      const odul = puan * 40; K.earn(odul); K.addXP(Math.round(puan / 4));
      K.toast('📝 Sınav bitti: ' + puan + ' puan · +' + fmtMoney(odul), puan >= 50 ? 'good' : 'info'); K.stat('sinav');
      o.cevap = 0; o.dogru = 0;
    }
    okulSoru(); K.saveNow();
  }
  // ── AVM shopping (clothes/cosmetics are kept for the character creator; cinema/fun are one-off XP) ──
  const avmZ = (): { alinan: string[] } => { const z = (S.zones ||= {}) as Record<string, unknown>; let o = z.avm as { alinan: string[] } | undefined; if (!o || !Array.isArray(o.alinan)) { o = { alinan: [] }; z.avm = o as never; } return o; };
  const avmYakin = () => { const m = IC_BY_ID.avm; return !!m && icIcinde(m, K.playerPos, -0.2); };
  function avmAl(id: string) {
    const u = AVM_BY_ID[id]; if (!u) return;
    if (!avmYakin()) { K.toast('Alışveriş için Martı AVM\'ye gir.', 'info'); return; }
    const kalici = u.kat === 'giyim' || u.kat === 'kozmetik', o = avmZ();
    if (kalici && o.alinan.includes(id)) { K.toast(u.ad + ' zaten dolabında.', 'info'); return; }
    if (S.money < u.fiyat) { K.toast(u.ad + ' ' + fmtMoney(u.fiyat) + '.', 'bad'); return; }
    K.spend(u.fiyat); K.addXP(u.xp); K.stat('avm');
    if (kalici) o.alinan.push(id);
    K.toast(u.ikon + ' ' + u.ad + (kalici ? ' alındı (karakter dolabında)' : ': keyifli vakit! +' + u.xp + ' tecrübe'), 'good'); K.saveNow();
  }
  // ── kırtasiye first-person counter (own the shop, stand inside, press "Tezgaha geç") ──
  type KtMus = { ad: string; istek: Record<string, number>; t: number };
  const kt = { on: false, mus: null as KtMus | null, sepet: {} as Record<string, number>, bekle: 2, ciro: 0, sat: 0, kacan: 0, son: '' };
  const ktYakin = () => { const m = IC_BY_ID.kirtasiye; return !!m && icIcinde(m, K.playerPos, 0.2); };
  const ktSahip = () => !!arsa().plots.k3;
  function ktYeni() {
    const n = rng.int(1, Math.min(4, 1 + Math.floor(kt.sat / 6))), istek: Record<string, number> = {};
    for (let i = 0; i < n; i++) { const u = KT_URUN[rng.int(0, KT_URUN.length - 1)]; istek[u.id] = (istek[u.id] || 0) + (u.id === 'fotokopi' ? rng.int(2, 10) : 1); }
    kt.mus = { ad: KT_MUSTERI[rng.int(0, KT_MUSTERI.length - 1)], istek, t: 0 }; kt.sepet = {};
  }
  function ktOp(op: string, id: string) {
    if (op === 'ktAc') {
      if (!ktSahip()) { K.toast('Önce Martı Kırtasiye\'yi satın al.', 'info'); return; }
      if (!ktYakin()) { K.toast('Tezgaha geçmek için kırtasiyeye gir.', 'info'); return; }
      kt.on = true; kt.mus = null; kt.bekle = 1.5; kt.sepet = {}; kt.son = ''; return;
    }
    if (!kt.on) return;
    if (op === 'ktKapat') { kt.on = false; kt.mus = null; K.toast('✏️ Tezgahtan çıktın: ' + kt.sat + ' satış, ' + fmtMoney(kt.ciro), 'good'); kt.ciro = 0; kt.sat = 0; kt.kacan = 0; return; }
    if (!kt.mus) return;
    if (op === 'ktEkle' && KT_BY_ID[id]) { const need = (kt.mus.istek[id] || 0) - (kt.sepet[id] || 0); kt.sepet[id] = (kt.sepet[id] || 0) + (id === 'fotokopi' && need > 1 ? need : 1); return; }   // the copier runs the whole stack at once
    if (op === 'ktTemizle') { kt.sepet = {}; return; }
    if (op === 'ktVer') {
      const ist = kt.mus.istek, keys = new Set([...Object.keys(ist), ...Object.keys(kt.sepet)]);
      const ok = [...keys].every(k => (ist[k] || 0) === (kt.sepet[k] || 0));
      if (!ok) { kt.mus.t += 4; kt.son = '✗ "' + rng.pick(['Bu değil ki!', 'Eksik var galiba.', 'Ben bunu istemedim.']) + '"'; return; }
      const deger = Object.entries(ist).reduce((a, [k, n]) => a + KT_BY_ID[k].fiyat * n, 0), hiz = 1 + 0.5 * Math.max(0, 1 - kt.mus.t / KT_SABIR);
      const v = Math.round(deger * hiz * (1 + S.level * 0.02)); K.earn(v); K.addXP(2); K.stat('kirtasiyeSatis');
      kt.ciro += v; kt.sat++; kt.son = '✓ ' + kt.mus.ad + ': "' + rng.pick(['Teşekkürler!', 'Çok hızlısınız!', 'Kolay gelsin.']) + '" +' + fmtMoney(v);
      kt.mus = null; kt.bekle = rng.range(1.5, 4);
    }
  }
  function ktStep(dt: number) {
    if (!kt.on) return;
    if (!ktYakin()) { kt.on = false; kt.mus = null; return; }
    if (!kt.mus) { kt.bekle -= dt; if (kt.bekle <= 0) ktYeni(); return; }
    kt.mus.t += dt;
    if (kt.mus.t >= KT_SABIR) { kt.kacan++; kt.son = '✗ ' + kt.mus.ad + ' beklemekten sıkılıp gitti.'; kt.mus = null; kt.bekle = rng.range(2, 4); }
  }
  /** the café room sim (agents/kafe.ts) pulls its numbers from here and sells through here */
  const kafeHost = {
    live: false, pending: {} as Record<string, number>,
    info(id: string) { const q = plotOf(id); if (!q || !q.p || !q.a.sabit) return null; const ek = ekon(q.a, q.p); return { lv: q.p.lv, isci: flo(q.p.isci), stok: q.p.stok, tema: q.p.tema || '', fiyat: ek.fiyat * (1 + q.p.lv * 0.04), menu: ek.menu.map(x => x.ad) }; },
    sell(id: string, bonus = 1): number { const q = plotOf(id); if (!q || !q.p || q.p.stok < 1) return 0; const v = Math.round(ekon(q.a, q.p).fiyat * (1 + q.p.lv * 0.04) * bonus); q.p.stok -= 1; q.p.sat += 1; q.p.till += v; K.addXP(1); K.stat('kafeSatis'); return v; },
  };
  (rt as Record<string, unknown>).kafeHost = kafeHost;
  const plotOf = (id: string): { a: Arsa; p: Plot | undefined } | null => { const a = ARSALAR.find(x => x.id === id); return a ? { a, p: arsa().plots[id] } : null; };
  /** at the door, or anywhere inside the business (2026-11-09: every building is enterable) */
  const yakin = (ar: Arsa, extra = 0) => { if (dist(K.playerPos, arsaKapi(ar)) < KAPI_MENZIL + extra) return true; const m = icOfArsa(ar.id); return !!m && icIcinde(m, K.playerPos, -0.2); };
  const ownedN = () => ARSALAR.filter(a => !a.sabit && arsa().plots[a.id]).length;
  function arsaAl(id: string) {
    const q = plotOf(id); if (!q || q.p) return;
    if (S.level < q.a.seviye) { K.toast('Bu arsa ' + q.a.seviye + '. seviyede açılır.', 'info'); return; }
    if (!q.a.sabit && ownedN() >= ARSA_HAK) { K.toast('Karakter başına en fazla ' + ARSA_HAK + ' arsa hakkın var.', 'info'); return; }
    if (S.money < q.a.fiyat) { K.toast((q.a.sabit ? 'Kafe' : 'Arsa') + ' için ' + fmtMoney(q.a.fiyat) + ' lazım.', 'bad'); return; }
    if (q.a.sabit) {
      K.spend(q.a.fiyat); arsa().plots[id] = { tur: 'dukkan', tip: q.a.sabit, lv: 1, stok: 20, till: 0, sat: 0, fr: 0, isci: 0 };
      K.toast(isletmeOf(id).ikon + ' ' + (q.a.ad || 'İşletme') + ' senin! İçeri gir: alet al, stok al, işçi tut. İşçiler sen yokken rafı doldurur, satar.', 'good'); K.stat('mulkKuruldu'); K.addXP(60); K.saveNow(); return;
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
    const t = { maliyet: ekon(q.a, q.p).maliyet }, max = DUKKAN_STOK_MAX[q.p.lv];
    n = Math.min(n, max - flo(q.p.stok)); if (n < 1) { K.toast('Raf dolu. Yükseltirsen daha çok alır.', 'info'); return; }
    const c = n * t.maliyet; if (S.money < c) { n = Math.floor(S.money / t.maliyet); if (n < 1) { K.toast('Stok için para yok.', 'bad'); return; } }
    K.spend(Math.round(n * t.maliyet)); q.p.stok += n;
  }
  function yukselt(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'dukkan') return;
    if (q.p.lv >= DUKKAN_MAX_SEVIYE) { K.toast('En üst seviyedesin.', 'info'); return; }
    const t = DUKKAN_BY_ID[q.p.tip], y = dukkanYukselt(t, q.p.lv);
    for (const m in y.esya) if (have(m) < y.esya[m]) { K.toast('Eksik: ' + Object.entries(y.esya).map(([k, v]) => v + ' ' + nm(k)).join(', ') + ' (envanter / üretim)', 'info'); return; }
    if (S.money < y.tl) { K.toast('Yükseltme ' + fmtMoney(y.tl), 'bad'); return; }
    K.spend(y.tl); for (const m in y.esya) take(m, y.esya[m]); q.p.lv++;
    const yeni = q.a.sabit ? kafeMenu(q.a.id, q.p.lv).slice(kafeMenu(q.a.id, q.p.lv - 1).length).map(m => m.ikon + ' ' + m.ad).join(', ') : '';
    K.toast('⬆️ ' + (q.a.sabit ? (q.a.ad || t.ad) + ' artık ' + isletmeOf(id).asama[q.p.lv - 1] + '!' + (yeni ? ' Menüye girdi: ' + yeni + '.' : '') + ' Yeni aletler açıldı.' : t.ad + ' ' + q.p.lv + '. seviye!'), 'good'); K.addXP(40); K.saveNow();
  }
  function isciAl(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'dukkan') return;
    const n = flo(q.p.isci), mx = isciMaxOf(q.a, q.p); if (n >= mx) { K.toast('Bu seviyede en fazla ' + mx + ' işçi çalışır' + (q.a.sabit && mx < 6 ? ' (kafeyi yükselt)' : '') + '.', 'info'); return; }
    const f = isciFiyat(n); if (S.money < f) { K.toast('İşçi tutmak ' + fmtMoney(f) + '.', 'bad'); return; }
    K.spend(f); q.p.isci = n + 1; K.toast('👷 İşçi tutuldu (' + q.p.isci + '/' + mx + '). Saatlik ' + fmtMoney(ISCI_SAAT_UCRET) + ' kasadan ödenir.', 'good'); K.stat('isciTutuldu'); K.addXP(20); K.saveNow();
  }
  /** büfe salon equipment (2026-11-09): S.zones.salon.esya, read by sim/salon.ts for the hourly income */
  const salonZ = () => { const z = (S.zones.salon ||= {}) as unknown as { esya?: string[] }; z.esya ||= []; return z as { esya: string[] }; };
  function salonEsya(e: string) {
    const d = SALON_ESYA_BY_ID[e]; if (!d) return; const z = salonZ();
    if (z.esya.includes(e)) { K.toast('Salonda zaten var.', 'info'); return; }
    if ((S.stage || 1) < d.asama) { K.toast(d.ad + ' için büfe ' + d.asama + '. aşamada olmalı.', 'info'); return; }
    if (S.money < d.fiyat) { K.toast(d.ad + ' ' + fmtMoney(d.fiyat) + '.', 'bad'); return; }
    K.spend(d.fiyat); z.esya.push(e); K.toast(d.ikon + ' ' + d.ad + ' salona kuruldu: ' + d.desc, 'good'); K.addXP(20); K.saveNow();
  }
  const salonYakin = () => icIcinde(IC_BY_ID.salonW, K.playerPos, 0.3) && (S.stage || 1) >= 6 ? 'W' : icIcinde(IC_BY_ID.salonE, K.playerPos, 0.3) && (S.stage || 1) >= 7 ? 'E' : null;
  function evAc(id: string) {
    const q = plotOf(id); if (!q || !q.p || q.p.tur !== 'ev') return;
    if (dist(K.playerPos, arsaKapi(q.a)) > KAPI_MENZIL + 1.5) { K.toast('Evin kapısına yaklaş.', 'info'); return; }
    K.command({ kind: 'dekor2', arg: 'evOpen' });
  }

  // ── stadium ──
  const nearGate = () => dist(K.playerPos, STADYUM.kapi) < 5 || dist(K.playerPos, HALI_SAHA_KAPI) < 4.5;
  function bilet() {
    if (!nearGate()) { K.toast('Bileti Maç Koordinatörü verir: karşı yakada halı saha girişi (üst geçitten geç).', 'info'); return; }
    if (arsa().takim) { K.toast('⚽ ' + arsa().takim!.ad + ' sahaya çıkıyor! Lig maçı, bilet yok.', 'good'); }   // own club: no ticket, it's your match
    else { if (S.money < STADYUM.bilet) { K.toast('Bilet ' + fmtMoney(STADYUM.bilet) + '.', 'bad'); return; } K.spend(STADYUM.bilet); K.toast('🎟️ Bilet alındı! Maç başlıyor.', 'good'); }
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
      ktStep(ctx.dt);
      acc += ctx.dt; if (acc < 0.25) return;
      const dt = acc; acc = 0;
      const e = env(); if (e.gunluk.gun !== S.day) { rollBoard(S.day); faizGun(); }
      if (S.level > lastLevel) { for (let l = lastLevel; l < S.level; l++) onStat('seviye', 1); }
      lastLevel = S.level;
      const a = arsa(), h = K.hour(), dh = Math.max(0, Math.min(1, h >= a.lastH ? h - a.lastH : (24 - a.lastH) + (h - 8))); a.lastH = h;
      void dt;
      for (const ar of ARSALAR) {
        const p = a.plots[ar.id]; if (!p || p.tur !== 'dukkan') continue;
        const t0 = DUKKAN_BY_ID[p.tip], ek = ekon(ar, p), t = { ...t0, fiyat: ek.fiyat, maliyet: ek.maliyet }, isci = flo(p.isci);
        if (dh > 0 && isci > 0) {
          const ucret = isci * ISCI_SAAT_UCRET * dh; if (p.till >= ucret) p.till -= ucret;      // wages come out of the till
          const max = DUKKAN_STOK_MAX[p.lv]; if (p.stok < max * 0.25 && p.till >= t.maliyet * 10) { const n = Math.min(max - Math.floor(p.stok), Math.floor(p.till * 0.6 / t.maliyet)); if (n > 0) { p.till -= n * t.maliyet; p.stok += n; } }
        }
        if (ar.sabit && kafeHost.live && IC_CANLI.includes(ar.id) && dh > 0) {   // live room sim: customers walk in and get served by the player / hired workers
          if (p.stok > 0) { p.fr += dukkanMusteri(t, p.lv) * ek.musK * (1 + ISCI_MUSTERI * isci) * dh; const n = Math.floor(p.fr); p.fr -= n; if (n > 0) kafeHost.pending[ar.id] = Math.min(6, (kafeHost.pending[ar.id] || 0) + n); }
        } else if (dh > 0 && p.stok > 0) {
          p.fr += dukkanMusteri(t, p.lv) * ek.musK * (1 + ISCI_MUSTERI * isci) * dh; const n = Math.min(Math.floor(p.fr), p.stok); p.fr -= Math.floor(p.fr);
          if (n > 0) { p.stok -= n; p.sat += n; p.till += n * t.fiyat * (1 + p.lv * 0.04); }
        }
        if (p.till >= 1 && yakin(ar)) {
          const v = Math.floor(p.till); p.till -= v; if (K.earnTam) K.earnTam(v); else K.earn(v, arsaKapi(ar)); K.stat('mulkKasa');   // own business income, not a capped side faucet
          K.toast((ar.sabit ? isletmeOf(ar.id).ikon : t.ikon) + ' ' + (ar.ad || t.ad) + ' kasası: +' + fmtMoney(v), 'good');
        }
      }
    },
  });

  function handle(c: { kind: string; [k: string]: unknown }): boolean {
    if (c.kind !== 'mulk') return false;
    const op = String(c.op || ''), id = String(c.id ?? ''), n = flo(c.n);
    switch (op) {
      case 'kullan': kullan(id); break; case 'uret': uret(id); break; case 'sandikAc': sandikAc(id); break;
      case 'avmAl': avmAl(id); break; case 'ktAc': case 'ktKapat': case 'ktEkle': case 'ktTemizle': case 'ktVer': ktOp(op, id); break; case 'dersCevap': dersCevap(n); break; case 'dersBasla': if (okulYakin() && okulZ().soru < 0) okulSoru(); break;
      case 'krediAl': case 'krediOde': case 'tlYatir': case 'tlCek': case 'esyaYatir': case 'esyaCek': bankaOp(op, id, n); break;
      case 'gunlukAl': gunlukAl(id); break;
      case 'arsaAl': arsaAl(id); break; case 'arsaKur': arsaKur(id, String(c.tur ?? ''), String(c.tip ?? '')); break;
      case 'stokAl': stokAl(id, n || 10); break; case 'yukselt': yukselt(id); break; case 'evAc': evAc(id); break; case 'isciAl': isciAl(id); break; case 'kafeEsya': kafeEsya(id, String(c.e ?? '')); break; case 'tema': tema(id, String(c.e ?? '')); break; case 'salonEsya': salonEsya(String(c.e ?? id)); break;
      case 'bilet': bilet(); break;
      case 'izle': if (!nearGate()) { K.toast('Maçı izlemek için halı saha girişine git.', 'info'); break; } K.command({ kind: 'halisaha', op: 'izle', bahis: c.bahis, n: Number(c.n) || 0 } as never); break;
      // yönetici paneli (2026-11-08): kafe seviyesi / işçi / kulüp, kapı ve para şartı yok
      case 'adminKafe': { const q = plotOf(id); if (!q || !q.a.sabit) break; const lv = Math.max(0, Math.min(DUKKAN_MAX_SEVIYE, Math.round(n || 0))); if (!lv) delete arsa().plots[id]; else { q.p ? (q.p.lv = lv) : (arsa().plots[id] = { tur: 'dukkan', tip: q.a.sabit, lv, stok: 60, till: 0, sat: 0, fr: 0, isci: 0 }); } K.saveNow(); break; }
      case 'adminIsci': { const q = plotOf(id); if (q?.p && q.a.sabit) { q.p.isci = Math.min(isciMaxOf(q.a, q.p), flo(q.p.isci) + 1); K.saveNow(); } break; }
      case 'adminTakim': { const a = arsa(); if (!a.takim) { a.takim = { ad: String(c.name ?? '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Martıköy Spor', renk: '#2f7fb3', renk2: '#ffd23f', kurulus: S.day }; K.saveNow(); } break; }
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
      bankaYakin: nearBank(), kapiYakin: ARSALAR.find(x => a.plots[x.id] && yakin(x, 1.5))?.id || null,
      arsaYakin: ARSALAR.find(x => yakin(x, 1.5))?.id || null, okulYakin: okulYakin(), avmYakin: avmYakin(), ktYakin: ktYakin() && ktSahip() && !kt.on,
      kirtasiye: kt.on ? { mus: kt.mus ? { ad: kt.mus.ad, istek: { ...kt.mus.istek }, kalan: Math.max(0, 1 - kt.mus.t / KT_SABIR) } : null, sepet: { ...kt.sepet }, ciro: kt.ciro, sat: kt.sat, kacan: kt.kacan, son: kt.son, urun: KT_URUN } : null, salonYakin: salonYakin(), stadyumYakin: nearGate(), ipucuYakin: (rt.gizem as { view(): { yakin: string | null } } | undefined)?.view().yakin ?? null,
      plots: ARSALAR.map(x => ({ id: x.id, x: x.x, z: x.z, rotY: x.rotY, sabit: x.sabit || '', tur: a.plots[x.id]?.tur ?? null, tip: a.plots[x.id]?.tip || '', lv: a.plots[x.id]?.lv || 0, owned: !!a.plots[x.id], till: Math.floor(a.plots[x.id]?.till || 0), isci: flo(a.plots[x.id]?.isci), esya: a.plots[x.id]?.esya || [], tema: a.plots[x.id]?.tema || '' })),
    };
  }
  function model() {
    const e = env(), a = arsa(), b = banka();
    return {
      money: S.money, gold: S.gold, level: S.level, esya: { ...e.esya }, sandik: { ...e.sandik }, sans: e.sans, acilan: e.acilan, son: e.son,
      banka: { tl: b.tl, esya: { ...b.esya }, yakin: nearBank(), borc: Math.floor(arsa().kredi?.borc || 0), limit: KREDI_LIMIT(S.level), faiz: KREDI_FAIZ, mevduat: MEVDUAT_FAIZ },
      gunluk: e.gunluk.liste.map(h => ({ ...h })), gunlukSandik: e.gunluk.sandikAlindi,
      arsa: ARSALAR.map(x => { const p = a.plots[x.id]; return { id: x.id, ad: x.ad || '', sabit: x.sabit || '', fiyat: x.fiyat, seviye: x.seviye, owned: !!p, tur: p?.tur ?? null, tip: p?.tip || '', lv: p?.lv || 0, stok: Math.floor(p?.stok || 0), till: Math.floor(p?.till || 0), sat: Math.floor(p?.sat || 0), isci: flo(p?.isci), isciMax: isciMaxOf(x, p), isciFiyat: isciFiyat(flo(p?.isci)), menu: p && x.sabit ? ekon(x, p).menu : [], birim: p && p.tur === 'dukkan' ? Math.round(ekon(x, p).maliyet) : 0, menuSonraki: p && x.sabit ? kafeMenu(x.id, Math.min(5, p.lv + 1)).slice(kafeMenu(x.id, p.lv).length) : [], kesya: p && x.sabit ? (p.esya || []) : [], tema: p?.tema || '', musteriSaat: p && p.tur === 'dukkan' ? Math.round(dukkanMusteri(DUKKAN_BY_ID[p.tip], p.lv) * ekon(x, p).musK * (1 + ISCI_MUSTERI * flo(p.isci))) : 0,
        stokMax: p ? DUKKAN_STOK_MAX[p.lv] : 0, yakin: yakin(x, 1.5), ikon: x.sabit ? isletmeOf(x.id).ikon : '', asamaAd: x.sabit && p ? isletmeOf(x.id).asama[p.lv - 1] || '' : '', aletler: x.sabit ? isletmeOf(x.id).esya : [], yukselt: p && p.tur === 'dukkan' && p.lv < DUKKAN_MAX_SEVIYE ? dukkanYukselt(DUKKAN_BY_ID[p.tip], p.lv) : null }; }),
      avm: { yakin: avmYakin(), alinan: [...avmZ().alinan], urun: AVM_URUN },
      okul: (() => { const o = okulZ(), w = o.soru >= 0 ? OKUL_KELIME[o.soru] : null; return { soru: w ? w[0] : '', secenek: o.secenek.map(i => OKUL_KELIME[i][1]), cevap: o.cevap, dogru: o.dogru, sinav: OKUL_SINAV, son: o.son, sinavlar: [...o.sinavlar], genel: o.sinavlar.length ? Math.round(o.sinavlar.reduce((a, b) => a + b, 0) / o.sinavlar.length) : 0, yakin: okulYakin() }; })(),
      gizem: (rt.gizem as { model(): unknown } | undefined)?.model() ?? null,
      lig: (rt.lig as { model(): unknown } | undefined)?.model() ?? null,
      salon: (() => { const st = S.stage || 1, d = salonOf(st), k = salonKat(salonZ().esya, st); return { stage: st, esya: [...salonZ().esya], liste: SALON_ESYA, yakin: salonYakin(), misSaat: Math.round(d.mis * k.mis), adisyon: Math.round(d.adisyon * k.adis), ekip: d.ekip }; })(),
      hak: ARSA_HAK, sahip: ownedN(), takim: a.takim, stad: a.takim ? (() => { const s = stadSave(a as never), z = (S.zones.halisaha as { form?: string[] } | undefined)?.form || []; return { ...s, tahmin: tahminDoluluk(s.fiyat, z), kapasite: KAPASITE, min: FIYAT_MIN, max: FIYAT_MAX, formaylar: FORMASYONLAR }; })() : null, stadyum: { ...STADYUM, yakin: nearGate() },
    };
  }
  const api = { handle, view, model, give, have };
  rt.mulk = api;
  return api;
}
export type MulkApi = ReturnType<typeof installMulk>;
export const mulkApi = (r: { rt: unknown } | null | undefined): MulkApi | null => (r ? ((r.rt as { mulk?: MulkApi }).mulk || null) : null);
