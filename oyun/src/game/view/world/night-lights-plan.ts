/**
 * PRF-08 pure night-light planner (no three): which lamp each pooled PointLight shows, and how it fades between lamps.
 * - pickLamps: the n nearest lamps, with hysteresis (a lamp already shown keeps its slot while it stays within rank n+margin),
 *   so a lamp on the edge of the set does not flip on and off while the player walks (owner H-052: "epileptic-like flicker").
 * - assignSlots: a light that already holds a chosen lamp keeps it; only freed lights take the new lamps.
 * - stepFade: a light that must move fades to 0 in FADE_TAU seconds, jumps while dark, then fades back in. dt based, never per frame.
 * Also the lamp positions that are pure content: interior ceiling lamp grid (same grid as ic-mekan-look 'lamba') and the büfe floresan
 * per stage (same numbers as kiosk.ts K2.flo).
 */
import { icDim, icWorld, icKapi, type IcMekan } from '../../../content/ic-mekan';
import { BUFE } from '../../../content/prefabs/iskele/layout';

export const PLAN_DT = 0.4, FADE_TAU = 0.3, HYST_MARGIN = 2;

export interface LampXZ { x: number; z: number }

const _d: number[] = [], _ord: number[] = [], _rank: number[] = [];
const byRank = (a: number, b: number): number => _rank[a] - _rank[b];
/** indices of the n lamps to show around focus; prev = lamps shown now (kept while their rank < n+margin). Result sorted by distance. */
export function pickLamps(lamps: readonly LampXZ[], focus: LampXZ, n: number, prev: readonly number[] = [], margin = HYST_MARGIN, out: number[] = []): number[] {
  const L = lamps.length; out.length = 0;
  if (n <= 0 || !L) return out;
  _d.length = L; _ord.length = L; _rank.length = L;
  for (let i = 0; i < L; i++) { const dx = lamps[i].x - focus.x, dz = lamps[i].z - focus.z; _d[i] = dx * dx + dz * dz; _ord[i] = i; }
  // insertion sort by (distance, index): L is ~100, called every 0.4 s, no allocation
  for (let i = 1; i < L; i++) { const v = _ord[i], dv = _d[v]; let j = i - 1; while (j >= 0 && (_d[_ord[j]] > dv || (_d[_ord[j]] === dv && _ord[j] > v))) { _ord[j + 1] = _ord[j]; j--; } _ord[j + 1] = v; }
  for (let r = 0; r < L; r++) _rank[_ord[r]] = r;
  const keepLim = n + margin;
  for (const p of prev) if (p >= 0 && p < L && _rank[p] < keepLim && out.length < n && out.indexOf(p) < 0) out.push(p);
  for (let r = 0; r < L && out.length < n; r++) { const i = _ord[r]; if (out.indexOf(i) < 0) out.push(i); }
  out.sort(byRank);
  return out;
}

/** light j -> lamp index (-1 = none). Lights keep a lamp that is still chosen; new lamps fill the freed lights in order. */
export function assignSlots(prevAssign: readonly number[], chosen: readonly number[], out: number[] = []): number[] {
  const n = prevAssign.length; out.length = n;
  for (let j = 0; j < n; j++) out[j] = chosen.indexOf(prevAssign[j]) >= 0 ? prevAssign[j] : -1;
  let j = 0;
  for (const c of chosen) {
    if (out.indexOf(c) >= 0) continue;
    while (j < n && out[j] >= 0) j++;
    if (j >= n) break;
    out[j++] = c;
  }
  return out;
}

export interface FadeState { cur: number; want: number; k: number }
/** dt-based fade: k -> 0 while cur != want, swap when dark (no visible jump), then k -> 1. k stays in [0,1]. */
export function stepFade(s: FadeState, dt: number, tau = FADE_TAU): FadeState {
  const r = dt / tau;
  if (s.cur !== s.want) {
    if (s.cur < 0) s.k = 0;
    s.k = Math.max(0, s.k - r);
    if (s.k <= 0) { s.cur = s.want; s.k = 0; }
  } else if (s.cur >= 0) s.k = Math.min(1, s.k + r);
  else s.k = 0;
  return s;
}
export const smooth01 = (k: number): number => k * k * (3 - 2 * k);

/** ceiling lamp grid of a room, world space, bulb height (same grid as ic-mekan-look 'lamba': one lamp per ~3.6 m). */
export function icLambalar(m: IcMekan): { x: number; y: number; z: number }[] {
  const { W, D } = icDim(m), h = Math.min(3.2, m.h);
  const nx = Math.max(1, Math.round(W / 3.6)), nz = Math.max(1, Math.round(D / 3.6));
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const p = icWorld(m, -W / 2 + (i + 0.5) * W / nx, -D / 2 + (j + 0.5) * D / nz);
    out.push({ x: p.x, y: h - 0.8, z: p.z });
  }
  return out;
}

/** büfe floresan tube per stage (kiosk.ts K2.flo: stage 1 closed shell front, stage 2+ kitchen back wall). */
export function floresanNoktasi(stage: number): { x: number; y: number; z: number } {
  return stage <= 1 ? { x: 0.2, y: 2.12, z: BUFE.z1 + 1.12 } : { x: 0, y: 2.31, z: BUFE.z0 + 0.3 };
}

/**
 * GRS-02 shop fronts at night (owner B-010: lambalar yanınca yerde ışık havuzu): every building with a door on the far shore throws a soft
 * warm pool on the pavement in front of its door. Dimmer than a street lamp (i 0.42) so the street lamps still lead; they go through the same
 * pool and planner as every other lamp (no own PointLight, no light count change).
 */
export const VITRIN_I = 0.42, VITRIN_RENK = '#ffd49a';
export function vitrinLambalari(mekanlar: readonly IcMekan[]): { x: number; y: number; z: number; i: number; color: string }[] {
  const out: { x: number; y: number; z: number; i: number; color: string }[] = [];
  for (const m of mekanlar) {
    if (!m.bina || m.tur === 'morg') continue;   // the morgue has no shop window
    const p = icKapi(m, 1.1);
    if (mekanlar.some(o => o !== m && Math.abs(p.x - o.x) < o.wx / 2 && Math.abs(p.z - o.z) < o.wz / 2)) continue;   // annex door inside its main building (acil)
    out.push({ x: p.x, y: Math.min(2.8, m.h - 0.2), z: p.z, i: VITRIN_I, color: VITRIN_RENK });
  }
  return out;
}
