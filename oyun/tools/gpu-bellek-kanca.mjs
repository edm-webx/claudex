// PRF-15/PRF-11: GPU bellek sayacı (yalnız ölçüm araçlarında, sayfaya addInitScript ile girer; oyun koduna girmez).
// WebGL çağrılarını sarar ve canlı her doku / renderbuffer / tampon için kaç bayt ayrıldığını tutar:
//   texImage2D/3D, texStorage2D/3D, compressedTexImage2D, generateMipmap (x4/3), renderbufferStorage(Multisample) (x örnek),
//   bufferData; deleteTexture/deleteRenderbuffer/deleteBuffer ve loseContext düşer. Ekran tamponu ayrıca tahmin edilir.
// Sonuç window.__gpuBellek(): { dokuMB, rbMB, tamponMB, ekranMB, toplamMB, doku, rb, tampon, enBuyuk: [{ w, h, mb, mip, tur }] }.
// Sayılar sürücüden bağımsız alt sınırdır (sürücü hizalaması ve iç kopyalar dahil değil); SwiftShader'da da aynıdır.
export function gpuBellekKanca() {
  const BPP = { 0x8058: 4, 0x8051: 4, 0x881a: 8, 0x8814: 16, 0x881b: 8, 0x8815: 16, 0x8229: 1, 0x822b: 2, 0x822d: 2, 0x822f: 4, 0x822e: 4, 0x8230: 8, 0x88f0: 4, 0x81a5: 2, 0x81a6: 4, 0x8cac: 4, 0x8cad: 8, 0x8c43: 4, 0x8d62: 2, 0x8056: 2, 0x8057: 2, 0x8c3a: 4, 0x8c3d: 4, 0x8f97: 1, 0x8d48: 1, 0x1908: 4, 0x1907: 4, 0x1909: 1, 0x190a: 2, 0x1906: 1, 0x1902: 4, 0x84f9: 4 };
  const TYPE_MUL = { 0x140b: 2, 0x8d61: 2, 0x1406: 4 };   // HALF_FLOAT, HALF_FLOAT_OES, FLOAT (yalnız boyutsuz biçimlerde)
  const tex = new Map(), rb = new Map(), buf = new Map(), ctxOf = new Map();
  const st = new WeakMap();
  const S = gl => { let s = st.get(gl); if (!s) { s = { unit: 0, tex: new Map(), rb: null, buf: new Map() }; st.set(gl, s); } return s; };
  const bpp = (fmt, type) => { const b = BPP[fmt] ?? 4; return (fmt === 0x1908 || fmt === 0x1907) && TYPE_MUL[type] ? b * TYPE_MUL[type] : b; };
  const srcWH = s => s ? [s.videoWidth || s.naturalWidth || s.displayWidth || s.codedWidth || s.width || 0, s.videoHeight || s.naturalHeight || s.displayHeight || s.codedHeight || s.height || 0] : [0, 0];
  const CUBE0 = 0x8515, CUBE = 0x8513;
  const bound = (gl, target) => S(gl).tex.get(S(gl).unit + ':' + (target >= CUBE0 && target < CUBE0 + 6 ? CUBE : target));
  const setLevel = (gl, target, level, w, h, d, bytesPer, tur) => {
    const t = bound(gl, target); if (!t) return; const r = tex.get(t); if (!r) return;
    r.lv.set(target + ':' + level, w * h * d * bytesPer); if (level === 0) { r.w = w; r.h = h; r.d = d; r.tur = tur; }
  };
  for (const P of [globalThis.WebGL2RenderingContext?.prototype, globalThis.WebGLRenderingContext?.prototype].filter(Boolean)) {
    const wrap = (name, fn) => { const o = P[name]; if (!o) return; P[name] = function (...a) { const r = o.apply(this, a); try { fn.call(this, a, r); } catch { /* ölçüm oyunu bozmaz */ } return r; }; };
    wrap('createTexture', function (a, t) { if (t) { tex.set(t, { lv: new Map(), mip: false, w: 0, h: 0, d: 1, tur: '' }); ctxOf.set(t, this); } });
    wrap('deleteTexture', (a) => tex.delete(a[0]));
    wrap('activeTexture', function (a) { S(this).unit = a[0] - 0x84c0; });
    wrap('bindTexture', function (a) { S(this).tex.set(S(this).unit + ':' + a[0], a[1]); });
    wrap('texImage2D', function (a) {
      const [target, level, ifmt] = a; let w, h, type;
      if (a.length >= 8) { w = a[3]; h = a[4]; type = a[7]; } else { [w, h] = srcWH(a[5]); type = a[4]; }
      setLevel(this, target, level, w, h, 1, bpp(ifmt, type), 'img');
    });
    wrap('texImage3D', function (a) { setLevel(this, a[0], a[1], a[3], a[4], a[5], bpp(a[2], a[8]), '3d'); });
    wrap('texStorage2D', function (a) { const [target, levels, ifmt, w, h] = a; const b = bpp(ifmt); const t = bound(this, target), r = t && tex.get(t); if (!r) return; const faces = target === CUBE ? 6 : 1; let s = 0, ww = w, hh = h; for (let l = 0; l < levels; l++) { s += ww * hh * b; ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1); } r.lv.clear(); r.lv.set('storage', s * faces); r.w = w; r.h = h; r.tur = faces > 1 ? 'kup' : levels > 1 ? 'storage+mip' : 'storage'; });
    wrap('texStorage3D', function (a) { const [target, levels, ifmt, w, h, d] = a; const b = bpp(ifmt); const t = bound(this, target), r = t && tex.get(t); if (!r) return; let s = 0, ww = w, hh = h; for (let l = 0; l < levels; l++) { s += ww * hh * d * b; ww = Math.max(1, ww >> 1); hh = Math.max(1, hh >> 1); } r.lv.clear(); r.lv.set('storage', s); r.w = w; r.h = h; r.d = d; r.tur = 'storage3d'; });
    wrap('compressedTexImage2D', function (a) { const t = bound(this, a[0]), r = t && tex.get(t); if (!r) return; const data = a[a.length - 1]; r.lv.set(a[0] + ':' + a[1], data?.byteLength || 0); if (a[1] === 0) { r.w = a[3]; r.h = a[4]; r.tur = 'sikistirilmis'; } });
    wrap('generateMipmap', function (a) { const t = bound(this, a[0]), r = t && tex.get(t); if (r) r.mip = true; });
    wrap('createRenderbuffer', function (a, x) { if (x) { rb.set(x, { b: 0, w: 0, h: 0, s: 0 }); ctxOf.set(x, this); } });
    wrap('deleteRenderbuffer', (a) => rb.delete(a[0]));
    wrap('bindRenderbuffer', function (a) { S(this).rb = a[1]; });
    wrap('renderbufferStorage', function (a) { const r = rb.get(S(this).rb); if (r) Object.assign(r, { b: a[2] * a[3] * bpp(a[1]), w: a[2], h: a[3], s: 1 }); });
    wrap('renderbufferStorageMultisample', function (a) { const r = rb.get(S(this).rb); if (r) Object.assign(r, { b: a[3] * a[4] * bpp(a[2]) * Math.max(1, a[1]), w: a[3], h: a[4], s: a[1] }); });
    wrap('createBuffer', function (a, x) { if (x) { buf.set(x, 0); ctxOf.set(x, this); } });
    wrap('deleteBuffer', (a) => buf.delete(a[0]));
    wrap('bindBuffer', function (a) { S(this).buf.set(a[0], a[1]); });
    wrap('bufferData', function (a) { const b = S(this).buf.get(a[0]); if (b && buf.has(b)) buf.set(b, typeof a[1] === 'number' ? a[1] : (a[1]?.byteLength || 0)); });
    wrap('getExtension', function (a, e) { if (a[0] === 'WEBGL_lose_context' && e && !e.__gb) { const lc = e.loseContext.bind(e), gl = this; e.loseContext = () => { for (const m of [tex, rb, buf]) for (const k of [...m.keys()]) if (ctxOf.get(k) === gl) m.delete(k); return lc(); }; e.__gb = true; } });
  }
  const MB = 1048576;
  globalThis.__gpuBellek = (n = 8) => {
    let d = 0; const list = [];
    for (const r of tex.values()) { let s = 0; for (const v of r.lv.values()) s += v; if (r.mip && !r.lv.has('storage')) s = s * 4 / 3; d += s; if (s) list.push({ w: r.w, h: r.h, mb: +(s / MB).toFixed(2), mip: r.mip || r.tur === 'storage+mip', tur: r.tur }); }
    let rbB = 0; for (const r of rb.values()) rbB += r.b;
    let tb = 0; for (const v of buf.values()) tb += v;
    let ekran = 0; for (const c of document.querySelectorAll('canvas')) { const gl = c.__gl; if (c.width && c.height && gl !== undefined) ekran += c.width * c.height * 8; }
    list.sort((a, b) => b.mb - a.mb);
    return { dokuMB: +(d / MB).toFixed(2), rbMB: +(rbB / MB).toFixed(2), tamponMB: +(tb / MB).toFixed(2), ekranMB: +(ekran / MB).toFixed(2), toplamMB: +((d + rbB + tb + ekran) / MB).toFixed(2), doku: tex.size, rb: rb.size, tampon: buf.size, enBuyuk: list.slice(0, n), rbListe: [...rb.values()].filter(r => r.b).map(r => ({ w: r.w, h: r.h, ornek: r.s, mb: +(r.b / MB).toFixed(2) })) };
  };
  const gc0 = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc0.call(this, t, ...a); if (c && /webgl/.test(t)) this.__gl = c; return c; };
}
