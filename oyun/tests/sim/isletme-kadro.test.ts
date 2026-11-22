// DKN-03: named crew, 3-candidate board, day-end wages, actors = headcount
import { it, expect } from 'vitest';
import { played, kareyeGit } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { ISLETME_ROL, ISCI_GUN_UCRET } from '../../src/content/isletme-kadro';

const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; sim.step(1); /* kurulum: sıralı açılma şartı yok (content/acilis.ts, kendi testi acilis.test.ts) */ const m = mulkApi(sim.rules)!; const S = sim.state; S.level = 40; S.money = 5e7; return { sim, m, S, rt: sim.rules.rt, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
const plot = (S: any, id: string) => S.zones.arsa.plots[id];

it('ilan 3 aday üretir: adlı, yüzlü, rolü işletmeden, fiyat 12000', () => {
  const { sim, m, S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); sim.step(0.5);
  const k1 = (m.model() as any).arsa.find((a: any) => a.id === 'k1');
  expect(k1.ilan.length).toBe(3);
  for (const k of k1.ilan) { expect(k.ad.length).toBeGreaterThan(1); expect(typeof k.look.lookSeed).toBe('number'); expect(ISLETME_ROL.kafe.map(r => r.rol)).toContain(k.rol); expect(k.fiyat).toBe(12000); }
  void S;
});
it('işe alma kadroyu ve parayı günceller, tavan dolunca para düşmez', () => {
  const { sim, m, S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); sim.step(0.5);
  const hire = () => { const k = (m.model() as any).arsa.find((a: any) => a.id === 'k1').ilan[0]; c({ op: 'ilanAl', id: 'k1', e: k.id }); };
  let m0 = S.money; hire(); expect(plot(S, 'k1').kadro.length).toBe(1); expect(plot(S, 'k1').isci).toBe(1); expect(m0 - S.money).toBe(12000);
  m0 = S.money; hire(); expect(m0 - S.money).toBe(24000);
  m0 = S.money; hire(); hire(); expect(plot(S, 'k1').kadro.length).toBe(2); expect(m0 - S.money).toBe(0);   // lv1 cap is 2: rejected, no money taken
});
it('kadro sayısı = sahnedeki çalışan sayısı ve adlı (k1-k6)', () => {
  for (const id of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) {
    const { sim, m, S, c } = mk(); kareyeGit(sim, id); c({ op: 'arsaAl', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); sim.step(0.5);
    for (let i = 0; i < 3; i++) { const k = (m.model() as any).arsa.find((a: any) => a.id === id).ilan[0]; c({ op: 'ilanAl', id, e: k.id }); }
    for (let i = 0; i < 300; i++) sim.step(0.1);
    const kad = plot(S, id).kadro; expect(kad.length).toBe(3);
    const actors = sim.rules.rt.agents.registry.list.filter((a: any) => a.kind === 'worker' && !a.dead && /^kafe-/.test(a.key));
    expect(actors.length).toBe(3);
    expect(actors.map((a: any) => a.info.name).sort()).toEqual(kad.map((x: any) => x.ad).sort());
  }
});
it('kovulan gider, kalanlar kalır', () => {
  const { sim, m, S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'yukselt', id: 'k1' }); c({ op: 'adminTadilatBitir', id: 'k1' }); sim.step(0.5);
  for (let i = 0; i < 3; i++) c({ op: 'ilanAl', id: 'k1', e: (m.model() as any).arsa.find((a: any) => a.id === 'k1').ilan[0].id });
  const ids = plot(S, 'k1').kadro.map((x: any) => x.id); c({ op: 'kov', id: 'k1', n: ids[1] });
  expect(plot(S, 'k1').kadro.map((x: any) => x.id)).toEqual([ids[0], ids[2]]); expect(plot(S, 'k1').isci).toBe(2);
});
it('maaş gün sonunda toplu, negatife düşmez; büfe kadrosuna karışmaz', () => {
  const { sim, m, S, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'yukselt', id: 'k1' }); c({ op: 'adminTadilatBitir', id: 'k1' }); sim.step(0.5);
  const w0 = S.workers.length;
  for (let i = 0; i < 2; i++) c({ op: 'ilanAl', id: 'k1', e: (m.model() as any).arsa.find((a: any) => a.id === 'k1').ilan[0].id });
  expect(S.workers.length).toBe(w0);
  const p = plot(S, 'k1'); p.maas = 2 * ISCI_GUN_UCRET; p.till = 0; S.money = 5000;
  sim.rules.bus.emit('dayEnd', {} as never);
  expect(S.money).toBe(5000 - 2 * ISCI_GUN_UCRET); S.money = 100; p.maas = 2 * ISCI_GUN_UCRET; sim.rules.bus.emit('dayEnd', {} as never); expect(S.money).toBe(0);
  expect(sim.rules.rt.uiLast.isletmeMaas.toplam).toBe(2 * ISCI_GUN_UCRET);
});
it('eski kayıt: yalnız isci sayısı olan işletme aynı adlı kadroyu yeniden kurar', () => {
  const a = mk(), b = mk();
  for (const t of [a, b]) { t.S.zones.arsa = { plots: { k1: { tur: 'dukkan', tip: 'kafe', lv: 3, till: 0, sat: 0, fr: 0, isci: 3 } }, takim: null, lastH: 8 }; t.m.model(); }
  const n = (t: any) => plot(t.S, 'k1').kadro.map((x: any) => x.ad);
  expect(n(a).length).toBe(3); expect(n(a)).toEqual(n(b)); expect(plot(a.S, 'k1').kadro.map((x: any) => x.rol)).toEqual(['barista', 'garson', 'kasiyer']);
});
