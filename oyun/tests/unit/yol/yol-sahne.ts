// PRF-09 ortak: yol görünümünü (yol-look) Node'da gerçek mesh'leriyle kurar. Tabela dokuları için sahte bir canvas yeter.
import * as T from 'three';

export async function yolSahnesi() {
  const g = globalThis as unknown as { document?: unknown };
  if (!g.document) {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) };
  }
  const { createYolLook } = await import('../../../src/game/view/world/yol-look');
  const root = new T.Group();
  const look = createYolLook({ root: () => root });
  look.update(0);
  root.updateMatrixWorld(true);
  const holder = root.getObjectByName('yolKok')!;
  const part = (n: string) => holder.getObjectByName(n)!;
  return { root, look, holder, bridge: part('yolUstGecit'), road: part('yolRoad'), stop: part('yolDurak'), tunnel: part('yolTunel'), vehicles: part('yolArac') };
}

export const meshesOf = (o: T.Object3D): T.Mesh[] => { const r: T.Mesh[] = []; o.traverse(n => { if ((n as T.Mesh).isMesh && n.visible) r.push(n as T.Mesh); }); return r; };

/** Every world-space triangle of the meshes under `o`. */
export function trianglesOf(o: T.Object3D): T.Triangle[] {
  o.updateMatrixWorld(true);
  const out: T.Triangle[] = [];
  for (const m of meshesOf(o)) {
    const p = m.geometry.attributes.position, idx = m.geometry.index, n = idx ? idx.count : p.count;
    const v = (i: number) => new T.Vector3().fromBufferAttribute(p, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld);
    for (let i = 0; i + 2 < n; i += 3) out.push(new T.Triangle(v(i), v(i + 1), v(i + 2)));
  }
  return out;
}
