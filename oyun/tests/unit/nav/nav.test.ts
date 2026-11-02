import { describe, it, expect } from 'vitest';
import { createNav, createSpatialHash } from '../../../src/engine/nav';
import { createSoA } from '../../../src/engine/ecs';
import type { WalkGrid, Vec2 } from '../../../src/engine/api';

/** 20 x 20 grid of 0.5 m cells from (0,0); a wall at ix = 10 for iz 0..15 (gap at the top). */
function wallGrid(zone = 'a', ox = 0): WalkGrid {
  const w = 20, h = 20, cost = new Uint8Array(w * h).fill(1);
  for (let iz = 0; iz < 16; iz++) cost[iz * w + 10] = 0;
  return { cell: 0.5, w, h, origin: { x: ox, z: 0 }, cost, zone };
}
const len = (from: Vec2, p: Vec2[]) => { let l = 0, a = from; for (const b of p) { l += Math.hypot(b.x - a.x, b.z - a.z); a = b; } return l; };

describe('nav without grids', () => {
  it('moves freely and never throws', () => {
    const nav = createNav();
    const out = { x: 0, z: 0 };
    expect(nav.move({ x: 0, z: 0 }, { x: 3, z: -2 }, 0.36, out)).toEqual({ x: 3, z: -2 });
    expect(nav.walkable({ x: 99, z: 99 })).toBe(true);
    expect(nav.path({ x: 0, z: 0 }, { x: 1, z: 1 })).toEqual([{ x: 1, z: 1 }]);
    expect(nav.flowTo('nope').dirAt({ x: 0, z: 0 }, out)).toBe(false);
  });
});

describe('nav grid', () => {
  it('walkable / nearestWalkable follow the cost grid', () => {
    const nav = createNav(); nav.addGrid(wallGrid());
    expect(nav.walkable({ x: 1, z: 1 })).toBe(true);
    expect(nav.walkable({ x: 5.2, z: 1 })).toBe(false);       // wall cell ix 10
    expect(nav.walkable({ x: -1, z: 1 })).toBe(false);        // outside every grid
    const out = { x: 0, z: 0 };
    expect(nav.nearestWalkable({ x: 5.2, z: 1 }, out)).toBe(true);
    expect(nav.walkable(out)).toBe(true);
    expect(Math.abs(out.x - 5.2)).toBeLessThan(0.8);
  });

  it('A* goes around the wall and string-pulls to few waypoints', () => {
    const nav = createNav(); nav.addGrid(wallGrid());
    const from = { x: 1, z: 1 }, to = { x: 9, z: 1 };
    const p = nav.path(from, to);
    expect(p.length).toBeGreaterThan(1);
    expect(p.length).toBeLessThan(6);
    expect(p[p.length - 1]).toEqual(to);
    // must pass through the gap (z >= 8)
    expect(p.some(v => v.z >= 7.9)).toBe(true);
    // every leg stays on walkable ground
    let a = from;
    for (const b of p) {
      for (let k = 1; k <= 20; k++) expect(nav.walkable({ x: a.x + (b.x - a.x) * k / 20, z: a.z + (b.z - a.z) * k / 20 })).toBe(true);
      a = b;
    }
    expect(len(from, p)).toBeLessThan(2 * 8 + 9);
  });

  it('returns [] when the target is sealed off, and respects maxNodes', () => {
    const g = wallGrid();
    for (let iz = 16; iz < 20; iz++) g.cost[iz * 20 + 10] = 0;
    const nav = createNav(); nav.addGrid(g);
    expect(nav.path({ x: 1, z: 1 }, { x: 9, z: 1 })).toEqual([]);
    const nav2 = createNav(); nav2.addGrid(wallGrid());
    expect(nav2.path({ x: 1, z: 1 }, { x: 9, z: 1 }, { maxNodes: 5 })).toEqual([]);
  });

  it('move slides along walls instead of stopping dead', () => {
    const nav = createNav(); nav.addGrid(wallGrid());
    const out = { x: 0, z: 0 };
    // push diagonally into the wall at x = 5: x is blocked, z keeps going
    nav.move({ x: 4.4, z: 2 }, { x: 5.4, z: 3 }, 0.3, out);
    expect(out.x).toBeLessThan(4.75);
    expect(out.z).toBeGreaterThan(2.8);
    // straight into the wall: stops before it
    nav.move({ x: 4.4, z: 2 }, { x: 6, z: 2 }, 0.3, out);
    expect(out.x).toBeLessThan(4.75);
    // standing inside a blocked spot (bad spawn): free movement so nobody is trapped
    nav.move({ x: 5.2, z: 2 }, { x: 6.2, z: 2 }, 0.3, out);
    expect(out.x).toBeCloseTo(6.2);
  });

  it('setBlocked blocks and unblocks, and invalidates flow fields', () => {
    const nav = createNav(); nav.addGrid(wallGrid());
    nav.defineTarget('t', { x: 9, z: 9 });
    const f = nav.flowTo('t');
    expect(f.distAt({ x: 1, z: 9 })).toBeLessThan(10);
    const gap = { x0: 5, z0: 8, x1: 5.4, z1: 9.9 };
    nav.setBlocked(gap, true);
    expect(nav.walkable({ x: 5.2, z: 9 })).toBe(false);
    expect(f.distAt({ x: 1, z: 9 })).toBe(Infinity);
    const out = { x: 0, z: 0 };
    expect(f.dirAt({ x: 1, z: 9 }, out)).toBe(false);
    nav.setBlocked(gap, false);
    expect(nav.walkable({ x: 5.2, z: 9 })).toBe(true);
    expect(f.dirAt({ x: 1, z: 9 }, out)).toBe(true);
  });

  it('flow field leads every reachable cell to the target', () => {
    const nav = createNav(); nav.addGrid(wallGrid());
    nav.defineTarget('door', { x: 9, z: 1 });
    const f = nav.flowTo('door');
    expect(nav.flowTo('door')).toBe(f);  // cached
    const p = { x: 1, z: 1 }, d = { x: 0, z: 0 };
    let steps = 0;
    while (Math.hypot(p.x - 9, p.z - 1) > 0.2 && steps < 400) {
      expect(f.dirAt(p, d)).toBe(true);
      p.x += d.x * 0.1; p.z += d.z * 0.1; steps++;
      expect(nav.walkable(p)).toBe(true);
    }
    expect(steps).toBeLessThan(400);
  });

  it('zonePath walks the portal graph, path crosses grids through portals', () => {
    const portals = [
      { zone: 'a', portal: { id: 'ab', to: 'b', a: { x: 9.9, z: 4 }, b: { x: 9.9, z: 5 } } },
      { zone: 'b', portal: { id: 'ba', to: 'a', a: { x: 10.1, z: 4 }, b: { x: 10.1, z: 5 } } },
      { zone: 'b', portal: { id: 'bc', to: 'c', a: { x: 0, z: 0 }, b: { x: 0, z: 0 } } },
    ];
    const nav = createNav({ portals });
    expect(nav.zonePath('a', 'c')).toEqual(['ab', 'bc']);
    expect(nav.zonePath('c', 'a')).toEqual([]);
    expect(nav.zonePath('a', 'a')).toEqual([]);
    const open = (zone: string, ox: number): WalkGrid => ({ cell: 0.5, w: 20, h: 20, origin: { x: ox, z: 0 }, cost: new Uint8Array(400).fill(1), zone });
    nav.addGrid(open('a', 0)); nav.addGrid(open('b', 10));
    const p = nav.path({ x: 1, z: 4.5 }, { x: 18, z: 4.5 });
    expect(p.length).toBeGreaterThan(0);
    expect(p[p.length - 1]).toEqual({ x: 18, z: 4.5 });
    nav.removeGrid('b');
    expect(nav.walkable({ x: 15, z: 4 })).toBe(false);
  });
});

describe('spatial hash + steering', () => {
  it('query returns exactly the points within r', () => {
    const h = createSpatialHash(1, 4);   // tiny table forces slot collisions
    const pts: [number, number][] = [];
    for (let i = 0; i < 300; i++) { const x = ((i * 37) % 41) - 20, z = ((i * 53) % 43) - 21; pts.push([x * 0.7, z * 0.7]); h.insert(i, x * 0.7, z * 0.7); }
    const out: number[] = [];
    const n = h.query(1, -2, 2.5, out);
    const want = pts.map((p, i) => [i, Math.hypot(p[0] - 1, p[1] + 2)] as const).filter(([, d]) => d <= 2.5).map(([i]) => i).sort((a, b) => a - b);
    expect(out.slice(0, n).sort((a, b) => a - b)).toEqual(want);
    const typed = new Int32Array(2);
    expect(h.query(1, -2, 2.5, typed)).toBe(Math.min(2, want.length));
    h.clear();
    expect(h.query(1, -2, 2.5, out)).toBe(0);
  });

  it('separate pushes overlapping agents apart', () => {
    const nav = createNav();
    const s = createSoA('agents', 8, { x: 'f32', z: 'f32' });
    const a = s.alloc(), b = s.alloc();
    s.f32('x')[a] = 0; s.f32('z')[a] = 0; s.f32('x')[b] = 0.3; s.f32('z')[b] = 0;
    const h = nav.hash(1); h.insert(a, 0, 0); h.insert(b, 0.3, 0);
    const out = { x: 0, z: 0 };
    nav.steering.separate(s, h, a, out);
    expect(out.x).toBeLessThan(0);
    nav.steering.separate(s, h, b, out);
    expect(out.x).toBeGreaterThan(0);
  });
});
