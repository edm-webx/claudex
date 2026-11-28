// Devlet Hastanesi içi (2026-11-28 sahip: "hastanenin içi de AVM gibi açılsın, çok detaylı olsun").
import { it, expect } from 'vitest';
import { played } from './m1-helpers';
import { HST, HST_DIS, HST_GIRIS_IC, ASANSOR, ODALAR, GISE, hstIcinde, hstEngel, hstYol, odaKapi, odaXZ } from '../../src/content/hastane-kat';
import { katY } from '../../src/content/avm-kat';
import { realmAt } from '../../src/content/realm';

const mk = () => { const sim = played(1) as any; sim.step(1); return { sim, S: sim.state, y: sim.rules.rt.agents.hastaneYasam }; };
const gir = (sim: any, kat = 0, x = HST.cx, z = 47) => { sim.command({ kind: 'teleport', x, z, kat }); sim.step(0.25); };
const yap = (sim: any, id: string) => { const it = sim.interactions.get(id); expect(it, id).toBeTruthy(); expect(it.canAct(sim.state.player), id).toBe(true); it.act(sim.state.player); };
const ic = (r: { x0: number; x1: number; z0: number; z1: number }[], p: { x: number; z: number }) => r.some(q => p.x > q.x0 && p.x < q.x1 && p.z > q.z0 && p.z < q.z1);

it('yerleşim: hastane ayrı âlem, 4 kat x 4 oda; oda kapıları ve iç/dış kapı noktaları engelsiz, her odaya merdivenden yol var', () => {
  expect(realmAt(HST.cx)?.id).toBe('hastane'); expect(realmAt(HST.cx)?.bus).toBe(false);
  expect(ODALAR).toHaveLength(16);
  for (let k = 0; k < HST.KAT; k++) expect(ODALAR.filter(o => o.kat === k)).toHaveLength(4);
  for (const o of ODALAR) {
    expect(o.esya.length, o.id).toBeGreaterThanOrEqual(5);
    const e = hstEngel(o.kat), d = odaKapi(o);
    expect(ic(e, d.ic), o.id + ' iç').toBe(false); expect(ic(e, d.dis), o.id + ' dış').toBe(false);
    if (!o.kapali) { const p = hstYol(0, HST_GIRIS_IC, o.kat, d.ic); expect(p.length, o.id).toBeGreaterThan(0); expect(p[p.length - 1].y).toBeCloseTo(katY(o.kat), 1); }
    for (const s of o.esya) { const p = odaXZ(o, s.u, s.v); expect(p.x > o.x0 - 0.01 && p.x < o.x1 + 0.01 && p.z > o.z0 - 0.01 && p.z < o.z1 + 0.01, o.id + ':' + s.k).toBe(true); }
  }
  for (const g of GISE) expect(ic(hstEngel(0), g.hasta)).toBe(false);
});

it('geçiş: iskeledeki kapıdan girer, girişten çıkar; asansör soldaki yukarı, sağdaki aşağı, uçlarda çalışmaz', () => {
  const { sim } = mk();
  sim.command({ kind: 'teleport', x: HST_DIS.x, z: HST_DIS.z }); sim.step(0.25); sim.step(0.25);
  expect(hstIcinde(sim.state.player)).toBe(true); expect(sim.state.player.kat || 0).toBe(0);
  sim.step(1.2);
  sim.command({ kind: 'teleport', x: HST.cx, z: HST.z0 - 0.4, kat: 0 }); sim.step(0.25);
  expect(hstIcinde(sim.state.player)).toBe(false); expect(Math.abs(sim.state.player.x - HST_DIS.x)).toBeLessThan(1);
  sim.step(1.2);
  const [yuk, asa] = ASANSOR;
  gir(sim, 0, yuk.x, yuk.z - 0.5); for (let i = 0; i < 5; i++) sim.step(0.25);
  expect(sim.state.player.kat).toBe(1);
  sim.step(1.3); gir(sim, 1, asa.x, asa.z - 0.5); for (let i = 0; i < 5; i++) sim.step(0.25);
  expect(sim.state.player.kat || 0).toBe(0);
  sim.step(1.3); gir(sim, 0, asa.x, asa.z - 0.5); for (let i = 0; i < 6; i++) sim.step(0.25);
  expect(sim.state.player.kat || 0).toBe(0);   // zemin katta aşağı inen çalışmaz
});

it('yaşam: girince her katta personel + hasta + ziyaretçi; yürüyorlar, hastanede ve kat yüksekliğinde kalıyorlar; çıkınca kalkar', () => {
  const { sim, y } = mk(); sim.command({ kind: 'setTime', hour: 11 });
  expect(y.rows()).toHaveLength(0);
  gir(sim);
  const r0 = y.rows(); expect(r0.length).toBeGreaterThanOrEqual(40);
  expect(new Set(r0.map((r: any) => r.kat)).size).toBe(HST.KAT);
  expect(r0.filter((r: any) => r.tip === 'personel').length).toBeGreaterThanOrEqual(25);
  const once = new Map(r0.map((r: any) => [r.key, r]));
  for (let i = 0; i < 80; i++) sim.step(0.25);
  const r1 = y.rows(); let yuruyen = 0;
  for (const r of r1) {
    const o: any = once.get(r.key); if (o && Math.hypot(r.x - o.x, r.z - o.z) > 0.5) yuruyen++;
    expect(hstIcinde(r, 1.6), JSON.stringify(r)).toBe(true);
    expect(r.y).toBeGreaterThanOrEqual(Math.max(0, katY(r.kat) - HST.FH) - 0.05); expect(r.y).toBeLessThanOrEqual(katY(HST.KAT - 1) + 0.7);
  }
  expect(yuruyen).toBeGreaterThan(8);
  sim.command({ kind: 'teleport', x: 20.15, z: 40 }); sim.step(0.25); expect(y.rows()).toHaveLength(0);
});

it('oyuncu: kayıt → muayene (30 ₺, günde bir) → eczane; kan bağışı bedava çay; başhekim tanışması', () => {
  const { sim, S } = mk(); S.money = 200; const t = S.tut;
  gir(sim, 0, GISE[0].hasta.x, GISE[0].hasta.z);
  const d = ODALAR.find(o => o.id === 'dahiliye')!;
  const muay = sim.interactions.get('hstMuayene'); expect(muay.canAct(sim.state.player)).toBe(false);   // başka kattayken olmaz
  yap(sim, 'hstKabul.1'); expect(t.hstKayit).toBe(S.day);
  gir(sim, 1, d.x0 + 6, d.z0 + 2); yap(sim, 'hstMuayene');
  expect(S.money).toBe(170); expect(t.hstMuayene).toBe(S.day);
  yap(sim, 'hstMuayene'); expect(S.money).toBe(170);   // aynı gün ikinci kez para almaz
  gir(sim, 0); yap(sim, 'hstEczane'); expect(t.hstIlac).toBe(S.day);
  gir(sim, 1); yap(sim, 'hstKan'); expect(t.hstCay).toBe(S.day);
  gir(sim, 0); const m = S.money; yap(sim, 'hstKafe'); expect(S.money).toBe(m);   // bağışçıya çay bedava
  gir(sim, 3); yap(sim, 'hstBashekim'); expect(t.hstBas).toBe(1);
});
