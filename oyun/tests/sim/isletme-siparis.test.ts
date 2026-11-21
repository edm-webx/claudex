// DKN-05: every guest asks for an item of the business's own menu, the worker makes and carries exactly that
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { ISLETME, ARSA_ISLETME } from '../../src/content/esya';
import { KALEM, ISTASYON_SIRA } from '../../src/content/isletme-istasyon';

const mk = () => { const sim = played(1) as any; sim.step(1); const S = sim.state; S.level = 40; S.money = 5e7; return { sim, S, h: sim.rules.rt.kafeHost, c: (x: any) => sim.command({ kind: 'mulk', ...x }) }; };

it('veri bütünlüğü: 72 kalemin (9 işletme x 8) hepsinin istasyonu/süresi var, stok/maliyet yok', () => {
  const ids = Object.values(ISLETME).flatMap(i => i.menu.map(m => m.id)); expect(ids.length).toBe(72);
  for (const id of ids) { const k = KALEM[id]; expect(k, id).toBeTruthy(); expect(ISTASYON_SIRA).toContain(k.ist); expect(k.sure).toBeGreaterThan(0); expect(k.renk).toMatch(/^#[0-9a-f]{6}$/i); }
  expect(JSON.stringify(KALEM) + JSON.stringify(ISLETME)).not.toMatch(/maliyet|stok|malzeme/i);
});
it('k1-k6: istek menüden, işçi tam o kalemi taşır, satış o kalemin fiyatı, gün sonu k: anahtarı', () => {
  for (const id of ['k1', 'k2', 'k3', 'k4', 'k5', 'k6']) {
    const { sim, S, h, c } = mk(); c({ op: 'arsaAl', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); c({ op: 'yukselt', id }); c({ op: 'adminTadilatBitir', id }); c({ op: 'yukselt', id });
    c({ op: 'adminIsci', id }); c({ op: 'adminIsci', id });
    const menu = ISLETME[ARSA_ISLETME[id]].menu.map(m => m.id), carried = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      sim.step(0.1); h.pending[id] = Math.max(h.pending[id] || 0, 1);
      for (const a of sim.rules.rt.agents.registry.list) if (a.kind === 'worker' && a.key.startsWith('kafe-') && a.carry.length) for (const x of a.carry) carried.add(x.type);
    }
    expect(carried.size, id).toBeGreaterThanOrEqual(2);
    for (const t of carried) { expect(t.startsWith('urun:'), id).toBe(true); expect(menu, id).toContain(t.slice(5)); }
    const sold = Object.keys(S.today.sold || {}).filter(k => k.startsWith('k:')); expect(sold.length, id).toBeGreaterThanOrEqual(2);
  }
});
it('seviye 1 kafede yalnız ilk iki kalem istenir', () => {
  const { sim, S, h, c } = mk(); c({ op: 'arsaAl', id: 'k1' }); c({ op: 'adminIsci', id: 'k1' }); void S;
  const seen = new Set<string>();
  for (let i = 0; i < 4000; i++) { sim.step(0.1); h.pending.k1 = Math.max(h.pending.k1 || 0, 1); for (const a of sim.rules.rt.agents.registry.list) if (a.kind === 'worker' && a.key.startsWith('kafe-k') && a.carry.length) a.carry.forEach((x: any) => seen.add(x.type)); }
  expect([...seen].every(t => ['urun:turk_kahvesi', 'urun:demlik_cay'].includes(t))).toBe(true); expect(seen.size).toBeGreaterThan(0);
});
