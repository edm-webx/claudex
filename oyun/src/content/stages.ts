/** Kiosk stages, worn parts and their renewal order (v2 data.js). Owner: Builder A. Pure data. */
import { STAGE_COST, STAGE_TIME_S, STAGE_MULT } from './ekonomi2';
export interface StageDef2 { id: number; name: string; short: string; mult: number; cost: number | null; timeS: number; req?: { stars: number } | null; soon?: boolean; stage: number; [k: string]: unknown; }
const RAW = [
  { id: 1, name: 'Dayı\'nın paslı döner arabası', short: 'Seyyar araba', mult: 1, cost: 0, timeS: 0, req: null },
  { id: 2, name: 'Kepenkli iskele büfesi', short: 'Büfe', mult: 2, cost: 40000, timeS: 90, req: { stars: 2 } },
  { id: 3, name: 'İskele çay bahçesi, tavla masaları', short: 'Çay bahçesi', mult: 3, cost: 500000, timeS: 240, req: { stars: 3 } },
  // 4 and 5 were placeholders in v2; the owner asked for them to be playable (survey: Lokanta, Zincir şube).
  // Costs and crew times are first guesses, tune them with the economy numbers.
  { id: 4, name: 'Camlı iskele lokantası', short: 'Lokanta', mult: 5, cost: 3000000, timeS: 600, req: { stars: 4 } },
  { id: 5, name: 'Martıköy Genel Merkez', short: 'Zincir şube', mult: 8, cost: 20000000, timeS: 1200, req: { stars: 5 } }
];
// Faz 2: costs, crew time and the (flat) multiplier come from ekonomi2.ts
export const KIOSK_STAGES: StageDef2[] = RAW.map(s => ({ ...s, stage: s.id, cost: s.id === 1 ? 0 : STAGE_COST[s.id - 1], timeS: STAGE_TIME_S[s.id - 1], mult: STAGE_MULT[s.id - 1] })) as StageDef2[];
export const RENEW_PARTS = [
  { id: 'kepenk', name: 'Kepenk' }, { id: 'tabela', name: 'Tabela' }, { id: 'fayans', name: 'Fayans' },
  { id: 'floresan', name: 'Floresan' }, { id: 'tezgah', name: 'Tezgah' }, { id: 'boya', name: 'Boya' }];
export const RENEW_ORDER: Record<number, string[]> = {
  1: ['tabela', 'tezgah', 'boya', 'floresan', 'fayans', 'kepenk'],
  2: ['kepenk', 'tabela', 'fayans', 'tezgah', 'floresan', 'boya'],
  3: ['boya', 'floresan', 'tabela', 'tezgah', 'fayans', 'kepenk']
};
