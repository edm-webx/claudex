/**
 * 2026-11-25 sahip: "tepsiye gelen ürünlerin resimleri hep aynı düz yuvarlak bişey; üretilen her ürünün kendine has görseli
 * olmak zorunda". Her yiyecek / içecek / dükkân ürünü için ayrı, tanınır prosedürel model (döner, çay, büfe ürünleri hariç:
 * onların kademeli modeli iskele/props.ts itemInto'da).
 *
 * Kimlikler: mutfak yemekleri (yemek-menu.ts DISHES) ve karşı yaka / AVM menü kalemleri (isletme-istasyon.ts KALEM) aynı ad
 * uzayında; aynı ad = aynı yemek. Her model tek bir birleşik geometri (Batch: köşe rengi + atlas beyazı, MAT.atlas ile tek
 * çizim çağrısı), kimliğe göre önbellekli. Ortak kalıplar (tabak, kâse, sahan, bardak, şişe, külah, kutu) + ürüne özgü içerik
 * ve süs, böylece her ürün şekil + renk + ayırt edici detayla tanınır. Rastgelelik yok (dağılım kimliğin hash'inden).
 * Ölçü: metre; tabak yarıçapı ~0.12, bardak ~0.15 boy. Döndürülen değer modelin üst yüksekliği (taşıma yığını için).
 */
import * as T from 'three';
import { Batch, geoc, HP, PI, TAU } from '../../../engine/prefab/batch';
import { ensureKit } from '../common/v2kit';

type B = Batch;
type Rng = () => number;
type Tarif = (b: B, r: Rng) => number;

function rngOf(id: string): Rng {
  let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return () => { h = (h + 0x6d2b79f5) | 0; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- palet ----------
const P = {
  tabak: '#fbfaf6', tabakAlt: '#e6e1d6', cini: '#2f6fb0', bakir: '#c8743a', bakirKoyu: '#8f4a22', dokme: '#2e2a28', toprak: '#b8623a', ahsap: '#b98a5e', ahsapKoyu: '#7d5638',
  arduaz: '#3a3d42', cam: '#d8eef4', kagit: '#f4efe4', kraft: '#c9a06a', folyo: '#d7dde2',
  et: '#8a4a26', etKoyu: '#5e2f17', tavuk: '#dca46a', kofte: '#7a3e22', ekmek: '#e3b06a', kabuk: '#c98a4a', lavas: '#f1dcae', pilav: '#f7f3e6', yogurt: '#fbfaf2',
  domatesSos: '#c8371f', tereyag: '#d24a1c', domates: '#e0533c', marul: '#7cbf4a', maydanoz: '#4f9a35', biber: '#5aa33f', sogan: '#f3eadf', morSogan: '#a0567a', limon: '#f6d743',
  patates: '#f2c443', kasar: '#f5c542', yumurta: '#fbf8ee', sari: '#f6b81f', sucuk: '#9e2a1e', zeytin: '#2b2b2b', yesilZeytin: '#8a9a3a',
  cikolata: '#4a2716', fistik: '#7fae3f', kaymak: '#fbf6e6', serbet: '#e0a33a', altin: '#d99a3a',
  balik: '#b8c4cc', balikKarin: '#eef2f3', balikSirt: '#5b6b78', kizarmis: '#d9963a', ahtapot: '#a8566e', somon: '#f08a5d', nori: '#1f2a22',
  cay: '#b5361e', kahve: '#4a2a16', kopuk: '#c8a27a', sut: '#f6efe2', cilek: '#e0435a', muz: '#f5e08a', kiraz: '#b0182e', nane: '#5fb04a',
};

// ---------- ortak kaplar ----------
/** düz servis tabağı; yemek y = 0.016'dan başlar */
function tabak(b: B, r = 0.12, c = P.tabak, serit?: string): number {
  b.lathe([[0, 0], [r * 0.64, 0], [r * 0.82, 0.012], [r, 0.025], [r * 0.82, 0.017], [0, 0.015]], c, 0, 0, 0, { seg: 14 });
  if (serit) b.tor(r * 0.9, 0.0035, serit, 0, 0.0225, 0, { rx: HP, rs: 3, ts: 18 });
  return 0.016;
}
/** oval tabak (iskender, balık, kebap) */
function oval(b: B, rx = 0.15, rz = 0.1, c = P.tabak, serit?: string): number {
  b.push(new T.Matrix4().makeScale(1, 1, rz / rx)); tabak(b, rx, c, serit); b.pop(); return 0.016;
}
/** kâse; içi dolgu rengiyle (h: boy), dolgu yüzeyi y döner */
function kase(b: B, r = 0.075, h = 0.06, c = P.tabak, dolgu?: string, doluluk = 0.82): number {
  b.lathe([[0, 0], [r * 0.5, 0], [r * 0.85, h * 0.45], [r, h], [r * 0.86, h * 0.95], [0, h * 0.14]], c, 0, 0, 0, { seg: 12 });
  const y = h * doluluk; if (dolgu) b.cyl(r * (0.82 + 0.1 * doluluk), r * 0.8, 0.006, dolgu, 0, y - 0.003, 0, { seg: 12 });
  return y;
}
/** bakır / döküm sahan, iki kulplu */
function sahan(b: B, r = 0.085, c = P.bakir): number {
  b.lathe([[0, 0], [r * 0.85, 0], [r, 0.03], [r * 0.93, 0.03], [r * 0.8, 0.008], [0, 0.008]], c, 0, 0, 0, { seg: 12 });
  for (const s of [-1, 1]) b.tor(0.018, 0.005, c === P.bakir ? P.bakirKoyu : c, s * (r + 0.012), 0.024, 0, { rs: 4, ts: 8, rx: HP });
  return 0.012;
}
function tahta(b: B, w = 0.26, d = 0.15, c = P.ahsap): number { b.box(w, 0.018, d, c, 0, 0.009, 0, { r: 0.006 }); b.box(0.05, 0.016, 0.03, c, w / 2 + 0.022, 0.008, 0, { r: 0.008 }); return 0.018; }
function arduaz(b: B, w = 0.3, d = 0.12): number { b.box(w, 0.012, d, P.arduaz, 0, 0.006, 0, { r: 0.003 }); return 0.012; }
function tepsiK(b: B, w = 0.3, d = 0.2, c = '#8a6a44'): number { b.box(w, 0.016, d, c, 0, 0.008, 0, { r: 0.006 }); b.box(w, 0.018, 0.012, c, 0, 0.02, d / 2 - 0.006, { r: 0.004 }); b.box(w, 0.018, 0.012, c, 0, 0.02, -d / 2 + 0.006, { r: 0.004 }); return 0.016; }
/** ince belli çay bardağı + tabağı */
function ceyBardak(b: B, cay = P.cay, tabakC = P.tabak, x = 0, z = 0, s = 1): number {
  b.cyl(0.062 * s, 0.052 * s, 0.012, tabakC, x, 0.006, z, { seg: 14 });
  b.lathe([[0, 0], [0.024 * s, 0], [0.028 * s, 0.012 * s], [0.022 * s, 0.04 * s], [0.02 * s, 0.055 * s], [0.028 * s, 0.088 * s], [0.033 * s, 0.12 * s], [0, 0.12 * s]], cay, x, 0.012, z, { seg: 12 });
  b.cyl(0.034 * s, 0.0335 * s, 0.02 * s, P.cam, x, 0.012 + 0.128 * s, z, { seg: 12, open: true });
  b.box(0.018, 0.015, 0.018, '#ffffff', x + 0.045 * s, 0.02, z + 0.02, { r: 0.003 });
  return 0.012 + 0.14 * s;
}
/** kulplu fincan + tabağı (kahve) */
function fincan(b: B, ust = P.kopuk, kup = '#ffffff', serit?: string): number {
  b.cyl(0.07, 0.058, 0.012, kup, 0, 0.006, 0, { seg: 12 });
  b.lathe([[0, 0], [0.026, 0], [0.034, 0.02], [0.038, 0.055], [0, 0.055]], kup, 0, 0.012, 0, { seg: 14 });
  b.cyl(0.035, 0.035, 0.004, ust, 0, 0.064, 0, { seg: 14 });
  if (serit) b.cyl(0.0385, 0.037, 0.01, serit, 0, 0.055, 0, { seg: 14, open: true });
  b.tor(0.014, 0.004, kup, 0.043, 0.042, 0, { rs: 4, ts: 10 });
  return 0.07;
}
/** uzun bardak: sıvı gövde + cam ağız + cam taban */
function uzunBardak(b: B, sivi: string, h = 0.15, r = 0.042): number {
  b.cyl(r * 0.9, r * 0.9, 0.012, P.cam, 0, 0.006, 0, { seg: 14 });
  b.cyl(r, r * 0.88, h - 0.03, sivi, 0, 0.012 + (h - 0.03) / 2, 0, { seg: 14 });
  b.cyl(r + 0.002, r, 0.03, P.cam, 0, h - 0.015, 0, { seg: 14, open: true });
  return h;
}
function pipet(b: B, c: string, x: number, y: number, z: number, l = 0.12, rz = 0.22): void { b.cyl(0.0045, 0.0045, l, c, x, y, z, { seg: 5, rz }); }
/** karton bardak + kapak + kılıf */
function kartonBardak(b: B, govde: string, kapak: string, kilif: string, h = 0.14): number {
  b.cyl(0.046, 0.034, h, govde, 0, h / 2, 0, { seg: 14 });
  b.cyl(0.0465, 0.04, h * 0.36, kilif, 0, h * 0.55, 0, { seg: 14, open: true });
  b.cyl(0.049, 0.049, 0.012, kapak, 0, h + 0.006, 0, { seg: 14 });
  b.cyl(0.038, 0.044, 0.014, kapak, 0, h + 0.018, 0, { seg: 14 });
  return h + 0.025;
}
/** şeffaf plastik bardak (soğuk içecek), kubbe kapaklı olabilir */
function plastikBardak(b: B, sivi: string, h = 0.14, kubbe = false, krem?: string): number {
  b.cyl(0.046, 0.033, h, sivi, 0, h / 2, 0, { seg: 14 });
  b.cyl(0.0475, 0.046, 0.012, P.cam, 0, h - 0.004, 0, { seg: 14, open: true });
  let top = h;
  if (krem) { b.sph(0.042, krem, 0, h, 0, { ws: 10, hs: 6, tl: HP, sy: 0.9 }); b.sph(0.02, krem, 0, h + 0.035, 0, { ws: 8, hs: 5 }); top = h + 0.05; }
  if (kubbe) { b.sph(0.048, P.cam, 0, h, 0, { ws: 10, hs: 5, tl: HP, sy: 0.8 }); top = h + 0.04; }
  return top;
}
/** cam / plastik şişe: gövde, etiket, boyun, kapak */
function sise(b: B, cam: string, etiket: string, kapak: string, o: { h?: number; r?: number; kontur?: boolean } = {}): number {
  const h = o.h ?? 0.2, r = o.r ?? 0.034;
  if (o.kontur) b.lathe([[0, 0], [r, 0], [r * 1.05, h * 0.12], [r * 0.82, h * 0.32], [r * 1.02, h * 0.52], [r * 0.95, h * 0.62], [r * 0.45, h * 0.84], [r * 0.4, h], [0, h]], cam, 0, 0, 0, { seg: 12 });
  else b.lathe([[0, 0], [r, 0], [r * 1.04, h * 0.05], [r * 1.04, h * 0.58], [r * 0.6, h * 0.76], [r * 0.42, h * 0.86], [r * 0.4, h], [0, h]], cam, 0, 0, 0, { seg: 12 });
  b.cyl(r * 1.06, r * 1.06, h * 0.22, etiket, 0, h * (o.kontur ? 0.45 : 0.33), 0, { seg: 12, open: true });
  b.cyl(r * 0.46, r * 0.46, h * 0.06, kapak, 0, h + h * 0.02, 0, { seg: 10 });
  return h * 1.06;
}
function teneke(b: B, govde: string, serit: string, h = 0.13, r = 0.032): number {
  b.cyl(r, r, h, govde, 0, h / 2, 0, { seg: 14 }); b.cyl(r * 1.01, r * 1.01, h * 0.25, serit, 0, h * 0.5, 0, { seg: 14, open: true });
  b.cyl(r * 0.88, r, 0.01, '#cfd5da', 0, h + 0.005, 0, { seg: 14 }); return h + 0.01;
}
/** kağıt külah (çerez, patates, dondurma kâğıdı) */
function kulah(b: B, c = P.kagit, h = 0.13, r = 0.05, serit?: string): number {
  b.cone(r, h, c, 0, h / 2, 0, { seg: 12, rx: PI });
  if (serit) b.cyl(r * 0.985, r * 0.86, h * 0.18, serit, 0, h * 0.86, 0, { seg: 12, open: true });
  return h;
}
/** küçük yığın: n tane minik parça, verilen alan ve renklerle (çerez, şeker, patates) */
function yigin(b: B, r: Rng, n: number, rad: number, y0: number, renk: string[], fn: (x: number, y: number, z: number, c: string, i: number) => void, tepe = 0.03): void {
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.sqrt(r()) * rad, k = 1 - d / rad; fn(Math.cos(a) * d, y0 + k * tepe + r() * 0.006, Math.sin(a) * d, renk[i % renk.length], i); }
}
/** dükkân poşeti (kâğıt, saplı) */
function poset(b: B, c: string, w = 0.16, h = 0.18, logo = '#ffffff'): number {
  b.box(w, h, 0.07, c, 0, h / 2, 0, { r: 0.006 }); b.tor(0.035, 0.005, P.kraft, 0, h + 0.002, 0, { arc: PI, rs: 4, ts: 10 });
  b.cyl(0.028, 0.028, 0.004, logo, 0, h * 0.55, 0.036, { rx: HP, seg: 12 }); return h + 0.04;
}
function kutuK(b: B, w: number, h: number, d: number, c: string, kapak?: string, kurdele?: string): number {
  b.box(w, h, d, c, 0, h / 2, 0, { r: 0.006 });
  if (kapak) b.box(w + 0.006, h * 0.28, d + 0.006, kapak, 0, h - h * 0.14, 0, { r: 0.006 });
  if (kurdele) { b.box(w + 0.008, h + 0.004, 0.014, kurdele, 0, h / 2, 0, { r: 0 }); b.box(0.014, h + 0.004, d + 0.008, kurdele, 0, h / 2, 0, { r: 0 }); b.tor(0.016, 0.006, kurdele, -0.012, h + 0.008, 0, { rs: 4, ts: 8, rz: 0.6 }); b.tor(0.016, 0.006, kurdele, 0.012, h + 0.008, 0, { rs: 4, ts: 8, rz: -0.6 }); }
  return h;
}

// ---------- süsler ----------
const limonD = (b: B, x: number, y: number, z: number, ry = 0) => { b.sph(0.022, P.limon, x, y + 0.008, z, { ws: 8, hs: 4, tl: HP, sx: 1.5, sy: 0.8, sz: 0.7, ry }); };
const limonH = (b: B, x: number, y: number, z: number, rz = 0) => { b.cyl(0.024, 0.024, 0.006, P.limon, x, y, z, { seg: 10, rx: HP, rz }); b.cyl(0.019, 0.019, 0.0065, '#fbf3b8', x, y, z, { seg: 10, rx: HP, rz }); };
const maydanoz = (b: B, x: number, y: number, z: number, s = 1) => { for (let i = 0; i < 4; i++) b.sph(0.011 * s, i % 2 ? P.maydanoz : '#6cb84a', x + Math.cos(i * 1.7) * 0.012 * s, y + 0.006 + (i % 2) * 0.004, z + Math.sin(i * 1.7) * 0.012 * s, { ws: 5, hs: 4 }); };
const domatesD = (b: B, x: number, y: number, z: number, r = 0.022) => { b.cyl(r, r, 0.007, P.domates, x, y + 0.0035, z, { seg: 10 }); b.cyl(r * 0.7, r * 0.7, 0.0075, '#f08a7a', x, y + 0.0036, z, { seg: 8 }); };
const kozBiber = (b: B, x: number, y: number, z: number, ry = 0, c = P.biber) => { b.cap(0.011, 0.07, c, x, y + 0.011, z, { rz: HP, ry, sy: 1 }); b.cyl(0.003, 0.003, 0.02, '#3d6e2a', x + Math.cos(ry) * 0.05, y + 0.012, z - Math.sin(ry) * 0.05, { rz: HP, ry, seg: 4 }); };
const kozDomates = (b: B, x: number, y: number, z: number) => { b.sph(0.022, '#c8371f', x, y + 0.016, z, { ws: 8, hs: 6, sy: 0.8 }); b.sph(0.006, '#3d6e2a', x, y + 0.033, z, { ws: 4, hs: 3 }); };
const sogan = (b: B, x: number, y: number, z: number, c = P.morSogan) => { b.tor(0.018, 0.004, c, x, y + 0.004, z, { rx: HP, rs: 3, ts: 10 }); b.tor(0.012, 0.004, c, x + 0.01, y + 0.008, z + 0.006, { rx: HP, rs: 3, ts: 8 }); };
const kasik = (b: B, x: number, y: number, z: number, ry = 0) => { b.box(0.11, 0.004, 0.012, '#c9ced6', x, y, z, { r: 0, ry }); b.sph(0.016, '#c9ced6', x + Math.cos(ry) * 0.06, y, z - Math.sin(ry) * 0.06, { ws: 6, hs: 3, sy: 0.3, sx: 1.4, ry }); };
const catal = (b: B, x: number, y: number, z: number, ry = 0) => { b.box(0.12, 0.004, 0.012, '#c9ced6', x, y, z, { r: 0, ry }); };
const top = (b: B, c: string, x: number, y: number, z: number, r = 0.03) => { b.sph(r, c, x, y + r * 0.7, z, { ws: 8, hs: 6 }); b.tor(r * 0.92, r * 0.18, c, x, y + r * 0.35, z, { rx: HP, rs: 4, ts: 12 }); };
/** yatay şiş + parçalar */
function sis(b: B, x: number, y: number, z: number, renk: string[], n = 5, ry = 0, L = 0.2): void {
  b.cyl(0.003, 0.003, L + 0.06, '#c9ced6', x, y + 0.015, z, { rz: HP, ry, seg: 4 });
  const c = Math.cos(ry), s = Math.sin(ry);
  for (let i = 0; i < n; i++) { const t = (i / (n - 1) - 0.5) * L; b.box(0.026, 0.024, 0.026, renk[i % renk.length], x + c * t, y + 0.016, z - s * t, { r: 0.008, ry: ry + i * 0.4 }); }
}
/** bütün balık (yan yatmış): gövde + kuyruk + baş + göz + ızgara izi */
function balikB(b: B, x: number, y: number, z: number, L = 0.2, ry = 0, sirt = P.balikSirt, govde = P.balik, izgara = true): void {
  b.push(new T.Matrix4().makeRotationY(ry).setPosition(x, y, z));
  b.sph(L * 0.5, govde, 0, L * 0.11, 0, { ws: 10, hs: 6, sx: 1, sy: 0.28, sz: 0.4 });
  b.sph(L * 0.48, sirt, 0, L * 0.15, -L * 0.03, { ws: 10, hs: 6, tl: HP * 0.8, sx: 1, sy: 0.2, sz: 0.3 });
  b.cone(L * 0.13, L * 0.22, sirt, -L * 0.56, L * 0.11, 0, { rz: HP, seg: 6, sz: 0.25 });
  b.sph(0.006, '#1b1b1b', L * 0.38, L * 0.15, L * 0.07, { ws: 5, hs: 4 });
  if (izgara) for (let i = -1; i <= 1; i++) b.box(0.006, 0.004, L * 0.28, '#3a2416', i * L * 0.18, L * 0.24, 0, { r: 0, ry: 0.5 });
  b.pop();
}
/** küçük kızarmış balık (hamsi) */
const hamsi = (b: B, x: number, y: number, z: number, ry: number) => { b.sph(0.038, P.kizarmis, x, y + 0.008, z, { ws: 7, hs: 4, sy: 0.22, sz: 0.24, ry }); b.cone(0.012, 0.018, '#a8642a', x - Math.cos(ry) * 0.042, y + 0.008, z + Math.sin(ry) * 0.042, { rz: HP, ry, seg: 4, sz: 0.3 }); };
/** dürüm (yatay silindir) */
function durumW(b: B, ic: string, kagit = '#ffffff', L = 0.2, r = 0.035, lav = P.lavas): number {
  b.cyl(r, r * 0.95, L, lav, 0, r, 0, { rz: HP, seg: 12 });
  b.cyl(r + 0.004, r + 0.003, L * 0.55, kagit, -L * 0.22, r, 0, { rz: HP, seg: 12 });
  b.cyl(r * 0.84, r * 0.84, 0.012, ic, L / 2 + 0.002, r, 0, { rz: HP, seg: 10 });
  b.sph(0.01, P.domates, L / 2 + 0.006, r + 0.012, 0.01, { ws: 5, hs: 4 }); b.sph(0.01, P.marul, L / 2 + 0.006, r - 0.01, -0.012, { ws: 5, hs: 4 });
  return r * 2;
}
/** yarım ekmek arası (balık ekmek, köfte ekmek, yarım ekmek döner) */
function ekmekArasi(b: B, ic: string, icSekil: 'fileto' | 'kofte' | 'doner' | 'kofteYuvarlak', L = 0.18): number {
  b.cap(0.032, L - 0.06, P.ekmek, 0, 0.026, -0.014, { rz: HP, sy: 1, sz: 0.8 });
  b.cap(0.03, L - 0.07, P.kabuk, 0, 0.05, -0.04, { rz: HP, sz: 0.6, rx: -1.0 });
  b.box(L * 0.85, 0.008, 0.055, P.marul, 0, 0.05, 0.004, { r: 0.004, rx: -0.15 });
  if (icSekil === 'fileto') { b.box(L * 0.8, 0.018, 0.042, ic, 0, 0.062, 0.004, { r: 0.008 }); b.box(L * 0.7, 0.003, 0.01, '#a8642a', 0, 0.072, 0.004, { r: 0, ry: 0.05 }); }
  else if (icSekil === 'doner') for (let i = 0; i < 5; i++) b.box(0.04, 0.014, 0.04, i % 2 ? ic : P.etKoyu, -L * 0.3 + i * L * 0.15, 0.062, 0.004, { r: 0.004, rz: 0.2 * (i % 2 ? 1 : -1) });
  else for (let i = 0; i < 3; i++) b.cap(0.014, 0.03, ic, -0.05 + i * 0.05, 0.066, 0.004, { rx: HP });
  sogan(b, 0.03, 0.074, 0.016); domatesD(b, -0.04, 0.076, 0.014, 0.016);
  return 0.075;
}

// ---------- tarifler ----------
const TARIF: Record<string, Tarif> = {};
const def = (ids: string[], f: Tarif) => { for (const id of ids) TARIF[id] = f; };

// --- sıcak içecekler
def(['demlik_cay'], b => ceyBardak(b, '#a8240f', '#bfe3f0'));
def(['cay_t'], b => ceyBardak(b, P.cay, '#e0533c'));
def(['turk_kahvesi'], b => { const h = fincan(b, P.kopuk); b.box(0.022, 0.018, 0.022, '#f2a2b3', 0.05, 0.021, 0.03, { r: 0.004 }); return h; });
def(['dibek'], b => { const h = fincan(b, '#b48a62', '#fbfaf6', P.cini); b.box(0.022, 0.018, 0.022, '#9ccf6a', 0.05, 0.021, 0.03, { r: 0.004 }); return h; });
def(['menengic'], (b, r) => { const h = fincan(b, '#d8b98a', '#f3e6cc', '#7fae3f'); yigin(b, r, 6, 0.024, 0.067, [P.fistik], (x, y, z, c) => b.sph(0.004, c, x, y, z, { ws: 4, hs: 3 }), 0); return h; });
def(['kumda_kahve'], b => { b.cyl(0.07, 0.06, 0.012, '#e9d9b0', 0, 0.006, 0, { seg: 14 }); b.lathe([[0, 0], [0.03, 0], [0.026, 0.04], [0.032, 0.07], [0, 0.07]], P.bakir, 0, 0.012, 0, { seg: 12 }); b.cyl(0.03, 0.03, 0.004, P.kopuk, 0, 0.078, 0, { seg: 12 }); b.box(0.12, 0.008, 0.012, P.ahsapKoyu, 0.085, 0.065, 0, { r: 0.003, rz: 0.35 }); return 0.09; });
def(['kahve_fal'], b => { b.cyl(0.07, 0.058, 0.012, '#ffffff', 0, 0.006, 0, { seg: 12 }); b.lathe([[0, 0], [0.038, 0], [0.034, 0.035], [0.026, 0.055], [0, 0.055]], '#ffffff', 0, 0.012, 0, { seg: 14 }); b.cyl(0.026, 0.026, 0.004, '#2a1a10', 0, 0.069, 0, { seg: 12 }); b.cyl(0.012, 0.012, 0.003, P.altin, 0.05, 0.014, 0.025, { seg: 8 }); return 0.07; });
def(['filtre'], b => kartonBardak(b, '#fbfaf6', '#2a2624', '#a8794e'));
def(['marti_latte'], b => { const h = kartonBardak(b, '#ffffff', '#ffffff', '#3f8fc9', 0.16); b.box(0.03, 0.006, 0.01, '#ffffff', -0.012, 0.09, 0.047, { r: 0, rz: 0.4 }); b.box(0.03, 0.006, 0.01, '#ffffff', 0.012, 0.09, 0.047, { r: 0, rz: -0.4 }); return h; });
def(['latte'], b => { b.cyl(0.038, 0.038, 0.01, P.cam, 0, 0.005, 0, { seg: 14 }); b.cyl(0.04, 0.036, 0.05, '#8a5530', 0, 0.035, 0, { seg: 14 }); b.cyl(0.042, 0.04, 0.06, '#e6cfae', 0, 0.09, 0, { seg: 14 }); b.cyl(0.042, 0.042, 0.012, '#fbf4e8', 0, 0.126, 0, { seg: 14 }); b.cyl(0.043, 0.042, 0.02, P.cam, 0, 0.14, 0, { seg: 14, open: true }); return 0.15; });
def(['flat_white'], b => { b.cyl(0.072, 0.06, 0.01, '#3a3d42', 0, 0.005, 0, { seg: 12 }); b.lathe([[0, 0], [0.03, 0], [0.046, 0.04], [0.048, 0.05], [0, 0.05]], '#3a3d42', 0, 0.01, 0, { seg: 14 }); b.cyl(0.044, 0.044, 0.004, '#a8703e', 0, 0.058, 0, { seg: 14 }); b.cyl(0.02, 0.014, 0.0045, '#fbf4e8', 0, 0.0585, 0.004, { seg: 10 }); b.sph(0.01, '#fbf4e8', 0, 0.057, -0.012, { ws: 6, hs: 3, sy: 0.25 }); return 0.065; });
// --- soğuk içecekler
def(['soguk_demleme'], (b, r) => { const h = plastikBardak(b, '#3a2416', 0.14); yigin(b, r, 3, 0.02, h - 0.012, ['#e6f6ff'], (x, y, z, c) => b.box(0.02, 0.02, 0.02, c, x, y, z, { r: 0.004, ry: x * 40 }), 0); pipet(b, '#2f9e5a', 0.012, h + 0.02, 0, 0.12); return h + 0.06; });
def(['frappe'], b => { const h = plastikBardak(b, '#c49a6c', 0.13, false, '#fbf6ee'); b.tor(0.03, 0.004, P.cikolata, 0, 0.145, 0, { rx: HP, rs: 3, ts: 12 }); pipet(b, '#3a2416', 0.01, h + 0.02, 0, 0.12); return h + 0.06; });
def(['limonata', 'limonata_k'], b => { const h = uzunBardak(b, '#f2e050', 0.15); limonH(b, 0.036, h - 0.008, 0, 0.3); b.sph(0.011, P.nane, -0.015, h, 0.01, { ws: 5, hs: 4, sy: 0.5 }); b.sph(0.009, '#79c25a', -0.005, h + 0.004, -0.012, { ws: 5, hs: 4, sy: 0.5 }); pipet(b, '#e0533c', -0.01, h + 0.03, 0.01, 0.13); return h + 0.06; });
def(['slush'], b => { const h = plastikBardak(b, '#e0436b', 0.13, true); b.cyl(0.045, 0.045, 0.02, '#ff7ea0', 0, 0.12, 0, { seg: 14 }); pipet(b, '#fbfaf6', 0.008, h + 0.04, 0, 0.14, 0.1); b.cyl(0.0048, 0.0048, 0.03, '#e0533c', 0.012, h + 0.08, 0, { seg: 5, rz: 0.1 }); return h + 0.1; });
def(['salgam'], b => { const h = uzunBardak(b, '#7a1f3d', 0.15, 0.04); b.cap(0.007, 0.1, '#f08a3c', 0.012, h, 0.004, { rz: 0.25 }); return h + 0.05; });
def(['cikolatali_sut'], b => { b.box(0.06, 0.1, 0.045, '#6b3a1e', 0, 0.05, 0, { r: 0.004 }); b.box(0.061, 0.03, 0.046, '#f6efe2', 0, 0.06, 0, { r: 0.002 }); b.box(0.04, 0.024, 0.045, '#6b3a1e', 0, 0.112, 0, { r: 0.002, rx: 0 }); pipet(b, '#f2c230', 0.016, 0.15, 0, 0.08, 0.2); return 0.17; });
def(['ayran_d'], (b, r) => { b.lathe([[0, 0], [0.04, 0], [0.06, 0.025], [0.065, 0.06], [0.06, 0.06], [0.05, 0.03], [0, 0.03]], P.bakir, 0, 0, 0, { seg: 14 }); b.cyl(0.058, 0.058, 0.006, '#fbfbf7', 0, 0.055, 0, { seg: 14 }); yigin(b, r, 6, 0.04, 0.06, ['#ffffff'], (x, y, z, c) => b.sph(0.016, c, x, y, z, { ws: 8, hs: 5 }), 0.012); b.tor(0.012, 0.004, P.bakirKoyu, 0.068, 0.04, 0, { rs: 3, ts: 8 }); return 0.09; });
def(['ayran'], b => { b.cyl(0.046, 0.038, 0.11, '#ffffff', 0, 0.055, 0, { seg: 14 }); b.cyl(0.0465, 0.042, 0.045, '#2f6fb0', 0, 0.065, 0, { seg: 14, open: true }); b.cyl(0.05, 0.05, 0.008, '#c8d8ec', 0, 0.112, 0, { seg: 14 }); b.box(0.016, 0.004, 0.024, '#c8d8ec', 0.05, 0.11, 0, { r: 0 }); return 0.12; });
def(['d_ayran'], b => sise(b, '#fbfdff', '#2f6fb0', '#2f6fb0', { h: 0.17, r: 0.032 }));
def(['kola', 'kolaz', 'd_kolaz'], b => sise(b, '#3a1610', '#e0533c', '#c23e2c', { h: 0.2, r: 0.032, kontur: true }));
def(['soda', 'd_soda'], b => sise(b, '#9fd6b8', '#3fb5b0', '#c9ced6', { h: 0.15, r: 0.03 }));
def(['gazoz', 'd_gazoz', 'gazoz_t'], b => sise(b, '#a8d8b0', '#f08a3c', '#e0533c', { h: 0.2, r: 0.033 }));
def(['gazoz_cesit'], b => { tepsiK(b, 0.24, 0.1); const cs: [string, string][] = [['#f08a3c', '#e0533c'], ['#f2e050', '#3fae6a'], ['#e0436b', '#ffd23f']]; cs.forEach(([e, k], i) => { b.push(new T.Matrix4().makeTranslation((i - 1) * 0.075, 0.016, 0).multiply(new T.Matrix4().makeScale(0.8, 0.8, 0.8))); sise(b, '#a8d8b0', e, k, { h: 0.2, r: 0.033 }); b.pop(); }); return 0.19; });
def(['d_su'], b => { b.lathe([[0, 0], [0.03, 0], [0.032, 0.02], [0.03, 0.03], [0.032, 0.05], [0.03, 0.06], [0.032, 0.12], [0.02, 0.15], [0.013, 0.165], [0, 0.165]], '#cfeaf7', 0, 0, 0, { seg: 12 }); b.cyl(0.0325, 0.0325, 0.035, '#3f8fc9', 0, 0.09, 0, { seg: 12, open: true }); b.cyl(0.014, 0.014, 0.016, '#1d5fa8', 0, 0.172, 0, { seg: 10 }); return 0.18; });
def(['enerji'], b => teneke(b, '#2a2624', '#f2d24a', 0.15, 0.028));
def(['protein'], b => { b.box(0.15, 0.022, 0.05, '#2a2d33', 0, 0.011, 0, { r: 0.008 }); b.box(0.09, 0.023, 0.051, '#f08a3c', 0, 0.011, 0, { r: 0.002 }); for (const s of [-1, 1]) b.box(0.012, 0.016, 0.052, '#1d1d22', s * 0.078, 0.011, 0, { r: 0.002 }); b.box(0.05, 0.002, 0.03, '#fbfaf6', 0, 0.0235, 0, { r: 0 }); return 0.03; });

// --- kahvaltı / hamur
def(['gozleme'], b => { const y = tahta(b, 0.26, 0.16); for (const s of [-1, 1]) { b.push(new T.Matrix4().makeRotationY(s * 0.15).setPosition(s * 0.055, y, 0)); b.box(0.1, 0.022, 0.12, '#ecd09a', 0, 0.011, 0, { r: 0.009 }); for (let i = 0; i < 4; i++) b.sph(0.008, '#b0763a', -0.03 + (i % 2) * 0.05, 0.022, -0.035 + i * 0.022, { ws: 5, hs: 3, sy: 0.3 }); b.box(0.09, 0.008, 0.006, '#4f8a35', 0, 0.012, 0.061, { r: 0 }); b.pop(); } limonD(b, 0, y, 0.07); return 0.05; });
def(['serpme_kahvalti', 'serpme'], b => { const y = tahta(b, 0.3, 0.22); const k = (x: number, z: number, c: string, fn?: (y: number) => void) => { b.push(new T.Matrix4().makeTranslation(x, y, z)); const yy = kase(b, 0.035, 0.03, P.tabak, c); fn?.(yy); b.pop(); };
  k(-0.09, -0.06, '#2b2b2b', yy => { for (let i = 0; i < 4; i++) b.sph(0.009, P.zeytin, -0.09 + (i % 2) * 0.014 - 0.007, y + yy + 0.006, -0.06 + (i > 1 ? 0.01 : -0.006), { ws: 5, hs: 4 }); });
  k(0, -0.06, '#e8a224'); k(0.09, -0.06, '#c0182e'); k(-0.09, 0.05, P.yesilZeytin);
  b.box(0.06, 0.03, 0.045, '#fbfaf2', 0.0, y + 0.015, 0.05, { r: 0.006 }); b.box(0.05, 0.022, 0.04, '#f5c542', 0.0, y + 0.041, 0.05, { r: 0.004 });
  for (let i = 0; i < 3; i++) domatesD(b, 0.075 + i * 0.012, y + i * 0.004, 0.05 + i * 0.008, 0.02);
  for (let i = 0; i < 2; i++) { b.sph(0.016, P.yumurta, -0.05 + i * 0.035, y + 0.006, 0.08, { ws: 8, hs: 4, tl: HP, sy: 0.7 }); b.sph(0.008, P.sari, -0.05 + i * 0.035, y + 0.012, 0.08, { ws: 6, hs: 4 }); }
  return 0.06; });
def(['menemen'], (b, r) => { const y = sahan(b, 0.08, P.dokme); b.cyl(0.07, 0.07, 0.012, '#d9482b', 0, y + 0.004, 0, { seg: 12 }); yigin(b, r, 7, 0.055, y + 0.012, ['#f6b81f', '#f2c94c', '#e8682b'], (x, yy, z, c) => b.sph(0.014, c, x, yy, z, { ws: 6, hs: 4, sy: 0.5 }), 0.003); kozBiber(b, 0.01, y + 0.01, -0.02, 0.6); maydanoz(b, -0.03, y + 0.014, 0.02, 0.8); return 0.05; });
def(['sucuklu_yumurta'], b => { const y = sahan(b, 0.085); for (const [x, z] of [[-0.028, 0], [0.03, 0.006]]) { b.cyl(0.032, 0.034, 0.006, P.yumurta, x, y + 0.003, z, { seg: 12 }); b.sph(0.013, P.sari, x, y + 0.007, z, { ws: 8, hs: 5, sy: 0.7 }); } for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; b.cyl(0.013, 0.013, 0.008, P.sucuk, Math.cos(a) * 0.058, y + 0.009, Math.sin(a) * 0.058, { seg: 8 }); } return 0.045; });
def(['mercimek_corbasi', 'mercimek'], (b, r) => { tabak(b, 0.1); b.push(new T.Matrix4().makeTranslation(0, 0.014, 0)); const y = kase(b, 0.07, 0.05, P.tabak, '#e88a2b'); yigin(b, r, 5, 0.035, y + 0.003, [P.tereyag], (x, yy, z, c) => b.sph(0.007, c, x, yy, z, { ws: 5, hs: 3, sy: 0.25 }), 0); b.pop(); limonD(b, 0.075, 0.016, 0.03, 0.8); b.box(0.06, 0.016, 0.04, P.ekmek, -0.07, 0.024, 0.05, { r: 0.008, ry: 0.4 }); return 0.07; });
def(['su_boregi'], b => { const y = tabak(b, 0.1); for (let i = 0; i < 4; i++) b.box(0.1, 0.012, 0.08, i % 2 ? '#f6ecd0' : '#e8c88a', 0, y + 0.006 + i * 0.011, 0, { r: 0.004 }); b.box(0.1, 0.006, 0.08, '#d9a55a', 0, y + 0.047, 0, { r: 0.003 }); maydanoz(b, 0.06, y, 0.05, 0.8); return 0.07; });
const tost = (ara: 'kasar' | 'karisik' | 'sucuk'): Tarif => b => { b.box(0.16, 0.004, 0.14, P.kagit, 0, 0.002, 0, { r: 0 }); for (const s of [-1, 1]) { b.push(new T.Matrix4().makeRotationY(s * 0.2).setPosition(s * 0.04, 0.004, s * 0.01)); b.box(0.09, 0.016, 0.1, '#d39a4e', 0, 0.008, 0, { r: 0.008 }); b.box(0.094, 0.008, 0.104, P.kasar, 0, 0.02, 0, { r: 0.003 });
  if (ara === 'karisik') { b.box(0.096, 0.004, 0.06, P.domates, 0, 0.025, 0.02, { r: 0.002 }); b.box(0.096, 0.004, 0.04, '#6aa84f', 0, 0.025, -0.03, { r: 0.002 }); b.box(0.096, 0.005, 0.1, '#e88a9a', 0, 0.016, 0, { r: 0.002 }); }
  if (ara === 'sucuk') for (const [x, z] of [[0.03, 0.03], [-0.03, -0.02], [0.03, -0.03], [-0.03, 0.03]]) b.cyl(0.014, 0.014, 0.01, P.sucuk, x * 1.1, 0.024, z * 1.1, { seg: 8 });
  b.box(0.09, 0.016, 0.1, '#d39a4e', 0, 0.034, 0, { r: 0.008 }); for (let i = -1; i <= 1; i++) b.box(0.08, 0.002, 0.006, '#7a4a1e', 0, 0.043, i * 0.028, { r: 0, ry: 0.5 }); b.pop(); } return 0.05; };
def(['kasarli_tost'], tost('kasar')); def(['tost_k'], tost('karisik')); def(['tost_t'], tost('sucuk'));
def(['simit_k'], b => { b.box(0.16, 0.003, 0.16, P.kagit, 0, 0.0015, 0, { r: 0 }); b.tor(0.06, 0.022, '#c27a32', 0, 0.024, 0, { rx: HP, rs: 8, ts: 16 }); for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; b.sph(0.004, '#f0d9a0', Math.cos(a) * 0.06, 0.046, Math.sin(a) * 0.06, { ws: 4, hs: 3 }); } return 0.05; });
def(['kek'], b => { b.cyl(0.07, 0.07, 0.003, '#ffffff', 0, 0.0015, 0, { seg: 10 }); b.box(0.09, 0.07, 0.05, '#e0b06a', 0, 0.038, 0, { r: 0.008 }); b.box(0.06, 0.05, 0.052, '#6b3a1e', 0.008, 0.04, 0, { r: 0.006 }); b.box(0.092, 0.012, 0.052, '#4a2716', 0, 0.078, 0, { r: 0.005 }); return 0.085; });
def(['pizza'], b => { b.box(0.17, 0.004, 0.14, P.kagit, 0, 0.002, 0, { r: 0 }); b.cone(0.11, 0.012, '#e8c27a', 0, 0.01, 0, { seg: 3, sx: 0.8, sz: 1.4, ry: HP }); b.cone(0.1, 0.014, '#e0533c', 0, 0.014, 0, { seg: 3, sx: 0.75, sz: 1.35, ry: HP }); b.cone(0.096, 0.015, P.kasar, 0, 0.016, 0, { seg: 3, sx: 0.7, sz: 1.3, ry: HP }); b.cap(0.012, 0.13, '#c98a4a', -0.045, 0.014, 0, { rx: HP }); for (const [x, z] of [[0.0, -0.02], [0.03, 0.025], [-0.015, 0.035], [0.04, -0.03]]) b.cyl(0.011, 0.011, 0.005, '#b0281e', x, 0.024, z, { seg: 8 }); return 0.04; });
def(['waffle'], b => { const y = tabak(b, 0.11); b.cyl(0.075, 0.075, 0.018, '#e2a64a', 0, y + 0.009, 0, { seg: 14 }); for (let i = -2; i <= 2; i++) { b.box(0.14, 0.006, 0.006, '#c8822a', 0, y + 0.02, i * 0.025, { r: 0 }); b.box(0.006, 0.006, 0.14, '#c8822a', i * 0.025, y + 0.02, 0, { r: 0 }); } for (const [x, z] of [[0.02, 0.01], [-0.03, -0.02]]) { b.sph(0.014, P.cilek, x, y + 0.03, z, { ws: 6, hs: 5 }); } for (const [x, z] of [[-0.01, 0.03], [0.035, -0.025]]) b.cyl(0.013, 0.013, 0.006, P.muz, x, y + 0.026, z, { seg: 8 }); b.tor(0.035, 0.0035, P.cikolata, 0, y + 0.024, 0, { rx: HP, rs: 3, ts: 14 }); return 0.06; });
def(['dondurmali_waffle'], b => { const y = tabak(b, 0.11); b.box(0.12, 0.018, 0.08, '#e2a64a', 0, y + 0.009, 0, { r: 0.006 }); for (let i = -2; i <= 2; i++) b.box(0.006, 0.006, 0.08, '#c8822a', i * 0.024, y + 0.02, 0, { r: 0 }); top(b, '#fbf6e6', -0.025, y + 0.018, 0); top(b, '#e8869c', 0.028, y + 0.018, 0.005); b.tor(0.04, 0.0035, P.cikolata, 0, y + 0.05, 0, { rx: HP, rs: 3, ts: 14 }); return 0.09; });
def(['cheesecake'], b => { const y = tabak(b, 0.1); b.cone(0.07, 0.04, '#f6e3b4', 0, y + 0.02, 0, { seg: 3, sx: 0.8, sz: 1.3, ry: HP }); b.cone(0.07, 0.008, '#c98a4a', 0, y + 0.004, 0, { seg: 3, sx: 0.82, sz: 1.32, ry: HP }); b.cone(0.07, 0.01, '#c0182e', 0, y + 0.044, 0, { seg: 3, sx: 0.8, sz: 1.3, ry: HP }); b.sph(0.012, P.cilek, -0.02, y + 0.056, 0, { ws: 6, hs: 5 }); b.sph(0.008, P.nane, -0.008, y + 0.058, 0.008, { ws: 4, hs: 3, sy: 0.5 }); return 0.07; });

// --- izgara / et
def(['iskender', 'dayi_iskender'], (b, r) => { const y = oval(b, 0.15, 0.1, P.tabak, P.cini); for (let i = 0; i < 6; i++) b.box(0.03, 0.016, 0.03, P.ekmek, -0.05 + (i % 3) * 0.035, y + 0.008, -0.02 + Math.floor(i / 3) * 0.035, { r: 0.006, ry: i * 0.5 }); for (let i = 0; i < 7; i++) b.box(0.05, 0.006, 0.035, i % 2 ? P.et : P.etKoyu, -0.045 + (i % 4) * 0.025, y + 0.02 + i * 0.002, -0.015 + Math.floor(i / 4) * 0.03, { r: 0.003, ry: r() * 2, rz: 0.15 }); b.sph(0.05, P.domatesSos, -0.03, y + 0.022, 0, { ws: 10, hs: 4, tl: HP, sx: 1.4, sy: 0.18, sz: 1 }); b.sph(0.03, P.yogurt, 0.075, y + 0.004, 0.02, { ws: 10, hs: 6, tl: HP, sy: 0.7 }); kozBiber(b, 0.07, y, -0.05, 0.3); kozDomates(b, 0.105, y, -0.02); return 0.06; });
def(['adana'], b => { const y = oval(b, 0.16, 0.09); b.box(0.24, 0.004, 0.11, P.lavas, 0, y + 0.002, 0, { r: 0.002 }); b.cap(0.016, 0.2, '#9a3a22', 0, y + 0.018, -0.01, { rz: HP }); b.cyl(0.003, 0.003, 0.28, '#c9ced6', 0.02, y + 0.018, -0.01, { rz: HP, seg: 4 }); b.box(0.035, 0.008, 0.012, '#c9ced6', 0.15, y + 0.018, -0.01, { r: 0.002 }); for (let i = 0; i < 4; i++) b.sph(0.008, '#a8322a', -0.08 + i * 0.05, y + 0.006, 0.035, { ws: 4, hs: 3 }); sogan(b, -0.02, y, 0.04); sogan(b, 0.04, y, 0.04); kozBiber(b, -0.05, y, -0.055, 0.1); kozDomates(b, 0.09, y, 0.04); return 0.05; });
def(['tavuk_sis'], b => { const y = oval(b, 0.15, 0.1); sis(b, 0, y + 0.004, -0.025, [P.tavuk, '#e8b070', '#c98a4a'], 6, 0, 0.18); sis(b, 0, y + 0.004, 0.01, [P.tavuk, '#e8b070', '#c98a4a'], 6, 0, 0.18); b.sph(0.04, P.pilav, -0.06, y, 0.05, { ws: 10, hs: 6, tl: HP, sy: 0.6 }); kozBiber(b, 0.05, y, 0.05, -0.2); return 0.05; });
def(['levrek_sis'], b => { const y = oval(b, 0.15, 0.1); sis(b, 0, y + 0.004, -0.01, [P.balikKarin, '#e0533c', P.balikKarin, P.biber], 6, 0.1, 0.18); limonD(b, 0.08, y, 0.05); maydanoz(b, -0.06, y, 0.05); return 0.05; });
def(['izgara_kofte', 'kofte'], b => { const y = oval(b, 0.15, 0.1); for (let i = 0; i < 5; i++) { b.cap(0.014, 0.04, P.kofte, -0.06 + i * 0.026, y + 0.012, -0.01 + (i % 2) * 0.012, { rx: HP, ry: 0.2 }); b.box(0.004, 0.003, 0.04, '#3a1e10', -0.06 + i * 0.026, y + 0.026, -0.01 + (i % 2) * 0.012, { r: 0, ry: 0.2 }); } b.sph(0.035, '#efe6d4', 0.08, y, 0.035, { ws: 8, hs: 5, tl: HP, sy: 0.5 }); maydanoz(b, 0.08, y + 0.012, 0.035); kozBiber(b, 0.02, y, 0.055, 0.1); kozDomates(b, -0.09, y, 0.045); return 0.05; });
def(['kofte_k', 'kofte_t'], b => { b.box(0.2, 0.004, 0.12, P.kagit, 0, 0.002, 0, { r: 0 }); b.push(new T.Matrix4().makeTranslation(0, 0.004, 0)); ekmekArasi(b, P.kofte, 'kofteYuvarlak'); b.pop(); return 0.08; });
def(['beyti_sarma'], b => { const y = oval(b, 0.15, 0.1); for (let i = 0; i < 4; i++) { const x = -0.06 + i * 0.04; b.cyl(0.02, 0.02, 0.026, P.lavas, x, y + 0.02, 0, { rz: HP, seg: 10 }); b.cyl(0.013, 0.013, 0.027, P.et, x, y + 0.02, 0, { rz: HP, seg: 8 }); } b.box(0.17, 0.006, 0.06, P.domatesSos, 0, y + 0.002, 0, { r: 0.003 }); b.sph(0.025, P.yogurt, 0.09, y, 0.04, { ws: 8, hs: 5, tl: HP, sy: 0.7 }); b.sph(0.025, P.yogurt, -0.09, y, -0.04, { ws: 8, hs: 5, tl: HP, sy: 0.7 }); return 0.05; });
def(['kuzu_tandir'], b => { const y = tabak(b, 0.12); b.sph(0.06, P.pilav, 0, y, 0, { ws: 10, hs: 5, tl: HP, sy: 0.45 }); b.sph(0.045, '#6b3418', 0, y + 0.03, 0, { ws: 10, hs: 6, sx: 1.2, sy: 0.6, sz: 0.9 }); b.cyl(0.006, 0.004, 0.06, '#f4ecd8', 0.05, y + 0.04, 0, { rz: 1.1, seg: 5 }); for (const [x, z] of [[-0.08, 0.03], [0.08, -0.03], [0.07, 0.05]]) b.sph(0.016, '#e0a84a', x, y + 0.01, z, { ws: 6, hs: 5 }); maydanoz(b, -0.06, y, -0.06); return 0.07; });
def(['biftek'], b => { const y = tahta(b, 0.28, 0.17, P.ahsapKoyu); for (let i = 0; i < 4; i++) { b.box(0.03, 0.032, 0.09, '#4a2312', -0.05 + i * 0.033, y + 0.016, -0.01, { r: 0.006, rz: 0.12 }); b.box(0.022, 0.022, 0.092, '#d0645a', -0.05 + i * 0.033 + 0.003, y + 0.016, -0.01, { r: 0.004, rz: 0.12 }); } for (let i = 0; i < 6; i++) b.box(0.01, 0.01, 0.06, P.patates, 0.07 + (i % 3) * 0.013, y + 0.006 + Math.floor(i / 3) * 0.01, 0.03, { r: 0.002, ry: i * 0.3 }); b.cyl(0.002, 0.002, 0.08, '#3d6e2a', 0.0, y + 0.036, 0.0, { rz: HP, ry: 0.5, seg: 4 }); for (let i = 0; i < 5; i++) b.box(0.012, 0.002, 0.004, '#4f8a35', -0.025 + i * 0.012, y + 0.037, 0.0 - i * 0.006, { r: 0, ry: 0.5 + (i % 2) }); return 0.06; });
def(['pilav_ustu'], b => { const y = tabak(b, 0.11); b.sph(0.065, P.pilav, 0, y, 0, { ws: 10, hs: 5, tl: HP, sy: 0.5 }); for (let i = 0; i < 5; i++) b.box(0.04, 0.006, 0.03, i % 2 ? P.et : P.tavuk, -0.02 + (i % 3) * 0.02, y + 0.034 + i * 0.002, -0.012 + (i % 2) * 0.02, { r: 0.002, ry: i }); maydanoz(b, 0.06, y, 0.05); kozBiber(b, -0.06, y, 0.05, 0.6); return 0.07; });

// --- dürüm / ekmek arası (dürümcü, balıkçı)
def(['tavuk_durum'], b => durumW(b, P.tavuk));
def(['et_durum'], b => durumW(b, P.et, '#e0533c'));
def(['balik_durum'], b => durumW(b, P.balikKarin, '#3f8fc9'));
def(['yarim_ekmek'], b => { b.box(0.2, 0.004, 0.11, P.kagit, 0, 0.002, 0, { r: 0 }); b.push(new T.Matrix4().makeTranslation(0, 0.004, 0)); ekmekArasi(b, P.et, 'doner'); b.pop(); return 0.08; });
def(['balik_ekmek'], b => { b.box(0.2, 0.004, 0.11, '#dfe6ee', 0, 0.002, 0, { r: 0 }); b.push(new T.Matrix4().makeTranslation(0, 0.004, 0)); ekmekArasi(b, '#d9a05b', 'fileto'); b.pop(); limonD(b, 0.11, 0.004, 0.04); return 0.08; });
def(['tombik'], b => { b.box(0.15, 0.004, 0.15, P.kagit, 0, 0.002, 0, { r: 0 }); b.sph(0.06, '#e2b672', 0, 0.006, 0, { ws: 10, hs: 5, tl: HP, sy: 0.5 }); b.cyl(0.058, 0.058, 0.016, P.et, 0, 0.012, 0, { seg: 14 }); b.cyl(0.059, 0.059, 0.006, P.marul, 0, 0.022, 0, { seg: 14 }); b.sph(0.058, '#d9a65e', 0, 0.026, 0, { ws: 10, hs: 5, tl: HP, sy: 0.55 }); for (let i = 0; i < 8; i++) { const a = i * 0.8; b.sph(0.004, '#f6ecd0', Math.cos(a) * 0.03, 0.055, Math.sin(a) * 0.03, { ws: 4, hs: 3 }); } return 0.06; });
def(['metre_durum'], b => { b.box(0.4, 0.012, 0.1, P.ahsap, 0, 0.006, 0, { r: 0.004 }); for (let i = 0; i < 5; i++) { const x = -0.16 + i * 0.08; b.cyl(0.03, 0.03, 0.074, P.lavas, x, 0.042, 0, { rz: HP, seg: 12 }); b.cyl(0.025, 0.025, 0.075, i % 2 ? P.et : P.etKoyu, x, 0.042, 0, { rz: HP, seg: 10 }); } b.cyl(0.0035, 0.0035, 0.42, '#c9ced6', 0, 0.075, 0, { rz: HP, seg: 4 }); return 0.08; });

// --- deniz
def(['levrek'], b => { const y = oval(b, 0.16, 0.09); balikB(b, -0.01, y, 0, 0.22); limonD(b, 0.11, y, 0.04, 0.4); for (let i = 0; i < 4; i++) b.box(0.03, 0.003, 0.012, '#5fb04a', 0.09 + (i % 2) * 0.012, y + 0.004 + i * 0.002, -0.04 + i * 0.008, { r: 0, ry: i }); return 0.06; });
def(['lufer_bugulama'], b => { const y = kase(b, 0.12, 0.04, P.tabak, '#e9b56a', 0.6); balikB(b, 0, y + 0.002, 0, 0.17, 0.2, '#4a6a7a', '#c8d6de', false); domatesD(b, -0.05, y + 0.012, 0.045, 0.018); kozBiber(b, 0.05, y, 0.05, 0.4); maydanoz(b, 0.0, y + 0.024, -0.06); return 0.06; });
def(['bogaz_aksam'], b => { const y = tabak(b, 0.13, '#fbfaf6', '#2b3a55'); b.box(0.09, 0.02, 0.045, '#f3e6d6', 0, y + 0.012, 0, { r: 0.008 }); b.box(0.09, 0.004, 0.045, '#d9963a', 0, y + 0.024, 0, { r: 0.002 }); for (let i = 0; i < 4; i++) b.cyl(0.004, 0.004, 0.09, '#5aa33f', 0, y + 0.006, 0.045 + i * 0.008, { rz: HP, ry: 0.1, seg: 4 }); for (let i = 0; i < 5; i++) b.sph(0.006, '#c0182e', -0.07 + i * 0.035, y, -0.05, { ws: 5, hs: 3, sy: 0.4 }); b.sph(0.03, '#f2e6cc', -0.06, y, 0.02, { ws: 8, hs: 5, tl: HP, sy: 0.5 }); maydanoz(b, 0.03, y + 0.024, 0, 0.6); return 0.05; });
def(['hamsi_tava'], b => { const y = tabak(b, 0.12, P.tabak, P.cini); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; hamsi(b, Math.cos(a) * 0.055, y + (i % 2) * 0.004, Math.sin(a) * 0.055, -a); } limonD(b, 0, y, 0); sogan(b, 0.015, y + 0.006, 0.02); return 0.04; });
def(['midye_dolma'], b => { const y = tabak(b, 0.11); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; b.push(new T.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * 0.065, y, Math.sin(a) * 0.065)); b.sph(0.024, '#1e2024', 0, 0.008, 0, { ws: 8, hs: 4, tl: HP, rx: PI, sx: 1.4, sy: 0.5, sz: 0.85 }); b.sph(0.02, '#e9c58a', 0, 0.008, 0, { ws: 8, hs: 4, tl: HP, sx: 1.35, sy: 0.6, sz: 0.8 }); b.pop(); } limonD(b, 0, y, 0); limonD(b, 0.01, y, -0.02, 1.4); return 0.04; });
def(['mido_tabak'], b => { const y = oval(b, 0.17, 0.12, '#e8eef2'); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, d = i % 2 ? 0.1 : 0.065; b.push(new T.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * d, y, Math.sin(a) * d * 0.68)); b.sph(0.022, '#1e2024', 0, 0.007, 0, { ws: 8, hs: 4, tl: HP, rx: PI, sx: 1.4, sy: 0.5, sz: 0.85 }); b.sph(0.018, '#e9c58a', 0, 0.007, 0, { ws: 8, hs: 4, tl: HP, sx: 1.35, sy: 0.6, sz: 0.8 }); b.pop(); } for (let i = 0; i < 3; i++) limonD(b, -0.02 + i * 0.02, y, -0.005 + (i % 2) * 0.01, i); return 0.04; });
def(['midye_tava'], b => { const y = oval(b, 0.14, 0.09); for (let k = 0; k < 2; k++) { b.cyl(0.0025, 0.0025, 0.18, '#d9b98c', 0, y + 0.014, -0.025 + k * 0.035, { rz: HP, seg: 4 }); for (let i = 0; i < 5; i++) b.sph(0.016, P.kizarmis, -0.06 + i * 0.03, y + 0.014, -0.025 + k * 0.035, { ws: 7, hs: 5, sx: 1.2, sy: 0.8 }); } b.push(new T.Matrix4().makeTranslation(0.09, y, 0.04)); kase(b, 0.025, 0.022, P.tabak, '#f4efe2'); b.pop(); limonD(b, -0.09, y, 0.04); return 0.04; });
def(['kalamar'], b => { const y = tabak(b, 0.11); for (let i = 0; i < 9; i++) { const a = i * 2.1; b.tor(0.017, 0.007, P.kizarmis, Math.cos(a) * 0.045 * (i % 3) * 0.6, y + 0.008 + (i % 3) * 0.006, Math.sin(a) * 0.045 * (i % 3) * 0.6, { rx: HP - 0.3 + i * 0.2, rs: 5, ts: 10 }); } b.push(new T.Matrix4().makeTranslation(0.07, y, 0.05)); kase(b, 0.022, 0.02, P.tabak, '#f4efe2'); b.pop(); limonD(b, -0.07, y, 0.05); return 0.04; });
def(['karides_guvec'], (b, r) => { b.lathe([[0, 0], [0.04, 0], [0.065, 0.035], [0.07, 0.05], [0.064, 0.05], [0.05, 0.02], [0, 0.02]], P.toprak, 0, 0, 0, { seg: 14 }); b.tor(0.012, 0.004, P.toprak, 0.075, 0.042, 0, { rs: 3, ts: 8 }); b.cyl(0.062, 0.062, 0.006, '#d9482b', 0, 0.043, 0, { seg: 14 }); yigin(b, r, 5, 0.04, 0.046, ['#f5b080'], (x, y, z, c) => b.tor(0.012, 0.005, c, x, y, z, { arc: PI * 1.3, rs: 4, ts: 8, rx: HP }), 0); b.sph(0.04, '#f5d070', 0, 0.042, 0, { ws: 10, hs: 5, tl: HP, sx: 1.2, sy: 0.18 }); maydanoz(b, 0, 0.05, 0); return 0.07; });
def(['ahtapot_salata'], b => { const y = tabak(b, 0.11); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; b.tor(0.02, 0.006, P.ahtapot, Math.cos(a) * 0.04, y + 0.008, Math.sin(a) * 0.04, { arc: PI * 1.4, rs: 4, ts: 9, rx: HP, rz: a }); } for (let i = 0; i < 6; i++) b.box(0.026, 0.003, 0.012, i % 2 ? '#5fb04a' : '#8fd06b', Math.cos(i) * 0.075, y + 0.002, Math.sin(i) * 0.075, { r: 0, ry: i }); domatesD(b, 0, y + 0.01, 0, 0.012); limonD(b, 0.06, y, -0.06); return 0.04; });
def(['deniz_makarna'], b => { const y = kase(b, 0.11, 0.04, P.tabak, undefined); for (let i = 0; i < 5; i++) b.tor(0.06 - i * 0.01, 0.006, '#f2d488', 0, y - 0.01 + i * 0.008, 0, { rx: HP, rs: 4, ts: 18 }); b.sph(0.04, '#e86a3a', 0, y + 0.024, 0, { ws: 8, hs: 4, tl: HP, sy: 0.25 }); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; b.tor(0.014, 0.006, '#f08a5d', Math.cos(a) * 0.04, y + 0.03, Math.sin(a) * 0.04, { arc: PI * 1.3, rs: 4, ts: 8, rx: HP, rz: a }); } maydanoz(b, 0, y + 0.034, 0, 0.7); return 0.07; });

// --- lokanta / ev yemeği
def(['fasulye'], (b, r) => { const y = tabak(b, 0.11, P.tabak, '#b0281e'); b.sph(0.08, '#c8452b', 0, y, 0, { ws: 12, hs: 4, tl: HP, sy: 0.12 }); yigin(b, r, 16, 0.065, y + 0.008, ['#f2e6cc', '#efdfc0'], (x, yy, z, c, i) => b.sph(0.008, c, x, yy, z, { ws: 5, hs: 4, sx: 1.5, ry: i }), 0.004); maydanoz(b, 0.0, y + 0.012, 0, 0.6); return 0.04; });
def(['karniyarik'], b => { const y = oval(b, 0.15, 0.1); for (const s of [-1, 1]) { b.push(new T.Matrix4().makeRotationY(s * 0.25).setPosition(0, y, s * 0.03)); b.sph(0.07, '#3a1e3a', 0, 0.02, 0, { ws: 10, hs: 6, sx: 1, sy: 0.32, sz: 0.36 }); b.box(0.09, 0.016, 0.03, '#8a3a22', 0, 0.038, 0, { r: 0.007 }); domatesD(b, -0.02, 0.044, 0, 0.012); b.cyl(0.005, 0.005, 0.03, '#5aa33f', 0.03, 0.05, 0, { rz: HP, seg: 4 }); b.pop(); } return 0.06; });
def(['lahmacun'], (b, r) => { const y = tabak(b, 0.13); b.cyl(0.11, 0.11, 0.006, '#e8c088', 0, y + 0.003, 0, { seg: 18 }); b.cyl(0.1, 0.1, 0.0065, '#b8452b', 0, y + 0.0035, 0, { seg: 18 }); yigin(b, r, 14, 0.09, y + 0.007, ['#7a2e1e', '#4f8a35', '#d9602b'], (x, yy, z, c) => b.sph(0.005, c, x, yy, z, { ws: 4, hs: 3, sy: 0.5 }), 0); maydanoz(b, 0.05, y + 0.006, 0.04, 1.2); limonD(b, -0.05, y + 0.006, 0.05, 0.6); return 0.03; });
def(['pide'], b => { const y = tahta(b, 0.3, 0.12); b.cap(0.035, 0.2, '#e0a85a', 0, y + 0.012, 0, { rz: HP, sy: 1, sz: 1, sx: 0.4 }); b.box(0.18, 0.008, 0.04, '#e8b96a', 0, y + 0.012, 0, { r: 0.004 }); b.box(0.15, 0.01, 0.03, '#a8452b', 0, y + 0.017, 0, { r: 0.004 }); b.sph(0.016, P.sari, 0, y + 0.022, 0, { ws: 8, hs: 5, sy: 0.6 }); for (let i = 0; i < 3; i++) b.box(0.002, 0.012, 0.03, '#8a5a2a', -0.05 + i * 0.05, y + 0.018, 0, { r: 0 }); return 0.04; });
def(['manti'], (b, r) => { const y = kase(b, 0.09, 0.04, P.tabak, P.yogurt, 0.7); yigin(b, r, 12, 0.06, y + 0.004, ['#f0dcb0'], (x, yy, z, c) => b.sph(0.009, c, x, yy, z, { ws: 5, hs: 4 }), 0); yigin(b, r, 6, 0.05, y + 0.012, [P.tereyag], (x, yy, z, c) => b.sph(0.009, c, x, yy, z, { ws: 5, hs: 3, sy: 0.25, sx: 1.6 }), 0); b.sph(0.006, P.nane, 0, y + 0.014, 0, { ws: 4, hs: 3 }); return 0.05; });
def(['yaprak_sarma'], b => { const y = oval(b, 0.14, 0.09); for (let i = 0; i < 8; i++) b.sph(0.026, i % 2 ? '#5e7a32' : '#6f8a3a', -0.07 + (i % 4) * 0.035, y + 0.011, -0.02 + Math.floor(i / 4) * 0.03, { ws: 8, hs: 5, sy: 0.42, sz: 0.42, ry: 0.15 }); for (let i = 0; i < 3; i++) limonH(b, -0.06 + i * 0.05, y + 0.006, 0.05, 0.2); return 0.035; });
def(['meze_tabagi'], b => { const y = oval(b, 0.16, 0.11, P.tabak, P.cini); const d: [number, number, string][] = [[-0.08, -0.025, '#fbfaf2'], [-0.025, -0.035, '#c8371f'], [0.035, -0.03, '#f2e2a0'], [0.085, 0.0, '#7a5a3a'], [-0.05, 0.04, '#e8682b'], [0.025, 0.04, '#8fae55']]; for (const [x, z, c] of d) b.sph(0.026, c, x, y, z, { ws: 9, hs: 5, tl: HP, sy: 0.55 }); maydanoz(b, -0.08, y + 0.014, -0.025, 0.6); maydanoz(b, 0.035, y + 0.014, -0.03, 0.6); b.sph(0.008, P.zeytin, 0.085, y + 0.014, 0, { ws: 5, hs: 4 }); return 0.03; });
def(['coban_salata'], (b, r) => { const y = kase(b, 0.085, 0.045, P.tabak, '#7cbf4a', 0.75); yigin(b, r, 18, 0.06, y + 0.004, [P.domates, '#9bd06a', '#fbfaf2', P.domates, '#5aa33f'], (x, yy, z, c, i) => b.box(0.014, 0.012, 0.014, c, x, yy, z, { r: 0.003, ry: i }), 0.012); maydanoz(b, 0, y + 0.018, 0); return 0.06; });
def(['salata_k'], (b, r) => { b.box(0.14, 0.05, 0.1, '#e6f2f6', 0, 0.025, 0, { r: 0.01 }); b.box(0.13, 0.008, 0.09, '#f6e8c0', 0, 0.046, 0, { r: 0.004 }); yigin(b, r, 14, 0.045, 0.05, [P.cilek, P.muz, '#8fc23a', '#f08a3c'], (x, yy, z, c, i) => b.box(0.012, 0.01, 0.012, c, x, yy, z, { r: 0.003, ry: i }), 0.006); b.box(0.145, 0.006, 0.105, '#cfe8f0', 0.0, 0.075, -0.06, { r: 0.003, rx: -1.2 }); return 0.07; });
def(['sutlac'], b => { b.push(new T.Matrix4().makeScale(1.25, 1, 0.85)); b.lathe([[0, 0], [0.045, 0], [0.055, 0.035], [0.05, 0.035], [0.04, 0.008], [0, 0.008]], P.toprak, 0, 0, 0, { seg: 14 }); b.cyl(0.05, 0.05, 0.004, '#f6ecd6', 0, 0.031, 0, { seg: 14 }); b.pop(); for (const [x, z] of [[-0.02, 0], [0.015, 0.01], [0.03, -0.01], [-0.005, -0.012]]) b.sph(0.012, '#b06a2a', x, 0.033, z, { ws: 6, hs: 3, sy: 0.25 }); return 0.04; });

// --- tatlılar
def(['kunefe', 'kunefe_b'], (b, r) => { b.lathe([[0, 0], [0.07, 0], [0.08, 0.016], [0.074, 0.016], [0.066, 0.006], [0, 0.006]], P.bakir, 0, 0, 0, { seg: 12 }); b.cyl(0.066, 0.066, 0.02, '#e0932b', 0, 0.016, 0, { seg: 12 }); yigin(b, r, 22, 0.058, 0.026, ['#f0a83a', '#c8701e'], (x, y, z, c, i) => b.box(0.018, 0.003, 0.003, c, x, y, z, { r: 0, ry: i * 0.7 }), 0); yigin(b, r, 12, 0.03, 0.028, [P.fistik], (x, y, z, c) => b.sph(0.005, c, x, y, z, { ws: 4, hs: 3 }), 0); b.sph(0.018, P.kaymak, 0.04, 0.026, -0.03, { ws: 8, hs: 5, sy: 0.6 }); return 0.04; });
def(['baklava'], b => { const y = tabak(b, 0.1); for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.06, z = (Math.floor(i / 2) - 0.5) * 0.055; b.box(0.045, 0.028, 0.045, '#e0a84a', x, y + 0.014, z, { r: 0.004, ry: PI / 4 }); b.box(0.04, 0.004, 0.04, '#c8822a', x, y + 0.03, z, { r: 0, ry: PI / 4 }); b.sph(0.009, P.fistik, x, y + 0.032, z, { ws: 5, hs: 3, sy: 0.5 }); } return 0.045; });
def(['baklava_tepsi'], b => { b.lathe([[0, 0], [0.13, 0], [0.14, 0.03], [0.134, 0.03], [0.126, 0.008], [0, 0.008]], P.bakir, 0, 0, 0, { seg: 14 }); b.cyl(0.126, 0.126, 0.02, '#e0a84a', 0, 0.018, 0, { seg: 14 }); for (let i = -3; i <= 3; i++) { b.box(0.25 - Math.abs(i) * 0.03, 0.003, 0.003, '#a8642a', 0, 0.029, i * 0.032, { r: 0, ry: PI / 4 }); b.box(0.25 - Math.abs(i) * 0.03, 0.003, 0.003, '#a8642a', 0, 0.029, i * 0.032, { r: 0, ry: -PI / 4 }); } for (let i = 0; i < 9; i++) b.sph(0.007, P.fistik, (i % 3 - 1) * 0.045, 0.03, (Math.floor(i / 3) - 1) * 0.045, { ws: 4, hs: 3, sy: 0.5 }); return 0.04; });
def(['tel_kadayif'], (b, r) => { const y = tabak(b, 0.1); for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + 0.5, x = Math.cos(a) * 0.04, z = Math.sin(a) * 0.04; b.cyl(0.03, 0.032, 0.03, '#e8b050', x, y + 0.015, z, { seg: 10 }); yigin(b, r, 6, 0.025, y + 0.03, ['#c8822a'], (xx, yy, zz, c, k) => b.box(0.02, 0.003, 0.003, c, x + xx, yy, z + zz, { r: 0, ry: k }), 0); b.sph(0.01, P.fistik, x, y + 0.033, z, { ws: 5, hs: 3, sy: 0.6 }); } return 0.05; });
def(['sobiyet'], b => { const y = tabak(b, 0.1); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; b.push(new T.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * 0.035, y, Math.sin(a) * 0.035)); b.cone(0.035, 0.026, '#e8c27a', 0, 0.013, 0, { seg: 3 }); b.box(0.03, 0.01, 0.01, P.fistik, 0, 0.012, 0.012, { r: 0.003 }); b.pop(); } return 0.04; });
def(['ekmek_kadayif'], b => { const y = tabak(b, 0.1); b.cyl(0.06, 0.062, 0.03, '#a8602a', 0, y + 0.015, 0, { seg: 14 }); b.cyl(0.058, 0.058, 0.004, '#c8833c', 0, y + 0.031, 0, { seg: 14 }); b.cyl(0.035, 0.035, 0.016, P.kaymak, 0, y + 0.04, 0, { seg: 12 }); b.sph(0.006, P.fistik, 0, y + 0.05, 0, { ws: 4, hs: 3 }); return 0.06; });
def(['kazandibi'], b => { const y = tabak(b, 0.1); b.box(0.1, 0.03, 0.06, '#f6ecd6', 0, y + 0.015, 0, { r: 0.006 }); b.box(0.1, 0.006, 0.06, '#9a5a22', 0, y + 0.032, 0, { r: 0.003 }); b.box(0.02, 0.012, 0.06, '#9a5a22', -0.045, y + 0.026, 0, { r: 0.004, rz: 0.4 }); return 0.04; });
def(['katmer'], b => { const y = tabak(b, 0.11); for (let i = 0; i < 4; i++) { const x = (i % 2 - 0.5) * 0.06, z = (Math.floor(i / 2) - 0.5) * 0.06; b.box(0.055, 0.016, 0.055, '#f0d09a', x, y + 0.008, z, { r: 0.006 }); b.box(0.04, 0.004, 0.04, P.fistik, x, y + 0.017, z, { r: 0.002 }); } b.sph(0.024, P.kaymak, 0.075, y, 0.06, { ws: 8, hs: 5, tl: HP, sy: 0.7 }); return 0.04; });
def(['sufle'], b => { const y = tabak(b, 0.1); b.cyl(0.04, 0.035, 0.045, '#fbfaf6', -0.02, y + 0.022, 0, { seg: 14 }); b.cyl(0.037, 0.037, 0.008, P.cikolata, -0.02, y + 0.044, 0, { seg: 14 }); b.sph(0.035, '#5a2e1c', -0.02, y + 0.045, 0, { ws: 10, hs: 5, tl: HP, sy: 0.45 }); b.sph(0.02, '#f6f2ea', -0.02, y + 0.058, 0, { ws: 8, hs: 4, tl: HP, sy: 0.25 }); top(b, '#fbf6e6', 0.055, y, 0.02, 0.022); b.sph(0.007, P.nane, 0.06, y + 0.04, 0.02, { ws: 4, hs: 3 }); return 0.07; });
def(['maras_dondurma'], b => { kulah(b, '#d8a050', 0.11, 0.035); top(b, '#fbf6e6', 0, 0.105, 0, 0.034); b.cone(0.016, 0.03, '#fbf6e6', 0, 0.165, 0, { seg: 8 }); for (let i = 0; i < 6; i++) b.sph(0.004, P.fistik, Math.cos(i) * 0.025, 0.14, Math.sin(i) * 0.025, { ws: 4, hs: 3 }); return 0.18; });
def(['kesme_maras'], b => { const y = tabak(b, 0.11); for (let i = 0; i < 3; i++) b.box(0.03, 0.03, 0.08, '#fbf6e6', -0.035 + i * 0.034, y + 0.015, 0, { r: 0.008, ry: 0.1 }); b.box(0.1, 0.004, 0.012, P.fistik, 0, y + 0.032, 0, { r: 0.002 }); catal(b, 0.0, y, 0.07, 0.1); return 0.05; });
def(['kulah'], b => { kulah(b, '#d8a050', 0.11, 0.035); top(b, '#fbf6e6', 0, 0.1, 0, 0.033); top(b, '#e8869c', 0, 0.145, 0, 0.028); return 0.2; });
def(['kaymakli'], b => { const y = kase(b, 0.05, 0.04, '#fbfaf6'); top(b, '#fbf6e6', 0, y, 0, 0.034); b.sph(0.01, P.kiraz, 0, y + 0.07, 0, { ws: 6, hs: 5 }); return 0.11; });
def(['sakizli'], b => { const y = kase(b, 0.05, 0.04, '#cfe8d8'); top(b, '#f4f7f2', -0.012, y, 0, 0.028); top(b, '#e6f2e2', 0.016, y, 0.006, 0.026); b.sph(0.012, P.nane, 0, y + 0.05, 0, { ws: 5, hs: 3, sy: 0.4 }); return 0.1; });
def(['sorbe'], b => { b.lathe([[0, 0], [0.025, 0], [0.008, 0.01], [0.006, 0.04], [0.045, 0.06], [0.048, 0.07], [0, 0.065]], P.cam, 0, 0, 0, { seg: 12 }); top(b, '#f2e050', 0, 0.065, 0, 0.032); limonH(b, 0.035, 0.09, 0, 0.5); return 0.12; });
def(['cikolatali_kup'], b => { const y = kase(b, 0.055, 0.04, '#f4ece0'); top(b, '#5a2e1c', -0.015, y, 0, 0.028); top(b, '#7a4a2a', 0.016, y, 0.008, 0.026); b.tor(0.03, 0.004, P.cikolata, 0, y + 0.05, 0, { rx: HP, rs: 3, ts: 12 }); b.cyl(0.006, 0.006, 0.07, '#e8c27a', 0.01, y + 0.06, -0.01, { seg: 6, rz: 0.4 }); return 0.12; });
def(['dev_kup'], b => { b.lathe([[0, 0], [0.03, 0], [0.01, 0.012], [0.008, 0.04], [0.055, 0.07], [0.06, 0.09], [0, 0.085]], P.cam, 0, 0, 0, { seg: 12 }); top(b, '#e8869c', -0.022, 0.085, 0, 0.026); top(b, '#fbf6e6', 0.022, 0.085, 0.006, 0.026); top(b, '#5a2e1c', 0, 0.11, -0.01, 0.024); b.sph(0.022, '#ffffff', 0, 0.15, 0, { ws: 8, hs: 5, sy: 0.8 }); b.sph(0.01, P.kiraz, 0, 0.172, 0, { ws: 6, hs: 5 }); b.cyl(0.006, 0.006, 0.06, '#e8c27a', 0.03, 0.15, 0, { seg: 6, rz: -0.5 }); return 0.19; });

// --- şekerci, çerezci
def(['akide'], (b, r) => { b.lathe([[0, 0], [0.045, 0], [0.05, 0.02], [0.05, 0.11], [0.035, 0.12], [0, 0.12]], P.cam, 0, 0, 0, { seg: 14 }); yigin(b, r, 16, 0.04, 0.025, ['#e0533c', '#ffd23f', '#3fae6a', '#5aa9d6', '#ffffff'], (x, y, z, c, i) => b.box(0.018, 0.014, 0.018, c, x, y + (i % 4) * 0.018, z, { r: 0.005, ry: i }), 0.0); b.cyl(0.04, 0.04, 0.02, '#e0533c', 0, 0.13, 0, { seg: 12 }); return 0.14; });
def(['lokum'], b => { kutuK(b, 0.13, 0.03, 0.1, '#fbfaf6'); for (let i = 0; i < 6; i++) { b.box(0.03, 0.026, 0.03, '#f2a2b3', -0.04 + (i % 3) * 0.04, 0.043, -0.02 + Math.floor(i / 3) * 0.04, { r: 0.006 }); b.box(0.031, 0.004, 0.031, '#ffffff', -0.04 + (i % 3) * 0.04, 0.057, -0.02 + Math.floor(i / 3) * 0.04, { r: 0.002 }); } return 0.06; });
def(['fistikli_lokum'], b => { const y = tabak(b, 0.1); for (let i = 0; i < 5; i++) { const x = -0.05 + (i % 3) * 0.05, z = -0.02 + Math.floor(i / 3) * 0.045; b.box(0.034, 0.03, 0.034, '#f6f2ea', x, y + 0.015, z, { r: 0.006 }); b.box(0.035, 0.022, 0.035, P.fistik, x, y + 0.015, z, { r: 0.004, sx: 0.5, sz: 0.5 }); } return 0.05; });
def(['pismaniye'], (b, r) => { kutuK(b, 0.12, 0.04, 0.09, '#e0533c', '#f2b632'); yigin(b, r, 5, 0.03, 0.052, ['#f6ecd0', '#fbf6e6'], (x, y, z, c) => b.ico(0.02, c, x, y, z, { d: 1 }), 0.006); return 0.08; });
def(['macun'], b => { b.cyl(0.004, 0.004, 0.14, '#e8d8b0', 0, 0.07, 0, { seg: 5 }); const cs = ['#e0533c', '#ffd23f', '#3fae6a', '#f08a3c', '#8a6bbf']; cs.forEach((c, i) => b.cyl(0.03 - i * 0.004, 0.032 - i * 0.004, 0.014, c, 0, 0.13 + i * 0.012, 0, { seg: 12 })); b.cone(0.012, 0.02, '#e0533c', 0, 0.2, 0, { seg: 8 }); return 0.21; });
def(['kestane_sekeri'], b => { kutuK(b, 0.13, 0.025, 0.09, '#5a3a24', undefined, undefined); for (let i = 0; i < 6; i++) { const x = -0.04 + (i % 3) * 0.04, z = -0.02 + Math.floor(i / 3) * 0.04; b.cyl(0.018, 0.014, 0.014, '#f4efe4', x, 0.032, z, { seg: 10, open: true }); b.sph(0.016, '#7a4a2a', x, 0.04, z, { ws: 8, hs: 6, sy: 0.85 }); b.sph(0.006, '#c8a070', x + 0.006, 0.05, z + 0.004, { ws: 4, hs: 3 }); } return 0.06; });
def(['cikolata_el'], b => { const y = arduaz(b, 0.18, 0.11); for (let i = 0; i < 6; i++) { const x = -0.055 + (i % 3) * 0.055, z = -0.025 + Math.floor(i / 3) * 0.05; if (i % 2) b.sph(0.016, i % 3 ? '#4a2a1a' : '#6b3a1e', x, y + 0.012, z, { ws: 8, hs: 6, sy: 0.8 }); else b.box(0.03, 0.02, 0.03, '#4a2a1a', x, y + 0.01, z, { r: 0.006 }); b.tor(0.008, 0.002, '#e8c27a', x, y + 0.024, z, { rx: HP, rs: 3, ts: 6 }); } return 0.04; });
def(['lokum_kutu'], b => kutuK(b, 0.15, 0.06, 0.11, '#c94f6d', undefined, '#f2b632') + 0.02);
const cerez = (renk: string[], sekil: 'sph' | 'tohum' | 'disk' | 'karisik', kagit = P.kraft): Tarif => (b, r) => { const h = kulah(b, kagit, 0.12, 0.05, '#e0533c'); yigin(b, r, 14, 0.04, h - 0.006, renk, (x, y, z, c, i) => { const s = sekil === 'karisik' ? (['sph', 'tohum', 'disk'] as const)[i % 3] : sekil; if (s === 'sph') b.sph(0.009, c, x, y, z, { ws: 6, hs: 4 }); else if (s === 'tohum') b.sph(0.008, c, x, y, z, { ws: 5, hs: 3, sx: 1.8, sz: 0.9, ry: i }); else b.cyl(0.012, 0.012, 0.004, c, x, y, z, { seg: 8, rx: 0.4 * (i % 3), ry: i }); }, 0.025); return h + 0.035; };
def(['leblebi'], cerez(['#e9c46a', '#f0d080'], 'sph'));
def(['ay_cekirdek'], cerez(['#2b2b30', '#5a5a60', '#dcdcd6'], 'tohum'));
def(['kabak_cekirdek'], cerez(['#f4f2ec', '#e6e0cf'], 'tohum', '#f4efe4'));
def(['kuru_kayisi'], cerez(['#e8892b', '#d06a1e'], 'disk', '#f4efe4'));
def(['findik'], cerez(['#8a5a3c', '#a8703e'], 'sph'));
def(['antep'], cerez(['#c8b07a', '#8fae55'], 'tohum'));
def(['karisik_cerez'], cerez(['#c8833c', '#e9c46a', '#2b2b30', '#8a5a3c', '#e8892b'], 'karisik'));
def(['cerez_sepet'], (b, r) => { b.lathe([[0, 0], [0.07, 0], [0.09, 0.05], [0.085, 0.05], [0.064, 0.008], [0, 0.008]], '#b88a52', 0, 0, 0, { seg: 14 }); for (let i = 0; i < 3; i++) b.tor(0.075 + i * 0.006, 0.003, '#8a6236', 0, 0.012 + i * 0.016, 0, { rx: HP, rs: 3, ts: 16 }); yigin(b, r, 22, 0.07, 0.045, ['#c8833c', '#e9c46a', '#2b2b30', '#e8892b', '#8fae55'], (x, y, z, c, i) => b.sph(0.009, c, x, y, z, { ws: 5, hs: 4, sx: i % 2 ? 1.6 : 1 }), 0.02); return 0.08; });
def(['cekirdek'], b => { b.box(0.1, 0.15, 0.06, '#5a3a24', 0, 0.075, 0, { r: 0.008 }); b.box(0.1, 0.02, 0.06, '#3a2416', 0, 0.16, 0, { r: 0.004 }); b.sph(0.022, '#8a5a3c', 0, 0.085, 0.031, { ws: 8, hs: 5, sz: 0.3, sy: 1.3 }); b.box(0.003, 0.03, 0.004, '#3a2416', 0, 0.085, 0.038, { r: 0 }); return 0.17; });

// --- tepsi menüleri
def(['mac_menu'], b => { const y = tepsiK(b, 0.3, 0.2, '#e0533c'); b.push(new T.Matrix4().makeTranslation(-0.05, y, 0.02).multiply(new T.Matrix4().makeScale(0.8, 0.8, 0.8))); ekmekArasi(b, P.kofte, 'kofteYuvarlak'); b.pop(); b.push(new T.Matrix4().makeTranslation(0.07, y, -0.05)); TARIF.citir_patates(b, rngOf('mac')); b.pop(); b.push(new T.Matrix4().makeTranslation(0.09, y, 0.05).multiply(new T.Matrix4().makeScale(0.75, 0.75, 0.75))); kartonBardak(b, '#e0533c', '#fbfaf6', '#fbfaf6', 0.14); b.pop(); return 0.13; });
def(['film_menu'], b => { const y = tepsiK(b, 0.3, 0.2, '#2b3a55'); b.push(new T.Matrix4().makeTranslation(-0.06, y, 0)); TARIF.misir_kova(b, rngOf('film')); b.pop(); b.push(new T.Matrix4().makeTranslation(0.08, y, 0.02).multiply(new T.Matrix4().makeScale(0.85, 0.85, 0.85))); kartonBardak(b, '#5a2a1a', '#fbfaf6', '#e0533c', 0.15); b.pop(); return 0.24; });
const misir = (big: boolean): Tarif => (b, r) => { const rr = big ? 0.065 : 0.05, hh = big ? 0.16 : 0.12; b.cyl(rr, rr * 0.74, hh, '#fbfaf6', 0, hh / 2, 0, { seg: 12 }); for (let i = 0; i < 8; i++) b.box(0.014, hh * 0.98, 0.004, '#d63c3c', Math.cos(i / 8 * TAU) * rr * 0.87, hh / 2, Math.sin(i / 8 * TAU) * rr * 0.87, { r: 0, ry: -i / 8 * TAU + HP, rz: 0.12 * Math.cos(0) }); yigin(b, r, big ? 14 : 10, rr * 0.85, hh, ['#fff4c2', '#ffe08a', '#fbfaf6'], (x, y, z, c) => b.ico(0.013, c, x, y, z, { d: 0 }), 0.03); return hh + 0.04; };
def(['misir_kucuk'], misir(false)); def(['misir_kova'], misir(true));
def(['nachos'], b => { b.lathe([[0, 0], [0.06, 0], [0.085, 0.035], [0.08, 0.035], [0.056, 0.006], [0, 0.006]], '#2a2d33', 0, 0, 0, { seg: 14 }); for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; b.cone(0.03, 0.004, i % 2 ? '#f2c230' : '#e8a82b', Math.cos(a) * 0.04, 0.03 + (i % 3) * 0.006, Math.sin(a) * 0.04, { seg: 3, rx: 0.4 * Math.sin(a), rz: 0.4 * Math.cos(a), ry: a }); } b.cyl(0.024, 0.022, 0.025, '#fbfaf6', 0, 0.042, 0, { seg: 10 }); b.cyl(0.021, 0.021, 0.004, '#f2a630', 0, 0.054, 0, { seg: 10 }); b.cyl(0.007, 0.007, 0.004, '#5aa33f', 0.03, 0.046, 0.02, { seg: 6 }); return 0.06; });
def(['citir_patates', 'patates_kizartma'], (b, r) => { const h = kulah(b, '#e0533c', 0.1, 0.048, '#fbfaf6'); yigin(b, r, 14, 0.035, h - 0.02, [P.patates, '#f6d36a', '#e8b03a'], (x, y, z, c, i) => b.box(0.009, 0.07, 0.009, c, x, y + 0.02, z, { r: 0.002, rx: (r() - 0.5) * 0.5, rz: (r() - 0.5) * 0.5, ry: i }), 0.01); b.sph(0.012, '#e0302a', 0.02, h + 0.004, 0.025, { ws: 6, hs: 4, sy: 0.5 }); return h + 0.06; });
const kumpir = (ust: (b: B, r: Rng, y: number) => void, kule = false): Tarif => (b, r) => { const y = tabak(b, 0.11); b.sph(0.07, P.folyo, 0, y + 0.004, 0, { ws: 10, hs: 5, tl: HP, sx: 1.2, sy: 0.55, sz: 0.85 }); b.sph(0.065, '#f2e2a0', 0, y + 0.016, 0, { ws: 10, hs: 5, tl: HP, sx: 1.15, sy: 0.55, sz: 0.75 }); ust(b, r, y + 0.04); if (kule) { b.sph(0.05, '#f2e2a0', 0, y + 0.05, 0, { ws: 10, hs: 6, tl: HP, sy: 0.6 }); ust(b, r, y + 0.075); b.cyl(0.002, 0.002, 0.06, '#c9ced6', 0, y + 0.11, 0, { seg: 4 }); b.box(0.03, 0.02, 0.002, '#e0533c', 0.015, y + 0.13, 0, { r: 0 }); return 0.15; } return 0.08; };
const kmp = (renk: string[], n = 14, sekil: 'kup' | 'tel' | 'disk' = 'kup') => (b: B, r: Rng, y: number) => yigin(b, r, n, 0.05, y, renk, (x, yy, z, c, i) => { if (sekil === 'tel') b.box(0.025, 0.004, 0.004, c, x, yy, z, { r: 0, ry: i }); else if (sekil === 'disk') b.cyl(0.011, 0.011, 0.005, c, x, yy, z, { seg: 8 }); else b.box(0.01, 0.008, 0.01, c, x, yy, z, { r: 0.002, ry: i }); }, 0.01);
def(['sade_kumpir'], kumpir((b, r, y) => { kmp(['#fbfaf2'], 10)(b, r, y); b.box(0.022, 0.012, 0.022, '#f6e08a', 0, y + 0.01, 0, { r: 0.004 }); maydanoz(b, 0.02, y + 0.006, 0.02, 0.6); }));
def(['kasarli_kumpir'], kumpir(kmp([P.kasar, '#f2d24a', '#e8b030'], 24, 'tel')));
def(['sucuklu_kumpir'], kumpir((b, r, y) => { kmp([P.kasar], 10, 'tel')(b, r, y); kmp([P.sucuk], 7, 'disk')(b, r, y + 0.006); }));
def(['karisik_kumpir', 'kumpir', 'kumpir_t'], kumpir(kmp(['#f2d24a', '#8a2a5a', '#5aa33f', '#2b2b2b', '#e0533c', '#f6ecd0'], 22)));
def(['tavuklu_kumpir'], kumpir((b, r, y) => { kmp([P.kasar], 8, 'tel')(b, r, y); kmp([P.tavuk, '#c98a4a'], 8)(b, r, y + 0.006); }));
def(['kule_kumpir'], kumpir(kmp(['#f2d24a', '#8a2a5a', '#5aa33f', '#e0533c'], 14), true));

// --- şef / dünya
def(['tadim_menusu'], b => { const y = arduaz(b, 0.32, 0.1); const t: ((x: number) => void)[] = [
  x => { b.cyl(0.018, 0.018, 0.016, '#f08a5d', x, y + 0.008, 0, { seg: 10 }); maydanoz(b, x, y + 0.014, 0, 0.5); },
  x => { b.box(0.03, 0.02, 0.022, '#6b3418', x, y + 0.01, 0, { r: 0.006 }); b.sph(0.006, '#c0182e', x, y + 0.024, 0, { ws: 4, hs: 3 }); },
  x => { b.sph(0.017, '#f6ecd6', x, y, 0, { ws: 8, hs: 5, tl: HP, sy: 0.8 }); b.sph(0.005, '#1b1b1b', x, y + 0.015, 0, { ws: 4, hs: 3 }); },
  x => { b.cone(0.016, 0.03, '#e8c27a', x, y + 0.015, 0, { seg: 8 }); b.sph(0.01, P.cilek, x, y + 0.034, 0, { ws: 5, hs: 4 }); },
  x => { b.cyl(0.017, 0.017, 0.014, '#8fd06b', x, y + 0.007, 0, { seg: 10 }); b.sph(0.006, P.limon, x, y + 0.016, 0, { ws: 4, hs: 3 }); }];
  t.forEach((f, i) => f(-0.12 + i * 0.06)); return 0.05; });
def(['risotto'], b => { const y = kase(b, 0.11, 0.035, P.tabak, undefined); b.sph(0.065, '#f0e2bc', 0, y - 0.006, 0, { ws: 10, hs: 5, tl: HP, sy: 0.35 }); for (let i = 0; i < 5; i++) b.cyl(0.012, 0.012, 0.003, '#2a2220', Math.cos(i * 1.3) * 0.025, y + 0.016, Math.sin(i * 1.3) * 0.025, { seg: 8, rx: 0.3, ry: i }); for (let i = 0; i < 4; i++) b.box(0.02, 0.003, 0.01, '#f8f0c0', Math.cos(i * 2) * 0.04, y + 0.014, Math.sin(i * 2) * 0.04, { r: 0, ry: i }); maydanoz(b, 0, y + 0.02, 0, 0.5); return 0.06; });
def(['sushi'], b => { b.box(0.26, 0.01, 0.12, '#1e1e22', 0, 0.005, 0, { r: 0.003 }); for (let i = 0; i < 6; i++) { const x = -0.1 + (i % 3) * 0.035, z = -0.02 + Math.floor(i / 3) * 0.038; b.cyl(0.016, 0.016, 0.022, P.nori, x, 0.021, z, { seg: 10 }); b.cyl(0.0135, 0.0135, 0.0225, '#f6f4ee', x, 0.021, z, { seg: 10 }); b.cyl(0.006, 0.006, 0.023, P.somon, x, 0.021, z, { seg: 6 }); } for (let i = 0; i < 2; i++) { const x = 0.04 + i * 0.045; b.box(0.04, 0.016, 0.022, '#f6f4ee', x, 0.018, 0, { r: 0.007 }); b.box(0.044, 0.008, 0.025, P.somon, x, 0.03, 0, { r: 0.004 }); for (let k = 0; k < 3; k++) b.box(0.002, 0.0085, 0.024, '#fbd0b8', x - 0.012 + k * 0.012, 0.0305, 0, { r: 0 }); } b.sph(0.01, '#8fcf5a', 0.11, 0.012, 0.035, { ws: 6, hs: 4, sy: 0.6 }); for (const z of [-0.048, -0.04]) b.box(0.22, 0.004, 0.004, '#c8a070', 0.02, 0.014, z, { r: 0, ry: 0.05 }); return 0.04; });

// --- kırtasiye
def(['kalem'], b => { const cs = ['#f2c230', '#e0533c', '#3f8fc9']; cs.forEach((c, i) => { const z = (i - 1) * 0.016; b.cyl(0.006, 0.006, 0.15, c, 0, 0.007, z, { rz: HP, seg: 6 }); b.cone(0.006, 0.02, '#f0d9a0', 0.085, 0.007, z, { rz: -HP, seg: 6 }); b.cone(0.002, 0.007, '#2b2b30', 0.093, 0.007, z, { rz: -HP, seg: 4 }); b.cyl(0.0062, 0.0062, 0.012, '#f2a2b3', -0.081, 0.007, z, { rz: HP, seg: 6 }); }); return 0.02; });
def(['defter'], b => { b.box(0.17, 0.02, 0.22, '#2f6fb0', 0, 0.01, 0, { r: 0.004 }); b.box(0.165, 0.016, 0.215, '#fbfaf6', 0.004, 0.01, 0, { r: 0.002 }); for (let i = 0; i < 9; i++) b.tor(0.007, 0.0018, '#c9ced6', -0.085, 0.012, -0.096 + i * 0.024, { rs: 3, ts: 8 }); b.box(0.08, 0.002, 0.03, '#fbfaf6', 0.02, 0.021, -0.05, { r: 0 }); return 0.025; });
def(['silgi'], b => { b.box(0.06, 0.016, 0.03, '#f08fb0', -0.015, 0.008, 0, { r: 0.005 }); b.box(0.04, 0.016, 0.03, '#3f8fc9', 0.034, 0.008, 0, { r: 0.005 }); b.box(0.03, 0.0165, 0.0305, '#fbfaf6', 0.005, 0.008, 0, { r: 0.002 }); return 0.02; });
def(['boya'], b => { b.box(0.13, 0.07, 0.04, '#3fae6a', 0, 0.035, 0, { r: 0.004 }); b.box(0.12, 0.03, 0.041, '#ffd23f', 0, 0.035, 0, { r: 0.002 }); ['#e0533c', '#ffd23f', '#3f8fc9', '#8a6bbf', '#f08a3c', '#2b2b30'].forEach((c, i) => { b.cyl(0.007, 0.007, 0.04, c, -0.05 + i * 0.02, 0.08, 0, { seg: 6 }); b.cone(0.007, 0.012, c, -0.05 + i * 0.02, 0.106, 0, { seg: 6 }); }); return 0.115; });
def(['fotokopi_s'], b => { for (let i = 0; i < 6; i++) b.box(0.2, 0.006, 0.28, i % 2 ? '#fbfbf8' : '#f2f2ee', (i % 2) * 0.003, 0.003 + i * 0.006, (i % 3) * 0.002, { r: 0, ry: (i - 3) * 0.015 }); for (let i = 0; i < 6; i++) b.box(0.14, 0.001, 0.008, '#9aa5b0', -0.01, 0.037, -0.1 + i * 0.03, { r: 0 }); b.box(0.06, 0.001, 0.05, '#c0c8d0', 0.04, 0.037, 0.09, { r: 0 }); return 0.04; });
def(['canta'], b => { b.box(0.16, 0.2, 0.08, '#d9482b', 0, 0.1, 0, { r: 0.03 }); b.box(0.11, 0.08, 0.03, '#b8382b', 0, 0.065, 0.05, { r: 0.012 }); b.box(0.11, 0.006, 0.031, '#f2c230', 0, 0.1, 0.05, { r: 0 }); b.tor(0.035, 0.007, '#3a2416', 0, 0.2, 0, { arc: PI, rs: 4, ts: 10 }); for (const s of [-1, 1]) b.box(0.016, 0.18, 0.012, '#3a2416', s * 0.05, 0.1, -0.045, { r: 0.004 }); return 0.24; });
def(['roman'], b => { b.box(0.15, 0.035, 0.21, '#8c2f39', 0, 0.0175, 0, { r: 0.004 }); b.box(0.145, 0.031, 0.205, '#f4efe4', 0.006, 0.0175, 0, { r: 0.002 }); b.box(0.01, 0.036, 0.21, '#6b2028', -0.072, 0.0175, 0, { r: 0.004 }); b.box(0.1, 0.002, 0.04, '#f2b632', 0, 0.036, -0.05, { r: 0 }); b.box(0.06, 0.002, 0.012, '#f2b632', 0, 0.036, 0.0, { r: 0 }); return 0.04; });
def(['maket'], b => { kutuK(b, 0.18, 0.04, 0.12, '#8f6fd0'); b.cap(0.012, 0.11, '#e8e8e2', 0, 0.06, 0, { rz: HP }); b.box(0.03, 0.004, 0.16, '#e8e8e2', 0.01, 0.06, 0, { r: 0.002 }); b.box(0.02, 0.003, 0.05, '#e8e8e2', -0.06, 0.062, 0, { r: 0.002 }); b.box(0.02, 0.02, 0.003, '#e0533c', -0.065, 0.074, 0, { r: 0 }); return 0.08; });

// --- AVM: giyim
const katli = (c: string, ek?: (b: B) => void): Tarif => b => { b.box(0.18, 0.04, 0.14, c, 0, 0.02, 0, { r: 0.012 }); b.box(0.17, 0.006, 0.13, c, 0, 0.043, 0, { r: 0.003 }); ek?.(b); b.box(0.06, 0.003, 0.03, '#fbfaf6', 0.05, 0.047, 0.04, { r: 0 }); return 0.05; };
def(['tisort'], katli('#e0533c', b => { b.tor(0.03, 0.005, '#c23e2c', 0, 0.047, -0.045, { arc: PI, rs: 3, ts: 10, rx: HP }); }));
def(['kot'], katli('#2f5f9a', b => { b.box(0.004, 0.002, 0.13, '#e8b050', 0.0, 0.047, 0, { r: 0 }); b.box(0.04, 0.002, 0.04, '#24497a', -0.05, 0.047, -0.03, { r: 0 }); }));
def(['gomlek'], katli('#f4f2ec', b => { b.cone(0.02, 0.012, '#e2ded4', -0.02, 0.05, -0.055, { seg: 3, rx: HP, rz: -0.6 }); b.cone(0.02, 0.012, '#e2ded4', 0.02, 0.05, -0.055, { seg: 3, rx: HP, rz: 0.6 }); for (let i = 0; i < 4; i++) b.cyl(0.004, 0.004, 0.002, '#9aa5b0', 0, 0.048, -0.03 + i * 0.03, { seg: 6 }); }));
def(['sweat'], katli('#7d6bb0', b => { b.sph(0.045, '#6a5a9a', 0, 0.045, -0.05, { ws: 10, hs: 5, tl: HP, sy: 0.4 }); b.cyl(0.002, 0.002, 0.05, '#fbfaf6', -0.012, 0.048, -0.01, { rx: HP, seg: 4 }); b.cyl(0.002, 0.002, 0.05, '#fbfaf6', 0.012, 0.048, -0.01, { rx: HP, seg: 4 }); }));
def(['mont'], katli('#3a3d42', b => { for (let i = 0; i < 3; i++) b.box(0.18, 0.006, 0.006, '#2a2d33', 0, 0.046, -0.04 + i * 0.04, { r: 0 }); b.box(0.004, 0.004, 0.13, '#c9ced6', 0, 0.048, 0, { r: 0 }); }));
def(['elbise'], b => { b.tor(0.02, 0.003, '#c9ced6', 0, 0.21, 0, { arc: PI * 1.4, rs: 3, ts: 8 }); b.box(0.12, 0.004, 0.004, '#c9ced6', 0, 0.19, 0, { r: 0 }); b.cyl(0.03, 0.035, 0.06, '#c94f6d', 0, 0.155, 0, { seg: 10 }); b.cone(0.07, 0.12, '#c94f6d', 0, 0.065, 0, { seg: 12 }); b.cyl(0.032, 0.032, 0.008, '#fbfaf6', 0, 0.125, 0, { seg: 10 }); return 0.22; });
def(['takim'], b => { b.tor(0.02, 0.003, '#c9ced6', 0, 0.22, 0, { arc: PI * 1.4, rs: 3, ts: 8 }); b.box(0.13, 0.004, 0.004, '#c9ced6', 0, 0.2, 0, { r: 0 }); b.box(0.12, 0.18, 0.03, '#1d1d22', 0, 0.105, 0, { r: 0.01 }); b.cone(0.03, 0.08, '#f4f2ec', 0, 0.16, 0.016, { seg: 3, rx: PI }); b.box(0.01, 0.05, 0.004, '#c23e2c', 0, 0.15, 0.022, { r: 0 }); return 0.22; });
def(['spor_ayk'], b => { kutuK(b, 0.18, 0.06, 0.11, '#f08a3c', '#2b2b30'); b.push(new T.Matrix4().makeTranslation(0, 0.06, 0)); b.box(0.14, 0.018, 0.05, '#fbfaf6', 0, 0.009, 0, { r: 0.008 }); b.sph(0.045, '#f4f2ec', -0.015, 0.02, 0, { ws: 10, hs: 6, tl: HP, sx: 1.4, sy: 0.9, sz: 0.55 }); b.box(0.06, 0.004, 0.03, '#e0533c', 0, 0.05, 0.0, { r: 0, rz: -0.3 }); b.pop(); return 0.13; });
// --- AVM: elektronik
def(['kulaklik'], b => { b.tor(0.065, 0.008, '#2a2d33', 0, 0.075, 0, { arc: PI, rs: 5, ts: 14 }); for (const s of [-1, 1]) { b.cyl(0.03, 0.03, 0.02, '#2a2d33', s * 0.066, 0.065, 0, { rz: HP, seg: 14 }); b.cyl(0.024, 0.024, 0.006, '#e0533c', s * 0.078, 0.065, 0, { rz: HP, seg: 12 }); } return 0.15; });
def(['powerbank'], b => { b.box(0.07, 0.022, 0.13, '#3f4a6b', 0, 0.011, 0, { r: 0.008 }); for (let i = 0; i < 4; i++) b.box(0.005, 0.003, 0.005, i < 3 ? '#49e6d8' : '#5a6480', -0.015 + i * 0.01, 0.023, 0.05, { r: 0 }); b.box(0.02, 0.006, 0.004, '#1d1d22', 0, 0.011, 0.066, { r: 0 }); return 0.03; });
def(['sarj_kablo'], b => { for (let i = 0; i < 4; i++) b.tor(0.04 - i * 0.002, 0.004, '#f4f2ec', 0, 0.005 + i * 0.006, 0, { rx: HP, rs: 4, ts: 16 }); b.box(0.03, 0.014, 0.024, '#f4f2ec', 0.05, 0.012, 0.03, { r: 0.004 }); b.box(0.004, 0.006, 0.014, '#c9ced6', 0.07, 0.012, 0.03, { r: 0 }); return 0.03; });
def(['kilif'], b => { b.box(0.075, 0.012, 0.15, '#2f9e8f', 0, 0.006, 0, { r: 0.01 }); b.box(0.03, 0.004, 0.03, '#1d1d22', -0.018, 0.013, -0.052, { r: 0.006 }); b.cyl(0.006, 0.006, 0.003, '#fbfaf6', 0.0, 0.013, 0.02, { seg: 8 }); return 0.02; });
def(['hoparlor'], b => { b.cyl(0.04, 0.04, 0.12, '#e0533c', 0, 0.06, 0, { seg: 14 }); b.cyl(0.0405, 0.0405, 0.08, '#2a2d33', 0, 0.06, 0, { seg: 14, open: true }); b.cyl(0.035, 0.035, 0.006, '#2a2d33', 0, 0.122, 0, { seg: 14 }); b.cyl(0.012, 0.012, 0.004, '#f4f2ec', 0, 0.126, 0, { seg: 8 }); return 0.13; });
def(['akilli_saat'], b => { b.box(0.03, 0.006, 0.16, '#1d1d22', 0, 0.003, 0, { r: 0.003 }); b.box(0.045, 0.014, 0.05, '#2a2d33', 0, 0.01, 0, { r: 0.009 }); b.box(0.038, 0.002, 0.042, '#2a6fd0', 0, 0.018, 0, { r: 0.006 }); b.box(0.012, 0.002, 0.004, '#fbfaf6', 0, 0.019, 0, { r: 0 }); return 0.02; });
def(['tablet'], b => { b.box(0.17, 0.01, 0.24, '#9aa5b0', 0, 0.005, 0, { r: 0.01 }); b.box(0.155, 0.002, 0.22, '#1d2a3a', 0, 0.011, 0, { r: 0.006 }); b.box(0.1, 0.0021, 0.06, '#3f8fc9', 0, 0.0115, -0.04, { r: 0.004 }); b.box(0.06, 0.0021, 0.04, '#49b96a', -0.03, 0.0115, 0.04, { r: 0.004 }); return 0.015; });
def(['telefon'], b => { b.box(0.075, 0.01, 0.15, '#2a2d33', 0, 0.005, 0, { r: 0.01 }); b.box(0.068, 0.002, 0.138, '#14181f', 0, 0.011, 0, { r: 0.008 }); b.box(0.05, 0.0021, 0.03, '#f2b632', 0, 0.0115, -0.03, { r: 0.004 }); b.box(0.02, 0.0021, 0.005, '#2a2d33', 0, 0.0115, -0.064, { r: 0 }); return 0.015; });
// --- AVM: oyuncak
def(['pelus'], b => { b.sph(0.05, '#f6f4ee', 0, 0.05, 0, { ws: 10, hs: 6, sx: 1.25, sy: 0.95 }); b.sph(0.034, '#f6f4ee', 0.05, 0.1, 0, { ws: 10, hs: 8 }); for (const s of [-1, 1]) { b.sph(0.035, '#a9b3bd', -0.005, 0.065, s * 0.045, { ws: 8, hs: 6, sx: 1.4, sy: 0.45, sz: 0.6, rx: s * 0.3 }); b.sph(0.005, '#1b1b1b', 0.07, 0.112, s * 0.018, { ws: 4, hs: 3 }); b.cyl(0.006, 0.006, 0.02, '#f2a63a', 0.01 + s * 0.0, 0.008, s * 0.02, { seg: 5 }); } b.cone(0.012, 0.04, '#f2b632', 0.095, 0.098, 0, { rz: -HP, seg: 8 }); b.cone(0.02, 0.04, '#a9b3bd', -0.07, 0.06, 0, { rz: HP, seg: 6, sz: 0.4 }); b.box(0.04, 0.012, 0.03, '#e0533c', 0.04, 0.075, 0, { r: 0.004 }); return 0.14; });
def(['yapboz'], b => { kutuK(b, 0.17, 0.035, 0.12, '#2f7fb3'); b.box(0.12, 0.002, 0.07, '#9fd3f5', 0, 0.036, 0, { r: 0 }); b.box(0.05, 0.002, 0.03, '#49b96a', -0.02, 0.037, 0.01, { r: 0 }); b.box(0.03, 0.008, 0.03, '#f2c230', 0.07, 0.04, 0.05, { r: 0.004 }); b.cyl(0.008, 0.008, 0.008, '#f2c230', 0.087, 0.04, 0.05, { seg: 8 }); return 0.05; });
def(['araba'], b => { b.box(0.11, 0.025, 0.05, '#e0533c', 0, 0.025, 0, { r: 0.01 }); b.box(0.06, 0.022, 0.045, '#e0533c', -0.005, 0.048, 0, { r: 0.01 }); b.box(0.061, 0.014, 0.046, '#bfe3f0', -0.005, 0.05, 0, { r: 0.006, sx: 1 }); for (const [x, z] of [[-0.035, -0.026], [-0.035, 0.026], [0.035, -0.026], [0.035, 0.026]]) b.cyl(0.013, 0.013, 0.01, '#2a2624', x, 0.013, z, { rx: HP, seg: 10 }); return 0.06; });
def(['rc_araba'], b => { b.box(0.13, 0.02, 0.07, '#c0392b', 0, 0.03, 0, { r: 0.008 }); b.box(0.06, 0.022, 0.05, '#2a2624', -0.01, 0.05, 0, { r: 0.008 }); b.box(0.03, 0.006, 0.08, '#2a2624', -0.065, 0.065, 0, { r: 0.002 }); for (const [x, z] of [[-0.042, -0.04], [-0.042, 0.04], [0.042, -0.04], [0.042, 0.04]]) b.cyl(0.02, 0.02, 0.018, '#1d1d22', x, 0.02, z, { rx: HP, seg: 10 }); b.cyl(0.0015, 0.0015, 0.08, '#2a2624', 0.04, 0.1, 0.02, { seg: 4 }); b.sph(0.004, '#e0533c', 0.04, 0.14, 0.02, { ws: 4, hs: 3 }); return 0.14; });
def(['bebek'], b => { b.box(0.09, 0.18, 0.04, '#f2a2b3', 0, 0.09, 0, { r: 0.008 }); b.box(0.07, 0.14, 0.004, '#bfe3f0', 0, 0.095, 0.021, { r: 0.004 }); b.sph(0.018, '#f6d4b4', 0, 0.14, 0.012, { ws: 8, hs: 6 }); b.sph(0.02, '#e8b030', 0, 0.148, 0.008, { ws: 8, hs: 5, tl: HP }); b.cone(0.026, 0.06, '#c94f6d', 0, 0.095, 0.012, { seg: 10 }); return 0.18; });
def(['kutu_oyun'], b => { kutuK(b, 0.2, 0.04, 0.2, '#49b96a'); b.box(0.15, 0.002, 0.15, '#fbfaf6', 0, 0.041, 0, { r: 0 }); for (let i = 0; i < 4; i++) b.box(0.07, 0.0022, 0.07, ['#e0533c', '#ffd23f', '#3f8fc9', '#49b96a'][i], (i % 2 - 0.5) * 0.075, 0.0415, (Math.floor(i / 2) - 0.5) * 0.075, { r: 0 }); b.box(0.016, 0.016, 0.016, '#fbfaf6', 0.06, 0.05, 0.06, { r: 0.004 }); return 0.06; });
def(['yapi_seti'], b => { kutuK(b, 0.17, 0.05, 0.12, '#ffd23f'); const cs = ['#e0533c', '#3f8fc9', '#49b96a']; cs.forEach((c, i) => { b.box(0.04, 0.02, 0.02, c, -0.04 + i * 0.04, 0.06 + i * 0.02, 0, { r: 0.002 }); for (let k = 0; k < 2; k++) b.cyl(0.005, 0.005, 0.006, c, -0.05 + i * 0.04 + k * 0.02, 0.073 + i * 0.02, 0, { seg: 6 }); }); return 0.12; });
def(['tren_seti'], b => { b.box(0.18, 0.006, 0.05, '#7d4a2a', 0, 0.003, 0, { r: 0 }); b.box(0.08, 0.035, 0.04, '#e0533c', -0.03, 0.025, 0, { r: 0.006 }); b.box(0.03, 0.03, 0.04, '#2b3a55', -0.055, 0.055, 0, { r: 0.006 }); b.cyl(0.006, 0.008, 0.025, '#2a2624', 0.0, 0.05, 0, { seg: 6 }); b.box(0.05, 0.03, 0.038, '#3f8fc9', 0.05, 0.022, 0, { r: 0.006 }); for (let i = 0; i < 4; i++) b.cyl(0.01, 0.01, 0.044, '#2a2624', -0.055 + i * 0.035, 0.012, 0, { rx: HP, seg: 8 }); return 0.07; });

// ---------- API ----------
/** bu kimliğin kendine has modeli var mı (büfe ProductId'leri burada yok: props.ts itemInto) */
export const yemekVar = (id: string): boolean => id in TARIF;
const H: Record<string, number> = {};
/** modeli (yerel, y = 0 tabanda) verilen Batch'e çizer; üst yüksekliği döner */
export function yemekInto(b: B, id: string): number { const f = TARIF[id]; if (!f) return 0; const h = f(b, rngOf(id)); H[id] = h; return h; }
/** tek birleşik geometri (köşe rengi + atlas beyazı; MAT.atlas ile çizilir), kimliğe göre önbellekli */
export function yemekGeo(id: string): T.BufferGeometry { return geoc('yemek:' + id, () => { ensureKit(); const b = new Batch(); yemekInto(b, id); return b.geometry(); }); }
/** taşıma yığını için üst yükseklik (m) */
export function yemekH(id: string): number { if (H[id] === undefined) yemekGeo(id); return H[id] ?? 0.1; }
/** kontak sayfası / test için tüm tarif kimlikleri */
export const YEMEK_IDS: readonly string[] = Object.keys(TARIF);
