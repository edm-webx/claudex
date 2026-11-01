// Otomatik oynanış: her seviyeyi tespit AÇIK halde baştan sona oynar (tarayıcıda gerçek oyun kodu).
// Kullanım: node test/bot.js [seviye]
const { chromium } = require('playwright');
const path = require('path');
const BOT = () => {
  const G = window.GK, R = () => G.R(), P = () => G.R().P, log = [];
  const cx = () => P().x + 0.28, ok = () => G.durum() === 'oyun' || G.durum() === 'konusma';
  const kare = (n = 1) => G.simule(n / 60);
  const birak = () => { G.tus.sag = G.tus.sol = G.tus.zipla = G.tus.egil = false; };
  function yuru(x, egil) {
    birak(); const sag = x > cx(); G.tus.sag = sag; G.tus.sol = !sag; G.tus.egil = !!egil;
    for (let t = 0; t < 1500 && ok(); t++) { kare(); if (sag ? cx() >= x : cx() <= x) break; }
    birak(); kare(2);
  }
  function zipla(yon, n = 40) { birak(); G.basildi.zipla = true; G.tus.zipla = true; if (yon > 0) G.tus.sag = true; if (yon < 0) G.tus.sol = true; for (let k = 0; k < Math.max(n, 24) && ok(); k++) { if (k >= n) G.tus.sag = G.tus.sol = false; kare(); } birak(); for (let k = 0; k < 60 && ok() && !P().yer; k++) kare(); }
  function kosZipla(x, yon, n = 40) { birak(); if (yon > 0) G.tus.sag = true; else G.tus.sol = true; for (let t = 0; t < 900 && ok(); t++) { kare(); if (yon > 0 ? cx() >= x : cx() <= x) break; } G.basildi.zipla = true; G.tus.zipla = true; for (let k = 0; k < n && ok(); k++) kare(); birak(); for (let k = 0; k < 60 && ok() && !P().yer; k++) kare(); }
  function kullan() { G.basildi.kullan = true; kare(); }
  function at() { G.basildi.at = true; kare(); }
  function bekle(sn) { birak(); kare(Math.round(sn * 60)); }
  function kadar(f, sn = 30) { for (let t = 0; t < sn * 60 && ok() && !f(); t++) kare(); }
  function egilBekle(f, sn = 30) { birak(); G.tus.egil = true; kadar(f, sn); G.tus.egil = false; kare(2); }
  const iz = (ad) => log.push(ad + '@' + cx().toFixed(1) + ',' + P().y.toFixed(1));
  const muh = (i) => R().muhafizlar[i], isik = (i) => R().isiklar[i], kop = (i) => R().kopekler[i];
  // ışık güvenli mi: ışın merkezi uzakta ve uzaklaşıyor
  const isikUzak = (i, min) => { const l = isik(i); const d = l.bx - cx(); const v = Math.cos(l.faz) * l.hiz; return l.kapaliT > 0 || R().karanlik || (Math.abs(d) > min && Math.sign(v) === Math.sign(d)); };
  const C = [
    () => { // 1 Barakalar
      yuru(5); kosZipla(6.9, 1, 22); iz('a'); zipla(1, 10); iz('b'); zipla(1, 34); iz('c'); log.push('makas:' + R().env.makas);
      yuru(16.3); kadar(() => muh(0).yon > 0 && muh(0).durum === 'devriye' && muh(0).x > 33);
      yuru(31.5); egilBekle(() => muh(0).yon < 0 && muh(0).x < 28.5, 40); log.push('gizlendi');
      yuru(42.3); iz('d'); zipla(1, 18); iz('e'); zipla(1, 24); iz('f'); log.push('anahtar:' + R().env.anahtar + '/' + R().alinan.join(';'));
      yuru(47.8); zipla(1, 30); log.push('ordek:' + R().env.ordek);
      iz('g'); yuru(55); iz('h'); log.push('kapi:' + R().kapilar[0].hedef); bekle(1.5); yuru(56.5); iz('i'); log.push('kapi2:' + R().kapilar[0].hedef + ' env:' + JSON.stringify(R().env)); yuru(62);
    },
    () => { // 2 Projektörler
      yuru(7.4); kadar(() => isikUzak(0, 4), 12); iz('s'); log.push(document.querySelector('#ipucu').innerHTML); kullan(); log.push('isik0:' + isik(0).kapaliT.toFixed(1)); yuru(16.8); zipla(1, 16); iz('a'); zipla(1, 16); iz('b'); yuru(21.7); zipla(1, 18); yuru(24.5); iz('c'); log.push('ordek:' + R().env.ordek);
      yuru(33.5); kadar(() => isikUzak(1, 9), 20);
      yuru(42.5); kadar(() => isikUzak(1, 8), 20);
      yuru(52.0 - 0.3); kadar(() => isikUzak(1, 7), 20);
      // sandığı plakaya kadar it
      birak(); G.tus.sag = true; kadar(() => R().sandiklar[0].x >= 55.4, 10); birak(); log.push('plaka:' + R().plakalar[0].basili);
      kadar(() => isikUzak(1, 5), 20); zipla(1, 30); iz('k'); kadar(() => R().kapilar[0].acik > 0.9, 5); yuru(71);
    },
    () => { // 3 Depo
      yuru(7.6); zipla(1, 8); iz('a'); zipla(-1, 26); yuru(5.3); iz('b'); log.push('ordek:' + R().env.ordek);
      yuru(7.6); zipla(1, 8); iz('c'); zipla(1, 22); iz('d');
      yuru(26.3); kadar(() => muh(0).yon < 0 && muh(0).x < 21, 40);
      iz('e'); yuru(28.2); yuru(32.6, true); bekle(0.2); iz('f');
      zipla(1, 32); iz('g'); yuru(36.5); bekle(0.3); iz('h');
      birak(); G.tus.sol = true; kadar(() => R().sandiklar[0].x <= 33.0, 6); birak(); log.push('plaka:' + R().plakalar[0].basili);
      kadar(() => R().kapilar[0].acik > 0.9, 4); yuru(36.6); birak(); G.tus.sag = true; kadar(() => R().sandiklar[1].x >= 40.9, 8); birak(); kare(10);
      log.push('sandik2:' + R().sandiklar[1].x.toFixed(2));
      zipla(-1, 4); zipla(1, 14); zipla(1, 16); log.push('anahtar:' + R().env.anahtar + ' y:' + P().y.toFixed(2));
      yuru(46.4); kadar(() => muh(1).yon > 0 && muh(1).durum === 'devriye' && muh(1).x > 55, 40);
      yuru(53.5); egilBekle(() => muh(1).yon < 0 && muh(1).x < 50.5, 40);
      yuru(62.4); bekle(1.6); yuru(70);
    },
    () => { // 4 Köpekli orman
      yuru(10.5); kadar(() => kop(0).x < 19, 20); at(); kadar(() => kop(0).durum === 'ye', 6); log.push('kopek0:' + kop(0).durum);
      yuru(26); kosZipla(28.0, 1, 26); iz('w'); zipla(1, 6); yuru(32.6); iz('y'); // yedek sosis için iskeleye çık
      log.push('sosis:' + R().env.sosis);
      yuru(36.9); zipla(1, 10); zipla(1, 14); zipla(1, 22); log.push('ordek:' + R().env.ordek);
      kadar(() => isikUzak(0, 6), 15); yuru(47.5);
      kadar(() => isikUzak(0, 6), 15); yuru(55.5); log.push('makas:' + R().env.makas);
      kadar(() => kop(1).x < 63, 20); at(); kadar(() => kop(1).durum === 'ye', 6); log.push('kopek1:' + kop(1).durum);
      yuru(79);
    },
    () => { // 5 Kızıl Kule
      birak(); G.tus.sag = true; kadar(() => R().sandiklar[0].x >= 11.9, 8); birak(); kare(5);
      zipla(-1, 4); zipla(1, 12); zipla(1, 16); log.push('sigorta:' + R().env.sigorta);
      zipla(-1, 20); log.push('ordek:' + R().env.ordek); zipla(1, 26);
      yuru(18.3); kadar(() => muh(0).yon > 0 && muh(0).durum === 'devriye' && muh(0).x > 33, 40); kullan();
      yuru(36.5); egilBekle(() => muh(0).yon < 0 && muh(0).x < 31.5, 40);
      yuru(38.6); log.push('sigorta:' + R().env.sigorta);
      kadar(() => isikUzak(0, 6), 20); yuru(42.6); kadar(() => isikUzak(0, 6), 20); yuru(48.6);
      yuru(49.0); zipla(1, 10); zipla(1, 14); log.push('makas:' + R().env.makas);
      iz('p'); yuru(55.6); yuru(55.3); iz('q'); yuru(57.2); iz('r'); log.push(R().esyalar.filter(e => e.tur === 's').map(e => e.x + ':' + e.alindi).join()); log.push('sosisV:' + R().env.sosis); kadar(() => kop(0).x < 66 && kop(0).yon < 0, 20); at(); kare(40); log.push('atilan:' + R().atilan.map(a => a.x.toFixed(1) + '/' + a.yerde).join(';') + ' kop:' + kop(0).x.toFixed(1)); kadar(() => kop(0).durum === 'ye', 6); log.push('kopek:' + kop(0).durum); yuru(58.4); log.push('tel kesildi');
      yuru(73.8); yuru(77, true); log.push('sigorta:' + R().env.sigorta);
      yuru(80.3); kullan(); kadar(() => R().kapilar[0].acik > 0.9, 4); yuru(90);
    },
  ];
  return (i) => { G.dondur(true); try { C[i](); } catch (e) { log.push('HATA ' + e.message); } return { durum: G.durum(), x: cx().toFixed(2), y: P().y.toFixed(2), A: R().A.toFixed(2), sebep: R().sebep, yak: R().istat.yak, log }; };
};
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const hata = []; p.on('pageerror', (e) => hata.push(e.message));
  const tek = process.argv[2];
  let gecti = 0;
  for (let i = 0; i < 5; i++) {
    if (tek != null && +tek !== i) continue;
    await p.goto('file://' + path.resolve(__dirname, '../index.html') + '?sv=' + i);
    await p.waitForTimeout(1500);
    const s = await p.evaluate(`(${BOT})()(${i})`);
    const ok = s.durum === 'bitti';
    if (ok) gecti++;
    console.log(`Seviye ${i + 1}: ${ok ? 'GEÇTİ' : 'KALDI'} durum=${s.durum} x=${s.x} y=${s.y} A=${s.A} ${s.sebep || ''} | ${s.log.join(', ')}`);
  }
  if (hata.length) console.log('Sayfa hataları:', hata.slice(0, 5));
  console.log(`Toplam: ${gecti}`);
  await b.close();
})();
