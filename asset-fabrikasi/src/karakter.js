/**
 * Karakter üretici: gövde, yüz, saç, sakal/bıyık, kıyafet, ayakkabı, şapka, aksesuar.
 * Boy ~1.75 m, sevimli büyük kafa. Parçalar: kolL kolR bacakL bacakR bas govde (yuru() ile oynat).
 */
import { T, rrect, yazi, ton, gren } from './kit.js';

export const TENLER = ['#f6d3b3', '#eec19a', '#d9a477', '#c08a5c', '#9a6741', '#6e4a30'];
export const SAC_RENK = ['#2b2321', '#4a3426', '#6b4a2f', '#a8743f', '#d6b26a', '#b34a2a', '#8c8c8c', '#e9e5df'];
export const SACLAR = ['kisa', 'kivircik', 'uzun', 'topuz', 'atkuyrugu', 'kel', 'yan_kel', 'mohikan', 'percem', 'kazinmis'];
export const SAKALLAR = ['yok', 'pala', 'ince_biyik', 'keci', 'sakal', 'favori'];
export const USTLER = ['tisort', 'gomlek', 'onluk', 'ceket', 'esofman', 'forma', 'kazak', 'atlet'];
export const ALTLAR = ['pantolon', 'kot', 'sort', 'esofman_alt'];
export const AYAKKABILAR = ['spor', 'kundura', 'terlik'];
export const SAPKALAR = ['yok', 'kasket', 'bere', 'asci', 'fes', 'simit_tablasi', 'kask', 'beyzbol', 'balikci'];
export const AKSESUAR = ['yok', 'gozluk', 'gunes_gozlugu'];
export const GOZLER = ['yuvarlak', 'uykulu', 'mutlu', 'kocaman'];
export const AGIZLAR = ['gulumse', 'kahkaha', 'duz', 'sasirmis'];
export const TAKIMLAR = [
  { ad: 'MARTISPOR', a: '#2fb3b0', b: '#ffffff' }, { ad: 'SİMİTGÜCÜ', a: '#c8372d', b: '#f2b632' },
  { ad: 'VAPURSPOR', a: '#1f3a66', b: '#f08a3c' }, { ad: 'ÇAYIRSPOR', a: '#2f8a4a', b: '#f4f1ea' },
];

/** Hazır esnaf/karakter tarifleri */
export const HAZIR = {
  sabri: { ten: '#eec19a', sac: 'kisa', sacRenk: '#2b2321', sakal: 'pala', ust: 'onluk', ustRenk: '#ffffff', onlukYazi: 'SABRİ', alt: 'pantolon', altRenk: '#3b4252', govdeTip: 'iri', sapka: 'yok' },
  simitci: { ten: '#d9a477', sac: 'kisa', sacRenk: '#4a3426', sakal: 'ince_biyik', ust: 'gomlek', ustRenk: '#f4efe4', alt: 'pantolon', altRenk: '#6b5a48', sapka: 'simit_tablasi', ayakkabi: 'kundura' },
  teyze: { ten: '#f6d3b3', sac: 'topuz', sacRenk: '#8c8c8c', ust: 'kazak', ustRenk: '#b85a7a', alt: 'pantolon', altRenk: '#4b3b5c', aksesuar: 'gozluk', govdeTip: 'iri', boy: 0.92, ayakkabi: 'kundura' },
  kurye: { ten: '#c08a5c', sac: 'kazinmis', sacRenk: '#2b2321', ust: 'tisort', ustRenk: '#f0c419', baski: 'PAKET KUŞ', alt: 'esofman_alt', altRenk: '#2a2f3a', sapka: 'kask' },
  balikci: { ten: '#c08a5c', sac: 'yan_kel', sacRenk: '#8c8c8c', sakal: 'sakal', ust: 'kazak', ustRenk: '#2e4a6b', alt: 'pantolon', altRenk: '#5b4a36', sapka: 'balikci', govdeTip: 'iri' },
  turist: { ten: '#f6d3b3', sac: 'percem', sacRenk: '#d6b26a', ust: 'gomlek', ustRenk: '#4fb0d6', desen: 'cicek', alt: 'sort', altRenk: '#d8c7a0', aksesuar: 'gunes_gozlugu', sapka: 'beyzbol', ayakkabi: 'terlik' },
  ogrenci: { ten: '#eec19a', sac: 'atkuyrugu', sacRenk: '#6b4a2f', ust: 'esofman', ustRenk: '#7b5cc4', alt: 'kot', altRenk: '#3d5a8a', govdeTip: 'ince', boy: 0.95 },
  taraftar: { ten: '#d9a477', sac: 'mohikan', sacRenk: '#2b2321', ust: 'forma', takim: 0, alt: 'sort', altRenk: '#ffffff', agiz: 'kahkaha', ayakkabi: 'spor' },
  asci: { ten: '#eec19a', sac: 'kisa', sacRenk: '#2b2321', sakal: 'keci', ust: 'onluk', ustRenk: '#ffffff', onlukYazi: 'USTA', alt: 'pantolon', altRenk: '#2a2a2a', sapka: 'asci' },
  dede: { ten: '#eec19a', sac: 'yan_kel', sacRenk: '#e9e5df', sakal: 'pala', ust: 'ceket', ustRenk: '#6b5a48', alt: 'pantolon', altRenk: '#4a4038', sapka: 'kasket', aksesuar: 'gozluk', boy: 0.93, agiz: 'gulumse', goz: 'uykulu' },
};

export function rastgeleKarakter(R) {
  const p = R.pick;
  return {
    ten: p(TENLER), sac: p(SACLAR), sacRenk: p(SAC_RENK), sakal: R.chance(0.45) ? p(SAKALLAR) : 'yok',
    ust: p(USTLER), ustRenk: ton(p(['#e0533c', '#3f8fc9', '#49b96a', '#f2b632', '#8a6bbf', '#f4efe4', '#2e4a6b', '#f08a3c']), R.range(-0.08, 0.08)),
    alt: p(ALTLAR), altRenk: p(['#3b4252', '#3d5a8a', '#6b5a48', '#2a2f3a', '#d8c7a0', '#5b6b3a']),
    ayakkabi: p(AYAKKABILAR), sapka: R.chance(0.4) ? p(SAPKALAR) : 'yok', aksesuar: R.chance(0.25) ? p(AKSESUAR) : 'yok',
    goz: p(GOZLER), agiz: p(AGIZLAR), govdeTip: p(['ince', 'normal', 'normal', 'iri']), boy: R.range(0.9, 1.06), takim: R.int(0, 3),
  };
}

const BAS_Y = 1.5, BAS_R = 0.25;

function yuzDokusu(k, o) {
  return k.paint(512, 320, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const ey = h * 0.47, ex = w * 0.14, cx = w / 2;
    // allık
    g.fillStyle = 'rgba(240,110,110,.28)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * w * 0.22, ey + 46, 30, 16, 0, 0, 7); g.fill(); }
    // kaşlar
    g.strokeStyle = ton(o.sacRenk, -0.08); g.lineWidth = o.sakal === 'pala' ? 13 : 10; g.lineCap = 'round';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * (ex - 26), ey - 40 + (o.goz === 'uykulu' ? 6 : 0)); g.quadraticCurveTo(cx + s * ex, ey - 54, cx + s * (ex + 26), ey - 42); g.stroke(); }
    // gözler
    for (const s of [-1, 1]) {
      const x = cx + s * ex;
      if (o.goz === 'mutlu') { g.strokeStyle = '#2a211d'; g.lineWidth = 9; g.beginPath(); g.arc(x, ey + 8, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); continue; }
      const r = o.goz === 'kocaman' ? 25 : 20;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, ey, r * 0.85, r, 0, 0, 7); g.fill();
      g.fillStyle = '#3a2a22'; g.beginPath(); g.ellipse(x + s * 2, ey + 3, r * 0.6, r * 0.72, 0, 0, 7); g.fill();
      g.fillStyle = '#120c0a'; g.beginPath(); g.arc(x + s * 2, ey + 4, r * 0.33, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 5, ey - 6, r * 0.24, 0, 7); g.fill(); g.beginPath(); g.arc(x + 6, ey + 8, r * 0.1, 0, 7); g.fill();
      if (o.goz === 'uykulu') { g.fillStyle = o.ten; g.fillRect(x - r, ey - r - 2, r * 2, r * 1.05); g.strokeStyle = '#2a211d'; g.lineWidth = 5; g.beginPath(); g.moveTo(x - r * 0.9, ey + 2); g.lineTo(x + r * 0.9, ey + 2); g.stroke(); }
    }
    // ağız
    const my = h * 0.79;
    g.strokeStyle = '#6b2a22'; g.fillStyle = '#7a2b25'; g.lineWidth = 7; g.lineCap = 'round';
    if (o.agiz === 'kahkaha') { g.beginPath(); g.moveTo(cx - 34, my - 8); g.quadraticCurveTo(cx, my + 44, cx + 34, my - 8); g.closePath(); g.fill(); g.fillStyle = '#e9767a'; g.beginPath(); g.ellipse(cx, my + 14, 16, 8, 0, 0, 7); g.fill(); }
    else if (o.agiz === 'duz') { g.beginPath(); g.moveTo(cx - 20, my); g.lineTo(cx + 20, my); g.stroke(); }
    else if (o.agiz === 'sasirmis') { g.beginPath(); g.ellipse(cx, my + 4, 12, 16, 0, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(cx - 28, my - 6); g.quadraticCurveTo(cx, my + 20, cx + 28, my - 6); g.stroke(); }
  });
}

function kumasDokusu(k, o) {
  const renk = o.ustRenk;
  if (o.ust === 'forma') {
    const t = TAKIMLAR[o.takim || 0];
    return k.paint(256, 256, (g, w, h) => {
      g.fillStyle = t.b; g.fillRect(0, 0, w, h); g.fillStyle = t.a;
      for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
      g.fillStyle = 'rgba(255,255,255,.92)'; rrect(g, 64, 70, 128, 50, 10); g.fill();
      yazi(g, t.ad, 128, 96, { font: '900 26px system-ui', renk: t.a, max: 120 });
    });
  }
  return k.paint(256, 256, (g, w, h) => {
    g.fillStyle = renk; g.fillRect(0, 0, w, h);
    if (o.ust === 'kazak') { g.strokeStyle = ton(renk, -0.07); g.lineWidth = 4; for (let x = 6; x < w; x += 14) for (let y = 0; y < h; y += 14) { g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x, y + 7); g.lineTo(x + 4, y); g.stroke(); } }
    if (o.desen === 'cicek') { const cs = ['#ffe66d', '#ff6f91', '#ffffff']; for (let i = 0; i < 26; i++) { g.fillStyle = cs[i % 3]; const x = (i * 71) % w, y = (i * 113) % h; for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(x + Math.cos(a * 1.26) * 8, y + Math.sin(a * 1.26) * 8, 6, 0, 7); g.fill(); } } }
    if (o.ust === 'gomlek') { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(w / 2 - 2, 0, 4, h); g.fillStyle = '#f7f2e8'; for (let y = 40; y < h; y += 50) { g.beginPath(); g.arc(w / 2 + 10, y, 6, 0, 7); g.fill(); } }
    if (o.ust === 'esofman') { g.fillStyle = '#fff'; g.fillRect(w / 2 - 3, 0, 6, h); g.fillRect(0, 30, w, 10); }
    if (o.baski) { g.fillStyle = 'rgba(0,0,0,.85)'; rrect(g, 40, 70, 176, 70, 14); g.fill(); yazi(g, o.baski, 128, 106, { font: '900 30px system-ui', renk: renk, max: 160 }); }
    gren(g, w, h, 'rgba(0,0,0,.25)', 300, 1.2, 9);
  });
}

export function karakter(k, sec = {}) {
  const o = { ...HAZIR.sabri, sakal: 'yok', onlukYazi: '', baski: '', desen: '', aksesuar: 'yok', sapka: 'yok', goz: 'yuvarlak', agiz: 'gulumse', govdeTip: 'normal', boy: 1, ayakkabi: 'spor', takim: 0, ...sec };
  const g = k.grup('karakter');
  const kok = k.grup('olcek', g); kok.scale.setScalar(o.boy);
  const ten = k.mat(o.ten, { roughness: 0.55 });
  const tenK = k.mat(ton(o.ten, -0.05), { roughness: 0.55 });
  const sacM = k.mat(o.sacRenk, { roughness: 0.8 });
  const kumas = k.mat('#ffffff', { map: kumasDokusu(k, o), roughness: 0.85 });
  const kolKumas = k.mat(o.ust === 'forma' ? TAKIMLAR[o.takim].a : o.ustRenk, { roughness: 0.85 });
  const altM = k.mat(o.alt === 'kot' ? o.altRenk : o.altRenk, { roughness: 0.85, map: o.alt === 'kot' ? k.paint(64, 64, (c, w, h) => { c.fillStyle = o.altRenk; c.fillRect(0, 0, w, h); gren(c, w, h, 'rgba(255,255,255,.35)', 220, 1, 5); }) : null });
  const gw = { ince: 0.38, normal: 0.44, iri: 0.52 }[o.govdeTip] || 0.44;

  // gövde
  const govde = k.grup('govde', kok); govde.userData.hareket = true;
  const ustM = o.ust === 'atlet' ? kolKumas : kumas;
  k.at(k.rbox(gw, 0.52, 0.27, 0.11, ustM), 0, 0.95, 0, govde);
  if (o.govdeTip === 'iri') { const gb = k.at(k.sph(0.2, ustM), 0, 0.86, 0.06, govde); gb.scale.set(gw * 2.1, 1.05, 0.85); }
  k.at(k.rbox(gw + 0.01, 0.1, 0.28, 0.04, k.mat(ton(o.altRenk, -0.06))), 0, 0.71, 0, govde); // bel
  k.at(k.cyl(0.07, 0.08, 0.12, ten), 0, 1.25, 0, govde);
  if (o.ust === 'gomlek' || o.ust === 'ceket') for (const s of [-1, 1]) { const y = k.at(k.extrude([[0, 0], [0.11, 0.02], [0.02, -0.09]], 0.02, k.mat(o.ust === 'ceket' ? '#f4efe4' : ton(o.ustRenk, 0.05))), s * 0.015, 1.2, 0.13, govde); y.scale.x = s; y.rotation.x = -0.25; }
  if (o.ust === 'ceket') for (const s of [-1, 1]) { const p = k.at(k.rbox(gw / 2 - 0.02, 0.5, 0.03, 0.02, kolKumas), s * (gw / 4 + 0.03), 0.96, 0.135, govde); p.rotation.z = s * -0.05; }
  if (o.ust === 'ceket') govde.children[0].material = k.mat('#f4efe4', { roughness: 0.85 });
  if (o.ust === 'onluk') {
    const onluk = k.dmat(256, 384, (c, w, h) => {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#d8433a'; c.fillRect(0, h * 0.42, w, 10);
      rrect(c, 60, h * 0.55, w - 120, 90, 12); c.fillStyle = 'rgba(0,0,0,.08)'; c.fill();
      if (o.onlukYazi) yazi(c, o.onlukYazi, w / 2, h * 0.3, { font: '900 54px system-ui', renk: '#d8433a', max: w - 30 });
      gren(c, w, h, 'rgba(0,0,0,.2)', 200, 1.2, 4);
    }, { roughness: 0.9, side: T.DoubleSide });
    k.at(k.rbox(gw * 0.78, 0.7, 0.02, 0.01, onluk), 0, 0.78, 0.15 + (o.govdeTip === 'iri' ? 0.1 : 0), govde).rotation.x = o.govdeTip === 'iri' ? -0.12 : 0;
    k.at(k.torus(0.13, 0.01, k.mat('#fbfaf6'), 6, 16, Math.PI), 0, 1.13, 0.0, govde).rotation.x = -0.2;
  }

  // kollar
  const parca = { govde };
  const uzunKol = ['gomlek', 'ceket', 'esofman', 'kazak'].includes(o.ust);
  for (const s of [-1, 1]) {
    const piv = k.grup(s < 0 ? 'kolL' : 'kolR', govde); piv.position.set(s * (gw / 2 + 0.06), 1.15, 0); piv.userData.hareket = true;
    k.at(k.sph(0.075, o.ust === 'atlet' ? ten : kolKumas), 0, 0, 0, piv);
    k.at(k.kapsul(0.06, 0.4, ten), 0, -0.26, 0, piv);
    if (o.ust !== 'atlet') k.at(k.cyl(0.075, 0.07, uzunKol ? 0.44 : 0.16, kolKumas), 0, uzunKol ? -0.24 : -0.08, 0, piv);
    if (o.ust === 'esofman') k.at(k.cyl(0.077, 0.072, 0.44, k.mat('#ffffff')), s * 0.012, -0.24, 0, piv).scale.set(0.3, 1, 1.01);
    k.at(k.sph(0.07, ten), 0, -0.52, 0.01, piv).scale.set(1, 1.1, 0.85);
    piv.rotation.z = s * 0.08;
    parca[s < 0 ? 'kolL' : 'kolR'] = piv;
  }

  // bacaklar
  for (const s of [-1, 1]) {
    const piv = k.grup(s < 0 ? 'bacakL' : 'bacakR', kok); piv.position.set(s * 0.11, 0.72, 0); piv.userData.hareket = true;
    if (o.alt === 'sort') { k.at(k.cyl(0.1, 0.1, 0.3, altM), 0, -0.12, 0, piv); k.at(k.kapsul(0.075, 0.32, ten), 0, -0.4, 0, piv); }
    else { k.at(k.kapsul(0.09, 0.5, altM), 0, -0.32, 0, piv); if (o.alt === 'esofman_alt') k.at(k.cyl(0.092, 0.092, 0.55, k.mat('#ffffff')), s * 0.02, -0.33, 0, piv).scale.set(0.25, 1, 1.01); }
    if (o.ayakkabi === 'terlik') { k.at(k.rbox(0.15, 0.03, 0.27, 0.012, k.mat('#2a6fb5')), 0, -0.705, 0.04, piv); k.at(k.rbox(0.11, 0.06, 0.22, 0.03, ten), 0, -0.67, 0.04, piv); k.at(k.box(0.15, 0.03, 0.05, k.mat('#2a6fb5')), 0, -0.66, 0.08, piv); }
    else {
      const ay = o.ayakkabi === 'kundura' ? k.mat('#5a3a24', { roughness: 0.35 }) : k.mat('#f4f4f2');
      k.at(k.rbox(0.15, 0.11, 0.27, 0.05, ay), 0, -0.66, 0.04, piv);
      if (o.ayakkabi === 'spor') { k.at(k.rbox(0.155, 0.035, 0.28, 0.015, k.mat('#d8433a')), 0, -0.7, 0.04, piv); }
    }
    parca[s < 0 ? 'bacakL' : 'bacakR'] = piv;
  }

  // kafa
  const bas = k.grup('bas', kok); bas.position.set(0, BAS_Y, 0); bas.userData.hareket = true; parca.bas = bas;
  const kafa = k.at(k.sph(BAS_R, ten, 28, 20), 0, 0, 0, bas); kafa.scale.set(1, 1.02, 0.96);
  const yuz = k.mat('#ffffff', { map: yuzDokusu(k, o), transparent: true, alphaTest: 0.35, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 });
  const yz = k.at(k.kup(BAS_R + 0.004, yuz, Math.PI / 2 - 0.9, 1.8, 1.0, 1.15), 0, 0, 0, bas); yz.scale.copy(kafa.scale); yz.castShadow = false;
  k.at(k.sph(0.04, tenK), 0, -0.02, BAS_R - 0.005, bas).scale.set(1, 0.85, 0.9);
  for (const s of [-1, 1]) k.at(k.sph(0.055, tenK), s * BAS_R * 0.98, -0.01, -0.01, bas).scale.set(0.5, 1, 0.8);

  sacYap(k, bas, o, sacM);
  sakalYap(k, bas, o, sacM);
  aksesuarYap(k, bas, o);
  sapkaYap(k, bas, o);

  g.userData.parca = parca;
  g.userData.tarif = o;
  return g;
}

function sacYap(k, bas, o, m) {
  const R = BAS_R + 0.012, sapkaVar = o.sapka !== 'yok';
  const tepe = (r = R, th = 1.15) => { const c = k.at(k.kup(r, m, 0, Math.PI * 2, 0, th), 0, 0.005, -0.012, bas); c.scale.set(1.02, 1.04, 1.0); return c; };
  const ense = (thS = 0, thL = 2.05) => k.at(k.kup(R, m, Math.PI / 2 + 0.75, Math.PI * 2 - 1.5, thS, thL), 0, 0, -0.005, bas);
  const kakul = (n = 5, boy = 0.07) => { for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 1.5; const t = k.at(k.sph(boy, m, 12, 8), Math.sin(a) * R * 0.92, 0.16, Math.cos(a) * R * 0.92 - 0.02, bas); t.scale.set(1.2, 0.7, 0.6); t.rotation.y = a; } };
  switch (o.sac) {
    case 'kel': return;
    case 'kazinmis': { const c = k.at(k.kup(BAS_R + 0.004, k.mat(ton(o.sacRenk, 0.12), { roughness: 0.95 }), 0, Math.PI * 2, 0, 1.2), 0, 0, 0, bas); c.scale.set(1, 1.02, 0.96); return; }
    case 'yan_kel': ense(0.95, 1.05); return;
    case 'kisa': tepe(); ense(); kakul(); return;
    case 'kivircik': tepe(R - 0.005, 1.25); ense(0, 1.9);
      for (let i = 0; i < 34; i++) { const th = 0.15 + (i % 6) * 0.22, ph = i * 2.399; const x = Math.sin(th) * Math.cos(ph), z = Math.sin(th) * Math.sin(ph); if (z > 0.55 && th > 0.75) continue; k.at(k.sph(0.065, m, 10, 8), x * R, Math.cos(th) * R + 0.01, z * R - 0.01, bas); }
      return;
    case 'uzun': tepe(); ense(0, 2.2); kakul(6, 0.075);
      k.at(k.rbox(0.46, 0.5, 0.12, 0.06, m), 0, -0.22, -0.14, bas);
      for (const s of [-1, 1]) k.at(k.rbox(0.09, 0.42, 0.14, 0.04, m), s * 0.235, -0.15, 0.0, bas);
      return;
    case 'topuz': tepe(); ense(); kakul(4, 0.06); if (!sapkaVar) k.at(k.sph(0.11, m), 0, 0.24, -0.12, bas); return;
    case 'atkuyrugu': tepe(); ense(); kakul(5, 0.065);
      k.at(k.torus(0.04, 0.018, k.mat('#e0533c')), 0, 0.06, -0.255, bas);
      { const p = k.at(k.kapsul(0.06, 0.26, m), 0, -0.12, -0.31, bas); p.rotation.x = 0.35; }
      return;
    case 'mohikan': ense(0.9, 1.15); if (!sapkaVar) for (let i = 0; i < 6; i++) { const a = -0.4 + i * 0.33; const c = k.at(k.cone(0.045, 0.16, m, 8), 0, Math.cos(a) * R + 0.04, Math.sin(a) * R, bas); c.rotation.x = a; } return;
    case 'percem': tepe(); ense();
      { const p = k.at(k.sph(0.13, m), 0.07, 0.18, 0.14, bas); p.scale.set(1.5, 0.65, 0.9); p.rotation.z = -0.4; }
      return;
  }
}

function sakalYap(k, bas, o, m) {
  const y = -0.07, z = BAS_R * 0.95;
  const biyikPala = () => { for (const s of [-1, 1]) k.at(k.tube([[0, y, z + 0.01], [s * 0.06, y - 0.005, z - 0.0], [s * 0.11, y - 0.04, z - 0.04], [s * 0.12, y - 0.08, z - 0.07]], 0.026, m, 16), 0, 0, 0, bas); };
  switch (o.sakal) {
    case 'pala': biyikPala(); return;
    case 'ince_biyik': { const b = k.at(k.kapsul(0.012, 0.12, m), 0, y + 0.005, z + 0.008, bas); b.rotation.z = Math.PI / 2; return; }
    case 'keci': { const b = k.at(k.kapsul(0.013, 0.1, m), 0, y + 0.005, z + 0.008, bas); b.rotation.z = Math.PI / 2; k.at(k.cone(0.045, 0.1, m, 10), 0, -0.25, 0.17, bas).rotation.x = Math.PI + 0.5; return; }
    case 'sakal': {
      const s = k.at(k.kup(BAS_R + 0.02, m, Math.PI / 2 - 1.2, 2.4, 1.95, 0.9), 0, 0, 0, bas); s.scale.set(1.02, 1.05, 1.02);
      k.at(k.sph(0.09, m), 0, -0.21, 0.13, bas).scale.set(1.3, 0.9, 0.9); biyikPala(); return;
    }
    case 'favori': for (const s of [-1, 1]) k.at(k.rbox(0.035, 0.12, 0.07, 0.015, m), s * 0.235, -0.02, 0.05, bas); return;
  }
}

function aksesuarYap(k, bas, o) {
  if (o.aksesuar === 'yok') return;
  const cer = k.mat(o.aksesuar === 'gozluk' ? '#5a3a24' : '#1c1c1c', { roughness: 0.3, metalness: 0.3 });
  const z = BAS_R + 0.02, y = 0.02;
  for (const s of [-1, 1]) {
    k.at(k.torus(0.05, 0.008, cer, 8, 24), s * 0.07, y, z, bas);
    if (o.aksesuar === 'gunes_gozlugu') k.at(k.cyl(0.05, 0.05, 0.005, k.mat('#1a2230', { roughness: 0.1, metalness: 0.6 }), 20), s * 0.07, y, z, bas).rotation.x = Math.PI / 2;
    const sap = k.at(k.box(0.008, 0.008, 0.2, cer), s * 0.12, y + 0.01, z - 0.11, bas); sap.rotation.y = s * 0.15;
  }
  k.at(k.box(0.05, 0.008, 0.008, cer), 0, y + 0.01, z + 0.005, bas);
}

function sapkaYap(k, bas, o) {
  const Y = BAS_R * 0.62;
  switch (o.sapka) {
    case 'yok': return;
    case 'kasket': { const m = k.mat('#6b5f52', { map: k.paint(64, 64, (c, w, h) => { c.fillStyle = '#6b5f52'; c.fillRect(0, 0, w, h); c.strokeStyle = '#5a4f44'; for (let i = 0; i < w; i += 6) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 20, h); c.stroke(); } }), roughness: 0.95 });
      const t = k.at(k.sph(0.27, m), 0, Y + 0.02, -0.01, bas); t.scale.set(1, 0.38, 1.05);
      k.at(k.cyl(0.2, 0.22, 0.02, m), 0, Y - 0.02, 0.14, bas).scale.set(1, 1, 0.6); return; }
    case 'bere': { const m = k.mat('#d8433a', { roughness: 1 }); k.at(k.kup(0.275, m, 0, Math.PI * 2, 0, 1.25), 0, 0.03, -0.01, bas); k.at(k.torus(0.235, 0.035, m, 8, 30), 0, 0.1, -0.005, bas).rotation.x = Math.PI / 2 - 0.12; k.at(k.sph(0.06, k.mat('#f4efe4', { roughness: 1 })), 0, 0.31, -0.02, bas); return; }
    case 'asci': { const m = k.mat('#ffffff', { roughness: 0.9 }); k.at(k.cyl(0.24, 0.235, 0.14, m, 24), 0, Y + 0.04, -0.01, bas); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; k.at(k.sph(0.12, m), Math.cos(a) * 0.13, Y + 0.2, Math.sin(a) * 0.13 - 0.01, bas); } k.at(k.sph(0.15, m), 0, Y + 0.24, -0.01, bas); return; }
    case 'fes': { const m = k.mat('#b5241f', { roughness: 0.8 }); k.at(k.cyl(0.17, 0.2, 0.24, m, 22), 0, Y + 0.12, -0.01, bas); k.at(k.tube([[0, Y + 0.24, -0.01], [0.08, Y + 0.22, -0.02], [0.17, Y + 0.08, -0.03]], 0.008, k.mat('#1c1c1c')), 0, 0, 0, bas); return; }
    case 'simit_tablasi': {
      const ah = k.mat('#a8774f', { roughness: 0.6 }); k.at(k.cyl(0.1, 0.12, 0.05, k.mat('#f4efe4')), 0, Y + 0.08, 0, bas);
      k.at(k.cyl(0.45, 0.45, 0.04, ah, 32), 0, Y + 0.13, 0, bas); k.at(k.torus(0.45, 0.02, ah, 6, 40), 0, Y + 0.15, 0, bas).rotation.x = Math.PI / 2;
      const sm = simitMat(k);
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = i % 3 === 0 ? 0.12 : 0.3; const s = k.at(k.torus(0.07, 0.03, sm, 10, 20), Math.cos(a) * r, Y + 0.18 + (i % 2) * 0.03, Math.sin(a) * r, bas); s.rotation.x = Math.PI / 2 + (i % 2 ? 0.15 : -0.1); }
      return;
    }
    case 'kask': { const m = k.mat('#f0c419', { roughness: 0.3 }); const t = k.at(k.kup(0.29, m, 0, Math.PI * 2, 0, 1.45), 0, 0.02, -0.02, bas); t.scale.set(1, 0.95, 1.08); k.at(k.box(0.03, 0.08, 0.3, k.mat('#2a2f3a')), 0, 0.27, -0.02, bas); return; }
    case 'beyzbol': { const m = k.mat('#e0533c', { roughness: 0.8 }); k.at(k.kup(0.27, m, 0, Math.PI * 2, 0, 1.3), 0, 0.02, -0.01, bas); const v = k.at(k.cyl(0.17, 0.17, 0.02, m, 20, false), 0, Y - 0.01, 0.24, bas); v.scale.set(1, 1, 0.7); v.rotation.x = 0.12; k.at(k.sph(0.025, m), 0, 0.29, 0, bas); return; }
    case 'balikci': { const m = k.mat('#c9b98a', { roughness: 1 }); k.at(k.cyl(0.21, 0.25, 0.16, m, 24), 0, Y + 0.05, -0.01, bas); k.at(k.cyl(0.36, 0.38, 0.02, m, 28), 0, Y - 0.03, -0.01, bas).rotation.x = 0.06; return; }
  }
}

export function simitMat(k) {
  return k.dmat(256, 64, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#b0602a'); gr.addColorStop(0.5, '#8a4520'); gr.addColorStop(1, '#c47a3c'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    const R = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(11);
    for (let i = 0; i < 700; i++) { c.fillStyle = R() > 0.3 ? '#f2dcae' : '#d9b77c'; c.save(); c.translate(R() * w, R() * h); c.rotate(R() * 3); c.beginPath(); c.ellipse(0, 0, 1.3, 0.9, 0, 0, 7); c.fill(); c.restore(); }
  }, { roughness: 0.75 });
}

/** Basit yürüme/bekleme animasyonu. hiz 0 = bekle */
export function yuru(g, t, hiz = 1) {
  const p = g.userData.parca; if (!p) return;
  const a = Math.sin(t * 7) * 0.55 * hiz;
  p.bacakL.rotation.x = a; p.bacakR.rotation.x = -a;
  p.kolL.rotation.x = -a * 0.8; p.kolR.rotation.x = a * 0.8;
  const nefes = Math.sin(t * 2) * 0.012;
  p.govde.position.y = Math.abs(Math.cos(t * 7)) * 0.03 * hiz + nefes;
  p.bas.position.y = 1.5 + p.govde.position.y; p.bas.rotation.z = Math.sin(t * 1.3) * 0.04 * (1 - hiz * 0.5);
}
