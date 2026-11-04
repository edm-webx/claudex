/**
 * Koleksiyonlar, Altın Simit ve Altın Fırın content (survey koleksiyon-1..8, altin-1..9, marka-8). Pure data.
 * Decisions (code comments English, player text Turkish):
 * - Five collections: Martıköy Çıkartmaları (sticker album, packs earned by playing), Balık koleksiyonu (olta atışları),
 *   Marka kapakları (drop on sales, wooden board on the Fırın wall), Kartpostallar (being at a place at a time window),
 *   Martıköy Hikayeleri (one chapter per regular, pages = existing REGULARS[].story lines unlocked by visits).
 * - A "page" is the unit that pays a reward (koleksiyon-7): decor (existing DECOR ids, placeable in Dekor), a bit of
 *   Altın Simit, a new cat, or a permanent +1 % sales bonus (capped by BONUS_CAP).
 * - Rare finds (koleksiyon-8): shiny variants, hidden pages with a condition, pity timer (PITY draws without a rare ->
 *   the next draw is rare), seasonal-only items (season from the real calendar date, fallback in-game week).
 * - Altın Simit (altin-1..3): sinks only in the Altın Fırın (cosmetics, premium decor corners, worker outfit pieces,
 *   sign styles, gift cards; süre kısaltma stays in Tadilat). Never converts to ₺, never skips Ruhsat, never opens packs.
 *   Free sources added here: page completion and a simulated rewarded ad (2 per day).
 * - All brands invented.
 */

export type Season = 'kis' | 'ilkbahar' | 'yaz' | 'sonbahar';
export const SEASON_NAME: Record<Season, string> = { kis: 'Kış', ilkbahar: 'İlkbahar', yaz: 'Yaz', sonbahar: 'Sonbahar' };

export type PageReward =
  | { kind: 'gold'; n: number }
  | { kind: 'decor'; ids: string[] }
  | { kind: 'cat' }
  | { kind: 'bonus' }; // permanent +1 % sales

export interface CollItem { id: string; name: string; color: string; rare?: boolean; season?: Season; night?: boolean; locked?: string; note?: string }
export interface CollPage { id: string; name: string; items: CollItem[]; reward: PageReward; hidden?: { hint: string }; }

/** pity timer: this many draws without a rare -> the next one is rare (koleksiyon-8) */
export const PITY = 30;
export const SHINY_CHANCE = 0.04;
export const BONUS_PCT = 0.01;
export const BONUS_CAP = 0.08;
export const PAGE_GOLD = 5;
export const AD_GOLD_PER_DAY = 1;
export const AD_TEXT = 'Deneme reklamı izlendi (gerçek reklam yok, söz).';

// ── Martıköy Çıkartmaları (koleksiyon-1) ──
export const PACK_SIZE = 3;
export const PACK_EVERY_SALES = 30;
export const STICKER_PAGES: CollPage[] = [
  { id: 'st_ahali', name: 'İskele Ahalisi', reward: { kind: 'decor', ids: ['saksi_sardunya'] }, items: [
    { id: 'sabri_tezgah', name: 'Sabri tezgahta', color: '#e0533c' },
    { id: 'sabriye_tepsi', name: 'Sabriye ve çay tepsisi', color: '#f29e4c' },
    { id: 'necati_tavla', name: 'Necati Amca tavlada', color: '#7a6a5a' },
    { id: 'nermin_orgu', name: 'Nermin Teyze\'nin örgüsü', color: '#c86fa0' },
    { id: 'kaptan_selam', name: 'Kaptan selam veriyor', color: '#2f7fb3' },
    { id: 'simitci_kosu', name: 'Simitçinin sabah koşusu', color: '#b5733a' },
  ] },
  { id: 'st_marti', name: 'Martılar', reward: { kind: 'gold', n: PAGE_GOLD }, items: [
    { id: 'tombul_marti', name: 'Tombul Martı', color: '#e9eef2' },
    { id: 'simit_hirsizi', name: 'Simit Hırsızı', color: '#d9b26a' },
    { id: 'gozluklu_marti', name: 'Gözlüklü Martı', color: '#9fb4c4' },
    { id: 'marti_korosu', name: 'Martı Korosu', color: '#cfe3f5' },
    { id: 'uykucu_marti', name: 'Uykucu Martı', color: '#b9c7d2' },
    { id: 'altin_marti', name: 'Altın Martı', color: '#f6bd3a', rare: true },
  ] },
  { id: 'st_kedi', name: 'Kediler ve Karamel', reward: { kind: 'cat' }, items: [
    { id: 'pamuk_lavas', name: 'Pamuk lavaş yatağında', color: '#f7f3ea' },
    { id: 'tarcin_kasa', name: 'Tarçın kasa bekçisi', color: '#e08a3c' },
    { id: 'boncuk_yavru', name: 'Boncuk ve yavrular', color: '#d9a46b' },
    { id: 'kedi_muhtar', name: 'Kedi Muhtar mühürde', color: '#8c949b' },
    { id: 'karamel_nobet', name: 'Karamel nöbette', color: '#c98b4a' },
    { id: 'kedi_toplanti', name: 'Gece kedi toplantısı', color: '#5a5f7a' },
  ] },
  { id: 'st_vapur', name: 'Vapurlar ve Deniz', reward: { kind: 'decor', ids: ['denizci_can_simidi', 'denizci_halat'] }, items: [
    { id: 'sabah_vapuru', name: 'Sabah vapuru', color: '#fff6e6' },
    { id: 'gunbatimi_vapuru', name: 'Gün batımı vapuru', color: '#f2a65a' },
    { id: 'kovalayan_vapur', name: 'Martı kovalayan vapur', color: '#e9eef2' },
    { id: 'kayikci', name: 'Kayıkçı Dursun', color: '#7d5638' },
    { id: 'samandira', name: 'Kırmızı şamandıra', color: '#e0533c' },
    { id: 'yunus_selam', name: 'Yunus selamı', color: '#6fbde2', rare: true },
  ] },
  { id: 'st_lezzet', name: 'Büfe Lezzetleri', reward: { kind: 'bonus' }, items: [
    { id: 'efsane_durum', name: 'Efsane Dürüm', color: '#f2d39b' },
    { id: 'tavsan_kani', name: 'Tavşan kanı çay', color: '#c2551f' },
    { id: 'kopuklu_ayran', name: 'Köpüklü ayran', color: '#ffffff' },
    { id: 'susamli_simit', name: 'Susamlı simit', color: '#b5733a' },
    { id: 'kasarli_tost', name: 'Kaşarlı tost', color: '#e8b23a' },
    { id: 'bogaz_gazozu', name: 'Boğaz Gazozu', color: '#7bd389' },
  ] },
  { id: 'st_mevsim', name: 'Dört Mevsim Martıköy', reward: { kind: 'decor', ids: ['lale_saksi'] }, items: [
    { id: 'kar_martisi', name: 'Kar Martısı', color: '#eaf4fb', season: 'kis' },
    { id: 'kestane_kebap', name: 'Kestane kebap', color: '#8a5a3a', season: 'kis' },
    { id: 'erguvanli_iskele', name: 'Erguvanlı iskele', color: '#c86fa0', season: 'ilkbahar' },
    { id: 'dondurmaci_marti', name: 'Dondurmacı Martı', color: '#f6c8d8', season: 'yaz' },
    { id: 'karpuz_dilimi', name: 'Karpuz dilimi', color: '#e0533c', season: 'yaz' },
    { id: 'lodos_semsiye', name: 'Lodosta uçan şemsiye', color: '#2f7fb3', season: 'sonbahar' },
  ] },
  { id: 'st_gece', name: 'Gece Martıları', reward: { kind: 'gold', n: PAGE_GOLD * 2 }, hidden: { hint: 'Üç parıltılı çıkartma bul ya da dört sayfayı bitir. Sonra gece paketlerine bak.' }, items: [
    { id: 'fenerli_marti', name: 'Fenerli Martı', color: '#ffd23f', night: true },
    { id: 'aya_bakan_kedi', name: 'Ay\'a bakan kedi', color: '#5a5f7a', night: true },
    { id: 'gece_vapuru', name: 'Son vapur', color: '#2b3a55', night: true },
    { id: 'kayan_simit', name: 'Yıldız kayan simit', color: '#f6bd3a', night: true, rare: true },
    { id: 'uykusuz_sabri', name: 'Uykusuz Sabri', color: '#9fb4c4', night: true },
    { id: 'bekci_marti', name: 'Gece bekçisi martı', color: '#33373b', night: true },
  ] },
];
export const STICKER_LINES = [
  'Paketin kokusu bile güzel. Sakız yok ama, kusura bakma.',
  'Necati Amca omzunun üstünden bakıyor: "Bende o var evladım!"',
  'Çift çıkan çıkartmalar kenara. Altı çift biriktirince yeni paket!',
  'Pamuk çıkartmayı yalamaya çalıştı. Engellendi.',
];
export const DUPES_PER_PACK = 6;

// ── Balık koleksiyonu (koleksiyon-2) ──
export const CASTS_PER_DAY = 3;
export const CAST_CAP = 6;
export const FISH_PAGES: CollPage[] = [
  { id: 'fi_bogaz', name: 'Boğaz Balıkları', reward: { kind: 'decor', ids: ['denizci_fener'] }, items: [
    { id: 'istavrit', name: 'İstavrit', color: '#9fb4c4' },
    { id: 'kefal', name: 'Kefal', color: '#8c949b' },
    { id: 'mezgit', name: 'Mezgit', color: '#c9d3da' },
    { id: 'sardalya', name: 'Sardalya', color: '#7fa6c4' },
    { id: 'cinekop', name: 'Çinekop', color: '#6f8fa8' },
    { id: 'hamsi', name: 'Hamsi', color: '#5e7f99', season: 'kis' },
    { id: 'lufer', name: 'Lüfer', color: '#4f6f8a', season: 'sonbahar' },
    { id: 'palamut', name: 'Palamut', color: '#3f5f7a', season: 'sonbahar' },
  ] },
  { id: 'fi_dip', name: 'Dipten Çıkanlar', reward: { kind: 'gold', n: PAGE_GOLD }, items: [
    { id: 'eski_terlik', name: 'Eski terlik', color: '#d9822b', note: 'Teki nerede, kimse bilmiyor.' },
    { id: 'pasli_anahtar', name: 'Paslı anahtar', color: '#a0522d', note: 'Hangi kapıyı açıyor? Belki de hiçbirini.' },
    { id: 'sisede_mektup', name: 'Şişede mektup', color: '#7bd389', note: '"Kim bulursa bir simit ısmarlasın." İmza: bir martı.' },
    { id: 'kayip_gozluk', name: 'Kayıp gözlük', color: '#33373b', note: 'Gözlüklü Martı\'nın yedeği olabilir.' },
    { id: 'tek_corap', name: 'Tek çorap', color: '#c86fa0', note: 'Çamaşır makinesinden kaçmış, denize ulaşmış.' },
    { id: 'vapur_jetonu', name: 'Eski vapur jetonu', color: '#c9a227', note: 'Necati Amca bunu görünce ağladı.' },
  ] },
  { id: 'fi_efsane', name: 'Efsaneler', reward: { kind: 'bonus' }, items: [
    { id: 'altin_hamsi', name: 'Altın Hamsi', color: '#f6bd3a', rare: true, note: 'Parlıyor! Gözünü kamaştırıyor, karnını doyurmuyor.' },
    { id: 'simit_balik', name: 'Simit yiyen balık', color: '#b5733a', note: 'Martılara rakip çıktı.' },
    { id: 'uzay_baligi', name: 'Uzay balığı', color: '#8a7fd6', locked: 'Ay İskelesi açılınca oltaya gelir.' },
  ] },
];
export const CAST_LINES = ['Olta suya "plunk" diye girdi.', 'Pamuk oltanın başında bekliyor, umutlu.', 'Bir martı oltayı izliyor. Pazarlık yapmak istiyor.'];

// ── Marka kapakları (koleksiyon-3, marka-8) ──
export const CAP_CHANCE = 0.06;
export interface CapBrand { id: string; name: string; color: string; ink: string; decor: string }
export const CAP_BRANDS: CapBrand[] = [
  { id: 'kolaz', name: 'Kolaz', color: '#c0392b', ink: '#fff', decor: 'nostalji_afis' },
  { id: 'bogaz', name: 'Boğaz Gazozu', color: '#27ae60', ink: '#fff', decor: 'denizci_can_simidi' },
  { id: 'ayranbey', name: 'Ayranbey', color: '#ecf3f6', ink: '#2f7fb3', decor: 'saksi_sardunya' },
  { id: 'martisu', name: 'Martı Su', color: '#6fbde2', ink: '#fff', decor: 'denizci_halat' },
  { id: 'narcicek', name: 'Narçiçek', color: '#9b1c3a', ink: '#fff', decor: 'lale_saksi' },
  { id: 'lodos', name: 'Lodos Soda', color: '#3d6fa8', ink: '#fff', decor: 'sokak_lambasi' },
  { id: 'buzdagi', name: 'Buzdağı Limonata', color: '#f4e04d', ink: '#33373b', decor: 'nostalji_sandalye' },
  { id: 'salgamzade', name: 'Şalgamzade', color: '#6c2a5a', ink: '#fff', decor: 'kedi_evi' },
  { id: 'demlikhan', name: 'Demlikhan Çay', color: '#a0401c', ink: '#fff', decor: 'lale_semaver' },
  { id: 'vapurcu', name: 'Vapurcu Kahve', color: '#4a2f22', ink: '#f6bd3a', decor: 'nostalji_radyo' },
  { id: 'aybozasi', name: 'Ay Bozası', color: '#e8d9a8', ink: '#4a2f22', decor: 'lale_minder' },
  { id: 'kopuk', name: 'Köpük Kulesi', color: '#f29e4c', ink: '#fff', decor: 'tavla_masasi' },
];
/** three caps per brand: normal, özel seri, altın kapak (the shiny, rare one) */
export const CAP_KINDS = [{ id: 'n', name: 'Klasik kapak' }, { id: 'o', name: 'Özel seri' }, { id: 'a', name: 'Altın kapak', rare: true }];

// ── Kartpostallar (koleksiyon-4) ──
export interface PlaceDef { id: string; name: string; locked?: string }
export const PLACES: PlaceDef[] = [
  { id: 'iskele', name: 'Martıköy İskelesi' },
  { id: 'sahil', name: 'Sahil Yolu' },
  { id: 'carsi', name: 'Çarşı Sokağı' },
  { id: 'meydan', name: 'Meydan', locked: 'Mahalle büyüyünce açılır.' },
  { id: 'barinak', name: 'Balıkçı Barınağı', locked: 'Mahalle büyüyünce açılır.' },
  { id: 'ay', name: 'Ay İskelesi', locked: 'Çok, çok ileride. Yukarıda.' },
];
export const POST_TIMES = [
  { id: 'sabah', name: 'Sabah', from: 8, to: 10.5, sky: ['#bfe3f6', '#ffe7c2'] },
  { id: 'aksam', name: 'Gün batımı', from: 18.3, to: 20.3, sky: ['#f2a65a', '#c86fa0'] },
  { id: 'gece', name: 'Gece', from: 21.3, to: 24.5, sky: ['#1d2a4a', '#3d4f7a'] },
];
/** seconds of standing still at a place inside a time window to take the postcard photo */
export const POST_STILL = 2;

// ── Altın Fırın (altin-1, altin-4..8) ──
export const FIRIN_LEVEL = 8;
export type FirinKind = 'altin' | 'kiyafet' | 'arac' | 'dekor' | 'isci' | 'tabela' | 'hediye';
export const FIRIN_KIND_NAME: Record<FirinKind, string> = {
  altin: 'Altın eşya', kiyafet: 'Kıyafet', arac: 'Araç süsü', dekor: 'Hazır Tasarım köşesi', isci: 'İşçi kıyafet parçası', tabela: 'Tabela yazısı', hediye: 'Hediye kartı',
};
export interface FirinItem { id: string; name: string; kind: FirinKind; gold: number; text: string; color: string; decor?: string[]; repeat?: boolean }
/** fixed shelf (altin-8): always on sale, shown in the Fırın window once bought */
export const FIRIN_SHELF: FirinItem[] = [
  { id: 'altin_cay_ocagi', name: 'Altın çay ocağı', kind: 'altin', gold: 300, color: '#f6bd3a', text: 'Çay aynı çay, ama demlenirken kendini zengin hissediyor.' },
  { id: 'altin_kask', name: 'Altın kurye kaskı', kind: 'altin', gold: 180, color: '#f2b632', text: 'Güneşte parlar, kurye uzaktan bile görünür.' },
  { id: 'altin_marti_heykel', name: 'Altın Martı heykeli', kind: 'altin', gold: 450, color: '#ffd23f', text: 'Gerçek martılar heykele saygı duruşunda bulunuyor.' },
  { id: 'altin_tezgah', name: 'Altın kenarlı tezgah', kind: 'altin', gold: 380, color: '#e8a92a', text: 'Kenarları yaldızlı. Silerken insan hafif gülümsüyor.' },
  { id: 'altin_kedi_kabi', name: 'Altın tasmalı kedi kabı', kind: 'altin', gold: 120, color: '#f6c85a', text: 'Pamuk artık mamasını sadece buradan yiyor. Kibar ama kararlı.' },
  { id: 'altin_sis', name: 'Altın şişli döner', kind: 'altin', gold: 400, color: '#f0b030', text: 'Şiş altın, döner aynı lezzet. Müşteriler fotoğraf çekiyor.' },
];
/** rotating pool (altin-6): 4 a day picked by the day number */
export const FIRIN_POOL: FirinItem[] = [
  { id: 'yaldiz_onluk', name: 'Yaldızlı önlük', kind: 'kiyafet', gold: 60, color: '#f6bd3a', text: 'Önlükte yazı yine aynı, sadece biraz parlıyor.' },
  { id: 'kaptan_sapka', name: 'Lacivert kaptan şapkası', kind: 'kiyafet', gold: 45, color: '#2b3a55', text: 'Vapur kaptanları selam vermeye başladı.' },
  { id: 'marti_yelek', name: 'Martı desenli yelek', kind: 'kiyafet', gold: 40, color: '#e9eef2', text: 'Martılar akraba sanıp yanaşıyor.' },
  { id: 'cizgili_bere', name: 'Çizgili denizci beresi', kind: 'kiyafet', gold: 30, color: '#2f7fb3', text: 'Lodosta uçmayan tek bere.' },
  { id: 'altin_zil', name: 'Bisiklete altın zil', kind: 'arac', gold: 35, color: '#f6bd3a', text: '"Çın çın" diyor, kibarca.' },
  { id: 'marti_flama', name: 'Martı flaması', kind: 'arac', gold: 25, color: '#e0533c', text: 'Kurye bisikletinin arkasında dalgalanır.' },
  { id: 'puskul', name: 'El arabasına püskül', kind: 'arac', gold: 20, color: '#c86fa0', text: 'Teslimat aynı hız, karizma iki kat.' },
  { id: 'sepet_cicek', name: 'Bisiklet sepetine çiçek', kind: 'arac', gold: 22, color: '#7bd389', text: 'Sardunya, papatya ve bir de inatçı maydanoz.' },
  { id: 'kose_nostalji', name: 'Hazır Tasarım: Nostalji Köşesi', kind: 'dekor', gold: 120, color: '#c9a27a', decor: ['nostalji_radyo', 'nostalji_afis', 'nostalji_sandalye'], text: 'Radyo, afiş, hasır sandalye. Dekor sekmesinde yerleştir.' },
  { id: 'kose_denizci', name: 'Hazır Tasarım: Denizci Köşesi', kind: 'dekor', gold: 140, color: '#2f7fb3', decor: ['denizci_can_simidi', 'denizci_halat', 'denizci_fener'], text: 'Can simidi, halat, fener maketi. Tam takım.' },
  { id: 'kose_lale', name: 'Hazır Tasarım: Lale Köşesi', kind: 'dekor', gold: 160, color: '#c86fa0', decor: ['lale_cini_pano', 'lale_saksi', 'lale_minder'], text: 'Çini, lale, minder. Lale Devri geri geldi.' },
  { id: 'kose_tavla', name: 'Hazır Tasarım: Tavla Köşesi', kind: 'dekor', gold: 110, color: '#7d5638', decor: ['tavla_masasi', 'sokak_lambasi'], text: 'Necati Amca bunu görünce koşarak geldi.' },
  { id: 'isci_onluk', name: 'Ekip önlüğü: çizgili', kind: 'isci', gold: 35, color: '#e0533c', text: 'Ekibin hepsi aynı önlükte. Takım ruhu!' },
  { id: 'isci_kep', name: 'Ekip kepi: Martı Takımı', kind: 'isci', gold: 30, color: '#2f7fb3', text: 'Kepin üstünde minik martı. Ekip çok seviyor.' },
  { id: 'isci_rozet', name: 'Ekip yaka rozeti', kind: 'isci', gold: 18, color: '#f6bd3a', text: '"Ayın Elemanı" yazmıyor, ama herkes öyle hissediyor.' },
  { id: 'tabela_yaldiz', name: 'Tabela: Altın Yaldız harfler', kind: 'tabela', gold: 70, color: '#f6bd3a', text: 'Tabela yazın gece bile parlar.' },
  { id: 'tabela_pembe', name: 'Tabela: Pembe neon çerçeve', kind: 'tabela', gold: 55, color: '#ff6fa8', text: 'Bütün iskele pembe pembe.' },
  { id: 'tabela_el', name: 'Tabela: El yazısı fırça harf', kind: 'tabela', gold: 45, color: '#33373b', text: 'Sanki Sabri gece oturup kendi yazmış.' },
  { id: 'hediye_kart', name: 'Arkadaşa hediye kartı', kind: 'hediye', gold: 25, color: '#ff6fa8', repeat: true, text: 'Fırın\'dan bir eşya hediye eder. Arkadaş listesi gelince gönderilir.' },
];
export const FIRIN_LINES = [
  'Fırıncı Altın Teyze: "Buyur evladım, burada her şey parlar, hiçbir şey yanmaz."',
  'Altın Teyze: "Altın Simit paraya dönmez, ama gönlü zengin eder."',
  'Altın Teyze: "Vitrin her sabah değişir. Kaçırma, yarın başka şeyler var!"',
  'Altın Teyze: "Ruhsat mı? O beklenir evladım, altınla da olmaz, gülümsemeyle de."',
];
export const GOLD_SOURCES = [
  'Albüm sayfası tamamla (her koleksiyonda)',
  'Mini oyun ödüllü turları (günlük tavanlı)',
  'Sipariş Panosu ve başarımlar',
  'Haftalık kasa sayımı',
  'Deneme reklamı (günde ' + AD_GOLD_PER_DAY + ')',
];
export const GOLD_RULES = 'Altın Simit ₺\'ye çevrilmez, Ruhsat beklemesini atlatmaz, paket ya da kutu açmaz, sıralamada ve mini oyunda avantaj vermez.';
