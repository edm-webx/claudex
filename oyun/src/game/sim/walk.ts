/**
 * M0 player movement + collision (v2 updatePlayer port). Owner: Builder A.
 * Pure sim: no three, no DOM, no wall clock, no unseeded randomness.
 * v2 numbers: speed 4.6 m/s * (0.35 + 0.65 * stick) applied to the un-normalised stick vector (so ground speed is
 * 4.6 * m * (0.35 + 0.65 m), a v2 quirk kept for feel parity), moving when stick > 0.12, turn angLerp(dt * 14), radius 0.36.
 * Collision goes through nav.move (slides along blocked cells). `speed` is the actual ground speed this tick
 * (what the dwell rule reads). Writes state.player {x,z,rot} every tick. Optional `interactions` + `actor`:
 * the dwell registry is updated after movement each tick.
 */
import type { PlayerWalk, Nav, InteractionRegistry, Entity, SimCtx, Vec2 } from '../../engine/api';
import { angLerp } from '../../engine/core';
import { binis, katY, avmIcinde, type Yolculuk } from '../../content/avm-kat';
import { hstBinis, hstIcinde } from '../../content/hastane-kat';
const SOLID = { solids: true };
type GameStatePlayer = { x: number; z: number; rot: number; kat?: number };

/** katNav: Martı AVM katlarının çarpışması (yalnız dikdörtgen, content/avm-kat.ts); AVM dışında = nav */
export interface WalkDeps { nav: Nav; start: { x: number; z: number; kat?: number }; speed?: number; interactions?: InteractionRegistry; actor?: Entity; radius?: number; katNav?: (kat: number, p?: Vec2) => Nav | null; }

/** PlayerWalk plus the previous yaw, so the render side can interpolate rotation like position (v2 angLerp(prevRot, rot, a)).
 *  kat / y / prevY: AVM katı ve yürüyen merdivende yükseklik (pos.kat da aynı katı taşır: iç mekân / arsa kontrolleri onu okur). */
export interface WalkFull extends PlayerWalk { readonly prevRot: number; readonly kat: number; readonly y: number; readonly prevY: number; readonly binik: boolean; teleport(x: number, z: number, kat?: number): void; }
/** yürüyen merdiven hızı (m/s, oyun için gerçeğinden hızlı) */
export const MERDIVEN_HIZ = 2.4;

/** class skills (sim/yetenek.ts) scale the player's top speed: Kurye's passive, Kurye/Sporcu actives */
export const walkBoost = { x: 1 };
export function createWalk(deps: WalkDeps): WalkFull {
  const maxSpeed = deps.speed ?? 4.6;
  const radius = deps.radius ?? 0.36;
  const pos: Vec2 & { kat?: number } = { x: deps.start.x, z: deps.start.z };
  let kat = Math.max(0, Math.round(deps.start.kat || 0)), y = katY(kat), prevY = y, ride: { y: Yolculuk; i: number } | null = null, rideCd = 0;
  const setKat = (k: number) => { kat = k; if (k) pos.kat = k; else delete pos.kat; };
  setKat(kat);
  const prev: Vec2 = { x: pos.x, z: pos.z };
  const to: Vec2 = { x: 0, z: 0 };
  const out: Vec2 = { x: 0, z: 0 };
  let rot = Math.PI, prevRot = Math.PI, speed = 0, vx = 0, vz = 0;
  // Trailing window of recent displacement. Pressing into a counter or wall makes the collider slide the player
  // back and forth around the stand point: per-tick speed is then above DWELL_SPEED_MAX while the player is in
  // effect standing still, so the dwell never completed (2026-10-25 "tezgaha gidince elimdekiler gitmiyor").
  // A reversal in the last window (the player overshoots and comes back) reads min(instant speed, trailing average),
  // so the jitter cancels out. Plain movement reads the instant speed, so leaving a station still ends a dwell at once.
  const hist: { x: number; z: number; t: number }[] = [];
  let histT = 0, histX = 0, histZ = 0, dwellSpeed = 0, lastDx = 0, lastDz = 0, sinceRev = Infinity;
  const DWELL_WINDOW = 0.25;
  const w: WalkFull = {
    id: 'walk', order: 10, phase: 'sim',
    get pos() { return pos; }, get prev() { return prev; }, get rot() { return rot; }, get prevRot() { return prevRot; }, get speed() { return speed; },
    get kat() { return kat; }, get y() { return y; }, get prevY() { return prevY; }, get binik() { return !!ride; },
    teleport(x, z, k?: number) { pos.x = prev.x = x; pos.z = prev.z = z; setKat(k === undefined ? 0 : Math.max(0, Math.round(k))); y = prevY = katY(kat); ride = null; prevRot = rot; speed = 0; vx = 0; vz = 0; hist.length = 0; histT = histX = histZ = dwellSpeed = lastDx = lastDz = 0; sinceRev = Infinity; },
    step(ctx: SimCtx) {
      prev.x = pos.x; prev.z = pos.z; prevRot = rot; prevY = y;
      if (rideCd > 0) rideCd -= ctx.dt;
      if (ride) {   // AVM yürüyen merdiveni: girdi yok, bant oyuncuyu taşır; uçta kat değişir
        let left = MERDIVEN_HIZ * ctx.dt;
        while (ride && left > 0) {
          const t = ride.y.noktalar[ride.i], dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
          if (d > 1e-6) rot = Math.atan2(dx, dz);
          if (d <= left) { pos.x = t.x; pos.z = t.z; y = t.y; left -= d; ride.i++; if (ride.i >= ride.y.noktalar.length) { setKat(ride.y.hedefKat); y = katY(kat); ride = null; rideCd = 0.8; } }
          else { const k = left / d; pos.x += dx * k; pos.z += dz * k; y += (t.y - y) * k; left = 0; }
        }
        vx = vz = 0; speed = MERDIVEN_HIZ;
        const p = ctx.state.player; p.x = pos.x; p.z = pos.z; p.rot = rot; if (kat) (p as typeof p & { kat?: number }).kat = kat; else delete (p as typeof p & { kat?: number }).kat;
        if (deps.interactions) deps.interactions.update(deps.actor ?? 0, pos, speed, ctx);
        return;
      }
      let x = ctx.input.move.x, z = ctx.input.move.z;
      let m = Math.hypot(x, z);
      if (m > 1) { x /= m; z /= m; m = 1; }
      let tvx = 0, tvz = 0;
      if (m > 0.12) { const sp = maxSpeed * walkBoost.x * (0.35 + 0.65 * m); tvx = x * sp; tvz = z * sp; rot = angLerp(rot, Math.atan2(x, z), Math.min(1, ctx.dt * 14)); }
      const kv = Math.min(1, ctx.dt * (m > 0.12 ? 11 : 16));
      vx += (tvx - vx) * kv; vz += (tvz - vz) * kv;
      if (Math.abs(vx) + Math.abs(vz) > 0.04) {
        to.x = pos.x + vx * ctx.dt; to.z = pos.z + vz * ctx.dt;
        const nav = ((avmIcinde(pos, 4) || hstIcinde(pos, 4)) && deps.katNav?.(kat, pos)) || deps.nav;   // Martı AVM diyarı: her katın kendi çarpışması
        const r = nav.move(pos, to, radius, out, SOLID);
        pos.x = r.x; pos.z = r.z;
        if (rideCd <= 0 && m > 0.12) { const b = binis(pos, kat, vx, vz) || hstBinis(pos, kat, vx, vz); if (b) { ride = { y: b, i: 0 }; } }
      } else { vx = 0; vz = 0; }
      const dx = pos.x - prev.x, dz = pos.z - prev.z;
      speed = ctx.dt > 0 ? Math.sqrt(dx * dx + dz * dz) / ctx.dt : 0;
      if (ctx.dt > 0) {
        hist.push({ x: dx, z: dz, t: ctx.dt }); histX += dx; histZ += dz; histT += ctx.dt;
        while (hist.length > 1 && histT - hist[0].t >= DWELL_WINDOW) { const o = hist.shift()!; histX -= o.x; histZ -= o.z; histT -= o.t; }
        const avg = histT > 0 ? Math.sqrt(histX * histX + histZ * histZ) / histT : 0;
        const moved = dx * dx + dz * dz > 1e-8;
        if (moved && (lastDx * lastDx + lastDz * lastDz) > 1e-8 && dx * lastDx + dz * lastDz < 0) sinceRev = 0;
        else sinceRev += ctx.dt;
        if (moved) { lastDx = dx; lastDz = dz; }
        dwellSpeed = sinceRev < DWELL_WINDOW ? Math.min(speed, avg) : speed;
      }
      const p = ctx.state.player as GameStatePlayer;
      p.x = pos.x; p.z = pos.z; p.rot = rot; if (kat) p.kat = kat; else delete p.kat;
      if (deps.interactions) deps.interactions.update(deps.actor ?? 0, pos, dwellSpeed, ctx);
    },
  };
  return w;
}
