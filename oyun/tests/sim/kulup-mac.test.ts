// 2026-11-08: own club plays league matches from the gate (points + prize), spectators bet on a seeded match.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { STADYUM } from '../../src/content/esya';
import { izleMac, KULUP_ODUL } from '../../src/game/sim/halisaha';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state, rt: sim.rules.rt, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
it('kulüp maçı: bilet yok, kulüp adıyla lig maçı, galibiyet 3 puan ve para', () => {
  const { sim, S, rt, c } = mk(); S.money = 20000;
  c({ op: 'adminTakim', name: 'Martı FK' });
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'bilet' }); expect(S.money).toBe(20000);
  const mac = rt.uiLast.haliSahaMac; expect(mac.name).toContain('Martı FK'); expect(mac.ligG).toBeGreaterThanOrEqual(0);
  const m0 = S.money; sim.command({ kind: 'halisaha', op: 'sonuc', biz: 3, onlar: 1 });
  expect(S.money).toBeGreaterThanOrEqual(20000 + KULUP_ODUL.win);
  const t = rt.lig.model().tablo.flat().find((r: any) => r.ben); expect(t.p).toBe(3);
});
it('bahis: sonuç motorla sabit, tutarsa oran kadar öder', () => {
  const a = izleMac(12345), b = izleMac(12345); expect(a.skor).toEqual(b.skor);
  const { sim, S, rt, c } = mk(); S.money = 10000;
  sim.command({ kind: 'teleport', x: STADYUM.kapi.x, z: STADYUM.kapi.z });
  c({ op: 'izle', bahis: '1', n: 1000 }); expect(S.money).toBe(9000);
  const iz = rt.uiLast.haliSahaIzle; const r = izleMac(iz.seed);
  sim.command({ kind: 'halisaha', op: 'izleSonuc' });
  expect(S.money).toBe(r.sonuc === '1' ? 9000 + Math.round(1000 * iz.oran['1']) : 9000);
  expect(rt.uiLast.haliSahaIzle).toBeUndefined();
});
