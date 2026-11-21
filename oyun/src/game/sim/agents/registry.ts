/** Actor registry (see types.ts). Pure data, ids are never reused. */
import type { Vec2 } from '../../../engine/api';
import type { Actor, ActorKind, ActorRegistry } from './types';

export function createActorRegistry(): ActorRegistry {
  const list: Actor[] = [];
  let nextId = 1;
  const reg: ActorRegistry & { version: number } = {
    list, version: 0,
    get: (id) => list.find((a) => a.id === id),
    byKey: (kind, key) => list.find((a) => a.kind === kind && a.key === key && !a.dead),
    add(kind: ActorKind, key: string, rig: Record<string, unknown>, at: Vec2, info: Record<string, unknown> = {}) {
      const a: Actor = {
        id: nextId++, kind, key, rig, x: at.x, z: at.z, px: at.x, pz: at.z, y: 0, py: 0, rot: 0, prot: 0, speed: 0,
        act: 'idle', mood: 'ok', carry: [], say: '', sayT: 0, fx: '', state: '', info, dead: false,
      };
      list.push(a); reg.version++;
      return a;
    },
    remove(a) {
      a.dead = true;
      const i = list.indexOf(a);
      // Keep the dead record one more view frame: the view removes the rig when it sees dead, then compaction happens in beginTick.
      if (i < 0) return;
      reg.version++;
    },
    beginTick() {
      for (let i = list.length - 1; i >= 0; i--) {
        const a = list[i];
        if (a.dead) { if ((a.info as { _gone?: number })._gone) list.splice(i, 1); else (a.info as { _gone?: number })._gone = 1; continue; }
        a.px = a.x; a.pz = a.z; a.prot = a.rot; a.py = a.y;
      }
    },
  };
  return reg;
}
