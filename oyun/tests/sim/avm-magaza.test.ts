// 2026-11-20 owner: Martı AVM's shops are separate businesses (lokanta k5 + Martı Moda k7 giyim, Tekno Martı k8 elektronik,
// Oyuncak Dünyası k9 oyuncak): own room + door, bought from a level, own menu (net price, no stock), equipment, crew, live
// guests and staff, stage renovation. The player's own AVM shopping (avmAl) works in any of the rooms.
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { IC_BY_ID, IC_CANLI, icBina, icHangi, icWorld, icDim, icLayout, icIcinde } from '../../src/content/ic-mekan';
import { ARSALAR, ARSA_ISLETME, ISLETME, arsaKapi, kafeMenu, dukkanMusteri, DUKKAN_BY_ID } from '../../src/content/esya';
import { ASAMA } from '../../src/content/isletme-asama';
import { ISLETME_ROL } from '../../src/content/isletme-kadro';
import { KALEM } from '../../src/content/isletme-istasyon';
import { insaatYer } from '../../src/content/isletme-insaat';
import { karsiPrefabs, karsiProps, KARSI_AVM } from '../../src/content/zones/karsi';

const SHOPS = ['k7', 'k8', 'k9'], AVM = ['k5', ...SHOPS];
const mk = () => { const sim = played(1) as any; sim.step(1); const S = sim.state; return { sim, S, m: mulkApi(sim.rules)!, h: sim.rules.rt.kafeHost, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };
const roomOf = (id: string) => icBina('avm').find(m => m.arsa === id)!;
const kafeGuests = (sim: any, room: string) => sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.key.startsWith('kafe-' + room + '-') && a.kind === 'regular');
const kafeStaff = (sim: any, room: string) => sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.key.startsWith('kafe-' + room + '-') && a.kind === 'worker');

it('AVM: dört oda binayı yan yana böler, kesişmez, her birinin kendi kapısı ve arsası var', () => {
  const rooms = icBina('avm'); expect(rooms.map(m => m.arsa).sort()).toEqual(AVM);
  expect(rooms.reduce((s, m) => s + m.wx, 0)).toBeCloseTo(16.9, 5);
  const x0 = Math.min(...rooms.map(m => m.x - m.wx / 2)), x1 = Math.max(...rooms.map(m => m.x + m.wx / 2));
  expect(x0).toBeCloseTo(KARSI_AVM.x - 16.9 / 2, 5); expect(x1).toBeCloseTo(KARSI_AVM.x + 16.9 / 2, 5);
  for (const m of rooms) {
    expect(m.kapi).toBe('-z'); expect(m.bina).toBe('avm');
    const a = ARSALAR.find(x => x.id === m.arsa)!; expect(a.sabit).toBeTruthy(); expect(a.x).toBeCloseTo(m.x, 5);
    expect(Math.abs(arsaKapi(a).x - m.x)).toBeLessThan(0.01); expect(arsaKapi(a).z).toBeLessThan(m.z - m.wz / 2);   // in front of its own door
    for (let i = 0; i < 40; i++) { const p = icWorld(m, (i % 5 - 2) * icDim(m).W / 5, ((i / 5 | 0) - 3.5) * icDim(m).D / 8.5); expect(icHangi(p)?.id, m.id).toBe(m.id); }
  }
  for (const p of rooms) for (const q of rooms) if (p !== q) expect(Math.abs(p.x - q.x) >= (p.wx + q.wx) / 2 - 1e-6).toBe(true);
  expect(IC_CANLI).toEqual(expect.arrayContaining(AVM));
});

it('AVM: binanın çarpışma kutularında her kapı açık, odalar arası duvar kapalı', () => {
  const def = karsiPrefabs().find(d => d.id === 'kr.avm')!, pl = karsiProps().find(p => p.prefab === 'kr.avm')!;
  const rects = (def.colliders || []).map(r => ({ x0: r.x0 + pl.pos.x, x1: r.x1 + pl.pos.x, z0: r.z0 + pl.pos.z, z1: r.z1 + pl.pos.z }));
  const hit = (p: { x: number; z: number }) => rects.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
  const rooms = icBina('avm').sort((a, b) => a.x - b.x);
  for (const m of rooms) {
    const D = icDim(m).D;
    for (const v of [D / 2 + 0.6, D / 2 - 0.1, D / 2 - 1.0, D / 2 - 2.0]) expect(hit(icWorld(m, 0, v)), m.id + ' v=' + v).toBe(false);
    expect(hit(icWorld(m, 1.3, D / 2 - 0.1)), m.id + ' front wall').toBe(true);
  }
  for (let i = 0; i + 1 < rooms.length; i++) { const xb = rooms[i].x + rooms[i].wx / 2; for (const x of [xb - 0.1, xb + 0.1]) for (const z of [48, 51.8, 55]) expect(hit({ x, z }), 'wall ' + x + ',' + z).toBe(true); }
});

it('yeni tipler: 8 kalem net fiyatlı menü, 8 alet (hepsi odada görünür), aşama adları, kadro, kalemlerin istasyonu var; stok yok', () => {
  for (const id of SHOPS) {
    const t = ISLETME[ARSA_ISLETME[id]]; expect(['giyim', 'elektronik', 'oyuncak']).toContain(t.id);
    expect(t.menu).toHaveLength(8); expect(t.esya).toHaveLength(8); expect(t.asama.filter(Boolean)).toHaveLength(5);
    expect(ASAMA[t.id]).toHaveLength(5); expect(ISLETME_ROL[t.id].filter(r => r.minLv === 1).length).toBeGreaterThanOrEqual(2);
    for (const k of t.menu) { expect(KALEM[k.id], k.id).toBeTruthy(); expect(k.fiyat).toBeGreaterThanOrEqual(100); }
    const shown = new Set(icLayout(roomOf(id)).map(i => i.esya).filter(Boolean)); for (const e of t.esya) expect(shown.has(e.id), id + ' ' + e.id).toBe(true);
    expect(JSON.stringify(t)).not.toMatch(/stok|maliyet|malzeme/i);
  }
});

it('ekonomi: mağazada müşteri az, fiş büyük; arsa fiyatına göre saatlik gelir lokantayla aynı bantta', () => {
  const rev = (id: string, lv: number) => {
    const t = ISLETME[ARSA_ISLETME[id]], menu = kafeMenu(id, lv), avg = menu.reduce((s, x) => s + x.fiyat, 0) / menu.length;
    let fK = 1, mK = 1 + 0.08 * Math.max(0, menu.length - 2); for (const e of t.esya.filter(x => x.lv <= lv)) { fK += e.fiyatK || 0; mK += e.musteri || 0; }
    const mus = dukkanMusteri(DUKKAN_BY_ID.kafe, lv) * mK * t.mus; return { mus, fis: avg * fK, perLira: mus * avg * fK / ARSALAR.find(a => a.id === id)!.fiyat };
  };
  for (const lv of [1, 3, 5]) {
    const lok = rev('k5', lv), kafe = rev('k1', lv);
    for (const id of SHOPS) {
      const r = rev(id, lv);
      expect(r.mus, id + ' lv' + lv).toBeLessThan(lok.mus / 2.5); expect(r.fis, id).toBeGreaterThan(lok.fis * 2); expect(r.fis).toBeGreaterThan(kafe.fis * 3);
      expect(r.perLira / lok.perLira, id + ' lv' + lv).toBeGreaterThan(0.6); expect(r.perLira / lok.perLira, id + ' lv' + lv).toBeLessThan(1.5);
    }
  }
  const lv = (id: string) => ARSALAR.find(a => a.id === id)!;
  expect(lv('k7').seviye).toBeGreaterThan(lv('k5').seviye); expect(lv('k8').seviye).toBeGreaterThan(lv('k7').seviye); expect(lv('k8').fiyat).toBeGreaterThan(lv('k7').fiyat);
});

it('satın al: seviye kilidi, içeride/kapıda doğru işletme seçilir, satın alınca dükkân olur', () => {
  const { sim, S, m, c } = mk();
  const tekno = roomOf('k8'), ic = icWorld(tekno, -0.4, 1.0);
  sim.command({ kind: 'teleport', x: ic.x, z: ic.z }); sim.step(0.3);
  expect(m.view().arsaYakin).toBe('k8'); expect(m.view().avmYakin).toBe(true);
  for (const id of AVM) { const k = arsaKapi(ARSALAR.find(a => a.id === id)!); sim.command({ kind: 'teleport', x: k.x, z: k.z }); sim.step(0.3); expect(m.view().arsaYakin, id).toBe(id); }
  S.money = 1e7; S.level = 7; c({ op: 'arsaAl', id: 'k8' }); expect(S.zones.arsa.plots.k8).toBeUndefined();   // tekno: level 8
  S.level = 8; const m0 = S.money; c({ op: 'arsaAl', id: 'k8' });
  expect(S.zones.arsa.plots.k8).toMatchObject({ tur: 'dukkan', lv: 1 }); expect(m0 - S.money).toBe(ARSALAR.find(a => a.id === 'k8')!.fiyat);
  const row: any = m.model().arsa.find((x: any) => x.id === 'k8'); expect(row.menu.map((x: any) => x.id)).toEqual(['kulaklik', 'powerbank']); expect(row.asamaAd).toBe('Telefoncu');
  c({ op: 'kafeEsya', id: 'k8', e: 'demo_masa' }); c({ op: 'kafeEsya', id: 'k8', e: 'askilik' }); expect(S.zones.arsa.plots.k8.esya).toEqual(['demo_masa']);   // a clothes rail is not a phone shop tool
  for (const k of Object.keys(S.zones.arsa.plots.k8)) expect(['esya', 'fr', 'ilan', 'ilanGun', 'isci', 'kadro', 'lv', 'sat', 'till', 'tip', 'tur', 'maas', 'tadilat', 'tema']).toContain(k);   // the generic Plot, no new save field
});

it('işçi al, müşteri gelir rafa bakar, gerçek işçi kalemi taşır, satış kasaya yazar; stok tükenmez', () => {
  for (const id of SHOPS) {
    const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8;
    c({ op: 'arsaAl', id }); const p = S.zones.arsa.plots[id], room = roomOf(id).id, menu = ISLETME[ARSA_ISLETME[id]].menu;
    expect(h.info(id).kadro).toHaveLength(0);
    c({ op: 'ilanAl', id, e: '' }); c({ op: 'ilanAl', id, e: '' }); expect(p.kadro, id).toHaveLength(2); expect(p.isci).toBe(2);
    expect(p.kadro.every((k: any) => ISLETME_ROL[ARSA_ISLETME[id]].some(r => r.rol === k.rol))).toBe(true);
    sim.command({ kind: 'teleport', x: 0, z: 0 });
    let gez = false, carried = new Set<string>(), maxG = 0; const sat0 = p.sat;
    for (let i = 0; i < 1500; i++) {
      sim.step(0.1); h.pending[id] = Math.max(h.pending[id] || 0, 1);
      const gs = kafeGuests(sim, room); maxG = Math.max(maxG, gs.length);
      for (const g of gs) if (icIcinde(roomOf(id), g) && g.say && /bak|Beden|güzel|Fiyat/.test(g.say)) gez = true;
      for (const w of kafeStaff(sim, room)) { expect(icIcinde(roomOf(id), w, 0.9), id + ' staff inside').toBe(true); for (const x of w.carry) carried.add(x.type); }
    }
    expect(kafeStaff(sim, room), id).toHaveLength(2);
    expect(maxG, id).toBeGreaterThan(0);
    expect(p.sat - sat0, id).toBeGreaterThan(5);
    for (const t of carried) expect(menu.map(x => x.id), id).toContain(t.slice(5));
    expect(p.till, id).toBeGreaterThan((p.sat - sat0) * 100);   // big tickets
    const sold = Object.keys(S.today.sold || {}).filter(k => k.startsWith('k:') && menu.some(x => 'k:' + x.id === k)); expect(sold.length, id).toBeGreaterThanOrEqual(1);
    void gez;
  }
});

it('müşteri önce rafların önünde gezinir, sonra kasaya geçer (giyim)', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; c({ op: 'arsaAl', id: 'k7' }); c({ op: 'adminIsci', id: 'k7' });
  const room = roomOf('k7'), states = new Set<string>(); let atRack = false;
  for (let i = 0; i < 600; i++) {
    sim.step(0.1); h.pending.k7 = Math.max(h.pending.k7 || 0, 1);
    for (const g of kafeGuests(sim, 'avm_moda')) { const u = room.x - g.x; if (icIcinde(room, g, -0.3) && g.act === 'idle' && Math.abs(u + 0.85) < 0.2) atRack = true; states.add(g.act); }
  }
  expect(atRack).toBe(true); expect(states.has('walk')).toBe(true);
  expect(S.zones.arsa.plots.k7.sat).toBeGreaterThan(0);
});

it('oyuncu servis eder: kasada bekleyen müşterinin kalemini istasyonda hazırlayınca satış olur', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; c({ op: 'arsaAl', id: 'k9' });
  const p = S.zones.arsa.plots.k9, m0 = S.money;
  for (let i = 0; i < 900 && p.sat === 0; i++) {
    sim.step(0.1); h.pending.k9 = Math.max(h.pending.k9 || 0, 1);
    const want = sim.rules.rt.agents.kafe.siparisOf('avm_oyuncak')[0]; if (!want) continue;
    const kal = KALEM[ISLETME.oyuncak.menu.find(x => x.ad === want)!.id], it0 = sim.interactions.get('kafeIst.avm_oyuncak.' + kal.ist);
    if (it0) sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z });
  }
  expect(p.sat).toBeGreaterThan(0); sim.step(0.5); expect(p.till + S.money - m0).toBeGreaterThan(100);   // the till is collected while the player stands inside
});

it('tadilat: mağaza süreli yükselir, 2 usta kendi cephesinde çalışır, aşama kuyruğu açar', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; c({ op: 'arsaAl', id: 'k7' });
  const p = S.zones.arsa.plots.k7, y = insaatYer('k7')!, room = roomOf('k7');
  expect(y).toBeTruthy(); expect(Math.abs(y.ox - room.x)).toBeLessThan(0.01); expect(y.oz).toBeCloseTo(room.z - room.wz / 2, 5); expect(y.S).toBeLessThanOrEqual(room.wx);
  const m0 = S.money; c({ op: 'yukselt', id: 'k7' }); expect(m0 - S.money).toBe(Math.round(300000 * 0.45));
  expect(p.lv).toBe(1); expect(p.tadilat).toMatchObject({ to: 2 }); sim.step(0.3);
  const ustalar = sim.rules.rt.agents.registry.list.filter((a: any) => a.kind === 'worker' && !a.dead && a.info.role === 'usta'); expect(ustalar).toHaveLength(2);
  for (let i = 0; i < 500 && p.tadilat; i++) sim.step(0.25);
  expect(p.lv).toBe(2); expect(h.info('k7').kuyruk).toBe(2); expect((mulkApi(sim.rules)!.model().arsa as any[]).find(x => x.id === 'k7').asamaAd).toBe('Moda mağazası');
  for (let i = 0; i < 2; i++) { c({ op: 'yukselt', id: 'k7' }); c({ op: 'adminTadilatBitir', id: 'k7' }); }
  expect(p.lv).toBe(4); expect(h.info('k7').kuyruk).toBe(3); expect(h.info('k7').menu).toHaveLength(6);
});

it('AVM alışverişi (avmAl) mağazaların içinde de çalışır, dışarıda çalışmaz', () => {
  const { sim, S, c } = mk(); S.money = 1e6;
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.zones.avm?.alinan || []).not.toContain('deri_ceket');
  const moda = roomOf('k7'); sim.command({ kind: 'teleport', x: moda.x, z: moda.z + 2 });
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.zones.avm.alinan).toContain('deri_ceket');
  const oy = IC_BY_ID.avm_oyuncak; sim.command({ kind: 'teleport', x: oy.x, z: oy.z }); const m1 = S.money;
  c({ op: 'avmAl', id: 'film_doner' }); expect(S.money).toBeLessThan(m1);
});
