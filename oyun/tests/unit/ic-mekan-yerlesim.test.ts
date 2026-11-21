// Görsel mantık denetimi (2026-11-21): iç mekân yerleşiminin geometrik kuralları. Kullanıcı: "çalışanlar tezgâhın arasında
// kağıt gibi sıkışmış, bu olmaz". Her işletme odasında: tezgâh arkasında personelin durduğu her nokta duvara / rafa / cihaza
// gömülmez, tezgâh hattının ucundan dolaşan giriş yolu hiçbir eşyanın içinden geçmez, kuyruk noktaları boştur, eşyalar duvarın
// içine taşmaz ve katı eşyalar iç içe geçmez.
import { describe, it, expect } from 'vitest';
import { IC_MEKANLAR, IC_BY_ID, IC_DUVAR, icDim, icLayout, icItemRect, icZeminEngeli, icYol, personelGeo, PERSONEL_R, type IcItem, type IcMekan } from '../../src/content/ic-mekan';

const ODALAR = ['kafe1', 'kafe2', 'okul', 'avm', 'tesis', 'kirtasiye', 'avm_moda', 'avm_tekno', 'avm_oyuncak'];
type R = { u0: number; u1: number; v0: number; v1: number };
const discRect = (u: number, v: number, r: R, rad: number) => { const du = Math.max(r.u0 - u, 0, u - r.u1), dv = Math.max(r.v0 - v, 0, v - r.v1); return Math.hypot(du, dv) - rad; };
function duvarlar(m: IcMekan): R[] {
  const { W, D } = icDim(m), t = IC_DUVAR, g = 1.7 / 2;
  return [{ u0: -W / 2, u1: W / 2, v0: -D / 2, v1: -D / 2 + t }, { u0: -W / 2, u1: -W / 2 + t, v0: -D / 2, v1: D / 2 }, { u0: W / 2 - t, u1: W / 2, v0: -D / 2, v1: D / 2 },
    { u0: -W / 2, u1: -g, v0: D / 2 - t, v1: D / 2 }, { u0: g, u1: W / 2, v0: D / 2 - t, v1: D / 2 }];
}
/** an obstacle list: walls + floor items (optionally skipping some) */
const engeller = (m: IcMekan, skip: (i: IcItem) => boolean = () => false) => [...duvarlar(m).map(r => ({ r, k: 'duvar' })), ...icLayout(m).filter(i => icZeminEngeli(i) && !skip(i)).map(i => ({ r: icItemRect(i), k: i.k }))];
function enYakin(m: IcMekan, u: number, v: number, rad: number, skip?: (i: IcItem) => boolean) {
  let best = { d: 9, k: '' }; for (const e of engeller(m, skip)) { const d = discRect(u, v, e.r, rad); if (d < best.d) best = { d, k: e.k }; } return best;
}

describe('iç mekân yerleşimi: personel tezgâh arkasında rahat durur', () => {
  for (const id of ODALAR) it(id, () => {
    const m = IC_BY_ID[id], g = personelGeo(m)!; expect(g).toBeTruthy();
    const pt = (a: number, b: number) => (g.vert ? { u: g.tz.u - b, v: a } : { u: a, v: g.tz.v + b });
    const kotu: string[] = [];
    for (let a = g.lo; a <= Math.max(g.lo, g.hi) + 1e-6; a += 0.2) {
      const p = pt(a, -g.arka), e = enYakin(m, p.u, p.v, PERSONEL_R);
      if (e.d < 0.02) kotu.push(`a=${a.toFixed(2)} ${e.k} ${e.d.toFixed(2)}`);
    }
    expect(kotu, `${id}: personel noktası bir şeye gömülü`).toEqual([]);
  });
});

describe('iç mekân yerleşimi: personel giriş yolu ve kuyruk boş', () => {
  for (const id of ODALAR) it(id, () => {
    const m = IC_BY_ID[id], g = personelGeo(m)!, { D } = icDim(m);
    const pt = (a: number, b: number) => (g.vert ? { u: g.tz.u - b, v: a } : { u: a, v: g.tz.v + b });
    const kotu: string[] = [];
    for (const hedef of [pt(g.lo, -g.arka), pt(g.hi, -g.arka)]) {
      const yol = [{ u: 0, v: D / 2 - 1.0 }, ...icYol(m, { u: 0, v: D / 2 - 1.0 }, hedef, 0.2)];
      const son = yol[yol.length - 1]; if (Math.hypot(son.u - hedef.u, son.v - hedef.v) > 0.01) kotu.push('yol yok');
      for (let s = 0; s < yol.length - 1; s++) for (let k = 0; k <= 20; k++) {
        const u = yol[s].u + (yol[s + 1].u - yol[s].u) * k / 20, v = yol[s].v + (yol[s + 1].v - yol[s].v) * k / 20, e = enYakin(m, u, v, 0.18);
        if (e.d < -0.02) { kotu.push(`yol${s} (${u.toFixed(2)},${v.toFixed(2)}) ${e.k} ${e.d.toFixed(2)}`); break; }
      }
    }
    // kuyruk: müşteriler tezgâhın önünde, b = +1.15
    for (let i = 0; i < 5; i++) { const a = g.cu + (g.vert ? 0 : 0.7) + i * (g.vert ? 0.5 : 0.6); if (g.vert && i > 2) break; const p = pt(a, 1.15), e = enYakin(m, p.u, p.v, 0.2); if (e.d < -0.02) kotu.push(`kuyruk${i} ${e.k} ${e.d.toFixed(2)}`); }
    expect(kotu, `${id}: yol / kuyruk bir eşyanın içinden geçiyor`).toEqual([]);
  });
});

describe('iç mekân yerleşimi: eşyalar duvara taşmaz, katı eşyalar iç içe geçmez', () => {
  for (const m of IC_MEKANLAR) it(m.id, () => {
    const { W, D } = icDim(m), lay = icLayout(m).filter(icZeminEngeli), kotu: string[] = [];
    for (const i of lay) { const r = icItemRect(i); if (Math.min(i.w, i.d) <= 0.25) continue; /* duvar panosu / kapı */ if (r.u0 < -W / 2 + IC_DUVAR - 0.03 || r.u1 > W / 2 - IC_DUVAR + 0.03 || r.v0 < -D / 2 + IC_DUVAR - 0.03 || r.v1 > D / 2 + 0.01) kotu.push(`duvar: ${i.k}`); }
    const solid = lay.filter(i => i.solid && !i.asama);
    for (let x = 0; x < solid.length; x++) for (let y = x + 1; y < solid.length; y++) {
      const a = icItemRect(solid[x]), b = icItemRect(solid[y]); const ou = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0), ov = Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0);
      if (ou > 0.02 && ov > 0.02) kotu.push(`iç içe: ${solid[x].k} + ${solid[y].k}`);
    }
    expect(kotu, m.id).toEqual([]);
  });
});
