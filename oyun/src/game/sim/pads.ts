/**
 * Pads (sarı kareler, v2 syncPads / playerPads / unlock): appear when their conditions hold, fill from the player's
 * pocket while he stands on them (dwell 0), unlock stations / tables / job corner / window / trays / magnet / tadilat.
 * Owner: Builder A. Pure. Dwell: `pad.<key>` interactable (radius 0.8, pays max(price/1.2, 250) per second).
 */
import type { Vec2 } from '../../engine/api';
import { PADS, padDef, padCost, STAGE_TABLES, type PadDef2 } from '../../content/pads';
import { RENEW_ORDER, RENEW_PARTS } from '../../content/stages';
import { P } from '../../content/economy';
import { LINES } from '../../content/lines';
import { STATIONS } from '../../content/products';
import type { Kernel, PadRt } from './state';
import { standAt } from './stations';
import { clamp, fmtMoney } from './util';
import { TABLE_PADS } from '../../content/prefabs/iskele/layout';

export function padPos(K: Kernel, d: PadDef2): Vec2 {
  const L = K.rt.layout;
  if (d.kind === 'station' && d.station) return standAt(L, d.station);
  if (d.kind === 'table') { const t = L.tables[d.table ?? TABLE_PADS[d.key] ?? 0]; return t ? { x: t.x, z: t.z } : { x: 0, z: 0 }; }
  if (d.kind === 'job') return { x: L.job.pos.x, z: L.job.pos.z };
  const e = L.extraPads[d.key];
  return e ? { x: e.x, z: e.z } : { x: 0, z: 0 };
}

/** 2026-10-25 user: a trash bin outside the kitchen; when the hands are too full for the counter, drop everything here */
export const binPos = (K: { rt: { layout: { counter: { pos: { x: number; z: number } } } } }): Vec2 => ({ x: K.rt.layout.counter.pos.x - 4.4, z: K.rt.layout.counter.pos.z + 1.6 });

export function installPads(K: Kernel): { update(dt: number): void } {
  const rt = K.rt, S = K.state;
  K.interactions.register({
    id: 'cop.kutu', pos: binPos(K), radius: 0.95, kind: 'pickup', dwell: 0.25, interval: 0.15,
    canAct: () => rt.carry.length > 0,
    act: () => { const n = rt.carry.length; rt.carry.splice(0, n); K.toast('Çöpe attın (' + n + ' parça).', 'info'); return 'done'; },
  });
  const WHEN: Record<string, () => boolean> = {
    firstCollect: () => !!S.tut.firstCollect, cayUsed: () => !!S.tut.cayUsed, hiredOne: () => S.workers.length > 0, tadilatReady: () => K.tadilatReady(),
  };
  const available = (d: PadDef2): boolean => {
    if (d.kind !== 'tadilat' && S.owned[d.key]) return false;
    if (d.after && !d.after.every(k => (k === 'tadilat' ? S.stage >= 2 : S.owned[k]))) return false;
    if (d.stage && S.stage < d.stage) return false;
    if (d.minPlay && S.playT < d.minPlay) return false;
    if (d.when && WHEN[d.when] && !WHEN[d.when]()) return false;
    return true;
  };
  K.isbulHint = () => {
    const d = padDef('isbul'); if (!d) return 'İş ve İşçi Bulma köşesi yakında açılıyor.';
    if (available(d)) return 'İskelede sarı "İş ve İşçi Bulma" karesi açıldı. Üstüne yürü, ' + fmtMoney(padCost(d.key, S.stage)) + ' ile aç, sonra panodan işçi seç.';
    const need: string[] = [];
    const walk = (k: string) => { const q = padDef(k); if (!q || S.owned[k] || need.includes(k)) return; (q.after || []).forEach(walk); need.push(k); };
    (d.after || []).forEach(walk);
    const name = (k: string) => (k === 'tabure1' ? 'ilk tabure' : k === 'tabure2' ? 'ikinci tabure' : (padDef(k)?.label || k).toLocaleLowerCase('tr'));
    if (need.length) return 'İş ve İşçi Bulma köşesi için önce şunları aç: ' + need.map(name).join(', ') + '. İskelede fiyat yazan koyu karelerin üstüne yürü, para akınca açılır.';
    if (d.minPlay && S.playT < d.minPlay) return 'İş ve İşçi Bulma köşesi biraz sonra iskelede açılacak (yaklaşık ' + Math.max(1, Math.ceil((d.minPlay - S.playT) / 60)) + ' dakika). Satışa devam et.';
    return 'İş ve İşçi Bulma köşesi yakında açılıyor.';
  };
  const ids = new Set<string>();
  function addPad(d: PadDef2): void {
    const price = padCost(d.key, S.stage);
    const pr: PadRt = { key: d.key, price, paid: S.padPaid[d.key] || 0, pos: padPos(K, d), kind: d.kind, warned: false };
    rt.pads.push(pr);
    if (!S.tut['padSeen_' + d.key]) { S.tut['padSeen_' + d.key] = 1; K.logEv('padShown', { key: d.key, price }); }
    const id = 'pad.' + d.key; ids.add(id);
    K.interactions.register({
      id, pos: pr.pos, radius: 0.8, kind: 'pad', dwell: 0, interval: 0.05,
      canAct: () => rt.pads.includes(pr),
      act: (_a, ctx) => {
        const paid = S.padPaid[d.key] || 0, left = pr.price - paid;
        if (S.money < 1) { if (!pr.warned) { pr.warned = true; K.toast('Para lazım: müşterilere satış yap, kasayı topla.', 'info'); } return 'continue'; }
        const rate = Math.max(pr.price / 1.2, 250);
        const amt = Math.min(rate * 0.05, S.money, left);
        S.money -= amt; S.padPaid[d.key] = paid + amt; pr.paid = S.padPaid[d.key];
        if (S.padPaid[d.key] >= pr.price - 0.01) {
          S.money = Math.max(0, S.money);
          delete S.padPaid[d.key];
          removePad(d.key);
          K.unlock(d.key);
          return 'done';
        }
        void ctx;
        return 'continue';
      },
    });
  }
  function removePad(key: string): void {
    const i = rt.pads.findIndex(p => p.key === key);
    if (i >= 0) rt.pads.splice(i, 1);
    const id = 'pad.' + key;
    if (ids.delete(id)) K.interactions.unregister(id);
  }
  K.syncPads = () => {
    { const it = K.interactions.get('cop.kutu'); if (it) it.pos = binPos(K); }
    for (const d of PADS) {
      const avail = available(d), have = rt.pads.find(p => p.key === d.key);
      // 2026-10-25 user: the simit pad (K9-L9) is gone; the simit tray just opens by itself when its turn comes
      if (avail && d.key === 'simit') { K.unlock(d.key); continue; }
      if (avail && !have) addPad(d);
      else if (!avail && have) removePad(d.key);
      else if (have) {
        const pos = padPos(K, d); have.pos = pos;
        const it = K.interactions.get('pad.' + d.key); if (it) it.pos = pos;
        const pr = padCost(d.key, S.stage); have.price = pr;
      }
    }
  };
  K.setTableBuilt = (i, on) => {
    while (rt.tables.length <= i) rt.tables.push({ built: false, seats: [{ occ: 0 }, { occ: 0 }], pile: [], dirty: 0, dirtyT: 0 });
    rt.tables[i].built = !!on;
    K.syncTablesReg();
  };
  K.renewNext = () => {
    const order = RENEW_ORDER[S.stage] || RENEW_ORDER[1];
    const part = order.find(p => !S.renewed.includes(p)); if (!part) return;
    S.renewed.push(part);
    void RENEW_PARTS;
  };
  K.unlock = (key, load) => {
    const d = padDef(key); if (!d) return;
    if (d.kind === 'tadilat') { if (!load) K.startTadilat(true); return; }
    S.owned[key] = 1; delete S.padPaid[key];
    if (d.kind === 'station' && d.station) { rt.stations[d.station].built = true; K.registerStations(); }
    if (d.kind === 'table') K.setTableBuilt(d.table ?? TABLE_PADS[key] ?? 0, true);
    if (d.kind === 'magnet') S.magnet = Math.max(S.magnet, 1);
    if (load) return;
    K.addXP(d.kind === 'station' ? P.XP.station : P.XP.pad);
    K.stat('pad_' + key); K.stat('pads');
    K.renewNext();
    const msg: Record<string, string> = {
      station: (d.station ? STATIONS[d.station].name + ' açıldı!' : 'Açıldı!'), table: 'Yeni oturma yeri!', job: 'İş ve İşçi Bulma köşesi açıldı!',
      'window': 'Vapur Penceresi kuruldu! Vapur gelince sen servis yap.', tray: 'Daha büyük tepsi: +2 taşıma!', magnet: 'Mıknatıslı önlük: para kendiliğinden gelir!',
    };
    K.toast(msg[d.kind] || 'Açıldı!', 'good');
    K.logEv('unlock', { key, money: Math.round(S.money) });
    K.syncPads();
    K.saveNow();
  };
  let tick = 0;
  return { update(dt) { tick -= dt; if (tick <= 0) { tick = 0.5; K.syncPads(); } } };
  void clamp; void LINES;
}
export const STAGE_TABLE_LIST = STAGE_TABLES;
