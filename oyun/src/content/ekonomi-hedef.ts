/**
 * Ekonomi hedefleri (EKO-01): ölçüm tezgahının okuduğu TEK sayı yeri. Pure data, oyun koduna bağlı değil.
 * tests/sim/ekonomi-egri.test.ts ve ekonomi-istismar.test.ts bu dosyadan okur; sayıyı değiştirmek için testi değil
 * burayı düzenle. Üç ayrı küme var:
 *  - HEDEF_*: tasarım hedefi (EKO-05 taslağı ve sahibin holding vizyonu). Henüz tutmuyor, EKO_HEDEF=1 ile sıkı koşulur.
 *  - MEVCUT_*: bugünkü dengenin etrafındaki gerileme bandı. Varsayılan testler bunu denetler; EKO-05 dengeyi
 *    değiştirince bu bant HEDEF'e yaklaştırılır.
 *  - SAAT_TAVAN: her para kaynağı için "saatte en fazla X ₺" (istismar regresyonu).
 * Her hedefte `taslak: true` sahibin onaylamadığı sayıdır: ölçüm bunu cezalandırmaz, yalnız raporlar.
 */

/** Sahibin söylediği holding sırası: büfeden başla, şartları (para + seviye + önceki işletme) karşılayınca bir sonraki. */
export const HOLDING_SIRA = ['yemek', 'giyim', 'saglik', 'turizm', 'emlak'] as const;
export type HoldingSektor = typeof HOLDING_SIRA[number];
/** Oyunda bugün işletilebilen sektörler (mulk.ts ARSALAR: kafe, bistro, kırtasiye, kantin, lokanta, kafeterya). Diğerleri kodlanmadı. */
export const HOLDING_KODLU: readonly HoldingSektor[] = ['yemek'];

/** Aşamaya ilk varış: oyun dakikası (EKO-05 taslağı: 0,5 / 1,5 / 3 / 5 / 6 / 7 / 8 / 9 / 10 saatlik aşama süreleri, birikimli). */
export const HEDEF_ASAMA_DK: Record<number, number> = { 2: 30, 3: 120, 4: 300, 5: 600, 6: 960, 7: 1380, 8: 1860, 9: 2400, 10: 3000 };
/** Hedefin her iki yanı: 0,35 = +-%35. */
export const HEDEF_ASAMA_TOLERANS = 0.35;
/** İlk işletmeye (kafe/bistro vb.) varış penceresi, oyun dakikası. Taslak: büfe 2. aşamaya yerleştikten sonra, 1,5-3 saat. */
export const HEDEF_ILK_ISLETME_DK: [number, number] = [90, 180];
/** "Bir sonraki hedefe kalan süre" bu kadar dakikadan uzun olamaz (EKO-05 ölü bölge kuralı). */
export const OLU_BOLGE_DK = 90;
/** Etkin / yarı etkin oyuncunun toplam gelir oranı (EKO-01): çok düşükse oyun beceriyi ödüllendirmiyor, çok yüksekse etkisiz oyuncu kaybolur. */
export const ETKIN_ORAN: [number, number] = [1.5, 3];
/** Gelir kaynağı payları (toplam gelirin içinde, 0..1). Tek kaynak üst sınırı her aşamada geçerli. */
export const KAYNAK_PAY = { tekKaynakMax: 0.6, asama6: { tezgahMin: 0.3, salonMax: 0.5, isletmeMin: 0.1 } };
/** Gider (kira + fatura) / günlük brüt satış bandı (EKO-06 taslağı; maaş ve vergi eklenince yeniden bakılır). */
export const HEDEF_GIDER_ORAN: { asama: number; band: [number, number] }[] = [
  { asama: 3, band: [0.10, 0.14] }, { asama: 6, band: [0.14, 0.20] }, { asama: 10, band: [0.18, 0.24] },
];

/**
 * Bugünkü denge (ölçüm 2026-11-21, tohum 3 ve 7 ortalaması, 'normal' bot, 8 dakikalık gün): 30/60/90. dakikada toplam kazanç
 * 62k / 163k / 284k ₺. Mevcut-bant: ölçülen değerin altı %35, üstü %45. Bu bant EKO-05 dengeyi değiştirene dek gerilemeyi yakalar.
 * ZAMAN ÖLÇÜSÜ: oyun dakikası (S.playT). Anahtar: dakika, değer: [min, max] toplam kazanç (₺).
 */
export const MEVCUT_TOPLAM_KAZANC: Record<number, [number, number]> = {
  30: [40_000, 90_000], 60: [105_000, 235_000], 90: [185_000, 410_000],
};
/** Bugünkü denge: 2. aşamaya varış penceresi (dk). */
export const MEVCUT_ASAMA2_DK: [number, number] = [28, 62];

/**
 * Para kaynağı başına saatlik tavan (₺ / oyun saati = 3600 sn). EKO-03 sonrası tutması beklenen sayılar.
 * okul: günde 3 ödüllü sınav, ~1.200 ₺ (EKO-03 metni) x 7,5 gün/saat. mevduat: tavan 200k x %0,2 x 7,5 gün/saat.
 * bahis: kasa payı var (oran 0,9/p), saatte en çok 30 maç izlenir; ortalamada kayıp olmalı.
 * kredi: tek seferde alınan ham nakit, ilk saatte kazanılan toplam gelirden büyük olamaz (EKO-07 sahibi netleştirince).
 */
export const SAAT_TAVAN = {
  okul: 30_000,
  mevduat: 5_000,
  bahis: 40_000,
  kredi: 20_000,
} as const;
/** İstismar botu insan hızında oynar: bir cevap/işlem arası bu kadar saniye (daha hızlı tıklamak mümkün olsa da tavan hesabı insanlara göre). */
export const ISTISMAR_ADIM_S = 2;
