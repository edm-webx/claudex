/**
 * Real night lighting (2026-10-24 user: "gece aydınlatma sıfır, ışığın sadece görüntüsü var, ışık vermiyor").
 * The lamp bulbs and glow decals only looked lit; nothing on the ground, people or walls caught the light.
 * Decisions:
 * - A fixed pool of warm PointLights follows the player. The pool size comes from the quality tier (PRF-08: akıcı 4, dengeli 6,
 *   şahane 10) and changes ONLY in setTier (the tier change event, together with the shadow switch), never during play: the light
 *   count is part of three's program key, so toggling it recompiles every lit material (2026-11-09 Chrome freeze).
 * - Every PLAN_DT seconds (dt-based, same moments at 30/60/144 Hz) the planner picks the nearest lamps with hysteresis and each light
 *   keeps its lamp if it can; a light that must move fades out, jumps while dark and fades back in (no flicker, owner H-052).
 * - Lamps come from registered sources (addSource): iskele lamp posts, every 'ts.lamp' placement in every zone, the büfe floresan at its
 *   stage position, the far-shore shop doors (GRS-02, dimmer warm pools). Other packages give lamp positions through addSource; they never create their own PointLight.
 * - Inside a room (kafe, banka, okul, büfe salonları, mutfak) up to 4 lights go to the room's ceiling lamps (dim by day too), the rest stay
 *   outside; the outdoor hemisphere light eases down to 85 % (R.hemiMul, hava-look multiplies it in).
 * - Brightness follows the time of day: off by day, fading in at dusk, full at night (tod.n). Smaller pools get a slightly longer reach
 *   and a little more intensity (at most +25 %) so a weak PC's night looks close to the full one without getting brighter.
 */
import * as T from 'three';
import type { ZoneManager, Vec2, Disposer } from '../../../engine/api';
import { todAt } from '../../../engine/render/tod';
import { REFLECT_LAYER } from '../../../engine/render/reflect';
import { LAMPS } from '../../../content/prefabs/iskele/pier';
import { PLAN_DT, pickLamps, assignSlots, stepFade, smooth01, floresanNoktasi, vitrinLambalari, type FadeState } from './night-lights-plan';
import { IC_BY_ID, IC_MEKANLAR } from '../../../content/ic-mekan';
import { icLambalar } from './night-lights-plan';

export interface LampDef { x: number; y: number; z: number; color?: string; /** relative intensity, default 1 */ i?: number; flo?: boolean }
export interface RoomLights { id: string; lamps: readonly LampDef[] }
export interface NightLightStats { pool: number; active: number; lamps: number; room: string | null; tier: string }
export interface NightLights {
  update(focus: Vec2, hour: number, dt?: number, room?: RoomLights | null): void;
  /** rebuild the outdoor lamp list from the sources (also happens by itself when a zone warms up or the büfe stage changes) */
  refresh(): void;
  /** pool size from the tier (LIGHT_TUNE pool 4/6/10, or t.lights); the only place the light count changes */
  setTier(t: { name: string; lights?: number }): void;
  addSource(id: string, get: () => readonly LampDef[]): Disposer;
  /** late bindings boot gives after creation: büfe stage, the render (hemiMul) */
  bind(b: { stage?: () => number; render?: { hemiMul: number } | null }): void;
  stats(): NightLightStats;
}

/** per-tier reach / intensity; şahane = the values tuned 2026-10-24 (RANGE 12, LAMP_I 18, FLO_I 22) */
export const LIGHT_TUNE: Record<string, { pool: number; range: number; lampI: number; floI: number }> = {
  akici: { pool: 4, range: 14, lampI: 22, floI: 26 },
  dengeli: { pool: 6, range: 13, lampI: 20, floI: 24 },
  sahane: { pool: 10, range: 12, lampI: 18, floI: 22 },
};
const DAY_IN = 0.35, ROOM_I = 0.7, HEMI_IN = 0.85, ROOM_MAX = 4;
/** a light still fading out a lamp that left the list (room changed): keeps its captured position, counts as a room lamp */
const GHOST = 1e9;
const COL_POST = '#ffc77a', COL_FLO = '#fff4dc', COL_ROOM = '#ffd9a0';

const roomCache = new Map<string, RoomLights>();
/** the room's ceiling lamps for update(); built once per room id (no garbage per frame) */
export function roomLightsFor(id: string | null | undefined): RoomLights | null {
  if (!id) return null;
  let r = roomCache.get(id);
  if (!r) { const m = IC_BY_ID[id]; if (!m) return null; r = { id, lamps: icLambalar(m) }; roomCache.set(id, r); }
  return r;
}

interface Slot extends FadeState { px: number; py: number; pz: number; base: number; col: string }
const key = (l: LampDef) => `${l.x.toFixed(2)}|${l.z.toFixed(2)}`;

export function createNightLights(o: { scene: T.Scene; zones: ZoneManager | null; tier?: { name: string; lights?: number } }): NightLights {
  const lights: T.PointLight[] = [];
  const slots: Slot[] = [];
  let tierName = o.tier?.name ?? 'sahane';
  let tune = LIGHT_TUNE[tierName] ?? LIGHT_TUNE.sahane;
  const sources = new Map<string, () => readonly LampDef[]>();
  let lamps: LampDef[] = [], lampKeys: string[] = [];
  let roomId: string | null = null, roomLamps: readonly LampDef[] = [];
  let dirty = true, planClock = 0, needPlan = true, dark = true;
  let stageFn: (() => number) | null = null, lastStage = -1;
  let render: { hemiMul: number } | null = null, hemiMul = 1;
  let assign: number[] = [], nextAssign: number[] = [];
  const outPick: number[] = [], roomPick: number[] = [], chosen: number[] = [], prevOut: number[] = [], prevRoom: number[] = [];

  function resize(n: number): void {
    n = Math.max(1, Math.min(16, Math.round(n)));
    while (lights.length < n) {
      const l = new T.PointLight('#ffcf8a', 0, tune.range, 1.6);
      l.castShadow = false; l.name = 'nightLight' + lights.length; l.layers.enable(REFLECT_LAYER); o.scene.add(l); lights.push(l);   // GRS-05: same light set in the water mirror pass
      slots.push({ cur: -1, want: -1, k: 0, px: 0, py: -50, pz: 0, base: 0, col: COL_POST });
    }
    while (lights.length > n) { const l = lights.pop()!; o.scene.remove(l); l.dispose(); slots.pop(); }
    assign.length = n; for (let j = 0; j < n; j++) assign[j] = slots[j].want;
    for (const l of lights) { l.distance = tune.range; }
    needPlan = true;
  }

  // lamp index space: 0..lamps.length-1 outdoor, lamps.length.. room lamps
  const lampAt = (i: number): LampDef | null => i < 0 ? null : i < lamps.length ? lamps[i] : roomLamps[i - lamps.length] ?? null;

  function rebuild(): void {
    dirty = false;
    const out: LampDef[] = [];
    for (const get of sources.values()) { try { for (const l of get()) out.push(l); } catch { /* a broken source never kills the lights */ } }
    const keys = out.map(key);
    if (keys.length === lampKeys.length && keys.every((k, i) => k === lampKeys[i])) { lamps = out; return; }   // same set: planner state stays
    const idx = new Map<string, number>(); keys.forEach((k, i) => idx.set(k, i));
    const oldN = lamps.length, remap = (i: number) => i < 0 ? -1 : i >= GHOST ? i : i < oldN ? (idx.get(lampKeys[i]) ?? -1) : i - oldN + out.length;
    for (const s of slots) { s.cur = remap(s.cur); s.want = remap(s.want); }
    for (let j = 0; j < assign.length; j++) assign[j] = remap(assign[j]);
    lamps = out; lampKeys = keys; needPlan = true;
  }

  function setRoom(r: RoomLights | null | undefined): void {
    const id = r?.id ?? null;
    if (id === roomId) return;
    const L = lamps.length;
    // the lights holding the old room's lamps fade out (their position stays until dark, see Slot.px)
    for (const s of slots) { if (s.cur >= L) s.cur = GHOST; if (s.want >= L) s.want = -1; }
    for (let j = 0; j < assign.length; j++) if (assign[j] >= L) assign[j] = -1;
    roomId = id; roomLamps = r?.lamps ?? []; needPlan = true;
  }

  function plan(focus: Vec2): void {
    const n = lights.length, L = lamps.length;
    const inN = roomLamps.length ? Math.min(ROOM_MAX, n - 1, roomLamps.length) : 0;
    prevOut.length = 0; prevRoom.length = 0;   // prev sets come from the current assignment (scratch arrays, no garbage)
    for (const a of assign) { if (a >= GHOST) continue; if (a >= L) prevRoom.push(a - L); else if (a >= 0) prevOut.push(a); }
    pickLamps(roomLamps, focus, inN, prevRoom, 1, roomPick);
    pickLamps(lamps, focus, n - inN, prevOut, undefined, outPick);
    chosen.length = 0;
    for (const i of roomPick) chosen.push(i + L);
    for (const i of outPick) chosen.push(i);
    assignSlots(assign, chosen, nextAssign);
    const t = assign; assign = nextAssign; nextAssign = t;
    for (let j = 0; j < n; j++) slots[j].want = assign[j];
  }

  function swapIn(j: number): void {
    const s = slots[j], p = lampAt(s.cur);
    if (!p) { s.base = 0; return; }
    const room = s.cur >= lamps.length;
    s.px = p.x; s.py = p.y - 0.15; s.pz = p.z;
    s.base = (p.flo ? tune.floI : tune.lampI) * (p.i ?? (room ? ROOM_I : 1));
    s.col = p.color ?? (p.flo ? COL_FLO : room ? COL_ROOM : COL_POST);
    const l = lights[j]; l.position.set(s.px, s.py, s.pz); l.color.set(s.col);
  }

  function update(focus: Vec2, hour: number, dt = 1 / 60, room?: RoomLights | null): void {
    dt = Math.max(0, Math.min(0.25, +dt || 0));
    if (stageFn) { const st = stageFn(); if (st !== lastStage) { lastStage = st; dirty = true; } }
    if (dirty) rebuild();
    setRoom(room);
    // hemisphere dims a little inside (hava-look and render multiply R.hemiMul in)
    const hmT = roomId ? HEMI_IN : 1;
    if (hemiMul !== hmT) { hemiMul += (hmT - hemiMul) * Math.min(1, dt * 2); if (Math.abs(hmT - hemiMul) < 0.002) hemiMul = hmT; if (render) render.hemiMul = hemiMul; }
    const n = Math.max(0, Math.min(1, todAt(hour).n ?? 0));
    const nRoom = roomId ? Math.max(n, DAY_IN) : n;
    // lights stay visible (intensity 0 by day): toggling visibility changes the light count -> recompiles (2026-11-09)
    if (nRoom <= 0.02) {
      if (!dark) { dark = true; for (let j = 0; j < lights.length; j++) { lights[j].intensity = 0; const s = slots[j]; s.k = 0; s.cur = -1; s.want = -1; assign[j] = -1; } }
      needPlan = true; return;
    }
    dark = false;
    planClock += dt;
    if (needPlan) { needPlan = false; planClock = 0; plan(focus); }
    else { if (planClock > PLAN_DT * 3) planClock = PLAN_DT; while (planClock >= PLAN_DT) { planClock -= PLAN_DT; plan(focus); } }
    const L = lamps.length;
    for (let j = 0; j < lights.length; j++) {
      const s = slots[j], was = s.cur;
      stepFade(s, dt);
      if (s.cur !== was) swapIn(j);
      lights[j].intensity = s.cur < 0 ? 0 : s.base * (s.cur >= L ? nRoom : n) * smooth01(s.k);
    }
  }

  const api: NightLights = {
    update,
    refresh() { dirty = true; },
    setTier(t) {
      tierName = t.name; tune = LIGHT_TUNE[t.name] ?? LIGHT_TUNE.sahane;
      resize(t.lights ?? tune.pool);
      for (let j = 0; j < slots.length; j++) if (slots[j].cur >= 0) swapIn(j);   // new intensity table, same lamps
    },
    addSource(id, get) { sources.set(id, get); dirty = true; return () => { if (sources.get(id) === get) { sources.delete(id); dirty = true; } }; },
    bind(b) { if (b.stage) { stageFn = b.stage; dirty = true; } if (b.render !== undefined) { render = b.render; if (render) render.hemiMul = hemiMul; } },
    stats() {
      let active = 0; for (const l of lights) if (l.intensity > 0.01) active++;
      return { pool: lights.length, active, lamps: lamps.length, room: roomId, tier: tierName };
    },
  };

  // built-in sources
  api.addSource('iskele-direk', () => (LAMPS as { x: number; y: number; z: number }[]).map(l => ({ x: l.x, y: l.y, z: l.z })));
  api.addSource('zone-lamba', () => {
    const zs = o.zones, out: LampDef[] = [];
    if (zs) for (const id of zs.ids()) { const d = zs.def(id); if (!d) continue; for (const p of d.props || []) if (p.prefab === 'ts.lamp') out.push({ x: p.pos.x, y: 3.2, z: p.pos.z }); }
    return out;
  });
  const vitrin = vitrinLambalari(IC_MEKANLAR);   // GRS-02: warm pools in front of the far-shore shop doors
  api.addSource('vitrin', () => vitrin);
  api.addSource('bufe-floresan', () => [{ ...floresanNoktasi(stageFn ? stageFn() : 2), flo: true }]);
  if (o.zones) o.zones.onState((_id, s) => { if (s === 'warm' || s === 'hot') dirty = true; });
  resize(o.tier?.lights ?? tune.pool);
  rebuild();
  return api;
}
