/**
 * Karamel (v2 updateDog): arrives once state.dog is set or on the day after the first kapkaç (karamelDay). Lies by the
 * kasa pile; on duty 55 % of 40-80 s blocks (sits, wags when Sabri is within 1.5 m), off duty he sleeps. On duty he
 * barks the kapkaççı away (kapkac.ts reads env.shared.dogDuty / dogBark).
 */
import type { System, SimCtx } from '../../../engine/api';
import { DOG } from '../../../content/cats';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { near2, Walker } from './move';

export function createDog(env: AgentEnv): System & { actor(): Actor | null } {
  const rng = env.rng('dog');
  let d: Actor | null = null, dutyT = 0, duty = true, wk: Walker | null = null, trip: 'home' | 'out' | 'wait' | 'back' = 'home', tripT = 8, home = { x: 0, z: 0 };
  return {
    id: 'dog', order: 45, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, pl = env.player();
      if (!d) {
        // 2026-10-25 user: Torbacı is in the game from the start (no longer waits for the first kapkaç)
        if (!S.dog) { S.dog = true; env.emit('dogArrive'); }
        const spot = env.book.get('dogSpot');
        d = env.reg.add('dog', 'karamel', { name: DOG.name }, spot, { name: DOG.name });
        d.act = 'sleep'; d.rot = d.prot = 0; wk = new Walker(d, env.nav); home = { x: d.x, z: d.z };
      }
      dutyT -= dt;
      if (dutyT <= 0) { dutyT = 40 + rng.next() * 40; duty = rng.chance(0.55); }
      const dutyNow = duty && !env.shared.force.noDog;
      env.shared.dogBark -= dt;
      env.shared.dogDuty = dutyNow;
      env.shared.dogPos = { x: d.x, z: d.z };
      d.act = env.shared.dogBark > 0 ? 'bark' : duty ? (near2(pl, d, 1.5) ? 'wag' : 'sit') : 'sleep';
      d.fx = d.act === 'bark' ? 'bark' : '';
      // 2026-10-25 user: Torbacı keeps dragging garbage bags around (short errands while off duty)
      if (trip === 'home') {
        d.speed = 0; tripT -= dt;
        if (!duty && tripT <= 0 && env.shared.dogBark <= 0 && wk) {
          trip = 'out'; wk.goTo({ x: home.x + (rng.next() - 0.5) * 6, z: home.z + (rng.next() - 0.2) * 3 });
        } else if (tripT <= 0) tripT = 6;
      } else if (wk) {
        if (trip === 'out' || trip === 'back') {
          d.act = 'walk'; d.fx = 'bag';
          if (!wk.walk(dt, 1.1)) { if (trip === 'out') { trip = 'wait'; tripT = 2 + rng.next() * 3; d.speed = 0; } else { trip = 'home'; tripT = 14 + rng.next() * 20; d.speed = 0; d.fx = ''; } }
        } else { // wait: sits proudly next to the bag
          d.speed = 0; d.act = 'sit'; d.fx = 'bag'; tripT -= dt;
          if (tripT <= 0) { trip = 'back'; wk.goTo(home); }
        }
        if (env.shared.dogBark > 0) { d.act = 'bark'; d.fx = 'bark'; }
      }
    },
    actor: () => d,
  };
}
