// 2026-11-22 sahip: "her dükkânda istasyon olacak, büfedeki gibi: kahveci kahve makinesini kullanacak, biz gidince biz de
// kullanabileceğiz; tost makinesi gibi bekledikçe ürün geliyor; tüm dükkânlara bu mantıkla iş eklenecek".
// Makine istasyonu: ürünü koyan (oyuncu / çalışan) başında beklemek zorunda değil, makine kendi yapar, bitince hazır tepside durur.
import { it, expect } from 'vitest';
import { played, kareyeGit } from './m1-helpers';
import { icBina } from '../../src/content/ic-mekan';
import { ARSA_ISLETME, ISLETME } from '../../src/content/esya';
import { KALEM, MAKINE, MAKINE_TEPSI } from '../../src/content/isletme-istasyon';

const ROOMS = icBina('avm');
const mk = () => { const sim = played(1) as any; sim.step(1); const S = sim.state; return { sim, S, h: sim.rules.rt.kafeHost, c: Object.assign((x: any) => sim.command({ kind: 'mulk', ...x }), { sim }) }; };
const roomOf = (id: string) => ROOMS.find(m => m.arsa === id)!;
const buyAll = (c: any, ...ids: string[]) => { for (const id of ids) { kareyeGit(c.sim, id); c({ op: 'arsaAl', id }); } };
const kafe = (sim: any) => sim.rules.rt.agents.kafe;

it('her AVM dükkânının menüsünde en az bir makine istasyonu var (giyimde dikiş makinesi, elektronikte test tezgâhı...)', () => {
  for (const m of ROOMS) {
    const menu = ISLETME[ARSA_ISLETME[m.arsa!]].menu;
    expect(menu.some(x => MAKINE.has(KALEM[x.id].ist)), m.id).toBe(true);
  }
});

it('oyuncu: ürünü makineye koyar, uzaklaşır, makine kendi bitirir; dönünce sıradaki müşteriye verir', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; buyAll(c, 'k10', 'k11');
  const room = roomOf('k11'), p = S.zones.arsa.plots.k11;
  // müşteri gelsin, kahve makinesinde yapılan bir şey istesin
  let ist = '', want = '';
  for (let i = 0; i < 1500 && !ist; i++) {
    h.pending.k11 = Math.max(h.pending.k11 || 0, 1); sim.step(0.1);
    const w = kafe(sim).siparisOf(room.id)[0];
    if (w) { const id = ISLETME[ARSA_ISLETME.k11].menu.find((x: any) => x.ad === w)!.id; if (MAKINE.has(KALEM[id].ist)) { ist = KALEM[id].ist; want = id; } }
  }
  expect(ist).not.toBe('');
  const it0 = sim.interactions.get('kafeIst.' + room.id + '.' + ist);
  sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z, kat: 1 });
  for (let i = 0; i < 8; i++) sim.step(0.1);
  const mak = () => kafe(sim).makineler(room.id).find((x: any) => x.ist === ist);
  expect(mak()?.cook, 'makine çalışıyor').toBeTruthy(); expect(p.sat).toBe(0);
  // uzaklaş: makine yine de biter, ürün hazır tepside
  sim.command({ kind: 'teleport', x: room.x, z: room.z + 6, kat: 1 });
  for (let i = 0; i < 80 && mak()?.cook; i++) sim.step(0.1);
  expect(mak()?.cook).toBe(''); expect(mak()?.ready.length).toBeGreaterThan(0);
  // geri dön: hazır ürünü müşteriye verir
  const sat0 = p.sat; void want;
  sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z, kat: 1 });
  for (let i = 0; i < 10 && p.sat === sat0; i++) sim.step(0.1);
  expect(p.sat).toBeGreaterThan(sat0);
});

it('çalışan: makineye koyar, makine yaparken başında bekler, tepsiden alıp müşteriye götürür; boşta önceden ürün koyar (tepsi sınırlı)', () => {
  const { sim, S, h, c } = mk(); S.level = 40; S.money = 1e8; buyAll(c, 'k10', 'k11');
  const room = roomOf('k11'), p = S.zones.arsa.plots.k11; p.isci = 1;
  c({ op: 'adminIsci', id: 'k11' });
  let pisti = false;
  for (let i = 0; i < 2500; i++) {
    h.pending.k11 = Math.max(h.pending.k11 || 0, 1); sim.step(0.1);
    if (kafe(sim).makineler(room.id).some((x: any) => x.cook)) pisti = true;
  }
  expect(pisti).toBe(true); expect(p.sat).toBeGreaterThan(2);
  // müşteri gelmezse: çalışan boşta makineye koyar, hazır tepsi dolar ama sınırı aşmaz
  for (let i = 0; i < 1500; i++) sim.step(0.1);
  const ms = kafe(sim).makineler(room.id);
  expect(ms.some((x: any) => x.ready.length > 0)).toBe(true);
  for (const m of ms) expect(m.ready.length).toBeLessThanOrEqual(MAKINE_TEPSI);
});
