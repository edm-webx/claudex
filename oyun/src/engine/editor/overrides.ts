// Editor content overrides (Builder D). Small and DOM-free so boot/zones can apply saved layout edits without
// loading the editor itself (the editor module is lazy, ?edit=1 only).
// Storage: platform.idb key OVERRIDES_KEY (primary) mirrored to platform.storage (same key, JSON).
// Versioning (MOTOR §18 "ignored when content changes underneath"): every entry keeps `base` = the placement fields
// as the content had them when the edit was made; an entry applies only while the content still has that base.
import type { PrefabPlacement, ZoneDef, Platform } from '../api';

export const OVERRIDES_KEY = 'marti-editor-overrides';
export type PlacementFields = Pick<PrefabPlacement, 'pos' | 'rotY' | 'scale' | 'y'>;
export interface OverrideEntry { base: PlacementFields; set: PlacementFields; }
export interface OverrideFile { v: 1; at: number; zones: Record<string, Record<string, OverrideEntry>>; }

export const emptyOverrides = (): OverrideFile => ({ v: 1, at: 0, zones: {} });

export function pickFields(p: Partial<PrefabPlacement>): PlacementFields {
  const o: PlacementFields = { pos: { x: p.pos ? p.pos.x : 0, z: p.pos ? p.pos.z : 0 } };
  if (p.rotY != null) o.rotY = p.rotY;
  if (p.scale != null) o.scale = p.scale;
  if (p.y != null) o.y = p.y;
  return o;
}
const near = (a: number | undefined, b: number | undefined) => Math.abs((a ?? 0) - (b ?? 0)) < 1e-4;
export function sameFields(a: PlacementFields, b: PlacementFields): boolean {
  return near(a.pos.x, b.pos.x) && near(a.pos.z, b.pos.z) && near(a.rotY, b.rotY) && near(a.scale ?? 1, b.scale ?? 1) && near(a.y, b.y);
}

/** Valid overrides for one zone: placement id -> fields to set (stale entries dropped). */
export function zoneOverrides(file: OverrideFile, def: ZoneDef): Record<string, Partial<PrefabPlacement>> {
  const out: Record<string, Partial<PrefabPlacement>> = {};
  const z = file.zones[def.id]; if (!z) return out;
  for (const p of def.props) {
    const e = z[p.id];
    if (e && sameFields(e.base, pickFields(p))) out[p.id] = { ...e.set, pos: { ...e.set.pos } };
  }
  return out;
}

/** Returns a copy of the zone def with valid overrides applied (zones may call this at register time). */
export function applyOverrides(def: ZoneDef, file: OverrideFile): ZoneDef {
  const ov = zoneOverrides(file, def);
  if (!Object.keys(ov).length) return def;
  return { ...def, props: def.props.map(p => (ov[p.id] ? { ...p, ...ov[p.id] } : p)) };
}

export async function loadOverrides(platform: Pick<Platform, 'idb' | 'storage'>): Promise<OverrideFile> {
  let best: OverrideFile | null = null;
  try { const v = await platform.idb.get<OverrideFile>(OVERRIDES_KEY); if (v && v.v === 1 && v.zones) best = v; } catch { /* fall through */ }
  try {
    const raw = platform.storage.get(OVERRIDES_KEY);
    if (raw) { const v = JSON.parse(raw) as OverrideFile; if (v && v.v === 1 && v.zones && (!best || v.at > best.at)) best = v; }
  } catch { /* corrupt mirror */ }
  return best || emptyOverrides();
}

export async function storeOverrides(platform: Pick<Platform, 'idb' | 'storage' | 'clock'>, file: OverrideFile): Promise<boolean> {
  file.at = platform.clock.wall();
  let ok = false;
  try { ok = await platform.idb.set(OVERRIDES_KEY, file); } catch { ok = false; }
  try { ok = platform.storage.set(OVERRIDES_KEY, JSON.stringify(file)) || ok; } catch { /* quota */ }
  return ok;
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** The TS patch a builder pastes into src/content/zones/<zone>.ts (props entries to update). */
export function patchText(file: OverrideFile): string {
  const lines: string[] = ['// Martı Motoru editör yaması: src/content/zones/<bölge>.ts içindeki props girdilerini güncelle'];
  for (const [zone, ents] of Object.entries(file.zones)) {
    const ids = Object.keys(ents); if (!ids.length) continue;
    lines.push(`// zone '${zone}'`);
    for (const id of ids) {
      const s = ents[id].set;
      const parts = [`id: '${id}'`, `pos: { x: ${r3(s.pos.x)}, z: ${r3(s.pos.z)} }`];
      if (s.rotY != null) parts.push(`rotY: ${r3(s.rotY)}`);
      if (s.scale != null && s.scale !== 1) parts.push(`scale: ${r3(s.scale)}`);
      if (s.y != null) parts.push(`y: ${r3(s.y)}`);
      lines.push(`{ ${parts.join(', ')} },`);
    }
  }
  lines.push('// JSON', JSON.stringify(file));
  return lines.join('\n');
}
