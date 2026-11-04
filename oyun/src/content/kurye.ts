/**
 * Kuryeler ve teslimat content (survey kurye-1..9, ekonomi-3, calisan-2). Pure data, no runtime imports.
 * - PaketMartı orders arrive on the counter tablet; couriers (1 at start, up to 3) take them to districts (SEMTLER).
 * - Vehicles (ARACLAR) incl. absurd ones unlock with Esnaf Seviyesi and change speed per terrain and bag size.
 * - Quirks (HUYLAR), upgrades (bag, speed, range), cosmetics (paint, horn, flag), weather (daily), ratings with comments,
 *   slope/stair humour moments, and the optional 'Sen götür!' 20 s route game.
 * All names invented. Player text casual Turkish, no em-dashes.
 */

export type Terrain = 'duz' | 'yokus' | 'merdiven' | 'deniz' | 'tepe';
export type HavaId = 'gunes' | 'sicak' | 'yagmur' | 'kar';
export type HuyId = 'kestirmeci' | 'caysever' | 'haritasiz' | 'kedici';

export interface Semt {
  id: string; name: string;
  /** one-way trip in sim seconds at speed 1 */
  dist: number;
  terrain: Terrain;
  /** menzil upgrade level needed */
  range: number;
  /** pay multiplier (farther = more) */
  payX: number;
  /** live map position, 0..1 (büfe sits at 0.5, 0.88) */
  mx: number; my: number;
  blurb: string;
}
export const SEMTLER: Semt[] = [
  { id: 'carsi', name: 'Çarşı Sokağı', dist: 14, terrain: 'duz', range: 0, payX: 1.0, mx: 0.22, my: 0.7, blurb: 'Hüsnü Usta kapıda bekler, kurye ekmek kokusuna dalar.' },
  { id: 'meydan', name: 'İskele Meydanı', dist: 12, terrain: 'duz', range: 0, payX: 1.0, mx: 0.75, my: 0.72, blurb: 'Güvercinler kuryeyi alkışlar.' },
  { id: 'sahil', name: 'Sahil Yolu', dist: 20, terrain: 'duz', range: 1, payX: 1.25, mx: 0.88, my: 0.5, blurb: 'Rüzgar arkadan eserse bedava hız.' },
  { id: 'barinak', name: 'Balıkçı Barınağı', dist: 22, terrain: 'deniz', range: 1, payX: 1.3, mx: 0.1, my: 0.45, blurb: 'Teknelerin arasından paket uzatılır.' },
  { id: 'yokusbasi', name: 'Yokuşbaşı', dist: 26, terrain: 'yokus', range: 2, payX: 1.45, mx: 0.38, my: 0.42, blurb: 'Yokuşun sonu görünmez, efsane böyle der.' },
  { id: 'merdivenli', name: 'Merdivenli Mahalle', dist: 28, terrain: 'merdiven', range: 2, payX: 1.5, mx: 0.62, my: 0.38, blurb: '187 basamak. Kurye her birine isim koymuş.' },
  { id: 'kuletepe', name: 'Kule Tepe', dist: 36, terrain: 'tepe', range: 3, payX: 1.8, mx: 0.5, my: 0.14, blurb: 'Bulutların biraz altı, simidin biraz üstü.' },
  { id: 'karsikiyi', name: 'Karşı Kıyı', dist: 44, terrain: 'deniz', range: 4, payX: 2.1, mx: 0.16, my: 0.12, blurb: 'Vapuru kaçıran kurye kürek çeker.' },
  { id: 'plaza', name: 'Plaza Diyarı', dist: 42, terrain: 'duz', range: 4, payX: 2.0, mx: 0.86, my: 0.14, blurb: 'Güvenlikten geçmek teslimattan uzun sürer.' },
];
export const SEMT_BY_ID: Record<string, Semt> = Object.fromEntries(SEMTLER.map(s => [s.id, s]));
export const TERRAIN_NAME: Record<Terrain, string> = { duz: 'Düz yol', yokus: 'Yokuş', merdiven: 'Merdiven', deniz: 'Deniz', tepe: 'Tepe' };

export interface Arac {
  id: string; name: string; blurb: string;
  /** Esnaf Seviyesi to unlock, price to buy (0 = free) */
  level: number; price: number;
  /** base speed multiplier and per-terrain extra multipliers */
  speed: number; terrain: Partial<Record<Terrain, number>>;
  /** extra bag slots */
  bag: number;
  color: string;
}
export const ARACLAR: Arac[] = [
  { id: 'bisiklet', name: 'PaketMartı Bisikleti', blurb: 'Zili çalışır, freni de çoğu zaman.', level: 0, price: 0, speed: 1, terrain: { yokus: 0.75, merdiven: 0.6 }, bag: 0, color: '#e8b23a' },
  { id: 'simitci', name: 'Simitçi tablalı bisiklet', blurb: 'Tablada paket, tepede martı, yolda şarkı.', level: 4, price: 450, speed: 1.05, terrain: { yokus: 0.75, merdiven: 0.6 }, bag: 2, color: '#c2551f' },
  { id: 'sandal', name: 'Kürekli teslimat sandalı', blurb: 'Denize kıyısı olan her yere. Olmayana da deneriz.', level: 4, price: 900, speed: 0.9, terrain: { deniz: 2.2, merdiven: 0.4, yokus: 0.5, tepe: 0.5 }, bag: 1, color: '#2f86c9' },
  { id: 'semer', name: 'Hamal semeri', blurb: 'Merdivenin kralı. Sırtta altı paket, dilde türkü.', level: 5, price: 1200, speed: 0.95, terrain: { merdiven: 1.9, yokus: 1.6, tepe: 1.3 }, bag: 3, color: '#8a5a32' },
  { id: 'marti', name: 'Dev martıya binmiş kurye', blurb: 'Martı simit karşılığı çalışır. Pazarlık yok.', level: 7, price: 3000, speed: 1.5, terrain: { tepe: 1.6, deniz: 1.4 }, bag: 1, color: '#f4f4f4' },
  { id: 'teleferik', name: 'Paket teleferiği', blurb: 'Teli Kule Tepe\'ye kadar gerdik. Kimse sormasın nasıl.', level: 9, price: 6000, speed: 1.2, terrain: { tepe: 2.6, yokus: 2.2, merdiven: 2.2 }, bag: 2, color: '#d23a3a' },
  { id: 'roket', name: 'Roketli tepsi', blurb: 'Çay dökülmez, kurye biraz dökülür. Çok hızlı.', level: 12, price: 15000, speed: 2.1, terrain: {}, bag: 1, color: '#7a4fc9' },
];
export const ARAC_BY_ID: Record<string, Arac> = Object.fromEntries(ARACLAR.map(a => [a.id, a]));

export interface Huy { id: HuyId; name: string; effect: string; speed: number; tipX: number; lines: string[] }
export const HUYLAR: Record<HuyId, Huy> = {
  kestirmeci: { id: 'kestirmeci', name: 'Kestirmeci', effect: '%25 daha hızlı, ara sokak bilir', speed: 1.25, tipX: 1, lines: ['Şuradan kesersek iki dakika!', 'Bahçenin içinden geçtim, teyze el salladı.', 'Bu sokak haritada yok ama bende var.'] },
  caysever: { id: 'caysever', name: 'Her kapıda çay içen', effect: 'Biraz yavaş, bahşiş ve yıldız bol', speed: 0.85, tipX: 1.35, lines: ['Teyze çay koymuş, ayıp olmasın dedim.', 'Üç kapı, üç çay. Şimdi uçarım.', 'Çayın yanında bir de lokum verdiler abi.'] },
  haritasiz: { id: 'haritasiz', name: 'Haritasız adam', effect: 'Bazen uçar, bazen kaybolur', speed: 1, tipX: 1, lines: ['Yanlış kapı, doğru gülümseme.', 'Bir martıyı takip ettim, doğru yere çıktım!', 'Harita mı? Ben kalbimle buluyorum.'] },
  kedici: { id: 'kedici', name: 'Kedi toplayan kurye', effect: 'Dönüşte arada bir kedi getirir', speed: 0.95, tipX: 1.1, lines: ['Bu da benimle gelmek istedi abi.', 'Sepette bir paket, iki kedi.', 'Kedi yolu gösterdi, ben de peşinden.'] },
};
export const HUY_IDS = Object.keys(HUYLAR) as HuyId[];

export const KURYE_ADLARI = ['Cevdet', 'Nurhan', 'Turgut', 'Selda', 'Bayram', 'Gülizar', 'Oktay', 'Fikret', 'Zerrin', 'Hikmet', 'Nalan', 'Sadri'];

/** Esnaf Seviyesi the PaketMartı tablet opens with the first courier */
export const KURYE_OPEN_LEVEL = 3;
/** hire slots: [level, price] for courier 2 and 3 (calisan-2: 1 → 3) */
export const KURYE_HIRE: [number, number][] = [[5, 600], [9, 2500]];
export const KURYE_MAX = 3;

export interface Yukseltme { id: 'canta' | 'hiz' | 'menzil'; name: string; what: string; max: number; cost: (lvl: number) => number }
export const YUKSELTMELER: Yukseltme[] = [
  { id: 'canta', name: 'Çanta kapasitesi', what: 'Bir siparişte daha çok ürün, daha çok kazanç', max: 4, cost: l => 250 * Math.pow(2, l) },
  { id: 'hiz', name: 'Araç hızı', what: 'Her seviye %12 daha hızlı', max: 5, cost: l => 300 * Math.pow(2, l) },
  { id: 'menzil', name: 'Menzil', what: 'Daha uzak semtler, daha dolgun siparişler', max: 4, cost: l => 400 * Math.pow(2.2, l) },
];
export const BAG_BASE = 2;
export const SPEED_PER_LVL = 0.12;

export interface Sus { id: string; kind: 'boya' | 'korna' | 'bayrak'; name: string; price: number; color: string }
export const SUSLER: Sus[] = [
  { id: 'boya-sari', kind: 'boya', name: 'PaketMartı sarısı', price: 0, color: '#ffd23f' },
  { id: 'boya-nar', kind: 'boya', name: 'Nar kırmızısı', price: 150, color: '#d23a3a' },
  { id: 'boya-deniz', kind: 'boya', name: 'Boğaz mavisi', price: 150, color: '#2f86c9' },
  { id: 'boya-simit', kind: 'boya', name: 'Simit susamı', price: 250, color: '#c9893f' },
  { id: 'korna-dit', kind: 'korna', name: 'Klasik dıt dıt', price: 0, color: '#9aa3ab' },
  { id: 'korna-vapur', kind: 'korna', name: 'Minik vapur düdüğü', price: 200, color: '#3b2a20' },
  { id: 'korna-marti', kind: 'korna', name: 'Martı çığlığı', price: 200, color: '#f4f4f4' },
  { id: 'korna-tef', kind: 'korna', name: 'Düğün tefi', price: 300, color: '#e8b23a' },
  { id: 'bayrak-yok', kind: 'bayrak', name: 'Bayraksız', price: 0, color: '#ffffff' },
  { id: 'bayrak-simit', kind: 'bayrak', name: 'Simitli flama', price: 180, color: '#c2551f' },
  { id: 'bayrak-marti', kind: 'bayrak', name: 'Martılı flama', price: 180, color: '#49a8e0' },
  { id: 'bayrak-kalp', kind: 'bayrak', name: 'Kalpli flama', price: 260, color: '#ff6f91' },
];
export const SUS_KIND_NAME: Record<Sus['kind'], string> = { boya: 'Boya', korna: 'Korna', bayrak: 'Bayrak' };

export interface Hava { id: HavaId; name: string; note: string; speed: Partial<Record<Terrain, number>> & { all?: number }; orderX: number; tipX: number; cold: boolean; gear: string }
export const HAVALAR: Record<HavaId, Hava> = {
  gunes: { id: 'gunes', name: 'Güneşli', note: 'Yollar tıkır tıkır.', speed: {}, orderX: 1, tipX: 1, cold: false, gear: 'güneş gözlüğü' },
  sicak: { id: 'sicak', name: 'Kavurucu sıcak', note: 'Soğuk içecek siparişi patlıyor! Ayran ve gazoz kapış kapış.', speed: { all: 0.95 }, orderX: 1.6, tipX: 1.1, cold: true, gear: 'buz kutusu' },
  yagmur: { id: 'yagmur', name: 'Yağmurlu', note: 'Kuryeler şemsiyeli. Biraz yavaş ama bahşiş bol.', speed: { all: 0.88 }, orderX: 1.25, tipX: 1.3, cold: false, gear: 'şemsiye' },
  kar: { id: 'kar', name: 'Karlı', note: 'Kızakla teslimat! Yokuş ve merdiven aşağı vızır vızır.', speed: { all: 0.85, yokus: 1.7, merdiven: 1.6, tepe: 1.4 }, orderX: 1.3, tipX: 1.25, cold: false, gear: 'kızak' },
};
export const HAVA_WEIGHTS: Record<string, Partial<Record<HavaId, number>>> = {
  ilkbahar: { gunes: 5, yagmur: 3, sicak: 1 },
  yaz: { gunes: 4, sicak: 5, yagmur: 1 },
  sonbahar: { gunes: 3, yagmur: 5, kar: 0.5 },
  kis: { gunes: 2, yagmur: 3, kar: 5 },
};

/** order cadence (sim seconds), expiry, tablet size */
export const ORDER_EVERY: [number, number] = [26, 48];
export const ORDER_TTL = 50;
export const TABLET_MAX = 3;
/** a courier waits at most this long for items on the counter, then Sabri's spare stock covers it */
export const WAIT_MAX = 35;
/** offline courier line rate (ekonomi-3) */
export const OFFLINE_RATE = 0.5;
export const SEN_GOTUR_CHANCE = 0.3;
export const SEN_GOTUR_LEVEL = 4;
export const SEN_GOTUR_SECS = 20;

export const MUSTERI_ADLARI = ['Nadide Hanım', 'Kaptan Rıza', 'Öğrenci Evi No 5', 'Ressam Feyyaz', 'Kuaför Melahat', 'Bekçi Hayri', 'İkiz Kardeşler', 'Sinemacı Orhan', 'Teyzeler Kulübü', 'Ofisteki Sevgi', 'Balkon Ahmet', 'Yoga Tülay'];
export const ADRES_NOTU = ['zili bozuk, ıslık çalın', 'kapıda kedi var, selam verin', 'üçüncü kat, asansör sayılmaz', 'mavi kapı, yok yeşil kapı', 'balkondan sepet iner', 'köpek havlar ama sever', 'yan komşuya bırakmayın, yer', 'çalınca şarkı söyleyin'];

/** rating comments (kurye-8): 1..5 stars, bad ones included, never mean */
export const YORUMLAR: Record<number, string[]> = {
  5: ['Döner sıcacık, kurye güleç. Beş yıldız az bile!', 'Kurye kapıyı çalmadan kokusundan anladık geldiğini.', 'Çay bardağı bile tıngırdamadı. Sanatçı!', 'Annem bile bu kadar çabuk getiremez.'],
  4: ['Gayet iyi. Kurye biraz fazla sohbet etti ama tatlıydı.', 'Simit çıtır, kurye terli. Hak etti.', 'Hızlıydı, sadece kornası biraz uzun çaldı.'],
  3: ['Geldi, yedik, mutluyuz. Olay yok.', 'Kurye yanlış kata çıktı ama komşuyla tanıştık.', 'Ayran biraz sallanmış, ama köpüğü güzel olmuş.'],
  2: ['Kurye kedimi sevmeye daldı, döner ılıdı.', 'Yokuşta bisikleti itmiş, paket de biraz itilmiş.', 'Zili beş kere çaldı, bebek uyandı. Döner yine de güzel.'],
  1: ['Paket geldi ama kurye bizim çayımızı içip gitti.', 'Martı paketi kaptı, kurye martıyı kovaladı. Biz izledik. Bir yıldız ama eğlenceliydi.', 'Kurye adresi bulamadı, biz kuryeyi bulduk.'],
};

/** slope / stair humour moments (kurye-9) */
export const YOKUS_ANLARI: Record<'yokus' | 'merdiven' | 'tepe', string[]> = {
  yokus: ['Yokuşta bisikletten inip iten kurye: "Spor da oluyor abi."', 'Kurye yokuşu ikinci vitesle çıktı. Bisiklette vites yok.', 'Yokuşun yarısında bir teyze kuryeye su verdi.'],
  merdiven: ['Merdivende motoru omzunda taşıyan kurye görüldü.', 'Pencereden sepet sarkıtan teyze: paket sepete, para sepetten!', 'Merdivende yatan kediye yol veren kurye. Kedi teşekkür etmedi.', 'Apartman asansörü yine bozuk. Kurye 9. kata türkü söyleyerek çıktı.'],
  tepe: ['Kule Tepe\'de kuryeye manzara için bahşiş verdiler.', 'Kurye tepeye vardı, bulutla selfie çekti.'],
};
export const KEDI_GETIRDI = ['Kurye dönüşte sepetinde bir kediyle geldi. Kedi büfede bir tur atıp kendi evine gitti.', 'Kedici kurye üç kedi getirdi, Pamuk hepsini tek tek kokladı.', 'Bu sefer yavru bir kedi. İsmini "Paket" koydular.'];

/** 'Sen götür!' route game texts (kurye-6) */
export const SEN_GOTUR = {
  title: 'Sen götür!',
  how: 'Büfeden başla, yan karelere dokunarak eve ulaş. Kediye yol ver, merdiven yavaşlatır, martı kısa yol gösterir.',
  win: ['Sabri teslimatta! Müşteri ağzı açık kaldı.', 'Rekor teslimat! Kuryeler kıskandı.', 'Kapıyı açan teyze yanağını sıktı.'],
  meh: ['Biraz dolandın ama paket sağlam.', 'Martıyı takip ettin, o da kaybolmuş.'],
  fail: ['Süre doldu! Kurye Cevdet koşup yetişti, paketi o teslim etti.', 'Sabri yolda simitçiyle muhabbete daldı. Kurye yetişti.'],
};

export const PAKETMARTI_LINES = { beep: 'PaketMartı: yeni sipariş!', none: 'Tablet sessiz. Martılar bile sipariş vermiyor.', open: 'PaketMartı tableti tezgahta! İlk kuryen hazır.' };
