/**
 * Port of the parts of v2 core.js (3d/v2/js/core.js) that chars.js uses: math helpers, seeded rng (mulberry32,
 * view-side only), cached Lambert materials and primitive geometries, toy rounded box, canvas textures.
 * Owner: Builder C. Kept 1:1 with v2 so the character port stays byte-for-byte comparable.
 * Decision: a private cache (not B's prefab kit) so characters never depend on world code being ready.
 */
import * as T from 'three';

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
export const easeInOut = (t: number): number => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
export const angLerp = (a: number, b: number, t: number): number => {
  let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t;
};

export interface V2Rng {
  next(): number; range(a: number, b: number): number; int(a: number, b: number): number;
  pick<X>(arr: readonly X[]): X; chance(p: number): boolean; seed: number;
}
/** v2 C.rng (mulberry32). View-side only (looks, idle variety); never used by the sim. */
export function rng(seed: number): V2Rng {
  let s = (seed >>> 0) || 1;
  const next = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
    get seed() { return s; }, set seed(v: number) { s = v >>> 0; },
  };
}

/** View-side randomness for blinks/idles. Seeded so lineup shots are repeatable (v2 used Math.random here). */
const viewRng = rng(20261017);
export const vrand = (): number => viewRng.next();
export function reseedView(seed: number): void { viewRng.seed = seed; }

const MAT: Record<string, T.MeshLambertMaterial> = {};
const GEO: Record<string, T.BufferGeometry> = {};
/** mat('#c8372d') or mat('#fff', { map, transparent }) -> cached MeshLambertMaterial (v2 C.mat). */
export function mat(c: string, extra?: T.MeshLambertMaterialParameters): T.MeshLambertMaterial {
  // Key by hand: JSON.stringify would call Texture.toJSON (a full canvas getDataURL) before any replacer runs.
  let k = c;
  if (extra) for (const key of Object.keys(extra).sort()) {
    const v = (extra as Record<string, unknown>)[key];
    k += '|' + key + '=' + (v && typeof v === 'object' ? ((v as { uuid?: string }).uuid ?? JSON.stringify(v)) : String(v));
  }
  return MAT[k] || (MAT[k] = new T.MeshLambertMaterial(Object.assign({ color: c }, extra || {})));
}
export function geo<G extends T.BufferGeometry>(k: string, make: () => G): G { return (GEO[k] || (GEO[k] = make())) as G; }
export function mesh(g: T.BufferGeometry, m: string | T.Material, shadow = true): T.Mesh {
  const o = new T.Mesh(g, typeof m === 'string' ? mat(m) : m); o.castShadow = shadow; o.receiveShadow = true; return o;
}
/** Rounded box (toy look): radius r, segments s (v2 C.roundBox). */
export function roundBox(w: number, h: number, d: number, r = 0.05, s = 2): T.BufferGeometry {
  return geo(`rb${w}|${h}|${d}|${r}|${s}`, () => {
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

/** Canvas factory: DOM canvas in browsers, OffscreenCanvas in workers; throws headless (callers catch). */
export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h) as unknown as HTMLCanvasElement;
  throw new Error('no canvas');
}
let maxAniso = 4;
export function setMaxAnisotropy(n: number): void { maxAniso = Math.max(1, Math.min(8, n)); }
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, rep?: [number, number]): T.CanvasTexture {
  const c = makeCanvas(w, h);
  draw(c.getContext('2d') as CanvasRenderingContext2D, w, h);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function fitText(g: CanvasRenderingContext2D, s: string, x: number, y: number, max: number): void {
  const m = g.measureText(s).width; if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y);
}
