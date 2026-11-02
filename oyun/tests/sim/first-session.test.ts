// M1 acceptance 1 + 2 + 3 (headless): the v2 32-step first-session table played by the ported bot on seeds 1..5,
// economy parity against the captured v2 bot curve, and the dwell rule with all stations built.
// Needs Builder A's rules (sim.rules / sim.command / v2State). Owner: Builder D.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
// @ts-expect-error plain ESM JS shared with the browser bot
import { makeBot, evaluate, flattenLog, STEPS } from '../../src/game/ui/bot-ai.mjs';
import { panelModel } from '../../src/game/sim/panels';

const log = { info() {}, warn() {}, error() {} };

/** Adapter: the bot's `B` over a headless sim (same surface the browser hooks expose). */
export function adapter(sim: any) {
  const rules = () => sim.rules;
  return {
    state: () => rules().v2State(),
    input: (x: number, z: number) => sim.input({ x, z }),
    path: (a: any, b: any) => { const p = sim.nav.path(a, b); return p && p.length ? p.map((q: any) => ({ x: q.x, z: q.z })) : [{ x: b.x, z: b.z }]; },
    claimOrder: (id: string) => sim.command({ kind: 'claimOrder', id }),
    panelModel: (id: string) => panelModel(id as any, rules()),
    upgradeTier: (id: string) => sim.command({ kind: 'upgradeTier', id }),
    decorBuy: (id: string) => sim.command({ kind: 'decorBuy', id }),
    saveSign: (text: string, font: string) => sim.command({ kind: 'saveSign', text, font }),
    signSet: () => !!rules().state.sign,
    skipCeremony: () => sim.command({ kind: 'skipCeremony' }),
    tapSlow: () => sim.command({ kind: 'tapSlow' }),
    solution: () => (rules().rt.uiLast.solution as any) || null,
    acceptSolution: () => sim.command({ kind: 'acceptSolution' }),
    jobBoardModel: () => panelModel('jobBoard', rules()) as any,
    hireCandidate: (id: string) => sim.command({ kind: 'hireCandidate', id }),
  };
}

export function runBot(seed: number, seconds: number, onSecond?: (t: number, sim: any, bot: any) => void) {
  const sim: any = createSim({ seed, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  const bot = makeBot(adapter(sim));
  const catAsleep = (() => { const s = sim.rules.v2State(); return s.cat ? s.cat.state === 'sleep' : false; })();
  for (let sec = 0; sec < seconds; sec++) {
    for (let i = 0; i < 10; i++) { bot.tick(); sim.step(0.1); }
    onSecond?.(sec, sim, bot);
  }
  const events = flattenLog(sim.events(0));
  return { sim, bot, events, catAsleep };
}

describe('first session (v2 STEPS table)', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`seed ${seed}: 32/32 steps`, () => {
      const r = runBot(seed, 1700);
      const ev = evaluate(r.events, { catAsleep: r.catAsleep });
      const failed = ev.rows.filter((x: any) => !x.ok).map((x: any) => `${x.st.gdd} ${x.st.what} (t=${x.t}, max=${x.st.max})`);
      expect(failed, 'failed steps').toEqual([]);
      expect(ev.pass).toBe(STEPS.length);
    }, 300000);
  }
});

describe('economy parity with the v2 bot curve', () => {
  const file = new URL('../fixtures/v2-curve.json', import.meta.url);
  it.skipIf(!existsSync(file))('cumulative earnings after day 1, 3, 5 within 15 % of the Faz 2 bot curve, first unlocks within 20 %', () => {
    const fx = JSON.parse(readFileSync(file, 'utf8'));
    const dayLen = fx.gameDayS as number;   // the fixture's time base (240 s): the rate is compared, not the 8-min day length
    const secs = Math.ceil(dayLen * 5) + 5;
    const at: Record<number, number> = {};
    const r = runBot(1, secs, (sec, sim) => { for (const d of [1, 3, 5]) if (sec === Math.round(dayLen * d)) at[d] = sim.rules.state.totalEarned; });
    for (const d of [1, 3, 5]) {
      // Faz 2 re-baseline: the economy is deliberately flatter than v2 (user: "ekonomi çok cömert"), so the bot curve is
      // compared with the Faz 2 numbers recorded on this build. The v2 fixture is still kept for the unlock order.
      // Survey 2026-10-24 re-baseline: tips and offline income are off by the user's answers, so the Faz 2 numbers
      // (4601 / 15506 / 36317) no longer apply. These are measured on the survey build; the v2 fixture still fixes unlock order.
      // 2026-10-24 re-baseline: the sim day used to end at 240 s (16:00); with one clock (480 s, 08:00-03:00) the same
      // 240 s marks fall at different hours, so the early curve moved (day 5 stayed within 4 %).
      // 2026-10-24 re-baseline: user asked for a bit faster money (cheaper ingredients, more walk-ins)
      const FAZ2_CUM: Record<number, number> = { 1: 5432, 3: 18192, 5: 33838 };
      const ref = FAZ2_CUM[d];
      expect(Math.abs(at[d] - ref) / ref, `day ${d}: ${at[d]} vs v2 ${ref}`).toBeLessThanOrEqual(0.15);
    }
    for (const [key, tv2] of Object.entries(fx.firstUnlock as Record<string, number>)) {
      const e = r.events.find((x: any) => x.ev === 'unlock' && x.key === key);
      expect(e, `unlock ${key}`).toBeTruthy();
      expect(Math.abs(e.t - tv2) / tv2, `unlock ${key}: ${e.t} vs ${tv2}`).toBeLessThanOrEqual(0.2);
    }
  }, 600000);
});

describe('dwell rule in play', () => {
  it('walking counter -> window past four stations at full speed grabs nothing', () => {
    const sim: any = createSim({ seed: 1, content: emptyContent() }, { log });
    sim.command({ kind: 'play', hero: 'sabri' });
    for (const k of ['cay', 'ayran', 'simit', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'money', value: 100000 });
    const s0 = sim.rules.v2State();
    const route = [s0.anchors.counter, ...['doner', 'cay', 'ayran', 'simit'].map(k => s0.anchors.stations[k]), s0.anchors.window];
    sim.command({ kind: 'teleport', x: route[0].x, z: route[0].z });
    for (const wp of route.slice(1)) {
      for (let i = 0; i < 600; i++) {
        const p = sim.rules.v2State().pos, dx = wp.x - p.x, dz = wp.z - p.z, L = Math.hypot(dx, dz);
        if (L < 0.9) break;
        sim.input({ x: dx / L, z: dz / L }); sim.step(0.1);
      }
    }
    sim.input({ x: 0, z: 0 });
    expect(sim.rules.v2State().carry).toEqual([]);
  });
});
