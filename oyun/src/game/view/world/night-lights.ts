/**
 * Real night lighting (2026-10-24 user: "gece aydınlatma sıfır, ışığın sadece görüntüsü var, ışık vermiyor").
 * The lamp bulbs and glow decals only looked lit; nothing on the ground, people or walls caught the light.
 * Decisions:
 * - A fixed pool of warm PointLights (count never changes, so three never recompiles the shaders) follows the camera
 *   focus: every 0.4 s each light takes one of the nearest lamp bulbs. Lamps are gathered from the iskele lamp posts,
 *   every 'ts.lamp' placement in every registered zone, and the büfe floresan.
 * - Brightness follows the time of day: off by day, fading in at dusk, full at night (tod.n).
 * - The büfe floresan gets a slightly cooler white so the kiosk reads as the bright heart of the pier.
 */
import * as T from 'three';
import type { ZoneManager, Vec2 } from '../../../engine/api';
import { todAt } from '../../../engine/render/tod';
import { LAMPS } from '../../../content/prefabs/iskele/pier';

export interface NightLights { update(focus: Vec2, hour: number): void; refresh(): void }

const POOL = 10, RANGE = 12, LAMP_I = 18, FLO_I = 22;

export function createNightLights(o: { scene: T.Scene; zones: ZoneManager | null }): NightLights {
  const lights: T.PointLight[] = [];
  for (let i = 0; i < POOL; i++) {
    const l = new T.PointLight('#ffcf8a', 0, RANGE, 1.6);
    l.castShadow = false; l.name = 'nightLight' + i; o.scene.add(l); lights.push(l);
  }
  let lamps: { x: number; y: number; z: number; flo?: boolean }[] = [];
  let pickT = 0, n = 0;
  function refresh(): void {
    const out: typeof lamps = [];
    for (const l of LAMPS as { x: number; y: number; z: number }[]) out.push({ x: l.x, y: l.y, z: l.z });
    const zs = o.zones;
    if (zs) for (const id of zs.ids()) {
      const d = zs.def(id); if (!d) continue;
      for (const p of d.props || []) if (p.prefab === 'ts.lamp') out.push({ x: p.pos.x, y: 3.2, z: p.pos.z });
    }
    out.push({ x: 0, y: 2.7, z: -7.4, flo: true });   // büfe floresan (kiosk interior)
    lamps = out;
  }
  refresh();
  function update(focus: Vec2, hour: number): void {
    const t = todAt(hour);
    const k = Math.max(0, Math.min(1, (t.n ?? 0)));
    if (k !== n) { n = k; for (const l of lights) l.visible = n > 0.02; }
    if (n <= 0.02) return;
    pickT -= 1 / 60;
    if (pickT <= 0 || lights[0].userData.i == null) {
      pickT = 0.4;
      if (!lamps.length) refresh();
      const near = lamps.map((l, i) => ({ i, d: (l.x - focus.x) ** 2 + (l.z - focus.z) ** 2 })).sort((a, b) => a.d - b.d).slice(0, POOL);
      lights.forEach((l, j) => {
        const c = near[j]; if (!c) { l.intensity = 0; return; }
        const p = lamps[c.i]; l.userData.i = c.i; l.userData.flo = !!p.flo;
        l.position.set(p.x, p.y - 0.15, p.z);
        l.color.set(p.flo ? '#fff4dc' : '#ffc77a');
      });
    }
    for (const l of lights) if (l.userData.i != null) l.intensity = (l.userData.flo ? FLO_I : LAMP_I) * n;
  }
  return { update, refresh };
}
