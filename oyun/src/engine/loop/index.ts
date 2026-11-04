/**
 * engine/loop: fixed-step sim (default 30 Hz) with interpolated render, 60/30 fps pacing.
 * Owner: Builder A.
 * Decisions:
 * - Frame delta is clamped to 250 ms; at most `maxStepsPerFrame` steps run per frame, leftover time is dropped.
 * - In 30 fps mode the sim still steps every rAF; render runs once >= 0.8/30 s of frame time has accumulated (frameDt covers it).
 * - pause() stops steps and renders; resume() resets the frame clock so no catch-up burst happens.
 * - advance(sec) keeps a residual so repeated small calls add up to whole ticks; works even when paused (test hook).
 */
import type { Loop, LoopOpts } from '../api';

export function createLoop(o: LoopOpts): Loop {
  const hz = o.simHz ?? 30;
  const dt = 1 / hz;
  const dtMs = 1000 / hz;
  const maxSteps = o.maxStepsPerFrame ?? 5;
  const now = o.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : 0));
  const raf = o.raf ?? ((cb: (t: number) => void) => requestAnimationFrame(cb));
  const cancel = o.cancelRaf ?? ((id: number) => cancelAnimationFrame(id));

  let running = false, rafId = 0;
  let paused = false, pauseWhy = '';
  let last = -1, acc = 0, tick = 0, simTime = 0;
  let pendingRenderDt = 0, advResidual = 0;

  const doStep = (): boolean => {
    try { o.step(dt); } catch (e) { o.onError?.('step', e); }
    tick++; simTime = tick * dt;
    return true;
  };
  const doRender = (fdt: number, alpha: number) => {
    try { o.render(fdt, alpha); } catch (e) { o.onError?.('render', e); }
  };

  const loop: Loop = {
    start() {
      if (running) return;
      running = true; last = -1;
      const cb = (t: number) => {
        if (!running) return;
        rafId = raf(cb);
        loop.frame(t);
      };
      rafId = raf(cb);
    },
    stop() { running = false; if (rafId) cancel(rafId); rafId = 0; },
    pause(why) { paused = true; pauseWhy = why; },
    resume() { paused = false; pauseWhy = ''; last = -1; acc = 0; },
    get paused() { return paused; },
    get pauseWhy() { return pauseWhy; },
    get tick() { return tick; },
    get simTime() { return simTime; },
    frame(nowMs) {
      if (paused) { last = nowMs; return; }
      if (last < 0) { last = nowMs; return; }
      let fms = nowMs - last; last = nowMs;
      if (fms < 0) fms = 0;
      if (fms > 250) fms = 250;
      acc += fms;
      let n = 0;
      while (acc >= dtMs - 1e-7 && n < maxSteps) { doStep(); acc -= dtMs; n++; }
      if (n >= maxSteps && acc >= dtMs) acc = acc % dtMs; // drop excess: sim slows, never explodes
      if (acc < 0) acc = 0;
      pendingRenderDt += fms / 1000;
      // 30 fps mode is time based, not "every second rAF": a 120 Hz screen still renders ~30/s and a device whose rAF
      // is already ~30/s renders every frame (counting rAFs halved it to 15 fps). 0.8 of a period absorbs vsync jitter.
      if (o.targetFps() === 30 && pendingRenderDt < 0.8 / 30) return;
      const fdt = pendingRenderDt; pendingRenderDt = 0;
      doRender(fdt, Math.min(1, acc / dtMs));
    },
    advance(sec) {
      advResidual += sec;
      const n = Math.floor(advResidual * hz + 1e-6);
      advResidual -= n / hz;
      if (advResidual < 0) advResidual = 0;
      for (let i = 0; i < n; i++) doStep();
    },
    renderNow(frameDt = dt) { doRender(frameDt, 1); },
  };
  void now;
  return loop;
}
