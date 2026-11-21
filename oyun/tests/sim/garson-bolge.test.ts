// BUF-10: garson bölgeleri (masa kümeleri, garson başına bölge, boştaki garson komşu bölgeye 3 sn sonra yardım, sahipsiz bölge
// hemen devralınır) ve ortak bahşiş kumbarası (oyuncuya bahşiş geliri yok, gün sonunda garsonlara paylaşılır, rapora satır).
import { describe, it, expect } from 'vitest';
import { kur, evs, type Kurulum } from './garson-yardimci';
import { bolgeleriKur, bolgeAtamasi } from '../../src/game/sim/garson-bolge';
import { ADISYON } from '../../src/content/restoran';

const at = (k: Kurulum, t: number) => ({ x: k.r.layout.tables[t].x, z: k.r.layout.tables[t].z });
/** menü görevi bekleyen masa müşterisi (görev update'te doğar) */
function menuBekleyen(k: Kurulum, t: number) { const c = k.musteri(t, { cay: 1 }); c.t = 1; return c; }

describe('bölge kümeleri (saf)', () => {
  const T = [{ x: 0, z: 0 }, { x: 2, z: 0 }, { x: 20, z: 0 }, { x: 22, z: 0 }, { x: 22, z: 2.5 }, { x: 40, z: 0 }];
  it('yakın masalar bir küme; garson sayısına göre bölünür / birleşir; kimlikler deterministik', () => {
    expect(bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 1).map(b => b.masalar)).toEqual([[0, 1, 2, 3, 4, 5]]);
    expect(bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 3).map(b => b.masalar)).toEqual([[0, 1], [2, 3, 4], [5]]);
    expect(bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 2).map(b => b.masalar)).toEqual([[0, 1, 2, 3, 4], [5]]);
    expect(bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 4).map(b => b.masalar)).toEqual([[0, 1], [2, 3], [4], [5]]);   // en kalabalık küme uzun ekseninden bölünür
    const b3 = bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 3);
    expect(b3.map(b => b.id)).toEqual(['b1', 'b2', 'b3']);
    expect(b3[0].komsu).toEqual(['b2']); expect(b3[2].komsu).toEqual(['b2']);   // uzak bölgenin de en az bir komşusu var
    expect(bolgeleriKur(T, [], 2)).toEqual([]);
  });
  it('atama: tek garsonla bölge yok; elle atama önce, kalan boş bölgelere; geçersiz kimlik otomatik', () => {
    const b = bolgeleriKur(T, [0, 1, 2, 3, 4, 5], 2);
    expect([...bolgeAtamasi([7], b, new Map())]).toEqual([[7, null]]);
    expect([...bolgeAtamasi([7, 3], b, new Map())]).toEqual([[3, 'b1'], [7, 'b2']]);
    expect([...bolgeAtamasi([7, 3], b, new Map([[7, 'b1']]))]).toEqual([[7, 'b1'], [3, 'b2']]);
    expect([...bolgeAtamasi([7, 3], b, new Map([[3, '*'], [7, 'yok-bolge']]))]).toEqual([[3, null], [7, 'b1']]);
  });
});

describe('bölge kuralı (restoran görev kuyruğu)', () => {
  function iki() {
    const k = kur(); k.garson(701); k.garson(702);
    const bs = k.api.bolgeler!(); expect(bs.length).toBe(2);
    const [A, B] = bs; expect(A.garsonlar).toEqual([701]); expect(B.garsonlar).toEqual([702]);
    const kurulu = k.kurulu();
    const ta = A.masalar.find(t => kurulu.includes(t))!, tb = B.masalar.find(t => kurulu.includes(t))!;
    return { k, A, B, ta, tb, ta2: A.masalar.find(t => t !== ta && kurulu.includes(t))! };
  }
  it('iki garson iki bölge: her biri önce kendi masasına (öteki iş daha eski olsa bile)', () => {
    const { k, ta, tb } = iki();
    menuBekleyen(k, tb); k.api.update(0.1); k.api.update(2);   // B bölgesinin işi daha eski
    menuBekleyen(k, ta); k.api.update(0.1);
    expect(k.api.isAl!(701, { cap: 2 })!.table).toBe(ta);
    expect(k.api.isAl!(702, { cap: 2 })!.table).toBe(tb);
  });
  it('boştaki garson komşu bölgenin işini ancak yardimBekleS sahipsiz kalınca alır', () => {
    const { k, ta, ta2 } = iki();
    menuBekleyen(k, ta); k.api.update(0.1);
    expect(k.api.isAl!(701, { cap: 2 })!.table).toBe(ta);   // A meşgul
    menuBekleyen(k, ta2); k.api.update(0.1);
    expect(k.api.isAl!(702, { cap: 2 })).toBeNull();          // 702 boşta ama iş yeni
    k.api.update(ADISYON.yardimBekleS + 0.1);
    expect(k.api.isAl!(702, { cap: 2 })!.table).toBe(ta2);    // yardım
  });
  it('bir garson çıkarılınca bölgesi sahipsiz kalır, diğeri hemen devralır; serbest (*) garson her yere bakar', () => {
    const { k, ta } = iki();
    menuBekleyen(k, ta); k.api.update(0.1);
    k.S.workers.splice(k.S.workers.findIndex((w: { id: number }) => w.id === 701), 1);
    expect(k.api.isAl!(702, { cap: 2 })!.table).toBe(ta);
    expect(k.api.bolgeOf!(702)).toBeNull();                    // tek garson: bölge yok
    const k2 = iki();
    expect(k2.k.api.bolgeAta!(702, '*')).toBe(true); expect(k2.k.api.bolgeAta!(702, 'yok-bolge')).toBe(false); expect(k2.k.api.bolgeAta!(999, '*')).toBe(false);
    menuBekleyen(k2.k, k2.ta); k2.k.api.update(0.1);
    expect(k2.k.api.isAl!(702, { cap: 2 })!.table).toBe(k2.ta);
    k2.k.sim.command({ kind: 'restoran', op: 'bolge', wid: 701, id: k2.B.id });
    expect(k2.k.api.bolgeOf!(701)).toBe(k2.B.id);
    k2.k.sim.command({ kind: 'restoran', op: 'bolge', wid: 701, id: null }); k2.k.sim.command({ kind: 'restoran', op: 'bolge', wid: 702, id: null });
    expect(k2.k.api.bolgeOf!(701)).toBe(k2.A.id);
  });
  it('gerçek akış: iki garson kendi bölgelerinin masalarına servis eder, ışınlanma yok', () => {
    const { k, A, B, ta, tb } = iki();
    const sahip: Record<number, number[]> = { 701: [], 702: [] };
    k.sim.rules.bus.on('serve', (e: { table: number }) => {
      const tbp = k.r.layout.tables[e.table];
      const ws = k.r.agents.workers.rows().filter((w: { role: string }) => w.role === 'garson');
      const w = ws.reduce((m: any, x: any) => (Math.hypot(x.x - tbp.x, x.z - tbp.z) < Math.hypot(m.x - tbp.x, m.z - tbp.z) ? x : m));
      sahip[w.id].push(e.table);
    });
    k.step(3);
    let n = 0;
    k.step(300, (i) => {
      for (const t of [ta, tb]) { const x = k.r.tables[t]; if (x.dirty <= 0 && x.seats.every((s: { occ: number }) => !s.occ)) k.musteri(t, { cay: 1 + (n++ % 2) }); }
      if (i % 30 === 0) while (k.r.counter.cay.length < 3) k.r.counter.cay.push({ type: 'cay', tier: 1 });
    });
    const kendi = (w: number, b: { masalar: number[] }) => sahip[w].filter(t => b.masalar.includes(t)).length / Math.max(1, sahip[w].length);
    expect(sahip[701].length).toBeGreaterThan(3); expect(sahip[702].length).toBeGreaterThan(3);
    expect(kendi(701, A)).toBeGreaterThanOrEqual(0.75); expect(kendi(702, B)).toBeGreaterThanOrEqual(0.75);
    expect(k.S.stats.isinlanma || 0).toBe(0);
  }, 60000);
});

describe('ortak bahşiş kumbarası', () => {
  it('bahşiş oyuncuya gelir değil, kumbarada birikir; gün sonunda garsonlara paylaşılır, toplam korunur, rapora satır', () => {
    const k = kur(); k.garson(701); k.garson(702); k.step(3);
    k.r.gunSonuCard = true;
    const ts = k.kurulu();
    const sales: number[] = [];
    k.sim.rules.bus.on('hesap', (e: { value: number }) => { sales.push(e.value); });
    for (const t of ts.slice(0, 3)) k.musteri(t, { cay: 2 }, 2);
    for (let i = 0; i < 6; i++) k.r.counter.cay.push({ type: 'cay', tier: 1 });
    k.step(150, () => evs(k.sim, 'hesap').length >= 3);
    expect(evs(k.sim, 'hesap').length).toBe(3);
    const tips = evs(k.sim, 'tip').reduce((s: number, e: any) => s + e.data.tip, 0);
    expect(tips).toBeGreaterThan(0);
    expect(k.api.kumbara!().birikim).toBe(tips);
    // masaların para yığınına bahşiş düşmedi; personel payına (paidToday) bahşiş eklenmedi
    expect(k.r.tables.every((t: { pile: unknown[] }) => t.pile.length === 0)).toBe(true);
    expect(k.S.workers.every((w: { paidToday?: number }) => !w.paidToday)).toBe(true);
    const birikim = k.api.kumbara!().birikim;
    k.sim.command({ kind: 'force', what: 'endDay' }); k.sim.step(0.1);
    const d = evs(k.sim, 'bahsisDagit'); expect(d.length).toBe(1);
    const son = k.api.kumbara!().son!;
    expect(son.pay.map(p => p.wid)).toEqual([701, 702]);
    expect(son.pay[0].tutar).toBe(son.pay[1].tutar);
    expect(son.toplam + k.api.kumbara!().birikim).toBeCloseTo(birikim, 6);   // dağıtılan + ertesi güne kalan küsurat = biriken
    expect(k.api.kumbara!().birikim).toBeLessThan(2);
    expect(k.r.uiLast.gunSonu.bahsis).toEqual({ toplam: son.toplam, kisi: 2 });
    void sales;
  });
});
