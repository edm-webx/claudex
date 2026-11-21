/**
 * DKN-02: the ustalar of a renovation. While a far-shore business has a Plot.tadilat, two real worker actors (role 'usta',
 * hard hat and overalls) live at its site: they take planks from the material pile, carry them to their scaffold wing,
 * work on the wall (the 'sweep' act = plastering / painting strokes), then walk back. When the renovation ends they are
 * removed. No props: they are ordinary actors on env.nav like every other worker. Layout: content/isletme-insaat.ts.
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { ARSALAR } from '../../../content/esya';
import { insaatYer, USTA_SAYISI, type InsaatYer } from '../../../content/isletme-insaat';
import type { AgentEnv } from './env';
import type { Actor } from './types';

const ISIM = ['Usta Recep', 'Usta Selim', 'Usta Cemal'];
const SP = 1.3;
interface Usta { a: Actor; i: number; st: 'pile' | 'toPost' | 'work' | 'toPile'; t: number; dur: number; path: Vec2[] }
interface Site { id: string; y: InsaatYer; ustalar: Usta[] }

export interface InsaatSystem extends System { sites(): { id: string; ustalar: number }[] }

export function createInsaat(env: AgentEnv, rt: Record<string, unknown>): InsaatSystem {
  const rng = env.rng('insaat');
  const sites = new Map<string, Site>();
  const info = (id: string) => (rt.kafeHost as { info(id: string): { tadilat?: boolean } | null } | undefined)?.info(id) ?? null;
  const ids = ARSALAR.filter(a => a.sabit).map(a => a.id);

  const route = (y: InsaatYer, from: Vec2, to: { u: number; v: number }): Vec2[] => {
    const p = y.w(to.u, to.v), r = env.nav.path(from, p);
    return r.length ? r.slice(r[0] && Math.hypot(r[0].x - from.x, r[0].z - from.z) < 0.05 ? 1 : 0) : [p];   // no grid here: straight line
  };
  const walk = (a: Actor, path: Vec2[], dt: number, act: string) => {
    const to = path[0]; if (!to) return true;
    const dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz);
    if (d < 0.08) { path.shift(); return !path.length; }
    const k = Math.min(1, SP * dt / d); a.x += dx * k; a.z += dz * k; a.rot = Math.atan2(dx, dz); a.speed = SP; a.act = act; return false;
  };
  const face = (y: InsaatYer): number => Math.atan2(-y.dx, -y.dz);   // towards the wall

  function open(id: string): Site | null {
    const y = insaatYer(id); if (!y) return null;
    const s: Site = { id, y, ustalar: [] };
    for (let i = 0; i < USTA_SAYISI; i++) {
      const seed = 7001 + id.charCodeAt(1) * 31 + i * 17, at = y.w(y.pile.u + i * 0.6, y.pile.v + (i ? 0.5 : -0.5));
      const a = env.reg.add('worker', 'insaat-' + id + '-' + i, { kind: 'worker', role: 'usta', seed }, at, { role: 'usta', name: ISIM[i % ISIM.length] });
      s.ustalar.push({ a, i, st: 'pile', t: rng.next() * 1.2, dur: 0, path: [] });
    }
    return s;
  }
  function close(s: Site) { for (const u of s.ustalar) env.reg.remove(u.a); s.ustalar.length = 0; }

  function tick(s: Site, dt: number) {
    for (const u of s.ustalar) {
      const a = u.a, y = s.y; u.t += dt;
      if (u.st === 'pile') {
        a.act = 'idle'; a.speed = 0; a.rot = face(y);
        if (u.t > 1.4) { a.carry = [{ type: 'tahta' as never, tier: 1 }]; u.path = route(y, a, y.posts[u.i % y.posts.length]); u.st = 'toPost'; u.t = 0; }
      } else if (u.st === 'toPost') {
        if (walk(a, u.path, dt, 'carry')) { u.st = 'work'; u.t = 0; u.dur = 7 + rng.next() * 5; a.carry = []; a.speed = 0; a.rot = face(y); }
      } else if (u.st === 'work') {
        a.act = 'sweep'; a.speed = 0; a.rot = face(y);
        if (u.t > u.dur) { u.path = route(y, a, y.pile); u.st = 'toPile'; u.t = 0; a.act = 'idle'; }
      } else if (walk(a, u.path, dt, 'walk')) { u.st = 'pile'; u.t = 0; a.speed = 0; }
    }
  }

  return {
    id: 'insaat', order: 48, phase: 'sim',
    step(ctx: SimCtx) {
      const dt = Math.min(ctx.dt, 0.25);
      for (const id of ids) {
        const on = !!info(id)?.tadilat, s = sites.get(id);
        if (on && !s) { const n = open(id); if (n) sites.set(id, n); }
        else if (!on && s) { close(s); sites.delete(id); }
        else if (s) tick(s, dt);
      }
    },
    sites: () => [...sites.values()].map(s => ({ id: s.id, ustalar: s.ustalar.length })),
  };
}
