import { describe, it, expect } from 'vitest';
import { createQuality, guessTier, TIER_TABLE } from '../../../src/engine/quality';
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
    for (let i = 0; i < 1 * 60; i++) q2.feed(40, 1 / 60);
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
