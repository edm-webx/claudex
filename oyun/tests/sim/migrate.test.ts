// M1 v2 import: tests/fixtures/saves/v2-sample.json -> GameState, then the sim runs on it.
import { describe, it, expect } from 'vitest';
import { VENUE } from '../../src/content/ekonomi2';
import { readFileSync } from 'node:fs';
import { migrateV2 } from '../../src/game/sim/migrate-v2';
import { SAVE_VERSION } from '../../src/game/sim/schema';
import { mkSim } from './m1-helpers';

const raw = readFileSync(new URL('../fixtures/saves/v2-sample.json', import.meta.url), 'utf8');

describe('migrate v2', () => {
  it('maps the v2 shapes onto GameState', () => {
    const s = migrateV2(raw);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.hero).toBe('sabriye'); expect(s.money).toBe(4321.5); expect(s.day).toBe(4); expect(s.level).toBe(5);
    expect(s.owned.cay).toBe(1); expect(s.owned.isbul).toBe(1); expect(s.owned.gazoz).toBeUndefined();
    expect(s.padPaid.gazoz).toBe(640);
    expect(s.tiers.simit).toBe(3);
    expect(s.cats).toEqual([{ id: 'pamuk' }, { id: 'tarcin' }]);
    expect(s.decorSlots).toEqual([{ slot: '1', item: 'sofra_bezi' }, { slot: '4', item: 'sofra_bezi' }]);
    expect(s.workers.map(w => w.name)).toEqual(['Rıza', 'Nazlı']);
    expect(s.workers[0].traits).toEqual(['hamarat']);
    expect(s.sign).toMatchObject({ text: 'Sabriye Büfe', font: 'neon' });
    expect(s.settings.muted).toBe(true); expect(s.settings.textScale).toBe(1);   // v2 had 3 settings, the rest default
    expect(s.player.zone).toBe('iskele');
  });
  it('accepts wrappers, objects and garbage', () => {
    expect(migrateV2({ data: JSON.parse(raw) }).day).toBe(4);
    expect(migrateV2(JSON.parse(raw)).day).toBe(4);
    expect(migrateV2('{not json').day).toBe(1);
    expect(migrateV2(null).money).toBe(0);
    expect(migrateV2({ money: -9, tiers: { doner: 99 } }).tiers.doner).toBe(4);
  });
  it('a sim started on the imported save has the v2 venue and keeps playing', () => {
    const s = migrateV2(raw);
    const sim = mkSim(7, s);
    const r = sim.rules;
    expect(r.rt.stations.simit.built).toBe(true);
    expect(r.rt.stations.gazoz.built).toBe(false);
    expect(r.rt.tables.filter(t => t.built).length).toBe(3);          // tabure1, tabure2, masa1
    expect(r.rt.kasa.length).toBeGreaterThan(0);                      // pile 250
    const base = 1 + VENUE.perStage * (s.stage - 1) + VENUE.perPlaque * (s.plaque || 0) + VENUE.perStar * (s.stars || 0);
    expect(r.venueMult()).toBeGreaterThanOrEqual(base - 1e-9);                       // Faz 2 venue: additive pieces...
    expect(r.venueMult()).toBeLessThanOrEqual(base + VENUE.siklikMax + 1e-9);        // ...plus at most the şıklık bonus
    sim.command({ kind: 'play' });
    sim.step(60);
    expect(sim.state.hero).toBe('sabriye');
    expect(r.rt.started).toBe(true);
    expect(sim.state.playT).toBeGreaterThan(912);
  });
});
