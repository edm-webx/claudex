/**
 * Martıköy İlkokulu eşyaları (2026-11-28, content/okul-yerlesim.ts): view/world/ic-mekan-look.ts'in eşya kurucularına eklenir (OKUL_F).
 * Yerel çerçeve: eşya +z'ye bakar, taban y = 0; duvar eşyaları (OKUL_WALLY) yüksekliğini kendisi verir (it.y ya da varsayılan).
 * Her eşyanın kendi görseli var: Türk bayrağı, Atatürk portresi, İstiklal Marşı / Gençliğe Hitabe çerçeveleri, periyodik tablo, Türkiye haritası,
 * duvar saati, müdür masası, laboratuvar tezgâhı, iskelet modeli, davul seti, enstrüman duvarı, resim sehpaları... Saf görünüm, sim yok.
 */
import * as T from 'three';
import type { Batch } from '../../../engine/prefab/batch';
import type { IcItem, IcMekan } from '../../../content/ic-mekan';

/** ic-mekan-look Ctx'inin burada kullanılan kısmı */
export interface OkulCtx { b: Batch; g: Batch; l: Batch; grp: T.Group; m: IcMekan; seed: number }
type Fn = (c: OkulCtx, it: IcItem) => void;
const HP = Math.PI / 2;

/* ---------- kanvas dokuları (eşya başına bir kez; oda silinince ic-mekan-look kill() dokuyu da atar) ---------- */
function tuval(w: number, h: number, ciz: (g: CanvasRenderingContext2D, W: number, H: number) => void): T.MeshBasicMaterial {
  const H = 128, W = Math.max(64, Math.round(H * w / h)), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!; ciz(g, W, H);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return new T.MeshBasicMaterial({ map: t });
}
function levha(c: OkulCtx, w: number, h: number, x: number, y: number, z: number, mat: T.Material, ry = 0, ds = false): T.Mesh {
  if (ds) (mat as T.MeshBasicMaterial).side = T.DoubleSide;
  const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; (c.grp.userData.cur as T.Group).add(m); return m;
}
const yazi = (g: CanvasRenderingContext2D, s: string, x: number, y: number, px: number, renk: string, max: number, agirlik = '800') => {
  g.fillStyle = renk; g.font = `${agirlik} ${px}px system-ui,"Segoe UI",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(s).width; if (m > max) { g.save(); g.translate(x, y); g.scale(max / m, 1); g.fillText(s, 0, 0); g.restore(); } else g.fillText(s, x, y);
};
/** Türk bayrağı: al zemin, beyaz ay yıldız (oranlar TS 2-1983'e yakın) */
function bayrakCiz(g: CanvasRenderingContext2D, W: number, H: number) {
  g.fillStyle = '#e30a17'; g.fillRect(0, 0, W, H);
  const G = H, cx = W * 0.5 - G * 0.25, cy = H / 2;
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx, cy, G * 0.25, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e30a17'; g.beginPath(); g.arc(cx + G * 0.0625, cy, G * 0.2, 0, Math.PI * 2); g.fill();
  const sx = cx + G * 0.0625 + G * 0.2 + G * 0.03, r = G * 0.125; g.fillStyle = '#ffffff'; g.beginPath();
  for (let k = 0; k < 10; k++) { const a = Math.PI + k * Math.PI / 5, rr = k % 2 ? r * 0.382 : r; g.lineTo(sx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
}
/** Türkiye'nin kaba silüeti (birim kare, batı 0 doğu 1; yalnız tanınır bir şekil) */
const TR: [number, number][] = [[0.02, 0.32], [0.07, 0.22], [0.12, 0.24], [0.16, 0.18], [0.22, 0.2], [0.3, 0.12], [0.42, 0.1], [0.52, 0.16], [0.62, 0.12], [0.72, 0.16], [0.82, 0.1], [0.92, 0.16], [0.98, 0.3],
  [0.96, 0.46], [0.99, 0.62], [0.9, 0.74], [0.78, 0.7], [0.66, 0.78], [0.56, 0.74], [0.5, 0.86], [0.44, 0.74], [0.36, 0.78], [0.26, 0.74], [0.16, 0.8], [0.1, 0.7], [0.04, 0.6], [0.06, 0.48], [0.01, 0.42]];

/* ---------- küçük parçalar ---------- */
const sandalye = (b: Batch, x: number, z: number, ry: number, c = '#3f6f9a', h = 0.45) => {
  const s = Math.sin(ry), k = Math.cos(ry);
  b.box(0.42, 0.04, 0.4, c, x, h, z, { ry }); b.box(0.4, 0.34, 0.04, c, x - s * 0.18, h + 0.22, z - k * 0.18, { ry });
  for (const [dx, dz] of [[-0.17, -0.16], [0.17, -0.16], [-0.17, 0.16], [0.17, 0.16]]) b.box(0.025, h, 0.025, '#3a3d42', x + dx * k + dz * s, h / 2, z - dx * s + dz * k);
};
const kitapSirasi = (b: Batch, w: number, y: number, z: number, seed: number) => {
  const C = ['#7a2a1d', '#1d4f86', '#2f6f4a', '#c9a23a', '#f4ead2', '#5a3b2a', '#c94f6d', '#2f9e8f'];
  let x = -w / 2 + 0.04, i = seed;
  while (x < w / 2 - 0.06) { const bw = 0.035 + ((i * 37) % 5) * 0.008, bh = 0.2 + ((i * 13) % 4) * 0.025; b.box(bw, bh, 0.16, C[i % C.length], x + bw / 2, y + bh / 2, z); x += bw + 0.004; i++; }
};

export const OKUL_WALLY = ['portre', 'cerceve', 'harita', 'saat', 'sinifTabela', 'periyodik', 'boyOlcer', 'yanginTup', 'enstrumanDuvar', 'resimPano'];

export const OKUL_F: Record<string, Fn> = {
  /** Atatürk portresi: altın çerçeve, koyu fon, takım elbiseli büst (stilize), altında pirinç künye */
  portre: (c, it) => {
    const y = it.y || 2.62, w = it.w, h = w * 1.3, { b } = c;
    b.box(w + 0.1, h + 0.1, 0.05, '#b8902f', 0, y, 0); b.box(w, h, 0.02, '#1f2328', 0, y, 0.02);
    levha(c, w * 0.92, h * 0.92, 0, y, 0.035, tuval(w, h, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5b6470'); gr.addColorStop(1, '#2a2e35'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#16181c'; g.beginPath(); g.ellipse(W / 2, H * 1.02, W * 0.48, H * 0.36, 0, Math.PI, 0); g.fill();   // omuzlar (frak)
      g.fillStyle = '#f2efe8'; g.beginPath(); g.moveTo(W * 0.42, H * 0.7); g.lineTo(W / 2, H * 0.84); g.lineTo(W * 0.58, H * 0.7); g.fill();   // gömlek yakası
      g.fillStyle = '#1b1d21'; g.fillRect(W * 0.485, H * 0.72, W * 0.03, H * 0.12);
      g.fillStyle = '#e6c7a6'; g.beginPath(); g.ellipse(W / 2, H * 0.47, W * 0.15, H * 0.17, 0, 0, Math.PI * 2); g.fill();   // yüz
      g.fillStyle = '#c9a98a'; g.fillRect(W * 0.46, H * 0.6, W * 0.08, H * 0.08);   // boyun
      g.fillStyle = '#c8c3b8'; g.beginPath(); g.ellipse(W / 2, H * 0.34, W * 0.155, H * 0.07, 0, Math.PI, 0); g.fill();   // geriye taranmış saç
      g.strokeStyle = 'rgba(40,30,25,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * 0.42, H * 0.43); g.lineTo(W * 0.47, H * 0.42); g.moveTo(W * 0.53, H * 0.42); g.lineTo(W * 0.58, H * 0.43); g.stroke();   // kaşlar
    }));
    b.box(w * 0.5, 0.06, 0.02, '#c9a23a', 0, y - h / 2 - 0.12, 0.02);
  },
  /** İstiklal Marşı / Gençliğe Hitabe çerçevesi: başlık + yazı satırları (okunmaz, yalnız sayfa dokusu) */
  cerceve: (c, it) => {
    const y = it.y || 1.75, w = it.w, h = w * 1.35;
    c.b.box(w + 0.07, h + 0.07, 0.04, '#5a3b2a', 0, y, 0);
    levha(c, w, h, 0, y, 0.025, tuval(w, h, (g, W, H) => {
      g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c9a23a'; g.lineWidth = 3; g.strokeRect(5, 5, W - 10, H - 10);
      yazi(g, it.txt || '', W / 2, H * 0.09, 11, '#a2472f', W - 18, '900');
      g.fillStyle = '#9a8f80'; for (let i = 0; i < 16; i++) { const ww = W * (0.55 + ((i * 7) % 5) * 0.06); g.fillRect((W - ww) / 2, H * 0.17 + i * H * 0.047, ww, 2); }
      g.fillStyle = '#e30a17'; g.beginPath(); g.arc(W / 2, H * 0.94, 4, 0, Math.PI * 2); g.fill();
    }));
  },
  /** öğretmen sandalyesi (döner, kollu) */
  ogrSandalye: (c) => { const { b } = c; b.cyl(0.24, 0.24, 0.07, '#2b2f36', 0, 0.48, 0, { seg: 12 }); b.box(0.42, 0.42, 0.06, '#2b2f36', 0, 0.78, -0.2); b.cyl(0.03, 0.03, 0.4, '#9aa5b0', 0, 0.26, 0, { seg: 6 }); for (let i = 0; i < 5; i++) b.box(0.26, 0.03, 0.04, '#2b2f36', Math.cos(i * 1.257) * 0.13, 0.05, Math.sin(i * 1.257) * 0.13, { ry: -i * 1.257 }); },
  /** direkte Türk bayrağı (sınıf, müdür odası); c 'okul': okulun flaması */
  bayrakIc: (c, it) => {
    const { b } = c, okul = it.c === 'okul';
    b.cyl(0.18, 0.2, 0.08, '#2b2f36', 0, 0.04, 0, { seg: 14 }); b.cyl(0.018, 0.018, 2.2, '#c9a23a', 0, 1.14, 0, { seg: 8 }); b.sph(0.045, '#c9a23a', 0, 2.27, 0, { ws: 8, hs: 6 });
    const mat = tuval(0.9, 0.6, okul ? (g, W, H) => { g.fillStyle = '#1d4f86'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffd23f'; g.fillRect(0, H * 0.72, W, H * 0.1); yazi(g, 'MARTIKÖY', W / 2, H * 0.36, 22, '#ffffff', W - 12, '900'); yazi(g, 'İLKOKULU', W / 2, H * 0.58, 16, '#ffffff', W - 12); } : bayrakCiz);
    mat.side = T.DoubleSide;
    // dökümlü kumaş: iki eğik parça (direkten sarkan bayrak)
    const g = new T.PlaneGeometry(0.62, 0.6, 6, 1), p = g.attributes.position as T.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 0.31; p.setZ(i, Math.sin(x * 7) * 0.04 * x); p.setY(i, p.getY(i) - x * x * 0.35); }
    g.computeVertexNormals();
    const m = new T.Mesh(g, mat); m.position.set(0.33, 1.85, 0); (c.grp.userData.cur as T.Group).add(m);
  },
  /** harita: Türkiye (ya da dünya) */
  harita: (c, it) => {
    const y = it.y || 1.6, w = it.w, h = w * 0.55, dunya = it.txt === 'WORLD';
    c.b.box(w + 0.06, h + 0.06, 0.03, '#2b2f36', 0, y, 0); c.b.cyl(0.02, 0.02, w + 0.1, '#5a3b2a', 0, y + h / 2 + 0.04, 0.02, { rz: HP, seg: 6 });
    levha(c, w, h, 0, y, 0.02, tuval(w, h, (g, W, H) => {
      g.fillStyle = '#9fd2ec'; g.fillRect(0, 0, W, H);
      if (dunya) { g.fillStyle = '#9cc47a'; for (const [x, yy, rx, ry] of [[0.2, 0.35, 0.12, 0.15], [0.27, 0.68, 0.06, 0.16], [0.5, 0.3, 0.07, 0.1], [0.53, 0.6, 0.08, 0.16], [0.72, 0.35, 0.16, 0.13], [0.84, 0.72, 0.06, 0.05]]) { g.beginPath(); g.ellipse(x * W, yy * H, rx * W, ry * H, 0.2, 0, Math.PI * 2); g.fill(); } }
      else {
        g.fillStyle = '#e9d9a6'; g.strokeStyle = '#7a6a4a'; g.lineWidth = 2; g.beginPath(); TR.forEach(([x, yy], i) => (i ? g.lineTo(0.06 * W + x * W * 0.88, 0.12 * H + yy * H * 0.8) : g.moveTo(0.06 * W + x * W * 0.88, 0.12 * H + yy * H * 0.8))); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#c0392b'; for (const [x, yy] of [[0.13, 0.27], [0.32, 0.5], [0.12, 0.62], [0.55, 0.52], [0.8, 0.4]]) { g.beginPath(); g.arc(0.06 * W + x * W * 0.88, 0.12 * H + yy * H * 0.8, 3, 0, Math.PI * 2); g.fill(); }
      }
      yazi(g, it.txt || 'TÜRKİYE', W / 2, H * 0.09, 14, '#1d4f86', W * 0.6, '900');
    }));
  },
  /** duvar saati */
  saat: (c, it) => {
    const y = it.y || 2.55, r = it.w / 2, { b, l } = c;
    b.cyl(r + 0.03, r + 0.03, 0.05, '#2b2f36', 0, y, 0, { rx: HP, seg: 24 }); l.cyl(r, r, 0.012, '#fbfaf6', 0, y, 0.03, { rx: HP, seg: 24 });
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; b.box(0.012, i % 3 ? 0.025 : 0.045, 0.006, '#2b2f36', Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, 0.04, { rz: -a }); }
    b.box(0.014, r * 0.55, 0.006, '#1b1d21', Math.sin(1.9) * r * 0.25, y + Math.cos(1.9) * r * 0.25, 0.045, { rz: -1.9 }); b.box(0.01, r * 0.78, 0.006, '#1b1d21', Math.sin(-0.5) * r * 0.36, y + Math.cos(-0.5) * r * 0.36, 0.048, { rz: 0.5 });
    b.sph(0.012, '#c0392b', 0, y, 0.05, { ws: 6, hs: 4 });
  },
  /** sınıf kapısının üstündeki tabela (koridor tarafından okunur) */
  sinifTabela: (c, it) => {
    const y = it.y || 2.62; c.b.box(it.w + 0.05, 0.3, 0.03, '#a2472f', 0, y, -0.32);
    levha(c, it.w, 0.25, 0, y, -0.34, tuval(it.w, 0.25, (g, W, H) => { g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, W, H); yazi(g, it.txt || '', W / 2, H / 2 + 2, 84, '#a2472f', W - 20, '900'); }), Math.PI);
  },
  /** dünya küresi (masa üstü; c 'ayak': yerde ayaklı) */
  dunya: (c, it) => {
    const { b } = c, y0 = it.c === 'ayak' ? 0.85 : 0, r = it.c === 'ayak' ? 0.2 : 0.12;
    if (it.c === 'ayak') { b.cyl(0.2, 0.22, 0.05, '#5a3b2a', 0, 0.025, 0, { seg: 12 }); b.cyl(0.025, 0.025, 0.78, '#5a3b2a', 0, 0.42, 0, { seg: 6 }); }
    else { b.cyl(0.07, 0.08, 0.03, '#5a3b2a', 0, 0.015, 0, { seg: 10 }); b.cyl(0.012, 0.012, 0.09, '#c9a23a', 0, 0.06, 0, { seg: 6 }); }
    b.tor(r + 0.02, 0.008, '#c9a23a', 0, y0 + r + 0.1, 0, { ry: HP, rz: 0.4, ts: 24 }); b.sph(r, '#3f8fc9', 0, y0 + r + 0.1, 0, { ws: 14, hs: 10 });
    for (const [a, e, s] of [[0.4, 0.3, 0.55], [2.1, -0.2, 0.5], [3.6, 0.5, 0.45], [5.0, -0.4, 0.35]]) b.sph(r * s, '#7fb35a', Math.cos(a) * Math.cos(e) * r * 0.62, y0 + r + 0.1 + Math.sin(e) * r * 0.62, Math.sin(a) * Math.cos(e) * r * 0.62, { ws: 8, hs: 6, sy: 0.6 });
  },
  /** müdür masası: koyu ceviz, deri koltuk, isimlik, telefon, kalemlik, dosyalar */
  mudurMasa: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d;
    b.box(w, 0.06, d, '#4a2c1c', 0, 0.76, 0); b.box(w - 0.04, 0.72, 0.06, '#5a3622', 0, 0.38, -d / 2 + 0.05); for (const s of [-1, 1]) b.box(0.5, 0.72, d - 0.04, '#5a3622', s * (w / 2 - 0.25), 0.38, 0);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) b.box(0.03, 0.04, 0.01, '#c9a23a', s * (w / 2 - 0.25), 0.2 + k * 0.2, d / 2 + 0.005);
    b.box(w * 0.5, 0.004, d * 0.55, '#2f4a3a', 0, 0.792, 0.05);   // yeşil deri altlık
    b.box(0.42, 0.11, 0.06, '#c9a23a', 0, 0.85, d / 2 - 0.08, { rx: -0.3 }); b.box(0.36, 0.06, 0.01, '#1b1d21', 0, 0.86, d / 2 - 0.05, { rx: -0.3 });   // isimlik
    b.box(0.2, 0.06, 0.16, '#1b1d21', w / 2 - 0.35, 0.82, -0.1); b.box(0.2, 0.04, 0.05, '#1b1d21', w / 2 - 0.35, 0.87, -0.17);   // telefon
    b.cyl(0.04, 0.04, 0.1, '#7a2a1d', -w / 2 + 0.3, 0.84, -0.15, { seg: 8 }); for (let i = 0; i < 3; i++) b.cyl(0.005, 0.005, 0.14, ['#1d4f86', '#c0392b', '#2b2f36'][i], -w / 2 + 0.29 + i * 0.012, 0.92, -0.15, { seg: 4 });
    for (let i = 0; i < 3; i++) b.box(0.3, 0.025, 0.22, ['#e9dcc0', '#d6e4ee', '#f2e3a6'][i], -w / 2 + 0.55, 0.8 + i * 0.026, 0.12, { ry: i * 0.08 });
    b.box(0.38, 0.26, 0.02, '#1b1d21', 0.45, 0.95, -0.2); l.plane(0.34, 0.2, '#9fd0ef', 0.45, 0.95, -0.188);   // ekran
    // deri makam koltuğu (masanın arkasında)
    b.box(0.62, 0.12, 0.55, '#3a1f16', 0, 0.48, -d / 2 - 0.42); b.box(0.62, 0.75, 0.14, '#3a1f16', 0, 0.9, -d / 2 - 0.72, { r: 0.05, s: 2 }); for (const s of [-1, 1]) b.box(0.08, 0.22, 0.5, '#3a1f16', s * 0.33, 0.62, -d / 2 - 0.45);
    b.cyl(0.03, 0.03, 0.36, '#9aa5b0', 0, 0.24, -d / 2 - 0.42, { seg: 6 });
  },
  /** misafir koltuğu (deri, kollu) */
  misafirKoltuk: (c) => { const { b } = c; b.box(0.55, 0.14, 0.5, '#6b3a20', 0, 0.42, 0); b.box(0.55, 0.45, 0.1, '#6b3a20', 0, 0.72, -0.22); for (const s of [-1, 1]) b.box(0.08, 0.22, 0.48, '#6b3a20', s * 0.27, 0.55, 0); for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) b.box(0.04, 0.36, 0.04, '#2b1a12', x, 0.18, z); },
  /** dosya dolabı: dört çekmeceli metal dolap sırası, üstünde klasörler */
  dosyaDolap: (c, it) => {
    const { b } = c, n = Math.max(1, Math.round(it.w / 0.55));
    for (let i = 0; i < n; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / n; b.box(it.w / n - 0.03, 1.3, it.d, '#9aa5b0', x, 0.65, 0); for (let k = 0; k < 4; k++) { b.box(it.w / n - 0.09, 0.28, 0.01, '#b9c2cb', x, 0.18 + k * 0.31, it.d / 2 + 0.005); b.box(0.12, 0.025, 0.02, '#4a5058', x, 0.26 + k * 0.31, it.d / 2 + 0.015); } }
    for (let i = 0; i < Math.round(it.w / 0.09); i++) b.box(0.07, 0.3, 0.26, ['#1d4f86', '#c0392b', '#2f6f4a', '#c9a23a'][i % 4], -it.w / 2 + 0.06 + i * 0.09, 1.45, 0);
  },
  /** kupa dolabı: camlı vitrin, içinde okulun kupaları ve madalyaları */
  kupaDolap: (c, it) => {
    const { b, g, l } = c; b.box(it.w, 1.9, it.d, '#5a3b2a', 0, 0.95, 0); b.box(it.w - 0.08, 1.75, 0.02, '#f2ede2', 0, 1.0, -it.d / 2 + 0.06);
    for (let k = 0; k < 3; k++) { const y = 0.5 + k * 0.5; b.box(it.w - 0.1, 0.02, it.d - 0.08, '#d8cfbd', 0, y, 0); for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.3 + i * (it.w - 0.6) / 2, s = 0.7 + ((i + k) % 3) * 0.15; b.cyl(0.05 * s, 0.07 * s, 0.05, '#2b2f36', x, y + 0.035, 0, { seg: 8 }); b.cyl(0.015, 0.015, 0.08 * s, '#c9a23a', x, y + 0.1 * s, 0, { seg: 6 }); b.lathe([[0.01, 0], [0.07 * s, 0.03], [0.08 * s, 0.13 * s], [0.06 * s, 0.14 * s]], (i + k) % 3 === 1 ? '#c9ced6' : '#d9b23a', x, y + 0.13 * s, 0, { seg: 12 }); } }
    g.box(it.w - 0.06, 1.7, 0.02, '#d8eef6', 0, 1.0, it.d / 2 + 0.01); l.box(it.w - 0.12, 0.02, 0.02, '#fff3d6', 0, 1.86, it.d / 2 - 0.05);
  },
  /** halı (müdür odası): bordürlü, desenli */
  hali: (c, it) => { const { b } = c; b.box(it.w, 0.012, it.d, '#8a1f2a', 0, 0.006, 0); b.box(it.w - 0.24, 0.014, it.d - 0.24, '#c9a24a', 0, 0.008, 0); b.box(it.w - 0.34, 0.016, it.d - 0.34, '#7a1a24', 0, 0.01, 0); for (const s of [-1, 1]) b.cyl(0.32, 0.32, 0.018, '#c9a24a', s * it.w * 0.22, 0.012, 0, { seg: 8 }); b.cyl(0.42, 0.42, 0.019, '#1d4f86', 0, 0.013, 0, { seg: 8 }); },
  /** sekreter / hemşire / kütüphaneci masası: bilgisayar, yazıcı, isimlik (txt), sandalye */
  sekreterMasa: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d;
    b.box(w, 0.05, d, '#d6c3a0', 0, 0.74, 0); b.box(w - 0.04, 0.7, 0.04, '#b8a27e', 0, 0.37, -d / 2 + 0.03); for (const s of [-1, 1]) b.box(0.04, 0.72, d - 0.04, '#b8a27e', s * (w / 2 - 0.03), 0.36, 0);
    b.box(0.4, 0.68, d - 0.1, '#c9b48e', w / 2 - 0.25, 0.34, 0);
    b.box(0.44, 0.3, 0.03, '#1b1d21', -0.15, 0.98, -0.1); l.plane(0.4, 0.26, '#cfe6f5', -0.15, 0.98, -0.083); b.box(0.06, 0.12, 0.06, '#1b1d21', -0.15, 0.82, -0.1);
    b.box(0.36, 0.02, 0.13, '#2b2f36', -0.15, 0.775, 0.12); b.box(0.32, 0.18, 0.28, '#e9e6e0', w / 2 - 0.3, 0.86, -0.08);
    if (it.txt) levha(c, 0.36, 0.08, 0.3, 0.83, d / 2 - 0.04, tuval(0.36, 0.08, (g, W, H) => { g.fillStyle = '#1d4f86'; g.fillRect(0, 0, W, H); yazi(g, it.txt!, W / 2, H / 2 + 2, 96, '#ffffff', W - 16, '900'); }), 0);
    sandalye(b, -0.15, -d / 2 - 0.35, Math.PI, '#2b2f36');
  },
  /** bekleme sırası: üç oturaklı metal bank */
  bekleme: (c, it) => { const { b } = c, n = Math.max(2, Math.round(it.w / 0.52)); b.box(it.w, 0.04, 0.06, '#5b6068', 0, 0.3, -0.05); for (let i = 0; i < n; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / n; b.box(it.w / n - 0.06, 0.05, 0.42, '#2f7fb3', x, 0.44, 0); b.box(it.w / n - 0.06, 0.38, 0.05, '#2f7fb3', x, 0.68, -0.2); } for (const s of [-1, 1]) b.box(0.05, 0.44, 0.4, '#5b6068', s * (it.w / 2 - 0.05), 0.22, 0); },
  /** öğretmenler odasının toplantı masası: uzun masa, 8 sandalye, üstünde çay bardakları, defterler */
  toplantiMasa: (c, it) => {
    const { b } = c, w = it.w, d = it.d;
    b.box(w, 0.05, d, '#8a6a4a', 0, 0.74, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.06, 0.72, 0.06, '#5a3b2a', sx * (w / 2 - 0.15), 0.36, sz * (d / 2 - 0.15));
    const n = 4; for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; sandalye(b, x, -d / 2 - 0.32, 0, '#7a5a3a'); sandalye(b, x, d / 2 + 0.32, Math.PI, '#7a5a3a');
      b.cyl(0.03, 0.025, 0.08, '#c0392b', x + 0.15, 0.81, -d / 2 + 0.22, { seg: 6 }); b.cyl(0.045, 0.045, 0.008, '#fbfaf6', x + 0.15, 0.772, -d / 2 + 0.22, { seg: 10 });
      b.box(0.24, 0.02, 0.32, ['#e9dcc0', '#d6e4ee', '#f2e3a6', '#f2d0d6'][i], x - 0.1, 0.775, d / 2 - 0.25, { ry: (i % 2 - 0.5) * 0.3 }); }
    b.cyl(0.12, 0.1, 0.12, '#7a5a3a', 0, 0.82, 0, { seg: 10 }); for (let i = 0; i < 5; i++) b.sph(0.04, ['#e0533c', '#ffd23f', '#f2a2b3'][i % 3], Math.cos(i * 1.26) * 0.06, 0.94, Math.sin(i * 1.26) * 0.06, { ws: 6, hs: 4 });   // çiçek
  },
  /** çay ocağı: dolap tezgâh, çift demlik, bardak tepsisi, su ısıtıcı, şeker kutusu */
  cayOcak: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d;
    b.box(w, 0.86, d, '#e9e4da', 0, 0.43, 0); b.box(w + 0.03, 0.04, d + 0.03, '#5b6068', 0, 0.88, 0); for (let i = 0; i < 3; i++) b.box(w / 3 - 0.05, 0.7, 0.01, '#d8d2c6', -w / 3 + i * w / 3, 0.42, d / 2 + 0.005);
    b.box(0.34, 0.03, 0.34, '#2b2f36', -w / 2 + 0.35, 0.915, 0); l.cyl(0.11, 0.11, 0.005, '#ff7a3a', -w / 2 + 0.35, 0.932, 0, { seg: 14 });   // ocak (kısık alev)
    b.cyl(0.13, 0.12, 0.18, '#c9ced6', -w / 2 + 0.35, 1.02, 0, { seg: 14 }); b.cyl(0.085, 0.08, 0.13, '#e9e4da', -w / 2 + 0.35, 1.17, 0, { seg: 12 }); b.cyl(0.02, 0.02, 0.08, '#c9ced6', -w / 2 + 0.35 + 0.13, 1.05, 0, { rz: -1, seg: 5 });
    b.box(0.5, 0.02, 0.32, '#c9a23a', 0.15, 0.91, 0); for (let i = 0; i < 8; i++) { const x = 0.15 - 0.18 + (i % 4) * 0.12, z = -0.07 + Math.floor(i / 4) * 0.14; b.cyl(0.025, 0.02, 0.07, '#b0281e', x, 0.955, z, { seg: 6 }); b.cyl(0.035, 0.035, 0.005, '#fbfaf6', x, 0.922, z, { seg: 8 }); }
    b.cyl(0.08, 0.09, 0.22, '#2b2f36', w / 2 - 0.25, 1.0, -0.05, { seg: 10 }); b.box(0.12, 0.1, 0.1, '#e0533c', w / 2 - 0.25, 0.94, 0.15);
  },
  /** boy ölçer: duvardaki cetvel (revir) */
  boyOlcer: (c, it) => { const { b } = c; b.box(it.w * 0.4, 1.8, 0.02, '#fbfaf6', 0, 1.1, 0); for (let i = 0; i <= 18; i++) b.box(i % 2 ? 0.06 : 0.12, 0.008, 0.006, i % 5 ? '#2b2f36' : '#c0392b', -0.03, 0.2 + i * 0.1, 0.015); b.box(it.w * 0.45, 0.03, 0.2, '#9aa5b0', 0, 1.55, 0.1); for (let i = 0; i < 4; i++) b.box(0.06, 0.04, 0.006, ['#e0533c', '#ffd23f', '#5fd68a', '#3f8fc9'][i], 0.08, 0.5 + i * 0.3, 0.012); },
  /** lavabo: seramik tekne, batarya, ayna, sabunluk */
  lavabo: (c, it) => { const { b, g } = c; b.box(it.w, 0.18, it.d, '#f4f6f8', 0, 0.8, 0); b.box(it.w - 0.12, 0.05, it.d - 0.15, '#cfdde3', 0, 0.86, 0.02); b.cyl(0.05, 0.06, 0.66, '#f4f6f8', 0, 0.38, 0, { seg: 10 }); b.cyl(0.015, 0.015, 0.18, '#c9ced6', 0, 0.97, -it.d / 2 + 0.08, { seg: 6 }); b.cyl(0.012, 0.012, 0.12, '#c9ced6', 0, 1.05, -it.d / 2 + 0.14, { rx: HP, seg: 6 }); g.box(it.w * 0.8, 0.5, 0.01, '#d8eef6', 0, 1.45, -it.d / 2 + 0.01); b.box(0.12, 0.05, 0.08, '#ffd23f', it.w / 2 - 0.12, 0.92, -0.08); },
  /** laboratuvar tezgâhı: siyah mermer üst, dolaplar, ortada musluk, deney tüpleri, beherler, mikroskop, tabureler */
  labMasa: (c, it) => {
    const { b, g, l } = c, w = it.w, d = it.d;
    b.box(w, 0.86, d, '#e9e4da', 0, 0.43, 0); b.box(w + 0.04, 0.05, d + 0.04, '#23272c', 0, 0.885, 0);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.box(w / 3 - 0.06, 0.6, 0.01, '#d8d2c6', -w / 3 + i * w / 3, 0.42, s * (d / 2 + 0.005));
    b.cyl(0.015, 0.015, 0.3, '#c9ced6', 0, 1.05, 0, { seg: 6 }); b.cyl(0.012, 0.012, 0.14, '#c9ced6', 0, 1.18, 0.06, { rx: HP, seg: 6 }); b.box(0.3, 0.02, 0.24, '#4a5058', 0, 0.912, 0.08);
    for (const s of [-1, 1]) {
      const x0 = s * w / 4; b.box(0.26, 0.04, 0.08, '#5a3b2a', x0, 0.93, -0.25); for (let i = 0; i < 5; i++) { g.cyl(0.012, 0.012, 0.13, '#d8eef6', x0 - 0.1 + i * 0.05, 0.99, -0.25, { seg: 6 }); l.cyl(0.011, 0.011, 0.05, ['#e0533c', '#5fd68a', '#3f8fc9', '#ffd23f', '#c94f6d'][i], x0 - 0.1 + i * 0.05, 0.955, -0.25, { seg: 6 }); }
      g.cyl(0.05, 0.05, 0.12, '#d8eef6', x0 + 0.25, 0.97, 0.15, { seg: 10 }); l.cyl(0.045, 0.045, 0.05, '#7fd0ff', x0 + 0.25, 0.94, 0.15, { seg: 10 });
      if (s < 0) { b.box(0.12, 0.03, 0.14, '#2b2f36', x0 + 0.05, 0.925, 0.2); b.box(0.03, 0.22, 0.03, '#2b2f36', x0 + 0.05, 1.03, 0.15); b.cyl(0.025, 0.02, 0.12, '#1b1d21', x0 + 0.05, 1.12, 0.2, { rx: 0.4, seg: 8 }); }
      for (const sz of [-1, 1]) { const tx = x0 + (sz < 0 ? -0.35 : 0.35), tz = sz * (d / 2 + 0.38); b.cyl(0.16, 0.16, 0.04, '#3f6f9a', tx, 0.66, tz, { seg: 12 }); b.cyl(0.02, 0.02, 0.64, '#5b6068', tx, 0.32, tz, { seg: 6 }); b.tor(0.13, 0.01, '#5b6068', tx, 0.22, tz, { rx: HP, ts: 14 }); }
    }
  },
  /** öğretmenin deney masası: bunsen beki, erlenler, kristal model */
  deneyMasa: (c, it) => {
    const { b, g, l } = c, w = it.w, d = it.d;
    b.box(w, 0.86, d, '#e9e4da', 0, 0.43, 0); b.box(w + 0.04, 0.05, d + 0.04, '#23272c', 0, 0.885, 0);
    b.cyl(0.04, 0.05, 0.03, '#4a5058', -0.6, 0.925, 0, { seg: 10 }); b.cyl(0.012, 0.012, 0.14, '#9aa5b0', -0.6, 1.0, 0, { seg: 6 }); l.cone(0.022, 0.08, '#6fb8ff', -0.6, 1.11, 0, { seg: 8 });
    for (const [x, cc] of [[-0.25, '#e0533c'], [0.0, '#5fd68a'], [0.25, '#c94f6d']] as [number, string][]) { g.cone(0.06, 0.14, '#d8eef6', x, 0.98, 0.05, { seg: 10 }); l.cone(0.045, 0.06, cc, x, 0.94, 0.05, { seg: 10 }); }
    for (let i = 0; i < 7; i++) b.sph(0.03, i % 2 ? '#e0533c' : '#3f8fc9', 0.6 + Math.cos(i) * 0.08, 1.0 + (i % 3) * 0.06, Math.sin(i) * 0.08, { ws: 6, hs: 4 });
    for (let i = 0; i < 5; i++) b.cyl(0.004, 0.004, 0.1, '#9aa5b0', 0.6 + Math.cos(i) * 0.04, 1.03 + (i % 3) * 0.03, Math.sin(i) * 0.04, { rz: i, seg: 3 });
  },
  /** periyodik tablo (duvar) */
  periyodik: (c, it) => {
    const y = it.y || 1.95, w = it.w, h = w * 0.55; c.b.box(w + 0.06, h + 0.06, 0.03, '#2b2f36', 0, y, 0);
    levha(c, w, h, 0, y, 0.02, tuval(w, h, (g, W, H) => {
      g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H); yazi(g, 'PERİYODİK TABLO', W / 2, H * 0.08, 13, '#1d4f86', W * 0.5, '900');
      const cw = W / 19, ch = H / 10.5, col = (gr: number) => ['#f2a2b3', '#ffd8a8', '#a9d6ec', '#c8e6a0', '#e9d9a6', '#d6c8f0'][gr % 6];
      for (let p = 0; p < 7; p++) for (let gr = 0; gr < 18; gr++) {
        if (p === 0 && gr > 0 && gr < 17) continue; if ((p === 1 || p === 2) && gr > 1 && gr < 12) continue;
        g.fillStyle = col(gr < 2 ? 0 : gr < 12 ? 2 : gr < 16 ? 3 : gr < 17 ? 4 : 5); g.fillRect(cw * 0.5 + gr * cw, H * 0.15 + p * ch, cw - 1.5, ch - 1.5);
      }
      for (let r = 0; r < 2; r++) for (let k = 0; k < 14; k++) { g.fillStyle = col(1); g.fillRect(cw * 3.5 + k * cw, H * 0.15 + (7.4 + r) * ch, cw - 1.5, ch - 1.5); }
    }));
  },
  /** iskelet modeli (fen lab): ayaklı, sade */
  iskelet: (c) => {
    const { b } = c, K = '#f2ede2';
    b.cyl(0.2, 0.22, 0.04, '#2b2f36', 0, 0.02, 0, { seg: 12 }); b.cyl(0.015, 0.015, 1.7, '#9aa5b0', 0, 0.85, -0.12, { seg: 6 });
    b.sph(0.1, K, 0, 1.62, 0, { ws: 10, hs: 8 }); b.box(0.09, 0.05, 0.05, K, 0, 1.53, 0.04); for (const s of [-1, 1]) b.sph(0.022, '#2b2f36', s * 0.035, 1.64, 0.085, { ws: 6, hs: 4 });
    b.cyl(0.018, 0.018, 0.55, K, 0, 1.18, 0, { seg: 6 }); for (let i = 0; i < 6; i++) b.tor(0.12 - Math.abs(i - 2.5) * 0.012, 0.008, K, 0, 1.38 - i * 0.055, 0, { rx: HP, ts: 16 });
    b.box(0.26, 0.08, 0.1, K, 0, 0.88, 0); for (const s of [-1, 1]) { b.cyl(0.014, 0.012, 0.42, K, s * 0.08, 0.62, 0, { seg: 5 }); b.cyl(0.012, 0.01, 0.4, K, s * 0.085, 0.22, 0, { seg: 5 }); b.box(0.05, 0.025, 0.09, K, s * 0.085, 0.03, 0.03);
      b.sph(0.03, K, s * 0.17, 1.42, 0, { ws: 6, hs: 4 }); b.cyl(0.012, 0.011, 0.3, K, s * 0.2, 1.25, 0, { rz: s * 0.15, seg: 5 }); b.cyl(0.01, 0.009, 0.28, K, s * 0.23, 0.97, 0.02, { rz: s * 0.08, seg: 5 }); }
  },
  /** yangın tüpü (duvar dibi) */
  yanginTup: (c) => { const { b } = c; b.cyl(0.07, 0.07, 0.42, '#d93a3a', 0, 0.52, 0.06, { seg: 10 }); b.sph(0.07, '#d93a3a', 0, 0.73, 0.06, { ws: 10, hs: 6, sy: 0.6 }); b.box(0.06, 0.06, 0.04, '#2b2f36', 0, 0.8, 0.06); b.cyl(0.012, 0.012, 0.2, '#1b1d21', 0.05, 0.68, 0.1, { rz: 0.4, seg: 5 }); b.box(0.16, 0.12, 0.005, '#d93a3a', 0, 1.15, 0.0); },
  /** kütüphane okuma masası: yeşil abajurlu lambalar, açık kitaplar, dört sandalye */
  okumaMasa: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d;
    b.box(w, 0.05, d, '#7a5236', 0, 0.74, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.72, 0.05, '#5a3b2a', sx * (w / 2 - 0.1), 0.36, sz * (d / 2 - 0.1));
    for (const s of [-1, 1]) { const x = s * w / 4; b.cyl(0.06, 0.07, 0.02, '#c9a23a', x, 0.775, 0, { seg: 10 }); b.cyl(0.01, 0.01, 0.28, '#c9a23a', x, 0.92, 0, { seg: 5 }); b.box(0.26, 0.07, 0.12, '#2f6f4a', x, 1.07, 0.03, { r: 0.03, s: 2 }); l.box(0.22, 0.01, 0.08, '#ffe6b0', x, 1.03, 0.03);
      sandalye(b, x, -d / 2 - 0.32, 0, '#7a5236'); sandalye(b, x, d / 2 + 0.32, Math.PI, '#7a5236');
      b.box(0.28, 0.01, 0.2, '#fbfaf6', x + 0.05, 0.772, s * 0.22, { rz: 0.04 }); b.box(0.005, 0.012, 0.2, '#c9a23a', x + 0.05, 0.778, s * 0.22); }
  },
  /** davul seti: bas davul, trampet, tomlar, zil (pirinç), tabure */
  davul: (c) => {
    const { b } = c;
    b.cyl(0.28, 0.28, 0.32, '#c0392b', 0, 0.3, 0, { rx: HP, seg: 18 }); b.cyl(0.26, 0.26, 0.33, '#fbfaf6', 0, 0.3, 0, { rx: HP, seg: 18 }); b.cyl(0.28, 0.28, 0.3, '#c0392b', 0, 0.3, 0, { rx: HP, seg: 18 });
    for (const [x, y, z, r] of [[-0.42, 0.62, 0.25, 0.17], [-0.15, 0.72, -0.05, 0.13], [0.18, 0.72, -0.05, 0.13], [0.48, 0.5, 0.25, 0.2]]) { b.cyl(r, r, 0.16, '#c0392b', x, y, z, { seg: 14 }); b.cyl(r - 0.01, r - 0.01, 0.005, '#fbfaf6', x, y + 0.083, z, { seg: 14 }); b.cyl(0.012, 0.012, y - 0.08, '#c9ced6', x, (y - 0.08) / 2, z, { seg: 5 }); }
    for (const [x, z, y] of [[-0.62, -0.1, 1.05], [0.62, -0.15, 1.15]]) { b.cyl(0.01, 0.01, y, '#c9ced6', x, y / 2, z, { seg: 5 }); b.cyl(0.22, 0.2, 0.012, '#d9b23a', x, y + 0.01, z, { seg: 18 }); }
    b.cyl(0.17, 0.17, 0.06, '#1b1d21', 0, 0.5, 0.6, { seg: 12 }); b.cyl(0.02, 0.02, 0.48, '#c9ced6', 0, 0.24, 0.6, { seg: 5 });
    for (const s of [-1, 1]) b.cyl(0.008, 0.006, 0.38, '#e9d27a', s * 0.05, 0.82, 0.25, { rx: 1.1, rz: s * 0.3, seg: 4 });
  },
  /** enstrüman duvarı: gitar, bağlama, keman, akordeon, tef */
  enstrumanDuvar: (c, it) => {
    const { b } = c, y = 1.5;
    b.box(it.w, 0.05, 0.04, '#5a3b2a', 0, 2.25, 0.02);
    const gitar = (x: number, gov: string, sap: number, s: number) => { b.cyl(0.13 * s, 0.13 * s, 0.07, gov, x, y - 0.18 * s, 0.06, { rx: HP, seg: 14 }); b.cyl(0.1 * s, 0.1 * s, 0.07, gov, x, y + 0.02 * s, 0.06, { rx: HP, seg: 14 }); b.cyl(0.035, 0.035, 0.072, '#1b1d21', x, y - 0.07 * s, 0.065, { rx: HP, seg: 10 }); b.box(0.05, sap, 0.025, '#3a2416', x, y + 0.1 * s + sap / 2, 0.06); b.box(0.07, 0.1, 0.03, '#3a2416', x, y + 0.15 * s + sap, 0.06); };
    gitar(-it.w / 2 + 0.4, '#c8862e', 0.5, 1);
    { const x = -it.w / 2 + 0.95; b.sph(0.13, '#8a5a2a', x, y - 0.15, 0.06, { ws: 12, hs: 8, sz: 0.5 }); b.box(0.035, 0.75, 0.025, '#3a2416', x, y + 0.3, 0.06); for (let i = 0; i < 3; i++) b.box(0.08, 0.012, 0.012, '#c9a23a', x, y + 0.6 + i * 0.03, 0.08); }   // bağlama
    { const x = 0.1; b.cyl(0.08, 0.08, 0.05, '#7a3a1a', x, y - 0.1, 0.05, { rx: HP, seg: 12 }); b.cyl(0.065, 0.065, 0.05, '#7a3a1a', x, y + 0.05, 0.05, { rx: HP, seg: 12 }); b.box(0.025, 0.28, 0.02, '#1b1d21', x, y + 0.25, 0.05); b.box(0.008, 0.6, 0.008, '#e9d27a', x + 0.16, y + 0.05, 0.06, { rz: 0.2 }); }   // keman + yay
    { const x = it.w / 2 - 0.85; b.box(0.36, 0.3, 0.16, '#c0392b', x, y, 0.09); for (let i = 0; i < 6; i++) b.box(0.012, 0.3, 0.17, '#fbfaf6', x - 0.12 + i * 0.05, y, 0.09); b.box(0.04, 0.28, 0.17, '#1b1d21', x + 0.2, y, 0.09); }   // akordeon
    { const x = it.w / 2 - 0.3; b.tor(0.15, 0.025, '#c8862e', x, y + 0.35, 0.04, { ts: 20 }); b.cyl(0.15, 0.15, 0.005, '#efe3c4', x, y + 0.35, 0.04, { rx: HP, seg: 18 }); for (let i = 0; i < 5; i++) b.cyl(0.025, 0.025, 0.008, '#d9b23a', x + Math.cos(i * 1.26) * 0.15, y + 0.35 + Math.sin(i * 1.26) * 0.15, 0.05, { rx: HP, seg: 8 }); }   // tef
  },
  /** çocuk resimleri panosu: mantar pano, iğneli resimler (ev, güneş, martı, vapur) */
  resimPano: (c, it) => {
    const y = 1.55, w = it.w, h = 1.0; c.b.box(w + 0.06, h + 0.06, 0.03, '#8a6a4a', 0, y, 0);
    levha(c, w, h, 0, y, 0.02, tuval(w, h, (g, W, H) => {
      g.fillStyle = '#c9a46a'; g.fillRect(0, 0, W, H); const cw = W / 4 - 8, ch = H / 2 - 12;
      for (let i = 0; i < 8; i++) {
        const x = 6 + (i % 4) * (W / 4), y0 = 6 + Math.floor(i / 4) * (H / 2); g.save(); g.translate(x + cw / 2, y0 + ch / 2); g.rotate(((i * 7) % 5 - 2) * 0.03); g.fillStyle = '#ffffff'; g.fillRect(-cw / 2, -ch / 2, cw, ch);
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cw * 0.3, -ch * 0.25, ch * 0.12, 0, Math.PI * 2); g.fill();
        if (i % 3 === 0) { g.fillStyle = '#e0533c'; g.fillRect(-cw * 0.25, -ch * 0.05, cw * 0.3, ch * 0.35); g.fillStyle = '#7a2a1d'; g.beginPath(); g.moveTo(-cw * 0.3, -ch * 0.05); g.lineTo(-cw * 0.1, -ch * 0.3); g.lineTo(cw * 0.1, -ch * 0.05); g.fill(); }
        else if (i % 3 === 1) { g.fillStyle = '#3f8fc9'; g.fillRect(-cw / 2, ch * 0.15, cw, ch * 0.35); g.fillStyle = '#fbfaf6'; g.fillRect(-cw * 0.3, ch * 0.0, cw * 0.5, ch * 0.15); g.fillStyle = '#c0392b'; g.fillRect(-cw * 0.05, -ch * 0.15, cw * 0.08, ch * 0.15); }
        else { g.strokeStyle = '#2b2f36'; g.lineWidth = 2; g.beginPath(); g.moveTo(-cw * 0.3, 0); g.quadraticCurveTo(-cw * 0.15, -ch * 0.15, 0, 0); g.quadraticCurveTo(cw * 0.15, -ch * 0.15, cw * 0.3, 0); g.stroke(); g.fillStyle = '#5fa04a'; g.fillRect(-cw / 2, ch * 0.3, cw, ch * 0.2); }
        g.restore(); g.fillStyle = ['#e0533c', '#3f8fc9', '#5fd68a', '#ffd23f'][i % 4]; g.beginPath(); g.arc(x + cw / 2, y0 + 4, 3, 0, Math.PI * 2); g.fill();
      }
    }));
  },
  /** resim sehpası: ahşap üç ayak, tuval (yarım kalmış manzara), boya paleti */
  sehpa: (c, it) => {
    const { b } = c; for (const [x, z, rx, rz] of [[-0.22, 0.08, -0.1, 0.12], [0.22, 0.08, -0.1, -0.12], [0, -0.22, 0.25, 0]]) b.box(0.03, 1.55, 0.03, '#a8794e', x, 0.76, z, { rx, rz });
    b.box(0.55, 0.03, 0.06, '#a8794e', 0, 0.82, 0.12); b.box(0.52, 0.42, 0.03, '#fbfaf6', 0, 1.06, 0.13, { rx: -0.1 });
    levha(c, 0.48, 0.38, 0, 1.06, 0.15, tuval(0.48, 0.38, (g, W, H) => { const s = (c.seed + Math.round(it.u * 3)) % 3; g.fillStyle = ['#9fd2ec', '#ffd8a8', '#cfe8f2'][s]; g.fillRect(0, 0, W, H); g.fillStyle = '#2f7fb3'; g.fillRect(0, H * 0.62, W, H * 0.38); g.fillStyle = '#5fa04a'; g.beginPath(); g.ellipse(W * 0.3, H * 0.62, W * 0.35, H * 0.18, 0, Math.PI, 0); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(W * 0.78, H * 0.25, H * 0.1, 0, Math.PI * 2); g.fill(); if (s) { g.fillStyle = '#fbfaf6'; g.fillRect(W * 0.5, H * 0.55, W * 0.25, H * 0.08); } }), -0.1);
    b.cyl(0.11, 0.11, 0.012, '#c8a27a', 0.18, 0.84, 0.18, { seg: 12 }); for (let i = 0; i < 4; i++) b.cyl(0.018, 0.018, 0.01, ['#e0533c', '#3f8fc9', '#ffd23f', '#5fd68a'][i], 0.12 + i * 0.04, 0.85, 0.16, { seg: 6 });
  },
  /** resim masası: büyük çalışma masası, boya kavanozları, kâğıtlar, makas, sandalyeler */
  resimMasa: (c, it) => {
    const { b } = c, w = it.w, d = it.d;
    b.box(w, 0.04, d, '#f2e3c6', 0, 0.64, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.62, 0.05, '#3f8fc9', sx * (w / 2 - 0.1), 0.31, sz * (d / 2 - 0.1));
    for (let i = 0; i < 6; i++) { const x = -w / 2 + 0.3 + i * (w - 0.6) / 5; b.cyl(0.04, 0.035, 0.08, '#d8eef6', x, 0.7, -0.1, { seg: 8 }); b.cyl(0.035, 0.035, 0.04, ['#e0533c', '#3f8fc9', '#ffd23f', '#5fd68a', '#c94f6d', '#7d6bb0'][i], x, 0.68, -0.1, { seg: 8 }); b.cyl(0.004, 0.004, 0.16, '#a8794e', x + 0.01, 0.76, -0.1, { rz: 0.2, seg: 3 }); }
    for (let i = 0; i < 4; i++) b.box(0.3, 0.004, 0.22, ['#fbfaf6', '#ffd8a8', '#cfe8f2', '#f2d0d6'][i], -w / 2 + 0.45 + i * 0.55, 0.664, 0.25, { ry: (i % 2 - 0.5) * 0.4 });
    for (let i = 0; i < 3; i++) { sandalye(b, -w / 2 + 0.45 + i * (w - 0.9) / 2, -d / 2 - 0.3, 0, ['#e0533c', '#ffd23f', '#5fd68a'][i], 0.36); sandalye(b, -w / 2 + 0.45 + i * (w - 0.9) / 2, d / 2 + 0.3, Math.PI, ['#3f8fc9', '#c94f6d', '#e8892b'][i], 0.36); }
  },
  /** çöp kutusu (geri dönüşüm: mavi kâğıt) */
  cop: (c, it) => { const { b } = c, r = it.w / 2; b.cyl(r, r * 0.85, 0.55, '#3f8fc9', 0, 0.275, 0, { seg: 12 }); b.cyl(r + 0.01, r + 0.01, 0.03, '#2f6f9a', 0, 0.56, 0, { seg: 12 }); b.box(r * 0.8, 0.12, 0.005, '#fbfaf6', 0, 0.35, r * 0.93); },
};
