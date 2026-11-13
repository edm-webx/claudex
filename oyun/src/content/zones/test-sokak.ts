/**
 * Çarşı Sokağı as a ZoneDef: the street east of the pier (x 62..132), reached from the promenade end.
 * The zone id stays 'test-sokak' because the streaming acceptance (world.spec) and the zone tests use it.
 * Walk paint and portal are unchanged: the street is walkable between the kerbs, the fronts block the sides.
 * Shopfronts, esnaf stalls and lamps come from content/carsi/street.ts; the view (view/carsi) adds the esnaf rigs.
 */
import type { ZoneDef, PrefabPlacement } from '../../engine/api';
import { placeFronts, streetAnchors, stallPlacements, X_START } from '../carsi/street';

const X0 = 62, X1 = 132, ZW0 = 4.85, ZW1 = 13.3;

function props(): PrefabPlacement[] {
  const out: PrefabPlacement[] = [{ id: 'ts-ground', prefab: 'ts.ground', pos: { x: (X0 + X1) / 2, z: 9 } }];
  out.push({ id: 'ts-gate', prefab: 'ts.gate', pos: { x: X0 + 1.5, z: (ZW0 + ZW1) / 2 } });
  const placed = placeFronts();
  for (const p of placed) {
    out.push({ id: (p.kind === 'filler' ? 'fill-' : 'front-') + p.id, prefab: 'carsi.front.' + p.id, pos: { x: p.cx, z: p.cz }, rotY: p.rotY });
  }
  out.push(...stallPlacements(placed));
  // lamp posts along both kerbs, between the fronts (x past the last front stays open for the portal)
  for (let k = 0, lx = X_START + 3; lx < X1 - 4; lx += 12, k++) out.push({ id: 'ts-lamp' + k, prefab: 'ts.lamp', pos: { x: lx, z: ZW1 - 0.5 } });
  return out;
}

export function testSokakZone(): ZoneDef {
  const placed = placeFronts();
  return {
    id: 'test-sokak',
    name: 'Çarşı Sokağı',
    bounds: { x0: X0, z0: 0, x1: X1, z1: 18 },
    walk: {
      cell: 0.5, bake: true,
      paint: [
        { rect: { x0: X0, x1: X1, z0: 0, z1: ZW0 }, cost: 0 },
        { rect: { x0: X0, x1: X1, z0: ZW1, z1: 18 }, cost: 0 },
        // east end open inside the band: Sahil Yolu ve Park continues there (content/zones/disari.ts)
      ],
    },
    props: props(),
    anchors: {
      'spawn.0': { pos: { x: X1 - 2, z: 9 }, kind: 'spawn' },
      portalIn: { pos: { x: X0 + 3, z: 9 }, kind: 'door' },
      end: { pos: { x: X1 - 4, z: 9 }, kind: 'marker' },
      ...streetAnchors(placed),
    },
    portals: [{ id: 'test-sokak>iskele', to: 'iskele', a: { x: X0, z: ZW0 }, b: { x: X0, z: ZW1 } }, { id: 'test-sokak>sahil', to: 'sahil', a: { x: X1, z: ZW0 }, b: { x: X1, z: ZW1 } }],
    ambience: { music: 'iskele', loops: [] },
    dressing: [],
    playerStart: { x: X0 + 3, z: 9 },
  };
}

export const TEST_SOKAK_ZONE: ZoneDef = testSokakZone();
export default TEST_SOKAK_ZONE;
