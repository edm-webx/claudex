/** Pedestrian footbridge over the road (x = UG.x). One source for the view (stairs, deck), the hero/NPC height and the camera. */
/* 2026-11-08: the deck spans the whole carriageway (kerb z 15.0 .. far kerb 26.4) so no stair or pillar stands in a lane;
   the south flight lands on the promenade, the north flight on the far-side pavement.
   2026-11-20 (PRF-09): h is the deck's real top in WORLD metres (the street group is raised 0.35 m; the view cancels that
   for the bridge), so the flights start on the promenade (y 0) and the deck the hero walks on is the deck that is drawn. */
export const UG = { x: 24, hw: 1.15, zA: 8.4, zB: 14.6, zC: 26.8, zD: 33.0, h: 4.75 };
/** Steps per flight: 26 -> 18 cm rise, 24 cm going (a real stair, not a ladder). */
export const UG_STEPS = 26;
/** Walking surface height at (x, z): 0 off the bridge, a stair ramp on each flight, flat on the deck.
 *  The ramp passes through every step's front edge (nosing), so a foot on it is never inside a step: at most one rise above the tread. */
export function ugY(x: number, z: number): number {
  if (Math.abs(x - UG.x) > UG.hw + 0.2 || z <= UG.zA || z >= UG.zD) return 0;
  if (z < UG.zB) return UG.h * (z - UG.zA) / (UG.zB - UG.zA);
  if (z <= UG.zC) return UG.h;
  return UG.h * (1 - (z - UG.zC) / (UG.zD - UG.zC));
}
/** Tread top under (x, z) on a flight (the drawn step): step i spans from nosing i to nosing i+1 at height i * rise. */
export function ugTread(x: number, z: number): number {
  if (Math.abs(x - UG.x) > UG.hw + 0.2 || z <= UG.zA || z >= UG.zD) return 0;
  if (z >= UG.zB && z <= UG.zC) return UG.h;
  const t = z < UG.zB ? (z - UG.zA) / (UG.zB - UG.zA) : (UG.zD - z) / (UG.zD - UG.zC);
  return Math.floor(t * UG_STEPS + 1e-9) * UG.h / UG_STEPS;
}
/** True inside the bridge corridor rectangle (the hero height must be driven there). */
export const onUg = (x: number, z: number) => Math.abs(x - UG.x) <= UG.hw + 0.2 && z >= UG.zA - 0.5 && z <= UG.zD + 0.5;
/** Ground height for anything that walks (hero, workers, cats, crowd): the footbridge is the only raised walkway outdoors. */
export const zeminY = (x: number, z: number): number => (onUg(x, z) ? ugY(x, z) : 0);
