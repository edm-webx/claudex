// KAL-02: v1 kayıt -> v2 göç (zincir ve stok ölü verisi gider, gerisi birebir kalır) + eski fixture açılır.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createGameSave } from '../../src/game/sim/save';
import { createSave } from '../../src/engine/save';
import { SAVE_KEY, defaultState, type GameState } from '../../src/game/sim/schema';
import { fakePlatform, log, mkSim } from './m1-helpers';

const fx = (n: string) => JSON.parse(readFileSync(new URL('../fixtures/saves/' + n, import.meta.url), 'utf8')) as GameState;

describe('save göçü v1 -> v2', () => {
  it('v1 fixture: premigration yedeği alınır, zincir ve stok silinir, kalan her şey eşit', async () => {
    const v1 = fx('v1-dolu.json');
    expect(v1.version).toBe(1); expect((v1.zones as any).zincir).toBeTruthy();
    const fp = fakePlatform();
    // v1 build'inin yazdığı gibi: sürüm 1 depo
    const eski = createSave<GameState>({ key: SAVE_KEY, version: 1, defaults: () => defaultState(7), migrations: [], validate: () => [], get: () => v1, platform: fp.platform });
    expect(await eski.save('manual')).toBe(true);
    const yeni = createGameSave(mkSim(7), fp.platform, { log });
    const r = await yeni.load();
    expect(r.repaired.some(n => n.includes('migrated v1 -> v2'))).toBe(true);
    const d = r.data as any;
    expect(d.version).toBe(2);
    expect(d.zones.zincir).toBeUndefined();
    for (const p of Object.values<any>(d.zones.arsa.plots)) expect('stok' in p).toBe(false);
    expect(d.zones.arsa.plots.k1).toMatchObject({ lv: 3, isci: 2, tema: 'sahil', sat: 77 });
    expect(d.zones.arsa.kredi).toEqual({ borc: 2500.75, gun: 12 });
    expect(d.zones.okul.sinavlar).toEqual([80, 60, 100]); expect(d.zones.avm.alinan).toEqual(['gomlek1', 'ruj2']);
    expect(d.money).toBeCloseTo(98765.5, 3); expect(d.day).toBe(30); expect(d.workers[0].name).toBe('Rıza');
    expect(JSON.stringify(Object.keys(d.zones).sort())).toBe(JSON.stringify(Object.keys(fx('v2-dolu.json').zones).sort()));
    const yedekler = await yeni.backups();
    expect(yedekler.some(b => b.kind === 'premigration' && b.version === 1)).toBe(true);
  });

  it('göçten sonra sim açılır ve 60 sn oynar', async () => {
    const fp = fakePlatform();
    await createSave<GameState>({ key: SAVE_KEY, version: 1, defaults: () => defaultState(7), migrations: [], validate: () => [], get: () => fx('v1-dolu.json'), platform: fp.platform }).save('manual');
    const r = await createGameSave(mkSim(7), fp.platform, { log }).load();
    const sim = mkSim(7, r.data);
    sim.step(60);
    expect(Number.isFinite(sim.state.money)).toBe(true);
    expect(sim.state.zones.zincir).toBeUndefined();
  });

  it('v2 fixture göç gerektirmez, açılır (altın dosya)', async () => {
    const fp = fakePlatform();
    await createSave<GameState>({ key: SAVE_KEY, version: 2, defaults: () => defaultState(7), migrations: [], validate: () => [], get: () => fx('v2-dolu.json'), platform: fp.platform }).save('manual');
    const r = await createGameSave(mkSim(7), fp.platform, { log }).load();
    expect(r.repaired.some(n => n.includes('migrated'))).toBe(false);
    expect((r.data.zones as any).arsa.plots.k1.lv).toBe(3);
  });
});
