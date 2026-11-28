/**
 * Oda paketlerinin doğrulaması (QA 2026-11-27 teknik rapor 06: herkes `kasa` ile sınırsız para basabiliyor, sahte `dunya`
 * misafirin dünyasını ele geçiriyordu). Odada sunucu yok, her istemci kendini korur:
 *  - Ev sahibi `kasa`yı yalnız odada görünen, ev sahibi olmayan bir oyuncudan alır; tutar gerçek sayı olmalı, oyuncu başına
 *    dakikalık bütçe (kova) vardır. Bütçe ev sahibinin kendi dakikalık gelirinin katıdır (misafir aynı büfede, aynı fiyatla satar).
 *  - Misafir `dunya`yı yalnız kendini ev sahibi diye duyuran (presence ev:true) oyuncudan alır ve ilk kabul ettiği ev sahibine
 *    sabitlenir; başka biri sonradan dünya yollarsa reddedilir. Boyut sınırı vardır.
 * Sınır: kimlik istemcinin beyanıdır (Realtime'da gönderen doğrulaması yok). Kesin çözüm sunucu tarafı (Realtime yetkisi / Edge
 * function); bu katman zararı küçük ve sınırlı tutar. Saf fonksiyonlar: tests/unit/oda-dogrula.test.ts.
 */

/** misafir başına dakikalık kasa bütçesinin tabanı (ev sahibinin geliri düşükken bile dürüst misafir rahat sığar) */
export const KASA_TABAN_DK = 15000;
/** bütçe = max(taban, ev sahibinin dakikalık gelirinin bu katı) */
export const KASA_GELIR_KAT = 3;
/** tek pakette en çok (misafir 2 sn'de bir yollar) */
export const KASA_PAKET_TAVAN = 1e6;
/** dünya JSON'u en çok (Supabase broadcast sınırı 256 KB) */
export const DUNYA_MAX = 256 * 1024;

export interface KasaKova { dolu: number; t: number }
/** gönderen id -> kova */
export type KasaDefter = Map<string, KasaKova>;

/** `kasa` paketinden kabul edilen tutar (0 = red). `gonderenMisafir`: odada görünen, ev sahibi olmayan oyuncu mu */
export function kasaKabul(defter: KasaDefter, from: unknown, n: unknown, gonderenMisafir: boolean, nowS: number, gelirDk: number): number {
  if (typeof from !== 'string' || !from || !gonderenMisafir) return 0;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 1 || n > KASA_PAKET_TAVAN) return 0;
  const butce = Math.max(KASA_TABAN_DK, KASA_GELIR_KAT * (Number.isFinite(gelirDk) ? Math.max(0, gelirDk) : 0));
  let k = defter.get(from);
  if (!k) { k = { dolu: butce, t: nowS }; defter.set(from, k); }
  k.dolu = Math.min(butce, k.dolu + Math.max(0, nowS - k.t) * butce / 60); k.t = nowS;
  const v = Math.floor(Math.min(n, k.dolu));
  if (v < 1) return 0;
  k.dolu -= v;
  return v;
}

/** misafirin `dunya` kabulü. Dönen: kabul edilen ev sahibi id'si (sabitlenecek) ya da null (red) */
export function dunyaKabul(pl: Record<string, unknown>, sabit: string, evSahibiMi: (id: string) => boolean): string | null {
  const from = pl.id;
  if (typeof from !== 'string' || !from) return null;
  if (typeof pl.w !== 'string' || typeof pl.sig !== 'string' || pl.w.length > DUNYA_MAX || pl.sig.length > 4096) return null;
  if (sabit && from !== sabit) return null;   // ilk ev sahibinden başkası dünya dayatamaz
  if (!evSahibiMi(from)) return null;         // presence'ta ev sahibi olarak görünmeyen yollayamaz
  return from;
}
