/**
 * Ferry rhythm (v2 updateFerry / onFerryDock): the sim owns the phases (away -> arriving 10 s -> docked 25 s ->
 * leaving 16 s -> away), B's view only animates from `rt.ferry`. On dock a wave of buyers walks off the ferry, and with
 * the Vapur Penceresi owned the window opens (window.ts). Owner: Builder A. Pure.
 */
import { CITIZENS } from '../../content/citizens';
import { P } from '../../content/economy';
import { LINES } from '../../content/lines';
import type { ProductId } from './schema';
import type { Kernel } from './state';
import { clamp } from './util';
import { advanceFerry, ferryBuyers, ferryDockLine, ferryPassenger, isFerryKind, newFerryInfo } from './ferry-kinds';
import { NIGHT_FERRY } from '../../content/ferries';
import type { installCustomers } from './customers';
import { havaOf } from './hava';

/** Ferry gap grows with the kiosk stage (2 h play: a ferry every 84 s felt like a metronome); each wave grows with it. */
export const ferryGap = (stage: number): [number, number] => (stage <= 1 ? [75, 105] : stage === 2 ? [110, 160] : [150, 230]);
export const FERRY_T = { arriving: 10, docked: 25, leaving: 16 } as const;
export const FERRY_DOOR = { x: 8.1, z: -7.1 };

export function installFerry(K: Kernel, cu: ReturnType<typeof installCustomers>, w: { open(): void; close(): void; update(dt: number): void }) {
  const rt = K.rt, S = K.state, f = rt.ferry, rng = K.R.main;
  const wave: (() => void)[] = []; let waveT = 0;
  const citizen = (id: string) => CITIZENS.find(t => t.id === id)!;
  // ferry kinds (ferry-kinds.ts): own rng stream so the boat pick never shifts the main stream
  const frng = K.rng('sim.ferry');
  const info = rt.ferryInfo = newFerryInfo();
  function onDock() {
    f.docked = true; f.arriveAt = -1;
    f.next = S.playT + rng.range(ferryGap(S.stage)[0], ferryGap(S.stage)[1]);
    K.stat('ferries'); K.logEv('ferryDock');
    const open = K.openProducts();
    const buyers = ferryBuyers(clamp(Math.round(3 + 1.6 * S.stage + open.length * 0.6), 3, 10), info.cur, info.curLit);
    K.toast(ferryDockLine(frng, info.cur, info.curLit), 'info');
    const list: (() => void)[] = [];
    for (let i = 0; i < buyers; i++) list.push(() => {
      if (rt.queue.length < Math.min(P.QUEUE_MAX, rt.layout.queue.length)) {
        const pid = ferryPassenger(frng, info.cur, info.curLit);
        const type = pid ? citizen(pid) : undefined;
        const sleepy = info.curLit && frng.chance(NIGHT_FERRY.sleepyChance) ? frng.pick(NIGHT_FERRY.sleepy) : undefined;
        cu.spawnCustomer({ type, from: FERRY_DOOR, n: 1, patienceX: 1.4, say: sleepy });
      }
    });
    if (S.owned.pencere) {
      w.open();
      const simple = open.filter(p => p !== 'doner' || open.length < 3);
      for (let i = 0; i < P.WINDOW_QUEUE; i++) list.splice(i * 2, 0, () => {
        if (!rt.window || !rt.window.open || rt.winq.length >= rt.layout.window.queue.length) return;
        const p = rng.pick((simple.length ? simple : ['doner']) as ProductId[]);
        cu.spawnCustomer({ kind: 'win', type: citizen('vapuryolcusu'), from: FERRY_DOOR, n: 1, order: { [p]: 1 }, say: rng.chance(0.5) ? rng.pick(LINES.type.vapuryolcusu) : '' });
      });
    }
    wave.push(...list); waveT = 0;
  }
  function update(dt: number) {
    f.t += dt;
    if (f.state === 'away') {
      if (f.arriveAt < 0 && S.playT >= f.next - FERRY_T.arriving && havaOf(rt)?.skipFerry()) f.next = S.playT + ferryGap(S.stage)[0] + FERRY_T.arriving; // hava.ts: fırtına skips one wave
      if (f.arriveAt < 0 && S.playT >= f.next - FERRY_T.arriving) {
        f.arriveAt = S.playT; f.state = 'arriving'; f.t = 0; f.docked = false;
        advanceFerry(info, frng, K.hour());
        K.logEv('ferryHorn'); K.toast(LINES.ferry.horn, 'info');
      }
    } else if (f.state === 'arriving') {
      if (f.t >= FERRY_T.arriving) { f.state = 'docked'; f.t = 0; onDock(); }
    } else if (f.state === 'docked') {
      if (f.t >= FERRY_T.docked) { f.state = 'leaving'; f.t = 0; K.logEv('ferryLeave'); }
    } else if (f.state === 'leaving') {
      if (f.t >= FERRY_T.leaving) { f.state = 'away'; f.t = 0; }
    }
    w.update(dt);
    if (wave.length) { waveT -= dt; if (waveT <= 0) { waveT = 0.7; const fn = wave.shift()!; fn(); } }
  }
  return { update, force(kind?: unknown) { if (isFerryKind(kind)) info.forced = kind; f.next = S.playT + 10; f.arriveAt = -1; if (f.state !== 'away') return; } , clearWave() { wave.length = 0; } };
}
