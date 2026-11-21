/**
 * GRS-06: yumuşak temas gölgesi. Her görünür karakterin ayağının altına tek InstancedMesh (tek çizim çağrısı) ile koyu, kenarı
 * yumuşak bir leke konur: kişi yere "oturur", gölge haritası kapalı (akıcı) kademede de çalışır. Gölge haritası açıkken leke daha
 * hafiftir (iki gölge üst üste binip yeri kirletmesin). Yalnız görünümdür; sim'e dokunmaz, Math.random kullanmaz.
 */
import * as T from 'three';

export const TEMAS_CAP = 256;
/** leke saydamlığı: gölge haritası kapalıyken belirgin, açıkken hafif; gece biraz azalır (zemin zaten koyu) */
export function temasOpaklik(golgeHaritasi: boolean, gece: number): number {
  const taban = golgeHaritasi ? 0.26 : 0.42;
  return taban * (1 - 0.35 * Math.max(0, Math.min(1, gece)));
}
/** durağan karakter daha geniş ve koyu, koşan biraz uzun ve silik; yarıçap metre */
export function temasYaricap(oturuyor: boolean, hiz: number): number {
  return oturuyor ? 0.42 : 0.3 + Math.min(0.08, Math.max(0, hiz) * 0.02);
}

export interface TemasGolge {
  readonly mesh: T.InstancedMesh;
  begin(): void;
  add(x: number, z: number, r: number, y?: number): boolean;
  end(): void;
  setOpacity(a: number): void;
  readonly count: number;
  dispose(): void;
}

function lekeDokusu(): T.Texture | null {
  try {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); if (!g) return null;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.78)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  } catch { return null; }
}

export function createTemasGolge(parent: T.Object3D, cap = TEMAS_CAP): TemasGolge {
  const geo = new T.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
  const map = lekeDokusu();
  const mat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: false });
  if (map) mat.map = map;
  const mesh = new T.InstancedMesh(geo, mat, cap);
  mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = 'temas-golge'; mesh.userData.parity = 'dyn';
  parent.add(mesh);
  const d = new T.Object3D();
  let n = 0;
  return {
    mesh,
    get count() { return n; },
    begin() { n = 0; },
    add(x, z, r, y = 0.02) {
      if (n >= cap) return false;
      d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.set(r, 1, r); d.updateMatrix();
      mesh.setMatrixAt(n++, d.matrix); return true;
    },
    end() { mesh.count = n; mesh.visible = n > 0; if (n) mesh.instanceMatrix.needsUpdate = true; },
    setOpacity(a) { mat.opacity = a; },
    dispose() { parent.remove(mesh); geo.dispose(); mat.dispose(); map?.dispose(); },
  };
}
