/**
 * Individual-rig view of the agents layer (Builder C, M1): turns the sim's ActorRegistry (workers, regulars, VIP,
 * kapkaççı, cats, Karamel, gulls) into v2 rigs, plus the pigeons and the far gull flock. Never writes sim state.
 *
 * - Diff by actor id each frame: new actor -> rig, dead actor -> rig disposed. Pose = prev -> cur lerped by alpha.
 * - Candidate looks are data (`{ lookType, lookSeed, ...overrides }`), expanded here with randomLook.
 * - People: setInput({ speed, act, mood }) + setCarry(types) when the carried list changes. Animals get the v2 act /
 *   mode names straight through setState (cat: sleep walk rub purr meow, dog: sleep sit wag bark, gull: stand walk
 *   fly glide scream stare). Gulls above the tier's gullsNear are hidden (the sim keeps a fixed count).
 * - Pigeons scatter from the player's footsteps (v2: every 6th frame while moving).
 * - Speech bubbles are D's: read `actor.say` / `actor.sayT` from the registry (screen label per actor, head via rig).
 */
import * as T from 'three';
import type { GameView, Quality, HeroHandle, Vec3 } from '../../../engine/api';
import type { GameState } from '../../sim/schema';
import type { AgentsHandle } from '../../sim/agents';
import type { Actor } from '../../sim/agents/types';
import { FLOCK } from '../../sim/agents/pigeons';
import type { MotorChars } from './index';
import * as K from './v2/kit';

export interface AgentsViewDeps {
  chars: MotorChars;
  quality: Quality;
  /** Live agents handle (rules.rt.agents); null before the sim exists. */
  agents: () => AgentsHandle | null;
  player: () => { x: number; z: number; moving: boolean };
  /** Optional: B's item meshes are wired through chars.setItemFactory by boot. */
}
export interface AgentsView extends GameView {
  /** Head world position of an actor's rig (for bubbles / labels); false when not drawn. */
  headPos(actorId: number, out: Vec3): boolean;
  rigOf(actorId: number): HeroHandle | null;
  stats(): { rigs: number };
}

interface Row { a: Actor; h: HeroHandle; animal: boolean; carryKey: string; gull: number; bag?: T.Object3D }

export function resolveLook(chars: MotorChars, look: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!look) return look;
  if (look.lookType == null) return look;
  const { lookType, lookSeed, ...rest } = look as { lookType: string; lookSeed?: number; [k: string]: unknown };
  const base = chars.v2.randomLook(lookType, K.rng(Number(lookSeed ?? 1)));
  return { ...base, ...rest };
}

export function createAgentsView(deps: AgentsViewDeps): AgentsView {
  const { chars } = deps;
  const rows = new Map<number, Row>();
  let flock: ReturnType<MotorChars['makeFlock']> | null = null;
  let pigeons: (ReturnType<MotorChars['makePigeons']> & { scatter?: (x: number, z: number, r?: number) => void }) | null = null;
  let frame = 0;
  let tierKey = '';

  function build(a: Actor): Row | null {
    const rig = { ...a.rig } as Record<string, unknown>;
    let h: HeroHandle, animal = false;
    try {
      if (a.kind === 'cat') { h = chars.makeCat(rig); animal = true; }
      else if (a.kind === 'dog') { h = chars.makeDog(rig); animal = true; }
      else if (a.kind === 'gull' || a.kind === 'parrot') { h = chars.makeGull(rig); animal = true; }
      else {
        let lk = resolveLook(chars, rig.look as Record<string, unknown> | undefined);
        if (a.kind === 'worker' && lk) { const o = { ...lk }; for (const k of ['top', 'topStyle', 'sleeves', 'vest', 'bowtie', 'bottom', 'bottomStyle', 'hat', 'hatColor', 'apron', 'back', 'props', 'accent']) delete o[k]; lk = o; }   // hired staff wear their ROLE uniform, only the person (face, hair, skin) comes from the candidate
        rig.look = lk; h = chars.makeHero(rig as never);
      }
    } catch (e) { return null; }
    h.object.position.set(a.x, a.y, a.z);
    let bag: T.Object3D | undefined;
    if (a.kind === 'dog') {   // Torbacı's garbage bag, dragged behind him on errands
      const g = new T.Group();
      const sack = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshLambertMaterial({ color: '#23262b' })); sack.scale.set(1, 0.8, 1.15); sack.position.y = 0.16; sack.castShadow = true;
      const knot = new T.Mesh(new T.ConeGeometry(0.06, 0.14, 6), new T.MeshLambertMaterial({ color: '#23262b' })); knot.position.set(0, 0.38, 0);
      const rope = new T.Mesh(new T.CylinderGeometry(0.014, 0.014, 1.9, 4), new T.MeshLambertMaterial({ color: '#d8d0c0' })); rope.rotation.x = Math.PI / 2; rope.position.set(0, 0.22, 0.95);
      g.add(sack, knot, rope); g.position.set(0, 0, -1.55); g.visible = false; h.object.add(g); bag = g;
    }
    return { a, h, animal, bag, carryKey: '', gull: a.kind === 'gull' ? Number(a.key.split('-')[1]) : -1 };
  }
  function ensure(agents: AgentsHandle | null) {
    if (!agents) return;
    const list = agents.registry.list;
    const alive = new Set<number>();
    for (const a of list) {
      if (a.dead) continue;
      alive.add(a.id);
      if (!rows.has(a.id)) { const r = build(a); if (r) rows.set(a.id, r); }
    }
    for (const [id, r] of rows) if (!alive.has(id)) { r.h.dispose(); rows.delete(id); }
  }
  function lerpAngle(a: number, b: number, t: number) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; }

  const view: AgentsView = {
    update(_state: GameState, dt: number, alpha: number) {
      const agents = deps.agents();
      if (!flock) {
        try { flock = chars.makeFlock({ center: { x: 0, y: FLOCK.y, z: FLOCK.z }, radius: FLOCK.radius }); } catch { flock = null; }
      }
      if (!pigeons && agents) {
        try { const p = agents.pigeons(); pigeons = chars.makePigeons({ area: { x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, center: { x: p.cx, y: 0, z: p.cz }, radius: p.radius } }) as unknown as typeof pigeons; } catch { pigeons = null; }
      }
      ensure(agents);
      const gullsNear = deps.quality.current().gullsNear;
      for (const r of rows.values()) {
        const a = r.a, h = r.h;
        const x = a.px + (a.x - a.px) * alpha, z = a.pz + (a.z - a.pz) * alpha, y = a.py + (a.y - a.py) * alpha;
        const rot = lerpAngle(a.prot, a.rot, alpha);
        h.setPose({ x, z }, rot);
        h.object.position.y = y;
        if (r.bag) { r.bag.visible = a.fx === 'bag'; r.bag.rotation.y = Math.sin(performance.now() / 260) * 0.12; }
        if (r.gull >= 0) h.object.visible = r.gull < gullsNear || a.act === 'stare' || a.act === 'snatch' || a.carry.length > 0;
        if (r.animal) {
          (h as unknown as { setState(s: Record<string, unknown>): void }).setState(r.a.kind === 'gull' || r.a.kind === 'parrot' ? { mode: a.act, speed: Math.min(1, a.speed / 1.2) } : { act: a.act, speed: Math.min(1, a.speed / 1.2) });
        } else {
          const key = a.carry.map((c) => c.type).join(',');
          if (key !== r.carryKey) { r.carryKey = key; h.setCarry(a.carry.map((c) => c.type)); }
          h.setInput({ speed: a.speed, act: a.act as never, mood: a.mood });
        }
        h.update(dt, alpha);
      }
      if (flock) flock.update(dt);
      if (pigeons) {
        pigeons.update(dt);
        const p = deps.player();
        if (p.moving && frame++ % 6 === 0 && pigeons.scatter) pigeons.scatter(p.x, p.z);
      }
      const t = deps.quality.current().name;
      tierKey = t;
    },
    headPos(id, out) {
      const r = rows.get(id); if (!r) return false;
      const head = (r.h as unknown as { rig?: { head?: T.Object3D } }).rig?.head;
      if (head) { const v = new T.Vector3(); head.getWorldPosition(v); out.x = v.x; out.y = v.y; out.z = v.z; return true; }
      out.x = r.h.object.position.x; out.y = r.h.object.position.y + (r.animal ? 0.6 : 1.85); out.z = r.h.object.position.z; return true;
    },
    rigOf: (id) => rows.get(id)?.h ?? null,
    stats: () => ({ rigs: rows.size }),
    dispose() {
      for (const r of rows.values()) r.h.dispose();
      rows.clear();
      flock?.dispose(); pigeons?.dispose(); flock = null; pigeons = null;
      void tierKey;
    },
  };
  return view;
}
