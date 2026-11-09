/**
 * Salon geliri (2026-11-08, owner: "büfe iskelenin tamamını kaplayacak şekilde büyümeli, çeşit artmalı, çalışanlar artmalı").
 * From stage 3 the business runs extra seating on the pier wings (view/world/bufe-buyume.ts): çay bahçesi, terrace, halls.
 * Staff there serve on their own; every game hour the wings pay guests × average ticket into the pocket (own business
 * income, not the capped side faucet). Each stage widens the menu (SALON_MENU) and the staff count shown in the view.
 * State: S.zones.salon = { lastH, toplam, misafir }.
 */
import type { Kernel } from './state';
import { fmtMoney } from './util';
import { SALON_ESYA_BY_ID } from '../../content/esya';

/** bought hall equipment multipliers (2026-11-09); a hall's items count only once that hall stands (W stage 6, E stage 7) */
export function salonKat(esya: string[] | undefined, stage: number): { mis: number; adis: number } {
  let mis = 1, adis = 1;
  for (const e of esya || []) { const d = SALON_ESYA_BY_ID[e]; if (!d || stage < (d.salon === 'W' ? 6 : 7)) continue; mis += d.misK || 0; adis += d.adisK || 0; }
  return { mis, adis };
}

/** guests per game hour, average ticket (₺), staff, new dishes, per stage (index = stage) */
export const SALON: { mis: number; adisyon: number; ekip: number; yeni: string[] }[] = [
  { mis: 0, adisyon: 0, ekip: 0, yeni: [] }, { mis: 0, adisyon: 0, ekip: 0, yeni: [] }, { mis: 0, adisyon: 0, ekip: 0, yeni: [] },
  { mis: 10, adisyon: 45, ekip: 1, yeni: ['Demlik çay', 'Gözleme'] },
  { mis: 18, adisyon: 60, ekip: 2, yeni: ['Maraş dondurma', 'Gazoz çeşitleri'] },
  { mis: 30, adisyon: 80, ekip: 3, yeni: ['Kumpir', 'Limonata'] },
  { mis: 46, adisyon: 160, ekip: 5, yeni: ['Serpme kahvaltı', 'Menemen', 'Sucuklu yumurta'] },
  { mis: 64, adisyon: 300, ekip: 7, yeni: ['Hamsi tava', 'Levrek', 'Midye dolma'] },
  { mis: 84, adisyon: 480, ekip: 9, yeni: ['Meze tabağı', 'Boğaz manzaralı akşam yemeği'] },
  { mis: 104, adisyon: 750, ekip: 12, yeni: ['Izgara köfte', 'Şefin Adana\'sı', 'Kuzu tandır'] },
  { mis: 130, adisyon: 1200, ekip: 16, yeni: ['Tadım menüsü', 'Lüfer buğulama', 'Fıstıklı katmer'] },
];
export const salonOf = (stage: number) => SALON[Math.max(0, Math.min(10, Math.round(stage) || 0))];

export function installSalon(K: Kernel) {
  const S = K.state;
  const z = () => { const s = (S.zones.salon ||= {}) as unknown as { lastH: number; toplam: number; misafir: number; st?: number; esya?: string[] }; if (!Number.isFinite(s.lastH)) s.lastH = K.hour(); s.toplam ||= 0; s.misafir ||= 0; return s; };
  let acc = 0, toastH = 0;
  K.addSystem({ id: 'salon', order: 52, phase: 'sim', step(ctx) {
    if (!K.rt.started) return;
    const s = z(), st = S.stage || 1;
    if (s.st !== undefined && st > s.st && salonOf(st).yeni.length) K.toast('🍽 Menüye girdi: ' + salonOf(st).yeni.join(', ') + ' · ekip ' + salonOf(st).ekip + ' kişi', 'good');
    s.st = st;
    acc += ctx.dt; if (acc < 1) return; acc = 0;
    const h = K.hour(), dh = Math.max(0, Math.min(1, h >= s.lastH ? h - s.lastH : (24 - s.lastH) + (h - 8))); s.lastH = h;
    const d = salonOf(st); if (!d.mis || dh <= 0 || K.rt.paused) return;
    const k = salonKat(s.esya, st), mis = d.mis * k.mis * dh, v = Math.round(mis * d.adisyon * k.adis);
    if (v <= 0) return;
    if (K.earnTam) K.earnTam(v); else K.earn(v);
    s.toplam += v; s.misafir += mis; toastH += dh;
    if (toastH >= 4) { toastH = 0; K.toast('🍽 Salon: ' + Math.round(d.mis * k.mis * 4) + ' misafir, +' + fmtMoney(Math.round(d.mis * k.mis * 4 * d.adisyon * k.adis)), 'good'); }
  } });
  return { view: () => { const st = S.stage || 1, k = salonKat(z().esya, st), d = salonOf(st); return { ...d, misSaat: Math.round(d.mis * k.mis), adisyonK: Math.round(d.adisyon * k.adis), toplam: Math.round(z().toplam) }; } };
}
