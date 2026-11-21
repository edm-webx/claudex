/**
 * PRF-03 shader gate: nothing new is drawn before its shader program is linked.
 * Streamed zones are warmed when their build queue empties, but views also add meshes on their own (shop interiors when the
 * player walks up, GLB models when the file arrives, characters). Their first sight used to link the program inside the
 * frame: a blocking compile, the Chrome freeze. The gate notes every Object3D.add (one array push), and before a frame the
 * render pipeline asks collect(): newly added meshes whose material has no program yet are put on camera layer mask 0
 * (not drawn, no shadow) while compileAsync links them in parallel; release() puts them back. Layers are unused elsewhere
 * in the game, so this never fights a view's own visibility. Hold time = parallel compile time (a few frames).
 */
import * as T from 'three';

type Drawable = T.Object3D & { material?: T.Material | T.Material[]; isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean };

const QUEUE_MAX = 4096;
const queue: T.Object3D[] = [];
let overflow = false, listeners = 0, patched = false;

function patch(): void {
  if (patched) return;
  patched = true;
  const add = T.Object3D.prototype.add;
  T.Object3D.prototype.add = function (this: T.Object3D, ...objs: T.Object3D[]) {
    const r = add.apply(this, objs);
    if (listeners > 0) { if (queue.length + objs.length > QUEUE_MAX) { overflow = true; queue.length = 0; } else for (const o of objs) queue.push(o); }
    return r;
  } as typeof add;
}

export interface WarmGate {
  /** something was added since the last collect */
  dirty(): boolean;
  /** holds new drawables of `sc` whose material `needs` a program; returns the objects held now */
  collect(sc: T.Object3D, needs: (m: T.Material) => boolean): T.Object3D[];
  /** puts the given held objects (default: all) back on their own layers */
  release(list?: T.Object3D[]): number;
  held(): number;
  /** forget the queue (after a full-scene warm everything already has a program) */
  clear(): void;
  dispose(): void;
}

export function createWarmGate(): WarmGate {
  patch();
  listeners++;
  const held = new Map<T.Object3D, number>();
  const rootOf = (o: T.Object3D) => { let r = o; while (r.parent) r = r.parent; return r; };
  const visit = (o: T.Object3D, needs: (m: T.Material) => boolean, out: T.Object3D[]) => {
    o.traverse(c => {
      const d = c as Drawable;
      if (!d.material || !(d.isMesh || d.isPoints || d.isLine || d.isSprite) || held.has(d)) return;
      const mats = Array.isArray(d.material) ? d.material : [d.material];
      if (!mats.some(m => m && needs(m))) return;
      held.set(d, d.layers.mask); d.layers.mask = 0; out.push(d);
    });
  };
  let alive = true;
  return {
    dirty: () => overflow || queue.length > 0,
    collect(sc, needs) {
      const out: T.Object3D[] = [];
      if (overflow) { overflow = false; queue.length = 0; visit(sc, needs, out); }
      else {
        const list = queue.splice(0, queue.length), seen = new Set<T.Object3D>();
        for (const o of list) { if (seen.has(o)) continue; seen.add(o); if (rootOf(o) === sc) visit(o, needs, out); }
      }
      return out;
    },
    release(list) {
      let n = 0;
      const put = (o: T.Object3D) => { const mask = held.get(o); if (mask === undefined) return; if (o.layers.mask === 0) o.layers.mask = mask; held.delete(o); n++; };
      if (list) list.forEach(put); else [...held.keys()].forEach(put);
      return n;
    },
    held: () => held.size,
    clear() { queue.length = 0; overflow = false; },
    dispose() { if (!alive) return; alive = false; this.release(); listeners = Math.max(0, listeners - 1); if (!listeners) { queue.length = 0; overflow = false; } },
  };
}
