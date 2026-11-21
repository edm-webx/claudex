/** Pads (sarı kareler): unlock sequence and prices (v2 data.js D.PADS). Owner: Builder A. Pure data. */
import { KIOSK_STAGES } from './stages';
import type { ProductId } from '../game/sim/schema';

export interface PadDef2 { key: string; label: string; sub: string; price: number; kind: 'station' | 'table' | 'job' | 'window' | 'tray' | 'magnet' | 'tadilat'; station?: ProductId; table?: number; after: string[]; when?: string; minPlay?: number; stage?: number; }
export const PADS: PadDef2[] = [
  { key: 'cay', label: 'ÇAY OCAĞI', sub: 'Çay satmaya başla', price: 300, kind: 'station', station: 'cay', after: [], when: 'firstCollect' },
  { key: 'ayran', label: 'AYRAN DOLABI', sub: 'Buz gibi ayran', price: 1200, kind: 'station', station: 'ayran', after: ['cay'], when: 'cayUsed', minPlay: 180 },
  { key: 'simit', label: 'SİMİT TABLASI', sub: 'Susamlı, sıcak', price: 700, kind: 'station', station: 'simit', after: ['ayran'], minPlay: 270 },
  { key: 'tabure1', label: 'TABURE', sub: 'Oturan bahşiş bırakır', price: 250, kind: 'table', table: 0, after: ['ayran'], minPlay: 270 },
  { key: 'tabure2', label: 'TABURE', sub: 'Bir tabure daha', price: 300, kind: 'table', table: 1, after: ['tabure1'] },
  { key: 'isbul', label: 'İŞ VE İŞÇİ BULMA', sub: 'Çırak tut, iş büyüsün', price: 600, kind: 'job', after: ['simit', 'tabure2'], minPlay: 450 },
  { key: 'pencere', label: 'VAPUR PENCERESİ', sub: 'Vapur gelince pencere açılır', price: 900, kind: 'window', after: ['isbul'], when: 'hiredOne', minPlay: 510 },
  { key: 'tepsi1', label: 'BÜYÜK TEPSİ', sub: '+2 taşıma', price: 400, kind: 'tray', after: ['pencere'] },
  { key: 'masa1', label: 'MASA', sub: 'İki kişilik masa', price: 1200, kind: 'table', table: 2, after: ['tepsi1'] },
  { key: 'gazoz', label: 'GAZOZ DOLABI', sub: 'Boğaz Gazozu, Kolaz', price: 2000, kind: 'station', station: 'gazoz', after: ['masa1'] },
  { key: 'miknatis', label: 'MIKNATISLI ÖNLÜK', sub: 'Para kendiliğinden gelir', price: 2500, kind: 'magnet', after: ['gazoz'] },
  { key: 'masa2', label: 'MASA', sub: 'Bir masa daha', price: 1500, kind: 'table', table: 3, after: ['gazoz'] },
  { key: 'tost', label: 'TOST MAKİNESİ', sub: 'Kaşarlı-sucuklu', price: 4000, kind: 'station', station: 'tost', after: ['masa2'] },
  { key: 'tepsi2', label: 'DEV TEPSİ', sub: '+2 taşıma', price: 3000, kind: 'tray', after: ['tost'] },
  { key: 'tadilat', label: 'TADİLAT', sub: 'Büfeye geçiş', price: 0, kind: 'tadilat', after: ['tost'], when: 'tadilatReady' },
  { key: 'masa3', label: 'MASA', sub: 'Büfenin önüne', price: 6000, kind: 'table', table: 4, after: ['tadilat'], stage: 2 },
  { key: 'masa4', label: 'MASA', sub: 'Denize nazır', price: 9000, kind: 'table', table: 5, after: ['masa3'], stage: 2 }
] as PadDef2[];
export const PAD_KEYS = PADS.map(p => p.key);
export const padDef = (key: string): PadDef2 | undefined => PADS.find(p => p.key === key);
/** price of a pad; the tadilat pad costs the next stage's renovation */
export const padCost = (key: string, stage: number): number => {
  const p = padDef(key);
  if (!p) return 0;
  if (p.kind === 'tadilat') { const s = KIOSK_STAGES[stage || 1]; return s && s.cost ? s.cost : 0; }
  return p.price;
};
/** Stage 3 adds two tavla tables (slots 6 and 7) automatically */
export const STAGE_TABLES: Record<number, number[]> = { 1: [], 2: [], 3: [6, 7] };
