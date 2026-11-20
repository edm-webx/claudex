/**
 * DKN-05: what each menu item of the far-shore businesses needs: the station where it is made, how long it takes
 * (seconds at business level 1), what the worker carries (3D model family) and its colour. No stock, no ingredients.
 * 'raf' is only a pick-up point (endless, decorative). Menu ids are the ISLETME[...].menu ids of content/esya.ts.
 */
export type IstasyonId = 'kahve' | 'cay' | 'bar' | 'ocak' | 'firin' | 'izgara' | 'vitrin' | 'tezgah' | 'kopya' | 'raf';
export type TasimaKind = 'fincan' | 'bardak' | 'sise' | 'tabak' | 'kase' | 'tepsi' | 'dilim' | 'kutu' | 'defter' | 'kagit' | 'torba';
export interface Kalem { ist: IstasyonId; sure: number; tasima: TasimaKind; renk: string }
const k = (ist: IstasyonId, sure: number, tasima: TasimaKind, renk: string): Kalem => ({ ist, sure, tasima, renk });
export const KALEM: Record<string, Kalem> = {
  // kafe
  turk_kahvesi: k('kahve', 4, 'fincan', '#6b3a1e'), demlik_cay: k('cay', 2.5, 'bardak', '#b5361c'), kasarli_tost: k('firin', 4.5, 'dilim', '#e8b960'), su_boregi: k('firin', 5, 'tabak', '#f0d9a0'),
  filtre: k('kahve', 3, 'bardak', '#7a4524'), cheesecake: k('vitrin', 1.5, 'tabak', '#f6e3b4'), menemen: k('ocak', 6, 'kase', '#d9482b'), serpme: k('vitrin', 6, 'tepsi', '#e9c46a'),
  // bistro
  limonata: k('bar', 2.5, 'bardak', '#f2e050'), latte: k('kahve', 3.5, 'bardak', '#d9b98c'), waffle: k('firin', 5, 'tabak', '#e2a64a'), frappe: k('bar', 3.5, 'bardak', '#c49a6c'),
  balik_ekmek: k('izgara', 5, 'dilim', '#d9a05b'), deniz_makarna: k('ocak', 6.5, 'tabak', '#f08a5d'), levrek: k('izgara', 7, 'tabak', '#c8d3da'), sufle: k('firin', 6, 'kase', '#5a2e1c'),
  // kırtasiye
  kalem: k('raf', 1.2, 'kutu', '#f2c230'), defter: k('raf', 1.5, 'defter', '#2f6fb0'), silgi: k('raf', 1.2, 'kutu', '#f08fb0'), boya: k('raf', 1.5, 'kutu', '#3fae6a'),
  fotokopi_s: k('kopya', 4, 'kagit', '#fbfbf8'), canta: k('raf', 2, 'torba', '#d9482b'), roman: k('raf', 1.5, 'defter', '#8c2f39'), maket: k('raf', 2.5, 'kutu', '#8f6fd0'),
  // kantin
  ayran: k('bar', 1.5, 'sise', '#fbfdff'), simit_k: k('vitrin', 1.5, 'dilim', '#c8833c'), tost_k: k('firin', 4, 'dilim', '#e8c27a'), kek: k('vitrin', 1.5, 'tabak', '#c98a4b'),
  cikolatali_sut: k('bar', 1.5, 'bardak', '#6b3a1e'), pizza: k('firin', 5, 'dilim', '#e0533c'), salata_k: k('vitrin', 2.5, 'kase', '#8fd06b'), kofte_k: k('izgara', 6, 'dilim', '#a8602c'),
  // lokanta
  mercimek: k('ocak', 3, 'kase', '#e08a2b'), fasulye: k('ocak', 4, 'tabak', '#f2e6cc'), karniyarik: k('ocak', 5.5, 'tabak', '#4a2a3a'), lahmacun: k('firin', 4.5, 'tabak', '#d9602b'),
  pide: k('firin', 6, 'tabak', '#e8b96a'), iskender: k('izgara', 7, 'tabak', '#c8452b'), adana: k('izgara', 7, 'tabak', '#b8382b'), kunefe: k('firin', 5.5, 'kase', '#e0932b'),
  // tesis kafeteryası
  cay_t: k('cay', 2, 'bardak', '#b5361c'), gazoz_t: k('bar', 1.5, 'sise', '#5aa9d6'), tost_t: k('firin', 4.5, 'dilim', '#e8c27a'), enerji: k('bar', 1.5, 'sise', '#f2d24a'),
  kofte_t: k('izgara', 6, 'dilim', '#a8602c'), protein: k('vitrin', 1.2, 'kutu', '#6a4a2e'), kumpir_t: k('firin', 5.5, 'kase', '#e9c46a'), mac_menu: k('izgara', 7, 'tepsi', '#e0533c'),
};
/** which layout item names (content/ic-mekan.ts) stand for a station; the first one found is where the worker walks */
export const ISTASYON_LAYOUT_K: Record<IstasyonId, string[]> = {
  kahve: ['espresso', 'barista'], cay: ['semaver', 'cayOcak'], bar: ['buzdolap', 'espresso', 'buzVitrin'], ocak: ['benmari', 'corba', 'ocakK'],
  firin: ['tostMak', 'firinK', 'tasFirin', 'waffle'], izgara: ['mangal', 'izgara'], vitrin: ['vitrin', 'buzVitrin', 'tatliVitrin'], tezgah: ['tezgah'], kopya: ['fotokopi'], raf: ['tezgah'],
};
/** deterministic order, used to spread stations along a counter when the room has no matching layout item */
export const ISTASYON_SIRA: IstasyonId[] = ['kahve', 'cay', 'bar', 'ocak', 'firin', 'izgara', 'vitrin', 'tezgah', 'kopya', 'raf'];
export const kalemOf = (id: string): Kalem => KALEM[id] || KALEM.turk_kahvesi;
