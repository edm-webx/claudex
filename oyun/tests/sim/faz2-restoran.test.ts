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
    sim.command({ kind: 'restoran', op: 'buyStant', id: 'midye' });
    let maxT = 0, served = 0;
    for (let s = 0; s < 400; s++) { for (let i = 0; i < 10; i++) sim.step(0.1); const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; } const v = restoranApi(sim.rules)!.view(); maxT = Math.max(maxT, v.tickets.length); }
    const ev = sim.events(0).map((e: any) => e.name);
    const v = restoranApi(sim.rules)!.view();
    console.log('tickets max', maxT, 'ticket ev', ev.filter((n: string) => n === 'ticket').length, 'stantSale', ev.filter((n: string) => n === 'stantSale').length, 'servis', v.servis, 'stands', v.stands.filter(s => s.owned).map(s => s.id + ':' + s.stock).join(','));
    expect(ev.filter((n: string) => n === 'ticket').length).toBeGreaterThan(0);
    expect(v.stands.find(s => s.id === 'midye')!.owned).toBe(true);
  }, 120000);

  it('stant sarı kare gibi para biriktirip açılır', () => {
    const sim: any = played(4);
    for (let i = 0; i < 20; i++) sim.step(0.1);
    sim.command({ kind: 'force', what: 'money', value: 100_000 });
    sim.command({ kind: 'force', what: 'stage', value: 2 });
    for (let i = 0; i < 10; i++) sim.step(0.1);
    const pad = sim.rules.rt.pads.find((p: any) => p.key === 'stant.islak');
    expect(pad).toBeTruthy();
    sim.command({ kind: 'teleport', x: pad.pos.x, z: pad.pos.z });
    for (let i = 0; i < 40; i++) { sim.step(0.1); const r = sim.rules.rt; if (r.paused) { r.paused = false; r.pauseWhy = ''; } }
    const v = restoranApi(sim.rules)!.view();
    expect(v.stands.find(s => s.id === 'islak')!.owned).toBe(true);
    expect(sim.rules.rt.pads.some((p: any) => p.key === 'stant.islak')).toBe(false);
  }, 60000);
});
