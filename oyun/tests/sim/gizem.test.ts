// Ana hikaye: Sabri vanishes on day 5, clues unlock in order, the ending pays once.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { IPUCLARI } from '../../src/content/gizem';

it('mystery runs from the letter to the vote, in order, once each', () => {
  const sim = played(1) as any; sim.step(1);
  const S = sim.state, g = sim.rules.rt.gizem;
  const go = (id: string) => { const c = IPUCLARI.find(i => i.id === id)!; sim.command({ kind: 'teleport', x: c.x, z: c.z }); sim.step(1); sim.command({ kind: 'gizem', op: 'oku' }); };
  expect(g.model().basla).toBe(false);
  go('mektup'); expect(g.model().oku.length).toBe(0);           // not started yet
  S.day = 5; sim.step(30);
  expect(g.model().basla).toBe(true);
  go('bilet'); expect(g.model().oku.length).toBe(0);            // out of order
  go('mektup'); expect(g.model().oku.map((x: any) => x.id)).toEqual(['mektup']);
  go('mektup'); expect(g.model().oku.length).toBe(1);           // only once
  for (const id of ['hesap', 'sapka', 'ilan', 'bilet', 'kapak', 'sabri']) go(id);
  const before = S.gold; go('oy');
  expect(g.model().bitti).toBe(true); expect(S.gold).toBe(before + 5);
  go('oy'); expect(S.gold).toBe(before + 5);
});
