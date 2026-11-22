/**
 * Martı AVM eğlence katı (2026-11-21 21:07 sahip: "AVM'nin içi gezilebilen başka bir âlem olsun: dükkânlar, insanlar, konserler,
 * sinema salonları hepsi ayarlansın"). En üst kat (3): batı blokta iki sinema salonu (Martı Sinemaları), doğu blok holle açık
 * konser alanı (Martı Sahne), önde gişe + mısır tezgâhı. Saf veri + saat takvimi: sim (agents/avm-yasam.ts) ve görünüm
 * (view/world/avm-eglence.ts) buradan okur. Saatler oyun saati (0..24).
 */
import type { Rect } from '../engine/api';
import { AVM, HOL, LOBI_Z1, katY } from './avm-kat';

export const EGLENCE_KAT = 3;
const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });
const T = 0.2, ZM = (LOBI_Z1 + AVM.z1) / 2;

/* ---------- sinema ---------- */
export interface Salon { id: 1 | 2; ad: string; z0: number; z1: number; zc: number; kapi: { x: number; z: number }; ici: { x: number; z: number }; perde: { x: number; z: number; w: number }; koltuk: { x: number; z: number }[] }
// 2026-11-22 salon büyüdü (8.6 m): koltuk sırası salon derinliğine göre (5 sıra x 7), sıraların doğusunda koridor
const SIRA_N = Math.max(3, Math.min(5, Math.floor((HOL.x0 - AVM.x0 - 3.4) / 0.85))), SIRA_X = Array.from({ length: SIRA_N }, (_, i) => AVM.x0 + 2.0 + i * 0.85);
const KOLTUK_N = Math.max(5, Math.min(7, Math.floor(((AVM.z1 - LOBI_Z1) / 2 - 2.2) / 0.8)) | 1), KOLTUK_ARA = 0.8;
/** salonun içinde koltuk sıralarının doğusundaki koridor (seyirci buradan sırasına yürür) */
export const KORIDOR_X = SIRA_X[SIRA_X.length - 1] + 0.75;
function salon(id: 1 | 2, z0: number, z1: number): Salon {
  const zc = (z0 + z1) / 2, koltuk: Salon['koltuk'] = [];
  for (const x of SIRA_X) for (let i = 0; i < KOLTUK_N; i++) koltuk.push({ x, z: zc + (i - (KOLTUK_N - 1) / 2) * KOLTUK_ARA });
  return { id, ad: 'Salon ' + id, z0, z1, zc, kapi: { x: HOL.x0 + 0.55, z: zc }, ici: { x: HOL.x0 - 0.75, z: zc }, perde: { x: AVM.x0 + 0.3, z: zc, w: z1 - z0 - 1.1 }, koltuk };
}
export const SALONLAR: Salon[] = [salon(1, LOBI_Z1, ZM), salon(2, ZM, AVM.z1)];
/** parodi film afişleri (salon sırasıyla döner) */
export const FILMLER = [
  { ad: 'Martı Kaptan 3: Simidin İntikamı', tur: 'Aksiyon', renk: '#d64545' },
  { ad: 'Boğazda Aşk ve Midye', tur: 'Romantik komedi', renk: '#e07bb0' },
  { ad: 'Kayıp Çay Bardağı', tur: 'Gizem', renk: '#4b6fb5' },
  { ad: 'Vapuru Kaçıran Adam', tur: 'Dram', renk: '#6b8f5a' },
  { ad: 'Uzay Simitçisi', tur: 'Bilim kurgu', renk: '#7a55c7' },
];
/** seans: her salon 2 saatlik döngü (salon 2 bir saat kaydırılmış). kapı açık 0..0.35 (oturma), film 0.35..1.75, çıkış 1.75..2. 09-24 arası. */
export type SeansDurum = 'kapali' | 'giris' | 'film' | 'cikis';
export function seans(s: Salon, saat: number): { durum: SeansDurum; t: number; film: (typeof FILMLER)[number]; sonraki: number } {
  const h = ((saat % 24) + 24) % 24, off = s.id === 2 ? 1 : 0, bas = Math.floor((h - off) / 2) * 2 + off, t = h - bas;
  const film = FILMLER[(Math.floor(bas / 2) + s.id * 2) % FILMLER.length];
  const acik = bas >= 9 && bas <= 22, sonraki = bas + 2 > 22 ? 9 + off : bas + 2;
  if (!acik) return { durum: 'kapali', t: 0, film, sonraki: h < 9 + off ? 9 + off : sonraki };
  return { durum: t < 0.35 ? 'giris' : t < 1.75 ? 'film' : 'cikis', t, film, sonraki };
}

/* ---------- konser ---------- */
export const SAHNE = { x0: AVM.x1 - 2.6, x1: AVM.x1 - 0.25, z0: LOBI_Z1 + 1.5, z1: AVM.z1 - 1.6, h: 0.55 } as const;
/** sahne arkası kapısı (müzisyenler buradan gelip gider) ve sahneye çıkış basamağı */
export const KULIS = { x: AVM.x1 - 1.25, z: AVM.z1 - 0.55 }, BASAMAK = { x: AVM.x1 - 1.25, z: SAHNE.z1 + 0.25 };
/** üç müzisyenin yeri (sahnede, hola bakar): saz, vokal (mikrofon), davul */
export const MUZISYEN = [
  { ad: 'Sazcı Kemal', fx: 'saz', x: SAHNE.x0 + 0.85, z: (SAHNE.z0 + SAHNE.z1) / 2 - 2.2 },
  { ad: 'Vokal Ayten', fx: 'mik', x: SAHNE.x0 + 0.65, z: (SAHNE.z0 + SAHNE.z1) / 2 },
  { ad: 'Davulcu Rıza', fx: 'davul', x: SAHNE.x0 + 1.35, z: (SAHNE.z0 + SAHNE.z1) / 2 + 2.2 },
] as const;
/** konser grupları (parodi) ve saatleri: [başlangıç, bitiş) */
export const KONSERLER = [
  { bas: 13, bit: 14.5, grup: 'Martılar Orkestrası' },
  { bas: 17, bit: 18.5, grup: 'Simit & Çay Akustik' },
  { bas: 20, bit: 22, grup: 'Boğaz Rüzgârı' },
];
export function konser(saat: number): { durum: 'yok' | 'hazirlik' | 'sahnede'; grup: string; sonraki: (typeof KONSERLER)[number] } {
  const h = ((saat % 24) + 24) % 24;
  for (const k of KONSERLER) {
    if (h >= k.bas && h < k.bit) return { durum: 'sahnede', grup: k.grup, sonraki: k };
    if (h >= k.bas - 0.4 && h < k.bas) return { durum: 'hazirlik', grup: k.grup, sonraki: k };
  }
  return { durum: 'yok', grup: '', sonraki: KONSERLER.find(k => k.bas > h) || KONSERLER[0] };
}
/** izleyici alanı: sahnenin önü, holün doğu yarısına taşar */
export const SEYIRCI = { x0: HOL.x1 - 1.4, x1: SAHNE.x0 - 0.6, z0: LOBI_Z1 + 1.9, z1: AVM.z1 - 2.1 } as const;

/* ---------- lobi ---------- */
export const GISE = { x: AVM.x0 + 2.4, z: 45.2, w: 2.6, d: 0.8 } as const, MISIR = { x: AVM.x0 + 5.0, z: 45.0, w: 1.1, d: 0.7 } as const;
export const BANKLAR = [{ x: AVM.x1 - 2.6, z: 45.4 }, { x: AVM.cx + 3.0, z: 45.4 }] as const;

/** eğlence katının çarpışması (dünya): sinema bloğu duvarları (kapılar holde), salon perdesi, sahne platformu, dış duvarlar, gişe */
export function eglenceEngel(): Rect[] {
  const o: Rect[] = [
    R(AVM.x0, AVM.x0 + T, LOBI_Z1, AVM.z1), R(AVM.x0, HOL.x0, AVM.z1 - T, AVM.z1), R(AVM.x0, HOL.x0, LOBI_Z1 - T / 2, LOBI_Z1 + T / 2), R(AVM.x0, HOL.x0, ZM - T / 2, ZM + T / 2),
    R(HOL.x1, AVM.x1, AVM.z1 - T, AVM.z1), R(AVM.x1 - T, AVM.x1, LOBI_Z1, AVM.z1), R(SAHNE.x0, SAHNE.x1, SAHNE.z0, SAHNE.z1),
    R(GISE.x - GISE.w / 2, GISE.x + GISE.w / 2, GISE.z - GISE.d / 2, GISE.z + GISE.d / 2), R(MISIR.x - MISIR.w / 2, MISIR.x + MISIR.w / 2, MISIR.z - MISIR.d / 2, MISIR.z + MISIR.d / 2),
  ];
  for (const s of SALONLAR) { o.push(R(HOL.x0 - T / 2, HOL.x0 + T / 2, s.z0, s.zc - 0.65), R(HOL.x0 - T / 2, HOL.x0 + T / 2, s.zc + 0.65, s.z1)); o.push(R(AVM.x0, AVM.x0 + 0.5, s.perde.z - s.perde.w / 2, s.perde.z + s.perde.w / 2)); }
  return o;
}
export const eglenceY = katY(EGLENCE_KAT);
