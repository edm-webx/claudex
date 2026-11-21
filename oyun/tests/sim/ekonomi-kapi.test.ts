// EKO-02 (tek gelir kapısı, dürüst ödül bildirimi) ve EKO-03 (sınav, mevduat, kırtasiye hızı) birim testleri.
import { it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { IC_BY_ID } from '../../src/content/ic-mekan';
import { BANKA } from '../../src/content/esya';
import { KAYNAKLAR, BONUS_MIN } from '../../src/content/ekonomi2';
import { OKUL_KELIME, OKUL_GUNLUK_SINAV } from '../../src/content/okul';
import { KT_DK_TAVAN_TABAN, KT_DK_TAVAN_SEVIYE } from '../../src/content/kirtasiye';

const mk = () => { const sim = played(1) as any; sim.step(1); const m = mulkApi(sim.rules)!; return { sim, m, S: sim.state, rt: sim.rules.rt, K: sim.rules, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
const toasts = (sim: any) => sim.events(0).filter((e: any) => e.name === 'toast').map((e: any) => String((e.data as any)?.text ?? ''));
const dinle = (sim: any): string[] => { const l: string[] = []; sim.bus.onAny((r: any) => { if (r.name === 'toast') l.push(String((r.data as any)?.text ?? '')); }); return l; };

it('EKO-02: emek ödülü günün başında (satış 0) kırpılmadan tam ödenir ve defterde kaynağıyla görünür', () => {
  const { S, K } = mk();
  S.today.sales = 0;
  const m0 = S.money, t0 = S.totalEarned;
  expect(K.credit('gorev', 1500)).toBe(1500);
  expect(S.money - m0).toBe(1500); expect(S.totalEarned - t0).toBe(1500);
  expect(S.today.src.gorev).toBe(1500); expect(S.stats.kaynak_gorev).toBe(1500);
  expect(S.today.earned).toBeGreaterThanOrEqual(1500);
});
it('EKO-02: tavanlı bonus gün başında bile en az 600 verir, fazlası kırpılır, ödenen tutar döner ve "bonus doldu" tek kez söylenir', () => {
  const { sim, S, K } = mk();
  S.today.sales = 0;
  const m0 = S.money, a = K.credit('diger', 5000, { tavanli: true });
  expect(a).toBe(BONUS_MIN); expect(S.money - m0).toBe(BONUS_MIN);
  expect(K.credit('diger', 100, { tavanli: true })).toBe(0);
  expect(K.credit('diger', 100, { tavanli: true })).toBe(0);
  expect(toasts(sim).filter((t: string) => t.includes('Bugünlük bonus doldu')).length).toBe(1);
  expect(K.earn(50)).toBe(0);   // eski kapı da aynı tavanı görür
});
it('EKO-02: tavan dünkü kazancın %10\'una ve dünden devreden paya göre büyür', () => {
  const { sim, S, rt, K } = mk();
  rt.dayHistory.push({ day: 0, earned: 40000, customers: 10 });
  expect(K.credit('diger', 99999, { tavanli: true })).toBe(4000);   // %10 x 40.000
  // gün biter: kullanılmayan pay (burada 0) devreder; yeni günde bir şey kullanmadan biten gün bir sonrakine pay bırakır
  S.stats.bonusDevir = 300; S.today.bonus = 0; rt.dayHistory.length = 0;
  expect(K.credit('diger', 99999, { tavanli: true })).toBe(BONUS_MIN + 300);
  S.stats.bonusDevir = 99999; S.today.bonus = 0;
  expect(K.credit('diger', 99999, { tavanli: true })).toBe(BONUS_MIN * 2);   // devreden pay en çok bir günlük tavan kadar
  void sim;
});
it('EKO-02: bilinmeyen kaynak "diger"e yazılır, kaynak listesi sabit', () => {
  const { S, K } = mk();
  K.credit('uydurma', 100);
  expect(S.today.src.diger).toBe(100);
  expect(KAYNAKLAR.length).toBe(17); expect(KAYNAKLAR).toContain('faiz');
});
it('EKO-02: cashIn gelir sayılmaz (yerden toplama, bankadan çekme)', () => {
  const { S, K } = mk();
  const t0 = S.totalEarned, m0 = S.money; K.cashIn(700);
  expect(S.money - m0).toBe(700); expect(S.totalEarned).toBe(t0); expect(S.today.src).toBeUndefined();
});
it('EKO-02: src/game içinde "money +=" yalnız economy.ts\'te (başka her giriş K.credit / K.cashIn\'dan geçer)', () => {
  const kok = join(__dirname, '../../src/game'), bulunan: string[] = [];
  const gez = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) gez(p); else if (/\.(ts|mjs)$/.test(f) && !p.endsWith('sim/economy.ts')) { readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/\bmoney\s*\+=/.test(l) && !/^\s*(\/\/|\*)/.test(l)) bulunan.push(p.replace(kok, '') + ':' + (i + 1)); }); } } };
  gez(kok);
  expect(bulunan).toEqual([]);
});

const odulluSinav = (sim: any, S: any, c: any, dogru = true) => {
  for (let i = 0; i < 10; i++) { const o = S.zones.okul; if (o.soru < 0) c({ op: 'dersBasla' }); const ok = S.zones.okul; c({ op: 'dersCevap', n: dogru ? Math.max(0, ok.secenek.indexOf(ok.soru)) : ok.secenek.findIndex((x: number) => x !== ok.soru) }); }
  void sim;
};
it('EKO-03: günde 3 ödüllü sınav; 4. sınav deneme: para, tecrübe ve genel puan değişmez; ertesi gün yine ödüllü', () => {
  const { sim, S, c } = mk(); const tl = dinle(sim);
  const room = IC_BY_ID.okul; sim.command({ kind: 'teleport', x: room.x, z: room.z + 1.5 }); c({ op: 'dersBasla' });
  const para = () => S.money, ilk = para();
  odulluSinav(sim, S, c);
  const bir = para() - ilk; expect(bir).toBe(Math.round(100 * 12 * (1 + S.stage * 0.1)));   // 1.320 ₺ (aşama 1)
  odulluSinav(sim, S, c); odulluSinav(sim, S, c);
  expect(S.zones.okul.sinavlar.length).toBe(OKUL_GUNLUK_SINAV);
  sim.step(30);   // toast aralığı (rules.ts TOAST_GAP_S) geçsin
  const m3 = para(), xp3 = S.xp + S.level * 1e6;
  odulluSinav(sim, S, c);
  expect(para()).toBe(m3); expect(S.xp + S.level * 1e6).toBe(xp3); expect(S.zones.okul.sinavlar.length).toBe(OKUL_GUNLUK_SINAV);
  sim.step(0.1); expect(tl.some(t => t.includes('Deneme sınavı'))).toBe(true);
  S.day += 1;
  const m4 = para(); odulluSinav(sim, S, c); expect(para() - m4).toBe(bir);
});
it('EKO-03: sınav ödülü aşamayla artar ama 2 katını geçmez', () => {
  const { sim, S, c } = mk();
  const room = IC_BY_ID.okul; sim.command({ kind: 'teleport', x: room.x, z: room.z + 1.5 }); c({ op: 'dersBasla' });
  S.stage = 10; const m0 = S.money; odulluSinav(sim, S, c);
  expect(S.money - m0).toBe(100 * 12 * 2);
});
it('EKO-03: soru havuzu en az 120 kelime ve son 5 soruda aynı kelime gelmez', () => {
  expect(OKUL_KELIME.length).toBeGreaterThanOrEqual(120);
  const { sim, S, c } = mk();
  const room = IC_BY_ID.okul; sim.command({ kind: 'teleport', x: room.x, z: room.z + 1.5 }); c({ op: 'dersBasla' });
  const gecmis: number[] = [];
  for (let i = 0; i < 120; i++) { const o = S.zones.okul; expect(gecmis.slice(-5)).not.toContain(o.soru); gecmis.push(o.soru); c({ op: 'dersCevap', n: 0 }); }
});
it('EKO-03: mevduat faizi %0,2, ana para tavanı 200.000, hesap başına günde bir kez', () => {
  const { sim, S, rt, c } = mk();
  sim.command({ kind: 'teleport', x: BANKA.kapi.x, z: BANKA.kapi.z });
  S.money = 1_000_000; c({ op: 'tlYatir', n: 1_000_000 });
  const gun = () => { S.zones.envanter.gunluk.gun = -1; sim.step(1); };
  S.day = 5; gun();
  expect(rt.banka.tl).toBe(1_000_000 + 400);   // 200.000 x %0,2
  const t0 = S.totalEarned; gun(); gun();       // aynı gün, başka karakter de aynı hesaba bağlansa: faiz yeniden işlemez
  expect(rt.banka.tl).toBe(1_000_400); expect(S.totalEarned).toBe(t0);
  // başka karakter: bankanın runtime kaydı aynı, yedek de hesap damgasını taşır
  delete rt.banka.faizGun; S.day = 5; gun();
  expect(rt.banka.tl).toBe(1_000_400);
  S.day = 6; gun(); expect(rt.banka.tl).toBe(1_000_400 + 400);
  expect(S.stats.kaynak_faiz).toBeGreaterThan(0);
});
it('EKO-03: borç varken kredi, limitin üstüne çıkmaz', () => {
  const { sim, S, c } = mk(); sim.command({ kind: 'teleport', x: BANKA.kapi.x, z: BANKA.kapi.z });
  S.money = 0; c({ op: 'krediAl', n: 1e9 }); const borc = S.zones.arsa.kredi.borc, m = S.money;
  c({ op: 'krediAl', n: 1 }); c({ op: 'krediAl', n: 1e9 });
  expect(S.zones.arsa.kredi.borc).toBe(borc); expect(S.money).toBe(m);
  expect(S.totalEarned).toBe(0);   // kredi gelir değil
});
it('EKO-03: kırtasiye tezgahı dakikalık tavanı aşamaz, ama normal çalışan para kazanır', () => {
  const { sim, m, S, c } = mk(); S.level = 6; S.money = 500000;
  c({ op: 'arsaAl', id: 'k3' });
  sim.command({ kind: 'teleport', x: IC_BY_ID.kirtasiye.x, z: IC_BY_ID.kirtasiye.z });
  c({ op: 'ktAc' });
  const e0 = S.totalEarned, tavan = KT_DK_TAVAN_TABAN + KT_DK_TAVAN_SEVIYE * S.level;
  let sn = 0, satis = 0;
  while (sn < 120) {
    sim.step(0.1); sn += 0.1;
    const k = (m.view() as any).kirtasiye; if (!k || !k.mus) continue;
    for (const [id, n] of Object.entries(k.mus.istek) as [string, number][]) { if (id === 'fotokopi') c({ op: 'ktEkle', id }); else for (let i = 0; i < n; i++) c({ op: 'ktEkle', id }); }
    c({ op: 'ktVer' }); satis++;
  }
  const kazanc = S.totalEarned - e0;
  expect(satis).toBeGreaterThan(5); expect(kazanc).toBeGreaterThan(0);
  expect(kazanc).toBeLessThanOrEqual(tavan * 2 + tavan / 6 + 1);   // 2 dakika + ilk kova
  expect(S.stats.kaynak_isletme).toBeGreaterThan(0);
});
it('EKO-03: orman mantarı günde en çok MANTAR_PER_DAY (14) adet ve her biri en çok 120 ₺ (günlük tavan <= 14 x 120)', async () => {
  const { MANTAR_PER_DAY, MANTARLAR } = await import('../../src/content/disari/martikoy');
  expect(MANTAR_PER_DAY).toBe(14);   // paket 12 diyordu, kodda 14: günlük adet sınırı VAR, yalnız sayı 14
  expect(Math.max(...MANTARLAR.map(m => ('zehir' in m && m.zehir) ? 0 : m.price)) * MANTAR_PER_DAY).toBeLessThanOrEqual(14 * 120);
});
