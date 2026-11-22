/**
 * DKN-05: what each menu item of the far-shore businesses needs: the station where it is made, how long it takes
 * (seconds at business level 1), what the worker carries (3D model family) and its colour. No stock, no ingredients.
 * 'raf' is only a pick-up point (endless, decorative). Menu ids are the ISLETME[...].menu ids of content/esya.ts.
 */
export type IstasyonId = 'kahve' | 'cay' | 'bar' | 'ocak' | 'firin' | 'izgara' | 'vitrin' | 'tezgah' | 'kopya' | 'raf' | 'depo' | 'paket' | 'test' | 'dikis' | 'misir' | 'dolap';
export type TasimaKind = 'fincan' | 'bardak' | 'sise' | 'tabak' | 'kase' | 'tepsi' | 'dilim' | 'kutu' | 'defter' | 'kagit' | 'torba' | 'misir';
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
  // içecek dolabı (2026-11-22, büfedeki gibi): kapağı aç, şişeyi al; makine değil, bekletmez
  d_su: k('dolap', 0.8, 'sise', '#9fd3f0'), d_soda: k('dolap', 0.8, 'sise', '#cfe8d8'), d_kolaz: k('dolap', 0.8, 'sise', '#6b1f1a'), d_gazoz: k('dolap', 0.8, 'sise', '#5aa9d6'), d_ayran: k('dolap', 0.8, 'sise', '#fbfdff'),
  // AVM shops (2026-11-20): the worker fetches the item from the stock shelf (depo), wraps it (paket) or tests it (test); no stock
  tisort: k('depo', 2.5, 'torba', '#e0533c'), kot: k('depo', 3, 'torba', '#2f5f9a'), gomlek: k('dikis', 3, 'torba', '#f4f2ec'), sweat: k('depo', 3, 'torba', '#7d6bb0'),
  elbise: k('dikis', 3.5, 'torba', '#c94f6d'), spor_ayk: k('depo', 4, 'kutu', '#f4f2ec'), mont: k('depo', 4, 'torba', '#3a3d42'), takim: k('dikis', 5, 'torba', '#1d1d22'),
  kulaklik: k('depo', 2.5, 'kutu', '#2a2d33'), powerbank: k('depo', 2.5, 'kutu', '#3f4a6b'), sarj_kablo: k('depo', 1.5, 'kutu', '#f4f2ec'), kilif: k('depo', 1.5, 'kutu', '#2f9e8f'),
  hoparlor: k('test', 3.5, 'kutu', '#e0533c'), akilli_saat: k('test', 4, 'kutu', '#1d1d22'), tablet: k('test', 5, 'kutu', '#9aa5b0'), telefon: k('test', 6, 'kutu', '#2a2d33'),
  pelus: k('depo', 2, 'torba', '#f4f2ec'), yapboz: k('depo', 2, 'kutu', '#2f7fb3'), araba: k('depo', 1.5, 'kutu', '#e0533c'), bebek: k('paket', 3, 'kutu', '#f2a2b3'),
  kutu_oyun: k('depo', 2.5, 'kutu', '#49b96a'), yapi_seti: k('paket', 3.5, 'kutu', '#ffd23f'), rc_araba: k('test', 4, 'kutu', '#c0392b'), tren_seti: k('paket', 5, 'kutu', '#7d4a2a'),
  // 2026-11-21 AVM katları
  akide: k('vitrin', 1.2, 'kutu', '#e0533c'), lokum: k('tezgah', 2, 'kutu', '#f2a2b3'), pismaniye: k('vitrin', 2, 'kutu', '#f6ecd0'), macun: k('tezgah', 1.5, 'kutu', '#ffd23f'),
  kestane_sekeri: k('ocak', 3, 'kutu', '#7a4a2a'), cikolata_el: k('vitrin', 2, 'kutu', '#4a2a1a'), fistikli_lokum: k('tezgah', 2.5, 'kutu', '#6fae55'), lokum_kutu: k('paket', 4, 'kutu', '#c94f6d'),
  kumda_kahve: k('kahve', 4, 'fincan', '#5a3420'), dibek: k('kahve', 3.5, 'fincan', '#6b3a1e'), flat_white: k('kahve', 3, 'bardak', '#d9b98c'), menengic: k('kahve', 3.5, 'fincan', '#8a6a3a'),
  soguk_demleme: k('bar', 2, 'bardak', '#3a2416'), marti_latte: k('kahve', 4, 'bardak', '#e9d6b4'), kahve_fal: k('kahve', 5, 'fincan', '#2a1a10'), cekirdek: k('paket', 2.5, 'torba', '#5a3a24'),
  kulah: k('vitrin', 1.5, 'dilim', '#f6ecd0'), kaymakli: k('vitrin', 2, 'kase', '#fbf6e6'), sakizli: k('vitrin', 2, 'kase', '#f4f7f2'), sorbe: k('bar', 2, 'kase', '#f2e050'),
  cikolatali_kup: k('vitrin', 2.5, 'kase', '#5a2e1c'), kesme_maras: k('tezgah', 3.5, 'tabak', '#fbf6e6'), dondurmali_waffle: k('firin', 4.5, 'tabak', '#e2a64a'), dev_kup: k('vitrin', 5, 'kase', '#f2a2b3'),
  sutlac: k('vitrin', 1.5, 'kase', '#f2e6cc'), kazandibi: k('vitrin', 1.5, 'tabak', '#e8c27a'), baklava: k('vitrin', 2, 'tabak', '#6fae55'), tel_kadayif: k('vitrin', 2, 'tabak', '#e0a84a'),
  sobiyet: k('vitrin', 2, 'tabak', '#e8c27a'), kunefe_b: k('ocak', 5, 'tabak', '#e0932b'), ekmek_kadayif: k('vitrin', 2.5, 'tabak', '#c8833c'), baklava_tepsi: k('paket', 4.5, 'tepsi', '#6fae55'),
  leblebi: k('raf', 1.2, 'torba', '#e9c46a'), ay_cekirdek: k('raf', 1.2, 'torba', '#3a3d42'), kabak_cekirdek: k('raf', 1.5, 'torba', '#f4f2ec'), kuru_kayisi: k('raf', 1.5, 'torba', '#e8892b'),
  findik: k('ocak', 2.5, 'torba', '#8a5a3c'), karisik_cerez: k('raf', 2, 'torba', '#c8833c'), antep: k('ocak', 2.5, 'torba', '#8fae55'), cerez_sepet: k('paket', 4, 'tepsi', '#c07a2c'),
  ayran_d: k('bar', 1.5, 'bardak', '#fbfdff'), yarim_ekmek: k('izgara', 4, 'dilim', '#d9a05b'), tavuk_durum: k('izgara', 4.5, 'dilim', '#e8c27a'), tombik: k('izgara', 5, 'dilim', '#c8833c'),
  et_durum: k('izgara', 5, 'dilim', '#a8602c'), pilav_ustu: k('ocak', 5.5, 'tabak', '#f2e6cc'), dayi_iskender: k('izgara', 7, 'tabak', '#c8452b'), metre_durum: k('izgara', 8, 'tepsi', '#d9a05b'),
  limonata_k: k('bar', 1.5, 'bardak', '#f2e050'), citir_patates: k('firin', 3.5, 'kase', '#f2c230'), sade_kumpir: k('firin', 4, 'tabak', '#e9c46a'), kasarli_kumpir: k('firin', 4.5, 'tabak', '#f2d24a'),
  sucuklu_kumpir: k('firin', 5, 'tabak', '#c0392b'), karisik_kumpir: k('firin', 5.5, 'tabak', '#e0533c'), tavuklu_kumpir: k('firin', 5.5, 'tabak', '#e8b960'), kule_kumpir: k('firin', 7.5, 'tepsi', '#e2a82b'),
  salgam: k('bar', 1.5, 'bardak', '#7a1f3d'), midye_dolma: k('vitrin', 2, 'tabak', '#2a2d33'), midye_tava: k('ocak', 4.5, 'tabak', '#e8b960'), balik_durum: k('izgara', 5, 'dilim', '#d9a05b'),
  kalamar: k('ocak', 5, 'tabak', '#f2e6cc'), karides_guvec: k('firin', 6, 'kase', '#e0533c'), levrek_sis: k('izgara', 6.5, 'tabak', '#c8d3da'), mido_tabak: k('vitrin', 6, 'tepsi', '#2a2d33'),
  // 2026-11-22 Sinema Büfesi: mısır makinesi kendi patlatır, içecekler dolaptan (makine değil, açıp alınır)
  misir_kucuk: k('misir', 3.5, 'misir', '#ffe08a'), kolaz: k('dolap', 1, 'sise', '#5a2a1a'), gazoz: k('dolap', 1, 'sise', '#5aa9d6'), soda: k('dolap', 1, 'sise', '#dff3f7'),
  misir_kova: k('misir', 5, 'misir', '#ffd23f'), slush: k('bar', 3, 'bardak', '#e0436b'), nachos: k('firin', 4, 'kase', '#f2c230'), film_menu: k('misir', 6, 'tepsi', '#ffd23f'),
};
/** which layout item names (content/ic-mekan.ts) stand for a station; the first one found is where the worker walks */
export const ISTASYON_LAYOUT_K: Record<IstasyonId, string[]> = {
  kahve: ['espresso', 'barista', 'kumOcak'], cay: ['semaver', 'cayOcak'], bar: ['buzdolap', 'espresso', 'buzVitrin', 'yayik', 'slushMak'], ocak: ['benmari', 'corba', 'ocakK', 'kazan', 'kavurucu'],
  firin: ['tostMak', 'firinK', 'tasFirin', 'waffle', 'kumpirFirin', 'nachoIsitici'], izgara: ['mangal', 'izgara', 'doner'], vitrin: ['vitrin', 'buzVitrin', 'tatliVitrin', 'dondurmaTezgah', 'kavanoz'], tezgah: ['tepsiTezgah', 'tezgah'], kopya: ['fotokopi'], raf: ['kavanoz', 'tezgah'],
  depo: ['depoRaf'], paket: ['paketMasa', 'hediye'], test: ['testMasa'], dikis: ['dikis'], misir: ['misirMak'], dolap: ['icecekDolap', 'buzdolap'],
};
/** deterministic order, used to spread stations along a counter when the room has no matching layout item */
export const ISTASYON_SIRA: IstasyonId[] = ['kahve', 'cay', 'bar', 'ocak', 'firin', 'izgara', 'vitrin', 'tezgah', 'kopya', 'raf', 'depo', 'paket', 'test', 'dikis', 'misir', 'dolap'];
export const kalemOf = (id: string): Kalem => KALEM[id] || KALEM.turk_kahvesi;

/**
 * 2026-11-22 sahip: "her dükkânda istasyon olacak, büfedeki gibi: kahveci kahve makinesini kullanacak, biz gidince biz de
 * kullanabileceğiz; tost makinesi gibi bekledikçe ürün geliyor". Bu istasyonlar MAKİNE: biri (oyuncu ya da çalışan) ürünü
 * koyar, makine kendi kendine pişirir / demler (koyan başında beklemek zorunda değil), bitince ürün makinenin hazır
 * tepsisinde durur; kim alırsa sıradaki müşteriye götürür. Diğerleri (vitrin, raf, depo, tezgâh, paket) elle alınır, eskisi gibi.
 * Stok yok: tepsi en fazla MAKINE_TEPSI ürün tutar (dolu tepside yeni ürün koyulunca en eskisi bayatlar, atılır).
 */
export const MAKINE: ReadonlySet<IstasyonId> = new Set<IstasyonId>(['kahve', 'cay', 'bar', 'ocak', 'firin', 'izgara', 'kopya', 'test', 'dikis', 'misir']);
export const MAKINE_TEPSI = 3;
/** boşta çalışanın önceden hazırlayıp tepside beklettiği en fazla ürün (bekledikçe ürün gelir) */
export const MAKINE_ON = 2;
const MAKINE_GENEL: Record<string, string> = { kahve: 'Kahve makinesi', cay: 'Semaver', bar: 'Blender', ocak: 'Ocak', firin: 'Fırın', izgara: 'Izgara', kopya: 'Fotokopi makinesi', test: 'Test tezgâhı', dikis: 'Dikiş makinesi', misir: 'Mısır makinesi' };
/** odadaki alete göre makinenin adı (content/ic-mekan.ts layout k) */
const MAKINE_K: Record<string, string> = {
  espresso: 'Espresso makinesi', barista: 'Kahve makinesi', kumOcak: 'Kum ocağı', semaver: 'Semaver', cayOcak: 'Çay ocağı', buzdolap: 'Soğuk içecek dolabı', buzVitrin: 'Sorbe makinesi', yayik: 'Ayran yayığı',
  benmari: 'Benmari', corba: 'Çorba kazanı', ocakK: 'Ocak', kazan: 'Kestane kazanı', kavurucu: 'Kavurma kazanı', tostMak: 'Tost makinesi', firinK: 'Fırın', tasFirin: 'Taş fırın', waffle: 'Waffle makinesi',
  kumpirFirin: 'Kumpir fırını', mangal: 'Mangal', izgara: 'Izgara', doner: 'Döner ocağı', fotokopi: 'Fotokopi makinesi', testMasa: 'Test tezgâhı', dikis: 'Dikiş makinesi', misirMak: 'Mısır makinesi', slushMak: 'Slush makinesi', nachoIsitici: 'Nachos ısıtıcı',
};
export const makineAdi = (ist: IstasyonId, layoutK?: string): string => (layoutK && MAKINE_K[layoutK]) || MAKINE_GENEL[ist] || 'Makine';
