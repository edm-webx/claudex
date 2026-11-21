// BUF-12 Kasiyer gerçek kasada: kasiyer kasa başında durur (L.kasa), tezgâhtan ürünü alan müşteri kasa sırasına girer, işlem süresi
// kasiyer rütbesiyle kısalır, kasa kuyruğunda sabır biter (sinirli ayrılır), kasiyer yoksa eski gibi anında ödeme. Nakit/kart yalnız görsel.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { CITIZENS } from '../../src/content/citizens';
import { KASA, kasaSure } from '../../src/content/musteri';

const evs = (sim: any, name: string) => sim.events(0).filter((e: { name: string }) => e.name === name);
function kur(seed = 7) {
  const sim: any = played(seed);
  for (let i = 0; i < 60; i++) sim.step(0.1);
  sim.command({ kind: 'force', what: 'money', value: 2_000_000 });
  for (const k of ['cay', 'ayran', 'simit', 'tabure1', 'tabure2', 'masa1', 'gazoz', 'masa2', 'tost']) sim.command({ kind: 'force', what: 'unlock', value: k });
  sim.command({ kind: 'force', what: 'stage', value: 3 });
  sim.command({ kind: 'teleport', x: 6.5, z: -1.5 });
  const r = sim.rules.rt, S = sim.state, cu = r.customersApi;
  cu.updateSpawner = () => {};   // rastgele akış kapalı: müşterileri test koyar
  for (const c of r.customers.slice()) cu.removeCustomer(c);
  for (const p of Object.keys(r.counter)) r.counter[p] = [];
  const k = {
    sim, r, S, cu,
    stok: () => { while (r.counter.cay.length < 8) r.counter.cay.push({ type: 'cay', tier: 1 }); },
    kasiyer(id = 801, xp = 0) { const w = { id, name: 'Kasiyer' + id, role: 'kasiyer', xp, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat', rarity: 'gri' }; S.workers.push(w); return w; },
    row: (id: number) => r.agents.workers.rows().find((w: { id: number }) => w.id === id),
    step(sec: number, her?: () => boolean | void) { for (let i = 0; i < Math.round(sec / 0.1); i++) { k.stok(); sim.step(0.1); if (r.paused) { r.paused = false; r.pauseWhy = ''; } if (her && her()) return; } },
    musteri(typeId = 'emekli', n = 1, pat = 0) {
      const c = cu.spawnCustomer({ type: CITIZENS.find(t => t.id === typeId), n, order: { cay: 1 }, from: { x: r.layout.queue[0].x, z: r.layout.queue[0].z + 2 } });
      c.sit = false;
      if (pat) { c.patience = c.patMax = pat; }
      return c;
    },
    hazir() { k.step(20, () => k.row(801)?.state === 'front'); },
  };
  return k;
}

describe('BUF-12 kasiyer gerçek kasada', () => {
  it('kasiyer yokken bugünkü gibi: ürünü alan anında öder, kasa sırası hiç dolmaz', () => {
    const k = kur();
    const c = k.musteri();
    let kasada = false; const t0 = k.sim.tick;
    k.step(40, () => { if (k.r.kasaQueue.length) kasada = true; return c.state === 'leave'; });
    expect(kasada).toBe(false);
    expect(evs(k.sim, 'sale').length).toBeGreaterThan(0);
    expect(evs(k.sim, 'kasaOde').length).toBe(0);
    void t0;
  });

  it('kasiyer işe girince kasa başına (L.kasa) yürür ve orada durur', () => {
    const k = kur();
    k.kasiyer(801);
    k.step(40, () => k.row(801)?.state === 'front');
    k.step(8);
    const r = k.row(801), kp = k.r.layout.kasa.pile;
    expect(r.state).toBe('front');
    expect(Math.hypot(r.x - kp.x, r.z - kp.z)).toBeLessThan(1.6);
    // mutfağa gitmedi: kasa başı iskele tarafında, mutfak odasının içinde değil
    expect(k.r.agents.workers.rows().filter((w: any) => w.role === 'kasiyer').length).toBe(1);
  });

  it('tezgâhtan ürünü alan müşteri kasa sırasına girer, kasada öder (nakit ya da kart), sonra gider', () => {
    const k = kur();
    k.kasiyer(801); k.hazir(); k.step(6);
    const c = k.musteri();
    let kasada = false, saleOnce = 0, kasaT = 0;
    k.step(60, () => {
      if (k.r.kasaQueue.includes(c)) { kasada = true; if (!saleOnce) kasaT = k.sim.tick; }
      if (!saleOnce && evs(k.sim, 'sale').length) saleOnce = k.sim.tick;
      return c.state === 'leave';
    });
    expect(kasada).toBe(true);
    const o = evs(k.sim, 'kasaOde'); expect(o.length).toBe(1);
    expect(['nakit', 'kart']).toContain(o[0].data.yontem);
    expect(evs(k.sim, 'sale').length).toBe(1);
    expect(saleOnce).toBeGreaterThanOrEqual(kasaT);   // satış kasaya girdikten sonra yazıldı (anında değil)
    expect(k.r.kasaQueue.length).toBe(0);
    expect(c.value).toBeGreaterThan(0);
  });

  it('ödeme süresi kasiyer seviyesiyle kısalır (gerçek hız etkisi)', () => {
    expect(kasaSure(2, 2.2)).toBeLessThan(kasaSure(2, 1) * 0.6);
    const olc = (xp: number) => {
      const k = kur(11);
      k.kasiyer(801, xp); k.hazir(); k.step(6);
      const c = k.musteri('universiteli');
      c.patience = c.patMax = 400;
      let en = 0;
      k.step(60, () => { en = Math.max(en, c.kasaT || 0); return evs(k.sim, 'kasaOde').length === 1; });
      expect(evs(k.sim, 'kasaOde').length).toBe(1);
      return en;   // kasa başında geçen işlem süresi (sn)
    };
    const yeni = olc(0), usta = olc(25000);   // rütbe 0 (x1.0) ve Efsane (x2.2)
    expect(usta).toBeLessThan(yeni);
  });

  it('kasa kuyruğu uzayıp sabır biterse müşteri sinirli ayrılır, ürünler tezgâha döner', () => {
    const k = kur(13);
    k.kasiyer(801); k.hazir(); k.step(6);
    const cs = Array.from({ length: 6 }, () => k.musteri('emekli', 1, 3));   // sabırsız: kasa sırasında tükenir
    let maxK = 0;
    k.step(90, () => { maxK = Math.max(maxK, k.r.kasaQueue.length); return cs.every(c => c.state === 'leave' || !k.r.customers.includes(c)); });
    expect(maxK).toBeGreaterThanOrEqual(3);
    const kizgin = evs(k.sim, 'kizginAyril'); expect(kizgin.length).toBeGreaterThan(0);
    expect(k.S.today.angry).toBeGreaterThan(0);
    expect(cs.some(c => c.mood === 'angry')).toBe(true);
    expect(k.r.kasaQueue.length).toBe(0);
  });

  it('kasiyer işten çıkarılırsa kasadakiler anında öder (kimse takılmaz)', () => {
    const k = kur(17);
    const w = k.kasiyer(801); k.hazir(); k.step(6);
    const cs = [k.musteri(), k.musteri(), k.musteri()];
    cs.forEach(c => { c.patience = c.patMax = 400; });
    k.step(60, () => k.r.kasaQueue.length >= 2);
    expect(k.r.kasaQueue.length).toBeGreaterThanOrEqual(2);
    k.S.workers.splice(k.S.workers.indexOf(w), 1);
    k.step(5);
    expect(k.r.kasaQueue.length).toBe(0);
    k.step(30, () => cs.every(c => c.state === 'leave' || !k.r.customers.includes(c)));
    expect(evs(k.sim, 'sale').length).toBe(3);
  });

  it('kasa kuyruğu doluysa (6) yeni gelen yan kasadan hemen öder: tezgâh kuyruğu tıkanmaz', () => {
    const k = kur(19);
    k.kasiyer(801); k.hazir(); k.step(6);
    const cs = Array.from({ length: 8 }, () => k.musteri('emekli', 1, 400));
    let maxK = 0;
    k.step(60, () => { maxK = Math.max(maxK, k.r.kasaQueue.length); });
    expect(maxK).toBeLessThanOrEqual(KASA.maxKuyruk);
    void cs;
  });

  it('kasiyer her işlemde rütbe xp kazanır', () => {
    const k = kur(23);
    const w = k.kasiyer(801); k.hazir(); k.step(6);
    k.musteri(); k.step(40, () => evs(k.sim, 'kasaOde').length > 0);
    expect(w.xp).toBeGreaterThan(0);
  });
});
