/**
 * Şantiye setleri (2026-11-25 sahip: "inşaat, geliştirme ya da tadilat sürecindeki her yerde, projenin büyüklüğüne göre çalışan
 * makineler, araçlar ya da ustalar olmalı; hayattan örnek al"). Pure data: görünüm (view/world/santiye-kit.ts) ve sim (usta sayıları)
 * aynı tablodan okur.
 *
 * Hayattaki karşılığı:
 *  - küçük  (dükkân boyası, vitrin, tezgâh): 2 usta, A merdiven, boya kovaları, alçı torbası, tek kat iskele, şerit + duba. Vinç YOK.
 *  - orta   (ev, büfe kanadı, kafe -> bistro): 3 usta, iki kat iskele, betoniyer, el arabası, kum + tuğla, şantiye çiti.
 *  - büyük  (salon, restoran kanadı, AVM dükkânı genişlemesi): 4 usta, mobil vinç, damperli kamyon, konteyner ofis, seyyar tuvalet.
 *  - dev    (cam çatı, ikinci kat, saray restoran): 5 usta, kule vinç, beton pompası, mikser kamyon, jeneratör, gece projektörü.
 * Toz bulutu bütün setlerde var, boyutla yoğunlaşır.
 */
export type Boyut = 'kucuk' | 'orta' | 'buyuk' | 'dev';
export interface SetPlan {
  boyut: Boyut; ad: string; usta: number;
  iskeleKat: number; merdiven: boolean; boya: boolean; betoniyer: boolean; elArabasi: boolean; cit: boolean;
  mobilVinc: boolean; kamyon: boolean; konteyner: boolean; kuleVinc: boolean; pompa: boolean; mikser: boolean; jenerator: boolean;
  /** toz parçacığı sayısı */ toz: number;
}
export const SETLER: Record<Boyut, SetPlan> = {
  kucuk: { boyut: 'kucuk', ad: 'Küçük tadilat', usta: 2, iskeleKat: 1, merdiven: true, boya: true, betoniyer: false, elArabasi: false, cit: false, mobilVinc: false, kamyon: false, konteyner: false, kuleVinc: false, pompa: false, mikser: false, jenerator: false, toz: 6 },
  orta: { boyut: 'orta', ad: 'Orta inşaat', usta: 3, iskeleKat: 2, merdiven: true, boya: false, betoniyer: true, elArabasi: true, cit: true, mobilVinc: false, kamyon: false, konteyner: false, kuleVinc: false, pompa: false, mikser: false, jenerator: false, toz: 12 },
  buyuk: { boyut: 'buyuk', ad: 'Büyük inşaat', usta: 4, iskeleKat: 3, merdiven: false, boya: false, betoniyer: true, elArabasi: true, cit: true, mobilVinc: true, kamyon: true, konteyner: true, kuleVinc: false, pompa: false, mikser: false, jenerator: false, toz: 18 },
  dev: { boyut: 'dev', ad: 'Dev şantiye', usta: 5, iskeleKat: 3, merdiven: false, boya: false, betoniyer: false, elArabasi: true, cit: true, mobilVinc: false, kamyon: false, konteyner: true, kuleVinc: true, pompa: true, mikser: true, jenerator: true, toz: 24 },
};
/** büfe tadilatı (hedef aşama): 2 tezgâh/tente = küçük, 3-5 kanat ve teras = orta, 6-8 salon ve çatı terası = büyük, 9-10 cam çatı + saray = dev */
export const bufeBoyut = (to: number): Boyut => (to <= 2 ? 'kucuk' : to <= 5 ? 'orta' : to <= 8 ? 'buyuk' : 'dev');
/** karşı yaka / AVM işletme tadilatı (şimdiki seviye -> lv+1): 1->2 küçük, 2->3 orta, 3->4 büyük, 4->5 dev */
export const isletmeBoyut = (lv: number): Boyut => (lv <= 1 ? 'kucuk' : lv === 2 ? 'orta' : lv === 3 ? 'buyuk' : 'dev');

/* ---------- arsa yapımı (ev / dükkân): aşamalı, süreli ---------- */
/** hayattaki sıra: hafriyat + temel, karkas (kolon/kiriş), duvar örme, çatı + sıva + boya */
export const YAPI_ASAMA = [
  { ad: 'Hafriyat ve temel', son: 0.2 },
  { ad: 'Karkas: kolon ve kiriş', son: 0.45 },
  { ad: 'Duvar örülüyor', son: 0.8 },
  { ad: 'Çatı, sıva ve boya', son: 1 },
] as const;
export const yapiAsama = (p: number): number => { for (let i = 0; i < YAPI_ASAMA.length; i++) if (p < YAPI_ASAMA[i].son) return i; return YAPI_ASAMA.length - 1; };
/** yapım süresi (oyun saniyesi, gerçek zaman): ev ~4 dk, dükkân ~6 dk; altın simitle atlanır */
export const YAPI_SURE = { ev: 240, dukkan: 360 } as const;
export const arsaBoyut = (tur: 'ev' | 'dukkan'): Boyut => (tur === 'ev' ? 'orta' : 'buyuk');
