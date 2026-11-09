// 2026-11-09 survey: büfe mutfağı: stations unlock with the stage, kitchen roles open by stage + slots, they work inside the room
// (never as world actors) and speed the stations / raise tips.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mutfakEsya, mutfakSlot, mutfakEtki, MUTFAK_ISTASYON } from '../../src/content/mutfak';
import { roleOpen } from '../../src/game/sim/agents/hiring';
import { IC_BY_ID, icColliders } from '../../src/content/ic-mekan';

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
  expect(sim.h?.workers?.rows?.().some((r: any) => r.role === 'asci') ?? false).toBe(false);   // not a world actor
  expect(mutfakEtki([{ role: 'asci', xp: 0 }]).hiz).toBeGreaterThan(0); expect(mutfakEtki([{ role: 'kasiyer', xp: 0 }]).bahsis).toBeGreaterThan(0);
  expect(mutfakEtki([{ role: 'sef', xp: 25000 }]).hiz).toBeGreaterThan(mutfakEtki([{ role: 'sef', xp: 0 }]).hiz);
});
