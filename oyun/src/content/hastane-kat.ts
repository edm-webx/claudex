/**
 * Devlet Hastanesi içi (2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın, çok detaylı olsun, hastaneye bir şeyler yapalım").
 * Saf veri + fonksiyon (three yok, DOM yok). Martı AVM gibi kendi diyarındadır (content/realm.ts 'hastane', x 1450..1550):
 * iskeledeki hastane binası kapalı kabuktur, ön kapısına yürüyen içeri geçer (sim/hastane-gecis.ts).
 *
 * Plan (cephe -z'de, kat yüksekliği 3.6 = AVM ile aynı, katY ortak):
 *   z 44 .. 50 ön bant (zeminde giriş lobisi, üst katlarda bekleme salonu), z 50 .. 68 iki blok oda + ortada HOL (7 m).
 *   Holün ortasında iki şeritli merdiven (yukarı U / aşağı D, AVM yürüyen merdiveniyle aynı biniş kuralı), arka duvarda iki asansör.
 *   Her blokta ön (z 50..59) ve arka (59..68) oda; kapı hola bakar. 4 kat x 4 oda = 16 bölüm.
 * Oda eşyaları oda çerçevesindedir: u holdeki kapı duvarından içeri (0..13.5), v odanın önünden arkaya (0..9); `yon` eşyanın yüzünün
 * baktığı yön ('hol' | 'dis' | 'on' | 'arka'). Çizim view/world/hastane-ic.ts, yaşam sim/agents/hastane-yasam.ts.
 */
import type { Rect } from '../engine/api';
import { katY } from './avm-kat';

export const HST_OX = 1480;
const CX = 1500;
export const HST = { x0: CX - 17, x1: CX + 17, z0: 44, z1: 68, cx: CX, FH: 3.6, KAT: 4 } as const;
export const LOBI_Z1 = 50, SIRA_Z = 59;
export const HOL = { x0: CX - 3.5, x1: CX + 3.5 } as const;
/** merdiven şeritleri ve uçları (AVM ile aynı ölçü: 1.0 m şerit, 3.6 m çıkış 5.24 m'de) */
export const SERIT = { U: { x0: CX - 1.075, x1: CX - 0.075 }, D: { x0: CX + 0.075, x1: CX + 1.075 } } as const;
const MERD_ON = 52.4;
export const MERD = { on: MERD_ON, arka: MERD_ON + 6.24, duz: 0.5, kx0: CX - 1.225, kx1: CX + 1.225 } as const;
/** asansörler: arka duvarda, solda yukarı, sağda aşağı giden kabin */
export const ASANSOR = [{ id: 'yukari', x: CX - 2.0, z: HST.z1 - 0.25, yon: 1 }, { id: 'asagi', x: CX + 2.0, z: HST.z1 - 0.25, yon: -1 }] as const;
/** giriş kapısının boşluğu (zemin cephesi, otomatik kapı) */
export const GIRIS_KAPI = { x0: CX - 1.6, x1: CX + 1.6 } as const;
export const HST_GIRIS = { x: CX, z: HST.z0 - 1.0 }, HST_GIRIS_IC = { x: CX, z: HST.z0 + 0.9 };
export const HST_CIKIS_Z = HST.z0 - 0.25;
/** iskeledeki hastane binası (kabuk, content/zones/karsi.ts kr.hastane) ve ön kapısının önü */
export const HST_BINA = { x: 46.95, z: 53.55, wx: 16.9, wz: 6.7 } as const;
export const HST_DIS = { x: 46.95, z: HST_BINA.z - HST_BINA.wz / 2 - 0.75 } as const, HST_DIS_CIKIS = { x: 46.95, z: HST_BINA.z - HST_BINA.wz / 2 - 1.6 } as const;
export const KAT_ADI = ['Zemin · Acil, Eczane, Kafeterya', '1. Kat · Poliklinikler', '2. Kat · Yataklı Servis', '3. Kat · Ameliyathane, Yoğun Bakım'];
export const KAT_KISA = ['Zemin', '1. Kat', '2. Kat', '3. Kat'];

export const hstIcinde = (p: { x: number; z: number }, m = 0) => p.x > HST.x0 - m && p.x < HST.x1 + m && p.z > HST.z0 - m && p.z < HST.z1 + m;

/* ---------- odalar ---------- */
export type HYon = 'hol' | 'dis' | 'on' | 'arka';
/** w: eşyanın ön yüz genişliği, d: derinliği (yon ile döner; yon yoksa w x'e, d z'ye düşer) */
export interface HEsya { k: string; u: number; v: number; w: number; d: number; yon?: HYon; solid?: boolean; c?: string; txt?: string }
export interface HOda { id: string; ad: string; kat: number; blok: 'W' | 'E'; sira: 'F' | 'B'; x0: number; x1: number; z0: number; z1: number; renk: string; zemin: string; duvar: string; kapali?: boolean; esya: HEsya[] }
const OU = HOL.x0 - HST.x0, OV = SIRA_Z - LOBI_Z1;   // 13.5 x 9
const e = (k: string, u: number, v: number, w: number, d: number, o: Partial<HEsya> = {}): HEsya => ({ k, u, v, w, d, ...o });
const S = { solid: true } as const;

/** yatak sırası: başı duvarda, ayağı yon'a bakar (servis odaları) */
const servisYataklar = (): HEsya[] => {
  const o: HEsya[] = [];
  for (const u of [4.6, 8.4, 12.0]) {
    o.push(e('yatak', u, 1.25, 1.0, 2.1, { ...S, yon: 'arka' }), e('komodin', u + 0.85, 0.4, 0.5, 0.45, S), e('serum', u - 0.7, 0.55, 0.3, 0.3), e('oksijenPano', u, 0.06, 1.2, 0.1), e('perde', u + 1.35, 1.2, 0.05, 2.2));
    o.push(e('yatak', u, OV - 1.25, 1.0, 2.1, { ...S, yon: 'on' }), e('komodin', u + 0.85, OV - 0.4, 0.5, 0.45, S), e('serum', u - 0.7, OV - 0.55, 0.3, 0.3), e('oksijenPano', u, OV - 0.06, 1.2, 0.1), e('perde', u + 1.35, OV - 1.2, 0.05, 2.2));
  }
  o.push(e('refakat', 4.6, 2.75, 0.6, 0.6, { yon: 'on' }), e('refakat', 12.0, OV - 2.75, 0.6, 0.6, { yon: 'arka' }), e('pencere', OU, 4.5, 0.1, 6.0), e('lavabo', 1.0, 0.35, 0.8, 0.5, S), e('cop', 1.9, OV - 0.3, 0.35, 0.35));
  return o;
};

export const ODALAR: HOda[] = [];
function oda(id: string, ad: string, kat: number, blok: 'W' | 'E', sira: 'F' | 'B', renk: string, zemin: string, duvar: string, esya: HEsya[], kapali = false) {
  const x0 = blok === 'W' ? HST.x0 : HOL.x1, x1 = blok === 'W' ? HOL.x0 : HST.x1, z0 = sira === 'F' ? LOBI_Z1 : SIRA_Z, z1 = sira === 'F' ? SIRA_Z : HST.z1;
  ODALAR.push({ id, ad, kat, blok, sira, x0, x1, z0, z1, renk, zemin, duvar, kapali, esya });
}
// ZEMİN
oda('acil', 'ACİL SERVİS', 0, 'W', 'F', '#d93a3a', '#dfe9ec', '#f4f8f9', [
  e('triaj', 3.0, 2.0, 2.4, 0.7, { ...S, yon: 'hol' }), e('pc', 3.0, 2.0, 0.5, 0.3), e('sandalye', 2.0, 2.0, 0.5, 0.5, { yon: 'dis' }),
  ...[1.25, 3.45, 5.65, 7.85].flatMap((v, i) => [e('sedye', 11.6, v, 0.9, 2.0, { ...S, yon: 'hol' }), e('monitor', 13.1, v - 0.55, 0.4, 0.35), e('serum', 13.0, v + 0.6, 0.3, 0.3), ...(i < 3 ? [e('perde', 11.4, v + 1.1, 2.4, 0.05)] : [])]),
  e('acilArabasi', 7.6, 3.3, 0.9, 0.6, { ...S, yon: 'dis' }), e('defib', 7.6, 3.3, 0.4, 0.3), e('oksijen', 8.6, 0.4, 0.5, 0.35, S),
  e('dolap', 6.0, 0.3, 3.2, 0.5, { ...S, yon: 'arka', c: '#cfe0e8' }), e('lavabo', 9.0, 0.35, 0.9, 0.5, S),
  e('tekerlekli', 2.0, OV - 0.6, 0.7, 0.8, { yon: 'on' }), e('saat', 6.0, 0.05, 0.4, 0.05), e('pano', 4.5, OV - 0.05, 2.0, 0.08, { txt: 'TRİAJ: KIRMIZI · SARI · YEŞİL' }),
]);
oda('radyoloji', 'RADYOLOJİ', 0, 'W', 'B', '#7b5fc0', '#e6e4ef', '#f6f5fa', [
  e('rontgen', 9.0, 2.6, 2.2, 0.9, { ...S, yon: 'hol' }), e('rontgenKol', 9.0, 2.6, 0.6, 0.6), e('rontgenPano', 13.3, 2.6, 0.2, 1.6),
  e('mr', 9.4, 6.7, 2.6, 2.4, { ...S, yon: 'hol' }), e('kursunCam', 4.2, 6.6, 0.15, 3.2), e('konsol', 2.6, 7.0, 1.8, 0.7, { ...S, yon: 'dis' }),
  e('sandalye', 1.8, 7.0, 0.5, 0.5, { yon: 'dis' }), e('negatoskop', 5.2, 0.06, 1.6, 0.06), e('radyasyon', 0.08, 2.6, 0.06, 0.6), e('dolap', 6.6, OV - 0.3, 2.4, 0.5, { ...S, yon: 'on', c: '#d9d3ea' }),
]);
oda('eczane', 'ECZANE', 0, 'E', 'F', '#2f9e5a', '#e4eee6', '#f6faf6', [
  e('eczTezgah', 4.2, 4.5, 6.2, 0.8, { ...S, yon: 'hol' }), e('pc', 4.2, 3.3, 0.5, 0.3), e('pc', 4.2, 5.7, 0.5, 0.3), e('poset', 4.2, 4.5, 0.3, 0.3),
  e('ilacRaf', 12.9, 4.5, 7.6, 0.6, { ...S, yon: 'hol' }), e('ilacRaf', 8.5, 0.35, 3.8, 0.6, { ...S, yon: 'arka' }), e('ilacRaf', 8.5, OV - 0.35, 3.8, 0.6, { ...S, yon: 'on' }),
  e('eczDolap', 10.8, OV - 0.4, 1.0, 0.6, { ...S, yon: 'on' }), e('eczHaci', 13.3, 4.5, 0.1, 1.6), e('siraMak', 1.0, 3.2, 0.4, 0.35, S), e('bank', 1.2, OV - 0.6, 2.0, 0.5, { ...S, yon: 'on' }),
  e('baskul', 2.6, 0.5, 0.5, 0.5, S),
]);
oda('kafeterya', 'KAFETERYA', 0, 'E', 'B', '#e8892b', '#efe6d6', '#fbf6ec', [
  e('kafeTezgah', 10.2, 3.6, 5.4, 0.9, { ...S, yon: 'hol' }), e('vitrin', 10.2, 2.4, 0.8, 1.6), e('kasa', 10.2, 5.6, 0.4, 0.4),
  e('arkaTezgah', 12.9, 3.6, 5.4, 0.6, { ...S, yon: 'hol' }), e('semaver', 12.9, 2.2, 0.5, 0.5), e('tostMak', 12.9, 3.5, 0.5, 0.4), e('ayranDolap', 12.9, 5.4, 0.7, 0.6),
  e('menuPano', 13.4, 3.6, 0.06, 3.0, { txt: 'ÇAY · SİMİT · TOST · AYRAN' }),
  ...[[2.6, 1.6], [5.4, 1.6], [2.6, 4.2], [5.4, 4.2], [2.6, 6.9], [5.4, 6.9], [8.0, 7.4]].map(([u, v]) => e('kafeMasa', u, v, 0.8, 0.8, S)),
  e('saksi', 0.6, 0.6, 0.6, 0.6, S), e('saksi', 12.9, OV - 0.6, 0.6, 0.6, S), e('tv', 6.5, OV - 0.06, 1.3, 0.08),
]);
// 1. KAT
oda('dahiliye', 'DAHİLİYE POLİKLİNİĞİ', 1, 'W', 'F', '#2f7fd0', '#e3edf5', '#f5f9fc', [
  e('bolme', 9.0, 4.5, 9.0, 0.12, S),
  ...[2.2, 6.8].flatMap(v => [e('doktorMasa', 8.2, v, 1.6, 0.8, { ...S, yon: 'hol' }), e('pc', 8.2, v - 0.2, 0.5, 0.3), e('koltuk', 9.0, v, 0.6, 0.6, { yon: 'hol' }), e('sandalye', 7.0, v - 0.35, 0.5, 0.5, { yon: 'dis' }), e('sandalye', 7.0, v + 0.35, 0.5, 0.5, { yon: 'dis' }),
    e('muayeneMasa', 12.5, v, 0.75, 1.9, { ...S, yon: 'hol' }), e('paravan', 11.3, v + (v < 4 ? 1.3 : -1.3), 1.6, 0.06), e('tansiyon', 13.45, v - 1.3, 0.06, 0.4), e('lavabo', 13.1, v + (v < 4 ? -1.6 : 1.6), 0.7, 0.5)]),
  e('baskul', 2.0, 0.5, 0.5, 0.5, S), e('pano', 4.0, 0.05, 1.8, 0.08, { txt: 'Dr. Kemal Arslan · Dr. Selin Yaman' }), e('saksi', 1.0, OV - 0.6, 0.6, 0.6, S),
]);
oda('cocuk', 'ÇOCUK POLİKLİNİĞİ', 1, 'W', 'B', '#e8a33b', '#f6ecd8', '#fdf8ee', [
  e('oyunHali', 4.0, 2.6, 3.4, 3.0), e('topHavuz', 3.0, 1.6, 1.4, 1.4, S), e('sallanAt', 5.4, 3.2, 0.5, 1.0, { yon: 'dis' }), e('oyuncakKutu', 2.0, 0.6, 0.8, 0.5, S),
  e('doktorMasa', 9.0, 6.6, 1.6, 0.8, { ...S, yon: 'hol' }), e('pc', 9.0, 6.4, 0.5, 0.3), e('koltuk', 9.8, 6.6, 0.6, 0.6, { yon: 'hol' }), e('sandalye', 7.8, 6.6, 0.5, 0.5, { yon: 'dis' }),
  e('bebekTarti', 12.6, 6.8, 0.7, 0.6, S), e('cocukSedye', 12.4, 2.4, 0.75, 1.7, { ...S, yon: 'hol' }), e('balonlar', 13.4, 4.5, 0.06, 3.0), e('pano', 6.5, 0.05, 2.0, 0.08, { txt: 'AŞI TAKVİMİ' }),
]);
oda('dis', 'AĞIZ VE DİŞ SAĞLIĞI', 1, 'E', 'F', '#1fa3a3', '#e2f0f0', '#f5fbfb', [
  ...[2.3, 6.7].flatMap(v => [e('disUnit', 9.4, v, 0.9, 2.0, { ...S, yon: 'hol' }), e('disLamba', 9.4, v + 0.5, 0.4, 0.4), e('tabure', 8.9, v - 0.85, 0.45, 0.45), e('disTepsi', 9.9, v + 0.8, 0.5, 0.4)]),
  e('bolme', 9.6, 4.5, 7.8, 0.1, S), e('panoramik', 2.6, OV - 0.8, 1.0, 1.0, S), e('sterilDolap', 13.1, 4.5, 1.4, 0.6, { ...S, yon: 'hol' }), e('lavabo', 2.2, 0.35, 0.8, 0.5, S),
  e('pano', 5.0, 0.05, 1.8, 0.08, { txt: 'GÜNDE 2 KEZ FIRÇALA' }),
]);
oda('lab', 'LABORATUVAR · KAN ALMA', 1, 'E', 'B', '#c0392b', '#efe3e3', '#fbf6f6', [
  ...[1.3, 2.9, 6.1, 7.7].map(v => e('kanKoltuk', 2.6, v, 0.8, 0.8, { ...S, yon: 'hol' })), ...[2.1, 7.0].map(v => e('bolme', 2.6, v, 1.4, 0.06)),
  e('labTezgah', 12.8, 4.5, 7.4, 0.8, { ...S, yon: 'hol' }), e('mikroskop', 12.8, 2.2, 0.35, 0.35), e('santrifuj', 12.8, 3.4, 0.45, 0.45), e('tupRaf', 12.8, 4.6, 0.5, 0.25), e('analizor', 12.8, 6.0, 0.6, 0.55), e('tupRaf', 12.8, 7.1, 0.5, 0.25),
  e('kanDolap', 8.0, OV - 0.4, 1.1, 0.7, { ...S, yon: 'on' }), e('labTezgah', 7.2, 0.4, 3.0, 0.7, { ...S, yon: 'arka' }), e('pc', 7.2, 0.45, 0.5, 0.3), e('pano', 5.0, OV - 0.05, 2.0, 0.08, { txt: 'KAN BAĞIŞI = 3 HAYAT' }),
]);
// 2. KAT
oda('servisA', 'SERVİS 201-206', 2, 'W', 'F', '#4f8fbf', '#e8eef2', '#f7fafb', servisYataklar());
oda('servisB', 'SERVİS 207-212', 2, 'W', 'B', '#4f8fbf', '#e8eef2', '#f7fafb', servisYataklar());
oda('yenidogan', 'YENİDOĞAN', 2, 'E', 'F', '#e58fb0', '#f6e9ef', '#fdf6f9', [
  ...[[6.0, 2.0], [8.4, 2.0], [10.8, 2.0], [6.0, 6.8], [8.4, 6.8], [10.8, 6.8]].map(([u, v], i) => e(i % 3 === 1 ? 'besik' : 'kuvoz', u, v, 1.0, 0.6, S)),
  e('camBolme', 3.6, 4.5, 0.08, 8.0), e('sallanan', 12.6, 4.5, 0.7, 0.8, { yon: 'hol' }), e('bebekTarti', 12.8, 1.0, 0.7, 0.6, S), e('dolap', 12.8, OV - 0.4, 1.6, 0.5, { ...S, yon: 'on', c: '#f3d6e2' }),
  e('pano', 8.4, 0.05, 2.4, 0.08, { txt: 'HOŞ GELDİN BEBEK' }), e('balonlar', 13.4, 4.5, 0.06, 2.4),
]);
oda('fizik', 'FİZİK TEDAVİ', 2, 'E', 'B', '#5fae4f', '#e7efe3', '#f7faf5', [
  e('kosuBandi', 11.8, 1.6, 0.8, 1.8, { ...S, yon: 'hol' }), e('kosuBandi', 11.8, 4.0, 0.8, 1.8, { ...S, yon: 'hol' }), e('paralelBar', 7.0, 2.0, 3.0, 0.9, S),
  e('egzMerdiven', 7.0, 6.8, 1.6, 1.0, S), e('tedaviYatak', 3.4, 7.2, 0.8, 1.9, { ...S, yon: 'hol' }), e('tens', 2.5, 7.9, 0.35, 0.3),
  e('pilatesTop', 3.2, 1.4, 0.65, 0.65), e('pilatesTop', 4.2, 1.8, 0.55, 0.55), e('dambilRaf', 13.2, 6.9, 1.4, 0.5, { ...S, yon: 'hol' }), e('ayna', 13.45, 4.0, 0.06, 4.0), e('pano', 6.0, OV - 0.05, 1.8, 0.08, { txt: 'HER GÜN 30 DK YÜRÜ' }),
]);
// 3. KAT
oda('ameliyat', 'AMELİYATHANE', 3, 'W', 'F', '#2f8f6f', '#cfe3da', '#e9f3ef', [
  e('ameliyatMasa', 8.2, 4.5, 0.8, 2.1, { ...S, yon: 'hol' }), e('scialitik', 8.2, 4.5, 1.6, 1.6), e('anestezi', 8.2, 1.8, 0.8, 0.7, { ...S, yon: 'arka' }),
  e('mayo', 9.6, 5.2, 0.7, 0.5), e('aletMasa', 10.8, 6.8, 1.4, 0.7, S), e('monitorDuvar', 13.45, 4.5, 0.06, 2.0), e('sterilDolap', 13.1, 1.2, 1.6, 0.6, { ...S, yon: 'hol' }),
  e('sterilDolap', 13.1, 7.8, 1.6, 0.6, { ...S, yon: 'hol' }), e('oksijen', 6.6, 0.4, 0.5, 0.35, S), e('lavabo', 3.0, 0.35, 1.6, 0.5, S),
], true);
oda('yogun', 'YOĞUN BAKIM', 3, 'W', 'B', '#3f7fb0', '#e2ebf0', '#f4f8fa', [
  ...[1.6, 4.5, 7.4].flatMap(v => [e('yatak', 11.4, v, 1.0, 2.1, { ...S, yon: 'hol' }), e('ventilator', 12.9, v - 0.85, 0.5, 0.5, S), e('monitor', 13.1, v + 0.55, 0.4, 0.35), e('serum', 10.2, v - 0.8, 0.3, 0.3), e('camBolme', 11.2, v + 1.45, 3.6, 0.06)]),
  e('hemsireMasa', 4.6, 4.5, 3.0, 0.8, { ...S, yon: 'dis' }), e('pc', 4.6, 3.8, 0.5, 0.3), e('pc', 4.6, 5.2, 0.5, 0.3), e('monitorDuvar', 0.1, 4.5, 0.06, 1.6), e('acilArabasi', 7.4, 0.5, 0.9, 0.6, { ...S, yon: 'arka' }),
]);
oda('bashekim', 'BAŞHEKİMLİK', 3, 'E', 'F', '#8a6a3a', '#e6dccb', '#f6f1e7', [
  e('makamMasa', 10.6, 4.5, 2.2, 1.0, { ...S, yon: 'hol' }), e('makamKoltuk', 11.6, 4.5, 0.75, 0.75, { yon: 'hol' }), e('sandalye', 9.3, 4.0, 0.5, 0.5, { yon: 'dis' }), e('sandalye', 9.3, 5.0, 0.5, 0.5, { yon: 'dis' }),
  e('bayrak', 12.9, 2.6, 0.5, 0.5), e('portre', 13.45, 4.5, 0.06, 1.1), e('kitaplik', 13.2, 7.4, 2.4, 0.5, { ...S, yon: 'hol' }), e('toplantiMasa', 6.2, 1.8, 3.0, 1.2, S),
  e('koltukTakimi', 6.0, 7.2, 2.2, 0.9, { ...S, yon: 'on' }), e('sehpa', 6.0, 6.2, 1.0, 0.6, S), e('sekreter', 2.4, 1.6, 1.6, 0.7, { ...S, yon: 'hol' }), e('saksi', 13.0, 0.6, 0.6, 0.6, S), e('diploma', 9.0, OV - 0.05, 2.2, 0.06),
]);
oda('nobet', 'NÖBETÇİ DOKTOR ODASI', 3, 'E', 'B', '#6b5b95', '#e5e1ec', '#f6f4f9', [
  e('ranza', 12.6, 1.4, 1.9, 0.95, S), e('ranza', 12.6, 7.6, 1.9, 0.95, S), e('dolapSira', 7.8, 0.3, 3.0, 0.5, { ...S, yon: 'arka' }),
  e('mutfakTezgah', 13.1, 4.5, 2.4, 0.6, { ...S, yon: 'hol' }), e('kahveMak', 13.1, 3.9, 0.35, 0.35), e('kettle', 13.1, 5.0, 0.25, 0.25), e('miniBuzdolap', 13.1, 6.1, 0.55, 0.55, S),
  e('koltukTakimi', 5.2, 7.6, 2.2, 0.9, { ...S, yon: 'on' }), e('sehpa', 5.2, 6.5, 1.0, 0.6, S), e('tv', 5.2, 0.06, 1.3, 0.08), e('kafeMasa', 8.6, 5.0, 0.8, 0.8, S), e('pizza', 8.6, 5.0, 0.4, 0.4),
]);
export const ODA_BY_ID: Record<string, HOda> = Object.fromEntries(ODALAR.map(o => [o.id, o]));

/** oda çerçevesi (u, v) -> dünya (x, z) */
export function odaXZ(o: HOda, u: number, v: number): { x: number; z: number } { return { x: o.blok === 'W' ? o.x1 - u : o.x0 + u, z: o.z0 + v }; }
/** yon'un dünya açısı (+z'ye bakan model bu açıyla döner) */
export function yonRy(o: HOda, y: HYon | undefined): number {
  if (!y) return 0;
  const hol = o.blok === 'W' ? Math.PI / 2 : -Math.PI / 2;
  return y === 'hol' ? hol : y === 'dis' ? -hol : y === 'on' ? Math.PI : 0;
}
/** odanın kapı ortası (hol duvarı üstünde) ve iç / dış noktası */
export function odaKapi(o: HOda): { x: number; z: number; ic: { x: number; z: number }; dis: { x: number; z: number } } {
  const x = o.blok === 'W' ? o.x1 : o.x0, z = (o.z0 + o.z1) / 2, s = o.blok === 'W' ? -1 : 1;
  return { x, z, ic: { x: x + s * 0.9, z }, dis: { x: x - s * 0.9, z } };
}
export const odaIcinde = (o: HOda, p: { x: number; z: number; kat?: number }) => (p.kat || 0) === o.kat && p.x > o.x0 && p.x < o.x1 && p.z > o.z0 && p.z < o.z1;
export const hstOda = (p: { x: number; z: number; kat?: number }) => ODALAR.find(o => odaIcinde(o, p)) || null;

/* ---------- ön bant (lobi / bekleme) ---------- */
export interface BantEsya { k: string; x: number; z: number; w: number; d: number; ry?: number; solid?: boolean; txt?: string }
const b = (k: string, x: number, z: number, w: number, d: number, o: Partial<BantEsya> = {}): BantEsya => ({ k, x, z, w, d, ...o });
/** bekleme koltuk sırası (bağlı koltuklar), yüzü +z'ye */
const sira = (x0: number, n: number, z: number): BantEsya => b('koltukSira', x0 + n * 0.29, z, n * 0.58, 0.6, { solid: true });
export const KABUL = { x0: HST.x0 + 2.4, x1: HST.x0 + 10.4, z: 48.9 } as const;
/** hasta kabul gişeleri (zemin): görevli arkada (z 49.6), hasta önde (z 47.9) */
export const GISE = [0, 1, 2].map(i => ({ id: i + 1, x: KABUL.x0 + 1.4 + i * 2.6, gor: { x: KABUL.x0 + 1.4 + i * 2.6, z: 49.62 }, hasta: { x: KABUL.x0 + 1.4 + i * 2.6, z: 47.95 } }));
export function bantEsya(kat: number): BantEsya[] {
  const o: BantEsya[] = [];
  const E0 = HOL.x1 + 1.2;   // doğu bekleme alanı
  o.push(sira(E0, 8, 46.0), sira(E0, 8, 47.5), b('tv', E0 + 2.3, LOBI_Z1 - 0.06, 1.4, 0.08), b('saksi', HST.x1 - 0.7, HST.z0 + 0.7, 0.8, 0.8, { solid: true }));
  if (kat === 0) {
    o.push(b('kabulTezgah', (KABUL.x0 + KABUL.x1) / 2, KABUL.z, KABUL.x1 - KABUL.x0, 0.7, { solid: true }), b('numarator', (KABUL.x0 + KABUL.x1) / 2, LOBI_Z1 - 0.06, 2.6, 0.08, { txt: 'SIRA 042 → GİŞE 2' }),
      b('danisma', CX - 5.6, 46.0, 2.4, 0.8, { solid: true }), b('guvenlik', CX + 3.4, 45.3, 1.2, 0.6, { solid: true }), b('sebil', HST.x0 + 0.6, 45.0, 0.45, 0.45, { solid: true }),
      b('tekerlekli', CX + 2.6, 44.9, 0.7, 0.8), b('tekerlekli', CX + 3.4, 44.9, 0.7, 0.8), b('saksi', HST.x0 + 0.7, 49.2, 0.8, 0.8, { solid: true }));
  } else {
    o.push(b('kabulTezgah', HST.x0 + 4.4, KABUL.z, 4.0, 0.7, { solid: true }), b('numarator', HST.x0 + 4.4, LOBI_Z1 - 0.06, 2.4, 0.08, { txt: kat === 1 ? 'POLİKLİNİK BANKOSU' : kat === 2 ? 'HEMŞİRE BANKOSU' : 'AMELİYATHANE BEKLEME' }),
      sira(HST.x0 + 7.0, 6, 46.0), b('sebil', HST.x0 + 0.6, 45.0, 0.45, 0.45, { solid: true }), b('saksi', HST.x0 + 0.7, HST.z0 + 0.7, 0.8, 0.8, { solid: true }));
    if (kat === 2) o.push(b('cicekStand', CX - 4.6, 45.0, 1.0, 0.5, { solid: true }));
  }
  return o;
}
/** bekleme koltuklarında oturma noktaları (yüzü +z'ye) */
export function koltuklar(kat: number): { x: number; z: number }[] {
  const o: { x: number; z: number }[] = [];
  for (const s of bantEsya(kat)) if (s.k === 'koltukSira') { const n = Math.round(s.w / 0.58); for (let i = 0; i < n; i++) o.push({ x: s.x - s.w / 2 + 0.29 + i * 0.58, z: s.z - 0.05 }); }
  return o;
}

/* ---------- çarpışma ---------- */
const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
const T = 0.2, KAPI = 0.9;
/** bir eşyanın dünya dikdörtgeni (yon ±x ise genişlik / derinlik yer değiştirir) */
export function esyaRect(o: HOda, s: HEsya): Rect {
  const p = odaXZ(o, s.u, s.v), r = Math.abs(Math.sin(yonRy(o, s.yon))) > 0.5;
  const hw = (r ? s.d : s.w) / 2, hd = (r ? s.w : s.d) / 2;
  return R(p.x - hw, p.x + hw, p.z - hd, p.z + hd);
}
/** bir katın duvarları (dış kabuk, oda duvarları kapı boşluklu, merdiven bloğu) */
export function hstDuvar(kat: number): Rect[] {
  const o: Rect[] = [R(HST.x0, HST.x0 + T, HST.z0, HST.z1), R(HST.x1 - T, HST.x1, HST.z0, HST.z1), R(HST.x0, HST.x1, HST.z1 - T, HST.z1), R(MERD.kx0, MERD.kx1, MERD.on, MERD.arka)];
  if (kat === 0) o.push(R(HST.x0, GIRIS_KAPI.x0, HST.z0, HST.z0 + T), R(GIRIS_KAPI.x1, HST.x1, HST.z0, HST.z0 + T));
  else o.push(R(HST.x0, HST.x1, HST.z0, HST.z0 + T));
  for (const bx of [{ a: HST.x0, h: HOL.x0 }, { a: HOL.x1, h: HST.x1 }]) {
    const hx = bx.h === HOL.x0 ? HOL.x0 : HOL.x1, s = hx === HOL.x0 ? -1 : 1;
    o.push(R(bx.a, bx.h, LOBI_Z1 - T / 2, LOBI_Z1 + T / 2), R(bx.a, bx.h, SIRA_Z - T / 2, SIRA_Z + T / 2));   // ön duvar, ara duvar
    for (const [z0, z1] of [[LOBI_Z1, SIRA_Z], [SIRA_Z, HST.z1]]) {
      const zc = (z0 + z1) / 2, kapali = ODALAR.find(q => q.kat === kat && q.z0 === z0 && (s < 0 ? q.blok === 'W' : q.blok === 'E'))?.kapali;
      if (kapali) o.push(R(hx - T / 2, hx + T / 2, z0, z1));
      else o.push(R(hx - T / 2, hx + T / 2, z0, zc - KAPI), R(hx - T / 2, hx + T / 2, zc + KAPI, z1));
    }
  }
  return o;
}
/** katın bütün çarpışması: duvarlar + odaların ve ön bandın katı eşyaları */
export function hstEngel(kat: number): Rect[] {
  const o = hstDuvar(kat);
  for (const q of ODALAR) if (q.kat === kat) for (const s of q.esya) if (s.solid) o.push(esyaRect(q, s));
  for (const s of bantEsya(kat)) if (s.solid) o.push(R(s.x - s.w / 2, s.x + s.w / 2, s.z - s.d / 2, s.z + s.d / 2));
  return o;
}

/* ---------- merdiven (AVM yürüyen merdiveniyle aynı kural) ---------- */
export interface P3 { x: number; z: number; y: number }
export type SeritId = 'U' | 'D';
export interface Yolculuk { serit: SeritId; alt: number; hedefKat: number; noktalar: P3[] }
const sc = (s: SeritId) => (SERIT[s].x0 + SERIT[s].x1) / 2;
export function hstYolculuk(serit: SeritId, alt: number): Yolculuk {
  const x = sc(serit), yA = katY(alt), yB = katY(alt + 1);
  const yukari: P3[] = [{ x, z: MERD.on, y: yA }, { x, z: MERD.on + MERD.duz, y: yA }, { x, z: MERD.arka - MERD.duz, y: yB }, { x, z: MERD.arka, y: yB }, { x, z: MERD.arka + 0.75, y: yB }];
  if (serit === 'U') return { serit, alt, hedefKat: alt + 1, noktalar: yukari };
  const asagi = yukari.slice(0, 4).reverse(); asagi.push({ x, z: MERD.on - 0.75, y: yA });
  return { serit, alt, hedefKat: alt, noktalar: asagi };
}
export function hstBinis(p: { x: number; z: number }, kat: number, vx: number, vz: number): Yolculuk | null {
  if (!hstIcinde(p)) return null;
  const sp = Math.hypot(vx, vz); if (sp < 0.4) return null;
  for (const s of ['U', 'D'] as SeritId[]) {
    const r = SERIT[s]; if (p.x < r.x0 + 0.05 || p.x > r.x1 - 0.05) continue;
    if (s === 'U' && kat < HST.KAT - 1 && p.z > MERD.on - 0.95 && p.z < MERD.on + 0.05 && vz > 0.45 * sp) return hstYolculuk('U', kat);
    if (s === 'D' && kat > 0 && p.z > MERD.arka - 0.05 && p.z < MERD.arka + 0.95 && vz < -0.45 * sp) return hstYolculuk('D', kat - 1);
  }
  return null;
}

/* ---------- aktör yolu: küçük görünürlük grafiği (duvarlar + katı eşya + merdiven bloğu) ---------- */
const kesisir = (a: { x: number; z: number }, c: { x: number; z: number }, r: Rect): boolean => {
  let t0 = 0, t1 = 1; const dx = c.x - a.x, dz = c.z - a.z;
  const kes = (p: number, q: number) => { if (Math.abs(p) < 1e-9) return q >= 0; const t = q / p; if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } return true; };
  return kes(-dx, a.x - r.x0) && kes(dx, r.x1 - a.x) && kes(-dz, a.z - r.z0) && kes(dz, r.z1 - a.z) && t0 < t1;
};
const PAY = 0.22;
const engelCache: Rect[][] = [], dugumCache: { x: number; z: number }[][] = [];
function engeller(kat: number): Rect[] { return engelCache[kat] ??= hstEngel(kat).map(r => R(r.x0 - PAY, r.x1 + PAY, r.z0 - PAY, r.z1 + PAY)); }
const LANE = { W: (HOL.x0 + MERD.kx0) / 2, E: (MERD.kx1 + HOL.x1) / 2 };
function dugumler(kat: number): { x: number; z: number }[] {
  return dugumCache[kat] ??= [
    { x: LANE.W, z: 48.6 }, { x: LANE.E, z: 48.6 }, { x: CX, z: 48.0 }, { x: LANE.W, z: MERD.on - 0.9 }, { x: LANE.E, z: MERD.on - 0.9 },
    { x: LANE.W, z: MERD.arka + 1.1 }, { x: LANE.E, z: MERD.arka + 1.1 }, { x: LANE.W, z: 64 }, { x: LANE.E, z: 64 }, { x: CX, z: 66.2 },
    { x: HST.x0 + 1.4, z: 47.0 }, { x: HST.x1 - 1.4, z: 49.0 }, { x: HST.x0 + 6, z: 47.0 }, { x: HST.x1 - 6, z: 49.0 },
    ...ODALAR.filter(o => o.kat === kat && !o.kapali).flatMap(o => { const k = odaKapi(o); return [k.ic, k.dis, odaXZ(o, 2.0, 4.5), odaXZ(o, 6.0, 4.5)]; }),
  ];
}
const gorur = (kat: number, a: { x: number; z: number }, c: { x: number; z: number }) => !engeller(kat).some(r => kesisir(a, c, r));
/** bir kattaki iki nokta arası yol (a hariç, b dahil); y = kat yüksekliği. Bulamazsa doğrudan b. */
export function hstKatYol(kat: number, a: { x: number; z: number }, c: { x: number; z: number }): P3[] {
  const y = katY(kat);
  if (gorur(kat, a, c)) return [{ x: c.x, z: c.z, y }];
  const N = [a, ...dugumler(kat), c], n = N.length, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(-1), done = new Array(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let u = -1; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === n - 1) break; done[u] = true;
    for (let v = 1; v < n; v++) if (!done[v]) { const d = dist[u] + Math.hypot(N[u].x - N[v].x, N[u].z - N[v].z); if (d < dist[v] && gorur(kat, N[u], N[v])) { dist[v] = d; prev[v] = u; } }
  }
  if (prev[n - 1] < 0) return [{ x: c.x, z: c.z, y }];
  const yol: P3[] = []; for (let i = n - 1; i > 0; i = prev[i]) yol.unshift({ x: N[i].x, z: N[i].z, y });
  return yol;
}
/** kat ka'daki bir noktadan kat kb'deki bir noktaya: holde yürü, merdivenle in / çık (a hariç, b dahil) */
export function hstYol(ka: number, from: { x: number; z: number }, kb: number, to: { x: number; z: number }): P3[] {
  const o: P3[] = []; let cur = from;
  for (let k = ka; k < kb; k++) { const y = hstYolculuk('U', k), bas = y.noktalar[0]; o.push(...hstKatYol(k, cur, { x: bas.x, z: bas.z - 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1]; }
  for (let k = ka; k > kb; k--) { const y = hstYolculuk('D', k - 1), bas = y.noktalar[0]; o.push(...hstKatYol(k, cur, { x: bas.x, z: bas.z + 0.6 }), ...y.noktalar); cur = y.noktalar[y.noktalar.length - 1]; }
  o.push(...hstKatYol(kb, cur, to));
  return o;
}
