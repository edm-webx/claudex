/**
 * Şantiye kiti (2026-11-25): her inşaat / tadilat / geliştirme anında, projenin boyutuna göre (content/santiye.ts SETLER) kurulan
 * set: iskele, merdiven, boya kovası, betoniyer, el arabası, kum ve tuğla, şantiye çiti, konteyner ofis, seyyar tuvalet, mobil vinç,
 * damperli ve mikser kamyon, kule vinç, beton pompası, jeneratör, toz bulutu. İsteğe bağlı aşamalı yapı kabuğu (temel, karkas,
 * duvar, çatı + sıva) ilerlemeyle yükselir. Ustalar burada çizilmez: sim'de gerçek yürüyen aktörler.
 *
 * Bütçe: statik her şey site başına TEK vertex-renkli mesh (Batch), hareketli parçalar birkaç küçük grup, toz tek Points nesnesi.
 * Yerel çerçeve: saha dikdörtgeni orijinde, x genişlik (w), z derinlik (d), +z halka açık ön taraf. Çağıran grubu konumlar/çevirir.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import type { SetPlan } from '../../../content/santiye';
import { yapiAsama, YAPI_ASAMA } from '../../../content/santiye';

const YEL = '#f2b705', DARK = '#2e3034', STEEL = '#aeb6c0', GLASS = '#22323d', RED = '#d8332b', WHITE = '#f1efe9', WOOD_A = '#a8794e', WOOD_B = '#9c6f46';
const CONC = '#a9a59c', CONC_D = '#8d8a83', BRICK = '#b5532f', BRICK_D = '#9c4428', SAND = '#d9c08a', ORANGE = '#e8892b', BLUE = '#2f6fb3';

let solid: T.MeshStandardMaterial | null = null;
const solidMat = () => solid || (solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.05 }));
let dustTex: T.CanvasTexture | null = null;
function dustTexture(): T.CanvasTexture {
  if (dustTex) return dustTex;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); dustTex = new T.CanvasTexture(c); return dustTex;
}

/* ---------------- statik parçalar (hepsi verilen Batch'e eklenir) ---------------- */
export function merdiven(b: Batch, x: number, z: number, ry = 0, h = 2.0) {
  const a = Math.asin(0.3 / h), L = h / Math.cos(a);
  b.at(x, 0, z, ry);
  for (const s of [-1, 1]) for (const k of [-1, 1]) b.box(0.05, L, 0.05, '#c9ced6', s * 0.24, h / 2, k * 0.15, { rx: k * a });
  for (let y = 0.3; y < h - 0.1; y += 0.3) b.box(0.5, 0.03, 0.07, '#9aa2ab', 0, y, 0.3 * (1 - y / h));
  b.box(0.56, 0.06, 0.22, '#e0533c', 0, h + 0.01, 0);
  b.pop();
}
export function boyaKovasi(b: Batch, x: number, z: number, renk = '#f4f2ec') {
  b.cyl(0.16, 0.14, 0.3, WHITE, x, 0.15, z, { seg: 10 }); b.cyl(0.15, 0.15, 0.02, renk, x, 0.31, z, { seg: 10 });
  b.box(0.04, 0.02, 0.3, DARK, x, 0.42, z, { rx: 0 });
}
export function elArabasi(b: Batch, x: number, z: number, ry = 0, dolu = SAND) {
  b.at(x, 0, z, ry);
  b.box(0.62, 0.32, 0.86, '#3f7d4a', 0, 0.52, 0, { rx: 0.08 }); b.box(0.5, 0.14, 0.7, dolu, 0, 0.68, 0.02);
  b.cyl(0.2, 0.2, 0.08, '#1f2023', 0, 0.2, 0.62, { rz: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) { b.box(0.04, 0.04, 1.3, '#5b6068', s * 0.28, 0.42, -0.1, { rx: -0.18 }); b.box(0.04, 0.34, 0.04, '#5b6068', s * 0.24, 0.17, -0.3); b.box(0.06, 0.06, 0.16, '#1f2023', s * 0.28, 0.6, -0.78); }
  b.pop();
}
export function kumYigini(b: Batch, x: number, z: number, r = 1.0, renk = SAND) { b.cone(r, r * 0.75, renk, x, r * 0.37, z, { seg: 9 }); b.cone(r * 0.6, r * 0.5, '#cdb37d', x + r * 0.5, r * 0.25, z + r * 0.3, { seg: 7 }); }
export function tuglaPaleti(b: Batch, x: number, z: number, ry = 0, kat = 3) {
  b.at(x, 0, z, ry); b.box(1.1, 0.12, 0.9, '#8a6a4a', 0, 0.06, 0); for (let i = 0; i < kat; i++) b.box(1.0, 0.18, 0.8, i % 2 ? BRICK : BRICK_D, 0, 0.21 + i * 0.18, 0); b.pop();
}
export function torba(b: Batch, x: number, z: number, n = 3) { for (let i = 0; i < n; i++) b.box(0.5, 0.17, 0.32, '#c9c4b8', x + (i % 2) * 0.05, 0.09 + i * 0.16, z, { ry: i * 0.25 }); }
export function kalas(b: Batch, x: number, z: number, ry = 0, n = 5) { b.at(x, 0, z, ry); for (let i = 0; i < n; i++) b.box(2.0, 0.08, 0.3, i % 2 ? '#c8955a' : '#b07d48', 0, 0.06 + i * 0.09, (i % 2) * 0.05); b.pop(); }
export function duba(b: Batch, x: number, z: number) { b.box(0.38, 0.04, 0.38, DARK, x, 0.02, z); b.cone(0.16, 0.6, '#ff7a1a', x, 0.33, z, { seg: 8 }); b.cyl(0.11, 0.135, 0.09, WHITE, x, 0.36, z, { seg: 8 }); }
/** geçici şantiye çiti: tel panel, beton ayak, yeşil branda; [x0,z0] -> [x1,z1] düz hat */
export function cit(b: Batch, x0: number, z0: number, x1: number, z1: number, brandaRenk = '#3f7d4a') {
  const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 2.4)), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, pw = L / n - 0.06;
    b.at(x, 0, z, ry);
    b.box(pw, 1.75, 0.03, '#8f9aa4', 0, 1.0, 0); b.box(pw, 1.5, 0.035, brandaRenk, 0, 0.95, 0.01);
    b.box(pw, 0.05, 0.05, '#c9ced6', 0, 1.88, 0); b.box(pw, 0.05, 0.05, '#c9ced6', 0, 0.12, 0);
    for (const s of [-1, 1]) { b.box(0.05, 1.85, 0.05, '#c9ced6', s * pw / 2, 0.98, 0); b.box(0.22, 0.14, 0.6, '#9a958c', s * pw / 2, 0.07, 0); }
    b.pop();
  }
}
/** boru iskele: L uzunluk (x boyunca), kat sayısı, derinlik 1.1 m; yeşil güvenlik filesi önde */
export function iskele(b: Batch, x: number, z: number, ry: number, L: number, kat: number, file = true) {
  const H = kat * 1.6 + 0.6, bays = Math.max(1, Math.round(L / 2.2)), bw = L / bays;
  b.at(x, 0, z, ry);
  for (let i = 0; i <= bays; i++) for (const v of [0, 1.1]) { const u = -L / 2 + i * bw; b.box(0.06, H, 0.06, STEEL, u, H / 2, v); b.box(0.16, 0.04, 0.16, '#5b6068', u, 0.02, v); }
  for (let k = 1; k <= kat; k++) {
    const y = k * 1.6; b.box(L, 0.06, 1.0, k % 2 ? WOOD_A : WOOD_B, 0, y, 0.55);
    b.box(L, 0.05, 0.05, RED, 0, y + 0.55, 1.1); b.box(L, 0.05, 0.05, WHITE, 0, y + 1.0, 1.1); b.box(L, 0.15, 0.03, '#d6b24a', 0, y + 0.1, 1.12);
  }
  for (let i = 0; i < bays; i++) { const u = -L / 2 + (i + 0.5) * bw, len = Math.hypot(bw, 1.6); for (let k = 0; k < kat; k++) b.box(len, 0.045, 0.045, '#9aa2ab', u, k * 1.6 + 0.8, 1.13, { rz: Math.atan2(1.6, bw) * (i % 2 ? -1 : 1) }); }
  if (file) b.box(L, H - 0.4, 0.02, '#4f8f5a', 0, H / 2 + 0.1, 1.2);
  b.pop();
}
export function konteyner(b: Batch, x: number, z: number, ry = 0) {
  b.at(x, 0, z, ry);
  b.box(2.4, 2.4, 5.0, '#f4f2ec', 0, 1.35, 0); b.box(2.46, 0.12, 5.06, '#3a5f8a', 0, 2.6, 0); b.box(2.46, 0.15, 5.06, '#3a5f8a', 0, 0.12, 0);
  for (const zz of [-1.3, 1.0]) b.box(0.04, 0.8, 1.1, GLASS, 1.22, 1.6, zz);
  b.box(0.04, 1.9, 0.85, '#6b7782', 1.22, 1.1, 2.0); for (let i = 0; i < 3; i++) b.box(0.3, 0.06, 0.85, '#7f8b96', 1.5 + i * 0.25, 0.25 + i * 0.25 - 0.25 + 0.0, 2.0);
  b.box(0.04, 0.45, 1.8, YEL, 1.23, 2.25, -0.2);   // "ŞANTİYE ŞEFİ" tabelası
  b.pop();
}
export function tuvalet(b: Batch, x: number, z: number, ry = 0) { b.at(x, 0, z, ry); b.box(1.1, 2.2, 1.1, BLUE, 0, 1.1, 0); b.box(1.2, 0.1, 1.2, '#e9eef3', 0, 2.25, 0); b.box(0.04, 1.8, 0.8, '#2a5b93', 0.56, 1.0, 0); b.box(0.02, 0.14, 0.14, WHITE, 0.58, 1.9, 0); b.pop(); }
export function jenerator(b: Batch, x: number, z: number, ry = 0) { b.at(x, 0, z, ry); b.box(1.6, 1.0, 0.9, '#2f8a4a', 0, 0.62, 0); b.box(1.62, 0.1, 0.92, DARK, 0, 1.15, 0); b.box(0.3, 0.5, 0.05, '#1c1f24', -0.4, 0.7, 0.46); for (const s of [-1, 1]) b.cyl(0.13, 0.13, 0.12, '#1f2023', s * 0.6, 0.13, 0.45, { rx: Math.PI / 2, seg: 8 }); b.cyl(0.05, 0.05, 0.4, '#5b6068', 0.6, 1.35, -0.2, { seg: 6 }); b.pop(); }
export function tabela(b: Batch, x: number, z: number, ry = 0) { b.at(x, 0, z, ry); for (const s of [-1, 1]) b.box(0.08, 2.3, 0.08, '#3a3d42', s * 1.1, 1.15, 0); b.box(2.6, 1.5, 0.06, YEL, 0, 1.9, 0); b.pop(); }

function wheels(b: Batch, xs: number, zs: number[], r: number, w: number, y = r) {
  for (const z of zs) for (const s of [-1, 1]) { b.cyl(r, r, w, '#1f2023', s * xs, y, z, { rz: Math.PI / 2, seg: 12 }); b.cyl(r * 0.5, r * 0.5, w + 0.02, '#9aa0a8', s * xs, y, z, { rz: Math.PI / 2, seg: 8 }); }
}
function kabin(b: Batch, renk: string, z: number) {
  b.box(2.3, 1.45, 1.5, renk, 0, 1.6, z, { r: 0.1 } as never); b.box(2.32, 0.7, 0.06, GLASS, 0, 1.95, z + 0.77); b.box(0.06, 0.6, 0.9, GLASS, 1.16, 1.95, z - 0.05); b.box(0.06, 0.6, 0.9, GLASS, -1.16, 1.95, z - 0.05);
  b.box(2.3, 0.3, 0.25, '#3a3c40', 0, 0.75, z + 0.8); b.box(0.5, 0.18, 0.06, '#fff3c4', 0.75, 1.0, z + 0.85); b.box(0.5, 0.18, 0.06, '#fff3c4', -0.75, 1.0, z + 0.85);
}

/* ---------------- hareketli makineler ---------------- */
interface Anim { (t: number, dt: number): void }
interface Ctx { g: T.Group; anims: Anim[]; beacons: T.MeshBasicMaterial[]; geos: T.BufferGeometry[]; mats: T.Material[] }
const beacon = (c: Ctx, p: T.Object3D, x: number, y: number, z: number, renk = '#ff9a1a') => {
  const m = new T.MeshBasicMaterial({ color: renk }); c.beacons.push(m); c.mats.push(m);
  const geo = new T.CylinderGeometry(0.1, 0.12, 0.18, 8); c.geos.push(geo); const o = new T.Mesh(geo, m); o.position.set(x, y, z); p.add(o);
};
const part = (c: Ctx, b: Batch, parent: T.Object3D) => { const m = b.mesh(solidMat()); c.geos.push(m.geometry); parent.add(m); return m; };

function betoniyer(c: Ctx, sb: Batch, x: number, z: number, ry = 0) {
  sb.at(x, 0, z, ry); sb.box(0.9, 0.08, 0.5, '#5b6068', 0, 0.45, 0); for (const s of [-1, 1]) { sb.box(0.06, 0.9, 0.06, '#5b6068', s * 0.38, 0.45, 0.2, { rz: s * 0.12 }); sb.cyl(0.17, 0.17, 0.07, '#1f2023', s * 0.45, 0.17, -0.15, { rz: Math.PI / 2, seg: 10 }); } sb.box(0.3, 0.3, 0.3, '#e0533c', -0.4, 0.75, -0.1); sb.pop();
  const g = new T.Group(); g.position.set(x, 0.95, z); g.rotation.y = ry; c.g.add(g);
  const d = new T.Group(); d.rotation.x = -0.6; g.add(d);
  const b = new Batch(); b.lathe([[0.08, -0.45], [0.38, -0.3], [0.42, 0.05], [0.3, 0.38], [0.18, 0.48]], ORANGE, 0, 0, 0, { seg: 14 } as never); for (let i = 0; i < 4; i++) b.box(0.05, 0.6, 0.06, '#c46f20', Math.cos(i * 1.57) * 0.41, 0, Math.sin(i * 1.57) * 0.41);
  part(c, b, d); c.anims.push(t => { d.rotation.y = t * 2.6; });
}
function kamyon(c: Ctx, x: number, z: number, ry: number, tip: 'damperli' | 'mikser') {
  const g = new T.Group(); g.position.set(x, 0.02, z); g.rotation.y = ry; c.g.add(g);
  const b = new Batch(); b.box(1.9, 0.35, 6.3, '#2b2c30', 0, 0.75, -0.3); kabin(b, tip === 'mikser' ? '#e9e6dc' : '#c0392b', 2.15); wheels(b, 1.0, [2.0, -1.2, -2.5], 0.52, 0.42); part(c, b, g);
  beacon(c, g, 0.6, 2.45, 2.15);
  if (tip === 'damperli') {
    const bed = new T.Group(); bed.position.set(0, 1.18, -3.2); g.add(bed);
    const k = new Batch(); k.box(2.4, 0.12, 4.4, ORANGE, 0, 0, 2.2); k.box(0.1, 1.1, 4.4, ORANGE, 1.15, 0.6, 2.2); k.box(0.1, 1.1, 4.4, ORANGE, -1.15, 0.6, 2.2); k.box(2.4, 1.1, 0.1, ORANGE, 0, 0.6, 4.37); k.box(2.4, 1.1, 0.1, '#c46f20', 0, 0.6, 0.03);
    k.sph(1, '#8a6a4a', 0, 0.2, 2.2, { sx: 1.05, sy: 0.3, sz: 2.0, ws: 12, hs: 6 } as never); part(c, k, bed);
    c.anims.push(t => { const ph = (t * 0.07) % 1; bed.rotation.x = ph > 0.7 && ph < 0.9 ? Math.sin((ph - 0.7) / 0.2 * Math.PI) * 0.55 : 0; });
  } else {
    const b2 = new Batch(); b2.box(1.0, 0.8, 0.6, '#5b6068', 0, 1.3, 1.1); b2.box(0.5, 0.12, 1.6, '#9aa0a8', 0, 2.3, -3.6, { rx: 0.5 }); part(c, b2, g);
    const tam = new T.Group(); tam.position.set(0, 2.15, -1.2); tam.rotation.x = 0.22; g.add(tam);
    const tb = new Batch(); tb.lathe([[0.05, -2.2], [0.75, -1.8], [1.15, -0.7], [1.15, 0.6], [0.6, 1.9], [0.35, 2.1]], ORANGE, 0, 0, 0, { seg: 16, rx: -Math.PI / 2 } as never);
    for (let i = 0; i < 6; i++) tb.box(0.12, 0.05, 2.6, WHITE, Math.cos(i * 1.05) * 1.13, Math.sin(i * 1.05) * 1.13, -0.1, { rz: i * 1.05 });
    const tm = part(c, tb, tam); c.anims.push(t => { tm.rotation.z = t * 1.4; });
  }
}
function mobilVinc(c: Ctx, x: number, z: number, ry: number, hedef: { x: number; z: number }) {
  const g = new T.Group(); g.position.set(x, 0.02, z); g.rotation.y = ry; c.g.add(g);
  const b = new Batch(); b.box(2.3, 0.5, 7.2, YEL, 0, 0.95, 0); kabin(b, YEL, 3.0); wheels(b, 1.0, [2.4, 0.9, -1.2, -2.6], 0.5, 0.42);
  for (const s of [-1, 1]) for (const zz of [-2.8, 2.6]) { b.box(1.1, 0.14, 0.2, DARK, s * 1.6, 0.6, zz); b.box(0.12, 0.6, 0.12, DARK, s * 2.1, 0.3, zz); b.box(0.5, 0.06, 0.5, '#5b6068', s * 2.1, 0.03, zz); }
  part(c, b, g);
  const ust = new T.Group(); ust.position.set(0, 1.25, -1.6); g.add(ust);
  const u = new Batch(); u.cyl(0.9, 0.9, 0.3, DARK, 0, 0.15, 0, { seg: 14 }); u.box(2.0, 1.0, 2.6, YEL, 0, 0.8, -0.3); u.box(0.9, 1.1, 1.0, YEL, 0.75, 1.0, 1.0); u.box(0.92, 0.6, 0.9, GLASS, 0.75, 1.15, 1.06); u.box(1.6, 0.8, 0.6, DARK, 0, 0.7, -1.6);
  part(c, u, ust); beacon(c, ust, -0.6, 1.4, -0.6);
  const bom = new T.Group(); bom.position.set(0, 1.2, 0.2); ust.add(bom);
  const bb = new Batch(); bb.box(0.6, 0.6, 9.5, YEL, 0, 0, 4.75); bb.box(0.4, 0.4, 3.2, '#e0b000', 0, 0.05, 10.8); bb.box(0.3, 0.6, 0.4, DARK, 0, -0.1, 12.3); part(c, bb, bom);
  bom.rotation.x = -0.95;
  const kanca = new T.Group(); kanca.position.set(0, -0.3, 12.3); bom.add(kanca);
  const cg = new T.BoxGeometry(0.03, 1, 0.03), cm = new T.MeshLambertMaterial({ color: '#222' }); c.geos.push(cg); c.mats.push(cm);
  const kablo = new T.Mesh(cg, cm); kanca.add(kablo);
  const yb = new Batch(); for (let i = 0; i < 3; i++) yb.box(2.4, 0.18, 0.3, i % 2 ? WOOD_A : WOOD_B, 0, i * 0.18, 0); yb.box(0.04, 0.6, 0.04, '#333', 0, 0.75, 0); const yuk = part(c, yb, kanca);
  const wx = x, wz = z, base = Math.atan2(hedef.x - wx, hedef.z - wz) - ry;
  c.anims.push(t => {
    ust.rotation.y = base + Math.sin(t * 0.18) * 0.6;
    bom.rotation.x = -0.95 + Math.sin(t * 0.13) * 0.08;
    kanca.rotation.x = -bom.rotation.x;   // kablo hep dik sarkar
    const L = 4.5 + Math.sin(t * 0.33) * 1.6; kablo.scale.y = L; kablo.position.y = -L / 2; yuk.position.y = -L - 0.6; yuk.rotation.y = Math.sin(t * 0.5) * 0.3;
  });
}
function kuleVinc(c: Ctx, x: number, z: number, H: number, kol: number, yon: number) {
  const b = new Batch();
  b.box(1.6, 0.4, 1.6, '#5b6068', x, 0.2, z);
  for (let y = 0; y < H; y += 1.2) { for (const [ox, oz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) b.box(0.07, 1.25, 0.07, YEL, x + ox, y + 0.8, z + oz); for (const s of [-1, 1]) { b.box(0.05, 1.45, 0.05, YEL, x + s * 0.35, y + 0.8, z, { rx: 0.55 * s }); b.box(0.05, 1.45, 0.05, YEL, x, y + 0.8, z + s * 0.35, { rz: 0.55 * s }); } }
  b.box(1.0, 1.0, 1.0, '#e0533c', x, H + 0.7, z);
  part(c, b, c.g);
  const jib = new T.Group(); jib.position.set(x, H + 1.25, z); c.g.add(jib);
  const jb = new Batch(); jb.box(kol, 0.35, 0.35, YEL, kol / 2, 0.3, 0); jb.box(kol, 0.05, 0.05, '#c9a02a', kol / 2, 0.02, 0.3); jb.box(kol, 0.05, 0.05, '#c9a02a', kol / 2, 0.02, -0.3);
  jb.box(3.4, 0.35, 0.35, YEL, -1.7, 0.3, 0); jb.box(1.2, 1.0, 0.9, '#5b6068', -3.0, 0.1, 0); jb.box(0.35, 1.8, 0.35, YEL, 0, 1.2, 0);
  jb.box(0.9, 0.8, 0.9, GLASS, 0.6, -0.2, 0.6); part(c, jb, jib); beacon(c, jib, 0, 2.2, 0, '#ff3b2e'); beacon(c, jib, kol, 0.6, 0, '#ff3b2e');
  const tro = new T.Group(); tro.position.set(kol * 0.6, 0.05, 0); jib.add(tro);
  const cg = new T.BoxGeometry(0.03, 1, 0.03), cm = new T.MeshLambertMaterial({ color: '#222' }); c.geos.push(cg); c.mats.push(cm);
  const kablo = new T.Mesh(cg, cm); tro.add(kablo);
  const yb = new Batch(); yb.box(1.4, 1.0, 1.4, '#9aa0a8', 0, 0.5, 0, { open: true } as never); yb.box(1.3, 0.85, 1.3, CONC, 0, 0.45, 0); const yuk = part(c, yb, tro);
  c.anims.push(t => {
    jib.rotation.y = yon + Math.sin(t * 0.12) * 0.9;
    tro.position.x = kol * (0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.21)));
    const L = H * 0.55 + Math.sin(t * 0.29) * H * 0.25; kablo.scale.y = L; kablo.position.y = -L / 2; yuk.position.y = -L - 1.0;
    tro.rotation.z = Math.sin(t * 1.3) * 0.03;
  });
}
function betonPompasi(c: Ctx, x: number, z: number, ry: number, hedef: { x: number; z: number }) {
  const g = new T.Group(); g.position.set(x, 0.02, z); g.rotation.y = ry; c.g.add(g);
  const b = new Batch(); b.box(2.3, 0.6, 7.0, '#e9e6dc', 0, 1.0, -0.2); kabin(b, '#e9e6dc', 2.9); wheels(b, 1.0, [2.6, 1.0, -1.4, -2.8], 0.5, 0.42);
  b.box(1.6, 0.9, 1.4, '#9aa0a8', 0, 1.7, -3.0); b.cyl(0.4, 0.4, 1.4, '#7f8b96', 0, 1.7, -3.9, { rx: Math.PI / 2, seg: 10 });
  for (const s of [-1, 1]) for (const zz of [-2.6, 1.8]) { b.box(1.6, 0.16, 0.22, '#e0533c', s * 1.8, 0.7, zz); b.box(0.14, 0.7, 0.14, DARK, s * 2.55, 0.35, zz); b.box(0.6, 0.06, 0.6, '#5b6068', s * 2.55, 0.03, zz); }
  part(c, b, g);
  const tur = new T.Group(); tur.position.set(0, 1.4, 0.4); g.add(tur);
  const tb = new Batch(); tb.cyl(0.6, 0.7, 0.8, '#5b6068', 0, 0.4, 0, { seg: 12 }); part(c, tb, tur);
  const seg = (L: number) => { const s = new Batch(); s.box(0.36, 0.36, L, '#e0533c', 0, 0, L / 2); s.cyl(0.07, 0.07, L, '#3a3d42', 0, -0.25, L / 2, { rx: Math.PI / 2, seg: 6 }); return s; };
  const k1 = new T.Group(); k1.position.y = 0.85; tur.add(k1); part(c, seg(5.5), k1);
  const k2 = new T.Group(); k2.position.z = 5.5; k1.add(k2); part(c, seg(4.8), k2);
  const k3 = new T.Group(); k3.position.z = 4.8; k2.add(k3); part(c, seg(4.0), k3);
  const hose = new Batch(); hose.cyl(0.1, 0.12, 2.0, DARK, 0, -1.0, 0, { seg: 8 }); const hm = part(c, hose, new T.Group()); const uc = new T.Group(); uc.position.z = 4.0; k3.add(uc); uc.add(hm.parent!);
  const base = Math.atan2(hedef.x - x, hedef.z - z) - ry;
  c.anims.push(t => {
    tur.rotation.y = base + Math.sin(t * 0.1) * 0.25;
    k1.rotation.x = -1.05 + Math.sin(t * 0.15) * 0.05; k2.rotation.x = 1.25 + Math.sin(t * 0.17 + 1) * 0.08; k3.rotation.x = 0.95 + Math.sin(t * 0.19 + 2) * 0.1;
    uc.rotation.x = -(k1.rotation.x + k2.rotation.x + k3.rotation.x);   // hortum yere dik
  });
}

/* ---------------- aşamalı yapı kabuğu (ev / dükkân) ---------------- */
export interface KabukOpts { w: number; d: number; h: number; cati: 'kirma' | 'duz'; duvar?: string; catiRenk?: string; /** üst kat: hafriyat ve temel izi yok, döşeme alttaki katın tavanı */ ustKat?: boolean }
interface Kabuk { temel: T.Mesh; karkas: T.Mesh; duvar: T.Mesh; bitis: T.Mesh; set(p: number): void }
function kabuk(c: Ctx, o: KabukOpts): Kabuk {
  const { w, d, h } = o, x0 = -w / 2, z0 = -d / 2, kapiW = 1.3;
  // temel: hafriyat çukuru izi, kalıp tahtası, demir ızgara, sonra beton döşeme
  const tb = new Batch(); if (!o.ustKat) { tb.box(w + 0.6, 0.06, d + 0.6, '#7a5e42', 0, 0.03, 0); tb.box(w, 0.28, d, CONC, 0, 0.16, 0); }
  for (const s of [-1, 1]) { tb.box(w + 0.1, 0.35, 0.05, WOOD_A, 0, 0.17, s * (d / 2 + 0.03)); tb.box(0.05, 0.35, d + 0.1, WOOD_B, s * (w / 2 + 0.03), 0.17, 0); }
  for (let x = x0 + 0.5; x < w / 2; x += 0.5) tb.box(0.025, 0.025, d - 0.2, '#6b4a3a', x, 0.32, 0); for (let z = z0 + 0.5; z < d / 2; z += 0.5) tb.box(w - 0.2, 0.025, 0.025, '#6b4a3a', 0, 0.33, z);
  // karkas: kolonlar (köşeler + ~3 m arayla) ve üst kiriş, filizler
  const cols: [number, number][] = []; const nx = Math.max(1, Math.round(w / 3)), nz = Math.max(1, Math.round(d / 3));
  for (let i = 0; i <= nx; i++) for (const zz of [z0 + 0.15, -z0 - 0.15]) cols.push([x0 + 0.15 + i * (w - 0.3) / nx, zz]);
  for (let j = 1; j < nz; j++) for (const xx of [x0 + 0.15, -x0 - 0.15]) cols.push([xx, z0 + 0.15 + j * (d - 0.3) / nz]);
  const kb = new Batch(); for (const [x, z] of cols) { kb.box(0.3, h, 0.3, CONC_D, x, h / 2, z); for (const s of [-1, 1]) kb.box(0.02, 0.5, 0.02, '#6b4a3a', x + s * 0.08, h + 0.25, z); }
  for (const s of [-1, 1]) { kb.box(w, 0.35, 0.3, CONC_D, 0, h - 0.17, s * (d / 2 - 0.15)); kb.box(0.3, 0.35, d, CONC_D, s * (w / 2 - 0.15), h - 0.17, 0); }
  kb.box(w - 0.1, 0.18, d - 0.1, CONC, 0, h + 0.09, 0);   // tavan döşemesi
  // duvar: tuğla, ön cephede kapı boşluğu ve iki pencere boşluğu (aşağıdan yukarı yükselir: scale.y)
  const db = new Batch(), wy = h - 0.35, CH = 0.25, nC = Math.round(wy / CH);
  const wall = (x: number, z: number, ww: number, dd: number) => { for (let i = 0; i < nC; i++) db.box(ww, CH - 0.012, dd, i % 2 ? BRICK : BRICK_D, x, i * CH + CH / 2, z); };
  wall(0, z0 + 0.12, w - 0.6, 0.18); wall(x0 + 0.12, 0, 0.18, d - 0.6); wall(-x0 - 0.12, 0, 0.18, d - 0.6);
  const seg = (w - 0.6 - kapiW) / 2; wall(-(kapiW / 2 + seg / 2), -z0 - 0.12, seg, 0.18); wall(kapiW / 2 + seg / 2, -z0 - 0.12, seg, 0.18);
  // bitiş: sıvalı boyalı duvar kabuğu, pencereler, kapı, çatı
  const fb = new Batch(), duv = o.duvar || '#f1e3c4';
  fb.box(w + 0.04, h, 0.06, duv, 0, h / 2, z0 + 0.0); fb.box(0.06, h, d + 0.04, duv, x0, h / 2, 0); fb.box(0.06, h, d + 0.04, duv, -x0, h / 2, 0);
  fb.box(seg + 0.3, h, 0.06, duv, -(kapiW / 2 + seg / 2 + 0.15), h / 2, -z0); fb.box(seg + 0.3, h, 0.06, duv, kapiW / 2 + seg / 2 + 0.15, h / 2, -z0); fb.box(kapiW, h - 2.1, 0.06, duv, 0, 2.1 + (h - 2.1) / 2, -z0);
  fb.box(kapiW - 0.3, 2.0, 0.08, '#6b4a2e', 0, 1.0, -z0 + 0.01); fb.box(0.08, 0.08, 0.06, '#e8c860', kapiW / 2 - 0.3, 1.0, -z0 + 0.06);
  for (const s of [-1, 1]) { fb.box(0.9, 0.9, 0.08, '#8fb8cc', s * (kapiW / 2 + seg / 2), 1.55, -z0 + 0.02); fb.box(1.05, 0.08, 0.2, WHITE, s * (kapiW / 2 + seg / 2), 1.06, -z0 + 0.06); }
  if (o.cati === 'kirma') { fb.cone(Math.hypot(w, d) / 2 + 0.4, 1.5, o.catiRenk || '#b8553a', 0, h + 0.75 + 0.18, 0, { seg: 4, ry: Math.PI / 4, sz: d / w } as never); fb.box(0.5, 1.0, 0.5, '#8a5a40', w / 4, h + 1.2, -d / 6); }
  else { for (const s of [-1, 1]) { fb.box(w + 0.1, 0.4, 0.12, duv, 0, h + 0.38, s * d / 2); fb.box(0.12, 0.4, d + 0.1, duv, s * w / 2, h + 0.38, 0); } fb.box(1.2, 0.6, 0.9, '#c9ced6', -w / 4, h + 0.48, 0); }
  const temel = part(c, tb, c.g), karkas = part(c, kb, c.g), duvar = part(c, db, c.g), bitis = part(c, fb, c.g);
  const set = (p: number) => {
    const a = yapiAsama(p);
    temel.visible = true;
    karkas.visible = a >= 1; if (a === 1) karkas.scale.y = Math.max(0.08, (p - 0.2) / 0.25); else karkas.scale.y = 1;
    duvar.visible = a >= 2 && a < 3 || (a === 3 && p < 0.86); duvar.scale.y = a === 2 ? Math.max(0.05, (p - 0.45) / 0.35) : 1;
    bitis.visible = a === 3; bitis.scale.y = a === 3 ? Math.min(1, 0.5 + (p - 0.8) / 0.2 * 0.5 + 0.001) : 1;
    if (p >= 0.999) { bitis.scale.y = 1; }
  };
  return { temel, karkas, duvar, bitis, set };
}

/* ---------------- toz bulutu ---------------- */
function toz(c: Ctx, n: number, w: number, d: number) {
  const pos = new Float32Array(n * 3), life = new Float32Array(n), vx = new Float32Array(n), vz = new Float32Array(n);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); c.geos.push(geo);
  const mat = new T.PointsMaterial({ map: dustTexture(), color: '#d8c9ad', size: 1.1, transparent: true, opacity: 0.45, depthWrite: false, sizeAttenuation: true }); c.mats.push(mat);
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 2; c.g.add(pts);
  let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const reset = (i: number) => { pos[i * 3] = (rnd() - 0.5) * w; pos[i * 3 + 1] = 0.1 + rnd() * 0.4; pos[i * 3 + 2] = (rnd() - 0.5) * d; life[i] = rnd() * 3; vx[i] = (rnd() - 0.5) * 0.4; vz[i] = (rnd() - 0.5) * 0.4; };
  for (let i = 0; i < n; i++) reset(i);
  c.anims.push((_t, dt) => {
    for (let i = 0; i < n; i++) { life[i] += dt; if (life[i] > 3.2) { reset(i); life[i] = 0; } pos[i * 3] += vx[i] * dt; pos[i * 3 + 1] += 0.35 * dt; pos[i * 3 + 2] += vz[i] * dt; }
    (geo.attributes.position as T.BufferAttribute).needsUpdate = true;
  });
}

/* ---------------- bir sahanın kurulumu ---------------- */
export interface SantiyeOpts {
  /** saha (yapının / tadilatın) ölçüsü */ w: number; d: number; plan: SetPlan;
  /** aşamalı yapı kabuğu (yalnız sıfırdan yapılan bina: arsa evi / dükkânı) */ kabuk?: KabukOpts | null;
  /** iskele: ön cephe boyunca (tadilat) ya da kabuğun etrafında */ iskeleYer?: 'on' | 'cevre' | 'yok';
  /** büyük makinelerin yerleri (yerel), verilmezse sahanın arkası / yanları */
  yer?: { vinc?: { x: number; z: number; ry?: number }; kamyon?: { x: number; z: number; ry: number }; mikser?: { x: number; z: number; ry: number }; pompa?: { x: number; z: number; ry: number }; ofis?: { x: number; z: number; ry: number } };
  /** çit çizilsin mi (sahayı çevreler, ön ortada kapı boşluğu) */ cit?: boolean;
  /** kule vinç yüksekliği */ vincH?: number;
  /** küçük işte önde şerit + duba (varsayılan: çit yoksa) */ serit?: boolean;
  /** dar arsa: malzemeler (betoniyer, el arabası, kum, tuğla) dikdörtgenin içinde köşelere dizilir, dışarı taşmaz */ sikisik?: boolean;
  /** dışarıdan gelen kule vinç vb. varsa kitin kendi vinci kurulmaz */ vincYok?: boolean;
  /** proje panosu: başlık ('EV YAPIMI'), alt satır ('Arsa A1 · Sabri İnşaat'); ilerleme çubuğu canlı */ pano?: { baslik: string; alt: string } | null;
}
/** sarı proje panosu: başlık, alt satır, aşama adı ve canlı % çubuğu (tam yüzdede yeniden çizilir) */
function panoKur(c: Ctx, x: number, z: number, ry: number, o: { baslik: string; alt: string }, asamaAd: (p: number) => string) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 300; const g = cv.getContext('2d')!, tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
  const mat = new T.MeshBasicMaterial({ map: tex }); c.mats.push(mat); const geo = new T.PlaneGeometry(2.5, 1.45); c.geos.push(geo);
  const m = new T.Mesh(geo, mat); m.position.set(x, 1.9, z + 0.04); m.rotation.y = ry; c.g.add(m);
  let last = -1;
  return (p: number) => {
    const pc = Math.max(0, Math.min(100, Math.floor(p * 100))); if (pc === last) return; last = pc;
    g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 512, 300); for (let i = -6; i < 20; i++) { g.fillStyle = '#1d1d1d'; g.beginPath(); g.moveTo(i * 40, 0); g.lineTo(i * 40 + 20, 0); g.lineTo(i * 40 - 20, 30); g.lineTo(i * 40 - 40, 30); g.fill(); }
    g.fillStyle = '#1d1d1d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 50px system-ui,sans-serif'; g.fillText(o.baslik, 256, 72, 480);
    g.font = '700 28px system-ui,sans-serif'; g.fillText(o.alt, 256, 116, 480); g.font = '800 30px system-ui,sans-serif'; g.fillText(asamaAd(p), 256, 156, 480);
    g.fillStyle = '#3a3d42'; g.fillRect(40, 186, 432, 50); g.fillStyle = '#2f9e5a'; g.fillRect(46, 192, 420 * pc / 100, 38);
    g.fillStyle = '#fbfaf6'; g.font = '900 30px system-ui,sans-serif'; g.fillText('%' + pc, 256, 212);
    g.fillStyle = '#1d1d1d'; g.font = '700 24px system-ui,sans-serif'; g.fillText('Kolay gelsin ustalar!', 256, 268);
    tex.needsUpdate = true;
  };
}
export interface Santiye { g: T.Group; update(dt: number, p: number, night: number): void; dispose(): void; /** araçların yerel ayak izleri (yürüyüş engeli için) */ engel: { x0: number; x1: number; z0: number; z1: number }[] }

export function santiyeKur(o: SantiyeOpts): Santiye {
  const c: Ctx = { g: new T.Group(), anims: [], beacons: [], geos: [], mats: [] }; c.g.name = 'santiye-' + o.plan.boyut;
  const P = o.plan, w = o.w, d = o.d, b = new Batch(), hw = w / 2, hd = d / 2;
  const kb = o.kabuk ? kabuk(c, o.kabuk) : null;
  // iskele
  const isk = o.iskeleYer ?? (kb ? 'cevre' : 'on');
  if (isk === 'on') iskele(b, 0, hd - 0.2, 0, Math.max(2.2, w - 1.2), P.iskeleKat, P.iskeleKat > 1);
  else if (isk === 'cevre') { const kw = o.kabuk!.w, kd = o.kabuk!.d, k = Math.max(1, Math.min(P.iskeleKat, Math.ceil(o.kabuk!.h / 1.6))); iskele(b, 0, -kd / 2 - 0.35, Math.PI, kw + 1.4, k); iskele(b, -kw / 2 - 0.35, 0, -Math.PI / 2, kd, k, false); iskele(b, kw / 2 + 0.35, 0, Math.PI / 2, kd, k, false); }
  // küçük set: merdiven, boya, şerit + duba
  if (P.merdiven) { if (o.sikisik) merdiven(b, -hw * 0.3, hd - 0.4, 0.3, 1.8); else merdiven(b, -hw * 0.45, hd + 0.8, 0.3); }
  if (P.boya) { boyaKovasi(b, -hw * 0.45 + 0.7, hd + 1.1, '#ffd23f'); boyaKovasi(b, -hw * 0.45 + 0.95, hd + 0.8, '#f4f2ec'); boyaKovasi(b, hw * 0.4, hd + 1.0, '#2f7fb3'); torba(b, hw * 0.4 + 0.6, hd + 0.9, 2); b.box(1.6, 0.02, 1.2, '#d9d4c8', -hw * 0.45 + 0.6, 0.012, hd + 1.0); }
  if (o.serit ?? !P.cit) { for (const s of [-1, 1]) { duba(b, s * (hw + 0.3), hd + 1.8); b.box(hw * 0.9, 0.06, 0.02, RED, s * hw * 0.55, 0.85, hd + 1.8); b.box(hw * 0.9, 0.06, 0.02, WHITE, s * hw * 0.55, 0.85, hd + 1.81); } }
  // orta: betoniyer, el arabası, kum, tuğla, kalas, torba
  if (o.sikisik) {
    if (P.betoniyer) betoniyer(c, b, -hw + 0.45, hd - 0.25, 0.4);
    if (P.elArabasi) { elArabasi(b, hw - 0.5, hd - 0.15, -0.5); kumYigini(b, -hw + 0.4, -hd + 0.5, 0.55); tuglaPaleti(b, hw - 0.35, -hd + 0.6, Math.PI / 2, 3); torba(b, hw - 0.35, 0.2, 2); }
  } else {
  if (P.betoniyer) betoniyer(c, b, -hw - 1.4, hd - 1.6, 0.6);
  if (P.elArabasi) { elArabasi(b, -hw - 0.6, hd - 0.2, 1.1); kumYigini(b, -hw - 1.8, -hd + 1.6, 1.1); tuglaPaleti(b, hw + 1.3, -hd + 1.2, 0.2, 4); tuglaPaleti(b, hw + 1.3, -hd + 2.5, -0.1, 2); kalas(b, hw + 1.4, hd - 1.4, Math.PI / 2); torba(b, -hw - 0.8, -hd + 0.4, 3); }
  }
  // çit: sahayı çevreler, önde 3 m kapı
  const citOn = o.cit ?? P.cit, m = 3.2;
  if (citOn) { const X0 = -hw - m, X1 = hw + m, Z0 = -hd - m, Z1 = hd + m * 0.9; cit(b, X0, Z0, X1, Z0); cit(b, X0, Z0, X0, Z1); cit(b, X1, Z0, X1, Z1); cit(b, X0, Z1, -1.6, Z1); cit(b, 1.6, Z1, X1, Z1); }
  let pano: ((p: number) => void) | null = null;
  if (o.pano) { const px = citOn ? hw + m - 2.0 : o.sikisik ? hw - 1.4 : hw + 1.6, pz = citOn ? hd + m * 0.9 + 0.4 : o.sikisik ? hd + 0.2 : hd + 2.4; tabela(b, px, pz, 0); pano = panoKur(c, px, pz, 0, o.pano, p => (kb ? YAPI_ASAMA[yapiAsama(p)].ad : P.ad)); }
  // büyük / dev araçlar
  const Y = o.yer || {}, engel: Santiye['engel'] = [];
  const iz = (x: number, z: number, ry: number, w2: number, d2: number) => { const c2 = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry)), ex = (w2 * c2 + d2 * s2) / 2, ez = (w2 * s2 + d2 * c2) / 2; engel.push({ x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez }); };
  if (P.konteyner) { const q = Y.ofis || { x: -hw - m + 1.6, z: -hd - m + 3.2, ry: 0 }; konteyner(b, q.x, q.z, q.ry); tuvalet(b, q.x, q.z + 3.4, q.ry); iz(q.x, q.z + 0.8, q.ry, 2.6, 7.0); }
  if (P.jenerator) jenerator(b, hw + m - 1.2, -hd - m + 1.4, 0);
  if (P.kamyon) { const q = Y.kamyon || { x: hw + m + 2.2, z: 0, ry: 0 }; kamyon(c, q.x, q.z, q.ry, 'damperli'); iz(q.x, q.z, q.ry, 2.6, 7.0); }
  if (P.mikser) { const q = Y.mikser || { x: hw + m + 2.2, z: hd - 1, ry: Math.PI }; kamyon(c, q.x, q.z, q.ry, 'mikser'); iz(q.x, q.z, q.ry, 2.6, 7.0); }
  if (P.mobilVinc && !o.vincYok) { const q = Y.vinc || { x: -hw - m - 2.4, z: -hd + 1.0 }; mobilVinc(c, q.x, q.z, q.ry ?? 0, { x: 0, z: 0 }); iz(q.x, q.z, q.ry ?? 0, 4.4, 7.6); }
  if (P.kuleVinc && !o.vincYok) { const q = Y.vinc || { x: -hw - 1.4, z: -hd - 1.4 }; kuleVinc(c, q.x, q.z, o.vincH ?? Math.max(11, (o.kabuk?.h || 4) + 8), Math.max(10, Math.hypot(w, d) * 0.9), Math.atan2(-(0 - q.z), 0 - q.x) - Math.PI / 2 + Math.PI / 2); }
  if (P.pompa) { const q = Y.pompa || { x: hw + m + 2.4, z: -hd + 2.2, ry: 0 }; betonPompasi(c, q.x, q.z, q.ry, { x: 0, z: 0 }); iz(q.x, q.z, q.ry, 4.0, 7.4); }
  if (P.toz > 0) toz(c, P.toz, w, d);
  if (!b.empty) part(c, b, c.g);
  let t = Math.random() * 30;
  return {
    g: c.g, engel,
    update(dt, p, night) {
      t += dt; for (const a of c.anims) a(t, dt); const pp = Math.max(0, Math.min(1, p)); kb?.set(pp); pano?.(pp);
      const on = Math.sin(t * 5) > 0; c.beacons.forEach((m2, i) => m2.color.set((i % 2 ? on : !on) ? '#ffcf5a' : '#6a4a12'));
      void night;
    },
    dispose() { c.g.removeFromParent(); for (const g2 of c.geos) g2.dispose(); for (const m2 of c.mats) m2.dispose(); },
  };
}
