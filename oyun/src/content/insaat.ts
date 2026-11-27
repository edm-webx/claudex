/**
 * Tadilat inşaat sahası (BUF-21): her aşama tadilatının iskele üzerinde kurulduğu alan ve tadilat ustalarının çalışma noktaları.
 * Pure data, sim (agents/ustalar.ts: yürüyen baretli ustalar) ve görünüm (view/world/bufe-buyume.ts: iskele, vinç, ilerleme panosu)
 * aynı yerden okur. Çalışma noktaları o tadilat sürerken yürünebilir yerlerdedir (henüz kurulmamış kanat, salon önü, mutfağın
 * büyüyeceği uçlar); kurulu masa tablalarının ve salon duvarlarının dışında.
 */
import type { Vec2 } from '../engine/api';
import { SETLER, bufeBoyut } from './santiye';

export interface Alan { x0: number; x1: number; z0: number; z1: number }
/** iskele kanatlarının ayak izleri (bufe-buyume.ts aynı değerleri kullanır) */
export const WB: Alan = { x0: -23.0, x1: -12.2, z0: -17.2, z1: -10.6 };   // batı salonu
export const WT: Alan = { x0: -23.0, x1: -12.2, z0: -9.4, z1: 3.4 };      // batı terası
export const EB: Alan = { x0: 9.6, x1: 21.6, z0: -17.2, z1: -10.6 };      // doğu salonu
export const ET: Alan = { x0: 9.6, x1: 21.4, z0: -3.9, z1: 3.4 };         // doğu terası (kuzeyi servis koridoru)

/** tadilatın (hedef aşama) inşaat alanı: iskele kuleleri, bariyer ve vinç buraya kurulur */
export const SITE_AREA: Record<number, Alan> = {
  2: { x0: -9.6, x1: 7.6, z0: 2.4, z1: 3.7 }, 3: { ...WT, z1: -0.6 }, 4: { ...ET, x1: 17.2 }, 5: WT, 6: WB, 7: EB, 8: ET, 9: { x0: -4.2, x1: 4.2, z0: -12.6, z1: -10.6 }, 10: { x0: -5, x1: 5, z0: -3.5, z1: 3.8 },
};
/** usta çalışma noktaları (hedef aşamaya göre); ilk nokta malzeme yığını (kalas buradan alınır) */
export const USTA_NOKTA: Record<number, [number, number][]> = {
  2: [[4.0, 3.1], [-7.0, 3.2], [-5.0, 3.3], [-1.5, 3.2], [1.5, 3.2]],
  3: [[-13.4, -5.0], [-20.5, -8.0], [-16.8, -8.0], [-20.5, -5.0], [-16.8, -2.0], [-2.2, -15.0], [2.2, -15.0]],
  4: [[13.4, -0.3], [13.4, -2.9], [11.0, 0.0], [15.8, 0.0], [13.4, 2.9]],
  5: [[-13.4, 1.0], [-20.5, 1.0], [-16.8, 1.0], [-20.5, 3.0], [-16.8, -5.0]],
  6: [[-15.0, -11.8], [-19.5, -14.0], [-17.6, -16.0], [-14.0, -15.0], [-19.0, -12.0], [-5.8, -15.2], [5.8, -15.2]],
  7: [[13.0, -12.0], [13.5, -14.5], [15.6, -16.0], [17.0, -13.2], [18.0, -11.8]],
  8: [[15.5, 0.0], [12.9, -2.8], [17.4, -1.2], [12.9, 1.0], [18.0, 1.0], [15.5, 2.8]],
  9: [[0.0, -11.9], [1.8, -11.8], [-6.0, -11.5], [4.8, -11.8], [7.2, -11.5]],
  10: [[-1.0, 3.0], [-2.4, 1.8], [2.6, 2.0], [1.0, 3.0], [0.0, -12.0]],
};
/** malzeme yığını: ilk noktanın hemen yanında (bufe-buyume.ts aynı yere çizer, usta oraya gider), 2 m uzunluğunda x doğrultusunda */
export const yiginKonum = (to: number): Vec2 => { const p = (USTA_NOKTA[to] || USTA_NOKTA[3])[0]; return { x: p[0], z: p[1] - 0.6 }; };
/** kule vinç ayağı (yalnız büyük işlerde): alanın içinde, kolu sahaya bakar (deniz tarafına taşmaz) */
export const vincKonum = (to: number): Vec2 => { const R = SITE_AREA[to] || WT; return { x: R.x0 < 0 ? R.x0 + 2.4 : R.x1 - 2.4, z: Math.min(R.z1 - 0.7, R.z0 + 1.5) }; };
/** iskele kuleleri (bufe-buyume.ts çizer): dar alanda (derinlik < 3 m) yalnız iki uçta, aksi hâlde dört köşede */
export const kuleKonum = (to: number): Vec2[] => {
  const R = SITE_AREA[to] || WT, d = R.z1 - R.z0;
  if (to <= 2) return [{ x: R.x0 + 0.9, z: R.z0 + 0.5 }, { x: R.x1 - 0.9, z: R.z0 + 0.5 }];
  if (d < 3) { const z = (R.z0 + R.z1) / 2; return [{ x: R.x0 + 0.9, z }, { x: R.x1 - 0.9, z }]; }
  return [{ x: R.x0 + 0.9, z: R.z0 + 0.9 }, { x: R.x1 - 0.9, z: R.z0 + 0.9 }, { x: R.x0 + 0.9, z: R.z1 - 0.9 }, { x: R.x1 - 0.9, z: R.z1 - 0.9 }];
};
/** o tadilatta gelen usta sayısı (büyük tadilat, kalabalık ekip) */
export const ustaSayisi = (to: number): number => SETLER[bufeBoyut(to)].usta;   // 2026-11-25 şantiye setleri: 2 / 3 / 4 / 5
export const ustaNoktalari = (to: number): Vec2[] => (USTA_NOKTA[to] || USTA_NOKTA[3]).map(([x, z]) => ({ x, z }));
export const insaatAlani = (to: number): Alan => SITE_AREA[to] || WT;

/* ---------- BUF-30 aşama açılış anı (pure: view/world/acilis.ts ve testler okur) ---------- */
import { MUTFAK_ROL, mutfakSlot } from './mutfak';
import { DISHES } from './yemek-menu';
import { KIOSK_STAGES } from './stages';
export interface AcilisBilgi { to: number; ad: string; /** kameranın uğradığı yer (yeni bölümün ortası) */ odak: Vec2; /** kurdelenin gerildiği giriş */ kurdele: Vec2; /** yeni gelen kadro: 'Aşçı +1' */ yeniRol: string[]; /** menüye yeni giren yemekler */ yeniMenu: string[] }
export function acilisBilgi(to: number): AcilisBilgi {
  const r = insaatAlani(to), odak = { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
  const kurdele = to === 6 || to === 7 || to === 8 ? { x: odak.x, z: r.z1 + 0.9 } : to === 2 || to === 10 ? { x: -0.25, z: 3.2 } : { x: odak.x, z: Math.min(3.9, r.z1 + 0.5) };
  const yeniRol = MUTFAK_ROL.map(x => ({ x, d: mutfakSlot(x.id, to) - mutfakSlot(x.id, to - 1) })).filter(o => o.d > 0).map(o => o.x.label + ' +' + o.d);
  return { to, ad: KIOSK_STAGES[to - 1]?.short || '', odak, kurdele, yeniRol, yeniMenu: DISHES.filter(d => d.asama === to).map(d => d.ad) };
}
