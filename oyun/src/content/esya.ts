/**
 * Karar paketi H/D/E (2026-10-27): items, chests, the daily board, the bank, plots and shop types. Pure data. Every name is invented.
 * Two item layers (H3): world/drop items (chest, match, forest, board) and production items (crafted from materials).
 * Character inventory vs account bank is a hard split: inventory = S.zones.envanter, bank = rt.banka (cloud, shared).
 */
import { HOL, ODA_X, ODA_Z, SINEMA_BUFE } from './avm-kat';
export type EsyaTur = 'tuketim' | 'malzeme' | 'kozmetik' | 'anahtar';
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
  { id: 'kozmetik_tozu', ad: 'Kozmetik Tozu', ikon: '✨', tur: 'kozmetik', nadir: 1, blurb: 'Süs tozu: şimdilik yalnızca biriktirilir.' },
  { id: 'altin_anahtar', ad: 'Altın Anahtar', ikon: '🗝️', tur: 'anahtar', nadir: 2, blurb: 'Altın Sandık bununla açılır.' },
];
export const ESYA_BY_ID: Record<string, Esya> = Object.fromEntries(ESYALAR.map(e => [e.id, e]));

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
/** kat: Martı AVM katı (content/avm-kat.ts); kapı o katın holünde, oyuncu aynı katta olmalı */
export interface Arsa { id: string; x: number; z: number; fiyat: number; seviye: number; rotY: number; sabit?: string; kapi?: { x: number; z: number }; ad?: string; once?: string; kat?: number }
export const ARSALAR: Arsa[] = [
  { id: 'a1', x: 259.5, z: 0.4, fiyat: 60000, seviye: 3, rotY: 0 },
  { id: 'a2', x: 266.2, z: 0.4, fiyat: 150000, seviye: 5, rotY: 0 },
  { id: 'a3', x: 272.9, z: 0.4, fiyat: 350000, seviye: 8, rotY: 0 },
  { id: 'a4', x: 279.6, z: 0.4, fiyat: 800000, seviye: 11, rotY: 0 },
  { id: 'a5', x: 284.5, z: 18.2, fiyat: 1800000, seviye: 14, rotY: Math.PI },
  // karşı yaka kafeler (Kenney building-c at these spots, karsi-look.ts); door faces the square (+x)
  { id: 'k1', x: -17.5, z: 37.9, fiyat: 90000, seviye: 3, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -11.8, z: 37.9 }, ad: 'Meydan Kafe' },
  { id: 'k2', x: -17.5, z: 51.5, fiyat: 120000, seviye: 3, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -11.8, z: 51.5 }, ad: 'Sahil Bistro' },
  // 2026-11-09: every business building can be bought from a level and run (interiors: content/ic-mekan.ts)
  { id: 'k3', x: 28, z: 35.2, fiyat: 140000, seviye: 4, rotY: Math.PI, sabit: 'kafe', kapi: { x: 28, z: 32.6 }, ad: 'Martı Kırtasiye' },
  { id: 'k4', x: 48.85, z: 37.25, fiyat: 110000, seviye: 3, rotY: Math.PI, sabit: 'kafe', kapi: { x: 48.85, z: 32.6 }, ad: 'Okul Kantini' },
  { id: 'k6', x: -54.1, z: 45.4, fiyat: 260000, seviye: 5, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -51.0, z: 45.4 }, ad: 'Tesis Kafeteryası' },
  // 2026-11-20 owner: Martı AVM is split into separate businesses. 2026-11-21 owner: "her katında mağaza olsun, satın alıp işletelim, zamanla her
  // yere hâkim olalım": 3 floors x 4 shops (content/ic-mekan.ts avmOdalar, content/avm-kat.ts). x / z = room centre, kapi = in front of the room's
  // door in the central hall of that floor. Order of the holding path: the first AVM shop needs nothing else, the rest need one shop already
  // in the mall (once: k7), the food court needs the lokanta first. Prices / levels climb with the floor; incomes: tests/sim/avm-magaza.test.ts.
  ...avmArsalar(),
];
export const ARSA_HAK = 3;
function avmArsalar(): Arsa[] {   // (ARSALAR'dan önce çağrılır: sabitler içeride)
  const W = HOL.x0 + 0.7, E = HOL.x1 - 0.7, F = ODA_Z.F, B = ODA_Z.B, xw = ODA_X.W, xe = ODA_X.E;   // inside the AVM realm (content/avm-kat.ts)
  const a = (id: string, ad: string, kat: number, w: boolean, f: boolean, fiyat: number, seviye: number, once?: string): Arsa =>
    ({ id, x: w ? xw : xe, z: f ? F : B, fiyat, seviye, rotY: w ? Math.PI / 2 : -Math.PI / 2, sabit: 'kafe', kapi: { x: w ? W : E, z: f ? F : B }, ad: ad + ' (AVM)', ...(once ? { once } : {}), ...(kat ? { kat } : {}) });
  return [
    a('k7', 'Martı Moda', 0, true, true, 300000, 7), a('k8', 'Tekno Martı', 0, true, false, 380000, 8, 'k7'),
    a('k9', 'Oyuncak Dünyası', 0, false, true, 260000, 7, 'k7'), a('k10', 'Hacı Martı Şekerleme', 0, false, false, 220000, 6),
    a('k11', 'Telve Kahve Laboratuvarı', 1, true, true, 340000, 7, 'k10'), a('k13', 'Şerbetçi Baklava Sarayı', 1, true, false, 360000, 8, 'k10'),
    a('k12', 'Maraşlı Martı Dondurma', 1, false, true, 320000, 7, 'k10'), a('k14', 'Çıtırcı Kuruyemiş', 1, false, false, 300000, 7, 'k10'),
    a('k5', 'Martı Lokantası', 2, true, true, 450000, 6), a('k15', 'Dürümcü Dayı', 2, true, false, 420000, 8, 'k5'),
    a('k16', 'Kumpir Kulesi', 2, false, true, 400000, 8, 'k5'), a('k17', 'Midyeci Mido', 2, false, false, 440000, 9, 'k5'),
    // 2026-11-22 sahip: "sinema salonunun katında patlamış mısırcı olsun, dolaptan kola soda gazoz versin": 3. katın doğu lobisinde
    { id: 'k18', x: SINEMA_BUFE.x, z: SINEMA_BUFE.z, fiyat: 380000, seviye: 8, rotY: -Math.PI / 2, sabit: 'kafe', kapi: { x: E, z: SINEMA_BUFE.z }, ad: 'Martı Sinema Büfesi (AVM)', once: 'k5', kat: 3 },
  ];
}
export const arsaKapi = (a: Arsa) => a.kapi ?? { x: a.x, z: a.z + (a.rotY ? -3.0 : 3.0) };
/** café workers (karşı yaka): hire price grows per worker; each adds +40% customers, restocks from the till, takes an hourly wage */
export const ISCI_MAX = 3;
/** 2026-11-08 user: "karşı yakadaki kafeler bizim ilk büfe gibi değil, kendine has yiyecek içecekleri olmak zorunda, gelişim, eşya, işçi".
 * 2026-11-09 user: "her binaya girilebilmeli, kafe bistro lokanta, her birinde geliştirmeler yeni aletler (kafede kahve makinesi),
 * o yerler belirli bir seviyeden sonra satın alınıp işletilebilmeli". Every fixed business has a type (Isletme) with its own
 * menu (a level unlocks dishes: lv1 2, lv2 4, lv3 5, lv4 6, lv5 8), its own equipment (bought once, shown inside the building,
 * view/world/ic-mekan-look.ts) and its own stage names. Workers: up to lv+1 (max 6). */
export interface KafeYemek { id: string; ad: string; ikon: string; fiyat: number }
/** ic: shown inside (ic-mekan-look); teras: shown on the café terrace (karsi-yasam) */
export interface KafeEsya { id: string; ad: string; ikon: string; fiyat: number; lv: number; musteri?: number; fiyatK?: number; desc: string; teras?: boolean }
export type IsletmeId = 'kafe' | 'bistro' | 'kirtasiye' | 'kantin' | 'lokanta' | 'kafeterya' | 'giyim' | 'elektronik' | 'oyuncak'
  | 'sekerci' | 'kahveci' | 'dondurma' | 'baklava' | 'kuruyemis' | 'donerci' | 'kumpir' | 'midye' | 'sinema';
export interface Isletme { id: IsletmeId; ad: string; ikon: string; asama: string[]; mus: number; menu: KafeYemek[]; esya: KafeEsya[] }
const Y = (id: string, ad: string, ikon: string, fiyat: number): KafeYemek => ({ id, ad, ikon, fiyat });
const A = (id: string, ad: string, ikon: string, fiyat: number, lv: number, o: Partial<KafeEsya>, desc: string): KafeEsya => ({ id, ad, ikon, fiyat, lv, ...o, desc });
export const ISLETME: Record<IsletmeId, Isletme> = {
  kafe: { id: 'kafe', ad: 'Kafe', ikon: '☕', mus: 1, asama: ['Köşe kafe', 'Kafe', 'Kahve evi', 'Teraslı kafe', 'Gurme kafe'],
    menu: [Y('turk_kahvesi', 'Türk kahvesi', '☕', 26), Y('demlik_cay', 'Demlik çay', '🫖', 20), Y('kasarli_tost', 'Kaşarlı tost', '🥪', 37), Y('su_boregi', 'Su böreği', '🥧', 40),
      Y('filtre', 'Filtre kahve', '🥤', 38), Y('cheesecake', 'Cheesecake', '🍰', 57), Y('menemen', 'Menemen', '🍳', 65), Y('serpme', 'Serpme kahvaltı', '🧺', 140)],
    esya: [A('espresso', 'Espresso makinesi', '☕', 30000, 1, { fiyatK: 0.12 }, 'Tezgahta parlak makine: fiyatlar +%12'),
      A('semsiye', 'Teras şemsiyeleri', '⛱️', 22000, 1, { musteri: 0.12, teras: true }, 'Müşteri +%12, terasta görünür'),
      A('vitrin', 'Pasta vitrini', '🧊', 45000, 2, { musteri: 0.18 }, 'Işıklı soğuk vitrin: müşteri +%18'),
      A('koltuk', 'Chester koltuk köşesi', '🛋️', 34000, 2, { musteri: 0.1 }, 'Pencere önünde deri koltuklar: müşteri +%10'),
      A('isik', 'Işık zinciri', '💡', 26000, 2, { musteri: 0.1, teras: true }, 'Tavan ve teras akşam parlar: müşteri +%10'),
      A('muzik', 'Pikap ve hoparlör', '🎶', 38000, 3, { musteri: 0.12 }, 'Plaklar döner: müşteri +%12'),
      A('kitaplik', 'Kitaplık duvarı', '📚', 28000, 3, { musteri: 0.08 }, 'Kitap okuyanlar uzun oturur: müşteri +%8'),
      A('saksi', 'Saksı ve çiçekler', '🪴', 18000, 3, { musteri: 0.08, teras: true }, 'İçeride ve terasta yeşillik: müşteri +%8'),
      A('soba', 'Teras ısıtıcıları', '🔥', 55000, 4, { musteri: 0.15, teras: true }, 'Kışın da dolu: müşteri +%15'),
      A('barista', 'Barista istasyonu', '🏆', 90000, 5, { fiyatK: 0.2 }, 'Değirmen, demleme barı: fiyatlar +%20')] },
  bistro: { id: 'bistro', ad: 'Bistro', ikon: '🐟', mus: 0.9, asama: ['Sahil büfesi', 'Sahil bistro', 'Balık bistro', 'Teraslı bistro', 'Gurme bistro'],
    menu: [Y('limonata', 'Ev limonatası', '🍋', 31), Y('latte', 'Latte', '☕', 46), Y('waffle', 'Waffle', '🧇', 75), Y('frappe', 'Frappe', '🥤', 57),
      Y('balik_ekmek', 'Balık ekmek', '🐟', 75), Y('deniz_makarna', 'Deniz mahsullü makarna', '🍝', 120), Y('levrek', 'Levrek ızgara', '🐠', 190), Y('sufle', 'Sufle', '🍫', 65)],
    esya: [A('kahve_bar', 'Kahve barı', '☕', 32000, 1, { fiyatK: 0.1 }, 'Latte ve frappe istasyonu: fiyatlar +%10'),
      A('semsiye', 'Teras şemsiyeleri', '⛱️', 22000, 1, { musteri: 0.12, teras: true }, 'Müşteri +%12, terasta görünür'),
      A('waffle_mak', 'Waffle makinesi', '🧇', 26000, 2, { musteri: 0.12 }, 'Tatlı kokusu sokağa yayılır: müşteri +%12'),
      A('buz_vitrin', 'Buzlu balık vitrini', '🧊', 52000, 2, { musteri: 0.16 }, 'Günün balığı buzda: müşteri +%16'),
      A('isik', 'Işık zinciri', '💡', 26000, 2, { musteri: 0.1, teras: true }, 'Akşam terası parlar: müşteri +%10'),
      A('akvaryum', 'Akvaryum', '🐠', 48000, 3, { musteri: 0.12 }, 'Duvar boyu akvaryum: müşteri +%12'),
      A('mangal', 'Kömür ızgara', '🔥', 60000, 3, { fiyatK: 0.12 }, 'Levrek kömürde: fiyatlar +%12'),
      A('piyano', 'Piyano köşesi', '🎹', 70000, 4, { musteri: 0.14 }, 'Akşamları canlı müzik: müşteri +%14'),
      A('soba', 'Teras ısıtıcıları', '🔥', 55000, 4, { musteri: 0.15, teras: true }, 'Kışın da dolu: müşteri +%15'),
      A('sef_seti', 'Şef bıçak seti', '🔪', 95000, 5, { fiyatK: 0.2 }, 'Gurme tabaklar: fiyatlar +%20')] },
  kirtasiye: { id: 'kirtasiye', ad: 'Kırtasiye', ikon: '✏️', mus: 0.9, asama: ['Kırtasiye', 'Kırtasiye & fotokopi', 'Kitapçı', 'Kitap & hobi', 'Martı Kitabevi'],
    menu: [Y('kalem', 'Kurşun kalem', '✏️', 11), Y('defter', 'Spiralli defter', '📒', 30), Y('silgi', 'Silgi seti', '🧽', 15), Y('boya', 'Boya kalemi', '🖍️', 45),
      Y('fotokopi_s', 'Fotokopi', '📄', 8), Y('canta', 'Okul çantası', '🎒', 220), Y('roman', 'Roman', '📕', 80), Y('maket', 'Maket seti', '🧩', 150)],
    esya: [A('fotokopi', 'Fotokopi makinesi', '🖨️', 28000, 1, { musteri: 0.15 }, 'Öğrenciler kuyruğa girer: müşteri +%15'),
      A('pos', 'Kartlı ödeme', '💳', 12000, 1, { musteri: 0.08 }, 'Bozuk para derdi bitti: müşteri +%8'),
      A('laminasyon', 'Ciltleme ve laminasyon', '📎', 22000, 2, { fiyatK: 0.1 }, 'Ödev ciltleme: fiyatlar +%10'),
      A('kitap_raf', 'Kitap rafları', '📚', 40000, 2, { musteri: 0.15 }, 'Roman ve dergi köşesi: müşteri +%15'),
      A('vitrin_k', 'Kalem vitrini', '🖋️', 30000, 3, { fiyatK: 0.12 }, 'Dolma kalemler: fiyatlar +%12'),
      A('oyuncak', 'Oyuncak köşesi', '🧸', 36000, 3, { musteri: 0.14 }, 'Çocuklar annelerini çeker: müşteri +%14'),
      A('yazici3d', '3D yazıcı', '🧊', 75000, 4, { fiyatK: 0.15 }, 'Martı figürü basar: fiyatlar +%15'),
      A('okuma', 'Okuma köşesi', '🛋️', 45000, 5, { musteri: 0.18 }, 'Puf ve lamba: müşteri +%18')] },
  kantin: { id: 'kantin', ad: 'Okul kantini', ikon: '🥪', mus: 1.5, asama: ['Kantin', 'Kantin+', 'Okul büfesi', 'Kantin kafe', 'Yıldızlı kantin'],
    menu: [Y('ayran', 'Ayran', '🥛', 11), Y('simit_k', 'Simit', '🥯', 10), Y('tost_k', 'Karışık tost', '🥪', 30), Y('kek', 'Kek', '🧁', 14),
      Y('cikolatali_sut', 'Çikolatalı süt', '🍫', 17), Y('pizza', 'Pizza dilimi', '🍕', 35), Y('salata_k', 'Meyve kabı', '🍎', 23), Y('kofte_k', 'Köfte ekmek', '🍔', 47)],
    esya: [A('tost_mak', 'Tost makinesi', '🥪', 9000, 1, { fiyatK: 0.1 }, 'Çıtır tost: fiyatlar +%10'),
      A('buzdolap', 'İçecek dolabı', '🧃', 14000, 1, { musteri: 0.12 }, 'Soğuk ayran: müşteri +%12'),
      A('semaver_k', 'Semaver', '🫖', 11000, 2, { musteri: 0.1 }, 'Öğretmenler çay içer: müşteri +%10'),
      A('mikrodalga', 'Pizza fırını', '🍕', 22000, 2, { fiyatK: 0.1 }, 'Sıcak pizza: fiyatlar +%10'),
      A('meyve', 'Sağlıklı köşe', '🍎', 15000, 3, { musteri: 0.12 }, 'Veliler sever: müşteri +%12'),
      A('masa_k', 'Kantin masaları', '🪑', 18000, 3, { musteri: 0.14 }, 'Teneffüste oturacak yer: müşteri +%14'),
      A('ekran_k', 'Menü ekranı', '📺', 26000, 4, { fiyatK: 0.12 }, 'Dijital menü: fiyatlar +%12'),
      A('izgara_k', 'Köfte ızgarası', '🔥', 40000, 5, { fiyatK: 0.18 }, 'Köfte kokusu: fiyatlar +%18')] },
  lokanta: { id: 'lokanta', ad: 'Lokanta', ikon: '🍲', mus: 1.2, asama: ['Esnaf lokantası', 'Lokanta', 'Ocakbaşı', 'Kebapçı', 'Martı Sofrası'],
    menu: [Y('mercimek', 'Mercimek çorbası', '🥣', 45), Y('fasulye', 'Kuru fasulye pilav', '🍛', 75), Y('karniyarik', 'Karnıyarık', '🍆', 85), Y('lahmacun', 'Lahmacun', '🫓', 48),
      Y('pide', 'Kaşarlı pide', '🥙', 100), Y('iskender', 'İskender', '🥩', 170), Y('adana', 'Adana kebap', '🌶️', 160), Y('kunefe', 'Künefe', '🍮', 80)],
    esya: [A('benmari', 'Benmari tezgahı', '🍲', 40000, 1, { musteri: 0.15 }, 'Tencereler sıcak: müşteri +%15'),
      A('corba_kazan', 'Çorba kazanı', '🥣', 18000, 1, { fiyatK: 0.08 }, 'Sabah çorbası: fiyatlar +%8'),
      A('pide_firin', 'Taş fırın', '🔥', 75000, 2, { musteri: 0.18 }, 'Pide ve lahmacun fırından: müşteri +%18'),
      A('cay_ocak', 'Çay ocağı', '🫖', 15000, 2, { musteri: 0.08 }, 'Yemek üstü çay: müşteri +%8'),
      A('ocakbasi', 'Ocakbaşı mangal', '🍢', 90000, 3, { fiyatK: 0.15 }, 'Kebap közde: fiyatlar +%15'),
      A('doner', 'Döner ocağı', '🥙', 65000, 3, { musteri: 0.15 }, 'Dönen döner vitrinde: müşteri +%15'),
      A('tatli_vitrin', 'Tatlı vitrini', '🍮', 38000, 4, { musteri: 0.12 }, 'Künefe ve sütlaç: müşteri +%12'),
      A('led_menu', 'Işıklı menü panosu', '📺', 30000, 4, { fiyatK: 0.1 }, 'Fotoğraflı menü: fiyatlar +%10'),
      A('sef_ocak', 'Usta ocağı', '👨‍🍳', 120000, 5, { fiyatK: 0.22 }, 'Usta işi: fiyatlar +%22')] },
  kafeterya: { id: 'kafeterya', ad: 'Tesis kafeteryası', ikon: '⚽', mus: 1.1, asama: ['Soyunma çay ocağı', 'Kafeterya', 'Spor kafe', 'Taraftar kafe', 'Kulüp lokali'],
    menu: [Y('cay_t', 'Çay', '🍵', 12), Y('gazoz_t', 'Boğaz Gazozu', '🥤', 22), Y('tost_t', 'Sucuklu tost', '🥪', 40), Y('enerji', 'Martı Enerji', '⚡', 31),
      Y('kofte_t', 'Köfte ekmek', '🍔', 58), Y('protein', 'Protein bar', '🍫', 32), Y('kumpir_t', 'Kumpir', '🥔', 70), Y('mac_menu', 'Maç menüsü', '🍟', 100)],
    esya: [A('cay_mak', 'Çay makinesi', '🍵', 9000, 1, { musteri: 0.1 }, 'Soyunmadan çıkan çay içer: müşteri +%10'),
      A('icecek_dolap', 'İçecek dolabı', '🥤', 14000, 1, { fiyatK: 0.08 }, 'Soğuk gazoz: fiyatlar +%8'),
      A('mac_tv', 'Maç ekranı', '📺', 30000, 2, { musteri: 0.18 }, 'Dev ekranda lig: müşteri +%18'),
      A('langirt', 'Langırt', '⚽', 22000, 2, { musteri: 0.12 }, 'Sıra bekleyen içer: müşteri +%12'),
      A('kupa', 'Kupa vitrini', '🏆', 40000, 3, { musteri: 0.1 }, 'Kulüp kupaları: müşteri +%10'),
      A('izgara_t', 'Köfte ızgarası', '🔥', 45000, 3, { fiyatK: 0.14 }, 'Maç sonu köfte: fiyatlar +%14'),
      A('forma_duvar', 'Forma duvarı', '👕', 35000, 4, { musteri: 0.12 }, 'İmzalı formalar: müşteri +%12'),
      A('vip', 'VIP loca', '🎟️', 85000, 5, { fiyatK: 0.2 }, 'Saha manzaralı koltuklar: fiyatlar +%20')] },
  // 2026-11-20 AVM shops (holding yolu, ilk adım giyim): goods are sold at a net price, NO stock; few customers, big tickets.
  // mus is low on purpose: revenue per hour stays near the lokanta's per lira of plot price (see tests/sim/avm-magaza.test.ts).
  giyim: { id: 'giyim', ad: 'Giyim mağazası', ikon: '👕', mus: 0.16, asama: ['Butik', 'Moda mağazası', 'Marka mağazası', 'Konsept mağaza', 'Martı Moda Evi'],
    menu: [Y('tisort', 'Tişört', '👕', 180), Y('kot', 'Kot pantolon', '👖', 420), Y('gomlek', 'Gömlek', '👔', 320), Y('sweat', 'Kapüşonlu sweat', '🧥', 390),
      Y('elbise', 'Elbise', '👗', 600), Y('spor_ayk', 'Spor ayakkabı', '👟', 850), Y('mont', 'Mont', '🧥', 950), Y('takim', 'Takım elbise', '🤵', 1600)],
    esya: [A('askilik', 'Askılı reyon', '🧺', 30000, 1, { musteri: 0.15 }, 'Yeni sezon ortada döner: müşteri +%15'),
      A('manken', 'Vitrin mankenleri', '🧍', 26000, 1, { musteri: 0.12 }, 'Kapıdan geçen içeri bakar: müşteri +%12'),
      A('prova', 'Prova kabini', '🚪', 34000, 2, { fiyatK: 0.1 }, 'Deneyen alır: fiyatlar +%10'),
      A('ayna', 'Boy aynası', '🪞', 18000, 2, { musteri: 0.1 }, 'Kendini beğenen tekrar gelir: müşteri +%10'),
      A('ayakkabi', 'Ayakkabı reyonu', '👟', 45000, 3, { musteri: 0.14 }, 'Spor ve klasik ayakkabı duvarı: müşteri +%14'),
      A('aksesuar', 'Aksesuar standı', '👜', 38000, 3, { fiyatK: 0.12 }, 'Çanta, şapka, kemer: fiyatlar +%12'),
      A('led_vitrin', 'Işıklı vitrin panosu', '💡', 42000, 4, { musteri: 0.12 }, 'Kampanya ekranı: müşteri +%12'),
      A('tasarim', 'Tasarımcı köşesi', '🧵', 110000, 5, { fiyatK: 0.2 }, 'Dikiş makinesi, özel dikim: fiyatlar +%20')] },
  elektronik: { id: 'elektronik', ad: 'Elektronik mağazası', ikon: '📱', mus: 0.12, asama: ['Telefoncu', 'Elektronik', 'Teknoloji mağazası', 'Tekno market', 'Tekno Martı Plaza'],
    menu: [Y('kulaklik', 'Kulaklık', '🎧', 400), Y('powerbank', 'Powerbank', '🔋', 550), Y('sarj_kablo', 'Şarj kablosu', '🔌', 140), Y('kilif', 'Telefon kılıfı', '📱', 170),
      Y('hoparlor', 'Bluetooth hoparlör', '🔊', 950), Y('akilli_saat', 'Akıllı saat', '⌚', 1900), Y('tablet', 'Tablet', '💻', 2200), Y('telefon', 'Akıllı telefon', '📱', 3000)],
    esya: [A('demo_masa', 'Deneme masası', '📱', 36000, 1, { musteri: 0.15 }, 'Telefonlar elde denenir: müşteri +%15'),
      A('tamir', 'Tamir tezgâhı', '🛠️', 24000, 1, { musteri: 0.1 }, 'Ekran değişimi bekleyen alışveriş yapar: müşteri +%10'),
      A('tv_duvar', 'TV duvarı', '📺', 60000, 2, { musteri: 0.14 }, 'Dev ekranlar sokaktan görünür: müşteri +%14'),
      A('kulaklik_stand', 'Kulaklık standı', '🎧', 22000, 2, { fiyatK: 0.08 }, 'Dinleyen alır: fiyatlar +%8'),
      A('konsol', 'Oyun konsolu köşesi', '🎮', 55000, 3, { musteri: 0.14 }, 'Gençler maç yapar: müşteri +%14'),
      A('vr', 'VR deneme alanı', '🥽', 70000, 3, { fiyatK: 0.1 }, 'Gözlüğü takan cüzdanı açar: fiyatlar +%10'),
      A('drone', 'Drone vitrini', '🚁', 48000, 4, { musteri: 0.1 }, 'Tavanda süzülen drone: müşteri +%10'),
      A('led_e', 'Işıklı reklam panosu', '💡', 90000, 5, { fiyatK: 0.15 }, 'Lansman kampanyaları: fiyatlar +%15')] },
  oyuncak: { id: 'oyuncak', ad: 'Oyuncakçı', ikon: '🧸', mus: 0.28, asama: ['Oyuncakçı', 'Oyuncak dükkânı', 'Oyuncak mağazası', 'Oyun dünyası', 'Oyuncak Dünyası Mega'],
    menu: [Y('pelus', 'Peluş martı', '🧸', 140), Y('yapboz', 'Yapboz', '🧩', 160), Y('araba', 'Oyuncak araba', '🚗', 120), Y('bebek', 'Oyuncak bebek', '🪆', 280),
      Y('kutu_oyun', 'Kutu oyunu', '🎲', 380), Y('yapi_seti', 'Yapı seti', '🧱', 450), Y('rc_araba', 'Uzaktan kumandalı araba', '🏎️', 650), Y('tren_seti', 'Tren seti', '🚂', 900)],
    esya: [A('pelus_sepet', 'Peluş sepeti', '🧸', 18000, 1, { musteri: 0.12 }, 'Çocuklar kucaklar, anneler alır: müşteri +%12'),
      A('balon', 'Balon köşesi', '🎈', 12000, 1, { musteri: 0.1 }, 'Kapıda renkli balonlar: müşteri +%10'),
      A('tren_pist', 'Oyuncak tren pisti', '🚂', 40000, 2, { musteri: 0.15 }, 'Masada dönen tren: müşteri +%15'),
      A('lego_duvar', 'Yapı seti duvarı', '🧱', 36000, 2, { fiyatK: 0.1 }, 'Kutu kutu setler: fiyatlar +%10'),
      A('oyun_kale', 'Oyun kalesi', '🏰', 55000, 3, { musteri: 0.14 }, 'Kaydıraklı köşe: müşteri +%14'),
      A('maskot', 'Dev martı maskotu', '🐦', 30000, 3, { musteri: 0.1 }, 'Fotoğraf çektiren çok: müşteri +%10'),
      A('hediye_paket', 'Hediye paketi tezgâhı', '🎁', 26000, 4, { fiyatK: 0.12 }, 'Kurdeleli paket: fiyatlar +%12'),
      A('led_o', 'Işıklı vitrin', '✨', 70000, 5, { fiyatK: 0.18 }, 'Yıldızlı tavan vitrini: fiyatlar +%18')] },
  // 2026-11-21 Martı AVM katları (sahip: "her katında mağaza olsun, aynı mantık"): yemek / yemeğe yakın dükkânlar, NET fiyat, STOK YOK.
  // Gelir bandı: arsa fiyatı başına saatlik gelir lokantanınkiyle aynı bantta (tests/sim/avm-magaza.test.ts).
  sekerci: { id: 'sekerci', ad: 'Şekerci', ikon: '🍬', mus: 0.95, asama: ['Şekerci', 'Lokumcu', 'Şekerleme evi', 'Akide sarayı', 'Hacı Martı Konağı'],
    menu: [Y('akide', 'Akide şekeri', '🍬', 22), Y('lokum', 'Güllü lokum', '🌹', 38), Y('pismaniye', 'Pişmaniye', '☁️', 45), Y('macun', 'Dört renk macun', '🍭', 30),
      Y('kestane_sekeri', 'Kestane şekeri', '🌰', 70), Y('cikolata_el', 'El yapımı çikolata', '🍫', 65), Y('fistikli_lokum', 'Çifte kavrulmuş lokum', '💚', 85), Y('lokum_kutu', 'Hediyelik lokum kutusu', '🎁', 210)],
    esya: [A('lokum_tezgah', 'Lokum kesme tezgâhı', '🔪', 16000, 1, { fiyatK: 0.1 }, 'Lokum gözünün önünde kesilir: fiyatlar +%10'),
      A('cam_kavanoz', 'Cam kavanoz rafı', '🫙', 14000, 1, { musteri: 0.12 }, 'Rengârenk akideler camda parlar: müşteri +%12'),
      A('macuncu', 'Macuncu tepsisi', '🍭', 12000, 2, { musteri: 0.1 }, 'Çubukta dört renk macun, çocuklar bayılır: müşteri +%10'),
      A('pismaniye_tezgah', 'Pişmaniye çekme tezgâhı', '☁️', 30000, 2, { fiyatK: 0.12 }, 'Usta çekerken herkes izler: fiyatlar +%12'),
      A('kestane_ocak', 'Kestane şekeri kazanı', '🌰', 26000, 3, { musteri: 0.12 }, 'Şurupta pişen kestane kokusu galeriye yayılır: müşteri +%12'),
      A('hediye_kutu', 'Hediye kutusu standı', '🎁', 22000, 3, { fiyatK: 0.1 }, 'Bayramlık kurdeleli kutular: fiyatlar +%10'),
      A('cikolata_vitrin', 'Çikolata vitrini', '🍫', 36000, 4, { musteri: 0.12 }, 'Soğuk camda pralinler: müşteri +%12'),
      A('osmanli_tezgah', 'Pirinç sunum tepsisi', '👑', 80000, 5, { fiyatK: 0.2 }, 'Lale desenli pirinç tepside ikram: fiyatlar +%20')] },
  kahveci: { id: 'kahveci', ad: 'Kahve dükkânı', ikon: '☕', mus: 1.35, asama: ['Kahve tezgâhı', 'Kahveci', 'Kahve atölyesi', 'Kavurma evi', 'Telve Laboratuvarı'],
    menu: [Y('kumda_kahve', 'Kumda Türk kahvesi', '☕', 36), Y('dibek', 'Dibek kahvesi', '🫘', 40), Y('flat_white', 'Flat white', '🥛', 55), Y('menengic', 'Menengiç kahvesi', '🌰', 44),
      Y('soguk_demleme', 'Soğuk demleme', '🧊', 60), Y('marti_latte', 'Martı desenli latte', '🐦', 66), Y('kahve_fal', 'Kahve + fal', '🔮', 90), Y('cekirdek', 'Paket çekirdek kahve', '🫘', 160)],
    esya: [A('kum_ocak', 'Kum ocağı', '🔥', 16000, 1, { fiyatK: 0.1 }, 'Cezveler sıcak kumda köpürür: fiyatlar +%10'),
      A('espresso_t', 'Çift gruplu espresso', '☕', 30000, 1, { musteri: 0.12 }, 'Sabah kuyruğu erir: müşteri +%12'),
      A('degirmen', 'Taş değirmen', '⚙️', 14000, 2, { fiyatK: 0.08 }, 'Taze çekilmiş: fiyatlar +%8'),
      A('dibek_havan', 'Dibek havanı', '🪵', 18000, 2, { musteri: 0.1 }, 'Tok tok sesi galeriden duyulur: müşteri +%10'),
      A('demleme_bar', 'Demleme barı', '🧪', 34000, 3, { fiyatK: 0.12 }, 'V60, Chemex, laboratuvar havası: fiyatlar +%12'),
      A('kavurucu', 'Kahve kavurma makinesi', '🫘', 55000, 3, { musteri: 0.15 }, 'Taze kavrulmuş kahve kokusu bütün kata yayılır: müşteri +%15'),
      A('falci', 'Falcı köşesi', '🔮', 30000, 4, { musteri: 0.12 }, 'Fincanı kapatan bekler, falcı "yolculuk görüyorum" der: müşteri +%12'),
      A('latte_sanat', 'Latte sanatı ustası', '🎨', 80000, 5, { fiyatK: 0.2 }, 'Köpükte martı, vapur, Galata: fiyatlar +%20')] },
  dondurma: { id: 'dondurma', ad: 'Dondurmacı', ikon: '🍨', mus: 1.45, asama: ['Dondurma arabası', 'Dondurmacı', 'Maraş dondurması', 'Dondurma salonu', 'Maraşlı Martı Sarayı'],
    menu: [Y('kulah', 'Sade külah', '🍦', 28), Y('kaymakli', 'Kaymaklı dondurma', '🍨', 38), Y('sakizli', 'Sakızlı dondurma', '🍧', 40), Y('sorbe', 'Limonlu sorbe', '🍋', 42),
      Y('cikolatali_kup', 'Çikolatalı kup', '🍫', 50), Y('kesme_maras', 'Bıçakla kesme Maraş', '🔪', 72), Y('dondurmali_waffle', 'Dondurmalı waffle', '🧇', 85), Y('dev_kup', 'Martı kupu (7 top)', '🏆', 130)],
    esya: [A('dondurma_vitrin', 'Dondurma vitrini', '🍨', 32000, 1, { musteri: 0.14 }, 'Kapaklı güğümler sıra sıra: müşteri +%14'),
      A('dovme_kazan', 'Dövme kazanı', '🥄', 20000, 1, { fiyatK: 0.1 }, 'Uzun kaşıkla dövülür, metre metre uzar: fiyatlar +%10'),
      A('sopa_sov', 'Şov sopası', '🎪', 12000, 2, { musteri: 0.12 }, 'Külahı verir, geri alır, herkes güler: müşteri +%12'),
      A('kulah_kalip', 'Külah fırını', '🍦', 18000, 2, { fiyatK: 0.08 }, 'Çıtır taze külah: fiyatlar +%8'),
      A('sorbe', 'Sorbe makinesi', '🍓', 26000, 3, { musteri: 0.1 }, 'Yazın en çok giden: müşteri +%10'),
      A('waffle_mak_d', 'Waffle makinesi', '🧇', 22000, 3, { fiyatK: 0.12 }, 'Sıcak waffle soğuk dondurma: fiyatlar +%12'),
      A('zil', 'Dondurmacı çanı', '🔔', 10000, 4, { musteri: 0.12 }, 'Çan çaldı mı bütün çocuklar koşar: müşteri +%12'),
      A('kar_dolap', 'Maraş kar dolabı', '❄️', 75000, 5, { fiyatK: 0.2 }, 'Keçi sütü, salep, gerçek Maraş: fiyatlar +%20')] },
  baklava: { id: 'baklava', ad: 'Baklavacı', ikon: '🥮', mus: 1.25, asama: ['Baklava tezgâhı', 'Baklavacı', 'Tatlıcı', 'Tatlı sarayı', 'Şerbetçi Sarayı'],
    menu: [Y('sutlac', 'Fırın sütlaç', '🍮', 38), Y('kazandibi', 'Kazandibi', '🍮', 42), Y('baklava', 'Fıstıklı baklava', '🥮', 58), Y('tel_kadayif', 'Tel kadayıf', '🍯', 50),
      Y('sobiyet', 'Şöbiyet', '🥮', 64), Y('kunefe_b', 'Künefe', '🧀', 82), Y('ekmek_kadayif', 'Kaymaklı ekmek kadayıfı', '🍯', 72), Y('baklava_tepsi', 'Bir tepsi baklava', '🎁', 330)],
    esya: [A('tatli_vitrin_b', 'Tatlı vitrini', '🧁', 28000, 1, { musteri: 0.14 }, 'Tepsiler ışıkta parlar: müşteri +%14'),
      A('serbet_kazan', 'Şerbet kazanı', '🍯', 14000, 1, { fiyatK: 0.08 }, 'Kıvamında şerbet: fiyatlar +%8'),
      A('oklava', 'Oklava ve hamur masası', '🪵', 22000, 2, { fiyatK: 0.1 }, 'Kırk kat yufka elde açılır: fiyatlar +%10'),
      A('tas_firin_b', 'Baklava fırını', '🔥', 50000, 2, { musteri: 0.12 }, 'Tereyağı kokusu koridora taşar: müşteri +%12'),
      A('kaymak', 'Kaymak dolabı', '🥛', 22000, 3, { fiyatK: 0.1 }, 'Manda kaymağı yanında: fiyatlar +%10'),
      A('kunefe_ocak', 'Künefe ocağı', '🧀', 30000, 3, { musteri: 0.12 }, 'Tel tel uzayan peynir: müşteri +%12'),
      A('bakir_tepsi', 'Bakır tepsi duvarı', '🟠', 26000, 4, { musteri: 0.1 }, 'Duvarda dede yadigârı tepsiler: müşteri +%10'),
      A('serbetci_usta', 'Usta tezgâhı', '👨‍🍳', 85000, 5, { fiyatK: 0.2 }, 'Antepli usta, yüzde yüz fıstık: fiyatlar +%20')] },
  kuruyemis: { id: 'kuruyemis', ad: 'Kuruyemişçi', ikon: '🥜', mus: 1.5, asama: ['Çerezci', 'Kuruyemişçi', 'Kavurmacı', 'Kuruyemiş evi', 'Çıtırcı Kavurma Sarayı'],
    menu: [Y('leblebi', 'Sarı leblebi', '🫘', 20), Y('ay_cekirdek', 'Ay çekirdeği', '🌻', 24), Y('kabak_cekirdek', 'Kabak çekirdeği', '🎃', 36), Y('kuru_kayisi', 'Kuru kayısı', '🍑', 52),
      Y('findik', 'Kavrulmuş fındık', '🌰', 62), Y('karisik_cerez', 'Karışık çerez', '🥜', 78), Y('antep', 'Antep fıstığı', '🥜', 96), Y('cerez_sepet', 'Maç gecesi çerez sepeti', '🧺', 190)],
    esya: [A('cuval', 'Çuval reyonu', '🧺', 12000, 1, { musteri: 0.12 }, 'Ağzı açık çuvallar, kepçe başında: müşteri +%12'),
      A('terazi', 'Dijital terazi', '⚖️', 10000, 1, { fiyatK: 0.08 }, 'Gramı gramına: fiyatlar +%8'),
      A('kavurma_kazan', 'Kavurma kazanı', '🔥', 36000, 2, { musteri: 0.15 }, 'Sıcak fıstık kokusu: müşteri +%15'),
      A('cam_hazne', 'Cam hazneler', '🫙', 22000, 2, { fiyatK: 0.1 }, 'Kapaklı cam bölmeler: fiyatlar +%10'),
      A('kuru_meyve', 'Kuru meyve kasaları', '🍑', 20000, 3, { musteri: 0.1 }, 'Kayısı, incir, dut: müşteri +%10'),
      A('paket_mak', 'Paketleme makinesi', '📦', 26000, 3, { fiyatK: 0.1 }, 'Vakumlu paket: fiyatlar +%10'),
      A('tadim', 'Tadım tabağı', '🥄', 12000, 4, { musteri: 0.12 }, 'Bir tane tadan bir kilo alır: müşteri +%12'),
      A('kavurma_ustasi', 'Usta kavurma hattı', '👨‍🍳', 75000, 5, { fiyatK: 0.2 }, 'Çifte kavrulmuş, tuzu kıvamında: fiyatlar +%20')] },
  donerci: { id: 'donerci', ad: 'Dönerci', ikon: '🌯', mus: 1.25, asama: ['Döner tezgâhı', 'Dönerci', 'Dürüm evi', 'Döner salonu', 'Dürümcü Dayı Holding'],
    menu: [Y('ayran_d', 'Yayık ayran', '🥛', 20), Y('yarim_ekmek', 'Yarım ekmek döner', '🥖', 70), Y('tavuk_durum', 'Tavuk dürüm', '🌯', 72), Y('tombik', 'Tombik döner', '🥙', 88),
      Y('et_durum', 'Et dürüm', '🌯', 110), Y('pilav_ustu', 'Pilav üstü döner', '🍛', 118), Y('dayi_iskender', 'Dayı usulü İskender', '🥩', 175), Y('metre_durum', 'Bir metre dürüm', '📏', 260)],
    esya: [A('doner_ocak', 'Döner ocağı', '🔥', 36000, 1, { musteri: 0.15 }, 'Dönen döner camdan görünür: müşteri +%15'),
      A('lavas_sac', 'Lavaş sacı', '🫓', 14000, 1, { fiyatK: 0.08 }, 'Sacdan sıcak lavaş: fiyatlar +%8'),
      A('ayran_yayik', 'Ayran yayığı', '🥛', 12000, 2, { musteri: 0.1 }, 'Köpüklü yayık ayranı: müşteri +%10'),
      A('tursu', 'Turşu bidonları', '🥒', 10000, 2, { musteri: 0.08 }, 'Yanında bol turşu: müşteri +%8'),
      A('ikinci_sis', 'İkinci döner şişi', '🍢', 50000, 3, { musteri: 0.15 }, 'Biri tavuk biri et: müşteri +%15'),
      A('pilav_kazan', 'Pilav kazanı', '🍚', 20000, 3, { fiyatK: 0.1 }, 'Tereyağlı pilav: fiyatlar +%10'),
      A('led_d', 'Işıklı menü', '📺', 24000, 4, { fiyatK: 0.1 }, 'Fotoğraflı menü: fiyatlar +%10'),
      A('dayi_bicak', 'Dayının elektrikli bıçağı', '🔪', 75000, 5, { fiyatK: 0.2 }, 'Kâğıt inceliğinde dilim: fiyatlar +%20')] },
  kumpir: { id: 'kumpir', ad: 'Kumpirci', ikon: '🥔', mus: 1.3, asama: ['Kumpir arabası', 'Kumpirci', 'Ortaköy usulü', 'Kumpir evi', 'Kumpir Kulesi'],
    menu: [Y('limonata_k', 'Ev limonatası', '🍋', 30), Y('citir_patates', 'Çıtır patates', '🍟', 45), Y('sade_kumpir', 'Tereyağlı kumpir', '🥔', 65), Y('kasarli_kumpir', 'Kaşarlı kumpir', '🧀', 80),
      Y('sucuklu_kumpir', 'Sucuklu kumpir', '🌭', 102), Y('karisik_kumpir', 'Karışık kumpir', '🥔', 110), Y('tavuklu_kumpir', 'Tavuklu kumpir', '🍗', 115), Y('kule_kumpir', 'Kule kumpir (üç kat)', '🗼', 215)],
    esya: [A('kumpir_firin', 'Kumpir fırını', '🔥', 32000, 1, { musteri: 0.14 }, 'Camda sıra sıra koca patatesler: müşteri +%14'),
      A('ic_bari', 'İç barı', '🥗', 26000, 1, { fiyatK: 0.1 }, 'Yirmi çeşit iç: fiyatlar +%10'),
      A('limonata_dispenser', 'Limonata fıçısı', '🍋', 10000, 2, { musteri: 0.08 }, 'Buz gibi limonata: müşteri +%8'),
      A('fritoz_k', 'Fritöz', '🍟', 20000, 2, { musteri: 0.1 }, 'Çıtır patates: müşteri +%10'),
      A('ezme_tezgah', 'Tereyağı-kaşar ezme tezgâhı', '🧈', 18000, 3, { fiyatK: 0.1 }, 'Ortaköy usulü ezme: fiyatlar +%10'),
      A('neon', 'Neon tabela', '💡', 22000, 3, { musteri: 0.12 }, 'Pembe neon "KUMPİR": müşteri +%12'),
      A('kule_vitrin', 'Kule vitrini', '🗼', 40000, 4, { musteri: 0.12 }, 'Üç katlı kumpir camda döner: müşteri +%12'),
      A('usta_k', 'Ortaköylü usta', '👨‍🍳', 75000, 5, { fiyatK: 0.2 }, 'Kırk yıllık usta: fiyatlar +%20')] },
  sinema: { id: 'sinema', ad: 'Sinema Büfesi', ikon: '🍿', mus: 1.6,   // açık stand, mısır kokusu katı sarar: seans kalabalığı uğrar
    asama: ['Mısır tezgâhı', 'Sinema büfesi', 'Mısır & slush', 'Fuaye büfesi', 'Martı Sinema Büfesi'],
    menu: [Y('misir_kucuk', 'Küçük mısır', '🍿', 35), Y('kolaz', 'Kolaz (dolaptan)', '🥤', 30), Y('gazoz', 'Boğaz Gazozu', '🍾', 25), Y('soda', 'Martı Soda', '🫧', 20),
      Y('misir_kova', 'Kova mısır', '🍿', 95), Y('slush', 'Buzlu slush', '🧊', 45), Y('nachos', 'Peynirli nachos', '🧀', 70), Y('film_menu', 'Film menüsü (kova + 2 Kolaz)', '🎬', 165)],
    esya: [A('misir_mak', 'Mısır makinesi', '🍿', 30000, 1, { musteri: 0.14 }, 'Camlı kazanda patlayan mısır, koku bütün kata yayılır, gelen geçenin canı çeker: müşteri +%14'),
      A('icecek_dolap_s', 'İçecek dolabı', '🧊', 16000, 1, { musteri: 0.1 }, 'Buz gibi Kolaz, soda, Boğaz Gazozu: müşteri +%10'),
      A('karamel_kazan', 'Karamel kazanı', '🍯', 18000, 2, { fiyatK: 0.1 }, 'Karamelli mısır: fiyatlar +%10'),
      A('slush_mak', 'Slush makinesi', '🧊', 22000, 2, { musteri: 0.1 }, 'Dönen renkli buz: müşteri +%10'),
      A('nacho_isitici', 'Nachos ısıtıcı', '🧀', 24000, 3, { fiyatK: 0.1 }, 'Erimiş peynirli nachos: fiyatlar +%10'),
      A('afis_vitrin', 'Işıklı afiş vitrini', '🎬', 20000, 3, { musteri: 0.12 }, 'Vizyondaki filmler ışıl ışıl: müşteri +%12'),
      A('led_menu_s', 'LED menü panosu', '💡', 26000, 4, { musteri: 0.12 }, 'Kayan fiyatlar ve fragman: müşteri +%12'),
      A('vip_bar', 'VIP salon servisi', '⭐', 70000, 5, { fiyatK: 0.2 }, 'Koltuğa servis, kadife kordon: fiyatlar +%20')] },
  midye: { id: 'midye', ad: 'Midyeci', ikon: '🦪', mus: 1.5, asama: ['Midye tablası', 'Midyeci', 'Midye & tava', 'Deniz mezecisi', 'Midyeci Mido Saray'],
    menu: [Y('salgam', 'Şalgam', '🥤', 22), Y('midye_dolma', 'Midye dolma (5 tane)', '🦪', 42), Y('midye_tava', 'Midye tava', '🍤', 68), Y('balik_durum', 'Balık dürüm', '🐟', 85),
      Y('kalamar', 'Kalamar tava', '🦑', 98), Y('karides_guvec', 'Karides güveç', '🍤', 135), Y('levrek_sis', 'Levrek şiş', '🍢', 155), Y('mido_tabak', 'Mido tabağı (30 midye)', '🏆', 230)],
    esya: [A('midye_tabla', 'Midye tablası', '🦪', 14000, 1, { musteri: 0.14 }, 'Limonlu midye tepeleri: müşteri +%14'),
      A('limon_sepet', 'Limon sepeti', '🍋', 6000, 1, { fiyatK: 0.06 }, 'Bol limon: fiyatlar +%6'),
      A('tava_ocak', 'Tava ocağı', '🔥', 30000, 2, { musteri: 0.12 }, 'Çıtır tava: müşteri +%12'),
      A('buz_tezgah_m', 'Buzlu deniz tezgâhı', '🧊', 36000, 2, { musteri: 0.12 }, 'Kalamar, karides, levrek buzda: müşteri +%12'),
      A('guvec_firin', 'Güveç fırını', '🍲', 34000, 3, { fiyatK: 0.12 }, 'Kaşarlı karides güveç: fiyatlar +%12'),
      A('ag_sus', 'Balıkçı ağı', '🎣', 10000, 3, { musteri: 0.08 }, 'Duvarda ağ ve şamandıralar: müşteri +%8'),
      A('akvaryum_m', 'Istakoz akvaryumu', '🦞', 55000, 4, { musteri: 0.12 }, 'İçinde Mido\'nun ıstakozu Kemal: müşteri +%12'),
      A('mido_tezgah', 'Mido\'nun altın tezgâhı', '👑', 85000, 5, { fiyatK: 0.2 }, 'Altın varaklı tepsi: fiyatlar +%20')] },
};
/** compatibility: menus by plot id (k1/k2 tests and older code) */
export const KAFE_MENU: Record<string, KafeYemek[]> = { k1: ISLETME.kafe.menu, k2: ISLETME.bistro.menu };
export const KAFE_MENU_LV = [0, 2, 4, 5, 6, 8];
/** fixed plot id -> its business type */
export const ARSA_ISLETME: Record<string, IsletmeId> = { k1: 'kafe', k2: 'bistro', k3: 'kirtasiye', k4: 'kantin', k5: 'lokanta', k6: 'kafeterya', k7: 'giyim', k8: 'elektronik', k9: 'oyuncak',
  k10: 'sekerci', k11: 'kahveci', k12: 'dondurma', k13: 'baklava', k14: 'kuruyemis', k15: 'donerci', k16: 'kumpir', k17: 'midye', k18: 'sinema' };
export const isletmeOf = (arsaId: string): Isletme => ISLETME[ARSA_ISLETME[arsaId] || 'kafe'];
export const kafeMenu = (id: string, lv: number) => isletmeOf(id).menu.slice(0, KAFE_MENU_LV[Math.max(0, Math.min(5, lv))] || 2);
export const KAFE_ESYA: KafeEsya[] = ISLETME.kafe.esya;
export const KAFE_ESYA_BY_ID: Record<string, KafeEsya> = Object.fromEntries(KAFE_ESYA.map(e => [e.id, e]));
export const isletmeEsya = (arsaId: string, e: string) => isletmeOf(arsaId).esya.find(x => x.id === e);

/** Büfe salonları (2026-11-09): equipment for the pier halls (view/world/bufe-buyume.ts), bought once, raises the hourly salon income
 *  (sim/salon.ts). salon: which hall shows it (W kahvaltı from stage 6, E balık from stage 7). */
export interface SalonEsya { id: string; ad: string; ikon: string; fiyat: number; salon: 'W' | 'E'; asama: number; misK?: number; adisK?: number; desc: string }
export const SALON_ESYA: SalonEsya[] = [
  { id: 'semaver_dev', ad: 'Dev semaver', ikon: '🫖', fiyat: 60000, salon: 'W', asama: 6, misK: 0.08, desc: 'Bakır semaver, demlik çay hiç bitmez: misafir +%8' },
  { id: 'tas_firin', ad: 'Taş fırın', ikon: '🔥', fiyat: 140000, salon: 'W', asama: 6, adisK: 0.1, desc: 'Sıcak simit, pişi, pide: adisyon +%10' },
  { id: 'gozleme', ad: 'Gözleme tezgahı', ikon: '🫓', fiyat: 80000, salon: 'W', asama: 6, misK: 0.08, desc: 'Teyze camın arkasında açar: misafir +%8' },
  { id: 'bal_kaymak', ad: 'Bal & kaymak standı', ikon: '🍯', fiyat: 110000, salon: 'W', asama: 8, adisK: 0.08, desc: 'Petek bal, manda kaymağı: adisyon +%8' },
  { id: 'buz_tezgah', ad: 'Buzlu balık tezgahı', ikon: '🧊', fiyat: 160000, salon: 'E', asama: 7, misK: 0.1, desc: 'Günün balığı buzda seçilir: misafir +%10' },
  { id: 'mangal_e', ad: 'Kömür mangal', ikon: '🔥', fiyat: 180000, salon: 'E', asama: 7, adisK: 0.1, desc: 'Lüfer közde: adisyon +%10' },
  { id: 'akvaryum_e', ad: 'Dev akvaryum', ikon: '🐠', fiyat: 220000, salon: 'E', asama: 8, misK: 0.08, desc: 'Duvar boyu akvaryum: misafir +%8' },
  { id: 'meze_dolap', ad: 'Meze dolabı', ikon: '🥗', fiyat: 150000, salon: 'E', asama: 8, adisK: 0.08, desc: 'Otuz çeşit meze: adisyon +%8' },
  { id: 'piyano_s', ad: 'Kuyruklu piyano', ikon: '🎹', fiyat: 400000, salon: 'E', asama: 10, misK: 0.1, adisK: 0.06, desc: 'Fine dining akşamları: misafir +%10, adisyon +%6' },
  { id: 'sarkuteri', ad: 'Şarküteri vitrini', ikon: '🧀', fiyat: 260000, salon: 'W', asama: 10, adisK: 0.1, desc: 'Peynirler, zeytinler, şarküteri: adisyon +%10' },
];
export const SALON_ESYA_BY_ID: Record<string, SalonEsya> = Object.fromEntries(SALON_ESYA.map(e => [e.id, e]));
/** sahnede en fazla 3 gerçek işçi aktörü (agents/kafe.ts) var: ödenen her işçi tezgahta görünür */
export const KAFE_ISCI_TAVAN = 3;
export const kafeIsciMax = (lv: number) => Math.min(KAFE_ISCI_TAVAN, lv + 1);
export const isciFiyat = (n: number) => 12000 * (n + 1), ISCI_SAAT_UCRET = 60, ISCI_MUSTERI = 0.4;

/** shop types (D). One shared engine: müşteri -> satış -> upgrade. net fiyat per unit, musteri per game hour at level 1. */
export interface DukkanTip { id: string; ad: string; ikon: string; renk: string; tabela: string; fiyat: number; musteri: number; kurulum: number; seviye: number }
export const DUKKAN_TIPLERI: DukkanTip[] = [
  { id: 'bufe', ad: 'Büfe (Simit & Çay)', ikon: '🥯', renk: '#e0533c', tabela: 'SİMİT ÇAY', fiyat: 8, musteri: 5, kurulum: 20000, seviye: 1 },
  { id: 'manav', ad: 'Manav & Bakkal', ikon: '🍎', renk: '#6fae55', tabela: 'MANAV', fiyat: 9, musteri: 5, kurulum: 30000, seviye: 1 },
  { id: 'berber', ad: 'Berber', ikon: '💈', renk: '#2f6f9a', tabela: 'BERBER', fiyat: 16, musteri: 3, kurulum: 45000, seviye: 4 },
  { id: 'kiyafet', ad: 'Kıyafet', ikon: '👕', renk: '#c94f6d', tabela: 'KIYAFET', fiyat: 26, musteri: 3, kurulum: 70000, seviye: 6 },
  { id: 'balikci', ad: 'Balıkçı', ikon: '🐟', renk: '#3fb5b0', tabela: 'BALIKÇI', fiyat: 15, musteri: 4, kurulum: 55000, seviye: 5 },
  { id: 'cay_ocagi', ad: 'Çay Ocağı', ikon: '🍵', renk: '#b07a48', tabela: 'ÇAY OCAĞI', fiyat: 5, musteri: 8, kurulum: 25000, seviye: 2 },
  { id: 'spor', ad: 'Spor Malzeme', ikon: '⚽', renk: '#3fa35a', tabela: 'SPOR', fiyat: 30, musteri: 2, kurulum: 90000, seviye: 8 },
  { id: 'fan', ad: 'Fan Shop', ikon: '🧣', renk: '#ffd23f', tabela: 'FAN SHOP', fiyat: 24, musteri: 3, kurulum: 80000, seviye: 7 },
  { id: 'kafe', ad: 'Kafe', ikon: '☕', renk: '#b07a48', tabela: 'KAFE', fiyat: 15, musteri: 6, kurulum: 45000, seviye: 2 },
];
export const DUKKAN_BY_ID: Record<string, DukkanTip> = Object.fromEntries(DUKKAN_TIPLERI.map(t => [t.id, t]));
export const DUKKAN_MAX_SEVIYE = 5;
/** upgrade level n -> n+1: TL cost multiplier of `kurulum` (plain money, no materials) */
export const dukkanYukselt = (tip: DukkanTip, lv: number): { tl: number } => ({ tl: Math.round(tip.kurulum * lv * 0.9) });
/** customers per game hour at a level */
export const dukkanMusteri = (tip: DukkanTip, lv: number) => tip.musteri * (1 + (lv - 1) * 0.45);

/** stadium (J6): instant match ticket and team founding */
/** 2026-11-02: the football club stand on the pier promenade (club founding, ticket price, league) */
export const STADYUM = { bilet: 5000, takim: 100000, kapi: { x: 399, z: 12.2 } };
