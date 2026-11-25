import { describe, it, expect } from 'vitest';
import { kur } from './garson-yardimci';
import { mutfakDunya, mutfakStand } from '../../src/content/ic-mekan';
import { MUTFAK_ISTASYON } from '../../src/content/mutfak';
import { DISHES, hazirlikOf } from '../../src/content/yemek-menu';
// 2026-11-25 sahip: "mutfağa gidip istasyonda yemek yapamıyorum". Her aşama, her pişirme istasyonu: oyuncu başında durunca o istasyonun yemeği pişer.
for (const stage of [3, 4, 5, 6, 7, 8, 9, 10]) describe(`aşama ${stage}`, () => {
  for (const ist of MUTFAK_ISTASYON.filter(i => i.islev === 'pisir' && i.stage <= stage)) {
    const dish = DISHES.find(d => d.istasyon === ist.id && d.asama <= stage);
    if (!dish) { it.skip(`${ist.id}: yemek yok`, () => {}); continue; }
    it(`${ist.id} (${dish.id}) oyuncu pişirir`, () => {
      const k = kur(4), { sim, api, r } = k;
      k.sim.command({ kind: 'force', what: 'stage', value: stage });
      for (const i of MUTFAK_ISTASYON) k.sim.command({ kind: 'mutfakAl', e: i.id } as never);
      k.step(0.5);
      k.musteri(0, { [dish.id]: 1 }); k.step(6);
      expect(api.view().tickets.length, 'bilet').toBe(1);
      const p = mutfakDunya(mutfakStand(ist.id)); sim.command({ kind: 'teleport', x: p.x, z: p.z });
      k.step(1);
      expect(api.hat!.ist(-1), 'oyuncu istasyonda iş aldı').toBe(ist.id);
      k.step(hazirlikOf(dish.id) + 3);
      expect(r.carry.some((c: { type: string }) => c.type === dish.id), 'tabak elde').toBe(true);
    });
  }
});
