// Faz 2: the economy must stay sane (old build: 46 milyar ₺ in 90 minutes). A bot plays 45 real minutes.
import { describe, it, expect } from 'vitest';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
// @ts-expect-error plain ESM JS shared with the browser bot
import { makeBot } from '../../src/game/ui/bot-ai.mjs';
import { panelModel } from '../../src/game/sim/panels';
const log = { info() {}, warn() {}, error() {} };
function adapter(sim: any) {
  const rules = () => sim.rules;
  return {
    state: () => rules().v2State(), input: (x: number, z: number) => sim.input({ x, z }),
    path: (a: any, b: any) => { const p = sim.nav.path(a, b); return p && p.length ? p.map((q: any) => ({ x: q.x, z: q.z })) : [{ x: b.x, z: b.z }]; },
    claimOrder: (id: string) => sim.command({ kind: 'claimOrder', id }), panelModel: (id: string) => panelModel(id as any, rules()),
    upgradeTier: (id: string) => sim.command({ kind: 'upgradeTier', id }), decorBuy: (id: string) => sim.command({ kind: 'decorBuy', id }),
    saveSign: (text: string, font: string) => sim.command({ kind: 'saveSign', text, font }), signSet: () => !!rules().state.sign,
    skipCeremony: () => sim.command({ kind: 'skipCeremony' }), tapSlow: () => sim.command({ kind: 'tapSlow' }),
    solution: () => (rules().rt.uiLast.solution as any) || null, acceptSolution: () => sim.command({ kind: 'acceptSolution' }),
    jobBoardModel: () => panelModel('jobBoard', rules()) as any, hireCandidate: (id: string) => sim.command({ kind: 'hireCandidate', id }),
  };
}
function runBot(seed: number, seconds: number, onSecond?: (t: number, sim: any) => void) {
  const sim: any = createSim({ seed, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' });
  const bot = makeBot(adapter(sim));
  for (let sec = 0; sec < seconds; sec++) { for (let i = 0; i < 10; i++) { bot.tick(); sim.step(0.1); } const R = sim.rules.rt; if (R.paused) { R.paused = false; R.pauseWhy = ''; } onSecond?.(sec, sim); }
  return { sim };
}

describe('Faz 2 ekonomi', () => {
  it('45 dakikada para makul kalır', () => {
    const marks: string[] = [];
    const r = runBot(3, 5400, (t, sim) => { if (t % 300 === 299) { const S = sim.rules.state; marks.push(`${(t + 1) / 60}dk: cep ${Math.round(S.money)} toplam ${Math.round(S.totalEarned)} gün ${S.day} aşama ${S.stage}`); } });
    const S = r.sim.rules.state;
    console.log(marks.join('\n'));
    const ev = r.sim.events(0); const agg: Record<string, [number, number]> = {};
    for (const e of ev) { const d: any = e.data || e; const v = Number(d.value ?? d.v ?? d.reward ?? d.bonus ?? d.amount ?? 0); const a = agg[e.name] || (agg[e.name] = [0, 0]); a[0]++; a[1] += v || 0; }
    console.log(Object.entries(agg).filter(([, a]) => a[1] > 0).map(([k, a]) => k + ' n=' + a[0] + ' sum=' + Math.round(a[1])).join('\n'));
    expect(S.totalEarned).toBeLessThan(2_000_000);
    expect(S.totalEarned).toBeGreaterThan(3_000);
  }, 600000);
});
