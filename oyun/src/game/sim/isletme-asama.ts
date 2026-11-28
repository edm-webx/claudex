/** DKN-02 pure renovation helpers over Plot.tadilat (no three, no DOM). */
import { TADILAT_SURE_S, asamaDef } from '../../content/isletme-asama';

export interface TadilatState { to: number; left: number; total: number }
export interface AsamaPlot { lv: number; tadilat?: TadilatState }
export const tadilatSure = (lv: number) => TADILAT_SURE_S[Math.max(0, Math.min(TADILAT_SURE_S.length - 1, lv - 1))];
export function tadilatBasla(p: AsamaPlot, sureS: number) { p.tadilat = { to: p.lv + 1, left: sureS, total: sureS }; }
/** advance by dt seconds; true when it just finished */
export function tadilatAdim(p: AsamaPlot, dt: number): boolean { if (!p.tadilat) return false; p.tadilat.left -= dt; return p.tadilat.left <= 0; }
export function tadilatBitir(p: AsamaPlot) { if (p.tadilat) { p.lv = p.tadilat.to; delete p.tadilat; } }
/** what the next stage opens, as short texts for the panel */
export function aciklar(arsaId: string, lv: number): string[] {
  const a = asamaDef(arsaId, lv), b = asamaDef(arsaId, lv + 1), o: string[] = [];
  if (b.masa > a.masa) o.push((b.masa - a.masa) + ' yeni masa'); if (b.kuyruk > a.kuyruk) o.push('kuyruk ' + b.kuyruk + ' kişi'); if (b.iscMax > a.iscMax) o.push('işçi tavanı ' + b.iscMax);
  return o;
}
