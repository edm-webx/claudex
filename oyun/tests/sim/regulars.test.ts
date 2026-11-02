import { describe, it, expect } from 'vitest';
import { makeSandbox } from './agents-harness';

function blockRegulars(sb: ReturnType<typeof makeSandbox>) { for (const id of ['necati', 'nermin', 'remzi']) sb.state.regulars[id] = { visits: 1, lastDay: sb.state.day }; }
function near(sb: ReturnType<typeof makeSandbox>, x: number, z: number) { sb.player.x = x; sb.player.z = z; }

describe('regulars', () => {
  it.skip('Necati arrives, wants 2 cay + 1 simit, pays 30% extra after a deliberate hand-over', () => {
    const sb = makeSandbox(1, (s) => { s.day = 2; });
    sb.host.hour_ = 9;
    sb.h.force('regular', 'necati');
    sb.step(15);
    const cur = sb.h.regulars.current()!;
    expect(cur.id).toBe('necati');
    expect(sb.events).toContain('regularArrive');
    expect(cur.state).toBe('wait');
    // walking past with the items: nothing handed over (moving)
    sb.host.hand.push({ type: 'cay', tier: 1 }, { type: 'cay', tier: 1 }, { type: 'simit', tier: 1 });
    sb.moving.v = true; near(sb, cur.pos.x + 0.5, cur.pos.z); sb.step(2);
    expect(sb.host.hand.length).toBe(3);
    // stand still: first item after 0.4 s dwell, then every 0.18 s
    sb.moving.v = false; sb.step(1.5);
    expect(sb.host.hand.length).toBe(0);
    sb.step(1);
    expect(sb.events).toContain('regularOk');
    expect(sb.host.settled).toBe(3);
    expect(sb.host.money).toBeGreaterThan(5000);
    sb.step(40);
    expect(sb.h.regulars.current()).toBeNull();
  });
  it.skip('misses after 100 s without the order and is gone', () => {
    const sb = makeSandbox(2, (s) => { s.day = 2; });
    sb.host.hour_ = 9; sb.h.force('regular', 'necati');
    sb.step(130);
    expect(sb.events).toContain('regularMiss');
  });
});
describe('vip', () => {
  it('Gurme passes with K2 items (x5)', () => {
    const sb = makeSandbox(3, (s) => { s.day = 6; });
    sb.host.hour_ = 14; blockRegulars(sb); sb.h.force('vip');
    sb.step(15);
    const v = sb.h.vip.current()!;
    expect(v.state).toBe('wait');
    sb.host.hand.push({ type: 'doner', tier: 2 }, { type: 'ayran', tier: 3 });
    near(sb, v.pos.x + 0.5, v.pos.z);
    sb.step(12);
    expect(sb.events).toContain('vipArrive');
    expect(sb.events).toContain('gurmePass');
    expect(sb.state.gurmePass).toBe(true);
  });
  it('K1 items give only a partial sale', () => {
    const sb = makeSandbox(4, (s) => { s.day = 6; });
    sb.host.hour_ = 14; blockRegulars(sb); sb.h.force('vip'); sb.step(15);
    const v = sb.h.vip.current()!;
    sb.host.hand.push({ type: 'doner', tier: 1 }, { type: 'ayran', tier: 1 });
    near(sb, v.pos.x + 0.5, v.pos.z); sb.step(12);
    expect(sb.events).toContain('gurmePartial');
    expect(sb.state.gurmePass).toBe(false);
  });
});
describe('kapkac', () => {
  it('grabs half the kasa; caught pays back +20%', () => {
    const sb = makeSandbox(5, (s) => { s.day = 4; });
    sb.host.hour_ = 14; sb.h.force('kapkac');
    sb.player.x = -20; sb.player.z = 8;
    for (let i = 0; i < 600 && !sb.events.includes('kapkacGrab'); i++) sb.step(0.1);
    sb.step(0.5);
    expect(sb.events).toContain('kapkacGrab');
    const m0 = sb.host.money;
    const k = sb.h.kapkac.current()!;
    sb.player.x = k.pos.x; sb.player.z = k.pos.z; sb.step(0.5);
    expect(sb.events).toContain('kapkacCaught');
    expect(sb.host.money).toBeGreaterThan(m0);
  });
  it('escape spills half on the floor and owes the rest', () => {
    const sb = makeSandbox(6, (s) => { s.day = 4; });
    sb.host.hour_ = 14; sb.h.force('kapkac');
    sb.player.x = -20; sb.player.z = 8;
    sb.step(80);
    expect(sb.events).toContain('kapkacEscaped');
    expect(sb.host.floor.length).toBe(4);
    expect(sb.host.owed).toBeGreaterThan(0);
    expect(sb.h.kapkac.current()).toBeNull();
  });
  it('Karamel on duty turns him away', () => {
    const sb = makeSandbox(7, (s) => { s.day = 4; s.dog = true; });
    sb.host.hour_ = 14;
    // force duty regardless of the random block
    sb.step(0.5); sb.h.env.shared.dogDuty = true;
    sb.h.force('kapkac');
    let turned = false;
    for (let i = 0; i < 400 && !turned; i++) { sb.h.env.shared.dogDuty = true; sb.step(0.25); turned = sb.events.includes('karamelTurned'); }
    expect(turned).toBe(true);
  });
});
