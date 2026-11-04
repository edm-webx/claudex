/** Job board (İş ve İşçi Bulma): wraps C's pure hiring.ts with a HiringHost over the kiosk. Owner: Builder A. Pure. */
import { PADS } from '../../content/pads';
import { makeBoard, boardModel, hireCandidate, fireWorker, trainWorker, openBoard, refreshBoard, type HiringHost, type JobCard } from './agents/hiring';
import type { Kernel } from './state';

export function installBoard(K: Kernel) {
  const rt = K.rt, S = K.state;
  const host: HiringHost = {
    stationBuilt: p => !!rt.stations[p as 'doner']?.built,
    tablesBuilt: () => K.tablesBuilt(),
    padLabel: station => PADS.find(p => p.station === station)?.label || station,
    spend: v => K.spend(v),
    toast: (t, k) => K.toast(t, k),
    addXP: n => K.addXP(n),
    stat: (k, n) => K.stat(k, n),
    sfx: () => { /* audio is a view */ },
    rosterChanged: () => { K.dirty(); },
    money: () => S.money,
  };
  K.hiringHost = () => host;
  return {
    open() {
      rt.panel = null; rt.boardOpen = true;
      openBoard(S, host, K.R.board);
      K.logEv('boardOpen');
    },
    close() { rt.boardOpen = false; const z = S.zones as Record<string, { wid?: number; want?: number } | undefined>; if (z.pencere?.want) z.pencere = { wid: z.pencere.wid || 0 }; },
    model: () => boardModel(S, host, K.R.board),
    hire(id: string, free?: boolean) {
      const card = ((S.jobCards || []) as JobCard[]).find(c => c.id === id);
      const w = hireCandidate(S, host, K.R.board, id, free);
      if (w) {
        K.logEv('hire', { name: w.name, role: w.role, price: card ? card.price : 0 });
        // "Pencere elemanı al": the next hire is posted at the ferry window straight away
        const z = S.zones as Record<string, { wid?: number; want?: number } | undefined>;
        if (z.pencere?.want) { z.pencere = { wid: w.id }; K.toast(w.name + ' artık vapur penceresinde çalışacak.', 'good'); rt.boardOpen = false; }
        K.saveNow();
      }
      return !!w;
    },
    refresh() { refreshBoard(S, host, K.R.board, true); },
    fire(id: number) { fireWorker(S, host, id); K.saveNow(); },
    train(id: number) { trainWorker(S, host, id); },
    makeBoard: () => makeBoard(S, host, K.R.board),
  };
}
