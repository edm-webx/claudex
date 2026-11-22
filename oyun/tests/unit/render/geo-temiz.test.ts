// 2026-11-22 "merdivenin iskele tarafındaki ayağı full siyah yanıp sönüyor": sıfır uzunlukta normal = GPU'da NaN = bloom siyah blok.
import { describe, it, expect } from 'vitest';
import * as T from 'three';
import { dejenereAt, normalOnar, bozukNormalSay } from '../../../src/engine/render/geo-temiz';
import { stairSolid } from '../../../src/game/view/world/yol-look';
import { UG } from '../../../src/content/ustgecit';

describe('geo-temiz: bozuk normal kalmaz', () => {
  it('üst geçidin iki merdiven kolu (iskele kolu eskiden 54 bozuk köşe)', () => {
    for (const [z0, z1] of [[UG.zA, UG.zB], [UG.zD, UG.zC]]) {
      const g = stairSolid(z0, z1, UG.hw * 2 + 0.3);
      expect(bozukNormalSay(g)).toBe(0);
      expect(g.attributes.position.count).toBeGreaterThan(300);
    }
  });
  it('earcut sıfır alanlı kapak üçgeni üretince dejenereAt temizler, kapalı hacim aynı kalır', () => {
    // eski üst geçit iskele kolu profili (beta 7): 26 basamak, burunlar tek doğruda
    const N = 26, h = UG.h, rise = h / N, z0 = UG.zA, z1 = UG.zB, u1 = z0 + (z1 - z0) / N;
    const sh = new T.Shape(); sh.moveTo(u1, -0.02); sh.lineTo(u1, rise);
    for (let i = 2; i <= N; i++) { const u = z0 + (z1 - z0) * i / N; sh.lineTo(u, (i - 1) * rise); sh.lineTo(u, i * rise); }
    sh.lineTo(z1 + 0.02, h); sh.lineTo(z1 + 0.02, h - 0.3); sh.lineTo(z1, h - 0.3); sh.lineTo(z1, -0.02); sh.closePath();
    const ham = new T.ExtrudeGeometry(sh, { depth: 2.6, bevelEnabled: false, curveSegments: 1 });
    expect(bozukNormalSay(ham)).toBeGreaterThan(0);   // test gerçekten hatayı üretiyor
    const temiz = dejenereAt(ham);
    expect(bozukNormalSay(temiz)).toBe(0);
    const box = (g: T.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!.max.toArray().concat(g.boundingBox!.min.toArray()).map(v => +v.toFixed(4)); };
    expect(box(temiz)).toEqual(box(ham));
  });
  it('kapsül kutupları normalOnar ile yukarı/aşağı bakar', () => {
    expect(bozukNormalSay(new T.CapsuleGeometry(0.2, 0.45, 3, 7))).toBeGreaterThan(0);
    const g = normalOnar(new T.CapsuleGeometry(0.2, 0.45, 3, 7));
    expect(bozukNormalSay(g)).toBe(0);
  });
});
