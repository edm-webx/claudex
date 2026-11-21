/**
 * GRS-02 visual clock (owner H-080 "pat diye gündüz oluyor"): the sim ends the day (03:00 = DAY_END_H) and starts the next one at 08:00
 * in the same tick, while the gün sonu card is still fading in. Drawing the sim hour made the world jump to daylight behind the card.
 * - On a day change the visual hour stays where the old day ended (night) as long as the gün sonu card is open.
 * - When the card closes ("Yeni güne başla"; headless runs have no card) a short dawn runs in real time: the visual hour eases from the
 *   held hour to 32 (render tod: 27..32 dawn corridor, 32 is an exact copy of 08:00), then hands over to the sim hour with no step.
 * - Same-day jumps (admin saat, hooks) are drawn at once, no dawn. The closing hour is whatever the old day ended at (works for any
 *   DAY_END_H). Pure: boot feeds sim hour, day, card state and frame dt; tests drive it directly.
 */
import { DAY_END_H } from '../engine/api';
import { DAWN_EXTRA } from '../engine/render/tod';

/** dawn length in real seconds */
export const SAFAK_SN = 5;
const SAFAK_SON = DAY_END_H + DAWN_EXTRA;

export interface GorselSaat {
  /** visual hour for this frame */
  update(simHour: number, simDay: number, kartAcik: boolean, dt: number): number;
  /** forget any held night / running dawn (hook setTime) */
  sifirla(simHour: number, simDay: number): void;
  readonly saat: number;
  /** true while the night is held or the dawn runs: boot draws every frame then */
  readonly gecis: boolean;
}

const smooth = (t: number) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

export function createGorselSaat(simHour: number, simDay: number): GorselSaat {
  let vis = simHour, day = simDay, held = false, dawnT = -1, start = simHour;
  return {
    update(h, d, kart, dt) {
      if (d !== day) { day = d; held = true; dawnT = -1; start = vis; }
      if (held) { if (kart) return vis; held = false; dawnT = 0; }
      if (dawnT >= 0) {
        dawnT += Math.max(0, Math.min(0.25, +dt || 0));
        const k = smooth(dawnT / SAFAK_SN);
        // a held hour past the corridor end (never in play) goes straight to the sim hour
        vis = start >= SAFAK_SON ? h : start + (SAFAK_SON - start) * k;
        if (k >= 1 || start >= SAFAK_SON) { vis = h; dawnT = -1; }
        return vis;
      }
      vis = h;
      return vis;
    },
    sifirla(h, d) { vis = h; day = d; held = false; dawnT = -1; start = h; },
    get saat() { return vis; },
    get gecis() { return held || dawnT >= 0; },
  };
}
