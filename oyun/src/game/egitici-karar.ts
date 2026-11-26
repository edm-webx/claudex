/**
 * Eğitici kartı seçimi (saf, test edilir). Kartlar content/egitici.ts'de; görünüm ui/egitici.ts.
 * Kayıt GameState.tut içinde: egt_<id> = gösterildiği oyun saniyesi, egt__son = son kartın zamanı, egt__kapali = kapalı, egt__v = sürüm.
 */
import { EGITICI, EGT_ZAMAN as Z, EGT_KEY, EGT_KAPALI, EGT_SURUM, type EgtCtx, type EgtKart } from '../content/egitici';

type Tut = Record<string, number>;
const tutar = (k: EgtKart, c: EgtCtx) => { try { return !!k.kosul(c); } catch { return false; } };

/** Temel oklar (yürü, döner, tezgâh) bitmeden ya da süre dolmadan kart yok. */
export const egtBasladi = (tut: Tut, playT: number) => !!(tut.firstDrop || tut.tut_counter) || playT > Z.BASLA_S;

/** Eski kayıt ilk kez yüklenince: oyuncunun zaten bildiği (koşulu şu an tutan) kartlar görülmüş sayılır, yığılmasın. */
export function egtEskiKayit(c: EgtCtx, tut: Tut, playT: number): void {
  if (tut[EGT_SURUM]) return;
  tut[EGT_SURUM] = 1;
  if (playT <= Z.ESKI_KAYIT_S) return;
  for (const k of EGITICI) if (!tut[EGT_KEY(k.id)] && tutar(k, c)) tut[EGT_KEY(k.id)] = Math.round(playT);
}

/** Şimdi gösterilecek kart (yoksa null). Listedeki sıra önceliktir; 'yan' kartlar daha uzun ara ister. */
export function egtSec(c: EgtCtx, tut: Tut, playT: number): EgtKart | null {
  if (tut[EGT_KAPALI] || !egtBasladi(tut, playT)) return null;
  const gecen = playT - (Number(tut.egt__son) || -1e9);
  if (gecen < Z.ARA_S) return null;
  for (const k of EGITICI) {
    if (tut[EGT_KEY(k.id)]) continue;
    if (k.onem === 'yan' && gecen < Z.YAN_ARA_S) continue;
    if (tutar(k, c)) return k;
  }
  return null;
}

/** Kart kapanınca: görüldü olarak yaz. */
export function egtGoruldu(tut: Tut, id: string, playT: number): void {
  tut[EGT_KEY(id)] = Math.round(playT) || 1;
  tut.egt__son = playT;
}

/** Ayarlar: "Baştan göster". Kapalı bayrağı ve sürüm kalır, görülenler silinir. */
export function egtSifirla(tut: Tut): void {
  for (const k of Object.keys(tut)) if (k.startsWith('egt_') && !k.startsWith('egt__')) delete tut[k];
  delete tut.egt__son;
  tut[EGT_SURUM] = 1;
}

export const egtGorulenler = (tut: Tut): EgtKart[] => EGITICI.filter(k => !!tut[EGT_KEY(k.id)]);
