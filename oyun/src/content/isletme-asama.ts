/**
 * DKN-02: stages of the far-shore businesses. Same logic as the büfe: an upgrade is a timed renovation (tadilat), the
 * business keeps running with the old stage's capacity, and the new stage opens tables, queue room, crew size and
 * (view only) a bigger facade. Stage names come from ISLETME[t].asama. Cost = round(arsa price x 0.45 x lv) (mulk.ts).
 */
import { ISLETME, ARSA_ISLETME, type IsletmeId } from './esya';

export interface AsamaDef { lv: number; ad: string; kuyruk: number; masa: number; iscMax: number }
/** seconds of renovation for lv -> lv+1 */
export const TADILAT_SURE_S = [90, 180, 300, 480];
const KUYRUK: Record<IsletmeId, number[]> = { kafe: [3, 4, 4, 5, 5], bistro: [3, 4, 4, 5, 5], kantin: [3, 4, 4, 5, 5], lokanta: [3, 4, 4, 5, 5], kafeterya: [3, 4, 4, 5, 5], kirtasiye: [2, 2, 3, 3, 3],
  /* AVM shops: few customers, a short line at the till */ giyim: [2, 2, 3, 3, 3], elektronik: [2, 2, 3, 3, 3], oyuncak: [2, 3, 3, 3, 3],
  /* 2026-11-21 AVM katları */ sekerci: [2, 3, 3, 4, 4], kuruyemis: [2, 3, 3, 4, 4], kahveci: [3, 4, 4, 5, 5], dondurma: [3, 4, 4, 5, 5], baklava: [3, 3, 4, 4, 5], donerci: [3, 4, 4, 5, 5], kumpir: [3, 4, 4, 5, 5], midye: [3, 4, 4, 5, 5], sinema: [3, 4, 5, 5, 6] };
const MASA = [2, 3, 4, 5, 5];
const ISC_MAX = [2, 3, 3, 3, 3];
export const ASAMA: Record<IsletmeId, AsamaDef[]> = Object.fromEntries((Object.keys(ISLETME) as IsletmeId[]).map(t => [t, [1, 2, 3, 4, 5].map(lv => ({ lv, ad: ISLETME[t].asama[lv - 1] || '', kuyruk: KUYRUK[t][lv - 1], masa: MASA[lv - 1], iscMax: ISC_MAX[lv - 1] }))])) as Record<IsletmeId, AsamaDef[]>;
export const asamaDef = (arsaId: string, lv: number): AsamaDef => { const l = ASAMA[ARSA_ISLETME[arsaId] || 'kafe']; return l[Math.max(0, Math.min(l.length - 1, lv - 1))]; };
