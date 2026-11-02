/**
 * Dekor 2.0 models: code-made low-poly shapes for the extra decor catalogue and Sabri'nin Evi furniture, plus the
 * 3-layer paint post-process (malzeme + renk + desen) on a built batch geometry. No image files: vertex colours only.
 * `shapeInto(A, BU, shape, cols)` draws into a Batch (A = body, BU = bulbs lit at night) and returns an optional light
 * point {x,y,z} for the night glow pool. Shapes stay inside their footprint (s 0.7 m, m 1.2 m, l 1.8 m).
 */
import type * as T from 'three';
import { Batch, mtx, col, TAU, HP } from '../../../engine/prefab/batch';
import { DECOR_EXTRA, PAINT_MATERIALS, PAINT_COLORS, extraById } from '../../dekor-katalog';

type B = Batch;
type L = { x: number; y: number; z: number } | null;
const W = '#fbfaf6', INK = '#33373b', WOOD = '#9c6c46', DARK = '#3c4146';

function pole(A: B, h: number, c: string, x = 0, z = 0) { A.cyl(0.18, 0.22, 0.08, c, x, 0.04, z, { seg: 8 }); A.cyl(0.035, 0.045, h, c, x, h / 2, z, { seg: 6 }); }
function bulbRow(BU: B, x0: number, x1: number, y: number, sag: number, n: number, c: string, z = 0) {
  for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); BU.sph(0.045, c, x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * sag, z, { ws: 6, hs: 4 }); }
}
function chair(A: B, x: number, z: number, ry: number, seat: string, frame: string) {
  A.push(mtx(x, 0, z, 0, ry, 0));
  A.box(0.4, 0.05, 0.4, seat, 0, 0.45, 0, { r: 0.02 });
  [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([a, b]) => A.cyl(0.02, 0.022, 0.44, frame, a, 0.22, b, { seg: 5 }));
  [-0.17, 0.17].forEach(a => A.cyl(0.02, 0.02, 0.48, frame, a, 0.7, -0.19, { seg: 5 }));
  A.box(0.36, 0.12, 0.03, seat, 0, 0.85, -0.19, { r: 0.01 });
  A.pop();
}
function pot(A: B, c: string, r = 0.16, h = 0.3) { A.lathe([[0, 0], [r * 0.8, 0], [r, h], [r * 1.1, h + 0.02], [0, h + 0.02]], c, 0, 0, 0, { seg: 10 }); A.cyl(r * 0.95, r * 0.95, 0.02, '#5a3e2a', 0, h, 0, { seg: 10 }); }
function crate(A: B, w: number, h: number, c: string, x: number, y: number, z: number) {
  A.box(w, h, w, c, x, y + h / 2, z, { r: 0.02 });
  A.box(w * 0.7, h * 0.22, 0.01, W, x, y + h * 0.6, z + w / 2 + 0.004, { r: 0 });
}

export function shapeInto(A: B, BU: B, shape: string, cols: [string, string, string]): L {
  const [a, b, c] = cols;
  switch (shape) {
    // ── lights ──
    case 'zincir': pole(A, 1.7, DARK, -0.5); pole(A, 1.7, DARK, 0.5); A.cyl(0.006, 0.006, 1.0, b, 0, 1.6, 0, { rz: HP, seg: 3 }); bulbRow(BU, -0.5, 0.5, 1.62, 0.2, 7, a); return { x: 0, y: 1.45, z: 0 };
    case 'fener': pole(A, 1.5, b); A.box(0.26, 0.04, 0.26, b, 0, 1.52, 0, { r: 0.01 }); A.box(0.22, 0.3, 0.22, a, 0, 1.7, 0, { r: 0.02 }); BU.box(0.16, 0.24, 0.24, c, 0, 1.7, 0, { r: 0 }); A.cone(0.2, 0.16, b, 0, 1.93, 0, { seg: 4, ry: Math.PI / 4 }); return { x: 0, y: 1.7, z: 0 };
    case 'kagit': A.box(0.05, 1.2, 0.05, WOOD, 0, 0.6, 0, { r: 0.01 }); A.box(0.7, 0.04, 0.04, WOOD, 0, 1.2, 0, { r: 0.01 });
      [-0.28, 0, 0.28].forEach((x, i) => { A.cyl(0.004, 0.004, 0.15, INK, x, 1.12, 0, { seg: 3 }); BU.sph(0.11, [a, b, c][i], x, 0.96, 0, { ws: 8, hs: 6, sy: 1.2 } as never); }); return { x: 0, y: 0.95, z: 0 };
    case 'gaz': crate(A, 0.36, 0.34, WOOD, 0, 0, 0); A.cyl(0.08, 0.1, 0.06, b, 0, 0.37, 0, { seg: 10 }); BU.lathe([[0, 0], [0.07, 0.02], [0.09, 0.1], [0.05, 0.2], [0, 0.2]], c, 0, 0.4, 0, { seg: 10 }); A.cyl(0.05, 0.06, 0.04, a, 0, 0.62, 0, { seg: 8 }); A.tor(0.06, 0.008, a, 0, 0.7, 0, { rs: 3, ts: 10 }); return { x: 0, y: 0.5, z: 0 };
    case 'mum': A.cyl(0.18, 0.18, 0.42, WOOD, 0, 0.21, 0, { seg: 8 }); A.cyl(0.08, 0.08, 0.14, b, 0, 0.49, 0, { seg: 10, open: true }); A.cyl(0.035, 0.035, 0.09, a, 0, 0.47, 0, { seg: 8 }); BU.cone(0.018, 0.05, c, 0, 0.55, 0, { seg: 5 }); return { x: 0, y: 0.55, z: 0 };
    case 'neon': A.box(0.06, 1.0, 0.06, DARK, -0.4, 0.5, -0.05, { r: 0.01 }); A.box(0.06, 1.0, 0.06, DARK, 0.4, 0.5, -0.05, { r: 0.01 }); A.box(1.0, 0.7, 0.05, b, 0, 1.25, -0.05, { r: 0.04 });
      BU.tor(0.18, 0.02, a, -0.12, 1.28, 0, { rs: 4, ts: 12, arc: Math.PI }); BU.tor(0.18, 0.02, a, 0.22, 1.28, 0, { rs: 4, ts: 12, arc: Math.PI }); BU.tor(0.42, 0.015, c, 0, 1.25, 0, { rs: 3, ts: 24, sy: 0.7 } as never); return { x: 0, y: 1.25, z: 0.1 };
    case 'kure': A.cyl(0.2, 0.24, 0.1, b, 0, 0.05, 0, { seg: 10 }); A.cyl(0.03, 0.03, 0.5, b, 0, 0.35, 0, { seg: 6 }); BU.sph(0.22, c, 0, 0.8, 0, { ws: 12, hs: 8 }); [0.3, -0.5, 0.9].forEach((k, i) => A.sph(0.04, a, Math.cos(k) * 0.15, 0.82 + i * 0.04, Math.sin(k) * 0.19, { ws: 5, hs: 3 })); return { x: 0, y: 0.8, z: 0 };
    case 'abajur': A.cyl(0.14, 0.17, 0.05, a, 0, 0.025, 0, { seg: 12 }); A.cyl(0.02, 0.02, 0.6, DARK, 0, 0.32, 0, { seg: 6 }); BU.cyl(0.12, 0.22, 0.24, c, 0, 0.72, 0, { seg: 12, open: true }); A.cyl(0.225, 0.225, 0.015, b, 0, 0.6, 0, { seg: 12 }); return { x: 0, y: 0.7, z: 0 };
    // ── floors ──
    case 'kilim': A.box(1.0, 0.02, 0.7, a, 0, 0.01, 0, { r: 0 }); A.box(0.8, 0.022, 0.5, b, 0, 0.012, 0, { r: 0 }); A.box(0.36, 0.024, 0.24, c, 0, 0.014, 0, { r: 0, ry: Math.PI / 4 });
      for (let i = 0; i < 6; i++) { A.box(0.01, 0.01, 0.06, b, -0.5 - 0.02, 0.006, -0.28 + i * 0.11, { r: 0 }); A.box(0.01, 0.01, 0.06, b, 0.52, 0.006, -0.28 + i * 0.11, { r: 0 }); } return null;
    case 'karo': for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) A.box(0.24, 0.025, 0.24, (i + j) % 2 ? a : b, -0.375 + i * 0.25, 0.0125, -0.375 + j * 0.25, { r: 0.005 });
      A.box(0.08, 0.03, 0.08, c, 0, 0.016, 0, { r: 0, ry: Math.PI / 4 }); return null;
    case 'tahta': for (let i = 0; i < 6; i++) A.box(1.0, 0.03, 0.15, i % 2 ? a : b, 0, 0.015, -0.42 + i * 0.168, { r: 0.006 }); A.box(0.9, 0.032, 0.02, c, 0, 0.02, 0.3, { r: 0 }); return null;
    // ── wall ──
    case 'cerceve': case 'afis': case 'takvim': {
      [-0.25, 0.25].forEach(x => A.box(0.04, 1.4, 0.04, WOOD, x, 0.7, -0.1, { rx: -0.12, r: 0.01 })); A.box(0.04, 1.2, 0.04, WOOD, 0, 0.58, -0.36, { rx: 0.35, r: 0.01 });
      if (shape === 'cerceve') { A.box(0.56, 0.48, 0.05, a, 0, 1.05, -0.02, { rx: -0.12, r: 0.01 }); A.box(0.44, 0.36, 0.06, b, 0, 1.05, -0.02, { rx: -0.12, r: 0 }); A.sph(0.08, c, 0, 1.06, 0.02, { ws: 6, hs: 4, sz: 0.3 } as never); }
      else if (shape === 'afis') { A.box(0.58, 0.82, 0.04, a, 0, 1.0, -0.02, { rx: -0.12, r: 0.01 }); A.box(0.48, 0.5, 0.045, b, 0, 1.06, -0.02, { rx: -0.12, r: 0 }); A.box(0.4, 0.08, 0.05, c, 0, 0.72, 0.01, { rx: -0.12, r: 0 }); }
      else { A.box(0.42, 0.56, 0.04, a, 0, 1.0, -0.02, { rx: -0.12, r: 0.01 }); A.box(0.42, 0.14, 0.05, b, 0, 1.22, -0.02, { rx: -0.12, r: 0.01 }); for (let i = 0; i < 4; i++) A.box(0.3, 0.02, 0.05, c, 0, 1.05 - i * 0.08, 0.0, { rx: -0.12, r: 0 }); }
      return null;
    }
    case 'tabak': A.box(0.05, 1.2, 0.05, WOOD, 0, 0.6, -0.1, { r: 0.01 }); A.cyl(0.26, 0.26, 0.03, a, 0, 1.0, -0.06, { rx: HP, seg: 18 }); A.cyl(0.18, 0.18, 0.032, b, 0, 1.0, -0.055, { rx: HP, seg: 18 }); A.cyl(0.06, 0.06, 0.034, c, 0, 1.0, -0.05, { rx: HP, seg: 10 }); A.cyl(0.18, 0.2, 0.05, WOOD, 0, 0.025, -0.1, { seg: 8 }); return null;
    case 'dumen': A.box(0.06, 1.0, 0.06, WOOD, 0, 0.5, -0.1, { r: 0.01 }); A.cyl(0.16, 0.2, 0.05, WOOD, 0, 0.025, -0.1, { seg: 8 }); A.tor(0.3, 0.035, a, 0, 1.1, 0, { rs: 5, ts: 20 }); A.cyl(0.07, 0.07, 0.08, c, 0, 1.1, 0, { rx: HP, seg: 10 });
      for (let k = 0; k < 8; k++) { const t = k / 8 * TAU; A.cyl(0.018, 0.018, 0.82, b, 0, 1.1, 0, { rz: t, seg: 5 }); } return null;
    case 'maske': A.box(0.05, 1.1, 0.05, WOOD, 0, 0.55, -0.1, { r: 0.01 }); A.cyl(0.16, 0.2, 0.05, WOOD, 0, 0.025, -0.1, { seg: 8 }); A.box(0.4, 0.62, 0.1, a, 0, 1.1, -0.03, { r: 0.08 });
      [-0.09, 0.09].forEach(x => A.box(0.1, 0.06, 0.04, W, x, 1.2, 0.03, { r: 0.02 })); A.box(0.22, 0.06, 0.04, c, 0, 0.96, 0.03, { r: 0.02 }); for (let i = 0; i < 5; i++) A.cone(0.04, 0.24, b, -0.16 + i * 0.08, 1.5, -0.03, { seg: 4 }); return null;
    // ── bibelots ──
    case 'biblo': A.box(0.32, 0.5, 0.32, '#e8e0d0', 0, 0.25, 0, { r: 0.02 }); A.box(0.36, 0.04, 0.36, '#cfc8be', 0, 0.52, 0, { r: 0.01 });
      A.sph(0.12, a, 0, 0.66, 0, { ws: 8, hs: 6, sy: 1.1 } as never); A.sph(0.08, a, 0, 0.82, 0.03, { ws: 8, hs: 6 }); A.cone(0.03, 0.06, b, -0.04, 0.9, 0.03, { seg: 4 }); A.cone(0.03, 0.06, b, 0.04, 0.9, 0.03, { seg: 4 }); A.sph(0.015, c, -0.03, 0.84, 0.1, { ws: 4, hs: 3 }); A.sph(0.015, c, 0.03, 0.84, 0.1, { ws: 4, hs: 3 }); return null;
    case 'vazo': A.box(0.32, 0.5, 0.32, '#e8e0d0', 0, 0.25, 0, { r: 0.02 }); A.lathe([[0, 0], [0.08, 0], [0.13, 0.1], [0.12, 0.2], [0.06, 0.28], [0.07, 0.32], [0, 0.32]], a, 0, 0.5, 0, { seg: 12 }); A.tor(0.125, 0.012, c, 0, 0.62, 0, { rx: HP, rs: 3, ts: 14 }); A.tor(0.1, 0.01, b, 0, 0.68, 0, { rx: HP, rs: 3, ts: 14 }); return null;
    case 'gramofon': crate(A, 0.5, 0.5, WOOD, 0, 0, 0); A.box(0.42, 0.14, 0.42, b, 0, 0.57, 0, { r: 0.02 }); A.cyl(0.17, 0.17, 0.01, DARK, 0, 0.645, 0, { seg: 16 }); A.cyl(0.015, 0.015, 0.3, a, 0.15, 0.78, 0.12, { rz: 0.3, seg: 5 });
      A.lathe([[0.02, 0], [0.04, 0.1], [0.1, 0.22], [0.26, 0.32], [0.27, 0.33]], a, 0.12, 0.84, 0.1, { seg: 12, rz: -0.9 }); A.sph(0.02, c, 0.18, 0.66, 0.05, { ws: 4, hs: 3 }); return null;
    case 'astronot': A.box(0.5, 0.36, 0.5, '#8c969e', 0, 0.18, 0, { r: 0.04 }); A.cap(0.16, 0.24, a, 0, 0.66, 0); A.sph(0.17, a, 0, 1.0, 0, { ws: 10, hs: 8 }); A.sph(0.12, c, 0, 1.0, 0.08, { ws: 8, hs: 6, sz: 0.6 } as never);
      A.cone(0.06, 0.16, '#ffd23f', 0, 0.98, 0.2, { rx: HP, seg: 6 }); A.box(0.22, 0.26, 0.1, b, 0, 0.68, -0.18, { r: 0.03 }); A.cyl(0.01, 0.01, 0.4, INK, 0.25, 0.7, 0, { seg: 3 }); A.box(0.18, 0.12, 0.01, '#e0533c', 0.34, 0.86, 0, { r: 0 }); return null;
    case 'flamingo': A.cyl(0.012, 0.012, 0.5, b, 0, 0.25, 0, { seg: 4 }); A.cyl(0.012, 0.012, 0.35, b, 0.06, 0.38, 0, { rz: 0.8, seg: 4 }); A.sph(0.14, a, 0, 0.6, 0, { ws: 8, hs: 6, sx: 1.4 } as never);
      A.cyl(0.025, 0.03, 0.34, a, 0.12, 0.82, 0, { rz: -0.3, seg: 6 }); A.sph(0.05, a, 0.17, 0.99, 0, { ws: 6, hs: 4 }); A.cone(0.022, 0.08, c, 0.23, 0.97, 0, { rz: -HP - 0.5, seg: 4 }); return null;
    case 'kaktus': pot(A, b, 0.13, 0.22); A.cap(0.07, 0.22, a, 0, 0.42, 0); A.cap(0.035, 0.08, a, 0.09, 0.42, 0, { rz: -0.6 } as never); A.cap(0.035, 0.06, a, -0.08, 0.48, 0, { rz: 0.6 } as never); A.sph(0.03, c, 0, 0.6, 0, { ws: 5, hs: 3 }); return null;
    case 'atli': A.cyl(0.32, 0.36, 0.1, '#e8e0d0', 0, 0.05, 0, { seg: 12 }); A.cyl(0.025, 0.025, 1.6, b, 0, 0.8, 0, { seg: 6 }); A.box(0.5, 0.22, 0.18, a, 0, 0.72, 0, { r: 0.08 });
      A.box(0.14, 0.3, 0.14, a, 0.24, 0.92, 0, { rz: -0.4, r: 0.05 }); A.box(0.18, 0.12, 0.12, a, 0.34, 1.06, 0, { r: 0.04 }); [-0.18, 0.18].forEach(x => [-0.06, 0.06].forEach(z => A.cyl(0.025, 0.02, 0.3, a, x, 0.48, z, { seg: 5, rz: x > 0 ? -0.3 : 0.3 })));
      A.box(0.18, 0.04, 0.2, c, -0.02, 0.85, 0, { r: 0.01 }); A.box(0.06, 0.2, 0.04, c, 0.3, 1.0, 0, { r: 0.02 }); return null;
    case 'raf': A.box(0.8, 1.2, 0.3, a, 0, 0.6, -0.05, { r: 0.02 }); [0.3, 0.65, 1.0].forEach((y, i) => { A.box(0.72, 0.03, 0.3, '#7d5638', 0, y, 0, { r: 0 });
      A.sph(0.06, [b, c, '#e0533c'][i], -0.22, y + 0.07, 0.03, { ws: 6, hs: 4 }); A.cyl(0.04, 0.05, 0.14, [c, b, '#ffd23f'][i], 0, y + 0.085, 0.03, { seg: 8 }); A.box(0.1, 0.12, 0.08, [b, '#2f6fb0', c][i], 0.22, y + 0.075, 0.03, { r: 0.01 }); }); return null;
    case 'kupa': A.box(0.32, 0.46, 0.32, '#e8e0d0', 0, 0.23, 0, { r: 0.02 }); A.box(0.2, 0.06, 0.2, DARK, 0, 0.49, 0, { r: 0.01 }); A.cyl(0.03, 0.05, 0.12, a, 0, 0.58, 0, { seg: 8 });
      A.lathe([[0, 0], [0.06, 0], [0.12, 0.08], [0.13, 0.2], [0, 0.2]], a, 0, 0.64, 0, { seg: 12 }); [-1, 1].forEach(s => A.tor(0.06, 0.012, b, s * 0.13, 0.76, 0, { rs: 3, ts: 10, arc: Math.PI, rz: s > 0 ? -HP : HP })); A.tor(0.07, 0.025, '#d8a25a', 0, 0.9, 0, { rs: 5, ts: 12, rx: HP }); return null;
    case 'radyo': crate(A, 0.36, 0.36, WOOD, 0, 0, 0); A.box(0.3, 0.2, 0.1, a, 0, 0.46, 0, { r: 0.03 }); A.box(0.18, 0.12, 0.012, b, -0.04, 0.46, 0.052, { r: 0.01 }); A.cyl(0.025, 0.025, 0.02, c, 0.1, 0.46, 0.055, { rx: HP, seg: 8 }); A.cyl(0.004, 0.004, 0.24, '#aaa', 0.1, 0.66, 0, { rz: -0.3, seg: 3 }); return null;
    case 'kule': A.box(0.32, 0.46, 0.32, '#e8e0d0', 0, 0.23, 0, { r: 0.02 }); for (let i = 0; i < 4; i++) for (let k = 0; k < 4 - i; k++) { const x = (k - (3 - i) / 2) * 0.07; A.lathe([[0, 0], [0.022, 0], [0.026, 0.05], [0.032, 0.09], [0, 0.09]], b, x, 0.47 + i * 0.09, 0, { seg: 8 }); A.cyl(0.02, 0.02, 0.04, a, x, 0.5 + i * 0.09, 0, { seg: 8 }); }
      A.cyl(0.12, 0.12, 0.01, c, 0, 0.465, 0, { seg: 12 }); return null;
    case 'sise': A.box(0.36, 0.42, 0.24, '#e8e0d0', 0, 0.21, 0, { r: 0.02 }); A.cap(0.1, 0.26, a, 0, 0.53, 0, { rz: HP } as never); A.cyl(0.035, 0.035, 0.12, a, 0.24, 0.53, 0, { rz: HP, seg: 8 }); A.cyl(0.035, 0.035, 0.04, WOOD, 0.31, 0.53, 0, { rz: HP, seg: 8 });
      A.box(0.2, 0.04, 0.06, c, 0, 0.48, 0, { r: 0.01 }); A.box(0.12, 0.04, 0.05, b, 0, 0.52, 0, { r: 0.01 }); A.cyl(0.012, 0.012, 0.05, '#e0533c', 0.03, 0.56, 0, { seg: 5 }); return null;
    case 'kabuk': A.box(0.32, 0.46, 0.32, '#e8e0d0', 0, 0.23, 0, { r: 0.02 }); A.lathe([[0, 0], [0.12, 0.02], [0.16, 0.08], [0.1, 0.16], [0.04, 0.22], [0, 0.24]], a, 0, 0.46, 0, { seg: 9, rx: -0.8 }); A.sph(0.06, b, 0, 0.52, 0.1, { ws: 6, hs: 4 }); return null;
    case 'tas': A.box(0.32, 0.46, 0.32, '#e8e0d0', 0, 0.23, 0, { r: 0.02 }); A.ico(0.14, a, 0, 0.58, 0, { d: 0, sy: 0.8 } as never); A.ico(0.05, c, 0.06, 0.66, 0.06, { d: 0 }); A.box(0.2, 0.05, 0.02, b, 0, 0.36, 0.165, { r: 0 }); return null;
    // ── water ──
    case 'akvaryum': { A.box(0.62, 0.5, 0.36, b, 0, 0.25, 0, { r: 0.02 }); A.box(0.6, 0.38, 0.32, a, 0, 0.71, 0, { r: 0.01 }); A.box(0.62, 0.04, 0.34, DARK, 0, 0.92, 0, { r: 0.01 });
      A.box(0.56, 0.04, 0.28, '#e8c27a', 0, 0.54, 0, { r: 0 }); A.sph(0.04, c, -0.1, 0.72, 0.1, { ws: 6, hs: 4, sx: 1.6 } as never); A.sph(0.035, '#ffd23f', 0.12, 0.66, 0.08, { ws: 6, hs: 4, sx: 1.6 } as never);
      [-0.2, 0.2].forEach(x => A.cone(0.03, 0.22, '#5d8f45', x, 0.66, -0.06, { seg: 5 })); return null; }
    case 'fanus': A.box(0.36, 0.5, 0.36, WOOD, 0, 0.25, 0, { r: 0.02 }); A.sph(0.2, a, 0, 0.68, 0, { ws: 12, hs: 8 }); A.cyl(0.12, 0.12, 0.02, a, 0, 0.86, 0, { seg: 12, open: true }); A.sph(0.04, b, 0.03, 0.66, 0.08, { ws: 6, hs: 4, sx: 1.6 } as never); A.cyl(0.14, 0.12, 0.02, c, 0, 0.51, 0, { seg: 12 }); return null;
    case 'cesme': A.cyl(0.45, 0.5, 0.2, a, 0, 0.1, 0, { seg: 14 }); A.cyl(0.4, 0.4, 0.02, c, 0, 0.2, 0, { seg: 14 }); A.cyl(0.06, 0.08, 0.5, a, 0, 0.45, 0, { seg: 8 }); A.cyl(0.2, 0.08, 0.08, a, 0, 0.72, 0, { seg: 12 });
      A.cyl(0.17, 0.17, 0.01, c, 0, 0.765, 0, { seg: 12 }); A.sph(0.05, b, 0, 0.82, 0, { ws: 6, hs: 4 }); for (let k = 0; k < 6; k++) { const t = k / 6 * TAU; A.cyl(0.006, 0.006, 0.4, '#e8f6ff', Math.cos(t) * 0.2, 0.5, Math.sin(t) * 0.2, { seg: 3, rz: Math.cos(t) * 0.3, rx: -Math.sin(t) * 0.3 }); } return null;
    case 'havuz': A.cyl(0.8, 0.82, 0.14, '#a7a69c', 0, 0.07, 0, { seg: 16 }); A.cyl(0.72, 0.72, 0.02, b, 0, 0.13, 0, { seg: 16 });
      [[0.3, 0.2], [-0.3, -0.1], [0.05, -0.4]].forEach(([x, z]) => { A.cyl(0.13, 0.13, 0.01, a, x, 0.145, z, { seg: 8 }); A.sph(0.05, c, x, 0.17, z, { ws: 6, hs: 4 }); }); A.ico(0.12, '#8c969e', 0.6, 0.12, 0.4, { d: 0 }); return null;
    // ── tables ──
    case 'caymasa': A.cyl(0.36, 0.36, 0.04, a, 0, 0.7, 0, { seg: 14 }); A.cyl(0.04, 0.05, 0.68, a, 0, 0.35, 0, { seg: 6 }); A.cyl(0.22, 0.25, 0.04, a, 0, 0.02, 0, { seg: 10 });
      A.cyl(0.37, 0.37, 0.01, c, 0, 0.725, 0, { seg: 14 }); [[0.06, 0], [-0.08, 0.06]].forEach(([x, z]) => { A.lathe([[0, 0], [0.025, 0], [0.03, 0.03], [0.024, 0.06], [0.034, 0.1], [0, 0.1]], '#c23e2c', x, 0.73, z, { seg: 8 }); });
      chair(A, 0, -0.58, 0, b, a); chair(A, 0, 0.58, Math.PI, b, a); return null;
    case 'kasatabure': crate(A, 0.4, 0.38, a, 0, 0, 0); crate(A, 0.32, 0.3, a, -0.42, 0, 0.2); crate(A, 0.32, 0.3, a, 0.42, 0, -0.18); A.box(0.5, 0.04, 0.5, c, 0, 0.4, 0, { r: 0.01 }); A.cyl(0.03, 0.03, 0.14, b, 0.1, 0.49, 0, { seg: 8 }); return null;
    case 'simidmasa': for (let k = 0; k < 8; k++) A.tor(0.42, 0.09, k % 2 ? b : a, 0, 0.7, 0, { arc: TAU / 8, rx: HP, rz: k * TAU / 8, rs: 6, ts: 3 });
      A.cyl(0.36, 0.36, 0.03, c, 0, 0.72, 0, { seg: 14 }); A.cyl(0.05, 0.06, 0.68, c, 0, 0.34, 0, { seg: 6 }); A.cyl(0.25, 0.28, 0.04, c, 0, 0.02, 0, { seg: 10 });
      [[0.62, 0], [-0.62, 0]].forEach(([x, z]) => { A.cyl(0.18, 0.18, 0.08, a, x, 0.44, z, { seg: 10 }); A.cyl(0.04, 0.05, 0.4, c, x, 0.2, z, { seg: 6 }); }); return null;
    case 'makaramasa': A.cyl(0.45, 0.45, 0.06, a, 0, 0.67, 0, { seg: 14 }); A.cyl(0.45, 0.45, 0.06, a, 0, 0.03, 0, { seg: 14 }); A.cyl(0.2, 0.2, 0.6, c, 0, 0.35, 0, { seg: 12 });
      for (let k = 0; k < 5; k++) A.tor(0.22, 0.03, b, 0, 0.12 + k * 0.1, 0, { rx: HP, rs: 4, ts: 14 }); [[0.7, 0.2], [-0.7, -0.1]].forEach(([x, z]) => { A.cyl(0.2, 0.2, 0.05, a, x, 0.42, z, { seg: 12 }); A.cyl(0.1, 0.1, 0.4, c, x, 0.2, z, { seg: 10 }); }); return null;
    case 'plak': A.box(0.9, 0.7, 0.42, a, 0, 0.35, 0, { r: 0.03 }); for (let i = 0; i < 8; i++) A.box(0.02, 0.28, 0.28, [b, c, W][i % 3], -0.35 + i * 0.07, 0.2, 0.04, { r: 0 });
      A.box(0.36, 0.06, 0.32, DARK, 0.18, 0.73, 0, { r: 0.01 }); A.cyl(0.13, 0.13, 0.012, '#111', 0.18, 0.77, 0, { seg: 16 }); A.cyl(0.04, 0.04, 0.014, b, 0.18, 0.775, 0, { seg: 8 }); A.box(0.18, 0.2, 0.18, c, -0.22, 0.8, 0, { r: 0.02 }); return null;
    case 'sezlong': A.box(0.5, 0.06, 1.1, a, 0.35, 0.3, 0, { r: 0.02 }); A.box(0.5, 0.06, 0.5, a, 0.35, 0.5, -0.6, { rx: 0.9, r: 0.02 }); A.box(0.46, 0.03, 1.0, b, 0.35, 0.34, 0.02, { r: 0.01 });
      [-0.5, 0.45].forEach(z => [0.15, 0.55].forEach(x => A.cyl(0.02, 0.02, 0.3, a, x, 0.15, z, { seg: 4 }))); A.cyl(0.25, 0.25, 0.03, a, -0.5, 0.5, 0, { seg: 10 }); A.cyl(0.03, 0.03, 0.5, a, -0.5, 0.25, 0, { seg: 5 }); A.cyl(0.04, 0.03, 0.14, c, -0.5, 0.58, 0, { seg: 8 }); return null;
    case 'kapsul': A.sph(0.5, a, 0, 0.0, 0, { ws: 14, hs: 8, tl: HP }); A.cyl(0.36, 0.36, 0.04, c, 0, 0.72, 0, { seg: 16 }); A.cyl(0.05, 0.05, 0.3, b, 0, 0.55, 0, { seg: 6 });
      [[0.65, 0], [-0.65, 0]].forEach(([x, z]) => { A.sph(0.2, b, x, 0.35, z, { ws: 10, hs: 6 }); BU.sph(0.04, c, x, 0.58, z, { ws: 5, hs: 3 }); }); return { x: 0, y: 0.8, z: 0 };
    case 'fincan': A.lathe([[0, 0], [0.35, 0], [0.45, 0.2], [0.5, 0.5], [0.46, 0.5], [0.42, 0.22], [0, 0.06]], a, 0, 0, 0, { seg: 16 }); A.tor(0.12, 0.04, a, 0.52, 0.3, 0, { rs: 5, ts: 10 });
      A.cyl(0.3, 0.3, 0.04, b, 0, 0.62, 0, { seg: 14 }); A.cyl(0.04, 0.04, 0.5, c, 0, 0.36, 0, { seg: 6 }); for (let k = 0; k < 8; k++) A.sph(0.04, k % 2 ? c : b, Math.cos(k / 8 * TAU) * 0.48, 0.5, Math.sin(k / 8 * TAU) * 0.48, { ws: 5, hs: 3 }); return null;
    case 'bank': A.box(1.3, 0.06, 0.4, b, 0, 0.45, 0, { r: 0.02 }); A.box(1.3, 0.3, 0.05, b, 0, 0.72, -0.18, { r: 0.02 }); [-0.55, 0.55].forEach(x => A.box(0.06, 0.45, 0.4, DARK, x, 0.22, 0, { r: 0.01 }));
      [-0.8, 0.8].forEach(x => { pot(A, '#c98a52', 0.12, 0.24); A.push(mtx(x, 0, 0)); pot(A, '#c98a52', 0.12, 0.24); A.ico(0.14, a, 0, 0.36, 0, { d: 0 }); A.sph(0.04, c, 0.05, 0.46, 0.03, { ws: 5, hs: 3 }); A.pop(); }); return null;
    // ── plants ──
    case 'saksi': pot(A, b); for (let i = 0; i < 5; i++) { const t = i / 5 * TAU; A.box(0.06, 0.32, 0.015, c, Math.cos(t) * 0.07, 0.48, Math.sin(t) * 0.07, { ry: -t, rz: 0.4, r: 0 }); } for (let i = 0; i < 4; i++) A.sph(0.05, a, Math.cos(i * 1.6) * 0.1, 0.6 + (i % 2) * 0.05, Math.sin(i * 1.6) * 0.1, { ws: 6, hs: 4 }); return null;
    case 'palmiye': pot(A, b, 0.18, 0.34); A.cyl(0.04, 0.06, 0.9, c, 0, 0.8, 0, { seg: 6, rz: 0.08 }); for (let k = 0; k < 7; k++) { const t = k / 7 * TAU; A.box(0.5, 0.02, 0.12, a, Math.cos(t) * 0.22, 1.2, Math.sin(t) * 0.22, { ry: -t, rz: -0.45, r: 0 }); } A.sph(0.04, '#7d5638', 0.04, 1.2, 0.04, { ws: 4, hs: 3 }); return null;
    case 'sarmasik': A.box(0.9, 0.04, 0.3, b, 0, 0.02, 0, { r: 0.01 }); for (let i = 0; i < 5; i++) A.box(0.03, 1.4, 0.03, b, -0.4 + i * 0.2, 0.7, 0, { r: 0 }); for (let j = 0; j < 5; j++) A.box(0.9, 0.03, 0.03, b, 0, 0.3 + j * 0.27, 0, { r: 0 });
      for (let k = 0; k < 18; k++) A.ico(0.07, a, -0.4 + ((k * 37) % 9) / 9 * 0.8, 0.2 + ((k * 53) % 11) / 11 * 1.2, 0.02, { d: 0 }); for (let k = 0; k < 6; k++) A.sph(0.03, c, -0.35 + k * 0.14, 0.5 + (k % 3) * 0.3, 0.05, { ws: 4, hs: 3 }); return null;
    case 'tarh': A.box(1.0, 0.18, 0.5, b, 0, 0.09, 0, { r: 0.02 }); A.box(0.94, 0.02, 0.44, '#5a3e2a', 0, 0.18, 0, { r: 0 });
      for (let i = 0; i < 10; i++) { const x = -0.4 + (i % 5) * 0.2, z = i < 5 ? -0.1 : 0.1, h = 0.3 + (i % 3) * 0.05; A.cyl(0.008, 0.008, h, '#5a9e3f', x, 0.18 + h / 2, z, { seg: 3 }); A.lathe([[0, 0], [0.035, 0.02], [0.04, 0.07], [0.025, 0.09], [0, 0.06]], [a, c, '#f2a2b3', '#fbfaf6'][i % 4], x, 0.17 + h, z, { seg: 6 }); } return null;
    case 'bonsai': A.box(0.4, 0.1, 0.26, b, 0, 0.05 + 0.4, 0, { r: 0.02 }); A.box(0.3, 0.4, 0.2, '#e8e0d0', 0, 0.2, 0, { r: 0.02 }); A.cyl(0.03, 0.05, 0.24, c, 0, 0.6, 0, { rz: 0.4, seg: 5 }); A.cyl(0.02, 0.03, 0.18, c, 0.06, 0.72, 0, { rz: -0.6, seg: 5 });
      [[-0.06, 0.74], [0.14, 0.8], [0.02, 0.86]].forEach(([x, y]) => A.ico(0.09, a, x, y, 0, { d: 0, sy: 0.6 } as never)); return null;
    // ── theme ──
    // survey 2026-10-24 (Çok isterim): oyun makinesi, kuş kafesi, kitaplık, vapur maketi
    case 'oyun': A.box(0.5, 1.2, 0.5, a, 0, 0.6, 0, { r: 0.04 }); A.box(0.46, 0.4, 0.04, b, 0, 0.82, 0.25, { r: 0.02 });
      A.box(0.46, 0.22, 0.1, DARK, 0, 0.42, 0.26, { r: 0.02 }); BU.sph(0.035, c, -0.1, 0.42, 0.31, { ws: 6, hs: 4 }); BU.sph(0.035, c, 0.0, 0.42, 0.31, { ws: 6, hs: 4 }); BU.sph(0.035, c, 0.1, 0.42, 0.31, { ws: 6, hs: 4 });
      return { x: 0, y: 1.0, z: 0.4 };
    case 'kafes': A.tor(0.22, 0.02, DARK, 0, 1.0, 0, { rx: HP, rs: 4, ts: 12 });
      for (let i = 0; i < 8; i++) { const t = i / 8 * TAU; A.cyl(0.008, 0.008, 0.3, DARK, Math.cos(t) * 0.2, 0.85, Math.sin(t) * 0.2, { seg: 4 }); }
      A.cyl(0.2, 0.2, 0.02, DARK, 0, 0.85, 0, { seg: 8 }); A.cyl(0.03, 0.03, 0.18, DARK, 0, 1.0, 0, { seg: 5 }); A.sph(0.06, b, 0.06, 0.95, 0, { ws: 8, hs: 6 }); A.sph(0.04, a, -0.04, 0.9, 0.04, { ws: 6, hs: 4 });
      A.box(0.6, 0.05, 0.6, WOOD, 0, 0.0, 0, { r: 0.02 }); return null;
    case 'kitaplik': A.box(0.8, 1.2, 0.3, WOOD, 0, 0.6, -0.05, { r: 0.02 });
      [0.12, 0.45, 0.8, 1.12].forEach((y, i) => { A.box(0.74, 0.02, 0.28, DARK, 0, y, -0.05, { r: 0 }); for (let k = 0; k < 6; k++) A.box(0.06, 0.26 + ((k + i) % 3) * 0.03, 0.2, (k + i) % 2 ? a : b, -0.3 + k * 0.12, y + 0.14, -0.05, { r: 0.005 }); });
      return null;
    case 'vapur': A.box(1.1, 0.22, 0.4, a, 0, 0.14, 0, { r: 0.05 }); A.box(0.5, 0.2, 0.3, W, 0.1, 0.36, 0, { r: 0.03 }); A.box(0.36, 0.1, 0.22, b, 0.1, 0.5, 0, { r: 0.02 });
      A.cyl(0.04, 0.04, 0.45, DARK, -0.25, 0.5, 0, { seg: 6 }); A.cyl(0.04, 0.04, 0.3, DARK, 0.4, 0.4, 0, { seg: 6 });
      return null;
    case 'jukebox': A.box(0.66, 1.1, 0.42, a, 0, 0.55, 0, { r: 0.05 }); A.cyl(0.33, 0.33, 0.42, a, 0, 1.1, 0, { rx: HP, seg: 16 }); A.box(0.46, 0.36, 0.02, b, 0, 0.8, 0.215, { r: 0.02 });
      BU.tor(0.28, 0.025, c, 0, 1.1, 0.215, { rs: 4, ts: 20, arc: Math.PI }); BU.box(0.04, 0.6, 0.02, c, -0.27, 0.6, 0.215, { r: 0 }); BU.box(0.04, 0.6, 0.02, c, 0.27, 0.6, 0.215, { r: 0 }); A.box(0.4, 0.1, 0.02, DARK, 0, 0.3, 0.215, { r: 0.01 }); return { x: 0, y: 1.0, z: 0.3 };
    case 'semsiye': A.cyl(0.25, 0.28, 0.1, '#a7a69c', 0, 0.05, 0, { seg: 10 }); A.cyl(0.025, 0.025, 2.0, '#dfe6ea', 0, 1.0, 0, { seg: 6 });
      for (let k = 0; k < 8; k++) A.cone(0.85, 0.36, k % 2 ? a : b, 0, 2.05, 0, { seg: 8 }); for (let k = 0; k < 16; k++) { const t = k / 16 * TAU; A.box(0.08, 0.14, 0.01, c, Math.cos(t) * 0.82, 1.82, Math.sin(t) * 0.82, { ry: -t + HP, r: 0 }); } return null;
    case 'roket': A.cyl(0.2, 0.22, 0.9, a, 0, 0.75, 0, { seg: 12 }); A.cone(0.2, 0.4, b, 0, 1.4, 0, { seg: 12 }); A.cyl(0.08, 0.08, 0.02, '#bfe6e9', 0, 0.95, 0.2, { rx: HP, seg: 10 }); A.tor(0.08, 0.015, c, 0, 0.95, 0.205, { rs: 3, ts: 12 });
      for (let k = 0; k < 3; k++) { const t = k / 3 * TAU; A.box(0.04, 0.4, 0.26, b, Math.cos(t) * 0.24, 0.42, Math.sin(t) * 0.24, { ry: -t, r: 0.01 }); } A.cone(0.14, 0.2, '#ffd23f', 0, 0.2, 0, { rx: Math.PI, seg: 8 }); BU.cone(0.08, 0.14, '#f08a3c', 0, 0.12, 0, { rx: Math.PI, seg: 6 }); return null;
    case 'uydu': A.box(0.3, 0.5, 0.3, c, 0, 0.25, 0, { r: 0.03 }); A.cyl(0.03, 0.03, 0.4, b, 0, 0.7, 0, { seg: 6 }); A.lathe([[0, 0], [0.2, 0.04], [0.38, 0.14], [0.4, 0.16]], a, 0, 0.92, 0.05, { seg: 14, rx: -0.6 }); A.cyl(0.01, 0.01, 0.3, b, 0, 1.1, 0.12, { rx: -0.6, seg: 3 }); BU.sph(0.03, c, 0, 1.24, 0.22, { ws: 4, hs: 3 }); return null;
    case 'ag': A.box(0.06, 1.3, 0.06, WOOD, -0.5, 0.65, 0, { r: 0.01 }); A.box(0.06, 1.3, 0.06, WOOD, 0.5, 0.65, 0, { r: 0.01 }); A.box(1.06, 0.05, 0.05, WOOD, 0, 1.28, 0, { r: 0.01 });
      for (let i = 0; i < 6; i++) A.box(0.94, 0.012, 0.012, a, 0, 0.35 + i * 0.16, 0, { r: 0 }); for (let i = 0; i < 7; i++) A.box(0.012, 0.85, 0.012, a, -0.42 + i * 0.14, 0.78, 0, { r: 0 });
      [-0.3, 0, 0.3].forEach(x => A.sph(0.06, b, x, 1.2, 0.03, { ws: 6, hs: 4 })); A.tor(0.16, 0.04, c, 0.3, 0.05, 0.3, { rx: HP, rs: 4, ts: 12 }); return null;
    case 'sandal': A.lathe([[0, 0], [0.22, 0.02], [0.3, 0.16], [0.32, 0.3], [0.28, 0.3]], a, 0, 0.0, 0, { seg: 14, sz: 2.6 } as never); A.box(0.5, 0.03, 0.12, c, 0, 0.24, 0.1, { r: 0 }); A.box(0.5, 0.03, 0.12, c, 0, 0.24, -0.35, { r: 0 });
      A.tor(0.3, 0.02, b, 0, 0.3, 0, { rx: HP, rs: 3, ts: 18, sy: 2.6 } as never); A.cyl(0.015, 0.02, 0.9, c, 0.3, 0.4, 0.2, { rz: -1.1, seg: 4 }); return null;
    case 'olta': A.cyl(0.13, 0.11, 0.24, a, 0, 0.12, 0, { seg: 10, open: true }); A.cyl(0.11, 0.11, 0.02, '#bfe6e9', 0, 0.2, 0, { seg: 10 }); A.tor(0.12, 0.008, '#aaa', 0, 0.26, 0, { rs: 3, ts: 10, arc: Math.PI });
      A.cyl(0.012, 0.018, 1.4, b, 0.2, 0.7, -0.1, { rz: -0.3, seg: 4 }); A.cyl(0.003, 0.003, 0.6, '#ddd', 0.55, 0.9, -0.1, { seg: 3 }); A.sph(0.03, c, 0.55, 0.6, -0.1, { ws: 4, hs: 3 }); return null;
    case 'karinca': A.cyl(0.75, 0.8, 0.12, b, 0, 0.06, 0, { seg: 16 }); A.cyl(0.06, 0.06, 1.6, c, 0, 0.8, 0, { seg: 8 }); A.cone(0.85, 0.4, a, 0, 1.8, 0, { seg: 12 }); A.cone(0.86, 0.38, b, 0, 1.78, 0, { seg: 12, open: true } as never);
      for (let k = 0; k < 4; k++) { const t = k / 4 * TAU, x = Math.cos(t) * 0.5, z = Math.sin(t) * 0.5; A.cyl(0.015, 0.015, 1.5, c, x, 0.85, z, { seg: 4 }); A.box(0.3, 0.14, 0.1, k % 2 ? a : W, x, 0.6 + (k % 2) * 0.15, z, { ry: -t, r: 0.04 }); }
      bulbRow(BU, -0.8, 0.8, 1.62, 0, 9, '#ffe6a0', 0.02); return { x: 0, y: 1.5, z: 0 };
    case 'araba': [[-0.32, 0.22], [0.32, 0.22]].forEach(([x, z]) => A.tor(0.12, 0.03, DARK, x, 0.12, z, { rs: 4, ts: 10 })); A.box(0.8, 0.5, 0.42, a, 0, 0.45, 0, { r: 0.05 }); A.box(0.84, 0.05, 0.46, b, 0, 0.72, 0, { r: 0.02 });
      A.cyl(0.2, 0.15, 0.24, '#e8f6ff', 0, 0.86, 0, { seg: 12, open: true }); A.sph(0.18, '#f8c8d8', 0, 1.0, 0, { ws: 8, hs: 6 }); [-0.38, 0.38].forEach(x => A.cyl(0.015, 0.015, 0.7, c, x, 1.05, -0.18, { seg: 4 })); A.box(0.86, 0.06, 0.5, c, 0, 1.4, 0, { r: 0.02, rx: 0.1 }); return null;
    case 'sera': A.box(1.3, 0.1, 1.0, '#a7a69c', 0, 0.05, 0, { r: 0.02 }); A.box(1.2, 0.9, 0.9, a, 0, 0.55, 0, { r: 0.01 }); for (let i = 0; i < 4; i++) A.box(0.03, 0.92, 0.92, c, -0.6 + i * 0.4, 0.56, 0, { r: 0 });
      A.box(0.9, 0.04, 1.22, c, -0.3, 1.2, 0, { rz: 0.6, r: 0, ry: HP } as never); A.cone(0.75, 0.5, a, 0, 1.25, 0, { seg: 4, ry: Math.PI / 4 }); for (let k = 0; k < 5; k++) A.ico(0.12, b, -0.4 + k * 0.2, 0.3, 0.1, { d: 0 }); return null;
    case 'sandik': A.box(0.56, 0.32, 0.36, a, 0, 0.16, 0, { r: 0.03 }); A.cyl(0.18, 0.18, 0.56, a, 0, 0.32, 0, { rz: HP, seg: 10, tl: Math.PI } as never); A.box(0.06, 0.48, 0.38, b, -0.18, 0.24, 0, { r: 0.01 }); A.box(0.06, 0.48, 0.38, b, 0.18, 0.24, 0, { r: 0.01 }); A.box(0.08, 0.1, 0.02, c, 0, 0.3, 0.19, { r: 0.01 }); return null;
    case 'bayrak': pole(A, 1.6, WOOD, -0.5); pole(A, 1.6, WOOD, 0.5); A.cyl(0.005, 0.005, 1.0, INK, 0, 1.52, 0, { rz: HP, seg: 3 }); for (let i = 0; i < 7; i++) { const t = i / 6, x = -0.45 + t * 0.9, y = 1.5 - Math.sin(t * Math.PI) * 0.15; A.cone(0.06, 0.16, [a, b, c][i % 3], x, y - 0.08, 0, { rx: Math.PI, seg: 3 }); } return null;
    // ── home furniture ──
    case 'kanepe': A.box(1.3, 0.36, 0.56, a, 0, 0.26, 0, { r: 0.08 }); A.box(1.3, 0.5, 0.18, a, 0, 0.6, -0.22, { r: 0.08 }); [-0.62, 0.62].forEach(x => A.box(0.16, 0.48, 0.58, a, x, 0.36, 0, { r: 0.07 }));
      A.box(0.7, 0.3, 0.02, b, 0, 0.66, -0.12, { r: 0.01 }); [-0.5, 0.5].forEach(x => A.cyl(0.03, 0.02, 0.1, c, x, 0.05, 0.2, { seg: 5 })); A.box(0.3, 0.26, 0.1, '#f2b632', -0.35, 0.56, -0.08, { r: 0.05, rx: -0.2 }); return null;
    case 'tv': A.box(0.7, 0.36, 0.4, c === '#49e6d8' ? a : a, 0, 0.18, 0, { r: 0.02 }); A.box(0.6, 0.48, 0.5, a, 0, 0.62, 0, { r: 0.06 }); A.box(0.46, 0.36, 0.02, b, -0.04, 0.63, 0.25, { r: 0.04 });
      A.box(0.3, 0.14, 0.021, c, -0.04, 0.66, 0.255, { r: 0.01 }); [0.22, 0.27].forEach((x, i) => A.cyl(0.025, 0.025, 0.02, '#ddd', x, 0.7 - i * 0.12, 0.26, { rx: HP, seg: 8 })); A.cyl(0.006, 0.006, 0.4, '#aaa', -0.1, 1.02, 0, { rz: 0.5, seg: 3 }); A.cyl(0.006, 0.006, 0.4, '#aaa', 0.1, 1.02, 0, { rz: -0.5, seg: 3 }); return null;
    case 'semaver': A.box(0.9, 0.5, 0.5, WOOD, 0, 0.25, 0, { r: 0.03 }); A.box(0.92, 0.03, 0.52, c, 0, 0.51, 0, { r: 0.01 });
      A.lathe([[0, 0], [0.1, 0], [0.07, 0.05], [0.09, 0.1], [0.16, 0.18], [0.17, 0.32], [0.12, 0.4], [0.06, 0.44], [0, 0.44]], a, -0.2, 0.52, 0, { seg: 14 }); A.lathe([[0, 0], [0.06, 0], [0.07, 0.04], [0.06, 0.08], [0, 0.09]], W, -0.2, 0.96, 0, { seg: 10 });
      [0.1, 0.22].forEach(x => A.lathe([[0, 0], [0.025, 0], [0.03, 0.03], [0.024, 0.06], [0.034, 0.1], [0, 0.1]], b, x, 0.53, 0.05, { seg: 8 })); A.box(0.2, 0.06, 0.12, '#e8c27a', 0.2, 0.55, -0.12, { r: 0.02 }); return null;
    case 'tunek': pole(A, 1.3, a); A.box(0.6, 0.05, 0.05, a, 0, 1.3, 0, { r: 0.01 }); A.push(mtx(0.12, 1.33, 0, 0, 0.4, 0));
      A.sph(0.1, b, 0, 0.1, 0, { ws: 8, hs: 6, sx: 1.4 } as never); A.sph(0.065, b, 0.1, 0.2, 0, { ws: 8, hs: 6 }); A.cone(0.02, 0.07, c, 0.18, 0.19, 0, { rz: -HP, seg: 4 }); A.box(0.18, 0.02, 0.14, '#9aa3aa', -0.04, 0.12, 0, { r: 0 }); A.pop(); return null;
    case 'kedikule': A.box(0.7, 0.06, 0.7, a, 0, 0.03, 0, { r: 0.02 }); A.cyl(0.07, 0.07, 1.4, a, -0.15, 0.7, 0, { seg: 8 }); A.cyl(0.06, 0.06, 0.9, a, 0.2, 0.45, 0.1, { seg: 8 });
      A.box(0.42, 0.05, 0.42, b, 0.15, 0.9, 0.1, { r: 0.03 }); A.box(0.46, 0.3, 0.42, c, -0.1, 1.5, 0, { r: 0.04 }); A.cyl(0.09, 0.09, 0.02, '#3a2a20', -0.1, 1.5, 0.21, { rx: HP, seg: 10 });
      A.box(0.36, 0.1, 0.02, W, -0.1, 1.72, 0.21, { r: 0.01 }); A.sph(0.05, '#e8964a', 0.25, 0.97, 0.1, { ws: 6, hs: 4 }); return null;
    case 'lav': A.lathe([[0, 0], [0.1, 0], [0.06, 0.12], [0, 0.12]], c, 0, 0, 0, { seg: 10 }); BU.lathe([[0, 0], [0.06, 0], [0.08, 0.15], [0.05, 0.32], [0, 0.32]], a, 0, 0.12, 0, { seg: 10 });
      A.lathe([[0, 0], [0.05, 0], [0.025, 0.08], [0, 0.08]], c, 0, 0.44, 0, { seg: 10 }); [0.2, 0.3, 0.38].forEach((y, i) => BU.sph(0.025 + i * 0.006, b, (i - 1) * 0.015, y, 0, { ws: 6, hs: 4 })); return { x: 0, y: 0.3, z: 0 };
    case 'yatak': A.box(1.2, 0.18, 0.8, b, 0, 0.09, 0, { r: 0.06 }); A.box(1.16, 0.06, 0.76, a, 0, 0.2, 0, { r: 0.03 }); A.box(0.5, 0.1, 0.3, W, -0.35, 0.26, 0, { r: 0.05 }); A.box(0.6, 0.05, 0.78, c, 0.25, 0.22, 0, { r: 0.02 }); return null;
    case 'dolap': A.box(0.7, 1.4, 0.4, a, 0, 0.7, 0, { r: 0.03 }); A.box(0.32, 1.2, 0.02, b, -0.17, 0.75, 0.2, { r: 0.01 }); A.box(0.32, 1.2, 0.02, b, 0.17, 0.75, 0.2, { r: 0.01 }); [-0.03, 0.03].forEach(x => A.sph(0.025, c, x, 0.78, 0.22, { ws: 5, hs: 3 })); A.box(0.74, 0.06, 0.44, b, 0, 1.43, 0, { r: 0.02 });
      A.box(0.7, 0.08, 0.42, '#5d4a3c', 0, 0.04, 0, { r: 0.01 }); A.box(0.3, 0.012, 0.012, b, -0.17, 0.7, 0.21, { r: 0 }); A.box(0.3, 0.012, 0.012, b, 0.17, 0.7, 0.21, { r: 0 }); return null;
    case 'ocak': A.box(0.7, 0.8, 0.5, a, 0, 0.4, 0, { r: 0.03 }); A.box(0.72, 0.03, 0.52, b, 0, 0.815, 0, { r: 0.01 }); [-0.17, 0.17].forEach(x => { A.tor(0.08, 0.015, b, x, 0.84, 0, { rx: HP, rs: 3, ts: 10 }); }); A.cyl(0.11, 0.1, 0.12, c, -0.17, 0.92, 0, { seg: 10 }); A.box(0.5, 0.36, 0.02, b, 0, 0.42, 0.25, { r: 0.02 });
      A.box(0.7, 0.08, 0.46, '#5d4a3c', 0, 0.04, 0, { r: 0.01 }); A.box(0.36, 0.03, 0.03, '#aab4bc', 0, 0.6, 0.27, { r: 0.01 }); return null;
    case 'buzdolabi': A.box(0.6, 1.4, 0.55, a, 0, 0.7, 0, { r: 0.08 }); A.box(0.58, 0.01, 0.56, b, 0, 1.0, 0.003, { r: 0 }); A.box(0.03, 0.2, 0.04, c, 0.24, 1.15, 0.29, { r: 0.01 }); A.box(0.03, 0.3, 0.04, c, 0.24, 0.75, 0.29, { r: 0.01 }); A.sph(0.04, '#e0533c', -0.15, 1.2, 0.28, { ws: 5, hs: 3 });
      A.box(0.56, 0.015, 0.012, '#aab4bc', 0, 0.98, 0.283, { r: 0 }); A.box(0.58, 0.08, 0.52, '#5d666d', 0, 0.04, 0, { r: 0.01 }); return null;
    case 'hamak': pole(A, 1.2, c, -0.75); pole(A, 1.2, c, 0.75); for (let i = 0; i < 9; i++) { const t = i / 8, x = -0.7 + t * 1.4, y = 1.0 - Math.sin(t * Math.PI) * 0.45; A.box(0.17, 0.03, 0.5, i % 2 ? a : b, x, y, 0, { rz: (0.5 - t) * 1.2, r: 0 }); } return null;
    case 'teleskop': [0, 2.1, 4.2].forEach(t => A.cyl(0.015, 0.015, 0.9, b, Math.cos(t) * 0.15, 0.42, Math.sin(t) * 0.15, { rz: Math.cos(t) * 0.3, rx: -Math.sin(t) * 0.3, seg: 4 }));
      A.cyl(0.07, 0.05, 0.7, a, 0.05, 0.95, 0, { rz: -0.9, seg: 10 }); A.cyl(0.08, 0.08, 0.04, c, 0.33, 1.15, 0, { rz: -0.9, seg: 10 }); return null;
    case 'kediyatak': A.cyl(0.32, 0.3, 0.16, a, 0, 0.08, 0, { seg: 14 }); A.tor(0.3, 0.06, a, 0, 0.16, 0, { rx: HP, rs: 6, ts: 16 }); A.cyl(0.26, 0.26, 0.02, b, 0, 0.15, 0, { seg: 14 }); A.sph(0.1, '#e8964a', 0.02, 0.2, 0, { ws: 8, hs: 6, sx: 1.5 } as never); A.sph(0.06, '#e8964a', 0.14, 0.24, 0.04, { ws: 6, hs: 4 }); return null;
    case 'pikap': A.box(0.8, 0.5, 0.42, a, 0, 0.25, 0, { r: 0.03 }); A.box(0.5, 0.06, 0.36, '#3c4146', 0, 0.53, 0, { r: 0.01 }); A.cyl(0.15, 0.15, 0.012, '#111', 0, 0.57, 0, { seg: 16 }); A.cyl(0.05, 0.05, 0.014, b, 0, 0.577, 0, { seg: 8 }); A.cyl(0.01, 0.01, 0.2, c, 0.18, 0.6, 0.08, { rz: HP, ry: 0.5, seg: 4 }); return null;
    case 'heykel': default: {
      A.box(0.4, 0.4, 0.4, '#e2dbd0', 0, 0.2, 0, { r: 0.03 }); A.ico(0.18, a, 0, 0.6, 0, { d: 0 }); A.sph(0.06, b, 0, 0.82, 0, { ws: 6, hs: 4 }); A.box(0.26, 0.06, 0.02, c, 0, 0.25, 0.205, { r: 0 }); return null;
    }
  }
}

/** Extra catalogue item into a decor batch; false when the id is not an extra item. */
export function extraDecorInto(A: B, BU: B, id: string): { light?: L; pool?: boolean } | false {
  const d = extraById(id);
  if (!d) return false;
  const l = shapeInto(A, BU, d.shape, d.cols);
  return l ? { light: l, pool: d.cat === 'isik' && d.size !== 's' } : {};
}
export const EXTRA_DECOR_IDS = DECOR_EXTRA.map(d => d.id);

/** Paint key "material.color.pattern" -> recolour a built batch geometry in place (vertex colours). */
export function applyPaint(g: T.BufferGeometry, key: string): void {
  if (!key) return;
  const [mId, cId, pId] = key.split('.');
  const mat = PAINT_MATERIALS.find(m => m.id === mId), pc = PAINT_COLORS.find(c => c.id === cId);
  const C = g.getAttribute('color'), P = g.getAttribute('position');
  if (!C || !P) return;
  const tint = mat && mat.k > 0 ? col(mat.tint) : null, hue = pc && pc.hex ? col(pc.hex) : null;
  for (let i = 0; i < C.count; i++) {
    let r = C.getX(i), gg = C.getY(i), b = C.getZ(i);
    const lum = 0.3 * r + 0.59 * gg + 0.11 * b;
    if (hue) { const k = 0.65; r = r * (1 - k) + hue.r * lum * 1.35 * k; gg = gg * (1 - k) + hue.g * lum * 1.35 * k; b = b * (1 - k) + hue.b * lum * 1.35 * k; }
    if (tint && mat) { r = r * (1 - mat.k) + r * tint.r * mat.k * 1.2; gg = gg * (1 - mat.k) + gg * tint.g * mat.k * 1.2; b = b * (1 - mat.k) + b * tint.b * mat.k * 1.2; }
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    let m = 1;
    if (pId === 'cizgili') m = Math.floor(y * 12) % 2 ? 0.78 : 1.05;
    else if (pId === 'puantiye') m = Math.sin(x * 26) * Math.sin(y * 26) * Math.sin(z * 26 + 1) > 0.25 ? 1.25 : 0.95;
    else if (pId === 'damali') m = (Math.floor(x * 8 + 50) + Math.floor(y * 8 + 50) + Math.floor(z * 8 + 50)) % 2 ? 0.75 : 1.08;
    else if (pId === 'dalga') m = Math.sin(y * 22 + Math.sin(x * 9) * 2) > 0 ? 1.08 : 0.82;
    C.setXYZ(i, Math.min(1, r * m), Math.min(1, gg * m), Math.min(1, b * m));
  }
  C.needsUpdate = true;
}
