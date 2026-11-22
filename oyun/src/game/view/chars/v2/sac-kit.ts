/* Saç / sakal / bıyık kiti (Karakter Atölyesi, 2026-11-21).
   Real 3D hair for heroes, built in code (no asset files): every piece is { g, m, k, sh } like chars-v2 hairPieces,
   g in head space (head centre at origin, sphere radius R, front +Z, up +Y, before the head's HM scale),
   k the colour key ('hair' | 'trim'), sh an optional per-vertex brightness (strand grooves, roots, sheen).
   Builders:
   - shell: a scalp-hugging surface on a grid whose pole is the style's crown (whorl / part / tie point), so strand
     grooves radiate from it; a hairline mask melts the edge into the scalp (no hard band), thickness per style.
   - curtain: long hair hanging from the head, a closed slab (outer + inner + edges) that drapes clear of neck,
     shoulders and back, with strand grooves and pointed clumps at the tips.
   - tube: swept rope along a curve (ponytail, braid strands, coiled buns, locs, mustaches) with groove ridges.
   - beard: a shell over cheeks/jaw/chin with a mouth hole, plus a closed tapered drop for long beards.
   Pieces are cached by key (style + hat + girth); chars-v2 copies them into the hero's one merged geometry. */
import * as T from 'three';

export interface KitPiece { g: T.BufferGeometry; m: T.Matrix4; k: string; sh?: Float32Array }
export interface KitOpts { hat?: boolean; girth?: number; /** 0 = hero close-up (player, online players), 1 = NPC (about a quarter of the triangles) */ lod?: number }
let LOD = 0;   // set while a style is being built (cached per lod)

const PI = Math.PI, TAU = PI * 2;
const ID = new T.Matrix4();
const sstep = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const ridge = (x: number) => Math.pow(Math.abs(Math.sin(x)), 0.55);   // round strand tops, sharp V grooves
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dirTA = (th: number, a: number) => new T.Vector3(Math.sin(th) * Math.sin(a), Math.cos(th), Math.sin(th) * Math.cos(a));
const HEAD_Y = 1.565, HS_Y = 1.03;   // chars-v2 buildHeroMesh: head centre height and the head's vertical scale

/* ---------- hairline mask (θ polar from the top, a around: 0 = front, ±π/2 = ears) ---------- */
interface HL { f?: number; t?: number; s?: number; b?: number; burn?: number; ear?: boolean; soft?: number; fringe?: number; fringeW?: number; fringeA?: number }
function hairline(o: HL) {
  const f = o.f ?? 0.98, t = o.t ?? 1.12, s = o.s ?? 1.42, b = o.b ?? 2.05, soft = o.soft ?? 0.07;
  return (th: number, a: number) => {
    const aa = Math.abs(a);
    let line = aa < 0.55 ? f + (t - f) * sstep(0, 0.55, aa) : aa < 1.35 ? t + (s - t) * sstep(0.55, 1.35, aa) : s + (b - s) * sstep(1.35, 2.3, aa);
    if (o.burn && o.burn > line) line += (o.burn - line) * Math.exp(-Math.pow((aa - 1.3) / 0.1, 2));
    if (o.fringe) { const fa = a - (o.fringeA ?? 0); line = Math.max(line, line + (o.fringe - line) * Math.exp(-Math.pow(fa / (o.fringeW ?? 0.75), 4))); }
    let c = sstep(line + soft, line - soft, th);
    if (o.ear !== false) { const d = Math.hypot((aa - 1.57) / 0.3, (th - 1.62) / 0.3); if (d < 1) c *= sstep(0.72, 1, d); }
    return c;
  };
}

/* ---------- body clearance: how far from the head axis hair must stay at a given head-space height ---------- */
function clearR(yHead: number, a: number, g: number, R: number) {
  const yw = HEAD_Y + yHead * HS_Y;
  if (yw > 1.43) return 0;
  const k = sstep(1.43, 1.3, yw);                     // neck -> shoulders
  const ax = 0.11 + k * (0.205 * g + 0.05 + 0.1 - 0.11), az = 0.11 + k * (0.205 * g - 0.11) + 0.02;
  return 1 / Math.sqrt(Math.pow(Math.sin(a) / ax, 2) + Math.pow(Math.cos(a) / az, 2)) + 0.028 + 0 * R;
}

/* ---------- geometry finish ---------- */
function geo(pos: number[], idx: number[], sh: number[]): { g: T.BufferGeometry; sh: Float32Array } {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return { g, sh: new Float32Array(sh) };
}

/* ---------- shell ---------- */
interface ShellO {
  crown: [number, number, number]; cover: (th: number, a: number, d: T.Vector3) => number;
  thick: (th: number, a: number, d: T.Vector3, s: number) => number;
  grooves?: number; gAmp?: number; wob?: number; nA?: number; nP?: number; pMax?: number;
  bumps?: { n: number; r: number; amp: number; seed: number }; grain?: number; sheen?: number; lift?: number;
}
function shell(R: number, o: ShellO): KitPiece {
  const c = new T.Vector3(...o.crown).normalize();
  const e1 = new T.Vector3(0, 0, 1).addScaledVector(c, -c.z); if (e1.lengthSq() < 1e-4) e1.set(1, 0, 0).addScaledVector(c, -c.x); e1.normalize();
  const e2 = new T.Vector3().crossVectors(c, e1);
  const nA = Math.round((o.nA ?? 50) * (LOD ? 0.56 : 1)), nP = Math.round((o.nP ?? 20) * (LOD ? 0.5 : 1)), pMax = o.pMax ?? PI * 0.82, N = o.grooves ?? 0, gAmp = o.gAmp ?? 0, lift = o.lift ?? 0.028;
  let bp: T.Vector3[] = [];
  if (o.bumps) { const r = rng(o.bumps.seed); for (let i = 0; i < o.bumps.n; i++) { const y = 1 - 2 * (i + 0.5) / o.bumps.n, rr = Math.sqrt(1 - y * y), ph = i * 2.39996 + r() * 0.6; bp.push(new T.Vector3(Math.cos(ph) * rr, y, Math.sin(ph) * rr).add(new T.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.12)).normalize()); } }
  const bumpCos = o.bumps ? Math.cos(o.bumps.r) : 1;
  const pos: number[] = [], sh: number[] = [], cov: number[] = [], idx: number[] = [];
  const d = new T.Vector3();
  const dirAt = (s: number, t: number) => d.copy(c).multiplyScalar(Math.cos(s)).addScaledVector(e1, Math.sin(s) * Math.cos(t)).addScaledVector(e2, Math.sin(s) * Math.sin(t)).normalize();
  const covAt = (s: number, t: number) => { dirAt(s, t); return o.cover(Math.acos(Math.max(-1, Math.min(1, d.y))), Math.atan2(d.x, d.z), d); };
  // rows follow the hairline: per column, march out from the crown to where the cover fades, then refine; the last row
  // sits exactly on the edge (inside the scalp), so the hairline is a smooth curve instead of grid stair-steps
  const edge: number[] = [];
  for (let j = 0; j < nA; j++) {
    const t = TAU * j / nA; let sE = pMax;
    for (let s = 0.04; s <= pMax; s += 0.04) if (covAt(s, t) < 0.02) { let lo = s - 0.04, hi = s; for (let k = 0; k < 6; k++) { const m = (lo + hi) / 2; if (covAt(m, t) < 0.02) hi = m; else lo = m; } sE = hi; break; }
    edge.push(sE);
  }
  // smooth the edge a little across columns so single-column spikes do not show
  const edgeS = edge.map((e, j) => (edge[(j + nA - 1) % nA] + 2 * e + edge[(j + 1) % nA]) / 4);
  const vert = (s: number, t: number, last: boolean) => {
    dirAt(s, t);
    const th = Math.acos(Math.max(-1, Math.min(1, d.y))), a = Math.atan2(d.x, d.z);
    const cv = last ? 0 : o.cover(th, a, d), cc = sstep(0, 1, cv);
    const tk = Math.max(0, o.thick(th, a, d, s));
    let gr = 0.5;
    if (N) { const x = t * N / 2 + (o.wob ?? 0) * Math.sin(s * 7 + t * 3); gr = ridge(x) * (0.8 + 0.2 * hash(Math.floor(t * N / TAU + 0.5))); }
    let bump = 0;
    if (bp.length) { for (const p of bp) { const dt = p.dot(d); if (dt > bumpCos) { const k = 1 - Math.acos(Math.min(1, dt)) / o.bumps!.r; bump = Math.max(bump, k * k * (3 - 2 * k)); } } }
    const amp = N ? gAmp * (tk > 0.02 ? 1 : 0.35) * sstep(0.05, 0.7, s) : 0;   // grooves fade into the whorl
    const r = R * (0.982 + cc * (lift + tk + amp * gr + (o.bumps ? o.bumps.amp * bump : 0)));
    pos.push(d.x * r, d.y * r, d.z * r); cov.push(last ? 1 : cv);
    let b = (N ? 0.82 + 0.2 * gr + 0.05 * ridge(t * N * 0.85 + 1.3) : 0.94) * (0.9 + 0.1 * cc);
    if (o.bumps) b *= 0.78 + 0.32 * bump;
    if (o.grain) b *= 1 - o.grain * hash(pos.length * 0.37);
    b += (o.sheen ?? 0.08) * Math.exp(-Math.pow((d.y - 0.78) / 0.11, 2)) * (N ? gr : 0.7);
    sh.push(b);
  };
  vert(0, 0, false);                                  // pole (crown)
  for (let i = 1; i <= nP; i++) { const u = i / nP, f = 1 - Math.pow(1 - u, 1.35); for (let j = 0; j < nA; j++) vert(edgeS[j] * f, TAU * j / nA, i === nP); }
  const id = (i: number, j: number) => i === 0 ? 0 : 1 + (i - 1) * nA + (j % nA);
  for (let j = 0; j < nA; j++) idx.push(0, id(1, j), id(1, j + 1));
  for (let i = 1; i < nP; i++) for (let j = 0; j < nA; j++) {
    const a = id(i, j), b = id(i, j + 1), cI = id(i + 1, j), dI = id(i + 1, j + 1);
    idx.push(a, cI, dI, a, dI, b);
  }
  const r = geo(pos, idx, sh);
  return { g: r.g, m: ID, k: 'hair', sh: r.sh };
}

/* ---------- curtain (long hair) ---------- */
interface CurtO {
  a0: number; a1: number; th0: number; len: (a: number) => number; thick?: number; grooves?: number; gAmp?: number;
  r0?: number; flare?: number; curl?: number; wave?: { amp: number; freq: number }; nA?: number; nS?: number; girth?: number; blunt?: boolean; seed?: number;
}
function curtain(R: number, o: CurtO): KitPiece {
  const nA = Math.round((o.nA ?? 48) * (LOD ? 0.5 : 1)), nS = Math.round((o.nS ?? 14) * (LOD ? 0.55 : 1)), N = o.grooves ?? 18, gAmp = o.gAmp ?? 0.03, g = o.girth ?? 1, th = (o.thick ?? 0.1) * R;
  const outer: T.Vector3[][] = [], inner: T.Vector3[][] = [], shO: number[][] = [];
  for (let j = 0; j <= nA; j++) {
    const u = j / nA, a = o.a0 + (o.a1 - o.a0) * u;
    const edge = sstep(0, 0.12, u) * sstep(1, 0.88, u);
    const gr = ridge(u * N * PI) * (0.75 + 0.25 * hash(Math.floor(u * N) + (o.seed ?? 0)));
    const L = o.len(a) * R * (o.blunt ? 1 : 0.9 + 0.1 * gr);
    const p0 = dirTA(o.th0, a).multiplyScalar(R * (1 + (o.r0 ?? 0.04)));
    const rho0 = Math.hypot(p0.x, p0.z);
    const ro: T.Vector3[] = [], ri: T.Vector3[] = [], so: number[] = [];
    for (let i = 0; i <= nS; i++) {
      const s = i / nS, y = p0.y - s * L;
      let rho = rho0 * (1 + (o.flare ?? 0.12) * Math.sin(Math.min(1, s * 1.6) * PI / 2)) + R * gAmp * gr * edge;
      if (o.curl) rho -= o.curl * R * sstep(0.7, 1, s);                // bob: tips curl under
            // below the neck the sides tuck behind the shoulders (hair is on the head bone, so it must not drape over them)
      const k = sstep(1.45, 1.22, HEAD_Y + y * HS_Y);
      const at = PI + (a - PI) * (1 - 0.58 * k);
      if (k > 0) { const need = clearR(y, at, g, R); rho = Math.max(rho, need + rho * 0.02); }
      let aw = at;
      if (o.wave) { const w = Math.sin(s * L / R * o.wave.freq + a * 2.3) * sstep(0, 0.25, s); rho += w * o.wave.amp * R; aw += w * o.wave.amp * 0.5 * edge; }
      const tk = th * (1 - 0.65 * s) * (0.55 + 0.45 * edge);
      ro.push(new T.Vector3(Math.sin(aw) * rho, y, Math.cos(aw) * rho));
      ri.push(new T.Vector3(Math.sin(aw) * (rho - tk), y + tk * 0.3, Math.cos(aw) * (rho - tk)));
      so.push((0.78 + 0.26 * gr) * (1 - 0.12 * s) + 0.07 * Math.exp(-Math.pow((s - 0.12) / 0.08, 2)));
    }
    outer.push(ro); inner.push(ri); shO.push(so);
  }
  const pos: number[] = [], sh: number[] = [], idx: number[] = [];
  const put = (v: T.Vector3, b: number) => { pos.push(v.x, v.y, v.z); sh.push(b); return pos.length / 3 - 1; };
  const grid = (G: T.Vector3[][], flip: boolean, dim: number) => {
    const base = pos.length / 3;
    for (let j = 0; j <= nA; j++) for (let i = 0; i <= nS; i++) put(G[j][i], shO[j][i] * dim);
    const at = (j: number, i: number) => base + j * (nS + 1) + i;
    for (let j = 0; j < nA; j++) for (let i = 0; i < nS; i++) {
      const a = at(j, i), b = at(j + 1, i), c = at(j, i + 1), d = at(j + 1, i + 1);
      if (flip) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
  };
  grid(outer, false, 1); grid(inner, true, 0.62);
  // closing strips: bottom tips, both side edges (separate vertices so the edge normals stay crisp)
  const strip = (A: T.Vector3[], B: T.Vector3[], b: number, flip: boolean) => {
    for (let k = 0; k < A.length - 1; k++) {
      const a = put(A[k], b), bb = put(A[k + 1], b), c = put(B[k], b * 0.7), d = put(B[k + 1], b * 0.7);
      if (flip) idx.push(a, c, d, a, d, bb); else idx.push(a, d, c, a, bb, d);
    }
  };
  strip(outer.map(r => r[nS]), inner.map(r => r[nS]), 0.72, false);
  strip(outer[0], inner[0], 0.7, true);
  strip(outer[nA], inner[nA], 0.7, false);
  const r = geo(pos, idx, sh);
  return { g: r.g, m: ID, k: 'hair', sh: r.sh };
}

/* ---------- tube ---------- */
interface TubeO { rad: (t: number) => number; seg?: number; sides?: number; grooves?: number; gAmp?: number; twist?: number; rings?: number; ringAmp?: number; k?: string; dim?: number; phase?: number }
function tube(pts: T.Vector3[], o: TubeO): KitPiece {
  const curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
  const seg = Math.max(3, Math.round((o.seg ?? 16) * (LOD ? 0.5 : 1))), sides = Math.max(4, (o.sides ?? 8) - (LOD ? 2 : 0));
  const fr = curve.computeFrenetFrames(seg, false);
  const pos: number[] = [], sh: number[] = [], idx: number[] = [];
  const P = new T.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; curve.getPointAt(t, P);
    const r0 = o.rad(t), ring = o.rings ? 1 + (o.ringAmp ?? 0.12) * Math.sin(t * o.rings * TAU) : 1;
    for (let j = 0; j < sides; j++) {
      const ang = (j / sides) * TAU + (o.twist ?? 0) * t * TAU + (o.phase ?? 0);
      const gr = o.grooves ? ridge(ang * o.grooves / 2) : 0.5;
      const rr = r0 * ring * (1 + (o.gAmp ?? 0) * (gr - 0.5));
      const n = new T.Vector3().addScaledVector(fr.normals[i], Math.cos(ang)).addScaledVector(fr.binormals[i], Math.sin(ang));
      pos.push(P.x + n.x * rr, P.y + n.y * rr, P.z + n.z * rr);
      sh.push(((o.grooves ? 0.8 + 0.25 * gr : 0.95) * (o.rings ? 0.9 + 0.1 * ring : 1)) * (o.dim ?? 1));
    }
  }
  const at = (i: number, j: number) => i * sides + (j % sides);
  for (let i = 0; i < seg; i++) for (let j = 0; j < sides; j++) { const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1); idx.push(a, c, d, a, d, b); }
  // caps: fan to the end centres
  const c0 = pos.length / 3; curve.getPointAt(0, P); pos.push(P.x, P.y, P.z); sh.push(0.8 * (o.dim ?? 1));
  const c1 = pos.length / 3; curve.getPointAt(1, P); pos.push(P.x, P.y, P.z); sh.push(0.8 * (o.dim ?? 1));
  for (let j = 0; j < sides; j++) { idx.push(c0, at(0, j + 1), at(0, j)); idx.push(c1, at(seg, j), at(seg, j + 1)); }
  const r = geo(pos, idx, sh);
  return { g: r.g, m: ID, k: o.k ?? 'hair', sh: r.sh };
}

/* ---------- small helpers built on the above ---------- */
const onHead = (R: number, th: number, a: number, k = 1) => dirTA(th, a).multiplyScalar(R * k);
function tie(R: number, at: T.Vector3, nrm: T.Vector3, r = 0.13): KitPiece {
  const g = new T.TorusGeometry(R * r, R * 0.045, 6, 14);
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), nrm.clone().normalize());
  return { g, m: new T.Matrix4().compose(at, q, new T.Vector3(1, 1, 1)), k: 'trim' };
}
/** coiled bun: a rope wound in a shrinking spiral on a dome, sitting on the head at direction (th, a) */
function coilBun(R: number, th: number, a: number, size = 1): KitPiece[] {
  const n = dirTA(th, a), base = n.clone().multiplyScalar(R * 0.98);
  const up = n.clone(), side = new T.Vector3(0, 1, 0).cross(up); if (side.lengthSq() < 1e-4) side.set(1, 0, 0); side.normalize();
  const fwd = new T.Vector3().crossVectors(up, side);
  const pts: T.Vector3[] = [], turns = 2.6, steps = 30, br = 0.36 * R * size;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, ang = t * turns * TAU, rr = br * (1 - 0.72 * t), h = R * size * (0.1 + 0.36 * Math.sin(t * PI * 0.55));
    pts.push(base.clone().addScaledVector(side, Math.cos(ang) * rr).addScaledVector(fwd, Math.sin(ang) * rr).addScaledVector(up, h));
  }
  return [tube(pts, { rad: t => R * size * (0.13 - 0.05 * t), seg: 60, sides: 8, grooves: 6, gAmp: 0.22 }), tie(R, base.clone().addScaledVector(up, R * 0.06 * size), up, 0.3 * size)];
}
/** 3-strand braid along a path (pts), width w, ending in a tie and a short tuft */
function braid(R: number, path: T.Vector3[], w: number, cross = 7): KitPiece[] {
  const curve = new T.CatmullRomCurve3(path, false, 'centripetal');
  const fr = curve.computeFrenetFrames(60, false), out: KitPiece[] = [];   // path frames (60 samples), strands below use fewer segments
  for (let s = 0; s < 3; s++) {
    const pts: T.Vector3[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, ph = t * cross * TAU + s * TAU / 3, k = (1 - 0.45 * t) * w * R;
      pts.push(curve.getPointAt(t).addScaledVector(fr.binormals[i], Math.sin(ph) * k).addScaledVector(fr.normals[i], Math.sin(2 * ph) * k * 0.35));
    }
    out.push(tube(pts, { rad: t => R * w * (0.62 - 0.3 * t), seg: 40, sides: 6, grooves: 4, gAmp: 0.18, dim: 0.96 + s * 0.03 }));
  }
  const end = curve.getPointAt(1), tan = curve.getTangentAt(1);
  out.push(tie(R, end, tan, w * 0.55));
  out.push(tube([end, end.clone().addScaledVector(tan, R * 0.22), end.clone().addScaledVector(tan, R * 0.4)], { rad: t => R * w * 0.5 * (1 - t * 0.85), seg: 6, sides: 8, grooves: 7, gAmp: 0.35 }));
  return out;
}
/** a hanging path that stays clear of the body: from p0, out by `out` (R units) along the horizontal of angle a, down to yEnd */
function hangPath(R: number, p0: T.Vector3, a: number, out: number, yEnd: number, g: number, n = 6, tuck = true): T.Vector3[] {
  const pts = [p0.clone()];
  for (let i = 1; i <= n; i++) {
    const t = i / n, y = p0.y + (yEnd * R - p0.y) * t * t * 0.4 + (yEnd * R - p0.y) * t * 0.6;
    let rho = Math.hypot(p0.x, p0.z) + out * R * Math.sin(Math.min(1, t * 2.2) * PI / 2);
    const k = tuck ? sstep(1.45, 1.22, HEAD_Y + y * HS_Y) : 0, at = PI * Math.sign(a || 1) + (a - PI * Math.sign(a || 1)) * (1 - 0.5 * k);
    rho = Math.max(rho, clearR(y, at, g, R) + 0.02);
    pts.push(new T.Vector3(Math.sin(at) * rho, y, Math.cos(at) * rho));
  }
  return pts;
}
function spike(R: number, th: number, a: number, h: number, w: number, back = 0.3, flat = 0.5): KitPiece {
  const g = new T.ConeGeometry(R * w, R * h, 7, 1); g.translate(0, R * h / 2, 0); g.scale(flat, 1, 1);
  const n = dirTA(th, a), up = dirTA(th + back, a).normalize();
  const thinAx = new T.Vector3(Math.cos(a), 0, -Math.sin(a)); thinAx.addScaledVector(up, -thinAx.dot(up)).normalize();
  const third = new T.Vector3().crossVectors(thinAx, up);
  const m = new T.Matrix4().makeBasis(thinAx, up, third).setPosition(n.multiplyScalar(R * 0.97));
  const sh = new Float32Array(g.attributes.position.count).map((_, i) => 0.78 + 0.3 * (g.attributes.position.getY(i) / (R * h)));
  return { g, m, k: 'hair', sh };
}

/* =====================================================================
   HAIR STYLES
   ===================================================================== */
const TOP = (th: number, from = 1.5, to = 0.6) => sstep(from, to, th);
type Maker = (R: number, o: KitOpts) => KitPiece[];
const thin = (o: KitOpts, v: number) => o.hat ? Math.min(v, 0.016) : v;
const HAIR: Record<string, Maker> = {
  bald: () => [],
  buzz: (R) => [shell(R, { crown: [0, 1, -0.2], cover: hairline({ f: 1.0, burn: 1.62 }), thick: () => 0.008, grain: 0.22, sheen: 0.02, lift: 0.02, nA: 40, nP: 20 })],
  short: (R, o) => [shell(R, { crown: [-0.38, 0.9, 0.2], cover: hairline({ burn: 1.66 }), thick: (th) => thin(o, 0.018 + 0.055 * TOP(th)), grooves: 22, gAmp: 0.022, wob: 0.15 })],
  sport: (R, o) => [shell(R, { crown: [0, 1, 0.25], cover: hairline({ f: 0.96, burn: 1.58 }), thick: (th) => thin(o, 0.006 + 0.07 * TOP(th, 1.2, 0.75)), grooves: 26, gAmp: 0.03, wob: 0.35 })],
  sidepart: (R, o) => [shell(R, { crown: [-0.6, 0.78, 0.18], cover: hairline({ f: 1.04, burn: 1.66 }), thick: (th, a) => thin(o, 0.02 + 0.075 * TOP(th, 1.45, 0.6) + 0.03 * sstep(0, 0.8, a) * TOP(th)), grooves: 20, gAmp: 0.026, wob: 0.1 })],
  pomp: (R, o) => [shell(R, { crown: [0, 0.35, -0.94], cover: hairline({ f: 0.95, burn: 1.62 }), thick: (th, a) => thin(o, 0.016 + 0.05 * TOP(th, 1.3, 0.7) + 0.16 * Math.exp(-Math.pow(a / 0.75, 2)) * sstep(1.18, 0.82, th) * sstep(0.05, 0.6, th)), grooves: 18, gAmp: 0.024, wob: 0.12, nP: 24 })],
  slick: (R, o) => [shell(R, { crown: [0, 0.2, -1], cover: hairline({ f: 0.98, burn: 1.62 }), thick: (th) => thin(o, 0.03 + 0.012 * TOP(th)), grooves: 30, gAmp: 0.008, sheen: 0.2 })],
  undercut: (R, o) => [shell(R, { crown: [0, 0.3, -0.95], cover: hairline({ f: 0.97, burn: 1.5 }), thick: (th, a) => thin(o, 0.005 + 0.1 * sstep(1.2, 1.05, th) * sstep(1.0, 0.75, Math.abs(Math.sin(a)) * Math.sin(th))), grooves: 16, gAmp: 0.03, wob: 0.18, nP: 24 })],
  mohawk: (R, o) => {
    const P = [shell(R, { crown: [0, 1, 0], cover: hairline({ f: 1.0, burn: 1.55 }), thick: (_t, _a, d) => thin(o, 0.004 + 0.07 * sstep(0.24, 0.1, Math.abs(d.x))), grain: 0.2, grooves: 30, gAmp: 0.01, nA: 48 })];
    if (o.hat) return P;
    // crest from the forehead over the top to the nape, every spike swept back
    [[1.0, 0, 0.42], [0.72, 0, 0.55], [0.44, 0, 0.62], [0.16, 0, 0.64], [0.14, PI, 0.6], [0.44, PI, 0.55], [0.76, PI, 0.46], [1.08, PI, 0.36]]
      .forEach(([th, a, h]) => P.push(spike(R, th, a, h, 0.16, a === 0 ? -0.32 : 0.32, 0.4)));
    return P;
  },
  spiky: (R, o) => {
    const P = [shell(R, { crown: [0, 1, 0.1], cover: hairline({ f: 0.97, burn: 1.6 }), thick: (th) => 0.016 + 0.035 * TOP(th), grooves: 24, gAmp: 0.02 })];
    if (!o.hat) { const r = rng(17); for (let i = 0; i < 16; i++) { const th = 0.15 + r() * 0.95, a = (i / 16) * TAU + r() * 0.3; if (Math.abs(a - TAU) < 0.5 || a < 0.5) { if (th > 0.85) continue; } P.push(spike(R, th, a, 0.3 + r() * 0.16, 0.13, 0.25, 0.7)); } }
    return P;
  },
  curly: (R, o) => [shell(R, { crown: [0, 1, 0], cover: hairline({ f: 0.95, burn: 1.6, s: 1.46 }), thick: (th) => thin(o, 0.03 + 0.07 * TOP(th, 1.6, 0.7)), bumps: o.hat ? undefined : { n: 90, r: 0.24, amp: 0.075, seed: 5 }, nA: 56, nP: 24 })],
  afro: (R, o) => [shell(R, { crown: [0, 1, -0.15], cover: hairline({ f: 0.97, s: 1.62, b: 2.12, ear: false }), thick: (th, a) => o.hat ? 0.02 : 0.1 + 0.25 * TOP(th, 1.9, 0.5) * (0.75 + 0.25 * sstep(0.4, 1.4, Math.abs(a))), bumps: o.hat ? undefined : { n: 140, r: 0.2, amp: 0.07, seed: 9 }, nA: 56, nP: 24, pMax: PI * 0.9 })],
  manbun: (R, o) => [shell(R, { crown: [0, 0.62, -0.78], cover: hairline({ f: 0.98, s: 1.5, burn: 1.62 }), thick: () => thin(o, 0.034), grooves: 26, gAmp: 0.012, sheen: 0.12 }), ...(o.hat ? [] : coilBun(R, 0.62, PI, 0.75))],
  locs: (R, o) => {
    const g = o.girth ?? 1;
    const P = [shell(R, { crown: [0, 1, 0], cover: hairline({ f: 0.98, ear: false }), thick: () => 0.03, grooves: 28, gAmp: 0.025 })];
    const r = rng(41);
    for (let i = 0; i < 20; i++) {
      const a = PI + (i / 19 - 0.5) * 2 * 2.15 + (r() - 0.5) * 0.12, th = 0.5 + r() * (Math.abs(Math.sin(a / 2)) > 0.9 ? 0.9 : 0.6);
      const p0 = onHead(R, th, a, 1.03), len = -(1.1 + r() * 0.7 + 0.5 * Math.abs(Math.cos(a / 2)));
      P.push(tube(hangPath(R, p0, a, 0.14, len, g, 5), { rad: t => R * (0.085 - 0.02 * t), seg: 10, sides: 5, rings: 8, ringAmp: 0.14, dim: 0.9 + r() * 0.15 }));
    }
    return P;
  },
  mullet: (R, o) => [
    shell(R, { crown: [0, 1, 0.1], cover: hairline({ f: 0.97, burn: 1.62, b: 2.15 }), thick: (th) => thin(o, 0.02 + 0.05 * TOP(th)), grooves: 22, gAmp: 0.025, wob: 0.2 }),
    curtain(R, { a0: PI - 1.15, a1: PI + 1.15, th0: 1.78, len: a => 1.25 - 0.45 * Math.pow(Math.abs(a - PI) / 1.15, 2), thick: 0.09, grooves: 12, gAmp: 0.04, flare: 0.18, wave: { amp: 0.04, freq: 2.4 }, girth: o.girth, nA: 30, nS: 10 }),
  ],
  wavy: (R, o) => [
    shell(R, { crown: [0.25, 0.96, 0.1], cover: hairline({ f: 0.97, s: 1.55, ear: false }), thick: (th) => thin(o, 0.03 + 0.06 * TOP(th)), grooves: 20, gAmp: 0.028, wob: 0.3 }),
    curtain(R, { a0: 0.95, a1: TAU - 0.95, th0: 1.42, len: a => 0.75 + 0.25 * Math.pow(Math.abs(a - PI) < 1.2 ? 1 : 0.5, 1), thick: 0.11, grooves: 16, gAmp: 0.04, flare: 0.16, wave: { amp: 0.06, freq: 3.2 }, girth: o.girth, nA: 44, nS: 12, seed: 3 }),
  ],
  loose: (R, o) => [
    shell(R, { crown: [0.2, 1, 0.3], cover: hairline({ f: 1.0, fringe: 1.18, fringeW: 0.55, fringeA: 0.15, s: 1.55, ear: false }), thick: (th) => thin(o, 0.04 + 0.05 * TOP(th, 1.7, 0.6)), grooves: 14, gAmp: 0.04, wob: 0.5, bumps: o.hat ? undefined : { n: 36, r: 0.36, amp: 0.035, seed: 2 } }),
    curtain(R, { a0: 1.1, a1: TAU - 1.1, th0: 1.5, len: () => 0.5, thick: 0.1, grooves: 12, gAmp: 0.05, flare: 0.08, wave: { amp: 0.05, freq: 4 }, girth: o.girth, nA: 36, nS: 8, seed: 5 }),
  ],
  long: (R, o) => [
    shell(R, { crown: [0, 1, 0.22], cover: hairline({ f: 0.97, s: 1.6, ear: false }), thick: (th) => thin(o, 0.028 + 0.03 * TOP(th)), grooves: 24, gAmp: 0.018, sheen: 0.12 }),
    curtain(R, { a0: 0.82, a1: TAU - 0.82, th0: 1.42, len: a => 0.85 + 2.45 * Math.pow(Math.cos((a - PI) / 2.6 * PI / 2), 2), thick: 0.12, grooves: 22, gAmp: 0.03, flare: 0.05, girth: o.girth, nA: 44, nS: 14, seed: 7 }),
  ],
  bob: (R, o) => [
    shell(R, { crown: [0, 1, -0.1], cover: hairline({ f: 0.95, fringe: o.hat ? 1.0 : 1.26, fringeW: 0.62, s: 1.6, ear: false }), thick: (th, a) => thin(o, 0.04 + 0.04 * TOP(th) + 0.03 * Math.exp(-Math.pow(a / 0.6, 2)) * sstep(0.8, 1.15, th)), grooves: 26, gAmp: 0.016, sheen: 0.14 }),
    curtain(R, { a0: 0.62, a1: TAU - 0.62, th0: 1.4, len: () => 0.95, thick: 0.13, grooves: 26, gAmp: 0.014, flare: 0.14, curl: 0.12, blunt: true, girth: o.girth, nA: 50, nS: 10 }),
  ],
  pixie: (R, o) => [shell(R, { crown: [0.45, 0.85, 0.25], cover: hairline({ f: 1.0, fringe: 1.2, fringeW: 0.5, fringeA: -0.25, b: 1.95, burn: 1.66 }), thick: (th, a) => thin(o, 0.02 + 0.06 * TOP(th, 1.4, 0.6) + 0.035 * Math.exp(-Math.pow((a + 0.2) / 0.5, 2)) * sstep(0.7, 1.1, th)), grooves: 22, gAmp: 0.03, wob: 0.25 })],
  bun: (R, o) => [shell(R, { crown: [0, 0.72, -0.7], cover: hairline({ f: 0.97, s: 1.5 }), thick: () => thin(o, 0.03), grooves: 30, gAmp: 0.012, sheen: 0.14 }), ...(o.hat ? [] : coilBun(R, 0.78, PI, 1))],
  ponytail: (R, o) => {
    const g = o.girth ?? 1, th0 = o.hat ? 1.55 : 1.05, at = onHead(R, th0, PI, 1.04), n = dirTA(th0, PI);
    return [shell(R, { crown: [0, Math.cos(th0), -Math.sin(th0)], cover: hairline({ f: 0.97, s: 1.5 }), thick: () => thin(o, 0.03), grooves: 30, gAmp: 0.012, sheen: 0.14 }),
      tie(R, at, n, 0.15),
      tube([at, ...hangPath(R, at.clone().addScaledVector(n, R * 0.25), PI, 0.22, o.hat ? -1.9 : -2.2, g, 5)], { rad: t => R * (0.2 + 0.09 * Math.sin(Math.min(1, t * 3) * PI / 2) - 0.26 * t * t), seg: 20, sides: 10, grooves: 9, gAmp: 0.24 })];
  },
  braid: (R, o) => {
    const g = o.girth ?? 1, at = onHead(R, 1.95, PI, 1.02);
    return [shell(R, { crown: [0, Math.cos(1.95), -Math.sin(1.95)], cover: hairline({ f: 0.97, s: 1.5 }), thick: () => thin(o, 0.03), grooves: 32, gAmp: 0.012, sheen: 0.12 }),
      ...braid(R, hangPath(R, at, PI, 0.12, -2.7, g, 6), 0.17)];
  },
  pigtails: (R, o) => {
    const g = o.girth ?? 1, P: KitPiece[] = [shell(R, { crown: [0, 1, 0.15], cover: hairline({ f: 0.97, s: 1.5 }), thick: () => thin(o, 0.03), grooves: 30, gAmp: 0.012, sheen: 0.12 })];
    for (const s of [-1, 1]) { const a = s * 1.95, at = onHead(R, 1.72, a, 1.02); P.push(...braid(R, hangPath(R, at, a, 0.16, -2.0, g, 5, false), 0.13, 6)); }
    return P;
  },
  buns2: (R, o) => [shell(R, { crown: [0, 1, 0.15], cover: hairline({ f: 0.97, s: 1.5 }), thick: () => thin(o, 0.03), grooves: 30, gAmp: 0.012, sheen: 0.12 }), ...(o.hat ? [] : [...coilBun(R, 0.62, 1.15, 0.62), ...coilBun(R, 0.62, -1.15, 0.62)])],
  curlylong: (R, o) => [
    shell(R, { crown: [0, 1, 0.1], cover: hairline({ f: 0.96, s: 1.6, ear: false }), thick: (th) => thin(o, 0.04 + 0.07 * TOP(th, 1.7, 0.6)), bumps: o.hat ? undefined : { n: 80, r: 0.26, amp: 0.07, seed: 11 }, nA: 52, nP: 22 }),
    curtain(R, { a0: 0.85, a1: TAU - 0.85, th0: 1.45, len: a => 0.95 + 1.5 * Math.pow(Math.cos((a - PI) / 2.6 * PI / 2), 2), thick: 0.16, grooves: 14, gAmp: 0.06, flare: 0.14, wave: { amp: 0.1, freq: 5.5 }, girth: o.girth, nA: 44, nS: 14, seed: 9 }),
  ],
};

/* =====================================================================
   BEARDS (θ/a on the face: mouth at θ≈1.88, a=0; eyes at θ≈1.5, a=±0.3; ears at a=±π/2)
   ===================================================================== */
function beardShell(R: number, cover: (th: number, a: number) => number, thick: (th: number, a: number) => number, grooves = 34, gAmp = 0.02, top?: (a: number) => number): KitPiece {
  const nA = LOD ? 24 : 44, nT = LOD ? 12 : 22, a0 = -1.85, a1 = 1.85, t0 = 1.3, t1 = PI - 0.02;
  const pos: number[] = [], sh: number[] = [], cov: number[] = [], idx: number[] = [];
  for (let i = 0; i <= nT; i++) for (let j = 0; j <= nA; j++) {
    const a = a0 + (a1 - a0) * j / nA, tt = top ? top(a) : t0, th = tt + (t1 - tt) * Math.pow(i / nT, 1.25);   // rows start on the top edge: smooth beard line
    const cv = i === 0 && top ? 0 : cover(th, a), cc = sstep(0, 1, cv), gr = ridge(a * grooves / 2 + 0.2 * Math.sin(th * 9));
    const r = R * (0.984 + cc * (0.022 + thick(th, a) + gAmp * gr));
    const d = dirTA(th, a);
    pos.push(d.x * r, d.y * r, d.z * r); cov.push(cv); sh.push((0.8 + 0.24 * gr) * (0.86 + 0.14 * cc));
  }
  const at = (i: number, j: number) => i * (nA + 1) + j;
  for (let i = 0; i < nT; i++) for (let j = 0; j < nA; j++) {
    const a = at(i, j), b = at(i, j + 1), c = at(i + 1, j), d = at(i + 1, j + 1);
    if (cov[a] > 0.03 || cov[b] > 0.03 || cov[c] > 0.03 || cov[d] > 0.03) idx.push(a, c, d, a, d, b);
  }
  const r = geo(pos, idx, sh);
  return { g: r.g, m: ID, k: 'hair', sh: r.sh };
}
/** closed tapered drop under the chin (long beard / goatee tip) */
function beardDrop(R: number, w: number, h: number, depth: number, yTop: number, zFwd: number, point = 1.6): KitPiece {
  const g = new T.SphereGeometry(1, 16, 12), P = g.attributes.position, sh = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (1 - y) / 2;        // 0 top .. 1 bottom
    const taper = Math.pow(1 - t, 0.25) * (1 - Math.pow(t, point) * 0.92), ang = Math.atan2(x, z), gr = ridge(ang * 7);
    const k = taper * (1 + 0.08 * (gr - 0.5));
    P.setXYZ(i, x * w * R * k, yTop - t * h * R, z * depth * R * k + zFwd * R - t * 0.08 * R);
    sh[i] = (0.8 + 0.24 * gr) * (1 - 0.12 * t);
  }
  g.deleteAttribute('uv'); g.computeVertexNormals();
  return { g, m: ID, k: 'hair', sh };
}
const mouthHole = (th: number, a: number, rx = 0.28, ry = 0.07, cy = 1.95) => sstep(0.85, 1.15, Math.hypot(a / rx, (th - cy) / ry));
const jaw = (a: number) => { const aa = Math.abs(a); return aa < 0.5 ? 1.9 : aa < 1.25 ? 1.9 - 0.08 * sstep(0.5, 1.25, aa) : 1.82 - 0.27 * sstep(1.25, 1.45, aa); };
const backCut = (a: number) => sstep(1.72, 1.5, Math.abs(a));
const BEARD: Record<string, (R: number) => KitPiece[]> = {
  tam: R => [beardShell(R, (th, a) => sstep(jaw(a) - 0.04, jaw(a) + 0.06, th) * backCut(a) * mouthHole(th, a), (th) => 0.035 + 0.075 * sstep(1.95, 2.6, th), 34, 0.02, a => jaw(a) - 0.04)],
  kisa: R => [beardShell(R, (th, a) => sstep(jaw(a) - 0.03, jaw(a) + 0.05, th) * backCut(a) * mouthHole(th, a), () => 0.03, 40, 0.012, a => jaw(a) - 0.03)],
  uzun: R => [beardShell(R, (th, a) => sstep(jaw(a) - 0.04, jaw(a) + 0.06, th) * backCut(a) * mouthHole(th, a), (th) => 0.04 + 0.07 * sstep(1.95, 2.5, th), 34, 0.02, a => jaw(a) - 0.04), beardDrop(R, 0.6, 1.2, 0.4, -0.6 * R, 0.48, 1.4)],
  keci: R => [beardShell(R, (th, a) => sstep(0.36, 0.24, Math.abs(a)) * sstep(2.0, 2.06, th), (th) => 0.05 + 0.05 * sstep(2.0, 2.5, th), 20), beardDrop(R, 0.22, 0.7, 0.2, -0.72 * R, 0.62, 2.2)],
  cember: R => [beardShell(R, (th, a) => sstep(0.42, 0.32, Math.abs(a)) * sstep(1.86, 1.92, th) * mouthHole(th, a, 0.24, 0.055), (th) => 0.04 + 0.04 * sstep(2.0, 2.5, th), 24)],
  cene: R => [beardShell(R, (th, a) => { const j = jaw(a) + 0.18; return sstep(j - 0.05, j + 0.03, th) * backCut(a) * mouthHole(th, a); }, () => 0.025, 40, 0.012, a => jaw(a) + 0.13)],
  favori: R => [beardShell(R, (th, a) => sstep(1.1, 1.22, Math.abs(a)) * sstep(1.52, 1.42, Math.abs(a)) * sstep(1.38, 1.45, th) * sstep(1.86, 1.76, th), () => 0.03, 30, 0.012)],
};

/* =====================================================================
   MUSTACHES: tubes along the upper lip (θ, a on the face, lift above the skin)
   ===================================================================== */
const face = (R: number, a: number, th: number, lift: number) => dirTA(th, a).multiplyScalar(R * (1 + lift * 1.7));
type MPt = [number, number];   // [a, θ]
function mus(R: number, half: MPt[], rad: (t: number) => number, lift: number, o: Partial<TubeO> = {}, mirrorJoin = true): KitPiece[] {
  if (mirrorJoin) {
    const pts = [...half.slice().reverse().map(([a, th]) => face(R, -a, th, lift)), ...half.slice(1).map(([a, th]) => face(R, a, th, lift))];
    return [tube(pts, { rad: t => rad(Math.abs(t - 0.5) * 2) * R * 1.3, seg: 30, sides: 10, grooves: 8, gAmp: 0.22, ...o })];
  }
  return [-1, 1].map(s => tube(half.map(([a, th]) => face(R, s * a, th, lift)), { rad: t => rad(t) * R * 1.2, seg: 18, sides: 8, grooves: 6, gAmp: 0.2, ...o }));
}
const MUSTACHE: Record<string, (R: number) => KitPiece[]> = {
  ince: R => mus(R, [[0, 1.925], [0.12, 1.930], [0.22, 1.955], [0.28, 1.985]], t => 0.03 - 0.016 * t, 0.025, { grooves: 0 }),
  kalin: R => mus(R, [[0, 1.915], [0.12, 1.925], [0.24, 1.965], [0.31, 2.025]], t => 0.075 - 0.04 * t * t, 0.05),
  pos: R => mus(R, [[0, 1.925], [0.13, 1.935], [0.25, 1.975], [0.33, 2.035]], t => 0.095 - 0.045 * t * t, 0.06, { grooves: 10, gAmp: 0.3 }),
  burma: R => mus(R, [[0.02, 1.925], [0.14, 1.935], [0.27, 1.965], [0.37, 1.925], [0.38, 1.855], [0.33, 1.835]], t => 0.05 * (1 - 0.75 * t), 0.04, {}, false),
  kaytan: R => mus(R, [[0.02, 1.925], [0.16, 1.925], [0.32, 1.915], [0.46, 1.865], [0.53, 1.825]], t => 0.034 * (1 - 0.8 * t), 0.03, { grooves: 0 }, false),
  nal: R => mus(R, [[0, 1.915], [0.14, 1.925], [0.24, 1.965], [0.27, 2.075], [0.27, 2.205], [0.26, 2.285]], t => 0.06 - 0.015 * t, 0.045),
  sarkik: R => mus(R, [[0, 1.945], [0.12, 1.965], [0.23, 2.015], [0.3, 2.095]], t => 0.09 - 0.035 * t, 0.06, { grooves: 12, gAmp: 0.32 }),
};

/* ---------- public API (cached) ---------- */
const CACHE = new Map<string, KitPiece[]>();
const cached = (key: string, f: () => KitPiece[]) => { let v = CACHE.get(key); if (!v) { v = f(); CACHE.set(key, v); } return v; };
export const KIT_HAIR = Object.keys(HAIR), KIT_BEARD = Object.keys(BEARD), KIT_MUSTACHE = Object.keys(MUSTACHE);
/** null when the style is not a kit style (callers fall back to their own shapes) */
export function hairKit(style: string, R: number, o: KitOpts = {}): KitPiece[] | null {
  const f = HAIR[style]; if (!f) return null;
  const g = Math.round((o.girth ?? 1) * 20) / 20;
  const lod = o.lod ? 1 : 0;
  return cached(`h|${style}|${R}|${o.hat ? 1 : 0}|${g}|${lod}`, () => withLod(lod, () => f(R, { hat: o.hat, girth: g, lod })));
}
export function beardKit(style: string, R: number, lod = 0): KitPiece[] | null { const f = BEARD[style]; return f ? cached(`b|${style}|${R}|${lod ? 1 : 0}`, () => withLod(lod, () => f(R))) : null; }
export function mustacheKit(style: string, R: number, lod = 0): KitPiece[] | null { const f = MUSTACHE[style]; return f ? cached(`m|${style}|${R}|${lod ? 1 : 0}`, () => withLod(lod, () => f(R))) : null; }
function withLod<X>(l: number, f: () => X): X { const o = LOD; LOD = l ? 1 : 0; try { return f(); } finally { LOD = o; } }
export function kitTris(pieces: KitPiece[]): number { return pieces.reduce((n, p) => n + (p.g.index ? p.g.index.count : p.g.attributes.position.count) / 3, 0); }
