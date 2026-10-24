/**
 * Martı Asset Fabrikası: ortak alet çantası.
 * Kural: birim metre, y yukarı, model zemin ortasında (0,0,0), ön yüz +z.
 * Her üretici (k, secenek, rng) alır, THREE.Group döner. Hareketli parçalar group.userData.parca içinde.
 * group.userData.carpisma = {w,h,d} oyundaki katı çarpışma kutusu için.
 */
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export { T };

/** mulberry32, tohumlu rastgele */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  return {
    next,
    range: (a, b) => a + next() * (b - a),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: arr => arr[Math.floor(next() * arr.length)],
    chance: p => next() < p,
  };
}

/** Renk yardımcıları */
export function ton(hex, l = 0, s = 0, h = 0) {
  const c = new T.Color(hex); const o = {}; c.getHSL(o);
  c.setHSL((o.h + h + 1) % 1, Math.min(1, Math.max(0, o.s + s)), Math.min(1, Math.max(0, o.l + l)));
  return '#' + c.getHexString();
}

export function kit() {
  const geos = [], mats = [], texs = [];
  const cache = new Map();
  const golge = m => { m.castShadow = true; m.receiveShadow = true; return m; };
  const mesh = (g, m) => { geos.push(g); return golge(new T.Mesh(g, m)); };
  const k = {
    T,
    mat(color, o = {}) {
      const key = color + JSON.stringify(o, (_, v) => (v && v.isTexture ? v.uuid : v));
      let m = cache.get(key);
      if (!m) { m = new T.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02, ...o }); cache.set(key, m); mats.push(m); }
      return m;
    },
    cam(color = '#9fc4d6', o = {}) { return k.mat(color, { roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0.55, ...o }); },
    isik(color, guc = 1.2) { return k.mat(color, { emissive: color, emissiveIntensity: guc }); },
    rbox(w, h, d, r, m) { return mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(0.001, Math.min(r, w / 2, h / 2, d / 2))), m); },
    box(w, h, d, m) { return mesh(new T.BoxGeometry(w, h, d), m); },
    cyl(rt, rb, h, m, seg = 18, open = false) { return mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, open), m); },
    cone(r, h, m, seg = 16) { return mesh(new T.ConeGeometry(r, h, seg), m); },
    sph(r, m, w = r < 0.1 ? 12 : 20, h = r < 0.1 ? 9 : 14) { return mesh(new T.SphereGeometry(r, w, h), m); },
    /** küre parçası: phi yatay, theta dikey (0 = tepe) */
    kup(r, m, phiS, phiL, thS, thL, w = 24, h = 14) { return mesh(new T.SphereGeometry(r, w, h, phiS, phiL, thS, thL), m); },
    kapsul(r, l, m) { return mesh(new T.CapsuleGeometry(r, l, 6, 14), m); },
    torus(r, t, m, rs = 12, ts = 28, arc = Math.PI * 2) { return mesh(new T.TorusGeometry(r, t, rs, ts, arc), m); },
    /** profil [[r,y],...] etrafında döndür (bardak, şişe, tabak) */
    lathe(pts, m, seg = 28) { return mesh(new T.LatheGeometry(pts.map(([x, y]) => new T.Vector2(x, y)), seg), m); },
    /** 2B şekli kalınlaştır. pts [[x,y],...] */
    extrude(pts, depth, m, bevel = 0.01) {
      const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
      const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 });
      g.translate(0, 0, -depth / 2); return mesh(g, m);
    },
    tube(points, r, m, seg = 24) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), seg, r, 8, false), m); },
    plane(w, h, m) { return mesh(new T.PlaneGeometry(w, h), m); },
    /** canvas'a çiz, doku olarak al */
    paint(w, h, draw, tekrar) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
      const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4;
      if (tekrar) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(tekrar[0], tekrar[1]); }
      texs.push(t); return t;
    },
    /** dokulu malzeme kısa yolu */
    dmat(w, h, draw, o = {}, tekrar) { return k.mat('#ffffff', { map: k.paint(w, h, draw, tekrar), ...o }); },
    at(o, x = 0, y = 0, z = 0, p) { o.position.set(x, y, z); if (p) p.add(o); return o; },
    grup(ad, p) { const g = new T.Group(); g.name = ad || ''; if (p) p.add(g); return g; },
    dispose() { geos.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); texs.forEach(t => t.dispose()); cache.clear(); },
  };
  return k;
}

/* ---------- canvas yardımcıları ---------- */
export function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
export function yazi(g, s, x, y, { font = '900 40px system-ui', renk = '#fff', hiza = 'center', max = 9999, kontur, kalin = 6 } = {}) {
  g.font = font; g.textAlign = hiza; g.textBaseline = 'middle';
  const m = g.measureText(s).width; g.save(); g.translate(x, y); if (m > max) g.scale(max / m, 1);
  if (kontur) { g.lineJoin = 'round'; g.strokeStyle = kontur; g.lineWidth = kalin; g.strokeText(s, 0, 0); }
  g.fillStyle = renk; g.fillText(s, 0, 0); g.restore();
}
/** benek / gren */
export function gren(g, w, h, renk, n = 400, r = 1.5, seed = 3) {
  const R = rng(seed); g.fillStyle = renk;
  for (let i = 0; i < n; i++) { g.globalAlpha = R.range(0.15, 0.6); g.beginPath(); g.arc(R.next() * w, R.next() * h, R.range(r * 0.4, r), 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

/**
 * Pişir: hareketsiz meshleri malzemeye göre birleştir (yüzlerce mesh -> birkaç çizim çağrısı). Lag'e karşı.
 * userData.hareket=true olan alt ağaçlara dokunmaz.
 */
export function pisir(root) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const kova = new Map(); const sil = []; const alt = [];
  const gez = o => {
    for (const c of o.children) {
      if (c.userData.hareket) { alt.push(c); continue; }   // hareketli parça: kendi içinde ayrıca pişir
      if (c.isMesh && !Array.isArray(c.material) && !c.userData.pisirme) {
        let g = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone();
        for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
        if (!g.attributes.uv) g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, c.matrixWorld));
        if (!kova.has(c.material)) kova.set(c.material, []);
        kova.get(c.material).push(g); sil.push(c);
      }
      gez(c);
    }
  };
  gez(root);
  // çocukları olan meshleri silerken çocuklarını koru
  for (const o of sil) { const p = o.parent; for (const ch of [...o.children]) p.attach(ch); p.remove(o); }
  for (const [m, list] of kova) {
    const mg = mergeVertices(mergeGeometries(list, false), 1e-4); list.forEach(g => g.dispose());
    const me = new T.Mesh(mg, m); me.castShadow = me.receiveShadow = true; me.userData.pisirme = true; root.add(me);
  }
  for (const a of alt) pisir(a);
  return root;
}

/** Modelin kutusunu ölç, çarpışma bilgisini yaz */
export function olc(root) {
  const b = new T.Box3().setFromObject(root); const s = new T.Vector3(); b.getSize(s);
  root.userData.carpisma = { w: +s.x.toFixed(2), h: +s.y.toFixed(2), d: +s.z.toFixed(2) };
  return root.userData.carpisma;
}
