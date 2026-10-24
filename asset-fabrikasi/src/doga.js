/** Doğa: çam, meşe, çınar, selvi, erguvan, çalı, kaya, çiçek tarhı, mantar. Hepsi tohumla çeşitlenir. */
import { T, ton, rng } from './kit.js';

const gov = (k, renk = '#6b4a2f') => k.mat(renk, { roughness: 0.95, map: k.paint(64, 128, (c, w, h) => { c.fillStyle = renk; c.fillRect(0, 0, w, h); c.strokeStyle = ton(renk, -0.1); c.lineWidth = 2; for (let x = 3; x < w; x += 7) { c.beginPath(); c.moveTo(x, 0); for (let y = 0; y < h; y += 16) c.lineTo(x + Math.sin(y + x) * 2, y); c.stroke(); } }) });
/** yaprak öbeği: hafif bozuk küre (low-poly ama yumuşak) */
function obek(k, r, renk, R, det = 1) {
  const geo = new T.IcosahedronGeometry(r, det); const p = geo.attributes.position;
  const sd = R.next() * 100; const hs = v => { const x = Math.sin(v.x * 12.9898 / r + v.y * 78.233 / r + v.z * 37.719 / r + sd) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < p.count; i++) { const v = new T.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + (hs(v) - 0.5) * 0.24); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  const m = new T.Mesh(geo, k.mat(renk, { roughness: 0.85, flatShading: true })); m.castShadow = m.receiveShadow = true; return m;
}

export function cam(k, o = {}, R = rng(o.tohum || 2)) {
  const g = k.grup('cam-agaci'); const h = R.range(4.5, 6.5);
  k.at(k.cyl(0.14, 0.22, h * 0.45, gov(k, '#5a3e2a'), 10), 0, h * 0.22, 0, g);
  const renk = R.pick(['#2f6b3f', '#3a7a46', '#2a5e3a']);
  for (let i = 0; i < 4; i++) { const r = 1.6 - i * 0.33, y = h * 0.35 + i * h * 0.17; const c = k.at(k.cone(r, h * 0.3, k.mat(ton(renk, i * 0.025), { roughness: 0.85, flatShading: true }), 9), 0, y, 0, g); c.rotation.y = R.next() * 3; }
  g.userData.carpisma = { w: 0.5, h, d: 0.5 }; return g;
}

export function mese(k, o = {}, R = rng(o.tohum || 4)) {
  const g = k.grup('mese'); const h = R.range(2.6, 3.4);
  const gm = gov(k);
  k.at(k.cyl(0.18, 0.28, h, gm, 10), 0, h / 2, 0, g);
  for (const s of [-1, 1]) { const d = k.at(k.cyl(0.07, 0.11, 1.4, gm, 8), s * 0.4, h * 0.85, 0, g); d.rotation.z = s * -0.7; }
  const renk = R.pick(['#5f9a3e', '#6fa846', '#4f8a3a']);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const r = i === 0 ? 0 : R.range(0.8, 1.2); k.at(obek(k, R.range(0.9, 1.3), ton(renk, R.range(-0.05, 0.05)), R), Math.cos(a) * r, h + 0.6 + R.range(-0.2, 0.5), Math.sin(a) * r, g); }
  g.userData.carpisma = { w: 0.6, h: h + 2, d: 0.6 }; return g;
}

/** Ulu çınar: kalın gövde, alacalı kabuk, geniş tepe */
export function cinar(k, o = {}, R = rng(o.tohum || 9)) {
  const g = k.grup('cinar'); const h = 4.2;
  const kab = k.mat('#ffffff', { roughness: 0.9, map: k.paint(128, 256, (c, w, h2) => { c.fillStyle = '#b9b29a'; c.fillRect(0, 0, w, h2); const r2 = rng(12); for (let i = 0; i < 60; i++) { c.fillStyle = r2.pick(['#8a8470', '#d8d2bc', '#9fa37c', '#6f6a58']); c.beginPath(); c.ellipse(r2.next() * w, r2.next() * h2, r2.range(6, 18), r2.range(8, 26), 0, 0, 7); c.fill(); } }) });
  k.at(k.cyl(0.4, 0.65, h, kab, 12), 0, h / 2, 0, g);
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; const d = k.at(k.cyl(0.12, 0.22, 2.4, kab, 8), Math.cos(a) * 0.8, h + 0.6, Math.sin(a) * 0.8, g); d.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); }
  for (let i = 0; i < 4; i++) { const a = i * 1.57; k.at(k.cyl(0.08, 0.25, 0.9, kab, 8), Math.cos(a) * 0.55, 0.2, Math.sin(a) * 0.55, g).rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1); }
  for (let i = 0; i < 11; i++) { const a = i * 2.39, r = i === 0 ? 0 : R.range(1.2, 2.4); k.at(obek(k, R.range(1.2, 1.7), ton('#5d9440', R.range(-0.06, 0.05)), R), Math.cos(a) * r, h + 1.6 + R.range(-0.4, 0.9), Math.sin(a) * r, g); }
  g.userData.carpisma = { w: 1.3, h: h + 4, d: 1.3 }; return g;
}

/** Selvi: İstanbul siluetinin ince uzun ağacı */
export function selvi(k, o = {}, R = rng(o.tohum || 6)) {
  const g = k.grup('selvi'); const h = R.range(6, 8);
  k.at(k.cyl(0.1, 0.14, 0.8, gov(k), 8), 0, 0.4, 0, g);
  const m = k.mat('#2e5a36', { roughness: 0.9, flatShading: true });
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push([Math.sin(Math.pow(t, 0.7) * Math.PI) * 0.75 * (1 - t * 0.35) + 0.001, t * h]); }
  const s = k.at(k.lathe(prof, m, 10), 0, 0.5, 0, g); void s;
  g.userData.carpisma = { w: 0.4, h: h + 0.5, d: 0.4 }; return g;
}

/** Erguvan: bahar pembesi */
export function erguvan(k, o = {}, R = rng(o.tohum || 8)) {
  const g = k.grup('erguvan'); const gm = gov(k, '#4a3426');
  k.at(k.cyl(0.1, 0.16, 1.8, gm, 8), 0, 0.9, 0, g);
  for (let i = 0; i < 3; i++) { const a = i * 2.1; const d = k.at(k.cyl(0.04, 0.07, 1.2, gm, 6), Math.cos(a) * 0.3, 2.1, Math.sin(a) * 0.3, g); d.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); }
  for (let i = 0; i < 9; i++) { const a = i * 2.39, r = R.range(0.3, 1.1); k.at(obek(k, R.range(0.5, 0.75), ton('#d65a9a', R.range(-0.06, 0.08)), R), Math.cos(a) * r, 2.6 + R.range(-0.2, 0.6), Math.sin(a) * r, g); }
  return g;
}

export function cali(k, o = {}, R = rng(o.tohum || 5)) {
  const g = k.grup('cali'); const renk = R.pick(['#4f8a3a', '#5f9a3e', '#3f7a36']);
  for (let i = 0; i < 5; i++) k.at(obek(k, R.range(0.3, 0.5), ton(renk, R.range(-0.05, 0.05)), R), R.range(-0.4, 0.4), 0.3 + R.range(0, 0.15), R.range(-0.3, 0.3), g);
  if (R.chance(0.6)) { const cm = k.mat(R.pick(['#ffffff', '#ffd23f', '#e0533c']), { roughness: 0.6 }); for (let i = 0; i < 8; i++) k.at(k.sph(0.04, cm, 6, 5), R.range(-0.5, 0.5), R.range(0.45, 0.7), R.range(-0.35, 0.35), g); }
  return g;
}

export function kaya(k, o = {}, R = rng(o.tohum || 1)) {
  const g = k.grup('kaya');
  for (let i = 0; i < R.int(1, 3); i++) { const m = obek(k, R.range(0.3, 0.7), ton('#9a958c', R.range(-0.06, 0.06)), R, 0); m.scale.set(R.range(1, 1.5), R.range(0.5, 0.8), R.range(0.8, 1.2)); m.position.set(i * 0.6 - 0.4, 0.15, R.range(-0.2, 0.2)); m.rotation.y = R.next() * 3; g.add(m); }
  return g;
}

export function cicekTarhi(k, o = {}, R = rng(o.tohum || 3)) {
  const g = k.grup('cicek-tarhi');
  k.at(k.rbox(2.0, 0.3, 1.0, 0.05, k.mat('#cfc8be', { roughness: 0.9 })), 0, 0.15, 0, g);
  k.at(k.box(1.85, 0.05, 0.85, k.mat('#4a3426', { roughness: 1 })), 0, 0.29, 0, g);
  const sap = k.mat('#4f8a3a');
  for (let i = 0; i < 26; i++) { const x = R.range(-0.85, 0.85), z = R.range(-0.38, 0.38), h = R.range(0.2, 0.35);
    k.at(k.cyl(0.008, 0.008, h, sap, 5), x, 0.3 + h / 2, z, g);
    const lale = k.at(k.kup(0.045, k.mat(R.pick(['#e0533c', '#f2a2b3', '#ffd23f', '#8a6bbf', '#ffffff']), { roughness: 0.5, side: T.DoubleSide }), 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65, 8, 6), x, 0.3 + h + 0.03, z, g); lale.scale.y = 1.4; }
  return g;
}

export function mantar(k, o = {}) {
  const tur = o.tur || 'kirmizi';
  const g = k.grup('mantar-' + tur);
  const sap = k.mat('#f4efe4', { roughness: 0.8 });
  const sapka = { kirmizi: '#d8332a', kahve: '#8a5a34', sari: '#e8b33a' }[tur];
  k.at(k.lathe([[0.001, 0], [0.05, 0], [0.04, 0.08], [0.035, 0.16], [0.001, 0.16]], sap, 14), 0, 0, 0, g);
  const s = k.at(k.kup(0.12, k.mat(sapka, { roughness: 0.4 }), 0, Math.PI * 2, 0, Math.PI / 2, 20, 8), 0, 0.14, 0, g); s.scale.y = 0.75;
  k.at(k.cyl(0.118, 0.04, 0.02, k.mat('#efe0c8'), 20), 0, 0.14, 0, g);
  if (tur === 'kirmizi') { const b = k.mat('#ffffff'); for (let i = 0; i < 7; i++) { const a = i * 2.4, r = 0.03 + (i % 3) * 0.025; const th = Math.asin(Math.min(1, r / 0.12)); k.at(k.sph(0.013, b, 8, 6), Math.cos(a) * r, 0.14 + Math.cos(th) * 0.12 * 0.75, Math.sin(a) * r, g).scale.y = 0.4; } }
  return g;
}
