import { describe, it, expect } from 'vitest';
import { createQuality, guessTier, TIER_TABLE, SCALE_MIN } from '../../../src/engine/quality';
import { createPlatform } from '../../../src/engine/platform';

function memLs(): Storage {
  const m = new Map<string, string>();
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); }, key: i => [...m.keys()][i] ?? null, get length() { return m.size; }, clear: () => m.clear() } as Storage;
}
const plat = (search = '', ls: Storage = memLs()) => createPlatform({ search, localStorage: ls, indexedDB: null });

describe('quality', () => {
  it('?tier= sets the GDD numbers', () => {
    const exp = { akici: [25, 0.85, false, 0, 30], dengeli: [50, 1.25, true, 1024, 60], sahane: [90, 2, true, 2048, 60] } as const;
    for (const [name, [crowd, pr, sh, size, fps]] of Object.entries(exp)) {
      const t = createQuality({ platform: plat(`?tier=${name}`) }).current();
      expect(t.name).toBe(name);
      expect([t.crowd, t.pixelRatio, t.shadows, t.shadowSize, t.fps]).toEqual([crowd, pr, sh, size, fps]);
    }
    expect([TIER_TABLE.akici.particles, TIER_TABLE.dengeli.particles, TIER_TABLE.sahane.particles]).toEqual([120, 400, 1000]);
    expect([TIER_TABLE.akici.buildBudgetMs, TIER_TABLE.dengeli.buildBudgetMs, TIER_TABLE.sahane.buildBudgetMs]).toEqual([3, 4, 6]);
  });
  it('guess follows v2 guessTier', () => {
    expect(guessTier(2, 8)).toBe('akici'); expect(guessTier(8, 4)).toBe('akici');
    expect(guessTier(4, 8)).toBe('dengeli'); expect(guessTier(8, 8)).toBe('sahane');
  });
  it('forced slow frames for 10 s drop one tier (auto), then max one change per minute', () => {
    const ls = memLs();
    const q = createQuality({ platform: plat('', ls) });
    q.set('auto');
    // force start at sahane via stored autoTier
    ls.setItem('marti-quality', JSON.stringify({ setting: 'auto', autoTier: 'sahane' }));
    const q2 = createQuality({ platform: plat('', ls) });
    expect(q2.current().name).toBe('sahane');
    const changes: string[] = [];
    q2.onChange((t, why) => changes.push(`${t.name}:${why}`));
    for (let i = 0; i < 9.5 * 60; i++) q2.feed(40, 1 / 60);
    expect(changes).toEqual([]);
    // PRF-12: the resolution scale takes the first ~12 s (6 steps, 2 s apart); only at the floor does the tier drop
    for (let i = 0; i < 6 * 60; i++) q2.feed(40, 1 / 60);
    expect(changes).toEqual(['dengeli:auto']);
    for (let i = 0; i < 30 * 60; i++) q2.feed(60, 1 / 60); // still slow, but < 60 s since change
    expect(changes).toEqual(['dengeli:auto']);
    expect(JSON.parse(ls.getItem('marti-quality')!).autoTier).toBe('dengeli');
  });
  it('rises after 2 min calm', () => {
    const ls = memLs();
    ls.setItem('marti-quality', JSON.stringify({ setting: 'auto', autoTier: 'akici' }));
    const q = createQuality({ platform: plat('', ls) });
    for (let i = 0; i < 125 * 30; i++) q.feed(10, 1 / 30);
    expect(q.current().name).toBe('dengeli');
  });
  it('manual setting persists and disables auto drops', () => {
    const ls = memLs();
    const q = createQuality({ platform: plat('', ls) });
    q.set('akici');
    expect(q.current().name).toBe('akici');
    const again = createQuality({ platform: plat('', ls) });
    expect(again.setting()).toBe('akici'); expect(again.current().name).toBe('akici');
    again.set('sahane');
    for (let i = 0; i < 20 * 60; i++) again.feed(100, 1 / 60);
    expect(again.current().name).toBe('sahane');
  });
});

describe('quality: oyun sırasında otomatik kademe bekler (PRF-03)', () => {
  it('oyun sürerken düşüş kaydedilir ama uygulanmaz; duraklama anında uygulanır', () => {
    const ls = memLs(); ls.setItem('marti-quality', JSON.stringify({ setting: 'auto', autoTier: 'sahane' }));
    const q = createQuality({ platform: plat('', ls) }); const tiers: string[] = [];
    q.onChange(t => tiers.push(t.name));
    let playing = true; q.deferAuto!(() => playing);
    for (let i = 0; i < 90 * 60; i++) q.feed(40, 1 / 60);
    expect(tiers).toEqual([]); expect(q.current().name).toBe('sahane');
    expect(q.scale!()).toBe(SCALE_MIN);   // in play the resolution scale carries the load
    expect(JSON.parse(ls.getItem('marti-quality')!).autoTier).toBe('dengeli');   // next load starts lower
    playing = false;
    expect(q.flushAuto!()).toBe(true);
    expect(tiers).toEqual(['dengeli']); expect(q.flushAuto!()).toBe(false);
  });
  it('duraklamadaysa hemen uygulanır; elle seçilen kademede bekleyen atılır', () => {
    const ls = memLs(); ls.setItem('marti-quality', JSON.stringify({ setting: 'auto', autoTier: 'sahane' }));
    const q = createQuality({ platform: plat('', ls) }); const tiers: string[] = [];
    q.onChange(t => tiers.push(t.name)); q.deferAuto!(() => false);
    for (let i = 0; i < 90 * 60; i++) q.feed(40, 1 / 60);
    expect(tiers[0]).toBe('dengeli');
    const q2 = createQuality({ platform: plat('', ls) }); let pl = true; q2.deferAuto!(() => pl);
    for (let i = 0; i < 90 * 60; i++) q2.feed(40, 1 / 60);
    q2.set('sahane'); pl = false;
    expect(q2.flushAuto!()).toBe(false); expect(q2.current().name).toBe('sahane');
  });
});

describe('quality: dinamik çözünürlük (PRF-12)', () => {
  const mk = (tier: string) => { const ls = memLs(); ls.setItem('marti-quality', JSON.stringify({ setting: 'auto', autoTier: tier })); return createQuality({ platform: plat('', ls) }); };
  const run = (q: ReturnType<typeof mk>, sec: number, ms: number, work = ms) => { for (let i = 0; i < sec * 60; i++) q.feed(ms, 1 / 60, work); };
  it('yavaş karelerde ölçek adım adım düşer, tabanda durur, kademe hemen düşmez', () => {
    const q = mk('sahane'); const seen: number[] = []; q.onScale!(s => seen.push(s)); const tiers: string[] = [];
    q.onChange(t => tiers.push(t.name));
    run(q, 6, 25);
    expect(q.scale!()).toBeLessThan(1); expect(tiers).toEqual([]);
    run(q, 8, 25);
    expect(q.scale!()).toBe(SCALE_MIN);
    expect(seen.every((v, i) => i === 0 || v < seen[i - 1])).toBe(true);
    expect(seen.every(v => v >= SCALE_MIN)).toBe(true);
  });
  it('tabanda hâlâ yavaşsa kademe düşer ve ölçek 1e döner', () => {
    const q = mk('sahane'); const tiers: string[] = [];
    q.onChange(t => tiers.push(t.name));
    run(q, 90, 40);
    expect(tiers[0]).toBe('dengeli'); expect(q.scale!()).toBeGreaterThanOrEqual(SCALE_MIN);
  });
  it('hızlı karelerde ölçek geri yükselir (iş süresi hedefin altında)', () => {
    const q = mk('sahane'); run(q, 14, 25);
    const low = q.scale!(); expect(low).toBe(SCALE_MIN);
    run(q, 40, 16.7, 6);
    expect(q.scale!()).toBe(1);
  });
  it('vsync sınırında iş süresi yüksekse yükselmez; elle kademede ölçek 1', () => {
    const q = mk('sahane'); run(q, 14, 25); run(q, 30, 16.7, 14);
    expect(q.scale!()).toBe(SCALE_MIN);
    q.set('dengeli'); run(q, 3, 25); expect(q.scale!()).toBe(1);
  });
});
