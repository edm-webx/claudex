// BUF-19/20: kanat terasları, salonlar ve çatı terasları canlı. Masa sayısı aşamadan türer (kayıt şeması değişmez); her kanat masası
// sim masasıdır: müşteri yürüyüp oturur, garson servis eder, hesap ödenir. Pasif salon geliri yok; salon aletleri gerçek hesaba ve
// yemek süresine etki eder. Görünümde figür yok (masalar sim koltuklarıyla çizilir).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { kur, evs } from './garson-yardimci';
import { CITIZENS } from '../../src/content/citizens';
import {
  KANAT_BASE, KANAT_MASALAR, KANAT_N, kanatKurulu, kanatSay, kanatOf, kanatFiyatX, catiY, katY, catiYukari, catiAsagi, catiAyak, merdivenKutu, KANAT_POST,
  setMasaAlinan,
} from '../../src/content/kanat';
import { salonKatYan } from '../../src/game/sim/salon';
import { IC_BY_ID, icColliders, icLayout, icWorld } from '../../src/content/ic-mekan';

const emekli = CITIZENS.find(t => t.id === 'emekli');
const inR = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;
const seatOf = (m: { x: number; z: number; ax: 'x' | 'z' }, s: number) => (m.ax === 'z' ? { x: m.x, z: m.z - (s ? -0.78 : 0.78) } : { x: m.x + (s ? 0.78 : -0.78), z: m.z });
const yanOf = (m: { x: number; z: number; ax: 'x' | 'z' }) => (m.ax === 'z' ? { x: m.x + 0.95, z: m.z } : { x: m.x, z: m.z + 0.95 });

/** kur() + aşama, istenen garsonlar; kanat dışı (ya da `bos` dışı) kurulu masaları sahte doluluğa alır ki masa müşterisi istenen bölgeye otursun */
function sahne(stage: number, garson: number, bos: (i: number) => boolean, esya: string[] = []) {
  const k = kur();
  k.sim.command({ kind: 'force', what: 'money', value: 2_000_000_000 });
  k.sim.command({ kind: 'force', what: 'stage', value: stage });
  if (esya.length) (k.S.zones.salon ||= { esya: [] }).esya = esya.slice();
  for (let i = 0; i < garson; i++) k.garson(701 + i);
  k.step(2);
  for (const i of k.kurulu()) if (!bos(i)) for (const s of k.r.tables[i].seats) s.occ = 999999;
  return k;
}
/** spawner yoluyla masa müşterisi (yürüyerek gelir); test setine alınır */
function masaMusterisi(k: ReturnType<typeof kur>, order: Record<string, number>) {
  const c = k.r.customersApi.spawnCustomer({ type: emekli, n: 1, kind: 'masa', order });
  k.test.add(c.id);
  return c;
}
const stokla = (k: ReturnType<typeof kur>) => { for (const p of ['cay', 'ayran', 'simit', 'tost', 'gazoz', 'doner']) { const b = (k.r.counter[p] ||= []); while (b.length < 6) b.push({ type: p, tier: 1 }); } };

describe('BUF-19/20 kanat masaları', () => {
  it('masa sayısı aşamadan türer: çay bahçesi 4 -> 8, dondurma 4 -> 6, salonlar 6 (+2 aşama 10), çatılar 4+4 (aşama 8)', () => {
    expect(kanatSay(2, 'cay')).toBe(0); expect(kanatSay(3, 'cay')).toBe(4); expect(kanatSay(5, 'cay')).toBe(8);
    expect(kanatSay(3, 'dondurma')).toBe(0); expect(kanatSay(4, 'dondurma')).toBe(4); expect(kanatSay(7, 'dondurma')).toBe(6); expect(kanatSay(10, 'dondurma')).toBe(6);
    expect(kanatSay(5, 'salonW')).toBe(0); expect(kanatSay(6, 'salonW')).toBe(6); expect(kanatSay(10, 'salonW')).toBe(8);
    expect(kanatSay(7, 'salonE')).toBe(6); expect(kanatSay(10, 'salonE')).toBe(8);
    expect(kanatSay(7, 'catiW') + kanatSay(7, 'catiE')).toBe(0); expect(kanatSay(8, 'catiW') + kanatSay(8, 'catiE')).toBe(8);
    for (let s = 3; s <= 10; s++) expect(kanatKurulu(s).length).toBeGreaterThanOrEqual(kanatKurulu(s - 1).length);

    const k = kur();
    expect(k.r.layout.tables.length).toBe(KANAT_BASE + KANAT_N);   // düzen sabit, kurulu olan aşamadan
    for (const st of [5, 10, 4]) {
      k.sim.command({ kind: 'force', what: 'stage', value: st }); k.step(0.2);
      const kurulu = new Set(kanatKurulu(st));
      for (let j = 0; j < KANAT_N; j++) expect(k.r.tables[KANAT_BASE + j].built, 'st' + st + ' masa ' + (KANAT_BASE + j)).toBe(kurulu.has(KANAT_BASE + j));
    }
    // aşama 5: büfe önü masaları + 12 kanat masası oturulabilir (16+)
    k.sim.command({ kind: 'force', what: 'stage', value: 5 }); k.step(0.2);
    expect(k.kurulu().length).toBeGreaterThanOrEqual(16);
  });

  it('çay bahçesi masası: müşteri yürüyüp oturur, garson servis eder, hesap kanat fiyatıyla ödenir (salon geliri gerçek)', () => {
    const k = sahne(5, 2, i => kanatOf(i)?.bolge === 'cay');
    const c = masaMusterisi(k, { cay: 2 });
    const T = c.seat.table, m = kanatOf(T)!;
    expect(m.bolge).toBe('cay'); expect(c.state).toBe('toSeat');
    const yol0 = Math.hypot(c.x - m.x, c.z - m.z); expect(yol0).toBeGreaterThan(3);   // uzaktan doğar, ışınlanmaz
    let oturdu = false, servisMesafe = Infinity;
    k.sim.rules.bus.on('serve', (e: { table: number }) => {
      if (e.table !== T) return;
      const y = yanOf(m);
      servisMesafe = Math.min(servisMesafe, ...k.r.agents.workers.rows().filter((w: { role: string }) => w.role === 'garson').map((w: { x: number; z: number }) => Math.hypot(w.x - y.x, w.z - y.z)));
    });
    k.step(300, () => {
      stokla(k);
      const s = seatOf(m, c.seat?.seat ?? 0);
      if (c.state !== 'toSeat' && c.state !== 'leave' && Math.hypot(c.x - s.x, c.z - s.z) < 0.6) oturdu = true;
      return evs(k.sim, 'hesap').length > 0;
    });
    expect(oturdu).toBe(true);
    expect(evs(k.sim, 'serve').some((e: { data: { table: number } }) => e.data.table === T)).toBe(true);
    expect(servisMesafe).toBeLessThan(2.6);
    const h = evs(k.sim, 'hesap'); expect(h.length).toBe(1);
    const T2 = k.S.today; expect(T2.salonGelir).toBe(h[0].data.value); expect(T2.salonMis).toBe(1); expect(k.S.stats.salonMasa).toBe(1);
    expect(h[0].data.value).toBeGreaterThan(2 * 5 * kanatFiyatX(5) * 0.5);   // iki çay x teras fiyatı
  });

  it('çatı terası: müşteri dış merdivenden çıkar (y = çatı), garson çıkıp servis eder, iner; garson yoksa çatı masası açılmaz', () => {
    const cati = (i: number) => !!kanatOf(i)?.cati;
    const k0 = sahne(8, 0, cati);
    const c0 = masaMusterisi(k0, { cay: 1 });
    expect(c0.seat ? kanatOf(c0.seat.table)?.cati : undefined).toBeUndefined();   // garsonsuz çatıya oturtulmaz

    const k = sahne(8, 3, cati);
    const c = masaMusterisi(k, { cay: 1 });
    const T = c.seat.table, m = kanatOf(T)!; expect(m.cati).toBeTruthy();
    const ry = catiY(8, m.cati!);
    let maxY = 0, merdivende = false, servis = false, inis = false, havada = false;
    k.sim.rules.bus.on('serve', (e: { table: number }) => { if (e.table === T) servis = true; });
    k.step(400, () => {
      stokla(k);
      const y = c.y || 0; maxY = Math.max(maxY, y);
      if (y > 0.3 && y < ry - 0.3 && inR(c, merdivenKutu(m.cati!))) merdivende = true;
      if (servis && c.state === 'leave' && maxY > ry - 0.05 && y < 0.05) inis = true;
      if (c.state === 'leave' && !k.r.customers.includes(c) && y > 0.05) havada = true;   // çatıdan yere ışınlanmaz
      return inis;
    });
    expect(merdivende).toBe(true);
    expect(maxY).toBeCloseTo(ry, 1);
    expect(servis).toBe(true);
    expect(evs(k.sim, 'hesap').length).toBe(1);
    expect(inis).toBe(true); expect(havada).toBe(false);
    expect(k.S.today.salonGelir).toBeGreaterThan(0);
    expect(k.S.stats.isinlanma || 0).toBe(0);
  });

  it('çatı rotası ve yükseklik: merdiven ayağından yukarı / aşağı, merdivende ara yükseklik, yerde 0', () => {
    for (const s of ['W', 'E'] as const) {
      const to = KANAT_MASALAR.find(m => m.cati === s)!, up = catiYukari(s, to), dn = catiAsagi(s, to);
      expect(up[up.length - 1]).toEqual({ x: to.x, z: to.z });
      expect(dn[dn.length - 1]).toEqual(catiAyak(s));
      const ayak = catiAyak(s), kutu = merdivenKutu(s);
      expect(inR(ayak, kutu)).toBe(false);   // merdiven ayağı yürünebilir
      expect(katY(8, ayak.x, ayak.z, false)).toBe(0);
      expect(katY(8, to.x, to.z, true)).toBeCloseTo(catiY(8, s));
      expect(katY(8, to.x, to.z, false)).toBe(0);   // salonun içi (yerdeki) çatı yüksekliğine çıkmaz
      expect(katY(7, to.x, to.z, true)).toBe(0);
      const mid = katY(8, ayak.x, (ayak.z + kutu.z0) / 2, true); expect(mid).toBeGreaterThan(0.5); expect(mid).toBeLessThan(catiY(8, s) - 0.5);
    }
    expect(catiY(8, 'E')).toBeGreaterThan(catiY(8, 'W'));   // balık lokantası aşama 8'de iki katlı
  });

  it('pasif salon geliri yok: aşama 10, kanat müşterisi yokken salon geliri 0', () => {
    const k = sahne(10, 0, () => false, ['tas_firin', 'buz_tezgah']);
    const m0 = k.S.money;
    k.step(80);
    expect(k.S.today.salonGelir || 0).toBe(0);
    expect(k.S.money).toBeLessThanOrEqual(m0);
    const src = readFileSync('src/game/sim/salon.ts', 'utf8');
    expect(src).not.toMatch(/S\.money\s*\+=/);
  });

  it('salon aletleri gerçek hesabı ve yemek süresini etkiler, yalnız kendi tarafında', () => {
    const W = salonKatYan(['tas_firin'], 6, 'W'), E = salonKatYan(['tas_firin'], 6, 'E');
    expect(W.adis).toBeGreaterThan(1); expect(E.adis).toBe(1);
    expect(salonKatYan(['buz_tezgah'], 7, 'E').mis).toBeGreaterThan(1); expect(salonKatYan(['buz_tezgah'], 7, 'W').mis).toBe(1);
    const hesap = (esya: string[]) => {
      const k = sahne(6, 2, i => kanatOf(i)?.bolge === 'cay', esya);
      masaMusterisi(k, { cay: 2 });
      k.step(300, () => { stokla(k); return evs(k.sim, 'hesap').length > 0; });
      return k.S.today.salonGelir as number;
    };
    const a = hesap([]), b = hesap(['tas_firin']);
    expect(a).toBeGreaterThan(0);
    expect(b / a).toBeCloseTo(W.adis, 1);
  });

  it('garson bölgeleri kanat masalarını kapsar; kanat bölgesinin garsonu kendi postunda bekler', () => {
    const k = sahne(5, 3, () => true);
    k.step(3);
    const bs = k.api.bolgeler!();
    const kapsanan = new Set(bs.flatMap(b => b.masalar));
    for (const i of kanatKurulu(5)) expect(kapsanan.has(i), 'masa ' + i).toBe(true);
    const postlar = (k.S.workers as { id: number; role: string }[]).filter(w => w.role === 'garson').map(w => k.api.garsonPost!(w.id)).filter(Boolean);
    expect(postlar.length).toBeGreaterThan(0);
    for (const p of postlar) expect(KANAT_POST[p!.bolge]).toEqual({ x: p!.x, z: p!.z });
  });

  it('salon masaları ic-mekan yerleşimiyle aynı yerde; koltuk ve garson noktası boş, aşama 10 masaları öncesinde yok', () => {
    setMasaAlinan(null);   // yerleşim denetimi: bütün masalar kurulu sayılır (sarı kare kaydı başka testten kalmasın)
    for (const [id, b] of [['salonW', 'salonW'], ['salonE', 'salonE']] as const) {
      const room = IC_BY_ID[id], items = icLayout(room).filter(i => i.k === 'salonMasa');
      const ms = KANAT_MASALAR.filter(m => m.bolge === b);
      expect(items.length).toBe(ms.length);
      for (const m of ms) {
        const it2 = items.find(i => { const w = icWorld(room, i.u, i.v); return Math.abs(w.x - m.x) < 1e-6 && Math.abs(w.z - m.z) < 1e-6; });
        expect(it2, id + ' ' + m.x + ',' + m.z).toBeTruthy();
        expect((it2!.asama ?? 0) === 10).toBe(m.asama === 10);
        const col = icColliders(room, 10);
        for (const p of [seatOf(m, 0), seatOf(m, 1), yanOf(m)]) expect(col.some(r => inR(p, r)), id + ' boş nokta').toBe(false);
        expect(col.some(r => inR(m, r))).toBe(true);
        if (m.asama === 10) expect(icColliders(room, 9).some(r => inR(m, r))).toBe(false);
      }
    }
  });

  it('görünümde figür yok: büyüme ve salon iç mekanında oturan / yürüyen sahte personel ya da misafir çizilmez', () => {
    const bb = readFileSync('src/game/view/world/bufe-buyume.ts', 'utf8');
    expect(bb).not.toMatch(/figure\(|walker\(|bobbers/);
    expect(bb).toMatch(/KANAT_MASALAR/);
    const look = readFileSync('src/game/view/world/ic-mekan-look.ts', 'utf8');
    expect(look).toMatch(/live \|\| empty \|\| m\.salon \? 0/);
    expect(look).not.toMatch(/gozleme:[^\n]*person\(/);
  });
});
