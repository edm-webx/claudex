/**
 * İşletme sarı kareleri: büfenin sarı karesiyle aynı akış (sim/pads.ts, görünüm view/world/rtview.ts): üstünde durunca cepten para
 * akar, dolunca açılır. Ödenen para S.padPaid[key] içinde kalır (yarım bırakılan kare kaydedilir, büfeyle aynı alan).
 *
 * Geçmiş: 2026-11-21 18:46 sahip (AVM): "dükkânlarda para yatırıp alet alacağımız, büfedeki gibi kareler". 2026-11-21 21:07 sahip:
 * "avm dışında diğer satın alınabilen tüm dükkanlarda parayla açacağımız kareler olsun, dükkanın içeriğine göre". Bu modül hepsini
 * tek yerden kurar (eski adı avm-kareler.ts):
 *  - satın alma karesi: AVM'de dükkân kapısının önünde (holde), sokaktaki dükkânlarda kapının yanında kaldırımda. Dolunca dükkân
 *    senin (mulk arsaAl). Sıra content/acilis.ts: büfe aşaması / önceki dükkân gelmeden kare yok; gelince kilitli görünür, eksiği yazar
 *    (yıldız, esnaf seviyesi, görev sayacı), koşullar tamamlanınca para alır. Tadilat karesi de büfe aşamasına bağlı.
 *  - alet kareleri: sahip olunan dükkânın sıradaki iki aleti (seviyesi yeten, en ucuzdan; her işletmenin kendi listesi: kafede
 *    espresso makinesi, bistroda kömür ızgara, kırtasiyede fotokopi...). AVM'de dükkânın içinde, sokakta kapının iki yanında.
 *  - tadilat karesi: o seviyenin bütün aletleri alınınca bir sonraki aşamaya tadilat (mulk yukselt, süreli; dükkân çalışmaya devam).
 *  - büfe salonları (iskele): kahvaltı / balık salonu kurulunca salon aletleri de kareyle (mulk salonEsya), salonun kapısının önünde.
 * Anahtarlar: AVM 'avm.<arsa>[.<alet>]', sokak 'isl.<arsa>[.<alet>|.tadilat]', salon 'salon.<alet>'.
 * Kare oyuncunun katında çalışır (AVM katları); sokak kareleri kat taşımaz (görünüm kök gruba çizer).
 */
import type { Vec2 } from '../../engine/api';
import { ARSALAR, ISLETME, ARSA_ISLETME, SALON_ESYA, DUKKAN_MAX_SEVIYE, type Arsa } from '../../content/esya';
import { icOfArsa, icWorld, icDim, icLayout, icItemRect, icZeminEngeli, IC_DUVAR, IC_BY_ID, mutfakDunya, mutfakStand, icItemOn, type IcMekan } from '../../content/ic-mekan';
import { mutfakAcik, istasyonFiyat, MUTFAK_HAZIR, MUTFAK_IST_BY_ID, MUTFAK_YER_SIRA } from '../../content/mutfak';
import { kanatAcik, kanatOf, masaHediye, masaFiyat, catiAyak, BOLGE_AD } from '../../content/kanat';
import { HOL, katY } from '../../content/avm-kat';
import type { Kernel, PadRt } from './state';
import { misafirKare } from './pads';
import { acilisEksik, acilisGorunur, tadilatEksik, kilitYazi, type AcilisDurum } from '../../content/acilis';

interface Plot { lv: number; esya?: string[]; tadilat?: unknown }
export interface IsletmeKareApi {
  arsaAl(id: string): void; kafeEsya(id: string, e: string): void; plot(id: string): Plot | undefined;
  yukselt?(id: string): void; yukFiyat?(id: string): number; asamaAd?(id: string, lv: number): string;
  salonEsya?(e: string): void; salonVar?(): string[];
  /** 2026-11-22 restoran mutfağı: istasyon satın al / alınmış istasyonlar */
  mutfakAl?(id: string): void; mutfakVar?(): string[];
  /** 2026-11-22 kanat / salon / çatı masaları: masa satın al / alınmış masalar (sim masa indexi) */
  masaAl?(i: number): void; masaVar?(): number[];
  /** açılış sırası durumu (content/acilis.ts); yoksa her şey açık sayılır (eski testler / araçlar) */
  durum?(): AcilisDurum;
}
interface Kare { key: string; pos: Vec2; kat?: number; y?: number; label: string; sub: string; price: number; kilit: string; done: () => void }

const ROOMS: { m: IcMekan; a: Arsa }[] = ARSALAR.filter(a => a.sabit && icOfArsa(a.id)).map(a => ({ a, m: icOfArsa(a.id)! }));
const avmMi = (m: IcMekan) => m.bina === 'avm';
const adOf = (a: Arsa) => (a.ad || '').replace(' (AVM)', '');
/** AVM satın alma karesi: dükkân kapısının önünde, holün yürüyüş yolunda */
export const satisKaresi = (a: Arsa): Vec2 => ({ x: a.x < (HOL.x0 + HOL.x1) / 2 ? HOL.x0 + 1.15 : HOL.x1 - 1.15, z: a.z });
/** AVM alet kareleri: dükkânın müşteri tarafında, kapının iki yanında */
export const aletKaresi = (m: IcMekan, i: number): Vec2 => icWorld(m, i ? 1.7 : -1.7, icDim(m).D / 2 - 1.95);

/**
 * Sokak dükkânının dışındaki kare yerleri (oda çerçevesi: u kapı duvarı boyunca, v dışarı doğru). Kapının önü (|u| < 1.2) boş kalır,
 * yürüyüş yolu kapanmasın. Aday yerler kapıdan dışa doğru sıralı; `bos` kare izinin (1.5 m) tamamı yürünebilir mi der (nav).
 * İlk 3 boş yer: 0 = satın alma / tadilat; dükkânın içinde yer yoksa aletler 0-1 (kapının iki yanı; satın alma karesi o an yok, tadilat
 * karesi aynı yere çıkarsa oyuncu inmeden para çekmez). 2 = salonlarda. Yer bulunamazsa (nav henüz yok) kapının iki yanına sabit konur.
 */
/** karşı yaka kaldırımı / meydan taşı zeminin üstünde (kr.pave ~0.08 m): kare onun altında kalıp görünmez olmasın */
export const SOKAK_Y = 0.11;
/** elle seçilmiş yerler (dünya x, z). 2026-11-23 sahip: "meydan kafe'nin kareleri neden dışarıda, kaç metre uzakta?" Kafelerin
 *  kareleri meydanın ortasındaydı (kapıdan 7,3-7,9 m, bankların yanında). Kapının iki yanı terasın şemsiyeli masaları (kareyi örter):
 *  satın alma / tadilat karesi kapının tam önünde, şemsiyelerin arasında [0]; alet kareleri dükkânın İÇİNDE (icKareYerleri), [1], [2]
 *  yalnız içeride yer yoksa (şemsiye sırasının önü). Büfe salonları: önlerindeki çit ve saksı sırası; E terasın yan kenarı, W terasın ucu. */
const DIS_YER: Record<string, Vec2[]> = {
  kafe1: [{ x: -13.0, z: 37.9 }, { x: -9.8, z: 36.0 }, { x: -9.8, z: 39.8 }],
  kafe2: [{ x: -13.0, z: 51.5 }, { x: -9.8, z: 49.6 }, { x: -9.8, z: 53.4 }],
};
/**
 * 2026-11-23: sokak dükkânının alet kareleri dükkânın içinde, müşteri tarafında (AVM'deki gibi). Kare hiçbir zemin eşyasına (alınmamış
 * aletler dahil; masaların çevresi sandalye payıyla) binmez, tezgâh önündeki kuyruk bandına girmez, tezgâhın boyunu çok aşmaz (okulda
 * kantin yarısında kalır, sınıfa geçmez). Kapıya en yakın, aralarında 1.6 m olan yerler. Yer yoksa boş (dışarıdaki yerler kullanılır).
 * Kapıdan tezgâha giden yolun üstüne gelebilir: kare yürürken para çekmez (durunca çeker), büfedeki gibi.
 */
const icYerCache = new Map<string, Vec2[]>();
export function icKareYerleri(m: IcMekan, n = 2): Vec2[] {
  const ck = m.id + ':' + n, c0 = icYerCache.get(ck); if (c0) return c0;
  const { W, D } = icDim(m), lay = icLayout(m), tz = lay.find(i => i.k === 'tezgah'), out: Vec2[] = [];
  if (!tz) { icYerCache.set(ck, out); return out; }
  const vert = (tz.ry || 0) % 2 === 1, tr = icItemRect(tz), H = 0.72, kenar = IC_DUVAR + H + 0.03;
  const engel = lay.filter(i => icZeminEngeli(i)).map(i => { const r = icItemRect(i), e = i.k.startsWith('masa') ? 0.3 : 0.03; return { u0: r.u0 - e, u1: r.u1 + e, v0: r.v0 - e, v1: r.v1 + e }; });
  const a0 = vert ? tr.v0 : tr.u0, a1 = vert ? tr.v1 : tr.u1, aday: { u: number; v: number; d: number }[] = [];
  for (let u = -W / 2 + kenar; u <= W / 2 - kenar + 1e-6; u += 0.05) for (let v = -D / 2 + kenar; v <= D / 2 - kenar + 1e-6; v += 0.05) {
    if (vert ? u + H > tz.u - 1.45 : v - H < tz.v + 1.45) continue;   // kuyruk bandı (müşteri tezgâh merkezinden 1.15 m'de durur)
    const a = vert ? v : u; if (a < a0 - 1.0 || a > a1 + 1.0) continue;   // tezgâhın yanında kal
    if (engel.some(r => u + H > r.u0 && u - H < r.u1 && v + H > r.v0 && v - H < r.v1)) continue;
    aday.push({ u, v, d: Math.hypot(u, v - D / 2) });
  }
  aday.sort((p, q) => p.d - q.d);
  const uv: { u: number; v: number }[] = [];
  for (const c of aday) {
    if (out.length >= n) break;
    if (uv.every(q => Math.hypot(q.u - c.u, q.v - c.v) >= 1.6)) { uv.push(c); out.push(icWorld(m, +c.u.toFixed(2), +c.v.toFixed(2))); }
  }
  if (out.length < n) out.length = 0;   // ikisi birden içeride değilse ikisi de dışarıda (biri içeride biri dışarıda karışık durmasın)
  icYerCache.set(ck, out); return out;
}
export function disKareYerleri(m: IcMekan, bos?: (p: Vec2) => boolean): Vec2[] {
  if (DIS_YER[m.id]) return DIS_YER[m.id];
  const { W, D } = icDim(m), out: Vec2[] = [], uMax = Math.max(2.2, W / 2 + 0.6);
  const aday: [number, number][] = [];
  for (const v of [1.25, 2.05, 2.85]) for (let u = 1.95; u <= uMax + 1e-6; u += 0.4) { aday.push([u, v], [-u, v]); }
  const uzak = (p: Vec2) => out.every(q => Math.hypot(q.x - p.x, q.z - p.z) >= 1.75);
  const ok = (u: number, v: number) => { if (!bos) return true; for (const [du, dv] of [[0, 0], [-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) if (!bos(icWorld(m, u + du, D / 2 + v + dv))) return false; return true; };
  for (const [u, v] of aday) { if (out.length >= 3) break; const p = icWorld(m, u, D / 2 + v); if (uzak(p) && ok(u, v)) out.push(p); }
  if (out.length < 3) for (const [u, v] of [[-2.1, 1.3], [2.1, 1.3], [2.1, 3.1]] as [number, number][]) { const p = icWorld(m, u, D / 2 + v); if (out.length < 3 && uzak(p)) out.push(p); }
  return out;
}

export function installIsletmeKareler(K: Kernel, api: IsletmeKareApi): { sync(): void } {
  const S = K.state, rt = K.rt, ids = new Map<string, PadRt>(), uyari = new Map<string, number>();
  const katim = () => (K.playerPos as { kat?: number }).kat || 0;
  /** 2026-11-23: bir kare dolunca sıradaki kare aynı yere çıkabiliyor (alet, tadilat); oyuncu kareden inmeden o yeni kare para çekmez */
  //  (canAct yalnız oyuncu bir karenin içindeyken sorulur: bir süre sorulmadıysa oyuncu inmiş demektir)
  let sonDolan: Vec2 | null = null, sonSoru = 0;
  const inmedi = () => {
    if (!sonDolan) return false;
    const gitti = S.playT - sonSoru > 0.3 || Math.hypot(K.playerPos.x - sonDolan.x, K.playerPos.z - sonDolan.z) > 1.1; sonSoru = S.playT;
    if (gitti) { sonDolan = null; return false; } return true;
  };
  const nav = (K as unknown as { nav?: { walkable(p: Vec2): boolean } }).nav;
  const yerCache = new Map<string, Vec2[]>();
  /** dış kare yerleri bir kez hesaplanır (nav yüklüyse: kapı noktası yürünebilir olmalı, yoksa sonra yeniden denenir) */
  const yerler = (m: IcMekan): Vec2[] => {
    let y = yerCache.get(m.id); if (y) return y;
    const bos = nav && nav.walkable(icWorld(m, 0, icDim(m).D / 2 + 1)) ? (p: Vec2) => nav.walkable(p) : undefined;
    y = disKareYerleri(m, bos); if (bos) yerCache.set(m.id, y); return y;
  };
  function istenen(): Kare[] {
    const out: Kare[] = [];
    for (const { m, a } of ROOMS) {
      const avm = avmMi(m), kat = avm ? m.kat || 0 : undefined, p = api.plot(a.id), ad = adOf(a), pre = (avm ? 'avm.' : 'isl.') + a.id;
      const yer = avm ? null : yerler(m), ic = avm ? [] : icKareYerleri(m), y = avm ? undefined : SOKAK_Y;
      if (!p) {
        // sıralı açılma (content/acilis.ts): büfe o aşamaya gelmeden / sıradaki önceki dükkân alınmadan kare hiç çıkmaz; çıkınca eksik koşulu yazar
        const d = api.durum?.(); if (d && !acilisGorunur(a, d)) { const yarim = Number(S.padPaid[pre]) || 0; if (yarim > 0) { S.money = Math.round((S.money + yarim) * 100) / 100; delete S.padPaid[pre]; } continue; }   // AR-GE: sıralı açılmadan önce yarım ödenmiş, şimdi gizli kare: para iade (eski kayıt)
        const kilit = d ? kilitYazi(acilisEksik(a, d)) : '';
        out.push({ key: pre, pos: avm ? satisKaresi(a) : yer![0], kat, label: (avm ? '' : ISLETME[ARSA_ISLETME[a.id]].ikon + ' ') + ad, sub: kilit || 'Dükkânı satın al', price: a.fiyat, kilit, y, done: () => api.arsaAl(a.id) });
        continue;
      }
      if (p.tadilat) continue;
      const own = p.esya || [], t = ISLETME[ARSA_ISLETME[a.id]];
      const sira = t.esya.filter(e => !own.includes(e.id) && e.lv <= p.lv).sort((x, y) => x.fiyat - y.fiyat).slice(0, 2);
      sira.forEach((e, i) => out.push({ key: pre + '.' + e.id, pos: avm ? aletKaresi(m, i) : ic[i] || yer![i], kat, label: e.ikon + ' ' + e.ad, sub: e.desc, price: e.fiyat, kilit: '', y, done: () => api.kafeEsya(a.id, e.id) }));
      // o seviyenin aletleri bitti: sıradaki aşamaya tadilat (sokak dükkânları; AVM'de yer kapının önündeki satış karesinin yeri)
      if (!sira.length && p.lv < DUKKAN_MAX_SEVIYE && api.yukselt && api.yukFiyat) {
        const sonraki = api.asamaAd?.(a.id, p.lv + 1) || (p.lv + 1) + '. seviye';
        const d = api.durum?.(), kilit = d ? kilitYazi(tadilatEksik(a.id, p.lv + 1, d)) : '';
        out.push({ key: pre + '.tadilat', pos: avm ? satisKaresi(a) : yer![0], kat, label: '🔨 Tadilat: ' + sonraki, sub: kilit || ad + ' büyür, yeni aletler açılır', price: api.yukFiyat(a.id), kilit, y, done: () => api.yukselt!(a.id) });
      }
    }
    // ters U kanatları (iskele): açık kanadın sıradaki iki aleti, aletin duracağı yerin önünde
    if (api.salonEsya && api.salonVar) {
      const own = new Set(api.salonVar()), st = S.stage || 1;
      for (const [k, room, asama] of [['W', 'salonW', 6], ['E', 'salonE', 7]] as const) {
        if (st < asama) continue; const m = IC_BY_ID[room]; if (!m) continue;
        const sira = SALON_ESYA.filter(e => e.salon === k && !own.has(e.id) && e.asama <= st).sort((x, y) => x.fiyat - y.fiyat).slice(0, 2), lay = icLayout(m, st);
        for (const e of sira) { const it = lay.find(q => q.esya === e.id); if (it) out.push({ key: 'salon.' + e.id, pos: icItemOn(m, it), y: SOKAK_Y + 0.05, label: e.ikon + ' ' + e.ad, sub: e.desc, price: e.fiyat, kilit: '', done: () => api.salonEsya!(e.id) }); }   // 2026-11-25: kare aletin kendi yerinde
      }
    }
    // 2026-11-22 restoran mutfağı (sahibi: "karelerle tek tek açılan istasyonlar yok"): aşamanın açtığı istasyonlar mutfağın içinde,
    // istasyonun kendi yerinin önünde (aşçının durduğu koridor noktası) sarı kareyle tek tek alınır; aynı anda en çok iki kare, üst üste binmez
    if (api.mutfakAl && api.mutfakVar) {
      const own = new Set(api.mutfakVar()), st = S.stage || 1, konan: Vec2[] = [];
      const sira = mutfakAcik(st).filter(id => !own.has(id) && !MUTFAK_HAZIR.includes(id)).sort((a, b) => (MUTFAK_IST_BY_ID[a].stage - MUTFAK_IST_BY_ID[b].stage) || (MUTFAK_YER_SIRA.indexOf(a) - MUTFAK_YER_SIRA.indexOf(b)));
      for (const id of sira) {
        if (konan.length >= 2) break;
        const pos = mutfakDunya(mutfakStand(id)); if (konan.some(q => Math.hypot(q.x - pos.x, q.z - pos.z) < 1.75)) continue;
        konan.push(pos); const d = MUTFAK_IST_BY_ID[id];
        out.push({ key: 'mutfak.' + id, pos, label: '🍳 ' + d.ad, sub: 'Mutfak istasyonu: kendi yemeklerini burada pişirir', price: istasyonFiyat(id), kilit: '', done: () => api.mutfakAl!(id) });
      }
    }
    // 2026-11-22 (sahibi: "sağda solda farklı restoran gibi görünen her yere masa alalım tek tek sarı karelerle"): her bölgenin sıradaki
    // masası, masanın kendi yerinde sarı kare (bölgenin ilk masası hediye); çatı masalarının karesi merdivenin ayağında (oyuncu çıkmaz)
    if (api.masaAl && api.masaVar) {
      const own = new Set(api.masaVar()), st = S.stage || 1, bolgeler = new Set<string>();
      for (const i of kanatAcik(st)) {
        const m = kanatOf(i)!; if (own.has(i) || masaHediye(i) || bolgeler.has(m.bolge)) continue;
        bolgeler.add(m.bolge);
        const pos = m.cati ? { x: catiAyak(m.cati).x, z: catiAyak(m.cati).z + 0.9 } : { x: m.x, z: m.z };
        out.push({ key: 'masa.' + i, pos, y: m.bolge === 'salonW' ? SOKAK_Y + 0.05 : undefined, label: m.cati ? '🪑 ÇATI MASASI' : '🪑 MASA', sub: m.cati ? 'Çatı terası masası: burada al' : BOLGE_AD[m.bolge], price: masaFiyat(i), kilit: '', done: () => api.masaAl!(i) });
      }
    }
    return out;
  }
  function ekle(k: Kare) {
    const pr: PadRt = { key: k.key, price: k.price, paid: S.padPaid[k.key] || 0, pos: k.pos, kind: 'isletme', warned: false, label: k.label, sub: k.sub };
    if (k.kat !== undefined) { pr.y = katY(k.kat); pr.kat = k.kat; pr.kind = 'avm'; } else if (k.y) pr.y = k.y;
    rt.pads.push(pr); ids.set(k.key, pr);
    K.interactions.register({
      id: 'pad.' + k.key, pos: k.pos, radius: 0.8, kind: 'pad', dwell: 0, interval: 0.05,
      canAct: () => rt.pads.includes(pr) && katim() === (k.kat || 0) && !inmedi(),
      act: () => {
        if (misafirKare(K)) return 'done';
        if (k.kilit) { if (S.playT - (uyari.get(k.key) ?? -99) > 6) { uyari.set(k.key, S.playT); K.toast(k.label + ': önce ' + k.kilit.replace('🔒 ', '') + '.', 'bad'); } return 'done'; }   // 'bad': sessizlik süzgecine (aynı cümle 60 sn) takılmasın, her basışta söylesin
        const paid = S.padPaid[k.key] || 0, left = pr.price - paid;
        if (S.money < 1) { if (!pr.warned) { pr.warned = true; K.toast('Para lazım: satış yap, kasayı topla.', 'info'); } return 'continue'; }
        const amt = Math.min(Math.max(pr.price / 1.2, 250) * 0.05, S.money, left);
        S.money -= amt; S.padPaid[k.key] = paid + amt; pr.paid = S.padPaid[k.key];
        if (S.padPaid[k.key] < pr.price - 0.01) return 'continue';
        // full: hand the money back and buy through the normal path (same checks, toast, XP, save); a refused buy keeps it in the pocket
        S.money = Math.round((S.money + S.padPaid[k.key]) * 100) / 100; delete S.padPaid[k.key]; pr.paid = 0;
        sonDolan = { x: K.playerPos.x, z: K.playerPos.z }; sonSoru = S.playT; k.done(); if (k.kat === undefined) (rt.uiLast as Record<string, unknown>).decorFocus = { x: k.pos.x, z: k.pos.z, until: S.playT + 2.2 };   // sokakta altın ışık sütunu: burada bir şey açıldı
        sync(); return 'done';
      },
    });
  }
  function sil(key: string) {
    const pr = ids.get(key); if (!pr) return; ids.delete(key);
    const i = rt.pads.indexOf(pr); if (i >= 0) rt.pads.splice(i, 1);
    K.interactions.unregister('pad.' + key);
  }
  /** sıralı açılma anları (content/acilis.ts): sıradaki dükkânın karesi ilk kez çıkınca ve kilidi açılınca bir kez söyle, ışık sütunu yak, ses çal (S.tut, kayıtta kalır) */
  function an(k: Kare) {
    if (!/^(isl|avm)\.k\d+$/.test(k.key) || (rt as { acilisSerbest?: boolean }).acilisSerbest) return;   // yönetici / test kurulumunda kutlama yok
    const ad = k.label.replace(/^\S+ /, ''), yer = k.kat !== undefined ? ' (Martı AVM)' : '';
    const yak = () => { if (k.kat === undefined) (rt.uiLast as Record<string, unknown>).decorFocus = { x: k.pos.x, z: k.pos.z, until: S.playT + 3.5 }; };
    if (!S.tut['acGor_' + k.key]) {
      S.tut['acGor_' + k.key] = 1; if (!k.kilit) S.tut['acAc_' + k.key] = 1;
      K.toast(k.kilit ? '🆕 Holding yolunda sıradaki dükkân: ' + ad + yer + '. Kapısındaki karede ne lazım yazıyor.' : '🆕 ' + ad + yer + ' satılık! Kapısındaki sarı kareye yürü.', 'good');
      K.logEv('dukkanKare', { key: k.key, x: k.pos.x, z: k.pos.z }); yak();
    } else if (!k.kilit && !S.tut['acAc_' + k.key]) {
      S.tut['acAc_' + k.key] = 1;
      K.toast('🔓 ' + ad + yer + ' artık satılık! Bütün koşulları tamamladın.', 'good');
      K.logEv('dukkanSatilik', { key: k.key, x: k.pos.x, z: k.pos.z }); yak();
    }
  }
  function sync() {
    const want = istenen(), keys = new Set(want.map(k => k.key));
    for (const k of want) an(k);
    for (const key of [...ids.keys()]) if (!keys.has(key)) sil(key);
    for (const k of want) { const have = ids.get(k.key); if (!have) ekle(k); else if (have.sub !== k.sub || have.price !== k.price || have.pos.x !== k.pos.x || have.pos.z !== k.pos.z) { sil(k.key); ekle(k); } }
  }
  return { sync };
}
