/**
 * DKN-03 pure helpers: the named staff ("kadro") and the 3-candidate job board of a far-shore business.
 * No three, no DOM, only a seeded Rng. Storage lives in mulk.ts (Plot.kadro / Plot.ilan).
 */
import type { Rng } from '../../../engine/api';
import { ISLETME_ROL, type IsletmeRol } from '../../../content/isletme-kadro';
import { NAMES, MEMLEKET } from '../../../content/names';
import { TRAITS, TRAIT_IDS } from '../../../content/traits';
import { ABOUT } from '../../../content/workers';
import type { IsletmeId } from '../../../content/esya';

export interface Calisan { id: number; ad: string; rol: string; huy: string; look: { apronText: string; lookSeed: number; headscarf?: string }; xp: number; gun: number }
export interface IsKart { id: string; ad: string; rol: string; rolAd: string; huy: string; huyAd: string; look: Calisan['look']; about: string; fiyat: number }

const huyHavuz = (r: IsletmeRol) => { const l = TRAIT_IDS.filter(t => (TRAITS[t].roles || []).includes(r.huyRol) && t !== 'uykucu' && t !== 'fenomen' && t !== 'geveze'); return l.length ? l : ['hamarat']; };
/** roles open at business level `lv` */
export const acikRoller = (tur: IsletmeId, lv: number) => ISLETME_ROL[tur].filter(r => r.minLv <= lv);

export function yeniKisi(rng: Rng, tur: IsletmeId, lv: number, rol?: IsletmeRol) {
  const r = rol || rng.pick(acikRoller(tur, lv)), kadin = rng.chance(0.5), ad = rng.pick(NAMES[kadin ? 'f' : 'm']);
  const huy = rng.pick(huyHavuz(r));
  const look: Calisan['look'] = { apronText: ad.toLocaleUpperCase('tr'), lookSeed: rng.int(1, 1e6) };
  if (kadin && rng.chance(0.3)) look.headscarf = rng.pick(['yazma', 'loose', 'sport']);
  return { r, ad, huy, look, about: rng.pick(MEMLEKET) + "'li, " + rng.int(18, 52) + ' yaşında. ' + rng.pick(ABOUT) };
}
/** three candidates; roles prefer the ones the current crew lacks */
export function ilanYap(rng: Rng, arsaId: string, tur: IsletmeId, lv: number, kadro: Calisan[], fiyat: number, gun: number): IsKart[] {
  const out: IsKart[] = [], acik = acikRoller(tur, lv);
  for (let i = 0; i < 3; i++) {
    const eksik = acik.filter(r => !kadro.some(c => c.rol === r.rol) && !out.some(o => o.rol === r.rol));
    const k = yeniKisi(rng, tur, lv, eksik.length ? rng.pick(eksik) : undefined);
    out.push({ id: arsaId + '.' + gun + '.' + i + '.' + rng.int(100, 999), ad: k.ad, rol: k.r.rol, rolAd: k.r.ad, huy: k.huy, huyAd: TRAITS[k.huy]?.name || '', look: k.look, about: k.about, fiyat });
  }
  return out;
}
/** old saves carried only a head count: build that many named people, deterministically (rng seeded by the caller) */
export function kadroKur(rng: Rng, tur: IsletmeId, lv: number, n: number, nextId: () => number, gun: number): Calisan[] {
  const out: Calisan[] = [], roller = ISLETME_ROL[tur];
  for (let i = 0; i < n; i++) { const k = yeniKisi(rng, tur, lv, roller[Math.min(i, roller.length - 1)]); out.push({ id: nextId(), ad: k.ad, rol: k.r.rol, huy: k.huy, look: k.look, xp: 0, gun }); }
  return out;
}

/** tiny seeded stream (mulberry32): fresh and reproducible per (save seed, business) so an old save always gets the same crew */
export function tohumluRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r: Rng = {
    next, range: (x, y) => x + next() * (y - x), int: (x, y) => x + Math.floor(next() * (y - x + 1)), pick: <T,>(l: readonly T[]) => l[Math.floor(next() * l.length)],
    weighted: ((w: Record<string, number>) => Object.keys(w)[0]) as Rng['weighted'], chance: p => next() < p,
    getState: () => [a, 0, 0, 0], setState: s => { a = s[0] >>> 0; },
  };
  return r;
}
export const strSeed = (s: string, base: number) => { let h = base | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
