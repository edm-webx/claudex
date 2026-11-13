// 2026-11-09 survey: büfe mutfağı: stations unlock with the stage, kitchen roles open by stage + slots, they work inside the room
// (real walking actors inside the room) and speed the stations / raise tips.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mutfakEsya, mutfakSlot, mutfakEtki, MUTFAK_ISTASYON } from '../../src/content/mutfak';
import { roleOpen } from '../../src/game/sim/agents/hiring';
import { makeSandbox, addWorker } from './agents-harness';
import { IC_BY_ID, icColliders, icIcinde } from '../../src/content/ic-mekan';

it('stations unlock by stage and fill the room (15 at stage 10)', () => {
  expect(mutfakEsya(2)).toEqual([]); expect(mutfakEsya(3).sort()).toEqual(['cay_bar', 'ocak', 'pass']);
  expect(mutfakEsya(10).length).toBe(MUTFAK_ISTASYON.length); expect(MUTFAK_ISTASYON.length).toBeGreaterThanOrEqual(15);
  const room = IC_BY_ID.mutfak; expect(room.z - room.wz / 2).toBeGreaterThan(-18);   // stays on the pier
  expect(icColliders(room).length).toBeGreaterThan(5);
});
it('kitchen roles: locked below their stage, slots grow, the crew helps', () => {
  expect(mutfakSlot('asci', 2)).toBe(0); expect(mutfakSlot('asci', 3)).toBe(1); expect(mutfakSlot('sef', 6)).toBe(0); expect(mutfakSlot('sef', 7)).toBe(1);
  const sim = played(1) as any; sim.step(1); const S = sim.state, host = {} as any;
  S.stage = 2; expect(roleOpen(S, host, 'asci')).toBe(false);
  S.stage = 3; expect(roleOpen(S, host, 'asci')).toBe(true); S.workers.push({ id: 99, name: 'Ali', role: 'asci', xp: 0, morale: 70, traits: ['hamarat'] });
  expect(roleOpen(S, host, 'asci')).toBe(false);   // one slot at stage 3
  sim.step(2);
  expect(mutfakEtki([{ role: 'asci', xp: 0 }]).hiz).toBeGreaterThan(0); expect(mutfakEtki([{ role: 'kasiyer', xp: 0 }]).bahsis).toBeGreaterThan(0);
  expect(mutfakEtki([{ role: 'sef', xp: 25000 }]).hiz).toBeGreaterThan(mutfakEtki([{ role: 'sef', xp: 0 }]).hiz);
});

it('a hired cook is a real actor: walks into the room, claims a ticket item, cooks it and puts the plate on the pass', () => {
  const sb = makeSandbox(1); sb.step(0.2);
  const plates: string[] = [];
  let claimed = 0;
  sb.host.kitchenClaim = () => (claimed++ === 0 ? 'doner' : null);
  sb.host.kitchenDone = (_w: number, ok: boolean) => { if (ok) plates.push('doner'); };
  addWorker(sb, 'asci', 'hamarat');
  sb.step(1);
  const r0 = sb.h.workers.rows()[0]; expect(r0.role).toBe('asci');
  sb.step(30);
  const r = sb.h.workers.rows()[0];
  expect(icIcinde(IC_BY_ID.mutfak, r, 0)).toBe(true);   // inside the kitchen room, a world actor
  expect(plates.length).toBe(1);
  expect(sb.state.workers[0].xp).toBeGreaterThan(0);
});
it('front roles (güvenlik, müzisyen, hostes...) walk to their posts out front and help', () => {
  const sb = makeSandbox(1); sb.step(0.2);
  addWorker(sb, 'guvenlik', 'hamarat'); addWorker(sb, 'muzisyen', 'hamarat');
  sb.step(25);
  const rows = sb.h.workers.rows();
  expect(rows.every((r: any) => r.state === 'front')).toBe(true);
  expect(mutfakEtki([{ role: 'muzisyen', xp: 0 }]).bahsis).toBeGreaterThan(0);
  expect(mutfakSlot('guvenlik', 3)).toBe(0); expect(mutfakSlot('guvenlik', 4)).toBe(1);
});
