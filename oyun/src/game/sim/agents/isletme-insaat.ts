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
import { icOfArsa, icWorld, icDim } from '../../../content/ic-mekan';
import { avmGelis, avmGidis, katY } from '../../../content/avm-kat';

const ISIM = ['Usta Recep', 'Usta Selim', 'Usta Cemal'];
const SP = 1.3;
type Pt = Vec2 & { y?: number };
interface Usta { a: Actor; i: number; st: 'gel' | 'pile' | 'toPost' | 'work' | 'toPile' | 'cik'; t: number; dur: number; path: Pt[] }
interface Site { id: string; y: InsaatYer; ustalar: Usta[]; avm?: { y: number; giris: Pt[]; cikis: Pt[] } }

/** 2026-11-21: Martı AVM dükkânları holün içinde, sokak cephesi yok: şantiye dükkânın içinde kurulur (malzeme yığını yan duvarda,
 *  biri arka duvarda biri yan duvarda çalışır). Ustalar AVM girişinden yürüyen merdivenle gelir, iş bitince aynı yoldan çıkar. */
function avmYer(id: string): { y: InsaatYer; avm: NonNullable<Site['avm']> } | null {
  const m = icOfArsa(id); if (!m || m.bina !== 'avm') return null;
  const { W, D } = icDim(m), kat = m.kat || 0, w = (u: number, v: number) => icWorld(m, u, v), kapi = w(0, D / 2 + 0.7), ic = w(0, D / 2 - 0.9);
  const o = w(0, 0), b = w(0, 1), dx = b.x - o.x, dz = b.z - o.z;   // 'dışa' = kapıya doğru; ustalar tersine, arka duvara bakar
  const y: InsaatYer = { id, ox: o.x, oz: o.z, dx, dz, yaw: Math.atan2(dx, dz), S: W - 1.4, w: (u, v) => w(u, -v),
    pile: { u: -(W / 2 - 0.75), v: -(D / 2 - 1.6) }, posts: [{ u: -0.6, v: D / 2 - 0.85 }, { u: W / 2 - 0.85, v: 0.4 }] };
  const yy = katY(kat);
  return { y, avm: { y: yy, giris: [...avmGelis(kat, kapi), { ...ic, y: yy }], cikis: [{ ...kapi, y: yy }, ...avmGidis(kat, kapi)] } };
}

export interface InsaatSystem extends System { sites(): { id: string; ustalar: number }[] }

export function createInsaat(env: AgentEnv, rt: Record<string, unknown>): InsaatSystem {
  const rng = env.rng('insaat');
  const sites = new Map<string, Site>();
  const info = (id: string) => (rt.kafeHost as { info(id: string): { tadilat?: boolean } | null } | undefined)?.info(id) ?? null;
  const ids = ARSALAR.filter(a => a.sabit).map(a => a.id), avmIds = new Set(ids.filter(id => icOfArsa(id)?.bina === 'avm'));

  const route = (y: InsaatYer, from: Vec2, to: { u: number; v: number }): Vec2[] => {
    const p = y.w(to.u, to.v); if (avmIds.has(y.id)) return [p];   // AVM dükkânı: oda içinde düz yürür (ana nav AVM katlarını bilmez)
    const r = env.nav.path(from, p);
    return r.length ? r.slice(r[0] && Math.hypot(r[0].x - from.x, r[0].z - from.z) < 0.05 ? 1 : 0) : [p];   // no grid here: straight line
  };
  const walk = (a: Actor, path: Vec2[], dt: number, act: string) => {
    const to = path[0]; if (!to) return true;
    const dx = to.x - a.x, dz = to.z - a.z, d = Math.hypot(dx, dz), ty = (to as Pt).y;
    if (d < 0.08) { if (ty !== undefined) a.y = ty; path.shift(); return !path.length; }
    const k = Math.min(1, SP * dt / d); a.x += dx * k; a.z += dz * k; if (ty !== undefined) a.y += (ty - a.y) * k; a.rot = Math.atan2(dx, dz); a.speed = SP; a.act = act; return false;
  };
  const face = (y: InsaatYer): number => Math.atan2(-y.dx, -y.dz);   // towards the wall

  function open(id: string): Site | null {
    const av = avmYer(id), y = av?.y ?? insaatYer(id); if (!y) return null;
    const s: Site = { id, y, ustalar: [], avm: av?.avm };
    for (let i = 0; i < USTA_SAYISI; i++) {
      const seed = 7001 + id.charCodeAt(1) * 31 + i * 17, at = s.avm ? s.avm.giris[0] : y.w(y.pile.u + i * 0.6, y.pile.v + (i ? 0.5 : -0.5));
      const a = env.reg.add('worker', 'insaat-' + id + '-' + i, { kind: 'worker', role: 'usta', seed }, at, { role: 'usta', name: ISIM[i % ISIM.length] });
      // AVM: girişten yürüyerek gelir (ikincisi biraz geriden)
      s.ustalar.push(s.avm ? { a, i, st: 'gel', t: -i * 1.6, dur: 0, path: s.avm.giris.map(p => ({ ...p })) } : { a, i, st: 'pile', t: rng.next() * 1.2, dur: 0, path: [] });
    }
    return s;
  }
  function close(s: Site): boolean {
    if (!s.avm) { for (const u of s.ustalar) env.reg.remove(u.a); s.ustalar.length = 0; return true; }
    for (const u of s.ustalar) if (u.st !== 'cik') { u.st = 'cik'; u.t = 0; u.a.carry = []; u.a.say = 'Kolay gelsin, hayırlı olsun!'; u.a.sayT = 2.4; u.path = [{ x: u.a.x, z: u.a.z }, ...s.avm.cikis.map(p => ({ ...p }))]; }
    for (let i = s.ustalar.length - 1; i >= 0; i--) if (s.ustalar[i].st === 'cik' && !s.ustalar[i].path.length) { env.reg.remove(s.ustalar[i].a); s.ustalar.splice(i, 1); }
    return !s.ustalar.length;
  }

  function tick(s: Site, dt: number) {
    for (const u of s.ustalar) {
      const a = u.a, y = s.y; u.t += dt; if (a.sayT > 0 && (a.sayT -= dt) <= 0) a.say = '';
      if (u.st === 'gel') { if (u.t < 0) { a.speed = 0; a.act = 'idle'; continue; } if (walk(a, u.path, dt, 'walk')) { u.st = 'pile'; u.t = 0; a.speed = 0; } continue; }
      if (u.st === 'cik') { if (walk(a, u.path, dt, 'walk')) a.speed = 0; continue; }
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
        else if (!on && s) { if (close(s)) sites.delete(id); else tick(s, dt); }
        else if (s) tick(s, dt);
      }
    },
    sites: () => [...sites.values()].map(s => ({ id: s.id, ustalar: s.ustalar.length })),
  };
}
