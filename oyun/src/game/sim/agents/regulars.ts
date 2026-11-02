/**
 * Regulars ("Her zamankinden!"): Necati Amca, Nermin Teyze, Remzi Abi (v2 updateRegulars). They arrive in their hour
 * window from their day on, wait next to the queue head and want an exact order handed over by Sabri. The sale
 * pays 30 % extra. State in GameState.regulars[id] = { visits, lastDay }.
 */
import type { System, SimCtx } from '../../../engine/api';
import type { ProductId } from '../schema';
import { REGULARS, type RegularDef } from '../../../content/regulars';
import type { AgentEnv } from './env';
import { near2 } from './move';
import { makeSpecial, freeSpecial, orderDone, orderLeft, queueSide, spawnPoint, outOfSight, type Special } from './specials';

export interface RegularsSystem extends System { current(): { id: string; state: string; visit: number; need: Record<string, number>; pos: { x: number; z: number } } | null; }

/** 2026-11-02 user: müdavimler (regulars) removed completely, they only caused bugs. Flip to bring them back. */
const MUDAVIMLER_KAPALI = true;
export function createRegulars(env: AgentEnv): RegularsSystem {
  const rng = env.rng('regulars');
  let g: Special | null = null, def: RegularDef | null = null, cd = 0;
  let useAlt = false, idleT = 0; // musteri.ts: fallback order + idle lines
  const sellable = (o: Record<string, number>, S: { owned: Record<string, number> }) => (Object.keys(o) as ProductId[]).every((p) => p === 'doner' || S.owned[p]);
  const say = (o: Special, t: string, s = 3) => { o.a.say = t; o.a.sayT = s; };
  const sys: RegularsSystem = {
    id: 'regulars', order: 41, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, host = env.host;
      if (!g) {
        if (cd > 0) { cd -= dt; return; }
        const h = host.hour();
        for (const d of MUDAVIMLER_KAPALI ? [] as typeof REGULARS : REGULARS) {
          if (S.day < d.fromDay) continue;
          if (d.needs && !S.owned[d.needs]) continue;
          const alt = !sellable(d.order, S) && !!d.alt && sellable(d.alt, S);
          if (!alt && !sellable(d.order, S)) continue;
          const st = (S.regulars[d.id] ||= { visits: 0, lastDay: 0 }) as { visits: number; lastDay: number };
          if (st.lastDay === S.day || h < d.hour[0] || h >= d.hour[1]) continue;
          const forced = env.shared.force.reg === d.id || env.shared.force.reg === true;
          if (rng.chance(dt * 0.12) || forced) {
            env.shared.force.reg = null;
            def = d; useAlt = alt; idleT = 9;
            g = makeSpecial(env, 'regular', d, { lookType: 'emekli', lookSeed: d.id.length * 977, ...d.look }, queueSide(env, -1), { ...(alt ? d.alt : d.order) } as Record<ProductId, number>);
            g.visit = st.visits; st.lastDay = S.day;
            env.emit('regularArrive', { id: d.id, visit: st.visits });
            if (st.visits === 0) host.toast(d.name + ' geldi! Siparişini aklında tut.', 'info');
            break;
          }
        }
        return;
      }
      const o = g, d = def!, a = o.a, pl = env.player();
      o.t += dt; a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; }
      const st = S.regulars[d.id] as { visits: number; lastDay: number };
      if (o.state === 'walk') {
        a.act = 'walk';
        if (!o.wk.walk(dt, 1.3)) { o.state = 'wait'; o.t = 0; a.act = 'idle'; say(o, o.visit === 0 ? d.story[0] : d.selam && d.selam.length && rng.chance(0.6) ? rng.pick(d.selam) : 'Her zamankinden!', 4); }
        return;
      }
      if (o.state === 'wait') {
        a.act = 'idle'; a.speed = 0; o.wk.face(pl, dt);
        a.mood = 'ok';
        if (o.t > 5 && !o.hinted && o.visit > 0) { o.hinted = true; say(o, useAlt && d.altHint ? d.altHint : d.hint, 4); }
        if (d.idle && d.idle.length && o.t > 8 && a.sayT <= 0 && (idleT -= dt) <= 0) { idleT = rng.range(7, 11); say(o, rng.pick(d.idle), 3.5); }
        if (orderDone(o)) {
          const v = host.settle(a.carry, a);
          host.earn(Math.round(v * 0.3), a);
          st.visits++; host.stat('regularOk');
          say(o, d.story[Math.min(st.visits, d.story.length - 1)], 4.5);
          host.toast('Her zamankinden! ' + d.name + ' çok mutlu.', 'good');
          if (d.gift) { host.toast(d.gift, 'good'); }
          env.emit('regularOk', { id: d.id, visits: st.visits });
          a.mood = 'happy'; a.carry = [];
          o.state = 'leave'; o.wk.goTo(spawnPoint(env)); return;
        }
        if (o.t > 100) { say(o, 'Yarın yine gelirim evladım.', 3); o.state = 'leave'; o.wk.goTo(spawnPoint(env)); env.emit('regularMiss', { id: d.id }); }
        return;
      }
      if (o.state === 'leave') {
        a.act = 'walk';
        if (!o.wk.walk(dt, 1.3) || outOfSight(env, a)) { freeSpecial(env, 'regular', o); g = null; def = null; cd = 40; }
      }
    },
    current: () => (g ? { id: g.def.id, state: g.state, visit: g.visit, need: orderLeft(g) as Record<string, number>, pos: { x: g.a.x, z: g.a.z } } : null),
  };
  void near2;
  return sys;
}
