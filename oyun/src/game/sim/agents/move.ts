/**
 * Path following for individually simulated actors (port of v2 goTo / walkPath / faceTo / pointBack / pointAlong),
 * on the engine Nav. Pure and deterministic. A `Walker` wraps an Actor: it owns the path, the actor owns the pose.
 */
import type { Nav, Vec2 } from '../../../engine/api';
import { angLerp } from '../../../engine/core';
import type { Actor } from './types';

export class Walker {
  path: Vec2[] = [];
  goal: Vec2 | null = null;
  moving = false;
  constructor(readonly a: Actor, private nav: Nav) {}
  /** v2 goTo: path from the current position (string-pulled by Nav); a missing route falls back to a straight line. */
  goTo(target: Vec2): void {
    const from = { x: this.a.x, z: this.a.z };
    let p = this.nav.path(from, target);
    if (!p.length) p = [{ x: target.x, z: target.z }];
    // drop a leading point that is the start itself
    if (p.length > 1 && Math.hypot(p[0].x - from.x, p[0].z - from.z) < 0.05) p = p.slice(1);
    this.path = p.map((v) => ({ x: v.x, z: v.z }));
    this.goal = { x: target.x, z: target.z };
  }
  /** v2 walkPath: moves along the path, returns true while still walking. Writes speed (m/s) and rot to the actor. */
  walk(dt: number, speed: number): boolean {
    const a = this.a;
    let left = speed * dt, moved = 0;
    this.moving = false;
    while (this.path.length && left > 0) {
      const p = this.path[0], dx = p.x - a.x, dz = p.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.02) { this.path.shift(); continue; }
      a.rot = angLerp(a.rot, Math.atan2(dx, dz), Math.min(1, dt * 10));
      if (left >= d) { a.x = p.x; a.z = p.z; left -= d; moved += d; this.path.shift(); }
      else { a.x += dx / d * left; a.z += dz / d * left; moved += left; left = 0; }
      this.moving = true;
    }
    a.speed = dt > 0 ? moved / dt : 0;
    return this.path.length > 0;
  }
  stop(): void { this.path.length = 0; this.moving = false; this.a.speed = 0; }
  face(t: Vec2, dt: number, rate = 8): void {
    const a = this.a;
    a.rot = angLerp(a.rot, Math.atan2(t.x - a.x, t.z - a.z), Math.min(1, (dt || 0.1) * rate));
  }
}

/** v2 pointBack: the point `dist` metres before `to` on the walking path from `from` (or `from` itself when shorter). */
export function pointBack(nav: Nav, from: Vec2, to: Vec2, dist: number): Vec2 {
  const route = nav.path(from, to);
  const pts: Vec2[] = [from, ...route];
  let acc = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (d > 1e-6 && acc + d >= dist) { const k = (dist - acc) / d; return { x: pts[i].x + (pts[i - 1].x - pts[i].x) * k, z: pts[i].z + (pts[i - 1].z - pts[i].z) * k }; }
    acc += d;
  }
  return { x: from.x, z: from.z };
}
/** v2 pointAlong: the point `dist` metres along the walking path from `from` toward `to`. */
export function pointAlong(nav: Nav, from: Vec2, to: Vec2, dist: number): Vec2 {
  const pts: Vec2[] = [from, ...nav.path(from, to)];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    if (d > 1e-6 && acc + d >= dist) { const k = (dist - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * k }; }
    acc += d;
  }
  return { x: to.x, z: to.z };
}
export const dist2d = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.z - b.z);
export const near2 = (a: Vec2, b: Vec2, r: number): boolean => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 <= r * r;
/** A point offset from `p` (v2 side()). */
export const side = (p: Vec2, dx: number, dz: number): Vec2 => ({ x: p.x + dx, z: p.z + dz });
