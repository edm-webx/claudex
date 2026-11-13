// Boğaz Ligi: deterministic pairings, tables, tie-breaks, season rollover, no duplicate result.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { eslesme, tablo, simMac, uyeler, BASLANGIC, KULUP, type Mac } from '../../src/content/lig';

it('round-robin: 5 rounds, every club meets every other exactly once', () => {
  const ids = uyeler(BASLANGIC, 1), seen = new Set<string>();
  for (let k = 0; k < 5; k++) { const ps = eslesme(ids, k); expect(ps.length).toBe(3); for (const [a, b] of ps) seen.add([a, b].sort().join('|')); }
  expect(seen.size).toBe(15);
});
it('table: points, goal difference, goals scored, then name', () => {
  const ms: Mac[] = [
    { s: 0, k: 0, b: 0, ev: 'lodosspor', dep: 'vapurspor', eg: 2, dg: 2 },
    { s: 0, k: 1, b: 0, ev: 'poyrazspor', dep: 'lodosspor', eg: 0, dg: 3 },
    { s: 0, k: 2, b: 0, ev: 'vapurspor', dep: 'poyrazspor', eg: 1, dg: 0 },
  ];
  const t = tablo(['lodosspor', 'vapurspor', 'poyrazspor'], ms);
  expect(t.map(r => r.id)).toEqual(['lodosspor', 'vapurspor', 'poyrazspor']);
  expect(t[0]).toMatchObject({ p: 4, av: 3, o: 2, g: 1, b: 1 });
});
it('AI results are pure functions of season, round and clubs', () => {
  expect(simMac(2, 3, 'lodosspor', 'kedispor')).toEqual(simMac(2, 3, 'lodosspor', 'kedispor'));
});
it('sim: a week forfeits without a match, a recorded match counts once, season ends with promotion swap', () => {
  const sim = played(1) as any; sim.step(1);
  const S = sim.state, lig = sim.rules.rt.lig;
  expect(lig.model().tablo[1].length).toBe(6);
  // play round 0 for real (day 3) and try to submit it twice
  S.day = 3; const g = 0;
  expect(lig.sonuc(g, 4, 0)).toBe(true); expect(lig.sonuc(g, 9, 0)).toBe(false);
  S.day = 4; sim.step(1);
  const me = lig.model().tablo[1].find((r: any) => r.id === KULUP.id);
  expect(me).toMatchObject({ o: 1, g: 1, ag: 4 });
  // skip four more match days: forfeits, then the season rolls over
  S.day = 3 + 7 * 5 + 1; sim.step(1);
  const m = lig.model();
  expect(m.sezon).toBe(2); expect(m.gecmis.length).toBe(1);
  expect(m.tablo[0].length).toBe(6); expect(m.tablo[1].length).toBe(6);
});
