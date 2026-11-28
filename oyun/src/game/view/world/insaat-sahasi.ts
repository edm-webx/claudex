/**
 * Kilitli inşaat sahaları (2026-11-21): iskele promenadının iki ucunda belediye şantiyesi, "burası zamanla açılacak" diye okunur.
 * Veri content/kilitli-bolge.ts'den: çit hattı, promenad üstündeki saha, denize yapılan toprak dolgu, makineler, projektörler.
 * - promenadı kesen pano çit (belediye panoları, kapı) + önünde New Jersey bariyerleri, dubalar, flaşörler
 * - yol tarafında proje tabelası (mahalle adı, yüklenici, absürt "bitiş tarihi"), denize dolgu ve kenarında kaya tahkimatı
 * - makineler canlı: ekskavatör kazar, döner, kamyona boşaltır (kasadaki toprak büyür); yükleyici tesviye yapar;
 *   silindir gidip gelir; mikserin tamburu döner; betoniyer döner; tepe lambaları yanıp söner
 * - gece: projektör başlıkları ve tabela parlar, ışık hüzmesi görünür; asıl ışık gece ışık havuzuna lamba olarak girer
 *   (lambalar() -> night-lights addSource), yeni PointLight açılmaz
 * İşçiler burada çizilmez: sim/agents/belediye.ts'de gerçek actor'lar. Çarpışma boot'ta (bolgeEngelleri).
 * Mobil bütçe: statik her şey taraf başına tek vertex-renkli mesh + tek etiket mesh'i; animasyon yalnız oyuncu yakınken.
 */
import * as T from 'three';
import { Batch } from '../../../engine/prefab/batch';
import { KILITLI_BOLGELER, bolgeKilitli, bolgeEngelleri, PROM_Z0, PROM_Z1, type KilitliBolge, type UZ } from '../../../content/kilitli-bolge';

export interface InsaatSahasiDeps {
  root: () => T.Object3D | null;
  night: () => number;
  hero: () => { x: number; z: number };
  state: () => unknown;
  setSolid?: (r: { x0: number; x1: number; z0: number; z1: number }[]) => void;
}
export interface InsaatSahasiView { update(dt: number): void; dispose(): void; lambalar(): { x: number; y: number; z: number; color: string; i: number }[]; acik(): string[] }

const YEL = '#f2b705', DARK = '#2e3034', STEEL = '#8d949c', GLASS = '#22323d', DIRT = '#8a6a4a', DIRT_D = '#6f553b', RED = '#d8332b', WHITE = '#f1efe9', BLUE = '#1f4e8c';

let solid: T.MeshLambertMaterial | null = null;
const solidMat = () => solid || (solid = new T.MeshLambertMaterial({ vertexColors: true }));

/* ---------------- textures: one shared atlas for both sites ---------------- */
const AT = 1024;
const R = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => [x0 / AT, 1 - y1 / AT, x1 / AT, 1 - y0 / AT];
const RECT = { tabelaDogu: R(0, 0, 1024, 384), tabelaBati: R(0, 384, 1024, 768), panoA: R(0, 768, 512, 1024), panoB: R(512, 768, 1024, 1024) };
let atlas: T.CanvasTexture | null = null;
const FONT = 'system-ui,"Segoe UI",sans-serif';

function logo(g: CanvasRenderingContext2D, x: number, y: number, r: number, bg: string, fg: string) {
  g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = fg; g.lineWidth = r * 0.16; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - r * 0.6, y); g.quadraticCurveTo(x - r * 0.3, y - r * 0.45, x, y); g.quadraticCurveTo(x + r * 0.3, y - r * 0.45, x + r * 0.6, y); g.stroke();   // martı
  g.lineWidth = r * 0.08; g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.4); g.quadraticCurveTo(x, y + r * 0.2, x + r * 0.55, y + r * 0.4); g.stroke();             // dalga
}
function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#ffd23f'; g.fillRect(x, y, w, h); g.fillStyle = '#1c1f24';
  for (let k = x - h; k < x + w + h; k += h * 1.4) { g.beginPath(); g.moveTo(k, y + h); g.lineTo(k + h * 0.7, y + h); g.lineTo(k + h * 1.4, y); g.lineTo(k + h * 0.7, y); g.fill(); }
  g.restore();
}
function tabela(g: CanvasRenderingContext2D, y0: number, b: { mahalle: string; yuklenici: string; basla: string; bitis: string; bedel: string }) {
  const W = 1024, H = 384;
  g.fillStyle = '#fbfaf6'; g.fillRect(0, y0, W, H);
  g.fillStyle = BLUE; g.fillRect(0, y0, W, 74);
  logo(g, 44, y0 + 37, 28, '#ffffff', BLUE);
  g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.font = `900 40px ${FONT}`; g.fillText('MARTIKÖY BELEDİYESİ', 86, y0 + 39, 560);
  g.textAlign = 'right'; g.font = `700 22px ${FONT}`; g.fillText('FEN İŞLERİ MÜDÜRLÜĞÜ', W - 22, y0 + 39, 330);
  g.textAlign = 'left'; g.fillStyle = BLUE; g.font = `900 46px ${FONT}`; g.fillText(b.mahalle.toLocaleUpperCase('tr'), 26, y0 + 112, 600);
  g.fillStyle = '#4a4f57'; g.font = `600 21px ${FONT}`; g.fillText('İskele genişletme ve yeni mahalle altyapı çalışması', 28, y0 + 150, 600);
  const rows: [string, string][] = [['Yüklenici', b.yuklenici], ['İşe başlama', b.basla], ['İş bitimi', b.bitis], ['Proje bedeli', b.bedel]];
  rows.forEach(([k, v], i) => {
    const y = y0 + 192 + i * 38;
    g.fillStyle = '#e9eef5'; g.fillRect(26, y - 16, 590, 32);
    g.fillStyle = BLUE; g.font = `800 19px ${FONT}`; g.fillText(k, 36, y + 1, 150);
    g.fillStyle = '#1d2128'; g.font = `600 19px ${FONT}`; g.fillText(v, 186, y + 1, 420);
  });
  // gelecekteki mahallenin "çizimi"
  const px = 640, py = y0 + 92, pw = 360, ph = 230;
  const sky = g.createLinearGradient(0, py, 0, py + ph); sky.addColorStop(0, '#9fd3f0'); sky.addColorStop(1, '#e3f3fb'); g.fillStyle = sky; g.fillRect(px, py, pw, ph);
  g.fillStyle = '#3f8fbf'; g.fillRect(px, py + ph - 40, pw, 40);
  g.fillStyle = '#d9cdb6'; g.fillRect(px, py + ph - 56, pw, 18);
  const ev = ['#e8cfae', '#f2a2b3', '#9cc3d6', '#f0d35a', '#cfe0d4', '#e0533c', '#d9c3d6'];
  for (let i = 0; i < 7; i++) {
    const w = 44 + (i % 3) * 6, h = 70 + ((i * 37) % 60), x = px + 10 + i * 50, y = py + ph - 56 - h;
    g.fillStyle = ev[i]; g.fillRect(x, y, w, h); g.fillStyle = '#b5654a'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + w / 2, y - 18); g.lineTo(x + w + 4, y); g.fill();
    g.fillStyle = '#ffffff'; for (let r = 0; r < Math.floor(h / 22); r++) for (let c = 0; c < 2; c++) g.fillRect(x + 8 + c * (w / 2 - 2), y + 8 + r * 22, 10, 12);
  }
  g.fillStyle = '#5f9e48'; for (const tx of [px + 30, px + 190, px + 330]) { g.beginPath(); g.arc(tx, py + ph - 66, 12, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#2b2b2b'; g.lineWidth = 3; g.beginPath(); g.moveTo(px + 250, py + 40); g.quadraticCurveTo(px + 262, py + 30, px + 274, py + 40); g.quadraticCurveTo(px + 286, py + 30, px + 298, py + 40); g.stroke();
  g.strokeStyle = BLUE; g.lineWidth = 4; g.strokeRect(px, py, pw, ph);
  g.fillStyle = BLUE; g.font = `800 16px ${FONT}`; g.textAlign = 'center'; g.fillText('TEMSİLİ GÖRSELDİR (MARTILAR DAHİL)', px + pw / 2, py + ph + 14, pw);
  hazard(g, 0, y0 + H - 22, W, 22);
  g.fillStyle = '#1c1f24'; g.fillRect(0, y0 + H - 50, W, 28);
  g.fillStyle = '#ffd23f'; g.font = `800 18px ${FONT}`; g.textAlign = 'center'; g.fillText('Rahatsızlık için özür dileriz. Martıköy büyüyor, mahalle geliyor!', W / 2, y0 + H - 35, W - 40);
}
function getAtlas(): T.CanvasTexture {
  if (atlas) return atlas;
  const c = document.createElement('canvas'); c.width = AT; c.height = AT; const g = c.getContext('2d')!;
  tabela(g, 0, { mahalle: 'Doğu Yakası Mahallesi', yuklenici: KILITLI_BOLGELER[0].yuklenici, basla: 'Martılar sabah ezanıyla kalkınca', bitis: 'İskele büyüyünce (inşallah)', bedel: '3 simit + 1 çay (KDV dahil)' });
  tabela(g, 384, { mahalle: 'Batı Yakası Mahallesi', yuklenici: KILITLI_BOLGELER[1].yuklenici, basla: 'Lodos dinince', bitis: 'İskele büyüyünce, söz', bedel: '2 poğaça + 1 ayran (pazarlıkla)' });
  // pano A: belediye panosu
  g.fillStyle = BLUE; g.fillRect(0, 768, 512, 256); logo(g, 70, 768 + 74, 46, '#ffffff', BLUE);
  g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `900 34px ${FONT}`; g.fillText('MARTIKÖY', 134, 768 + 56, 360); g.fillText('BELEDİYESİ', 134, 768 + 96, 360);
  g.fillStyle = '#ffd23f'; g.font = `900 30px ${FONT}`; g.textAlign = 'center'; g.fillText('BURADA ÇALIŞMA VAR', 256, 768 + 160, 480);
  g.fillStyle = '#d6e2f2'; g.font = `600 20px ${FONT}`; g.fillText('Martıköy\'ü birlikte büyütüyoruz', 256, 768 + 200, 480);
  g.fillStyle = '#ffffff'; g.fillRect(0, 768 + 236, 512, 6);
  // pano B: geçiş yok
  hazard(g, 512, 768, 512, 256); g.fillStyle = '#ffd23f'; g.fillRect(512 + 18, 768 + 18, 512 - 36, 256 - 36);
  g.fillStyle = '#1c1f24'; g.font = `900 58px ${FONT}`; g.fillText('GEÇİŞ YOKTUR', 768, 768 + 82, 460);
  g.font = `800 25px ${FONT}`; g.fillText('İskele büyüyünce burası mahalle olacak', 768, 768 + 140, 450);
  g.font = `600 21px ${FONT}`; g.fillText('Anlayışınız için teşekkür ederiz', 768, 768 + 186, 450);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; atlas = t; return t;
}
let glowTex: T.CanvasTexture | null = null;
function getGlow(): T.CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,236,190,1)'); gr.addColorStop(0.45, 'rgba(255,220,160,0.35)'); gr.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); glowTex = new T.CanvasTexture(c); glowTex.colorSpace = T.SRGBColorSpace; return glowTex;
}

/* ---------------- deterministic noise for rocks / mounds ---------------- */
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/* ---------------- machines ---------------- */
interface Ekskavator { ust: T.Group; bom: T.Group; kol: T.Group; kova: T.Group; yuk: T.Mesh; aPile: number; aTruck: number }
interface Kamyon { yigin: T.Mesh; govde: T.Group }
interface Gezen { g: T.Group; a: T.Vector3; b: T.Vector3; kol: T.Group | null; teker: T.Object3D[]; tip: 'yukleyici' | 'silindir' }
interface Site {
  b: KilitliBolge; g: T.Group; ex: Ekskavator | null; kamyon: Kamyon | null; gezen: Gezen | null; tamburlar: T.Object3D[];
  flasor: T.MeshBasicMaterial[]; tepe: T.MeshBasicMaterial[]; lamba: T.MeshLambertMaterial; huzme: T.Mesh[]; parilti: T.Mesh[]; etiket: T.MeshLambertMaterial;
  cx: number; cz: number; dolum: number; t: number;
}

const k01 = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => v * v * (3 - 2 * v);
const lerpA = (a: number, b: number, t: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

/** lathe yüzeyine yapışık spiral şerit (lathe-yerel: eksen y). Eski düz kutular uçlarda yüzeyden dışarı çubuk gibi taşıyordu. */
function helis(b: Batch, prof: [number, number][], faz: number, tur: number, y0: number, y1: number, w: number, n = 24) {
  const rAt = (y: number) => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][1]) { const [ra, ya] = prof[i - 1], [rb, yb] = prof[i]; return ra + (rb - ra) * (y - ya) / (yb - ya); } return prof[prof.length - 1][0]; };
  const P = (k: number) => { const y = y0 + (y1 - y0) * k / n, a = faz + y * tur, r = rAt(y) + 0.012; return new T.Vector3(r * Math.cos(a), y, r * Math.sin(a)); };
  const geo = new T.BoxGeometry(1, 1, 1), m = new T.Matrix4(), X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3();
  for (let k = 0; k < n; k++) {
    const p0 = P(k), p1 = P(k + 1), mid = p0.clone().add(p1).multiplyScalar(0.5), len = p0.distanceTo(p1) + 0.02;
    Z.subVectors(p1, p0).normalize(); Y.set(mid.x, 0, mid.z).normalize(); X.crossVectors(Y, Z).normalize(); Y.crossVectors(Z, X);
    m.makeBasis(X.multiplyScalar(w), Y.multiplyScalar(0.025), Z.multiplyScalar(len)).setPosition(mid); b.add(geo, '#f6efe1', m);
  }
}

function wheels(b: Batch, xs: number, zs: number[], r: number, w: number, y = r) {
  for (const z of zs) for (const s of [-1, 1]) { b.cyl(r, r, w, '#1f2023', s * xs, y, z, { rz: Math.PI / 2, seg: 12 }); b.cyl(r * 0.5, r * 0.5, w + 0.02, '#9aa0a8', s * xs, y, z, { rz: Math.PI / 2, seg: 8 }); }
}

function ekskavator(site: Site, u: UZ, pile: { x: number; z: number }, kasa: { x: number; z: number }): T.Group {
  const s = site.b.taraf, g = new T.Group(); g.position.set(s * u.u, 0.04, u.z);
  const alt = new Batch();
  for (const sx of [-1, 1]) {
    alt.box(0.72, 0.78, 3.7, '#26272a', sx * 1.08, 0.39, 0, { r: 0.18 } as never);
    alt.box(0.74, 0.3, 3.0, '#44474c', sx * 1.08, 0.42, 0);
    for (let k = 0; k < 5; k++) alt.cyl(0.13, 0.13, 0.76, '#5b6068', sx * 1.08, 0.2, -1.3 + k * 0.65, { rz: Math.PI / 2, seg: 8 });
  }
  alt.box(1.5, 0.45, 2.2, '#34363a', 0, 0.6, 0); alt.cyl(0.95, 0.95, 0.18, '#34363a', 0, 0.9, 0, { seg: 16 });
  g.add(alt.mesh(solidMat()));
  const ust = new T.Group(); ust.position.y = 0.99; g.add(ust);
  const ub = new Batch();
  ub.box(2.3, 0.95, 2.5, YEL, 0, 0.48, -0.25); ub.box(2.32, 0.85, 0.7, DARK, 0, 0.44, -1.7);
  ub.box(1.25, 0.32, 1.3, YEL, 0.5, 1.1, -0.85); ub.box(0.6, 0.06, 0.9, '#3a3c40', 0.5, 1.28, -0.85);
  ub.cyl(0.06, 0.06, 0.7, '#3a3c40', 0.85, 1.55, -1.2, { seg: 6 });
  ub.box(0.98, 1.45, 1.15, YEL, -0.62, 1.68, 0.45); ub.box(1.02, 1.0, 1.0, GLASS, -0.62, 1.82, 0.5); ub.box(1.04, 0.08, 1.2, YEL, -0.62, 2.43, 0.45);
  ub.box(0.06, 0.06, 1.2, '#e0e0e0', 0.12, 2.0, 0.4); ub.box(0.06, 0.6, 0.06, '#e0e0e0', 0.12, 1.7, 0.95);
  ust.add(ub.mesh(solidMat()));
  const tepe = new T.MeshBasicMaterial({ color: '#ff9a1a' }); site.tepe.push(tepe);
  const tm = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.18, 8), tepe); tm.position.set(-0.62, 2.56, 0.2); ust.add(tm);
  const bom = new T.Group(); bom.position.set(0.25, 1.05, 0.95); ust.add(bom);
  const bb = new Batch(); bb.box(0.42, 0.55, 3.5, YEL, 0, 0, 1.75); bb.box(0.15, 0.15, 2.1, '#c9ced6', 0, -0.42, 1.0); bb.box(0.46, 0.2, 0.5, DARK, 0, 0.32, 0.4);
  bom.add(bb.mesh(solidMat()));
  const kol = new T.Group(); kol.position.set(0, 0, 3.5); bom.add(kol);
  const kb = new Batch(); kb.box(0.34, 0.42, 2.4, YEL, 0, 0, 1.2); kb.box(0.12, 0.12, 1.6, '#c9ced6', 0, 0.34, 0.8); kol.add(kb.mesh(solidMat()));
  const kova = new T.Group(); kova.position.set(0, 0, 2.4); kol.add(kova);
  const vb = new Batch(); vb.box(0.95, 0.6, 0.12, DARK, 0, -0.3, 0.55); vb.box(0.95, 0.12, 0.62, DARK, 0, -0.58, 0.28); vb.box(0.08, 0.6, 0.62, DARK, -0.45, -0.3, 0.28); vb.box(0.08, 0.6, 0.62, DARK, 0.45, -0.3, 0.28);
  for (let k = 0; k < 4; k++) vb.box(0.09, 0.1, 0.18, '#9aa0a8', -0.33 + k * 0.22, -0.62, 0.62);
  kova.add(vb.mesh(solidMat()));
  const yuk = new T.Mesh(new T.IcosahedronGeometry(0.34, 0), new T.MeshLambertMaterial({ color: DIRT })); yuk.scale.set(1.2, 0.7, 1); yuk.position.set(0, -0.3, 0.3); yuk.visible = false; kova.add(yuk);
  const wx = s * u.u, wz = u.z;
  site.ex = { ust, bom, kol, kova, yuk, aPile: Math.atan2(pile.x - wx, pile.z - wz), aTruck: Math.atan2(kasa.x - wx, kasa.z - wz) };
  return g;
}

function kamyon(site: Site, u: UZ, yon: number, tip: 'damperli' | 'mikser', rob: Batch): T.Group {
  const s = site.b.taraf, g = new T.Group(); g.position.set(s * u.u, 0.04, u.z); g.rotation.y = s * yon * Math.PI / 2;
  const b = new Batch(), kab = tip === 'mikser' ? '#e9e6dc' : '#c0392b';
  b.box(1.9, 0.35, 6.3, '#2b2c30', 0, 0.75, -0.3);                                  // şasi
  b.box(2.3, 1.45, 1.5, kab, 0, 1.6, 2.15, { r: 0.12 } as never); b.box(2.32, 0.7, 0.06, GLASS, 0, 1.95, 2.92); b.box(0.06, 0.6, 0.9, GLASS, 1.16, 1.95, 2.1); b.box(0.06, 0.6, 0.9, GLASS, -1.16, 1.95, 2.1);
  b.box(2.3, 0.3, 0.25, '#3a3c40', 0, 0.75, 2.95); b.box(0.5, 0.18, 0.06, '#fff3c4', 0.75, 1.0, 3.0); b.box(0.5, 0.18, 0.06, '#fff3c4', -0.75, 1.0, 3.0);
  b.box(2.36, 0.3, 0.2, '#1c1f24', 0, 2.42, 2.15);
  wheels(b, 1.0, [2.0, -1.2, -2.5], 0.52, 0.42);
  if (tip === 'damperli') {
    b.box(2.4, 0.12, 4.4, '#d9822b', 0, 1.18, -1.0);
    b.box(0.1, 1.15, 4.4, '#d9822b', 1.15, 1.8, -1.0); b.box(0.1, 1.15, 4.4, '#d9822b', -1.15, 1.8, -1.0);
    b.box(2.4, 1.15, 0.1, '#d9822b', 0, 1.8, 1.17); b.box(2.4, 1.15, 0.1, '#c46f20', 0, 1.8, -3.17);
    for (let k = 0; k < 4; k++) { b.box(0.06, 1.15, 0.12, '#b3601b', 1.21, 1.8, -2.8 + k * 1.2); b.box(0.06, 1.15, 0.12, '#b3601b', -1.21, 1.8, -2.8 + k * 1.2); }
    g.add(b.mesh(solidMat()));
    const yigin = new T.Mesh(new T.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshLambertMaterial({ color: DIRT })); yigin.position.set(0, 1.24, -1.0); yigin.scale.set(1.05, 0.15, 2.0); g.add(yigin);
    site.kamyon = { yigin, govde: g };
  } else {
    b.box(1.0, 0.8, 0.6, '#5b6068', 0, 1.3, 1.1); b.box(0.5, 0.12, 1.6, '#9aa0a8', 0, 2.3, -3.6, { rx: 0.5 });
    g.add(b.mesh(solidMat()));
    // tambur: ağzı arkada (oluğun üstünde) ve arka yukarı kalkık; kapalı uç kabine bakar
    const tambur = new T.Group(); tambur.position.set(0, 2.15, -1.2); tambur.rotation.x = 0.22; g.add(tambur);
    const prof: [number, number][] = [[0.05, -2.2], [0.75, -1.8], [1.15, -0.7], [1.15, 0.6], [0.6, 1.9], [0.35, 2.1]];
    const tb = new Batch(); tb.lathe(prof, '#e8892b', 0, 0, 0, { seg: 16, rx: -Math.PI / 2 } as never);
    tb.cyl(0.34, 0.34, 0.02, '#2a2622', 0, 0, -2.08, { rx: Math.PI / 2, seg: 16 });       // ağız içi koyu (açık uçtan arkası görünmesin)
    tb.push(new T.Matrix4().makeRotationX(-Math.PI / 2)); for (const f of [0, Math.PI]) helis(tb, prof, f, 1.7, -1.95, 1.85, 0.11); tb.pop();   // yüzeye yapışık spiral şerit
    tambur.add(tb.mesh(solidMat())); tambur.userData.eksen = 'z'; site.tamburlar.push(tambur);
  }
  void rob;
  return g;
}

function gezen(site: Site, tip: 'yukleyici' | 'silindir'): T.Group {
  const s = site.b.taraf, h = site.b.hat, g = new T.Group();
  const a = new T.Vector3(s * h.a.u, 0.04, h.a.z), bb = new T.Vector3(s * h.b.u, 0.04, h.b.z);
  g.position.copy(bb); g.rotation.y = Math.atan2(a.x - bb.x, a.z - bb.z);   // burnu yığına (a) dönük
  const b = new Batch(); const teker: T.Object3D[] = []; let kol: T.Group | null = null;
  if (tip === 'yukleyici') {
    b.box(1.9, 0.9, 3.0, YEL, 0, 1.05, -0.5); b.box(1.6, 0.5, 1.2, DARK, 0, 1.3, -1.9); b.box(1.2, 1.4, 1.2, YEL, 0, 2.15, -0.3); b.box(1.24, 1.0, 1.04, GLASS, 0, 2.3, -0.3); b.box(1.3, 0.08, 1.3, YEL, 0, 2.88, -0.3);
    g.add(b.mesh(solidMat()));
    for (const z of [0.9, -1.5]) { const w = new Batch(); for (const sx of [-1, 1]) { w.cyl(0.62, 0.62, 0.5, '#1f2023', sx * 1.05, 0, 0, { rz: Math.PI / 2, seg: 12 }); w.cyl(0.3, 0.3, 0.52, YEL, sx * 1.05, 0, 0, { rz: Math.PI / 2, seg: 8 }); } const m = w.mesh(solidMat()); m.position.set(0, 0.62, z); g.add(m); teker.push(m); }
    kol = new T.Group(); kol.position.set(0, 1.5, 0.6); g.add(kol);
    const kb = new Batch(); for (const sx of [-0.7, 0.7]) kb.box(0.2, 0.3, 2.0, YEL, sx, 0, 1.0); kb.box(2.2, 0.75, 0.12, DARK, 0, -0.1, 2.15); kb.box(2.2, 0.12, 0.8, DARK, 0, -0.45, 1.8); kb.box(2.24, 0.06, 0.06, '#9aa0a8', 0, -0.5, 2.2);
    kol.add(kb.mesh(solidMat()));
  } else {
    b.box(1.7, 0.8, 1.8, YEL, 0, 1.0, -0.9); b.box(1.1, 1.3, 1.0, YEL, 0, 2.0, -1.0); b.box(1.14, 0.9, 0.9, GLASS, 0, 2.1, -1.0); b.box(1.3, 0.08, 1.3, DARK, 0, 2.7, -1.0);
    b.box(2.2, 0.16, 1.5, YEL, 0, 1.55, 1.1); for (const sx of [-1, 1]) b.box(0.14, 0.9, 1.4, YEL, sx * 1.05, 1.05, 1.1);
    g.add(b.mesh(solidMat()));
    const d = new Batch(); d.cyl(0.68, 0.68, 1.9, '#5b6068', 0, 0, 0, { rz: Math.PI / 2, seg: 16 }); for (let k = 0; k < 8; k++) d.box(1.92, 0.04, 0.12, '#44474c', 0, Math.cos(k * Math.PI / 4) * 0.68, Math.sin(k * Math.PI / 4) * 0.68, { rx: k * Math.PI / 4 });
    const dm = d.mesh(solidMat()); dm.position.set(0, 0.7, 1.1); g.add(dm); teker.push(dm);
    const w = new Batch(); for (const sx of [-1, 1]) w.cyl(0.6, 0.6, 0.45, '#1f2023', sx * 0.85, 0, 0, { rz: Math.PI / 2, seg: 12 }); const wm = w.mesh(solidMat()); wm.position.set(0, 0.6, -1.0); g.add(wm); teker.push(wm);
  }
  const tepe = new T.MeshBasicMaterial({ color: '#ff9a1a' }); site.tepe.push(tepe);
  const tm = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.18, 8), tepe); tm.position.set(0, tip === 'yukleyici' ? 3.0 : 2.83, tip === 'yukleyici' ? -0.3 : -1.0); g.add(tm);
  site.gezen = { g, a, b: bb, kol, teker, tip };
  return g;
}

/* ---------------- static set dressing ---------------- */
function statik(site: Site, b: Batch, L: Batch) {
  const S = site.b, s = S.taraf, X = (u: number) => s * u, RY = (r: number) => s * r;
  const box = (w: number, h: number, d: number, c: string, u: number, y: number, z: number, ry = 0) => b.box(w, h, d, c, X(u), y, z, { ry: RY(ry) });
  const { dolgu: D, saha: SA } = S;
  // --- denize toprak dolgu: gövde, üst yüzey, kenarda kaya tahkimatı, yığınlar, palet izleri
  const du = (D.u0 + D.u1) / 2, dz = (D.z0 + D.z1) / 2, dw = D.u1 - D.u0, dd = D.z1 - D.z0;
  box(dw, 1.5, dd, DIRT_D, du, -0.72, dz); box(dw - 0.3, 0.06, dd - 0.3, DIRT, du, 0.02, dz + 0.15);
  let n = 1 + (s > 0 ? 0 : 500);
  const kaya = (u: number, z: number) => { const r = 0.38 + hash(n++) * 0.4; b.ico(r, hash(n++) > 0.5 ? '#8e9196' : '#a3a6aa', X(u), -0.25 + hash(n++) * 0.35, z, { d: 0, sy: 0.75, ry: hash(n++) * 6 } as never); };
  for (let u = D.u0 + 0.3; u < D.u1; u += 0.85) { kaya(u, D.z0 - 0.15); if (hash(n++) > 0.5) kaya(u + 0.4, D.z0 + 0.35); }
  for (let z = D.z0 + 0.6; z < D.z1 - 0.2; z += 0.85) { kaya(D.u0 - 0.15, z); if (hash(n++) > 0.5) kaya(D.u0 + 0.35, z + 0.4); }
  const tepe = (u: number, z: number, r: number, h: number, c: string) => b.sph(1, c, X(u), 0, z, { sx: r, sy: h, sz: r * 0.85, ws: 12, hs: 6 } as never);
  tepe(S.yigin.u, S.yigin.z, 2.4, 1.7, DIRT); tepe(S.yigin.u - 1.9, S.yigin.z - 0.6, 1.3, 0.9, '#957454');
  if (S.makineler.some(m => m.tip === 'yukleyici')) tepe(S.hat.a.u, S.hat.a.z - 2.0, 2.2, 1.2, '#a49c90');   // mıcır yığını
  for (let k = 0; k < 6; k++) box(0.5, 0.02, dd - 2, DIRT_D, D.u0 + 4 + k * 4.4 + (k % 2) * 0.7, 0.06, dz, 0.08 * (k % 3 - 1));
  // --- kalıp (temel): kontrplak kenar + filizler
  box(4.5, 0.55, 0.08, '#c8955a', 40.25, 0.3, -0.2); box(4.5, 0.55, 0.08, '#c8955a', 40.25, 0.3, 2.6); box(0.08, 0.55, 2.8, '#c8955a', 38.0, 0.3, 1.2); box(0.08, 0.55, 2.8, '#c8955a', 42.5, 0.3, 1.2);
  box(4.4, 0.08, 2.7, '#a39e94', 40.25, 0.1, 1.2);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) box(0.04, 1.1, 0.04, '#7a4a2e', 38.5 + i * 0.95, 0.65, 0.3 + j * 0.9);
  // beton borular
  for (let k = 0; k < 3; k++) { const u = (s > 0 ? 52.6 : 48.0) + k * 1.35, z = -6.7; b.cyl(0.6, 0.6, 2.0, '#b7b2a8', X(u), 0.62, z, { rx: Math.PI / 2, seg: 14 }); b.cyl(0.45, 0.45, 2.02, '#4a4741', X(u), 0.62, z, { rx: Math.PI / 2, seg: 12 }); }
  // --- promenad üstündeki saha zemini (çamurlu toprak), deniz duvarı korkuluğu yerine toprak rampa
  box(SA.u1 - SA.u0, 0.04, SA.z1 - SA.z0 - 0.2, '#9b8466', (SA.u0 + SA.u1) / 2, 0.02, (SA.z0 + SA.z1) / 2 + 0.1);
  box(SA.u1 - SA.u0, 0.3, 1.2, DIRT, (SA.u0 + SA.u1) / 2, -0.1, 4.4);
  // şantiye şefliği: iki katlı konteyner, dış merdiven, üst kat korkuluğu
  const ku = 62.4, kz0 = 5.4, kz1 = 11.6, kl = kz1 - kz0, kzm = (kz0 + kz1) / 2;
  for (let f = 0; f < 2; f++) {
    const y = 0.08 + f * 2.62;
    box(2.45, 2.55, kl, '#eef1f3', ku, y + 1.28, kzm);
    for (const zz of [kz0 + 0.06, kz1 - 0.06]) box(2.5, 2.6, 0.14, '#2d5d9b', ku, y + 1.3, zz);
    box(2.5, 0.14, kl, '#2d5d9b', ku, y + 0.07, kzm); for (const e of [-1.18, 1.18]) box(0.14, 0.14, kl, '#2d5d9b', ku + e, y + 2.54, kzm);
    for (let r = 0; r < 6; r++) box(2.3, 0.03, 0.08, '#d5dade', ku, y + 2.56, kz0 + 0.5 + r * (kl - 1) / 5);
    for (const zz of [kz0 + 1.3, kzm + 0.9, kz1 - 1.1]) { box(0.06, 0.95, 1.1, GLASS, ku - 1.25, y + 1.55, zz); box(0.1, 0.08, 1.2, '#2d5d9b', ku - 1.27, y + 1.04, zz); }
    box(0.06, 2.0, 0.9, '#8d949c', ku - 1.25, y + 1.05, kzm - 0.9);
  }
  box(1.0, 0.08, kl, '#8d949c', ku - 1.75, 2.62, kzm); for (let z = kz0; z <= kz1 + 0.01; z += kl / 4) box(0.05, 1.0, 0.05, '#ffd23f', ku - 2.22, 3.12, z); box(0.05, 0.05, kl, '#ffd23f', ku - 2.22, 3.6, kzm);
  for (let i = 0; i < 12; i++) box(0.9, 0.06, 0.28, '#8d949c', ku - 1.75, 0.2 + i * 0.205, kz1 - 0.2 - i * 0.24);
  // seyyar WC, çay ocağı (masa + tabure + çaydanlık), varil, el arabası
  box(1.15, 2.25, 1.15, '#2b6fb8', 59.6, 1.2, 12.4); box(1.25, 0.12, 1.25, '#5b9be0', 59.6, 2.36, 12.4); box(0.06, 1.8, 0.8, '#f1efe9', 59.0, 1.1, 12.4);
  box(0.8, 0.05, 0.8, '#f1efe9', 59.6, 0.72, 9.4); for (const [a, c] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) box(0.04, 0.7, 0.04, '#d9d2bd', 59.6 + a, 0.36, 9.4 + c);
  for (const [a, c] of [[-0.7, 0], [0, 0.75]]) { b.cyl(0.18, 0.2, 0.42, '#e0533c', X(59.6 + a), 0.22, 9.4 + c, { seg: 10 }); }
  b.cyl(0.11, 0.13, 0.22, '#c9ced6', X(59.55), 0.86, 9.35, { seg: 10 }); b.cyl(0.08, 0.1, 0.16, '#c9ced6', X(59.55), 1.03, 9.35, { seg: 10 });
  for (const [u, z, c] of [[61.0, 12.6, '#2b6fb8'], [61.6, 12.7, RED], [61.3, 12.0, '#2b6fb8']] as [number, number, string][]) b.cyl(0.3, 0.3, 0.9, c, X(u), 0.5, z, { seg: 12 });
  box(0.6, 0.35, 0.9, '#2d8a4a', 58.6, 0.5, 6.4, 0.6); b.cyl(0.2, 0.2, 0.08, '#1f2023', X(58.6) + s * 0.35, 0.2, 6.9, { rz: Math.PI / 2, seg: 10 });
  // kum yığını, tuğla paletleri, çimento torbaları, inşaat demiri
  tepe(57.2, 6.0, 1.4, 0.9, '#d9b77a');
  for (let k = 0; k < 3; k++) { const u = 54.6 + k * 1.25; box(1.1, 0.14, 1.0, '#a8794e', u, 0.09, 11.4); box(1.0, 0.8, 0.9, '#b5532f', u, 0.56, 11.4); for (let r = 0; r < 4; r++) box(1.02, 0.02, 0.92, '#d9c3a6', u, 0.26 + r * 0.2, 11.4); }
  box(1.1, 0.14, 1.0, '#a8794e', 58.4, 0.09, 10.3); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) box(0.5, 0.17, 0.85, '#d6d0c2', 58.15 + c * 0.52, 0.25 + r * 0.17, 10.3, (r % 2) * 0.08);
  for (const z of [12.45, 12.95]) box(0.2, 0.14, 0.9, '#a8794e', 53.8, 0.08, 12.7), box(0.2, 0.14, 0.9, '#a8794e', 57.8, 0.08, 12.7), void z;
  for (let k = 0; k < 9; k++) b.cyl(0.035, 0.035, 5.0, '#7a4a2e', X(55.8), 0.2 + (k % 3) * 0.07, 12.45 + Math.floor(k / 3) * 0.12 + (k % 3) * 0.03, { rz: Math.PI / 2, seg: 5 });
  // betoniyer gövdesi (tambur ayrı, döner)
  box(1.2, 0.12, 0.9, '#5b6068', 55.0, 0.45, 7.0); for (const [a, c] of [[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]]) box(0.06, 0.45, 0.06, '#5b6068', 55.0 + a, 0.22, 7.0 + c);
  // --- çitler: promenadı kesen pano çit (kapı ile), yol tarafı pano çit, uçta arka çit
  const H = 2.35, cu = S.citU, kz = S.kapiZ, kw = 3.0;
  const panoHat = (z0: number, z1: number) => { const len = z1 - z0; box(0.08, H, len, '#e8e6e0', cu, H / 2 + 0.05, (z0 + z1) / 2); box(0.1, 0.12, len, RED, cu, H + 0.08, (z0 + z1) / 2); box(0.1, 0.1, len, '#5b6068', cu, 0.08, (z0 + z1) / 2); for (let z = z0; z <= z1 + 0.01; z += len / Math.max(1, Math.round(len / 2.2))) box(0.12, H + 0.15, 0.12, '#5b6068', cu - 0.02, (H + 0.15) / 2, z); };
  panoHat(PROM_Z0, kz - kw / 2); panoHat(kz + kw / 2, PROM_Z1 + 0.1);
  for (const side of [-1, 1]) {   // kapı kanatları: çerçeve + tel
    const zc = kz + side * kw / 4;
    box(0.08, 2.1, kw / 2 - 0.08, '#5b6068', cu, 1.1, zc); for (let i = 0; i < 9; i++) box(0.03, 1.9, 0.03, '#9aa0a8', cu - 0.02, 1.1, zc - kw / 4 + 0.15 + i * (kw / 2 - 0.3) / 8);
  }
  box(0.04, 2.0, kw - 0.2, '#b9c0c8', cu + 0.02, 1.1, kz);
  for (const z of [kz - kw / 2, kz + kw / 2]) box(0.18, 2.6, 0.18, '#3a3d42', cu, 1.3, z);
  L.label(3.3, 1.65, RECT.panoA, X(cu - 0.06), 1.28, (PROM_Z0 + kz - kw / 2) / 2, { ry: RY(-Math.PI / 2) });
  L.label(2.3, 1.15, RECT.panoB, X(cu - 0.06), 1.28, (kz + kw / 2 + PROM_Z1) / 2, { ry: RY(-Math.PI / 2) });
  // yol tarafı: panolar + proje tabelası
  const ZR = PROM_Z1 + 0.12;
  box(SA.u1 - cu, H, 0.08, '#e8e6e0', (cu + SA.u1) / 2, H / 2 + 0.05, ZR); box(SA.u1 - cu, 0.12, 0.1, RED, (cu + SA.u1) / 2, H + 0.08, ZR);
  for (let u = cu; u <= SA.u1 + 0.01; u += 2.2) box(0.12, H + 0.15, 0.12, '#5b6068', u, (H + 0.15) / 2, ZR - 0.02);
  for (const u of [cu + 1.9, cu + 11.4]) L.label(3.3, 1.65, RECT.panoA, X(u), 1.28, ZR + 0.06, {});
  const tu = cu + 5.0;
  // tabela çitin üstünde arkaya yaslı (kamera yukarıdan bakar: yüzü gökyüzüne ve yola dönük), arkasında payandalar
  const TW = 7.4, TH = 2.78, LEAN = 0.95, ty = 2.45 + (TH / 2) * Math.cos(LEAN), tz = ZR - (TH / 2) * Math.sin(LEAN);
  for (const d of [-3.2, 3.2]) { box(0.16, 2.6, 0.16, '#3a3d42', tu + d, 1.3, ZR + 0.12); box(0.12, 0.12, 2.9, '#3a3d42', tu + d, ty - 0.35, tz - 0.35, 0); b.box(0.12, 3.3, 0.12, '#3a3d42', X(tu + d), 1.65, ZR - 2.1, { rx: -0.6 }); }
  b.box(TW + 0.25, TH + 0.25, 0.1, '#1f4e8c', X(tu), ty - 0.09 * Math.sin(LEAN), tz - 0.09 * Math.cos(LEAN), { rx: -LEAN });   // arkada, yüzey normali boyunca
  L.label(TW, TH, s > 0 ? RECT.tabelaDogu : RECT.tabelaBati, X(tu), ty, tz, { rx: -LEAN });
  // denize bakan uçta arka çit (haritanın ucu)
  box(0.08, H, SA.z1 - SA.z0, '#e8e6e0', SA.u1, H / 2, (SA.z0 + SA.z1) / 2);
  // --- çitin önü: New Jersey bariyerleri, dubalar, "geçiş yok" sehpası
  const bu = S.bariyerU + 0.55;
  for (let z = PROM_Z0 + 0.7; z < PROM_Z1 - 0.3; z += 2.05) {
    const c = Math.round((z - PROM_Z0) / 2.05) % 2 ? RED : WHITE;
    b.box(0.62, 0.32, 1.95, c, X(bu), 0.16, z); b.box(0.36, 0.5, 1.95, c, X(bu), 0.55, z); b.box(0.26, 0.1, 1.95, c, X(bu), 0.85, z);
  }
  for (const z of [5.2, 7.4, 11.3, 12.8]) { b.cone(0.22, 0.7, '#ff7a1a', X(S.bariyerU - 0.2), 0.36, z, { seg: 10 }); b.cyl(0.2, 0.2, 0.08, '#f6efe1', X(S.bariyerU - 0.2), 0.42, z, { seg: 10 }); b.box(0.42, 0.04, 0.42, '#1f2023', X(S.bariyerU - 0.2), 0.02, z); }
  b.box(0.05, 0.9, 0.05, '#5b6068', X(S.bariyerU - 0.25), 0.45, kz - 0.7); b.box(0.05, 0.9, 0.05, '#5b6068', X(S.bariyerU - 0.25), 0.45, kz + 0.7);
  L.at(X(S.bariyerU - 0.4), 0, kz, RY(-Math.PI / 2)); L.label(1.6, 0.8, RECT.panoB, 0, 1.0, 0, { rx: -0.75 }); L.pop();
  b.at(X(S.bariyerU - 0.4), 0, kz, RY(-Math.PI / 2)); b.box(1.7, 0.9, 0.06, '#3a3d42', 0, 1.0, -0.04, { rx: -0.75 }); b.pop();
  // --- projektör kuleleri (direk + jeneratör + başlık çerçevesi; lambalar ayrı mesh)
  for (const p of S.projektor) {
    box(1.4, 0.9, 0.9, YEL, p.u + 0.9, 0.5, p.z, 0); box(1.42, 0.12, 0.92, DARK, p.u + 0.9, 0.98, p.z);
    b.cyl(0.07, 0.11, 6.6, '#9aa0a8', X(p.u), 3.3, p.z, { seg: 8 });
    box(1.6, 0.08, 0.1, '#5b6068', p.u, 6.55, p.z);
  }
}

/** 2026-11-25 (sahibi: "inşaatın projeksiyonları yanlış duruyor"): projektör başlığı gökyüzüne bakıyordu, hüzme kuleden 3.5 m kopuktu.
 *  Artık her kule sahaya nişan alır: başlık yüzü hedefe döner, hüzme konisinin tepesi başlıkta, tabanı hedefte, parıltı hedefte. */
function projHedef(s: number, p: { u: number; z: number }) {
  const yol = p.z > 8, L = new T.Vector3(s * p.u, 6.85, p.z), H = new T.Vector3(s * (p.u + (yol ? -4 : 3)), 0, p.z + (yol ? -7 : -4.5));
  const d = H.clone().sub(L), yaw = Math.atan2(d.x, d.z), pitch = Math.atan2(-d.y, Math.hypot(d.x, d.z));
  return { L, H, d, q: new T.Quaternion().setFromEuler(new T.Euler(pitch, yaw, 0, 'YXZ')) };
}
function lambaKafa(site: Site): T.Mesh {
  const S = site.b, s = S.taraf, b = new Batch();
  for (const p of S.projektor) {
    const { L, q } = projHedef(s, p);
    for (const d of [-0.55, 0.55]) { b.push(new T.Matrix4().compose(L, q, new T.Vector3(1, 1, 1))); b.box(0.5, 0.36, 0.14, '#ffffff', d, 0, 0.05); b.pop(); }
  }
  return b.mesh(site.lamba, false, false);
}

function build(b: KilitliBolge): Site {
  const g = new T.Group(); g.name = 'kilitli-' + b.id;
  const s = b.taraf;
  const site: Site = {
    b, g, ex: null, kamyon: null, gezen: null, tamburlar: [], flasor: [], tepe: [], huzme: [], parilti: [],
    lamba: new T.MeshLambertMaterial({ color: '#fff4d6', emissive: new T.Color('#ffe2a8'), emissiveIntensity: 0.15 }),
    etiket: new T.MeshLambertMaterial({ map: getAtlas(), emissive: new T.Color('#ffffff'), emissiveIntensity: 0.05 }),
    cx: s * (b.saha.u0 + 6), cz: 2, dolum: 0, t: 0,
  };
  site.etiket.emissiveMap = site.etiket.map;
  const st = new Batch(), lb = new Batch();
  statik(site, st, lb);
  g.add(st.mesh(solidMat()));
  const lm = lb.mesh(site.etiket, false, false); g.add(lm);
  // makineler
  const ex = b.makineler.find(m => m.tip === 'ekskavator'), dm = b.makineler.find(m => m.tip === 'damperli');
  if (dm) g.add(kamyon(site, dm, dm.yon, 'damperli', st));
  const kasa = dm ? { x: s * (dm.u - dm.yon * 0.9), z: dm.z } : { x: s * ex!.u, z: ex!.z + 4 };
  if (ex) g.add(ekskavator(site, ex, { x: s * b.yigin.u, z: b.yigin.z }, kasa));
  for (const m of b.makineler) {
    if (m.tip === 'mikser') g.add(kamyon(site, m, m.yon, 'mikser', st));
    else if (m.tip === 'yukleyici' || m.tip === 'silindir') g.add(gezen(site, m.tip));
  }
  // betoniyer tamburu
  const bt = new T.Group(); bt.position.set(s * 55.0, 1.05, 7.0); bt.rotation.z = s * 0.5;
  const tb = new Batch(); tb.lathe([[0.05, -0.55], [0.42, -0.4], [0.5, 0.0], [0.42, 0.35], [0.22, 0.55]], '#e8892b', 0, 0, 0, { seg: 14 }); helis(tb, [[0.05, -0.55], [0.42, -0.4], [0.5, 0.0], [0.42, 0.35], [0.22, 0.55]], 0, 3.5, -0.42, 0.45, 0.06);
  bt.add(tb.mesh(solidMat())); g.add(bt); site.tamburlar.push(bt);
  // flaşörler (bariyer üstü + kapı)
  for (const z of [PROM_Z0 + 0.7, b.kapiZ - 1.6, b.kapiZ + 1.6, PROM_Z1 - 0.5]) {
    const m = new T.MeshBasicMaterial({ color: '#ffb02e' }); site.flasor.push(m);
    const o = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), m); o.position.set(s * (b.bariyerU + 0.55), 1.0, z); g.add(o);
  }
  // projektör başlıkları, ışık hüzmesi, yer parıltısı (gece)
  g.add(lambaKafa(site));
  const huzmeMat = new T.MeshBasicMaterial({ color: '#ffe7b8', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
  const glowMat = new T.MeshBasicMaterial({ map: getGlow(), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending });
  for (const p of b.projektor) {
    const { L, H, d } = projHedef(s, p), len = d.length();
    const cone = new T.ConeGeometry(2.6, len, 18, 1, true); cone.translate(0, -len / 2, 0);   // tepe başlıkta, taban hedefte
    const hz = new T.Mesh(cone, huzmeMat); hz.position.copy(L); hz.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), d.clone().normalize()); hz.visible = false; g.add(hz); site.huzme.push(hz);
    const gl = new T.Mesh(new T.PlaneGeometry(9, 9), glowMat); gl.rotation.x = -Math.PI / 2; gl.position.set(H.x, 0.09, H.z); gl.visible = false; g.add(gl); site.parilti.push(gl);
  }
  return site;
}

function drop(site: Site) {
  site.g.removeFromParent();
  site.g.traverse(o => { const m = o as T.Mesh; if (!m.isMesh) return; m.geometry?.dispose(); const mt = m.material as T.Material; if (mt && mt !== solid) mt.dispose(); });
}

/* ---------------- animation ---------------- */
const EX_T = 10;
const EX_KEYS: [number, number, number, number, number][] = [   // t, bom, kol, kova, dönüş(0 yığın,1 kamyon)
  [0, 0.12, 0.7, 0.5, 0], [2.2, 0.2, 1.55, 1.9, 0], [3.6, -0.55, 1.3, 1.9, 0], [5.6, -0.6, 1.2, 1.9, 1], [6.6, -0.5, 0.75, 0.15, 1], [7.6, -0.5, 0.75, 0.15, 1], [9.2, -0.25, 0.8, 0.4, 0], [10, 0.12, 0.7, 0.5, 0],
];
function exPose(t: number): [number, number, number, number] {
  for (let i = 1; i < EX_KEYS.length; i++) if (t <= EX_KEYS[i][0]) {
    const a = EX_KEYS[i - 1], c = EX_KEYS[i], k = ease((t - a[0]) / (c[0] - a[0]));
    return [a[1] + (c[1] - a[1]) * k, a[2] + (c[2] - a[2]) * k, a[3] + (c[3] - a[3]) * k, a[4] + (c[4] - a[4]) * k];
  }
  return [EX_KEYS[0][1], EX_KEYS[0][2], EX_KEYS[0][3], 0];
}

function animate(site: Site, dt: number, night: number) {
  site.t += dt; const t = site.t;
  const ex = site.ex;
  if (ex) {
    const prev = (t - dt) % EX_T, ph = t % EX_T, [bo, ko, kv, sw] = exPose(ph);
    ex.ust.rotation.y = lerpA(ex.aPile, ex.aTruck, sw); ex.bom.rotation.x = bo; ex.kol.rotation.x = ko; ex.kova.rotation.x = kv;
    ex.yuk.visible = ph > 2.0 && ph < 6.5;
    if (prev < 6.6 && ph >= 6.6 && site.kamyon) site.dolum = (site.dolum + 1) % 6;   // kasaya boşalttı: yığın büyür, dolunca boşalıp yeniden
  }
  if (site.kamyon) { const y = site.kamyon.yigin; const want = 0.15 + site.dolum * 0.14; y.scale.y += (want - y.scale.y) * Math.min(1, dt * 3); site.kamyon.govde.position.y = 0.04 + Math.sin(t * 31) * 0.006; }
  for (const tb of site.tamburlar) if (tb.userData.eksen === 'z') tb.children[0].rotateZ(dt * 0.9); else tb.rotateY(dt * 0.9);
  const gz = site.gezen;
  if (gz) {
    const C = gz.tip === 'yukleyici' ? 12 : 14, ph = t % C, half = C / 2, ileri = ph < half, k = ease(k01(((ileri ? ph : ph - half) - 0.8) / (half - 1.6)));
    const from = ileri ? gz.b : gz.a, to = ileri ? gz.a : gz.b, x0 = gz.g.position.x, z0 = gz.g.position.z;
    gz.g.position.x = from.x + (to.x - from.x) * k; gz.g.position.z = from.z + (to.z - from.z) * k;
    const d = Math.hypot(gz.g.position.x - x0, gz.g.position.z - z0) * (ileri ? 1 : -1);
    for (const w of gz.teker) w.rotation.x += d / 0.62;
    if (gz.kol) gz.kol.rotation.x = ileri ? 0.32 : -0.25;   // ileri giderken kova yerde (tesviye), geri gelirken kalkık
  }
  const on = Math.sin(t * 6.5) > 0, on2 = Math.sin(t * 9 + 1.3) > 0.2;
  site.flasor.forEach((m, i) => m.color.set((i % 2 ? on : !on) ? '#ffcf5a' : '#5a3d10'));
  site.tepe.forEach(m => m.color.set(on2 ? '#ffa63a' : '#6a3a10'));
  const n = night;
  site.lamba.emissiveIntensity = 0.15 + n * 2.2; site.etiket.emissiveIntensity = 0.05 + n * 0.55;
  const vis = n > 0.08;
  for (const h of site.huzme) { h.visible = vis; (h.material as T.MeshBasicMaterial).opacity = 0.075 * n; }
  for (const p of site.parilti) { p.visible = vis; (p.material as T.MeshBasicMaterial).opacity = 0.55 * n; }
}

export function createInsaatSahasi(d: InsaatSahasiDeps): InsaatSahasiView {
  const sites = new Map<string, Site>();
  let solidKey = '';
  const kilitliler = () => KILITLI_BOLGELER.filter(b => bolgeKilitli(b, d.state()));
  return {
    update(dt) {
      const root = d.root(), want = root ? kilitliler() : [];
      for (const [id, s] of sites) if (!root || !want.some(b => b.id === id) || s.g.parent !== root) { drop(s); sites.delete(id); }
      const key = kilitliler().map(b => b.id).join(',');
      if (key !== solidKey && d.setSolid) {
        solidKey = key;
        d.setSolid(bolgeEngelleri(d.state()));
      }
      if (!root) return;
      const h = d.hero(), n = d.night();
      for (const b of want) {
        let s = sites.get(b.id);
        if (!s) { s = build(b); root.add(s.g); sites.set(b.id, s); }
        // yalnız yakınken canlandır (kamera ~40 m görür)
        if (Math.abs(h.x - s.cx) < 48) animate(s, dt, n);
      }
    },
    lambalar() {
      const out: { x: number; y: number; z: number; color: string; i: number }[] = [];
      for (const b of kilitliler()) for (const p of b.projektor) { const { L, d } = projHedef(b.taraf, p), m = L.clone().addScaledVector(d, 0.45); out.push({ x: m.x, y: m.y, z: m.z, color: '#ffe2b0', i: 1.25 }); }   // ışık hüzmenin üstünde, hedefe doğru
      return out;
    },
    acik: () => KILITLI_BOLGELER.filter(b => !bolgeKilitli(b, d.state())).map(b => b.id),
    dispose() { for (const s of sites.values()) drop(s); sites.clear(); d.setSolid?.([]); },
  };
}
