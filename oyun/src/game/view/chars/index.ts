/**
 * Characters view (Builder C): motor-facing wrapper around the 1:1 v2 port (`v2/chars-v2.ts`).
 *
 * Decisions (contract silent):
 * - makeHero/makeCat/makeDog/makeGull return HeroHandle and add their object to deps.scene (dispose removes it).
 *   Option names are v2's: `{ kind, role, preset, seed, look }`; a bare CharLook (`{ apron: 'SABRİ', ... }`) is
 *   accepted too: apron 'SABRİ'/'SABRİYE' picks the Sabri/Sabriye preset, other fields become look overrides.
 * - Speed is m/s like the sim. v2 drove rigs with speed 1 whenever moving, so: moving (> 0.15 m/s) -> full stride
 *   from 1.2 m/s up; `gait: 'run'` or > 5.5 m/s -> v2 'chase' run.
 * - Acts map onto v2 acts: sweep->wipe, phone->selfie, serve->pour, perform->talk, sip/eat->idle + 'sipTea' clip,
 *   grab->idle (M1 adds a reach clip). Moods: impatient->v2 angry (grumpy), sad->pout, asleep->sleepy.
 * - The animator (engine/anim) runs the additive layers (clips, emotes, idles after 4-8 s, stop stumble) on top of
 *   the exact v2 procedural pose; `lookAt` adds a clamped head yaw.
 * - Carried stack (setCarry): items stack 0.36 m in front of the hero at 1.0 m (v2 stackSlot); each item has a
 *   damped spring offset driven by the hero's acceleration, chained upward, clamped to 6 cm: it wobbles, never drops.
 *   Item looks come from `setItemFactory` (B's item prefabs in M1); fallback = coloured toy boxes.
 * - Crowd (CrowdView): reads the agents SoA every frame; budget = quality crowd (25/50/90). Priority: customer /
 *   queued / seated / LOD A first, then the rest in slot order. Looks: randomLook(type, seed(slot)) stable while the
 *   slot stays alive; `lookSeed(slot, seed)` pins a persistent citizen's look. expr u8: 0 (neutral) = mood-driven
 *   (v2 behaviour), others override the face row; LOD B/C use the 4-expression far set.
 * - Every root carries userData.parity = 'dyn' (parity masks) and v2 names (crowd, hero-*, cat-*, dog-*, gull-*, pigeons).
 */
import * as T from 'three';
import { CH } from './v2/chars-v2';
import * as K from './v2/kit';
import type {
  Chars, CharsDeps, CharLook, HeroHandle, CrowdView, AnimalOpts, AnimLayerInput, ExprId, BrowId, Vec2, Vec3, SoAStore, Animator, GaitId, ActId,
} from '../../../engine/api';
import { EXPR_ORDER, ACT_ORDER, MOOD_ORDER, GAIT_ORDER, AGENT_FLAG, AGENT_LOD } from '../../sim/schema';
import { CITIZENS } from '../../../content/citizens';
import { FACES } from '../../../content/faces';
import { CLIPS } from '../../../content/clips';
import type { MotorAnimator } from '../../../engine/anim';

export const ITEM_LOOK: Record<string, { color: string; h: number }> = {
  doner: { color: '#f1dcae', h: 0.2 }, cay: { color: '#a3301a', h: 0.19 }, ayran: { color: '#fbfdff', h: 0.17 },
  simit: { color: '#c8833c', h: 0.06 }, tost: { color: '#e8c27a', h: 0.08 }, gazoz: { color: '#5aa9d6', h: 0.22 },
};
const FACE_ROW = FACES.map(f => f.crowdRow), FAR_ROW = FACES.map(f => f.farRow);
const V2ACT: Partial<Record<ActId, string>> = { cut: 'cut', pour: 'pour', serve: 'pour', sweep: 'wipe', sleep: 'sleep', phone: 'selfie', wave: 'wave', sit: 'sit', cheer: 'cheer', perform: 'talk', dance: 'dance' };
const CROWD_ACT: Partial<Record<ActId, string>> = { sip: 'drink', eat: 'eat', wave: 'wave', sleep: 'sleep', phone: 'phone', cheer: 'cheer', perform: 'cheer', dance: 'dance', serve: 'point', grab: 'point' };
const moving = (s: number) => s > 0.15;
const v2speed = (s: number) => (moving(s) ? Math.min(1, s / 1.2) : 0);

export interface MotorHero extends HeroHandle {
  /** v2 state passthrough for animals/gulls (act 'curl', mode 'glide', ...). */
  setState(s: Record<string, unknown>): void;
  /** v2 rig object (hand/head anchors, look). */
  readonly rig: any;
}
export interface MotorCrowd extends CrowdView {
  lookSeed(slot: number, seed: number): void;
  headPos(slot: number, out: Vec3): boolean;
  stats(): Record<string, unknown>;
}
export interface MotorChars extends Chars {
  readonly crowd: MotorCrowd;
  setItemFactory(fn: ((id: string) => T.Object3D | null) | null): void;
  /** Raw v2 API (randomLook, TYPE_IDS, PRESETS...) for tools and the lineup. */
  readonly v2: any;
}

const dyn = (o: T.Object3D) => { o.userData.parity = 'dyn'; return o; };

export function createChars(deps: CharsDeps): MotorChars {
  const scene = deps.scene, anim = deps.anim as CharsDeps['anim'] & { createAnimator(g: GaitId, s?: number): MotorAnimator };
  try { K.setMaxAnisotropy(8); } catch { /* headless */ }
  for (const id in CLIPS) if (!anim.clip(id)) anim.defineClip(CLIPS[id]);
  let itemFactory: ((id: string) => T.Object3D | null) | null = null;
  const autos: { update(dt: number): void }[] = [];
  const handles = new Set<MotorHero>();

  function itemMesh(id: string): T.Object3D {
    const o = itemFactory ? itemFactory(id) : null;
    if (o) return o;
    const L = ITEM_LOOK[id] || { color: '#e8e2d4', h: 0.12 };
    const g = new T.Group(); const b = K.mesh(K.roundBox(0.24, L.h * 0.92, 0.18, 0.03, 2), L.color); b.position.y = L.h / 2; g.add(b); g.userData.h = L.h;
    return g;
  }

  function wrapRig(rig: any, kind: 'hero' | 'animal', gait: GaitId, seed: number): MotorHero {
    const object: T.Object3D = dyn(rig.group);
    scene.add(object);
    const animator = anim.createAnimator(gait, seed) as MotorAnimator;
    const inp: AnimLayerInput = { speed: 0, carry: 0, act: 'idle', mood: 'ok', t: 0 };
    const v2s: Record<string, unknown> = {};
    let extra: Record<string, unknown> | null = null;
    let look: Vec3 | null = null;
    const addJ: Record<string, number> = {};
    // carried stack
    const stack = new T.Group(); stack.name = 'carry'; object.add(stack);
    let items: { o: T.Object3D; h: number; x: number; z: number; vx: number; vz: number }[] = [];
    let lastX = NaN, lastZ = NaN, velX = 0, velZ = 0, accX = 0, accZ = 0, sipT = 0;
    const h: MotorHero = {
      object, animator: animator as Animator, rig,
      setPose(p: Vec2, rotY: number) { object.position.set(p.x, object.position.y, p.z); object.rotation.y = rotY; },
      setInput(i) { Object.assign(inp, i); },
      setState(s) { extra = s; },
      setExpr(e: ExprId, brow?: BrowId) { if (rig.setFace) rig.setFace(EXPR_ORDER.indexOf(e), brow); },
      setCarry(list: string[]) {
        for (const it of items) stack.remove(it.o);
        items = list.map(id => { const o = itemMesh(id); stack.add(o); return { o, h: (o.userData.h as number) || ITEM_LOOK[id]?.h || 0.12, x: 0, z: 0, vx: 0, vz: 0 }; });
      },
      lookAt(p: Vec3 | null) { look = p; },
      update(dt: number, _alpha: number) {
        dt = Math.min(Math.max(dt || 0, 0), 0.1);
        inp.t += dt;
        // velocity/acceleration from poses (drives the stack springs)
        const x = object.position.x, z = object.position.z;
        if (dt > 0 && lastX === lastX) { const nvx = (x - lastX) / dt, nvz = (z - lastZ) / dt; accX = (nvx - velX) / dt; accZ = (nvz - velZ) / dt; velX = nvx; velZ = nvz; }
        lastX = x; lastZ = z;
        if (kind === 'animal') { rig.update(dt, extra || animalState(rig, inp)); return; }
        // animator: additive layers
        animator.update(dt, { ...inp, carry: items.length ? Math.min(1, items.length / 6) : inp.carry });
        const A = animator.additive();
        for (const k in A) addJ[k] = A[k as keyof typeof A];
        if (look) { const yaw = Math.atan2(look.x - x, look.z - z) - object.rotation.y; let d = yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; addJ.hdY = (addJ.hdY || 0) + Math.max(-0.9, Math.min(0.9, d)) * 0.8; }
        rig.addJ = addJ;
        if ((inp.act === 'sip' || inp.act === 'eat') && (sipT -= dt) <= 0) { sipT = 2.6; animator.play('sipTea'); }
        const sp = inp.speed, run = animator.gait.id === 'run' || sp > 5.5;
        v2s.act = run && moving(sp) ? 'chase' : (moving(sp) ? 'idle' : (V2ACT[inp.act] || 'idle'));
        v2s.speed = v2speed(sp);
        v2s.carry = items.length > 0 || inp.carry > 0;
        v2s.oneHand = !!(inp as { oneHand?: boolean }).oneHand;
        v2s.mood = inp.mood;
        if (extra) Object.assign(v2s, extra);
        rig.update(dt, v2s);
        // stack wobble: spring chain in the hero's local frame, 6 cm clamp
        if (items.length) {
          const c = Math.cos(object.rotation.y), s = Math.sin(object.rotation.y);
          const lax = c * accX - s * accZ, laz = s * accX + c * accZ; // world -> local
          let y = 1.0, px = 0, pz = 0;
          for (let i = 0; i < items.length; i++) {
            const it = items[i], k = 140 - i * 8, d = 9, push = 0.0035 * (1 + i * 0.35);
            const n = Math.max(1, Math.ceil(dt * 120)), hh = dt / n;
            for (let j = 0; j < n; j++) {
              it.vx += ((px - it.x) * k - it.vx * d - lax * push * 60) * hh; it.vz += ((pz - it.z) * k - it.vz * d - laz * push * 60) * hh;
              it.x += it.vx * hh; it.z += it.vz * hh;
            }
            const l = Math.hypot(it.x, it.z); if (l > 0.06) { it.x *= 0.06 / l; it.z *= 0.06 / l; it.vx *= 0.5; it.vz *= 0.5; }
            it.o.position.set(it.x, y, 0.36 + it.z); it.o.rotation.set(it.z * 1.6, 0, -it.x * 1.6);
            y += it.h; px = it.x; pz = it.z;
          }
        }
      },
      dispose() { handles.delete(h); if (object.parent) object.parent.remove(object); try { rig.dispose && rig.dispose(); } catch { /* already gone */ } },
    };
    handles.add(h);
    return h;
  }
  function animalState(rig: any, inp: AnimLayerInput): Record<string, unknown> {
    const sp = moving(inp.speed) ? Math.min(1, inp.speed / 1.2) : 0;
    const name: string = rig.group.name;
    if (name.startsWith('gull')) return { mode: sp > 0 ? 'walk' : 'stand', speed: sp };
    if (name.startsWith('dog')) return { act: sp > 0 ? 'walk' : inp.act === 'sleep' ? 'sleep' : inp.act === 'wave' || inp.act === 'cheer' ? 'wag' : 'sit', speed: sp };
    return { act: sp > 0 ? 'walk' : inp.act === 'sleep' ? 'sleep' : inp.act === 'sit' ? 'sit' : 'sit', speed: sp };
  }

  // ---------------- crowd ----------------
  const CAP = 120;
  const v2crowd = CH.makeCrowd(null, CAP);
  dyn(v2crowd.group); scene.add(v2crowd.group);
  const slotId = new Int32Array(256).fill(-1), slotType = new Int16Array(256).fill(-1), slotSeed = new Float64Array(256).fill(NaN), seen = new Uint8Array(256);
  const pick = new Int32Array(256);
  let budget = deps.quality.current().crowd, shown = 0;
  const set: Record<string, unknown> = {};
  const crowd: MotorCrowd = {
    object: v2crowd.group,
    setBudget(n) { budget = Math.max(0, Math.min(CAP, n | 0)); },
    visible: () => shown,
    lookSeed(slot, seed) { slotSeed[slot] = seed; if (slotId[slot] >= 0) { v2crowd.remove(slotId[slot]); slotId[slot] = -1; } },
    headPos(slot, out) { const id = slotId[slot]; if (id < 0) return false; const v = v2crowd.headPos(id); out.x = v.x; out.y = v.y; out.z = v.z; return true; },
    stats: () => v2crowd.stats(),
    update(agents: SoAStore, dt: number, alpha: number) {
      const hi = Math.min(agents.hi, 256), flags = agents.u16('flags'), lod = agents.u8('lod');
      // choose up to budget slots: priority first, then the rest
      let n = 0;
      for (let pass = 0; pass < 2 && n < budget; pass++) for (let i = 0; i < hi && n < budget; i++) {
        if (!agents.alive(i)) continue;
        const f = flags[i]; if (!(f & AGENT_FLAG.visible) || (f & AGENT_FLAG.hero)) continue;
        const pri = (f & (AGENT_FLAG.customer | AGENT_FLAG.queued | AGENT_FLAG.seated)) !== 0 || lod[i] === AGENT_LOD.A;
        if ((pass === 0) === pri) pick[n++] = i;
      }
      seen.fill(0);
      const X = agents.f32('x'), Z = agents.f32('z'), PX = agents.f32('px'), PZ = agents.f32('pz'), RO = agents.f32('rot'), PR = agents.f32('prot'), SP = agents.f32('speed');
      const typ = agents.u8('typeId'), act = agents.u8('act'), mood = agents.u8('mood'), expr = agents.u8('expr'), carry = agents.u8('carry'), gait = agents.u8('gait');
      for (let k = 0; k < n; k++) {
        const i = pick[k]; seen[i] = 1;
        const ty = typ[i] % CITIZENS.length;
        if (slotId[i] < 0 || slotType[i] !== ty) {
          if (slotId[i] >= 0) v2crowd.remove(slotId[i]);
          const seed = slotSeed[i] === slotSeed[i] ? slotSeed[i] : (i + 1) * 7919 + ty * 104729;
          slotId[i] = v2crowd.add(CH.randomLook(CITIZENS[ty].id, K.rng(seed))); slotType[i] = ty;
          if (slotId[i] < 0) continue;
        }
        const a = ACT_ORDER[act[i]] as ActId, m = MOOD_ORDER[mood[i]], e = expr[i];
        let rot = PR[i]; { let d = RO[i] - rot; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; rot += d * alpha; }
        set.x = PX[i] + (X[i] - PX[i]) * alpha; set.z = PZ[i] + (Z[i] - PZ[i]) * alpha; set.rot = rot;
        set.speed = moving(SP[i]) ? Math.min(1, SP[i] / 0.9) : 0;
        set.sit = a === 'sit' || (flags[i] & AGENT_FLAG.seated) !== 0;
        set.carry = carry[i] > 0;
        set.act = GAIT_ORDER[gait[i]] === 'run' && moving(SP[i]) ? 'run' : m === 'asleep' ? 'sleep' : (CROWD_ACT[a] || 'idle');
        set.mood = m === 'happy' ? 'happy' : m === 'impatient' ? 'angry' : 'ok';
        const far = lod[i] !== AGENT_LOD.A;
        set.exprRow = e > 0 && e < FACE_ROW.length ? (far ? FAR_ROW[e] : FACE_ROW[e]) + 1 : (m === 'sad' ? (far ? 4 : 8) : 0);
        v2crowd.set(slotId[i], set);
      }
      // free slots not shown this frame (dead, invisible or over budget)
      for (let i = 0; i < 256; i++) if (slotId[i] >= 0 && (!seen[i] || !agents.alive(i))) { v2crowd.remove(slotId[i]); slotId[i] = -1; slotType[i] = -1; if (!agents.alive(i)) slotSeed[i] = NaN; }
      shown = n;
      v2crowd.update(dt);
      if (deps.perf) deps.perf.count('crowd.visible', n);
    },
    dispose() { v2crowd.dispose(); },
  };

  const chars: MotorChars = {
    crowd, v2: CH,
    setItemFactory(fn) { itemFactory = fn; },
    makeHero(opts: CharLook) {
      const o = opts as Record<string, unknown>;
      let v2opts: Record<string, unknown>;
      if (o.kind) v2opts = { ...o };
      else {
        const txt = typeof o.apron === 'string' ? (o.apron as string).toLocaleUpperCase('tr-TR') : '';
        const kind = txt === 'SABRİYE' ? 'sabriye' : txt === 'SABRİ' ? 'sabri' : 'worker';
        const look: Record<string, unknown> = { ...o }; delete look.apron; delete look.seed; delete look.typeId;
        if (kind === 'worker' && txt) look.apronText = txt;
        v2opts = { kind, seed: o.seed, look: Object.keys(look).length ? look : undefined };
      }
      const rig = CH.makeHero(v2opts);
      const gait: GaitId = (o.gait as GaitId) || (v2opts.kind === 'sabriye' ? 'brisk' : 'normal');
      const h = wrapRig(rig, 'hero', gait, Number(o.seed ?? 7) || 7);
      (h.animator as MotorAnimator).armOut = rig.armOut || 0.12;
      return h;
    },
    makeCat(opts: AnimalOpts = {}) { return wrapRig(CH.makeCat(opts), 'animal', 'normal', 3); },
    makeDog(opts: AnimalOpts = {}) { return wrapRig(CH.makeDog({ name: 'Torbacı', ...opts }), 'animal', 'normal', 5); },
    makeGull(opts: AnimalOpts = {}) { return wrapRig(CH.makeGull(opts), 'animal', 'normal', 9); },
    makeFlock(opts: AnimalOpts = {}) {
      const c = (opts.center as Vec3) || { x: 0, y: 16, z: -30 };
      const f = CH.makeFlock(scene, (opts.count as number) ?? deps.quality.current().gullsFar, new T.Vector3(c.x, c.y, c.z), (opts.radius as number) ?? 26);
      dyn(f.mesh);
      return { object: f.mesh, update: (dt: number) => f.update(dt), dispose: () => f.dispose() };
    },
    makePigeons(opts: AnimalOpts = {}) {
      const p = CH.makePigeons(scene, (opts.count as number) ?? deps.quality.current().pigeons, opts.area || { x0: -8, x1: 8, z0: 6, z1: 10 });
      dyn(p.mesh);
      return { object: p.mesh, update: (dt: number) => p.update(dt), dispose: () => p.dispose(), scatter: (x: number, z: number, r?: number) => p.scatter(x, z, r) } as { object: T.Object3D; update(dt: number): void; dispose(): void };
    },
    faceAtlas() { return CH.crowdFaces(); },
    update(dt: number) { for (const a of autos) a.update(dt); },
  };
  // dressing slots (art comes last; code art is the fallback)
  try {
    const d = deps.dress as unknown as { define?: (s: unknown) => void; has?: (id: string) => boolean } | null;
    if (d && d.define) for (const id of ['char.sabri.body', 'char.sabriye.body', 'char.crowd.faces', 'char.cat.pamuk', 'char.dog.karamel', 'char.gull.adult'])
      if (!d.has || !d.has(id)) d.define({ id, kind: id.endsWith('faces') ? 'texture' : 'mesh', fallback: () => null });
  } catch { /* dress optional */ }
  return chars;
}
