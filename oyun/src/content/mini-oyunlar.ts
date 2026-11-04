/**
 * Mini oyunlar content (survey mini-1..11, icecek-8, icecek-9). Pure data, no runtime imports.
 * - GAMES: the five büfe mini-games, in unlock order (mini-10: one after another with Esnaf Seviyesi).
 * - MICRO: the optional drink-mastery micro-moves shown as quick prompts at the stations (icecek-8/9).
 * - Rewards (mini-4): ₺ = X minutes of earnings, a collectible piece, small capped Altın Simit, 5 min ×1.5 sales bonus.
 * - Daily (mini-5/6): 5 rewarded rounds per day (free tickets), +1 with a "Deneme reklamı", unlimited practice rounds.
 * All names are invented. Player text casual Turkish, no em-dashes.
 */

export type MiniId = 'durum' | 'kule' | 'tost' | 'simit' | 'ayran';
export type MicroId = 'cay' | 'kahve' | 'sallama';

export interface MiniGameDef {
  id: MiniId;
  name: string;
  /** one-line how-to, shown on the card and the intro screen */
  how: string;
  /** Esnaf Seviyesi needed */
  level: number;
  /** round length in seconds (20..60, mini-3) */
  secs: number;
  /** score (0..100) needed for 1, 2, 3 stars */
  stars: [number, number, number];
  /** comic fail moment lines (mini-11) */
  fails: string[];
  /** cheering lines for a good round */
  cheers: string[];
  /** accent colour for the card */
  color: string;
}

export const GAMES: MiniGameDef[] = [
  {
    id: 'durum', name: 'Dürüm Sarma Ritmi', level: 2, secs: 30, stars: [35, 65, 88], color: '#e0533c',
    how: 'Halka içteki çizgiye oturunca dokun. Ritmi tutan lavaşı sarar!',
    fails: ['Dürüm açıldı, domatesler martıya gitti. Martı teşekkür etti.', 'Lavaş uçtu, vapurun bacasına bayrak oldu.', 'Sardın sardın, sonunda kendi parmağını sardın.'],
    cheers: ['Usta işi! Dürüm kendi kendine alkışladı.', 'Ritim sende, lavaş sende, tebrikler!'],
  },
  {
    id: 'kule', name: 'Çay Bardağı Kulesi', level: 3, secs: 45, stars: [30, 60, 85], color: '#c2551f',
    how: 'Tepsideki bardak sağa sola kayıyor. Tam üstüne gelince dokun, kuleyi yükselt!',
    fails: ['Kule sallandı, bardaklar dans etti, kimse kırılmadı. Hepsi yumuşak iniş yaptı.', 'Martı kulenin tepesine kondu, “bu benim” dedi.', 'Bardaklar yere değil, Pamuk\'un minderine düştü. Pamuk küstü.'],
    cheers: ['Galata\'ya rakip geldi!', 'Bu kuleyi görenler fotoğraf çekiyor!'],
  },
  {
    id: 'tost', name: 'Tost Makinesi Zamanlaması', level: 4, secs: 40, stars: [35, 65, 88], color: '#d99a2b',
    how: 'Tost altın sarısı bölgeye gelince dokun ve kaldır. Üç makine birden çalışıyor!',
    fails: ['Tost fazla esmerleşti, tatile gitmiş gibi döndü.', 'Kaşar kaçtı, tezgahın öbür ucunda yakalandı.', 'Tost makinesi “biraz dinlenmem lazım” dedi.'],
    cheers: ['Altın sarısı! Kaşar tam kıvamında uzuyor.', 'Bu tostlar sergide durmalı!'],
  },
  {
    id: 'simit', name: 'Simit Fırlatma', level: 5, secs: 30, stars: [30, 60, 85], color: '#b5733a',
    how: 'Martıların önüne dokun, simit oraya uçar. Uçan martıyı önden yakala!',
    fails: ['Simit denize düştü, bir balık susamları topladı.', 'Martılar seni protesto etti: “Biz daha iyisine layığız!”', 'Simit geri döndü. Bumerang simit icat ettin.'],
    cheers: ['Martılar seni lider seçti!', 'Havada simit yağmuru, martılar mutlu!'],
  },
  {
    id: 'ayran', name: 'Ayran Köpürtme', level: 6, secs: 25, stars: [35, 65, 88], color: '#4a9bc4',
    how: 'Dokundukça köpük yükselir. Köpüğü yeşil bölgede tut, taşırma!',
    fails: ['Köpük tavana yapıştı, bulut oldu, yağmur yağdı. Ayran yağmuru.', 'Ayran o kadar köpürdü ki bir martı içinde banyo yaptı.', 'Köpük kaçtı, iskeleye kadar yürüdü.'],
    cheers: ['Köpük Kulesi ustası geldi!', 'Bu köpük bulut gibi, müşteriler sıraya girdi!'],
  },
];

export const GAME_BY_ID: Record<MiniId, MiniGameDef> = Object.fromEntries(GAMES.map(g => [g.id, g])) as Record<MiniId, MiniGameDef>;

export interface MicroDef { id: MicroId; name: string; how: string; product: 'cay' | 'ayran'; secs: number; ok: string; meh: string }
export const MICRO: Record<MicroId, MicroDef> = {
  cay: { id: 'cay', name: 'Çayı çizgiye doldur', how: 'Basılı tut, çay dolsun. Çizgide bırak!', product: 'cay', secs: 6, ok: 'Tam çizgi! Demlikhan Çay ustası mısın nesin?', meh: 'Biraz kaçtı ama çay yine çay. Otomatik doldurduk.' },
  kahve: { id: 'kahve', name: 'Kahveyi taşırmadan al', how: 'Köpük cezvenin ağzına gelince dokun!', product: 'cay', secs: 6, ok: 'Köpüklü Türk kahvesi! Fal bile güzel çıkar.', meh: 'Kahve biraz erken indi. Yine de içilir, söz.' },
  sallama: { id: 'sallama', name: 'Ayranı salla', how: 'Hızlı hızlı dokun, ayran köpürsün!', product: 'ayran', secs: 5, ok: 'Ayranbey seninle gurur duyuyor!', meh: 'Ayran biraz uykulu kaldı. Otomatik salladık.' },
};

/** Station prompt pacing (sim seconds). */
export const MICRO_COOLDOWN = 70;
export const MICRO_CHANCE = 0.35;
export const MICRO_SHOW = 8;
/** successful micro-move: the next N sales with that product get +PCT tip */
export const MICRO_BUFF_N = 3;
export const MICRO_BUFF_PCT = 0.25;
export const MICRO_OK_SCORE = 60;

/** Daily limits (mini-5, mini-6, altin-2). */
export const FREE_TICKETS = 5;
export const AD_TICKETS = 1;
export const GOLD_CAP = 1;

/** Rewards per star count (index 0 = consolation for a failed round, mini-11). */
export const REWARD_MIN = [0.5, 2, 3, 5];
export const REWARD_FLOOR = 25;        // ₺ floor per earning-minute (early game, before income exists)
export const BONUS_SECS = 300;          // 5 min sales bonus
export const BONUS_MULT = 1.5;

export const CONSOLATION = ['Teselli simidi: Olsun, en büyük ustalar da bir gün lavaş düşürmüş.', 'Sabri\'nin dedesi demiş ki: “Düşen bardak kalkmasını bilir.”', 'Pamuk sana bir mır gönderdi. Moral ödülü.'];

export type CollKind = 'balik' | 'kartpostal' | 'cikartma';
export interface CollectDef { id: string; kind: CollKind; name: string; color: string }
export const COLL_KIND_NAME: Record<CollKind, string> = { balik: 'Balık', kartpostal: 'Kartpostal', cikartma: 'Çıkartma' };
export const COLLECTIBLES: CollectDef[] = [
  { id: 'b1', kind: 'balik', name: 'Gözlüklü İstavrit', color: '#7aa6c2' },
  { id: 'b2', kind: 'balik', name: 'Uykucu Lüfer', color: '#5b7f9e' },
  { id: 'b3', kind: 'balik', name: 'Dans Eden Hamsi', color: '#9cc6d8' },
  { id: 'b4', kind: 'balik', name: 'Bıyıklı Barbunya', color: '#e2866b' },
  { id: 'b5', kind: 'balik', name: 'Şapkalı Palamut', color: '#4f7f8f' },
  { id: 'b6', kind: 'balik', name: 'Gülümseyen Kalkan', color: '#b39b74' },
  { id: 'b7', kind: 'balik', name: 'Şarkıcı Çipura', color: '#c9d3d8' },
  { id: 'b8', kind: 'balik', name: 'Altın Kefal', color: '#e8b23a' },
  { id: 'k1', kind: 'kartpostal', name: 'Martıköy İskelesi Gün Batımı', color: '#f39c5a' },
  { id: 'k2', kind: 'kartpostal', name: 'Sisli Sabah Vapuru', color: '#a9c3d6' },
  { id: 'k3', kind: 'kartpostal', name: 'Simitçi Martı Portresi', color: '#f2d39b' },
  { id: 'k4', kind: 'kartpostal', name: 'Kız Kulesi\'nin Kuzeni', color: '#e57a8a' },
  { id: 'k5', kind: 'kartpostal', name: 'Çarşı Sokağı Kedileri', color: '#c9a46a' },
  { id: 'k6', kind: 'kartpostal', name: 'Lunapark Martı Dönme Dolabı', color: '#8fd6a8' },
  { id: 'k7', kind: 'kartpostal', name: 'Gece Lambaları', color: '#3a4a7a' },
  { id: 'k8', kind: 'kartpostal', name: 'Karlı Büfe', color: '#e8f4fb' },
  { id: 'c1', kind: 'cikartma', name: '“Çay Demlendi” Çıkartması', color: '#c2551f' },
  { id: 'c2', kind: 'cikartma', name: 'Kaşarlı Kalp', color: '#f2c94c' },
  { id: 'c3', kind: 'cikartma', name: 'Havalı Martı', color: '#ffffff' },
  { id: 'c4', kind: 'cikartma', name: 'Köpük Kulesi Logosu', color: '#bfe6f5' },
  { id: 'c5', kind: 'cikartma', name: 'Dürüm Süper Kahraman', color: '#e0533c' },
  { id: 'c6', kind: 'cikartma', name: 'Pamuk Uyuyor', color: '#f7f3ea' },
  { id: 'c7', kind: 'cikartma', name: 'Gevrek Express Roketi', color: '#d9822b' },
  { id: 'c8', kind: 'cikartma', name: '“Usta Benim” Rozeti', color: '#49b96a' },
];

export const KUPA_NAMES = ['', 'Bronz Kupa', 'Gümüş Kupa', 'Altın Kupa'];
export const MINI_VENUE = 'Lunapark Martı: Büfe Köşesi';
export const PRACTICE_NOTE = 'Antrenman turu: ödül yok, keyif bol.';
export const AD_TEXT = 'Deneme reklamı: Boğaz Gazozu, köpüğü bile neşeli!';
