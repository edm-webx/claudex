// 2026-11-09 "her binaya girilebilmeli": every building is a room with a door gap; businesses inside are bought from a level,
// have their own menu + equipment; the büfe halls take equipment that raises the salon income; the bank works at the teller.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { salonKat } from '../../src/game/sim/salon';
import { IC_MEKANLAR, IC_BY_ID, icColliders, icWorld, icDim, icLayout, bankaGise } from '../../src/content/ic-mekan';
import { ISLETME, ARSALAR, ARSA_ISLETME } from '../../src/content/esya';

const inR = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
const blocked = (m: (typeof IC_MEKANLAR)[number], p: { x: number; z: number }) => icColliders(m).some(r => inR(p, r));

it('every room: the door is open, the wall beside it blocks, the walk from the door into the room is free', () => {
  for (const m of IC_MEKANLAR) {
    const { W, D } = icDim(m);
    for (const v of [D / 2 + 0.3, D / 2 - 0.1, D / 2 - 0.6, D / 2 - 1.0]) expect(blocked(m, icWorld(m, 0, v)), m.id + ' door v=' + v).toBe(false);
    expect(blocked(m, icWorld(m, Math.min(W / 2 - 0.3, 1.4), D / 2 - 0.1)), m.id + ' wall').toBe(true);
    expect(blocked(m, icWorld(m, 0, -D / 2 + 0.1)), m.id + ' back wall').toBe(true);
    // equipment never collides (the walk grid is static), furniture does
    for (const i of icLayout(m)) if (i.esya) expect(i.solid, m.id + ' ' + i.k).toBeFalsy();
  }
});

it('every business type has its own menu and at least 8 tools; every tool of a plot shows in its room', () => {
  for (const a of ARSALAR.filter(x => x.sabit)) {
    const t = ISLETME[ARSA_ISLETME[a.id]]; expect(t, a.id).toBeTruthy();
    expect(t.menu.length).toBe(8); expect(t.esya.length).toBeGreaterThanOrEqual(8);
    const room = IC_MEKANLAR.find(m => m.arsa === a.id)!; expect(room, a.id).toBeTruthy();
    const shown = new Set(icLayout(room).map(i => i.esya).filter(Boolean));
    for (const e of t.esya) if (!e.teras) expect(shown.has(e.id), a.id + ' ' + e.id).toBe(true);
  }
  const ids = Object.values(ISLETME).map(t => t.menu[0].id); expect(new Set(ids).size).toBe(ids.length);
});

it('school canteen: locked below level 3, bought inside the school, own menu, a toaster raises prices, panel works inside', () => {
  const sim = played(1) as any; sim.step(1); const m = mulkApi(sim.rules)!, S = sim.state, c = (x: any) => sim.command({ kind: 'mulk', ...x });
  const room = IC_BY_ID.okul, p = icWorld(room, 4, 0);
  sim.command({ kind: 'teleport', x: p.x, z: p.z }); sim.step(0.3);
  expect(m.view().arsaYakin).toBe('k4');
  S.money = 1e6; S.level = 2; c({ op: 'arsaAl', id: 'k4' }); expect(S.zones.arsa.plots.k4).toBeUndefined();
  S.level = 3; c({ op: 'arsaAl', id: 'k4' }); const pl = S.zones.arsa.plots.k4; expect(pl.tur).toBe('dukkan');
  const row: any = m.model().arsa.find((x: any) => x.id === 'k4'); expect(row.menu.map((x: any) => x.id)).toEqual(['ayran', 'simit_k']); expect(row.asamaAd).toBe('Kantin');
  
  c({ op: 'kafeEsya', id: 'k4', e: 'tost_mak' }); expect(pl.esya).toEqual(['tost_mak']);
  c({ op: 'kafeEsya', id: 'k4', e: 'izgara_k' }); expect(pl.esya).toEqual(['tost_mak']);   // needs lv5
  c({ op: 'kafeEsya', id: 'k4', e: 'espresso' }); expect(pl.esya).toEqual(['tost_mak']);   // a café tool is not a canteen tool
  pl.till = 500; sim.step(0.5); expect(pl.till).toBeLessThan(1);   // collected inside
});

it('büfe halls: tools need the hall stage, raise the hourly salon income; the bank opens at the teller window', () => {
  const sim = played(1) as any; sim.step(1); const m = mulkApi(sim.rules)!, S = sim.state, c = (x: any) => sim.command({ kind: 'mulk', ...x });
  S.money = 1e7; S.stage = 5; c({ op: 'salonEsya', e: 'tas_firin' }); expect(S.zones.salon?.esya || []).toEqual([]);
  S.stage = 6; c({ op: 'salonEsya', e: 'tas_firin' }); c({ op: 'salonEsya', e: 'buz_tezgah' });   // east hall tool needs stage 7
  expect(S.zones.salon.esya).toEqual(['tas_firin']);
  expect(salonKat(S.zones.salon.esya, 6).adis).toBeCloseTo(1.1);
  expect(salonKat(['buz_tezgah'], 6).mis).toBe(1); expect(salonKat(['buz_tezgah'], 7).mis).toBeCloseTo(1.1);
  const w = icWorld(IC_BY_ID.salonW, 0, 0); sim.command({ kind: 'teleport', x: w.x, z: w.z }); sim.step(0.3); expect(m.view().salonYakin).toBe('W');
  const g = bankaGise(); sim.command({ kind: 'teleport', x: g.x, z: g.z + 0.6 }); sim.step(0.3);
  S.money = 1000; c({ op: 'tlYatir', n: 400 }); expect(S.money).toBe(600);
});
