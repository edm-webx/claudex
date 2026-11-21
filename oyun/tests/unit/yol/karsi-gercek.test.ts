// PRF-09 / S-098 / H-186: karşı yakada "sadece görüntü" nesne kalmasın. Boyu 1 m'yi geçen her yerleştirilmiş prefab gerçek
// bir nesnedir: yürüme ızgarasında çarpıştırıcısı vardır (içinden geçilmez), ya da tamamen GLB modeldir ve tabanı + iç mekan
// çarpıştırıcısı taşır. Eski harita artığı (yalnız parça, çarpıştırıcısız bina/duvar) bu testte kırmızı olur.
import { describe, it, expect } from 'vitest';
import { karsiPrefabs, karsiProps } from '../../../src/content/zones/karsi';

describe('karşı yaka: görüntü yalnız nesne yok (PRF-09)', () => {
  it('1 m üstü her prefabın çarpıştırıcısı var', () => {
    const defs = new Map(karsiPrefabs().map(d => [d.id, d]));
    const eksik: string[] = [];
    let n = 0;
    for (const p of karsiProps()) {
      const d = defs.get(p.prefab);
      expect(d, p.prefab).toBeTruthy();
      const top = Math.max(0, ...d!.parts.map(q => (q.pos?.[1] ?? 0) + (q.shape === 'box' ? q.size[1] / 2 : q.shape === 'cyl' ? q.size[1] / 2 : 0)));
      if (top <= 1 && !(d!.parts.length === 1 && d!.parts[0].name === 'base')) continue;
      n++;
      if (!d!.colliders || !d!.colliders.length) eksik.push(`${p.id} (${p.prefab}, ${top.toFixed(1)} m)`);
    }
    expect(n).toBeGreaterThan(30);
    expect(eksik).toEqual([]);
  });
  it('üst üste binen zemin şeritleri aynı düzlemde değil (z-fighting titremesi yok)', () => {
    const defs = new Map(karsiPrefabs().map(d => [d.id, d]));
    const planes = karsiProps().flatMap(p => (defs.get(p.prefab)?.parts ?? []).filter(q => q.shape === 'plane').map(q => ({ id: p.id, y: (q.pos?.[1] ?? 0), x0: p.pos.x - q.size[0] / 2, x1: p.pos.x + q.size[0] / 2, z0: p.pos.z - q.size[2] / 2, z1: p.pos.z + q.size[2] / 2 })));
    expect(planes.length).toBeGreaterThan(5);
    const cakisan: string[] = [];
    for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i], b = planes[j];
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), oz = Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
      if (ox > 0.01 && oz > 0.01 && Math.abs(a.y - b.y) < 0.003) cakisan.push(`${a.id} ↔ ${b.id}`);
    }
    expect(cakisan).toEqual([]);
  });
});
