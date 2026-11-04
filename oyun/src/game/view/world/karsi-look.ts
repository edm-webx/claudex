/**
 * Karşı yaka models: Kenney CC0 buildings and trees dropped onto the footprints that content/zones/karsi.ts
 * colliders define. Pure view; if a model fails to load the footprint just stays an empty paved slab.
 */
import * as T from 'three';
import { loadGlb, fitClone } from './glb';
import { KARSI_TREES } from '../../../content/zones/karsi';

export interface KarsiLookDeps { root: () => T.Object3D | null }
export interface KarsiLookView { update(dt: number): void; dispose(): void }

// model, centre x/z, footprint w×d, height (undefined = proportional), yaw
const BUILDINGS: [string, number, number, number, number, number | undefined, number, string?][] = [
  ['bina/building-e', 20.15, 50.6, 16.9, 12.8, 9.5, 0, '#ffe2bc'],      // AVM
  ['bina/building-k', 46.95, 53.55, 16.9, 6.7, 12.0, 0, '#fff0f0'],     // hastane
  ['bina/building-k', 48.85, 37.25, 18.3, 7.5, 7.8, 0, '#ffd4a8'],
  ['bina/building-a', 28, 35.2, 7.1, 3.6, 3.6, 0, '#c4deff'],     // kırtasiye
  ['bina/building-a', 56.15, 42.8, 3.7, 2.8, 3.0, Math.PI / 2, '#ffb894'],   // kantin      // okul
  ['bina/building-c', -17.5, 37.9, 7.0, 9.4, 4.6, Math.PI / 2, '#ffcfa8'],   // kafe 1 (front towards the square, +x)
  ['bina/building-c', -17.5, 51.5, 7.0, 9.4, 4.6, Math.PI / 2, '#ffc0a0'],   // kafe 2
];

export function createKarsiLook(d: KarsiLookDeps): KarsiLookView {
  const holder = new T.Group(); holder.name = 'karsiModel';
  let started = false;
  const start = () => {
    started = true;
    BUILDINGS.forEach(async ([name, x, z, w, dd, h, yaw, tint]) => {
      const src = await loadGlb(name); if (!src) return;
      const swap = Math.abs(yaw) > 1;     // yawed models swap their footprint axes
      const g = fitClone(src, swap ? dd : w, swap ? w : dd, h, yaw, tint); g.position.set(x, 0.12, z); holder.add(g);
    });
    // Kenney nature-kit trees on the collider stubs (vertex colours, a few species)
    const SP = ['dogal/tree_oak_dark', 'dogal/tree_detailed', 'dogal/tree_pineTallB_detailed', 'dogal/tree_simple'];
    KARSI_TREES.forEach(async ([x, z], i) => { const src = await loadGlb(SP[i % SP.length]); if (!src) return; const s = 0.85 + (i * 37 % 10) / 28; const g = fitClone(src, 3.4 * s, 3.4 * s, (i % 4 === 2 ? 6.2 : 4.8) * s, i * 1.3); g.position.set(x, 0.05, z); holder.add(g); });
    // parked ambulances (lot x 32.4..38.4, z 50.2..56.9)
    [33.9, 36.9].forEach(async (x, i) => { const src = await loadGlb('auto/ambulance'); if (!src) return; const g = fitClone(src, 2.1, 4.6, undefined, i ? 0.15 : -0.1); g.position.set(x, 0.07, 53.55); holder.add(g); });
  };
  return {
    update() {
      const root = d.root(); if (!root) return;
      if (holder.parent !== root) root.add(holder);
      if (!started) start();
    },
    dispose() { holder.parent?.remove(holder); },
  };
}
