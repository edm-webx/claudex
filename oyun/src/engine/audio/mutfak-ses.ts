// Mutfak sesleri (BUF-08): saf seviye matematiği, DOM ve AudioContext yok. Sim yalnız olay ve istasyon listesi üretir,
// ses katmanı bu fonksiyonla kısıklığı hesaplar. Tepe değerleri üst sınırı aşmaz: kaynak sayısı artınca ses büyümez.
import type { Vec2 } from '../api';

/** döngü (cızırtı + davlumbaz) toplam tavanı: bugünkü tek döner döngüsünün tepesinden düşük */
export const HEAT_MAX = 0.20;
/** bir ısı kaynağının duyulduğu mesafe (m); bu dışında kaynak sessiz */
export const HEAT_R = 8;
/** tek seferlik tariflerin tepe seviyeleri (SFX tarifleri bu değerleri aşmaz) */
export const SES_TEPE = { passBell: 0.06, tavaCarpma: 0.07, bulasikSes: 0.04 } as const;
/** aynı olayın en kısa aralığı (ms): tava çarpması ve bulaşık şıngırtısı üst üste binmez */
export const SES_ARALIK_MS = { tavaCarpma: 400, bulasikSes: 3000 } as const;

export interface IsiKaynagi { x: number; z: number; w: number }

/** Dinleyicideki döngü seviyesi: kaynak ağırlıkları toplanır, MAX'a yumuşakça yaklaşır (tanh) */
export function heatLevel(listener: Vec2, kaynaklar: readonly IsiKaynagi[], R = HEAT_R, MAX = HEAT_MAX): number {
  let s = 0;
  for (const k of kaynaklar) {
    const d = Math.hypot(k.x - listener.x, k.z - listener.z);
    if (d >= R) continue;
    const f = 1 - d / R;
    s += k.w * 0.22 * f * f;
  }
  return s <= 0 ? 0 : MAX * Math.tanh(s / MAX);
}
