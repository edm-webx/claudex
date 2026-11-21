/**
 * DNY-01/02/03/19: yaşayan sokak verisi (saf veri, three yok). sim/ambient.ts bu tablolardan okur:
 * - sabit havuz (sim her cihazda aynı sayıda vatandaş yürütür; görünüm kalite kademesine göre kırpar: TIER_TABLE crowd 25/50/90)
 * - saate göre yoğunluk (gece sokak seyrelir; fazlası bir kapıdan içeri girer, sabah aynı kapılardan çıkar: ışınlanma yok)
 * - saat bandına göre hedef türü ağırlıkları (gez, otur, bekle, kapı, karşıya geç, korkuluk, sığınak, gölge)
 * - noktalar: iskele ve karşı yaka kaldırımları, meydan bankları, kapı önleri, durak, korkuluk, tente altı, ağaç gölgesi
 * - sokak rolleri: koşucu, balıkçı, bekçi, sokak müzisyeni, köpek gezdiren (hepsi havuzun içinden, ayrı sistem değil)
 * Koordinatlar iskele bölgesinin dünya metresi; yol (z 14..28.4) yürüme ızgarasında kapalı, tek geçiş üst geçit (content/ustgecit UG).
 * Karşı yakadaki sabit bank oturanları ve çaycı (view/world/karsi-yasam.ts) ile çakışmasın diye o banklar burada yok.
 */
import { UG } from './ustgecit';

/** Sim havuzu (vatandaş sayısı): kademeden bağımsız sabit. */
export const SOKAK_HAVUZ = 48;
/** Kahramandan bu kadar uzaktaki vatandaş çizilmez ve 3 adımda bir yürütülür (DNY-20); arada gecikme payı. */
export const SOKAK_LOD = { yakin: 15, gizle: 52, goster: 46, seyrek: 3 };

/** Saat (8..27, 24+ gece yarısından sonra) -> sokakta olan oran (0..1). Aradaki saatler doğrusal. */
export const SOKAK_YOGUNLUK: [number, number][] = [[8, 0.55], [9, 0.8], [12, 1], [14, 0.9], [17, 1], [20, 0.85], [22, 0.6], [24, 0.32], [26, 0.15], [27, 0.12]];

export type SokakHedef = 'gez' | 'otur' | 'bekle' | 'kapi' | 'karsi' | 'korkuluk' | 'siginak' | 'golge';
/** Saat bandı -> hedef ağırlıkları (DNY-01 programı). */
export const SOKAK_PROGRAM: { saat: [number, number]; w: Partial<Record<SokakHedef, number>> }[] = [
  { saat: [8, 11], w: { kapi: 0.2, karsi: 0.22, gez: 0.26, otur: 0.1, bekle: 0.14, korkuluk: 0.08 } },     // sabah: işe, okula, vapura
  { saat: [11, 15], w: { otur: 0.3, gez: 0.28, karsi: 0.16, kapi: 0.1, korkuluk: 0.1, bekle: 0.06 } },     // öğlen: oturan, yemek molası
  { saat: [15, 21], w: { gez: 0.34, otur: 0.2, korkuluk: 0.16, karsi: 0.16, kapi: 0.09, bekle: 0.05 } },  // akşam gezmesi
  { saat: [21, 28], w: { kapi: 0.3, gez: 0.32, korkuluk: 0.16, otur: 0.1, karsi: 0.12 } },                // gece seyrelir
];

export type Yaka = 'i' | 'k';
export interface SokakNokta { x: number; z: number; rot?: number; yaka: Yaka }
const N = (x: number, z: number, rot?: number): SokakNokta => ({ x, z, rot, yaka: z > 20 ? 'k' : 'i' });

/** Gezinti noktaları (kaldırımlar, meydan, patikalar). Büfe çevresi müşterilerin; oraya gidilmez. */
export const SOKAK_YURU: SokakNokta[] = [
  // iskele kordonu (lambalar z 5, banklar z 5.95: aralarından)
  ...[-50, -40, -30, -20, -10, 10, 20, 30, 40, 50].flatMap(x => [N(x, 7.4), N(x + (x === 20 ? -3 : 3), 11.4)]),
  N(-18, -12), N(-18, 0), N(15, -14), N(16, -1),
  // karşı yaka kuzey kaldırımı
  ...[-55, -42, -24, -14, 0, 16, 40, 55].map(x => N(x, 30.0)),
  // meydan, patikalar, güney kaldırımı
  N(-9, 40), N(1, 40), N(-9, 50), N(1, 50), N(-3.9, 38.4), N(-3.9, 51.6),
  N(14, 42.6), N(24, 42.6), N(30.5, 50), N(8.5, 46), N(40, 47.2), N(52, 47.2),
  N(-40, 57.4), N(-20, 57.4), N(0, 57.4), N(20, 57.4), N(40, 57.4),
];
/** Kapılar: vatandaş buradan girer (görünmez olur) ve çıkar. Apartman, kafe, banka, kırtasiye, okul, AVM, hastane, metro, harita kenarı. */
export const SOKAK_KAPI: SokakNokta[] = [
  N(-52.7, 7.0), N(-52.7, 11.2), N(53.6, 7.0), N(53.6, 11.2),
  N(-12.6, 37.9), N(-12.6, 51.5), N(11.7, 41.9), N(28, 32.4), N(48.85, 32.4),
  N(26.0, 45.7), N(21.45, 45.7), N(17.55, 45.7), N(13.65, 45.7), N(46.95, 49.3), N(8.5, 54.2),
  N(-61.2, 30.2), N(61.2, 30.2), N(-61.2, 57.6), N(61.2, 57.6),
];
/** Bekleme: otobüs durağı (camlı sığınağın önü) ve vapur iskelesi kenarı. */
export const SOKAK_BEKLE: SokakNokta[] = [N(4.9, 12.3, 0), N(6.1, 12.3, 0), N(7.2, 12.3, 0), N(21.6, -9.0, Math.PI / 2), N(21.6, -5.2, Math.PI / 2), N(20.6, -10.2, Math.PI / 2)];
/** Korkuluk başı: denize bakan (kordon güney kenarı, iskele kıyısı). */
export const SOKAK_KORKULUK: SokakNokta[] = [N(-53, 5.35, Math.PI), N(-43, 5.35, Math.PI), N(-33, 5.35, Math.PI), N(27, 5.35, Math.PI), N(37, 5.35, Math.PI), N(47, 5.35, Math.PI), N(-22.7, -7, -Math.PI / 2), N(-10, -17.35, Math.PI), N(22.05, -15, Math.PI / 2)];
/** Tente altı (yağmurda sığınak): durak sığınağı, kafe/banka/AVM/hastane kapı saçakları, metro kanopisi, apartman girişleri. */
export const SOKAK_SIGINAK: SokakNokta[] = [
  N(4.8, 12.5, 0), N(6.0, 12.5, 0), N(7.2, 12.5, 0),
  N(-13.0, 37.2, Math.PI / 2), N(-13.0, 38.6, Math.PI / 2), N(-13.0, 50.8, Math.PI / 2), N(-13.0, 52.2, Math.PI / 2),
  N(10.6, 41.7, 0), N(12.8, 41.7, 0), N(13.65, 46.0, 0), N(17.55, 46.0, 0), N(21.45, 46.0, 0), N(26.0, 46.0, 0),
  N(8.0, 53.0, Math.PI), N(9.0, 53.0, Math.PI), N(8.0, 54.4, 0), N(9.0, 54.4, 0),
  N(45.8, 49.6, 0), N(48.1, 49.6, 0), N(27.2, 32.6, Math.PI), N(28.8, 32.6, Math.PI),
  N(-52.7, 7.8, Math.PI / 2), N(53.5, 7.8, -Math.PI / 2), N(-52.7, 10.4, Math.PI / 2), N(53.5, 10.4, -Math.PI / 2),
];
/** Ağaç gölgesi (sıcakta): karşı yaka ağaç sıralarının dibi. */
export const SOKAK_GOLGE: SokakNokta[] = [...[-48, -30, -8, 10, 34, 52].map(x => N(x + 0.9, 30.1)), ...[-44, -28, -10, 3, 18, 34, 47].map(x => N(x + 0.9, 57.3))];

/** Karşı yaka meydan bankları (kr.bench: oturan bankın önüne bakar, rotY 0 => +z). karsi-yasam'ın sabit oturanlarının bankları hariç. */
export interface SokakBank { x: number; z: number; rot: number }
export const SOKAK_BANK: SokakBank[] = [
  ...[0, 2, 4, 5].map(i => ({ x: -10.6 + i * 2.8, z: 34.8, rot: 0 })),
  ...[1, 3, 5].map(i => ({ x: -10.6 + i * 2.8, z: 55.3, rot: Math.PI })),
];
/** Bank başına iki oturak (bank merkezinden ±0,45 m); yaklaşma noktası bankın 0,6 m önü (bank ızgarada dolu). */
export const bankOturak = (b: SokakBank, j: number) => ({ x: b.x + (j ? 0.45 : -0.45) * Math.cos(b.rot), z: b.z - (j ? 0.45 : -0.45) * Math.sin(b.rot), rot: b.rot });
export const bankOnu = (b: SokakBank, j: number) => { const s = bankOturak(b, j); return { x: s.x + Math.sin(b.rot) * 0.6, z: s.z + Math.cos(b.rot) * 0.6 }; };

/** Üst geçidin iki ayağı (merdivenin dibi, yola değil kaldırıma iner). Yakalar arası her yol buradan geçer. */
export const UG_AYAK = { i: { x: UG.x, z: UG.zA - 0.7 }, k: { x: UG.x, z: UG.zD + 0.7 } };

/** DNY-02 sokak rolleri. Rol vatandaşı havuzdan atanır; saat aralığı dışında rol biter, vatandaş kapıdan girer. */
export type SokakRolId = 'kosucu' | 'balikci' | 'bekci' | 'muzisyen' | 'kopekli';
export interface SokakRol {
  id: SokakRolId; ad: string;
  /** citizens tip kimliği (görünüş) */ tip: string;
  /** saat aralıkları (8..27) */ saat: [number, number][];
  /** aynı anda en çok */ adet: number;
  /** tur rotası (sırayla, döngü) ya da duraklar (rastgele) */ rota?: SokakNokta[]; durak?: SokakNokta[];
  /** durakta kalma süresi sn */ kal?: [number, number];
}
export const SOKAK_ROLLER: SokakRol[] = [
  { id: 'kosucu', ad: 'Koşucu', tip: 'universiteli', saat: [[8, 10.5], [18, 21]], adet: 2,
    rota: [N(-46, 9.5), N(18, 9.5), N(UG.x, UG.zA - 0.7), N(UG.x, UG.zD + 0.7), N(40, 30.2), N(-46, 30.2), N(UG.x - 0.01, UG.zD + 0.7), N(UG.x - 0.01, UG.zA - 0.7)] },
  { id: 'balikci', ad: 'Balıkçı', tip: 'oltaci', saat: [[8, 20]], adet: 2, kal: [45, 110],
    durak: [N(18.5, 4.6, Math.PI), N(-22.7, -13, -Math.PI / 2), N(-22.7, -2, -Math.PI / 2), N(-16, -17.35, Math.PI), N(14, -17.35, Math.PI), N(22.05, -16.2, Math.PI / 2)] },
  { id: 'bekci', ad: 'Gece bekçisi', tip: 'taksici', saat: [[22, 27]], adet: 1, kal: [3, 6],
    durak: [N(-40, 9.5), N(-12.6, 38.6), N(11.7, 42.4), N(26.0, 46.4), N(8.5, 46), N(40, 30.6), N(-30, 9.5), N(30, 9.5), N(46.95, 48.8)] },
  { id: 'muzisyen', ad: 'Sokak müzisyeni', tip: 'muzisyen', saat: [[11, 23]], adet: 1, kal: [60, 140],
    durak: [N(-11.2, 44.2, Math.PI / 2), N(14.5, 7.6, 0), N(-36, 7.6, 0)] },
  { id: 'kopekli', ad: 'Köpek gezdiren', tip: 'universiteli', saat: [[8, 11], [17, 21.5]], adet: 2 },
];
/** Köpek sahibinin 1,2 m gerisinden izler, en çok 3 m açılır. */
export const KOPEK = { geri: 1.2, max: 3.0, hiz: 3.2, adlar: ['Karabaş', 'Pamuk', 'Fındık', 'Zeytin', 'Boncuk', 'Kont'], renk: ['#c9a06a', '#f2efe8', '#5a4230', '#2b2723', '#d8b98a', '#8a7b6a'] };
/** Müzisyeni dinleyen: bu yarıçapta geçen vatandaş durup dinler. */
export const DINLE = { r: 4.5, sure: [4, 8] as [number, number], olasilik: 0.5 };
/** Hava (DNY-19): yağmurda/karda sığınağa koşanların oranı, karda yavaşlama, sıcakta gölge isteği. */
export const SOKAK_HAVA = { siginak: 0.65, kar: 0.72, golge: 0.35, kos: 1.35 };
/** Yağmurda şemsiye açan (sığınağa gitmeyen, yürüyen) vatandaşların oranı (görünüm: view/disari/sokak-look.ts). */
export const SEMSIYE_ORAN = 0.6;
