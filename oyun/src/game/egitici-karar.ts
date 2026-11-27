/**
 * Eğitici kartı seçimi (saf, test edilir). Kartlar content/egitici.ts'de; görünüm ui/egitici.ts.
 * Kayıt GameState.tut içinde: egt_<id> = gösterildiği oyun saniyesi, egt__son = son kartın zamanı, egt__kapali = kapalı, egt__v = sürüm.
 */
import { EGITICI, EGT_ZAMAN as Z, EGT_KEY, EGT_KAPALI, EGT_SURUM, egtAra, type EgtCtx, type EgtKart } from '../content/egitici';

type Tut = Record<string, number>;
const tutar = (k: EgtKart, c: EgtCtx) => { try { return !!k.kosul(c); } catch { return false; } };

/** Temel oklar (yürü, döner, tezgâh) bitmeden ya da süre dolmadan kart yok. */
export const egtBasladi = (tut: Tut, playT: number) => !!(tut.firstDrop || tut.tut_counter) || playT > Z.BASLA_S;

/** Kart görüldü mü? Yerine geçtiği eski kimliklerden biri görüldüyse de evet (eski kayıt aynı şeyi ikinci kez görmesin). */
export const egtGorulduMu = (tut: Tut, k: EgtKart) => !!tut[EGT_KEY(k.id)] || !!k.eski?.some(e => !!tut[EGT_KEY(e)]);
const BEK = (id: string) => 'egb_' + id;

/**
 * Eski kayıt ilk kez yüklenince: oyuncunun zaten bildiği kartlar görülmüş sayılır, yığılmasın.
 * Koşulu şu an tutanlar + (eskiden tetik koşulu olmayan) kalıcı olarak ilerleme göstergeleri: kasa/taşıma/olay kartları o an doğru değilse de
 * oyuncu büyük ihtimalle bunları bilir, o yüzden 1300 sn'lik kayıt kasa gibi giriş kartlarını yeniden görmesin.
 */
export function egtEskiKayit(c: EgtCtx, tut: Tut, playT: number): void {
  if (tut[EGT_SURUM]) return;
  tut[EGT_SURUM] = 1;
  if (playT <= Z.ESKI_KAYIT_S) return;
  const isaret = (id: string) => { if (!tut[EGT_KEY(id)]) tut[EGT_KEY(id)] = Math.round(playT); };
  for (const k of EGITICI) if (!egtGorulduMu(tut, k) && tutar(k, c)) isaret(k.id);
  // oyuncunun çoktan yaptığı şeyler: kartı gereksiz
  const T = c.S.tut || {};
  if (T.firstCollect) isaret('kasa');
  if (c.S.owned?.cay) isaret('cay');
  if (c.S.owned?.tabure1) isaret('masa');
  if (c.S.owned?.isbul) isaret('pano');
  if (c.S.owned?.tepsi1 || c.S.owned?.tepsi2) isaret('tasima');
  if ((c.S.stage || 1) > 1 || c.S.tadilat) { isaret('tadilat_kare'); isaret('tadilat_basladi'); }
  if ((c.S.day || 1) >= 2) isaret('karne');
  if ((c.S.workers || []).length > 0) { isaret('ilk_isci'); isaret('sabirsiz'); isaret('kirli_masa'); isaret('uyuyan'); }
  if ((c.S.day || 1) >= 3) { isaret('kedi'); isaret('marti'); isaret('yagmur'); isaret('gece'); }
}

/**
 * Şimdi gösterilecek kart (yoksa null). Önce geçici olay kartları (koşul bir an doğru olduysa BEK_S sn beklemede kalır, kalıcı HUD kartları sırayı
 * kapamasın), sonra listedeki sıra önceliktir; 'yan' kartlar daha uzun ara ister.
 * uygun: görünümün hedef/halka denetimi (HUD öğesi ya da dünya hedefi yoksa kart seçilmez ama görüldü de sayılmaz).
 */
export function egtSec(c: EgtCtx, tut: Tut, playT: number, uygun?: (k: EgtKart) => boolean): EgtKart | null {
  if (tut[EGT_KAPALI] || !egtBasladi(tut, playT)) return null;
  const gecen = playT - (Number(tut.egt__son) || -1e9);
  const adaylar = [...EGITICI.filter(k => k.gecici), ...EGITICI.filter(k => !k.gecici)];
  let sec: EgtKart | null = null;
  for (const k of adaylar) {
    if (egtGorulduMu(tut, k)) continue;
    if (k.dis && c.ic) continue;
    let dogru = tutar(k, c);
    if (k.gecici) {
      if (dogru) { if (!tut[BEK(k.id)]) tut[BEK(k.id)] = Math.max(1, Math.round(playT)); }
      else if (tut[BEK(k.id)] && playT - tut[BEK(k.id)] < Z.BEK_S) dogru = true;   // olay az önce vardı: beklemede
      else delete tut[BEK(k.id)];
    }
    if (!dogru || sec) continue;
    if (gecen < egtAra(playT)) continue;
    if (k.onem === 'yan' && gecen < Z.YAN_ARA_S) continue;
    if (uygun && !uygun(k)) continue;
    sec = k;
  }
  return sec;
}

/** Kart kapanınca: görüldü olarak yaz. */
export function egtGoruldu(tut: Tut, id: string, playT: number): void {
  tut[EGT_KEY(id)] = Math.round(playT) || 1;
  tut.egt__son = playT;
}

/** Ayarlar: "Baştan göster". Kapalı bayrağı ve sürüm kalır, görülenler silinir. */
export function egtSifirla(tut: Tut): void {
  for (const k of Object.keys(tut)) if ((k.startsWith('egt_') && !k.startsWith('egt__')) || k.startsWith('egb_')) delete tut[k];
  delete tut.egt__son;
  tut[EGT_SURUM] = 1;
}

export const egtGorulenler = (tut: Tut): EgtKart[] => EGITICI.filter(k => egtGorulduMu(tut, k));
