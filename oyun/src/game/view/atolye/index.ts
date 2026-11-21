/**
 * Martı Atölyesi (16:52 user: "gerekirse 3d asset oluşturacak bir motor yap kendine, oradan oluştur modelleri").
 * A small procedural asset kit on three.js: rounded boxes, canvas-painted textures (signs, LED boards, posters,
 * window bands), shared material cache, and model builders that return a ready Object3D plus its moving parts.
 * Every asset is code-made (no files), cheap (a few dozen meshes), casts shadows, and is disposed by its owner kit.
 * Builders: bus (42B city bus with doors, LED sign, lights), busStop (glass shelter, bench, poster, line plate),
 * mushroom (5 species), smoke puffs, water stream. All names and brands are invented.
 */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Kit {
  mat(color: string, o?: T.MeshStandardMaterialParameters): T.MeshStandardMaterial;
  rbox(w: number, h: number, d: number, r: number, m: T.Material): T.Mesh;
  box(w: number, h: number, d: number, m: T.Material): T.Mesh;
  cyl(rt: number, rb: number, h: number, m: T.Material, seg?: number): T.Mesh;
  sph(r: number, m: T.Material, w?: number, h?: number): T.Mesh;
  paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): T.CanvasTexture;
  dispose(): void;
}

export function createKit(): Kit {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [], texs: T.Texture[] = [];
  const cache = new Map<string, T.MeshStandardMaterial>();
  const shadow = (m: T.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };
  return {
    mat(color, o = {}) {
      const key = color + JSON.stringify(o, (k, v) => (v instanceof T.Texture ? v.uuid : v));
      let m = cache.get(key);
      if (!m) { m = new T.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...o }); cache.set(key, m); mats.push(m); }
      return m;
    },
    rbox(w, h, d, r, m) { const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)); geos.push(g); return shadow(new T.Mesh(g, m)); },
    box(w, h, d, m) { const g = new T.BoxGeometry(w, h, d); geos.push(g); return shadow(new T.Mesh(g, m)); },
    cyl(rt, rb, h, m, seg = 16) { const g = new T.CylinderGeometry(rt, rb, h, seg); geos.push(g); return shadow(new T.Mesh(g, m)); },
    sph(r, m, w = 16, h = 12) { const g = new T.SphereGeometry(r, w, h); geos.push(g); return shadow(new T.Mesh(g, m)); },
    paint(w, h, draw) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!, w, h);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; texs.push(t); return t;
    },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); cache.clear(); },
  };
}

const at = <O extends T.Object3D>(o: O, x: number, y: number, z: number, p?: T.Object3D) => { o.position.set(x, y, z); p?.add(o); return o; };

/** 42B city bus, 10.5 m long along +x (front at +x). doors(open 0..1), lights(on), wheel spin by distance. */
export function buildBus(k: Kit, line = '42B', dest = 'MARTIKÖY HATTI') {
  const g = new T.Group(); g.name = 'otobus-42B';
  const L = 10.5, W = 2.5, H = 2.9;
  const white = k.mat('#f4f1ea'), orange = k.mat('#e8742c'), teal = k.mat('#2f8f9a'), dark = k.mat('#20242c', { roughness: 0.4 });
  const glass = k.mat('#1d2a36', { roughness: 0.08, metalness: 0.6, envMapIntensity: 1 });
  const body = at(k.rbox(L, H - 0.45, W, 0.28, white), 0, 0.45 + (H - 0.45) / 2, 0, g);
  void body;
  // livery: orange skirt, teal belt line, roof cap
  at(k.rbox(L + 0.02, 0.55, W + 0.02, 0.12, orange), 0, 0.72, 0, g);
  at(k.box(L - 0.4, 0.09, W + 0.04, teal), 0, 1.12, 0, g);
  at(k.rbox(L - 1.2, 0.32, W - 0.5, 0.12, k.mat('#d9d4ca')), -0.6, H + 0.1, 0, g);   // AC unit
  // side windows band + windshield + rear window
  for (const s of [-1, 1]) {
    at(k.box(L - 1.6, 1.0, 0.03, glass), -0.35, 1.9, s * (W / 2 + 0.005), g);
    for (let i = 0; i < 7; i++) at(k.box(0.09, 1.02, 0.04, white), -4.6 + i * 1.32, 1.9, s * (W / 2 + 0.01), g);
  }
  at(k.box(0.04, 1.35, W - 0.25, glass), L / 2 + 0.005, 1.75, 0, g);
  at(k.box(0.04, 0.8, W - 0.5, glass), -L / 2 - 0.005, 2.0, 0, g);
  // LED destination boards (front + side)
  const led = k.paint(512, 64, (c, w, h) => {
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffb21e'; c.font = '900 44px monospace'; c.textBaseline = 'middle';
    c.fillText(line, 14, h / 2 + 2); c.font = '800 34px monospace'; c.fillText(dest, 120, h / 2 + 2, w - 130);
    c.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < w; x += 4) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);
  });
  const ledM = k.mat('#ffffff', { map: led, emissive: '#ffffff', emissiveMap: led, emissiveIntensity: 0.9 });
  const front = at(k.box(0.03, 0.28, W - 0.4, ledM), L / 2 + 0.03, 2.6, 0, g); front.rotation.y = 0;
  front.geometry = new T.PlaneGeometry(W - 0.4, 0.28); front.rotation.y = Math.PI / 2;
  const side = at(new T.Mesh(new T.PlaneGeometry(2.4, 0.3), ledM), 2.6, 2.58, W / 2 + 0.02, g); void side;
  // city crest + line number painted on the side
  const crest = k.paint(256, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.fillStyle = '#e8742c'; c.beginPath(); c.arc(54, 64, 46, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = '900 40px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 54, 66);
    c.fillStyle = '#2f8f9a'; c.textAlign = 'left'; c.font = '900 26px system-ui'; c.fillText('MARTIKÖY', 108, 50); c.font = '700 20px system-ui'; c.fillText('Belediyesi', 110, 82);
  });
  at(new T.Mesh(new T.PlaneGeometry(1.6, 0.8), k.mat('#ffffff', { map: crest, transparent: true })), -2.4, 1.45, W / 2 + 0.03, g);
  // doors (right side = +z, curb side): two double doors that slide open
  const doors: T.Mesh[] = [];
  for (const dx of [3.7, -0.6]) for (const s of [-1, 1]) {
    const d = at(k.box(0.56, 2.05, 0.05, k.mat('#1d2a36', { roughness: 0.1, metalness: 0.5 })), dx + s * 0.29, 1.5, W / 2 + 0.04, g);
    d.userData.base = dx + s * 0.29; d.userData.s = s; doors.push(d);
    at(k.box(0.6, 0.06, 0.06, white), dx + s * 0.29, 0.5, W / 2 + 0.05, g);
  }
  // wheels with hubs
  const tyre = k.mat('#1b1b1b', { roughness: 0.9 }), hub = k.mat('#c9ccd2', { metalness: 0.7, roughness: 0.3 });
  const wheels: T.Group[] = [];
  for (const wx of [3.1, -3.3]) for (const s of [-1, 1]) {
    const w = new T.Group(); at(w, wx, 0.5, s * (W / 2 - 0.12), g);
    const t = k.cyl(0.5, 0.5, 0.34, tyre, 20); t.rotation.x = Math.PI / 2; w.add(t);
    const h = k.cyl(0.28, 0.28, 0.36, hub, 10); h.rotation.x = Math.PI / 2; w.add(h);
    for (let i = 0; i < 5; i++) { const n = k.box(0.06, 0.06, 0.38, dark); n.position.set(Math.cos(i * 1.256) * 0.18, Math.sin(i * 1.256) * 0.18, 0); w.add(n); }
    wheels.push(w);
    at(k.box(1.3, 0.3, 0.1, dark), wx, 1.05, s * (W / 2 + 0.01), g);   // arch
  }
  // lights, bumper, mirrors
  const head = k.mat('#fff6d8', { emissive: '#fff2c0', emissiveIntensity: 0.3 }), tail = k.mat('#d8342c', { emissive: '#ff3a2a', emissiveIntensity: 0.3 });
  for (const s of [-1, 1]) {
    at(k.rbox(0.08, 0.2, 0.42, 0.04, head), L / 2 + 0.02, 0.85, s * 0.85, g);
    at(k.rbox(0.08, 0.36, 0.2, 0.04, tail), -L / 2 - 0.02, 1.0, s * 1.0, g);
    const arm = at(k.box(0.5, 0.05, 0.05, dark), L / 2 + 0.05, 2.35, s * (W / 2 + 0.25), g); arm.rotation.y = s * 0.3;
    at(k.rbox(0.08, 0.38, 0.22, 0.04, dark), L / 2 + 0.25, 2.15, s * (W / 2 + 0.42), g);
  }
  at(k.rbox(0.25, 0.32, W + 0.06, 0.1, k.mat('#3a3f48')), L / 2 + 0.05, 0.42, 0, g);
  at(k.rbox(0.25, 0.32, W + 0.06, 0.1, k.mat('#3a3f48')), -L / 2 - 0.05, 0.42, 0, g);
  // driver silhouette + seats seen through glass
  at(k.sph(0.2, k.mat('#c98d62')), L / 2 - 1.0, 1.95, -0.6, g);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) at(k.rbox(0.5, 0.6, 0.5, 0.08, teal), 3 - i * 1.25, 1.35, s * 0.75, g);
  let spin = 0;
  return {
    object: g as T.Object3D,
    set(o: { doors: number; lights: number; moved: number }) {
      doors.forEach(d => { d.position.x = d.userData.base + d.userData.s * 0.5 * o.doors; });
      head.emissiveIntensity = 0.3 + o.lights * 1.6; tail.emissiveIntensity = 0.3 + o.lights * 1.2;
      spin -= o.moved / 0.5; wheels.forEach(w => { w.rotation.z = spin; });
    },
  };
}

/** Glass bus shelter facing +z: roof, back + side glass, bench, poster (parody brand), round line plate on a pole. */
export function buildBusStop(k: Kit, line = '42B', dest = 'Martıköy Hattı') {
  const g = new T.Group(); g.name = 'otobus-duragi';
  const steel = k.mat('#9aa3ad', { metalness: 0.7, roughness: 0.35 }), glass = k.mat('#bfe3f2', { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const roof = at(k.rbox(4.2, 0.16, 1.9, 0.06, k.mat('#2f8f9a')), 0, 2.55, 0, g); void roof;
  at(k.box(4.2, 0.06, 1.9, k.mat('#e8742c')), 0, 2.44, 0, g);
  for (const x of [-2, 2]) for (const z of [-0.85, 0.85]) at(k.cyl(0.05, 0.05, 2.45, steel, 8), x, 1.22, z, g);
  at(k.box(3.95, 2.0, 0.03, glass), 0, 1.3, -0.85, g);
  for (const x of [-2, 2]) at(k.box(0.03, 2.0, 1.6, glass), x, 1.3, 0, g);
  // bench
  const wood = k.mat('#b07a48');
  for (let i = 0; i < 3; i++) at(k.rbox(2.6, 0.06, 0.13, 0.02, wood), 0, 0.5, -0.5 + i * 0.15, g);
  for (const x of [-1.1, 1.1]) at(k.box(0.06, 0.5, 0.42, steel), x, 0.25, -0.35, g);
  // poster in the side panel
  const poster = k.paint(256, 384, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e0533c'); gr.addColorStop(1, '#8a1f1a'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff'; c.font = '900 64px system-ui'; c.textAlign = 'center'; c.fillText('KOLAZ', w / 2, 90);
    c.font = '700 24px system-ui'; c.fillText('Buz gibi, Martıköy işi', w / 2, 130);
    c.fillStyle = '#5a1410'; c.beginPath(); c.roundRect(w / 2 - 38, 160, 76, 170, 26); c.fill(); c.fillStyle = '#fff'; c.fillRect(w / 2 - 38, 220, 76, 30);
  });
  at(new T.Mesh(new T.PlaneGeometry(1.0, 1.5), k.mat('#ffffff', { map: poster, emissive: '#ffffff', emissiveMap: poster, emissiveIntensity: 0.25 })), 1.98, 1.35, 0.1, g).rotation.y = -Math.PI / 2;
  // name strip on the roof edge
  const strip = k.paint(512, 64, (c, w, h) => { c.fillStyle = '#2f8f9a'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 34px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('BÜFE ÖNÜ DURAĞI', w / 2, h / 2 + 2); });
  at(new T.Mesh(new T.PlaneGeometry(3.6, 0.16), k.mat('#ffffff', { map: strip })), 0, 2.55, 0.955, g);
  // line plate on a pole + timetable
  at(k.cyl(0.05, 0.05, 3.0, steel, 8), 2.6, 1.5, 0.7, g);
  const plate = k.paint(256, 256, (c, w, h) => {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, 124, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#2f8f9a'; c.lineWidth = 16; c.stroke();
    c.fillStyle = '#2f8f9a'; c.font = '900 30px system-ui'; c.textAlign = 'center'; c.fillText('OTOBÜS', w / 2, 82);
    c.fillStyle = '#e8742c'; c.font = '900 84px system-ui'; c.fillText(line, w / 2, 160); c.fillStyle = '#333'; c.font = '700 22px system-ui'; c.fillText(dest, w / 2, 200);
  });
  const pm = k.mat('#ffffff', { map: plate, side: T.DoubleSide });
  at(new T.Mesh(new T.CircleGeometry(0.42, 28), pm), 2.6, 2.9, 0.76, g);
  const tt = k.paint(256, 320, (c, w, h) => {
    c.fillStyle = '#fbf9f4'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f8f9a'; c.fillRect(0, 0, w, 50); c.fillStyle = '#fff'; c.font = '900 28px system-ui'; c.textAlign = 'center'; c.fillText(line + ' SEFERLER', w / 2, 35);
    c.fillStyle = '#333'; c.font = '700 22px monospace'; c.textAlign = 'left';
    ['08:15  09:40', '11:05  12:30', '14:00  15:20', '16:45  18:10', '19:30  21:00'].forEach((t, i) => c.fillText(t, 30, 92 + i * 40));
  });
  at(new T.Mesh(new T.PlaneGeometry(0.4, 0.5), k.mat('#ffffff', { map: tt })), 2.6, 1.6, 0.76, g);
  return g as T.Object3D;
}

/** Mushroom: stem + cap; the poisonous one gets white dots. */
export function buildMushroom(k: Kit, cap: string, stem = '#efe6d2', dots = false) {
  const g = new T.Group();
  at(k.cyl(0.06, 0.08, 0.22, k.mat(stem), 10), 0, 0.11, 0, g);
  const c = at(k.sph(0.16, k.mat(cap), 16, 10), 0, 0.22, 0, g); c.scale.set(1, 0.6, 1);
  if (dots) for (let i = 0; i < 7; i++) { const a = i * 0.9, r = i ? 0.11 : 0; at(k.sph(0.025, k.mat('#ffffff'), 8, 6), Math.cos(a) * r, 0.3 - r * 0.35, Math.sin(a) * r, g); }
  return g;
}
