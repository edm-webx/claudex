import { it, expect } from 'vitest';
import { played, events } from './m1-helpers';
// 2026-11-21 owner: "tepsimde bişey varken HALA tezgaha koyamıyorum ki sıradaki müşteri alsın". Root cause: open table
// tickets / VIP / window orders reserved the matching items in Sabri's hands, so on a busy day nothing went down while
// the counter queue wanted exactly those items. The counter queue now comes first (sim/counter.ts pickDrop).
for (const stage of [3, 5, 8, 10]) it(`stage ${stage}: tray items reserved for tables still go on the counter when the queue wants them`, () => {
  const sim = played(7);
  sim.command({ kind: 'esnafim', op: 'done' } as never);
  sim.command({ kind: 'setStage', stage } as never);
  sim.command({ kind: 'setTime', hour: 11.5 } as never);
  const rt = (sim.rules as any).rt;
  // wait for a queue customer who wants döner
  let q: any = null;
  for (let i = 0; i < 600 && !q; i++) { sim.step(0.5); q = rt.queue.slice(0, 3).find((c: any) => (c.order.doner || 0) > (c.got.doner || 0)); }
  expect(q, 'a queued customer wanting döner').toBeTruthy();
  // a busy room: everything Sabri holds is "reserved" for tables (worst case of the old rule)
  rt.reserved.push(() => ({ doner: 99, cay: 99, ayran: 99, simit: 99, tost: 99, gazoz: 99 }));
  for (const k of Object.keys(rt.counter)) rt.counter[k].length = 0;
  rt.carry.length = 0;
  for (let i = 0; i < 3; i++) rt.carry.push({ type: 'doner', tier: 1 });
  const sales0 = events(sim, 'sale').length;
  // walk to the counter like a player (teleport next to it, then input onto the stand point)
  const ctr = sim.interactions.get('counter') as any;
  sim.command({ kind: 'teleport', x: ctr.pos.x + 0.9, z: ctr.pos.z } as never);
  for (let i = 0; i < 60 && Math.abs((sim as any).walk.pos.x - ctr.pos.x) > 0.15; i++) { sim.input({ x: -1, z: 0 }); sim.step(1 / 30); }
  sim.input({ x: 0, z: 0 });
  sim.step(2);
  expect(rt.carry.filter((c: any) => c.type === 'doner').length, 'döner left the tray').toBeLessThan(3);
  // the queued customer takes it and pays
  for (let i = 0; i < 120 && (q.got.doner || 0) < 1; i++) sim.step(0.25);
  expect(q.got.doner || 0).toBeGreaterThan(0);
  for (let i = 0; i < 240 && events(sim, 'sale').length === sales0; i++) sim.step(0.25);
  expect(events(sim, 'sale').length).toBeGreaterThan(sales0);
});
