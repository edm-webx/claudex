// 2026-11-21 21:07 sahip: "avm dışında diğer satın alınabilen tüm dükkanlarda parayla açacağımız kareler olsun, dükkanın içeriğine göre".
// Sokaktaki her dükkân (Meydan Kafe, Sahil Bistro, Kırtasiye, Kantin, Tesis Kafeteryası) ve büfe salonları büfenin sarı karesiyle büyür:
// kapının yanındaki kareye basınca dükkân alınır, sonra o işletmenin kendi aletleri kareyle kurulur, aletler bitince tadilat karesi çıkar.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { ARSALAR, ISLETME, ARSA_ISLETME, SALON_ESYA } from '../../src/content/esya';
import { icOfArsa, icIcinde, IC_MEKANLAR } from '../../src/content/ic-mekan';
import { disKareYerleri } from '../../src/game/sim/isletme-kareler';

const SOKAK = ARSALAR.filter(a => a.sabit && icOfArsa(a.id) && icOfArsa(a.id)!.bina !== 'avm');
const mk = (serbest = true) => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = serbest; sim.step(1); return { sim, S: sim.state }; };   // serbest: sıralı açılma şartı yok (acilis.test.ts)
const stand = (sim: any, key: string, sec: number) => {
  sim.step(0.3); const it = sim.interactions.get('pad.' + key); expect(it, key).toBeTruthy();
  sim.command({ kind: 'teleport', x: it.pos.x, z: it.pos.z }); for (let i = 0; i < sec * 10; i++) sim.step(0.1);
  sim.command({ kind: 'teleport', x: 6, z: 12.2 }); sim.step(0.3);   // kareden in (bir sonraki kareye yanlışlıkla basılmasın)
};
const pads = (sim: any, pre: string) => [...sim.rules.rt.pads].filter((p: any) => p.key.startsWith(pre));

it('sokaktaki her dükkânın kapısının yanında bir satın alma karesi var; kareler binaya ve kapı önüne girmez, birbirine binmez', () => {
  expect(SOKAK.map(a => a.id).sort()).toEqual(['k1', 'k2', 'k3', 'k4', 'k6']);
  const { sim } = mk();
  for (const a of SOKAK) {
    const p = pads(sim, 'isl.' + a.id); expect(p.map((x: any) => x.key), a.id).toEqual(['isl.' + a.id]);
    const yer = disKareYerleri(icOfArsa(a.id)!, q => sim.rules.nav.walkable(q));
    expect(yer).toHaveLength(3);
    for (const q of yer) for (const m of IC_MEKANLAR) expect(icIcinde(m, q, 0.5), a.id + ' kare ' + m.id + ' içinde').toBe(false);
    for (let i = 0; i < yer.length; i++) for (let j = i + 1; j < yer.length; j++) expect(Math.hypot(yer[i].x - yer[j].x, yer[i].z - yer[j].z)).toBeGreaterThanOrEqual(1.7);
  }
});

it('Meydan Kafe: kilitliyken kare para almaz; seviye gelince basınca para akar, dolunca dükkân senin; sonra kafenin kendi aletleri kareyle kurulur; aletler bitince tadilat', () => {
  const { sim, S } = mk(false); S.money = 5e6; S.level = 1; S.stage = 2; S.stats.served = 600;   // sıradaki ilk dükkân: büfe 2. aşama + görev tamam, esnaf seviyesi eksik
  const m0 = S.money; stand(sim, 'isl.k1', 2); expect(S.money).toBe(m0); expect(S.zones.arsa?.plots?.k1).toBeUndefined();
  S.level = 5; sim.step(0.5);
  stand(sim, 'isl.k1', 0.3); expect(S.padPaid['isl.k1']).toBeGreaterThan(0);   // yarım kalan para kaydedilir
  stand(sim, 'isl.k1', 3); expect(S.zones.arsa.plots.k1).toMatchObject({ tur: 'dukkan', lv: 1 }); expect(S.padPaid['isl.k1']).toBeUndefined();
  expect(m0 - S.money).toBeCloseTo(ARSALAR.find(a => a.id === 'k1')!.fiyat, 1);
  // kafenin kendi alet listesi (espresso makinesi, şemsiye...): her kare o listeden
  const kafe = ISLETME[ARSA_ISLETME.k1].esya, lv1 = kafe.filter(e => e.lv <= 1).map(e => e.id);
  for (let n = 0; n < lv1.length; n++) {
    sim.step(0.5); const al = pads(sim, 'isl.k1.').filter((p: any) => !p.key.endsWith('.tadilat')); expect(al.length).toBeGreaterThanOrEqual(1);
    const e = al[0].key.split('.')[2]; expect(lv1).toContain(e);
    stand(sim, al[0].key, 3); expect(S.zones.arsa.plots.k1.esya).toContain(e);
  }
  sim.step(0.5); expect(pads(sim, 'isl.k1.').map((p: any) => p.key)).toEqual(['isl.k1.tadilat']);
  stand(sim, 'isl.k1.tadilat', 3); expect(S.zones.arsa.plots.k1.tadilat).toBeTruthy();
  sim.step(0.5); expect(pads(sim, 'isl.k1.')).toHaveLength(0);   // tadilat sürerken kare yok
});

it('her sokak dükkânının alet kareleri kendi işletmesinin listesinden gelir (kırtasiyede fotokopi, kantinde tost makinesi...)', () => {
  const { sim, S } = mk(); S.money = 9e6; S.level = 20;
  for (const a of SOKAK) {
    sim.command({ kind: 'mulk', op: 'arsaAl', id: a.id }); sim.step(0.5);
    const liste = ISLETME[ARSA_ISLETME[a.id]].esya.map(e => e.id), al = pads(sim, 'isl.' + a.id + '.');
    expect(al.length, a.id).toBe(2); for (const p of al) expect(liste, a.id).toContain(p.key.split('.')[2]);
  }
});

it('büfe salonu (iskele): kahvaltı salonu kurulunca salon aletleri kareyle alınır', () => {
  const { sim, S } = mk(); S.money = 9e6; S.stage = 6; sim.step(0.5);
  const al = pads(sim, 'salon.'); expect(al.length).toBe(2);
  const e = al[0].key.split('.')[1]; expect(SALON_ESYA.find(x => x.id === e)!.salon).toBe('W');
  stand(sim, al[0].key, 3); expect(S.zones.salon.esya).toContain(e);
});
