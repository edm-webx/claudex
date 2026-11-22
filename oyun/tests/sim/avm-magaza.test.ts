// 2026-11-21 owner: "AVM'de merdiven var ama işlevsiz, her katında mağaza olsun, satın alıp işletelim". Martı AVM = 3 floors
// (content/avm-kat.ts) x 4 shops off a central hall with working escalators. Every shop is its own business: own room + door on
// its floor, bought from a level (and after the floor's anchor shop), own menu (net price, no stock), equipment, crew, live guests
// and staff who walk in through the mall entrance and ride up, stage renovation. The player's own AVM shopping (avmAl) still works.
import { it, expect } from 'vitest';
import { played, kareyeGit } from './m1-helpers';
import { mulkApi } from '../../src/game/sim/mulk';
import { IC_BY_ID, IC_CANLI, icBina, icHangi, icWorld, icDim, icLayout, icIcinde, icColliders } from '../../src/content/ic-mekan';
import { ARSALAR, ARSA_ISLETME, ISLETME, arsaKapi, kafeMenu, dukkanMusteri, DUKKAN_BY_ID } from '../../src/content/esya';
import { ASAMA } from '../../src/content/isletme-asama';
import { ISLETME_ROL } from '../../src/content/isletme-kadro';
import { KALEM } from '../../src/content/isletme-istasyon';
import { insaatYer } from '../../src/content/isletme-insaat';
import { karsiPrefabs, karsiProps } from '../../src/content/zones/karsi';
import { AVM, HOL, SERIT, MERD, GIRIS_KAPI, AVM_BINA, AVM_DIS, holEngel, katY, avmIcinde, avmGelis, avmGidis } from '../../src/content/avm-kat';

const ROOMS = icBina('avm'), IDS = ROOMS.map(m => m.arsa!).sort();
const RETAIL = ['k7', 'k8', 'k9'], NEW = IDS.filter(id => id !== 'k5');
const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; sim.step(1); /* kurulum: sıralı açılma şartı yok (content/acilis.ts, kendi testi acilis.test.ts) */ const S = sim.state; return { sim, S, m: mulkApi(sim.rules)!, h: sim.rules.rt.kafeHost, c: Object.assign((x: any) => sim.command({ kind: 'mulk', ...x }), { sim }) }; };
const roomOf = (id: string) => ROOMS.find(m => m.arsa === id)!;
const plot = (id: string) => ARSALAR.find(a => a.id === id)!;
const kafeActors = (sim: any, room: string, kind: string) => sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.key.startsWith('kafe-' + room + '-') && a.kind === kind);
const buyAll = (c: any, ...ids: string[]) => { for (const id of ids) { kareyeGit(c.sim, id); c({ op: 'arsaAl', id }); } };

it('AVM: 3 dükkân katı x 4 dükkân (en üst kat eğlence katı), aynı kattakiler kesişmez, hepsi binada; her birinin kendi kapısı (kendi katının holünde) ve arsası var', () => {
  expect(ROOMS).toHaveLength(12); expect(IC_CANLI).toEqual(expect.arrayContaining(IDS));
  for (let k = 0; k < AVM.KAT; k++) expect(ROOMS.filter(m => (m.kat || 0) === k)).toHaveLength(k === AVM.KAT - 1 ? 0 : 4);
  for (const m of ROOMS) {
    const kat = m.kat || 0, a = plot(m.arsa!), d = arsaKapi(a);
    expect(m.x - m.wx / 2).toBeGreaterThanOrEqual(AVM.x0 - 1e-6); expect(m.x + m.wx / 2).toBeLessThanOrEqual(AVM.x1 + 1e-6);
    expect(m.z - m.wz / 2).toBeGreaterThanOrEqual(AVM.z0 - 1e-6); expect(m.z + m.wz / 2).toBeLessThanOrEqual(AVM.z1 + 1e-6);
    expect((a.kat || 0), m.id).toBe(kat); expect(a.sabit).toBeTruthy();
    expect(d.x > HOL.x0 && d.x < HOL.x1, m.id + ' door in the hall').toBe(true); expect(Math.abs(d.z - m.z)).toBeLessThan(0.01);
    for (let i = 0; i < 40; i++) { const p = icWorld(m, (i % 5 - 2) * icDim(m).W / 5, ((i / 5 | 0) - 3.5) * icDim(m).D / 8.5); expect(icHangi({ ...p, kat }, 0)?.id, m.id).toBe(m.id); }
    expect(icIcinde(m, { x: m.x, z: m.z, kat: (kat + 1) % 3 })).toBe(false);   // a stacked room on another floor is not this one
  }
  for (const p of ROOMS) for (const q of ROOMS) if (p !== q && (p.kat || 0) === (q.kat || 0)) expect(Math.abs(p.x - q.x) >= (p.wx + q.wx) / 2 - 1e-6 || Math.abs(p.z - q.z) >= (p.wz + q.wz) / 2 - 1e-6, p.id + '/' + q.id).toBe(true);
});

it('AVM: iskelede kapalı kabuk + giriş kapısı; içeride zemin kapıları açık, cephe, lobi ve merdiven bloğu kapalı', () => {
  const def = karsiPrefabs().find(d => d.id === 'kr.avm')!, pl = karsiProps().find(p => p.prefab === 'kr.avm')!;
  const dis = (def.colliders || []).map(r => ({ x0: r.x0 + pl.pos.x, x1: r.x1 + pl.pos.x, z0: r.z0 + pl.pos.z, z1: r.z1 + pl.pos.z }));
  const in_ = (rs: { x0: number; x1: number; z0: number; z1: number }[], p: { x: number; z: number }) => rs.some(r => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1);
  expect(in_(dis, { x: AVM_BINA.x, z: AVM_BINA.z })).toBe(true); expect(in_(dis, AVM_DIS)).toBe(false);   // the shell is solid, its door step is free
  const ic = [...holEngel(0), ...ROOMS.filter(r => !r.kat).flatMap(r => icColliders(r))], hit = (p: { x: number; z: number }) => in_(ic, p);
  expect(hit({ x: (GIRIS_KAPI.x0 + GIRIS_KAPI.x1) / 2, z: AVM.z0 + 0.1 })).toBe(false);
  expect(hit({ x: AVM.x0 + 1, z: AVM.z0 + 0.1 })).toBe(true);
  expect(hit({ x: (SERIT.U.x0 + SERIT.U.x1) / 2, z: (MERD.on + MERD.arka) / 2 })).toBe(true);
  for (const m of ROOMS.filter(r => !r.kat)) {
    const D = icDim(m).D;
    for (const v of [D / 2 + 0.6, D / 2 - 0.1, D / 2 - 1.0]) expect(hit(icWorld(m, 0, v)), m.id + ' v=' + v).toBe(false);
    expect(hit(icWorld(m, 1.6, D / 2 - 0.1)), m.id + ' front wall').toBe(true);
  }
});

it('müşteri / işçi yolu: girişten merdivenlerle her kata çıkar, aynı yoldan iner, yükseklik kat kat artar', () => {
  for (let k = 0; k < AVM.KAT; k++) {
    const hedef = { x: HOL.x0 + 0.7, z: 50.9 }, up = avmGelis(k, hedef), down = avmGidis(k, hedef);
    expect(up[up.length - 1]).toMatchObject({ ...hedef, y: katY(k) }); expect(down[down.length - 1].y).toBe(0);
    for (const p of [...up, ...down]) expect(avmIcinde(p, 1.2), JSON.stringify(p)).toBe(true);
    for (let i = 1; i < up.length; i++) expect(up[i].y).toBeGreaterThanOrEqual(up[i - 1].y);
  }
});

it('yeni işletmeler: 8 kalem net fiyatlı menü, 8 alet (hepsi odada görünür), 5 aşama adı, kadro, istasyon; stok yok', () => {
  for (const id of IDS) {
    const t = ISLETME[ARSA_ISLETME[id]]; expect(t, id).toBeTruthy();
    expect(t.menu).toHaveLength(8); expect(t.esya.length).toBeGreaterThanOrEqual(8); expect(t.asama.filter(Boolean)).toHaveLength(5);
    expect(ASAMA[t.id]).toHaveLength(5); expect(ISLETME_ROL[t.id].filter(r => r.minLv === 1).length, id).toBeGreaterThanOrEqual(2);
    for (const k of t.menu) { expect(KALEM[k.id], k.id).toBeTruthy(); expect(k.fiyat).toBeGreaterThan(0); }
    const shown = new Set(icLayout(roomOf(id)).map(i => i.esya).filter(Boolean)); for (const e of t.esya) expect(shown.has(e.id), id + ' ' + e.id).toBe(true);
    expect(JSON.stringify(t)).not.toMatch(/stok|maliyet/i);
  }
  expect(new Set(IDS.map(id => ISLETME[ARSA_ISLETME[id]].ad)).size).toBe(12);
});

it('ekonomi: arsa fiyatına göre saatlik gelir lokantayla aynı bantta; mağazada müşteri az, fiş büyük', () => {
  const rev = (id: string, lv: number) => {
    const t = ISLETME[ARSA_ISLETME[id]], menu = kafeMenu(id, lv), avg = menu.reduce((s, x) => s + x.fiyat, 0) / menu.length;
    let fK = 1, mK = 1 + 0.08 * Math.max(0, menu.length - 2); for (const e of t.esya.filter(x => x.lv <= lv)) { fK += e.fiyatK || 0; mK += e.musteri || 0; }
    const mus = dukkanMusteri(DUKKAN_BY_ID.kafe, lv) * mK * t.mus; return { mus, fis: avg * fK, perLira: mus * avg * fK / plot(id).fiyat };
  };
  for (const lv of [1, 3, 5]) {
    const lok = rev('k5', lv);
    for (const id of NEW) {
      const r = rev(id, lv);
      expect(r.perLira / lok.perLira, id + ' lv' + lv).toBeGreaterThan(0.6); expect(r.perLira / lok.perLira, id + ' lv' + lv).toBeLessThan(1.5);
      if (RETAIL.includes(id)) { expect(r.mus, id).toBeLessThan(lok.mus / 2.5); expect(r.fis, id).toBeGreaterThan(lok.fis * 2); }
    }
  }
  for (const id of NEW) { const a = plot(id); expect(a.seviye, id).toBeGreaterThanOrEqual(6); expect(a.fiyat, id).toBeGreaterThanOrEqual(200000); }
});

it('satın al: seviye kilidi + katın öncü dükkânı şartı; kapıda doğru işletme seçilir, üst üste dükkânlar katla ayrılır', () => {
  const { sim, S, m, c } = mk();
  for (const id of IDS) {
    const a = plot(id), k = arsaKapi(a); sim.command({ kind: 'teleport', x: k.x, z: k.z, kat: a.kat || 0 }); sim.step(0.3);
    expect(m.view().arsaYakin, id).toBe(id);
  }
  const kahve = roomOf('k11'), ic = icWorld(kahve, -0.4, 1.0);
  sim.command({ kind: 'teleport', x: ic.x, z: ic.z, kat: 1 }); sim.step(0.3); expect(m.view().arsaYakin).toBe('k11');
  sim.command({ kind: 'teleport', x: ic.x, z: ic.z, kat: 0 }); sim.step(0.3); expect(m.view().arsaYakin).toBe('k7');   // the shop under it
  S.money = 1e8; S.level = 40;
  sim.rules.rt.acilisSerbest = false; S.stage = 10; S.stars = 5; S.stats.served = 1e6; S.stats.miniPlay = 99; for (const id of ['k1', 'k2', 'k4', 'k3', 'k6']) c({ op: 'adminKafe', id, n: 1 });   // gerçek sıra: karşı yaka bitti (content/acilis.ts)
  c({ op: 'arsaAl', id: 'k10' }); expect(S.zones.arsa.plots.k10).toBeUndefined();   // panelden / uzaktan alınmaz: yalnız kapısındaki sarı kare
  buyAll(c, 'k11'); expect(S.zones.arsa.plots.k11).toBeUndefined();   // the floor's anchor (şekerci k10) first
  buyAll(c, 'k10'); const m0 = S.money; buyAll(c, 'k11');
  expect(S.zones.arsa.plots.k11).toMatchObject({ tur: 'dukkan', lv: 1 }); expect(m0 - S.money).toBe(plot('k11').fiyat);
  for (const k of Object.keys(S.zones.arsa.plots.k11)) expect(['esya', 'fr', 'ilan', 'ilanGun', 'isci', 'kadro', 'lv', 'sat', 'till', 'tip', 'tur', 'maas', 'tadilat', 'tema']).toContain(k);   // the generic Plot, no new save field
});

it('yürüyen merdiven: oyuncu yukarı şeride yürür, 1. ve 2. kata çıkar; aşağı şeritle zemine iner; üst katta duvardan geçemez', () => {
  const { sim } = mk(), w = sim.walk;
  const ride = (x: number, z: number, kat: number, dz: number) => {
    sim.command({ kind: 'teleport', x, z, kat }); sim.input({ x: 0, z: dz }); let maxY = w.y;
    for (let i = 0; i < 80 && w.kat === kat; i++) { sim.step(0.1); maxY = Math.max(maxY, w.y); }
    sim.input({ x: 0, z: 0 }); for (let i = 0; i < 15; i++) sim.step(0.1); return maxY;
  };
  const uX = (SERIT.U.x0 + SERIT.U.x1) / 2, dX = (SERIT.D.x0 + SERIT.D.x1) / 2;
  ride(uX, MERD.on - 0.6, 0, 1); expect(w.kat).toBe(1); expect(w.y).toBeCloseTo(katY(1), 3); expect(sim.state.player.kat).toBe(1);
  ride(uX, MERD.on - 0.6, 1, 1); expect(w.kat).toBe(2); expect(w.y).toBeCloseTo(katY(2), 3);
  ride(dX, MERD.arka + 0.6, 2, -1); expect(w.kat).toBe(1);
  ride(dX, MERD.arka + 0.6, 1, -1); expect(w.kat).toBe(0); expect(w.y).toBeCloseTo(0, 3); expect(sim.state.player.kat).toBeUndefined();
  // floor 2: walking west from the hall into the shop wall (not its door) stops at the wall
  const lok = roomOf('k5'); sim.command({ kind: 'teleport', x: HOL.x0 + 0.6, z: lok.z + 2.2, kat: 2 }); sim.input({ x: -1, z: 0 });
  for (let i = 0; i < 30; i++) sim.step(0.1); sim.input({ x: 0, z: 0 });
  expect(w.pos.x).toBeGreaterThan(HOL.x0 - 0.3); expect(w.kat).toBe(2);
  // the escalator void on an upper floor is closed
  sim.command({ kind: 'teleport', x: HOL.x0 + 0.6, z: (MERD.on + MERD.arka) / 2, kat: 1 }); sim.input({ x: 1, z: 0 });
  for (let i = 0; i < 30; i++) sim.step(0.1); sim.input({ x: 0, z: 0 });
  expect(w.pos.x).toBeLessThan(MERD.kx0); expect(w.kat).toBe(1);
});

it('üst kat dükkânı canlı: işçiler ve müşteriler girişten merdivenle kata çıkar, işçi kalemi taşır, satış kasaya yazar', () => {
  for (const id of ['k12', 'k16']) {
    const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8;
    buyAll(c, 'k10', 'k5', id); const p = S.zones.arsa.plots[id], room = roomOf(id), kat = room.kat!, menu = ISLETME[ARSA_ISLETME[id]].menu;
    c({ op: 'ilanAl', id, e: '' }); c({ op: 'ilanAl', id, e: '' }); expect(p.kadro, id).toHaveLength(2);
    sim.command({ kind: 'teleport', x: 0, z: 0 });
    const carried = new Set<string>(); let guestUp = false; const sat0 = p.sat;
    for (let i = 0; i < 1800; i++) {
      sim.step(0.1); h.pending[id] = Math.max(h.pending[id] || 0, 1);
      for (const g of kafeActors(sim, room.id, 'regular')) { expect(avmIcinde(g, 1.5), id + ' guest in the mall').toBe(true); if (icIcinde(room, { x: g.x, z: g.z, kat }, -0.2) && Math.abs(g.y - katY(kat)) < 0.01) guestUp = true; }
      for (const wk of kafeActors(sim, room.id, 'worker')) for (const x of wk.carry) carried.add(x.type);
    }
    const staff = kafeActors(sim, room.id, 'worker'); expect(staff, id).toHaveLength(2);
    for (const wk of staff) { expect(icIcinde(room, { x: wk.x, z: wk.z, kat }, 0.9), id + ' staff at work').toBe(true); expect(wk.y).toBeCloseTo(katY(kat), 3); }
    expect(guestUp, id).toBe(true);
    expect(p.sat - sat0, id).toBeGreaterThan(3);
    for (const t of carried) expect(menu.map(x => x.id), id).toContain(t.slice(5));
  }
});

it('mağaza müşterisi önce rafların önünde gezinir, sonra kasaya geçer (giyim, zemin kat)', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; buyAll(c, 'k7'); c({ op: 'adminIsci', id: 'k7' });
  const room = roomOf('k7'), lay = icLayout(room); let gez = false;
  const racks = lay.filter(i => i.k === 'reyon' || i.k === 'teshir').map(i => icWorld(room, i.u, i.v));
  for (let i = 0; i < 900; i++) {
    sim.step(0.1); h.pending.k7 = Math.max(h.pending.k7 || 0, 1);
    for (const g of kafeActors(sim, room.id, 'regular')) if (icIcinde(room, g, -0.3) && g.act === 'idle' && racks.some(r => Math.hypot(r.x - g.x, r.z - g.z) < 1.6)) gez = true;
  }
  expect(gez).toBe(true); expect(S.zones.arsa.plots.k7.sat).toBeGreaterThan(0);
});

it('oyuncu servis eder: üst kattaki istasyonda hazırlayınca satış olur, alt kattan aynı noktada olmaz', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; buyAll(c, 'k10', 'k11');
  const p = S.zones.arsa.plots.k11, room = roomOf('k11');
  let blocked = 0;
  for (let i = 0; i < 1200 && p.sat === 0; i++) {
    h.pending.k11 = Math.max(h.pending.k11 || 0, 1);
    const want = sim.rules.rt.agents.kafe.siparisOf(room.id)[0];
    if (want) {
      const kal = KALEM[ISLETME[ARSA_ISLETME.k11].menu.find(x => x.ad === want)!.id], it0 = sim.interactions.get('kafeIst.' + room.id + '.' + kal.ist);
      if (it0 && blocked < 30) { sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z, kat: 0 }); blocked++; }
      else if (it0) sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z, kat: 1 });
    }
    sim.step(0.1);
    if (blocked > 0 && blocked < 30) expect(p.sat, 'served from the floor below').toBe(0);
  }
  expect(blocked).toBe(30); expect(p.sat).toBeGreaterThan(0);
});

it('tadilat: AVM dükkânı süreli yükselir (sokak cephesi yok), aşama kuyruğu açar', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; buyAll(c, 'k7');
  const p = S.zones.arsa.plots.k7; expect(insaatYer('k7')).toBeNull();
  const m0 = S.money; c({ op: 'yukselt', id: 'k7' }); expect(m0 - S.money).toBe(Math.round(plot('k7').fiyat * 0.45));
  expect(p.tadilat).toMatchObject({ to: 2 });
  for (let i = 0; i < 2000 && p.tadilat; i++) sim.step(0.25);
  expect(p.lv).toBe(2); expect(h.info('k7').kuyruk).toBe(2);
});

it('tadilat: üst kattaki AVM dükkânına iki gerçek usta girişten yürüyüp merdivenle çıkar, içeride çalışır, bitince çıkıp gider', () => {
  const { sim, S, c } = mk(); S.level = 40; S.money = 1e9;
  const id = ROOMS.find(m => (m.kat || 0) === 1)!.arsa!; for (const a of ARSALAR) if (ROOMS.some(m => m.arsa === a.id)) buyAll(c, a.id);
  const p = S.zones.arsa.plots[id], m = roomOf(id); expect(p).toBeTruthy();
  const usta = () => sim.rules.rt.agents.registry.list.filter((a: any) => !a.dead && a.key.startsWith('insaat-' + id + '-'));
  c({ op: 'yukselt', id }); expect(p.tadilat).toBeTruthy();
  sim.step(0.25); expect(usta().length).toBe(2);
  const y0 = usta()[0].y; expect(y0).toBeLessThan(0.5);   // zemin kattaki girişte belirir
  const inRoom = (a: any) => Math.abs(a.x - m.x) < m.wx / 2 && Math.abs(a.z - m.z) < m.wz / 2;
  let geldi = false, calisti = false;
  for (let i = 0; i < 400 && p.tadilat; i++) { sim.step(0.25); const u = usta(); if (u.length === 2 && u.every(inRoom)) geldi = true; if (u.some((a: any) => a.act === 'sweep' && inRoom(a))) calisti = true; if (geldi && calisti) break; }
  expect(geldi).toBe(true); expect(calisti).toBe(true);
  for (const a of usta()) expect(a.y).toBeCloseTo(katY(1), 1);
  c({ op: 'adminTadilatBitir', id }); expect(p.tadilat).toBeFalsy();
  sim.step(0.25); expect(usta().length).toBe(2);   // yok olmazlar, yürüyerek çıkarlar
  for (let i = 0; i < 600 && usta().length; i++) sim.step(0.25);
  expect(usta().length).toBe(0);
});

it('AVM alışverişi (avmAl) mağazaların içinde de çalışır, dışarıda çalışmaz', () => {
  const { sim, S, c } = mk(); S.money = 1e6;
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.zones.avm?.alinan || []).not.toContain('deri_ceket');
  const moda = roomOf('k7'); sim.command({ kind: 'teleport', x: moda.x, z: moda.z });
  c({ op: 'avmAl', id: 'deri_ceket' }); expect(S.zones.avm.alinan).toContain('deri_ceket');
  const oy = IC_BY_ID.avm_oyuncak; sim.command({ kind: 'teleport', x: oy.x, z: oy.z }); const m1 = S.money;
  c({ op: 'avmAl', id: 'film_doner' }); expect(S.money).toBeLessThan(m1);
});

it('ayrı harita: iskeledeki AVM kapısına yürüyen AVM diyarına geçer, içeride kalır; giriş kapısından çıkan kapının önüne döner', () => {
  const { sim } = mk(), w = sim.walk;
  sim.command({ kind: 'teleport', x: AVM_DIS.x, z: AVM_DIS.z - 1.6 }); sim.input({ x: 0, z: 1 });
  for (let i = 0; i < 30 && w.pos.x < 1000; i++) sim.step(0.1);
  sim.input({ x: 0, z: 0 }); for (let i = 0; i < 40; i++) sim.step(0.1);
  expect(avmIcinde(w.pos)).toBe(true); expect(w.kat).toBe(0);
  sim.input({ x: 0, z: -1 }); for (let i = 0; i < 40 && w.pos.x > 1000; i++) sim.step(0.1);
  sim.input({ x: 0, z: 0 }); sim.step(0.5);
  expect(w.pos.x).toBeLessThan(100); expect(Math.hypot(w.pos.x - AVM_DIS.x, w.pos.z - AVM_DIS.z)).toBeLessThan(2.5);
});

it('sarı kareler: kapının önündeki kareye basınca para akar, dolunca dükkân senin; içerideki karelerle alet kurulur; kilitli kare para almaz', () => {
  const { sim, S } = mk(); S.level = 6; S.money = 2e6;
  const stand = (key: string, kat: number, sec: number) => {
    sim.step(0.3); const it = sim.interactions.get('pad.' + key); expect(it, key).toBeTruthy();
    sim.command({ kind: 'teleport', x: it.pos.x, z: it.pos.z, kat }); for (let i = 0; i < sec * 10; i++) sim.step(0.1);
  };
  const m0 = S.money; stand('avm.k11', 1, 2); expect(S.money).toBe(m0); expect(S.zones.arsa.plots.k11).toBeUndefined();   // locked: level 7 + şekerci first
  stand('avm.k10', 0, 0.4); expect(S.padPaid['avm.k10']).toBeGreaterThan(0); expect(S.money).toBeLessThan(m0);   // money flows while standing
  stand('avm.k10', 0, 3); expect(S.zones.arsa.plots.k10).toMatchObject({ tur: 'dukkan', lv: 1 }); expect(m0 - S.money).toBeCloseTo(plot('k10').fiyat, 2); expect(S.padPaid['avm.k10']).toBeUndefined();
  sim.step(0.5); const alet = [...sim.rules.rt.pads].filter((p: any) => p.key.startsWith('avm.k10.')); expect(alet.length).toBeGreaterThanOrEqual(1);
  const k = alet[0].key, e = k.split('.')[2];
  stand(k, 1, 1); expect(S.zones.arsa.plots.k10.esya || []).not.toContain(e);   // from the floor above: nothing
  stand(k, 0, 4); expect(S.zones.arsa.plots.k10.esya).toContain(e);
});
