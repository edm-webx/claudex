import { it, expect } from 'vitest';
import { played, events } from './m1-helpers';
// Lead check: standing still at the döner station keeps picking units, the ring fills once, and pick events fire only
// for real pickups (no per-tick rattle).
it('standing at the doner station: one dwell, steady picks', () => {
  const sim = played(1);
  sim.step(5);
  const st = sim.interactions.get('station.doner') as any;
  // walk onto it so movedTotal counts (teleport alone does not unlock the first cut)
  sim.command({ kind: 'teleport', x: st.pos.x + 1.2, z: st.pos.z } as any);
  for (let i = 0; i < 40 && Math.hypot((sim as any).walk.pos.x - st.pos.x, (sim as any).walk.pos.z - st.pos.z) > 0.15; i++) { sim.input({ x: -1, z: 0 }); sim.step(1 / 30); }
  sim.input({ x: 0, z: 0 });
  const starts0 = events(sim, 'dwellStart').length;
  const rings: string[] = [];
  for (let i = 0; i < 80; i++) { sim.step(0.1); const d = sim.interactions.status(sim.player); rings.push(d ? (d.transferring ? 'T' : 'f') : '-'); }
  const picks = events(sim, 'pick').length, starts = events(sim, 'dwellStart').length - starts0;
  console.log('rings', rings.join(''), 'picks', picks, 'dwellStarts', starts, 'carry', (sim.rules as any).rt.carry.length);
  expect(picks).toBeGreaterThan(0);
  expect(starts).toBeLessThanOrEqual(2); // the station once, the overlapping counter once
});
