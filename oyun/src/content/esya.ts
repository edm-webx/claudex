/**
 * Karar paketi H/D/E (2026-10-27): items, chests, the daily board, the bank, plots and shop types. Pure data. Every name is invented.
 * Two item layers (H3): world/drop items (chest, match, forest, board) and production items (crafted from materials).
 * Character inventory vs account bank is a hard split: inventory = S.zones.envanter, bank = rt.banka (cloud, shared).
 */
export type EsyaTur = 'tuketim' | 'malzeme' | 'kozmetik' | 'anahtar' | 'uretim';
export interface Esya { id: string; ad: string; ikon: string; tur: EsyaTur; nadir: 0 | 1 | 2; blurb: string }
export const ESYALAR: Esya[] = [
  { id: 'tahta', ad: 'Tahta Parçası', ikon: '🪵', tur: 'malzeme', nadir: 0, blurb: 'İskele tahtası. Raf ve tezgah işlerinde lazım.' },
  { id: 'civi', ad: 'Paslı Çivi', ikon: '📌', tur: 'malzeme', nadir: 0, blurb: 'Paslı ama sağlam.' },
  { id: 'boya', ad: 'Boya Tenekesi', ikon: '🎨', tur: 'malzeme', nadir: 0, blurb: 'Islak boya! Dükkân ve ev boyamak için.' },
  { id: 'kumas', ad: 'Kumaş Parçası', ikon: '🧵', tur: 'malzeme', nadir: 0, blurb: 'Tente ve perde yapımı.' },
  { id: 'kozalak', ad: 'Çam Kozalağı', ikon: '🌰', tur: 'malzeme', nadir: 0, blurb: 'Belgrad Ormanı yadigârı.' },
  { id: 'deniz_cami', ad: 'Deniz Camı', ikon: '🔹', tur: 'malzeme', nadir: 1, blurb: 'Dalgalar yuvarlamış. Süs ve vitrin için.' },
  { id: 'bozuk_kese', ad: 'Bozuk Para Kesesi', ikon: '👛', tur: 'tuketim', nadir: 0, blurb: 'Aç: içinden bozuk para çıkar.' },
  { id: 'tecrube_simit', ad: 'Tecrübe Simidi', ikon: '🥯', tur: 'tuketim', nadir: 1, blurb: 'Ye: tecrübe puanı kazan.' },
  { id: 'sans_simidi', ad: 'Şans Simidi', ikon: '🍀', tur: 'tuketim', nadir: 1, blurb: 'Ye: sıradaki sandıktan 1 eşya fazla çıkar.' },
  { id: 'altin_kupon', ad: 'Altın Simit Kuponu', ikon: '🎟️', tur: 'kozmetik', nadir: 2, blurb: 'Bozdur: 5 Altın Simit.' },
  { id: 'kozmetik_tozu', ad: 'Kozmetik Tozu', ikon: '✨', tur: 'kozmetik', nadir: 1, blurb: 'Premium kıyafet için biriktir (yakında).' },
  { id: 'altin_anahtar', ad: 'Altın Anahtar', ikon: '🗝️', tur: 'anahtar', nadir: 2, blurb: 'Altın Sandık bununla açılır.' },
  { id: 'raf_kiti', ad: 'Raf Kiti', ikon: '🗄️', tur: 'uretim', nadir: 0, blurb: 'Dükkân yükseltmesi için gerekir.' },
  { id: 'tente_seti', ad: 'Tente Seti', ikon: '⛱️', tur: 'uretim', nadir: 1, blurb: 'Dükkân yükseltmesi (3. seviyeden sonra).' },
];
export const ESYA_BY_ID: Record<string, Esya> = Object.fromEntries(ESYALAR.map(e => [e.id, e]));

/** simple crafting (H3 layer 2): materials in, one product out */
export const TARIFLER: { id: string; gir: Record<string, number>; cik: string }[] = [
  { id: 'raf_kiti', gir: { tahta: 3, civi: 2 }, cik: 'raf_kiti' },
  { id: 'tente_seti', gir: { kumas: 3, boya: 1, civi: 1 }, cik: 'tente_seti' },
];

/** chests: what falls from activities. 'altin' needs an Altın Anahtar. */
export interface Sandik { id: string; ad: string; ikon: string; tl: [number, number]; adet: [number, number]; havuz: [string, number][]; anahtar?: string }
export const SANDIKLAR: Sandik[] = [
  { id: 'tahta', ad: 'Tahta Sandık', ikon: '📦', tl: [600, 2500], adet: [1, 2], havuz: [['tahta', 5], ['civi', 5], ['kumas', 3], ['boya', 2], ['kozalak', 3], ['bozuk_kese', 3]] },
  { id: 'gumus', ad: 'Gümüş Sandık', ikon: '🎁', tl: [3000, 9000], adet: [2, 3], havuz: [['boya', 3], ['kumas', 3], ['deniz_cami', 3], ['bozuk_kese', 3], ['tecrube_simit', 3], ['sans_simidi', 2], ['kozmetik_tozu', 1]] },
  { id: 'altin', ad: 'Altın Sandık', ikon: '👑', tl: [15000, 40000], adet: [2, 4], anahtar: 'altin_anahtar', havuz: [['deniz_cami', 3], ['tecrube_simit', 3], ['sans_simidi', 3], ['kozmetik_tozu', 3], ['altin_kupon', 1]] },
];
export const SANDIK_BY_ID: Record<string, Sandik> = Object.fromEntries(SANDIKLAR.map(s => [s.id, s]));

/** daily board (H5): 3 goals per game day from this pool, counted from K.stat keys; finishing all 3 gives a Gümüş Sandık */
export interface Gunluk { id: string; ad: string; stat: string; hedef: [number, number]; odul: number }
export const GUNLUK_HAVUZ: Gunluk[] = [
  { id: 'sat', ad: 'Büfeden {n} ürün sat', stat: 'sale', hedef: [20, 40], odul: 1500 },
  { id: 'mantar', ad: 'Belgrad Ormanı\'ndan {n} mantar topla', stat: 'mantar', hedef: [3, 6], odul: 2000 },
  { id: 'otobus', ad: '42B ile {n} kez yolculuk yap', stat: 'otobus', hedef: [2, 3], odul: 1200 },
  { id: 'kedi', ad: '{n} gizli kedi bul', stat: 'gizliKedi', hedef: [1, 2], odul: 1800 },
  { id: 'foto', ad: '{n} fotoğraf noktasında çıt çek', stat: 'fotoNokta', hedef: [1, 2], odul: 1500 },
  { id: 'kayip', ad: '{n} kayıp eşyayı sahibine ulaştır', stat: 'kayipEsya', hedef: [1, 2], odul: 2200 },
  { id: 'mac', ad: 'Stadyumda {n} maç oyna', stat: 'macOyun', hedef: [1, 1], odul: 3000 },
  { id: 'yan', ad: 'Mülklerinden {n} kez kasa topla', stat: 'mulkKasa', hedef: [1, 2], odul: 1500 },
];

/** drop rules: stat key -> every `her` events a chest of `sandik` falls */
export const SANDIK_DUSER: { stat: string; her: number; sandik: string; ad: string }[] = [
  { stat: 'mantar', her: 4, sandik: 'tahta', ad: 'orman toplayıcılığı' },
  { stat: 'macOyun', her: 1, sandik: 'tahta', ad: 'maç' },
  { stat: 'macGalibiyet', her: 2, sandik: 'gumus', ad: 'maç galibiyeti' },
  { stat: 'mulkKasa', her: 6, sandik: 'tahta', ad: 'mülk geliri' },
  { stat: 'seviye', her: 5, sandik: 'gumus', ad: 'seviye atlama' },
];

/** The bank building (Mahalle Meydanı) and the plot grid. Bank door / plot doors are the interaction points. */
/** Halı saha giriş (karşı yaka, tribünlü saha): bilet ve takım kurma burada da yapılır. */
export const HALI_SAHA_KAPI = { x: -25.2, z: 45 };
export const BANKA = { x: 11.7, z: 36.8, kapi: { x: 11.7, z: 41.8 }, w: 10, d: 8.4, ad: 'Martı Kasası Bankası' };
/** sabit: a fixed building on the map (karşı yaka kafeler): buying the plot opens that shop at once; kapi = interaction point. */
export interface Arsa { id: string; x: number; z: number; fiyat: number; seviye: number; rotY: number; sabit?: string; kapi?: { x: number; z: number }; ad?: string }
export const ARSALAR: Arsa[] = [
  { id: 'a1', x: 259.5, z: 0.4, fiyat: 60000, seviye: 3, rotY: 0 },
  { id: 'a2', x: 266.2, z: 0.4, fiyat: 150000, seviye: 5, rotY: 0 },
  { id: 'a3', x: 272.9, z: 0.4, fiyat: 350000, seviye: 8, rotY: 0 },
  { id: 'a4', x: 279.6, z: 0.4, fiyat: 800000, seviye: 11, rotY: 0 },
  { id: 'a5', x: 284.5, z: 18.2, fiyat: 1800000, seviye: 14, rotY: Math.PI },
  // karşı yaka kafeler (Kenney building-c at these spots, karsi-look.ts); door faces the square (+x)
  { id: 'k1', x: -17.5, z: 37.9, fiyat: 90000, seviye: 2, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -11.8, z: 37.9 }, ad: 'Meydan Kafe' },
  { id: 'k2', x: -17.5, z: 51.5, fiyat: 120000, seviye: 3, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -11.8, z: 51.5 }, ad: 'Sahil Kafe' },
];
export const ARSA_HAK = 3;
export const arsaKapi = (a: Arsa) => a.kapi ?? { x: a.x, z: a.z + (a.rotY ? -3.0 : 3.0) };
/** café workers (karşı yaka): hire price grows per worker; each adds +40% customers, restocks from the till, takes an hourly wage */
export const ISCI_MAX = 3, isciFiyat = (n: number) => 12000 * (n + 1), ISCI_SAAT_UCRET = 60, ISCI_MUSTERI = 0.4;

/** shop types (D). One shared engine: stok -> müşteri -> satış -> upgrade. fiyat/maliyet per unit, musteri per game hour at level 1. */
export interface DukkanTip { id: string; ad: string; ikon: string; renk: string; tabela: string; maliyet: number; fiyat: number; musteri: number; kurulum: number; seviye: number }
export const DUKKAN_TIPLERI: DukkanTip[] = [
  { id: 'bufe', ad: 'Büfe (Simit & Çay)', ikon: '🥯', renk: '#e0533c', tabela: 'SİMİT ÇAY', maliyet: 6, fiyat: 14, musteri: 5, kurulum: 20000, seviye: 1 },
  { id: 'manav', ad: 'Manav & Bakkal', ikon: '🍎', renk: '#6fae55', tabela: 'MANAV', maliyet: 8, fiyat: 17, musteri: 5, kurulum: 30000, seviye: 1 },
  { id: 'berber', ad: 'Berber', ikon: '💈', renk: '#2f6f9a', tabela: 'BERBER', maliyet: 10, fiyat: 26, musteri: 3, kurulum: 45000, seviye: 4 },
  { id: 'kiyafet', ad: 'Kıyafet', ikon: '👕', renk: '#c94f6d', tabela: 'KIYAFET', maliyet: 20, fiyat: 46, musteri: 3, kurulum: 70000, seviye: 6 },
  { id: 'balikci', ad: 'Balıkçı', ikon: '🐟', renk: '#3fb5b0', tabela: 'BALIKÇI', maliyet: 12, fiyat: 27, musteri: 4, kurulum: 55000, seviye: 5 },
  { id: 'cay_ocagi', ad: 'Çay Ocağı', ikon: '🍵', renk: '#b07a48', tabela: 'ÇAY OCAĞI', maliyet: 3, fiyat: 8, musteri: 8, kurulum: 25000, seviye: 2 },
  { id: 'spor', ad: 'Spor Malzeme', ikon: '⚽', renk: '#3fa35a', tabela: 'SPOR', maliyet: 25, fiyat: 55, musteri: 2, kurulum: 90000, seviye: 8 },
  { id: 'fan', ad: 'Fan Shop', ikon: '🧣', renk: '#ffd23f', tabela: 'FAN SHOP', maliyet: 18, fiyat: 42, musteri: 3, kurulum: 80000, seviye: 7 },
  { id: 'kafe', ad: 'Kafe', ikon: '☕', renk: '#b07a48', tabela: 'KAFE', maliyet: 9, fiyat: 24, musteri: 6, kurulum: 45000, seviye: 2 },
];
export const DUKKAN_BY_ID: Record<string, DukkanTip> = Object.fromEntries(DUKKAN_TIPLERI.map(t => [t.id, t]));
export const DUKKAN_MAX_SEVIYE = 5;
export const DUKKAN_STOK_MAX = [0, 60, 120, 200, 320, 500];
/** upgrade level n -> n+1: TL cost multiplier of `kurulum`, plus item needs */
export const dukkanYukselt = (tip: DukkanTip, lv: number): { tl: number; esya: Record<string, number> } =>
  ({ tl: Math.round(tip.kurulum * lv * 0.9), esya: lv >= 3 ? { raf_kiti: 1, tente_seti: 1 } : { raf_kiti: 1 } });
/** customers per game hour at a level */
export const dukkanMusteri = (tip: DukkanTip, lv: number) => tip.musteri * (1 + (lv - 1) * 0.45);

/** stadium (J6): instant match ticket and team founding */
/** 2026-11-02: the football club stand on the pier promenade (club founding, ticket price, league) */
export const STADYUM = { bilet: 5000, takim: 100000, kapi: { x: 399, z: 12.2 } };
