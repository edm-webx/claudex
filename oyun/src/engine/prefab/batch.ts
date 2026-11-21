/**
 * Geometry batch: merges many primitives into one BufferGeometry (vertex colours + atlas uv).
 * 1:1 port of v2 world.js `Batch` (and core.js `roundBox`) so prefab ports produce identical geometry.
 * Generic engine code: the atlas itself lives in content (content/prefabs/common/v2kit.ts), which sets
 * `Batch.white` (uv of a white texel) and resolves named regions.
 */
import * as T from 'three';

export type UVRect = [number, number, number, number];
/** Primitive options (v2 names): rx/ry/rz rotation, sx/sy/sz scale, r round radius, s round segments, seg, uv atlas rect, world metres per repeat. */
export interface PrimOpts {
  rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number;
  r?: number; s?: number; seg?: number; open?: boolean; ws?: number; hs?: number; tl?: number; d?: number;
  rs?: number; ts?: number; arc?: number; uv?: UVRect | null; world?: number; tint?: string;
}
export type ColorLike = string | T.Color | null | undefined;

export const PI = Math.PI, TAU = PI * 2, HP = PI / 2;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeInOut = (t: number): number => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const _cc: Record<string, T.Color> = {};
export const col = (c: string | T.Color): T.Color => (c as T.Color).isColor ? c as T.Color : (_cc[c as string] || (_cc[c as string] = new T.Color(c as string)));
export const mixc = (a: string | T.Color, b: string | T.Color, t: number): T.Color => col(a).clone().lerp(col(b), t);
export const shade = (c: string, k: number): T.Color => k >= 0 ? mixc(c, '#ffffff', k) : mixc(c, '#000000', -k);

const _e = new T.Euler(), _q = new T.Quaternion(), _p = new T.Vector3(), _s = new T.Vector3();
export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): T.Matrix4 {
  return new T.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
}

/** Shared geometry cache (v2 `C.geo` / `geoc`). Geometries here are shared by many batches; never dispose CPU data. */
const GEO: Record<string, T.BufferGeometry> = {};
export function geoc<G extends T.BufferGeometry>(k: string, make: () => G): G { return (GEO[k] || (GEO[k] = make())) as G; }

/** v2 core.js roundBox: rounded box (toy look), radius r, segments s. */
export function roundBox(w: number, h: number, d: number, r = 0.05, s = 2): T.BufferGeometry {
  return geoc(`rb${w}|${h}|${d}|${r}|${s}`, () => {
    const g = new T.BoxGeometry(w, h, d, s * 2, s * 2, s * 2), p = g.attributes.position, v = new T.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const c = new T.Vector3(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
      const n = v.clone().sub(c); if (n.lengthSq() > 0) n.normalize().multiplyScalar(r);
      p.setXYZ(i, c.x + n.x, c.y + n.y, c.z + n.z);
    }
    g.computeVertexNormals(); return g;
  });
}

const _mA = new T.Matrix4(), _n3 = new T.Matrix3(), _v = new T.Vector3(), _w = new T.Vector3();

export class Batch {
  /** uv of a white atlas texel; set by the content kit (v2 WU, WV). */
  static white: [number, number] = [0.5, 0.5];
  p: number[] = []; n: number[] = []; c: number[] = []; u: number[] = []; i: number[] = []; cnt = 0;
  st: T.Matrix4[] = [new T.Matrix4()];
  push(m: T.Matrix4): this { this.st.push(this.st[this.st.length - 1].clone().multiply(m)); return this; }
  at(x: number, y: number, z: number, ry = 0, s = 1): this { return this.push(mtx(x, y, z, 0, ry, 0, s, s, s)); }
  pop(): this { if (this.st.length > 1) this.st.pop(); return this; }
  add(g: T.BufferGeometry, color?: ColorLike, m?: T.Matrix4 | null, o?: PrimOpts): this {
    const top = this.st[this.st.length - 1];
    const M = m ? _mA.multiplyMatrices(top, m) : _mA.copy(top);
    _n3.getNormalMatrix(M);
    const flip = M.determinant() < 0;
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, CC = g.attributes.color;
    const base = this.cnt, cl = color != null ? col(color) : null;
    const rect = o && o.uv, world = o && o.world, keep = !rect && !world && g.userData.atlas;
    const WU = Batch.white[0], WV = Batch.white[1];
    for (let k = 0; k < P.count; k++) {
      _v.fromBufferAttribute(P as T.BufferAttribute, k).applyMatrix4(M); this.p.push(_v.x, _v.y, _v.z);
      if (N) _w.fromBufferAttribute(N as T.BufferAttribute, k).applyMatrix3(_n3).normalize(); else _w.set(0, 1, 0);
      this.n.push(_w.x, _w.y, _w.z);
      if (cl) this.c.push(cl.r, cl.g, cl.b); else if (CC) this.c.push(CC.getX(k), CC.getY(k), CC.getZ(k)); else this.c.push(1, 1, 1);
      if (rect && U) this.u.push(rect[0] + U.getX(k) * (rect[2] - rect[0]), rect[1] + U.getY(k) * (rect[3] - rect[1]));
      else if (world) {
        const ax = Math.abs(_w.x), ay = Math.abs(_w.y), az = Math.abs(_w.z);
        if (ay >= ax && ay >= az) this.u.push(_v.x / world, -_v.z / world); else if (ax >= az) this.u.push(_v.z / world, _v.y / world); else this.u.push(_v.x / world, _v.y / world);
      } else if (keep && U) this.u.push(U.getX(k), U.getY(k));
      else this.u.push(WU, WV);
    }
    const I = g.index ? g.index.array : null, n = I ? I.length : P.count;
    for (let k = 0; k < n; k += 3) {
      const a = I ? I[k] : k, b = I ? I[k + 1] : k + 1, c = I ? I[k + 2] : k + 2;
      if (flip) this.i.push(base + a, base + c, base + b); else this.i.push(base + a, base + b, base + c);
    }
    this.cnt += P.count;
    return this;
  }
  M(x: number, y: number, z: number, o: PrimOpts): T.Matrix4 { return mtx(x, y, z, o.rx || 0, o.ry || 0, o.rz || 0, o.sx || 1, o.sy || 1, o.sz || 1); }
  box(w: number, h: number, d: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this {
    let r = o.r != null ? o.r : Math.min(0.035, w * 0.18, h * 0.18, d * 0.18);
    r = Math.min(r, w * 0.45, h * 0.45, d * 0.45);
    const g = r > 0.004 ? roundBox(+w.toFixed(3), +h.toFixed(3), +d.toFixed(3), +r.toFixed(3), o.s || 1) : geoc(`B${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`, () => new T.BoxGeometry(w, h, d));
    return this.add(g, c, this.M(x, y, z, o), o);
  }
  cyl(rt: number, rb: number, h: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this {
    const seg = o.seg || 12, open = !!o.open;
    const g = geoc(`C${rt.toFixed(3)}|${rb.toFixed(3)}|${h.toFixed(3)}|${seg}|${open}`, () => new T.CylinderGeometry(rt, rb, h, seg, 1, open));
    return this.add(g, c, this.M(x, y, z, o), o);
  }
  sph(r: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this {
    const ws = o.ws || 12, hs = o.hs || 8, tl = o.tl || PI;
    const g = geoc(`S${r.toFixed(3)}|${ws}|${hs}|${tl.toFixed(3)}`, () => new T.SphereGeometry(r, ws, hs, 0, TAU, 0, tl));
    return this.add(g, c, this.M(x, y, z, o), o);
  }
  ico(r: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const g = geoc(`I${r.toFixed(3)}|${o.d || 1}`, () => new T.IcosahedronGeometry(r, o.d || 1)); return this.add(g, c, this.M(x, y, z, o), o); }
  cone(r: number, h: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const seg = o.seg || 12; const g = geoc(`K${r.toFixed(3)}|${h.toFixed(3)}|${seg}`, () => new T.ConeGeometry(r, h, seg)); return this.add(g, c, this.M(x, y, z, o), o); }
  tor(R0: number, r: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const rs = o.rs || 8, ts = o.ts || 20, arc = o.arc || TAU; const g = geoc(`T${R0.toFixed(3)}|${r.toFixed(3)}|${rs}|${ts}|${arc.toFixed(3)}`, () => new T.TorusGeometry(R0, r, rs, ts, arc)); return this.add(g, c, this.M(x, y, z, o), o); }
  lathe(pts: [number, number][], c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const seg = o.seg || 14; const key = 'L' + seg + pts.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(';'); const g = geoc(key, () => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), seg)); return this.add(g, c, this.M(x, y, z, o), o); }
  plane(w: number, h: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const g = geoc(`P${w.toFixed(3)}|${h.toFixed(3)}`, () => new T.PlaneGeometry(w, h)); return this.add(g, c, this.M(x, y, z, o), o); }
  label(w: number, h: number, rect: UVRect, x: number, y: number, z: number, o: PrimOpts = {}): this { return this.plane(w, h, o.tint || '#ffffff', x, y, z, Object.assign({}, o, { uv: rect })); }
  cap(r: number, len: number, c: ColorLike, x: number, y: number, z: number, o: PrimOpts = {}): this { const g = geoc(`Q${r.toFixed(3)}|${len.toFixed(3)}`, () => new T.CapsuleGeometry(r, len, 3, 8)); return this.add(g, c, this.M(x, y, z, o), o); }
  /** A box from two corners (x0..x1, y0..y1, z0..z1). */
  span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: ColorLike, o: PrimOpts = {}): this { return this.box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), c, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, o); }
  get empty(): boolean { return this.cnt === 0; }
  geometry(): T.BufferGeometry {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.cnt > 65535 ? new T.Uint32BufferAttribute(this.i, 1) : new T.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.userData.atlas = true;
    return g;
  }
  mesh(mat: T.Material, cast = true, recv = true): T.Mesh { const m = new T.Mesh(this.geometry(), mat); m.castShadow = cast; m.receiveShadow = recv; return m; }
}
