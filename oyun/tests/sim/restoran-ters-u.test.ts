// 2026-11-25 ters U restoran: tek zemin, iç duvar yok; dış duvar, kapılar ve vapur geçidi; her masaya, alete ve istasyona yürünür;
// mutfak ve salon aletleri büfe istasyonu gibi çalışır (önüne git, hazırla, ürün eline gelsin).
import { describe, it, expect } from 'vitest';
import { kur } from './garson-yardimci';
import { KANAT_W, KANAT_E, kanatKapi, restoranDuvar } from '../../src/content/restoran-plan';
import { KANAT_MASALAR } from '../../src/content/kanat';
import { IC_BY_ID, icItemOn, icLayout, mutfakDunya, mutfakStand } from '../../src/content/ic-mekan';
import { SALON_ESYA } from '../../src/content/esya';
import { SALON_ALET } from '../../src/content/salon-alet';
import { MUTFAK_ISTASYON } from '../../src/content/mutfak';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dunya = (stage: number, esya: string[] = []) => { const k = kur() as any; k.sim.command({ kind: 'force', what: 'money', value: 2e9 }); k.sim.command({ kind: 'force', what: 'stage', value: stage }); (k.S.zones.salon ||= {}).esya = esya.slice(); k.step(1); return k; };
const dolu = (s: number, x: number, z: number) => restoranDuvar(s).some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);

describe('ters U plan', () => {
  it('dış duvar kapalı, kanat kapıları ve vapur geçidi açık, avlu kenarı açık', () => {
    for (const s of [7, 8, 10]) {
      expect(dolu(s, -18, -17.3)).toBe(true); expect(dolu(s, 0, -17.3)).toBe(true); expect(dolu(s, 15, -17.3)).toBe(true);
      expect(dolu(s, KANAT_W.x0 + 0.1, -8)).toBe(true); expect(dolu(s, KANAT_E.x1 - 0.1, -12)).toBe(true);
      expect(dolu(s, KANAT_E.x1 - 0.1, -7)).toBe(true);   // vapur kalktı: geçit kapalı
      for (const y of ['W', 'E'] as const) { expect(dolu(s, kanatKapi(y), 4.1)).toBe(false); expect(dolu(s, kanatKapi(y) + 3, 4.1)).toBe(true); }
      for (const z of [-11.5, -6.0, -3.0, 1.0]) { expect(dolu(s, KANAT_W.x1, z)).toBe(false); expect(dolu(s, KANAT_E.x0, z)).toBe(false); }
    }
    expect(restoranDuvar(5).length).toBe(0);
  });
  it('her açık masaya, alete ve istasyona yürünür (ızgara yolu)', () => {
    for (const s of [6, 7, 10]) {
      const k = dunya(s, SALON_ESYA.map(e => e.id)), nav = k.sim.nav, var_ = (p: { x: number; z: number }) => { const yol = nav.path({ x: 0, z: 6 }, p) as { x: number; z: number }[], son = yol?.[yol.length - 1]; return !!son && Math.hypot(son.x - p.x, son.z - p.z) < 0.75; };
      for (const m of KANAT_MASALAR) if (!m.cati && m.asama <= s) expect(var_({ x: m.x, z: m.z + 0.95 }), `masa ${m.bolge} ${m.x},${m.z}@${s}`).toBe(true);
      for (const e of SALON_ESYA) if (s >= e.asama) { const r = IC_BY_ID[e.salon === 'W' ? 'salonW' : 'salonE'], i = icLayout(r).find(q => q.esya === e.id)!; expect(var_(icItemOn(r, i)), e.id + '@' + s).toBe(true); }
      for (const i of MUTFAK_ISTASYON) if (i.stage <= s && i.islev === 'pisir') expect(var_(mutfakDunya(mutfakStand(i.id))), i.id + '@' + s).toBe(true);
    }
  }, 60000);
});

describe('büfe gibi istasyonlar', () => {
  it('mutfakta bilet yokken her pişirme istasyonunda durunca ürün ele gelir', () => {
    const k = dunya(10); for (const i of MUTFAK_ISTASYON) k.sim.command({ kind: 'mulk', op: 'mutfakAl', e: i.id }); k.step(1);
    for (const i of MUTFAK_ISTASYON.filter(q => q.islev === 'pisir')) {
      k.r.carry.length = 0; const p = mutfakDunya(mutfakStand(i.id)); k.sim.command({ kind: 'teleport', x: 0, z: 2 }); k.step(0.3); k.sim.command({ kind: 'teleport', x: p.x, z: p.z });
      let n = 0; k.step(18, () => (n = k.r.carry.length) > 0); expect(n, i.id).toBeGreaterThan(0);
    }
  }, 60000);
  it('alınan salon aleti kanatta istasyon olur: önünde durunca kendi yemeği ele gelir; alınmadan etkileşim yok', () => {
    const bos = dunya(10); expect(bos.sim.interactions.get('alet.mangal_e')).toBeUndefined();
    const k = dunya(10, SALON_ESYA.map(e => e.id)); k.step(1);
    for (const e of SALON_ESYA) {
      const A = SALON_ALET[e.id]; expect(A, e.id).toBeTruthy(); if (!A.yemek.length) continue;
      const it2 = k.sim.interactions.get('alet.' + e.id); expect(it2, e.id).toBeTruthy();
      k.r.carry.length = 0; k.sim.command({ kind: 'teleport', x: 0, z: 2 }); k.step(0.3); k.sim.command({ kind: 'teleport', x: it2.pos.x, z: it2.pos.z });
      let tip = ''; k.step(20, () => { tip = k.r.carry[0]?.type || ''; return !!tip; }); expect(A.yemek, e.id).toContain(tip);
    }
  }, 60000);
});
