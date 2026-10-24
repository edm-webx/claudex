/** Sokak ve çay bahçesi dekorları, hayvanlar. */
import { T, rrect, yazi, gren, ton } from './kit.js';

const demir = k => k.mat('#2a2f36', { metalness: 0.5, roughness: 0.4 });

export function sokakLambasi(k, o = {}) {
  const g = k.grup('sokak-lambasi'); const m = demir(k);
  k.at(k.cyl(0.18, 0.24, 0.5, m, 12), 0, 0.25, 0, g);
  k.at(k.cyl(0.07, 0.09, 3.6, m, 12), 0, 2.2, 0, g);
  for (let i = 0; i < 3; i++) k.at(k.torus(0.1, 0.02, m, 6, 16), 0, 0.7 + i * 1.3, 0, g).rotation.x = Math.PI / 2;
  k.at(k.tube([[0, 3.9, 0], [0.2, 4.2, 0], [0.6, 4.25, 0], [0.75, 4.05, 0]], 0.04, m, 14), 0, 0, 0, g);
  const f = k.grup('fener', g); f.position.set(0.75, 3.75, 0);
  k.at(k.cone(0.25, 0.25, m, 6), 0, 0.25, 0, f);
  k.at(k.cyl(0.16, 0.12, 0.35, o.gece === false ? k.cam('#fff6d8') : k.isik('#ffe2a0', 1.6), 6), 0, 0, 0, f);
  k.at(k.cyl(0.1, 0.06, 0.1, m, 6), 0, -0.22, 0, f);
  g.userData.isikNoktasi = [0.75, 3.75, 0];
  return g;
}

export function bank(k) {
  const g = k.grup('bank'); const ah = k.mat('#b98a5e', { roughness: 0.7 }), m = demir(k);
  for (let i = 0; i < 3; i++) k.at(k.rbox(1.8, 0.05, 0.13, 0.015, ah), 0, 0.45, -0.15 + i * 0.15, g);
  for (let i = 0; i < 2; i++) { const s = k.at(k.rbox(1.8, 0.13, 0.05, 0.015, ah), 0, 0.68 + i * 0.17, -0.3, g); s.rotation.x = -0.15; }
  for (const x of [-0.75, 0.75]) { k.at(k.extrude([[-0.25, 0], [0.25, 0], [0.18, 0.45], [-0.1, 0.45], [-0.32, 1.0], [-0.38, 1.0], [-0.22, 0.42]], 0.05, m, 0.005), x, 0, 0, g).rotation.y = -Math.PI / 2; }
  return g;
}

export function copKutusu(k) {
  const g = k.grup('cop-kutusu');
  k.at(k.cyl(0.25, 0.22, 0.75, k.mat('#2f8a4a', { roughness: 0.5 }), 18), 0, 0.45, 0, g);
  k.at(k.cyl(0.27, 0.27, 0.06, k.mat('#256b3a'), 18), 0, 0.83, 0, g);
  k.at(k.cyl(0.04, 0.04, 0.5, demir(k)), 0, 0.25, -0.28, g);
  const l = k.dmat(64, 64, (c, w, h) => { c.fillStyle = '#2f8a4a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 16, 0.3, 5.9); c.stroke(); });
  k.at(k.plane(0.25, 0.25, l), 0, 0.5, 0.235, g);
  return g;
}

export function cayBahcesi(k) {
  const g = k.grup('cay-masasi');
  const m = k.mat('#c8d6dc', { metalness: 0.4, roughness: 0.4 }), ah = k.mat('#a8774f');
  k.at(k.cyl(0.4, 0.4, 0.04, k.dmat(128, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8433a'; for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) if ((x + y) / 16 % 2) c.fillRect(x, y, 16, 16); }), 24), 0, 0.72, 0, g);
  k.at(k.cyl(0.035, 0.035, 0.7, m), 0, 0.36, 0, g); k.at(k.cyl(0.25, 0.28, 0.03, m), 0, 0.015, 0, g);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const t = k.grup('tabure', g); t.position.set(Math.sin(a) * 0.65, 0, Math.cos(a) * 0.65);
    k.at(k.cyl(0.17, 0.17, 0.04, ah, 16), 0, 0.42, 0, t);
    for (let i = 0; i < 4; i++) { const b = i / 4 * Math.PI * 2 + 0.78; const l = k.at(k.cyl(0.015, 0.015, 0.44, m, 6), Math.cos(b) * 0.12, 0.21, Math.sin(b) * 0.12, t); l.rotation.set(Math.sin(b) * 0.15, 0, -Math.cos(b) * 0.15); }
  }
  // iki çay bardağı
  for (const x of [-0.12, 0.12]) { const b = cayBardagi(k, 1.4); b.position.set(x, 0.74, 0.05); g.add(b); }
  return g;
}

export function cayBardagi(k, olcek = 1) {
  const g = k.grup('cay-bardagi');
  const cam = k.mat('#e8f4f7', { roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 });
  const prof = [[0.0, 0.0], [0.028, 0.0], [0.03, 0.01], [0.022, 0.045], [0.025, 0.07], [0.034, 0.1], [0.035, 0.105]];
  k.at(k.lathe(prof, cam), 0, 0.012, 0, g);
  k.at(k.lathe([[0, 0], [0.027, 0], [0.021, 0.045], [0.024, 0.068], [0.031, 0.092], [0, 0.092]], k.mat('#8a2410', { roughness: 0.1 })), 0, 0.014, 0, g);
  k.at(k.lathe([[0, 0], [0.06, 0.0], [0.065, 0.01], [0.062, 0.012], [0, 0.006]], k.mat('#ffffff', { roughness: 0.3 })), 0, 0, 0, g);
  k.at(k.box(0.012, 0.006, 0.05, k.mat('#c8c8c8', { metalness: 0.7 })), 0.04, 0.02, 0.02, g).rotation.y = 0.5;
  g.scale.setScalar(olcek);
  return g;
}

export function semaver(k) {
  const g = k.grup('semaver'); const p = k.mat('#c8743a', { metalness: 0.8, roughness: 0.25 }), siyah = k.mat('#1c1c1c');
  k.at(k.lathe([[0, 0], [0.18, 0], [0.12, 0.08], [0.2, 0.15], [0.24, 0.35], [0.22, 0.55], [0.12, 0.62], [0.12, 0.7], [0, 0.7]], p), 0, 0, 0, g);
  k.at(k.lathe([[0, 0], [0.11, 0], [0.13, 0.05], [0.12, 0.2], [0.05, 0.25], [0, 0.25]], k.mat('#ffffff', { roughness: 0.25, map: k.paint(64, 32, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d5fa8'; for (let x = 0; x < w; x += 16) { c.beginPath(); c.arc(x + 8, 16, 5, 0, 7); c.fill(); } }) })), 0, 0.7, 0, g);
  for (const s of [-1, 1]) k.at(k.torus(0.07, 0.015, siyah, 6, 14, Math.PI), s * 0.24, 0.45, 0, g).rotation.z = s * Math.PI / 2;
  const m = k.at(k.cyl(0.015, 0.02, 0.15, p, 8), 0, 0.18, 0.24, g); m.rotation.x = Math.PI / 2 - 0.3;
  return g;
}

export function trafikKonisi(k) {
  const g = k.grup('koni');
  const m = k.dmat(64, 128, (c, w, h) => { c.fillStyle = '#f05a28'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(0, 40, w, 18); c.fillRect(0, 80, w, 14); });
  k.at(k.rbox(0.45, 0.05, 0.45, 0.02, k.mat('#f05a28')), 0, 0.025, 0, g);
  k.at(k.cone(0.16, 0.7, m, 18), 0, 0.4, 0, g);
  return g;
}

export function saksi(k, o = {}) {
  const g = k.grup('saksi'); const c = o.cicek || '#e0533c';
  k.at(k.lathe([[0, 0], [0.16, 0], [0.22, 0.32], [0.25, 0.34], [0.25, 0.38], [0, 0.38]], k.mat('#c8693e', { roughness: 0.9 })), 0, 0, 0, g);
  k.at(k.cyl(0.22, 0.22, 0.02, k.mat('#4a3426')), 0, 0.36, 0, g);
  const yap = k.mat('#4f8a3a'); for (let i = 0; i < 9; i++) { const a = i * 2.4; const y = k.at(k.sph(0.09, yap, 8, 6), Math.cos(a) * 0.11, 0.45 + (i % 3) * 0.05, Math.sin(a) * 0.11, g); y.scale.set(1, 0.6, 1); }
  const cm = k.mat(c, { roughness: 0.6 }); for (let i = 0; i < 6; i++) { const a = i * 1.05; k.at(k.sph(0.05, cm, 8, 6), Math.cos(a) * 0.1, 0.58 + (i % 2) * 0.04, Math.sin(a) * 0.1, g); }
  return g;
}

export function cesme(k) {
  let sd = 5; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const g = k.grup('cesme'); const mer = k.dmat(128, 128, (c, w, h) => { c.fillStyle = '#ece6dc'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,110,100,.25)'; c.lineWidth = 2; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(rnd() * w, 0); c.bezierCurveTo(rnd() * w, h / 3, rnd() * w, h / 2, rnd() * w, h); c.stroke(); } }, { roughness: 0.4 });
  k.at(k.rbox(1.6, 2.2, 0.6, 0.06, mer), 0, 1.1, 0, g);
  k.at(k.extrude([[-0.5, 0], [0.5, 0], [0.5, 0.8], [0, 1.2], [-0.5, 0.8]], 0.05, k.mat('#d8cfc2'), 0.01), 0, 0.9, 0.32, g);
  k.at(k.rbox(1.8, 0.2, 0.8, 0.05, mer), 0, 2.3, 0, g);
  k.at(k.rbox(1.2, 0.35, 0.5, 0.08, mer), 0, 0.18, 0.5, g);
  k.at(k.box(1.0, 0.05, 0.35, k.mat('#5aa9d6', { roughness: 0.05, metalness: 0.3 })), 0, 0.34, 0.5, g);
  const lu = k.at(k.cyl(0.025, 0.025, 0.18, k.mat('#c8a24a', { metalness: 0.8, roughness: 0.25 })), 0, 1.0, 0.42, g); lu.rotation.x = Math.PI / 2;
  const su = k.at(k.cyl(0.012, 0.012, 0.62, k.mat('#bfe6f2', { transparent: true, opacity: 0.6, emissive: '#bfe6f2', emissiveIntensity: 0.2 })), 0, 0.67, 0.5, g); su.userData.hareket = true;
  return g;
}

export function reklamPanosu(k, o = {}) {
  const g = k.grup('reklam-panosu'); const marka = o.marka || 'kolaz';
  const ilan = {
    kolaz: ['KOLAZ', 'Buz gibi serinlik', '#d8433a', '#ffffff'], ayranbey: ['AYRANBEY', 'Köpüklü, bol köpüklü', '#2f6db5', '#ffffff'],
    narcicek: ['NARÇİÇEK', 'Şerbet gibi nar', '#8a1f3a', '#ffd23f'], martikart: ['MARTIKART', 'Bas geç, vapura yetiş', '#2f8f9a', '#ffffff'],
  }[marka];
  const m = k.dmat(512, 256, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, ilan[2]); gr.addColorStop(1, ton(ilan[2], -0.12)); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(w * 0.85, h * 0.3, 120, 0, 7); c.fill(); yazi(c, ilan[0], w * 0.42, h * 0.42, { font: '900 96px system-ui', renk: ilan[3], max: w * 0.75 }); yazi(c, ilan[1], w * 0.42, h * 0.75, { font: '700 36px system-ui', renk: ilan[3], max: w * 0.75 }); }, { emissive: '#ffffff', emissiveIntensity: 0.15 });
  const mt = demir(k);
  for (const x of [-1.6, 1.6]) k.at(k.box(0.15, 3.2, 0.15, mt), x, 1.6, -0.1, g);
  k.at(k.rbox(4.4, 2.3, 0.2, 0.04, k.mat('#f4f1ea')), 0, 4.1, 0, g);
  k.at(k.plane(4.2, 2.1, m), 0, 4.1, 0.105, g);
  k.at(k.box(4.4, 0.06, 0.5, mt), 0, 2.95, 0.25, g);
  return g;
}

/** Sokak kedisi: oturan. renk: tekir | sari | siyah | beyaz | ucrenk */
export function kedi(k, o = {}) {
  const tur = o.renk || 'tekir';
  const ana = { tekir: '#8c7a66', sari: '#e8a24a', siyah: '#2a2624', beyaz: '#f4efe4', ucrenk: '#f4efe4' }[tur];
  const m = k.mat('#ffffff', { roughness: 0.9, map: k.paint(128, 128, (c, w, h) => { c.fillStyle = ana; c.fillRect(0, 0, w, h); if (tur === 'tekir' || tur === 'sari') { c.fillStyle = ton(ana, -0.15); for (let y = 6; y < h; y += 16) c.fillRect(0, y, w, 6); } if (tur === 'ucrenk') { c.fillStyle = '#e8a24a'; c.beginPath(); c.arc(30, 40, 26, 0, 7); c.fill(); c.fillStyle = '#2a2624'; c.beginPath(); c.arc(90, 80, 28, 0, 7); c.fill(); } }) });
  const g = k.grup('kedi-' + tur);
  const gv = k.at(k.sph(0.16, m), 0, 0.17, -0.02, g); gv.scale.set(0.85, 1.05, 1.15);
  const bas = k.grup('bas', g); bas.position.set(0, 0.36, 0.08); bas.userData.hareket = true;
  k.at(k.sph(0.12, m), 0, 0, 0, bas).scale.set(1.1, 0.95, 0.95);
  for (const s of [-1, 1]) { const ku = k.at(k.cone(0.045, 0.09, m, 4), s * 0.07, 0.11, -0.01, bas); ku.rotation.z = s * -0.25; }
  const goz = k.mat('#c8d84a', { emissive: '#6b7a10', emissiveIntensity: 0.3, roughness: 0.2 }), bebek = k.mat('#111');
  for (const s of [-1, 1]) { k.at(k.sph(0.022, goz, 10, 8), s * 0.045, 0.015, 0.1, bas); k.at(k.box(0.006, 0.026, 0.01, bebek), s * 0.045, 0.015, 0.12, bas); }
  k.at(k.sph(0.014, k.mat('#e98a9a')), 0, -0.02, 0.115, bas);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) { const b = k.at(k.box(0.09, 0.003, 0.003, k.mat('#f4efe4')), s * 0.07, -0.03 - i * 0.012, 0.1, bas); b.rotation.z = s * (0.1 - i * 0.2); }
  for (const s of [-1, 1]) k.at(k.kapsul(0.035, 0.12, m), s * 0.06, 0.09, 0.1, g);
  const ku = k.grup('kuyruk', g); ku.userData.hareket = true;
  k.at(k.tube([[0, 0.05, -0.17], [0.12, 0.03, -0.25], [0.22, 0.08, -0.18], [0.24, 0.2, -0.1]], 0.03, m, 14), 0, 0, 0, ku);
  g.userData.parca = { bas, kuyruk: ku };
  return g;
}

export function marti(k) {
  const g = k.grup('marti'); const b = k.mat('#f7f6f2', { roughness: 0.7 }), gri = k.mat('#a9b3bd', { roughness: 0.7 }), sari = k.mat('#f2b632', { roughness: 0.4 });
  const gv = k.at(k.sph(0.13, b), 0, 0.22, 0, g); gv.scale.set(0.85, 0.85, 1.4);
  k.at(k.sph(0.09, b), 0, 0.36, 0.13, g);
  const ga = k.at(k.cone(0.025, 0.1, sari, 8), 0, 0.35, 0.25, g); ga.rotation.x = Math.PI / 2;
  k.at(k.sph(0.008, k.mat('#e0533c')), 0, 0.335, 0.27, g);
  for (const s of [-1, 1]) { k.at(k.sph(0.018, k.mat('#111')), s * 0.06, 0.38, 0.19, g); const k2 = k.grup(s < 0 ? 'kanatL' : 'kanatR', g); k2.position.set(s * 0.1, 0.27, 0); k2.userData.hareket = true; const kn = k.at(k.sph(0.12, gri), s * 0.03, 0, -0.03, k2); kn.scale.set(0.3, 0.55, 1.4); k.at(k.sph(0.05, k.mat('#2a2624')), s * 0.03, -0.01, -0.2, k2).scale.set(0.4, 0.4, 1); }
  k.at(k.cone(0.07, 0.15, b, 8), 0, 0.22, -0.22, g).rotation.x = -Math.PI / 2 - 0.2;
  for (const s of [-1, 1]) { k.at(k.cyl(0.01, 0.01, 0.12, sari, 6), s * 0.04, 0.06, 0, g); k.at(k.box(0.05, 0.01, 0.06, sari), s * 0.04, 0.005, 0.02, g); }
  return g;
}
