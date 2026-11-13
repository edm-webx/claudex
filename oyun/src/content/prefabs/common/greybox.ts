/**
 * Grey-box prefabs for test zones (parts only, no custom builders): ground slab, block buildings, lamp post, portal
 * gate. Ids are prefixed 'ts.' and used by the test-sokak zone (streaming smoke, acceptance 8).
 * Colours stay in the v2 palette family (stone promenade, cream walls) so the seam with the pier reads as one street.
 */
import type { PrefabDef, PartDef } from '../../../engine/api';

const block = (id: string, w: number, h: number, d: number, wall: string, roof: string): PrefabDef => ({
  id,
  parts: [
    { shape: 'box', size: [w, h, d], pos: [0, h / 2, 0], color: wall, name: 'wall' },
    { shape: 'box', size: [w + 0.3, 0.25, d + 0.3], pos: [0, h + 0.12, 0], color: roof, name: 'roof' },
    // door and two windows on the street side (-z when rotY = 0 faces the street at +z; see zone placements)
    { shape: 'box', size: [1.0, 2.1, 0.06], pos: [0, 1.05, d / 2 + 0.03], color: '#6b4a2e', name: 'door' },
    { shape: 'box', size: [1.1, 1.0, 0.06], pos: [-w / 4 - 0.3, h * 0.62, d / 2 + 0.03], color: '#9cc3d6', name: 'win0' },
    { shape: 'box', size: [1.1, 1.0, 0.06], pos: [w / 4 + 0.3, h * 0.62, d / 2 + 0.03], color: '#9cc3d6', name: 'win1' },
  ],
  colliders: [{ x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }],
  anchors: { door: { pos: { x: 0, z: d / 2 + 0.6 }, kind: 'door' } },
});

const lampParts: PartDef[] = [
  { shape: 'cyl', size: [0.06, 3.1, 0.08], pos: [0, 1.55, 0], color: '#2f3a3f', segments: 6, name: 'pole' },
  { shape: 'sphere', size: [0.17, 0, 0], pos: [0, 3.2, 0], color: '#fff1c0', mat: 'bulb', segments: 8, name: 'bulb' },
];

export const GREYBOX_PREFABS: PrefabDef[] = [
  { id: 'ts.ground', params: { w: 70, d: 18 }, parts: [
    { shape: 'plane', size: [70, 0, 18], pos: [0, 0.01, 0], color: '#cfc6b6', name: 'ground' },
    { shape: 'box', size: [70, 0.12, 0.25], pos: [0, 0.06, -4.3], color: '#b9ad99', name: 'kerbS' },
    { shape: 'box', size: [70, 0.12, 0.25], pos: [0, 0.06, 4.35], color: '#b9ad99', name: 'kerbN' },
  ] },
  block('ts.block-a', 6, 5, 4, '#efe3cf', '#a8553d'),
  block('ts.block-b', 8, 7, 5, '#e6d8c0', '#7e8b8f'),
  block('ts.block-c', 5, 9, 4, '#f2ead9', '#a8553d'),
  { id: 'ts.lamp', parts: lampParts, colliders: [{ x0: -0.15, x1: 0.15, z0: -0.15, z1: 0.15 }] },
  { id: 'ts.gate', parts: [
    { shape: 'box', size: [0.3, 3.2, 0.3], pos: [0, 1.6, -4.4], color: '#8a5d3b', name: 'postS' },
    { shape: 'box', size: [0.3, 3.2, 0.3], pos: [0, 1.6, 4.4], color: '#8a5d3b', name: 'postN' },
    { shape: 'box', size: [0.3, 0.4, 9.1], pos: [0, 3.3, 0], color: '#8a5d3b', name: 'beam' },
    { shape: 'box', size: [0.08, 0.6, 3.0], pos: [-0.18, 2.8, 0], color: '#fff6e6', name: 'board' },
  ], colliders: [{ x0: -0.15, x1: 0.15, z0: -4.55, z1: -4.25 }, { x0: -0.15, x1: 0.15, z0: 4.25, z1: 4.55 }] },
];
