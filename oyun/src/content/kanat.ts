/**
 * BUF-19/20 kanat ve salon masaları (pure data, no three, no DOM). Büfe iskelede yerinde büyür: batı çay bahçesi, doğu
 * dondurma terası, kahvaltı salonu (salonW), balık lokantası (salonE) ve aşama 8'den iki salonun çatı terası. Bu masaların
 * HEPSİ sim masasıdır (rt.layout.tables, index 8+k sabit): müşteri yürüyüp oturur, garson gidip servis eder, hesap ödenir.
 * Masa sayısı aşamadan türetilir (kayıt şeması değişmez): `kanatKurulu(stage)`.
 *
 * Koltuk düzeni sim'inkidir (customers.ts seatPos): ax 'x' masada iki koltuk x ekseninde ±0.78, garson z+0.95'te; ax 'z' masada
 * koltuklar z ekseninde, garson x+0.95'te. Görünüm (view/world/bufe-buyume.ts, ic-mekan-look.ts) masayı aynı yerde, sandalyeleri
 * aynı koltuklarda çizer; çarpışma (buyumeEngel) masa gövdesini kapatır, koltuk ve garson noktası boş kalır.
 *
 * Çatı terasları (aşama 8): sim 2B olduğu için çatıdaki aktör, salonun dış merdiveninden (stair) çıkan sabit bir rota izler (nav
 * değil: merdiven yürünebilir ızgarada kapalıdır, yerdeki kimse oraya girmez) ve yüksekliğini `katY` verir (müşteri: crowd y,
 * garson: actor y). Çatıdaki biri yalnız merdivenden iner; yerdeki kimse çatı yüksekliğine çıkmaz (yukarıda bayrağı yoksa 0).
 */
import type { Vec2 } from '../engine/api';
import { KANAT_W, KANAT_E, TERAS_Y, TERAS_Z } from './restoran-plan';

export type KanatBolge = 'cay' | 'dondurma' | 'salonW' | 'salonE' | 'catiW' | 'catiE';
export interface KanatMasa { x: number; z: number; ax: 'x' | 'z'; bolge: KanatBolge; asama: number; cati?: 'W' | 'E' }
/** sim masa indexi bu sayıdan başlar (0..7 büfe önü / tabure / tavla masaları, content/prefabs/iskele/layout.ts) */
export const KANAT_BASE = 8;
/** salonların merkezi ve boyu (content/ic-mekan.ts salonW / salonE ile aynı), koltuk düzeni salon çerçevesinde */
const SW = { x: (KANAT_W.x0 + KANAT_W.x1) / 2, z: (KANAT_W.z0 + KANAT_W.z1) / 2 }, SE = { x: (KANAT_E.x0 + KANAT_E.x1) / 2, z: (KANAT_E.z0 + KANAT_E.z1) / 2 };
/** 2026-11-25 ters U: salon masaları kanadın arka hattının önünde iki sıra (dünya z -12.4 ve -10.4), kanat çerçevesinde */
export const SALON_U = [-4.4, -1.6, 1.6, 4.4], SALON_V = [-5.8, -3.8];
const salon = (c: { x: number; z: number }, bolge: KanatBolge, ilk: number): KanatMasa[] => {
  const o: KanatMasa[] = [];
  for (const v of SALON_V) for (const u of SALON_U) {
    const on = v === SALON_V[1] && Math.abs(u) < 3;   // kapıya yakın iki masa: aşama 10 fine dining masaları
    o.push({ x: c.x + u, z: c.z + v, ax: 'x', bolge, asama: on ? 10 : ilk });
  }
  return o;
};
/** sıra = sim index sırası (asla değişmez; yeni masa sona eklenir) */
export const KANAT_MASALAR: KanatMasa[] = [
  // batı çay bahçesi: aşama 3'te 4, aşama 5'te 8 (pergola altı)
  ...[[-18.6, -6.6], [-15.0, -6.6], [-18.6, -3.4], [-15.0, -3.4]].map(([x, z]) => ({ x, z, ax: 'x' as const, bolge: 'cay' as const, asama: 3 })),
  ...[[-18.6, -0.2], [-15.0, -0.2], [-18.6, 2.2], [-15.0, 2.2]].map(([x, z]) => ({ x, z, ax: 'x' as const, bolge: 'cay' as const, asama: 5 })),
  // doğu dondurma terası: aşama 4'te 4, aşama 7'de 6
  ...[[11.6, -1.4], [14.2, -1.4], [11.6, 1.6], [14.2, 1.6]].map(([x, z]) => ({ x, z, ax: 'x' as const, bolge: 'dondurma' as const, asama: 4 })),
  ...[[16.8, -1.4], [16.8, 1.6]].map(([x, z]) => ({ x, z, ax: 'x' as const, bolge: 'dondurma' as const, asama: 7 })),
  // kahvaltı salonu (aşama 6) ve balık lokantası (aşama 7): 6 masa, aşama 10'da +2
  ...salon(SW, 'salonW', 6),
  ...salon(SE, 'salonE', 7),
  // çatı terasları (aşama 8): salonun ortası boyunca 4 masa, koltuklar z ekseninde, garson masanın doğusunda
  ...[-21.0, -18.4, -15.8, -13.2].map(x => ({ x, z: 0.2, ax: 'z' as const, bolge: 'catiW' as const, asama: 8, cati: 'W' as const })),
  ...[11.4, 14.2, 17.0, 19.8].map(x => ({ x, z: 0.2, ax: 'z' as const, bolge: 'catiE' as const, asama: 8, cati: 'E' as const })),
];
export const KANAT_N = KANAT_MASALAR.length;
/** sim masa indexinin kanat tanımı (büfe masası ise null) */
export const kanatOf = (table: number): KanatMasa | null => KANAT_MASALAR[table - KANAT_BASE] ?? null;
export const masaCati = (table: number): 'W' | 'E' | null => kanatOf(table)?.cati ?? null;
/** o aşamada açılmış (alınabilir) kanat masalarının sim indexleri */
export const kanatAcik = (stage: number): number[] => KANAT_MASALAR.map((m, k) => (stage >= m.asama ? KANAT_BASE + k : -1)).filter(i => i >= 0);
/**
 * 2026-11-22 (sahibi: "her yere masa alalım tek tek sarı karelerle müşteriler oturabilsin"): kanat / salon / çatı masaları aşama
 * açınca kendiliğinden kurulmaz; her bölgenin ilk masası hediye, gerisi masanın yerindeki sarı kareyle tek tek alınır (sim/mulk.ts
 * masaAl, S.zones.masa.alinan). Kayıt kaydı sim her adımda buraya yazar (setMasaAlinan); null = kayıt yok (eski davranış: hepsi kurulu).
 */
let MASA_ALINAN: ReadonlySet<number> | null = null;
export const setMasaAlinan = (a: readonly number[] | null): void => { MASA_ALINAN = a ? new Set(a) : null; };
/** bölgenin hediye masası (bölgedeki ilk masa) */
export const masaHediye = (table: number): boolean => { const m = kanatOf(table); return !!m && KANAT_MASALAR.findIndex(x => x.bolge === m.bolge) === table - KANAT_BASE; };
/** o aşamada kurulu kanat masalarının sim indexleri */
export const kanatKurulu = (stage: number): number[] => kanatAcik(stage).filter(i => !MASA_ALINAN || MASA_ALINAN.has(i) || masaHediye(i));
/** tam o aşamada açılan kanat masaları (tadilat bitince; kurulu olanı kanatKurulu söyler) */
export const kanatYeni = (stage: number): number[] => KANAT_MASALAR.map((m, k) => (m.asama === stage ? KANAT_BASE + k : -1)).filter(i => i >= 0);
/** bölge başına kurulu masa sayısı */
export const kanatSay = (stage: number, b: KanatBolge): number => { const on = new Set(kanatKurulu(stage)); return KANAT_MASALAR.filter((m, k) => m.bolge === b && on.has(KANAT_BASE + k)).length; };
/** masanın sarı kare fiyatı: açıldığı aşamanın gelirine oranlı (aşama 3 çay bahçesi 15 bin ... aşama 10 fine dining 6 milyon) */
const MASA_FIYAT: Record<number, number> = { 3: 15000, 4: 40000, 5: 120000, 6: 300000, 7: 700000, 8: 1500000, 9: 3000000, 10: 6000000 };
export const masaFiyat = (table: number): number => (masaHediye(table) ? 0 : MASA_FIYAT[kanatOf(table)?.asama ?? 3] ?? 15000);
export const BOLGE_AD: Record<KanatBolge, string> = { cay: 'Çay bahçesi', dondurma: 'Dondurma terası', salonW: 'Kahvaltı salonu', salonE: 'Balık lokantası', catiW: 'Batı çatı terası', catiE: 'Doğu çatı terası' };

/** Salon aleti (SALON_ESYA) hangi masalara etki eder: W -> çay bahçesi + kahvaltı salonu + batı çatısı, E -> dondurma + balık + doğu çatısı */
export const kanatYanı = (b: KanatBolge): 'W' | 'E' => (b === 'cay' || b === 'salonW' || b === 'catiW' ? 'W' : 'E');

/**
 * Kanat masasında kişi başı adisyon çarpanı: masa hesabı = bilet kalemleri x bu çarpan (x salon aleti adisyon çarpanı).
 * Kalibrasyon (2026-11-20, tam kadro, 16 dk sim, aşama başına): eski pasif salon geliri SALON.mis x SALON.adisyon / oyun saati idi
 * (aşama 10: 156.000). Gerçek akışta kanatlar bir oyun saatinde (~25 sn) yalnız 0.6-3 misafir ağırlayabilir (masa devri ~80 sn,
 * garson yürüyüşü, çatı merdiveni); SALON.mis'e yürüyen ajanla ulaşılamaz. Aradaki fark teras/salon fiyatı olarak hesaba girer
 * (servis ücreti, serpme/balık porsiyonu, manzara, fine dining). Ölçülen gerçek salon geliri / eski pasif: aşama 3-10 sırasıyla
 * 0.89 0.88 0.90 0.88 0.95 0.83 0.95 0.98 (eski seviyenin biraz altında: salon aletleri ve servis yıldızı üstüne biner). Index = aşama.
 */
// 2026-11-21 (restoran ayrımı: masa payı 6-10 %60-%90, salon pass'ları): 3 tohum x 12 dk tam kadro ölçümüyle aşama başına toplam gelir
// eskisiyle ±%5 içinde kalsın diye 6 / 8 / 9 yeniden ayarlandı (6: -%18 -> 50, 8: +%21 -> 85, 9: +%26 -> 185; 5, 7, 10 değişmedi).
export const KANAT_FIYAT_X = [1, 1, 1, 16, 20, 20, 50, 73, 85, 185, 290];
export const kanatFiyatX = (stage: number) => KANAT_FIYAT_X[Math.max(0, Math.min(10, Math.round(stage) || 0))];

/* ---------- çatı terası rotası ve yüksekliği ---------- */
/** salon kat yüksekliği (bufe-buyume.ts hall(): ph 3.4) ve çatı döşemesi (top + 0.36) */
export const catiY = (_stage: number, _s: 'W' | 'E'): number => TERAS_Y;   // 2026-11-25: iki kanat aynı yükseklikte
/** merdiven (bufe-buyume.ts: x = r.x1 + 0.55 batıda, r.x0 - 0.55 doğuda; basamaklar z -10.9 .. -16.1), çatı ayak izi ve çatı koridoru */
export const CATI = {
  W: { sx: -10.75, x0: KANAT_W.x0 + 0.2, x1: KANAT_W.x1 - 0.2, entryX: -11.7 },
  E: { sx: 8.75, x0: KANAT_E.x0 + 0.2, x1: KANAT_E.x1 - 0.2, entryX: 9.7 },
} as const;
const Z_ALT = 2.9, Z_UST = -2.0, Z0 = TERAS_Z, Z1 = KANAT_W.z1, KORIDOR = -2.0, MERD_YARI = 0.4;
/** merdivenin ayağı (yerde, yürünebilir) */
export const catiAyak = (s: 'W' | 'E'): Vec2 => ({ x: CATI[s].sx, z: Z_ALT + 0.35 });
/** merdivenin yürünebilir ızgarada kapalı kutusu (aşama 8+; yerdeki kimse girmez) */
export const merdivenKutu = (s: 'W' | 'E') => ({ x0: CATI[s].sx - 0.45, x1: CATI[s].sx + 0.45, z0: Z_UST - 0.3, z1: Z_ALT - 0.1 });
/** merdiven ayağından çatıdaki `to` noktasına: basamaklar, çatıya giriş, koridor, hedef */
export function catiYukari(s: 'W' | 'E', to: Vec2): Vec2[] {
  const c = CATI[s];
  return [{ x: c.sx, z: Z_ALT }, { x: c.sx, z: Z_UST }, { x: c.entryX, z: Z_UST }, { x: to.x, z: KORIDOR }, { x: to.x, z: to.z }];
}
/** çatıdaki `from` noktasından merdiven ayağına */
export function catiAsagi(s: 'W' | 'E', from: Vec2): Vec2[] {
  const c = CATI[s];
  return [{ x: from.x, z: KORIDOR }, { x: c.entryX, z: Z_UST }, { x: c.sx, z: Z_UST }, { x: c.sx, z: Z_ALT }, catiAyak(s)];
}
/** çatıda bir noktadan ötekine (koridor üzerinden, masaların arasından değil) */
export const catiIc = (from: Vec2, to: Vec2): Vec2[] => [{ x: from.x, z: KORIDOR }, { x: to.x, z: KORIDOR }, { x: to.x, z: to.z }];
/** konumun çatı tarafı (x'e göre) */
export const catiTaraf = (p: Vec2): 'W' | 'E' => (p.x < 0 ? 'W' : 'E');
/**
 * Yükseklik: merdiven kutusunda basamak yüksekliği, çatı ayak izinde (yalnız `yukari` iken: çatıdan / merdivenden gelen) çatı
 * döşemesi, başka her yerde 0. Aşama 8 altında çatı yok.
 */
export function katY(stage: number, x: number, z: number, yukari: boolean): number {
  if (stage < 8) return 0;
  for (const s of ['W', 'E'] as const) {
    const c = CATI[s], ry = catiY(stage, s);
    if (Math.abs(x - c.sx) < MERD_YARI && z <= Z_ALT + 0.05 && z >= Z_UST - 0.3) return ry * Math.max(0, Math.min(1, (Z_ALT - z) / (Z_ALT - Z_UST)));
    if (yukari && x > Math.min(c.x0, c.entryX) - 0.5 && x < Math.max(c.x1, c.entryX) + 0.5 && z > Z0 - 0.5 && z < Z1 + 0.5) return ry;
  }
  return 0;
}

/**
 * Garson postları (boştayken bölgesinin başında bekler, işi alınca oradan çıkar): çay bahçesinin garsonu çay ocağının önünde
 * çaycı olarak durur; terasın garsonu dondurma dolabının yanında; salon garsonu salonun içinde, açık büfenin önünde.
 */
export const KANAT_POST: Record<KanatBolge, Vec2> = {
  cay: { x: -20.9, z: -7.9 }, dondurma: { x: 19.6, z: -0.2 }, salonW: { x: SW.x, z: -14.6 }, salonE: { x: SE.x, z: -14.6 },
  catiW: { x: -11.7, z: 3.4 }, catiE: { x: 9.7, z: 3.4 },
};
