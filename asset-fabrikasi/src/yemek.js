/** Yiyecek ve içecekler, gerçek boyutta (metre). Oyunda ikon için büyütülebilir. */
import { T, rrect, yazi, gren, ton, rng } from './kit.js';
import { simitMat } from './karakter.js';

const ekmekMat = (k, renk = '#d9a066') => k.dmat(128, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, ton(renk, 0.06)); gr.addColorStop(1, ton(renk, -0.1)); c.fillStyle = gr; c.fillRect(0, 0, w, h); gren(c, w, h, ton(renk, -0.2), 300, 1.4, 17); }, { roughness: 0.8 });
const tabak = (k, p, r = 0.13, renk = '#ffffff') => k.at(k.lathe([[0, 0], [r * 0.7, 0], [r, 0.012], [r * 1.02, 0.02], [r * 0.98, 0.022], [r * 0.7, 0.008], [0, 0.008]], k.mat(renk, { roughness: 0.25 }), 32), 0, 0, 0, p);

export function simit(k) {
  const g = k.grup('simit'); const s = k.at(k.torus(0.055, 0.022, simitMat(k), 14, 28), 0, 0.022, 0, g); s.rotation.x = Math.PI / 2; s.scale.z = 0.8; return g;
}

/** Döner ustası ocağı: dikey şiş + et konisi + ızgara. Et konisi userData.parca.et (döndür). */
export function donerOcagi(k, o = {}) {
  const tavuk = o.tur === 'tavuk';
  const g = k.grup('doner-ocagi'); const metal = k.mat('#cdd5dc', { metalness: 0.7, roughness: 0.3 });
  k.at(k.rbox(0.7, 0.08, 0.6, 0.02, metal), 0, 0.04, 0, g);
  k.at(k.rbox(0.5, 1.1, 0.12, 0.03, metal), 0, 0.65, -0.3, g);
  const isi = k.isik('#ff6a2a', 1.4); for (let i = 0; i < 4; i++) k.at(k.box(0.4, 0.04, 0.02, isi), 0, 0.35 + i * 0.22, -0.235, g);
  k.at(k.cyl(0.012, 0.012, 1.35, metal, 8), 0, 0.72, 0, g);
  const et = k.grup('et', g); et.userData.hareket = true;
  const etM = k.dmat(256, 128, (c, w, h) => { c.fillStyle = tavuk ? '#d9a066' : '#9c5428'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 6) { c.fillStyle = tavuk ? 'rgba(255,230,180,.35)' : 'rgba(60,20,5,.35)'; c.fillRect(0, y, w, 2); } gren(c, w, h, tavuk ? '#a8622a' : '#4a1e08', 600, 2.2, 3); gren(c, w, h, tavuk ? '#f2cf8a' : '#c47a3c', 300, 1.6, 4); }, { roughness: 0.6 });
  k.at(k.lathe([[0.001, 0], [0.11, 0], [0.16, 0.25], [0.19, 0.55], [0.17, 0.8], [0.09, 0.9], [0.001, 0.9]], etM, 24), 0, 0.15, 0, et);
  k.at(k.cyl(0.08, 0.08, 0.02, metal, 16), 0, 0.14, 0, g);
  k.at(k.cyl(0.04, 0.04, 0.05, metal, 8), 0, 1.07, 0, g);
  g.userData.parca = { et };
  return g;
}

export function durum(k) {
  const g = k.grup('durum'); const lav = k.dmat(128, 128, (c, w, h) => { c.fillStyle = '#f1dcae'; c.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(140,80,30,.35)'; c.beginPath(); c.arc((i * 47) % w, (i * 71) % h, 3 + (i % 3) * 2, 0, 7); c.fill(); } }, { roughness: 0.85 });
  const r = k.at(k.cyl(0.03, 0.028, 0.2, lav, 18), 0, 0.03, 0, g); r.rotation.z = Math.PI / 2;
  const kag = k.at(k.cyl(0.032, 0.032, 0.09, k.dmat(64, 64, (c, w, h) => { c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8433a'; c.fillRect(0, 20, w, 8); }), 18), -0.065, 0.03, 0, g); kag.rotation.z = Math.PI / 2;
  const ic = k.at(k.cyl(0.025, 0.025, 0.01, k.mat('#9c5428'), 14), 0.1, 0.032, 0, g); ic.rotation.z = Math.PI / 2;
  k.at(k.sph(0.008, k.mat('#e0533c')), 0.105, 0.04, 0.008, g); k.at(k.sph(0.008, k.mat('#6f9e4f')), 0.105, 0.025, -0.01, g);
  return g;
}

export function lahmacun(k) {
  const g = k.grup('lahmacun'); tabak(k, g, 0.17);
  const m = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#e8c48a'; c.fillRect(0, 0, w, h); c.fillStyle = '#b8452a'; c.beginPath(); c.arc(w / 2, h / 2, 112, 0, 7); c.fill(); gren(c, w, h, '#6b2412', 700, 3, 8); gren(c, w, h, '#e0533c', 300, 2.5, 9); c.strokeStyle = '#9a5a2a'; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h / 2, 118, 0, 7); c.stroke(); }, { roughness: 0.7 });
  k.at(k.cyl(0.15, 0.15, 0.006, m, 32), 0, 0.012, 0, g);
  const yes = k.mat('#4f8a3a'); for (let i = 0; i < 8; i++) { const a = i * 2.1; k.at(k.sph(0.012, yes, 6, 5), Math.cos(a) * 0.06, 0.018, Math.sin(a) * 0.06, g).scale.set(1.4, 0.4, 0.8); }
  const lim = k.at(k.kup(0.03, k.mat('#f2d64b', { roughness: 0.4 }), 0, Math.PI, 0, Math.PI), 0.1, 0.02, 0.06, g); lim.rotation.x = -Math.PI / 2;
  return g;
}

export function balikEkmek(k) {
  const g = k.grup('balik-ekmek'); const ek = ekmekMat(k);
  const alt = k.at(k.kapsul(0.04, 0.18, ek), 0, 0.03, 0, g); alt.rotation.z = Math.PI / 2; alt.scale.set(1, 0.6, 1);
  const ust = k.at(k.kapsul(0.04, 0.18, ek), 0, 0.075, -0.005, g); ust.rotation.z = Math.PI / 2; ust.scale.set(1, 0.55, 1);
  const bal = k.at(k.kapsul(0.025, 0.2, k.mat('#c8a070', { roughness: 0.5 })), 0, 0.052, 0.015, g); bal.rotation.z = Math.PI / 2; bal.scale.set(1, 0.5, 1);
  k.at(k.box(0.22, 0.004, 0.07, k.mat('#8bc34a', { roughness: 0.8 })), 0, 0.048, 0.02, g);
  for (let i = 0; i < 3; i++) k.at(k.cyl(0.018, 0.018, 0.004, k.mat('#e0533c'), 12), -0.06 + i * 0.06, 0.06, 0.03, g);
  const kuy = k.at(k.cone(0.03, 0.05, k.mat('#c8a070'), 6), 0.14, 0.052, 0.015, g); kuy.rotation.z = -Math.PI / 2; kuy.scale.set(1, 1, 0.3);
  return g;
}

export function sosisli(k) {
  const g = k.grup('sosisli'); const ek = ekmekMat(k, '#e3b06e');
  for (const s of [-1, 1]) { const e = k.at(k.kapsul(0.03, 0.14, ek), 0, 0.03, s * 0.022, g); e.rotation.z = Math.PI / 2; }
  const so = k.at(k.kapsul(0.018, 0.17, k.mat('#b5532e', { roughness: 0.35 })), 0, 0.05, 0, g); so.rotation.z = Math.PI / 2;
  k.at(k.tube(Array.from({ length: 9 }, (_, i) => [-0.09 + i * 0.0225, 0.068, Math.sin(i * 1.6) * 0.008]), 0.004, k.mat('#f2c230', { roughness: 0.3 }), 32), 0, 0, 0, g);
  k.at(k.tube(Array.from({ length: 9 }, (_, i) => [-0.085 + i * 0.021, 0.07, Math.cos(i * 1.6) * 0.008]), 0.004, k.mat('#d8332a', { roughness: 0.3 }), 32), 0, 0, 0, g);
  return g;
}

export function midye(k) {
  const g = k.grup('midye-tabagi'); tabak(k, g, 0.12);
  const kab = k.mat('#1f2430', { roughness: 0.3, metalness: 0.2 }), pil = k.mat('#e8a24a', { roughness: 0.6, map: k.paint(32, 32, (c, w, h) => { c.fillStyle = '#e8a24a'; c.fillRect(0, 0, w, h); gren(c, w, h, '#6b3a1e', 60, 1.5, 2); }) });
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = k.grup('midye', g); p.position.set(Math.cos(a) * 0.06, 0.02, Math.sin(a) * 0.06); p.rotation.y = -a;
    const s = k.at(k.sph(0.03, kab, 12, 8), 0, 0, 0, p); s.scale.set(1.6, 0.45, 0.9); const d = k.at(k.sph(0.026, pil, 12, 8), 0, 0.01, 0, p); d.scale.set(1.5, 0.35, 0.8); }
  const lim = k.at(k.kup(0.025, k.mat('#f2d64b'), 0, Math.PI, 0, Math.PI), 0, 0.02, 0, g); lim.rotation.x = -Math.PI / 2;
  return g;
}

export function kunefe(k) {
  const g = k.grup('kunefe'); const bakir = k.mat('#c8743a', { metalness: 0.8, roughness: 0.25 });
  k.at(k.lathe([[0, 0], [0.08, 0], [0.085, 0.02], [0.09, 0.022], [0.088, 0.024], [0.08, 0.005], [0, 0.005]], bakir), 0, 0, 0, g);
  const kd = k.dmat(128, 128, (c, w, h) => { c.fillStyle = '#e8902e'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c86a1e'; c.lineWidth = 2; for (let i = 0; i < 80; i++) { c.beginPath(); const x = (i * 37) % w, y = (i * 53) % h; c.moveTo(x, y); c.quadraticCurveTo(x + 10, y + 6, x + 18, y - 2); c.stroke(); } }, { roughness: 0.55 });
  k.at(k.cyl(0.075, 0.075, 0.02, kd, 28), 0, 0.017, 0, g);
  const fs = k.mat('#8bc34a', { roughness: 0.7 }); for (let i = 0; i < 25; i++) { const a = i * 2.4, r = Math.sqrt(i / 25) * 0.035; k.at(k.sph(0.004, fs, 5, 4), Math.cos(a) * r, 0.028, Math.sin(a) * r, g); }
  return g;
}

export function baklava(k) {
  const g = k.grup('baklava-tepsisi'); const bakir = k.mat('#c8743a', { metalness: 0.8, roughness: 0.25 });
  k.at(k.lathe([[0, 0], [0.16, 0], [0.17, 0.035], [0.175, 0.037], [0.165, 0.008], [0, 0.008]], bakir, 40), 0, 0, 0, g);
  const m = k.dmat(64, 64, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f2c46a'); gr.addColorStop(1, '#c4822e'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.25)'; for (let y = 4; y < h; y += 8) c.fillRect(0, y, w, 1); }, { roughness: 0.3 });
  const fs = k.mat('#7cb342');
  for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const x = (i + (j % 2 ? 0.5 : 0)) * 0.038, z = j * 0.033; if (x * x + z * z > 0.0165) continue;
    const b = k.at(k.cyl(0.024, 0.024, 0.022, m, 4), x, 0.02, z, g); b.scale.set(0.9, 1, 1.2); k.at(k.sph(0.006, fs, 6, 4), x, 0.032, z, g).scale.y = 0.5; }
  return g;
}

export function pide(k) {
  const g = k.grup('pide'); const ek = ekmekMat(k, '#e0a860');
  const sekil = []; for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI * 2; sekil.push([Math.cos(t) * 0.17, Math.sin(t) * 0.05 * (1 - Math.pow(Math.abs(Math.cos(t)), 6) * 0.7)]); }
  const e = k.extrude(sekil, 0.02, ek, 0.012); e.rotation.x = -Math.PI / 2; e.position.y = 0.02; g.add(e);
  const ic = k.dmat(128, 64, (c, w, h) => { c.fillStyle = '#f4d27a'; c.fillRect(0, 0, w, h); gren(c, w, h, '#9c5428', 260, 2.4, 5); gren(c, w, h, '#4f8a3a', 40, 1.5, 6); });
  const i2 = k.extrude(sekil.map(([x, y]) => [x * 0.8, y * 0.55]), 0.01, ic, 0.002); i2.rotation.x = -Math.PI / 2; i2.position.y = 0.036; g.add(i2);
  k.at(k.sph(0.018, k.mat('#f2c230', { roughness: 0.2 })), 0, 0.045, 0, g).scale.y = 0.5;
  return g;
}

export function ayran(k) {
  const g = k.grup('ayran'); const bardak = k.mat('#f4f4f2', { roughness: 0.4 });
  k.at(k.lathe([[0, 0], [0.032, 0], [0.04, 0.11], [0.041, 0.112], [0, 0.112]], k.dmat(128, 64, (c, w, h) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2f6db5'; c.fillRect(0, h * 0.35, w, h * 0.3); yazi(c, 'AYRANBEY', w / 4, h / 2 + 1, { font: '900 14px system-ui' }); yazi(c, 'AYRANBEY', w * 3 / 4, h / 2 + 1, { font: '900 14px system-ui' }); }, { roughness: 0.4 })), 0, 0, 0, g);
  const kop = k.at(k.sph(0.04, k.mat('#fbfbf7', { roughness: 0.95 }), 16, 8), 0, 0.112, 0, g); kop.scale.y = 0.3; void bardak;
  return g;
}

export function turkKahvesi(k) {
  const g = k.grup('turk-kahvesi'); const por = k.mat('#ffffff', { roughness: 0.2, map: k.paint(128, 32, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8a24a'; c.fillRect(0, 4, w, 3); c.fillRect(0, h - 7, w, 3); c.fillStyle = '#2f6db5'; for (let x = 8; x < w; x += 16) { c.beginPath(); c.arc(x, h / 2, 4, 0, 7); c.fill(); } }) });
  k.at(k.lathe([[0, 0], [0.05, 0], [0.058, 0.008], [0.056, 0.012], [0, 0.006]], por), 0, 0, 0, g);
  k.at(k.lathe([[0, 0], [0.018, 0], [0.024, 0.01], [0.027, 0.055], [0.028, 0.058]], por), 0, 0.01, 0, g);
  k.at(k.cyl(0.026, 0.026, 0.002, k.mat('#5a3420', { roughness: 0.95 }), 18), 0, 0.062, 0, g);
  k.at(k.torus(0.012, 0.003, por, 6, 12), 0.03, 0.045, 0, g);
  const lok = k.at(k.box(0.018, 0.018, 0.018, k.mat('#f7d6e0', { roughness: 0.9 })), 0.04, 0.02, 0.025, g); lok.rotation.y = 0.4;
  return g;
}

/** Cam şişe: boğaz gazozu | marti su | kolaz */
export function sise(k, o = {}) {
  const tur = o.tur || 'gazoz';
  const b = { gazoz: ['#c8ecd8', 'BOĞAZ', 'GAZOZU', '#2f8f9a'], su: ['#d8eef8', 'MARTI', 'SU', '#2f6db5'], kolaz: ['#3a1a10', 'KOLAZ', '', '#d8433a'] }[tur];
  const g = k.grup('sise-' + tur);
  const cam = k.mat(b[0], { roughness: 0.05, metalness: 0.1, transparent: true, opacity: tur === 'kolaz' ? 0.92 : 0.55 });
  k.at(k.lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.13], [0.028, 0.16], [0.014, 0.19], [0.013, 0.22], [0.015, 0.225], [0, 0.225]], cam), 0, 0, 0, g);
  k.at(k.cyl(0.016, 0.016, 0.012, k.mat('#c8c8c8', { metalness: 0.8, roughness: 0.3 }), 14), 0, 0.229, 0, g);
  const et = k.dmat(256, 64, (c, w, h) => { c.fillStyle = b[3]; c.fillRect(0, 0, w, h); yazi(c, b[1], w / 2, h * (b[2] ? 0.36 : 0.5), { font: '900 24px system-ui' }); if (b[2]) yazi(c, b[2], w / 2, h * 0.72, { font: '800 18px system-ui', renk: '#ffd23f' }); });
  k.at(k.cyl(0.0345, 0.0345, 0.05, et, 24, true), 0, 0.08, 0, g);
  return g;
}

export function islakHamburger(k) {
  const g = k.grup('islak-hamburger'); const ek = k.mat('#c8642e', { roughness: 0.25 });
  const alt = k.at(k.sph(0.045, ek, 20, 10), 0, 0.012, 0, g); alt.scale.set(1, 0.35, 1);
  k.at(k.cyl(0.044, 0.046, 0.016, k.mat('#5a2a14', { roughness: 0.6 }), 20), 0, 0.03, 0, g);
  const ust = k.at(k.kup(0.047, ek, 0, Math.PI * 2, 0, Math.PI / 2, 20, 10), 0, 0.037, 0, g); ust.scale.y = 0.7;
  k.at(k.cyl(0.048, 0.048, 0.004, k.mat('#b8452a', { roughness: 0.2, transparent: true, opacity: 0.8 }), 20), 0, 0.04, 0, g);
  return g;
}

export function misir(k) {
  const g = k.grup('misir'); const m = k.mat('#f2c94c', { roughness: 0.55, map: k.paint(64, 64, (c, w, h) => { c.fillStyle = '#f2c94c'; c.fillRect(0, 0, w, h); c.fillStyle = '#d9a52e'; for (let y = 0; y < h; y += 5) for (let x = (y / 5 % 2) * 2.5; x < w; x += 5) c.fillRect(x, y, 1.5, 1.5); }) });
  const c = k.at(k.kapsul(0.025, 0.12, m), 0, 0.12, 0, g); void c;
  k.at(k.cyl(0.005, 0.005, 0.1, k.mat('#c8a070'), 6), 0, 0.03, 0, g);
  for (let i = 0; i < 3; i++) { const y = k.at(k.kup(0.03, k.mat('#a8c46a', { side: T.DoubleSide }), i * 2.1, 1.2, 0.6, 1.4), 0, 0.09, 0, g); y.scale.set(1, 1.8, 1); }
  return g;
}
