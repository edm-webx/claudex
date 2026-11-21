/** Sipariş Panosu daily tasks (v2 data.js). Owner: Builder A. Pure data. Faz 2: fixed goals (per 0), no day-by-day escalation. */
export interface DailyTask { id: string; text: string; stat: string; base: number; per: number; needs?: string; minDay?: number; }
export const DAILY_TASKS: DailyTask[] = [
  { id: 'cay', text: 'Vapur yolcularına {n} çay sat', stat: 'sold_cay', base: 25, per: 0 },
  { id: 'doner', text: 'İskeleye {n} döner yetiştir', stat: 'sold_doner', base: 15, per: 0 },
  { id: 'simit', text: 'Tablaya {n} simit diz', stat: 'sold_simit', base: 20, per: 0, needs: 'simit' },
  { id: 'pencere', text: 'Vapur penceresinde {n} satış yap', stat: 'windowSales', base: 8, per: 0, needs: 'pencere' },
  { id: 'set', text: '{n} menü seti sat', stat: 'sets', base: 4, per: 0, needs: 'ayran' },
  { id: 'tips', text: 'Masalardan {n} bahşiş topla', stat: 'tips', base: 6, per: 0, needs: 'tabure1' },
  { id: 'regular', text: 'Bir müdavimin her zamankini doğru getir', stat: 'regularOk', base: 1, per: 0, minDay: 3 },
  { id: 'gazoz', text: '{n} gazoz sat', stat: 'sold_gazoz', base: 12, per: 0, needs: 'gazoz' }
];
export const taskGoal = (t: DailyTask, day: number): number => Math.max(1, Math.round(t.base + t.per * Math.max(0, (day || 1) - 1)));
export const ORDERS_FROM_DAY = 3;
