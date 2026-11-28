// BUF-06: oyuncu şef ve patron. Oyuncu mutfakta istasyon başında durup pişirir (dwell, bekle-al), tabak elinde, pass'a bırakır ya da masaya
// götürür; KDS sırasına göre bilet otomatik seçilir; istasyon aşçıya devredilir; aşama 1-2 "servis önce elle" bozulmaz. Deterministik.
import { describe, it, expect } from 'vitest';
import { installMutfakHat, OYUNCU, type HatTicket } from '../../src/game/sim/mutfak-hat';
import { hazirlikOf } from '../../src/content/yemek-menu';
import { pisirmeSuresi } from '../../src/content/mutfak';
import { mutfakDunya, mutfakStand, MUTFAK_NOKTA } from '../../src/content/ic-mekan';
import { kur } from './garson-yardimci';

/** çıplak hat: testin kendi bileti, oyuncunun eli (rt.carry) testin elinde */
function hatKur(stage: number, workers: { id: number; role: string; xp?: number; name?: string }[], tickets: HatTicket[]) {
  const carry: object[] = [], ev: [string, Record<string, unknown>][] = [];
  const K = { state: { stage, workers, tiers: {} }, rt: { carry, counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] } }, logEv: (n: string, d: Record<string, unknown>) => ev.push([n, d]) } as never;
  const hat = installMutfakHat(K, { tickets: () => tickets, jobs: () => 0 });
  return { hat, carry, ev };
}
const asci = (...ids: number[]) => ids.map(id => ({ id, role: 'asci', xp: 0, name: 'A' + id }));

describe('hat: oyuncu (wid -1)', () => {
  it('claim istasyon başında: KDS sırasındaki ilk uygun kalem, süre yalnız başında dururken işler', () => {
    const { hat, carry } = hatKur(5, [], [{ no: 1, table: 0, want: { tost: 1 } }, { no: 2, table: 1, want: { gozleme: 1 } }]);
    expect(hat.aday('izgara')).toBe('tost');
    expect(hat.claim(OYUNCU, undefined, { ist: 'cay_bar' })).toBeNull();   // çay barında pişecek bilet yok
    expect(hat.claim(OYUNCU, undefined, { ist: 'izgara' })).toBe('tost'); expect(hat.ist(OYUNCU)).toBe('izgara');
    const sure = hat.sure(OYUNCU); expect(sure).toBeCloseTo(Math.max(1.2, pisirmeSuresi(hazirlikOf('tost'), 0, []) * 0.4), 6);   // 2026-11-25: oyuncu büfe hızında
    for (let i = 0; i < 400; i++) hat.update(0.1);   // başında durmadan zaman geçer: ilerleme yok
    expect(hat.durum().cooking.length).toBe(0);   // 25 sn başında durmayınca iş bırakıldı (istasyon boşaldı)
    expect(hat.ist(OYUNCU)).toBeNull();
    hat.claim(OYUNCU, undefined, { ist: 'izgara' });
    let pl = null; for (let t = 0; t < sure - 0.2 && !pl; t += 0.1) { pl = hat.pTik(0.1); hat.update(0.1); }
    expect(pl).toBeNull(); expect(hat.pDurum().frac).toBeGreaterThan(0.9);
    pl = hat.pTik(0.3); expect(pl?.type).toBe('tost');
    carry.push(pl!);   // oyuncunun eline
    expect(hat.durum().elde.length).toBe(1); expect(hat.view().ist.izgara).toBeUndefined();   // tabak elde, istasyon boş
    expect(hat.mutfakTabagi(pl!)).toBe(true);
  });
  it('elde tabak varken aynı bilet bir daha pişmez, tabak pass rafına bırakılır, elden düşen tabak sayımdan çıkar', () => {
    const { hat, carry } = hatKur(5, [], [{ no: 1, table: 0, want: { tost: 1 } }]);
    hat.claim(OYUNCU, undefined, { ist: 'izgara' }); const p = hat.pTik(100)!; carry.push(p);
    expect(hat.aday('izgara')).toBeNull();   // eldeki tabak bileti karşılıyor: gereksiz pişirme yok
    expect(hat.pPass(p)).toBe(true); carry.length = 0;
    expect(hat.passCount('tost')).toBe(1); expect(hat.durum().elde.length).toBe(0);
    const q = hatKur(5, [], [{ no: 1, table: 0, want: { tost: 1 } }]);
    q.hat.claim(OYUNCU, undefined, { ist: 'izgara' }); q.carry.push(q.hat.pTik(100)!);
    q.carry.length = 0; q.hat.update(0.1);   // masaya teslim / çöpe: eldeki kayıt silinir
    expect(q.hat.durum().elde.length).toBe(0);
  });
  it('başka bilete geçmek: önceki iş bırakılır, istasyon boşalır', () => {
    const { hat } = hatKur(5, [], [{ no: 1, table: 0, want: { tost: 1 } }, { no: 2, table: 1, want: { cay: 1 } }]);
    hat.claim(OYUNCU, undefined, { ist: 'izgara' });
    expect(hat.aday('cay_bar')).toBe('cay');   // kendi işi dışında kalan dünya
    hat.pBirak(); expect(hat.ist(OYUNCU)).toBeNull(); expect(hat.claim(OYUNCU, undefined, { ist: 'cay_bar' })).toBe('cay');
  });
  it('oyuncu pişirirken aşçı o istasyona yönelmez (claim kilidi)', () => {
    const { hat } = hatKur(5, asci(100), [{ no: 1, table: 0, want: { tost: 2 } }]);
    hat.claim(OYUNCU, undefined, { ist: 'izgara' });
    expect(hat.claim(100)).toBeNull();   // izgara oyuncuda, tost'un başka istasyonu yok
  });
});

describe('hat: devir (devredildi)', () => {
  it('devralan aşçı kendi istasyonuna bakar, diğer aşçı o istasyonu kullanmaz; devralanı kilitlemez', () => {
    const tk: HatTicket[] = [{ no: 1, table: 0, want: { tost: 1, cay: 1 } }];
    const { hat } = hatKur(5, asci(100, 101), tk);
    expect(hat.devret('izgara', 100)).toBe(true); expect(hat.devirOf('izgara')).toBe(100); expect(hat.devirIst(100)).toBe('izgara');
    expect(hat.devret('izgara', 101)).toBe(false);   // başkasına devredilmiş
    expect(hat.claim(101)).toBe('cay');   // izgara 100'ün: 101 tost'a değil çaya gider
    expect(hat.claim(100)).toBe('tost'); expect(hat.ist(100)).toBe('izgara');
    expect(hat.view().devir).toEqual({ izgara: 100 });
    // devralan aşçı kendi istasyonunda iş yoksa diğer istasyonlara bakar (kilitlenme yok)
    const b = hatKur(5, asci(100), [{ no: 1, table: 0, want: { cay: 1 } }]);
    b.hat.devret('izgara', 100); expect(b.hat.claim(100)).toBe('cay'); expect(b.hat.ist(100)).toBe('cay_bar');
  });
  it('geçersiz devir reddedilir; aşçı gidince devir kalkar; geri alınabilir', () => {
    const ws = asci(100), { hat } = hatKur(5, ws, []);
    expect(hat.devret('bulasik', 100)).toBe(false); expect(hat.devret('izgara', 999)).toBe(false); expect(hat.devret('meze', 100)).toBe(false);   // aşama 5'te meze yok
    expect(hat.devret('ocak', 100)).toBe(true); expect(hat.devirAl('ocak')).toBe(true); expect(hat.devirOf('ocak')).toBeNull();
    hat.devret('ocak', 100); ws.length = 0; hat.update(0.1); expect(hat.devirOf('ocak')).toBeNull();
  });
});

describe('tam sim: oyuncu mutfakta', () => {
  const stand = (ist: string) => mutfakDunya(mutfakStand(ist));
  function hazir() {
    const k = kur(4);
    k.sim.command({ kind: 'force', what: 'stage', value: 4 });
    k.step(0.3);
    return k;
  }
  it('istasyon başında dur: bilet otomatik seçilir, süre dolunca tabak elde, pass\'a bırakılır', () => {
    const k = hazir(), { sim, api, r } = k;
    expect(sim.interactions.get('mutfak.izgara')).toBeTruthy(); expect(sim.interactions.get('mutfak.pass')).toBeTruthy();
    k.musteri(0, { tost: 1 });
    k.step(6);   // bilet açıldı (garson yok: oyuncu servis)
    expect(api.view().tickets.length).toBe(1);
    const p = stand('izgara'); sim.command({ kind: 'teleport', x: p.x, z: p.z });
    k.step(1);
    expect(api.hat!.ist(-1)).toBe('izgara'); expect(api.view().oyuncu.ist).toBe('izgara');
    k.step(hazirlikOf('tost') * 0.4 + 0.4);
    expect(r.carry.length).toBe(1); expect(r.carry[0].type).toBe('tost');
    // masaya götürmek yerine pass'a bırak
    const q = mutfakDunya(MUTFAK_NOKTA.passAsci); sim.command({ kind: 'teleport', x: q.x, z: q.z });
    k.step(1.5);
    expect(r.carry.length).toBe(0); expect(api.hat!.passCount('tost')).toBe(1);
  });
  it('tabak elde masaya götürülür (servis.<i>): bilet kapanır, müşteri yemeğe başlar', () => {
    const k = hazir(), { sim, api, r } = k;
    const c = k.musteri(0, { tost: 1 }); k.step(6);
    const p = stand('izgara'); sim.command({ kind: 'teleport', x: p.x, z: p.z });
    k.step(hazirlikOf('tost') * 0.4 + 1.4);
    expect(r.carry.length).toBe(1);
    const tb = r.layout.tables[0]; sim.command({ kind: 'teleport', x: tb.x, z: tb.z });
    k.step(2);
    expect(r.carry.length).toBe(0); expect(api.view().tickets.length).toBe(0); expect(c.state).toBe('eat');
    expect(api.hat!.durum().elde.length).toBe(0);
  });
  it('bilet yokken istasyon büfe gibi çalışır: eller dolana kadar hazırlanır, pass\'a bırakılır', () => {
    const k = hazir(), { sim, api, r } = k;
    const p = stand('izgara'); sim.command({ kind: 'teleport', x: p.x, z: p.z });
    k.step(1); expect(api.hat!.ist(-1)).toBe('izgara');
    k.step(60);
    expect(r.carry.length, 'eller dolana kadar').toBe(4);
    const q = mutfakDunya(MUTFAK_NOKTA.passAsci); sim.command({ kind: 'teleport', x: q.x, z: q.z });
    k.step(2); expect(r.carry.length).toBe(0);
  });
  it('bilet yokken eller boşsa devredilmiş istasyon boştaki aşçıdan geri alınır, sonra hazırlık yapılır', () => {
    const k = hazir(), { sim, api, S } = k;
    S.workers.push({ id: 7001, name: 'Deneme Aşçı', role: 'asci', xp: 0, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat', rarity: 'gri' });
    k.step(0.5);
    const p = stand('ocak'), away = stand('izgara');
    expect(api.hat!.devret('ocak', 7001)).toBe(true);
    sim.command({ kind: 'teleport', x: p.x, z: p.z }); k.step(1.5);
    expect(api.view().devir.ocak).toBeUndefined();
    sim.command({ kind: 'teleport', x: away.x, z: away.z }); k.step(0.3);
    sim.command({ kind: 'teleport', x: p.x, z: p.z }); k.step(1.5);
    expect(api.hat!.ist(-1)).toBe('ocak');
  });
  it('aşama 1-2 servis önce elle: mutfak etkileşimi yok, bilet oyuncuyla servis edilir', () => {
    const k = kur(4), { sim, api, r } = k;
    k.sim.command({ kind: 'force', what: 'stage', value: 2 }); k.step(0.3);
    expect(sim.interactions.get('mutfak.ocak')).toBeUndefined(); expect(sim.interactions.get('mutfak.pass')).toBeUndefined();
    expect(api.mutfakHazir!()).toBe(false); expect(api.view().oyuncu.ist).toBeNull();
    void r;
  });
  it('yemek bileti koşulu: aşçı ya da oyuncu mutfakta; oyuncu çıkınca 45 sn sonra kapanır', () => {
    const k = hazir(), { sim, api, S } = k;
    expect(api.mutfakHazir!()).toBe(false);   // aşçı yok, garson yok, oyuncu dışarıda
    const p = stand('ocak'); sim.command({ kind: 'teleport', x: p.x, z: p.z }); k.step(0.3);
    expect(api.mutfakHazir!()).toBe(true);
    sim.command({ kind: 'teleport', x: 4.5, z: -2.5 }); k.step(30); expect(api.mutfakHazir!()).toBe(true);
    k.step(20); expect(api.mutfakHazir!()).toBe(false);
    S.workers.push({ id: 7002, name: 'A', role: 'asci', xp: 0, rank: 0, morale: 70, traits: [], trait: 'hamarat', rarity: 'gri' });
    expect(api.mutfakHazir!()).toBe(false);   // garson hâlâ yok, oyuncu da dışarıda
    k.garson(7003); expect(api.mutfakHazir!()).toBe(true);
  });
});
