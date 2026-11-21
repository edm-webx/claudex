import { describe, it, expect } from 'vitest';
import { createSave, bindSaveToVisibility, checksum } from '../../../src/engine/save';
import { createPlatform } from '../../../src/engine/platform';
import type { Platform, SaveOpts, Migration } from '../../../src/engine/api';
import { defaultState, SAVE_VERSION, type GameState } from '../../../src/game/sim/schema';

function fakeLs() {
  const m = new Map<string, string>();
  return {
    m,
    storage: {
      available: true,
      get: (k: string) => m.get(k) ?? null,
      set: (k: string, v: string) => { m.set(k, v); return true; },
      del: (k: string) => { m.delete(k); },
      keys: (p: string) => [...m.keys()].filter(k => k.startsWith(p)).sort(),
    } as Platform['storage'],
  };
}
function fakeIdb() {
  const m = new Map<string, unknown>();
  return {
    m,
    idb: {
      available: async () => true,
      get: async (k: string) => m.get(k) as never,
      set: async (k: string, v: unknown) => { m.set(k, v); return true; },
      del: async (k: string) => { m.delete(k); },
      keys: async (p: string) => [...m.keys()].filter(k => k.startsWith(p)).sort(),
    } as Platform['idb'],
  };
}
const throwing = new Proxy({}, { get: () => () => { throw new Error('blocked'); } });

function mk(over: Partial<{ storage: Platform['storage']; idb: Platform['idb']; migrations: Migration[] }> = {}) {
  const ls = fakeLs(), db = fakeIdb();
  let wall = Date.UTC(2026, 9, 17, 12);
  let state: GameState = defaultState(1);
  const opts: SaveOpts<GameState> = {
    key: 'tst', version: SAVE_VERSION, defaults: () => defaultState(1), migrations: over.migrations ?? [],
    validate: d => { const n: string[] = []; if (d.money < 0) { d.money = 0; n.push('money clamped'); } return n; },
    get: () => state,
    platform: { storage: over.storage ?? ls.storage, idb: over.idb ?? db.idb, clock: { now: () => 0, wall: () => wall } },
    log: { info() {}, warn() {}, error() {} },
  };
  const save = createSave(opts);
  return { save, ls, db, set: (s: GameState) => { state = s; }, get: () => state, tick: (ms: number) => { wall += ms; }, setWall: (ms: number) => { wall = ms; } };
}
const withMoney = (n: number) => { const s = defaultState(1); s.money = n; return s; };

describe('save', () => {
  it('round trip via IndexedDB with localStorage mirror', async () => {
    const t = mk();
    expect((await t.save.load()).from).toBe('fresh');
    t.set(withMoney(50));
    expect(await t.save.save('manual')).toBe(true);
    expect(t.save.mode).toBe('idb');
    expect(t.db.m.has('tst:s0')).toBe(true);
    expect(t.ls.m.has('tst:0')).toBe(true);
    expect(t.db.m.has('tst:ptr')).toBe(true);
    const r = await t.save.load();
    expect(r.from).toBe('idb'); expect(r.data.money).toBe(50);
  });

  it('corrupt newest slot -> older slot loads; checksum mismatch detected', async () => {
    const t = mk();
    await t.save.load();
    t.set(withMoney(10)); await t.save.save('manual');
    t.set(withMoney(20)); await t.save.save('manual');
    // corrupt slot 1 (newest) in both stores: flip the payload without fixing the checksum
    const bad = (raw: string) => raw.replace('"money\\":20', '"money\\":999');
    t.db.m.set('tst:s1', bad(t.db.m.get('tst:s1') as string));
    t.ls.m.set('tst:1', bad(t.ls.m.get('tst:1')!));
    expect(t.db.m.get('tst:s1')).toContain('999');
    const r = await t.save.load();
    expect(r.data.money).toBe(10);
    expect(r.repaired.some(n => n.startsWith('checksum'))).toBe(true);
  });

  it('IndexedDB throws -> localStorage used', async () => {
    const t = mk({ idb: throwing as Platform['idb'] });
    await t.save.load();
    t.set(withMoney(7));
    expect(await t.save.save('manual')).toBe(true);
    expect(t.save.mode).toBe('ls');
    expect(t.ls.m.has('tst:s0')).toBe(true);
    expect((await t.save.load()).data.money).toBe(7);
  });

  it('both throw -> memory mode, no exception', async () => {
    const t = mk({ idb: throwing as Platform['idb'], storage: throwing as Platform['storage'] });
    const r = await t.save.load();
    expect(r.from).toBe('fresh');
    t.set(withMoney(3));
    expect(await t.save.save('manual')).toBe(true);
    expect(t.save.mode).toBe('memory');
    expect((await t.save.load()).data.money).toBe(3);
    expect(typeof (await t.save.exportCode())).toBe('string');
  });

  it('also works on a real createPlatform with no storage at all', async () => {
    const p = createPlatform({ search: '', localStorage: null, indexedDB: null });
    const s = createSave({ key: 'x', version: 1, defaults: () => defaultState(1), migrations: [], validate: () => [], get: () => defaultState(1), platform: p });
    expect((await s.load()).from).toBe('fresh');
    expect(await s.save('manual')).toBe(true);
    expect(s.mode).toBe('memory');
  });

  it('migration v0 -> v1 fixture, pre-migration backup written first', async () => {
    const v0 = { money: -5, gold: 2, day: 4, tiers: { doner: 2 }, hero: 'sabri' }; // v0 fixture: no version field
    let backupSeenBeforeUp = false;
    const t = mk({ migrations: [{ from: 0, to: 1, up: (o: any) => { backupSeenBeforeUp = [...t.db.m.keys()].some(k => k.startsWith('tst:pre:0:')); return { ...defaultState(1), ...o, tiers: { ...defaultState(1).tiers, ...o.tiers } }; } }] });
    const json = JSON.stringify(v0);
    t.db.m.set('tst:s0', JSON.stringify({ seq: 1, at: 1, v: 0, sum: checksum(json), json }));
    const r = await t.save.load();
    expect(backupSeenBeforeUp).toBe(true);
    expect(r.data.version).toBe(1);
    expect(r.data.day).toBe(4); expect(r.data.tiers.doner).toBe(2); expect(r.data.tiers.cay).toBe(1);
    expect(r.data.money).toBe(0);
    expect(r.repaired).toContain('migrated v0 -> v1');
    expect(r.repaired).toContain('money clamped');
    const b = await t.save.backups();
    expect(b.some(x => x.kind === 'premigration' && x.version === 0)).toBe(true);
  });

  it('daily backup ring keeps 7', async () => {
    const t = mk();
    await t.save.load();
    for (let d = 0; d < 10; d++) { t.set(withMoney(d)); await t.save.save('interval'); t.tick(86400_000); }
    const daily = [...t.db.m.keys()].filter(k => k.startsWith('tst:daily:'));
    expect(daily.length).toBe(7);
    expect(daily.sort()[0]).toBe('tst:daily:2026-10-20');
    // all slots gone -> newest daily backup loads
    for (const k of ['tst:s0', 'tst:s1', 'tst:s2']) t.db.m.delete(k);
    for (const k of ['tst:0', 'tst:1', 'tst:2']) t.ls.m.delete(k);
    const r = await t.save.load();
    expect(r.from).toBe('backup'); expect(r.data.money).toBe(9);
    // restore an explicit backup
    expect(await t.save.restore('daily:2026-10-21')).toBe(true);
    expect((await t.save.load()).data.money).toBe(4);
  });

  it('export/import round trip equal; bad code rejected', async () => {
    const t = mk();
    await t.save.load();
    const s = withMoney(1234); s.gold = 9; s.workers.push({ id: 1, name: 'Rıza', role: 'garson', xp: 3, morale: 1, traits: ['hizli'] });
    t.set(s);
    const code = await t.save.exportCode();
    expect(code.startsWith('MB1.')).toBe(true);
    await t.save.wipe();
    expect((await t.save.load()).from).toBe('fresh');
    expect(await t.save.importCode(code.slice(0, -6) + 'AAAAAA')).toBe(false);
    expect(await t.save.importCode(code)).toBe(true);
    expect((await t.save.load()).data).toEqual(s);
  });

  it('interval saves every 10 s only when dirty', async () => {
    const t = mk();
    await t.save.load();
    t.save.tick(0);
    t.save.tick(20_000);
    expect(t.db.m.has('tst:s0')).toBe(false);
    t.save.markDirty();
    t.save.tick(25_000);
    t.save.tick(31_000);
    await new Promise(r => setTimeout(r, 10));
    expect(t.db.m.has('tst:s0')).toBe(true);
  });

  it('save on hide(): visibility hidden pauses the loop and writes a save', async () => {
    const t = mk();
    await t.save.load();
    const p = createPlatform({ search: '', localStorage: null, indexedDB: null });
    const calls: string[] = [];
    bindSaveToVisibility(t.save, p.visibility, { pause: w => calls.push('pause:' + w), resume: () => calls.push('resume') });
    t.set(withMoney(77));
    p.visibility.simulate(true);
    await new Promise(r => setTimeout(r, 10));
    expect(calls).toEqual(['pause:hidden']);
    expect((await t.save.load()).data.money).toBe(77);
    p.visibility.simulate(false);
    expect(calls).toEqual(['pause:hidden', 'resume']);
  });
});
