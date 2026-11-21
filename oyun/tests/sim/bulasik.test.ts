// BUF-13: bulaşık akışı, bulaşıkçı, barista, temizlikçi. Silinen masadan kirli tabak bulaşık istasyonuna yığılır (rt.dirtyDishes),
// bulaşıkçı otomatik yıkar (oyuncu uğraşmaz), bulaşıkçı yoksa yığın büyür ve masa hazırlığı sınırlı yavaşlar (hafif ceza, yıkım yok),
// barista çay barında içecekleri yapar, temizlikçi mutfak zeminini paspaslar. Deterministik (sabit tohum, sabit adım).
import { describe, it, expect } from 'vitest';
import { installMutfakHat, type HatTicket } from '../../src/game/sim/mutfak-hat';
import { BULASIK, MUTFAK_ROL_BY_ID, bulasikCeza, mutfakEtki } from '../../src/content/mutfak';
import { ROLES } from '../../src/content/ranks';
import { icecekMi } from '../../src/content/yemek-menu';
import { IC_BY_ID, icIcinde } from '../../src/content/ic-mekan';
import { zeminSave } from '../../src/game/sim/zemin';
import { kur, evs } from './garson-yardimci';

type W = { id: number; name: string; role: string; xp: number; rank: number; morale: number; traits: string[]; trait: string; rarity: string; look?: object };
const isci = (id: number, role: string): W => ({ id, name: role + id, role, xp: 0, rank: 0, morale: 70, traits: ['hamarat'], trait: 'hamarat', rarity: 'gri' });
function hazir(stage: number) {
  const k = kur(4);
  k.sim.command({ kind: 'force', what: 'stage', value: stage });
  k.step(0.3);
  return k;
}
const rows = (k: ReturnType<typeof kur>) => k.r.agents.workers.rows() as { id: number; role: string; state: string; x: number; z: number }[];
const kirli = (k: ReturnType<typeof kur>, i: number, n: number) => { k.r.tables[i].dirty = n; };

describe('içerik: ceza ve roller', () => {
  it('ceza sınırlı ve monoton: soft\'a kadar 1, hard\'da 2, asla 2\'yi geçmez', () => {
    expect(bulasikCeza(0)).toBe(1); expect(bulasikCeza(BULASIK.soft)).toBe(1); expect(bulasikCeza(16)).toBeCloseTo(1.5, 9);
    expect(bulasikCeza(BULASIK.hard)).toBe(2); expect(bulasikCeza(BULASIK.max)).toBe(2);
    let son = 0; for (let n = 0; n <= BULASIK.max; n++) { const c = bulasikCeza(n); expect(c).toBeGreaterThanOrEqual(son); expect(c).toBeLessThanOrEqual(2); son = c; }
  });
  it('bulaşıkçı ve barista sahte hız vermez, aşçı hâlâ verir; barista mutfak rolü', () => {
    expect(mutfakEtki([{ role: 'bulasikci', xp: 0 }]).hiz).toBe(0); expect(mutfakEtki([{ role: 'barista', xp: 0 }]).hiz).toBe(0);
    expect(mutfakEtki([{ role: 'asci', xp: 0 }]).hiz).toBeGreaterThan(0);
    expect(ROLES.barista.mutfak).toBe(true); expect(ROLES.barista.on).toBe(false); expect(MUTFAK_ROL_BY_ID.barista.on).toBeUndefined();
  });
  it('rol açıklamaları gerçeğe uygun: karşılıksız "tabak yığılmaz" yok', () => {
    expect(MUTFAK_ROL_BY_ID.bulasikci.etki).toMatch(/yıkar/); expect(MUTFAK_ROL_BY_ID.bulasikci.etki).not.toMatch(/hızına/);
    expect(MUTFAK_ROL_BY_ID.barista.etki).toMatch(/çay barında/); expect(MUTFAK_ROL_BY_ID.barista.etki).not.toMatch(/hızlandırır/);
  });
  it('içecek: çay barında hazırlananlar (tezgâh içecekleri ve menü içecekleri)', () => {
    for (const f of ['cay', 'ayran', 'gazoz', 'demlik_cay', 'limonata']) expect(icecekMi(f), f).toBe(true);
    for (const f of ['tost', 'doner', 'menemen']) expect(icecekMi(f), f).toBe(false);
  });
});

describe('kirli tabak yığını', () => {
  it('aşama 5 öncesi yığın yok; aşama 5\'te silinen masanın tabakları yığına gider; tavan max', () => {
    const k = hazir(4), r = k.r;
    kirli(k, 0, 3); r.bulasik.masaSilindi(0); expect(r.dirtyDishes).toBe(0);
    k.sim.command({ kind: 'force', what: 'stage', value: 5 }); k.step(0.3);
    kirli(k, 0, 3); r.bulasik.masaSilindi(0); expect(r.dirtyDishes).toBe(3);
    for (let i = 0; i < 20; i++) r.bulasik.add(8); expect(r.dirtyDishes).toBe(BULASIK.max);
  });
  it('oyuncu elle silince de tabaklar yığına gider (masa etkileşimi aynı kapıdan geçer)', () => {
    const k = hazir(5), r = k.r, tb = r.layout.tables[0];
    r.tables[0].dirty = 2; k.sim.command({ kind: 'teleport', x: tb.x, z: tb.z }); k.step(2);
    expect(r.tables[0].dirty).toBe(0); expect(r.dirtyDishes).toBe(2);
  });
  it('10 yemek sonrası yığın 10; bulaşıkçı yokken 60 sn sonra hâlâ 10; bulaşıkçı varken 0, xp artar, kWash görülür', () => {
    const k = hazir(5), r = k.r;
    for (let i = 0; i < 10; i++) { kirli(k, 0, 1); r.bulasik.masaSilindi(0); }
    expect(r.dirtyDishes).toBe(10);
    k.step(60); expect(r.dirtyDishes).toBe(10);   // bulaşıkçı yok: yıkım ya da kendiliğinden azalma yok
    const w = isci(7101, 'bulasikci'); k.S.workers.push(w);
    let yikadi = false, sure = 0;
    k.step(90, () => { sure += 0.1; if (rows(k).some(x => x.id === 7101 && x.state === 'kWash')) yikadi = true; return r.dirtyDishes === 0; });
    expect(yikadi).toBe(true); expect(r.dirtyDishes).toBe(0); expect(w.xp).toBeGreaterThanOrEqual(10);
    // yıkama hızı: 10 tabak x washS / hız (+ yürüme payı)
    expect(sure).toBeGreaterThan(10 * BULASIK.washS * 0.5); expect(sure).toBeLessThan(10 * BULASIK.washS * 1.25 + 40);
  });
  it('bulasikSes: bulaşıkçı çalışırken seyrek (en çok ~4.5 sn aralık), çalışmıyorken yok', () => {
    const k = hazir(5), r = k.r;
    k.step(20); expect(evs(k.sim, 'bulasikSes').length).toBe(0);   // bulaşıkçı yok
    k.S.workers.push(isci(7102, 'bulasikci'));
    k.step(15); expect(evs(k.sim, 'bulasikSes').length).toBe(0);   // yığın yok: el sallamaz, ses yok
    r.bulasik.add(40);
    k.step(40);
    const n = evs(k.sim, 'bulasikSes').length;
    expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(Math.ceil(40 / 4.5) + 1);
    expect(r.dirtyDishes).toBeLessThan(40);
  });
});

describe('ceza: masa silme yavaşlar (hafif, yıkım yok)', () => {
  /** temizlikçi aynı masayı siler: yığın büyüklüğüne göre süre */
  function silmeSuresi(yigin: number): number {
    const k = hazir(5), r = k.r;
    k.S.workers.push(isci(7201, 'temizlik'));
    k.step(12);   // işe gelir, izler, yerine geçer
    r.dirtyDishes = yigin; r.tables[0].dirty = 1; r.tables[0].dirtyT = 0;
    let t = 0; while (r.tables[0].dirty > 0 && t < 60) { k.step(0.1); t += 0.1; }
    expect(t).toBeLessThan(60); return t;
  }
  it('yığın soft altında ceza yok, hard\'da silme +1.4 sn (1.4 -> 2.8)', () => {
    const t0 = silmeSuresi(0), t8 = silmeSuresi(BULASIK.soft), t24 = silmeSuresi(BULASIK.hard);
    expect(Math.abs(t8 - t0)).toBeLessThan(0.15);
    expect(t24 - t0).toBeGreaterThan(1.2); expect(t24 - t0).toBeLessThan(1.6);
  });
  it('bulaşıkçı yokken yığın tavanda kalır, masalar yine silinir (yıkım yok)', () => {
    const k = hazir(5), r = k.r;
    k.S.workers.push(isci(7202, 'temizlik'));
    r.dirtyDishes = BULASIK.max; k.step(10);
    r.tables[1].dirty = 1; r.tables[1].dirtyT = 0; k.step(30);
    expect(r.tables[1].dirty).toBe(0); expect(r.dirtyDishes).toBe(BULASIK.max);
  });
});

describe('barista: çay barında içecekleri yapar', () => {
  function hatKur(workers: { id: number; role: string; xp?: number }[], tickets: HatTicket[]) {
    const K = { state: { stage: 5, workers, tiers: {} }, rt: { carry: [], counter: { doner: [], cay: [], ayran: [], simit: [], tost: [], gazoz: [] } }, logEv: () => { /* ses yok */ } } as never;
    return installMutfakHat(K, { tickets: () => tickets, jobs: () => 0 });
  }
  it('barista varken aşçı içeceğe dokunmaz, barista yalnız içecek yapar; barista yoksa aşçı içecek alır (bilet askıda kalmaz)', () => {
    const tk: HatTicket[] = [{ no: 1, table: 0, want: { cay: 1, tost: 1, limonata: 1 } }];
    const a = hatKur([{ id: 100, role: 'asci' }, { id: 200, role: 'barista' }], tk);
    expect(a.claim(100)).toBe('tost');   // aşçı en eski kalem içecek olsa bile yalnız içecek olmayanı alır
    expect(a.claim(100)).toBeNull();
    const b = a.claim(200); expect(b === 'cay' || b === 'limonata').toBe(true); expect(a.ist(200)).toBe('cay_bar');
    expect(a.claim(200)).toBeNull();   // çay barı dolu (tek iş)
    const s = hatKur([{ id: 100, role: 'asci' }], tk);
    expect(s.claim(100)).toBe('cay'); expect(s.ist(100)).toBe('cay_bar');
  });
  it('barista mutfakta durur (front değil), gerçek bilette içeceği barda pişirir, tabak pass rafına iner', () => {
    const k = hazir(5), r = k.r;
    k.S.workers.push(isci(7301, 'barista'));
    k.step(20);
    const row = rows(k).find(x => x.id === 7301)!;
    expect(icIcinde(IC_BY_ID.mutfak, row, 0)).toBe(true); expect(['kIdle', 'kBack', 'kCook', 'kArrive']).toContain(row.state);
    k.musteri(0, { cay: 1 });
    let barda = false; k.step(40, () => { if (k.api.hat!.durum().cooking.some(c => c.wid === 7301 && c.ist === 'cay_bar' && c.p === 'cay')) barda = true; return k.api.hat!.passCount('cay') > 0; });
    expect(barda).toBe(true); expect(k.api.hat!.passCount('cay')).toBe(1);
    expect(k.S.workers.find((w: W) => w.id === 7301).xp).toBeGreaterThan(0);
  });
});

describe('temizlikçi mutfak zeminini paspaslar', () => {
  it('mutfakKir 0.6: 150 sn içinde 0.1\'in altına iner, temizlikçi mutfağa girer, paspas bayrağı açılıp kapanır', () => {
    const k = hazir(6), r = k.r;
    k.S.workers.push(isci(7401, 'temizlik'));
    k.step(10);
    zeminSave(k.S).kir = 0; zeminSave(k.S).mutfakKir = 0.6;
    let girdi = false, bayrak = false;
    k.step(150, () => { const w = rows(k).find(x => x.id === 7401)!; if (icIcinde(IC_BY_ID.mutfak, w, 0)) girdi = true; if (r.mutfakMop) bayrak = true; return (zeminSave(k.S).mutfakKir ?? 0) < 0.1 && !r.mutfakMop && girdi; });
    expect(zeminSave(k.S).mutfakKir).toBeLessThan(0.1); expect(girdi).toBe(true); expect(bayrak).toBe(true);
    k.step(25); expect(r.mutfakMop).toBe(false);
  });
  it('mutfak kiri yalnız pişiren / yıkayan işçi varken artar; yeni günde sıfırlanır; eski kayıtta alan yok = 0', () => {
    const k = hazir(5), r = k.r;
    const z = zeminSave(k.S); z.mutfakKir = 0; k.step(30); expect(z.mutfakKir ?? 0).toBe(0);   // kimse çalışmıyor
    k.S.workers.push(isci(7501, 'bulasikci'), isci(7502, 'bulasikci')); r.bulasik.add(40);
    let enCok = 0; k.step(40, () => { enCok = Math.max(enCok, r.mutfakBusy); });
    expect(enCok).toBe(2); expect(z.mutfakKir!).toBeGreaterThan(0.03); expect(z.mutfakKir!).toBeLessThan(0.2);
    k.sim.command({ kind: 'force', what: 'day', value: k.S.day + 1 }); k.step(0.5);
    expect(z.mutfakKir!).toBeLessThan(0.01);   // yeni gün temiz mutfakla başlar
    delete (z as { mutfakKir?: number }).mutfakKir; expect(zeminSave(k.S).mutfakKir ?? 0).toBe(0);   // eski kayıtta alan yok
  });
});
