/**
 * engine/debug: test hooks (`window.__marti`). Owner: Builder A.
 * `register(name, fn)` adds/overwrites a member; dotted names nest ('editor.select'). Safe headless (plain object target).
 * `ready()` is always present and reflects setReady().
 */
import type { TestHooks, HooksDeps, MartiHooks } from '../api';

export function createHooks(deps: HooksDeps = {}): TestHooks {
  const target: Record<string, unknown> = deps.target ?? {};
  let ready = false;
  target.ready = () => ready;
  return {
    register(name, fn) {
      const parts = name.split('.');
      let o = target;
      for (let i = 0; i < parts.length - 1; i++) {
        const cur = o[parts[i]];
        if (!cur || typeof cur !== 'object') o[parts[i]] = {};
        o = o[parts[i]] as Record<string, unknown>;
      }
      o[parts[parts.length - 1]] = fn;
    },
    get: () => target as Partial<MartiHooks>,
    setReady(on) { ready = on; },
  };
}
