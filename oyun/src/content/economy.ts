/**
 * Economy constants and progression tables (v2 data.js D.P and friends, numbers kept). Owner: Builder A. Pure data.
 * Also holds the crew tables (roles, rarity, ranks, traits, legends, names) that board.ts needs; C's content files
 * (workers/traits/ranks/names) may re-export from here so there is one source of numbers.
 */
import type { GradeId, ProductId } from '../game/sim/schema';
import { GAME_DAY_S, DAY_START_H, DAY_END_H } from '../engine/api';
import { DECOR_EXTRA, DECOR_SETS_EXTRA } from './dekor-katalog';
import { TIER_PRICE_X, STREAK, SIFTAH_X, STAGE_MULT, VENUE, KEPENK2 } from './ekonomi2';

export const P = {
  // survey 2026-10-24: one clock for everyone (engine/api.ts). The old 240 s here ended the day at 16:00, so night never came.
  GAME_DAY_S, HOUR_S: GAME_DAY_S / (DAY_END_H - DAY_START_H), DAY_START_H, DAY_END_H, WEEK_GAME_DAYS: 7,
  SIM_HZ: 30,
  TIER_X: TIER_PRICE_X,                  // K1..K4 price premium (Faz 2, ekonomi2.ts)
  STREAK_WINDOW_S: 10, STREAK_STEP: STREAK.step, STREAK_MAX: STREAK.max,   // Sıcak Tezgah
  SET_CHANCE: 0.20, SET_CHANCE_SIGN: 0.35,
  SIFTAH_X: SIFTAH_X,
  TAD_TOTAL: [...STAGE_MULT, STAGE_MULT[STAGE_MULT.length - 1]], // stage 1..5 (+ Amiral Gemisi), flat (Faz 2)
  TAD_S: [0, 0, 90, 240, 0, 0],          // crew timer (real seconds) to reach stage n in THIS build
  TAD_H_GDD: [0.5, 2, 6, 12, 24],        // GDD crew hours (kept for the next build)
  PLAQUE_X: 1 + VENUE.perPlaque,                           // all open stations at K2 / K3 / K4 -> venue x2 each
  STAR_PCT: VENUE.perStar,
  DECOR_MAX: VENUE.siklikMax,                       // Şıklık income cap per venue
  DECOR_PATIENCE_PER_KEYIF: 0.01, DECOR_PATIENCE_CAP: 0.15,
  DECOR_TIP_PER_KEYIF: 0.005, DECOR_TIP_CAP: 0.10,
  ACH_LOVE: 0.01, CAT_F: 0.10, CAT_AT: [13, 25, 50, 75, 100, 125, 150, 175, 200, 250, 300],
  SALARY: [0.03, 0.04, 0.05, 0.06, 0.06], // wage share of what the worker produced, by rank
  RANK_XP: [0, 300, 1500, 6000, 20000], RANK_X: [1, 1.25, 1.5, 1.8, 2.2],
  MORALE_START: 70,
  CARRY_BASE: 4, TRAY_PLUS: 2,
  MAGNET_M: [0.8, 1.2, 1.6, 2.2, 3.0],   // Mıknatıslı Önlük levels
  MAGNET_COST: [0, 2500, 15000, 60000, 200000],
  KEPENK: [ // [hours cap, rate, where sold, price] - Faz 2: offline income is almost nothing on purpose
    [KEPENK2[0][0], KEPENK2[0][1], 'İskele', 0], [KEPENK2[1][0], KEPENK2[1][1], 'İskele', 30000], [KEPENK2[2][0], KEPENK2[2][1], 'Vapur Büfesi', null], [KEPENK2[3][0], KEPENK2[3][1], 'Köprüaltı', null]],
  ACT_PERFECT: 2.5, EFF: 0.7,            // active vs idle (worker) rate, player efficiency (sim)
  RET_MIN_GAP_S: 900,                    // welcome-back x2 ad only after 15 min away (GDD); card from 2 min
  WELCOME_MIN_S: 120,
  // rewards in minutes of income. pacing.js uses 10 / 20 / 5, but its idle model has 100s of station levels to
  // sink money into; this build has only pads, K2-K4 tiers and two tadilats, so the bot-tuned values are lower.
  ORDER_MIN: 0.6, ORDER_ALL_MIN: 1.2, KASA_MIN: 1,   // Faz 2: rewards < 1 minute of income (were 3/6/3 and doubled the income)
  // 2026-10-24 user: Altın Simit was far too easy, all sources cut to roughly a third
  AS_ACH: 1, AS_ORDER: 0, AS_ORDER_ALL: 3, AS_STAR: 2, AS_TAD: 4, AS_WEEKLY: 6,
  XP: { buy: 4, pad: 20, worker: 20, station: 25, star: 60, plaque: 50, tadilat: 80, order: 30, ach: 10 },
  XP_BASE: 30, XP_EXP: 1.3,
  QUEUE_MAX: 8, WINDOW_S: 20, WINDOW_QUEUE: 6,
  FERRY_FIRST_S: 120, FERRY_EVERY_S: [70, 95], FERRY_WAVE: [20, 60],
  CAT_WAKE_S: 160,
  ENTRY_M: [13, 17], LEAVE_M: 18,      // walk-ins appear this far (path metres) from their spot; leavers vanish past this
  SLOW_S: 10,
  MAX_BUBBLES: 8,
  MONEY_STACKS_MAX: 30
} as const;
export const KEPENK = P.KEPENK as unknown as readonly (readonly [number, number, string, number | null])[];

export const TIP_FRAC = [0, 0.05, 0.10, 0.15, 0.22, 0.30];
export const PATIENCE_S = [40, 15, 25, 40, 60, 90];

/** Esnaf Seviyesi: XP needed to go from level n to n+1 */
export const xpForLevel = (n: number): number => Math.round(P.XP_BASE * Math.pow(n, P.XP_EXP));
export const LEVEL_UNLOCKS = [
  { level: 2, id: 'menu', text: 'İstasyon sekmesi açıldı: ürün kademeleri' },
  { level: 3, id: 'isciler', text: 'Ekip sekmesi açıldı' },
  { level: 4, id: 'karne', text: 'Büfe karnesi ve yıldızlar açıldı' },
  { level: 5, id: 'kepenk', text: 'Kepenk yükseltmesi açıldı' },
  { level: 6, id: 'dekor', text: 'Dekor sekmesi açıldı' },
  { level: 7, id: 'kasa', text: 'Kasa sayımı töreni açıldı' },
  { level: 8, id: 'altin', text: 'Altın Simit açıldı' }
];
/** Kepenk (offline earnings): seconds away -> ₺ */
export const offlineEarnings = (seconds: number, ratePerMin: number, ladderLevel: number) => {
  const k = KEPENK[Math.max(0, Math.min(KEPENK.length - 1, ladderLevel || 0))];
  const cap = k[0] * 3600, s = Math.max(0, Math.min(seconds, cap));
  return { amount: Math.floor(ratePerMin * (s / 60) * k[1]), seconds: s, capped: seconds > cap, capH: k[0], rate: k[1] };
};
export const kepenkCost = (level: number): number | null | undefined => { const k = KEPENK[level]; return k ? k[3] : null; };
/** Altın Simit to finish a timer now (GDD: ceil(5 * hours^0.75)) */
export const skipGold = (secondsLeft: number): number => secondsLeft <= 0 ? 0 : Math.max(1, Math.ceil(5 * Math.pow(secondsLeft / 3600, 0.75)));

export const GRADES: { id: GradeId; label: string }[] = [
  { id: 'lezzet', label: 'Lezzet' }, { id: 'hiz', label: 'Hız' }, { id: 'siklik', label: 'Şıklık' },
  { id: 'sohret', label: 'Şöhret' }, { id: 'temizlik', label: 'Temizlik' }];
export const GRADE_NAMES = ['Zayıf', 'Geçer', 'Orta', 'İyi', 'Pekiyi'];
export const grade5 = (score: number): number => Math.max(1, Math.min(5, 1 + Math.floor(score * 5 - 1e-9)));
export interface StarReport { stations: number; workers: number; grades: Record<string, number>; plaque: number; gurme: boolean; tadilat: number; pads: number; }
export const STAR_RULES: { n: number; text: string; ok: (r: StarReport) => boolean }[] = [
  { n: 1, text: '3 istasyon açık, 1 işçi', ok: (r: StarReport) => r.stations >= 3 && r.workers >= 1 },
  { n: 2, text: '6 istasyon açık, 3 işçi, karnede iki "Orta"', ok: (r: StarReport) => r.stations >= 6 && r.workers >= 3 && Object.values(r.grades).filter(g => g >= 3).length >= 2 },
  { n: 3, text: 'Esnaf Plaketi (bütün istasyonlar K2) ve gurme sınavı', ok: (r: StarReport) => r.plaque >= 1 && r.gurme },
  { n: 4, text: '1. Tadilat, 8 sarı kare, karnede üç "İyi"', ok: (r: StarReport) => r.tadilat >= 1 && r.pads >= 8 && Object.values(r.grades).filter(g => g >= 4).length >= 3 },
  { n: 5, text: '2. Tadilat, 16 sarı kare, 2. plaket, beş "İyi", biri "Pekiyi"', ok: (r: StarReport) => r.tadilat >= 2 && r.pads >= 16 && r.plaque >= 2 && Object.values(r.grades).filter(g => g >= 4).length >= 5 && Object.values(r.grades).some(g => g >= 5) }
];
export const starsFor = (report: StarReport): number => { let s = 0; for (const rule of STAR_RULES) { if (rule.ok(report)) s = rule.n; else break; } return s; };

export const TROPHIES = [
  { id: 'en_hizli_cay', name: 'En Hızlı Çay', stat: 'sold_cay' },
  { id: 'marti_savar', name: 'Martı Savar Ödülü', stat: 'gullsChased' },
  { id: 'temizlik', name: 'Temizlik Kupası', stat: 'cleaned' },
  { id: 'mahallenin_gozdesi', name: 'Mahallenin Gözdesi', stat: 'served' },
  { id: 'altin_durum', name: 'Altın Dürüm', stat: 'sold_doner' }
];
export const COMPLAINTS: Record<string, { text: string; fix: string }> = {
  transport: { text: 'tepside ürün birikti, taşıyan yok', fix: 'Garson al' },
  production: { text: '{station} yetişmedi', fix: 'Usta al' },
  seats: { text: 'oturacak yer yoktu', fix: 'Masa aç' },
  queue: { text: 'kuyruk çok uzun bekledi', fix: 'İşçi al' },
  kasa: { text: 'kasada para birikti', fix: 'Mıknatıslı önlük' }
};
export interface DecorDef2 { id: string; name: string; set: string; price: number; keyif: number; points: number; size: 's' | 'm' | 'l'; color: string; cats?: boolean; }
export const DECOR_SETS: Record<string, string> = { nostalji: 'Nostalji / Yeşilçam', denizci: 'Martı / Denizci', lale: 'Lale Devri', genel: 'Genel', ...DECOR_SETS_EXTRA };
export const DECOR: DecorDef2[] = [
  { id: 'nostalji_radyo', name: 'Lambalı radyo', set: 'nostalji', price: 1800, keyif: 2, points: 2, size: 's', color: 'sepya' },
  { id: 'nostalji_gazetelik', name: 'Günaydın Postası standı', set: 'nostalji', price: 2400, keyif: 2, points: 3, size: 'm', color: 'sepya' },
  { id: 'nostalji_afis', name: 'Sepya film afişi', set: 'nostalji', price: 1200, keyif: 1, points: 2, size: 's', color: 'sepya' },
  { id: 'nostalji_sandalye', name: 'Hasır kahvehane sandalyesi', set: 'nostalji', price: 1500, keyif: 2, points: 2, size: 's', color: 'sepya' },
  { id: 'denizci_can_simidi', name: 'Can simidi', set: 'denizci', price: 1000, keyif: 1, points: 2, size: 's', color: 'deniz' },
  { id: 'denizci_halat', name: 'Halat korkuluk', set: 'denizci', price: 1300, keyif: 1, points: 2, size: 'm', color: 'deniz' },
  { id: 'denizci_fener', name: 'Deniz feneri maketi', set: 'denizci', price: 3200, keyif: 3, points: 3, size: 'm', color: 'deniz' },
  { id: 'denizci_martiheykel', name: 'Martı Pozu heykeli', set: 'denizci', price: 4500, keyif: 3, points: 4, size: 'l', color: 'deniz' },
  { id: 'lale_cini_pano', name: 'Çini duvar panosu', set: 'lale', price: 3500, keyif: 3, points: 3, size: 'm', color: 'cini' },
  { id: 'lale_saksi', name: 'Lale saksısı', set: 'lale', price: 1400, keyif: 2, points: 2, size: 's', color: 'cini' },
  { id: 'lale_semaver', name: 'Bakır semaver', set: 'lale', price: 5000, keyif: 3, points: 4, size: 'm', color: 'cini' },
  { id: 'lale_minder', name: 'Sedir minderi', set: 'lale', price: 1600, keyif: 2, points: 2, size: 'm', color: 'cini' },
  { id: 'saksi_sardunya', name: 'Sardunya saksısı', set: 'genel', price: 800, keyif: 2, points: 2, size: 's', color: 'yesil' },
  { id: 'kedi_evi', name: 'Karton kedi evi', set: 'genel', price: 1200, keyif: 2, points: 2, size: 's', color: 'yesil', cats: true },
  { id: 'sokak_lambasi', name: 'Eski sokak lambası', set: 'genel', price: 2600, keyif: 2, points: 3, size: 'm', color: 'sepya' },
  { id: 'tavla_masasi', name: 'Tavla masası', set: 'genel', price: 3000, keyif: 3, points: 3, size: 'l', color: 'sepya' },
  ...DECOR_EXTRA // Dekor 2.0 catalogue (dekor-katalog.ts)
] as DecorDef2[];
export const decorById = (id: string): DecorDef2 | undefined => DECOR.find(d => d.id === id);
export const SIKLIK_MAX: Record<number, number> = { 1: 36, 2: 50, 3: 64, 4: 80, 5: 96 };
/** Şıklık 0..100 from the placed decor ids */
export function siklik(placedIds: (string | null | undefined)[], stage: number, penalties = 0): number {
  const items = placedIds.filter((x): x is string => !!x).map(decorById).filter((d): d is DecorDef2 => !!d);
  let pts = 0; const bySet: Record<string, number> = {};
  items.forEach(d => { pts += d.points; bySet[d.set] = (bySet[d.set] || 0) + 1; });
  items.forEach(d => { if (d.set !== 'genel' && bySet[d.set] >= 4) pts += d.points * 0.25; });
  const fam: Record<string, number> = {}; items.forEach(d => { fam[d.color] = (fam[d.color] || 0) + 1; });
  const top = Math.max(0, ...Object.values(fam));
  if (items.length >= 4 && top / items.length >= 0.9) pts += 10; else if (items.length >= 4 && top / items.length >= 0.7) pts += 5;
  pts -= penalties;
  return Math.max(0, Math.min(100, Math.round(100 * pts / (SIKLIK_MAX[stage] || 20))));
}
export const decorKeyif = (placedIds: (string | null | undefined)[]): number => placedIds.filter((x): x is string => !!x).map(decorById).filter((d): d is DecorDef2 => !!d).reduce((s, d) => s + d.keyif, 0);
export const DECOR_IDS = DECOR.map(d => d.id);
export const productIdsOf = (): ProductId[] => ['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'];
