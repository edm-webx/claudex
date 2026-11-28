import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { createZones, distToRect, placeRect } from '../../../src/engine/zones';
import { createPrefabs } from '../../../src/engine/prefab';
import { createDress } from '../../../src/engine/dress';
import type { ZoneDef, Quality, ZoneState } from '../../../src/engine/api';
import { GREYBOX_PREFABS } from '../../../src/content/prefabs/common/greybox';
import { testSokakZone } from '../../../src/content/zones/test-sokak';

function setup(opts: { budget?: number; live?: number; now?: () => number } = {}) {
  const dress = createDress({ noart: true } as Parameters<typeof createDress>[0]);
  const prefab = createPrefabs({ dress });
  GREYBOX_PREFABS.forEach(d => prefab.define(d));
  prefab.define({ id: 'z.box', parts: [{ shape: 'box', size: [1, 1, 1], pos: [0, 0.5, 0], color: '#888888' }], colliders: [{ x0: -0.5, x1: 0.5, z0: -0.5, z1: 0.5 }], anchors: { front: { pos: { x: 0, z: 1 } } } });
  const scene = new T.Scene();
  const quality = { current: () => ({ buildBudgetMs: opts.budget ?? 3, maxLiveZones: opts.live ?? 3 }) } as unknown as Quality;
  const zones = createZones({ scene, prefab, dress, quality, now: opts.now });
  return { zones, prefab, scene };
}
const pier = (): ZoneDef => ({
  id: 'pier', bounds: { x0: -10, z0: -10, x1: 10, z1: 10 }, walk: { cell: 0.5, bake: true, paint: [{ rect: { x0: -10, x1: 10, z0: 9, z1: 10 }, cost: 0 }] },
  props: [{ id: 'b1', prefab: 'z.box', pos: { x: 2, z: 2 } }, { id: 'b2', prefab: 'z.box', pos: { x: -3, z: 0 }, rotY: Math.PI / 2 }],
  anchors: { start: { pos: { x: 0, z: 0 } } }, portals: [], ambience: { music: '', loops: [] }, dressing: [], minState: 'sim',
});
const geoCount = (s: T.Object3D) => { const g = new Set(); s.traverse(n => { const m = n as T.Mesh; if (m.geometry) g.add(m.geometry); }); return g.size; };

describe('zones', () => {
  it('distToRect / placeRect', () => {
    expect(distToRect({ x: 0, z: 0 }, { x0: 3, x1: 5, z0: -1, z1: 1 })).toBe(3);
    const r = placeRect({ x0: -1, x1: 1, z0: -0.5, z1: 0.5 }, { id: 'a', prefab: 'x', pos: { x: 10, z: 0 }, rotY: Math.PI / 2 });
    expect(r.x0).toBeCloseTo(9.5); expect(r.z1).toBeCloseTo(1);
  });
  it('minState holds sim from registration; walk grid available without meshes', () => {
    const { zones, scene } = setup();
    zones.register(pier());
    expect(zones.state('pier')).toBe('sim');
    const g = zones.walkGrid('pier');
    expect(g.w).toBe(40); expect(g.h).toBe(40);
    const at = (x: number, z: number) => g.cost[Math.floor((z - g.origin.z) / g.cell) * g.w + Math.floor((x - g.origin.x) / g.cell)];
    expect(at(2, 2)).toBe(0);     // box collider
    expect(at(0, 9.5)).toBe(0);   // paint
    expect(at(5, -5)).toBe(1);
    expect(scene.children.length).toBe(0);
  });
  it('streams by distance with hysteresis: sim -> warm -> hot and back', () => {
    const { zones } = setup();
    zones.register(pier());
    const seen: ZoneState[] = [];
    zones.onState((id, s) => { if (id === 'pier') seen.push(s); });
    zones.flush({ x: 40, z: 0 });              // 30 m: target sim
    expect(zones.state('pier')).toBe('sim');
    zones.flush({ x: 30, z: 0 });              // 20 m: warm
    expect(zones.state('pier')).toBe('warm');
    zones.flush({ x: 0, z: 0 });               // inside: hot
    expect(zones.state('pier')).toBe('hot');
    zones.flush({ x: 31, z: 0 });              // 21 m: warm
    expect(zones.state('pier')).toBe('warm');
    zones.flush({ x: 40, z: 0 });              // 30 m < 25 + 8: stays warm (hysteresis)
    expect(zones.state('pier')).toBe('warm');
    zones.flush({ x: 45, z: 0 });              // 35 m: sim (minState)
    expect(zones.state('pier')).toBe('sim');
    zones.flush({ x: 200, z: 0 });
    expect(zones.state('pier')).toBe('sim');
    expect(seen).toEqual(['warm', 'hot', 'warm', 'sim']);
  });
  it('reports sim until the build finished; jobs respect the budget', () => {
    let t = 0;
    const { zones, prefab } = setup({ budget: 3, now: () => t });
    prefab.define({ id: 'z.slow', parts: [{ shape: 'box', size: [1, 1, 1], color: '#ffffff' }] });
    const def = pier(); def.props = Array.from({ length: 6 }, (_, i) => ({ id: 's' + i, prefab: 'z.slow', pos: { x: i, z: 0 } }));
    zones.register(def);
    // each job "costs" 1 ms of the injected clock
    const origPlace = prefab.place.bind(prefab);
    (prefab as { place: typeof prefab.place }).place = (pl, parent) => { t += 1; return origPlace(pl, parent); };
    zones.update({ x: 0, z: 0 });
    expect(zones.state('pier')).toBe('sim');
    expect(zones.buildMs()).toBeLessThanOrEqual(3);
    let frames = 1;
    while (zones.pending() && frames < 20) { zones.update({ x: 0, z: 0 }); expect(zones.buildMs()).toBeLessThanOrEqual(3); frames++; }
    expect(zones.state('pier')).toBe('hot');
    expect(frames).toBeGreaterThan(1);
    expect(zones.maxBuildMs()).toBeLessThanOrEqual(3);
  });
  it('anchors include prefab anchors in world space', () => {
    const { zones } = setup();
    zones.register(pier());
    const a = zones.anchors('pier');
    expect(a.start.pos).toEqual({ x: 0, z: 0 });
    expect(a['b1.front'].pos.x).toBeCloseTo(2); expect(a['b1.front'].pos.z).toBeCloseTo(3);
    expect(a['b2.front'].pos.x).toBeCloseTo(-2); expect(a['b2.front'].pos.z).toBeCloseTo(0);
  });
  it('setColliders re-bakes the same grid object in place', () => {
    const { zones } = setup();
    zones.register(pier());
    const g = zones.walkGrid('pier');
    let fired = 0; zones.onGrid(() => { fired++; });
    zones.setColliders('pier', 'dyn', [{ x0: -6, x1: -5, z0: -6, z1: -5 }]);
    expect(zones.walkGrid('pier')).toBe(g);
    expect(g.cost[Math.floor((-5.5 + 10) / 0.5) * g.w + Math.floor((-5.5 + 10) / 0.5)]).toBe(0);
    expect(fired).toBe(1);
  });
  it('memory returns to baseline after leaving (5 round trips)', () => {
    const { zones, scene } = setup();
    zones.register(pier());
    zones.register(testSokakZone());
    zones.flush({ x: 0, z: 0 });
    const base = geoCount(scene);
    for (let i = 0; i < 5; i++) {
      zones.flush({ x: 100, z: 9 });
      expect(zones.state('test-sokak')).toBe('hot');
      expect(zones.state('pier')).toBe('sim');
      zones.flush({ x: 0, z: 0 });
      expect(zones.state('test-sokak')).toBe('cold');
      expect(geoCount(scene)).toBe(base);
    }
  });
  it('a detached root is re-attached on return (one attach job); retain 0 rebuilds', () => {
    const { zones, prefab } = setup();
    zones.register(pier());
    zones.flush({ x: 0, z: 0 });
    const kiosk = prefab.instance('b1')!;
    zones.flush({ x: 200, z: 0 });
    expect(zones.root('pier')).toBeNull();
    expect(prefab.instance('b1')).toBe(kiosk);          // instance kept CPU-side
    zones.update({ x: 0, z: 0 });
    expect(zones.pending()).toBeLessThanOrEqual(1);       // attach (+ done) instead of one job per prop
    zones.flush({ x: 0, z: 0 });
    expect(zones.state('pier')).toBe('hot');
    expect(zones.instancesOf('pier')[0]).toBe(kiosk);
    const z2 = setup({}); const zz = createZones({ scene: z2.scene, prefab: z2.prefab, dress: createDress({ noart: true } as Parameters<typeof createDress>[0]), quality: { current: () => ({ buildBudgetMs: 3, maxLiveZones: 3 }) } as unknown as Quality, retain: 0 });
    zz.register(pier()); zz.flush({ x: 0, z: 0 }); zz.flush({ x: 200, z: 0 });
    expect(z2.prefab.instance('b1')).toBeUndefined();
  });
  it('memory cap holds the farthest zone at sim', () => {
    const { zones } = setup({ live: 1 });
    zones.register(pier());
    zones.register({ ...pier(), id: 'near', bounds: { x0: 12, z0: -10, x1: 20, z1: 10 }, minState: undefined });
    zones.flush({ x: 0, z: 0 });
    expect(zones.state('pier')).toBe('hot');
    expect(zones.state('near')).toBe('sim');
  });
  it('test-sokak: street walkable, kerbs blocked, portal at the seam', () => {
    const { zones } = setup();
    const d = testSokakZone(); zones.register(d);
    const g = zones.walkGrid('test-sokak');
    const at = (x: number, z: number) => g.cost[Math.floor((z - g.origin.z) / g.cell) * g.w + Math.floor((x - g.origin.x) / g.cell)];
    expect(at(80, 9)).toBe(1); expect(at(80, 2)).toBe(0); expect(at(80, 15)).toBe(0);
    expect(d.portals[0].a.x).toBe(62);
    expect(zones.zoneAt({ x: 90, z: 9 })).toBe('test-sokak');
  });
  // PRF-07: a zone in the camera view is built before it can show, beyond ZONE_DIST.warm; off-view it stays sim
  it('view-aware streaming builds a zone in view out to the fog edge and records pops', () => {
    let t = 0;
    const { zones, scene } = setup({ now: () => t });
    scene.fog = new T.Fog('#ffffff', 70, 190);
    zones.register({ ...pier(), id: 'far', bounds: { x0: 40, z0: -10, x1: 60, z1: 10 }, minState: undefined });
    const cam = new T.PerspectiveCamera(40, 16 / 9, 0.5, 400);
    const frustumAt = (lookX: number) => { cam.position.set(0, 12, 0); cam.lookAt(lookX, 0, 0); cam.updateMatrixWorld(); return new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); };
    const run = (f: T.Frustum, n = 20) => { for (let i = 0; i < n; i++) { t += 16; zones.update({ x: 0, z: 0 }, f); } };
    run(frustumAt(-50));                                        // looking away: 40 m, beyond 25 m -> not built
    expect(zones.state('far')).toBe('sim');
    zones.setViewAware(false); run(frustumAt(50));              // old rule: in view but 40 m away -> never built (an empty street)
    expect(zones.state('far')).toBe('sim');
    zones.setViewAware(true); run(frustumAt(50));
    expect(zones.state('far')).toBe('warm');
    expect(zones.popStats().popIn).toBe(1);                     // it was already on screen when the build finished (counted)
    run(frustumAt(-50), 10);                                    // turned away: held for VIEW_HOLD s
    expect(zones.state('far')).toBe('warm');
    t += 5000; run(frustumAt(-50), 2);
    expect(zones.state('far')).toBe('sim');
    expect(zones.popStats(true).popOut).toBe(0);                // dropped while off screen: no pop
    // grown box: the build starts while the zone is still just outside the picture -> no pop when it shows
    zones.update({ x: 0, z: 0 }); run(frustumAt(-50), 2);
    const realBox = new T.Box3(new T.Vector3(40, -1, -10), new T.Vector3(60, 14, 10)), grown = realBox.clone().expandByVector(new T.Vector3(14, 0, 14));
    const lookX = [11, 12, 13, 14, 15, 16].find(x => { const f = frustumAt(x); return !f.intersectsBox(realBox) && f.intersectsBox(grown); });
    expect(lookX).toBeDefined();
    run(frustumAt(lookX!)); expect(zones.state('far')).toBe('warm'); expect(zones.popStats().popIn).toBe(0);
    // without a frustum (tests, editor) the distance rule alone decides
    t += 10000; zones.update({ x: 0, z: 0 }); zones.flush({ x: 0, z: 0 });
    expect(zones.state('far')).toBe('sim');
  });
  it('a jump (teleport, bus ride) builds the landing zone inside the same frame; walking stays budgeted', () => {
    let t = 0;
    const { zones, prefab } = setup({ budget: 3, now: () => t });
    const def = pier(); def.minState = undefined; def.props = Array.from({ length: 8 }, (_, i) => ({ id: 'j' + i, prefab: 'z.box', pos: { x: i - 4, z: 0 } }));
    zones.register(def);
    const origPlace = prefab.place.bind(prefab);
    (prefab as { place: typeof prefab.place }).place = (pl, parent) => { t += 1; return origPlace(pl, parent); };
    zones.update({ x: 300, z: 0 });                 // far away: cold
    zones.update({ x: 0, z: 0 });                   // jump of 300 m into the zone
    expect(zones.state('pier')).toBe('hot');        // whole build in this frame, no empty frames
    expect(zones.pending()).toBe(0);
    expect(zones.popStats().cutMs).toBeGreaterThanOrEqual(8);
    zones.update({ x: 300, z: 0 }); zones.update({ x: 300, z: 0 });
    for (let x = 40; x >= 0; x -= 2) zones.update({ x, z: 0 });   // walking in (2 m steps): budgeted, several frames
    expect(zones.maxBuildMs(true)).toBeLessThanOrEqual(3);
  });
});
