// Faz 2 (item 28): a posted worker lays items out on the ferry-window counter and serves the window queue from it.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';

describe('ferry window staffing', () => {
  it('a posted worker fills the window shelf and serves the first customer from it', () => {
    const sim = played(4);
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul', 'pencere']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.tut.firstCustomer = 1;
    sim.command({ kind: 'force', what: 'ferry' });
    sim.step(14);
    const r = sim.rules, rt = r.rt as unknown as { winShelf?: string[]; pencereAt?: boolean };
    expect(rt.winShelf ?? []).toEqual([]);
    sim.step(6);
    expect(r.rt.winq.length).toBeGreaterThan(0);
    // stock the main counter, then post a worker at the window (the worker's walk would set pencereAt)
    for (const p of ['cay', 'simit', 'ayran'] as const) for (let i = 0; i < 3; i++) r.rt.counter[p].push({ type: p, tier: 1 } as never);
    const workers = sim.state.workers as { id: number }[];
    if (!workers.some(w => w.id === 1)) workers.push({ id: 1 } as never);
    (sim.state.zones as Record<string, unknown>).pencere = { wid: 1 };
    rt.pencereAt = true;
    const q0 = r.rt.winq.length;
    let laid = 0;
    for (let i = 0; i < 16; i++) { sim.step(0.5); laid = Math.max(laid, (rt.winShelf ?? []).length); }
    expect(laid).toBeGreaterThan(0);                                  // the staffer laid items out on the counter
    expect(r.rt.winq.length).toBeLessThan(q0);                        // ...and handed them to the window queue
  });
});

describe('pencere için yeni eleman', () => {
  it('tahta açılır, seçilen eleman doğrudan pencereye atanır', () => {
    const sim: any = played(4);
    sim.command({ kind: 'force', what: 'money', value: 500000 });
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'isbul', 'pencere']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'pencere', op: 'hire' });
    expect(sim.rules.rt.boardOpen).toBe(true);
    const id = (sim.state.jobCards as { id: string }[])[0].id;
    sim.command({ kind: 'hireCandidate', id });
    const wid = Number((sim.state.zones.pencere as { wid?: number }).wid);
    expect(wid).toBeGreaterThan(0);
    expect((sim.state.workers as { id: number }[]).some(w => w.id === wid)).toBe(true);
    expect(sim.rules.rt.boardOpen).toBe(false);
  });
});
