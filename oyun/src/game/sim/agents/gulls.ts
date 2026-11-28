/**
 * Gulls (v2 makeGulls / updateGulls): perch, hop between perches, scream now and then, a few glide overhead. Every
 * 70-130 s (first at 600 s, or 60-120 s after the first event) one flies to the counter corner and stares at the
 * simit. Walk at it (<1.7 m) and it flies off: customers laugh, +15 x venue. Else after 9 s (14 s the first time) it
 * snatches the top simit and flies away; the simit is replaced at once, nothing is lost (free gag).
 * The sim keeps a fixed gull count (8, the dengeli value) so every device runs the same story; the view shows as
 * many as the quality tier allows. Acts: v2 gull modes (stand, scream, glide, fly, stare, snatch, takeoff).
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { LINES } from '../../../content/lines';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { near2 } from './move';
import type { P3 } from './anchors';

export const GULL_COUNT = 8;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
interface V3 { x: number; y: number; z: number }
interface Gull {
  a: Actor; i: number; mode: string; perch: P3 | null; t: number; ang: number; stareT: number; first: boolean; blend?: number;
  fly: { from: V3; to: V3; t: number; dur: number; onLand?: (g: Gull) => void } | null;
}

export interface GullsSystem extends System { stare(): { x: number; z: number } | null; count(): number; }

export function createGulls(env: AgentEnv): GullsSystem {
  const rng = env.rng('gulls');
  const gulls: Gull[] = [];
  let stare: Gull | null = null, next = 600, counterPerch: P3 | null = null, built = false;

  function build(S: { tut: Record<string, number>; playT: number }) {
    built = true;
    const perches = env.book.gullPerches();
    for (let i = 0; i < GULL_COUNT; i++) {
      const air = i >= perches.length || perches.slice(0, i).some((q) => Math.hypot(q.x - perches[i].x, q.z - perches[i].z) < 0.6);   // aynı yere iki tünek: ikinci martı havada
      const kind = i === 0 ? 'reis' : rng.chance(0.25) ? 'young' : 'adult';
      const p = perches[i % perches.length];
      const a = env.reg.add('gull', 'gull-' + i, { kind }, air ? { x: 0, z: -6 } : p, { kind });
      const g: Gull = { a, i, mode: air ? 'glide' : 'stand', perch: air ? null : p, t: rng.next() * 10, ang: rng.next() * 6, stareT: 0, first: false, fly: null };
      a.y = a.py = air ? 6 + (i % 3) : p.y; a.rot = a.prot = p.rotY || 0; a.act = g.mode;
      gulls.push(g);
    }
    const drop = env.book.get('counter.drop');
    let best: P3 | null = null, bd = 1e9;
    for (const p of perches) { const d = Math.hypot(p.x - drop.x, p.z - drop.z); if (d < bd) { bd = d; best = p; } }
    counterPerch = best && bd < 3 ? best : { x: drop.x + 0.9, z: drop.z + 0.05, y: drop.y + 0.02, rotY: 0.4 };
    next = S.tut.gullFirst ? S.playT + rng.range(60, 120) : 600;
  }
  /** bir tünekte (ya da gidilen tünekte) başka martı var mı / tezgâh tüneği mi: 0.6 m içinde */
  const yakin = (p: V3 | P3 | null, q: V3 | P3 | null) => !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) < 0.6;
  function tunekDolu(p: P3, self: Gull | null): boolean {
    if (yakin(p, counterPerch)) return true;
    return gulls.some((o) => o !== self && (yakin(o.perch, p) || yakin(o.fly?.to ?? null, p) || (o.mode !== 'glide' && !o.fly && yakin(o.a, p))));
  }
  function fly(g: Gull, to: V3, dur: number, mode = 'fly', onLand?: (g: Gull) => void) {
    g.fly = { from: { x: g.a.x, y: g.a.y, z: g.a.z }, to: { ...to }, t: 0, dur, onLand }; g.mode = mode;
  }
  const sys: GullsSystem = {
    id: 'gulls', order: 46, phase: 'sim',
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, pl = env.player(), host = env.host;
      if (!built) build(S);
      for (const g of gulls) {
        const a = g.a; g.t += dt;
        const ox = a.x, oz = a.z;
        a.sayT = 0;
        if (g.fly) {
          const f = g.fly; f.t += dt / f.dur; const k = Math.min(1, f.t), e = easeInOut(k);
          a.x = f.from.x + (f.to.x - f.from.x) * e; a.z = f.from.z + (f.to.z - f.from.z) * e;
          a.y = f.from.y + (f.to.y - f.from.y) * e + Math.sin(k * Math.PI) * 2.2;
          a.rot = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z); a.act = 'fly';
          if (k >= 1) { const cb = f.onLand; g.fly = null; g.mode = 'stand'; a.act = 'stand'; a.y = f.to.y; if (cb) cb(g); }
          a.speed = Math.hypot(a.x - ox, a.z - oz) / dt;
          continue;
        }
        if (g.mode === 'glide') {
          g.ang += dt * 0.35;
          const gx = Math.cos(g.ang + g.i) * 9, gy = 6 + Math.sin(g.ang * 2 + g.i) * 1.2, gz = -6 + Math.sin(g.ang + g.i) * 7;
          // uçuştan süzülmeye geçerken yörüngeye 2 sn'de yumuşakça karış (eskiden tek karede 6-17 m ışınlanıyordu)
          if (g.blend != null) { g.blend = Math.min(1, g.blend + dt / 2); const r = Math.min(1, (2 + g.blend * 8) * dt); a.x += (gx - a.x) * r; a.y += (gy - a.y) * r; a.z += (gz - a.z) * r; if (Math.hypot(gx - a.x, gz - a.z) < 0.3) g.blend = undefined; }
          else { a.x = gx; a.y = gy; a.z = gz; }
          a.rot = g.ang + Math.PI; a.act = 'glide';
          a.speed = Math.hypot(a.x - ox, a.z - oz) / dt;
          continue;
        }
        a.speed = 0;
        // üst üste kalmış martı (eski kayıt / aşama değişimi): büyük indeksli olan boş tüneğe uçar, yoksa havalanıp süzülür
        if ((g.mode === 'stand' || g.mode === 'scream') && g !== stare && gulls.some((o) => o !== g && o.i < g.i && !o.fly && o.mode !== 'glide' && Math.hypot(o.a.x - a.x, o.a.z - a.z) < 0.5 && Math.abs(o.a.y - a.y) < 0.5)) {
          const bos = env.book.gullPerches().find((q) => !tunekDolu(q, g));
          if (bos) { g.perch = bos; fly(g, bos, 2.5); }
          else { g.perch = null; fly(g, { x: a.x + 4, y: 7, z: a.z - 6 }, 2.5, 'fly', (gg) => { gg.mode = 'glide'; gg.blend = 0; }); }
          continue;
        }
        if (g.mode === 'stand' && g !== stare && g.perch && rng.chance(dt * 0.02)) {
          const ps = env.book.gullPerches(), p = ps[rng.int(0, ps.length - 1)];
          // 2026-11-21 (kullanıcı: "martılar niye üst üste?"): tünek dolu mu konuma göre bakılır; nesne kimliği aşama değişince
          // (anchor'lar yeniden kurulunca) tutmuyordu ve iki martı aynı tüneğe iniyordu
          if (!tunekDolu(p, g)) { g.perch = p; fly(g, p, 2.5); }
        }
        if (g.mode === 'stand' && rng.chance(dt * 0.01)) { g.mode = 'scream'; g.t = 0; }
        if (g.mode === 'scream' && g.t > 1.2) g.mode = 'stand';
        a.act = g.mode;
      }
      // the stare event
      const force = env.shared.force.gull;
      if (!stare) {
        if ((S.playT >= next && S.owned.simit && !host.windowOpen()) || force) {
          env.shared.force.gull = false;
          const cand = gulls.filter((g) => g.mode === 'stand' && !g.fly && g.perch);
          const g = cand.length ? cand[0] : gulls[0];
          stare = g; g.fly = null; g.perch = counterPerch; g.stareT = 0; g.first = !S.tut.gullFirst;
          fly(g, counterPerch!, 2.0, 'fly', (gg) => { gg.mode = 'stare'; gg.stareT = 0; env.emit('gullStare', { first: gg.first }); });
        }
        return;
      }
      const sg = stare;
      if (sg.fly) return;
      if (sg.mode === 'stare') {
        sg.a.act = 'stare';
        sg.stareT += dt;
        const drop = env.book.get('counter.drop');
        sg.a.rot = Math.atan2(drop.x - sg.a.x, drop.z - sg.a.z);
        if (near2(pl, sg.a, 1.7)) {
          host.stat('gullsChased'); S.tut.gullFirst = 1;
          host.heroSay(rng.pick(LINES[host.hero()].gull), 1.5);
          host.laughNearby(); host.earn(15 * host.venueMult(), sg.a); env.emit('gullChased');
          sg.mode = 'takeoff'; fly(sg, { x: sg.a.x + 6, y: 7, z: sg.a.z - 10 }, 3, 'fly', (gg) => { gg.mode = 'glide'; gg.blend = 0; });
          stare = null; next = S.playT + rng.range(70, 130);
          return;
        }
        if (sg.stareT > (sg.first ? 14 : 9)) {
          sg.mode = 'snatch';
          host.counterTake('simit');
          sg.a.carry = [{ type: 'simit', tier: S.tiers.simit || 1 }];
          host.stat('gullSnatch'); S.tut.gullFirst = 1;
          host.toast('Hoppaa! Martı simidi kaptı. Ama dert değil, yenisi tezgahta!', 'info'); host.laughNearby(); env.emit('gullSnatch');
          fly(sg, { x: sg.a.x - 4, y: 8, z: sg.a.z - 14 }, 3.2, 'fly', (gg) => { gg.a.carry = []; gg.mode = 'glide'; gg.blend = 0; });
          stare = null; next = S.playT + rng.range(70, 130);
        }
      }
    },
    stare: () => (stare && stare.mode === 'stare' ? { x: stare.a.x, z: stare.a.z } : null),
    count: () => gulls.length,
  };
  return sys;
}
export type { Vec2 };
