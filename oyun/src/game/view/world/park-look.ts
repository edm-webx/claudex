/**
 * 2026-11-22 Büfe parkı (sahibi: "arka tarafı güzel bir park olabilir, ortasında Atatürk heykeli, etrafında güvercinler uçsun").
 * The pier strip between the büfe back and the kitchen front (content/prefabs/iskele/layout.ts PARK, HEYKEL): four lawns cut by a
 * paved cross, a round plaza with flower ring, the Atatürk monument on a stone pedestal (bronze, facing the promenade), four
 * plane trees, and a flock of pigeons that peck on the lawns, take off when the player walks into them and circle the monument
 * before landing again. View only: colliders (pedestal, trees) and benches live in layout.ts (staticObstacles / BENCHES).
 */
import * as T from 'three';
import { PARK, HEYKEL, PARK_AGAC } from '../../../content/prefabs/iskele/layout';

export interface ParkDeps { root: () => T.Object3D | null; hero?: () => { x: number; z: number } }
export interface ParkView { update(dt: number): void; dispose(): void }

const Y0 = 0.125;
const mat = (c: string, o: Partial<T.MeshStandardMaterialParameters> = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });

function plaqueTex(): T.CanvasTexture {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160; const g = cv.getContext('2d')!;
  g.fillStyle = '#2b2f2a'; g.fillRect(0, 0, 512, 160); g.strokeStyle = '#c9a24a'; g.lineWidth = 8; g.strokeRect(10, 10, 492, 140);
  g.fillStyle = '#e8c76a'; g.font = 'bold 74px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ATATÜRK', 256, 70);
  g.font = '28px Georgia, serif'; g.fillText('1881 – 1938', 256, 124);
  const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
}

function buildPark(): { g: T.Group; mats: T.Material[]; geos: T.BufferGeometry[] } {
  const g = new T.Group(); g.name = 'park'; const mats: T.Material[] = [], geos: T.BufferGeometry[] = [];
  const M = (c: string, o?: Partial<T.MeshStandardMaterialParameters>) => { const m = mat(c, o); mats.push(m); return m; };
  const add = (geo: T.BufferGeometry, m: T.Material, x: number, y: number, z: number, cast = true) => { geos.push(geo); const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true; g.add(me); return me; };
  const W = PARK.x1 - PARK.x0, D = PARK.z1 - PARK.z0, cx = (PARK.x0 + PARK.x1) / 2, cz = (PARK.z0 + PARK.z1) / 2, hx = HEYKEL.x, hz = HEYKEL.z;
  const grass = M('#5c9a44', { roughness: 1 }), grass2 = M('#6aa94f', { roughness: 1 }), path = M('#d8ccb2', { roughness: 0.95 }), curb = M('#bfb5a2'), stone = M('#d9d3c7', { roughness: 0.7 });
  // paving under everything, then the four lawns (paths are the gaps between them)
  add(new T.BoxGeometry(W, 0.02, D), path, cx, Y0, cz, false);
  const pw = 1.1, lw = (W - pw) / 2, ld = (D - pw) / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = hx + sx * (pw / 2 + lw / 2), z = hz + sz * (pw / 2 + ld / 2);
    add(new T.BoxGeometry(lw - 0.1, 0.05, ld - 0.1), (sx * sz > 0 ? grass : grass2), x, Y0 + 0.02, z, false);
    add(new T.BoxGeometry(lw, 0.07, 0.08), curb, x, Y0 + 0.03, z - sz * (ld / 2 - 0.02), false); add(new T.BoxGeometry(0.08, 0.07, ld), curb, x - sx * (lw / 2 - 0.02), Y0 + 0.03, z, false);
  }
  // round plaza with a flower ring
  add(new T.CylinderGeometry(2.05, 2.05, 0.05, 40), path, hx, Y0 + 0.03, hz, false);
  add(new T.TorusGeometry(1.35, 0.22, 6, 32).rotateX(Math.PI / 2), grass, hx, Y0 + 0.08, hz, false);
  const fl = ['#e0533c', '#ffd23f', '#f2a2b3', '#fbfaf6', '#c94f6d'].map(c => M(c));
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; add(new T.SphereGeometry(0.075, 6, 4), fl[i % fl.length], hx + Math.cos(a) * 1.35, Y0 + 0.22, hz + Math.sin(a) * 1.35, false); }
  // pedestal: plinth, shaft, cornice, plaque facing the promenade (+z)
  add(new T.BoxGeometry(1.7, 0.3, 1.7), stone, hx, Y0 + 0.15, hz); add(new T.BoxGeometry(1.25, 1.35, 1.25), stone, hx, Y0 + 0.97, hz);
  add(new T.BoxGeometry(1.45, 0.16, 1.45), stone, hx, Y0 + 1.72, hz);
  const pm = new T.MeshStandardMaterial({ map: plaqueTex(), roughness: 0.5, metalness: 0.2 }); mats.push(pm);
  add(new T.PlaneGeometry(0.95, 0.3), pm, hx, Y0 + 1.05, hz + 0.63, false);
  // the figure: bronze, standing, long coat, right hand on the coat, left arm forward holding the hat (stylised, low-poly)
  const br = M('#5b6650', { metalness: 0.55, roughness: 0.45 }), y = Y0 + 1.8;
  for (const s of [-1, 1]) add(new T.CylinderGeometry(0.075, 0.085, 0.75, 8), br, hx + s * 0.11, y + 0.38, hz);
  add(new T.CylinderGeometry(0.24, 0.36, 0.85, 12), br, hx, y + 0.95, hz);           // coat skirt
  add(new T.CylinderGeometry(0.21, 0.24, 0.55, 12), br, hx, y + 1.55, hz);           // torso
  add(new T.BoxGeometry(0.62, 0.14, 0.26), br, hx, y + 1.8, hz);                     // shoulders
  const armR = add(new T.CylinderGeometry(0.06, 0.055, 0.6, 8), br, hx + 0.3, y + 1.52, hz); armR.rotation.z = 0.12;
  const armL = add(new T.CylinderGeometry(0.06, 0.055, 0.58, 8), br, hx - 0.33, y + 1.6, hz + 0.18); armL.rotation.x = -1.0; armL.rotation.z = -0.15;
  add(new T.CylinderGeometry(0.13, 0.11, 0.05, 12), br, hx - 0.38, y + 1.5, hz + 0.42);   // hat in hand
  add(new T.CylinderGeometry(0.06, 0.07, 0.1, 8), br, hx, y + 1.92, hz);             // neck
  add(new T.SphereGeometry(0.13, 12, 10), br, hx, y + 2.07, hz);                     // head
  // plane trees in the four outer corners
  const trunk = M('#7a5a3e'), leaf = [M('#3f7a34'), M('#4f8f3a')];
  for (const [x, z] of PARK_AGAC) { add(new T.CylinderGeometry(0.12, 0.17, 2.4, 8), trunk, x, Y0 + 1.2, z); add(new T.SphereGeometry(1.0, 10, 8), leaf[0], x, Y0 + 2.9, z); add(new T.SphereGeometry(0.72, 10, 8), leaf[1], x + 0.35, Y0 + 3.45, z - 0.2); }
  return { g, mats, geos };
}

interface Kus { o: T.Group; wl: T.Object3D; wr: T.Object3D; head: T.Object3D; s: 'yer' | 'uc' | 'in'; x: number; z: number; y: number; a: number; r: number; t: number; tx: number; tz: number; hop: number }

function buildKus(m: { body: T.Material; wing: T.Material; neck: T.Material }, geos: T.BufferGeometry[]): Pick<Kus, 'o' | 'wl' | 'wr' | 'head'> {
  const o = new T.Group(), G = <G extends T.BufferGeometry>(x: G) => { geos.push(x); return x; };
  const body = new T.Mesh(G(new T.SphereGeometry(0.1, 8, 6)), m.body); body.scale.set(0.8, 0.75, 1.3); body.position.y = 0.11; o.add(body);
  const head = new T.Group(); head.position.set(0, 0.2, 0.11); o.add(head);
  const hm = new T.Mesh(G(new T.SphereGeometry(0.05, 8, 6)), m.neck); head.add(hm);
  const beak = new T.Mesh(G(new T.ConeGeometry(0.015, 0.04, 4).rotateX(Math.PI / 2)), m.wing); beak.position.z = 0.055; head.add(beak);
  const tail = new T.Mesh(G(new T.BoxGeometry(0.08, 0.015, 0.1)), m.wing); tail.position.set(0, 0.12, -0.15); o.add(tail);
  const wg = G(new T.BoxGeometry(0.2, 0.012, 0.11).translate(0.1, 0, 0));
  const wl = new T.Group(), wr = new T.Group(); wl.position.set(-0.05, 0.15, 0); wr.position.set(0.05, 0.15, 0);
  const a = new T.Mesh(wg, m.wing); a.rotation.y = Math.PI; wl.add(a); wr.add(new T.Mesh(wg, m.wing)); o.add(wl, wr);
  o.traverse(c => { (c as T.Mesh).castShadow = true; });
  return { o, wl, wr, head };
}

export function createParkLook(deps: ParkDeps): ParkView {
  let built: ReturnType<typeof buildPark> | null = null, flock: T.Group | null = null, t = 0;
  const kuslar: Kus[] = [], geos: T.BufferGeometry[] = [];
  const km = { body: mat('#8b9099'), wing: mat('#6b6f78'), neck: mat('#4f6f6a', { metalness: 0.3, roughness: 0.5 }) };
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const yerNokta = (): [number, number] => {   // a spot on a lawn (not on the plaza or under a tree)
    for (let i = 0; i < 20; i++) { const x = PARK.x0 + 0.5 + rnd() * (PARK.x1 - PARK.x0 - 1), z = PARK.z0 + 0.5 + rnd() * (PARK.z1 - PARK.z0 - 1); if (Math.hypot(x - HEYKEL.x, z - HEYKEL.z) > 2.2) return [x, z]; }
    return [PARK.x0 + 1, PARK.z0 + 1];
  };
  const kur = (root: T.Object3D) => {
    built = buildPark(); root.add(built.g);
    flock = new T.Group(); flock.name = 'guvercinler'; root.add(flock);
    for (let i = 0; i < 16; i++) {
      const b = buildKus(km, geos), [x, z] = yerNokta();
      const k: Kus = { ...b, s: i < 5 ? 'uc' : 'yer', x, z, y: 0, a: rnd() * 6.28, r: 2.6 + rnd() * 2.2, t: rnd() * 6, tx: x, tz: z, hop: 0 };
      if (k.s === 'uc') k.y = 3 + rnd() * 2;
      flock.add(k.o); kuslar.push(k);
    }
  };
  const sil = () => {
    if (built) { built.g.parent?.remove(built.g); built.geos.forEach(g => g.dispose()); built.mats.forEach(m => { (m as T.MeshStandardMaterial).map?.dispose(); m.dispose(); }); built = null; }
    if (flock) { flock.parent?.remove(flock); flock = null; } kuslar.length = 0; geos.forEach(g => g.dispose()); geos.length = 0;
  };
  return {
    update(dt) {
      t += dt; const root = deps.root();
      if (!root) { if (built) sil(); return; }
      if (!built || built.g.parent !== root) { sil(); kur(root); }
      const hp = deps.hero?.(), d = Math.min(dt, 0.1);
      for (const k of kuslar) {
        k.t -= d;
        if (k.s === 'yer') {
          if (hp && Math.hypot(hp.x - k.x, hp.z - k.z) < 1.4) { k.s = 'uc'; k.r = 2.6 + rnd() * 2.2; k.a = Math.atan2(k.z - HEYKEL.z, k.x - HEYKEL.x); k.t = 6 + rnd() * 8; }   // ürkünce havalanır
          else if (k.t <= 0) { if (rnd() < 0.08) { k.s = 'uc'; k.a = Math.atan2(k.z - HEYKEL.z, k.x - HEYKEL.x); k.t = 6 + rnd() * 8; } else { const [x, z] = yerNokta(); k.tx = k.x + (x - k.x) * 0.25; k.tz = k.z + (z - k.z) * 0.25; k.t = 1.5 + rnd() * 2.5; } }
          const dx = k.tx - k.x, dz = k.tz - k.z, L = Math.hypot(dx, dz);
          if (L > 0.03) { const v = Math.min(L, 0.45 * d); k.x += dx / L * v; k.z += dz / L * v; k.o.rotation.y = Math.atan2(dx, dz); k.hop += d * 9; }
          k.y = Math.max(0, k.y - d * 3);
          k.head.position.y = 0.2 - (L <= 0.03 && Math.sin(t * 7 + k.r * 10) > 0.4 ? 0.07 : 0);   // gagalama
          k.wl.rotation.z = k.wr.rotation.z = 0;
        } else if (k.s === 'uc') {
          k.a += d * (1.4 / k.r) * 2.2; const ty = 3.2 + Math.sin(t * 0.7 + k.r) * 0.8;
          k.y += (ty - k.y) * Math.min(1, d * 1.5);
          const nx = HEYKEL.x + Math.cos(k.a) * k.r, nz = HEYKEL.z + Math.sin(k.a) * k.r;
          k.o.rotation.y = Math.atan2(nx - k.x, nz - k.z); k.x = nx; k.z = nz;
          const f = Math.sin(t * 22 + k.r * 5) * 0.9; k.wl.rotation.z = f; k.wr.rotation.z = -f;
          if (k.t <= 0) { const [x, z] = yerNokta(); k.s = 'in'; k.tx = x; k.tz = z; }
        } else {   // iniş
          const dx = k.tx - k.x, dz = k.tz - k.z, L = Math.hypot(dx, dz), v = Math.min(L, 3.2 * d);
          if (L > 0.05) { k.x += dx / L * v; k.z += dz / L * v; k.o.rotation.y = Math.atan2(dx, dz); }
          k.y = Math.max(0, k.y - d * (k.y / Math.max(0.3, L / 3.2)));
          const f = Math.sin(t * 16) * 0.7; k.wl.rotation.z = f; k.wr.rotation.z = -f;
          if (L <= 0.05 && k.y < 0.05) { k.s = 'yer'; k.y = 0; k.t = 2 + rnd() * 4; }
        }
        k.o.position.set(k.x, Y0 + k.y + (k.s === 'yer' ? Math.abs(Math.sin(k.hop)) * 0.03 : 0), k.z);
      }
    },
    dispose() { sil(); Object.values(km).forEach(m => m.dispose()); },
  };
}
