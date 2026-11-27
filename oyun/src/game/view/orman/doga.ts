/**
 * Belgrad Ormanı doğası (DNY-10, 2026-11-21): everything small and alive that makes the forest feel full, all code-made
 * and instanced (one draw call per kind). Never writes sim state; seeded (no Math.random).
 * - Ground: crossed grass blades, fern fans, flowers clustered in clearings, leaf-litter and moss patches, pebbles on
 *   the trail edges, twigs, low undergrowth along the tree rows. Up-facing normals so the cover lights like the ground.
 * - Places: the pond (water, mud rim, lily pads, reeds, ripples, two ducks), the campfire (flicker + glow, lit from
 *   18:00), sign faces (forest map boards with "Buradasınız", signpost arrows, monument plaque, 42B return sign).
 * - Air: sun shafts and light patches tinted by the hour (warm morning, golden evening, off at night), drifting
 *   ground mist at dawn/dusk/night, falling leaves, soft fireflies at night, bird flocks and squirrels by day.
 */
import * as T from 'three';
import type { Kit } from '../atolye';
import { ORMAN, REGION_BY_ID } from '../../../content/disari/martikoy';
import { ormanZone } from '../../../content/zones/disari';

export interface Doga { update(dt: number, p: { x: number; z: number }, h: number, on: boolean): void; dispose(): void }

const fr = (x: number) => x - Math.floor(x);
const R = (i: number) => fr(Math.sin(i * 91.7 + 3.1) * 43758.5453);
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** 0..1 bands of the day used by the whole forest */
export function gunBandi(h: number) {
  h = ((h % 24) + 24) % 24;   // ZMN-01: the game clock runs 8..32
  const night = h >= 21 || h < 5 ? 1 : h >= 19.5 ? smooth(19.5, 21, h) : h < 6.5 ? 1 - smooth(5, 6.5, h) : 0;
  const morning = h >= 5.5 && h < 10 ? Math.min(smooth(5.5, 7, h), 1 - smooth(8.5, 10, h)) : 0;
  const golden = h >= 16 && h < 20.5 ? Math.min(smooth(16, 17.5, h), 1 - smooth(19.3, 20.5, h)) : 0;
  return { night, morning, golden, day: 1 - night };
}
export const onTrail = (x: number, z: number, pad = 0) => ORMAN.trailsZ.some(t => Math.abs(z - t) < 1.6 + pad && x > 798 && x < 882)
  || ORMAN.cross.some(([cx, za, zb]) => Math.abs(x - cx) < 1.2 + pad && z > za - 0.5 && z < zb + 0.5);
const inPond = (x: number, z: number, pad = 0) => { const g = ORMAN.gol; return ((x - g.x) / (g.rx + pad)) ** 2 + ((z - g.z) / (g.rz + pad)) ** 2 < 1; };

/** Both windings of every triangle (front-side material, so no flipped normals on the back faces). */
function twoSided(p: number[]): number[] { const o = p.slice(); for (let i = 0; i < p.length; i += 9) o.push(p[i + 6], p[i + 7], p[i + 8], p[i + 3], p[i + 4], p[i + 5], p[i], p[i + 1], p[i + 2]); return o; }
/** Flat-shaded up normals: thin cover lit like the ground under it. */
function upNormals(g: T.BufferGeometry) { const n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a[i * 3 + 1] = 1; g.setAttribute('normal', new T.BufferAttribute(a, 3)); return g; }
function blades(): T.BufferGeometry {
  const p: number[] = [];
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, c = Math.cos(a) * 0.07, s = Math.sin(a) * 0.07, lx = Math.cos(a + 1.2) * 0.06, lz = Math.sin(a + 1.2) * 0.06; p.push(-c, 0, -s, c, 0, s, lx, 0.46, lz); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(twoSided(p), 3)); return upNormals(g);
}
function fernFan(): T.BufferGeometry {
  const p: number[] = [];
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + 0.3, c = Math.cos(a), s = Math.sin(a), w = 0.09, px = -s * w, pz = c * w;
    const m = [c * 0.32, 0.34, s * 0.32], t = [c * 0.62, 0.16, s * 0.62];
    p.push(px, 0.02, pz, -px, 0.02, -pz, m[0] + px * 0.8, m[1], m[2] + pz * 0.8, -px, 0.02, -pz, m[0] - px * 0.8, m[1], m[2] - pz * 0.8, m[0] + px * 0.8, m[1], m[2] + pz * 0.8,
      m[0] + px * 0.8, m[1], m[2] + pz * 0.8, m[0] - px * 0.8, m[1], m[2] - pz * 0.8, t[0], t[1], t[2]);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(twoSided(p), 3)); return upNormals(g);
}

export function createDoga(kit: Kit, root: T.Group): Doga {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const G = <X extends T.BufferGeometry>(g: X) => { geos.push(g); return g; };
  const M = <X extends T.Material>(m: X) => { mats.push(m); return m; };
  const o = new T.Object3D(), col = new T.Color();
  const inst = (geo: T.BufferGeometry, mat: T.Material, n: number, place: (i: number, o: T.Object3D) => void, color?: (i: number, c: T.Color) => void, shadow = false) => {
    const im = new T.InstancedMesh(geo, mat, n); let k = 0;
    for (let i = 0; i < n * 4 && k < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.visible = true; place(i, o); if (!o.visible) continue; o.updateMatrix(); im.setMatrixAt(k, o.matrix); if (color) { color(i, col); im.setColorAt(k, col); } k++; }
    im.count = k; im.receiveShadow = true; im.castShadow = shadow; im.computeBoundingSphere(); root.add(im); return im;
  };
  const trees = ormanZone().props.filter(q => /^t\d/.test(q.id)).map(q => ({ x: q.pos.x, z: q.pos.z }));
  const X0 = 801, XW = 78, Z0 = -9.6, ZW = 37;
  const rx = (i: number) => X0 + R(i) * XW, rz = (i: number) => Z0 + R(i + 0.5) * ZW;

  /* ---------- ground cover ---------- */
  const grassM = M(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
  const gc = ['#5d9a45', '#6aa84c', '#4f8a3a', '#7aae4f', '#88b65a', '#5a8f3e'].map(c => new T.Color(c));
  inst(G(blades()), grassM, 1700, (i, q) => { const x = rx(i * 3 + 1), z = rz(i * 3 + 1); if (onTrail(x, z, -0.3) || inPond(x, z, 0.4)) { q.visible = false; return; } q.position.set(x, 0, z); q.rotation.y = R(i + 7) * 6; q.scale.setScalar(0.7 + R(i + 5) * 1.0); }, (i, c) => c.copy(gc[i % gc.length]));
  const fernM = M(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }));
  const fc = ['#3f7f35', '#4a8a3a', '#356f2e', '#568f3f'].map(c => new T.Color(c));
  // ferns like shade: near tree trunks and along the tree rows
  inst(G(fernFan()), fernM, 300, (i, q) => {
    const t = trees[i % trees.length], a = R(i + 31) * 6.28, d = 1.2 + R(i + 33) * 2.2, x = i < 220 ? t.x + Math.cos(a) * d : rx(i + 900), z = i < 220 ? t.z + Math.sin(a) * d : rz(i + 900);
    if (onTrail(x, z, 0.2) || inPond(x, z, 0.6) || z > 27.5 || z < -9.8) { q.visible = false; return; } q.position.set(x, 0, z); q.rotation.y = R(i) * 6; q.scale.setScalar(0.9 + R(i + 9) * 1.3);
  }, (i, c) => c.copy(fc[i % fc.length]));
  // flowers: clustered in the clearings (stop meadow, around the pond, the monument, the mangal meadows) plus a sprinkle
  const flM = M(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, emissive: '#000000' }));
  const flc = ['#f2c230', '#ffffff', '#e85a9a', '#9b7fe0', '#e0533c', '#f7e36a'].map(c => new T.Color(c));
  const meadows = [[810, 15.5, 4], [ORMAN.gol.x, ORMAN.gol.z, 6.5], [ORMAN.anit.x, ORMAN.anit.z, 5], [833, 13.5, 4], [862, 2.6, 4], [826, 22, 3], [845, -6.5, 3.5]];
  const flG = G(new T.IcosahedronGeometry(0.075, 0)); flG.translate(0, 0.24, 0);
  inst(flG, flM, 420, (i, q) => { const m = meadows[i % meadows.length], a = R(i + 77) * 6.28, d = Math.sqrt(R(i + 79)) * m[2], x = i < 330 ? m[0] + Math.cos(a) * d : rx(i + 1300), z = i < 330 ? m[1] + Math.sin(a) * d : rz(i + 1300);
    if (onTrail(x, z) || inPond(x, z, 0.3)) { q.visible = false; return; } q.position.set(x, 0, z); q.scale.setScalar(0.8 + R(i) * 0.8); }, (i, c) => c.copy(flc[Math.floor(R(i + 3) * flc.length)]));
  // leaf litter + moss: soft-edged flat patches that break the even green
  const blob = kit.paint(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const litM = M(new T.MeshStandardMaterial({ color: '#ffffff', map: blob, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  const litG = G(new T.PlaneGeometry(1, 1)); litG.rotateX(-Math.PI / 2); upNormals(litG);
  const lc = ['#8a6a3a', '#7d8a3c', '#4f7a33', '#a08a4a', '#6b5a32', '#3f6a2c', '#93783f'].map(c => new T.Color(c));
  inst(litG, litM, 260, (i, q) => { const near = i < 160, t = trees[i % trees.length], a = R(i + 51) * 6.28, d = R(i + 53) * 2.4, x = near ? t.x + Math.cos(a) * d : rx(i + 1700), z = near ? t.z + Math.sin(a) * d : rz(i + 1700);
    if (inPond(x, z, 0.5)) { q.visible = false; return; } q.position.set(x, 0.018 + (i % 7) * 0.0012, z); q.rotation.y = R(i) * 6; const s = 1.2 + R(i + 2) * 2.6; q.scale.set(s, 1, s * (0.6 + R(i + 4) * 0.5)); }, (i, c) => c.copy(lc[i % lc.length]));
  // pebbles along the trail edges, twigs, undergrowth
  const pebM = M(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95 }));
  const pc = ['#a29e96', '#8d8a84', '#bdb7aa', '#7d7a72'].map(c => new T.Color(c));
  const pebG = G(new T.DodecahedronGeometry(0.09, 0)); pebG.scale(1, 0.55, 1);
  inst(pebG, pebM, 320, (i, q) => { const t = ORMAN.trailsZ[i % 3], side = R(i + 61) < 0.5 ? -1 : 1, x = 799 + R(i + 63) * 82, z = t + side * (1.45 + R(i + 65) * 0.6); if (inPond(x, z)) { q.visible = false; return; } q.position.set(x, 0.02, z); q.rotation.set(R(i) * 3, R(i + 1) * 6, 0); q.scale.setScalar(0.6 + R(i + 67) * 1.6); }, (i, c) => c.copy(pc[i % 4]));
  const twigG = G(new T.CylinderGeometry(0.018, 0.026, 1, 4)); twigG.rotateZ(Math.PI / 2);
  inst(twigG, M(new T.MeshStandardMaterial({ color: '#6b4a2e', roughness: 0.9 })), 110, (i, q) => { const x = rx(i + 2100), z = rz(i + 2100); if (onTrail(x, z) || inPond(x, z, 0.3)) { q.visible = false; return; } q.position.set(x, 0.03, z); q.rotation.y = R(i) * 6; q.scale.set(0.4 + R(i + 1) * 0.9, 1, 1); });
  const ugM = M(new T.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, flatShading: true }));
  const ugc = ['#3f7a33', '#4f8a3a', '#355f2a', '#5f9a45', '#46803a'].map(c => new T.Color(c));
  const ugG = G(new T.IcosahedronGeometry(0.55, 0)); ugG.scale(1, 0.62, 1); ugG.translate(0, 0.2, 0);
  inst(ugG, ugM, 200, (i, q) => {
    const row = i % 2 ? 20.6 + R(i + 71) * 7 : -4.3 - R(i + 71) * 5.4, x = 801 + R(i + 73) * 78, z = i < 150 ? row : trees[i % trees.length].z + (R(i + 75) - 0.5) * 2.6;
    const xx = i < 150 ? x : trees[i % trees.length].x + (R(i + 77) - 0.5) * 2.6;
    if (onTrail(xx, z, 0.4) || inPond(xx, z, 1) || Math.hypot(xx - ORMAN.kamp.x, z - ORMAN.kamp.z) < 4) { q.visible = false; return; }
    q.position.set(xx, 0, z); q.rotation.y = R(i) * 6; q.scale.setScalar(0.6 + R(i + 79) * 0.9);
  }, (i, c) => c.copy(ugc[i % ugc.length]));

  /* ---------- pond ---------- */
  const g0 = ORMAN.gol;
  const mud = new T.Mesh(G(new T.CircleGeometry(1, 40)), M(new T.MeshStandardMaterial({ color: '#6f6248', roughness: 1 })));
  mud.rotation.x = -Math.PI / 2; mud.scale.set(g0.rx + 0.7, g0.rz + 0.6, 1); mud.position.set(g0.x, 0.026, g0.z); mud.receiveShadow = true; root.add(mud);
  const waterM = M(new T.MeshStandardMaterial({ color: '#2f6470', roughness: 0.08, metalness: 0.35, emissive: '#0d2a30', emissiveIntensity: 0.4 }));
  const water = new T.Mesh(G(new T.CircleGeometry(1, 40)), waterM); water.rotation.x = -Math.PI / 2; water.scale.set(g0.rx, g0.rz, 1); water.position.set(g0.x, 0.04, g0.z); water.receiveShadow = true; root.add(water);
  const padG = G(new T.CircleGeometry(0.26, 10, 0.35, 5.6)); padG.rotateX(-Math.PI / 2);
  inst(padG, M(new T.MeshStandardMaterial({ color: '#4f8f3a', roughness: 0.6 })), 16, (i, q) => { const a = R(i + 81) * 6.28, d = 0.35 + R(i + 83) * 0.55; q.position.set(g0.x + Math.cos(a) * d * g0.rx, 0.05, g0.z + Math.sin(a) * d * g0.rz); q.rotation.y = R(i) * 6; q.scale.setScalar(0.8 + R(i + 1) * 0.7); });
  const lotus = G(new T.IcosahedronGeometry(0.09, 0)); lotus.translate(0, 0.08, 0);
  inst(lotus, M(new T.MeshStandardMaterial({ color: '#f4a6c6', roughness: 0.5 })), 5, (i, q) => { const a = R(i + 81) * 6.28, d = 0.35 + R(i + 83) * 0.55; q.position.set(g0.x + Math.cos(a) * d * g0.rx, 0.05, g0.z + Math.sin(a) * d * g0.rz); });
  const reedG = G(new T.ConeGeometry(0.035, 1.1, 4)); reedG.translate(0, 0.55, 0);
  inst(reedG, M(new T.MeshStandardMaterial({ color: '#6f8f3a', roughness: 0.8 })), 70, (i, q) => { const a = R(i + 91) * 6.28; if (Math.sin(a) > 0.55) { q.visible = false; return; } const d = 0.92 + R(i + 93) * 0.2; q.position.set(g0.x + Math.cos(a) * d * g0.rx, 0, g0.z + Math.sin(a) * d * g0.rz); q.rotation.set((R(i) - 0.5) * 0.25, 0, (R(i + 1) - 0.5) * 0.25); q.scale.set(1, 0.7 + R(i + 2) * 0.7, 1); });
  const ringM = M(new T.MeshLambertMaterial({ color: '#cfe8ee', transparent: true, opacity: 0, depthWrite: false }));
  const rings = [0, 1, 2].map(i => { const m = new T.Mesh(G(new T.RingGeometry(0.9, 1, 28)), ringM.clone()); mats.push(m.material as T.Material); m.rotation.x = -Math.PI / 2; m.position.set(g0.x + (R(i + 5) - 0.5) * g0.rx, 0.055, g0.z + (R(i + 6) - 0.5) * g0.rz); root.add(m); return m; });
  // two ducks: body, head, beak (one tiny group each)
  const duckM = M(new T.MeshStandardMaterial({ color: '#8a6a4a', roughness: 0.7 })), headM = M(new T.MeshStandardMaterial({ color: '#2f6a3a', roughness: 0.5 })), beakM = M(new T.MeshStandardMaterial({ color: '#e8a030' }));
  const dBody = G(new T.SphereGeometry(0.2, 8, 6)); dBody.scale(1.4, 0.75, 1); const dHead = G(new T.SphereGeometry(0.1, 8, 6)), dBeak = G(new T.ConeGeometry(0.04, 0.12, 5)); dBeak.rotateZ(-Math.PI / 2);
  const ducks = [0, 1].map(() => { const g = new T.Group(); const b = new T.Mesh(dBody, duckM); b.position.y = 0.1; const hd = new T.Mesh(dHead, headM); hd.position.set(0.24, 0.3, 0); const bk = new T.Mesh(dBeak, beakM); bk.position.set(0.36, 0.28, 0); g.add(b, hd, bk); b.castShadow = true; root.add(g); return g; });

  /* ---------- campfire ---------- */
  const K = ORMAN.kamp, fx = K.x + 0.4, fz = K.z + 1.2;
  const flameM = M(new T.MeshBasicMaterial({ color: '#ff9a2a', transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false }));
  const flameM2 = M(new T.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false }));
  const fl1 = new T.Mesh(G(new T.ConeGeometry(0.26, 0.75, 7)), flameM), fl2 = new T.Mesh(G(new T.ConeGeometry(0.14, 0.5, 6)), flameM2);
  fl1.position.set(fx, 0.45, fz); fl2.position.set(fx + 0.05, 0.36, fz + 0.03); root.add(fl1, fl2);
  const glowTex = kit.paint(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 63); gr.addColorStop(0, 'rgba(255,190,110,1)'); gr.addColorStop(0.4, 'rgba(255,150,60,.45)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const glowM = M(new T.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  const glow = new T.Mesh(G(new T.PlaneGeometry(7, 7)), glowM); glow.rotation.x = -Math.PI / 2; glow.position.set(fx, 0.06, fz); root.add(glow);

  /* ---------- sign faces ---------- */
  const signs = new T.Group(); root.add(signs);
  const plate = (w: number, h: number, tex: T.Texture, x: number, y: number, z: number) => { const m = new T.Mesh(G(new T.PlaneGeometry(w, h)), M(new T.MeshStandardMaterial({ map: tex, roughness: 0.8 }))); m.position.set(x, y, z); signs.add(m); return m; };
  const mapTex = (here: { x: number; z: number }) => kit.paint(512, 300, (g, w, h) => {
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, w, h); g.fillStyle = '#3f5a2a'; g.fillRect(0, 0, w, 44);
    g.fillStyle = '#fff'; g.font = '900 26px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BELGRAD ORMANI · Patika Haritası', w / 2, 23);
    const px = (x: number) => 18 + (x - 800) / 80 * (w - 36), pz = (z: number) => 58 + (z + 10) / 38 * (h - 76);
    g.fillStyle = '#cfe0b0'; g.fillRect(px(800), pz(-10), px(880) - px(800), pz(28) - pz(-10));
    g.strokeStyle = '#b08a52'; g.lineCap = 'round'; g.lineWidth = 9;
    for (const t of ORMAN.trailsZ) { g.beginPath(); g.moveTo(px(801), pz(t)); g.lineTo(px(879), pz(t)); g.stroke(); }
    g.lineWidth = 7; for (const [x, a, b] of ORMAN.cross) { g.beginPath(); g.moveTo(px(x), pz(a)); g.lineTo(px(x), pz(b)); g.stroke(); }
    g.fillStyle = '#5aa6c8'; g.beginPath(); g.ellipse(px(ORMAN.gol.x), pz(ORMAN.gol.z), ORMAN.gol.rx * 5.6, ORMAN.gol.rz * 5.6, 0, 0, Math.PI * 2); g.fill();
    const st = REGION_BY_ID.orman.stop;
    const pin = (x: number, z: number, txt: string, c: string) => { g.fillStyle = c; g.beginPath(); g.arc(px(x), pz(z), 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b2b2b'; g.font = '800 15px system-ui'; g.textAlign = 'center'; g.fillText(txt, px(x), pz(z) - 17); };
    pin(st.x, st.z, '42B Durak', '#e8742c'); pin(ORMAN.cesme.x, ORMAN.cesme.z, 'Çeşme', '#3f8fd0'); pin(ORMAN.gol.x, ORMAN.gol.z + 3.6, 'Gölet', '#2f6f9a');
    pin(ORMAN.kamp.x, ORMAN.kamp.z, 'Kamp', '#d0802a'); pin(ORMAN.anit.x, ORMAN.anit.z, 'Anıt Ağaç', '#3f7a32'); pin(826, 2.4, 'Mangal', '#c0503a'); pin(846, 21.5, 'Mangal', '#c0503a');
    g.fillStyle = '#e0302b'; g.beginPath(); g.arc(px(here.x), pz(here.z), 11, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#e0302b'; g.font = '900 16px system-ui'; g.fillText('BURADASINIZ', px(here.x), pz(here.z) + 22);
  });
  ORMAN.pano.forEach(q => plate(2.0, 1.17, mapTex(q), q.x, 1.5, q.z + 0.045));
  const arrowTex = (txt: string, right: boolean) => kit.paint(256, 52, (g, w, h) => {
    g.fillStyle = '#d8b67a'; g.beginPath(); if (right) { g.moveTo(0, 0); g.lineTo(w - 26, 0); g.lineTo(w, h / 2); g.lineTo(w - 26, h); g.lineTo(0, h); } else { g.moveTo(26, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(26, h); g.lineTo(0, h / 2); } g.fill();
    g.fillStyle = '#3b2a1a'; g.font = '800 25px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 1, w - 40);
  });
  const YON: [string, string, string][] = [['Çeşme · Anıt Ağaç', '42B Durak', 'Kamp · Gölet ↑'], ['Anıt Ağaç', 'Çeşme · 42B', 'Mangal · Gölet ↑'], ['Gölet', 'Kamp · 42B', 'Çeşme ↓']];
  ORMAN.yon.forEach((q, i) => { const t = YON[i]; plate(1.28, 0.25, arrowTex(t[0], true), q.x + 0.45, 2.15, q.z + 0.1); plate(1.28, 0.25, arrowTex(t[1], false), q.x - 0.45, 1.8, q.z + 0.1); plate(1.28, 0.25, arrowTex(t[2], true), q.x + 0.45, 1.45, q.z + 0.1); });
  {
    const tx = kit.paint(256, 128, (g, w, h) => { g.fillStyle = '#3f5a2a'; g.fillRect(0, 0, w, h); g.fillStyle = '#efe4c8'; g.fillRect(6, 6, w - 12, h - 12); g.fillStyle = '#3f5a2a'; g.textAlign = 'center'; g.font = '900 30px Georgia,serif'; g.fillText('ANIT AĞAÇ', w / 2, 46); g.font = '700 20px system-ui'; g.fillText('Saçlı meşe · ~400 yaşında', w / 2, 80); g.fillText('Lütfen dallarına tırmanma', w / 2, 106); });
    const post = new T.Mesh(G(new T.BoxGeometry(0.08, 1.0, 0.08)), M(new T.MeshStandardMaterial({ color: '#6b4a2e' }))); post.position.set(ORMAN.anit.x - 1.9, 0.5, ORMAN.anit.z + 2.3); signs.add(post);
    const pl = plate(0.9, 0.45, tx, ORMAN.anit.x - 1.9, 1.05, ORMAN.anit.z + 2.36); pl.rotation.x = -0.35;
  }
  {
    // 42B return sign next to the forest stop, plus a painted bus bay
    const st = REGION_BY_ID.orman.stop;
    const tx = kit.paint(512, 200, (g, w, h) => { g.fillStyle = '#2f8f9a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 60px system-ui'; g.fillText('🚌 42B DÖNÜŞ', w / 2, 62); g.font = '800 32px system-ui'; g.fillText('Martıköy İskele · Stadyum', w / 2, 128); g.font = '700 24px system-ui'; g.fillText('otobüs bu duraktan kalkar', w / 2, 170); });
    for (const x of [-0.95, 0.95]) { const p = new T.Mesh(G(new T.CylinderGeometry(0.05, 0.05, 2.8, 6)), M(new T.MeshStandardMaterial({ color: '#9aa3ad', metalness: 0.6, roughness: 0.4 }))); p.position.set(st.x + 5.6 + x, 1.4, st.z + 2.6); signs.add(p); }
    const pl = plate(2.1, 0.82, tx, st.x + 5.6, 2.3, st.z + 2.63); (pl.material as T.MeshStandardMaterial).emissive.set('#ffffff'); (pl.material as T.MeshStandardMaterial).emissiveMap = tx; (pl.material as T.MeshStandardMaterial).emissiveIntensity = 0.25;
    const bay = kit.paint(512, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(242,194,48,.9)'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = 'rgba(242,194,48,.9)'; g.font = '900 54px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('OTOBÜS  42B', w / 2, h / 2 + 2); });
    const bm = new T.Mesh(G(new T.PlaneGeometry(11, 2.2)), M(new T.MeshStandardMaterial({ map: bay, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })));
    bm.rotation.x = -Math.PI / 2; bm.position.set(st.x - 2.2, 0.03, st.z - 2.5); signs.add(bm);
  }

  /* ---------- air ---------- */
  const shaftTex = kit.paint(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,244,200,.0)'); gr.addColorStop(0.25, 'rgba(255,244,200,.75)'); gr.addColorStop(1, 'rgba(255,244,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
  const shaftM = M(new T.MeshBasicMaterial({ map: shaftTex, color: '#fff0b8', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false }));
  const shaftG = G(new T.PlaneGeometry(4.2, 15));
  for (let i = 0; i < 11; i++) { const m = new T.Mesh(shaftG, shaftM); m.position.set(795 + i * 8.6 + (i % 3) * 2, 7, 1 + ((i * 7) % 19)); m.rotation.set(0, i * 0.9, 0.32 + (i % 2) * 0.1); root.add(m); }
  const patchTex = kit.paint(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,240,170,.95)'); gr.addColorStop(0.6, 'rgba(255,230,140,.35)'); gr.addColorStop(1, 'rgba(255,230,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const patchM = M(new T.MeshBasicMaterial({ map: patchTex, color: '#fff4cc', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  const patchG = G(new T.PlaneGeometry(1, 1));
  for (let i = 0; i < 26; i++) { const m = new T.Mesh(patchG, patchM), r = 3 + ((i * 5) % 4) * 1.4; m.rotation.x = -Math.PI / 2; m.position.set(792 + i * 3.4 + ((i * 7) % 5), 0.06, -1 + ((i * 11) % 23)); m.scale.set(r * 1.4, r, 1); root.add(m); }
  const mistTex = kit.paint(128, 128, (g) => { for (let k = 0; k < 6; k++) { const cx = 30 + R(k + 1) * 68, cy = 30 + R(k + 2) * 68, gr = g.createRadialGradient(cx, cy, 2, cx, cy, 34 + R(k + 3) * 20); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } });
  const mistM = M(new T.MeshLambertMaterial({ map: mistTex, color: '#dfe8ee', transparent: true, opacity: 0, depthWrite: false }));
  const mistG = G(new T.PlaneGeometry(14, 9));
  const mists = Array.from({ length: 12 }, (_, i) => { const m = new T.Mesh(mistG, mistM); m.rotation.x = -Math.PI / 2; m.position.set(800 + R(i + 11) * 80, 0.35 + (i % 3) * 0.22, -8 + R(i + 13) * 34); m.userData.v = 0.15 + R(i + 15) * 0.25; root.add(m); return m; });
  const LEAF_N = 160, leafPos = new Float32Array(LEAF_N * 3), leafGeo = G(new T.BufferGeometry());
  for (let i = 0; i < LEAF_N; i++) { leafPos[i * 3] = R(i + 3001) * 40 - 20; leafPos[i * 3 + 1] = R(i + 3002) * 7; leafPos[i * 3 + 2] = R(i + 3003) * 40 - 20; }
  leafGeo.setAttribute('position', new T.BufferAttribute(leafPos, 3));
  const leafM = M(new T.PointsMaterial({ color: '#d9a437', size: 0.2, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true }));
  const leaves = new T.Points(leafGeo, leafM); leaves.frustumCulled = false; root.add(leaves);
  // fireflies: few, small, slow, soft green-gold glow
  const FF = 90, ffPos = new Float32Array(FF * 3), ffCol = new Float32Array(FF * 3), ffGeo = G(new T.BufferGeometry()), ffHome: number[] = [];
  for (let i = 0; i < FF; i++) { const t = i < 30 ? { x: g0.x + (R(i + 61) - 0.5) * 12, z: g0.z + (R(i + 62) - 0.5) * 8 } : i < 50 ? { x: K.x + (R(i + 63) - 0.5) * 12, z: K.z + (R(i + 64) - 0.5) * 8 } : { x: rx(i + 4000), z: R(i + 65) < 0.5 ? 21 + R(i + 66) * 5 : -4.5 - R(i + 66) * 4 }; ffHome.push(t.x, t.z); }
  ffGeo.setAttribute('position', new T.BufferAttribute(ffPos, 3)); ffGeo.setAttribute('color', new T.BufferAttribute(ffCol, 3));
  const ffTex = kit.paint(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const ffM = M(new T.PointsMaterial({ size: 0.32, map: ffTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, fog: false }));
  const flies = new T.Points(ffGeo, ffM); flies.frustumCulled = false; root.add(flies);
  // birds: two flocks of V-wings (instanced); flapping = y scale of the wing tips
  const birdG = G(new T.BufferGeometry()); birdG.setAttribute('position', new T.Float32BufferAttribute([0, 0, -0.07, 0, 0, 0.07, -0.42, 0.14, 0, 0, 0, 0.07, 0, 0, -0.07, 0.42, 0.14, 0], 3)); birdG.computeVertexNormals();
  const birds = new T.InstancedMesh(birdG, M(new T.MeshBasicMaterial({ color: '#2b2b30', side: T.DoubleSide })), 12); birds.frustumCulled = false; root.add(birds);
  // squirrels: body, tail, head instanced (3 each)
  const sqM = M(new T.MeshStandardMaterial({ color: '#b0602a', roughness: 0.8 }));
  const sqBody = G(new T.SphereGeometry(0.11, 7, 5)); sqBody.scale(1.5, 0.9, 0.9); sqBody.translate(0, 0.12, 0);
  const sqTail = G(new T.SphereGeometry(0.1, 7, 5)); sqTail.scale(0.8, 2.0, 1.0); sqTail.translate(-0.16, 0.26, 0);
  const sqHead = G(new T.SphereGeometry(0.07, 7, 5)); sqHead.translate(0.16, 0.2, 0);
  const sqParts = [sqBody, sqTail, sqHead].map(g => { const m = new T.InstancedMesh(g, sqM, 3); m.frustumCulled = false; m.castShadow = true; root.add(m); return m; });
  // fener direkleri: patika kavşaklarında, geceleri sıcak ışık havuzu (gerçek ışık yok: sıcak ampul + yere yumuşak eklemeli parıltı)
  const FENER: [number, number][] = [[818, 11.5], [850, 11.5], [870, 11.5], [834, -0.2], [818, 20.4], [850, 20.4], [862, -1.0], [812, -3.4], [840, 6.9]];
  const postM = M(new T.MeshStandardMaterial({ color: '#2b2f33', roughness: 0.6, metalness: 0.4 }));
  const bulbM = M(new T.MeshBasicMaterial({ color: '#2a2a2a' }));
  const lampPost = G(new T.CylinderGeometry(0.04, 0.06, 2.5, 6)); lampPost.translate(0, 1.25, 0);
  const lampHead = G(new T.BoxGeometry(0.26, 0.34, 0.26)); lampHead.translate(0, 2.65, 0);
  const lampBulb = G(new T.SphereGeometry(0.11, 8, 6)); lampBulb.translate(0, 2.62, 0);
  const iPost = new T.InstancedMesh(lampPost, postM, FENER.length), iHead = new T.InstancedMesh(lampHead, postM, FENER.length), iBulb = new T.InstancedMesh(lampBulb, bulbM, FENER.length);
  const poolTex = kit.paint(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.35, 'rgba(255,190,110,.45)'); gr.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const poolM = M(new T.MeshBasicMaterial({ map: poolTex, color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  const poolG = G(new T.PlaneGeometry(1, 1)); poolG.rotateX(-Math.PI / 2);
  const iPool = new T.InstancedMesh(poolG, poolM, FENER.length);
  FENER.forEach(([x, z], i) => {
    o.position.set(x, 0, z); o.rotation.set(0, 0, 0); o.scale.setScalar(1); o.updateMatrix(); iPost.setMatrixAt(i, o.matrix); iHead.setMatrixAt(i, o.matrix); iBulb.setMatrixAt(i, o.matrix);
    o.position.set(x, 0.075, z); o.scale.set(6.6, 1, 6.6); o.updateMatrix(); iPool.setMatrixAt(i, o.matrix);
  });
  for (const im of [iPost, iHead, iBulb, iPool]) { im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; root.add(im); }
  // tavşanlar: gün boyu çayırlarda sıçrayarak gezer (instanced, 4 adet); yaklaşınca kaçar
  const rbM = M(new T.MeshStandardMaterial({ color: '#b9a58a', roughness: 0.95 }));
  const rbTailM = M(new T.MeshStandardMaterial({ color: '#f4efe6', roughness: 1 }));
  const rbBody = G(new T.SphereGeometry(0.12, 7, 5)); rbBody.scale(1.4, 0.95, 0.95); rbBody.translate(0, 0.14, 0);
  const rbHead = G(new T.SphereGeometry(0.075, 7, 5)); rbHead.translate(0.17, 0.22, 0);
  const rbEar = G(new T.CylinderGeometry(0.015, 0.025, 0.17, 5)); rbEar.rotateZ(-0.25); rbEar.translate(0.16, 0.36, 0);
  const rbTail = G(new T.SphereGeometry(0.045, 6, 4)); rbTail.translate(-0.18, 0.18, 0);
  const RB = 4, rbParts = [[rbBody, rbM], [rbHead, rbM], [rbEar, rbM], [rbTail, rbTailM]].map(([g, m]) => { const im = new T.InstancedMesh(g as T.BufferGeometry, m as T.Material, RB); im.frustumCulled = false; root.add(im); return im; });
  const rbHome: [number, number][] = [[808, 15], [834, 13.8], [858, 15.6], [846, 5.5]];
  const rbPos = rbHome.map(h0 => ({ x: h0[0], z: h0[1], vx: 0, vz: 0, hop: 0 }));
  // geyikler: şafakta ve günbatımında çayırda otlar; yaklaşılırsa koşarak uzaklaşır, sonra geri döner
  const dM = M(new T.MeshStandardMaterial({ color: '#9a6a3e', roughness: 0.9 })), dLegM = M(new T.MeshStandardMaterial({ color: '#6f4a2a', roughness: 0.9 })), dBellyM = M(new T.MeshStandardMaterial({ color: '#d9c7a0', roughness: 0.9 })), antM = M(new T.MeshStandardMaterial({ color: '#d8cdb4', roughness: 0.8 }));
  const gyBody = G(new T.SphereGeometry(0.5, 9, 7)); gyBody.scale(1.55, 0.72, 0.62);
  const dBelly = G(new T.SphereGeometry(0.4, 8, 6)); dBelly.scale(1.4, 0.5, 0.55);
  const dNeck = G(new T.CylinderGeometry(0.09, 0.15, 0.62, 6)); const gyHead = G(new T.SphereGeometry(0.13, 8, 6)); gyHead.scale(1.5, 1, 0.85);
  const dLeg = G(new T.CylinderGeometry(0.035, 0.05, 0.78, 5)); dLeg.translate(0, -0.39, 0);
  const dAnt = G(new T.CylinderGeometry(0.012, 0.02, 0.4, 4));
  const mkDeer = (ant: boolean) => {
    const g = new T.Group(), part = (geo: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number, rz = 0) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; g.add(m); return m; };
    part(gyBody, dM, 0, 0.95, 0); part(dBelly, dBellyM, 0.05, 0.82, 0);
    const neck = new T.Group(); neck.position.set(0.62, 1.05, 0); g.add(neck);
    const nm = new T.Mesh(dNeck, dM); nm.position.set(0.14, 0.26, 0); nm.rotation.z = -0.62; neck.add(nm);
    const hd = new T.Mesh(gyHead, dM); hd.position.set(0.42, 0.52, 0); neck.add(hd);
    if (ant) for (const sz of [-1, 1]) { const a = new T.Mesh(dAnt, antM); a.position.set(0.38, 0.78, sz * 0.07); a.rotation.set(sz * 0.5, 0, -0.3); neck.add(a); }
    const legs = [[0.42, 0.14], [0.42, -0.14], [-0.42, 0.14], [-0.42, -0.14]].map(([lx, lz]) => part(dLeg, dLegM, lx, 0.82, lz));
    g.visible = false; root.add(g); return { g, neck, legs };
  };
  const deer = [{ ...mkDeer(true), home: [822.5, 14.6] as [number, number], off: 0, away: [0, 0] as [number, number], t0: 0 }, { ...mkDeer(false), home: [825.2, 15.6] as [number, number], off: 0, away: [0, 0] as [number, number], t0: 1.7 }];
  const nearTrails = trees.filter(t => t.z > -5 && t.z < 23);

  let t = 0, shown = true;
  const setVis = (v: boolean) => { if (v === shown) return; shown = v; root.visible = v; };
  return {
    update(dt, p, h, on) {
      setVis(on); if (!on) return;
      t += dt;
      const B = gunBandi(h), br = 0.75 + 0.25 * Math.sin(t * 0.7);
      // light shafts + patches: warm morning, neutral day, golden evening, off at night
      const warm = Math.max(B.morning, B.golden);
      shaftM.color.setRGB(1, 0.94 - warm * 0.2 - B.golden * 0.12, 0.78 - warm * 0.4); patchM.color.copy(shaftM.color);
      shaftM.opacity = (0.16 + warm * 0.12) * br * B.day; patchM.opacity = (0.26 + B.morning * 0.14) * (1 - B.golden * 0.6) * br * B.day;
      // mist: dawn, dusk, night (blue-grey at night)
      const mk = Math.max(B.morning * 0.9, B.golden * 0.3, B.night * 0.45); mistM.opacity = 0.3 * mk; mistM.color.setRGB(0.88 - B.night * 0.2, 0.92 - B.night * 0.15, 0.95);
      for (const m of mists) { m.visible = mk > 0.02; if (!m.visible) continue; m.position.x += dt * m.userData.v; if (m.position.x > 884) m.position.x = 796; }
      // fener: akşam 18'den yanar, gece tam parlar; ampul hafif titrer
      { const lk = Math.min(1, B.night + smooth(17.5, 19.5, h) * (1 - B.night)); poolM.opacity = lk * (0.42 + 0.04 * Math.sin(t * 3.1)); bulbM.color.setRGB(0.16 + 0.84 * lk, 0.16 + 0.7 * lk, 0.16 + 0.42 * lk); }
      // leaves (fewer and darker at night)
      leafM.opacity = 0.9 * (1 - B.night * 0.7);
      { leaves.position.set(p.x, 0, p.z); const a = leafGeo.getAttribute('position') as T.BufferAttribute;
        for (let i = 0; i < LEAF_N; i++) { let y = a.getY(i) - dt * (0.5 + (i % 5) * 0.12), x = a.getX(i) + Math.sin(t * 0.9 + i) * dt * 0.8 + dt * 0.3; const z = a.getZ(i) + Math.cos(t * 0.7 + i * 1.3) * dt * 0.6; if (y < 0) y = 7; a.setXYZ(i, x > 20 ? -20 : x, y, z); }
        a.needsUpdate = true; }
      // fireflies
      const ffk = smooth(19.8, 21, h) + (h < 5 ? 1 : 0); ffM.opacity = Math.min(1, ffk) * 0.95; flies.visible = ffM.opacity > 0.01;
      if (flies.visible) {
        const a = ffGeo.getAttribute('position') as T.BufferAttribute, c = ffGeo.getAttribute('color') as T.BufferAttribute;
        for (let i = 0; i < FF; i++) {
          const s = t * (0.15 + R(i + 7) * 0.2) + i * 2.1;
          a.setXYZ(i, ffHome[i * 2] + Math.sin(s) * 1.6 + Math.sin(s * 2.3) * 0.5, 0.5 + R(i + 8) * 1.6 + Math.sin(s * 1.7) * 0.35, ffHome[i * 2 + 1] + Math.cos(s * 0.8) * 1.4);
          const blink = Math.max(0, Math.sin(t * (0.8 + R(i + 9) * 0.9) + i * 1.7)) ** 3; c.setXYZ(i, 0.75 * blink, 0.95 * blink, 0.35 * blink);
        }
        a.needsUpdate = true; c.needsUpdate = true;
      }
      // birds by day: two flocks crossing high on long loops
      birds.visible = B.day > 0.3;
      if (birds.visible) for (let i = 0; i < 12; i++) {
        const fl = i < 6 ? 0 : 1, k = i % 6, per = fl ? 46 : 38, ph = ((t + fl * 17) % per) / per;
        const cx = 790 + ph * 110 + (k % 3) * 1.2 - (k > 2 ? 1.6 : 0), cz = (fl ? 22 : -6) + Math.sin(ph * 6.28) * 6 + (k % 3) * 0.9, cy = 10 + fl * 2 + Math.sin(t * 0.5 + k) * 0.4;
        o.position.set(cx, cy, cz); o.rotation.set(0, Math.PI / 2 + Math.cos(ph * 6.28) * 0.3, 0); o.scale.set(1.2, Math.sin(t * 9 + k * 1.3), 1.2); o.updateMatrix(); birds.setMatrixAt(i, o.matrix);
      }
      birds.instanceMatrix.needsUpdate = true;
      // squirrels by day: run between two trees, nibble, run up the trunk and vanish into the canopy
      const sqOn = B.day > 0.6 && h > 7 && h < 18.5;
      for (let s = 0; s < 3; s++) {
        const per = 16, cyc = Math.floor((t + s * 5.3) / per), u = ((t + s * 5.3) % per), A = nearTrails[(cyc * 7 + s * 13) % nearTrails.length], Bt = nearTrails[(cyc * 7 + s * 13 + 3) % nearTrails.length];
        let x = A.x, z = A.z, y = 0, rot = 0, vis = sqOn && !!A && !!Bt;
        const dx = Bt.x - A.x, dz = Bt.z - A.z, L = Math.hypot(dx, dz);
        if (L > 14) vis = false;
        if (u < 3) { const k = u / 3; x = A.x + dx * k; z = A.z + dz * k; y = Math.abs(Math.sin(u * 9)) * 0.12; rot = Math.atan2(-dz, dx); }
        else if (u < 6) { x = Bt.x - dx / L * 0.7; z = Bt.z - dz / L * 0.7; rot = Math.atan2(-dz, dx); }
        else if (u < 8) { x = Bt.x - dx / L * 0.35; z = Bt.z - dz / L * 0.35; y = (u - 6) * 1.4; rot = Math.atan2(-dz, dx); o.rotation.set(0, rot, Math.PI / 2); }
        else vis = false;
        if (u < 6 || u >= 8) o.rotation.set(0, rot, 0);
        o.position.set(x, y, z); o.scale.setScalar(vis ? 1 : 0); o.updateMatrix();
        for (const m of sqParts) m.setMatrixAt(s, o.matrix);
      }
      for (const m of sqParts) m.instanceMatrix.needsUpdate = true;
      // tavşanlar
      const rbOn = h > 5.5 && h < 21;
      rbPos.forEach((r, i) => {
        const dx = p.x - r.x, dz = p.z - r.z, dh = Math.hypot(dx, dz);
        if (r.hop <= 0) {   // yeni sıçrama: yakındaysa uzaklaş, değilse evin etrafında rastgele
          if (dh < 3.2) { const k = 1 / Math.max(0.5, dh); r.vx = -dx * k * 2.6; r.vz = -dz * k * 2.6; r.hop = 0.45; }
          else if (R(Math.floor(t * 0.4) + i * 31) < 0.12) { const a = R(Math.floor(t * 0.4) * 7 + i) * 6.28; r.vx = Math.cos(a) * 1.5; r.vz = Math.sin(a) * 1.5; r.hop = 0.5; }
          else { r.vx = r.vz = 0; r.hop = 0; }
          const hx = rbHome[i][0] - r.x, hz = rbHome[i][1] - r.z; if (Math.hypot(hx, hz) > 6 && r.hop > 0) { r.vx = hx * 0.3; r.vz = hz * 0.3; }
        }
        let y = 0; if (r.hop > 0) { r.hop -= dt; r.x += r.vx * dt; r.z += r.vz * dt; y = Math.sin(Math.max(0, r.hop) / 0.5 * Math.PI) * 0.22; if (r.hop <= 0) r.hop = r.vx || r.vz ? -0.5 - R(i + Math.floor(t)) * 1.5 : 0; }
        else if (r.hop < 0) r.hop += dt;
        const ok = rbOn && !onTrail(r.x, r.z, -0.2) && !inPond(r.x, r.z, 0.5);
        o.position.set(r.x, y, r.z); o.rotation.set(0, -Math.atan2(r.vz || 0.001, r.vx || 1), 0); o.scale.setScalar(ok ? 1 : 0); o.updateMatrix();
        for (const im of rbParts) im.setMatrixAt(i, o.matrix);
      });
      for (const im of rbParts) im.instanceMatrix.needsUpdate = true;
      // geyikler
      const dOn = (h >= 5.5 && h < 9.5) || (h >= 17 && h < 20.5);
      for (const d of deer) {
        d.g.visible = dOn && d.off < 40;
        if (!d.g.visible) { d.off = 0; continue; }
        const hx = d.home[0], hz = d.home[1], dx = p.x - (hx + d.away[0] * d.off), dz = p.z - (hz + d.away[1] * d.off), dh = Math.hypot(dx, dz);
        if (dh < 6.5 && d.off < 25) { if (d.off === 0) { const k = 1 / Math.max(0.5, Math.hypot(hx - p.x, hz - p.z)); d.away = [(hx - p.x) * k, (hz - p.z) * k]; } d.off += dt * 6.5; }
        else if (dh > 16 && d.off > 0) d.off = Math.max(0, d.off - dt * 1.2);
        const run = d.off > 0 && dh < 16 ? 1 : 0, ph = t * (run ? 11 : 0) + d.t0;
        const x = hx + d.away[0] * d.off, z = hz + d.away[1] * d.off;
        d.g.position.set(x, 0, z); d.g.rotation.y = d.off > 0 ? -Math.atan2(d.away[1], d.away[0]) : -0.6 + Math.sin(t * 0.07 + d.t0) * 0.5;
        d.g.position.y = run ? Math.abs(Math.sin(ph)) * 0.12 : 0;
        d.neck.rotation.z = run ? 0.1 : (Math.sin(t * 0.35 + d.t0) > 0.15 ? 0.95 : 0.1) + Math.sin(t * 1.3 + d.t0) * 0.03;   // başı indirip otlar
        d.legs.forEach((l, k) => { l.rotation.z = run ? Math.sin(ph + (k % 2 ? Math.PI : 0) + (k > 1 ? 0.8 : 0)) * 0.7 : 0; });
      }
      // pond: ripples and ducks (paddling by day, asleep by the reeds at night)
      rings.forEach((m, i) => { const k = ((t * 0.35 + i / 3) % 1); m.scale.setScalar(0.2 + k * 1.3); (m.material as T.MeshLambertMaterial).opacity = 0.35 * (1 - k) * (0.15 + 0.85 * B.day); });
      ducks.forEach((dk, i) => {
        const a = B.day > 0.4 ? t * (0.12 + i * 0.03) + i * 2.6 : 2.2 + i * 0.5, r = B.day > 0.4 ? 0.55 + 0.12 * Math.sin(t * 0.3 + i) : 0.8;
        dk.position.set(g0.x + Math.cos(a) * g0.rx * r, 0.03 + Math.sin(t * 2 + i) * 0.01, g0.z + Math.sin(a) * g0.rz * r); dk.rotation.y = -a - Math.PI / 2 * (B.day > 0.4 ? 1 : 0);
      });
      // campfire: lit in the evening and night, embers in the morning
      const fire = h >= 18 || h < 1.5 ? 1 : h >= 6 && h < 8 ? 0.45 : 0;
      fl1.visible = fl2.visible = fire > 0; glow.visible = fire > 0;
      if (fire > 0) { const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 23.7) * 0.06; fl1.scale.set(f, f * (0.9 + Math.sin(t * 7.3) * 0.15) * fire, f); fl2.scale.set(f, f * (1 + Math.sin(t * 9.1) * 0.2) * fire, f); glowM.opacity = (0.35 + 0.45 * B.night) * fire * (0.85 + Math.sin(t * 11) * 0.08); }
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); },
  };
}
