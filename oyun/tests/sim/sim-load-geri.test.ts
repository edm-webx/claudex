// QA 2026-11-27: şekli bozuk durum sim.load içinde yarıda patlarsa oyun yarım yüklenmiş dünyada kalmasın: eski durum geri gelir, hata çağırana gider
import { it, expect } from 'vitest';
import { createSim } from '../../src/game/headless';
import { emptyContent } from '../../src/content/index';
const log = { info() {}, warn() {}, error() {} };
it('bozuk durum yüklenemezse sim eski hâline döner', () => {
  const sim: any = createSim({ seed: 7, content: emptyContent() }, { log });
  sim.command({ kind: 'play', hero: 'sabri' }); sim.step(0.2);
  sim.state.money = 4321;
  // durumu kuran adım (rules.restore) bozuk veride patlasın: raporda boot TypeError "reading 'x'"
  const asil = sim.rules.restore; let ilk = true;
  sim.rules.restore = () => { if (ilk) { ilk = false; throw new TypeError("Cannot read properties of undefined (reading 'x')"); } return asil(); };
  expect(() => sim.load({ ...JSON.parse(JSON.stringify(sim.state)), money: 1 })).toThrow(/reading 'x'/);
  expect(sim.state.money).toBe(4321); expect(sim.state.player).toBeTruthy();
  sim.step(0.5);   // oyun akmaya devam eder
  expect(sim.state.money).toBeGreaterThanOrEqual(4321);
});
