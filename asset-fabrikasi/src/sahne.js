/** Vitrin sokağı: katalogdan 60+ asset tek sahnede. Hareketsizler pişirilir, araçlar/insanlar oynar. */
import { T, rng, pisir, gren } from './kit.js';
import { uret, KR } from './katalog.js';

export function sokakSahnesi(k, { tohum = 1, gece = false } = {}) {
  const R = rng(tohum); const kok = k.grup('sokak'); const sabit = k.grup('sabit', kok);
  let adet = 0;
  const koy = (id, x, z, ry = 0, sec = {}, p = sabit, y = 0) => { const g = uret(k, id, { gece, ...sec }, R.int(1, 9999)); g.position.set(x, y, z); g.rotation.y = ry; p.add(g); adet++; return g; };
  // zemin, yol, kaldırım, deniz
  const asfalt = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#4a4e55'; c.fillRect(0, 0, w, h); gren(c, w, h, '#3a3d43', 1500, 1.5, 2); gren(c, w, h, '#62666d', 700, 1.2, 3); }, { roughness: 0.95 }, [30, 2]);
  k.at(k.box(140, 0.1, 8, asfalt), 0, 0.0, 0, sabit);
  for (let x = -68; x < 70; x += 6) k.at(k.box(3, 0.02, 0.18, k.mat('#f4f1ea')), x, 0.06, 0, sabit);
  const tas = k.dmat(256, 256, (c, w, h) => { c.fillStyle = '#cfc8be'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b3ab9f'; c.lineWidth = 3; for (let i = 0; i <= w; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } gren(c, w, h, '#a39b8f', 500, 1.4, 4); }, { roughness: 0.9 }, [70, 3]);
  for (const z of [-6.5, 6.5]) { k.at(k.box(140, 0.3, 5, tas), 0, 0.15, z, sabit); k.at(k.box(140, 0.32, 0.25, k.mat('#e8e2d6')), 0, 0.16, z - Math.sign(z) * 2.5, sabit); }
  k.at(k.box(140, 0.1, 30, k.mat('#8fb069', { roughness: 1 })), 0, 0.0, 24, sabit);
  k.at(k.box(140, 0.1, 22, k.mat('#cfc8be', { roughness: 0.95 })), 0, 0.0, -20, sabit);
  const deniz = k.mat('#3f8fc9', { roughness: 0.15, metalness: 0.2 }); k.at(k.box(400, 0.1, 160, deniz), 0, -0.3, -110, kok);
  k.at(k.box(140, 1.2, 1.2, k.mat('#bdb2a1', { roughness: 0.9 })), 0, 0.0, -30.6, sabit);

  // arka sıra binalar (y = 0.3 kaldırım üstü)
  const Y = 0.3;
  koy('apartman', -27, -13, 0, { kat: 5 }, sabit, Y); koy('apartman', -18.5, -13, 0, { kat: 4 }, sabit, Y);
  koy('ahsap-ev', -9.5, -12.5, 0, {}, sabit, Y); koy('dukkan', -1, -11.3, 0, { tur: 'firin' }, sabit, Y);
  koy('dukkan', 4.5, -11.3, 0, { tur: 'berber' }, sabit, Y); koy('dukkan', 10, -11.3, 0, { tur: 'manav' }, sabit, Y);
  koy('apartman', 17.5, -13, 0, { kat: 3 }, sabit, Y); koy('apartman', 26, -13, 0, { kat: 5 }, sabit, Y); koy('dukkan', 33, -11.3, 0, { tur: 'bakkal' }, sabit, Y);
  koy('kule', -38, -24); for (const x of [-46, -32, 40, 46]) koy('selvi', x, -22 + R.range(-2, 2));
  koy('cinar', 38, -18); koy('mese', -44, -14);

  // ön kaldırım
  koy('durak', 6, 6.6, Math.PI, { hat: '42B', yon: 'BELGRAD ORMANI' }, sabit, Y);
  koy('seyyar', 11, 6.2, Math.PI, { tur: 'simit' }, sabit, Y);
  koy('seyyar', -4, 6.2, Math.PI, { tur: 'kestane' }, sabit, Y);
  for (const x of [-30, -20, -10, 0, 14, 24, 34]) koy('sokak-lambasi', x, 4.6, Math.PI / 2, {}, sabit, Y);
  koy('cay-masasi', -16, 6.8, 0, {}, sabit, Y); koy('cay-masasi', -12.5, 7.2, 0.6, {}, sabit, Y);
  koy('bank', 1.5, 7.9, Math.PI, {}, sabit, Y); koy('cop-kutusu', 3.6, 7.8, 0, {}, sabit, Y);
  koy('cesme', -24, 8.4, Math.PI, {}, sabit, Y); koy('reklam', 19, 8.2, Math.PI, { marka: R.pick(['kolaz', 'ayranbey', 'narcicek', 'martikart']) }, sabit, Y);
  for (const [x, ren] of [[-7, 'tekir'], [16, 'ucrenk'], [-15, 'sari']]) koy('kedi', x, 5.4 + R.range(0, 2), R.range(0, 6), { renk: ren }, sabit, Y);
  for (let i = 0; i < 4; i++) koy('saksi', -28 + i * 0.7, 8.2, 0, { cicek: R.pick(['#e0533c', '#f2a2b3', '#ffd23f']) }, sabit, Y);
  koy('koni', -1.5, 3.4, 0, {}, sabit); koy('koni', -2.6, 3.6, 0, {}, sabit);
  // çimen tarafı ağaçlar
  for (let i = 0; i < 14; i++) koy(R.pick(['cam', 'mese', 'erguvan', 'cali', 'cali', 'kaya', 'cinar']), -60 + i * 9 + R.range(-2, 2), 13 + R.range(0, 4), R.range(0, 6));
  koy('cicek-tarhi', -6, 11, 0); koy('cicek-tarhi', 9, 11, 0);

  pisir(sabit);

  // gece ışıkları (birkaç gerçek ışık yeter)
  if (gece) for (const x of [-20, 0, 14, 34]) { const l = new T.PointLight('#ffcf7a', 18, 14, 1.6); l.position.set(x + 0.75, 4.0, 4.6); kok.add(l); }

  // araçlar
  const otobus = koy('otobus', -60, 2.1, Math.PI / 2, { hat: '42B' }, kok);
  const taksi = koy('taksi', 30, -2.1, -Math.PI / 2, {}, kok);
  const dolmus = koy('dolmus', -10, -2.1, -Math.PI / 2, {}, kok);
  const motor = koy('motor', 50, 2.1, Math.PI / 2, {}, kok);
  const vapur = koy('vapur', -80, -70, Math.PI / 2, {}, kok, 0);
  const araclar = [{ g: taksi, v: -9, r: 0.33 }, { g: dolmus, v: -6.5, r: 0.36 }, { g: motor, v: 8, r: 0.28 }];

  // insanlar
  const hazir = Object.keys(KR.HAZIR); const insanlar = [];
  for (let i = 0; i < 12; i++) {
    const id = i < hazir.length ? 'kisi-' + hazir[i] : 'kisi-rastgele';
    const arka = i % 2 === 0, yon = R.chance(0.5) ? 1 : -1;
    const g = koy(id, R.range(-50, 50), arka ? -6.8 + R.range(-1, 1) : 6.2 + R.range(-0.6, 1.2), yon * Math.PI / 2, {}, kok, Y);
    insanlar.push({ g, v: yon * R.range(1.0, 1.6), faz: R.next() * 10 });
  }
  // martılar
  const martilar = []; for (let i = 0; i < 5; i++) { const g = koy('marti', 0, 0, 0, {}, kok); g.scale.setScalar(1.6); martilar.push({ g, r: R.range(10, 22), h: R.range(9, 15), hiz: R.range(0.25, 0.5) * (R.chance(0.5) ? 1 : -1), faz: R.next() * 6 }); }

  // otobüs durumu: yaklaş, dur, kapı aç, bekle, kalk
  let bx = -28, bekle = 0, gitti = false;
  const tekerDon = (g, d, r) => g.userData.parca?.tekerler?.forEach(t => { t.rotation.x += d / r; });

  function guncelle(dt, t) {
    // otobüs
    const DUR = 6 - 0.0; let hiz = 9;
    if (!gitti && bx < DUR) { const kalan = DUR - bx; hiz = Math.min(9, Math.max(0.6, kalan * 0.9)); bx = Math.min(DUR, bx + hiz * dt); if (DUR - bx < 0.02) { bx = DUR; bekle = 5; gitti = true; } tekerDon(otobus, hiz * dt, 0.5); otobus.userData.kapiAc(0); }
    else if (bekle > 0) { bekle -= dt; const a = Math.min(1, (5 - bekle) * 1.5, bekle * 1.5); otobus.userData.kapiAc(Math.max(0, a)); }
    else { hiz = Math.min(9, (bx - DUR) * 1.2 + 1.2); bx += hiz * dt; tekerDon(otobus, hiz * dt, 0.5); otobus.userData.kapiAc(0); if (bx > 75) { bx = -75; gitti = false; } }
    otobus.position.x = bx;
    for (const a of araclar) { a.g.position.x += a.v * dt; if (a.g.position.x < -75) a.g.position.x = 75; if (a.g.position.x > 75) a.g.position.x = -75; tekerDon(a.g, Math.abs(a.v) * dt, a.r); }
    vapur.position.x += 2.2 * dt; if (vapur.position.x > 140) vapur.position.x = -140;
    for (const p of insanlar) { p.g.position.x += p.v * dt; if (p.g.position.x > 60) p.g.position.x = -60; if (p.g.position.x < -60) p.g.position.x = 60; KR.yuru(p.g, t + p.faz, 1); }
    for (const m of martilar) { const a = t * m.hiz + m.faz; m.g.position.set(Math.cos(a) * m.r, m.h + Math.sin(t * 1.3 + m.faz) * 0.6, -2 + Math.sin(a) * m.r * 0.6); const sg = Math.sign(m.hiz); m.g.rotation.y = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * 0.6 * sg); const ch = m.g.getObjectByName('kanatL'), cr = m.g.getObjectByName('kanatR'); const f = Math.sin(t * 9 + m.faz) * 0.7; if (ch) ch.rotation.z = f; if (cr) cr.rotation.z = -f; }
  }
  return { kok, guncelle, adet };
}
