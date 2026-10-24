/** Araçlar. Ön yüz +z, sağ taraf (kapılar) -x. Tekerler userData.parca.tekerler, kapılar userData.parca.kapilar. */
import { T, rrect, yazi, gren, ton } from './kit.js';
import { simitMat } from './karakter.js';

function teker(k, r, gen, p, x, y, z, jant = '#cfd5dc') {
  const t = k.grup('teker', p); t.position.set(x, y, z); t.userData.hareket = true;
  const lastik = k.mat('#1e1f22', { roughness: 0.9 });
  const a = k.at(k.cyl(r, r, gen, lastik, 22), 0, 0, 0, t); a.rotation.z = Math.PI / 2;
  const j = k.at(k.cyl(r * 0.6, r * 0.6, gen + 0.01, k.mat(jant, { metalness: 0.6, roughness: 0.3 }), 16), 0, 0, 0, t); j.rotation.z = Math.PI / 2;
  const s = k.at(k.cyl(r * 0.2, r * 0.2, gen + 0.03, k.mat('#5b6168', { metalness: 0.5 }), 8), 0, 0, 0, t); s.rotation.z = Math.PI / 2;
  return t;
}
function ledTabela(k, ust, alt, w = 512) {
  const tx = k.paint(w, 64, (c, W, h) => {
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, W, h); c.fillStyle = '#ffb21e';
    yazi(c, ust, 16, h / 2 + 2, { font: '900 44px monospace', renk: '#ffb21e', hiza: 'left' });
    yazi(c, alt, 130, h / 2 + 2, { font: '800 32px monospace', renk: '#ffb21e', hiza: 'left', max: W - 140 });
    c.fillStyle = 'rgba(0,0,0,.4)'; for (let x = 0; x < W; x += 4) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 4) c.fillRect(0, y, W, 1);
  });
  return k.mat('#ffffff', { map: tx, emissive: '#ffffff', emissiveMap: tx, emissiveIntensity: 0.9 });
}
function koltuklar(k, p, n, x0, x1, z0, z1, y, renk) {
  const m = k.mat(renk, { roughness: 0.8 });
  for (let i = 0; i < n; i++) { const z = z0 + (z1 - z0) * i / (n - 1); for (const x of [x0, x1]) { k.at(k.rbox(0.45, 0.12, 0.45, 0.04, m), x, y, z, p); k.at(k.rbox(0.45, 0.55, 0.1, 0.04, m), x, y + 0.3, z - 0.2, p); } }
}

/** Belediye otobüsü */
export function otobus(k, o = {}) {
  const { hat = '42B', yon = 'BELGRAD ORMANI', renk = '#e8742c', ikinci = '#2f8f9a' } = o;
  const g = k.grup('otobus'); const L = 10.5, W = 2.5, H = 3.0;
  const beyaz = k.mat('#f4f1ea', { roughness: 0.4 }), tur = k.mat(renk, { roughness: 0.45 }), mavi = k.mat(ikinci, { roughness: 0.45 });
  const cam = k.cam('#203444', { opacity: 0.45 }), siyah = k.mat('#20242c', { roughness: 0.5 });
  // gövde: alt etek + üst cam bandı arasında çerçeve
  k.at(k.rbox(W, 1.05, L, 0.18, beyaz), 0, 0.97, 0, g);
  k.at(k.rbox(W + 0.02, 0.5, L + 0.02, 0.12, tur), 0, 0.7, 0, g);
  k.at(k.box(W + 0.03, 0.08, L - 0.6, mavi), 0, 1.38, 0, g);
  k.at(k.rbox(W, 0.42, L, 0.18, beyaz), 0, H - 0.21, 0, g);       // tavan
  for (const s of [-1, 1]) for (let i = 0; i <= 7; i++) k.at(k.box(0.08, 1.1, 0.1, beyaz), s * (W / 2 - 0.05), 1.95, -L / 2 + 0.3 + i * (L - 0.6) / 7, g); // dikmeler
  for (const s of [-1, 1]) k.at(k.box(0.02, 1.1, L - 0.4, cam), s * (W / 2 - 0.03), 1.95, 0, g);
  k.at(k.box(W - 0.1, 1.25, 0.03, cam), 0, 1.9, L / 2 - 0.02, g);
  k.at(k.box(W - 0.4, 0.8, 0.03, cam), 0, 2.05, -L / 2 + 0.02, g);
  k.at(k.box(W - 0.2, 0.1, 0.1, beyaz), 0, 1.4, L / 2 - 0.04, g);
  k.at(k.rbox(W - 0.6, 0.3, L - 2, 0.1, k.mat('#d9d4ca')), 0, H + 0.12, -0.6, g); // klima
  // iç: zemin + koltuk + tutamak borusu
  k.at(k.box(W - 0.2, 0.05, L - 0.4, k.mat('#5b5f66')), 0, 0.5, 0, g);
  koltuklar(k, g, 6, 0.75, -0.75, -4.2, 2.6, 0.75, '#2f6db5');
  for (const s of [-1, 1]) k.at(k.cyl(0.02, 0.02, L - 1, k.mat('#f2b632', { metalness: 0.4 })), s * 0.5, 2.55, 0, g).rotation.x = Math.PI / 2;
  // tabelalar
  const led = ledTabela(k, hat, yon);
  const on = k.at(k.plane(W - 0.4, 0.3, led), 0, 2.72, L / 2 + 0.005, g); void on;
  const yan = k.at(k.plane(2.6, 0.3, led), W / 2 + 0.005, 2.7, 2.2, g); yan.rotation.y = Math.PI / 2;
  const arka = k.at(k.plane(1.2, 0.3, ledTabela(k, hat, '', 256)), 0, 2.6, -L / 2 - 0.005, g); arka.rotation.y = Math.PI;
  const arma = k.dmat(256, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = renk; c.beginPath(); c.arc(54, 64, 46, 0, 7); c.fill(); yazi(c, 'M', 54, 66, { font: '900 44px system-ui' }); yazi(c, 'MARTIKÖY', 110, 48, { font: '900 28px system-ui', renk: ikinci, hiza: 'left' }); yazi(c, 'Belediyesi', 112, 84, { font: '700 22px system-ui', renk: ikinci, hiza: 'left' }); }, { transparent: true, alphaTest: 0.3 });
  for (const s of [-1, 1]) { const a = k.at(k.plane(1.6, 0.8, arma), s * (W / 2 + 0.03), 1.0, -1.5, g); a.rotation.y = s * Math.PI / 2; }
  // farlar, tampon, aynalar
  for (const s of [-1, 1]) { k.at(k.rbox(0.36, 0.18, 0.06, 0.05, k.isik('#fff6d8', 1.4)), s * 0.85, 0.88, L / 2 + 0.01, g); k.at(k.rbox(0.25, 0.3, 0.06, 0.05, k.isik('#e63946', 0.8)), s * 1.0, 1.1, -L / 2 - 0.01, g); }
  k.at(k.rbox(W + 0.06, 0.25, 0.2, 0.08, siyah), 0, 0.5, L / 2 + 0.03, g); k.at(k.rbox(W + 0.06, 0.25, 0.2, 0.08, siyah), 0, 0.5, -L / 2 - 0.03, g);
  for (const s of [-1, 1]) { const ay = k.at(k.tube([[s * W / 2, 2.4, L / 2 - 0.1], [s * (W / 2 + 0.3), 2.55, L / 2 + 0.05], [s * (W / 2 + 0.35), 2.2, L / 2 + 0.15]], 0.025, siyah, 10), 0, 0, 0, g); void ay; k.at(k.rbox(0.08, 0.35, 0.2, 0.03, siyah), s * (W / 2 + 0.36), 2.05, L / 2 + 0.15, g); }
  // kapılar (sağ taraf -x): kayar kanatlar
  const kapilar = [];
  for (const z of [L / 2 - 1.2, -0.5]) {
    const d = k.grup('kapi', g); d.position.set(-W / 2 - 0.02, 0, z); d.userData.hareket = true;
    for (const s of [-1, 1]) { const kan = k.grup('kanat', d); kan.position.z = s * 0.33; kan.userData.s = s; kan.userData.hareket = true; k.at(k.rbox(0.05, 2.0, 0.64, 0.03, beyaz), 0, 1.5, 0, kan); k.at(k.box(0.03, 1.4, 0.5, cam), -0.02, 1.7, 0, kan); kapilar.push(kan); }
  }
  const tekerler = [];
  for (const z of [L / 2 - 2.0, -L / 2 + 2.4]) for (const s of [-1, 1]) tekerler.push(teker(k, 0.5, 0.32, g, s * (W / 2 - 0.15), 0.5, z));
  for (const z of [L / 2 - 2.0, -L / 2 + 2.4]) for (const s of [-1, 1]) k.at(k.cyl(0.62, 0.62, 0.3, siyah, 20, true), s * (W / 2 - 0.12), 0.62, z, g).rotation.z = Math.PI / 2;
  g.userData.parca = { tekerler, kapilar };
  /** kapıyı aç: 0..1 */
  g.userData.kapiAc = v => kapilar.forEach(kn => { kn.position.z = kn.userData.s * (0.33 + 0.6 * v); });
  return g;
}

/** Sarı dolmuş minibüs */
export function dolmus(k, o = {}) {
  const { guzergah = 'TAKSİM - BAHÇEKÖY' } = o;
  const g = k.grup('dolmus'); const L = 5.6, W = 2.0;
  const sari = k.mat('#f5c518', { roughness: 0.35 }), cam = k.cam('#203444', { opacity: 0.5 }), siyah = k.mat('#20242c');
  k.at(k.rbox(W, 1.0, L, 0.2, sari), 0, 0.85, 0, g);
  k.at(k.rbox(W - 0.05, 1.0, L - 1.1, 0.25, sari), 0, 1.75, -0.45, g);
  k.at(k.box(W - 0.02, 0.6, L - 1.5, cam), 0, 1.75, -0.45, g);
  const on = k.at(k.box(W - 0.2, 0.75, 0.04, cam), 0, 1.65, L / 2 - 1.0, g); on.rotation.x = -0.45;
  k.at(k.box(W + 0.02, 0.1, L - 0.2, siyah), 0, 1.22, 0, g);
  const tab = k.dmat(256, 64, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#111'; c.lineWidth = 4; c.strokeRect(2, 2, w - 4, h - 4); yazi(c, guzergah, w / 2, h / 2 + 2, { font: '900 26px system-ui', renk: '#111', max: w - 16 }); });
  k.at(k.box(1.3, 0.25, 0.04, tab), 0, 2.08, L / 2 - 1.05, g).rotation.x = -0.45;
  for (const s of [-1, 1]) { k.at(k.rbox(0.3, 0.16, 0.05, 0.05, k.isik('#fff6d8', 1.3)), s * 0.68, 0.9, L / 2 + 0.01, g); k.at(k.rbox(0.18, 0.25, 0.05, 0.04, k.isik('#e63946', 0.8)), s * 0.82, 0.95, -L / 2 - 0.01, g); }
  k.at(k.rbox(W + 0.05, 0.2, 0.18, 0.06, siyah), 0, 0.42, L / 2, g); k.at(k.rbox(W + 0.05, 0.2, 0.18, 0.06, siyah), 0, 0.42, -L / 2, g);
  const tekerler = []; for (const z of [L / 2 - 1.0, -L / 2 + 1.0]) for (const s of [-1, 1]) tekerler.push(teker(k, 0.36, 0.24, g, s * (W / 2 - 0.08), 0.36, z));
  g.userData.parca = { tekerler }; return g;
}

/** Sarı taksi */
export function taksi(k, o = {}) {
  const g = k.grup('taksi'); const L = 4.4, W = 1.8;
  const sari = k.mat(o.renk || '#f5c518', { roughness: 0.3, metalness: 0.15 }), cam = k.cam('#203444', { opacity: 0.55 }), siyah = k.mat('#1c1c1c');
  k.at(k.rbox(W, 0.6, L, 0.2, sari), 0, 0.62, 0, g);
  const kab = k.at(k.rbox(W - 0.15, 0.55, 2.2, 0.22, sari), 0, 1.15, -0.25, g); void kab;
  k.at(k.box(W - 0.12, 0.38, 1.9, cam), 0, 1.17, -0.25, g);
  k.at(k.box(W - 0.3, 0.38, 2.24, cam), 0, 1.17, -0.25, g);
  const dama = k.dmat(256, 32, (c, w, h) => { for (let x = 0; x < w; x += 16) for (let y = 0; y < h; y += 16) { c.fillStyle = ((x + y) / 16) % 2 ? '#111' : '#fff'; c.fillRect(x, y, 16, 16); } });
  for (const s of [-1, 1]) { const d = k.at(k.plane(3.6, 0.12, dama), s * (W / 2 + 0.005), 0.7, 0, g); d.rotation.y = s * Math.PI / 2; }
  const ts = k.dmat(128, 48, (c, w, h) => { c.fillStyle = '#f5c518'; c.fillRect(0, 0, w, h); yazi(c, 'TAKSİ', w / 2, h / 2 + 2, { font: '900 32px system-ui', renk: '#111' }); }, { emissive: '#ffffff', emissiveIntensity: 0.25 });
  k.at(k.rbox(0.6, 0.18, 0.22, 0.04, ts), 0, 1.5, -0.25, g);
  for (const s of [-1, 1]) { k.at(k.rbox(0.32, 0.14, 0.05, 0.05, k.isik('#fff6d8', 1.3)), s * 0.6, 0.7, L / 2 + 0.01, g); k.at(k.rbox(0.3, 0.12, 0.05, 0.04, k.isik('#e63946', 0.8)), s * 0.62, 0.75, -L / 2 - 0.01, g); }
  k.at(k.rbox(W + 0.04, 0.16, 0.14, 0.06, siyah), 0, 0.38, L / 2, g); k.at(k.rbox(W + 0.04, 0.16, 0.14, 0.06, siyah), 0, 0.38, -L / 2, g);
  const plaka = k.dmat(128, 32, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#1d4fa8'; c.fillRect(0, 0, 14, h); yazi(c, '34 MRT 42', 72, h / 2 + 1, { font: '800 20px monospace', renk: '#111' }); });
  k.at(k.plane(0.5, 0.12, plaka), 0, 0.5, L / 2 + 0.08, g);
  const tekerler = []; for (const z of [L / 2 - 0.85, -L / 2 + 0.85]) for (const s of [-1, 1]) tekerler.push(teker(k, 0.33, 0.22, g, s * (W / 2 - 0.06), 0.33, z));
  g.userData.parca = { tekerler }; return g;
}

/** Şehir hatları vapuru (iki başı sivri) */
export function vapur(k, o = {}) {
  const { ad = 'MARTIKÖY-3' } = o;
  const g = k.grup('vapur'); const L = 24, W = 6.2;
  const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI * 2; const x = Math.cos(t), z = Math.sin(t); pts.push([Math.sign(x) * Math.pow(Math.abs(x), 0.35) * W / 2, z * L / 2 * (1 - 0.0 * Math.abs(x))]); }
  const govdeM = k.mat('#1f2a36', { roughness: 0.5 }), beyaz = k.mat('#f4f1ea', { roughness: 0.45 }), kirmizi = k.mat('#b5361e', { roughness: 0.5 });
  const sekil = (y, h, m, sk = 1) => { const e = k.extrude(pts.map(([x, z]) => [x * sk, z * sk]), h, m, 0.05); e.rotation.x = Math.PI / 2; e.position.y = y + h / 2; g.add(e); return e; };
  sekil(-0.6, 1.2, govdeM); sekil(0.6, 0.35, kirmizi, 1.0); sekil(0.95, 0.9, beyaz, 0.995);
  k.at(k.box(W * 0.9, 0.06, L * 0.9, k.mat('#a8774f')), 0, 1.88, 0, g);
  // kabinler
  const pencere = k.dmat(512, 64, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); for (let x = 8; x < w; x += 32) { c.fillStyle = '#26394a'; rrect(c, x, 12, 24, 38, 5); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(x + 3, 15, 6, 30); } });
  const kab1 = k.at(k.rbox(W * 0.8, 2.0, L * 0.7, 0.2, pencere), 0, 2.9, 0, g); void kab1;
  k.at(k.box(W * 0.85, 0.12, L * 0.75, beyaz), 0, 3.95, 0, g);
  k.at(k.rbox(W * 0.55, 1.6, L * 0.32, 0.18, pencere), 0, 4.8, 0, g);
  k.at(k.rbox(W * 0.6, 0.1, L * 0.35, 0.05, beyaz), 0, 5.65, 0, g);
  // korkuluk
  for (const z of [-L * 0.37, L * 0.37]) for (let i = -4; i <= 4; i++) k.at(k.cyl(0.03, 0.03, 0.9, beyaz, 6), i * 0.65, 2.35, z, g);
  // baca
  k.at(k.cyl(0.6, 0.7, 2.2, beyaz, 20), 0, 6.7, -1, g);
  k.at(k.cyl(0.62, 0.62, 0.5, kirmizi, 20), 0, 7.4, -1, g); k.at(k.cyl(0.63, 0.63, 0.3, k.mat('#1c1c1c'), 20), 0, 7.85, -1, g);
  // can simitleri
  const can = k.dmat(64, 16, (c, w, h) => { for (let x = 0; x < w; x += 16) { c.fillStyle = (x / 16) % 2 ? '#fff' : '#f05a28'; c.fillRect(x, 0, 16, h); } });
  for (const s of [-1, 1]) for (const z of [-5, 0, 5]) { const t = k.at(k.torus(0.32, 0.08, can, 8, 20), s * (W * 0.4 + 0.02), 2.9, z, g); t.rotation.y = Math.PI / 2; }
  // ad yazısı
  const adt = k.dmat(512, 96, (c, w, h) => { c.clearRect(0, 0, w, h); yazi(c, ad, w / 2, h / 2 + 4, { font: '900 64px system-ui', renk: '#ffffff' }); }, { transparent: true, alphaTest: 0.3 });
  for (const s of [-1, 1]) { const a = k.at(k.plane(5, 0.9, adt), s * (W / 2 + 0.06), 0.1, 0, g); a.rotation.y = s * Math.PI / 2; }
  // köprü ışığı, direk, bayrak
  k.at(k.cyl(0.05, 0.05, 3, k.mat('#c8c8c8', { metalness: 0.5 })), 0, 7.2, 3.5, g);
  k.at(k.box(0.02, 0.5, 0.8, k.mat('#e30a17')), 0, 8.3, 3.1, g);
  g.userData.carpismaNot = 'Vapur yüksekliği 8.5 m, iskeleye yanaşırken 0.6 m su altında';
  return g;
}

/** Seyyar tezgah arabası: simit | misir | kestane | dondurma */
export function seyyar(k, o = {}) {
  const tur = o.tur || 'simit';
  const g = k.grup('seyyar-' + tur);
  const renk = { simit: '#d8433a', misir: '#f2b632', kestane: '#7d5638', dondurma: '#49b0d6' }[tur];
  const kasa = k.mat(renk, { roughness: 0.45 }), metal = k.mat('#cdd5dc', { metalness: 0.6, roughness: 0.3 });
  k.at(k.rbox(1.5, 0.7, 0.8, 0.06, kasa), 0, 0.75, 0, g);
  k.at(k.rbox(1.55, 0.05, 0.85, 0.02, metal), 0, 1.12, 0, g);
  const yaziT = k.dmat(256, 64, (c, w, h) => { c.fillStyle = renk; c.fillRect(0, 0, w, h); yazi(c, { simit: 'SICAK SİMİT', misir: 'HAŞLAMA MISIR', kestane: 'KESTANE KEBAP', dondurma: 'DONDURMA' }[tur], w / 2, h / 2 + 2, { font: '900 30px system-ui', renk: '#fff', kontur: 'rgba(0,0,0,.35)', kalin: 5, max: w - 12 }); });
  k.at(k.plane(1.3, 0.32, yaziT), 0, 0.82, 0.405, g);
  for (const s of [-1, 1]) teker(k, 0.22, 0.08, g, s * 0.8, 0.22, 0, '#e8e2d6');
  k.at(k.cyl(0.03, 0.03, 0.5, metal), 0, 0.4, -0.3, g);
  k.at(k.tube([[-0.5, 1.0, -0.4], [-0.5, 1.0, -0.8], [0.5, 1.0, -0.8], [0.5, 1.0, -0.4]], 0.025, metal, 12), 0, 0, 0, g);
  if (tur === 'simit') {
    k.at(k.box(1.3, 0.55, 0.65, k.cam('#e6f2f5', { opacity: 0.3 })), 0, 1.42, 0, g);
    for (const x of [-0.65, 0.65]) for (const z of [-0.32, 0.32]) k.at(k.box(0.03, 0.56, 0.03, metal), x, 1.42, z, g);
    k.at(k.box(1.34, 0.03, 0.69, metal), 0, 1.71, 0, g);
    const sm = simitMat(k); for (let i = 0; i < 10; i++) { const s = k.at(k.torus(0.08, 0.034, sm, 10, 20), -0.5 + (i % 5) * 0.25, 1.2 + Math.floor(i / 5) * 0.08, -0.12 + Math.floor(i / 5) * 0.2, g); s.rotation.x = Math.PI / 2 - 0.2; }
  } else if (tur === 'misir') {
    k.at(k.cyl(0.32, 0.3, 0.35, metal, 20), -0.3, 1.3, 0, g);
    const m = k.mat('#f2c94c', { roughness: 0.6, map: k.paint(64, 64, (c, w, h) => { c.fillStyle = '#f2c94c'; c.fillRect(0, 0, w, h); c.fillStyle = '#e0a82e'; for (let y = 0; y < h; y += 6) for (let x = (y / 6 % 2) * 3; x < w; x += 6) c.fillRect(x, y, 2, 2); }) });
    for (let i = 0; i < 5; i++) { const c = k.at(k.kapsul(0.05, 0.18, m), 0.2 + i * 0.12, 1.22, -0.1 + (i % 2) * 0.15, g); c.rotation.z = Math.PI / 2; }
  } else if (tur === 'kestane') {
    k.at(k.cyl(0.4, 0.4, 0.06, k.mat('#2a2a2a', { metalness: 0.5 }), 24), 0, 1.2, 0, g);
    const km = k.mat('#6b3a1e', { roughness: 0.5 }); for (let i = 0; i < 22; i++) { const a = i * 2.4, r = 0.08 + (i % 4) * 0.08; k.at(k.sph(0.04, km, 10, 8), Math.cos(a) * r, 1.25, Math.sin(a) * r, g).scale.set(1, 0.7, 1); }
    k.at(k.cyl(0.06, 0.06, 0.6, k.mat('#2a2a2a')), 0.55, 1.45, -0.25, g);
  } else {
    for (let i = 0; i < 4; i++) k.at(k.cyl(0.13, 0.13, 0.05, k.mat(['#fff1d6', '#7a4a2a', '#f2a2b3', '#9bd36a'][i], { roughness: 0.9 }), 16), -0.45 + i * 0.3, 1.16, 0, g);
    k.at(k.cyl(0.04, 0.04, 1.4, metal), 0.6, 1.8, -0.3, g); k.at(k.cyl(0.08, 0.03, 0.18, k.mat('#e9c58a')), 0.6, 2.6, -0.3, g).rotation.x = Math.PI;
  }
  // şemsiye
  const sem = k.dmat(256, 64, (c, w, h) => { for (let x = 0; x < w; x += 32) { c.fillStyle = (x / 32) % 2 ? '#ffffff' : renk; c.fillRect(x, 0, 32, h); } }, { side: T.DoubleSide, roughness: 0.9 });
  k.at(k.cyl(0.025, 0.025, 1.5, metal), 0.6, 1.85, 0.3, g);
  const s = k.at(k.cone(1.0, 0.45, sem, 16), 0.6, 2.75, 0.3, g); s.material = sem; void s;
  g.userData.carpisma = { w: 1.7, h: 1.2, d: 0.9 };
  return g;
}

/** Kurye motoru, arka sandık "Paket Kuş" */
export function motor(k, o = {}) {
  const g = k.grup('motor'); const renk = o.renk || '#e0533c';
  const m = k.mat(renk, { roughness: 0.3, metalness: 0.2 }), siyah = k.mat('#1c1c1c'), metal = k.mat('#cdd5dc', { metalness: 0.7, roughness: 0.25 });
  const tekerler = [teker(k, 0.28, 0.12, g, 0, 0.28, 0.65), teker(k, 0.28, 0.12, g, 0, 0.28, -0.6)];
  k.at(k.rbox(0.36, 0.3, 1.0, 0.12, m), 0, 0.5, -0.15, g);
  k.at(k.rbox(0.3, 0.12, 0.6, 0.05, siyah), 0, 0.72, -0.25, g);
  const on = k.at(k.rbox(0.34, 0.7, 0.18, 0.08, m), 0, 0.75, 0.48, g); on.rotation.x = -0.3;
  k.at(k.cyl(0.02, 0.02, 0.6, metal), 0, 1.12, 0.6, g).rotation.z = Math.PI / 2;
  k.at(k.cyl(0.07, 0.06, 0.05, k.isik('#fff6d8', 1.4)), 0, 0.98, 0.66, g).rotation.x = Math.PI / 2;
  const sandik = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#f0c419'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c1c1c'; c.beginPath(); c.moveTo(70, 90); c.quadraticCurveTo(128, 40, 186, 90); c.quadraticCurveTo(128, 70, 70, 90); c.fill(); yazi(c, 'PAKET', w / 2, 140, { font: '900 52px system-ui', renk: '#1c1c1c' }); yazi(c, 'KUŞ', w / 2, 192, { font: '900 52px system-ui', renk: '#d8433a' }); });
  k.at(k.rbox(0.45, 0.45, 0.42, 0.05, sandik), 0, 1.0, -0.55, g);
  g.userData.parca = { tekerler }; return g;
}

/** Bisiklet (kurye sepetli) */
export function bisiklet(k, o = {}) {
  const g = k.grup('bisiklet'); const m = k.mat(o.renk || '#2fb3b0', { roughness: 0.3, metalness: 0.3 }), siyah = k.mat('#1c1c1c');
  const tekerler = [];
  for (const z of [0.55, -0.55]) { const t = k.grup('teker', g); t.position.set(0, 0.34, z); t.userData.hareket = true; const r = k.at(k.torus(0.32, 0.025, siyah, 8, 32), 0, 0, 0, t); r.rotation.y = Math.PI / 2; for (let i = 0; i < 6; i++) { const s = k.at(k.cyl(0.006, 0.006, 0.62, k.mat('#c8c8c8')), 0, 0, 0, t); s.rotation.x = i * Math.PI / 6; } tekerler.push(t); }
  for (const pts of [[[0, 0.34, -0.55], [0, 0.4, -0.08]], [[0, 0.4, -0.08], [0, 0.8, -0.15]], [[0, 0.4, -0.08], [0, 0.78, 0.4]], [[0, 0.78, 0.4], [0, 0.34, 0.55]], [[0, 0.8, -0.15], [0, 0.34, -0.55]], [[0, 0.8, -0.15], [0, 0.78, 0.4]]])
    k.at(k.tube(pts, 0.022, m, 4), 0, 0, 0, g);
  k.at(k.rbox(0.14, 0.05, 0.25, 0.02, siyah), 0, 0.86, -0.18, g);
  k.at(k.cyl(0.015, 0.015, 0.5, siyah), 0, 0.92, 0.42, g).rotation.z = Math.PI / 2;
  const sepet = k.mat('#a8774f', { roughness: 0.9, map: k.paint(64, 64, (c, w, h) => { c.fillStyle = '#a8774f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7d5638'; c.lineWidth = 3; for (let i = 0; i < w; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }) });
  k.at(k.rbox(0.35, 0.22, 0.28, 0.03, sepet), 0, 0.85, 0.62, g);
  g.userData.parca = { tekerler }; return g;
}
