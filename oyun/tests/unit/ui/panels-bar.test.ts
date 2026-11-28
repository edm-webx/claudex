import { describe, it, expect } from 'vitest';
import { barSignature, menuItems } from '../../../src/game/ui/panels';

const base = () => ({ level: 1, day: 1, stars: 0, stage: 1, tadilat: false, workers: [] as unknown[], cats: [] as unknown[], ach: {} as Record<string, unknown>, orders: { list: [] as { done: boolean; claimed: boolean }[] } });
// Sözleşme: menü listesini değiştirebilecek her durum değişikliği imzayı da değiştirmeli (yoksa arayüz güncellenmez).
describe('PRF-05 menü imzası', () => {
  it('değişmeyen durumda imza sabit', () => { expect(barSignature(base())).toBe(barSignature(base())); });
  // 2026-11-26 Esnaf telefonu HUD: the bar is only Çanta + Telefon; the only thing that changes it is the Ajanda badge
  it('bar sabit: Çanta + Telefon, yalnız rozet değişir', () => {
    const a = base(); a.day = 2; a.level = 9; a.workers.push({}); a.stars = 3;
    expect(menuItems(a).map((x: { id: string }) => x.id)).toEqual(['envanter', 'telefon']);
    const b = base(); b.day = 2; b.orders.list.push({ done: true, claimed: false });
    expect(JSON.stringify(menuItems(b))).not.toBe(JSON.stringify(menuItems(base())));
    expect(barSignature(b)).not.toBe(barSignature(base()));
  });
  it('imza aynıysa menü aynı: rastgele durumlarda sözleşme', () => {
    const seen = new Map<number, string>();
    let seed = 7; const r = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    for (let i = 0; i < 400; i++) {
      const s = base(); s.level = 1 + r(8); s.day = 1 + r(3); s.stars = r(3); s.stage = 1 + r(3); s.tadilat = r(2) === 1;
      if (r(2)) s.workers.push({}); if (r(2)) s.cats.push({}); if (r(2)) s.ach.a = 1;
      for (let k = r(4); k > 0; k--) s.orders.list.push({ done: r(2) === 1, claimed: r(2) === 1 });
      const sig = barSignature(s), key = JSON.stringify(menuItems(s));
      if (seen.has(sig)) expect(seen.get(sig)).toBe(key); else seen.set(sig, key);
    }
  });
});
