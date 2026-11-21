/**
 * Belgrad Ormanı uzak koru (2026-11-21): yürünebilir bandın dışında, bölgenin dört yanını saran yoğun örnekli (instanced) orman.
 * Kamera ormanın kenarına yaklaşınca boşluk görünmesin diye kuzey/güney bantlarının yanı sıra doğu/batı yanları da dolu.
 * - İki tür: iğne yapraklı (gövde + iki koni) ve geniş yapraklı (gövde + yamuk taç), her türde renk çeşitliliği.
 * - Hücre başına yakında "hi" (3 parça), ortada "lo" (tek parça), uzakta gizli: mesafeye göre LOD. Gölge yok.
 * Sim'e yazmaz; tohumlu (Math.random yok).
 */
import * as T from 'three';
import type { Kit } from '../atolye';

const fr = (x: number) => x - Math.floor(x);
// ardışık k değerleri arasında ilişki kalmasın diye farklı sabitli üç ayrı karma (x, z, çeşitlilik)
const hx = (i: number) => fr(Math.sin(i * 127.1 + 311.7) * 43758.5453), hz = (i: number) => fr(Math.sin(i * 269.5 + 183.3) * 24634.6345), hv = (i: number) => fr(Math.sin(i * 419.2 + 371.9) * 31415.9265);

/** [x0, x1, z0, z1] kuşağı: yürünebilir alan x 780..900, z -10..28; zemin bunun çok ötesine uzanır. */
export const UZAK_HUCRELER: [number, number, number, number, number][] = (() => {
  const out: [number, number, number, number, number][] = [];   // [x0, x1, z0, z1, ağaç/m²]
  const XS = [700, 770, 840, 910, 980];
  // bölgeye bitişik 22 m'lik şerit sık (duvar gibi kapalı orman), ötesi seyrek
  for (let i = 0; i < XS.length - 1; i++) { out.push([XS[i], XS[i + 1], 29, 51, 0.065]); out.push([XS[i], XS[i + 1], 51, 95, 0.028]); out.push([XS[i], XS[i + 1], -33, -11, 0.065]); out.push([XS[i], XS[i + 1], -77, -33, 0.028]); }
  out.push([759, 781, -11, 29, 0.07]); out.push([700, 759, -11, 29, 0.03]); out.push([899, 921, -11, 29, 0.07]); out.push([921, 980, -11, 29, 0.03]);
  return out;
})();

export interface UzakOrman { update(px: number, pz: number): void; dispose(): void }

export function createUzakOrman(kit: Kit, root: T.Group): UzakOrman {
  const geos: T.BufferGeometry[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const trunkG = G(new T.CylinderGeometry(0.16, 0.24, 1.8, 6)); trunkG.translate(0, 0.9, 0);
  const coneA = G(new T.ConeGeometry(1.5, 3.2, 7)); coneA.translate(0, 3.0, 0);
  const coneB = G(new T.ConeGeometry(1.05, 2.4, 7)); coneB.translate(0, 4.6, 0);
  const loPine = G(new T.ConeGeometry(1.5, 5.6, 5)); loPine.translate(0, 2.8, 0);
  const trunkB = G(new T.CylinderGeometry(0.2, 0.3, 2.6, 6)); trunkB.translate(0, 1.3, 0);
  const crown = G(new T.IcosahedronGeometry(1.9, 1)); crown.scale(1, 0.85, 1); crown.translate(0, 3.9, 0);
  const loCrown = G(new T.IcosahedronGeometry(1.9, 0)); loCrown.scale(1, 0.85, 1); loCrown.translate(0, 3.9, 0);
  const mTrunk = kit.mat('#6b4a2e'), mCol = kit.mat('#ffffff'), mCol2 = kit.mat('#ffffff'), mLo = kit.mat('#ffffff'), mLoB = kit.mat('#ffffff');
  const pines = ['#3f7a48', '#2f6e44', '#356c3e', '#2a6040', '#43804c'].map(c => new T.Color(c));
  const broad = ['#5b9a4a', '#6aa84c', '#4d8f55', '#7aae4f', '#88b65a', '#5f9a3e'].map(c => new T.Color(c));
  const o = new T.Object3D(), tc = new T.Color();

  interface Hucre { cx: number; cz: number; hi: T.Object3D[]; lo: T.Object3D[] }
  const cells: Hucre[] = [];
  UZAK_HUCRELER.forEach(([x0, x1, z0, z1, dens], ci) => {
    const area = (x1 - x0) * (z1 - z0), N = Math.min(160, Math.round(area * dens)), Nb = Math.round(N * 0.35), Np = N - Nb;
    const mk = (g: T.BufferGeometry, m: T.Material, n: number) => new T.InstancedMesh(g, m, n);
    const a = mk(trunkG, mTrunk, Np), b = mk(coneA, mCol, Np), e = mk(coneB, mCol2, Np), l = mk(loPine, mLo, Np);
    const ta = mk(trunkB, mTrunk, Nb), tb = mk(crown, mCol, Nb), tl = mk(loCrown, mLoB, Nb);
    const place = (arr: T.InstancedMesh[], i: number, k: number, pine: boolean) => {
      // zemin bandına yakın (yürünebilir kenar) ilk 2 m boş: kenar ağaçları bölge içinde zaten var
      const x = x0 + hx(k) * (x1 - x0), z = z0 + hz(k) * (z1 - z0);
      o.position.set(x, 0, z); o.rotation.set(0, hv(k) * 6, 0); o.scale.setScalar((pine ? 0.85 : 0.9) + hv(k + 7) * 0.85); o.updateMatrix();
      for (const im of arr) im.setMatrixAt(i, o.matrix);
      return tc.copy((pine ? pines : broad)[Math.floor(hv(k + 9) * (pine ? pines : broad).length)]);
    };
    for (let i = 0; i < Np; i++) {
      const k = ci * 1000 + i, c = place([a, b, e, l], i, k, true).clone();
      b.setColorAt(i, c); e.setColorAt(i, c.clone().offsetHSL(0, 0, 0.05)); l.setColorAt(i, c);
    }
    for (let i = 0; i < Nb; i++) {
      const k = ci * 1000 + 500 + i, c = place([ta, tb, tl], i, k, false).clone();
      tb.setColorAt(i, c); tl.setColorAt(i, c);
    }
    const all = [a, b, e, l, ta, tb, tl];
    for (const im of all) { im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); root.add(im); }
    cells.push({ cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hi: [a, b, e, ta, tb], lo: [l, tl] });
  });
  const HI = 88, LO = 210;
  return {
    update(px, pz) {
      for (const c of cells) {
        const d = Math.hypot(px - c.cx, pz - c.cz), hi = d < HI, lo = !hi && d < LO;
        for (const m of c.hi) m.visible = hi;
        for (const m of c.lo) m.visible = lo;
      }
    },
    dispose() { geos.forEach(g => g.dispose()); },
  };
}
