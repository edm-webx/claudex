/**
 * Salon (2026-11-08 büyüme; BUF-19/20 2026-11-20: pasif gelir KALKTI). From stage 3 the business runs extra seating on the pier
 * wings and halls (content/kanat.ts): those tables are SIM tables now (restoran.ts adisyon akışı): real guests walk in and sit,
 * real hired waiters serve, the bill is paid at the table. Income comes only from those guests (restoran.ts odemeYap, kanat
 * fiyat çarpanı x salon aleti adisyon çarpanı) and lands in the today report as `salonGelir` / `salonMis` (inside the gross).
 * This module keeps: the stage menu toast, the per-stage reference table (SALON: target guests, average ticket, staff, new
 * dishes; tests and the panel read it) and the bought hall tools (SALON_ESYA) as REAL multipliers: misK -> more table guests
 * come and the wing tables turn over faster, adisK -> a higher bill on that side's tables (salonKatYan).
 * State: S.zones.salon = { st, esya } (old lastH / toplam / misafir fields are left alone).
 */
import type { Kernel } from './state';
import { SALON_ESYA_BY_ID } from '../../content/esya';
import { yeniYemekler } from '../../content/yemek-menu';

/** menüye o aşamada giren gerçek yemekler (content/yemek-menu.ts): toast ve SALON.yeni ile menü panosu hep aynı liste */
const yeniAd = (stage: number): string[] => yeniYemekler(stage).map(d => d.ad);

/** bought hall equipment multipliers (2026-11-09); a hall's items count only once that hall stands (W stage 6, E stage 7) */
export function salonKat(esya: string[] | undefined, stage: number): { mis: number; adis: number } {
  let mis = 1, adis = 1;
  for (const e of esya || []) { const d = SALON_ESYA_BY_ID[e]; if (!d || stage < (d.salon === 'W' ? 6 : 7)) continue; mis += d.misK || 0; adis += d.adisK || 0; }
  return { mis, adis };
}

/** one side's tools (W: çay bahçesi + kahvaltı salonu + batı çatısı, E: dondurma terası + balık lokantası + doğu çatısı) */
export function salonKatYan(esya: string[] | undefined, stage: number, yan: 'W' | 'E'): { mis: number; adis: number } {
  let mis = 1, adis = 1;
  for (const e of esya || []) { const d = SALON_ESYA_BY_ID[e]; if (!d || d.salon !== yan || stage < (d.salon === 'W' ? 6 : 7)) continue; mis += d.misK || 0; adis += d.adisK || 0; }
  return { mis, adis };
}

/** reference per stage (index = stage): target guests per game hour and average ticket of the old passive formula (the kanat
 *  price multiplier, content/kanat.ts KANAT_FIYAT_X, is calibrated against mis x adisyon ₺), staff, new dishes */
export const SALON: { mis: number; adisyon: number; ekip: number; yeni: string[] }[] = [
  { mis: 0, adisyon: 0, ekip: 0, yeni: yeniAd(0) }, { mis: 0, adisyon: 0, ekip: 0, yeni: yeniAd(1) }, { mis: 0, adisyon: 0, ekip: 0, yeni: yeniAd(2) },
  { mis: 10, adisyon: 45, ekip: 1, yeni: yeniAd(3) },
  { mis: 18, adisyon: 60, ekip: 2, yeni: yeniAd(4) },
  { mis: 30, adisyon: 80, ekip: 3, yeni: yeniAd(5) },
  { mis: 46, adisyon: 160, ekip: 5, yeni: yeniAd(6) },
  { mis: 64, adisyon: 300, ekip: 7, yeni: yeniAd(7) },
  { mis: 84, adisyon: 480, ekip: 9, yeni: yeniAd(8) },
  { mis: 104, adisyon: 750, ekip: 12, yeni: yeniAd(9) },
  { mis: 130, adisyon: 1200, ekip: 16, yeni: yeniAd(10) },
];
export const salonOf = (stage: number) => SALON[Math.max(0, Math.min(10, Math.round(stage) || 0))];

export function installSalon(K: Kernel) {
  const S = K.state;
  const z = () => (S.zones.salon ||= {}) as unknown as { st?: number; esya?: string[] };
  K.addSystem({ id: 'salon', order: 52, phase: 'sim', step() {
    if (!K.rt.started) return;
    const s = z(), st = S.stage || 1;
    if (s.st !== undefined && st > s.st && salonOf(st).yeni.length) K.toast('🍽 Menüye girdi: ' + salonOf(st).yeni.join(', ') + ' · ekip ' + salonOf(st).ekip + ' kişi', 'good');
    s.st = st;
  } });
  return { view: () => { const st = S.stage || 1, k = salonKat(z().esya, st), d = salonOf(st); const T = S.today as unknown as { salonGelir?: number; salonMis?: number } | null; return { ...d, misSaat: Math.round(d.mis * k.mis), adisyonK: Math.round(d.adisyon * k.adis), bugunGelir: Math.round(T?.salonGelir || 0), bugunMis: Math.round(T?.salonMis || 0) }; } };
}
