/**
 * PRF-06 static merge: the opaque meshes under one group that never move relative to it are baked into one mesh per
 * (material, shadow flags). Same vertices in the same place, so the picture does not change; the draw calls drop to one per
 * material. Only for view-built groups whose parts nobody looks up or animates (the caller decides); transparent, instanced,
 * skinned, multi-material and non-indexed meshes stay as they are. The originals are removed and their geometry disposed
 * (callers pass groups whose geometries are not shared).
 */
import * as T from 'three';

const _m = /* @__PURE__ */ new T.Matrix4(), _inv = /* @__PURE__ */ new T.Matrix4();
const plain = (a: T.BufferAttribute | T.InterleavedBufferAttribute | undefined) => !a || (!(a as T.InterleavedBufferAttribute).isInterleavedBufferAttribute && a.array instanceof Float32Array);

/** @returns how many draw calls were saved */
export function mergeStatic(root: T.Object3D, opts: { keepGeometry?: boolean } = {}): number {
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map<string, T.Mesh[]>();
  root.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh || (o as T.InstancedMesh).isInstancedMesh || (o as T.SkinnedMesh).isSkinnedMesh || Array.isArray(m.material)) return;
    const mat = m.material as T.Material, g = m.geometry;
    if (mat.transparent || m.userData.noMerge || !g.index || !g.attributes.position || !g.attributes.normal || g.morphAttributes.position
      || !plain(g.attributes.position) || !plain(g.attributes.normal) || !plain(g.attributes.uv)) return;
    const k = `${mat.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${g.attributes.uv ? 1 : 0}|${m.renderOrder}|${m.visible ? 1 : 0}`;
    let b = buckets.get(k); if (!b) buckets.set(k, b = []); b.push(m);
  });
  let saved = 0;
  for (const list of buckets.values()) {
    if (list.length < 2 || !list[0].visible) continue;
    let nv = 0, ni = 0;
    for (const m of list) { nv += m.geometry.attributes.position.count; ni += m.geometry.index!.count; }
    const hasUv = !!list[0].geometry.attributes.uv;
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = hasUv ? new Float32Array(nv * 2) : null;
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const m of list) {
      const g = m.geometry.clone().applyMatrix4(_m.multiplyMatrices(_inv, m.matrixWorld)), I = g.index!;
      pos.set(g.attributes.position.array as Float32Array, vo * 3); nor.set(g.attributes.normal.array as Float32Array, vo * 3);
      if (uv) uv.set(g.attributes.uv.array as Float32Array, vo * 2);
      for (let i = 0; i < I.count; i++) idx[io + i] = I.getX(i) + vo;
      vo += g.attributes.position.count; io += I.count; g.dispose();
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3));
    if (uv) geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
    geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
    const f = list[0], out = new T.Mesh(geo, f.material);
    out.name = (root.name || 'grup') + ':birlesik'; out.castShadow = f.castShadow; out.receiveShadow = f.receiveShadow; out.renderOrder = f.renderOrder;
    root.add(out);
    for (const m of list) { for (const c of [...m.children]) root.attach(c); m.parent?.remove(m); if (!opts.keepGeometry) m.geometry.dispose(); }   // GRS-06: a part's contact plane stays
    saved += list.length - 1;
  }
  return saved;
}
