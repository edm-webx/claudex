/**
 * Hedefler (survey ekonomi-6/7) and bahşiş kavanozu (musteri-8): pure data.
 * Small goals count the delta of a sim stat (S.stats[stat]) from the moment the goal was given, like the daily orders.
 * `needs`: an owned pad key (S.owned) before the goal can appear; `minDay`: earliest game day.
 * Reward: max(reward, rate ₺/min * min) rounded to 5 (rate = the last 3 minutes' income), so it stays "small but felt".
 */
export interface SmallGoalDef { id: string; text: string; stat: string; n: number; reward: number; min: number; needs?: string; minDay?: number;
  /** DNY-10 bölge hedefi: only offered (and kept) while Sabri is in this realm (content/realm RealmId). */
  realm?: string; }

export const SMALL_GOALS: SmallGoalDef[] = [
  { id: 'cay5', text: '5 çay sat', stat: 'sold_cay', n: 5, reward: 40, min: 0.6, needs: 'cay' },
  { id: 'doner6', text: '6 döner yetiştir', stat: 'sold_doner', n: 6, reward: 50, min: 0.7 },
  { id: 'doner12', text: 'Lavaşları konuştur: 12 döner sat', stat: 'sold_doner', n: 12, reward: 90, min: 1.2 },
  { id: 'serve8', text: '8 müşteriyi güler yüzle gönder', stat: 'served', n: 8, reward: 60, min: 0.8 },
  { id: 'clean1', text: 'Bir masayı temizle', stat: 'cleaned', n: 1, reward: 30, min: 0.4, needs: 'tabure1' },
  { id: 'clean3', text: 'Üç masayı pırıl pırıl yap', stat: 'cleaned', n: 3, reward: 60, min: 0.8, needs: 'tabure2' },
  { id: 'tips3', text: 'Masalardan 3 bahşiş topla', stat: 'tips', n: 3, reward: 45, min: 0.6, needs: 'tabure1' },
  { id: 'win3', text: 'Vapur kalkmadan 3 müşteriye yetiş', stat: 'windowSales', n: 3, reward: 70, min: 1.0, needs: 'pencere' },
  { id: 'ferry3', text: 'Üç vapuru iskelede karşıla', stat: 'ferries', n: 3, reward: 60, min: 0.8, minDay: 2 },
  { id: 'pet2', text: 'Kedileri 2 kez sev', stat: 'pets', n: 2, reward: 25, min: 0.3 },
  { id: 'set2', text: '2 menü seti sat', stat: 'sets', n: 2, reward: 60, min: 0.8, needs: 'ayran' },
  { id: 'ayran4', text: '4 ayran köpürt', stat: 'sold_ayran', n: 4, reward: 45, min: 0.6, needs: 'ayran' },
  { id: 'simit5', text: 'Tablaya 5 simit diz, sat', stat: 'sold_simit', n: 5, reward: 45, min: 0.6, needs: 'simit' },
  { id: 'gazoz3', text: '3 gazoz patlat', stat: 'sold_gazoz', n: 3, reward: 50, min: 0.7, needs: 'gazoz' },
  { id: 'tost3', text: '3 tost bastır', stat: 'sold_tost', n: 3, reward: 60, min: 0.8, needs: 'tost' },
  { id: 'ferry1', text: 'Bir vapuru iskelede karşıla', stat: 'ferries', n: 1, reward: 35, min: 0.5 },
  { id: 'sales15', text: 'Kasayı şenlendir: 15 satış', stat: 'sales', n: 15, reward: 100, min: 1.4, minDay: 2 },
  // DNY-10 Belgrad Ormanı bölge hedefleri (42B ile git, mantar topla, çeşmeyi bul, dönüş otobüsü)
  { id: 'orman42b', text: '42B ile Belgrad Ormanı\'na git (büfe karşısı durak)', stat: 'otobusOrman', n: 1, reward: 30, min: 0.4, minDay: 2, realm: 'iskele' },
  { id: 'mantar5', text: 'Ormanda 5 mantar topla (zehirliye dokunma!)', stat: 'mantar', n: 5, reward: 60, min: 0.8, realm: 'belgrad' },
  { id: 'cesme1', text: 'Ormandaki taş çeşmeyi bul, su iç', stat: 'ormanCesme', n: 1, reward: 25, min: 0.3, realm: 'belgrad' },
  { id: 'gol1', text: 'Gölete in, ördekleri gör', stat: 'ormanGol', n: 1, reward: 25, min: 0.3, realm: 'belgrad' },
  { id: 'donus42b', text: 'Orman Durağı\'ndan 42B ile dön', stat: 'otobusDonus', n: 1, reward: 30, min: 0.4, realm: 'belgrad' },
];

/** Seconds a finished small goal stays ticked on the card before the next one rolls in. */
export const GOAL_NEXT_S = 4;
export const GOAL_DONE_LINES = ['Hedef tamam', 'Oldu bu iş', 'Helal olsun', 'Tıkır tıkır'];

// ── bahşiş kavanozu ──
/** Coins (tips + müdavim bozuklukları) to fill the jar: base + per stage. */
export const JAR_BASE = 8;
export const JAR_PER_STAGE = 2;
/** How long the jar sparkles in the world after it fills (sim seconds). */
export const JAR_SPARKLE_S = 90;

