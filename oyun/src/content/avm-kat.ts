/**
 * Martı AVM katları (2026-11-21, sahip: "AVM'de merdiven var ama işlevsiz, her katında mağaza olsun, satın alıp işletelim").
 * Saf veri + fonksiyon (three yok, DOM yok). Sim 2B kalır: kat, oyuncunun / aktörün bir alanıdır, yükseklik buradan okunur.
 *
 * 2026-11-21 18:46 sahip: "AVM'ye girince başka bir haritaya geçilsin, orada ayrı gezilebilsin, ayrı bir level design gibi".
 * İç mekân kendi diyarındadır (content/realm.ts 'avm'): planın x'i AVM_OX kadar kaydırılmış; iskeledeki bina yalnız kabuk + giriş
 * kapısı (AVM_DIS). Dış kapıya yürüyen içeri (AVM_GIRIS_IC), iç girişten dışarı yürüyen kapının önüne çıkar (sim/avm-gecis.ts).
 *
 * Plan (x = cx ± ..., cx = 20.15 + AVM_OX; cephe -z'de):
 *   batı blok 5.95 m | HOL 8 m: iki yürüyüş yolu + ortada yan yana iki yürüyen merdiven | doğu blok 5.95 m
 *   z 44 .. 46.5 lobi (tam genişlik, giriş kapısı ortada), z 46.5 .. 57.1 dükkânlar (ön + arka oda, kapı hola).
 * Ayrı harita olduğu için iskeledeki kabuğun ölçüsüne bağlı değil: hol geniş, önde ferah bir giriş lobisi var.
 * Her kat aynı plan; 4 kat (0 giriş, 1, 2 dükkân; 3 eğlence katı: sinema + sahne, content/avm-eglence.ts), kat yüksekliği 3.6.
 * Merdivenler (paralel, üst üste): yukarı şerit U, aşağı şerit D; ikisi de önde alçak (z 48.4), arkada yüksek (z 54.64) ucu.
 *   U: k katının ön ucundan biner, k+1 katının arka sahanlığında iner.  D: k katının arka ucundan biner, k-1 katının önünde iner.
 * Üst katlarda merdiven boşluğunun çevresi korkuluklu galeridir (ön şerit, iki yan yürüyüş yolu, arka sahanlık).
 */
import type { Rect } from '../engine/api';

/** iç mekânın x kayması (AVM diyarı, content/realm.ts) */
export const AVM_OX = 1180;
const X = (x: number) => x + AVM_OX;
// 2026-11-22 sahip: "AVM çok güzel olmuş, içeriyi biraz daha büyütüp genişletip daha güzel hale getiricez": hol 8 -> 11 m,
// dükkânlar 5.95 x 5.3 -> 7.0 x 6.8, lobi 2.5 -> 3.5 m derin. 21:33 sahip: "daha da büyüt": hol 14 m, dükkânlar 8.6 x 8.6,
// lobi 5 m; toplam 19.9 x 13.1 -> 31.2 x 22.2 m (dükkân içi yerleşim yeni boyuta yayılır, content/ic-mekan.ts avmOdaLayout).
const CX = X(20.15), HW = 7.0, OD = 8.6;
/** dükkân bloklarının ön yüzü (lobi bunun önünde) */
export const LOBI_Z1 = 49;
export const AVM = { x0: CX - HW - OD, x1: CX + HW + OD, z0: 44, z1: LOBI_Z1 + 2 * OD, cx: CX, FH: 3.6, KAT: 4 } as const;
/** bir AVM dükkân odasının ölçüsü: W kapı duvarı (z boyunca, bir sıranın derinliği), D derinlik (x boyunca, blok genişliği) */
export const ODA_OLCU = { W: (AVM.z1 - LOBI_Z1) / 2, D: OD } as const;
/** orta hol (merdivenler + yürüyüş yolları) */
export const HOL = { x0: CX - HW, x1: CX + HW } as const;
/** merdiven şeritleri (yürünen genişlik 1.0, aralarda 0.15 korkuluk) ve uçları */
export const SERIT = { U: { x0: CX - 1.075, x1: CX - 0.075 }, D: { x0: CX + 0.075, x1: CX + 1.075 } } as const;
// yürüyen merdivenler holün ortasında (öndeki lobiden ve arkadaki çeşmeden uzak)
const MERD_ON = (LOBI_Z1 + AVM.z1) / 2 - 3.12 - 0.6;
export const MERD = { on: MERD_ON, arka: MERD_ON + 6.24, duz: 0.5, kx0: CX - 1.225, kx1: CX + 1.225 } as const;
/** merdiven adası: merdiven bloğu + iki yanında saksı ve banklar (her katta; üst katlarda galeri korkuluğunun dışı) */
export const ADA = { x0: MERD.kx0 - 0.95, x1: MERD.kx1 + 0.95, z0: MERD.on + 0.35, z1: MERD.arka - 0.35 } as const;
/** zemin katta merdivenin arkasındaki çeşme (yuvarlak havuz) */
export const CESME = { x: CX, z: AVM.z1 - 2.5, r: 1.4 } as const;
/** dükkân odalarının merkezleri (batı / doğu blok, ön / arka sıra) */
export const ODA_X = { W: CX - HW - OD / 2, E: CX + HW + OD / 2 } as const, ODA_Z = { F: LOBI_Z1 + ODA_OLCU.W / 2, B: AVM.z1 - ODA_OLCU.W / 2 } as const;
/** 3. kat (sinema katı) doğu lobisindeki Sinema Büfesi odası (2026-11-22): blok genişliğinde (D), lobi derinliğinde (W), kapısı hola */
export const SINEMA_BUFE = { x: ODA_X.E, z: (AVM.z0 + 0.1 + LOBI_Z1) / 2, W: LOBI_Z1 - AVM.z0 - 0.1, D: OD } as const;
/** iskeledeki AVM binası (kabuk) ve giriş kapısının önü: buraya yürüyen AVM'ye geçer */
export const AVM_BINA = { x: 20.15, z: 51.8, wx: 16.9, wz: 10.6 } as const;
export const AVM_DIS = { x: 20.15, z: 45.75 } as const, AVM_DIS_CIKIS = { x: 20.15, z: 44.5 } as const;
export const KAT_ADI = ['Giriş Katı', '1. Kat · Kahve & Tatlı', '2. Kat · Yemek Katı', '3. Kat · Sinema & Sahne'];
export const KAT_KISA = ['Zemin', '1. Kat', '2. Kat', '3. Kat'];
export type SeritId = 'U' | 'D';
const sc = (s: SeritId) => (SERIT[s].x0 + SERIT[s].x1) / 2;
/** giriş kapısının boşluğu (zemin kat cephesinde, otomatik kapı) */
export const GIRIS_KAPI = { x0: CX - 1.6, x1: CX + 1.6 } as const;
/** giriş kapısı (hol cephesi), dış ve iç nokta */
export const AVM_GIRIS = { x: AVM.cx, z: AVM.z0 - 1.0 }, AVM_GIRIS_IC = { x: AVM.cx, z: AVM.z0 + 0.8 };
/** iç girişten bu z'nin önüne yürüyen dışarı çıkar (sim/avm-gecis.ts) */
export const AVM_CIKIS_Z = AVM.z0 - 0.25;
/** hol yürüyüş yollarının ortası ve ön / arka sıra */
const YOL_X = { W: (HOL.x0 + ADA.x0) / 2, E: (ADA.x1 + HOL.x1) / 2 }, SIRA_Z = { on: MERD.on - 1.3, arka: MERD.arka + 1.25 };
/** hol yürüyüş yolları (ada ile dükkân cepheleri arası): gezenler buralarda durur */
export const YOL = { W: { x0: HOL.x0 + 0.6, x1: ADA.x0 - 0.45 }, E: { x0: ADA.x1 + 0.45, x1: HOL.x1 - 0.6 } } as const;
/** holdeki duvar dibi saksıları (iki sıra dükkânın arasında, iki yanda) */
export const HOL_SAKSI = [HOL.x0 + 0.45, HOL.x1 - 0.45].map(x => ({ x, z: (ODA_Z.F + ODA_Z.B) / 2, r: 0.38 }));

export const avmIcinde = (p: { x: number; z: number }, m = 0) => p.x > AVM.x0 - m && p.x < AVM.x1 + m && p.z > AVM.z0 - m && p.z < AVM.z1 + m;
export const katY = (kat: number) => Math.max(0, kat) * AVM.FH;
/** merdiven şeridi boyunca yükseklik (alt kattan): uçlarda 0.5 m düz basamak, arası eğim */
export function seritY(z: number, alt: number): number {
  const z0 = MERD.on + MERD.duz, z1 = MERD.arka - MERD.duz, t = Math.max(0, Math.min(1, (z - z0) / (z1 - z0)));
  return katY(alt) + t * AVM.FH;
}

export interface P3 { x: number; z: number; y: number }
/** Merdiven yolculuğu: biniş ucu -> iniş ucu -> sahanlık. alt = merdivenin alt katı. */
export interface Yolculuk { serit: SeritId; alt: number; hedefKat: number; noktalar: P3[] }
export function yolculuk(serit: SeritId, alt: number): Yolculuk {
  const x = sc(serit), yA = katY(alt), yB = katY(alt + 1);
  const yukari: P3[] = [{ x, z: MERD.on, y: yA }, { x, z: MERD.on + MERD.duz, y: yA }, { x, z: MERD.arka - MERD.duz, y: yB }, { x, z: MERD.arka, y: yB }, { x, z: MERD.arka + 0.75, y: yB }];
  if (serit === 'U') return { serit, alt, hedefKat: alt + 1, noktalar: yukari };
  const asagi = yukari.slice(0, 4).reverse(); asagi.push({ x, z: MERD.on - 0.75, y: yA });
  return { serit, alt, hedefKat: alt, noktalar: asagi };
}
/** Biniş: kat `kat`ta, oyuncu şeridin biniş ucundaki 0.9 m'lik alanda ve şeride doğru yürüyorsa hangi yolculuk? */
export function binis(p: { x: number; z: number }, kat: number, vx: number, vz: number): Yolculuk | null {
  if (!avmIcinde(p)) return null;
  const sp = Math.hypot(vx, vz); if (sp < 0.4) return null;
  for (const s of ['U', 'D'] as SeritId[]) {
    const r = SERIT[s]; if (p.x < r.x0 + 0.05 || p.x > r.x1 - 0.05) continue;
    if (s === 'U' && kat < AVM.KAT - 1 && p.z > MERD.on - 0.95 && p.z < MERD.on + 0.05 && vz > 0.45 * sp) return yolculuk('U', kat);
    if (s === 'D' && kat > 0 && p.z > MERD.arka - 0.05 && p.z < MERD.arka + 0.95 && vz < -0.45 * sp) return yolculuk('D', kat - 1);
  }
  return null;
}

/** giriş lobisinin katı eşyaları (dünya): danışma bankosu (batı), iki büyük saksı, iki bank sırası; görünüm de buradan çizer */
export const LOBI_DEKOR: { k: 'danisma' | 'saksi' | 'bank'; x: number; z: number; w: number; d: number }[] = [
  { k: 'danisma', x: AVM.x0 + 2.4, z: 45.2, w: 2.4, d: 0.8 },
  { k: 'saksi', x: AVM.x0 + 0.7, z: AVM.z0 + 0.7, w: 0.9, d: 0.9 }, { k: 'saksi', x: AVM.x1 - 0.7, z: AVM.z0 + 0.7, w: 0.9, d: 0.9 },
  { k: 'bank', x: AVM.x1 - 2.6, z: 45.5, w: 2.2, d: 0.55 }, { k: 'saksi', x: AVM.x1 - 4.2, z: 45.5, w: 0.7, d: 0.7 },
];
/* ---------- çarpışma ---------- */
const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });
const T = 0.25;
/** Holün kat çarpışması (dünya): giriş cephesi (zeminde kapı boşluklu), arka duvar, merdiven bloğu (zeminde şeritler, üstte boşluk). */
export function holEngel(kat: number): Rect[] {
  // arka duvar (hol), merdiven bloğu, lobinin iki yan duvarı, cam cephe (zeminde ortada kapı; önünde rüzgârlık duvarı)
  const o: Rect[] = [R(HOL.x0, HOL.x1, AVM.z1 - T, AVM.z1), R(MERD.kx0, MERD.kx1, MERD.on, MERD.arka), R(ADA.x0, ADA.x1, ADA.z0, ADA.z1), R(AVM.x0, AVM.x0 + T, AVM.z0, LOBI_Z1), R(AVM.x1 - T, AVM.x1, AVM.z0, LOBI_Z1),
    ...HOL_SAKSI.map(p => R(p.x - p.r, p.x + p.r, p.z - p.r, p.z + p.r))];
  if (kat === 0) o.push(R(CESME.x - CESME.r, CESME.x + CESME.r, CESME.z - CESME.r, CESME.z + CESME.r));
  if (kat === 0) o.push(...LOBI_DEKOR.map(d => R(d.x - d.w / 2, d.x + d.w / 2, d.z - d.d / 2, d.z + d.d / 2)), R(AVM.x0, GIRIS_KAPI.x0, AVM.z0, AVM.z0 + T), R(GIRIS_KAPI.x1, AVM.x1, AVM.z0, AVM.z0 + T), R(GIRIS_KAPI.x0 - 0.6, GIRIS_KAPI.x1 + 0.6, AVM.z0 - 1.9, AVM.z0 - 1.65));
  else o.push(R(AVM.x0, AVM.x1, AVM.z0, AVM.z0 + T));
  return o;
}


/* ---------- aktör yolu (müşteri / işçi) ---------- */
const kesisir = (a: { x: number; z: number }, b: { x: number; z: number }, r: Rect): boolean => {
  // Liang-Barsky: a-b doğru parçası dikdörtgene giriyor mu
  let t0 = 0, t1 = 1; const dx = b.x - a.x, dz = b.z - a.z;
  const kes = (p: number, q: number) => { if (Math.abs(p) < 1e-9) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  return kes(-dx, a.x - r.x0) && kes(dx, r.x1 - a.x) && kes(-dz, a.z - r.z0) && kes(dz, r.z1 - a.z) && t0 < t1;
};
const BLOK = R(ADA.x0 - 0.25, ADA.x1 + 0.25, MERD.on - 0.2, MERD.arka + 0.2);
const KOSE = [{ x: YOL_X.W, z: SIRA_Z.on }, { x: YOL_X.E, z: SIRA_Z.on }, { x: YOL_X.W, z: SIRA_Z.arka }, { x: YOL_X.E, z: SIRA_Z.arka }];
const ROTALAR: number[][] = [[], [0], [1], [2], [3], [0, 2], [2, 0], [1, 3], [3, 1]];
/** bir kattaki iki nokta arası hol yolu (merdiven bloğunun çevresinden), y = kat yüksekliği; a hariç, b dahil */
export function holYol(kat: number, a: { x: number; z: number }, b: { x: number; z: number }): P3[] {
  let best: { x: number; z: number }[] | null = null, bl = Infinity;
  for (const rt of ROTALAR) {
    const pts = [a, ...rt.map(i => KOSE[i]), b]; let ok = true, L = 0;
    for (let i = 1; i < pts.length && ok; i++) { if (kesisir(pts[i - 1], pts[i], BLOK)) ok = false; L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); }
    if (ok && L < bl) { bl = L; best = pts.slice(1); }
  }
  const y = katY(kat);
  return (best || [b]).map(p => ({ x: p.x, z: p.z, y }));
}
/** AVM girişinden (dışarıdan) kat `kat`taki bir noktaya: holde yürü, yukarı merdivenlerle çık */
export function avmGelis(kat: number, hedef: { x: number; z: number }): P3[] {
  const o: P3[] = [{ ...AVM_GIRIS_IC, y: 0 }]; let cur: { x: number; z: number } = AVM_GIRIS_IC;
  for (let k = 0; k < kat; k++) {
    const y = yolculuk('U', k), bas = y.noktalar[0];
    o.push(...holYol(k, cur, { x: bas.x, z: bas.z - 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1];
  }
  o.push(...holYol(kat, cur, hedef));
  return o;
}
/** kat `kat`taki bir noktadan AVM'nin dışına: aşağı merdivenlerle in, girişten çık */
export function avmGidis(kat: number, from: { x: number; z: number }): P3[] {
  const o: P3[] = []; let cur = from;
  for (let k = kat; k > 0; k--) {
    const y = yolculuk('D', k - 1), bas = y.noktalar[0];
    o.push(...holYol(k, cur, { x: bas.x, z: bas.z + 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1];
  }
  o.push(...holYol(0, cur, AVM_GIRIS_IC), { ...AVM_GIRIS, y: 0 });
  return o;
}
/** kat ka'daki bir noktadan kat kb'deki bir noktaya: holde yürü, gereken merdivenle in ya da çık (a hariç, b dahil) */
export function avmYol(ka: number, from: { x: number; z: number }, kb: number, to: { x: number; z: number }): P3[] {
  const o: P3[] = []; let cur = from;
  for (let k = ka; k < kb; k++) { const y = yolculuk('U', k), bas = y.noktalar[0]; o.push(...holYol(k, cur, { x: bas.x, z: bas.z - 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1]; }
  for (let k = ka; k > kb; k--) { const y = yolculuk('D', k - 1), bas = y.noktalar[0]; o.push(...holYol(k, cur, { x: bas.x, z: bas.z + 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1]; }
  o.push(...holYol(kb, cur, to));
  return o;
}
