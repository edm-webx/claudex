/** Pedestrian footbridge over the road (x = UG.x). One source for the view (stairs, deck) and the hero height. */
/* 2026-11-08: the deck spans the whole carriageway (kerb z 15.0 .. far kerb 26.4) so no stair or pillar stands in a lane;
   the south flight lands on the promenade, the north flight on the far-side pavement. */
export const UG = { x: 24, hw: 1.15, zA: 8.4, zB: 14.6, zC: 26.8, zD: 33.0, h: 4.4 };
/** Walking surface height at (x, z): 0 off the bridge, a stair ramp on each flight, flat on the deck. */
export function ugY(x: number, z: number): number {
  if (Math.abs(x - UG.x) > UG.hw + 0.2 || z <= UG.zA || z >= UG.zD) return 0;
  if (z < UG.zB) return UG.h * (z - UG.zA) / (UG.zB - UG.zA);
  if (z <= UG.zC) return UG.h;
  return UG.h * (1 - (z - UG.zC) / (UG.zD - UG.zC));
}
/** True inside the bridge corridor rectangle (the hero height must be driven there). */
export const onUg = (x: number, z: number) => Math.abs(x - UG.x) <= UG.hw + 0.2 && z >= UG.zA - 0.5 && z <= UG.zD + 0.5;
