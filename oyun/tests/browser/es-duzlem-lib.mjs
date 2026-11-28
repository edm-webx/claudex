// Eş düzlem (z-fighting) tarayıcısı (2026-11-22, kullanıcı: "merdiven hala sıkıntılı, felaket siyah yanıp sönüyor").
// Sahnedeki görünür opak üçgenleri dünya uzayında toplar; aynı düzlemde (normal aynı yönde, uzaklık < TOL) duran ve
// izdüşümleri MIN_ALAN'dan fazla örtüşen, FARKLI renk/malzemeden iki yüzü bulur. Gerçek GPU'da bu ikili derinlik testinde
// kare kare yer değiştirir: "yanıp sönen siyah kare". Sayfa içinde çalışır (page.evaluate(esDuzlemTara, {...})).
// polygonOffset'li çıkartmalar (bilerek üstte), derinlik yazmayan saydamlar, iskeletli karakterler hariçtir.
export function esDuzlemTara(opt) {
  const TOL = opt?.tol ?? 0.001, MIN_ALAN = opt?.minAlan ?? 0.0025, KUTU = opt?.kutu ?? null, MAX = opt?.max ?? 60;
  // kamera hep yukarıdan bakar (eğim 0.3..1.4 rad): aşağı bakan yüzler (taban, tavan altı) görünmez, varsayılan olarak sayılmaz
  const ASAGI = opt?.asagi ?? false, ATLA = new RegExp(opt?.atla ?? '^(crowd|chars?)\\b');
  const scene = window.__marti.sahne();
  const tris = [];   // [ax,ay,az,bx,by,bz,cx,cy,cz, nx,ny,nz,d, kimlik, sahip]
  const bozuk = [];
  const sahipler = [], ad = o => { const p = []; for (let q = o; q && p.length < 4; q = q.parent) if (q.name) p.push(q.name); return p.join('<') || o.type; };
  const gorunur = o => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
  const m4 = (e, x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
  const mul = (a, b) => { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !gorunur(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry, pos = g.attributes.position, idx = g.index, col = g.attributes.color;
    const groups = g.groups?.length && Array.isArray(o.material) ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
    const inst = o.isInstancedMesh ? o.count : 1;
    const sahip = sahipler.push(ad(o)) - 1;
    // bozuk normal: uzunluğu 0 ya da NaN olan köşe normali, shader'da normalize(0) = NaN, bloom bunu siyah bloklara yayar (2026-11-22)
    const nrm = g.attributes.normal; if (nrm && !mats.every(m => m.isMeshBasicMaterial)) { let kotu = 0; for (let i = 0; i < nrm.count; i++) { const l = Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)); if (!(l > 0.5)) kotu++; } if (kotu) bozuk.push({ ad: sahipler[sahip], tip: g.type + (o.isInstancedMesh ? ' x' + o.count : ''), kotu, toplam: nrm.count }); }
    for (let q = o; q; q = q.parent) if (q.name && ATLA.test(q.name)) return;   // eş düzlem taraması hareketli kalabalığı saymaz
    if (o.isSkinnedMesh) return;
    for (let k = 0; k < inst; k++) {
      let e = o.matrixWorld.elements;
      if (o.isInstancedMesh) e = mul(o.matrixWorld.elements, Array.from(o.instanceMatrix.array.slice(k * 16, k * 16 + 16)));
      for (const gr of groups) {
        const mat = mats[gr.materialIndex] || mats[0];
        if (!mat || mat.visible === false || mat.polygonOffset || mat.depthTest === false || (mat.transparent && !mat.depthWrite) || mat.colorWrite === false) continue;
        const ift = mat.side === 2;
        const end = Math.min(gr.start + gr.count, idx ? idx.count : pos.count);
        for (let i = gr.start; i + 2 < end; i += 3) {
          const v = [0, 1, 2].map(j => { const n = idx ? idx.getX(i + j) : i + j; return n; });
          const P = v.map(n => m4(e, pos.getX(n), pos.getY(n), pos.getZ(n)));
          if (KUTU && (P.every(p => p[0] < KUTU.x0) || P.every(p => p[0] > KUTU.x1) || P.every(p => p[2] < KUTU.z0) || P.every(p => p[2] > KUTU.z1) || P.every(p => p[1] < (KUTU.y0 ?? -1e9)) || P.every(p => p[1] > (KUTU.y1 ?? 1e9)))) continue;
          const ux = P[1][0] - P[0][0], uy = P[1][1] - P[0][1], uz = P[1][2] - P[0][2], wx = P[2][0] - P[0][0], wy = P[2][1] - P[0][1], wz = P[2][2] - P[0][2];
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const L = Math.hypot(nx, ny, nz); if (L < 1e-7) continue;
          nx /= L; ny /= L; nz /= L; if (!ASAGI && ny < -0.3) continue;
          let renk = mat.color ? mat.color.getHexString() : 'x';
          if (col) { let r = 0, gg = 0, bb = 0; for (const n of v) { r += col.getX(n); gg += col.getY(n); bb += col.getZ(n); } renk += ':' + Math.round(r * 20) + ',' + Math.round(gg * 20) + ',' + Math.round(bb * 20); }
          const kimlik = mat.uuid + '|' + renk + (mat.map ? '|t' + mat.map.uuid : '');
          tris.push([...P[0], ...P[1], ...P[2], nx, ny, nz, nx * P[0][0] + ny * P[0][1] + nz * P[0][2], kimlik, sahip, ift ? 1 : 0, L / 2]);
          if (tris.length > 4e6) return;
        }
      }
    }
  });
  // düzlem kovaları: yön (0.005 rad) + uzaklık (2 mm), komşu uzaklık kovası da yoklanır
  const kova = new Map();
  const yon = t => Math.round(t[9] * 200) + ',' + Math.round(t[10] * 200) + ',' + Math.round(t[11] * 200);
  tris.forEach((t, i) => { const k = yon(t) + '|' + Math.round(t[12] / 0.002); let a = kova.get(k); if (!a) kova.set(k, a = []); a.push(i); });
  const iz = (t, ax) => [[t[ax[0]], t[ax[1]]], [t[3 + ax[0]], t[3 + ax[1]]], [t[6 + ax[0]], t[6 + ax[1]]]];
  const alan = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const kes = (S, C) => {   // Sutherland-Hodgman, C saat yönünün tersine
    let out = S;
    for (let i = 0; i < C.length && out.length; i++) {
      const a = C[i], b = C[(i + 1) % C.length], inp = out; out = [];
      const ic = p => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= -1e-9;
      for (let j = 0; j < inp.length; j++) {
        const p = inp[j], q = inp[(j + 1) % inp.length], pi = ic(p), qi = ic(q);
        if (pi) out.push(p);
        if (pi !== qi) { const dx = q[0] - p[0], dy = q[1] - p[1], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex; if (Math.abs(den) > 1e-12) { const s = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den; out.push([p[0] + dx * s, p[1] + dy * s]); } }
      }
    }
    return out.length >= 3 ? Math.abs(alan(out)) : 0;
  };
  const bulgu = new Map(); const gor = new Set();
  for (const [k, liste] of kova) {
    const [y, dk] = k.split('|'); const komsu = [...liste, ...(kova.get(y + '|' + (+dk + 1)) || [])];
    if (komsu.length < 2) continue;
    // 2B ızgara (1 m) aday ikililer için
    const t0 = tris[liste[0]], an = Math.abs(t0[9]) > Math.abs(t0[10]) ? (Math.abs(t0[9]) > Math.abs(t0[11]) ? 0 : 2) : (Math.abs(t0[10]) > Math.abs(t0[11]) ? 1 : 2);
    const ax = [0, 1, 2].filter(a => a !== an);
    const hucre = new Map();
    for (const i of komsu) { const P = iz(tris[i], ax); const x0 = Math.floor(Math.min(P[0][0], P[1][0], P[2][0])), x1 = Math.floor(Math.max(P[0][0], P[1][0], P[2][0])), z0 = Math.floor(Math.min(P[0][1], P[1][1], P[2][1])), z1 = Math.floor(Math.max(P[0][1], P[1][1], P[2][1]));
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) continue;
      for (let a = x0; a <= x1; a++) for (let b = z0; b <= z1; b++) { const hk = a + ',' + b; let h = hucre.get(hk); if (!h) hucre.set(hk, h = []); h.push(i); } }
    for (const h of hucre.values()) {
      if (h.length < 2 || h.length > 3000) continue;
      for (let p = 0; p < h.length; p++) for (let q = p + 1; q < h.length; q++) {
        const i = Math.min(h[p], h[q]), j = Math.max(h[p], h[q]); if (i === j) continue;
        const A = tris[i], B = tris[j];
        if (A[13] === B[13]) continue;   // aynı malzeme+renk: görünür titreme yok
        if (A[9] * B[9] + A[10] * B[10] + A[11] * B[11] < 0.9998 || Math.abs(A[12] - B[12]) > TOL * 4) continue;
        // gerçek eş düzlem: her iki üçgenin köşeleri ötekinin düzlemine TOL'dan yakın (büyük, hafif eğik yüzlerde d tek başına yanıltır)
        let uz = 0; for (let v = 0; v < 9; v += 3) { uz = Math.max(uz, Math.abs(A[9] * B[v] + A[10] * B[v + 1] + A[11] * B[v + 2] - A[12]), Math.abs(B[9] * A[v] + B[10] * A[v + 1] + B[11] * A[v + 2] - B[12])); }
        if (uz > TOL) continue;
        const pk = i + ':' + j; if (gor.has(pk)) continue; gor.add(pk);
        let PA = iz(A, ax), PB = iz(B, ax); if (alan(PA) < 0) PA = PA.reverse(); if (alan(PB) < 0) PB = PB.reverse();
        const s = kes(PA, PB); if (s < 1e-5) continue;
        const key = sahipler[A[14]] + ' ⟂ ' + sahipler[B[14]];
        const c = [(A[0] + A[3] + A[6]) / 3, (A[1] + A[4] + A[7]) / 3, (A[2] + A[5] + A[8]) / 3].map(v => +v.toFixed(2));
        const renk = k => k.split('|').slice(1).join('|');
        const r = bulgu.get(key) || { a: sahipler[A[14]], b: sahipler[B[14]], alan: 0, n: 0, ornek: c, normal: [A[9], A[10], A[11]].map(v => +v.toFixed(2)), d: +A[12].toFixed(4), renkA: renk(A[13]), renkB: renk(B[13]), ucA: A.slice(0, 9).map(v => +v.toFixed(3)), ucB: B.slice(0, 9).map(v => +v.toFixed(3)) };
        r.alan += s; r.n++; bulgu.set(key, r);
      }
    }
  }
  const list = [...bulgu.values()].filter(r => r.alan >= MIN_ALAN).sort((a, b) => b.alan - a.alan).map(r => ({ ...r, alan: +r.alan.toFixed(4) }));
  return { ucgen: tris.length, bulgu: list.length + bozuk.length, list: list.slice(0, MAX), bozukNormal: bozuk };
}
