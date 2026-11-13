/**
 * engine/fx: effect building blocks (MOTOR §14). Owner: Builder C.
 * One pooled particle buffer drawn as ONE instanced, camera-facing quad mesh (1 draw call for all effects).
 * Sprites come from a 4x4 canvas atlas (`FX_SPRITES`); a dressing slot 'tex.fx.atlas' can replace it later.
 *
 * Decisions (contract silent):
 * - CPU particle sim in typed arrays (no per-frame allocation); live cap = tier.particles (200/500/1000), extra
 *   spawns are dropped, never queued.
 * - Emitters: burst (count at start), stream (rate/s for `duration` s or until stop()), ring (count on a circle,
 *   pushed outward), trail (rate per metre moved while following an Object3D). Shapes point/disc(size.x radius)/box.
 * - colorOverLife colours are lerped in sRGB-ish hex space; alpha in stops. sizeOverLife in metres.
 * - `flash` adds one big additive-looking quad (no light: keeps draw calls and shader variants fixed).
 * - `wind` pushes +x by scale * gust(t); per-zone wind can be set with `setWind(x, z)`.
 * - Headless (no canvas): a 1x1 white texture; everything else still runs (unit-testable in Node).
 */
import * as T from 'three';
import type { EffectDef, Fx, FxDeps, FxHandle, TierDef, Vec3, ModuleBlock, EmitterBlock } from '../api';

export const FX_SPRITES = { dot: 0, puff: 1, seed: 2, feather: 3, drop: 4, star: 5, rect: 6, heart: 7, z: 8, flake: 9, ring: 10, flash: 11 } as const;
export type FxSprite = keyof typeof FX_SPRITES;
const CAP_MAX = 1000;

function makeAtlas(): T.Texture {
  try {
    if (typeof document === 'undefined') throw new Error('headless');
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); if (!g) throw new Error('no 2d');
    const cell = (i: number, draw: (g: CanvasRenderingContext2D) => void) => { g.save(); g.translate((i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32); draw(g); g.restore(); };
    const radial = (r: number, a0: number) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, `rgba(255,255,255,${a0})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); };
    g.fillStyle = '#fff';
    cell(0, () => radial(30, 1));
    cell(1, () => { radial(30, 0.85); g.globalAlpha = 0.5; for (const [x, y, r] of [[-9, -5, 14], [8, -7, 13], [2, 8, 15]]) { g.save(); g.translate(x, y); radial(r, 0.7); g.restore(); } g.globalAlpha = 1; });
    cell(2, () => { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2); g.fill(); });
    cell(3, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -28); g.quadraticCurveTo(16, -4, 2, 26); g.quadraticCurveTo(-14, -2, 0, -28); g.fill(); g.strokeStyle = 'rgba(160,170,180,0.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(4, 0, 1, 28); g.stroke(); });
    cell(4, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(14, 6, 0, 18); g.quadraticCurveTo(-14, 6, 0, -26); g.fill(); });
    cell(5, () => { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 9 : 28; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); radial(14, 1); });
    cell(6, () => { g.fillStyle = '#fff'; g.fillRect(-14, -8, 28, 16); });
    cell(7, () => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 24); g.bezierCurveTo(-34, 0, -16, -26, 0, -10); g.bezierCurveTo(16, -26, 34, 0, 0, 24); g.fill(); });
    cell(8, () => { g.fillStyle = '#fff'; g.font = '900 52px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', 0, 2); });
    cell(9, () => { g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(-24, 0); g.lineTo(24, 0); g.stroke(); } });
    cell(10, () => { g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 24, 0, Math.PI * 2); g.stroke(); });
    cell(11, () => radial(31, 0.9));
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  } catch {
    const t = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t;
  }
}

const VERT = /* glsl */`
attribute vec4 iPos;   // xyz, size
attribute vec4 iCol;   // rgb, alpha
attribute vec2 iMisc;  // rotation, frame
varying vec2 vUv; varying vec4 vCol;
#include <fog_pars_vertex>
void main() {
  float c = cos(iMisc.x), s = sin(iMisc.x);
  vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * iPos.w;
  vec4 mvPosition = modelViewMatrix * vec4(iPos.xyz, 1.0);
  mvPosition.xy += q;
  gl_Position = projectionMatrix * mvPosition;
  float f = iMisc.y;
  vUv = (vec2(mod(f, 4.0), 3.0 - floor(f / 4.0)) + uv) * 0.25;
  vCol = iCol;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
uniform sampler2D map;
varying vec2 vUv; varying vec4 vCol;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
  if (gl_FragColor.a < 0.01) discard;
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

interface Compiled {
  def: EffectDef;
  life: [number, number];
  vel: { dir: Vec3; spread: number; speed: [number, number] } | null;
  g: number; drag: number; wind: number;
  col: { t: number; r: number; g: number; b: number; a: number }[];
  size: [number, number][];
  spin: [number, number];
  frames: number[];
  flash: { r: number; g: number; b: number; intensity: number; dur: number } | null;
}
interface Inst {
  c: Compiled; at: T.Vector3; follow: T.Object3D | null; t: number; scale: number; stopped: boolean; alive: boolean;
  acc: number[]; last: T.Vector3; gen: number; handle: FxHandle; childT: number[]; burstDone: boolean;
}

const tmpC = new T.Color();
function compile(d: EffectDef): Compiled {
  const c: Compiled = { def: d, life: d.life, vel: null, g: 0, drag: 0, wind: 0, col: [{ t: 0, r: 1, g: 1, b: 1, a: 1 }, { t: 1, r: 1, g: 1, b: 1, a: 0 }], size: [[0, 0.1], [1, 0.1]], spin: [0, 0], frames: [0], flash: null };
  for (const m of d.modules as ModuleBlock[]) {
    switch (m.kind) {
      case 'velocity': c.vel = { dir: m.dir, spread: m.spread, speed: m.speed }; break;
      case 'gravity': c.g = m.g; break;
      case 'drag': c.drag = m.k; break;
      case 'wind': c.wind = m.scale; break;
      case 'colorOverLife': c.col = m.stops.map(([t, hex, a]) => { tmpC.set(hex); return { t, r: tmpC.r, g: tmpC.g, b: tmpC.b, a }; }); break;
      case 'sizeOverLife': c.size = m.stops; break;
      case 'spin': c.spin = m.speed; break;
      case 'sprite': c.frames = m.frames.length ? m.frames : [0]; break;
      case 'flash': tmpC.set(m.color); c.flash = { r: tmpC.r, g: tmpC.g, b: tmpC.b, intensity: m.intensity, dur: m.dur }; break;
    }
  }
  return c;
}

/** Deterministic view-side rng for particle variety (never the sim rng). */
function mkRng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export interface MotorFx extends Fx {
  readonly object: T.Mesh;
  setWind(x: number, z: number): void;
  /** Stop every instance and clear particles (zone leave, tests). */
  clear(): void;
  capacity(): number;
}

export function createFx(deps: FxDeps): MotorFx {
  const defs = new Map<string, Compiled>();
  const rnd = mkRng(7331);
  // particle SoA
  const px = new Float32Array(CAP_MAX), py = new Float32Array(CAP_MAX), pz = new Float32Array(CAP_MAX);
  const vx = new Float32Array(CAP_MAX), vy = new Float32Array(CAP_MAX), vz = new Float32Array(CAP_MAX);
  const age = new Float32Array(CAP_MAX), life = new Float32Array(CAP_MAX), rot = new Float32Array(CAP_MAX), spin = new Float32Array(CAP_MAX), frame = new Float32Array(CAP_MAX), sizeK = new Float32Array(CAP_MAX);
  const owner: (Compiled | null)[] = new Array(CAP_MAX).fill(null);
  let n = 0, cap = 500, tierScale = 1, tierIdx = 1, clock = 0, windX = 1, windZ = 0;
  const insts: Inst[] = [];
  const geo = new T.InstancedBufferGeometry();
  const quad = new T.PlaneGeometry(1, 1);
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  const aPos = new T.InstancedBufferAttribute(new Float32Array(CAP_MAX * 4), 4).setUsage(T.DynamicDrawUsage);
  const aCol = new T.InstancedBufferAttribute(new Float32Array(CAP_MAX * 4), 4).setUsage(T.DynamicDrawUsage);
  const aMisc = new T.InstancedBufferAttribute(new Float32Array(CAP_MAX * 2), 2).setUsage(T.DynamicDrawUsage);
  geo.setAttribute('iPos', aPos); geo.setAttribute('iCol', aCol); geo.setAttribute('iMisc', aMisc);
  geo.instanceCount = 0;
  const mat = new T.ShaderMaterial({
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { map: { value: null } }]),
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
  });
  mat.uniforms.map.value = makeAtlas();
  // plain Mesh + InstancedBufferGeometry: the instance count comes from geo.instanceCount (no instanceMatrix).
  const mesh = new T.Mesh(geo, mat);
  mesh.name = 'fx-particles'; mesh.frustumCulled = false; mesh.renderOrder = 5; mesh.userData.parity = 'dyn';
  deps.scene.add(mesh);

  function setTier(t: TierDef) {
    cap = Math.min(CAP_MAX, t.particles); tierIdx = t.name === 'akici' ? 0 : t.name === 'dengeli' ? 1 : 2;
    tierScale = 1; if (n > cap) n = cap;
  }
  setTier(deps.quality.current());

  function spawn(c: Compiled, inst: Inst, e: EmitterBlock, k: number, count: number) {
    if (n >= cap) return false;
    const i = n++;
    const sx = (e.size?.x ?? 0.1) * inst.scale, sz = (e.size?.z ?? sx) * inst.scale, sy = (e.size?.y ?? 0) * inst.scale;
    let ox = 0, oy = 0, oz = 0;
    if (e.shape === 'disc' || e.kind === 'ring') { const a = e.kind === 'ring' ? (k / Math.max(1, count)) * Math.PI * 2 : rnd() * Math.PI * 2, r = e.kind === 'ring' ? sx : Math.sqrt(rnd()) * sx; ox = Math.cos(a) * r; oz = Math.sin(a) * r; }
    else if (e.shape === 'box') { ox = (rnd() - 0.5) * sx; oy = (rnd() - 0.5) * sy; oz = (rnd() - 0.5) * sz; }
    px[i] = inst.at.x + ox; py[i] = inst.at.y + oy; pz[i] = inst.at.z + oz;
    const v = c.vel;
    if (v) {
      const sp = (v.speed[0] + rnd() * (v.speed[1] - v.speed[0])) * inst.scale;
      let dx = v.dir.x + (rnd() - 0.5) * 2 * v.spread, dy = v.dir.y + (rnd() - 0.5) * 2 * v.spread, dz = v.dir.z + (rnd() - 0.5) * 2 * v.spread;
      if (e.kind === 'ring') { const l = Math.hypot(ox, oz) || 1; dx += ox / l; dz += oz / l; }
      const l = Math.hypot(dx, dy, dz) || 1; vx[i] = dx / l * sp; vy[i] = dy / l * sp; vz[i] = dz / l * sp;
    } else { vx[i] = vy[i] = vz[i] = 0; }
    age[i] = 0; life[i] = c.life[0] + rnd() * (c.life[1] - c.life[0]);
    rot[i] = rnd() * Math.PI * 2; spin[i] = c.spin[0] + rnd() * (c.spin[1] - c.spin[0]); if (rnd() < 0.5) spin[i] = -spin[i];
    frame[i] = c.frames[(rnd() * c.frames.length) | 0]; sizeK[i] = inst.scale * (0.8 + rnd() * 0.4);
    owner[i] = c;
    return true;
  }
  function flashP(c: Compiled, inst: Inst) {
    if (!c.flash || n >= cap) return;
    const i = n++;
    px[i] = inst.at.x; py[i] = inst.at.y; pz[i] = inst.at.z; vx[i] = vy[i] = vz[i] = 0; age[i] = 0; life[i] = c.flash.dur; rot[i] = 0; spin[i] = 0; frame[i] = 11; sizeK[i] = -c.flash.intensity * inst.scale; owner[i] = c;
  }

  function startInst(c: Compiled, at: Vec3 | T.Object3D, scale: number): Inst {
    const follow = (at as T.Object3D).isObject3D ? at as T.Object3D : null;
    const pos = new T.Vector3();
    if (follow) follow.getWorldPosition(pos); else pos.set((at as Vec3).x, (at as Vec3).y, (at as Vec3).z);
    const inst: Inst = {
      c, at: pos, follow, t: 0, scale, stopped: false, alive: true, acc: c.def.emitters.map(() => 0), last: pos.clone(), gen: 0, childT: (c.def.children || []).map(ch => ch.delay), burstDone: false,
      handle: null as unknown as FxHandle,
    };
    inst.handle = {
      get alive() { return inst.alive; },
      stop() { inst.stopped = true; },
      moveTo(p: Vec3) { inst.at.set(p.x, p.y, p.z); },
    };
    insts.push(inst);
    return inst;
  }

  const fx: MotorFx = {
    object: mesh,
    define(d) { defs.set(d.id, compile(d)); },
    redefine(d) { defs.set(d.id, compile(d)); for (const i of insts) if (i.c.def.id === d.id) i.c = defs.get(d.id) as Compiled; },
    has(id) { return defs.has(id); },
    play(id, at, opts) {
      const c = defs.get(id);
      if (!c) { const dead: FxHandle = { alive: false, stop() {}, moveTo() {} }; return dead; }
      return startInst(c, at, opts?.scale ?? 1).handle;
    },
    setTier,
    setWind(x, z) { windX = x; windZ = z; },
    live: () => n,
    capacity: () => cap,
    clear() { n = 0; for (const i of insts) i.alive = false; insts.length = 0; geo.instanceCount = 0; },
    update(dt) {
      dt = Math.min(Math.max(dt, 0), 0.1); clock += dt;
      // ---- emit
      for (let k = insts.length - 1; k >= 0; k--) {
        const inst = insts[k], c = inst.c, d = c.def;
        if (inst.follow) inst.follow.getWorldPosition(inst.at);
        const ts = d.tierScale ? d.tierScale[tierIdx] : 1;
        if (!inst.burstDone) {
          inst.burstDone = true; flashP(c, inst);
          d.emitters.forEach(e => { if (e.kind === 'burst' || e.kind === 'ring') { const cnt = Math.max(1, Math.round((e.count ?? 10) * ts * tierScale)); for (let j = 0; j < cnt; j++) spawn(c, inst, e, j, cnt); } });
        }
        const running = !inst.stopped && (d.duration == null || inst.t < d.duration);
        if (running) d.emitters.forEach((e, ei) => {
          if (e.kind === 'stream') { inst.acc[ei] += (e.rate ?? 10) * ts * tierScale * dt; }
          else if (e.kind === 'trail') { inst.acc[ei] += (e.rate ?? 10) * ts * tierScale * inst.at.distanceTo(inst.last); }
          else return;
          while (inst.acc[ei] >= 1) { inst.acc[ei] -= 1; spawn(c, inst, e, 0, 1); }
        });
        inst.last.copy(inst.at);
        // children
        if (d.children) for (let j = 0; j < d.children.length; j++) if (inst.childT[j] >= 0) { inst.childT[j] -= dt; if (inst.childT[j] < 0) { const cc = defs.get(d.children[j].effect); if (cc) startInst(cc, inst.at.clone(), inst.scale); } }
        inst.t += dt;
        const hasStream = d.emitters.some(e => e.kind === 'stream' || e.kind === 'trail');
        const childrenPending = inst.childT.some(v => v >= 0);
        if ((!hasStream || !running) && !childrenPending) { inst.alive = false; insts.splice(k, 1); }
      }
      // ---- simulate + write instances (swap-remove dead)
      const P = aPos.array as Float32Array, Cc = aCol.array as Float32Array, M = aMisc.array as Float32Array;
      const gust = 0.6 + 0.4 * Math.sin(clock * 1.3) * Math.sin(clock * 0.37);
      for (let i = 0; i < n; i++) {
        let c = owner[i] as Compiled;
        age[i] += dt;
        while (age[i] >= life[i] && i < n) {
          const last = --n;
          if (i === last) break;
          px[i] = px[last]; py[i] = py[last]; pz[i] = pz[last]; vx[i] = vx[last]; vy[i] = vy[last]; vz[i] = vz[last];
          age[i] = age[last] + dt; life[i] = life[last]; rot[i] = rot[last]; spin[i] = spin[last]; frame[i] = frame[last]; sizeK[i] = sizeK[last]; owner[i] = owner[last];
          c = owner[i] as Compiled;
        }
        if (i >= n) break;
        const isFlash = sizeK[i] < 0;
        if (!isFlash) {
          vy[i] += c.g * dt;
          if (c.drag) { const f = Math.exp(-c.drag * dt); vx[i] *= f; vy[i] *= f; vz[i] *= f; }
          if (c.wind) { vx[i] += windX * c.wind * gust * dt; vz[i] += windZ * c.wind * gust * dt; }
          px[i] += vx[i] * dt; py[i] += vy[i] * dt; pz[i] += vz[i] * dt;
          if (py[i] < 0.01 && c.g < 0) { py[i] = 0.01; vy[i] *= -0.25; vx[i] *= 0.6; vz[i] *= 0.6; }
          rot[i] += spin[i] * dt;
        }
        const u = Math.min(1, age[i] / life[i]);
        // colour/size over life
        let r = 1, g = 1, b = 1, a = 1;
        if (isFlash && c.flash) { r = c.flash.r; g = c.flash.g; b = c.flash.b; a = 1 - u; }
        else {
          const st = c.col; let j = 0; while (j < st.length - 2 && st[j + 1].t < u) j++;
          const s0 = st[j], s1 = st[Math.min(j + 1, st.length - 1)], w = s1.t > s0.t ? Math.min(1, Math.max(0, (u - s0.t) / (s1.t - s0.t))) : 0;
          r = s0.r + (s1.r - s0.r) * w; g = s0.g + (s1.g - s0.g) * w; b = s0.b + (s1.b - s0.b) * w; a = s0.a + (s1.a - s0.a) * w;
        }
        let size: number;
        if (isFlash) size = -sizeK[i] * (0.6 + 0.6 * u);
        else {
          const ss = c.size; let j = 0; while (j < ss.length - 2 && ss[j + 1][0] < u) j++;
          const s0 = ss[j], s1 = ss[Math.min(j + 1, ss.length - 1)], w = s1[0] > s0[0] ? Math.min(1, Math.max(0, (u - s0[0]) / (s1[0] - s0[0]))) : 0;
          size = (s0[1] + (s1[1] - s0[1]) * w) * sizeK[i];
        }
        const o4 = i * 4, o2 = i * 2;
        P[o4] = px[i]; P[o4 + 1] = py[i]; P[o4 + 2] = pz[i]; P[o4 + 3] = size;
        Cc[o4] = r; Cc[o4 + 1] = g; Cc[o4 + 2] = b; Cc[o4 + 3] = a;
        M[o2] = rot[i]; M[o2 + 1] = frame[i];
      }
      geo.instanceCount = n; mesh.visible = n > 0;
      aPos.needsUpdate = aCol.needsUpdate = aMisc.needsUpdate = true;
      aPos.addUpdateRange(0, n * 4); aCol.addUpdateRange(0, n * 4); aMisc.addUpdateRange(0, n * 2);
      if (deps.perf) deps.perf.count('fx.live', n);
    },
  };
  return fx;
}
