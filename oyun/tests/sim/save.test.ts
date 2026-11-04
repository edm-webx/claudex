// M1 save: state round trip through createGameSave (fake platform), load restores the runtime, normalisation, reset.
import { describe, it, expect } from 'vitest';
import { createGameSave, normalizeState } from '../../src/game/sim/save';
import { defaultState } from '../../src/game/sim/schema';
import { played, mkSim, fakePlatform, log } from './m1-helpers';

describe('save', () => {
  it('saves GameState through the engine store and a new sim restores stations, tables, pile and money', async () => {
    const sim = played(3);
    for (const k of ['cay', 'ayran', 'tabure1']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'money', value: 1234 });
    sim.command({ kind: 'teleport', x: -9, z: 3 });
    sim.rules.moneyApi.addToKasa(300);
    sim.step(20);
    const fp = fakePlatform();
    const store = createGameSave(sim, fp.platform, { log });
    expect(await store.save('manual')).toBe(true);
    const back = await createGameSave(mkSim(3), fp.platform, { log }).load();
    expect(back.from).not.toBe('fresh');
    const s2 = mkSim(3, back.data);
    const r = s2.rules;
    expect(r.state.money).toBeCloseTo(sim.state.money, 3);
    expect(r.rt.stations.cay.built && r.rt.stations.ayran.built).toBe(true);
    expect(r.rt.tables[0].built).toBe(true);
    expect(r.rt.kasa.length).toBeGreaterThan(0);          // S.pile was folded back into a kasa pile
    expect(r.state.lastSeen).toBe(Date.UTC(2026, 9, 17, 12));
    expect(r.state.hero).toBe('sabri');
  });
  it('sim.load() replaces the state in place and re-syncs the runtime', () => {
    const a = played(1);
    for (const k of ['cay', 'ayran']) a.command({ kind: 'force', what: 'unlock', value: k });
    a.step(5);
    const snap = JSON.parse(JSON.stringify(a.state));
    const b = played(2);
    const ref = b.state;
    b.load(snap);
    expect(b.state).toBe(ref);
    expect(b.rules.rt.stations.ayran.built).toBe(true);
    expect(b.state.owned.cay).toBe(1);
  });
  it('normalizeState repairs missing and bad fields', () => {
    const d: any = defaultState(1);
    d.money = -50; d.owned = null; d.workers = 'x'; delete d.week; d.stage = 99; d.tiers = { doner: 3 };
    const notes = normalizeState(d);
    expect(d.money).toBe(0); expect(d.owned).toEqual({}); expect(d.workers).toEqual([]); expect(d.week).toEqual({ earned: 0, customers: 0 });
    expect(d.stage).toBe(5); expect(d.tiers.doner).toBe(3); expect(d.tiers.cay).toBe(1);
    expect(notes.length).toBeGreaterThan(0);
  });
  it('resetSave returns to a fresh game, keeping the seed', () => {
    const sim = played(7);
    sim.command({ kind: 'force', what: 'unlock', value: 'cay' });
    sim.command({ kind: 'resetSave' });
    expect(sim.state.owned).toEqual({});
    expect(sim.state.seed).toBe(7);
    expect(sim.rules.rt.started).toBe(false);
    expect(sim.rules.rt.stations.cay.built).toBe(false);
  });
});
