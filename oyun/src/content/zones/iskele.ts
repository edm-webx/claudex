/**
 * İskele zone (v2 pier) as a ZoneDef. Pure data: no three.
 * Static props are the v2 build() pieces as prefab placements; stations, tables and decor are placed by the world
 * view from GameState (they depend on stage and purchases) and their colliders go in through zones.setColliders.
 * Static anchors are the v2 W.anchors entries that do not depend on stage (spawn, benches, nextVenue); the world
 * view adds the stage-dependent ones (queue, counter, kasa, station.*, table.*, ferryWindow, jobCorner, pads, ...)
 * with the same names flattened as 'group.key.index'.
 * The portal at x = 62 (promenade end) leads to test-sokak, which continues the promenade eastwards.
 */
import type { ZoneDef, AnchorDef } from '../../engine/api';
import { BENCHES, benchSeats, NEXT_SIGN, SEAT_H } from '../prefabs/iskele/layout';

export const ISKELE_PLAYER_START = { x: 0.2, z: -2.6 };

function staticAnchors(): Record<string, AnchorDef> {
  const a: Record<string, AnchorDef> = {
    'spawn.0': { pos: { x: -60, z: 8.8 }, kind: 'spawn' },
    'spawn.1': { pos: { x: 60, z: 8.8 }, kind: 'spawn' },
    nextVenue: { pos: { x: NEXT_SIGN.x, z: NEXT_SIGN.z }, rotY: NEXT_SIGN.ry, kind: 'marker' },
    playerStart: { pos: { ...ISKELE_PLAYER_START }, kind: 'spawn' },
  };
  BENCHES.forEach((bn, i) => {
    a['benches.' + i] = { pos: { x: bn.pos.x, z: bn.pos.z }, rotY: bn.rotY, kind: 'bench' };
    benchSeats(bn).forEach((s, j) => { a['benches.' + i + '.seat.' + j] = { pos: { x: s.x, z: s.z }, y: SEAT_H, rotY: bn.rotY, kind: 'seat' }; });
  });
  return a;
}

export function iskeleZone(): ZoneDef {
  return {
    id: 'iskele',
    name: 'İskele',
    bounds: { x0: -62, z0: -14, x1: 62, z1: 14.3 },
    walk: { cell: 0.5, bake: true },
    props: [
      { id: 'sea', prefab: 'iskele.sea', pos: { x: 0, z: 0 } },
      { id: 'skyline', prefab: 'iskele.skyline', pos: { x: 0, z: 0 } },
      { id: 'boats', prefab: 'iskele.boats', pos: { x: 0, z: 0 } },
      { id: 'pier', prefab: 'iskele.pier', pos: { x: 0, z: 0 } },
      { id: 'kiosk', prefab: 'iskele.kiosk', pos: { x: 0, z: 0 }, overrides: { stage: 1, renewed: '' } },
      { id: 'ferry', prefab: 'iskele.ferry', pos: { x: 0, z: 0 } },
      { id: 'ferryFar', prefab: 'iskele.ferryFar', pos: { x: 0, z: 0 } },
      // stools that were inside the v2 kiosk batch (stage 1 counter stool, stage 2 door stool); the view hides the other stage's one
      { id: 'tabure-s1', prefab: 'iskele.tabure-kucuk', pos: { x: 2.95, z: -0.95 } },
      { id: 'tabure-s2', prefab: 'iskele.tabure', pos: { x: -5.0, z: -3.55 } },
    ],
    anchors: staticAnchors(),
    portals: [{ id: 'iskele>test-sokak', to: 'test-sokak', a: { x: 62, z: 4.85 }, b: { x: 62, z: 13.3 } }],
    ambience: { music: 'iskele', loops: ['deniz', 'marti'] },
    dressing: ['tex.cini', 'sky.panorama.day'],
    minState: 'sim',
    playerStart: { ...ISKELE_PLAYER_START },
  };
}

export const ISKELE_ZONE: ZoneDef = iskeleZone();
export default ISKELE_ZONE;
