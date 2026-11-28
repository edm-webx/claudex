// PRF-09: üst geçit merdiveni. Görünen basamak yüzeyi (gerçek mesh, aşağı ışın) ile yürüme yüzeyi (ugY: kahraman, NPC, kamera)
// her noktada karşılaştırılır. Gömülme = ayak (ugY) çizilen bir yüzeyin altında kalır. Sınır: 2 cm (kaymaz şerit 1 cm).
import { describe, it, expect, beforeAll } from 'vitest';
import * as T from 'three';
import { yolSahnesi } from './yol-sahne';
import { UG, UG_STEPS, ugY, ugTread, zeminY, onUg } from '../../../src/content/ustgecit';
import { Walker } from '../../../src/game/sim/agents/move';
import { openNav } from '../../../src/game/headless';

let bridge: T.Object3D;
beforeAll(async () => { ({ bridge } = await yolSahnesi()); }, 30000);

const ray = new T.Raycaster();
/** Highest drawn bridge surface under (x, z) that is below `below` (rails at the edges are outside the sampled strip). */
function surfaceY(x: number, z: number, below: number): number {
  ray.set(new T.Vector3(x, below, z), new T.Vector3(0, -1, 0)); ray.far = below + 1;
  // ugInsaat (2026-11-21): the closed bridge's barriers stand ON the walk on purpose; this measures the open bridge (ugOrta drawn)
  const inInsaat = (o: T.Object3D | null): boolean => !!o && (o.name === 'ugInsaat' || inInsaat(o.parent));
  const hit = ray.intersectObject(bridge, true).find(h => h.point.y < below && !inInsaat(h.object));
  return hit ? hit.point.y : 0;
}

describe('üst geçit merdiveni (PRF-09)', () => {
  it('yürüme yüzeyi hiçbir noktada çizilen basamağın içinde değil, en çok bir basamak yüksekliği üstünde', () => {
    const rise = UG.h / UG_STEPS;
    let worstSink = 0, worstFloat = 0, n = 0;
    for (let z = UG.zA - 0.3; z <= UG.zD + 0.3; z += 0.02) for (const dx of [-0.7, -0.35, 0, 0.35, 0.7]) {
      const x = UG.x + dx, walk = ugY(x, z), drawn = surfaceY(x, z, walk + 1.5);
      worstSink = Math.max(worstSink, drawn - walk); worstFloat = Math.max(worstFloat, walk - drawn); n++;
    }
    expect(n).toBeGreaterThan(5000);
    expect(worstSink).toBeLessThanOrEqual(0.02);
    expect(worstFloat).toBeLessThanOrEqual(rise + 0.02);
  });
  it('köprü güvertesi kahramanın yürüdüğü yükseklikte (sokak grubunun 0,35 m kaldırması iptal)', () => {
    for (const z of [UG.zB + 0.5, (UG.zB + UG.zC) / 2, UG.zC - 0.5]) expect(Math.abs(surfaceY(UG.x, z, UG.h + 1.5) - UG.h)).toBeLessThan(0.005);
    expect(surfaceY(UG.x, UG.zA + 0.05, 1)).toBeLessThan(0.01);   // merdiven ayağı iskele zemininde (y 0), havada değil
  });
  it('basamak fonksiyonu çizilen basamakla aynı', () => {
    const go = (UG.zB - UG.zA) / UG_STEPS;
    for (let z = UG.zA + 0.01; z < UG.zB; z += 0.05) if (Math.abs(((z - UG.zA) / go) % 1) > 0.05 && Math.abs(((z - UG.zA) / go) % 1) < 0.95) expect(Math.abs(surfaceY(UG.x + 0.3, z, ugY(UG.x, z) + 1) - ugTread(UG.x, z))).toBeLessThan(0.015);
  });
  it('NPC yürüyücüsü merdivende aynı yüzeye basar, köprüden inince yere döner', () => {
    const a = { x: UG.x, z: UG.zA - 1, y: 0, rot: 0, speed: 0 } as unknown as ConstructorParameters<typeof Walker>[0];
    const w = new Walker(a, openNav());
    w.goTo({ x: UG.x, z: UG.zD + 1 });
    let maxErr = 0, top = 0;
    while (w.walk(1 / 30, 1.3)) { maxErr = Math.max(maxErr, Math.abs((a as { y: number }).y - zeminY(a.x, a.z))); top = Math.max(top, (a as { y: number }).y); }
    expect(maxErr).toBeLessThan(1e-9);
    expect(top).toBeCloseTo(UG.h, 5);
    expect((a as { y: number }).y).toBe(0);
    expect(onUg(UG.x, UG.zD + 0.6)).toBe(false);
  });
});
