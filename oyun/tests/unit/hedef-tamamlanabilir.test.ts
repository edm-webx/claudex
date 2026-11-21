// UX-06: müdavimler kapalı (MUDAVIMLER_KAPALI); hiçbir hedef, günlük görev ya da başarım tamamlanamayan 'regularOk' sayacını beklememeli.
import { describe, it, expect } from 'vitest';
import { SMALL_GOALS } from '../../src/content/goals';
import { DAILY_TASKS } from '../../src/content/daily';
import { ACHIEVEMENTS } from '../../src/content/achievements';

const OLU = new Set(['regularOk']);
describe('tamamlanabilir hedefler', () => {
  it('küçük hedefler ölü sayaç beklemez', () => { for (const g of SMALL_GOALS) expect(OLU.has(g.stat), g.id).toBe(false); });
  it('günlük görevler ölü sayaç beklemez', () => { for (const d of DAILY_TASKS) expect(OLU.has(d.stat), d.id).toBe(false); });
  it('başarımlar ölü sayaç beklemez', () => { for (const a of ACHIEVEMENTS) expect(OLU.has(a.stat), a.id).toBe(false); });
});
