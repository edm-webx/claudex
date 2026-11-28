/**
 * Lokum (2026-10-25 user: blue and white budgie): lives on the low perches around the büfe (stool, basket, bench),
 * chatters a street phrase now and then, and hops to another perch every 20-40 s. Rig = the gull rig, 'lokum' kind.
 */
import type { System, SimCtx } from '../../../engine/api';
import type { AgentEnv } from './env';
import type { Actor } from './types';

const LINES = ['Simit! Simit!', 'Çay demlendi!', 'Abi hesap!', 'Gel gel gel!', 'Kapkaççı! Kapkaççı!', 'Martılara yem verme!', 'Boğaz Gazozu!', 'Selam aşkım!'];

export function createParrot(env: AgentEnv): System & { actor(): Actor | null } {
  const rng = env.rng('parrot');
  let a: Actor | null = null, t = 0, chat = 6, hop = 25, fly = 0;
  let from = { x: 0, z: 0, y: 0 }, to = { x: 0, z: 0, y: 0 };
  const spots = () => env.book.catSpots().filter((s) => s.a.y < 1.2).map((s) => ({ x: s.a.x, z: s.a.z, y: s.a.y }));
  return {
    id: 'parrot', order: 46, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = ctx.dt; t += dt;
      if (!a) {
        const sp = spots(); if (!sp.length) return;
        const s = sp[sp.length - 1];
        a = env.reg.add('parrot', 'lokum', { kind: 'lokum', name: 'Lokum' }, s, { name: 'Lokum' });
        a.y = a.py = s.y; a.act = 'stand'; to = from = s;
      }
      if (a.sayT > 0) { a.sayT -= dt; if (a.sayT <= 0) { a.say = ''; a.sayT = 0; } }
      if (fly > 0) {
        fly -= dt; const k = 1 - Math.max(0, fly) / 1.2, e = k * k * (3 - 2 * k);
        a.x = from.x + (to.x - from.x) * e; a.z = from.z + (to.z - from.z) * e;
        a.y = from.y + (to.y - from.y) * e + Math.sin(k * Math.PI) * 0.8;
        a.rot = Math.atan2(to.x - from.x, to.z - from.z); a.act = k < 0.2 ? 'takeoff' : k > 0.8 ? 'land' : 'fly'; a.speed = 0;
        if (fly <= 0) { a.x = to.x; a.z = to.z; a.y = to.y; a.act = 'stand'; }
        return;
      }
      a.speed = 0;
      chat -= dt; hop -= dt;
      if (a.act === 'scream' && a.sayT <= 0) a.act = 'stand';
      if (chat <= 0) { chat = 12 + rng.next() * 18; a.act = 'scream'; a.say = LINES[rng.int(0, LINES.length - 1)]; a.sayT = 3; }
      if (hop <= 0) {
        hop = 20 + rng.next() * 20;
        const sp = spots().filter((s) => Math.hypot(s.x - a!.x, s.z - a!.z) > 0.5);
        if (sp.length) { from = { x: a.x, z: a.z, y: a.y }; to = sp[rng.int(0, sp.length - 1)]; fly = 1.2; }
      }
    },
    actor: () => a,
  };
}
