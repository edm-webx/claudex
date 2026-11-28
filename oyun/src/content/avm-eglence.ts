/**
 * Martı AVM sinema katı (en üst kat, 3). 2026-11-21: iki salon + konser sahnesi. 2026-11-22 22:55 sahip: "mısır böyle kapalı yerde
 * olmaz, istasyonlar dip dibe, etraf mısır kokacak; canlı müzik yerini kaldır; sinemaları büyüt; canlı müzik yerinde bekleme alanı
 * ve iki bilet alınabilen gişe olsun; sinemalar gerçek uzun animasyon, hikâyeli, dizi gibi".
 *  - batı blok: Martı Sinemaları, iki büyük salon (lobi dahil blok boyu: 11 m derin, 5 x 11 koltuk), kapılar holde
 *  - doğu blok önü (lobi): iki gişe (oyuncu bilet alır, ziyaretçi önce gişeye uğrar), seans tablosu
 *  - doğu blok ortası: açık Sinema Büfesi standı (duvarsız, satın alınan dükkân k18, content/ic-mekan.ts)
 *  - doğu blok arkası: bekleme alanı (koltuk takımları, fragman ekranı, afiş panoları)
 * Perdede bölüm bölüm animasyon dizisi oynar (content/sinema-dizi.ts). Saf veri + saat takvimi; saatler oyun saati (0..24).
 */
import type { Rect } from '../engine/api';
import { AVM, HOL, LOBI_Z1, ODA_Z, ODA_OLCU, katY } from './avm-kat';

export const EGLENCE_KAT = 3;
const R = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });
const T = 0.2, ZM = (AVM.z0 + AVM.z1) / 2;

/* ---------- sinema ---------- */
export interface Salon { id: 1 | 2; ad: string; z0: number; z1: number; zc: number; kapi: { x: number; z: number }; ici: { x: number; z: number }; perde: { x: number; z: number; w: number; h: number }; koltuk: { x: number; z: number }[] }
// koltuk sıraları perdeye (batı duvarı) bakar; sıralar x boyunca, her sırada salon derinliğine göre koltuk (11 m: 11 koltuk)
const SIRA_N = Math.max(3, Math.min(5, Math.floor((HOL.x0 - AVM.x0 - 3.4) / 0.85))), SIRA_X = Array.from({ length: SIRA_N }, (_, i) => AVM.x0 + 2.2 + i * 0.85);
const KOLTUK_ARA = 0.8, koltukN = (d: number) => Math.max(5, Math.min(11, Math.floor((d - 2.2) / KOLTUK_ARA)) | 1);
/** salonun içinde koltuk sıralarının doğusundaki koridor (seyirci buradan sırasına yürür) */
export const KORIDOR_X = SIRA_X[SIRA_X.length - 1] + 0.75;
/** salon duvar yüksekliği (tavan 3.6) ve perde ölçüsü (2.35:1) */
export const SALON_H = 3.3;
function salon(id: 1 | 2, z0: number, z1: number): Salon {
  const zc = (z0 + z1) / 2, koltuk: Salon['koltuk'] = [], n = koltukN(z1 - z0), ph = 2.75;
  for (const x of SIRA_X) for (let i = 0; i < n; i++) koltuk.push({ x, z: zc + (i - (n - 1) / 2) * KOLTUK_ARA });
  return { id, ad: 'Salon ' + id, z0, z1, zc, kapi: { x: HOL.x0 + 0.55, z: zc }, ici: { x: HOL.x0 - 0.75, z: zc }, perde: { x: AVM.x0 + 0.3, z: zc, w: Math.min(z1 - z0 - 1.4, ph * 2.35), h: ph }, koltuk };
}
export const SALONLAR: Salon[] = [salon(1, AVM.z0, ZM), salon(2, ZM, AVM.z1)];
/** iki salonun dizileri (content/sinema-dizi.ts): salon 1 macera, salon 2 romantik komedi; her seans bir bölüm */
export const FILMLER = [
  { ad: 'Martı Kaptan', tur: 'Macera dizisi', renk: '#d64545' },
  { ad: 'Boğazda Aşk ve Midye', tur: 'Romantik komedi dizisi', renk: '#e07bb0' },
];
/** seans: her salon 3 saatlik döngü (salon 2 bir buçuk saat kaydırılmış). kapı açık 0..0.35 (bilet, oturma), bölüm 0.35..2.75, çıkış 2.75..3. 09-24 arası. */
export type SeansDurum = 'kapali' | 'giris' | 'film' | 'cikis';
export const SEANS_S = 3, FILM_BAS = 0.35, FILM_BIT = 2.75;
export function seans(s: Salon, saat: number): { durum: SeansDurum; t: number; film: (typeof FILMLER)[number]; bolum: number; sonraki: number; f: number } {
  const h = ((saat % 24) + 24) % 24, off = s.id === 2 ? 1.5 : 0, bas = Math.floor((h - off) / SEANS_S) * SEANS_S + off, t = h - bas;
  const film = FILMLER[s.id - 1], ilk = 9 + off, bolum = Math.max(0, Math.round((bas - ilk) / SEANS_S));   // günün kaçıncı seansı = kaçıncı bölüm
  const acik = bas >= ilk && bas + SEANS_S <= 24.01, sonraki = bas + SEANS_S + SEANS_S > 24.01 ? ilk : bas + SEANS_S;
  if (!acik) return { durum: 'kapali', t: 0, film, bolum: 0, sonraki: h < ilk ? ilk : sonraki, f: 0 };
  const f = Math.max(0, Math.min(1, (t - FILM_BAS) / (FILM_BIT - FILM_BAS)));
  return { durum: t < FILM_BAS ? 'giris' : t < FILM_BIT ? 'film' : 'cikis', t, film, bolum, sonraki, f };
}

/* ---------- doğu blok: gişeler, büfe standı, bekleme alanı ---------- */
/** iki gişe kulübesi lobinin doğusunda, hola bakar (w: z boyunca, d: x boyunca). Gişeci kulübenin arkasında, müşteri önünde durur. */
export const GISELER = [1, 2].map(i => {
  const z = AVM.z0 + 1.35 + (i - 1) * 2.4, x = AVM.x1 - 1.75;
  return { id: i, x, z, w: 1.7, d: 1.1, giseci: { x: AVM.x1 - 0.75, z }, musteri: { x: x - 1.2, z } };
});
export const BILET_FIYAT = 40;
/** bekleme alanı (eski sahnenin yeri, doğu blok arkası): koltuk takımları fragman duvarına (doğu) bakar */
export const BEKLEME = { x0: HOL.x1 + 0.6, x1: AVM.x1 - 0.3, z0: ODA_Z.B - ODA_OLCU.W / 2 + 0.6, z1: AVM.z1 - 0.3 } as const;
export const KANEPELER = [0, 1, 2, 3].map(i => ({ x: BEKLEME.x0 + 1.6 + (i % 2) * 3.4, z: BEKLEME.z0 + 1.6 + Math.floor(i / 2) * 3.2, w: 2.2, d: 0.85 }));
/** bankta / kanepede oturma noktaları (ziyaretçiler, avm-yasam.ts): doğuya (fragman ekranına) bakar */
export const BANKLAR = KANEPELER.map(k => ({ x: k.x, z: k.z }));
export const FRAGMAN = { x: AVM.x1 - 0.22, z: (BEKLEME.z0 + BEKLEME.z1) / 2, w: 4.4, h: 1.9 } as const;

/** eğlence katının çarpışması (dünya): salon duvarları (kapılar holde), perde sahnesi, dış duvarlar, gişeler, kanepeler */
export function eglenceEngel(): Rect[] {
  const o: Rect[] = [
    R(AVM.x0, AVM.x0 + T, AVM.z0, AVM.z1), R(AVM.x0, HOL.x0, AVM.z1 - T, AVM.z1), R(AVM.x0, HOL.x0, AVM.z0, AVM.z0 + T), R(AVM.x0, HOL.x0, ZM - T / 2, ZM + T / 2),
    R(HOL.x1, AVM.x1, AVM.z1 - T, AVM.z1), R(AVM.x1 - T, AVM.x1, LOBI_Z1, AVM.z1),
  ];
  for (const g of GISELER) o.push(R(g.x - g.d / 2, g.x + g.d / 2, g.z - g.w / 2, g.z + g.w / 2));
  for (const k of KANEPELER) o.push(R(k.x - k.d / 2, k.x + k.d / 2, k.z - k.w / 2, k.z + k.w / 2));
  for (const s of SALONLAR) { o.push(R(HOL.x0 - T / 2, HOL.x0 + T / 2, s.z0, s.zc - 0.65), R(HOL.x0 - T / 2, HOL.x0 + T / 2, s.zc + 0.65, s.z1)); o.push(R(AVM.x0, AVM.x0 + 0.5, s.perde.z - s.perde.w / 2, s.perde.z + s.perde.w / 2)); }
  return o;
}
export const eglenceY = katY(EGLENCE_KAT);
