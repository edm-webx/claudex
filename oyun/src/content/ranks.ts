/**
 * Worker roles, rarity, ranks, morale (v2 D.ROLES, D.RARITY, D.RANKS, D.MORALE).
 * Ported 1:1 from v2 data.js (numbers and Turkish text kept). Owner: Builder C (M1). Pure data, no imports of sim code.
 */

export interface RoleDef { id: string; label: string; station: string | null; act: string; base: number; carry?: number; [k: string]: unknown; }
export interface RarityDef { id: string; name: string; p: number; x: number; flaw: number; price: number; }
export interface RankDef { id: string; name: string; xp: number; x: number; wage: number; look: string; }
export type RoleId = 'doner' | 'cay' | 'garson' | 'tost' | 'temizlik';
export type RarityId = 'gri' | 'yesil' | 'mavi' | 'altin' | 'mor';

export const ROLES: Record<string, RoleDef> = {
  "doner": {
    "id": "doner",
    "label": "Dönerci",
    "station": "doner",
    "act": "cut",
    "base": 1500
  },
  "cay": {
    "id": "cay",
    "label": "Çaycı",
    "station": "cay",
    "act": "pour",
    "base": 1800
  },
  "garson": {
    "id": "garson",
    "label": "Garson",
    "station": null,
    "act": "idle",
    "base": 2200,
    "carry": 4
  },
  "tost": {
    "id": "tost",
    "label": "Tostçu / Gazozcu",
    "station": "tost",
    "act": "cut",
    "base": 3000
  },
  "temizlik": {
    "id": "temizlik",
    "label": "Temizlikçi",
    "station": null,
    "act": "wipe",
    "base": 2000
  }
};
export const ROLE_IDS: string[] = Object.keys(ROLES);
export const ROLE_SLOTS: Record<string, number> = {
  "doner": 1,
  "cay": 1,
  "tost": 1,
  "garson": 2,
  "temizlik": 1
};
export const RARITY: Record<string, RarityDef> = {
  "gri": {
    "id": "gri",
    "name": "Sıradan",
    "p": 0.72,
    "x": 1,
    "flaw": 0.5,
    "price": 1
  },
  "yesil": {
    "id": "yesil",
    "name": "Becerikli",
    "p": 0.2,
    "x": 1.25,
    "flaw": 0.4,
    "price": 1.4
  },
  "mavi": {
    "id": "mavi",
    "name": "Nadir",
    "p": 0.05,
    "x": 1.5,
    "flaw": 0.25,
    "price": 2
  },
  "altin": {
    "id": "altin",
    "name": "Efsane",
    "p": 0.03,
    "x": 2,
    "flaw": 1,
    "price": 3
  },
  "mor": {
    "id": "mor",
    "name": "Efsane Esnaf",
    "p": 0,
    "x": 2,
    "flaw": 0,
    "price": 0
  }
};
/** Roll order for random candidates (v2 rollRarity). */
export const RARITY_ROLL: readonly string[] = ['gri', 'yesil', 'mavi', 'altin'];
export const RANKS: RankDef[] = [
  {
    "id": "cirak",
    "name": "Çırak",
    "xp": 0,
    "x": 1,
    "wage": 0.03,
    "look": "Hafif lekeli önlük, kağıt şapka"
  },
  {
    "id": "kalfa",
    "name": "Kalfa",
    "xp": 300,
    "x": 1.25,
    "wage": 0.04,
    "look": "Tertemiz önlük, göğüste isimlik"
  },
  {
    "id": "usta",
    "name": "Usta",
    "xp": 1500,
    "x": 1.5,
    "wage": 0.05,
    "look": "Altın diş: gülünce parlar"
  },
  {
    "id": "basusta",
    "name": "Başusta",
    "xp": 6000,
    "x": 1.8,
    "wage": 0.06,
    "look": "Beyaz aşçı şapkası"
  },
  {
    "id": "efsane",
    "name": "Efsane",
    "xp": 20000,
    "x": 2.2,
    "wage": 0.06,
    "look": "\"EFSANE\" işlemeli önlük"
  }
];
/** [from morale, label, speed factor] */
export const MORALE: [number, string, number][] = [
  [
    80,
    "Coşkulu",
    1.1
  ],
  [
    40,
    "Normal",
    1
  ],
  [
    20,
    "Küskün",
    0.85
  ],
  [
    0,
    "Küs",
    0.7
  ]
];
export const MORALE_START = 70;
export const JOB_REFRESH_COST = 250;
/** Board auto-refresh period (s of play time). */
export const BOARD_REFRESH_S = 300;

export function rankOf(xp: number): number { let r = 0; RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; }
export function moraleFactor(m: number): number { for (const r of MORALE) if (m >= r[0]) return r[2]; return 0.7; }
export function moraleLabel(m: number): string { for (const r of MORALE) if (m >= r[0]) return r[1]; return 'Küs'; }
/** Hire price: legends carry their own; random = role base x rarity x 1.2^(hired beyond 3), rounded to 50. */
export function workerCost(role: string, rarity: string, hiredCount: number): number {
  const r = ROLES[role], k = RARITY[rarity] || RARITY.gri;
  return Math.round((r ? r.base : 2000) * k.price * Math.pow(1.2, Math.max(0, (hiredCount || 0) - 3)) / 50) * 50;
}
