/**
 * engine/input: floating joystick anywhere on the canvas (v2 port: 46 px radius, 96 px ring), WASD/arrows,
 * taps on 3D icons via the screen-space picker, pinch + wheel zoom, left/right hand setting, test injection.
 * Owner: Builder A. The dwell registry lives in ./interactions.ts (pure) and is re-exported here.
 * Decisions:
 * - Joystick screen dy maps to world +z, like v2 inputVec; the camera orbit does not change it.
 * - Tap = pointer moved < 12 px and released < 350 ms after down (v2). pickId comes from setPicker's resolver.
 * - pinch is a multiplicative zoom delta accumulated since the last poll (1 = none): >1 zooms out (v2: zoom *= d0/d).
 * - `hand` only affects UI layout (D reads it); joystick stays floating for both hands.
 */
import type { Input, InputDeps, InputState, TapEvent, Vec2, ScreenPt, Disposer } from '../api';
import { createInteractions } from './interactions';
export { createInteractions } from './interactions';

const R0 = 46;
const JOY_CSS = '.sb-joy{position:fixed;left:0;top:0;width:96px;height:96px;margin:-48px 0 0 -48px;border-radius:50%;background:rgba(255,255,255,.18);border:3px solid rgba(255,255,255,.55);pointer-events:none;z-index:3}.sb-joy[hidden]{display:none}.sb-joy-k{position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,255,255,.85);box-shadow:0 2px 6px rgba(0,0,0,.25)}';

export function createInput(deps: InputDeps): Input {
  const { canvas, root, platform } = deps;
  const interactions = createInteractions();
  const doc = canvas.ownerDocument;
  const joy = doc.createElement('div');
  joy.className = 'sb-joy'; joy.innerHTML = '<div class="sb-joy-k"></div>'; joy.hidden = true;
  const style = doc.createElement('style'); style.textContent = JOY_CSS;
  doc.head.appendChild(style); root.appendChild(joy);
  const knob = joy.firstChild as HTMLElement;

  const st: InputState = { move: { x: 0, z: 0 }, moving: false, taps: [], pinch: 1, orbit: 0, hand: 'right' };
  let pid: number | null = null, sx = 0, sy = 0, jdx = 0, jdy = 0, moved = 0, downAt = 0;
  const pts = new Map<number, ScreenPt>();
  let pinchD = 0;
  let zoomAcc = 1;
  let orbitAcc = 0, tiltAcc = 0, twistA = 0, midX: number | null = null, midY: number | null = null, midMoved = 0, recenterReq = false;
  const angleOf = (a: ScreenPt, b: ScreenPt) => Math.atan2(b.y - a.y, b.x - a.x);
  const keys: Record<string, boolean> = {};
  let injected: Vec2 | null = null;
  let picker: (p: ScreenPt) => string | null = () => null;
  const tapSubs = new Set<(e: TapEvent) => void>();
  const pending: TapEvent[] = [];

  const offs: Disposer[] = [];
  const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, ev: string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
    el.addEventListener(ev, fn, opts); offs.push(() => el.removeEventListener(ev, fn, opts));
  };
  const resetJoy = () => { pid = null; jdx = jdy = 0; joy.hidden = true; };

  on(canvas, 'pointerdown', (e: PointerEvent) => {
    try { platform.audioCtx()?.resume?.(); } catch { /* ignore */ }
    if (e.button === 1) { e.preventDefault(); midX = e.clientX; midY = e.clientY; midMoved = 0; return; }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); twistA = angleOf(a, b); resetJoy(); return; }
    if (pid !== null) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; moved = 0; downAt = platform.clock.now();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    joy.style.left = sx + 'px'; joy.style.top = sy + 'px'; knob.style.transform = '';
  });
  on(canvas, 'pointermove', (e: PointerEvent) => {
    if (midX !== null) { if (e.buttons & 4) { const dx = e.clientX - midX, dy = e.clientY - (midY ?? e.clientY); orbitAcc += dx * 0.008; tiltAcc -= dy * 0.006; midMoved += Math.abs(dx) + Math.abs(dy); midX = e.clientX; midY = e.clientY; } else { midX = null; midY = null; } return; }
    if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchD > 0 && pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      zoomAcc *= pinchD / d; pinchD = d;
      const ang = angleOf(a, b); let da = ang - twistA; da = Math.atan2(Math.sin(da), Math.cos(da)); orbitAcc += da; twistA = ang;
      return;
    }
    if (e.pointerId !== pid) return;
    let dx = e.clientX - sx, dy = e.clientY - sy;
    const m = Math.hypot(dx, dy); moved = Math.max(moved, m);
    if (m > R0) { dx = dx / m * R0; dy = dy / m * R0; }
    jdx = dx / R0; jdy = dy / R0;
    if (moved > 8) { joy.hidden = false; knob.style.transform = `translate(${dx}px,${dy}px)`; }
  });
  const end = (e: PointerEvent) => {
    if (midX !== null) { if (midMoved < 4) recenterReq = true; midX = null; midY = null; return; }
    pts.delete(e.pointerId);
    if (pts.size < 2) pinchD = 0;
    if (e.pointerId !== pid) return;
    const tap = moved < 12 && platform.clock.now() - downAt < 350;
    resetJoy();
    if (tap) {
      const screen = { x: e.clientX, y: e.clientY };
      let pickId: string | null = null;
      try { pickId = picker(screen); } catch { pickId = null; }
      const ev: TapEvent = { screen, t: platform.clock.now(), pickId };
      pending.push(ev);
      for (const cb of [...tapSubs]) { try { cb(ev); } catch (err) { console.error('[input] tap cb', err); } }
    }
  };
  on(canvas, 'pointerup', end);
  on(canvas, 'pointercancel', end);
  on(canvas, 'auxclick', (e: Event) => e.preventDefault());
  on(canvas, 'wheel', (e: WheelEvent) => { zoomAcc *= 1 + Math.sign(e.deltaY) * 0.08; e.preventDefault(); }, { passive: false });
  const win = doc.defaultView;
  if (win) {
    on(win, 'keydown', (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); keys[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    });
    on(win, 'keyup', (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; });
    on(win, 'blur', () => { for (const k in keys) keys[k] = false; resetJoy(); pts.clear(); pinchD = 0; });
  }

  const compute = () => {
    let x: number, z: number;
    if (injected) { x = injected.x; z = injected.z; }
    else {
      x = jdx; z = jdy;
      if (keys.a || keys.arrowleft) x -= 1;
      if (keys.d || keys.arrowright) x += 1;
      if (keys.w || keys.arrowup) z -= 1;
      if (keys.s || keys.arrowdown) z += 1;
    }
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    st.move.x = x; st.move.z = z;
    st.moving = Math.min(1, m) > 0.12;
    return st;
  };

  return {
    state: compute,
    poll() {
      compute();
      st.taps = pending.splice(0, pending.length);
      st.pinch = zoomAcc; zoomAcc = 1;
      st.orbit = orbitAcc; orbitAcc = 0; st.tilt = tiltAcc; tiltAcc = 0;
      st.recenter = recenterReq; recenterReq = false;
      return st;
    },
    onTap(cb) { tapSubs.add(cb); return () => { tapSubs.delete(cb); }; },
    setHand(h) { st.hand = h; },
    inject(m) { injected = m ? { x: m.x, z: m.z } : null; },
    setPicker(fn) { picker = fn; },
    interactions,
    dispose() { offs.splice(0).forEach(f => f()); joy.remove(); style.remove(); },
  };
}
