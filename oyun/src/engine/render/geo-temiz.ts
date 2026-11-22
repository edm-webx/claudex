/**
 * Geometri temizliği (2026-11-22, "merdivenin iskele tarafındaki ayağı full siyah yanıp sönüyor").
 * Uzunluğu sıfır olan köşe normali shader'da normalize(0) = NaN verir; gerçek GPU'da o piksel NaN olur ve bloom geçişi onu ekran
 * hizalı siyah bloklara yayar (SwiftShader NaN yaymadığı için bulut testlerinde görünmez). İki kaynak:
 *  - earcut kapakları: tek doğru üzerinde dizilen köşeler (basamak burunları) sıfır alanlı üçgen üretir -> dejenereAt
 *  - kutup köşeleri (CapsuleGeometry / LatheGeometry ekseni): komşu yüzlerin ortalaması sıfıra düşer -> normalOnar
 * Denetim: tests/browser/es-duzlem.mjs (BOZUK NORMAL) ve tests/unit/geo-temiz.test.ts.
 */
import * as T from 'three';

/** Sıfır alanlı üçgenleri atar, normalleri yeniden hesaplar (indekssiz döner, öteki öznitelikler korunur). Görüntü aynı kalır. */
export function dejenereAt(src: T.BufferGeometry, eps = 1e-10): T.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src.clone(), p = g.attributes.position, keep: number[] = [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  for (let i = 0; i + 2 < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    if (b.sub(a).cross(c.sub(a)).lengthSq() > eps) keep.push(i, i + 1, i + 2);
  }
  const out = new T.BufferGeometry();
  for (const [k, at] of Object.entries(g.attributes)) {
    const A = at as T.BufferAttribute, n = A.itemSize, src2 = A.array as ArrayLike<number>;
    const arr = new (A.array.constructor as Float32ArrayConstructor)(keep.length * n);
    keep.forEach((v, j) => { for (let q = 0; q < n; q++) arr[j * n + q] = src2[v * n + q]; });
    out.setAttribute(k, new T.BufferAttribute(arr, n, A.normalized));
  }
  g.dispose(); out.computeVertexNormals();
  return out;
}

/** Sıfır/NaN normalleri onarır: köşenin geometri merkezine göre yönü (kapsül/küre/torna kutbunda doğru normal). Yerinde, geo döner. */
export function normalOnar<G extends T.BufferGeometry>(geo: G): G {
  const n = geo.attributes.normal as T.BufferAttribute | undefined, p = geo.attributes.position;
  if (!n || !p) return geo;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const c = geo.boundingBox!.getCenter(new T.Vector3()), v = new T.Vector3();
  let fixed = 0;
  for (let i = 0; i < n.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
    if (l > 0.5) continue;
    v.fromBufferAttribute(p, i).sub(c); if (v.lengthSq() < 1e-12) v.set(0, 1, 0);
    v.normalize(); n.setXYZ(i, v.x, v.y, v.z); fixed++;
  }
  if (fixed) n.needsUpdate = true;
  return geo;
}

/** Uzunluğu 0.5'ten küçük ya da NaN olan normal sayısı (test ve denetim için). */
export function bozukNormalSay(geo: T.BufferGeometry): number {
  const n = geo.attributes.normal; if (!n) return 0;
  let k = 0; for (let i = 0; i < n.count; i++) if (!(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) > 0.5)) k++;
  return k;
}
