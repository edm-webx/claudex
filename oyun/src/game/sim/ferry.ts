/**
 * Kalabalık dalgası (eski vapur ritmi). 2026-11-25: vapur kavramı oyundan kalktı (sahibi kararı, kalıcı); aynı aralıkla promenattan
 * bir müşteri dalgası gelir. rt.ferry yalnız kayıt / görünüm uyumu için hep 'away'. Pure.
 */
import { CITIZENS } from '../../content/citizens';
import { P } from '../../content/economy';
import type { Kernel } from './state';
import { clamp } from './util';
import { ferryBuyers, ferryPassenger, isFerryKind, newFerryInfo } from './ferry-kinds';
import type { installCustomers } from './customers';
import { havaOf } from './hava';

/** Ferry gap grows with the kiosk stage (2 h play: a ferry every 84 s felt like a metronome); each wave grows with it. */
export const ferryGap = (stage: number): [number, number] => (stage <= 1 ? [75, 105] : stage === 2 ? [110, 160] : [150, 230]);
export const FERRY_T = { arriving: 10, docked: 25, leaving: 16 } as const;
export const FERRY_DOOR = { x: 22.4, z: -7.1 };
/** dalga büyüklüğü eski vapur dalgasına oranla: yolcular artık uzak vapur kapısından değil yakın promenattan geliyor (gelir dengesi, first-session parity) */
export const KALABALIK_PAY = 0.4;

export function installFerry(K: Kernel, cu: ReturnType<typeof installCustomers>, w: { open(): void; close(): void; update(dt: number): void }) {
  const rt = K.rt, S = K.state, f = rt.ferry, rng = K.R.main;
  const wave: (() => void)[] = []; let waveT = 0;
  const citizen = (id: string) => CITIZENS.find(t => t.id === id)!;
  // ferry kinds (ferry-kinds.ts): own rng stream so the boat pick never shifts the main stream
  const frng = K.rng('sim.ferry');
  const info = rt.ferryInfo = newFerryInfo();
  // 2026-11-25 (sahibi: "vapur konsepti hiçbir zaman olmasın"): vapur yok. Eski vapur dalgasının satış payı korunsun diye aynı aralıkla
  // promenattan bir kalabalık dalgası gelir: tekne, korna, duyuru, pencere yok; rt.ferry hep 'away' kalır (görünüm ve kayıt alanı uyumu).
  function onDock() {
    f.next = S.playT + rng.range(ferryGap(S.stage)[0], ferryGap(S.stage)[1]);
    const open = K.openProducts();
    const buyers = Math.round(ferryBuyers(clamp(Math.round(3 + 1.6 * S.stage + open.length * 0.6), 3, 10), info.cur, info.curLit) * KALABALIK_PAY);
    for (let i = 0; i < buyers; i++) wave.push(() => {
      if (rt.queue.length < Math.min(P.QUEUE_MAX, rt.layout.queue.length)) {
        const pid = ferryPassenger(frng, info.cur, info.curLit);
        const type = pid && pid !== 'vapuryolcusu' ? citizen(pid) : undefined;
        cu.spawnCustomer({ type, n: 1, patienceX: 1.4 });
      }
    });
    waveT = 0;
  }
  function update(dt: number) {
    f.state = 'away'; f.docked = false;
    // eski ritimle aynı an: dalga, eski düdükten (next - 10 sn) 10 sn sonra, yani next'te; uzun bir duraklamadan dönüşte de önce 10 sn bekler
    if (f.arriveAt < 0 && S.playT >= f.next - FERRY_T.arriving) { if (havaOf(rt)?.skipFerry()) f.next = S.playT + ferryGap(S.stage)[0] + FERRY_T.arriving; else f.arriveAt = S.playT + FERRY_T.arriving; }
    if (f.arriveAt >= 0 && S.playT >= f.arriveAt) { f.arriveAt = -1; onDock(); }
    w.update(dt);
    if (wave.length) { waveT -= dt; if (waveT <= 0) { waveT = 1.4; const fn = wave.shift()!; fn(); } }
  }
  return { update, force(kind?: unknown) { if (isFerryKind(kind)) info.forced = kind; f.next = S.playT + 10; f.arriveAt = -1; if (f.state !== 'away') return; } , clearWave() { wave.length = 0; } };
}
