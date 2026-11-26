/**
 * Çim, çiçek ve börtü böcek (2026-11-26, sahibi: "tüm kaldırımlar, asfalt, çim, çiçek, börtü böcek hepsi güzel görünsün").
 * Karşı yakanın çim alanlari (zemin = content/zones/karsi.ts'te kaplama/bina/saha dışında kalan yeşil) üzerine, kahramanın
 * çevresinde 1 m'de bir yeniden dizilen örnekli (instanced) ot kümeleri ve çiçekler; üstünde kelebek, ari ve yerde uğur böceği.
 * - Bütün bitkiler tek geometri: ot 5 üçgen, çiçek sapı 2 + başı 5 üçgen. Sayı kademeye göre (akıcı < dengeli < şahane).
 * - Yalnızca görsel: çarpışma yok, sim'e dokunmaz. Gündüz, yağmur/kar dışında uçarlar; geceleri ve kışın gizlenir.
 * - Çim zemini üzerindeki küçük çiçek benekleri engine/render/zemin-detay.ts shader'ında (sıfır üçgen).
 */
import * as T from 'three';
import { karsiPrefabs, karsiProps } from '../../../content/zones/karsi';

export interface BitkiDeps { root: () => T.Object3D | null; hero: () => { x: number; z: number }; hour: () => number; weather: () => string; season: () => string; tier: () => string }
export interface BitkiView { update(dt: number): void; dispose(): void }

interface Rc { x0: number; x1: number; z0: number; z1: number }
/** deterministic hash -> [0,1) */
const hs = (a: number, b: number, s = 0) => { let h = (Math.imul(Math.round(a * 131) | 0, 374761393) ^ Math.imul(Math.round(b * 131) | 0, 668265263) ^ Math.imul(s + 1, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** world rectangles of everything that is not lawn on the far bank: paving, plaza, pitch, building feet, fences, benches, trees */
function kapaliAlanlar(): Rc[] {
  const defs = new Map(karsiPrefabs().map(d => [d.id, d])), out: Rc[] = [];
  for (const p of karsiProps()) {
    const d = defs.get(p.prefab); if (!d) continue;
    const rot = Math.abs(Math.sin(p.rotY || 0)) > 0.7, px = p.pos.x, pz = p.pos.z;
    const add = (x0: number, x1: number, z0: number, z1: number) => out.push(rot ? { x0: px + z0, x1: px + z1, z0: pz - x1, z1: pz - x0 } : { x0: px + x0, x1: px + x1, z0: pz + z0, z1: pz + z1 });
    for (const r of d.colliders || []) add(r.x0, r.x1, r.z0, r.z1);
    for (const q of d.parts || []) {
      const ps = q.pos || [0, 0, 0];
      if (q.shape === 'plane') add(ps[0] - q.size[0] / 2, ps[0] + q.size[0] / 2, ps[2] - q.size[2] / 2, ps[2] + q.size[2] / 2);
      else if (q.shape === 'box' && ps[1] < 0.6 && q.size[0] > 1.5 && q.size[2] > 1.5) add(ps[0] - q.size[0] / 2, ps[0] + q.size[0] / 2, ps[2] - q.size[2] / 2, ps[2] + q.size[2] / 2);
    }
  }
  return out;
}

interface Nokta { x: number; z: number; r: number; k: number }
/** lawn candidates on the far bank, 0.55 m jittered grid; k = colour/variety seed */
function cimAdaylari(): Nokta[] {
  const kap = kapaliAlanlar(), out: Nokta[] = [], M = 0.3;
  for (let gx = -62; gx < 62; gx += 0.55) for (let gz = 28.6; gz < 62; gz += 0.55) {
    const x = gx + hs(gx, gz, 1) * 0.5, z = gz + hs(gx, gz, 2) * 0.5;
    if (z > 61.5) continue;
    let ok = true; for (const r of kap) if (x > r.x0 - M && x < r.x1 + M && z > r.z0 - M && z < r.z1 + M) { ok = false; break; }
    if (ok) out.push({ x, z, r: hs(gx, gz, 3) * Math.PI * 2, k: hs(gx, gz, 4) });
  }
  return out;
}

const TIERS: Record<string, { tuft: number; flower: number; fly: number; bee: number; bug: number; rad: number }> = {
  akici: { tuft: 380, flower: 90, fly: 5, bee: 4, bug: 6, rad: 20 },
  dengeli: { tuft: 900, flower: 240, fly: 9, bee: 7, bug: 12, rad: 28 },
  sahane: { tuft: 1500, flower: 400, fly: 12, bee: 9, bug: 16, rad: 34 },
};
const GREENS = ['#5f9a3e', '#6fae48', '#7bb653', '#4f8a38', '#8cbc5a', '#a3b94c'], PETALS = ['#fbfaf6', '#ffd23f', '#f2a2b3', '#c9a0f0', '#ff9a3c', '#fff3a0'];
const WINGS = ['#ff9a2e', '#f7f3e3', '#ffe23d', '#5aa9e6', '#e8584a'];

function tuftGeo(): T.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  const bl = [[0, 0.24, 0.30], [1.3, 0.18, 0.22], [2.5, 0.27, 0.26], [3.8, 0.15, 0.20], [5.0, 0.21, 0.32]];
  for (const [a, h, lean] of bl) {
    const ca = Math.cos(a), sa = Math.sin(a), w = 0.028, bx = ca * 0.03, bz = sa * 0.03;
    pos.push(bx - sa * w, 0, bz + ca * w, bx + sa * w, 0, bz - ca * w, bx + ca * lean * 0.45, h, bz + sa * lean * 0.45);
    col.push(0.62, 0.7, 0.55, 0.62, 0.7, 0.55, 1.15, 1.2, 0.95);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const n = g.getAttribute('normal') as T.BufferAttribute; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);   // soft top light, no flat-looking blades
  return g;
}
const SAP_H = 0.36;
function sapGeo(): T.BufferGeometry {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-0.008, 0, 0, 0.008, 0, 0, 0, SAP_H, 0, 0, 0, -0.008, 0, 0, 0.008, 0, SAP_H, 0], 3)); g.setAttribute('normal', new T.Float32BufferAttribute(new Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); return g;
}
function basGeo(): T.BufferGeometry {
  const pos: number[] = [], R = 0.11, y = SAP_H;
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, b = (i + 1) / 5 * Math.PI * 2; pos.push(0, y + 0.012, 0, Math.cos(a) * R, y, Math.sin(a) * R, Math.cos(b) * R, y, Math.sin(b) * R); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); return g;
}
function kanatGeo(): T.BufferGeometry {
  const w: number[] = [];
  for (const s of [1, -1]) { w.push(0, 0, 0.012, s * 0.1, 0, 0.075, s * 0.075, 0, -0.005); w.push(0, 0, -0.004, s * 0.075, 0, -0.01, s * 0.055, 0, -0.07); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(w, 3)); g.computeVertexNormals(); return g;
}

export function createBitkiBocek(d: BitkiDeps): BitkiView {
  const holder = new T.Group(); holder.name = 'bitkiBocek';
  let cand: Nokta[] | null = null, tr = TIERS[d.tier()] || TIERS.dengeli, tierAd = d.tier();
  let tuft: T.InstancedMesh | null = null, sap: T.InstancedMesh | null = null, bas: T.InstancedMesh | null = null, kanat: T.InstancedMesh | null = null, ari: T.InstancedMesh | null = null, bug: T.InstancedMesh | null = null;
  const mats: T.Material[] = [], geos: T.BufferGeometry[] = [];
  const uT = { value: 0 };
  let attached: T.Object3D | null = null, lastX = 1e9, lastZ = 1e9, tt = 0, vis = 1, fk = 1;
  const M4 = new T.Matrix4(), Q = new T.Quaternion(), V = new T.Vector3(), S = new T.Vector3(), E = new T.Euler(), C = new T.Color(), UP = new T.Vector3(0, 1, 0);
  const flowers: Nokta[] = [];   // currently shown flower spots (flyers choose among them)

  interface Fly { home: { x: number; z: number }; a: number; b: number; ra: number; rb: number; w1: number; w2: number; h: number; ph: number; x: number; y: number; z: number; yaw: number; col: string; tx: number; tz: number; wait: number }
  let flies: Fly[] = [], bees: Fly[] = [], bugs: Fly[] = [];

  function build(): void {
    tierAd = d.tier(); tr = TIERS[tierAd] || TIERS.dengeli;
    cand = cimAdaylari();
    const mk = (g: T.BufferGeometry, m: T.Material, n: number) => { const im = new T.InstancedMesh(g, m, n); im.frustumCulled = false; im.castShadow = false; im.receiveShadow = false; im.count = 0; geos.push(g); mats.push(m); holder.add(im); return im; };
    const tm = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
    tm.onBeforeCompile = sh => {   // gentle wind: tips sway, bases stay
      sh.uniforms.uT = uT; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ float sw = position.y * sin(uT * 1.6 + instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 0.7) * 0.22; transformed.x += sw; transformed.z += sw * 0.6; }');
    };
    tm.customProgramCacheKey = () => 'bitkiRuzgar';
    tuft = mk(tuftGeo(), tm, tr.tuft);
    const sm = new T.MeshLambertMaterial({ color: '#5a8f3a', side: T.DoubleSide }), bm = new T.MeshLambertMaterial({ side: T.DoubleSide });
    sap = mk(sapGeo(), sm, tr.flower); bas = mk(basGeo(), bm, tr.flower);
    kanat = mk(kanatGeo(), new T.MeshLambertMaterial({ side: T.DoubleSide, emissive: '#331a00' }), tr.fly); kanat.userData.n = tr.fly;
    ari = mk(new T.OctahedronGeometry(0.038, 0), new T.MeshLambertMaterial({ color: '#e9a912' }), tr.bee);
    bug = mk(new T.OctahedronGeometry(0.03, 0), new T.MeshLambertMaterial({ color: '#d8321f' }), tr.bug);
    // flyers: homes picked from lawn candidates that carry a flower (stable per seed), plus the pier's two flower beds
    const pick: { x: number; z: number }[] = [{ x: -14, z: 9.6 }, { x: 12.5, z: 9.6 }];
    for (let i = 0; i < cand.length; i += 1) if (cand[i].k > 0.9 && hs(cand[i].x, cand[i].z, 9) > 0.55) pick.push(cand[i]);
    const homeAt = (i: number) => pick[(i * 7919) % pick.length];
    const mkFly = (i: number, col: string): Fly => { const h = homeAt(i); return { home: { x: h.x, z: h.z }, a: hs(i, 1, 11) * 6.28, b: hs(i, 2, 12) * 6.28, ra: 1.2 + hs(i, 3, 13) * 1.6, rb: 0.5 + hs(i, 4, 14), w1: 0.35 + hs(i, 5, 15) * 0.3, w2: 0.9 + hs(i, 6, 16) * 0.6, h: 0.45 + hs(i, 7, 17) * 0.4, ph: hs(i, 8, 18) * 6.28, x: h.x, y: 0.5, z: h.z, yaw: 0, col, tx: h.x, tz: h.z, wait: hs(i, 9, 19) * 3 };
    };
    flies = Array.from({ length: tr.fly }, (_, i) => mkFly(i, WINGS[i % WINGS.length]));
    bees = Array.from({ length: tr.bee }, (_, i) => mkFly(i + 40, '#e9a912'));
    bugs = Array.from({ length: tr.bug }, (_, i) => mkFly(i + 90, '#d8321f'));
    for (let i = 0; i < flies.length; i++) kanat!.setColorAt(i, C.set(flies[i].col));
    for (let i = 0; i < bees.length; i++) ari!.setColorAt(i, C.set(i % 2 ? '#f2b617' : '#d39a0c'));
    for (let i = 0; i < bugs.length; i++) bug!.setColorAt(i, C.set(i % 3 ? '#d8321f' : '#e05a1a'));
    for (const m of [kanat, ari, bug]) if (m!.instanceColor) m!.instanceColor.needsUpdate = true;
  }

  /** re-pick plants around the hero (cheap: a few hundred matrices) */
  function sow(px: number, pz: number): void {
    if (!cand || !tuft || !sap || !bas) return;
    const R2 = tr.rad * tr.rad; let nt = 0, nf = 0; flowers.length = 0;
    for (const c of cand) {
      const dx = c.x - px, dz = c.z - pz, d2 = dx * dx + dz * dz; if (d2 > R2) continue;
      const edge = Math.min(1, (tr.rad - Math.sqrt(d2)) / 4);   // shrink to nothing at the rim: no popping
      if (c.k < 0.62 && nt < tr.tuft) {
        const s = (1.0 + c.k * 0.8) * edge; V.set(c.x, 0.075, c.z); Q.setFromAxisAngle(UP, c.r); S.set(s, s * (1.0 + c.k * 0.6), s);
        tuft.setMatrixAt(nt, M4.compose(V, Q, S)); tuft.setColorAt(nt, C.set(GREENS[Math.floor(c.k * 977) % GREENS.length])); nt++;
      } else if (c.k > 0.94 && nf < tr.flower) {
        const s = (0.75 + (c.k - 0.94) * 6) * edge; V.set(c.x, 0.075, c.z); E.set(0, c.r, (c.k - 0.97) * 1.5); Q.setFromEuler(E); S.set(s, s, s);
        M4.compose(V, Q, S); sap.setMatrixAt(nf, M4); bas.setMatrixAt(nf, M4); bas.setColorAt(nf, C.set(PETALS[Math.floor(c.k * 8191) % PETALS.length])); flowers.push(c); nf++;
      }
    }
    tuft.count = nt; sap.count = nf; bas.count = nf;
    for (const m of [tuft, sap, bas]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }

  function fly(dt: number, px: number, pz: number, near: number): void {
    if (!kanat || !ari || !bug) return;
    const day = vis; let nk = 0, na = 0, nb = 0;
    for (let i = 0; i < flies.length; i++) {
      const f = flies[i], dx = f.home.x - px, dz = f.home.z - pz; if (dx * dx + dz * dz > near * near) continue;
      f.a += dt * f.w1; f.b += dt * f.w2; const ox = f.home.x + Math.cos(f.a) * f.ra + Math.cos(f.b * 1.7) * f.rb, oz = f.home.z + Math.sin(f.a * 1.1) * f.ra + Math.sin(f.b) * f.rb, oy = 0.35 + f.h + Math.sin(f.b * 1.3 + f.ph) * 0.18;
      const vx = ox - f.x, vz = oz - f.z; if (vx * vx + vz * vz > 1e-6) f.yaw = Math.atan2(vx, vz); f.x = ox; f.y = oy; f.z = oz;
      const fl = 0.3 + 0.7 * Math.abs(Math.cos(tt * 16 + f.ph)), k = day;
      E.set(Math.sin(tt * 2 + f.ph) * 0.25, f.yaw, 0); Q.setFromEuler(E); V.set(f.x, f.y, f.z); S.set(fl * k, k, k);
      kanat.setMatrixAt(nk++, M4.compose(V, Q, S));
    }
    for (let i = 0; i < bees.length; i++) {
      const f = bees[i], dx = f.home.x - px, dz = f.home.z - pz; if (dx * dx + dz * dz > near * near) continue;
      f.wait -= dt; if (f.wait <= 0) { const a = hs(i, Math.floor(tt), 21) * 6.28, r = 0.4 + hs(i, Math.floor(tt), 22) * 2.2; f.tx = f.home.x + Math.cos(a) * r; f.tz = f.home.z + Math.sin(a) * r; f.wait = 1.4 + hs(i, Math.floor(tt), 23) * 2.2; }
      const k = Math.min(1, dt * 2.5); const nx = f.x + (f.tx - f.x) * k, nz = f.z + (f.tz - f.z) * k; if ((nx - f.x) ** 2 + (nz - f.z) ** 2 > 1e-7) f.yaw = Math.atan2(nx - f.x, nz - f.z);
      f.x = nx; f.z = nz; f.y = 0.3 + f.h * 0.5 + Math.sin(tt * 3 + f.ph) * 0.05;
      V.set(f.x + Math.sin(tt * 38 + f.ph) * 0.012, f.y + Math.sin(tt * 47 + f.ph) * 0.012, f.z); E.set(0, f.yaw, 0); Q.setFromEuler(E); S.set(day, 0.9 * day, 1.6 * day);
      ari.setMatrixAt(na++, M4.compose(V, Q, S));
    }
    for (let i = 0; i < bugs.length; i++) {
      const f = bugs[i], dx = f.home.x - px, dz = f.home.z - pz; if (dx * dx + dz * dz > near * near) continue;
      f.a += dt * f.w1 * 0.4; f.x = f.home.x + Math.cos(f.a) * f.ra * 0.8; f.z = f.home.z + Math.sin(f.a * 0.8) * f.ra * 0.8;
      V.set(f.x, 0.095, f.z); E.set(0, f.a, 0); Q.setFromEuler(E); S.set(day, 0.6 * day, 1.2 * day);
      bug.setMatrixAt(nb++, M4.compose(V, Q, S));
    }
    kanat.count = nk; ari.count = na; bug.count = nb;
    for (const m of [kanat, ari, bug]) m.instanceMatrix.needsUpdate = true;
  }

  return {
    update(dt) {
      const root = d.root(); if (!root) return;
      if (!cand) build();
      if (tierAd !== d.tier()) { holder.clear(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); geos.length = mats.length = 0; cand = null; lastX = 1e9; return; }
      if (attached !== root) { holder.removeFromParent(); root.add(holder); attached = root; }
      const h = d.hero(); tt += dt; uT.value = tt;
      const hr = d.hour(), w = d.weather(), wet = w === 'saganak' || w === 'kar' || w === 'firtina', cold = d.season() === 'kis';
      const want = (hr >= 6.5 && hr < 19.5 && !wet && !cold) ? 1 : 0; vis += (want - vis) * Math.min(1, dt * 1.5);
      holder.visible = true;
      // only the far bank has lawn here; beyond the sow radius nothing is drawn
      if ((h.x - lastX) ** 2 + (h.z - lastZ) ** 2 > 1.2) { lastX = h.x; lastZ = h.z; sow(h.x, h.z); }
      if (kanat) { const on = vis > 0.02; kanat.visible = ari!.visible = bug!.visible = on; if (on) fly(dt, h.x, h.z, tr.rad + 6); }
      fk = vis;
    },
    dispose() { holder.removeFromParent(); geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); void fk; },
  };
}
