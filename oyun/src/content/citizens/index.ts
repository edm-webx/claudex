/**
 * The GDD's 24 citizen types, ported 1:1 from v2 data.js D.CITIZEN_TYPES (numbers kept; `typeId` in the agents SoA
 * is the index into this list). Added: `gait` per type (animasyon-2: teyze waddle, plaza brisk, dede slow).
 * Owner: Builder C. Patience 1..5 -> D.PATIENCE_S, tip 1..5 -> D.TIP_FRAC (economy, A owns those in M1).
 */
import type { CitizenTypeDef, CrowdBudgetRow } from '../types';
import type { TierName } from '../../engine/api';

export const CITIZENS: CitizenTypeDef[] = [
  { id: 'teyze', name: 'Teyze grubu', patience: 4, tip: 2, w: 1.4, hours: [[9, 19]], peak: [[10, 12]], prefer: { cay: 3, simit: 3, ayran: 1 }, group: [3, 4], items: [1, 1], sit: 0.9, voice: 290, gait: 'waddle' },
  { id: 'emekli', name: 'Emekli amca', patience: 5, tip: 1, w: 1.3, hours: [[8, 19]], peak: [[8, 11]], prefer: { cay: 6, simit: 1 }, group: [1, 2], items: [1, 3], sit: 0.85, voice: 120, gait: 'slow' },
  { id: 'universiteli', name: 'Üniversiteli', patience: 3, tip: 1, w: 1.3, hours: [[10, 24]], peak: [[12, 14], [18, 21]], prefer: { doner: 2, ayran: 2, tost: 2, gazoz: 1, simit: 1 }, group: [2, 4], items: [1, 1], sit: 0.6, voice: 175, gait: 'normal' },
  { id: 'okul', name: 'Okul çocukları', patience: 2, tip: 1, w: 0.8, hours: [[15, 17]], peak: [[15, 16]], prefer: { simit: 3, gazoz: 3 }, group: [2, 3], items: [1, 1], sit: 0.2, voice: 260, gait: 'kid' },
  { id: 'plaza', name: 'Plaza çalışanı', patience: 1, tip: 5, w: 1.2, hours: [[8, 20]], peak: [[11, 14]], prefer: { doner: 4, ayran: 3, cay: 1 }, group: [1, 2], items: [1, 2], sit: 0.3, voice: 150, gait: 'brisk' },
  { id: 'taraftar', name: 'Taraftar', patience: 3, tip: 3, w: 0.7, hours: [[16, 24]], peak: [[19, 22]], prefer: { doner: 2, gazoz: 3, tost: 1 }, group: [2, 4], items: [1, 1], sit: 0.4, voice: 140, gait: 'normal' },
  { id: 'taksici', name: 'Taksici', patience: 2, tip: 3, w: 0.8, hours: [[8, 10], [20, 24]], peak: [[22, 24]], prefer: { cay: 3, tost: 3 }, group: [1, 1], items: [1, 2], sit: 0.1, voice: 115, gait: 'brisk' },
  { id: 'gecekusu', name: 'Gece kuşu', patience: 3, tip: 2, w: 1.0, hours: [[20, 24]], peak: [[21, 24]], prefer: { tost: 3, gazoz: 3, doner: 1 }, group: [2, 3], items: [1, 1], sit: 0.6, voice: 180, gait: 'normal' },
  { id: 'simitci', name: 'Simitçi', patience: 4, tip: 1, w: 0.3, hours: [[8, 13]], peak: [], prefer: { cay: 5 }, group: [1, 1], items: [1, 1], sit: 0.1, voice: 130, scenery: true, gait: 'normal' },
  { id: 'hamal', name: 'Hamal', patience: 3, tip: 4, w: 0.4, hours: [[8, 18]], peak: [], prefer: { cay: 2, doner: 3 }, group: [1, 1], items: [3, 5], sit: 0.3, voice: 105, gait: 'shuffle' },
  { id: 'oltaci', name: 'Oltacı amca', patience: 5, tip: 3, w: 0.5, hours: [[8, 20]], peak: [[8, 10]], prefer: { cay: 5 }, group: [1, 1], items: [1, 2], sit: 0.1, voice: 110, scenery: true, gait: 'slow' },
  { id: 'kurye', name: 'PaketMartı kuryesi', patience: 1, tip: 4, w: 0.6, hours: [[11, 24]], peak: [[12, 14], [19, 22]], prefer: { doner: 3, tost: 2 }, group: [1, 1], items: [2, 3], sit: 0, voice: 165, gait: 'brisk' },
  { id: 'muzisyen', name: 'Sokak müzisyeni', patience: 5, tip: 1, w: 0.15, hours: [[11, 23]], peak: [], prefer: { cay: 1 }, group: [1, 1], items: [1, 1], sit: 0, voice: 160, scenery: true, performer: true, gait: 'normal' },
  { id: 'boyaci', name: 'Ayakkabı boyacısı', patience: 4, tip: 2, w: 0.2, hours: [[9, 18]], peak: [], prefer: { cay: 4 }, group: [1, 1], items: [1, 1], sit: 0, voice: 125, scenery: true, gait: 'normal' },
  { id: 'midyeci', name: 'Midyeci', patience: 4, tip: 2, w: 0.2, hours: [[17, 24]], peak: [], prefer: { ayran: 4 }, group: [1, 1], items: [1, 1], sit: 0, voice: 135, scenery: true, months: [5, 6, 7, 8, 9], gait: 'normal' },
  { id: 'kestaneci', name: 'Kestaneci', patience: 4, tip: 2, w: 0.2, hours: [[10, 22]], peak: [], prefer: { cay: 4 }, group: [1, 1], items: [1, 1], sit: 0, voice: 125, scenery: true, months: [11, 12, 1, 2], gait: 'slow' },
  { id: 'kruvaziyer', name: 'Kruvaziyer kafilesi', patience: 3, tip: 4, w: 0.35, hours: [[10, 17]], peak: [], prefer: { doner: 2, ayran: 2, simit: 2, cay: 1 }, group: [3, 5], items: [1, 1], sit: 0.5, voice: 200, wave: 3, gait: 'slow' },
  { id: 'gezgin', name: 'Sırt çantalı gezgin', patience: 4, tip: 1, w: 0.7, hours: [[9, 20]], peak: [], prefer: { simit: 4, cay: 2 }, group: [1, 1], items: [1, 1], sit: 0.3, voice: 190, gait: 'normal' },
  { id: 'vlogcu', name: 'Yemek vlogcusu', patience: 3, tip: 3, w: 0.4, hours: [[11, 21]], peak: [], prefer: { doner: 3, tost: 2, ayran: 1 }, group: [1, 1], items: [1, 2], sit: 0.5, voice: 210, gait: 'normal' },
  { id: 'balayi', name: 'Balayı çifti', patience: 3, tip: 5, w: 0.4, hours: [[15, 22]], peak: [[18, 21]], prefer: { cay: 2, doner: 2, gazoz: 1 }, group: [2, 2], items: [1, 1], sit: 0.95, voice: 220, gait: 'normal' },
  { id: 'turgrubu', name: 'Yaşlı tur grubu', patience: 5, tip: 3, w: 0.35, hours: [[9, 16]], peak: [], prefer: { cay: 3, simit: 3, ayran: 1 }, group: [3, 5], items: [1, 1], sit: 0.9, voice: 140, wave: 2, gait: 'slow' },
  { id: 'isinsani', name: 'Takım elbiseli iş insanı', patience: 1, tip: 4, w: 0.6, hours: [[8, 13]], peak: [[8, 10]], prefer: { cay: 2, doner: 2, ayran: 1 }, group: [1, 1], items: [1, 2], sit: 0.2, voice: 130, gait: 'brisk' },
  { id: 'vapuryolcusu', name: 'Vapur yolcusu', patience: 2, tip: 2, w: 0.6, hours: [[8, 24]], peak: [], prefer: { simit: 3, cay: 3, tost: 2, gazoz: 2 }, group: [1, 1], items: [1, 1], sit: 0, voice: 170, ferry: true, gait: 'brisk' },
  { id: 'bebekarabali', name: 'Bebek arabalı aile', patience: 3, tip: 3, w: 0.6, hours: [[10, 19]], peak: [], prefer: { ayran: 3, simit: 3 }, group: [2, 3], items: [1, 1], sit: 0.5, voice: 230, gait: 'normal' },
];
export const CITIZEN_IDS: string[] = CITIZENS.map(t => t.id);
export const citizenIndex = (id: string): number => CITIZEN_IDS.indexOf(id);
/** v2 D.CROWD_BUDGET (GDD Kalabalık table); the economy never depends on these. */
export const CROWD_BUDGET: Record<TierName, CrowdBudgetRow> = {
  akici: { queue: 10, seated: 6, ambient: 5, passers: 4 },
  dengeli: { queue: 14, seated: 12, ambient: 14, passers: 10 },
  sahane: { queue: 18, seated: 20, ambient: 30, passers: 22 },
};
/** v2 D.PATIENCE_S / D.TIP_FRAC (index = patience / tip level). */
export const PATIENCE_S = [40, 15, 25, 40, 60, 90];
export const TIP_FRAC = [0, 0.05, 0.10, 0.15, 0.22, 0.30];
export default CITIZENS;
