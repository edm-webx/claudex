/**
 * 2026-11-25: ürün ikonları 3D modelin kendisinden (content/prefabs/yemek): sipariş paneli, menü çipleri emoji / düz yazı yerine
 * yemeğin küçük resmini gösterir. İlk istekte küçük bir ayrı renderer ile 96 px çizilir, data URL önbelleğe girer; renderer
 * birkaç saniye boşta kalınca bırakılır (ikinci WebGL bağlamı kalıcı durmaz). WebGL yoksa '' döner (çağıran yazıyla kalır).
 */
import * as T from 'three';
import { yemekVar, yemekGeo } from '../../content/prefabs/yemek/yemek-geo';
import { MAT } from '../../content/prefabs/common/v2kit';

const cache = new Map<string, string>();
let R: T.WebGLRenderer | null = null, sc: T.Scene | null = null, cam: T.PerspectiveCamera | null = null, mesh: T.Mesh | null = null, bos = 0;
const S = 96, SPH = new T.Sphere();
function kur(): boolean {
  if (R) return true;
  try {
    R = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); R.setSize(S, S, false); R.setClearColor(0x000000, 0); R.outputColorSpace = T.SRGBColorSpace;
    sc = new T.Scene(); sc.add(new T.HemisphereLight('#fff6e6', '#9a8a70', 1.6)); const dl = new T.DirectionalLight('#ffffff', 2.2); dl.position.set(2, 4, 3); sc.add(dl);
    cam = new T.PerspectiveCamera(30, 1, 0.01, 10); mesh = new T.Mesh(undefined, MAT.atlas); sc.add(mesh);
    return true;
  } catch { R = null; return false; }
}
function birak(): void { if (!R) return; try { R.dispose(); R.forceContextLoss(); } catch { /* */ } R = null; sc = null; cam = null; mesh = null; }
/** ürünün ikonu (data URL) ya da '' (tarifi yok / WebGL yok) */
export function yemekIkon(id: string): string {
  const c = cache.get(id); if (c !== undefined) return c;
  if (!yemekVar(id) || typeof document === 'undefined') { cache.set(id, ''); return ''; }
  let url = '';
  if (kur()) {
    try {
      const g = yemekGeo(id); mesh!.geometry = g; mesh!.material = MAT.atlas; g.computeBoundingSphere(); SPH.copy(g.boundingSphere!);
      const d = Math.max(0.1, SPH.radius) / Math.sin(15 * Math.PI / 180);
      cam!.position.copy(SPH.center).add(new T.Vector3(0.55, 0.75, 1).normalize().multiplyScalar(d)); cam!.lookAt(SPH.center);
      R!.render(sc!, cam!); url = R!.domElement.toDataURL('image/png');
    } catch { url = ''; }
    clearTimeout(bos); bos = setTimeout(birak, 4000) as unknown as number;
  }
  cache.set(id, url); return url;
}
/** <img> etiketi ya da '' */
export const yemekIkonImg = (id: string, px = 22, cls = 'yk-ik'): string => { const u = yemekIkon(id); return u ? `<img class="${cls}" src="${u}" alt="" width="${px}" height="${px}" style="vertical-align:middle;margin:-4px 3px -3px 0">` : ''; };
