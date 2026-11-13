// Hot reload hookup (Builder D, MOTOR §18). Keeps GameState and component stores; only rebuilds what a content
// table change touches:
//   prefabs -> prefab.redefine(def) for every def whose JSON changed (all instances rebuild), new ones define()
//   zones   -> zones.replace(def) for changed zone defs (editor overrides re-applied by the editor on zone state)
//   effects -> fx.redefine / fx.define
//   any other table -> onOther(table) (boot may rebuild views)
// Usage (dev, boot or content/index.ts owner):
//   if (import.meta.hot) import.meta.hot.accept('../content/prefabs/iskele', m => content.replace('prefabs', {...}));
//   installHotReload({ content, prefab, zones, fx });
// Systems: call `swapSystem(scheduler, newSystem)` from a module's own hot.accept: Scheduler.replace keeps state.
import type { PrefabSystem, ZoneManager, Fx, Scheduler, System, Disposer } from '../api';
import type { ContentRegistry, ContentTable } from '../../content/types';

export interface HotDeps { content: ContentRegistry; prefab?: PrefabSystem; zones?: ZoneManager; fx?: Fx; onOther?(table: ContentTable): void; log?(msg: string): void; }

const sig = (v: unknown) => { try { return JSON.stringify(v, (_k, x) => (typeof x === 'function' ? String(x) : x)); } catch { return String(Math.random()); } };

export function installHotReload(d: HotDeps): Disposer {
  const seen: Record<string, Record<string, string>> = { prefabs: {}, zones: {}, effects: {} };
  const snap = (table: 'prefabs' | 'zones' | 'effects') => {
    const t = (d.content.get()[table] || {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const id of Object.keys(t)) out[id] = sig(t[id]);
    return out;
  };
  seen.prefabs = snap('prefabs'); seen.zones = snap('zones'); seen.effects = snap('effects');
  const log = d.log || ((m: string) => console.info('[hot]', m));
  return d.content.onReplace(table => {
    try {
      const c = d.content.get();
      if (table === 'prefabs' || table === 'zones' || table === 'effects') {
        const now = snap(table), before = seen[table];
        const changed = Object.keys(now).filter(id => now[id] !== before[id]);
        seen[table] = now;
        for (const id of changed) {
          if (table === 'prefabs' && d.prefab) { const def = c.prefabs[id]; if (d.prefab.has(id)) d.prefab.redefine(def); else d.prefab.define(def); }
          else if (table === 'zones' && d.zones) { const def = c.zones[id]; if (d.zones.def(id)) d.zones.replace(def); else d.zones.register(def); }
          else if (table === 'effects' && d.fx) { const def = c.effects[id]; if (d.fx.has(id)) d.fx.redefine(def); else d.fx.define(def); }
        }
        log(`${table}: ${changed.length} changed (${changed.slice(0, 6).join(', ')})`);
      } else d.onOther?.(table);
    } catch (e) { console.error('[hot] reload failed', e); }
  });
}

/** Re-register a system after its module hot-reloads (Scheduler.replace keeps GameState and stores). */
export function swapSystem(scheduler: Scheduler, s: System): void {
  try { scheduler.replace(s.id, s); } catch (e) { console.error('[hot] system swap failed', s.id, e); }
}
