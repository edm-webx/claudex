// BUF-14: salon rolleri gerçek iş yapar (güvenlik kuyruk düzeni, müzisyen canlı müzik, hostes karşılama, vale anahtar, müdür vekil).
// Hepsi gerçek yürüyen çalışan; deterministik: sabit tohum, rastgele müşteri akışı kapalı (kur() yardımcısı), müşteriler elle konur.
import { describe, it, expect } from 'vitest';
import { kur, evs, type Kurulum } from './garson-yardimci';
import { CITIZENS } from '../../src/content/citizens';

let wid = 7000;
function rol(k: Kurulum, role: string, xp = 0) {
  const w = { id: wid++, name: role + wid, role, xp, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat' };
  k.S.workers.push(w);
  return w;
}
const satir = (k: Kurulum, id: number) => k.r.agents.workers.rows().find((w: { id: number }) => w.id === id) as { id: number; state: string; x: number; z: number };
const aktor = (k: Kurulum, id: number) => k.r.agents.registry.list.find((a: { key: string; kind: string }) => a.kind === 'worker' && a.key === String(id));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const auraMax = (k: Kurulum, x: number, z: number) => k.r.auras.reduce((m: number, f: (x: number, z: number) => number) => Math.max(m, f(x, z)), 0);
/** sıra müşterisi (kind 'q'): kuyrukta bekler, sabrı akar */
function siraMusterisi(k: Kurulum, n = 1) {
  const q = k.r.layout.queue[0], id = 9500 + Math.floor(Math.random() * 0) + k.r.customers.length + wid++;
  const c = {
    id, typeId: 'emekli', typeIdx: CITIZENS.findIndex(t => t.id === 'emekli'), kind: 'q', n, order: { doner: 1 }, got: {}, set: null, value: 0, state: 'queue',
    t: 0, takeT: -100, eatT: 0, patience: 100, patMax: 100, sit: false, mood: 'ok', x: q.x, z: q.z, rot: 0, speed: 0, path: [], agent: -1, members: [], items: [],
    seat: null, say: '', sayT: 0, calm: false, follower: false, tag: null, qi: 0,
  };
  k.r.customers.push(c); k.r.queue.push(c); k.test.add(id);
  return c;
}

describe('BUF-14 salon rolleri', () => {
  it('güvenlik: kapıda ronda atar, yalnız kalabalıkta (maç günü / büyük grup) sabrı yavaşlatır', () => {
    const k = kur(); const g = rol(k, 'guvenlik'); k.step(8);
    const q0 = k.r.layout.queue[0];
    // kalabalık yok: etki yok
    expect(auraMax(k, q0.x, q0.z)).toBe(0);
    // ronda: kuyruk başına gidip yönlendirir (görünür duruş)
    k.step(40);
    expect(k.S.stats.guvenlikRonda).toBeGreaterThanOrEqual(1);
    // maç günü: sabır yavaşlar
    k.S.day = 3; k.step(1);   // maç günü (halisaha.ts isMacGunu: 3, 10, 17...)
    expect(k.r.macGunu).toBeTruthy();
    const a = aktor(k, g.id);
    const near = auraMax(k, a.x, a.z);
    expect(near).toBeGreaterThan(0.15); expect(near).toBeLessThanOrEqual(0.35);
    expect(auraMax(k, a.x + 40, a.z)).toBe(0);   // uzaktaki sıra etkilenmez
    k.S.day = 4; k.step(1); expect(k.r.macGunu).toBeFalsy();
    // büyük grup (4+) kalabalık sayılır
    const c = siraMusterisi(k, 4); k.step(1);
    expect(auraMax(k, a.x, a.z)).toBeGreaterThan(0.15);
    c.state = 'leave';
  });

  it('güvenlik gerçekten sabır kaybını azaltır (aynı sıra, güvenlikli ve güvenliksiz)', () => {
    const drain = (guard: boolean) => {
      const k = kur(); if (guard) rol(k, 'guvenlik'); k.step(8);
      k.S.day = 3;
      const c = siraMusterisi(k); c.patience = 100;
      const a = guard ? aktor(k, k.S.workers[k.S.workers.length - 1].id) : null;
      if (a) { c.x = a.x + 2; c.z = a.z; }
      k.r.queue.length = 0;   // sıra başı satın alma akışı karışmasın: yalnız sabır akışı ölçülür
      c.state = 'queue'; c.takeT = -1000;
      for (let i = 0; i < 100; i++) { c.x = a ? a.x + 2 : c.x; c.z = a ? a.z : c.z; k.sim.step(0.1); }
      return 100 - c.patience;
    };
    const yok = drain(false), var_ = drain(true);
    expect(yok).toBeGreaterThan(0);
    expect(var_).toBeLessThan(yok * 0.9);
  });

  it('müzisyen çalar: canlı müzik olayı, yakın masada yemek uzar, sabır az düşer, uzak masa etkilenmez', () => {
    const k = kur(); const m = rol(k, 'muzisyen'); k.step(30);
    const a = aktor(k, m.id);
    expect(a.act).toBe('dance'); expect(a.fx).toBe('saz');
    expect(evs(k.sim, 'canliMuzik').length).toBeGreaterThanOrEqual(1);
    expect(auraMax(k, a.x + 2, a.z)).toBeGreaterThan(0.08);
    expect(auraMax(k, a.x + 30, a.z)).toBe(0);
    // yeme süresi: yakın masa müşterisinin c.t daha yavaş ilerler
    const kurulu = k.kurulu();
    const olc = (yakin: boolean) => {
      const kk = kur(); const mm = rol(kk, 'muzisyen'); kk.step(24);
      const am = aktor(kk, mm.id);
      const c = kk.musteri(kk.kurulu()[0], { cay: 1 });
      c.state = 'eat'; c.t = 1; c.eatT = 500; c.x = am.x + (yakin ? 2 : 40); c.z = am.z; c.seat = null;
      kk.r.customers.splice(kk.r.customers.indexOf(c), 1); kk.r.customers.push(c);
      for (let i = 0; i < 100; i++) { c.state = 'eat'; c.x = am.x + (yakin ? 2 : 40); c.z = am.z; kk.sim.step(0.1); if (kk.r.paused) { kk.r.paused = false; kk.r.pauseWhy = ''; } }
      return c.t;
    };
    void kurulu;
    const yakin = olc(true), uzak = olc(false);
    expect(uzak).toBeGreaterThan(yakin + 1);   // 10 sn'de yaklaşık 2 sn fark
  });

  it('hostes: kapıda karşılar; kalabalık günde masaya yürüyen müşteriyi masasına götürür (yalnız kalabalıkta)', () => {
    const k = kur(); const h = rol(k, 'hostes'); k.step(10);
    const a = aktor(k, h.id);
    const T = k.kurulu()[0], tb = k.r.layout.tables[T];
    const c = k.musteri(T, { cay: 1 });
    c.state = 'toSeat'; c.x = a.x + 3; c.z = a.z; c.t = 0; c.path = [{ x: tb.x, z: tb.z }]; (c as any).kind = 'masa';
    // sakin gün: götürmez
    k.step(3, () => { c.state = 'toSeat'; return false; });
    expect(k.S.stats.hostesMasaGosterdi || 0).toBe(0);
    // maç günü: götürür, müşteri sabrı bir kez yenilenir
    k.S.day = 3;
    c.patience = 50;
    let gitti = 0;
    k.step(30, () => { c.state = 'toSeat'; gitti = Math.max(gitti, 1 - dist(a, tb) / Math.max(1, dist({ x: a.x, z: a.z }, tb))); return !!k.S.stats.hostesMasaGosterdi; });
    expect(k.S.stats.hostesMasaGosterdi).toBe(1);
    expect(dist(aktor(k, h.id), { x: tb.x + 0.9, z: tb.z + 0.9 })).toBeLessThan(2.5);
    expect(c.patience).toBeGreaterThan(55);
  });

  it('vale: aşama 8\'de arabalı müşterinin anahtarını alır, arabayı park alanına sürer, yürüyerek döner; aşama 8 öncesi çalışmaz', () => {
    const k = kur(); k.sim.command({ kind: 'force', what: 'stage', value: 8 });
    const v = rol(k, 'vale'); k.step(8);
    const a = aktor(k, v.id), post = { x: a.x, z: a.z };
    // arabalı müşteri: kimlik hash'i 0 olana kadar sırayla müşteri dene (deterministik)
    let c: any = null;
    for (let i = 0; i < 12 && !c; i++) {
      const cand = siraMusterisi(k); cand.state = 'walk'; cand.kind = 'q';
      const ok = (Math.imul(cand.id, 2654435761) >>> 0) % 3 === 0;
      if (ok) c = cand; else cand.state = 'leave';
    }
    expect(c).toBeTruthy();
    k.r.queue.length = 0;
    const fx = new Set<string>(); let yol = 0, maxCar = 0;
    const patMax0 = c.patMax, cn = k.r.layout.counter.pos;
    c.x = post.x - 14; c.z = post.z - 3; c.state = 'walk'; c.takeT = -1000;
    c.path = [{ x: cn.x - 10, z: cn.z + 4 }, { x: cn.x - 6, z: cn.z + 4 }];   // müşteri büfeye doğru yürür
    k.step(40, () => {
      fx.add(a.fx); const cars = k.r.agents.workers.valeCars(); maxCar = Math.max(maxCar, cars.length);
      yol = Math.max(yol, dist(a, post));
      return false;
    });
    expect(k.S.stats.valeAnahtar).toBe(1); expect(k.S.stats.valePark).toBe(1);
    expect(fx.has('araba')).toBe(true); expect(maxCar).toBe(1);
    expect(c.patMax).toBeCloseTo(patMax0 * 1.15, 5);
    expect(dist(a, post)).toBeLessThan(1.2);            // postuna döndü
    expect(k.r.agents.workers.valeCars()[0].surus).toBe(false);   // park etti, araba durur
    expect(a.fx).toBe('');
  });

  it('vale aşama 8 öncesi anahtar almaz', () => {
    const k = kur(); const v = rol(k, 'vale'); k.step(8);
    const a = aktor(k, v.id);
    for (let i = 0; i < 12; i++) { const c = siraMusterisi(k); c.state = 'walk'; c.x = a.x - 8; c.z = a.z; }
    k.r.queue.length = 0;
    k.step(20, () => { for (const c of k.r.customers) if (k.test.has(c.id)) c.state = 'walk'; return false; });
    expect(k.S.stats.valeAnahtar || 0).toBe(0);
  });

  it('müdür: oyuncu büfeden uzaktayken (Belgrad) boş istasyonu düşük hızla işletir; yakınken işletmez; dönerci tam hız', () => {
    /** 60 sn'de üretilen adet (her üretim işçiye 1 xp yazar); tepsi boşaltılır ki dolu tepsi üretimi durdurmasın */
    const kos = (rolu: 'mudur' | 'doner', uzak: boolean) => {
      const k = kur(); const w = rol(k, rolu); k.step(10);
      if (uzak) k.sim.command({ kind: 'teleport', x: 800, z: 9 });
      const x0 = w.xp;
      k.step(60, () => { k.r.stations.doner.out = []; k.r.counter.doner = []; return false; });
      return { n: w.xp - x0, vekil: k.r.agents.workers.vekil(), is: k.S.stats.mudurIs || 0 };
    };
    const yakin = kos('mudur', false), uzak = kos('mudur', true), tam = kos('doner', false);
    expect(yakin.n).toBe(0); expect(yakin.vekil).toBe(false);
    expect(uzak.vekil).toBe(true); expect(uzak.n).toBeGreaterThanOrEqual(5); expect(uzak.is).toBe(uzak.n);
    expect(tam.n).toBeGreaterThan(uzak.n * 1.8);   // vekil düşük hızla çalışır (tam hızın yarısından az)
  });

  it('müdür: istasyon işi yoksa kasayı toplar (vekil), oyuncu dönünce postuna döner', () => {
    const k = kur(); const m = rol(k, 'mudur'); k.step(8);
    // doner istasyonunu tepsi dolu yap: iş çıkmasın
    k.r.stations.doner.out = Array.from({ length: 8 }, () => ({ type: 'doner', tier: 1 }));
    for (const p of ['cay', 'tost']) k.r.stations[p].built = false;
    k.sim.command({ kind: 'teleport', x: 800, z: 9 });
    k.r.kasa.push({ value: 300 }, { value: 200 });
    const m0 = k.S.money;
    k.step(30);
    expect(k.r.kasa.length).toBe(0); expect(k.S.money - m0).toBeGreaterThanOrEqual(500); expect(k.S.stats.mudurKasa).toBe(2);
    k.sim.command({ kind: 'teleport', x: 4.5, z: -2.5 });
    k.step(20);
    expect(k.r.agents.workers.vekil()).toBe(false);
    void m;
  });

  it('oyun kapalıyken gelir yok: uzun süre dışarıda kalınca müdür ya da başka rol gelir üretmez (offline kapalı)', () => {
    const k = kur(); rol(k, 'mudur'); k.step(8);
    k.sim.command({ kind: 'teleport', x: 800, z: 9 }); k.r.kasa.push({ value: 400 });
    const m0 = k.S.money;
    k.sim.rules.welcomeBack(3600 * 8);
    expect(k.S.money).toBe(m0); expect(k.r.kasa.length).toBe(1);
  });
});
