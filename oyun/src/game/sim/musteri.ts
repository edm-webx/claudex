/**
 * Müşteri istekleri (survey musteri-2, musteri-4, musteri-7, icecek-2). Pure sim module, runs right after rules.
 * - Special requests: ~1 in 6 fresh queue customers get one small wish fitting a product in their order
 *   ('soğansız', 'açık olsun', 'demli olsun'...). Serving that order pays +10 % extra tip and shows a heart.
 *   No failure state: a request is a bonus only.
 * - Tourists: kruvaziyer / turgrubu / gezgin customers (cap + camera looks) say comic pronunciations ('Simmit!'),
 *   Sabri answers with hands and arms, and after a sale they may photograph the büfe (chance grows with şıklık):
 *   'musteriPhoto' bus event (view flashes) + toast. Once a day from day 2 a flag-carrying guide brings a wave.
 * - Hearts: a customer served while still happy (patience > 50 %) or finishing a meal leaves with a heart (heartT).
 * Customer fields used (runtime only): req, reqP, tourist, heartT (state.ts). Decision: no new persistent state.
 */
import type { System } from '../../engine/api';
import type { Kernel, Customer, CustomerState } from './state';
import type { ProductId } from './schema';
import type { installCustomers } from './customers';
import { CITIZENS } from '../../content/citizens';
import { REQUESTS, REQUEST_CHANCE, REQUEST_TIP, REQUEST_THANKS, TOURIST_TYPES, TOURIST_SAY, TOURIST_THANKS, SABRI_GESTURE, PHOTO_TOAST, GUIDE_WAVE } from '../../content/musteri';

type CustomersApi = ReturnType<typeof installCustomers>;
interface Seen { st: CustomerState; got: number; }

export function installMusteri(K: Kernel, cu: CustomersApi): void {
  const rt = K.rt, rng = K.rng('sim.musteri');
  const seen = new Map<number, Seen>();
  const gotN = (c: Customer) => { let n = 0; for (const k in c.got) n += c.got[k as ProductId] || 0; return n; };
  const say = (c: Customer, t: string, s = 2.4) => { c.say = t; c.sayT = s; };
  let waveDay = -1, waveAt = -1;

  function tag(c: Customer) {
    if (c.kind !== 'q') return;
    c.tourist = TOURIST_TYPES.includes(c.typeId);
    if (c.tourist || c.follower || !rng.chance(REQUEST_CHANCE)) return;
    const prods = (Object.keys(c.order) as ProductId[]).filter(p => (c.order[p] || 0) > 0 && REQUESTS[p]);
    if (!prods.length) return;
    const p = rng.pick(prods);
    c.reqP = p; c.req = rng.pick(REQUESTS[p]);
  }
  const touristLine = (c: Customer) => {
    const prods = (Object.keys(c.order) as ProductId[]).filter(p => (c.order[p] || 0) > (c.got[p] || 0) && TOURIST_SAY[p]);
    const p = prods.length ? rng.pick(prods) : 'cay';
    return rng.pick(TOURIST_SAY[p]);
  };

  function served(c: Customer) {
    const ratio = c.patience / Math.max(0.01, c.patMax);
    if (c.req) {
      const bonus = Math.max(2, Math.round(c.value * REQUEST_TIP));
      K.earn(bonus, { x: c.x, z: c.z });
      say(c, rng.pick(REQUEST_THANKS) + ' (' + c.req + ')', 2.6);
      c.heartT = 2.6;
      K.stat('istekOk');
    } else if (ratio > 0.5) c.heartT = 2.2;
    if (c.tourist) {
      if (!c.req) say(c, rng.pick(TOURIST_THANKS), 2.4);
      const chance = 0.15 + 0.5 * Math.min(100, Math.max(0, rt.siklik || 0)) / 100;
      if (rng.chance(chance)) {
        K.logEv('musteriPhoto', { x: c.x, z: c.z });
        K.toast(PHOTO_TOAST, 'good');
        K.stat('turistFoto');
      }
    }
  }

  function guideWave() {
    const S = K.state;
    if (S.day < 2) return;
    if (waveDay !== S.day) { waveDay = S.day; waveAt = rng.range(10.5, 15); }
    if (waveAt < 0 || K.hour() < waveAt) return;
    if (rt.queue.length > Math.max(0, rt.layout.queue.length - 4)) return;
    waveAt = -1;
    const type = CITIZENS.find(t => t.id === 'kruvaziyer');
    if (!type) return;
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) cu.spawnCustomer({ type, n: rng.int(2, 3), say: i === 0 ? GUIDE_WAVE.say : undefined });
    K.toast(GUIDE_WAVE.toast, 'info');
  }

  const sys: System = {
    id: 'musteri', order: 21, phase: 'sim',
    step(ctx) {
      if (!rt.started || rt.paused) return;
      const dt = ctx.dt;
      guideWave();
      for (const c of rt.customers) {
        let s = seen.get(c.id);
        if (!s) { tag(c); s = { st: c.state, got: gotN(c) }; seen.set(c.id, s); }
        if (c.heartT && c.heartT > 0) c.heartT = Math.max(0, c.heartT - dt);
        const prev = s.st, now = c.state;
        if (c.tourist && now === 'queue') {
          if (prev !== 'queue') say(c, touristLine(c), 2.6);
          else if (c.sayT < -15 && rng.chance(dt * 0.05)) say(c, touristLine(c), 2.4);
          const g = gotN(c);
          if (g > s.got && s.got === 0 && rt.sayT <= 0) { rt.say = rng.pick(SABRI_GESTURE); rt.sayT = 2.4; }
          s.got = g;
        }
        if (prev === 'queue' && (now === 'toSeat' || (now === 'leave' && c.mood !== 'angry')) && c.value > 0) served(c);
        else if (prev === 'eat' && now === 'leave') c.heartT = 2.2;
        s.st = now;
      }
      if (seen.size > rt.customers.length) {
        const alive = new Set(rt.customers.map(c => c.id));
        for (const id of [...seen.keys()]) if (!alive.has(id)) seen.delete(id);
      }
    },
  };
  K.addSystem(sys);
}
