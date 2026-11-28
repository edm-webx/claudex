// 2026-10-30: a window customer who wants something else must not block stocking the window counter.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';

it('window stocks the shelf while a customer waits for a different product', () => {
  const sim = played(1) as any;
  sim.command({ kind: 'force', what: 'stage', value: 3 }); sim.step(1);
  const rt = sim.rules.rt, w = rt.layout.window.standAt;
  rt.window = { open: true, t: 20, sales: 0 };
  rt.winq.push({ id: 9001, typeId: 'turist', order: { simit: 1 }, got: {}, state: 'wqueue', patience: 50, patMax: 50, pos: { x: 4.3, z: -7.1 } });
  rt.winShelf = [];
  sim.command({ kind: 'teleport', x: w.x, z: w.z });
  rt.carry.length = 0; rt.carry.push({ type: 'cay', tier: 1 }, { type: 'cay', tier: 1 });
  sim.step(2);
  expect(rt.winShelf.length + rt.carry.length).toBe(2);
  expect(rt.winShelf.length).toBeGreaterThan(0);
});
