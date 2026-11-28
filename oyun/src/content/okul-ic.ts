/**
 * Martıköy İlkokulu içi (2026-11-28 sahip: "okul da içine girilebilecek AVM gibi; sınıflar olacak, müdür olacak, her şeyi yapmamız gerekiyor").
 * AVM gibi kendi diyarında (content/realm.ts 'okul', x 1300..1400): karşı yakadaki okul binasının kapısına yürüyen buraya geçer
 * (sim/okul-gecis.ts), bahçe kapısından çıkan okulun önüne döner. Saf veri + fonksiyon (three yok, DOM yok).
 *
 * Plan (x = CX ± ..., cephe -z'de, z büyüdükçe arkaya):
 *   z 28 .. 40  giriş meydanı: bahçe kapısı (çıkış), bayrak direği, Atatürk büstü, banklar, çiçeklik
 *   z 40 .. 59  bina 48 x 19 m: ön sıra odalar (z 40..46.5, kapı koridora), koridor (z 46.5..50), arka sıra odalar (z 50..59)
 *               ön: Müdür | Müdür Yrd. & Sekreterlik | Öğretmenler Odası | GİRİŞ HOLÜ | Revir | Fen Lab. | Kütüphane
 *               arka: 1-A | 2-A | 3-A (İngilizce dersliği, sınav) | BAHÇE KAPISI | 4-A | Müzik & Resim | Kantin (k4)
 *   z 59 .. 84  arka bahçe: basket sahası, oyun parkı (salıncak, kaydırak), seksek, banklar, ağaçlar; çevresi okul çiti
 */
import type { Rect } from '../engine/api';

/** okul diyarının merkez x'i */
export const OKUL_OX = 1350;
const CX = OKUL_OX;
/** bina (dış duvarlar odaların duvarı) */
export const OKUL = { x0: CX - 24, x1: CX + 24, z0: 40, z1: 59, cx: CX, H: 3.4 } as const;
/** koridor ve giriş / bahçe kapıları */
export const KOR = { z0: 46.5, z1: 50, zm: 48.25 } as const;
export const GIRIS_KAPI = { x0: CX - 1.6, x1: CX + 1.6 } as const;   // cephedeki çift kanat (z 40) ve arka geçit (z 50..59) aynı genişlikte
export const HOL = { x0: CX - 3, x1: CX + 3 } as const;   // giriş holü (z 40..46.5)
/** okulun çitle çevrili tüm alanı; çit kapısı önde ortada */
export const SINIR = { x0: CX - 27, x1: CX + 27, z0: 28, z1: 84 } as const;
export const MEYDAN = { z0: SINIR.z0, z1: OKUL.z0 } as const, BAHCE = { z0: OKUL.z1, z1: SINIR.z1 } as const;
export const CIT_KAPI = { x0: CX - 2.2, x1: CX + 2.2 } as const;

/** karşı yakadaki okul binası (content/zones/karsi.ts kr.okul) ve kapısının önü: buraya yürüyen okula geçer */
export const OKUL_DIS = { x: 48.85, z: 32.95 } as const, OKUL_DIS_CIKIS = { x: 48.85, z: 31.7 } as const;
/** diyara varış (çit kapısının içi) ve dönüş eşiği (kapıdan dışarı) */
export const OKUL_GIRIS_IC = { x: CX, z: SINIR.z0 + 1.4 } as const, OKUL_CIKIS_Z = SINIR.z0 - 0.4;

export const okulIcinde = (p: { x: number; z: number }, m = 0) => p.x > SINIR.x0 - 3 - m && p.x < SINIR.x1 + 3 + m && p.z > SINIR.z0 - 3 - m && p.z < SINIR.z1 + 3 + m;
/** kapalı bina içi (koridor + odalar): ses ve iç mekân ışığı */
export const okulBinada = (p: { x: number; z: number }) => p.x > OKUL.x0 && p.x < OKUL.x1 && p.z > OKUL.z0 && p.z < OKUL.z1;

/* ---------- odalar ---------- */
export type OkulTur = 'mudurOda' | 'sekreterlik' | 'ogretmenOda' | 'revir' | 'fenLab' | 'kutuphane' | 'sinif' | 'muzikOda' | 'kantin';
export interface OkulOda { id: string; ad: string; tur: OkulTur | 'okul'; x0: number; x1: number; on: boolean; arsa?: string; sinif?: string }
const L = (x: number) => CX + x;
/** on: ön sıra (kapı +z, koridora), değilse arka sıra (kapı -z) */
export const OKUL_ODALAR: OkulOda[] = [
  { id: 'okul_mudur', ad: 'Müdür Odası', tur: 'mudurOda', x0: L(-24), x1: L(-16), on: true },
  { id: 'okul_sekreter', ad: 'Müdür Yardımcısı & Sekreterlik', tur: 'sekreterlik', x0: L(-16), x1: L(-10), on: true },
  { id: 'okul_ogretmen', ad: 'Öğretmenler Odası', tur: 'ogretmenOda', x0: L(-10), x1: L(-3), on: true },
  { id: 'okul_revir', ad: 'Revir', tur: 'revir', x0: L(3), x1: L(8), on: true },
  { id: 'okul_fen', ad: 'Fen Laboratuvarı', tur: 'fenLab', x0: L(8), x1: L(16), on: true },
  { id: 'okul_kutuphane', ad: 'Kütüphane', tur: 'kutuphane', x0: L(16), x1: L(24), on: true },
  { id: 'okul_1a', ad: '1-A Sınıfı', tur: 'sinif', x0: L(-24), x1: L(-16), on: false, sinif: '1-A' },
  { id: 'okul_2a', ad: '2-A Sınıfı', tur: 'sinif', x0: L(-16), x1: L(-8), on: false, sinif: '2-A' },
  // eski tek odalı okulun kimliği 'okul' burada yaşar: İngilizce dersi ve sınavlar (sim/mulk.ts okulYakin) bu sınıfta
  { id: 'okul', ad: '3-A · İngilizce Dersliği', tur: 'okul', x0: L(-8), x1: L(-1.6), on: false, sinif: '3-A' },
  { id: 'okul_4a', ad: '4-A Sınıfı', tur: 'sinif', x0: L(1.6), x1: L(8), on: false, sinif: '4-A' },
  { id: 'okul_muzik', ad: 'Müzik & Resim Atölyesi', tur: 'muzikOda', x0: L(8), x1: L(16), on: false },
  // okul kantini (işletme k4) eskiden tek odanın doğu yarısıydı; şimdi kendi odası
  { id: 'okul_kantin', ad: 'Okul Kantini', tur: 'kantin', x0: L(16), x1: L(24), on: false, arsa: 'k4' },
];
export const OKUL_ODA_BY_ID: Record<string, OkulOda> = Object.fromEntries(OKUL_ODALAR.map(o => [o.id, o]));
/** odanın IcMekan alanları (content/ic-mekan.ts okulOdalar) */
export function okulOdaGeo(o: OkulOda): { x: number; z: number; wx: number; wz: number; kapi: '+z' | '-z' } {
  const z0 = o.on ? OKUL.z0 : KOR.z1, z1 = o.on ? KOR.z0 : OKUL.z1;
  return { x: (o.x0 + o.x1) / 2, z: (z0 + z1) / 2, wx: o.x1 - o.x0, wz: z1 - z0, kapi: o.on ? '+z' : '-z' };
}
/** oda kapısının koridordaki önü (kapı ortası, koridor kenarından 0.7 m içeride) */
export const odaKapiOnu = (o: OkulOda) => ({ x: (o.x0 + o.x1) / 2, z: o.on ? KOR.z0 + 0.7 : KOR.z1 - 0.7 });
/** oda kapısının içi (kapıdan 0.9 m içeri) */
export const odaKapiIci = (o: OkulOda) => ({ x: (o.x0 + o.x1) / 2, z: o.on ? KOR.z0 - 0.9 : KOR.z1 + 0.9 });
export const odaIcinde = (o: OkulOda, p: { x: number; z: number }, m = 0) => { const g = okulOdaGeo(o); return Math.abs(p.x - g.x) < g.wx / 2 + m && Math.abs(p.z - g.z) < g.wz / 2 + m; };
export const okulOdaAt = (p: { x: number; z: number }) => OKUL_ODALAR.find(o => odaIcinde(o, p, -0.1)) || null;

/* ---------- dekor (meydan + bahçe; görünüm view/world/okul-ic.ts aynı listeden çizer, çarpışma buradan) ---------- */
export type DekorK = 'bayrak' | 'bust' | 'bank' | 'agac' | 'cicek' | 'pota' | 'salincak' | 'kaydirak' | 'tahterevalli' | 'cop' | 'cesme' | 'kum' | 'pano';
export interface Dekor { k: DekorK; x: number; z: number; w: number; d: number; ry?: number }
const D = (k: DekorK, x: number, z: number, w: number, d: number, ry = 0): Dekor => ({ k, x: L(x), z, w, d, ry });
export const BASKET = { x: L(-12), z: 71.5, w: 11, d: 16 } as const;
export const PARK = { x: L(13), z: 70, w: 14, d: 12 } as const;
export const SEKSEK = { x: L(1.5), z: 66 } as const;
export const OKUL_DEKOR: Dekor[] = [
  // meydan: ortada bayrak direği, yanında Atatürk büstü (kaide), iki yanda çiçeklik + bank sıraları, köşelerde ağaç
  D('bayrak', -5.5, 33.5, 0.7, 0.7), D('bust', 5.5, 33.8, 1.6, 1.6), D('pano', 11.5, 38.2, 2.6, 0.35),
  D('cicek', -12, 35, 5, 1.2), D('cicek', 12, 35, 5, 1.2),
  D('bank', -12, 37.4, 2.2, 0.6), D('bank', -7.2, 37.4, 2.2, 0.6), D('bank', 7.2, 37.4, 2.2, 0.6),
  D('agac', -22, 31.5, 1.0, 1.0), D('agac', 22, 31.5, 1.0, 1.0), D('agac', -22, 37.5, 1.0, 1.0), D('agac', 22, 37.5, 1.0, 1.0), D('agac', -17, 30.6, 1.0, 1.0), D('agac', 17, 30.6, 1.0, 1.0),
  D('cop', -3.2, 38.6, 0.5, 0.5), D('cop', 3.2, 38.6, 0.5, 0.5),
  // bahçe: basket potaları, oyun parkı, kum havuzu, banklar, çeşme, ağaçlar
  D('pota', -12, 71.5 - 7.6, 1.0, 0.6), D('pota', -12, 71.5 + 7.6, 1.0, 0.6, 2),
  D('salincak', 9.5, 66.5, 3.6, 1.8), D('kaydirak', 16, 67, 1.2, 3.8), D('tahterevalli', 10, 73, 3.2, 0.6), D('kum', 16.5, 74, 3.4, 3.4),
  D('bank', -3.5, 62, 2.2, 0.6), D('bank', 5.5, 62, 2.2, 0.6), D('bank', -20.5, 64, 2.2, 0.6, 1), D('bank', -20.5, 79, 2.2, 0.6, 1), D('bank', 22, 80, 2.2, 0.6, 3),
  D('cesme', 0, 80.5, 1.2, 0.8),
  D('agac', -24, 61.5, 1.0, 1.0), D('agac', 24, 61.5, 1.0, 1.0), D('agac', -24, 82, 1.0, 1.0), D('agac', 24, 82, 1.0, 1.0), D('agac', -4, 82, 1.0, 1.0), D('agac', 5, 82, 1.0, 1.0), D('agac', 4.5, 70, 1.0, 1.0),
  D('cop', -2.5, 60.5, 0.5, 0.5), D('cop', 21, 63, 0.5, 0.5),
];

/** koridor ve giriş holü eşyaları (dünya; görünüm view/world/okul-ic.ts). duvar: 'G' koridorun güney duvarı (z 46.5, kuzeye bakar), 'K' kuzey duvarı (z 50, güneye bakar), 'B'/'D' holün batı / doğu duvarı */
export type KorK = 'dolap' | 'pano' | 'sukesme' | 'bank' | 'ataturkKosesi' | 'kupa' | 'nobetci' | 'yangin' | 'saksi';
export interface KorDekor { k: KorK; x: number; z: number; w: number; d: number; duvar: 'G' | 'K' | 'B' | 'D'; txt?: string; solid?: boolean }
const KD = (k: KorK, x: number, duvar: 'G' | 'K', w: number, d: number, o: Partial<KorDekor> = {}): KorDekor => ({ k, x: L(x), z: duvar === 'G' ? KOR.z0 + d / 2 : KOR.z1 - d / 2, w, d, duvar, ...o });
export const KOR_DEKOR: KorDekor[] = [
  KD('dolap', -16.5, 'G', 2.6, 0.42, { solid: true }), KD('pano', -9.75, 'G', 2.6, 0.05, { txt: 'OKUL PANOSU' }), KD('dolap', 8.75, 'G', 2.6, 0.42, { solid: true }), KD('pano', 16, 'G', 3.0, 0.05, { txt: 'BAŞARILARIMIZ' }),
  KD('yangin', -23.3, 'G', 0.3, 0.22, { solid: true }), KD('yangin', 23.3, 'K', 0.3, 0.22, { solid: true }),
  KD('pano', -16, 'K', 3.0, 0.05, { txt: 'DERS PROGRAMI' }), KD('sukesme', -8.4, 'K', 0.5, 0.4, { solid: true }), KD('bank', 8.4, 'K', 2.0, 0.45, { solid: true }), KD('pano', 16, 'K', 3.0, 0.05, { txt: 'KİTAP KURDU' }),
  KD('saksi', -2.4, 'K', 0.55, 0.55, { solid: true }), KD('saksi', 2.4, 'K', 0.55, 0.55, { solid: true }),
  // giriş holü: batıda Atatürk köşesi, doğuda kupa dolabı ve nöbetçi masası
  { k: 'ataturkKosesi', x: L(-2.45), z: 43.4, w: 0.85, d: 2.6, duvar: 'B', solid: true },
  { k: 'kupa', x: L(2.72), z: 44.6, w: 0.46, d: 1.8, duvar: 'D', solid: true },
  { k: 'nobetci', x: L(2.3), z: 41.7, w: 0.7, d: 1.4, duvar: 'D', solid: true },
];

/* ---------- çarpışma ---------- */
const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });
const T = 0.25;
/** odalar dışındaki engeller (dünya): hol cephesi (kapı boşluklu), koridor uçları, çit (kapı boşluklu), dekor. Odaların duvarları ve eşyaları ic-mekan icColliders. */
export function okulEngel(): Rect[] {
  const o: Rect[] = [
    R(HOL.x0, GIRIS_KAPI.x0, OKUL.z0, OKUL.z0 + T), R(GIRIS_KAPI.x1, HOL.x1, OKUL.z0, OKUL.z0 + T),   // hol cephesi
    R(OKUL.x0, OKUL.x0 + T, KOR.z0, KOR.z1), R(OKUL.x1 - T, OKUL.x1, KOR.z0, KOR.z1),   // koridor uç duvarları
    // çit: önde kapı boşluğu, arkada ve yanlarda kapalı
    R(SINIR.x0, CIT_KAPI.x0, SINIR.z0 - 0.15, SINIR.z0), R(CIT_KAPI.x1, SINIR.x1, SINIR.z0 - 0.15, SINIR.z0),
    R(SINIR.x0, SINIR.x1, SINIR.z1, SINIR.z1 + 0.15), R(SINIR.x0 - 0.15, SINIR.x0, SINIR.z0, SINIR.z1), R(SINIR.x1, SINIR.x1 + 0.15, SINIR.z0, SINIR.z1),
    // kapının önündeki kaldırım kısa: dışarı çıkan geri dönmeden eşikten geçer, yana kaçamaz
    R(CIT_KAPI.x0 - 0.15, CIT_KAPI.x0, SINIR.z0 - 2.2, SINIR.z0), R(CIT_KAPI.x1, CIT_KAPI.x1 + 0.15, SINIR.z0 - 2.2, SINIR.z0), R(CIT_KAPI.x0, CIT_KAPI.x1, SINIR.z0 - 2.4, SINIR.z0 - 2.2),
  ];
  // giriş holünün yan duvarları (komşu odaların duvarı odaya bakar; hol tarafı burada)
  o.push(R(HOL.x0, HOL.x0 + T, OKUL.z0, KOR.z0), R(HOL.x1 - T, HOL.x1, OKUL.z0, KOR.z0));
  for (const d of KOR_DEKOR) if (d.solid) { const sw = d.duvar === 'B' || d.duvar === 'D' ? d.w : d.w, sd = d.d; o.push(R(d.x - sw / 2, d.x + sw / 2, d.z - sd / 2, d.z + sd / 2)); }
  for (const d of OKUL_DEKOR) {
    if (d.k === 'cicek' || d.k === 'kum') continue;   // üstünden geçilmez ama alçak: kenarı yine engel
    const sw = (d.ry || 0) % 2 ? d.d : d.w, sd = (d.ry || 0) % 2 ? d.w : d.d, s = d.k === 'agac' ? 0.45 : 1;
    o.push(R(d.x - sw * s / 2, d.x + sw * s / 2, d.z - sd * s / 2, d.z + sd * s / 2));
  }
  for (const d of OKUL_DEKOR) if (d.k === 'cicek' || d.k === 'kum') o.push(R(d.x - d.w / 2, d.x + d.w / 2, d.z - d.d / 2, d.z + d.d / 2));
  return o;
}

/* ---------- ders programı ---------- */
/**
 * Oyun günü hızlı (bir oyun saati ~20 sn), bu yüzden bloklar uzun tutuldu: çocuklar teneffüste bahçeye gidip dönebilsin.
 * 08:00 giriş (meydanda toplanma, 08:30 tören: İstiklal Marşı sırası), 09:00 1. ders, 10:20 teneffüs, 11:00 2. ders, 12:00 öğle arası,
 * 13:30 3. ders, 14:50 çıkış; 15:30 sonrası okul boş (hizmetli 17:00'ye kadar temizlik yapar).
 */
export type OkulFaz = 'kapali' | 'giris' | 'toren' | 'ders' | 'teneffus' | 'ogle' | 'cikis';
export const PROGRAM: { h: number; faz: OkulFaz; ders?: number; ad: string }[] = [
  { h: 0, faz: 'kapali', ad: 'Okul kapalı' }, { h: 8, faz: 'giris', ad: 'Öğrenciler geliyor' }, { h: 8.5, faz: 'toren', ad: 'Sabah töreni' },
  { h: 9, faz: 'ders', ders: 1, ad: '1. ders' }, { h: 10.33, faz: 'teneffus', ad: 'Teneffüs' }, { h: 11, faz: 'ders', ders: 2, ad: '2. ders' },
  { h: 12, faz: 'ogle', ad: 'Öğle arası' }, { h: 13.5, faz: 'ders', ders: 3, ad: '3. ders' }, { h: 14.83, faz: 'cikis', ad: 'Okul çıkışı' }, { h: 15.5, faz: 'kapali', ad: 'Okul kapalı' },
];
/** saat (0..24, gün içi) -> program satırı */
export function okulProgram(hour: number): { faz: OkulFaz; ders: number; ad: string; i: number } {
  const h = ((hour % 24) + 24) % 24; let i = 0;
  for (let k = 0; k < PROGRAM.length; k++) if (h >= PROGRAM[k].h) i = k;
  const p = PROGRAM[i]; return { faz: p.faz, ders: p.ders || 0, ad: p.ad, i };
}
/** zil çalan geçişler: dersin başı ve sonu, tören ve çıkış */
export const ZIL_FAZ = new Set<OkulFaz>(['toren', 'ders', 'teneffus', 'ogle', 'cikis']);
/**
 * Hangi sınıf hangi derste nerede: sınıflar dönerek fen laboratuvarına ve müzik atölyesine gider (her derste en çok birer sınıf).
 * Değer: oda id'si (yoksa kendi sınıfı). Sınıflar: 1-A okul_1a, 2-A okul_2a, 3-A okul (İngilizce), 4-A okul_4a.
 */
export const DERS_YERI: Record<number, Record<string, string>> = {
  1: { '4-A': 'okul_fen', '2-A': 'okul_muzik' },
  2: { '1-A': 'okul_muzik', '3-A': 'okul_fen' },
  3: { '2-A': 'okul_fen', '4-A': 'okul_muzik' },
};
export const SINIF_ODA: Record<string, string> = { '1-A': 'okul_1a', '2-A': 'okul_2a', '3-A': 'okul', '4-A': 'okul_4a' };
export const dersOdasi = (sinif: string, ders: number) => DERS_YERI[ders]?.[sinif] || SINIF_ODA[sinif];

/* ---------- yürüyüş yolu (aktörler) ---------- */
export type Yer = 'oda' | 'koridor' | 'meydan' | 'bahce' | 'dis';
export function yerOf(p: { x: number; z: number }): { yer: Yer; oda: OkulOda | null } {
  const oda = okulOdaAt(p); if (oda) return { yer: 'oda', oda };
  if (p.z >= OKUL.z0 && p.z <= OKUL.z1 && p.x >= OKUL.x0 && p.x <= OKUL.x1) return { yer: 'koridor', oda: null };
  if (p.z < OKUL.z0) return { yer: p.z < SINIR.z0 ? 'dis' : 'meydan', oda: null };
  return { yer: 'bahce', oda: null };
}
type P2 = { x: number; z: number };
/** meydan / bahçe içinde binanın yanından dolaşmadan düz gidilebilen nokta mı (bina önü ya da arkası) */
const kapiOn = { x: CX, z: OKUL.z0 - 0.9 }, kapiIc = { x: CX, z: OKUL.z0 + 0.9 }, arkaIc = { x: CX, z: KOR.z1 + 0.3 }, arkaDis = { x: CX, z: OKUL.z1 + 0.9 };
/**
 * Bina içinden geçen kaba yol (a hariç, b dahil). Oda içindeki kısım (masa ve sıraların arasından) çağıranın işi (ic-mekan icYol):
 * burada oda kapısının içi ve önü kullanılır. Koridorda orta hat (zm) üzerinden yürünür.
 */
export function okulYol(a: P2, b: P2): P2[] {
  const A = yerOf(a), B = yerOf(b), o: P2[] = [];
  const koridoraCik = (y: { yer: Yer; oda: OkulOda | null }) => {
    if (y.yer === 'oda') { o.push(odaKapiIci(y.oda!), odaKapiOnu(y.oda!)); return odaKapiOnu(y.oda!); }
    if (y.yer === 'meydan' || y.yer === 'dis') { o.push(kapiOn, kapiIc); return kapiIc; }
    if (y.yer === 'bahce') { o.push(arkaDis, arkaIc); return arkaIc; }
    return a;
  };
  // aynı odada ya da aynı açık alanda: düz
  if ((A.yer === 'oda' && B.yer === 'oda' && A.oda === B.oda) || (A.yer === B.yer && A.yer !== 'oda' && A.yer !== 'koridor')) return [b];
  if (A.yer === 'koridor' && B.yer === 'koridor') return [{ x: b.x, z: KOR.zm }, b];
  if ((A.yer === 'meydan' || A.yer === 'dis') && (B.yer === 'meydan' || B.yer === 'dis')) return [b];
  const k0 = A.yer === 'koridor' ? a : koridoraCik(A);
  // koridor orta hattı boyunca hedefin girişine
  const hedefKapi = B.yer === 'oda' ? odaKapiOnu(B.oda!) : B.yer === 'bahce' ? arkaIc : B.yer === 'koridor' ? b : kapiIc;
  o.push({ x: k0.x, z: KOR.zm }, { x: hedefKapi.x, z: KOR.zm });
  if (B.yer === 'oda') o.push(odaKapiOnu(B.oda!), odaKapiIci(B.oda!));
  else if (B.yer === 'bahce') o.push(arkaIc, arkaDis);
  else if (B.yer === 'meydan' || B.yer === 'dis') o.push(kapiIc, kapiOn);
  o.push(b);
  // ardışık aynı noktaları at
  return o.filter((p, i) => i === 0 || Math.hypot(p.x - o[i - 1].x, p.z - o[i - 1].z) > 0.05);
}
/** okul bahçesinin çit kapısından okulun içindeki bir noktaya (kantin müşterisi / işçisi) */
export const okulGelis = (hedef: P2): P2[] => [{ ...OKUL_GIRIS_IC }, ...okulYol(OKUL_GIRIS_IC, hedef)];
/** okulun içindeki bir noktadan çit kapısının dışına */
export const okulGidis = (from: P2): P2[] => [...okulYol(from, OKUL_GIRIS_IC), { x: CX, z: SINIR.z0 - 1.2 }];
