/**
 * Gurme Bülent Bey (v2 updateVip): from day 5, every 2 days, 12:00-19:00. Sabri hands over exactly his order
 * (doner + ayran, or doner + cay before ayran is owned); a K2+ product on every item passes the test, grants the
 * Gurme pass and pays x5; otherwise a partial sale.
 */
import type { System, SimCtx } from '../../../engine/api';
import { VIPS } from '../../../content/vips';
import type { AgentEnv } from './env';
import { makeSpecial, freeSpecial, orderDone, orderLeft, queueSide, spawnPoint, outOfSight, type Special } from './specials';

export interface VipSystem extends System { current(): { state: string; need: Record<string, number>; pos: { x: number; z: number } } | null; }

export function createVip(env: AgentEnv): VipSystem {
  const rng = env.rng('vip');
  let v: Special | null = null;
  const say = (o: Special, t: string, s = 3) => { o.a.say = t; o.a.sayT = s; };
  return {
    id: 'vip', order: 42, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, host = env.host, def = VIPS[0];
      if (!v) {
        if (!def || S.day < def.fromDay) return;
        if (S.vipLast && S.day - S.vipLast < def.every) return;
        const forced = env.shared.force.vip;
        const h = host.hour(); if ((h < 12 || h > 19) && !forced) return;
        if (!rng.chance(dt * 0.05) && !forced) return;
        env.shared.force.vip = false;
        v = makeSpecial(env, 'vip', def, { ...def.look }, queueSide(env, 1), S.owned.ayran ? { doner: 1, ayran: 1 } : { doner: 1, cay: 1 });
        S.vipLast = S.day; host.toast(def.lines.arrive, 'info'); env.emit('vipArrive');
        return;
      }
      const a = v.a, pl = env.player();
      v.t += dt; a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; }
      if (v.state === 'walk') {
        a.act = 'walk';
        if (!v.wk.walk(dt, 1.1)) { v.state = 'wait'; v.t = 0; a.act = 'idle'; say(v, 'Bakalım bu büfe neymiş...', 3); }
        return;
      }
      if (v.state === 'wait') {
        a.act = 'idle'; a.speed = 0; v.wk.face(pl, dt);
        if (orderDone(v)) { v.state = 'chew'; v.t = 0; v.step = -1; return; }
        if (v.t > 120) { say(v, 'Yarın yine gelirim.', 3); v.state = 'leave'; v.wk.goTo(spawnPoint(env)); }
        return;
      }
      if (v.state === 'chew') {
        a.act = 'eat';
        const k = Math.floor(v.t / 1.5);
        if (k !== v.step && k < 3) { v.step = k; say(v, def.lines.chew[k], 1.4); }
        if (v.t >= 4.5) {
          const items = a.carry.slice();
          const pass = items.every((it) => (it.tier || 1) >= (def.minTier || 2));
          const val = host.settle(items, a);
          if (pass) {
            S.gurmePass = true; host.stat('gurmePass'); host.earn(val * 5, a); say(v, def.lines.pass, 5);
            host.toast('Gurme sınavı geçti! ' + def.lines.pass, 'good'); env.emit('gurmePass'); a.mood = 'happy';
          } else { host.earn(val, a); say(v, def.lines.partial, 5); host.toast('Gurme: ' + def.lines.partial, 'info'); env.emit('gurmePartial'); }
          a.carry = [];
          v.state = 'leave'; v.wk.goTo(spawnPoint(env));
        }
        return;
      }
      if (v.state === 'leave') {
        a.act = 'walk';
        if (!v.wk.walk(dt, 1.1) || outOfSight(env, a)) { freeSpecial(env, 'vip', v); v = null; }
      }
    },
    current: () => (v ? { state: v.state, need: orderLeft(v) as Record<string, number>, pos: { x: v.a.x, z: v.a.z } } : null),
  };
}
