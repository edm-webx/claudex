/**
 * Vapur ritmi. 2026-11-27 sahibi kararı (25 Kasım'daki "vapur hiç olmasın" kararının yerine geçer): vapur sürekli gelip gider,
 * düdüğünü çalar, iskeleye yanaşır ve yalnız vatandaş indirir; inenler potansiyel müşteridir. Oyuncunun vapurla HİÇBİR
 * etkileşimi yoktur: vapur görevi, binme, bilet, tarife tahtası, vapur penceresi, güverte satışı, duyuru yok.
 * Evreler sim'de (away -> arriving 10 sn -> docked 25 sn -> leaving 16 sn -> away); görünüm yalnız `rt.ferry`'yi canlandırır.
 * Ekonomi: dalga büyüklüğü (KALABALIK_PAY) ve rng akışları kalabalık dalgasıyla aynı; yolcular promenat yerine vapur kapısından iner,
 * uzun yolu VAPUR_TELAFI dengeler (erken yanaşma + hızlı adım). Gece (00:30-06:00) seyrek gelir. Pure.
 */
import { CITIZENS } from '../../content/citizens';
import { P } from '../../content/economy';
import { NIGHT_FERRY } from '../../content/ferries';
import type { Kernel } from './state';
import { clamp } from './util';
import { advanceFerry, ferryBuyers, ferryPassenger, isFerryKind, newFerryInfo } from './ferry-kinds';
import type { installCustomers } from './customers';
import { havaOf } from './hava';

/** Ferry gap grows with the kiosk stage (2 h play: a ferry every 84 s felt like a metronome); each wave grows with it. */
export const ferryGap = (stage: number): [number, number] => (stage <= 1 ? [75, 105] : stage === 2 ? [110, 160] : [150, 230]);
export const FERRY_T = { arriving: 10, docked: 25, leaving: 16 } as const;
export const FERRY_DOOR = { x: 22.4, z: -7.1 };
/** dalga büyüklüğü oranı (gelir dengesi, first-session parity; kalabalık dalgasıyla aynı) */
export const KALABALIK_PAY = 0.4;
/** Kapı telafisi (2026-11-28, ekonomi paritesi): vapur kapısından kuyruğa yol ~26 m (eski dalga 13-17 m). Yolcular kuyruk yerini uzun süre
 *  tutup gelir %2-4 düşüyordu. Vapur eski dalga anından ONDE sn önce yanaşır, yolcular hızlı adım (HIZ m/sn) yürür; 12 tohum ortalaması
 *  gün 1/3/5 tabana göre +6.6 / +1.0 / +1.3 % (tohum 1: 6767 / 23358 / 50703). */
export const VAPUR_TELAFI = { onde: 6, hiz: 2.4 } as const;
/** gece seyrek: düdük bu saat aralığına düşerse (oyun saati, 24 = gece yarısı) bir sonraki aralık bu kadar uzar */
export const GECE_SEYREK = { from: 24.5, to: 30, gapX: 1.8 } as const;

export function installFerry(K: Kernel, cu: ReturnType<typeof installCustomers>, w: { open(): void; close(): void; update(dt: number): void }) {
  const rt = K.rt, S = K.state, f = rt.ferry, rng = K.R.main;
  const wave: (() => void)[] = []; let waveT = 0;
  const citizen = (id: string) => CITIZENS.find(t => t.id === id)!;
  // ferry kinds (ferry-kinds.ts): own rng stream so the boat pick never shifts the main stream
  const frng = K.rng('sim.ferry');
  const info = rt.ferryInfo = newFerryInfo();
  const gece = () => { const h = K.hour(); return h >= GECE_SEYREK.from && h < GECE_SEYREK.to; };
  function onDock() {
    f.docked = true;
    const g = ferryGap(S.stage), x = gece() ? GECE_SEYREK.gapX : 1;
    f.next = S.playT + rng.range(g[0], g[1]) * x;
    K.stat('ferries'); K.logEv('ferryDock');
    const open = K.openProducts();
    const buyers = Math.round(ferryBuyers(clamp(Math.round(3 + 1.6 * S.stage + open.length * 0.6), 3, 10), info.cur, info.curLit) * KALABALIK_PAY);
    for (let i = 0; i < buyers; i++) wave.push(() => {
      if (rt.queue.length < Math.min(P.QUEUE_MAX, rt.layout.queue.length)) {
        const pid = ferryPassenger(frng, info.cur, info.curLit);
        const type = pid && pid !== 'vapuryolcusu' ? citizen(pid) : undefined;
        const sleepy = info.curLit && frng.chance(NIGHT_FERRY.sleepyChance) ? frng.pick(NIGHT_FERRY.sleepy) : undefined;
        cu.spawnCustomer({ type, from: FERRY_DOOR, hiz: VAPUR_TELAFI.hiz, n: 1, patienceX: 1.4, say: sleepy });
      }
    });
    waveT = 0;
  }
  function update(dt: number) {
    f.t += dt;
    if (f.state === 'away') {
      // düdük yanaşmadan 10 sn önce (yanaşma = next - onde); fırtına bir seferi atlatır (hava.ts)
      if (f.arriveAt < 0 && S.playT >= f.next - FERRY_T.arriving - VAPUR_TELAFI.onde) {
        if (havaOf(rt)?.skipFerry()) f.next = S.playT + ferryGap(S.stage)[0] + FERRY_T.arriving;
        else { f.arriveAt = S.playT + FERRY_T.arriving; f.state = 'arriving'; f.t = 0; f.docked = false; advanceFerry(info, frng, K.hour()); K.logEv('ferryHorn'); }
      }
    } else if (f.state === 'arriving') {
      if (S.playT >= f.arriveAt) { f.arriveAt = -1; f.state = 'docked'; f.t = 0; onDock(); }
    } else if (f.state === 'docked') {
      if (f.t >= FERRY_T.docked) { f.state = 'leaving'; f.t = 0; f.docked = false; K.logEv('ferryLeave'); }
    } else if (f.state === 'leaving') {
      if (f.t >= FERRY_T.leaving) { f.state = 'away'; f.t = 0; }
    }
    w.update(dt);
    if (wave.length) { waveT -= dt; if (waveT <= 0) { waveT = 1.4; const fn = wave.shift()!; fn(); } }
  }
  return {
    update,
    // test / geliştirici kancası: bir sonraki vapuru 10 sn sonraya çeker (yolda olan vapur kendi turunu bitirir)
    force(kind?: unknown) { if (isFerryKind(kind)) info.forced = kind; if (f.state === 'away') { f.next = S.playT + 10; f.arriveAt = -1; } },
    clearWave() { wave.length = 0; },
  };
}
