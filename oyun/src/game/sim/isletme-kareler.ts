/**
 * İşletme sarı kareleri: büfenin sarı karesiyle aynı akış (sim/pads.ts, görünüm view/world/rtview.ts): üstünde durunca cepten para
 * akar, dolunca açılır. Ödenen para S.padPaid[key] içinde kalır (yarım bırakılan kare kaydedilir, büfeyle aynı alan).
 *
 * Geçmiş: 2026-11-21 18:46 sahip (AVM): "dükkânlarda para yatırıp alet alacağımız, büfedeki gibi kareler". 2026-11-21 21:07 sahip:
 * "avm dışında diğer satın alınabilen tüm dükkanlarda parayla açacağımız kareler olsun, dükkanın içeriğine göre". Bu modül hepsini
 * tek yerden kurar (eski adı avm-kareler.ts):
 *  - satın alma karesi: AVM'de dükkân kapısının önünde (holde), sokaktaki dükkânlarda kapının yanında kaldırımda. Dolunca dükkân
 *    senin (mulk arsaAl). Kilitliyse kare görünür ama para almaz, nedenini yazar (seviye / önce başka dükkân).
 *  - alet kareleri: sahip olunan dükkânın sıradaki iki aleti (seviyesi yeten, en ucuzdan; her işletmenin kendi listesi: kafede
 *    espresso makinesi, bistroda kömür ızgara, kırtasiyede fotokopi...). AVM'de dükkânın içinde, sokakta kapının iki yanında.
 *  - tadilat karesi: o seviyenin bütün aletleri alınınca bir sonraki aşamaya tadilat (mulk yukselt, süreli; dükkân çalışmaya devam).
 *  - büfe salonları (iskele): kahvaltı / balık salonu kurulunca salon aletleri de kareyle (mulk salonEsya), salonun kapısının önünde.
 * Anahtarlar: AVM 'avm.<arsa>[.<alet>]', sokak 'isl.<arsa>[.<alet>|.tadilat]', salon 'salon.<alet>'.
 * Kare oyuncunun katında çalışır (AVM katları); sokak kareleri kat taşımaz (görünüm kök gruba çizer).
 */
import type { Vec2 } from '../../engine/api';
import { ARSALAR, ISLETME, ARSA_ISLETME, SALON_ESYA, DUKKAN_MAX_SEVIYE, type Arsa } from '../../content/esya';
import { icOfArsa, icWorld, icDim, IC_BY_ID, type IcMekan } from '../../content/ic-mekan';
import { HOL, katY } from '../../content/avm-kat';
import type { Kernel, PadRt } from './state';

interface Plot { lv: number; esya?: string[]; tadilat?: unknown }
export interface IsletmeKareApi {
  arsaAl(id: string): void; kafeEsya(id: string, e: string): void; plot(id: string): Plot | undefined;
  yukselt?(id: string): void; yukFiyat?(id: string): number; asamaAd?(id: string, lv: number): string;
  salonEsya?(e: string): void; salonVar?(): string[];
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
 * İlk 3 boş yer: 0 = satın alma / tadilat, 1-2 = aletler. Yer bulunamazsa (nav henüz yok) kapının iki yanına sabit konur.
 */
/** karşı yaka kaldırımı / meydan taşı zeminin üstünde (kr.pave ~0.08 m): kare onun altında kalıp görünmez olmasın */
export const SOKAK_Y = 0.11;
/** elle seçilmiş yerler (dünya x, z): kafelerin önü kendi terası ve şemsiyeleriyle dolu (prefab kr.kafe1/2 + karsi-yasam teras),
 *  kareler terasın ötesinde meydanın taşına, oturma banklarının arasına gelir */
const DIS_YER: Record<string, Vec2[]> = {
  kafe1: [{ x: -7.0, z: 36.0 }, { x: -7.0, z: 39.8 }, { x: -7.0, z: 41.6 }],
  kafe2: [{ x: -7.0, z: 49.6 }, { x: -7.0, z: 53.4 }, { x: -7.0, z: 47.8 }],
  // büfe salonları: önlerindeki çit ve saksı sırası kareyi örtüyordu; E terasın yan kenarına, W (yanında büfe bahçesinin çiti var) terasın önüne (0 = kullanılmaz, salon satın alınmaz)
  salonW: [{ x: -21.4, z: -6.2 }, { x: -19.4, z: -2.7 }, { x: -15.8, z: -2.7 }],
  salonE: [{ x: 21.4, z: -6.2 }, { x: 11.8, z: -7.9 }, { x: 11.8, z: -6.1 }],
};
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
  const S = K.state, rt = K.rt, ids = new Map<string, PadRt>(), uyari = new Set<string>();
  const katim = () => (K.playerPos as { kat?: number }).kat || 0;
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
      const yer = avm ? null : yerler(m), y = avm ? undefined : SOKAK_Y;
      if (!p) {
        const once = a.once ? ARSALAR.find(x => x.id === a.once) : undefined;
        const kilit = S.level < a.seviye ? '🔒 ' + a.seviye + '. seviye' : once && !api.plot(once.id) ? '🔒 önce ' + adOf(once) : '';
        out.push({ key: pre, pos: avm ? satisKaresi(a) : yer![0], kat, label: (avm ? '' : ISLETME[ARSA_ISLETME[a.id]].ikon + ' ') + ad, sub: kilit || 'Dükkânı satın al', price: a.fiyat, kilit, y, done: () => api.arsaAl(a.id) });
        continue;
      }
      if (p.tadilat) continue;
      const own = p.esya || [], t = ISLETME[ARSA_ISLETME[a.id]];
      const sira = t.esya.filter(e => !own.includes(e.id) && e.lv <= p.lv).sort((x, y) => x.fiyat - y.fiyat).slice(0, 2);
      sira.forEach((e, i) => out.push({ key: pre + '.' + e.id, pos: avm ? aletKaresi(m, i) : yer![1 + i], kat, label: e.ikon + ' ' + e.ad, sub: e.desc, price: e.fiyat, kilit: '', y, done: () => api.kafeEsya(a.id, e.id) }));
      // o seviyenin aletleri bitti: sıradaki aşamaya tadilat (sokak dükkânları; AVM'de yer kapının önündeki satış karesinin yeri)
      if (!sira.length && p.lv < DUKKAN_MAX_SEVIYE && api.yukselt && api.yukFiyat) {
        const sonraki = api.asamaAd?.(a.id, p.lv + 1) || (p.lv + 1) + '. seviye';
        out.push({ key: pre + '.tadilat', pos: avm ? satisKaresi(a) : yer![0], kat, label: '🔨 Tadilat: ' + sonraki, sub: ad + ' büyür, yeni aletler açılır', price: api.yukFiyat(a.id), kilit: '', y, done: () => api.yukselt!(a.id) });
      }
    }
    // büfe salonları (iskele): kurulu salonun sıradaki iki aleti, salon kapısının önünde
    if (api.salonEsya && api.salonVar) {
      const own = new Set(api.salonVar()), st = S.stage || 1;
      for (const [k, room, asama] of [['W', 'salonW', 6], ['E', 'salonE', 7]] as const) {
        if (st < asama) continue; const m = IC_BY_ID[room]; if (!m) continue;
        const sira = SALON_ESYA.filter(e => e.salon === k && !own.has(e.id) && e.asama <= st).sort((x, y) => x.fiyat - y.fiyat).slice(0, 2), yer = yerler(m);
        sira.forEach((e, i) => out.push({ key: 'salon.' + e.id, pos: yer[1 + i], label: e.ikon + ' ' + e.ad, sub: e.desc, price: e.fiyat, kilit: '', done: () => api.salonEsya!(e.id) }));
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
      canAct: () => rt.pads.includes(pr) && katim() === (k.kat || 0),
      act: () => {
        if (k.kilit) { if (!uyari.has(k.key)) { uyari.add(k.key); K.toast(k.label + ': ' + k.kilit.replace('🔒 ', '') + ' gerekli.', 'info'); } return 'done'; }
        const paid = S.padPaid[k.key] || 0, left = pr.price - paid;
        if (S.money < 1) { if (!pr.warned) { pr.warned = true; K.toast('Para lazım: satış yap, kasayı topla.', 'info'); } return 'continue'; }
        const amt = Math.min(Math.max(pr.price / 1.2, 250) * 0.05, S.money, left);
        S.money -= amt; S.padPaid[k.key] = paid + amt; pr.paid = S.padPaid[k.key];
        if (S.padPaid[k.key] < pr.price - 0.01) return 'continue';
        // full: hand the money back and buy through the normal path (same checks, toast, XP, save); a refused buy keeps it in the pocket
        S.money = Math.round((S.money + S.padPaid[k.key]) * 100) / 100; delete S.padPaid[k.key]; pr.paid = 0;
        k.done(); if (k.kat === undefined) (rt.uiLast as Record<string, unknown>).decorFocus = { x: k.pos.x, z: k.pos.z, until: S.playT + 2.2 };   // sokakta altın ışık sütunu: burada bir şey açıldı
        sync(); return 'done';
      },
    });
  }
  function sil(key: string) {
    const pr = ids.get(key); if (!pr) return; ids.delete(key);
    const i = rt.pads.indexOf(pr); if (i >= 0) rt.pads.splice(i, 1);
    K.interactions.unregister('pad.' + key);
  }
  function sync() {
    const want = istenen(), keys = new Set(want.map(k => k.key));
    for (const key of [...ids.keys()]) if (!keys.has(key)) sil(key);
    for (const k of want) { const have = ids.get(k.key); if (!have) ekle(k); else if (have.sub !== k.sub || have.price !== k.price || have.pos.x !== k.pos.x || have.pos.z !== k.pos.z) { sil(k.key); ekle(k); } }
  }
  return { sync };
}
