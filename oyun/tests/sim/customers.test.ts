// M1 customers: queue, counter purchase, patience, seating + tips, queue cap, dwell rule at the counter.
import { describe, it, expect } from 'vitest';
import { played, events } from './m1-helpers';
import { CITIZENS } from '../../src/content/citizens';
import { PRODUCTS } from '../../src/content/products';
import { TIP_DAVRANIS, davranisOf, GRUP, HAFTA_SONU, MAC_DALGA, macDalgaX, macDalgaAdi, KALABALIK_UST } from '../../src/content/musteri';
import { makeSandbox } from './agents-harness';

const stock = (sim: any, n = 8) => { for (const p of ['doner', 'cay']) while (sim.rules.rt.counter[p].length < n) sim.rules.rt.counter[p].push({ type: p, tier: 1 }); };

describe('customers', () => {
  it('the first customer (emekli amca) arrives at 3 s and is served from a stocked counter', () => {
    const sim = played(1);
    sim.step(2.5);
    expect(events(sim, 'firstCustomer').length).toBe(0);
    sim.step(1);
    expect(events(sim, 'firstCustomer').length).toBe(1);
    expect(sim.rules.rt.queue.length).toBe(1);
    const money0 = sim.state.totalEarned;
    for (let i = 0; i < 400; i++) { stock(sim); sim.step(0.1); }
    expect(sim.state.totalEarned).toBeGreaterThan(money0);
    expect(events(sim, 'sale').length).toBeGreaterThan(0);
    expect(events(sim, 'siftah').length).toBe(1);
  });
  it('patience runs out on an empty counter: the customer leaves angry and the queue moves on', () => {
    const sim = played(2);
    sim.rules.rt.layout; sim.step(200);
    expect(events(sim, 'angry').length).toBeGreaterThan(0);
    expect(sim.state.today!.angry).toBeGreaterThan(0);
  });
  it('the queue never holds more than 8 (even with tables and a ferry wave)', () => {
    const sim = played(3);
    sim.command({ kind: 'force', what: 'unlock', value: 'cay' });
    sim.command({ kind: 'force', what: 'unlock', value: 'ayran' });
    sim.command({ kind: 'force', what: 'unlock', value: 'tabure1' });
    sim.state.playT = 400;
    for (let i = 0; i < 2400; i++) {
      sim.step(0.1);
      const rt = sim.rules.rt;
      expect(rt.queue.length).toBeLessThanOrEqual(8);
    }
  });
  it('survey 2026-10-24: no tips; seated customers still finish their meal', () => {
    const sim = played(4);
    for (const k of ['cay', 'ayran', 'tabure1', 'tabure2']) sim.command({ kind: 'force', what: 'unlock', value: k });
    sim.state.playT = 400;
    let tipped = false;
    for (let i = 0; i < 6000 && !tipped; i++) {
      stock(sim); for (const p of ['ayran']) while (sim.rules.rt.counter[p as 'ayran'].length < 8) sim.rules.rt.counter[p as 'ayran'].push({ type: p as 'ayran', tier: 1 });
      sim.step(0.1);
      if (events(sim, 'tip').length) tipped = true;
    }
    expect(tipped).toBe(false);
    expect(events(sim, 'mealDone').length).toBeGreaterThan(0);   // meals still finish and seat is freed
  });
  it('dwell rule: running past the counter with full hands drops nothing', () => {
    const sim = played(1);
    const r = sim.rules, L = r.rt.layout;
    r.rt.carry.push({ type: 'doner', tier: 1 }, { type: 'doner', tier: 1 });
    sim.command({ kind: 'teleport', x: L.counter.standAt.x - 3, z: L.counter.standAt.z });
    for (let i = 0; i < 15; i++) { sim.input({ x: 1, z: 0 }); sim.step(1 / 30); }
    expect(Math.abs(sim.walk.pos.x - L.counter.standAt.x)).toBeLessThan(1.0);   // inside the counter radius, moving fast
    expect(r.rt.counter.doner.length).toBe(0);
    expect(r.rt.carry.length).toBe(2);
    // the nearest dwell target after the fast pass is the doner station, so stand on the counter itself to test the drop
    sim.command({ kind: 'teleport', x: L.counter.standAt.x, z: L.counter.standAt.z });
    sim.input({ x: 0, z: 0 });
    sim.step(1.2);
    expect(r.rt.counter.doner.length).toBe(2);              // standing still drops after the dwell
  });
});

// ───────── BUF-23 müşteri sabrı ve tipleri, BUF-24 büyük gruplar / hafta sonu / maç günü ─────────
const evN = (sim: any, name: string) => sim.events(0).filter((e: { name: string }) => e.name === name);
/** kontrollü sahne: rastgele akış kapalı, 8 masa kurulu (aşama 3) */
function sahne(seed = 5) {
  const sim: any = played(seed);
  for (let i = 0; i < 60; i++) sim.step(0.1);
  sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
  for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost', 'masa3', 'masa4']) sim.command({ kind: 'force', what: 'unlock', value: k });
  sim.command({ kind: 'force', what: 'stage', value: 3 });
  const r = sim.rules.rt, cu = r.customersApi;
  cu.updateSpawner = () => {};
  for (const c of r.customers.slice()) cu.removeCustomer(c);
  const tip = (id: string) => CITIZENS.find(t => t.id === id)!;
  return { sim, r, cu, S: sim.state, tip };
}

describe('BUF-23 müşteri tipleri ve sabır', () => {
  it('davranış tablosu citizens ile uyumlu: her anahtar gerçek bir tip, yedi tür de var', () => {
    for (const id of Object.keys(TIP_DAVRANIS)) expect(CITIZENS.some(t => t.id === id)).toBe(true);
    const etiketler = new Set(Object.values(TIP_DAVRANIS).map(d => d.etiket));
    for (const e of ['ogrenci', 'aile', 'cift', 'yasli', 'isinsani', 'turist', 'taraftar']) expect(etiketler.has(e as never)).toBe(true);
    expect(davranisOf('universiteli').etiket).toBe('ogrenci'); expect(davranisOf('bebekarabali').etiket).toBe('aile'); expect(davranisOf('balayi').etiket).toBe('cift');
    for (const id of ['emekli', 'teyze']) expect(davranisOf(id).etiket).toBe('yasli');
    for (const id of ['kruvaziyer', 'turgrubu'.replace('turgrubu', 'gezgin')]) expect(davranisOf(id).etiket).toBe('turist');
  });
  it('tip davranışı: öğrenci hızlı yer, çift ve yaşlı yavaş; iş insanı aceleci; aile büyük masa ister', () => {
    expect(davranisOf('universiteli').ye).toBeLessThan(1);
    expect(davranisOf('balayi').ye).toBeGreaterThan(1.3); expect(davranisOf('emekli').ye).toBeGreaterThan(1.3);
    expect(CITIZENS.find(c => c.id === 'isinsani')!.patience).toBe(1); expect(davranisOf('isinsani').kasa).toBeLessThan(1);
    expect(davranisOf('emekli').kasa).toBeGreaterThan(1.2); expect(davranisOf('emekli').sohbet!.length).toBeGreaterThan(0);
    expect(davranisOf('bebekarabali').buyuk!.n[1]).toBeGreaterThanOrEqual(5);
    expect(CITIZENS.find(t => t.id === 'balayi')!.prefer.gazoz).toBeDefined();
  });
  it('sabır tipe göre ölçeklenir: iş insanı en kısa, çift ve yaşlı uzun', () => {
    const { cu, tip } = sahne(); const pat = (id: string) => cu.spawnCustomer({ type: tip(id), n: 1, order: { cay: 1 } }).patMax;
    const is = pat('isinsani'), og = pat('universiteli'), cift = pat('balayi'), yasli = pat('emekli');
    expect(is).toBeLessThan(og); expect(cift).toBeGreaterThan(og); expect(yasli).toBeGreaterThan(cift * 0.9);
  });
  it('ürün tercihi: iş insanı öğrenciden pahalı sipariş verir (ort. birim fiyat)', () => {
    const { cu, tip, r } = sahne(8);
    const ort = (id: string) => {
      let top = 0, n = 0;
      for (let i = 0; i < 160; i++) { const c = cu.spawnCustomer({ type: tip(id), n: 1 }); for (const p in c.order) { top += PRODUCTS[p as 'cay'].base * c.order[p]; n += c.order[p]; } cu.removeCustomer(c); r.queue.length = 0; }
      return top / n;
    };
    expect(ort('isinsani')).toBeGreaterThan(ort('universiteli'));
  });
  it('sabrı biten kuyruk müşterisi tezgâha vurup kızgın ayrılır (kizginAyril olayı, mood angry)', () => {
    const { sim, cu, tip, r } = sahne(9);
    const c = cu.spawnCustomer({ type: tip('isinsani'), n: 1, order: { doner: 1 }, from: { x: r.layout.queue[0].x, z: r.layout.queue[0].z + 1 } });
    for (let i = 0; i < 400 && c.state !== 'leave'; i++) sim.step(0.1);
    expect(c.state).toBe('leave'); expect(c.mood).toBe('angry');
    const e = evN(sim, 'kizginAyril'); expect(e.length).toBe(1); expect(e[0].data.masa).toBe(false);
  });
  it('sabır çubuğu verisi: kuyruktaki müşteri frac (0..1) ve türüyle state view\'da görünür', () => {
    const { sim, cu, tip, r } = sahne(10);
    const c = cu.spawnCustomer({ type: tip('balayi'), n: 2, order: { doner: 1 }, from: { x: r.layout.queue[0].x, z: r.layout.queue[0].z + 0.5 } });
    for (let i = 0; i < 40; i++) sim.step(0.1);
    const v = sim.rules.v2State().sabir;
    expect(v.kuyruk.length).toBe(1);
    expect(v.kuyruk[0]).toMatchObject({ id: c.id, tip: 'cift' });
    expect(v.kuyruk[0].frac).toBeGreaterThan(0); expect(v.kuyruk[0].frac).toBeLessThanOrEqual(1);
    expect(v.kasa.acik).toBe(0);
  });
  it('masa müşterisi sabrı bitince (siparişi kimse almadı) kızgın ayrılır ve masaya vurur', () => {
    const { sim, cu, tip, r } = sahne(12);
    const c = cu.spawnCustomer({ type: tip('universiteli'), n: 1, kind: 'masa' });
    expect(c.kind).toBe('masa');
    for (let i = 0; i < 4000 && c.state !== 'leave'; i++) { sim.step(0.1); if (r.paused) { r.paused = false; r.pauseWhy = ''; } }
    expect(c.state).toBe('leave');
    const e = evN(sim, 'kizginAyril'); expect(e.length).toBeGreaterThan(0); expect(e.some((x: any) => x.data.masa === true)).toBe(true);
  });
  it('gizli eleştirmen (Gurme) gelişi toast\'sız: yalnız olay, kuyrukta ayırt edici duyuru yok', () => {
    const sb = makeSandbox(3, (st) => { st.day = 6; });
    sb.host.hour_ = 14; sb.h.force('vip'); sb.step(15);
    expect(sb.events).toContain('vipArrive');
    expect(sb.toasts.length).toBe(0);
    expect(sb.h.vip.current()).not.toBeNull();
  });
});

describe('BUF-24 büyük gruplar, hafta sonu ve maç günü', () => {
  it('grup boyu 1-6, gövde sayısı grup kadar (ortam havuzu elverdiği ölçüde); 6 kişilik grup oluşur', () => {
    const { cu, tip, r } = sahne(14);
    const c = cu.spawnCustomer({ type: tip('universiteli'), n: 6, order: { cay: 3 } });
    expect(c.n).toBe(6);
    expect(c.members.length).toBeLessThanOrEqual(5);
    if (r.agents) expect(c.members.length).toBeGreaterThan(2);   // eskiden en çok 2 üye (3 gövde)
    expect(cu.spawnCustomer({ type: tip('universiteli'), n: 9, order: { cay: 1 } }).n).toBe(6);   // üst sınır
    expect(cu.spawnCustomer({ type: tip('universiteli'), n: 1, order: { cay: 1 } }).n).toBe(1);
  });
  it('6 kişilik masa grubu 3 yakın masayı birleştirir; kalkınca hepsi serbest kalır', () => {
    const { sim, cu, tip, r } = sahne(15);
    const c = cu.spawnCustomer({ type: tip('bebekarabali'), n: 6, kind: 'masa' });
    expect(c.kind).toBe('masa');
    expect(c.seat).not.toBeNull();
    expect(c.ekMasa!.length).toBe(2);
    const hepsi = [c.seat.table, ...c.ekMasa];
    expect(new Set(hepsi).size).toBe(3);
    for (const ti of hepsi) expect(r.tables[ti].seats.every((x: { occ: number }) => x.occ === c.id)).toBe(true);
    // masalar birbirine yakın
    const L = r.layout.tables; for (const ti of c.ekMasa) expect(Math.hypot(L[ti].x - L[c.seat.table].x, L[ti].z - L[c.seat.table].z)).toBeLessThanOrEqual(GRUP.birlesM);
    cu.leave(c, false);
    for (const ti of hepsi) expect(r.tables[ti].seats.every((x: { occ: number }) => x.occ === 0)).toBe(true);
    void sim;
  });
  it('masa bulunamazsa grup küçülür: yalnız bir masa boşsa 6 kişilik grup 2 kişi olur (kimse ayakta kalmaz, bilet sınırı aşılmaz)', () => {
    const { cu, tip, r } = sahne(16);
    r.tables.forEach((t: any, i: number) => { if (t.built && i > 0) t.seats.forEach((x: any) => { x.occ = 999; }); });
    const c = cu.spawnCustomer({ type: tip('bebekarabali'), n: 6, kind: 'masa' });
    expect(c.kind).toBe('masa'); expect(c.n).toBe(2); expect(c.ekMasa.length).toBe(0);
  });
  it('büyük grup sabır payı alır, ama aynı anda en çok GRUP.esZamanli büyük grup gelir (bunaltmaz)', () => {
    const { cu, tip } = sahne(17);
    const k = cu.spawnCustomer({ type: tip('universiteli'), n: 1, order: { cay: 1 } }), b = cu.spawnCustomer({ type: tip('universiteli'), n: 6, order: { cay: 1 } });
    expect(b.patMax).toBeGreaterThan(k.patMax * 1.1);
    expect(b.patMax).toBeLessThanOrEqual(k.patMax * (1 + GRUP.sabirUst) + 1e-6);
  });
  it('spawner büyük grubu en fazla GRUP.esZamanli kadar aynı anda bırakır', () => {
    const { cu, tip, S, r } = sahne(18);
    S.playT = 1000;
    for (let i = 0; i < 300; i++) {
      r.queue.length = 0;
      cu.spawnCustomer({ type: tip('bebekarabali') });
      expect(r.customers.filter((c: any) => c.n >= 5 && c.state !== 'leave').length).toBeLessThanOrEqual(GRUP.esZamanli);
    }
  });
  it('hafta sonu varış hızı hafta içinden yüksek (x1.2), hafta içi değişmez', () => {
    const { sim, cu, S } = sahne(19);
    S.playT = 900; sim.command({ kind: 'setTime', hour: 15, freeze: true }); sim.step(0.1);
    const hv = (iso: string) => { (S.zones.hava ||= {}).anchorDate = iso; S.zones.hava.anchorDay = S.day; return cu.arrivalPerMin(); };
    const hici = hv('2026-11-24');   // Salı
    const cmt = hv('2026-11-21'), paz = hv('2026-11-22');
    expect(cmt).toBeGreaterThan(hici); expect(paz).toBeGreaterThan(hici);
    expect(cmt / hici).toBeCloseTo(HAFTA_SONU.arrival, 2);
    expect(hv('2026-11-20')).toBeCloseTo(hici, 5);   // Cuma hafta içi
  });
  it('maç günü iki dalga: öncesi ve sonrası tepe, aralarında hafif taban; günlük yük eski x1.35 civarında, hafta sonu x maç üst sınırı aşılmaz', () => {
    expect(macDalgaX(15)).toBe(MAC_DALGA.carpan); expect(macDalgaX(20)).toBe(MAC_DALGA.carpan);
    expect(macDalgaX(12)).toBe(MAC_DALGA.taban); expect(macDalgaX(18)).toBe(MAC_DALGA.taban);
    expect(macDalgaX(9)).toBe(1); expect(macDalgaX(24.5)).toBe(1);
    expect(macDalgaAdi(15)).toBe('once'); expect(macDalgaAdi(20)).toBe('sonra'); expect(macDalgaAdi(18)).toBeNull();
    let top = 0; for (let h = 11; h < 24; h += 0.25) top += macDalgaX(h) * 0.25;
    expect(top / 13).toBeGreaterThan(1.25); expect(top / 13).toBeLessThan(1.5);
    expect(HAFTA_SONU.arrival * MAC_DALGA.carpan).toBeGreaterThan(KALABALIK_UST);   // üst sınır devrede
    const { sim, cu, S } = sahne(20);
    S.playT = 900;
    const r = sim.rules.rt;
    S.day = 10;   // maç günü (3, 10, 17...): aynı gün, aynı hava; yalnız macGunu bayrağı açılıp kapanır
    const at = (hour: number, mac: boolean) => { sim.command({ kind: 'setTime', hour, freeze: true }); sim.step(0.1); (S.zones.hava ||= {}).anchorDate = '2026-11-24'; S.zones.hava.anchorDay = 10; const g = r.macGunu; if (!mac) r.macGunu = null; else if (!g) r.macGunu = { team: 'x' }; const v = cu.arrivalPerMin(); r.macGunu = g; return v; };
    const normal = at(15, false), mac = at(15, true), macAra = at(18, true), normalAra = at(18, false);
    expect(mac / normal).toBeCloseTo(MAC_DALGA.carpan, 2);
    expect(macAra / normalAra).toBeCloseTo(MAC_DALGA.taban, 2);
    // hafta sonu + maç birlikte: üst sınır
    sim.command({ kind: 'setTime', hour: 15, freeze: true }); sim.step(0.1);
    S.zones.hava.anchorDate = '2026-11-21'; S.zones.hava.anchorDay = 10;   // Cumartesi
    const hs = cu.arrivalPerMin(); r.macGunu = null; const hsYalniz = cu.arrivalPerMin();
    expect(hs / hsYalniz).toBeLessThanOrEqual(KALABALIK_UST + 0.01);
  });
});

