/**
 * İç mekanlar görünümü (2026-11-09, owner: "her binaya girilebilmeli, her birinde geliştirmeler, yeni aletler, kafede kahve
 * makinesi; her yerde bir şey olmalı"). One dollhouse room per building of content/ic-mekan.ts: floor, inward-facing walls
 * (the near walls cull away, so a 3rd-person camera sees in), a cut wall cap, windows, door frame, pendant lamps, the
 * furniture layout, the BOUGHT equipment of that business (sim/mulk plot esya, büfe salon esya). People are never props here
 * (DKN-18): staff, guests, students, patients are real actors (sim/agents/kafe.ts, ic-sakin.ts); only the büfe halls' table guests remain (PROP_IZIN). Built only near the player, shown while inside (far side: the
 * exterior shell hides, view/world/karsi-bina.ts) or always for the glass büfe halls. Pure view, no sim, no colliders.
 */
import { katY, avmIcinde } from '../../../content/avm-kat';
import { KAFE_TEMA, type TemaId } from '../../../content/kafe-tema';
import * as T from 'three';
import { mutfakEsya, mutfakCelik, pisirIstasyonu, PASS_KAP } from '../../../content/mutfak';
import { yemekRenk } from '../../../content/yemek-menu';
import { Batch, mtx } from '../../../engine/prefab/batch';
import { IC_CANLI, IC_MEKANLAR, icLayout, icDim, icYaw, icIcinde, mutfakUst, mutfakOda, mutfakVitrin, MUTFAK_YER, passAcik, SERVIS_KAPI_V, type IcMekan, type IcItem } from '../../../content/ic-mekan';
import { useSkyEnv } from './glb';
import { createFx, fanlar, asiliTavalar, biletRayi, menuPanosu, tabakYigini, islakTabela, FX_GEOS, type MutfakFx, type BiletRayi, type TabakYigini, type BiletVeri } from './mutfak-canli';

export interface IcDeps {
  root: () => T.Object3D | null; hero: () => { x: number; z: number }; night: () => number;
  /** the scene: Martı AVM rooms live there (the iskele zone root may be unloaded inside the AVM realm) */ sahne?: () => T.Object3D | null;
  /** owned fixed businesses by plot id */ isletme: () => Record<string, { lv: number; isci: number; esya: string[]; tema?: string }>;
  salon: () => { stage: number; esya: string[] };
  /** büfe mutfağı: hired kitchen staff + the live ticket lines for the KDS screen; BUF-05: pass rafı tabakları + istasyon durumu (sim restoranApi.view()) */
  mutfak: () => { ekip: { rol: string; rank: number }[]; kds: string[]; pass?: string[]; /** 2026-11-21: pass penceresine göre tabaklar */ passYer?: Record<'on' | 'W' | 'E', string[]>; ist?: Record<string, { d: 'pisiyor' | 'hazir'; p: string }>;
    /** BUF-07: gerçek bilet verisi (geliş sırası, en eski önce) fiş rayı için; kirliTabak: bulaşık yığını (BUF-13 bağlayana dek yoksa sabit küçük yığın); zeminKir: 0..1 zemin kiri (ıslak zemin tabelası eşiği) */
    bilet?: BiletVeri[]; kirliTabak?: number; zeminKir?: number };
}
export interface IcView { update(dt: number): void; dispose(): void; /** id of the room the player stands in */ icinde(): string | null }

const HP = Math.PI / 2, O = { r: 0 };
/** BUF-07: zemin kiri bu eşiği aşınca mutfağa sarı "kaygan zemin" tabelası çıkar, paspaslanınca (kir düşünce) kalkar */
const ZEMIN_ISLAK = 0.55;
const FLOOR: Record<string, [string, string]> = { kafe: ['#9a6b45', '#7d5434'], bistro: ['#e6e0d4', '#2c3e57'], kirtasiye: ['#cfd8dc', '#b8c4c9'], okul: ['#c9b48a', '#b39e74'], lokanta: ['#e9e6e0', '#d4cfc6'],
  kafeterya: ['#8fb3a0', '#7aa08c'], banka: ['#efe9df', '#e2d9c4'], hastane: ['#e3eef2', '#cfdde3'], acil: ['#e3eef2', '#cfdde3'], morg: ['#9aa3a8', '#878f94'], kahvalti: ['#c8a27a', '#b08860'], balik: ['#d8e2e6', '#2f6f8f'], mutfak: ['#b9a78c', '#a59377'],
  giyim: ['#e9e4da', '#d6cec0'], elektronik: ['#dfe4ea', '#c9d0d8'], oyuncak: ['#f3e7c9', '#e6d4a8'],
  sekerci: ['#f3e3e6', '#e6c9cf'], kahveci: ['#8a5f3e', '#74492c'], dondurma: ['#f4f1ea', '#e8ddd0'], baklava: ['#e9dfc8', '#c9a23a'], kuruyemis: ['#c8a27a', '#b08860'],
  donerci: ['#d9cfc0', '#a2472f'], kumpir: ['#efe3c4', '#d8c39a'], midye: ['#dfe9ec', '#2f6f8f'], avmLokanta: ['#e9e6e0', '#d4cfc6'] };
const WALL: Record<string, [string, string]> = { kafe: ['#f3e3c8', '#7a4a2a'], bistro: ['#e9f1f4', '#1d4f86'], kirtasiye: ['#f6f6ee', '#2b6fb8'], okul: ['#f4ead2', '#5f8f6a'], lokanta: ['#f2efe9', '#a2472f'],
  kafeterya: ['#eef2f4', '#2f9e5a'], banka: ['#f4efe2', '#1f3a5f'], hastane: ['#f2f6f8', '#7fb4d8'], acil: ['#f2f6f8', '#d93a3a'], morg: ['#b9c0c4', '#5b6068'], kahvalti: ['#f3e3c8', '#7a4a2a'], balik: ['#e9f1f4', '#1d4f86'], mutfak: ['#f3ead6', '#3f7f64'],
  giyim: ['#f6f0ea', '#c94f6d'], elektronik: ['#eef2f6', '#2b6fb8'], oyuncak: ['#fff6e0', '#e8892b'],
  sekerci: ['#fff3f5', '#c94f6d'], kahveci: ['#efe2cf', '#5a3a22'], dondurma: ['#fbf7f0', '#e0533c'], baklava: ['#f6edd8', '#2f6b3a'], kuruyemis: ['#f3e6cf', '#8a5a3c'],
  donerci: ['#f4ece0', '#a2472f'], kumpir: ['#fff4dc', '#e8892b'], midye: ['#eef5f7', '#1d4f86'], avmLokanta: ['#f2efe9', '#a2472f'] };

let solid: T.MeshStandardMaterial | null = null, glass: T.MeshStandardMaterial | null = null, glow: T.MeshBasicMaterial | null = null, wallM: T.MeshStandardMaterial | null = null;
function mats() {
  if (!solid) {
    solid = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.04 }); useSkyEnv(solid, 'matte');
    wallM = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    glass = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.45, depthWrite: false }); useSkyEnv(glass, 'glass');
    glow = new T.MeshBasicMaterial({ vertexColors: true });
  }
  return { solid: solid!, glass: glass!, glow: glow!, wall: wallM! };
}
const LM = new Map<string, T.MeshLambertMaterial>();
const lm = (c: string) => { let m = LM.get(c); if (!m) { m = new T.MeshLambertMaterial({ color: c }); LM.set(c, m); } return m; };
const BOX = new T.BoxGeometry(1, 1, 1), SPH = new T.SphereGeometry(1, 10, 8);
const TABAK = new T.CylinderGeometry(0.14, 0.12, 0.025, 14), YEMEK = new T.SphereGeometry(1, 8, 6);
/** one plate (shared geometry, cached materials), hidden until the sim puts food on it */
function tabak(): { g: T.Group; food: T.Mesh } {
  const g = new T.Group(), p = new T.Mesh(TABAK, lm('#fbfaf6')), food = new T.Mesh(YEMEK, lm('#e8e2d4'));
  food.scale.set(0.085, 0.04, 0.085); food.position.y = 0.035; g.add(p, food); g.visible = false; return { g, food };
}
function part(g: T.Object3D, geo: T.BufferGeometry, c: string, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const m = new T.Mesh(geo, lm(c)); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m); return m; }

/** BUF-20 (salon masaları ve gözleme tezgâhı) bitene kadar sabit insan çağrısına izin verilen tek yerler; başka her yerde gerçek aktör var (agents/ic-sakin.ts, kafe.ts) */
const PROP_IZIN = ['gozleme', 'masa-salon'];
type Kind = 'guest' | 'staff';
const SK = ['#f1c9a5', '#d9a27a', '#b9805a', '#8a5a3c'], TOPS = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e8f', '#c94f6d', '#7d6bb0', '#f4f2ec', '#3a3d42'], HAIR = ['#1f1813', '#3a2416', '#6b4a2a', '#c9b08a'];
/** low-poly person (yalnız PROP_IZIN): shared geometry + cached lambert materials */
function person(kind: Kind, seed: number, sit: boolean, apron = '#1d1d1d'): T.Group {
  const g = new T.Group(), top = kind === 'guest' ? TOPS[seed % TOPS.length] : '#fbfaf6';
  part(g, BOX, kind === 'guest' ? '#2f3a4a' : '#1d1d1d', 0, sit ? 0.47 : 0.4, sit ? 0.12 : 0, 0.3, sit ? 0.42 : 0.8, sit ? 0.42 : 0.2);
  const by = sit ? 0.92 : 1.08; part(g, BOX, top, 0, by, 0, 0.4, 0.52, 0.24);
  if (kind === 'staff') part(g, BOX, apron, 0, by - 0.16, 0.13, 0.36, 0.5, 0.02);
  const hy = by + 0.42; part(g, SPH, SK[seed % 4], 0, hy, 0, 0.15, 0.15, 0.15);
  part(g, SPH, HAIR[(seed >> 2) % 4], 0, hy + 0.04, -0.02, 0.155, 0.11, 0.155);
  for (const sx of [-1, 1]) part(g, BOX, top, sx * 0.25, by + 0.02, sit ? 0.12 : 0.02, 0.1, 0.42, 0.1);   // arms
  return g;
}

function signTex(text: string, bg: string, fg: string, aspect: number, chalk = false): T.CanvasTexture {
  const h = 96, w = Math.max(96, Math.round(h * aspect)); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (chalk) { g.strokeStyle = '#c9a23a'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  g.fillStyle = fg; g.font = (chalk ? 'italic 800 ' : '900 ') + '54px system-ui,"Segoe UI",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const m = g.measureText(text).width, max = w - 30; if (m > max) { g.save(); g.translate(w / 2, h / 2 + 3); g.scale(max / m, 1); g.fillText(text, 0, 0); g.restore(); } else g.fillText(text, w / 2, h / 2 + 3);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}

interface Anim { spin: T.Object3D[]; fire: T.Object3D[]; fish: T.Object3D[]; screens: T.MeshBasicMaterial[]; flick: T.Object3D[]; bob: T.Object3D[]; lamps: T.Object3D | null; kds?: { draw(lines: string[]): void }; kdsT?: number;
  /** BUF-05 mutfak: pass rafında PASS_KAP tabak yuvası ve her pişirme istasyonunun üstünde bir tabak + pişiyor işareti (buhar topu) */
  fan?: T.Object3D[]; swing?: { o: T.Object3D; ph: number }[]; bilet?: BiletRayi; fx?: MutfakFx; fxEm?: { id: string; u: number; v: number }[]; yigin?: TabakYigini; tabela?: T.Object3D;
  pasTabak?: { g: T.Group; food: T.Mesh }[]; /** 2026-11-21: hangi pass'ın tabakları ('on' mutfak sokak pass'ı, W/E salon pass'ı) */ passYer?: 'on' | 'W' | 'E'; istTabak?: Map<string, { g: T.Group; food: T.Mesh; buhar: T.Mesh }>; pisiyor?: T.Mesh[] }
interface Ctx { b: Batch; g: Batch; l: Batch; grp: T.Group; m: IcMekan; an: Anim; seed: number; fine: boolean; lv: number; owned: boolean; stage: number; /** BUF-22: büfe mutfağı esnaf dönemi (aşama < 7): emaye ocak, ahşap tezgâh, karo */ esnaf?: boolean }
/** BUF-22: mutfak istasyonu renkleri: esnaf (emaye, döküm, ahşap) ya da paslanmaz çelik; her istasyonun kendi renk şeridi (ayırt edilsin) */
const ISTASYON_RENK: Record<string, string> = { ocak: '#e0533c', ocak2: '#e0533c', izgara: '#ff8a1f', izgara2: '#ff8a1f', fritoz: '#ffd23f', doner: '#a0522d', tas_firin: '#b5651d', tatli: '#f2a2b3',
  salata: '#6f9e4f', meze: '#2f9e8f', cay_bar: '#c0392b', icecek_dolap: '#e0533c', bulasik: '#3f8fc9', pass: '#c9a24a', soguk_oda: '#7fd0ff', sef_masa: '#c9a24a' };
const celik = (c: Ctx, esnafRenk: string, celikRenk: string) => (c.esnaf ? esnafRenk : celikRenk);

/* ---------- furniture & equipment builders (local frame: item faces +z, base at y=0) ---------- */
const chair = (b: Batch, x: number, z: number, a: number, c: string) => {
  b.box(0.38, 0.05, 0.38, c, x, 0.45, z); b.box(0.38, 0.42, 0.05, c, x + Math.sin(a) * 0.17, 0.68, z + Math.cos(a) * 0.17, { ry: a });
  for (const [dx, dz] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) b.box(0.03, 0.45, 0.03, '#3a3d42', x + dx, 0.22, z + dz);
};
function masa(c: Ctx, it: IcItem, n: number) {
  // BUF-20 salonMasa: büfe salonunun sim masası, iki sandalye sim koltuklarında (u ekseninde ±0.78), oturan yalnız gerçek müşteri
  const sm = it.k === 'salonMasa', { b } = c, cloth = it.k === 'masa4' || sm, fine = c.fine, chc = c.m.tur === 'balik' ? '#14325a' : c.m.tur === 'kahvalti' ? (fine ? '#5a3b2a' : '#7d5638') : fine ? '#6b1f2a' : c.m.tur === 'bistro' ? '#1d4f86' : '#7d5638';   // 2026-11-21: salon chairs contrast with their rug
  b.cyl(0.05, 0.1, 0.72, '#2a2d33', 0, 0.36, 0, { seg: 8 }); b.cyl(cloth ? 0.5 : 0.4, cloth ? 0.5 : 0.4, 0.05, cloth ? '#fbfaf6' : '#d6aa78', 0, 0.74, 0, { seg: 16 });
  if (cloth) b.cyl(0.52, 0.55, 0.2, fine ? '#fbfaf6' : c.m.tur === 'balik' ? '#e8f1f6' : '#fbf3e4', 0, 0.65, 0, { seg: 16 });
  b.cyl(0.11, 0.11, 0.015, '#ffffff', 0.18, 0.775, 0.05, { seg: 12 }); b.cyl(0.035, 0.03, 0.1, '#c0392b', -0.12, 0.82, 0.1, { seg: 6 }); b.cyl(0.035, 0.03, 0.1, '#e9d27a', 0.05, 0.82, -0.14, { seg: 6 });
  if (fine) { b.cyl(0.03, 0.04, 0.12, '#c9a24a', 0, 0.83, 0, { seg: 6 }); c.l.sph(0.035, '#ffcf6a', 0, 0.92, 0, { ws: 6, hs: 4 }); }
  const seats = cloth && !sm ? 4 : 2;
  for (let k = 0; k < seats; k++) {
    const a = cloth && !sm ? k * HP : k * Math.PI + HP, r = sm ? 0.78 : 0.68, x = Math.sin(a) * r, z = Math.cos(a) * r;
    chair(b, x, z, a, chc);
    if (k < n) { const p = person('guest', c.seed + k * 7, true); p.position.set(x, 0, z); p.rotation.y = a + Math.PI; c.grp.userData.cur.add(p); if (k === 0) c.an.bob.push(p); }
  }
}
function counter(c: Ctx, it: IcItem, col: string, top = '#e9e0c8') {
  const { b, g } = c, w = it.w, d = it.d;
  b.box(w, 1.0, d, col, 0, 0.5, 0); b.box(w + 0.08, 0.06, d + 0.12, top, 0, 1.02, 0.02);
  b.box(w - 0.1, 0.12, 0.04, '#2a2d33', 0, 0.06, d / 2 + 0.01);                                                  // kick plate
  for (let i = 0; i < Math.floor(w / 1.2); i++) b.box(0.02, 0.8, 0.02, top, -w / 2 + 0.6 + i * 1.2, 0.5, d / 2 + 0.005);   // panel lines
  void g;
}
const shelfGoods = (c: Ctx, w: number, rows: number, y0: number, dz: number, pal: string[]) => {
  for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 0.16); i++) { const h = 0.12 + ((i * 7 + r * 3 + c.seed) % 5) * 0.03; c.b.box(0.11, h, 0.12, pal[(i + r * 2 + c.seed) % pal.length], -w / 2 + 0.1 + i * 0.16, y0 + r * 0.42 + h / 2, dz); }
};

type Fn = (c: Ctx, it: IcItem) => void;
/** wall-mounted items place themselves at it.y */
const WALLY = new Set(['menuPano', 'tahta', 'pano', 'ekran', 'formaDuvar', 'kds', 'davlumbaz', 'asiliTava', 'mutfakMenu', 'ledPano', 'tvDuvar']);
const F: Record<string, Fn> = {
  // ---- 2026-11-21 Martı AVM yemek / tatlı dükkânları (content/ic-mekan.ts avmOdaLayout) ----
  kavanoz: (c, it) => {   // floor shelf (y 0) of glass jars, or a small row of jars on a counter (y > 0)
    const { b, g } = c, flo = !(it.y || 0), P: Record<string, string[]> = { seker: ['#f2a2b3', '#ffd23f', '#7fd1c7', '#c94f6d'], akide: ['#e0533c', '#ffd23f', '#2f9e5a', '#f4f2ec'], kahve: ['#5a3a22', '#7a4a2a', '#3a2416', '#9a6b45'], demleme: ['#3a2416', '#d9c4a0', '#5a3a22', '#e8e2d4'], cerez: ['#c99a5b', '#e9d27a', '#8a5a3c', '#6f9e4f'], tursu: ['#9bbf3a', '#c0392b', '#e9d27a', '#6f9e4f'] };
    const pal = P[it.c || 'seker'] || P.seker, rows = flo ? 3 : 1, n = Math.max(2, Math.round(it.w / 0.26));
    if (flo) { b.box(it.w, 1.5, 0.05, '#e8dcc6', 0, 0.75, -it.d / 2 + 0.03); for (let r = 0; r <= rows; r++) b.box(it.w, 0.03, it.d, '#a87a52', 0, 0.06 + r * 0.46, 0); for (const sx of [-1, 1]) b.box(0.04, 1.5, it.d, '#8a6040', sx * (it.w / 2 - 0.02), 0.75, 0); }
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      const x = -it.w / 2 + 0.15 + i * (it.w - 0.3) / (n - 1), y = (flo ? 0.08 + r * 0.46 : 0) + 0.11;
      b.cyl(0.075, 0.075, 0.13, pal[(i + r) % pal.length], x, y, 0.02, { seg: 10 }); g.cyl(0.085, 0.085, 0.2, '#e6f3f8', x, y + 0.03, 0.02, { seg: 10 }); b.cyl(0.07, 0.07, 0.03, '#c9a23a', x, y + 0.15, 0.02, { seg: 10 });
    }
  },
  tepsiTezgah: (c, it) => {   // a tray of the house product on the counter: lokum, macun, künefe, baklava, midye, lemons, butter...
    const { b } = c, k = it.c || '', P: Record<string, string[]> = { lokum: ['#f2a2b3', '#fbfaf6', '#9bd36b'], macun: ['#e0533c', '#ffd23f', '#2f9e5a', '#7d6bb0'], altin: ['#c9a23a', '#e9c46a'], kunefe: ['#e8892b', '#f4d35e'], baklava: ['#d8a24a', '#6f9e4f'], midye: ['#2a2d33', '#e9a46a'], limon: ['#f4e04d', '#9bbf3a'], tereyag: ['#f6e7a1', '#e9d27a'], cerez: ['#c99a5b', '#8a5a3c'] };
    const pal = P[k] || P.lokum; b.box(it.w, 0.03, it.d, k === 'altin' || k === 'kunefe' ? '#b87333' : '#c9ced6', 0, 0.015, 0); b.box(it.w, 0.04, 0.02, '#9aa5b0', 0, 0.04, it.d / 2 - 0.01); b.box(it.w, 0.04, 0.02, '#9aa5b0', 0, 0.04, -it.d / 2 + 0.01);
    const nx = Math.max(3, Math.round(it.w / 0.09)), nz = Math.max(2, Math.round(it.d / 0.1));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -it.w / 2 + 0.06 + i * (it.w - 0.12) / (nx - 1), z = -it.d / 2 + 0.07 + j * (it.d - 0.14) / Math.max(1, nz - 1), col = pal[(i * 3 + j) % pal.length];
      if (k === 'midye') { b.sph(0.035, '#1f2226', x, 0.05, z, { ws: 6, hs: 4, sy: 0.5 }); b.sph(0.022, '#e9a46a', x, 0.065, z, { ws: 5, hs: 3 }); }
      else if (k === 'limon') b.sph(0.04, col, x, 0.06, z, { ws: 7, hs: 5 });
      else if (k === 'kunefe' && (i + j) % 3) { b.cyl(0.07, 0.07, 0.03, '#e8892b', x, 0.05, z, { seg: 10 }); }
      else b.box(0.06, 0.04, 0.06, col, x, 0.05, z);
    }
  },
  hamurMasa: (c, it) => {   // marble work table: pişmaniye pulled by hand / yufka with a long rolling pin
    const { b } = c; b.box(it.w, 0.06, it.d, '#ecebe6', 0, 0.86, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.05, 0.84, 0.05, '#9aa5b0', sx * (it.w / 2 - 0.06), 0.42, sz * (it.d / 2 - 0.06));
    b.box(it.w - 0.1, 0.02, it.d - 0.1, '#9aa5b0', 0, 0.16, 0);
    if (it.c === 'yufka') { b.cyl(0.24, 0.24, 0.01, '#f6efd9', -0.12, 0.895, 0, { seg: 18 }); b.cyl(0.018, 0.018, it.w * 0.9, '#c8a27a', 0.05, 0.92, 0.12, { rz: HP, seg: 6 }); }
    else { for (let i = 0; i < 5; i++) b.sph(0.07, '#f8f1dc', -it.w / 2 + 0.16 + i * 0.13, 0.93, (i % 2) * 0.1 - 0.05, { ws: 7, hs: 5, sy: 0.7 }); b.box(0.3, 0.12, 0.2, '#e0533c', it.w / 2 - 0.2, 0.95, 0.1); }
  },
  kazan: (c, it) => {   // copper cauldron on a burner: kestane, döğme dondurma, pilav
    const { b, l } = c, k = it.c || '', top = it.y ? 0 : 0.42, r = Math.min(it.w, it.d) * 0.42;
    if (!it.y) { b.box(it.w, top, it.d, '#2a2d33', 0, top / 2, 0, { r: 0.03, s: 2 }); l.plane(0.1, 0.04, '#ff7a3a', 0, 0.2, it.d / 2 + 0.005); }
    b.cyl(r, r * 0.85, 0.32, k === 'dovme' ? '#c9ced6' : '#b87333', 0, top + 0.16, 0, { seg: 16 });
    b.cyl(r * 0.92, r * 0.92, 0.02, k === 'kestane' ? '#6b3a20' : k === 'dovme' ? '#fbfaf6' : '#f2ead8', 0, top + 0.3, 0, { seg: 16 });
    if (k === 'kestane') for (let i = 0; i < 7; i++) b.sph(0.035, '#5a2e16', Math.cos(i) * r * 0.5, top + 0.33, Math.sin(i) * r * 0.5, { ws: 6, hs: 4 });
    if (k === 'dovme') b.cyl(0.015, 0.015, 0.7, '#c8a27a', r * 0.3, top + 0.55, 0, { rz: 0.5, seg: 5 });
  },
  kumOcak: (c, it) => {   // sand-heated cezve stove: copper tray of hot sand, cezves sunk in it, glowing edge
    const { b, l } = c; b.box(it.w, 0.1, it.d, '#7a4a2a', 0, 0.05, 0); b.box(it.w - 0.06, 0.05, it.d - 0.06, '#e2c58f', 0, 0.12, 0); l.box(it.w - 0.02, 0.012, 0.012, '#ff8a3a', 0, 0.1, it.d / 2 - 0.01);
    for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.14 + i * (it.w - 0.28) / 2; b.cyl(0.045, 0.06, 0.1, '#b87333', x, 0.17, 0.02, { seg: 10 }); b.cyl(0.008, 0.008, 0.16, '#5a3a22', x + 0.08, 0.2, 0.02, { rz: 1.2, seg: 4 }); }
  },
  degirmen: (c) => { const { b } = c; b.box(0.2, 0.22, 0.2, '#b87333', 0, 0.11, 0); b.cyl(0.07, 0.09, 0.08, '#c9a23a', 0, 0.26, 0, { seg: 10 }); b.cyl(0.01, 0.01, 0.12, '#2a2d33', 0.05, 0.33, 0, { rz: HP, seg: 4 }); b.sph(0.025, '#5a3a22', 0.11, 0.33, 0, { ws: 6, hs: 4 }); },
  kavurucu: (c, it) => {   // drum roaster: black body, copper drum, cooling tray with beans / nuts
    const { b, l } = c, s = it.c === 'kucuk' ? 0.8 : 1; b.box(it.w * 0.6, 0.85 * s, it.d, '#2a2d33', -it.w * 0.18, 0.42 * s, 0, { r: 0.03, s: 2 });
    b.cyl(0.2 * s, 0.2 * s, it.d * 0.8, '#b87333', -it.w * 0.18, 0.95 * s, 0, { rx: HP, seg: 14 }); b.cone(0.1 * s, 0.25 * s, '#9aa5b0', -it.w * 0.18, 1.22 * s, 0, { rx: Math.PI, seg: 10 });
    b.cyl(it.w * 0.2, it.w * 0.2, 0.08, '#9aa5b0', it.w * 0.28, 0.62 * s, 0, { seg: 16 }); b.cyl(it.w * 0.18, it.w * 0.18, 0.02, '#6b3a20', it.w * 0.28, 0.67 * s, 0, { seg: 16 });
    b.box(0.04, 0.6 * s, 0.04, '#2a2d33', it.w * 0.28, 0.3 * s, 0); l.plane(0.08, 0.05, '#ff7a3a', -it.w * 0.18, 0.3 * s, it.d / 2 + 0.005);
  },
  falci: (c) => {   // fortune-teller corner: low brass table, two cushions, a cup turned upside down on its saucer
    const { b } = c; b.cyl(0.24, 0.24, 0.03, '#c9a23a', 0, 0.42, 0, { seg: 16 }); b.cyl(0.03, 0.05, 0.4, '#7a4a2a', 0, 0.2, 0, { seg: 8 });
    b.cyl(0.05, 0.05, 0.01, '#fbfaf6', 0.05, 0.44, 0, { seg: 10 }); b.cyl(0.03, 0.025, 0.04, '#fbfaf6', 0.05, 0.465, 0, { seg: 10 });
    for (const sx of [-1, 1]) b.box(0.32, 0.12, 0.32, sx < 0 ? '#7d2b4a' : '#1d4f86', sx * 0.4, 0.06, 0.05, { r: 0.05, s: 2 });
    b.sph(0.05, '#e9c46a', -0.08, 0.47, -0.06, { ws: 8, hs: 6 });
  },
  bakirDuvar: (c, it) => {   // wall rail with hanging copper: cezves or baklava trays
    const { b } = c; b.cyl(0.012, 0.012, it.w, '#7a4a2a', 0, 0.1, 0, { rz: HP, seg: 5 });
    const n = it.c === 'cezve' ? 7 : 4; for (let i = 0; i < n; i++) { const x = -it.w / 2 + 0.12 + i * (it.w - 0.24) / (n - 1);
      if (it.c === 'cezve') { b.cyl(0.04, 0.055, 0.09, '#b87333', x, -0.02, 0.03, { seg: 10 }); b.cyl(0.006, 0.006, 0.14, '#5a3a22', x, 0.05, 0.03, { seg: 4 }); }
      else b.cyl(0.17, 0.17, 0.02, '#b87333', x, -0.12, 0.02, { rx: HP, seg: 18 }); }
  },
  dondurmaTezgah: (c, it) => {   // Maraş ice-cream counter: steel body, deep lidded wells, the long paddle, a cone rack
    const { b, g, l } = c; b.box(it.w, 0.9, it.d, '#c9ced6', 0, 0.45, 0, { r: 0.02, s: 2 }); b.box(it.w, 0.04, it.d, '#9aa5b0', 0, 0.92, 0);
    const P = ['#fbfaf6', '#6b3a20', '#f2a2b3', '#9bd36b', '#ffd23f']; for (let i = 0; i < 5; i++) { const x = -it.w / 2 + 0.16 + i * (it.w - 0.32) / 4; b.cyl(0.1, 0.1, 0.04, '#5b6068', x, 0.95, 0, { seg: 12 }); b.sph(0.085, P[i], x, 0.96, 0, { ws: 9, hs: 5, sy: 0.5 }); b.cyl(0.105, 0.105, 0.02, '#c9a23a', x, 1.01, -0.09, { rx: -1.1, seg: 12 }); }
    b.cyl(0.015, 0.015, 0.9, '#c8a27a', it.w / 2 - 0.15, 1.25, 0.05, { rz: 0.35, seg: 5 }); g.box(it.w - 0.1, 0.3, 0.02, '#e6f3f8', 0, 1.12, it.d / 2 - 0.02); l.box(it.w - 0.1, 0.02, 0.02, '#fff3d6', 0, 0.88, it.d / 2 + 0.01);
    for (let i = 0; i < 5; i++) b.cone(0.03, 0.12, '#d8a24a', -it.w / 2 + 0.1 + i * 0.06, 0.98, it.d / 2 - 0.08, { rx: Math.PI, seg: 8 });
  },
  dondurmaSov: (c, it) => {   // wall show: crossed paddles and a fake giant cone, or the brass bell of the tease show
    const { b } = c;
    if (it.c === 'zil') { b.cyl(0.012, 0.012, 0.2, '#7a4a2a', 0, 0.1, 0.04, { seg: 4 }); b.cone(0.09, 0.13, '#c9a23a', 0, -0.02, 0.06, { seg: 12 }); b.sph(0.02, '#7a4a2a', 0, -0.09, 0.06, { ws: 5, hs: 4 }); return; }
    for (const sg of [-1, 1]) b.box(it.w * 0.55, 0.05, 0.02, '#c8a27a', 0, 0, 0.03, { rz: sg * 0.45 }); b.cone(0.12, 0.38, '#d8a24a', 0, -0.05, 0.08, { rx: Math.PI, seg: 10 }); b.sph(0.12, '#fbfaf6', 0, 0.17, 0.08, { ws: 9, hs: 6 }); b.sph(0.1, '#f2a2b3', 0, 0.3, 0.08, { ws: 9, hs: 6 });
  },
  terazi: (c) => { const { b, l } = c; b.box(0.36, 0.08, 0.3, '#2a2d33', 0, 0.04, 0, { r: 0.02, s: 2 }); b.cyl(0.14, 0.14, 0.015, '#c9ced6', 0, 0.09, 0.02, { seg: 16 }); b.box(0.16, 0.12, 0.03, '#2a2d33', 0, 0.14, -0.12); l.plane(0.12, 0.05, '#7fe0a8', 0, 0.15, -0.104); },
  cuval: (c, it) => {   // open jute sacks of nuts / dried fruit with scoops
    const { b } = c, P = it.c === 'meyve' ? ['#e8892b', '#7a2a1d', '#d8a24a', '#6f9e4f'] : ['#c99a5b', '#e9d27a', '#8a5a3c', '#6f9e4f'], n = it.w > 0.82 ? 4 : 3;
    for (let i = 0; i < n; i++) { const x = n === 4 ? (i % 2 - 0.5) * it.w * 0.5 : -it.w / 2 + 0.14 + i * (it.w - 0.28) / 2, z = n === 4 ? (Math.floor(i / 2) - 0.5) * it.d * 0.5 : 0;
      b.cyl(0.13, 0.15, 0.5, '#b89a68', x, 0.25, z, { seg: 10 }); b.cyl(0.15, 0.13, 0.08, '#a88a58', x, 0.52, z, { seg: 10 }); b.sph(0.12, P[i % 4], x, 0.5, z, { ws: 8, hs: 5, sy: 0.4 }); }
    b.box(0.05, 0.03, 0.12, '#c9ced6', 0, 0.56, 0, { rx: 0.4 });
  },
  lavasSac: (c, it) => { const { b, l } = c; b.box(it.w, 0.1, it.d, '#2a2d33', 0, 0.05, 0); b.cyl(it.w * 0.42, it.w * 0.44, 0.03, '#1f1813', 0, 0.12, 0, { seg: 18 }); b.cyl(it.w * 0.32, it.w * 0.32, 0.005, '#f2dfb0', 0, 0.14, 0, { seg: 18 }); l.plane(0.08, 0.03, '#ff7a3a', 0, 0.05, it.d / 2 + 0.005); },
  yayik: (c, it) => {   // copper ayran churn with a tap and a stack of copper cups
    const { b } = c; b.cyl(0.18, 0.2, 0.8, '#b87333', 0, 0.4, 0, { seg: 14 }); b.tor(0.19, 0.015, '#c9a23a', 0, 0.62, 0, { rx: HP, ts: 18 }); b.cyl(0.1, 0.16, 0.12, '#b87333', 0, 0.86, 0, { seg: 12 });
    b.cyl(0.015, 0.015, 0.12, '#c9a23a', 0, 0.2, 0.2, { rx: HP, seg: 5 }); b.sph(0.03, '#f6f6f2', 0, 0.86, 0, { ws: 6, hs: 4 });
    for (let i = 0; i < 4; i++) b.cyl(0.04, 0.035, 0.07, '#b87333', it.w / 2 - 0.08, 0.035 + i * 0.075, -0.12, { seg: 8 });
  },
  kumpirFirin: (c, it) => {   // potato oven: black steel box, glass door, potatoes on racks, warm glow
    const { b, g, l } = c; b.box(it.w, 0.9, it.d, '#2a2d33', 0, 0.45, 0, { r: 0.03, s: 2 }); b.box(it.w, 0.04, it.d, '#c9ced6', 0, 0.92, 0);
    g.plane(it.w - 0.2, 0.5, '#ffd9a0', 0, 0.5, it.d / 2 + 0.005); l.plane(it.w - 0.24, 0.46, '#ffb35a', 0, 0.5, it.d / 2 + 0.002);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) b.sph(0.07, '#a87a3a', -it.w / 2 + 0.2 + i * (it.w - 0.4) / 4, 0.36 + r * 0.24, 0, { ws: 7, hs: 5, sx: 1.4 });
    b.box(it.w - 0.2, 0.03, 0.03, '#c9a23a', 0, 0.8, it.d / 2 + 0.03);
  },
  agSus: (c, it) => {   // fishing net on the wall with floats, a starfish and a little anchor
    const { b } = c; for (let i = 0; i < 6; i++) b.box(0.012, 0.6, 0.01, '#8a7a5a', -it.w / 2 + 0.1 + i * (it.w - 0.2) / 5, 0, 0.02, { rz: (i % 2 ? 0.25 : -0.25) });
    for (let j = 0; j < 4; j++) b.box(it.w * 0.9, 0.01, 0.01, '#8a7a5a', 0, -0.25 + j * 0.17, 0.02);
    for (let i = 0; i < 4; i++) b.sph(0.045, i % 2 ? '#e0533c' : '#fbfaf6', -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3, 0.3, 0.04, { ws: 8, hs: 6 });
    b.box(0.14, 0.03, 0.02, '#e8892b', it.w * 0.28, -0.12, 0.04, { rz: 0.6 }); b.box(0.14, 0.03, 0.02, '#e8892b', it.w * 0.28, -0.12, 0.04, { rz: -0.6 });
    b.box(0.03, 0.22, 0.02, '#5b6068', -it.w * 0.3, -0.1, 0.04); b.tor(0.06, 0.012, '#5b6068', -it.w * 0.3, -0.2, 0.04, { arc: Math.PI, rz: Math.PI, ts: 10 });
  },
  tezgah: (c, it) => counter(c, it, it.c || '#7a3b1c'),
  bar: (c, it) => { counter(c, it, c.fine ? '#1f2a44' : '#2c3e57', c.fine ? '#c9a24a' : '#d8d2c4'); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.7 + i * (it.w - 1.4) / 3; c.b.cyl(0.18, 0.18, 0.06, '#7d5638', x, 0.75, it.d / 2 + 0.35, { seg: 12 }); c.b.cyl(0.04, 0.04, 0.72, '#9aa5b0', x, 0.37, it.d / 2 + 0.35, { seg: 6 }); } },
  acikBufe: (c, it) => { counter(c, it, c.fine ? '#1f2a44' : '#8a5a3a', '#f4f2ec'); const P = ['#ffd23f', '#e0533c', '#6f9e4f', '#f2e6c8', '#c94f6d', '#3a2416', '#fbfaf6']; for (let i = 0; i < 9; i++) { const x = -it.w / 2 + 0.35 + i * (it.w - 0.7) / 8; c.b.cyl(0.16, 0.14, 0.04, '#ffffff', x, 1.07, 0, { seg: 12 }); c.b.sph(0.1, P[i % P.length], x, 1.1, 0, { ws: 7, hs: 4, sy: 0.4 }); } c.g.box(it.w - 0.1, 0.02, 0.6, '#d8eef6', 0, 1.42, 0.02); for (const s of [-1, 1]) c.b.box(0.04, 0.4, 0.04, '#c9ced6', s * (it.w / 2 - 0.1), 1.24, 0.25); },
  rafArka: (c, it) => {
    const { b } = c, w = it.w, kirt = it.c === 'kirtasiye'; b.box(w, 2.1, it.d, kirt ? '#e9eef2' : '#5a3b2a', 0, 1.05, 0);
    for (let r = 0; r < 4; r++) b.box(w, 0.04, it.d + 0.04, kirt ? '#2b6fb8' : '#3a2416', 0, 0.35 + r * 0.42, 0.02);
    shelfGoods(c, w - 0.2, 4, 0.37, it.d / 2 - 0.08, kirt ? ['#e0533c', '#2f6fdb', '#ffd23f', '#49b96a', '#8a6bbf', '#f4f2ec'] : ['#c0392b', '#e9d27a', '#6f9e4f', '#f4f2ec', '#3a2416', '#2f7fb3']);
  },
  kasa: (c) => { c.b.box(0.34, 0.14, 0.3, '#2a2d33', 0, 0.07, 0); c.b.box(0.3, 0.2, 0.04, '#2a2d33', 0, 0.24, -0.12, { rx: -0.3 }); c.l.plane(0.24, 0.14, '#7fe0a8', 0, 0.25, -0.095, { rx: -0.3 }); },
  menuPano: (c, it) => { const tx = signTex(it.txt || 'MENÜ', '#22272b', '#f4ead2', it.w / 0.7, true), mm = new T.MeshBasicMaterial({ map: tx }); const p = new T.Mesh(new T.PlaneGeometry(it.w, 0.7), mm); p.position.set(0, it.y || 2.3, 0.03); c.grp.userData.cur.add(p); c.b.box(it.w + 0.1, 0.8, 0.04, '#5a3b2a', 0, it.y || 2.3, 0); },
  lamba: (c, it) => {
    if (c.m.salon) return;   // the halls hang their own lamps (bufe-buyume)
    const h = Math.min(3.2, c.m.h), nx = Math.max(1, Math.round(it.w / 3.6)), nz = Math.max(1, Math.round(it.d / 3.6)), shade = c.m.tur === 'hastane' || c.m.tur === 'acil' || c.m.tur === 'morg' || c.m.tur === 'okul' || c.m.tur === 'banka';
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x = -it.w / 2 + (i + 0.5) * it.w / nx, z = -it.d / 2 + (j + 0.5) * it.d / nz;
      if (shade) continue;   // 2026-11-21 görsel: tavan kesikken düz levha zeminde yüzüyor gibi duruyordu; oda ışığı sahne ışığından geliyor
      else { c.b.cyl(0.01, 0.01, 0.7, '#2a2d33', x, h - 0.35, z, { seg: 4 }); c.b.cone(0.18, 0.18, c.fine ? '#c9a24a' : '#b87333', x, h - 0.75, z, { seg: 12 }); c.l.sph(0.08, '#ffe6b0', x, h - 0.86, z, { ws: 8, hs: 6 }); }
    }
  },
  saksiB: (c) => { c.b.cyl(0.26, 0.2, 0.5, '#f4f2ec', 0, 0.25, 0, { seg: 10 }); c.b.sph(0.36, '#3f7a34', 0, 0.8, 0, { ws: 8, hs: 6 }); c.b.sph(0.26, '#4f8f3a', 0.1, 1.15, 0.05, { ws: 8, hs: 6 }); },
  saksi: (c) => { c.b.cyl(0.2, 0.16, 0.4, '#c8693e', 0, 0.2, 0, { seg: 10 }); for (let i = 0; i < 5; i++) c.b.box(0.05, 0.7, 0.18, '#3f7a34', Math.cos(i * 1.26) * 0.08, 0.7, Math.sin(i * 1.26) * 0.08, { ry: i * 1.26, rz: 0.25 }); c.b.sph(0.06, '#e0533c', 0.05, 1.05, 0, { ws: 5, hs: 4 }); },
  // café equipment
  espresso: (c) => { const { b, l } = c; b.box(0.56, 0.42, 0.42, '#c9ced6', 0, 0.21, 0, { r: 0.04, s: 2 }); b.box(0.56, 0.06, 0.44, '#2a2d33', 0, 0.45, 0); for (const x of [-0.14, 0.14]) { b.cyl(0.04, 0.04, 0.08, '#2a2d33', x, 0.24, 0.24, { seg: 8 }); b.cyl(0.035, 0.03, 0.07, '#ffffff', x, 0.05, 0.22, { seg: 8 }); } b.cyl(0.02, 0.02, 0.2, '#9aa5b0', 0.24, 0.32, 0.18, { seg: 5, rz: 0.4 }); l.plane(0.14, 0.05, '#7fe0a8', -0.12, 0.36, 0.215); for (let i = 0; i < 4; i++) b.cyl(0.035, 0.03, 0.06, '#ffffff', -0.2 + i * 0.13, 0.51, -0.1, { seg: 8 }); },
  barista: (c) => { const { b } = c; b.cyl(0.08, 0.1, 0.32, '#2a2d33', -0.25, 0.16, 0, { seg: 10 }); b.cone(0.1, 0.18, '#c9ced6', -0.25, 0.42, 0, { seg: 10, rx: Math.PI }); b.cyl(0.06, 0.06, 0.2, '#b87333', 0.05, 0.1, 0.05, { seg: 10 }); b.cone(0.07, 0.08, '#e9eef2', 0.25, 0.25, 0, { seg: 10, rx: Math.PI }); b.cyl(0.015, 0.015, 0.22, '#9aa5b0', 0.25, 0.1, 0, { seg: 4 }); for (let i = 0; i < 3; i++) b.box(0.1, 0.16, 0.1, ['#7a4a2a', '#3a2416', '#a8794e'][i], 0.05 + i * 0.12, 0.08, -0.15); },
  vitrin: (c, it) => { const { b, g, l } = c; b.box(it.w, 0.7, it.d, '#2a2d33', 0, 0.35, 0); g.box(it.w - 0.06, 0.55, it.d - 0.06, '#d8eef6', 0, 0.98, 0); l.box(it.w - 0.1, 0.02, it.d - 0.1, '#fff8e8', 0, 1.24, 0); const P = ['#f2a2b3', '#6b3a20', '#ffd23f', '#fbfaf6', '#c0392b']; for (let i = 0; i < 6; i++) { b.cyl(0.11, 0.11, 0.1, P[i % 5], -it.w / 2 + 0.25 + (i % 3) * (it.w - 0.5) / 2, 0.78 + Math.floor(i / 3) * 0.22, i < 3 ? 0.1 : -0.1, { seg: 12 }); } },
  koltuk: (c) => { const { b } = c, L = '#6b3a20'; b.box(1.6, 0.4, 0.8, L, 0, 0.25, -0.35); b.box(1.6, 0.5, 0.18, L, 0, 0.6, -0.68); for (const s of [-1, 1]) b.box(0.18, 0.55, 0.8, L, s * 0.8, 0.35, -0.35); b.box(0.9, 0.05, 0.5, '#3a2416', 0, 0.42, 0.45); for (const [x, z] of [[-0.4, 0.25], [0.4, 0.25], [-0.4, 0.65], [0.4, 0.65]]) b.box(0.04, 0.4, 0.04, '#3a2416', x, 0.2, z); b.cyl(0.04, 0.035, 0.1, '#ffffff', 0.1, 0.5, 0.45, { seg: 8 }); },
  muzik: (c) => { const { b } = c; b.box(0.7, 0.55, 0.45, '#5a3b2a', 0, 0.28, 0); b.cyl(0.17, 0.17, 0.02, '#111', -0.08, 0.57, 0, { seg: 18 }); const r = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 0.012, 18), lm('#1a1a1a')); r.position.set(-0.08, 0.58 + 0.1, 0); c.an.spin.push(r); c.grp.userData.curItem.add(r); for (const s of [-1, 1]) { b.box(0.3, 0.5, 0.26, '#2a2d33', s * 0.55, 1.6, -0.05); b.cyl(0.09, 0.09, 0.02, '#555', s * 0.55, 1.65, 0.09, { rx: HP, seg: 12 }); } },
  kitaplik: (c, it) => { const { b } = c; b.box(it.w, 2.2, it.d, '#5a3b2a', 0, 1.1, 0); for (let r = 0; r < 5; r++) b.box(it.w, 0.04, it.d + 0.02, '#3a2416', 0, 0.2 + r * 0.44, 0.01); shelfGoods(c, it.w - 0.2, 5, 0.22, it.d / 2 - 0.1, ['#7a2a1d', '#1d4f86', '#2f6f4a', '#c9a23a', '#f4ead2', '#5a3b2a']); },
  isikTavan: (c, it) => { const h = Math.min(3.0, c.m.h) - 0.05; for (const z of [-it.d / 3, 0, it.d / 3]) for (let i = 0; i <= 14; i++) { const t = i / 14, sag = Math.sin(t * Math.PI) * 0.25; c.l.sph(0.045, i % 2 ? '#ffd890' : '#fff3d6', -it.w / 2 + t * it.w, h - sag, z, { ws: 5, hs: 4 }); } },
  // bistro
  waffle: (c) => { c.b.box(0.5, 0.14, 0.4, '#2a2d33', 0, 0.07, 0, { r: 0.04, s: 2 }); c.b.box(0.5, 0.12, 0.4, '#c9ced6', 0, 0.22, -0.04, { rx: -0.35 }); c.b.box(0.22, 0.03, 0.22, '#d6aa58', 0.1, 0.16, 0.1); },
  bicak: (c) => { c.b.box(0.42, 0.22, 0.06, '#3a2416', 0, 0.11, 0); for (let i = 0; i < 4; i++) c.b.box(0.03, 0.22, 0.01, '#c9ced6', -0.15 + i * 0.1, 0.3, 0.035); c.b.box(0.5, 0.03, 0.3, '#a8794e', 0, 0.015, 0.2); },
  buzVitrin: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#c9ced6', 0, 0.4, 0); b.box(it.w - 0.1, 0.12, it.d - 0.1, '#eef6fa', 0, 0.86, 0); for (let i = 0; i < 7; i++) { const x = -it.w / 2 + 0.25 + i * (it.w - 0.5) / 6; b.sph(0.1, i % 2 ? '#9fb3c0' : '#c0cdd6', x, 0.96, (i % 2 ? 0.12 : -0.12), { ws: 7, hs: 5, sx: 2.2, sy: 0.6 }); b.cone(0.06, 0.1, '#9fb3c0', x + 0.24, 0.96, (i % 2 ? 0.12 : -0.12), { rz: HP, seg: 6 }); } for (let i = 0; i < 4; i++) b.sph(0.05, '#ffd23f', -it.w / 2 + 0.4 + i * 0.4, 0.95, 0.32, { ws: 5, hs: 4 }); g.box(it.w - 0.04, 0.4, 0.03, '#d8eef6', 0, 1.1, it.d / 2 - 0.05, { rx: -0.4 }); },
  akvaryum: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#2a2d33', 0, 0.4, 0); g.box(it.w - 0.04, 1.1, it.d - 0.04, '#5fb8e0', 0, 1.36, 0); b.box(it.w, 0.06, it.d, '#2a2d33', 0, 1.94, 0); b.box(it.w - 0.1, 0.06, it.d - 0.1, '#e9d8a8', 0, 0.84, 0); for (let i = 0; i < 5; i++) b.box(0.03, 0.3 + (i % 3) * 0.12, 0.03, '#3f7a34', -it.w / 2 + 0.3 + i * 0.6, 1.0, 0, { rz: (i % 2 - 0.5) * 0.3 });
    const fg = new T.Group(); c.grp.userData.curItem.add(fg); for (let i = 0; i < 6; i++) { const f = new T.Mesh(SPH, lm(['#ff8a3a', '#ffd23f', '#e0533c', '#2ec4c4'][i % 4])); f.scale.set(0.06, 0.04, 0.025); f.position.set(-it.w / 2 + 0.3 + i * (it.w - 0.6) / 5, 1.1 + (i % 3) * 0.2, 0); f.userData.ph = i * 1.3; f.userData.w = it.w; fg.add(f); c.an.fish.push(f); } },
  mangal: (c, it) => { const { b } = c; b.box(it.w, 0.85, it.d, '#2a2d33', 0, 0.42, 0); for (let i = 0; i < 8; i++) b.box(it.w - 0.1, 0.02, 0.02, '#9aa5b0', 0, 0.9, -it.d / 2 + 0.1 + i * (it.d - 0.2) / 7); b.box(it.w - 0.2, 0.04, it.d - 0.2, '#ff6a2a', 0, 0.86, 0); b.box(it.w + 0.1, 0.06, it.d + 0.1, '#5b6068', 0, 2.4, -0.05); b.box(0.4, 0.8, 0.4, '#5b6068', 0, 2.8, -0.1);
    for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.ConeGeometry(0.07, 0.22, 6), new T.MeshBasicMaterial({ color: i % 2 ? '#ffb43a' : '#ff6a2a' })); f.position.set(-it.w / 2 + 0.2 + i * (it.w - 0.4) / 3, 1.0, 0); f.userData.ph = i; c.an.fire.push(f); c.grp.userData.curItem.add(f); }
    for (let i = 0; i < 3; i++) b.box(0.6, 0.02, 0.05, '#c97a3a', -0.2 + i * 0.2, 0.93, 0.05, { ry: 0.2 }); },
  piyano: (c) => { const { b } = c; b.box(1.4, 0.3, 1.1, '#111', 0, 0.85, 0, { r: 0.08, s: 2 }); b.box(1.2, 0.04, 0.2, '#fbfaf6', 0, 1.02, 0.5); for (let i = 0; i < 8; i++) b.box(0.03, 0.02, 0.12, '#111', -0.5 + i * 0.14, 1.04, 0.47); for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [0, 0.45]]) b.cyl(0.04, 0.04, 0.72, '#111', x, 0.36, z, { seg: 6 }); b.box(1.3, 0.03, 1.0, '#111', 0, 1.2, -0.25, { rx: 0.7 }); b.box(0.5, 0.05, 0.3, '#111', 0, 0.48, 0.85); },
  // kırtasiye
  stand: (c, it) => { const { b } = c; b.box(it.w, 1.3, it.d, '#e9eef2', 0, 0.65, 0); for (const s of [-1, 1]) for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) b.box(0.12, 0.25, 0.03, ['#e0533c', '#2f6fdb', '#ffd23f', '#49b96a', '#8a6bbf'][(i + r) % 5], -it.w / 2 + 0.15 + i * (it.w - 0.3) / 6, 0.35 + r * 0.38, s * (it.d / 2 + 0.02)); },
  fotokopi: (c) => { const { b, l } = c; b.box(0.8, 0.9, 0.6, '#e9eef2', 0, 0.45, 0); b.box(0.82, 0.12, 0.62, '#9aa5b0', 0, 0.96, 0); b.box(0.5, 0.04, 0.3, '#fbfaf6', 0.05, 0.62, 0.36); l.plane(0.16, 0.08, '#7fe0a8', 0.28, 0.98, 0.315); for (let i = 0; i < 3; i++) b.box(0.6, 0.02, 0.4, '#fbfaf6', 0, 0.2 + i * 0.05, 0.32); },
  pos: (c) => { c.b.box(0.1, 0.16, 0.06, '#2a2d33', 0, 0.08, 0, { rx: -0.3 }); c.l.plane(0.07, 0.05, '#7fd0ff', 0, 0.12, 0.035, { rx: -0.3 }); },
  laminasyon: (c) => { c.b.box(0.45, 0.12, 0.25, '#3a3d42', 0, 0.06, 0); c.b.box(0.35, 0.01, 0.2, '#fbfaf6', 0, 0.13, 0.12); c.l.sph(0.015, '#ff4a3a', 0.18, 0.12, 0.12, { ws: 5, hs: 4 }); },
  kalemVitrin: (c, it) => { const { b, g, l } = c; b.box(it.w, 0.9, it.d, '#2a2d33', 0, 0.45, 0); g.box(it.w - 0.04, 0.25, it.d - 0.04, '#d8eef6', 0, 1.03, 0); l.box(it.w - 0.1, 0.01, it.d - 0.1, '#fff8e8', 0, 1.14, 0); for (let i = 0; i < 10; i++) b.cyl(0.012, 0.012, 0.16, ['#111', '#c9a23a', '#7a2a1d', '#1d4f86'][i % 4], -it.w / 2 + 0.12 + i * (it.w - 0.24) / 9, 0.93, 0, { rx: HP, seg: 5 }); },
  oyuncak: (c, it) => { const { b } = c; b.box(it.w, 0.5, it.d, '#ffb627', 0, 0.25, 0); b.sph(0.18, '#a8794e', -0.35, 0.68, 0, { ws: 8, hs: 6 }); b.sph(0.13, '#a8794e', -0.35, 0.92, 0, { ws: 8, hs: 6 }); b.box(0.3, 0.2, 0.2, '#e0533c', 0.1, 0.6, 0.05); b.cyl(0.06, 0.06, 0.04, '#111', 0.0, 0.52, 0.15, { rx: HP, seg: 8 }); b.cyl(0.06, 0.06, 0.04, '#111', 0.2, 0.52, 0.15, { rx: HP, seg: 8 }); b.sph(0.12, '#2f6fdb', 0.42, 0.62, 0, { ws: 8, hs: 6 }); },
  yazici3d: (c) => { const { b, l } = c; b.box(0.5, 0.05, 0.45, '#2a2d33', 0, 0.025, 0); for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) b.box(0.03, 0.5, 0.03, '#9aa5b0', x, 0.27, z); b.box(0.5, 0.04, 0.45, '#2a2d33', 0, 0.52, 0); b.box(0.1, 0.08, 0.08, '#e0533c', 0.05, 0.42, 0); b.sph(0.06, '#e8e4dc', 0, 0.1, 0, { ws: 7, hs: 5 }); l.sph(0.012, '#7fe0a8', 0.2, 0.52, 0.23, { ws: 4, hs: 3 }); },
  okuma: (c) => { const { b, l } = c; for (const [x, cc] of [[-0.4, '#e0533c'], [0.4, '#2f7fb3']] as [number, string][]) b.sph(0.32, cc, x, 0.25, 0, { ws: 10, hs: 6, sy: 0.7 }); b.cyl(0.02, 0.02, 1.4, '#2a2d33', 0.0, 0.7, -0.4, { seg: 5 }); b.cone(0.18, 0.2, '#f4ead2', 0, 1.45, -0.4, { seg: 10 }); l.sph(0.06, '#ffe6b0', 0, 1.36, -0.4, { ws: 6, hs: 4 }); b.box(0.5, 0.06, 0.35, '#ffd23f', 0, 0.06, 0.4); },
  // okul + kantin
  tahta: (c, it) => { const { b } = c; b.box(it.w + 0.15, 1.25, 0.06, '#8a6a4a', 0, it.y || 1.6, 0); b.box(it.w, 1.1, 0.04, '#24453a', 0, it.y || 1.6, 0.03); for (let i = 0; i < 5; i++) b.box(0.6 + (i % 3) * 0.4, 0.03, 0.01, '#e8f0e8', -it.w / 2 + 0.7 + (i % 2) * 1.6, (it.y || 1.6) + 0.35 - i * 0.16, 0.055); b.box(it.w, 0.05, 0.12, '#8a6a4a', 0, (it.y || 1.6) - 0.62, 0.06); },
  ogretmen: (c, it) => { const { b } = c; b.box(it.w, 0.75, it.d, '#8a6a4a', 0, 0.375, 0); b.box(0.3, 0.06, 0.22, '#fbfaf6', 0.2, 0.78, 0); b.sph(0.08, '#e0533c', -0.4, 0.82, 0, { ws: 7, hs: 5 }); },
  sira: (c, it) => { const { b } = c; b.box(it.w, 0.05, it.d, '#c9a46a', 0, 0.68, 0); for (const s of [-1, 1]) b.box(0.04, 0.68, it.d - 0.1, '#3a3d42', s * (it.w / 2 - 0.05), 0.34, 0); b.box(it.w, 0.04, 0.3, '#c9a46a', 0, 0.42, 0.42); b.box(it.w, 0.3, 0.04, '#c9a46a', 0, 0.6, 0.58);
  },
  dolap: (c, it) => { const { b } = c; const n = Math.max(2, Math.round(it.w / 0.45)); for (let i = 0; i < n; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / n; b.box(it.w / n - 0.03, 1.8, it.d, i % 2 ? '#3f7fb3' : '#2f6f9a', x, 0.9, 0); b.box(0.04, 0.12, 0.02, '#c9ced6', x + 0.12, 1.0, it.d / 2 + 0.01); for (let k = 0; k < 3; k++) b.box(0.25, 0.02, 0.01, '#1f4f6f', x, 1.55 + k * 0.05, it.d / 2 + 0.01); } },
  pano: (c, it) => { const tx = signTex(it.txt || 'DUYURULAR', '#c9a46a', '#3a2416', it.w / 0.9), p = new T.Mesh(new T.PlaneGeometry(it.w, 0.9), new T.MeshBasicMaterial({ map: tx })); p.position.set(0, it.y || 1.6, 0.04); c.grp.userData.cur.add(p); for (let i = 0; i < 5; i++) c.b.box(0.25, 0.3, 0.01, ['#fbfaf6', '#ffd23f', '#f2a2b3', '#a9d6ec'][i % 4], -it.w / 2 + 0.3 + i * (it.w - 0.6) / 4, (it.y || 1.6) - 0.15, 0.05); },
  bolme: (c, it) => { c.b.box(it.w, 1.4, it.d, '#e9dfc8', 0, 0.7, 0); c.b.box(it.w + 0.04, 0.06, it.d, '#8a6a4a', 0, 1.42, 0); },
  tostMak: (c) => { c.b.box(0.42, 0.12, 0.36, '#c9ced6', 0, 0.06, 0, { r: 0.03, s: 2 }); c.b.box(0.42, 0.1, 0.36, '#9aa5b0', 0, 0.2, -0.05, { rx: -0.25 }); c.b.box(0.03, 0.03, 0.2, '#111', 0, 0.26, 0.2); c.l.sph(0.012, '#ff4a3a', 0.18, 0.1, 0.18, { ws: 4, hs: 3 }); },
  buzdolap: (c, it) => { const { b, g, l } = c; b.box(it.w, 1.9, it.d, '#e0533c', 0, 0.95, 0); g.box(it.w - 0.12, 1.5, 0.02, '#d8eef6', 0, 1.0, it.d / 2 + 0.01); l.box(it.w - 0.14, 0.02, 0.02, '#fff8e8', 0, 1.72, it.d / 2 - 0.02); for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) b.cyl(0.04, 0.04, 0.22, ['#fbfaf6', '#ffd23f', '#2f6fdb', '#49b96a'][(i + r) % 4], -it.w / 2 + 0.15 + i * (it.w - 0.3) / 4, 0.4 + r * 0.36, it.d / 2 - 0.15, { seg: 6 }); b.box(it.w, 0.3, it.d + 0.02, '#ffffff', 0, 1.85, 0); },
  semaver: (c) => { c.b.cyl(0.13, 0.16, 0.42, '#c9a23a', 0, 0.21, 0, { seg: 12 }); c.b.cyl(0.06, 0.1, 0.12, '#c9a23a', 0, 0.48, 0, { seg: 10 }); c.b.cyl(0.07, 0.06, 0.1, '#7a2a1d', 0, 0.6, 0, { seg: 10 }); c.b.cyl(0.015, 0.015, 0.1, '#c9a23a', 0.12, 0.12, 0.08, { rz: HP, seg: 4 }); for (let i = 0; i < 4; i++) c.b.cyl(0.025, 0.02, 0.07, '#b0281e', 0.25, 0.035, -0.12 + i * 0.08, { seg: 6 }); },
  semaverDev: (c) => { c.b.box(0.8, 0.8, 0.8, '#5a3b2a', 0, 0.4, 0); c.b.cyl(0.28, 0.34, 0.9, '#b87333', 0, 1.25, 0, { seg: 16 }); c.b.cyl(0.12, 0.22, 0.25, '#b87333', 0, 1.82, 0, { seg: 14 }); c.b.cyl(0.14, 0.12, 0.2, '#7a2a1d', 0, 2.04, 0, { seg: 12 }); c.b.cyl(0.03, 0.03, 0.2, '#c9a23a', 0, 1.0, 0.35, { rx: HP, seg: 6 }); for (let i = 0; i < 8; i++) c.b.cyl(0.025, 0.02, 0.07, '#b0281e', -0.3 + (i % 4) * 0.2, 0.84, 0.25 + Math.floor(i / 4) * 0.08, { seg: 6 }); },
  firinK: (c, it) => { const { b, l } = c; b.box(it.w, 0.9, it.d, '#5b6068', 0, 0.45, 0); b.box(it.w * 0.8, 0.45, it.d * 0.75, '#c9ced6', 0, 1.15, 0); c.g.box(it.w * 0.5, 0.25, 0.02, '#ffcf8a', -0.05, 1.15, it.d * 0.38); l.box(it.w * 0.46, 0.2, 0.01, '#ffb866', -0.05, 1.15, it.d * 0.37); },
  meyve: (c, it) => { c.b.box(it.w, 0.8, it.d, '#6f9e4f', 0, 0.4, 0); for (let i = 0; i < 9; i++) c.b.sph(0.07, ['#e0533c', '#ffd23f', '#49b96a', '#ff8a3a'][i % 4], -it.w / 2 + 0.15 + (i % 3) * 0.3, 0.86, -0.15 + Math.floor(i / 3) * 0.15, { ws: 6, hs: 5 }); },
  masaK: (c, it) => { const { b } = c; b.box(it.w, 0.05, it.d, '#e0533c', 0, 0.74, 0); for (const s of [-1, 1]) { b.box(0.05, 0.72, it.d - 0.1, '#5b6068', s * (it.w / 2 - 0.1), 0.36, 0); b.box(it.w, 0.04, 0.3, '#5b6068', 0, 0.44, s * (it.d / 2 + 0.25)); } },
  ekran: (c, it) => { c.b.box(it.w + 0.08, it.w * 0.58 + 0.08, 0.06, '#111', 0, it.y || 2.0, 0); const mm = new T.MeshBasicMaterial({ color: '#2a8fd0' }); const s = new T.Mesh(new T.PlaneGeometry(it.w, it.w * 0.58), mm); s.position.set(0, it.y || 2.0, 0.035); c.grp.userData.curItem.add(s); c.an.screens.push(mm); },
  izgara: (c, it) => F.mangal(c, it),
  // AVM
  zemin: (c, it) => { const [a, b2] = it.c === 'mermer' ? ['#efe9df', '#c9a23a'] : it.c === 'avm' ? ['#e9e6e0', '#b9b3a6'] : it.c === 'morg' ? ['#9aa3a8', '#7c858a'] : ['#e3eef2', '#bcd2dc']; void a; for (let i = 1; i < Math.round(it.w / 1.2); i++) c.b.box(0.02, 0.003, it.d, b2, -it.w / 2 + i * it.w / Math.round(it.w / 1.2), 0.002, 0); for (let i = 1; i < Math.round(it.d / 1.2); i++) c.b.box(it.w, 0.003, 0.02, b2, 0, 0.002, -it.d / 2 + i * it.d / Math.round(it.d / 1.2)); },
  magaza: (c, it) => { const { b, g, l } = c; b.box(it.w, 2.8, it.d, '#f2efe9', 0, 1.4, 0); g.plane(it.w - 0.3, 2.0, '#9cc3d6', 0, 1.15, it.d / 2 + 0.01); l.plane(it.w - 0.4, 1.9, '#fff3d6', 0, 1.15, it.d / 2 - 0.02); b.box(it.w, 0.5, 0.08, it.c || '#e0533c', 0, 2.5, it.d / 2 + 0.04);
    const tx = signTex(it.txt || 'MAĞAZA', it.c || '#e0533c', '#ffffff', it.w / 0.45), p = new T.Mesh(new T.PlaneGeometry(it.w - 0.2, 0.42), new T.MeshBasicMaterial({ map: tx })); p.position.set(0, 2.5, it.d / 2 + 0.09); c.grp.userData.curItem.add(p);
    for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.6 + i * (it.w - 1.2) / 3; b.cyl(0.12, 0.12, 0.9, ['#c94f6d', '#ffd23f', '#2f7fb3', '#49b96a'][(i + it.txt!.length) % 4], x, 0.9, it.d / 2 - 0.35, { seg: 8 }); b.sph(0.1, SK[i % 4], x, 1.45, it.d / 2 - 0.35, { ws: 6, hs: 5 }); } },
  yuruyen: (c, it) => { const { b, g } = c; for (let i = 0; i < 12; i++) b.box(it.w - 0.2, 0.12, it.d / 12, '#5b6068', 0, 0.1 + i * 0.28, -it.d / 2 + (i + 0.5) * it.d / 12); for (const s of [-1, 1]) { g.box(0.04, 1.0, it.d, '#d8eef6', s * (it.w / 2 - 0.05), 0.6 + 1.6, 0, { rx: -Math.atan2(3.3, it.d) }); b.box(0.08, 0.08, it.d * 1.1, '#2a2d33', s * (it.w / 2 - 0.05), 2.0, 0, { rx: -Math.atan2(3.3, it.d) }); } b.box(it.w, 0.2, 0.8, '#5b6068', 0, 3.3, -it.d / 2 - 0.2); },
  bank: (c, it) => { c.b.box(it.w, 0.06, it.d, '#a8794e', 0, 0.45, 0); c.b.box(0.06, 0.45, it.d - 0.05, '#3a3d42', -it.w / 2 + 0.2, 0.22, 0); c.b.box(0.06, 0.45, it.d - 0.05, '#3a3d42', it.w / 2 - 0.2, 0.22, 0); },
  dus: (c, it) => { const { b, g } = c; b.box(it.w, 0.06, it.d, '#cfdde3', 0, 0.03, 0); g.box(0.03, 2.0, it.d, '#d8eef6', -it.w / 2, 1.0, 0); b.cyl(0.02, 0.02, 0.4, '#c9ced6', 0, 2.0, -it.d / 2 + 0.2, { rx: HP, seg: 5 }); b.cyl(0.1, 0.1, 0.03, '#c9ced6', 0, 1.9, -it.d / 2 + 0.4, { seg: 10 }); },
  benmari: (c, it) => { const { b, g } = c; b.box(it.w, 0.08, it.d, '#c9ced6', 0, 0.04, 0); const P = ['#c0392b', '#e9d27a', '#7a4a2a', '#6f9e4f']; for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.box(0.34, 0.1, 0.4, '#9aa5b0', x, 0.1, 0); b.box(0.3, 0.02, 0.36, P[i], x, 0.15, 0); } g.box(it.w, 0.02, it.d * 0.8, '#d8eef6', 0, 0.45, 0.02, { rx: -0.2 }); },
  corba: (c) => { c.b.cyl(0.25, 0.22, 0.42, '#c9ced6', 0, 0.21, 0, { seg: 14 }); c.b.cyl(0.23, 0.23, 0.02, '#c8642a', 0, 0.4, 0, { seg: 14 }); c.b.cyl(0.015, 0.015, 0.5, '#9aa5b0', 0.1, 0.55, 0, { seg: 4, rz: 0.4 }); },
  tasFirin: (c, it) => { const { b, l } = c; b.box(it.w, 0.8, it.d, '#8a6a4a', 0, 0.4, 0); b.sph(it.w * 0.45, '#b9805a', 0, 0.8, -0.05, { ws: 14, hs: 7, sy: 0.75, sz: it.d / it.w }); b.box(0.5, 0.36, 0.06, '#2a1a10', 0, 1.0, it.d / 2 - 0.05); l.plane(0.42, 0.28, '#ff8a3a', 0, 0.98, it.d / 2 - 0.02); b.cyl(0.1, 0.12, 0.8, '#5a3b2a', 0.25, 1.9, -0.2, { seg: 8 });
    for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.ConeGeometry(0.06, 0.18, 6), new T.MeshBasicMaterial({ color: '#ffb43a' })); f.position.set(-0.12 + i * 0.12, 0.92, it.d / 2 - 0.18); f.userData.ph = i * 2; c.an.fire.push(f); c.grp.userData.curItem.add(f); } },
  doner: (c) => { const { b } = c; b.box(0.5, 0.06, 0.5, '#5b6068', 0, 0.9, 0); b.cyl(0.015, 0.015, 0.9, '#c9ced6', 0, 1.35, 0, { seg: 4 }); const d = new T.Mesh(new T.CylinderGeometry(0.12, 0.2, 0.7, 12), lm('#9a5a2a')); d.position.set(0, 1.3, 0); c.an.spin.push(d); c.grp.userData.curItem.add(d); b.box(0.5, 0.8, 0.12, '#2a2d33', 0, 1.3, -0.3); c.l.box(0.4, 0.6, 0.02, '#ff8a3a', 0, 1.3, -0.23); b.box(0.5, 0.9, 0.5, '#c9ced6', 0, 0.45, 0); },
  tatliVitrin: (c, it) => F.vitrin(c, it),
  ustaOcak: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, '#c9ced6', 0, 0.45, 0); for (const x of [-0.25, 0.25]) { b.cyl(0.14, 0.14, 0.02, '#111', x, 0.91, 0, { seg: 12 }); b.cyl(0.16, 0.14, 0.16, '#5b6068', x, 1.0, 0, { seg: 12 }); } const f = new T.Mesh(new T.ConeGeometry(0.1, 0.12, 8), new T.MeshBasicMaterial({ color: '#3a8fff' })); f.position.set(0.25, 0.94, 0); f.userData.ph = 1; c.an.fire.push(f); c.grp.userData.curItem.add(f); b.box(it.w + 0.1, 0.06, it.d + 0.1, '#9aa5b0', 0, 2.3, -0.05); },
  // kafeterya
  langirt: (c, it) => { const { b } = c; b.box(it.w, 0.2, it.d, '#5a3b2a', 0, 0.85, 0); b.box(it.w - 0.1, 0.02, it.d - 0.1, '#2f9e5a', 0, 0.96, 0); for (const [x, z] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) b.box(0.08, 0.75, 0.08, '#3a2416', x, 0.38, z); for (let i = 0; i < 4; i++) { b.cyl(0.012, 0.012, it.d + 0.5, '#c9ced6', -0.45 + i * 0.3, 1.02, 0, { rx: HP, seg: 4 }); for (let k = 0; k < 3; k++) b.box(0.04, 0.12, 0.05, i % 2 ? '#e0533c' : '#2f6fdb', -0.45 + i * 0.3, 1.0, -0.2 + k * 0.2); } b.sph(0.025, '#fbfaf6', 0.05, 0.99, 0.02, { ws: 6, hs: 4 }); },
  kupa: (c, it) => { const { b, g } = c; b.box(it.w, 0.9, it.d, '#2a2d33', 0, 0.45, 0); g.box(it.w - 0.04, 0.8, it.d - 0.04, '#d8eef6', 0, 1.3, 0); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.cyl(0.05, 0.08, 0.06, '#c9a23a', x, 0.94, 0, { seg: 8 }); b.cyl(0.02, 0.02, 0.12, '#c9a23a', x, 1.03, 0, { seg: 5 }); b.cyl(0.09, 0.04, 0.16, '#ffd23f', x, 1.17, 0, { seg: 10 }); } },
  formaDuvar: (c, it) => { for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.25 + i * (it.w - 0.5) / 3, cc = ['#e0533c', '#2f7fb3', '#ffd23f', '#2f9e5a'][i]; c.b.box(0.4, 0.5, 0.03, cc, x, it.y || 1.6, 0.02); c.b.box(0.6, 0.15, 0.03, cc, x, (it.y || 1.6) + 0.2, 0.02); c.b.box(0.46, 0.56, 0.02, '#c9a23a', x, it.y || 1.6, 0.0); } },
  vip: (c, it) => { const { b } = c; for (let i = 0; i < 2; i++) { const z = -it.d / 2 + 0.35 + i * 0.7; b.box(it.w, 0.4, 0.55, '#c9a23a', 0, 0.25, z); b.box(it.w, 0.55, 0.12, '#1f2a44', 0, 0.62, z - 0.25); } },
  // banka
  gise: (c, it) => { const { b, g, l } = c; counter(c, it, '#1f3a5f', '#c9a23a'); for (let i = 0; i <= 3; i++) { const x = -it.w / 2 + i * it.w / 3; b.box(0.06, 1.1, 0.06, '#c9a23a', x, 1.6, 0); } g.box(it.w, 1.1, 0.03, '#d8eef6', 0, 1.6, 0.02); b.box(it.w + 0.1, 0.08, 0.2, '#c9a23a', 0, 2.18, 0);
    for (let i = 0; i < 3; i++) {   // DKN-13: yalnız ortadaki pencere açık (yeşil, memur oturur), yanlardaki ikisi KAPALI
      const x = -it.w / 2 + (i + 0.5) * it.w / 3, open = i === 1; l.box(0.3, 0.2, 0.02, open ? '#7fe0a8' : '#e0533c', x, 2.4, 0.05); b.box(0.32, 0.22, 0.04, '#111', x, 2.4, 0.02); b.box(0.5, 0.04, 0.3, '#2a2d33', x, 1.05, -0.2);
      if (open) chair(b, x, -0.75, Math.PI, '#1f3a5f');
      else { b.box(it.w / 3 - 0.14, 1.0, 0.04, '#8a939c', x, 1.6, 0.01); const p = new T.Mesh(new T.PlaneGeometry(0.5, 0.2), new T.MeshBasicMaterial({ map: signTex('KAPALI', '#7a1f1f', '#fbfaf6', 2.5) })); p.position.set(x, 1.6, 0.04); c.grp.userData.cur.add(p); }
    } },
  atm: (c) => { const { b, l } = c; b.box(0.7, 1.6, 0.6, '#3a3d42', 0, 0.8, 0); b.box(0.7, 0.2, 0.6, '#c9a23a', 0, 1.65, 0); l.plane(0.38, 0.26, '#7fd0ff', 0, 1.25, 0.31); b.box(0.4, 0.06, 0.2, '#111', 0, 0.98, 0.35); },
  kasaKapi: (c) => { c.b.cyl(0.75, 0.75, 0.15, '#9aa5b0', 0, 1.1, 0.05, { rx: HP, seg: 24 }); c.b.cyl(0.6, 0.6, 0.06, '#c9ced6', 0, 1.1, 0.14, { rx: HP, seg: 24 }); c.b.tor(0.25, 0.03, '#c9a23a', 0, 1.1, 0.19, { ts: 16 }); for (let i = 0; i < 3; i++) c.b.box(0.5, 0.04, 0.04, '#c9a23a', 0, 1.1, 0.2, { rz: i * 1.047 }); },
  kuyruk: (c, it) => { const pts: [number, number][] = [[-it.w / 2, -it.d / 2], [it.w / 2, -it.d / 2], [it.w / 2, it.d / 2], [-it.w / 2, it.d / 2]]; for (const [x, z] of pts) { c.b.cyl(0.15, 0.15, 0.04, '#c9a23a', x, 0.02, z, { seg: 10 }); c.b.cyl(0.03, 0.03, 0.9, '#c9a23a', x, 0.45, z, { seg: 6 }); } c.b.box(it.w, 0.06, 0.02, '#9a1f2a', 0, 0.8, -it.d / 2); c.b.box(0.02, 0.06, it.d, '#9a1f2a', it.w / 2, 0.8, 0); },
  // hastane / acil / morg
  resepsiyon: (c, it) => { counter(c, it, '#7fb4d8', '#f4f6f8'); c.b.box(0.5, 0.3, 0.04, '#111', -0.6, 1.25, -0.15); c.l.plane(0.44, 0.24, '#7fd0ff', -0.6, 1.25, -0.125); },
  yatak: (c, it) => { const { b } = c; b.box(it.w, 0.1, it.d, '#c9ced6', 0, 0.55, 0); b.box(it.w - 0.06, 0.12, it.d - 0.06, '#fbfaf6', 0, 0.64, 0); b.box(it.w, 0.5, 0.06, '#9aa5b0', 0, 0.8, -it.d / 2); for (const [x, z] of [[-0.42, -0.9], [0.42, -0.9], [-0.42, 0.9], [0.42, 0.9]]) b.box(0.04, 0.55, 0.04, '#9aa5b0', x, 0.27, z); b.box(0.36, 0.08, 0.24, '#ffffff', 0, 0.73, -it.d / 2 + 0.25);
    b.cyl(0.02, 0.02, 1.6, '#c9ced6', it.w / 2 + 0.15, 0.8, -it.d / 2 + 0.2, { seg: 5 }); b.box(0.12, 0.2, 0.06, '#d8eef6', it.w / 2 + 0.15, 1.5, -it.d / 2 + 0.2); },
  perde: (c, it) => { c.b.box(0.03, 0.03, it.d, '#c9ced6', 0, 2.3, 0); for (let i = 0; i < 6; i++) c.b.box(0.05, 1.7, it.d / 6, i % 2 ? '#a9cbe0' : '#bcd8ea', 0, 1.35, -it.d / 2 + (i + 0.5) * it.d / 6, { ry: (i % 2 - 0.5) * 0.4 }); },
  ilac: (c, it) => { const { b, g } = c; b.box(it.w, 1.9, it.d, '#f4f6f8', 0, 0.95, 0); g.box(it.w - 0.06, 0.9, 0.02, '#d8eef6', 0, 1.4, it.d / 2 + 0.01); shelfGoods(c, it.w - 0.2, 2, 1.0, it.d / 2 - 0.12, ['#fbfaf6', '#e0533c', '#7fb4d8', '#ffd23f']); b.box(0.2, 0.2, 0.02, '#d93a3a', 0, 1.75, it.d / 2 + 0.02); },
  sedye: (c, it) => F.yatak(c, it),
  monitor: (c) => { c.b.cyl(0.03, 0.03, 1.4, '#9aa5b0', 0, 0.7, 0, { seg: 6 }); c.b.box(0.4, 0.3, 0.12, '#2a2d33', 0, 1.5, 0); const mm = new T.MeshBasicMaterial({ color: '#1a9a4a' }); const s = new T.Mesh(new T.PlaneGeometry(0.34, 0.24), mm); s.position.set(0, 1.5, 0.065); c.grp.userData.curItem.add(s); c.an.screens.push(mm); },
  cekmece: (c, it) => { const { b } = c; b.box(it.w, 2.2, it.d, '#9aa5b0', 0, 1.1, 0); for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) { const x = -it.w / 2 + (i + 0.5) * it.w / 3, y = 0.4 + r * 0.7; b.box(it.w / 3 - 0.08, 0.6, 0.03, '#c9ced6', x, y, it.d / 2 + 0.01); b.box(0.2, 0.04, 0.05, '#5b6068', x, y + 0.1, it.d / 2 + 0.04); b.box(0.12, 0.08, 0.01, '#fbfaf6', x - 0.2, y - 0.12, it.d / 2 + 0.03); } },
  otopsi: (c, it) => { const { b } = c; b.box(it.w, 0.06, it.d, '#c9ced6', 0, 0.9, 0); b.cyl(0.1, 0.14, 0.88, '#9aa5b0', 0, 0.44, 0, { seg: 8 }); b.box(it.w - 0.2, 0.22, it.d - 0.15, '#e9eef2', 0, 1.03, 0, { r: 0.08, s: 2 }); b.box(0.12, 0.08, 0.06, '#e8c8a8', it.w / 2 - 0.15, 0.95, 0.15); },
  // büfe salonları
  gozleme: (c, it) => { const { b, g } = c; b.box(it.w, 0.8, it.d, '#8a5a3a', 0, 0.4, 0); b.cyl(0.38, 0.38, 0.04, '#2a2d33', 0, 0.84, 0, { seg: 18 }); b.cyl(0.32, 0.32, 0.01, '#e9c88a', 0, 0.87, 0, { seg: 18 }); b.cyl(0.015, 0.015, 0.7, '#e9e0c8', -0.45, 0.88, 0.1, { rz: HP, seg: 4 }); g.box(it.w, 0.8, 0.03, '#d8eef6', 0, 1.4, it.d / 2); },   // BUF-20: gözlemeci figürü yok (salonda yalnız işe alınmış gerçek personel)
  balKaymak: (c, it) => { const { b } = c; b.box(it.w, 0.85, it.d, '#5a3b2a', 0, 0.42, 0); for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3; b.cyl(0.12, 0.12, 0.04, '#fbfaf6', x, 0.88, 0, { seg: 12 }); b.box(0.14, 0.06, 0.1, i % 2 ? '#e8a52a' : '#fbf3e4', x, 0.92, 0); } b.box(0.3, 0.3, 0.06, '#e8a52a', 0, 1.1, -0.2); },
  sarkuteri: (c, it) => { F.vitrin(c, it); for (let i = 0; i < 5; i++) c.b.cyl(0.08, 0.08, 0.1, ['#f2d27a', '#e8c070', '#fbf3e4', '#6f9e4f', '#3a2416'][i], -it.w / 2 + 0.25 + i * (it.w - 0.5) / 4, 0.74, 0, { seg: 10 }); },
  buzTezgah: (c, it) => F.buzVitrin(c, it),
  mezeDolap: (c, it) => { F.vitrin(c, it); for (let i = 0; i < 8; i++) c.b.box(0.16, 0.05, 0.16, ['#e0533c', '#6f9e4f', '#fbf3e4', '#ffd23f'][i % 4], -it.w / 2 + 0.2 + (i % 4) * (it.w - 0.4) / 3, 0.73 + Math.floor(i / 4) * 0.2, 0); },
  // ---- büfe mutfağı (content/mutfak.ts) ----
  sogukOda: (c, it) => { const { b, l } = c; b.box(it.w, 2.3, it.d, celik(c, '#efe6d2', '#e9eef2'), 0, 1.15, 0, c.esnaf ? { r: 0.12, s: 3 } : undefined); b.box(it.w - 0.2, 2.0, 0.05, celik(c, '#e2d6bc', '#cfd6dc'), 0, 1.1, it.d / 2 + 0.02); b.box(0.06, 0.5, 0.06, '#5b6068', it.w / 2 - 0.25, 1.1, it.d / 2 + 0.07); l.box(0.34, 0.07, 0.01, '#bfe9ff', 0, 2.15, it.d / 2 + 0.03); for (let i = 0; i < 3; i++) b.box(0.5, 0.025, 0.02, '#9aa5b0', 0, 0.5 + i * 0.5, it.d / 2 + 0.05); },
  ocakK: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, celik(c, '#efe3c4', '#c9ced6'), 0, 0.45, 0); b.box(it.w - 0.1, 0.05, it.d - 0.1, celik(c, '#2a2d33', '#8a9098'), 0, 0.92, 0);
    if (c.esnaf) { b.box(it.w - 0.2, 0.42, 0.02, '#2a2d33', 0, 0.42, it.d / 2 + 0.01); b.box(it.w - 0.28, 0.34, 0.02, '#d8cba8', 0, 0.42, it.d / 2 + 0.02); for (let i = 0; i < 4; i++) b.cyl(0.035, 0.035, 0.04, '#2f7f8f', -it.w / 2 + 0.3 + i * (it.w - 0.6) / 3, 0.78, it.d / 2 + 0.02, { rx: HP, seg: 8 }); }   // emaye fırın kapağı, düğmeler
    for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.3 + i * (it.w - 0.6) / 3; b.cyl(0.14, 0.14, 0.02, '#111', x, 0.96, 0, { seg: 12 });
      if (i % 2 === 0) { b.cyl(0.17, 0.15, 0.26, '#9aa2ab', x, 1.1, 0, { seg: 12 }); b.cyl(0.18, 0.18, 0.03, '#5b6068', x, 1.24, 0, { seg: 12 }); const f = new T.Mesh(new T.ConeGeometry(0.08, 0.1, 6), new T.MeshBasicMaterial({ color: '#3a8fff' })); f.position.set(x, 0.97, it.d * 0.3); f.userData.ph = i; c.an.fire.push(f); c.grp.userData.curItem.add(f); }
      else { b.cyl(0.13, 0.1, 0.12, '#2a2d33', x, 1.02, 0, { seg: 10 }); } } },
  izgaraK: (c, it) => { const { b, l } = c; b.box(it.w, 0.9, it.d, celik(c, '#a5532f', '#8a9098'), 0, 0.45, 0); if (c.esnaf) for (let r = 0; r < 4; r++) b.box(it.w + 0.01, 0.015, it.d + 0.01, '#d9c8a8', 0, 0.2 + r * 0.2, 0); /* esnaf: tuğla ocakbaşı */ b.box(it.w - 0.08, 0.06, it.d - 0.08, '#1d1d1d', 0, 0.93, 0); for (let i = 0; i < 7; i++) b.box(it.w - 0.2, 0.02, 0.025, '#5b6068', 0, 0.97, -it.d / 2 + 0.12 + i * (it.d - 0.24) / 6); l.box(it.w - 0.3, 0.02, 0.06, '#ff6a2a', 0, 0.9, it.d / 2 - 0.02); for (let i = 0; i < 3; i++) b.box(0.3, 0.05, 0.18, ['#8a3a2a', '#9a5a2a', '#7a2a1d'][i], -0.4 + i * 0.4, 0.99, 0.05); },
  fritoz: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, celik(c, '#c0392b', '#aab3bb'), 0, 0.45, 0); for (const s of [-1, 1]) { b.box(it.w / 2 - 0.12, 0.06, it.d - 0.2, '#33373b', s * it.w / 4, 0.93, 0); b.box(it.w / 2 - 0.2, 0.02, it.d - 0.3, '#e9b84a', s * it.w / 4, 0.97, 0); b.box(0.04, 0.04, 0.34, '#1d1d1d', s * it.w / 4, 1.04, it.d / 2 - 0.05); } },
  /** 2026-11-21 salon pass penceresi (mutfak servis koridoruna açılan duvar boşluğu): koyu boşluk, ısı lambası, çelik raf, zil; tabaklar sim'den (an.pasTabak) */
  salonPass: (c, it) => { const { b, l } = c, fn = c.fine; b.box(it.w + 0.2, 1.3, 0.06, '#26292e', 0, 0.55, -it.d / 2 + 0.02); l.plane(it.w - 0.1, 1.0, '#ffcf8a', 0, 0.55, -it.d / 2 + 0.06);
    b.box(it.w + 0.1, 0.06, it.d + 0.1, fn ? '#c9a24a' : '#e9eef2', 0, 0, 0.02); for (const s2 of [-1, 1]) b.box(0.08, 1.4, 0.12, fn ? '#c9a24a' : '#9aa2ab', s2 * (it.w / 2 + 0.1), 0.6, -it.d / 2 + 0.05);
    b.box(it.w + 0.3, 0.1, 0.16, fn ? '#c9a24a' : '#9aa2ab', 0, 1.27, -it.d / 2 + 0.08); l.box(it.w - 0.2, 0.04, 0.12, '#ff9a4a', 0, 1.18, -it.d / 2 + 0.15);
    b.cyl(0.05, 0.06, 0.05, '#c9a24a', it.w / 2 - 0.12, 0.05, 0.05, { seg: 8 }); },
  pass: (c, it) => { const { b, l } = c; b.box(it.w, 0.95, it.d, celik(c, '#8a5a3a', '#9aa5b0'), 0, 0.475, 0); b.box(it.w + 0.06, 0.06, it.d + 0.08, celik(c, '#d6aa78', '#e9eef2'), 0, 0.98, 0.02); for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.4 + i * (it.w - 0.8) / 2; b.cyl(0.02, 0.02, 0.55, '#c9ced6', x, 1.3, -0.2, { seg: 5 }); l.box(0.5, 0.05, 0.3, '#ff9a4a', x, 1.58, -0.12); }   // tabaklar sabit yığın değil: sim'in pass rafı (BUF-05, buildRoom an.pasTabak)
    b.cyl(0.07, 0.08, 0.05, '#c9a24a', it.w / 2 - 0.25, 1.04, 0.3, { seg: 8 }); b.cyl(0.02, 0.02, 0.05, '#c9a24a', it.w / 2 - 0.25, 1.09, 0.3, { seg: 5 }); },
  bulasik: (c, it) => { const { b } = c; b.box(it.w, 0.9, it.d, celik(c, '#7a4a2a', '#9aa5b0'), 0, 0.45, 0); b.box(it.w + 0.04, 0.05, it.d + 0.04, celik(c, '#f4f2ec', '#e9eef2'), 0, 0.93, 0); for (const s of [-1, 1]) b.box(0.7, 0.04, it.d - 0.3, '#33373b', s * (it.w / 4 + 0.05), 0.96, 0); b.cyl(0.02, 0.02, 0.4, '#c9ced6', 0, 1.15, -it.d / 2 + 0.15, { seg: 5 }); b.cyl(0.015, 0.015, 0.2, '#c9ced6', 0, 1.35, -it.d / 2 + 0.25, { rx: HP, seg: 5 }); b.box(0.5, 0.35, 0.4, '#5b6068', -it.w / 2 + 0.3, 1.1, -it.d / 2 + 0.3); },
  salata: (c, it) => { F.buzVitrin(c, it); for (let i = 0; i < 4; i++) c.b.cyl(0.13, 0.1, 0.07, ['#6f9e4f', '#e0533c', '#ffd23f', '#8cc63e'][i], -it.w / 2 + 0.25 + i * (it.w - 0.5) / 3, 1.02, 0, { seg: 10 }); },
  cayBar: (c, it) => { const { b } = c; counter(c, it, '#7a3b1c'); b.cyl(0.13, 0.16, 0.42, '#c9a23a', -it.w / 2 + 0.35, 1.28, 0, { seg: 12 }); b.cyl(0.07, 0.06, 0.1, '#7a2a1d', -it.w / 2 + 0.35, 1.54, 0, { seg: 10 }); b.box(0.5, 0.4, 0.3, '#2a2d33', 0.1, 1.24, -0.05); b.box(0.46, 0.04, 0.26, '#c9ced6', 0.1, 1.46, -0.05); for (let i = 0; i < 5; i++) b.cyl(0.03, 0.025, 0.07, '#b0281e', it.w / 2 - 0.3 + (i % 2) * 0.05, 1.06, -0.12 + i * 0.07, { seg: 6 }); },
  sefMasa: (c, it) => { const { b, l } = c; counter(c, it, '#1f2a44', '#c9a24a'); for (let i = 0; i < 3; i++) { const x = -it.w / 2 + 0.5 + i * (it.w - 1.0) / 2; b.cyl(0.02, 0.02, 0.5, '#c9a24a', x, 1.32, 0, { seg: 5 }); l.box(0.4, 0.05, 0.3, '#ffcf6a', x, 1.58, 0); b.cyl(0.17, 0.17, 0.02, '#ffffff', x, 1.06, 0.05, { seg: 12 }); } },
  davlumbaz: (c, it) => { const { b } = c; b.box(it.w, 0.45, 1.0, '#aab3bb', 0, 2.3, 0); b.box(it.w - 0.4, 0.5, 0.7, '#9aa2ab', 0, 2.75, -0.1); for (let i = 0; i < Math.round(it.w / 0.5); i++) b.box(0.3, 0.04, 0.02, '#5b6068', -it.w / 2 + 0.25 + i * 0.5, 2.1, 0.5); c.an.fan = fanlar(c.grp.userData.cur, lm, it.w, 2.75, 0.262); },
  asiliTava: (c, it) => { const { b } = c; b.cyl(0.015, 0.015, it.w, '#9aa5b0', 0, 2.0, 0.05, { rz: HP, seg: 5 }); c.an.swing = asiliTavalar(c.grp.userData.cur, lm, it.w, 2.0); },   // BUF-07: tavalar rayda asılı, hafif salınır
  kds: (c, it) => { const { b } = c; b.box(it.w + 0.2, 1.2, 0.06, '#232a33', 0, 2.07, 0); const cv = document.createElement('canvas'); cv.width = 512; cv.height = 200; const g2 = cv.getContext('2d')!, tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace; let last = '';
    c.an.kds = { draw: (lines: string[]) => { const key = lines.join('|'); if (key === last) return; last = key; g2.fillStyle = '#0d1b2a'; g2.fillRect(0, 0, 512, 200); g2.fillStyle = '#ffd23f'; g2.fillRect(0, 0, 512, 34); g2.fillStyle = '#14213d'; g2.font = '900 24px system-ui,sans-serif'; g2.textBaseline = 'middle'; g2.fillText('SİPARİŞ EKRANI', 12, 18);
      g2.fillStyle = '#e8f1f8'; g2.font = '700 20px system-ui,sans-serif'; if (!lines.length) { g2.fillStyle = '#7fa6c4'; g2.fillText('Bekleyen sipariş yok', 12, 70); } lines.slice(0, 5).forEach((t, i) => g2.fillText(t, 12, 60 + i * 28, 488)); tex.needsUpdate = true; } };
    c.an.kds.draw([]); const sc = new T.Mesh(new T.PlaneGeometry(it.w - 0.1, 0.55), new T.MeshBasicMaterial({ map: tex })); sc.position.set(0, 1.83, 0.04); c.grp.userData.curItem.add(sc);
    // BUF-07: ekranın üstünde fiş rayı, altında gerçek biletler (no, masa, kalemler), geliş sırasıyla soldan sağa
    c.an.bilet = biletRayi(it.w, 2.64); c.grp.userData.curItem.add(c.an.bilet.group); },
  mutfakMenu: (c, it) => { c.grp.userData.cur.add(menuPanosu(c.stage, it.w, 2.55)); },   // BUF-07: aşamaya göre duvar menüsü + şef notu
  hazirlik: (c, it) => { const { b } = c; counter(c, it, celik(c, '#8a5a3a', '#9aa5b0'), celik(c, '#d6aa78', '#e9eef2')); b.box(0.5, 0.03, 0.3, '#d6aa78', -0.4, 1.07, 0); b.box(0.5, 0.03, 0.3, '#d6aa78', 0.5, 1.07, 0); for (let i = 0; i < 3; i++) b.cyl(0.05, 0.05, 0.04, ['#e0533c', '#6f9e4f', '#ffd23f'][i], -0.4 + i * 0.1, 1.11, 0, { seg: 8 }); b.box(0.3, 0.04, 0.04, '#c9ced6', 0.5, 1.1, 0); },
  // ---- AVM mağazaları (2026-11-20: giyim / elektronik / oyuncak, content/ic-mekan.ts magazaLayout) ----
  reyon: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d, z0 = -d / 2;
    if (it.c === 'giyim') {   // wall rail: back panel, two rails, hanging clothes
      b.box(w, 2.2, 0.05, '#ece6dc', 0, 1.1, z0 + 0.03); b.box(w, 0.12, 0.08, '#c94f6d', 0, 2.15, z0 + 0.06);
      const P = ['#e0533c', '#2f5f9a', '#f4f2ec', '#3a3d42', '#c94f6d', '#7d6bb0', '#e9c46a', '#2f9e8f'];
      for (const [y, n] of [[1.75, 0], [1.05, 3]] as [number, number][]) {
        b.cyl(0.015, 0.015, w - 0.2, '#c9ced6', 0, y, z0 + 0.22, { rz: HP, seg: 6 });
        for (let i = 0; i < Math.floor((w - 0.3) / 0.13); i++) { const x = -w / 2 + 0.2 + i * 0.13, col = P[(i + n + c.seed) % P.length]; b.box(0.035, 0.55, 0.34, col, x, y - 0.3, z0 + 0.22); b.box(0.035, 0.05, 0.12, '#c9ced6', x, y + 0.01, z0 + 0.22); }
      }
    } else {
      const el = it.c === 'elektronik', body = el ? '#f4f6f8' : '#ffd23f', sh = el ? '#c9ced6' : '#e0533c';
      b.box(w, 2.0, d, body, 0, 1.0, 0); for (let r = 0; r < 5; r++) b.box(w, 0.04, d + 0.02, sh, 0, 0.15 + r * 0.42, 0.01);
      for (let r = 0; r < 4; r++) for (let i = 0; i < Math.floor((w - 0.2) / 0.24); i++) {
        const x = -w / 2 + 0.2 + i * 0.24, y = 0.17 + r * 0.42, k = (i * 5 + r * 3 + c.seed) % 7;
        if (el) { if (k < 3) { b.box(0.16, 0.22, 0.04, '#1d1d22', x, y + 0.11, d / 2 - 0.08); l.plane(0.13, 0.17, ['#7fd0ff', '#ffd23f', '#7fe0a8'][k], x, y + 0.12, d / 2 - 0.055); } else b.box(0.18, 0.14 + (k % 3) * 0.05, 0.22, ['#2a2d33', '#f4f2ec', '#3f4a6b', '#e0533c'][k % 4], x, y + 0.09, 0); }
        else if (k < 2) b.sph(0.09, ['#e0533c', '#2f6fdb', '#49b96a'][k], x, y + 0.09, 0, { ws: 8, hs: 6 });
        else if (k === 2) { b.sph(0.08, '#a8794e', x, y + 0.08, 0, { ws: 7, hs: 5 }); b.sph(0.06, '#a8794e', x, y + 0.2, 0, { ws: 7, hs: 5 }); }
        else b.box(0.19, 0.16 + (k % 3) * 0.06, 0.24, ['#2f6fdb', '#49b96a', '#8a6bbf', '#e0533c', '#f4f2ec'][k % 5], x, y + 0.1, 0);
      }
    }
  },
  teshir: (c, it) => {
    const { b, l } = c, w = it.w, d = it.d; b.box(w, 0.78, d, it.c === 'oyuncak' ? '#2f7fb3' : '#e9e4da', 0, 0.39, 0); b.box(w + 0.06, 0.04, d + 0.06, '#5a3b2a', 0, 0.8, 0);
    if (it.c === 'oyuncak') return;   // the train track (esya) or a few boxes sit on it
    for (let i = 0; i < 6; i++) {
      const x = -w / 2 + 0.22 + (i % 2) * (w - 0.44), z = -d / 2 + 0.22 + Math.floor(i / 2) * (d - 0.44) / 2;
      if (it.c === 'giyim') for (let k = 0; k < 4; k++) b.box(0.3, 0.05, 0.26, ['#e0533c', '#2f5f9a', '#f4f2ec', '#3a3d42', '#e9c46a'][(i + k) % 5], x, 0.85 + k * 0.05, z);
      else { b.box(0.18, 0.02, 0.3, '#1d1d22', x, 0.83, z, { rx: -0.2 }); l.plane(0.15, 0.26, '#7fd0ff', x, 0.846, z, { rx: -HP - 0.2 }); }
    }
  },
  depoRaf: (c, it) => { const { b } = c; b.box(it.w, 2.2, it.d, '#d8d2c4', 0, 1.1, 0); for (let r = 0; r < 5; r++) b.box(it.w, 0.03, it.d + 0.02, '#9aa5b0', 0, 0.2 + r * 0.44, 0.01);
    shelfGoods(c, it.w - 0.2, 5, 0.22, it.d / 2 - 0.1, it.c === 'giyim' ? ['#e0533c', '#2f5f9a', '#f4f2ec', '#3a3d42', '#c94f6d'] : it.c === 'elektronik' ? ['#f4f2ec', '#2a2d33', '#3f4a6b', '#9aa5b0'] : ['#ffd23f', '#e0533c', '#2f6fdb', '#49b96a', '#8a6bbf']); },
  paketMasa: (c, it) => { const { b } = c; b.box(0.42, 0.02, 0.32, '#f4f2ec', 0, 0.01, 0); b.cyl(0.04, 0.04, 0.4, it.c === 'oyuncak' ? '#e0533c' : '#c9a24a', -0.12, 0.05, -0.08, { rz: HP, seg: 8 });
    for (let i = 0; i < 2; i++) { b.box(0.16, 0.2, 0.06, it.c === 'giyim' ? '#c94f6d' : it.c === 'elektronik' ? '#2b6fb8' : '#ffd23f', 0.05 + i * 0.12, 0.12, 0.06); b.tor(0.04, 0.008, '#3a3d42', 0.05 + i * 0.12, 0.24, 0.06, { ts: 10, arc: Math.PI }); } },
  testMasa: (c) => { const { b, l } = c; b.box(0.36, 0.08, 0.26, '#3a3d42', 0, 0.04, 0); b.box(0.26, 0.18, 0.02, '#1d1d22', 0, 0.2, -0.06, { rx: -0.25 }); l.plane(0.22, 0.14, '#7fe0a8', 0, 0.2, -0.045, { rx: -0.25 }); b.cyl(0.006, 0.006, 0.3, '#e0533c', 0.15, 0.1, 0.05, { rz: 0.9, seg: 4 }); },
  askilik: (c) => { const { b } = c, P = ['#e0533c', '#2f5f9a', '#f4f2ec', '#e9c46a', '#c94f6d', '#2f9e8f', '#3a3d42', '#7d6bb0'];
    b.cyl(0.25, 0.25, 0.04, '#9aa5b0', 0, 0.02, 0, { seg: 14 }); b.cyl(0.025, 0.025, 1.5, '#c9ced6', 0, 0.77, 0, { seg: 6 }); b.tor(0.38, 0.015, '#c9ced6', 0, 1.5, 0, { rx: HP, ts: 20 });
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.box(0.035, 0.6, 0.3, P[i % P.length], Math.cos(a) * 0.38, 1.18, Math.sin(a) * 0.38, { ry: -a }); } },
  manken: (c, it) => { const { b } = c, top = it.c === 'b' ? '#2f5f9a' : '#c94f6d', bot = it.c === 'b' ? '#3a3d42' : '#c94f6d';
    b.cyl(0.2, 0.2, 0.04, '#3a3d42', 0, 0.02, 0, { seg: 12 }); b.cyl(0.02, 0.02, 0.7, '#9aa5b0', 0, 0.4, 0, { seg: 5 });
    b.cyl(0.13, it.c === 'b' ? 0.12 : 0.24, 0.55, bot, 0, it.c === 'b' ? 0.95 : 0.98, 0, { seg: 10 }); b.cyl(0.16, 0.12, 0.45, top, 0, 1.45, 0, { seg: 10 }); b.sph(0.1, '#f4f2ec', 0, 1.82, 0, { ws: 8, hs: 6 }); for (const s of [-1, 1]) b.cyl(0.035, 0.03, 0.5, top, s * 0.19, 1.42, 0, { seg: 6, rz: s * 0.15 }); },
  prova: (c, it) => { const { b } = c, w = it.w, d = it.d; for (const s of [-1, 1]) b.box(0.05, 2.1, d, '#ece6dc', s * w / 2, 1.05, 0); b.box(w, 2.1, 0.05, '#ece6dc', 0, 1.05, -d / 2); b.box(w + 0.05, 0.06, d, '#5a3b2a', 0, 2.12, 0);
    for (let i = 0; i < 7; i++) b.box(w / 7, 1.8, 0.04, i % 2 ? '#c94f6d' : '#a83e58', -w / 2 + (i + 0.5) * w / 7, 1.12, d / 2 - 0.05, { ry: (i % 2 - 0.5) * 0.3 }); b.box(0.3, 0.3, 0.02, '#c9a24a', -w / 2 + 0.25, 1.4, -d / 2 + 0.04); },
  ayna: (c, it) => { c.b.box(it.w, 1.85, 0.05, '#c9a24a', 0, 1.05, 0); c.l.plane(it.w - 0.1, 1.72, '#d8eef6', 0, 1.05, 0.03); },
  ayakkabi: (c, it) => { const { b } = c; b.box(it.w, 1.8, 0.04, '#5a3b2a', 0, 1.1, -it.d / 2 + 0.02);
    for (let r = 0; r < 4; r++) { b.box(it.w - 0.1, 0.03, 0.26, '#e9e4da', 0, 0.45 + r * 0.38, 0, { rx: 0.2 }); for (let i = 0; i < 4; i++) b.box(0.12, 0.08, 0.22, ['#f4f2ec', '#1d1d22', '#e0533c', '#2f6fdb', '#a8794e'][(i + r) % 5], -it.w / 2 + 0.2 + i * (it.w - 0.4) / 3, 0.51 + r * 0.38, 0.02, { rx: 0.2 }); } },
  aksesuar: (c) => { const { b } = c; b.cyl(0.22, 0.22, 0.04, '#3a3d42', 0, 0.02, 0, { seg: 12 }); b.cyl(0.025, 0.025, 1.7, '#c9a24a', 0, 0.87, 0, { seg: 6 });
    for (let t = 0; t < 3; t++) for (let i = 0; i < 4; i++) { const a = i * HP + t * 0.6, x = Math.cos(a) * 0.2, z = Math.sin(a) * 0.2, y = 0.7 + t * 0.4, col = ['#e0533c', '#2f5f9a', '#e9c46a', '#a8794e'][(i + t) % 4];
      if (t === 2) { b.cyl(0.1, 0.12, 0.08, col, x, y, z, { seg: 10 }); b.cyl(0.16, 0.16, 0.01, col, x, y - 0.04, z, { seg: 12 }); } else { b.box(0.18, 0.16, 0.07, col, x, y - 0.1, z, { ry: -a }); b.tor(0.06, 0.008, col, x, y, z, { ry: -a, ts: 10, arc: Math.PI }); } } },
  ledPano: (c, it) => { const y = it.y || 1.5; c.b.box(it.w + 0.08, 0.68, 0.05, '#1d1d22', 0, y, 0); const tx = signTex(it.esya === 'led_vitrin' ? 'YENİ SEZON %30' : it.esya === 'led_e' ? 'YENİ MODEL ÇIKTI' : 'OYUN ZAMANI!', it.c || '#e0533c', '#ffffff', it.w / 0.6); const p = new T.Mesh(new T.PlaneGeometry(it.w, 0.6), new T.MeshBasicMaterial({ map: tx })); p.position.set(0, y, 0.03); c.grp.userData.curItem.add(p); },
  dikis: (c) => { const { b } = c; b.box(0.4, 0.06, 0.2, '#f4f2ec', 0, 0.03, 0); b.box(0.08, 0.22, 0.14, '#f4f2ec', 0.14, 0.15, 0); b.box(0.34, 0.07, 0.14, '#f4f2ec', 0.0, 0.27, 0); b.box(0.03, 0.08, 0.03, '#c0392b', -0.14, 0.2, 0); b.cyl(0.04, 0.04, 0.03, '#2a2d33', 0.17, 0.2, 0.08, { rx: HP, seg: 10 });
    b.cyl(0.05, 0.05, 0.35, '#c94f6d', -0.05, 0.05, -0.18, { rz: HP, seg: 10 }); },
  demoMasa: (c, it) => { const { b, l } = c; b.box(it.w, 0.8, it.d, '#f4f6f8', 0, 0.4, 0); b.box(it.w + 0.04, 0.03, it.d + 0.04, '#2b6fb8', 0, 0.815, 0);
    for (let i = 0; i < 4; i++) { const x = -it.w / 2 + 0.2 + (i % 2) * (it.w - 0.4), z = -it.d / 2 + 0.25 + Math.floor(i / 2) * (it.d - 0.5); b.box(0.05, 0.05, 0.05, '#9aa5b0', x, 0.85, z); b.box(0.09, 0.17, 0.012, '#1d1d22', x, 0.95, z, { rx: -0.3 }); l.plane(0.075, 0.15, ['#7fd0ff', '#ffd23f', '#7fe0a8', '#f2a2b3'][i], x, 0.95, z + 0.008, { rx: -0.3 }); } },
  tamir: (c) => { const { b, l } = c; b.box(0.45, 0.01, 0.32, '#2f9e5a', 0, 0.005, 0); b.box(0.09, 0.012, 0.17, '#1d1d22', -0.08, 0.02, 0); l.plane(0.07, 0.14, '#3a3d42', 0.06, 0.03, 0, { rx: -HP }); for (let i = 0; i < 3; i++) b.cyl(0.006, 0.01, 0.13, ['#e0533c', '#ffd23f', '#2f6fdb'][i], 0.15, 0.015, -0.1 + i * 0.07, { rx: HP, seg: 5 }); },
  tvDuvar: (c, it) => { const y = it.y || 1.75, sw = it.w / 2 - 0.08, sh = sw * 0.58; for (let i = 0; i < 4; i++) { const x = -it.w / 4 + (i % 2) * it.w / 2, yy = y + (i < 2 ? sh / 2 + 0.05 : -sh / 2 - 0.05); c.b.box(sw + 0.05, sh + 0.05, 0.05, '#111', x, yy, 0);
    const mm = new T.MeshBasicMaterial({ color: '#2a8fd0' }), s = new T.Mesh(new T.PlaneGeometry(sw, sh), mm); s.position.set(x, yy, 0.03); c.grp.userData.curItem.add(s); c.an.screens.push(mm); } },
  kulaklikStand: (c) => { const { b } = c; b.box(0.4, 1.3, 0.4, '#2a2d33', 0, 0.65, 0); for (let r = 0; r < 3; r++) for (const s of [-1, 1]) { const y = 0.6 + r * 0.32, col = ['#e0533c', '#f4f2ec', '#2b6fb8'][(r + (s > 0 ? 1 : 0)) % 3]; b.tor(0.08, 0.012, col, s * 0.12, y, 0.22, { ts: 12, arc: Math.PI }); for (const t of [-1, 1]) b.cyl(0.035, 0.035, 0.03, col, s * 0.12 + t * 0.08, y - 0.01, 0.22, { rz: HP, seg: 10 }); } },
  konsol: (c, it) => { const { b, l } = c; b.box(it.w - 0.1, 0.4, 0.35, '#2a2d33', 0, 0.2, -it.d / 2 + 0.2); b.box(0.75, 0.45, 0.05, '#111', 0, 0.75, -it.d / 2 + 0.15); const mm = new T.MeshBasicMaterial({ color: '#2a8fd0' }), s = new T.Mesh(new T.PlaneGeometry(0.68, 0.38), mm); s.position.set(0, 0.75, -it.d / 2 + 0.18); c.grp.userData.curItem.add(s); c.an.screens.push(mm);
    b.box(0.2, 0.04, 0.15, '#f4f2ec', 0.3, 0.42, -it.d / 2 + 0.2); for (const [x, col] of [[-0.25, '#e0533c'], [0.25, '#2b6fb8']] as [number, string][]) b.sph(0.24, col, x, 0.18, it.d / 2 - 0.3, { ws: 10, hs: 6, sy: 0.65 }); l.sph(0.02, '#7fe0a8', -0.3, 0.42, -it.d / 2 + 0.2, { ws: 4, hs: 3 }); },
  vr: (c) => { const { b, l } = c; b.cyl(0.3, 0.3, 0.03, '#2a2d33', 0, 0.015, 0, { seg: 16 }); l.tor(0.29, 0.012, '#7fd0ff', 0, 0.035, 0, { rx: HP, ts: 20 }); b.cyl(0.03, 0.03, 1.1, '#9aa5b0', 0.22, 0.55, -0.2, { seg: 6 }); b.box(0.2, 0.09, 0.1, '#f4f2ec', 0.22, 1.12, -0.2); b.box(0.16, 0.05, 0.02, '#1d1d22', 0.22, 1.12, -0.145); },
  drone: (c) => { const { b } = c; b.cyl(0.005, 0.005, 0.8, '#3a3d42', 0, 0.45, 0, { seg: 3 }); b.box(0.16, 0.05, 0.16, '#f4f2ec', 0, 0, 0);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * HP, x = Math.cos(a) * 0.17, z = Math.sin(a) * 0.17; b.box(0.2, 0.02, 0.03, '#3a3d42', x / 2, 0, z / 2, { ry: -a }); const r = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.008, 10), lm('#9aa5b0')); r.position.set(x, 0.03, z); c.grp.userData.curItem.add(r); c.an.spin.push(r); } },
  pelusSepet: (c, it) => { const { b } = c; b.cyl(it.w / 2, it.w / 2 - 0.06, 0.5, '#c8a06a', 0, 0.25, 0, { seg: 14 }); b.tor(it.w / 2, 0.03, '#a8794e', 0, 0.5, 0, { rx: HP, ts: 18 });
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 0.2 : 0, x = Math.cos(a) * r, z = Math.sin(a) * r, y = i ? 0.55 : 0.7, gull = i % 3 === 0, col = gull ? '#f4f2ec' : ['#a8794e', '#f2a2b3', '#7fb4d8'][i % 3]; b.sph(0.12, col, x, y, z, { ws: 8, hs: 6 }); b.sph(0.08, col, x, y + 0.15, z, { ws: 8, hs: 6 }); if (gull) b.cone(0.025, 0.07, '#e8892b', x, y + 0.15, z + 0.09, { rx: HP, seg: 6 }); } },
  balon: (c) => { const g = new T.Group(); c.b.cyl(0.12, 0.14, 0.12, '#9aa5b0', 0, 0.06, 0, { seg: 10 });
    for (let i = 0; i < 6; i++) { const a = i * 1.05, x = Math.cos(a) * 0.15, z = Math.sin(a) * 0.15, y = 1.7 + (i % 3) * 0.18; part(g, SPH, ['#e0533c', '#ffd23f', '#2f6fdb', '#49b96a', '#c94f6d', '#8a6bbf'][i], x, y, z, 0.13, 0.16, 0.13); part(g, BOX, '#f4f2ec', x / 2, (y - 0.15) / 2 + 0.06, z / 2, 0.006, y - 0.2, 0.006); }
    c.grp.userData.curItem.add(g); c.an.bob.push(g); },
  trenPist: (c, it) => { const { b } = c, k = (it.d - 0.3) / 0.64; b.box(it.w - 0.08, 0.02, it.d - 0.08, '#6f9e4f', 0, 0.01, 0); b.tor(0.32, 0.015, '#7d4a2a', 0, 0.03, 0, { rx: HP, sy: k });
    const g = new T.Group(); g.position.set(0, 0.03, 0); g.scale.set(1, 1, k); for (let i = 0; i < 3; i++) { const a = i * 0.45; part(g, BOX, ['#e0533c', '#2f6fdb', '#ffd23f'][i], Math.cos(a) * 0.32, 0.05, Math.sin(a) * 0.32, 0.08, 0.08, 0.12).rotation.y = -a; }
    c.grp.userData.curItem.add(g); c.an.spin.push(g); b.cone(0.06, 0.12, '#49b96a', 0.05, 0.08, 0.05, { seg: 6 }); },
  legoDuvar: (c, it) => { const { b } = c; b.box(it.w, 1.9, 0.04, '#f4f2ec', 0, 1.1, -it.d / 2 + 0.02); for (let r = 0; r < 4; r++) { b.box(it.w - 0.1, 0.03, 0.24, '#ffd23f', 0, 0.4 + r * 0.4, 0); for (let i = 0; i < 4; i++) b.box(0.22, 0.26, 0.08, ['#e0533c', '#2f6fdb', '#49b96a', '#ffd23f', '#8a6bbf'][(i + r * 2) % 5], -it.w / 2 + 0.17 + i * (it.w - 0.34) / 3, 0.55 + r * 0.4, 0.02); } },
  oyunKale: (c, it) => { const { b } = c, w = it.w, d = it.d; b.box(w - 0.3, 0.9, d - 0.3, '#f2a2b3', 0, 0.45, 0); b.box(w - 0.3, 0.06, d - 0.3, '#ffd23f', 0, 0.92, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as [number, number][]) { b.cyl(0.13, 0.13, 1.3, '#f4f2ec', x * (w / 2 - 0.15), 0.65, z * (d / 2 - 0.15), { seg: 10 }); b.cone(0.17, 0.3, '#e0533c', x * (w / 2 - 0.15), 1.45, z * (d / 2 - 0.15), { seg: 10 }); }
    b.box(0.3, 0.04, 0.9, '#2f6fdb', w / 2 - 0.05, 0.45, d / 2 - 0.25, { rx: 0.7 }); b.box(0.3, 0.4, 0.04, '#3a2416', 0, 0.3, d / 2 - 0.14); },
  maskot: (c) => { const { b } = c; b.cyl(0.25, 0.25, 0.08, '#2f6fdb', 0, 0.04, 0, { seg: 14 }); b.sph(0.3, '#f4f2ec', 0, 0.48, 0, { ws: 12, hs: 8, sy: 1.2 }); b.sph(0.2, '#f4f2ec', 0, 0.98, 0.04, { ws: 10, hs: 8 });
    b.cone(0.06, 0.2, '#e8892b', 0, 0.96, 0.27, { rx: HP, seg: 8 }); for (const s of [-1, 1]) { b.box(0.06, 0.4, 0.28, '#9aa5b0', s * 0.3, 0.55, -0.02, { rz: s * 0.3 }); b.sph(0.03, '#111', s * 0.08, 1.04, 0.18, { ws: 5, hs: 4 }); b.box(0.12, 0.03, 0.16, '#e8892b', s * 0.1, 0.1, 0.12); } },
  hediye: (c) => { const { b } = c; for (const [x, z, s, col] of [[-0.1, -0.05, 0.18, '#e0533c'], [0.1, 0.05, 0.14, '#2f6fdb'], [-0.05, 0.05, 0.1, '#ffd23f']] as [number, number, number, string][]) { const y = col === '#ffd23f' ? 0.23 : s / 2; b.box(s, s, s, col, x, y, z); b.box(s + 0.005, s + 0.005, 0.02, '#f4f2ec', x, y, z); b.box(0.02, s + 0.005, s + 0.005, '#f4f2ec', x, y, z); b.tor(0.03, 0.008, '#f4f2ec', x, y + s / 2 + 0.02, z, { ts: 8 }); } },
};

/* ---------- one room ---------- */
function buildRoom(m: IcMekan, own: { lv: number; isci: number; esya: string[]; tema?: string } | null, salonEsya: string[], fine: boolean, stage = 1, ekip: { rol: string; rank: number }[] = []): { g: T.Group; an: Anim } {
  const grp = new T.Group(); grp.name = 'ic-' + m.id; const cur = new T.Group(), curItem = new T.Group(); grp.add(cur); grp.userData.cur = cur;
  const hall = !!m.salon, { W, D } = icDim(m), h = Math.min(3.2, m.h), y0 = 0.14 + katY(m.kat || 0);   // above the ground detail layer (AVM: the room's floor)
  grp.position.set(m.x, y0, m.z); grp.rotation.y = icYaw(m);
  const b = new Batch(), g = new Batch(), l = new Batch(), wb = new Batch();
  const an: Anim = { spin: [], fire: [], fish: [], screens: [], flick: [], bob: [], lamps: null };
  const seed = m.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const ctx: Ctx = { b, g, l, grp, m, an, seed: seed % 97, fine, lv: own?.lv || 0, owned: !!own, stage, esnaf: !!m.mutfak && !mutfakCelik(stage) };
  let [f1, f2] = FLOOR[m.tur], [w1, w2] = fine && hall ? ['#26304a', '#c9a24a'] : WALL[m.tur];
  const tp = own?.tema ? KAFE_TEMA[own.tema as TemaId] : undefined; if (tp) { [f1, f2] = tp.zemin; [w1, w2] = tp.duvar; }
  if (m.mutfak && mutfakCelik(stage)) { [f1, f2] = fine ? ['#2a2a30', '#c9a24a'] : ['#8d949a', '#7a8186']; [w1, w2] = fine ? ['#e8ecef', '#c9a24a'] : ['#e8ecef', '#9aa5b0']; }
  else if (m.mutfak) { [f1, f2] = ['#efe6d2', '#c8693e']; [w1, w2] = ['#f6f1e4', '#3f7f64']; }   // BUF-22: esnaf mutfağı: krem karo, beyaz fayans, yeşil bant
  if (!hall) {
    // floor: base + pattern
    b.box(W - 0.02, 0.06, D - 0.02, f1, 0, -0.03, 0);
    const desen = tp ? tp.desen : m.tur === 'bistro' ? 'dama' : m.tur === 'kafe' || m.tur === 'kahvalti' ? 'cizgi' : 'tahta';
    if (m.mutfak && !mutfakCelik(stage)) { for (let i = 0; i < Math.round(W / 0.4); i++) for (let j = 0; j < Math.round(D / 0.4); j++) if ((i + j) % 2) b.box(0.4, 0.004, 0.4, '#c8693e', -W / 2 + 0.2 + i * 0.4, 0.002, -D / 2 + 0.2 + j * 0.4); }   // BUF-22: esnaf mutfağı karo (krem / kiremit dama)
    else if (m.mutfak) { for (let i = 1; i < Math.round(W / 0.6); i++) b.box(0.015, 0.004, D - 0.05, f2, -W / 2 + i * W / Math.round(W / 0.6), 0.002, 0); for (let j = 1; j < Math.round(D / 0.6); j++) b.box(W - 0.05, 0.004, 0.015, f2, 0, 0.002, -D / 2 + j * D / Math.round(D / 0.6)); }   // paslanmaz dönem: kaymaz gri karo
    else if (desen === 'cizgi') for (let i = 1; i < Math.round(W / 0.22); i++) b.box(0.012, 0.004, D - 0.05, f2, -W / 2 + i * W / Math.round(W / 0.22), 0.002, 0);
    else if (desen === 'dama') { for (let i = 0; i < Math.round(W / 0.6); i++) for (let j = 0; j < Math.round(D / 0.6); j++) if ((i + j) % 2) b.box(0.6, 0.004, 0.6, f2, -W / 2 + 0.3 + i * 0.6, 0.002, -D / 2 + 0.3 + j * 0.6); }
    else if (desen === 'fayans') { for (let i = 0; i < Math.round(W / 0.4); i++) for (let j = 0; j < Math.round(D / 0.4); j++) if ((i + j) % 2) b.box(0.36, 0.004, 0.36, f2, -W / 2 + 0.2 + i * 0.4, 0.002, -D / 2 + 0.2 + j * 0.4); }
    else for (let i = 1; i < Math.round(W / 0.8); i++) b.box(0.015, 0.004, D - 0.05, f2, -W / 2 + i * W / Math.round(W / 0.8), 0.002, 0);
    // walls: inward faces only (near walls cull away from the outside camera), wainscot, skirting, cut cap, windows
    const t = 0.25, wall = (len: number, x: number, z: number, ry: number, gap: number | [number, number] = 0) => {
      const segs: [number, number][] = Array.isArray(gap) ? [[-len / 2, gap[0]], [gap[1], len / 2]] : gap ? [[-len / 2, -gap / 2], [gap / 2, len / 2]] : [[-len / 2, len / 2]];
      wb.push(mtx(x, 0, z, 0, ry, 0));
      for (const [a, c2] of segs) { const L = c2 - a, cx = (a + c2) / 2; wb.plane(L, h, w1, cx, h / 2, 0); wb.plane(L, 1.0, w2, cx, 0.5, 0.01); wb.box(L, 0.1, 0.03, '#3a2416', cx, 0.05, 0.02); wb.box(L, 0.05, 0.03, w2, cx, 1.0, 0.02); wb.box(L, 0.08, t, '#e9e4da', cx, h + 0.04, -t / 2); }
      wb.pop();
    };
    // 2026-11-21: mutfağın yan duvarlarında servis koridoru kapısı (batı aşama 6, doğu aşama 7; v = KAPI_V)
    const kg = (y: 'W' | 'E'): number | [number, number] => (m.mutfak && passAcik(y, stage) ? (y === 'W' ? [-SERVIS_KAPI_V[1], -SERVIS_KAPI_V[0]] : [SERVIS_KAPI_V[0], SERVIS_KAPI_V[1]]) : 0);
    wall(W, 0, -D / 2 + 0.25, 0); wall(D, -W / 2 + 0.25, 0, HP, kg('W')); wall(D, W / 2 - 0.25, 0, -HP, kg('E')); wall(W, 0, D / 2 - 0.25, Math.PI, 1.7);
    if (!m.mutfak) for (const [x, z, ry, len] of (m.bina === 'avm' ? [] : [[-W / 2 + 0.26, 0, HP, D], [W / 2 - 0.26, 0, -HP, D]]) as [number, number, number, number][]) {   // side-wall windows (none inside the mall: shared walls; BUF-22: none in the kitchen, the menu board hangs there)
      const n = Math.max(1, Math.floor((len - 1) / 2.4));
      for (let i = 0; i < n; i++) { const u = -len / 2 + (i + 0.5) * len / n; wb.push(mtx(x, 0, z, 0, ry, 0)); wb.box(1.1, 1.2, 0.04, '#fbfaf6', u, 1.75, 0.02); l.push(mtx(x, 0, z, 0, ry, 0)); l.plane(0.95, 1.05, '#bfe3f5', u, 1.75, 0.045); l.pop(); wb.pop(); }
    }
    for (const s of [-1, 1]) b.box(0.12, 2.4, 0.3, w2, s * 0.92, 1.2, D / 2 - 0.15); b.box(1.96, 0.16, 0.3, w2, 0, 2.45, D / 2 - 0.15);   // door frame
    b.box(1.2, 0.02, 0.8, '#9a1f2a', 0, 0.003, D / 2 - 0.8);   // door mat
  } else {
    // rug (2026-11-21: own identity per hall, chairs must read on it): kahvaltı warm wood / cream, balık sea blue / white; fine adds a gold edge
    const [r1, r2, r3] = m.tur === 'balik' ? [fine ? '#c9a24a' : '#1d4f86', '#f4f7fa', '#9cc7dd'] : [fine ? '#c9a24a' : '#b08860', '#f3e3c8', '#e2c99c'];
    b.box(W - 0.6, 0.012, D - 0.8, r1, 0, 0.006, 0.1); b.box(W - 0.75, 0.014, D - 0.95, r2, 0, 0.008, 0.1); b.box(W - 0.9, 0.016, D - 1.1, r3, 0, 0.01, 0.1);
    if (m.tur === 'balik') for (let i = 1; i < 6; i++) b.box(W - 0.95, 0.004, 0.06, '#f4f7fa', 0, 0.019, -D / 2 + 0.65 + i * (D - 1.1) / 6);   // wave stripes
  }
  const has = new Set(m.salon ? salonEsya : m.mutfak ? mutfakEsya(stage) : own?.esya || []);
  const items = icLayout(m, stage), occ = own ? Math.min(0.9, 0.35 + 0.12 * own.lv) : m.salon ? (fine ? 0.85 : 0.65) : 0.4;
  let ti = 0;
  const live = !!own && !!m.arsa && IC_CANLI.includes(m.arsa), empty = !!m.arsa && !own; grp.userData.live = live || empty;   // owned: real actors; unsold: an empty shop, no statues   // café/bistro: guests and staff are real actors (agents/kafe.ts), not props
  for (const it of items) {
    if (it.esya && !has.has(it.esya)) continue;
    if ((it.asama ?? 0) > stage) continue;   // BUF-20: aşama 10 fine dining masaları
    if (it.k === 'masaK' || it.k === 'masa2' || it.k === 'masa4') ti++;
    const isMasa = it.k === 'masa2' || it.k === 'masa4' || it.k === 'salonMasa', fn = F[it.k]; if (!fn && !isMasa) continue;
    grp.userData.cur = new T.Group(); grp.userData.curItem = grp.userData.cur;
    const iy = WALLY.has(it.k) ? 0 : it.y || 0;
    b.push(mtx(it.u, iy, it.v, 0, (it.ry || 0) * HP, 0)); g.push(b.st[b.st.length - 1].clone()); l.push(b.st[b.st.length - 1].clone());
    if (isMasa) masa(ctx, it, live || empty || m.salon ? 0 : Math.floor(((ti * 37 + ctx.seed) % 100) / 100 * (it.k === 'masa4' ? 4 : 2) * occ * 1.6 + (occ > 0.6 ? 1 : 0)));
    else fn!(ctx, it);
    if (m.mutfak && it.esya && MUTFAK_YER[it.esya]?.k === it.k && ISTASYON_RENK[it.esya]) b.box(it.w - 0.12, 0.07, 0.02, ISTASYON_RENK[it.esya], 0, 0.8, it.d / 2 + 0.02);   // BUF-22: istasyon renk şeridi
    b.pop(); g.pop(); l.pop();
    const sub = grp.userData.cur as T.Group; sub.position.set(it.u, iy, it.v); sub.rotation.y = (it.ry || 0) * HP; cur.add(sub);
  }
  if (m.salon) {   // 2026-11-21: salon pass penceresinin tabak yuvaları (sim view passYer.W / .E)
    const sp = items.find(i => i.k === 'salonPass');
    if (sp) { an.pasTabak = []; an.passYer = m.salon; const yon = (sp.ry || 0) === 3 ? 1 : -1;
      for (let i = 0; i < PASS_KAP; i++) { const t = tabak(), row = i % 2, col = Math.floor(i / 2); t.g.position.set(sp.u - yon * (0.02 + row * 0.12), (sp.y || 1) + 0.04, sp.v - sp.w / 2 + 0.25 + col * (sp.w - 0.5) / 3); grp.add(t.g); an.pasTabak.push(t); } }
  }
  if (m.mutfak) {   // BUF-05: dynamic plates (pass rack slots + one per cooking station), shown from the sim view in update()
    const D2 = icDim(m).D / 2, py = 1.03;
    if (has.has('pass')) {
      const pu = MUTFAK_YER.pass.u, pw = MUTFAK_YER.pass.w; an.pasTabak = [];
      for (let i = 0; i < PASS_KAP; i++) { const t = tabak(), row = i % 2, col = Math.floor(i / 2); t.g.position.set(pu - pw / 2 + 0.3 + col * (pw - 0.6) / 3, py, D2 - 0.35 - row * 0.3); grp.add(t.g); an.pasTabak.push(t); }   // BUF-22: pass ön duvarda, pencere tarafında
    }
    // BUF-07: kirli tabak yığını (bulaşık istasyonu), ıslak zemin tabelası, buhar/duman/kıvılcım havuzu
    if (has.has('bulasik')) { const y = MUTFAK_YER.bulasik, [bu, bv] = mutfakUst('bulasik'); an.yigin = tabakYigini(lm, TABAK, YEMEK); an.yigin.group.position.set(bu + y.w / 2 - 0.3, 0.965, bv); grp.add(an.yigin.group); }
    const tb = items.find(i => i.k === 'islakTabela'); if (tb) { an.tabela = islakTabela(); an.tabela.position.set(tb.u, 0.002, tb.v); grp.add(an.tabela); }
    an.fx = createFx(ctx.seed + 3); grp.add(an.fx.points); an.fxEm = [];
    an.istTabak = new Map(); an.pisiyor = [];
    for (const id of Object.keys(MUTFAK_YER)) {
      if (!pisirIstasyonu(id) || id === 'pass' || !has.has(id)) continue;   // pasoda kepçelenen tabak zaten rafa iner
      const [u, v] = mutfakUst(id), t = tabak(), on = MUTFAK_YER[id].sira === 'on';
      t.g.position.set(u, id === 'sef_masa' ? 1.08 : 0.98, v + (on ? -0.3 : 0.3));
      const buhar = new T.Mesh(SPH, lm('#f4f6f8')); buhar.scale.setScalar(0.07); buhar.position.set(u, 1.35, v); buhar.visible = false; buhar.userData.ph = u;
      grp.add(t.g, buhar); an.istTabak.set(id, { g: t.g, food: t.food, buhar });
    }
  }
  if (m.tur === 'morg') an.flick.push(grp);
  const M = mats();
  if (!wb.empty) { const wm = wb.mesh(M.wall, false, true); grp.add(wm); }
  if (!b.empty) grp.add(b.mesh(M.solid, true, true));
  if (!g.empty) { const gm = g.mesh(M.glass, false, false); gm.renderOrder = 2; grp.add(gm); }
  if (!l.empty) { const lmesh = l.mesh(M.glow, false, false); grp.add(lmesh); an.lamps = lmesh; }
  return { g: grp, an };
}

export function createIcMekan(d: IcDeps): IcView {
  const holder = new T.Group(); holder.name = 'icMekan';
  const avmHolder = new T.Group(); avmHolder.name = 'icMekanAvm';   // Martı AVM diyarı: iskele kökü orada gizli, odalar sahnede ayrı tutulur
  const rooms = new Map<string, { key: string; g: T.Group; an: Anim }>();
  let t = 0, inside: string | null = null, acc = 1;
  const keep = new Set<unknown>([BOX, SPH, TABAK, YEMEK, ...FX_GEOS]);
  const kill = (id: string) => {
    const r = rooms.get(id); if (!r) return; r.g.removeFromParent();
    const M = mats(), shared = new Set<unknown>([M.solid, M.glass, M.glow, M.wall, ...LM.values()]);
    r.g.traverse(o => { const mm = o as T.Mesh; if (!mm.isMesh) return; if (!keep.has(mm.geometry)) mm.geometry.dispose(); const mt = mm.material as T.MeshBasicMaterial; if (!shared.has(mt)) { mt.map?.dispose(); mt.dispose(); } });
    rooms.delete(id);
  };
  return {
    icinde: () => inside,
    update(dt) {
      const root = d.root(), sahne = d.sahne?.() ?? root?.parent ?? null; if (!root && !sahne) return;
      if (root && holder.parent !== root) root.add(holder);
      if (sahne && avmHolder.parent !== sahne) sahne.add(avmHolder);
      t += dt; acc += dt;
      const hp = d.hero(); inside = null;
      const st0 = d.salon().stage, odaOf = (m: IcMekan) => (m.mutfak ? mutfakOda(st0) : m);   // BUF-22: the kitchen grows with the stage
      for (const m0 of IC_MEKANLAR) if (icIcinde(odaOf(m0), hp, -0.1)) { inside = m0.id; break; }
      const bina = (inside ? IC_MEKANLAR.find(x => x.id === inside)!.bina : IC_MEKANLAR.find(x => x.bina && icIcinde(x, hp, 0.5))?.bina) || null;
      if (acc >= 0.3) {   // (re)build what is near, drop what is far
        acc = 0;
        const own = d.isletme(), sl = d.salon();
        for (const m0 of IC_MEKANLAR) {
          const m = odaOf(m0), dist = Math.hypot(hp.x - m.x, hp.z - m.z), R = Math.max(m.wx, m.wz) / 2, exists = m.salon ? sl.stage >= (m.salon === 'W' ? 6 : 7) : m.mutfak ? sl.stage >= 3 : true;
          if (!exists || dist > R + 30) { kill(m.id); continue; }
          if (dist > R + 18) continue;
          const o = m.arsa ? own[m.arsa] || null : null, fine = (!!m.salon || !!m.mutfak) && sl.stage >= 10, mk = m.mutfak ? d.mutfak() : null;
          const key = (o ? o.lv + ':' + o.isci + ':' + (o.tema || '') + ':' + [...o.esya].sort().join(',') : '-') + '|' + (m.salon ? sl.esya.filter(e => e).sort().join(',') + (fine ? 'F' : '') : '') + (mk ? 'M' + sl.stage + ':' + mk.ekip.map(e => e.rol + e.rank).join(',') : '');
          const r = rooms.get(m.id); if (r && r.key === key) continue;
          kill(m.id); const nb = buildRoom(m, o, sl.esya, fine, sl.stage, mk ? mk.ekip : []); (m.bina === 'avm' ? avmHolder : holder).add(nb.g); rooms.set(m.id, { key, g: nb.g, an: nb.an });
        }
      }
      const nk = d.night();
      for (const [id, r] of rooms) {
        const m = odaOf(IC_MEKANLAR.find(x => x.id === id)!);
        r.g.visible = m.bina === 'avm' ? avmIcinde(hp, 2) && (m.kat || 0) === ((hp as { kat?: number }).kat || 0)   // AVM: only the hero's floor (upper floors cut away, lower rooms sit under this floor's slab)
          : !!m.salon || icIcinde(m, hp, 0.5) || (!!bina && m.bina === bina) || (!!m.mutfak && mutfakVitrin(hp));   // AVM: whole mall shows inside; BUF-22: kitchen shows from the büfe / walkway
        if (!r.g.visible) continue;
        const a = r.an;
        for (const s of a.spin) s.rotation.y += dt * 2.2;
        for (const f of a.fire) { const k = 0.8 + 0.25 * Math.sin(t * 9 + f.userData.ph) + 0.08 * Math.sin(t * 15 + f.userData.ph * 2); f.scale.set(1, k, 1); }   // GRS-02: slower, softer flame
        for (const f of a.fish) { const w = f.userData.w as number, x = Math.sin(t * 0.4 + f.userData.ph) * (w / 2 - 0.25); f.position.x = x; f.rotation.y = Math.cos(t * 0.4 + f.userData.ph) > 0 ? 0 : Math.PI; f.position.y += Math.sin(t * 2 + f.userData.ph) * 0.0015; }
        for (let i = 0; i < a.screens.length; i++) a.screens[i].color.setHSL(((t * 0.05 + i * 0.3) % 1), 0.55, 0.42 + 0.06 * Math.sin(t * 3 + i));
        for (const p of a.bob) p.rotation.z = Math.sin(t * 1.4 + p.position.x * 3) * 0.04;
        if ((a.kds || a.pasTabak || a.istTabak) && (a.kdsT = (a.kdsT || 0) - dt) <= 0) {
          a.kdsT = 0.7; const mk = d.mutfak(); a.kds?.draw(mk.kds); a.bilet?.set(mk.bilet || []);
          if (a.yigin) a.yigin.set(mk.kirliTabak ?? 0);   // 2026-11-21: tek kaynak rtview (BUF-13 rt.dirtyDishes); sabit 4'lük yığın onunla üst üste çiziliyordu if (a.tabela) a.tabela.visible = (mk.zeminKir ?? 0) >= ZEMIN_ISLAK;
          // BUF-05: pass rack plates (oldest first) and station trays/pans from the sim, colour = the food on it
          const pl = mk.passYer ? mk.passYer[a.passYer || 'on'] : mk.pass;   // 2026-11-21: her pencere kendi tabaklarını gösterir
          if (a.pasTabak) a.pasTabak.forEach((t, i) => { const f = pl?.[i]; t.g.visible = !!f; if (f) t.food.material = lm(yemekRenk(f)); });
          if (a.istTabak) { a.pisiyor!.length = 0; for (const [id, t] of a.istTabak) { const s = mk.ist?.[id]; t.g.visible = s?.d === 'hazir'; t.buhar.visible = s?.d === 'pisiyor'; if (s) t.food.material = lm(yemekRenk(s.p)); if (t.buhar.visible) a.pisiyor!.push(t.buhar); }
            a.fxEm = [...a.istTabak].filter(([, t]) => t.buhar.visible).map(([id, t]) => ({ id, u: t.buhar.position.x, v: t.buhar.position.z })); }
        }
        if (a.pisiyor) for (const b of a.pisiyor) { const k = (t * 1.6 + b.userData.ph) % 1; b.position.y = 1.15 + k * 0.5; b.scale.setScalar(0.05 + k * 0.08); }   // pişiyor: tencereden yükselen buhar topu
        if (a.fan) { const sp = (a.fxEm?.length ? 11 : 4) * dt; for (const f of a.fan) f.rotation.z += sp; }
        if (a.swing) for (const s of a.swing) s.o.rotation.z = Math.sin(t * 1.1 + s.ph) * (a.fxEm?.length ? 0.07 : 0.035);
        if (a.fx) a.fx.update(dt, a.fxEm || []);
        // GRS-02 (owner: "ışık titremesi ASLA"): lamps never blink
        if (a.flick.length && a.lamps) a.lamps.visible = true;
        void nk;
      }
    },
    dispose() { for (const id of [...rooms.keys()]) kill(id); holder.removeFromParent(); },
  };
}
