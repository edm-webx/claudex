/**
 * Hava, mevsimler ve etkinlikler (survey etkinlik-1..8, yasam-5, motor-7, icecek-6, yiyecek-6, iskele-8, genel-4).
 * Pure data: weather kinds and their weights per season, seasonal demand and foods, the events calendar (main
 * 10-14 days, mini 2-3 days), event menus and rewards, the weekly Gece Pazarı stall and every player-facing line.
 * All names invented. No three, no DOM.
 */
import type { ProductId } from '../game/sim/schema';

export type HavaSeason = 'ilkbahar' | 'yaz' | 'sonbahar' | 'kis';
export type HavaKind = 'acik' | 'lodos' | 'sis' | 'kar' | 'saganak' | 'gokkusagi' | 'sicak' | 'firtina';

export const SEASON_NAMES: Record<HavaSeason, string> = { ilkbahar: 'İlkbahar', yaz: 'Yaz', sonbahar: 'Sonbahar', kis: 'Kış' };

export interface HavaKindDef {
  id: HavaKind; name: string; icon: string;
  /** customers per minute multiplier */ arrival: number;
  /** tables are wet: customers sit only under umbrellas */ wet?: boolean;
  /** sunny: umbrellas keep customers longer and tips grow */ sunny?: boolean;
  start: string[]; line: string[];
}
export const HAVA_KINDS: Record<HavaKind, HavaKindDef> = {
  acik: { id: 'acik', name: 'Açık', icon: '☀', arrival: 1, sunny: true, start: ['Gökyüzü pırıl pırıl, martılar keyifli.'], line: ['Hava güzel, çay da güzel.'] },
  lodos: {
    id: 'lodos', name: 'Lodos', icon: '🌬', arrival: 0.9,
    start: ['Lodos başladı! Şapkalarınızı sıkı tutun.', 'Lodos geldi, martılar geri geri uçuyor.'],
    line: ['Şapkam! Şapkam Kadıköy\'e gitti!', 'Bu rüzgarla simit uçurtma olur.', 'Eğilerek yürü, lodos seni almasın.'],
  },
  sis: {
    id: 'sis', name: 'Sis', icon: '🌫', arrival: 0.9,
    start: ['Sis çöktü. Vapur düdüğü uzaktan geliyor.', 'Boğaz pamuk gibi sis oldu, karşı kıyı tatile çıktı.'],
    line: ['Vapur nerede? Düdüğü var, kendisi yok.', 'Sisin içinde çay daha da güzel.'],
  },
  kar: {
    id: 'kar', name: 'Kar', icon: '❄', arrival: 0.85, wet: true,
    start: ['Kar yağıyor! Çatılar beyaz, çaylar tavşan kanı.', 'Lapa lapa kar! Kartopu savaşı iskeleye ulaştı.'],
    line: ['Kartopu! Kim attı bunu?', 'Kayıyorum, kayıyorum, durdum.', 'Bir salep olsa, olmazsa çay.'],
  },
  saganak: {
    id: 'saganak', name: 'Sağanak', icon: '🌧', arrival: 0.75, wet: true,
    start: ['Sağanak bastırdı! Şemsiyeler açıldı, gazeteler başa.', 'Gökyüzü kovayı devirdi, sağanak geldi.'],
    line: ['Gazeteyi başıma koydum, haberler ıslandı.', 'Su birikintisine zıpla! Hop!', 'Şemsiyem ters döndü, olsun.'],
  },
  gokkusagi: {
    id: 'gokkusagi', name: 'Gökkuşağı', icon: '🌈', arrival: 1.2, sunny: true,
    start: ['Yağmur bitti, gökkuşağı çıktı! Herkes fotoğraf çekiyor.'],
    line: ['Gökkuşağının ucunda büfe varmış!', 'Şuna bak, yedi renk, bir simit.'],
  },
  sicak: {
    id: 'sicak', name: 'Sıcak hava dalgası', icon: '🔥', arrival: 0.9, sunny: true,
    start: ['Sıcak hava dalgası! Herkes gölgeye, buz gibi ayrana.', 'Hava fırın gibi. Simitler kendi kendine kızarıyor.'],
    line: ['Yelpaze lazım, yelpaze!', 'Gölge nerede, ben oradayım.', 'Bir ayran, buz gibi olsun lütfen.'],
  },
  firtina: {
    id: 'firtina', name: 'Fırtına', icon: '⛈', arrival: 0.6, wet: true,
    start: ['Fırtına çıktı! Bir vapur seferi iptal olabilir.', 'Gök gürlüyor, kaptanlar çay molasında.'],
    line: ['Bu havada vapur gelmez, çay gelir.', 'Gök gürledi, kediler tezgahın altına girdi.'],
  },
};

/** Day weather weights per season (one roll per game day). */
export const HAVA_WEIGHTS: Record<HavaSeason, Partial<Record<HavaKind, number>>> = {
  ilkbahar: { acik: 5, saganak: 3, sis: 2, lodos: 1.5, firtina: 0.5 },
  yaz: { acik: 6, sicak: 3, saganak: 1, lodos: 0.8, firtina: 0.6 },
  sonbahar: { acik: 3.5, lodos: 3, sis: 2, saganak: 2.5, firtina: 1 },
  kis: { acik: 2.5, kar: 3, lodos: 2.5, sis: 1.5, saganak: 1.5, firtina: 1 },
};
/** Weather window (game hours) per kind: [earliest start, latest start, min length, max length]; 'acik' has none. */
export const HAVA_WINDOW: Partial<Record<HavaKind, [number, number, number, number]>> = {
  lodos: [8, 13, 5, 11], sis: [8, 9, 3, 5], kar: [8, 12, 5, 12], saganak: [9, 17, 1.5, 3], sicak: [10, 12, 5, 8], firtina: [11, 17, 2, 4],
};
export const RAINBOW_H = 1.3;

/** Demand shift (icecek-6 "belirgin kayma"): product weight multipliers per season and per weather. */
export const SEASON_PREF: Record<HavaSeason, Partial<Record<ProductId, number>>> = {
  ilkbahar: {},
  yaz: { ayran: 1.9, gazoz: 1.9, cay: 0.55 },
  sonbahar: { cay: 1.35, ayran: 0.85 },
  kis: { cay: 2.3, tost: 1.3, ayran: 0.45, gazoz: 0.45 },
};
export const WEATHER_PREF: Partial<Record<HavaKind, Partial<Record<ProductId, number>>>> = {
  sicak: { ayran: 1.8, gazoz: 1.7, cay: 0.5, tost: 0.8 },
  kar: { cay: 1.7, tost: 1.3, ayran: 0.6, gazoz: 0.6 },
  saganak: { cay: 1.4, tost: 1.2 },
  firtina: { cay: 1.5 },
  sis: { cay: 1.3, simit: 1.2 },
  lodos: { cay: 1.2 },
};

/** Seasonal foods (yiyecek-6): sold from the small seasonal cart next to the kiosk, as an extra with a sale. */
export interface SeasonFood { id: string; name: string; price: number; line: string }
export const SEASON_FOODS: Record<HavaSeason | 'ramazan', SeasonFood[]> = {
  kis: [
    { id: 'kestane', name: 'Kestane kebap', price: 14, line: 'Kestane kebap da aldı, elleri ısındı!' },
    { id: 'borek', name: 'Sıcak börek', price: 16, line: 'Bir dilim sıcak börek de kaptı!' },
  ],
  yaz: [
    { id: 'karpuz', name: 'Karpuz-peynir', price: 15, line: 'Yanına karpuz-peynir! Yaz dediğin bu.' },
    { id: 'dondurma', name: 'Dondurma', price: 12, line: 'Bir külah dondurma, iki saniyede eridi.' },
    { id: 'misir_has', name: 'Haşlanmış mısır', price: 10, line: 'Haşlanmış mısır, tuzu bol!' },
    { id: 'misir_koz', name: 'Közde mısır', price: 11, line: 'Közde mısır kokusu iskeleyi sardı.' },
  ],
  ilkbahar: [
    { id: 'erik', name: 'Tuzlu yeşil erik', price: 9, line: 'Tuzlu yeşil erik! Ekşiden yüzü buruştu.' },
    { id: 'cagla', name: 'Çağla', price: 9, line: 'Bir avuç çağla da aldı, çıtır çıtır.' },
  ],
  sonbahar: [
    { id: 'lufer', name: 'Lüfer ekmek', price: 22, line: 'Lüfer ekmek! Kemal Usta\'nın tezgahından taze.' },
  ],
  ramazan: [
    { id: 'pide', name: 'Susamlı pide', price: 12, line: 'Mis gibi susamlı pide de aldı.' },
    { id: 'gullac', name: 'Güllaç', price: 16, line: 'Bir kase güllaç, hafif mi hafif.' },
  ],
};
/** Approximate Ramazan windows (pide and güllaç season), [from, to] as YYYY-MM-DD. */
export const RAMAZAN: [string, string][] = [['2026-02-18', '2026-03-19'], ['2027-02-08', '2027-03-09'], ['2028-01-28', '2028-02-25'], ['2029-01-16', '2029-02-13']];
export const SEASON_FOOD_CHANCE = 0.2;
/** Content prices above are in "small" units; the sim multiplies by this (and the venue multiplier). */
export const HAVA_PRICE_X = 2.5;

/** Umbrellas at tables (iskele-8). */
export const UMBRELLA = {
  /** price of one umbrella (one per table) by count already owned */
  cost: (n: number) => 400 + n * 300,
  max: 6,
  sunEatX: 1.6, sunTipX: 1.35, wetEatX: 1.35,
  /** lodos: seconds between two flying umbrellas, catch window and the bonus */
  flyEvery: [35, 70] as [number, number], catchS: 22, catchR: 1.4, bonusBase: 60, bonusPerStage: 30,
  colors: ['#e0533c', '#3fb5b0', '#ffd23f', '#f2a2b3', '#5d8f45', '#8a6bbf'],
};
export const UMBRELLA_LINES = {
  buy: 'Masaya şemsiye geldi! Güneşte de yağmurda da müşteri oturur.',
  fly: ['Lodos şemsiyeyi kaptı! Yakala onu!', 'Bir şemsiye uçtu, Kadıköy\'e gitmeden yakala!'],
  caught: ['Şemsiyeyi kaptın! Masadaki teyze bahşiş bıraktı.', 'Havada yakaladın! Martılar alkışlıyor.'],
  lost: 'Şemsiye tentenin üstüne kondu, kendi kendine geri geldi.',
  stay: 'Şemsiye altında keyif uzun sürüyor.',
};

/** Weekly Gece Pazarı (etkinlik-5): stocked mini mode, every Saturday night 19:00-24:00. */
export interface MarketItem { id: string; name: string; cost: number; price: number; color: string }
export const MARKET = {
  weekday: 6, // Saturday (0 = Sunday)
  fromH: 19, freshH: 23, pack: 10, maxStock: 40,
  sellEvery: [2.2, 4.2] as [number, number],
  arrival: 1.3,
  items: [
    { id: 'kozmisir', name: 'Közde Mısır', cost: 4, price: 12, color: '#f2c94c' },
    { id: 'pamuk', name: 'Pamuk Şeker', cost: 3, price: 10, color: '#f7a8c8' },
    { id: 'lokma', name: 'Sıcak Lokma', cost: 5, price: 15, color: '#d9a35a' },
    { id: 'midye', name: 'Limonlu Midye', cost: 6, price: 18, color: '#3b3b48' },
  ] as MarketItem[],
};
export const MARKET_LINES = {
  morning: 'Bu akşam Gece Pazarı var! Tezgahın stokunu Takvim sayfasından hazırla.',
  open: 'Gece Pazarı açıldı! Tezgahlar kuruldu, fenerler yandı.',
  fresh: 'Tazelik saati! Kalanlar yarı fiyatına gidiyor.',
  close: 'Gece Pazarı kapandı. Tezgahtan {n} tane sattın, {money} kazandın.',
  cats: 'Kalan {n} tane mahalle kedilerine gitti. Çöp yok, mutlu kedi var.',
  empty: 'Tezgah boş! Takvim sayfasından stok koyabilirsin.',
};

/** Weekday names for the calendar. */
export const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
