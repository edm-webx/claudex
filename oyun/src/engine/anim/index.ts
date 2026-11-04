/**
 * engine/anim: procedural animation (motor-10), springs, authored clips, toy squash-and-pop. Owner: Builder C.
 *
 * Decisions (contract silent):
 * - The procedural layer is the v2 hero joint model (chars.js Hero.update) expressed as named joints
 *   (`JOINTS`: lsX, rsZ, hdY, spX, rootY, ...) and exported as RigPose. Heroes in the view keep the exact v2 code for
 *   look parity and take the animator's *additive* layers (clips, emotes, idles, stop stumble) through
 *   `animator.additive()`; rigs that are not v2 heroes can drive bones from `update()` directly.
 * - Clip tracks are keyed by joint groups: root (y = bob), spine (lean, twist, roll), head, armL, armR, foreL, foreR
 *   (x = elbow), legL, legR, kneeL, kneeR (x). Keys are [t, x, y, z], Catmull-Rom (Hermite) interpolated.
 *   Clips fade in/out over 0.15 s; additive clips add, override clips replace the procedural value.
 * - Idles fire after 4-8 s standing still, chosen from a seeded view-side rng (never the sim rng).
 * - Speed is in m/s; 1.3 m/s (v2 walk) maps to full stride, > 2.6 m/s or gait 'run' runs.
 * - squashPop: per-object damped spring on scale (toy feel, animasyon-1), pooled tweens, no per-frame allocation.
 * Pure except squashPop/update, which only touch Object3D.scale (typed import, no three runtime needed).
 */
import type { AnimApi, AnimDeps, Animator, AnimLayerInput, ClipDef, ClipId, EmoteId, Gait, GaitId, IdleId, RigPose, Spring1D } from '../api';
import type { Object3D } from 'three';

export const JOINTS = ['rootY', 'hipZ', 'spX', 'spY', 'spZ', 'nkX', 'hdX', 'hdY', 'hdZ', 'lsX', 'lsY', 'lsZ', 'leX', 'lhX', 'lhZ', 'rsX', 'rsY', 'rsZ', 'reX', 'rhX', 'rhZ', 'ltX', 'ltZ', 'lkX', 'lfX', 'rtX', 'rtZ', 'rkX', 'rfX', 'breath'] as const;
export type JointId = typeof JOINTS[number];
export type JointMap = Record<JointId, number>;
/** Clip track -> joints (x, y, z). '' = unused component. */
export const TRACK_JOINTS: Record<string, [JointId | '', JointId | '', JointId | '']> = {
  root: ['', 'rootY', ''], spine: ['spX', 'spY', 'spZ'], head: ['hdX', 'hdY', 'hdZ'],
  armL: ['lsX', 'lsY', 'lsZ'], armR: ['rsX', 'rsY', 'rsZ'], foreL: ['leX', 'lhX', 'lhZ'], foreR: ['reX', 'rhX', 'rhZ'],
  legL: ['ltX', '', 'ltZ'], legR: ['rtX', '', 'rtZ'], kneeL: ['lkX', 'lfX', ''], kneeR: ['rkX', 'rfX', ''],
};

export const GAITS: Readonly<Record<GaitId, Gait>> = {
  normal: { id: 'normal', stride: 0.52, freq: 9.4, bob: 0.9, sway: 0.03, armSwing: 0.48 },
  waddle: { id: 'waddle', stride: 0.42, freq: 7.6, bob: 0.8, sway: 0.09, armSwing: 0.36 },
  brisk: { id: 'brisk', stride: 0.56, freq: 10.6, bob: 0.9, sway: 0.02, armSwing: 0.55 },
  slow: { id: 'slow', stride: 0.4, freq: 6.4, bob: 0.7, sway: 0.03, armSwing: 0.3 },
  shuffle: { id: 'shuffle', stride: 0.28, freq: 7.0, bob: 0.5, sway: 0.04, armSwing: 0.2 },
  kid: { id: 'kid', stride: 0.5, freq: 11.5, bob: 1.1, sway: 0.04, armSwing: 0.6 },
  run: { id: 'run', stride: 0.95, freq: 15.5, bob: 1.2, sway: 0.02, armSwing: 1.0 },
};

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const sstep = (e0: number, e1: number, x: number) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

/** mulberry32, view-side only. */
function viewRng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createSpring(k: number, d: number, v0 = 0): Spring1D {
  const s: Spring1D = {
    k, d, value: v0, vel: 0,
    step(target: number, dt: number) {
      // semi-implicit Euler, substepped so stiff springs stay stable at 30 fps
      const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
      for (let i = 0; i < n; i++) { s.vel += ((target - s.value) * s.k - s.vel * s.d) * h; s.value += s.vel * h; }
      return s.value;
    },
  };
  return s;
}

/** Samples a clip track at time t into out (Catmull-Rom Hermite between keys). */
export function sampleTrack(keys: [number, number, number, number][], t: number, out: number[]): number[] {
  const n = keys.length;
  if (!n) { out[0] = out[1] = out[2] = 0; return out; }
  if (t <= keys[0][0] || n === 1) { out[0] = keys[0][1]; out[1] = keys[0][2]; out[2] = keys[0][3]; return out; }
  if (t >= keys[n - 1][0]) { const k = keys[n - 1]; out[0] = k[1]; out[1] = k[2]; out[2] = k[3]; return out; }
  let i = 0; while (i < n - 2 && keys[i + 1][0] < t) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const dt = k2[0] - k1[0], u = dt > 0 ? (t - k1[0]) / dt : 0, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  for (let c = 1; c <= 3; c++) {
    const m1 = (k2[c] - k0[c]) / Math.max(1e-6, k2[0] - k0[0]) * dt, m2 = (k3[c] - k1[c]) / Math.max(1e-6, k3[0] - k1[0]) * dt;
    out[c - 1] = h00 * k1[c] + h10 * m1 + h01 * k2[c] + h11 * m2;
  }
  return out;
}

const FULL_ACTS: Partial<Record<string, 1>> = { cut: 1, pour: 1, sweep: 1, sleep: 1, sit: 1, cheer: 1, serve: 1 };
const LEGJ: Partial<Record<JointId, 1>> = { ltX: 1, ltZ: 1, lkX: 1, lfX: 1, rtX: 1, rtZ: 1, rkX: 1, rfX: 1, rootY: 1, hipZ: 1 };
const IDLES: IdleId[] = ['twirlMustache', 'sipTea', 'stretchYawn', 'phone', 'stareGull', 'tapFoot'];
const IDLE_W = [1, 1.4, 0.8, 1, 1.2, 1.4];

interface ClipSlot { def: ClipDef; t: number; speed: number; additive: boolean; w: number; fadeOut: boolean; }
export interface MotorAnimator extends Animator {
  /** Joint values after the last update (v2 joint names). */
  readonly joints: Readonly<JointMap>;
  /** Additive offsets (clips, emotes, idles, stop stumble) from the last update, for rigs with their own base layer. */
  additive(): Readonly<JointMap>;
  /** Currently playing clip ids (debug/tests). */
  playing(): string[];
  /** Arm width at rest (v2 armOut), set per body shape. */
  armOut: number;
}

/** AnimApi whose animators expose the motor extras (joints, additive layer, playing clips). */
export type MotorAnimApi = Omit<AnimApi, 'createAnimator'> & { createAnimator(gait: GaitId, seed?: number): MotorAnimator };

export function createAnimApi(_deps: AnimDeps = {}): MotorAnimApi {
  const clips = new Map<ClipId, ClipDef>();
  // squash tweens (pooled)
  interface Sq { o: Object3D | null; sx: number; sy: number; sz: number; v: number; x: number; }
  const sq: Sq[] = [];

  function createAnimator(gaitId: GaitId, seed = 1): MotorAnimator {
    let gait: Gait = GAITS[gaitId] || GAITS.normal;
    const rnd = viewRng(seed * 2654435761);
    const zero = (): JointMap => { const o = {} as JointMap; for (const k of JOINTS) o[k] = 0; return o; };
    const J = zero(), Tg = zero(), Add = zero();
    J.breath = 1;
    const pose: RigPose = { root: { x: 0, y: 0, z: 0 }, lean: 0, bob: 0, torsoTwist: 0, head: { x: 0, y: 0, z: 0 }, armL: { x: 0, y: 0, z: 0 }, armR: { x: 0, y: 0, z: 0 }, legL: { x: 0, y: 0, z: 0 }, legR: { x: 0, y: 0, z: 0 } };
    const slots: ClipSlot[] = [];
    const tmp = [0, 0, 0];
    const stumble = createSpring(320, 16);
    let t = (seed % 97) * 0.37, phase = 0, spd = 0, carryW = 0, still = 0, idleAt = 4 + rnd() * 4, lastSpd = 0, act = 'idle', actT = 0;
    const a: MotorAnimator = {
      armOut: 0.12,
      get gait() { return gait; },
      get joints() { return J; },
      setGait(g) { gait = typeof g === 'string' ? (GAITS[g] || GAITS.normal) : g; },
      additive() { return Add; },
      playing() { return slots.map(s => s.def.id); },
      play(id, opts) {
        const def = clips.get(id); if (!def) return;
        for (const s of slots) if (s.def.id === id) { s.t = 0; s.fadeOut = false; return; }
        slots.push({ def, t: 0, speed: opts?.speed ?? 1, additive: opts?.additive ?? true, w: 0, fadeOut: false });
      },
      emote(e: EmoteId) { a.play(e, { additive: true }); },
      update(dt, inp: AnimLayerInput) {
        dt = Math.min(Math.max(dt, 0), 0.1); t += dt;
        for (const k of JOINTS) { Tg[k] = 0; Add[k] = 0; }
        Tg.breath = 1;
        if (inp.act !== act) { act = inp.act; actT = 0; } actT += dt;
        const run = gait.id === 'run' || inp.speed > 2.6;
        const vn = clamp(inp.speed / 1.3, 0, 1);
        spd = damp(spd, vn, 10, dt);
        carryW = damp(carryW, inp.carry > 0 ? 1 : 0, 12, dt);
        const v = run ? Math.max(0.9, spd) : spd;
        // ---- locomotion (v2 Hero.update)
        const rate = run ? GAITS.run.freq : gait.freq * (0.5 + 0.7 * v);
        if (v > 0.03) phase += dt * rate;
        const sn = Math.sin(phase), cs = Math.cos(phase);
        const A = v * (run ? 0.95 : gait.stride), K = v * (run ? 1.55 : 0.9 * gait.stride / 0.52);
        Tg.ltX = -A * sn; Tg.rtX = A * sn;
        Tg.lkX = K * (0.1 + 0.9 * Math.max(0, cs)) + (run ? 0.15 * v : 0); Tg.rkX = K * (0.1 + 0.9 * Math.max(0, -cs)) + (run ? 0.15 * v : 0);
        Tg.lfX = -(Tg.ltX + Tg.lkX) * 0.6; Tg.rfX = -(Tg.rtX + Tg.rkX) * 0.6;
        const Bs = v * (run ? 1.0 : gait.armSwing);
        Tg.lsX = Bs * sn; Tg.rsX = -Bs * sn; Tg.lsZ = -a.armOut; Tg.rsZ = a.armOut;
        Tg.leX = -(0.14 + v * (run ? 1.35 : 0.3)); Tg.reX = Tg.leX;
        Tg.spX = v * (run ? 0.3 : 0.06); Tg.spY = 0.1 * v * sn; Tg.hipZ = gait.sway * v * sn * 1.2; Tg.spZ = -Tg.hipZ * 0.6;
        Tg.hdY = -0.5 * Tg.spY; Tg.hdX = run ? -0.15 : 0;
        Tg.rootY = run ? Math.max(0, Math.sin(phase * 2)) * 0.05 : gait.bob * 0.012 * v * Math.abs(cs);
        const idleW = 1 - sstep(0.05, 0.4, v);
        Tg.breath = 1 + 0.018 * Math.sin(t * 2.1) * idleW;
        Tg.hdY += idleW * 0.28 * Math.sin(t * 0.41) * Math.sin(t * 0.17 + 1);
        Tg.hdX += idleW * 0.04 * Math.sin(t * 0.3);
        Tg.spZ += idleW * 0.015 * Math.sin(t * 0.7);
        // ---- acts (v2 poses; motor acts mapped: sweep=wipe, serve=pour, sip/eat=hand to mouth, grab=reach)
        const ao = a.armOut, tau = actT;
        let P: Partial<JointMap> | null = null;
        switch (inp.act) {
          case 'cut': { const k = (tau * 2.1) % 1, sk = k < 0.72 ? k / 0.72 : 1 - (k - 0.72) / 0.28; P = { spX: 0.08, spY: -0.12, rsX: -1.75 + 0.75 * sk, rsZ: ao + 0.2, reX: -0.55 - 0.35 * sk, rhX: 0.35, lsX: -0.85, lsZ: -ao - 0.05, leX: -1.05, hdX: 0.1 + 0.12 * sk, hdY: -0.1 }; break; }
          case 'pour': case 'serve': { const p = 0.5 + 0.5 * Math.sin(tau * 2.4); P = { spY: 0.08, rsX: -1.25, rsZ: ao + 0.4, reX: -1.15, rhZ: -0.2 - 0.55 * p, lsX: -0.9, lsZ: -ao + 0.05, leX: -1.25, hdX: 0.22, hdY: 0.12 }; break; }
          case 'sweep': { const w = tau * 5.2; P = { spX: 0.25, rsX: -1.0 + 0.18 * Math.sin(w), rsZ: ao + 0.1 + 0.28 * Math.cos(w), reX: -0.5, lsX: -0.75, lsZ: -ao, leX: -0.55, hdX: 0.25, lkX: 0.15, rkX: 0.15, ltX: -0.08, rtX: -0.08 }; break; }
          case 'sleep': { const b = Math.sin(t * 1.7), jerk = Math.max(0, Math.sin(t * 0.9) - 0.97) * 12; P = { spX: 0.12 + 0.025 * b, hdX: 0.52 + 0.05 * b - jerk * 0.25, hdZ: 0.2, hdY: 0.08, lsX: 0.06, rsX: 0.06, leX: -0.25, reX: -0.25, lkX: 0.08, rkX: 0.08, breath: 1 + 0.035 * b }; break; }
          case 'phone': { const sw = Math.sin(tau * 1.3); P = { lsX: -0.9, lsZ: -ao - 0.1, leX: -1.9, hdX: 0.35 + 0.03 * sw, hdY: -0.1 }; break; }
          case 'sip': case 'eat': { const k = 0.5 + 0.5 * Math.sin(tau * 1.6); P = { rsX: -0.5 - 0.7 * k, rsZ: ao + 0.1, reX: -1.4 - 0.9 * k, hdX: -0.1 * k }; break; }
          case 'wave': P = { rsZ: 2.45 + 0.3 * Math.sin(tau * 10), rsX: -0.3, reX: -0.35 - 0.25 * Math.sin(tau * 10 + 1), rhZ: 0.3 * Math.sin(tau * 10), hdZ: -0.08, hdY: 0.1 }; break;
          case 'grab': P = { rsX: -1.3, rsZ: ao + 0.1, reX: -0.3, spX: 0.2, hdX: 0.2 }; break;
          case 'sit': P = { ltX: -1.32, rtX: -1.32, lkX: 1.32, rkX: 1.32, lfX: 0, rfX: 0, lsX: -0.5, rsX: -0.5, leX: -0.6, reX: -0.6, lsZ: -ao * 0.7, rsZ: ao * 0.7, spX: -0.02 }; break;
          case 'cheer': { const j = Math.max(0, Math.sin(tau * 7.5)); P = { rootY: 0.17 * j, lsZ: -2.7 - 0.15 * Math.sin(tau * 7.5), rsZ: 2.7 + 0.15 * Math.sin(tau * 7.5), leX: -0.45, reX: -0.45, lsX: -0.2, rsX: -0.2, lkX: 0.45 * (1 - j), rkX: 0.45 * (1 - j), ltX: -0.22 * (1 - j), rtX: -0.22 * (1 - j), hdX: -0.15 }; break; }
          case 'perform': { P = { lsX: -0.9, leX: -1.2, rsX: -0.6, reX: -1.0 + 0.3 * Math.sin(tau * 9), hdY: 0.15 * Math.sin(tau * 2) }; break; }
        }
        if (P) {
          const full = FULL_ACTS[inp.act], wUp = full ? 1 - sstep(0.12, 0.55, v) : 1, wLeg = full ? wUp : 0;
          for (const key in P) { const k = key as JointId; Tg[k] = lerp(Tg[k], P[k] as number, LEGJ[k] ? wLeg : wUp); }
        }
        // ---- carry: arms forward, lean grows with stack height (animasyon-3)
        if (carryW > 0.001) {
          const cw = carryW, h = clamp(inp.carry, 0, 1);
          Tg.lsX = lerp(Tg.lsX, -0.95, cw); Tg.rsX = lerp(Tg.rsX, -0.95, cw); Tg.lsZ = lerp(Tg.lsZ, -ao * 0.6 + 0.04, cw); Tg.rsZ = lerp(Tg.rsZ, ao * 0.6 - 0.04, cw);
          Tg.leX = lerp(Tg.leX, -0.68, cw); Tg.reX = lerp(Tg.reX, -0.68, cw); Tg.lhX = lerp(Tg.lhX, 0, cw); Tg.rhX = lerp(Tg.rhX, 0, cw);
          Tg.spX += -0.1 * h * cw;  // lean back against the stack
        }
        // ---- stop stumble: overshoot spring on sudden stops (toy springiness)
        const decel = (lastSpd - vn) / Math.max(dt, 1e-3); lastSpd = vn;
        if (decel > 3 && stumble.value < 0.03) stumble.vel += 2.2 * Math.min(1, decel / 8);
        Add.spX += stumble.step(0, dt);  // peaks near 5 degrees forward
        // ---- idles after 4-8 s still
        if (v < 0.05 && inp.act === 'idle' && carryW < 0.1) { still += dt; if (still > idleAt) { still = 0; idleAt = 4 + rnd() * 4; const id = pickIdle(rnd()); if (clips.has(id)) a.play(id, { additive: true }); } } else still = 0;
        // ---- clips
        for (let i = slots.length - 1; i >= 0; i--) {
          const s = slots[i];
          s.t += dt * s.speed;
          if (s.t >= s.def.len) { if (s.def.loop) s.t %= s.def.len; else s.fadeOut = true; }
          s.w = s.fadeOut ? s.w - dt / 0.15 : Math.min(1, s.w + dt / 0.15);
          if (s.fadeOut && s.w <= 0) { slots.splice(i, 1); continue; }
          const tt = Math.min(s.t, s.def.len);
          for (const tr in s.def.tracks) {
            const map = TRACK_JOINTS[tr]; if (!map) continue;
            sampleTrack(s.def.tracks[tr], tt, tmp);
            for (let c = 0; c < 3; c++) { const j = map[c]; if (!j) continue; if (s.additive) Add[j] += tmp[c] * s.w; else Tg[j] = lerp(Tg[j], tmp[c], s.w); }
          }
        }
        // ---- smooth toward targets (v2: 1 - exp(-14 dt)), then additive layer on top
        const kk = 1 - Math.exp(-dt * 14);
        for (const k of JOINTS) J[k] += (Tg[k] - J[k]) * kk;
        // pose export
        pose.root.y = J.rootY + Add.rootY; pose.bob = pose.root.y; pose.lean = J.spX + Add.spX; pose.torsoTwist = J.spY + Add.spY;
        pose.head.x = J.hdX + Add.hdX; pose.head.y = J.hdY + Add.hdY; pose.head.z = J.hdZ + Add.hdZ;
        pose.armL.x = J.lsX + Add.lsX; pose.armL.y = J.lsY + Add.lsY; pose.armL.z = J.lsZ + Add.lsZ;
        pose.armR.x = J.rsX + Add.rsX; pose.armR.y = J.rsY + Add.rsY; pose.armR.z = J.rsZ + Add.rsZ;
        pose.legL.x = J.ltX + Add.ltX; pose.legL.z = J.ltZ + Add.ltZ; pose.legR.x = J.rtX + Add.rtX; pose.legR.z = J.rtZ + Add.rtZ;
        return pose;
      },
    };
    return a;
  }
  function pickIdle(r: number): IdleId {
    let s = 0; for (const w of IDLE_W) s += w; r *= s;
    for (let i = 0; i < IDLES.length; i++) { r -= IDLE_W[i]; if (r <= 0) return IDLES[i]; }
    return IDLES[IDLES.length - 1];
  }

  return {
    gaits: GAITS,
    createAnimator,
    spring: createSpring,
    defineClip(c) { clips.set(c.id, c); },
    clip(id) { return clips.get(id); },
    squashPop(o, amount = 1) {
      let s = sq.find(x => x.o === o);
      if (!s) { s = sq.find(x => x.o === null); if (!s) { s = { o: null, sx: 1, sy: 1, sz: 1, v: 0, x: 0 }; sq.push(s); } s.o = o; s.sx = o.scale.x; s.sy = o.scale.y; s.sz = o.scale.z; s.x = 0; s.v = 0; }
      s.x = -0.28 * amount; s.v = 0; // start squashed, the spring pops it past rest and settles
    },
    update(dt) {
      dt = Math.min(Math.max(dt, 0), 0.1);
      for (const s of sq) {
        if (!s.o) continue;
        const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
        for (let i = 0; i < n; i++) { s.v += (-s.x * 420 - s.v * 14) * h; s.x += s.v * h; }
        const y = 1 + s.x, xz = 1 - s.x * 0.5;
        s.o.scale.set(s.sx * xz, s.sy * y, s.sz * xz);
        if (Math.abs(s.x) < 1e-3 && Math.abs(s.v) < 1e-2) { s.o.scale.set(s.sx, s.sy, s.sz); s.o = null; }
      }
    },
  };
}

/** Contract factory (CONTRACT: createAnim(deps): AnimApi). */
export function createAnim(deps: AnimDeps = {}): MotorAnimApi {
  return createAnimApi(deps);
}
