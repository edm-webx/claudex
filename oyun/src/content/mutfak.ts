import { RANKS, rankOf } from './ranks';
/**
 * Büfe mutfağı (2026-11-09 survey: "büfe zamanla yavaşça otel restoran mutfağına dönüşsün, kapalı mutfak, sadece pass
 * penceresi, 15+ istasyon, esnaf tarzından çeliğe"). A room behind the kiosk's covered walkway (content/ic-mekan.ts
 * 'mutfak'); stations unlock with the büfe stage, kitchen staff are hired through the normal staff board.
 */
export interface IstasyonDef { id: string; ad: string; stage: number }
export const MUTFAK_ISTASYON: IstasyonDef[] = [
  { id: 'pass', ad: 'Pass (servis tezgahı)', stage: 3 }, { id: 'ocak', ad: 'Ocak (tencere yemekleri)', stage: 3 }, { id: 'cay_bar', ad: 'Çay ve kahve barı', stage: 3 },
  { id: 'izgara', ad: 'Izgara', stage: 4 }, { id: 'fritoz', ad: 'Fritöz', stage: 4 },
  { id: 'bulasik', ad: 'Bulaşık', stage: 5 }, { id: 'soguk_oda', ad: 'Soğuk oda, depo', stage: 5 },
  { id: 'doner', ad: 'Döner', stage: 6 }, { id: 'salata', ad: 'Salata', stage: 6 },
  { id: 'meze', ad: 'Soğuk meze', stage: 7 }, { id: 'tatli', ad: 'Tatlı, pasta', stage: 7 },
  { id: 'tas_firin', ad: 'Taş fırın, tandır', stage: 8 },
  { id: 'ocak2', ad: 'İkinci ocak hattı', stage: 9 }, { id: 'izgara2', ad: 'İkinci ızgara hattı', stage: 9 },
  { id: 'sef_masa', ad: 'Şef pasosu', stage: 10 },
];
export const MUTFAK_MIN_STAGE = 3;
/** stations standing at a büfe stage */
export const mutfakEsya = (stage: number): string[] => (stage < MUTFAK_MIN_STAGE ? [] : MUTFAK_ISTASYON.filter(i => i.stage <= stage).map(i => i.id));
/** "esnaf" look until stage 6, stainless steel from 7 */
export const mutfakCelik = (stage: number) => stage >= 7;

/** Kitchen staff roles (ROLES in content/ranks.ts carry `mutfak: true`): label, hire price base, slots by büfe stage */
export interface MutfakRol { id: string; label: string; base: number; stage: number; slots: number[]; etki: string }
const S = (...a: number[]) => a;   // slots for stages 1..10
export const MUTFAK_ROL: MutfakRol[] = [
  { id: 'asci', label: 'Aşçı', base: 2600, stage: 3, slots: S(0, 0, 1, 1, 2, 2, 3, 3, 4, 5), etki: 'Sipariş hazırlama hızı' },
  { id: 'komi', label: 'Komi', base: 1700, stage: 4, slots: S(0, 0, 0, 1, 1, 2, 2, 3, 3, 4), etki: 'Aşçılara yardım, küçük hız artışı' },
  { id: 'bulasikci', label: 'Bulaşıkçı', base: 1500, stage: 5, slots: S(0, 0, 0, 0, 1, 1, 1, 2, 2, 2), etki: 'Tabak yığılmaz, mutfak hızına küçük katkı' },
  { id: 'kasiyer', label: 'Kasiyer', base: 2300, stage: 3, slots: S(0, 0, 1, 1, 1, 2, 2, 2, 3, 3), etki: 'Bahşiş ve hesap hızı' },
  { id: 'sef', label: 'Şef', base: 7000, stage: 7, slots: S(0, 0, 0, 0, 0, 0, 1, 1, 1, 2), etki: 'Tüm mutfağı hızlandırır' },
];
export const MUTFAK_ROL_BY_ID: Record<string, MutfakRol> = Object.fromEntries(MUTFAK_ROL.map(r => [r.id, r]));
export const mutfakSlot = (rol: string, stage: number): number => { const r = MUTFAK_ROL_BY_ID[rol]; return r && stage >= r.stage ? r.slots[Math.max(0, Math.min(9, stage - 1))] : 0; };

/** What the hired kitchen staff do (rank multiplier x per level): faster stations, bigger tips */
export function mutfakEtki(workers: { role: string; xp?: number }[]): { hiz: number; bahsis: number } {
  let hiz = 0, bahsis = 0;
  for (const w of workers) {
    const k = RANKS[rankOf(w.xp || 0)].x;
    if (w.role === 'asci') hiz += 0.05 * k; else if (w.role === 'komi') hiz += 0.025 * k; else if (w.role === 'sef') hiz += 0.08 * k; else if (w.role === 'bulasikci') hiz += 0.02 * k;
    else if (w.role === 'kasiyer') bahsis += 0.06 * k;
  }
  return { hiz: Math.min(0.6, hiz), bahsis: Math.min(0.5, bahsis) };
}
