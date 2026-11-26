/**
 * Karar paketi 2026-10-27 (B, J1): three closed realms, the bus is the only way between them (walking never
 * changes realm). Districts outside the three (tersane, metro, tepe, adalar) stay closed for now.
 * Pure data: no three, no DOM.
 */
export type RealmId = 'iskele' | 'mahalle' | 'stadyum' | 'belgrad' | 'avm';
export interface Realm {
  id: RealmId; name: string; x0: number; x1: number;
  /** the 42B stop of the realm; the spawn is next to the bus door */
  stop: { x: number; z: number; name: string };
  regions: string[];
  /** false: no 42B stop (Martı AVM interior: you walk in through the mall's door on the iskele, sim/avm-gecis.ts) */
  bus?: boolean;
}
export const REALMS: Realm[] = [
  { id: 'iskele', name: 'Martıköy İskelesi', x0: -1e9, x1: 62, stop: { x: 6, z: 12.2, name: 'Büfe Karşısı' },
    regions: ['iskele'] },
  // 2026-11-26 sahip: "42B ile ayrı mahalle": arsalar (content/esya.ts a1..a5, x 259..285) bu meydanda; eskiden hiçbir realm'de değildi, oyuncu arsasına gidemiyordu
  { id: 'mahalle', name: 'Martı Konutları', x0: 244, x1: 292, stop: { x: 248, z: 12.2, name: 'Meydan Çeşmesi' }, regions: ['meydan'] },
  { id: 'stadyum', name: 'Stadyum Mahallesi', x0: 392, x1: 452, stop: { x: 404, z: 12.2, name: 'Stadyum Kapısı' }, regions: ['stadyum'] },
  { id: 'belgrad', name: 'Belgrad Ormanı', x0: 780, x1: 900, stop: { x: 806, z: 9, name: 'Orman Durağı' }, regions: ['orman'] },
  // 2026-11-21 owner: "AVM'ye girildiğinde başka bir haritaya geçilsin, ayrı bir level design gibi" (content/avm-kat.ts AVM_OX)
  { id: 'avm', name: 'Martı AVM', x0: 1150, x1: 1250, stop: { x: 1200.15, z: 44.8, name: 'AVM Girişi' }, regions: [], bus: false },
];
/** realms the 42B bus serves */
export const BUS_REALMS = REALMS.filter(r => r.bus !== false);
export const REALM_BY_ID = Object.fromEntries(REALMS.map(r => [r.id, r])) as Record<RealmId, Realm>;
export function realmAt(x: number): Realm | null { for (const r of REALMS) if (x >= r.x0 && x < r.x1) return r; return null; }
export function realmOfRegion(id: string): Realm | null { return REALMS.find(r => r.regions.includes(id)) || null; }
/** spawn = where the bus drops you (next to its front door) */
export function realmSpawn(r: Realm): { x: number; z: number } { return { x: r.stop.x + 1.5, z: r.stop.z + 1.2 }; }
/** the realm walls a walker can bump into (inner edges only) */
export const REALM_WALLS = [244, 292, 392, 452];
