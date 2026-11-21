// DNY-19: havaya duyarlı sokak. Hava takvimden değil kayıttaki gün segmentinden okunur (sim/hava.ts havaSokak), test sabit segment verir.
import { describe, it, expect } from 'vitest';
import { sokakRun } from './sokak-harness';
import { sokakDurum, GAIT_SPEED } from '../../src/game/sim/ambient';
import { SOKAK_HAVA } from '../../src/content/sokak';
import { havaSokak } from '../../src/game/sim/hava';
import { AGENT_FLAG } from '../../src/game/sim/schema';

const hava = (k: string) => ({ hava: { wDay: 1, segs: [{ k, a: 8, b: 27 }] } });

describe('havaya duyarlı sokak (DNY-19)', () => {
  it('havaSokak kayıttan okur: sağanak ıslak, kar yavaş, eski gün açık', () => {
    expect(havaSokak({ zones: hava('saganak'), day: 1 }, 13).wet).toBe(true);
    expect(havaSokak({ zones: hava('kar'), day: 1 }, 13).kar).toBe(true);
    expect(havaSokak({ zones: hava('saganak'), day: 2 }, 13).wet).toBe(false);
    expect(havaSokak({ zones: {}, day: 1 }, 13).kind).toBe('acik');
  });

  it('sağanakta banklar boşalır, çoğunluk tente altına yönelir, kalanlar şemsiye açar', () => {
    const r = sokakRun(4, 13);
    r.tick(30 * 60);
    const seated0 = r.amb.rows().filter(w => w.seated).length;
    expect(seated0).toBeGreaterThan(0);
    r.state.zones = hava('saganak');
    let umb = 0;
    r.tick(30 * 40, () => { const d = sokakDurum(r.s)!; for (let i = 0; i < r.s.hi; i++) umb += d.semsiye[i]; });
    const rows = r.amb.rows().filter(w => !w.inside && w.rol < 0);
    expect(rows.filter(w => w.seated).length).toBe(0);
    expect(r.s.u16('flags').some((f, i) => r.s.alive(i) && (f & AGENT_FLAG.seated) !== 0 && (f & AGENT_FLAG.ambient) !== 0)).toBe(false);
    const sig = rows.filter(w => w.spot.startsWith('sig:')).length;
    expect(sig / rows.length).toBeGreaterThan(0.5);
    expect(umb).toBeGreaterThan(0);
  }, 120000);

  it('karda adım yavaşlar', () => {
    const r = sokakRun(6, 13);
    r.state.zones = hava('kar');
    let max = 0;
    const SP = r.s.f32('speed'), G = r.s.u8('gait');
    r.tick(30 * 60, () => { const d = sokakDurum(r.s)!; for (let i = 0; i < r.s.hi; i++) if (!d.rol[i] && G[i] !== 6 && SP[i] < 5) max = Math.max(max, SP[i]); });
    expect(max).toBeLessThan(GAIT_SPEED.brisk * 1.1 * SOKAK_HAVA.kar + 0.05);
  }, 120000);
});
