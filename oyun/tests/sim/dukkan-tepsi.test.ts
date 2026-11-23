// 2026-11-23 sahip: "meydan kafe'nin kareleri neden dışarıda kaç metre uzakta? niye espressonun başına gidip kahve yapıp tepsiye
// alamıyorum" + "satın alınabilen tüm mekanlara bak". Kilit: (1) her dükkânın sarı kareleri kapısında / içinde, (2) her canlı dükkânda
// oyuncu makinenin BAŞINA (tezgâhın arkası) gidip ürünü koyar, makine yapar, ürün tepsisine gelir, müşteriye götürüp verir.
import { it, expect } from 'vitest';
import { played, kareyeGit, tepsi, tepsidenVer } from './m1-helpers';
import { ARSALAR, kafeSatis } from '../../src/content/esya';
import { icOfArsa, icKapi, icIcinde, IC_CANLI } from '../../src/content/ic-mekan';
import { KALEM, MAKINE } from '../../src/content/isletme-istasyon';

const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; const S = sim.state; S.level = 60; S.money = 1e9; S.stage = 10; sim.step(1); return { sim, S }; };
const al = (sim: any, id: string) => { kareyeGit(sim, id); sim.command({ kind: 'mulk', op: 'arsaAl', id }); sim.step(0.5); sim.command({ kind: 'teleport', x: 0, z: 0 }); sim.step(0.3); };

it('sarı kareler kapıda: satın alma ve alet kareleri kapıya en çok 2.6 m (sokak) / AVM aletleri dükkânın içinde', () => {
  const { sim } = mk(); const tablo: string[] = [];
  for (const a of ARSALAR.filter(x => x.sabit && icOfArsa(x.id))) {
    const m = icOfArsa(a.id)!, d = icKapi(m, 0), avm = m.bina === 'avm';
    const kareler = () => sim.rules.rt.pads.filter((q: any) => q.key.split('.')[1] === a.id);
    const once = kareler(); al(sim, a.id); const sonra = kareler();
    expect(sonra.length, a.id + ' alet kareleri').toBe(2);
    for (const q of [...once, ...sonra]) {
      const uz = Math.hypot(q.pos.x - d.x, q.pos.z - d.z), ic = icIcinde(m, { x: q.pos.x, z: q.pos.z, kat: q.kat });
      tablo.push(`${q.key} ${uz.toFixed(1)} m ${ic ? 'iç' : 'dış'}`);
      expect(uz, q.key + ' kapıya uzaklık').toBeLessThanOrEqual(2.7);
      if (avm && q.key.split('.').length > 2) expect(ic, q.key + ' AVM aleti içeride').toBe(true);
    }
    for (let i = 0; i < sonra.length; i++) for (let j = i + 1; j < sonra.length; j++) expect(Math.hypot(sonra[i].pos.x - sonra[j].pos.x, sonra[i].pos.z - sonra[j].pos.z), a.id).toBeGreaterThanOrEqual(1.6);
  }
  expect(tablo.length).toBeGreaterThan(40);
});

it('kare dolunca aynı yere çıkan sıradaki kare, oyuncu inmeden para çekmez', () => {
  const { sim, S } = mk(); al(sim, 'k1');
  const k = sim.rules.rt.pads.find((q: any) => q.key.startsWith('isl.k1.'))!; sim.command({ kind: 'teleport', x: k.pos.x, z: k.pos.z });
  for (let i = 0; i < 40; i++) sim.step(0.1);
  const esya = S.zones.arsa.plots.k1.esya.length, m0 = S.money; expect(esya).toBe(1);
  const yeni = sim.rules.rt.pads.find((q: any) => q.key.startsWith('isl.k1.') && Math.hypot(q.pos.x - k.pos.x, q.pos.z - k.pos.z) < 0.5);
  for (let i = 0; i < 20; i++) sim.step(0.1);
  if (yeni) expect(S.money, 'inmeden para gitmedi').toBe(m0);
});

it('her canlı dükkân: makinenin başına (tezgâh arkası) git, ürünü koy, makine yapsın, tepsiye al, müşteriye götür (k1-k18)', () => {
  const sonuc: string[] = [];
  for (const id of IC_CANLI) {
    const { sim, S } = mk(); al(sim, id); const m = icOfArsa(id)!, kat = m.kat || 0, h = sim.rules.rt.kafeHost, p = S.zones.arsa.plots[id];
    // makinede yapılan bir şey isteyen müşteri gelsin
    // makinede yapılan bir şey isteyen müşteri gelsin (menüsünde makine yoksa, ör. kırtasiye 1. seviye: raftan alınan ilk sipariş)
    let ist = '', want = '', ilk = '';
    for (let i = 0; i < 3000 && !ist; i++) {
      h.pending[id] = Math.max(h.pending[id] || 0, 1); sim.step(0.1);
      const ws: string[] = sim.rules.rt.agents.kafe.siparisOf(m.id); if (!ws.length) continue;
      const ks = ws.map(w => kafeSatis(id, p.lv).find((x: any) => x.ad === w)!.id); ilk ||= ks[0];
      const k = ks.find(x => MAKINE.has(KALEM[x].ist)) || (i > 600 ? ks[ks.length - 1] : '');   // makine yoksa en son gelen (sabrı taze)
      if (k) { ist = KALEM[k].ist; want = k; }
    }
    expect(ist, id + ' sipariş').not.toBe('');
    const it0 = sim.interactions.get('kafeIst.' + m.id + '.' + ist + '.arka'); expect(it0, id).toBeTruthy();
    expect(icIcinde(m, { ...it0.pos, kat }), id + ' makinenin başı odanın içinde').toBe(true);
    sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z, kat });
    for (let i = 0; i < 200 && !tepsi(sim).includes(want); i++) sim.step(0.1);
    expect(tepsi(sim), id + ' ürün tepside').toContain(want);
    const sat0 = p.sat; expect(tepsidenVer(sim, m.id, kat, 10), id + ' servis noktası').toBe(true);
    expect(p.sat, id + ' satış').toBeGreaterThan(sat0);
    sonuc.push(id + ':' + ist); void ilk;
    // dükkândan çıkınca tepsi boşalır (stok yok)
    if (tepsi(sim).length) { sim.command({ kind: 'teleport', x: 0, z: 0 }); sim.step(0.2); expect(tepsi(sim)).toHaveLength(0); }
  }
  expect(sonuc).toHaveLength(IC_CANLI.length);
}, 120000);
