/**
 * Huy hareketleri (survey animasyon-8): additive, view-only motion on top of the worker rigs, applied right after the
 * agents view posed them each frame (the rig's apply() writes absolute bone rotations, so additions never pile up).
 * - Uykucu: between real naps the head slowly drops and snaps back with a start (irkilme).
 * - Geveze: chat bursts with both arms gesturing and the head bobbing.
 * - Martı Fısıldayan (trait 'martici'): a gull companion stands next to him; they nod at each other in turns.
 * - Usta (rank Usta or above, at a station): now and then tosses a dürüm into the air and catches it.
 * - Hızlı ama sakar (trait 'aceleci'): stumbles forward with flailing arms while walking.
 * Never writes sim state. Timers are per actor and seeded from the actor id, so they look varied but steady.
 */
import * as T from 'three';
import type { AgentsHandle } from '../../sim/agents';
import type { Actor } from '../../sim/agents/types';
import type { HeroHandle } from '../../../engine/api';
import type { MotorChars } from './index';

export interface HuyMotionDeps {
  scene: T.Object3D;
  chars: MotorChars;
  agents: () => AgentsHandle | null;
  rigOf: (actorId: number) => HeroHandle | null;
}
export interface HuyMotionView { update(dt: number): void; dispose(): void }

interface Row { t: number; next: number; phase: number; dur: number; gull: HeroHandle | null; gx: number; gz: number; prop: T.Mesh | null }
type Bones = Record<string, T.Bone>;

const rnd = (seed: number) => { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function createHuyMotion(d: HuyMotionDeps): HuyMotionView {
  const rows = new Map<number, Row>();
  const rngs = new Map<number, () => number>();
  const durumGeo = new T.CylinderGeometry(0.035, 0.035, 0.2, 8);
  const durumMat = new T.MeshLambertMaterial({ color: '#e9cf9a' });
  const durumTip = new T.MeshLambertMaterial({ color: '#8a4b23' });
  const tipGeo = new T.SphereGeometry(0.036, 8, 6);
  const v = new T.Vector3();

  const R = (a: Actor) => { let r = rngs.get(a.id); if (!r) { r = rnd(a.id + 17); rngs.set(a.id, r); } return r; };
  function row(a: Actor): Row {
    let r = rows.get(a.id);
    if (!r) { const g = R(a); r = { t: 0, next: 3 + g() * 8, phase: 0, dur: 0, gull: null, gx: a.x, gz: a.z, prop: null }; rows.set(a.id, r); }
    return r;
  }
  function drop(id: number) {
    const r = rows.get(id); if (!r) return;
    if (r.gull) { try { r.gull.dispose(); } catch { /* */ } }
    if (r.prop) r.prop.parent?.remove(r.prop);
    rows.delete(id); rngs.delete(id);
  }
  const bonesOf = (h: HeroHandle): Bones | null => ((h as unknown as { rig?: { B?: Bones } }).rig?.B) ?? null;
  const huyOf = (a: Actor): string => {
    const tr = String(a.info.trait || '');
    if (tr === 'uykucu' || tr === 'geveze' || tr === 'martici' || tr === 'aceleci') return tr;
    if (Number(a.info.rank || 0) >= 2 && (a.act === 'cut' || a.act === 'pour')) return 'usta';
    return '';
  };
  /** Advance the burst timer; returns burst progress 0..1 while active, -1 otherwise. */
  function burst(r: Row, a: Actor, dt: number, dur: number, gap: [number, number], allowed: boolean): number {
    r.t += dt;
    if (r.dur > 0) {
      r.phase += dt;
      if (r.phase >= r.dur) { r.dur = 0; r.phase = 0; const g = R(a); r.next = r.t + gap[0] + g() * (gap[1] - gap[0]); return -1; }
      return r.phase / r.dur;
    }
    if (allowed && r.t >= r.next) { r.dur = dur; r.phase = 0; return 0; }
    return -1;
  }

  function ensureGull(r: Row, a: Actor) {
    if (r.gull) return;
    try { r.gull = d.chars.makeGull({ seed: a.id }); r.gx = a.x; r.gz = a.z; } catch { r.gull = null; }
  }
  function ensureProp(r: Row) {
    if (r.prop) return;
    const m = new T.Mesh(durumGeo, durumMat); const tip = new T.Mesh(tipGeo, durumTip); tip.position.y = 0.1; m.add(tip);
    m.visible = false; d.scene.add(m); r.prop = m;
  }

  return {
    update(dt) {
      const ag = d.agents(); if (!ag) return;
      const alive = new Set<number>();
      for (const a of ag.registry.list) {
        if (a.kind !== 'worker' || a.dead) continue;
        const huy = huyOf(a);
        const h = d.rigOf(a.id);
        if (!h || !huy) { if (rows.has(a.id) && !huy) drop(a.id); continue; }
        alive.add(a.id);
        const B = bonesOf(h); if (!B) continue;
        const r = row(a);
        const walking = a.speed > 0.3;
        switch (huy) {
          case 'uykucu': {
            const p = burst(r, a, dt, 2.2, [10, 18], a.act !== 'sleep' && !walking);
            if (p >= 0) {
              const droop = p < 0.75 ? 0.6 * (p / 0.75) ** 2 : 0.6 - (p - 0.75) / 0.25 * 0.85;
              B.head.rotation.x += Math.max(-0.25, droop);
              if (p > 0.75) { B.shL.rotation.z += 0.25 * Math.sin((p - 0.75) * 12); B.shR.rotation.z -= 0.25 * Math.sin((p - 0.75) * 12); }
            }
            break;
          }
          case 'geveze': {
            const p = burst(r, a, dt, 3.2, [5, 10], !walking || a.act === 'carry');
            if (p >= 0) {
              const k = Math.sin(p * Math.PI), w = r.phase * 9;
              B.shR.rotation.x -= (0.7 + 0.35 * Math.sin(w)) * k; B.elR.rotation.x -= 0.8 * k;
              B.shL.rotation.x -= (0.4 + 0.3 * Math.sin(w + 1.7)) * k; B.shL.rotation.z += 0.25 * k * Math.sin(w * 0.5);
              B.head.rotation.y += 0.25 * Math.sin(w * 0.7) * k; B.head.rotation.x += 0.08 * Math.sin(w * 1.3) * k;
            }
            break;
          }
          case 'martici': {
            ensureGull(r, a);
            const p = burst(r, a, dt, 4, [5, 9], !walking);
            const g = r.gull;
            if (g) {
              const rot = a.rot, tx = a.x + Math.cos(rot) * 0.55 + Math.sin(rot) * 0.35, tz = a.z - Math.sin(rot) * 0.55 + Math.cos(rot) * 0.35;
              const k = Math.min(1, dt * (walking ? 3 : 6));
              const ddx = tx - r.gx, ddz = tz - r.gz, dist = Math.hypot(ddx, ddz);
              r.gx += ddx * k; r.gz += ddz * k;
              const face = Math.atan2(a.x - r.gx, a.z - r.gz);
              g.setPose({ x: r.gx, z: r.gz }, dist > 0.15 ? Math.atan2(ddx, ddz) : face);
              (g as unknown as { setState?: (s: Record<string, unknown>) => void }).setState?.({ mode: dist > 0.15 ? 'walk' : 'stand', speed: Math.min(1, dist * 2) });
              g.update(dt, 1);
              if (p >= 0) {
                const w = r.phase * 5.2, mine = Math.sin(w), its = Math.sin(w + Math.PI);
                B.head.rotation.x += Math.max(0, mine) * 0.35; B.head.rotation.y += 0.35;
                const gb = bonesOf(g);
                if (gb && gb.head) gb.head.rotation.x += Math.max(0, its) * 0.5;
              }
            }
            break;
          }
          case 'usta': {
            ensureProp(r);
            const p = burst(r, a, dt, 1.1, [6, 11], !walking);
            const pr = r.prop!;
            if (p >= 0) {
              const hand = (h as unknown as { rig?: { hand?: T.Object3D } }).rig?.hand;
              if (hand) hand.getWorldPosition(v); else v.set(a.x, 1.1, a.z);
              const yUp = 4 * 0.85 * p * (1 - p);
              pr.position.set(v.x, v.y + 0.12 + yUp, v.z);
              pr.rotation.set(p * Math.PI * 4, 0, 0.4);
              pr.visible = true;
              const arm = p < 0.2 ? p / 0.2 : p > 0.8 ? (1 - p) / 0.2 : 1;
              B.shR.rotation.x -= 1.0 * arm; B.elR.rotation.x -= 0.6 * arm; B.head.rotation.x -= 0.35 * Math.sin(p * Math.PI);
            } else pr.visible = false;
            break;
          }
          case 'aceleci': {
            const p = burst(r, a, dt, 0.8, [6, 11], walking && a.speed > 0.8);
            if (p >= 0) {
              const k = Math.sin(p * Math.PI);
              B.spine.rotation.x += 0.45 * k; B.head.rotation.x -= 0.25 * k;
              B.shL.rotation.z += 1.1 * k; B.shR.rotation.z -= 1.1 * k; B.shL.rotation.x -= 0.6 * k; B.shR.rotation.x -= 0.4 * k;
              h.object.position.x += Math.cos(a.rot) * 0.06 * Math.sin(p * Math.PI * 2);
              h.object.position.y -= 0.04 * k;
            }
            break;
          }
        }
      }
      for (const id of [...rows.keys()]) if (!alive.has(id)) drop(id);
    },
    dispose() {
      for (const id of [...rows.keys()]) drop(id);
      durumGeo.dispose(); durumMat.dispose(); durumTip.dispose(); tipGeo.dispose();
    },
  };
}
