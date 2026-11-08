/**
 * Karşı yaka (far side of the road, z 28.4..59), built from the owner's sketch of 2026-11-04:
 * halı saha with stands and a gate, two cafés, the square with a fountain and bench strips, the bank, the stationery
 * shop, a basketball court, the school with yard and canteen, the mall, the metro exit, the hospital with ambulance park.
 * Pure data: part-only prefabs plus placements + colliders for the iskele zone. Paths (the dashed "mahalle arası"
 * lines) are paved strips that stay open in the walk grid; only buildings, stands, fences and the fountain block.
 */
import type { PrefabDef, PrefabPlacement, PartDef, Rect } from '../../engine/api';

type Def = PrefabDef;
const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: string, name?: string): PartDef => ({ shape: 'box', size: [w, h, d], pos: [x, y, z], color, name });
const cyl = (rt: number, h: number, rb: number, x: number, y: number, z: number, color: string, seg = 14): PartDef => ({ shape: 'cyl', size: [rt, h, rb], pos: [x, y, z], color, segments: seg });
const plane = (w: number, d: number, y: number, color: string): PartDef => ({ shape: 'plane', size: [w, 0, d], pos: [0, y, 0], color });
const R = (w: number, d: number, ox = 0, oz = 0): Rect => ({ x0: ox - w / 2, x1: ox + w / 2, z0: oz - d / 2, z1: oz + d / 2 });
const PAVE = '#c4aa80';

/** A building with windows on the front (+z) and both side faces; the door on `door`. */
function bld(id: string, w: number, d: number, h: number, wall: string, trim: string, door: '+z' | '-z' | '+x' | '-x', extra: PartDef[] = [], glb = false): Def {
  if (glb) { void extra; return { id, parts: [box(w + 0.6, 0.12, d + 0.6, 0, 0.06, 0, '#b9b3a6', 'base')], colliders: [R(w, d)] }; }   // the whole building is a model (view/world/karsi-bina.ts)
  const parts: PartDef[] = [box(w, h, d, 0, h / 2, 0, wall, 'wall'), box(w + 0.5, 0.35, d + 0.5, 0, h + 0.17, 0, trim, 'roof')];
  const floors = Math.max(1, Math.floor((h - 1.2) / 3.0)), glass = '#9cc3d6';
  for (let f = 0; f < floors; f++) {
    const y = 1.9 + f * 3.0;
    for (let c = 0; c < Math.floor(w / 2.2); c++) { const x = -w / 2 + 1.3 + c * 2.2; if (door === '+z' && f === 0 && Math.abs(x) < 1.3) continue; parts.push(box(1.2, 1.3, 0.07, x, y, d / 2 + 0.03, glass)); }
    for (let c = 0; c < Math.floor(d / 2.4); c++) { const z = -d / 2 + 1.3 + c * 2.4; for (const sx of [-1, 1]) parts.push(box(0.07, 1.3, 1.1, sx * (w / 2 + 0.03), y, z, glass)); }
  }
  const dx = door === '+x' ? w / 2 + 0.05 : door === '-x' ? -w / 2 - 0.05 : 0, dz = door === '+z' ? d / 2 + 0.05 : door === '-z' ? -d / 2 - 0.05 : 0;
  if (door === '+z' || door === '-z') parts.push(box(1.8, 2.3, 0.1, 0, 1.15, dz, '#5a4030', 'door'), box(2.6, 0.18, 0.9, 0, 2.6, dz + (door === '+z' ? 0.4 : -0.4), trim));
  else parts.push(box(0.1, 2.3, 1.8, dx, 1.15, 0, '#5a4030', 'door'), box(0.9, 0.18, 2.6, dx + (door === '+x' ? 0.4 : -0.4), 2.6, 0, trim));
  parts.push(...extra);
  return { id, parts, colliders: [R(w, d)] };
}

const redCross = (x: number, y: number, z: number): PartDef[] => [box(2.4, 0.7, 0.1, x, y, z, '#d93a3a'), box(0.7, 2.4, 0.1, x, y, z, '#d93a3a')];

function bench(id: string): Def { return { id, parts: [box(1.8, 0.08, 0.5, 0, 0.45, 0, '#b07a48'), box(1.8, 0.45, 0.08, 0, 0.72, -0.24, '#b07a48'), box(0.08, 0.45, 0.45, -0.8, 0.22, 0, '#3b3b3b'), box(0.08, 0.45, 0.45, 0.8, 0.22, 0, '#3b3b3b')], colliders: [R(1.8, 0.55)] }; }

export function karsiPrefabs(): PrefabDef[] {
  const defs: Def[] = [];
  const pave = (id: string, w: number, d: number, color = PAVE) => defs.push({ id, parts: [plane(w, d, 0.07, color)] });
  pave('kr.pave.wide', 124, 3.2); pave('kr.pave.s', 124, 2.2);
  pave('kr.pave.gate', 14, 3.0); pave('kr.pave.e1', 26.6, 3.0); pave('kr.pave.v1', 3.0, 19); pave('kr.pave.v2', 6.3, 16); pave('kr.pave.h2', 25.6, 6);
  pave('kr.plaza', 18.4, 24.4, '#c8ad82');
  // tribün blocks: three steps with a crowd-free seat row
  const stand = (id: string, w: number, d: number, axis: 'z' | 'x'): Def => {
    const parts: PartDef[] = [];
    for (let i = 0; i < 4; i++) {
      const dd = (axis === 'z' ? d : w) * (1 - i * 0.22), sh = 0.55 + i * 0.5;
      parts.push(axis === 'z' ? box(w, sh, dd, 0, sh / 2, (d - dd) / 2 * 0, i % 2 ? '#c8504a' : '#e0674f') : box(dd, sh, d, 0, sh / 2, 0, i % 2 ? '#c8504a' : '#e0674f'));
    }
    return { id, parts: axis === 'z' ? [box(w, 0.5, d, 0, 0.25, 0, '#9aa0a6'), box(w, 1.1, d * 0.7, 0, 0.8, 0, '#e0674f'), box(w, 1.7, d * 0.45, 0, 1.35, 0, '#c8504a'), box(w, 2.3, d * 0.25, 0, 1.9, 0, '#e0674f')]
      : [box(w, 0.5, d, 0, 0.25, 0, '#9aa0a6'), box(w * 0.7, 1.1, d, 0, 0.8, 0, '#e0674f'), box(w * 0.45, 1.7, d, 0, 1.35, 0, '#c8504a'), box(w * 0.25, 2.3, d, 0, 1.9, 0, '#e0674f')], colliders: [R(w, d)] };
  };
  defs.push(stand('kr.stand.z', 33.7, 3.5, 'z'), stand('kr.stand.x', 3.7, 17.8, 'x'));
  // the pitch: green plane with white lines, goals with nets, a low fence is separate (colliders)
  const line = (w: number, d: number, x: number, z: number): PartDef => box(w, 0.02, d, x, 0.1, z, '#f4f4f0');
  const W = 25.2, D = 17.8, lines: PartDef[] = [box(W, 0.06, D, 0, 0.05, 0, '#4f9a4a'), line(W, 0.12, 0, D / 2), line(W, 0.12, 0, -D / 2), line(0.12, D, W / 2, 0), line(0.12, D, -W / 2, 0), line(0.12, D, 0, 0), cyl(2.0, 0.02, 2.0, 0, 0.1, 0, '#f4f4f0', 28), cyl(1.85, 0.03, 1.85, 0, 0.11, 0, '#4f9a4a', 28)];
  for (const sx of [-1, 1]) { lines.push(line(0.12, 7, sx * (W / 2 - 3), 0), line(3, 0.12, sx * (W / 2 - 1.5), 3.5), line(3, 0.12, sx * (W / 2 - 1.5), -3.5));
    lines.push(box(0.1, 2.0, 0.1, sx * W / 2, 1.0, -1.6, '#f4f4f0'), box(0.1, 2.0, 0.1, sx * W / 2, 1.0, 1.6, '#f4f4f0'), box(0.1, 0.1, 3.3, sx * W / 2, 2.0, 0, '#f4f4f0'), box(1.2, 1.8, 3.2, sx * (W / 2 + 0.7), 0.95, 0, '#e8ecef'));
  }
  for (const [x, z] of [[-W / 2 - 1.5, -D / 2 - 1.5], [W / 2 + 1.5, -D / 2 - 1.5], [-W / 2 - 1.5, D / 2 + 1.5], [W / 2 + 1.5, D / 2 + 1.5]]) lines.push(box(0.2, 8, 0.2, x, 4, z, '#5b6068'), box(1.6, 0.5, 0.4, x, 8.1, z, '#fff7cf'));
  defs.push({ id: 'kr.pitch', parts: lines });
  // fountain: basin, rim, central column, water jets
  defs.push({ id: 'kr.fiskiye', parts: [cyl(2.9, 0.5, 2.9, 0, 0.25, 0, '#b9ad99', 24), cyl(2.5, 0.52, 2.5, 0, 0.27, 0, '#5fa8d0', 24), cyl(0.35, 1.8, 0.45, 0, 1.2, 0, '#b9ad99', 12),
    cyl(0.9, 0.2, 0.2, 0, 2.15, 0, '#b9ad99', 14), cyl(0.05, 1.4, 0.08, 0, 2.9, 0, '#bfe6f7', 6),
    ...[0, 1, 2, 3, 4, 5].map(i => cyl(0.04, 0.9, 0.06, Math.cos(i * 1.047) * 1.5, 0.95, Math.sin(i * 1.047) * 1.5, '#bfe6f7', 6))], colliders: [R(5.8, 5.8)] });
  defs.push(bench('kr.bench'));
  defs.push({ id: 'kr.treeblock', parts: [cyl(0.18, 1.2, 0.26, 0, 0.6, 0, '#6b4a2e', 7)], colliders: [R(0.5, 0.5)] });   // the crown is a Kenney model (karsi-look)
  // basketball court with two hoops
  const hoop = (z: number, dir: number): PartDef[] => [cyl(0.07, 3.2, 0.07, 0, 1.6, z, '#3b3b3b', 6), box(1.5, 1.0, 0.08, 0, 3.4, z + dir * 0.2, '#f4f4f0'), cyl(0.28, 0.06, 0.28, 0, 3.0, z + dir * 0.55, '#e0533c', 10)];
  defs.push({ id: 'kr.basket', parts: [box(7.2, 0.06, 10.7, 0, 0.04, 0, '#c8663c'), box(6.8, 0.02, 0.1, 0, 0.09, 0, '#f4f4f0'), cyl(1.1, 0.02, 1.1, 0, 0.09, 0, '#f4f4f0', 20), cyl(1.0, 0.03, 1.0, 0, 0.1, 0, '#c8663c', 20), ...hoop(-5.0, 1), ...hoop(5.0, -1)], colliders: [R(0.4, 0.4, 0, -5.0), R(0.4, 0.4, 0, 5.0)] });
  // buildings
  defs.push(bld('kr.kafe', 7, 9.4, 3.8, '#f1d9b4', '#c2551f', '+x', [box(0.1, 0.9, 3.8, 3.7, 1.6, 0, '#d85a5a'), box(7.5, 0.4, 1.2, 0, 3.9, 5.05, '#c2551f')], true));
  defs.push(bld('kr.kirtasiye', 7.1, 3.6, 3.6, '#bfd8e8', '#2b6fb8', '+z', [box(3.4, 0.8, 0.08, 0, 3.0, 1.9, '#ffd23f')], true));
  defs.push(bld('kr.okul', 18.3, 7.5, 8.0, '#e9c98f', '#a2472f', '+z', [box(0.12, 6, 0.12, 6, 11, 0, '#cfd4da'), box(1.6, 1.0, 0.04, 6.9, 13.5, 0, '#d93a3a')], true));
  defs.push(bld('kr.kantin', 3.7, 2.8, 3.0, '#f6efe1', '#e0533c', '-x', [box(3.6, 0.15, 1.2, 0, 2.4, 1.9, '#e0533c')], true));
  defs.push(bld('kr.avm', 16.9, 12.8, 9.5, '#cfd6e6', '#3f4a6b', '-z', [box(10, 1.6, 0.12, 0, 8.2, 6.5, '#e0533c'), box(9, 3.2, 0.12, 0, 2.0, 6.5, '#7fb4d8')], true));
  defs.push(bld('kr.hastane', 16.9, 6.7, 12.0, '#f2f4f6', '#d93a3a', '-z', [...redCross(0, 10.0, 3.5), box(4.4, 2.8, 0.1, 0, 1.4, 3.45, '#7fb4d8')], true));
  defs.push(bld('kr.acil', 3.3, 3.2, 3.6, '#f2f4f6', '#d93a3a', '-x', [], true));     // walls: view/world/karsi-bina.ts
  defs.push(bld('kr.morg', 3.3, 3.2, 3.2, '#c9ced6', '#5b6068', '-x', [], true));
  defs.push({ id: 'kr.metro', parts: [box(3, 0.3, 5.6, 0, 0.15, 0, '#b9ad99'), box(0.3, 3.2, 5.6, -1.5, 1.6, 0, '#5b6068'), box(0.3, 3.2, 5.6, 1.5, 1.6, 0, '#5b6068'), box(3.4, 0.35, 5.8, 0, 3.4, 0, '#2b6fb8'), box(2.4, 0.04, 3.6, 0, 0.32, 0.4, '#2a2d33'),
    box(1.2, 1.2, 0.1, 0, 4.3, 2.8, '#e0533c'), box(0.12, 1.0, 0.12, -0.6, 3.9, 2.8, '#5b6068'), box(0.12, 1.0, 0.12, 0.6, 3.9, 2.8, '#5b6068')], colliders: [R(0.3, 5.6, -1.5, 0), R(0.3, 5.6, 1.5, 0), R(3, 0.3, 0, -2.75)] });
  // ambulance park: paved lot with two parked ambulances
  const amb = (x: number): PartDef[] => [box(2.0, 1.5, 4.6, x, 1.05, 0, '#f4f4f0'), box(2.02, 0.4, 4.6, x, 1.0, 0, '#d93a3a'), box(1.9, 0.9, 1.3, x, 1.2, -2.0, '#9cc3d6'), cyl(0.38, 0.3, 0.38, x - 1.0, 0.38, -1.4, '#17181b', 10), cyl(0.38, 0.3, 0.38, x + 1.0, 0.38, -1.4, '#17181b', 10), cyl(0.38, 0.3, 0.38, x - 1.0, 0.38, 1.4, '#17181b', 10), cyl(0.38, 0.3, 0.38, x + 1.0, 0.38, 1.4, '#17181b', 10), box(0.5, 0.15, 0.3, x, 1.9, -0.5, '#3f7fd0')];
  defs.push({ id: 'kr.ambpark', parts: [plane(6.0, 6.7, 0.07, '#6c6f75')], colliders: [R(2.2, 4.8, -1.5, 0), R(2.2, 4.8, 1.5, 0)] });
  // fences (visual + collider), long low segments
  const fence = (id: string, w: number, d: number): Def => ({ id, parts: [box(w, 0.9, d, 0, 0.45, 0, '#6f7a85'), box(w, 0.08, d + 0.06, 0, 0.94, 0, '#9aa5b0')], colliders: [R(w, d)] });
  defs.push(fence('kr.fence.x10', 10, 0.22), fence('kr.fence.x8', 8, 0.22), fence('kr.fence.x12', 12, 0.22), fence('kr.fence.z7', 0.22, 7), fence('kr.fence.z11', 0.22, 11));
  return defs;
}

export const KARSI_FOUNTAIN = { x: -3.9, z: 45 };
export const KARSI_PITCH = { x: -39.4, z: 45.4, w: 25.2, d: 17.8 };
const P = (id: string, prefab: string, x: number, z: number, rotY?: number): PrefabPlacement => ({ id, prefab, pos: { x, z }, ...(rotY ? { rotY } : {}) });
export const KARSI_TREES: [number, number][] = [[-59.5, 34], [-59.5, 46], [-59.5, 55], [60.2, 36], [60.2, 46], [60.2, 57], [-44, 58.2], [-28, 58.2], [-10, 58.2], [3, 58.2], [18, 58.2], [34, 58.2], [47, 58.2], [-48, 31], [-30, 31], [-8, 31.5], [10, 31], [34, 31], [52, 31.2]];

export function karsiProps(): PrefabPlacement[] {
  const out: PrefabPlacement[] = [];
  out.push(P('kr-pave-n', 'kr.pave.wide', 0, 30.4), P('kr-pave-s', 'kr.pave.s', 0, 58.0));
  out.push(P('kr-plaza', 'kr.plaza', -3.8, 44.8), P('kr-pave-gate', 'kr.pave.gate', -19.8, 44.9), P('kr-pave-e1', 'kr.pave.e1', 18.7, 42.6), P('kr-pave-v1', 'kr.pave.v1', 30.5, 47.5), P('kr-pave-v2', 'kr.pave.v2', 8.5, 49), P('kr-pave-h2', 'kr.pave.h2', 45.2, 47.2));
  // halı saha: pitch + three stands + fence with a gate on the east side
  out.push(P('kr-pitch', 'kr.pitch', -39.4, 45.4));
  out.push(P('kr-stand-n', 'kr.stand.z', -39.2, 34.8, Math.PI), P('kr-stand-s', 'kr.stand.z', -39.2, 55.2), P('kr-stand-w', 'kr.stand.x', -54.1, 45.4, Math.PI));
  out.push(P('kr-fence-gn', 'kr.fence.z7', -26.7, 40.0), P('kr-fence-gs', 'kr.fence.z7', -26.7, 51.0));
  out.push(P('kr-fence-t', 'kr.fence.x12', -45.5, 36.3), P('kr-fence-t2', 'kr.fence.x12', -33.5, 36.3), P('kr-fence-b', 'kr.fence.x12', -45.5, 54.5), P('kr-fence-b2', 'kr.fence.x12', -33.5, 54.5));
  out.push(P('kr-kafe1', 'kr.kafe', -17.5, 37.9), P('kr-kafe2', 'kr.kafe', -17.5, 51.5));
  out.push(P('kr-fiskiye', 'kr.fiskiye', -3.9, 45));
  for (let i = 0; i < 6; i++) { out.push(P('kr-bt' + i, 'kr.bench', -10.6 + i * 2.8, 34.8), P('kr-bb' + i, 'kr.bench', -10.6 + i * 2.8, 55.3, Math.PI)); }
  out.push(P('kr-kirtasiye', 'kr.kirtasiye', 28, 35.2));
  out.push(P('kr-basket', 'kr.basket', 36, 38.9));
  out.push(P('kr-okul', 'kr.okul', 48.85, 37.25), P('kr-kantin', 'kr.kantin', 56.15, 42.8));
  out.push(P('kr-fence-sc1', 'kr.fence.x10', 37.5, 44.4), P('kr-fence-sc2', 'kr.fence.x10', 52.5, 44.4), P('kr-fence-sc3', 'kr.fence.z11', 58.2, 38.9));
  out.push(P('kr-avm', 'kr.avm', 20.15, 50.6));
  out.push(P('kr-metro', 'kr.metro', 8.5, 53.8));
  out.push(P('kr-hastane', 'kr.hastane', 46.95, 53.55), P('kr-acil', 'kr.acil', 57.3, 52.0), P('kr-morg', 'kr.morg', 57.3, 55.5), P('kr-ambpark', 'kr.ambpark', 35.4, 53.55));
  KARSI_TREES.forEach(([x, z], i) => out.push(P('kr-tree' + i, 'kr.treeblock', x, z)));
  return out;
}
