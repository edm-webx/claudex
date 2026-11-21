/**
 * PRF-09 hayaletlenme tanısı: sahne grafiğini yalnız okur (ekranda hiçbir şey değişmez).
 * - kutuda(box): dünya sınır kutusu verilen kutuya değen görünür mesh'ler (ad zinciri, üçgen, malzeme, y aralığı).
 * - kopyalar(): aynı geometri + aynı malzeme görünüşü + aynı dünya matrisiyle iki kez çizilen mesh'ler (çift çizim = z-fighting
 *   titremesi ve "çift görüntü"), eş düzlemli çakışmalar (aynı yükseklikte yatay yüzeyler, polygonOffset'siz) ve
 *   görünür ama hiçbir bölgeye/prefaba bağlı olmayan sahne köküne asılı "sadece görüntü" nesneler.
 * Oyuncu derlemesinde ağaçtan atılır (boot yalnız MODE !== 'production' iken kaydeder).
 */
import * as T from 'three';

const _b = /* @__PURE__ */ new T.Box3(), _q = /* @__PURE__ */ new T.Box3();

const adZinciri = (o: T.Object3D): string => {
  const p: string[] = [];
  for (let c: T.Object3D | null = o; c && c.type !== 'Scene' && p.length < 6; c = c.parent) p.push(c.name || c.type);
  return p.reverse().join('/');
};
const gorunur = (o: T.Object3D): boolean => { for (let c: T.Object3D | null = o; c; c = c.parent) if (!c.visible) return false; return true; };
const matImza = (m: T.Material | T.Material[]): string => (Array.isArray(m) ? m : [m]).map(x => {
  const a = x as T.Material & { color?: T.Color; map?: T.Texture | null };
  return x.type + ':' + (a.color?.getHexString() ?? '') + ':' + (a.map?.uuid ?? '') + ':' + (x.transparent ? 't' : 'o');
}).join(',');

export interface TaraSatir { ad: string; ucgen: number; mat: string; y0: number; y1: number; x: number; z: number; parity: string }

/** Visible meshes whose world box touches [x0,x1]x[y0,y1]x[z0,z1]. */
export function kutuda(scene: T.Object3D, k: { x0: number; x1: number; y0?: number; y1?: number; z0: number; z1: number }, max = 80): TaraSatir[] {
  scene.updateMatrixWorld();
  _q.min.set(k.x0, k.y0 ?? -50, k.z0); _q.max.set(k.x1, k.y1 ?? 200, k.z1);
  const out: TaraSatir[] = [];
  scene.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh || out.length >= max || !gorunur(m) || !m.geometry) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    _b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld);
    if (!_b.intersectsBox(_q)) return;
    const g = m.geometry, n = g.index ? g.index.count : (g.attributes.position?.count ?? 0);
    let par = ''; for (let c: T.Object3D | null = m; c && !par; c = c.parent) par = (c.userData?.parity as string) || '';
    out.push({ ad: adZinciri(m), ucgen: Math.floor(n / 3), mat: matImza(m.material), y0: +_b.min.y.toFixed(2), y1: +_b.max.y.toFixed(2), x: +((_b.min.x + _b.max.x) / 2).toFixed(1), z: +((_b.min.z + _b.max.z) / 2).toFixed(1), parity: par });
  });
  return out;
}

export interface KopyaRapor {
  /** same geometry + look + world matrix drawn more than once */
  ciftCizim: { ad: string; adet: number }[];
  /** flat, overlapping, same-height horizontal faces from different meshes without polygonOffset (z-fighting candidates) */
  esDuzlem: { a: string; b: string; y: number }[];
  /** visible meshes hung straight under the scene root with no zone/prefab/parity tag */
  sahipsiz: string[];
  /** frustum-culled meshes whose cached bounding sphere misses part of what they draw: seen from one angle, gone from another */
  bayatKure: { ad: string; tasma: number }[];
  taranan: number;
}

/** Duplicate / coplanar / orphan scan of every visible mesh. */
export function kopyalar(scene: T.Object3D, max = 40): KopyaRapor {
  scene.updateMatrixWorld();
  const imza = new Map<string, { ad: string; adet: number }>();
  const duz: { ad: string; y: number; b: T.Box3; off: boolean; id: number }[] = [];
  const sahipsiz: string[] = [];
  const bayatKure: KopyaRapor['bayatKure'] = [];
  const _s = new T.Sphere(), _mi = new T.Matrix4(), _v = new T.Vector3();
  let taranan = 0;
  scene.traverse(o => {
    const m = o as T.Mesh;
    if (!m.isMesh || !gorunur(m) || !m.geometry) return;
    taranan++;
    const e = m.matrixWorld.elements, key = m.geometry.uuid + '|' + matImza(m.material) + '|' + e.map(v => v.toFixed(3)).join(',');
    const r = imza.get(key); if (r) r.adet++; else imza.set(key, { ad: adZinciri(m), adet: 1 });
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    // a flat horizontal piece (≤ 1 cm thick, ≥ 0.5 m²): ground decals, road lines, slabs
    if (b.max.y - b.min.y < 0.01 && (b.max.x - b.min.x) * (b.max.z - b.min.z) > 0.5 && !(m as T.InstancedMesh).isInstancedMesh)
      duz.push({ ad: adZinciri(m), y: (b.min.y + b.max.y) / 2, b, off: mats.some(x => x.polygonOffset) || mats.every(x => !x.depthWrite || x.transparent), id: m.id });
    if (m.frustumCulled && bayatKure.length < max) {
      const im = m as T.InstancedMesh, cached = im.isInstancedMesh ? im.boundingSphere : m.geometry.boundingSphere;
      if (cached) {
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        let tasma = 0;
        const gs = m.geometry.boundingSphere!;
        if (im.isInstancedMesh) for (let i = 0; i < im.count; i++) { im.getMatrixAt(i, _mi); _s.copy(gs).applyMatrix4(_mi); tasma = Math.max(tasma, _s.center.distanceTo(cached.center) + _s.radius - cached.radius); }
        else { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += Math.max(1, p.count >> 9)) tasma = Math.max(tasma, _v.fromBufferAttribute(p, i).distanceTo(cached.center) - cached.radius); }
        if (tasma > 0.05) bayatKure.push({ ad: adZinciri(m), tasma: +tasma.toFixed(2) });
      }
    }
    if (m.parent && m.parent.type === 'Scene' && !m.userData?.parity && !m.userData?.prefab && !m.name) sahipsiz.push(adZinciri(m));
  });
  const ciftCizim = [...imza.values()].filter(r => r.adet > 1).sort((a, b) => b.adet - a.adet).slice(0, max);
  const esDuzlem: KopyaRapor['esDuzlem'] = [];
  duz.sort((a, b) => a.y - b.y);
  for (let i = 0; i < duz.length && esDuzlem.length < max; i++) for (let j = i + 1; j < duz.length && duz[j].y - duz[i].y < 0.002; j++) {
    const A = duz[i], B = duz[j];
    if (A.off || B.off || !A.b.intersectsBox(B.b)) continue;
    const ox = Math.min(A.b.max.x, B.b.max.x) - Math.max(A.b.min.x, B.b.min.x), oz = Math.min(A.b.max.z, B.b.max.z) - Math.max(A.b.min.z, B.b.min.z);
    if (ox * oz > 0.05) esDuzlem.push({ a: A.ad, b: B.ad, y: +A.y.toFixed(3) });
  }
  return { ciftCizim, esDuzlem, sahipsiz: sahipsiz.slice(0, max), bayatKure, taranan };
}
