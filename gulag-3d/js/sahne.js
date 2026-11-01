// Gulag Kaçışı 3D: dokular, malzemeler, sahne ve model üreticileri (Three.js r159, global THREE)
'use strict';
const V3 = THREE.Vector3;

// ---------- tohumlu gürültü ----------
function tohum(s) { return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function hash(x, y, s) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function gurultu(x, y, s, p) {
  // döşenebilir değer gürültüsü (periyot p)
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const m = (a) => ((a % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s, p, okt) { let t = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < okt; i++) { t += a * gurultu(x * f, y * f, s + i * 17, p * f); n += a; a *= 0.5; f *= 2; } return t / n; }

// ---------- prosedürel PBR doku üretici ----------
const DOKU = {};
function dokuUret(ad, boyut, yukseklik, renk, normalGuc) {
  if (DOKU[ad]) return DOKU[ad];
  const N = boyut, H = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) H[y * N + x] = yukseklik(x / N, y / N);
  const c1 = document.createElement('canvas'); c1.width = c1.height = N;
  const c2 = document.createElement('canvas'); c2.width = c2.height = N;
  const g1 = c1.getContext('2d'), g2 = c2.getContext('2d');
  const i1 = g1.createImageData(N, N), i2 = g2.createImageData(N, N);
  const h = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4, v = H[y * N + x];
    const [r, g, b] = renk(v, x / N, y / N);
    i1.data[k] = r; i1.data[k + 1] = g; i1.data[k + 2] = b; i1.data[k + 3] = 255;
    const dx = (h(x + 1, y) - h(x - 1, y)) * normalGuc, dy = (h(x, y + 1) - h(x, y - 1)) * normalGuc;
    const l = Math.hypot(dx, dy, 1);
    i2.data[k] = (-dx / l * 0.5 + 0.5) * 255; i2.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; i2.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; i2.data[k + 3] = 255;
  }
  g1.putImageData(i1, 0, 0); g2.putImageData(i2, 0, 0);
  const map = new THREE.CanvasTexture(c1), nor = new THREE.CanvasTexture(c2);
  map.colorSpace = THREE.SRGBColorSpace;
  [map, nor].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; });
  return (DOKU[ad] = { map, normalMap: nor });
}
const kar = (v, a, b) => Math.max(0, Math.min(255, a + (b - a) * v));
const karis = (c1, c2, v) => [kar(v, c1[0], c2[0]), kar(v, c1[1], c2[1]), kar(v, c1[2], c2[2])];

function dokular() {
  dokuUret('beton', 256, (u, v) => {
    const blok = (Math.abs(((v * 2) % 1) - 0.5) > 0.47 || Math.abs((((u + (Math.floor(v * 2) % 2) * 0.5) * 1) % 1) - 0.5) > 0.485) ? -0.35 : 0;
    const catlak = Math.max(0, 1 - Math.abs(fbm(u * 6, v * 6, 3, 6, 3) - 0.5) * 40) * -0.25;
    return fbm(u * 8, v * 8, 1, 8, 5) * 0.6 + blok + catlak;
  }, (h, u, v) => { const leke = fbm(u * 3, v * 3, 9, 3, 3); return karis([58, 60, 66], [128, 126, 122], h * 0.8 + 0.25 - leke * 0.25); }, 3);
  dokuUret('tugla', 256, (u, v) => {
    const sira = Math.floor(v * 8), kay = (sira % 2) * 0.125, yx = ((u + kay) * 4) % 1, yy = (v * 8) % 1;
    const derz = (yx < 0.06 || yy < 0.12) ? -0.6 : 0;
    return fbm(u * 16, v * 16, 4, 16, 4) * 0.4 + derz + hash(Math.floor((u + kay) * 4), sira, 5) * 0.15;
  }, (h, u, v) => {
    const sira = Math.floor(v * 8), kay = (sira % 2) * 0.125, t = hash(Math.floor((u + kay) * 4), sira, 7);
    if (h < -0.3) return [70, 64, 58];
    return karis([92, 40, 30], [150, 74, 52], t * 0.7 + h * 0.6);
  }, 3);
  dokuUret('tahta', 256, (u, v) => {
    const kalas = Math.floor(v * 4), yy = (v * 4) % 1, ara = yy < 0.05 ? -0.7 : 0;
    const damar = Math.sin((u * 30 + fbm(u * 4, v * 8, kalas + 2, 4, 3) * 8) + kalas * 3) * 0.12;
    return damar + ara + fbm(u * 20, v * 4, kalas, 20, 3) * 0.3;
  }, (h, u, v) => karis([54, 36, 22], [128, 92, 58], h * 0.9 + 0.45 + hash(0, Math.floor(v * 4), 3) * 0.2), 2.5);
  dokuUret('kar', 256, (u, v) => fbm(u * 6, v * 6, 11, 6, 5) * 0.8 + (hash(u * 256 | 0, v * 256 | 0, 2) > 0.995 ? 0.4 : 0),
    (h) => karis([196, 206, 224], [246, 248, 255], h), 1.6);
  dokuUret('toprak', 256, (u, v) => fbm(u * 10, v * 10, 21, 10, 5),
    (h, u, v) => karis([34, 30, 32], [84, 80, 82], h + fbm(u * 3, v * 3, 4, 3, 2) * 0.3 - 0.15), 2.5);
  dokuUret('metal', 256, (u, v) => Math.sin(u * Math.PI * 16) * 0.5 + fbm(u * 8, v * 8, 31, 8, 4) * 0.3,
    (h, u, v) => { const pas = fbm(u * 5, v * 5, 33, 5, 4); return pas > 0.55 ? karis([92, 46, 22], [150, 84, 40], (pas - 0.55) * 3) : karis([62, 68, 70], [118, 124, 126], h * 0.5 + 0.4); }, 2.5);
  dokuUret('kapitone', 128, (u, v) => { const s = Math.abs(((v * 6) % 1) - 0.5) * 2; return 1 - s * s + fbm(u * 8, v * 8, 41, 8, 3) * 0.2; },
    (h) => karis([150, 150, 150], [255, 255, 255], h * 0.5 + 0.4), 3);
  dokuUret('saman', 128, (u, v) => { let t = 0; for (let i = 0; i < 3; i++) t += Math.sin(u * 80 + i * 13 + fbm(u * 2, v * 30, i + 50, 2, 2) * 20) * 0.2; return t + fbm(u * 4, v * 40, 55, 4, 3) * 0.5; },
    (h) => karis([110, 82, 34], [214, 176, 92], h * 0.8 + 0.5), 2);
  dokuUret('kumas', 128, (u, v) => fbm(u * 30, v * 30, 61, 30, 2) * 0.5 + Math.sin(u * 200) * 0.1, (h) => karis([170, 170, 170], [255, 255, 255], h), 1.5);
}

// ---------- malzemeler ----------
const M = {};
function malzemeler() {
  dokular();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  M.beton = std({ ...DOKU.beton, color: 0xb0b0b8, roughness: 0.92, metalness: 0 });
  M.tugla = std({ ...DOKU.tugla, color: 0xffffff, roughness: 0.88 });
  M.tahta = std({ ...DOKU.tahta, color: 0xffffff, roughness: 0.8 });
  M.kar = std({ ...DOKU.kar, color: 0xffffff, roughness: 0.65, normalScale: new THREE.Vector2(0.6, 0.6) });
  M.toprak = std({ ...DOKU.toprak, color: 0xffffff, roughness: 0.95 });
  M.metal = std({ ...DOKU.metal, color: 0xffffff, roughness: 0.55, metalness: 0.6 });
  M.demir = std({ color: 0x2a2c30, roughness: 0.45, metalness: 0.85 });
  M.tel = std({ color: 0x9aa0a8, roughness: 0.3, metalness: 0.95 });
  M.saman = std({ ...DOKU.saman, color: 0xffffff, roughness: 0.95 });
  M.cuval = std({ ...DOKU.kumas, color: 0x8a7a5a, roughness: 0.95 });
  M.koyu = std({ color: 0x15161a, roughness: 0.9 });
  M.pas = std({ ...DOKU.metal, color: 0xc08060, roughness: 0.7, metalness: 0.4 });
  M.cam = std({ color: 0xffd38a, emissive: 0xffb050, emissiveIntensity: 2.2, roughness: 0.3 });
  M.camSoguk = std({ color: 0x223040, roughness: 0.2, metalness: 0.2 });
  M.kirmiziLamba = std({ color: 0x400000, emissive: 0xff2010, emissiveIntensity: 3 });
  M.yesilLamba = std({ color: 0x003000, emissive: 0x30ff60, emissiveIntensity: 3 });
  M.camAgac = std({ color: 0x1b2a26, roughness: 0.95 });
  M.agacKar = std({ color: 0xdfe7f2, roughness: 0.7 });
  M.kabuk = std({ color: 0x2c2018, roughness: 0.95 });
  M.dag = new THREE.MeshBasicMaterial({ color: 0x0c111c, fog: false });
  M.dagKar = new THREE.MeshBasicMaterial({ color: 0x2a3446, fog: false });
}

// ---------- yardımcılar ----------
function kutu(w, h, d, m, x, y, z, par) { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); k.position.set(x || 0, y || 0, z || 0); k.castShadow = k.receiveShadow = true; if (par) par.add(k); return k; }
function silindir(rt, rb, h, m, seg, x, y, z, par) { const k = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), m); k.position.set(x || 0, y || 0, z || 0); k.castShadow = k.receiveShadow = true; if (par) par.add(k); return k; }
function kure(r, m, x, y, z, par, sx, sy, sz) { const k = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); k.position.set(x || 0, y || 0, z || 0); k.scale.set(sx || 1, sy || 1, sz || 1); k.castShadow = k.receiveShadow = true; if (par) par.add(k); return k; }
function uvTekrar(geo, sx, sy) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); return geo; }

// Yumuşak parıltı dokusu
let PARILTI = null;
function parilti() {
  if (PARILTI) return PARILTI;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); PARILTI = new THREE.CanvasTexture(c); return PARILTI;
}
function isilti(renk, boy, opak) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: parilti(), color: renk, transparent: true, opacity: opak == null ? 1 : opak, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(boy, boy, 1); return s;
}

// ---------- gökyüzü ----------
function gokyuzu(sv) {
  const geo = new THREE.SphereGeometry(400, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { t: { value: 0 }, ust: { value: new THREE.Color(sv.ic ? 0x050403 : 0x02040b) }, alt: { value: new THREE.Color(sv.sis) }, aurora: { value: sv.aurora ? 1 : 0 }, kizil: { value: sv.kizil ? 1 : 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float t,aurora,kizil; uniform vec3 ust,alt; varying vec3 vp;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float y = clamp(vp.y, -0.1, 1.0);
        vec3 c = mix(alt, ust, smoothstep(-0.02, 0.55, y));
        vec3 q = vp * 160.0; vec3 id = floor(q); vec3 f = fract(q) - 0.5;
        float s = fract(sin(dot(id, vec3(127.1, 311.7, 74.7))) * 43758.5453);
        float tw = 0.6 + 0.4 * sin(t * 2.0 + s * 50.0);
        c += vec3(0.9, 0.95, 1.0) * step(0.985, s) * smoothstep(0.22, 0.0, length(f)) * tw * smoothstep(0.05, 0.4, y);
        if (aurora > 0.5) {
          float a = atan(vp.x, -vp.z);
          float band = n(vec2(a * 3.0 + t * 0.05, y * 2.0)) * n(vec2(a * 9.0 - t * 0.08, 3.0));
          float m = smoothstep(0.12, 0.3, y) * smoothstep(0.75, 0.35, y) * band;
          vec3 ac = mix(vec3(0.1, 0.9, 0.5), vec3(0.6, 0.2, 0.9), smoothstep(0.3, 0.7, y));
          if (kizil > 0.5) ac = mix(vec3(0.9, 0.2, 0.2), vec3(0.5, 0.1, 0.6), smoothstep(0.3, 0.7, y));
          c += ac * m * 0.55;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- karakterler ----------
function etiketDoku(yazi) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
  g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#1a1a1a'; g.font = 'bold 18px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(yazi, 32, 17);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function insan(tip) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const muh = tip === 'muhafiz';
  const ten = std({ color: 0xd8a382, roughness: 0.7 });
  const ceket = std({ map: DOKU.kapitone.map, normalMap: DOKU.kapitone.normalMap, color: muh ? 0x4d5240 : 0x3c4552, roughness: 0.92 });
  const pantolon = std({ map: DOKU.kumas.map, color: muh ? 0x34362c : 0x2a2c33, roughness: 0.95 });
  const cizme = std({ color: muh ? 0x111111 : 0x5a554e, roughness: muh ? 0.4 : 0.95, metalness: 0 });
  const kurk = std({ color: muh ? 0x5c5a55 : 0x4e3a28, roughness: 1 });
  const atki = std({ map: DOKU.kumas.map, color: 0x8c2a24, roughness: 0.95 });
  const g = new THREE.Group(), p = {};
  const kalca = new THREE.Group(); kalca.position.y = 0.72; g.add(kalca); p.kalca = kalca;
  const govde = new THREE.Group(); kalca.add(govde); p.govde = govde;
  if (muh) {
    // uzun kaput
    silindir(0.2, 0.3, 0.75, ceket, 14, 0, -0.05, 0, govde);
    silindir(0.19, 0.2, 0.5, ceket, 14, 0, 0.5, 0, govde).scale.z = 0.8;
    silindir(0.205, 0.205, 0.07, std({ color: 0x3a2414, roughness: 0.6 }), 14, 0, 0.28, 0, govde);
    kutu(0.05, 0.75, 0.04, std({ color: 0x1a120c }), -0.08, 0.45, -0.2, govde).rotation.z = 0.5; // tüfek kayışı
    const tufek = kutu(0.05, 0.85, 0.06, std({ color: 0x3a2a1a, roughness: 0.6 }), 0.1, 0.5, -0.22, govde); tufek.rotation.z = -0.35;
  } else {
    const k = silindir(0.19, 0.22, 0.62, ceket, 14, 0, 0.32, 0, govde); k.scale.z = 0.78;
    const yama = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), std({ map: etiketDoku('Щ-854'), roughness: 0.9 }));
    yama.position.set(0, 0.42, 0.172); govde.add(yama);
    const yama2 = yama.clone(); yama2.position.z = -0.172; yama2.rotation.y = Math.PI; govde.add(yama2);
    const at = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 8, 16), atki); at.rotation.x = Math.PI / 2; at.position.y = 0.64; at.castShadow = true; govde.add(at);
    kutu(0.08, 0.22, 0.04, atki, 0.07, 0.5, 0.14, govde).rotation.z = 0.15;
  }
  const bas = new THREE.Group(); bas.position.y = 0.78; govde.add(bas); p.bas = bas;
  kure(0.13, ten, 0, 0.02, 0, bas, 1, 1.1, 1);
  kure(0.025, ten, 0, 0.0, 0.13, bas, 1, 1.2, 1); // burun
  const goz = std({ color: 0x111111, roughness: 0.3 });
  kure(0.016, goz, -0.045, 0.04, 0.115, bas); kure(0.016, goz, 0.045, 0.04, 0.115, bas);
  // uşanka
  silindir(0.15, 0.15, 0.14, kurk, 14, 0, 0.13, 0, bas);
  kure(0.14, kurk, 0, 0.19, 0, bas, 1, 0.55, 1);
  kutu(0.04, 0.14, 0.12, kurk, -0.14, 0.02, 0, bas); kutu(0.04, 0.14, 0.12, kurk, 0.14, 0.02, 0, bas);
  kutu(0.27, 0.07, 0.04, kurk, 0, 0.14, 0.13, bas);
  if (muh) kure(0.025, std({ color: 0xb02018, emissive: 0x300000, metalness: 0.5, roughness: 0.4 }), 0, 0.15, 0.155, bas);
  if (!muh) { const sakal = std({ color: 0x3a2c22, roughness: 1 }); kure(0.1, sakal, 0, -0.06, 0.05, bas, 1.1, 0.7, 0.9); }
  // kollar
  const kol = (s) => {
    const omuz = new THREE.Group(); omuz.position.set(s * 0.24, 0.6, 0); govde.add(omuz);
    silindir(0.065, 0.06, 0.3, ceket, 10, 0, -0.15, 0, omuz);
    const dirsek = new THREE.Group(); dirsek.position.y = -0.3; omuz.add(dirsek);
    silindir(0.058, 0.05, 0.28, ceket, 10, 0, -0.14, 0, dirsek);
    kure(0.05, muh ? std({ color: 0x222222, roughness: 0.8 }) : ten, 0, -0.3, 0, dirsek);
    return { omuz, dirsek };
  };
  p.kolL = kol(-1); p.kolR = kol(1);
  const bacak = (s) => {
    const kok = new THREE.Group(); kok.position.set(s * 0.1, 0, 0); kalca.add(kok);
    silindir(0.085, 0.075, 0.36, pantolon, 10, 0, -0.18, 0, kok);
    const diz = new THREE.Group(); diz.position.y = -0.36; kok.add(diz);
    silindir(0.072, 0.07, 0.3, muh ? cizme : pantolon, 10, 0, -0.15, 0, diz);
    kutu(0.13, 0.08, 0.22, cizme, 0, -0.32, 0.04, diz);
    if (!muh) silindir(0.08, 0.08, 0.2, cizme, 10, 0, -0.22, 0, diz);
    return { kok, diz };
  };
  p.bacL = bacak(-1); p.bacR = bacak(1);
  if (muh) {
    const fener = silindir(0.03, 0.04, 0.14, M.demir, 8, 0, -0.32, 0.05, p.kolR.dirsek); fener.rotation.x = Math.PI / 2;
    const lens = isilti(0xfff0c0, 0.35, 0.9); lens.position.set(0, -0.32, 0.14); p.kolR.dirsek.add(lens); p.lens = lens;
  }
  g.userData.p = p;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// Prosedürel animasyon. d: {hiz(0..1), egik, havada, vy, it, t, eller(eller havada), yon}
function animInsan(g, d) {
  const p = g.userData.p, t = d.t, s = d.hiz;
  const ad = Math.sin(t), ad2 = Math.cos(t);
  let kal = 0.72, egim = 0.05 + s * 0.12;
  p.bacL.kok.rotation.x = ad * 0.75 * s; p.bacR.kok.rotation.x = -ad * 0.75 * s;
  p.bacL.diz.rotation.x = Math.max(0, -ad2) * 0.9 * s + 0.05; p.bacR.diz.rotation.x = Math.max(0, ad2) * 0.9 * s + 0.05;
  p.kolL.omuz.rotation.x = -ad * 0.6 * s; p.kolR.omuz.rotation.x = ad * 0.6 * s;
  p.kolL.dirsek.rotation.x = -0.3 - s * 0.4; p.kolR.dirsek.rotation.x = -0.3 - s * 0.4;
  p.kolL.omuz.rotation.z = 0.08; p.kolR.omuz.rotation.z = -0.08;
  kal += Math.abs(ad) * 0.04 * s + Math.sin(d.zaman * 2) * 0.006 * (1 - s);
  if (d.egik) {
    kal = 0.42; egim = 0.55;
    p.bacL.kok.rotation.x = -1.1 + ad * 0.35 * s; p.bacR.kok.rotation.x = -1.1 - ad * 0.35 * s;
    p.bacL.diz.rotation.x = 1.9; p.bacR.diz.rotation.x = 1.9;
    p.kolL.omuz.rotation.x = -0.6 - ad * 0.3 * s; p.kolR.omuz.rotation.x = -0.6 + ad * 0.3 * s;
  }
  if (d.havada) {
    const k = Math.max(-1, Math.min(1, d.vy / 10));
    p.bacL.kok.rotation.x = -0.7; p.bacL.diz.rotation.x = 1.2; p.bacR.kok.rotation.x = 0.3 - k * 0.3; p.bacR.diz.rotation.x = 0.4;
    p.kolL.omuz.rotation.x = -2.4 * Math.max(0, k) - 0.4; p.kolR.omuz.rotation.x = 0.6; p.kolL.omuz.rotation.z = 0.4; p.kolR.omuz.rotation.z = -0.5;
  }
  if (d.it) { egim = 0.4; p.kolL.omuz.rotation.x = -1.4; p.kolR.omuz.rotation.x = -1.4; p.kolL.dirsek.rotation.x = -0.4; p.kolR.dirsek.rotation.x = -0.4; }
  if (d.eller) { p.kolL.omuz.rotation.x = -2.9; p.kolR.omuz.rotation.x = -2.9; p.kolL.omuz.rotation.z = 0.3; p.kolR.omuz.rotation.z = -0.3; p.kolL.dirsek.rotation.x = -0.2; p.kolR.dirsek.rotation.x = -0.2; egim = -0.05; }
  if (d.fener) { p.kolR.omuz.rotation.x = -1.25; p.kolR.dirsek.rotation.x = -0.1; }
  if (d.bak != null) p.bas.rotation.y = d.bak;
  p.kalca.position.y = kal; p.govde.rotation.x = egim;
}

function kopekModel() {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const ten = std({ color: 0x8a6034, roughness: 0.95 }), siyah = std({ color: 0x1e1a16, roughness: 0.9 });
  const g = new THREE.Group(), p = {};
  const govde = new THREE.Group(); govde.position.y = 0.5; g.add(govde); p.govde = govde;
  kure(0.22, ten, 0, 0, 0, govde, 1, 0.85, 2.0);
  kure(0.2, siyah, 0, 0.08, -0.02, govde, 1.02, 0.6, 1.7); // eyer
  const bas = new THREE.Group(); bas.position.set(0, 0.18, 0.42); govde.add(bas); p.bas = bas;
  kure(0.14, ten, 0, 0, 0, bas, 1, 0.95, 1.1);
  kure(0.08, siyah, 0, -0.04, 0.16, bas, 0.9, 0.75, 1.5);
  kure(0.025, siyah, 0, -0.02, 0.27, bas);
  const kulak = new THREE.ConeGeometry(0.05, 0.14, 4);
  [-1, 1].forEach(s => { const k = new THREE.Mesh(kulak, siyah); k.position.set(s * 0.07, 0.15, -0.02); k.rotation.z = -s * 0.2; k.castShadow = true; bas.add(k); });
  const goz = std({ color: 0x110800, emissive: 0x331100, roughness: 0.2 });
  kure(0.018, goz, -0.06, 0.04, 0.11, bas); kure(0.018, goz, 0.06, 0.04, 0.11, bas);
  p.ayak = [];
  [[-0.12, 0.3], [0.12, 0.3], [-0.12, -0.3], [0.12, -0.3]].forEach(([x, z]) => {
    const a = new THREE.Group(); a.position.set(x, -0.06, z); govde.add(a);
    silindir(0.045, 0.035, 0.42, ten, 8, 0, -0.21, 0, a);
    p.ayak.push(a);
  });
  const kuyruk = new THREE.Group(); kuyruk.position.set(0, 0.06, -0.42); govde.add(kuyruk); p.kuyruk = kuyruk;
  const ky = silindir(0.04, 0.02, 0.36, siyah, 8, 0, 0.16, -0.06, kuyruk); ky.rotation.x = -0.5;
  g.userData.p = p;
  return g;
}
function animKopek(g, d) {
  const p = g.userData.p, t = d.t, s = d.hiz;
  p.ayak.forEach((a, i) => { a.rotation.x = Math.sin(t + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI * 0.5 : 0)) * 0.8 * s; });
  p.govde.position.y = 0.5 + Math.abs(Math.sin(t)) * 0.05 * s;
  p.kuyruk.rotation.y = Math.sin(d.zaman * (d.ye ? 14 : 5)) * (d.ye ? 0.7 : 0.3);
  p.bas.rotation.x = d.ye ? 0.7 + Math.sin(d.zaman * 12) * 0.12 : (d.kokla ? 0.3 + Math.sin(d.zaman * 9) * 0.1 : 0);
  p.govde.rotation.x = d.ye ? 0.15 : 0;
}

// ---------- eşya modelleri ----------
function esyaModel(tur) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const g = new THREE.Group();
  const altin = std({ color: 0xd8b060, metalness: 1, roughness: 0.3 });
  if (tur === 'k') { // çaydanlık + anahtar
    const ct = std({ color: 0x3a6a8a, metalness: 0.3, roughness: 0.4 });
    kure(0.16, ct, 0, 0, 0, g, 1, 0.8, 1); silindir(0.08, 0.1, 0.06, ct, 12, 0, 0.13, 0, g);
    const em = silindir(0.02, 0.035, 0.18, ct, 8, 0.17, 0.03, 0, g); em.rotation.z = -1;
    const an = new THREE.Group(); an.position.set(0, 0.32, 0); g.add(an);
    const hal = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 8, 16), altin); an.add(hal);
    kutu(0.03, 0.18, 0.02, altin, 0, -0.14, 0, an); kutu(0.05, 0.025, 0.02, altin, 0.025, -0.2, 0, an);
  } else if (tur === 'c') { // tel makası
    const sap = std({ color: 0xb02820, roughness: 0.5 });
    [-1, 1].forEach(s => { const a = kutu(0.04, 0.3, 0.03, sap, s * 0.05, -0.08, 0, g); a.rotation.z = s * 0.25; const b = kutu(0.03, 0.16, 0.02, M.demir, s * 0.015, 0.14, 0, g); b.rotation.z = -s * 0.12; });
  } else if (tur === 's') { // sosis
    const s = std({ color: 0x9a3a22, roughness: 0.45 });
    const geo = new THREE.CapsuleGeometry(0.05, 0.22, 6, 10); const m = new THREE.Mesh(geo, s); m.rotation.z = Math.PI / 2; m.castShadow = true; g.add(m);
  } else if (tur === 'f') { // sigorta
    silindir(0.05, 0.05, 0.2, std({ color: 0xc8e0ff, transparent: true, opacity: 0.6, roughness: 0.1 }), 12, 0, 0, 0, g);
    silindir(0.055, 0.055, 0.05, altin, 12, 0, 0.11, 0, g); silindir(0.055, 0.055, 0.05, altin, 12, 0, -0.11, 0, g);
    silindir(0.008, 0.008, 0.18, std({ color: 0xff8030, emissive: 0xff5010, emissiveIntensity: 2 }), 6, 0, 0, 0, g);
  } else if (tur === 'o') { // lastik ördek
    const sari = std({ color: 0xffd21a, roughness: 0.35 });
    kure(0.13, sari, 0, 0, 0, g, 1.2, 0.85, 1); kure(0.08, sari, 0.08, 0.13, 0, g);
    kure(0.04, std({ color: 0xff7a10, roughness: 0.4 }), 0.16, 0.12, 0, g, 1.2, 0.5, 1);
    kure(0.013, std({ color: 0x111111 }), 0.12, 0.16, 0.05, g); kure(0.013, std({ color: 0x111111 }), 0.12, 0.16, -0.05, g);
  } else if (tur === 'n') { // not kağıdı
    const k = kutu(0.24, 0.3, 0.01, std({ color: 0xe8dcc0, roughness: 0.9 }), 0, 0, 0, g); k.rotation.z = 0.1;
    kutu(0.05, 0.05, 0.02, std({ color: 0x902018 }), 0.05, 0.12, 0.01, g);
  } else { // ıvır zıvır: çorap/kutu
    const c = std({ map: DOKU.kumas.map, color: 0x9a8a70, roughness: 1 });
    kutu(0.08, 0.22, 0.08, c, 0, 0.04, 0, g); kutu(0.18, 0.08, 0.08, c, 0.05, -0.08, 0, g);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- kar yağışı ----------
function karYagisi(adet, ic) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(adet * 3), hiz = new Float32Array(adet);
  for (let i = 0; i < adet; i++) { pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = Math.random() * 20; pos[i * 3 + 2] = (Math.random() - 0.7) * 30; hiz[i] = 0.6 + Math.random() * 1.2; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: ic ? 0.05 : 0.12, map: parilti(), color: ic ? 0xffd8a0 : 0xffffff, transparent: true, opacity: ic ? 0.4 : 0.85, depthWrite: false, sizeAttenuation: true });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false;
  p.userData.guncelle = (dt, cx, cy, zaman) => {
    for (let i = 0; i < adet; i++) {
      let x = pos[i * 3], y = pos[i * 3 + 1];
      y -= hiz[i] * dt * (ic ? 0.08 : 1); x += (Math.sin(zaman * 0.7 + i) * 0.4 + (ic ? 0 : 0.8)) * dt;
      if (y < cy - 6) y += 20; if (y > cy + 14) y -= 20;
      if (x < cx - 25) x += 50; if (x > cx + 25) x -= 50;
      pos[i * 3] = x; pos[i * 3 + 1] = y;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return p;
}

// ---------- projektör ışın konisi ----------
function isinMalzeme(renk, guc) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { renk: { value: new THREE.Color(renk) }, guc: { value: guc }, t: { value: 0 } },
    vertexShader: 'varying float vy; varying vec3 vn, vv; void main(){ vy = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vn = normalize(normalMatrix * normal); vv = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform vec3 renk; uniform float guc, t; varying float vy; varying vec3 vn, vv;
      void main(){ float kenar = pow(abs(dot(vn, vv)), 1.6); float boy = (0.18 + 0.82 * vy * vy) * (0.85 + 0.15 * sin(vy * 30.0 - t * 2.0)); gl_FragColor = vec4(renk * kenar * boy * guc, 1.0); }`,
  });
}
function isinKonisi(rUst, rAlt, renk, guc) {
  const geo = new THREE.CylinderGeometry(rUst, rAlt, 1, 24, 1, true); geo.translate(0, -0.5, 0); geo.rotateX(-Math.PI / 2); // +z yönünde uzanır
  const m = new THREE.Mesh(geo, isinMalzeme(renk, guc)); m.renderOrder = 5; return m;
}
