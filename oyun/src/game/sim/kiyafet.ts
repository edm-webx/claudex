/**
 * Kıyafet dolabı (survey 2026-10-24, Faz 2). Buy with Altın Simit, wear one item per slot.
 * State: S.zones.kiyafet = { owned: itemId[], worn: { slot: itemId } }. Cosmetic only, never changes income.
 * Commands: { kind: 'kiyafet', op: 'buy' | 'wear' | 'take', id }. Pure: no view, no three.
 */
import { KIYAFET_URUNLER, type KiyafetUrun, type KiyafetSlot } from '../../content/kiyafet';
import type { Kernel } from './state';

export interface KiyafetSave { owned: string[]; worn: Partial<Record<KiyafetSlot, string>> }

export function kiyafetSave(S: { zones: Record<string, Record<string, unknown>> }): KiyafetSave {
  const z = (S.zones.kiyafet ||= { owned: [], worn: {} }) as unknown as KiyafetSave;
  if (!Array.isArray(z.owned)) z.owned = [];
  if (!z.worn || typeof z.worn !== 'object') z.worn = {};
  return z;
}

export const kiyafetItem = (id: string): KiyafetUrun | undefined => KIYAFET_URUNLER.find(u => u.id === id);

export function installKiyafet(K: Kernel) {
  const S = K.state;
  return {
    run(op: 'buy' | 'wear' | 'take', id: string): boolean {
      const z = kiyafetSave(S);
      const it = kiyafetItem(id);
      if (!it) return false;
      if (op === 'buy') {
        if (z.owned.includes(id)) { K.toast(it.name + ' zaten dolapta.', 'info'); return false; }
        if ((S.gold || 0) < it.gold) { K.toast('Altın Simit yetmiyor: ' + it.gold + ' lazım.', 'bad'); return false; }
        S.gold -= it.gold; z.owned.push(id); K.toast(it.name + ' dolabında!', 'good'); K.logEv('kiyafet', { id, op }); K.saveNow();
        return true;
      }
      if (!z.owned.includes(id)) return false;
      if (op === 'wear') { z.worn[it.slot] = id; K.logEv('kiyafet', { id, op }); K.saveNow(); return true; }
      if (z.worn[it.slot] === id) { delete z.worn[it.slot]; K.saveNow(); return true; }
      return false;
    },
    model: () => { const z = kiyafetSave(S); return { owned: z.owned.slice(), worn: { ...z.worn }, gold: S.gold || 0 }; },
  };
}
