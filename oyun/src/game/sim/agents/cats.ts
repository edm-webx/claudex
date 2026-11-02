/**
 * Cats (v2 updateCats / petCat / syncCats): Pamuk from the start, more as achievements unlock (CATS[].at). A cat sleeps
 * on its spot, hops down, walks to Sabri, rubs around him and purrs when he stands still next to it (the dwell
 * rule again: stand still 1 s). First pet of a cat opens its Kedi Defteri page. Pamuk wakes herself at 160 s of
 * play until the first pet. Pets give a 60 s tip boost. Animal acts are v2 rig acts (sleep, walk, rub, purr, meow).
 */
import type { System, SimCtx, Vec2 } from '../../../engine/api';
import { CATS, type CatDef } from '../../../content/cats';
import type { AgentEnv } from './env';
import type { Actor } from './types';
import { Walker, near2 } from './move';
import type { GameState } from '../schema';

const CAT_WAKE_S = 160;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
interface CatRt { def: CatDef; a: Actor; wk: Walker; state: string; t: number; spot: Vec2 & { y: number }; petT: number; nextVisit: number; heart: number; tGive: number; }

const hasCat = (S: GameState, id: string) => (S.cats as (string | { id: string })[]).some((c) => (typeof c === 'string' ? c === id : c.id === id));

export interface CatsSystem extends System {
  rows(): { id: string; state: string; x: number; z: number }[];
  /** Create the cats that exist at start (Pamuk) before the first tick so state views see them at tick 0. */
  prime(S: GameState): void;
}

export function createCats(env: AgentEnv): CatsSystem {
  const rng = env.rng('cats');
  const cats: CatRt[] = [];
  let syncT = 0;

  function spawn(def: CatDef, S: GameState) {
    // 2026-10-25 user: no animals stuck up on roofs/awnings: cats only use low spots
    const spots = env.book.catSpots().filter((s) => s.a.y < 1.2);
    if (!spots.length) return;
    const pick = def.id === 'pamuk' ? (spots.find((s) => s.name.endsWith('basket')) || spots[0])
      : [spots.find((s) => s.name.endsWith('stool')), spots.find((s) => s.name.endsWith('bench')), spots.find((s) => s.name.endsWith('basket'))][cats.length % 3] || spots[0];
    const spot = { x: pick.a.x, z: pick.a.z, y: pick.a.y };
    const a = env.reg.add('cat', def.id, { name: def.name, coat: def.coat }, spot, { name: def.name });
    a.y = a.py = spot.y; a.act = 'sleep'; a.rot = a.prot = pick.a.rotY;
    cats.push({ def, a, wk: new Walker(a, env.nav), state: 'sleep', t: 0, spot, petT: 0, nextVisit: S.playT + 80 + rng.next() * 60, heart: 0, tGive: 0 });
  }
  function pet(c: CatRt, S: GameState) {
    c.state = 'purr'; c.t = 0; c.heart = 2.5; c.petT = 0;
    env.host.heroAct('pet', 1.2);
    env.host.stat('pets'); if (c.def.id === 'pamuk') env.host.stat('petsPamuk');
    env.host.heroSay(env.host.hero() === 'sabriye' ? 'Gel bakalım Pamuk hanım.' : 'Gel bakalım Pamuk hanım.', 1.6);
    env.host.tipBoost(60);
    if (!hasCat(S, c.def.id)) {
      (S.cats as unknown[]).push({ id: c.def.id });
      env.host.toast('Kedi Defteri: ' + c.def.name + ' sayfası açıldı!', 'good'); env.emit('catPet', { id: c.def.id });
      if (c.def.id === 'pamuk') S.tut.catPet = 1;
    }
  }
  function sync(S: GameState) {
    const achN = Object.keys(S.ach).length;
    for (const def of CATS) {
      if (cats.some((c) => c.def.id === def.id)) continue;
      if (def.at === 0 || achN >= def.at || hasCat(S, def.id)) {
        if (def.at > 0 && !hasCat(S, def.id)) env.host.toast('Yeni bir kedi geldi: ' + def.name + '! Gidip sev.', 'good');
        spawn(def, S);
      }
    }
  }
  const sys: CatsSystem = {
    id: 'cats', order: 44, phase: 'sim',
    prime: (S) => { sync(S); syncT = 1; },
    step(ctx: SimCtx) {
      const S = ctx.state, dt = ctx.dt, pl = env.player(), moving = env.host.player().moving;
      syncT -= dt;
      if (syncT <= 0) { syncT = 1; sync(S); }
      for (const c of cats) {
        const a = c.a; c.t += dt; c.heart -= dt;
        a.fx = c.heart > 0 ? 'heart' : '';
        const pam = c.def.id === 'pamuk';
        switch (c.state) {
          case 'sleep':
            a.act = 'sleep'; a.speed = 0; a.mood = 'asleep';
            if (pam && !S.tut.catPet && S.playT >= CAT_WAKE_S) { c.state = 'jump'; c.t = 0; a.act = 'meow'; env.emit('catWake'); }
            else if (S.playT >= c.nextVisit && (hasCat(S, c.def.id) || !pam)) { c.state = 'jump'; c.t = 0; }
            else if (!pam && !hasCat(S, c.def.id) && near2(pl, a, 1.1) && !moving) { c.petT += dt; if (c.petT > 1) pet(c, S); }
            break;
          case 'jump': {
            a.mood = 'ok';
            const k = Math.min(1, c.t / 0.7); a.y = c.spot.y + (0 - c.spot.y) * easeOut(k); a.act = 'walk'; a.speed = 0;
            if (k >= 1) { a.y = 0; c.state = 'toSabri'; c.t = 0; a.x = c.spot.x; a.z = c.spot.z; c.wk.goTo(pl); }
            break;
          }
          case 'toSabri':
            a.act = 'walk'; c.tGive += dt;
            if (c.t > 0.8) { c.t = 0; c.wk.goTo(pl); }
            c.wk.walk(dt, 1.6);
            if (near2(a, pl, 0.7)) { c.state = 'rub'; c.t = 0; c.petT = 0; c.tGive = 0; if (pam && !S.tut.catPet) env.emit('catRub'); }
            else if (c.tGive > 40) { c.tGive = 0; c.state = 'wander'; }
            break;
          case 'rub': {
            a.act = 'rub'; a.speed = 0;
            const ang = S.playT * 1.6; a.x = pl.x + Math.sin(ang) * 0.45; a.z = pl.z + Math.cos(ang) * 0.45; a.rot = ang + Math.PI / 2;
            if (!moving && near2(a, pl, 1.0)) { c.petT += dt; if (c.petT >= 1) pet(c, S); } else c.petT = Math.max(0, c.petT - dt);
            if (c.t > 30 && c.state === 'rub') { c.state = 'wander'; c.t = 0; }
            break;
          }
          case 'purr':
            a.act = 'purr'; a.speed = 0;
            if (c.t > 2.2) { c.state = 'wander'; c.t = 0; }
            break;
          case 'wander': {
            const low = env.book.catSpots().filter((s) => s.a.y < 1.2);
            if (low.length) { const s = low[rng.int(0, low.length - 1)]; c.spot = { x: s.a.x, z: s.a.z, y: s.a.y }; }
            c.wk.goTo(c.spot); c.state = 'walkSpot'; a.act = 'walk'; c.tGive = 0;
            break;
          }
          case 'walkSpot':
            a.act = 'walk';
            if (!c.wk.walk(dt, 1.2)) { c.state = 'sleep'; c.t = 0; a.y = c.spot.y; c.nextVisit = S.playT + 90 + rng.next() * 70; }
            break;
        }
        if (c.state !== 'toSabri' && c.state !== 'walkSpot') a.speed = 0;
      }
    },
    rows: () => cats.map((c) => ({ id: c.def.id, state: c.state, x: c.a.x, z: c.a.z })),
  };
  return sys;
}
