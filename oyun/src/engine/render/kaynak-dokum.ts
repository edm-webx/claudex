/**
 * PRF-15 bellek dökümü: sahnedeki dokuların ve geometrilerin tahmini GPU baytı, sahibine (ad zinciri) göre gruplanır.
 * Yalnız okur; oyuncu derlemesinde ağaçtan atılır (boot yalnız MODE !== 'production' iken kaydeder).
 * Doku baytı: genişlik x yükseklik x piksel baytı (RGBA8 4, yarım float 8, float 16) x (mip varsa 4/3) x (küp 6).
 * Geometri baytı: tüm özniteliklerin dizi baytı + indeks. Paylaşılan nesne bir kez sayılır (ilk görülen sahip).
 */
import * as T from 'three';

export interface DokumSatir { ad: string; tur: string; w: number; h: number; kb: number; adet: number }
export interface Dokum { dokuMB: number; geoMB: number; doku: DokumSatir[]; geo: { ad: string; kb: number; adet: number }[]; ayniResim: number }

const zincir = (o: T.Object3D, derin: number): string => {
  const p: string[] = [];
  for (let c: T.Object3D | null = o; c && c.type !== 'Scene'; c = c.parent) p.push(c.name || c.type);
  return p.reverse().slice(0, derin).join('/');
};
const pikselBayt = (t: T.Texture): number => (t.type === T.FloatType ? 16 : t.type === T.HalfFloatType ? 8 : 4);
function dokuBayt(t: T.Texture): { w: number; h: number; b: number } {
  const im = t.image as { width?: number; height?: number; videoWidth?: number } | Array<{ width?: number; height?: number }> | undefined;
  const one = Array.isArray(im) ? im[0] : im;
  const w = one?.width || 0, h = one?.height || 0;
  const mip = t.generateMipmaps && t.minFilter !== T.NearestFilter && t.minFilter !== T.LinearFilter ? 4 / 3 : 1;
  return { w, h, b: w * h * pikselBayt(t) * mip * (Array.isArray(im) ? im.length : 1) };
}

/** Groups textures / geometries reachable from `root` by owner path (first `derin` names). */
export function kaynakDokum(root: T.Object3D, derin = 3, max = 40): Dokum {
  const dokuGor = new Set<T.Texture>(), geoGor = new Set<T.BufferGeometry>();
  const dg = new Map<string, DokumSatir>(), gg = new Map<string, { ad: string; kb: number; adet: number }>();
  const resimler = new Map<unknown, number>();
  root.traverse(o => {
    const m = o as T.Mesh;
    if (m.geometry && !geoGor.has(m.geometry)) {
      geoGor.add(m.geometry);
      let b = 0; const g = m.geometry;
      for (const k in g.attributes) b += (g.attributes[k] as T.BufferAttribute).array?.byteLength || 0;
      if (g.index) b += g.index.array.byteLength;
      if ((m as T.InstancedMesh).isInstancedMesh) b += (m as T.InstancedMesh).instanceMatrix.array.byteLength;
      const ad = zincir(o, derin); const r = gg.get(ad) || { ad, kb: 0, adet: 0 }; r.kb += b / 1024; r.adet++; gg.set(ad, r);
    }
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      const rec = mat as unknown as Record<string, unknown>;
      const texs: T.Texture[] = [];
      for (const k in rec) { const v = rec[k] as T.Texture; if (v && v.isTexture) texs.push(v); }
      const u = (mat as T.ShaderMaterial).uniforms;
      if (u) for (const k in u) { const v = u[k]?.value as T.Texture; if (v && v.isTexture) texs.push(v); }
      for (const t of texs) {
        if (dokuGor.has(t)) continue; dokuGor.add(t);
        if (t.image) resimler.set(t.image, (resimler.get(t.image) || 0) + 1);
        const { w, h, b } = dokuBayt(t);
        const tur = (t as T.CanvasTexture).isCanvasTexture ? 'canvas' : (t as T.DataTexture).isDataTexture ? 'data' : (t as T.CubeTexture).isCubeTexture ? 'kup' : t.isRenderTargetTexture ? 'hedef' : 'resim';
        const ad = zincir(o, derin) + ' [' + tur + ' ' + w + 'x' + h + ']';
        const r = dg.get(ad) || { ad, tur, w, h, kb: 0, adet: 0 }; r.kb += b / 1024; r.adet++; dg.set(ad, r);
      }
    }
  });
  let dokuB = 0, geoB = 0; dg.forEach(r => { dokuB += r.kb; }); gg.forEach(r => { geoB += r.kb; });
  let ayni = 0; resimler.forEach(n => { if (n > 1) ayni += n - 1; });
  const yuvarla = <X extends { kb: number }>(a: X[]) => a.sort((x, y) => y.kb - x.kb).slice(0, max).map(r => ({ ...r, kb: Math.round(r.kb) }));
  return { dokuMB: +(dokuB / 1024).toFixed(2), geoMB: +(geoB / 1024).toFixed(2), doku: yuvarla([...dg.values()]), geo: yuvarla([...gg.values()]), ayniResim: ayni };
}
