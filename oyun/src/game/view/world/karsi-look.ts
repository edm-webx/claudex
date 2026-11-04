/**
 * Karşı yaka models: Kenney CC0 buildings and trees dropped onto the footprints that content/zones/karsi.ts
 * colliders define. Pure view; if a model fails to load the footprint just stays an empty paved slab.
 */
import * as T from 'three';
import { loadGlb, fitClone } from './glb';

export interface KarsiLookDeps { root: () => T.Object3D | null }
export interface KarsiLookView { update(dt: number): void; dispose(): void }

// model, centre x/z, footprint w×d, height (undefined = proportional), yaw
const BUILDINGS: [string, number, number, number, number, number | undefined, number][] = [
  ['bina/building-e', 20.15, 50.6, 16.9, 12.8, 9.5, 0],      // AVM
  ['bina/building-k', 46.95, 53.55, 16.9, 6.7, 12.0, 0],     // hastane
  ['bina/building-k', 48.85, 37.25, 18.3, 7.5, 7.8, 0],      // okul
  ['bina/building-c', -17.5, 37.9, 7.0, 9.4, 4.6, Math.PI / 2],   // kafe 1 (front towards the square, +x)
  ['bina/building-c', -17.5, 51.5, 7.0, 9.4, 4.6, Math.PI / 2],   // kafe 2
];

export function createKarsiLook(d: KarsiLookDeps): KarsiLookView {
  const holder = new T.Group(); holder.name = 'karsiModel';
  let started = false;
  const start = () => {
    started = true;
    BUILDINGS.forEach(async ([name, x, z, w, dd, h, yaw]) => {
      const src = await loadGlb(name); if (!src) return;
      const swap = Math.abs(yaw) > 1;     // yawed models swap their footprint axes
      const g = fitClone(src, swap ? dd : w, swap ? w : dd, h, yaw); g.position.set(x, 0.12, z); holder.add(g);
    });
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
