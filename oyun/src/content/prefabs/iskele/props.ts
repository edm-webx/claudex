/**
 * İskele props: stations (6 kinds x 4 tiers), tables, product items, money, decor, trophies, markers, ferry.
 * Ported 1:1 from v2 world.js (read-only reference); geometry, colours and proportions are kept exactly (parity is measured).
 * Port note: parameters are typed loosely (`any`) where v2 passed option bags; behaviour is unchanged.
 */
import * as T from 'three';
import { Batch, mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox } from '../../../engine/prefab/batch';
import { K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex } from '../common/v2kit';
import { extraDecorInto, applyPaint } from './decor-extra';
import { EXTRA_SIZE, PAINT_SHAPES } from '../../dekor-katalog';
import { WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, local2world as l2w, rectAABB, type Obstacle } from './layout';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
void [mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox, K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex, WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, l2w, rectAABB, V3];
export type { Obstacle };
const GEO: Record<string, any> = {};
const geocAny = (k: string, f: () => any): any => GEO[k] || (GEO[k] = f());
export const fmtMoney = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₺';

export const TRIM = ['#a9b0b6', '#dfe6ea', K.copper, K.gold];
export const crate = (b?: any, w?: any, h?: any, d?: any, x?: any, y?: any, z?: any) => b.box(w, h, d, '#ffffff', x, y + h / 2, z, { r: 0.02, uv: R.crate });
export function counterBase(A?: any, TL?: any, w?: any, d?: any, h?: any, tier?: any) {
  const top = tier >= 3 ? '#f2efe8' : tier === 2 ? '#e8edf0' : '#c9d1d8';
  A.box(w, h - 0.06, d, '#dfe4e8', 0, (h - 0.06) / 2, 0, { r: 0.02 });
  TL.span(-w / 2 + 0.05, w / 2 - 0.05, 0.1, h - 0.12, d / 2, d / 2 + 0.012, '#ffffff', { r: 0, world: 0.4 });
  // two cabinet doors on the front: a centre seam, a handle on each door, and a dark kick recess under the plinth
  A.box(0.014, h - 0.26, 0.012, '#aab4bc', 0, (h + 0.1) / 2, d / 2 + 0.02, { r: 0 });
  A.box(0.05, 0.012, 0.02, '#8c969e', -0.06, h - 0.26, d / 2 + 0.03, { r: 0.004 }); A.box(0.05, 0.012, 0.02, '#8c969e', 0.06, h - 0.26, d / 2 + 0.03, { r: 0.004 });
  A.box(w - 0.12, 0.05, 0.02, '#5d666d', 0, 0.02, d / 2 - 0.01, { r: 0 });
  A.box(w + 0.04, 0.06, d + 0.04, top, 0, h - 0.03, 0, { r: 0.02, uv: tier >= 3 ? R.marble : undefined });
  A.box(w - 0.02, 0.08, d - 0.02, '#8c969e', 0, 0.04, 0.012, { r: 0.02 });
  if (tier >= 2) A.box(w + 0.05, 0.025, 0.03, TRIM[tier - 1], 0, h - 0.07, d / 2 + 0.02, { r: 0.01 });
  return h;
}
function outdoorTop(A?: any, w?: any, d?: any, h?: any) { crate(A, w * 0.48, h - 0.05, d, -w * 0.25, 0, 0); crate(A, w * 0.48, h - 0.05, d, w * 0.25, 0, 0); A.box(w + 0.04, 0.05, d + 0.04, '#c9955c', 0, h - 0.025, 0, { r: 0.015, uv: R.grain }); return h; }
export function tulipGlass(b?: any, x?: any, y?: any, z?: any, s?: any, tea?: any, rim?: any) {
  b.lathe([[0, 0], [0.026, 0], [0.03, 0.014], [0.024, 0.045], [0.022, 0.06], [0.03, 0.095], [0.036, 0.13], [0, 0.132]], tea, x, y, z, { seg: 10, sx: s, sy: s, sz: s });
  b.cyl(0.037 * s, 0.036 * s, 0.022 * s, rim, x, y + 0.14 * s, z, { seg: 10, open: true });
}
export function stationModel(kind?: any, tier?: any, stage?: any) {
  const A = new Batch(), TL = new Batch(), S: any = { A, TL, w: 1.1, d: 0.7, out: V3(), meat: null, steam: [], spin: null, glow: [] };
  const out = stage === 1, tc = TRIM[tier - 1], gold = tier === 4;
  if (kind === 'doner') {
    if (out) {
      S.w = 2.0; S.d = 0.85;
      const body = ['#6f9e98', K.red, '#f3e6cc', '#fff6e6'][tier - 1];
      [[-0.68, 0.43], [0.68, 0.43], [-0.68, -0.43], [0.68, -0.43]].forEach(([x, z]) => { A.tor(0.16, 0.05, '#2a2a2a', x, 0.21, z, { ry: HP, rs: 6, ts: 14 }); A.cyl(0.07, 0.07, 0.07, tc, x, 0.21, z, { rz: HP, seg: 8 }); });
      A.box(1.9, 0.64, 0.8, body, 0, 0.58, 0, { r: 0.05, uv: undefined });
      A.box(1.92, 0.06, 0.82, tc, 0, 0.29, 0, { r: 0.02 });
      A.label(0.9, 0.3, R.cartSign, 0.42, 0.6, 0.405, { tint: tier === 1 ? '#e8d8c8' : '#ffffff' });
      A.box(1.96, 0.05, 0.86, tier === 1 ? '#a8a49c' : '#e6ecf0', 0, 0.925, 0, { r: 0.02, uv: undefined });
      // glass box frame with the heater and the şiş
      [[-0.92, -0.38], [0.08, -0.38], [-0.92, 0.38], [0.08, 0.38]].forEach(([x, z]) => A.box(0.04, 1.0, 0.04, tc, x, 1.45, z, { r: 0.01 }));
      A.box(1.06, 0.06, 0.82, tier >= 3 ? tc : (tier === 1 ? '#8f8a80' : '#d8dee2'), -0.42, 1.97, 0, { r: 0.02 });
      A.box(0.78, 0.86, 0.06, '#3a2f2a', -0.42, 1.42, -0.34, { r: 0.02 });
      for (let i = 0; i < 4; i++) A.box(0.62, 0.06, 0.02, '#ff8a3a', -0.42, 1.12 + i * 0.2, -0.305, { r: 0 });
      A.cyl(0.015, 0.015, 1.02, gold ? K.gold : '#cdd5dc', -0.42, 1.44, 0.02, { seg: 6 });
      S.meat = { x: -0.42, y: 1.42, z: 0.02, s: 0.82 + tier * 0.06 };
      if (tier >= 3) A.cone(0.62, 0.32, tc, -0.42, 2.17, 0, { seg: 4, ry: PI / 4, sz: 0.75 });
      // cutting board, knife, gas cylinder, push handle
      A.box(0.78, 0.04, 0.55, '#d9b07a', 0.5, 0.97, 0.06, { r: 0.015, uv: R.grain });
      A.box(0.34, 0.012, 0.05, gold ? K.gold : '#e6ecf0', 0.55, 1.0, -0.3, { r: 0, ry: 0.2 }); A.box(0.12, 0.025, 0.035, '#2a2a2a', 0.33, 1.0, -0.26, { r: 0.01, ry: 0.2 });
      A.cyl(0.15, 0.15, 0.55, '#2f6fdb', -1.12, 0.3, 0.12, { seg: 12 }); A.sph(0.15, '#2f6fdb', -1.12, 0.57, 0.12, { tl: HP, ws: 12, hs: 4 }); A.cyl(0.04, 0.04, 0.08, '#c9a24a', -1.12, 0.74, 0.12, { seg: 6 });
      A.cyl(0.025, 0.025, 0.5, tc, 1.12, 0.85, 0.25, { rz: -1.0, seg: 6 }); A.cyl(0.025, 0.025, 0.5, tc, 1.12, 0.85, -0.25, { rz: -1.0, seg: 6 }); A.cyl(0.03, 0.03, 0.56, '#2a2a2a', 1.32, 0.98, 0, { rx: HP, seg: 6 });
      if (tier === 1) { A.label(0.3, 0.2, R.menuTiny, -0.55, 0.62, 0.405); }
      S.out.set(0.52, 0.99, 0.08);
    } else {
      S.w = 1.3; S.d = 0.75;
      const h = counterBase(A, TL, 1.3, 0.75, 0.9, tier);
      A.box(0.82, 1.3, 0.1, gold ? K.gold : '#3a2f2a', -0.2, h + 0.66, -0.3, { r: 0.03 });
      A.box(0.9, 1.38, 0.06, tc, -0.2, h + 0.66, -0.36, { r: 0.02 });
      for (let i = 0; i < 5; i++) A.box(0.64, 0.07, 0.02, '#ff8a3a', -0.2, h + 0.18 + i * 0.24, -0.245, { r: 0 });
      A.cyl(0.018, 0.018, 1.38, gold ? K.gold : '#cdd5dc', -0.2, h + 0.69, 0.02, { seg: 6 });
      A.cyl(0.3, 0.3, 0.03, tc, -0.2, h + 1.36, 0.02, { seg: 16 }); A.cyl(0.34, 0.3, 0.05, tc, -0.2, h + 0.04, 0.02, { seg: 16 });
      S.meat = { x: -0.2, y: h + 0.66, z: 0.02, s: 0.95 + tier * 0.08 };
      if (tier >= 3) { A.cone(0.62, 0.35, tc, -0.2, h + 1.62, -0.1, { seg: 4, ry: PI / 4, sz: 0.8 }); A.cyl(0.08, 0.08, 0.4, tc, -0.2, h + 1.95, -0.1, { seg: 8 }); }
      A.box(0.4, 0.04, 0.42, '#d9b07a', 0.4, h + 0.02, 0.1, { r: 0.015, uv: R.grain });
      A.box(0.32, 0.012, 0.05, gold ? K.gold : '#e6ecf0', 0.42, h + 0.05, -0.18, { r: 0, ry: 0.3 });
      if (tier >= 3) { A.cyl(0.1, 0.08, 0.06, '#f4efe6', 0.48, h + 0.03, -0.15, { seg: 10 }); A.cap(0.025, 0.06, '#5a9e3f', 0.46, h + 0.08, -0.15, { rz: HP }); A.cap(0.025, 0.05, '#e0533c', 0.52, h + 0.08, -0.12, { rz: HP }); }
      S.out.set(0.4, h + 0.04, 0.12);
    }
    if (gold) S.spin = { kind: 'ring', x: S.meat.x, y: S.meat.y, z: S.meat.z };
  } else if (kind === 'cay') {
    S.w = 1.1; S.d = 0.7;
    const h = out ? outdoorTop(A, 1.05, 0.62, 0.66) : counterBase(A, TL, 1.1, 0.7, 0.9, tier);
    const pot = [K.red, '#e6ecf0', K.copper, K.gold][tier - 1];
    if (tier <= 2) {
      A.cyl(0.18, 0.2, 0.07, '#2a2a2a', -0.24, h + 0.035, -0.05, { seg: 12 }); A.tor(0.12, 0.012, '#4aa3ff', -0.24, h + 0.075, -0.05, { rx: HP, rs: 4, ts: 12 });
      A.lathe([[0, 0], [0.15, 0], [0.18, 0.06], [0.17, 0.17], [0.1, 0.23], [0, 0.24]], pot, -0.24, h + 0.07, -0.05, { seg: 14 });
      A.cyl(0.02, 0.03, 0.16, pot, -0.06, h + 0.2, -0.05, { rz: -0.9, seg: 6 });
      A.tor(0.1, 0.015, '#2a2a2a', -0.24, h + 0.33, -0.05, { rs: 4, ts: 10, arc: PI });
      A.lathe([[0, 0], [0.09, 0], [0.105, 0.05], [0.09, 0.11], [0.04, 0.14], [0, 0.145]], pot, -0.24, h + 0.3, -0.05, { seg: 12 });
      A.sph(0.025, '#2a2a2a', -0.24, h + 0.46, -0.05, { ws: 6, hs: 4 });
      if (tier === 1) for (let k = 0; k < 6; k++) A.sph(0.016, '#ffffff', -0.24 + Math.cos(k) * 0.172, h + 0.15, -0.05 + Math.sin(k) * 0.172, { ws: 4, hs: 3 });
      S.steam.push(V3(-0.24, h + 0.5, -0.05), V3(-0.02, h + 0.27, -0.05));
    } else {
      A.box(0.42, 0.03, 0.42, '#ffffff', -0.24, h + 0.015, -0.05, { r: 0.01, uv: R.cini });
      A.lathe([[0, 0], [0.12, 0], [0.08, 0.06], [0.1, 0.1], [0.19, 0.2], [0.2, 0.36], [0.15, 0.46], [0.08, 0.5], [0.08, 0.58], [0, 0.58]], pot, -0.24, h + 0.03, -0.05, { seg: 16 });
      A.tor(0.2, 0.015, gold ? '#fff0b0' : '#9a5426', -0.24, h + 0.3, -0.05, { rx: HP, rs: 4, ts: 16 });
      A.cyl(0.015, 0.02, 0.12, pot, -0.07, h + 0.15, -0.05, { rz: HP, seg: 6 }); A.sph(0.025, '#2a2a2a', -0.01, h + 0.15, -0.05, { ws: 6, hs: 4 });
      A.lathe([[0, 0], [0.07, 0], [0.085, 0.04], [0.07, 0.09], [0, 0.1]], '#fbfaf6', -0.24, h + 0.61, -0.05, { seg: 12 }); A.cyl(0.086, 0.086, 0.02, K.blue, -0.24, h + 0.645, -0.05, { seg: 12, open: true });
      [[0.3, -0.22], [0.38, -0.16], [0.34, -0.25]].forEach(([x, z]) => A.box(0.04, 0.04, 0.04, K.pink, x, h + 0.04, z, { r: 0.01 }));
      S.steam.push(V3(-0.24, h + 0.72, -0.05));
      if (gold) S.spin = { kind: 'gullglass', x: -0.24, y: h + 1.0, z: -0.05 };
    }
    A.box(0.36, 0.02, 0.3, tier === 2 ? '#bfe3f0' : tc, 0.3, h + 0.01, 0.12, { r: 0.01 });
    for (let k = 0; k < 3; k++) tulipGlass(A, 0.18 + k * 0.1, h, -0.22, 1, tier === 2 ? '#9e1f10' : K.teaRed, '#f0e8e0');
    S.out.set(0.3, h + 0.02, 0.12);
  } else if (kind === 'ayran') {
    if (out) {
      S.w = 1.0; S.d = 0.66;
      crate(A, 0.98, 0.28, 0.64, 0, 0, 0);
      A.box(0.94, 0.5, 0.6, '#f4f6f8', 0, 0.54, 0, { r: 0.05 });
      A.box(0.97, 0.1, 0.63, '#2f6fdb', 0, 0.84, 0, { r: 0.04 });
      A.label(0.6, 0.15, R.fridgeAyran, 0, 0.56, 0.305);
      [-0.38, 0.38].forEach(x => A.box(0.05, 0.05, 0.2, '#1d4fa8', x, 0.68, 0.0, { r: 0.02 }));
      S.out.set(0.22, 0.89, 0.06);
      propsAyran(A, tier, -0.24, 0.89, 0.0);
    } else {
      S.w = 1.25; S.d = 0.72;
      const fx = -0.2;
      A.box(0.85, 1.85, 0.7, '#f4f6f8', fx, 0.925, 0, { r: 0.04 });
      A.box(0.86, 0.22, 0.04, '#2f6fdb', fx, 1.72, 0.34, { r: 0.02 }); A.label(0.7, 0.17, R.fridgeAyran, fx, 1.72, 0.365);
      A.box(0.7, 1.32, 0.02, '#cfeaf6', fx, 0.86, -0.27, { r: 0 });
      [[-0.38, 0.86, 0.34, 0.06, 1.42], [0.38 - 0.4 * 0, 0.86, 0.34, 0.06, 1.42]].forEach(([dx, y, z, w, hh]) => A.box(w, hh, 0.05, '#dfe4e8', fx + dx, y, z, { r: 0.02 }));
      A.box(0.82, 0.06, 0.05, '#dfe4e8', fx, 0.14, 0.34, { r: 0.02 });
      for (let s = 0; s < 3; s++) { A.box(0.72, 0.02, 0.55, '#c9d3da', fx, 0.32 + s * 0.42, 0.02, { r: 0 }); for (let c = 0; c < 5; c++) itemInto(A, 'ayran', s === 2 && tier >= 2 ? 2 : 1, mtx(fx - 0.28 + c * 0.14, 0.33 + s * 0.42, 0.12, 0, 0, 0, 0.9, 0.9, 0.9)); }
      A.box(0.72, 0.03, 0.03, '#ffffff', fx, 1.5, 0.37, { r: 0, rz: 0.4 });
      A.box(0.36, 0.9, 0.6, '#dfe4e8', 0.43, 0.45, 0, { r: 0.02 }); A.box(0.4, 0.04, 0.64, tc, 0.43, 0.92, 0, { r: 0.015 });
      S.out.set(0.43, 0.94, 0.04);
      propsAyran(A, tier, fx, 1.85, 0.0);
    }
    if (gold) S.spin = { kind: 'cloud', x: out ? -0.24 : -0.2, y: out ? 1.4 : 2.3, z: 0 };
  } else if (kind === 'simit') {
    if (out) {
      S.w = 1.1; S.d = 1.0;
      [-1, 1].forEach(sg => { A.box(0.06, 1.0, 0.06, '#8a5d3b', 0, 0.42, sg * 0.28, { rz: 0.5, r: 0.015 }); A.box(0.06, 1.0, 0.06, '#8a5d3b', 0, 0.42, sg * 0.28, { rz: -0.5, r: 0.015 }); });
      A.box(0.05, 0.05, 0.62, '#8a5d3b', 0, 0.42, 0, { r: 0.015 });
      A.cyl(0.52, 0.5, 0.06, '#c9955c', 0, 0.84, 0, { seg: 20, uv: R.grain }); A.tor(0.51, 0.025, '#a8774f', 0, 0.87, 0, { rx: HP, rs: 4, ts: 24 });
      const h = 0.87;
      const ring = (cx?: any, cz?: any, y?: any, n?: any, rr?: any) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; itemInto(A, 'simit', 1, mtx(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, 0, a, 0)); } };
      ring(-0.14, -0.12, h, 6, 0.2); itemInto(A, 'simit', 1, mtx(-0.14, h, -0.12)); ring(-0.14, -0.12, h + 0.05, 3, 0.1); itemInto(A, 'simit', 1, mtx(-0.14, h + 0.1, -0.12));
      propsSimit(A, tier, -0.3, h, 0.22);
      S.out.set(0.24, h, 0.2);
    } else {
      S.w = 1.2; S.d = 0.7;
      const h = counterBase(A, TL, 1.2, 0.7, 0.9, tier);
      A.box(0.78, 0.04, 0.5, tc, -0.18, h + 0.55, -0.06, { r: 0.015 });
      [[-0.56, 0.18], [0.2, 0.18], [-0.56, -0.3], [0.2, -0.3]].forEach(([x, z]) => A.box(0.03, 0.55, 0.03, tc, x, h + 0.28, z, { r: 0.008 }));
      A.box(0.78, 0.5, 0.02, '#e6f2f6', -0.18, h + 0.27, -0.3, { r: 0 });
      A.box(0.72, 0.02, 0.44, '#c9955c', -0.18, h + 0.26, -0.06, { r: 0 });
      for (let i = 0; i < 4; i++) { itemInto(A, 'simit', 1, mtx(-0.44 + i * 0.17, h + 0.01, -0.12)); itemInto(A, 'simit', 1, mtx(-0.44 + i * 0.17, h + 0.27, -0.1)); itemInto(A, 'simit', 1, mtx(-0.36 + i * 0.17, h + 0.32, -0.1)); }
      propsSimit(A, tier, -0.3, h, 0.2);
      S.out.set(0.38, h, 0.15);
    }
    if (gold) S.spin = { kind: 'planet', x: out ? -0.14 : -0.18, y: out ? 1.45 : 1.75, z: -0.1 };
  } else if (kind === 'tost') {
    S.w = 1.0; S.d = 0.68;
    let h: any;
    if (out) { h = 0.76; A.box(1.0, 0.04, 0.62, '#efe6d6', 0, h - 0.02, 0, { r: 0.015 }); [[-0.44, -0.26], [0.44, -0.26], [-0.44, 0.26], [0.44, 0.26]].forEach(([x, z]) => A.box(0.035, h - 0.04, 0.035, '#8c969e', x, (h - 0.04) / 2, z, { r: 0.01 })); A.box(1.01, 0.12, 0.005, '#e0533c', 0, h - 0.08, 0.31, { r: 0 }); }
    else h = counterBase(A, TL, 1.0, 0.68, 0.9, tier);
    const press = (x?: any, w?: any, c?: any) => {
      A.box(w, 0.1, 0.34, '#2a2a2a', x, h + 0.05, -0.04, { r: 0.03 });
      A.box(w - 0.02, 0.025, 0.3, '#8c969e', x, h + 0.11, -0.04, { r: 0.01 });
      A.box(w, 0.09, 0.34, c, x, h + 0.17, -0.06, { r: 0.03, rx: -0.08 });
      A.cyl(0.018, 0.018, w * 0.7, '#2a2a2a', x, h + 0.2, 0.15, { rz: HP, seg: 6 });
      A.box(0.05, 0.05, 0.05, '#e0533c', x + w / 2 - 0.05, h + 0.06, 0.13, { r: 0.01 });
      S.steam.push(V3(x, h + 0.25, -0.04));
    };
    if (tier === 3) { press(-0.32, 0.34, '#d8dee2'); press(0.04, 0.34, '#d8dee2'); }
    else press(-0.2, tier === 1 ? 0.42 : 0.5, gold ? K.gold : tier === 2 ? '#e6ecf0' : '#9aa3aa');
    A.box(0.3, 0.13, 0.14, '#f1dcae', 0.28, h + 0.065, -0.2, { r: 0.04 }); A.box(0.31, 0.03, 0.15, '#c98a4a', 0.28, h + 0.12, -0.2, { r: 0.015 });
    A.cap(0.03, 0.22, '#a8322a', 0.3, h + 0.03, -0.06, { rz: HP });
    if (tier >= 2) { A.box(0.12, 0.04, 0.08, '#fff3b0', 0.42, h + 0.02, -0.06, { r: 0.012 }); }
    if (tier >= 3) { A.cyl(0.03, 0.03, 0.16, '#e0533c', 0.42, h + 0.08, -0.24, { seg: 8 }); A.cyl(0.03, 0.03, 0.16, '#f2c230', 0.48, h + 0.08, -0.18, { seg: 8 }); }
    S.out.set(0.3, h, 0.14);
    if (gold) S.spin = { kind: 'lava', x: -0.2, y: h + 0.32, z: -0.04 };
  } else if (kind === 'gazoz') {
    const fh = out ? 1.5 : 1.85, fx = -0.2;
    S.w = 1.25; S.d = 0.72;
    const body = gold ? '#fff6e6' : K.red;
    A.box(0.85, fh, 0.68, body, fx, fh / 2, 0, { r: 0.05, uv: undefined });
    const hdr = [R.fridgeBogaz, R.fridgeKolaz, R.fridgeBogaz, R.kolazUzay][tier - 1];
    A.box(0.86, 0.2, 0.04, gold ? K.gold : shade(K.red, -0.12), fx, fh - 0.14, 0.33, { r: 0.02 }); A.label(0.7, 0.16, hdr, fx, fh - 0.14, 0.355);
    A.box(0.7, fh - 0.5, 0.02, '#f6e0dc', fx, (fh - 0.36) / 2 + 0.06, -0.26, { r: 0 });
    [-0.39, 0.39].forEach(dx => A.box(0.06, fh - 0.35, 0.05, tc, fx + dx, (fh - 0.35) / 2 + 0.1, 0.33, { r: 0.02 }));
    const ns = out ? 2 : 3;
    for (let s = 0; s < ns; s++) { const y = 0.3 + s * 0.44; A.box(0.72, 0.02, 0.55, '#d9dfe4', fx, y, 0.02, { r: 0 }); for (let c = 0; c < 5; c++) itemInto(A, 'gazoz', tier === 3 ? 1 : tier, mtx(fx - 0.28 + c * 0.14, y + 0.01, 0.1, 0, 0, 0, 0.9, 0.9, 0.9)); }
    A.box(0.7, 0.03, 0.03, '#ffffff', fx, fh * 0.6, 0.36, { r: 0, rz: 0.4 });
    if (out) { for (let k = 0; k < 5; k++) A.box(0.02, 0.02, 0.4, '#2a2a2a', fx + 0.3, 0.02, -0.5 - k * 0.4, { r: 0, ry: Math.sin(k) * 0.3 }); }
    A.box(0.36, 0.9, 0.6, out ? '#c9955c' : '#dfe4e8', 0.43, 0.45, 0, { r: 0.02, uv: out ? R.crate : undefined }); A.box(0.4, 0.04, 0.64, tc, 0.43, 0.92, 0, { r: 0.015 });
    if (tier >= 3) { A.cyl(0.13, 0.11, 0.16, '#cdd5dc', fx, fh + 0.08, 0, { seg: 12 }); for (let k = 0; k < 5; k++) A.box(0.05, 0.05, 0.05, '#e6f6ff', fx - 0.06 + (k % 3) * 0.05, fh + 0.17, (k > 2 ? 0.04 : -0.03), { r: 0.012 }); A.cyl(0.04, 0.04, 0.015, '#f5e04a', fx + 0.08, fh + 0.18, 0.05, { rx: 0.4, seg: 10 }); }
    S.out.set(0.43, 0.94, 0.04);
    if (gold) S.spin = { kind: 'bottle', x: fx, y: fh + 0.35, z: 0 };
  }
  return S;
}
function propsAyran(A?: any, tier?: any, x?: any, y?: any, z?: any) {
  if (tier === 1) { for (let k = 0; k < 3; k++) itemInto(A, 'ayran', 1, mtx(x - 0.1 + k * 0.1, y, z - 0.08)); }
  else if (tier === 2) { A.lathe([[0, 0], [0.08, 0], [0.085, 0.2], [0.07, 0.24], [0, 0.24]], '#fbfbf7', x, y, z - 0.05, { seg: 12 }); A.tor(0.05, 0.012, '#e6f2f6', x + 0.09, y + 0.12, z - 0.05, { ry: 0, rs: 4, ts: 10 }); itemInto(A, 'ayran', 2, mtx(x + 0.16, y, z + 0.08)); }
  else { A.cyl(0.13, 0.13, 0.42, '#b98a5e', x, y + 0.21, z - 0.04, { seg: 12, uv: R.grain }); [0.08, 0.34].forEach(h => A.tor(0.132, 0.012, '#7d5638', x, y + h, z - 0.04, { rx: HP, rs: 4, ts: 14 })); A.cyl(0.02, 0.02, 0.3, '#7d5638', x, y + 0.55, z - 0.04, { seg: 5 }); itemInto(A, 'ayran', 3, mtx(x + 0.2, y, z + 0.1)); }
}
function propsSimit(A?: any, tier?: any, x?: any, y?: any, z?: any) {
  if (tier >= 2) { A.cyl(0.1, 0.09, 0.015, '#fbfaf6', x, y + 0.008, z, { seg: 12 }); A.box(0.1, 0.05, 0.07, '#fbfbf2', x, y + 0.04, z, { r: 0.012 }); }
  if (tier >= 3) { itemInto(A, 'simit', 3, mtx(x + 0.02, y, z - 0.22, 0, 0.4, 0, 0.8, 0.8, 0.8)); }
}
export function meatGeo(tier?: any) {
  return geoc('meat' + tier, () => {
    const b = new Batch(), c = tier === 1 ? K.chicken : K.meat, dark = tier === 1 ? '#b97a3e' : '#6e3418';
    b.lathe([[0, -0.5], [0.15, -0.5], [0.2, -0.3], [0.26, 0.1], [0.29, 0.4], [0.24, 0.5], [0, 0.52]], c, 0, 0, 0, { seg: 12 });
    for (let i = 0; i < 6; i++) { const y = -0.42 + i * 0.16, r = 0.16 + (y + 0.5) * 0.13; b.tor(r + 0.01, 0.018, dark, 0, y, 0, { rx: HP, rs: 4, ts: 12, arc: TAU * 0.6, rz: i }); }
    return b.geometry();
  });
}
export function spinGeo(kind?: any) {
  return geoc('spin' + kind, () => {
    const b = new Batch();
    if (kind === 'ring') { b.tor(0.48, 0.025, '#a8322a', 0, 0, 0, { rx: HP, rs: 6, ts: 32 }); for (let i = 0; i < 10; i++) b.sph(0.035, '#c23e2c', Math.cos(i / 10 * TAU) * 0.48, 0, Math.sin(i / 10 * TAU) * 0.48, { ws: 6, hs: 4 }); }
    else if (kind === 'gullglass') { itemInto(b, 'cay', 4, mtx(0, 0, 0, 0, 0, 0, 1.6, 1.6, 1.6)); }
    else if (kind === 'cloud') { [[0, 0, 0, 0.16], [0.14, 0.02, 0, 0.12], [-0.14, 0.01, 0.02, 0.12], [0.05, 0.1, 0, 0.11], [0, -0.02, 0.1, 0.1]].forEach(([x, y, z, r]) => b.sph(r, '#ffffff', x, y, z, { ws: 10, hs: 8 })); }
    else if (kind === 'planet') { itemInto(b, 'simit', 4, mtx(0, -0.08, 0, 0, 0, 0, 2.2, 2.2, 2.2)); }
    else if (kind === 'lava') { b.tor(0.2, 0.025, '#f5c542', 0, 0.0, 0, { arc: PI, rs: 6, ts: 16 }); b.tor(0.12, 0.022, '#f5c542', 0.08, 0.05, 0.02, { arc: PI * 1.3, rs: 6, ts: 14, rz: 0.6 }); }
    else if (kind === 'bottle') { itemInto(b, 'gazoz', 4, mtx(0, -0.25, 0, 0, 0, 0, 2.2, 2.2, 2.2)); }
    return b.geometry();
  });
}

export function tableInto(A?: any, style?: any, tavla?: any) {
  const top = ({ 1: 0.62, 2: 0.74, 3: 0.74, 4: 0.76, 5: 0.76 } as Record<number, number>)[style];
  if (style === 1) {
    A.cyl(0.38, 0.38, 0.04, '#e9e4da', 0, top, 0, { seg: 16 }); A.cyl(0.04, 0.05, top - 0.02, '#8c969e', 0, top / 2, 0, { seg: 8 }); A.cyl(0.24, 0.26, 0.03, '#8c969e', 0, 0.015, 0, { seg: 12 });
    [-0.75, 0.75].forEach(x => { A.cyl(0.19, 0.19, 0.06, '#e2c27a', x, 0.44, 0, { seg: 12, uv: R.hasir }); [0, 1, 2, 3].forEach(k => A.cyl(0.018, 0.022, 0.42, '#7d5638', x + Math.cos(k * HP + 0.78) * 0.13, 0.21, Math.sin(k * HP + 0.78) * 0.13, { seg: 4 })); });
  } else {
    const wood = style === 5 ? '#f6ead2' : '#b98a5e', legC = style >= 4 ? '#e8e2d8' : '#7d5638';
    if (style >= 4) { A.cyl(0.46, 0.46, 0.04, '#fbfaf6', 0, top, 0, { seg: 18 }); A.cyl(0.47, 0.5, 0.2, '#fbfaf6', 0, top - 0.1, 0, { seg: 18, open: true }); if (style === 5) A.tor(0.47, 0.012, K.gold, 0, top - 0.2, 0, { rx: HP, rs: 4, ts: 24 }); }
    else { A.box(0.86, 0.05, 0.86, wood, 0, top, 0, { r: 0.02, uv: R.grain }); if (style === 2) A.box(0.88, 0.012, 0.88, '#ffffff', 0, top + 0.03, 0, { r: 0, uv: R.checker }); }
    [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]].forEach(([x, z]) => A.box(0.05, top - 0.02, 0.05, legC, x, (top - 0.02) / 2, z, { r: 0.012 }));
    if (style === 3 && tavla) { A.box(0.5, 0.05, 0.38, '#8a5a34', 0, top + 0.05, 0.05, { r: 0.012 }); A.label(0.48, 0.36, R.tavla, 0, top + 0.077, 0.05, { rx: -HP }); }
    [-1, 1].forEach(sg => {
      A.push(mtx(sg * 0.78, 0, 0, 0, -sg * HP, 0));
      A.box(0.42, 0.05, 0.42, style === 5 ? K.gold : '#c98a52', 0, 0.45, 0, { r: 0.02, uv: style === 3 ? R.hasir : undefined });
      [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([x, z]) => A.box(0.04, 0.44, 0.04, legC, x, 0.22, z, { r: 0.01 }));
      A.box(0.04, 0.5, 0.04, legC, -0.17, 0.72, -0.19, { r: 0.01 }); A.box(0.04, 0.5, 0.04, legC, 0.17, 0.72, -0.19, { r: 0.01 });
      A.box(0.38, 0.14, 0.03, style === 5 ? K.gold : '#c98a52', 0, 0.9, -0.19, { r: 0.01 });
      A.pop();
    });
    if (style === 3) { tulipGlass(A, 0.25, top + 0.025, -0.28, 1, K.teaRed, '#f0e8e0'); A.cyl(0.07, 0.06, 0.016, '#ffffff', 0.25, top + 0.03, -0.28, { seg: 10 }); }
    if (style === 2) { A.cyl(0.035, 0.04, 0.08, '#e0533c', -0.28, top + 0.07, -0.28, { seg: 8 }); A.cyl(0.03, 0.03, 0.08, '#fbfaf6', -0.2, top + 0.07, -0.3, { seg: 8 }); }
  }
  return top;
}

export const ITEM_H = { doner: 0.2, cay: 0.19, ayran: 0.17, simit: 0.06, tost: 0.08, gazoz: 0.22 };
export function itemInto(b?: any, product?: any, tier?: any, m?: any) {
  if (m) b.push(m);
  const t = clamp(tier | 0 || 1, 1, 4);
  if (product === 'doner') {
    const r = t === 3 ? 0.1 : 0.09, L = 0.36, y = r + 0.005;
    b.cyl(r, r * 0.92, L, K.lavash, 0.02, y, 0, { rz: HP, seg: 12 });
    if (t === 3) b.cyl(r + 0.006, r + 0.006, L * 0.5, '#f6e6c0', 0.06, y, 0, { rz: HP, seg: 12 });
    b.cyl(r + 0.012, r + 0.01, L * 0.6, '#ffffff', -0.07, y, 0, { rz: HP, seg: 12, uv: R['wrap' + t] });
    const fill = t === 1 ? K.chicken : '#8a4a26';
    b.cyl(r * 0.84, r * 0.84, 0.02, fill, 0.2, y, 0, { rz: HP, seg: 10 });
    [[0.03, 0.03, K.tomato], [-0.03, -0.02, t === 2 ? '#a65aa0' : K.tomato], [0.0, -0.04, '#5a9e3f'], [-0.04, 0.035, '#5a9e3f'], [0.04, -0.03, t === 3 ? '#f5c542' : '#f0e6c8']].forEach(([dz, dy, c]: any) => b.sph(0.022, c, 0.205, y + dy, dz, { ws: 6, hs: 4 }));
    if (t === 3) b.cap(0.022, 0.08, '#6aa84f', -0.02, y + r + 0.02, 0.0, { rz: HP });
    if (t === 4) { b.tor(0.17, 0.012, '#a8322a', 0.02, y, 0, { ry: HP, rs: 4, ts: 24 }); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; b.sph(0.016, '#c23e2c', 0.02, y + Math.cos(a) * 0.17, Math.sin(a) * 0.17, { ws: 4, hs: 3 }); } }
  } else if (product === 'cay') {
    const sauc = ['#fbfaf6', '#bfe3f0', '#ffffff', K.gold][t - 1];
    b.cyl(0.075, 0.062, 0.016, sauc, 0, 0.008, 0, { seg: 14, uv: t === 3 ? R.cini : undefined });
    const tea = t === 2 ? '#9e1f10' : t === 4 ? '#c0501a' : K.teaRed;
    b.lathe([[0, 0], [0.026, 0], [0.03, 0.014], [0.024, 0.045], [0.022, 0.06], [0.03, 0.095], [0.036, 0.13], [0, 0.132]], tea, 0, 0.016, 0, { seg: 12 });
    b.cyl(0.0375, 0.0365, 0.024, t === 4 ? K.gold : '#f2ebe4', 0, 0.159, 0, { seg: 12, open: true });
    if (t === 4) b.cyl(0.026, 0.026, 0.012, K.gold, 0, 0.074, 0, { seg: 10 });
    b.box(0.006, 0.12, 0.008, '#d8dee2', 0.018, 0.16, 0.01, { r: 0, rz: -0.25 });
    if (t === 3) b.box(0.032, 0.03, 0.032, K.pink, 0.05, 0.03, 0.03, { r: 0.008 }); else { b.box(0.02, 0.018, 0.02, '#ffffff', 0.05, 0.026, 0.025, { r: 0.003 }); b.box(0.02, 0.018, 0.02, '#ffffff', 0.052, 0.026, -0.005, { r: 0.003, ry: 0.4 }); }
    if (t === 4) { b.box(0.07, 0.008, 0.025, '#ffffff', -0.03, 0.22, 0, { r: 0, rz: 0.45 }); b.box(0.07, 0.008, 0.025, '#ffffff', 0.03, 0.22, 0, { r: 0, rz: -0.45 }); b.sph(0.012, '#ffffff', 0, 0.21, 0.01, { ws: 5, hs: 4 }); }
  } else if (product === 'ayran') {
    if (t === 1) { b.cyl(0.058, 0.048, 0.14, '#ffffff', 0, 0.07, 0, { seg: 12 }); b.cyl(0.0595, 0.0535, 0.07, '#ffffff', 0, 0.075, 0, { seg: 12, open: true, uv: R.ayranbey }); b.cyl(0.062, 0.062, 0.01, '#c8d8ec', 0, 0.145, 0, { seg: 12 }); }
    else if (t === 2) { b.lathe([[0, 0], [0.045, 0], [0.052, 0.13], [0, 0.13]], '#fbfbf7', 0, 0, 0, { seg: 12 }); b.cyl(0.053, 0.053, 0.02, '#e6f2f6', 0, 0.14, 0, { seg: 12, open: true }); [[0, 0], [0.02, 0.015], [-0.02, -0.01]].forEach(([x, z]) => b.sph(0.022, '#ffffff', x, 0.135, z, { ws: 6, hs: 4 })); }
    else if (t === 3) { b.lathe([[0, 0], [0.05, 0], [0.075, 0.03], [0.08, 0.07], [0, 0.07]], K.copper, 0, 0, 0, { seg: 14 }); [[0, 0.09, 0, 0.05], [0.04, 0.08, 0.02, 0.035], [-0.035, 0.085, -0.02, 0.035], [0.01, 0.12, 0.0, 0.035]].forEach(([x, y, z, r]) => b.sph(r, '#ffffff', x, y, z, { ws: 8, hs: 6 })); }
    else { b.lathe([[0, 0], [0.042, 0], [0.05, 0.11], [0, 0.11]], '#fbfbf7', 0, 0, 0, { seg: 12 }); b.cyl(0.051, 0.051, 0.02, '#e6f2f6', 0, 0.115, 0, { seg: 12, open: true }); [[0, 0.19, 0, 0.04], [0.035, 0.18, 0, 0.03], [-0.035, 0.185, 0.01, 0.03], [0.0, 0.215, 0.0, 0.03]].forEach(([x, y, z, r]) => b.sph(r, '#ffffff', x, y, z, { ws: 8, hs: 6 })); }
  } else if (product === 'simit') {
    if (t === 3) { b.cyl(0.15, 0.13, 0.014, '#fbfaf6', 0, 0.007, 0, { seg: 16 }); b.push(mtx(-0.04, 0.012, 0, 0, 0, 0, 0.75, 0.75, 0.75)); }
    b.tor(0.08, 0.03, '#ffffff', 0, 0.03, 0, { rx: HP, rs: 8, ts: 16, uv: R.sesame });
    if (t === 3) { b.pop(); b.box(0.06, 0.012, 0.05, '#f5c542', 0.08, 0.02, -0.06, { r: 0.004 }); [[0.09, 0.04], [0.06, 0.08]].forEach(([x, z]) => b.cyl(0.026, 0.026, 0.01, K.tomato, x, 0.02, z, { seg: 10 })); [[-0.08, 0.09, '#2a2a2a'], [-0.05, 0.11, '#6a7a3a'], [0.02, 0.11, '#2a2a2a']].forEach(([x, z, c]) => b.sph(0.013, c, x, 0.024, z, { ws: 6, hs: 4 })); b.sph(0.03, '#ffffff', 0.1, 0.015, -0.0, { tl: HP, ws: 8, hs: 4 }); b.cyl(0.016, 0.016, 0.004, '#f5b82e', 0.1, 0.044, 0, { seg: 8 }); }
    if (t === 2) b.box(0.07, 0.022, 0.05, '#fbfbf2', 0.0, 0.07, 0.0, { r: 0.006, ry: 0.3 });
    if (t === 4) { b.tor(0.14, 0.006, K.gold, 0, 0.03, 0, { rx: HP - 0.35, rs: 4, ts: 28 }); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.4; b.sph(0.013, '#f6e2b4', Math.cos(a) * 0.14, 0.03 + Math.sin(a) * 0.14 * Math.sin(0.35), Math.sin(a) * 0.14 * Math.cos(0.35), { ws: 6, hs: 4 }); } }
  } else if (product === 'tost') {
    const th = t === 2 ? 0.022 : 0.03, crust = t === 2 ? '#e3a95a' : '#c98a4a';
    b.box(0.17, th, 0.15, crust, 0, th / 2, 0, { r: 0.008 });
    if (t === 3) { b.box(0.18, 0.012, 0.16, '#6aa84f', 0, th + 0.006, 0, { r: 0.004 }); b.box(0.165, 0.01, 0.14, K.tomato, 0, th + 0.017, 0, { r: 0.003 }); b.box(0.17, 0.012, 0.15, '#e88a9a', 0, th + 0.028, 0, { r: 0.004 }); }
    const ty = t === 3 ? th + 0.034 : th;
    b.box(0.182, 0.012, 0.158, '#f5c542', 0, ty + 0.006, 0, { r: 0.004 });
    [[-0.07, 0.07], [0.08, -0.06], [0.0, 0.075]].forEach(([x, z]) => b.cyl(0.02, 0.02, 0.012, '#a8322a', x, ty + 0.007, z, { seg: 8 }));
    b.box(0.17, th, 0.15, '#ffffff', 0, ty + 0.012 + th / 2, 0, { r: 0.008, uv: R.grill });
    if (t === 2) { b.sph(0.012, '#f5c542', 0.09, ty + 0.0, 0.02, { ws: 5, hs: 4 }); b.sph(0.01, '#f5c542', -0.05, ty - 0.004, 0.08, { ws: 5, hs: 4 }); }
    if (t === 4) { b.tor(0.09, 0.008, '#f5c542', 0.0, ty + th + 0.03, 0, { arc: PI, rs: 4, ts: 14 }); b.tor(0.05, 0.007, '#f5c542', 0.04, ty + th + 0.04, 0.02, { arc: PI, rs: 4, ts: 10, rz: 0.5 }); }
  } else if (product === 'gazoz') {
    if (t === 2) { b.cyl(0.036, 0.036, 0.12, '#ffffff', 0, 0.06, 0, { seg: 12, uv: R.kolaz }); b.cyl(0.033, 0.036, 0.012, '#d8dee2', 0, 0.126, 0, { seg: 12 }); b.box(0.025, 0.004, 0.012, '#c9d1d8', 0.008, 0.133, 0, { r: 0 }); }
    else if (t === 3) { b.lathe([[0, 0], [0.04, 0], [0.048, 0.13], [0, 0.13]], '#f3efc0', 0, 0, 0, { seg: 12 }); b.cyl(0.049, 0.049, 0.02, '#e6f2f6', 0, 0.135, 0, { seg: 12, open: true }); [[0.012, 0.01], [-0.015, -0.008]].forEach(([x, z]) => b.box(0.025, 0.025, 0.025, '#e6f6ff', x, 0.125, z, { r: 0.005, ry: x * 20 })); b.cyl(0.032, 0.032, 0.008, '#f5e04a', 0.04, 0.13, 0.0, { rz: HP - 0.3, seg: 10 }); b.cyl(0.005, 0.005, 0.16, K.red, -0.012, 0.15, 0.01, { rz: 0.25, seg: 4 }); }
    else {
      const glass = t === 4 ? '#24264a' : '#a8d8b0';
      b.lathe([[0, 0], [0.036, 0], [0.038, 0.01], [0.038, 0.115], [0.028, 0.145], [0.015, 0.175], [0.014, 0.195], [0, 0.195]], glass, 0, 0, 0, { seg: 12 });
      b.cyl(0.0395, 0.0395, 0.055, '#ffffff', 0, 0.065, 0, { seg: 12, open: true, uv: t === 4 ? R.kolazUzay : R.bogaz });
      b.cyl(0.017, 0.017, 0.012, t === 4 ? '#49e6d8' : K.red, 0, 0.2, 0, { seg: 8 });
      if (t === 4) for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; b.sph(0.01 + (i % 3) * 0.003, '#bff3ff', Math.cos(a) * 0.06, 0.04 + (i % 4) * 0.04, Math.sin(a) * 0.06, { ws: 5, hs: 4 }); }
    }
  }
  if (m) b.pop();
}
export function itemGeo(product?: any, tier?: any) { return geoc('item' + product + tier, () => { const b = new Batch(); itemInto(b, product, tier); return b.geometry(); }); }
export const ITEM_HT = { doner: [0.2, 0.2, 0.22, 0.2], cay: [0.19, 0.19, 0.19, 0.2], ayran: [0.15, 0.16, 0.12, 0.17], simit: [0.06, 0.08, 0.06, 0.06], tost: [0.075, 0.07, 0.11, 0.08], gazoz: [0.21, 0.135, 0.16, 0.21] };
export function moneyGeo() {
  return geoc('money', () => {
    const b = new Batch();
    for (let i = 0; i < 3; i++) b.box(0.26, 0.012, 0.13, '#ffffff', 0, 0.006 + i * 0.013, 0, { r: 0.003, ry: (i - 1) * 0.07, uv: R.note });
    b.box(0.045, 0.045, 0.138, '#f6ead2', 0, 0.021, 0, { r: 0.006 });
    return b.geometry();
  });
}

export const DECOR_SIZE: Record<string, any> = { nostalji_radyo: 's', nostalji_gazetelik: 'm', nostalji_afis: 's', nostalji_sandalye: 's', denizci_can_simidi: 's', denizci_halat: 'm', denizci_fener: 'm', denizci_martiheykel: 'l', lale_cini_pano: 'm', lale_saksi: 's', lale_semaver: 'm', lale_minder: 'm', saksi_sardunya: 's', kedi_evi: 's', sokak_lambasi: 'm', tavla_masasi: 'l' };
Object.assign(DECOR_SIZE, EXTRA_SIZE); // Dekor 2.0 catalogue sizes
export const FOOT = { s: 0.7, m: 1.2, l: 1.8 };
export function gullInto(A?: any, s?: any) {
  A.push(mtx(0, 0, 0, 0, 0, 0, s, s, s));
  [-0.05, 0.05].forEach(x => A.cyl(0.01, 0.01, 0.12, '#f2c230', x, 0.06, 0, { seg: 4 }));
  A.sph(0.13, '#f4f2ec', 0, 0.2, 0, { sx: 0.9, sy: 0.85, sz: 1.5 });
  A.sph(0.12, '#a9b3bd', 0, 0.24, -0.04, { sx: 1.05, sy: 0.55, sz: 1.35 });
  A.box(0.05, 0.03, 0.16, '#2a2a2a', -0.1, 0.25, -0.2, { r: 0.01, ry: 0.15 }); A.box(0.05, 0.03, 0.16, '#2a2a2a', 0.1, 0.25, -0.2, { r: 0.01, ry: -0.15 });
  A.sph(0.012, '#ffffff', -0.1, 0.265, -0.24, { ws: 4, hs: 3 }); A.sph(0.012, '#ffffff', 0.1, 0.265, -0.24, { ws: 4, hs: 3 });
  A.sph(0.08, '#f4f2ec', 0, 0.35, 0.15, {});
  A.cone(0.025, 0.1, '#f2c230', 0, 0.34, 0.27, { rx: HP, seg: 6 }); A.sph(0.011, '#d8433a', 0, 0.325, 0.29, { ws: 4, hs: 3 });
  [-0.045, 0.045].forEach(x => A.sph(0.012, '#2a2a2a', x, 0.37, 0.21, { ws: 4, hs: 3 }));
  A.pop();
}
export function decorInto(A?: any, BU?: any, id?: any) {
  switch (id) {
    case 'nostalji_radyo':
      A.cyl(0.24, 0.22, 0.04, '#9c6c46', 0, 0.6, 0, { seg: 14, uv: R.grain }); A.cyl(0.03, 0.04, 0.58, '#7d5638', 0, 0.29, 0, { seg: 6 }); A.cyl(0.18, 0.2, 0.03, '#7d5638', 0, 0.015, 0, { seg: 10 });
      A.box(0.42, 0.28, 0.2, '#8a5432', 0, 0.76, 0, { r: 0.06, uv: R.grain }); A.label(0.34, 0.2, R.radio, 0, 0.76, 0.102);
      [-0.12, 0.12].forEach(x => A.cyl(0.025, 0.025, 0.03, '#f6ead2', x, 0.66, 0.1, { rx: HP, seg: 8 })); A.cyl(0.008, 0.008, 0.3, '#888', 0.15, 1.0, -0.05, { rz: -0.4, seg: 4 }); break;
    case 'nostalji_gazetelik':
      [-0.42, 0.42].forEach(x => A.box(0.05, 1.3, 0.05, '#3c4146', x, 0.65, -0.12, { r: 0.012 })); A.box(0.9, 0.05, 0.4, '#3c4146', 0, 0.03, 0, { r: 0.012 });
      [0.35, 0.72, 1.08].forEach((y, i) => { A.box(0.86, 0.03, 0.26, '#5a6066', 0, y, 0.0, { rx: -0.5, r: 0.008 }); A.label(0.24, 0.32, [R.gazete, R.gazete2, R.gazete3][i], -0.22, y + 0.11, 0.06, { rx: -0.5 }); A.label(0.24, 0.32, [R.gazete3, R.gazete, R.gazete2][i], 0.13, y + 0.11, 0.06, { rx: -0.5 }); });
      A.box(0.92, 0.18, 0.04, '#1d3d6b', 0, 1.36, -0.12, { r: 0.012 }); A.label(0.8, 0.13, R.gazeteSign, 0, 1.36, -0.098); break;
    case 'nostalji_afis':
      A.box(0.05, 1.5, 0.05, '#7d5638', -0.28, 0.7, -0.1, { rx: -0.15, r: 0.012 }); A.box(0.05, 1.5, 0.05, '#7d5638', 0.28, 0.7, -0.1, { rx: -0.15, r: 0.012 }); A.box(0.05, 1.3, 0.05, '#7d5638', 0, 0.62, -0.38, { rx: 0.35, r: 0.012 });
      A.box(0.62, 0.86, 0.04, '#6b4a2e', 0, 1.0, -0.02, { rx: -0.15, r: 0.012 }); A.label(0.56, 0.8, R.afis, 0, 1.0, 0.002, { rx: -0.15 }); break;
    case 'nostalji_sandalye':
      A.push(mtx(0, 0, 0, 0, 0.35, 0)); A.box(0.42, 0.05, 0.42, '#ffffff', 0, 0.46, 0, { r: 0.02, uv: R.hasir }); A.box(0.44, 0.04, 0.44, '#7d5638', 0, 0.43, 0, { r: 0.015 });
      [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(([x, z]) => A.cyl(0.02, 0.022, 0.44, '#7d5638', x, 0.22, z, { seg: 6 }));
      [-0.18, 0.18].forEach(x => A.cyl(0.02, 0.02, 0.52, '#7d5638', x, 0.72, -0.2, { seg: 6, rx: -0.08 }));
      [0.62, 0.8, 0.95].forEach(y => A.box(0.38, 0.04, 0.025, '#8a5d3b', 0, y, -0.21, { r: 0.008 })); A.pop(); break;
    case 'denizci_can_simidi':
      A.box(0.12, 1.2, 0.12, '#8a5d3b', 0, 0.6, -0.12, { r: 0.02, uv: R.grain }); A.box(0.3, 0.06, 0.12, '#8a5d3b', 0, 1.15, -0.12, { r: 0.02 });
      A.push(mtx(0, 0.82, 0.0)); for (let k = 0; k < 8; k++) A.tor(0.26, 0.075, k % 2 ? '#fbfaf6' : '#e0533c', 0, 0, 0, { arc: TAU / 8, rz: k * TAU / 8 + 0.2, rs: 6, ts: 3 }); A.pop();
      A.tor(0.3, 0.015, '#d8c39a', 0, 0.82, 0.0, { rs: 4, ts: 20 }); A.cyl(0.012, 0.012, 0.35, '#d8c39a', 0, 1.0, -0.05, { seg: 4 }); break;
    case 'denizci_halat':
      [-0.5, 0.5].forEach(x => { A.cyl(0.07, 0.08, 0.8, '#8a5d3b', x, 0.4, 0, { seg: 8, uv: R.grain }); A.sph(0.08, '#8a5d3b', x, 0.82, 0, { ws: 8, hs: 4, tl: HP }); });
      for (let i = 0; i < 12; i++) { const t = i / 11, x = lerp(-0.5, 0.5, t), y = 0.72 - Math.sin(t * PI) * 0.2; A.sph(0.032, '#d8c39a', x, y, 0, { ws: 6, hs: 4 }); }
      A.lathe([[0, 0], [0.15, 0], [0.13, 0.06], [0.09, 0.1], [0.09, 0.26], [0.14, 0.3], [0, 0.32]], '#33373b', 0, 0, 0.3, { seg: 10 });
      for (let k = 0; k < 4; k++) A.tor(0.2 - k * 0.035, 0.035, '#d8c39a', 0.35, 0.04 + k * 0.06, 0.32, { rx: HP, rs: 5, ts: 14 }); break;
    case 'denizci_fener':
      A.ico(0.32, '#9aa3aa', -0.1, 0.12, 0.05, { d: 0, sy: 0.6 }); A.ico(0.28, '#8c969e', 0.18, 0.1, -0.08, { d: 0, sy: 0.6 }); A.cyl(0.32, 0.36, 0.14, '#9aa3aa', 0, 0.12, 0, { seg: 10 });
      for (let i = 0; i < 5; i++) A.cyl(0.24 - i * 0.022, 0.26 - i * 0.022, 0.2, i % 2 ? '#fbfaf6' : '#e0533c', 0, 0.29 + i * 0.2, 0, { seg: 14 });
      A.cyl(0.2, 0.2, 0.04, '#2a2a2a', 0, 1.2, 0, { seg: 14 }); A.tor(0.19, 0.01, '#2a2a2a', 0, 1.28, 0, { rx: HP, rs: 4, ts: 16 });
      BU.cyl(0.11, 0.11, 0.2, '#ffffff', 0, 1.32, 0, { seg: 10 }); A.cone(0.16, 0.16, '#e0533c', 0, 1.5, 0, { seg: 12 }); A.sph(0.03, '#2a2a2a', 0, 1.6, 0, { ws: 6, hs: 4 });
      return { light: V3(0, 1.32, 0) };
    case 'denizci_martiheykel':
      A.box(0.7, 0.6, 0.55, '#e2dbd0', 0, 0.3, 0, { r: 0.04 }); A.box(0.76, 0.06, 0.6, '#cfc8be', 0, 0.62, 0, { r: 0.02 });
      A.box(0.5, 0.14, 0.02, '#2b3a55', 0, 0.38, 0.28, { r: 0.008 }); A.label(0.46, 0.11, R.martiPozu, 0, 0.38, 0.292);
      A.push(mtx(0, 0.65, 0, 0, 0.5, 0)); gullInto(A, 1.6); A.pop();
      A.box(0.3, 0.05, 0.3, '#ffd23f', 0.62, 0.025, 0.25, { r: 0.01 }); break;
    case 'lale_cini_pano':
      [-0.55, 0.55].forEach(x => A.box(0.07, 1.4, 0.12, '#7d5638', x, 0.7, 0, { r: 0.02, uv: R.grain })); A.box(1.2, 0.08, 0.14, '#7d5638', 0, 1.4, 0, { r: 0.02 });
      A.box(1.06, 0.98, 0.05, '#f4f8fb', 0, 0.88, 0, { r: 0.01 });
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) A.label(0.5, 0.46, R.ciniPano, -0.26 + i * 0.52, 0.64 + j * 0.48, 0.028); break;
    case 'lale_saksi':
      A.lathe([[0, 0], [0.16, 0], [0.2, 0.05], [0.22, 0.3], [0.25, 0.33], [0, 0.33]], '#2f6fb0', 0, 0, 0, { seg: 14 }); A.cyl(0.225, 0.2, 0.08, '#3fb5b0', 0, 0.2, 0, { seg: 14, open: true });
      ['#e0533c', '#ffd23f', '#f2a2b3', '#ffffff', '#8a6bbf', '#f08a3c'].forEach((c, i) => { const a = i / 6 * TAU, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1, h = 0.5 + (i % 3) * 0.08; A.cyl(0.008, 0.008, h - 0.3, '#5a9e3f', x, 0.3 + (h - 0.3) / 2, z, { seg: 4 }); A.lathe([[0, 0], [0.04, 0.02], [0.045, 0.07], [0.03, 0.1], [0, 0.07]], c, x, h - 0.02, z, { seg: 6 }); A.box(0.03, 0.16, 0.008, '#6aa84f', x * 1.4, 0.4, z * 1.4, { r: 0, ry: a, rz: 0.3 }); }); break;
    case 'lale_semaver':
      A.cyl(0.36, 0.36, 0.04, '#8a5d3b', 0, 0.42, 0, { seg: 8, uv: R.grain }); [0, 1, 2, 3].forEach(k => A.box(0.04, 0.4, 0.04, '#7d5638', Math.cos(k * HP + 0.78) * 0.24, 0.2, Math.sin(k * HP + 0.78) * 0.24, { r: 0.01 }));
      A.box(0.36, 0.02, 0.36, '#ffffff', 0, 0.45, 0, { r: 0, uv: R.cini });
      A.lathe([[0, 0], [0.12, 0], [0.08, 0.06], [0.1, 0.1], [0.19, 0.2], [0.2, 0.36], [0.15, 0.46], [0.08, 0.5], [0.08, 0.58], [0, 0.58]], K.copper, 0, 0.46, 0, { seg: 16 });
      A.tor(0.2, 0.015, '#9a5426', 0, 0.76, 0, { rx: HP, rs: 4, ts: 16 }); A.cyl(0.015, 0.02, 0.12, K.copper, 0.17, 0.62, 0, { rz: HP, seg: 6 });
      A.lathe([[0, 0], [0.07, 0], [0.085, 0.04], [0.07, 0.09], [0, 0.1]], '#fbfaf6', 0, 1.04, 0, { seg: 12 }); A.cyl(0.086, 0.086, 0.02, K.blue, 0, 1.075, 0, { seg: 12, open: true });
      tulipGlass(A, -0.22, 0.46, 0.18, 1, K.teaRed, '#f0e8e0'); tulipGlass(A, -0.1, 0.46, 0.25, 1, K.teaRed, '#f0e8e0'); break;
    case 'lale_minder':
      A.box(1.15, 0.03, 0.8, '#ffffff', 0, 0.015, 0.25, { r: 0, uv: R.kilim });
      A.box(1.1, 0.3, 0.5, '#8a5d3b', 0, 0.15, -0.1, { r: 0.04, uv: R.grain }); A.box(1.12, 0.12, 0.52, '#c23e2c', 0, 0.36, -0.1, { r: 0.05 });
      A.box(1.1, 0.42, 0.14, '#3fb5b0', 0, 0.62, -0.32, { r: 0.06 }); [-0.33, 0.33].forEach(x => A.box(0.32, 0.3, 0.12, '#f2b632', x, 0.6, -0.22, { r: 0.06, rx: -0.15 })); break;
    case 'saksi_sardunya':
      A.lathe([[0, 0], [0.15, 0], [0.2, 0.3], [0.22, 0.32], [0, 0.32]], K.terracotta, 0, 0, 0, { seg: 12 });
      for (let i = 0; i < 6; i++) A.ico(0.12, i % 2 ? '#6f9e4f' : '#5d8f45', Math.cos(i) * 0.1, 0.42 + (i % 2) * 0.06, Math.sin(i) * 0.1, { d: 0 });
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; for (let k = 0; k < 3; k++) A.sph(0.035, k ? '#e0533c' : '#f06a55', Math.cos(a) * 0.13 + (k - 1) * 0.03, 0.56 + (i % 2) * 0.05, Math.sin(a) * 0.13 + (k % 2) * 0.03, { ws: 5, hs: 4 }); } break;
    case 'kedi_evi':
      A.box(0.6, 0.45, 0.5, '#c98a52', 0, 0.225, 0, { r: 0.03, uv: R.grain });
      A.box(0.36, 0.04, 0.6, '#e0533c', -0.16, 0.56, 0, { rz: 0.62, r: 0.015 }); A.box(0.36, 0.04, 0.6, '#e0533c', 0.16, 0.56, 0, { rz: -0.62, r: 0.015 });
      A.box(0.6, 0.18, 0.5, '#c98a52', 0, 0.5, 0, { r: 0.0, sx: 0.98 }); A.cyl(0.13, 0.13, 0.02, '#3a2a20', 0, 0.22, 0.25, { rx: HP, seg: 14 });
      A.cyl(0.09, 0.07, 0.04, '#3fb5b0', 0.42, 0.02, 0.2, { seg: 10 }); A.cyl(0.07, 0.07, 0.01, '#9a6a3a', 0.42, 0.045, 0.2, { seg: 8 }); A.cyl(0.09, 0.07, 0.04, '#f2a2b3', 0.42, 0.02, -0.06, { seg: 10 }); A.cyl(0.07, 0.07, 0.01, '#bfe6e9', 0.42, 0.045, -0.06, { seg: 8 }); break;
    case 'sokak_lambasi':
      A.cyl(0.2, 0.24, 0.3, K.lamp, 0, 0.15, 0, { seg: 8 }); A.cyl(0.06, 0.08, 2.5, K.lamp, 0, 1.4, 0, { seg: 8 }); A.tor(0.08, 0.02, K.gold, 0, 1.0, 0, { rx: HP, rs: 4, ts: 10 });
      A.box(0.6, 0.04, 0.04, K.lamp, 0, 2.55, 0, { r: 0.01 }); [-0.28, 0.28].forEach(x => { A.cone(0.14, 0.12, K.lamp, x, 2.5, 0, { seg: 8 }); BU.sph(0.09, '#ffffff', x, 2.38, 0, { ws: 8, hs: 6 }); }); A.sph(0.05, K.gold, 0, 2.65, 0, { ws: 6, hs: 4 });
      return { light: V3(0, 2.38, 0), pool: true };
    case 'tavla_masasi':
      tableInto(A, 3, true); break;
    default: {
      const x = extraDecorInto(A, BU, id); // Dekor 2.0 catalogue (decor-extra.ts)
      if (x) return x.light ? { light: V3(x.light.x, x.light.y, x.light.z), pool: x.pool } : null;
      A.box(0.5, 0.5, 0.5, '#f2b632', 0, 0.25, 0, { r: 0.08 });
    }
  }
  return null;
}
export function decorBuild(id?: any, paint?: string) {
  const ck = 'decor' + id + (paint ? '~' + paint : '');
  const cached = GEO[ck];
  if (cached) return cached;
  const A = new Batch(), BU = new Batch(), info = decorInto(A, BU, id) || {};
  const geo = A.geometry(), bulbs = BU.empty ? null : BU.geometry();
  // Faz 2 (şekil): the 4th paint part picks a proportion (uzun / geniş / küçük) applied to the built geometry
  const sh = PAINT_SHAPES.find(x => x.id === (paint || '').split('.')[3]);
  if (sh && sh.id !== 'orijinal') { geo.scale(...sh.k); bulbs?.scale(...sh.k); }
  if (paint) applyPaint(geo, paint); // Dekor 2.0 paint layers
  return (GEO[ck] = { geo, bulbs, info, size: DECOR_SIZE[id] || 'm' });
}

/* trophies: cup / plaque / star statue, bronze silver gold */
export function trophyInto(A?: any, id?: any, idx?: any) {
  const s = String(id || ''), h = Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const metal = /altin|gold/.test(s) ? K.gold : /gumus|silver/.test(s) ? '#cfd6dc' : /bronz/.test(s) ? '#c9824a' : [K.gold, '#cfd6dc', '#c9824a'][(idx + h) % 3];
  const kind = h % 3;
  A.box(0.16, 0.05, 0.12, '#3a2f2a', 0, 0.025, 0, { r: 0.01 });
  if (kind === 0) { A.cyl(0.03, 0.05, 0.05, metal, 0, 0.075, 0, { seg: 10 }); A.cyl(0.015, 0.015, 0.06, metal, 0, 0.13, 0, { seg: 6 }); A.lathe([[0, 0], [0.03, 0], [0.07, 0.06], [0.075, 0.12], [0, 0.11]], metal, 0, 0.16, 0, { seg: 12 }); [-1, 1].forEach(sg => A.tor(0.035, 0.008, metal, sg * 0.075, 0.24, 0, { ry: 0, rs: 4, ts: 8, arc: PI, rz: sg * HP })); }
  else if (kind === 1) { A.box(0.14, 0.2, 0.025, '#7d5638', 0, 0.15, 0, { r: 0.01, rx: -0.15 }); A.box(0.1, 0.14, 0.01, metal, 0, 0.15, 0.016, { r: 0.004, rx: -0.15 }); }
  else { A.cyl(0.015, 0.02, 0.1, metal, 0, 0.1, 0, { seg: 6 }); A.cyl(0.08, 0.08, 0.02, metal, 0, 0.22, 0, { rx: HP, seg: 5 }); }
}

export const MARKERS = new Set();
export function makeMarker(kind?: any, o: any = {}) {
  if (kind === 'arrow') {
    const b = new Batch();
    b.cone(0.32, 0.5, K.yellow, 0, 0.25, 0, { rx: PI, seg: 4, ry: PI / 4 }); b.box(0.24, 0.5, 0.24, K.yellow, 0, 0.72, 0, { r: 0.05 });
    const m = new T.Mesh(b.geometry(), new T.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, map: atlasTex }));
    const g = new T.Group(); g.add(m); g.userData = { kind, inner: m, t: Math.random() * 6 }; g.name = 'marker-arrow';
    MARKERS.add(g); return g;
  }
  if (kind === 'pad') {
    const g = new T.Group(); g.name = 'marker-pad';
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
    const base = new T.Mesh(geoc('padPlane', () => new T.PlaneGeometry(1.6, 1.6)), new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }));
    base.rotation.x = -HP; base.position.y = 0.035; base.renderOrder = 2; g.add(base);
    const fg = geoc('padFill', () => { const p = new T.PlaneGeometry(1.42, 1.42); p.translate(0.71, 0, 0); return p; });
    const fill = new T.Mesh(fg, new T.MeshBasicMaterial({ color: K.yellow, transparent: true, opacity: 0.45, depthWrite: false }));
    fill.rotation.x = -HP; fill.position.set(-0.71, 0.04, 0); fill.scale.x = 0.001; fill.renderOrder = 3; g.add(fill);
    const draw = (label?: any, sub?: any, price?: any) => {
      const c = cv.getContext('2d')!, w = 256, h = 256; c.clearRect(0, 0, w, h);
      c.fillStyle = 'rgba(25,18,12,.66)'; rrect(c, 8, 8, w - 16, h - 16, 28); c.fill();
      c.setLineDash([22, 14]); c.lineWidth = 9; c.strokeStyle = K.yellow; rrect(c, 10, 10, w - 20, h - 20, 28); c.stroke(); c.setLineDash([]);
      txt(c, label || '', w / 2, 70, 32, '#fff6e6', { w: 900, max: w - 36 });
      if (sub) txt(c, sub, w / 2, 110, 22, '#d9c8a8', { w: 700, max: w - 40 });
      if (price != null && price !== '') txt(c, typeof price === 'number' ? fmtMoney(price) : String(price), w / 2, 180, 52, K.yellow, { w: 900, max: w - 30 });
      tx.needsUpdate = true;
    };
    draw(o.label, o.sub, o.price);
    const setText = (a?: any, b?: any, c?: any) => (a && typeof a === 'object') ? draw(a.label, a.sub, a.price) : draw(a, b, c);
    g.userData = { kind, base, fill, setFill: (k: any) => { fill.scale.x = Math.max(0.001, clamp(+k || 0, 0, 1)); }, setText };
    return g;
  }
  // ring
  const m = new T.Mesh(geoc('ring' + (o.r || 0.7), () => new T.RingGeometry((o.r || 0.7) - 0.12, o.r || 0.7, 40)), new T.MeshBasicMaterial({ color: o.color || K.yellow, transparent: true, opacity: 0.85, depthWrite: false }));
  m.rotation.x = -HP; m.position.y = 0.035; m.renderOrder = 2;
  const g = new T.Group(); g.add(m); g.userData = { kind: 'ring', inner: m, t: Math.random() * 6 }; g.name = 'marker-ring';
  MARKERS.add(g); return g;
}

/* stage-1 extras: crate counter with the cash tin, the ferry-window stall, a stool */
export function ferryGeos() {
  return geocAny('ferry', () => {
    const A = new Batch(), BU = new Batch();
    A.box(4.3, 1.7, 15, '#2b3a55', 0, 0.15, 0, { r: 0.7, s: 3 });
    A.box(4.36, 0.16, 14.4, K.red, 0, 0.02, 0, { r: 0.08 });
    A.box(4.4, 0.14, 14.6, '#fbfaf6', 0, 0.98, 0, { r: 0.07 });
    [-1, 1].forEach(sg => { A.label(2.6, 0.48, R.ferryName, sg * 2.17, 0.55, sg * 4.2, { ry: sg * HP }); });
    A.box(3.9, 1.3, 11.6, '#fbfaf6', 0, 1.7, 0, { r: 0.12 });
    [-1, 1].forEach(sg => { [-2.9, 2.9].forEach(z => A.label(5.6, 0.5, R.ferryWin, sg * 1.955, 1.78, z, { ry: sg * HP })); [-1, 1].forEach(e => BU.plane(5.2, 0.3, '#ffe6a0', sg * 1.96, 1.8, e * 2.9, { ry: sg * HP })); });
    [-1, 1].forEach(e => A.box(3.9, 1.3, 0.05, '#fbfaf6', 0, 1.7, e * 5.82, { r: 0 }));
    A.box(4.2, 0.1, 13.4, '#e8e2d8', 0, 2.38, 0, { r: 0.04 });
    for (let z = -6.4; z <= 6.4; z += 0.8) [-2.05, 2.05].forEach(x => A.box(0.04, 0.5, 0.04, '#fbfaf6', x, 2.65, z, { r: 0 }));
    [-2.05, 2.05].forEach(x => A.box(0.06, 0.05, 13, '#fbfaf6', x, 2.9, 0, { r: 0.015 }));
    A.box(3.3, 0.9, 7.4, '#fbfaf6', 0, 2.88, 0, { r: 0.1 });
    [-1, 1].forEach(sg => { A.label(6.6, 0.4, R.ferryWin, sg * 1.655, 2.92, 0, { ry: sg * HP }); BU.plane(6.2, 0.25, '#ffe6a0', sg * 1.66, 2.93, 0, { ry: sg * HP }); });
    A.box(3.5, 0.08, 8.0, '#d8433a', 0, 3.37, 0, { r: 0.03 });
    [-1, 1].forEach(e => { A.box(2.2, 0.9, 1.5, '#fbfaf6', 0, 3.85, e * 3.4, { r: 0.1 }); A.box(2.24, 0.32, 1.54, '#35507a', 0, 3.98, e * 3.4, { r: 0.04 }); A.box(2.4, 0.08, 1.7, '#e8e2d8', 0, 4.33, e * 3.4, { r: 0.03 }); });
    A.cyl(0.48, 0.52, 1.7, '#f2b632', 0, 4.2, 0, { seg: 16 }); A.cyl(0.49, 0.49, 0.32, '#2b3a55', 0, 4.95, 0, { seg: 16 }); A.cyl(0.4, 0.4, 0.06, '#1a1a1a', 0, 5.12, 0, { seg: 12 });
    [-1, 1].forEach(sg => A.label(0.55, 0.55, R.emblem, sg * 0.5, 4.3, 0, { ry: sg * HP }));
    A.cyl(0.03, 0.03, 1.4, '#fbfaf6', 0, 5.0, 3.4, { seg: 5 }); A.box(0.02, 0.22, 0.5, K.red, 0, 5.55, 3.65, { r: 0 });
    [-1, 1].forEach(sg => { A.cap(0.28, 1.4, '#f08a3c', sg * 1.3, 3.55, -1.6, { rx: HP }); A.tor(0.22, 0.06, '#f08a3c', sg * 1.96, 1.7, 5.2, { ry: HP, rs: 5, ts: 14 }); });
    return { body: A.geometry(), glow: BU.geometry() };
  });
}
export function makeFerryMesh(scale?: any) {
  const g = ferryGeos(), grp = new T.Group();
  const body = new T.Mesh(g.body, MAT.atlas); body.castShadow = true; body.receiveShadow = true;
  const glow = new T.Mesh(g.glow, MAT.bulb);
  grp.add(body, glow); grp.scale.setScalar(scale || 1);
  return grp;
}
export const bez = (a?: any, b?: any, c?: any, d?: any, t?: any, out?: any) => { const u = 1 - t; out.x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x; out.z = u * u * u * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t * t * t * d.z; return out; };
const stationCache: Record<string, any> = {};
export function stationBuilt(kind?: any, tier?: any, stage?: any) {
  const k = kind + tier + (stage === 1 ? 'o' : 'i');
  if (stationCache[k]) return stationCache[k];
  const S = stationModel(kind, tier, stage);
  return (stationCache[k] = { a: S.A.geometry(), tl: S.TL.empty ? null : S.TL.geometry(), w: S.w, d: S.d, out: S.out.clone(), meat: S.meat, steam: S.steam.map((v: any) => v.clone()), spin: S.spin });
}
const tableCache: Record<string, any> = {};
export function tableBuilt(style?: any, tavla?: any) { const k = style + (tavla ? 't' : ''); if (tableCache[k]) return tableCache[k]; const b = new Batch(); const top = tableInto(b, style, tavla); return (tableCache[k] = { geo: b.geometry(), top }); }
