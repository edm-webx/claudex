// 2026-11-22 sahip: "sinema salonunun katında patlamış mısırcı olsun, dolaptan kola soda falan verebilsin, gazoz falan; büfe gibi
// genişleme ve gelişme olacak her yerde". Sinema Büfesi süs değil: satın alınan, çalışanı ve müşterisi olan, aletleri sarı kareden
// alınan, aşama atlayan gerçek dükkân.
import { it, expect } from 'vitest';
import { played, kareyeGit } from './m1-helpers';
import { icBina } from '../../src/content/ic-mekan';
import { ARSA_ISLETME, ISLETME } from '../../src/content/esya';
import { KALEM, MAKINE } from '../../src/content/isletme-istasyon';
import { EGLENCE_KAT } from '../../src/content/avm-eglence';

const room = () => icBina('avm').find(m => m.arsa === 'k18')!;

it('Sinema Büfesi: sinema katında gerçek dükkân; mısır makinede patlar, Kolaz / soda / Boğaz Gazozu dolaptan', () => {
  const m = room(); expect(m.kat).toBe(EGLENCE_KAT);
  const t = ISLETME[ARSA_ISLETME.k18]; expect(t.id).toBe('sinema'); expect(t.asama).toHaveLength(5); expect(t.esya.length).toBeGreaterThanOrEqual(6);
  const ids = t.menu.map(x => x.id);
  for (const id of ['misir_kucuk', 'kolaz', 'soda', 'gazoz']) expect(ids).toContain(id);
  expect(MAKINE.has(KALEM.misir_kucuk.ist)).toBe(true);
  for (const id of ['kolaz', 'soda', 'gazoz']) { expect(KALEM[id].ist).toBe('dolap'); expect(MAKINE.has('dolap')).toBe(false); }
});

it('Sinema Büfesi: satın alınır, çalışan mısır makinesini çalıştırır, müşteriye satar, kasa dolar', () => {
  const sim = played(1) as any; sim.step(1); const S = sim.state, c = (x: any) => sim.command({ kind: 'mulk', ...x });
  S.level = 40; S.money = 1e8;
  for (const id of ['k5', 'k18']) { kareyeGit(sim, id); c({ op: 'arsaAl', id }); }
  const p = S.zones.arsa.plots.k18; expect(p, 'satın alındı').toBeTruthy();
  p.isci = 1; c({ op: 'adminIsci', id: 'k18' });
  const kafe = sim.rules.rt.agents.kafe, h = sim.rules.rt.kafeHost; let pisti = false;
  for (let i = 0; i < 2500; i++) {
    h.pending.k18 = Math.max(h.pending.k18 || 0, 1); sim.step(0.1);
    if (kafe.makineler(room().id).some((x: any) => x.ist === 'misir' && x.cook)) pisti = true;
  }
  expect(pisti, 'mısır makinesi çalıştı').toBe(true); expect(p.sat).toBeGreaterThan(2);
});
