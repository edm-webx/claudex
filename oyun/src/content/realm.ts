/**
 * Karar paketi 2026-10-27 (B, J1): three closed realms, the bus is the only way between them (walking never
 * changes realm). Districts outside the three (tersane, metro, tepe, adalar) stay closed for now.
 * Pure data: no three, no DOM.
 */
export type RealmId = 'iskele' | 'stadyum' | 'belgrad';
export interface Realm {
  id: RealmId; name: string; x0: number; x1: number;
  /** the 42B stop of the realm; the spawn is next to the bus door */
  stop: { x: number; z: number; name: string };
  regions: string[];
}
export const REALMS: Realm[] = [
  { id: 'iskele', name: 'Martıköy İskelesi', x0: -1e9, x1: 62, stop: { x: 6, z: 12.2, name: 'Büfe Karşısı' },
    regions: ['iskele'] },
  { id: 'stadyum', name: 'Stadyum Mahallesi', x0: 392, x1: 452, stop: { x: 404, z: 12.2, name: 'Stadyum Kapısı' }, regions: ['stadyum'] },
  { id: 'belgrad', name: 'Belgrad Ormanı', x0: 780, x1: 900, stop: { x: 806, z: 9, name: 'Orman Durağı' }, regions: ['orman'] },
];
export const REALM_BY_ID = Object.fromEntries(REALMS.map(r => [r.id, r])) as Record<RealmId, Realm>;
export function realmAt(x: number): Realm | null { for (const r of REALMS) if (x >= r.x0 && x < r.x1) return r; return null; }
export function realmOfRegion(id: string): Realm | null { return REALMS.find(r => r.regions.includes(id)) || null; }
/** spawn = where the bus drops you (next to its front door) */
export function realmSpawn(r: Realm): { x: number; z: number } { return { x: r.stop.x + 1.5, z: r.stop.z + 1.2 }; }
/** the realm walls a walker can bump into (inner edges only) */
export const REALM_WALLS = [392, 452];
