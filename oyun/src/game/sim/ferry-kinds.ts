/**
 * Ferry variety + timetable model (survey vapur-1/2/3/8). ferry.ts asks this module which boat comes next (picked
 * from the 'sim.ferry' rng stream when the previous one sounds its horn, so the main stream is untouched by the pick),
 * how big its dock wave is and who walks off. The timetable board view reads `ferryBoardModel()`. Pure.
 * Runtime only (rt.ferryInfo): nothing persisted, old saves unaffected.
 */
import type { Rng } from '../../engine/api';
import { FERRY_KINDS, FERRY_KIND_IDS, NIGHT_FERRY, type FerryKindId } from '../../content/ferries';
import { P } from '../../content/economy';
import type { Runtime } from './state';
import { clamp, hourOf } from './util';

export interface FerryInfo {
  /** boat that is arriving / docked / leaving (last one when away) */
  cur: FerryKindId;
  /** the lit last ferry of the night */
  curLit: boolean;
  /** boat shown as "next" on the timetable */
  next: FerryKindId;
  /** forced next kind (test hook), consumed at the next horn */
  forced: FerryKindId | null;
}

export const isFerryKind = (v: unknown): v is FerryKindId => typeof v === 'string' && (FERRY_KIND_IDS as string[]).includes(v);

export function pickFerryKind(rng: Rng): FerryKindId {
  const w: Partial<Record<FerryKindId, number>> = {};
  for (const id of FERRY_KIND_IDS) w[id] = FERRY_KINDS[id].weight;
  return rng.weighted(w);
}

/** The first boat of a session is always the classic Şehir Hattı (tutorial-friendly, keeps the first-session pacing). */
export function newFerryInfo(): FerryInfo { return { cur: 'sehir', curLit: false, next: 'sehir', forced: null }; }

/** Called at the horn: the "next" boat becomes the current one, a new next is drawn. */
export function advanceFerry(info: FerryInfo, rng: Rng, hour: number): FerryInfo {
  info.cur = info.forced ?? info.next; info.forced = null;
  info.curLit = isNightHour(hour);
  info.next = pickFerryKind(rng);
  return info;
}

export const isNightHour = (h: number): boolean => h >= NIGHT_FERRY.fromHour && h < 24;

/** Dock wave size for this boat (base = the classic v2 count). */
export function ferryBuyers(base: number, kind: FerryKindId, lit: boolean): number {
  const x = FERRY_KINDS[kind].buyersX * (lit ? NIGHT_FERRY.buyersX : 1);
  return clamp(Math.round(base * x), 2, 10);
}

/** Citizen id for one passenger (null = a normal passer-by type). One rng draw per passenger. */
export function ferryPassenger(rng: Rng, kind: FerryKindId, lit: boolean): string | null {
  const mix = lit ? NIGHT_FERRY.mix : FERRY_KINDS[kind].mix;
  let r = rng.next();
  for (const [id, p] of mix) { if (r < p) return id; r -= p; }
  return null;
}

export const ferryName = (kind: FerryKindId, lit: boolean): string => (lit ? 'Işıklı ' : '') + FERRY_KINDS[kind].name;

export function ferryDockLine(rng: Rng, kind: FerryKindId, lit: boolean): string {
  return lit ? rng.pick(NIGHT_FERRY.dock) : rng.pick(FERRY_KINDS[kind].dock);
}

export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.ceil(sec));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

export interface FerryBoardModel {
  /** 'away': counting down to the next boat; 'arriving' / 'docked' / 'leaving': the current boat */
  phase: Runtime['ferry']['state'];
  title: string;
  name: string;
  /** remaining time until the boat docks ('away' / 'arriving') or leaves ('docked') */
  time: string;
  status: string;
  lit: boolean;
  kind: FerryKindId;
}

/** What the tarife tahtası shows right now. `playT` / `dayT` from GameState. */
export function ferryBoardModel(rt: Pick<Runtime, 'ferry' | 'ferryInfo'>, playT: number, dayT: number, timing: { arriving: number; docked: number; leaving: number }): FerryBoardModel {
  const f = rt.ferry, info = rt.ferryInfo ?? { cur: 'sehir', curLit: false, next: 'sehir', forced: null };
  if (f.state === 'arriving' || f.state === 'docked') {
    const docked = f.state === 'docked';
    return {
      phase: f.state, kind: info.cur, lit: info.curLit,
      title: info.curLit ? NIGHT_FERRY.board : docked ? 'İSKELEDE' : 'GELİYOR',
      name: FERRY_KINDS[info.cur].board,
      time: mmss(docked ? timing.docked - f.t : timing.arriving - f.t),
      status: docked ? 'Kalkışa kalan' : 'Yanaşmaya kalan',
    };
  }
  // away or leaving: the next boat (its horn sounds `arriving` s before f.next)
  const kind = info.forced ?? info.next;
  const left = Math.max(0, f.next - playT);
  const lit = isNightHour(hourOf(dayT + Math.max(0, left - timing.arriving)));
  const tooLate = dayT + left >= P.GAME_DAY_S;
  return {
    phase: f.state, kind, lit: lit && !tooLate,
    title: lit && !tooLate ? NIGHT_FERRY.board : 'SIRADAKİ VAPUR',
    name: FERRY_KINDS[kind].board,
    time: mmss(left),
    status: f.state === 'leaving' ? 'Bu vapur kalkıyor, sıradaki' : tooLate ? 'Yarın sabah ilk sefer' : 'Yanaşmaya kalan',
  };
}
