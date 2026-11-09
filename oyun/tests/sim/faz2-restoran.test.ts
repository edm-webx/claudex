// Faz 2: adisyon tickets appear for table guests at the çay bahçesi stage; stands sell on impulse.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { restoranApi } from '../../src/game/sim/restoran';

describe('Faz 2 restoran', () => {
  it('masaya oturan müşteri adisyon açar, süre dolunca gider', () => {
    const sim: any = played(4);
    for (let i = 0; i < 60; i++) sim.step(0.1);
    sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'stage', value: 3 });
    let maxT = 0, served = 0;
    for (let s = 0; s < 400; s++) { for (let i = 0; i < 10; i++) sim.step(0.1); const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; } const v = restoranApi(sim.rules)!.view(); maxT = Math.max(maxT, v.tickets.length); }
    const ev = sim.events(0).map((e: any) => e.name);
    const v = restoranApi(sim.rules)!.view();
    console.log('tickets max', maxT, 'ticket ev', ev.filter((n: string) => n === 'ticket').length, 'stantSale', ev.filter((n: string) => n === 'stantSale').length, 'servis', v.servis, 'stands', v.stands.filter(s => s.owned).map(s => s.id + ':' + s.stock).join(','));
    expect(ev.filter((n: string) => n === 'ticket').length).toBeGreaterThan(0);
    expect(v.stands.length).toBe(0);   // 2026-11-08: all street carts are gone (kestane/mısır removed)
  }, 120000);
});
describe('garson masa turu', () => {
  it('garson menüyü getirir, hesabı getirir', () => {
    const sim: any = played(4);
    for (let i = 0; i < 60; i++) sim.step(0.1);
    sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
    for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.command({ kind: 'force', what: 'stage', value: 3 });
    sim.state.workers.push({ id: 501, name: 'Nazlı', role: 'garson', xp: 0, morale: 70, traits: ['hamarat'] });
    for (let s = 0; s < 500; s++) { for (let i = 0; i < 10; i++) sim.step(0.1); const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; }
      for (const p of ['cay', 'ayran', 'simit', 'tost', 'gazoz', 'doner']) { const b = (r.counter[p] ||= []); if (b.length < 4) b.push({ type: p, tier: 1 }); } }   // the kitchen keeps the pass stocked
    expect(sim.state.stats.menuGetir || 0).toBeGreaterThan(0);
    expect(sim.state.stats.hesapGetir || 0).toBeGreaterThan(0);
  });
});
