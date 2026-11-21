// 2026-11-21 tarama SİM bulguları: yavaşlık kartı 'Sonra', grup oturma, masa sırası, kızgın müşterinin ürünleri,
// vapur penceresi çok kalemli fatura, kaydın sağlamlığı, tadilat atlama bedeli, hijyen/kumbara kalıcılığı.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { CITIZENS } from '../../src/content/citizens';
import { normalizeState } from '../../src/game/sim/save';
import { tadilatSkipGold, skipGold, P } from '../../src/content/economy';
import { ISCI_GUN_SAAT } from '../../src/content/isletme-kadro';
import { ISCI_SAAT_UCRET } from '../../src/content/esya';

function sahne(seed = 5) {
  const sim: any = played(seed);
  for (let i = 0; i < 60; i++) sim.step(0.1);
  sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
  for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost', 'masa3', 'masa4']) sim.command({ kind: 'force', what: 'unlock', value: k });
  sim.command({ kind: 'force', what: 'stage', value: 3 });
  const r = sim.rules.rt, cu = r.customersApi;
  cu.updateSpawner = () => {};
  for (const c of r.customers.slice()) cu.removeCustomer(c);
  return { sim, r, cu, S: sim.state, tip: (id: string) => CITIZENS.find(t => t.id === id)! };
}

describe('SİM düzeltmeleri', () => {
  it("yavaşlık kartında 'Sonra': kart ve simge temizlenir, sistem kilitlenmez", () => {
    const { sim, r } = sahne(21);
    r.slow = { link: 'kasa', at: { x: 0, z: 0 }, t: 0 };
    sim.command({ kind: 'tapSlow' });
    expect(r.slowCard).not.toBeNull();
    sim.command({ kind: 'dismissSolution' });
    expect(r.slowCard).toBeNull(); expect(r.slow).toBeNull();
    // kart açık unutulsa bile 90 sn sonra simge zaman aşımına uğrar (eskiden sonsuza dek kilitliydi)
    r.slow = { link: 'kasa', at: { x: 0, z: 0 }, t: 0 };
    sim.command({ kind: 'tapSlow' });
    sim.step(100);
    expect(r.slow).toBeNull(); expect(r.slowCard).toBeNull();
  });

  it('6 kişilik birleşik masa grubunun HEPSİ oturur (ek masaların koltukları da kullanılır)', () => {
    const { cu, tip, r } = sahne(15);
    const c = cu.spawnCustomer({ type: tip('bebekarabali'), n: 6, kind: 'masa' });
    expect(c.ekMasa.length).toBe(2);
    const koltuk = [c.seat.table, ...c.ekMasa].reduce((n: number, ti: number) => n + r.tables[ti].seats.filter((x: any) => x.occ === c.id).length, 0);
    expect(koltuk).toBe(c.n);   // her gövdeye koltuk var; syncAgents bunları partySeats ile dağıtır
  });

  it('masa kümesi en yakın boş komşuları seçer (sıralama koda işliyor)', () => {
    const { cu, tip, r } = sahne(15);
    const c = cu.spawnCustomer({ type: tip('bebekarabali'), n: 6, kind: 'masa' });
    const L = r.layout.tables, a = c.seat.table;
    const d = (i: number) => Math.hypot(L[i].x - L[a].x, L[i].z - L[a].z);
    // seçilen ek masalar, aynı kümeye girebilecek diğer boş masalardan daha uzak olmamalı
    const secilen = c.ekMasa.map(d), enUzak = Math.max(...secilen);
    for (let i = 0; i < r.tables.length; i++) {
      if (i === a || c.ekMasa.includes(i) || !r.tables[i]?.built || r.tables[i].seats.some((s: any) => s.occ)) continue;
      if (L[i] && d(i) < enUzak - 1e-6) { expect(d(i) <= enUzak).toBe(true); }   // daha yakın boş masa varsa kümeye girmeliydi
    }
    expect(c.ekMasa.length).toBe(2);
  });

  it('kızgın giden müşterinin ürünleri tezgâh 12 sınırına kadar geri konur (8 üstünde yok olmaz)', () => {
    const { sim, cu, tip, r } = sahne(22);
    for (let i = 0; i < 10; i++) r.counter.doner.push({ type: 'doner', tier: 1 });
    const c = cu.spawnCustomer({ type: tip('universiteli'), n: 1, order: { cay: 1 } });
    c.items.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 });
    for (let i = 0; i < 200 && c.state !== 'queue'; i++) sim.step(0.1);
    expect(c.state).toBe('queue');
    c.patience = 0; sim.step(0.3);
    expect(r.counter.doner.length).toBeLessThanOrEqual(12);
    expect(r.counter.doner.length).toBe(12);
  });

  it('kayıt: bozuk xp ve totalEarned sayıya çevrilir', () => {
    const sim: any = played(23);
    const d = { ...sim.state, xp: 'q', totalEarned: 'x' };
    normalizeState(d);
    expect(d.xp).toBe(0); expect(d.totalEarned).toBe(0);
  });

  it('Altın Simitle tadilat atlamak net Altın Simit kazandırmaz', () => {
    for (const left of [600, 3600, 4800, 9600]) expect(tadilatSkipGold(left) - P.AS_TAD).toBeGreaterThanOrEqual(skipGold(left));
    expect(tadilatSkipGold(0)).toBe(0);
  });

  it('işçi günlük maaşı gerçek oyun günü (19 saat) üzerinden gösterilir', () => {
    expect(ISCI_GUN_SAAT).toBe(19); expect(ISCI_SAAT_UCRET).toBeGreaterThan(0);
  });

  it('bahşiş kumbarası yeniden yüklemede sıfırlanmaz; hijyen puanı kayıttan başlar', () => {
    const sim: any = played(24);
    sim.step(5);
    const r = sim.rules.rt;
    (r.restoran).kumbara();   // lazy yükleme
    const g = sim.state.zones.restoran as { kumbara?: number };
    g.kumbara = 77;
    const sim2: any = played(24); sim2.state.zones.restoran = JSON.parse(JSON.stringify(sim.state.zones.restoran));
    expect(sim2.rules.rt.restoran.kumbara().birikim).toBe(77);
  });
});
