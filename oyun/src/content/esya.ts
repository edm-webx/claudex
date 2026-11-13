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
  { id: 'k2', x: -17.5, z: 51.5, fiyat: 120000, seviye: 3, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -11.8, z: 51.5 }, ad: 'Sahil Bistro' },
  // 2026-11-09: every business building can be bought from a level and run (interiors: content/ic-mekan.ts)
  { id: 'k3', x: 28, z: 35.2, fiyat: 140000, seviye: 4, rotY: Math.PI, sabit: 'kafe', kapi: { x: 28, z: 32.6 }, ad: 'Martı Kırtasiye' },
  { id: 'k4', x: 48.85, z: 37.25, fiyat: 110000, seviye: 3, rotY: Math.PI, sabit: 'kafe', kapi: { x: 48.85, z: 32.6 }, ad: 'Okul Kantini' },
  { id: 'k5', x: 20.15, z: 51.8, fiyat: 450000, seviye: 6, rotY: Math.PI, sabit: 'kafe', kapi: { x: 20.15, z: 45.6 }, ad: 'Martı Lokantası (AVM)' },
  { id: 'k6', x: -54.1, z: 45.4, fiyat: 260000, seviye: 5, rotY: Math.PI / 2, sabit: 'kafe', kapi: { x: -51.0, z: 45.4 }, ad: 'Tesis Kafeteryası' },
];
export const ARSA_HAK = 3;
export const arsaKapi = (a: Arsa) => a.kapi ?? { x: a.x, z: a.z + (a.rotY ? -3.0 : 3.0) };
/** café workers (karşı yaka): hire price grows per worker; each adds +40% customers, restocks from the till, takes an hourly wage */
export const ISCI_MAX = 3;
/** 2026-11-08 user: "karşı yakadaki kafeler bizim ilk büfe gibi değil, kendine has yiyecek içecekleri olmak zorunda, gelişim, eşya, işçi".
 * 2026-11-09 user: "her binaya girilebilmeli, kafe bistro lokanta, her birinde geliştirmeler yeni aletler (kafede kahve makinesi),
 * o yerler belirli bir seviyeden sonra satın alınıp işletilebilmeli". Every fixed business has a type (Isletme) with its own
 * menu (a level unlocks dishes: lv1 2, lv2 4, lv3 5, lv4 6, lv5 8), its own equipment (bought once, shown inside the building,
 * view/world/ic-mekan-look.ts) and its own stage names. Workers: up to lv+1 (max 6). */
export interface KafeYemek { id: string; ad: string; ikon: string; fiyat: number; maliyet: number }
/** ic: shown inside (ic-mekan-look); teras: shown on the café terrace (karsi-yasam) */
export interface KafeEsya { id: string; ad: string; ikon: string; fiyat: number; lv: number; musteri?: number; fiyatK?: number; desc: string; teras?: boolean }
export type IsletmeId = 'kafe' | 'bistro' | 'kirtasiye' | 'kantin' | 'lokanta' | 'kafeterya';
export interface Isletme { id: IsletmeId; ad: string; ikon: string; asama: string[]; mus: number; menu: KafeYemek[]; esya: KafeEsya[] }
const Y = (id: string, ad: string, ikon: string, fiyat: number, maliyet: number): KafeYemek => ({ id, ad, ikon, fiyat, maliyet });
const A = (id: string, ad: string, ikon: string, fiyat: number, lv: number, o: Partial<KafeEsya>, desc: string): KafeEsya => ({ id, ad, ikon, fiyat, lv, ...o, desc });
export const ISLETME: Record<IsletmeId, Isletme> = {
  kafe: { id: 'kafe', ad: 'Kafe', ikon: '☕', mus: 1, asama: ['Köşe kafe', 'Kafe', 'Kahve evi', 'Teraslı kafe', 'Gurme kafe'],
    menu: [Y('turk_kahvesi', 'Türk kahvesi', '☕', 35, 9), Y('demlik_cay', 'Demlik çay', '🫖', 25, 5), Y('kasarli_tost', 'Kaşarlı tost', '🥪', 55, 18), Y('su_boregi', 'Su böreği', '🥧', 60, 20),
      Y('filtre', 'Filtre kahve', '🥤', 50, 12), Y('cheesecake', 'Cheesecake', '🍰', 85, 28), Y('menemen', 'Menemen', '🍳', 95, 30), Y('serpme', 'Serpme kahvaltı', '🧺', 220, 80)],
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
    menu: [Y('limonata', 'Ev limonatası', '🍋', 40, 9), Y('latte', 'Latte', '☕', 60, 14), Y('waffle', 'Waffle', '🧇', 110, 35), Y('frappe', 'Frappe', '🥤', 75, 18),
      Y('balik_ekmek', 'Balık ekmek', '🐟', 120, 45), Y('deniz_makarna', 'Deniz mahsullü makarna', '🍝', 190, 70), Y('levrek', 'Levrek ızgara', '🐠', 320, 130), Y('sufle', 'Sufle', '🍫', 95, 30)],
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
    menu: [Y('kalem', 'Kurşun kalem', '✏️', 15, 4), Y('defter', 'Spiralli defter', '📒', 45, 15), Y('silgi', 'Silgi seti', '🧽', 20, 5), Y('boya', 'Boya kalemi', '🖍️', 70, 25),
      Y('fotokopi_s', 'Fotokopi', '📄', 10, 2), Y('canta', 'Okul çantası', '🎒', 380, 160), Y('roman', 'Roman', '📕', 150, 70), Y('maket', 'Maket seti', '🧩', 260, 110)],
    esya: [A('fotokopi', 'Fotokopi makinesi', '🖨️', 28000, 1, { musteri: 0.15 }, 'Öğrenciler kuyruğa girer: müşteri +%15'),
      A('pos', 'Kartlı ödeme', '💳', 12000, 1, { musteri: 0.08 }, 'Bozuk para derdi bitti: müşteri +%8'),
      A('laminasyon', 'Ciltleme ve laminasyon', '📎', 22000, 2, { fiyatK: 0.1 }, 'Ödev ciltleme: fiyatlar +%10'),
      A('kitap_raf', 'Kitap rafları', '📚', 40000, 2, { musteri: 0.15 }, 'Roman ve dergi köşesi: müşteri +%15'),
      A('vitrin_k', 'Kalem vitrini', '🖋️', 30000, 3, { fiyatK: 0.12 }, 'Dolma kalemler: fiyatlar +%12'),
      A('oyuncak', 'Oyuncak köşesi', '🧸', 36000, 3, { musteri: 0.14 }, 'Çocuklar annelerini çeker: müşteri +%14'),
      A('yazici3d', '3D yazıcı', '🧊', 75000, 4, { fiyatK: 0.15 }, 'Martı figürü basar: fiyatlar +%15'),
      A('okuma', 'Okuma köşesi', '🛋️', 45000, 5, { musteri: 0.18 }, 'Puf ve lamba: müşteri +%18')] },
  kantin: { id: 'kantin', ad: 'Okul kantini', ikon: '🥪', mus: 1.5, asama: ['Kantin', 'Kantin+', 'Okul büfesi', 'Kantin kafe', 'Yıldızlı kantin'],
    menu: [Y('ayran', 'Ayran', '🥛', 15, 4), Y('simit_k', 'Simit', '🥯', 15, 5), Y('tost_k', 'Karışık tost', '🥪', 45, 15), Y('kek', 'Kek', '🧁', 20, 6),
      Y('cikolatali_sut', 'Çikolatalı süt', '🍫', 25, 8), Y('pizza', 'Pizza dilimi', '🍕', 55, 20), Y('salata_k', 'Meyve kabı', '🍎', 35, 12), Y('kofte_k', 'Köfte ekmek', '🍔', 75, 28)],
    esya: [A('tost_mak', 'Tost makinesi', '🥪', 9000, 1, { fiyatK: 0.1 }, 'Çıtır tost: fiyatlar +%10'),
      A('buzdolap', 'İçecek dolabı', '🧃', 14000, 1, { musteri: 0.12 }, 'Soğuk ayran: müşteri +%12'),
      A('semaver_k', 'Semaver', '🫖', 11000, 2, { musteri: 0.1 }, 'Öğretmenler çay içer: müşteri +%10'),
      A('mikrodalga', 'Pizza fırını', '🍕', 22000, 2, { fiyatK: 0.1 }, 'Sıcak pizza: fiyatlar +%10'),
      A('meyve', 'Sağlıklı köşe', '🍎', 15000, 3, { musteri: 0.12 }, 'Veliler sever: müşteri +%12'),
      A('masa_k', 'Kantin masaları', '🪑', 18000, 3, { musteri: 0.14 }, 'Teneffüste oturacak yer: müşteri +%14'),
      A('ekran_k', 'Menü ekranı', '📺', 26000, 4, { fiyatK: 0.12 }, 'Dijital menü: fiyatlar +%12'),
      A('izgara_k', 'Köfte ızgarası', '🔥', 40000, 5, { fiyatK: 0.18 }, 'Köfte kokusu: fiyatlar +%18')] },
  lokanta: { id: 'lokanta', ad: 'Lokanta', ikon: '🍲', mus: 1.2, asama: ['Esnaf lokantası', 'Lokanta', 'Ocakbaşı', 'Kebapçı', 'Martı Sofrası'],
    menu: [Y('mercimek', 'Mercimek çorbası', '🥣', 60, 15), Y('fasulye', 'Kuru fasulye pilav', '🍛', 110, 35), Y('karniyarik', 'Karnıyarık', '🍆', 130, 45), Y('lahmacun', 'Lahmacun', '🫓', 70, 22),
      Y('pide', 'Kaşarlı pide', '🥙', 150, 50), Y('iskender', 'İskender', '🥩', 280, 110), Y('adana', 'Adana kebap', '🌶️', 260, 100), Y('kunefe', 'Künefe', '🍮', 120, 40)],
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
    menu: [Y('cay_t', 'Çay', '🍵', 15, 3), Y('gazoz_t', 'Boğaz Gazozu', '🥤', 30, 8), Y('tost_t', 'Sucuklu tost', '🥪', 60, 20), Y('enerji', 'Martı Enerji', '⚡', 45, 14),
      Y('kofte_t', 'Köfte ekmek', '🍔', 90, 32), Y('protein', 'Protein bar', '🍫', 50, 18), Y('kumpir_t', 'Kumpir', '🥔', 110, 40), Y('mac_menu', 'Maç menüsü', '🍟', 160, 60)],
    esya: [A('cay_mak', 'Çay makinesi', '🍵', 9000, 1, { musteri: 0.1 }, 'Soyunmadan çıkan çay içer: müşteri +%10'),
      A('icecek_dolap', 'İçecek dolabı', '🥤', 14000, 1, { fiyatK: 0.08 }, 'Soğuk gazoz: fiyatlar +%8'),
      A('mac_tv', 'Maç ekranı', '📺', 30000, 2, { musteri: 0.18 }, 'Dev ekranda lig: müşteri +%18'),
      A('langirt', 'Langırt', '⚽', 22000, 2, { musteri: 0.12 }, 'Sıra bekleyen içer: müşteri +%12'),
      A('kupa', 'Kupa vitrini', '🏆', 40000, 3, { musteri: 0.1 }, 'Kulüp kupaları: müşteri +%10'),
      A('izgara_t', 'Köfte ızgarası', '🔥', 45000, 3, { fiyatK: 0.14 }, 'Maç sonu köfte: fiyatlar +%14'),
      A('forma_duvar', 'Forma duvarı', '👕', 35000, 4, { musteri: 0.12 }, 'İmzalı formalar: müşteri +%12'),
      A('vip', 'VIP loca', '🎟️', 85000, 5, { fiyatK: 0.2 }, 'Saha manzaralı koltuklar: fiyatlar +%20')] },
};
/** compatibility: menus by plot id (k1/k2 tests and older code) */
export const KAFE_MENU: Record<string, KafeYemek[]> = { k1: ISLETME.kafe.menu, k2: ISLETME.bistro.menu };
export const KAFE_MENU_LV = [0, 2, 4, 5, 6, 8];
/** fixed plot id -> its business type */
export const ARSA_ISLETME: Record<string, IsletmeId> = { k1: 'kafe', k2: 'bistro', k3: 'kirtasiye', k4: 'kantin', k5: 'lokanta', k6: 'kafeterya' };
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
export const kafeIsciMax = (lv: number) => Math.min(6, lv + 1);
export const isciFiyat = (n: number) => 12000 * (n + 1), ISCI_SAAT_UCRET = 60, ISCI_MUSTERI = 0.4;

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
