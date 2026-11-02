/**
 * Prefab system: prefab defs -> built objects (merged per material), placed instances, live redefine.
 * Decisions where MOTOR/CONTRACT are silent:
 * - Two kinds of defs: `parts` (data: merged into one mesh per material through Batch, the v2 merge rule) and
 *   `build(params, kit)` (escape hatch used by the v2 world.js ports). Both may have nested `children` placements.
 * - Cache: one template per (id, params hash). Instances get `template.clone()` (shares geometry + materials), so
 *   placing a cached prefab costs almost nothing. BuiltPrefab.dispose() releases the instance only; templates are
 *   CPU-side and stay cached (zones free GPU buffers with `disposeGpu`, three re-uploads on next use).
 *   redefine() drops the templates of that id and rebuilds every instance ("change one table, all hundred change").
 * - Materials: part.mat names a registered material (registerMaterial); 'name#region' also maps the part's uvs into
 *   a registered atlas region (registerRegions). No mat = shared vertex-colour Lambert ('atlas' when registered).
 * - Dress: a prefab whose slot `prop.<prefabId>` has loaded art (mesh) uses that art instead of the code shape.
 * - `instanced` defs: instances share one InstancedMesh per template mesh and parent; instance.object is an
 *   invisible proxy Group holding the transform (editor reads/drags it through setPlacement).
 * - MotorPrefabDef adds optional pure functions collidersFor/anchorsFor/interactFor(params) for defs whose
 *   colliders depend on params (zones bake walk grids from them without building meshes).
 * - Placement ids are global keys for instance(id); zones keep them unique (content rule: prefix per zone).
 */
import * as T from 'three';
import type { PrefabSystem, PrefabDeps, PrefabDef, PrefabPlacement, PrefabInstance, BuiltPrefab, PrefabKit, PartDef, Rect, AnchorDef, InteractDef } from '../api';
import { Batch, mtx, roundBox, type UVRect } from './batch';

export { Batch, mtx, roundBox } from './batch';
export type Params = Record<string, number | string | boolean>;

export interface MotorPrefabDef extends PrefabDef {
  collidersFor?(params: Params): Rect[];
  anchorsFor?(params: Params): Record<string, AnchorDef>;
  interactFor?(params: Params): InteractDef[];
}
export type InstanceEvent = 'built' | 'removed';
export interface MotorPrefabSystem extends PrefabSystem {
  registerMaterial(name: string, make: () => T.Material): void;
  registerRegions(lookup: (name: string) => UVRect | undefined): void;
  /** Resolved params (def defaults + overrides). */
  params(id: string, overrides?: Params): Params;
  colliders(id: string, overrides?: Params): Rect[];
  anchors(id: string, overrides?: Params): Record<string, AnchorDef>;
  interact(id: string, overrides?: Params): InteractDef[];
  onInstance(cb: (inst: PrefabInstance, ev: InstanceEvent) => void): () => void;
  /** Frees GPU buffers (geometries, textures) under an object; CPU data stays, three re-uploads on next use. */
  disposeGpu(o: T.Object3D, keep?: Set<unknown>): void;
  /** Number of cached templates (tests / perf meter). */
  cached(): number;
  purge(id?: string): void;
}

export function stableKey(p: Params): string {
  return Object.keys(p).sort().map(k => k + '=' + String(p[k])).join('&');
}

interface Template { obj: T.Object3D; colliders: Rect[]; anchors: Record<string, AnchorDef>; interact: InteractDef[]; }
interface Pool { meshes: T.InstancedMesh[]; locals: T.Matrix4[]; slots: Inst[]; parent: T.Object3D; key: string; }

interface Inst extends PrefabInstance {
  _built: BuiltPrefab | null;
  _pool: Pool | null;
  _slot: number;
  _parent: T.Object3D;
  _proxy: T.Group;
  _apply(): void;
  _rebuild(): void;
}

export function createPrefabs(deps: PrefabDeps): MotorPrefabSystem {
  const defs = new Map<string, MotorPrefabDef>();
  const cache = new Map<string, Template>();
  const mats = new Map<string, T.Material>();
  const matMakers = new Map<string, () => T.Material>();
  let regions: (name: string) => UVRect | undefined = () => undefined;
  const instances = new Map<string, Inst>();
  const pools = new Map<string, Pool>();
  const subs = new Set<(i: PrefabInstance, ev: InstanceEvent) => void>();
  const emit = (i: PrefabInstance, ev: InstanceEvent) => subs.forEach(cb => { try { cb(i, ev); } catch (e) { deps.log?.warn('[prefab] cb', e); } });

  function getMat(name: string, color?: string): T.Material {
    const key = name + (color ? '|' + color : '');
    let m = mats.get(key);
    if (m) return m;
    const mk = matMakers.get(name);
    if (mk && !color) m = mk();
    else if (mk && color) { m = mk().clone(); (m as T.MeshLambertMaterial).color?.set(color); }
    else m = new T.MeshLambertMaterial({ vertexColors: true, color: color || '#ffffff' });
    mats.set(key, m);
    return m;
  }
  const kit: PrefabKit = { mat: getMat, roundBox: (w, h, d, r, s) => roundBox(w, h, d, r, s), dress: deps.dress };

  function resolveParams(def: MotorPrefabDef, overrides?: Params): Params { return { ...(def.params || {}), ...(overrides || {}) }; }

  /** Adds one part (and its children) into the per-material batches. */
  function addPart(part: PartDef, batches: Map<string, Batch>, extra: T.Object3D[]) {
    const pos = part.pos || [0, 0, 0], rot = part.rot || [0, 0, 0];
    const M = mtx(pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]);
    const matName = part.mat || 'atlas';
    const [mname, region] = matName.split('#');
    let b = batches.get(mname); if (!b) batches.set(mname, b = new Batch());
    const s = part.size, c = part.color || '#ffffff', uv = region ? regions(region) || null : null;
    b.push(M);
    const o = { uv, seg: part.segments, r: part.radius };
    switch (part.shape) {
      case 'roundBox': b.box(s[0], s[1], s[2], c, 0, 0, 0, { uv, r: part.radius != null ? part.radius : 0.05, s: part.segments || 1 }); break;
      case 'box': b.box(s[0], s[1], s[2], c, 0, 0, 0, { uv, r: 0 }); break;
      case 'cyl': b.cyl(s[0], s[2] || s[0], s[1], c, 0, 0, 0, { uv, seg: part.segments || 12 }); break;
      case 'sphere': b.sph(s[0], c, 0, 0, 0, { uv, ws: part.segments || 12, hs: Math.max(4, Math.round((part.segments || 12) * 0.66)) }); break;
      case 'capsule': b.cap(s[0], s[1], c, 0, 0, 0, o); break;
      case 'lathe': b.lathe(part.points || [[0, 0], [s[0], 0], [s[0], s[1]], [0, s[1]]], c, 0, 0, 0, { uv, seg: part.segments || 14 }); break;
      case 'plane': b.plane(s[0], s[2] || s[1], c, 0, 0, 0, { uv, rx: -Math.PI / 2 }); break;
      case 'extrude': {
        const pts = part.points || [];
        if (pts.length >= 3) {
          const sh = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
          const g = new T.ExtrudeGeometry(sh, { depth: s[2] || 0.1, bevelEnabled: false });
          b.add(g, c, null, { uv });
          g.dispose();
        }
        break;
      }
      case 'slot': {
        const v = part.slot ? deps.dress.get<T.Object3D | null>(part.slot) : null;
        if (v && (v as T.Object3D).isObject3D) { const k = (v as T.Object3D).clone(); k.applyMatrix4(b.st[b.st.length - 1]); extra.push(k); }
        break;
      }
    }
    b.pop();
  }

  function buildPartsObject(def: MotorPrefabDef): T.Object3D {
    const root = new T.Group();
    const batches = new Map<string, Batch>(), extra: T.Object3D[] = [];
    // children parts inherit their parent's transform
    const walk = (parts: PartDef[], parentM: T.Matrix4) => {
      parts.forEach(p => {
        const pos = p.pos || [0, 0, 0], rot = p.rot || [0, 0, 0];
        const M = parentM.clone().multiply(mtx(pos[0], pos[1], pos[2], rot[0], rot[1], rot[2]));
        const [mname] = (p.mat || 'atlas').split('#');
        let b = batches.get(mname); if (!b) batches.set(mname, b = new Batch());
        // the part goes in with the parent matrix as base; addPart applies the part's own pos/rot
        b.st = [parentM.clone()];
        addPart(p, batches, extra);
        if (p.children) walk(p.children, M);
      });
    };
    walk(def.parts, new T.Matrix4());
    batches.forEach((b, mname) => {
      if (b.empty) return;
      const cast = def.parts.some(p => p.castShadow !== false);
      const m = b.mesh(getMat(mname), cast, true); m.name = def.id + ':' + mname; root.add(m);
    });
    extra.forEach(e => root.add(e));
    return root;
  }

  function makeTemplate(id: string, params: Params): Template {
    const def = defs.get(id);
    if (!def) throw new Error('prefab: unknown ' + id);
    let obj: T.Object3D;
    const art = (deps.dress as { art?: (k: string) => unknown }).art?.('prop.' + id) as T.Object3D | null | undefined;
    if (art && art.isObject3D) obj = art.clone();
    else if (def.build) obj = def.build(params, kit);
    else obj = buildPartsObject(def);
    if (def.children) def.children.forEach(ch => {
      const sub = getBuilt(ch.prefab, ch.overrides as Params | undefined);
      const g = sub.obj.clone(); g.name = ch.id;
      g.position.set(ch.pos.x, ch.y || 0, ch.pos.z); g.rotation.y = ch.rotY || 0; if (ch.scale) g.scale.setScalar(ch.scale);
      obj.add(g);
    });
    obj.userData.prefab = id;
    return {
      obj,
      colliders: def.collidersFor ? def.collidersFor(params) : (def.colliders || []).map(r => ({ ...r })),
      anchors: def.anchorsFor ? def.anchorsFor(params) : { ...(def.anchors || {}) },
      interact: def.interactFor ? def.interactFor(params) : (def.interact || []).slice(),
    };
  }

  function getBuilt(id: string, overrides?: Params): Template {
    const def = defs.get(id);
    if (!def) throw new Error('prefab: unknown ' + id);
    const params = resolveParams(def, overrides);
    const key = id + '|' + stableKey(params);
    let t = cache.get(key);
    if (!t) {
      const mk = () => makeTemplate(id, params);
      t = deps.perf ? deps.perf.time('prefab.build', mk) : mk();
      cache.set(key, t);
    }
    return t;
  }

  function build(id: string, overrides?: Params): BuiltPrefab {
    const t = getBuilt(id, overrides);
    const object = t.obj.clone(true);
    return {
      id, object,
      colliders: t.colliders.map(r => ({ ...r })),
      anchors: { ...t.anchors },
      interact: t.interact.slice(),
      dispose() { if (object.parent) object.parent.remove(object); },
    };
  }

  /* ---------- instanced pools ---------- */
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _p = new T.Vector3(), _up = new T.Vector3(0, 1, 0);
  function poolFor(id: string, overrides: Params | undefined, parent: T.Object3D): Pool {
    const def = defs.get(id)!;
    const key = id + '|' + stableKey(resolveParams(def, overrides)) + '|' + parent.uuid;
    let p = pools.get(key);
    if (p) return p;
    const t = getBuilt(id, overrides);
    t.obj.updateMatrixWorld(true);
    const meshes: T.InstancedMesh[] = [], locals: T.Matrix4[] = [];
    t.obj.traverse(o => {
      const m = o as T.Mesh;
      if (!m.isMesh) return;
      const im = new T.InstancedMesh(m.geometry, m.material, 4);
      im.count = 0; im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow; im.name = id + ':inst';
      im.frustumCulled = false;
      im.userData.prefab = id;
      parent.add(im); meshes.push(im); locals.push(m.matrixWorld.clone());
    });
    p = { meshes, locals, slots: [], parent, key };
    pools.set(key, p);
    return p;
  }
  function growPool(p: Pool, need: number) {
    p.meshes.forEach((im, i) => {
      if (im.instanceMatrix.count >= need) return;
      const cap = Math.max(need, im.instanceMatrix.count * 2);
      const n = new T.InstancedMesh(im.geometry, im.material, cap);
      n.count = im.count; n.castShadow = im.castShadow; n.receiveShadow = im.receiveShadow; n.name = im.name; n.frustumCulled = false; n.userData = { ...im.userData };
      for (let k = 0; k < im.count; k++) { im.getMatrixAt(k, _m); n.setMatrixAt(k, _m); }
      p.parent.remove(im); im.dispose(); p.parent.add(n); p.meshes[i] = n;
    });
  }
  function poolWrite(p: Pool, slot: number, inst: Inst) {
    const pl = inst.placement;
    _p.set(pl.pos.x, pl.y || 0, pl.pos.z); _q.setFromAxisAngle(_up, pl.rotY || 0); _s.setScalar(pl.scale || 1);
    const base = new T.Matrix4().compose(_p, _q, _s);
    p.meshes.forEach((im, i) => { _m.multiplyMatrices(base, p.locals[i]); im.setMatrixAt(slot, _m); im.instanceMatrix.needsUpdate = true; });
  }
  function poolAdd(p: Pool, inst: Inst) {
    const slot = p.slots.length; p.slots.push(inst);
    growPool(p, slot + 1);
    p.meshes.forEach(im => { im.count = slot + 1; });
    inst._slot = slot; poolWrite(p, slot, inst);
  }
  function poolRemove(p: Pool, inst: Inst) {
    const slot = inst._slot, last = p.slots.length - 1;
    if (slot < 0) return;
    if (slot !== last) { const mv = p.slots[last]; p.slots[slot] = mv; mv._slot = slot; poolWrite(p, slot, mv); }
    p.slots.pop(); inst._slot = -1;
    p.meshes.forEach(im => { im.count = p.slots.length; });
    if (!p.slots.length) { p.meshes.forEach(im => { p.parent.remove(im); im.dispose(); }); pools.delete(p.key); }
  }

  function place(pl: PrefabPlacement, parent: T.Object3D): PrefabInstance {
    const old = instances.get(pl.id); if (old) old.remove();
    const proxy = new T.Group(); proxy.name = pl.id; proxy.userData.placement = pl.id; proxy.userData.prefab = pl.prefab;
    const inst: Inst = {
      id: pl.id,
      get prefab() { return inst.placement.prefab; },
      get object() { return proxy; },
      placement: { ...pl, pos: { ...pl.pos } },
      _built: null, _pool: null, _slot: -1, _parent: parent, _proxy: proxy,
      _apply() {
        const p = inst.placement;
        proxy.position.set(p.pos.x, p.y || 0, p.pos.z); proxy.rotation.set(0, p.rotY || 0, 0); proxy.scale.setScalar(p.scale || 1);
        proxy.updateMatrixWorld(true);
        if (inst._pool && inst._slot >= 0) poolWrite(inst._pool, inst._slot, inst);
      },
      _rebuild() {
        if (inst._built) { inst._built.dispose(); inst._built = null; }
        if (inst._pool) { poolRemove(inst._pool, inst); inst._pool = null; }
        const def = defs.get(inst.placement.prefab);
        if (!def) { deps.log?.warn('[prefab] unknown prefab', inst.placement.prefab); return; }
        const ov = inst.placement.overrides as Params | undefined;
        if (def.instanced) { inst._pool = poolFor(inst.placement.prefab, ov, parent); poolAdd(inst._pool, inst); }
        else { inst._built = build(inst.placement.prefab, ov); proxy.add(inst._built.object); }
        inst._apply();
        emit(inst, 'built');
      },
      setPlacement(p: Partial<PrefabPlacement>) {
        const prevPrefab = inst.placement.prefab, prevOv = stableKey((inst.placement.overrides || {}) as Params);
        inst.placement = { ...inst.placement, ...p, pos: p.pos ? { ...p.pos } : inst.placement.pos };
        if (inst.placement.prefab !== prevPrefab || stableKey((inst.placement.overrides || {}) as Params) !== prevOv) inst._rebuild();
        else inst._apply();
      },
      remove() {
        if (instances.get(inst.id) === inst) instances.delete(inst.id);
        if (inst._built) { inst._built.dispose(); inst._built = null; }
        if (inst._pool) { poolRemove(inst._pool, inst); inst._pool = null; }
        if (proxy.parent) proxy.parent.remove(proxy);
        emit(inst, 'removed');
      },
    };
    parent.add(proxy);
    instances.set(pl.id, inst);
    inst._rebuild();
    return inst;
  }

  function dropCache(id?: string) {
    for (const k of [...cache.keys()]) if (!id || k.startsWith(id + '|')) cache.delete(k);
  }

  function disposeGpu(o: T.Object3D, keep?: Set<unknown>) {
    const seen = new Set<unknown>();
    const tex = (t: unknown) => { if (t && (t as T.Texture).isTexture && !seen.has(t) && !(keep && keep.has(t))) { seen.add(t); (t as T.Texture).dispose(); } };
    o.traverse(n => {
      const m = n as T.Mesh;
      if (m.geometry && !seen.has(m.geometry) && !(keep && keep.has(m.geometry))) { seen.add(m.geometry); m.geometry.dispose(); }
      const mat = m.material as T.Material | T.Material[] | undefined;
      if (!mat) return;
      (Array.isArray(mat) ? mat : [mat]).forEach(mm => {
        const r = mm as unknown as Record<string, unknown>;
        ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'aoMap', 'lightMap', 'bumpMap'].forEach(k => tex(r[k]));
        const u = (mm as T.ShaderMaterial).uniforms;
        if (u) Object.values(u).forEach(v => tex(v && (v as { value: unknown }).value));
      });
    });
  }

  const api: MotorPrefabSystem = {
    kit,
    define(def: PrefabDef) { defs.set(def.id, def as MotorPrefabDef); },
    has: id => defs.has(id),
    def: id => defs.get(id),
    build: (id, overrides) => build(id, overrides as Params | undefined),
    place,
    instances(id?: string) { const out: PrefabInstance[] = []; instances.forEach(i => { if (!id || i.prefab === id) out.push(i); }); return out; },
    instance: id => instances.get(id),
    redefine(def: PrefabDef) {
      defs.set(def.id, def as MotorPrefabDef);
      dropCache(def.id);
      // pools of this prefab are rebuilt from scratch
      instances.forEach(i => { if (i.prefab === def.id) i._rebuild(); });
      // nested users: any def whose children reference it
      const users = [...defs.values()].filter(d => d.children && d.children.some(c => c.prefab === def.id)).map(d => d.id);
      users.forEach(u => { dropCache(u); instances.forEach(i => { if (i.prefab === u) i._rebuild(); }); });
    },
    registerMaterial(name, make) { matMakers.set(name, make); for (const k of [...mats.keys()]) if (k === name || k.startsWith(name + '|')) mats.delete(k); },
    registerRegions(lookup) { regions = lookup; },
    params(id, overrides) { const d = defs.get(id); return d ? resolveParams(d, overrides) : { ...(overrides || {}) }; },
    colliders(id, overrides) {
      const d = defs.get(id); if (!d) return [];
      const p = resolveParams(d, overrides);
      return d.collidersFor ? d.collidersFor(p) : (d.colliders || []).map(r => ({ ...r }));
    },
    anchors(id, overrides) {
      const d = defs.get(id); if (!d) return {};
      const p = resolveParams(d, overrides);
      return d.anchorsFor ? d.anchorsFor(p) : { ...(d.anchors || {}) };
    },
    interact(id, overrides) {
      const d = defs.get(id); if (!d) return [];
      const p = resolveParams(d, overrides);
      return d.interactFor ? d.interactFor(p) : (d.interact || []).slice();
    },
    onInstance(cb) { subs.add(cb); return () => { subs.delete(cb); }; },
    disposeGpu,
    cached: () => cache.size,
    purge(id?: string) { dropCache(id); },
  };
  return api;
}
