/**
 * İskele kiosk: stage 1 closed rusty shell, stage 2 büfe, stage 3 tea garden, 4/5 placeholders; sign canvas (6 fonts, worn/neon); job board.
 * Ported 1:1 from v2 world.js (read-only reference); geometry, colours and proportions are kept exactly (parity is measured).
 * Port note: parameters are typed loosely (`any`) where v2 passed option bags; behaviour is unchanged.
 */
import * as T from 'three';
import { Batch, mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox } from '../../../engine/prefab/batch';
import { K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex } from '../common/v2kit';
import { WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, local2world as l2w, rectAABB, type Obstacle } from './layout';
const V3 = (x = 0, y = 0, z = 0): T.Vector3 => new T.Vector3(x, y, z);
void [mtx, geoc, col, mixc, shade, clamp, lerp, easeInOut, PI, TAU, HP, roundBox, K, R, MAT, rnd, v2rng, rrect, fitText, txt, canvasTex, atlasTex, radialTex, WATER_Y, SEAT_H, PIER, BUFE, GANG, WIN_Z, NEXT_SIGN, BENCHES, l2w, rectAABB, V3];
export type { Obstacle };
import { crate } from './props';

export function lattice(A?: any, x0?: any, z0?: any, x1?: any, z1?: any, h?: any, colr?: any) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0), np = Math.max(1, Math.round(len / 1.6)), pw = len / np;
  A.push(mtx(x0, 0, z0, 0, ang - HP, 0));
  for (let p = 0; p < np; p++) {
    const ox = p * pw;
    A.box(0.09, h + 0.12, 0.09, '#8a5d3b', ox, (h + 0.12) / 2, 0, { r: 0.02 });
    A.box(pw, 0.07, 0.08, '#8a5d3b', ox + pw / 2, h, 0, { r: 0.02 }); A.box(pw, 0.07, 0.08, '#8a5d3b', ox + pw / 2, 0.12, 0, { r: 0.02 });
    const H = h - 0.2, step = 0.3;
    [1, -1].forEach(sg => {
      for (let c = -H; c < pw; c += step) {
        // slat along u -> (u, sg*(u - c)) clipped to the panel [0,pw] x [0,H]
        let u0 = Math.max(0, c), u1 = Math.min(pw, c + H);
        if (u1 - u0 < 0.05) continue;
        const ya = u0 - c, yb = u1 - c, xa = ox + u0, xb = ox + u1;
        const ys = sg > 0 ? [ya, yb] : [H - ya, H - yb];
        const l = Math.hypot(xb - xa, ys[1] - ys[0]);
        A.box(l, 0.035, 0.03, colr, (xa + xb) / 2, 0.16 + (ys[0] + ys[1]) / 2, sg * 0.018, { rz: Math.atan2(ys[1] - ys[0], xb - xa), r: 0 });
      }
    });
  }
  A.box(0.09, h + 0.12, 0.09, '#8a5d3b', len, (h + 0.12) / 2, 0, { r: 0.02 });
  A.pop();
}
/** Büfe giriş kapısı (stage 2+): the gap between the west stub and the counter's west end. Walls facing it are not padded. */
export const DOOR = { x0: -3.9, x1: -2.1 };

export function buildKiosk(stage?: any, rn?: any) {
  const A = new Batch(), RF = new Batch(), TL = new Batch(), FL = new Batch(), BU = new Batch(), GL = new Batch(), ST = new Batch();
  const K2: any = { obstacles: [], sign: null, flo: null, shutter: null, bunting: null, lamps: [] };
  const ob = (x0?: any, x1?: any, z0?: any, z1?: any, tag?: any) => K2.obstacles.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), tag: tag || 'kiosk' });
  const worn = (p: any) => !rn[p];
  const s1 = stage === 1, gold = stage >= 5;
  const paintC = worn('boya') ? (s1 ? '#a9bba8' : '#e2d6bf') : '#f6ecd6';
  const paintO = {};   // 2026-10-24: unpainted walls no longer show peeling stains ("dükkanın içi kirli")
  const trim = gold ? K.gold : worn('boya') ? (s1 ? '#7f8f84' : '#b9ad98') : K.red;
  const wall = (x0?: any, x1?: any, y0?: any, y1?: any, z0?: any, z1?: any) => {
    const lx = Math.abs(x1 - x0), lz = Math.abs(z1 - z0), along = lx > lz, L = Math.max(lx, lz), n = Math.max(1, Math.round(L / 1.7));
    for (let i = 0; i < n; i++) {
      const a = i / n, c = (i + 1) / n;
      if (along) A.span(lerp(x0, x1, a), lerp(x0, x1, c), y0, y1, z0, z1, paintC, Object.assign({ r: 0.012 }, paintO));
      else A.span(x0, x1, y0, y1, lerp(z0, z1, a), lerp(z0, z1, c), paintC, Object.assign({ r: 0.012 }, paintO));
    }
  };
  const tiles = (x0?: any, x1?: any, y0?: any, y1?: any, z0?: any, z1?: any) => TL.span(x0, x1, y0, y1, z0, z1, '#ffffff', { r: 0, world: 0.4 });
  const capRail = (x0?: any, x1?: any, y?: any, z0?: any, z1?: any) => A.span(x0 - 0.02, x1 + 0.02, y, y + 0.07, z0 - 0.03, z1 + 0.03, trim, { r: 0.02 });
  const signPose = (x?: any, y?: any, z?: any, w?: any, h?: any, ry = 0) => { K2.sign = { x, y, z, w, h, ry }; };

  if (s1) {
    /* ---- stage 1: closed rusty büfe shell ---- */
    const H = 2.7;
    wall(BUFE.x0, BUFE.x1, 0, H, BUFE.z0, BUFE.z0 + 0.2);
    wall(BUFE.x0, BUFE.x0 + 0.2, 0, H, BUFE.z0, BUFE.z1);
    wall(BUFE.x1 - 0.2, BUFE.x1, 0, H, BUFE.z0, -7.9); wall(BUFE.x1 - 0.2, BUFE.x1, 0, H, -6.3, BUFE.z1);
    wall(BUFE.x1 - 0.2, BUFE.x1, 0, 1.0, -7.9, -6.3); wall(BUFE.x1 - 0.2, BUFE.x1, 2.2, H, -7.9, -6.3);
    wall(BUFE.x0, -3.6, 0, H, BUFE.z1 - 0.2, BUFE.z1); wall(3.6, BUFE.x1, 0, H, BUFE.z1 - 0.2, BUFE.z1);
    wall(-3.6, 3.6, 2.25, H, BUFE.z1 - 0.2, BUFE.z1);
    tiles(BUFE.x0, -3.6, 0, 1.0, BUFE.z1, BUFE.z1 + 0.02); tiles(3.6, BUFE.x1, 0, 1.0, BUFE.z1, BUFE.z1 + 0.02);
    tiles(BUFE.x1, BUFE.x1 + 0.02, 0, 1.0, BUFE.z0, BUFE.z1);
    // roof with a lip
    // Faz 2 (büfe içi gizleme): the roof is one solid top from above; the loose planks that let the interior show through are gone
    { const rx0 = BUFE.x0 - 0.15, rz0 = BUFE.z0 - 0.15, rz1 = BUFE.z1 + 0.15, np = 0, pw = (BUFE.x1 - BUFE.x0 + 0.3) / np, wr = worn('boya');
      RF.span(rx0, BUFE.x1 + 0.15, H, H + 0.14, rz0, rz1, wr ? '#7d6a5c' : '#c9c2b6', { r: 0.02 });
      for (let i = 0; i < np; i++) RF.box(rz1 - rz0, 0.05, pw - 0.025, wr ? ['#d8c7b6', '#cdb8a6', '#e0d2c4'][i % 3] : ['#dfe6ea', '#d3dbe0'][i % 2], rx0 + pw * (i + 0.5), H + 0.115, (rz0 + rz1) / 2, { ry: HP, r: 0.008, uv: wr ? R.kepenkWorn : R.kepenkNew });
      // an old satellite dish and a rolled tarp on the roof
      RF.cyl(0.32, 0.32, 0.04, '#d8d8d0', 1.6, H + 0.75, -9.6, { rx: 0.9, seg: 14 }); RF.cyl(0.025, 0.025, 0.6, '#8c969e', 1.6, H + 0.42, -9.75, { seg: 5 });
      RF.cap(0.16, 1.4, wr ? '#6f8a5c' : '#5f8fb0', -1.4, H + 0.3, -6.6, { rz: HP }); }
    RF.span(BUFE.x0 - 0.17, BUFE.x1 + 0.17, H + 0.14, H + 0.21, BUFE.z1 + 0.07, BUFE.z1 + 0.18, trim, { r: 0.02 });
    // a vent and an old antenna on the roof
    RF.box(0.6, 0.35, 0.6, '#9aa0a4', -2.6, H + 0.32, -8.6, { uv: R.rust }); RF.cyl(0.02, 0.02, 1.2, '#666', 2.9, H + 0.75, -9.4, { seg: 4 }); RF.box(0.9, 0.03, 0.03, '#666', 2.9, H + 1.2, -9.4, { r: 0 });
    // survey 2026-10-24 (çatı kesiti): the roof is its own mesh ('kioskRoof') and fades out when the player is near,
    // so the dusty empty shell inside shows: old floor, crates, a broken fridge and a cobwebbed shelf
    FL.span(BUFE.x0 + 0.2, BUFE.x1 - 0.2, 0.0, 0.018, BUFE.z0 + 0.2, BUFE.z1 - 0.2, '#ffffff', { r: 0, world: 1.0 });
    tiles(BUFE.x0 + 0.2, BUFE.x1 - 0.2, 0, 1.0, BUFE.z0 + 0.2, BUFE.z0 + 0.22);
    A.box(0.7, 0.55, 0.6, '#a07a52', -3.2, 0.28, -9.6, { r: 0.02, uv: R.grain }); A.box(0.6, 0.45, 0.55, '#b38a5e', -3.1, 0.78, -9.55, { r: 0.02, ry: 0.3, uv: R.grain });
    A.box(0.7, 0.5, 0.6, '#9a744e', -2.2, 0.25, -9.7, { r: 0.02, ry: -0.2, uv: R.grain });
    A.box(1.0, 1.8, 0.75, '#cfd3d0', 3.3, 0.9, -9.8, { r: 0.05, uv: R.rust }); A.box(0.06, 0.6, 0.06, '#8c969e', 2.85, 1.1, -9.42, { r: 0.02 });
    A.box(2.2, 0.06, 0.4, '#8a6a4a', 0.3, 1.5, -10.15, { r: 0.01, uv: R.grain }); A.box(2.2, 0.06, 0.4, '#8a6a4a', 0.3, 0.9, -10.15, { r: 0.01, uv: R.grain });
    A.cyl(0.12, 0.12, 0.3, '#c8b89a', -0.4, 1.68, -10.15, { seg: 8 }); A.cyl(0.1, 0.1, 0.22, '#9fb4a4', 0.5, 1.64, -10.15, { seg: 8 });
    A.box(1.4, 0.1, 0.9, '#6f5a48', 0.6, 0.05, -7.4, { r: 0.02, ry: 0.4 }); A.cyl(0.25, 0.3, 0.5, '#7c8a90', -1.0, 0.25, -6.0, { seg: 10, uv: R.rust });
    A.box(0.03, 1.1, 0.9, '#e8e4dc', BUFE.x0 + 0.24, 1.9, -10.0, { r: 0, ry: 0.5 });
    // front kepenk (closed) with box, bottom bar and padlock
    const kp = worn('kepenk') ? R.kepenkWorn : R.kepenkNew, kc = worn('kepenk') ? '#ffffff' : K.red;
    // 2026-10-24 user: "dükkanın içi kirli duruyor": parts waiting for repair look old (dull colours) but no longer rust-stained
    A.span(-3.65, 3.65, 2.22, 2.52, BUFE.z1 - 0.05, BUFE.z1 + 0.28, worn('kepenk') ? '#8d7466' : shade(K.red, -0.1), { r: 0.04, uv: undefined });
    for (let i = 0; i < 4; i++) A.span(-3.6 + i * 1.8, -3.6 + (i + 1) * 1.8, 0.04, 2.22, BUFE.z1 + 0.02, BUFE.z1 + 0.08, kc, { r: 0, uv: kp });
    A.span(-3.6, 3.6, 0.0, 0.1, BUFE.z1 + 0.04, BUFE.z1 + 0.12, worn('kepenk') ? '#5e4a3e' : '#9c2f22', { r: 0.02, rz: worn('kepenk') ? 0.004 : 0 });
    A.box(0.12, 0.14, 0.06, '#c9a24a', 0, 0.2, BUFE.z1 + 0.13, { r: 0.02 }); A.tor(0.04, 0.012, '#9aa0a4', 0, 0.3, BUFE.z1 + 0.13, { rs: 4, ts: 10, arc: PI });
    // east window kepenk (closed)
    A.span(BUFE.x1 + 0.0, BUFE.x1 + 0.06, 1.0, 2.2, -7.9, -6.3, kc, { r: 0, uv: kp });
    A.span(BUFE.x1, BUFE.x1 + 0.3, 2.2, 2.42, -7.95, -6.25, worn('kepenk') ? '#8d7466' : shade(K.red, -0.1), { r: 0.03 });
    // sign frame on the roof front
    [-2.9, 2.9].forEach(x => RF.box(0.1, 0.4, 0.1, '#5a5a5a', x, H + 0.3, BUFE.z1 - 0.12, { r: 0.02 }));
    signPose(0, H + 0.95, BUFE.z1 - 0.1, 7.0, 1.0, 0);
    RF.span(-3.6, 3.6, H + 0.4, H + 1.5, BUFE.z1 - 0.22, BUFE.z1 - 0.14, worn('tabela') ? '#6c5a4c' : '#1d3d6b', { r: 0.03 });
    K2.flo = { x: 0.2, y: 2.12, z: BUFE.z1 + 1.12, len: 1.2, hang: 0.12 };
    K2.pool = { x: 0.2, z: -2.6, r: 4.2 };
    K2.lamps.push({ x: -2.6, y: 2.0, z: -2.9, s: 0, r: 2.6 }, { x: 2.8, y: 2.0, z: -2.9, s: 0, r: 2.6 });
    // a cat basket and a stool by the shell (cat spots)
    A.cyl(0.32, 0.26, 0.2, '#c9a05a', -4.85, 0.1, -5.0, { seg: 12, uv: R.hasir }); A.cyl(0.28, 0.28, 0.03, '#e8a0a0', -4.85, 0.18, -5.0, { seg: 12 });
    // old posters on the west wall (invented)
    A.label(0.5, 0.72, R.afis2, BUFE.x0 - 0.01, 1.6, -6.4, { ry: -HP });
    ob(BUFE.x0, BUFE.x1, BUFE.z0, BUFE.z1 + 0.15, 'kiosk');
    stage1Front(A, BU, K2, worn);
  } else {
    /* ---- stage 2+: open-top büfe (cutaway walls), kitchen inside ---- */
    const H = 2.6, LOW = 1.1;
    FL.span(-4.0, 4.0, 0.0, 0.018, -10.4, -4.6, '#ffffff', { r: 0, world: 1.0 });
    // back wall: painted outside, tiled inside
    wall(BUFE.x0, BUFE.x1, 0, H, BUFE.z0, BUFE.z0 + 0.2); tiles(-4.0, 4.0, 0, 1.75, BUFE.z0 + 0.2, BUFE.z0 + 0.22);
    capRail(BUFE.x0, BUFE.x1, H, BUFE.z0, BUFE.z0 + 0.2);
    ob(BUFE.x0, BUFE.x1, BUFE.z0, BUFE.z0 + 0.22);
    // side walls: tall at the back, low after
    [[BUFE.x0, BUFE.x0 + 0.2, -1], [BUFE.x1 - 0.2, BUFE.x1, 1]].forEach(([a, c, sg]) => {
      wall(a, c, 0, H, BUFE.z0, -9.0); capRail(a, c, H, BUFE.z0, -9.0);
      const inner = sg < 0 ? c : a - 0.02, innerB = sg < 0 ? c + 0.02 : a;
      tiles(inner, innerB, 0, 1.0, -10.4, -4.6);
      if (sg < 0) { wall(a, c, 0, LOW, -9.0, BUFE.z1); capRail(a, c, LOW, -9.0, BUFE.z1); tiles(a - 0.02, a, 0, LOW, -9.0, BUFE.z1); ob(a, c, BUFE.z0, BUFE.z1); }
      else {
        wall(a, c, 0, LOW, -9.0, -8.3); wall(a, c, 0, LOW, -5.9, BUFE.z1); capRail(a, c, LOW, -9.0, -8.3); capRail(a, c, LOW, -5.9, BUFE.z1);
        tiles(c, c + 0.02, 0, LOW, -9.0, -8.3); tiles(c, c + 0.02, 0, LOW, -5.9, BUFE.z1);
        // ferry window block: jambs, sill, lintel, kepenk box
        wall(a, c, 0, 2.35, -8.3, -7.9); wall(a, c, 0, 2.35, -6.3, -5.9); wall(a, c, 0, 1.05, -7.9, -6.3); wall(a, c, 2.15, 2.35, -7.9, -6.3);
        tiles(c, c + 0.02, 0, 1.05, -8.3, -5.9);
        A.span(a - 0.1, c + 0.3, 1.05, 1.12, -7.95, -6.25, worn('tezgah') ? '#9c9a92' : '#dfe6ea', { r: 0.02, uv: worn('tezgah') ? undefined : R.marble });
        A.span(c, c + 0.32, 2.17, 2.42, -7.98, -6.22, worn('kepenk') ? '#8d7466' : shade(K.red, -0.1), { r: 0.04, uv: undefined });
        capRail(a, c + 0.32, 2.42, -8.3, -5.9);
        K2.shutter = { kind: 'wall', x: c + 0.04, y0: 1.12, y1: 2.15, z0: -7.9, z1: -6.3 };
        ob(a, c, BUFE.z0, BUFE.z1, 'kiosk');
        A.label(0.7, 0.18, R.fridgeBogaz, c + 0.33, 2.3, -7.1, { ry: HP });
      }
    });
    // front: west stub, door frame, counter, east low wall with the register
    wall(BUFE.x0, -3.9, 0, LOW, BUFE.z1 - 0.2, BUFE.z1); tiles(BUFE.x0, -3.9, 0, LOW, BUFE.z1, BUFE.z1 + 0.02); capRail(BUFE.x0, -3.9, LOW, BUFE.z1 - 0.2, BUFE.z1);
    ob(BUFE.x0, DOOR.x0, BUFE.z1 - 0.25, BUFE.z1 + 0.05);
    [-3.95, -2.68].forEach(x => A.box(0.1, 2.3, 0.14, trim, x, 1.15, BUFE.z1 - 0.1, { r: 0.02 })); A.box(1.37, 0.12, 0.16, trim, -3.32, 2.3, BUFE.z1 - 0.1, { r: 0.02 });
    wall(2.2, BUFE.x1, 0, LOW, BUFE.z1 - 0.2, BUFE.z1); tiles(2.2, BUFE.x1, 0, LOW, BUFE.z1, BUFE.z1 + 0.02); capRail(2.2, BUFE.x1, LOW, BUFE.z1 - 0.2, BUFE.z1);
    ob(2.2, BUFE.x1, BUFE.z1 - 0.25, BUFE.z1 + 0.05);
    // counter (tezgah). 2026-10-26 owner: "tezgahı tamamen yenile, gelişen büfede bir şeye benzesin". Same footprint
    // and top height (items stack on counter.drop y 1.06), so the collider and the drop zone are unchanged.
    const Z1 = BUFE.z1;
    // Before the tezgah renovation: oak and a brushed steel top. After: walnut, marble and brass.
    const nu = !worn('tezgah');
    const wood = nu ? '#5b3720' : '#7a5232', frame = nu ? '#3f2614' : '#553821', ctrim = nu ? '#c9a227' : '#9aa0a4';
    // cabinet, kick plate, frame
    // solid on the left; on the right only the back wall, floor and ceiling so the vitrin is hollow behind its glass
    A.span(-2.1, 0.62, 0.1, 0.92, -5.0, Z1 - 0.05, wood, { r: 0.02, uv: R.grain });
    A.span(0.62, 2.2, 0.1, 0.92, -5.0, -4.9, wood, { r: 0.01, uv: R.grain });
    A.span(0.62, 2.2, 0.1, 0.17, -4.9, Z1 - 0.05, '#d8d2c6', { r: 0 }); A.span(0.62, 2.2, 0.83, 0.92, -4.9, Z1 - 0.05, wood, { r: 0 });
    A.span(-2.1, 2.2, 0, 0.1, -4.98, Z1 - 0.07, '#8c969e', { r: 0.01 });
    A.span(-2.1, 2.2, 0.84, 0.92, Z1 - 0.06, Z1 - 0.02, frame, { r: 0.01 });
    A.span(-2.1, 2.2, 0.1, 0.16, Z1 - 0.06, Z1 - 0.02, frame, { r: 0.01 });
    for (const x of [-2.06, 0.62, 2.16]) A.span(x - 0.045, x + 0.045, 0.1, 0.92, Z1 - 0.06, Z1 - 0.02, frame, { r: 0.01 });
    // left: Iznik tile panel
    tiles(-2.0, 0.56, 0.17, 0.83, Z1 - 0.03, Z1 - 0.01);
    // right: lit glass vitrin with the day's goods on two shelves
    A.span(0.68, 2.1, 0.17, 0.83, -4.9, -4.88, '#f6efe0', { r: 0 });
    A.span(0.68, 2.1, 0.47, 0.49, -4.9, Z1 - 0.06, '#d8d2c6', { r: 0 });
    BU.span(0.7, 2.08, 0.8, 0.82, -4.8, -4.7, '#fff3c9', { r: 0 });
    for (let k = 0; k < 4; k++) A.tor(0.085, 0.028, '#c8833c', 0.86 + k * 0.2, 0.53, -4.62, { rs: 6, ts: 14, rx: PI / 2 });                              // simit
    for (let k = 0; k < 3; k++) A.cyl(0.045, 0.04, 0.12, '#fbfdff', 1.7 + k * 0.13, 0.55, -4.62, { seg: 10 });                                                // ayran
    for (let k = 0; k < 4; k++) { A.cyl(0.035, 0.035, 0.2, '#5aa9d6', 0.82 + k * 0.12, 0.27, -4.62, { seg: 8 }); A.cyl(0.012, 0.02, 0.05, '#5aa9d6', 0.82 + k * 0.12, 0.395, -4.62, { seg: 6 }); }   // gazoz
    for (let k = 0; k < 3; k++) A.box(0.2, 0.05, 0.14, '#e8c27a', 1.45 + k * 0.22, 0.2 + (k % 2) * 0.05, -4.62, { r: 0.015 });                               // tost
    GL.span(0.68, 2.1, 0.17, 0.83, Z1 - 0.05, Z1 - 0.03, '#ffffff', { r: 0 });
    // foot rail on the customer side
    A.span(-2.0, 2.1, 0.22, 0.25, Z1 + 0.1, Z1 + 0.13, ctrim, { r: 0.012 });
    for (const x of [-1.9, 0.05, 2.0]) A.span(x - 0.015, x + 0.015, 0.1, 0.24, Z1 - 0.02, Z1 + 0.12, ctrim, { r: 0.005 });
    // top with a nosing; glass sneeze guard over the vitrin
    A.span(-2.16, 2.26, 0.92, 1.06, -5.06, Z1 + 0.06, nu ? '#f2efe8' : '#c4c8cb', nu ? { r: 0.025, uv: R.marble } : { r: 0.02 });
    A.span(-2.16, 2.26, 1.0, 1.06, Z1 + 0.05, Z1 + 0.09, ctrim, { r: 0.012 });
    // glass display case on the top (the camera looks down, so the goods show through its lid)
    const c0 = 0.7, c1 = 2.12, cz0 = -4.98, cz1 = Z1 - 0.02, ch = 1.36;
    A.span(c0, c1, 1.06, 1.08, cz0, cz1, '#f6efe0', { r: 0 });
    for (let k = 0; k < 3; k++) A.tor(0.085, 0.028, '#c8833c', 0.86 + k * 0.2, 1.11, -4.88 + (k % 2) * 0.2, { rs: 6, ts: 14, rx: PI / 2 });          // simit
    for (let k = 0; k < 2; k++) A.box(0.2, 0.05, 0.14, '#e8c27a', 1.5 + k * 0.24, 1.11, -4.62, { r: 0.015 });                                          // tost
    for (let k = 0; k < 3; k++) A.cyl(0.05, 0.045, 0.12, '#fbfdff', 1.48 + k * 0.14, 1.14, -4.88, { seg: 10 });                                          // ayran
    A.box(0.3, 0.06, 0.2, '#f1dcae', 1.0, 1.11, -4.6, { r: 0.02 }); A.box(0.26, 0.04, 0.16, '#b5763d', 1.0, 1.15, -4.6, { r: 0.02 });                // dürüm tray
    GL.span(c0, c1, ch, ch + 0.015, cz0, cz1, '#ffffff', { r: 0 });
    GL.span(c0, c1, 1.08, ch, cz1 - 0.015, cz1, '#ffffff', { r: 0 });
    for (const x of [c0, c1]) GL.span(x - 0.008, x + 0.008, 1.08, ch, cz0, cz1, '#ffffff', { r: 0 });
    for (const x of [c0, c1]) for (const z of [cz0, cz1]) A.span(x - 0.015, x + 0.015, 1.06, ch + 0.02, z - 0.015, z + 0.015, ctrim, { r: 0.004 });
    A.span(c0, c1, ch, ch + 0.02, cz1 - 0.015, cz1 + 0.015, ctrim, { r: 0.004 }); A.span(c0, c1, ch, ch + 0.02, cz0 - 0.015, cz0 + 0.015, ctrim, { r: 0.004 });
    BU.span(c0 + 0.05, c1 - 0.05, ch - 0.02, ch - 0.005, cz0 + 0.04, cz0 + 0.08, '#fff3c9', { r: 0 });
    // çay tray with tulip glasses on the left
    A.cyl(0.2, 0.2, 0.015, '#b8bcc0', -1.1, 1.07, Z1 - 0.22, { seg: 20 });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; A.cyl(0.035, 0.028, 0.09, '#a3301a', -1.1 + Math.cos(a) * 0.1, 1.12, Z1 - 0.22 + Math.sin(a) * 0.1, { seg: 10 }); }
    // on the top, clear of the drop spot (x -0.25): napkin holder and sugar bowl on the left, menu stand by the vitrin
    A.box(0.16, 0.12, 0.08, '#d9dde0', -1.85, 1.12, Z1 - 0.12, { r: 0.01 }); A.box(0.12, 0.1, 0.04, '#ffffff', -1.85, 1.15, Z1 - 0.12, { r: 0.005 });
    A.cyl(0.07, 0.055, 0.08, '#e9e4da', -1.55, 1.1, Z1 - 0.15, { seg: 12 }); A.cyl(0.075, 0.075, 0.015, '#c9a227', -1.55, 1.145, Z1 - 0.15, { seg: 12 });
    A.box(0.32, 0.22, 0.02, frame, 0.45, 1.18, Z1 - 0.1, { rx: -0.25, r: 0.01 }); A.label(0.28, 0.18, R.menuTiny, 0.45, 1.18, Z1 - 0.088, { rx: -0.25 });
    // 12 cm deeper than the top on Sabri's side: leaning on it, the carried stack (0.36 m ahead at 1.0 m) stayed inside
    // the 1.06 m top and the tray looked like a ghost (2026-10-26). counter.standAt (-5.45) stays inside the drop zone.
    ob(DOOR.x1, 2.24, -5.18, BUFE.z1 + 0.06);
    // register on the east low wall
    A.box(0.62, 0.3, 0.46, gold ? K.gold : '#2f3b46', 3.2, LOW + 0.15, -4.55, { r: 0.05 }); A.box(0.46, 0.1, 0.3, '#3c4a56', 3.2, LOW + 0.34, -4.62, { r: 0.03 });
    A.label(0.3, 0.15, R.kasaScreen, 3.2, LOW + 0.48, -4.7, { rx: -0.5 }); A.box(0.34, 0.2, 0.04, '#3c4a56', 3.2, LOW + 0.46, -4.72, { rx: -0.5, r: 0.01 });
    // corner posts, front beam, rolled-up kepenk box above the counter
    // (kept high: the game camera looks down steeply, anything low in front of the counter would hide Sabri)
    [-4.1, 4.1].forEach(x => A.box(0.16, 3.3, 0.16, trim, x, 1.65, BUFE.z1 - 0.08, { r: 0.03 }));
    A.span(BUFE.x0, BUFE.x1, 3.12, 3.3, BUFE.z1 - 0.16, BUFE.z1 + 0.02, trim, { r: 0.03 });
    A.span(-2.72, 2.24, 2.86, 3.12, BUFE.z1 - 0.3, BUFE.z1 - 0.04, worn('kepenk') ? '#8d7466' : shade(K.red, -0.08), { r: 0.05, uv: undefined });
    A.label(4.9, 0.22, worn('kepenk') ? R.kepenkWorn : R.kepenkNew, -0.24, 2.98, BUFE.z1 - 0.035, { tint: worn('kepenk') ? '#ffffff' : '#f08070' });
    // sign on top of the back wall
    [-3.2, 3.2].forEach(x => A.box(0.12, 0.5, 0.12, '#4a4a4a', x, H + 0.25, BUFE.z0 + 0.1, { r: 0.02 }));
    A.span(-3.75, 3.75, H + 0.12, H + 1.42, BUFE.z0 + 0.0, BUFE.z0 + 0.08, gold ? K.gold : '#1d3d6b', { r: 0.03 });
    signPose(0, H + 0.77, BUFE.z0 + 0.12, 7.2, 1.18, 0);
    if (!worn('tabela')) for (let i = 0; i < 26; i++) { const t = i / 25; BU.sph(0.05, '#ffffff', -3.65 + t * 7.3, H + 1.38, BUFE.z0 + 0.12, { ws: 6, hs: 4 }); BU.sph(0.05, '#ffffff', -3.65 + t * 7.3, H + 0.16, BUFE.z0 + 0.12, { ws: 6, hs: 4 }); }
    // floresan on the back wall
    A.box(1.4, 0.1, 0.12, '#d8dde2', 0, 2.38, BUFE.z0 + 0.27, { r: 0.03 });
    K2.flo = { x: 0, y: 2.31, z: BUFE.z0 + 0.3, len: 1.25, hang: 0 };
    K2.pool = { x: 0, z: -7.4, r: 6.5 };
    // A-frame menu board outside
    A.push(mtx(4.75, 0, -3.75, 0, -0.3, 0)); A.box(0.75, 0.95, 0.05, '#7d5638', 0, 0.5, 0.12, { rx: -0.2, r: 0.02 }); A.label(0.66, 0.6, R.menu, 0, 0.56, 0.155, { rx: -0.2 }); A.box(0.75, 0.95, 0.05, '#7d5638', 0, 0.5, -0.12, { rx: 0.2, r: 0.02 }); A.pop();
    ob(4.4, 5.1, -4.0, -3.5, 'prop');
    // fresh paint brings bunting and flower boxes
    if (!worn('boya')) {
      K2.bunting = { x0: -4.1, x1: 4.1, y: 3.08, z: BUFE.z1 + 0.06 };
      [[-4.05, 0.3], [3.85, 0.6]].forEach(([x, w]) => { A.box(w, 0.2, 0.22, '#c8693e', x, LOW + 0.1, BUFE.z1 - 0.1, { r: 0.03 }); for (let k = 0; k < Math.round(w / 0.15); k++) A.ico(0.11, k % 2 ? '#6f9e4f' : '#7fae5e', x - w / 2 + 0.08 + k * 0.15, LOW + 0.28, BUFE.z1 - 0.1, { d: 0 }); A.sph(0.06, K.red, x - 0.05, LOW + 0.4, BUFE.z1 - 0.03, { ws: 6, hs: 4 }); A.sph(0.06, K.pink, x + 0.1, LOW + 0.38, BUFE.z1 - 0.06, { ws: 6, hs: 4 }); });
    }
    // cat basket outside the west wall, a stool by the door
    A.cyl(0.32, 0.26, 0.2, '#c9a05a', -4.85, 0.1, -5.3, { seg: 12, uv: R.hasir }); A.cyl(0.28, 0.28, 0.03, '#e8a0a0', -4.85, 0.18, -5.3, { seg: 12 });
    // stool by the door: placed as the editable prefab iskele.tabure (zone prop tabure-s2), same geometry
    if (stage >= 4) {
      // glass screens on the low walls (lokanta)
      GL.span(BUFE.x0 + 0.02, BUFE.x0 + 0.08, LOW + 0.07, 2.5, -9.0, BUFE.z1 - 0.2, '#ffffff', { r: 0 });
      GL.span(BUFE.x1 - 0.08, BUFE.x1 - 0.02, LOW + 0.07, 2.5, -5.9, BUFE.z1 - 0.2, '#ffffff', { r: 0 });
    }
  }

  /* ---- stage 3+: tea garden on the west side ---- */
  if (stage >= 3) {
    const lat = stage >= 5 ? '#c9a24a' : '#a8774f';
    ST.span(-10.2, -4.45, 0.0, 0.016, -10.6, 1.8, stage >= 4 ? '#f6e8d8' : '#f3cfa8', { r: 0, world: 2.5 });
    if (stage >= 4) {
      GL.span(-10.24, -10.18, 0.1, 2.0, -10.4, 1.8, '#ffffff', { r: 0 }); GL.span(-10.2, -7.0, 0.1, 2.0, 1.76, 1.82, '#ffffff', { r: 0 });
      [-10.2, -8.6, -7.0].forEach(x => A.box(0.08, 2.0, 0.08, lat, x, 1.0, 1.8, { r: 0.02 })); for (let z = -10.4; z <= 1.8; z += 1.55) A.box(0.08, 2.0, 0.08, lat, -10.2, 1.0, z, { r: 0.02 });
    } else {
      lattice(A, -10.2, 1.8, -10.2, -10.45, 1.75, lat);
      lattice(A, -10.2, 1.8, -7.0, 1.8, 1.75, lat);
    }
    lattice(A, -10.2, -10.75, -4.4, -10.75, 1.75, lat);
    // pergola posts, beams, slats, vines and a string of bulbs
    const px = [-9.95, -4.75], pz = [-10.45, -4.3, 1.55];
    px.forEach(x => pz.forEach(z => { if (x > -5 && z < -4.4) return; A.box(0.14, 2.75, 0.14, '#8a5d3b', x, 1.37, z, { r: 0.03 }); }));
    A.box(0.14, 2.75, 0.14, '#8a5d3b', -4.55, 1.37, -10.45, { r: 0.03 });
    [-9.95, -4.6].forEach(x => A.box(0.12, 0.16, 12.1, '#8a5d3b', x, 2.8, -4.45, { r: 0.02 }));
    for (let z = -10.2; z <= 1.6; z += 1.3) A.box(5.6, 0.07, 0.09, '#9c6c46', -7.3, 2.92, z, { r: 0.015 });
    const vr = v2rng(55);
    for (let i = 0; i < 26; i++) { const x = vr.pick([-9.95, -4.6]), z = vr.range(-10.2, 1.4); A.ico(vr.range(0.22, 0.38), vr.pick(['#6f9e4f', '#7fae5e', '#5d8f45']), x + vr.range(-0.15, 0.15), 2.85 + vr.range(-0.1, 0.12), z, { d: 0 }); if (vr.chance(0.4)) A.sph(0.07, vr.pick([K.pink, '#d86bb0', '#fff6e6']), x + 0.15, 2.75, z + 0.1, { ws: 5, hs: 4 }); }
    for (let i = 0; i < 16; i++) { const t = i / 15, x = lerp(-9.9, -4.65, t), y = 2.72 - Math.sin(t * PI) * 0.35; BU.sph(0.065, '#ffffff', x, y, -7.4, { ws: 6, hs: 4 }); BU.sph(0.065, '#ffffff', x, y, -1.6, { ws: 6, hs: 4 }); K2.lamps.push({ x, y, z: -7.4, s: 0.5 }, { x, y, z: -1.6, s: 0.5 }); }
    for (let i = 0; i < 12; i++) { const t = i / 11, z = lerp(-10.3, 1.5, t), y = 2.7 - Math.sin(t * PI * 2) * 0.12; BU.sph(0.065, '#ffffff', -9.9, y, z, { ws: 6, hs: 4 }); K2.lamps.push({ x: -9.9, y, z, s: 0.5 }); }
    // pots along the lattice, a "Çay Bahçesi" sign
    [[-9.8, -10.2], [-9.8, 1.4], [-4.9, -10.35], [-7.4, 1.45]].forEach(([x, z]) => { A.cyl(0.26, 0.2, 0.42, K.terracotta, x, 0.21, z, { seg: 10 }); A.ico(0.32, '#6f9e4f', x, 0.62, z, { d: 1 }); A.sph(0.07, K.red, x + 0.12, 0.8, z + 0.15, { ws: 6, hs: 4 }); A.sph(0.07, K.red, x - 0.1, 0.84, z + 0.1, { ws: 6, hs: 4 }); });
    A.box(1.9, 0.5, 0.06, '#8a5d3b', -8.6, 2.15, 1.86, { r: 0.02 }); A.label(1.8, 0.42, R.bahce, -8.6, 2.15, 1.895);
    ob(-10.35, -10.05, -10.5, 1.9, 'garden'); ob(-10.35, -6.9, 1.7, 1.9, 'garden'); ob(-10.3, -4.35, -10.85, -10.65, 'garden');
  }
  if (stage >= 5) {
    // Martıköy Genel Merkez placeholder: a mustached bust of Sabri at the pier entrance
    A.box(0.9, 1.1, 0.9, '#e8e2d8', -6.6, 0.55, 3.35, { r: 0.05 }); A.box(1.0, 0.12, 1.0, K.gold, -6.6, 1.12, 3.35, { r: 0.03 });
    A.sph(0.42, K.gold, -6.6, 1.65, 3.35, { sy: 0.85 }); A.sph(0.3, K.gold, -6.6, 2.15, 3.4, {}); A.cap(0.05, 0.22, '#b07a1e', -6.6, 2.06, 3.68, { rz: HP });
    A.box(0.62, 0.2, 0.55, K.gold, -6.6, 2.42, 3.4, { r: 0.08 });
    ob(-7.1, -6.1, 2.9, 3.8, 'prop');
  }
  return { A, RF, TL, FL, BU, GL, ST, K2 };
}

export function stage1Front(A?: any, BU?: any, K2?: any, worn?: any) {
  const ob = (x0?: any, x1?: any, z0?: any, z1?: any, tag?: any) => K2.obstacles.push({ x0, x1, z0, z1, tag: tag || 'kiosk' });
  // counter (tezgah) x -0.5..2.5, z -1.65..-1.05
  if (worn('tezgah')) {
    crate(A, 0.62, 0.84, 0.6, -0.15, 0, -1.35); crate(A, 0.62, 0.84, 0.6, 2.15, 0, -1.35); crate(A, 0.62, 0.42, 0.6, 1.0, 0, -1.35);
    A.box(3.1, 0.06, 0.66, '#b48a5e', 1.0, 0.87, -1.35, { r: 0.015, uv: R.grain, rz: 0.012 });
    A.box(0.9, 0.5, 0.03, '#e8d8b8', 1.05, 0.62, -1.02, { r: 0.01, rz: -0.05 }); A.label(0.8, 0.4, R.menuTiny, 1.05, 0.62, -1.003, { rz: -0.05 });
  } else {
    A.box(3.0, 0.84, 0.56, K.red, 1.0, 0.42, -1.35, { r: 0.04 }); A.box(2.8, 0.6, 0.02, '#fff6e6', 1.0, 0.44, -1.06, { r: 0.01 }); A.label(1.4, 0.42, R.menu, 1.0, 0.44, -1.045);
    A.box(3.1, 0.06, 0.66, '#e6ecf0', 1.0, 0.87, -1.35, { r: 0.02 });
  }
  A.box(0.34, 0.16, 0.24, '#7a8a90', -0.2, 0.98, -1.35, { r: 0.03, uv: R.rust }); A.box(0.3, 0.02, 0.2, '#a9b4ba', -0.2, 1.07, -1.35, { r: 0.01 });
  ob(-0.5, 2.5, -1.65, -1.05);
  // stool by the counter (cat spot)
  // stool by the counter (cat spot): placed as the editable prefab iskele.tabure-kucuk (zone prop tabure-s1), same geometry
  // ferry-window stall on the east strip, front faces +X
  A.push(mtx(5.75, 0, WIN_Z, 0, HP, 0));
  [-0.85, 0.85].forEach(x => A.box(0.1, 2.35, 0.1, '#8a5d3b', x, 1.17, 0, { r: 0.02, uv: R.grain }));
  A.box(1.85, 0.06, 0.55, '#c9955c', 0, 1.0, 0.05, { r: 0.015, uv: R.grain });
  A.box(1.7, 0.95, 0.05, worn('boya') ? '#b49a7a' : '#3fb5b0', 0, 0.5, -0.12, { r: 0.015, uv: worn('boya') ? R.peel : undefined });
  A.box(1.95, 0.4, 0.1, '#1d5fa8', 0, 2.36, 0, { r: 0.02 }); A.label(1.8, 0.32, R.pencere, 0, 2.36, 0.055);
  A.box(1.9, 0.18, 0.2, worn('kepenk') ? '#8d7466' : shade(K.red, -0.1), 0, 2.08, 0.08, { r: 0.03 });
  A.pop();
  K2.shutter = { kind: 'stall', x: 5.75, z: WIN_Z, rotY: HP, w: 1.6, y0: 1.04, y1: 1.99, off: 0.12 };
  ob(5.45, 6.05, WIN_Z - 0.95, WIN_Z + 0.95, 'window');
}

export const FONT_FALLBACK = {
  yesilcam: { family: '"Brush Script MT", "Segoe Script", cursive', weight: 700, style: 'italic', color: '#f6ead2' },
  vapur: { family: '"Arial Black", Impact, sans-serif', weight: 900, style: 'normal', color: '#f2b632' },
  neon: { family: '"Trebuchet MS", "Segoe UI", sans-serif', weight: 800, style: 'normal', color: '#ff5fa2', neon: true },
  lale: { family: 'Georgia, "Times New Roman", serif', weight: 700, style: 'italic', color: '#f2a2b3' },
  plaza: { family: 'Helvetica, Arial, sans-serif', weight: 600, style: 'normal', color: '#ffffff' },
  uzay: { family: '"Courier New", Consolas, monospace', weight: 700, style: 'normal', color: '#49e6d8' }
};
const FONT_IDS = ['yesilcam', 'vapur', 'neon', 'lale', 'plaza', 'uzay'];
export function fontSpec(id?: any) {
  const list = ([] as any[]);
  let f = list.find(x => x.id === id);
  if (!f && typeof id === 'number') f = list[id] || { id: FONT_IDS[id] };
  const key = (f && f.id) || (FONT_IDS.includes(id) ? id : 'vapur');
  return Object.assign({ id: key }, (FONT_FALLBACK as any)[key] || FONT_FALLBACK.vapur, f || {});
}
export function drawSign(text?: any, fontId?: any, worn?: any, stage?: any, neonPass?: any) {
  const W0 = 1024, H0 = 168, cv = document.createElement('canvas'); cv.width = W0; cv.height = H0;
  const g = cv.getContext('2d')!, f = fontSpec(fontId);
  let s = String(text || '').slice(0, 24);
  if (f.id === 'vapur' || f.id === 'plaza') s = s.toLocaleUpperCase('tr');
  const old = worn && stage === 1;
  if (old) s = 'BÜFE';
  if (!neonPass) {
    const gr = g.createLinearGradient(0, 0, 0, H0);
    if (worn) { gr.addColorStop(0, old ? '#5d6670' : '#3e5878'); gr.addColorStop(1, old ? '#4a4f55' : '#2f4560'); }
    else { gr.addColorStop(0, stage >= 5 ? '#3a2a10' : '#234a80'); gr.addColorStop(1, stage >= 5 ? '#24190a' : '#16325c'); }
    g.fillStyle = gr; g.fillRect(0, 0, W0, H0);
    g.lineWidth = 10; g.strokeStyle = stage >= 5 ? K.gold : worn ? 'rgba(220,210,190,.45)' : '#fff6e6'; rrect(g, 9, 9, W0 - 18, H0 - 18, 18); g.stroke();
    if (worn) { for (let i = 0; i < 26; i++) { const x = rnd.next() * W0, y = rnd.next() * H0, r = 6 + rnd.next() * 26; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(150,80,40,.55)'); rg.addColorStop(1, 'rgba(150,80,40,0)'); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); } }
    else [[26, 26], [W0 - 26, 26], [26, H0 - 26], [W0 - 26, H0 - 26]].forEach(([x, y]) => { g.fillStyle = '#c9d1d8'; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); });
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, W0, H0); }
  const col0 = f.color || '#ffc93c';
  const px = f.id === 'plaza' ? 84 : f.id === 'yesilcam' ? 104 : f.id === 'uzay' ? 78 : 92;
  g.font = `${f.style || 'normal'} ${f.weight || 800} ${px}px ${f.family}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const cx = W0 / 2, cy = H0 / 2 + 4, max = W0 - (f.id === 'lale' ? 230 : 110);
  if (f.id === 'plaza') try { g.letterSpacing = '6px'; } catch (e) {}
  const draw = (fn?: any) => { const m = g.measureText(s).width; g.save(); g.translate(cx, cy); if (m > max) g.scale(max / m, 1); fn(); g.restore(); };
  const tw = Math.min(max, g.measureText(s).width);
  if (neonPass) {
    const nc = f.neon ? col0 : (f.id === 'vapur' ? '#ffd23f' : col0);
    g.shadowColor = nc; g.shadowBlur = 22; g.lineWidth = 6; g.strokeStyle = nc;
    draw(() => { g.strokeText(s, 0, 0); g.fillStyle = '#ffffff'; g.fillText(s, 0, 0); });
    g.shadowBlur = 12; g.strokeStyle = stage >= 5 ? K.gold : K.neonTeal; g.lineWidth = 5; rrect(g, 14, 14, W0 - 28, H0 - 28, 16); g.stroke();
  } else {
    const col = worn ? mixc(col0, '#a89a88', 0.45).getStyle() : col0;
    if (f.neon || f.id === 'uzay') { g.lineWidth = 12; g.strokeStyle = worn ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.35)'; draw(() => g.strokeText(s, 0, 0)); }
    else { g.lineWidth = 14; g.strokeStyle = 'rgba(20,14,10,.55)'; g.lineJoin = 'round'; draw(() => g.strokeText(s, 0, 0)); }
    g.fillStyle = col; draw(() => g.fillText(s, 0, 0));
    if (f.id === 'vapur') { g.fillStyle = worn ? '#3e5878' : '#1d3d6b'; for (let x = cx - tw / 2; x < cx + tw / 2; x += px * 0.62) g.fillRect(x + px * 0.28, cy - px * 0.5, 5, px); }
    if (f.id === 'neon' && !worn) { g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.7)'; draw(() => g.strokeText(s, 0, 0)); }
    if (worn && s.length > 2) { g.fillStyle = 'rgba(70,60,50,.55)'; g.fillRect(cx + tw * 0.18, cy - px * 0.45, px * 0.5, px * 0.9); }
  }
  if (f.id === 'yesilcam') { g.lineWidth = 6; g.strokeStyle = neonPass ? col0 : (worn ? '#a89a88' : col0); g.beginPath(); g.moveTo(cx - tw / 2, cy + px * 0.5); g.bezierCurveTo(cx - tw / 4, cy + px * 0.75, cx + tw / 4, cy + px * 0.3, cx + tw / 2 + 20, cy + px * 0.55); g.stroke(); }
  if (f.id === 'lale') [-1, 1].forEach(sg => { const x = cx + sg * (tw / 2 + 60), y = cy; g.save(); g.translate(x, y); g.fillStyle = neonPass ? '#ff5fa2' : '#3fb5b0'; g.fillRect(-3, -2, 6, 40); g.fillStyle = neonPass ? '#ff5fa2' : (worn ? '#c08a8a' : '#e0533c'); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-30, -6, -24, -40, -12, -44); g.lineTo(0, -30); g.lineTo(12, -44); g.bezierCurveTo(24, -40, 30, -6, 0, 0); g.fill(); g.restore(); });
  if (f.id === 'uzay') { g.fillStyle = neonPass ? '#ffffff' : '#ffd23f'; [[60, 40], [110, 120], [W0 - 70, 46], [W0 - 120, 118], [170, 30], [W0 - 180, 136]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); }); }
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function jobBoardInto(A?: any, x?: any, z?: any, ry?: any) {
  A.push(mtx(x, 0, z, 0, ry, 0));
  [-0.8, 0.8].forEach(lx => A.box(0.1, 2.4, 0.1, '#7d5638', lx, 1.2, 0, { r: 0.03, uv: R.grain }));
  A.box(1.66, 1.26, 0.07, '#8a5d3b', 0, 1.6, 0, { r: 0.03 }); A.label(1.56, 1.17, R.jobBoard, 0, 1.6, 0.04);
  A.box(1.95, 0.07, 0.42, '#e0533c', 0, 2.42, 0.04, { r: 0.03, rx: 0.15 });
  A.box(0.5, 0.04, 0.26, '#c9955c', 0, 0.9, 0.14, { r: 0.01 }); A.box(0.3, 0.02, 0.2, '#fffaf0', 0, 0.93, 0.14, { r: 0.004, ry: 0.2 });
  A.pop();
}
export function partPos(part?: any, stage?: any, K2?: any) {
  const s1 = stage === 1, z1 = BUFE.z1;
  switch (part) {
    case 'kepenk': return s1 ? V3(0, 1.2, z1 + 0.2) : V3(-0.2, 2.4, z1 + 0.1);
    case 'tabela': return K2 && K2.sign ? V3(K2.sign.x, K2.sign.y, K2.sign.z + 0.2) : V3(0, 3.3, z1);
    case 'fayans': return s1 ? V3(-3.9, 0.6, z1 + 0.2) : V3(0, 1.0, -10.2);
    case 'floresan': return K2 && K2.flo ? V3(K2.flo.x, K2.flo.y, K2.flo.z) : V3(0, 2.3, z1);
    case 'tezgah': return s1 ? V3(1.0, 1.0, -1.35) : V3(-0.25, 1.1, -4.7);
    default: return V3(BUFE.x1 + 0.2, 1.4, -6.0);
  }
}

