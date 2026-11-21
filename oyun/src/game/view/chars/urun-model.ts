/**
 * DKN-05: what a worker carries in a far-shore business ('urun:<menu id>' items). One parametric model per carry family
 * (cup, glass, bottle, plate, bowl, tray, slice, box, notebook, paper, bag) tinted with the item's colour: no 48 separate models.
 */
import * as T from 'three';
import * as K from './v2/kit';
import { kalemOf, type TasimaKind } from '../../../content/isletme-istasyon';

const cyl = (rt: number, rb: number, h: number, s = 12) => K.geo(`uc${rt}|${rb}|${h}|${s}`, () => new T.CylinderGeometry(rt, rb, h, s));
const sph = (r: number) => K.geo(`us${r}`, () => new T.SphereGeometry(r, 12, 8));
const add = (g: T.Group, m: T.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); g.add(m); return m; };

export function makeUrunModel(kalemId: string): T.Object3D {
  const kal = kalemOf(kalemId), c = kal.renk, g = new T.Group(), kind: TasimaKind = kal.tasima;
  let h = 0.12;
  switch (kind) {
    case 'fincan': add(g, K.mesh(cyl(0.11, 0.11, 0.012), '#f4f1ea'), 0, 0.006, 0); add(g, K.mesh(cyl(0.065, 0.045, 0.075), '#f8f6f1'), 0, 0.05, 0); add(g, K.mesh(cyl(0.056, 0.056, 0.004), c), 0, 0.087, 0); h = 0.1; break;
    case 'bardak': add(g, K.mesh(cyl(0.058, 0.044, 0.15), '#e8f2f6'), 0, 0.075, 0); add(g, K.mesh(cyl(0.052, 0.04, 0.11), c), 0, 0.065, 0); h = 0.16; break;
    case 'sise': add(g, K.mesh(cyl(0.05, 0.05, 0.13), c), 0, 0.065, 0); add(g, K.mesh(cyl(0.02, 0.05, 0.05), c), 0, 0.155, 0); add(g, K.mesh(cyl(0.022, 0.022, 0.02), '#d9d9d4'), 0, 0.2, 0); h = 0.22; break;
    case 'tabak': add(g, K.mesh(cyl(0.15, 0.12, 0.02), '#f6f3ec'), 0, 0.01, 0); add(g, K.mesh(sph(0.1), c), 0, 0.04, 0).scale.y = 0.55; h = 0.1; break;
    case 'kase': add(g, K.mesh(cyl(0.11, 0.07, 0.08), '#f6f3ec'), 0, 0.04, 0); add(g, K.mesh(cyl(0.1, 0.1, 0.01), c), 0, 0.078, 0); h = 0.09; break;
    case 'tepsi': add(g, K.mesh(K.roundBox(0.36, 0.025, 0.26, 0.01, 2), '#8a6a44'), 0, 0.012, 0); for (let i = 0; i < 3; i++) add(g, K.mesh(sph(0.055), i === 1 ? '#f6f3ec' : c), -0.1 + i * 0.1, 0.07, 0).scale.y = 0.7; h = 0.12; break;
    case 'dilim': add(g, K.mesh(K.roundBox(0.2, 0.025, 0.16, 0.008, 2), '#f6f3ec'), 0, 0.012, 0); add(g, K.mesh(K.roundBox(0.16, 0.04, 0.11, 0.015, 2), c), 0, 0.045, 0); add(g, K.mesh(K.roundBox(0.16, 0.014, 0.11, 0.005, 2), '#f0d9a0'), 0, 0.075, 0); h = 0.09; break;
    case 'kutu': add(g, K.mesh(K.roundBox(0.14, 0.07, 0.1, 0.01, 2), c), 0, 0.035, 0); add(g, K.mesh(K.roundBox(0.145, 0.015, 0.105, 0.005, 2), '#fbfbf8'), 0, 0.075, 0); h = 0.09; break;
    case 'defter': add(g, K.mesh(K.roundBox(0.17, 0.03, 0.23, 0.008, 2), c), 0, 0.015, 0); add(g, K.mesh(K.roundBox(0.015, 0.032, 0.23, 0.004, 1), '#2b2b30'), -0.08, 0.016, 0); h = 0.04; break;
    case 'kagit': add(g, K.mesh(K.roundBox(0.2, 0.05, 0.28, 0.004, 1), '#fbfbf8'), 0, 0.025, 0); add(g, K.mesh(K.roundBox(0.2, 0.004, 0.28, 0.002, 1), '#dfe6ee'), 0, 0.052, 0); h = 0.06; break;
    case 'torba': add(g, K.mesh(K.roundBox(0.2, 0.22, 0.1, 0.04, 2), c), 0, 0.11, 0); add(g, K.mesh(K.roundBox(0.1, 0.1, 0.02, 0.02, 2), '#2b2b30'), 0, 0.08, 0.055); h = 0.24; break;
  }
  g.userData.h = h; return g;
}
