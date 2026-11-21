// BUF-09: garson akışı baştan sona gerçek (menü -> sipariş -> pass/tezgâh -> masa -> hesap -> kirli masa silme). Hiçbir tabak
// ışınlanmaz: her teslimde bir garson aktörü masanın yanındadır; menü/sipariş/hesap kendiliğinden geçmez; garson meşgulse müşteri
// bekler; zaman aşımı garsonu idle'a döndürür. Deterministik: sabit tohum, kontrollü masa müşterileri (rastgele akış kapalı).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { kur, evs, type Kurulum } from './garson-yardimci';
import { ADISYON } from '../../src/content/restoran';
import { garsonTasima } from '../../src/content/ranks';

/** her 'serve' olayında en yakın garson aktörünün masaya uzaklığını ölçer (olay anında, senkron) */
function serviseBak(k: Kurulum) {
  const d: number[] = [];
  k.sim.rules.bus.on('serve', (e: { table: number }) => {
    const tb = k.r.layout.tables[e.table];
    const ws = k.r.agents.workers.rows().filter((w: { role: string }) => w.role === 'garson');
    d.push(ws.length ? Math.min(...ws.map((w: { x: number; z: number }) => Math.hypot(w.x - tb.x, w.z - tb.z))) : Infinity);
  });
  return d;
}
const cay = () => ({ type: 'cay', tier: 1 });

describe('BUF-09 garson akışı', () => {
  it('tam döngü: menü, sipariş (fiş o an yazılır), tezgâhtan tabak, masaya servis, gerçek hesap, kirli masa silinir', () => {
    const k = kur(); const dist = serviseBak(k);
    k.garson(701); k.step(3);
    const T = k.kurulu()[0], c = k.musteri(T, { cay: 2 });
    k.r.counter.cay.push(cay(), cay());
    let ticketBeforeOrder = false, plateLeftEarly = false;
    k.step(120, () => {
      if (evs(k.sim, 'ticket').length && !k.S.stats.siparisAl) ticketBeforeOrder = true;
      // tabaklar garson gelip alana kadar tezgâhta görünür durur
      if (!k.api.debug!().tepsi && evs(k.sim, 'serve').length === 0 && k.S.stats.siparisAl && k.r.counter.cay.length < 2) plateLeftEarly = true;
      return c.state !== 'wait' && c.state !== 'eat' && k.r.tables[T].dirty === 0 && k.garsonRow(701)?.state === 'idle';
    });
    expect(k.S.stats.menuGetir).toBe(1); expect(k.S.stats.siparisAl).toBe(1); expect(k.S.stats.hesapGetir).toBe(1);
    expect(ticketBeforeOrder).toBe(false); expect(plateLeftEarly).toBe(false);
    expect(dist.length).toBe(2); for (const d of dist) expect(d).toBeLessThanOrEqual(2.6);
    expect(k.S.stats.isinlanma || 0).toBe(0);
    // ödeme yalnız hesap gelince: son tabaktan hemen sonra gelir yazılmadı, hesap olayı garsonla
    const h = evs(k.sim, 'hesap'); expect(h.length).toBe(1); expect(h[0].data.garson).toBe(true);
    const sv = evs(k.sim, 'serve'); expect(h[0].tick).toBeGreaterThan(sv[sv.length - 1].tick);
    const sale = evs(k.sim, 'sale').filter((e: any) => e.data.kind === 'masa'); expect(sale.length).toBe(1); expect(sale[0].tick).toBe(h[0].tick);
    // kirli masa: yemek bitince tabaklar masada kaldı, garson silip temizledi (TIPS_ON'dan bağımsız)
    expect(k.S.stats.kirliMasa).toBe(1); expect(k.S.stats.garsonSildi).toBe(1); expect(k.r.tables[T].dirty).toBe(0);
    expect(k.api.debug!()).toMatchObject({ gorevler: 0, tepsi: 0, claimed: 0 });
  });

  it('tezgâh boşken bilet sabırla düşer, garson idle\'a döner (takılı iş yok)', () => {
    const k = kur(); k.garson(701); k.step(3);
    const c = k.musteri(k.kurulu()[0], { doner: 1 });
    k.step(200);
    expect(k.api.view().tickets.length).toBe(0);
    expect(c.state === 'leave' || !k.r.customers.includes(c)).toBe(true);
    expect(k.api.debug!()).toMatchObject({ gorevler: 0, tepsi: 0 });
    expect(['idle', 'toSrc', 'load', 'toCounter', 'unload']).toContain(k.garsonRow(701)!.state);
    expect(k.S.stats.isinlanma || 0).toBe(0); expect(evs(k.sim, 'serve').length).toBe(0);
  });

  it('garson çıkarılınca takılı iş kalmaz, elindeki tabaklar tezgâha döner', () => {
    const k = kur(); k.garson(701); k.step(3);
    k.musteri(k.kurulu()[0], { doner: 2 });
    k.r.counter.doner.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 });
    k.step(90, () => k.api.debug!().tepsi === 2);
    expect(k.api.debug!().tepsi).toBe(2); expect(k.r.counter.doner.length).toBe(0);
    k.S.workers.length = 0;
    k.step(2);
    expect(k.api.debug!()).toMatchObject({ gorevler: 0, tepsi: 0 });
    expect(k.r.counter.doner.length).toBe(2);
  });

  it('garson yokken oyuncu servis eder; ödeme yemek bitince müşteri kendisi; kumbara dolmaz', () => {
    const k = kur(); k.step(1);
    const T = k.kurulu()[0], c = k.musteri(T, { cay: 1 });
    k.step(ADISYON.orderDelay + 0.5);
    expect(k.api.view().tickets.length).toBe(1);   // garson yok: bilet kısa bakıştan sonra (H-142)
    k.r.carry.push(cay());
    const it = k.sim.rules.interactions.get('servis.' + T); expect(it.canAct()).toBe(true); it.act();
    expect(c.state).toBe('eat');
    const masaSatis = () => evs(k.sim, 'sale').filter((e: any) => e.data.kind === 'masa').length;
    k.step(c.eatT - 0.5); expect(evs(k.sim, 'hesap').length).toBe(0); expect(masaSatis()).toBe(0);
    k.step(1.5);
    expect(evs(k.sim, 'hesap').length).toBe(1); expect(k.S.stats.hesapKendisi).toBe(1); expect(masaSatis()).toBe(1);
    expect(k.api.kumbara!().birikim).toBe(0);   // garsonların kumbarası: garson yokken bahşiş yok, oyuncuya da bahşiş geliri yok
    expect(k.r.tables[T].dirty).toBe(0);         // silecek kimse yok: kirlenme yok (masa kilitlenmez)
  });

  it('hesap geç gelirse müşteri bekler: garson ayrılınca hesap yok, dönünce hesap gelir', () => {
    const k = kur(); k.garson(701); k.step(3);
    const c = k.musteri(k.kurulu()[0], { cay: 1 });
    k.r.counter.cay.push(cay());
    k.step(90, () => c.state === 'eat');
    expect(c.state).toBe('eat');
    k.S.workers.length = 0; k.step(1);
    k.step(c.eatT + 10 - c.t);
    expect(c.state).toBe('eat'); expect(evs(k.sim, 'hesap').length).toBe(0); expect(evs(k.sim, 'sale').filter((e: any) => e.data.kind === 'masa').length).toBe(0);
    k.garson(702);
    k.step(30, () => evs(k.sim, 'hesap').length > 0);
    expect(evs(k.sim, 'hesap').length).toBe(1); expect(k.S.stats.hesapGetir).toBe(1);
    k.step(1); expect(c.state).toBe('leave');
  });

  it('garson hiç gelmezse hesapBekleMaxS sonra para masaya bırakılır (sonsuz bekleme yok)', () => {
    const k = kur(); k.garson(701); k.step(3);
    const c = k.musteri(k.kurulu()[0], { cay: 1 });
    k.r.counter.cay.push(cay());
    k.step(90, () => c.state === 'eat');
    k.S.workers.length = 0;
    k.step(c.eatT + ADISYON.hesapBekleMaxS - 2 - c.t); expect(c.state).toBe('eat');
    k.step(3); expect(k.S.stats.hesapKendisi).toBe(1); expect(c.state).toBe('leave');
  });

  it('öncelik: sıcak tabak > sipariş > hesap > masa sil', () => {
    const k = kur(); const [t0, t1, t2, t3] = k.kurulu();
    for (const id of [801, 802, 803, 804, 805]) { k.garson(id); }
    for (const id of [801, 802, 803, 804, 805]) k.api.bolgeAta!(id, '*');
    const at = (t: number) => ({ x: k.r.layout.tables[t].x, z: k.r.layout.tables[t].z });
    // A: menü + sipariş verilmiş, tezgâhta tabağı hazır
    const A = k.musteri(t0, { cay: 1 }); A.t = 1; k.api.update(0.1);
    let g = k.api.isAl!(805, { cap: 2 })!; expect(g.tur).toBe('menu'); k.api.isTamam!(805, g.id, at(t0));
    A.dusunT = 0; k.api.update(0.1);
    g = k.api.isAl!(805, { cap: 2 })!; expect(g.tur).toBe('siparis'); k.api.isTamam!(805, g.id, at(t0));
    k.r.counter.cay.push(cay());
    // B: menüyü okudu, sipariş bekliyor; C: yemeğini bitiriyor, hesap bekliyor; D: kirli masa
    const B = k.musteri(t1, { cay: 1 }); B.menuOk = true; B.dusunT = 0; B.t = 5;
    const C = k.musteri(t2, { cay: 1 }); C.state = 'eat'; C.eatT = 25; C.t = 25; C.hesapBekle = true; C.items = [cay()];
    k.r.tables[t3].dirty = 2;
    k.api.update(0.1);
    expect(k.api.isAl!(801, { cap: 2 })!.tur).toBe('tabak');
    expect(k.api.isAl!(802, { cap: 2 })!.tur).toBe('siparis');
    expect(k.api.isAl!(803, { cap: 2 })!.tur).toBe('hesap');
    expect(k.api.isAl!(804, { cap: 2 })!.tur).toBe('sil');
    expect(k.api.isAl!(801, { cap: 2 })!.tur).toBe('tabak');   // işi olan garson aynı işi geri alır (çift ayırma yok)
  });

  it('taşıma kapasitesi tek yerde: seviye 1-3 iki, seviye 4+ üç tabak', () => {
    expect(garsonTasima(0)).toBe(2); expect(garsonTasima(2)).toBe(2); expect(garsonTasima(3)).toBe(3); expect(garsonTasima(9)).toBe(3); expect(garsonTasima(0, 1)).toBe(3);
    const run = (xp: number) => {
      const k = kur(); k.garson(701, xp); k.step(3);
      k.musteri(k.kurulu()[0], { cay: 3 });
      for (let i = 0; i < 3; i++) k.r.counter.cay.push(cay());
      let maxCarry = 0;
      k.step(60, () => { const a = k.r.agents.registry.list.find((x: any) => x.kind === 'worker' && x.key === '701'); if (['toTable', 'serve'].includes(k.garsonRow(701)!.state)) maxCarry = Math.max(maxCarry, a?.carry.length || 0); });   // masa tepsisi (büfe taşıması ayrı: ROLES.garson.carry)
      return maxCarry;
    };
    expect(run(0)).toBe(2);
    expect(run(900)).toBe(3);
  });

  it('oyuncu aynı tabağı önce servis ederse garsonun tabağı tezgâha geri döner, bilet tek kez kapanır', () => {
    const k = kur(); k.garson(701); k.step(3);
    const T = k.kurulu()[0], c = k.musteri(T, { cay: 1 });
    k.r.counter.cay.push(cay());
    k.step(90, () => k.api.debug!().tepsi === 1);
    expect(k.api.debug!().tepsi).toBe(1);
    k.r.carry.push(cay()); k.sim.rules.interactions.get('servis.' + T).act();   // oyuncu yetişti
    expect(c.state).toBe('eat');
    k.step(20, () => k.api.debug!().gorevler === 0 && k.garsonRow(701)?.state === 'idle');
    expect(k.api.debug!()).toMatchObject({ gorevler: 0, tepsi: 0 });
    expect(k.r.counter.cay.length).toBe(1);   // tabak yürüyerek tezgâha geri bırakıldı (kaybolmadı, çoğalmadı)
    expect(evs(k.sim, 'serve').length).toBe(1); expect(k.S.stats.isinlanma || 0).toBe(0);
  });

  it('3 masa, 2 garson, 10 dk: ışınlanma yok, ölü kilit yok, tüm tabaklar garsonla, masalar silinir', () => {
    const k = kur(); const dist = serviseBak(k);
    k.garson(701); k.garson(702); k.step(3);
    const masalar = k.kurulu().slice(0, 3), urun = ['cay', 'doner', 'tost'];
    let n = 0;
    const yeni = (t: number) => k.musteri(t, { [urun[n++ % 3]]: 1 + (n % 2) });
    masalar.forEach(yeni);
    let maxClaimAge = 0; const claimAt = new Map<number, number>();
    k.step(600, (i) => {
      if (i % 50 === 0) for (const t of k.api.view().tickets) for (const it of t.items) if (it.left > 0 && (k.r.counter[it.p]?.length || 0) < 3) k.r.counter[it.p].push({ type: it.p, tier: 1 });
      for (const t of masalar) {
        const tb = k.r.tables[t];
        if (tb.dirty <= 0 && tb.seats.every((s: { occ: number }) => !s.occ)) yeni(t);
      }
      // her garson işi en fazla isZamanAsimiS sürer (iş alındığı andan)
      for (const w of [701, 702]) {
        const st = k.garsonRow(w)!.state;
        if (['toPass', 'pickJob', 'toTable', 'serve', 'toGeri', 'toMasa', 'masaAct', 'toClean', 'wipe'].includes(st)) { if (!claimAt.has(w)) claimAt.set(w, k.S.playT); maxClaimAge = Math.max(maxClaimAge, k.S.playT - claimAt.get(w)!); }
        else claimAt.delete(w);
      }
    });
    expect(k.S.stats.isinlanma || 0).toBe(0);
    expect(dist.length).toBeGreaterThan(10); for (const d of dist) expect(d).toBeLessThanOrEqual(2.6);
    expect(k.S.stats.hesapGetir).toBeGreaterThanOrEqual(3);
    expect(k.S.stats.garsonSildi).toBeGreaterThanOrEqual(3);
    expect(k.S.stats.isZamanAsimi || 0).toBe(0); expect(k.S.stats.garsonZamanAsimi || 0).toBe(0);
    expect(maxClaimAge).toBeLessThan(ADISYON.isZamanAsimiS);
    expect(k.S.stats.hesapKendisi || 0).toBe(0);
  }, 60000);

  it('masa devri sakin (S-211, B-105) ve ışınlanma yolları kodda yok', () => {
    expect(ADISYON.eat).toEqual([22, 32]); expect(ADISYON.patience).toBe(150); expect(ADISYON.maxOpen).toBe(3);
    const src = readFileSync('src/game/sim/restoran.ts', 'utf8');
    expect(src).not.toMatch(/j\.t\s*>\s*12/); expect(src).not.toMatch(/orderDelay\s*\+\s*14/); expect(src).not.toMatch(/masaJobs/);
    expect(readFileSync('src/game/sim/customers.ts', 'utf8')).not.toMatch(/TIPS_ON/);
  });
});
