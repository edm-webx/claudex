/** Tutorial hints (v2 TUT, the parts the sim can judge) and the hour helper. Owner: Builder A. Pure. */
import type { Kernel } from './state';
import { hourOf } from './util';

export const hourNow = (dayT: number): number => hourOf(dayT);

export function installTutorial(K: Kernel) {
  const rt = K.rt, S = K.state;
  const padStep = (key: string) => ({ id: 'pad_' + key, show: () => rt.pads.some(p => p.key === key), done: () => !!S.owned[key], urgent: false });
  const carryN = (p: string) => rt.carry.filter(i => i.type === p).length;
  const steps: { id: string; show(): boolean; done(): boolean; rush?: boolean; repeat?: boolean }[] = [
    { id: 'window', rush: true, show: () => !!rt.window?.open, done: () => !!S.tut.windowSale },
    { id: 'slow', show: () => !!rt.slow && !S.tut.slowTapped, done: () => !!S.tut.slowTapped },
    { id: 'walk', show: () => S.playT > 3, done: () => rt.movedTotal > 1.5 || !!S.tut.firstCut },
    { id: 'doner', show: () => S.playT > 5 || rt.movedTotal > 1.5, done: () => !!S.tut.firstCut },
    { id: 'counter', show: () => carryN('doner') > 0, done: () => !!S.tut.firstDrop },
    { id: 'money', show: () => rt.kasa.length > 0, done: () => !!S.tut.firstCollect },
    padStep('cay'),
    { id: 'cay', show: () => !!S.owned.cay, done: () => !!S.tut.cayUsed },
    padStep('ayran'), padStep('simit'), padStep('tabure1'), padStep('isbul'),
    { id: 'isbul', show: () => !!S.owned.isbul, done: () => S.workers.length > 0 },
    padStep('pencere'),
  ];
  return {
    update() {
      let step: (typeof steps)[number] | null = null;
      const rush = !!rt.window?.open;
      for (const s of steps) {
        const key = 'tut_' + s.id;
        if (S.tut[key] && !s.repeat) continue;
        if (s.done()) { if (!S.tut[key]) { S.tut[key] = Math.max(1, Math.round(S.playT)); K.logEv('tutDone', { id: s.id }); } continue; }
        if (step) continue;
        if (rush && !s.rush) continue;
        if (s.show()) step = s;
      }
      if (step && rt.tutStep !== step.id) { rt.tutStep = step.id; K.logEv('tutShow', { id: step.id }); }
      if (!step && rt.tutStep) rt.tutStep = null;
    },
  };
}
