// DKN-05: every guest asks for an item of the business's own menu, the worker makes and carries exactly that
import { it, expect } from 'vitest';
import { played, kareyeGit } from './m1-helpers';
import { ISLETME, ARSA_ISLETME, kafeDolap } from '../../src/content/esya';
import { KALEM, ISTASYON_SIRA, MAKINE } from '../../src/content/isletme-istasyon';

const mk = () => { const sim = played(1) as any; sim.rules.rt.acilisSerbest = true; sim.step(1); /* kurulum: sıralı açılma şartı yok (content/acilis.ts, kendi testi acilis.test.ts) */ const S = sim.state; S.level = 40; S.money = 5e7; return { sim, S, h: sim.rules.rt.kafeHost, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };

it('veri bütünlüğü: 144 kalemin (18 işletme x 8) hepsinin istasyonu/süresi var, stok/maliyet yok', () => {
  const ids = Object.values(ISLETME).flatMap(i => i.menu.map(m => m.id)); expect(ids.length).toBe(144);
  for (const id of ids) { const k = KALEM[id]; expect(k, id).toBeTruthy(); expect(ISTASYON_SIRA).toContain(k.ist); expect(k.sure).toBeGreaterThan(0); expect(k.renk).toMatch(/^#[0-9a-f]{6}$/i); }
  expect(JSON.stringify(KALEM) + JSON.stringify(ISLETME)).not.toMatch(/maliyet|stok|malzeme/i);
});
it('k1-k6: istek menüden, işçi tam o kalemi taşır, satış o kalemin fiyatı, gün sonu k: anahtarı', () => {
  for (const id of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) {
    const { sim, S, h, c } = mk(); kareyeGit(sim, id); c({ op: 'arsaAl', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); c({ op: 'yukselt', id });
    c({ op: 'adminIsci', id }); c({ op: 'adminIsci', id });
    const menu = [...ISLETME[ARSA_ISLETME[id]].menu, ...kafeDolap(id)].map(m => m.id), carried = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      sim.step(0.1); h.pending[id] = Math.max(h.pending[id] || 0, 1);
      for (const a of sim.rules.rt.agents.registry.list) if (a.kind === 'worker' && a.key.startsWith('kafe-') && a.carry.length) for (const x of a.carry) carried.add(x.type);
    }
    expect(carried.size, id).toBeGreaterThanOrEqual(2);
    for (const t of carried) { expect(t.startsWith('urun:'), id).toBe(true); expect(menu, id).toContain(t.slice(5)); }
    const sold = Object.keys(S.today.sold || {}).filter(k => k.startsWith('k:')); expect(sold.length, id).toBeGreaterThanOrEqual(2);
  }
});
it('seviye 1 kafede yalnız ilk iki kalem ve dolap içecekleri istenir', () => {
  const { sim, S, h, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'adminIsci', id: 'k1' }); void S;
  const seen = new Set<string>();
  for (let i = 0; i < 4000; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); for (const a of sim.rules.rt.agents.registry.list) if (a.kind === 'worker' && a.key.startsWith('kafe-k') && a.carry.length) a.carry.forEach((x: any) => seen.add(x.type)); }
  const izin = ['turk_kahvesi', 'demlik_cay', ...kafeDolap('k1').map(m => m.id)].map(x => 'urun:' + x);
  expect([...seen].every(t => izin.includes(t))).toBe(true); expect(seen.size).toBeGreaterThan(0);
  expect([...seen].some(t => t.startsWith('urun:d_')), 'dolaptan içecek de istenir').toBe(true);
});
it('dolap: kafe, bistro, kantin, kafeterya, lokanta 1. seviyeden soğuk içecek satar; dolap istasyonu makine değil; kırtasiye dolapsız', () => {
  for (const id of ['k1', 'k2', 'k4', 'k5', 'k6']) { const d = kafeDolap(id); expect(d.length, id).toBeGreaterThanOrEqual(3); for (const m of d) { expect(KALEM[m.id].ist, m.id).toBe('dolap'); expect(m.fiyat).toBeGreaterThan(0); } }
  expect(kafeDolap('k3').length).toBe(0); expect(MAKINE.has('dolap')).toBe(false);
});
it('oyuncu dolaptan içeceği verir: Meydan Kafe, kola isteyen müşteri, dolabın önünde beklemeden satış', () => {
  const { sim, S, h, c } = mk(); kareyeGit(sim, 'k1'); c({ op: 'arsaAl', id: 'k1' }); const p = S.zones.arsa.plots.k1;
  let ok = false;
  for (let i = 0; i < 3000 && !ok; i++) { h.pending.k1 = Math.max(h.pending.k1 || 0, 1); sim.step(0.1); const w = sim.rules.rt.agents.kafe.siparisOf('kafe1')[0]; ok = !!w && kafeDolap('k1').some(m => m.ad === w); }
  expect(ok, 'dolap içeceği isteyen müşteri').toBe(true);
  const it0 = sim.interactions.get('kafeIst.kafe1.dolap'); expect(it0).toBeTruthy();
  const sat0 = p.sat; sim.command({ kind: 'teleport', x: it0.pos.x, z: it0.pos.z });
  for (let i = 0; i < 20 && p.sat === sat0; i++) sim.step(0.1);
  expect(p.sat).toBeGreaterThan(sat0); expect(Object.keys(S.today.sold || {}).some(k => k.startsWith('k:d_'))).toBe(true);
});
