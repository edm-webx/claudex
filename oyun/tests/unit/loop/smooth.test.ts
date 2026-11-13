// Walk smoothness regression (owner bug: walking looked glitchy/laggy vs v2). Simulates a display with a given rAF
// cadence (vsync, jitter, drops), runs the real loop + sim + walk + the boot interpolation + camera follow, and measures
// the per-render displacement of the hero and the camera.
// Metric: displacement per unit of *elapsed time* between consecutive renders should be constant while walking at constant
// speed. We report max/median of per-frame displacement normalised by the nominal display period (so a skipped render shows
// up as a 2x frame, a stalled one as 0) and the displacement stddev/mean. Thresholds were set from the v2 loop (same maths).
import { describe, it, expect } from 'vitest';
import { createLoop } from '../../../src/engine/loop';
import { createSim, lerpPose } from '../../../src/game/headless';
import { emptyContent } from '../../../src/content/index';
import { fallbackCameraRig } from '../../../src/engine/debug/fallbacks';

type Cadence = (k: number, rnd: () => number) => number; // returns frame period in ms for frame k
const lcg = (s: number) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);

function measure(opts: { cadence: Cadence; fps: 60 | 30; seconds?: number; dispMs?: number }) {
  const { cadence, fps, seconds = 5 } = opts;
  const sim = createSim({ seed: 1, content: emptyContent() }, { ambient: null, nav: null, startPos: { x: -20, z: 0 }, log: { info() {}, warn() {}, error() {} } });
  const rig = fallbackCameraRig(390 / 844);
  rig.snap(sim.walk.pos);
  const rnd = lcg(5);
  const pos = { x: 0, z: 0, rot: 0 };
  const hero: number[] = [], cam: number[] = [], times: number[] = [];
  let lastT = 0;
  const loop = createLoop({
    step: () => { sim.input({ x: 1, z: 0 }); sim.tickOnce(); },
    render: (fdt, alpha) => {
      lerpPose(sim.walk, alpha, pos);
      rig.follow(pos, fdt);
      rig.update(fdt, alpha);
      hero.push(pos.x); cam.push(rig.camera.position.x); times.push(lastT);
    },
    targetFps: () => fps, raf: () => 0, cancelRaf: () => {},
  });
  let t = 0;
  for (let k = 0; t < seconds * 1000; k++) { t += cadence(k, rnd); lastT = t; loop.frame(t); }
  // skip warm-up (first 1.5 s: start of walk, camera catch-up) then measure
  const from = times.findIndex(x => x > 1500);
  const nominal = opts.dispMs ?? 1000 / 60;
  const stats = (a: number[]) => {
    // per-render velocity in "px per nominal display period", compare consecutive renders
    const v: number[] = [];
    for (let i = Math.max(1, from); i < a.length; i++) v.push((a[i] - a[i - 1]) / ((times[i] - times[i - 1]) / nominal));
    const s = [...v].sort((x, y) => x - y), med = s[s.length >> 1];
    const mean = v.reduce((x, y) => x + y, 0) / v.length;
    const sd = Math.sqrt(v.reduce((x, y) => x + (y - mean) ** 2, 0) / v.length);
    // displacement per render (what the eye sees on a fixed-rate display): max/median of raw deltas
    const d: number[] = []; for (let i = Math.max(1, from); i < a.length; i++) d.push(a[i] - a[i - 1]);
    const ds = [...d].sort((x, y) => x - y), dmed = ds[ds.length >> 1];
    return { renders: v.length, ratioMaxMed: ds[ds.length - 1] / dmed, ratioMinMed: ds[0] / dmed, velCv: sd / Math.abs(mean), medDelta: dmed };
  };
  return { hero: stats(hero), cam: stats(cam), renders: hero.length };
}

const vsync60: Cadence = () => 1000 / 60;
const jitter: Cadence = (_k, r) => 15.5 + r() * 3;            // 15.5 .. 18.5 ms
const jitter1618: Cadence = (k) => [16, 17, 18, 16.67, 16.33, 17.67][k % 6];
const slow30: Cadence = () => 1000 / 30;                      // device that only manages 30 rAF/s
const hz120: Cadence = () => 1000 / 120;
const drops: Cadence = (k) => (k % 40 === 39 ? 50 : 1000 / 60); // occasional hitch

describe('walk smoothness', () => {
  // display period used to judge: the cadence's own period for regular ones
  const cases: [string, Cadence, 60 | 30, number, number][] = [
    // name, cadence, tier fps, max/med hero, max/med cam
    ['60 Hz, dengeli (60)', vsync60, 60, 1.6, 1.6],
    ['60 Hz, akici (30)', vsync60, 30, 1.6, 1.6],
    ['jittery 15.5-18.5 ms, dengeli', jitter, 60, 1.6, 1.6],
    ['jittery 16/17/18 ms, akici', jitter1618, 30, 1.6, 1.6],
    ['120 Hz, akici (30)', hz120, 30, 1.6, 1.6],
    ['rAF only 30/s, akici', slow30, 30, 1.2, 1.2],
    ['rAF only 30/s, dengeli', slow30, 60, 1.2, 1.2],
  ];
  for (const [name, cad, fps, mh, mc] of cases) {
    it(name, () => {
      const m = measure({ cadence: cad, fps, dispMs: name.startsWith('120') ? 1000 / 120 : name.startsWith('rAF') ? 1000 / 30 : 1000 / 60 });
      console.log(name.padEnd(34), 'renders', String(m.renders).padStart(4), 'hero max/med', m.hero.ratioMaxMed.toFixed(2), 'cam max/med', m.cam.ratioMaxMed.toFixed(2), 'hero vel cv', m.hero.velCv.toFixed(3));
      expect(m.hero.ratioMaxMed).toBeLessThan(mh);
      expect(m.cam.ratioMaxMed).toBeLessThan(mc);
    });
  }
  it('render rate follows the tier fps and never below it when rAF is slow', () => {
    const a = measure({ cadence: slow30, fps: 30 });
    expect(a.renders).toBeGreaterThan(140); // ~150 renders in 5 s, not 75
    const b = measure({ cadence: vsync60, fps: 30 });
    expect(b.renders).toBeGreaterThan(140); expect(b.renders).toBeLessThan(160);
    const c = measure({ cadence: hz120, fps: 30 });
    expect(c.renders).toBeGreaterThan(140); expect(c.renders).toBeLessThan(165);
  });
});
