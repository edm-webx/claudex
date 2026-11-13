/**
 * Kapkaççı (v2 updateKapkac): from day 3, every 1-3 days, 11:00-20:00 when the kasa has 3+ stacks. He walks to the
 * kasa pile, grabs half, and runs ~15 m away. Walking into him (<1 m) returns the money +20 %. If he escapes, half
 * lies on the ground near the exit and the rest is owed back tomorrow. Karamel on duty turns him away at 3.2 m.
 * Nothing is ever lost for good: owed money returns, stars/money never drop.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { KAPKAC } from '../../../content/vips';
import { LINES } from '../../../content/lines';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { Walker, pointBack, pointAlong, near2 } from './move';
import { spawnPoint, farthestSpawn, outOfSight } from './specials';

export interface KapkacSystem extends System { current(): { state: string; value: number; pos: { x: number; z: number } } | null; }

export function createKapkac(env: AgentEnv): KapkacSystem {
  const rng = env.rng('kapkac');
  let k: { a: Actor; wk: Walker; state: string; t: number; value: number } | null = null;
  const say = (a: Actor, t: string, s = 3) => { a.say = t; a.sayT = s; };
  const drop = () => { if (k) { env.reg.remove(k.a); k = null; } };
  return {
    id: 'kapkac', order: 43, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, host = env.host, pile = env.book.get('kasa.pile'), pl = env.player();
      if (!k) {
        if (S.day < KAPKAC.fromDay || (S.kapkacDay && S.day < S.kapkacDay)) return;
        const h = host.hour(), forced = env.shared.force.kap;
        if (!forced && (h < 11 || h > 20 || host.kasaCount() < 3 || !rng.chance(dt * 0.02))) return;
        if (forced && host.kasaCount() < 1) host.addToKasa(300);
        env.shared.force.kap = false;
        const from = pointBack(env.nav, spawnPoint(env), pile, 16);
        const a = env.reg.add('kapkac', 'kapkac', { kind: 'regular', look: { lookType: 'gecekusu', lookSeed: 4242, ...KAPKAC.look }, seed: 4242 }, from, { name: KAPKAC.name });
        k = { a, wk: new Walker(a, env.nav), state: 'approach', t: 0, value: 0 };
        k.wk.goTo(pile);
        S.kapkacDay = S.day + rng.int(KAPKAC.every[0], KAPKAC.every[1]);
        env.emit('kapkacArrive');
        return;
      }
      const a = k.a;
      k.t += dt; a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; }
      if (k.state === 'approach') {
        a.act = 'walk'; a.mood = 'ok';
        if ((env.shared.dogDuty || S.workers.some((w) => w.role === 'guvenlik')) && near2(a, pile, 3.2)) {
          env.shared.dogBark = 1.5; say(a, KAPKAC.turned, 3); host.stat('karamelTurned'); env.emit('karamelTurned');
          host.toast(env.shared.dogDuty ? 'Torbacı havladı, kapkaççı kaçtı!' : 'Güvenlik fark etti, kapkaççı kaçtı!', 'good'); k.state = 'flee'; k.wk.goTo(farthestSpawn(env, a)); return;
        }
        if (!k.wk.walk(dt, 2.0)) { k.state = 'grab'; k.t = 0; a.act = 'grab'; }
        return;
      }
      if (k.state === 'grab') {
        a.act = 'grab';
        if (k.t > 0.6) {
          k.value += host.grabHalf();
          k.state = 'run'; k.t = 0; a.act = 'walk'; a.mood = 'impatient';
          k.wk.goTo(pointAlong(env.nav, a, farthestSpawn(env, pl), 15));
          host.toast(LINES.kapkac.shout, 'bad'); env.emit('kapkacGrab', { value: Math.round(k.value) });
          if (!S.karamelDay) S.karamelDay = S.day + 1;
        }
        return;
      }
      if (k.state === 'run') {
        a.act = 'walk';
        if (near2(pl, a, 1.0)) {
          const back = Math.round(k.value * 1.2);
          say(a, KAPKAC.caught, 3); host.heroSay(LINES[host.hero()].chase, 1.5); host.earn(back, a); host.stat('kapkacCaught');
          host.toast('Yakaladın! Para geri geldi, üstüne %20.', 'good'); env.emit('kapkacCaught', { back });
          k.value = 0; k.state = 'flee'; a.mood = 'ok'; k.wk.goTo(farthestSpawn(env, a)); return;
        }
        if (!k.wk.walk(dt, 3.3)) {
          const half = Math.round(k.value / 2);
          const dx = pl.x - a.x, dz = pl.z - a.z, L = Math.hypot(dx, dz) || 1;
          for (let i = 0; i < 4; i++) {
            const d = 1.5 + i * 0.5;
            const at: Vec2 = { x: a.x + dx / L * d + rng.range(-0.4, 0.4), z: a.z + dz / L * d + rng.range(-0.4, 0.4) };
            const q = env.nav.walkable(at) ? at : { x: a.x, z: a.z };
            host.dropFloor(half / 4, q.x, q.z);
          }
          host.addOwedBack(k.value - half);
          host.toast('Kaçtı! Paranın yarısı yere saçıldı, gerisi yarın gelir.', 'info'); env.emit('kapkacEscaped', { value: Math.round(k.value) });
          drop();
        }
        return;
      }
      if (k.state === 'flee') { a.act = 'walk'; if (!k.wk.walk(dt, 3.0) || outOfSight(env, a)) drop(); }
    },
    current: () => (k ? { state: k.state, value: k.value, pos: { x: k.a.x, z: k.a.z } } : null),
  };
}
