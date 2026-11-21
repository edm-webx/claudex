/**
 * Hedefler (survey ekonomi-6/7) and bahşiş kavanozu (musteri-8): pure data.
 * Small goals count the delta of a sim stat (S.stats[stat]) from the moment the goal was given, like the daily orders.
 * `needs`: an owned pad key (S.owned) before the goal can appear; `minDay`: earliest game day.
 * Reward: max(reward, rate ₺/min * min) rounded to 5 (rate = the last 3 minutes' income), so it stays "small but felt".
 */
export interface SmallGoalDef { id: string; text: string; stat: string; n: number; reward: number; min: number; needs?: string; minDay?: number; }

export const SMALL_GOALS: SmallGoalDef[] = [
  { id: 'cay5', text: '5 çay sat', stat: 'sold_cay', n: 5, reward: 40, min: 0.6, needs: 'cay' },
  { id: 'doner6', text: '6 döner yetiştir', stat: 'sold_doner', n: 6, reward: 50, min: 0.7 },
  { id: 'doner12', text: 'Lavaşları konuştur: 12 döner sat', stat: 'sold_doner', n: 12, reward: 90, min: 1.2 },
  { id: 'serve8', text: '8 müşteriyi güler yüzle gönder', stat: 'served', n: 8, reward: 60, min: 0.8 },
  { id: 'clean1', text: 'Bir masayı temizle', stat: 'cleaned', n: 1, reward: 30, min: 0.4, needs: 'tabure1' },
  { id: 'clean3', text: 'Üç masayı pırıl pırıl yap', stat: 'cleaned', n: 3, reward: 60, min: 0.8, needs: 'tabure2' },
  { id: 'tips3', text: 'Masalardan 3 bahşiş topla', stat: 'tips', n: 3, reward: 45, min: 0.6, needs: 'tabure1' },
  { id: 'win3', text: 'Vapur kalkmadan 3 müşteriye yetiş', stat: 'windowSales', n: 3, reward: 70, min: 1.0, needs: 'pencere' },
  { id: 'reg1', text: 'Bir müdavime selam ver, her zamankini getir', stat: 'regularOk', n: 1, reward: 60, min: 0.8, minDay: 2 },
  { id: 'pet2', text: 'Kedileri 2 kez sev', stat: 'pets', n: 2, reward: 25, min: 0.3 },
  { id: 'set2', text: '2 menü seti sat', stat: 'sets', n: 2, reward: 60, min: 0.8, needs: 'ayran' },
  { id: 'ayran4', text: '4 ayran köpürt', stat: 'sold_ayran', n: 4, reward: 45, min: 0.6, needs: 'ayran' },
  { id: 'simit5', text: 'Tablaya 5 simit diz, sat', stat: 'sold_simit', n: 5, reward: 45, min: 0.6, needs: 'simit' },
  { id: 'gazoz3', text: '3 gazoz patlat', stat: 'sold_gazoz', n: 3, reward: 50, min: 0.7, needs: 'gazoz' },
  { id: 'tost3', text: '3 tost bastır', stat: 'sold_tost', n: 3, reward: 60, min: 0.8, needs: 'tost' },
  { id: 'ferry1', text: 'Bir vapuru iskelede karşıla', stat: 'ferries', n: 1, reward: 35, min: 0.5 },
  { id: 'sales15', text: 'Kasayı şenlendir: 15 satış', stat: 'sales', n: 15, reward: 100, min: 1.4, minDay: 2 },
];

/** Seconds a finished small goal stays ticked on the card before the next one rolls in. */
export const GOAL_NEXT_S = 4;
export const GOAL_DONE_LINES = ['Hedef tamam', 'Oldu bu iş', 'Helal olsun', 'Tıkır tıkır'];

// ── bahşiş kavanozu ──
/** Coins (tips + müdavim bozuklukları) to fill the jar: base + per stage. */
export const JAR_BASE = 8;
export const JAR_PER_STAGE = 2;
/** Morale points every worker gets when the jar fills (morale drives speed via moraleFactor). */
export const JAR_MORALE = 12;
/** How long the jar sparkles in the world after it fills (sim seconds). */
export const JAR_SPARKLE_S = 90;
export const JAR_FULL_LINES = [
  'Bahşiş kavanozu doldu! Çırakların morali tavan, eller hızlandı.',
  'Kavanoz ağzına kadar! Ekipte bayram havası, herkes bir vites yukarı.',
];
export const JAR_FULL_ALONE = 'Bahşiş kavanozu doldu! Sabri ıslık çalarak çalışıyor.';
export const JAR_REGULAR_LINE = 'Müdavim kavanoza bozukluk attı.';

