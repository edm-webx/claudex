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
/** 2026-11-28 ekonomi paritesi: vapur dalga anından `onde` sn önce yanaşır (iskele inmiş olsun); yolcular dalga anında, promenattan doğacak
 *  müşteriyle aynı rng ve aynı varış anıyla doğar, yalnız kapıdan iner ve yol oranında hızlı adım yürür (customers.ts `inis`). */
export const VAPUR_TELAFI = { onde: 6 } as const;
/** gece seyrek: düdük bu saat aralığına düşerse (oyun saati, 24 = gece yarısı) bir sonraki aralık bu kadar uzar */
export const GECE_SEYREK = { from: 24.5, to: 30, gapX: 1.8 } as const;

export function installFerry(K: Kernel, cu: ReturnType<typeof installCustomers>, w: { open(): void; close(): void; update(dt: number): void }) {
  const rt = K.rt, S = K.state, f = rt.ferry, rng = K.R.main;
  const wave: (() => void)[] = []; let waveT = 0;
  const citizen = (id: string) => CITIZENS.find(t => t.id === id)!;
  // ekonomi akışı 'sim.ferry' (yolcu tipi), vapur çeşidi / gece ampulü / uykulu söz ayrı akıştan: görsel seçim ekonomiyi kaydırmaz
  const frng = K.rng('sim.ferry'), trng = K.rng('sim.ferry.tur');
  const info = rt.ferryInfo = newFerryInfo();
  const gece = () => { const h = K.hour(); return h >= GECE_SEYREK.from && h < GECE_SEYREK.to; };
  let hornFor = -1, dockAt = -1;
  // ── ekonomi: eski kalabalık dalgasıyla birebir (aynı an, aynı sayı, aynı rng; çeşit çarpanı yok) ──
  function onWave() {
    const g = ferryGap(S.stage);
    f.next = S.playT + rng.range(g[0], g[1]) * (gece() ? GECE_SEYREK.gapX : 1);
    const open = K.openProducts();
    const buyers = Math.round(ferryBuyers(clamp(Math.round(3 + 1.6 * S.stage + open.length * 0.6), 3, 10), 'sehir', false) * KALABALIK_PAY);
    const lit = info.curLit;
    for (let i = 0; i < buyers; i++) wave.push(() => {
      if (rt.queue.length < Math.min(P.QUEUE_MAX, rt.layout.queue.length)) {
        const pid = ferryPassenger(frng, 'sehir', false);
        const type = pid && pid !== 'vapuryolcusu' ? citizen(pid) : undefined;
        const sleepy = lit && trng.chance(NIGHT_FERRY.sleepyChance) ? trng.pick(NIGHT_FERRY.sleepy) : undefined;
        // vapur yanaşmışsa yolcu iskele kapısından iner (varış anı yine aynı); fırtınada vapur gelmediyse promenattan
        cu.spawnCustomer({ type, n: 1, patienceX: 1.4, inis: f.state === 'docked' ? FERRY_DOOR : undefined, say: sleepy });
      }
    });
    waveT = 0;
  }
  function update(dt: number) {
    // dalga zamanlaması (değişmedi): düdük anı next - 10, dalga next'te
    if (f.arriveAt < 0 && S.playT >= f.next - FERRY_T.arriving) { if (havaOf(rt)?.skipFerry()) f.next = S.playT + ferryGap(S.stage)[0] + FERRY_T.arriving; else f.arriveAt = S.playT + FERRY_T.arriving; }
    if (f.arriveAt >= 0 && S.playT >= f.arriveAt) { f.arriveAt = -1; onWave(); }
    // ── görsel vapur: dalgadan VAPUR_TELAFI.onde sn önce yanaşır, iskele indirilir, yolcular dalga anında inmeye başlar ──
    f.t += dt;
    if (f.state === 'away') {
      if (hornFor !== f.next && S.playT >= f.next - FERRY_T.arriving - VAPUR_TELAFI.onde) {
        hornFor = f.next; dockAt = f.next - VAPUR_TELAFI.onde; f.phaseLen = dockAt;
        f.state = 'arriving'; f.t = 0; f.docked = false; advanceFerry(info, trng, K.hour()); K.logEv('ferryHorn');
      }
    } else if (f.state === 'arriving') {
      if (S.playT >= dockAt) { f.state = 'docked'; f.t = 0; f.docked = true; K.stat('ferries'); K.logEv('ferryDock'); }
    } else if (f.state === 'docked') {
      if (f.t >= FERRY_T.docked && !wave.length) { f.state = 'leaving'; f.t = 0; f.docked = false; K.logEv('ferryLeave'); }
    } else if (f.state === 'leaving') {
      if (f.t >= FERRY_T.leaving) { f.state = 'away'; f.t = 0; }
    }
    w.update(dt);
    if (wave.length) { waveT -= dt; if (waveT <= 0) { waveT = 1.4; const fn = wave.shift()!; fn(); } }
  }
  return {
    update,
    // test / geliştirici kancası (eskisi gibi): dalga 10 sn sonra; vapur hemen düdük çalar
    force(kind?: unknown) { if (isFerryKind(kind)) info.forced = kind; f.next = S.playT + 10; f.arriveAt = -1; },
    clearWave() { wave.length = 0; },
  };
}
