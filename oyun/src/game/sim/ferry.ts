/**
 * Kalabalık dalgası. 2026-11-25: gemi/vapur kavramı oyundan kalıcı olarak kalktı; aralıklı olarak promenattan
 * bir müşteri dalgası gelir. rt.ferry yalnız kayıt / görünüm uyumu için hep 'away'. Pure.
 */
import { P } from '../../content/economy';
import type { Kernel } from './state';
import { clamp } from './util';
import type { installCustomers } from './customers';
import { havaOf } from './hava';

/** Ferry gap grows with the kiosk stage (2 h play: a ferry every 84 s felt like a metronome); each wave grows with it. */
export const ferryGap = (stage: number): [number, number] => (stage <= 1 ? [75, 105] : stage === 2 ? [110, 160] : [150, 230]);
export const FERRY_T = { arriving: 10, docked: 25, leaving: 16 } as const;
export const FERRY_DOOR = { x: 22.4, z: -7.1 };
/** dalga büyüklüğü oranı (gelir dengesi, first-session parity): yolcular yakın promenattan geliyor (gelir dengesi, first-session parity) */
export const KALABALIK_PAY = 0.4;

export function installFerry(K: Kernel, cu: ReturnType<typeof installCustomers>, w: { open(): void; close(): void; update(dt: number): void }) {
  const rt = K.rt, S = K.state, f = rt.ferry, rng = K.R.main;
  const wave: (() => void)[] = []; let waveT = 0;
  // Aynı aralıkla promenattan bir kalabalık dalgası gelir (tekne, korna, duyuru yok); rt.ferry kayıt/görünüm alanı uyumu için hep 'away' kalır.
  function onDock() {
    f.next = S.playT + rng.range(ferryGap(S.stage)[0], ferryGap(S.stage)[1]);
    const open = K.openProducts();
    const buyers = Math.round(clamp(Math.round(3 + 1.6 * S.stage + open.length * 0.6), 3, 10) * KALABALIK_PAY);
    for (let i = 0; i < buyers; i++) wave.push(() => {
      if (rt.queue.length < Math.min(P.QUEUE_MAX, rt.layout.queue.length)) {
        cu.spawnCustomer({ type: undefined, n: 1, patienceX: 1.4 });
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
  return { update, force() { f.next = S.playT + 10; f.arriveAt = -1; }, clearWave() { wave.length = 0; } };
}
