/**
 * Nav: walk grids, A* paths, cached flow fields, player slide collision, spatial hash and separation steering.
 * Owner: Builder C. Pure: no three, window, document, Math.random, Date.now, performance.now.
 *
 * Grid rules (api.ts): cost 0 blocked, 1..254 walkable; index = iz*w + ix; cell centre = origin + (i+0.5)*cell.
 * Several grids can be loaded (one per zone, shared coordinate space). A point belongs to the first grid that
 * contains it. With no grid loaded everything is walkable and move() passes through. When grids exist, points
 * outside all of them are blocked, except that a mover already standing on a blocked spot may always move
 * (so bad spawn data never traps the player). move() never throws.
 */
import type { Nav, NavDeps, WalkGrid, FlowField, SpatialHash, Steering, SoAStore, Vec2, Rect, Portal } from '../api';

const SQRT2 = Math.SQRT2;
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DZ = [0, 0, 1, -1, 1, -1, 1, -1];

interface GridRec {
  g: WalkGrid;
  key: string;
  base: Uint8Array;            // cost as added (before setBlocked overlays)
  x1: number; z1: number;
  // A* scratch (lazy)
  gs?: Float32Array; par?: Int32Array; stamp?: Uint32Array; closed?: Uint32Array; heap?: Heap; fs?: Float32Array;
  run: number;
}

interface FlowRec extends FlowField { dirty: boolean; grid: GridRec | null; dist: Float32Array | null; at: Vec2; build(): void; }

/** Binary min-heap of (cell, key) pairs; keys are snapshotted so later decreases never break the order. */
class Heap {
  v: Int32Array; k: Float32Array; n = 0;
  constructor(cap: number) { this.v = new Int32Array(cap); this.k = new Float32Array(cap); }
  push(v: number, key: number) {
    if (this.n >= this.v.length) {
      const nv = new Int32Array(this.v.length * 2); nv.set(this.v); this.v = nv;
      const nk = new Float32Array(this.k.length * 2); nk.set(this.k); this.k = nk;
    }
    const V = this.v, K = this.k;
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= key) break;
      V[i] = V[p]; K[i] = K[p]; i = p;
    }
    V[i] = v; K[i] = key;
  }
  /** Pops the smallest; its key is left in `topKey`. */
  topKey = 0;
  pop(): number {
    const V = this.v, K = this.k;
    const top = V[0]; this.topKey = K[0];
    const n = --this.n;
    if (n > 0) {
      const v = V[n], key = K[n];
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        if (l >= n) break;
        const m = r < n && K[r] < K[l] ? r : l;
        if (K[m] >= key) break;
        V[i] = V[m]; K[i] = K[m]; i = m;
      }
      V[i] = v; K[i] = key;
    }
    return top;
  }
}

/** Hashed uniform grid. Entries remember their cell so slot collisions never return duplicates. */
export function createSpatialHash(cell = 1, tableBits = 10): SpatialHash {
  const size = 1 << tableBits, mask = size - 1;
  const head = new Int32Array(size).fill(-1);
  let next = new Int32Array(64), xs = new Float32Array(64), zs = new Float32Array(64), ids = new Int32Array(64);
  let cxs = new Int32Array(64), czs = new Int32Array(64);
  let n = 0;
  const inv = 1 / cell;
  const slot = (cx: number, cz: number) => (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663)) & mask;
  const grow = () => {
    const c = next.length * 2;
    const g32 = (a: Int32Array) => { const b = new Int32Array(c); b.set(a); return b; };
    const gf = (a: Float32Array) => { const b = new Float32Array(c); b.set(a); return b; };
    next = g32(next); ids = g32(ids); cxs = g32(cxs); czs = g32(czs); xs = gf(xs); zs = gf(zs);
  };
  return {
    clear() { head.fill(-1); n = 0; },
    insert(i, x, z) {
      if (n >= next.length) grow();
      const cx = Math.floor(x * inv), cz = Math.floor(z * inv);
      const s = slot(cx, cz);
      xs[n] = x; zs[n] = z; ids[n] = i; cxs[n] = cx; czs[n] = cz; next[n] = head[s]; head[s] = n; n++;
    },
    query(x, z, r, out) {
      let c = 0;
      const r2 = r * r, typed = !Array.isArray(out), max = out.length;
      const cx0 = Math.floor((x - r) * inv), cx1 = Math.floor((x + r) * inv);
      const cz0 = Math.floor((z - r) * inv), cz1 = Math.floor((z + r) * inv);
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        for (let k = head[slot(cx, cz)]; k !== -1; k = next[k]) {
          if (cxs[k] !== cx || czs[k] !== cz) continue;
          const dx = xs[k] - x, dz = zs[k] - z;
          if (dx * dx + dz * dz <= r2) {
            if (typed && c >= max) return c;
            out[c++] = ids[k];
          }
        }
      }
      return c;
    },
  };
}

export function createNav(deps: NavDeps = {}): Nav {
  const grids: GridRec[] = [];
  const blocks: Rect[] = [];
  const solids = new Map<string, Rect[]>();
  let solidList: Rect[] = [];
  const targets = new Map<string, Vec2>();
  const flows = new Map<string, FlowRec>();
  const portals = deps.portals ? deps.portals.slice() : [];
  let anon = 0;
  let minCell = 0.5;

  const gridAt = (x: number, z: number): GridRec | null => {
    for (let i = 0; i < grids.length; i++) {
      const r = grids[i];
      if (x >= r.g.origin.x && z >= r.g.origin.z && x < r.x1 && z < r.z1) return r;
    }
    return null;
  };
  const cellOf = (r: GridRec, x: number, z: number) => {
    const g = r.g;
    const ix = Math.floor((x - g.origin.x) / g.cell), iz = Math.floor((z - g.origin.z) / g.cell);
    if (ix < 0 || iz < 0 || ix >= g.w || iz >= g.h) return -1;
    return iz * g.w + ix;
  };
  const free = (x: number, z: number): boolean => {
    if (grids.length === 0) return true;
    const r = gridAt(x, z);
    if (!r) return false;
    const c = cellOf(r, x, z);
    return c >= 0 && r.g.cost[c] > 0;
  };
  /** Circle test: centre plus 8 points on the rim (v2 used circle-vs-rect, a square footprint feels sticky). */
  const D = Math.SQRT1_2;
  const freeR = (x: number, z: number, rad: number): boolean => {
    if (!free(x, z)) return false;
    if (rad <= 0) return true;
    const d = rad * D;
    return free(x + rad, z) && free(x - rad, z) && free(x, z + rad) && free(x, z - rad)
      && free(x + d, z + d) && free(x - d, z + d) && free(x + d, z - d) && free(x - d, z - d);
  };

  const paintRect = (r: GridRec, rect: Rect, v: number) => {
    const g = r.g;
    const ix0 = Math.max(0, Math.floor((Math.min(rect.x0, rect.x1) - g.origin.x) / g.cell));
    const ix1 = Math.min(g.w - 1, Math.floor((Math.max(rect.x0, rect.x1) - g.origin.x) / g.cell));
    const iz0 = Math.max(0, Math.floor((Math.min(rect.z0, rect.z1) - g.origin.z) / g.cell));
    const iz1 = Math.min(g.h - 1, Math.floor((Math.max(rect.z0, rect.z1) - g.origin.z) / g.cell));
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) g.cost[iz * g.w + ix] = v;
  };
  const applyBlocks = () => {
    for (const r of grids) {
      r.g.cost.set(r.base);
      for (const b of blocks) paintRect(r, b, 0);
    }
    for (const f of flows.values()) f.dirty = true;
    minCell = grids.length ? Math.min(...grids.map((r) => r.g.cell)) : 0.5;
  };

  /** Line of sight on one grid by sampling every quarter cell. */
  const los = (r: GridRec, ax: number, az: number, bx: number, bz: number): boolean => {
    const g = r.g;
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / (g.cell * 0.25)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const c = cellOf(r, ax + (bx - ax) * t, az + (bz - az) * t);
      if (c < 0 || g.cost[c] === 0) return false;
    }
    return true;
  };

  const nearestCell = (r: GridRec, x: number, z: number, maxRing = 24): number => {
    const g = r.g;
    let ix = Math.floor((x - g.origin.x) / g.cell), iz = Math.floor((z - g.origin.z) / g.cell);
    ix = Math.min(g.w - 1, Math.max(0, ix)); iz = Math.min(g.h - 1, Math.max(0, iz));
    if (g.cost[iz * g.w + ix] > 0) return iz * g.w + ix;
    for (let ring = 1; ring <= maxRing; ring++) {
      let best = -1, bd = Infinity;
      for (let dz = -ring; dz <= ring; dz++) for (let dx = -ring; dx <= ring; dx++) {
        if (Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
        const qx = ix + dx, qz = iz + dz;
        if (qx < 0 || qz < 0 || qx >= g.w || qz >= g.h) continue;
        if (g.cost[qz * g.w + qx] === 0) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = qz * g.w + qx; }
      }
      if (best >= 0) return best;
    }
    return -1;
  };
  const ccx = (r: GridRec, c: number) => r.g.origin.x + ((c % r.g.w) + 0.5) * r.g.cell;
  const ccz = (r: GridRec, c: number) => r.g.origin.z + (Math.floor(c / r.g.w) + 0.5) * r.g.cell;

  const astar = (r: GridRec, from: Vec2, to: Vec2, maxNodes: number): Vec2[] => {
    const g = r.g, N = g.w * g.h;
    const s = nearestCell(r, from.x, from.z), t = nearestCell(r, to.x, to.z);
    if (s < 0 || t < 0) return [];
    const toFree = cellOf(r, to.x, to.z) === t;
    const endX = toFree ? to.x : ccx(r, t), endZ = toFree ? to.z : ccz(r, t);
    if (s === t) return [{ x: endX, z: endZ }];
    if (!r.gs || r.gs.length !== N) {
      r.gs = new Float32Array(N); r.fs = new Float32Array(N); r.par = new Int32Array(N);
      r.stamp = new Uint32Array(N); r.closed = new Uint32Array(N); r.heap = new Heap(N + 64); r.run = 0;
    }
    const gs = r.gs, fs = r.fs!, par = r.par!, stamp = r.stamp!, closed = r.closed!, heap = r.heap!;
    const run = ++r.run;
    const tx = t % g.w, tz = Math.floor(t / g.w);
    const h = (c: number) => {
      const dx = Math.abs((c % g.w) - tx), dz = Math.abs(Math.floor(c / g.w) - tz);
      return (dx + dz) + (SQRT2 - 2) * Math.min(dx, dz);
    };
    stamp[s] = run; gs[s] = 0; fs[s] = h(s); par[s] = -1;
    heap.n = 0; heap.push(s, fs[s]);
    let expanded = 0, found = false;
    while (heap.n > 0) {
      const c = heap.pop();
      if (closed[c] === run) continue;
      closed[c] = run;
      if (c === t) { found = true; break; }
      if (++expanded > maxNodes) break;
      const ix = c % g.w, iz = (c - ix) / g.w;
      for (let k = 0; k < 8; k++) {
        const nx = ix + DX[k], nz = iz + DZ[k];
        if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
        const nc = nz * g.w + nx;
        const cost = g.cost[nc];
        if (cost === 0 || closed[nc] === run) continue;
        if (k >= 4 && (g.cost[iz * g.w + nx] === 0 || g.cost[nz * g.w + ix] === 0)) continue;   // no corner cutting
        const ng = gs[c] + (k >= 4 ? SQRT2 : 1) * cost;
        if (stamp[nc] !== run || ng < gs[nc]) {
          stamp[nc] = run; gs[nc] = ng; par[nc] = c; fs[nc] = ng + h(nc);
          heap.push(nc, fs[nc]);
        }
      }
    }
    if (!found) return [];
    const cells: number[] = [];
    for (let c = t; c !== -1; c = par[c]) cells.push(c);
    cells.reverse();
    const last = cells.length - 1;
    const px = (k: number) => (k === last ? endX : ccx(r, cells[k]));
    const pz = (k: number) => (k === last ? endZ : ccz(r, cells[k]));
    // String pulling: from the current anchor, jump to the farthest cell still in sight.
    const out: Vec2[] = [];
    let ax = from.x, az = from.z, i = 0;
    if (cellOf(r, ax, az) !== s) { ax = ccx(r, s); az = ccz(r, s); out.push({ x: ax, z: az }); }
    while (i < last) {
      let j = last;
      for (; j > i + 1; j--) if (los(r, ax, az, px(j), pz(j))) break;
      ax = px(j); az = pz(j);
      out.push({ x: ax, z: az });
      i = j;
    }
    return out;
  };

  const zonePath = (fromZone: string, toZone: string): string[] => {
    if (fromZone === toZone) return [];
    const prev = new Map<string, { zone: string; portal: string }>();
    const q = [fromZone];
    const seen = new Set([fromZone]);
    while (q.length) {
      const z = q.shift()!;
      for (const p of portals) {
        if (p.zone !== z || seen.has(p.portal.to)) continue;
        seen.add(p.portal.to); prev.set(p.portal.to, { zone: z, portal: p.portal.id });
        if (p.portal.to === toZone) {
          const ids: string[] = [];
          for (let k = toZone; k !== fromZone;) { const e = prev.get(k)!; ids.push(e.portal); k = e.zone; }
          return ids.reverse();
        }
        q.push(p.portal.to);
      }
    }
    return [];
  };
  const portalById = (id: string): { zone: string; portal: Portal } | undefined => portals.find((p) => p.portal.id === id);

  const makeFlow = (id: string): FlowRec => {
    const f: FlowRec = {
      target: id, dirty: true, grid: null, dist: null, at: { x: 0, z: 0 },
      build() {
        f.dirty = false;
        f.grid = null;
        const at = targets.get(id);
        if (!at) return;
        f.at.x = at.x; f.at.z = at.z;
        const r = gridAt(at.x, at.z) ?? grids[0] ?? null;
        if (!r) return;
        const g = r.g, N = g.w * g.h;
        if (!f.dist || f.dist.length !== N) f.dist = new Float32Array(N);
        const dist = f.dist;
        dist.fill(Infinity);
        const t = nearestCell(r, at.x, at.z);
        if (t < 0) return;
        f.grid = r;
        const heap = new Heap(N + 64);
        dist[t] = 0;
        heap.push(t, 0);
        while (heap.n > 0) {
          const c = heap.pop();
          if (heap.topKey > dist[c]) continue;   // stale entry
          const ix = c % g.w, iz = (c - ix) / g.w;
          for (let k = 0; k < 8; k++) {
            const nx = ix + DX[k], nz = iz + DZ[k];
            if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
            const nc = nz * g.w + nx;
            const cost = g.cost[nc];
            if (cost === 0) continue;
            if (k >= 4 && (g.cost[iz * g.w + nx] === 0 || g.cost[nz * g.w + ix] === 0)) continue;
            const nd = dist[c] + (k >= 4 ? SQRT2 : 1) * cost;
            if (nd < dist[nc]) { dist[nc] = nd; heap.push(nc, nd); }
          }
        }
      },
      dirAt(p, out) {
        if (f.dirty) f.build();
        const r = f.grid, dist = f.dist;
        out.x = 0; out.z = 0;
        if (!r || !dist) return false;
        const g = r.g;
        let c = cellOf(r, p.x, p.z);
        if (c < 0 || g.cost[c] === 0) c = nearestCell(r, p.x, p.z, 4);
        if (c < 0 || dist[c] === Infinity) return false;
        let tx: number, tz: number;
        if (dist[c] < 1.5 || (dist[c] < 8 && los(r, p.x, p.z, f.at.x, f.at.z))) { tx = f.at.x; tz = f.at.z; }
        else {
          const ix = c % g.w, iz = (c - ix) / g.w;
          let best = c, bd = dist[c];
          for (let k = 0; k < 8; k++) {
            const nx = ix + DX[k], nz = iz + DZ[k];
            if (nx < 0 || nz < 0 || nx >= g.w || nz >= g.h) continue;
            if (k >= 4 && (g.cost[iz * g.w + nx] === 0 || g.cost[nz * g.w + ix] === 0)) continue;
            const nc = nz * g.w + nx;
            if (dist[nc] < bd) { bd = dist[nc]; best = nc; }
          }
          tx = ccx(r, best); tz = ccz(r, best);
        }
        const dx = tx - p.x, dz = tz - p.z, m = Math.hypot(dx, dz);
        if (m < 1e-6) return true;
        out.x = dx / m; out.z = dz / m;
        return true;
      },
      distAt(p) {
        if (f.dirty) f.build();
        const r = f.grid, dist = f.dist;
        if (!r || !dist) return Infinity;
        const c = cellOf(r, p.x, p.z);
        return c < 0 ? Infinity : dist[c] * r.g.cell;
      },
    };
    return f;
  };

  const nbuf: number[] = [];
  const SEP_R = 0.7;
  const steering: Steering = {
    separate(agents: SoAStore, hash: SpatialHash, i: number, out: Vec2): Vec2 {
      const X = agents.f32('x'), Z = agents.f32('z');
      const x = X[i], z = Z[i];
      out.x = 0; out.z = 0;
      nbuf.length = 0;
      const n = hash.query(x, z, SEP_R, nbuf);
      for (let k = 0; k < n; k++) {
        const j = nbuf[k];
        if (j === i) continue;
        let dx = x - X[j], dz = z - Z[j];
        let d = Math.hypot(dx, dz);
        if (d < 1e-4) { dx = i < j ? 1 : -1; dz = ((i * 3 + j * 7) % 3) - 1; d = Math.hypot(dx, dz); }
        const w = (SEP_R - Math.min(SEP_R, d)) / SEP_R;
        out.x += (dx / d) * w; out.z += (dz / d) * w;
      }
      return out;
    },
  };

  /** Penetration of a circle into the solid rects (0 = free). Inside a rect counts radius + depth to its nearest edge. */
  const pen = (x: number, z: number, rad: number): number => {
    let p = 0;
    for (let i = 0; i < solidList.length; i++) {
      const r = solidList[i];
      if (x < r.x0 - rad || x > r.x1 + rad || z < r.z0 - rad || z > r.z1 + rad) continue;
      const cx = x < r.x0 ? r.x0 : x > r.x1 ? r.x1 : x, cz = z < r.z0 ? r.z0 : z > r.z1 ? r.z1 : z;
      const ddx = x - cx, ddz = z - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 > 0) { if (d2 < rad * rad) p += rad - Math.sqrt(d2); }
      else p += rad + Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
    }
    return p;
  };
  /** Pushes a circle out of every solid it overlaps (closest-point normal; from inside a box, out through the
   *  nearest face). Sequential, a few passes, so wall corners and wall + counter joints settle. */
  const depen = (x: number, z: number, rad: number, o: Vec2): Vec2 => {
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (let i = 0; i < solidList.length; i++) {
        const r = solidList[i];
        if (x <= r.x0 - rad || x >= r.x1 + rad || z <= r.z0 - rad || z >= r.z1 + rad) continue;
        const cx = x < r.x0 ? r.x0 : x > r.x1 ? r.x1 : x, cz = z < r.z0 ? r.z0 : z > r.z1 ? r.z1 : z;
        const ddx = x - cx, ddz = z - cz, d2 = ddx * ddx + ddz * ddz;
        if (d2 > 0) {
          if (d2 >= rad * rad) continue;
          const d = Math.sqrt(d2), k = (rad - d) / d + 1e-6;
          x += ddx * k; z += ddz * k;
        } else {
          const l = x - r.x0, rr = r.x1 - x, b = z - r.z0, t = r.z1 - z, m = Math.min(l, rr, b, t);
          if (m === l) x = r.x0 - rad - 1e-6; else if (m === rr) x = r.x1 + rad + 1e-6; else if (m === b) z = r.z0 - rad - 1e-6; else z = r.z1 + rad + 1e-6;
        }
        any = true;
      }
      if (!any) break;
    }
    o.x = x; o.z = z;
    return o;
  };
  /** Player movement: collide-and-slide against the exact solids (walls, counters, props as drawn, blocked paint),
   *  plus the walk grid for bounds. Steps are 6 cm, far less than any wall plus the radius, so the
   *  push-out always returns the mover to the side it came from: no tunnelling. */
  const _c = { x: 0, z: 0 };
  const moveSolid = (from: Vec2, to: Vec2, radius: number, out: Vec2): Vec2 => {
    // grid by the centre only: a blocked cell reaches at most 0.3 m past the solid it was baked from, less than the
    // radius, so the cells never stop the mover before the real face does (doors keep their drawn width)
    const gridOn = grids.length > 0 && free(from.x, from.z);
    const gOk = (x: number, z: number) => !gridOn || free(x, z);
    const tryAt = (x: number, z: number): boolean => {
      depen(x, z, radius, _c);
      return pen(_c.x, _c.z, radius) <= 1e-4 && gOk(_c.x, _c.z);
    };
    const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
    const n = Math.min(64, Math.max(1, Math.ceil(len / 0.06)));
    let x = from.x, z = from.z;
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      if (tryAt(x + sx, z + sz) || (Math.abs(sx) > 1e-9 && tryAt(x + sx, z)) || (Math.abs(sz) > 1e-9 && tryAt(x, z + sz))) {
        x = _c.x; z = _c.z;
        continue;
      }
      break;
    }
    out.x = x; out.z = z;
    return out;
  };

  const nav: Nav = {
    addGrid(g) {
      const key = g.zone ?? `grid${anon++}`;
      const idx = grids.findIndex((r) => r.key === key);
      const rec: GridRec = { g, key, base: g.cost.slice(), run: 0, x1: g.origin.x + g.w * g.cell, z1: g.origin.z + g.h * g.cell };
      if (idx >= 0) grids[idx] = rec; else grids.push(rec);
      applyBlocks();
    },
    removeGrid(zone) {
      const idx = grids.findIndex((r) => r.key === zone);
      if (idx >= 0) { grids[idx].g.cost.set(grids[idx].base); grids.splice(idx, 1); }
      applyBlocks();
    },
    path(from, to, opts) {
      try {
        const maxNodes = opts?.maxNodes ?? 6000;
        if (grids.length === 0) return [{ x: to.x, z: to.z }];
        const a = gridAt(from.x, from.z) ?? grids[0];
        const b = gridAt(to.x, to.z) ?? a;
        if (a === b) return astar(a, from, to, maxNodes);
        // Cross-zone: walk to each portal midpoint in turn.
        const ids = zonePath(a.key, b.key);
        if (!ids.length) return [];
        const out: Vec2[] = [];
        let cur: Vec2 = from, curGrid = a;
        for (const id of ids) {
          const p = portalById(id);
          if (!p) return [];
          const mid = { x: (p.portal.a.x + p.portal.b.x) / 2, z: (p.portal.a.z + p.portal.b.z) / 2 };
          const seg = astar(curGrid, cur, mid, maxNodes);
          if (!seg.length) return [];
          for (const v of seg) out.push(v);
          cur = mid;
          curGrid = grids.find((r) => r.key === p.portal.to) ?? curGrid;
        }
        const tail = astar(curGrid, cur, to, maxNodes);
        if (!tail.length) return [];
        for (const v of tail) out.push(v);
        return out;
      } catch (e) {
        deps.log?.warn('nav.path', e);
        return [];
      }
    },
    walkable(p) { return free(p.x, p.z); },
    nearestWalkable(p, out) {
      if (grids.length === 0 || free(p.x, p.z)) { out.x = p.x; out.z = p.z; return true; }
      let r = gridAt(p.x, p.z);
      if (!r) {
        let bd = Infinity;
        for (const g of grids) {
          const qx = Math.min(g.x1, Math.max(g.g.origin.x, p.x)), qz = Math.min(g.z1, Math.max(g.g.origin.z, p.z));
          const d = (qx - p.x) ** 2 + (qz - p.z) ** 2;
          if (d < bd) { bd = d; r = g; }
        }
      }
      if (!r) return false;
      const c = nearestCell(r, p.x, p.z, 64);
      if (c < 0) return false;
      out.x = ccx(r, c); out.z = ccz(r, c);
      return true;
    },
    move(from, to, radius, out, opts) {
      try {
        if (opts?.solids && solidList.length) return moveSolid(from, to, radius, out);
        if (grids.length === 0 || !freeR(from.x, from.z, radius)) { out.x = to.x; out.z = to.z; return out; }
        const dx = to.x - from.x, dz = to.z - from.z;
        const step = Math.max(0.05, minCell * 0.4);
        const n = Math.min(64, Math.max(1, Math.ceil(Math.hypot(dx, dz) / step)));
        let x = from.x, z = from.z;
        const sx = dx / n, sz = dz / n;
        for (let i = 0; i < n; i++) {
          if (freeR(x + sx, z + sz, radius)) { x += sx; z += sz; }
          else if (sx !== 0 && freeR(x + sx, z, radius)) x += sx;
          else if (sz !== 0 && freeR(x, z + sz, radius)) z += sz;
          else break;
        }
        out.x = x; out.z = z;
        return out;
      } catch (e) {
        deps.log?.warn('nav.move', e);
        out.x = from.x; out.z = from.z;
        return out;
      }
    },
    setSolids(key, rects) {
      if (rects.length) solids.set(key, rects.map((r) => ({ x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1), z0: Math.min(r.z0, r.z1), z1: Math.max(r.z0, r.z1) })));
      else solids.delete(key);
      solidList = ([] as Rect[]).concat(...solids.values());
    },
    defineTarget(id, at) {
      targets.set(id, { x: at.x, z: at.z });
      const f = flows.get(id);
      if (f) f.dirty = true;
    },
    flowTo(targetId) {
      let f = flows.get(targetId);
      if (!f) { f = makeFlow(targetId); flows.set(targetId, f); }
      return f;
    },
    zonePath,
    setBlocked(rect, on) {
      const k = blocks.findIndex((b) => b.x0 === rect.x0 && b.z0 === rect.z0 && b.x1 === rect.x1 && b.z1 === rect.z1);
      if (on) { if (k < 0) blocks.push({ ...rect }); }
      else if (k >= 0) blocks.splice(k, 1);
      applyBlocks();
    },
    hash(cell = 1) { return createSpatialHash(cell); },
    steering,
  };
  return nav;
}
