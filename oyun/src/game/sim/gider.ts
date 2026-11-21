/**
 * Faz 2 gün sonu giderleri (ekonomi2.ts GIDER): kira by kiosk stage + faturalar (elektrik, su, tüp) as a share of
 * the day's sales. The money sink that keeps a lira worth something. Pure sim, listens to 'dayEnd' (fired while
 * S.today is still the finished day). Never takes money below zero (survey: no losing, only a slower day).
 * The finished day's numbers go into rt.uiLast.giderSon for the gün sonu card, and one short toast.
 */
import { GIDER, fmtTL } from '../../content/ekonomi2';
import type { Rules } from './state';

export interface GiderModel { kira: number; fatura: number; birimMaliyet: number; satis: number; paid: number; due: number; ertelendi: number }

export function installGider(r: Rules): { last(): GiderModel | null } {
  let last: GiderModel | null = null;
  r.bus.on('dayEnd', () => {
    const S = r.state, t = (S.today || {}) as unknown as { sales?: number; cost?: number };
    const satis = Math.round(t.sales || 0);
    if (satis < GIDER.minSales) return;
    const kira = GIDER.kira[Math.max(0, Math.min(GIDER.kira.length - 1, (S.stage || 1) - 1))] || 0;
    const fatura = Math.round(satis * GIDER.fatura);
    const due = kira + fatura, paid = Math.min(Math.max(0, S.money), due);
    S.money -= paid;
    last = { kira, fatura, birimMaliyet: Math.round(t.cost || 0), satis, paid, due, ertelendi: due - paid };
    (r.rt.uiLast as Record<string, unknown>).giderSon = { ...last, day: S.day };
    if (paid >= due && paid > 0) r.toast('Gün sonu: kira ' + fmtTL(kira) + ', fatura ' + fmtTL(fatura) + ' ödendi.', 'info');
    else if (paid > 0) r.toast('Gün sonu: kasa yetmedi, ' + fmtTL(paid) + ' ödendi, ' + fmtTL(due - paid) + ' ertelendi (kira ' + fmtTL(kira) + ', fatura ' + fmtTL(fatura) + ').', 'info');
    else if (due > 0) r.toast('Gün sonu: kasa boş, kira ve fatura ertelendi (' + fmtTL(due) + ').', 'info');
  });
  return { last: () => last };
}
