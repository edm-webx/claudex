/**
 * Martıköy map data (survey disari-1..9, mekan-1..9, kontrol-3, iskele-9, iskele-10). Pure data: no three, no DOM.
 * The town is one long seamless strip east of the pier (shared world coordinates, metres):
 *   iskele (x -62..62) > Çarşı Sokağı ('test-sokak', 62..132) > Sahil Yolu ve Park (132..196)
 *   > Yokuşlu Ara Sokaklar (196..244) > Mahalle Meydanı (244..292) > Balıkçı Barınağı (292..344).
 * The walkable corridor between neighbourhoods is the street band z 4.85..13.3 (same as Çarşı Sokağı).
 * Regions open level by level; a locked region keeps a "Islak boya" barrier at its west edge (sim pushes back).
 * Every name and brand is invented.
 */

export type RegionId = 'iskele' | 'carsi' | 'sahil' | 'yokus' | 'meydan' | 'barinak' | 'gece' | 'stadyum' | 'tersane' | 'metro' | 'tepe' | 'adalar' | 'orman';
export interface Region {
  id: RegionId; zone: string; name: string; short: string; x0: number; x1: number; level: number;
  color: string; blurb: string; lockLine: string;
  stop: { name: string; x: number; z: number };
  /** Ferry pier on this region (vapur travel); null = dolmuş only. */
  vapur?: boolean;
  /** 2026-10-24 açık dünya: where the district sits on the illustrated İstanbul map (0..100 both ways). */
  map: [number, number];
  /** reachable only by vapur (no street link), e.g. Adalar */
  island?: boolean;
  /** 16:52 user: reachable only by the city bus from the stop across the büfe (Belgrad Ormanı) */
  bus?: boolean;
}
export const BAND = { z0: 4.85, z1: 13.3, mid: 9 } as const;

export const REGIONS: Region[] = [
  { id: 'iskele', zone: 'iskele', name: 'Martıköy İskelesi', short: 'İskele', x0: -62, x1: 62, level: 1, color: '#7cc4e4',
    blurb: 'Büfenin evi. Vapur, martı, çay.', lockLine: '', map: [30, 58], stop: { name: 'İskele Durağı', x: 48, z: 11.8 }, vapur: true },
  { id: 'carsi', zone: 'test-sokak', name: 'Çarşı Sokağı', short: 'Çarşı', x0: 62, x1: 132, level: 1, color: '#f0b45a',
    blurb: 'Fırın, manav, berber ve dedikodu merkezi.', lockLine: '', map: [40, 46], stop: { name: 'Çarşı Başı', x: 68, z: 12.2 } },
  { id: 'sahil', zone: 'sahil', name: 'Sahil Yolu ve Park', short: 'Sahil', x0: 132, x1: 196, level: 1, color: '#8fd06b',
    blurb: 'Denize bakan banklar, Lunapark Martı ve açık hava sineması.', lockLine: 'Belediye bankları boyuyor. Islak boya!',
    map: [50, 60], stop: { name: 'Sahil Parkı', x: 139, z: 12.4 } },
  { id: 'yokus', zone: 'yokus', name: 'Yokuşlu Ara Sokaklar', short: 'Merdivenler', x0: 196, x1: 244, level: 1, color: '#e58f7a',
    blurb: 'Merdivenler, saksılar, kütüphane ve tarihi hamam.', lockLine: 'Merdivenler yeni yıkandı, kayıyor. Biraz bekle!',
    map: [56, 40], stop: { name: 'Merdiven Altı', x: 199, z: 12.4 } },
  { id: 'meydan', zone: 'meydan', name: 'Mahalle Meydanı ve Çeşme', short: 'Meydan', x0: 244, x1: 292, level: 1, color: '#c6a0e0',
    blurb: 'Çınar, çeşme, kıraathane ve tavla sesleri.', lockLine: 'Meydanda bayrak asılıyor, merdivenler yolda!',
    map: [64, 50], stop: { name: 'Meydan Çeşmesi', x: 248, z: 12.2 } },
  { id: 'barinak', zone: 'barinak', name: 'Balıkçı Barınağı', short: 'Barınak', x0: 292, x1: 344, level: 1, color: '#5aa0c8',
    blurb: 'Kayıklar, ağlar, balık hali ve martıların başkenti.', lockLine: 'Balıkçılar ağ seriyor, basma! Biraz sonra.',
    map: [77, 62], stop: { name: 'Barınak Son Durak', x: 296, z: 12.0 }, vapur: true },
  // 2026-10-24 açık dünya anketi (bölgeler): the rest of the imaginary İstanbul, one seamless strip east of the barınak
  { id: 'gece', zone: 'gece', name: 'Gece Pazarı', short: 'Gece Pazarı', x0: 344, x1: 392, level: 1, color: '#9b7fe0',
    blurb: 'Fenerler, çerçiler, közde mısır. Akşam başlar, sabaha kadar sürer.', lockLine: 'Tezgahlar kuruluyor!', map: [80, 50],
    stop: { name: 'Pazar Girişi', x: 348, z: 12.2 } },
  { id: 'stadyum', zone: 'stadyum', name: 'Stadyum ve Halı Sahalar', short: 'Stadyum', x0: 392, x1: 452, level: 1, color: '#58b368',
    blurb: 'Martı Arena ve üç halı saha. Turnuvalar, taraftar, tezahürat.', lockLine: 'Çimler sulanıyor!', map: [86, 34],
    stop: { name: 'Stadyum Kapısı', x: 396, z: 12.2 } },
  { id: 'tersane', zone: 'tersane', name: 'Liman ve Tersane', short: 'Tersane', x0: 452, x1: 508, level: 1, color: '#d9a05b',
    blurb: 'Vinçler, konteynerler, kızakta bekleyen vapur. Tamirciler burada.', lockLine: 'Vinç yük indiriyor!', map: [62, 79],
    stop: { name: 'Tersane Kapısı', x: 456, z: 12.2 }, vapur: true },
  { id: 'metro', zone: 'metro', name: 'Metro Altı', short: 'Metro', x0: 508, x1: 548, level: 1, color: '#7a8ca6',
    blurb: 'Çini duvarlar, sokak müzisyenleri, yeraltı çarşısı.', lockLine: 'Yürüyen merdiven bakımda!', map: [46, 28],
    stop: { name: 'Metro Girişi', x: 512, z: 12.2 } },
  { id: 'tepe', zone: 'tepe', name: 'Tepe ve Koru', short: 'Koru', x0: 548, x1: 600, level: 1, color: '#4f9a5a',
    blurb: 'Çam korusu, seyir terası ve bütün şehrin manzarası.', lockLine: 'Koruda piknik var!', map: [30, 20],
    stop: { name: 'Koru Girişi', x: 552, z: 12.2 } },
  { id: 'adalar', zone: 'adalar', name: 'Adalar', short: 'Adalar', x0: 700, x1: 760, level: 1, color: '#e6b45a',
    blurb: 'Faytonsuz sokaklar, bisikletler, köşkler ve çam kokusu. Sadece vapurla.', lockLine: 'Vapur kalkmak üzere!', map: [58, 90],
    stop: { name: 'Ada İskelesi', x: 714, z: 3.2 }, vapur: true, island: true },
  // 16:52 user: a bus from the stop across the büfe to Belgrad Ormanı: mushrooms, mangal, the fountain
  { id: 'orman', zone: 'orman', name: 'Belgrad Ormanı', short: 'Orman', x0: 800, x1: 880, level: 1, color: '#3f8a4a',
    blurb: 'Meşeler, çamlar, mangal dumanı ve buz gibi çeşme suyu. Sepetini al, mantar ara!', lockLine: 'Orman yolu kapalı!', map: [24, 8],
    stop: { name: 'Orman Durağı', x: 806, z: 9 }, bus: true },
];

export const REGION_BY_ID: Record<string, Region> = Object.fromEntries(REGIONS.map(r => [r.id, r]));
export function regionAt(x: number): Region | null { for (const r of REGIONS) if (x >= r.x0 && x < r.x1) return r; return x < -62 ? REGIONS[0] : null; }
/** The new walkable zones (content zone defs in content/zones/disari.ts). */
export const DISARI_ZONE_IDS = ['sahil', 'yokus', 'meydan', 'barinak', 'gece', 'stadyum', 'tersane', 'metro', 'tepe', 'adalar'] as const;

export type PlaceKind = 'mekan' | 'lokanta';
export interface Place {
  id: string; name: string; kind: PlaceKind; region: RegionId; x: number; z: number; open: number; close: number; icon: string;
  day: string; night: string; closed: string; blurb: string;
}
/** Hours are game hours (day runs 08..24). `night` shows from 19:00 while open. */
export const PLACES: Place[] = [
  { id: 'kiraathane', name: 'Martı Kıraathanesi', kind: 'mekan', region: 'meydan', x: 256, z: 17.2, open: 8, close: 24, icon: '🎲',
    day: 'Tavla şakırtısı: "Düşeş geldi, çay benden!"', night: 'Gece turnuvası: Şeşbeş Kupası finali!', closed: 'Zarlar uyuyor.',
    blurb: 'Mahallenin meclisi. Burada alınan kararlar kesindir, ertesi gün değişir.' },
  { id: 'hamam', name: 'Köpüklü Kubbe Hamamı', kind: 'mekan', region: 'yokus', x: 229, z: 2.6, open: 9, close: 22, icon: '♨',
    day: 'Kese yapılır, dertler köpükle gider.', night: 'Kubbe ışıkları yandı, buhar yıldız gibi.', closed: 'Kurnalar dinleniyor.',
    blurb: 'Kubbesi köpük gibi beyaz. Tellak Bülbül Nuri şarkı söyler.' },
  { id: 'kutuphane', name: 'Sessiz Martı Kütüphanesi', kind: 'mekan', region: 'yokus', x: 210, z: 16.0, open: 9, close: 20, icon: '📚',
    day: 'Şşşt! Martılar bile fısıldıyor.', night: '', closed: 'Kitaplar uyudu, rüyalarında maceralar.',
    blurb: 'Bir rafı tamamen simit tarifleri. Kütüphaneci Nermin Hanım hepsini ezbere bilir.' },
  { id: 'lunapark', name: 'Lunapark Martı', kind: 'mekan', region: 'sahil', x: 185, z: 19.5, open: 12, close: 24, icon: '🎡',
    day: 'Dönme dolap döner, martı da biner.', night: 'Işıklar yandı! Dönme dolap gökyüzünü boyuyor.', closed: 'Atlıkarınca atları uyuyor.',
    blurb: 'Hepsi beceri oyunu: halka at, balon patlat, simit tut. Şans yok, el var.' },
  { id: 'sinema', name: 'Yıldızlı Perde Açık Hava Sineması', kind: 'mekan', region: 'sahil', x: 158, z: 20.5, open: 19, close: 24, icon: '🎬',
    day: '', night: 'Bu gece: "Martı ile Simit 2: Kanat Darbesi"', closed: 'Film akşam 19:00\'da. Patlamış mısırlar bekliyor.',
    blurb: 'Perde rüzgarda dalgalanır, film de biraz dalgalanır. Kimse şikayet etmez.' },
  { id: 'cesme', name: 'Çeşme ve Koca Çınar', kind: 'mekan', region: 'meydan', x: 268, z: 9, open: 0, close: 24, icon: '⛲',
    day: 'Çınarın gölgesi bedava, suyu buz gibi.', night: 'Çeşmenin şırıltısı, ağustos böcekleri ve bir kedi.', closed: '',
    blurb: 'Çınar 412 yaşında. Kendisi öyle diyor.' },
  // restaurants (the five lokanta of the survey; fronts live on Çarşı Sokağı)
  { id: 'tencere', name: 'Tencere Yuvası', kind: 'lokanta', region: 'carsi', x: 72.5, z: 12.4, open: 11, close: 22, icon: '🍲',
    day: 'Kuru fasulye pilav, yanında turşu suyu.', night: 'Akşam tenceresi: güveç kokusu sokağı sardı.', closed: 'Tencereler yıkandı, kapaklar kapandı.',
    blurb: 'Ev yemeği, anne tadında. Annen burada çalışmıyor ama o tadı biliyor.' },
  { id: 'lufer', name: 'Lüfer Durağı', kind: 'lokanta', region: 'carsi', x: 72.5, z: 6.0, open: 12, close: 24, icon: '🐟',
    day: 'Günün balığı tahtada yazıyor.', night: 'Mangal başında rakısız, gazozlu balık keyfi.', closed: 'Balıklar da uyur.',
    blurb: 'Balık o gün ne tutulduysa o. Garson Fikri her balığın adını bilir.' },
  { id: 'uzun', name: 'Uzun Kayık', kind: 'lokanta', region: 'carsi', x: 90.5, z: 6.0, open: 10, close: 23, icon: '🛶',
    day: 'Kayık şeklinde masa, kayık şeklinde pide.', night: 'Kayık fenerleri yandı, pideler kızardı.', closed: 'Kayık limana çekildi.',
    blurb: 'Pideler o kadar uzun ki iki kişi iki ucundan yer.' },
  { id: 'bulut', name: 'Bulut Tabağı', kind: 'lokanta', region: 'carsi', x: 96.2, z: 12.4, open: 9, close: 21, icon: '☁',
    day: 'Pofuduk pankek ve bulut gibi muhallebi.', night: 'Tatlı gecesi: bulutlar pembeye döndü.', closed: 'Bulutlar dağıldı.',
    blurb: 'Her şey pofuduk. Sandalyeler bile.' },
  { id: 'kozdede', name: 'Köz Dede', kind: 'lokanta', region: 'carsi', x: 102.8, z: 6.0, open: 12, close: 24, icon: '🔥',
    day: 'Közde patlıcan, közde biber, közde sohbet.', night: 'Köz harlandı, Dede masal anlatıyor.', closed: 'Köz küllendi, Dede uyudu.',
    blurb: 'Dede 60 yıldır aynı mangalı yakıyor. Mangal da Dede\'yi tanıyor.' },
];

export interface SideShop { id: string; name: string; region: RegionId; /** stand point (walkable) */ x: number; z: number; /** kiosk centre + facing */ kx: number; kz: number; rot: number; price: number; perHour: number; line: string; icon: string; color: string }
/** Up to SHOP_MAX can be taken over; each earns `perHour` per game hour into its till (capped at SHOP_CAP_H hours). */
export const SHOP_MAX = 3, SHOP_CAP_H = 8;
export const SIDE_SHOPS: SideShop[] = [];

/** Hidden cats: found by walking next to them (labels show only within a few metres). */
export const HIDDEN_CATS = [
  { id: 'minnos', name: 'Minnoş', x: 166, z: 16.2, coat: 'orange', region: 'sahil' as RegionId, line: 'Çalının içinden iki göz: Minnoş!' },
  { id: 'pasa', name: 'Paşa', x: 218, z: 6.0, coat: 'black', region: 'yokus' as RegionId, line: 'Paşa merdivenin tam ortasında, yol vermiyor.' },
  { id: 'fistik', name: 'Fıstık', x: 238, z: 12.6, coat: 'tabby', region: 'yokus' as RegionId, line: 'Fıstık saksının içinde uyuyor. Saksı da memnun.' },
  { id: 'komur', name: 'Kömür', x: 272.5, z: 12.0, coat: 'black', region: 'meydan' as RegionId, line: 'Kömür çeşmenin arkasında su içiyor, bıyıkları ıslak.' },
  { id: 'tekir', name: 'Tekir Hanım', x: 318, z: 2.4, coat: 'tabby', region: 'barinak' as RegionId, line: 'Tekir Hanım kayığın burnunda, kaptan gibi.' },
  { id: 'poncik', name: 'Ponçik', x: 128, z: 12.6, coat: 'white', region: 'carsi' as RegionId, line: 'Ponçik sokağın sonunda kutunun içinde. Kutu onun.' },
];
/** Coin spots: a few are active each day (seeded per day). */
export const COIN_SPOTS: { x: number; z: number }[] = [
  { x: 140, z: 6.2 }, { x: 155, z: 12.8 }, { x: 170, z: 4.0 }, { x: 190, z: 8.0 }, { x: 207, z: 7.2 }, { x: 224, z: 11.5 },
  { x: 252, z: 4.0 }, { x: 259.5, z: 14.8 }, { x: 285, z: 11.0 }, { x: 300, z: 6.5 }, { x: 322, z: 10.5 }, { x: 337, z: 4.5 },
  { x: 118, z: 6.0 }, { x: 88, z: 11.8 },
];
export const COINS_PER_DAY = 5;
export const PHOTO_SPOTS = [
  { id: 'gunbatimi', name: 'Sahilde gün batımı', x: 178, z: 3.6, region: 'sahil' as RegionId, line: 'Güneş denize simit gibi batıyor. Çek!' },
  { id: 'merdiven', name: 'Renkli merdivenler', x: 216, z: 9.0, region: 'yokus' as RegionId, line: 'Gökkuşağı merdiven! Çek, çek!' },
  { id: 'cinar', name: 'Koca Çınar altında', x: 264, z: 13.0, region: 'meydan' as RegionId, line: 'Çınar poz verdi. 412 yaşında ama hep genç.' },
  { id: 'fener', name: 'Mendirek feneri', x: 336, z: 2.4, region: 'barinak' as RegionId, line: 'Kırmızı fener, mavi deniz, beyaz martı. Kartpostal!' },
  { id: 'lunapark', name: 'Dönme dolap önü', x: 180, z: 15.4, region: 'sahil' as RegionId, line: 'Dönme dolap arkada, sen önde. Efsane kare.' },
];
export const LOST_ITEMS = [
  { id: 'gozluk', name: 'Nermin Hanım\'ın gözlüğü', x: 186, z: 11.8, owner: 'Kütüphaneci Nermin Hanım', ox: 210, oz: 12.6, reward: 120,
    thanks: 'Gözlüğüm! Seni artık net görüyorum, ne yakışıklıymışsın.' },
  { id: 'tespih', name: 'Kıraathane tavlası pulu', x: 230, z: 11.6, owner: 'Tavlacı Sermet Amca', ox: 256, oz: 14.6, reward: 150,
    thanks: 'Kayıp pul bulundu! Turnuva kurtuldu, sana bir çay borcum var.' },
  { id: 'sapka', name: 'Kaptan Rıfkı\'nın şapkası', x: 262, z: 4.4, owner: 'Kaptan Rıfkı', ox: 310, oz: 3.0, reward: 180,
    thanks: 'Şapkam! Rüzgar götürmüştü, sen getirdin. Rast gele evlat!' },
  { id: 'anahtar', name: 'Kocaman paslı anahtar', x: 330, z: 11.0, owner: 'Hamamcı Bülbül Nuri', ox: 229, oz: 5.4, reward: 160,
    thanks: 'Hamamın kapı anahtarı! Bütün gün kapı önünde şarkı söylüyordum.' },
  { id: 'top', name: 'Çocukların kırmızı topu', x: 150, z: 3.4, owner: 'Top peşindeki Can', ox: 160, oz: 14.0, reward: 90,
    thanks: 'Topumuz! Abi sen de gel, kale sensin.' },
];

export interface Vehicle { id: string; name: string; blurb: string; price: number; level: number; icon: string; speed: number; sea?: boolean }
/** Travel modes for the map. Walking is free; the rest change the travel animation and make it quicker. */
export const VEHICLES: Vehicle[] = [
  { id: 'yaya', name: 'Tabanvay', blurb: 'İki ayak, bir gönül. Bedava.', price: 0, level: 1, icon: '👟', speed: 1 },
  { id: 'bisiklet', name: 'Zilli sepetli bisiklet', blurb: 'Sepette simit, zilde şarkı. Zırr zırr!', price: 900, level: 3, icon: '🚲', speed: 1.6 },
  { id: 'motor', name: 'Vızvız sepetli motor', blurb: 'Sepette çay ocağı. Vızvız gider, pıtpıt durur.', price: 2800, level: 6, icon: '🛵', speed: 2.2 },
  { id: 'kayik', name: 'Sabri\'nin kayığı "Tuzlu Hamsi"', blurb: 'İskele ile barınak arası kürekle. Kollar kaslanır.', price: 2000, level: 5, icon: '🚣', speed: 1.4, sea: true },
];
export const FARES = { dolmus: 10, vapur: 15 };
export const DOLMUS = { name: 'Martıköy Dolmuşu', driver: 'Şoför Rıza', plate: '34 MRT 07' };
export const TRAVEL_SEC = 2.6;
/** 16:52 user: the 42B city bus. Stop across the büfe on the iskele street; the ride is a short cutscene. */
export const OTOBUS = { line: '42B', name: 'Martıköy - Belgrad Ormanı', driver: 'Şoför Necmi', fare: 15, stop: { x: 6, z: 12.2 }, waitSec: 6, rideSec: 9 };
/** mushrooms of the forest: sellable finds, one poisonous look-alike (never sold) */
export const MANTARLAR = [
  { id: 'kanlica', name: 'Kanlıca', price: 45, color: '#d9822b', cap: '#e8a050', w: 4 },
  { id: 'cintar', name: 'Çıntar', price: 60, color: '#c9602b', cap: '#d97a3a', w: 3 },
  { id: 'horoz', name: 'Horoz mantarı', price: 80, color: '#e8dcc0', cap: '#f4ecd8', w: 2 },
  { id: 'tavuk', name: 'Tavuk mantarı', price: 120, color: '#f2c230', cap: '#f7d65a', w: 1 },
  { id: 'sinek', name: 'Sinek mantarı (zehirli!)', price: 0, color: '#d0302b', cap: '#e0402b', w: 2, zehir: true },
] as const;
export const MANTAR_PER_DAY = 14;

/** "Ask a citizen" lines: {to} = target name, {dir} = direction word. */
export const ASK_LINES = [
  { who: 'Simitçi Cemal Amca', line: '{to} mu? {dir} dümdüz, martıları takip et!' },
  { who: 'Teyze', line: 'Evladım {to} {dir}. Gidince bir de çay iç, çok zayıflamışsın.' },
  { who: 'Koşucu genç', line: '{to}? {dir}! Ben de oraya koşuyorum, yetiş bakalım!' },
  { who: 'Emekli Hüsamettin Bey', line: '{to}... Gençliğimde oraya at arabasıyla giderdik. {dir}, oğlum.' },
  { who: 'Kurye çocuk', line: '{to} {dir}, iki dakika. Ben bir dakikada giderim ama.' },
];
export const GUIDE_CAT = { name: 'Tarçın', coat: 'orange', arrive: 'Geldik! Tarçın kuyruğunu salladı, bir mama hak etti.' };
/** Wooden arrow signs (one at each region entrance), x is the world x of the sign. */
export const SIGNS: { x: number; z: number; west: string; east: string }[] = [
  { x: 134.5, z: 14.2, west: 'Çarşı Sokağı', east: 'Sahil Parkı' },
  { x: 198.0, z: 14.2, west: 'Sahil Parkı', east: 'Merdivenler' },
  { x: 246.0, z: 14.2, west: 'Merdivenler', east: 'Meydan' },
  { x: 294.0, z: 14.2, west: 'Meydan', east: 'Balıkçı Barınağı' },
  { x: 346.0, z: 14.2, west: 'Balıkçı Barınağı', east: 'Gece Pazarı' },
  { x: 394.0, z: 14.2, west: 'Gece Pazarı', east: 'Stadyum' },
  { x: 454.0, z: 14.2, west: 'Stadyum', east: 'Tersane' },
  { x: 510.0, z: 14.2, west: 'Tersane', east: 'Metro Altı' },
  { x: 550.0, z: 14.2, west: 'Metro Altı', east: 'Tepe ve Koru' },
];
/** Pier props (iskele-9 / iskele-10); positions on the iskele zone, visual only (no colliders). */
export const PIER_PROPS = {
  babalar: [[-10.25, -8.6], [-10.25, -1.2], [8.2, -9.2], [8.2, 0.8]] as [number, number][],
  canSimidi: [[8.35, -5.6], [-10.4, -6.2]] as [number, number][],
  gise: { x: 5.6, z: -12.4 },
  oltaci: { x: 18.5, z: 4.6 },
  tarti: { x: 15.2, z: 13.9 },
  bayii: { x: 31.0, z: 14.1 },
};

/** Lines the büfe ekip sends while Sabri is away (workers keep the büfe running). */
export const AWAY_LINES = [
  'Ekip büfeyi çeviriyor, sen keyfine bak!',
  'Çaycı: "Patron gezsin, biz buradayız!"',
  'Büfe açık, tezgah dolu. Martılar bile sırada.',
];
export const BACK_LINE = 'Sen yokken ekip {m} kazandı. Hoş geldin patron!';
