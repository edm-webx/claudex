/**
 * Martıköy İlkokulu diyarı (2026-11-28 sahip: "okul da içine girilebilecek AVM gibi; sınıflar, müdür, her şey"). content/okul-ic.ts planını çizer:
 * dışarıda sokak + kaldırım + uzak apartmanlar, okul çiti ve "MARTIKÖY İLKOKULU" kemerli bahçe kapısı; giriş meydanında dalgalanan Türk bayrağı,
 * Atatürk büstü, çiçeklikler, banklar, ağaçlar; arka bahçede basket sahası, oyun parkı (salıncak, kaydırak, tahterevalli, kum havuzu), seksek,
 * çeşme. Bina: koridor zemini (karo), koridor ve hol duvarları (yeşil lambri, krem sıva, kapı kasaları, oda levhaları, dolaplar, panolar),
 * giriş holünde Atatürk köşesi ve kupa dolabı, cam çift kanat giriş kapısı. Dışarıdayken bina kapalı görünür (cephe + kiremit çatı); içeri
 * girince kabuk gizlenir, odalar (view/world/ic-mekan-look.ts) bebek evi gibi açılır. Duvarlar AVM / odalar gibi içe bakar (dışarıdan bakınca
 * kaybolur); duvar süsü yalnız duvar düzlemi kameraya dönükken görünür. Saf görünüm, sim yok, ışık eklemez (parlayan küreler).
 */
import * as T from 'three';
import { Batch, mtx } from '../../../engine/prefab/batch';
import { OKUL, KOR, HOL, GIRIS_KAPI, SINIR, CIT_KAPI, OKUL_DEKOR, KOR_DEKOR, BASKET, PARK, SEKSEK, OKUL_ODALAR, okulIcinde, okulBinada, okulProgram } from '../../../content/okul-ic';

export interface OkulIcDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number }; saat: () => number; night: () => number; camera?: () => T.Camera }
export interface OkulIcView { update(dt: number): void }

const HP = Math.PI / 2, CX = OKUL.cx, WH = 3.2, ROOF_H = 3.6;

function tuval(w: number, h: number, ciz: (g: CanvasRenderingContext2D, W: number, H: number) => void, px = 128): T.CanvasTexture {
  const H = px, W = Math.max(64, Math.round(H * w / h)), c = document.createElement('canvas'); c.width = W; c.height = H; ciz(c.getContext('2d')!, W, H);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
const yaz = (g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, renk: string, max: number, agirlik = '800') => {
  g.fillStyle = renk; g.font = `${agirlik} ${px}px system-ui,"Segoe UI",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(s).width; if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y);
};
function levha(text: string, bg: string, fg: string, w: number, h: number, alt?: string): T.Mesh {
  const tx = tuval(w, h, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.globalAlpha = 0.35; g.lineWidth = 4; g.strokeRect(6, 6, W - 12, H - 12); g.globalAlpha = 1;
    if (alt) { yaz(g, text, W / 2, H * 0.4, H * 0.42, fg, W - 30, '900'); yaz(g, alt, W / 2, H * 0.78, H * 0.2, fg, W - 30, '700'); } else yaz(g, text, W / 2, H / 2 + 3, H * 0.5, fg, W - 30, '900'); });
  return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tx }));
}
function bayrakTex(): T.CanvasTexture {
  return tuval(1.5, 1, (g, W, H) => {
    g.fillStyle = '#e30a17'; g.fillRect(0, 0, W, H); const G = H, cx = W * 0.5 - G * 0.25, cy = H / 2;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, G * 0.25, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e30a17'; g.beginPath(); g.arc(cx + G * 0.0625, cy, G * 0.2, 0, Math.PI * 2); g.fill();
    const sx = cx + G * 0.29, r = G * 0.125; g.fillStyle = '#fff'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = Math.PI + k * Math.PI / 5, rr = k % 2 ? r * 0.382 : r; g.lineTo(sx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill();
  }, 256);
}
const agac = (b: Batch, x: number, z: number, s = 1, ton = 0) => {
  const C = [['#4f8a4a', '#5f9a52', '#3f7a3a'], ['#5a9a4a', '#6aaa55', '#4a8a3f']][ton % 2];
  b.cyl(0.13 * s, 0.19 * s, 2.3 * s, '#6b4a2a', x, 1.15 * s, z, { seg: 7 }); b.ico(1.25 * s, C[0], x, 2.9 * s, z, { d: 1 }); b.ico(0.9 * s, C[1], x + 0.5 * s, 3.4 * s, z - 0.2 * s, { d: 1 }); b.ico(0.8 * s, C[2], x - 0.45 * s, 3.3 * s, z + 0.35 * s, { d: 1 });
};
const bank = (b: Batch, x: number, z: number, w: number, ry: number) => {
  b.push(mtx(x, 0, z, 0, ry * HP, 0));
  for (let i = 0; i < 3; i++) b.box(w, 0.04, 0.12, '#b8875a', 0, 0.45, -0.18 + i * 0.14); for (let i = 0; i < 2; i++) b.box(w, 0.1, 0.035, '#b8875a', 0, 0.65 + i * 0.14, -0.27, { rx: -0.15 });
  for (const sx of [-1, 1]) { b.box(0.06, 0.45, 0.5, '#2b2f36', sx * (w / 2 - 0.15), 0.22, -0.05); b.box(0.06, 0.5, 0.05, '#2b2f36', sx * (w / 2 - 0.15), 0.62, -0.28, { rx: -0.15 }); }
  b.pop();
};

/* ---------- kur ---------- */
interface Yapi { g: T.Group; kabuk: T.Group; duvarlar: { m: T.Object3D; x: number; z: number; nx: number; nz: number }[]; bayrak: T.Mesh; kapi: T.Mesh[]; salincak: T.Object3D[]; pano: { m: T.MeshBasicMaterial; c: HTMLCanvasElement; son: string } }

function insa(): Yapi {
  const g = new T.Group(); g.name = 'okulIc';
  const solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.04 });
  const glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false });
  const glow = new T.MeshBasicMaterial({ vertexColors: true });
  const wallM = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  const add = (b: Batch, m: T.Material, to: T.Object3D = g, cast = true) => { if (!b.empty) { const mesh = b.mesh(m, cast, true); if (m === glass) mesh.renderOrder = 2; to.add(mesh); return mesh; } return null; };
  const sx0 = SINIR.x0, sx1 = SINIR.x1, sz0 = SINIR.z0, sz1 = SINIR.z1;

  /* --- zemin ve çevre --- */
  { const b = new Batch();
    b.box(150, 0.1, 120, '#7fa85a', CX, -0.06, (sz0 + sz1) / 2);   // çim
    b.box(150, 0.04, 6, '#55595f', CX, -0.005, sz0 - 6.2); for (let x = -70; x < 70; x += 4) b.box(2, 0.006, 0.12, '#f4f2ec', CX + x, 0.02, sz0 - 6.2);   // yol + şerit
    b.box(150, 0.12, 3.4, '#cfc6b4', CX, 0.0, sz0 - 2.0); b.box(150, 0.14, 0.18, '#a39a88', CX, 0.0, sz0 - 3.7);   // kaldırım + bordür
    for (let x = -70; x < 70; x += 1.6) b.box(0.02, 0.003, 3.3, '#bdb4a2', CX + x, 0.062, sz0 - 2.0);
    // okul alanı: meydan taşı, bina altı, bahçe asfaltı
    b.box(sx1 - sx0, 0.06, OKUL.z0 - sz0, '#d8cfbd', CX, 0.0, (sz0 + OKUL.z0) / 2);
    for (let i = -13; i <= 13; i++) b.box(0.03, 0.004, OKUL.z0 - sz0 - 0.2, '#c4bba8', CX + i * 2, 0.032, (sz0 + OKUL.z0) / 2);
    for (let z = sz0 + 2; z < OKUL.z0; z += 2) b.box(sx1 - sx0 - 0.2, 0.004, 0.03, '#c4bba8', CX, 0.032, z);
    b.box(9, 0.006, 11.5, '#c9b48a', CX, 0.034, (sz0 + OKUL.z0) / 2 + 0.2); b.box(8.4, 0.007, 10.9, '#e2d4bb', CX, 0.036, (sz0 + OKUL.z0) / 2 + 0.2);   // kapıdan binaya ana yol
    b.box(sx1 - sx0, 0.06, sz1 - OKUL.z1, '#7d8086', CX, 0.0, (OKUL.z1 + sz1) / 2);   // bahçe asfaltı
    b.box(sx1 - sx0, 0.06, OKUL.z1 - OKUL.z0, '#8c8f94', CX, 0.0, (OKUL.z0 + OKUL.z1) / 2);
    // yanlarda ince çim şeritleri ve çiçekler (çit dibinde)
    for (const s of [-1, 1]) { b.box(1.4, 0.07, sz1 - sz0 - 1, '#6f9a4a', CX + s * (sx1 - CX - 0.75), 0.005, (sz0 + sz1) / 2); for (let z = sz0 + 2; z < sz1 - 1; z += 1.7) b.sph(0.12, ['#e0533c', '#ffd23f', '#f2a2b3', '#fbfaf6'][Math.abs(Math.round(z)) % 4], CX + s * (sx1 - CX - 0.75), 0.15, z, { ws: 6, hs: 4 }); }
    // basket sahası
    { const { x, z, w, d } = BASKET; b.box(w, 0.01, d, '#2f7f5a', x, 0.036, z); b.box(w - 1, 0.012, d - 1, '#c8663c', x, 0.04, z);
      const ln = (lw: number, ld: number, lx: number, lz: number) => b.box(lw, 0.006, ld, '#f4f2ec', lx, 0.05, lz);
      ln(w - 1, 0.08, x, z - (d - 1) / 2); ln(w - 1, 0.08, x, z + (d - 1) / 2); ln(0.08, d - 1, x - (w - 1) / 2, z); ln(0.08, d - 1, x + (w - 1) / 2, z); ln(w - 1, 0.08, x, z);
      b.cyl(1.6, 1.6, 0.006, '#f4f2ec', x, 0.048, z, { seg: 28 }); b.cyl(1.52, 1.52, 0.008, '#c8663c', x, 0.05, z, { seg: 28 });
      for (const s of [-1, 1]) { b.box(3.6, 0.006, 4.6, '#b85a34', x, 0.046, z + s * (d / 2 - 2.8)); b.cyl(2.8, 2.8, 0.005, '#f4f2ec', x, 0.044, z + s * (d / 2 - 1.2), { seg: 32, arc: Math.PI }); } }
    // oyun parkı: kauçuk zemin
    { const { x, z, w, d } = PARK; b.box(w, 0.02, d, '#3f9a6a', x, 0.04, z); for (let i = 0; i < 6; i++) b.box(w / 6 - 0.05, 0.022, d - 0.1, i % 2 ? '#e0533c' : '#3f9a6a', x - w / 2 + (i + 0.5) * w / 6, 0.042, z); }
    // seksek
    { const { x, z } = SEKSEK, c = ['#fbfaf6', '#ffd23f']; const kare = (dx: number, dz: number, n: number) => { b.box(0.62, 0.005, 0.62, c[n % 2], x + dx, 0.05, z + dz); b.box(0.5, 0.006, 0.5, '#7d8086', x + dx, 0.052, z + dz); b.box(0.14, 0.007, 0.08, c[n % 2], x + dx, 0.054, z + dz); };
      kare(0, 0, 0); kare(0, 0.7, 1); kare(-0.35, 1.4, 2); kare(0.35, 1.4, 3); kare(0, 2.1, 4); kare(-0.35, 2.8, 5); kare(0.35, 2.8, 6); kare(0, 3.5, 7); }
    // uzak apartmanlar (ufuk; diyar boşlukta durmasın)
    const apt = (x: number, z: number, w: number, d: number, h: number, c: string) => { b.box(w, h, d, c, x, h / 2, z); b.box(w + 0.3, 0.3, d + 0.3, '#8a4a3a', x, h + 0.15, z); const nf = Math.floor(h / 3); for (let f = 0; f < nf; f++) for (let i = 0; i < Math.floor(w / 2.2); i++) { const wx = x - w / 2 + 1.2 + i * 2.2; b.box(1.1, 1.2, 0.05, (f + i) % 3 ? '#9cc3d6' : '#f2e3b0', wx, 1.6 + f * 3, z - d / 2 - 0.03); b.box(1.1, 1.2, 0.05, '#9cc3d6', wx, 1.6 + f * 3, z + d / 2 + 0.03); } };
    for (let i = 0; i < 7; i++) apt(CX - 60 + i * 20, sz0 - 18, 12, 8, 9 + (i % 3) * 3, ['#e9dcc0', '#d9c8b0', '#efe3cf', '#cfd6e6'][i % 4]);
    for (let i = 0; i < 6; i++) apt(CX - 55 + i * 22, sz1 + 14, 12, 8, 12 + (i % 2) * 3, ['#d9c8b0', '#e9dcc0', '#cfd6e6'][i % 3]);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) apt(CX + s * 52, sz0 + 6 + i * 22, 8, 14, 9 + i * 2, ['#efe3cf', '#d9c8b0', '#e9dcc0'][i]);
    for (let i = 0; i < 9; i++) agac(b, CX - 64 + i * 16, sz0 - 9.6, 0.9, i);   // sokak ağaçları
    for (const s of [-1, 1]) for (let i = 0; i < 5; i++) agac(b, CX + s * (sx1 - CX + 6 + (i % 2) * 3), sz0 + 4 + i * 12, 1.0, i);
    add(b, solid); }

  /* --- çit ve bahçe kapısı --- */
  { const b = new Batch(), l = new Batch();
    const cit = (x0: number, x1: number, z0: number, z1: number) => {
      const L = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      b.push(mtx(cx, 0, cz, 0, -ang, 0)); b.box(L, 0.5, 0.25, '#c9bfae', 0, 0.25, 0); b.box(L, 0.05, 0.3, '#a39a88', 0, 0.52, 0);
      b.box(L, 0.05, 0.05, '#2f3740', 0, 2.0, 0); b.box(L, 0.04, 0.04, '#2f3740', 0, 0.85, 0);
      const n = Math.round(L / 0.16); for (let i = 0; i <= n; i++) b.box(0.025, 1.5, 0.025, '#2f3740', -L / 2 + i * L / n, 1.28, 0);
      const k = Math.max(1, Math.round(L / 2.4)); for (let i = 0; i <= k; i++) { const px = -L / 2 + i * L / k; b.box(0.3, 2.3, 0.3, '#c9bfae', px, 1.15, 0); b.box(0.36, 0.08, 0.36, '#a39a88', px, 2.33, 0); }
      b.pop();
    };
    cit(sx0, CIT_KAPI.x0, sz0, sz0); cit(CIT_KAPI.x1, sx1, sz0, sz0); cit(sx0, sx1, sz1, sz1); cit(sx0, sx0, sz0, sz1); cit(sx1, sx1, sz0, sz1);
    // kemer: iki ayak, üstte levha, yanlarda fener; kapı kanatları içe açık
    for (const s of [-1, 1]) { const x = s < 0 ? CIT_KAPI.x0 : CIT_KAPI.x1; b.box(0.5, 3.4, 0.5, '#b9ad99', x, 1.7, sz0); b.box(0.6, 0.12, 0.6, '#a39a88', x, 3.46, sz0); b.cyl(0.06, 0.06, 0.4, '#2b2f36', x, 3.72, sz0, { seg: 6 }); l.sph(0.16, '#fff1c8', x, 4.0, sz0, { ws: 10, hs: 8 });
      b.push(mtx(x - s * 0.25, 0, sz0 + 0.05, 0, s * 1.25, 0)); b.box(2.0, 0.05, 0.05, '#2f3740', -s * 1.0, 1.9, 0); b.box(2.0, 0.05, 0.05, '#2f3740', -s * 1.0, 0.25, 0); for (let i = 0; i <= 12; i++) b.box(0.025, 1.65, 0.025, '#2f3740', -s * i * 0.16, 1.07, 0); b.pop(); }
    b.box(CIT_KAPI.x1 - CIT_KAPI.x0 + 0.5, 0.18, 0.3, '#a2472f', CX, 3.3, sz0);
    add(b, solid); add(l, glow, g, false);
    const k = levha('MARTIKÖY İLKOKULU', '#fbf3e4', '#a2472f', 4.2, 0.62, 'Kuruluş 1954'); k.position.set(CX, 3.75, sz0 - 0.05); k.rotation.y = Math.PI; g.add(k);
    const k2 = k.clone(); k2.position.z = sz0 + 0.05; k2.rotation.y = 0; g.add(k2); }

  /* --- meydan ve bahçe dekoru --- */
  let bayrak: T.Mesh; const salincak: T.Object3D[] = [];
  { const b = new Batch(), l = new Batch(), gl = new Batch();
    for (const d of OKUL_DEKOR) {
      const { x, z } = d;
      if (d.k === 'bayrak') { b.cyl(0.7, 0.8, 0.35, '#b9ad99', x, 0.17, z, { seg: 16 }); b.cyl(0.45, 0.5, 0.2, '#a39a88', x, 0.45, z, { seg: 16 }); b.cyl(0.06, 0.08, 9.0, '#c9ced6', x, 4.9, z, { seg: 10 }); b.sph(0.12, '#c9a23a', x, 9.45, z, { ws: 10, hs: 8 }); }
      else if (d.k === 'bust') {
        b.box(1.6, 0.25, 1.6, '#8a8f96', x, 0.12, z); b.box(1.0, 1.5, 1.0, '#5b6068', x, 1.0, z); b.box(1.15, 0.12, 1.15, '#8a8f96', x, 1.8, z); b.box(0.62, 0.32, 0.02, '#c9a23a', x, 1.05, z - 0.51);
        // bronz büst (stilize): göğüs, omuzlar, boyun, baş, geriye taranmış saç
        const BR = '#7a5a34'; b.box(0.7, 0.42, 0.36, BR, x, 2.08, z, { r: 0.12, s: 3 }); b.box(0.28, 0.12, 0.3, BR, x, 2.32, z); b.cyl(0.08, 0.09, 0.14, BR, x, 2.4, z, { seg: 10 });
        b.sph(0.17, BR, x, 2.62, z - 0.01, { ws: 14, hs: 12, sy: 1.12 }); b.sph(0.165, '#6a4c2a', x, 2.72, z + 0.03, { ws: 12, hs: 8, sy: 0.6 });
        for (let i = 0; i < 9; i++) { const a = -0.7 + i * 0.175; b.sph(0.05, i % 2 ? '#c0392b' : '#5f9a52', x + Math.sin(a) * 0.62, 0.36, z - 0.62 + Math.cos(a) * 0.08, { ws: 6, hs: 4 }); }   // kaide önünde çiçekler
      }
      else if (d.k === 'cicek') { b.box(d.w, 0.45, d.d, '#b9ad99', x, 0.22, z); b.box(d.w - 0.16, 0.06, d.d - 0.16, '#5a4632', x, 0.46, z); for (let i = 0; i < Math.round(d.w / 0.28); i++) for (let j = 0; j < 3; j++) { const px = x - d.w / 2 + 0.2 + i * 0.28, pz = z - d.d / 2 + 0.3 + j * 0.3; b.ico(0.13, j % 2 ? '#4f8a4a' : '#5f9a52', px, 0.58, pz, { d: 0 }); if ((i + j) % 2) b.sph(0.055, ['#e0533c', '#ffd23f', '#f2a2b3', '#c94f6d'][(i * 3 + j) % 4], px + 0.04, 0.7, pz, { ws: 6, hs: 4 }); } }
      else if (d.k === 'bank') bank(b, x, z, d.w, d.ry || 0);
      else if (d.k === 'agac') agac(b, x, z, 1.05, Math.round(x + z));
      else if (d.k === 'cop') { b.cyl(0.24, 0.2, 0.75, '#2f7f5a', x, 0.38, z, { seg: 10 }); b.cyl(0.26, 0.26, 0.05, '#235f43', x, 0.77, z, { seg: 10 }); }
      else if (d.k === 'pano') { for (const s of [-1, 1]) b.box(0.08, 2.0, 0.08, '#2b2f36', x + s * (d.w / 2 - 0.1), 1.0, z); b.box(d.w, 1.3, 0.1, '#5a3b2a', x, 1.45, z); }
      else if (d.k === 'pota') { b.push(mtx(x, 0, z, 0, (d.ry || 0) * HP, 0)); b.box(0.6, 0.1, 0.6, '#2b2f36', 0, 0.05, -0.5); b.cyl(0.07, 0.07, 3.0, '#2b2f36', 0, 1.6, -0.5, { seg: 8 }); b.box(0.08, 0.08, 0.9, '#2b2f36', 0, 3.05, -0.1); b.box(1.6, 1.0, 0.06, '#fbfaf6', 0, 3.3, 0.35); b.box(0.6, 0.45, 0.065, '#e0533c', 0, 3.15, 0.36); b.box(0.5, 0.35, 0.07, '#fbfaf6', 0, 3.15, 0.37); b.tor(0.23, 0.02, '#e0533c', 0, 3.0, 0.62, { rx: HP, ts: 18 }); for (let i = 0; i < 8; i++) b.box(0.01, 0.4, 0.01, '#fbfaf6', Math.cos(i * 0.785) * 0.19, 2.8, 0.62 + Math.sin(i * 0.785) * 0.19); b.pop(); }
      else if (d.k === 'salincak') {
        b.push(mtx(x, 0, z, 0, 0, 0)); for (const s of [-1, 1]) { b.box(0.08, 2.5, 0.08, '#e0533c', s * d.w / 2, 1.2, -0.55, { rx: 0.22 }); b.box(0.08, 2.5, 0.08, '#e0533c', s * d.w / 2, 1.2, 0.55, { rx: -0.22 }); } b.cyl(0.06, 0.06, d.w + 0.2, '#e0533c', 0, 2.4, 0, { rz: HP, seg: 8 }); b.pop();
        for (const s of [-1, 1]) { const o = new T.Group(); o.position.set(x + s * d.w / 4, 2.4, z); const sb = new Batch(); for (const q of [-0.22, 0.22]) sb.box(0.015, 1.9, 0.015, '#9aa5b0', q, -0.95, 0); sb.box(0.55, 0.05, 0.25, '#ffd23f', 0, -1.9, 0); add(sb, solid, o); g.add(o); salincak.push(o); }
      }
      else if (d.k === 'kaydirak') { b.push(mtx(x, 0, z, 0, 0, 0)); for (const s of [-1, 1]) { b.box(0.06, 2.0, 0.06, '#3f8fc9', s * 0.5, 1.0, -1.6); b.box(0.06, 2.0, 0.06, '#3f8fc9', s * 0.5, 1.0, -0.9); } b.box(1.1, 0.06, 0.8, '#ffd23f', 0, 1.9, -1.25); for (let i = 0; i < 6; i++) b.box(0.9, 0.04, 0.12, '#3f8fc9', 0, 0.3 + i * 0.3, -1.9 - i * 0.0, {}); b.box(0.8, 0.05, 2.6, '#e0533c', 0, 1.0, 0.4, { rx: 0.62 }); for (const s of [-1, 1]) b.box(0.05, 0.18, 2.6, '#e0533c', s * 0.42, 1.08, 0.4, { rx: 0.62 }); b.pop(); }
      else if (d.k === 'tahterevalli') { b.box(0.3, 0.45, 0.3, '#2b2f36', x, 0.22, z); b.box(d.w, 0.08, 0.3, '#3f8fc9', x, 0.5, z, { rz: 0.16 }); for (const s of [-1, 1]) { b.box(0.06, 0.25, 0.3, '#ffd23f', x + s * (d.w / 2 - 0.25), 0.6 + s * 0.24, z); } }
      else if (d.k === 'kum') { b.box(d.w, 0.3, d.d, '#b9ad99', x, 0.15, z); b.box(d.w - 0.24, 0.05, d.d - 0.24, '#e9d6a0', x, 0.28, z); b.box(0.2, 0.15, 0.2, '#e0533c', x - 0.5, 0.35, z + 0.3); b.cone(0.18, 0.3, '#ffd23f', x + 0.6, 0.42, z - 0.4, { seg: 8 }); }
      else if (d.k === 'cesme') { b.box(d.w, 0.9, d.d, '#b9ad99', x, 0.45, z); b.box(d.w + 0.1, 0.08, d.d + 0.1, '#a39a88', x, 0.92, z); for (const s of [-1, 1]) b.cyl(0.02, 0.02, 0.12, '#c9ced6', x + s * 0.3, 1.0, z - 0.2, { seg: 6 }); gl.box(d.w - 0.2, 0.02, 0.2, '#9fd8ef', x, 0.94, z - 0.22); }
    }
    // direk lambaları (gece parlayan küreler; ışık eklemez)
    for (const [lx, lz] of [[-18, 34], [18, 34], [-14, 62], [14, 62], [-22, 76], [22, 76], [-6, 80], [6, 80]]) { b.cyl(0.05, 0.07, 3.6, '#2b2f36', CX + lx, 1.8, lz, { seg: 8 }); b.box(0.36, 0.1, 0.36, '#2b2f36', CX + lx, 3.65, lz); l.sph(0.17, '#fff1c8', CX + lx, 3.5, lz, { ws: 10, hs: 8 }); }
    add(b, solid); add(l, glow, g, false); add(gl, glass, g, false);
    // bayrak (dalgalanır)
    const bd = OKUL_DEKOR.find(q => q.k === 'bayrak')!;
    bayrak = new T.Mesh(new T.PlaneGeometry(2.4, 1.6, 12, 2), new T.MeshLambertMaterial({ map: bayrakTex(), side: T.DoubleSide })); bayrak.position.set(bd.x + 1.26, 8.55, bd.z); g.add(bayrak);
    const pb = OKUL_DEKOR.find(q => q.k === 'bust')!; const pl = levha('ATATÜRK', '#c9a23a', '#3a2416', 0.58, 0.28); pl.position.set(pb.x, 1.05, pb.z - 0.525); pl.rotation.y = Math.PI; g.add(pl);
    const pn = OKUL_DEKOR.find(q => q.k === 'pano')!; void pn;
  }
  // meydan panosu: okulun günlük programı (saatle güncellenir)
  const pc = document.createElement('canvas'); pc.width = 512; pc.height = 256;
  const pmat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(pc) }); (pmat.map as T.CanvasTexture).colorSpace = T.SRGBColorSpace;
  { const pd = OKUL_DEKOR.find(q => q.k === 'pano')!; const m = new T.Mesh(new T.PlaneGeometry(pd.w - 0.12, 1.18), pmat); m.position.set(pd.x, 1.45, pd.z - 0.06); m.rotation.y = Math.PI; g.add(m); }

  /* --- bina: koridor zemini, koridor + hol duvarları (içe bakar), süsler --- */
  const duvarlar: Yapi['duvarlar'] = [];
  { const b = new Batch(), l = new Batch();
    const top = 0.14;
    // koridor + hol zemini: krem / gri karo, koridor kenarında koyu bordür
    b.box(OKUL.x1 - OKUL.x0, 0.06, KOR.z1 - KOR.z0, '#e6e0d4', CX, top - 0.03, (KOR.z0 + KOR.z1) / 2); b.box(HOL.x1 - HOL.x0, 0.06, KOR.z0 - OKUL.z0, '#e6e0d4', CX, top - 0.03, (OKUL.z0 + KOR.z0) / 2);
    b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0, 0.06, OKUL.z1 - KOR.z1, '#e6e0d4', CX, top - 0.03, (KOR.z1 + OKUL.z1) / 2);
    for (let x = OKUL.x0 + 0.6; x < OKUL.x1; x += 0.6) for (let z = KOR.z0 + 0.3; z < KOR.z1; z += 0.6) if ((Math.round((x - OKUL.x0) / 0.6) + Math.round((z - KOR.z0) / 0.6)) % 2) b.box(0.58, 0.004, 0.58, '#cfc7b8', x - 0.3, top + 0.002, z);
    for (const zz of [KOR.z0 + 0.35, KOR.z1 - 0.35]) b.box(OKUL.x1 - OKUL.x0 - 0.5, 0.005, 0.1, '#8a6a4a', CX, top + 0.003, zz);
    b.box(2.6, 0.006, 3.6, '#a2472f', CX, top + 0.004, OKUL.z0 + 2.1); b.box(2.3, 0.008, 3.3, '#c9a23a', CX, top + 0.005, OKUL.z0 + 2.1); b.box(2.1, 0.01, 3.1, '#a2472f', CX, top + 0.006, OKUL.z0 + 2.1);   // hol halısı
    b.box(1.6, 0.012, 0.9, '#3a3d42', CX, top + 0.007, OKUL.z0 + 0.55);   // paspas
    add(b, solid); add(l, glow, g, false);
    // içe bakan duvar parçası + süsü (süs yalnız duvar kameraya dönükken)
    const duvar = (x0: number, x1: number, z0: number, z1: number, nx: number, nz: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = Math.atan2(nx, nz);
      const wb = new Batch(), tb = new Batch(); wb.push(mtx(cx, top, cz, 0, ry, 0)); tb.push(mtx(cx, top, cz, 0, ry, 0));
      wb.plane(len, WH, '#f4ead2', 0, WH / 2, 0); wb.plane(len, 1.1, '#5f8f6a', 0, 0.55, 0.005);
      tb.box(len, 0.12, 0.03, '#3a2416', 0, 0.06, 0.02); tb.box(len, 0.05, 0.035, '#c9a23a', 0, 1.1, 0.02); tb.box(len, 0.08, 0.25, '#e9e4da', 0, WH + 0.04, -0.125);
      wb.pop(); tb.pop();
      const wm = add(wb, wallM, g, false)!; const tm = add(tb, wallM, g, false)!;
      duvarlar.push({ m: tm, x: cx, z: cz, nx, nz }); void wm;
      return tm;
    };
    // koridorun güney duvarı (ön sıra odaların kapıları), kuzey duvarı (arka sıra), uçlar, hol yanları, cephe (hol), arka geçit yanları
    const kapilar = (on: boolean) => OKUL_ODALAR.filter(o => o.on === on).map(o => (o.x0 + o.x1) / 2);
    const parcala = (z: number, nz: number, acik: [number, number][]) => { let x = OKUL.x0 + 0.25; for (const [a, c] of acik.sort((p, q) => p[0] - q[0])) { if (a > x + 0.01) duvar(x, a, z, z, 0, nz); x = c; } if (OKUL.x1 - 0.25 > x + 0.01) duvar(x, OKUL.x1 - 0.25, z, z, 0, nz); };
    parcala(KOR.z0 + 0.01, 1, [...kapilar(true).map(x => [x - 0.85, x + 0.85] as [number, number]), [HOL.x0, HOL.x1]]);
    parcala(KOR.z1 - 0.01, -1, [...kapilar(false).map(x => [x - 0.85, x + 0.85] as [number, number]), [GIRIS_KAPI.x0, GIRIS_KAPI.x1]]);
    duvar(OKUL.x0 + 0.26, OKUL.x0 + 0.26, KOR.z1, KOR.z0, 1, 0); duvar(OKUL.x1 - 0.26, OKUL.x1 - 0.26, KOR.z0, KOR.z1, -1, 0);
    duvar(HOL.x0 + 0.26, HOL.x0 + 0.26, KOR.z0, OKUL.z0, 1, 0); duvar(HOL.x1 - 0.26, HOL.x1 - 0.26, OKUL.z0, KOR.z0, -1, 0);
    duvar(HOL.x0, GIRIS_KAPI.x0, OKUL.z0 + 0.26, OKUL.z0 + 0.26, 0, 1); duvar(GIRIS_KAPI.x1, HOL.x1, OKUL.z0 + 0.26, OKUL.z0 + 0.26, 0, 1);
    duvar(GIRIS_KAPI.x0 + 0.01, GIRIS_KAPI.x0 + 0.01, KOR.z1, OKUL.z1, 1, 0); duvar(GIRIS_KAPI.x1 - 0.01, GIRIS_KAPI.x1 - 0.01, OKUL.z1, KOR.z1, -1, 0);
    // kapı kasaları ve oda levhaları (koridor tarafında; levha iki yüzlü değil: koridordan okunur)
    { const kb = new Batch(); for (const o of OKUL_ODALAR) { const x = (o.x0 + o.x1) / 2, z = o.on ? KOR.z0 + 0.03 : KOR.z1 - 0.03, s = o.on ? 1 : -1;
        for (const q of [-1, 1]) kb.box(0.12, 2.3, 0.12, '#8a6a4a', x + q * 0.92, top + 1.15, z); kb.box(1.96, 0.14, 0.12, '#8a6a4a', x, top + 2.36, z);
        const lv = levha(o.ad.toLocaleUpperCase('tr'), o.tur === 'sinif' || o.tur === 'okul' ? '#2f6f9a' : o.tur === 'kantin' ? '#e0533c' : '#a2472f', '#ffffff', 1.9, 0.3); lv.position.set(x, top + 2.72, z + s * 0.04); lv.rotation.y = o.on ? 0 : Math.PI; g.add(lv); }
      add(kb, solid); }
    // koridor eşyaları
    { const b2 = new Batch(), g2 = new Batch(), l2 = new Batch();
      for (const d of KOR_DEKOR) {
        const ry = d.duvar === 'G' ? 0 : d.duvar === 'K' ? Math.PI : d.duvar === 'B' ? HP : -HP; b2.push(mtx(d.x, top, d.z, 0, ry, 0)); g2.push(mtx(d.x, top, d.z, 0, ry, 0)); l2.push(mtx(d.x, top, d.z, 0, ry, 0));
        const W = d.duvar === 'B' || d.duvar === 'D' ? d.d : d.w, D = d.duvar === 'B' || d.duvar === 'D' ? d.w : d.d;
        if (d.k === 'dolap') { const n = Math.round(W / 0.38); for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; b2.box(W / n - 0.02, 1.75, D, ['#2f6f9a', '#3f7fb3', '#e0533c', '#ffd23f'][Math.floor(i / 2) % 4], x, 0.875, 0); b2.box(0.03, 0.1, 0.02, '#c9ced6', x + 0.1, 1.0, D / 2 + 0.01); for (let k = 0; k < 3; k++) b2.box(0.2, 0.015, 0.01, '#1f3a5f', x, 1.5 + k * 0.04, D / 2 + 0.01); } }
        else if (d.k === 'pano') { b2.box(W + 0.08, 1.15, 0.05, '#8a6a4a', 0, 1.6, 0); const pm = levha(d.txt || '', '#c9a46a', '#3a2416', W, 0.24); pm.position.set(d.x, top + 2.06, d.z); pm.rotation.y = ry; pm.translateZ(0.035); g.add(pm); for (let i = 0; i < 7; i++) b2.box(0.26, 0.32, 0.01, ['#fbfaf6', '#ffd23f', '#f2a2b3', '#a9d6ec', '#c8e6a0'][i % 5], -W / 2 + 0.3 + i * (W - 0.6) / 6, 1.45 + (i % 2) * 0.12, 0.035, { rz: ((i * 5) % 3 - 1) * 0.06 }); }
        else if (d.k === 'sukesme') { b2.box(W, 0.9, D, '#c9ced6', 0, 0.45, 0); b2.box(W - 0.06, 0.06, D - 0.06, '#9aa5b0', 0, 0.92, 0); b2.cyl(0.015, 0.015, 0.1, '#c9ced6', 0, 0.98, 0.05, { seg: 6 }); g2.cyl(0.1, 0.1, 0.35, '#d8eef6', 0, 1.35, -0.05, { seg: 10 }); l2.cyl(0.09, 0.09, 0.2, '#9fd8ef', 0, 1.27, -0.05, { seg: 10 }); }
        else if (d.k === 'bank') { b2.box(W, 0.05, D, '#b8875a', 0, 0.44, 0); for (const s of [-1, 1]) b2.box(0.05, 0.44, D - 0.05, '#2b2f36', s * (W / 2 - 0.1), 0.22, 0); }
        else if (d.k === 'yangin') { b2.cyl(0.08, 0.08, 0.45, '#d93a3a', 0, 0.4, 0, { seg: 10 }); b2.sph(0.08, '#d93a3a', 0, 0.63, 0, { ws: 8, hs: 6, sy: 0.6 }); b2.box(0.07, 0.06, 0.05, '#2b2f36', 0, 0.7, 0); b2.box(0.22, 0.16, 0.01, '#d93a3a', 0, 1.25, -0.1); }
        else if (d.k === 'saksi') { b2.cyl(0.26, 0.2, 0.55, '#d9d2c4', 0, 0.28, 0, { seg: 12 }); b2.cyl(0.04, 0.05, 0.9, '#6b4a2a', 0, 0.9, 0, { seg: 6 }); b2.ico(0.38, '#4f8a4a', 0, 1.45, 0, { d: 1 }); b2.ico(0.26, '#5f9a52', 0.12, 1.75, -0.08, { d: 1 }); }
        else if (d.k === 'kupa') { b2.box(W, 1.9, D, '#5a3b2a', 0, 0.95, 0); for (let k = 0; k < 3; k++) { const y = 0.5 + k * 0.5; b2.box(W - 0.1, 0.02, D - 0.08, '#d8cfbd', 0, y, 0); for (let i = 0; i < 4; i++) { const x = -W / 2 + 0.25 + i * (W - 0.5) / 3, s = 0.7 + ((i + k) % 3) * 0.15; b2.cyl(0.05 * s, 0.07 * s, 0.05, '#2b2f36', x, y + 0.035, 0, { seg: 8 }); b2.lathe([[0.01, 0], [0.07 * s, 0.03], [0.08 * s, 0.13 * s], [0.06 * s, 0.14 * s]], (i + k) % 3 === 1 ? '#c9ced6' : '#d9b23a', x, y + 0.08 * s, 0, { seg: 12 }); } } g2.box(W - 0.06, 1.7, 0.02, '#d8eef6', 0, 1.0, D / 2 + 0.01); }
        else if (d.k === 'nobetci') { b2.box(W, 0.75, D, '#b8a27e', 0, 0.375, 0); b2.box(W + 0.04, 0.04, D + 0.04, '#8a6a4a', 0, 0.77, 0); b2.box(0.24, 0.02, 0.32, '#fbfaf6', 0, 0.8, -0.2); b2.box(0.18, 0.06, 0.12, '#1b1d21', 0.05, 0.82, 0.35); sandalye(b2, 0, -D / 2 - 0.05, 0); const nm = levha('NÖBETÇİ ÖĞRETMEN', '#1d4f86', '#ffffff', 1.1, 0.2); nm.position.set(d.x, top + 1.3, d.z); nm.rotation.y = ry; nm.translateZ(D / 2 + 0.25); g.add(nm); }
        else if (d.k === 'ataturkKosesi') {
          b2.box(W, 0.95, D, '#5a3b2a', 0, 0.475, 0); b2.box(W + 0.05, 0.05, D + 0.05, '#3a2416', 0, 0.97, 0); b2.box(W * 0.9, 0.01, D * 0.9, '#a2472f', 0, 1.0, 0);   // vitrin dolabı (kırmızı kadife)
          g2.box(W * 0.95, 0.45, D * 0.95, '#d8eef6', 0, 1.22, 0); b2.box(0.28, 0.06, 0.38, '#7a2a1d', 0, 1.04, 0.2); b2.box(0.25, 0.04, 0.35, '#c9a23a', 0, 1.075, 0.2); b2.box(0.2, 0.03, 0.3, '#2b2f36', 0, 1.03, -0.45);   // Nutuk + belge
          // duvarda büyük portre (altın çerçeve) ve iki yanda çerçeveler; yanda direkli bayrak
          b2.box(0.95, 1.25, 0.05, '#b8902f', 0, 2.05, -0.38); b2.box(0.85, 1.15, 0.02, '#2a2e35', 0, 2.05, -0.355);
          b2.box(0.5, 0.18, 0.4, '#1b1d21', 0, 1.78, -0.33, { r: 0.1, s: 3 }); b2.sph(0.12, '#e6c7a6', 0, 2.1, -0.33, { ws: 10, hs: 8, sy: 1.15 }); b2.sph(0.12, '#c8c3b8', 0, 2.17, -0.34, { ws: 10, hs: 6, sy: 0.55 }); b2.box(0.1, 0.08, 0.02, '#f2efe8', 0, 1.9, -0.33);
          for (const s of [-1, 1]) { b2.box(0.5, 0.65, 0.04, '#5a3b2a', s * 0.95, 1.9, -0.38); b2.box(0.44, 0.58, 0.02, '#fbf6e8', s * 0.95, 1.9, -0.36); for (let i = 0; i < 8; i++) b2.box(0.3, 0.012, 0.005, '#9a8f80', s * 0.95, 2.1 - i * 0.055, -0.348); }
          const al = levha('ATATÜRK KÖŞESİ', '#a2472f', '#ffffff', 1.3, 0.24); al.position.set(d.x, top + 2.9, d.z); al.rotation.y = ry; al.translateZ(-0.36); g.add(al);
        }
        b2.pop(); g2.pop(); l2.pop();
      }
      add(b2, solid); add(g2, glass, g, false); add(l2, glow, g, false); }
  }
  // giriş: cam çift kanat (yaklaşınca açılır)
  const kapi: T.Mesh[] = [];
  for (const s of [-1, 1]) { const m = new T.Mesh(new T.BoxGeometry((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 2 - 0.04, 2.3, 0.05), new T.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0.3, depthWrite: false })); m.position.set(CX + s * (GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4, 0.14 + 1.15, OKUL.z0 + 0.12); m.userData.sx = s; m.renderOrder = 2; g.add(m); kapi.push(m);
    const kasa = new T.Mesh(new T.BoxGeometry(0.06, 2.3, 0.07), new T.MeshStandardMaterial({ color: '#3f4a55' })); kasa.position.set(-s * ((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4 - 0.02) + 0, 0, 0); m.add(kasa); }

  /* --- dış kabuk: cephe (dışa bakar), kiremit çatı, giriş saçağı; bina içindeyken gizli --- */
  const kabuk = new T.Group(); kabuk.name = 'okulKabuk'; g.add(kabuk);
  { const b = new Batch(), gl = new Batch(), l = new Batch(), fh = ROOF_H, x0 = OKUL.x0, x1 = OKUL.x1, z0 = OKUL.z0, z1 = OKUL.z1, w = x1 - x0, d = z1 - z0;
    const cephe = (len: number, cx: number, cz: number, ry: number, kapiAcik: [number, number] | null) => {
      b.push(mtx(cx, 0, cz, 0, ry, 0)); gl.push(mtx(cx, 0, cz, 0, ry, 0)); l.push(mtx(cx, 0, cz, 0, ry, 0));
      const seg: [number, number][] = kapiAcik ? [[-len / 2, kapiAcik[0]], [kapiAcik[1], len / 2]] : [[-len / 2, len / 2]];
      for (const [a, c] of seg) { const L = c - a, m = (a + c) / 2; b.plane(L, fh, '#efc98c', m, fh / 2, 0); b.plane(L, 0.9, '#a2472f', m, 0.45, 0.004); }
      b.box(len + 0.2, 0.25, 0.3, '#fbf3e4', 0, fh - 0.05, 0.1); b.box(len, 0.08, 0.06, '#fbf3e4', 0, 0.92, 0.03);
      const n = Math.floor(len / 2.6);
      for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5) * len / n; if (kapiAcik && u > kapiAcik[0] - 1.0 && u < kapiAcik[1] + 1.0) continue;
        b.box(1.45, 1.6, 0.08, '#fbfaf6', u, 1.95, 0.04); gl.box(1.3, 1.45, 0.02, '#8fb8cc', u, 1.95, 0.07); b.box(0.05, 1.45, 0.05, '#fbfaf6', u, 1.95, 0.09); b.box(1.6, 0.07, 0.2, '#e9e4da', u, 1.12, 0.1); }
      b.pop(); gl.pop(); l.pop();
    };
    cephe(w, CX, z0 - 0.01, Math.PI, [-(GIRIS_KAPI.x1 - CX) - 0.05, -(GIRIS_KAPI.x0 - CX) + 0.05]);
    cephe(w, CX, z1 + 0.01, 0, [GIRIS_KAPI.x0 - CX - 0.05, GIRIS_KAPI.x1 - CX + 0.05]);
    cephe(d, x0 - 0.01, (z0 + z1) / 2, -HP, null); cephe(d, x1 + 0.01, (z0 + z1) / 2, HP, null);
    // kiremit kırma çatı: iki eğik ana yüz + iki üçgen uç (kalın kutularla), mahya
    const ov = 0.6, rh = 3.2, rw = w + 2 * ov, rd = d + 2 * ov, sl = Math.atan2(rh, rd / 2), ln = Math.hypot(rh, rd / 2);
    for (const s of [-1, 1]) { b.box(rw - rd * 0.5, 0.18, ln, '#b5502f', CX, fh + rh / 2, (z0 + z1) / 2 + s * rd / 4, { rx: s * sl }); for (let i = 0; i < 14; i++) b.box(rw - rd * 0.5, 0.03, 0.05, '#9a4027', CX, fh + rh / 2 + 0.1, (z0 + z1) / 2 + s * rd / 4 + (i / 13 - 0.5) * ln * Math.cos(sl) * s * -1 * -1, { rx: s * sl }); }
    for (const s of [-1, 1]) { const ex = CX + s * (rw / 2 - rd / 4); b.box(rd * 0.5, 0.18, ln, '#b5502f', ex, fh + rh / 2, (z0 + z1) / 2 - rd / 4, { rx: -sl }); b.box(rd * 0.5, 0.18, ln, '#b5502f', ex, fh + rh / 2, (z0 + z1) / 2 + rd / 4, { rx: sl }); }
    b.box(rw - rd * 0.5 + 0.2, 0.22, 0.3, '#8a3a22', CX, fh + rh + 0.05, (z0 + z1) / 2);
    b.box(rw, 0.25, rd, '#e9e4da', CX, fh + 0.05, (z0 + z1) / 2);   // saçak altı
    for (const s of [-1, 1]) b.box(0.7, 1.2, 0.7, '#a2472f', CX + s * 14, fh + rh * 0.55, (z0 + z1) / 2 + 2.5);   // bacalar
    // giriş saçağı (kolonlu), basamak taşı, zil, okul tabelası
    b.box(6.2, 0.22, 2.6, '#fbf3e4', CX, 3.2, z0 - 1.25); for (const s of [-1, 1]) b.cyl(0.13, 0.15, 3.1, '#fbf3e4', CX + s * 2.8, 1.6, z0 - 2.3, { seg: 12 }); b.box(6.6, 0.12, 3.0, '#cfc6b4', CX, 0.06, z0 - 1.3);
    b.box(0.3, 0.22, 0.1, '#c0392b', CX + 2.2, 2.75, z0 - 0.08); b.cyl(0.11, 0.11, 0.06, '#c9a23a', CX + 2.2, 2.75, z0 - 0.14, { rx: HP, seg: 12 });
    l.sph(0.18, '#fff1c8', CX - 2.0, 2.95, z0 - 1.2, { ws: 10, hs: 8 }); l.sph(0.18, '#fff1c8', CX + 2.0, 2.95, z0 - 1.2, { ws: 10, hs: 8 });
    const ms = add(b, solid, kabuk); if (ms) ms.castShadow = true; add(gl, glass, kabuk, false); add(l, glow, kabuk, false);
    const tb = levha('MARTIKÖY İLKOKULU', '#fbf3e4', '#a2472f', 6.0, 0.8); tb.position.set(CX, 3.0 + 0.62, z0 - 2.57); tb.rotation.y = Math.PI; kabuk.add(tb);
    const tb2 = levha('BAHÇE', '#fbf3e4', '#2f6f4a', 1.8, 0.4); tb2.position.set(CX, 2.9, z1 + 0.06); kabuk.add(tb2); }

  return { g, kabuk, duvarlar, bayrak: bayrak!, kapi, salincak, pano: { m: pmat, c: pc, son: '' } };
}
function sandalye(b: Batch, x: number, z: number, ry: number) {
  b.push(mtx(x, 0, z, 0, ry, 0)); b.box(0.42, 0.04, 0.4, '#2b2f36', 0, 0.45, 0); b.box(0.4, 0.34, 0.04, '#2b2f36', 0, 0.67, -0.18); for (const [dx, dz] of [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]]) b.box(0.025, 0.45, 0.025, '#3a3d42', dx, 0.22, dz); b.pop();
}
function panoCiz(c: HTMLCanvasElement, saat: number) {
  const g = c.getContext('2d')!, W = c.width, H = c.height, pr = okulProgram(saat);
  g.fillStyle = '#22272b'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c9a23a'; g.lineWidth = 6; g.strokeRect(6, 6, W - 12, H - 12);
  yaz(g, 'MARTIKÖY İLKOKULU', W / 2, 34, 30, '#ffd23f', W - 40, '900');
  yaz(g, 'Şimdi: ' + pr.ad, W / 2, 80, 30, '#f4ead2', W - 40, '800');
  const satir = ['08:30 Tören · 09:00 1. ders', '10:20 Teneffüs · 11:00 2. ders', '12:00 Öğle · 13:30 3. ders', '14:50 Çıkış'];
  satir.forEach((s, i) => yaz(g, s, W / 2, 128 + i * 30, 22, '#cfd8dc', W - 40, '600'));
}

export function createOkulIc(d: OkulIcDeps): OkulIcView {
  let v: Yapi | null = null, t = 0, ac = 0;
  const cam = new T.Vector3();
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), icerde = okulIcinde(hp, 10);
      if (!icerde) { if (v) v.g.visible = false; return; }
      if (!v) v = insa();
      if (v.g.parent !== sahne) sahne.add(v.g);
      v.g.visible = true; t += dt;
      // dışarıdayken kabuk kapalı bina; içerideyken gizli (odalar bebek evi gibi açık)
      v.kabuk.visible = !okulBinada(hp);
      // duvar süsü yalnız duvar kameraya dönükken (odalardaki trim kuralı)
      const c = d.camera?.();
      if (c) { cam.setFromMatrixPosition(c.matrixWorld); for (const w of v.duvarlar) w.m.visible = (cam.x - w.x) * w.nx + (cam.z - w.z) * w.nz > 0; }
      // bayrak dalgası, salıncaklar, giriş kapısı
      { const p = v.bayrak.geometry.attributes.position as T.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 1.2; p.setZ(i, Math.sin(t * 3.0 + x * 2.2) * 0.13 * x); } p.needsUpdate = true; }
      const pr = okulProgram(d.saat());
      for (let i = 0; i < v.salincak.length; i++) v.salincak[i].rotation.x = (pr.faz === 'teneffus' || pr.faz === 'ogle' ? 0.35 : 0.04) * Math.sin(t * 2.1 + i * 1.7);
      const yakin = Math.abs(hp.x - CX) < 2.4 && Math.abs(hp.z - OKUL.z0) < 2.2;
      ac += ((yakin ? 1 : 0) - ac) * Math.min(1, dt * 5);
      for (const m of v.kapi) m.position.x = CX + m.userData.sx * ((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4 + ac * 0.75);
      if (v.pano.son !== pr.ad) { v.pano.son = pr.ad; panoCiz(v.pano.c, d.saat()); (v.pano.m.map as T.CanvasTexture).needsUpdate = true; }
      void d.night;
    },
  };
}
