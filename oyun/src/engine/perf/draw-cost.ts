/**
 * PRF-06 draw-cost table: where the draw calls, triangles and shadow passes of the current frame come from.
 * Pure read of the scene graph (nothing changes on screen). One row per direct child of the scene (zone roots, crowds,
 * stadium, forest, ...) plus a per-prefab roll-up (userData.prefab of the nearest ancestor).
 * - tahminiCagri = main-pass draws inside the camera frustum + shadow-pass draws inside the sun's shadow frustum
 *   (three culls shadow casters against the light camera), counted per material group like three's renderer.
 * - tekrarMateryal = materials that have the same look (type, colour, map, opacity, side, ...) as another one but are a separate object
 *   (each costs a state change and keeps the program cache busy).
 */
import * as T from 'three';

export interface DrawCostRow {
  grup: string;
  gorunurMesh: number; instancedMesh: number; instanceToplam: number;
  benzersizMateryal: number; tekrarMateryal: number;
  ucgen: number; golgeMesh: number; golgeCagri: number; seffafMesh: number;
  frustumIcinde: number; tahminiCagri: number;
}
export interface DrawCostPrefab { prefab: string; mesh: number; cagri: number; golge: number; ucgen: number }
/** shadow-pass draws by world bounding radius (m): where a shadow budget would bite */
export interface ShadowSizes { r02: number; r035: number; r06: number; r1: number; buyuk: number; ornek: { ad: string; r: number }[] }
export interface DrawCost { satirlar: DrawCostRow[]; prefablar: DrawCostPrefab[]; toplam: DrawCostRow; golgeBoy: ShadowSizes; /** heaviest meshes in view by triangles */ enAgir: { ad: string; ucgen: number; adet: number }[] }

const _fr = /* @__PURE__ */ new T.Frustum(), _sf = /* @__PURE__ */ new T.Frustum(), _m = /* @__PURE__ */ new T.Matrix4(), _sp = /* @__PURE__ */ new T.Sphere();

const matKey = (m: T.Material): string => {
  const a = m as T.Material & { color?: T.Color; map?: T.Texture | null; emissive?: T.Color; roughness?: number; metalness?: number; vertexColors?: boolean };
  return [m.type, a.color?.getHexString() ?? '', a.map?.uuid ?? '', a.emissive?.getHexString() ?? '', a.roughness ?? '', a.metalness ?? '',
    m.opacity, m.transparent ? 1 : 0, m.side, a.vertexColors ? 1 : 0, m.alphaTest, m.depthWrite ? 1 : 0].join('|');
};

const triCount = (g: T.BufferGeometry): number => {
  const n = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
  const dr = g.drawRange; const c = Math.min(n, dr.count === Infinity ? n : dr.count);
  return Math.floor(c / 3);
};

const blank = (grup: string): DrawCostRow => ({ grup, gorunurMesh: 0, instancedMesh: 0, instanceToplam: 0, benzersizMateryal: 0, tekrarMateryal: 0, ucgen: 0, golgeMesh: 0, golgeCagri: 0, seffafMesh: 0, frustumIcinde: 0, tahminiCagri: 0 });

/** Intersection test that mirrors WebGLRenderer.projectObject: frustumCulled=false always passes. */
function inFrustum(f: T.Frustum, o: T.Object3D): boolean {
  if (!o.frustumCulled) return true;
  if ((o as T.Sprite).isSprite) return f.intersectsSprite(o as T.Sprite);
  return f.intersectsObject(o);
}

/**
 * @param scene the live scene; @param camera the main camera; @param shadowCam the sun's shadow camera when shadows are on.
 * @param top how many rows/prefabs to keep (sorted by tahminiCagri).
 */
export function drawCostTable(scene: T.Object3D, camera: T.Camera, shadowCam?: T.Camera | null, top = 20): DrawCost {
  camera.updateMatrixWorld();
  _fr.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const sh = !!shadowCam;
  if (shadowCam) { shadowCam.updateMatrixWorld(); _sf.setFromProjectionMatrix(_m.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse)); }
  const rows = new Map<string, DrawCostRow & { _mats: Set<T.Material>; _keys: Set<string> }>();
  const pref = new Map<string, DrawCostPrefab>();
  const tot = blank('TOPLAM'); const totMats = new Set<T.Material>(), totKeys = new Set<string>();
  const gb: ShadowSizes = { r02: 0, r035: 0, r06: 0, r1: 0, buyuk: 0, ornek: [] };
  const heavy = new Map<string, { ad: string; ucgen: number; adet: number }>();
  // zone roots are split one level down (zone:iskele/bufe-buyume, ...) so the big zone shows what inside it costs
  const groups: [string, T.Object3D][] = [];
  for (const c of scene.children) {
    if (!c.visible) continue;
    if (c.name.startsWith('zone:')) for (const g of c.children) groups.push([`${c.name}/${g.name || g.userData?.prefab || g.type}`, g]);
    else groups.push([c.name || c.type, c]);
  }
  for (const [name, child] of groups) {
    if (!child.visible) continue;
    child.traverseVisible(o => {
      const mesh = o as T.Mesh;
      if (!(mesh.isMesh || (o as T.Sprite).isSprite || (o as T.Points).isPoints || (o as T.Line).isLine)) return;
      const geo = mesh.geometry as T.BufferGeometry | undefined; if (!geo) return;
      let r = rows.get(name); if (!r) { r = { ...blank(name), _mats: new Set(), _keys: new Set() }; rows.set(name, r); }
      const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(Boolean) as T.Material[];
      const groups = Array.isArray(mesh.material) && geo.groups.length ? geo.groups.length : 1;
      const inst = (o as T.InstancedMesh).isInstancedMesh ? (o as T.InstancedMesh).count : 1;
      if (inst <= 0) return;
      const tris = triCount(geo) * inst;
      const vis = inFrustum(_fr, o);
      const cast = sh && mesh.castShadow && !(o as T.Sprite).isSprite;
      const castIn = cast && inFrustum(_sf, o);
      const transp = mats.some(m => m.transparent);
      let p: T.Object3D | null = o; let pn = '';
      while (p) { if (p.userData && typeof p.userData.prefab === 'string') { pn = p.userData.prefab; break; } p = p.parent; }
      const calls = (vis ? groups : 0) + (castIn ? groups : 0);
      if (vis && tris > 500) {
        const ad = `${name}/${o.parent?.name ?? ''}/${o.name || geo.uuid.slice(0, 6)}`;
        const h = heavy.get(ad); if (h) { h.ucgen += tris; h.adet++; } else heavy.set(ad, { ad, ucgen: tris, adet: 1 });
      }
      if (castIn) {
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        const rr = _sp.copy(geo.boundingSphere!).applyMatrix4(o.matrixWorld).radius;
        if (rr < 0.2) gb.r02 += groups; else if (rr < 0.35) gb.r035 += groups; else if (rr < 0.6) gb.r06 += groups; else if (rr < 1) gb.r1 += groups; else gb.buyuk += groups;
        if (gb.ornek.length < 60) gb.ornek.push({ ad: `${name}/${o.parent?.name ?? ''}/${o.name}`, r: +rr.toFixed(2) });
      }
      for (const R of [r, tot]) {
        R.gorunurMesh++;
        if (inst > 1 || (o as T.InstancedMesh).isInstancedMesh) { R.instancedMesh++; R.instanceToplam += inst; }
        if (vis) { R.ucgen += tris; R.frustumIcinde++; }
        if (cast) R.golgeMesh++;
        if (castIn) R.golgeCagri += groups;
        if (transp) R.seffafMesh++;
        R.tahminiCagri += calls;
      }
      for (const m of mats) {
        for (const [S, K] of [[r._mats, r._keys], [totMats, totKeys]] as const) if (!S.has(m)) { S.add(m); K.add(matKey(m)); }
      }
      if (pn) {
        let q = pref.get(pn); if (!q) { q = { prefab: pn, mesh: 0, cagri: 0, golge: 0, ucgen: 0 }; pref.set(pn, q); }
        q.mesh++; q.cagri += calls; if (castIn) q.golge += groups; if (vis) q.ucgen += tris;
      }
    });
  }
  const satirlar: DrawCostRow[] = [];
  for (const r of rows.values()) {
    const { _mats, _keys, ...rest } = r;
    rest.benzersizMateryal = _keys.size; rest.tekrarMateryal = _mats.size - _keys.size;
    satirlar.push(rest);
  }
  tot.benzersizMateryal = totKeys.size; tot.tekrarMateryal = totMats.size - totKeys.size;
  satirlar.sort((a, b) => b.tahminiCagri - a.tahminiCagri || b.ucgen - a.ucgen);
  const prefablar = [...pref.values()].sort((a, b) => b.cagri - a.cagri || b.ucgen - a.ucgen);
  return { satirlar: satirlar.slice(0, top), prefablar: prefablar.slice(0, top), toplam: tot, golgeBoy: gb, enAgir: [...heavy.values()].sort((a, b) => b.ucgen - a.ucgen).slice(0, top) };
}
