// M1 economy rules: venue multiplier, sale value, streak, siftah, level-ups, pads and a 10-day long run on 3 seeds.
import { describe, it, expect } from 'vitest';
import { played, mkSim, events } from './m1-helpers';
import { VENUE } from '../../src/content/ekonomi2';
// @ts-expect-error plain ESM JS shared with the browser bot
import { makeBot } from '../../src/game/ui/bot-ai.mjs';
import { panelModel } from '../../src/game/sim/panels';

function bot(sim: any) {
  const R = () => sim.rules;
  return makeBot({
    state: () => R().v2State(), input: (x: number, z: number) => sim.input({ x, z }),
    path: (a: any, b: any) => { const p = sim.nav.path(a, b); return p && p.length ? p.map((q: any) => ({ x: q.x, z: q.z })) : [{ x: b.x, z: b.z }]; },
    claimOrder: (id: string) => sim.command({ kind: 'claimOrder', id }), panelModel: (id: string) => panelModel(id as any, R()),
    upgradeTier: (id: string) => sim.command({ kind: 'upgradeTier', id }), decorBuy: (id: string) => sim.command({ kind: 'decorBuy', id }),
    saveSign: (text: string, font: string) => sim.command({ kind: 'saveSign', text, font }), signSet: () => !!R().state.sign,
    skipCeremony: () => sim.command({ kind: 'skipCeremony' }), tapSlow: () => sim.command({ kind: 'tapSlow' }),
    solution: () => (R().rt.uiLast.solution as any) || null, acceptSolution: () => sim.command({ kind: 'acceptSolution' }),
    jobBoardModel: () => panelModel('jobBoard', R()) as any, hireCandidate: (id: string) => sim.command({ kind: 'hireCandidate', id }),
  });
}

describe('sale value', () => {
  it('price x venue multiplier x streak, siftah only once per calendar day', () => {
    const sim = played(1);
    const S = sim.state, r = sim.rules;
    S.calendar = '2026-10-17'; S.siftahDate = S.calendar;
    const money0 = S.money;
    r.salesApi.settle([{ type: 'doner', tier: 1 }], { direct: true });
    expect(S.money - money0).toBe(104);                    // döner K1 = 104 (base 160, ingredients 35 %, venue x1)
    S.tiers.doner = 2;
    r.salesApi.settle([{ type: 'doner', tier: 2 }], { direct: true });
    expect(Math.round(S.money - money0)).toBe(104 + 124);   // tier 2 pays more; same product within 10 s gets the streak step
    S.siftahDate = '';
    const m1 = S.money;
    r.salesApi.settle([{ type: 'cay', tier: 1 }], { direct: true });
    expect(Math.round(S.money - m1)).toBe(57);             // 2026-10-24 (ingredients 15 %): çay sale with the first-of-day siftah bonus (new product: no streak)
    expect(events(sim, 'siftah').length).toBe(1);
  });
  it('venue multiplier follows stage, plaque and stars', () => {
    const sim = played(1);
    const S = sim.state;
    expect(sim.rules.venueMult()).toBe(1);
    S.stage = 2; S.stars = 2; S.plaque = 1;
    // Faz 2 venue is additive (ekonomi2.ts VENUE): 1 + 0.04 per stage step + 0.05 per plaque + 0.02 per star
    expect(sim.rules.venueMult()).toBeCloseTo(1 + VENUE.perStage + VENUE.perPlaque + 2 * VENUE.perStar, 6);
  });
  it('level ups come from XP and are logged', () => {
    const sim = played(1);
    sim.rules.salesApi.settle([{ type: 'cay', tier: 1 }], { direct: true });
    for (let i = 0; i < 60; i++) sim.rules.stat('x');
    sim.state.xp = 0;
    (sim.rules as any).addXP(500);
    expect(sim.state.level).toBeGreaterThan(2);
    expect(events(sim, 'level').length).toBeGreaterThan(0);
  });
});

describe('pads', () => {
  it('cay pad appears after the first collect, fills while standing on it, and unlocks the station', () => {
    const sim = played(1);
    const r = sim.rules;
    expect(r.rt.pads.some(p => p.key === 'cay')).toBe(false);
    sim.state.tut.firstCollect = 1;
    sim.step(1);
    const pad = r.rt.pads.find(p => p.key === 'cay');
    expect(pad).toBeTruthy();
    expect(events(sim, 'padShown').length).toBe(1);
    sim.state.money = 1000;
    sim.command({ kind: 'teleport', x: pad!.pos.x, z: pad!.pos.z });
    sim.step(3);
    expect(r.state.owned.cay).toBe(1);
    expect(r.rt.stations.cay.built).toBe(true);
    expect(r.state.money).toBeCloseTo(700, 0);
    expect(events(sim, 'unlock').some(e => (e.data as any).key === 'cay')).toBe(true);
  });
  it('tier upgrade costs base x factor and doubles the price', () => {
    const sim = played(1);
    sim.state.money = 100000;
    const cost = (sim.rules as unknown as { upgradeCost(p: string): number }).upgradeCost('doner');
    sim.command({ kind: 'upgradeTier', id: 'doner' });
    expect(sim.state.tiers.doner).toBe(2);
    expect(Math.round(sim.state.money)).toBe(Math.round(100000 - cost));   // Faz 2 tier cost comes from ekonomi2.ts (base x factor)
    expect(cost).toBe(9600);
  });
  it('money never goes negative on a failed purchase', () => {
    const sim = played(1);
    sim.state.money = 5;
    sim.command({ kind: 'upgradeTier', id: 'doner' });
    sim.command({ kind: 'decorBuy', id: 'sofra_bezi' });
    expect(sim.state.money).toBe(5);
    expect(sim.state.tiers.doner).toBe(1);
  });
});

describe('10-day long run', () => {
  for (const seed of [1, 2, 3]) {
    it(`seed ${seed}: money >= 0, stars never drop, the queue never deadlocks`, () => {
      const sim: any = played(seed);
      const b = bot(sim);
      let stars = 0, lastSaleT = 0, sales = 0, worstGap = 0;
      sim.bus.on('sale', () => { sales++; lastSaleT = sim.tick / 30; });
      for (let s = 0; s < 4900; s++) {   // 10 days of 480 s (one clock since 2026-10-24)
        for (let i = 0; i < 10; i++) { b.tick(); sim.step(0.1); }
        const st = sim.rules.state;
        expect(st.money).toBeGreaterThanOrEqual(0);
        expect(st.stars).toBeGreaterThanOrEqual(stars); stars = st.stars;
        if (s % 10 === 0 && sim.rules.rt.queue.length > 0) worstGap = Math.max(worstGap, sim.tick / 30 - lastSaleT);
        if (sim.rules.rt.paused && sim.rules.rt.pauseWhy === 'kasa') sim.command({ kind: 'skipCeremony' });
      }
      expect(sim.rules.state.day).toBeGreaterThanOrEqual(10);
      expect(sales).toBeGreaterThan(300);
      expect(worstGap, 'longest stretch with a waiting queue and no sale (s)').toBeLessThan(150);
      expect(sim.rules.rt.queue.length).toBeLessThanOrEqual(8);
    }, 120000);
  }
});

describe('determinism', () => {
  it('same seed and inputs give the same hash; another seed differs', () => {
    const run = (seed: number) => { const s = played(seed); s.input({ x: 1, z: 0 }); s.step(40); s.input({ x: 0, z: 0 }); s.step(20); return s.hash(); };
    expect(run(5)).toBe(run(5));
    expect(run(5)).not.toBe(run(6));
    void mkSim;
  });
});
