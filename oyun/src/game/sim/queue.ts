/** Slow-spot monitor (red icon with a solution card, v2 slowCheck / slowSolution / tapSlow / acceptSolution). Owner: Builder A. Pure. */
import { P } from '../../content/economy';
import { STATIONS } from '../../content/products';
import { ROLES } from '../../content/ranks';
import { standAt, outAt } from './stations';
import { makeBoard, hireCandidate, roleOpen, type JobCard } from './agents/hiring';
import type { GameState } from './schema';
import type { Kernel, Order } from './state';
import type { ProductId } from './schema';

export function installQueue(K: Kernel, orderLeft: (c: { order: Order; got: Order }) => Order) {
  const rt = K.rt, S = K.state;
  const T0: Record<string, number> = {};
  K.hasRole = role => S.workers.some(w => w.role === role);
  const host = () => K.hiringHost();
  const sample = (): JobCard[] => {
    const tmp = { ...S, jobCards: null } as GameState;
    return makeBoard(tmp, host(), K.R.board);
  };
  type WRow = { name: string; role: string; state: string };
  const wrows = (): WRow[] => ((rt as unknown as { agents?: { workers?: { rows(): WRow[] } } }).agents?.workers?.rows() || []);
  const pname = (k?: string) => (k && STATIONS[k as ProductId] ? STATIONS[k as ProductId].name : '');
  /** First product the front of the line wants that is not on the counter (what the line is actually stuck on). */
  const stuckOn = (): ProductId | null => {
    for (const c of rt.queue.slice(0, 3)) { const left = orderLeft(c); for (const k in left) if (left[k as ProductId] && !(rt.counter[k as ProductId] || []).length) return k as ProductId; }
    return null;
  };
  K.slowSolution = (link, station) => {
    // 2026-10-24: a worker who is asleep or on a selfie break is the cause, not a missing hire
    const role = station ? STATIONS[station as ProductId]?.role : null;
    const lazy = wrows().find(w => (link === 'production' ? w.role === role : link === 'transport' || link === 'queue' ? w.role === 'garson' : false) && (w.state === 'sleep' || w.state === 'selfie'));
    if (lazy) return { title: lazy.name + (lazy.state === 'sleep' ? ' uyuyor!' : ' selfie çekiyor!'), text: 'İş durdu. Yanına git, ' + (lazy.state === 'sleep' ? 'dürt uyandır' : 'telefonu bıraksın') + '; uyanınca bir süre çift hızlı çalışır.', cost: 0, info: true };
    if (link === 'transport' || link === 'queue') {
      const cards = sample();
      const cand = cards.find(c => c.legend === 'nazli') || cards.find(c => c.role === 'garson') || (roleOpen(S, host(), 'garson') ? null : null);
      if (cand) return { title: link === 'transport' ? 'Tepside ürün birikti!' : 'Kuyruk çok uzun!', text: (station && STATIONS[station as ProductId] ? STATIONS[station as ProductId].name + ' doldu taştı, taşıyan yok. ' : 'Müşteriler bekliyor. ') + cand.name + ' garson olarak hemen başlayabilir: ' + cand.trait.name + '. ' + cand.trait.effect + '.', cost: cand.price, cand };
      if (link === 'transport') return { title: 'Tepside ürün birikti!', text: pname(station) + ' doldu taştı, taşıyan yok. Tepsiden alıp tezgaha sen koy; iş ilanı panosuna yeni garson düşünce onu tut.', cost: 0, info: true };
      const k = stuckOn();
      return { title: 'Kuyruk çok uzun!', text: k ? 'Tezgahta ' + pname(k) + ' bitti, sıra onu bekliyor. ' + pname(k) + ' yap ya da tezgaha taşı.' : 'Müşteriler sırada bekliyor. Kasaya geç ve hızlıca ver.', cost: 0, info: true };
    }
    if (link === 'production' && station) {
      const role = STATIONS[station as ProductId]?.role;
      if (role) {
        const cand = sample().find(c => c.role === role);
        if (cand) return { title: STATIONS[station as ProductId].name + ' yetişmiyor!', text: 'Bir ' + ROLES[cand.role].label.toLocaleLowerCase('tr') + ' tut: ' + cand.name + ' (' + cand.trait.name + ').', cost: cand.price, cand };
      }
      return { title: pname(station) + ' yetişmiyor!', text: 'Müşteri ' + pname(station) + ' istiyor ama başında kimse yok. Git kendin yap; iş ilanı panosuna ' + (role && ROLES[role] ? ROLES[role].label.toLocaleLowerCase('tr') : 'usta') + ' düşünce onu tut.', cost: 0, info: true };
    }
    if (link === 'kasa' && S.magnet < 1) return { title: 'Kasada para birikti!', text: 'Mıknatıslı önlük alırsan para kendiliğinden gelir.', cost: P.MAGNET_COST[1], magnet: true };
    if (link === 'seats') return { title: 'Oturacak yer yok!', text: 'Oturmak isteyenler ayakta kaldı. Sıradaki masa sarı karede seni bekliyor.', cost: 0, info: true };
    if (link === 'kasa') return { title: 'Kasada para birikti!', text: 'Kasaya uğra, parayı topla.', cost: 0, info: true };
    return { title: 'İş yavaşladı', text: 'Kırmızı işaretin olduğu yere git, orada bekleyen iş var.', cost: 0, info: true };
  };
  let sol: (Record<string, unknown> & { used?: boolean }) | null = null;
  const cool: Record<string, number> = {};
  const tick = (k: string, on: boolean, dt: number) => { T0[k] = on ? (T0[k] || 0) + dt : 0; return T0[k] > P.SLOW_S; };
  function check(dt: number): void {
    let found: { link: 'transport' | 'production' | 'queue' | 'kasa' | 'seats'; station?: ProductId; at: { x: number; z: number } } | null = null;
    for (const k of ['doner', 'cay', 'tost'] as ProductId[]) {
      const on = rt.stations[k].built && rt.stations[k].out.length >= 6 && !K.hasRole('garson') && S.playT >= 700;
      if (tick('transport_' + k, on, dt) && !found) found = { link: 'transport', station: k, at: outAt(rt.layout, k) };
    }
    for (const k of ['doner', 'cay', 'tost'] as ProductId[]) {
      const want = rt.queue.slice(0, 3).some(c => orderLeft(c)[k]);
      const working = Object.keys(rt.stations[k].prog).length > 0 && K.ctx.t - rt.stations[k].opT < 1;
      const on = rt.stations[k].built && want && !rt.counter[k].length && !rt.stations[k].out.length && !working && K.hiredCount() >= 1 && S.playT >= 900;
      if (tick('production_' + k, on, dt) && !found) found = { link: 'production', station: k, at: standAt(rt.layout, k) };
    }
    const late = S.playT >= 900;
    // 2026-10-24 ("bir yer tıkandı arada bir"): length alone fired on every ferry rush while the counter was full.
    // Now only people standing in line count, and only when the front is waiting on something the counter lacks.
    const inLine = rt.queue.filter(c => (c as { state?: string }).state === 'queue').length;
    if (tick('queue', late && inLine >= 7 && !!stuckOn() && K.hiredCount() >= 1, dt) && !found) found = { link: 'queue', at: rt.layout.queue[3] || rt.layout.queue[0] };
    if (tick('kasa', late && rt.kasa.length >= 24 && S.magnet < 1, dt) && !found) found = { link: 'kasa', at: rt.layout.kasa.pile };
    if (rt.slowSeat >= 6 && !found && late && K.tablesBuilt() >= 2 && K.tablesBuilt() < rt.layout.tables.length) { const t = rt.layout.tables[K.tablesBuilt()] || rt.layout.tables[0]; found = { link: 'seats', at: { x: t.x, z: t.z } }; }
    if (rt.slowSeat >= 6) rt.slowSeat = 0;
    if (found && (cool[found.link + (found.station || '')] || 0) > S.playT) found = null;
    if (found && !rt.slow) {
      rt.slow = { link: found.link, station: found.station, at: { x: found.at.x, z: found.at.z }, t: 0 };
      S.today!.slow[found.link] = (S.today!.slow[found.link] || 0) + 1;
      K.logEv('slowIcon', { link: found.link, station: found.station });
      if (!S.tut.slowSeen) { S.tut.slowSeen = 1; K.toast('Kırmızı işarete dokun: bir yer tıkandı!', 'bad'); }
    }
    // an icon that times out unanswered rests for 3 min before the same warning comes back (was every 40 s)
    if (rt.slow) { rt.slow.t += dt; if (rt.slow.t > 40 && !rt.slowCard) { cool[rt.slow.link + (rt.slow.station || '')] = S.playT + 180; rt.slow = null; } }
  }
  let acc = 0;
  const update = (dt: number) => { acc += dt; if (acc >= 0.25) { check(acc); acc = 0; } };
  const tap = () => {
    const s = rt.slow; if (!s) return;
    const sl = K.slowSolution(s.link, s.station);
    sol = sl as typeof sol; rt.slowCard = sl;
    S.tut.slowTapped = 1;
    K.logEv('slowTap', { link: s.link });
    K.openOverlay('solution', { title: sl.title, text: sl.text, cost: sl.cost });
  };
  K.acceptSolution = () => {
    const sl = sol; if (!sl || sl.used) return;
    sl.used = true; rt.slowCard = null;
    if (sl.cand) { if (hireCandidate(S, host(), K.R.board, sl.cand as JobCard)) { K.logEv('hire', { name: (sl.cand as JobCard).name, role: (sl.cand as JobCard).role, price: (sl.cand as JobCard).price }); rt.slow = null; for (const k in T0) T0[k] = 0; } }
    else if (sl.magnet) { if (S.money >= (sl.cost as number)) { K.spend(sl.cost as number); S.magnet = Math.max(1, S.magnet); K.toast('Mıknatıslı önlük takıldı!', 'good'); rt.slow = null; } else K.toast('Para yetmiyor abi.', 'bad'); }
    else { if (rt.slow) cool[rt.slow.link + (rt.slow.station || '')] = S.playT + 120; rt.slow = null; }
    delete rt.uiLast.solution;
    sol = null;
  };
  return { update, tap };
}
