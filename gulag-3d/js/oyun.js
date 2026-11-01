// Gulag Kaçışı 3D: oyun çekirdeği (fizik, yapay zeka, bulmacalar, sahne kurulumu, arayüz)
'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const tuval = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas: tuval, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  const sahne = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 900);
  malzemeler();

  const SW = 0.98, SH = 1.15, PW = 0.56;
  const SON = SEVIYELER.length;
  let kayit = { acik: 1, ordek: [0, 0, 0, 0, 0], son: 0 };
  try { Object.assign(kayit, JSON.parse(localStorage.getItem('gk3') || '{}')); } catch (e) {}
  const kaydet = () => { try { localStorage.setItem('gk3', JSON.stringify(kayit)); } catch (e) {} };
  const URL_P = new URLSearchParams(location.search);
  const TEST = URL_P.has('test');

  let durum = 'menu', R = null, dunya = null, zaman = 0, sarsinti = 0, gok = null, kar = null, ay = null;
  const tus = {}, basildi = {};

  // ================= GİRDİ =================
  const HARITA = { ArrowLeft: 'sol', KeyA: 'sol', ArrowRight: 'sag', KeyD: 'sag', ArrowUp: 'zipla', KeyW: 'zipla', Space: 'zipla', ArrowDown: 'egil', KeyS: 'egil', ControlLeft: 'egil', KeyE: 'kullan', Enter: 'kullan', KeyF: 'at', KeyR: 'kontrol', Escape: 'durdur', KeyP: 'durdur' };
  addEventListener('keydown', (e) => {
    Ses.baslat();
    const k = HARITA[e.code]; if (!k) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!tus[k]) basildi[k] = true; tus[k] = true;
    if (durum === 'konusma' && !e.repeat && (k === 'zipla' || k === 'kullan')) diyalogIleri();
    else if (k === 'durdur' && !e.repeat) { if (durum === 'oyun') duraklat(); else if (durum === 'durdur') surdur(); }
  });
  addEventListener('keyup', (e) => { const k = HARITA[e.code]; if (k) tus[k] = false; });
  addEventListener('blur', () => { for (const k in tus) tus[k] = false; if (durum === 'oyun') duraklat(); });
  const dokunmatik = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
  document.querySelectorAll('#dokun button').forEach((b) => {
    const k = b.dataset.k;
    const bas = (e) => { e.preventDefault(); Ses.baslat(); if (!tus[k]) basildi[k] = true; tus[k] = true; b.classList.add('basili'); if (durum === 'konusma') diyalogIleri(); };
    const birak = () => { tus[k] = false; b.classList.remove('basili'); };
    b.addEventListener('pointerdown', bas); ['pointerup', 'pointerleave', 'pointercancel'].forEach((v) => b.addEventListener(v, birak));
  });
  $('#diyalog').addEventListener('pointerdown', () => diyalogIleri());

  // ================= IZGARA YARDIMCILARI =================
  const hucre = (x, r) => (x < 0 || x >= R.w || r < 0 || r > 11) ? '#' : R.g[r][x];
  function kati(x, r) {
    const c = hucre(x, r);
    if (c === '#') return true;
    if (c === 'D' || c === 'G') return R.kapilar[R.kapiH[r][x]].acik < 0.85;
    return false;
  }
  function kutuKati(x, y, w, h) {
    const x0 = Math.floor(x), x1 = Math.floor(x + w - 1e-4), y0 = Math.floor(y), y1 = Math.floor(y + h - 1e-4);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (kati(i, 11 - j)) return true;
    return false;
  }
  function kutuSandik(x, y, w, h, haric) {
    for (const s of R.sandiklar) if (s !== haric && x < s.x + SW && x + w > s.x && y < s.y + SH && y + h > s.y) return s;
    return null;
  }
  function zeminBul(x, w, y0, y1, haric) {
    let en = null;
    const xa = Math.floor(x + 0.02), xb = Math.floor(x + w - 0.02);
    for (let t = Math.floor(y0 + 1e-6); t >= Math.floor(y1) && t >= 0; t--) {
      if (t > y0 + 1e-6 || t < y1 - 1e-6) continue;
      const r = 12 - t;
      for (let i = xa; i <= xb; i++) if (kati(i, r) || hucre(i, r) === '=') { en = t; break; }
      if (en !== null) break;
    }
    for (const s of R.sandiklar) {
      if (s === haric) continue;
      const ust = s.y + SH;
      if (x < s.x + SW && x + w > s.x && ust <= y0 + 1e-6 && ust >= y1 - 1e-6 && (en === null || ust > en)) en = ust;
    }
    return en;
  }
  const merkez = () => R.P.x + PW / 2;

  // ================= SEVİYE KURULUMU =================
  function temizle() {
    if (!dunya) return;
    sahne.remove(dunya);
    const ortak = new Set(Object.values(M));
    dunya.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => { if (!ortak.has(m)) m.dispose(); });
    });
    dunya = null;
  }

  function seviyeKur(i, snap, istat) {
    temizle();
    const sv = SEVIYELER[i];
    const o = izgara(sv.w); sv.kur(o);
    R = {
      i, sv, w: sv.w, g: o.g.map((r) => r.slice()), kapilar: [], kapiH: [...Array(12)].map(() => []), plakalar: [], salterler: [], isiklar: [],
      muhafizlar: [], kopekler: [], sandiklar: [], esyalar: [], kontroller: [], saklan: [], cikis: null, kutu: null, atilan: [], tel: {},
      env: { anahtar: 0, makas: 0, sosis: 0, sigorta: 0, ordek: 0 }, alinan: [], kesilen: [], A: 0, gizli: false, karanlik: false, kontrolAktif: -1,
      istat: istat || { sure: 0, yak: 0 }, bilgiT: 0, sebep: '', snap: null, parcalar: [],
    };
    const P = R.P = { x: 2, y: 1, vx: 0, vy: 0, w: PW, h: 1.5, yer: true, egik: false, yon: 1, coyote: 0, tampon: 0, itiyor: false, animT: 0, adimT: 0, nefesT: 0, donus: Math.PI / 2 };
    const notlar = [], ivirler = [];
    for (let r = 0; r < 12; r++) for (let x = 0; x < sv.w; x++) {
      const c = R.g[r][x], y = 11 - r;
      const bos = () => { R.g[r][x] = '.'; };
      if (c === '@') { P.x = x + 0.5 - PW / 2; P.y = y; bos(); }
      else if (c === 'B') { R.sandiklar.push({ x: x + 0.01, y, vy: 0, itildi: 0 }); bos(); }
      else if ('kcsfonx'.includes(c)) { const e = { id: x + ',' + r, tur: c, x, r, alindi: false }; R.esyalar.push(e); if (c === 'n') notlar.push(e); if (c === 'x') ivirler.push(e); bos(); }
      else if (c === 'C') { R.kontroller.push({ x, r, aktif: false }); bos(); }
      else if (c === 'E') { R.cikis = { x, r }; bos(); }
      else if (c === 'H') { R.saklan.push({ x, r }); bos(); }
      else if (c === 'S') { R.salterler.push({ x, r, acik: false }); bos(); }
      else if (c === 'F') { R.kutu = { x, r, takili: 0 }; bos(); }
      else if (c === '_') { R.plakalar.push({ x, r, basili: false }); bos(); }
    }
    notlar.sort((a, b) => a.x - b.x).forEach((e, k) => { e.metin = sv.notlar[k] || ''; });
    ivirler.sort((a, b) => a.x - b.x).forEach((e, k) => { e.metin = sv.ivir[k] || ''; });
    // kapılar: dikey bölümler
    for (let x = 0; x < sv.w; x++) for (let r = 0; r < 12; r++) {
      const c = R.g[r][x];
      if ((c === 'D' || c === 'G') && R.kapiH[r][x] === undefined) {
        let r1 = r; while (r1 + 1 < 12 && R.g[r1 + 1][x] === c) r1++;
        const k = { tip: c, x, r0: r, r1, acik: 0, hedef: 0 }; R.kapilar.push(k);
        for (let q = r; q <= r1; q++) R.kapiH[q][x] = R.kapilar.length - 1;
      }
    }
    const dKapilar = R.kapilar.filter((k) => k.tip === 'D');
    R.plakalar.sort((a, b) => a.x - b.x).forEach((p, k) => { p.kapi = dKapilar[k]; });
    R.salterler.sort((a, b) => a.x - b.x).forEach((s, k) => { s.cfg = sv.salter[k]; });
    sv.isik.forEach((c) => R.isiklar.push({ ...c, faz: Math.random() * 6, kapaliT: 0 }));
    sv.muhafiz.forEach((c) => R.muhafizlar.push({ x: c.x + 0.5, y: 1, a: c.a + 0.5, b: c.b + 0.5, yon: 1, durum: 'devriye', bekle: 0, gormeT: 9, animT: 0, bak: 0 }));
    sv.kopek.forEach((c) => R.kopekler.push({ x: c.x + 0.5, y: 1, a: c.a + 0.5, b: c.b + 0.5, yon: 1, durum: 'devriye', hedef: null, yeT: 0, animT: 0, havT: 0 }));

    // anlık kayıttan dön
    if (snap) {
      P.x = snap.px; P.y = snap.py; Object.assign(R.env, snap.env);
      R.alinan = snap.alinan.slice(); R.esyalar.forEach((e) => { e.alindi = R.alinan.includes(e.id); });
      R.kesilen = snap.kesilen.map((k) => k.slice()); R.kesilen.forEach(([x, r]) => telSil(x, r, true));
      snap.sandik.forEach(([x, y], k) => { if (R.sandiklar[k]) { R.sandiklar[k].x = x; R.sandiklar[k].y = y; } });
      snap.kapiAcik.forEach((a, k) => { if (a) { R.kapilar[k].hedef = R.kapilar[k].acik = 1; } });
      if (R.kutu) R.kutu.takili = snap.sigortaTakili;
      R.kontrolAktif = snap.kontrol; R.kontroller.forEach((c, k) => { c.aktif = k <= snap.kontrol; });
      R.karanlik = snap.karanlik; R.snap = snap;
    }
    dunyaKur();
    Ses.ortam(sv.ic);
    hudGuncelle(true);
  }
  function anlik() {
    const P = R.P;
    return JSON.parse(JSON.stringify({
      px: P.x, py: P.y, env: R.env, alinan: R.alinan, kesilen: R.kesilen, sandik: R.sandiklar.map((s) => [s.x, s.y]),
      kapiAcik: R.kapilar.map((k) => k.tip === 'G' && k.hedef === 1), sigortaTakili: R.kutu ? R.kutu.takili : 0, kontrol: R.kontrolAktif, karanlik: R.karanlik,
    }));
  }

  // ================= 3D DÜNYA =================
  function dunyaKur() {
    const sv = R.sv, w = R.w, ic = sv.ic;
    dunya = new THREE.Group(); sahne.add(dunya);
    const R2 = tohum(R.i * 977 + 13);
    sahne.fog = new THREE.FogExp2(sv.sis, ic ? 0.045 : 0.022);
    sahne.background = new THREE.Color(sv.sis);
    gok = gokyuzu(sv); dunya.add(gok);
    // ışıklar
    const hemi = new THREE.HemisphereLight(ic ? 0x8a6a50 : 0x5a74a8, ic ? 0x201208 : 0x10141e, ic ? 1.0 : 0.75); dunya.add(hemi);
    ay = new THREE.DirectionalLight(ic ? 0xffd2a0 : 0xa8c0ff, ic ? 0.45 : 1.1);
    ay.castShadow = true; ay.shadow.mapSize.set(2048, 2048);
    Object.assign(ay.shadow.camera, { left: -18, right: 18, top: 12, bottom: -8, near: 1, far: 80 });
    ay.shadow.bias = -0.0006; ay.shadow.normalBias = 0.02;
    dunya.add(ay); dunya.add(ay.target);
    if (!ic) { const ayDisk = isilti(0xdfe8ff, 40, 0.7); ayDisk.position.set(120, 150, -330); ayDisk.material.fog = false; gok.add(ayDisk); const ayC = isilti(0xffffff, 10, 1); ayC.position.copy(ayDisk.position); ayC.material.fog = false; gok.add(ayC); }

    // zemin
    if (!ic) {
      const zg = uvTekrar(new THREE.PlaneGeometry(w + 200, 220, 1, 1), (w + 200) / 3, 220 / 3); zg.rotateX(-Math.PI / 2);
      const zemin = new THREE.Mesh(zg, M.kar); zemin.position.set(w / 2, 1, -100); zemin.receiveShadow = true; dunya.add(zemin);
      // kar yığıntıları
      const yg = new THREE.SphereGeometry(1, 12, 8);
      const yigin = new THREE.InstancedMesh(yg, M.kar, 120); const mt = new THREE.Matrix4();
      for (let k = 0; k < 120; k++) {
        const z = k % 3 === 0 ? 2.4 + R2() * 2.5 : -2 - R2() * 12;
        mt.compose(new V3(R2() * w, 1, z), new THREE.Quaternion(), new V3(0.5 + R2() * 1.4, 0.12 + R2() * 0.16, 0.4 + R2() * 0.8)); yigin.setMatrixAt(k, mt);
      }
      yigin.receiveShadow = true; dunya.add(yigin);
    } else {
      const zg = uvTekrar(new THREE.PlaneGeometry(w, 8), w / 2, 4); zg.rotateX(-Math.PI / 2);
      const zemin = new THREE.Mesh(zg, M.tahta); zemin.position.set(w / 2, 1, 0); zemin.receiveShadow = true; dunya.add(zemin);
      const dg = uvTekrar(new THREE.PlaneGeometry(w, 11), w / 2, 5.5);
      const duvar = new THREE.Mesh(dg, M.tugla); duvar.position.set(w / 2, 6.5, -1.6); duvar.receiveShadow = true; dunya.add(duvar);
    }

    // katı bloklar
    const bloklar = [], karlar = [];
    for (let r = 0; r < 11; r++) for (let x = 0; x < w; x++) if (R.g[r][x] === '#') { bloklar.push([x, r]); if (!ic && r > 0 && R.g[r - 1][x] !== '#') karlar.push([x, r]); }
    if (bloklar.length) {
      const bg = new THREE.BoxGeometry(1, 1, 2.2); bg.translate(0, 0, -0.4);
      const im = new THREE.InstancedMesh(bg, M.beton, bloklar.length); const mt = new THREE.Matrix4();
      bloklar.forEach(([x, r], k) => { mt.makeTranslation(x + 0.5, 11 - r + 0.5, 0); im.setMatrixAt(k, mt); });
      im.castShadow = im.receiveShadow = true; dunya.add(im);
    }
    if (karlar.length) {
      const kg = new THREE.BoxGeometry(1.04, 0.16, 2.3); kg.translate(0, 0, -0.4);
      const im = new THREE.InstancedMesh(kg, M.kar, karlar.length); const mt = new THREE.Matrix4();
      karlar.forEach(([x, r], k) => { mt.makeTranslation(x + 0.5, 12 - r + 0.05, 0); im.setMatrixAt(k, mt); });
      im.castShadow = im.receiveShadow = true; dunya.add(im);
    }
    // iskeleler
    const tahtalar = [];
    for (let r = 0; r < 11; r++) for (let x = 0; x < w; x++) if (R.g[r][x] === '=') tahtalar.push([x, r]);
    if (tahtalar.length) {
      const tg = new THREE.BoxGeometry(1.0, 0.16, 2.0);
      const im = new THREE.InstancedMesh(tg, M.tahta, tahtalar.length); const mt = new THREE.Matrix4();
      tahtalar.forEach(([x, r], k) => { mt.makeTranslation(x + 0.5, 12 - r - 0.08, 0); im.setMatrixAt(k, mt); });
      im.castShadow = im.receiveShadow = true; dunya.add(im);
      if (!ic) {
        const im2 = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 0.06, 1.9), M.kar, tahtalar.length);
        tahtalar.forEach(([x, r], k) => { mt.makeTranslation(x + 0.5, 12 - r + 0.02, 0); im2.setMatrixAt(k, mt); }); im2.castShadow = true; dunya.add(im2);
      }
      // direkler: her bölümün uçlarında
      for (let r = 0; r < 11; r++) for (let x = 0; x < w; x++) {
        if (R.g[r][x] !== '=') continue;
        const bas = R.g[r][x - 1] !== '=', son = R.g[r][x + 1] !== '=';
        if (!bas && !son) continue;
        let alt = r + 1; while (alt < 11 && R.g[alt][x] !== '#' && R.g[alt][x] !== '=') alt++;
        const ust = 12 - r - 0.16, altY = 11 - alt + 1, boy = ust - altY;
        if (boy <= 0.1) continue;
        const px = bas ? x + 0.12 : x + 0.88;
        kutu(0.12, boy, 0.12, M.tahta, px, altY + boy / 2, -0.85, dunya);
        if (boy > 1.2) { const ç = kutu(0.07, Math.min(1.2, boy) * 1.35, 0.07, M.tahta, px + (bas ? 0.4 : -0.4), ust - 0.45, -0.85, dunya); ç.rotation.z = bas ? -0.75 : 0.75; }
      }
    }

    // dikenli tel çitler ve yer telleri
    for (let x = 0; x < w; x++) for (let r = 0; r < 12; r++) {
      const c = R.g[r][x];
      if (c === 'W' && (r === 0 || R.g[r - 1][x] !== 'W')) {
        let r1 = r; while (R.g[r1 + 1][x] === 'W') r1++;
        const g = telCit(x, 11 - r1, r1 - r + 1); g.userData.r0 = r; g.userData.r1 = r1; dunya.add(g);
        for (let q = r; q <= r1; q++) R.tel[x + ',' + q] = g;
      } else if (c === 'w') { const g = yerTeli(x); dunya.add(g); R.tel[x + ',' + r] = g; }
    }
    // kapılar
    R.kapilar.forEach((k) => { k.mesh = k.tip === 'D' ? panjur(k) : demirKapi(k); dunya.add(k.mesh); });
    // plakalar
    R.plakalar.forEach((p) => {
      const g = new THREE.Group(); g.position.set(p.x + 0.5, 1, 0);
      kutu(0.96, 0.05, 1.5, M.demir, 0, 0.025, 0, g);
      p.ust = kutu(0.82, 0.07, 1.3, M.pas, 0, 0.08, 0, g);
      p.lamba = kure(0.07, M.kirmiziLamba, 0, 0.2, -0.85, g); dunya.add(g);
      if (p.kapi) { p.kapiLamba = kure(0.09, M.kirmiziLamba, p.kapi.x + 0.5, 11 - p.kapi.r0 + 1.25, 1.2, dunya); }
    });
    // şalterler
    R.salterler.forEach((s) => {
      const g = new THREE.Group(); g.position.set(s.x + 0.5, 1, -1.0);
      kutu(0.12, 1.1, 0.12, M.tahta, 0, 0.55, -0.15, g);
      kutu(0.5, 0.6, 0.25, M.metal, 0, 1.15, 0, g);
      const kol = new THREE.Group(); kol.position.set(0.12, 1.15, 0.15); g.add(kol);
      kutu(0.05, 0.35, 0.05, M.demir, 0, 0.17, 0, kol); kure(0.05, M.kirmiziLamba, 0, 0.35, 0, kol);
      kol.rotation.z = 0.5; s.kol = kol;
      s.lamba = kure(0.05, M.yesilLamba, -0.14, 1.32, 0.13, g);
      dunya.add(g);
    });
    // sigorta kutusu
    if (R.kutu) {
      const k = R.kutu, g = new THREE.Group(); g.position.set(k.x + 0.5, 1, -1.1);
      kutu(0.15, 1.6, 0.15, M.demir, 0, 0.8, -0.2, g);
      kutu(0.9, 1.0, 0.35, M.metal, 0, 1.5, 0, g);
      const yazi = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.18), new THREE.MeshStandardMaterial({ map: etiketDoku('⚡ 3'), roughness: 0.8 }));
      yazi.position.set(0, 1.85, 0.18); g.add(yazi);
      k.yuvalar = [-0.25, 0, 0.25].map((dx) => kure(0.07, M.kirmiziLamba, dx, 1.45, 0.18, g));
      dunya.add(g);
    }
    // saklanma yerleri
    R.saklan.forEach((s) => {
      const g = new THREE.Group(); g.position.set(s.x + 0.5, 1, 0.75);
      const mat = (ic ? M.cuval : M.saman).clone(); mat.transparent = true; s.mat = mat;
      if (ic) { [[-0.3, 0.25, 0], [0.3, 0.25, 0.05], [0, 0.65, 0]].forEach(([x, y, z]) => kure(0.38, mat, x, y, z, g, 1.1, 0.75, 0.8)); }
      else {
        kutu(1.25, 0.55, 0.75, mat, 0, 0.28, 0, g).rotation.y = 0.05;
        kutu(1.1, 0.5, 0.7, mat, 0.05, 0.8, 0.02, g).rotation.y = -0.08;
        kutu(1.04, 0.07, 0.66, M.kar, 0.05, 1.08, 0.02, g);
      }
      dunya.add(g);
    });
    // kontrol noktaları: ateş varili
    R.kontroller.forEach((c) => {
      const g = new THREE.Group(); g.position.set(c.x + 0.5, 1, -1.1);
      silindir(0.32, 0.3, 0.85, M.pas, 16, 0, 0.42, 0, g);
      [0.15, 0.7].forEach((y) => silindir(0.335, 0.335, 0.05, M.demir, 16, 0, y, 0, g));
      c.alevler = [0, 1, 2].map((k) => { const s = isilti(k ? 0xff7a20 : 0xffd080, 0.6, 0.0); s.position.set((k - 1) * 0.1, 1.0, 0); g.add(s); return s; });
      c.isik = new THREE.PointLight(0xff8a30, 0, 9, 2); c.isik.position.set(0, 1.4, 0.4); g.add(c.isik);
      dunya.add(g);
    });
    // çıkış
    if (R.cikis) {
      const c = R.cikis, g = new THREE.Group(); g.position.set(c.x + 0.5, 1, -1.2);
      if (R.i === SON - 1) kamyon(g); else {
        kutu(0.12, 2.0, 0.12, M.tahta, 0, 1.0, 0, g);
        const lv = document.createElement('canvas'); lv.width = 256; lv.height = 64; const x = lv.getContext('2d');
        x.fillStyle = '#d8ccb0'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#7a1a14'; x.font = 'bold 34px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ÇIKIŞ  →', 128, 34);
        const t = new THREE.CanvasTexture(lv); t.colorSpace = THREE.SRGBColorSpace;
        const lev = kutu(1.1, 0.3, 0.05, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), 0.35, 1.75, 0.08, g); lev.rotation.z = -0.05;
        const fener = isilti(0xffc070, 1.6, 0.9); fener.position.set(0, 2.15, 0.1); g.add(fener);
        const pl = new THREE.PointLight(0xffb060, 6, 7, 2); pl.position.set(0, 2.1, 0.5); g.add(pl);
      }
      dunya.add(g);
    }
    // eşyalar
    R.esyalar.forEach((e) => {
      const g = new THREE.Group(); g.add(esyaModel(e.tur));
      const parla = isilti(e.tur === 'o' ? 0xffe060 : e.tur === 'n' ? 0xfff0d0 : 0xffc080, 1.0, 0.5); g.add(parla);
      g.position.set(e.x + 0.5, 11 - e.r + 0.45, 0); g.visible = !e.alindi; e.mesh = g; dunya.add(g);
    });
    // sandıklar
    R.sandiklar.forEach((s) => {
      const g = new THREE.Group();
      kutu(SW, SH, 1.1, M.tahta, 0, SH / 2, 0, g);
      [-1, 1].forEach((k) => { kutu(SW + 0.02, 0.1, 1.12, M.koyu, 0, SH / 2 + k * 0.4, 0, g); });
      const ç = kutu(0.08, SH * 1.25, 1.12, M.tahta, 0, SH / 2, 0, g); ç.rotation.z = 0.85; ç.scale.y = 1;
      if (!ic) kutu(SW, 0.06, 1.0, M.kar, 0, SH + 0.03, 0, g);
      s.mesh = g; dunya.add(g);
    });
    // projektör kuleleri
    R.isiklar.forEach((l) => kuleKur(l));
    // muhafızlar ve köpekler
    R.muhafizlar.forEach((m) => {
      m.mesh = insan('muhafiz'); dunya.add(m.mesh);
      const sp = new THREE.SpotLight(0xffe6b0, 60, 11, 0.42, 0.6, 1.6); sp.position.set(0.22, 1.1, 0.35);
      const hd = new THREE.Object3D(); hd.position.set(0.1, 0.1, 6); m.mesh.add(sp); m.mesh.add(hd); sp.target = hd; m.isik = sp;
      const koni = isinKonisi(0.04, 1.5, 0xffe6b0, 0.16); koni.position.copy(sp.position); koni.rotation.x = Math.atan2(1.0, 6); koni.scale.z = 6; m.mesh.add(koni); m.koni = koni;
      m.ikon = ikonSprite(); m.ikon.position.y = 2.05; m.mesh.add(m.ikon);
    });
    R.kopekler.forEach((d) => { d.mesh = kopekModel(); d.ikon = ikonSprite(); d.ikon.position.y = 1.2; d.mesh.add(d.ikon); dunya.add(d.mesh); });
    // oyuncu
    R.P.mesh = insan('viktor'); dunya.add(R.P.mesh);
    R.P.dolgu = new THREE.PointLight(ic ? 0xffc890 : 0x9ab8ff, ic ? 3 : 5, 6, 1.5); dunya.add(R.P.dolgu);
    // arka plan
    if (ic) icArka(R2); else disArka(R2);
    // kar / toz
    kar = karYagisi(ic ? 300 : 1400, ic); dunya.add(kar);
  }

  function telCit(x, yAlt, boy) {
    const g = new THREE.Group(); g.position.set(x + 0.5, yAlt, 0);
    [-1.35, 0, 1.35].forEach((z) => kutu(0.1, boy + 0.25, 0.1, M.tahta, 0, (boy + 0.25) / 2, z, g));
    const tg = new THREE.CylinderGeometry(0.012, 0.012, 2.9, 4); tg.rotateX(Math.PI / 2);
    const dk = new THREE.BoxGeometry(0.02, 0.09, 0.02);
    const n = Math.floor(boy / 0.3), dikenSay = n * 12, dikenler = new THREE.InstancedMesh(dk, M.tel, dikenSay), mt = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 0; k < n; k++) {
      const y = 0.2 + k * 0.3 + Math.sin(k * 3.1) * 0.03, t = new THREE.Mesh(tg, M.tel); t.position.y = y; t.castShadow = true; g.add(t);
      for (let j = 0; j < 12; j++) { q.setFromEuler(new THREE.Euler(j, 0.8, j * 1.7)); mt.compose(new V3(0, y, -1.35 + j * 0.245), q, new V3(1, 1, 1)); dikenler.setMatrixAt(k * 12 + j, mt); }
    }
    g.add(dikenler);
    return g;
  }
  function yerTeli(x) {
    const g = new THREE.Group(); g.position.set(x + 0.5, 1, 0);
    const pts = []; for (let k = 0; k <= 160; k++) { const a = k / 160 * Math.PI * 2 * 9; pts.push(new V3(Math.cos(a) * 0.36, 0.38 + Math.sin(a) * 0.36, -1.4 + k / 160 * 2.8)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.014, 4), M.tel); m.castShadow = true; g.add(m);
    [-1.3, 1.3].forEach((z) => { const k = kutu(0.06, 0.8, 0.06, M.demir, 0, 0.4, z, g); k.rotation.z = 0.3; });
    return g;
  }
  function panjur(k) {
    const g = new THREE.Group(), boy = k.r1 - k.r0 + 1; g.position.set(k.x + 0.5, 11 - k.r1, 0);
    const mg = uvTekrar(new THREE.BoxGeometry(0.22, boy, 3), 1, boy);
    const levha = new THREE.Mesh(mg, M.metal); levha.castShadow = levha.receiveShadow = true; levha.position.y = boy / 2;
    const ic = new THREE.Group(); ic.add(levha); g.add(ic); g.userData.levha = ic; g.userData.boy = boy;
    kutu(0.3, 0.15, 3.05, M.demir, 0, 0.07, 0, ic);
    return g;
  }
  function demirKapi(k) {
    const g = new THREE.Group(), boy = k.r1 - k.r0 + 1; g.position.set(k.x + 0.5, 11 - k.r1, -1.5);
    const kanat = new THREE.Group(); g.add(kanat); g.userData.kanat = kanat;
    for (let z = 0.12; z < 3; z += 0.25) silindir(0.03, 0.03, boy, M.demir, 6, 0, boy / 2, z, kanat);
    [0.15, boy / 2, boy - 0.15].forEach((y) => kutu(0.08, 0.1, 3, M.demir, 0, y, 1.5, kanat));
    const kilit = kutu(0.12, 0.2, 0.18, new THREE.MeshStandardMaterial({ color: 0xa08030, metalness: 0.9, roughness: 0.35 }), 0.08, boy / 2, 1.5, kanat);
    g.userData.kilit = kilit;
    return g;
  }
  function kamyon(g) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const yesil = std({ color: 0x3d4a32, roughness: 0.7, metalness: 0.2 }), branda = std({ map: DOKU.kumas.map, color: 0x5a5a40, roughness: 1 });
    const k = new THREE.Group(); k.position.set(1.8, 0, -0.8); k.rotation.y = 0; g.add(k);
    kutu(4.5, 0.4, 2.0, M.koyu, 0, 0.75, 0, k);
    kutu(1.5, 1.3, 1.9, yesil, 1.6, 1.6, 0, k); kutu(0.05, 0.6, 1.6, M.camSoguk, 2.36, 1.85, 0, k);
    kutu(2.9, 1.7, 2.0, branda, -0.7, 1.8, 0, k);
    [[1.6, 1], [1.6, -1], [-1.2, 1], [-1.2, -1]].forEach(([x, z]) => { const t = silindir(0.42, 0.42, 0.3, M.koyu, 14, x, 0.42, z * 0.95, k); t.rotation.x = Math.PI / 2; });
    [-0.6, 0.6].forEach((z) => { const f = isilti(0xfff2c0, 1.4, 1); f.position.set(2.4, 1.1, z); k.add(f); });
    const sp = new THREE.SpotLight(0xfff2c0, 120, 20, 0.5, 0.5, 1.5); sp.position.set(2.4, 1.1, 0); const hd = new THREE.Object3D(); hd.position.set(10, 0, 0); k.add(sp); k.add(hd); sp.target = hd;
  }
  function ikonSprite() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false })); s.scale.set(0.6, 0.6, 1); s.renderOrder = 10;
    s.userData = { c, t, son: '' };
    return s;
  }
  function ikonYaz(s, yazi, renk) {
    if (s.userData.son === yazi + renk) return; s.userData.son = yazi + renk;
    const x = s.userData.c.getContext('2d'); x.clearRect(0, 0, 64, 64);
    if (yazi) { x.font = 'bold 50px Oswald, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = '#000'; x.strokeText(yazi, 32, 34); x.fillStyle = renk; x.fillText(yazi, 32, 34); }
    s.userData.t.needsUpdate = true; s.visible = !!yazi;
  }
  function kuleKur(l) {
    const g = new THREE.Group(), x = l.kule + 0.5, z = -7; g.position.set(x, 1, z);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const b2 = kutu(0.18, 8.6, 0.18, M.tahta, a * 1.05, 4.2, b * 1.05, g); b2.rotation.z = -a * 0.05; b2.rotation.x = b * 0.05; });
    for (let y = 1.5; y < 8; y += 2.2) { [-1, 1].forEach((b) => { const ç = kutu(0.08, 2.9, 0.08, M.tahta, 0, y + 1, b * 1.0, g); ç.rotation.z = 0.75; }); }
    kutu(3.0, 0.25, 3.0, M.tahta, 0, 8.4, 0, g);
    [[0, 1.4, 3, 0.08], [0, -1.4, 3, 0.08]].forEach(([a, b, w]) => kutu(w, 0.7, 0.08, M.tahta, a, 8.85, b, g));
    const cat = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.2, 4), M.tahta); cat.position.y = 10.6; cat.rotation.y = Math.PI / 4; cat.castShadow = true; g.add(cat);
    const catKar = new THREE.Mesh(new THREE.ConeGeometry(2.3, 0.9, 4), M.kar); catKar.position.y = 10.85; catKar.rotation.y = Math.PI / 4; g.add(catKar);
    [-1, 1].forEach((a) => [-1, 1].forEach((b) => kutu(0.1, 1.6, 0.1, M.tahta, a * 1.3, 9.3, b * 1.3, g)));
    const yuva = new THREE.Group(); yuva.position.set(0, 9.3, 0.9); g.add(yuva);
    const gv = silindir(0.32, 0.4, 0.55, M.demir, 14, 0, 0, 0, yuva); gv.rotation.x = Math.PI / 2;
    const lens = isilti(0xfff6d8, 2.6, 1); lens.position.z = 0.35; yuva.add(lens);
    dunya.add(g);
    const sp = new THREE.SpotLight(0xfff3d6, 2600, 40, 0.12, 0.35, 2); sp.castShadow = true; sp.shadow.mapSize.set(1024, 1024); sp.shadow.bias = -0.0005;
    sp.position.set(x, 10.3, z + 0.9); const hd = new THREE.Object3D(); dunya.add(sp); dunya.add(hd); sp.target = hd;
    const koni = isinKonisi(0.3, 1.5, 0xfff3d6, 0.45); dunya.add(koni);
    const leke = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ map: parilti(), color: 0xfff0c0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    leke.rotation.x = -Math.PI / 2; dunya.add(leke);
    Object.assign(l, { sp, hd, koni, leke, yuva, lens, kaynak: new V3(x, 10.3, z + 0.9) });
  }
  function disArka(R2) {
    const w = R.w, sv = R.sv;
    // çevre çiti
    const direk = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 3.6, 0.14), M.tahta, Math.ceil(w / 2.5) + 12); const mt = new THREE.Matrix4();
    let n = 0; for (let x = -10; x < w + 10; x += 2.5) { mt.makeTranslation(x, 2.8, -3.2); direk.setMatrixAt(n++, mt); }
    direk.count = n; direk.castShadow = true; dunya.add(direk);
    for (let k = 0; k < 5; k++) { const t = silindir(0.012, 0.012, w + 20, M.tel, 4, w / 2, 1.6 + k * 0.62, -3.2, dunya); t.rotation.z = Math.PI / 2; t.castShadow = false; }
    // karanlık gözetleme kulesi (ışıksız seviyede)
    if (!R.isiklar.length) { const sahte = { kule: Math.floor(w * 0.55) }; kuleKur(sahte); sahte.sp.intensity = 0; sahte.koni.visible = false; sahte.leke.visible = false; sahte.lens.visible = false; }
    // barakalar
    for (let x = 4 + R2() * 6; x < w + 6; x += 13 + R2() * 8) baraka(x, -13 - R2() * 6, R2);
    // lamba direkleri (sadece ışıltı, gerçek ışık yok: performans)
    for (let x = 9; x < w; x += 22) {
      const g = new THREE.Group(); g.position.set(x, 1, -4.2); kutu(0.12, 4.2, 0.12, M.tahta, 0, 2.1, 0, g); kutu(0.7, 0.08, 0.08, M.tahta, 0.3, 4.1, 0, g);
      const ampul = kure(0.08, M.cam, 0.6, 3.9, 0, g); const p = isilti(0xffb860, 2.4, 0.8); p.position.copy(ampul.position); g.add(p); dunya.add(g);
    }
    // çam ağaçları
    const agacSay = sv.aurora ? 260 : 150;
    const govdeIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.22, 1.6, 6), M.kabuk, agacSay);
    const kat = [0, 1, 2].map(() => new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1.6, 7), M.camAgac, agacSay));
    const karKat = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 0.7, 7), M.agacKar, agacSay * 3);
    const q = new THREE.Quaternion();
    for (let k = 0; k < agacSay; k++) {
      const x = -20 + R2() * (w + 40), z = sv.aurora && k < 60 ? -9 - R2() * 6 : -20 - R2() * 70, s = (sv.aurora && k < 60 ? 0.7 : 0.9) + R2() * 1.3;
      const zz = (sv.aurora && k < 60 && R.isiklar.some((l) => Math.abs(l.kule + 0.5 - x) < 3)) ? -25 - R2() * 40 : z;
      mt.compose(new V3(x, 1.8 * s * 0.5 + 0.5, zz), q, new V3(s, s, s)); govdeIM.setMatrixAt(k, mt);
      for (let j = 0; j < 3; j++) {
        const yy = 1.6 * s + j * 1.05 * s, ss = s * (1.4 - j * 0.33);
        mt.compose(new V3(x, yy, zz), q, new V3(ss, s, ss)); kat[j].setMatrixAt(k, mt);
        mt.compose(new V3(x, yy + 0.35 * s, zz), q, new V3(ss * 0.8, s, ss * 0.8)); karKat.setMatrixAt(k * 3 + j, mt);
      }
    }
    [govdeIM, ...kat, karKat].forEach((m) => { m.castShadow = true; m.receiveShadow = true; dunya.add(m); });
    // dağlar
    for (let k = 0; k < 9; k++) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(30 + R2() * 30, 30 + R2() * 35, 6 + (R2() * 3 | 0)), M.dag);
      d.position.set(-60 + k * (w + 120) / 8 + R2() * 20, 10, -170 - R2() * 60); d.rotation.y = R2() * 3; dunya.add(d);
      const tepe = new THREE.Mesh(new THREE.ConeGeometry(d.geometry.parameters.radius * 0.35, d.geometry.parameters.height * 0.33, d.geometry.parameters.radialSegments), M.dagKar);
      tepe.position.set(d.position.x, d.position.y + d.geometry.parameters.height * 0.34, d.position.z); tepe.rotation.y = d.rotation.y; dunya.add(tepe);
    }
  }
  function baraka(x, z, R2) {
    const g = new THREE.Group(); g.position.set(x, 1, z); const L = 8 + R2() * 3;
    const duvar = new THREE.Mesh(uvTekrar(new THREE.BoxGeometry(L, 2.8, 4.5), L / 2, 1.4), M.tahta); duvar.position.y = 1.4; duvar.castShadow = duvar.receiveShadow = true; g.add(duvar);
    const cg = new THREE.CylinderGeometry(0.01, 3.2, 1.6, 4, 1); cg.rotateY(Math.PI / 4); cg.scale(L / 4.4, 1, 1);
    const cat = new THREE.Mesh(cg, M.koyu); cat.position.y = 3.6; cat.castShadow = true; g.add(cat);
    const kc = cg.clone(); const ck = new THREE.Mesh(kc, M.kar); ck.scale.set(1.02, 0.85, 1.02); ck.position.y = 3.75; g.add(ck);
    for (let k = 0; k < 3; k++) { const yanik = R2() > 0.3; kutu(0.7, 0.6, 0.06, yanik ? M.cam : M.camSoguk, -L / 2 + 1.5 + k * (L - 3) / 2, 1.7, 2.27, g); }
    kutu(0.5, 1.6, 0.5, M.tugla, L / 2 - 1.2, 4.2, 0, g);
    dunya.add(g);
  }
  function icArka(R2) {
    const w = R.w;
    // raflar
    for (let x = 3; x < w - 3; x += 7 + R2() * 4) {
      const g = new THREE.Group(); g.position.set(x, 1, -1.25);
      [-1.3, 1.3].forEach((dx) => kutu(0.1, 4.2, 0.4, M.demir, dx, 2.1, 0, g));
      for (let y = 0.9; y < 4.2; y += 1.1) {
        kutu(2.7, 0.06, 0.45, M.tahta, 0, y, 0, g);
        for (let k = 0; k < 4; k++) if (R2() > 0.3) {
          const tip = R2(); const px = -1.05 + k * 0.7 + R2() * 0.1;
          if (tip < 0.4) silindir(0.12, 0.12, 0.28, M.pas, 10, px, y + 0.17, 0, g);
          else if (tip < 0.7) kutu(0.5, 0.4, 0.35, M.tahta, px, y + 0.23, 0, g);
          else kure(0.25, M.cuval, px, y + 0.2, 0, g, 1.1, 0.8, 0.8);
        }
      }
      dunya.add(g);
    }
    // tavan lambaları
    for (let x = 6; x < w; x += 12) {
      const g = new THREE.Group(); g.position.set(x, 11, -0.2);
      silindir(0.01, 0.01, 2.6, M.demir, 4, 0, -1.3, 0, g);
      const sapka = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5 })); sapka.position.y = -2.7; g.add(sapka);
      kure(0.1, M.cam, 0, -2.82, 0, g); const p = isilti(0xffc070, 1.8, 0.7); p.position.y = -2.85; g.add(p);
      const pl = new THREE.PointLight(0xffb468, 45, 15, 1.7); pl.position.y = -3.0; pl.castShadow = false; g.add(pl);
      const koni = isinKonisi(0.35, 2.4, 0xffc070, 0.07); koni.position.y = -2.8; koni.rotation.x = Math.PI / 2; koni.scale.z = 5.5; g.add(koni);
      dunya.add(g);
    }
    // tavan kirişleri
    for (let x = 2; x < w; x += 4) kutu(0.25, 0.35, 3.4, M.tahta, x, 10.8, 0, dunya);
  }

  // ================= OYUN MANTIĞI =================
  function adim(dt) {
    const P = R.P;
    R.istat.sure += dt;
    oyuncu(dt);
    sandiklar(dt);
    plakalarKapilar(dt);
    atilanlar(dt);
    etkilesim();
    tehlike(dt);
    if (basildi.kontrol) { basildi.kontrol = false; yakalan('Kontrol noktasına döndün.', true); }
    if (P.y < -3) yakalan('Düştün.');
  }

  function oyuncu(dt) {
    const P = R.P;
    let yon = (tus.sag ? 1 : 0) - (tus.sol ? 1 : 0);
    if (tus.egil && P.yer) P.egik = true;
    else if (P.egik && !kutuKati(P.x, P.y, PW, 1.5) && !kutuSandik(P.x, P.y, PW, 1.5)) P.egik = false;
    P.h = P.egik ? 0.9 : 1.5;
    const hedef = yon * (P.egik ? 2.4 : P.itiyor ? 3.0 : 5.6);
    P.vx += (hedef - P.vx) * Math.min(1, (P.yer ? 16 : 8) * dt);
    if (yon) P.yon = yon;
    P.tampon -= dt; P.coyote -= dt;
    if (basildi.zipla) { P.tampon = 0.14; basildi.zipla = false; }
    if (P.tampon > 0 && P.coyote > 0 && !P.egik) { P.vy = 12.4; P.tampon = 0; P.coyote = 0; P.yer = false; Ses.ef.zipla(); }
    P.vy = Math.max(-20, P.vy - ((P.vy > 0 && !tus.zipla) ? 62 : 32) * dt);
    P.itiyor = false;
    yatay(P.vx * dt);
    dikey(P.vy * dt);
    // adım sesi
    if (P.yer && Math.abs(P.vx) > 0.5) { P.adimT -= dt * Math.abs(P.vx) * (P.egik ? 0.5 : 1); if (P.adimT <= 0) { P.adimT = 1.2; Ses.ef.adim(!R.sv.ic); if (!R.sv.ic && !P.itiyor) izBirak(); } }
  }
  function yatay(dx) {
    const P = R.P; if (!dx) return;
    const n = Math.ceil(Math.abs(dx) / 0.08), s = dx / n;
    for (let k = 0; k < n; k++) {
      const nx = P.x + s;
      if (kutuKati(nx, P.y, PW, P.h)) { P.x = s > 0 ? Math.floor(nx + PW) - PW - 1e-3 : Math.floor(nx) + 1 + 1e-3; P.vx = 0; return; }
      const sd = kutuSandik(nx, P.y, PW, P.h);
      if (sd) {
        const dogru = Math.sign(s) === Math.sign(sd.x + SW / 2 - (P.x + PW / 2));
        if (P.yer && !P.egik && dogru && sandikYerde(sd)) {
          P.itiyor = true;
          if (sandikIt(sd, s)) { if (sd.sesT <= 0) { Ses.ef.sandik(); sd.sesT = 0.3; } P.x = s > 0 ? sd.x - PW - 1e-3 : sd.x + SW + 1e-3; continue; }
        }
        P.x = s > 0 ? sd.x - PW - 1e-3 : sd.x + SW + 1e-3; P.vx = 0; return;
      }
      P.x = nx;
    }
  }
  function dikey(dy) {
    const P = R.P, y0 = P.y; let ny = y0 + dy; const yerdeydi = P.yer; P.yer = false;
    if (dy < 0) {
      const z = zeminBul(P.x, PW, y0, ny);
      if (z !== null) { ny = z; if (!yerdeydi && P.vy < -7) { Ses.ef.dus(!R.sv.ic); toz(merkez(), z, 8); } P.vy = 0; P.yer = true; P.coyote = 0.1; }
    } else if (dy > 0 && kutuKati(P.x, ny, PW, P.h)) { ny = Math.floor(ny + P.h) - P.h - 1e-3; P.vy = 0; }
    P.y = ny;
  }
  const sandikYerde = (s) => zeminBul(s.x, SW, s.y + 0.001, s.y - 0.02, s) !== null;
  function sandikIt(s, dx) {
    const nx = s.x + dx;
    if (kutuKati(nx, s.y + 0.01, SW, SH - 0.02) || kutuSandik(nx, s.y + 0.01, SW, SH - 0.02, s)) return false;
    s.x = nx; s.itildi = 0.2; return true;
  }
  function sandiklar(dt) {
    R.sandiklar.forEach((s) => {
      s.sesT = (s.sesT || 0) - dt;
      s.vy = Math.max(-20, s.vy - 32 * dt);
      const ny = s.y + s.vy * dt;
      const z = zeminBul(s.x, SW, s.y, ny, s);
      if (z !== null) { if (s.vy < -6) { Ses.ef.dus(false); toz(s.x + 0.5, z, 10); } s.y = z; s.vy = 0; } else s.y = ny;
    });
  }
  function plakalarKapilar(dt) {
    const P = R.P;
    R.plakalar.forEach((p) => {
      const y = 11 - p.r, x0 = p.x + 0.1, x1 = p.x + 0.9;
      let b = P.yer && Math.abs(P.y - y) < 0.05 && P.x < x1 && P.x + PW > x0;
      R.sandiklar.forEach((s) => { if (Math.abs(s.y - y) < 0.05 && s.x < x1 && s.x + SW > x0) b = true; });
      if (b !== p.basili) { p.basili = b; Ses.ef.plaka(b); if (p.kapi) { p.kapi.hedef = b ? 1 : 0; if (b) Ses.ef.kapi(); } }
    });
    R.kapilar.forEach((k) => {
      let h = k.hedef;
      if (h < k.acik && k.acik > 0.5) { // kapanırken içinde biri varsa açık tut
        const x0 = k.x, y0 = 11 - k.r1, y1 = 12 - k.r0;
        const ici = (x, y, w, hh) => x < x0 + 1 && x + w > x0 && y < y1 && y + hh > y0;
        if (ici(P.x, P.y, PW, P.h) || R.sandiklar.some((s) => ici(s.x, s.y, SW, SH))) h = k.acik;
      }
      const hiz = k.tip === 'G' ? 0.9 : 1.6;
      k.acik += Math.sign(h - k.acik) * Math.min(Math.abs(h - k.acik), hiz * dt);
    });
  }
  function atilanlar(dt) {
    R.atilan.forEach((a) => {
      if (a.yerde) { a.omur -= dt; return; }
      a.vy -= 26 * dt; const nx = a.x + a.vx * dt;
      if (kati(Math.floor(nx), 11 - Math.floor(a.y))) a.vx *= -0.3; else a.x = nx;
      const ny = a.y + a.vy * dt, z = zeminBul(a.x - 0.1, 0.2, a.y, ny);
      if (z !== null) {
        a.y = z; a.yerde = true; Ses.ef.dus(!R.sv.ic);
        // köpekler koşar
        R.kopekler.forEach((d) => { if (Math.abs(d.x - a.x) < 11 && Math.abs(d.y - a.y) < 2.5 && !d.hedef) { d.hedef = a; d.durum = 'sosis'; Ses.ef.havla(); } });
      } else a.y = ny;
    });
    R.atilan = R.atilan.filter((a) => { if (a.omur <= 0) { dunya.remove(a.mesh); return false; } return true; });
  }

  function etkilesim() {
    const P = R.P, cx = merkez(), cy = P.y + P.h / 2;
    let ipucu = '';
    // eşyalar
    R.esyalar.forEach((e) => {
      if (e.alindi) return;
      const ex = e.x + 0.5, ey = 11 - e.r + 0.5;
      if (Math.abs(cx - ex) < 0.65 && P.y < ey + 0.5 && P.y + P.h > ey - 0.5) esyaAl(e);
    });
    // teller
    const x0 = Math.floor(P.x + 0.08), x1 = Math.floor(P.x + PW - 0.08), y0 = Math.floor(P.y + 0.1), y1 = Math.floor(P.y + P.h - 0.1);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const c = hucre(i, 11 - j);
      if (c === 'W' || (c === 'w' && P.y < j + 0.6 && cx > i + 0.15 && cx < i + 0.85)) {
        if (R.env.makas) { telKes(i, 11 - j); } else { yakalan('Dikenli tele takıldın!'); return; }
      }
    }
    // kontrol noktası
    R.kontroller.forEach((c, k) => {
      if (k > R.kontrolAktif && Math.abs(cx - (c.x + 0.5)) < 0.7) {
        R.kontrolAktif = k; c.aktif = true; R.snap = anlik(); Ses.ef.kontrol(); bilgi('Kontrol noktası. Yakalanırsan buradan devam.');
      }
    });
    // saklanma
    R.gizli = P.egik && R.saklan.some((s) => Math.abs(cx - (s.x + 0.5)) < 0.55 && Math.abs(P.y - (11 - s.r)) < 0.1);
    R.saklan.forEach((s) => { const yakin = Math.abs(cx - (s.x + 0.5)) < 0.9 && Math.abs(P.y - (11 - s.r)) < 0.1; s.mat.opacity += ((yakin ? 0.45 : 1) - s.mat.opacity) * 0.2; if (yakin && !P.egik) ipucu = '<b>S</b>Eğil ve saklan'; });
    // şalter
    R.salterler.forEach((s) => {
      if (Math.abs(cx - (s.x + 0.5)) < 1 && Math.abs(P.y - (11 - s.r)) < 0.2) {
        const l = R.isiklar[s.cfg.isik];
        if (l && l.kapaliT <= 0 && !R.karanlik) { ipucu = '<b>E</b>Şalteri indir'; if (basildi.kullan) { basildi.kullan = false; l.kapaliT = s.cfg.sure; Ses.ef.salter(); Ses.ef.karartma(); kivilcim(s.x + 0.6, 2.2, -0.8); bilgi('Projektör ' + s.cfg.sure + ' saniye karardı. Koş!'); } }
      }
    });
    // sigorta kutusu
    if (R.kutu && Math.abs(cx - (R.kutu.x + 0.5)) < 1.1) {
      const k = R.kutu, gerek = R.sv.sigorta;
      if (k.takili < gerek) {
        if (R.env.sigorta > 0) { ipucu = '<b>E</b>Sigortaları tak (' + R.env.sigorta + ')'; if (basildi.kullan) { basildi.kullan = false; k.takili += R.env.sigorta; R.env.sigorta = 0; Ses.ef.sigorta(); kivilcim(k.x + 0.5, 2.5, -0.9); if (k.takili >= gerek) karart(); else bilgi('Sigorta takıldı: ' + k.takili + '/' + gerek); hudGuncelle(); } }
        else ipucu = 'Sigorta kutusu: ' + k.takili + '/' + gerek + ' takılı';
      }
    }
    // kilitli kapı
    R.kapilar.forEach((k) => {
      if (k.tip !== 'G' || k.hedef === 1) return;
      const yakin = Math.abs(cx - (k.x + 0.5)) < 1.2 && P.y >= 11 - k.r1 - 0.1 && P.y < 12 - k.r0;
      if (!yakin) return;
      if (R.kutu) { ipucu = 'Kapı elektrikle kilitli. Sigorta kutusu?'; return; }
      if (R.env.anahtar) { k.hedef = 1; R.env.anahtar = 0; Ses.ef.kilit(); setTimeout(() => Ses.ef.kapi(), 200); bilgi('Kilit açıldı.'); hudGuncelle(); }
      else ipucu = 'Kilitli. Anahtar lazım.';
    });
    // sosis at
    if (basildi.at) {
      basildi.at = false;
      if (R.env.sosis > 0) {
        R.env.sosis--; Ses.ef.firlat(); hudGuncelle();
        const m = esyaModel('s'); dunya.add(m);
        R.atilan.push({ x: cx + P.yon * 0.4, y: P.y + 1.1, vx: P.yon * 7.5, vy: 5.5, yerde: false, omur: 9, mesh: m });
      } else if (R.i >= 3) bilgi('Sosisin kalmadı.');
    }
    // çıkış
    if (R.cikis && Math.abs(cx - (R.cikis.x + 0.5)) < 0.6) seviyeBitti();
    basildi.kullan = false;
    ipucuGoster(ipucu);
  }
  function esyaAl(e) {
    e.alindi = true; R.alinan.push(e.id); e.mesh.visible = false;
    const p = e.mesh.position; for (let k = 0; k < 14; k++) parca(p.x, p.y, 0, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5), 0xffd890, 0.25, 0.7, -2, true);
    const env = R.env;
    switch (e.tur) {
      case 'k': env.anahtar = 1; Ses.ef.al(); bilgi('Çaydanlığın dibinde bir anahtar!'); break;
      case 'c': env.makas = 1; Ses.ef.al(); bilgi('Tel makası! Dikenli teller artık sorun değil.'); break;
      case 's': env.sosis++; Ses.ef.al(); bilgi('Sosis (' + env.sosis + '). F ile fırlat, köpekler bayılır.'); break;
      case 'f': env.sigorta++; Ses.ef.al(); bilgi('Sigorta! ' + (env.sigorta + (R.kutu ? R.kutu.takili : 0)) + '/' + R.sv.sigorta); break;
      case 'o': env.ordek = 1; Ses.ef.ordek(); bilgi(R.sv.ordek); break;
      case 'x': Ses.ef.al(); bilgi(e.metin); break;
      case 'n': Ses.ef.not(); konus([['a', e.metin]]); break;
    }
    hudGuncelle();
  }
  function telKes(x, r) {
    const g = R.tel[x + ',' + r]; if (!g) return;
    const r0 = g.userData.r0 != null ? g.userData.r0 : r, r1 = g.userData.r1 != null ? g.userData.r1 : r;
    for (let q = r0; q <= r1; q++) { R.kesilen.push([x, q]); telSil(x, q); }
    g.userData.dus = 0.001; Ses.ef.makas(); kivilcim(x + 0.5, 11 - r + 0.5, 0);
  }
  function telSil(x, r, hemen) {
    R.g[r][x] = '.';
    if (hemen) { const g = R.tel[x + ',' + r]; if (g) g.userData.gizle = true; }
  }
  function karart() {
    R.karanlik = true; Ses.ef.karartma(); bilgi('Kule karardı! Kapı açılıyor.');
    R.kapilar.forEach((k) => { if (k.tip === 'G') k.hedef = 1; });
    setTimeout(() => Ses.ef.kapi(), 600);
  }

  // ================= TEHLİKE: projektör, muhafız, köpek =================
  function gorusAcik(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.2);
    for (let k = 1; k < n; k++) {
      const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      if (kati(Math.floor(x), 11 - Math.floor(y))) return false;
      if (R.sandiklar.some((s) => x > s.x && x < s.x + SW && y > s.y && y < s.y + SH)) return false;
    }
    return true;
  }
  function catiAltinda(x, yUst) {
    const i = Math.floor(x);
    for (let r = 11 - Math.floor(yUst); r >= 0; r--) { const c = hucre(i, r); if (c === '#' || c === '=' || ((c === 'D' || c === 'G') && kati(i, r))) return true; }
    return false;
  }
  function tehlike(dt) {
    const P = R.P, cx = merkez(), gizli = R.gizli || TEST;
    let artis = 0, sebep = '';
    // projektörler
    R.isiklar.forEach((l) => {
      l.faz += l.hiz * dt;
      l.bx = l.a + 0.5 + (l.b - l.a) * (0.5 + 0.5 * Math.sin(l.faz));
      if (l.kapaliT > 0) l.kapaliT -= dt;
      l.yanik = !R.karanlik && (l.kapaliT <= 0 || (l.kapaliT < 1.4 && Math.sin(zaman * 40) > 0.3));
      l.aktif = !R.karanlik && l.kapaliT <= 0;
      if (l.aktif && !gizli && Math.abs(cx - l.bx) < 1.25 && !catiAltinda(cx, P.y + P.h)) { artis += 1.7; sebep = 'Projektör seni buldu!'; }
    });
    // muhafızlar
    R.muhafizlar.forEach((m) => {
      const dx = cx - m.x, dy = P.y - m.y;
      const gorur = !gizli && dx * m.yon > -0.2 && Math.abs(dx) < 6.5 && Math.abs(dy) < 1.6 && gorusAcik(m.x, m.y + 1.4, cx, P.y + P.h * 0.6);
      if (Math.abs(dx) < 0.55 && Math.abs(dy) < 1.2 && !gizli) { yakalan('Muhafıza çarptın!'); return; }
      if (gorur) { artis += 1.0 + (1 - Math.abs(dx) / 6.5) * 2.0; sebep = 'Muhafız seni gördü!'; m.gormeT = 0; m.sonX = cx; } else m.gormeT += dt;
      // davranış
      m.bekle -= dt;
      if (m.gormeT < 0.1 && R.A > 0.55) m.durum = 'kovala';
      else if (m.gormeT < 0.1) m.durum = 'supheli';
      else if (m.durum !== 'devriye' && m.durum !== 'bak' && m.gormeT > 2.5) { m.durum = 'devriye'; }
      let v = 0;
      if (m.durum === 'devriye') {
        v = 1.5 * m.yon; m.x += v * dt;
        if ((m.yon > 0 && m.x >= m.b) || (m.yon < 0 && m.x <= m.a)) { m.x = Math.max(m.a, Math.min(m.b, m.x)); m.durum = 'bak'; m.bekle = 1.6; }
      } else if (m.durum === 'bak') { if (m.bekle <= 0) { m.yon *= -1; m.durum = 'devriye'; } }
      else if (m.durum === 'supheli') { if (m.gormeT < 0.1) m.yon = Math.sign(dx) || m.yon; }
      else if (m.durum === 'kovala') { const h = m.sonX != null ? m.sonX : cx; m.yon = Math.sign(h - m.x) || m.yon; if (Math.abs(h - m.x) > 0.4) { v = 3.0 * m.yon; m.x = Math.max(m.a - 1.5, Math.min(m.b + 1.5, m.x + v * dt)); } }
      m.v = v;
    });
    // köpekler
    R.kopekler.forEach((d) => {
      const dx = cx - d.x, dy = P.y - d.y;
      let v = 0;
      if (d.durum === 'sosis' && d.hedef) {
        const hx = d.hedef.x - d.x; d.yon = Math.sign(hx) || d.yon;
        if (Math.abs(hx) > 0.5) { v = 5 * d.yon; d.x += v * dt; } else { d.durum = 'ye'; d.yeT = 7; Ses.ef.hapur(); }
      } else if (d.durum === 'ye') {
        d.yeT -= dt; if (Math.floor(d.yeT * 2) !== Math.floor((d.yeT + dt) * 2) && Math.random() < 0.4) Ses.ef.hapur();
        if (d.yeT <= 0) { if (d.hedef) d.hedef.omur = 0; d.hedef = null; d.durum = 'devriye'; }
      } else {
        const kokla = Math.abs(dx) < 3.3 && Math.abs(dy) < 2 && !TEST;
        if (kokla) {
          artis += 2.4; sebep = 'Köpek kokunu aldı!'; d.yon = Math.sign(dx) || d.yon;
          if (d.durum !== 'kovala') { d.durum = 'kovala'; Ses.ef.havla(); d.havT = 1.2; }
          v = 4.4 * d.yon; d.x = Math.max(d.a - 1, Math.min(d.b + 1, d.x + v * dt));
          d.havT -= dt; if (d.havT <= 0) { Ses.ef.havla(); d.havT = 1.1; }
          if (Math.abs(dx) < 0.6 && Math.abs(dy) < 1.2) { yakalan('Köpek seni yakaladı!'); return; }
        } else {
          if (d.durum === 'kovala') d.durum = 'devriye';
          v = 2.0 * d.yon; d.x += v * dt;
          if ((d.yon > 0 && d.x >= d.b) || (d.yon < 0 && d.x <= d.a)) d.yon *= -1;
        }
      }
      d.v = v;
    });
    if (durum !== 'oyun') return;
    if (TEST) artis = 0;
    if (artis > 0) { if (R.A < 0.05) Ses.ef.supheli(); if (R.A < 0.55 && R.A + artis * dt >= 0.55) Ses.ef.farketti(); R.A += artis * dt; R.sebep = sebep; }
    else R.A = Math.max(0, R.A - 0.45 * dt);
    if (R.A >= 1) yakalan(R.sebep);
  }

  // ================= DURUM GEÇİŞLERİ =================
  function yakalan(sebep, istekle) {
    if (durum !== 'oyun') return;
    durum = 'yakalandi'; R.yakT = istekle ? 0.6 : 2.4; R.A = 1;
    if (!istekle) { R.istat.yak++; Ses.ef.yakalandi(); sarsinti = 0.5; $('#yakSebep').textContent = sebep; $('#yakalandi').classList.remove('gizli'); }
    ipucuGoster('');
  }
  function yenidenDogus() {
    $('#yakalandi').classList.add('gizli');
    perde(1, () => { seviyeKur(R.i, R.snap, R.istat); durum = 'oyun'; perde(0); });
  }
  function seviyeBitti() {
    if (durum !== 'oyun') return;
    durum = 'bitti'; Ses.ef.bitti();
    const i = R.i;
    if (R.env.ordek) kayit.ordek[i] = 1;
    kayit.acik = Math.max(kayit.acik, Math.min(SON, i + 2)); kayit.son = Math.min(SON - 1, i + 1); kaydet();
    const s = R.istat.sure, dk = Math.floor(s / 60), sn = Math.floor(s % 60);
    $('#bAd').textContent = R.sv.ad; $('#bAlt').textContent = 'Seviye ' + (i + 1) + ' / ' + SON;
    $('#bListe').innerHTML = `<dt>Süre</dt><dd>${dk}:${String(sn).padStart(2, '0')}</dd><dt>Yakalanma</dt><dd>${R.istat.yak}</dd><dt>Lastik ördek</dt><dd>${R.env.ordek ? 'Bulundu' : 'Kayıp'}</dd><dt>Toplam ördek</dt><dd>${kayit.ordek.reduce((a, b) => a + b, 0)} / ${SON}</dd>`;
    setTimeout(() => { $('#bitis').classList.remove('gizli'); $('#bDevam').focus(); }, 700);
  }
  $('#bDevam').onclick = () => {
    $('#bitis').classList.add('gizli');
    const i = R.i;
    if (i >= SON - 1) { perde(1, () => { perde(0); konus(FINAL, () => menuyeDon(true)); }); return; }
    perde(1, () => { seviyeKur(i + 1); perde(0); konus(ARA[i] || [], () => basla()); });
  };
  function basla() { durum = 'oyun'; hudGoster(true); bilgi(R.sv.ipucu, 4.5); }
  function oyunaBasla(i, giris) {
    Ses.baslat();
    ekran(null); perde(1, () => {
      seviyeKur(i); perde(0);
      if (giris) konus(GIRIS, basla); else basla();
    });
  }
  function menuyeDon(final) {
    durum = 'menu'; hudGoster(false);
    perde(1, () => { seviyeKur(final ? SON - 1 : 0); perde(0); ekran('#baslik'); menuHazirla(); });
  }
  function duraklat() { durum = 'durdur'; ekran('#durdur'); }
  function surdur() { ekran(null); durum = 'oyun'; }

  // ================= DİYALOG =================
  let dlg = null;
  function konus(liste, sonra) {
    if (!liste.length) { sonra && sonra(); return; }
    const onceki = durum;
    dlg = { liste, i: 0, k: 0, sonra, onceki };
    durum = 'konusma'; $('#diyalog').classList.remove('gizli'); ipucuGoster(''); dlgGoster();
  }
  function dlgGoster() {
    const [kim] = dlg.liste[dlg.i], k = KONUSMACI[kim];
    $('#dKim').textContent = k.ad; $('#dKim').style.color = k.renk; dlg.k = 0; $('#dYazi').textContent = '';
  }
  function diyalogIleri() {
    if (!dlg) return;
    const metin = dlg.liste[dlg.i][1];
    if (dlg.k < metin.length) { dlg.k = metin.length; $('#dYazi').textContent = metin; return; }
    dlg.i++;
    if (dlg.i >= dlg.liste.length) {
      const d = dlg; dlg = null; $('#diyalog').classList.add('gizli');
      durum = d.onceki === 'konusma' ? 'oyun' : d.onceki;
      if (d.sonra) d.sonra(); else durum = 'oyun';
      return;
    }
    Ses.ef.tik(); dlgGoster();
  }
  function dlgGuncelle(dt) {
    if (!dlg) return;
    const metin = dlg.liste[dlg.i][1];
    if (dlg.k < metin.length) { const once = Math.floor(dlg.k); dlg.k = Math.min(metin.length, dlg.k + dt * 55); if (Math.floor(dlg.k) !== once && once % 3 === 0) Ses.ef.yazi(); $('#dYazi').textContent = metin.slice(0, Math.floor(dlg.k)); }
  }

  // ================= ARAYÜZ =================
  function ekran(sec) { ['#baslik', '#seviyeEkran', '#sesEkran', '#durdur'].forEach((s) => $(s).classList.toggle('gizli', s !== sec)); }
  let perdeT = null;
  function perde(hedef, sonra) { const p = $('#perde'); p.style.opacity = hedef; clearTimeout(perdeT); if (sonra) perdeT = setTimeout(sonra, 620); }
  function hudGoster(g) { $('#hud').classList.toggle('gizli', !g); $('#dokun').classList.toggle('gizli', !(g && dokunmatik)); }
  let bilgiZaman = null;
  function bilgi(m, sure) { const b = $('#bilgi'); b.textContent = m; b.classList.add('acik'); clearTimeout(bilgiZaman); bilgiZaman = setTimeout(() => b.classList.remove('acik'), (sure || 3.2) * 1000); }
  let sonIpucu = null;
  function ipucuGoster(h) { if (h === sonIpucu) return; sonIpucu = h; const e = $('#ipucu'); e.innerHTML = h; e.classList.toggle('gizli', !h); }
  const IKON = {
    anahtar: '<svg viewBox="0 0 16 16"><circle cx="5" cy="8" r="3" fill="none" stroke="#e0b25a" stroke-width="1.6"/><path d="M8 8h7M13 8v3M11 8v2" stroke="#e0b25a" stroke-width="1.6"/></svg>',
    makas: '<svg viewBox="0 0 16 16"><path d="M3 14 L10 4 M13 14 L6 4" stroke="#c9ccd2" stroke-width="1.6"/><circle cx="3" cy="14" r="1.6" fill="#b3261e"/><circle cx="13" cy="14" r="1.6" fill="#b3261e"/></svg>',
    sosis: '<svg viewBox="0 0 16 16"><rect x="2" y="6" width="12" height="4.5" rx="2.2" fill="#a8452a"/><path d="M5 7.5h6" stroke="#d8775a" stroke-width="1"/></svg>',
    sigorta: '<svg viewBox="0 0 16 16"><rect x="5" y="2" width="6" height="12" rx="1" fill="none" stroke="#c8e0ff" stroke-width="1.4"/><path d="M8 4v8" stroke="#ff8030" stroke-width="1.4"/></svg>',
    ordek: '<svg viewBox="0 0 16 16"><ellipse cx="7" cy="10.5" rx="5.5" ry="3.5" fill="#ffd21a"/><circle cx="10.5" cy="6" r="2.6" fill="#ffd21a"/><path d="M12.8 6.2l2.4.6-2.4.8z" fill="#ff7a10"/></svg>',
  };
  function hudGuncelle(sevAd) {
    if (!R) return;
    if (sevAd) $('#sevAd').innerHTML = R.sv.ad + '<small>Seviye ' + (R.i + 1) + ' / ' + SON + '</small>';
    $('#rehber').textContent = R.sv.ipucu;
    const e = R.env, c = [];
    if (e.anahtar) c.push(IKON.anahtar + 'Anahtar');
    if (e.makas) c.push(IKON.makas + 'Makas');
    if (e.sosis) c.push(IKON.sosis + '× ' + e.sosis);
    if (R.sv.sigorta) c.push(IKON.sigorta + (e.sigorta + (R.kutu ? R.kutu.takili : 0)) + ' / ' + R.sv.sigorta);
    if (e.ordek) c.push(IKON.ordek + 'Ördek');
    const html = c.map((x) => '<div class="cip">' + x + '</div>').join('');
    if ($('#env').dataset.h !== html) { $('#env').innerHTML = html; $('#env').dataset.h = html; }
  }
  function alarmGuncelle() {
    const a = Math.min(1, R.A);
    $('#gozDol').style.width = (a * 100) + '%';
    $('#gozYazi').textContent = R.gizli ? 'SAKLANIYORSUN' : a > 0.55 ? 'FARK EDİLDİN' : a > 0.05 ? 'ŞÜPHE' : '';
    $('#gozBebek').setAttribute('r', 2.5 + a * 3);
    $('#gozBebek').setAttribute('fill', a > 0.55 ? '#e0483a' : R.gizli ? '#6a8a6a' : '#e9dfc6');
    $('#tehlike').style.opacity = durum === 'yakalandi' ? 1 : Math.max(0, (a - 0.3) * 1.2);
  }
  function menuHazirla() {
    const devam = kayit.acik > 1;
    $('#devamBtn').style.display = devam ? '' : 'none';
    $('#devamYazi').textContent = devam ? 'Seviye ' + (kayit.son + 1) + ': ' + SEVIYELER[kayit.son].ad : '';
    const l = $('#sevListe'); l.innerHTML = '';
    SEVIYELER.forEach((s, i) => {
      const b = document.createElement('button'); b.disabled = i + 1 > kayit.acik;
      b.innerHTML = `<span>${i + 1}. ${s.ad}</span><span>${b.disabled ? 'Kilitli' : kayit.ordek[i] ? 'Ördek ✓' : ''}</span>`;
      b.onclick = () => oyunaBasla(i, false); l.appendChild(b);
    });
    document.querySelectorAll('[data-s]').forEach((r) => { r.value = Ses.ayar[r.dataset.s]; r.nextElementSibling.textContent = Math.round(r.value * 100); r.oninput = () => { Ses.ayar[r.dataset.s] = +r.value; r.nextElementSibling.textContent = Math.round(r.value * 100); Ses.kaydet(); }; });
  }
  let sesDonus = '#baslik';
  document.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
    Ses.baslat(); Ses.ef.tik();
    const a = b.dataset.a;
    if (a === 'yeni') oyunaBasla(0, true);
    else if (a === 'devam') oyunaBasla(kayit.son, false);
    else if (a === 'seviyeler') ekran('#seviyeEkran');
    else if (a === 'ses') { sesDonus = durum === 'durdur' ? '#durdur' : '#baslik'; ekran('#sesEkran'); }
    else if (a === 'surdur') surdur();
    else if (a === 'kontrol') { surdur(); yakalan('', true); }
    else if (a === 'anamenu') menuyeDon(false);
  }));
  document.querySelectorAll('[data-geri]').forEach((b) => b.addEventListener('click', () => { Ses.ef.tik(); ekran(durum === 'durdur' ? '#durdur' : '#baslik'); }));
  $('#durdurBtn').addEventListener('click', () => { if (durum === 'oyun') duraklat(); });

  // ================= AYAK İZLERİ =================
  let izGeo = null, izMat = null;
  function izBirak() {
    const P = R.P; if (P.y > 1.05) return;
    if (!izGeo) { izGeo = new THREE.PlaneGeometry(0.12, 0.26); izGeo.rotateX(-Math.PI / 2); izMat = new THREE.MeshStandardMaterial({ color: 0x8090b0, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
    R.izSol = !R.izSol;
    const m = new THREE.Mesh(izGeo, izMat); m.position.set(merkez(), 1.003, R.izSol ? 0.1 : -0.1); m.rotation.y = P.yon > 0 ? Math.PI / 2 : -Math.PI / 2; m.receiveShadow = true;
    dunya.add(m); (R.izler = R.izler || []).push(m);
    if (R.izler.length > 60) dunya.remove(R.izler.shift());
  }

  // ================= PARÇACIKLAR =================
  function parca(x, y, z, vx, vy, vz, renk, boy, omur, yer, parlak, buyu) {
    if (R.parcalar.length > 220) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: parilti(), color: renk, transparent: true, depthWrite: false, blending: parlak ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: parlak ? 1 : 0.5 }));
    s.position.set(x, y, z); s.scale.setScalar(boy); dunya.add(s);
    R.parcalar.push({ s, v: new V3(vx, vy, vz), omur, maks: omur, yer: yer || 0, boy, buyu: buyu || 0, opak: s.material.opacity });
  }
  function toz(x, y, n) { for (let k = 0; k < n; k++) parca(x + (Math.random() - 0.5) * 0.4, y + 0.05, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 2.5, Math.random() * 1.2, (Math.random() - 0.5), R.sv.ic ? 0x8a7a68 : 0xf0f4ff, 0.22, 0.6, -3, false, 0.6); }
  function kivilcim(x, y, z) { for (let k = 0; k < 22; k++) parca(x, y, z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 2, 0xffc060, 0.12, 0.6 + Math.random() * 0.4, -12, true); }
  function parcaGuncelle(dt) {
    R.parcalar = R.parcalar.filter((p) => {
      p.omur -= dt; if (p.omur <= 0) { dunya.remove(p.s); p.s.material.dispose(); return false; }
      p.v.y += p.yer * dt; p.s.position.addScaledVector(p.v, dt);
      const t = p.omur / p.maks; p.s.material.opacity = p.opak * t; p.s.scale.setScalar(p.boy * (1 + (1 - t) * p.buyu * 3));
      return true;
    });
  }

  // ================= GÖRSEL GÜNCELLEME =================
  const geciciV = new V3();
  function gorsel(dt) {
    const P = R.P;
    // oyuncu
    const hiz = Math.min(1, Math.abs(P.vx) / 5.6);
    P.animT += dt * (4 + Math.abs(P.vx) * 1.9);
    const hedefDon = P.yon > 0 ? Math.PI / 2 : -Math.PI / 2;
    P.donus += (hedefDon - P.donus) * Math.min(1, dt * 12);
    P.mesh.rotation.y = P.donus;
    P.mesh.position.set(merkez(), P.y, 0);
    P.dolgu.position.set(merkez() + 0.6, P.y + 2.2, 2.6);
    animInsan(P.mesh, { t: P.animT, hiz: P.yer ? hiz : 0, egik: P.egik, havada: !P.yer, vy: P.vy, it: P.itiyor, zaman, eller: durum === 'yakalandi' && R.yakT < 2.3 && R.yakT > 0.2 && R.sebep !== '' , bak: 0 });
    // nefes buharı
    if (!R.sv.ic) { P.nefesT -= dt; if (P.nefesT <= 0) { P.nefesT = 1.3 + Math.random() * 0.6; const by = P.y + (P.egik ? 0.95 : 1.45); for (let k = 0; k < 3; k++) parca(merkez() + P.yon * 0.2, by, 0.05, P.yon * (0.3 + Math.random() * 0.3), 0.2 + Math.random() * 0.15, 0, 0xdde6f5, 0.14, 1.4, 0, false, 1.2); } }
    // muhafızlar
    R.muhafizlar.forEach((m) => {
      m.animT += dt * (3 + Math.abs(m.v || 0) * 2.2);
      const hd = m.yon > 0 ? Math.PI / 2 : -Math.PI / 2; m.don = m.don == null ? hd : m.don + (hd - m.don) * Math.min(1, dt * 6);
      m.mesh.rotation.y = m.don; m.mesh.position.set(m.x, m.y, -0.15);
      const bak = m.durum === 'bak' ? Math.sin(zaman * 2.2) * 0.7 : 0;
      animInsan(m.mesh, { t: m.animT, hiz: Math.min(1, Math.abs(m.v || 0) / 3), zaman, fener: true, bak });
      m.isik.target.position.set(0.1 + bak * 3, 0.1, 6);
      m.koni.rotation.y = bak * 0.45;
      ikonYaz(m.ikon, m.durum === 'kovala' ? '!' : m.durum === 'supheli' ? '?' : '', m.durum === 'kovala' ? '#ff4030' : '#ffd040');
    });
    R.kopekler.forEach((d) => {
      d.animT += dt * (4 + Math.abs(d.v || 0) * 3);
      const hd = d.yon > 0 ? Math.PI / 2 : -Math.PI / 2; d.don = d.don == null ? hd : d.don + (hd - d.don) * Math.min(1, dt * 8);
      d.mesh.rotation.y = d.don; d.mesh.position.set(d.x, d.y - 0.02, 0.2);
      animKopek(d.mesh, { t: d.animT, hiz: Math.min(1, Math.abs(d.v || 0) / 4), zaman, ye: d.durum === 'ye', kokla: d.durum === 'kovala' });
      ikonYaz(d.ikon, d.durum === 'kovala' ? '!' : d.durum === 'ye' ? '♥' : '', d.durum === 'kovala' ? '#ff4030' : '#ff8aa0');
    });
    // projektörler
    R.isiklar.forEach((l) => {
      const hx = l.bx != null ? l.bx : l.a;
      l.hd.position.set(hx, 1, 0);
      l.sp.intensity = l.yanik ? 2600 : 0;
      l.koni.visible = l.leke.visible = l.lens.visible = l.yanik;
      geciciV.set(hx, 1, 0); l.koni.position.copy(l.kaynak); l.koni.lookAt(geciciV); l.koni.scale.z = l.kaynak.distanceTo(geciciV);
      l.koni.material.uniforms.t.value = zaman;
      l.leke.position.set(hx, 1.02, 0);
      l.yuva.lookAt(geciciV.set(hx, 1, 0)); l.yuva.rotation.x += 0;
    });
    // kapılar
    R.kapilar.forEach((k) => {
      if (k.tip === 'D') k.mesh.userData.levha.position.y = k.acik * (k.mesh.userData.boy - 0.2);
      else { k.mesh.userData.kanat.rotation.y = -k.acik * 1.75; k.mesh.userData.kilit.visible = k.hedef === 0; }
    });
    R.plakalar.forEach((p) => { p.ust.position.y = p.basili ? 0.05 : 0.08; p.lamba.material = p.basili ? M.yesilLamba : M.kirmiziLamba; if (p.kapiLamba) p.kapiLamba.material = p.lamba.material; });
    R.salterler.forEach((s) => { const l = R.isiklar[s.cfg.isik]; const kapali = l && (l.kapaliT > 0 || R.karanlik); s.kol.rotation.z += ((kapali ? -0.5 : 0.5) - s.kol.rotation.z) * 0.2; s.lamba.material = kapali ? M.kirmiziLamba : M.yesilLamba; });
    if (R.kutu) R.kutu.yuvalar.forEach((y, k) => { y.material = k < R.kutu.takili ? M.yesilLamba : M.kirmiziLamba; });
    // teller
    for (const k in R.tel) {
      const g = R.tel[k];
      if (g.userData.gizle) g.visible = false;
      else if (g.userData.dus) { g.userData.dus += dt; g.rotation.z = -Math.min(1.5, g.userData.dus * g.userData.dus * 4); g.position.y -= dt * 0.6; if (g.userData.dus > 1.2) g.visible = false; }
    }
    // eşyalar
    R.esyalar.forEach((e) => { if (!e.alindi) { e.mesh.children[0].rotation.y = zaman * 1.6; e.mesh.position.y = 11 - e.r + 0.45 + Math.sin(zaman * 2.4 + e.x) * 0.08; } });
    // sandıklar
    R.sandiklar.forEach((s) => { s.mesh.position.set(s.x + SW / 2, s.y, 0); });
    // atılan sosisler
    R.atilan.forEach((a) => { a.mesh.position.set(a.x, a.y + (a.yerde ? 0.06 : 0), 0.1); if (!a.yerde) a.mesh.rotation.z += dt * 12; });
    // ateşler
    R.kontroller.forEach((c) => {
      const f = c.aktif ? 1 : 0.15;
      c.alevler.forEach((s, k) => { const t = zaman * (7 + k * 2.3) + k; s.material.opacity = f * (0.55 + Math.sin(t) * 0.25); s.scale.setScalar((0.55 + Math.sin(t * 1.3) * 0.12) * (c.aktif ? 1.2 : 0.6)); s.position.y = 0.95 + Math.sin(t * 0.7) * 0.05 + k * 0.08; });
      c.isik.intensity = c.aktif ? 14 + Math.sin(zaman * 13) * 2 + Math.sin(zaman * 7.3) * 2 : 0.6;
      if (c.aktif && Math.random() < dt * 8) parca(c.x + 0.5 + (Math.random() - 0.5) * 0.3, 2.0, -1.1, (Math.random() - 0.5) * 0.4, 1 + Math.random(), 0, 0xffa040, 0.06, 0.9, 0.5, true);
    });
    parcaGuncelle(dt);
    // gökyüzü, kar
    gok.material.uniforms.t.value = zaman;
    kar.userData.guncelle(dt, kamera.position.x, 4, zaman);
    gok.position.set(kamera.position.x, 0, 0);
  }

  function kameraGuncelle(dt, menu) {
    const P = R.P;
    let hx, hy;
    if (menu) { hx = 12 + Math.sin(zaman * 0.05) * 8; hy = 4.6; }
    else { hx = merkez() + P.yon * 1.4; hy = 3.5 + Math.max(0, P.y - 1) * 0.6; }
    const yar = Math.min(8.5, R.w / 2 - 0.5);
    hx = Math.max(yar, Math.min(R.w - yar, hx));
    const k = Math.min(1, dt * (menu ? 1 : 3.2));
    kamera.userData.x = (kamera.userData.x == null ? hx : kamera.userData.x + (hx - kamera.userData.x) * k);
    kamera.userData.y = (kamera.userData.y == null ? hy : kamera.userData.y + (hy - kamera.userData.y) * k);
    const sx = sarsinti > 0 ? (Math.random() - 0.5) * sarsinti : 0, sy = sarsinti > 0 ? (Math.random() - 0.5) * sarsinti : 0;
    sarsinti = Math.max(0, sarsinti - dt);
    kamera.position.set(kamera.userData.x + sx, kamera.userData.y + 1.3 + sy, menu ? 12 : 11.5);
    kamera.lookAt(kamera.userData.x, kamera.userData.y, 0);
    ay.position.set(kamera.userData.x - 10, 22, 14); ay.target.position.set(kamera.userData.x, 2, 0);
  }

  // ================= DÖNGÜ =================
  function boyutla() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); kamera.aspect = w / h;
    kamera.fov = w / h < 1.2 ? 58 : 40; kamera.updateProjectionMatrix();
  }
  addEventListener('resize', boyutla); boyutla();

  let once = performance.now(), birikim = 0, testDur = false;
  const ADIM = 1 / 60;
  function dongu(su) {
    requestAnimationFrame(dongu);
    const dt = Math.min(0.1, (su - once) / 1000); once = su;
    if (testDur) return;
    zaman += dt;
    if (durum === 'oyun') {
      birikim += dt;
      while (birikim >= ADIM) { adim(ADIM); birikim -= ADIM; if (durum !== 'oyun') break; }
      Ses.kalp(dt, R.A);
    } else { birikim = 0; Ses.kalp(dt, 0); for (const k in basildi) basildi[k] = false; }
    if (durum === 'yakalandi') { R.yakT -= dt; if (R.yakT <= 0 && !R.yeniden) { R.yeniden = true; yenidenDogus(); } }
    if (durum === 'konusma') dlgGuncelle(dt);
    if (durum !== 'oyun' && durum !== 'yakalandi' && R) tehlikeGorsel(dt);
    gorsel(dt);
    kameraGuncelle(dt, durum === 'menu');
    if (durum !== 'menu') alarmGuncelle();
    renderer.render(sahne, kamera);
  }
  // diyalog/duraklatma sırasında projektörler dönmeye devam etsin (yalnız görsel)
  function tehlikeGorsel(dt) { R.isiklar.forEach((l) => { l.faz += l.hiz * dt * 0.3; l.bx = l.a + 0.5 + (l.b - l.a) * (0.5 + 0.5 * Math.sin(l.faz)); l.yanik = !R.karanlik && l.kapaliT <= 0; }); }

  // ================= BAŞLAT =================
  seviyeKur(0);
  R.isiklar.forEach((l) => { l.yanik = true; });
  menuHazirla();
  const dogrudan = URL_P.get('sv');
  if (dogrudan !== null) { ekran(null); seviyeKur(Math.max(0, Math.min(SON - 1, +dogrudan))); basla(); }
  perde(0);
  requestAnimationFrame(dongu);

  // test kancaları
  function simule(sn) {
    const n = Math.round(sn * 60);
    for (let k = 0; k < n; k++) {
      while (durum === 'konusma' && dlg) { dlg.k = 1e9; diyalogIleri(); }
      if (durum !== 'oyun') break;
      adim(ADIM); zaman += ADIM; for (const q in basildi) basildi[q] = false;
    }
  }
  window.GK = { simule, dondur: (b) => { testDur = b; }, ciz: () => { gorsel(0.016); kameraGuncelle(1, false); renderer.render(sahne, kamera); }, R: () => R, durum: () => durum, tus, basildi, seviyeKur: (i) => { seviyeKur(i); basla(); }, kamera, renderer, oyunaBasla };
})();
