// Tutorial (Builder D, M1): the v2 first-session arrows and drag hand as a pure sim system, so `tutShow` / `tutDone`
// events happen in headless runs too (the 32-step acceptance table needs `tutShow walk`). Port of v2 game.js TUT table.
// Decisions: reads the v2-shaped snapshot `rules.v2State()` every 0.2 s (cheap, no extra coupling to C's agent state);
// completion is stored in GameState.tut as `tut_<id>` = play seconds (v2 key), flags like `firstCut` are set by A/C.
// The view (arrow + ring marker, UI hand) reads `tutorial.current()`; it never writes sim state.
import type { Rules } from './sim/state';
import type { Vec2 } from '../engine/api';

export interface TutStep { id: string; urgent?: boolean; rush?: boolean; repeat?: boolean; hand?: boolean; y?: number; show(v: any): boolean; done(v: any): boolean; at?(v: any): Vec2 | null | undefined; }
export interface TutCurrent { id: string; hand: boolean; at: Vec2 | null; y: number | null; }
export interface Tutorial { current(): TutCurrent | null; steps: readonly TutStep[]; }

const padStep = (key: string): TutStep => ({
  id: 'pad_' + key,
  show: v => { const p = v.pads.find((x: any) => x.key === key); return !!p && v.money >= Math.min(p.price * 0.5, 300); },
  done: v => v.owned.includes(key),
  at: v => (v.pads.find((x: any) => x.key === key) || {}).pos,
});

export const TUT: readonly TutStep[] = [
  { id: 'cat', urgent: true, y: 0.8, show: v => !!v.cat && v.cat.state === 'rub' && !v.tutFlags.catPet, done: v => !!v.tutFlags.catPet, at: v => v.cat && v.cat.pos },
  { id: 'gull', urgent: true, y: 0.6, show: v => !!v.gull && v.gull.mode === 'stare' && !v.tutFlags.gullFirst, done: v => !!v.tutFlags.gullFirst, at: v => v.gull && v.gull.pos },
  { id: 'window', urgent: true, rush: true, show: v => !!v.window && v.window.open, done: v => !!v.tutFlags.windowSale, at: v => v.anchors.window },
  { id: 'riza', urgent: true, y: 1.9, show: v => !!v.sleeper && !v.tutFlags.rizaSleep, done: v => !!v.tutFlags.rizaSleep, at: v => v.sleeper },
  { id: 'slow', urgent: true, y: 2.8, show: v => !!v.slow && !v.tutFlags.slowTapped, done: v => !!v.tutFlags.slowTapped, at: v => v.slow && v.slow.at },
  { id: 'kapkac', urgent: true, repeat: true, y: 2.3, show: v => !!v.kap && v.kap.state === 'run', done: v => !!v.stats.kapkacCaught, at: v => v.kap && v.kap.pos },
  { id: 'walk', hand: true, show: v => v.t > 3, done: v => v.movedTotal > 1.5 || !!v.tutFlags.firstCut },
  { id: 'doner', show: v => v.t > 5 || v.movedTotal > 1.5, done: v => !!v.tutFlags.firstCut, at: v => v.anchors.stations.doner },
  { id: 'counter', show: v => v.carry.includes('doner'), done: v => !!v.tutFlags.firstDrop, at: v => v.anchors.counter },
  { id: 'money', show: v => v.kasaPile > 0, done: v => !!v.tutFlags.firstCollect, at: v => v.anchors.kasa },
  padStep('cay'),
  { id: 'cay', show: v => v.owned.includes('cay'), done: v => !!v.tutFlags.cayUsed, at: v => v.anchors.stations.cay },
  padStep('ayran'), padStep('simit'), padStep('tabure1'), padStep('isbul'),
  { id: 'isbul', show: v => v.owned.includes('isbul'), done: v => v.workers.length > 0, at: v => v.anchors.job },
  padStep('pencere'),
];

export function installTutorial(rules: Rules): Tutorial {
  let cur: TutStep | null = null;
  let curSnap: any = null;
  let shown: string | null = null;
  let acc = 0;
  const emit = (name: string, data: Record<string, unknown>) => { try { (rules.bus as any).emit(name, data); } catch { /* bus optional */ } };
  rules.addSystem({
    id: 'tutorial', order: 90, phase: 'sim',
    step(ctx: any) {
      const dt = typeof ctx?.dt === 'number' ? ctx.dt : 1 / 30;
      if (!rules.rt.started || rules.rt.paused) return;
      acc -= dt; if (acc > 0) return; acc = 0.2;
      const st = rules.state, tut = st.tut;
      const v: any = rules.v2State();
      v.tutFlags = tut; v.stats = st.stats; v.movedTotal = rules.rt.movedTotal;
      const rush = !!(v.window && v.window.open);
      let step: TutStep | null = null;
      for (const s of TUT) {
        const key = 'tut_' + s.id;
        if (tut[key] && !s.repeat) continue;
        let done = false; try { done = s.done(v); } catch { done = false; }
        if (done) { if (!tut[key]) { tut[key] = Math.round(st.playT); emit('tutDone', { id: s.id }); } continue; }
        if (step) continue;
        if (rush && !s.rush) continue;
        let show = false; try { show = s.show(v); } catch { show = false; }
        if (show) step = s;
      }
      if (step && shown !== step.id) { shown = step.id; emit('tutShow', { id: step.id }); }
      if (!step && shown) shown = null;
      cur = step; curSnap = v;
    },
  });
  return {
    steps: TUT,
    current() {
      if (!cur) return null;
      let at: Vec2 | null = null;
      try { at = cur.at ? (cur.at(curSnap) as Vec2 | null) || null : null; } catch { at = null; }
      return { id: cur.id, hand: !!cur.hand, at, y: cur.y ?? null };
    },
  };
}
