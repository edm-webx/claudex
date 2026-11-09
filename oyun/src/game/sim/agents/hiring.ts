/**
 * Hire flow (v2 "İş ve İşçi Bulma"): candidate board, hire / fire / train. Pure functions over GameState + a seeded
 * Rng, so A's panelModel('jobBoard') and the commands can call them; the workers system picks up S.workers changes.
 * Port of v2 game.js makeCandidate / makeBoard / boardModel / hireCandidate / fireWorker / trainWorker.
 *
 * Candidate look is data only: `{ lookType, lookSeed, apron, apronText, headscarf? }`; the characters view expands it
 * with randomLook(lookType, rng(lookSeed)) (legends carry a full look). That keeps the sim free of three.
 */
import type { Rng } from '../../../engine/api';
import type { GameState, ProductId, WorkerSave } from '../schema';
import { ROLES, ROLE_IDS, ROLE_SLOTS, RARITY, RARITY_ROLL, RANKS, JOB_REFRESH_COST, BOARD_REFRESH_S, MORALE_START, workerCost, rankOf } from '../../../content/ranks';
import { TRAITS, TRAIT_IDS, TEAMS } from '../../../content/traits';
import { LEGENDS, ABOUT, STORY_LEGENDS, type LegendDef } from '../../../content/workers';
import { NAMES, MEMLEKET } from '../../../content/names';
import { LINES } from '../../../content/lines';

export interface JobCard {
  id: string; name: string; role: string; roleLabel: string; traitId: string;
  trait: { id: string; name: string; effect: string; flaw: string; line: string };
  rarity: string; wageShare: number; price: number; look: Record<string, unknown>; about: string; legend?: string;
}
export interface BoardCard extends JobCard { wage: string; canHire: boolean; why: string }
export interface BoardModel { candidates: BoardCard[]; emptyText: string; refreshIn: number; money: number; refreshCost: number }

/** What the hire rules need to know about the kiosk (A answers). */
export interface HiringHost {
  stationBuilt(p: string): boolean;
  tablesBuilt(): number;
  /** Station name for "Önce X açılmalı" (v2 PADS label). */
  padLabel(station: string): string;
  spend(v: number): void;
  toast(text: string, kind: 'info' | 'good' | 'bad'): void;
  addXP(n: number): void;
  stat(k: string, n?: number): void;
  sfx(name: string): void;
  rosterChanged(): void;
  money(): number;
}

const traitCard = (id: string) => { const t = TRAITS[id] || TRAITS.hamarat; return { id: t.id, name: t.name, effect: t.effect, flaw: t.flaw, line: t.line }; };

export function roleOpen(s: GameState, host: HiringHost, role: string): boolean {
  const r = ROLES[role]; if (!r) return false;
  if (r.station && !host.stationBuilt(r.station)) return false;
  if (role === 'temizlik' && host.tablesBuilt() < 2) return false;
  return s.workers.filter((w) => w.role === role).length < (ROLE_SLOTS[role] || 1);
}
export function roleWhy(s: GameState, host: HiringHost, role: string): string {
  const r = ROLES[role]; if (!r) return 'Bu iş şu an yok.';
  if (r.station && !host.stationBuilt(r.station)) return 'Önce ' + host.padLabel(r.station).toLocaleLowerCase('tr') + ' açılmalı.';
  if (role === 'temizlik' && host.tablesBuilt() < 2) return 'Önce iki masa kur.';
  return r.label + ' kadrosu dolu.';
}
const legendFree = (s: GameState, id: string) => !s.workers.some((w) => (w as { legend?: unknown }).legend === id);
const legendDef = (id: string): LegendDef => LEGENDS.find((l) => l.id === id)!;

function makeCandidate(s: GameState, rng: Rng, role: string, rarityId: string, legend?: LegendDef): JobCard {
  if (legend) {
    return {
      id: 'L' + legend.id + '_' + (s.boards || 0), legend: legend.id, name: legend.name, role: legend.role, roleLabel: ROLES[legend.role].label, traitId: legend.trait,
      trait: traitCard(legend.trait), rarity: 'altin', wageShare: RANKS[0].wage, price: legend.price, look: { ...legend.look }, about: legend.about,
    };
  }
  const female = rng.chance(0.5);
  const name = rng.pick(NAMES[female ? 'f' : 'm']);
  const traits = TRAIT_IDS.filter((t) => (TRAITS[t].roles || []).includes(role) && t !== 'uykucu' && t !== 'fenomen' && t !== 'geveze');
  const traitId = rng.pick(traits.length ? traits : ['hamarat']);
  const look: Record<string, unknown> = { lookType: role === 'garson' ? 'universiteli' : 'plaza', lookSeed: rng.int(1, 1e9), apron: '#1d5fa8', apronText: name.toLocaleUpperCase('tr') };
  if (female && rng.chance(0.3)) look.headscarf = rng.pick(['yazma', 'loose', 'sport']);
  return {
    id: 'C' + (s.nextWid + 1000 * (s.boards || 0)) + '_' + rng.int(100, 999), name, role, roleLabel: ROLES[role].label, traitId, trait: traitCard(traitId),
    rarity: rarityId, wageShare: RANKS[0].wage, price: workerCost(role, rarityId, s.workers.length), look, about: rng.pick(MEMLEKET) + "'li, " + rng.int(18, 52) + ' yaşında. ' + rng.pick(ABOUT),
  };
}
function rollRarity(rng: Rng): string {
  const r = rng.next(); let acc = 0;
  for (const id of RARITY_ROLL) { acc += RARITY[id].p; if (r < acc) return id; }
  return 'gri';
}

/** v2 makeBoard: story legends first (Rıza, Nazlı, Tayfun), then random cards up to three. */
export function makeBoard(s: GameState, host: HiringHost, rng: Rng, keep?: JobCard[]): JobCard[] {
  const cands = (keep || []).slice();
  const roles = ROLE_IDS.filter((r) => roleOpen(s, host, r));
  const onBoard = (id: string) => cands.some((c) => c.legend === id);
  if (cands.some((c) => c.legend)) { /* a story legend is already waiting on the board */ }
  else {
    for (const st of STORY_LEGENDS) {
      if (!legendFree(s, st.id) || onBoard(st.id) || !roleOpen(s, host, st.role) || s.playT < st.minPlayT) continue;
      cands.push(makeCandidate(s, rng, st.role, 'altin', legendDef(st.id)));
      break;
    }
  }
  let guard = 0;
  while (roles.length && cands.length < 3 && guard++ < 20) {
    const role = rng.pick(roles);
    let rar = rollRarity(rng);
    if (rar === 'altin') {
      const leg = LEGENDS.filter((l) => l.role === role && legendFree(s, l.id) && !STORY_LEGENDS.some((x) => x.id === l.id) && !onBoard(l.id));
      if (leg.length) { cands.push(makeCandidate(s, rng, role, 'altin', rng.pick(leg))); continue; }
      rar = 'mavi';
    }
    cands.push(makeCandidate(s, rng, role, rar));
  }
  s.boards = (s.boards || 0) + 1;
  s.jobCards = cands;
  if (!keep) s.jobRefreshAt = s.playT + BOARD_REFRESH_S;
  return cands;
}
export function boardModel(s: GameState, host: HiringHost, rng: Rng): BoardModel {
  if (!s.jobCards || !s.jobCards.length) makeBoard(s, host, rng);
  const cards = (s.jobCards || []) as JobCard[];
  return {
    candidates: cards.map((c) => {
      const open = roleOpen(s, host, c.role), rich = host.money() >= c.price;
      return { ...c, wage: '%' + Math.round(c.wageShare * 100) + ' pay', canHire: open && rich, why: !open ? roleWhy(s, host, c.role) : !rich ? 'Kasada ' + fmtMoney(c.price) + ' olmalı.' : '' };
    }),
    emptyText: ROLE_IDS.some((r) => roleOpen(s, host, r)) ? '' : 'Bütün kadrolar dolu. Yeni bir istasyon ya da masa açınca yeni ilanlar gelir.',
    refreshIn: Math.max(0, Math.ceil(s.jobRefreshAt - s.playT)), money: host.money(), refreshCost: JOB_REFRESH_COST,
  };
}
/** Opening the board re-rolls it when the timer ran out. */
export function openBoard(s: GameState, host: HiringHost, rng: Rng): void { if (s.playT >= s.jobRefreshAt) makeBoard(s, host, rng); }
export function refreshBoard(s: GameState, host: HiringHost, rng: Rng, paid: boolean): boolean {
  if (paid && s.playT < s.jobRefreshAt) {
    if (host.money() < JOB_REFRESH_COST) { host.toast('Yeni ilan için ' + fmtMoney(JOB_REFRESH_COST) + ' lazım.', 'bad'); return false; }
    host.spend(JOB_REFRESH_COST);
  }
  makeBoard(s, host, rng);
  return true;
}

/** Hire result: the new worker save (also pushed into s.workers) or null. `free` skips the price (tutorial / story). */
export function hireCandidate(s: GameState, host: HiringHost, rng: Rng, id: string | JobCard, free = false): WorkerSave | null {
  const c = typeof id === 'object' ? id : ((s.jobCards || []) as JobCard[]).find((x) => x.id === id);
  if (!c) return null;
  if (c.legend && !legendFree(s, c.legend)) { host.toast(c.name + ' zaten bizde çalışıyor.', 'info'); return null; }
  if (!roleOpen(s, host, c.role)) { host.toast(ROLES[c.role].label + ' kadrosu dolu.', 'bad'); return null; }
  if (!free && host.money() < c.price) { host.toast('Para yetmiyor abi: ' + fmtMoney(c.price), 'bad'); return null; }
  if (!free) host.spend(c.price);
  const w: WorkerSave & Record<string, unknown> = {
    id: s.nextWid++, name: c.name, role: c.role, trait: c.traitId, traits: [c.traitId], rarity: c.rarity, xp: 0, rank: 0, morale: MORALE_START,
    legend: c.legend || null, look: c.look, about: c.about, hiredDay: s.day, team: null,
  };
  if (c.traitId === 'futbol') w.team = (c.legend ? legendDef(c.legend).team : undefined) || rng.pick(TEAMS).id;
  s.workers.push(w);
  if (s.jobCards) { s.jobCards = (s.jobCards as JobCard[]).filter((x) => x.id !== c.id && roleOpen(s, host, x.role)); makeBoard(s, host, rng, s.jobCards as JobCard[]); }
  host.addXP(20); host.stat('hires'); host.sfx('buy');
  host.toast(w.name + ' işe başladı! (' + ROLES[w.role].label + ')', 'good');
  host.rosterChanged();
  return w;
}
export function fireWorker(s: GameState, host: HiringHost, id: number): WorkerSave | null {
  const i = s.workers.findIndex((w) => w.id === id); if (i < 0) return null;
  const w = s.workers[i]; s.workers.splice(i, 1);
  host.toast(w.name + ': Hakkını helal et usta.', 'info'); host.rosterChanged();
  return w;
}
export function trainCost(w: WorkerSave): number { return 300 * Math.pow(rankOf(w.xp || 0) + 1, 2); }
/** Returns true when trained (the workers system then re-checks the rank and cheers). */
export function trainWorker(s: GameState, host: HiringHost, id: number): boolean {
  const w = s.workers.find((x) => x.id === id); if (!w) return false;
  const cost = trainCost(w);
  if (host.money() < cost) { host.toast('Kurs için ' + fmtMoney(cost) + ' lazım.', 'bad'); return false; }
  host.spend(cost); w.xp = (w.xp || 0) + 150; w.morale = Math.min(100, (w.morale == null ? MORALE_START : w.morale) + 10);
  host.toast(w.name + ' ustalık kursuna gitti! +150 tecrübe', 'good');
  return true;
}
export const GIFT_LINE = LINES.workers.gift;
function fmtMoney(v: number): string { return Math.round(v).toLocaleString('tr-TR') + ' ₺'; }
export type { ProductId };
