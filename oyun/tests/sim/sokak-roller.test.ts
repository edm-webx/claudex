// DNY-02: sokak rolleri havuzun içinden: koşucu, balıkçı, bekçi, müzisyen, köpek gezdiren (gerçek iskele ızgarası).
import { describe, it, expect } from 'vitest';
import { sokakRun } from './sokak-harness';
import { sokakDurum, GAIT_SPEED } from '../../src/game/sim/ambient';
import { SOKAK_ROLLER, KOPEK } from '../../src/content/sokak';
import { GAIT_ORDER } from '../../src/game/sim/schema';

describe('sokak rolleri (DNY-02)', () => {
  it('bir oyun gününde her rol çıkar, saatinin dışında sokakta kalmaz; koşucu koşar, köpek sahibinden 3 m açılmaz', () => {
    const r = sokakRun(21, 8);
    const seen = new Set<string>(), outside: string[] = [];
    let jogMax = 0, dogMax = 0, k = 0;
    const SP = r.s.f32('speed'), X = r.s.f32('x'), Z = r.s.f32('z'), G = r.s.u8('gait');
    const tour = [{ x: 0, z: 8 }, { x: -4, z: 44 }, { x: 24, z: 20 }, { x: -20, z: 0 }, { x: 30, z: 45 }];
    r.tick(30 * 25 * 19, () => {
      k++;
      r.clock.hour = 8 + k / (30 * 25);
      if (k % 900 === 0) Object.assign(r.state.player, tour[(k / 900) % tour.length]);
      const d = sokakDurum(r.s); if (!d || k % 5) return;
      const exit = new Set(r.amb.rows().filter(w => w.exit).map(w => w.slot));
      for (let i = 0; i < r.s.hi; i++) {
        if (!d.rol[i]) continue;
        const R = SOKAK_ROLLER[d.rol[i] - 1]; seen.add(R.id);
        const h = r.clock.hour;
        // saati bitince rolünü bırakır ve en yakın kapıya yürür (yavaş amca uzun iskelede 4 oyun saati yürüyebilir: 1 oyun saati 25 sn)
        if (!R.saat.some(([a, b]) => (h >= a && h < b + 0.2) || (h >= 24 && h - 24 >= a && h - 24 < b + 0.2)) && !exit.has(i)) outside.push(R.id + ' rolde @' + h.toFixed(1));
        if (!R.saat.some(([a, b]) => (h >= a && h < b + 4.5) || (h >= 24 && h - 24 >= a && h - 24 < b + 4.5) || (b === 24 && h < 28.5))) outside.push(R.id + ' hâlâ sokakta @' + h.toFixed(1));
        if (R.id === 'kosucu') { jogMax = Math.max(jogMax, SP[i]); expect(GAIT_ORDER[G[i]]).toBe('run'); }
        if (R.id === 'kopekli') { const o = i * 4; expect(Number.isFinite(d.kopek[o])).toBe(true); dogMax = Math.max(dogMax, Math.hypot(d.kopek[o] - X[i], d.kopek[o + 1] - Z[i])); }
        if (R.id === 'muzisyen') expect(r.clock.hour).toBeGreaterThanOrEqual(11);
      }
    });
    expect([...seen].sort()).toEqual(SOKAK_ROLLER.map(x => x.id).sort());
    expect(outside).toEqual([]);
    expect(jogMax).toBeGreaterThan(GAIT_SPEED.run * 0.85);
    expect(jogMax).toBeLessThan(GAIT_SPEED.run * 1.4);
    expect(dogMax).toBeLessThanOrEqual(KOPEK.max + 1e-3);
  }, 240000);
});
