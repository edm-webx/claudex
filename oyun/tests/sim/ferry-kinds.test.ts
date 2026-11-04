// Ferry variety + timetable (survey vapur-1/2/3/8): deterministic kinds, wave sizes average ~1x, lit last ferry at night.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';
import { FERRY_T } from '../../src/game/sim/ferry';
import { ferryBoardModel, ferryBuyers, mmss, pickFerryKind } from '../../src/game/sim/ferry-kinds';
import { FERRY_KINDS, FERRY_KIND_IDS } from '../../src/content/ferries';
import { createRngStreams } from '../../src/engine/core';

describe('ferry kinds', () => {
  it('kind weights x wave multipliers average about 1 and every kind can show up', () => {
    const rng = createRngStreams(7).stream('t');
    const seen: Record<string, number> = {};
    let sum = 0; const N = 4000;
    for (let i = 0; i < N; i++) { const k = pickFerryKind(rng); seen[k] = (seen[k] || 0) + 1; sum += ferryBuyers(7, k, false); }
    for (const id of FERRY_KIND_IDS) expect(seen[id]).toBeGreaterThan(0);
    expect(seen.buharli / N).toBeLessThan(0.1);
    expect(sum / N / 7).toBeGreaterThan(0.92);
    expect(sum / N / 7).toBeLessThan(1.1);
    expect(ferryBuyers(7, 'lodos', false)).toBeLessThan(ferryBuyers(7, 'tatli', false));
  });
  it('same seed, same boats; the board names the next boat and counts down', () => {
    const run = () => { const sim = played(5); const names: string[] = []; for (let i = 0; i < 4; i++) { sim.command({ kind: 'force', what: 'ferry' }); sim.step(12); names.push(sim.rules.rt.ferryInfo!.cur); sim.step(45); } return names; };
    expect(run()).toEqual(run());
    const sim = played(6);
    const rt = sim.rules.rt;
    const b = ferryBoardModel(rt, sim.state.playT, sim.state.dayT, FERRY_T);
    expect(b.phase).toBe('away');
    expect(b.name).toBe(FERRY_KINDS[rt.ferryInfo!.next].board);
    expect(b.time).toBe(mmss(rt.ferry.next - sim.state.playT));
    sim.step(30);
    const b2 = ferryBoardModel(rt, sim.state.playT, sim.state.dayT, FERRY_T);
    expect(b2.time < b.time).toBe(true);
  });
  it('a forced kind docks with its name in the toast', () => {
    const sim = played(8);
    sim.state.tut.firstCustomer = 1;
    sim.command({ kind: 'force', what: 'ferry', value: 'buharli' });
    sim.step(11);
    expect(sim.rules.rt.ferryInfo!.cur).toBe('buharli');
    expect(sim.rules.rt.ferryInfo!.curLit).toBe(false);
    const toasts = events(sim, 'toast').map(e => (e.data as { text: string }).text);
    expect(toasts.some(t => t.includes('Nostalji Buharlısı'))).toBe(true);
  });
  it('the late ferry is lit, the board says SON VAPUR and passengers are sleepy', () => {
    const sim = played(8);
    sim.state.tut.firstCustomer = 1;
    sim.command({ kind: 'setTime', hour: 22.5 });
    sim.command({ kind: 'force', what: 'ferry', value: 'sehir' });
    sim.step(11);
    expect(sim.rules.rt.ferryInfo!.curLit).toBe(true);
    expect(ferryBoardModel(sim.rules.rt, sim.state.playT, sim.state.dayT, FERRY_T).title).toBe('SON VAPUR');
    const said = new Set<string>();
    for (let i = 0; i < 40; i++) { sim.step(0.25); for (const c of sim.rules.rt.customers) if (c.say) said.add(c.say); }
    expect([...said].some(t => /Uyku|uyan|Esne|Zzz|kapan|Yastık/.test(t))).toBe(true);
  });
});
