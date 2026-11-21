// KAL-13 oyun içi bekçi: bilerek bozulan durumlar yakalanır, sağlıklı oyun sessiz kalır.
import { describe, it, expect } from 'vitest';
import { installBekci } from '../../src/game/sim/bekci';
import { played } from './m1-helpers';

function sahte() {
  const olaylar: { n: string; d: any }[] = []; let sys: any = null;
  const S: any = { money: 100, xp: 5, gold: 0, level: 1, playT: 10, day: 3 };
  const cust = (id: number, o: any = {}) => ({ id, state: 'walk', x: 1, z: 1, patience: 10, t: 0, ...o });
  const rt: any = { started: true, customers: [], queue: [], kasa: [], floor: [], tables: [], agents: { workers: { rows: () => rt.iscil } }, iscil: [] };
  const R: any = { state: S, rt, bus: { emit: (n: string, d: any) => olaylar.push({ n, d }) }, addSystem: (s: any) => { sys = s; }, playerPos: { x: 0, z: 0 }, agents: null };
  const b = installBekci(R, { takiliS: 5, tekrarS: 3 });
  return { S, rt, b, olaylar, cust, tik: (sn: number) => { for (let i = 0; i < sn; i++) sys.step({ dt: 1 }); } };
}

describe('bekçi', () => {
  it('sağlıklı durumda anomali yok', () => {
    const { rt, b, cust, tik } = sahte(); rt.customers.push(cust(1, { state: 'eat' }), cust(2, { state: 'queue' }));
    tik(30); expect(b.anomaliler()).toEqual([]);
  });
  it('NaN para ve negatif tecrübe yakalanır, anomali olayı yayılır', () => {
    const { S, b, olaylar, tik } = sahte(); S.money = NaN; S.xp = -3; tik(2);
    const t = b.anomaliler().map(a => a.tur); expect(t).toContain('nan'); expect(t).toContain('negatif');
    expect(olaylar.some(o => o.n === 'anomali' && o.d.tur === 'nan')).toBe(true);
  });
  it('hareket durumunda kıpırdamayan müşteri takılı sayılır; kıpırdayan ve oturan sayılmaz', () => {
    const { rt, b, cust, tik } = sahte();
    const takili = cust(1), gezen = cust(2), oturan = cust(3, { state: 'eat' });
    rt.customers.push(takili, gezen, oturan);
    for (let i = 0; i < 12; i++) { gezen.x += 0.5; tik(1); }
    const a = b.anomaliler().filter(x => x.tur === 'takili-musteri');
    expect([...new Set(a.map(x => x.anahtar))]).toEqual(['1']);
  });
  it('aynı noktaya yığılma, kuyruk taşması, kasa yığını, NaN müşteri', () => {
    const { rt, b, cust, tik } = sahte();
    for (let i = 0; i < 6; i++) rt.customers.push(cust(10 + i, { x: 2 + i * 0.01, z: 2 }));
    rt.queue = new Array(50).fill(0); rt.kasa = new Array(61).fill({ v: 1 });
    rt.customers.push(cust(99, { x: NaN }));
    tik(2);
    const t = new Set(b.anomaliler().map(a => a.tur));
    for (const k of ['yigilma', 'kuyruk-tasmasi', 'kasa-yigini', 'nan']) expect(t.has(k), k).toBe(true);
  });
  it('iş varken uzun süre boşta işçi yakalanır; iş yokken boşta olması serbest', () => {
    const { rt, b, tik } = sahte(); rt.iscil = [{ id: 7, role: 'garson', state: 'idle', x: 1, z: 1 }];
    tik(200); expect(b.anomaliler().filter(a => a.tur === 'bosta-isci')).toEqual([]);
    rt.queue = [1, 2, 3, 4]; tik(130); expect(b.anomaliler().some(a => a.tur === 'bosta-isci')).toBe(true);
  });
  it('aynı anomali tekrar süresi dolmadan yeniden yayılmaz', () => {
    const { S, b, tik } = sahte(); S.money = NaN; tik(2); const n = b.anomaliler().length; tik(1); expect(b.anomaliler().length).toBe(n);
  });
  it('gerçek sim: 4 dk oynanınca (müşteri akışı) sağlıklı oyun anomali üretmez', () => {
    const sim = played(7) as any; sim.step(1);
    const b = installBekci(sim.rules);
    sim.command({ kind: 'force', what: 'stage', value: 3 });
    sim.step(240);
    expect(b.anomaliler(), JSON.stringify(b.anomaliler().slice(0, 5))).toEqual([]);
  });
});
