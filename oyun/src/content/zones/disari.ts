/**
 * Martıköy neighbourhoods east of Çarşı Sokağı as ZoneDefs (survey disari-1..9, mekan-1..9): Sahil Yolu ve Park,
 * Yokuşlu Ara Sokaklar ve Merdivenler, Mahalle Meydanı ve Çeşme, Balıkçı Barınağı. Pure data + part-only prefabs.
 * - Seamless: every zone keeps the street band z 4.85..13.3 open at its west/east edges (portals there), so the
 *   player walks from the street straight into the park and on to the harbour. Bounds never overlap in x.
 * - Walk grids bake from prop colliders; paint blocks the sea, the house rows and the outer edges.
 * - Locked regions are handled by the sim (sim/disari.ts pushes Sabri back at the region edge) and the view draws
 *   the "Islak boya" barrier; the zone defs themselves never change.
 * - The ferris wheel, night lights, labels and the guide cat are view-owned (view/disari).
 * Registered by registerDisariZones() from the world view (same pattern as test-sokak).
 */
import type { ZoneDef, PrefabDef, PrefabPlacement, PartDef, Rect } from '../../engine/api';
import { BAND, REGION_BY_ID, SIDE_SHOPS, SIGNS, type RegionId } from '../disari/martikoy';

const WATER_Y = -1.05;
const Z0 = BAND.z0, Z1 = BAND.z1;
type Def = PrefabDef;

/* ---------------- prefabs ---------------- */
const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, name?: string): PartDef => ({ shape: 'box', size: [w, h, d], pos: [x, y, z], color, name });
const cyl = (rt: number, h: number, rb: number, x: number, y: number, z: number, color: string, seg = 10): PartDef => ({ shape: 'cyl', size: [rt, h, rb], pos: [x, y, z], color, segments: seg });
const sph = (r: number, x: number, y: number, z: number, color: string, seg = 10): PartDef => ({ shape: 'sphere', size: [r, 0, 0], pos: [x, y, z], color, segments: seg });
const plane = (w: number, d: number, y: number, color: string, name?: string): PartDef => ({ shape: 'plane', size: [w, 0, d], pos: [0, y, 0], color, name });
const R = (w: number, d: number, ox = 0, oz = 0): Rect => ({ x0: ox - w / 2, x1: ox + w / 2, z0: oz - d / 2, z1: oz + d / 2 });

function house(id: string, w: number, h: number, d: number, wall: string, roof: string, face: 1 | -1, extra: PartDef[] = []): Def {
  const fz = face * (d / 2 + 0.03);
  const parts: PartDef[] = [
    box(w, h, d, 0, h / 2, 0, wall, 'wall'),
    { shape: 'box', size: [w + 0.4, 0.3, d + 0.4], pos: [0, h + 0.15, 0], color: roof, name: 'roof' },
    box(0.95, 2.0, 0.06, w / 2 - 1.0, 1.0, fz, '#6b4a2e', 'door'),
    box(0.9, 0.9, 0.06, -w / 4, h * 0.42, fz, '#9cc3d6', 'win0'),
    box(0.9, 0.9, 0.06, -w / 4, h * 0.75, fz, '#9cc3d6', 'win1'),
    box(0.9, 0.9, 0.06, w / 4 - 0.6, h * 0.75, fz, '#9cc3d6', 'win2'),
    box(1.2, 0.18, 0.4, -w / 4, h * 0.42 - 0.55, face * (d / 2 + 0.2), '#d85a5a', 'pots'),
    ...extra,
  ];
  return { id, parts, colliders: [R(w, d)] };
}

function kulube(id: string, color: string, sign: string): Def {
  return {
    id, parts: [
      box(2.4, 2.2, 2.0, 0, 1.1, 0, '#f6efe1', 'body'),
      box(2.6, 0.18, 2.2, 0, 2.3, 0, color, 'roof'),
      box(2.0, 0.5, 0.08, 0, 1.95, 1.05, sign, 'sign'),
      box(2.6, 0.1, 0.9, 0, 1.75, 1.45, color, 'awning'),
      box(2.2, 0.95, 0.5, 0, 0.48, 1.2, '#9a6a42', 'counter'),
    ], colliders: [R(2.4, 2.6, 0, 0.3)],
  };
}

export function disariPrefabs(): PrefabDef[] {
  const defs: Def[] = [];
  const g = (id: string, w: number, d: number, color: string, y = 0.012) => defs.push({ id, parts: [plane(w, d, y, color, 'ground')] });
  // grounds
  g('mk.ground.prom', 64, 7.4, '#d9cdb6'); g('mk.ground.grass', 64, 14.5, '#9cc77a', 0.014);
  g('mk.ground.band48', 48, 8.6, '#d5c8b0'); g('mk.ground.square', 48, 22, '#dccdb0');
  g('mk.ground.quay', 52, 13, '#cbbfa8');
  defs.push({ id: 'mk.water64', parts: [plane(64, 12, WATER_Y, '#3f8fbf', 'water'), box(64, 1.0, 0.35, 0, -0.5, 6.0, '#b9ad99', 'seawall')] });
  defs.push({ id: 'mk.water52', parts: [plane(52, 16, WATER_Y, '#3f8fbf', 'water'), box(52, 1.0, 0.35, 0, -0.5, 8.0, '#b9ad99', 'seawall')] });
  // railing segment (8 m) on the sea wall
  const rail: PartDef[] = [box(8, 0.07, 0.07, 0, 0.95, 0, '#2f6f9a'), box(8, 0.06, 0.06, 0, 0.55, 0, '#2f6f9a')];
  for (let i = 0; i <= 4; i++) rail.push(box(0.09, 1.0, 0.09, -4 + i * 2, 0.5, 0, '#2f6f9a'));
  defs.push({ id: 'mk.rail', parts: rail });
  // trees, benches, hedges, pots
  defs.push({ id: 'mk.tree', parts: [cyl(0.14, 1.6, 0.2, 0, 0.8, 0, '#7d5638', 7), sph(1.05, 0, 2.2, 0, '#6fae55', 9), sph(0.75, 0.45, 2.85, 0.2, '#86c266', 8)], colliders: [R(0.5, 0.5)] });
  defs.push({ id: 'mk.tree.pine', parts: [cyl(0.12, 1.2, 0.16, 0, 0.6, 0, '#6b4a2e', 6), cyl(0, 2.6, 1.1, 0, 2.3, 0, '#3f8a5a', 8)], colliders: [R(0.5, 0.5)] });
  defs.push({ id: 'mk.cinar', parts: [cyl(0.45, 3.0, 0.62, 0, 1.5, 0, '#8a6a4a', 9), sph(2.6, 0, 4.6, 0, '#5f9e48', 10), sph(1.9, 1.6, 5.4, 0.8, '#76b55a', 9), sph(1.7, -1.5, 5.0, -0.6, '#6aa94f', 9)], colliders: [R(1.4, 1.4)] });
  defs.push({ id: 'mk.bench', parts: [box(1.8, 0.08, 0.5, 0, 0.45, 0, '#b07a48'), box(1.8, 0.45, 0.08, 0, 0.72, -0.24, '#b07a48'), box(0.08, 0.45, 0.45, -0.8, 0.22, 0, '#3b3b3b'), box(0.08, 0.45, 0.45, 0.8, 0.22, 0, '#3b3b3b')], colliders: [R(1.8, 0.55)] });
  defs.push({ id: 'mk.hedgeZ', parts: [box(0.9, 1.1, 11, 0, 0.55, 0, '#5c9a48'), sph(0.35, 0, 1.15, -3, '#e78fb3', 6), sph(0.35, 0, 1.15, 2, '#ffd23f', 6)], colliders: [R(0.9, 11)] });
  defs.push({ id: 'mk.hedgeX', parts: [box(10, 1.0, 0.9, 0, 0.5, 0, '#5c9a48')], colliders: [R(10, 0.9)] });
  defs.push({ id: 'mk.pots', parts: [cyl(0.25, 0.4, 0.2, -0.5, 0.2, 0, '#c2551f', 8), sph(0.28, -0.5, 0.55, 0, '#e0533c', 7), cyl(0.25, 0.4, 0.2, 0.3, 0.2, 0.1, '#c2551f', 8), sph(0.28, 0.3, 0.55, 0.1, '#f3e05a', 7)] });
  // signs and stops
  defs.push({ id: 'mk.sign', parts: [box(0.14, 2.4, 0.14, 0, 1.2, 0, '#7d5638'),
    { shape: 'extrude', size: [0, 0, 0.08], pos: [0.05, 1.95, -0.04], color: '#c9955c', points: [[0, -0.2], [1.1, -0.2], [1.4, 0], [1.1, 0.2], [0, 0.2]] },
    { shape: 'extrude', size: [0, 0, 0.08], pos: [-0.05, 1.5, -0.04], color: '#b07a48', points: [[0, -0.2], [-1.1, -0.2], [-1.4, 0], [-1.1, 0.2], [0, 0.2]] }], colliders: [R(0.3, 0.3)] });
  defs.push({ id: 'mk.stop', parts: [box(0.1, 2.6, 0.1, 0, 1.3, 0, '#3b3b3b'), box(0.9, 0.6, 0.06, 0, 2.5, 0, '#f2c230'), box(0.7, 0.14, 0.07, 0, 2.5, 0.01, '#2b2b2b'),
    box(1.6, 0.08, 0.45, 0.9, 0.45, 0.2, '#5a7ea8'), box(1.6, 0.06, 0.6, 0.9, 2.2, 0.2, '#5a7ea8')], colliders: [R(0.3, 0.3)] });
  // side shop kiosks
  for (const s of SIDE_SHOPS) defs.push(kulube('mk.shop.' + s.id, s.color, '#fff6e6'));
  // sahil places
  defs.push({ id: 'mk.lunapark', parts: [box(8, 0.3, 5, 0, 0.15, 0, '#e8d6b8'), box(0.4, 7.2, 0.4, -1.2, 3.6, 0, '#e0533c'), box(0.4, 7.2, 0.4, 1.2, 3.6, 0, '#e0533c'),
    box(1.8, 2.0, 1.4, 3.0, 1.0, 1.6, '#ffd23f', 'gise'), box(2.0, 0.2, 1.6, 3.0, 2.1, 1.6, '#e0533c'), cyl(1.3, 0.4, 1.3, -2.6, 0.35, 1.2, '#7cc4e4', 12), cyl(0.06, 1.8, 0.06, -2.6, 1.2, 1.2, '#f6efe1', 6), cyl(0, 0.8, 1.4, -2.6, 2.4, 1.2, '#e78fb3', 12)],
    colliders: [R(8, 5)] });
  const chairs: PartDef[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) chairs.push(box(0.5, 0.5, 0.5, -3 + c * 1.2, 0.25, -3.6 + r * 1.1, c % 2 ? '#e0533c' : '#2f6f9a'));
  defs.push({ id: 'mk.sinema', parts: [box(0.25, 5, 0.25, -4.2, 2.5, 1.4, '#3b3b3b'), box(0.25, 5, 0.25, 4.2, 2.5, 1.4, '#3b3b3b'), box(8.4, 3.6, 0.1, 0, 3.0, 1.4, '#f4f4f0', 'screen'), box(1.4, 1.2, 1.2, 0, 0.6, -6.2, '#5a3a2a', 'projector'), ...chairs],
    colliders: [R(8.8, 0.6, 0, 1.4), R(1.4, 1.2, 0, -6.2)] });
  defs.push({ id: 'mk.oltaci', parts: [box(0.5, 0.45, 0.5, 0, 0.22, 0, '#5a7ea8'), cyl(0.22, 0.4, 0.18, 0.6, 0.2, 0, '#e0533c', 8), cyl(0.02, 2.4, 0.03, 0.2, 1.2, -0.6, '#3b2a20', 4)] });
  // yokuş: rainbow stairs (flat slabs, walk is flat) + retaining walls
  const stairs: PartDef[] = [];
  const rb = ['#e0533c', '#f08a3c', '#ffd23f', '#8fd06b', '#5aa9d6', '#8c5a9a'];
  for (let i = 0; i < 18; i++) stairs.push(box(0.55, 0.02 + (i % 3) * 0.015, 5.6, -5 + i * 0.6, 0.02, 0, rb[i % rb.length]));
  stairs.push(box(11, 0.6, 0.25, 0, 0.3, 3.0, '#b9ad99'), box(11, 0.6, 0.25, 0, 0.3, -3.0, '#b9ad99'));
  for (let i = 0; i < 6; i++) stairs.push(box(0.05, 0.9, 0.05, -5 + i * 2, 0.75, 2.9, '#3b3b3b'));
  stairs.push(box(11, 0.05, 0.06, 0, 1.2, 2.9, '#3b3b3b'));
  defs.push({ id: 'mk.stairs', parts: stairs });
  defs.push(house('mk.house.y1', 7, 6, 5, '#f2d6b3', '#a8553d', -1)); defs.push(house('mk.house.y2', 6, 8, 5, '#d6e6c8', '#7e8b8f', -1));
  defs.push(house('mk.house.y3', 7, 10, 5, '#f6c9c0', '#a8553d', -1)); defs.push(house('mk.house.y4', 6, 5, 5, '#cfe0ef', '#6b5a4a', 1));
  defs.push(house('mk.house.y5', 8, 6.5, 5, '#f3e3b6', '#a8553d', 1)); defs.push(house('mk.house.y6', 6, 7.5, 5, '#e9d3ef', '#7e8b8f', 1));
  defs.push(house('mk.kutuphane', 10, 7, 5, '#efe6d6', '#5a7ea8', -1, [box(8, 0.6, 0.1, 0, 5.4, -2.56, '#2f4a6b', 'sign'), box(0.4, 4, 0.4, -3, 2, -2.7, '#f6efe1'), box(0.4, 4, 0.4, 3, 2, -2.7, '#f6efe1')]));
  defs.push(house('mk.hamam', 10, 4.5, 5, '#f6f1e7', '#c9c0b0', 1, [sph(2.6, 0, 4.6, 0, '#f4f2ee', 14), sph(0.9, -3.6, 4.6, 0, '#f4f2ee', 10), sph(0.9, 3.6, 4.6, 0, '#f4f2ee', 10), box(6, 0.55, 0.1, 0, 3.7, 2.56, '#3fb5b0', 'sign')]));
  // meydan
  defs.push({ id: 'mk.cesme', parts: [box(2.0, 2.4, 1.0, 0, 1.2, 0, '#e9e1d0'), box(1.6, 0.25, 1.2, 0, 2.5, 0, '#c9bfa8'), cyl(1.2, 0.5, 1.3, 0, 0.25, 1.0, '#cfc6b6', 14), plane(1.9, 1.1, 0.48, '#7cc4e4'),
    cyl(0.05, 0.3, 0.05, 0, 1.2, 0.6, '#b08a3a', 6)], colliders: [R(2.6, 3.2, 0, 0.6)] });
  defs.push(house('mk.kiraathane', 11, 5, 5, '#f3e3c3', '#7d5638', -1, [box(11.4, 0.12, 1.6, 0, 2.6, -3.2, '#2e7d4f', 'awning'), box(9, 0.6, 0.1, 0, 3.8, -2.56, '#7d1f1f', 'sign')]));
  const tables: PartDef[] = [];
  for (let i = 0; i < 4; i++) { tables.push(cyl(0.45, 0.06, 0.45, -4.5 + i * 3, 0.75, 0, '#f6efe1', 10), cyl(0.05, 0.75, 0.08, -4.5 + i * 3, 0.37, 0, '#3b3b3b', 6), box(0.5, 0.06, 0.4, -4.5 + i * 3, 0.78, 0, '#7d5638')); }
  defs.push({ id: 'mk.tavla', parts: tables });
  defs.push(house('mk.house.m1', 9, 6, 4, '#f2d6b3', '#a8553d', 1)); defs.push(house('mk.house.m2', 10, 7, 4, '#d6e6c8', '#7e8b8f', 1));
  defs.push(house('mk.house.m3', 9, 5.5, 4, '#cfe0ef', '#a8553d', -1)); defs.push(house('mk.house.m4', 10, 6.5, 4, '#f6c9c0', '#6b5a4a', -1));
  defs.push({ id: 'mk.simitcart', parts: [box(1.6, 0.7, 0.9, 0, 0.75, 0, '#c2551f'), box(1.7, 0.08, 1.0, 0, 1.14, 0, '#f3e3b6'), cyl(0.28, 0.06, 0.28, 0, 0.32, 0.5, '#3b3b3b', 10),
    ...[0, 1, 2, 3].map(i => ({ shape: 'cyl', size: [0.16, 0.06, 0.16], pos: [-0.5 + i * 0.33, 1.22, 0], color: '#d9822b', segments: 10 }) as PartDef), box(1.8, 0.08, 1.1, 0, 2.0, 0, '#ffd23f'), box(0.05, 0.9, 0.05, 0.75, 1.55, 0.45, '#3b3b3b')],
    colliders: [R(1.6, 1.0)] });
  defs.push({ id: 'mk.bayrak', parts: [box(0.08, 6, 0.08, 0, 3, 0, '#c9c0b0'), box(1.6, 1.0, 0.03, 0.82, 5.4, 0, '#e0533c')], colliders: [R(0.3, 0.3)] });
  // barınak
  defs.push({ id: 'mk.jetty', parts: [box(3, 0.2, 10, 0, -0.1, 0, '#a07a50'), ...[-4, -1, 2, 4.6].flatMap(z => [cyl(0.12, 1.6, 0.12, -1.4, -0.7, z, '#6b4a2e', 6), cyl(0.12, 1.6, 0.12, 1.4, -0.7, z, '#6b4a2e', 6)])] });
  const boat = (c1: string, c2: string): PartDef[] => [box(1.4, 0.5, 4.2, 0, WATER_Y + 0.35, 0, c1), box(1.2, 0.08, 3.8, 0, WATER_Y + 0.62, 0, c2), box(0.5, 0.4, 0.8, 0, WATER_Y + 0.85, -0.6, '#f6efe1'), cyl(0.03, 1.6, 0.03, 0, WATER_Y + 1.4, 0.8, '#6b4a2e', 4)];
  defs.push({ id: 'mk.boat.a', parts: boat('#fbfaf6', '#2f6f9a') }); defs.push({ id: 'mk.boat.b', parts: boat('#3fb5b0', '#fbfaf6') }); defs.push({ id: 'mk.boat.c', parts: boat('#e0533c', '#f3e3b6') });
  defs.push(house('mk.shed.a', 7, 3.6, 4, '#c9b28a', '#5a7ea8', -1)); defs.push(house('mk.shed.b', 6, 3.4, 4, '#8fb3c9', '#7d5638', -1));
  defs.push({ id: 'mk.hali', parts: [box(12, 0.25, 6, 0, 3.4, 0, '#5a7ea8', 'roof'), ...[-5.6, 0, 5.6].flatMap(x => [box(0.3, 3.4, 0.3, x, 1.7, -2.8, '#e9e4da'), box(0.3, 3.4, 0.3, x, 1.7, 2.8, '#e9e4da')]),
    box(10, 0.8, 1.2, 0, 0.4, -1.8, '#e9e4da', 'counter'), box(9.6, 0.1, 1.0, 0, 0.84, -1.8, '#bfe6e9', 'ice'), box(8, 0.6, 0.08, 0, 3.0, -2.95, '#f6efe1', 'sign')], colliders: [R(12, 6)] });
  defs.push({ id: 'mk.netrack', parts: [box(0.1, 1.8, 0.1, -1.5, 0.9, 0, '#6b4a2e'), box(0.1, 1.8, 0.1, 1.5, 0.9, 0, '#6b4a2e'), box(3.1, 1.3, 0.04, 0, 1.15, 0, '#d8c39a'), sph(0.12, -0.8, 0.6, 0.05, '#e0533c', 6), sph(0.12, 0.6, 0.7, 0.05, '#e0533c', 6)], colliders: [R(3.2, 0.4)] });
  defs.push({ id: 'mk.crates', parts: [box(0.7, 0.5, 0.5, 0, 0.25, 0, '#a07a50'), box(0.7, 0.5, 0.5, 0.1, 0.75, 0.05, '#b08a5a'), box(0.7, 0.5, 0.5, 0.8, 0.25, 0, '#9a6a42')], colliders: [R(1.5, 0.6, 0.4, 0)] });
  defs.push({ id: 'mk.fener', parts: [box(3, 1.2, 3, 0, WATER_Y + 0.6, 0, '#8a8478'), cyl(0.6, 5, 0.75, 0, 2.5, 0, '#e0533c', 12), cyl(0.62, 0.6, 0.62, 0, 1.6, 0, '#fbfaf6', 12), cyl(0.62, 0.6, 0.62, 0, 3.4, 0, '#fbfaf6', 12), sph(0.5, 0, 5.4, 0, '#fff1c0', 10)] });
  defs.push({ id: 'mk.rocks', parts: [0, 1, 2, 3, 4, 5].map(i => sph(0.9 + (i % 3) * 0.2, -6 + i * 2.4, WATER_Y + 0.3, (i % 2) * 0.5, '#8a8478', 6)) });
  defs.push({ id: 'mk.wallZ', parts: [box(0.6, 1.4, 8, 0, 0.7, 0, '#cbbfa8')], colliders: [R(0.6, 8)] });
  // ───── 2026-10-24 açık dünya: new districts ─────
  g('mk.ground.night', 48, 30, '#4a4560'); g('mk.ground.pitchzone', 60, 34, '#b9c4ae'); g('mk.ground.yard', 56, 30, '#b8b0a2');
  g('mk.ground.tile', 40, 30, '#d9dde3'); g('mk.ground.forest', 52, 34, '#7fae63', 0.014); g('mk.ground.island', 60, 26, '#e3d3a8');
  defs.push({ id: 'mk.water60', parts: [plane(60, 16, WATER_Y, '#3f8fbf', 'water'), box(60, 1.0, 0.35, 0, -0.5, 8.0, '#b9ad99', 'seawall')] });
  // gece pazarı: stalls with lanterns and a string of bulbs
  const stall = (id: string, awn: string, goods: string[]): Def => ({ id, parts: [
    box(2.6, 0.9, 1.2, 0, 0.45, 0, '#8a6a4a', 'counter'), box(2.8, 0.08, 1.6, 0, 2.3, 0.1, awn, 'awning'),
    box(0.08, 2.3, 0.08, -1.3, 1.15, -0.55, '#3b2a20'), box(0.08, 2.3, 0.08, 1.3, 1.15, -0.55, '#3b2a20'), box(0.08, 2.3, 0.08, -1.3, 1.15, 0.75, '#3b2a20'), box(0.08, 2.3, 0.08, 1.3, 1.15, 0.75, '#3b2a20'),
    ...goods.map((c, i) => sph(0.16, -0.9 + i * 0.45, 1.02, 0.1, c, 7)),
    sph(0.14, -1.0, 2.0, 0.8, '#ffcf6a', 8), sph(0.14, 1.0, 2.0, 0.8, '#ff9a5a', 8),
  ], colliders: [R(2.8, 1.4)] });
  defs.push(stall('mk.stall.a', '#e0533c', ['#ffd23f', '#e0533c', '#8fd06b', '#f08a3c'])); defs.push(stall('mk.stall.b', '#3fb5b0', ['#f6efe1', '#c94f6d', '#5aa9d6', '#ffd23f']));
  defs.push(stall('mk.stall.c', '#8c5a9a', ['#d9822b', '#f3e3b6', '#6e2c00', '#e78fb3'])); defs.push(stall('mk.stall.d', '#f2c230', ['#3b2a20', '#e0533c', '#7d3c98', '#2f6f9a']));
  const bulbs: PartDef[] = [box(24, 0.03, 0.03, 0, 3.2, 0, '#2b2b2b')];
  for (let i = 0; i < 16; i++) bulbs.push(sph(0.1, -11.5 + i * 1.53, 3.05, 0, ['#ffd23f', '#e0533c', '#5aa9d6', '#8fd06b'][i % 4], 6));
  defs.push({ id: 'mk.bulbs', parts: [box(0.1, 3.3, 0.1, -12, 1.65, 0, '#3b3b3b'), box(0.1, 3.3, 0.1, 12, 1.65, 0, '#3b3b3b'), ...bulbs] });
  // stadyum: pitch, goals, stands, floodlight towers, halı saha cage
  const pitch: PartDef[] = [plane(30, 18, 0.02, '#4f9e4a', 'grass'), plane(30, 0.12, 0.03, '#f6f6f0'), plane(0.12, 18, 0.03, '#f6f6f0'), plane(0.12, 18, 0.03, '#f6f6f0')];
  pitch[2].pos = [-15, 0.03, 0]; pitch[3].pos = [15, 0.03, 0]; pitch[1].pos = [0, 0.03, -9];
  pitch.push({ ...plane(30, 0.12, 0.03, '#f6f6f0'), pos: [0, 0.03, 9] }, { ...plane(0.12, 18, 0.031, '#f6f6f0'), pos: [0, 0.031, 0] }, cyl(2.4, 0.02, 2.4, 0, 0.025, 0, '#58a653', 24));
  for (const sx of [-1, 1]) pitch.push(box(0.1, 2.2, 0.1, sx * 15, 1.1, -3.6, '#f6f6f0'), box(0.1, 2.2, 0.1, sx * 15, 1.1, 3.6, '#f6f6f0'), box(0.1, 0.1, 7.3, sx * 15, 2.2, 0, '#f6f6f0'), box(1.6, 2.2, 7.3, sx * 15.8, 1.1, 0, '#e8eef0'));
  defs.push({ id: 'mk.pitch', parts: pitch, colliders: [R(1.8, 7.4, -15.8, 0), R(1.8, 7.4, 15.8, 0)] });
  const stand: PartDef[] = [];
  for (let r = 0; r < 4; r++) stand.push(box(30, 0.5, 1.0, 0, 0.25 + r * 0.5, r * 1.0, r % 2 ? '#e0533c' : '#2f6f9a'));
  stand.push(box(30.6, 0.2, 4.6, 0, 3.6, 1.6, '#f6efe1', 'roof'), box(0.2, 3.6, 0.2, -15, 1.8, 3.6, '#7a8a90'), box(0.2, 3.6, 0.2, 15, 1.8, 3.6, '#7a8a90'), box(10, 0.9, 0.1, 0, 4.1, -0.6, '#58b368', 'sign'));
  defs.push({ id: 'mk.stand', parts: stand, colliders: [R(30, 4.2, 0, 1.6)] });
  defs.push({ id: 'mk.flood', parts: [box(0.3, 9, 0.3, 0, 4.5, 0, '#7a8a90'), box(2.2, 1.2, 0.3, 0, 9.2, 0, '#3b3b3b'), ...[-0.7, 0, 0.7].flatMap(x => [sph(0.24, x, 9.4, 0.2, '#fff1c0', 7), sph(0.24, x, 8.9, 0.2, '#fff1c0', 7)])], colliders: [R(0.5, 0.5)] });
  const cage: PartDef[] = [plane(14, 9, 0.025, '#3fa34d', 'grass')];
  for (const [w, d, x, z] of [[14, 0.06, 0, -4.5], [14, 0.06, 0, 4.5], [0.06, 9, -7, 0], [0.06, 9, 7, 0]] as number[][]) cage.push({ ...box(w, 3.2, d, x, 1.6, z, '#9fb4bf'), mat: 'glass' });
  cage.push(box(0.08, 1.8, 3, -6.6, 0.9, 0, '#f6f6f0'), box(0.08, 1.8, 3, 6.6, 0.9, 0, '#f6f6f0'));
  defs.push({ id: 'mk.cage', parts: cage, colliders: [R(14, 0.3, 0, -4.5), R(0.3, 9, -7, 0), R(0.3, 9, 7, 0)] });
  // tersane: cranes, containers, a ferry on the slipway
  defs.push({ id: 'mk.crane', parts: [box(0.5, 12, 0.5, -2, 6, -1.2, '#e0a030'), box(0.5, 12, 0.5, 2, 6, -1.2, '#e0a030'), box(0.5, 12, 0.5, -2, 6, 1.2, '#e0a030'), box(0.5, 12, 0.5, 2, 6, 1.2, '#e0a030'),
    box(4.8, 1.2, 3, 0, 12.4, 0, '#e0a030'), box(1.0, 1.0, 16, 0, 13.4, -5, '#e0a030'), box(1.6, 1.4, 1.6, 0, 12.0, 0.6, '#3b3b3b', 'cab'), cyl(0.04, 5, 0.04, 0, 10.6, -10, '#3b3b3b', 4), box(1.6, 0.4, 1.0, 0, 8.0, -10, '#3b3b3b')], colliders: [R(5, 3)] });
  const cont = (c: string): PartDef[] => [box(6, 2.5, 2.4, 0, 1.25, 0, c), ...[-2, -1, 0, 1, 2].map(i => box(0.06, 2.3, 2.42, i * 1.1, 1.25, 0, '#00000022'))];
  defs.push({ id: 'mk.cont.a', parts: [...cont('#c0392b'), ...cont('#2f6f9a').map(p => ({ ...p, pos: [p.pos![0], p.pos![1] + 2.5, p.pos![2]] as [number, number, number] }))], colliders: [R(6, 2.4)] });
  defs.push({ id: 'mk.cont.b', parts: cont('#3a9a5a'), colliders: [R(6, 2.4)] });
  defs.push({ id: 'mk.cont.c', parts: [...cont('#f2c230'), ...cont('#8c5a9a').map(p => ({ ...p, pos: [p.pos![0], p.pos![1] + 2.5, p.pos![2]] as [number, number, number] }))], colliders: [R(6, 2.4)] });
  defs.push({ id: 'mk.slipferry', parts: [box(4.4, 2.4, 16, 0, 1.6, 0, '#fbfaf6'), box(4.6, 0.5, 16.2, 0, 0.5, 0, '#c0392b'), box(3.6, 1.6, 9, 0, 3.6, 0.5, '#f6efe1'), box(3.8, 0.2, 9.4, 0, 4.5, 0.5, '#2f6f9a'),
    cyl(0.5, 2.2, 0.5, 0, 5.6, 2, '#f2c230', 10), box(5, 0.4, 18, 0, 0.1, 0, '#7a6a55', 'slip')], colliders: [R(5, 18)] });
  // metro altı: entrance pavilions, tiled walls, ticket gates, a busker spot
  defs.push({ id: 'mk.metro.gate', parts: [box(6, 0.2, 4, 0, 3.0, 0, '#2b4a7a', 'roof'), box(0.2, 3, 0.2, -2.8, 1.5, -1.8, '#c9d2dc'), box(0.2, 3, 0.2, 2.8, 1.5, -1.8, '#c9d2dc'), box(0.2, 3, 0.2, -2.8, 1.5, 1.8, '#c9d2dc'), box(0.2, 3, 0.2, 2.8, 1.5, 1.8, '#c9d2dc'),
    box(1.2, 1.2, 0.12, 0, 3.8, 1.9, '#e0533c', 'M'), box(5, 0.05, 3.4, 0, -0.4, 0, '#3b3b3b', 'stairs'), ...[0, 1, 2].map(i => box(0.3, 1.0, 0.8, -1.4 + i * 1.4, 0.5, -1.2, '#7a8a90'))], colliders: [R(6, 0.4, 0, -1.9)] });
  const tiles: PartDef[] = [box(38, 4, 0.4, 0, 2, 0, '#e9eef3', 'wall')];
  for (let i = 0; i < 19; i++) tiles.push(box(1.6, 1.6, 0.05, -18 + i * 2, 2.2, 0.22, i % 2 ? '#3f7fbf' : '#5aa9d6'));
  defs.push({ id: 'mk.metro.wall', parts: tiles, colliders: [R(38, 0.4)] });
  defs.push({ id: 'mk.busker', parts: [cyl(0.35, 0.12, 0.35, 0, 0.06, 0, '#5a3a2a', 10), box(0.5, 0.3, 0.3, 0.6, 0.15, 0.2, '#7d3c98'), cyl(0.18, 0.5, 0.18, -0.5, 0.25, 0.1, '#d9822b', 8)] });
  // tepe ve koru: pine clusters, viewing terrace, tea tables, a wooden kiosk
  defs.push({ id: 'mk.pines', parts: [[0, 0], [1.6, 0.9], [-1.4, 1.2], [0.6, -1.5], [-1.0, -1.1]].flatMap(([x, z], i) => [cyl(0.12, 1.4, 0.16, x, 0.7, z, '#6b4a2e', 6), cyl(0, 3.0 + (i % 2) * 0.8, 1.1, x, 2.6 + (i % 2) * 0.4, z, i % 2 ? '#3f8a5a' : '#2f7a4a', 8)]), colliders: [R(3.4, 3.2)] });
  const terrace: PartDef[] = [box(16, 0.3, 6, 0, 0.15, 0, '#c9b28a', 'deck')];
  for (let i = 0; i <= 8; i++) terrace.push(box(0.1, 1.0, 0.1, -8 + i * 2, 0.8, -2.95, '#6b4a2e'));
  terrace.push(box(16, 0.08, 0.1, 0, 1.3, -2.95, '#6b4a2e'), cyl(0.05, 1.2, 0.05, 5, 0.9, 1, '#3b3b3b', 6), box(0.6, 0.3, 0.3, 5, 1.6, 1, '#2f6f9a', 'durbun'));
  defs.push({ id: 'mk.terrace', parts: terrace, colliders: [R(16, 0.3, 0, -2.95)] });
  // adalar: wooden köşk, bike rack, island pier
  defs.push(house('mk.kosk', 9, 7, 6, '#f6efe1', '#a8553d', 1, [box(9.4, 0.2, 2, 0, 2.8, 3.8, '#a8553d', 'balcony'), box(0.2, 2.8, 0.2, -4.4, 1.4, 4.6, '#f6efe1'), box(0.2, 2.8, 0.2, 4.4, 1.4, 4.6, '#f6efe1')]));
  defs.push(house('mk.kosk.b', 8, 6, 6, '#cfe0ef', '#7e8b8f', 1, [box(8.4, 0.2, 2, 0, 2.6, 3.8, '#7e8b8f', 'balcony')]));
  defs.push({ id: 'mk.bikes', parts: [box(4, 0.1, 0.1, 0, 0.6, 0, '#3b3b3b'), ...[-1.5, -0.5, 0.5, 1.5].flatMap((x, i) => [cyl(0.32, 0.05, 0.32, x, 0.34, -0.4, '#2b2b2b', 10), cyl(0.32, 0.05, 0.32, x, 0.34, 0.4, '#2b2b2b', 10), box(0.08, 0.5, 0.8, x, 0.62, 0, ['#e0533c', '#3fb5b0', '#ffd23f', '#8c5a9a'][i])])], colliders: [R(4, 1)] });
  // Belgrad Ormanı (16:52 user): oaks and pines, a stone fountain, mangal spots, picnic tables, logs, rocks, a trail
  g('mk.ground.orman', 84, 42, '#6f9e55', 0.014); g('mk.trail', 84, 3.2, '#b89a6a', 0.02);
  defs.push({ id: 'mk.oak', parts: [cyl(0.32, 2.6, 0.45, 0, 1.3, 0, '#6b4a2e', 8), cyl(0.12, 1.2, 0.16, 0.5, 2.6, 0.2, '#6b4a2e', 6), sph(2.0, 0, 4.0, 0, '#4f8a3a', 10), sph(1.5, 1.2, 4.6, 0.6, '#5f9e48', 9), sph(1.4, -1.1, 4.3, -0.5, '#467f33', 9), sph(1.2, 0.2, 5.3, -0.8, '#6aa94f', 8)], colliders: [R(1.0, 1.0)] });
  defs.push({ id: 'mk.pine.tall', parts: [cyl(0.16, 2.2, 0.22, 0, 1.1, 0, '#5a3d26', 7), cyl(0, 2.4, 1.6, 0, 2.8, 0, '#2f6e44', 9), cyl(0, 2.1, 1.25, 0, 4.0, 0, '#3a7d4e', 9), cyl(0, 1.7, 0.85, 0, 5.1, 0, '#468a58', 8)], colliders: [R(0.7, 0.7)] });
  defs.push({ id: 'mk.bush', parts: [sph(0.7, 0, 0.45, 0, '#4f8a3a', 8), sph(0.55, 0.6, 0.38, 0.2, '#5f9e48', 7), sph(0.5, -0.55, 0.35, -0.1, '#467f33', 7)] });
  defs.push({ id: 'mk.rock', parts: [sph(0.7, 0, 0.25, 0, '#8d8a84', 6), sph(0.45, 0.6, 0.18, 0.3, '#a29e96', 6)], colliders: [R(1.2, 1.0)] });
  defs.push({ id: 'mk.log', parts: [{ shape: 'cyl', size: [0.28, 2.6, 0.3], pos: [0, 0.3, 0], rot: [0, 0, Math.PI / 2], color: '#7a5634', segments: 9 }, { shape: 'cyl', size: [0.22, 0.02, 0.22], pos: [1.31, 0.3, 0], rot: [0, 0, Math.PI / 2], color: '#d9b98a', segments: 9 }], colliders: [R(2.6, 0.6)] });
  defs.push({ id: 'mk.orman.cesme', parts: [box(2.6, 2.2, 0.9, 0, 1.1, 0, '#cfc6b2', 'stone'), box(2.9, 0.3, 1.1, 0, 2.35, 0, '#a89c84', 'cap'), cyl(0.3, 0.3, 0.3, 0, 2.7, 0, '#a89c84', 8),
    box(1.6, 0.9, 0.06, 0, 1.45, 0.47, '#b8ad96', 'kitabe'), cyl(0.04, 0.3, 0.04, -0.5, 1.0, 0.6, '#b08d3a', 6), cyl(0.04, 0.3, 0.04, 0.5, 1.0, 0.6, '#b08d3a', 6),
    box(2.4, 0.45, 0.9, 0, 0.23, 0.85, '#bdb39d', 'yalak'), plane(2.2, 0.7, 0.44, '#7cc4e4')], colliders: [R(2.9, 1.7, 0, 0.35)] });
  defs.push({ id: 'mk.mangal', parts: [box(1.1, 0.35, 0.5, 0, 0.75, 0, '#3b3b3b', 'grill'), box(1.0, 0.04, 0.42, 0, 0.94, 0, '#7a7a7a', 'izgara'), box(0.9, 0.06, 0.36, 0, 0.9, 0, '#e0533c', 'kor'),
    ...[[-0.5, -0.2], [0.5, -0.2], [-0.5, 0.2], [0.5, 0.2]].map(([x, z]) => box(0.05, 0.6, 0.05, x, 0.3, z, '#2b2b2b'))], colliders: [R(1.1, 0.6)] });
  defs.push({ id: 'mk.piknik', parts: [box(2.0, 0.08, 0.9, 0, 0.75, 0, '#b07a48', 'masa'), box(2.0, 0.06, 0.32, 0, 0.45, 0.75, '#a06a3a'), box(2.0, 0.06, 0.32, 0, 0.45, -0.75, '#a06a3a'),
    ...[[-0.8, 0], [0.8, 0]].flatMap(([x]) => [box(0.08, 0.75, 1.9, x, 0.38, 0, '#8a5a32')]), box(0.5, 0.05, 0.5, -0.4, 0.8, 0.1, '#e8e2d4'), cyl(0.1, 0.25, 0.1, 0.5, 0.92, 0, '#8fd06b', 8)], colliders: [R(2.0, 2.2)] });
  defs.push({ id: 'mk.ortu', parts: [plane(2.4, 1.8, 0.03, '#d85a5a'), box(2.4, 0.01, 0.12, 0, 0.035, 0, '#fbf9f4'), box(0.12, 0.01, 1.8, 0, 0.036, 0, '#fbf9f4'), cyl(0.18, 0.28, 0.2, 0.7, 0.14, 0.4, '#8a5a32', 8), cyl(0.08, 0.3, 0.08, -0.6, 0.15, -0.3, '#3fb5b0', 8)] });
  defs.push({ id: 'mk.orman.tabela', parts: [box(0.15, 2.2, 0.15, -1.1, 1.1, 0, '#6b4a2e'), box(0.15, 2.2, 0.15, 1.1, 1.1, 0, '#6b4a2e'), box(2.6, 0.9, 0.1, 0, 1.9, 0, '#4f7a3a', 'tabela'), box(2.3, 0.6, 0.11, 0, 1.9, 0, '#e8dcc0', 'yazi')] });
  defs.push({ id: 'mk.cop', parts: [cyl(0.28, 0.8, 0.24, 0, 0.4, 0, '#3f7a4a', 10), cyl(0.3, 0.06, 0.3, 0, 0.82, 0, '#2f5a38', 10)] });
  return defs;
}

/* ---------------- zones ---------------- */
const P = (id: string, prefab: string, x: number, z: number, rotY?: number): PrefabPlacement => ({ id, prefab, pos: { x, z }, rotY });
/** Blocks the west/east edge of a zone outside the street band. */
function edges(x0: number, x1: number, z0: number, z1: number, west = true, east = true): { rect: Rect; cost: number }[] {
  const out: { rect: Rect; cost: number }[] = [];
  if (west) { out.push({ rect: { x0, x1: x0 + 0.6, z0, z1: Z0 }, cost: 0 }, { rect: { x0, x1: x0 + 0.6, z0: Z1, z1 }, cost: 0 }); }
  if (east) { out.push({ rect: { x0: x1 - 0.6, x1, z0, z1: Z0 }, cost: 0 }, { rect: { x0: x1 - 0.6, x1, z0: Z1, z1 }, cost: 0 }); }
  return out;
}
function portals(id: string, x0: number, x1: number, west: string, east: string | null) {
  const p = [{ id: `${id}>${west}`, to: west, a: { x: x0, z: Z0 }, b: { x: x0, z: Z1 } }];
  if (east) p.push({ id: `${id}>${east}`, to: east, a: { x: x1, z: Z0 }, b: { x: x1, z: Z1 } });
  return p;
}
function base(id: RegionId, z0: number, z1: number, props: PrefabPlacement[], paint: { rect: Rect; cost: number }[], west: string, east: string | null): ZoneDef {
  const r = REGION_BY_ID[id];
  const mid = (r.x0 + r.x1) / 2;
  for (const s of SIDE_SHOPS) if (s.region === id) props.push(P('shop-' + s.id, 'mk.shop.' + s.id, s.kx, s.kz, s.rot));
  for (const sg of SIGNS) if (sg.x >= r.x0 && sg.x < r.x1) props.push(P('sign-' + sg.x, 'mk.sign', sg.x, sg.z));
  props.push(P('stop-' + id, 'mk.stop', r.stop.x, r.stop.z + 1.0));
  return {
    id: r.zone, name: r.name,
    bounds: { x0: r.x0, z0, x1: r.x1, z1 },
    walk: { cell: 0.5, bake: true, paint },
    props,
    anchors: {
      'spawn.0': { pos: { x: mid, z: BAND.mid }, kind: 'spawn' },
      portalIn: { pos: { x: r.x0 + 2, z: BAND.mid }, kind: 'door' },
      stop: { pos: { x: r.stop.x, z: r.stop.z }, kind: 'marker', tags: [r.stop.name] },
    },
    portals: portals(r.zone, r.x0, r.x1, west, east),
    ambience: { music: 'iskele', loops: id === 'sahil' || id === 'barinak' ? ['deniz', 'marti'] : [] },
    dressing: [],
    playerStart: { x: r.x0 + 2, z: BAND.mid },
  };
}

export function sahilZone(): ZoneDef {
  const x0 = 132, x1 = 196, mx = 164;
  const props: PrefabPlacement[] = [
    P('water', 'mk.water64', mx, -3.4), P('prom', 'mk.ground.prom', mx, 6.3), P('grass', 'mk.ground.grass', mx, 17.25),
    P('hedgeW', 'mk.hedgeZ', x0 + 0.45, 19.0), P('hedgeE', 'mk.hedgeZ', x1 - 0.45, 19.0),
    P('hedgeN0', 'mk.hedgeX', 140, 25.0), P('hedgeN1', 'mk.hedgeX', 152, 25.0), P('hedgeN2', 'mk.hedgeX', 164, 25.0), P('hedgeN3', 'mk.hedgeX', 176, 25.0), P('hedgeN4', 'mk.hedgeX', 188, 25.0),
    P('luna', 'mk.lunapark', 185, 21.5), P('sinema', 'mk.sinema', 158, 21.2), P('olta', 'mk.oltaci', 152, 3.3),
  ];
  for (let x = 136; x <= 192; x += 8) props.push(P('rail' + x, 'mk.rail', x, 2.75));
  [[137, 16], [143, 21], [149, 17.5], [168, 15.8], [171, 21.5], [177, 18], [193, 16.5], [134.5, 22]].forEach(([x, z], i) => props.push(P('tree' + i, i % 3 === 2 ? 'mk.tree.pine' : 'mk.tree', x, z)));
  [[142, 10.4], [156, 10.4], [168, 10.4], [184, 10.4]].forEach(([x, z], i) => props.push(P('bench' + i, 'mk.bench', x, z, Math.PI)));
  for (let x = 140; x < 196; x += 14) props.push(P('lamp' + x, 'ts.lamp', x, 3.3));
  const paint = [
    { rect: { x0, x1, z0: -8, z1: 2.6 }, cost: 0 },
    { rect: { x0, x1, z0: 24.5, z1: 26 }, cost: 0 },
    ...edges(x0, x1, 2.6, 26),
  ];
  return base('sahil', -8, 26, props, paint, 'test-sokak', 'yokus');
}

export function yokusZone(): ZoneDef {
  const x0 = 196, x1 = 244, mx = 220;
  const props: PrefabPlacement[] = [
    P('band', 'mk.ground.band48', mx, BAND.mid), P('stairs', 'mk.stairs', 217, BAND.mid),
    P('hn1', 'mk.house.y1', 200.5, 16.2), P('kutup', 'mk.kutuphane', 210, 16.2), P('hn2', 'mk.house.y2', 219, 16.2), P('hn3', 'mk.house.y3', 226.5, 16.2), P('hn4', 'mk.house.y2', 233, 16.2), P('hn5', 'mk.house.y1', 240, 16.2),
    P('hs1', 'mk.house.y4', 200, 1.8), P('hs2', 'mk.house.y5', 207.5, 1.8), P('hs3', 'mk.house.y6', 214.5, 1.8), P('hamam', 'mk.hamam', 223, 1.8), P('hs4', 'mk.house.y4', 231, 1.8), P('hs5', 'mk.house.y5', 240, 1.8),
    P('pots0', 'mk.pots', 212, 13.0), P('pots1', 'mk.pots', 222, 5.2), P('pots2', 'mk.pots', 238, 13.0), P('pots3', 'mk.pots', 203, 5.2),
  ];
  for (let x = 204; x < 244; x += 13) props.push(P('lamp' + x, 'ts.lamp', x, 12.9));
  const paint = [{ rect: { x0, x1, z0: -2, z1: Z0 }, cost: 0 }, { rect: { x0, x1, z0: Z1, z1: 22 }, cost: 0 }];
  return base('yokus', -2, 22, props, paint, 'sahil', 'meydan');
}

export function meydanZone(): ZoneDef {
  const x0 = 244, x1 = 292, mx = 268;
  const props: PrefabPlacement[] = [
    P('square', 'mk.ground.square', mx, 9), P('cesme', 'mk.cesme', 268, 8.4), P('cinar', 'mk.cinar', 263, 15.8),
    P('kira', 'mk.kiraathane', 256, 22.2), P('tavla', 'mk.tavla', 256, 18.2), P('simit', 'mk.simitcart', 288, 4.0, Math.PI / 2),
    P('hn1', 'mk.house.m4', 270, 22.2), P('hn2', 'mk.house.m3', 282, 22.2),
    P('hs1', 'mk.house.m1', 251, -4.0), P('hs2', 'mk.house.m2', 263, -4.0), P('hs3', 'mk.house.m1', 275, -4.0), P('hs4', 'mk.house.m2', 286, -4.0),
    P('bayrak', 'mk.bayrak', 276, 15.5), P('benchA', 'mk.bench', 258, 4.0), P('benchB', 'mk.bench', 278, 9.0, Math.PI / 2),
    P('wallW0', 'mk.wallZ', x0 + 0.3, 0.8), P('wallW1', 'mk.wallZ', x0 + 0.3, 17.3), P('wallE0', 'mk.wallZ', x1 - 0.3, 0.8), P('wallE1', 'mk.wallZ', x1 - 0.3, 17.3),
  ];
  [[250, 1.5], [286, 17.5], [250, 17.5], [286, 6]].forEach(([x, z], i) => props.push(P('lamp' + i, 'ts.lamp', x, z)));
  const paint = [{ rect: { x0, x1, z0: -6, z1: -2 }, cost: 0 }, { rect: { x0, x1, z0: 20, z1: 24 }, cost: 0 }, ...edges(x0, x1, -6, 24)];
  return base('meydan', -6, 24, props, paint, 'yokus', 'barinak');
}

export function barinakZone(): ZoneDef {
  const x0 = 292, x1 = 344, mx = 318;
  const props: PrefabPlacement[] = [
    P('water', 'mk.water52', mx, -7), P('quay', 'mk.ground.quay', mx, 7.5), P('jetty', 'mk.jetty', 320, -4),
    P('boat0', 'mk.boat.a', 314, -4.5), P('boat1', 'mk.boat.b', 326, -5.2), P('boat2', 'mk.boat.c', 305, -3.5), P('boat3', 'mk.boat.a', 332, -8.0),
    P('fener', 'mk.fener', 338, -3.2), P('rocks', 'mk.rocks', 336, -1.4),
    P('hali', 'mk.hali', 308, 17.2), P('shed0', 'mk.shed.a', 321, 16.2), P('shed1', 'mk.shed.b', 330, 16.2), P('shed2', 'mk.shed.a', 339, 16.2),
    P('net0', 'mk.netrack', 300, 2.2), P('net1', 'mk.netrack', 334, 12.6), P('crates0', 'mk.crates', 312, 12.8), P('crates1', 'mk.crates', 325, 2.0),
  ];
  for (const x of [297, 305, 313.5, 326.5, 334.5, 339.5]) props.push(P('rail' + x, 'mk.rail', x, 1.15));
  for (let x = 302; x < 344; x += 14) props.push(P('lamp' + x, 'ts.lamp', x, 1.6));
  const paint = [
    { rect: { x0, x1, z0: -14, z1: 1.2 }, cost: 0 },
    { rect: { x0: 318.6, x1: 321.4, z0: -8.6, z1: 1.2 }, cost: 1 },
    { rect: { x0, x1, z0: 14.2, z1: 20 }, cost: 0 },
    ...edges(x0, x1, 1.2, 14.2),
  ];
  return base('barinak', -14, 20, props, paint, 'meydan', 'gece');
}

/** Common outer frame for the new districts: walkable x0..x1, z -6..24, street band open at both portals. */
function frame(x0: number, x1: number, z0 = -6, z1 = 24, west = true, east = true) {
  return [{ rect: { x0, x1, z0: z0 - 2, z1: z0 }, cost: 0 }, { rect: { x0, x1, z0: z1, z1: z1 + 2 }, cost: 0 }, ...edges(x0, x1, z0, z1, west, east)];
}
export function geceZone(): ZoneDef {
  const x0 = 344, x1 = 392, mx = 368;
  const props: PrefabPlacement[] = [P('ground', 'mk.ground.night', mx, 9)];
  const kinds = ['a', 'b', 'c', 'd'];
  for (let i = 0; i < 6; i++) { props.push(P('sn' + i, 'mk.stall.' + kinds[i % 4], 350 + i * 7, 17.5, Math.PI)); props.push(P('ss' + i, 'mk.stall.' + kinds[(i + 2) % 4], 352 + i * 7, 0.5)); }
  props.push(P('bulbs0', 'mk.bulbs', mx, 4.4), P('bulbs1', 'mk.bulbs', mx, 13.8), P('simit', 'mk.simitcart', 388, 9, Math.PI / 2), P('tree0', 'mk.tree', 346.5, 21), P('tree1', 'mk.tree', 389.5, 21));
  for (let x = 349; x < 392; x += 12) props.push(P('lamp' + x, 'ts.lamp', x, 22.5));
  return base('gece', -6, 24, props, frame(x0, x1), 'barinak', 'stadyum');
}
export function stadyumZone(): ZoneDef {
  const x0 = 392, x1 = 452, mx = 422;
  const props: PrefabPlacement[] = [P('ground', 'mk.ground.pitchzone', mx, 9), P('pitch', 'mk.pitch', 426, 19.5), P('stand', 'mk.stand', 426, 30.2, Math.PI),
    P('cage0', 'mk.cage', 402, 0.5), P('cage1', 'mk.cage', 418, 0.5), P('cage2', 'mk.cage', 434, 0.5),
    P('fl0', 'mk.flood', 410, 10.6), P('fl1', 'mk.flood', 442, 10.6), P('bayrak', 'mk.bayrak', 396, 16)];
  for (const x of [400, 412, 424, 436, 448]) props.push(P('lamp' + x, 'ts.lamp', x, 13.6));
  return base('stadyum', -6, 32, props, frame(x0, x1, -6, 32), 'gece', 'tersane');
}
export function tersaneZone(): ZoneDef {
  const x0 = 452, x1 = 508, mx = 480;
  const props: PrefabPlacement[] = [P('water', 'mk.water60', mx, -9), P('yard', 'mk.ground.yard', mx, 9),
    P('crane0', 'mk.crane', 466, 1.5), P('crane1', 'mk.crane', 494, 1.5), P('ferry', 'mk.slipferry', 480, 18, Math.PI / 2),
    P('c0', 'mk.cont.a', 458, 20), P('c1', 'mk.cont.b', 458, 16.6), P('c2', 'mk.cont.c', 502, 20), P('c3', 'mk.cont.b', 502, 16.6), P('crates', 'mk.crates', 470, 13.4), P('net', 'mk.netrack', 490, 13.4)];
  for (const x of [457, 471, 485, 499]) props.push(P('rail' + x, 'mk.rail', x, 0.1), P('lamp' + x, 'ts.lamp', x + 4, 0.6));
  const paint = [{ rect: { x0, x1, z0: -18, z1: 0 }, cost: 0 }, ...frame(x0, x1, 0, 24)];
  return base('tersane', -18, 24, props, paint, 'stadyum', 'metro');
}
export function metroZone(): ZoneDef {
  const x0 = 508, x1 = 548, mx = 528;
  const props: PrefabPlacement[] = [P('ground', 'mk.ground.tile', mx, 9), P('wallN', 'mk.metro.wall', mx, 22.6), P('wallS', 'mk.metro.wall', mx, -4.6),
    P('gate0', 'mk.metro.gate', 516, 18.4), P('gate1', 'mk.metro.gate', 540, 18.4), P('busk', 'mk.busker', 528, 16.4), P('b0', 'mk.bench', 522, 1.0), P('b1', 'mk.bench', 534, 1.0)];
  for (const x of [512, 524, 536]) props.push(P('lamp' + x, 'ts.lamp', x, 3.4), P('lampn' + x, 'ts.lamp', x + 6, 14.6));
  return base('metro', -6, 24, props, frame(x0, x1), 'tersane', 'tepe');
}
export function tepeZone(): ZoneDef {
  const x0 = 548, x1 = 600, mx = 574;
  const props: PrefabPlacement[] = [P('ground', 'mk.ground.forest', mx, 9), P('terrace', 'mk.terrace', 584, -1.5), P('tavla', 'mk.tavla', 584, 1.6), P('cinar', 'mk.cinar', 566, 19)];
  [[553, 19], [560, 0], [571, 22], [579, 18.5], [590, 21], [596, 2], [553, 1], [597, 17]].forEach(([x, z], i) => props.push(P('pines' + i, 'mk.pines', x, z)));
  for (const x of [556, 570, 584, 596]) props.push(P('lamp' + x, 'ts.lamp', x, 13.8));
  return base('tepe', -6, 24, props, frame(x0, x1, -6, 24, true, false).concat([{ rect: { x0: x1 - 0.6, x1, z0: -6, z1: 24 }, cost: 0 }]), 'metro', null);
}
export function adalarZone(): ZoneDef {
  const x0 = 700, x1 = 760, mx = 730;
  const props: PrefabPlacement[] = [P('water', 'mk.water60', mx, -7), P('ground', 'mk.ground.island', mx, 11), P('jetty', 'mk.jetty', 714, -4),
    P('kosk0', 'mk.kosk', 724, 19), P('kosk1', 'mk.kosk.b', 738, 19), P('kosk2', 'mk.kosk', 752, 19), P('bikes', 'mk.bikes', 730, 6.5), P('boat', 'mk.boat.b', 722, -6)];
  [[704, 18], [746, 9], [757, 5], [703, 6]].forEach(([x, z], i) => props.push(P('pine' + i, 'mk.pines', x, z)));
  for (const x of [708, 722, 736, 750]) props.push(P('rail' + x, 'mk.rail', x, 1.15), P('lamp' + x, 'ts.lamp', x + 3, 1.7));
  const paint = [{ rect: { x0, x1, z0: -14, z1: 1.2 }, cost: 0 }, { rect: { x0: 712.6, x1: 715.4, z0: -8.6, z1: 1.2 }, cost: 1 },
    { rect: { x0, x1: x0 + 0.6, z0: -14, z1: 26 }, cost: 0 }, { rect: { x0: x1 - 0.6, x1, z0: -14, z1: 26 }, cost: 0 }, { rect: { x0, x1, z0: 24, z1: 26 }, cost: 0 }];
  return base('adalar', -14, 26, props, paint, 'barinak', null);
}
export function ormanZone(): ZoneDef {
  const x0 = 800, x1 = 880, mx = 840;
  const props: PrefabPlacement[] = [P('ground', 'mk.ground.orman', mx, 9), P('trail', 'mk.trail', mx, 9), P('tabela', 'mk.orman.tabela', 812, 13.6),
    P('cesme', 'mk.orman.cesme', 838, 16.5), P('m0', 'mk.mangal', 826, 2.4), P('pk0', 'mk.piknik', 823, 1.0), P('o0', 'mk.ortu', 829, 4.0),
    P('m1', 'mk.mangal', 856, 2.0), P('pk1', 'mk.piknik', 859, 0.6), P('o1', 'mk.ortu', 852, 3.6), P('m2', 'mk.mangal', 868, 17.6), P('o2', 'mk.ortu', 865, 15.2),
    P('log0', 'mk.log', 846, 12.6), P('log1', 'mk.log', 874, 7.0, 0.6), P('rock0', 'mk.rock', 818, 4.2), P('rock1', 'mk.rock', 862, 13.6), P('cop0', 'mk.cop', 815, 13.0), P('cop1', 'mk.cop', 848, 4.4),
    // 2026-10-25: more of the forest: two extra hiking trails, three more mangal families with picnic tables, rocks, logs
    P('trail2', 'mk.trail', mx, -2.0), P('trail3', 'mk.trail', mx, 18.0),
    P('m3', 'mk.mangal', 838, -3.2), P('pk3', 'mk.piknik', 835, -4.6), P('o3', 'mk.ortu', 842, -1.4),
    P('m4', 'mk.mangal', 872, 5.4), P('pk4', 'mk.piknik', 875, 4.0), P('m5', 'mk.mangal', 846, 21.5), P('pk5', 'mk.piknik', 849, 22.8),
    P('log2', 'mk.log', 829, -0.8, 0.3), P('log3', 'mk.log', 858, 19.4, -0.4), P('rock2', 'mk.rock', 806, -1.0), P('rock3', 'mk.rock', 877, 18.0), P('rock4', 'mk.rock', 840, 25.0)];
  const trees: [number, number, string][] = [];
  for (let i = 0; i < 26; i++) { const x = 803 + i * 3.0 + (i % 3) * 0.7, k = i % 2 ? 'mk.oak' : 'mk.pine.tall'; trees.push([x, 22 + (i % 4) * 1.6, k], [x + 1.4, -5 - (i % 3) * 1.5, i % 3 ? 'mk.pine.tall' : 'mk.oak']); }
  [[832, 9.8], [844, 19.8], [850, 7.4], [870, 12.2], [834, 3.2], [816, 18.4], [876, 19.4]].forEach(([x, z], i) => trees.push([x, z, i % 2 ? 'mk.oak' : 'mk.pine.tall']));
  trees.forEach(([x, z, k], i) => props.push(P('t' + i, k, x, z)));
  [[820, 20.5], [841, 0.2], [863, 21.0], [872, -1.5], [829, 19.6], [853, 18.8]].forEach(([x, z], i) => props.push(P('bush' + i, 'mk.bush', x, z)));
  return base('orman', -10, 28, props, frame(x0, x1, -10, 28, true, true).concat([{ rect: { x0, x1: x0 + 0.6, z0: -10, z1: 28 }, cost: 0 }, { rect: { x0: x1 - 0.6, x1, z0: -10, z1: 28 }, cost: 0 }]), 'tepe', null);
}
export function disariZones(): ZoneDef[] { return [sahilZone(), yokusZone(), meydanZone(), barinakZone(), geceZone(), stadyumZone(), tersaneZone(), metroZone(), tepeZone(), adalarZone(), ormanZone()]; }

interface ZonesLike { def(id: string): unknown; register(d: ZoneDef): void; replace(d: ZoneDef): void }
interface PrefabLike { has(id: string): boolean; define(d: PrefabDef): void }
/** Defines the mk.* prefabs and registers the four zones (called by the world view next to test-sokak). */
export function registerDisariZones(zones: ZonesLike, prefab: PrefabLike): ZoneDef[] {
  disariPrefabs().forEach(d => { if (!prefab.has(d.id)) prefab.define(d); });
  const all = disariZones();
  for (const z of all) { if (!zones.def(z.id)) zones.register(z); else zones.replace(z); }
  return all;
}
