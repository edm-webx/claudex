/**
 * Ortak stadyum modülü (FUT-08/09): maç sahnesi (ui/hali-saha-3d.ts) ve dünyadaki stadyum (view/stadyum/index.ts) aynı
 * tribünü, koltuğu, taraftarı, panoyu ve ışık direğini buradan kurar; iki yerde iki ayrı "dandik" tribün olmaz
 * (sahip 2026-11-08: "görseli çevresi taraftarı asla kalitesiz ve dandik duramaz").
 * - Tribün: basamaklı beton profil tek extrude ağ, merdiven boşlukları, ön cam korkuluk, yan/arka duvar, isteğe bağlı çatı.
 * - Taraftar: düşük poligonlu gövde (bacak, gövde, kol, baş, saç/şapka/atkı), 8 varyant, varyant başına bir InstancedMesh.
 *   Oturma, ayağa kalkma, el çırpma, kol kaldırma, atkı sallama ve zıplama vertex shader'da (kare başı CPU matris yükü yok);
 *   heyecan ve takım coşkusu yalnız uniform. Doluluk = her varyantta öncelik sırasına dizili örneklerin `count`'u.
 * - Panolar: yalnız parodi markalar (gerçek marka yok).
 */
import * as T from 'three';
import { dejenereAt } from '../../../engine/render/geo-temiz';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const REKLAM = ['KOLAZ', 'BOĞAZ GAZOZU', 'AYRANBEY', 'MARTI SU', 'MARTIKART', "SABRİ'NİN BÜFESİ", 'NARÇİÇEK'];
export const REKLAM_RENK: Record<string, [string, string]> = {
  'KOLAZ': ['#b3262a', '#ffffff'], 'BOĞAZ GAZOZU': ['#1f6fb2', '#ffe9a8'], 'AYRANBEY': ['#f4f1e8', '#1f5aa8'], 'MARTI SU': ['#2aa7c9', '#ffffff'],
  'MARTIKART': ['#2b2f6b', '#ffd23f'], "SABRİ'NİN BÜFESİ": ['#e0533c', '#fff4dc'], 'NARÇİÇEK': ['#7d2b5a', '#ffd6e8'],
};

/** Disposal collector shared by both scenes. */
export interface Kit {
  geo<G extends T.BufferGeometry>(g: G): G;
  mat(c: string, extra?: T.MeshStandardMaterialParameters): T.MeshStandardMaterial;
  keep<X extends { dispose(): void }>(x: X): X;
  canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): T.CanvasTexture;
  dispose(): void;
}
export function createKit(): Kit {
  const all: { dispose(): void }[] = [];
  const keep = <X extends { dispose(): void }>(x: X) => { all.push(x); return x; };
  return {
    keep, geo: g => keep(g),
    mat: (c, extra = {}) => keep(new T.MeshStandardMaterial({ color: c, roughness: 0.8, ...extra })),
    canvas(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')!, w, h); const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return keep(t); },
    dispose() { for (const d of all) { try { d.dispose(); } catch { /* */ } } all.length = 0; },
  };
}

/** quality tier for scenes that are not handed one: ?tier= > saved setting (engine/quality key 'marti-quality') > dengeli */
export type Tier = 'akici' | 'dengeli' | 'sahane';
export function tierNow(t?: Tier): Tier {
  if (t) return t;
  const ok = (v: unknown): v is Tier => v === 'akici' || v === 'dengeli' || v === 'sahane';
  try { const u = new URLSearchParams(location.search).get('tier'); if (ok(u)) return u; } catch { /* */ }
  try { const s = JSON.parse(localStorage.getItem('marti-quality') || '{}'); const v = s.setting !== 'auto' ? s.setting : s.autoTier; if (ok(v)) return v; } catch { /* */ }
  return 'dengeli';
}

/** Merges boxes (and other indexed geometries) per material: one draw call per material for a whole building. */
export function boxBatch(kit: Kit) {
  const by = new Map<T.Material, T.BufferGeometry[]>();
  const put = (m: T.Material, g: T.BufferGeometry) => { let l = by.get(m); if (!l) by.set(m, l = []); l.push(g); };
  return {
    box(m: T.Material, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0) { const g = new T.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); put(m, g); },
    cyl(m: T.Material, r: number, h: number, x: number, y: number, z: number, seg = 10, r2 = r) { const g = new T.CylinderGeometry(r, r2, h, seg); g.translate(x, y, z); put(m, g); },
    add: put,
    flush(parent: T.Object3D, shadow = true) { const out: T.Mesh[] = []; for (const [m, l] of by) { const mesh = new T.Mesh(kit.geo(mergeGeometries(l)), m); mesh.castShadow = shadow; mesh.receiveShadow = true; parent.add(mesh); out.push(mesh); l.forEach(g => g.dispose()); } by.clear(); return out; },
  };
}

const FONT = 'system-ui,"Segoe UI",Roboto,sans-serif';
/** Parody ad board / LED panel texture: dark frame, brand colours, big readable text. */
export function panoDoku(kit: Kit, txt: string, w = 512, h = 96): T.CanvasTexture {
  const [bg, fg] = REKLAM_RENK[txt] ?? ['#1d2a44', '#ffffff'];
  return kit.canvas(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = `900 ${Math.round(h * 0.56)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, w / 2, h * 0.54, w * 0.92);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
}
/** Long scrolling LED ribbon: brands separated by dots on black; the caller animates texture.offset.x. */
export function ledDoku(kit: Kit, items: string[]): T.CanvasTexture {
  const t = kit.canvas(2048, 64, (g, w, h) => {
    g.fillStyle = '#07090d'; g.fillRect(0, 0, w, h);
    g.font = `800 40px ${FONT}`; g.textBaseline = 'middle';
    let x = 20, i = 0;
    while (x < w) { const s = items[i % items.length]; const [, fg] = REKLAM_RENK[s] ?? ['', '#ffd23f']; g.fillStyle = fg === '#ffffff' ? '#ffe9a8' : fg; g.fillText(s, x, h / 2 + 2); x += g.measureText(s).width + 30; g.fillStyle = '#ff7a3c'; g.fillText('•', x, h / 2 + 2); x += 46; i++; }
  });
  t.wrapS = T.RepeatWrapping; return t;
}

// ───────────────────────── tribün ─────────────────────────
export interface Seat { x: number; y: number; z: number; rotY: number; col: number; row: number; stand: number }
export interface StandSpec {
  len: number; rows: number; depth?: number; rise?: number; base?: number;
  /** seat columns every `pitch` m; a stair aisle every `aisle` columns (0 = none) */
  pitch?: number; aisle?: number;
  concrete?: string; roof?: boolean; roofH?: number; backWall?: number; railing?: boolean; id?: number;
}
export interface StandOut { group: T.Group; seats: Seat[]; roof: T.Mesh[]; top: number; back: number }

const tmpV = new T.Vector3(), tmpQ = new T.Quaternion(), tmpS = new T.Vector3(1, 1, 1), tmpM4 = new T.Matrix4(), UP = new T.Vector3(0, 1, 0);

/**
 * Builds a stand in local frame (front edge on z = 0, rows rise toward -z, seats face +z), then places it at (x, z, rotY).
 * Seats are returned in the parent's frame so one InstancedMesh can hold every stand's seats and fans.
 */
export function buildStand(kit: Kit, parent: T.Object3D, s: StandSpec, place: { x: number; y?: number; z: number; rotY: number }): StandOut {
  const depth = s.depth ?? 0.85, rise = s.rise ?? 0.5, base = s.base ?? 0.6, pitch = s.pitch ?? 0.62, aisle = s.aisle ?? 12;
  const g = new T.Group(); g.position.set(place.x, place.y ?? 0, place.z); g.rotation.y = place.rotY; parent.add(g);
  const conc = kit.mat(s.concrete ?? '#8b9099', { roughness: 0.92 });
  // stepped profile (u = away from the pitch, v = up), extruded along the stand length
  const sh = new T.Shape(); sh.moveTo(0, 0); sh.lineTo(0, base);
  for (let r = 0; r < s.rows; r++) { const v = base + r * rise; sh.lineTo(r * depth, v); sh.lineTo((r + 1) * depth, v); if (r < s.rows - 1) sh.lineTo((r + 1) * depth, v + rise); }
  const top = base + (s.rows - 1) * rise, back = s.rows * depth;
  sh.lineTo(back, 0); sh.lineTo(0, 0);
  const ex = kit.geo(dejenereAt(new T.ExtrudeGeometry(sh, { depth: s.len, bevelEnabled: false })));   // basamak burunları tek doğruda: earcut sıfır alanlı üçgen = NaN normal (geo-temiz)
  ex.rotateY(Math.PI / 2); ex.translate(-s.len / 2, 0, 0);   // extrude axis -> local x, profile u -> local -z
  const tier = new T.Mesh(ex, conc); tier.receiveShadow = true; tier.castShadow = true; g.add(tier);
  // painted step nosing (yellow safety line) and stair aisles as lighter strips
  const parts: T.BufferGeometry[] = [];
  const cols = Math.floor((s.len - 0.6) / pitch), x0 = -((cols - 1) * pitch) / 2;
  const aisleCols = new Set<number>(); if (aisle > 0) for (let c = Math.floor(aisle / 2); c < cols; c += aisle + 1) aisleCols.add(c);
  for (let r = 0; r < s.rows; r++) { const b = new T.BoxGeometry(s.len, 0.03, 0.06); b.translate(0, base + r * rise + 0.016, -r * depth - 0.03); parts.push(b); }
  for (const c of aisleCols) for (let r = 0; r < s.rows - 1; r++) {   // half-height stair step on the back half of each row inside the aisle
    const b = new T.BoxGeometry(pitch * 0.9, rise / 2, depth / 2); b.translate(x0 + c * pitch, base + r * rise + rise / 4, -(r + 0.75) * depth); parts.push(b);
  }
  if (parts.length) { const m = new T.Mesh(kit.geo(mergeGeometries(parts)), kit.mat('#c9b45a', { roughness: 0.7 })); m.receiveShadow = true; g.add(m); parts.forEach(p => p.dispose()); }
  // side walls (profile with a sloped top) and the back wall
  const sw = new T.Shape(); sw.moveTo(0, 0); sw.lineTo(0, base + 0.95); sw.lineTo(back, top + 1.25); sw.lineTo(back, 0); sw.lineTo(0, 0);
  const swg = kit.geo(dejenereAt(new T.ExtrudeGeometry(sw, { depth: 0.25, bevelEnabled: false }))); swg.rotateY(Math.PI / 2);
  const wallM = kit.mat(s.concrete ? s.concrete : '#9aa0a8', { roughness: 0.9 });
  for (const sx of [-1, 1]) { const w = new T.Mesh(swg, wallM); w.position.x = sx > 0 ? s.len / 2 : -s.len / 2 - 0.25; w.castShadow = true; w.receiveShadow = true; g.add(w); }
  const bw = s.backWall ?? 1.4;
  const backM = new T.Mesh(kit.geo(new T.BoxGeometry(s.len + 0.5, top + bw, 0.3)), wallM); backM.position.set(0, (top + bw) / 2, -back - 0.15); backM.castShadow = true; backM.receiveShadow = true; g.add(backM);
  // front wall + glass rail with a steel top tube
  const steel = kit.mat('#b9c0c8', { metalness: 0.7, roughness: 0.35 });
  if (s.railing !== false) {
    const glass = kit.mat('#bcd6e6', { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1, depthWrite: false });
    const gl = new T.Mesh(kit.geo(new T.BoxGeometry(s.len, 0.75, 0.03)), glass); gl.position.set(0, base + 0.4, 0.03); g.add(gl);
    const tube = new T.Mesh(kit.geo(new T.BoxGeometry(s.len, 0.06, 0.07)), steel); tube.position.set(0, base + 0.8, 0.03); g.add(tube);
  }
  const roof: T.Mesh[] = [];
  if (s.roof) {
    const rh = s.roofH ?? top + 3.4, over = back + 1.2;
    const roofM = kit.mat('#8d959f', { metalness: 0.4, roughness: 0.6, side: T.DoubleSide, transparent: true, opacity: 1 });
    const slab = new T.Mesh(kit.geo(new T.BoxGeometry(s.len + 1.2, 0.16, over)), roofM); slab.position.set(0, rh, -back + over / 2 - 0.4); slab.rotation.x = -0.06; slab.castShadow = true; g.add(slab); roof.push(slab);
    const fascia = new T.Mesh(kit.geo(new T.BoxGeometry(s.len + 1.2, 0.55, 0.12)), kit.mat('#2a3140', { roughness: 0.6, transparent: true, opacity: 1 })); fascia.position.set(0, rh + 0.08 - Math.sin(0.06) * over / 2, 0.75); g.add(fascia); roof.push(fascia);
    const colM = kit.mat('#5d6672', { metalness: 0.6, roughness: 0.45, transparent: true, opacity: 1 });
    const n = Math.max(2, Math.round(s.len / 9));
    for (let i = 0; i <= n; i++) {
      const x = -s.len / 2 + i * s.len / n;
      const c = new T.Mesh(kit.geo(new T.BoxGeometry(0.28, rh, 0.28)), colM); c.position.set(x, rh / 2, -back - 0.45); c.castShadow = true; g.add(c); roof.push(c);
      const beam = new T.Mesh(kit.geo(new T.BoxGeometry(0.16, 0.34, over)), colM); beam.position.set(x, rh - 0.24, -back + over / 2 - 0.4); beam.rotation.x = -0.06; g.add(beam); roof.push(beam);
    }
  }
  // seats in parent frame
  const seats: Seat[] = [];
  g.updateMatrix(); tmpQ.setFromAxisAngle(UP, place.rotY);
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < cols; c++) {
    if (aisleCols.has(c)) continue;
    tmpV.set(x0 + c * pitch, base + r * rise, -r * depth - depth * 0.55).applyMatrix4(g.matrix);
    seats.push({ x: tmpV.x, y: tmpV.y, z: tmpV.z, rotY: place.rotY, col: c, row: r, stand: s.id ?? 0 });
  }
  return { group: g, seats, roof, top, back };
}

/** Plastic bucket seats for every seat, one InstancedMesh (colour per seat). */
export function buildSeats(kit: Kit, parent: T.Object3D, seats: Seat[], color: (s: Seat, i: number) => string): T.InstancedMesh {
  const pad = new T.BoxGeometry(0.46, 0.07, 0.4); pad.translate(0, 0.43, 0.02);
  const bk = new T.BoxGeometry(0.46, 0.42, 0.06); bk.translate(0, 0.66, -0.2);
  const leg = new T.BoxGeometry(0.08, 0.4, 0.3); leg.translate(0, 0.2, -0.04);
  const geo = kit.geo(mergeGeometries([pad, bk, leg])); [pad, bk, leg].forEach(g => g.dispose());
  const im = new T.InstancedMesh(geo, kit.mat('#ffffff', { roughness: 0.55 }), Math.max(1, seats.length));
  const c = new T.Color();
  seats.forEach((s, i) => { tmpQ.setFromAxisAngle(UP, s.rotY); tmpV.set(s.x, s.y, s.z); im.setMatrixAt(i, tmpM4.compose(tmpV, tmpQ, tmpS)); im.setColorAt(i, c.set(color(s, i))); });
  im.count = seats.length; im.receiveShadow = true; parent.add(im);
  return im;
}

// ───────────────────────── taraftar ─────────────────────────
/** a seat with a fan: team 0 home, 1 away, 2 neutral; shirt colour already chosen by the caller (tifo, kits, neutrals) */
export interface FanSeat extends Seat { team: 0 | 1 | 2; shirt: string; acc: string }
export interface Crowd { meshes: T.InstancedMesh[]; total: number; setFill(f: number): void; update(dt: number, o: { heat: number; cheer: [number, number] }): void }

const SKINS = ['#f1c9a5', '#e2b48c', '#c98f66', '#a8714c', '#7d5236'];
const HAIRS = ['#1f1813', '#3a2416', '#6b4a2a', '#2a2a2a', '#8a7a6a', '#b48a4a'];
const PANTS = ['#2f3e5c', '#22252b', '#4a4f57', '#6a5d48', '#34485e'];
type Var = { w: number; hat: 0 | 1 | 2; scarf: 0 | 1 | 2; long: boolean; hair: string; pants: string };
const VARS: Var[] = [
  { w: 1.0, hat: 0, scarf: 1, long: false, hair: HAIRS[0], pants: PANTS[0] },
  { w: 1.12, hat: 1, scarf: 0, long: true, hair: HAIRS[1], pants: PANTS[1] },
  { w: 0.92, hat: 0, scarf: 2, long: false, hair: HAIRS[2], pants: PANTS[2] },
  { w: 1.05, hat: 2, scarf: 1, long: true, hair: HAIRS[3], pants: PANTS[3] },
  { w: 0.95, hat: 0, scarf: 0, long: false, hair: HAIRS[4], pants: PANTS[4] },
  { w: 1.18, hat: 0, scarf: 2, long: true, hair: HAIRS[3], pants: PANTS[1] },
  { w: 0.9, hat: 1, scarf: 1, long: false, hair: HAIRS[5], pants: PANTS[0] },
  { w: 1.02, hat: 0, scarf: 0, long: true, hair: HAIRS[0], pants: PANTS[2] },
];
// part: 0 skin, 1 shirt, 2 pants (geometry colour), 3 accent (scarf/hat), 4 fixed (hair, shoes); seg: 0 upper, 1 thigh, 2 shin, 3 arm L, 4 arm R, 5 held scarf
function fanGeo(v: Var): T.BufferGeometry {
  const list: T.BufferGeometry[] = [];
  const add = (g: T.BufferGeometry, x: number, y: number, z: number, part: number, seg: number, col = '#ffffff') => {
    g.translate(x, y, z); const n = g.attributes.position.count; const c = new T.Color(col);
    const ps = new Float32Array(n * 2), cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { ps[i * 2] = part; ps[i * 2 + 1] = seg; cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b; }
    g.setAttribute('aPS', new T.BufferAttribute(ps, 2)); g.setAttribute('color', new T.BufferAttribute(cc, 3));
    if (g.index) { const ng = g.toNonIndexed(); g.dispose(); list.push(ng); } else list.push(g);
  };
  const B = (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d);
  // ~180 triangles per fan: boxes only (blocky like the rest of the crowd style), no hidden neck/hands
  const tw = 0.36 * v.w;
  for (const sx of [-1, 1]) {
    add(B(0.12, 0.08, 0.24), sx * 0.09, 0.04, 0.05, 4, 2, '#1d1d1f');            // shoe
    add(B(0.12, 0.42, 0.13), sx * 0.09, 0.29, 0, 2, 2, v.pants);                  // shin
    add(B(0.15 * v.w, 0.44, 0.16), sx * 0.09 * v.w, 0.69, 0, 2, 1, v.pants);       // thigh
  }
  add(B(tw, 0.14, 0.2), 0, 0.92, 0, 2, 0, v.pants);                               // pelvis
  add(B(tw + 0.02, 0.56, 0.23), 0, 1.25, 0, 1, 0);                                // torso
  add(B(0.21, 0.24, 0.22), 0, 1.65, 0.01, 0, 0);                                  // head
  if (v.hat === 1) { add(B(0.23, 0.08, 0.23), 0, 1.8, 0, 3, 0); add(B(0.21, 0.025, 0.12), 0, 1.77, 0.15, 3, 0); }   // cap + peak
  else if (v.hat === 2) add(B(0.235, 0.12, 0.235), 0, 1.78, 0, 3, 0);             // beanie
  else add(B(0.225, 0.07, 0.235), 0, 1.79, -0.005, 4, 0, v.hair);                 // hair
  if (v.scarf === 1) add(B(tw * 0.8, 0.08, 0.27), 0, 1.5, 0, 3, 0);               // scarf round the neck
  const ax = tw / 2 + 0.06;
  for (const sx of [-1, 1]) {
    const seg = sx < 0 ? 3 : 4;
    add(B(0.11, 0.3, 0.12), sx * ax, 1.33, 0, 1, seg);                           // sleeve (upper arm)
    add(B(0.09, 0.36, 0.1), sx * ax, 1.0, 0, v.long ? 1 : 0, seg);               // forearm + hand
  }
  if (v.scarf === 2) add(B(ax * 2, 0.15, 0.02), 0, 0.86, 0.07, 3, 5);             // scarf held in both hands
  const g = mergeGeometries(list); list.forEach(x => x.dispose());
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

const FAN_VERT_HEAD = `
attribute vec2 aPS; attribute vec3 aShirt; attribute vec3 aSkin; attribute vec3 aAcc; attribute vec4 aInfo;
uniform float uTime; uniform float uHeat; uniform vec2 uCheer; uniform float uAnim;
vec3 fanRotX(vec3 p, vec3 o, float a) { vec3 q = p - o; float c = cos(a), s = sin(a); return o + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); }
vec3 fanRotXn(vec3 n, float a) { float c = cos(a), s = sin(a); return vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c); }
`;
const FAN_POSE = `
float fPh = aInfo.x, fTeam = aInfo.y, fT = uTime * uAnim;
float fCh = fTeam < 0.5 ? uCheer.x : (fTeam < 1.5 ? uCheer.y : max(uCheer.x, uCheer.y) * 0.35);
float fE = clamp(uHeat * aInfo.z + fCh, 0.0, 1.6);
float fStand = smoothstep(0.42, 0.78, fE + aInfo.w + 0.1 * sin(fT * 0.37 + fPh * 3.0));
float fSit = 1.0 - fStand;
float fRaise = smoothstep(0.72, 1.05, fE + 0.22 * sin(fT * 1.3 + fPh));
float fClap = smoothstep(0.22, 0.5, fE) * (1.0 - fRaise);
float fArm = mix(mix(0.55 * fSit, 1.2 + 0.16 * sin(fT * 13.0 + fPh), fClap), 2.75 + 0.14 * sin(fT * 6.0 + fPh), fRaise);
float fSeg = aPS.y;
float fThigh = -fSit * 1.5708;
float fHop = max(0.0, sin(fT * 9.0 + fPh)) * 0.18 * smoothstep(0.55, 1.0, fCh) * fStand;
`;

/** Instanced crowd. Seats must already carry team and shirt colours. */
export function createCrowd(kit: Kit, parent: T.Object3D, seats: FanSeat[], o: { seed?: number } = {}): Crowd {
  let rs = (o.seed ?? 7) >>> 0;
  const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const uni = { uTime: { value: 0 }, uHeat: { value: 0 }, uCheer: { value: new T.Vector2() }, uAnim: { value: 1 } };
  const mat = kit.keep(new T.MeshLambertMaterial({ color: '#ffffff', vertexColors: true }));
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + FAN_VERT_HEAD)
      .replace('#include <beginnormal_vertex>', `${FAN_POSE}
vec3 objectNormal = vec3(normal);
if (fSeg > 0.5 && fSeg < 1.5) objectNormal = fanRotXn(objectNormal, fThigh);
else if (fSeg > 2.5) objectNormal = fanRotXn(objectNormal, -fArm);`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
if (fSeg > 0.5 && fSeg < 1.5) { transformed = fanRotX(transformed, vec3(0.0, 0.9, 0.0), fThigh); transformed.y -= 0.42 * fSit; }
else if (fSeg > 1.5 && fSeg < 2.5) { transformed.z += 0.42 * fSit; }
else {
  if (fSeg > 2.5) {
    vec3 sp = vec3(0.0, 1.44, 0.0);
    if (fSeg > 4.5) transformed.y += 0.05 * sin(fT * 11.0 + transformed.x * 9.0 + fPh) * fRaise;   // held scarf ripples
    transformed = fanRotX(transformed, sp, -fArm);
  }
  transformed.y -= 0.42 * fSit;
}
transformed.z += 0.22 * fStand;   // standing fans step in front of the seat
transformed.x += sin(fT * 1.1 + fPh) * 0.03 * transformed.y * (0.4 + fE);
transformed.y += fHop;`)
      .replace('#include <color_vertex>', `#include <color_vertex>
if (aPS.x < 0.5) vColor.rgb *= aSkin; else if (aPS.x < 1.5) vColor.rgb *= aShirt; else if (aPS.x > 2.5 && aPS.x < 3.5) vColor.rgb *= aAcc;`);
  };
  mat.customProgramCacheKey = () => 'stadyum-taraftar-1';

  // assign variants, priorities; each variant's instances sorted by priority so `count` = fill
  const byVar: { s: FanSeat; prio: number }[][] = VARS.map(() => []);
  for (const s of seats) byVar[Math.floor(rnd() * VARS.length)].push({ s, prio: rnd() });
  const meshes: T.InstancedMesh[] = [], prios: Float32Array[] = [];
  const c = new T.Color();
  byVar.forEach((list, vi) => {
    if (!list.length) return;
    list.sort((a, b) => a.prio - b.prio);
    const geo = kit.geo(fanGeo(VARS[vi]));
    const n = list.length, shirt = new Float32Array(n * 3), skin = new Float32Array(n * 3), acc = new Float32Array(n * 3), info = new Float32Array(n * 4);
    const im = new T.InstancedMesh(geo, mat, n);
    list.forEach(({ s }, i) => {
      tmpQ.setFromAxisAngle(UP, s.rotY + (rnd() - 0.5) * 0.25); tmpV.set(s.x + (rnd() - 0.5) * 0.06, s.y, s.z);
      im.setMatrixAt(i, tmpM4.compose(tmpV, tmpQ, tmpS));
      c.set(s.shirt); shirt.set([c.r, c.g, c.b], i * 3);
      c.set(SKINS[Math.floor(rnd() * SKINS.length)]); skin.set([c.r, c.g, c.b], i * 3);
      c.set(s.acc); acc.set([c.r, c.g, c.b], i * 3);
      info.set([rnd() * 6.283, s.team, 0.6 + rnd() * 0.6, (rnd() - 0.5) * 0.3 + (s.team === 2 ? -0.08 : 0)], i * 4);
    });
    geo.setAttribute('aShirt', new T.InstancedBufferAttribute(shirt, 3));
    geo.setAttribute('aSkin', new T.InstancedBufferAttribute(skin, 3));
    geo.setAttribute('aAcc', new T.InstancedBufferAttribute(acc, 3));
    geo.setAttribute('aInfo', new T.InstancedBufferAttribute(info, 4));
    im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false;
    parent.add(im); meshes.push(im); prios.push(Float32Array.from(list.map(l => l.prio)));
  });
  return {
    meshes, total: seats.length,
    setFill(f) {
      const ff = Math.max(0, Math.min(1, f));
      meshes.forEach((im, k) => { const p = prios[k]; let lo = 0, hi = p.length; while (lo < hi) { const m = (lo + hi) >> 1; if (p[m] < ff) lo = m + 1; else hi = m; } im.count = lo; im.visible = lo > 0; });
    },
    update(dt, s) { uni.uTime.value += dt; uni.uHeat.value += (s.heat - uni.uHeat.value) * Math.min(1, dt * 3); uni.uCheer.value.set(s.cheer[0], s.cheer[1]); },
  };
}

// ───────────────────────── ışık direği, bayrak ─────────────────────────
/** Lattice floodlight mast with a lamp bank aimed at `aim` (parent frame). Returns the lamp head for glow tuning. */
export function buildMast(kit: Kit, parent: T.Object3D, x: number, z: number, h: number, aim: { x: number; z: number }): T.Mesh {
  const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
  const steel = kit.mat('#6f7884', { metalness: 0.7, roughness: 0.4 });
  const parts: T.BufferGeometry[] = [];
  const w = 0.7;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const b = new T.BoxGeometry(0.1, h, 0.1); b.translate(sx * w / 2, h / 2, sz * w / 2); parts.push(b); }
  for (let y = 1; y < h; y += 1.4) for (const r of [0, 1]) { const b = new T.BoxGeometry(r ? 0.05 : w, 0.05, r ? w : 0.05); b.translate(0, y, 0); parts.push(b); for (const s of [-1, 1]) { const c = b.clone(); c.translate(r ? s * w / 2 : 0, 0, r ? 0 : s * w / 2); parts.push(c); } }
  const lat = new T.Mesh(kit.geo(mergeGeometries(parts)), steel); lat.castShadow = true; g.add(lat); parts.forEach(p => p.dispose());
  const head = new T.Group(); head.position.y = h + 0.6; g.add(head);
  head.add(new T.Mesh(kit.geo(new T.BoxGeometry(3.2, 1.9, 0.3)), kit.mat('#a3abb5', { metalness: 0.35, roughness: 0.5 })));   // housing back reads as grey steel, not a black hole from behind
  for (const y of [-0.45, 0.45]) { const rib = new T.Mesh(kit.geo(new T.BoxGeometry(3.3, 0.08, 0.36)), steel); rib.position.y = y; head.add(rib); }
  const lampM = kit.mat('#fffaf0', { emissive: '#fff3d0', emissiveIntensity: 1.1, roughness: 0.3 });
  const lamps = new T.Mesh(kit.geo(new T.BoxGeometry(2.9, 1.6, 0.06)), lampM); lamps.position.z = 0.17; head.add(lamps);
  head.rotation.set(0, Math.atan2(aim.x - x, aim.z - z), 0); head.rotateX(0.45);   // lamp face (+z) toward the pitch, tilted down
  return lamps;
}

/** A flag/banner hung from a rail (plane, both sides). Canvas text in club colours. */
export function flagaDoku(kit: Kit, c1: string, c2: string, txt: string, w = 512, h = 128): T.CanvasTexture {
  return kit.canvas(w, h, (g) => {
    g.fillStyle = c1; g.fillRect(0, 0, w, h); g.fillStyle = c2; g.fillRect(0, h * 0.74, w, h * 0.26); g.fillRect(0, 0, w, h * 0.08);
    g.fillStyle = '#ffffff'; g.font = `900 ${Math.round(h * 0.42)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(4, h * 0.05); g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(txt, w / 2, h * 0.42, w * 0.92); g.fillText(txt, w / 2, h * 0.42, w * 0.92);
  });
}

/** Team-colour shirt picker: mostly the first kit colour, some second colour, a few neutrals. */
export function formaRengi(kit: [string, string], r: number): string { return r < 0.68 ? kit[0] : r < 0.88 ? kit[1] : ['#e9e6df', '#2b2d33', '#5d6b7a'][Math.floor(r * 100) % 3]; }
