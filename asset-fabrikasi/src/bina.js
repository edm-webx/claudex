/** Binalar: İstanbul apartmanı, ahşap konak, dükkan, otobüs durağı, Martı Kulesi. Ön cephe +z. */
import { T, rrect, yazi, gren, ton, rng } from './kit.js';

export const DUKKAN_ADLARI = ['KARDEŞLER BAKKAL', 'BOĞAZ FIRINI', 'LEZZET DURAĞI', 'MARTI BERBER', 'TAZE MANAV', 'NAR ÇİÇEK ECZANE', 'ÇINAR KIRTASİYE', 'DENİZ TERZİ', 'KÖŞE TEKEL', 'KEYİF KAHVESİ'];
const PASTEL = ['#e9c9a3', '#d9a6a0', '#a9c4d6', '#c7d6a3', '#e6d7a6', '#d8b7cf', '#f0e2cc', '#b9c9c0'];

function sivaMat(k, renk, seed = 1) {
  return k.dmat(256, 256, (c, w, h) => { c.fillStyle = renk; c.fillRect(0, 0, w, h); gren(c, w, h, ton(renk, -0.12), 900, 1.6, seed); gren(c, w, h, ton(renk, 0.08), 500, 1.2, seed + 1); }, { roughness: 0.95 }, [2, 2]);
}
function kiremit(k) {
  return k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#b5532e'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(0, y + 12, w, 4); for (let x = ((y / 16) % 2) * 12; x < w; x += 24) { c.fillStyle = 'rgba(255,220,180,.12)'; c.fillRect(x, y, 10, 12); } } }, { roughness: 0.85 }, [4, 4]);
}
/** dört eğimli çatı */
function catı(k, p, w, d, h, y, m) {
  const c = k.at(k.cone(Math.SQRT1_2, 1, m, 4), 0, y + h / 2, 0, p); c.rotation.y = Math.PI / 4; c.scale.set(w * 1.0, h, d * 1.0);
  return c;
}
/** pencere: çerçeve + cam + denizlik + isteğe bağlı panjur */
function pencere(k, p, x, y, z, w = 0.9, h = 1.4, o = {}) {
  const pg = k.grup('pencere', p); pg.position.set(x, y, z); if (o.ry) pg.rotation.y = o.ry;
  const cer = k.mat(o.cerceve || '#f7f2e8', { roughness: 0.6 });
  k.at(k.rbox(w + 0.12, h + 0.12, 0.1, 0.03, cer), 0, 0, 0, pg);
  k.at(k.box(w, h, 0.05, o.gece ? k.isik('#ffd27a', 0.9) : k.cam('#3b5568', { opacity: 0.85 })), 0, 0, 0.03, pg);
  k.at(k.box(0.05, h, 0.06, cer), 0, 0, 0.05, pg); k.at(k.box(w, 0.05, 0.06, cer), 0, h * 0.18, 0.05, pg);
  k.at(k.rbox(w + 0.26, 0.08, 0.2, 0.02, k.mat('#e8e0d0')), 0, -h / 2 - 0.08, 0.08, pg);
  if (o.panjur) { const pm = k.mat(o.panjur, { roughness: 0.7, map: k.paint(32, 64, (c, W, H) => { c.fillStyle = o.panjur; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < H; i += 6) c.fillRect(0, i, W, 2); }) }); for (const s of [-1, 1]) { const pn = k.at(k.box(w / 2, h, 0.04, pm), s * (w * 0.75 + 0.06), 0, 0.06, pg); pn.rotation.y = s * 0.15; } }
  if (o.saksi) { k.at(k.box(w, 0.18, 0.2, k.mat('#c8693e')), 0, -h / 2 + 0.02, 0.2, pg); for (let i = 0; i < 4; i++) k.at(k.sph(0.09, k.mat(['#e0533c', '#f2a2b3', '#ffd23f', '#e0533c'][i])), -w / 2 + 0.15 + i * (w - 0.3) / 3, -h / 2 + 0.17, 0.22, pg); }
  return pg;
}
function tente(k, p, w, y, z, renk = '#d8433a') {
  const m = k.dmat(256, 64, (c, W, H) => { for (let x = 0; x < W; x += 32) { c.fillStyle = (x / 32) % 2 ? '#fbfaf6' : renk; c.fillRect(x, 0, 32, H); } c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(0, H - 6, W, 6); }, { side: T.DoubleSide, roughness: 0.9 }, [w / 1.5, 1]);
  const t = k.at(k.box(w, 0.04, 1.1, m), 0, y, z + 0.5, p); t.rotation.x = 0.38;
  const etek = k.dmat(256, 32, (c, W, H) => { for (let x = 0; x < W; x += 32) { c.fillStyle = (x / 32) % 2 ? '#fbfaf6' : renk; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 32, 0); c.lineTo(x + 32, H * 0.6); c.quadraticCurveTo(x + 16, H, x, H * 0.6); c.fill(); } }, { transparent: true, alphaTest: 0.3, side: T.DoubleSide }, [w / 1.5, 1]);
  k.at(k.plane(w, 0.22, etek), 0, y - 0.3, z + 1.02, p);
}
function tabela(k, p, ad, w, y, z, renk = '#2e4a6b') {
  const m = k.dmat(512, 96, (c, W, H) => { c.fillStyle = renk; rrect(c, 0, 0, W, H, 12); c.fill(); c.strokeStyle = '#f2b632'; c.lineWidth = 5; rrect(c, 6, 6, W - 12, H - 12, 9); c.stroke(); yazi(c, ad, W / 2, H / 2 + 3, { font: '900 52px system-ui', renk: '#fff6e6', max: W - 40 }); }, { emissive: '#ffffff', emissiveIntensity: 0.08 });
  k.at(k.rbox(w, w * 96 / 512, 0.08, 0.02, m), 0, y, z, p);
}

/** Cumbalı İstanbul apartmanı */
export function apartman(k, o = {}, R = rng(o.tohum || 7)) {
  const kat = o.kat || 4, W = 8, D = 7, KH = 3;
  const renk = o.renk || R.pick(PASTEL), ad = o.dukkan || R.pick(DUKKAN_ADLARI), gece = !!o.gece;
  const g = k.grup('apartman');
  const siva = sivaMat(k, renk, R.int(1, 99)), taban = sivaMat(k, '#d8d0c2', 5), korniş = k.mat('#f7f2e8', { roughness: 0.6 });
  k.at(k.box(W, KH * kat, D, siva), 0, KH * kat / 2, 0, g);
  k.at(k.box(W + 0.05, KH, D + 0.05, taban), 0, KH / 2, 0, g);
  for (let i = 1; i <= kat; i++) k.at(k.rbox(W + 0.3, 0.18, D + 0.3, 0.04, korniş), 0, i * KH, 0, g);
  k.at(k.rbox(W + 0.6, 0.3, D + 0.6, 0.06, korniş), 0, kat * KH + 0.15, 0, g);
  catı(k, g, W + 0.8, D + 0.8, 2.2, kat * KH + 0.3, kiremit(k));
  k.at(k.rbox(0.6, 1.2, 0.6, 0.05, sivaMat(k, '#b9a48a', 3)), 2.2, kat * KH + 2.0, -1.5, g); // baca
  // zemin: dükkan
  const vit = k.cam('#2c4352', { opacity: 0.7 });
  k.at(k.box(5.2, 2.0, 0.08, gece ? k.isik('#ffe2a0', 0.7) : vit), -0.9, 1.15, D / 2 + 0.01, g);
  k.at(k.rbox(1.1, 2.2, 0.12, 0.03, k.mat('#5a3a24', { roughness: 0.5 })), 2.6, 1.1, D / 2 + 0.02, g);
  k.at(k.sph(0.05, k.mat('#f2b632', { metalness: 0.8 })), 2.25, 1.1, D / 2 + 0.1, g);
  tente(k, g, 5.6, 2.45, D / 2, R.pick(['#d8433a', '#2f8f9a', '#49b96a', '#f08a3c']));
  tabela(k, g, ad, 4.6, 2.75, D / 2 + 0.06);
  // üst katlar
  const panjur = R.pick(['#5b7f6b', '#7d5638', '#3f6f9a', null]);
  for (let i = 1; i < kat; i++) {
    const y = i * KH + 1.5;
    for (const x of [-2.8, 2.8]) pencere(k, g, x, y, D / 2 + 0.02, 1.0, 1.5, { panjur, saksi: R.chance(0.3), gece: gece && R.chance(0.5) });
    for (const z of [-1.8, 1.8]) for (const s of [-1, 1]) pencere(k, g, s * (W / 2 + 0.02), y, z, 0.9, 1.4, { ry: s * Math.PI / 2, gece: gece && R.chance(0.4) });
    // cumba (orta çıkma)
    const c = k.grup('cumba', g); c.position.set(0, y - 0.1, D / 2);
    k.at(k.box(2.6, 2.6, 0.9, siva), 0, 0, 0.45, c);
    k.at(k.rbox(2.8, 0.14, 1.1, 0.03, korniş), 0, -1.35, 0.5, c); k.at(k.rbox(2.8, 0.14, 1.1, 0.03, korniş), 0, 1.35, 0.5, c);
    pencere(k, c, 0, 0.1, 0.92, 1.4, 1.5, { gece: gece && R.chance(0.6) });
    for (const s of [-1, 1]) pencere(k, c, s * 1.31, 0.1, 0.45, 0.55, 1.4, { ry: s * Math.PI / 2 });
    for (const s of [-1, 1]) { const d = k.at(k.box(0.12, 0.6, 0.12, korniş), s * 1.1, -1.65, 0.75, c); d.rotation.x = 0.6; }
  }
  // balkon (en üst kat yanda)
  if (kat > 2) {
    const by = (kat - 1) * KH + 0.2, dem = k.mat('#2a2f36', { metalness: 0.5, roughness: 0.4 });
    k.at(k.rbox(2.2, 0.15, 1.0, 0.03, korniş), -2.8, by, D / 2 + 0.5, g);
    k.at(k.box(2.2, 0.04, 0.04, dem), -2.8, by + 0.95, D / 2 + 1.0, g);
    for (let i = 0; i <= 10; i++) k.at(k.box(0.025, 0.9, 0.025, dem), -3.9 + i * 0.22, by + 0.5, D / 2 + 1.0, g);
    for (const s of [-1, 1]) k.at(k.box(0.04, 0.9, 1.0, dem), -2.8 + s * 1.1, by + 0.5, D / 2 + 0.5, g);
  }
  g.userData.carpisma = { w: W, h: kat * KH, d: D };
  return g;
}

/** Ahşap İstanbul konağı */
export function ahsapEv(k, o = {}, R = rng(o.tohum || 3)) {
  const g = k.grup('ahsap-ev'); const W = 7, D = 6.5, renk = o.renk || R.pick(['#c98a4b', '#9c4a36', '#7f93a3', '#d9b46a', '#8a9a6b']);
  const tahta = k.dmat(256, 256, (c, w, h) => { c.fillStyle = renk; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, y + 13, w, 3); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(0, y, w, 3); } gren(c, w, h, 'rgba(60,30,10,.25)', 500, 1.4, 21); }, { roughness: 0.85 }, [3, 4]);
  const beyaz = k.mat('#f4efe4', { roughness: 0.6 }), tas = sivaMat(k, '#bdb2a1', 8);
  k.at(k.box(W, 0.8, D, tas), 0, 0.4, 0, g);
  k.at(k.box(W, 3.0, D, tahta), 0, 2.3, 0, g);
  k.at(k.box(W + 0.8, 3.0, D, tahta), 0, 5.3, 0.4, g); // çıkmalı üst kat
  for (const y of [0.8, 3.8, 6.8]) k.at(k.rbox(W + (y > 1 ? 1.0 : 0.2), 0.16, D + 0.9, 0.03, beyaz), 0, y, 0.3, g);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const d = k.at(k.box(0.14, 0.9, 0.14, beyaz), s * (W / 2 + 0.1), 3.5, D / 2 - 0.4 - i * 2.2, g); d.rotation.z = s * -0.6; }
  catı(k, g, W + 2, D + 2.2, 2.4, 6.85, kiremit(k));
  k.at(k.rbox(1.2, 2.2, 0.15, 0.03, k.mat('#4a2e1c', { roughness: 0.5 })), 0, 1.9, D / 2 + 0.03, g);
  k.at(k.rbox(1.6, 0.25, 0.7, 0.04, tas), 0, 0.92, D / 2 + 0.35, g);
  for (const x of [-2.4, 2.4]) pencere(k, g, x, 2.4, D / 2 + 0.02, 0.85, 1.5, { cerceve: '#f4efe4', panjur: '#5b7f6b' });
  for (const x of [-2.6, 0, 2.6]) pencere(k, g, x, 5.4, D / 2 + 0.42, 0.85, 1.6, { cerceve: '#f4efe4', saksi: x === 0 });
  for (const s of [-1, 1]) for (const z of [-1.5, 1.5]) pencere(k, g, s * (W / 2 + 0.42), 5.4, z, 0.8, 1.5, { ry: s * Math.PI / 2, cerceve: '#f4efe4' });
  g.userData.carpisma = { w: W + 0.8, h: 9.2, d: D + 0.8 };
  return g;
}

/** Tek katlı mahalle dükkanı: firin | manav | berber | bakkal */
export function dukkan(k, o = {}) {
  const tur = o.tur || 'firin';
  const g = k.grup('dukkan-' + tur); const W = 5, D = 4.5, H = 3.4;
  const bilgi = { firin: ['BOĞAZ FIRINI', '#c98a4b', '#7d5638'], manav: ['TAZE MANAV', '#9bc46a', '#2f8a4a'], berber: ['MARTI BERBER', '#a9c4d6', '#1f3a66'], bakkal: ['KARDEŞLER BAKKAL', '#e6d7a6', '#b5361e'] }[tur];
  k.at(k.box(W, H, D, sivaMat(k, bilgi[1], 13)), 0, H / 2, 0, g);
  k.at(k.rbox(W + 0.3, 0.3, D + 0.3, 0.05, k.mat('#f7f2e8')), 0, H + 0.15, 0, g);
  k.at(k.box(3.2, 2.0, 0.06, k.cam('#2c4352', { opacity: 0.6 })), -0.7, 1.25, D / 2 + 0.01, g);
  k.at(k.rbox(1.0, 2.2, 0.1, 0.03, k.mat('#3b2a1e')), 1.75, 1.1, D / 2 + 0.02, g);
  tente(k, g, 4.2, 2.6, D / 2, bilgi[2]); tabela(k, g, bilgi[0], 4.2, 3.0, D / 2 + 0.05, bilgi[2]);
  if (tur === 'manav') {
    const kasa = k.mat('#c49a6c', { roughness: 0.9 });
    const meyve = [['#e0533c', 0.1], ['#f08a3c', 0.1], ['#9bd36a', 0.09], ['#ffd23f', 0.08], ['#7a2d5a', 0.09]];
    meyve.forEach(([c, r], i) => { const x = -2 + i * 0.85; k.at(k.box(0.75, 0.3, 0.55, kasa), x, 0.45, D / 2 + 0.6, g); for (let j = 0; j < 9; j++) k.at(k.sph(r, k.mat(c, { roughness: 0.4 }), 10, 8), x - 0.22 + (j % 3) * 0.22, 0.68, D / 2 + 0.45 + Math.floor(j / 3) * 0.15, g); k.at(k.box(0.06, 0.6, 0.55, kasa), x, 0.3, D / 2 + 0.6, g).visible = false; });
    k.at(k.box(4.4, 0.3, 0.6, k.mat('#7d5638')), -0.3, 0.15, D / 2 + 0.6, g);
  } else if (tur === 'berber') {
    const dir = k.dmat(64, 256, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); for (let y = -h; y < h * 2; y += 48) { c.fillStyle = '#d8433a'; c.beginPath(); c.moveTo(0, y); c.lineTo(w, y + 32); c.lineTo(w, y + 48); c.lineTo(0, y + 16); c.fill(); c.fillStyle = '#1f3a66'; c.beginPath(); c.moveTo(0, y + 24); c.lineTo(w, y + 56); c.lineTo(w, y + 64); c.lineTo(0, y + 32); c.fill(); } });
    const d = k.at(k.cyl(0.12, 0.12, 0.9, dir, 16), 2.45, 2.0, D / 2 + 0.2, g); d.userData.hareket = true; d.name = 'berber-diregi';
    g.userData.parca = { direk: d };
  } else if (tur === 'firin') {
    for (let i = 0; i < 6; i++) { const e = k.at(k.kapsul(0.08, 0.35, k.mat('#c98a4b', { roughness: 0.7 })), -1.8 + i * 0.45, 0.9, D / 2 - 0.1, g); e.rotation.z = Math.PI / 2; }
    k.at(k.box(3.0, 0.08, 0.5, k.mat('#a8774f')), -0.7, 0.78, D / 2 - 0.1, g);
  } else {
    k.at(k.rbox(0.7, 1.4, 0.6, 0.06, k.mat('#d8433a')), -2.0, 0.7, D / 2 + 0.45, g);
    k.at(k.box(0.6, 0.9, 0.04, k.cam('#ddeef5', { opacity: 0.4 })), -2.0, 0.85, D / 2 + 0.76, g);
    for (let i = 0; i < 6; i++) k.at(k.cyl(0.04, 0.04, 0.22, k.mat(['#e0533c', '#49b96a', '#f2b632'][i % 3]), 10), -2.2 + (i % 3) * 0.2, 0.6 + Math.floor(i / 3) * 0.4, D / 2 + 0.6, g);
  }
  g.userData.carpisma = { w: W, h: H, d: D };
  return g;
}

/** Otobüs durağı (yol kenarına konur, otobüse yoldan binilir) */
export function durak(k, o = {}) {
  const { hat = '42B', yon = 'BELGRAD ORMANI' } = o;
  const g = k.grup('durak'); const metal = k.mat('#2a2f36', { metalness: 0.5, roughness: 0.35 });
  for (const x of [-1.6, 1.6]) for (const z of [-0.6]) k.at(k.box(0.08, 2.6, 0.08, metal), x, 1.3, z, g);
  for (const x of [-1.6, 1.6]) k.at(k.box(0.08, 2.6, 0.08, metal), x, 1.3, 0.6, g);
  k.at(k.rbox(3.6, 0.12, 1.6, 0.04, k.mat('#e8742c')), 0, 2.65, 0, g);
  k.at(k.box(3.2, 2.0, 0.03, k.cam('#d8eef5', { opacity: 0.3 })), 0, 1.3, -0.6, g);
  k.at(k.box(0.03, 2.0, 1.1, k.cam('#d8eef5', { opacity: 0.3 })), -1.6, 1.3, 0, g);
  k.at(k.rbox(2.6, 0.08, 0.4, 0.02, k.mat('#a8774f')), 0, 0.5, -0.35, g);
  for (const x of [-1.1, 1.1]) k.at(k.box(0.06, 0.45, 0.06, metal), x, 0.25, -0.35, g);
  const afis = k.dmat(256, 384, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#49b0d6'); gr.addColorStop(1, '#2f6db5'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, 150, 70, 0, 7); c.fill(); c.fillStyle = '#e0533c'; c.beginPath(); c.arc(w / 2, 150, 50, 0, 7); c.fill(); yazi(c, 'BOĞAZ', w / 2, 270, { font: '900 44px system-ui' }); yazi(c, 'GAZOZU', w / 2, 320, { font: '900 44px system-ui', renk: '#ffd23f' }); }, { emissive: '#ffffff', emissiveIntensity: 0.2 });
  k.at(k.box(1.0, 1.5, 0.05, afis), 1.0, 1.35, -0.57, g);
  const lev = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, 124, 0, 7); c.fill(); c.fillStyle = '#2f8f9a'; c.beginPath(); c.arc(w / 2, h / 2, 110, 0, 7); c.fill(); yazi(c, 'DURAK', w / 2, 92, { font: '900 40px system-ui' }); yazi(c, hat, w / 2, 150, { font: '900 64px system-ui', renk: '#ffd23f' }); yazi(c, yon, w / 2, 200, { font: '800 20px system-ui', max: 190 }); });
  k.at(k.cyl(0.04, 0.04, 2.8, metal), 2.2, 1.4, 0.6, g);
  const l = k.at(k.cyl(0.4, 0.4, 0.04, lev, 28), 2.2, 2.9, 0.6, g); l.rotation.x = Math.PI / 2;
  g.userData.carpisma = { w: 3.6, h: 2.7, d: 1.6 };
  return g;
}

/** Martı Kulesi: semtin simgesi taş kule */
export function kule(k) {
  const g = k.grup('marti-kulesi');
  const tas = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#c9bca6'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 20) for (let x = ((y / 20) % 2) * 24; x < w; x += 48) { c.fillStyle = ton('#c9bca6', ((x * 7 + y) % 13) / 100 - 0.06); rrect(c, x + 1, y + 1, 46, 18, 3); c.fill(); } }, { roughness: 0.95 }, [6, 8]);
  k.at(k.cyl(3.2, 3.6, 18, tas, 28), 0, 9, 0, g);
  k.at(k.cyl(3.7, 3.7, 0.5, k.mat('#e8e0d0'), 28), 0, 18.2, 0, g);
  k.at(k.cyl(3.3, 3.3, 2.4, k.mat('#f4efe4'), 28), 0, 19.6, 0, g);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = k.at(k.rbox(0.9, 1.6, 0.1, 0.05, k.cam('#3b5568', { opacity: 0.9 })), Math.sin(a) * 3.31, 19.6, Math.cos(a) * 3.31, g); p.rotation.y = a; }
  k.at(k.cyl(4.0, 4.0, 0.2, k.mat('#2a2f36', { metalness: 0.4 }), 28), 0, 18.5, 0, g);
  k.at(k.cone(3.7, 6, k.mat('#3f5560', { roughness: 0.4, metalness: 0.3 }), 28), 0, 23.8, 0, g);
  k.at(k.sph(0.25, k.mat('#f2b632', { metalness: 0.8, roughness: 0.25 })), 0, 27, 0, g);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + j * 0.5; const p = k.at(k.rbox(0.7, 1.3, 0.12, 0.2, k.mat('#2c3b47', { roughness: 0.3 })), Math.sin(a) * 3.3, 4 + j * 3.4, Math.cos(a) * 3.3, g); p.rotation.y = a; }
  k.at(k.rbox(1.6, 2.6, 0.3, 0.3, k.mat('#4a2e1c')), 0, 1.3, 3.5, g);
  g.userData.carpisma = { w: 7.2, h: 27, d: 7.2 };
  return g;
}
