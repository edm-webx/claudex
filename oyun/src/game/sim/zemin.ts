/**
 * Büfe zemini (survey 2026-10-24, Faz 3). Pattern choice and dirt.
 * State: S.zones.zemin = { desen: 'ahsap' | 'fayans' | 'mermer', kir: 0..1 }.
 * Dirt rises while customers are in the kiosk and slowly otherwise; wiping it ('temizle') resets it to 0.
 * Pattern change is free (cosmetic). Pure sim: the view reads the state for the floor tint (not wired yet).
 * Commands: { kind: 'zemin', op: 'temizle' } and { kind: 'zemin', op: 'desen', value }.
 */
import type { Kernel } from './state';

export type ZeminDesen = 'ahsap' | 'fayans' | 'mermer';
export const ZEMIN_DESENLER: ZeminDesen[] = ['ahsap', 'fayans', 'mermer'];
// 2026-10-24: was 0.012 (full dirt in ~80 s of trade, the kiosk always looked filthy); now a full day of trade
export const ZEMIN_RATE = { customer: 0.0025, idle: 0.0003 };   // dirt per second

export interface ZeminSave { desen: ZeminDesen; kir: number; day?: number }

export function zeminSave(S: { zones: Record<string, Record<string, unknown>> }): ZeminSave {
  const z = (S.zones.zemin ||= { desen: 'ahsap', kir: 0 }) as unknown as ZeminSave;
  if (!ZEMIN_DESENLER.includes(z.desen)) z.desen = 'ahsap';
  if (typeof z.kir !== 'number' || !Number.isFinite(z.kir)) z.kir = 0;
  return z;
}

export function installZemin(K: Kernel) {
  const S = K.state, rt = K.rt;
  return {
    update(dt: number): void {
      const z = zeminSave(S);
      // Sabri mops up after closing: every new day starts with a clean floor
      if (z.day !== S.day) { z.day = S.day; z.kir = 0; }
      const busy = (rt.customers || []).length > 0;
      z.kir = Math.min(1, z.kir + dt * (busy ? ZEMIN_RATE.customer : ZEMIN_RATE.idle));
    },
    run(c: { op: string; value?: unknown }): boolean {
      const z = zeminSave(S);
      if (c.op === 'temizle') {
        if (z.kir <= 0) { K.toast('Zemin zaten parlak.', 'info'); return false; }
        z.kir = 0; K.toast('Zemin parladı!', 'good'); K.logEv('zemin', { op: 'temizle' }); K.saveNow(); return true;
      }
      if (c.op === 'desen') {
        const v = String(c.value) as ZeminDesen;
        if (!ZEMIN_DESENLER.includes(v)) return false;
        z.desen = v; K.saveNow(); return true;
      }
      return false;
    },
  };
}
