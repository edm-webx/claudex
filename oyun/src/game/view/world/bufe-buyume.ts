/**
 * Büfe büyümesi 6-10 (2026-11-08, owner: "büfe büyümesi 10. seviyeye kadar gelsin ... en sonunda baya büyük bir restoran,
 * bir fine dining"). The kiosk itself stops changing at stage 5; from 6 on the business grows over the sea on the west
 * side of the pier (x < PIER.x0), cumulative per stage:
 *   6 Deniz platformu: wooden deck on piles, railing, umbrella tables, string lights
 *   7 Balık restoranı: glass pavilion with white-cloth tables inside, flat roof with overhang, lit sign
 *   8 Boğaz restoranı: roof terrace (railing, umbrellas, stair), pergola with vines over the north deck
 *   9 Şef mutfağı: open kitchen block with grill flames, hood and chimney smoke stack
 *  10 Fine dining: navy and gold frame, chandeliers, red carpet, valet podium, topiaries, candles, gold sign
 * Pure view (no colliders, not walkable yet): rebuilt only when the stage changes.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { PIER } from '../../../content/prefabs/iskele/layout';
import { useSkyEnv } from './glb';
import { radialTex, ensureKit } from '../../../content/prefabs/common/v2kit';

export interface BuyumeDeps { root: () => T.Object3D | null; night: () => number; stage: () => number; /** running tadilat: target stage and 0..1 progress */ tadilat?: () => { to: number; p: number } | null; /** the player's club (sim/mulk takim) */ takim?: () => { ad: string; renk: string; renk2?: string } | null }
export interface BuyumeView { update(dt: number): void; dispose(): void }

const X1 = PIER.x0 - 0.15, X0 = X1 - 14, Z0 = -16, Z1 = 3;   // platform footprint (west of the pier)
const XC = (X0 + X1) / 2;
const UMB = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#f4f2ec', '#c94f6d'];
const HP = Math.PI / 2;

let pool: T.MeshBasicMaterial | null = null, warm: T.MeshBasicMaterial | null = null;
let solid: T.MeshStandardMaterial | null = null, glass: T.MeshStandardMaterial | null = null, glow: T.MeshBasicMaterial | null = null;
function mats() {
  if (!solid) {
    solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }); useSkyEnv(solid, 'matte');
    glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.5, transparent: true, opacity: 0.55 }); useSkyEnv(glass, 'glass');
    glow = new T.MeshBasicMaterial({ vertexColors: true });
    ensureKit();
    pool = new T.MeshBasicMaterial({ map: radialTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
    warm = new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false });
  }
  return { solid: solid!, glass: glass!, glow: glow!, pool: pool!, warm: warm! };
}
function signTex(text: string, bg: string, fg: string, serif: boolean): T.CanvasTexture {
  const w = 1024, h = 160, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = 0.6; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = serif ? 'italic 700 92px Georgia,"Times New Roman",serif' : '900 96px system-ui,"Segoe UI",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = w - 60; g.save(); g.translate(w / 2, h / 2 + 4); if (m > max) g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore();
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

function build(stage: number, signMats: T.MeshStandardMaterial[], flames: T.Object3D[]): T.Group {
  const grp = new T.Group(); grp.name = 'bufe-buyume-' + stage;
  const b = new Batch(), gl = new Batch(), lit = new Batch(), pl = new Batch(), wm = new Batch();
  const glowAt = (x: number, z: number, r: number, c = '#ffb866', y = 0.03) => pl.plane(r * 2, r * 2, c, x, y, z, { rx: -HP, uv: [0, 0, 1, 1] });
  const fine = stage >= 10, frame = fine ? '#1f2a44' : '#f4f2ec', accent = fine ? '#c9a24a' : '#2f7fb3';
  const W = X1 - X0, D = Z1 - Z0;

  /* 6: deck on piles, railing, tables, string lights */
  b.box(W, 0.26, D, '#a8794e', XC, -0.13, (Z0 + Z1) / 2);
  for (let i = 0; i <= Math.round(W / 1.2); i++) b.box(0.03, 0.005, D, '#7a5434', X0 + i * W / Math.round(W / 1.2), 0.003, (Z0 + Z1) / 2);
  for (let x = X0 + 0.4; x <= X1 - 0.3; x += 3.3) for (const z of [Z0 + 0.4, (Z0 + Z1) / 2, Z1 - 0.4]) b.cyl(0.18, 0.2, 1.4, '#5a4330', x, -0.85, z, { seg: 8 });
  const rail = (xa: number, za: number, xb: number, zb: number) => {
    const len = Math.hypot(xb - xa, zb - za), ry = Math.atan2(xb - xa, zb - za), n = Math.max(1, Math.round(len / 1.4));
    b.box(0.09, 0.08, len, fine ? '#c9a24a' : '#4f8fcf', (xa + xb) / 2, 1.0, (za + zb) / 2, { ry });
    for (let i = 0; i <= n; i++) b.box(0.07, 1.0, 0.07, fine ? '#1f2a44' : '#f4f1ea', xa + (xb - xa) * i / n, 0.5, za + (zb - za) * i / n);
  };
  rail(X0, Z0, X0, Z1); rail(X0, Z0, X1, Z0); rail(X0, Z1, X1 - 3, Z1);
  const table = (x: number, z: number, c: string, umb: boolean, cloth: boolean) => {
    b.cyl(0.05, 0.08, 0.72, '#3a3d42', x, 0.36, z, { seg: 6 }); b.cyl(0.42, 0.42, 0.05, cloth ? '#fbfaf6' : '#d6aa78', x, 0.74, z, { seg: 14 });
    if (cloth) b.cyl(0.44, 0.47, 0.18, '#fbfaf6', x, 0.66, z, { seg: 14 });
    for (let k = 0; k < 4; k++) { const a = k * HP + 0.4, cx = x + Math.cos(a) * 0.62, cz = z + Math.sin(a) * 0.62; b.box(0.36, 0.05, 0.36, fine ? '#6b1f2a' : '#7d5638', cx, 0.45, cz); b.box(0.36, 0.42, 0.05, fine ? '#6b1f2a' : '#7d5638', cx + Math.cos(a) * 0.17, 0.66, cz + Math.sin(a) * 0.17, { ry: -a + HP }); }
    if (umb) { b.cyl(0.03, 0.03, 2.2, '#f4f2ec', x, 1.1, z, { seg: 6 }); b.cone(1.25, 0.5, c, x, 2.35, z, { seg: 8 }); }
    if (fine) lit.sph(0.05, '#ffcf6a', x, 0.84, z, { ws: 6, hs: 4 });
  };
  const outer = stage >= 7 ? [[X0 + 2.2, 0.0], [X0 + 5.6, 0.0], [X0 + 9.0, 0.0], [X0 + 2.2, -3.0], [X0 + 9.0, -3.0], [X1 - 1.6, -3.0]] : [[X0 + 2.2, -12], [X0 + 6, -12], [X0 + 9.8, -12], [X0 + 2.2, -7], [X0 + 6, -7], [X0 + 9.8, -7], [X0 + 2.2, -1.5], [X0 + 6, -1.5], [X0 + 9.8, -1.5]];
  outer.forEach(([x, z]) => glowAt(x, z, 2.2));
  for (let z = Z0 + 2; z < Z1; z += 4) glowAt(X0 + 1.2, z, 2.0, '#ffd890');
  outer.forEach(([x, z], i) => table(x, z, fine ? '#f4f2ec' : UMB[i % UMB.length], stage < 8 || z < -2, fine));
  // string lights between poles along the outer rail
  const poles: [number, number][] = [[X0 + 0.2, Z0 + 0.2], [X0 + 0.2, (Z0 + Z1) / 2], [X0 + 0.2, Z1 - 0.2], [X1 - 3, Z1 - 0.2]];
  poles.forEach(([x, z]) => b.cyl(0.05, 0.06, 3.0, '#33373b', x, 1.5, z, { seg: 6 }));
  for (let p = 0; p < poles.length - 1; p++) { const [xa, za] = poles[p], [xb, zb] = poles[p + 1]; for (let i = 1; i < 10; i++) { const t = i / 10, sag = Math.sin(t * Math.PI) * 0.45; lit.sph(0.06, i % 2 ? '#ffd890' : '#fff3d6', xa + (xb - xa) * t, 2.9 - sag, za + (zb - za) * t, { ws: 6, hs: 4 }); } }

  /* 7: glass pavilion on the south half */
  if (stage >= 7) {
    const px0 = X0 + 1.0, px1 = X1 - 0.8, pz0 = Z0 + 1.0, pz1 = -5.0, ph = 3.4, pw = px1 - px0, pd = pz1 - pz0, pxc = (px0 + px1) / 2, pzc = (pz0 + pz1) / 2;
    b.box(pw, 0.12, pd, fine ? '#2a2a30' : '#e9e0c8', pxc, 0.06, pzc);
    gl.box(pw - 0.1, ph - 0.2, 0.04, '#a9d6ec', pxc, ph / 2, pz1); gl.box(pw - 0.1, ph - 0.2, 0.04, '#a9d6ec', pxc, ph / 2, pz0);
    gl.box(0.04, ph - 0.2, pd - 0.1, '#a9d6ec', px0, ph / 2, pzc); gl.box(0.04, ph - 0.2, pd - 0.1, '#a9d6ec', px1, ph / 2, pzc);
    for (let i = 0; i <= 6; i++) { const x = px0 + pw * i / 6; b.box(0.12, ph, 0.12, frame, x, ph / 2, pz1); b.box(0.12, ph, 0.12, frame, x, ph / 2, pz0); }
    for (let i = 1; i < 5; i++) { const z = pz0 + pd * i / 5; b.box(0.12, ph, 0.12, frame, px0, ph / 2, z); b.box(0.12, ph, 0.12, frame, px1, ph / 2, z); }
    wm.box(pw - 0.3, ph - 0.5, pd - 0.3, '#ffcf8a', pxc, ph / 2, pzc); glowAt(pxc, pz1 + 1.6, 3.2); glowAt(pxc, pz0 - 1.4, 3.0);
    b.box(pw + 1.0, 0.28, pd + 1.0, frame, pxc, ph + 0.14, pzc);
    b.box(pw + 0.9, 0.06, pd + 0.9, stage >= 8 ? '#a8794e' : '#d9d4c8', pxc, ph + 0.31, pzc);   // roof surface (terrace deck from 8)
    for (const [w2, d2, ox, oz] of [[pw + 1.1, 0.12, 0, (pd + 1.0) / 2], [pw + 1.1, 0.12, 0, -(pd + 1.0) / 2], [0.12, pd + 1.1, (pw + 1.0) / 2, 0], [0.12, pd + 1.1, -(pw + 1.0) / 2, 0]]) b.box(w2, 0.36, d2, accent, pxc + ox, ph + 0.16, pzc + oz);
    b.box(1.6, 2.4, 0.08, fine ? '#14192a' : '#cfd5db', XC + 2.5, 1.2, pz1 + 0.05);   // door
    // inside: white-cloth tables
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) table(px0 + 1.8 + i * (pw - 3.6) / 2, pz0 + 1.7 + j * (pd - 3.4), '#fff', false, true);
    // service counter at the back
    b.box(pw * 0.5, 1.0, 0.6, fine ? '#3a2a22' : '#b98a5e', pxc, 0.5, pz0 + 0.45);
    // ceiling lamps (chandeliers at 10)
    for (let i = 0; i < 3; i++) { const x = px0 + pw * (i + 0.5) / 3; if (fine) { b.cyl(0.02, 0.02, 0.6, '#c9a24a', x, ph - 0.3, pzc, { seg: 4 }); b.tor(0.38, 0.03, '#c9a24a', x, ph - 0.62, pzc, { rx: HP, rs: 4, ts: 16 }); for (let k = 0; k < 8; k++) lit.sph(0.06, '#ffe6b0', x + Math.cos(k * 0.785) * 0.38, ph - 0.55, pzc + Math.sin(k * 0.785) * 0.38, { ws: 6, hs: 4 }); } else lit.cyl(0.22, 0.3, 0.2, '#fff3d6', x, ph - 0.3, pzc, { seg: 10 }); }
    // sign over the entrance
    const txt = fine ? 'SABRİ\'NİN SOFRASI' : stage >= 8 ? 'SABRİ BOĞAZ RESTORAN' : 'SABRİ BALIK RESTORANI';
    const sm = new T.MeshStandardMaterial({ map: signTex(txt, fine ? '#14192a' : '#2f7fb3', fine ? '#e8c76a' : '#fbfaf6', fine), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.6 });
    sm.emissiveMap = sm.map; signMats.push(sm);
    const sp = new T.Mesh(new T.PlaneGeometry(6.2, 0.97), sm); sp.position.set(pxc, ph + 0.75, pz1 + 0.56); grp.add(sp);
    b.box(6.4, 1.1, 0.1, fine ? '#c9a24a' : '#f4f2ec', pxc, ph + 0.75, pz1 + 0.5);

    /* 8: roof terrace + pergola */
    if (stage >= 8) {
      const ry = ph + 0.38;
      const r2 = (xa: number, za: number, xb: number, zb: number) => { const len = Math.hypot(xb - xa, zb - za), a = Math.atan2(xb - xa, zb - za), n = Math.round(len / 1.2); b.box(0.08, 0.07, len, accent, (xa + xb) / 2, ry + 1.0, (za + zb) / 2, { ry: a }); for (let i = 0; i <= n; i++) b.box(0.05, 1.0, 0.05, frame, xa + (xb - xa) * i / n, ry + 0.5, za + (zb - za) * i / n); };
      r2(px0 - 0.4, pz0 - 0.4, px1 + 0.4, pz0 - 0.4); r2(px0 - 0.4, pz1 + 0.4, px1 + 0.4, pz1 + 0.4); r2(px0 - 0.4, pz0 - 0.4, px0 - 0.4, pz1 + 0.4); r2(px1 + 0.4, pz0 - 0.4, px1 + 0.4, pz1 - 1.6);
      b.push(new T.Matrix4().makeTranslation(0, ry, 0));
      for (let i = 0; i < 4; i++) table(px0 + 1.6 + i * (pw - 3.2) / 3, pzc, fine ? '#f4f2ec' : UMB[(i + 2) % UMB.length], true, fine);
      b.pop();
      for (let s = 0; s < 12; s++) b.box(1.0, 0.12, 0.34, '#8a6a4a', px1 + 0.25, 0.3 + s * (ry / 12), pz1 - 1.0 - s * 0.32);   // stair up the east side
      // pergola over the north deck
      for (const [x, z] of [[X0 + 1, -4], [X0 + 1, Z1 - 0.8], [X1 - 4, -4], [X1 - 4, Z1 - 0.8], [X0 + 5.4, -4], [X0 + 5.4, Z1 - 0.8]]) b.box(0.18, 2.8, 0.18, frame, x, 1.4, z);
      for (let i = 0; i < 9; i++) b.box(X1 - 4 - X0, 0.1, 0.12, '#8a6a4a', (X0 + X1 - 3) / 2, 2.85, -4 + i * (Z1 - 0.8 + 4) / 8);
      for (let i = 0; i < 46; i++) { const x = X0 + 1.2 + ((i * 37) % 97) / 97 * (X1 - 5.4 - X0), z = -3.8 + ((i * 53) % 89) / 89 * (Z1 + 2.8); b.box(0.9 + (i % 3) * 0.25, 0.07, 0.6 + (i % 2) * 0.3, ['#4f8f3a', '#5f9f45', '#3f7a34'][i % 3], x, 2.93 + (i % 4) * 0.015, z, { ry: i * 0.7 }); if (i % 5 === 0) b.sph(0.07, i % 10 ? '#c94f6d' : '#f2a2b3', x + 0.2, 2.99, z, { ws: 5, hs: 3 }); }
    }
  }

  /* 9: open kitchen on the north-west corner */
  if (stage >= 9) {
    const kx = X0 + 2.0, kz = Z1 - 2.2;
    b.box(3.2, 0.95, 1.2, fine ? '#2a2a30' : '#c9ced6', kx, 0.48, kz); b.box(3.3, 0.06, 1.3, '#e9eef2', kx, 0.98, kz);
    b.box(3.2, 2.6, 0.2, fine ? '#1f2a44' : '#e9e0c8', kx, 1.3, kz + 0.9);   // back wall with tiles
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) b.box(0.36, 0.3, 0.02, (i + j) % 2 ? '#3fb5b0' : '#f6f8fb', kx - 1.4 + i * 0.4, 1.2 + j * 0.34, kz + 0.79);
    b.box(2.4, 0.5, 1.0, '#9aa2ab', kx, 2.6, kz + 0.35); b.box(0.5, 2.4, 0.5, '#9aa2ab', kx + 0.6, 4.0, kz + 0.6);   // hood + chimney
    b.box(1.4, 0.08, 0.7, '#1a1a1a', kx - 0.6, 1.03, kz);   // grill
    for (let i = 0; i < 6; i++) { const f = new T.Mesh(new T.ConeGeometry(0.07, 0.3, 5), new T.MeshBasicMaterial({ color: i % 2 ? '#ffb347' : '#ff7a2f', transparent: true, opacity: 0.9, depthWrite: false })); f.position.set(kx - 1.1 + i * 0.2, 1.2, kz); f.userData.ph = i * 1.7; grp.add(f); flames.push(f); }
    b.box(0.5, 0.35, 0.5, '#c9a24a', kx + 1.0, 1.18, kz);   // copper pot
  }

  /* 10: arrival: red carpet, valet podium, topiaries, uplights */
  if (fine) {
    const cz = -5.0 + 0.9, cx0 = X1 + 1.6;
    b.box(cx0 - (XC + 2.5), 0.02, 1.4, '#9a1f2a', (cx0 + XC + 2.5) / 2, 0.02, cz);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const x = XC + 3.8 + i * ((cx0 - XC - 3.8) / 3); b.cyl(0.03, 0.03, 0.9, '#c9a24a', x, 0.45, cz + s * 0.9, { seg: 6 }); b.sph(0.06, '#c9a24a', x, 0.92, cz + s * 0.9, { ws: 6, hs: 4 }); }
    b.box(0.6, 1.1, 0.4, '#1f2a44', cx0 - 0.6, 0.55, cz + 1.6); b.box(0.66, 0.06, 0.46, '#c9a24a', cx0 - 0.6, 1.12, cz + 1.6);
    for (const [x, z] of [[XC - 0.5, cz + 1.4], [XC + 5.5, cz + 1.4], [X1 - 0.6, Z0 + 0.6], [X0 + 0.6, Z0 + 0.6]]) { b.cyl(0.32, 0.26, 0.6, '#f4f2ec', x, 0.3, z, { seg: 10 }); b.sph(0.42, '#3f7a34', x, 0.95, z, { ws: 8, hs: 6 }); b.sph(0.3, '#4f8f3a', x, 1.5, z, { ws: 8, hs: 6 }); }
    for (let i = 0; i < 6; i++) lit.cyl(0.08, 0.1, 0.08, '#ffe6b0', X0 + 1.5 + i * (W - 3) / 5, 0.04, Z0 + 0.35, { seg: 8 });
  }

  const { solid: sm, glass: gm, glow: lm, pool: pm, warm: wmm } = mats();
  if (!pl.empty) { const p2 = pl.mesh(pm, false, false); p2.renderOrder = 3; grp.add(p2); }
  if (!wm.empty) { const w2 = wm.mesh(wmm, false, false); w2.renderOrder = 1; grp.add(w2); }
  const m1 = b.mesh(sm, true, true); grp.add(m1);
  if (!gl.empty) { const g2 = gl.mesh(gm, false, false); g2.renderOrder = 2; grp.add(g2); }
  if (!lit.empty) { const l = lit.mesh(lm, false, false); l.name = 'lights'; grp.add(l); }
  return grp;
}

/** Construction site while a 6-10 tadilat runs: scaffold towers, a tower crane with a swinging hook, barriers,
 *  a site sign, and hard-hat workers hammering. The new deck planks appear with the progress (stage 6). */
function buildSite(to: number): { g: T.Group; workers: T.Object3D[]; hook: T.Object3D; planks: T.Object3D[] } {
  const g = new T.Group(); g.name = 'insaat'; const b = new Batch(); const workers: T.Object3D[] = [], planks: T.Object3D[] = [];
  for (const [x, z] of [[X0 + 1.5, Z0 + 1.5], [X1 - 1.5, Z0 + 1.5], [X0 + 1.5, -5], [X1 - 1.5, -5]]) {   // scaffold towers
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box(0.06, 4.2, 0.06, '#c9ced6', x + dx, 2.1, z + dz);
    for (let y = 0.8; y < 4.3; y += 1.1) { b.box(1.3, 0.05, 1.3, '#a8794e', x, y, z); b.box(1.25, 0.04, 0.04, '#e0533c', x, y + 0.5, z - 0.6); }
  }
  // tower crane on the promenade corner
  const cx = X1 - 1.0, cz = Z1 + 2.2;
  b.box(0.8, 0.4, 0.8, '#5b6068', cx, 0.2, cz); for (let y = 0; y < 11; y += 1) { b.box(0.06, 1, 0.06, '#ffd23f', cx - 0.3, y + 0.9, cz - 0.3); b.box(0.06, 1, 0.06, '#ffd23f', cx + 0.3, y + 0.9, cz - 0.3); b.box(0.06, 1, 0.06, '#ffd23f', cx - 0.3, y + 0.9, cz + 0.3); b.box(0.06, 1, 0.06, '#ffd23f', cx + 0.3, y + 0.9, cz + 0.3); b.box(0.66, 0.05, 0.05, '#ffd23f', cx, y + 0.5, cz - 0.3, { rz: 0.8 }); }
  b.box(13, 0.35, 0.5, '#ffd23f', cx - 5.5, 11.6, cz); b.box(1.4, 1.0, 1.0, '#e0533c', cx - 0.2, 12.2, cz); b.box(1.5, 0.9, 0.9, '#5b6068', cx + 2.2, 11.3, cz);
  const hook = new T.Group(); hook.position.set(cx - 9, 11.4, cz); const cable = new T.Mesh(new T.BoxGeometry(0.03, 6, 0.03), new T.MeshLambertMaterial({ color: '#222' })); cable.position.y = -3; hook.add(cable);
  const load = new T.Mesh(new T.BoxGeometry(1.6, 0.3, 0.8), new T.MeshLambertMaterial({ color: '#a8794e' })); load.position.y = -6.2; hook.add(load); g.add(hook);
  // barriers + sign on the pier edge
  for (let z = Z0 + 1; z < Z1 - 1; z += 1.6) { b.box(0.2, 0.8, 1.3, '#f4f2ec', X1 + 0.6, 0.4, z); b.box(0.22, 0.18, 1.32, '#e0533c', X1 + 0.6, 0.55, z); }
  b.box(2.2, 1.3, 0.08, '#ffd23f', X1 + 1.4, 1.3, Z0 + 2, { ry: HP }); b.box(0.08, 1.2, 0.08, '#3a3d42', X1 + 1.4, 0.6, Z0 + 1.2); b.box(0.08, 1.2, 0.08, '#3a3d42', X1 + 1.4, 0.6, Z0 + 2.8);
  const m = b.mesh(mats().solid, true, true); g.add(m);
  // workers: hard hat, vest, a hammer arm
  const skin = new T.MeshLambertMaterial({ color: '#d9a27a' }), vest = new T.MeshLambertMaterial({ color: '#ff8a1f' }), hat = new T.MeshLambertMaterial({ color: '#ffd23f' }), pants = new T.MeshLambertMaterial({ color: '#2f4a6a' });
  const spots: [number, number][] = [[X0 + 3, Z0 + 3], [X0 + 7, Z0 + 4], [X1 - 3, -8], [X0 + 4, -2], [X1 - 2.5, Z1 - 2], [X0 + 9, -11]];
  spots.forEach(([x, z], i) => {
    const w = new T.Group(); w.position.set(x, 0, z); w.rotation.y = i * 1.3;
    const leg = new T.Mesh(new T.BoxGeometry(0.32, 0.8, 0.2), pants); leg.position.y = 0.4; w.add(leg);
    const body = new T.Mesh(new T.BoxGeometry(0.42, 0.55, 0.26), vest); body.position.y = 1.08; w.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.15, 8, 6), skin); head.position.y = 1.52; w.add(head);
    const h = new T.Mesh(new T.SphereGeometry(0.17, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), hat); h.position.y = 1.56; w.add(h);
    const arm = new T.Group(); arm.position.set(0.26, 1.3, 0); const a = new T.Mesh(new T.BoxGeometry(0.1, 0.5, 0.1), vest); a.position.y = -0.22; arm.add(a);
    const hm = new T.Mesh(new T.BoxGeometry(0.06, 0.06, 0.3), new T.MeshLambertMaterial({ color: '#5b6068' })); hm.position.set(0, -0.48, 0.1); arm.add(hm); w.add(arm);
    w.userData.arm = arm; w.userData.ph = i * 0.9; g.add(w); workers.push(w);
  });
  if (to === 6) for (let i = 0; i < 12; i++) { const pk = new T.Mesh(new T.BoxGeometry(X1 - X0, 0.26, (Z1 - Z0) / 12), new T.MeshLambertMaterial({ color: i % 2 ? '#a8794e' : '#9c6f46' })); pk.position.set(XC, -0.13, Z0 + (i + 0.5) * (Z1 - Z0) / 12); pk.visible = false; g.add(pk); planks.push(pk); }
  return { g, workers, hook, planks };
}

/** Sponsor banners: from stage 3 the büfe sponsors the player's club. Banners on the halı saha fences and a club flag
 *  on the pier (restaurant flagpole). Visual tie between the business and the league. */
function buildSponsor(tk: { ad: string; renk: string; renk2?: string }, stage: number): T.Group {
  const g = new T.Group(); g.name = 'sponsor';
  const tx = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const name = stage >= 10 ? 'SABRİ\'NİN SOFRASI' : stage >= 6 ? 'SABRİ RESTORAN' : 'SABRİ\'NİN BÜFESİ';
  const ban = tx(1024, 128, x => { x.fillStyle = tk.renk || '#2f7fb3'; x.fillRect(0, 0, 1024, 128); x.fillStyle = tk.renk2 || '#ffffff'; x.fillRect(0, 100, 1024, 28); x.fillStyle = '#fff'; x.font = '900 64px system-ui,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name + '  ★  ' + tk.ad.toLocaleUpperCase('tr-TR'), 512, 54); });
  const bm = new T.MeshLambertMaterial({ map: ban, side: T.DoubleSide });
  for (const [x, z] of [[-45.5, 36.15], [-33.5, 36.15], [-45.5, 54.65], [-33.5, 54.65]]) { const m = new T.Mesh(new T.PlaneGeometry(9, 1.1), bm); m.position.set(x, 0.75, z); g.add(m); }
  const fl = tx(256, 160, x => { x.fillStyle = tk.renk || '#2f7fb3'; x.fillRect(0, 0, 256, 160); x.fillStyle = tk.renk2 || '#fff'; x.fillRect(0, 60, 256, 40); });
  const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.06, 6, 6), new T.MeshLambertMaterial({ color: '#d6d9de' })); pole.position.set(PIER.x0 + 0.6, 3, 3.6); g.add(pole);
  const flag = new T.Mesh(new T.PlaneGeometry(1.6, 1.0, 8, 1), new T.MeshLambertMaterial({ map: fl, side: T.DoubleSide })); flag.position.set(PIER.x0 + 1.42, 5.4, 3.6); flag.name = 'kflag'; g.add(flag);
  return g;
}
/** Seasonal decor by the real date: national-day flag bunting (23 Nisan, 19 Mayıs, 30 Ağustos, 29 Ekim weeks),
 *  tulips in April (İstanbul lale zamanı), New Year lights and a tree in late December / early January. */
export function mevsim(d = new Date()): 'bayrak' | 'lale' | 'yilbasi' | null {
  const m = d.getMonth() + 1, day = d.getDate(), near = (mm: number, dd: number) => m === mm && Math.abs(day - dd) <= 3;
  if (near(4, 23) || near(5, 19) || near(8, 30) || near(10, 29) || (m === 11 && day <= 1)) return 'bayrak';
  if ((m === 12 && day >= 20) || (m === 1 && day <= 6)) return 'yilbasi';
  if (m === 4) return 'lale';
  return null;
}
function buildMevsim(k: 'bayrak' | 'lale' | 'yilbasi'): T.Group {
  const g = new T.Group(); g.name = 'mevsim-' + k; const b = new Batch(), lit = new Batch();
  if (k === 'bayrak' || k === 'yilbasi') {
    for (const x of [PIER.x0 + 0.3, PIER.x1 - 0.3]) b.cyl(0.06, 0.07, 4.6, '#d6d9de', x, 2.3, 4.0, { seg: 6 });
    const n = 46;
    for (let i = 0; i <= n; i++) { const t = i / n, x = PIER.x0 + 0.3 + (PIER.x1 - PIER.x0 - 0.6) * t, y = 4.4 - Math.sin(t * Math.PI) * 0.9;
      if (k === 'bayrak') { b.cone(0.22, 0.42, i % 2 ? '#e30a17' : '#e30a17', x, y - 0.25, 4.0, { seg: 3, rz: Math.PI }); if (i % 2) b.sph(0.05, '#ffffff', x, y - 0.2, 4.03, { ws: 5, hs: 3 }); }
      else lit.sph(0.08, ['#ff4d4d', '#ffd23f', '#4dd2ff', '#7dff6a', '#ff7ad9'][i % 5], x, y - 0.1, 4.0, { ws: 6, hs: 4 }); }
  }
  if (k === 'yilbasi') { const x = PIER.x0 - 4, z = 8.5; b.cyl(0.15, 0.2, 0.8, '#6b4a2e', x, 0.4, z, { seg: 8 }); for (let i = 0; i < 4; i++) b.cone(1.6 - i * 0.35, 1.3, '#2f7d3a', x, 1.2 + i * 0.85, z, { seg: 10 }); lit.sph(0.22, '#ffd23f', x, 4.6, z, { ws: 8, hs: 6 }); for (let i = 0; i < 24; i++) { const a = i * 2.4, h = 1.0 + (i / 24) * 3.2, r = 1.5 - (i / 24) * 1.2; lit.sph(0.08, ['#ff4d4d', '#ffd23f', '#4dd2ff'][i % 3], x + Math.cos(a) * r, h, z + Math.sin(a) * r, { ws: 5, hs: 3 }); } }
  if (k === 'lale') for (let x = -58; x <= 58; x += 4) { if (x > PIER.x0 - 1 && x < PIER.x1 + 1) continue; b.box(1.6, 0.4, 0.6, '#8a6a4a', x, 0.2, 12.6); for (let i = 0; i < 7; i++) { b.cyl(0.015, 0.015, 0.4, '#3f7a34', x - 0.6 + i * 0.2, 0.6, 12.6, { seg: 4 }); b.sph(0.08, ['#e0533c', '#ffd23f', '#f2a2b3', '#c94f6d'][(i + x) & 3], x - 0.6 + i * 0.2, 0.84, 12.6, { ws: 6, hs: 4, sy: 1.4 } as never); } }
  const M = mats(); if (!b.empty) g.add(b.mesh(M.solid, true, true)); if (!lit.empty) g.add(lit.mesh(M.glow, false, false));
  return g;
}

export function createBufeBuyume(deps: BuyumeDeps): BuyumeView {
  let spon: T.Group | null = null, sponKey = '', mev: T.Group | null = null, mevKey = '';
  let site: ReturnType<typeof buildSite> | null = null, siteTo = 0;
  let built = -1, grp: T.Group | null = null, t = 0;
  const signMats: T.MeshStandardMaterial[] = [], flames: T.Object3D[] = [];
  const clear = () => {
    if (!grp) return; grp.parent?.remove(grp);
    grp.traverse(o => { const m = o as T.Mesh; if (m.geometry) m.geometry.dispose(); if (m.material && signMats.includes(m.material as T.MeshStandardMaterial)) { const mm = m.material as T.MeshStandardMaterial; mm.map?.dispose(); mm.dispose(); } });
    grp = null; signMats.length = 0; flames.length = 0;
  };
  return {
    update(dt) {
      t += dt;
      const root = deps.root(), st = Math.round(deps.stage() || 1);
      if (!root) { if (grp) clear(); built = -1; return; }
      if (st !== built || (grp && grp.parent !== root)) { clear(); built = st; if (st >= 6) { grp = build(st, signMats, flames); root.add(grp); } }
      const td = deps.tadilat?.() ?? null, wantSite = td && td.to >= 6 ? td.to : 0;
      if (wantSite !== siteTo || (site && site.g.parent !== root)) { if (site) { site.g.removeFromParent(); site.g.traverse(o => { (o as T.Mesh).geometry?.dispose(); }); site = null; } siteTo = wantSite; if (wantSite) { site = buildSite(wantSite); root.add(site.g); } }
      if (site && td) {
        for (const w of site.workers) { const arm = w.userData.arm as T.Object3D; arm.rotation.x = -0.6 - Math.max(0, Math.sin(t * 6 + w.userData.ph)) * 1.1; }
        site.hook.rotation.y = Math.sin(t * 0.3) * 0.5; site.hook.children[1].position.y = -6.2 + Math.sin(t * 0.7) * 1.5;
        site.planks.forEach((pk, i) => { pk.visible = i < Math.floor(td.p * site!.planks.length); });
      }
      const tk = deps.takim?.() ?? null, sk = tk && st >= 3 ? tk.ad + tk.renk + (tk.renk2 || '') + (st >= 10 ? 'a' : st >= 6 ? 'b' : 'c') : '';
      if (sk !== sponKey || (spon && spon.parent !== root)) { if (spon) { spon.removeFromParent(); spon = null; } sponKey = sk; if (sk && tk) { spon = buildSponsor(tk, st); root.add(spon); } }
      if (spon) { const f = spon.getObjectByName('kflag') as T.Mesh | null; if (f) { const p = f.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.8; p.setZ(i, Math.sin(t * 3 + x * 2.6) * 0.1 * x); } p.needsUpdate = true; } }
      const mk = mevsim() ?? '';
      if (mk !== mevKey || (mev && mev.parent !== root)) { if (mev) { mev.removeFromParent(); mev = null; } mevKey = mk; if (mk) { mev = buildMevsim(mk as 'bayrak'); root.add(mev); } }
      if (!grp) return;
      const n = deps.night();
      const M = mats(); M.glow.color.setScalar(0.55 + 0.45 * n); M.pool.opacity = 0.75 * n; M.warm.opacity = 0.35 * n;
      for (const s of signMats) s.emissiveIntensity = 0.25 + n * 1.2;
      for (const f of flames) { const k = 0.8 + 0.3 * Math.sin(t * 13 + f.userData.ph) + 0.15 * Math.sin(t * 29 + f.userData.ph * 2); f.scale.set(1, k, 1); }
    },
    dispose() { clear(); },
  };
}
