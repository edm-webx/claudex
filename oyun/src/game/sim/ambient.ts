/**
 * M0 ambient walkers: a pool of citizens that stroll between anchors, sit on benches, stop to idle or look at
 * the phone, and write themselves into the shared agents SoA for the crowd view. Owner: Builder C.
 * Pure sim: no three, window, document, Math.random, Date.now, performance.now. Randomness only from
 * ctx.rng.stream('ambient'), so a replay with the same seed and inputs walks the same way.
 *
 * The walker count is a sim constant (not the quality tier) so the sim stays identical on every device; the crowd
 * view culls by its own budget. Anchors may be empty (headless): walkers then pick walkable points inside `area`.
 * M1 customers take walkers with recruit() (the slot keeps its look, the ambient flag is cleared) and hand them
 * back with release() (the walker resumes strolling, or despawns when the pool is full).
 *
 * DNY-01/02/03/19/20 "yaşayan sokak" (sokak kipi): with the real iskele walk grid (the road closed, the footbridge open)
 * the pool covers the whole map: the promenade, the pier, the footbridge and the far side (karşı yaka). Data: content/sokak.ts.
 * - Day programme: the hour picks the goal (stroll, sit, wait at the stop/ferry, enter a door, cross to the other side,
 *   lean on the rail) and the citizen types (content/citizens hours/peak). Crossing the road is only by the footbridge.
 * - The pool size never changes; at night the surplus walks into a door and waits inside (not drawn), in the morning
 *   they come out of a door. Customers take inside walkers first, so no visible citizen vanishes. No teleport.
 * - Street roles from the same pool: jogger, fisherman, night watchman, street musician (listeners stop), dog walker
 *   (the dog is a sim follower, 1.2 m behind, at most 3 m away; drawn by view/disari/sokak-look.ts).
 * - Weather (sim/hava.ts havaSokak): rain/snow empties the benches and sends most walkers under awnings, the others
 *   open umbrellas; snow slows the step; heat sends some into tree shade.
 * - LOD: within 15 m LOD A (the crowd view draws those first), past 52 m hidden and stepped every 3rd tick (in slot order,
 *   deterministic), shown again under 46 m.
 */
import type { AmbientSystem, AnchorDef, Nav, Rect, Rng, SimCtx, SoAStore, Vec2, ZoneManager } from '../../engine/api';
import { AGENTS, AGENT_CAP, AGENT_SCHEMA, AGENT_FLAG, AGENT_LOD, ACT_ORDER, GAIT_ORDER, MOOD_ORDER, ZONE_ORDER } from './schema';
import { CITIZENS, CROWD_BUDGET } from '../../content/citizens';
import { BUFE as BUFE_BOX, BUFE_YEREL as BUFE_ON } from '../../content/prefabs/iskele/layout';
import {
  SOKAK_HAVUZ, SOKAK_LOD, SOKAK_YOGUNLUK, SOKAK_PROGRAM, SOKAK_YURU, SOKAK_KAPI, SOKAK_BEKLE, SOKAK_KORKULUK, SOKAK_SIGINAK, SOKAK_GOLGE,
  SOKAK_BANK, SOKAK_ROLLER, SOKAK_HAVA, SEMSIYE_ORAN, KOPEK, DINLE, UG_AYAK, bankOturak, bankOnu,
  type SokakHedef, type SokakNokta, type Yaka,
} from '../../content/sokak';
import { havaSokak } from './hava';
import { gecitAcik } from '../../content/kilitli-bolge';

export interface AmbientDeps {
  nav: Nav;
  anchors: ZoneManager['anchors'];
  /** Zones to populate (default ['iskele']). */
  zones?: string[];
  /** Pool size (default dengeli ambient + passers = 24; sokak kipi SOKAK_HAVUZ). */
  count?: number;
  /** Fallback wander area when a zone has no spawn/walk anchors. */
  area?: Rect;
  /** Spawn ramp: walkers added per second until the pool is full (default 4). */
  spawnRate?: number;
  /** DNY-01 whole-map street mode. Default: on when the iskele grid is the real one (road closed, footbridge open). */
  sokak?: boolean;
}

/** Walking speed per gait (m/s), matched to the animator stride * freq so feet do not skate. */
export const GAIT_SPEED: Record<(typeof GAIT_ORDER)[number], number> = {
  normal: 1.15, waddle: 0.75, brisk: 1.55, slow: 0.7, shuffle: 0.85, kid: 1.25, run: 2.8,
};

const ACT = (a: (typeof ACT_ORDER)[number]) => ACT_ORDER.indexOf(a);
const A_WALK = ACT('walk'), A_IDLE = ACT('idle'), A_SIT = ACT('sit'), A_PHONE = ACT('phone'), A_SIP = ACT('sip');
const A_FISH = ACT('fish'), A_READ = ACT('read'), A_PERFORM = ACT('play'), A_WAVE = ACT('wave');
const M_OK = MOOD_ORDER.indexOf('ok'), M_HAPPY = MOOD_ORDER.indexOf('happy');
const S_WALK = 0, S_PAUSE = 1, S_SIT = 2, S_IN = 4;
const DEFAULT_AREA: Rect = { x0: -16, z0: -13, x1: 16, z1: 10 };
const G_RUN = GAIT_ORDER.indexOf('run');
const Z_KARSI = ZONE_ORDER.indexOf('karsi');
const MOVE_SOLID = { solids: true };
/** BUF-25: seconds of game time for hunger to go 0 -> 1 at average appetite */
const AC_SURE = 150;

interface Walker {
  slot: number; zone: string; state: number; t: number; path: Vec2[]; wp: number; seat: number; speed: number; exit: boolean;
  /** sokak: occupied spot key ('' none), role index (-1 none), route index, stuck timer, seat (final off-grid leg), act on arrival */
  spot?: string; rol?: number; ri?: number; stuck?: number; oturak?: { x: number; z: number; rot: number } | null; varis?: number; varisRot?: number; kal?: number;
  dog?: { x: number; z: number; rot: number; speed: number; ad: number } | null; dinle?: number; gizli?: boolean;
  /** sokak: seconds of free stepping (no grid collision): getting up from a bench, out of a corner; tries = unstick count on this path */
  free?: number; tries?: number;
  /** BUF-25: hunger 0..1+, rises with game time; >= 1 = wants to eat at a shop */ ac?: number; acHiz?: number; /** BUF-25: walking to a shop door to visit it (exit = true: goes inside on arrival) */ visit?: boolean;
}

/** View-facing street state per agent slot (DNY-02/19): role, umbrella, dog follower. Read by view/disari/sokak-look.ts. */
export interface SokakDurum {
  /** role index + 1 per slot (0 none), see content/sokak SOKAK_ROLLER */ rol: Uint8Array;
  /** 1 = umbrella open (walking in the rain) */ semsiye: Uint8Array;
  /** dog per slot: x, z, rot, speed (NaN x = no dog) */ kopek: Float32Array;
  /** dog name/colour index per slot */ kopekAd: Uint8Array;
  wet: boolean; hour: number;
}
const DURUM = new WeakMap<SoAStore, SokakDurum>();
/** The street state written by the ambient system into this agents store (null before sokak kipi runs). */
export const sokakDurum = (store: SoAStore | null | undefined): SokakDurum | null => (store ? DURUM.get(store) ?? null : null);

const lerpTab = (tab: [number, number][], h: number): number => {
  if (h <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (h <= tab[i][0]) { const [a, va] = tab[i - 1], [b, vb] = tab[i]; return va + (vb - va) * (h - a) / (b - a); }
  return tab[tab.length - 1][1];
};
/** content hours use 0..24; the game clock runs 8..27 (24+ after midnight): until-midnight types fade on after 24 */
const inSpans = (spans: [number, number][], h: number): number => {
  for (const [a, b] of spans) { if (h >= a && h < b) return 1; if (b >= 24 && h >= 24 && h < 27) return 0.5; }
  return 0;
};
const inRol = (spans: [number, number][], h: number) => spans.some(([a, b]) => h >= a && h < b);
const yakaOf = (p: Vec2): Yaka => (p.z > 20 ? 'k' : 'i');

export function createAmbient(deps: AmbientDeps): AmbientSystem {
  const zones = deps.zones && deps.zones.length ? deps.zones.slice() : ['iskele'];
  const area = deps.area ?? DEFAULT_AREA;
  const spawnRate = deps.spawnRate ?? 4;
  const walkers = new Map<number, Walker>();
  const recruited = new Set<number>();
  const seatTaken = new Map<string, number>();     // "zone:anchorId" -> slot (sokak: any spot key)
  let target = deps.count ?? (CROWD_BUDGET.dengeli.ambient + CROWD_BUDGET.dengeli.passers);
  let spawnAcc = target;                           // the first tick fills the pool at once, inside the wander area
  let filled = false;
  let store: SoAStore | null = null;
  const tmp: Vec2 = { x: 0, z: 0 }, sep: Vec2 = { x: 0, z: 0 };
  const hash = deps.nav.hash(1);
  const nbr: number[] = [];
  let sokak: boolean | null = deps.sokak ?? null;  // decided on the first step
  let durum: SokakDurum | null = null;
  const hero: Vec2 = { x: 0, z: 0 };
  let hour = 12, wet = false, kar = false, sicak = false, tick = 0;

  // Candidate types: no scenery stands (they belong to props), weighted by v2 `w`.
  const pool = CITIZENS.map((c, i) => ({ i, w: c.scenery ? 0 : c.w })).filter((p) => p.w > 0);
  const poolW = pool.reduce((s, p) => s + p.w, 0);
  const pickType = (rng: Rng) => {
    let r = rng.next() * poolW;
    for (const p of pool) { r -= p.w; if (r <= 0) return p.i; }
    return pool[pool.length - 1].i;
  };
  /** sokak: types by the hour (content hours/peak); street-role types (oltacı, müzisyen...) come only as roles */
  const ROL_TIP = new Set(SOKAK_ROLLER.map(r => r.tip).filter(t => CITIZENS.find(c => c.id === t)?.scenery));
  const typeWeight = (i: number, h: number) => {
    const c = CITIZENS[i];
    if (c.scenery || ROL_TIP.has(c.id) || c.id === 'kestaneci') return 0;
    const inH = inSpans(c.hours, h);
    return c.w * (inH ? inH * (inSpans(c.peak, h) ? 2 : 1) : 0.04);
  };
  const pickTypeHour = (rng: Rng, h: number) => {
    let tot = 0; for (let i = 0; i < CITIZENS.length; i++) tot += typeWeight(i, h);
    let r = rng.next() * tot;
    for (let i = 0; i < CITIZENS.length; i++) { r -= typeWeight(i, h); if (r <= 0 && typeWeight(i, h) > 0) return i; }
    return pool[0].i;
  };

  const anchorsOf = (zone: string): { id: string; a: AnchorDef }[] => {
    let rec: Record<string, AnchorDef> | undefined;
    try { rec = deps.anchors(zone); } catch { rec = undefined; }
    if (!rec) return [];
    return Object.keys(rec).sort().map((id) => ({ id, a: rec![id] }));
  };
  const isKind = (a: AnchorDef, ...k: string[]) => (a.kind && k.includes(a.kind)) || (a.tags ?? []).some((t) => k.includes(t));

  // Citizens never walk into the büfe: its interior is staff only (owner: only workers and the player go in and out).
  // Ambient targets are filtered here; the kiosk walls and the single door are solid in the walk grid.
  const icK = (B: { x0: number; x1: number; z0: number; z1: number }, p: Vec2) => p.x > B.x0 - 0.5 && p.x < B.x1 + 0.5 && p.z > B.z0 - 0.5 && p.z < B.z1 + 0.5;
  const insideBufe = (p: Vec2): boolean => icK(BUFE_BOX, p) || icK(BUFE_ON, p);   // 2026-11-22: from stage 6 the büfe (restaurant front hall) is at the v2 spot
  const randomPoint = (zone: string, rng: Rng, out: Vec2, spawn: boolean): Vec2 => {
    const list = anchorsOf(zone).filter(({ id, a }) => id !== 'playerStart' && !insideBufe(a.pos) && (spawn ? isKind(a, 'spawn', 'walkway', 'door') : isKind(a, 'walkway', 'decor', 'marker', 'perch')));
    if (list.length && rng.chance(spawn ? 0.85 : 0.5)) {
      const { a } = list[rng.int(0, list.length - 1)];
      out.x = a.pos.x + rng.range(-0.6, 0.6); out.z = a.pos.z + rng.range(-0.6, 0.6);
    } else {
      for (let k = 0; k < 12; k++) {
        out.x = rng.range(area.x0, area.x1); out.z = rng.range(area.z0, area.z1);
        if (deps.nav.walkable(out)) break;
      }
    }
    if (!deps.nav.walkable(out)) deps.nav.nearestWalkable(out, out);
    return out;
  };

  /** Seat anchors when the zone has them, else whole benches. */
  const seatsOf = (zone: string) => {
    const all = anchorsOf(zone);
    // 2026-11-21: from stage 3 the walkway behind the büfe is the roofed staff passage to the kitchen (view bufe-buyume.ts GECIT): its
    // bench is the staff's, citizens do not sit there. The passage exists when its closed east wall blocks the walk grid.
    const gecit = !deps.nav.walkable({ x: BUFE_BOX.x1 - 0.05, z: -12.7 });   // 2026-11-22: the büfe moved to the pier mouth; only the kitchen front strip
    const ok = ({ a }: { a: AnchorDef }) => !gecit || !(a.pos.x > BUFE_BOX.x0 && a.pos.x < BUFE_BOX.x1 && a.pos.z > -13.0 && a.pos.z < -12.4);
    const seats = all.filter((e) => isKind(e.a, 'seat') && ok(e));
    return seats.length ? seats : all.filter((e) => isKind(e.a, 'bench') && ok(e));
  };
  const exitsOf = (zone: string) => anchorsOf(zone).filter(({ id, a }) => isKind(a, 'spawn') && id !== 'playerStart');

  const plan = (w: Walker, rng: Rng, X: Float32Array, Z: Float32Array) => {
    if (sokak) { planSokak(w, rng, X, Z); return; }
    w.wp = 0;
    w.state = S_WALK;
    w.exit = false;
    const from = { x: X[w.slot], z: Z[w.slot] };
    const r = rng.next();
    // 30%: head for a free seat if the zone has one.
    if (r < 0.3) {
      const seats = seatsOf(w.zone);
      const freeSeats = seats.filter(({ id }) => !seatTaken.has(w.zone + ':' + id));
      if (freeSeats.length) {
        const s = freeSeats[rng.int(0, freeSeats.length - 1)];
        const p = deps.nav.path(from, s.a.pos);
        if (p.length) { w.path = p; w.seat = seats.indexOf(s); seatTaken.set(w.zone + ':' + s.id, w.slot); return; }
      }
    } else if (r < 0.42) {
      // 12%: a passer leaves through a zone edge; the ramp brings a new one in from another edge.
      const ex = exitsOf(w.zone);
      if (ex.length) {
        const e = ex[rng.int(0, ex.length - 1)];
        const p = deps.nav.path(from, e.a.pos, { maxNodes: 20000 });
        if (p.length) { w.path = p; w.seat = -1; w.exit = true; return; }
      }
    }
    w.seat = -1;
    const to = randomPoint(w.zone, rng, { x: 0, z: 0 }, false);
    const p = deps.nav.path(from, to);
    w.path = p.length ? p : [to];
  };

  // ───────────────────────── sokak kipi (DNY-01) ─────────────────────────
  let gecitOk = true;
  /** Path between any two points of the map; the road is crossed only on the footbridge (both flights walked). */
  const route = (from: Vec2, to: Vec2): Vec2[] => {
    const a = yakaOf(from), b = yakaOf(to);
    if (a === b) return deps.nav.path(from, to, { maxNodes: 20000 });
    if (!gecitOk) return [];   // 2026-11-21: üst geçidin ortası inşaatta (content/kilitli-bolge UST_GECIT): karşıya yol yok
    const p1 = deps.nav.path(from, UG_AYAK[a], { maxNodes: 20000 }), p2 = deps.nav.path(UG_AYAK[b], to, { maxNodes: 20000 });
    if (!p1.length || !p2.length) return [];
    return [...p1, { x: UG_AYAK[b].x, z: UG_AYAK[b].z }, ...p2];
  };
  const pickFree = (rng: Rng, list: SokakNokta[], key: string, near?: Vec2, cap = 1): { p: SokakNokta; k: string } | null => {
    const free: number[] = [];
    for (let i = 0; i < list.length * cap; i++) if (!seatTaken.has(key + i)) free.push(i);
    if (!free.length) return null;
    // prefer the nearer half of the free spots (people do not cross the whole map to shelter from the rain)
    const L = (i: number) => list[i % list.length];
    if (near && free.length > 2) { free.sort((i, j) => Math.hypot(L(i).x - near.x, L(i).z - near.z) - Math.hypot(L(j).x - near.x, L(j).z - near.z) || i - j); free.length = Math.ceil(free.length / 2); }
    const i = free[rng.int(0, free.length - 1)], p = L(i);
    if (i < list.length) return { p, k: key + i };
    // a second person at the same spot stands 0.6 m beside the first, along the façade (rot = facing)
    const r = p.rot ?? 0, o = { ...p, x: p.x + Math.cos(r) * 0.6, z: p.z - Math.sin(r) * 0.6 };
    return { p: deps.nav.walkable(o) ? o : { ...p, x: p.x - Math.cos(r) * 0.6, z: p.z + Math.sin(r) * 0.6 }, k: key + i };
  };
  const goTo = (w: Walker, from: Vec2, to: Vec2, opt: { spot?: string; varis?: number; rot?: number; kal?: [number, number]; oturak?: { x: number; z: number; rot: number } | null; exit?: boolean } , rng: Rng): boolean => {
    const p = route(from, to);
    if (!p.length) return false;
    if (opt.oturak) p.push({ x: opt.oturak.x, z: opt.oturak.z });   // final leg off the grid onto the bench
    w.path = p; w.wp = 0; w.state = S_WALK; w.exit = !!opt.exit; w.seat = -1;
    w.spot = opt.spot ?? ''; if (w.spot) seatTaken.set(w.spot, w.slot);
    w.varis = opt.varis ?? -1; w.varisRot = opt.rot; w.oturak = opt.oturak ?? null;
    w.kal = opt.kal ? rng.range(opt.kal[0], opt.kal[1]) : rng.range(0.8, 4.5);
    w.stuck = 0; w.tries = 0;
    return true;
  };
  const randomOf = (rng: Rng, list: SokakNokta[], jitter = 0.6): Vec2 => {
    const p = list[rng.int(0, list.length - 1)], out = { x: p.x + rng.range(-jitter, jitter), z: p.z + rng.range(-jitter, jitter) };
    if (!deps.nav.walkable(out)) { out.x = p.x; out.z = p.z; }
    return out;
  };
  const rolCount = (ri: number) => { let n = 0; for (const w of walkers.values()) if (w.rol === ri && w.state !== S_IN) n++; return n; };

  function planSokak(w: Walker, rng: Rng, X: Float32Array, Z: Float32Array) {
    releaseSeat(w);
    const from = { x: X[w.slot], z: Z[w.slot] };
    const ty = CITIZENS[store!.u8('typeId')[w.slot]];
    // a role whose hours ended, a type out of its hours, or a surplus over the hour's density: home through a door
    const rol = w.rol ?? -1, R = rol >= 0 ? SOKAK_ROLLER[rol] : null;
    const off = R ? !inRol(R.saat, hour) : ty && !inSpans(ty.hours, hour) && rng.chance(0.5);
    const surplus = activeCount() - desired();
    if (off || (surplus > 0 && rng.chance(Math.min(0.9, 0.25 + surplus * 0.1)))) {
      const d = pickNear(rng, SOKAK_KAPI, from);
      if (goTo(w, from, d, { exit: true }, rng)) return;
    }
    if (R) { if (planRol(w, R, rng, from)) return; }
    else if (wet && rng.chance(SOKAK_HAVA.siginak)) {
      const s = pickFree(rng, SOKAK_SIGINAK, 'sig:', from, 2);
      if (s && goTo(w, from, s.p, { spot: s.k, rot: s.p.rot, kal: [8, 16], varis: A_IDLE }, rng)) return;
    } else if (!wet) {
      const band = SOKAK_PROGRAM.find(b => hour >= b.saat[0] && hour < b.saat[1]) ?? SOKAK_PROGRAM[0];
      const wt: Partial<Record<SokakHedef, number>> = { ...band.w };
      if (sicak) wt.golge = SOKAK_HAVA.golge;
      const g = rng.weighted(wt);
      if (g === 'otur') {
        const seat = pickSeat(rng, from);
        if (seat && goTo(w, from, seat.onu, { spot: seat.k, oturak: seat.o, rot: seat.o.rot, kal: [8, 22], varis: rng.chance(0.35) ? A_READ : rng.chance(0.45) ? A_SIP : A_SIT }, rng)) return;
      } else if (g === 'bekle') {
        const s = pickFree(rng, SOKAK_BEKLE, 'bek:');
        if (s && goTo(w, from, s.p, { spot: s.k, rot: s.p.rot, kal: [6, 18], varis: rng.chance(0.5) ? A_PHONE : A_IDLE }, rng)) return;
      } else if (g === 'kapi') {
        if (goTo(w, from, randomOf(rng, SOKAK_KAPI, 0), { exit: true }, rng)) return;
      } else if (g === 'karsi') {
        const other = SOKAK_YURU.filter(p => p.yaka !== yakaOf(from));
        if (other.length && goTo(w, from, randomOf(rng, other), {}, rng)) return;
      } else if (g === 'korkuluk') {
        const s = pickFree(rng, SOKAK_KORKULUK, 'kor:');
        if (s && goTo(w, from, s.p, { spot: s.k, rot: s.p.rot, kal: [5, 14], varis: rng.chance(0.3) ? A_PHONE : A_IDLE }, rng)) return;
      } else if (g === 'golge') {
        const s = pickFree(rng, SOKAK_GOLGE, 'gol:', from);
        if (s && goTo(w, from, s.p, { spot: s.k, kal: [8, 16], varis: A_IDLE }, rng)) return;
      }
    }
    // stroll (also the fallback): mostly on the same side, a walkway point
    if (goTo(w, from, randomOf(rng, yakin(from)), { varis: rng.chance(0.2) ? A_PHONE : A_IDLE }, rng)) return;
    // nothing reachable from here (pushed into a corner): stand a moment, try again
    w.path = []; w.state = S_PAUSE; w.t = 1;
  }
  /** stroll targets: walkway points on this side within 32 m (a stroll, not a trek; a slow dede walks 0.7 m/s) */
  const yakin = (from: Vec2): SokakNokta[] => {
    const side = SOKAK_YURU.filter(p => p.yaka === yakaOf(from)), near = side.filter(p => Math.hypot(p.x - from.x, p.z - from.z) < 32 && Math.hypot(p.x - from.x, p.z - from.z) > 3);
    return near.length >= 2 ? near : side.length ? side : SOKAK_YURU;
  };
  /** walking distance estimate: straight on the same side, over the footbridge to the other */
  const yolU = (a: Vec2, b: Vec2) => { const ya = yakaOf(a), yb = yakaOf(b); return ya === yb ? Math.hypot(a.x - b.x, a.z - b.z) : Math.hypot(a.x - UG_AYAK[ya].x, a.z - UG_AYAK[ya].z) + 26 + Math.hypot(b.x - UG_AYAK[yb].x, b.z - UG_AYAK[yb].z); };
  const pickNear = (rng: Rng, list: SokakNokta[], from: Vec2): Vec2 => {
    const idx = list.map((_, i) => i).sort((i, j) => yolU(from, list[i]) - yolU(from, list[j]) || i - j);
    const p = list[idx[rng.int(0, Math.min(2, idx.length - 1))]];
    return { x: p.x, z: p.z };
  };
  /** a free seat: zone seat anchors (iskele benches) or a karşı yaka bench (off-grid seat, approach in front) */
  function pickSeat(rng: Rng, from: Vec2): { k: string; onu: Vec2; o: { x: number; z: number; rot: number } } | null {
    const cand: { k: string; onu: Vec2; o: { x: number; z: number; rot: number } }[] = [];
    const seats = seatsOf(zones[0]);
    for (const s of seats) { const k = zones[0] + ':' + s.id; if (!seatTaken.has(k)) cand.push({ k, onu: s.a.pos, o: { x: s.a.pos.x, z: s.a.pos.z, rot: s.a.rotY ?? 0 } }); }
    SOKAK_BANK.forEach((b, i) => { for (let j = 0; j < 2; j++) { const k = 'bank:' + i + ':' + j; if (!seatTaken.has(k)) cand.push({ k, onu: bankOnu(b, j), o: bankOturak(b, j) }); } });
    if (!cand.length) return null;
    // same side first (a seat is a short detour, not a trip over the bridge)
    const side = cand.filter(c => yakaOf(c.onu) === yakaOf(from));
    const list = side.length && rng.chance(0.85) ? side : cand;
    return list[rng.int(0, list.length - 1)];
  }
  function planRol(w: Walker, R: (typeof SOKAK_ROLLER)[number], rng: Rng, from: Vec2): boolean {
    if (R.rota) {   // jogger: the loop, a stretch on a bench now and then
      w.ri = ((w.ri ?? -1) + 1) % R.rota.length;
      const p = R.rota[w.ri];
      return goTo(w, from, p, { varis: A_IDLE, kal: rng.chance(0.25) ? [3, 7] : [0.1, 0.3] }, rng);
    }
    if (R.durak) {
      const key = 'rol:' + R.id + ':';
      const s = R.id === 'bekci' ? (() => { w.ri = ((w.ri ?? rng.int(0, R.durak!.length - 1)) + 1) % R.durak!.length; return { p: R.durak![w.ri], k: '' }; })() : pickFree(rng, R.durak, key);
      if (!s) return false;
      const act = R.id === 'balikci' ? A_FISH : R.id === 'muzisyen' ? A_PERFORM : A_IDLE;
      return goTo(w, from, s.p, { spot: s.k, rot: s.p.rot, kal: R.kal ?? [3, 6], varis: act }, rng);
    }
    // dog walker: strolls the promenade or the square with the dog
    return goTo(w, from, randomOf(rng, yakin(from)), { varis: A_IDLE, kal: [2, 5] }, rng);
  }

  function desired(): number { return Math.round(target * lerpTab(SOKAK_YOGUNLUK, hour)); }
  function activeCount(): number { let n = 0; for (const w of walkers.values()) if (w.state !== S_IN) n++; return n; }

  /** sokak: a walker leaves the street through a door (kept in the pool, not drawn, recruitable) */
  function goInside(s: SoAStore, w: Walker) {
    releaseSeat(w);
    w.state = S_IN; w.t = 0; w.path = []; w.wp = 0; w.exit = false; w.rol = -1; w.dog = null; w.oturak = null;
    s.u16('flags')[w.slot] = AGENT_FLAG.ambient;   // not visible
    s.f32('speed')[w.slot] = 0;
    s.u8('act')[w.slot] = A_IDLE;
  }
  /** sokak: an inside walker comes out of a door, with a type (and maybe a street role) for the hour */
  function comeOut(s: SoAStore, w: Walker, rng: Rng, at: Vec2 | null, rol = -1) {
    w.visit = false;
    const i = w.slot;
    const ty = rol >= 0 ? Math.max(0, CITIZENS.findIndex(c => c.id === SOKAK_ROLLER[rol].tip)) : pickTypeHour(rng, hour);
    const def = CITIZENS[ty];
    const p = at ?? randomOf(rng, SOKAK_KAPI, 0);
    const gait = rol >= 0 && SOKAK_ROLLER[rol].id === 'kosucu' ? G_RUN : Math.max(0, GAIT_ORDER.indexOf((def.gait ?? 'normal') as (typeof GAIT_ORDER)[number]));
    s.f32('x')[i] = s.f32('px')[i] = p.x; s.f32('z')[i] = s.f32('pz')[i] = p.z;
    s.f32('speed')[i] = 0; s.u8('gait')[i] = gait; s.u8('act')[i] = A_IDLE; s.u8('typeId')[i] = ty;
    s.u8('mood')[i] = rng.chance(0.3) ? M_HAPPY : M_OK; s.u8('expr')[i] = 0; s.u8('carry')[i] = 0;
    s.u8('zone')[i] = p.z > 20 && Z_KARSI >= 0 ? Z_KARSI : 0;
    s.u16('flags')[i] = AGENT_FLAG.ambient | (w.gizli ? 0 : AGENT_FLAG.visible);
    w.state = S_PAUSE; w.t = rng.range(0.2, 1.2); w.path = []; w.wp = 0; w.rol = rol; w.ri = -1; w.stuck = 0; w.dinle = 0;
    w.speed = GAIT_SPEED[GAIT_ORDER[gait]] * rng.range(0.9, 1.1);
    w.dog = rol >= 0 && SOKAK_ROLLER[rol].id === 'kopekli' ? { x: p.x, z: p.z - KOPEK.geri, rot: 0, speed: 0, ad: rng.int(0, KOPEK.adlar.length - 1) } : null;
  }

  const releaseSeat = (w: Walker) => {
    for (const [k, v] of seatTaken) if (v === w.slot) seatTaken.delete(k);
    w.seat = -1; w.spot = '';
  };

  const spawn = (s: SoAStore, rng: Rng): Walker | null => {
    const slot = s.alloc();
    if (slot < 0) return null;
    const zone = zones[rng.int(0, zones.length - 1)];
    const ty = pickType(rng);
    const def = CITIZENS[ty];
    const p = randomPoint(zone, rng, { x: 0, z: 0 }, filled);
    const gait = Math.max(0, GAIT_ORDER.indexOf((def.gait ?? 'normal') as (typeof GAIT_ORDER)[number]));
    s.f32('x')[slot] = s.f32('px')[slot] = p.x;
    s.f32('z')[slot] = s.f32('pz')[slot] = p.z;
    s.f32('rot')[slot] = s.f32('prot')[slot] = rng.range(-Math.PI, Math.PI);
    s.f32('speed')[slot] = 0;
    s.u8('gait')[slot] = gait;
    s.u8('act')[slot] = A_IDLE;
    s.u8('mood')[slot] = rng.chance(0.3) ? M_HAPPY : M_OK;
    s.u8('expr')[slot] = 0;
    s.u8('carry')[slot] = 0;
    s.u8('typeId')[slot] = ty;
    s.u8('lod')[slot] = AGENT_LOD.B;
    s.u8('zone')[slot] = Math.max(0, ZONE_ORDER.indexOf(zone as (typeof ZONE_ORDER)[number]));
    s.u16('flags')[slot] = AGENT_FLAG.visible | AGENT_FLAG.ambient;
    const w: Walker = {
      slot, zone, state: S_PAUSE, t: rng.range(0, 1.5), path: [], wp: 0, seat: -1, exit: false,
      speed: GAIT_SPEED[GAIT_ORDER[gait]] * rng.range(0.9, 1.1),
    };
    walkers.set(slot, w);
    return w;
  };

  const despawn = (s: SoAStore, w: Walker) => {
    releaseSeat(w);
    walkers.delete(w.slot);
    if (s.alive(w.slot)) { s.u16('flags')[w.slot] = 0; s.free(w.slot); }
  };

  /** sokak: fill the whole pool at once; the hour's share is on the walkways, the rest inside */
  function fillSokak(s: SoAStore, rng: Rng) {
    const n = desired();
    while (walkers.size < target) {
      const slot = s.alloc();
      if (slot < 0) break;
      s.f32('rot')[slot] = s.f32('prot')[slot] = rng.range(-Math.PI, Math.PI);
      s.u8('lod')[slot] = AGENT_LOD.B;
      const w: Walker = { slot, zone: zones[0], state: S_IN, t: 0, path: [], wp: 0, seat: -1, exit: false, speed: 1.1, rol: -1 };
      walkers.set(slot, w);
      if (walkers.size <= n) comeOut(s, w, rng, randomOf(rng, SOKAK_YURU, 1.2));
      else goInside(s, w);
    }
  }

  function decideSokak(): boolean {
    if (zones.length !== 1 || zones[0] !== 'iskele') return false;
    const a = anchorsOf('iskele');
    if (!a.some(e => e.id === 'spawn.0')) return false;
    const nav = deps.nav;
    // köprü koridoru güvertenin ilk açıklığında yoklanır (z 16): orta açıklık inşaatta ızgarada kapalı olabilir
    return !nav.walkable({ x: 0, z: 20 }) && nav.walkable({ x: UG_AYAK.i.x, z: 16 }) && nav.walkable({ x: -3.9, z: 40 }) && nav.walkable(UG_AYAK.k);
  }

  const sys: AmbientSystem = {
    id: 'ambient', order: 20, phase: 'sim',
    step(ctx: SimCtx) {
      const s = store ?? (store = ctx.world.soa(AGENTS, AGENT_CAP, AGENT_SCHEMA));
      const rng = ctx.rng.stream('ambient');
      gecitOk = gecitAcik(ctx.state);
      const dt = ctx.dt;
      const X = s.f32('x'), Z = s.f32('z'), R = s.f32('rot'), SP = s.f32('speed');
      const act = s.u8('act'), flags = s.u16('flags'), lod = s.u8('lod');
      tick++;
      if (sokak === null) {
        sokak = decideSokak();
        if (sokak) { target = deps.count ?? SOKAK_HAVUZ; durum = { rol: new Uint8Array(AGENT_CAP), semsiye: new Uint8Array(AGENT_CAP), kopek: new Float32Array(AGENT_CAP * 4).fill(NaN), kopekAd: new Uint8Array(AGENT_CAP), wet: false, hour: 12 }; DURUM.set(s, durum); }
      }
      if (sokak) {
        hour = ctx.clock?.hour ?? 12;
        const st = ctx.state as unknown as { player?: { x: number; z: number }; zones?: unknown; day?: number } | undefined;
        if (st?.player) { hero.x = st.player.x; hero.z = st.player.z; }
        const hv = st ? havaSokak(st, hour) : null;
        wet = !!hv?.wet; kar = !!hv?.kar; sicak = !!hv?.sicak;
        if (durum) {
          // rain starts: the walkers (not the roles) rethink now, most run for an awning
          if (wet && !durum.wet) for (const w of walkers.values()) if (w.state !== S_IN && !w.visit && (w.rol ?? -1) < 0 && !(w.spot ?? '').startsWith('sig:')) { if (w.state === S_WALK) { w.path = []; w.wp = 0; } else w.t = 0; }
          durum.wet = wet; durum.hour = hour;
        }
        if (walkers.size < target && !filled) fillSokak(s, rng);
        // come out of a door while the street is under the hour's density (one per 1/spawnRate s)
        if (filled && activeCount() < desired()) {
          spawnAcc += dt * spawnRate * 0.25;
          if (spawnAcc >= 1) {
            spawnAcc = 0;
            for (const w of walkers.values()) if (w.state === S_IN && !recruited.has(w.slot)) { comeOut(s, w, rng, null); break; }
          }
        }
        // street roles (DNY-02): in their hours each role is filled from the inside walkers, out of a door
        if (filled && tick % 60 === 0) for (let r = 0; r < SOKAK_ROLLER.length; r++) {
          if (!inRol(SOKAK_ROLLER[r].saat, hour) || rolCount(r) >= SOKAK_ROLLER[r].adet) continue;
          for (const w of walkers.values()) if (w.state === S_IN) { comeOut(s, w, rng, null, r); break; }
        }
      } else if (walkers.size < target) {
        // Ramp the pool up to its size.
        spawnAcc += dt * spawnRate;
        while (spawnAcc >= 1 && walkers.size < target) { spawnAcc -= 1; if (!spawn(s, rng)) { spawnAcc = 0; break; } }
      } else spawnAcc = 0;
      filled = true;

      hash.clear();
      for (const w of walkers.values()) if (w.state !== S_IN) hash.insert(w.slot, X[w.slot], Z[w.slot]);

      for (const w of walkers.values()) {
        const i = w.slot;
        if (!s.alive(i)) { walkers.delete(i); continue; }
        if (w.state === S_IN) continue;
        let sdt = dt;
        if (sokak) {
          // LOD (DNY-20): distance to the hero; far walkers hidden and stepped every 3rd tick (slot order, deterministic)
          const d = Math.hypot(X[i] - hero.x, Z[i] - hero.z);
          lod[i] = d <= SOKAK_LOD.yakin ? AGENT_LOD.A : d <= SOKAK_LOD.goster ? AGENT_LOD.B : AGENT_LOD.C;
          if (!w.gizli && d > SOKAK_LOD.gizle) { w.gizli = true; flags[i] &= ~AGENT_FLAG.visible; }
          else if (w.gizli && d < SOKAK_LOD.goster) { w.gizli = false; flags[i] |= AGENT_FLAG.visible; }
          if (w.gizli) { if ((tick + i) % SOKAK_LOD.seyrek) continue; sdt = dt * SOKAK_LOD.seyrek; }
          if (durum) durum.semsiye[i] = wet && w.state === S_WALK && !w.spot && (i * 7 + 3) % 10 < SEMSIYE_ORAN * 10 ? 1 : 0;
          if (wet && w.state === S_SIT) w.t = 0;   // rain: the benches empty
          if ((w.rol ?? -1) >= 0 && !w.exit && !inRol(SOKAK_ROLLER[w.rol!].saat, hour)) {   // a role's hours ended: pack up now and head home
            if (w.state === S_WALK) { w.path = []; w.wp = 0; w.varis = A_IDLE; w.kal = 0.1; w.oturak = null; } else w.t = Math.min(w.t, 0);
          }
        }
        if (w.ac === undefined) { w.acHiz = rng.range(0.6, 1.4); w.ac = rng.range(0, 0.6); }   // BUF-25: each citizen has own appetite, deterministic (ambient stream)
        w.ac += sdt * w.acHiz! / AC_SURE;
        w.t -= sdt;
        if (w.state === S_PAUSE || w.state === S_SIT) {
          SP[i] = 0;
          if (sokak && w.dog) stepDog(w, i, sdt);
          if (w.t <= 0) {
            if (w.state === S_SIT) { releaseSeat(w); flags[i] &= ~AGENT_FLAG.seated; standUp(w, i); }
            plan(w, rng, X, Z);
            if ((w.state as number) === S_WALK) act[i] = A_WALK;
            else if ((w.state as number) !== S_SIT && (act[i] === A_READ || act[i] === A_SIP || act[i] === A_SIT)) act[i] = A_IDLE;   // stood up: no newspaper/cup left in a standing pose
          } else if (sokak && w.rol !== undefined && w.rol >= 0 && SOKAK_ROLLER[w.rol].id === 'muzisyen' && act[i] === A_PERFORM) listeners(w, i, rng);
          continue;
        }
        if (w.state !== S_WALK) continue;
        const wp = w.path[w.wp];
        if (!wp) { arrive(w, i); continue; }
        const dx = wp.x - X[i], dz = wp.z - Z[i];
        const d = Math.hypot(dx, dz);
        const v = w.speed * (sokak && kar ? SOKAK_HAVA.kar : 1) * (sokak && wet && !kar && !w.spot && w.state === S_WALK && durum && !durum.semsiye[i] ? SOKAK_HAVA.kos : 1);
        const stepLen = v * sdt;
        const finalLeg = !!w.oturak && w.wp === w.path.length - 1;
        if (d <= (sokak ? stepLen + 1e-4 : Math.max(0.08, stepLen))) {   // sokak: never more than one step a tick (no stride flicker)
          X[i] = wp.x; Z[i] = wp.z;
          w.wp++;
          if (w.wp >= w.path.length) arrive(w, i);
          SP[i] = d / Math.max(1e-4, sdt);
          continue;
        }
        let vx = dx / d, vz = dz / d;
        // Light separation so strollers do not overlap; walkers on the last leg into a seat skip it.
        // sokak: the last 1.6 m to a spot skip it too (a bench neighbour or the next one at the stop must not push it away)
        if (w.seat < 0 && !finalLeg && !(sokak && w.wp >= w.path.length - 2 && d < 1.6)) {
          nbr.length = 0;
          deps.nav.steering.separate(s, hash, i, sep);
          vx += sep.x * 0.6; vz += sep.z * 0.6;
          const m = Math.hypot(vx, vz) || 1; vx /= m; vz /= m;
        }
        tmp.x = X[i] + vx * stepLen; tmp.z = Z[i] + vz * stepLen;
        const from = { x: X[i], z: Z[i] };
        // off the grid (getting up from a solid bench, or pushed into a wall cell) the walker steps out freely to its next point
        // the string-pulled path is clear for a point; the 0.2 m body can catch a corner cell, then it steps freely a moment
        // (the centre still never enters a solid cell); off the grid (a bench seat) it walks out freely
        const thin = (w.free ?? 0) > 0;
        if (w.free) w.free = Math.max(0, w.free - sdt);
        if (!finalLeg && (!sokak || deps.nav.walkable(from))) {
          const tx = tmp.x, tz = tmp.z;
          deps.nav.move(from, tmp, thin ? 0.02 : 0.2, tmp, sokak && !thin ? MOVE_SOLID : undefined);   // sokak: exact wall faces (no corner clipping)
          // grid move lets a body that already touches a solid cell pass freely: the centre must stay on walkable cells
          if (sokak && !deps.nav.walkable(tmp)) {
            if (deps.nav.walkable({ x: tx, z: from.z })) { tmp.x = tx; tmp.z = from.z; }
            else if (deps.nav.walkable({ x: from.x, z: tz })) { tmp.x = from.x; tmp.z = tz; }
            else { tmp.x = from.x; tmp.z = from.z; }
          }
        }
        X[i] = tmp.x; Z[i] = tmp.z;
        const moved = Math.hypot(tmp.x - from.x, tmp.z - from.z);
        SP[i] = moved / Math.max(1e-4, sdt);
        const want = Math.atan2(vx, vz);
        let da = want - R[i];
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        R[i] += da * Math.min(1, sdt * 8);
        act[i] = A_WALK;
        if (sokak) {
          if (w.dog) stepDog(w, i, sdt);
          // stuck against a wall or in a jam (moves under a fifth of its step for 1.5 s): plan again from here
          w.stuck = moved < stepLen * 0.2 ? (w.stuck ?? 0) + sdt : 0;
          if ((w.stuck ?? 0) > 0.6) {
            w.stuck = 0; w.tries = (w.tries ?? 0) + 1;
            if (w.tries <= 3) w.free = 0.7;
            else { w.tries = 0; releaseSeat(w); w.oturak = null; w.path = []; w.state = S_PAUSE; w.t = 0.4; act[i] = A_IDLE; SP[i] = 0; }   // give up this goal
          }
        }
      }

      function arrive(w: Walker, i: number) {
        SP[i] = 0;
        if (w.exit) { if (sokak) goInside(s, w); else despawn(s, w); return; }
        if (sokak) {
          if (typeof w.varisRot === 'number') R[i] = w.varisRot;
          const a = w.varis ?? A_IDLE;
          if (w.oturak) {
            w.state = S_SIT; w.t = w.kal ?? 12; act[i] = a === A_READ || a === A_SIP ? a : A_SIT; flags[i] |= AGENT_FLAG.seated; return;
          }
          w.state = S_PAUSE; w.t = w.kal ?? 2; act[i] = a >= 0 ? a : A_IDLE;
          return;
        }
        if (w.seat >= 0) {
          const seats = seatsOf(w.zone);
          const a = seats[w.seat]?.a;
          if (a && typeof a.rotY === 'number') R[i] = a.rotY;
          w.state = S_SIT; w.t = rng.range(8, 22);
          act[i] = rng.chance(0.4) ? A_SIP : A_SIT;
          flags[i] |= AGENT_FLAG.seated;
          return;
        }
        w.state = S_PAUSE;
        w.t = rng.range(0.8, 4.5);
        act[i] = rng.chance(0.2) ? A_PHONE : A_IDLE;
      }
      /** off a bench: the next plan starts from the seat; the first leg walks out of the (solid) bench cell freely */
      function standUp(w: Walker, _i: number) { w.oturak = null; w.free = 0.8; }
      function stepDog(w: Walker, i: number, sdt: number) {
        const g = w.dog!; const back = KOPEK.geri;
        const tx = X[i] - Math.sin(R[i]) * back, tz = Z[i] - Math.cos(R[i]) * back;
        const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
        const v = Math.min(d / Math.max(sdt, 1e-4), KOPEK.hiz * (d > 1 ? 1.4 : 1));
        if (d > 0.05) { g.x += dx / d * v * sdt; g.z += dz / d * v * sdt; g.rot = Math.atan2(dx, dz); g.speed = v; } else g.speed = 0;
        // leash: never more than KOPEK.max from the owner
        const ox = g.x - X[i], oz = g.z - Z[i], od = Math.hypot(ox, oz);
        if (od > KOPEK.max) { g.x = X[i] + ox / od * KOPEK.max; g.z = Z[i] + oz / od * KOPEK.max; }
      }
      /** passers near the street musician stop, turn to him and listen a few seconds */
      function listeners(m: Walker, i: number, rng2: Rng) {
        if ((tick + i) % 15) return;
        for (const w of walkers.values()) {
          if (w === m || w.state !== S_WALK || w.spot || (w.rol ?? -1) >= 0 || w.exit || (w.dinle ?? 0) > 0) continue;
          const j = w.slot, dx = X[i] - X[j], dz = Z[i] - Z[j];
          if (dx * dx + dz * dz > DINLE.r * DINLE.r || !rng2.chance(DINLE.olasilik)) continue;
          w.dinle = 1; w.state = S_PAUSE; w.t = rng2.range(DINLE.sure[0], DINLE.sure[1]); w.path = []; w.oturak = null;
          R[j] = Math.atan2(dx, dz); SP[j] = 0; act[j] = rng2.chance(0.3) ? A_WAVE : A_IDLE; s.u8('mood')[j] = M_HAPPY;
        }
      }
      // view state: role and dog per slot
      if (durum) {
        durum.kopek.fill(NaN);
        for (const w of walkers.values()) {
          const i = w.slot;
          durum.rol[i] = w.state !== S_IN && (w.rol ?? -1) >= 0 ? (w.rol as number) + 1 : 0;
          if (w.dinle && w.state === S_WALK) w.dinle = 0;
          if (w.dog && w.state !== S_IN) { const o = i * 4; durum.kopek[o] = w.dog.x; durum.kopek[o + 1] = w.dog.z; durum.kopek[o + 2] = w.dog.rot; durum.kopek[o + 3] = w.dog.speed; durum.kopekAd[i] = w.dog.ad; }
          if (w.state === S_IN) durum.semsiye[i] = 0;
        }
      }
    },
    recruit(filter) {
      const s = store;
      if (!s) return -1;
      const ty = s.u8('typeId');
      // Lowest slot first keeps it deterministic. Sokak kipi: walkers inside a building first (nobody vanishes from the
      // street), then the hidden far ones, then the farthest from the hero.
      let slots = [...walkers.keys()].sort((a, b) => a - b);
      if (sokak) {
        const X = s.f32('x'), Z = s.f32('z');
        const rank = (sl: number) => { const w = walkers.get(sl)!; return w.state === S_IN ? 0 : w.gizli ? 1 : 2; };
        slots = slots.sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? Math.hypot(X[b] - hero.x, Z[b] - hero.z) - Math.hypot(X[a] - hero.x, Z[a] - hero.z) : 0) || a - b);
      }
      for (const slot of slots) {
        const w = walkers.get(slot)!;
        if (filter && !filter(CITIZENS[ty[slot]]?.id ?? '')) {
          // an inside walker has no face on the street yet: it can be any type the caller wants
          if (!(sokak && w.state === S_IN)) continue;
          const k = CITIZENS.findIndex(c => filter(c.id));
          if (k < 0) continue;
          ty[slot] = k;
        }
        releaseSeat(w);
        walkers.delete(slot);
        recruited.add(slot);
        const f = s.u16('flags');
        f[slot] = (f[slot] & ~(AGENT_FLAG.ambient | AGENT_FLAG.seated)) | AGENT_FLAG.visible;
        s.u8('act')[slot] = A_IDLE;
        s.f32('speed')[slot] = 0;
        if (durum) { durum.rol[slot] = 0; durum.semsiye[slot] = 0; }
        return slot;
      }
      return -1;
    },
    recruitHungry(near, maxD) {
      const s = store;
      if (!s || !sokak) return -1;
      const X = s.f32('x'), Z = s.f32('z'), flags = s.u16('flags');
      let best = -1, bd = maxD;
      // nearest hungry citizen out on the street (not inside, not hidden far away, not a street role, not in a queue/seat); ties by slot
      for (const slot of [...walkers.keys()].sort((a, b) => a - b)) {
        const w = walkers.get(slot)!;
        if (w.state === S_IN || w.gizli || (w.rol ?? -1) >= 0 || w.dog || (w.ac ?? 0) < 1 || (flags[slot] & AGENT_FLAG.scenery)) continue;
        if (CITIZENS[s.u8('typeId')[slot]]?.scenery) continue;
        const d = Math.hypot(X[slot] - near.x, Z[slot] - near.z);
        if (d < bd) { bd = d; best = slot; }
      }
      if (best < 0) return -1;
      const w = walkers.get(best)!;
      releaseSeat(w); walkers.delete(best); recruited.add(best);
      flags[best] = (flags[best] & ~(AGENT_FLAG.ambient | AGENT_FLAG.seated)) | AGENT_FLAG.visible;
      s.u8('act')[best] = A_IDLE; s.f32('speed')[best] = 0;
      if (durum) { durum.rol[best] = 0; durum.semsiye[best] = 0; }
      return best;
    },
    sendHungry(door, maxD) {
      const s = store;
      if (!s || !sokak) return -1;
      const X = s.f32('x'), Z = s.f32('z'), flags = s.u16('flags');
      const cand: { slot: number; d: number }[] = [];
      for (const slot of [...walkers.keys()].sort((a, b) => a - b)) {
        const w = walkers.get(slot)!;
        if (w.state === S_IN || w.gizli || w.visit || (w.rol ?? -1) >= 0 || w.dog || (w.ac ?? 0) < 1 || (flags[slot] & AGENT_FLAG.scenery) || CITIZENS[s.u8('typeId')[slot]]?.scenery) continue;
        const d = Math.hypot(X[slot] - door.x, Z[slot] - door.z);
        if (d < maxD) cand.push({ slot, d });
      }
      cand.sort((a, b) => a.d - b.d || a.slot - b.slot);
      for (const { slot } of cand.slice(0, 4)) {   // nearest that really has a route to the door
        const w = walkers.get(slot)!, p = route({ x: X[slot], z: Z[slot] }, door);
        if (!p.length) continue;
        releaseSeat(w); flags[slot] &= ~AGENT_FLAG.seated;
        w.state = S_WALK; w.path = p; w.wp = 0; w.exit = true; w.visit = true; w.oturak = null; w.varis = undefined; w.kal = undefined; w.free = 0; w.ac = 0;
        return slot;
      }
      return -1;
    },
    /** 'walk' on its way, 'in' arrived (went inside the shop), 'lost' no longer visiting (took another goal or was recruited) */
    visitStatus(slot) {
      const w = walkers.get(slot);
      if (!w || !w.visit) return 'lost';
      if (w.state === S_IN) { w.visit = false; return 'in'; }
      return 'walk';
    },
    release(agent) {
      const s = store;
      if (!s || !s.alive(agent)) { recruited.delete(agent); return; }
      recruited.delete(agent);
      if (walkers.has(agent)) return;
      const f = s.u16('flags');
      if (walkers.size >= target) { f[agent] = 0; s.free(agent); return; }
      f[agent] = (f[agent] & ~(AGENT_FLAG.customer | AGENT_FLAG.queued | AGENT_FLAG.seated | AGENT_FLAG.leaving)) | AGENT_FLAG.visible | AGENT_FLAG.ambient;
      const zi = s.u8('zone')[agent];
      const zone = zones.includes(ZONE_ORDER[zi]) ? ZONE_ORDER[zi] : zones[0];
      const gait = GAIT_ORDER[s.u8('gait')[agent]] ?? 'normal';
      walkers.set(agent, { slot: agent, zone, state: S_PAUSE, t: 0.5, path: [], wp: 0, seat: -1, speed: GAIT_SPEED[gait], exit: false, rol: -1 });
    },
  };
  // Test/debug helpers (not part of the contract).
  Object.defineProperty(sys, 'count', { get: () => walkers.size });
  Object.defineProperty(sys, 'sokak', { get: () => !!sokak });
  Object.defineProperty(sys, 'dispose', { value: () => { if (store) for (const w of [...walkers.values()]) despawn(store, w); } });
  Object.defineProperty(sys, '_dbg', { value: (sl: number) => { const w = walkers.get(sl); return w ? { path: w.path, wp: w.wp, oturak: w.oturak, stuck: w.stuck } : null; } });
  /** debug: per walker {slot, state, rol, x, z, inside} */
  Object.defineProperty(sys, 'rows', { value: () => { const s = store; if (!s) return []; return [...walkers.values()].map(w => ({ slot: w.slot, state: w.state, rol: w.rol ?? -1, x: s.f32('x')[w.slot], z: s.f32('z')[w.slot], inside: w.state === S_IN, spot: w.spot ?? '', seated: w.state === S_SIT, gizli: !!w.gizli, exit: w.exit })); } });
  return sys;
}
