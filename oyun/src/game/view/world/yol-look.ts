/**
 * Street in front of the pier (owner list item 23): a sidewalk on the büfe side, a 6-lane carriageway
 * (two car lanes each way, one metrobus lane each way in the middle), a pedestrian overpass above the metrobus,
 * a municipal bus stop with a parody name, and vehicles that loop along the road: buses, metrobus, a metro
 * train on a viaduct and a slow ferry on the water line. Pure view: no colliders, not walkable, nav untouched.
 */
import * as T from 'three';
import { zeminDetay } from '../../../engine/render/zemin-detay';
import { loadGlb, fitClone } from './glb';
import { UG, UG_STEPS, ugY } from '../../../content/ustgecit';
import { UST_GECIT } from '../../../content/kilitli-bolge';
import { mergeStatic } from '../../../engine/render/merge-static';
import { dejenereAt } from '../../../engine/render/geo-temiz';
/** deck starts this far in from each top riser (a stair tab fills it): no coplanar faces = no z-fighting */
const UG_DECK_E = 0.02;
const W_UG = UG.hw * 2 + 0.3;

export interface YolLookDeps { root: () => T.Object3D | null; /** üst geçidin orta açıklığı açık mı (content/kilitli-bolge gecitAcik); yoksa hep açık */ gecitAcik?: () => boolean }
export interface YolLookView { update(dt: number): void; dispose(): void }

const Z_WALK = 13.3, Z_KERB = 15.0, LANE = 1.9, ROAD_W = LANE * 6;
const X0 = -62, X1 = 62;
const RX = 62;  // road/sidewalk reach well past the pier ends so no vehicle ever pops in or out of view
const STOP_NAME = 'BETT';
const STREET_Y = 0.35;

const mats = new Map<string, T.Material>();
const lam = (c: string) => { let m = mats.get(c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); mats.set(c, m); } return m; };
const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

function signTex(text: string, bg: string, fg: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = '900 72px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 66, 480);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

function buildRoad(): T.Group {
  const g = new T.Group(); g.name = 'yolRoad';
  const zc = Z_KERB + ROAD_W / 2;
  // sidewalk and kerb
  zeminDetay(lam('#c9c1b0'), { force: 1, ds: 0.7 });
  g.add(box(RX * 2, 0.12, Z_KERB - Z_WALK, lam('#c9c1b0'), 0, 0.02, (Z_WALK + Z_KERB) / 2));
  g.add(box(RX * 2, 0.16, 0.25, lam('#8f8778'), 0, 0.06, Z_KERB));
  // carriageway with lane markings
  { const am = new T.MeshLambertMaterial({ color: '#56595f' }); zeminDetay(am, { force: 0, ds: 0.85 }); g.add(box(RX * 2, 0.08, ROAD_W, am, 0, 0.0, zc)); }
  for (let i = 1; i < 6; i++) {
    if (i === 2 || i === 4) continue;
    g.add(box(RX * 2, 0.09, 0.12, lam('#e9e4d4'), 0, 0.05, Z_KERB + i * LANE));
  }
  // metrobus median: a raised kerb each side with a painted lane
  g.add(box(RX * 2, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 2 * LANE));
  g.add(box(RX * 2, 0.14, 0.2, lam('#d9d2bd'), 0, 0.07, Z_KERB + 4 * LANE));
  // far sidewalk
  g.add(box(RX * 2, 0.12, 2.0, lam('#c9c1b0'), 0, 0.02, Z_KERB + ROAD_W + 1.0));
  return g;
}

const BUSH = new T.IcosahedronGeometry(0.9, 0);
/** Tunnel blocks closing both road ends: vehicles come out of a dark mouth, nothing pops in view. */
function buildPortals(): T.Group {
  const g = new T.Group(); g.name = 'yolTunel';
  const zc = Z_KERB + ROAD_W / 2, zw = ROAD_W + 4.4;
  for (const sg of [-1, 1]) {
    g.add(box(24, 7, zw, lam('#9a9ea4'), sg * (RX + 12), 3.5, zc - 0.5));
    g.add(box(0.3, 3.6, ROAD_W, lam('#0d0f12'), sg * (RX + 0.01), 1.8, zc));
    g.add(box(0.5, 0.5, ROAD_W + 0.8, lam('#5b6068'), sg * (RX + 0.1), 3.85, zc));
    // 2026-11-23: üstten bakınca düz gri kutuydu (bitmemiş gibi): tepesi çimenli toprak sırt + çalılar, ağız kenarında taş başlık
    g.add(box(24.6, 0.5, zw + 0.6, lam('#6f9a52'), sg * (RX + 12), 7.2, zc - 0.5));
    g.add(box(0.6, 0.9, zw + 0.2, lam('#b9b3a6'), sg * (RX + 0.25), 6.6, zc - 0.5));
    const bush = lam('#4f7d3a'); for (let i = 0; i < 9; i++) { const m = new T.Mesh(BUSH, bush); m.position.set(sg * (RX + 3 + (i * 7.3) % 20), 7.55, zc - 0.5 + ((i * 5.1) % zw) - zw / 2 + 0.6); m.scale.setScalar(0.7 + (i % 3) * 0.3); g.add(m); }
  }
  return g;
}

function buildBusStop(): T.Group {
  const g = new T.Group(); g.name = 'yolDurak';
  const x = -20, z = Z_WALK + 0.9;
  [-1.2, 1.2].forEach(dx => g.add(box(0.12, 2.4, 0.12, lam('#5a5f66'), x + dx, 1.2, z)));
  g.add(box(3.0, 0.14, 1.3, lam('#2b9d6a'), x, 2.45, z));
  g.add(box(2.6, 0.9, 0.08, lam('#e9f6f0'), x, 1.6, z - 0.66));
  const sign = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshLambertMaterial({ map: signTex(STOP_NAME + ' DURAĞI', '#2b9d6a', '#fbfaf6') }));
  sign.position.set(x, 2.8, z + 0.02); sign.rotation.y = Math.PI; g.add(sign);
  return g;
}

/** Deck slab, under-beam and edge girders from z0 to z1, railings from r0 to r1 (one piece of the span). */
function deckSpan(g: T.Group, z0: number, z1: number, r0: number, r1: number): void {
  const { x, hw, h } = UG, W = hw * 2 + 0.3, steel = lam('#7b8189'), dark = lam('#5b6068'), rail = lam('#c9ced6');
  const zm = (z0 + z1) / 2, len = z1 - z0, rm = (r0 + r1) / 2, rl = r1 - r0;
  g.add(box(W, 0.3, len, steel, x, h - 0.15, zm));   // PRF-09: no overhang past the top step (it covered the last treads 15 cm above the ramp)
  g.add(box(W, 0.45, len, dark, x, h - 0.6, zm));
  // girders under the deck edges + a light strip so it reads as a bridge from the street
  for (const sg of [-1, 1]) g.add(box(0.18, 0.5, len, dark, x + sg * (hw + 0.05), h - 0.55, zm));
  for (const sg of [-1, 1]) {
    const rx = x + sg * hw;
    g.add(box(0.07, 1.0, rl, rail, rx, h + 0.55, rm));
    g.add(box(0.07, 0.07, rl, rail, rx, h + 1.05, rm));
  }
}

/** Two-line canvas sign with hazard stripes top and bottom (construction notices). */
function noticeTex(l1: string, l2: string, l3: string): T.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 352;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 1024, 352);
  for (const y of [0, 316]) { g.save(); g.beginPath(); g.rect(0, y, 1024, 36); g.clip(); g.fillStyle = '#1d1d1f'; for (let i = -2; i < 30; i++) { g.beginPath(); g.moveTo(i * 48, y + 36); g.lineTo(i * 48 + 24, y + 36); g.lineTo(i * 48 + 60, y); g.lineTo(i * 48 + 36, y); g.fill(); } g.restore(); }
  g.fillStyle = '#1d1d1f'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 104px system-ui, sans-serif'; g.fillText(l1, 512, 112, 980);
  g.font = '800 62px system-ui, sans-serif'; g.fillText(l2, 512, 212, 980);
  g.font = '700 34px system-ui, sans-serif'; g.fillText(l3, 512, 280, 980);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}

/**
 * Üst geçit merdiven gövdesi (yan profil z-y, x boyunca W kalınlık). 2026-11-21: ilk basamak iskele zeminiyle aynı düzlemdeydi
 * (z-fighting); gövde ilk rıhtta başlar, güverte altına 2 cm diller (güverte UG_DECK_E içeriden başlar).
 * 2026-11-22 "iskele tarafındaki ayağı full siyah yanıp sönüyor": basamak burunları tek doğru üzerinde, earcut kapakta sıfır alanlı
 * üçgenler üretiyordu (iskele kolunda 54 köşe, normal = 0). Gerçek GPU'da normalize(0) = NaN, bloom bu pikseli ekran hizalı siyah
 * bloklara yayıyordu (SwiftShader NaN yaymadığından bulutta görünmüyordu). Sıfır alanlı üçgenler atılır (engine/render/geo-temiz).
 */
export function stairSolid(z0: number, z1: number, W: number): T.BufferGeometry {
  const { h } = UG, N = UG_STEPS, rise = h / N, s0 = Math.sign(z1 - z0), u1 = z0 + (z1 - z0) / N, E = UG_DECK_E;
  const sh = new T.Shape(); sh.moveTo(u1, -0.02);
  sh.lineTo(u1, rise);
  for (let i = 2; i <= N; i++) { const u = z0 + (z1 - z0) * i / N; sh.lineTo(u, (i - 1) * rise); sh.lineTo(u, i * rise); }
  sh.lineTo(z1 + s0 * E, h); sh.lineTo(z1 + s0 * E, h - 0.3); sh.lineTo(z1, h - 0.3); sh.lineTo(z1, -0.02); sh.closePath();
  const ex = new T.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false, curveSegments: 1 });
  const geo = dejenereAt(ex); ex.dispose();
  geo.translate(0, 0, -W / 2); geo.rotateY(-Math.PI / 2);
  return geo;
}

/**
 * 2026-11-21 üst geçit inşaatı (content/kilitli-bolge UST_GECIT): the middle span is its own group (shown once the bridge opens);
 * the construction group holds the cut-edge barriers, rebar stubs and the two stair-foot notices. No machines, nothing on the promenade
 * walkway: the notice boards hang 1.9 m up on two posts just outside the stair railings.
 */
function buildGecitInsaat(): { orta: T.Group; insaat: T.Group } {
  const { x, hw, zA, zD, h } = UG, G0 = UST_GECIT.z0, G1 = UST_GECIT.z1;
  const orta = new T.Group(); orta.name = 'ugOrta';
  deckSpan(orta, G0, G1, G0, G1);
  const insaat = new T.Group(); insaat.name = 'ugInsaat';
  const rebar = lam('#8a4b2a'), yel = lam('#ffd23f'), blk = lam('#1d1d1f'), post = lam('#6f747c'), cone = lam('#ff7a1a'), white = lam('#f4f2ec');
  const flash = new T.MeshBasicMaterial({ color: '#ff9a2e' });
  const gecitYok = new T.MeshLambertMaterial({ map: signTex('GEÇİT YOK', '#d8402f', '#fbfaf6') });
  for (const [e, d] of [[G0, 1], [G1, -1]] as const) {
    // rebar stubs out of the cut deck and girders
    for (let i = 0; i < 6; i++) { const r = box(0.035, 0.035, 0.42, rebar, x - 1.0 + i * 0.4, h - 0.12, e + d * 0.2); r.rotation.x = d * 0.12 * ((i % 2) - 0.5); insaat.add(r); }
    for (const sg of [-1, 1]) insaat.add(box(0.035, 0.035, 0.3, rebar, x + sg * (hw + 0.05), h - 0.6, e + d * 0.15));
    // striped barrier across the deck, 0.45 m back from the cut, with a beacon and a leaned "GEÇİT YOK" board
    const bz = e - d * 0.45;
    for (const sg of [-1, 1]) insaat.add(box(0.07, 1.05, 0.07, post, x + sg * 1.0, h + 0.52, bz));
    for (let i = 0; i < 8; i++) insaat.add(box(0.28, 0.24, 0.05, i % 2 ? blk : yel, x - 0.98 + i * 0.28, h + 0.95, bz));
    insaat.add(box(0.12, 0.1, 0.12, flash, x - 1.0, h + 1.12, bz));
    const sb = new T.Mesh(new T.PlaneGeometry(1.5, 0.38), gecitYok); sb.position.set(x, h + 1.32, bz - 0.05); sb.rotation.x = -0.85; insaat.add(sb);
    for (const sg of [-1, 1]) {
      const cz = bz - d * 0.6, cx = x + sg * 0.6;
      const c = new T.Mesh(new T.ConeGeometry(0.14, 0.42, 10), cone); c.position.set(cx, h + 0.21, cz); insaat.add(c);
      insaat.add(box(0.2, 0.04, 0.2, blk, cx, h + 0.02, cz));
      insaat.add(box(0.03, 0.07, 0.03, white, cx, h + 0.24, cz));   // reflective band reads as a white dot from above
    }
  }
  // stair-foot notices, both flights, facing the camera (+z) and leaned back so the top-down view reads them
  const tex = noticeTex('ÜST GEÇİT YAPIMDA', 'Esnaf Seviyesi ' + UST_GECIT.seviye + "'de açılıyor", 'Martıköy Belediyesi · Karşı yakaya geçiş geçici olarak kapalı');
  const nm = new T.MeshLambertMaterial({ map: tex });
  for (const [fz, d] of [[zA + 0.25, 1], [zD - 0.25, -1]] as const) {
    for (const sg of [-1, 1]) insaat.add(box(0.08, 2.75, 0.08, post, x + sg * (hw + 0.16), 1.375, fz));
    insaat.add(box(W_UG + 0.1, 0.06, 0.08, post, x, 2.72, fz));
    const b = new T.Mesh(new T.PlaneGeometry(2.6, 0.9), nm); b.position.set(x, 2.3, fz + 0.12 * d); b.rotation.x = -0.75; insaat.add(b);
  }
  return { orta, insaat };
}

function buildOverpass(): T.Group {
  const g = new T.Group(); g.name = 'yolUstGecit';
  const { x, hw, zA, zB, zC, zD, h } = UG, W = hw * 2 + 0.3, rail = lam('#c9ced6');
  // the span in three pieces: stair end A, the middle (its own group, shown when the bridge opens), stair end C
  deckSpan(g, zB + UG_DECK_E, UST_GECIT.z0, zB - 0.2, UST_GECIT.z0);
  deckSpan(g, UST_GECIT.z1, zC - UG_DECK_E, UST_GECIT.z1, zC + 0.2);
  // two flights of real steps (PRF-09). The walking ramp ugY runs through every nosing, so a foot is never inside a step:
  // at most one rise (18 cm) above the tread behind it. The old wedge + loose tread ribs stuck 17 cm out of the ramp and the
  // whole bridge sat 0.35 m up with the street group: that was "merdivenden çıkarken içine gömülüyoruz" (2026-11-09).
  const N = UG_STEPS, rise = h / N, nose = lam('#5b6068');
  const flight = (z0: number, z1: number) => {
    const geo = stairSolid(z0, z1, W);
    const stairs = new T.Mesh(geo, lam('#8a9097')); stairs.position.x = x; stairs.castShadow = true; stairs.receiveShadow = true; g.add(stairs);
    // dark anti-slip strip just behind each nosing (1 cm, inside the 2 cm foot tolerance)
    const s = Math.sign(z1 - z0);
    for (let i = 1; i < N; i++) { const u = z0 + (z1 - z0) * i / N; g.add(box(W - 0.12, 0.01, 0.06, nose, x, i * rise + 0.005, u + s * 0.035)); }
  };
  flight(zA, zB); flight(zD, zC);
  // pillars only on the two pavements (deck span 11.8 m). The median pillars stood on the lane lines and the 1.7 m buses in
  // 1.9 m lanes brushed them ("otobüsler hala değiyor", 2026-11-09); tests/unit/yol/arac-yol.test.ts keeps every lane clear.
  for (const z of [zB + 0.2, zC - 0.2]) for (const sg of [-1, 1]) g.add(box(0.34, h - 0.75, 0.34, lam('#6f747c'), x + sg * (hw - 0.1), (h - 0.75) / 2, z));
  // railings following both flights (the deck's own railings are in deckSpan)
  for (const sg of [-1, 1]) {
    const rx = x + sg * hw;
    for (const [z0, z1] of [[zA, zB], [zD, zC]]) {
      const dz = z1 - z0, dy = h, L = Math.hypot(dz, dy), ang = Math.atan2(dy, Math.abs(dz)) * Math.sign(dz) * -1;
      for (const yy of [0.55, 1.05]) { const r = box(0.07, 0.07, L, rail, rx, h / 2 + yy, (z0 + z1) / 2); r.rotation.x = ang; g.add(r); }
      for (let i = 0; i <= 4; i++) { const t = i / 4, zz = z0 + dz * t; g.add(box(0.06, 0.9, 0.06, rail, rx, ugY(x, zz) + 0.45, zz)); }
    }
  }
  // sign over the stairs
  const sgn = new T.Mesh(new T.PlaneGeometry(1.8, 0.45), new T.MeshLambertMaterial({ map: signTex('ÜST GEÇİT', '#2b6fb8', '#fbfaf6') }));
  sgn.position.set(x, h + 1.7, zB + 0.2); g.add(sgn);
  return g;
}

type Vehicle = { mesh: T.Object3D; lane: number; speed: number; off: number; dir: 1 | -1; kind: 'bus' | 'metrobus' | 'car' };

const cyl = (rt: number, rb: number, h: number, m: T.Material, x: number, y: number, z: number, axis: 'x' | 'z' = 'z') => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, 14), m); o.rotation.x = axis === 'z' ? Math.PI / 2 : 0; o.position.set(x, y, z); return o; };
const GLASS = () => lam('#2a3a4c'), TYRE = () => lam('#17181b'), HUB = () => lam('#b9bec6');
const glow = (c: string) => { const k = 'glow' + c; let m = mats.get(k); if (!m) { m = new T.MeshBasicMaterial({ color: c }); mats.set(k, m); } return m; };
/** Wheels (axles at xs), headlights at the +x front, tail lights at the back; the model faces +x. */
function wheels(g: T.Group, len: number, wid: number, r: number, xs: number[]) {
  // PRF-09: tyres tucked 0.2 m under the body so nothing below the skirt pokes past the lane (kerb and medians are 14 cm high)
  for (const x of xs) for (const sg of [-1, 1]) { g.add(cyl(r, r, 0.31, TYRE(), x, r, sg * (wid / 2 - 0.2))); g.add(cyl(r * 0.5, r * 0.5, 0.32, HUB(), x, r, sg * (wid / 2 - 0.2))); }
  for (const sg of [-1, 1]) { g.add(box(0.06, 0.2, 0.34, glow('#fff3c4'), len / 2 + 0.01, r + 0.5, sg * (wid / 2 - 0.35))); g.add(box(0.06, 0.2, 0.3, glow('#ff3b30'), -len / 2 - 0.01, r + 0.5, sg * (wid / 2 - 0.3))); }
}
/** City bus (and metrobus when len is long): body, window band with pillars, roof unit, doors, wheels, destination sign. */
function busBody(c: string, len: number, label: string): T.Group {
  const b = new T.Group(), wid = 1.7, H = 2.9, r = 0.5;   // 2026-11-09 user: buses still touch: a lane is 1.9 m, so vehicles stay under 1.7 m wide
  b.add(box(len, 0.28, wid - 0.1, lam('#2b2d31'), 0, r + 0.1, 0));                       // chassis skirt
  b.add(box(len, H - 0.9, wid, lam(c), 0, 0.9 + (H - 0.9) / 2, 0));                       // body
  b.add(box(len - 0.2, 0.2, wid - 0.15, lam('#f4f2ec'), 0, H + 0.1, 0));                  // roof cap
  b.add(box(len * 0.34, 0.2, wid * 0.55, lam('#d9dde2'), -len * 0.15, H + 0.3, 0));        // AC unit
  for (const sg of [-1, 1]) {
    b.add(box(len - 0.9, 0.95, 0.05, GLASS(), -0.1, 2.25, sg * (wid / 2 + 0.015)));         // side windows
    const n = Math.floor((len - 1.2) / 1.5);
    for (let i = 1; i < n; i++) b.add(box(0.1, 1.0, 0.07, lam(c), -len / 2 + 0.6 + i * ((len - 1.2) / n), 2.25, sg * (wid / 2 + 0.02)));
    b.add(box(1.0, 1.9, 0.08, lam('#cfd8df'), len / 2 - 2.0, 1.55, sg * (wid / 2 + 0.036)));  // door (2026-11-21: proud of the window and stripe, no coplanar faces)
    b.add(box(len - 0.8, 0.1, 0.06, lam('#ffffff'), -0.1, 1.0, sg * (wid / 2 + 0.02)));      // stripe
  }
  b.add(box(0.05, 1.15, wid - 0.3, GLASS(), len / 2 + 0.015, 2.0, 0));                     // windscreen
  b.add(box(0.06, 0.3, 1.2, glow('#ffb347'), len / 2 + 0.02, 2.85, 0));                    // route sign
  b.add(box(0.05, 0.9, wid - 0.4, GLASS(), -len / 2 - 0.015, 2.1, 0));                     // rear window
  b.add(box(0.1, 0.25, wid, lam('#2b2d31'), len / 2 + 0.03, 0.75, 0));                     // front bumper
  const tx = signTex(label, '#111', '#ffb347'); const sg2 = new T.Mesh(new T.PlaneGeometry(1.1, 0.28), new T.MeshBasicMaterial({ map: tx })); sg2.position.set(len / 2 + 0.055, 2.85, 0); sg2.rotation.y = Math.PI / 2; b.add(sg2);
  wheels(b, len, wid, r, len > 7 ? [len / 2 - 1.4, 0, -len / 2 + 1.4] : [len / 2 - 1.3, -len / 2 + 1.5]);
  return b;
}
/** Small car: lower body, glass cabin, wheels. */
function carBody(c: string): T.Group {
  const b = new T.Group(), len = 4.0, wid = 1.6, r = 0.34;
  b.add(box(len, 0.6, wid, lam(c), 0, r + 0.3, 0));
  b.add(box(len * 0.5, 0.55, wid - 0.15, lam(c), -0.2, r + 0.85, 0));
  for (const sg of [-1, 1]) b.add(box(len * 0.44, 0.38, 0.04, GLASS(), -0.2, r + 0.88, sg * (wid / 2 - 0.05)));
  b.add(box(0.05, 0.38, wid - 0.35, GLASS(), len * 0.25 - 0.18, r + 0.88, 0));
  b.add(box(0.05, 0.38, wid - 0.35, GLASS(), -len * 0.25 - 0.22, r + 0.88, 0));
  wheels(b, len, wid, r, [len / 2 - 0.9, -len / 2 + 0.85]);
  return b;
}

function buildVehicles(): { group: T.Group; list: Vehicle[] } {
  const group = new T.Group(); group.name = 'yolArac';
  const list: Vehicle[] = [];
  const laneZ = (i: number) => Z_KERB + (i + 0.5) * LANE;
  // lanes: 0,1 east cars, 2 east metrobus, 3 west metrobus, 4,5 west cars. One constant speed per lane + fixed spacing: nothing overlaps or overtakes.
  const LS = [7, 9, 10, 10, 9, 7], SPACE = 36, COLORS = ['#2f9d59', '#ffd23f', '#3f7fd0', '#e0533c', '#f4f2ec', '#8a5fd0', '#2fb5b0'];
  // Kenney car models replace the box cars once loaded (the box body stays when a file is missing); PRF-15: the box body's merged
  // geometry (its own buffer, already uploaded) is freed when the model takes over
  // 2026-11-25 tek tip görünüm: KayKit City Builder Bits arabaları (CC0, modeller/auto/kk-*); Kenney arabaları yalnız ambulansta kaldı
  const CARS = ['kk-taxi', 'kk-sedan', 'kk-hatchback', 'kk-stationwagon', 'kk-sedan', 'kk-hatchback', 'kk-taxi', 'kk-stationwagon', 'kk-police'];
  const skin = (g: T.Group, k: number) => { loadGlb('auto/' + CARS[k % CARS.length]).then(src => { if (!src) return; g.traverse(o => { if (o.name.endsWith(':birlesik')) (o as T.Mesh).geometry.dispose(); }); g.clear(); g.add(fitClone(src, 1.6, 4.0, undefined, CAR_YAW)); }); return g; };
  const add = (mesh: T.Object3D, lane: number, off: number, kind: Vehicle['kind']) => { mesh.position.set(X0 - 200, 0, laneZ(lane)); if (lane >= 3) mesh.rotation.y = Math.PI; group.add(mesh); list.push({ mesh, lane, speed: LS[lane], off, dir: lane >= 3 ? -1 : 1, kind }); };
  let ci = 0;
  for (const lane of [0, 1, 4, 5]) for (let k = 0; k < SPAN_V / SPACE; k++) { const bus = (k + lane) % 3 === 0; add(bus ? busBody(COLORS[ci++ % 3], 8.2, '42B') : skin(carBody(COLORS[ci % COLORS.length]), ci++), lane, k * SPACE + lane * 7, bus ? 'bus' : 'car'); }
  for (const lane of [2, 3]) for (let k = 0; k < 2; k++) add(busBody('#e0533c', 14.5, 'MB'), lane, k * (SPAN_V / 2) + lane * 20, 'metrobus');
  return { group, list };
}
const SPAN_V = 144;
const CAR_YAW = Math.PI / 2;   // Kenney cars face +z, the lane vehicles face +x

export function createYolLook(d: YolLookDeps): YolLookView {
  const road = buildRoad(), stop = buildBusStop(), bridge = buildOverpass();
  const { group: vehicles, list } = buildVehicles();
  // PRF-06: the street parts never move relative to their group: one draw per material (vehicles move as whole groups)
  const portals = buildPortals();
  const { orta, insaat } = buildGecitInsaat();
  for (const g of [road, stop, bridge, portals, orta, insaat]) mergeStatic(g);
  bridge.add(orta, insaat);   // after the bridge merge: both toggle as whole groups
  let gecitGoster: boolean | null = null;
  for (const v of list) mergeStatic(v.mesh);
  const holder = new T.Group(); holder.name = 'yolKok';
  holder.position.y = STREET_Y;
  bridge.position.y = -STREET_Y;   // PRF-09: UG is in world metres (promenade y 0); the rest of the street sits 0.35 m up
  holder.add(road, stop, bridge, vehicles, portals);
  let t = 0;
  return {
    update(dt) {
      const root = d.root();
      if (!root) return;
      if (holder.parent !== root) root.add(holder);
      const ac = d.gecitAcik ? d.gecitAcik() : true;
      if (ac !== gecitGoster) { orta.visible = ac; insaat.visible = !ac; gecitGoster = ac; }
      t += dt;
      for (const v of list) {
        const p = ((v.off + v.speed * t) % SPAN_V + SPAN_V) % SPAN_V;
        v.mesh.position.x = v.dir === 1 ? X0 - 10 + p : X1 + 10 - p;
      }
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
