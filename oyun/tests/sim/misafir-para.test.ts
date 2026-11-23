// 2026-11-23 sahip: "öğrencilerle girdik, katıldılar, bende ne para varsa onlarda da o görünüyor". Kural net/misafir.ts:
// misafirin cüzdanı kendisinin, satışı ev sahibine gider, oyun misafire %25 maaş basar, misafir sarı kare açamaz.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { misafirDunya, misafirMaas, misafirDonus, MISAFIR_MAAS } from '../../src/game/net/misafir';

it('misafir ev sahibinin dünyasına girer ama ekranda kendi parası ve altını durur; çıkınca maaşıyla kendi kaydına döner', () => {
  const own = { money: 1200, gold: 7, stage: 1, player: { x: 1 }, zones: { esnafim: { ad: 'Ali' } } };
  const host = { money: 9_000_000, gold: 400, stage: 6, player: { x: 9 }, zones: { esnafim: { ad: 'Hoca' }, arsa: { plots: { k1: {} } } } };
  const m = misafirDunya(own, host) as any;
  expect(m.money).toBe(1200); expect(m.gold).toBe(7); expect(m.stage).toBe(6);
  expect(m.zones.esnafim.ad).toBe('Ali'); expect(m.zones.arsa.plots.k1).toBeDefined(); expect(m.player.x).toBe(1);
  const geri = misafirDonus(own, { ...m, money: 1500, gold: 9 }) as any;
  expect(geri).toMatchObject({ money: 1500, gold: 9, stage: 1 });
});

it('misafirin sattığı ev sahibine gider, cebe yalnız maaş kalır (ev sahibinden kesilmez)', () => {
  expect(MISAFIR_MAAS).toBe(0.25);
  expect(misafirMaas(1000 + 400, 400)).toBe(1100);   // 400 ₺ satış yerelde cebe girmişti: 400 gider, 100 maaş kalır
  expect(misafirMaas(50, 0)).toBe(50);
  expect(misafirMaas(10, 400)).toBe(0);   // asla eksiye düşmez
});

it('misafirken sarı kareler (büfe ve dükkân) para çekmez, uyarı verir; ev sahibi olunca normal', () => {
  const sim = played(7) as any, S = sim.state; sim.step(1);
  S.stage = 2; S.level = 10; S.stars = 5; S.stats.served = 600; sim.step(0.6);
  const rt = sim.rules.rt, p = [...rt.pads].find((q: any) => q.key === 'isl.k1') as any; expect(p).toBeDefined();
  rt.misafir = true; S.money = 1e6;
  sim.command({ kind: 'teleport', x: p.pos.x, z: p.pos.z, kat: 0 }); for (let i = 0; i < 40; i++) sim.step(0.25);
  expect(S.money).toBe(1e6); expect(S.padPaid['isl.k1'] || 0).toBe(0); expect(S.zones.arsa?.plots?.k1).toBeUndefined();
  expect(sim.events(0).some((e: any) => e.name === 'toast' && /ev sahibinin büfesi/.test(String(e.data?.text ?? e.data?.t ?? JSON.stringify(e.data))))).toBe(true);
  rt.misafir = false;
  sim.command({ kind: 'teleport', x: 0, z: 0, kat: 0 }); sim.step(0.5);
  sim.command({ kind: 'teleport', x: p.pos.x, z: p.pos.z, kat: 0 }); for (let i = 0; i < 60; i++) sim.step(0.25);
  expect(S.zones.arsa.plots.k1).toMatchObject({ tur: 'dukkan' });
});
