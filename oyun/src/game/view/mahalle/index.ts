/**
 * Martı Konutları (2026-11-26 sahip: "ayrı mahalle olsun ama parkları, dükkânları, apartmanları ve boş arsaları olsun; caddede gezenler,
 * bisiklet süren ve oyun oynayan çocuklar, inşaat halinde binalar, araçlar ve belediye çalışanları; bildiğin canlı bir mahalle").
 * 42B'nin uğradığı ayrı realm (content/realm.ts 'mahalle', x 244..292). Oyuncunun arsaları (content/esya.ts a1..a5) burada; arsanın
 * kendisi ve üstündeki ev view/mulk'ta çizilir.
 *
 * Yerleşim (kamera güneyden kuzeye değil, +z'den -z'ye bakar: uzak taraf güney): güney sırası park, dört arsa (a1..a4) ve belediye
 * altyapı çalışması; arkada 4-6 katlı apartman sırası. Ortada çift şeritli cadde, kaldırımlar, yaya geçidi. Kuzey (kameraya yakın)
 * sırada alçak dükkânlar (bakkal, fırın, berber, eczane, manav), inşaat halindeki apartman ve beşinci arsa (a5). Uçlarda yol bir
 * köprü altından mahalleden çıkar; dört yanda arka plan blokları boşluğu kapatır.
 *
 * Bütçe: statik her şey TEK vertex-renkli mesh; şantiyeler santiye-kit (site başına tek mesh + birkaç hareketli grup); yaşam ~22 kişi,
 * 4 araç. Oyuncu mahallede değilken hiçbir şey güncellenmez ve grup gizlenir.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { useSkyEnv, loadGlb, fitClone } from '../world/glb';
import { santiyeKur, cit, duba, type Santiye } from '../world/santiye-kit';
import { SETLER } from '../../../content/santiye';
import * as K from '../chars/v2/kit';
import type { Chars } from '../../../engine/api';

export interface MahalleDeps { scene: T.Scene; hero: () => { x: number; z: number }; hour: () => number; night: () => number; chars: Chars | null; /** arsada süren yapımlar (sim/mulk view.plots, insa != null) */ insaatlar?: () => { id: string; x: number; z: number; rotY: number; p: number }[]; setSolid?: (r: { x0: number; x1: number; z0: number; z1: number }[]) => void }
export interface MahalleView { update(dt: number): void; dispose(): void }

export const MAHALLE = { x0: 244, x1: 292, yolZ0: 7.6, yolZ1: 11.4, kalS: 5.6, kalN: 13.4 } as const;
/** mahalle kalabalığı (40 kişi) uzaktan görülür: daha az segmentli gövde (chars-v2 segK). 0.7 -> 0.45 kişi başı ~%35 daha az üçgen */
const NPC_SEG = 0.45;
const X0 = MAHALLE.x0, X1 = MAHALLE.x1, YZ0 = MAHALLE.yolZ0, YZ1 = MAHALLE.yolZ1, KS = MAHALLE.kalS, KN = MAHALLE.kalN;
const ASF = '#4a4d52', KALD = '#c9c2b2', KERB = '#9a958c', CIM = '#7fae5a', CIM_D = '#6d9a4c', TOPRAK = '#9c7a55';

type Rect = { x0: number; x1: number; z0: number; z1: number };
type H = { object: T.Object3D; setPose(p: { x: number; z: number }, r: number): void; setInput(i: Record<string, unknown>): void; update(dt: number, a: number): void };
interface Actor { waitMin?: number; h: H; x: number; z: number; yaw: number; speed: number; act: string; path?: [number, number][]; loop?: boolean; pi: number; wait: number; sp: number; y: number; waitP?: number; ride?: T.Object3D; tick?: (a: Actor, dt: number, t: number) => void }

let mat: T.MeshStandardMaterial | null = null;
const solidMat = () => { if (!mat) { mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 }); useSkyEnv(mat, 'matte'); } return mat; };

/* ---------- dükkân tabelaları: tek atlas ---------- */
const TABELA = [
  { ad: 'BAKKAL', alt: 'Hüsnü Amca', bg: '#c0392b', fg: '#fff3c4' }, { ad: 'FIRIN', alt: 'Taze Ekmek · Simit', bg: '#8a5a2b', fg: '#ffe7a8' },
  { ad: 'BERBER', alt: 'Makas Tayfun', bg: '#1f4e8c', fg: '#ffffff' }, { ad: 'ECZANE', alt: 'Martı Eczanesi', bg: '#ffffff', fg: '#d8332b' },
  { ad: 'MANAV', alt: 'Bahçe Taze', bg: '#2f8a4a', fg: '#fff7d6' }, { ad: 'KIRTASİYE', alt: 'Kalem Defter', bg: '#e8892b', fg: '#1d1d1d' },
  { ad: 'MARTI KONUTLARI', alt: 'Belediye · Hoş geldiniz', bg: '#2f7fb3', fg: '#ffffff' }, { ad: 'ALTYAPI ÇALIŞMASI', alt: 'Martıköy Belediyesi · Dikkat!', bg: '#ffd23f', fg: '#1d1d1d' },
];
function atlas(): T.CanvasTexture {
  const W = 1024, RH = 128, c = document.createElement('canvas'); c.width = W; c.height = RH * TABELA.length; const g = c.getContext('2d')!;
  TABELA.forEach((t, i) => {
    const y = i * RH; g.fillStyle = t.bg; g.fillRect(0, y, W, RH); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 8; g.strokeRect(4, y + 4, W - 8, RH - 8);
    g.fillStyle = t.fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 64px system-ui,"Segoe UI",sans-serif'; g.fillText(t.ad, W / 2, y + 52, W - 60);
    g.font = '700 28px system-ui,"Segoe UI",sans-serif'; g.fillText(t.alt, W / 2, y + 102, W - 60);
  });
  const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; return tx;
}

/* ---------- statik dünya ---------- */
function build(b: Batch, sign: (i: number, x: number, y: number, z: number, w: number, h: number, ry?: number) => void, solid: Rect[]) {
  const sol = (x0: number, x1: number, z0: number, z1: number) => solid.push({ x0, x1, z0, z1 });
  // zemin: mahalle ve çevresi (boşluk görünmesin)
  b.box(110, 0.1, 70, '#b9b09a', 268, -0.06, 9);
  b.box(X1 - X0 + 40, 0.04, YZ1 - YZ0, ASF, 268, 0.02, (YZ0 + YZ1) / 2);
  for (let x = X0 - 20; x < X1 + 20; x += 4) b.box(2.0, 0.012, 0.14, '#f1efe9', x + 1, 0.045, (YZ0 + YZ1) / 2);   // şerit çizgisi
  for (let i = 0; i < 7; i++) b.box(0.5, 0.012, YZ1 - YZ0 - 0.4, '#f1efe9', 252.2 + i * 0.9, 0.046, (YZ0 + YZ1) / 2);   // yaya geçidi (durak önü)
  for (let i = 0; i < 7; i++) b.box(0.5, 0.012, YZ1 - YZ0 - 0.4, '#f1efe9', 279.2 + i * 0.9, 0.046, (YZ0 + YZ1) / 2);
  b.box(X1 - X0 + 40, 0.14, KS - (-6.4), KALD, 268, 0.07, (KS + -6.4) / 2, { world: 1.2 } as never);      // güney kaldırım + ön bahçe zemini
  b.box(X1 - X0 + 40, 0.14, 24.4 - KN, KALD, 268, 0.07, (KN + 24.4) / 2, { world: 1.2 } as never);       // kuzey
  b.box(X1 - X0 + 40, 0.18, 0.22, KERB, 268, 0.09, YZ0 - 0.1); b.box(X1 - X0 + 40, 0.18, 0.22, KERB, 268, 0.09, YZ1 + 0.1);
  for (let x = X0 + 1; x < X1; x += 1.6) { b.box(0.03, 0.005, 1.9, '#b3ab99', x, 0.142, (KS + YZ0) / 2); b.box(0.03, 0.005, 1.9, '#b3ab99', x, 0.142, (KN + YZ1) / 2); }   // kaldırım derzleri

  // ── güney: park (x 244.6..256.0, z -5.6..5.0) ──
  const PX0 = 244.6, PX1 = 256.0, PZ0 = -5.6, PZ1 = 4.9;
  b.box(PX1 - PX0, 0.06, PZ1 - PZ0, CIM, (PX0 + PX1) / 2, 0.16, (PZ0 + PZ1) / 2);
  b.box(1.4, 0.065, PZ1 - PZ0 - 0.4, '#d8cbb0', 250.3, 0.17, (PZ0 + PZ1) / 2); b.box(PX1 - PX0 - 0.6, 0.066, 1.3, '#d8cbb0', (PX0 + PX1) / 2, 0.171, 0.2);   // yürüyüş yolu artı
  for (const [x0, z0, x1, z1] of [[PX0, PZ0, PX1, PZ0], [PX0, PZ0, PX0, PZ1], [PX1, PZ0, PX1, PZ1], [PX0, PZ1, 249.6, PZ1], [251.0, PZ1, PX1, PZ1]] as const) {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.35)), ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i <= n; i++) b.box(0.05, 0.7, 0.05, '#2f6a3a', x0 + (x1 - x0) * i / n, 0.5, z0 + (z1 - z0) * i / n);
    b.box(0.06, 0.06, L, '#2f6a3a', (x0 + x1) / 2, 0.84, (z0 + z1) / 2, { ry }); b.box(0.06, 0.06, L, '#2f6a3a', (x0 + x1) / 2, 0.3, (z0 + z1) / 2, { ry });
  }
  sol(PX0 - 0.1, PX1 + 0.1, PZ0 - 0.1, PZ0 + 0.1); sol(PX0 - 0.1, PX0 + 0.1, PZ0, PZ1); sol(PX1 - 0.1, PX1 + 0.1, PZ0, PZ1); sol(PX0, 249.6, PZ1 - 0.1, PZ1 + 0.1); sol(251.0, PX1, PZ1 - 0.1, PZ1 + 0.1);
  // oyun alanı: kauçuk zemin, salıncak çerçevesi (koltuklar hareketli, aşağıda), kaydırak, tahterevalli, kum havuzu, tırmanma
  b.box(4.6, 0.07, 3.6, '#d9533c', 247.4, 0.18, -3.4);
  for (const s of [-1, 1]) { b.box(0.08, 2.3, 0.08, '#3f7fd0', 245.6 + 0.0, 1.15, -3.4 + s * 0.9, { rx: s * 0.18 }); b.box(0.08, 2.3, 0.08, '#3f7fd0', 248.6, 1.15, -3.4 + s * 0.9, { rx: s * 0.18 }); }
  b.box(3.2, 0.1, 0.1, '#3f7fd0', 247.1, 2.25, -3.4);
  b.box(0.9, 0.08, 2.8, '#ffd23f', 254.2, 0.9, -3.0, { rx: 0.48 }); b.box(1.1, 1.6, 1.1, '#2fb5b0', 254.2, 0.95, -4.6); b.box(1.2, 0.08, 1.2, '#e0533c', 254.2, 1.8, -4.6);
  for (const s of [-1, 1]) b.box(0.06, 1.7, 0.06, '#c9ced6', 254.2 + s * 0.45, 1.0, -3.9);
  b.box(2.6, 0.12, 0.25, '#e8892b', 253.6, 0.55, 2.8, { rz: 0.18 }); b.box(0.3, 0.45, 0.3, '#5b6068', 253.6, 0.3, 2.8);
  b.box(2.2, 0.26, 2.2, '#c8a46a', 246.6, 0.2, 2.6); b.box(1.9, 0.08, 1.9, '#e8d4a0', 246.6, 0.31, 2.6);
  for (let i = 0; i < 4; i++) b.box(0.07, 1.6, 0.07, '#e0533c', 251.6 + (i % 2) * 1.2, 0.95, -1.8 + Math.floor(i / 2) * 1.2);
  for (let k = 0; k < 3; k++) { b.box(1.3, 0.05, 0.05, '#ffd23f', 252.2, 0.6 + k * 0.45, -1.8); b.box(1.3, 0.05, 0.05, '#ffd23f', 252.2, 0.6 + k * 0.45, -0.6); }
  // banklar ve çöp kutuları
  for (const [x, z, ry] of [[249.0, 1.1, 0], [251.6, 1.1, 0], [244.9 + 0.5, -0.8, Math.PI / 2]] as const) { b.at(x, 0.14, z, ry); b.box(1.6, 0.07, 0.45, '#b07a48', 0, 0.45, 0); b.box(1.6, 0.4, 0.06, '#b07a48', 0, 0.72, -0.22); for (const s of [-1, 1]) b.box(0.07, 0.45, 0.45, '#3b3b3b', s * 0.72, 0.22, 0); b.pop(); }
  for (const [x, z] of [[250.0, 4.4], [258.4, 5.2], [271.0, 5.2], [262.0, 13.9], [276.0, 13.9]] as const) { b.cyl(0.22, 0.2, 0.75, '#2f6a3a', x, 0.52, z, { seg: 10 }); b.cyl(0.24, 0.24, 0.05, '#1f4a2a', x, 0.9, z, { seg: 10 }); }
  // ağaçlar (parkta ve kaldırım çukurlarında)
  const agac = (x: number, z: number, s = 1) => { b.cyl(0.12 * s, 0.16 * s, 1.8 * s, '#6b4a2e', x, 0.9 * s + 0.14, z, { seg: 7 }); b.sph(1.15 * s, CIM_D, x, 2.4 * s + 0.14, z, { ws: 8, hs: 6, sy: 0.9 } as never); b.sph(0.8 * s, '#86b65e', x + 0.45 * s, 2.9 * s + 0.14, z + 0.2 * s, { ws: 7, hs: 5 } as never); sol(x - 0.25, x + 0.25, z - 0.25, z + 0.25); };
  agac(245.6, 4.0); agac(255.3, 4.0, 0.9); agac(245.4, -0.2, 1.1); agac(250.4, -5.0, 1.2); agac(255.4, -1.2, 0.85);
  for (const x of [258, 264.5, 271, 277.6]) { b.box(1.0, 0.16, 1.0, TOPRAK, x + 3.3, 0.15, 4.4); agac(x + 3.3, 4.4, 0.8); }   // arsa önü kaldırım ağaçları (arsa sınırlarının arasında)
  for (const x of [248, 258.6, 269.4, 284.8]) { b.box(1.0, 0.16, 1.0, TOPRAK, x, 0.15, 13.9); }
  agac(258.6, 13.9, 0.75); agac(284.8, 13.9, 0.8);

  // ── güney arka: arsaların arkası çit + bahçe, sonra apartman sırası (z < -6.4) ──
  for (let x = 256.2; x < 283.4; x += 0.5) b.box(0.4, 1.1, 0.35, '#5f8f46', x, 0.7, -6.0);   // çit (ligustrum)
  sol(256.0, 283.4, -6.25, -5.75);
  const apt = (x: number, z: number, w: number, d: number, kat: number, renk: string, ry = 0, dukkan = -1) => {
    const H = kat * 2.9 + 0.6;
    b.at(x, 0, z, ry);
    b.box(w, H, d, renk, 0, H / 2, 0, { world: 2 } as never);
    b.box(w + 0.3, 0.25, d + 0.3, '#8f8a82', 0, H + 0.1, 0);                                  // saçak
    for (let k = 0; k < kat; k++) {
      const y = 0.6 + k * 2.9;
      if (k === 0 && dukkan >= 0) continue;
      const nw = Math.max(2, Math.floor(w / 2.2));
      for (let i = 0; i < nw; i++) { const u = -w / 2 + (i + 0.5) * w / nw; b.box(1.1, 1.3, 0.06, '#2b3f52', u, y + 1.35, d / 2 + 0.01); b.box(1.3, 0.1, 0.18, '#ece7dc', u, y + 0.68, d / 2 + 0.06); }
      if (k > 0) for (const u of [-w / 4, w / 4]) { b.box(w / 2 - 0.6, 0.12, 0.9, '#ece7dc', u, y + 0.05, d / 2 + 0.45); b.box(w / 2 - 0.6, 0.7, 0.04, '#5b6068', u, y + 0.45, d / 2 + 0.88); }   // balkonlar
    }
    // çatı: su deposu, uydu çanağı, baca
    b.cyl(0.5, 0.5, 1.1, '#dfe3e6', -w / 4, H + 0.8, -d / 4, { seg: 10 }); b.cyl(0.32, 0.05, 0.12, '#c9ced6', w / 4, H + 0.6, d / 4, { seg: 10, rx: -0.6 } as never); b.box(0.5, 1.0, 0.5, '#8a5a40', w / 3, H + 0.6, -d / 3);
    // giriş kapısı
    b.box(1.3, 2.2, 0.08, '#5a3b2a', dukkan >= 0 ? w / 2 - 1.0 : 0, 1.2, d / 2 + 0.02); b.box(1.6, 0.12, 0.9, '#ece7dc', dukkan >= 0 ? w / 2 - 1.0 : 0, 2.4, d / 2 + 0.45);
    b.pop();
    return H;
  };
  // arka plan apartmanları (yürünmez, mahallenin dışında)
  [[248, -12, 8, 9, 5, '#e8d6b8'], [257.4, -11.6, 8.6, 8, 6, '#d9c7a6'], [267, -12, 9, 9, 4, '#cfd8c4'], [276.6, -11.8, 8.4, 8.6, 5, '#e6c8b8'], [286, -12, 9, 9, 6, '#d6d3e0'], [295, -12, 7, 9, 4, '#e8d6b8'], [240, -12, 7, 9, 4, '#d9c7a6']]
    .forEach(([x, z, w, d, k, c]) => apt(x as number, z as number, w as number, d as number, k as number, c as string));
  // kuzey arka plan (kameranın arkası, alçak: görüşü kapatmasın)
  for (let x = 240; x < 298; x += 7.5) { b.box(7.0, 2.2, 5, ['#e0cfb0', '#d3c4a8', '#e6d8c0'][Math.round(x) % 3], x, 1.1, 27.6); b.box(7.2, 0.2, 5.2, '#a0552f', x, 2.3, 27.6); }

  // ── uçlar: köprü (yol altından çıkar) ve kapatan bloklar ──
  for (const s of [-1, 1]) {
    const ex = s < 0 ? X0 - 0.6 : X1 + 0.6, bx = s < 0 ? X0 - 4.6 : X1 + 4.6;
    b.box(8, 9, 12.6, '#d4c6aa', bx, 4.5, -0.5); b.box(8, 9, 10.6, '#cbbfa5', bx, 4.5, 19.2);                    // köşe blokları
    b.box(8, 1.3, YZ1 - YZ0 + 4.6, '#8f8a82', bx, 5.6, (YZ0 + YZ1) / 2); b.box(8, 0.5, YZ1 - YZ0 + 4.8, '#6b6862', bx, 6.5, (YZ0 + YZ1) / 2);   // köprü tabliyesi
    b.box(8, 4.95, YZ1 - YZ0 + 4.0, '#1d1f22', bx + s * 0.9, 2.47, (YZ0 + YZ1) / 2);                           // köprü altı karanlığı
    for (const z of [YZ0 - 1.9, YZ1 + 1.9]) b.box(0.8, 5.0, 0.8, '#b9b09a', ex + s * 0.4, 2.5, z);
    sol(Math.min(ex, bx - 4), Math.max(ex, bx + 4), -7, YZ0 - 1.2); sol(Math.min(ex, bx - 4), Math.max(ex, bx + 4), YZ1 + 1.2, 25);
  }
  sign(6, X0 + 2.6, 4.2, KN + 0.1, 3.0, 0.38);   // MARTI KONUTLARI tabelası (durak yanında, direkli)
  b.box(0.1, 4.0, 0.1, '#3a3d42', X0 + 1.0, 2.0, KN + 0.05); b.box(0.1, 4.0, 0.1, '#3a3d42', X0 + 4.2, 2.0, KN + 0.05);

  // ── kuzey sıra: alçak dükkânlar (kameraya yakın) ──
  const dukkan = (x0: number, x1: number, i: number, renk: string) => {
    const w = x1 - x0, cx = (x0 + x1) / 2, z0 = 15.2, d = 6.4, H = 3.3;
    b.box(w, H, d, renk, cx, H / 2, z0 + d / 2, { world: 2 } as never); b.box(w + 0.2, 0.22, d + 0.2, '#8f8a82', cx, H + 0.1, z0 + d / 2);
    b.box(w - 0.3, 0.04, d - 0.3, ['#9a6b4a', '#7d8a94', '#a5845e', '#8c7f73', '#6f8a6a'][i % 5], cx, H + 0.23, z0 + d / 2);   // çatı kaplaması
    for (const s2 of [-1, 1]) b.box(w + 0.2, 0.45, 0.14, renk, cx, H + 0.4, z0 + d / 2 + s2 * (d / 2 + 0.03));   // korkuluk duvarı
    b.box(0.9, 0.55, 0.7, '#dfe3e6', cx - w / 4, H + 0.5, z0 + d * 0.6); b.box(0.6, 0.06, 0.5, '#5b6068', cx - w / 4, H + 0.79, z0 + d * 0.6);   // klima dış ünitesi
    b.cyl(0.4, 0.4, 0.9, '#c9ced6', cx + w / 4, H + 0.65, z0 + d * 0.7, { seg: 10 });   // su deposu
    b.box(w - 1.6, 1.8, 0.06, '#2b3f52', cx - 0.5, 1.5, z0 - 0.01); b.box(0.9, 2.2, 0.06, '#3a2a20', x1 - 0.8, 1.1, z0 - 0.01);   // vitrin, kapı
    const n = Math.max(4, Math.round(w / 0.6)), sw = w / n;
    for (let k = 0; k < n; k++) b.box(sw, 0.06, 1.2, k % 2 ? '#fbfaf6' : TABELA[i].bg === '#ffffff' ? '#2f8a4a' : TABELA[i].bg, x0 + sw * (k + 0.5), 2.65, z0 - 0.55, { rx: -0.3 });   // tente
    sign(i, cx, 3.0, z0 - 0.04, Math.min(w - 0.6, 3.4), 0.42, Math.PI);
    sol(x0, x1, z0, z0 + d);
  };
  dukkan(245.0, 249.8, 0, '#efe1c4'); dukkan(250.2, 255.0, 1, '#e6d3b0'); dukkan(255.6, 260.2, 2, '#dfe6ec'); dukkan(260.6, 266.4, 3, '#f2ece2');
  dukkan(288.0, 291.8, 4, '#e8dcc0');
  // bakkal önü sergi, fırın önü ekmek sepeti, manav kasaları
  for (let i = 0; i < 3; i++) { b.box(0.8, 0.35, 0.5, '#b07a48', 246.0 + i * 0.9, 0.35, 14.6); b.sph(0.12, ['#e0533c', '#ffd23f', '#86b65e'][i], 246.0 + i * 0.9, 0.62, 14.6); }
  for (let i = 0; i < 4; i++) { b.box(0.7, 0.3, 0.5, '#8a6a4a', 288.6 + (i % 2) * 0.8, 0.3 + Math.floor(i / 2) * 0.32, 14.7); b.sph(0.18, ['#e0533c', '#f4a23a', '#7fb04a', '#ffd23f'][i], 288.6 + (i % 2) * 0.8, 0.5 + Math.floor(i / 2) * 0.32, 14.7, { ws: 6, hs: 4 } as never); }
  b.box(1.6, 0.9, 0.6, '#ffd23f', 252.6, 0.6, 14.7); b.box(1.5, 0.12, 0.5, '#d9a24a', 252.6, 1.1, 14.7);   // simit tablası
  sol(245.4, 249.0, 14.3, 15.2); sol(288.2, 290.4, 14.4, 15.2); sol(251.7, 253.5, 14.35, 15.2);

  // park etmiş arabalar yerine: kaldırım kenarı motosiklet ve bisiklet park yeri
  for (let i = 0; i < 4; i++) { b.box(0.04, 0.6, 0.04, '#9aa0a8', 266.6 + i * 0.5, 0.45, 13.0); }
  b.box(1.8, 0.04, 0.04, '#9aa0a8', 267.35, 0.75, 13.0);
}

/* ---------- belediye altyapı çalışması: hendek, boru, dubalar ---------- */
function altyapi(b: Batch, sign: (i: number, x: number, y: number, z: number, w: number, h: number, ry?: number) => void, solid: Rect[]) {
  const x0 = 283.6, x1 = 291.6, z0 = -5.4, z1 = 4.8;
  b.box(x1 - x0, 0.03, z1 - z0, '#a58a63', (x0 + x1) / 2, 0.16, (z0 + z1) / 2);
  b.box(1.2, 0.05, 7.0, '#3a2d22', 287.0, 0.17, -0.4); b.box(1.4, 0.4, 7.2, '#8a6a4a', 288.4, 0.3, -0.4);             // hendek + kazı yığını
  for (let i = 0; i < 3; i++) b.cyl(0.35, 0.35, 2.6, '#c9a24a', 290.2, 0.5 + (i % 2) * 0.62, -3.2 + i * 0.75 + (i > 1 ? -0.5 : 0), { rz: Math.PI / 2, seg: 12 });   // altyapı boruları
  cit(b, x0, z1, x1, z1, '#e8892b'); cit(b, x0, z0, x0, z1, '#e8892b');
  for (let x = x0 + 0.6; x < x1; x += 1.4) duba(b, x, z1 + 0.6);
  b.box(0.1, 2.4, 0.1, '#3a3d42', x0 + 1.2, 1.2, z1 + 0.25); b.box(0.1, 2.4, 0.1, '#3a3d42', x0 + 4.6, 1.2, z1 + 0.25);
  sign(7, x0 + 2.9, 2.0, z1 + 0.32, 3.2, 0.42, 0);
  solid.push({ x0: x0 - 0.1, x1, z0: z1 - 0.15, z1: z1 + 0.15 }, { x0: x0 - 0.15, x1: x0 + 0.15, z0, z1 });
}

export function createMahalle(d: MahalleDeps): MahalleView {
  const root = new T.Group(); root.name = 'mahalle'; root.visible = false; d.scene.add(root);
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const solid: Rect[] = [];
  let built = false, t = 0;
  const sites: { s: Santiye; p: () => number }[] = [];
  const swings: T.Object3D[] = [];
  const actors: Actor[] = [];
  const cars: { g: T.Object3D; lane: number; x: number; v: number }[] = [];

  function make() {
    built = true;
    const b = new Batch(), sb = new Batch(), tx = atlas();
    const sm = new T.MeshBasicMaterial({ map: tx }); mats.push(sm); const n = TABELA.length;
    const sign = (i: number, x: number, y: number, z: number, w: number, h: number, ry = 0) => {
      const g = new T.PlaneGeometry(w, h), uv = g.attributes.uv as T.BufferAttribute, v0 = 1 - (i + 1) / n, v1 = 1 - i / n;
      for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) > 0.5 ? v1 : v0);
      const m = new T.Mesh(g, sm); m.position.set(x, y, z); m.rotation.y = ry; geos.push(g); root.add(m);
      sb.box(w + 0.12, h + 0.12, 0.06, '#3a3d42', x, y, z + (ry ? 0.04 : -0.04));
    };
    build(b, sign, solid); altyapi(b, sign, solid);
    for (const bb of [b, sb]) { const m = bb.mesh(solidMat(), true, true); geos.push(m.geometry); root.add(m); }
    // salıncak koltukları (hareketli)
    for (const z of [-3.9, -2.9]) { const g = new T.Group(); g.position.set(247.1, 2.2, z); const sbb = new Batch(); sbb.box(0.02, 1.6, 0.02, '#9aa0a8', -0.25, -0.8, 0); sbb.box(0.02, 1.6, 0.02, '#9aa0a8', 0.25, -0.8, 0); sbb.box(0.6, 0.05, 0.3, '#ffd23f', 0, -1.62, 0); const m = sbb.mesh(solidMat()); geos.push(m.geometry); g.add(m); root.add(g); swings.push(g); }
    // inşaat halindeki apartman (kuzey, x 267.4..280): alt iki kat karkası bitmiş, üçüncü kat örülüyor; mobil vinç ve kamyon sokakta değil sahada
    {
      const kb = new Batch(), cx = 271.6, cz = 19.6, w = 7.4, dd = 5.6;
      for (let k = 0; k < 2; k++) { const y = k * 3.0; for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) kb.box(0.3, 3.0, 0.3, '#8d8a83', cx + sx * (w / 2 - 0.15), y + 1.5, cz + sz * (dd / 2 - 0.15)); kb.box(w, 0.25, dd, '#a9a59c', cx, y + 3.0, cz); }
      for (let i = 0; i < 10; i++) kb.box(w - 0.5, 0.24, 0.18, i % 2 ? '#b5532f' : '#9c4428', cx, 0.12 + i * 0.25, cz - dd / 2 + 0.2);   // zemin kat arka duvar örülü
      for (let i = 0; i < 6; i++) kb.box(0.18, 0.24, dd - 0.5, i % 2 ? '#b5532f' : '#9c4428', cx - w / 2 + 0.2, 3.12 + i * 0.25, cz);
      const m = kb.mesh(solidMat()); geos.push(m.geometry); root.add(m);
      const ust = santiyeKur({ w, d: dd, plan: { ...SETLER.orta, betoniyer: false, elArabasi: false, merdiven: false, cit: false, toz: 6 }, kabuk: { w, d: dd, h: 2.9, cati: 'duz', duvar: '#efe1c4', ustKat: true }, iskeleYer: 'yok', cit: false, serit: false });
      ust.g.position.set(cx, 6.12, cz); root.add(ust.g); sites.push({ s: ust, p: () => 0.5 + 0.12 * Math.sin(t * 0.02) });
      const alt = santiyeKur({ w: 12.4, d: 7.6, plan: { ...SETLER.buyuk, konteyner: false, kamyon: false, toz: 14 }, iskeleYer: 'on', cit: false, serit: false, yer: { vinc: { x: -4.4, z: -0.4, ry: 0 } }, pano: { baslik: 'MARTI APARTMANI', alt: 'Yapı Ruhsatı No: 2026/42 · Dalgakıran Yapı' } });
      alt.g.position.set(273.6, 0.14, 19.4); alt.g.rotation.y = Math.PI; root.add(alt.g); sites.push({ s: alt, p: () => 0.55 });
      const ccx = 273.6, ccz = 19.4; cit(sb, 267.2, 15.0, 270.6, 15.0, '#2f6fb3'); cit(sb, 272.6, 15.0, 280.0, 15.0, '#2f6fb3'); cit(sb, 267.2, 15.0, 267.2, 23.8, '#2f6fb3'); cit(sb, 280.0, 15.0, 280.0, 23.8, '#2f6fb3');
      const m2 = sb.mesh(solidMat()); geos.push(m2.geometry); root.add(m2);
      solid.push({ x0: 267.0, x1: 270.6, z0: 14.85, z1: 15.15 }, { x0: 272.6, x1: 280.2, z0: 14.85, z1: 15.15 }, { x0: 267.0, x1: 267.4, z0: 15, z1: 23.8 }, { x0: 279.8, x1: 280.2, z0: 15, z1: 23.8 }, { x0: cx - w / 2, x1: cx + w / 2, z0: cz - dd / 2, z1: cz + dd / 2 });
      void ccx; void ccz;
    }
    // belediye altyapı sahası: betoniyer, el arabası, jeneratör (kit), çöp kamyonu park
    { const s = santiyeKur({ w: 4.0, d: 6.0, plan: { ...SETLER.orta, cit: false, toz: 10 }, iskeleYer: 'yok', cit: false, serit: false }); s.g.position.set(288.0, 0.14, -1.2); root.add(s.g); sites.push({ s, p: () => 0.5 }); }
    loadGlb('auto/garbage-truck').then(src => { if (!src) return; const g = fitClone(src, 2.3, 6.0, undefined, 0); g.position.set(285.0, 0.14, 1.0); g.rotation.y = 0.1; root.add(g); });
    solid.push({ x0: 283.8, x1: 286.2, z0: -2.0, z1: 4.0 });
    // cadde trafiği: iki şerit, karşılıklı; arabalar köprü altından girip çıkar
    const CARS = ['sedan', 'taxi', 'hatchback-sports', 'van', 'suv', 'delivery'];
    for (let i = 0; i < 5; i++) {
      const lane = i % 2, g = new T.Group(); root.add(g);
      const body = new Batch(); body.box(4.0, 0.6, 1.6, ['#3f7fd0', '#ffd23f', '#e0533c', '#f4f2ec', '#2f9d59'][i], 0, 0.64, 0); body.box(2.0, 0.55, 1.45, ['#3f7fd0', '#ffd23f', '#e0533c', '#f4f2ec', '#2f9d59'][i], -0.2, 1.2, 0); const bm = body.mesh(solidMat()); geos.push(bm.geometry); g.add(bm);
      loadGlb('auto/' + CARS[i % CARS.length]).then(src => { if (!src) return; g.clear(); g.add(fitClone(src, 1.6, 4.0, undefined, Math.PI / 2)); });
      cars.push({ g, lane, x: X0 - 6 + i * 13, v: lane ? -6.5 : 7.0 });
    }
    d.setSolid?.(solid);
    life();
  }

  /* ---------- yaşam ---------- */
  function life() {
    if (!d.chars) return;
    const holder = root;
    const mk = (type: string, seed: number, over: Record<string, unknown> = {}): H | null => {
      try { const look = (d.chars as unknown as { v2: { randomLook(t: string, r: unknown): Record<string, unknown> } }).v2.randomLook(type, K.rng(seed)); const h = d.chars!.makeHero({ ...look, ...over, seg: NPC_SEG } as never) as unknown as H; holder.add(h.object); h.object.visible = true; return h; } catch { return null; }
    };
    const add = (h: H | null, x: number, z: number, o: Partial<Actor> = {}) => { if (!h) return null; const a: Actor = { h, x, z, yaw: 0, speed: 0, act: 'idle', pi: 0, wait: 0, sp: 1.1, y: 0.14, loop: true, ...o }; actors.push(a); h.setPose({ x, z }, a.yaw); h.object.position.y = a.y; return a; };
    const BELEDIYE = { top: '#ff7a1a', topStyle: 'overall', sleeves: 'long', bottom: '#2f3a4a', hat: 'cap', hatColor: '#ff7a1a', gloves: '#f2d24a' };
    const USTA = { top: '#e8892b', topStyle: 'overall', sleeves: 'long', bottom: '#e8892b', hat: 'helmet', hatColor: '#ffd23f', gloves: '#c9a24a' };
    // kaldırımlarda yürüyenler (iki yön), biri yaya geçidinden karşıya geçer
    const SK: [number, number][] = [[X0 + 1, 6.6], [X1 - 1, 6.6]], NK: [number, number][] = [[X0 + 1, 12.4], [X1 - 1, 12.4]];
    const TIP = ['teyze', 'emekli', 'universiteli', 'plaza', 'isinsani', 'bebekarabali', 'gezgin', 'teyze'];
    for (let i = 0; i < 8; i++) { const r = i % 2 ? SK : NK, rr = i % 4 < 2 ? r : r.slice().reverse() as [number, number][]; const k = (i * 0.137) % 1; add(mk(TIP[i], 900 + i), rr[0][0] + (rr[1][0] - rr[0][0]) * k, rr[0][1], { path: rr, pi: 0, sp: 0.9 + (i % 3) * 0.2, waitP: 0.25 }); }
    add(mk('universiteli', 920), 252.6, 12.4, { path: [[252.6, 12.4], [252.6, 6.6], [256, 6.6], [256, 12.4]], sp: 1.1, waitP: 0.5 });
    add(mk('teyze', 921), 283.0, 6.6, { path: [[283.0, 6.6], [281.6, 6.6], [281.6, 12.4], [288.6, 12.4], [288.6, 14.0], [288.6, 12.4], [283.0, 12.4], [281.6, 12.4], [281.6, 6.6]], sp: 0.85, waitP: 0.4 });   // manava gidip gelen teyze
    // bisikletli çocuklar: parkın çevresinde ve kaldırımda tur
    const bisiklet = (renk: string) => { const g = new T.Group(); const bb = new Batch(); for (const z of [0.5, -0.5]) { bb.cyl(0.3, 0.3, 0.05, '#1f2023', 0, 0.3, z, { rz: Math.PI / 2, seg: 14 }); bb.cyl(0.08, 0.08, 0.06, '#c9ced6', 0, 0.3, z, { rz: Math.PI / 2, seg: 8 }); } bb.box(0.05, 0.05, 1.0, renk, 0, 0.55, 0); bb.box(0.05, 0.4, 0.05, renk, 0, 0.5, -0.25, { rx: 0.2 }); bb.box(0.05, 0.45, 0.05, renk, 0, 0.6, 0.42, { rx: -0.25 }); bb.box(0.42, 0.04, 0.04, '#222', 0, 0.85, 0.48); bb.box(0.14, 0.05, 0.24, '#222', 0, 0.74, -0.26); const m = bb.mesh(solidMat()); geos.push(m.geometry); g.add(m); return g; };
    const tur1: [number, number][] = [[249.6, 5.2], [256.6, 5.2], [256.6, 6.8], [244.6, 6.8], [244.6, 5.2]];
    const tur2: [number, number][] = [[258, 6.9], [282, 6.9], [282, 6.3], [258, 6.3]];
    [[tur1, '#e0533c', 1.0], [tur2, '#3f7fd0', 0], [tur1, '#2fb5b0', 0.5]].forEach(([r, c, k], i) => {
      const h = mk('okul', 940 + i); if (!h) return; const bk = bisiklet(c as string); h.object.add(bk); bk.position.set(0, -0.55, 0);
      const p = r as [number, number][]; add(h, p[0][0], p[0][1], { path: p, pi: Math.floor((k as number) * (p.length - 1)), sp: 2.6 + i * 0.3, act: 'sit', y: 0.7, ride: bk, waitP: 0 });
    });
    // parkta top oynayan çocuklar (top aralarında gider gelir), salıncakta biri, kum havuzunda biri
    const top = new T.Mesh(new T.SphereGeometry(0.14, 12, 10), new T.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.5 })); geos.push(top.geometry); mats.push(top.material as T.Material); root.add(top);
    const oyuncu: Actor[] = [];
    for (let i = 0; i < 3; i++) { const a = add(mk('okul', 960 + i), 251 + i * 1.5, -3.6 + (i % 2) * 1.4, { sp: 2.8 }); if (a) oyuncu.push(a); }
    let topA = 0, topB = 1, topK = 0;
    if (oyuncu.length >= 2) oyuncu[0].tick = (_a, dt) => {
      topK += dt / 1.1; const A = oyuncu[topA], B = oyuncu[topB];
      if (topK >= 1) { topK = 0; topA = topB; topB = (topB + 1 + Math.floor(Math.random() * (oyuncu.length - 1))) % oyuncu.length; if (topB === topA) topB = (topA + 1) % oyuncu.length; const nb = oyuncu[topB]; nb.path = [[249.8 + Math.random() * 4.2, -4.4 + Math.random() * 3.6]]; nb.pi = -1; }
      top.position.set(A.x + (B.x - A.x) * topK, 0.3 + Math.sin(topK * Math.PI) * 0.6, A.z + (B.z - A.z) * topK);
      A.yaw = Math.atan2(B.x - A.x, B.z - A.z);
    };
    add(mk('okul', 970), 247.1, -3.9, { act: 'sit', y: 0.68, tick: (a, _dt, tt) => { const sw = swings[0]; if (!sw) return; const ang = Math.sin(tt * 2.2) * 0.45; sw.rotation.z = 0; sw.rotation.x = ang; a.x = 247.1; a.z = -3.9 + Math.sin(ang) * 1.6; a.y = 2.2 - Math.cos(ang) * 1.6 + 0.12; a.yaw = 0; } });
    add(mk('okul', 971), 246.6, 2.3, { act: 'sweep', yaw: Math.PI });
    add(mk('teyze', 972), 249.0, 1.0, { act: 'sit', y: 0.6, yaw: Math.PI }); add(mk('emekli', 973), 251.6, 1.0, { act: 'sit', y: 0.6, yaw: Math.PI });
    // esnaf kapıda
    add(mk('emekli', 980, { apron: '#fbfaf6' }), 248.4, 14.5, { act: 'perform', yaw: Math.PI }); add(mk('isinsani', 981, { apron: '#d9a24a', hat: 'paper' }), 253.6, 14.4, { act: 'pour', yaw: Math.PI });
    add(mk('teyze', 982, { apron: '#2f8a4a' }), 290.8, 14.5, { act: 'perform', yaw: Math.PI });
    // belediye çalışanları: süpürgeci kaldırımda, bahçıvan parkta, iki kişi hendekte; şantiyede ustalar
    add(mk('emekli', 990, BELEDIYE), X0 + 6, 6.2, { path: [[X0 + 6, 6.2], [X1 - 8, 6.2]], act: 'sweep', sp: 0.45, waitP: 0.6 });
    add(mk('isinsani', 991, BELEDIYE), 252.0, 3.2, { path: [[252.0, 3.2], [247.5, 0.2], [252.5, -1.4]], act: 'pour', sp: 0.7, waitP: 0.9 });
    add(mk('universiteli', 992, BELEDIYE), 287.0, 1.2, { act: 'cut', yaw: -Math.PI / 2 }); add(mk('isinsani', 993, BELEDIYE), 288.6, -2.8, { path: [[288.6, -2.8], [289.6, -3.0], [288.6, 2.0]], act: 'sweep', sp: 0.8, waitP: 0.8 });
    add(mk('emekli', 994, { ...BELEDIYE, hat: 'helmet', hatColor: '#ffffff' }), 284.0, 5.6, { act: 'perform', yaw: 0 });   // trafiği yöneten
    add(mk('isinsani', 995, USTA), 270.0, 16.0, { path: [[270.0, 16.0], [276.0, 16.0], [276.6, 22.8]], act: 'cut', sp: 1.0, waitP: 0.8 });
    add(mk('universiteli', 996, USTA), 275.6, 22.6, { act: 'sweep', yaw: Math.PI });
    add(mk('emekli', 997, { ...USTA, hatColor: '#ffffff' }), 271.4, 15.6, { path: [[271.4, 15.6], [268.2, 16.2], [268.2, 22.8], [271.4, 15.6]], sp: 0.7, waitP: 0.7 });   // şantiye şefi
  }
  function stepActors(dt: number) {
    for (const a of actors) {
      if (a.tick) a.tick(a, dt, t);
      if (a.path && a.path.length) {
        if (a.wait > 0) { a.wait -= dt; a.speed = 0; }
        else {
          const ni = a.pi < 0 ? 0 : (a.pi + 1) % a.path.length, [tx, tz] = a.path[ni], dd = Math.hypot(tx - a.x, tz - a.z);
          if (dd < 0.15) { if (a.path.length === 1) { a.path = undefined; a.speed = 0; } else { a.pi = ni; a.wait = (a.waitMin || 0) + (Math.random() < (a.waitP ?? 0.3) ? 1 + Math.random() * 3 : 0); } }
          else { const k = Math.min(1, a.sp * dt / dd); a.yaw = Math.atan2(tx - a.x, tz - a.z); a.x += (tx - a.x) * k; a.z += (tz - a.z) * k; a.speed = a.sp; }
        }
      }
      a.h.setPose({ x: a.x, z: a.z }, a.yaw); a.h.object.position.y = a.y;
      const moving = a.speed > 0.05 && !a.ride;
      a.h.setInput({ speed: moving ? a.speed : 0, act: moving ? 'idle' : a.ride ? 'sit' : a.speed > 0.05 && a.act !== 'sweep' ? 'idle' : a.act }); a.h.update(dt, 1);
    }
  }

  /* arsa ustaları: her süren yapımda 3 usta (gerçek yürüyen karakter): malzemeden alır, duvara/kalıba gider, çekiç ya da mala sallar */
  const arsaUsta = new Map<string, Actor[]>(); let arsaT = 0;
  const USTA_LOOK = { top: '#e8892b', topStyle: 'overall', sleeves: 'long', bottom: '#e8892b', hat: 'helmet', hatColor: '#ffd23f', gloves: '#c9a24a' };
  function syncArsa() {
    if (!d.chars || !d.insaatlar) return;
    const want = d.insaatlar(), ids = new Set(want.map(w => w.id));
    for (const [id, list] of arsaUsta) if (!ids.has(id)) { for (const a of list) { a.h.object.removeFromParent(); const i = actors.indexOf(a); if (i >= 0) actors.splice(i, 1); } arsaUsta.delete(id); }
    for (const w of want) {
      if (arsaUsta.has(w.id)) continue;
      const s = w.rotY ? -1 : 1, W = (u: number, v: number): [number, number] => [w.x + s * u, w.z + s * v], list: Actor[] = [];
      const plans: { pts: [number, number][]; act: string }[] = [
        { pts: [W(-2.5, 1.9), W(-1.5, 1.85), W(-2.5, 1.9), W(-2.55, -0.3)], act: 'cut' },
        { pts: [W(2.4, -1.6), W(1.3, 1.85), W(2.5, 0.6)], act: 'sweep' },
        { pts: [W(-0.6, 1.9), W(2.55, -0.9), W(-2.55, 1.0)], act: 'cut' },
      ];
      plans.forEach((pl, i) => {
        try {
          const look = (d.chars as unknown as { v2: { randomLook(t: string, r: unknown): Record<string, unknown> } }).v2.randomLook(['isinsani', 'universiteli', 'emekli'][i], K.rng(1300 + w.id.charCodeAt(1) * 7 + i));
          const h = d.chars!.makeHero({ ...look, ...USTA_LOOK, seg: NPC_SEG, ...(i === 2 ? { hatColor: '#ffffff' } : {}) } as never) as unknown as H; root.add(h.object);
          const a: Actor = { h, x: pl.pts[0][0], z: pl.pts[0][1], yaw: 0, speed: 0, act: pl.act, path: pl.pts, pi: 0, wait: i * 1.3, sp: 1.0, y: 0.14, waitP: 1, waitMin: 3 };
          actors.push(a); list.push(a);
        } catch { /* */ }
      });
      arsaUsta.set(w.id, list);
    }
  }

  let inside = false;
  return {
    update(dt) {
      const p = d.hero(), on = p.x > X0 - 30 && p.x < X1 + 30;
      if (on !== inside) { inside = on; root.visible = on; }
      if (!on) return;
      if (!built) make();
      dt = Math.min(dt, 0.1); t += dt;
      for (const s of sites) s.s.update(dt, s.p(), d.night());
      for (let i = 0; i < swings.length; i++) if (i > 0) swings[i].rotation.x = Math.sin(t * 1.7 + 1) * 0.15;
      for (const c of cars) {
        c.x += c.v * dt; const span = X1 - X0 + 16; if (c.v > 0 && c.x > X1 + 8) c.x -= span; if (c.v < 0 && c.x < X0 - 8) c.x += span;
        c.g.position.set(c.x, 0.04, c.lane ? 10.4 : 8.6); c.g.rotation.y = c.v > 0 ? 0 : Math.PI;
      }
      if ((arsaT -= dt) <= 0) { arsaT = 1; syncArsa(); }
      stepActors(dt);
    },
    dispose() { root.removeFromParent(); for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const s of sites) s.s.dispose(); },
  };
}
