// J2: name lock + slot record shaping (cloud calls are skipped without a session).
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { esnafimSave } from '../../src/game/sim/esnafim';

it('the character name is chosen once: after done it never changes', () => {
  const sim = played(1) as any;
  sim.command({ kind: 'esnafim', op: 'set', data: { ad: 'Kemal' } });
  expect(esnafimSave(sim.state).ad).toBe('Kemal');
  sim.command({ kind: 'esnafim', op: 'done' });
  sim.command({ kind: 'esnafim', op: 'set', data: { ad: 'Başkası', sac: 'afro' } });
  expect(esnafimSave(sim.state).ad).toBe('Kemal');
  expect(esnafimSave(sim.state).sac).toBe('afro');
});
it('an old finished save is locked on load', () => {
  const sim = played(1) as any;
  const z = esnafimSave(sim.state); z.done = true; (z as any).adKilit = undefined;
  expect(esnafimSave(sim.state).adKilit).toBe(true);
});
