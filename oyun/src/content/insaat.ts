/**
 * Tadilat inşaat sahası (BUF-21): her aşama tadilatının iskele üzerinde kurulduğu alan ve tadilat ustalarının çalışma noktaları.
 * Pure data, sim (agents/ustalar.ts: yürüyen baretli ustalar) ve görünüm (view/world/bufe-buyume.ts: iskele, vinç, ilerleme panosu)
 * aynı yerden okur. Çalışma noktaları o tadilat sürerken yürünebilir yerlerdedir (henüz kurulmamış kanat, salon önü, mutfağın
 * büyüyeceği uçlar); kurulu masa tablalarının ve salon duvarlarının dışında.
 */
import type { Vec2 } from '../engine/api';

export interface Alan { x0: number; x1: number; z0: number; z1: number }
/** iskele kanatlarının ayak izleri (bufe-buyume.ts aynı değerleri kullanır) */
export const WB: Alan = { x0: -23.0, x1: -12.2, z0: -17.2, z1: -10.6 };   // batı salonu
export const WT: Alan = { x0: -23.0, x1: -12.2, z0: -9.4, z1: 3.4 };      // batı terası
export const EB: Alan = { x0: 9.6, x1: 21.6, z0: -17.2, z1: -10.6 };      // doğu salonu
export const ET: Alan = { x0: 9.6, x1: 21.4, z0: -3.9, z1: 3.4 };         // doğu terası (kuzeyi vapur koridoru)

/** tadilatın (hedef aşama) inşaat alanı: iskele kuleleri, bariyer ve vinç buraya kurulur */
export const SITE_AREA: Record<number, Alan> = {
  2: { x0: -9.6, x1: 7.6, z0: 2.4, z1: 3.7 }, 3: { ...WT, z1: -0.6 }, 4: { ...ET, x1: 17.2 }, 5: WT, 6: WB, 7: EB, 8: EB, 9: ET, 10: { x0: -5, x1: 5, z0: -3.5, z1: 3.8 },
};
/** usta çalışma noktaları (hedef aşamaya göre); ilk nokta malzeme yığını (kalas buradan alınır) */
export const USTA_NOKTA: Record<number, [number, number][]> = {
  2: [[7.2, 3.1], [-8.0, 3.2], [-5.6, 3.3], [5.4, 3.3]],
  3: [[-13.4, -5.0], [-20.5, -8.2], [-16.8, -8.0], [-20.5, -5.0], [-16.8, -2.0], [-2.2, -15.0], [2.2, -15.0]],
  4: [[10.4, 2.8], [10.4, -3.0], [12.9, -3.0], [12.9, 0.1], [15.5, 3.0]],
  5: [[-13.4, 1.0], [-20.5, 1.0], [-16.8, 1.0], [-20.5, 3.0], [-16.8, -5.0]],
  6: [[-15.0, -11.8], [-21.0, -15.5], [-17.6, -16.0], [-14.0, -15.0], [-19.0, -12.0], [-5.8, -15.2], [5.8, -15.2]],
  7: [[13.0, -12.0], [11.5, -15.5], [15.6, -16.0], [19.5, -15.0], [18.0, -11.8]],
  8: [[-11.0, -10.0], [-20.0, -10.0], [-14.0, -10.0], [12.0, -10.0], [19.0, -10.0]],
  9: [[18.5, -3.4], [-8.0, -15.2], [8.0, -15.2], [-8.0, -12.0], [4.0, -12.0], [20.6, -1.0]],
  10: [[-4.6, 3.0], [-3.2, 2.0], [2.6, 2.0], [4.0, 3.0], [0.0, -12.0]],
};
/** o tadilatta gelen usta sayısı (büyük tadilat, kalabalık ekip) */
export const ustaSayisi = (to: number): number => (to >= 9 ? 5 : to >= 6 ? 4 : 3);
export const ustaNoktalari = (to: number): Vec2[] => (USTA_NOKTA[to] || USTA_NOKTA[3]).map(([x, z]) => ({ x, z }));
export const insaatAlani = (to: number): Alan => SITE_AREA[to] || WT;
