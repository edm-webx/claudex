// Karar paketi J1: three realms, the 42B is the only way between them; boarding works at every stop (Belgrad dönüş fix).
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { disariApi } from '../../src/game/sim/disari';
import { REALM_BY_ID, realmSpawn } from '../../src/content/realm';

const ride = (sim: ReturnType<typeof played>, from: 'iskele' | 'stadyum' | 'belgrad', to: string) => {
  const st = REALM_BY_ID[from].stop;
  sim.command({ kind: 'teleport', x: st.x, z: st.z });
  sim.step(0.5);
  sim.command({ kind: 'disari', op: 'otobusBekle' });
  sim.step(8);
  sim.command({ kind: 'teleport', x: st.x + 1.5, z: st.z - 1.0 });
  sim.command({ kind: 'disari', op: 'otobusBin', id: to });
  sim.step(12);
};

describe('realm + 42B', () => {
  it('iskele -> Belgrad -> iskele -> stadyum by bus', () => {
    const sim = played(1), api = disariApi(sim.rules)!;
    ride(sim, 'iskele', 'orman');
    expect(api.view().realm).toBe('belgrad');
    expect(Math.abs(sim.rules.playerPos.x - realmSpawn(REALM_BY_ID.belgrad).x)).toBeLessThan(3);
    ride(sim, 'belgrad', 'iskele');
    expect(api.view().realm).toBe('iskele');
    ride(sim, 'iskele', 'stadyum');
    expect(api.view().realm).toBe('stadyum');
  });
  it('walking into the stadium is pushed back at the realm wall', () => {
    const sim = played(1), api = disariApi(sim.rules)!;
    sim.command({ kind: 'teleport', x: 385, z: 9 }); sim.step(0.5);
    sim.command({ kind: 'teleport', x: 394, z: 9 }); sim.step(0.5);
    expect(sim.rules.playerPos.x).toBeLessThan(392);
    expect(api.view().realm).toBe('iskele');
  });
  it('the map sends you to the bus stop instead of teleporting across realms', () => {
    const sim = played(1), api = disariApi(sim.rules)!;
    sim.command({ kind: 'disari', op: 'go', id: 'stadyum' }); sim.step(5);
    expect(api.view().realm).toBe('iskele');
    expect(api.view().guide?.name).toContain('42B');
  });
});
