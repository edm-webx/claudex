// BUF-22: mutfak yerinde büyür (esnaf 3-5, lokanta 6-8, iki hatlı 9, şef pasolu 10). Her aşamanın istasyonları, durakları, aşçı
// bekleme noktaları ve rotası o aşamanın odasının içinde; duvarlar (çarpışma) odayla gider; pass ön duvarda, büfe tezgâhının arkasında,
// garson tabağı odaya girmeden pencereden alır.
import { describe, it, expect } from 'vitest';
import { IC_BY_ID, icColliders, icDim, icLayout, icWorld, mutfakOda, mutfakBoy, mutfakStand, mutfakRota, mutfakDunya, mutfakIcine, mutfakVitrin, MUTFAK_YER, MUTFAK_NOKTA, IC_DUVAR, icIcinde, passAcik, passAsciUV, passGarsonNokta } from '../../src/content/ic-mekan';
import { MUTFAK_IST_BY_ID, mutfakEsya } from '../../src/content/mutfak';
import { BUFE } from '../../src/content/prefabs/iskele/layout';
import { buyumeEngel, gecitIcinde } from '../../src/game/view/world/bufe-buyume';

const ic = (st: number) => mutfakBoy(st).yari - IC_DUVAR;

describe('mutfak aşamayla büyür', () => {
  it('oda 3 -> 6 -> 9 genişler, ön duvar ve kapı yerinde kalır, en büyüğü IC_BY_ID kaydı', () => {
    const w = [3, 4, 5, 6, 7, 8, 9, 10].map(s => mutfakOda(s).wx);
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeGreaterThanOrEqual(w[i - 1]);
    expect(mutfakOda(3).wx).toBeLessThan(mutfakOda(6).wx); expect(mutfakOda(6).wx).toBe(mutfakOda(9).wx);   // 2026-11-25 ters U: aşama 6'da orta bandın tamamı
   
    expect(mutfakOda(10).wx).toBe(IC_BY_ID.mutfak.wx);
    for (const s of [3, 6, 9]) { const m = mutfakOda(s); expect(m.x).toBe(0); expect(m.z + m.wz / 2).toBeCloseTo(-13.0, 6); expect(icDim(m).D).toBe(icDim(IC_BY_ID.mutfak).D); }
  });
  it('her aşamada açık istasyonlar ve aşçı durakları o aşamanın odasının içinde', () => {
    for (let s = 3; s <= 10; s++) for (const id of mutfakEsya(s)) {
      const y = MUTFAK_YER[id]; expect(y, id).toBeTruthy();
      expect(Math.abs(y.u) + y.w / 2, id + '@' + s).toBeLessThanOrEqual(ic(s) + 1e-6);
      expect(MUTFAK_IST_BY_ID[id].stage).toBeLessThanOrEqual(s);
      expect(Math.abs(mutfakStand(id)[0]), id).toBeLessThan(ic(s));
    }
  });
  it('istasyonlar aynı hatta üst üste binmez ve kapı yolu (u=0, ön hat) boş', () => {
    const ids = Object.keys(MUTFAK_YER);
    for (const a of ids) for (const b of ids) {
      if (a >= b || MUTFAK_YER[a].sira !== MUTFAK_YER[b].sira) continue;
      const A = MUTFAK_YER[a], B = MUTFAK_YER[b]; expect(Math.abs(A.u - B.u) >= (A.w + B.w) / 2 - 1e-6, a + ' / ' + b).toBe(true);
    }
    for (const id of ids) if (MUTFAK_YER[id].sira === 'on') expect(Math.abs(MUTFAK_YER[id].u) - MUTFAK_YER[id].w / 2, id).toBeGreaterThan(0.85);
  });
  it('duvarlar odayla gider: aşama 3 duvarı ±4.6, aşama 6+ duvarsız; dışarısı yürünebilir', () => {
    const blocked = (s: number, x: number, z: number) => icColliders(IC_BY_ID.mutfak, s).some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    expect(blocked(3, 4.5, -15.2)).toBe(true); expect(blocked(3, 6.0, -15.2)).toBe(false);
    for (const s of [6, 9]) for (const x of [-8.45, 8.45]) expect(blocked(s, x, -15.2)).toBe(false);   // ters U: mutfağın yan duvarı yok
    for (const s of [3, 4, 5]) { expect(blocked(s, 0, -12.9)).toBe(false); expect(blocked(s, 2.5, -13.1)).toBe(true); }   // kapı açık, yanındaki ön duvar kapalı (tek giriş)
    const tags = buyumeEngel(3).filter(r => r.tag === 'buyume-bufemutfak'); expect(Math.max(...tags.map(r => r.x1))).toBeLessThanOrEqual(4.7);
  });
  it('hazırlık tezgâhları aşamayla çoğalır ve aşamanın rotası onların içinden geçmez', () => {
    for (const s of [3, 6, 9, 10]) {
      const sol = icLayout(IC_BY_ID.mutfak, s).filter(i => i.solid && (i.asama ?? 0) <= s);
      for (const i of sol) expect(Math.abs(i.u) + i.w / 2, 'hazirlik@' + s).toBeLessThan(ic(s));
      const box = sol.map(i => ({ u0: i.u - i.w / 2 - 0.2, u1: i.u + i.w / 2 + 0.2, v0: i.v - i.d / 2 - 0.2, v1: i.v + i.d / 2 + 0.2 }));
      const pts = mutfakEsya(s).map(mutfakStand).concat([MUTFAK_NOKTA.passAsci, [0, icDim(IC_BY_ID.mutfak).D / 2 - 0.4]]);
      for (const a of pts) for (const b of pts) { let c = a; for (const n of mutfakRota(a, b)) { for (let k = 0; k <= 20; k++) { const u = c[0] + (n[0] - c[0]) * k / 20, v = c[1] + (n[1] - c[1]) * k / 20; expect(Math.abs(u)).toBeLessThan(ic(s)); for (const r of box) expect(u > r.u0 && u < r.u1 && v > r.v0 && v < r.v1).toBe(false); } c = n; } }
    }
    const n = (s: number) => icLayout(IC_BY_ID.mutfak, s).filter(i => i.solid && (i.asama ?? 0) <= s).length; expect(n(3)).toBeLessThan(n(6)); expect(n(6)).toBeLessThan(n(9));
  });
  it('bekleme noktası odanın içine çekilir', () => { expect(mutfakIcine([-6.3, -0.7], 3)[0]).toBeGreaterThan(-ic(3)); expect(mutfakIcine([-6.3, -0.7], 9)[0]).toBe(-6.3); });
  it('ters U (2026-11-25): servis koridoru ve iç duvar yok, pass noktaları boş ve aşçı ile garson aynı tezgâhın iki yüzünde', () => {
    const pg = mutfakDunya(MUTFAK_NOKTA.passGarson); expect(gecitIcinde(pg)).toBe(true);
    for (const s of [6, 7, 9, 10]) {
      const eng = buyumeEngel(s), dolu = (x: number, z: number, p = 0.15) => eng.some(r => x > r.x0 - p && x < r.x1 + p && z > r.z0 - p && z < r.z1 + p);
      expect(eng.some(r => r.tag === 'buyume-servis' || r.tag === 'buyume-gecit')).toBe(false);
      for (const y of ['on', 'W', 'E'] as const) {
        if (!passAcik(y, s)) continue; const pa = mutfakDunya(passAsciUV(y)), gp = passGarsonNokta(y);
        expect(dolu(gp.x, gp.z), y + ' garson@' + s).toBe(false); expect(dolu(pa.x, pa.z), y + ' aşçı@' + s).toBe(false);
        expect(Math.abs(gp.x - pa.x)).toBeLessThan(0.01); expect(gp.z).toBeGreaterThan(pa.z);
      }
    }
    expect(passAcik('W', 5)).toBe(false); expect(passAcik('W', 6)).toBe(true); expect(passAcik('E', 6)).toBe(false); expect(passAcik('E', 7)).toBe(true);
  });
  it('pass penceresi büfe tezgâhının arkasında; garson noktası odanın dışında, yürüyüş yolunda; vitrin bölgesi büfeyi kapsar', () => {
    const pg = mutfakDunya(MUTFAK_NOKTA.passGarson), pa = mutfakDunya(MUTFAK_NOKTA.passAsci);
    expect(pg.x).toBeGreaterThan(BUFE.x0); expect(pg.x).toBeLessThan(BUFE.x1); expect(pg.z).toBeLessThan(BUFE.z0); expect(pg.z).toBeGreaterThan(-13.0);
    for (const s of [3, 6, 9]) { expect(icIcinde(mutfakOda(s), pg, 0)).toBe(false); expect(icIcinde(mutfakOda(s), pa, 0)).toBe(true); }
    expect(mutfakVitrin({ x: 0, z: -7.5 })).toBe(true); expect(mutfakVitrin(pg)).toBe(true); expect(mutfakVitrin({ x: -18, z: -5 })).toBe(false);
    const k = icWorld(IC_BY_ID.mutfak, 0, 0); expect(mutfakVitrin(k)).toBe(false);
  });
});
