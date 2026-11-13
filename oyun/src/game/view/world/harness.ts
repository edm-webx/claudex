/**
 * World browser harness (tests/browser/world.html): render + dress + prefab + zones + world view without boot, sim
 * or characters. Deterministic: no RAF loop; the spec drives frames through window.__world.
 * URL: ?tier=akici|dengeli|sahane (default dengeli) &time=<h> &stage=<n> &x=&z= (player)  #noart
 */
import { createRender } from '../../../engine/render';
import { createDress } from '../../../engine/dress';
import { createPrefabs } from '../../../engine/prefab';
import { createZones } from '../../../engine/zones';
import { TIER_TABLE } from '../../../engine/quality';
import type { Quality, TierName, Vec2, Platform } from '../../../engine/api';
import { createWorldView } from './index';
import { defaultState } from '../../sim/schema';

const q = new URLSearchParams(location.search);
const tierName = (q.get('tier') || 'dengeli') as TierName;
const tier = TIER_TABLE[tierName] || TIER_TABLE.dengeli;
const quality = { current: () => tier, setting: () => tierName, set() {}, onChange: () => () => {}, feed() {}, batterySaver() {}, table: TIER_TABLE } as unknown as Quality;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const dress = createDress({ noart: /noart/.test(location.hash), platform: null as unknown as Platform });
const render = createRender({ canvas, quality, dress });
const prefab = createPrefabs({ dress });
const zones = createZones({ scene: render.scene, prefab, dress, quality, picks: render });
const world = createWorldView({ render, zones, prefab, dress });
world.ferry.auto = false; // deterministic memory counts (the docking ferry changes what is uploaded)
zones.slowestJob(true);
const state = defaultState(1);
state.stage = +(q.get('stage') || 1);
const pos: Vec2 = { ...world.playerStart(state.stage) };
if (q.has('x')) pos.x = +q.get('x')!;
if (q.has('z')) pos.z = +q.get('z')!;
render.resize();
render.camera.setAspect(canvas.clientWidth / Math.max(1, canvas.clientHeight));
render.setTime(+(q.get('time') || 11));
world.update(state, 0, 1);
render.camera.snap(pos);

let animate = true;
function frame(dt: number, draw = true) {
  zones.update(pos);
  world.update(state, animate ? dt : 0, 1);
  render.camera.follow(pos, dt);
  render.camera.update(dt, 1);
  if (draw) render.frame(render.scene, render.camera.camera, 1);
}

/* fake sim rules for the M1 spec: only the fields the world view reads */
const fakeRt: any = { carry: [], stations: Object.fromEntries(['doner', 'cay', 'ayran', 'simit', 'tost', 'gazoz'].map(k => [k, { built: k === 'doner', out: [] }])),
  counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] }, kasa: [], floor: [], tables: [], customers: [], queue: [], winq: [],
  ferry: { state: 'away', t: 0 }, window: null, pads: [], slow: null };
let fakeDwell: any = null;
const fakeRules: any = { rt: fakeRt, state, playerPos: pos, player: {}, interactions: { status: () => fakeDwell, get: () => fakeDwell ? { pos: fakeDwell.pos, dwell: 0.4 } : null } };
world.bindRules(() => fakeRules, () => ({ x: pos.x, z: pos.z, rot: 0 }));

const api = {
  ready: true,
  /** M1 spec: patch the fake rules runtime (rt fields), the state, and the dwell status. */
  fake(rt: Record<string, unknown>, st?: Record<string, unknown>, dwell?: unknown) { Object.assign(fakeRt, rt); if (st) Object.assign(state, st); if (dwell !== undefined) fakeDwell = dwell; },
  world,
  prefab, zones, render,
  /** false freezes world animation (boats, far ferry, clouds) so GPU memory counts compare exactly. */
  animate(on: boolean) { animate = on; },
  tier: tierName,
  pos,
  frame(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) frame(dt); return render.info(); },
  setTime(h: number) { render.setTime(h); },
  setStage(n: number, renewed: string[] = []) { state.stage = n; state.renewed = renewed.slice(); world.update(state, 0, 1); pos.x = world.playerStart(n).x; pos.z = world.playerStart(n).z; render.camera.snap(pos); },
  own(keys: string[]) { keys.forEach(k => { state.owned[k] = 1; }); },
  teleport(x: number, z: number) { pos.x = x; pos.z = z; render.camera.snap(pos); },
  info: () => render.info(),
  /** Unique geometries reachable in the scene (visible chain only) by zone root, for memory debugging. */
  sceneGeos() {
    const out: Record<string, number> = {};
    render.scene.children.forEach(c => { const set = new Set<unknown>(); c.traverseVisible(n => { const g = (n as unknown as { geometry?: unknown }).geometry; if (g) set.add(g); }); out[c.name || c.type] = set.size; });
    return out;
  },
  states: () => zones.states(),
  slowest: (reset?: boolean) => zones.slowestJob(reset),
  /**
   * Walks the player along waypoints at `speed` m/s with fixed dt; renders every `drawEvery` frames and at the end.
   * Returns per-frame build ms max, state transitions and frames where the zone under the player had no meshes.
   */
  walk(points: [number, number][], speed = 6, dt = 1 / 30, drawEvery = 20) {
    const trans: string[] = []; let maxBuild = 0, frames = 0, holes = 0;
    const last: Record<string, string> = { ...zones.states() };
    for (const [tx, tz] of points) {
      for (;;) {
        const dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz), step = speed * dt;
        if (d <= step) { pos.x = tx; pos.z = tz; } else { pos.x += dx / d * step; pos.z += dz / d * step; }
        frames++;
        frame(dt, frames % drawEvery === 0);
        maxBuild = Math.max(maxBuild, zones.buildMs());
        const st = zones.states();
        for (const k in st) if (st[k] !== last[k]) { trans.push(k + ':' + last[k] + '>' + st[k]); last[k] = st[k]; }
        const here = zones.zoneAt(pos);
        if (here && !(st[here] === 'hot' || st[here] === 'warm')) holes++;
        if (d <= step) break;
      }
    }
    for (let i = 0; i < 3; i++) frame(dt, true);
    return { maxBuild, frames, trans, holes, info: render.info(), states: zones.states(), pending: zones.pending() };
  },
};
(window as unknown as { __world: typeof api }).__world = api;
render.frame(render.scene, render.camera.camera, 1);
