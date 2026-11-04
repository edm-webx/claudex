/**
 * "Canlı iskele anları" view (survey yasam-3, yasam-4, genel-7, genel-8, ses-1): small visible moments on the pier.
 * Never writes sim state. Scheduling is the pure director in sim/moments.ts (seeded view-side Rng); this file only
 * reads the agents SoA (ambient walkers), shows bubbles through the HTML label layer and drives a few tiny meshes.
 * - Chats: two still ambient citizens close together trade 2-4 bubbles (one chat at a time, 25-60 s apart).
 *   Known gap: the sim does not hold them; the chat ends early if one walks off (or leaves the screen).
 * - Events: simit tray tips (simits roll, a gull swoops), a bouncing ball, a rainbow over the sea (~20 s),
 *   a night blackout (lamps off ~1 s + dark veil), a gull stealing a simit.
 * - İskele Radyosu: a transistor radio prop beside the counter, an announcer bubble every ~90 s (tap = next line).
 * Everything hides and cancels while the iskele zone is not warm/hot. Meshes are built once, lazily, and reused:
 * steady state allocates nothing per frame.
 */
import * as T from 'three';
import type { ZoneManager, Vec3, ScreenPt, SoAStore } from '../../../engine/api';
import { createRng } from '../../../engine/core';
import type { HtmlLabels, HtmlLabel } from '../../ui/labels';
import { AGENT_FLAG, ACT_ORDER } from '../../sim/schema';
import { createMomentDirector, createPairSource, type MomentDirector } from '../../sim/moments';
import { EVENT_LINES, MOMENT_TIMING as TM, type MomentEvent } from '../../../content/moments';
import { stageLayout, PIER } from '../../../content/prefabs/iskele/layout';

export interface MomentsViewDeps {
  scene: T.Scene; zones: ZoneManager; labels: HtmlLabels; root: HTMLElement;
  project(p: Vec3, out: ScreenPt): boolean;
  agents(): SoAStore | null;
  crowdHead?(slot: number, out: Vec3): boolean;
  hero(): { x: number; z: number };
  hour(): number; stage(): number;
  camera(): T.Camera | null;
  /** Real-clock hour override for tests; default new Date().getHours(). */
  seed?: number;
}
export interface MomentsView {
  update(dt: number): void;
  dispose(): void;
  /** Test hooks. */
  force(what: 'chat' | 'radio' | MomentEvent, arg?: string): void;
  info(): Record<string, unknown>;
}

const ZONE = 'iskele';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
const A_IDLE = ACT_ORDER.indexOf('idle'), A_SIT = ACT_ORDER.indexOf('sit'), A_PHONE = ACT_ORDER.indexOf('phone'), A_SIP = ACT_ORDER.indexOf('sip');
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Fx { kind: MomentEvent | null; t: number; dur: number; slot: number; ox: number; oz: number; line: string; line2: string }

export function createMomentsView(d: MomentsViewDeps): MomentsView {
  const rng = createRng((d.seed ?? 0x5a17) >>> 0);
  const dir: MomentDirector = createMomentDirector(rng);
  const cands = createPairSource(64);
  const tmp: ScreenPt = { x: 0, y: 0 };
  const at: Vec3 = { x: 0, y: 0, z: 0 };
  const chatLabel: HtmlLabel = d.labels.label();
  const evLabel: HtmlLabel = d.labels.label();
  const radioLabel: HtmlLabel = d.labels.label();
  let candT = 0, live = false, clock = 0;
  const env = { live: false, night: false };

  // ── shared materials (built once)
  const M = {
    white: new T.MeshLambertMaterial({ color: '#f7f4ee' }), grey: new T.MeshLambertMaterial({ color: '#9aa3ad' }),
    beak: new T.MeshLambertMaterial({ color: '#f2a03a' }), simit: new T.MeshLambertMaterial({ color: '#c98a3c' }),
    sesame: new T.MeshLambertMaterial({ color: '#ebc07a' }), tray: new T.MeshLambertMaterial({ color: '#8a5a36' }),
    ballA: new T.MeshLambertMaterial({ color: '#e0533c' }), ballB: new T.MeshLambertMaterial({ color: '#fff6e6' }),
    radio: new T.MeshLambertMaterial({ color: '#2fa39d' }), radioDark: new T.MeshLambertMaterial({ color: '#3b2a20' }),
    chrome: new T.MeshLambertMaterial({ color: '#d8d4cc' }), dial: new T.MeshBasicMaterial({ color: '#ffd23f' }),
  };
  const G = { simit: new T.TorusGeometry(0.11, 0.045, 6, 12), box: new T.BoxGeometry(1, 1, 1), ball: new T.IcosahedronGeometry(0.16, 1), cone: new T.ConeGeometry(0.035, 0.12, 5) };
  const owned: T.Object3D[] = [];
  const add = <O extends T.Object3D>(o: O): O => { o.visible = false; d.scene.add(o); owned.push(o); return o; };
  const boxMesh = (m: T.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => { const b = new T.Mesh(G.box, m); b.scale.set(sx, sy, sz); b.position.set(x, y, z); return b; };

  // ── gull (low-poly: body, head, beak, two flapping wings)
  const gull = add(new T.Group());
  gull.add(boxMesh(M.white, 0.16, 0.14, 0.42));
  gull.add(boxMesh(M.white, 0.13, 0.13, 0.13, 0, 0.08, 0.22));
  const beak = new T.Mesh(G.cone, M.beak); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.07, 0.33); gull.add(beak);
  const wingL = new T.Group(), wingR = new T.Group();
  wingL.add(boxMesh(M.grey, 0.42, 0.03, 0.2, 0.21, 0, 0)); wingR.add(boxMesh(M.grey, 0.42, 0.03, 0.2, -0.21, 0, 0));
  wingL.position.set(0.07, 0.04, 0); wingR.position.set(-0.07, 0.04, 0); gull.add(wingL, wingR);
  const gullSimit = new T.Mesh(G.simit, M.simit); gullSimit.position.set(0, -0.03, 0.4); gullSimit.rotation.x = Math.PI / 2; gull.add(gullSimit);

  // ── simits + tray
  const tray = add(new T.Group());
  tray.add(boxMesh(M.tray, 0.62, 0.04, 0.42));
  const simits: T.Mesh[] = [];
  const sv: { x: number; z: number; vx: number; vz: number; y: number; vy: number; spin: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const s = add(new T.Mesh(G.simit, M.simit));
    const dot = new T.Mesh(G.box, M.sesame); dot.scale.set(0.03, 0.03, 0.03); dot.position.set(0.09, 0, 0.03); s.add(dot);
    simits.push(s); sv.push({ x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, spin: 0 });
  }

  // ── ball
  const ball = add(new T.Group());
  ball.add(new T.Mesh(G.ball, M.ballA));
  const stripe = boxMesh(M.ballB, 0.33, 0.07, 0.33); ball.add(stripe);
  const bv = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0 };

  // ── rainbow (six half-torus bands, fades in/out)
  const RB = ['#e8584a', '#f29a3a', '#f7d64a', '#6cc46a', '#4f9fd8', '#8a6cc8'];
  const rainbow = add(new T.Group());
  const rbMats: T.MeshBasicMaterial[] = [];
  RB.forEach((c, i) => {
    const m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, fog: false });
    rbMats.push(m);
    rainbow.add(new T.Mesh(new T.TorusGeometry(22 - i * 0.9, 0.48, 4, 40, Math.PI), m));
  });
  rainbow.renderOrder = -1;

  // ── radio prop (body, grille, dial, knob, antenna)
  const radio = add(new T.Group());
  radio.add(boxMesh(M.radio, 0.36, 0.22, 0.14, 0, 0.11, 0));
  radio.add(boxMesh(M.radioDark, 0.16, 0.14, 0.02, -0.07, 0.11, 0.075));
  radio.add(boxMesh(M.dial, 0.1, 0.05, 0.02, 0.1, 0.15, 0.075));
  radio.add(boxMesh(M.chrome, 0.05, 0.05, 0.03, 0.1, 0.07, 0.08));
  radio.add(boxMesh(M.radioDark, 0.3, 0.03, 0.03, 0, 0.24, 0));
  const ant = boxMesh(M.chrome, 0.012, 0.42, 0.012, 0.13, 0.43, 0); ant.rotation.z = -0.35; radio.add(ant);
  let radioStage = -1;
  let radioSrc = '', radioHtml = '';
  const radioAt: Vec3 = { x: 0, y: 0, z: 0 };
  const placeRadio = (stage: number) => {
    radioStage = stage;
    const c = stageLayout(stage).counter;
    radioAt.x = c.drop.x + 0.78; radioAt.y = c.drop.y; radioAt.z = c.drop.z;
    radio.position.set(radioAt.x, radioAt.y, radioAt.z);
  };
  radioLabel.onTap = () => dir.forceRadio();

  // ── blackout veil (DOM, built once)
  const veil = document.createElement('div');
  veil.style.cssText = 'position:absolute;inset:0;background:#05060f;opacity:0;pointer-events:none;transition:opacity .08s;z-index:1';
  d.root.appendChild(veil);
  const nightNodes: T.Object3D[] = [];

  const camDir = new T.Vector3();
  const fx: Fx = { kind: null, t: 0, dur: 0, slot: -1, ox: 0, oz: 0, line: '', line2: '' };

  // ── helpers
  const store = () => { try { return d.agents(); } catch { return null; } };
  const usable = (s: SoAStore, i: number) => s.alive(i) && (s.u16('flags')[i] & (AGENT_FLAG.ambient | AGENT_FLAG.visible)) === (AGENT_FLAG.ambient | AGENT_FLAG.visible);
  const headOf = (slot: number, out: Vec3): boolean => {
    const s = store();
    if (!s || slot < 0 || !s.alive(slot)) return false;
    if (d.crowdHead && d.crowdHead(slot, out) && Number.isFinite(out.x)) { out.y += 0.35; return true; }
    out.x = s.f32('x')[slot]; out.y = 2.1; out.z = s.f32('z')[slot]; return true;
  };
  const showAt = (l: HtmlLabel, p: Vec3, text: string, cls = 'say') => { if (d.project(p, tmp)) l.set(tmp.x, tmp.y, text, cls); else l.hide(); };
  const gatherCands = () => {
    cands.count = 0;
    const s = store();
    if (!s) return;
    const X = s.f32('x'), Z = s.f32('z'), SP = s.f32('speed'), act = s.u8('act');
    for (let i = 0, n = s.hi; i < n && cands.count < cands.slot.length; i++) {
      if (!usable(s, i)) continue;
      if (X[i] < PIER.x0 - 1 || X[i] > PIER.x1 + 1 || Z[i] < PIER.z0 - 1 || Z[i] > PIER.z1 + 9) continue;
      at.x = X[i]; at.y = 1.8; at.z = Z[i];
      if (!d.project(at, tmp)) continue;
      const k = cands.count++;
      const a = act[i];
      cands.slot[k] = i; cands.x[k] = X[i]; cands.z[k] = Z[i];
      cands.still[k] = SP[i] < 0.05 && (a === A_IDLE || a === A_SIT || a === A_PHONE || a === A_SIP) ? 1 : 0;
    }
  };
  /** A visible ambient citizen near the hero (any state), or -1. */
  const nearSlot = (wantWalking: boolean, wantStill: boolean): number => {
    const s = store();
    if (!s) return -1;
    const h = d.hero(), X = s.f32('x'), Z = s.f32('z'), SP = s.f32('speed');
    let best = -1, bd = 1e9;
    for (let i = 0, n = s.hi; i < n; i++) {
      if (!usable(s, i)) continue;
      if (wantWalking && SP[i] < 0.3) continue;
      if (wantStill && SP[i] > 0.05) continue;
      const dx = X[i] - h.x, dz = Z[i] - h.z, dd = dx * dx + dz * dz;
      if (dd < bd && dd > 1) { at.x = X[i]; at.y = 1.8; at.z = Z[i]; if (d.project(at, tmp)) { bd = dd; best = i; } }
    }
    return best;
  };
  const pickLine = (k: MomentEvent, i: number) => { const L = EVENT_LINES[k]; return L[Math.min(i, L.length - 1)]; };

  function stopFx() {
    fx.kind = null; gull.visible = false; tray.visible = false; ball.visible = false; rainbow.visible = false;
    for (const s of simits) s.visible = false;
    if (nightNodes.length) { for (const o of nightNodes) o.visible = true; nightNodes.length = 0; }
    veil.style.opacity = '0';
    evLabel.hide();
  }

  function startFx(kind: MomentEvent) {
    stopFx();
    const h = d.hero();
    fx.kind = kind; fx.t = 0; fx.slot = -1; fx.ox = h.x; fx.oz = h.z;
    fx.line = pickLine(kind, 0); fx.line2 = '';
    if (kind === 'simit') {
      fx.dur = 9; fx.slot = nearSlot(true, false);
      if (fx.slot < 0) fx.slot = nearSlot(false, false);
      fx.line = pickLine('simit', rng.int(0, 2));
      tray.visible = true;
      for (let i = 0; i < 4; i++) { simits[i].visible = i < 3 || rng.chance(0.6); sv[i].spin = 0; }
    } else if (kind === 'ball') {
      fx.dur = 7; fx.line = pickLine('ball', rng.int(0, 1)); fx.line2 = pickLine('ball', 2);
      const fromRight = rng.chance(0.5);
      bv.x = fromRight ? PIER.x1 - 0.6 : PIER.x0 + 0.6; bv.z = clamp(h.z + rng.range(-2, 2), PIER.z0 + 1, PIER.z1 - 0.5);
      bv.y = 2.6; bv.vx = (fromRight ? -1 : 1) * rng.range(2.4, 3.2); bv.vz = rng.range(-0.4, 0.4); bv.vy = 0;
      ball.visible = true; fx.slot = nearSlot(false, false);
    } else if (kind === 'rainbow') {
      fx.dur = 20; fx.line = pickLine('rainbow', rng.int(0, 2)); fx.slot = nearSlot(false, false);
      const cam = d.camera();
      let dx = 0, dz = -1;
      if (cam) { cam.getWorldDirection(camDir); const m = Math.hypot(camDir.x, camDir.z); if (m > 1e-3) { dx = camDir.x / m; dz = camDir.z / m; } }
      // farthest spot (over the sea, beyond the camera target) whose arc top still lands in the upper screen
      let dist = 12;
      for (const D of [44, 34, 26, 20, 15, 12]) {
        const r = D * 0.5;
        at.x = h.x + dx * D; at.y = r - 1; at.z = h.z + dz * D;
        if (d.project(at, tmp) && tmp.y > 150 && tmp.y < window.innerHeight * 0.45) { dist = D; break; }
      }
      rainbow.position.set(h.x + dx * dist, -1, h.z + dz * dist);
      rainbow.scale.setScalar(dist * 0.5 / 22);
      rainbow.rotation.set(0, Math.atan2(dx, dz), 0);
      rainbow.visible = true;
    } else if (kind === 'blackout') {
      fx.dur = 3.2; fx.line = pickLine('blackout', rng.int(0, 1)); fx.line2 = pickLine('blackout', 2);
      const root = d.zones.root(ZONE);
      root?.traverse(o => { if (o.userData.night && o.visible) nightNodes.push(o); });
    } else if (kind === 'gullSteal') {
      fx.dur = 6; fx.line = pickLine('gullSteal', rng.int(0, 2));
      fx.slot = nearSlot(false, true);
      if (fx.slot < 0) fx.slot = nearSlot(false, false);
      const s = store();
      if (s && fx.slot >= 0) { fx.ox = s.f32('x')[fx.slot] + 0.35; fx.oz = s.f32('z')[fx.slot] + 0.2; }
      else { fx.ox = h.x + 1.2; fx.oz = h.z + 0.6; }
      simits[0].visible = true; simits[0].position.set(fx.ox, 0.95, fx.oz); simits[0].rotation.set(Math.PI / 2, 0, 0);
    }
  }

  const flap = (t: number, speed = 14) => { const a = Math.sin(t * speed) * 0.7; wingL.rotation.z = a; wingR.rotation.z = -a; };
  /** Gull swoop: from (sx,sy,sz) down to (tx,ty,tz) over [0,1], then away over [1,2]. */
  const swoop = (k: number, tx: number, ty: number, tz: number, carry: boolean) => {
    gull.visible = k >= 0 && k <= 2;
    if (!gull.visible) return;
    const sx = tx - 7, sy = ty + 6, sz = tz - 4;
    let x: number, y: number, z: number;
    if (k <= 1) { const e = 1 - (1 - k) * (1 - k); x = sx + (tx - sx) * k; z = sz + (tz - sz) * k; y = sy + (ty + 0.15 - sy) * e; }
    else { const e = (k - 1); x = tx + e * 8; z = tz + e * 5; y = ty + 0.15 + e * e * 8; }
    const px = gull.position.x, pz = gull.position.z;
    gull.position.set(x, y, z);
    if (Math.abs(x - px) + Math.abs(z - pz) > 1e-4) gull.rotation.y = Math.atan2(x - px, z - pz);
    gullSimit.visible = carry && k > 1;
    flap(clock, k > 0.8 && k < 1.2 ? 22 : 12);
  };

  function updateFx(dt: number) {
    if (!fx.kind) return;
    fx.t += dt;
    const t = fx.t;
    if (t >= fx.dur) { stopFx(); return; }
    let bubbleAt: Vec3 | null = null;
    let line = fx.line;
    if (fx.kind === 'simit') {
      const s = store();
      const hasCarrier = s && fx.slot >= 0 && s.alive(fx.slot);
      if (t < 1.4) {
        // tray rides on the carrier's head, wobbling more and more
        if (hasCarrier && headOf(fx.slot, at)) { tray.position.set(at.x, at.y - 0.2, at.z); }
        else tray.position.set(fx.ox + 1.5, 1.9, fx.oz + 0.5);
        tray.rotation.z = Math.sin(t * 9) * 0.08 * (1 + t * 2);
        for (let i = 0; i < 4; i++) { simits[i].position.set(tray.position.x - 0.2 + i * 0.13, tray.position.y + 0.05, tray.position.z + ((i & 1) ? 0.08 : -0.08)); simits[i].rotation.set(Math.PI / 2, 0, 0); }
        fx.ox = tray.position.x; fx.oz = tray.position.z;
        if (t + dt >= 1.4) for (let i = 0; i < 4; i++) { const a = rng.range(0, Math.PI * 2), v = rng.range(1.2, 2.4); sv[i].x = simits[i].position.x; sv[i].z = simits[i].position.z; sv[i].y = simits[i].position.y; sv[i].vx = Math.cos(a) * v; sv[i].vz = Math.sin(a) * v; sv[i].vy = rng.range(1, 2); }
      } else {
        tray.rotation.z = Math.min(1.4, tray.rotation.z + dt * 4);
        if (t > 2.2) tray.visible = false;
        for (let i = 0; i < 4; i++) {
          const p = sv[i];
          if (!simits[i].visible) continue;
          p.vy -= 9.8 * dt; p.y += p.vy * dt;
          if (p.y < 0.11) { p.y = 0.11; p.vy = 0; }
          p.x = clamp(p.x + p.vx * dt, PIER.x0 + 0.3, PIER.x1 - 0.3); p.z = clamp(p.z + p.vz * dt, PIER.z0 + 0.3, PIER.z1 + 8);
          const fr = Math.max(0, 1 - dt * 0.45); p.vx *= fr; p.vz *= fr;
          p.spin += Math.hypot(p.vx, p.vz) * dt / 0.11;
          simits[i].position.set(p.x, p.y, p.z);
          // rolling on edge: stand the ring up, spin around its axle
          simits[i].rotation.set(0, Math.atan2(p.vx, p.vz) + Math.PI / 2, 0);
          simits[i].rotateZ(p.spin);
        }
        // a gull swoops for simit 0 and flies off with it
        const k = (t - 3.4) / 1.4;
        swoop(k, sv[0].x, sv[0].y, sv[0].z, true);
        if (k > 1) simits[0].visible = false;
        if (t > 7.4) for (const sm of simits) sm.visible = false;
      }
      if (hasCarrier && headOf(fx.slot, at)) bubbleAt = at; else { at.x = fx.ox; at.y = 2.3; at.z = fx.oz; bubbleAt = at; }
      if (t > 4.6) line = pickLine('gullSteal', 2);
    } else if (fx.kind === 'ball') {
      bv.vy -= 9.8 * dt; bv.y += bv.vy * dt;
      if (bv.y < 0.16) { bv.y = 0.16; bv.vy = Math.abs(bv.vy) * 0.72; if (bv.vy < 0.6) bv.vy = 0; }
      bv.x += bv.vx * dt; bv.z += bv.vz * dt;
      if (bv.x < PIER.x0 + 0.3 || bv.x > PIER.x1 - 0.3) bv.vx = -bv.vx * 0.6;
      const fr = Math.max(0, 1 - dt * 0.25); bv.vx *= fr; bv.vz *= fr;
      ball.position.set(bv.x, bv.y, bv.z);
      ball.rotation.z -= bv.vx * dt / 0.16; ball.rotation.x += bv.vz * dt / 0.16;
      if (fx.slot >= 0 && t > 2.5 && headOf(fx.slot, at)) { bubbleAt = at; line = fx.line2; }
      else { at.x = bv.x; at.y = bv.y + 1.2; at.z = bv.z; bubbleAt = t < 2.5 ? at : null; }
      if (t > fx.dur - 0.5) ball.visible = false;
    } else if (fx.kind === 'rainbow') {
      const a = Math.min(1, t / 2.5, (fx.dur - t) / 2.5) * 0.55;
      for (const m of rbMats) m.opacity = a;
      if (t < 5 && fx.slot >= 0 && headOf(fx.slot, at)) bubbleAt = at;
    } else if (fx.kind === 'blackout') {
      // off 0.15, on 0.1, off 1.0, back on
      const off = (t < 0.15) || (t > 0.25 && t < 1.25);
      for (const o of nightNodes) o.visible = !off;
      veil.style.opacity = off ? '0.38' : '0';
      const h = d.hero(); at.x = h.x; at.y = 2.3; at.z = h.z; bubbleAt = at;
      if (t > 1.3) line = fx.line2;
    } else if (fx.kind === 'gullSteal') {
      const k = (t - 0.6) / 1.5;
      swoop(k, fx.ox, 0.95, fx.oz, true);
      if (k > 1) simits[0].visible = false;
      if (t > 1.9) {
        if (fx.slot >= 0 && headOf(fx.slot, at)) bubbleAt = at; else { at.x = fx.ox; at.y = 2; at.z = fx.oz; bubbleAt = at; }
      }
    }
    if (bubbleAt) showAt(evLabel, bubbleAt, line); else evLabel.hide();
  }


  const view: MomentsView = {
    update(dt) {
      clock += dt;
      const st = d.zones.state(ZONE);
      const nowLive = st === 'warm' || st === 'hot';
      if (!nowLive && live) { stopFx(); chatLabel.hide(); radioLabel.hide(); radio.visible = false; }
      live = nowLive;
      const h = d.hour();
      env.live = live; env.night = h >= 20 || h < 6;
      candT -= dt;
      if (live && candT <= 0) { candT = 0.5; gatherCands(); }
      const f = dir.update(dt, env, cands);
      if (!live) return;
      // radio prop + bubble
      const stg = d.stage();
      if (stg !== radioStage) placeRadio(stg);
      radio.visible = true;
      const talking = !!f.radio;
      const bob = talking ? 1 + Math.abs(Math.sin(clock * 11)) * 0.06 : 1;
      radio.scale.set(bob, 2 - bob, bob);
      if (f.radio) { at.x = radioAt.x; at.y = radioAt.y + 0.85; at.z = radioAt.z; if (f.radioChanged || radioSrc !== f.radio) { radioSrc = f.radio; radioHtml = esc(f.radio); try { d.root.dispatchEvent(new CustomEvent('sb:radio', { detail: f.radio })); } catch { /* ses: İskele Radyosu jingle (audio-map) */ } } showAt(radioLabel, at, radioHtml, 'say tap'); }
      else radioLabel.hide();
      // chat
      const c = f.chat;
      if (c) {
        const s = store();
        if (!s || !usable(s, c.a) || !usable(s, c.b) || Math.hypot(s.f32('x')[c.a] - s.f32('x')[c.b], s.f32('z')[c.a] - s.f32('z')[c.b]) > 6) { dir.cancelChat(); chatLabel.hide(); }
        else {
          const ln = c.def.lines[c.line];
          const slot = ln[0] === 'a' ? c.a : c.b;
          if (headOf(slot, at)) showAt(chatLabel, at, ln[1]); else chatLabel.hide();
        }
      } else chatLabel.hide();
      // events
      if (f.event) startFx(f.event);
      updateFx(dt);
    },
    force(what, arg) {
      if (what === 'chat') { candT = 0; dir.forceChat(); }
      else if (what === 'radio') dir.forceRadio(arg);
      else dir.forceEvent(what);
    },
    info() {
      const f = dir.frame;
      return { live, cands: cands.count, chat: f.chat ? { id: f.chat.def.id, a: f.chat.a, b: f.chat.b, line: f.chat.line } : null, radio: f.radio, event: fx.kind, eventT: fx.t, radioPos: { ...radioAt }, rainbow: rainbow.visible ? { x: rainbow.position.x, z: rainbow.position.z, s: rainbow.scale.x, a: rbMats[0].opacity } : null };
    },
    dispose() {
      stopFx();
      chatLabel.free(); evLabel.free(); radioLabel.free();
      for (const o of owned) d.scene.remove(o);
      for (const g of Object.values(G)) g.dispose();
      for (const m of Object.values(M)) m.dispose();
      for (const m of rbMats) m.dispose();
      rainbow.traverse(o => { const m = o as T.Mesh; if (m.isMesh && m.geometry !== G.box) m.geometry.dispose(); });
      veil.remove();
    },
  };
  return view;
}
