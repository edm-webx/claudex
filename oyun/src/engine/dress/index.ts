/**
 * Dressing slots: every visual piece can be replaced by art later without code changes (MOTOR §12).
 * Decisions:
 * - get(id) returns the loaded art when present, else the slot's code fallback (created once, cached).
 * - Loading is lazy: manifest() only records entries; preload(ids) (per zone) or when(id) starts loads.
 *   Images (webp/jpg/png) become a THREE.Texture (sRGB); for 'atlasRect' slots the entry rect is kept in
 *   texture.userData.rect. GLB files load through GLTFLoader (no Draco) into an Object3D.
 *   Sounds are decoded by audio (D); here a 'sound'/'music' slot just keeps the ArrayBuffer-free fallback.
 * - Failures never throw: the slot keeps its fallback and the id is reported by missing().
 * - `noart` (URL ?noart / #noart): nothing is ever loaded; v2 convention for A/B parity shots.
 * - Unknown ids: get() returns null (never throws) so callers can test cheaply.
 */
import * as T from 'three';
import type { Dress, DressDeps, SlotDef, SlotValue, ArtManifest, ArtEntry, Disposer } from '../api';

export interface MotorDress extends Dress {
  /** Loaded art for a slot, or null (no fallback). */
  art<V = SlotValue>(id: string): V | null;
  readonly manifestEntries: Readonly<ArtManifest>;
}

export function createDress(deps: DressDeps): MotorDress {
  const defs = new Map<string, SlotDef>();
  const fallbacks = new Map<string, SlotValue>();
  const loaded = new Map<string, SlotValue>();
  const loading = new Map<string, Promise<void>>();
  const waits = new Map<string, Set<(v: SlotValue) => void>>();
  let manifest: ArtManifest = {};
  const base = deps.baseUrl != null ? deps.baseUrl : '';

  const fire = (id: string, v: SlotValue) => {
    const ws = waits.get(id); if (!ws) return;
    ws.forEach(cb => { try { cb(v); } catch (e) { deps.log?.warn('[dress] cb', id, e); } });
  };

  function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      if (typeof Image === 'undefined') { rej(new Error('no Image')); return; }
      const im = new Image(); im.decoding = 'async';
      im.onload = () => res(im); im.onerror = () => rej(new Error('load ' + url));
      im.src = url;
    });
  }

  function load(id: string): Promise<void> {
    if (deps.noart) return Promise.resolve();
    const e: ArtEntry | undefined = manifest[id];
    if (!e) return Promise.resolve();
    const prev = loading.get(id); if (prev) return prev;
    const url = /^(data:|blob:|https?:|\/)/.test(e.file) ? e.file : base + e.file;
    const p = (async () => {
      try {
        let v: SlotValue = null;
        if (/\.(glb|gltf)$/i.test(e.file)) {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const g = await new GLTFLoader().loadAsync(url);
          const o = g.scene;
          if (e.scale) o.scale.setScalar(e.scale);
          if (e.offset) o.position.set(e.offset.x, e.offset.y, e.offset.z);
          v = o;
        } else {
          const im = await loadImage(url);
          const t = new T.Texture(im); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true;
          if (e.rect) t.userData.rect = e.rect.slice();
          v = t;
        }
        loaded.set(id, v); fire(id, v);
      } catch (err) {
        deps.log?.warn('[dress] missing art', id, (err as Error).message);
      }
    })();
    loading.set(id, p);
    return p;
  }

  const api: MotorDress = {
    get noart() { return !!deps.noart; },
    get manifestEntries() { return manifest; },
    define(def: SlotDef) {
      defs.set(def.id, def);
      if (fallbacks.has(def.id)) fallbacks.delete(def.id);
    },
    has(id: string) { return defs.has(id) || id in manifest; },
    get<V = SlotValue>(id: string): V {
      const art = loaded.get(id);
      if (art != null) return art as unknown as V;
      if (!fallbacks.has(id)) {
        const d = defs.get(id);
        let v: SlotValue = null;
        if (d) { try { v = d.fallback(); } catch (e) { deps.log?.warn('[dress] fallback threw', id, e); } }
        fallbacks.set(id, v);
      }
      return fallbacks.get(id) as unknown as V;
    },
    art<V = SlotValue>(id: string): V | null { return (loaded.get(id) as unknown as V) ?? null; },
    when<V = SlotValue>(id: string, cb: (v: V) => void): Disposer {
      const f = cb as unknown as (v: SlotValue) => void;
      const art = loaded.get(id);
      if (art != null) { try { f(art); } catch (e) { deps.log?.warn('[dress] cb', id, e); } return () => { /* already fired */ }; }
      let ws = waits.get(id); if (!ws) waits.set(id, ws = new Set());
      ws.add(f);
      void load(id);
      return () => { ws!.delete(f); };
    },
    manifest(m: ArtManifest) { manifest = { ...manifest, ...m }; },
    async preload(ids: readonly string[]) {
      if (deps.noart) return;
      await Promise.all(ids.map(id => load(id)));
    },
    missing() {
      const out: string[] = [];
      defs.forEach((_d, id) => { if (!loaded.has(id)) out.push(id); });
      return out.sort();
    },
  };
  return api;
}
