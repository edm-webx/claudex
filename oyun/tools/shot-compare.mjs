// Look-parity metrics (Builder D, CONTRACT M0 acceptance 6). Shared by tools/v2-shots.mjs, tests/browser/parity.spec.mjs
// and tools/make-parity-page.mjs.
//
// Per shot each side provides four 390x844 PNGs (all from the WebGL canvas, no DOM UI):
//   <name>.color.png  normal render          <name>.nodyn.png  render with moving things hidden (crowd, heroes, gulls...)
//   <name>.id.png     flat category colours  (sky blue, sea cyan, deck green, stone promenade magenta, kiosk red, other black; dynamics hidden)
// plus <name>.png / .jpg (page screenshot with HUD) for the eye check.
// Metrics (thresholds from CONTRACT.md, the lead may retune once):
//   dyn mask = union over both sides of |color - nodyn| > 24 (summed RGB), dilated 3 px  -> excluded everywhere
//   region mean colour ΔE76 (CIE Lab, D65) over v2 region pixels, per region sky/sea/deck/stone/kiosk  -> ≤ 6
//   kiosk SSIM (crop = union kiosk bbox, grayscale, 1/4 res, 3x3 blur, 7x7 windows)             -> ≥ 0.75
//   kiosk silhouette bbox: each edge |v2 - motor| / screen size                                  -> ≤ 4 %
// Regions with < 400 pixels on the v2 side (e.g. sky not in the default camera view) are reported 'n/a', not failed.
// When the motor side has no id map (hooks missing), the v2 id map defines the regions and the silhouette is 'n/a'.
//
// CLI: node tools/shot-compare.mjs <v2Dir> <motorDir> [out.json]
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export const W = 390, H = 844;
export const THRESH = { deltaE: 6, ssim: 0.75, bbox: 0.04, charsSsim: 0.7, hudDeltaE: 6 };
export const CATS = { sky: [0, 0, 255], sea: [0, 255, 255], deck: [0, 255, 0], stone: [255, 0, 255], kiosk: [255, 0, 0], other: [0, 0, 0] };
export const REGIONS = ['sky', 'sea', 'deck', 'stone', 'kiosk'];

/**
 * Page-side kit, injected as a string into v2 and motor pages: `(${MASK_KIT})(handles)` defines window.__pk.
 * handles = { scene, camera, renderer, T (three namespace), extraDyn?: Object3D[] }.
 * __pk.grab('color'|'nodyn'|'id') -> PNG data URL at 390x844; __pk.cats() -> object counts per category.
 */
export const MASK_KIT = function installKit(Hd) {
  const T = Hd.T, R = Hd.renderer, S = Hd.scene, C = Hd.camera;
  const COL = { sky: '#0000ff', sea: '#00ffff', deck: '#00ff00', stone: '#ff00ff', kiosk: '#ff0000', other: '#000000' };
  const NAMES = [[/^(sky|clouds)$/, 'sky'], [/^sea$/, 'sea'], [/^(deck|pier|pierfar)$/, 'deck'], [/^promenade$/, 'stone'], [/^(kiosk|sign|shutter)$/, 'kiosk'],
    [/^(crowd|hero|cat-|dog-|gull|pigeon|flock|ferry|boats|steam|sparkles|marker|editorring|arrow|player)/, 'dyn']];
  const extra = new Set(Hd.extraDyn || []);
  const own = o => {
    if (extra.has(o)) return 'dyn';
    const u = o.userData && o.userData.parity; if (typeof u === 'string') return u;
    const n = String(o.name || '').toLowerCase();
    for (const [re, c] of NAMES) if (re.test(n)) return c;
    return null;
  };
  const cat = o => { for (let p = o; p; p = p.parent) { const c = own(p); if (c) return c; } return 'other'; };
  const basic = {};
  for (const k in COL) basic[k] = new T.MeshBasicMaterial({ color: new T.Color(COL[k]), fog: false, side: T.DoubleSide, toneMapped: false });
  function hideDyn(restore) {
    S.traverse(o => { if (o !== S && o.visible && own(o) === 'dyn') { restore.push([o, 'visible', true]); } });
    for (const r of restore) r[0].visible = false;
  }
  function capture(smooth) {
    R.render(S, C);
    const c = document.createElement('canvas'); c.width = 390; c.height = 844;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = smooth;
    g.drawImage(R.domElement, 0, 0, 390, 844);
    return c.toDataURL('image/png');
  }
  window.__pk = {
    cat,
    cats() { const n = {}; S.traverse(o => { if (o.isMesh || o.isPoints) { const c = cat(o); n[c] = (n[c] || 0) + 1; } }); return n; },
    grab(mode) {
      const restore = [];
      const bg = S.background, fog = S.fog, sh = R.shadowMap.enabled;
      try {
        if (mode === 'nodyn' || mode === 'id') hideDyn(restore);
        if (mode === 'id') {
          S.background = new T.Color('#000000'); S.fog = null;
          S.traverse(o => {
            if (!o.visible) return;
            if (o.isPoints || o.isLine || o.isSprite) { restore.push([o, 'visible', true]); o.visible = false; return; }
            if (!o.isMesh) return;
            const m0 = Array.isArray(o.material) ? o.material[0] : o.material;
            restore.push([o, 'material', o.material]);
            if (m0 && m0.transparent && (m0.opacity < 0.99 || m0.depthWrite === false) && cat(o) !== 'sea' && cat(o) !== 'sky') { restore.push([o, 'visible', true]); o.visible = false; return; }
            o.material = basic[cat(o)] || basic.other;
          });
        }
        return capture(mode !== 'id');
      } finally {
        for (let i = restore.length - 1; i >= 0; i--) { const [o, k, v] = restore[i]; o[k] = v; }
        S.background = bg; S.fog = fog; R.shadowMap.enabled = sh;
        R.render(S, C);
      }
    },
  };
  return true;
}.toString();

// ───────────── image io ─────────────
export function decodeDataUrl(url) { return PNG.sync.read(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); }
export function readPng(p) { return fs.existsSync(p) ? PNG.sync.read(fs.readFileSync(p)) : null; }
export function writePng(p, img) { fs.writeFileSync(p, PNG.sync.write(img)); }
export function saveDataUrl(p, url) { fs.writeFileSync(p, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); }
export function resize(img, w, h) {
  if (img.width === w && img.height === h) return img;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.min(img.width - 1, Math.floor((x + 0.5) * img.width / w)), sy = Math.min(img.height - 1, Math.floor((y + 0.5) * img.height / h));
    const s = (sy * img.width + sx) * 4, d = (y * w + x) * 4;
    out.data[d] = img.data[s]; out.data[d + 1] = img.data[s + 1]; out.data[d + 2] = img.data[s + 2]; out.data[d + 3] = 255;
  }
  return out;
}

// ───────────── colour ─────────────
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export function rgb2lab(r, g, b) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ───────────── masks ─────────────
export function idMap(img) {
  const n = img.width * img.height, out = new Uint8Array(n); // 0 none/edge, then CAT_INDEX order
  const keys = Object.keys(CATS);
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 4], g = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    let best = 0, bd = 120;
    keys.forEach((k, j) => { const c = CATS[k], d = Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b); if (d < bd) { bd = d; best = j + 1; } });
    out[i] = best;
  }
  return out;
}
export const CAT_INDEX = { sky: 1, sea: 2, deck: 3, stone: 4, kiosk: 5, other: 6 };
export function dynMask(color, nodyn, into, dilate = 3) {
  const w = color.width, h = color.height, m = into || new Uint8Array(w * h);
  const raw = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(color.data[i * 4] - nodyn.data[i * 4]) + Math.abs(color.data[i * 4 + 1] - nodyn.data[i * 4 + 1]) + Math.abs(color.data[i * 4 + 2] - nodyn.data[i * 4 + 2]);
    if (d > 24) raw[i] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!raw[y * w + x]) continue;
    for (let dy = -dilate; dy <= dilate; dy++) for (let dx = -dilate; dx <= dilate; dx++) {
      const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) m[yy * w + xx] = 1;
    }
  }
  return m;
}
export function bbox(ids, w, h, cat) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (ids[y * w + x] === cat) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return n ? { x0, y0, x1, y1, n } : null;
}
export function meanLab(img, sel) {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < sel.length; i++) if (sel[i]) { r += img.data[i * 4]; g += img.data[i * 4 + 1]; b += img.data[i * 4 + 2]; n++; }
  if (!n) return null;
  return { lab: rgb2lab(r / n, g / n, b / n), rgb: [r / n, g / n, b / n].map(Math.round), n };
}

// ───────────── SSIM ─────────────
function gray(img, box, mask, fill) {
  const w = box.x1 - box.x0 + 1, h = box.y1 - box.y0 + 1, out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (box.y0 + y) * img.width + box.x0 + x;
    out[y * w + x] = mask && mask[i] ? fill[y * w + x] : 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
  }
  return { w, h, d: out };
}
function down4(g) {
  const w = Math.max(1, Math.floor(g.w / 4)), h = Math.max(1, Math.floor(g.h / 4)), d = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s += g.d[Math.min(g.h - 1, y * 4 + j) * g.w + Math.min(g.w - 1, x * 4 + i)];
    d[y * w + x] = s / 16;
  }
  return { w, h, d };
}
function blur3(g) {
  const k = [1, 2, 1], d = new Float32Array(g.w * g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    let s = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const xx = Math.min(g.w - 1, Math.max(0, x + i)), yy = Math.min(g.h - 1, Math.max(0, y + j)), wt = k[i + 1] * k[j + 1];
      s += g.d[yy * g.w + xx] * wt; n += wt;
    }
    d[y * g.w + x] = s / n;
  }
  return { w: g.w, h: g.h, d };
}
export function ssim(a, b, win = 7) {
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2;
  const w = Math.min(a.w, b.w), h = Math.min(a.h, b.h), r = Math.floor(win / 2);
  if (w < 3 || h < 3) return null;
  let sum = 0, cnt = 0;
  const step = Math.max(1, Math.floor(win / 2));
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    let ma = 0, mb = 0, n = 0;
    const ys = Math.max(0, y - r), ye = Math.min(h - 1, y + r), xs = Math.max(0, x - r), xe = Math.min(w - 1, x + r);
    for (let j = ys; j <= ye; j++) for (let i = xs; i <= xe; i++) { ma += a.d[j * a.w + i]; mb += b.d[j * b.w + i]; n++; }
    ma /= n; mb /= n;
    let va = 0, vb = 0, cov = 0;
    for (let j = ys; j <= ye; j++) for (let i = xs; i <= xe; i++) { const da = a.d[j * a.w + i] - ma, db = b.d[j * b.w + i] - mb; va += da * da; vb += db * db; cov += da * db; }
    va /= n - 1 || 1; vb /= n - 1 || 1; cov /= n - 1 || 1;
    sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); cnt++;
  }
  return cnt ? sum / cnt : null;
}
/** Structural similarity of a crop: grayscale, 1/4 res, 3x3 blur, 7x7 windows. Masked pixels take the v2 value on both sides. */
export function cropSsim(imgA, imgB, box, mask) {
  const ga = gray(imgA, box, null, null), gb = gray(imgB, box, mask, ga.d);
  return ssim(blur3(down4(ga)), blur3(down4(gb)));
}

// ───────────── one pair ─────────────
export function loadSet(dir, name) {
  const fix = img => (img ? resize(img, W, H) : null);
  return {
    color: fix(readPng(path.join(dir, name + '.color.png'))),
    nodyn: fix(readPng(path.join(dir, name + '.nodyn.png'))),
    id: fix(readPng(path.join(dir, name + '.id.png'))),
    shot: fix(readPng(path.join(dir, name + '.png'))),
  };
}

export function comparePair(v2, mo) {
  const res = { regions: {}, kiosk: {}, pass: true, notes: [] };
  const color2 = v2.color || v2.shot, colorM = mo.color || mo.shot;
  if (!color2 || !colorM) { res.pass = false; res.notes.push('missing image ' + (!color2 ? 'v2' : 'motor')); return res; }
  const n = W * H, dyn = new Uint8Array(n);
  if (v2.color && v2.nodyn) dynMask(v2.color, v2.nodyn, dyn);
  if (mo.color && mo.nodyn) dynMask(mo.color, mo.nodyn, dyn); else res.notes.push('motor dyn mask missing');
  res.dynFrac = +(dyn.reduce((s, v) => s + v, 0) / n).toFixed(3);
  const ids2 = v2.id ? idMap(v2.id) : null, idsM = mo.id ? idMap(mo.id) : null;
  if (!ids2) { res.pass = false; res.notes.push('v2 id map missing'); return res; }
  if (!idsM) res.notes.push('motor id map missing: silhouette n/a');
  for (const r of REGIONS) {
    const c = CAT_INDEX[r], sel = new Uint8Array(n);
    let cnt = 0; for (let i = 0; i < n; i++) if (ids2[i] === c && !dyn[i]) { sel[i] = 1; cnt++; }
    if (cnt < 400) { res.regions[r] = { status: 'n/a', n: cnt }; continue; }
    const a = meanLab(color2, sel), b = meanLab(colorM, sel), dE = deltaE(a.lab, b.lab);
    const ok = dE <= THRESH.deltaE;
    res.regions[r] = { status: ok ? 'ok' : 'fail', dE: +dE.toFixed(2), n: cnt, v2: a.rgb, motor: b.rgb };
    if (!ok) res.pass = false;
  }
  const b2 = bbox(ids2, W, H, CAT_INDEX.kiosk), bM = idsM ? bbox(idsM, W, H, CAT_INDEX.kiosk) : null;
  res.kiosk.v2Box = b2; res.kiosk.motorBox = bM;
  if (b2) {
    const box = bM ? { x0: Math.min(b2.x0, bM.x0), y0: Math.min(b2.y0, bM.y0), x1: Math.max(b2.x1, bM.x1), y1: Math.max(b2.y1, bM.y1) } : b2;
    const s = cropSsim(color2, colorM, box, dyn);
    res.kiosk.ssim = s == null ? null : +s.toFixed(3);
    if (s == null || s < THRESH.ssim) res.pass = false;
    if (bM) {
      const e = Math.max(Math.abs(b2.x0 - bM.x0) / W, Math.abs(b2.x1 - bM.x1) / W, Math.abs(b2.y0 - bM.y0) / H, Math.abs(b2.y1 - bM.y1) / H);
      res.kiosk.bboxErr = +e.toFixed(4);
      if (e > THRESH.bbox) res.pass = false;
    } else { res.kiosk.bboxErr = null; }
  } else { res.pass = false; res.notes.push('no kiosk pixels in v2 id map'); }
  return res;
}

/** Diff image (pixelmatch) between two same-size images; returns { img, diffPx }. */
export function diffImage(a, b) {
  const out = new PNG({ width: W, height: H });
  const diffPx = pixelmatch(a.data, b.data, out.data, W, H, { threshold: 0.12, alpha: 0.25, diffColor: [230, 57, 70], diffColorAlt: [47, 127, 179] });
  return { img: out, diffPx };
}

/** Whole-image SSIM (character lineup). */
export function imageSsim(a, b) {
  const A = resize(a, W, H), B = resize(b, W, H);
  return cropSsim(A, B, { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }, null);
}
/** HUD band mean colour ΔE (top `rows` px of two page screenshots). */
export function bandDeltaE(a, b, rows = 110) {
  const A = resize(a, W, H), B = resize(b, W, H), sel = new Uint8Array(W * H);
  for (let i = 0; i < W * rows; i++) sel[i] = 1;
  const ma = meanLab(A, sel), mb = meanLab(B, sel);
  // also mean per-pixel ΔE (informational)
  let s = 0; for (let i = 0; i < W * rows; i++) s += deltaE(rgb2lab(A.data[i * 4], A.data[i * 4 + 1], A.data[i * 4 + 2]), rgb2lab(B.data[i * 4], B.data[i * 4 + 1], B.data[i * 4 + 2]));
  return { dE: +deltaE(ma.lab, mb.lab).toFixed(2), pixelDE: +(s / (W * rows)).toFixed(2) };
}

export const SHOT_NAMES = (() => {
  const out = [];
  for (const stage of [1, 2]) for (const hr of [9, 13, 19, 22]) for (const art of ['noart', 'art']) out.push(`s${stage}-${String(hr).padStart(2, '0')}-${art}`);
  return out;
})();
export const parseShot = name => { const m = /^s(\d)-(\d\d)-(noart|art)$/.exec(name); return m ? { stage: +m[1], hour: +m[2], art: m[3] === 'art' } : null; };

export function compareDirs(v2Dir, moDir) {
  const rows = [];
  for (const name of SHOT_NAMES) {
    const v2 = loadSet(v2Dir, name), mo = loadSet(moDir, name);
    if (!v2.color && !v2.shot) continue;
    const r = comparePair(v2, mo); r.name = name;
    rows.push(r);
  }
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [v2Dir, moDir, out] = process.argv.slice(2);
  if (!v2Dir || !moDir) { console.log('usage: node tools/shot-compare.mjs <v2Dir> <motorDir> [out.json]'); process.exit(2); }
  const rows = compareDirs(v2Dir, moDir);
  for (const r of rows) {
    const reg = REGIONS.map(k => `${k}:${r.regions[k] ? (r.regions[k].dE ?? r.regions[k].status) : '-'}`).join(' ');
    console.log(`${r.pass ? 'OK  ' : 'FAIL'} ${r.name.padEnd(13)} ${reg}  ssim ${r.kiosk.ssim ?? '-'} bbox ${r.kiosk.bboxErr ?? '-'}  dyn ${r.dynFrac} ${r.notes.join('; ')}`);
  }
  const pass = rows.filter(r => r.pass).length;
  console.log(`${pass}/${rows.length} pairs pass`);
  if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
  process.exit(pass === rows.length && rows.length ? 0 : 1);
}
