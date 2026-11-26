// 2026-11-22 sahibi: "mutfak hâlâ işlevsiz, karelerle tek tek açılan istasyonlar yok, her yerinde hayaletlenme (içinden geçiliyor)".
// Mutfak istasyonları mutfağın içinde, kendi yerlerinde sarı kareyle tek tek alınır; alınan istasyon kendi yemeklerini pişirir ve gövdesi
// katıdır. Salon eşyaları da alınınca katı.
import { describe, it, expect } from 'vitest';
import { played } from './m1-helpers';
import { mutfakEsya, mutfakAcik, setMutfakAlinan, MUTFAK_HAZIR, istasyonFiyat, calismaIstasyonuOf } from '../../src/content/mutfak';
import { icColliders, IC_BY_ID, mutfakDunya, mutfakStand } from '../../src/content/ic-mekan';

const kareler = (sim: ReturnType<typeof played>) => sim.rules.rt.pads.filter(p => p.key.startsWith('mutfak.'));
describe('mutfak istasyonları sarı karelerle', () => {
  it('yeni oyunda aşama 3: yalnız pass ve ocak hazır, sıradaki istasyonlar mutfakta karede; alınca kurulur ve kendi işini alır', () => {
    const sim = played(7); sim.step(1);
    sim.state.stage = 3; sim.state.money = 1e7; sim.step(1);
    expect(mutfakEsya(3).sort()).toEqual([...MUTFAK_HAZIR].sort());
    const k = kareler(sim); expect(k.length).toBeGreaterThan(0); expect(k.length).toBeLessThanOrEqual(2);
    const id = k[0].key.slice('mutfak.'.length), w = mutfakDunya(mutfakStand(id));
    expect(Math.hypot(k[0].pos.x - w.x, k[0].pos.z - w.z)).toBeLessThan(0.01);   // kare istasyonun önünde
    expect(k[0].price).toBe(istasyonFiyat(id)); expect(k[0].price).toBeGreaterThan(0);
    expect(calismaIstasyonuOf(id, 3)).toBe('ocak');   // alınmadan yemekleri ocakta pişer
    const n0 = icColliders(IC_BY_ID.mutfak, 3).length, m0 = sim.state.money;
    sim.command({ kind: 'mulk', op: 'mutfakAl', e: id } as never); sim.step(1);
    expect(mutfakEsya(3)).toContain(id); expect(sim.state.money).toBeLessThan(m0);
    expect(calismaIstasyonuOf(id, 3)).toBe(id);   // artık kendi istasyonunda
    expect(icColliders(IC_BY_ID.mutfak, 3).length).toBe(n0 + 1);   // gövdesi katı
    expect(kareler(sim).some(p => p.key === 'mutfak.' + id)).toBe(false);
  });
  it('eski kayıt (mutfak alanı yok): o aşamaya kadarki istasyonların hepsi alınmış sayılır', () => {
    const sim = played(8); sim.state.stage = 7; delete (sim.state.zones as Record<string, unknown>).mutfak; sim.step(1);
    expect(mutfakEsya(7).sort()).toEqual(mutfakAcik(7).sort()); expect(kareler(sim).length).toBe(0);
  });
  it('mutfağın her istasyonu ve salon eşyaları gövdeleriyle katı (alınmışsa)', () => {
    setMutfakAlinan(null);
    const say = (s: number) => icColliders(IC_BY_ID.mutfak, s).length;   // aşama 6+ mutfağın kendi duvarı yok (5 duvar parçası düşer)
    expect(say(10) - (say(3) - 5)).toBeGreaterThanOrEqual(mutfakAcik(10).length - mutfakAcik(3).length);
    const W = IC_BY_ID.salonW; expect(icColliders(W, 10, ['semaver_dev', 'tas_firin']).length).toBe(icColliders(W, 10, []).length + 2);
  });
});
