// 2026-11-25 sahip: "arkadaşın oyununa katılınca paranın ortak oluşunu dert ediyorlar, öyle bir hal almalı ki dert edilmemeli".
// Aynı gün: "bir mmorpg gibi düşün herkesin seviyesi parası gelişimi kendine, gelen arkadaş yardım ediyor karşılığında maaş alıyor".
// Kural net/misafir.ts + sim/misafir-kural.ts: satış ev sahibine, misafire oyundan maaş (kesintisiz, geri düşmez, kalıcı), XP misafirin
// kendi seviyesine; misafir ev sahibinin dünyasında para harcayamaz, kirası / pasif geliri misafire dokunmaz.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
import { misafirDunya, misafirDonus, toplanmamis, toplanmamisMaas, MISAFIR_MAAS } from '../../src/game/net/misafir';
import { xpForLevel } from '../../src/content/economy';
import { misafirYasak } from '../../src/game/sim/misafir-kural';
const log = { info() {}, warn() {}, error() {} };
function misafirSim() {
  const sim: any = createSim({ seed: 7, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' }); sim.step(0.2);
  sim.rules.rt.misafir = true;
  return sim;
}
const toasts = (sim: any) => sim.events(0).filter((e: any) => e.name === 'toast').map((e: any) => String(e.data?.text ?? ''));

it('misafir ev sahibinin dünyasına girer ama kendi parası, altını, yeri durur; ev sahibinin toplanmamış kasası geçmez', () => {
  const own = { money: 1200, gold: 7, stage: 1, playT: 500, player: { x: 1 }, zones: { esnafim: { ad: 'Ali' } } };
  const host = { money: 9_000_000, gold: 400, stage: 6, pile: 35000, player: { x: 9 }, zones: { esnafim: { ad: 'Hoca' }, arsa: { plots: { k1: {} } } } };
  const m = misafirDunya(own, host) as any;
  expect(m).toMatchObject({ money: 1200, gold: 7, stage: 6, pile: 0 });
  expect(m.zones.esnafim.ad).toBe('Ali'); expect(m.zones.arsa.plots.k1).toBeDefined(); expect(m.player.x).toBe(1);
  // çıkış: kazandığı para + altın kendi kaydına, misafirlik süresi oyun süresine (bulut kaydı daha yeni sayılır)
  const geri = misafirDonus(own, { ...m, money: 5400, gold: 9 }, 120) as any;
  expect(geri).toMatchObject({ money: 5400, gold: 9, stage: 1, playT: 620, level: 1 });
  // misafirken kazandığı XP kendi seviyesini atlatır
  const lv = misafirDonus({ ...own, level: 1, xp: 0 }, own, 0, xpForLevel(1) + 3) as any;
  expect(lv).toMatchObject({ level: 2, xp: 3 });
});

it('misafirin toplanmamış satışından maaşı sayılır', () => {
  expect(MISAFIR_MAAS).toBe(0.25);
  const rt = { kasa: [{ value: 40 }, { value: 60.5 }], tables: [{ pile: [{ value: 10 }] }, {}], floor: [{ value: 5 }] };
  expect(toplanmamis(rt)).toBe(115); expect(toplanmamisMaas(rt)).toBe(28);
});

it('misafirin satışı ev sahibinin defterine tam yazılır, cebine maaş girer (geri düşmez); pasif gelir misafire ödenmez', () => {
  const sim = misafirSim(), S = sim.rules.state; S.money = 1000; const e0 = S.totalEarned;
  sim.rules.credit('tezgah', 400); sim.rules.credit('adisyon', 100);
  expect(S.money).toBe(1125);                 // 500 satışın %25'i maaş
  expect(S.totalEarned - e0).toBe(500);       // ev sahibine bildirilen satış tam
  sim.rules.cashIn(200); expect(S.money).toBe(1175);   // kasadan toplanan satış parası da maaş olarak
  sim.rules.credit('mac', 300); expect(S.money).toBe(1475);   // kendi oynadığı maçın parası tam kendisinin
  for (const k of ['isletme', 'faiz', 'hedef', 'basarim', 'yildiz', 'tadilat']) expect(sim.rules.credit(k, 5000)).toBe(0);
  expect(S.money).toBe(1475);
  sim.rules.rt.misafir = false;
  sim.rules.credit('tezgah', 400); expect(S.money).toBe(1875);   // kendi oyununda satış tam
  expect(sim.rules.credit('isletme', 5000)).toBe(5000);
});

it('misafirin XP ev sahibinin seviyesini oynatmaz, kendi hesabına birikir', () => {
  const sim = misafirSim(), S = sim.rules.state; const lv = S.level, xp = S.xp;
  sim.rules.addXP(99999);
  expect(S.level).toBe(lv); expect(S.xp).toBe(xp); expect(sim.rules.rt.misafirXp).toBe(99999);
});

it('misafirin cebinden gün sonu kira / fatura kesilmez (kendi oyununda kesilir)', () => {
  const sim = misafirSim(), S = sim.rules.state;
  S.stage = 8; S.today.sales = 200000; S.money = 50000;
  S.dayT = 1e9; sim.step(0.1);
  expect(S.money).toBe(50000);
  const ev: any = createSim({ seed: 7, content: emptyContent() }, { log }); ev.command({ kind: 'play', hero: 'sabri' }); ev.step(0.2);
  const E = ev.rules.state; E.stage = 8; E.today.sales = 200000; E.money = 50000;
  E.dayT = 1e9; ev.step(0.1);
  expect(E.money).toBeLessThan(50000);
});

it('misafir ev sahibinin büfesine alışveriş yapamaz (para boşa gitmez), kendi işlerini yapabilir', () => {
  for (const c of [{ kind: 'decorBuy', id: 'x' }, { kind: 'upgradeTier', id: 'cay' }, { kind: 'hireCandidate', id: 'a' }, { kind: 'mulk', op: 'tlYatir', n: 100 },
    { kind: 'mulk', op: 'arsaAl', id: 'k1' }, { kind: 'disari', op: 'buyShop', id: 's' }, { kind: 'kiyafet', op: 'buy', id: 'k' }, { kind: 'dekor2', arg: 'buyGold:x' }, { kind: 'startTadilat' }])
    expect(misafirYasak(c)).toBe(true);
  for (const c of [{ kind: 'teleport', x: 0, z: 0 }, { kind: 'mulk', op: 'bilet' }, { kind: 'disari', op: 'go', id: 'meydan' }, { kind: 'halisaha', op: 'kabul' },
    { kind: 'kiyafet', op: 'wear', id: 'k' }, { kind: 'openPanel', id: 'dekor' }, { kind: 'esnaf', op: 'claim' }, { kind: 'mini', op: 'play', id: 'a' }])
    expect(misafirYasak(c)).toBe(false);
  const sim = misafirSim(), S = sim.rules.state; S.money = 1e6; S.level = 30;
  sim.command({ kind: 'mulk', op: 'tlYatir', n: 5000 }); sim.step(0.1);
  expect(S.money).toBe(1e6);
  expect(toasts(sim).some((t: string) => /ev sahibinin büfesi/.test(t))).toBe(true);
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

it('oda rozetinde ev sahibinin adı doğru ekle yazılır', async () => {
  const { tamlayan } = await import('../../src/game/online');
  expect(['Sabri', 'Can', 'Ayşe', 'Oğuz', 'Gül', 'Ahmet'].map(tamlayan)).toEqual(["Sabri'nin", "Can'ın", "Ayşe'nin", "Oğuz'un", "Gül'ün", "Ahmet'in"]);
});
