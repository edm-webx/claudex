/**
 * Devlet Hastanesi içi (2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın ve çok detaylı olsun"). Kendi diyarında
 * (content/hastane-kat.ts HST_OX) duran 4 katlı bina: her katın döşemesi (üst katlarda merdiven boşluğu), cam cephe ve otomatik
 * kapı, ön bantta lobi / bekleme salonu (hasta kabul, danışma, numaratör, koltuk sıraları), ortada merdiven, arka duvarda iki
 * asansör, iki yanda 16 bölüm (acil, radyoloji, eczane, kafeterya, poliklinikler, laboratuvar, servisler, yenidoğan, fizik tedavi,
 * ameliyathane, yoğun bakım, başhekimlik, nöbet odası), her birinin kendi eşyası. Bebek evi kesiti: kahramanın katından yukarısı
 * gizli; kameraya bakan duvar yüzleri (-z) kahraman arkalarına geçince kaybolur, odanın içi görünür. Işık eklemez (parlayan
 * malzeme), flaş / yanıp sönme yok.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { katY } from '../../../content/avm-kat';
import {
  HST, HOL, LOBI_Z1, SIRA_Z, SERIT, MERD, ASANSOR, GIRIS_KAPI, KAT_ADI, ODALAR, odaXZ, yonRy, odaKapi, bantEsya, hstIcinde, KABUL, GISE,
  type HOda, type HEsya, type BantEsya,
} from '../../../content/hastane-kat';

export interface HastaneIcDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number; kat?: number } }
export interface HastaneIcView { update(dt: number): void }

const HP = Math.PI / 2, FT = 0.12, WH = 3.2;   // döşeme üstü, oda duvarı yüksekliği
const OV = SIRA_Z - LOBI_Z1, OU = HOL.x0 - HST.x0;
const RUN = MERD.arka - MERD.on - 2 * MERD.duz, SLOPE = Math.atan2(HST.FH, RUN), LEN = Math.hypot(RUN, HST.FH);
const Z0 = { r: 0 };

/* ---------- yazı levhaları ---------- */
function yaziMat(lines: string[], bg: string, fg: string, w: number, h: number): T.MeshBasicMaterial {
  const H = 96 * Math.max(1, lines.length), W = Math.max(96, Math.round(H * w / h)), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((t, i) => {
    g.font = (i === 0 && lines.length > 1 ? '800 ' : lines.length > 1 ? '600 ' : '800 ') + (lines.length > 1 ? 44 : 52) + 'px system-ui,"Segoe UI",sans-serif';
    const m = g.measureText(t).width, max = W - 28, y = (i + 0.5) * (H / lines.length) + 3;
    if (m > max) { g.save(); g.translate(W / 2, y); g.scale(max / m, 1); g.fillText(t, 0, 0); g.restore(); } else g.fillText(t, W / 2, y);
  });
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return new T.MeshBasicMaterial({ map: t });
}
function levha(text: string | string[], bg: string, fg: string, w: number, h: number, x: number, y: number, z: number, ry: number): T.Mesh {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), yaziMat(Array.isArray(text) ? text : [text], bg, fg, w, h)); m.position.set(x, y, z); m.rotation.y = ry; return m;
}

interface Kit { b: Batch; gl: Batch; l: Batch; g: T.Group }
let MS: { solid: T.MeshStandardMaterial; glow: T.MeshBasicMaterial; celik: T.MeshStandardMaterial } | null = null;
const mat = () => MS ??= { solid: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.06 }), glow: new T.MeshBasicMaterial({ vertexColors: true }), celik: new T.MeshStandardMaterial({ color: '#c9ced6', roughness: 0.3, metalness: 0.7 }) };
type Ciz = (k: Kit, W: number, D: number, it: { c?: string; txt?: string }, o?: HOda) => void;

/* ---------- eşya çizimleri: model +z'ye bakar, W genişlik (x), D derinlik (z), merkez döşemede ---------- */
const metal = '#c9ced6', koyu = '#2b2f36', beyaz = '#fbfaf6', krem = '#efe9df', ahsap = '#a8784e', yesilMavi = '#9fd8d0';
const yatakCiz = (b: Batch, W: number, D: number, ust: string, battaniye: string) => {
  b.box(W, 0.12, D, metal, 0, 0.42, 0, { r: 0.03 }); b.box(W - 0.06, 0.16, D - 0.1, beyaz, 0, 0.56, 0);
  b.box(W - 0.04, 0.05, D * 0.55, battaniye, 0, 0.66, D * 0.18); b.box(W * 0.62, 0.12, 0.34, '#ffffff', 0, 0.7, -D / 2 + 0.26, { r: 0.05 });
  b.box(W, 0.55, 0.05, ust, 0, 0.75, -D / 2 + 0.02); b.box(W, 0.32, 0.05, ust, 0, 0.6, D / 2 - 0.02);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.cyl(0.025, 0.025, 0.36, koyu, sx * (W / 2 - 0.06), 0.18, sz * (D / 2 - 0.08), { seg: 6 }); b.sph(0.045, koyu, sx * (W / 2 - 0.06), 0.04, sz * (D / 2 - 0.08), { ws: 6, hs: 4 }); }
  for (const sx of [-1, 1]) b.box(0.03, 0.08, D * 0.5, metal, sx * (W / 2 + 0.01), 0.78, 0.05, Z0);
};
const sandalyeCiz = (b: Batch, c = '#3f6fa8') => { b.box(0.44, 0.06, 0.42, c, 0, 0.45, 0); b.box(0.44, 0.42, 0.05, c, 0, 0.7, -0.19); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(0.015, 0.015, 0.44, koyu, sx * 0.19, 0.22, sz * 0.18, { seg: 5 }); };
const monitorCiz = (k: Kit, x: number, y: number, z: number, w = 0.42, h = 0.3, ry = 0) => {
  k.b.box(w, h, 0.05, koyu, x, y, z, { ry }); const s = Math.sin(ry), c = Math.cos(ry);
  k.l.box(w - 0.05, h - 0.05, 0.005, '#163a2c', x + s * 0.028, y, z + c * 0.028, { ry, r: 0 });
  // kalp ritmi çizgisi (sabit, yanıp sönmez)
  for (let i = 0; i < 6; i++) { const ox = -w / 2 + 0.06 + i * (w - 0.12) / 5, hh = i === 3 ? 0.11 : 0.025; k.l.box(0.05, hh, 0.004, '#5fe08a', x + c * ox + s * 0.032, y + (i === 3 ? 0.02 : 0), z - s * ox + c * 0.032, { ry, r: 0 }); }
};
const kutuRaf = (b: Batch, W: number, D: number, H: number, kat: number, renkler: string[], seed = 1) => {
  b.box(W, H, D, '#e8e4dc', 0, H / 2, 0, { r: 0.02 }); b.box(W - 0.06, H - 0.08, 0.02, '#d2ccc0', 0, H / 2, -D / 2 + 0.03, Z0);
  for (let r = 0; r < kat; r++) {
    const y = 0.12 + r * (H - 0.2) / kat; b.box(W - 0.04, 0.025, D - 0.04, '#d8d2c6', 0, y, 0, Z0);
    let x = -W / 2 + 0.06; let i = 0;
    while (x < W / 2 - 0.12) { const bw = 0.08 + ((i * 7 + r * 3 + seed) % 4) * 0.025, bh = 0.1 + ((i * 5 + r + seed) % 3) * 0.04; b.box(bw, bh, D * 0.6, renkler[(i + r * 2 + seed) % renkler.length], x + bw / 2, y + 0.012 + bh / 2, 0.02, Z0); x += bw + 0.015; i++; }
  }
};
const ILAC = ['#fbfaf6', '#e0533c', '#2f7fd0', '#2f9e5a', '#f2c94c', '#e58fb0', '#7b5fc0', '#fbfaf6', '#1fa3a3'];
const perdeCiz = (b: Batch, W: number, D: number, c = '#9fd8c8') => {
  const L = Math.max(W, D), along = W >= D; b.box(along ? L : 0.03, 0.03, along ? 0.03 : L, metal, 0, 2.55, 0, Z0);
  const n = Math.max(3, Math.round(L / 0.22));
  for (let i = 0; i < n; i++) { const t = -L / 2 + (i + 0.5) * L / n, off = (i % 2 ? 0.03 : -0.03); b.box(along ? L / n + 0.01 : 0.03, 1.75, along ? 0.03 : L / n + 0.01, i % 2 ? c : '#b4e2d4', along ? t : off, 1.55, along ? off : t, Z0); }
};

const CIZ: Record<string, Ciz> = {
  yatak: (k, W, D) => { yatakCiz(k.b, W, D, '#8fb3c9', '#7fb8d8'); },
  sedye: (k, W, D) => { yatakCiz(k.b, W, D, '#d93a3a', '#9fd8c8'); k.b.box(W * 0.9, 0.04, 0.5, '#dfe9ec', 0, 0.68, -D / 2 + 0.3, { rx: -0.5 }); },
  cocukSedye: (k, W, D) => { yatakCiz(k.b, W, D, '#ffcf5a', '#f2a2b3'); for (let i = 0; i < 4; i++) k.b.sph(0.05, ['#e0533c', '#2f9e5a', '#2f7fd0', '#ffcf5a'][i], -W / 2 + 0.15 + i * 0.15, 0.7, D / 2 - 0.02, { ws: 6, hs: 4 }); },
  tedaviYatak: (k, W, D) => { k.b.box(W, 0.08, D, '#2f6f5a', 0, 0.62, 0, { r: 0.03 }); k.b.box(W - 0.1, 0.55, D - 0.2, '#d9d2c4', 0, 0.3, 0); k.b.box(W * 0.6, 0.06, 0.3, '#ffffff', 0, 0.69, -D / 2 + 0.2); },
  muayeneMasa: (k, W, D) => { k.b.box(W, 0.1, D, '#3f6f8f', 0, 0.72, 0, { r: 0.04 }); k.b.box(W, 0.1, 0.5, '#3f6f8f', 0, 0.86, -D / 2 + 0.25, { rx: -0.45 }); k.b.box(W - 0.12, 0.66, D - 0.2, krem, 0, 0.34, 0); k.b.box(W - 0.05, 0.004, D - 0.3, '#ffffff', 0, 0.775, 0.12, Z0); k.b.box(0.3, 0.12, 0.25, '#d9d2c4', 0, 0.25, D / 2 + 0.05); },
  ameliyatMasa: (k, W, D) => { k.b.box(W, 0.1, D, '#1f5f4a', 0, 0.92, 0, { r: 0.03 }); k.b.cyl(0.12, 0.2, 0.85, metal, 0, 0.43, 0, { seg: 10 }); k.b.box(0.6, 0.06, 0.8, metal, 0, 0.03, 0); k.b.box(W - 0.05, 0.12, D * 0.62, '#4f9fd0', 0, 1.02, D * 0.12); k.b.sph(0.12, '#e0b897', 0, 1.06, -D / 2 + 0.28, { ws: 10, hs: 8 }); k.b.box(0.24, 0.05, 0.16, '#4f9fd0', 0, 1.15, -D / 2 + 0.28); },
  scialitik: (k) => { k.b.cyl(0.04, 0.04, 0.9, metal, 0, 3.0, 0, { seg: 6 }); for (const [x, z, r] of [[-0.35, 0.1, 0.38], [0.42, -0.15, 0.3]] as const) { k.b.cyl(r, r * 0.8, 0.14, '#e9eef2', x, 2.35, z, { seg: 18 }); k.l.cyl(r * 0.7, r * 0.7, 0.01, '#fff8e8', x, 2.27, z, { seg: 18 }); k.b.box(Math.abs(x) + 0.05, 0.05, 0.05, metal, x / 2, 2.55, z / 2, Z0); } },
  anestezi: (k) => { k.b.box(0.7, 1.1, 0.55, '#d9dfe5', 0, 0.62, 0, { r: 0.04 }); for (const sx of [-1, 1]) k.b.cyl(0.04, 0.04, 0.12, koyu, sx * 0.28, 0.06, 0, { rx: HP, seg: 6 }); monitorCiz(k, 0, 1.45, 0.05, 0.5, 0.36); k.b.cyl(0.07, 0.07, 0.5, '#2f9e5a', -0.42, 0.45, 0, { seg: 8 }); k.b.cyl(0.07, 0.07, 0.5, '#2f7fd0', -0.42, 0.45, 0.16, { seg: 8 }); k.b.tor(0.15, 0.02, '#7d8a96', 0.4, 0.9, 0.2, { ry: HP, ts: 12 }); },
  ventilator: (k) => { k.b.box(0.45, 0.9, 0.45, '#e9eef2', 0, 0.55, 0, { r: 0.04 }); monitorCiz(k, 0, 1.2, 0.06, 0.38, 0.26); k.b.tor(0.12, 0.02, '#9fc6e0', 0.24, 0.85, 0.1, { ry: HP, ts: 12 }); k.b.cyl(0.04, 0.04, 0.1, koyu, 0, 0.06, 0, { seg: 6 }); },
  mayo: (k) => { k.b.cyl(0.02, 0.02, 1.0, metal, 0, 0.5, -0.15, { seg: 6 }); k.b.box(0.6, 0.03, 0.42, metal, 0, 1.02, 0, Z0); for (let i = 0; i < 6; i++) k.b.box(0.02, 0.01, 0.16, '#9aa5b0', -0.2 + i * 0.08, 1.045, 0, Z0); k.b.box(0.5, 0.004, 0.35, '#3f8f7f', 0, 1.037, 0, Z0); },
  aletMasa: (k, W, D) => { k.b.box(W, 0.04, D, metal, 0, 0.9, 0, Z0); k.b.box(W - 0.05, 0.004, D - 0.05, '#3f8f7f', 0, 0.922, 0, Z0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.b.cyl(0.02, 0.02, 0.9, metal, sx * (W / 2 - 0.05), 0.45, sz * (D / 2 - 0.05), { seg: 5 }); for (let i = 0; i < 9; i++) k.b.box(0.02, 0.012, 0.18, '#b9c0c8', -W / 2 + 0.2 + i * 0.12, 0.93, -0.1, Z0); k.b.cyl(0.1, 0.08, 0.06, metal, W / 2 - 0.25, 0.95, 0.12, { seg: 10 }); },
  serum: (k) => { k.b.cyl(0.015, 0.015, 1.9, metal, 0, 0.95, 0, { seg: 6 }); for (let i = 0; i < 4; i++) k.b.box(0.22, 0.015, 0.02, koyu, 0, 0.02, 0, { ry: i * Math.PI / 4, r: 0 }); k.b.box(0.3, 0.015, 0.015, metal, 0, 1.88, 0, Z0); k.gl.box(0.12, 0.2, 0.05, '#e9f6ff', 0.1, 1.72, 0, { r: 0.02 }); k.b.cyl(0.004, 0.004, 0.8, '#d8eef6', 0.1, 1.2, 0, { seg: 4 }); },
  monitor: (k) => { k.b.cyl(0.015, 0.015, 1.5, metal, 0, 0.75, 0, { seg: 6 }); monitorCiz(k, 0, 1.55, 0, 0.36, 0.28); },
  monitorDuvar: (k, W) => { for (let i = 0; i < Math.max(1, Math.round(W / 0.75)); i++) monitorCiz(k, -W / 2 + 0.38 + i * 0.75, 1.9, 0.04, 0.62, 0.42); },
  acilArabasi: (k, W, D) => { k.b.box(W, 0.95, D, '#d93a3a', 0, 0.55, 0, { r: 0.03 }); for (let i = 0; i < 4; i++) k.b.box(W - 0.04, 0.012, 0.01, '#8c1f1f', 0, 0.25 + i * 0.2, D / 2 + 0.002, Z0); k.b.box(W + 0.04, 0.04, D + 0.04, '#e9eef2', 0, 1.04, 0, Z0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.b.cyl(0.04, 0.04, 0.05, koyu, sx * (W / 2 - 0.08), 0.04, sz * (D / 2 - 0.08), { rx: HP, seg: 8 }); },
  defib: (k) => { k.b.box(0.34, 0.2, 0.26, '#f2c94c', 0, 1.16, 0, { r: 0.03 }); k.l.box(0.14, 0.08, 0.005, '#5fe08a', -0.05, 1.2, 0.132, Z0); k.b.box(0.06, 0.1, 0.06, '#e0533c', 0.11, 1.28, 0.06); },
  oksijen: (k) => { for (const x of [-0.12, 0.12]) { k.b.cyl(0.1, 0.1, 1.1, '#2f9e5a', x, 0.55, 0, { seg: 12 }); k.b.sph(0.1, '#2f9e5a', x, 1.1, 0, { ws: 10, hs: 6 }); k.b.cyl(0.03, 0.03, 0.1, metal, x, 1.22, 0, { seg: 6 }); } k.b.box(0.42, 0.04, 0.26, koyu, 0, 0.6, 0, Z0); },
  dolap: (k, W, D, it) => { const c = it.c || '#cfe0e8'; k.b.box(W, 2.0, D, c, 0, 1.0, 0, { r: 0.02 }); const n = Math.max(2, Math.round(W / 0.6)); for (let i = 1; i < n; i++) k.b.box(0.01, 1.9, 0.01, '#9aa5b0', -W / 2 + i * W / n, 1.0, D / 2 + 0.002, Z0); for (let i = 0; i < n; i++) k.b.box(0.02, 0.12, 0.02, metal, -W / 2 + (i + 0.5) * W / n + 0.1, 1.05, D / 2 + 0.012, Z0); k.gl.box(W - 0.1, 0.8, 0.01, '#d8eef6', 0, 1.5, D / 2 + 0.005, Z0); },
  dolapSira: (k, W) => { const n = Math.round(W / 0.5); for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; k.b.box(W / n - 0.02, 1.9, 0.48, ['#7d8a96', '#6b7884'][i % 2], x, 0.95, 0, { r: 0.01 }); for (let j = 0; j < 3; j++) k.b.box(0.2, 0.012, 0.005, '#4a5560', x, 1.7 - j * 0.04, 0.242, Z0); k.b.box(0.02, 0.1, 0.02, metal, x + 0.15, 1.0, 0.25, Z0); } },
  lavabo: (k, W, D) => { k.b.box(W, 0.82, D, beyaz, 0, 0.41, 0, { r: 0.04 }); k.b.box(W * 0.7, 0.04, D * 0.6, '#cfe0e8', 0, 0.83, 0.03, Z0); k.b.cyl(0.015, 0.015, 0.2, metal, 0, 0.94, -D / 2 + 0.08, { seg: 6 }); k.b.box(0.02, 0.02, 0.12, metal, 0, 1.03, -D / 2 + 0.14, Z0); k.gl.box(W * 0.8, 0.6, 0.01, '#dff2fb', 0, 1.5, -D / 2 + 0.01, Z0); k.b.box(0.12, 0.2, 0.08, '#e9eef2', W / 2 - 0.1, 1.25, -D / 2 + 0.04); },
  cop: (k) => { k.b.cyl(0.15, 0.13, 0.4, '#e9eef2', 0, 0.2, 0, { seg: 10 }); k.b.cyl(0.16, 0.16, 0.03, '#2f9e5a', 0, 0.41, 0, { seg: 10 }); },
  komodin: (k, W, D) => { k.b.box(W, 0.6, D, '#e8e4dc', 0, 0.3, 0, { r: 0.02 }); k.b.box(W - 0.06, 0.012, 0.01, '#9aa5b0', 0, 0.4, D / 2 + 0.002, Z0); k.gl.cyl(0.035, 0.035, 0.2, '#cfeaf8', -0.1, 0.7, 0, { seg: 8 }); k.b.cyl(0.04, 0.04, 0.03, '#2f7fd0', -0.1, 0.81, 0, { seg: 8 }); k.b.box(0.12, 0.03, 0.16, '#f2c94c', 0.08, 0.615, 0, Z0); },
  oksijenPano: (k, W) => { k.b.box(W, 0.22, 0.06, '#e9eef2', 0, 1.45, 0, Z0); for (let i = 0; i < 3; i++) k.b.cyl(0.03, 0.03, 0.05, ['#2f9e5a', '#f2f2ee', '#2f7fd0'][i], -0.3 + i * 0.3, 1.45, 0.05, { rx: HP, seg: 8 }); k.l.box(0.08, 0.04, 0.005, '#ffd27a', 0.48, 1.45, 0.032, Z0); },
  refakat: (k) => { k.b.box(0.6, 0.2, 0.6, '#7d5a8a', 0, 0.35, 0, { r: 0.05 }); k.b.box(0.6, 0.5, 0.12, '#7d5a8a', 0, 0.65, -0.24, { r: 0.05 }); for (const sx of [-1, 1]) k.b.box(0.1, 0.35, 0.6, '#6b4a78', sx * 0.3, 0.47, 0); },
  perde: (k, W, D) => { perdeCiz(k.b, W, D); },
  pencere: (k, W) => { const n = Math.max(1, Math.round(W / 1.6)); for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; k.b.box(1.3, 1.4, 0.05, beyaz, x, 1.65, 0.02, Z0); k.l.box(1.18, 1.28, 0.005, '#bfe3f5', x, 1.65, 0.05, Z0); k.b.box(1.18, 0.03, 0.02, beyaz, x, 1.65, 0.055, Z0); } },
  triaj: (k, W, D) => { k.b.box(W, 1.05, D, beyaz, 0, 0.52, 0, { r: 0.05 }); k.b.box(W + 0.06, 0.05, D + 0.08, '#d93a3a', 0, 1.07, 0); k.b.box(W, 0.12, 0.01, '#d93a3a', 0, 0.82, D / 2 + 0.005, Z0); for (let i = 0; i < 3; i++) k.l.box(0.12, 0.12, 0.004, ['#e0533c', '#f2c94c', '#5fd68a'][i], -0.3 + i * 0.3, 0.55, D / 2 + 0.006, Z0); },
  pc: (k) => { k.b.box(0.46, 0.3, 0.03, koyu, 0, 1.25, 0, Z0); k.l.box(0.42, 0.26, 0.004, '#cfe3f2', 0, 1.25, 0.017, Z0); k.b.box(0.06, 0.12, 0.06, koyu, 0, 1.06, -0.02, Z0); k.b.box(0.36, 0.015, 0.12, '#3a3f47', 0, 1.0, 0.14, Z0); },
  sandalye: (k) => sandalyeCiz(k.b),
  koltuk: (k) => { k.b.box(0.56, 0.12, 0.52, koyu, 0, 0.48, 0, { r: 0.05 }); k.b.box(0.52, 0.6, 0.1, koyu, 0, 0.85, -0.22, { r: 0.05 }); k.b.cyl(0.03, 0.03, 0.4, metal, 0, 0.22, 0, { seg: 6 }); for (let i = 0; i < 5; i++) k.b.box(0.3, 0.02, 0.03, metal, 0, 0.03, 0, { ry: i * 1.2566, r: 0 }); },
  makamKoltuk: (k) => { k.b.box(0.7, 0.16, 0.62, '#4a2f22', 0, 0.5, 0, { r: 0.06 }); k.b.box(0.66, 0.85, 0.14, '#4a2f22', 0, 1.0, -0.26, { r: 0.06 }); for (const sx of [-1, 1]) k.b.box(0.1, 0.2, 0.5, '#3a2416', sx * 0.36, 0.66, 0); k.b.cyl(0.035, 0.035, 0.42, metal, 0, 0.23, 0, { seg: 6 }); },
  doktorMasa: (k, W, D) => { k.b.box(W, 0.05, D, '#e9e4da', 0, 0.75, 0, Z0); k.b.box(0.42, 0.72, D - 0.06, '#cfc6b4', W / 2 - 0.23, 0.37, 0); k.b.box(0.05, 0.72, D - 0.06, '#cfc6b4', -W / 2 + 0.03, 0.37, 0); k.b.box(W - 0.1, 0.4, 0.03, '#cfc6b4', 0, 0.52, -D / 2 + 0.04, Z0); k.b.box(0.25, 0.03, 0.32, '#fbfaf6', -0.35, 0.79, 0.12, Z0); k.b.box(0.12, 0.012, 0.02, '#2f7fd0', -0.25, 0.81, 0.18, Z0); k.b.cyl(0.04, 0.035, 0.1, '#c94f6d', 0.45, 0.82, 0.18, { seg: 8 }); },
  makamMasa: (k, W, D) => { k.b.box(W, 0.07, D, '#5a3a24', 0, 0.76, 0, { r: 0.02 }); k.b.box(W - 0.1, 0.7, 0.05, '#4a2f1e', 0, 0.38, D / 2 - 0.08, Z0); for (const sx of [-1, 1]) k.b.box(0.5, 0.7, D - 0.1, '#4a2f1e', sx * (W / 2 - 0.27), 0.37, 0); k.b.box(0.3, 0.04, 0.22, '#2b2b30', 0.4, 0.81, -0.15, Z0); k.b.box(0.5, 0.02, 0.35, '#3a5f2a', -0.2, 0.8, -0.1, Z0); k.b.cyl(0.05, 0.06, 0.08, '#c9a23a', -0.8, 0.84, -0.25, { seg: 10 }); for (let i = 0; i < 3; i++) k.b.cyl(0.006, 0.006, 0.14, ['#1d4f86', '#e0533c', '#2b2b30'][i], -0.82 + i * 0.02, 0.92, -0.25, { seg: 4 }); k.b.box(0.6, 0.12, 0.04, '#c9a23a', 0, 0.85, D / 2 - 0.12, Z0); },
  sekreter: (k, W, D) => { CIZ.doktorMasa(k, W, D, {}); CIZ.pc(k, W, D, {}); },
  toplantiMasa: (k, W, D) => { k.b.box(W, 0.06, D, '#6b4a2a', 0, 0.75, 0, { r: 0.04 }); for (const sx of [-1, 1]) k.b.box(0.1, 0.72, D - 0.3, '#4a2f1e', sx * (W / 2 - 0.35), 0.37, 0); for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) { k.b.push(new T.Matrix4().makeRotationY(sz < 0 ? 0 : Math.PI).setPosition(sx * 0.9, 0, sz * (D / 2 + 0.3))); sandalyeCiz(k.b, '#3a2416'); k.b.pop(); } for (let i = 0; i < 3; i++) k.b.box(0.22, 0.01, 0.3, '#fbfaf6', -0.8 + i * 0.8, 0.785, 0, Z0); k.gl.cyl(0.035, 0.035, 0.18, '#cfeaf8', 0.3, 0.87, 0.1, { seg: 8 }); },
  koltukTakimi: (k, W, D) => { k.b.box(W, 0.42, D, '#7a2b2b', 0, 0.21, 0, { r: 0.08 }); k.b.box(W, 0.5, 0.22, '#6a2323', 0, 0.6, -D / 2 + 0.11, { r: 0.08 }); for (const sx of [-1, 1]) k.b.box(0.2, 0.32, D, '#6a2323', sx * (W / 2 - 0.1), 0.5, 0, { r: 0.06 }); for (let i = 0; i < 3; i++) k.b.box(W / 3 - 0.12, 0.08, D - 0.3, '#8c3a3a', -W / 3 + i * W / 3, 0.46, 0.06, { r: 0.04 }); },
  sehpa: (k, W, D) => { k.gl.box(W, 0.03, D, '#cfe8f2', 0, 0.42, 0, Z0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.b.cyl(0.02, 0.02, 0.42, '#c9a23a', sx * (W / 2 - 0.06), 0.21, sz * (D / 2 - 0.06), { seg: 6 }); k.b.box(0.24, 0.04, 0.3, '#e0533c', 0.15, 0.455, 0, Z0); },
  kitaplik: (k, W, D) => { kutuRaf(k.b, W, D, 2.1, 5, ['#7a2b2b', '#1d4f86', '#2f6f5a', '#c9a23a', '#3a2416', '#e9e4da'], 3); },
  ilacRaf: (k, W, D) => { kutuRaf(k.b, W, D, 2.1, 6, ILAC, 1); },
  eczTezgah: (k, W, D) => { k.b.box(W, 1.0, D, '#fbfaf6', 0, 0.5, 0, { r: 0.04 }); k.b.box(W + 0.05, 0.05, D + 0.08, '#eef3ee', 0, 1.02, 0); k.b.box(W + 0.06, 0.02, 0.04, '#2f9e5a', 0, 1.0, D / 2 + 0.04, Z0); k.b.box(W, 0.14, 0.01, '#2f9e5a', 0, 0.78, D / 2 + 0.005, Z0); k.gl.box(W - 0.2, 0.5, 0.01, '#dff5e6', 0, 1.3, D / 2 - 0.05, Z0); for (let i = 0; i < 5; i++) k.b.box(0.14, 0.08, 0.1, ILAC[i + 1], -W / 2 + 0.6 + i * 0.35, 1.08, -0.15, Z0); },
  eczDolap: (k, W, D) => { k.b.box(W, 1.9, D, '#e9eef2', 0, 0.95, 0, { r: 0.03 }); k.gl.box(W - 0.12, 1.6, 0.01, '#d8f0ff', 0, 1.0, D / 2 + 0.005, Z0); for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) k.b.box(0.14, 0.12, 0.2, ILAC[(i + r) % ILAC.length], -W / 2 + 0.2 + i * 0.2, 0.35 + r * 0.4, 0, Z0); k.l.box(0.12, 0.05, 0.005, '#5fd6ff', W / 2 - 0.15, 1.8, D / 2 + 0.006, Z0); },
  eczHaci: (k) => { k.l.box(0.3, 0.9, 0.04, '#5fd68a', 0, 2.3, 0.03, Z0); k.l.box(0.9, 0.3, 0.04, '#5fd68a', 0, 2.3, 0.03, Z0); },
  poset: (k) => { k.b.box(0.22, 0.26, 0.12, '#fbfaf6', 0, 1.18, 0, { r: 0.02 }); k.b.box(0.1, 0.08, 0.005, '#2f9e5a', 0, 1.2, 0.063, Z0); },
  siraMak: (k) => { k.b.box(0.36, 1.2, 0.3, '#2f9e5a', 0, 0.6, 0, { r: 0.04 }); k.l.box(0.22, 0.14, 0.005, '#dff5e6', 0, 1.0, 0.152, Z0); k.b.box(0.1, 0.02, 0.03, '#fbfaf6', 0, 0.82, 0.16, Z0); },
  bank: (k, W, D) => { k.b.box(W, 0.06, D, '#b8875a', 0, 0.45, 0); k.b.box(W, 0.36, 0.05, '#b8875a', 0, 0.72, -D / 2 + 0.03); for (const sx of [-1, 1]) k.b.box(0.05, 0.45, D, koyu, sx * (W / 2 - 0.1), 0.22, 0); },
  baskul: (k) => { k.b.box(0.45, 0.06, 0.4, '#e9eef2', 0, 0.03, 0); k.b.cyl(0.025, 0.025, 1.1, metal, 0, 0.6, -0.16, { seg: 6 }); k.b.box(0.24, 0.18, 0.05, '#e9eef2', 0, 1.2, -0.16); k.l.box(0.14, 0.06, 0.005, '#ffd27a', 0, 1.22, -0.134, Z0); },
  kafeTezgah: (k, W, D) => { k.b.box(W, 1.0, D, '#c8693e', 0, 0.5, 0, { r: 0.04 }); for (let i = 0; i < Math.round(W / 0.3); i++) k.b.box(0.012, 0.85, 0.01, '#a4532e', -W / 2 + (i + 0.5) * 0.3, 0.48, D / 2 + 0.003, Z0); k.b.box(W + 0.06, 0.05, D + 0.1, '#a0703f', 0, 1.02, 0); },
  arkaTezgah: (k, W, D) => { k.b.box(W, 0.9, D, '#e9e4da', 0, 0.45, 0, { r: 0.03 }); k.b.box(W, 0.04, D + 0.04, '#7d8a96', 0, 0.92, 0); k.b.box(W, 0.03, 0.3, '#e9e4da', 0, 1.7, -D / 2 + 0.15, Z0); for (let i = 0; i < 8; i++) k.gl.cyl(0.03, 0.025, 0.07, '#e8a868', -W / 2 + 0.4 + i * 0.12, 1.75, -D / 2 + 0.15, { seg: 8 }); },
  vitrin: (k, W, D) => { k.gl.box(W, 0.4, D, '#e9f6ff', 0, 1.25, 0, { r: 0.03 }); k.b.box(W, 0.02, D, '#3a2416', 0, 1.05, 0, Z0);
    for (let i = 0; i < 4; i++) { const x = -W / 2 + 0.2 + i * (W - 0.4) / 3; k.b.tor(0.07, 0.03, '#c98a3a', x, 1.1, -0.15, { rx: HP, ts: 12 }); k.b.box(0.15, 0.05, 0.12, '#e8b468', x, 1.09, 0.12, { r: 0.02 }); k.b.box(0.13, 0.02, 0.1, '#f2d27a', x, 1.12, 0.12, Z0); } },
  kasa: (k) => { k.b.box(0.34, 0.12, 0.3, koyu, 0, 1.1, 0); k.l.box(0.2, 0.08, 0.005, '#5fd6ff', 0, 1.22, 0.07, { rx: -0.5, r: 0 }); },
  semaver: (k) => { for (const [x, r, h] of [[-0.08, 0.12, 0.26], [0.1, 0.09, 0.2]] as const) { k.b.cyl(r, r * 1.1, h, metal, x, 0.92 + h / 2, 0, { seg: 12 }); k.b.sph(r * 0.7, metal, x, 0.92 + h + 0.03, 0, { ws: 10, hs: 6 }); } k.b.cyl(0.07, 0.06, 0.12, '#c8693e', 0.1, 1.24, 0, { seg: 10 }); for (let i = 0; i < 3; i++) { k.gl.cyl(0.025, 0.02, 0.07, '#b3561f', -0.2 + i * 0.06, 0.96, 0.18, { seg: 8 }); } },
  tostMak: (k) => { k.b.box(0.44, 0.12, 0.34, metal, 0, 0.98, 0); k.b.box(0.44, 0.06, 0.34, '#7d8a96', 0, 1.08, -0.02, { rx: -0.2 }); k.b.box(0.06, 0.04, 0.2, koyu, 0, 1.12, 0.17, Z0); k.b.box(0.18, 0.025, 0.12, '#e8b468', -0.12, 1.06, 0.22, { r: 0.01 }); },
  ayranDolap: (k, W, D) => { k.b.box(W, 1.9, D, '#e9eef2', 0, 0.95, 0, { r: 0.03 }); k.gl.box(W - 0.1, 1.6, 0.01, '#d8f0ff', 0, 1.0, D / 2 + 0.005, Z0); for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = -W / 2 + 0.14 + i * (W - 0.28) / 3, y = 0.3 + r * 0.4; k.b.cyl(0.035, 0.035, 0.2, r % 2 ? '#fbfaf6' : '#5fa8d0', x, y + 0.1, 0.05, { seg: 8 }); k.b.cyl(0.02, 0.02, 0.03, r % 2 ? '#2f7fd0' : '#e0533c', x, y + 0.215, 0.05, { seg: 6 }); } k.l.box(W - 0.2, 0.08, 0.005, '#5fd6ff', 0, 1.82, D / 2 + 0.006, Z0); },
  kafeMasa: (k) => { k.b.cyl(0.4, 0.4, 0.04, '#fbfaf6', 0, 0.74, 0, { seg: 18 }); k.b.cyl(0.04, 0.04, 0.72, koyu, 0, 0.36, 0, { seg: 6 }); k.b.cyl(0.22, 0.24, 0.03, koyu, 0, 0.015, 0, { seg: 12 }); for (let i = 0; i < 2; i++) { k.b.push(new T.Matrix4().makeRotationY(i * Math.PI).setPosition(0, 0, 0)); k.b.push(new T.Matrix4().makeTranslation(0, 0, -0.62)); sandalyeCiz(k.b, '#e8892b'); k.b.pop(); k.b.pop(); } k.gl.cyl(0.03, 0.025, 0.07, '#b3561f', 0.12, 0.8, 0.05, { seg: 8 }); k.b.cyl(0.05, 0.05, 0.005, '#fbfaf6', 0.12, 0.765, 0.05, { seg: 10 }); },
  pizza: (k) => { k.b.box(0.36, 0.04, 0.36, '#d9b98a', 0, 0.8, 0, Z0); k.b.cyl(0.15, 0.15, 0.01, '#e0533c', 0, 0.83, 0, { seg: 14 }); },
  menuPano: (k, W, D, it) => { void D; k.g.add(levha(it.txt || 'MENÜ', '#3a2416', '#ffe9b8', W, 0.5, 0, 0, 0, 0)); },
  pano: (k, W, D, it) => { void D; k.g.add(levha(it.txt || '', '#fbfaf6', '#1d4f86', W, 0.34, 0, 0, 0, 0)); },
  tv: (k, W) => { k.b.box(W, W * 0.58, 0.06, '#121417', 0, 2.1, 0, Z0); k.l.box(W - 0.06, W * 0.58 - 0.06, 0.005, '#2f6f9a', 0, 2.1, 0.032, Z0); k.l.box(W * 0.4, 0.08, 0.004, '#fbfaf6', -W * 0.15, 2.0, 0.036, Z0); },
  saat: (k) => { k.b.cyl(0.18, 0.18, 0.04, beyaz, 0, 2.5, 0, { rx: HP, seg: 18 }); k.b.box(0.012, 0.12, 0.01, koyu, 0, 2.54, 0.025, Z0); k.b.box(0.09, 0.012, 0.01, koyu, 0.04, 2.5, 0.025, Z0); k.b.tor(0.18, 0.015, '#d93a3a', 0, 2.5, 0, { ts: 18 }); },
  negatoskop: (k, W) => { k.b.box(W, 0.6, 0.06, '#e9eef2', 0, 1.7, 0, Z0); k.l.box(W - 0.08, 0.5, 0.005, '#eaf6ff', 0, 1.7, 0.032, Z0); for (let i = 0; i < 2; i++) k.b.box(0.38, 0.42, 0.004, '#3a4652', -0.35 + i * 0.7, 1.7, 0.036, Z0); },
  rontgenPano: (k, W) => { CIZ.negatoskop(k, W, 0.06, {}); },
  radyasyon: (k) => { k.b.box(0.5, 0.5, 0.02, '#f2c94c', 0, 1.9, 0, Z0); k.b.cyl(0.06, 0.06, 0.01, '#121417', 0, 1.9, 0.015, { rx: HP, seg: 12 }); for (let i = 0; i < 3; i++) k.b.cyl(0.18, 0.18, 0.006, '#121417', 0, 1.9, 0.015, { rx: HP, seg: 12, arc: 1.05, rz: i * 2.094 }); },
  rontgen: (k, W, D) => { k.b.box(W, 0.1, D, '#e9eef2', 0, 0.8, 0, { r: 0.03 }); k.b.box(W - 0.4, 0.7, D - 0.3, '#cfd6dd', 0, 0.38, 0); k.b.box(W - 0.2, 0.06, D - 0.1, '#4f9fd0', 0, 0.88, 0); },
  rontgenKol: (k) => { k.b.cyl(0.06, 0.06, 2.4, metal, -0.8, 1.2, 0, { seg: 8 }); k.b.box(0.9, 0.12, 0.12, metal, -0.4, 2.3, 0, Z0); k.b.box(0.4, 0.3, 0.4, '#e9eef2', 0, 2.0, 0, { r: 0.04 }); k.b.box(0.3, 0.06, 0.3, '#7d8a96', 0, 1.82, 0); },
  mr: (k, W, D) => { k.b.box(W, 2.0, 1.1, '#e9eef2', 0, 1.0, -D / 2 + 0.55, { r: 0.12 }); k.b.cyl(0.42, 0.42, 1.14, '#2b3a4a', 0, 1.0, -D / 2 + 0.55, { rx: HP, seg: 20 }); k.b.tor(0.48, 0.04, '#7b5fc0', 0, 1.0, -D / 2 + 1.12, { ts: 20 });
    k.b.box(0.6, 0.12, D - 0.9, '#e9eef2', 0, 0.75, 0.3, { r: 0.04 }); k.b.box(0.5, 0.65, D - 1.3, '#cfd6dd', 0, 0.35, 0.5); k.b.box(0.5, 0.05, 1.2, '#7fb8d8', 0, 0.83, 0.5); },
  kursunCam: (k, W, D) => { const L = Math.max(W, D); k.b.box(0.15, 1.0, L, '#cfd6dd', 0, 0.5, 0); k.gl.box(0.05, 1.0, L * 0.6, '#9fc6c0', 0, 1.5, 0, Z0); k.b.box(0.15, 1.0, L * 0.2, '#cfd6dd', 0, 1.5, -L * 0.4); k.b.box(0.15, 1.0, L * 0.2, '#cfd6dd', 0, 1.5, L * 0.4); k.b.box(0.15, 0.2, L, '#cfd6dd', 0, 2.1, 0); },
  konsol: (k, W, D) => { k.b.box(W, 0.05, D, '#e9e4da', 0, 0.75, 0, Z0); k.b.box(W - 0.1, 0.7, 0.05, '#cfc6b4', 0, 0.37, -D / 2 + 0.05, Z0); for (let i = 0; i < 2; i++) { k.b.box(0.5, 0.32, 0.03, koyu, -0.3 + i * 0.6, 1.05, -0.15, Z0); k.l.box(0.46, 0.28, 0.004, i ? '#9aa8b8' : '#3a4652', -0.3 + i * 0.6, 1.05, -0.133, Z0); } },
  bolme: (k, W, D) => { const L = Math.max(W, D), along = W >= D; k.b.box(along ? L : 0.1, 2.3, along ? 0.1 : L, '#e9eef2', 0, 1.15, 0, Z0); k.b.box(along ? L : 0.11, 0.06, along ? 0.11 : L, '#9aa5b0', 0, 2.3, 0, Z0); },
  paravan: (k, W) => { for (let i = 0; i < 3; i++) { const x = -W / 2 + (i + 0.5) * W / 3; k.b.box(W / 3 - 0.04, 1.6, 0.03, '#9fd8c8', x, 0.95, (i % 2) * 0.08, { ry: i % 2 ? 0.2 : -0.2, r: 0 }); k.b.box(0.03, 1.8, 0.03, metal, x - W / 6, 0.9, 0, Z0); } },
  tansiyon: (k) => { k.b.box(0.32, 0.24, 0.06, '#e9eef2', 0, 1.5, 0, Z0); k.b.cyl(0.08, 0.08, 0.02, '#fbfaf6', 0, 1.52, 0.04, { rx: HP, seg: 14 }); k.b.tor(0.08, 0.008, '#2b2f36', 0, 1.52, 0.04, { ts: 14 }); k.b.box(0.18, 0.08, 0.05, '#2f7fd0', 0, 1.3, 0.04); },
  oyunHali: (k, W, D) => { k.b.box(W, 0.01, D, '#7fc7e6', 0, 0.006, 0, Z0); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) k.b.box(W / 4 - 0.05, 0.012, D / 3 - 0.05, ['#ffcf5a', '#f2a2b3', '#5fd68a', '#7fb8d8'][(i + j) % 4], -W / 2 + (i + 0.5) * W / 4, 0.008, -D / 2 + (j + 0.5) * D / 3, Z0); },
  topHavuz: (k, W) => { k.b.cyl(W / 2, W / 2, 0.35, '#2f7fd0', 0, 0.17, 0, { seg: 16, open: true }); k.b.tor(W / 2, 0.06, '#ffcf5a', 0, 0.35, 0, { rx: HP, ts: 18 }); for (let i = 0; i < 26; i++) { const a = i * 2.4, r = (i % 5) * W / 12; k.b.sph(0.07, ['#e0533c', '#ffcf5a', '#5fd68a', '#2f7fd0', '#f2a2b3'][i % 5], Math.cos(a) * r, 0.22 + (i % 3) * 0.05, Math.sin(a) * r, { ws: 6, hs: 4 }); } },
  sallanAt: (k) => { k.b.tor(0.45, 0.025, '#c94f6d', 0, 0.05, 0, { ry: HP, arc: 1.4, rz: -0.7 + Math.PI / 2 - 0.7, ts: 10 }); k.b.box(0.22, 0.25, 0.6, '#f2c94c', 0, 0.45, 0, { r: 0.08 }); k.b.box(0.16, 0.35, 0.2, '#f2c94c', 0, 0.7, 0.28, { r: 0.06, rx: -0.3 }); k.b.sph(0.03, koyu, 0.06, 0.82, 0.38, { ws: 5, hs: 4 }); k.b.box(0.06, 0.25, 0.1, '#7a3b1c', 0, 0.72, 0.12); },
  oyuncakKutu: (k, W, D) => { k.b.box(W, 0.45, D, '#e0533c', 0, 0.22, 0, { r: 0.04 }); for (let i = 0; i < 5; i++) k.b.box(0.12, 0.12, 0.12, ['#ffcf5a', '#5fd68a', '#2f7fd0', '#f2a2b3', '#fbfaf6'][i], -0.28 + i * 0.14, 0.5 + (i % 2) * 0.04, (i % 3 - 1) * 0.08, { r: 0.02 }); },
  bebekTarti: (k, W, D) => { k.b.box(W, 0.85, D, '#fbfaf6', 0, 0.42, 0, { r: 0.03 }); k.b.box(0.5, 0.1, 0.32, '#f2a2b3', 0, 0.92, 0, { r: 0.05 }); k.l.box(0.14, 0.06, 0.005, '#ffd27a', 0, 0.75, D / 2 + 0.003, Z0); },
  balonlar: (k, W) => { for (let i = 0; i < 7; i++) { const x = -W / 2 + 0.25 + i * (W - 0.5) / 6, y = 2.0 + (i % 3) * 0.22; k.b.sph(0.13, ['#e0533c', '#ffcf5a', '#5fd68a', '#2f7fd0', '#f2a2b3', '#7b5fc0', '#e8892b'][i], x, y, 0.12, { ws: 8, hs: 6 }); k.b.box(0.004, 0.4, 0.004, '#9aa5b0', x, y - 0.3, 0.12, Z0); } },
  disUnit: (k, W, D) => { k.b.box(0.4, 0.38, 0.6, '#e9eef2', 0, 0.2, 0.1, { r: 0.05 }); k.b.box(W, 0.12, D * 0.55, '#1fa3a3', 0, 0.48, 0.25, { r: 0.05, rx: 0.15 }); k.b.box(W * 0.9, 0.12, D * 0.45, '#1fa3a3', 0, 0.62, -D * 0.25, { r: 0.05, rx: -0.55 }); k.b.box(0.3, 0.12, 0.2, '#1fa3a3', 0, 0.86, -D / 2 + 0.1, { r: 0.05 });
    for (const sx of [-1, 1]) k.b.box(0.08, 0.06, 0.4, '#e9eef2', sx * (W / 2 + 0.02), 0.62, 0.05); k.b.cyl(0.13, 0.1, 0.18, '#e9eef2', W / 2 + 0.25, 0.75, -0.1, { seg: 12 }); k.b.cyl(0.1, 0.1, 0.02, '#cfe8f2', W / 2 + 0.25, 0.85, -0.1, { seg: 12 }); },
  disLamba: (k) => { k.b.cyl(0.03, 0.03, 0.8, metal, -0.5, 2.6, -0.5, { seg: 6 }); k.b.box(0.06, 0.06, 0.8, metal, -0.25, 2.2, -0.25, { ry: Math.PI / 4, r: 0 }); k.b.box(0.34, 0.12, 0.18, '#e9eef2', 0, 2.0, 0, { r: 0.04 }); k.l.box(0.26, 0.01, 0.12, '#fff8e8', 0, 1.935, 0, Z0); },
  tabure: (k) => { k.b.cyl(0.2, 0.2, 0.08, '#1fa3a3', 0, 0.55, 0, { seg: 14 }); k.b.cyl(0.03, 0.03, 0.5, metal, 0, 0.27, 0, { seg: 6 }); for (let i = 0; i < 5; i++) k.b.box(0.28, 0.02, 0.03, metal, 0, 0.03, 0, { ry: i * 1.2566, r: 0 }); },
  disTepsi: (k) => { k.b.cyl(0.02, 0.02, 0.9, metal, 0, 0.45, 0, { seg: 6 }); k.b.box(0.45, 0.03, 0.32, '#e9eef2', 0, 0.92, 0, Z0); for (let i = 0; i < 5; i++) k.b.box(0.012, 0.012, 0.16, '#b9c0c8', -0.15 + i * 0.07, 0.945, 0, Z0); },
  panoramik: (k) => { k.b.box(0.5, 0.06, 0.5, '#e9eef2', 0, 0.03, 0); k.b.box(0.18, 1.9, 0.18, '#e9eef2', 0, 0.95, -0.15, { r: 0.04 }); k.b.box(0.9, 0.16, 0.25, '#e9eef2', 0, 1.75, 0.05, { r: 0.05 }); k.b.box(0.12, 0.3, 0.16, '#1fa3a3', -0.38, 1.55, 0.12); k.b.box(0.12, 0.3, 0.16, '#cfd6dd', 0.38, 1.55, 0.12); },
  sterilDolap: (k, W, D) => { k.b.box(W, 1.95, D, '#e9eef2', 0, 0.97, 0, { r: 0.02 }); k.gl.box(W - 0.1, 0.9, 0.01, '#d8f0ff', 0, 1.4, D / 2 + 0.005, Z0); for (let r = 0; r < 3; r++) for (let i = 0; i < Math.round(W / 0.25); i++) k.b.box(0.18, 0.12, 0.25, ['#cfe8f2', '#9fd8d0', '#fbfaf6'][(i + r) % 3], -W / 2 + 0.15 + i * 0.25, 1.05 + r * 0.3, 0, Z0); },
  kanKoltuk: (k) => { k.b.box(0.7, 0.14, 0.6, '#8c2f39', 0, 0.48, 0.02, { r: 0.05 }); k.b.box(0.7, 0.75, 0.14, '#8c2f39', 0, 0.9, -0.26, { r: 0.05, rx: -0.2 }); for (const sx of [-1, 1]) k.b.box(0.14, 0.08, 0.62, '#6a2323', sx * 0.4, 0.72, 0.05, { r: 0.03 }); k.b.box(0.12, 0.06, 0.4, '#e9eef2', 0.5, 0.78, 0.2, { r: 0.02 }); k.b.box(0.5, 0.4, 0.5, koyu, 0, 0.2, 0); },
  labTezgah: (k, W, D) => { k.b.box(W, 0.88, D, '#e9eef2', 0, 0.44, 0, { r: 0.02 }); k.b.box(W + 0.04, 0.04, D + 0.04, '#3a4652', 0, 0.9, 0, Z0); k.b.box(W, 0.6, 0.3, '#e9eef2', 0, 1.7, -D / 2 + 0.15, { r: 0.02 }); for (let i = 1; i < Math.round(W / 0.6); i++) k.b.box(0.01, 0.8, 0.01, '#9aa5b0', -W / 2 + i * 0.6, 0.44, D / 2 + 0.003, Z0); },
  mikroskop: (k) => { k.b.box(0.18, 0.04, 0.22, koyu, 0, 0.94, 0); k.b.box(0.05, 0.28, 0.05, koyu, 0, 1.08, -0.08, { rx: 0.2 }); k.b.cyl(0.03, 0.03, 0.16, '#e9eef2', 0, 1.22, -0.02, { rx: 0.5, seg: 8 }); k.b.box(0.12, 0.012, 0.1, '#e9eef2', 0, 1.02, 0.02, Z0); },
  santrifuj: (k) => { k.b.cyl(0.2, 0.22, 0.24, '#e9eef2', 0, 1.04, 0, { seg: 16 }); k.gl.cyl(0.16, 0.16, 0.02, '#cfe8f2', 0, 1.17, 0, { seg: 16 }); k.l.box(0.08, 0.03, 0.005, '#5fd6ff', 0, 1.02, 0.215, Z0); },
  tupRaf: (k) => { k.b.box(0.46, 0.06, 0.2, '#e9eef2', 0, 0.95, 0, Z0); for (let i = 0; i < 8; i++) { const x = -0.2 + i * 0.057; k.gl.cyl(0.012, 0.012, 0.12, '#f6e9ea', x, 1.02, 0, { seg: 6 }); k.b.cyl(0.014, 0.014, 0.025, ['#e0533c', '#7b5fc0', '#2f9e5a', '#f2c94c'][i % 4], x, 1.09, 0, { seg: 6 }); k.b.cyl(0.009, 0.009, 0.06, '#8c1f1f', x, 0.995, 0, { seg: 5 }); } },
  analizor: (k) => { k.b.box(0.58, 0.5, 0.5, '#e9eef2', 0, 1.15, 0, { r: 0.03 }); k.l.box(0.22, 0.14, 0.005, '#5fd68a', -0.12, 1.22, 0.252, Z0); k.gl.box(0.2, 0.18, 0.005, '#cfe8f2', 0.15, 1.12, 0.252, Z0); },
  kanDolap: (k, W, D) => { k.b.box(W, 1.9, D, '#e9eef2', 0, 0.95, 0, { r: 0.03 }); k.gl.box(W - 0.1, 1.5, 0.01, '#ffe0e0', 0, 1.0, D / 2 + 0.005, Z0); for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) k.b.box(0.13, 0.2, 0.05, '#a3182a', -W / 2 + 0.18 + i * 0.18, 0.4 + r * 0.38, 0.1, { r: 0.02 }); k.g.add(levha('KAN BANKASI', '#a3182a', '#ffffff', W - 0.1, 0.18, 0, 1.82, D / 2 + 0.012, 0)); },
  kuvoz: (k, W, D) => { k.b.box(W, 0.75, D, '#e9eef2', 0, 0.38, 0, { r: 0.04 }); k.gl.box(W - 0.05, 0.42, D - 0.05, '#e6f6ff', 0, 0.98, 0, { r: 0.12 }); k.b.box(W - 0.2, 0.06, D - 0.2, '#fbe3ec', 0, 0.8, 0); k.b.box(0.18, 0.07, 0.14, '#7fb8d8', 0.05, 0.86, 0, { r: 0.03 }); k.b.sph(0.055, '#f2c8a8', -0.08, 0.87, 0, { ws: 8, hs: 6 }); for (const sx of [-1, 1]) k.b.tor(0.06, 0.012, metal, sx * 0.2, 0.98, D / 2 - 0.02, { ts: 10 }); k.l.box(0.1, 0.04, 0.005, '#5fd68a', W / 2 - 0.12, 0.6, D / 2 + 0.003, Z0); },
  besik: (k, W, D) => { k.b.box(W - 0.1, 0.06, D - 0.05, metal, 0, 0.5, 0, Z0); for (const sx of [-1, 1]) k.b.box(0.03, 0.5, 0.03, metal, sx * (W / 2 - 0.1), 0.25, 0, Z0); k.gl.box(W - 0.1, 0.3, D - 0.05, '#e6f6ff', 0, 0.72, 0, { r: 0.04 }); k.b.box(W - 0.25, 0.05, D - 0.2, '#dfeefb', 0, 0.58, 0); k.b.box(0.2, 0.07, 0.14, '#f2a2b3', 0.05, 0.64, 0, { r: 0.03 }); k.b.sph(0.055, '#e8b898', -0.1, 0.65, 0, { ws: 8, hs: 6 }); },
  camBolme: (k, W, D) => { const L = Math.max(W, D), along = W >= D; k.gl.box(along ? L : 0.03, 2.2, along ? 0.03 : L, '#d8eef6', 0, 1.2, 0, Z0); k.b.box(along ? L : 0.06, 0.06, along ? 0.06 : L, metal, 0, 2.3, 0, Z0); k.b.box(along ? L : 0.06, 0.1, along ? 0.06 : L, metal, 0, 0.05, 0, Z0); },
  sallanan: (k) => { k.b.box(0.6, 0.08, 0.55, '#c9a26a', 0, 0.42, 0); k.b.box(0.6, 0.7, 0.06, '#c9a26a', 0, 0.8, -0.25, { rx: -0.15 }); for (const sx of [-1, 1]) k.b.tor(0.5, 0.025, '#a8784e', sx * 0.28, 0.5, 0, { ry: HP, arc: 1.2, rz: Math.PI + 0.97, ts: 10 }); k.b.box(0.5, 0.08, 0.4, '#f3d6e2', 0, 0.48, 0.02, { r: 0.03 }); },
  kosuBandi: (k, W, D) => { k.b.box(W, 0.18, D, koyu, 0, 0.12, 0, { r: 0.04 }); k.b.box(W - 0.2, 0.02, D - 0.2, '#3a3f47', 0, 0.22, 0, Z0); for (const sx of [-1, 1]) k.b.box(0.05, 1.1, 0.05, metal, sx * (W / 2 - 0.05), 0.65, -D / 2 + 0.15, { rx: 0.15 }); k.b.box(W, 0.3, 0.12, '#3a3f47', 0, 1.25, -D / 2 + 0.05, { r: 0.04 }); k.l.box(0.3, 0.12, 0.005, '#5fd6ff', 0, 1.27, -D / 2 + 0.115, Z0); },
  paralelBar: (k, W, D) => { for (const sz of [-1, 1]) { k.b.box(W, 0.05, 0.05, metal, 0, 0.9, sz * (D / 2 - 0.05), Z0); for (const sx of [-1, 0, 1]) k.b.cyl(0.03, 0.03, 0.9, metal, sx * (W / 2 - 0.1), 0.45, sz * (D / 2 - 0.05), { seg: 6 }); } k.b.box(W, 0.03, D, '#5f9a52', 0, 0.015, 0, Z0); },
  egzMerdiven: (k, W, D) => { for (let i = 0; i < 4; i++) k.b.box(W, 0.15 * (i + 1), D / 4, '#cfd6dd', 0, 0.075 * (i + 1), -D / 2 + (i + 0.5) * D / 4, { r: 0.02 }); for (const sx of [-1, 1]) k.b.box(0.04, 0.04, D, metal, sx * (W / 2 + 0.05), 1.3, 0, { rx: -0.35 }); },
  tens: (k) => { k.b.box(0.3, 0.12, 0.24, '#e9eef2', 0, 0.85, 0, { r: 0.03 }); k.l.box(0.12, 0.05, 0.005, '#5fd68a', 0, 0.87, 0.122, Z0); },
  pilatesTop: (k, W) => { k.b.sph(W / 2, W > 0.6 ? '#2f7fd0' : '#e58fb0', 0, W / 2, 0, { ws: 14, hs: 10 }); },
  dambilRaf: (k, W, D) => { k.b.box(W, 0.06, D, koyu, 0, 0.4, 0, Z0); k.b.box(W, 0.06, D, koyu, 0, 0.8, 0, Z0); for (const sx of [-1, 1]) k.b.box(0.05, 0.85, D, koyu, sx * (W / 2 - 0.03), 0.42, 0, Z0); for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) { const x = -W / 2 + 0.18 + i * (W - 0.36) / 4, y = 0.48 + r * 0.4; for (const sz of [-0.1, 0.1]) k.b.cyl(0.05, 0.05, 0.05, ['#e0533c', '#2f7fd0', '#5fd68a', '#f2c94c', koyu][i], x, y, sz, { rx: HP, seg: 8 }); k.b.cyl(0.015, 0.015, 0.2, metal, x, y, 0, { rx: HP, seg: 5 }); } },
  ayna: (k, W) => { k.b.box(W, 1.9, 0.04, '#9aa5b0', 0, 1.3, 0, Z0); k.gl.box(W - 0.06, 1.84, 0.005, '#e8f6fb', 0, 1.3, 0.022, Z0); },
  hemsireMasa: (k, W, D) => { k.b.box(W, 1.05, D, '#fbfaf6', 0, 0.52, 0, { r: 0.05 }); k.b.box(W + 0.06, 0.05, D + 0.08, '#3f7fb0', 0, 1.07, 0); k.b.box(W, 0.1, 0.01, '#3f7fb0', 0, 0.85, D / 2 + 0.005, Z0); for (let i = 0; i < 4; i++) k.b.box(0.24, 0.06, 0.3, ['#2f7fd0', '#e0533c', '#f2c94c', '#2f9e5a'][i], -W / 2 + 0.4 + i * 0.4, 1.12, -0.1, Z0); },
  bayrak: (k) => { k.b.cyl(0.02, 0.02, 2.3, '#c9a23a', 0, 1.15, 0, { seg: 8 }); k.b.cyl(0.18, 0.2, 0.06, koyu, 0, 0.03, 0, { seg: 12 }); k.b.sph(0.05, '#c9a23a', 0, 2.33, 0, { ws: 8, hs: 6 }); k.b.box(0.03, 0.7, 0.9, '#e30a17', 0, 1.8, 0.46, { r: 0.01 }); k.b.cyl(0.13, 0.13, 0.035, '#ffffff', 0.002, 1.8, 0.38, { rz: HP, seg: 14 }); k.b.cyl(0.11, 0.11, 0.04, '#e30a17', 0.002, 1.8, 0.41, { rz: HP, seg: 14 }); k.b.box(0.035, 0.08, 0.08, '#ffffff', 0.002, 1.8, 0.56, { rx: Math.PI / 4, r: 0 }); },
  portre: (k, W) => { k.b.box(W * 0.8, W, 0.05, '#c9a23a', 0, 2.0, 0, Z0); k.b.box(W * 0.7, W * 0.9, 0.01, '#3a3f47', 0, 2.0, 0.03, Z0); k.b.sph(0.13, '#d9d2c4', 0, 2.12, 0.04, { ws: 8, hs: 6, sz: 0.3 }); k.b.box(0.42, 0.3, 0.01, '#d9d2c4', 0, 1.82, 0.04, Z0); },
  diploma: (k, W) => { for (let i = 0; i < 3; i++) { k.b.box(0.5, 0.38, 0.03, '#5a3a24', -W / 3 + i * W / 3, 1.9, 0, Z0); k.b.box(0.42, 0.3, 0.005, '#fbf6ea', -W / 3 + i * W / 3, 1.9, 0.018, Z0); k.b.cyl(0.03, 0.03, 0.005, '#c9a23a', -W / 3 + i * W / 3 + 0.12, 1.82, 0.022, { rx: HP, seg: 10 }); } },
  ranza: (k, W, D) => { for (const y of [0.4, 1.45]) { k.b.box(W, 0.08, D, '#7d8a96', 0, y, 0); k.b.box(W - 0.08, 0.14, D - 0.08, '#fbfaf6', 0, y + 0.11, 0); k.b.box(W * 0.55, 0.05, D - 0.06, '#6b5b95', 0.2, y + 0.2, 0); k.b.box(0.35, 0.1, D * 0.6, '#ffffff', -W / 2 + 0.25, y + 0.22, 0, { r: 0.04 }); } for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.b.box(0.05, 1.9, 0.05, '#5a6470', sx * (W / 2 - 0.03), 0.95, sz * (D / 2 - 0.03), Z0); for (let i = 0; i < 4; i++) k.b.box(0.03, 0.03, 0.4, '#5a6470', W / 2 - 0.03, 0.6 + i * 0.25, D / 2 - 0.3, Z0); },
  mutfakTezgah: (k, W, D) => { k.b.box(W, 0.88, D, '#e9e4da', 0, 0.44, 0, { r: 0.02 }); k.b.box(W + 0.04, 0.04, D + 0.04, '#5a6470', 0, 0.9, 0, Z0); k.b.box(W, 0.6, 0.32, '#e9e4da', 0, 1.75, -D / 2 + 0.16, { r: 0.02 }); },
  kahveMak: (k) => { k.b.box(0.3, 0.4, 0.3, koyu, 0, 1.12, 0, { r: 0.03 }); k.b.cyl(0.05, 0.04, 0.09, '#fbfaf6', 0, 0.97, 0.08, { seg: 8 }); k.l.box(0.06, 0.03, 0.005, '#ff8a3a', 0.08, 1.25, 0.152, Z0); },
  kettle: (k) => { k.b.cyl(0.08, 0.1, 0.22, metal, 0, 1.03, 0, { seg: 12 }); k.b.box(0.03, 0.12, 0.08, koyu, -0.11, 1.05, 0); },
  miniBuzdolap: (k, W, D) => { k.b.box(W, 0.85, D, '#fbfaf6', 0, 0.42, 0, { r: 0.04 }); k.b.box(0.03, 0.3, 0.03, metal, W / 2 - 0.08, 0.55, D / 2 + 0.01, Z0); },
  tekerlekli: (k) => { for (const sx of [-1, 1]) { k.b.tor(0.28, 0.025, koyu, sx * 0.3, 0.3, 0.05, { ry: HP, ts: 16 }); k.b.tor(0.24, 0.012, metal, sx * 0.34, 0.3, 0.05, { ry: HP, ts: 14 }); k.b.box(0.03, 0.03, 0.5, metal, sx * 0.24, 0.72, 0.05, Z0); } k.b.box(0.48, 0.05, 0.44, '#3f6fa8', 0, 0.5, 0.05); k.b.box(0.48, 0.45, 0.04, '#3f6fa8', 0, 0.78, -0.2, { rx: -0.1 }); k.b.box(0.4, 0.03, 0.14, koyu, 0, 0.12, 0.35, Z0); for (const sx of [-1, 1]) k.b.sph(0.05, koyu, sx * 0.2, 0.05, 0.35, { ws: 6, hs: 4 }); },
  saksi: (k, W) => { k.b.cyl(W / 2 - 0.05, W / 2 - 0.12, 0.62, '#d9d2c4', 0, 0.31, 0, { seg: 14 }); k.b.cyl(0.04, 0.05, 0.9, '#6b4a2a', 0, 1.0, 0, { seg: 6 }); k.b.ico(W * 0.55, '#4f8a4a', 0, 1.55, 0, { d: 1 }); k.b.ico(W * 0.38, '#5f9a52', 0.15, 1.95, -0.1, { d: 1 }); },
};
/** duvara asılı / ince eşyalar: yon yoksa en yakın duvara göre döner */
const DUVAR = new Set(['pano', 'menuPano', 'tv', 'saat', 'negatoskop', 'rontgenPano', 'radyasyon', 'eczHaci', 'balonlar', 'ayna', 'portre', 'diploma', 'monitorDuvar', 'pencere', 'oksijenPano', 'tansiyon']);
const ASILI_Y: Record<string, number> = { pano: 2.35, menuPano: 2.3 };

function esyaCiz(k: Kit, o: HOda, s: HEsya) {
  const p = odaXZ(o, s.u, s.v); let ry = 0, W = s.w, D = s.d;
  if (s.yon) ry = yonRy(o, s.yon);
  else if (DUVAR.has(s.k) || (s.k === 'perde' && false)) {
    if (s.w >= s.d) ry = s.v < OV / 2 ? 0 : Math.PI;
    else { ry = yonRy(o, s.u > OU / 2 ? 'hol' : 'dis'); W = s.d; D = s.w; }
  }
  const f = CIZ[s.k]; if (!f) return;
  const m = new T.Matrix4().makeRotationY(ry).setPosition(p.x, FT, p.z);
  for (const bb of [k.b, k.gl, k.l]) bb.push(m);
  const sub = new T.Group(); sub.position.set(p.x, FT + (ASILI_Y[s.k] || 0), p.z); sub.rotation.y = ry; sub.translateZ(0.03);
  f({ ...k, g: sub }, W, D, s, o);
  for (const bb of [k.b, k.gl, k.l]) bb.pop();
  if (sub.children.length) k.g.add(sub);
}
function bantCiz(k: Kit, s: BantEsya, kat: number) {
  const f = CIZ[s.k];
  if (s.k === 'koltukSira') {
    const n = Math.round(s.w / 0.58); k.b.box(s.w, 0.05, 0.08, metal, s.x, FT + 0.3, s.z, Z0);
    for (let i = 0; i < n; i++) { const x = s.x - s.w / 2 + 0.29 + i * 0.58; k.b.box(0.5, 0.06, 0.46, '#2f7fd0', x, FT + 0.44, s.z + 0.02, { r: 0.03 }); k.b.box(0.5, 0.42, 0.05, '#2f7fd0', x, FT + 0.68, s.z - 0.22, { r: 0.03, rx: 0.1 }); }
    for (const dx of [-s.w / 2 + 0.1, s.w / 2 - 0.1]) k.b.box(0.06, 0.4, 0.5, koyu, s.x + dx, FT + 0.2, s.z, Z0);
    return;
  }
  if (s.k === 'kabulTezgah') {
    k.b.box(s.w, 1.05, s.d, beyaz, s.x, FT + 0.52, s.z, { r: 0.05 }); k.b.box(s.w + 0.06, 0.05, s.d + 0.08, '#1d4f86', s.x, FT + 1.07, s.z); k.b.box(s.w, 0.14, 0.01, '#1d4f86', s.x, FT + 0.84, s.z - s.d / 2 - 0.005, Z0);
    if (kat === 0) for (const g of GISE) { k.gl.box(0.02, 0.7, s.d, '#d8eef6', g.x + 1.3, FT + 1.45, s.z, Z0); k.gl.box(1.0, 0.55, 0.02, '#d8eef6', g.x, FT + 1.45, s.z - 0.2, Z0); k.g.add(levha('GİŞE ' + g.id, '#1d4f86', '#ffffff', 0.7, 0.24, g.x, FT + 2.0, s.z - 0.21, Math.PI)); k.b.box(0.46, 0.3, 0.03, koyu, g.x + 0.3, FT + 1.25, s.z + 0.15, { ry: Math.PI + 0.3, r: 0 }); }
    k.g.add(levha(kat === 0 ? 'HASTA KABUL' : 'BANKO', '#1d4f86', '#ffffff', 2.2, 0.36, s.x, FT + 2.5, LOBI_Z1 - 0.04, Math.PI));
    return;
  }
  if (s.k === 'numarator') {
    k.b.box(s.w + 0.1, 0.55, 0.06, '#121417', s.x + (kat === 0 ? 3.0 : 0), FT + 2.85, s.z, Z0);
    k.g.add(levha(kat === 0 ? ['SIRA 042 → GİŞE 2', 'SIRA 043 → GİŞE 1'] : [s.txt || ''], '#0d2a1e', '#7dffa8', s.w, 0.48, s.x + (kat === 0 ? 3.0 : 0), FT + 2.85, s.z - 0.035, Math.PI));
    return;
  }
  if (s.k === 'danisma') {
    k.b.box(s.w, 1.05, s.d, beyaz, s.x, FT + 0.52, s.z, { r: 0.08, s: 2 }); k.b.box(s.w + 0.06, 0.05, s.d + 0.06, '#d93a3a', s.x, FT + 1.07, s.z); k.b.box(s.w, 0.12, 0.02, '#d93a3a', s.x, FT + 0.85, s.z - s.d / 2 - 0.01, Z0);
    k.g.add(levha('DANIŞMA', '#d93a3a', '#ffffff', 1.3, 0.3, s.x, FT + 1.6, s.z, Math.PI)); k.b.box(0.04, 0.5, 0.04, koyu, s.x, FT + 1.33, s.z);
    return;
  }
  if (s.k === 'guvenlik') { k.b.box(s.w, 1.0, s.d, '#3a3f47', s.x, FT + 0.5, s.z, { r: 0.04 }); k.l.box(0.4, 0.25, 0.005, '#9fc6e0', s.x - 0.2, FT + 1.15, s.z + s.d / 2 - 0.1, { rx: -0.4, r: 0 }); k.g.add(levha('GÜVENLİK', '#1d1d22', '#ffd23f', 0.9, 0.22, s.x, FT + 1.55, s.z, Math.PI)); return; }
  if (s.k === 'sebil') { k.b.box(0.34, 1.0, 0.34, '#e9eef2', s.x, FT + 0.5, s.z, { r: 0.04 }); k.gl.cyl(0.14, 0.14, 0.4, '#bfe3f5', s.x, FT + 1.22, s.z, { seg: 12 }); k.b.box(0.06, 0.04, 0.04, '#2f7fd0', s.x - 0.06, FT + 0.75, s.z + 0.18); k.b.box(0.06, 0.04, 0.04, '#e0533c', s.x + 0.06, FT + 0.75, s.z + 0.18); return; }
  if (s.k === 'cicekStand') { k.b.box(s.w, 0.8, s.d, '#b8875a', s.x, FT + 0.4, s.z); for (let i = 0; i < 6; i++) k.b.sph(0.1, ['#e0533c', '#ffcf5a', '#f2a2b3', '#fbfaf6', '#c94f6d', '#7b5fc0'][i], s.x - 0.4 + i * 0.16, FT + 0.95 + (i % 2) * 0.08, s.z, { ws: 6, hs: 4 }); k.g.add(levha('ÇİÇEKÇİ', '#3a5f2a', '#ffffff', 0.8, 0.2, s.x, FT + 1.4, s.z - 0.26, Math.PI)); return; }
  if (!f) return;
  const ry = s.k === 'tv' || s.k === 'saksi' || s.k === 'tekerlekli' ? Math.PI : 0;
  const m = new T.Matrix4().makeRotationY(ry).setPosition(s.x, FT, s.z);
  for (const bb of [k.b, k.gl, k.l]) bb.push(m);
  f(k, s.w, s.d, s);
  for (const bb of [k.b, k.gl, k.l]) bb.pop();
}

/* ---------- bina ---------- */
interface Kesit { g: T.Object3D; zw: number; x0: number; x1: number; kat: number }
function insa(): { g: T.Group; katlar: T.Group[]; kesit: Kesit[]; kapi: T.Object3D[]; asansor: { m: T.Object3D; kat: number; x: number; s: number }[]; odaHol: { g: T.Object3D; o: HOda }[] } {
  const g = new T.Group(); g.name = 'hastaneIc';
  const solid = mat().solid;
  const glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.3, depthWrite: false });
  const glow = mat().glow;
  const katlar: T.Group[] = [], kesit: Kesit[] = [], kapi: T.Object3D[] = [], asansor: { m: T.Object3D; kat: number; x: number; s: number }[] = [], odaHol: { g: T.Object3D; o: HOda }[] = [];
  const cx = HST.cx, voidX0 = MERD.kx0 - 0.05, voidX1 = MERD.kx1 + 0.05;
  const mesh = (kg: T.Object3D, b: Batch, gl?: Batch, l?: Batch) => { if (!b.empty) kg.add(b.mesh(solid, true, true)); if (gl && !gl.empty) { const m = gl.mesh(glass, false, false); m.renderOrder = 2; kg.add(m); } if (l && !l.empty) kg.add(l.mesh(glow, false, false)); };

  // dışarısı: hastane bahçesi, ambulans yolu ve park, ağaçlar, banklar, lamba
  { const b = new Batch(), l = new Batch();
    b.box(90, 0.1, 70, '#cfc9bb', cx, -0.05, HST.z0 + 10, Z0); b.box(HST.x1 - HST.x0 + 4, 0.02, 3.4, '#b9b0a0', cx, 0.01, HST.z0 - 2.3, Z0);
    b.box(60, 0.02, 6, '#5b6068', cx, 0.012, HST.z0 - 9, Z0); for (let i = -6; i <= 6; i++) b.box(1.6, 0.004, 0.14, '#f2f2ee', cx + i * 4, 0.025, HST.z0 - 9, Z0);
    // ambulans (park halinde, ışıkları sönük: yanıp sönmez)
    { const ax = cx - 8, az = HST.z0 - 8.3; b.box(2.0, 1.5, 4.6, '#fbfaf6', ax, 1.05, az, { r: 0.12 }); b.box(1.9, 0.9, 1.3, '#fbfaf6', ax, 0.75, az - 2.85, { r: 0.12 }); b.box(2.02, 0.22, 4.62, '#d93a3a', ax, 0.85, az); b.box(1.92, 0.2, 1.32, '#d93a3a', ax, 0.6, az - 2.85);
      l.box(1.7, 0.45, 0.02, '#a9d0e6', ax, 1.05, az - 3.51, Z0); for (const sx of [-1, 1]) { b.box(0.3, 0.14, 0.3, sx < 0 ? '#c03a3a' : '#3a6ac0', ax + sx * 0.55, 1.88, az - 2.0); for (const sz of [-1.5, 1.4]) b.cyl(0.36, 0.36, 0.25, '#1d1d22', ax + sx * 0.98, 0.36, az + sz, { rz: HP, seg: 14 }); }
      b.box(0.04, 0.5, 0.5, '#d93a3a', ax + 1.01, 1.25, az + 0.5, Z0); b.box(0.04, 0.5, 0.5, '#d93a3a', ax - 1.01, 1.25, az + 0.5, Z0); }
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { const x = cx + sx * (5 + i * 4.5), z = HST.z0 - 4.6; b.cyl(0.12, 0.16, 2.2, '#6b4a2a', x, 1.1, z, { seg: 8 }); b.ico(1.25, i % 2 ? '#5f9a52' : '#4f8a4a', x, 2.9, z, { d: 1 }); b.cyl(0.6, 0.6, 0.35, '#8a8f96', x, 0.17, z, { seg: 12 }); }
    for (const sx of [-1, 1]) { b.box(1.8, 0.07, 0.45, '#b8875a', cx + sx * 7.2, 0.45, HST.z0 - 2.0); b.box(1.8, 0.35, 0.05, '#b8875a', cx + sx * 7.2, 0.68, HST.z0 - 1.8); }
    // giriş saçağı ve "DEVLET HASTANESİ" yazısı
    b.box(6.0, 0.18, 2.4, '#e9eef2', cx, 3.05, HST.z0 - 1.2); b.box(6.0, 0.08, 0.1, '#d93a3a', cx, 2.94, HST.z0 - 2.4); for (const sx of [-1, 1]) b.cyl(0.08, 0.08, 3.0, '#c9ced6', cx + sx * 2.8, 1.5, HST.z0 - 2.25, { seg: 8 });
    mesh(g, b, undefined, l);
    g.add(levha('DEVLET HASTANESİ', '#ffffff', '#d93a3a', 5.0, 0.6, cx, 3.55, HST.z0 - 0.02, Math.PI));
    g.add(levha('+', '#d93a3a', '#ffffff', 0.6, 0.6, cx - 3.0, 3.55, HST.z0 - 0.02, Math.PI)); }

  for (let k = 0; k < HST.KAT; k++) {
    const kg = new T.Group(); kg.name = 'hstKat' + k; kg.position.y = katY(k); g.add(kg); katlar.push(kg);
    const b = new Batch(), gl = new Batch(), l = new Batch(), kit: Kit = { b, gl, l, g: kg }, top = FT;
    // döşeme: zeminde tam; üst katlarda merdiven boşluğu
    const slab = (x0: number, x1: number, z0: number, z1: number) => b.span(x0, x1, top - 0.3, top, z0, z1, '#e4e9ea', Z0);
    if (k === 0) slab(HST.x0, HST.x1, HST.z0, HST.z1);
    else { slab(HST.x0, HST.x1, HST.z0, MERD.on); slab(HST.x0, HST.x1, MERD.arka, HST.z1); slab(HST.x0, voidX0, MERD.on, MERD.arka); slab(voidX1, HST.x1, MERD.on, MERD.arka); }
    // hol + ön bant zemini: açık nane vinil, karolar; holde yön şeritleri (kırmızı acil, yeşil eczane, mavi poliklinik)
    b.box(HOL.x1 - HOL.x0, 0.004, HST.z1 - LOBI_Z1, '#dcebe6', cx, top + 0.002, (LOBI_Z1 + HST.z1) / 2, Z0);
    b.box(HST.x1 - HST.x0, 0.004, LOBI_Z1 - HST.z0, '#e9efee', cx, top + 0.002, (HST.z0 + LOBI_Z1) / 2, Z0);
    for (let x = HST.x0 + 1.2; x < HST.x1; x += 1.2) b.box(0.015, 0.005, LOBI_Z1 - HST.z0, '#cfdcd8', x, top + 0.003, (HST.z0 + LOBI_Z1) / 2, Z0);
    for (let z = HST.z0 + 1.2; z < LOBI_Z1; z += 1.2) b.box(HST.x1 - HST.x0, 0.005, 0.015, '#cfdcd8', cx, top + 0.003, z, Z0);
    const serit = [['#d93a3a', -0.25], ['#2f9e5a', 0.0], ['#2f7fd0', 0.25]] as const;
    for (const [c, dx] of serit) { b.box(0.1, 0.006, LOBI_Z1 - HST.z0 - 1.5, c, cx + dx, top + 0.004, (HST.z0 + LOBI_Z1) / 2 + 0.75, Z0); }
    for (const sx of [-1, 1]) b.box(0.12, 0.006, HST.z1 - LOBI_Z1 - 0.6, '#7fb4a8', cx + sx * (HOL.x1 - HOL.x0 - 0.3) / 2, top + 0.004, (LOBI_Z1 + HST.z1) / 2, Z0);
    // cam cephe (ön): dikmeler, kat kirişi; zeminde otomatik kapı
    const fz = HST.z0 + 0.05, fh = 3.48;
    for (let x = HST.x0; x <= HST.x1 + 0.01; x += 1.7) if (k > 0 || x < GIRIS_KAPI.x0 - 0.05 || x > GIRIS_KAPI.x1 + 0.05) b.box(0.08, fh, 0.12, '#8a98a6', x, top + fh / 2, fz, Z0);
    b.box(HST.x1 - HST.x0, 0.22, 0.2, '#e9eef2', cx, top + fh - 0.05, fz, Z0); b.box(HST.x1 - HST.x0, 0.06, 0.14, '#8a98a6', cx, top + 0.03, fz, Z0);
    const cam = (x0: number, x1: number) => gl.span(x0, x1, top + 0.06, top + fh - 0.16, fz - 0.01, fz + 0.01, '#cfe8f2', Z0);
    if (k === 0) { cam(HST.x0, GIRIS_KAPI.x0); cam(GIRIS_KAPI.x1, HST.x1); b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0 + 0.3, 0.35, 0.3, '#8a98a6', cx, top + 2.45, fz, Z0); b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0 + 1.2, 0.02, 1.6, '#8a9a94', cx, top + 0.006, fz + 0.9, Z0); for (let i = 0; i < 9; i++) b.box(GIRIS_KAPI.x1 - GIRIS_KAPI.x0 + 1.0, 0.004, 0.05, '#71837c', cx, top + 0.018, fz + 0.22 + i * 0.17, Z0); }
    else cam(HST.x0, HST.x1);
    // dış duvarlar: içe bakan yüzler (yan duvarlarda pencere), arka duvar
    const duvarYuz = (len: number, x: number, z: number, ry: number, c: string, h = fh) => { b.push(new T.Matrix4().makeRotationY(ry).setPosition(x, top, z)); b.plane(len, h, c, 0, h / 2, 0); b.plane(len, 1.0, '#cfe0dc', 0, 0.5, 0.005); b.box(len, 0.1, 0.02, '#7fb4a8', 0, 0.05, 0.012, Z0); b.box(len, 0.06, 0.03, '#ffffff', 0, 1.0, 0.015, Z0); b.pop(); };
    duvarYuz(HST.z1 - LOBI_Z1, HST.x0 + 0.1, (LOBI_Z1 + HST.z1) / 2, HP, '#f4f8f9'); duvarYuz(HST.z1 - LOBI_Z1, HST.x1 - 0.1, (LOBI_Z1 + HST.z1) / 2, -HP, '#f4f8f9');
    duvarYuz(LOBI_Z1 - HST.z0, HST.x0 + 0.1, (HST.z0 + LOBI_Z1) / 2, HP, '#f4f8f9'); duvarYuz(LOBI_Z1 - HST.z0, HST.x1 - 0.1, (HST.z0 + LOBI_Z1) / 2, -HP, '#f4f8f9');
    duvarYuz(HOL.x1 - HOL.x0, cx, HST.z1 - 0.1, Math.PI, '#eef5f3');
    b.box(HST.x1 - HST.x0, 0.06, 0.2, '#e9e4da', cx, top + fh + 0.03, HST.z1 - 0.1, Z0); for (const x of [HST.x0 + 0.1, HST.x1 - 0.1]) b.box(0.2, 0.06, HST.z1 - HST.z0, '#e9e4da', x, top + fh + 0.03, (HST.z0 + HST.z1) / 2, Z0);
    kg.add(levha(KAT_ADI[k].toLocaleUpperCase('tr'), '#1d4f86', '#ffffff', 4.6, 0.5, cx, top + 3.0, HST.z1 - 0.12, Math.PI));
    // asansörler (arka duvar): çelik kapılar (yaklaşınca açılır), kasa, çağırma düğmesi, kat göstergesi
    for (const a of ASANSOR) {
      const yok = k + a.yon < 0 || k + a.yon >= HST.KAT, z = HST.z1 - 0.12;
      b.box(1.5, 2.5, 0.08, '#9aa5b0', a.x, top + 1.25, z, Z0); b.box(1.24, 2.22, 0.05, '#2b2f36', a.x, top + 1.11, z - 0.03, Z0);
      for (const s of [-1, 1]) { const m = new T.Mesh(new T.BoxGeometry(0.6, 2.15, 0.03), mat().celik); m.position.set(a.x + s * 0.3, top + 1.09, z - 0.06); kg.add(m); asansor.push({ m, kat: k, x: a.x, s }); }
      b.box(0.12, 0.22, 0.03, '#2b2f36', a.x + 0.95, top + 1.2, z - 0.03, Z0); l.cyl(0.03, 0.03, 0.01, yok ? '#5b6068' : '#ffd27a', a.x + 0.95, top + 1.24 + (a.yon > 0 ? 0.04 : -0.04), z - 0.05, { rx: HP, seg: 10 });
      kg.add(levha(yok ? '—' : (a.yon > 0 ? '▲ ' : '▼ ') + (KAT_ADI[k + a.yon] || '').split(' · ')[0].toLocaleUpperCase('tr'), yok ? '#5b6068' : a.yon > 0 ? '#2f9e5a' : '#1d4f86', '#ffffff', 1.3, 0.3, a.x, top + 2.75, z - 0.05, Math.PI));
      b.box(1.3, 0.004, 0.9, '#c9ced6', a.x, top + 0.004, z - 0.6, Z0);
    }
    kg.add(levha('ASANSÖR', '#e9eef2', '#1d4f86', 1.0, 0.22, cx, top + 2.4, HST.z1 - 0.13, Math.PI));
    // ön bant eşyaları
    for (const s of bantEsya(k)) bantCiz(kit, s, k);
    if (k === 0) {   // kat rehberi panosu (lobide, batı duvarında)
      const rehber = ['KAT REHBERİ', ...[3, 2, 1, 0].map(q => KAT_KISA_AD(q))];
      kg.add(levha(rehber, '#1d4f86', '#ffffff', 2.4, 2.0, HST.x0 + 0.13, top + 1.8, 46.6, HP));
      kg.add(levha('ACİL ←', '#d93a3a', '#ffffff', 1.2, 0.3, KABUL.x1 + 0.9, top + 2.9, LOBI_Z1 - 0.04, Math.PI));
    }
    // galeri korkuluğu (üst katlar), merdiven çevresi
    if (k > 0) {
      const rail = (x0: number, x1: number, z0: number, z1: number) => { gl.span(x0, x1, top, top + 1.0, z0, z1, '#d8eef6', Z0); b.span(x0, x1, top + 1.0, top + 1.06, z0, z1, '#a8784e', Z0); };
      rail(voidX0 - 0.03, voidX0, MERD.on, MERD.arka); rail(voidX1, voidX1 + 0.03, MERD.on, MERD.arka);
      const ac0 = SERIT.U.x0 - 0.05, ac1 = SERIT.D.x1 + 0.05;
      rail(voidX0, ac0, MERD.arka - 0.03, MERD.arka); rail(ac1, voidX1, MERD.arka - 0.03, MERD.arka);
      if (k === HST.KAT - 1) rail(voidX0, voidX1, MERD.on, MERD.on + 0.03); else { rail(voidX0, ac0, MERD.on, MERD.on + 0.03); rail(ac1, voidX1, MERD.on, MERD.on + 0.03); }
    }
    // hol duvarları boyunca küpeşte (hasta tutunma barı), dezenfektan, yangın tüpü
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? HOL.x0 + 0.08 : HOL.x1 - 0.08;
      for (const [z0, z1] of [[LOBI_Z1 + 0.2, (LOBI_Z1 + SIRA_Z) / 2 - 1.1], [(LOBI_Z1 + SIRA_Z) / 2 + 1.1, SIRA_Z - 0.2], [SIRA_Z + 0.2, (SIRA_Z + HST.z1) / 2 - 1.1], [(SIRA_Z + HST.z1) / 2 + 1.1, HST.z1 - 0.3]]) b.box(0.05, 0.06, z1 - z0, '#a8784e', x, top + 0.9, (z0 + z1) / 2, Z0);
      b.box(0.1, 0.2, 0.12, '#fbfaf6', x, top + 1.35, (LOBI_Z1 + SIRA_Z) / 2 + 1.45); b.box(0.04, 0.04, 0.05, '#2f7fd0', x - sx * 0.05, top + 1.25, (LOBI_Z1 + SIRA_Z) / 2 + 1.45, Z0);
      b.cyl(0.08, 0.08, 0.5, '#d93a3a', x - sx * 0.05, top + 0.35, SIRA_Z + 0.5, { seg: 10 }); b.box(0.08, 0.1, 0.06, koyu, x - sx * 0.05, top + 0.65, SIRA_Z + 0.5);
    }
    // odalar
    for (const o of ODALAR.filter(q => q.kat === k)) odaCiz(kit, o, kesit, odaHol);
    mesh(kg, b, gl, l);
  }

  // merdivenler: alt katın grubunda (üst kat gizlenince basamaklar görünür kalır)
  for (let alt = 0; alt < HST.KAT - 1; alt++) {
    const kg = katlar[alt], b = new Batch(), gl = new Batch(), l = new Batch(), x0 = SERIT.U.x0 - 0.15, x1 = SERIT.D.x1 + 0.15, w = x1 - x0, xm = (x0 + x1) / 2;
    const n = 18, dz = RUN / n, dy = HST.FH / n, z0 = MERD.on + MERD.duz;
    b.box(w, 0.04, MERD.duz + 0.3, '#b9c0c8', xm, FT + 0.002, MERD.on + MERD.duz / 2 - 0.15, Z0);
    for (let i = 0; i < n; i++) { const y = FT + (i + 1) * dy; b.box(w, dy, dz + 0.02, '#e9e4da', xm, y - dy / 2, z0 + (i + 0.5) * dz, Z0); b.box(w, 0.012, 0.04, '#7a6e60', xm, y + 0.004, z0 + i * dz + 0.03, Z0); }
    b.box(w, 0.25, LEN, '#cfd6dd', xm, FT + HST.FH / 2 - 0.35, z0 + RUN / 2, { rx: -SLOPE, r: 0 });
    for (const sx of [-1, 0, 1]) {   // korkuluk: iki yan cam + orta tutamak
      const x = sx < 0 ? x0 + 0.02 : sx > 0 ? x1 - 0.02 : xm;
      if (sx) gl.box(0.02, 0.9, LEN, '#d8eef6', x, FT + HST.FH / 2 + 0.55, z0 + RUN / 2, { rx: -SLOPE, r: 0 });
      b.box(0.05, 0.05, LEN, '#a8784e', x, FT + HST.FH / 2 + 1.0, z0 + RUN / 2, { rx: -SLOPE, r: 0 });
      if (!sx) for (let i = 0; i <= 4; i++) { const t = i / 4; b.cyl(0.015, 0.015, 0.95, metal, x, FT + t * HST.FH + 0.47, z0 + t * RUN, { seg: 5 }); }
    }
    l.cone(0.2, 0.36, '#5fd68a', SERIT.U.x0 + 0.5, FT + 0.01, MERD.on - 0.5, { rx: HP, seg: 3, sz: 0.05 });
    mesh(kg, b, gl, l);
    { const l2 = new Batch(); l2.cone(0.2, 0.36, '#7fb8d8', SERIT.D.x0 + 0.5, FT + 0.01, MERD.arka + 0.5, { rx: -HP, seg: 3, sz: 0.05 }); mesh(katlar[alt + 1], new Batch(), undefined, l2); }
    kg.add(levha('▲ ' + KAT_KISA_AD(alt + 1).split(':')[0], '#2f9e5a', '#ffffff', 1.6, 0.3, xm, FT + 2.6, MERD.on - 0.6, Math.PI));
    katlar[alt + 1].add(levha('▼ ' + KAT_KISA_AD(alt).split(':')[0], '#1d4f86', '#ffffff', 1.6, 0.3, xm, FT + 2.6, MERD.arka + 0.6, 0));
  }
  // otomatik kapı kanatları
  for (const sx of [-1, 1]) { const m = new T.Mesh(new T.BoxGeometry((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 2, 2.2, 0.04), new T.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.3, depthWrite: false })); m.position.set(cx + sx * (GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4, FT + 1.1, HST.z0 + 0.05); m.userData.sx = sx; m.renderOrder = 2; katlar[0].add(m); kapi.push(m); }
  return { g, katlar, kesit, kapi, asansor, odaHol };
}
function KAT_KISA_AD(k: number): string { return ['ZEMİN', '1. KAT', '2. KAT', '3. KAT'][k] + ': ' + ODALAR.filter(o => o.kat === k).map(o => o.ad.split(' ')[0].replace('LABORATUVAR', 'LAB')).join(' · ') + (k === 0 ? ' · HASTA KABUL' : ''); }

/** bir odanın zemini, duvarları (içe bakan yüzler + hol yüzü + kapı kasası + tabela), penceresi ve eşyası */
function odaCiz(k: Kit, o: HOda, kesit: Kesit[], odaHol: { g: T.Object3D; o: HOda }[]) {
  const { b, l } = k, top = FT, xm = (o.x0 + o.x1) / 2, zm = (o.z0 + o.z1) / 2, W = o.x1 - o.x0, D = o.z1 - o.z0, kp = odaKapi(o), holX = kp.x, s = o.blok === 'W' ? 1 : -1;
  // zemin: oda rengi, karo çizgileri
  b.box(W - 0.2, 0.004, D - 0.2, o.zemin, xm, top + 0.003, zm, Z0);
  for (let x = o.x0 + 0.6; x < o.x1 - 0.2; x += 0.6) b.box(0.012, 0.005, D - 0.25, '#ffffff', x, top + 0.004, zm, Z0);
  for (let z = o.z0 + 0.6; z < o.z1 - 0.2; z += 0.6) b.box(W - 0.25, 0.005, 0.012, '#ffffff', xm, top + 0.004, z, Z0);
  if (o.id === 'ameliyat') b.box(4.6, 0.006, 4.0, '#9fc9b8', odaXZ(o, 8.2, 4.5).x, top + 0.005, odaXZ(o, 8.2, 4.5).z, Z0);
  // içe bakan yüz: ry ile yön; boya, lambri, süpürgelik, bant
  const yuz = (bb: Batch, len: number, x: number, z: number, ry: number, c: string, gap?: [number, number]) => {
    const segs: [number, number][] = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]];
    bb.push(new T.Matrix4().makeRotationY(ry).setPosition(x, top, z));
    for (const [a, c2] of segs) { const L = c2 - a, mx = (a + c2) / 2; if (L < 0.02) continue; bb.plane(L, WH, c, mx, WH / 2, 0); bb.plane(L, 1.05, shadeHex(c, -0.06), mx, 0.525, 0.004); bb.box(L, 0.1, 0.02, '#7fb4a8', mx, 0.05, 0.012, Z0); bb.box(L, 0.05, 0.03, o.renk, mx, 1.05, 0.015, Z0); }
    bb.pop();
  };
  // ön ve arka duvar (z sabit): ön duvar odaya +z bakar (kameradan uzak, kendiliğinden kaybolur); arka duvar -z bakar: kahraman arkasına geçince kaybolur
  yuz(b, W, xm, o.z0 + 0.1, 0, o.duvar);
  { const ab = new Batch(); yuz(ab, W, xm, o.z1 - 0.1, Math.PI, o.duvar); ab.box(W, 0.06, 0.2, '#e9e4da', xm, top + WH + 0.03, o.z1, Z0);
    if (o.sira === 'B') { /* bina arka duvarı: pencere şeridi */ for (let i = 0; i < Math.floor(W / 2.2); i++) { const x = o.x0 + 1.1 + i * 2.2 + (W % 2.2) / 2; ab.box(1.4, 1.3, 0.04, beyaz, x, top + 1.75, o.z1 - 0.13, Z0); } }
    const g = new T.Group(); if (!ab.empty) g.add(ab.mesh(mat().solid, true, true));
    if (o.sira === 'B') { const lb = new Batch(); for (let i = 0; i < Math.floor(W / 2.2); i++) { const x = o.x0 + 1.1 + i * 2.2 + (W % 2.2) / 2; lb.box(1.28, 1.18, 0.005, '#bfe3f5', x, top + 1.75, o.z1 - 0.16, Z0); } g.add(lb.mesh(mat().glow, false, false)); }
    k.g.add(g); kesit.push({ g, zw: o.z1 - 0.1, x0: o.x0, x1: o.x1, kat: o.kat }); }
  // ön duvarın lobi yüzü (yalnız ön sıra): lobiye bakar; kahraman lobiden içeri geçince kaybolur
  if (o.sira === 'F') { const lb = new Batch(); lb.push(new T.Matrix4().makeRotationY(Math.PI).setPosition(xm, top, o.z0 - 0.1)); lb.plane(W, WH, '#f4f8f9', 0, WH / 2, 0); lb.plane(W, 1.05, '#dfece8', 0, 0.525, 0.004); lb.box(W, 0.1, 0.02, '#7fb4a8', 0, 0.05, 0.012, Z0); lb.box(W, 0.05, 0.03, '#7fb4a8', 0, 1.05, 0.015, Z0); lb.pop(); lb.box(W, 0.06, 0.2, '#e9e4da', xm, top + WH + 0.03, o.z0, Z0);
    const g = new T.Group(); g.add(lb.mesh(mat().solid, true, true)); k.g.add(g); kesit.push({ g, zw: o.z0 - 0.1, x0: o.x0, x1: o.x1, kat: o.kat }); }
  // dış yan duvar (odanın içine bakan yüz) + pencereler
  const dx = o.blok === 'W' ? o.x0 + 0.12 : o.x1 - 0.12; yuz(b, D, dx, zm, o.blok === 'W' ? HP : -HP, o.duvar);
  for (let i = 0; i < Math.floor(D / 2.4); i++) { const z = o.z0 + 1.2 + i * 2.4 + (D % 2.4) / 2; b.box(0.04, 1.3, 1.5, beyaz, dx + s * 0.02, top + 1.75, z, Z0); l.box(0.005, 1.18, 1.38, '#bfe3f5', dx + s * 0.045, top + 1.75, z, Z0); }
  // hol duvarı: içe bakan yüz (kapı boşluklu) + hol yüzü (oda içindeyken gizlenir), kasa, tabela
  const gap: [number, number] = [-0.9, 0.9];
  yuz(b, D, holX - s * 0.1, zm, o.blok === 'W' ? -HP : HP, o.duvar, o.kapali ? undefined : gap);
  b.box(0.2, 0.06, D, '#e9e4da', holX, top + WH + 0.03, zm, Z0);
  const hb = new Batch(), hl = new Batch(); hb.push(new T.Matrix4().makeRotationY(o.blok === 'W' ? HP : -HP).setPosition(holX + s * 0.1, top, zm));
  for (const [a, c2] of (o.kapali ? [[-D / 2, D / 2]] : [[-D / 2, -0.9], [0.9, D / 2]]) as [number, number][]) { const L = c2 - a, mx = (a + c2) / 2; hb.plane(L, WH, '#eef5f3', mx, WH / 2, 0); hb.plane(L, 1.05, '#d6e6e1', mx, 0.525, 0.004); hb.box(L, 0.22, 0.03, '#cfe0dc', mx, 0.3, 0.015, Z0); hb.box(L, 0.1, 0.02, '#7fb4a8', mx, 0.05, 0.012, Z0); }
  if (o.kapali) { hb.box(1.6, 2.2, 0.05, '#cfe3da', 0, 1.1, 0.03, Z0); hb.box(0.02, 2.1, 0.06, '#9aa5b0', 0, 1.1, 0.06, Z0); hl.box(0.5, 0.36, 0.005, '#d8f5ea', -0.4, 1.6, 0.06, Z0); hl.box(0.5, 0.36, 0.005, '#d8f5ea', 0.4, 1.6, 0.06, Z0); hb.box(3.6, 1.1, 0.04, '#9aa5b0', -3.0, 1.55, 0.02, Z0); hl.box(3.4, 0.95, 0.005, '#cfe8f2', -3.0, 1.55, 0.045, Z0); }
  else { for (const q of [-1, 1]) hb.box(0.12, 2.4, 0.08, o.renk, q * 0.96, 1.2, 0.03, Z0); hb.box(2.04, 0.14, 0.08, o.renk, 0, 2.45, 0.03, Z0); }
  hb.pop(); hl.pop();
  const hg = new T.Group(); hg.add(hb.mesh(mat().solid, true, true)); if (!hl.empty) hg.add(hl.mesh(mat().glow, false, false));
  hg.add(levha(o.ad, o.renk, '#ffffff', Math.min(3.4, 0.9 + o.ad.length * 0.13), 0.36, holX + s * 0.13, top + 2.85, zm, o.blok === 'W' ? HP : -HP));
  if (o.kapali) hg.add(levha(['STERİL ALAN', 'GİRİLMEZ'], '#2f8f6f', '#ffffff', 1.0, 0.5, holX + s * 0.14, top + 2.25, zm, o.blok === 'W' ? HP : -HP));
  k.g.add(hg); odaHol.push({ g: hg, o });
  if (!o.kapali) { b.box(0.8, 0.012, 1.6, '#c9d8d3', kp.dis.x - s * 0.1, top + 0.003, zm, Z0); b.box(0.12, 0.004, 1.4, o.renk, kp.dis.x - s * 0.1, top + 0.011, zm, Z0); }
  for (const e of o.esya) esyaCiz(k, o, e);
}
function shadeHex(c: string, kk: number): string { const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + kk)))); return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => f(v).toString(16).padStart(2, '0')).join(''); }
void ahsap; void yesilMavi;

export function createHastaneIc(d: HastaneIcDeps): HastaneIcView {
  let v: ReturnType<typeof insa> | null = null, ac = 0;
  const asAc = new Map<string, number>();
  return {
    update(dt) {
      const sahne = d.root(); if (!sahne) return;
      const hp = d.hero(), icerde = hstIcinde(hp, 8);
      if (!icerde) { if (v) v.g.visible = false; return; }
      if (!v) v = insa();
      if (v.g.parent !== sahne) sahne.add(v.g);
      v.g.visible = true;
      const kat = hp.kat || 0; v.katlar.forEach((g, k) => { g.visible = k <= kat; });
      for (const c of v.kesit) c.g.visible = !(c.kat === kat && hp.z > c.zw + 0.15 && hp.x > c.x0 - 1.2 && hp.x < c.x1 + 1.2);
      for (const h of v.odaHol) h.g.visible = !(h.o.kat === kat && hp.x > h.o.x0 && hp.x < h.o.x1 && hp.z > h.o.z0 && hp.z < h.o.z1);
      const yakin = kat === 0 && Math.abs(hp.x - HST.cx) < 2.6 && hp.z < HST.z0 + 2.4;
      ac += ((yakin ? 1 : 0) - ac) * Math.min(1, dt * 5);
      for (const m of v.kapi) m.position.x = HST.cx + m.userData.sx * ((GIRIS_KAPI.x1 - GIRIS_KAPI.x0) / 4 + ac * 1.25);
      for (const a of v.asansor) {   // kabin kapıları: kahraman o katta önündeyse açılır (yumuşak, ani değil)
        const key = a.kat + ':' + a.x, on = a.kat === kat && Math.abs(hp.x - a.x) < 0.9 && hp.z > HST.z1 - 1.6;
        const t = (asAc.get(key) || 0) + ((on ? 1 : 0) - (asAc.get(key) || 0)) * Math.min(1, dt * 4); asAc.set(key, t);
        a.m.position.x = a.x + a.s * (0.3 + t * 0.55);
      }
    },
  };
}
