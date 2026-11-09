/* Martı Motoru port of Sabri'nin Büfesi v2 chars.js (3d/v2/js/chars.js, read-only reference). Owner: Builder C.
   Ported 1:1 (geometry, colours, proportions, motion); Math.random -> seeded view rng (vrand) so shots repeat.
   Loose `any` typing was added mechanically (TS compiler API) so the body stays line-comparable with v2.
   Original header follows.
   v2: chars.js (Builder A). All living things: heroes, crowd, cats, dog, gulls, pigeons.
   Loaded after core.js (and data.js); exposes SB.chars exactly as in CONTRACT.md.

   Decisions taken where the contract is silent:
   - Heroes (Sabri, Sabriye, workers, VIPs, regulars) are ONE THREE.SkinnedMesh each (rigid skinning, 18 bones,
     ~2.5k triangles) with vertex colours plus a small 512px canvas atlas per hero (6 face expressions, apron text,
     shirt pattern). So a hero costs 1 draw call (+1 for the soft blob, +1 in the shadow pass, +1 for a tool prop
     while an act shows one: knife, teapot+glass, cloth, phone, banknotes).
   - Facial expressions switch by rewriting the UVs of the small face patch (no texture re-uploads).
   - The crowd is GPU animated: every layer is one InstancedMesh with a vertex shader that bends the body by
     per-vertex part ids (legs, knees, arms, elbows, head, torso) from a few per-instance numbers. Variants
     (hair, headwear, props) are unions inside a layer; vertices of a variant a citizen does not use collapse
     to a point (zero-area triangles, no pixels). Layers: body+face, headwear, small props, back gear,
     mobility (wheelchair/stroller/trolley), vendor gear, blob shadows = 7 draw calls for any crowd size.
     renderer.info counts the collapsed triangles too; crowd.stats() reports the visible estimate.
   - crowd.set() also accepts act strings: 'idle','talk','wave','cheer','phone','selfie','eat','drink','photo',
     'sleep','point','pet','run'; sit:true makes them sit on whatever is under them (seat height ~0.45 m).
   - Extra optional look fields understood by both makeHero and the crowd (all optional):
     topStyle ('tee','shirt','jacket','suit','vest','cardigan','hoodie','jersey','overall','uniform','dress'),
     accent, accent2 (jacket/vest colour, tie/stripe colour), pattern (0 plain,1 h-stripes,2 v-stripes,3 checks),
     bottomStyle ('pants','shorts','skirt'), shoes, beard, sleeves ('short','long','rolled'), age, height, girth,
     face (0..15), props [...], big, mobility, team, earrings, pen, goldTooth, gloves, bowtie, tie.
   - makeHero(opts.preset) also accepts named presets: 'riza','tayfun','nazli','necati','nermin','remzi','bulent'.
   - Animals: one SkinnedMesh each (cat ~800 tris, dog ~1000, gull ~750). Flock and pigeons are one
     InstancedMesh each with shader wing flapping.
   Code comments English; any visible text Turkish. */
import * as T from 'three';
import { crowdWeather } from '../weather-pose';
import * as C from './kit';
import { vrand } from './kit';

export const CH: any = {};

const TAU = Math.PI * 2, PI = Math.PI;
const clamp = C.clamp, lerp = C.lerp;
const damp = (a?: any, b?: any, k?: any, dt?: any) => a + (b - a) * (1 - Math.exp(-k * dt));
const sstep = (e0?: any, e1?: any, x?: any) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const M4 = () => new T.Matrix4();
const mT = (x?: any, y?: any, z?: any) => new T.Matrix4().makeTranslation(x, y, z);
/* compose translate * rotate(euler XYZ) * scale */
const mTRS = (x?: any, y?: any, z?: any, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  const m = new T.Matrix4(); m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz)); return m;
};

/* ---------- palettes ---------- */
// 12 skin tones, light to deep; no type is ever tied to a tone
const SKINS = ['#fbe1cc', '#f5d0b1', '#eec29d', '#e6b089', '#d99f76', '#cb8d62', '#bb7b51', '#a66944', '#8f5839', '#784830', '#613a27', '#4b2d1f'];
const HAIRC: any = { black: '#1f1813', darkbrown: '#3b281c', brown: '#5e3d26', chestnut: '#7a4a2a', auburn: '#8c3f22', light: '#a8794a', blond: '#d6b06c', grey: '#9c9894', silver: '#c9c5bf', white: '#ece8e2' };
const CLOTH = ['#e0533c', '#d9822b', '#ebc07a', '#fff6e6', '#5aa9d6', '#3fb5b0', '#f2a2b3', '#8daa5b', '#7d6bb0', '#2e4a6b', '#c94f6d', '#f0d35a', '#6f8f4f', '#b06a3b', '#4f6d8f', '#e8e2d4', '#99b8d8', '#d46a4a', '#3c3a44', '#a6c87a', '#f3b6a0', '#5c7a99', '#c7a27a', '#7fcfb3'];
const PANTS = ['#3f5878', '#2f3a4a', '#59606b', '#7a6a55', '#4a4038', '#2b2b30', '#6b7f99', '#a39276', '#5a6e4f', '#8b4f3c'];
const SHOES = ['#2b2522', '#4a3528', '#6b4a32', '#f2efe8', '#3d4a5c', '#8a3a2a', '#d9d4c7', '#1f2b3a'];
const TEAMS: any = { lodosspor: ['#2fb8b0', '#f08a2c'], vapurspor: ['#9b84c9', '#d9dde3'], simitspor: ['#7a4e2d', '#e6cf9a'], kedispor: ['#8fd6b4', '#f3a0b8'] };
CH.SKINS = SKINS; CH.TEAMS = TEAMS;

const col = new T.Color();
const shade = (c?: any, k?: any) => { const o = new T.Color(c); const h: any = {}; o.getHSL(h); o.setHSL(h.h, h.s, clamp(h.l * k, 0, 1)); return '#' + o.getHexString(); };
const mix = (a?: any, b?: any, t?: any) => { const o = new T.Color(a); o.lerp(new T.Color(b), t); return '#' + o.getHexString(); };

/* ---------- geometry builder: merges many small geometries into one ----------
   extra = { name: itemSize } adds custom per-vertex attributes (filled from opts[name] arrays). */
function GB(this: any, extra?: any) {
  this.pos = []; this.nor = []; this.uv = []; this.col = []; this.idx = []; this.extra = extra || {}; this.ex = {};
  for (const k in this.extra) this.ex[k] = [];
}
const _v = new T.Vector3(), _n = new T.Vector3(), _m3 = new T.Matrix3(), ZERO4 = [0, 0, 0, 0];
GB.prototype.add = function (this: any, g?: any, o?: any) {
  o = o || {};
  const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
  const base = this.pos.length / 3, m = o.m;
  let flip = false;
  if (m) { _m3.getNormalMatrix(m); flip = m.determinant() < 0; }
  let cr = 1, cg = 1, cb = 1;
  const cf = typeof o.color === 'function' ? o.color : null;
  if (o.color != null && !cf) { col.set(o.color); cr = col.r; cg = col.g; cb = col.b; }
  for (let i = 0; i < P.count; i++) {
    _v.fromBufferAttribute(P, i); _n.fromBufferAttribute(N, i);
    if (o.deform) o.deform(_v, _n);
    if (m) { _v.applyMatrix4(m); _n.applyMatrix3(_m3).normalize(); }
    this.pos.push(_v.x, _v.y, _v.z); this.nor.push(_n.x, _n.y, _n.z);
    if (o.uvRect && U) this.uv.push(o.uvRect[0] + U.getX(i) * o.uvRect[2], o.uvRect[1] + U.getY(i) * o.uvRect[3]);
    else if (o.uvFn) { const uv = o.uvFn(_v, U ? U.getX(i) : 0, U ? U.getY(i) : 0); this.uv.push(uv[0], uv[1]); }
    else if (o.uv) this.uv.push(o.uv[0], o.uv[1]);
    else this.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    if (cf) { col.set(cf(_v, i)); this.col.push(col.r, col.g, col.b); } else this.col.push(cr, cg, cb);
    for (const k in this.extra) { const a = typeof o[k] === 'function' ? o[k](_v, i) : (o[k] || ZERO4); for (let j = 0; j < this.extra[k]; j++) this.ex[k].push(a[j] || 0); }
  }
  const tri = g.index ? g.index.array : null, cnt = tri ? tri.length : P.count;
  for (let i = 0; i < cnt; i += 3) {
    const a = tri ? tri[i] : i, b = tri ? tri[i + 1] : i + 1, c = tri ? tri[i + 2] : i + 2;
    if (flip) this.idx.push(base + a, base + c, base + b); else this.idx.push(base + a, base + b, base + c);
  }
  return this;
};
GB.prototype.build = function (this: any, types?: any) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(this.pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(this.nor, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(this.uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(this.col, 3));
  for (const k in this.extra) {
    if (types && types[k] === 'u16') g.setAttribute(k, new T.Uint16BufferAttribute(this.ex[k], this.extra[k]));
    else g.setAttribute(k, new T.Float32BufferAttribute(this.ex[k], this.extra[k]));
  }
  g.setIndex(this.pos.length / 3 > 65535 ? new T.Uint32BufferAttribute(this.idx, 1) : new T.Uint16BufferAttribute(this.idx, 1));
  g.computeBoundingSphere();
  return g;
};
GB.prototype.tris = function (this: any) { return this.idx.length / 3; };

/* cached primitive geometries (local, unmerged; only used as merge sources) */
const PG: any = {};
const prim = (k?: any, f?: any) => PG[k] || (PG[k] = f());
/* SEGK: global tessellation factor, set per builder (hero/crowd/animals) to stay inside the GDD triangle budgets */
let SEGK = 1;
const SEG: any = { hero: 0.6, crowd: 0.55, crowdS: 0.5, animal: 0.5, gull: 1, flock: 0.45 };
const sgN = (n?: any, m?: any) => Math.max(m, Math.round(n * SEGK));
const withSeg = (k?: any, f?: any) => { const o = SEGK; SEGK = k; try { return f(); } finally { SEGK = o; } };
const sph = (r?: any, w?: any, h?: any, p0 = 0, pl = TAU, t0 = 0, tl = PI) => { w = sgN(w, 5); h = sgN(h, 3); return prim(`s${r}|${w}|${h}|${p0}|${pl}|${t0}|${tl}`, () => new T.SphereGeometry(r, w, h, p0, pl, t0, tl)); };
const cyl = (rt?: any, rb?: any, h?: any, s = 10, open = false, hs = 1) => { s = sgN(s, 5); return prim(`c${rt}|${rb}|${h}|${s}|${open}|${hs}`, () => new T.CylinderGeometry(rt, rb, h, s, hs, open)); };
const cap = (r?: any, l?: any, cs = 3, rs = 8) => { cs = sgN(cs, 1); rs = sgN(rs, 5); return prim(`k${r}|${l}|${cs}|${rs}`, () => new T.CapsuleGeometry(r, l, cs, rs)); };
const rbox = (w?: any, h?: any, d?: any, r = 0.02, s = 1) => C.roundBox(w, h, d, r, s);
const box = (w?: any, h?: any, d?: any) => prim(`b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d));
const tor = (r?: any, t?: any, rs = 6, ts = 12, arc = TAU) => { rs = sgN(rs, 3); ts = sgN(ts, 4); return prim(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new T.TorusGeometry(r, t, rs, ts, arc)); };
const cone = (r?: any, h?: any, s = 8) => { s = sgN(s, 4); return prim(`o${r}|${h}|${s}`, () => new T.ConeGeometry(r, h, s)); };
const lathe = (pts?: any, seg = 12, p0 = 0, pl = TAU) => new T.LatheGeometry(pts.map((p?: any) => new T.Vector2(p[0], p[1])), sgN(seg, 6), p0, pl);

/* ---------- soft blob shadow (shared) ---------- */
let blobTex: any = null;
const blobMat = (op?: any) => {
  if (!blobTex) blobTex = C.canvasTex(64, 64, (g?: any, w?: any, h?: any) => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(40,30,50,0.85)'); gr.addColorStop(0.55, 'rgba(40,30,50,0.45)'); gr.addColorStop(1, 'rgba(40,30,50,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return C.mat('#ffffff', { map: blobTex, transparent: true, depthWrite: false, opacity: op, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
};
const blobGeo = () => C.geo('chars-blob', () => { const g = new T.PlaneGeometry(1, 1); g.rotateX(-PI / 2); return g; });
function makeBlob(size?: any, op = 0.32) { const m = new T.Mesh(blobGeo(), blobMat(op)); m.scale.set(size, 1, size); m.position.y = 0.012; m.renderOrder = -1; m.castShadow = false; m.receiveShadow = false; return m; }

/* ---------- face painting (canvas) ----------
   f = { eye: 'round'|'oval'|'lash'|'small'|'big', iris, brow: 'thick'|'mid'|'thin'|'none', browCol, blush, crow, dimples,
         freckles, wrinkles, lips, goldTooth }; expr = 'normal'|'blink'|'happy'|'angry'|'talk'|'sleep' */
function paintFace(g?: any, x?: any, y?: any, S?: any, f?: any, expr?: any, bg?: any) {
  g.save(); g.translate(x, y); g.scale(S / 128, S / 128);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 128, 128); } else g.clearRect(0, 0, 128, 128);
  const ink = f.ink || '#2a1c16', ex = f.ex || 21, ey = f.ey || 57, my = 95;
  if (f.stubble) { g.fillStyle = 'rgba(40,28,22,0.32)'; for (let k = 0; k < 160; k++) { const a = (k * 2.39996) % TAU, r = 30 + (k * 7 % 23); const px = 64 + Math.cos(a) * r * 1.15, py = 92 + Math.sin(a) * r * 0.62; if (py > 74 && py < 126 && !(Math.abs(px - 64) < 17 && Math.abs(py - 95) < 9)) { g.beginPath(); g.arc(px, py, 1.1, 0, TAU); g.fill(); } } }
  const big = f.eye === 'big', small = f.eye === 'small';
  const er = big ? 9.5 : small ? 5.5 : 7.2;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // blush
  const bl = f.blush == null ? 0.22 : f.blush;
  if (bl > 0) {
    const a = expr === 'happy' ? bl * 1.7 : expr === 'angry' ? bl * 1.4 : bl;
    [-1, 1].forEach((s?: any) => { const gr = g.createRadialGradient(64 + s * 33, 79, 1, 64 + s * 33, 79, 13); gr.addColorStop(0, `rgba(235,96,96,${Math.min(0.75, a)})`); gr.addColorStop(1, 'rgba(235,96,96,0)'); g.fillStyle = gr; g.fillRect(64 + s * 33 - 14, 65, 28, 28); });
  }
  if (f.freckles) { g.fillStyle = 'rgba(120,70,40,0.45)'; [[-34, 72], [-28, 76], [-38, 78], [28, 72], [34, 77], [26, 78]].forEach((p?: any) => { g.beginPath(); g.arc(64 + p[0], p[1], 1.3, 0, TAU); g.fill(); }); }
  if (f.wrinkles) { g.strokeStyle = 'rgba(90,50,35,0.35)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(52, 30); g.quadraticCurveTo(64, 27, 76, 30); g.stroke(); g.beginPath(); g.moveTo(42, 84); g.quadraticCurveTo(40, 92, 44, 99); g.moveTo(86, 84); g.quadraticCurveTo(88, 92, 84, 99); g.stroke(); }
  // brows
  const bw = f.brow === 'thick' ? 6 : f.brow === 'thin' ? 2.4 : f.brow === 'none' ? 0 : 3.8;
  if (bw) {
    g.strokeStyle = f.browCol || ink; g.lineWidth = bw;
    [-1, 1].forEach((s?: any) => {
      const cx = 64 + s * ex; g.beginPath();
      if (expr === 'angry') { g.moveTo(cx - s * 11, ey - 20); g.lineTo(cx + s * 9, ey - 13); }
      else if (expr === 'happy') { g.moveTo(cx - 10, ey - 18); g.quadraticCurveTo(cx, ey - 25, cx + 10, ey - 18); }
      else if (expr === 'sleep') { g.moveTo(cx - 10, ey - 14); g.quadraticCurveTo(cx, ey - 17, cx + 10, ey - 14); }
      else { g.moveTo(cx - 10, ey - 16); g.quadraticCurveTo(cx, ey - 21, cx + 10, ey - 16); }
      g.stroke();
    });
  }
  // eyes
  [-1, 1].forEach((s?: any) => {
    const cx = 64 + s * ex;
    if (expr === 'blink' || expr === 'sleep') {
      g.strokeStyle = ink; g.lineWidth = 3; g.beginPath();
      if (expr === 'sleep') { g.moveTo(cx - 7, ey + 1); g.quadraticCurveTo(cx, ey + 6, cx + 7, ey + 1); }
      else { g.moveTo(cx - 7, ey); g.quadraticCurveTo(cx, ey + 4, cx + 7, ey); }
      g.stroke(); if (f.eye === 'lash') { g.lineWidth = 2; g.beginPath(); g.moveTo(cx + s * 7, ey); g.lineTo(cx + s * 10, ey - 2); g.stroke(); }
    } else if (expr === 'happy') {
      g.strokeStyle = ink; g.lineWidth = 3.6; g.beginPath(); g.moveTo(cx - 8, ey + 3); g.quadraticCurveTo(cx, ey - 8, cx + 8, ey + 3); g.stroke();
      if (f.crow) { g.lineWidth = 1.5; g.strokeStyle = 'rgba(80,45,30,0.55)'; g.beginPath(); g.moveTo(cx + s * 11, ey - 2); g.lineTo(cx + s * 16, ey - 5); g.moveTo(cx + s * 11, ey + 2); g.lineTo(cx + s * 16, ey + 3); g.stroke(); }
    } else {
      const h = expr === 'angry' ? er * 0.85 : er * 1.15;
      g.fillStyle = '#fbf8f2'; g.beginPath(); g.ellipse(cx, ey, er + 1.6, h + 1.6, 0, 0, TAU); g.fill();
      g.fillStyle = f.iris || '#4a2e1e'; g.beginPath(); g.ellipse(cx + s * 0.6, ey + 0.5, er * 0.82, h * 0.86, 0, 0, TAU); g.fill();
      g.fillStyle = '#17100c'; g.beginPath(); g.ellipse(cx + s * 0.6, ey + 0.8, er * 0.45, h * 0.5, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 2.2, ey - 2.6, er * 0.3, 0, TAU); g.fill();
      if (f.eye === 'lash') { g.strokeStyle = ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx + s * (er + 1), ey - 2); g.lineTo(cx + s * (er + 5), ey - 6); g.stroke(); }
      if (expr === 'angry') { g.fillStyle = f.lid || 'rgba(0,0,0,0)'; }
      if (f.crow && expr === 'normal') { g.strokeStyle = 'rgba(80,45,30,0.4)'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx + s * (er + 4), ey + 1); g.lineTo(cx + s * (er + 8), ey + 3); g.stroke(); }
    }
  });
  // mouth
  g.strokeStyle = f.lips || '#7a2f2a'; g.fillStyle = '#6e2224';
  const mw = f.mouthW || 13;
  if (expr === 'happy') {
    g.beginPath(); g.moveTo(64 - mw - 3, my - 4); g.quadraticCurveTo(64, my + 17, 64 + mw + 3, my - 4); g.closePath(); g.fill();
    g.fillStyle = '#fffaf2'; g.beginPath(); g.moveTo(64 - mw, my - 3); g.quadraticCurveTo(64, my + 1, 64 + mw, my - 3); g.lineTo(64 + mw - 2, my - 1); g.quadraticCurveTo(64, my + 3, 64 - mw + 2, my - 1); g.closePath(); g.fill();
    if (f.goldTooth) { g.fillStyle = '#f2b632'; g.fillRect(64 + 3, my - 3, 5, 4); }
    g.fillStyle = '#e57a7a'; g.beginPath(); g.ellipse(64, my + 7, 6, 3, 0, 0, TAU); g.fill();
  } else if (expr === 'talk') {
    g.beginPath(); g.ellipse(64, my + 1, mw * 0.55, 6.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#e57a7a'; g.beginPath(); g.ellipse(64, my + 4, 4.5, 2.4, 0, 0, TAU); g.fill();
    if (f.goldTooth) { g.fillStyle = '#f2b632'; g.fillRect(64 + 1, my - 5, 4, 3); }
  } else if (expr === 'angry') {
    g.lineWidth = 3.4; g.beginPath(); g.moveTo(64 - mw + 2, my + 4); g.quadraticCurveTo(64, my - 5, 64 + mw - 2, my + 4); g.stroke();
  } else if (expr === 'sleep') {
    g.beginPath(); g.ellipse(64, my + 2, 3.6, 4.2, 0, 0, TAU); g.fill();
  } else {
    g.lineWidth = 3.4; g.beginPath(); g.moveTo(64 - mw, my - 2); g.quadraticCurveTo(64, my + 9, 64 + mw, my - 2); g.stroke();
    if (f.dimples) { g.lineWidth = 1.8; g.strokeStyle = 'rgba(120,60,45,0.5)'; [-1, 1].forEach((s?: any) => { g.beginPath(); g.arc(64 + s * (mw + 5), my - 1, 2.4, 0, TAU); g.stroke(); }); }
  }
  g.restore();
}
CH._paintFace = paintFace;

/* ---------- Martı Motoru: 12 expressions + blink/talk (animasyon-5) ----------
   Cell order = EXPR_ORDER (schema.ts) then 'blink', 'talk'. v2-equivalent cells reuse paintFace exactly
   (neutral=normal, grin=happy, grumpy=angry, sleepy=sleep); new ones are drawn here in the same style.
   noBrow: heroes draw brows as separate spring-driven quads, so their cells are painted without brows. */
const X_CELLS = ['neutral', 'smile', 'grin', 'laugh', 'surprised', 'sleepy', 'pout', 'grumpy', 'love', 'wink', 'thinking', 'bliss', 'blink', 'talk'];
const X_V2: any = { neutral: 'normal', grin: 'happy', grumpy: 'angry', sleepy: 'sleep', blink: 'blink', talk: 'talk' };
// brow shape used when a cell paints its own brows (crowd): v2 kinds + 'up' / 'worried'
const X_BROW: any = { smile: 'normal', laugh: 'happy', surprised: 'up', pout: 'worried', love: 'happy', wink: 'happy', thinking: 'angry', bliss: 'sleep' };
function paintBrows(g?: any, f?: any, kind?: any) {
  const ink = f.ink || '#2a1c16', ex = f.ex || 21, ey = f.ey || 57;
  const bw = f.brow === 'thick' ? 6 : f.brow === 'thin' ? 2.4 : f.brow === 'none' ? 0 : 3.8;
  if (!bw) return;
  g.strokeStyle = f.browCol || ink; g.lineWidth = bw; g.lineCap = 'round';
  [-1, 1].forEach((s?: any) => {
    const cx = 64 + s * ex; g.beginPath();
    if (kind === 'angry') { g.moveTo(cx - s * 11, ey - 20); g.lineTo(cx + s * 9, ey - 15); }
    else if (kind === 'happy') { g.moveTo(cx - 10, ey - 18); g.quadraticCurveTo(cx, ey - 25, cx + 10, ey - 18); }
    else if (kind === 'sleep') { g.moveTo(cx - 10, ey - 14); g.quadraticCurveTo(cx, ey - 17, cx + 10, ey - 14); }
    else if (kind === 'up') { g.moveTo(cx - 10, ey - 22); g.quadraticCurveTo(cx, ey - 30, cx + 10, ey - 22); }
    else if (kind === 'worried') { g.moveTo(cx - s * 11, ey - 15); g.lineTo(cx + s * 9, ey - 21); }
    else { g.moveTo(cx - 10, ey - 16); g.quadraticCurveTo(cx, ey - 21, cx + 10, ey - 16); }
    g.stroke();
  });
}
function openEye(g?: any, f?: any, cx?: any, s?: any, ey?: any, er?: any, h?: any, lx = 0, ly = 0, pup = 1) {
  const ink = f.ink || '#2a1c16';
  g.fillStyle = '#fbf8f2'; g.beginPath(); g.ellipse(cx, ey, er + 1.6, h + 1.6, 0, 0, TAU); g.fill();
  g.fillStyle = f.iris || '#4a2e1e'; g.beginPath(); g.ellipse(cx + s * 0.6 + lx, ey + 0.5 + ly, er * 0.82 * pup, h * 0.86 * pup, 0, 0, TAU); g.fill();
  g.fillStyle = '#17100c'; g.beginPath(); g.ellipse(cx + s * 0.6 + lx, ey + 0.8 + ly, er * 0.45 * pup, h * 0.5 * pup, 0, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 2.2 + lx * 0.5, ey - 2.6 + ly * 0.5, er * 0.3, 0, TAU); g.fill();
  if (f.eye === 'lash') { g.strokeStyle = ink; g.lineWidth = 2.2; g.beginPath(); g.moveTo(cx + s * (er + 1), ey - 2); g.lineTo(cx + s * (er + 5), ey - 6); g.stroke(); }
}
function arcEye(g?: any, f?: any, cx?: any, ey?: any, up = true, lw = 3.6) {
  g.strokeStyle = f.ink || '#2a1c16'; g.lineWidth = lw; g.beginPath();
  if (up) { g.moveTo(cx - 8, ey + 3); g.quadraticCurveTo(cx, ey - 8, cx + 8, ey + 3); }
  else { g.moveTo(cx - 8, ey - 1); g.quadraticCurveTo(cx, ey + 7, cx + 8, ey - 1); }
  g.stroke();
}
function blushX(g?: any, f?: any, k?: any) {
  const bl = (f.blush == null ? 0.22 : f.blush) * k; if (bl <= 0) return;
  [-1, 1].forEach((s?: any) => { const gr = g.createRadialGradient(64 + s * 33, 79, 1, 64 + s * 33, 79, 13); gr.addColorStop(0, `rgba(235,96,96,${Math.min(0.8, bl)})`); gr.addColorStop(1, 'rgba(235,96,96,0)'); g.fillStyle = gr; g.fillRect(64 + s * 33 - 14, 65, 28, 28); });
}
function paintFaceX(g?: any, x?: any, y?: any, S?: any, f0?: any, cell?: any, bg?: any, noBrow?: any) {
  const name = X_CELLS[cell] || 'neutral';
  const f = noBrow ? Object.assign({}, f0, { brow: 'none' }) : f0;
  if (X_V2[name]) { paintFace(g, x, y, S, f, X_V2[name], bg); return; }
  g.save(); g.translate(x, y); g.scale(S / 128, S / 128);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 128, 128); } else g.clearRect(0, 0, 128, 128);
  const ink = f.ink || '#2a1c16', ex = f.ex || 21, ey = f.ey || 57, my = 95, mw = f.mouthW || 13;
  if (f.stubble) { g.fillStyle = 'rgba(40,28,22,0.32)'; for (let k = 0; k < 160; k++) { const a = (k * 2.39996) % TAU, r = 30 + (k * 7 % 23); const px = 64 + Math.cos(a) * r * 1.15, py = 92 + Math.sin(a) * r * 0.62; if (py > 74 && py < 126 && !(Math.abs(px - 64) < 17 && Math.abs(py - 95) < 9)) { g.beginPath(); g.arc(px, py, 1.1, 0, TAU); g.fill(); } } }
  const er = f.eye === 'big' ? 9.5 : f.eye === 'small' ? 5.5 : 7.2, h = er * 1.15;
  g.lineCap = 'round'; g.lineJoin = 'round';
  blushX(g, f, name === 'laugh' || name === 'love' ? 1.8 : name === 'bliss' ? 2 : name === 'smile' ? 1.3 : 1);
  if (f.freckles) { g.fillStyle = 'rgba(120,70,40,0.45)'; [[-34, 72], [-28, 76], [-38, 78], [28, 72], [34, 77], [26, 78]].forEach((p?: any) => { g.beginPath(); g.arc(64 + p[0], p[1], 1.3, 0, TAU); g.fill(); }); }
  if (!noBrow) paintBrows(g, f, X_BROW[name]);
  const lips = f.lips || '#7a2f2a';
  [-1, 1].forEach((s?: any) => {
    const cx = 64 + s * ex;
    switch (name) {
      case 'smile': openEye(g, f, cx, s, ey, er, h); break;
      case 'laugh': arcEye(g, f, cx, ey, true, 4.2); break;
      case 'surprised': openEye(g, f, cx, s, ey - 1, er * 1.2, h * 1.25, 0, 0, 0.62); break;
      case 'pout': openEye(g, f, cx, s, ey + 1, er, h * 0.8, 0, 2); if (bg) { g.fillStyle = bg; g.fillRect(cx - er - 3, ey - h - 4, 2 * er + 6, h * 0.75 + 2); } g.strokeStyle = ink; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - er - 1, ey - h * 0.25); g.lineTo(cx + er + 1, ey - h * 0.25); g.stroke(); break;
      case 'love': { g.fillStyle = '#e0405a'; const r = er * 0.75; g.beginPath(); g.moveTo(cx, ey + r * 1.5); g.bezierCurveTo(cx - r * 2.4, ey - r * 0.2, cx - r * 1.1, ey - r * 2.1, cx, ey - r * 0.7); g.bezierCurveTo(cx + r * 1.1, ey - r * 2.1, cx + r * 2.4, ey - r * 0.2, cx, ey + r * 1.5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(cx - r * 0.7, ey - r * 0.6, r * 0.3, 0, TAU); g.fill(); break; }
      case 'wink': if (s < 0) openEye(g, f, cx, s, ey, er, h); else arcEye(g, f, cx, ey, true); break;
      case 'thinking': openEye(g, f, cx, s, ey, er, h, 2.2, -2.4); break;
      case 'bliss': arcEye(g, f, cx, ey + 2, false, 3); break;
    }
  });
  g.strokeStyle = lips; g.fillStyle = '#6e2224';
  switch (name) {
    case 'smile': g.lineWidth = 3.6; g.beginPath(); g.moveTo(64 - mw - 2, my - 4); g.quadraticCurveTo(64, my + 14, 64 + mw + 2, my - 4); g.stroke();
      if (f.dimples) { g.lineWidth = 1.8; g.strokeStyle = 'rgba(120,60,45,0.5)'; [-1, 1].forEach((s?: any) => { g.beginPath(); g.arc(64 + s * (mw + 6), my - 2, 2.4, 0, TAU); g.stroke(); }); } break;
    case 'laugh': g.beginPath(); g.moveTo(64 - mw - 4, my - 6); g.quadraticCurveTo(64, my + 24, 64 + mw + 4, my - 6); g.closePath(); g.fill();
      g.fillStyle = '#fffaf2'; g.fillRect(64 - mw + 1, my - 6, 2 * mw - 2, 4);
      g.fillStyle = '#e57a7a'; g.beginPath(); g.ellipse(64, my + 9, 7, 3.6, 0, 0, TAU); g.fill(); break;
    case 'surprised': g.beginPath(); g.ellipse(64, my + 2, 6, 8, 0, 0, TAU); g.fill(); break;
    case 'pout': g.fillStyle = '#b8564f'; g.beginPath(); g.ellipse(64, my + 2, 6, 4.2, 0, 0, TAU); g.fill(); g.lineWidth = 2.2; g.strokeStyle = lips; g.beginPath(); g.moveTo(64 - 6, my + 2); g.lineTo(64 + 6, my + 2); g.stroke(); break;
    case 'love': case 'bliss': g.lineWidth = 3.4; g.beginPath(); g.moveTo(64 - mw + 2, my - 2); g.quadraticCurveTo(64, my + 9, 64 + mw - 2, my - 2); g.stroke(); break;
    case 'wink': g.lineWidth = 3.4; g.beginPath(); g.moveTo(64 - mw + 1, my - 1); g.quadraticCurveTo(64 + 2, my + 10, 64 + mw + 3, my - 5); g.stroke(); break;
    case 'thinking': g.lineWidth = 3.2; g.beginPath(); g.moveTo(64 - 7, my + 2); g.lineTo(64 + 10, my - 1); g.stroke(); break;
  }
  g.restore();
}
CH._paintFaceX = paintFaceX; CH.X_CELLS = X_CELLS;

/* face patch over the front of a head sphere: UV (0..1) spans this patch */
const FACE_PHI = 1.8, FACE_T0 = 0.95, FACE_TL = 1.25;
const facePatch = (r?: any, w = 14, h = 10) => sph(r, w, h, PI / 2 - FACE_PHI / 2, FACE_PHI, FACE_T0, FACE_TL);

/* ---------- hair, hats and headscarves: shared shapes (head centre at origin, radius R, front +Z) ----------
   each returns [{ g, m, k }] where k is a colour key: 'hair' | 'cover' | 'trim' | 'dark' | 'gold' | '#hex' */
const sg = (n?: any, q?: any) => Math.max(4, Math.round(n * q));
// circumscribed sphere: low-tessellation shells grow so their flat facets stay outside the (round) head they cover
const sphC = (r?: any, w?: any, h?: any, p0 = 0, pl = TAU, t0 = 0, tl = PI) => { const wf = sgN(w, 5), hf = sgN(h, 3); const k = 1 / (Math.cos(Math.min(pl / wf / 2, 0.6)) * Math.cos(Math.min(tl / hf / 2, 0.6))); return sph(+(r * k).toFixed(4), w, h, p0, pl, t0, tl); };
function capPiece(R?: any, k?: any, q?: any, s = 1.07, tl = 1.55, tilt = -0.42) {
  return { g: sphC(+(R * s).toFixed(4), sg(14, q), sg(8, q), 0, TAU, 0, tl), m: mTRS(0, 0, 0, tilt, 0, 0), k };
}
function hairPieces(style?: any, R?: any, q?: any) {
  const P: any = [];
  if (!style || style === 'none' || style === 'bald') return P;
  if (style === 'buzz') { P.push(capPiece(R, 'hair', q, 1.035, 1.5)); return P; }
  if (style === 'afro') { P.push({ g: sphC(+(R * 1.3).toFixed(4), sg(12, q), sg(9, q)), m: mTRS(0, R * 0.36, -R * 0.4, 0, 0, 0, 1.08, 0.95, 1), k: 'hair' }); return P; } // 16:52: sat back so the face shows
  P.push(capPiece(R, 'hair', q));
  if (style === 'curly' || style === 'wavy') {
    const n = q >= 1 ? 18 : 9, rr = +(R * (q >= 1 ? 0.24 : 0.3)).toFixed(4);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (i % 2) * 0.3, pol = (i % 3 === 0) ? 0.35 : (i % 3 === 1 ? 0.8 : 1.15);
      if (Math.cos(a) > 0.55 && pol > 1) continue; // keep the forehead clear
      const v = new T.Vector3(Math.sin(pol) * Math.sin(a), Math.cos(pol), Math.sin(pol) * Math.cos(a)).multiplyScalar(R * 1.04);
      v.applyEuler(new T.Euler(-0.42, 0, 0));
      P.push({ g: sphC(rr, sg(7, q), sg(5, q)), m: mT(v.x, v.y, v.z), k: 'hair' });
    }
  }
  if (style === 'long' || style === 'wavy') P.push({ g: sphC(+(R).toFixed(4), sg(12, q), sg(8, q)), m: mTRS(0, -R * 0.62, -R * 0.52, 0.12, 0, 0, 1.06, 1.75, 0.6), k: 'hair' });
  if (style === 'bob' || style === 'wavy') P.push({ g: sphC(+(R * 1.12).toFixed(4), sg(12, q), sg(8, q), PI / 2 + 1.0, TAU - 2.0, 0.3, 1.85), m: M4(), k: 'hair' });
  if (style === 'bun') {
    P.push({ g: sphC(+(R * 0.46).toFixed(4), sg(10, q), sg(8, q)), m: mTRS(0, R * 0.62, -R * 0.82, 0, 0, 0, 1, 0.92, 1), k: 'hair' });
    P.push({ g: tor(+(R * 0.3).toFixed(4), +(R * 0.07).toFixed(4), 4, sg(10, q)), m: mTRS(0, R * 0.48, -R * 0.66, -0.9, 0, 0), k: 'trim' });
  }
  if (style === 'ponytail') {
    P.push({ g: sphC(+(R * 0.2).toFixed(4), 6, 5), m: mT(0, R * 0.25, -R * 1.02), k: 'trim' });
    P.push({ g: cap(+(R * 0.2).toFixed(4), +(R * 0.9).toFixed(4), 2, sg(8, q)), m: mTRS(0, -R * 0.35, -R * 1.15, -0.25, 0, 0), k: 'hair' });
  }
  return P;
}
function hatPieces(hat?: any, R?: any, q?: any) {
  const P: any = [], s = (v?: any) => +(R * v).toFixed(4);
  switch (hat) {
    case 'kasket': case 'captain':
      P.push({ g: sphC(s(1.13), sg(14, q), sg(5, q), 0, TAU, 0, PI / 2), m: mTRS(0, R * 0.36, R * 0.05, 0.14, 0, 0, 1.04, 0.55, 1.06), k: 'cover' });
      P.push({ g: tor(s(1.03), s(0.07), 4, sg(16, q)), m: mTRS(0, R * 0.36, R * 0.05, PI / 2 + 0.14, 0, 0), k: hat === 'captain' ? 'gold' : 'trim' });
      P.push({ g: rbox(s(1.05), 0.022, s(0.5), 0.01, 1), m: mTRS(0, R * 0.36, R * 1.0, 0.32, 0, 0), k: hat === 'captain' ? 'dark' : 'cover' });
      break;
    case 'cap':
      P.push({ g: sphC(s(1.08), sg(14, q), sg(5, q), 0, TAU, 0, PI / 2), m: mTRS(0, R * 0.14, 0, -0.1, 0, 0), k: 'cover' });
      P.push({ g: rbox(s(1.0), 0.022, s(0.78), 0.01, 1), m: mTRS(0, R * 0.26, R * 1.05, 0.16, 0, 0), k: 'trim' });
      break;
    case 'beanie':
      P.push({ g: sphC(s(1.1), sg(14, q), sg(7, q), 0, TAU, 0, 1.45), m: mTRS(0, R * 0.05, -R * 0.03, -0.28, 0, 0, 1, 1.12, 1), k: 'cover' });
      P.push({ g: tor(s(1.0), s(0.1), 4, sg(16, q)), m: mTRS(0, R * 0.18, -R * 0.06, PI / 2 - 0.28, 0, 0), k: 'trim' });
      break;
    case 'helmet':
      P.push({ g: sphC(s(1.2), sg(14, q), sg(7, q), 0, TAU, 0, 1.72), m: mTRS(0, R * 0.04, -R * 0.06, -0.25, 0, 0), k: 'cover' });
      P.push({ g: sphC(s(1.23), sg(8, q), sg(3, q), PI / 2 - 0.85, 1.7, 1.12, 0.42), m: mTRS(0, R * 0.04, -R * 0.06, 0, 0, 0), k: 'dark' });
      P.push({ g: rbox(s(0.4), s(0.1), s(0.6), 0.01, 1), m: mTRS(0, R * 1.15, -R * 0.1, -0.2, 0, 0), k: 'trim' });
      break;
    case 'sunhat':
      P.push({ g: sphC(s(1.1), sg(14, q), sg(5, q), 0, TAU, 0, PI / 2), m: mT(0, R * 0.12, 0), k: 'cover' });
      P.push({ g: cyl(s(2.0), s(2.05), 0.018, sg(18, q)), m: mT(0, R * 0.2, 0), k: 'cover' });
      P.push({ g: cyl(s(1.12), s(1.12), s(0.16), sg(14, q), true), m: mT(0, R * 0.3, 0), k: 'trim' });
      break;
    case 'bucket':
      P.push({ g: cyl(s(0.92), s(1.12), s(0.62), sg(14, q)), m: mT(0, R * 0.5, 0), k: 'cover' });
      P.push({ g: cyl(s(1.12), s(1.6), s(0.2), sg(14, q), true), m: mT(0, R * 0.12, 0), k: 'cover' });
      break;
    case 'chef':
      P.push({ g: cyl(s(1.04), s(1.07), s(0.5), sg(14, q)), m: mT(0, R * 0.55, 0), k: '#fbfbf8' });
      P.push({ g: sphC(s(1.22), sg(12, q), sg(8, q)), m: mTRS(0, R * 1.18, 0, 0, 0, 0, 1, 0.72, 1), k: '#ffffff' });
      P.push({ g: cyl(s(1.075), s(1.075), s(0.12), sg(14, q), true), m: mT(0, R * 0.38, 0), k: 'trim' });
      break;
    case 'paper':
      P.push({ g: cyl(s(0.08), s(0.95), s(0.62), 4), m: mTRS(0, R * 0.78, 0, 0, PI / 4, 0, 1, 1, 1).premultiply(new T.Matrix4().makeScale(1, 1, 0.55)), k: '#fbfbf6' });
      P.push(capPiece(R, 'hair', q, 1.05, 1.5));
      break;
    case 'bandana':
      P.push(capPiece(R, 'cover', q, 1.09, 1.6, -0.35));
      P.push({ g: sphC(s(0.2), 6, 5), m: mT(0, -R * 0.1, -R * 1.06), k: 'cover' });
      P.push({ g: rbox(s(0.18), s(0.55), 0.02, 0.008, 1), m: mTRS(R * 0.08, -R * 0.4, -R * 1.05, 0.2, 0, 0.25), k: 'cover' });
      break;
  }
  return P;
}
function scarfPieces(style?: any, R?: any, q?: any) {
  const P: any = [], s = (v?: any) => +(R * v).toFixed(4);
  const w = sg(14, q), h = sg(9, q);
  if (style === 'yazma') {
    P.push({ g: sphC(s(1.11), w, h, 0, TAU, 0, 1.3), m: mTRS(0, 0, 0, -0.52, 0, 0), k: 'cover' });
    P.push({ g: tor(s(1.07), s(0.06), 4, sg(18, q)), m: mTRS(0, 0, 0, -0.52, 0, 0).multiply(mTRS(0, R * 0.29, 0, PI / 2, 0, 0)), k: 'trim' });
    P.push({ g: sphC(s(1.12), w, sg(6, q), PI / 2 + 1.25, TAU - 2.5, 1.2, 0.95), m: M4(), k: 'cover' });
    P.push({ g: sphC(s(0.22), 6, 5), m: mT(0, -R * 0.62, -R * 0.98), k: 'cover' });
    P.push({ g: rbox(s(0.26), s(0.6), 0.025, 0.01, 1), m: mTRS(-R * 0.12, -R * 1.0, -R * 1.02, 0.15, 0, -0.2), k: 'cover' });
    P.push({ g: rbox(s(0.26), s(0.55), 0.025, 0.01, 1), m: mTRS(R * 0.14, -R * 0.98, -R * 1.0, 0.15, 0, 0.25), k: 'cover' });
    return P;
  }
  const sport = style === 'sport', loose = style === 'loose';
  const rr = sport ? 1.07 : 1.13, open = sport ? 0.78 : loose ? 0.98 : 0.86;
  P.push({ g: sphC(s(rr), w, h, 0, TAU, 0, loose ? 1.02 : 1.16), m: mTRS(0, 0, 0, loose ? -0.2 : -0.05, 0, 0), k: 'cover' });
  P.push({ g: sphC(s(rr), w, h, PI / 2 + open, TAU - open * 2, 0.95, 1.85), m: M4(), k: 'cover' });
  if (!loose) P.push({ g: sphC(s(rr), sg(8, q), sg(4, q), PI / 2 - open - 0.05, open * 2 + 0.1, 2.35, PI - 2.35), m: M4(), k: 'cover' });
  if (loose) {
    P.push({ g: cyl(s(0.82), s(1.75), s(1.05), w, true), m: mT(0, -R * 1.2, -R * 0.05), k: 'cover' });
    P.push({ g: cyl(s(0.74), s(0.82), s(0.5), w, true), m: mT(0, -R * 0.55, -R * 0.03), k: 'cover' });
  } else {
    P.push({ g: cyl(s(sport ? 0.62 : 0.7), s(sport ? 0.95 : 1.15), s(0.8), w, true), m: mT(0, -R * 1.1, 0), k: 'cover' });
    if (sport) P.push({ g: tor(s(1.03), s(0.05), 4, sg(16, q), PI * 1.2), m: mTRS(0, R * 0.12, R * 0.12, -0.15, 0, -PI * 0.1).multiply(mTRS(0, 0, 0, 0, 0, 0)).multiply(new T.Matrix4().makeRotationZ(0)), k: 'trim' });
    else P.push({ g: sphC(s(0.6), sg(8, q), sg(6, q)), m: mTRS(0, R * 0.25, -R * 0.92, 0, 0, 0, 1, 0.9, 1), k: 'cover' });
  }
  if (style === 'turban') P.push({ g: tor(s(1.1), s(0.09), 4, sg(18, q), PI), m: mTRS(0, R * 0.38, R * 0.05, -0.35, 0, 0).multiply(new T.Matrix4().makeRotationX(PI / 2)).multiply(new T.Matrix4().makeRotationZ(0)), k: 'trim' });
  return P;
}
CH._gear = { hairPieces, hatPieces, scarfPieces };

/* =====================================================================
   HEROES: one SkinnedMesh per hero
   ===================================================================== */
const FACE_SPECS = [
  { eye: 'round', brow: 'mid' }, { eye: 'oval', brow: 'thick' }, { eye: 'lash', brow: 'thin', blush: 0.3 }, { eye: 'small', brow: 'mid' },
  { eye: 'round', brow: 'thick', crow: 1 }, { eye: 'lash', brow: 'mid', dimples: 1 }, { eye: 'oval', brow: 'thin', freckles: 1 }, { eye: 'small', brow: 'thick', wrinkles: 1 },
  { eye: 'big', brow: 'thin', blush: 0.35 }, { eye: 'round', brow: 'mid', freckles: 1 }, { eye: 'lash', brow: 'thick', blush: 0.25 }, { eye: 'oval', brow: 'mid', wrinkles: 1, crow: 1 },
  { eye: 'small', brow: 'thin', dimples: 1 }, { eye: 'big', brow: 'mid' }, { eye: 'round', brow: 'thin', wrinkles: 1 }, { eye: 'oval', brow: 'thick', dimples: 1 }
];
const IRIS = ['#4a2e1e', '#5a3a22', '#3a2416', '#6b5a2e', '#4f6b3a', '#3f6a8a', '#2e2018', '#5e4430'];

/* named characters from the GDD (looks only) */
const PRESETS: any = {
  sabri: { skin: 4, body: 'round', hair: 'curly', hairColor: HAIRC.black, temples: '#a9a39c', mustache: 'thick', top: '#fbf9f4', topStyle: 'tee', sleeves: 'short', bottom: '#4f6f98', shoes: '#7a5236', apron: '#e0533c', apronText: 'SABRİ', pen: 'ear', faceSpec: { eye: 'round', iris: '#3a2416', brow: 'thick', crow: 1, blush: 0.28, mouthW: 15 }, style: 'sabri' },
  sabriye: { skin: 3, body: 'mid', hair: 'bun', hairColor: '#5a3524', top: '#6f9bc8', accent2: '#f6f1e6', pattern: 3, topStyle: 'shirt', sleeves: 'rolled', bottom: '#3f5878', shoes: '#8a3a2a', apron: '#e0533c', apronText: 'SABRİYE', pen: 'bun', earrings: true, faceSpec: { eye: 'lash', iris: '#6b3f22', brow: 'thick', dimples: 1, blush: 0.32, mouthW: 16 }, style: 'sabriye' },
  riza: { skin: 6, body: 'mid', hair: 'short', hairColor: HAIRC.darkbrown, top: '#fbfbf8', sleeves: 'short', bottom: '#59606b', apron: '#3fb5b0', apronText: 'RIZA', hat: 'paper', faceSpec: { eye: 'small', brow: 'mid', blush: 0.18 } },
  tayfun: { skin: 2, body: 'slim', hair: 'short', hairColor: HAIRC.chestnut, top: '#f6efe1', topStyle: 'shirt', sleeves: 'long', vest: '#8c2f39', bottom: '#2f3a4a', apronText: 'TAYFUN', mustache: false, faceSpec: { eye: 'oval', brow: 'mid', blush: 0.2, dimples: 1 } },
  nazli: { skin: 8, body: 'mid', hair: 'ponytail', hairColor: HAIRC.black, top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', vest: '#2b2b30', bowtie: '#c94f6d', bottom: '#2b2b30', apron: '#2b2b30', apronText: 'NAZLI', earrings: true, faceSpec: { eye: 'lash', brow: 'thin', blush: 0.3 } },
  necati: { skin: 2, body: 'mid', age: 'old', hair: 'short', hairColor: HAIRC.silver, hat: 'kasket', hatColor: '#6b6258', mustache: 'thin', top: '#e8e2d4', topStyle: 'shirt', vest: '#7a6a55', bottom: '#59606b', glasses: 'thick', faceSpec: { eye: 'small', brow: 'mid', browCol: '#8d8780', wrinkles: 1 } },
  nermin: { skin: 3, body: 'round', age: 'old', headscarf: 'yazma', scarfColor: '#f2a2b3', scarfTrim: '#fff6e6', hair: 'short', hairColor: HAIRC.grey, top: '#c94f6d', topStyle: 'cardigan', accent: '#8daa5b', bottom: '#5a4a6a', bottomStyle: 'skirt', faceSpec: { eye: 'round', brow: 'thin', wrinkles: 1, blush: 0.32 } },
  remzi: { skin: 5, body: 'mid', hair: 'short', hairColor: HAIRC.darkbrown, mustache: 'thick', top: '#fbfbf8', sleeves: 'short', apron: '#fbfbf8', apronText: 'REMZİ', bottom: '#4a4038', hat: 'cap', hatColor: '#e0533c', faceSpec: { eye: 'oval', brow: 'thick', crow: 1 } },
  bulent: { skin: 1, body: 'round', hair: 'short', hairColor: HAIRC.grey, mustache: 'curl', top: '#f6f1e6', topStyle: 'suit', accent: '#2e3a59', bowtie: '#c0392b', bottom: '#2e3a59', glasses: 'round', shoes: '#2b2522', faceSpec: { eye: 'small', brow: 'thick', browCol: '#6b655e', blush: 0.3 } }
};
const ROLE_LOOK: any = {
  doner: { top: '#fbfbf8', sleeves: 'short', apron: '#d9822b', hat: 'paper', bottom: '#59606b' },
  cay: { top: '#f6efe1', topStyle: 'shirt', sleeves: 'long', vest: '#8c2f39', bottom: '#2f3a4a' },
  garson: { top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', vest: '#2b2b30', bowtie: '#e0533c', bottom: '#2b2b30', apron: '#2b2b30' },
  tost: { top: '#f0d35a', sleeves: 'short', apron: '#e0533c', hat: 'bandana', hatColor: '#e0533c', bottom: '#3f5878' },
  temizlik: { top: '#7fb8d8', topStyle: 'overall', sleeves: 'short', bottom: '#7fb8d8', hat: 'cap', hatColor: '#3f8fc9', gloves: '#f2d24a', shoes: '#3d4a5c' },
  asci: { top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', apron: '#f2f2ee', hat: 'paper', bottom: '#2d2d33' },
  komi: { top: '#fbfbf8', sleeves: 'short', apron: '#d9d9d4', hat: 'bandana', hatColor: '#3f5878', bottom: '#2d2d33' },
  bulasikci: { top: '#3f6fa8', sleeves: 'short', apron: '#2b4c75', bottom: '#2d2d33', gloves: '#f2d24a' },
  kasiyer: { top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', vest: '#7a2430', bottom: '#2b2b30' },
  sef: { top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', apron: '#ffffff', hat: 'paper', bottom: '#1d1d1d' },
  guvenlik: { top: '#1d1d22', topStyle: 'jacket', sleeves: 'long', bottom: '#1d1d22', hat: 'cap', hatColor: '#1d1d22' },
  muzisyen: { top: '#8c2f39', topStyle: 'shirt', sleeves: 'long', vest: '#2b2b30', bottom: '#2f3a4a', hat: 'bandana', hatColor: '#d9822b' },
  hostes: { top: '#fbfbf8', topStyle: 'shirt', sleeves: 'long', vest: '#1d4f86', bottom: '#1d4f86' },
  barista: { top: '#2b2b30', sleeves: 'short', apron: '#7a3b1c', bottom: '#2b2b30', hat: 'cap', hatColor: '#7a3b1c' },
  mudur: { top: '#f4f4f2', topStyle: 'suit', sleeves: 'long', vest: '#2b2b30', bottom: '#2b2b30', bowtie: '#c9a24a' },
  vale: { top: '#7a2430', topStyle: 'jacket', sleeves: 'long', bottom: '#1d1d22', hat: 'cap', hatColor: '#7a2430' },
  kurye: { top: '#3fb5b0', topStyle: 'jacket', accent: '#3fb5b0', sleeves: 'long', bottom: '#2f3a4a', hat: 'helmet', hatColor: '#3fb5b0', courierBox: true }
};

const BODY_G: any = { slim: 0.9, mid: 1.0, round: 1.13 };
function normLook(look?: any, kind?: any, role?: any, seed?: any) {
  const R = C.rng((seed || 1) * 7919 + 13);
  let base: any = {};
  if (kind === 'sabri' || kind === 'sabriye') base = Object.assign({}, PRESETS[kind]);
  else if (kind === 'worker') {
    base = { skin: R.int(0, 11), body: R.pick(['slim', 'mid', 'mid', 'round']), hair: R.pick(['short', 'curly', 'buzz', 'bun', 'ponytail', 'short']), hairColor: R.pick([HAIRC.black, HAIRC.darkbrown, HAIRC.brown, HAIRC.chestnut]), mustache: R.chance(0.3), face: R.int(0, 15), shoes: R.pick(SHOES) };
    Object.assign(base, ROLE_LOOK[role] || ROLE_LOOK.doner);
  } else if (kind === 'vip') base = Object.assign({}, PRESETS.bulent);
  else if (kind === 'regular') base = Object.assign({}, CH.randomLook(R.pick(['emekli', 'teyze', 'plaza', 'taksici']), R));
  const L: any = Object.assign({ skin: 4, body: 'mid', hair: 'short', hairColor: HAIRC.darkbrown, mustache: false, headscarf: null, top: '#fbfbf8', bottom: '#3f5878', apron: null, shoes: '#4a3528' }, base, look || {});
  if (typeof L.skin === 'number') L.skinColor = SKINS[clamp(L.skin | 0, 0, 11)]; else L.skinColor = L.skin || SKINS[4];
  L.girth = L.girth || BODY_G[L.body] || 1;
  L.belly = L.body === 'round' ? 1 : 0;
  if (!L.faceSpec) { const fs: any = Object.assign({}, FACE_SPECS[(L.face == null ? (seed || 0) : L.face) % 16]); fs.iris = IRIS[((L.face || seed || 0) * 3) % IRIS.length]; if (L.age === 'old') fs.wrinkles = 1; L.faceSpec = fs; }
  if (L.goldTooth) L.faceSpec.goldTooth = true;
  if (L.sleeves == null) L.sleeves = /shirt|jacket|suit|cardigan|hoodie|uniform/.test(L.topStyle || '') ? 'long' : 'short';
  return L;
}

/* ---------- tool props held in a hand (shared geometry) ---------- */
function propGeo(kind?: any) {
  return C.geo('chars-prop-' + kind, () => {
    const b = new (GB as any)();
    if (kind === 'knife') {
      b.add(cyl(0.018, 0.02, 0.11, 8), { m: mT(0, -0.02, 0), color: '#5a3a22' });
      b.add(rbox(0.07, 0.012, 0.36, 0.005, 1), { m: mT(0, -0.02, 0.22), color: '#dfe4ea' });
      b.add(cyl(0.024, 0.024, 0.012, 8), { m: mTRS(0, -0.02, 0.045, PI / 2, 0, 0), color: '#c9a64a' });
    } else if (kind === 'teapot') { // classic double Turkish teapot (çaydanlık)
      b.add(sph(0.085, 12, 9), { m: mTRS(0, -0.13, 0.08, 0, 0, 0, 1, 0.8, 1), color: '#d9dde3' });
      b.add(sph(0.06, 12, 8), { m: mTRS(0, -0.02, 0.08, 0, 0, 0, 1, 0.85, 1), color: '#e9edf1' });
      b.add(cyl(0.012, 0.022, 0.12, 6), { m: mTRS(0.085, -0.1, 0.08, 0, 0, -0.9), color: '#d9dde3' });
      b.add(tor(0.05, 0.01, 4, 10, PI), { m: mTRS(0, 0.0, 0.08, 0, 0, 0), color: '#2b2522' });
      b.add(sph(0.016, 6, 5), { m: mT(0, 0.035, 0.08), color: '#2b2522' });
    } else if (kind === 'glass') { // tulip tea glass on a saucer
      b.add(lathe([[0.001, 0], [0.026, 0.004], [0.022, 0.03], [0.018, 0.05], [0.026, 0.08], [0.03, 0.095]], 10), { m: mT(0, -0.03, 0.03), color: '#b5471f' });
      b.add(cyl(0.05, 0.04, 0.01, 12), { m: mT(0, -0.035, 0.03), color: '#f4efe6' });
    } else if (kind === 'cloth') {
      b.add(rbox(0.16, 0.025, 0.12, 0.01, 1), { m: mTRS(0, -0.04, 0.02, 0.2, 0, 0), color: '#7fcfd3' });
      b.add(rbox(0.05, 0.026, 0.12, 0.01, 1), { m: mTRS(0.03, -0.04, 0.02, 0.2, 0, 0), color: '#fff6e6' });
    } else if (kind === 'phone') {
      b.add(rbox(0.075, 0.14, 0.014, 0.01, 1), { m: mT(0, -0.04, 0.03), color: '#2a2a33' });
      b.add(rbox(0.062, 0.12, 0.004, 0.005, 1), { m: mT(0, -0.04, 0.022), color: '#9fd3f5' });
    } else if (kind === 'money') {
      b.add(rbox(0.16, 0.045, 0.085, 0.008, 1), { m: mTRS(0, -0.03, 0.05, 0, 0.2, 0), color: '#6cc486' });
      b.add(rbox(0.035, 0.05, 0.09, 0.006, 1), { m: mTRS(0, -0.03, 0.05, 0, 0.2, 0), color: '#f2b632' });
    }
    return b.build();
  });
}
const PROP_MAT = () => C.mat('#ffffff', { vertexColors: true });

/* ---------- hero atlas (512): 6 face cells, white, apron, shirt pattern ---------- */
const EXPR: any = { normal: 0, blink: 1, happy: 2, angry: 3, talk: 4, sleep: 5 };
const EXPR_NAMES = ['normal', 'blink', 'happy', 'angry', 'talk', 'sleep'];
// Motor: the hero atlas is 1024x512. Left half = the v2 512 layout (u halved), right half = 4x4 cells of 128 px
// holding the 12 expressions + blink + talk (X_CELLS order). cellRect(c) addresses the motor cells.
const cellRect = (e?: any) => { const x = 512 + (e % 4) * 128, y = Math.floor(e / 4) * 128; return [x / 1024, 1 - (y + 128) / 512, 0.125, 0.25]; };
const WHITE_UV = [0.4375, 0.875];
const APRON_BIB = [0, 1 - 400 / 512, 0.25, 144 / 512], APRON_SKIRT = [0, 0, 0.25, 112 / 512], PATTERN = [0.25, 0, 0.25, 0.5];
function drawPattern(g?: any, x?: any, y?: any, w?: any, h?: any, base?: any, alt?: any, kind?: any) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  if (!kind) return;
  g.fillStyle = alt;
  if (kind === 1) { for (let i = 0; i < h; i += 32) g.fillRect(x, y + i, w, 14); }
  else if (kind === 2) { for (let i = 0; i < w; i += 32) g.fillRect(x + i, y, 12, h); }
  else if (kind === 3) {
    g.globalAlpha = 0.55; for (let i = 0; i < w; i += 32) g.fillRect(x + i, y, 12, h); for (let i = 0; i < h; i += 32) g.fillRect(x, y + i, w, 12);
    g.globalAlpha = 0.35; g.fillStyle = shade(base, 0.7); for (let i = 16; i < w; i += 32) g.fillRect(x + i, y, 3, h); for (let i = 16; i < h; i += 32) g.fillRect(x, y + i, w, 3);
    g.globalAlpha = 1;
  }
}
function heroAtlas(L?: any) {
  return C.canvasTex(1024, 512, (g?: any) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 1024, 512);
    for (let e = 0; e < 6; e++) paintFace(g, (e % 3) * 128, Math.floor(e / 3) * 128, 128, L.faceSpec, EXPR_NAMES[e], L.skinColor);
    for (let c = 0; c < X_CELLS.length; c++) paintFaceX(g, 512 + (c % 4) * 128, Math.floor(c / 4) * 128, 128, L.faceSpec, c, L.skinColor, true);
    // apron: bib (rows 256-400) with name, skirt (rows 400-512)
    const ap = L.apron || '#e0533c';
    g.clearRect(0, 256, 256, 256);
    g.fillStyle = ap; C.rrect(g, 34, 262, 188, 150, 18); g.fill(); g.fillRect(34, 330, 188, 82);
    g.fillRect(0, 400, 256, 112);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 498, 256, 14); g.fillRect(70, 430, 116, 4);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(40, 268, 176, 5);
    const txt = (L.apronText || '').toLocaleUpperCase('tr-TR');
    if (txt) {
      const dark = new T.Color(ap).getHSL({ h: 0, s: 0, l: 0 }).l > 0.75;
      g.fillStyle = dark ? '#c0392b' : '#fff8ec'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${txt.length > 6 ? 36 : 44}px "Baloo 2", "Arial Black", system-ui, sans-serif`;
      C.fitText(g, txt, 128, 352, 170);
    }
    drawPattern(g, 256, 256, 256, 256, L.top, L.accent2 || shade(L.top, 0.8), L.pattern || 0);
  });
}

/* ---------- hero rig geometry ---------- */
const BONES = ['root', 'hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'thL', 'knL', 'ftL', 'thR', 'knR', 'ftR', 'brL', 'brR'];
const BI: any = {}; BONES.forEach((n?: any, i?: any) => BI[n] = i);
function buildHeroMesh(L?: any) {
  const g = L.girth, belly = L.belly, hs = L.age === 'old' ? 0.97 : 1;
  const hipY = 0.8, kneeY = 0.44, ankY = 0.085, shY = 1.27, elbY = 1.01, handY = 0.765, headY = 1.565, R = 0.195;
  const maxR = (0.226 + 0.035 * belly) * g;
  const shX = 0.205 * g + 0.05, hipX = 0.1 * g;
  const armOut = Math.max(0.07, Math.asin(clamp((maxR * 1.0 + 0.085 - shX) / 0.33, 0, 0.9)));
  // bones (rest pose)
  const B: any = {}, list: any = [];
  const mk = (n?: any, p?: any, x?: any, y?: any, z?: any) => { const b = new T.Bone(); b.name = n; b.position.set(x, y, z); if (p) B[p].add(b); B[n] = b; list.push(b); };
  mk('root', null, 0, 0, 0); mk('hips', 'root', 0, hipY, 0); mk('spine', 'hips', 0, 0.02, 0); mk('chest', 'spine', 0, 0.33, 0);
  mk('neck', 'chest', 0, 1.355 - 1.15, 0); mk('head', 'neck', 0, 0.06, 0);
  mk('shL', 'chest', -shX, shY - 1.15, 0); mk('elL', 'shL', 0, elbY - shY, 0); mk('haL', 'elL', 0, handY - elbY, 0);
  mk('shR', 'chest', shX, shY - 1.15, 0); mk('elR', 'shR', 0, elbY - shY, 0); mk('haR', 'elR', 0, handY - elbY, 0);
  mk('thL', 'hips', -hipX, 0, 0); mk('knL', 'thL', 0, kneeY - hipY, 0); mk('ftL', 'knL', 0, ankY - kneeY, 0);
  mk('thR', 'hips', hipX, 0, 0); mk('knR', 'thR', 0, kneeY - hipY, 0); mk('ftR', 'knR', 0, ankY - kneeY, 0);
  mk('brL', 'head', 0, 0, 0); mk('brR', 'head', 0, 0, 0); // motor: brow bones, placed below once the head shape is known
  ['shL', 'shR'].forEach((n?: any) => B[n].rotation.order = 'ZXY');
  const b = new (GB as any)({ skinIndex: 4, skinWeight: 4 });
  const W1 = [1, 0, 0, 0];
  const on = (bone?: any, o?: any) => Object.assign(o, { skinIndex: [BI[bone], 0, 0, 0], skinWeight: W1, uv: o.uv || o.uvRect ? o.uv : WHITE_UV });
  const skin = L.skinColor, skinD = shade(skin, 0.93), top = L.top, pants = L.bottom;
  const jacket = /jacket|suit|cardigan|hoodie/.test(L.topStyle || '') ? (L.accent || shade(top, 0.75)) : null;
  const sleeveCol = jacket || top;
  const patterned = !!L.pattern;
  const overall = L.topStyle === 'overall';
  // ---- legs
  const skirt = L.bottomStyle === 'skirt', shorts = L.bottomStyle === 'shorts';
  [['L', -1], ['R', 1]].forEach(([s, sx]: any) => {
    const x = sx * hipX;
    b.add(cap(0.088 * Math.sqrt(g), 0.22, 3, 10), on('th' + s, { m: mT(x, 0.62, 0), color: pants }));
    b.add(cap(0.074, 0.25, 3, 10), on('kn' + s, { m: mT(x, 0.275, 0), color: shorts ? skin : pants }));
    b.add(rbox(0.15, 0.1, 0.27, 0.045, 2), on('ft' + s, { m: mT(x, 0.05, 0.04), color: L.shoes }));
    b.add(rbox(0.152, 0.025, 0.272, 0.012, 1), on('ft' + s, { m: mT(x, 0.012, 0.04), color: shade(L.shoes, 1.6) }));
  });
  // ---- torso (lathe) with belt; pattern via atlas
  const tp = [[0.001, 0.69], [0.13, 0.695], [0.192 * g, 0.73], [0.212 * g, 0.8], [(0.222 + 0.03 * belly) * g, 0.9], [(0.226 + 0.035 * belly) * g, 0.98], [(0.22 + 0.012 * belly) * g, 1.08], [0.226 * g, 1.18], [0.212 * g, 1.26], [0.165 * g, 1.325], [0.085, 1.355], [0.001, 1.36]];
  const torsoDeform = (v?: any, n?: any) => { v.z *= 0.8; if (v.z > 0 && belly) v.z += belly * 0.07 * Math.exp(-Math.pow((v.y - 0.93) / 0.14, 2)) * Math.min(1, v.z / 0.12); };
  const topOf = (y?: any) => y < 0.795 ? (overall ? top : pants) : y < 0.835 ? (overall ? top : '#4a3528') : (patterned ? '#ffffff' : top);
  b.add(lathe(tp, 18), on('spine', { deform: torsoDeform, color: (v?: any) => topOf(v.y), uvFn: (v?: any, u?: any, w?: any) => (patterned && v.y >= 0.835) ? [PATTERN[0] + u * PATTERN[2], PATTERN[1] + clamp((v.y - 0.8) / 0.56, 0, 1) * PATTERN[3]] : WHITE_UV }));
  if (overall) { // overall straps
    [-1, 1].forEach((sx?: any) => b.add(rbox(0.05, 0.36, 0.02, 0.01, 1), on('spine', { m: mTRS(sx * 0.1 * g, 1.1, 0.19 * g * 0.8 + 0.01, -0.12, 0, 0), color: shade(top, 0.8) })));
    b.add(rbox(0.26 * g, 0.2, 0.03, 0.02, 1), on('spine', { m: mT(0, 0.96, (0.226 + 0.04 * belly) * g * 0.8 + 0.03 * belly + 0.01), color: shade(top, 0.92) }));
  }
  // jacket / vest shells
  const shell = (col?: any, y0?: any, y1?: any, open?: any) => {
    const pts = tp.filter((p?: any) => p[1] >= y0 - 0.001 && p[1] <= y1 + 0.001).map((p?: any) => [p[0] + 0.014, p[1]]);
    b.add(lathe(pts, 18, open, TAU - 2 * open), on('spine', { deform: torsoDeform, color: col }));
  };
  if (jacket) shell(jacket, L.topStyle === 'cardigan' ? 0.73 : 0.69, 1.326, L.topStyle === 'hoodie' ? 0.0001 : 0.32);
  if (L.vest) shell(L.vest, 0.8, 1.27, 0.36);
  if (L.topStyle === 'hoodie') b.add(sph(0.13, 10, 6), on('chest', { m: mTRS(0, 1.33, -0.13 * g, 0, 0, 0, 1.3, 0.8, 0.9), color: jacket }));
  const frontZ = (y?: any) => { let r = 0; for (let i = 1; i < tp.length; i++) if (tp[i][1] >= y) { const a = tp[i - 1], c = tp[i], t = (y - a[1]) / (c[1] - a[1]); r = lerp(a[0], c[0], t); break; } let z = r * 0.8; if (belly) z += belly * 0.07 * Math.exp(-Math.pow((y - 0.93) / 0.14, 2)); return z; };
  if (L.tie) { b.add(rbox(0.05, 0.3, 0.02, 0.01, 1), on('spine', { m: mTRS(0, 1.12, frontZ(1.12) + 0.02, -0.12 - 0.15 * belly, 0, 0), color: L.tie })); }
  if (L.bowtie) { [-1, 1].forEach((sx?: any) => b.add(cone(0.035, 0.06, 6), on('chest', { m: mTRS(sx * 0.03, 1.315, frontZ(1.3) + 0.03, 0, 0, sx * PI / 2), color: L.bowtie }))); b.add(sph(0.018, 6, 5), on('chest', { m: mT(0, 1.315, frontZ(1.3) + 0.035), color: L.bowtie })); }
  if (L.nameTag) b.add(rbox(0.07, 0.03, 0.012, 0.005, 1), on('spine', { m: mT(-0.1 * g, 1.17, frontZ(1.17) + 0.02), color: '#fbfbf8' }));
  // ---- apron: bib on spine, skirt blended to thighs
  if (L.apron) {
    const bp = tp.filter((p?: any) => p[1] >= 0.8 && p[1] <= 1.23).map((p?: any) => [p[0] + 0.016, p[1]]);
    b.add(lathe(bp, 14, -1.0, 2.0), on('spine', { deform: torsoDeform, color: '#ffffff', uvRect: APRON_BIB }));
    const sp = [[0.252 * g, 0.5], [0.24 * g, 0.6], [0.226 * g, 0.7], [0.22 * g, 0.8]];
    const skirtW = (v?: any) => { const t = clamp((0.82 - v.y) / 0.32, 0, 1), wl = t * clamp(-v.x / 0.12, 0, 1), wr = t * clamp(v.x / 0.12, 0, 1); return [1 - wl - wr, wl, wr, 0]; };
    b.add(lathe(sp, 14, -1.05, 2.1), { deform: (v?: any) => { v.z = v.z * 0.82 + 0.01 + belly * 0.035; }, color: '#ffffff', uvRect: APRON_SKIRT, skinIndex: [BI.hips, BI.thL, BI.thR, 0], skinWeight: skirtW });
    b.add(tor(0.11, 0.008, 3, 12, PI), on('neck', { m: mTRS(0, 1.33, 0.02, -1.25, 0, 0), color: L.apron }));
  }
  if (skirt) {
    const sp = [[0.235 * g, 0.84], [0.25 * g, 0.7], [0.28 * g, 0.45], [0.31 * g, 0.18], [0.3 * g, 0.14]];
    const sw = (v?: any) => { const t = clamp((0.8 - v.y) / 0.6, 0, 1), wl = t * clamp(-v.x / 0.14, 0, 1), wr = t * clamp(v.x / 0.14, 0, 1); return [1 - wl - wr, wl, wr, 0]; };
    b.add(lathe(sp.slice().reverse(), 16), { deform: (v?: any) => { v.z *= 0.85; }, color: pants, uv: WHITE_UV, skinIndex: [BI.hips, BI.thL, BI.thR, 0], skinWeight: sw });
  }
  // ---- arms
  [['L', -1], ['R', 1]].forEach(([s, sx]: any) => {
    const x = sx * shX;
    b.add(sph(0.085, 10, 8), on('sh' + s, { m: mT(x, shY - 0.005, 0), color: sleeveCol, uv: patterned && !jacket ? [0.375, 0.25] : WHITE_UV }));
    const sl = L.sleeves;
    if (sl === 'short') {
      b.add(cap(0.064, 0.17, 3, 10), on('sh' + s, { m: mT(x, shY - 0.13, 0), color: skin }));
      b.add(cyl(0.083, 0.08, 0.13, 12), on('sh' + s, { m: mT(x, shY - 0.06, 0), color: patterned ? '#ffffff' : sleeveCol, uv: patterned ? [0.375, 0.25] : WHITE_UV }));
    } else {
      b.add(cap(0.069, 0.17, 3, 10), on('sh' + s, { m: mT(x, shY - 0.13, 0), color: patterned && !jacket ? '#ffffff' : sleeveCol, uv: patterned && !jacket ? [0.35, 0.3] : WHITE_UV }));
    }
    const foreCol = sl === 'long' ? sleeveCol : skin;
    b.add(cap(sl === 'long' ? 0.064 : 0.058, 0.16, 3, 10), on('el' + s, { m: mT(x, elbY - 0.11, 0), color: foreCol, uv: sl === 'long' && patterned && !jacket ? [0.36, 0.28] : WHITE_UV }));
    if (sl === 'rolled') b.add(tor(0.064, 0.022, 5, 12), on('el' + s, { m: mTRS(x, elbY + 0.01, 0, PI / 2, 0, 0), color: patterned ? '#ffffff' : sleeveCol, uv: patterned ? [0.39, 0.22] : WHITE_UV }));
    if (sl === 'long') b.add(tor(0.06, 0.012, 4, 12), on('el' + s, { m: mTRS(x, elbY - 0.2, 0, PI / 2, 0, 0), color: shade(foreCol, 0.88) }));
    const hc = L.gloves || skin;
    b.add(sph(0.068, 10, 8), on('ha' + s, { m: mTRS(x, handY - 0.03, 0.005, 0, 0, 0, 0.95, 1.1, 0.85), color: hc }));
    b.add(sph(0.027, 6, 5), on('ha' + s, { m: mT(x - sx * 0.045, handY - 0.01, 0.035), color: hc }));
  });
  // ---- neck + head
  b.add(cyl(0.072, 0.085, 0.13, 12), on('neck', { m: mT(0, 1.35, -0.005), color: skinD }));
  const HM = mTRS(0, headY, 0, 0, 0, 0, 1, 1.03 * hs, 0.98);
  b.add(sph(R, 22, 16), on('head', { m: HM, color: skin }));
  const faceStart = b.pos.length / 3;
  b.add(facePatch(+(R * 1.004).toFixed(4), 16, 12), on('head', { m: HM, color: '#ffffff', uvRect: cellRect(0) }));
  const faceEnd = b.pos.length / 3;
  const ek = L.ears === 'kucuk' ? 0.75 : L.ears === 'kepce' ? 1.45 : 1, nk = L.nose === 'kucuk' ? 0.7 : L.nose === 'iri' ? 1.4 : 1, nl = L.nose === 'uzun' ? 1.6 : 1;
  [-1, 1].forEach((sx?: any) => b.add(sph(0.046, 8, 6), on('head', { m: mTRS(sx * R * (0.97 + (ek - 1) * 0.08), headY - 0.005, -0.01, 0, 0, sx * (ek - 1) * 0.5, 0.55 * ek, ek, 0.85 * ek), color: skinD })));
  b.add(sph(0.04, 10, 8), on('head', { m: mTRS(0, headY - 0.03 - (nl - 1) * 0.01, R * 0.985 + (nl - 1) * 0.012, 0, 0, 0, 1.05 * nk, 0.9 * nk * (nl > 1 ? 1.15 : 1), 0.95 * nk * nl), color: shade(skin, 0.95) }));
  const hairC = L.hairColor;
  const hairCol = (v?: any) => (L.temples && Math.abs(v.x) > 0.13 && v.y < headY + 0.07) ? L.temples : hairC;
  const mouthY = headY - 0.075;
  if (L.mustache) {
    const thick = L.mustache === 'thick' ? 0.034 : L.mustache === 'thin' ? 0.018 : 0.026;
    const mc = L.mustacheColor || (L.age === 'old' ? HAIRC.silver : hairC);
    [-1, 1].forEach((sx?: any) => {
      b.add(cap(thick, 0.06, 3, 8), on('head', { m: mTRS(sx * 0.038, mouthY, R * 0.93, 0, sx * 0.35, sx * 1.15), color: mc }));
      if (L.mustache === 'thick' || L.mustache === 'curl') b.add(sph(thick * 0.75, 6, 5), on('head', { m: mT(sx * 0.088, mouthY + 0.018, R * 0.83), color: mc }));
    });
  }
  if (L.beard === 'goatee') b.add(sph(0.05, 10, 8), on('head', { m: mTRS(0, mouthY - 0.065, R * 0.86, 0, 0, 0, 0.9, 1.2, 0.8), color: L.age === 'old' ? HAIRC.silver : hairC }));
  else if (L.beard) b.add(sph(+(R * 1.03).toFixed(4), 14, 6, PI / 2 - 1.15, 2.3, PI * 0.56, PI * 0.36), on('head', { m: HM, color: L.age === 'old' ? HAIRC.silver : hairC }));
  if (L.glasses) {
    const gc = L.glasses === 'sun' ? '#1b1b22' : L.glasses === 'thick' ? '#3a2a20' : '#4a4a55', tk = L.glasses === 'thick' ? 0.011 : 0.007;
    [-1, 1].forEach((sx?: any) => {
      b.add(tor(0.042, tk, 4, 14), on('head', { m: mT(sx * 0.072, headY + 0.005, R * 0.985), color: gc }));
      b.add(cyl(0.04, 0.04, 0.004, 12), on('head', { m: mTRS(sx * 0.072, headY + 0.005, R * 0.975, PI / 2, 0, 0), color: L.glasses === 'sun' ? '#22252e' : '#dcefff' }));
      b.add(box(0.008, 0.008, 0.18), on('head', { m: mT(sx * R * 0.93, headY + 0.015, 0.09), color: gc }));
    });
    b.add(box(0.05, 0.008, 0.008), on('head', { m: mT(0, headY + 0.012, R * 1.0), color: gc }));
  }
  if (L.earrings) [-1, 1].forEach((sx?: any) => b.add(tor(0.017, 0.0045, 4, 10), on('head', { m: mTRS(sx * R * 0.98, headY - 0.065, 0.0, 0, PI / 2, 0), color: '#f2b632' })));
  // hair / headscarf / hat
  const gearM = HM;
  const put = (pieces?: any, cmap?: any) => pieces.forEach((p?: any) => {
    const m = new T.Matrix4().multiplyMatrices(gearM, p.m);
    const c = cmap[p.k] || p.k;
    b.add(p.g, on('head', { m, color: c === 'hairfn' ? hairCol : c }));
  });
  const scarfCol = L.scarfColor || L.hatColor || '#8c5a9a';
  const gmap: any = { hair: 'hairfn', cover: scarfCol, trim: L.scarfTrim || shade(scarfCol, 1.25), dark: '#2b3340', gold: '#f2b632' };
  if (L.headscarf) {
    if (L.headscarf === 'loose' || L.headscarf === 'yazma') put(hairPieces('buzz', R, 1), gmap);
    put(scarfPieces(L.headscarf, R, 1), gmap);
  } else {
    let hair = L.hair;
    // any hat: hair is flattened to a close-fitting cap so nothing pokes through the brim or crown
    if (L.hat && hair !== 'long' && hair !== 'ponytail' && hair !== 'bald' && hair !== 'none') hair = 'buzz';
    else if (L.hat && hair === 'wavy') hair = 'long';
    put(hairPieces(hair, R, 1), gmap);
    if (L.hat) put(hatPieces(L.hat, R, 1), { hair: 'hairfn', cover: L.hatColor || '#e0533c', trim: shade(L.hatColor || '#e0533c', 0.75), dark: '#2b3340', gold: '#f2b632' });
  }
  if (L.pen === 'ear') b.add(cyl(0.008, 0.008, 0.13, 6), on('head', { m: mTRS(R * 0.93, headY + 0.055, -0.02, 0.25, 0, 1.25), color: '#2d63b8' }));
  if (L.pen === 'bun') b.add(cyl(0.008, 0.008, 0.16, 6), on('head', { m: mTRS(0.02, headY + R * 0.66, -R * 0.82, -0.7, 0, 0.9), color: '#2d63b8' }));
  if (L.courierBox) {
    b.add(rbox(0.34, 0.34, 0.26, 0.04, 2), on('chest', { m: mT(0, 1.08, -0.28 * g), color: '#3fb5b0' }));
    b.add(rbox(0.2, 0.08, 0.01, 0.01, 1), on('chest', { m: mT(0, 1.12, -0.28 * g - 0.135), color: '#fff6e6' }));
  }
  // ---- motor: brows as two skinned arcs on their own bones (spring-driven raise + tilt, animasyon-5)
  const browRest: any = {};
  { const bwPx = L.faceSpec.brow === 'thick' ? 6 : L.faceSpec.brow === 'thin' ? 2.4 : L.faceSpec.brow === 'none' ? 0 : 3.8;
    const rr = R * 1.012, th = FACE_T0 + (38.5 / 128) * FACE_TL, headBoneY = 1.415, hsY = 1.03 * hs;
    [['brL', -1], ['brR', 1]].forEach(([n, sx]: any) => {
      const ph = PI / 2 - FACE_PHI / 2 + ((64 + sx * 21) / 128) * FACE_PHI;
      const p = new T.Vector3(-rr * Math.cos(ph) * Math.sin(th), rr * Math.cos(th) * hsY + headY, rr * Math.sin(ph) * Math.sin(th) * 0.98);
      const nrm = new T.Vector3(p.x, (p.y - headY) / (hsY * hsY), p.z / (0.98 * 0.98)).normalize();
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), nrm);
      B[n].position.set(p.x, p.y - headBoneY, p.z); B[n].quaternion.copy(q);
      browRest[n] = { p: B[n].position.clone(), q: q.clone() };
      if (!bwPx) return;
      const thick = bwPx * (FACE_TL / 128) * R, Rb = 0.076, arc = 0.715;
      const tg = new T.TorusGeometry(Rb, thick / 2, 3, 6, arc);
      tg.rotateZ(PI / 2 - arc / 2); tg.translate(0, -Rb, 0); tg.scale(1, 1, 0.5);
      const m = new T.Matrix4().compose(p, q, new T.Vector3(1, 1, 1));
      b.add(tg, on(n, { m, color: L.faceSpec.browCol || L.faceSpec.ink || '#2a1c16' }));
    });
  }
  const geo = b.build({ skinIndex: 'u16' });
  return { geo, B, list, faceStart, faceEnd, armOut, browRest, tris: b.tris(), dims: { hipY, kneeY, ankY, L1: hipY - kneeY, L2: kneeY - ankY, headTop: headY + R * 1.12 + (L.hat === 'chef' ? 0.25 : 0) } };
}

/* ---------- Hero object and procedural animation ---------- */
const JOINTS = ['rootY', 'hipZ', 'spX', 'spY', 'spZ', 'nkX', 'hdX', 'hdY', 'hdZ', 'lsX', 'lsY', 'lsZ', 'leX', 'lhX', 'lhZ', 'rsX', 'rsY', 'rsZ', 'reX', 'rhX', 'rhZ', 'ltX', 'ltZ', 'lkX', 'lfX', 'rtX', 'rtZ', 'rkX', 'rfX', 'breath'];
const LEGJ: any = { ltX: 1, ltZ: 1, lkX: 1, lfX: 1, rtX: 1, rtZ: 1, rkX: 1, rfX: 1, rootY: 1, hipZ: 1 };
const FULL_ACTS: any = { cut: 1, pour: 1, wipe: 1, sleep: 1, pet: 1, sit: 1, cheer: 1 };
const ACT_PROP: any = { cut: ['knife', 'haR'], pour: ['teapot', 'haR', 'glass', 'haL'], wipe: ['cloth', 'haR'], selfie: ['phone', 'haL'], count: ['money', 'haL'] };
const STYLE: any = { sabri: { rate: 8.6, sway: 0.05, bob: 1 }, sabriye: { rate: 10.4, sway: 0.02, bob: 0.8 }, def: { rate: 9.4, sway: 0.03, bob: 0.9 } };

function Hero(this: any, opts?: any) {
  opts = opts || {};
  this.kind = opts.kind || 'worker'; this.role = opts.role; this.seed = opts.seed == null ? Math.floor(vrand() * 1e6) : opts.seed;
  this.group = new T.Group(); this.group.name = 'hero-' + this.kind;
  this.rig = new T.Group(); this.group.add(this.rig);
  this.hand = new T.Object3D(); this.hand.name = 'hand';
  this.head = new T.Object3D(); this.head.name = 'headTop';
  this.blob = makeBlob(0.85, 0.26); this.group.add(this.blob);
  this.t = (this.seed % 97) * 0.37; this.phase = 0; this.spd = 0; this.carryW = 0; this.blinkT = 1 + (this.seed % 5) * 0.4; this.blinkOn = 0;
  this.J = {}; JOINTS.forEach((k?: any) => this.J[k] = 0); this.J.breath = 1;
  this.act = 'idle'; this.actT = 0; this.after = 0; this.afterKind = null; this.expr = -1; this.talkT = 0; this.mood = 'ok';
  this.props = {};
  this.preset = opts.preset;
  this.setLook(opts.look);
}
Hero.prototype.setLook = function (this: any, look?: any) {
  let base = look;
  if (this.preset && PRESETS[this.preset]) base = Object.assign({}, PRESETS[this.preset], look || {});
  const L = this.look = normLook(base, this.preset ? 'custom' : this.kind, this.role, this.seed);
  this.style = STYLE[L.style] || STYLE.def;
  if (this.mesh) { this.rig.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); if (this.tex) this.tex.dispose(); }
  const H = withSeg(SEG.hero, () => buildHeroMesh(L));
  this.tex = heroAtlas(L);
  const mat = new T.MeshLambertMaterial({ vertexColors: true, map: this.tex, alphaTest: 0.5 });
  const mesh = new T.SkinnedMesh(H.geo, mat);
  mesh.add(H.B.root); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true);
  mesh.bind(new T.Skeleton(H.list));
  this.mesh = mesh; this.B = H.B; this.H = H; this.armOut = H.armOut; this.dims = H.dims;
  this.rig.add(mesh);
  const sc = L.height || (L.age === 'old' ? 0.96 : 1);
  this.rig.scale.setScalar(sc);
  this.blob.scale.set(0.7 * L.girth + 0.2, 1, 0.7 * L.girth + 0.2);
  // anchors
  H.B.chest.add(this.hand); this.hand.position.set(0, -0.03, 0.43 + (L.belly ? 0.06 : 0));
  H.B.head.add(this.head); this.head.position.set(0, H.dims.headTop - 1.415, 0);
  // props
  for (const k in this.props) { const p = this.props[k]; if (p.parent) p.parent.remove(p); }
  this.props = {};
  this.uvAttr = mesh.geometry.attributes.uv;
  this.faceUV = this.uvAttr.array.slice(H.faceStart * 2, H.faceEnd * 2); // cell-0 UVs
  this.expr = -1; this.setExpr(0);
  return this;
};
Hero.prototype.setExpr = function (this: any, e?: any) {
  if (e === this.expr) return;
  this.expr = e;
  const r0 = cellRect(0), r = cellRect(e), a = this.uvAttr.array, s = this.H.faceStart * 2;
  for (let i = 0; i < this.faceUV.length; i += 2) { a[s + i] = this.faceUV[i] - r0[0] + r[0]; a[s + i + 1] = this.faceUV[i + 1] - r0[1] + r[1]; }
  this.uvAttr.needsUpdate = true;
};
// motor: v2 face indices (normal, blink, happy, angry, talk, sleep) -> X_CELLS cells
const V2_CELL = [0, 12, 2, 7, 13, 5];
const BLINKABLE: any = { 0: 1, 1: 1, 4: 1, 6: 1, 7: 1, 10: 1 };
const X_DEF_BROW: any = { neutral: 'flat', smile: 'flat', grin: 'up', laugh: 'up', surprised: 'up', sleepy: 'down', pout: 'worried', grumpy: 'down', love: 'up', wink: 'oneUp', thinking: 'down', bliss: 'flat', blink: 'flat', talk: 'flat' };
// brow targets per side: [raise m, tilt rad (positive = inner end down)]
const BROW_T: any = { flat: [[0, 0], [0, 0]], up: [[0.009, -0.05], [0.009, -0.05]], down: [[-0.004, 0.32], [-0.004, 0.32]], worried: [[0.004, -0.3], [0.004, -0.3]], oneUp: [[0.012, -0.12], [-0.002, 0.08]] };
const _bq = new T.Quaternion(), _bz = new T.Vector3(0, 0, 1);
/** Spring-driven brow raise/tilt (k 260, d 18: quick with a little overshoot = toy springiness). */
Hero.prototype.updateBrows = function (this: any, dt?: any, brow?: any) {
  const H = this.H, rest = H && H.browRest; if (!rest || !rest.brL) return;
  if (!this.bs) this.bs = [0, 0, 0, 0, 0, 0, 0, 0]; // [raiseL, vel, tiltL, vel, raiseR, vel, tiltR, vel]
  const tg = BROW_T[brow] || BROW_T.flat, bs = this.bs, k = 260, d = 18, h = Math.min(dt, 1 / 30);
  for (let side = 0; side < 2; side++) for (let c = 0; c < 2; c++) {
    const i = side * 4 + c * 2, target = tg[side][c] * (c === 1 ? (side === 0 ? -1 : 1) : 1);
    for (let n = 0; n < 2; n++) { bs[i + 1] += ((target - bs[i]) * k - bs[i + 1] * d) * h / 2; bs[i] += bs[i + 1] * h / 2; }
  }
  ['brL', 'brR'].forEach((n, side) => {
    const bone = this.B[n], r = rest[n];
    bone.position.copy(r.p); bone.position.y += bs[side * 4];
    bone.quaternion.copy(r.q).multiply(_bq.setFromAxisAngle(_bz, bs[side * 4 + 2]));
  });
};
/** Motor API: force an expression cell (X_CELLS index, or null = mood driven) and an optional brow. */
Hero.prototype.setFace = function (this: any, cell?: any, brow?: any) { this.exprOverride = cell; this.browOverride = brow || null; };
Hero.prototype.prop = function (this: any, kind?: any, bone?: any) {
  const key = kind;
  if (!this.props[key]) { const m = new T.Mesh(withSeg(0.7, () => propGeo(kind)), PROP_MAT()); m.castShadow = true; m.visible = false; this.props[key] = m; this.B[bone].add(m); }
  return this.props[key];
};
/* main animation step */
Hero.prototype.update = function (this: any, dt?: any, s?: any) {
  s = s || {};
  dt = Math.min(dt || 0, 0.1);
  this.t += dt;
  const t = this.t, J = this.J, Tg: any = {};
  JOINTS.forEach((k?: any) => Tg[k] = 0); Tg.breath = 1;
  let act = s.act || 'idle';
  if (act !== this.act) {
    if ((this.act === 'cut' || this.act === 'pour' || this.act === 'wipe' || this.act === 'count') && act === 'idle') { this.after = 1.4; this.afterKind = this.look.style === 'sabriye' ? 'pocket' : 'apronwipe'; }
    this.act = act; this.actT = 0;
  }
  this.actT += dt; const tau = this.actT;
  if (this.after > 0) this.after -= dt;
  const run = act === 'chase';
  this.spd = damp(this.spd, clamp(s.speed || 0, 0, 1), 10, dt);
  this.carryW = damp(this.carryW, s.carry ? 1 : 0, 12, dt);
  const v = run ? Math.max(0.9, this.spd) : this.spd, st = this.style;
  // ---- locomotion layer
  const rate = run ? 15.5 : st.rate * (0.5 + 0.7 * v);
  if (v > 0.03) this.phase += dt * rate;
  const ph = this.phase, sn = Math.sin(ph), cs = Math.cos(ph);
  const A = v * (run ? 0.95 : 0.52), K = v * (run ? 1.55 : 0.9);
  Tg.ltX = -A * sn; Tg.rtX = A * sn;
  Tg.lkX = K * (0.1 + 0.9 * Math.max(0, cs)) + (run ? 0.15 * v : 0); Tg.rkX = K * (0.1 + 0.9 * Math.max(0, -cs)) + (run ? 0.15 * v : 0);
  Tg.lfX = -(Tg.ltX + Tg.lkX) * 0.6; Tg.rfX = -(Tg.rtX + Tg.rkX) * 0.6;
  const Bs = v * (run ? 1.0 : 0.48);
  Tg.lsX = Bs * sn; Tg.rsX = -Bs * sn;
  Tg.lsZ = -this.armOut; Tg.rsZ = this.armOut;
  Tg.leX = -(0.14 + v * (run ? 1.35 : 0.3)); Tg.reX = Tg.leX;
  Tg.spX = v * (run ? 0.3 : 0.06); Tg.spY = 0.1 * v * sn; Tg.hipZ = st.sway * v * sn * 1.2; Tg.spZ = -Tg.hipZ * 0.6;
  Tg.hdY = -0.5 * Tg.spY; Tg.hdX = run ? -0.15 : 0;
  if (run) Tg.rootY = Math.max(0, Math.sin(ph * 2)) * 0.05;
  // idle life: breathing and looking around
  const idleW = 1 - sstep(0.05, 0.4, v);
  Tg.breath = 1 + 0.018 * Math.sin(t * 2.1) * idleW;
  Tg.hdY += idleW * 0.28 * Math.sin(t * 0.41) * Math.sin(t * 0.17 + 1);
  Tg.hdX += idleW * 0.04 * Math.sin(t * 0.3);
  Tg.spZ += idleW * 0.015 * Math.sin(t * 0.7);
  // ---- act layer
  const ao = this.armOut;
  let P: any = null, expr: any = null;
  switch (act) {
    case 'cut': { const k = (tau * 2.1) % 1, sk = k < 0.72 ? k / 0.72 : 1 - (k - 0.72) / 0.28;
      P = { spX: 0.08, spY: -0.12, rsX: -1.75 + 0.75 * sk, rsZ: ao + 0.2, reX: -0.55 - 0.35 * sk, rhX: 0.35, lsX: -0.85, lsZ: -ao - 0.05, leX: -1.05, hdX: 0.1 + 0.12 * sk, hdY: -0.1 }; break; }
    case 'pour': { const p = 0.5 + 0.5 * Math.sin(tau * 2.4);
      P = { spY: 0.08, rsX: -1.25, rsZ: ao + 0.4, reX: -1.15, rhZ: -0.2 - 0.55 * p, lsX: -0.9, lsZ: -ao + 0.05, leX: -1.25, hdX: 0.22, hdY: 0.12 }; break; }
    case 'wipe': { const a = tau * 5.2;
      P = { spX: 0.25, rsX: -1.0 + 0.18 * Math.sin(a), rsZ: ao + 0.1 + 0.28 * Math.cos(a), reX: -0.5, lsX: -0.75, lsZ: -ao, leX: -0.55, hdX: 0.25, lkX: 0.15, rkX: 0.15, ltX: -0.08, rtX: -0.08 }; break; }
    case 'sleep': { const b = Math.sin(t * 1.7), jerk = Math.max(0, Math.sin(t * 0.9) - 0.97) * 12;
      P = { spX: 0.12 + 0.025 * b, hdX: 0.52 + 0.05 * b - jerk * 0.25, hdZ: 0.2, hdY: 0.08, lsX: 0.06, rsX: 0.06, leX: -0.25, reX: -0.25, lkX: 0.08, rkX: 0.08, breath: 1 + 0.035 * b }; expr = 5; break; }
    case 'selfie': { const sw = Math.sin(tau * 1.3);
      P = { lsX: -1.9, lsZ: -0.5, leX: -0.3, lhX: -0.45, rsX: -0.95, rsZ: ao + 0.55, reX: -2.15, hdZ: 0.16 + 0.1 * sw, hdY: -0.3, hdX: -0.12, spZ: 0.06 * sw, spY: -0.12 }; expr = (Math.sin(tau * 2.2) > 0.3) ? 4 : 2; break; }
    case 'talk': { P = { rsX: -0.55 + 0.28 * Math.sin(tau * 3.1), rsZ: ao + 0.12, reX: -1.05 + 0.35 * Math.sin(tau * 3.1 + 1.2), rhZ: 0.3 * Math.sin(tau * 2), lsX: -0.3 + 0.2 * Math.sin(tau * 2.3 + 2), leX: -0.8 + 0.25 * Math.sin(tau * 2.7), hdX: 0.06 * Math.sin(tau * 4.2), hdY: 0.15 * Math.sin(tau * 0.9) };
      this.talkT -= dt; if (this.talkT <= 0) { this.talkT = 0.08 + vrand() * 0.12; this.talkOpen = !this.talkOpen; } expr = this.talkOpen ? 4 : null; break; }
    case 'pet': P = { ltX: -1.55, rtX: -1.3, lkX: 2.3, rkX: 1.95, lfX: -0.7, rfX: -0.6, spX: 0.42, hdX: 0.28, rsX: -0.95 + 0.16 * Math.sin(tau * 3.4), rsZ: ao + 0.02, reX: -0.2, rhX: 0.3, lsX: -0.55, lsZ: -ao, leX: -0.95 }; expr = 2; break;
    case 'wave': P = { rsZ: 2.45 + 0.3 * Math.sin(tau * 10), rsX: -0.3, reX: -0.35 - 0.25 * Math.sin(tau * 10 + 1), rhZ: 0.3 * Math.sin(tau * 10), hdZ: -0.08, hdY: 0.1 }; expr = 2; break;
    case 'count': { const fl = Math.max(0, Math.sin(tau * 9));
      P = { lsX: -0.85, lsZ: -ao + 0.2, leX: -1.15, rsX: -0.78, rsZ: ao - 0.18, reX: -1.3 + 0.12 * fl, rhX: -0.45 * fl, hdX: 0.35, spX: 0.05 }; this.talkT -= dt; if (this.talkT <= 0) { this.talkT = 0.28; this.talkOpen = !this.talkOpen; } expr = this.talkOpen ? 4 : 0; break; }
    case 'sit': P = { ltX: -1.32, rtX: -1.32, lkX: 1.32, rkX: 1.32, lfX: 0, rfX: 0, lsX: -0.5, rsX: -0.5, leX: -0.6, reX: -0.6, lsZ: -ao * 0.7, rsZ: ao * 0.7, spX: -0.02 }; break;
    case 'cheer': { const j = Math.max(0, Math.sin(tau * 7.5));
      P = { rootY: 0.17 * j, lsZ: -2.7 - 0.15 * Math.sin(tau * 7.5), rsZ: 2.7 + 0.15 * Math.sin(tau * 7.5), leX: -0.45, reX: -0.45, lsX: -0.2, rsX: -0.2, lkX: 0.45 * (1 - j), rkX: 0.45 * (1 - j), ltX: -0.22 * (1 - j), rtX: -0.22 * (1 - j), hdX: -0.15 }; expr = 2; break; }
    case 'dance': { // survey 2026-10-24: dans. Bounce, arms swing in turn, head tilts with the beat
      const b = Math.sin(tau * 3.2), s2 = Math.sin(tau * 3.2 + 1.3), up = Math.max(0, b);
      P = { rootY: 0.06 * up, spZ: 0.08 * s2, lsX: -2.1 + 0.35 * b, lsZ: -ao - 0.35 + 0.15 * s2, rsX: -2.1 - 0.35 * b, rsZ: ao + 0.35 - 0.15 * s2,
        leX: -0.9 + 0.3 * b, reX: -0.9 - 0.3 * b, hdZ: 0.14 * b, hdY: 0.18 * s2, lkX: 0.12 * up, rkX: 0.12 * (1 - up), ltX: -0.1, rtX: -0.1 }; expr = 2; break; }
    case 'chase': expr = 3; break;
  }
  if (!P && this.after > 0 && v < 0.2) {
    const k = sstep(0, 0.25, 1.4 - this.after) * sstep(0, 0.25, this.after);
    if (this.afterKind === 'apronwipe') P = { lsX: -0.42, lsZ: 0.32, rsX: -0.42, rsZ: -0.32, leX: -0.95 + 0.3 * Math.sin(t * 16), reX: -0.95 - 0.3 * Math.sin(t * 16), hdX: 0.15 };
    else P = { rsX: -0.18, rsZ: -0.12, reX: -0.95, rhX: 0.2, hdZ: 0.08 };
    for (const key in P) Tg[key] = lerp(Tg[key], P[key], k); P = null;
    if (this.afterKind === 'pocket') expr = 2;
  }
  if (P) {
    const full = FULL_ACTS[act], wUp = full ? 1 - sstep(0.12, 0.55, v) : 1, wLeg = full ? wUp : 0;
    for (const key in P) { const w = LEGJ[key] ? wLeg : wUp; Tg[key] = lerp(Tg[key], P[key], w); }
  }
  // ---- carry overrides arms
  const cw = this.carryW;
  if (cw > 0.001) {
    // 2026-10-25 user: tray pose. Two hands: upper arms down-forward, forearms level under the tray (elbows ~90 deg).
    // Mastery (oneHand): the right hand holds the round tray out at shoulder height, the left arm swings free.
    const one = !!s.oneHand;
    const cv: any = one
      ? { rsX: -0.55, rsZ: ao * 0.35 - 0.12, reX: -1.7, rhX: -0.25, rhZ: 0 }
      : { lsX: -0.5, rsX: -0.5, lsZ: -ao * 0.45 + 0.04, rsZ: ao * 0.45 - 0.04, leX: -1.15, reX: -1.15, lhX: -0.1, rhX: -0.1, lhZ: 0, rhZ: 0 };
    for (const key in cv) Tg[key] = lerp(Tg[key], cv[key], cw);
  }
  // ---- smooth joints toward targets
  const kk = 1 - Math.exp(-dt * 14);
  for (let i = 0; i < JOINTS.length; i++) { const key = JOINTS[i]; J[key] += (Tg[key] - J[key]) * kk; }
  // motor: additive layer from engine/anim (clips, emotes, idles, stop stumble) on top of the v2 pose
  const AJ = this.addJ;
  if (AJ) { for (let i = 0; i < JOINTS.length; i++) J[JOINTS[i]] += AJ[JOINTS[i]] || 0; this.apply(); for (let i = 0; i < JOINTS.length; i++) J[JOINTS[i]] -= AJ[JOINTS[i]] || 0; }
  else this.apply();
  // ---- props
  const want = ACT_PROP[act];
  for (const key in this.props) this.props[key].visible = false;
  if (want && this.carryW < 0.5) for (let i = 0; i < want.length; i += 2) this.prop(want[i], want[i + 1]).visible = true;
  // ---- face
  // motor moods: impatient = v2 angry, sad = pout, asleep = sleepy
  const mood = s.mood === 'impatient' ? 'angry' : (s.mood || 'ok');
  let e = expr != null ? expr : (mood === 'happy' ? 2 : mood === 'angry' ? 3 : 0);
  this.blinkT -= dt;
  if (this.blinkT <= 0) { this.blinkOn = 0.13; this.blinkT = 2 + vrand() * 3.5; }
  // v2 face index -> motor cell; an explicit expression (setExpr from the motor API) wins unless the act forces a face
  let cell = V2_CELL[e];
  if (expr == null) { if (this.exprOverride != null) cell = this.exprOverride; else if (s.mood === 'sad') cell = 6; else if (s.mood === 'asleep') cell = 5; }
  if (this.blinkOn > 0) { this.blinkOn -= dt; if (BLINKABLE[cell]) cell = 12; }
  this.setExpr(cell);
  this.updateBrows(dt, expr == null && this.browOverride ? this.browOverride : X_DEF_BROW[X_CELLS[cell]] || 'flat');
};
const _e = new T.Euler();
Hero.prototype.apply = function (this: any) {
  const B = this.B, J = this.J, d = this.dims;
  // feet stay on the ground: hip height from leg kinematics (the straighter leg carries the body)
  const ext = (th?: any, kn?: any) => d.L1 * Math.cos(th) + d.L2 * Math.cos(th + kn);
  const legH = Math.max(ext(J.ltX, J.lkX), ext(J.rtX, J.rkX));
  const drop = (d.L1 + d.L2) - legH;
  B.hips.position.y = d.hipY - drop + J.rootY;
  B.hips.rotation.z = J.hipZ;
  B.spine.rotation.set(J.spX, J.spY, J.spZ);
  B.chest.scale.set(1 + (J.breath - 1) * 0.6, J.breath, 1 + (J.breath - 1));
  B.head.rotation.set(J.hdX, J.hdY, J.hdZ);
  B.shL.rotation.set(J.lsX, J.lsY, J.lsZ); B.elL.rotation.x = J.leX; B.haL.rotation.set(J.lhX, 0, J.lhZ);
  B.shR.rotation.set(J.rsX, J.rsY, J.rsZ); B.elR.rotation.x = J.reX; B.haR.rotation.set(J.rhX, 0, J.rhZ);
  B.thL.rotation.set(J.ltX, 0, J.ltZ - J.hipZ); B.knL.rotation.x = J.lkX; B.ftL.rotation.x = J.lfX;
  B.thR.rotation.set(J.rtX, 0, J.rtZ - J.hipZ); B.knR.rotation.x = J.rkX; B.ftR.rotation.x = J.rfX;
};
Hero.prototype.dispose = function (this: any) {
  if (this.group.parent) this.group.parent.remove(this.group);
  if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.skeleton.dispose(); }
  if (this.tex) this.tex.dispose();
};
CH.makeHero = function (opts?: any) {
  try { return new (Hero as any)(opts || {}); }
  catch (e) { console.error('[chars] makeHero failed', e); return fallbackHero(); }
};
CH.PRESETS = PRESETS; CH.ROLE_LOOK = ROLE_LOOK;
function fallbackHero() {
  const group = new T.Group(); const body = C.mesh(cap(0.25, 1.0, 4, 10), '#e0533c'); body.position.y = 0.75; group.add(body);
  const hand = new T.Object3D(); hand.position.set(0, 1.0, 0.4); group.add(hand);
  const head = new T.Object3D(); head.position.y = 1.75; group.add(head);
  return { group, hand, head, update() {}, setLook() {}, dispose() { if (group.parent) group.parent.remove(group); } };
}

/* =====================================================================
   CROWD: GPU-animated instanced layers
   ===================================================================== */
// part ids
const PT: any = { ROOT: 0, HIPS: 1, TORSO: 2, HEAD: 3, ARM_L: 4, FORE_L: 5, ARM_R: 6, FORE_R: 7, THIGH_L: 8, SHIN_L: 9, THIGH_R: 10, SHIN_R: 11, SKIRT: 12, WHEEL: 14 };
// tones
const TN: any = { SKIN: 0, TOP: 1, BOT: 2, SHOE: 3, ACC: 4, ACC2: 5, HAIR: 6, COVER: 7, TRIM: 8, FACE: 9, FORE: 10, SHIN: 11, DARK: 12, WHITE: 13, FIXED: 14, UPPER: 15, TORSO: 16 };
// body option bits
const FB: any = { skirt: 0, vest: 1, jacket: 2, tie: 3, mustache: 4, beard: 5, glasses: 6, apron: 7, lanyard: 8, shorts: 9, shortSleeve: 10, hood: 11, teamScarf: 12, sun: 13, pat0: 14, pat1: 15, elder: 16, child: 17, earrings: 18 };
// union variant ids
const HW: any = { short: 1, buzz: 2, curly: 3, afro: 4, long: 5, bob: 6, bun: 7, ponytail: 8, wavy: 9, kasket: 10, cap: 11, beanie: 12, helmet: 13, sunhat: 14, bucket: 15, chef: 16, paper: 17, bandana: 18, captain: 19, turban: 20, loose: 21, yazma: 22, sport: 23 };
const SP: any = { phone: 1, newspaper: 2, cane: 3, whitecane: 4, headphones: 5, camera: 6, selfiestick: 7, briefcase: 8, keys: 9, handbag: 10, map: 11, flag: 12, rod: 13, bucket: 14, simit: 15, tea: 16, bag: 17, bouquet: 18, ringlight: 19, ticket: 20 };
const BK: any = { school: 1, bigpack: 2, courier: 3, hamal: 4, pack: 5 };
const MB: any = { wheelchair: 1, stroller: 2, trolley: 3 };
const VD: any = { tray: 1, shine: 2, mussel: 3, chestnut: 4, baglama: 5, clarinet: 6, hat: 7, darbuka: 8 };
CH.VARIANTS = { HW, SP, BK, MB, VD };

const CB: any = { hipY: 0.78, kneeY: 0.43, ankY: 0.08, shX: 0.235, shY: 1.245, elbY: 0.99, handY: 0.745, neckY: 1.36, headY: 1.54, R: 0.2, hipX: 0.095 };
const ptA = (part?: any, tone?: any, vid?: any) => [part, tone, vid || 0];
// selectable layers store a bitmask of the variant ids a vertex belongs to (shared pieces are merged once)
const vbit = (v?: any) => v ? Math.pow(2, v - 1) : 0;
const ptM = (part?: any, tone?: any, vid?: any) => [part, tone, vbit(vid)];

function buildCitizenBody() {
  const b = new (GB as any)({ pt: 3 }), c = CB;
  const add = (g?: any, m?: any, part?: any, tone?: any, vid?: any, extra?: any) => b.add(g, Object.assign({ m, pt: typeof part === 'function' ? part : ptA(part, tone, vid), uv: [0.5, 0.06] }, extra || {}));
  // legs
  [[-1, PT.THIGH_L, PT.SHIN_L], [1, PT.THIGH_R, PT.SHIN_R]].forEach(([s, th, sh]: any) => {
    add(cap(0.084, 0.21, 1, 7), mT(s * c.hipX, 0.6, 0), th, TN.BOT);
    add(cap(0.07, 0.24, 1, 7), mT(s * c.hipX, 0.265, 0), sh, TN.SHIN);
    add(rbox(0.14, 0.1, 0.25, 0.045, 1), mT(s * c.hipX, 0.05, 0.035), sh, TN.SHOE);
  });
  // torso lathe: pelvis rows are part HIPS, the rest TORSO
  const tp = [[0.001, 0.67], [0.13, 0.675], [0.198, 0.73], [0.212, 0.84], [0.218, 0.98], [0.21, 1.1], [0.212, 1.2], [0.175, 1.29], [0.09, 1.345], [0.001, 1.35]];
  const tor8 = (v?: any) => { v.z *= 0.8; };
  b.add(lathe(tp, 10), { deform: tor8, uv: [0.5, 0.06], pt: (v?: any) => [v.y < 0.8 ? PT.HIPS : PT.TORSO, v.y < 0.775 ? TN.BOT : v.y < 0.81 ? TN.FIXED : TN.TORSO, 0], color: '#4a3528' });
  // arms
  [[-1, PT.ARM_L, PT.FORE_L], [1, PT.ARM_R, PT.FORE_R]].forEach(([s, up, fo]: any) => {
    add(sph(0.08, 7, 5), mT(s * c.shX, c.shY, 0), up, TN.UPPER);
    b.add(cap(0.062, 0.17, 1, 7), { m: mT(s * c.shX, 1.12, 0), uv: [0.5, 0.06], pt: (v?: any) => [up, v.y > 1.07 ? TN.UPPER : TN.FORE, 0] });
    add(cap(0.056, 0.15, 1, 7), mT(s * c.shX, 0.88, 0), fo, TN.FORE);
    add(sph(0.062, 7, 5), mTRS(s * c.shX, c.handY, 0.005, 0, 0, 0, 0.95, 1.1, 0.85), fo, TN.SKIN);
  });
  // neck, head, face patch, ears, nose
  add(cyl(0.068, 0.078, 0.1, 8, true), mT(0, 1.35, -0.005), PT.HEAD, TN.SKIN);
  const HM = mT(0, c.headY, 0);
  add(sph(c.R, 16, 11), HM, PT.HEAD, TN.SKIN);
  b.add(facePatch(+(c.R * 1.006).toFixed(4), 8, 6), { m: HM, pt: ptA(PT.HEAD, TN.FACE, 0) });
  [-1, 1].forEach((s?: any) => add(sph(0.042, 6, 4), mTRS(s * c.R * 0.97, c.headY - 0.01, -0.01, 0, 0, 0, 0.55, 1, 0.85), PT.HEAD, TN.SKIN));
  add(sph(0.036, 6, 5), mTRS(0, c.headY - 0.03, c.R * 0.985, 0, 0, 0, 1.05, 0.9, 0.95), PT.HEAD, TN.SKIN);
  // ---- options (vertex variant = bit + 1)
  const opt = (bit?: any) => bit + 1;
  b.add(lathe([[0.3, 0.12], [0.28, 0.42], [0.24, 0.66], [0.218, 0.84]], 10), { deform: (v?: any) => { v.z *= 0.85; }, uv: [0.5, 0.06], pt: ptA(PT.SKIRT, TN.BOT, opt(FB.skirt)) });
  const shellPts = (y0?: any, y1?: any, dr?: any) => tp.filter((p?: any) => p[1] >= y0 && p[1] <= y1).map((p?: any) => [p[0] + dr, p[1]]);
  b.add(lathe(shellPts(0.72, 1.3, 0.014), 10, 0.36, TAU - 0.72), { deform: tor8, uv: [0.5, 0.06], pt: (v?: any) => [v.y < 0.8 ? PT.HIPS : PT.TORSO, TN.ACC, opt(FB.vest)] });
  b.add(lathe([[0.205, 0.64]].concat(shellPts(0.7, 1.3, 0.016)), 10, 0.3, TAU - 0.6), { deform: tor8, uv: [0.5, 0.06], pt: (v?: any) => [v.y < 0.8 ? PT.HIPS : PT.TORSO, TN.ACC, opt(FB.jacket)] });
  add(box(0.045, 0.28, 0.02), mTRS(0, 1.12, 0.183, -0.12, 0, 0), PT.TORSO, TN.ACC2, opt(FB.tie));
  [-1, 1].forEach((s?: any) => add(cap(0.022, 0.05, 1, 5), mTRS(s * 0.033, c.headY - 0.065, c.R * 0.94, 0, s * 0.35, s * 1.2), PT.HEAD, TN.HAIR, opt(FB.mustache)));
  add(sph(+(c.R * 1.03).toFixed(4), 9, 4, PI / 2 - 1.15, 2.3, PI * 0.56, PI * 0.36), HM, PT.HEAD, TN.HAIR, opt(FB.beard));
  [-1, 1].forEach((s?: any) => {
    add(tor(0.04, 0.008, 3, 10), mT(s * 0.07, c.headY + 0.005, c.R * 0.99), PT.HEAD, TN.DARK, opt(FB.glasses));
    add(cyl(0.038, 0.038, 0.004, 10), mTRS(s * 0.07, c.headY + 0.005, c.R * 0.985, PI / 2, 0, 0), PT.HEAD, TN.DARK, opt(FB.sun));
    add(box(0.008, 0.008, 0.17), mT(s * c.R * 0.94, c.headY + 0.015, 0.09), PT.HEAD, TN.DARK, opt(FB.glasses));
  });
  add(box(0.05, 0.008, 0.008), mT(0, c.headY + 0.012, c.R * 1.0), PT.HEAD, TN.DARK, opt(FB.glasses));
  b.add(lathe(shellPts(0.74, 1.2, 0.012), 8, -0.85, 1.7), { deform: tor8, uv: [0.5, 0.06], pt: (v?: any) => [v.y < 0.8 ? PT.HIPS : PT.TORSO, TN.ACC2, opt(FB.apron)] });
  add(tor(0.1, 0.008, 3, 10), mTRS(0, 1.3, 0.03, -1.2, 0, 0), PT.TORSO, TN.FIXED, opt(FB.lanyard), { color: '#3f6fd8' });
  add(box(0.06, 0.08, 0.01), mT(0, 1.12, 0.185), PT.TORSO, TN.WHITE, opt(FB.lanyard));
  add(sph(0.13, 7, 5), mTRS(0, 1.33, -0.14, 0, 0, 0, 1.3, 0.8, 0.9), PT.TORSO, TN.TOP, opt(FB.hood));
  add(tor(0.105, 0.04, 5, 10), mTRS(0, 1.33, 0, PI / 2, 0, 0), PT.TORSO, TN.ACC, opt(FB.teamScarf));
  add(box(0.07, 0.3, 0.025), mTRS(0.06, 1.15, 0.19, -0.15, 0, 0.08), PT.TORSO, TN.ACC2, opt(FB.teamScarf));
  add(box(0.07, 0.24, 0.025), mTRS(-0.05, 1.18, 0.19, -0.15, 0, -0.06), PT.TORSO, TN.ACC, opt(FB.teamScarf));
  [-1, 1].forEach((s?: any) => add(tor(0.016, 0.0045, 3, 8), mTRS(s * c.R * 0.98, c.headY - 0.065, 0, 0, PI / 2, 0), PT.HEAD, TN.FIXED, opt(FB.earrings), { color: '#f2b632' }));
  return { geo: b.build(), tris: b.tris() };
}

/* headwear unions (part HEAD), split in three layers so a citizen only pays for its own group: hair | hat | scarf */
function buildHeadwear(which?: any) {
  const b = new (GB as any)({ pt: 3 }), c = CB, q = 0.99;
  const HM = mT(0, c.headY, 0);
  const tone: any = { hair: TN.HAIR, cover: TN.COVER, trim: TN.TRIM, dark: TN.DARK, gold: TN.FIXED };
  const U = new Map();
  // identical pieces (same geometry, transform and colour key) are stored once with a variant mask
  const put = (pieces?: any, vid?: any) => pieces.forEach((p?: any) => {
    const key = p.g.uuid + '|' + p.k + '|' + p.m.elements.map((e?: any) => e.toFixed(4)).join(',');
    const u = U.get(key); if (u) { u.mask += u.ids.has(vid) ? 0 : vbit(vid); u.ids.add(vid); return; }
    U.set(key, { p, mask: vbit(vid), ids: new Set([vid]) });
  });
  if (which === 'hair') ['short', 'buzz', 'curly', 'afro', 'long', 'bob', 'bun', 'ponytail', 'wavy'].forEach((h?: any) => put(hairPieces(h, c.R, q), HW[h]));
  if (which === 'hat') ['kasket', 'cap', 'beanie', 'helmet', 'sunhat', 'bucket', 'bandana', 'captain'].forEach((h?: any) => put(hatPieces(h, c.R, q).filter((p?: any) => p.k !== 'hair'), HW[h]));
  if (which === 'scarf') ['turban', 'loose', 'yazma', 'sport'].forEach((h?: any) => put(scarfPieces(h, c.R, q), HW[h]));
  U.forEach(({ p, mask }: any) => {
    const k = p.k, t = tone[k] != null ? tone[k] : TN.FIXED;
    b.add(p.g, { m: new T.Matrix4().multiplyMatrices(HM, p.m), pt: [PT.HEAD, t, mask], color: k === 'gold' ? '#f2b632' : (k.charAt(0) === '#' ? k : '#ffffff') });
  });
  return { geo: b.build(), tris: b.tris() };
}

/* small props union: parts follow hands/torso/head */
function buildSmallProps() {
  const b = new (GB as any)({ pt: 3 }), c = CB;
  const rbox = (w?: any, h?: any, d?: any, ..._r: any[]) => box(w, h, d); // props are tiny on screen: plain boxes
  const hx = c.shX, hy = c.handY;
  const A = (g?: any, m?: any, part?: any, vid?: any, color?: any, tone?: any) => b.add(g, { m, pt: ptM(part, tone == null ? TN.FIXED : tone, vid), color: color || '#ffffff' });
  const R7 = PT.FORE_R, L5 = PT.FORE_L;
  A(rbox(0.06, 0.12, 0.014, 0.008, 1), mTRS(hx, hy - 0.02, 0.05, -0.2, 0, 0), R7, SP.phone, '#2a2a33');
  A(rbox(0.05, 0.1, 0.006, 0.004, 1), mTRS(hx, hy - 0.02, 0.058, -0.2, 0, 0), R7, SP.phone, '#9fd3f5');
  A(rbox(0.04, 0.26, 0.2, 0.01, 1), mTRS(-0.25, 1.06, 0.02, 0, 0, 0.12), PT.TORSO, SP.newspaper, '#ece6d6');
  A(rbox(0.042, 0.06, 0.2, 0.004, 1), mTRS(-0.255, 1.13, 0.02, 0, 0, 0.12), PT.TORSO, SP.newspaper, '#c94f4f');
  A(cyl(0.014, 0.014, 0.74, 5), mT(hx, hy - 0.37, 0.03), R7, SP.cane, '#6b4428');
  A(tor(0.045, 0.014, 4, 8, PI), mTRS(hx - 0.045, hy + 0.0, 0.03, 0, 0, 0), R7, SP.cane, '#6b4428');
  A(cyl(0.01, 0.01, 1.15, 5), mTRS(hx, hy - 0.5, 0.33, 0.6, 0, 0), R7, SP.whitecane, '#f6f4ef');
  A(cyl(0.0115, 0.0115, 0.16, 5), mTRS(hx, hy - 0.93, 0.62, 0.6, 0, 0), R7, SP.whitecane, '#d8433a');
  A(tor(0.205, 0.018, 4, 12, PI), mTRS(0, c.headY + 0.02, 0, 0, 0, 0), PT.HEAD, SP.headphones, '#2b2b33');
  [-1, 1].forEach((s?: any) => A(cyl(0.06, 0.06, 0.05, 8), mTRS(s * 0.205, c.headY, 0, 0, 0, PI / 2), PT.HEAD, SP.headphones, '#e0533c'));
  A(rbox(0.13, 0.08, 0.06, 0.015, 1), mT(0, 1.08, 0.22), PT.TORSO, SP.camera, '#2b2b33');
  A(cyl(0.028, 0.028, 0.05, 8), mTRS(0, 1.08, 0.265, PI / 2, 0, 0), PT.TORSO, SP.camera, '#5a5a66');
  A(tor(0.13, 0.006, 3, 10), mTRS(0, 1.22, 0.05, -1.1, 0, 0), PT.TORSO, SP.camera, '#2b2b33');
  A(cyl(0.012, 0.012, 0.8, 5), mTRS(hx, hy - 0.4, 0.06, 0, 0, 0), R7, SP.selfiestick, '#3c3a44');
  A(rbox(0.07, 0.13, 0.012, 0.008, 1), mTRS(hx, hy - 0.84, 0.06, 0, 0, 0), R7, SP.selfiestick, '#2a2a33');
  A(tor(0.06, 0.012, 4, 12), mTRS(hx, hy - 0.84, 0.075, 0, 0, 0), R7, SP.ringlight, '#fff6c8');
  A(rbox(0.36, 0.26, 0.09, 0.02, 1), mT(-hx - 0.02, hy - 0.2, 0.02), L5, SP.briefcase, '#5a3a22');
  A(tor(0.05, 0.012, 4, 8, PI), mT(-hx - 0.02, hy - 0.06, 0.02), L5, SP.briefcase, '#3b2716');
  A(rbox(0.04, 0.05, 0.01, 0.005, 1), mT(hx, hy - 0.07, 0.04), R7, SP.keys, '#f2b632');
  A(tor(0.02, 0.005, 3, 8), mT(hx, hy - 0.03, 0.04), R7, SP.keys, '#c9c6c0');
  A(rbox(0.24, 0.2, 0.08, 0.03, 1), mT(-0.24, 0.84, 0.05), PT.HIPS, SP.handbag, '#a8544a', TN.ACC2);
  A(tor(0.2, 0.01, 3, 10), mTRS(-0.12, 1.05, 0.05, 0, 0, 0.55), PT.TORSO, SP.handbag, '#a8544a', TN.ACC2);
  A(rbox(0.2, 0.012, 0.15, 0.004, 1), mTRS(-hx, hy + 0.0, 0.1, 0.5, 0, 0), L5, SP.map, '#f3e3b6');
  A(rbox(0.06, 0.013, 0.15, 0.004, 1), mTRS(-hx + 0.05, hy + 0.0, 0.1, 0.5, 0, 0), L5, SP.map, '#8daa5b');
  A(cyl(0.01, 0.01, 0.9, 5), mT(hx, hy - 0.1, 0.03), R7, SP.flag, '#5a3a22');
  A(rbox(0.28, 0.18, 0.012, 0.006, 1), mT(hx + 0.15, hy - 0.45, 0.03), R7, SP.flag, '#f2b632');
  A(cyl(0.007, 0.012, 1.7, 4), mTRS(hx, hy - 0.05, 0.4, 1.0, 0, 0), R7, SP.rod, '#3c3a44');
  A(cyl(0.11, 0.09, 0.2, 8), mT(-hx, hy - 0.16, 0.02), L5, SP.bucket, '#5aa9d6');
  A(tor(0.07, 0.006, 3, 8, PI), mT(-hx, hy - 0.04, 0.02), L5, SP.bucket, '#9a9a9a');
  A(tor(0.06, 0.024, 5, 10), mTRS(hx, hy - 0.06, 0.08, PI / 2, 0, 0), R7, SP.simit, '#c8833c');
  A(lathe([[0.001, 0], [0.024, 0.004], [0.02, 0.03], [0.017, 0.05], [0.024, 0.08], [0.028, 0.095]], 6), mT(hx, hy - 0.02, 0.06), R7, SP.tea, '#b5471f');
  A(rbox(0.22, 0.28, 0.06, 0.02, 1), mT(-hx - 0.02, hy - 0.2, 0.02), L5, SP.bag, '#e8e2d4', TN.ACC2);
  A(cone(0.08, 0.26, 6), mTRS(hx - 0.03, hy - 0.02, 0.1, PI, 0, 0), R7, SP.bouquet, '#8daa5b');
  [[0, 0.06], [0.04, 0.04], [-0.04, 0.05]].forEach((p?: any) => A(sph(0.04, 6, 4), mT(hx - 0.03 + p[0], hy - 0.15 - p[1], 0.1), R7, SP.bouquet, '#f2a2b3'));
  A(rbox(0.07, 0.05, 0.008, 0.003, 1), mT(hx, hy - 0.05, 0.05), R7, SP.ticket, '#ffd23f');
  return { geo: b.build(), tris: b.tris() };
}

/* back gear union: attached to the torso */
function buildBackGear() {
  const b = new (GB as any)({ pt: 3 });
  const A = (g?: any, m?: any, vid?: any, color?: any, tone?: any, part?: any) => b.add(g, { m, pt: ptM(part == null ? PT.TORSO : part, tone == null ? TN.FIXED : tone, vid), color: color || '#ffffff' });
  A(rbox(0.3, 0.34, 0.15, 0.05, 1), mT(0, 1.08, -0.24), BK.school, '#fff', TN.ACC2);
  A(rbox(0.22, 0.12, 0.04, 0.02, 1), mT(0, 0.98, -0.32), BK.school, '#f0d35a');
  [-1, 1].forEach((s?: any) => A(rbox(0.04, 0.32, 0.03, 0.01, 1), mTRS(s * 0.11, 1.12, 0.12, 0.1, 0, 0), BK.school, '#3c3a44'));
  A(rbox(0.38, 0.62, 0.24, 0.07, 1), mT(0, 1.18, -0.3), BK.bigpack, '#d46a4a');
  A(cyl(0.08, 0.08, 0.42, 8), mTRS(0, 1.53, -0.28, 0, 0, PI / 2), BK.bigpack, '#5aa9d6');
  A(rbox(0.3, 0.16, 0.06, 0.03, 1), mT(0, 1.02, -0.43), BK.bigpack, '#b05a3a');
  [-1, 1].forEach((s?: any) => A(rbox(0.045, 0.36, 0.03, 0.01, 1), mTRS(s * 0.12, 1.12, 0.12, 0.1, 0, 0), BK.bigpack, '#3c3a44'));
  A(rbox(0.4, 0.4, 0.32, 0.04, 1), mT(0, 1.12, -0.33), BK.courier, '#3fb5b0');
  A(rbox(0.26, 0.1, 0.01, 0.01, 1), mT(0, 1.16, -0.495), BK.courier, '#fff6e6');
  A(rbox(0.08, 0.05, 0.012, 0.005, 1), mT(0, 1.16, -0.502), BK.courier, '#e0533c');
  A(rbox(0.44, 0.5, 0.12, 0.06, 1), mTRS(0, 1.08, -0.24, 0.05, 0, 0), BK.hamal, '#8a5a33');
  A(rbox(0.62, 0.5, 0.48, 0.03, 1), mTRS(0, 1.4, -0.48, 0.12, 0, 0), BK.hamal, '#c9a26a');
  A(rbox(0.5, 0.36, 0.4, 0.03, 1), mTRS(0.03, 1.82, -0.52, 0.12, 0.15, 0), BK.hamal, '#d8b47a');
  A(rbox(0.63, 0.06, 0.49, 0.01, 1), mTRS(0, 1.4, -0.48, 0.12, 0, 0), BK.hamal, '#a8774f');
  [-1, 1].forEach((s?: any) => A(rbox(0.04, 0.34, 0.03, 0.01, 1), mTRS(s * 0.11, 1.12, 0.12, 0.1, 0, 0), BK.hamal, '#5a3a22'));
  A(rbox(0.28, 0.32, 0.13, 0.05, 1), mT(0, 1.08, -0.23), BK.pack, '#fff', TN.ACC);
  [-1, 1].forEach((s?: any) => A(rbox(0.04, 0.3, 0.03, 0.01, 1), mTRS(s * 0.11, 1.12, 0.12, 0.1, 0, 0), BK.pack, '#3c3a44'));
  return { geo: b.build(), tris: b.tris() };
}

/* mobility union: wheelchair, stroller, shopping trolley (root attached; wheelchair wheels spin) */
function buildMobility() {
  const b = new (GB as any)({ pt: 3 });
  const A = (g?: any, m?: any, vid?: any, color?: any, part?: any, tone?: any) => b.add(g, { m, pt: ptM(part == null ? PT.ROOT : part, tone == null ? TN.FIXED : tone, vid), color: color || '#ffffff' });
  // wheelchair: seat at 0.5, big wheels at the sides
  const W = MB.wheelchair;
  A(rbox(0.44, 0.06, 0.42, 0.02, 1), mT(0, 0.47, -0.02), W, '#3f6fa8');
  A(rbox(0.44, 0.42, 0.05, 0.02, 1), mTRS(0, 0.72, -0.24, -0.1, 0, 0), W, '#3f6fa8');
  [-1, 1].forEach((s?: any) => {
    A(tor(0.27, 0.025, 5, 16), mTRS(s * 0.27, 0.3, -0.05, 0, PI / 2, 0), W, '#2b2b33', PT.WHEEL);
    A(tor(0.23, 0.01, 3, 14), mTRS(s * 0.3, 0.3, -0.05, 0, PI / 2, 0), W, '#b8bec6', PT.WHEEL);
    A(box(0.012, 0.44, 0.02), mTRS(s * 0.27, 0.3, -0.05, 0.5, 0, 0), W, '#b8bec6', PT.WHEEL);
    A(box(0.012, 0.44, 0.02), mTRS(s * 0.27, 0.3, -0.05, -1.07, 0, 0), W, '#b8bec6', PT.WHEEL);
    A(cyl(0.012, 0.012, 0.5, 5), mTRS(s * 0.22, 0.5, -0.02, 0, 0, 0), W, '#9aa2ab');
    A(cyl(0.012, 0.012, 0.3, 5), mTRS(s * 0.2, 0.92, -0.27, 0.1, 0, 0), W, '#9aa2ab');
    A(cyl(0.05, 0.05, 0.03, 8), mTRS(s * 0.18, 0.05, 0.26, 0, 0, PI / 2), W, '#2b2b33');
    A(rbox(0.06, 0.02, 0.12, 0.01, 1), mT(s * 0.1, 0.12, 0.3), W, '#3c3a44');
  });
  // stroller in front of the person, handle at hand height
  const S = MB.stroller;
  A(sph(0.27, 10, 7, 0, TAU, PI / 2, PI / 2), mTRS(0, 0.62, 0.72, 0, 0, 0, 0.8, 0.7, 1.05), S, '#fff', PT.ROOT, TN.ACC2);
  A(sph(0.27, 10, 5, 0, PI, 0, PI / 2), mTRS(0, 0.6, 0.6, 0.35, -PI / 2, 0, 0.82, 0.85, 0.82), S, '#fff', PT.ROOT, TN.ACC);
  A(sph(0.07, 7, 5), mT(0, 0.67, 0.82), S, '#f6d2b5');
  A(rbox(0.32, 0.03, 0.3, 0.01, 1), mT(0, 0.66, 0.78), S, '#fff6e6');
  [-1, 1].forEach((s?: any) => {
    A(cyl(0.012, 0.012, 0.8, 5), mTRS(s * 0.17, 0.62, 0.55, -0.85, 0, 0), S, '#3c3a44');
    A(cyl(0.07, 0.07, 0.03, 8), mTRS(s * 0.2, 0.07, 0.95, 0, 0, PI / 2), S, '#2b2b33');
    A(cyl(0.07, 0.07, 0.03, 8), mTRS(s * 0.2, 0.07, 0.55, 0, 0, PI / 2), S, '#2b2b33');
  });
  A(cyl(0.02, 0.02, 0.4, 6), mTRS(0, 0.93, 0.36, 0, 0, PI / 2), S, '#2b2b33');
  // pazar arabası: tartan bag on two wheels, pulled behind on the left
  const P = MB.trolley;
  A(rbox(0.3, 0.46, 0.24, 0.05, 1), mTRS(-0.3, 0.42, -0.42, 0.25, 0, 0), P, '#c0392b');
  A(rbox(0.31, 0.06, 0.25, 0.02, 1), mTRS(-0.3, 0.48, -0.44, 0.25, 0, 0), P, '#2e4a6b');
  A(rbox(0.06, 0.47, 0.25, 0.02, 1), mTRS(-0.3, 0.42, -0.42, 0.25, 0, 0), P, '#f0d35a');
  A(cyl(0.012, 0.012, 0.6, 5), mTRS(-0.3, 0.62, -0.32, 0.45, 0, 0), P, '#9aa2ab');
  A(cyl(0.016, 0.016, 0.16, 5), mTRS(-0.3, 0.88, -0.2, 0, 0, PI / 2), P, '#2b2b33');
  [-1, 1].forEach((s?: any) => A(cyl(0.08, 0.08, 0.04, 8), mTRS(-0.3 + s * 0.13, 0.08, -0.55, 0, 0, PI / 2), P, '#2b2b33'));
  return { geo: b.build(), tris: b.tris() };
}

/* vendor and musician gear union */
function buildVendor() {
  const b = new (GB as any)({ pt: 3 }), c = CB;
  const A = (g?: any, m?: any, vid?: any, color?: any, part?: any, tone?: any) => b.add(g, { m, pt: ptM(part == null ? PT.ROOT : part, tone == null ? TN.FIXED : tone, vid), color: color || '#ffffff' });
  // simit tray on the head
  const top = c.headY + c.R + 0.02;
  A(cyl(0.36, 0.34, 0.04, 14), mT(0, top + 0.03, 0), VD.tray, '#a8774f', PT.HEAD);
  A(tor(0.36, 0.02, 4, 16), mTRS(0, top + 0.05, 0, PI / 2, 0, 0), VD.tray, '#7d5638', PT.HEAD);
  A(tor(0.06, 0.03, 4, 8), mTRS(0, top - 0.005, 0, PI / 2, 0, 0), VD.tray, '#e8e2d4', PT.HEAD);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU, r = i === 6 ? 0 : 0.22, x = i === 6 ? 0 : Math.cos(a) * r, z = i === 6 ? 0 : Math.sin(a) * r;
    A(tor(0.075, 0.028, 4, 9), mTRS(x, top + 0.08 + (i === 6 ? 0.04 : 0), z, PI / 2, 0, 0), VD.tray, '#c8833c', PT.HEAD);
  }
  // shoeshine box carried by its handle
  A(rbox(0.32, 0.22, 0.18, 0.02, 1), mT(c.shX, c.handY - 0.2, 0.04), VD.shine, '#c9a64a', PT.FORE_R);
  A(rbox(0.33, 0.04, 0.19, 0.01, 1), mT(c.shX, c.handY - 0.08, 0.04), VD.shine, '#7d5638', PT.FORE_R);
  A(tor(0.06, 0.012, 4, 8, PI), mT(c.shX, c.handY - 0.04, 0.04), VD.shine, '#7d5638', PT.FORE_R);
  // mussel tray held in front
  A(cyl(0.3, 0.27, 0.04, 12), mT(0, 1.02, 0.42), VD.mussel, '#e8e2d4', PT.TORSO);
  for (let i = 0; i < 9; i++) { const a = i * 2.4, r = 0.08 + (i % 3) * 0.06; A(sph(0.045, 5, 3), mTRS(Math.cos(a) * r, 1.05, 0.42 + Math.sin(a) * r, 0, a, 0, 1.2, 0.5, 0.7), VD.mussel, '#2e2a3a', PT.TORSO); }
  [[0.18, 0.1], [-0.15, -0.12], [0.02, 0.2]].forEach((p?: any) => A(sph(0.04, 6, 4), mT(p[0], 1.07, 0.42 + p[1]), VD.mussel, '#f0d35a', PT.TORSO));
  // chestnut cart pushed in front
  A(rbox(0.7, 0.36, 0.5, 0.04, 1), mT(0, 0.68, 0.72), VD.chestnut, '#d8433a');
  A(cyl(0.2, 0.22, 0.12, 12), mT(0, 0.92, 0.72), VD.chestnut, '#3c3a44');
  for (let i = 0; i < 8; i++) A(sph(0.035, 5, 4), mT(Math.cos(i) * 0.12, 0.99, 0.72 + Math.sin(i) * 0.12), VD.chestnut, '#7a4a2a');
  A(cyl(0.035, 0.035, 0.35, 6), mT(0.22, 1.1, 0.88), VD.chestnut, '#3c3a44');
  A(sph(0.09, 6, 5), mT(0.22, 1.36, 0.88), VD.chestnut, '#d6d2cc');
  A(sph(0.07, 6, 5), mT(0.18, 1.5, 0.86), VD.chestnut, '#e6e2dc');
  [-1, 1].forEach((s?: any) => A(cyl(0.16, 0.16, 0.04, 10), mTRS(s * 0.37, 0.18, 0.72, 0, 0, PI / 2), VD.chestnut, '#2b2b33'));
  A(cyl(0.02, 0.02, 0.5, 6), mTRS(0, 0.93, 0.36, 0, 0, PI / 2), VD.chestnut, '#7d5638');
  [-1, 1].forEach((s?: any) => A(cyl(0.015, 0.015, 0.3, 5), mTRS(s * 0.22, 0.85, 0.42, 0.9, 0, 0), VD.chestnut, '#7d5638'));
  // bağlama held across the body (torso attached)
  A(sph(0.13, 9, 7), mTRS(0.1, 0.98, 0.24, 0, 0, 0.5, 1.0, 1.25, 0.6), VD.baglama, '#a8642f', PT.TORSO);
  A(rbox(0.04, 0.62, 0.025, 0.01, 1), mTRS(-0.12, 1.22, 0.26, 0, 0, 0.95), VD.baglama, '#7d4a24', PT.TORSO);
  A(rbox(0.06, 0.1, 0.03, 0.01, 1), mTRS(-0.39, 1.4, 0.26, 0, 0, 0.95), VD.baglama, '#5a3416', PT.TORSO);
  // clarinet from mouth down
  A(cyl(0.016, 0.03, 0.55, 8), mTRS(0, c.headY - 0.3, 0.32, 0.55, 0, 0), VD.clarinet, '#2b2b33', PT.HEAD);
  A(cyl(0.04, 0.03, 0.06, 8), mTRS(0, c.headY - 0.53, 0.45, 0.55, 0, 0), VD.clarinet, '#c9a64a', PT.HEAD);
  // musician hat on the ground with coins
  A(cyl(0.12, 0.13, 0.08, 10), mT(0.0, 0.04, 0.55), VD.hat, '#4a3528');
  A(cyl(0.2, 0.2, 0.012, 12), mT(0.0, 0.01, 0.55), VD.hat, '#4a3528');
  [[0.03, 0.02], [-0.04, -0.01], [0.0, -0.05]].forEach((p?: any) => A(cyl(0.02, 0.02, 0.006, 6), mT(p[0], 0.08, 0.55 + p[1]), VD.hat, '#f2b632'));
  // darbuka under the left arm
  A(lathe([[0.001, 0], [0.12, 0.02], [0.13, 0.08], [0.07, 0.2], [0.06, 0.28], [0.1, 0.36], [0.001, 0.36]], 10), mTRS(-0.2, 0.86, 0.12, 0.2, 0, -0.5), VD.darbuka, '#c9a64a', PT.TORSO);
  return { geo: b.build(), tris: b.tris() };
}

/* ---------- crowd shader (patched Lambert) ---------- */
const U_TIME: any = { value: 0 };
const CROWD_PARS = /* glsl */`
uniform float uTime;
attribute vec3 pt;
attribute vec4 iCol; attribute vec4 iCol2; attribute vec4 iAnim; attribute vec4 iPose; attribute vec4 iShape; attribute vec4 iExtra;
#ifdef SEL_IDS
attribute vec4 iSel;
#endif
varying vec3 vLocal; varying float vPat; varying vec3 vAlt; varying float vFace;
vec3 unpackC(float f) { float r = floor(f / 65536.0); float g = floor((f - r * 65536.0) / 256.0); float b = f - r * 65536.0 - g * 256.0; return pow(vec3(r, g, b) / 255.0, vec3(2.2)); }
float bitOn(float f, float b) { return mod(floor(f / exp2(b) + 0.0001), 2.0); }
mat3 rX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
// arm pose: x forward raise, y outward, z elbow bend
vec3 armPose(float code, float side, float ph, float walk, float t, float seed) {
  float w = min(walk, 1.0);
  vec3 a = vec3(side * (0.42 * w + 0.35 * max(walk - 1.0, 0.0)) * sin(ph), 0.08, 0.15 + 0.3 * w + 0.9 * max(walk - 1.0, 0.0));
  if (code < 0.5) return a;
  if (code < 1.5) return vec3(0.75, 0.02, 0.45);
  if (code < 2.5) return vec3(-0.35, 0.18, 0.1);
  if (code < 3.5) return vec3(0.28 + 0.12 * w * sin(ph), 0.1, 0.35);
  if (code < 4.5) return vec3(0.55, 0.02 + 0.3 * sin(ph * 0.5 + t * 1.6 * (1.0 - w)), 0.25);
  if (code < 5.5) return vec3(2.6, 0.35, 0.6);
  if (code < 6.5) return vec3(0.25, 0.12, 1.9);
  if (code < 7.5) return vec3(0.35, 0.25, 2.35);
  if (code < 8.5) return vec3(0.55, 0.05, 1.25);
  if (code < 9.5) return vec3(2.0, 0.3, 0.15);
  if (code < 10.5) return vec3(0.6, 0.06 * sin(t * 12.0), 1.3);
  if (code < 11.5) return vec3(1.0, 0.55, 0.5);
  if (code < 12.5) return vec3(0.95, -0.12, 1.75);
  if (code < 13.5) return vec3(0.75, 0.15, 0.65);
  if (code < 14.5) return vec3(0.95, -0.05, 0.65);
  if (code < 15.5) return vec3(0.05 + 0.45 * sin(ph) * w, 0.35, 0.4);
  if (code < 16.5) return vec3(0.05 * sin(ph) * w * side, 0.14, 0.1);
  if (code < 17.5) return vec3(0.15, 0.25, 1.3);
  if (code < 18.5) return vec3(1.1, -0.25, 2.0);
  if (code < 19.5) return vec3(0.25, 2.45 + 0.3 * sin(t * 10.0 + seed * 6.0), 0.4);
  if (code < 20.5) return vec3(0.2, 2.7 + 0.15 * sin(t * 7.5 + seed * 6.0), 0.4);
  if (code < 21.5) return vec3(0.5 + 0.25 * sin(t * 3.1 + seed * 9.0), 0.12, 1.0 + 0.35 * sin(t * 3.1 + 1.2 + seed * 9.0));
  if (code < 22.5) { float k = 0.5 + 0.5 * sin(t * 1.6 + seed * 9.0); return vec3(0.5 + 0.7 * k, -0.1, 1.4 + 0.9 * k); }
  if (code < 23.5) return vec3(-0.15, 0.55, 1.6);
  if (code < 24.5) return vec3(0.5, 0.05, 0.6);
  if (code < 25.5) return vec3(1.5, 0.1, 0.05);
  if (code < 26.5) return vec3(0.9 + 0.15 * sin(t * 3.4), 0.0, 0.2);
  if (code < 27.5) return vec3(2.5, 0.2, 0.25);
  return vec3(0.05, 0.05, 0.25);
}
vec3 legRot(vec3 p, float side, float f, float k, bool shin) {
  vec3 H = vec3(side * 0.095, 0.78, 0.0), K = vec3(side * 0.095, 0.43, 0.0);
  if (shin) p = K + rX(k) * (p - K);
  return H + rX(-f) * (p - H);
}
mat3 legRotN(float f, float k, bool shin) { return shin ? rX(-f) * rX(k) : rX(-f); }
void crowdPose(inout vec3 p, inout vec3 n) {
  float part = pt.x, vid = pt.z;
  vLocal = p; vPat = 0.0; vFace = 0.0;
#ifdef SEL_IDS
  if (vid > 0.5) { float on = 0.0; for (int i = 0; i < 4; i++) { float s = iSel[i]; if (s > 0.5) on = max(on, bitOn(vid, s - 1.0)); } if (on < 0.5) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); return; } }
#else
  if (vid > 0.5) { if (bitOn(iShape.z, vid - 1.0) < 0.5) { p = vec3(0.0); n = vec3(0.0, 1.0, 0.0); return; } }
#endif
  float ph = iAnim.x, walk = iAnim.y, carry = iAnim.z, sit = iAnim.w;
  float act = mod(iPose.x, 16.0), seed = iPose.y, t = uTime;
  float g = iShape.x, hs = iShape.y;
  float w = min(walk, 1.0), run = max(walk - 1.0, 0.0);
  // legs: forward angle f, knee bend k
  float A = 0.5 * w + 0.45 * run, K = 0.85 * w + 0.6 * run;
  float fL = A * sin(ph), fR = -A * sin(ph);
  float kL = K * (0.1 + 0.9 * max(0.0, cos(ph))), kR = K * (0.1 + 0.9 * max(0.0, -cos(ph)));
  fL = mix(fL, 1.32, sit); fR = mix(fR, 1.32, sit); kL = mix(kL, 1.32, sit); kR = mix(kR, 1.32, sit);
  float extL = 0.35 * cos(fL) + 0.35 * cos(fL - kL), extR = 0.35 * cos(fR) + 0.35 * cos(fR - kR);
  float drop = 0.7 - max(extL, extR);
  float jump = (act > 1.5 && act < 2.5) ? 0.14 * max(0.0, sin(t * 7.5 + seed * 6.0)) : 0.0;
  jump += run * 0.04 * max(0.0, sin(ph * 2.0));
  float lean = iExtra.x + 0.07 * w + 0.22 * run + (act > 2.5 && act < 3.5 ? 0.12 : 0.0);
  float twist = 0.1 * w * sin(ph);
  bool upper = part > 1.5 && part < 7.5;
  // girth
  if (part < 2.5 || part > 11.5 && part < 12.5) {
    p.x *= g; p.z *= g;
    if (g > 1.04 && p.z > 0.0 && part > 0.5) p.z += (g - 1.0) * 0.5 * exp(-pow((p.y - 0.95) / 0.15, 2.0)) * min(1.0, p.z / 0.12);
  }
  if (part > 3.5 && part < 7.5) p.x += sign(p.x) * (g - 1.0) * 0.21;
  if (part > 7.5 && part < 11.5) p.x += sign(p.x) * (g - 1.0) * 0.05;
  // arms
  if (part > 3.5 && part < 7.5) {
    float side = part < 5.5 ? -1.0 : 1.0;
    float code = side < 0.0 ? iPose.z : iPose.w;
    vec3 ap = armPose(code, side, ph, walk, t, seed);
    ap = mix(ap, vec3(0.95, -0.05, 0.65), carry);
    vec3 S = vec3(side * (0.235 + (g - 1.0) * 0.21), 1.245, 0.0), E = vec3(S.x, 0.99, 0.0);
    if (part > 4.5 && part < 5.5 || part > 6.5) { p = E + rX(-ap.z) * (p - E); n = rX(-ap.z) * n; }
    mat3 m = rZ(side * ap.y) * rX(-ap.x);
    p = S + m * (p - S); n = m * n;
  }
  // head
  if (part > 2.5 && part < 3.5) {
    vec3 N = vec3(0.0, 1.36, 0.0);
    float nod = iExtra.z + (act > 2.5 && act < 3.5 ? 0.5 + 0.04 * sin(t * 1.7 + seed) : 0.0);
    mat3 m = rY(iExtra.y + 0.1 * sin(t * 0.37 + seed * 20.0) * (1.0 - w)) * rX(nod) * rZ(act > 2.5 && act < 3.5 ? 0.2 : 0.0);
    p = N + m * ((p - N) * hs); n = m * n;
  }
  // legs and skirt
  if (part > 7.5 && part < 11.5) {
    bool left = part < 9.5, shin = part > 8.5 && part < 9.5 || part > 10.5;
    float f = left ? fL : fR, k = left ? kL : kR;
    p = legRot(p, left ? -1.0 : 1.0, f, k, shin); n = legRotN(f, k, shin) * n;
  } else if (part > 11.5 && part < 12.5) {
    bool shin = p.y < 0.43;
    vec3 pl = legRot(p, -1.0, fL, kL, shin), pr = legRot(p, 1.0, fR, kR, shin);
    float wl = clamp(0.5 - p.x / 0.25, 0.0, 1.0), wh = clamp((p.y - 0.62) / 0.2, 0.0, 1.0);
    vec3 pp = mix(pr, pl, wl);
    p = mix(pp, p, wh);
    n = normalize(mix(legRotN(mix(fR, fL, wl), mix(kR, kL, wl), shin) * n, n, wh));
  }
  // upper body lean and twist
  if (upper) { vec3 Hc = vec3(0.0, 0.78, 0.0); mat3 m = rY(twist) * rX(lean); p = Hc + m * (p - Hc); n = m * n; }
  // wheels
  if (part > 13.5 && part < 14.5) { vec3 Wc = vec3(0.0, 0.3, -0.05); mat3 m = rX(-ph * 0.6); p = Wc + m * (p - Wc); n = m * n; }
  if (part > 0.5 && part < 13.5) p.y += -drop + jump;
  if (pt.y > 15.5) { float fl = iShape.z; vPat = bitOn(fl, 14.0) + 2.0 * bitOn(fl, 15.0); vAlt = unpackC(iCol2.y); }
  if (pt.y > 8.5 && pt.y < 9.5) vFace = 1.0;
}
vec3 crowdColor() {
  float tn = pt.y, fl = iShape.z;
  if (tn < 0.5) return unpackC(iCol.x);
  if (tn < 1.5) return unpackC(iCol.y);
  if (tn < 2.5) return unpackC(iCol.z);
  if (tn < 3.5) return unpackC(iCol.w);
  if (tn < 4.5) return unpackC(iCol2.x);
  if (tn < 5.5) return unpackC(iCol2.y);
  if (tn < 6.5) return unpackC(iCol2.z);
  if (tn < 7.5) return unpackC(iCol2.w);
  if (tn < 8.5) return unpackC(iCol2.w) * 0.72 + 0.12;
  if (tn < 9.5) return unpackC(iCol.x);
  if (tn < 10.5) return bitOn(fl, 10.0) > 0.5 ? unpackC(iCol.x) : (bitOn(fl, 2.0) > 0.5 ? unpackC(iCol2.x) : unpackC(iCol.y));
  if (tn < 11.5) return bitOn(fl, 9.0) > 0.5 ? unpackC(iCol.x) : unpackC(iCol.z);
  if (tn < 12.5) return vec3(0.03, 0.03, 0.04);
  if (tn < 13.5) return vec3(0.92, 0.91, 0.88);
  if (tn < 14.5) return color;
  if (tn < 15.5) return bitOn(fl, 2.0) > 0.5 ? unpackC(iCol2.x) : unpackC(iCol.y);
  return unpackC(iCol.y);
}
`;
function crowdMaterial(map?: any, selIds?: any, extraKey?: any) {
  const m = new T.MeshLambertMaterial({ vertexColors: true, map: map || null });
  m.onBeforeCompile = (sh?: any) => {
    sh.uniforms.uTime = U_TIME;
    let v = sh.vertexShader;
    v = v.replace('#include <common>', (selIds ? '#define SEL_IDS\n' : '') + '#include <common>\n' + CROWD_PARS);
    v = v.replace('#include <uv_vertex>', map ? `
      { float act = mod(iPose.x, 16.0), mood = floor(iPose.x / 16.0);
        float row = mood > 1.5 ? 3.0 : (mood > 0.5 ? 2.0 : 0.0);
        if (act > 1.5 && act < 2.5) row = 2.0;
        float bl = step(0.962, fract(uTime * 0.27 + iPose.y * 7.13));
        if ((row < 0.5 || row > 2.5) && bl > 0.5) row = 1.0;
        if (act > 0.5 && act < 1.5 && fract(uTime * 5.0 + iPose.y * 3.0) > 0.5) row = 4.0;
        if (act > 2.5 && act < 3.5) row = 1.0;
        if (iExtra.w > 0.5) { float ov = iExtra.w - 1.0; if (!(row > 0.5 && row < 1.5 && (ov < 0.5 || (ov > 2.5 && ov < 3.5))) && !(row > 3.5 && row < 4.5)) row = ov; }
        if (pt.y > 8.5 && pt.y < 9.5) vMapUv = vec2((iShape.w + uv.x) / 16.0, 1.0 - (row + 1.0 - uv.y) * 0.125);
        else vMapUv = vec2(0.5, 0.06); }` : '');
    v = v.replace('#include <color_vertex>', 'vColor = crowdColor();');
    v = v.replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal); vec3 posePos = vec3(position); crowdPose(posePos, objectNormal);');
    v = v.replace('#include <begin_vertex>', 'vec3 transformed = posePos;');
    sh.vertexShader = v;
    let f = sh.fragmentShader;
    f = f.replace('#include <common>', '#include <common>\nvarying vec3 vLocal; varying float vPat; varying vec3 vAlt; varying float vFace;');
    f = f.replace('#include <map_fragment>', '');
    f = f.replace('#include <color_fragment>', `
      diffuseColor.rgb *= vColor;
      if (vPat > 0.5) {
        float ang = atan(vLocal.x, vLocal.z);
        float s = vPat < 1.5 ? step(0.5, fract(vLocal.y * 8.0)) : (vPat < 2.5 ? step(0.55, fract(ang * 2.2)) : 0.55 * max(step(0.62, fract(vLocal.y * 9.0)), step(0.62, fract(ang * 2.6))));
        diffuseColor.rgb = mix(diffuseColor.rgb, vAlt, s);
      }
      #ifdef USE_MAP
        vec4 tc = texture2D(map, vMapUv);
        diffuseColor.rgb = mix(diffuseColor.rgb, tc.rgb, tc.a * vFace);
      #endif`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => 'sbcrowd' + (map ? 'M' : '') + (selIds ? 'S' : '') + (extraKey || '');
  return m;
}

/* crowd face atlas: 16 faces x 5 expressions, 64px cells, transparent background (decal over skin) */
let crowdFaceTex: any = null;
function crowdFaces() {
  if (crowdFaceTex) return crowdFaceTex;
  const rows = ['normal', 'blink', 'happy', 'angry', 'talk'];
  crowdFaceTex = C.canvasTex(1024, 512, (g?: any) => {
    g.clearRect(0, 0, 1024, 512);
    for (let f = 0; f < 16; f++) { const fs: any = Object.assign({ iris: IRIS[(f * 3) % IRIS.length] }, FACE_SPECS[f]); rows.forEach((r?: any, i?: any) => paintFace(g, f * 64, i * 64, 64, fs, r, null));
      // motor rows 5..7: surprised, sleepy, pout (CROWD_ROW maps the 12 expressions onto rows 0..7)
      [4, 5, 6].forEach((c, i) => paintFaceX(g, f * 64, (5 + i) * 64, 64, fs, c, null, false)); }
  });
  return crowdFaceTex;
}

/* ---------- randomLook: 24 citizen types, respectful diversity ---------- */
const pickW = (R?: any, arr?: any) => { let s = 0; for (const a of arr) s += a[1]; let r = R.next() * s; for (const a of arr) { r -= a[1]; if (r <= 0) return a[0]; } return arr[arr.length - 1][0]; };
const SCARF_COLS = ['#8c5a9a', '#3fb5b0', '#e9a0b4', '#5aa9d6', '#c94f6d', '#e8d6b0', '#6f8f4f', '#2e4a6b', '#d9822b', '#f3e3b6', '#7d6bb0', '#b04a3b', '#99b8d8', '#f6efe1'];
const HAT_COLS = ['#6b6258', '#2e4a6b', '#c0392b', '#3c3a44', '#e8e2d4', '#7a6a55', '#5aa9d6', '#f0d35a', '#8daa5b'];
const TYPE_IDS = ['teyze', 'emekli', 'universiteli', 'okul', 'plaza', 'taraftar', 'taksici', 'gecekusu', 'simitci', 'hamal', 'oltaci', 'kurye', 'muzisyen', 'boyaci', 'midyeci', 'kestaneci', 'kruvaziyer', 'gezgin', 'vlogcu', 'balayi', 'turgrubu', 'isinsani', 'vapuryolcusu', 'bebekarabali'];
CH.TYPE_IDS = TYPE_IDS;

function baseLook(R?: any, type?: any, o?: any) {
  const fem = typeof o.fem === 'boolean' ? o.fem : R.chance(o.fem == null ? 0.5 : o.fem);
  const age = pickW(R, o.ages || [['young', 3], ['adult', 5], ['old', 2]]);
  const L: any = { type, fem, age, skin: R.int(0, 11), props: [], vendor: [], back: null, mobility: null, gait: o.gait || 'normal' };
  L.body = pickW(R, age === 'child' ? [['slim', 3], ['mid', 4], ['round', 1.5]] : [['slim', 3], ['mid', 5], ['round', 3]]);
  L.girth = L.body === 'slim' ? R.range(0.88, 0.95) : L.body === 'mid' ? R.range(0.97, 1.04) : R.range(1.1, 1.24);
  L.height = age === 'child' ? R.range(0.6, 0.74) : (fem ? R.range(0.9, 1.01) : R.range(0.96, 1.08)) * (age === 'old' ? 0.96 : 1);
  L.headScale = age === 'child' ? 1.3 : 1;
  const natural = [[HAIRC.black, 5], [HAIRC.darkbrown, 5], [HAIRC.brown, 3], [HAIRC.chestnut, 2], [HAIRC.auburn, 1], [HAIRC.light, 1], [HAIRC.blond, 0.7]];
  L.hairColor = age === 'old' ? pickW(R, [[HAIRC.grey, 3], [HAIRC.silver, 3], [HAIRC.white, 2], [HAIRC.darkbrown, 0.6]]) : pickW(R, natural);
  L.hair = fem ? pickW(R, [['long', 3], ['bob', 2], ['bun', 2], ['ponytail', 2], ['wavy', 2], ['curly', 1.4], ['afro', 0.8], ['short', 1]])
    : pickW(R, [['short', 5], ['buzz', 2], ['curly', 1.6], ['afro', 0.6], ['none', age === 'old' ? 3 : age === 'adult' ? 0.7 : 0.1]]);
  if (!fem && age !== 'child') { L.mustache = R.chance(age === 'old' ? 0.42 : 0.26); L.beard = R.chance(0.16); }
  L.glasses = R.chance(age === 'old' ? 0.32 : 0.11) ? 'glasses' : (age !== 'old' && R.chance(0.05) ? 'sun' : null);
  if (fem && age !== 'child' && R.chance(o.scarf == null ? 0.3 : o.scarf)) {
    L.headscarf = pickW(R, o.scarfStyles || [['turban', 1], ['loose', 1], ['yazma', 0.8], ['sport', 0.6]]);
    L.scarfColor = R.pick(SCARF_COLS);
  }
  L.top = R.pick(CLOTH); L.topStyle = o.top || pickW(R, [['tee', 4], ['shirt', 2.5], ['cardigan', fem ? 1 : 0.3], ['hoodie', age === 'young' ? 1.4 : 0.3], ['jacket', 1]]);
  L.accent = R.pick(CLOTH); L.accent2 = R.pick(CLOTH);
  L.bottom = R.pick(PANTS);
  L.bottomStyle = fem && R.chance(L.headscarf ? 0.5 : 0.3) ? 'skirt' : (age === 'child' || age === 'young') && R.chance(0.12) ? 'shorts' : 'pants';
  L.shoes = age === 'old' && R.chance(0.4) ? '#e8e2d4' : R.pick(SHOES);
  L.face = age === 'child' ? R.pick([8, 13, 2, 0, 5, 9, 12]) : age === 'old' && R.chance(0.6) ? R.pick([7, 11, 14, 4]) : R.int(0, 15);
  L.earrings = fem && R.chance(0.35);
  if (age === 'old') L.elder = true;
  return L;
}
function hatOn(L?: any, R?: any, hats?: any, p?: any) { if (!L.headscarf && R.chance(p)) { L.hat = R.pick(hats); L.hatColor = R.pick(HAT_COLS); } }
const TYPE_GEN: any = {
  teyze(R?: any) { const L = baseLook(R, 'teyze', { fem: true, ages: [['old', 6], ['adult', 4]], scarf: 0.6, scarfStyles: [['yazma', 2], ['turban', 1], ['loose', 1]], gait: 'waddle' });
    if (R.chance(0.6)) { L.topStyle = 'cardigan'; } if (R.chance(0.55)) L.bottomStyle = 'skirt';
    if (R.chance(0.55)) L.mobilityProp = 'trolley'; else if (R.chance(0.4)) L.props.push('handbag'); return L; },
  emekli(R?: any) { const L = baseLook(R, 'emekli', { fem: false, ages: [['old', 1]], gait: 'slow', top: 'shirt' });
    hatOn(L, R, ['kasket', 'kasket', 'cap'], 0.65); if (R.chance(0.6)) L.vest = true; if (R.chance(0.65)) L.props.push('newspaper'); return L; },
  universiteli(R?: any) { const L = baseLook(R, 'universiteli', { ages: [['young', 1]], scarf: 0.3, scarfStyles: [['sport', 1.4], ['turban', 1], ['loose', 1]] });
    if (R.chance(0.75)) L.back = 'pack'; if (R.chance(0.4)) L.props.push('headphones'); if (R.chance(0.3)) L.topStyle = 'hoodie'; return L; },
  okul(R?: any) { const L = baseLook(R, 'okul', { ages: [['child', 1]], gait: 'kid' });
    L.top = R.pick(['#fbfbf8', '#cfe3f3']); L.topStyle = 'shirt'; L.bottom = R.pick(['#2e4a6b', '#59606b']); if (R.chance(0.5)) { L.vest = true; L.accent = '#2e4a6b'; }
    L.back = 'school'; L.accent2 = R.pick(['#e0533c', '#f0d35a', '#3fb5b0', '#f2a2b3', '#7d6bb0', '#8daa5b']); return L; },
  plaza(R?: any) { const L = baseLook(R, 'plaza', { ages: [['young', 2], ['adult', 3]], scarf: 0.3, scarfStyles: [['turban', 1.5], ['loose', 1]], gait: 'fast', top: 'shirt' });
    L.top = R.pick(['#fbfbf8', '#cfe3f3', '#f3e3d0', '#e8eef5']); L.bottom = R.pick(['#2f3a4a', '#3c3a44', '#59606b']);
    if (R.chance(0.45)) { L.topStyle = 'jacket'; L.accent = R.pick(['#2e3a59', '#3c3a44', '#5c6a7a', '#7a6a55']); }
    if (!L.fem && R.chance(0.3)) { L.tie = true; L.accent2 = R.pick(['#c0392b', '#2e4a6b', '#7d6bb0']); }
    if (R.chance(0.8)) L.lanyard = true; if (R.chance(0.7)) L.props.push('phone'); return L; },
  taraftar(R?: any) { const L = baseLook(R, 'taraftar', { ages: [['young', 3], ['adult', 3], ['old', 1], ['child', 0.6]], scarf: 0.25, scarfStyles: [['sport', 2], ['turban', 1]] });
    const tk = R.pick(Object.keys(TEAMS)), tc = TEAMS[tk]; L.team = tk; L.topStyle = 'tee'; L.top = tc[0]; L.accent2 = tc[1]; L.pattern = R.pick([0, 1, 1, 2]);
    if (R.chance(0.8)) { L.teamScarf = true; L.accent = tc[0]; } if (!L.headscarf && R.chance(0.35)) { L.hat = R.pick(['beanie', 'cap']); L.hatColor = tc[1]; }
    if (L.headscarf) L.scarfColor = tc[0]; return L; },
  taksici(R?: any) { const L = baseLook(R, 'taksici', { fem: 0.2, ages: [['adult', 3], ['old', 1], ['young', 1]], gait: 'fast', top: 'shirt' });
    L.sleeves = 'short'; L.top = R.pick(['#cfe3f3', '#f3e3d0', '#fbfbf8', '#f0d35a']); L.props.push('keys'); if (!L.fem) L.mustache = R.chance(0.5); return L; },
  gecekusu(R?: any) { const L = baseLook(R, 'gecekusu', { ages: [['young', 1]], scarf: 0.25 });
    if (R.chance(0.5)) { L.topStyle = 'hoodie'; L.top = R.pick(['#3c3a44', '#2e4a6b', '#7d6bb0', '#c94f6d']); L.hood = true; } else { L.topStyle = 'jacket'; L.accent = R.pick(['#2b2b30', '#4a3528', '#3c3a44']); }
    L.bottom = R.pick(['#2b2b30', '#2f3a4a']); if (R.chance(0.3)) L.props.push('headphones'); return L; },
  simitci(R?: any) { const L = baseLook(R, 'simitci', { fem: 0.3, ages: [['adult', 3], ['young', 1], ['old', 1]], top: 'shirt' });
    L.apron = true; L.accent2 = '#fbfbf8'; L.vendor.push('tray'); L.hat = null; return L; },
  hamal(R?: any) { const L = baseLook(R, 'hamal', { fem: false, ages: [['adult', 3], ['young', 1]], gait: 'heavy', top: 'tee' });
    L.vest = R.chance(0.5); L.back = 'hamal'; L.lean = 0.3; L.mustache = R.chance(0.5); return L; },
  oltaci(R?: any) { const L = baseLook(R, 'oltaci', { fem: 0.15, ages: [['old', 3], ['adult', 2]], gait: 'slow' });
    hatOn(L, R, ['bucket', 'kasket', 'sunhat', 'cap'], 0.8); L.vest = R.chance(0.6); L.accent = R.pick(['#6f8f4f', '#7a6a55', '#2e4a6b']); L.props.push('rod', 'bucket'); return L; },
  kurye(R?: any) { const L = baseLook(R, 'kurye', { fem: 0.3, ages: [['young', 3], ['adult', 2]], gait: 'fast' });
    L.hat = 'helmet'; L.hatColor = '#3fb5b0'; L.headscarf = null; L.topStyle = 'jacket'; L.accent = '#3fb5b0'; L.top = '#fbfbf8'; L.back = 'courier'; L.bottom = '#2f3a4a'; return L; },
  muzisyen(R?: any) { const L = baseLook(R, 'muzisyen', { ages: [['young', 2], ['adult', 3], ['old', 1]], scarf: 0.25 });
    L.vendor.push(R.pick(['baglama', 'baglama', 'clarinet', 'darbuka']), 'hat'); hatOn(L, R, ['kasket', 'beanie'], 0.3); L.vest = R.chance(0.4); return L; },
  boyaci(R?: any) { const L = baseLook(R, 'boyaci', { fem: 0.15, ages: [['adult', 3], ['old', 2], ['young', 1]] });
    L.vendor.push('shine'); hatOn(L, R, ['kasket', 'cap'], 0.5); L.apron = R.chance(0.5); L.accent2 = '#4a3528'; return L; },
  midyeci(R?: any) { const L = baseLook(R, 'midyeci', { fem: 0.25, ages: [['young', 2], ['adult', 3]] });
    L.vendor.push('mussel'); hatOn(L, R, ['cap', 'bandana'], 0.5); L.apron = R.chance(0.6); L.accent2 = '#fbfbf8'; return L; },
  kestaneci(R?: any) { const L = baseLook(R, 'kestaneci', { fem: 0.25, ages: [['adult', 3], ['old', 2]], top: 'jacket', gait: 'slow' });
    L.vendor.push('chestnut'); hatOn(L, R, ['beanie', 'kasket'], 0.6); return L; },
  kruvaziyer(R?: any) { const L = baseLook(R, 'kruvaziyer', { ages: [['adult', 3], ['old', 3], ['young', 1]], scarf: 0.2, gait: 'slow' });
    hatOn(L, R, ['cap', 'bucket', 'cap'], 0.9); R.chance(0.6); L.props.push('camera'); /* musteri-4: tourists always carry a camera */ if (R.chance(0.12)) L.props.push('flag'); if (R.chance(0.3)) L.bottomStyle = L.bottomStyle === 'skirt' ? 'skirt' : 'shorts';
    if (R.chance(0.25)) L.glasses = 'sun'; if (R.chance(0.3)) L.props.push('handbag'); return L; },
  gezgin(R?: any) { const L = baseLook(R, 'gezgin', { ages: [['young', 3], ['adult', 2]], scarf: 0.2 });
    L.back = 'bigpack'; L.props.push('map'); hatOn(L, R, ['bucket', 'cap'], 0.35); if (R.chance(0.3) && L.bottomStyle !== 'skirt') L.bottomStyle = 'shorts'; return L; },
  vlogcu(R?: any) { const L = baseLook(R, 'vlogcu', { ages: [['young', 3], ['adult', 2]], scarf: 0.3 });
    L.props.push('phone'); L.top = R.pick(['#f2a2b3', '#3fb5b0', '#f0d35a', '#7d6bb0', '#e0533c']); if (R.chance(0.3)) L.glasses = 'sun'; return L; },
  balayi(R?: any) { const photographer = R.chance(0.3); const L = baseLook(R, 'balayi', { ages: [['young', 2], ['adult', 2]], scarf: 0.3 });
    if (photographer) { L.props.push('camera'); L.vest = true; L.accent = '#3c3a44'; hatOn(L, R, ['cap'], 0.5); L.role = 'fotografci'; return L; }
    if (L.fem) { L.topStyle = 'tee'; L.top = R.pick(['#fbfbf8', '#f6efe1', '#f2a2b3', '#cfe3f3']); L.bottomStyle = 'skirt'; L.bottom = L.top; if (R.chance(0.3)) L.props.push('bouquet'); }
    else { L.topStyle = 'jacket'; L.top = '#fbfbf8'; L.accent = R.pick(['#2e3a59', '#3c3a44', '#e8e2d4']); L.bottom = L.accent; L.tie = R.chance(0.5); L.accent2 = '#c94f6d'; }
    L.shoes = '#2b2522'; return L; },
  turgrubu(R?: any) { const L = baseLook(R, 'turgrubu', { ages: [['old', 1]], scarf: 0.25, gait: 'slow' });
    hatOn(L, R, ['sunhat', 'bucket', 'cap'], 0.75); L.shoes = R.pick(['#f2efe8', '#e8e2d4', '#d9d4c7']); if (R.chance(0.3)) L.props.push('camera'); if (R.chance(0.2)) L.mobility = 'cane'; return L; },
  isinsani(R?: any) { const L = baseLook(R, 'isinsani', { ages: [['adult', 3], ['young', 1], ['old', 1]], scarf: 0.3, scarfStyles: [['turban', 2], ['loose', 1]], gait: 'fast', top: 'jacket' });
    L.top = '#fbfbf8'; L.accent = R.pick(['#2e3a59', '#3c3a44', '#4a4a55', '#5a4a3a']); L.bottom = L.accent; if (!L.fem || R.chance(0.2)) { L.tie = true; L.accent2 = R.pick(['#c0392b', '#2e4a6b', '#3fb5b0', '#7d6bb0']); }
    L.props.push('briefcase'); if (R.chance(0.4)) L.props.push('phone'); L.shoes = '#2b2522'; return L; },
  vapuryolcusu(R?: any) { const L = baseLook(R, 'vapuryolcusu', { gait: 'fast', scarf: 0.32 });
    const r = R.next(); if (r < 0.3) L.props.push('bag'); else if (r < 0.55) L.props.push('phone'); else if (r < 0.7) L.props.push('handbag'); else if (r < 0.8) L.back = 'pack';
    if (R.chance(0.25)) L.props.push('ticket'); return L; },
  bebekarabali(R?: any) { const L = baseLook(R, 'bebekarabali', { ages: [['adult', 3], ['young', 2]], scarf: 0.32 }); L.mobility = 'stroller'; return L; }
};
CH.randomLook = function (typeId?: any, rng?: any) {
  const R = rng && rng.next ? rng : C.rng(((rng | 0) || Math.floor(vrand() * 1e9)) >>> 0);
  const gen = TYPE_GEN[typeId] || TYPE_GEN.vapuryolcusu;
  const L = gen(R);
  L.type = typeId;
  // mobility aids appear inside every type at a normal rate (never a separate type)
  if (!L.mobility) {
    const r = R.next();
    if (r < 0.035) L.mobility = 'wheelchair';
    else if (r < 0.035 + (L.age === 'old' ? 0.13 : L.age === 'child' ? 0 : 0.02)) L.mobility = 'cane';
    else if (r < 0.2 && R.chance(0.13)) L.mobility = 'whitecane';
    else if (L.age !== 'child' && L.age !== 'old' && !L.vendor.length && !L.back && R.chance(0.03)) L.mobility = 'stroller';
  }
  if (L.mobility === 'wheelchair' || L.mobility === 'stroller') { L.mobilityProp = null; L.vendor = L.vendor.filter((v?: any) => v === 'tray' || v === 'baglama' || v === 'clarinet' || v === 'darbuka' || v === 'hat'); if (L.back === 'hamal') { L.back = null; L.lean = 0; } }
  if (L.mobility === 'stroller' || L.mobility === 'whitecane' || L.mobility === 'cane') L.props = L.props.filter((p?: any) => !/rod|flag|selfiestick|briefcase|bucket/.test(p));
  if (L.mobilityProp) L.props = L.props.filter((p?: any) => p !== 'briefcase' && p !== 'bucket' && p !== 'map');
  if (L.mobility === 'cane' || L.mobility === 'whitecane') L.gait = 'slow';
  if (L.mobility === 'wheelchair') L.gait = 'wheel';
  // contract look fields (also usable by makeHero)
  L.skinColor = SKINS[L.skin];
  if (!L.sleeves) L.sleeves = /shirt|jacket|cardigan|hoodie/.test(L.topStyle) ? (R.chance(0.25) && L.topStyle === 'shirt' ? 'short' : 'long') : 'short';
  if (L.topStyle === 'jacket' || L.topStyle === 'cardigan') L.jacket = true;
  if (L.vest && typeof L.vest !== 'string') L.vest = L.accent;
  if (L.tie === true) L.tie = L.accent2;
  if (L.apron === true) L.apron = L.accent2;
  L.seed = R.int(0, 1e6);
  return L;
};

/* ---------- makeCrowd ---------- */
const packCol = (c?: any) => { col.set(c || '#888888'); return col.getHex(); };
const GAIT: any = { normal: [8.6, 1], fast: [10.6, 1.05], slow: [6.4, 0.8], kid: [11.5, 1.1], heavy: [7, 0.85], waddle: [7.4, 1.25], wheel: [4.2, 1] };
CH.makeCrowd = function (scene?: any, maxCount?: any) {
  const max = Math.max(1, maxCount || 90);
  const group = new T.Group(); group.name = 'crowd';
  if (scene) scene.add(group);
  const uTime: any = { value: 0 };
  const faces = crowdFaces();
  const mkMat = (map?: any, sel?: any) => { const m = crowdMaterial(map, sel); const ob = m.onBeforeCompile; m.onBeforeCompile = (sh?: any, r?: any) => { ob(sh, r); sh.uniforms.uTime = uTime; }; return m; };
  const layers: any = [];
  function Layer(name?: any, built?: any, mat?: any, cap?: any, sel?: any) {
    const geo = built.geo.clone();
    const mesh = new T.InstancedMesh(geo, mat, cap);
    mesh.name = 'crowd-' + name; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.count = 0; mesh.visible = false;
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    const A: any = {};
    ['iCol', 'iCol2', 'iAnim', 'iPose', 'iShape', 'iExtra'].concat(sel ? ['iSel'] : []).forEach((k?: any) => { const a = new T.InstancedBufferAttribute(new Float32Array(cap * 4), 4); a.setUsage(T.DynamicDrawUsage); geo.setAttribute(k, a); A[k] = a; });
    const L: any = { name, mesh, A, cap, members: [], n: 0, tris: built.tris, sel };
    group.add(mesh); layers.push(L); return L;
  }
  const body = Layer('body', C.geo('chars-crowd-body', () => withSeg(SEG.crowd, buildCitizenBody)), mkMat(faces, false), max, false);
  const headMat = mkMat(null, true);
  const hair = Layer('hair', C.geo('chars-crowd-hair', () => withSeg(SEG.crowd, () => buildHeadwear('hair'))), headMat, max, true);
  const hat = Layer('hat', C.geo('chars-crowd-hat', () => withSeg(SEG.crowd, () => buildHeadwear('hat'))), headMat, max, true);
  const scarf = Layer('scarf', C.geo('chars-crowd-scarf', () => withSeg(SEG.crowd, () => buildHeadwear('scarf'))), headMat, max, true);
  const small = Layer('props', C.geo('chars-crowd-small', () => withSeg(SEG.crowdS, buildSmallProps)), mkMat(null, true), max, true);
  const back = Layer('back', C.geo('chars-crowd-back', () => withSeg(SEG.crowdS, buildBackGear)), mkMat(null, true), max, true);
  const mob = Layer('mobility', C.geo('chars-crowd-mob', () => withSeg(SEG.crowdS, buildMobility)), mkMat(null, true), max, true);
  const vend = Layer('vendor', C.geo('chars-crowd-vend', () => withSeg(SEG.crowdS, buildVendor)), mkMat(null, true), Math.max(4, Math.ceil(max / 3)), true);
  const shadow = new T.InstancedMesh(blobGeo(), blobMat(0.3), max);
  shadow.name = 'crowd-shadow'; shadow.frustumCulled = false; shadow.count = 0; shadow.renderOrder = -1; shadow.instanceMatrix.setUsage(T.DynamicDrawUsage); group.add(shadow);
  const cits = new Map(); const order: any = []; let nextId = 1;

  const flagsOf = (L?: any) => {
    let f = 0; const on = (b?: any) => { f += Math.pow(2, b); };
    if (L.bottomStyle === 'skirt') on(FB.skirt); if (L.vest) on(FB.vest); if (L.jacket || /jacket|cardigan/.test(L.topStyle)) on(FB.jacket); if (L.tie) on(FB.tie);
    if (L.mustache) on(FB.mustache); if (L.beard) on(FB.beard); if (L.glasses) on(FB.glasses); if (L.glasses === 'sun') on(FB.sun); if (L.apron) on(FB.apron); if (L.lanyard) on(FB.lanyard);
    if (L.bottomStyle === 'shorts') on(FB.shorts); if (L.sleeves === 'short' || L.sleeves === 'rolled') on(FB.shortSleeve); if (L.hood || L.topStyle === 'hoodie') on(FB.hood); if (L.teamScarf) on(FB.teamScarf);
    const pat = L.pattern | 0; if (pat & 1) on(FB.pat0); if (pat & 2) on(FB.pat1); if (L.elder) on(FB.elder); if (L.earrings && !L.headscarf) on(FB.earrings);
    return f;
  };
  function prep(look?: any) {
    const L = look || CH.randomLook('vapuryolcusu');
    const P: any = {};
    P.cA = [packCol(L.skinColor || SKINS[L.skin | 0]), packCol(L.top), packCol(L.bottom), packCol(L.shoes)];
    P.cB = [packCol(typeof L.vest === 'string' ? L.vest : L.accent || L.top), packCol(typeof L.tie === 'string' ? L.tie : (typeof L.apron === 'string' ? L.apron : L.accent2 || L.top)), packCol(L.hairColor), packCol(L.headscarf ? L.scarfColor : (L.hatColor || '#6b6258'))];
    P.shape = [L.girth || BODY_G[L.body] || 1, L.headScale || 1, flagsOf(L), (L.face == null ? (L.seed || 0) : L.face) % 16];
    let hair = L.headscarf ? ((L.headscarf === 'loose' || L.headscarf === 'yazma') ? 'buzz' : 'none') : (L.hair || 'short');
    let hat = L.headscarf ? null : L.hat;
    if (hat === 'chef' || hat === 'paper') hat = null; // hero-only hats are not in the crowd union
    if (hat && /helmet|chef|beanie|bandana/.test(hat) && hair !== 'long' && hair !== 'ponytail') hair = 'buzz';
    else if (hat && /curly|afro|wavy/.test(hair)) hair = hair === 'wavy' ? 'long' : 'short'; // curls would poke through the hat
    if (L.vendor && L.vendor.indexOf('tray') >= 0 && hair === 'afro') hair = 'curly';
    P.head = [HW[hair] || 0, L.headscarf ? HW[L.headscarf] : (hat ? HW[hat] || 0 : 0), 0, 0];
    P.props = (L.props || []).map((p?: any) => SP[p] || 0).filter(Boolean);
    if (L.mobility === 'cane') P.props.push(SP.cane); if (L.mobility === 'whitecane') P.props.push(SP.whitecane);
    P.back = L.back ? BK[L.back] : 0;
    P.mob = L.mobility === 'wheelchair' ? MB.wheelchair : L.mobility === 'stroller' ? MB.stroller : L.mobilityProp === 'trolley' ? MB.trolley : 0;
    P.vend = (L.vendor || []).map((v?: any) => VD[v] || 0).filter(Boolean);
    // base arm holds
    let hl = 0, hr = 0;
    const has = (k?: any) => (L.props || []).indexOf(k) >= 0, vh = (k?: any) => (L.vendor || []).indexOf(k) >= 0;
    if (has('briefcase') || has('bag') || has('bucket')) hl = 16;
    if (has('newspaper')) hl = 17;
    if (has('map')) hl = 8;
    if (has('phone')) hr = 8;
    if (has('keys') || has('ticket')) hr = 0;
    if (has('rod')) hr = 13;
    if (has('flag')) hr = 27;
    if (has('selfiestick')) hr = 9;
    if (has('bouquet')) hr = 8;
    if (L.back === 'hamal') { hl = 6; hr = 6; } else if (L.back === 'bigpack') hl = hl || 6;
    if (vh('tray')) hr = 5; if (vh('shine')) hr = 16; if (vh('mussel')) { hl = 14; hr = 14; } if (vh('chestnut')) { hl = 1; hr = 1; }
    if (vh('baglama')) { hl = 11; hr = 10; } if (vh('clarinet')) { hl = 12; hr = 12; } if (vh('darbuka')) { hl = 17; hr = 10; }
    if (P.mob === MB.trolley) hl = 2;
    if (L.mobility === 'stroller') { hl = 1; hr = 1; }
    if (L.mobility === 'cane') hr = 3;
    if (L.mobility === 'whitecane') hr = 4;
    if (L.mobility === 'wheelchair') { hl = hl === 0 || hl === 16 || hl === 6 ? 15 : hl; hr = hr === 0 || hr === 8 ? 15 : hr; }
    P.hl = hl; P.hr = hr;
    const g = GAIT[L.gait] || GAIT.normal; P.rate = g[0]; P.amp = g[1];
    P.lean = (L.lean || 0) + (L.elder ? 0.1 : 0);
    P.scale = L.height || 1;
    P.headTop = (CB.neckY + (CB.headY - CB.neckY + CB.R * 1.05) * (L.headScale || 1)) + (hat ? (hat === 'chef' ? 0.25 : 0.08) : 0) + (vh('tray') ? 0.16 : 0) + (L.hair === 'afro' && !L.headscarf ? 0.08 : 0);
    P.wide = P.mob || vh('chestnut') ? 1.25 : 0.62 * (P.shape[0]);
    P.sitLock = L.mobility === 'wheelchair';
    return P;
  }
  const writeStatic = (Lr?: any, slot?: any, c?: any) => {
    const o = slot * 4, A = Lr.A, P = c.P;
    A.iCol.array.set(P.cA, o); A.iCol2.array.set(P.cB, o); A.iShape.array.set(P.shape, o);
    A.iCol.needsUpdate = A.iCol2.needsUpdate = A.iShape.needsUpdate = true;
  };
  const join = (Lr?: any, c?: any) => { if (c.slots[Lr.name] != null || Lr.n >= Lr.cap) return; const s = Lr.n++; Lr.members[s] = c.id; c.slots[Lr.name] = s; writeStatic(Lr, s, c); };
  const leave = (Lr?: any, c?: any) => {
    const s = c.slots[Lr.name]; if (s == null) return;
    const last = --Lr.n;
    if (s !== last) { const oid = Lr.members[last], o = cits.get(oid); Lr.members[s] = oid; o.slots[Lr.name] = s; writeStatic(Lr, s, o); }
    Lr.members.length = Lr.n; delete c.slots[Lr.name];
  };
  const selFor = (Lr?: any, c?: any) => {
    const P = c.P;
    if (Lr === hair) return [P.head[0] < HW.kasket ? P.head[0] : 0, 0, 0, 0];
    if (Lr === hat) return [P.head[1] >= HW.kasket && P.head[1] < HW.turban ? P.head[1] : 0, 0, 0, 0];
    if (Lr === scarf) return [P.head[1] >= HW.turban ? P.head[1] : 0, 0, 0, 0];
    if (Lr === small) { const a = P.props.slice(); if (c.act === 'eat') a.push(SP.simit); if (c.act === 'drink') a.push(SP.tea); if (c.act === 'phone' && a.indexOf(SP.phone) < 0) a.push(SP.phone); return [a[0] || 0, a[1] || 0, a[2] || 0, a[3] || 0]; }
    if (Lr === back) return [P.back, 0, 0, 0];
    if (Lr === mob) return [P.mob, 0, 0, 0];
    if (Lr === vend) return [P.vend[0] || 0, P.vend[1] || 0, 0, 0];
    return [0, 0, 0, 0];
  };
  const wants = (Lr?: any, c?: any) => Lr === body || selFor(Lr, c).some((v?: any) => v > 0);
  const syncMembership = (c?: any) => { for (const Lr of layers) { const w = wants(Lr, c), m = c.slots[Lr.name] != null; if (w && !m) join(Lr, c); else if (!w && m) leave(Lr, c); } };

  const crowd: any = {
    group, max,
    get count() { return cits.size; },
    add(look?: any) {
      if (cits.size >= max) return -1;
      const id = nextId++;
      const L = look || CH.randomLook('vapuryolcusu');
      const c: any = { id, look: L, P: prep(L), slots: {}, x: 0, z: 0, rot: 0, speed: 0, spd: 0, carry: 0, carryW: 0, sit: 0, sitW: 0, act: 'idle', mood: 'ok', phase: vrand() * 6, seed: ((L.seed || id * 7919) % 1000) / 1000, yaw: 0, nod: 0 };
      cits.set(id, c); order.push(id);
      syncMembership(c);
      return id;
    },
    set(id?: any, s?: any) {
      const c = cits.get(id); if (!c || !s) return;
      if (s.x != null) c.x = s.x; if (s.z != null) c.z = s.z; if (s.y != null) c.y = s.y;
      if (s.rot != null) c.rot = s.rot; if (s.speed != null) c.speed = s.speed;
      if (s.carry != null) c.carry = s.carry ? 1 : 0; if (s.sit != null) c.sit = s.sit ? 1 : 0;
      if (s.act != null) c.act = s.act; if (s.mood != null) c.mood = s.mood; if (s.exprRow != null) c.exprRow = s.exprRow;
      if (s.look) { c.look = s.look; c.P = prep(s.look); for (const Lr of layers) if (c.slots[Lr.name] != null) writeStatic(Lr, c.slots[Lr.name], c); }
    },
    remove(id?: any) { const c = cits.get(id); if (!c) return; for (const Lr of layers) leave(Lr, c); cits.delete(id); const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); },
    has(id?: any) { return cits.has(id); },
    look(id?: any) { const c = cits.get(id); return c ? c.look : null; },
    headPos(id?: any, out?: any) {
      out = out || new T.Vector3(); const c = cits.get(id); if (!c) return out.set(0, -10, 0);
      const drop = 0.263 * c.sitW;
      return out.set(c.x, (c.y || 0) + (c.P.headTop - drop) * c.P.scale + 0.06, c.z);
    },
    handPos(id?: any, out?: any) {
      out = out || new T.Vector3(); const c = cits.get(id); if (!c) return out.set(0, -10, 0);
      const drop = 0.263 * c.sitW, s = c.P.scale, cs = Math.cos(c.rot), sn = Math.sin(c.rot);
      const lx = c.carryW > 0.5 ? 0 : 0.26, ly = c.carryW > 0.5 ? 1.1 : 0.76, lz = c.carryW > 0.5 ? 0.44 : 0.06;
      return out.set(c.x + (cs * lx + sn * lz) * s, (c.y || 0) + (ly - drop) * s, c.z + (-sn * lx + cs * lz) * s);
    },
    update(dt?: any) {
      dt = Math.min(dt || 0, 0.1);
      uTime.value += dt;
      for (const id of order) {
        const c = cits.get(id), P = c.P;
        c.spd = damp(c.spd, clamp(c.speed, 0, 1), 8, dt);
        c.carryW = damp(c.carryW, c.carry, 10, dt);
        c.sitW = damp(c.sitW, P.sitLock ? 1 : c.sit, 6, dt);
        const run = c.act === 'run' || c.act === 'chase';
        if (c.spd > 0.02) c.phase += dt * P.rate * (0.45 + 0.75 * c.spd) * (run ? 1.45 : 1);
        else if (P.sitLock) c.phase += 0;
        c.walk = c.spd * P.amp * (run ? 1.6 : 1) * (1 - c.sitW * (P.sitLock ? 0 : 1));
        if (P.sitLock) c.walk = c.spd; // wheel push cycle
        // arm holds from look and act
        let hl = P.hl, hr = P.hr, actCode = 0;
        const freeR = hr === 0 || hr === 8 || hr === 16, freeL = hl === 0 || hl === 16 || hl === 17;
        switch (c.act) {
          case 'talk': actCode = 1; if (freeR && c.spd < 0.3) hr = 21; break;
          case 'wave': hr = 19; break;
          case 'cheer': actCode = 2; hl = 20; hr = 20; break;
          case 'dance': actCode = 2; hl = 20; hr = 20; break;
          case 'sleep': actCode = 3; if (freeL) hl = 28; if (freeR) hr = 28; break;
          case 'run': case 'chase': actCode = 4; break;
          case 'eat': case 'drink': actCode = 5; hr = 22; break;
          case 'phone': hr = 7; break;
          case 'selfie': hr = 9; actCode = 2; break;
          case 'photo': hl = 18; hr = 18; break;
          case 'point': hr = 25; break;
          case 'pet': hr = 26; break;
        }
        if (c.sitW > 0.5 && !P.sitLock) { if (hl === 0 || hl === 16) hl = 24; if (hr === 0 || hr === 16) hr = 24; }
        if (c.mood === 'angry' && c.spd < 0.1 && c.act === 'idle' && freeL && freeR && !c.sitW) { hl = 23; hr = 23; }
        c.actCode = actCode; c.hl = hl; c.hr = hr;
        // keep layer membership in sync with act props (eat/drink)
        if (c.act !== c.lastAct) { c.lastAct = c.act; syncMembership(c); }
      }
      const moodN: any = { ok: 0, happy: 1, angry: 2 };
      for (const Lr of layers) {
        const A = Lr.A, M = Lr.mesh.instanceMatrix.array;
        for (let i = 0; i < Lr.n; i++) {
          const c = cits.get(Lr.members[i]), P = c.P, o = i * 4, m = i * 16, s = P.scale;
          const cs = Math.cos(c.rot) * s, sn = Math.sin(c.rot) * s;
          M[m] = cs; M[m + 1] = 0; M[m + 2] = -sn; M[m + 3] = 0; M[m + 4] = 0; M[m + 5] = s; M[m + 6] = 0; M[m + 7] = 0;
          M[m + 8] = sn; M[m + 9] = 0; M[m + 10] = cs; M[m + 11] = 0; M[m + 12] = c.x; M[m + 13] = c.y || 0; M[m + 14] = c.z; M[m + 15] = 1;
          const an = A.iAnim.array; an[o] = c.phase; an[o + 1] = c.walk; an[o + 2] = c.carryW; an[o + 3] = c.sitW;
          const po = A.iPose.array; po[o] = (c.actCode || 0) + 16 * (moodN[c.mood] || 0); po[o + 1] = c.seed; po[o + 2] = c.hl || 0; po[o + 3] = c.hr || 0;
          const ex = A.iExtra.array; ex[o] = P.lean + crowdWeather.lean * Math.min(1, c.spd * 1.5); ex[o + 1] = c.yaw; ex[o + 2] = c.nod; ex[o + 3] = c.exprRow || 0;
          if (Lr.sel) A.iSel.array.set(selFor(Lr, c), o);
        }
        Lr.mesh.count = Lr.n; Lr.mesh.visible = Lr.n > 0;
        Lr.mesh.instanceMatrix.needsUpdate = true; A.iAnim.needsUpdate = A.iPose.needsUpdate = A.iExtra.needsUpdate = true; if (Lr.sel) A.iSel.needsUpdate = true;
      }
      const SM = shadow.instanceMatrix.array; let k = 0;
      for (const id of order) {
        const c = cits.get(id), P = c.P, w = P.wide * P.scale * 1.15, m = k * 16;
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot), lz = P.mob === MB.stroller || P.vend.indexOf(VD.chestnut) >= 0 ? 0.3 : 0;
        SM[m] = cs * w; SM[m + 1] = 0; SM[m + 2] = -sn * w; SM[m + 3] = 0; SM[m + 4] = 0; SM[m + 5] = 1; SM[m + 6] = 0; SM[m + 7] = 0;
        SM[m + 8] = sn * w * (1 + lz * 2); SM[m + 9] = 0; SM[m + 10] = cs * w * (1 + lz * 2); SM[m + 11] = 0;
        SM[m + 12] = c.x + sn * lz * P.scale; SM[m + 13] = (c.y || 0); SM[m + 14] = c.z + cs * lz * P.scale; SM[m + 15] = 1;
        k++;
      }
      shadow.count = k; shadow.visible = k > 0; shadow.instanceMatrix.needsUpdate = true;
    },
    stats() {
      let calls = shadow.visible ? 1 : 0, collapsed = 0, visible = 0;
      for (const Lr of layers) if (Lr.n) { calls++; collapsed += Lr.tris * Lr.n; }
      for (const c of cits.values()) visible += 1000 + (c.P.head[0] ? 120 : 0) + (c.P.head[1] ? 200 : 0) + c.P.props.length * 40 + (c.P.back ? 80 : 0) + (c.P.mob ? 300 : 0) + c.P.vend.length * 150;
      return { citizens: cits.size, drawCalls: calls, trianglesDrawn: collapsed + cits.size * 2, trianglesVisibleApprox: visible, layers: layers.map((l?: any) => ({ name: l.name, n: l.n, trisPerInstance: l.tris })) };
    },
    dispose() { if (group.parent) group.parent.remove(group); layers.forEach((l?: any) => { l.mesh.geometry.dispose(); l.mesh.material.dispose(); }); shadow.dispose && shadow.dispose(); cits.clear(); order.length = 0; }
  };
  return crowd;
};

/* =====================================================================
   ANIMALS: cats and Karamel the dog (one SkinnedMesh each)
   ===================================================================== */
const COATS: any = {
  white: { base: '#f8f6f1', alt: '#ece6dc', eye: '#7fb6e0', nose: '#f2a2b3', belly: '#ffffff', kind: 'plain', fluffy: 1 },
  tabby: { base: '#b9a385', alt: '#6c5843', eye: '#9cc35a', nose: '#d98a7a', belly: '#e8dccb', kind: 'stripes' },
  black: { base: '#2c2729', alt: '#1e1a1c', eye: '#f2c94c', nose: '#3a3235', belly: '#2c2729', kind: 'plain' },
  ginger: { base: '#e59a52', alt: '#c46f2e', eye: '#d9a43a', nose: '#e0857a', belly: '#f8e8d6', kind: 'stripes' },
  calico: { base: '#fbf7f0', alt: '#e59a52', alt2: '#2c2729', eye: '#c9a23a', nose: '#f2a2b3', belly: '#ffffff', kind: 'patches' },
  grey: { base: '#8e9399', alt: '#6c7177', eye: '#e2c24a', nose: '#9a7f84', belly: '#e6e6e6', kind: 'stripes', chest: true }
};
function paintAnimalFace(g?: any, x?: any, y?: any, S?: any, o?: any, expr?: any) {
  g.save(); g.translate(x, y); g.scale(S / 64, S / 64);
  g.fillStyle = o.base; g.fillRect(0, 0, 64, 64);
  if (o.kind === 'stripes') { g.strokeStyle = o.alt; g.lineWidth = 2.2; g.beginPath(); g.moveTo(25, 10); g.lineTo(28, 20); g.moveTo(32, 7); g.lineTo(32, 19); g.moveTo(39, 10); g.lineTo(36, 20); g.stroke(); }
  if (o.kind === 'patches') { g.fillStyle = o.alt; g.beginPath(); g.ellipse(14, 14, 16, 12, 0.4, 0, TAU); g.fill(); g.fillStyle = o.alt2; g.beginPath(); g.ellipse(52, 12, 13, 11, -0.3, 0, TAU); g.fill(); }
  if (o.mask) { g.fillStyle = o.mask; g.beginPath(); g.ellipse(32, 50, 17, 14, 0, 0, TAU); g.fill(); }
  const ey = o.dog ? 26 : 29, ex = o.dog ? 12 : 13;
  [-1, 1].forEach((s?: any) => {
    const cx = 32 + s * ex;
    if (expr === 'closed') { g.strokeStyle = '#2a1c16'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 6, ey + 1); g.quadraticCurveTo(cx, ey - 4, cx + 6, ey + 1); g.stroke(); }
    else {
      g.fillStyle = o.dog ? '#3a2416' : o.eye; g.beginPath(); g.ellipse(cx, ey, o.dog ? 5 : 6.2, o.dog ? 5.5 : 6.8, 0, 0, TAU); g.fill();
      g.fillStyle = '#120c0a'; g.beginPath(); if (o.dog) g.ellipse(cx, ey + 0.5, 3.2, 3.6, 0, 0, TAU); else g.ellipse(cx, ey + 0.5, 1.8, 5.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(cx - 1.8, ey - 2.6, 1.7, 0, TAU); g.fill();
      if (o.dog) { g.fillStyle = 'rgba(80,45,25,0.6)'; g.beginPath(); g.ellipse(cx + s * 1, ey - 8, 3, 1.6, s * 0.3, 0, TAU); g.fill(); }
    }
  });
  if (!o.dog) {
    g.fillStyle = o.nose; g.beginPath(); g.moveTo(28.5, 41); g.lineTo(35.5, 41); g.lineTo(32, 45.5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,35,0.8)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(32, 45.5); g.lineTo(32, 48);
    if (expr === 'meow') { g.stroke(); g.fillStyle = '#7a2f3a'; g.beginPath(); g.ellipse(32, 52, 4.2, 4.8, 0, 0, TAU); g.fill(); g.fillStyle = '#e88a9a'; g.beginPath(); g.ellipse(32, 54, 2.6, 2, 0, 0, TAU); g.fill(); }
    else { g.quadraticCurveTo(29, 51, 26, 48.5); g.moveTo(32, 48); g.quadraticCurveTo(35, 51, 38, 48.5); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.75)'; if (o.base === '#f8f6f1' || o.base === '#fbf7f0') g.strokeStyle = 'rgba(120,110,100,0.5)'; g.lineWidth = 1;
    [-1, 1].forEach((s?: any) => { for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(32 + s * 8, 46 + i * 2); g.lineTo(32 + s * 27, 42 + i * 5); g.stroke(); } });
  } else {
    if (expr === 'meow' || expr === 'happy') { g.fillStyle = '#5a2a2a'; g.beginPath(); g.ellipse(32, 55, 7, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#e8768a'; g.beginPath(); g.ellipse(32, 58, 4.5, 4, 0, 0, TAU); g.fill(); }
    else { g.strokeStyle = 'rgba(60,35,25,0.8)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(26, 54); g.quadraticCurveTo(32, 58, 38, 54); g.stroke(); }
  }
  g.restore();
}
function animalAtlas(o?: any) {
  return C.canvasTex(256, 256, (g?: any) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    // coat region (0,0)-(128,128)
    g.fillStyle = o.base; g.fillRect(0, 0, 128, 128);
    if (o.kind === 'stripes') { g.fillStyle = o.alt; for (let i = 0; i < 128; i += 13) { g.beginPath(); g.moveTo(i, 0); for (let y = 0; y <= 100; y += 10) g.lineTo(i + Math.sin(y * 0.15 + i) * 2.5, y); for (let y = 100; y >= 0; y -= 10) g.lineTo(i + 5 + Math.sin(y * 0.15 + i) * 2.5 - y * 0.02, y); g.fill(); } }
    if (o.kind === 'patches') { const R = C.rng(5); for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? o.alt : o.alt2; g.beginPath(); g.ellipse(R.range(0, 128), R.range(0, 90), R.range(10, 22), R.range(8, 16), R.range(0, 3), 0, TAU); g.fill(); } }
    if (o.fluffy) { const R = C.rng(9); g.strokeStyle = o.alt; g.lineWidth = 1.2; for (let i = 0; i < 90; i++) { const x = R.range(0, 128), y = R.range(0, 128); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R.range(-2, 2), y + 4); g.stroke(); } }
    const gr = g.createLinearGradient(0, 80, 0, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, o.belly); g.fillStyle = gr; g.fillRect(0, 80, 128, 48);
    paintAnimalFace(g, 128, 0, 64, o, 'open'); paintAnimalFace(g, 192, 0, 64, o, 'closed'); paintAnimalFace(g, 128, 64, 64, o, 'meow');
  });
}
const COAT_UV = [0, 0.5, 0.5, 0.5], AW = [0.875, 0.375];
const acell = (e?: any) => e === 0 ? [0.5, 0.75, 0.25, 0.25] : e === 1 ? [0.75, 0.75, 0.25, 0.25] : [0.5, 0.5, 0.25, 0.25];

/* generic skinned animal helper */
function SkinnedAnimal(this: any, geo?: any, bones?: any, list?: any, tex?: any, faceStart?: any, faceEnd?: any) {
  const mat = new T.MeshLambertMaterial({ vertexColors: true, map: tex });
  const mesh = new T.SkinnedMesh(geo, mat);
  mesh.add(bones.root); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(list));
  this.mesh = mesh; this.B = bones; this.uv = geo.attributes.uv; this.face0 = this.uv.array.slice(faceStart * 2, faceEnd * 2); this.fs = faceStart * 2; this.expr = 0;
}
SkinnedAnimal.prototype.setExpr = function (this: any, e?: any) {
  if (e === this.expr) return; this.expr = e;
  const r0 = acell(0), r = acell(e), a = this.uv.array;
  for (let i = 0; i < this.face0.length; i += 2) { a[this.fs + i] = this.face0[i] - r0[0] + r[0]; a[this.fs + i + 1] = this.face0[i + 1] - r0[1] + r[1]; }
  this.uv.needsUpdate = true;
};
function boneKit() {
  const B: any = {}, list: any = [], BI2: any = {};
  const mk = (n?: any, p?: any, x?: any, y?: any, z?: any) => { const b = new T.Bone(); b.name = n; b.position.set(x, y, z); if (p) B[p].add(b); BI2[n] = list.length; B[n] = b; list.push(b); };
  return { B, list, BI2, mk };
}

/* ---------- cat ---------- */
function buildCat(coat?: any, fluffy?: any) {
  const o = COATS[coat] || COATS.white;
  const K = boneKit(), { B, mk, BI2 } = K;
  mk('root', null, 0, 0, 0); mk('hips', 'root', 0, 0.17, -0.09); mk('spine', 'hips', 0, 0.01, 0.17); mk('neck', 'spine', 0, 0.06, 0.07); mk('head', 'neck', 0, 0.04, 0.03);
  mk('fl', 'spine', -0.055, -0.04, 0.03); mk('fr', 'spine', 0.055, -0.04, 0.03); mk('bl', 'hips', -0.055, -0.03, -0.01); mk('br', 'hips', 0.055, -0.03, -0.01);
  mk('t1', 'hips', 0, 0.03, -0.11); mk('t2', 't1', 0, 0, -0.1); mk('t3', 't2', 0, 0, -0.1);
  const b = new (GB as any)({ skinIndex: 4, skinWeight: 4 });
  const on = (bone?: any, opt?: any) => Object.assign({ skinIndex: [BI2[bone], 0, 0, 0], skinWeight: [1, 0, 0, 0] }, opt);
  const fz = fluffy ? 1.08 : 1;
  b.add(sph(0.115, 14, 10), on('hips', { m: mTRS(0, 0.19, -0.07, 0, 0, 0, 1 * fz, 0.95 * fz, 1.2), color: '#ffffff', uvRect: COAT_UV }));
  b.add(sph(0.105, 14, 10), on('spine', { m: mTRS(0, 0.2, 0.08, -0.15, 0, 0, 0.95 * fz, 1.02 * fz, 1.12), color: '#ffffff', uvRect: COAT_UV }));
  if (o.chest || coat === 'ginger') b.add(sph(0.07, 10, 8), on('spine', { m: mTRS(0, 0.19, 0.16, 0, 0, 0, 1, 1.1, 0.7), color: o.belly }));
  // head + face
  const HM = mTRS(0, 0.295, 0.2, 0, 0, 0, 1.1, 0.95, 0.95);
  b.add(sph(0.098, 16, 12), on('head', { m: HM, color: '#ffffff', uvRect: COAT_UV }));
  const fs = b.pos.length / 3;
  b.add(sph(0.0995, 12, 9, PI / 2 - 0.85, 1.7, 0.75, 1.35), on('head', { m: HM, color: '#ffffff', uvRect: acell(0) }));
  const fe = b.pos.length / 3;
  [-1, 1].forEach((s?: any) => {
    b.add(cone(0.042, 0.075, 4), on('head', { m: mTRS(s * 0.06, 0.37, 0.19, -0.1, PI / 4, s * -0.35), color: o.kind === 'patches' ? (s < 0 ? o.alt : o.alt2) : o.base, uv: AW }));
    b.add(cone(0.026, 0.05, 4), on('head', { m: mTRS(s * 0.058, 0.365, 0.205, -0.1, PI / 4, s * -0.35), color: '#f2b3bd', uv: AW }));
    b.add(sph(0.03, 8, 6), on('head', { m: mT(s * 0.022, 0.265, 0.282), color: o.belly, uv: AW }));
  });
  // legs and paws
  [['fl', -1, 0.115], ['fr', 1, 0.115], ['bl', -1, -0.1], ['br', 1, -0.1]].forEach(([n, s, z]: any) => {
    b.add(cap(0.03, 0.09, 2, 7), on(n, { m: mT(s * 0.055, 0.085, z), color: '#ffffff', uvRect: COAT_UV }));
    b.add(sph(0.034, 8, 6), on(n, { m: mTRS(s * 0.055, 0.025, z + 0.015, 0, 0, 0, 1, 0.75, 1.2), color: coat === 'black' ? o.base : o.belly }));
  });
  // tail
  [['t1', -0.25], ['t2', -0.35], ['t3', -0.45]].forEach(([n, z]: any, i?: any) => b.add(cap(0.026 - i * 0.003, 0.08, 2, 7), on(n, { m: mTRS(0, 0.2, z + 0.06, PI / 2, 0, 0), color: i === 2 && coat === 'tabby' ? o.alt : '#ffffff', uvRect: COAT_UV })));
  return { geo: b.build({ skinIndex: 'u16' }), K, fs, fe, o, tris: b.tris() };
}
function Cat(this: any, opts?: any) {
  opts = opts || {};
  const coat = COATS[opts.coat] ? opts.coat : 'white';
  this.name = opts.name || 'Kedi'; this.coat = coat;
  const r = withSeg(SEG.animal, () => buildCat(coat, coat === 'white' || opts.fluffy));
  this.tex = animalAtlas(r.o);
  SkinnedAnimal.call(this, r.geo, r.K.B, r.K.list, this.tex, r.fs, r.fe);
  this.group = new T.Group(); this.group.name = 'cat-' + this.name; this.group.add(this.mesh);
  this.blob = makeBlob(0.5, 0.28); this.blob.scale.set(0.38, 1, 0.6); this.group.add(this.blob);
  this.head = new T.Object3D(); this.B.head.add(this.head); this.head.position.set(0, 0.12, 0.0);
  this.t = vrand() * 10; this.ph = 0; this.P = {}; this.tris = r.tris; this.blinkT = 2;
}
Cat.prototype = Object.create(SkinnedAnimal.prototype);
const CAT_J = ['rootY', 'rootZ', 'hipsX', 'hipsY', 'spX', 'spY', 'nkX', 'nkY', 'hdX', 'hdY', 'hdZ', 'flX', 'frX', 'blX', 'brX', 'flZ', 'frZ', 't1X', 't1Y', 't2X', 't2Y', 't3X', 't3Y', 'sx'];
Cat.prototype.update = function (this: any, dt?: any, s?: any) {
  s = s || {}; dt = Math.min(dt || 0, 0.1); this.t += dt;
  const t = this.t, act = s.act || (s.speed > 0.05 ? 'walk' : 'sit'), v = clamp(s.speed || (act === 'walk' ? 0.6 : act === 'rub' ? 0.25 : 0), 0, 1);
  const P: any = {}; CAT_J.forEach((k?: any) => P[k] = 0); P.sx = 1;
  if (v > 0.02) this.ph += dt * (6 + 8 * v);
  const ph = this.ph, sn = Math.sin(ph);
  // base: standing, tail up-curved
  P.t1X = 0.9; P.t2X = 0.3; P.t3X = -0.35; P.t1Y = 0.15 * Math.sin(t * 1.3); P.t2Y = 0.25 * Math.sin(t * 1.3 - 0.8); P.t3Y = 0.3 * Math.sin(t * 1.3 - 1.6);
  P.hdY = 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.23); P.hdX = -0.05;
  let expr = 0;
  if (act === 'walk' || act === 'rub') {
    const A = 0.55 * Math.max(v, 0.3);
    P.flX = A * sn; P.brX = A * sn; P.frX = -A * sn; P.blX = -A * sn; P.rootY = 0.01 * Math.abs(Math.cos(ph));
    P.spY = 0.06 * sn; P.t1Y += 0.2 * Math.sin(ph * 0.5);
    if (act === 'rub') { P.rootZ = 0.28 + 0.06 * Math.sin(t * 3); P.hdZ = 0.45; P.hdY = 0.35; P.t1X = 1.35; P.t2X = 0.2; P.t3X = -0.9; expr = 1; }
  } else if (act === 'sit' || act === 'purr' || act === 'meow') {
    P.hipsX = -0.7; P.rootY = -0.035; P.blX = -0.9; P.brX = -0.9; P.flX = 0.62; P.frX = 0.62; P.nkX = 0.35; P.hdX = 0.12 + P.hdX;
    P.t1X = -0.6; P.t2X = 0.3; P.t3X = 0.3; P.t1Y = 0.6; P.t2Y = 0.5 + 0.15 * Math.sin(t * 0.8); P.t3Y = 0.5 + 0.3 * Math.sin(t * 0.8 - 0.6);
    if (act === 'purr') { expr = 1; P.hdZ = 0.15; P.hdX += 0.08; P.sx = 1 + 0.012 * Math.sin(t * 40); }
    if (act === 'meow') { const m = Math.max(0, Math.sin(t * 2.6)); P.hdX -= 0.35 * m; P.nkX -= 0.2 * m; expr = m > 0.3 ? 2 : 0; }
  } else if (act === 'sleep') { // sphinx loaf, head down
    P.rootY = -0.075; P.flX = -1.35; P.frX = -1.35; P.blX = 1.45; P.brX = 1.45; P.nkX = 0.3; P.hdX = 0.35; P.hdY = 0.25; P.hdZ = 0.2;
    P.t1X = -0.25; P.t1Y = 0.9; P.t2Y = 0.9; P.t3Y = 0.6; P.t2X = 0; P.t3X = 0; P.sx = 1 + 0.02 * Math.sin(t * 1.8); expr = 1;
  } else if (act === 'curl') { // curled up like a cinnamon roll
    P.rootY = -0.085; P.hipsY = 0.55; P.spY = 0.7; P.flX = -1.4; P.frX = -1.4; P.blX = 1.5; P.brX = 1.5; P.nkX = 0.4; P.nkY = 0.7; P.hdX = 0.4; P.hdY = 0.6; P.hdZ = 0.5;
    P.t1X = -0.3; P.t1Y = -1.2; P.t2Y = -1.0; P.t3Y = -0.9; P.t2X = 0; P.t3X = 0; P.sx = 1 + 0.02 * Math.sin(t * 1.6); expr = 1;
  }
  this.blinkT -= dt; if (this.blinkT < 0) { this.blinkT = 2.5 + vrand() * 3; this.blinkOn = 0.14; }
  if (this.blinkOn > 0) { this.blinkOn -= dt; if (expr === 0) expr = 1; }
  const k = 1 - Math.exp(-dt * 9), J = this.P;
  CAT_J.forEach((key?: any) => { J[key] = J[key] == null ? P[key] : J[key] + (P[key] - J[key]) * k; });
  const B = this.B;
  B.root.position.y = J.rootY; B.root.rotation.z = J.rootZ;
  B.hips.rotation.set(J.hipsX, J.hipsY, 0); B.hips.scale.set(J.sx, J.sx, 1);
  B.spine.rotation.set(J.spX - J.hipsX * 0.35, J.spY, 0);
  B.neck.rotation.set(J.nkX, J.nkY, 0); B.head.rotation.set(J.hdX, J.hdY, J.hdZ);
  B.fl.rotation.set(J.flX + J.hipsX * -0.3, 0, 0); B.fr.rotation.set(J.frX + J.hipsX * -0.3, 0, 0); B.bl.rotation.x = J.blX; B.br.rotation.x = J.brX;
  B.t1.rotation.set(J.t1X, J.t1Y, 0); B.t2.rotation.set(J.t2X, J.t2Y, 0); B.t3.rotation.set(J.t3X, J.t3Y, 0);
  this.setExpr(expr);
};
Cat.prototype.dispose = function (this: any) { if (this.group.parent) this.group.parent.remove(this.group); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.tex.dispose(); };
CH.makeCat = function (opts?: any) { try { return new (Cat as any)(opts); } catch (e) { console.error('[chars] makeCat', e); const group = new T.Group(); group.add(C.mesh(sph(0.15, 10, 8), '#f8f6f1')); return { group, update() {}, dispose() {} }; } };
CH.COATS = Object.keys(COATS);

/* ---------- Karamel: friendly street dog with a yellow ear tag ---------- */
function buildDog() {
  const o: any = { base: '#c98a4b', alt: '#a86c34', belly: '#f3dfc0', kind: 'plain', dog: true, mask: '#f0d6b0' };
  const K = boneKit(), { mk, BI2 } = K;
  mk('root', null, 0, 0, 0); mk('hips', 'root', 0, 0.36, -0.15); mk('spine', 'hips', 0, 0.02, 0.27); mk('neck', 'spine', 0, 0.08, 0.1); mk('head', 'neck', 0, 0.08, 0.05); mk('jaw', 'head', 0, -0.03, 0.12);
  mk('earL', 'head', -0.085, 0.07, 0.0); mk('earR', 'head', 0.085, 0.07, 0.0);
  mk('fl', 'spine', -0.08, -0.08, 0.04); mk('fr', 'spine', 0.08, -0.08, 0.04); mk('bl', 'hips', -0.08, -0.06, -0.02); mk('br', 'hips', 0.08, -0.06, -0.02);
  mk('t1', 'hips', 0, 0.05, -0.15); mk('t2', 't1', 0, 0, -0.12);
  const b = new (GB as any)({ skinIndex: 4, skinWeight: 4 });
  const on = (bone?: any, opt?: any) => Object.assign({ skinIndex: [BI2[bone], 0, 0, 0], skinWeight: [1, 0, 0, 0] }, opt);
  b.add(sph(0.16, 14, 10), on('hips', { m: mTRS(0, 0.4, -0.13, 0, 0, 0, 0.92, 0.9, 1.15), color: '#ffffff', uvRect: COAT_UV }));
  b.add(sph(0.16, 14, 10), on('spine', { m: mTRS(0, 0.41, 0.1, -0.1, 0, 0, 0.95, 1.0, 1.12), color: '#ffffff', uvRect: COAT_UV }));
  b.add(sph(0.1, 10, 8), on('spine', { m: mTRS(0, 0.38, 0.22, 0, 0, 0, 1, 1.15, 0.7), color: o.belly }));
  b.add(tor(0.085, 0.016, 5, 14), on('neck', { m: mTRS(0, 0.5, 0.25, PI / 2 - 0.5, 0, 0), color: '#3f6fd8' }));
  const HM = mTRS(0, 0.6, 0.3, 0, 0, 0, 1.05, 0.95, 1.0);
  b.add(sph(0.12, 16, 12), on('head', { m: HM, color: '#ffffff', uvRect: COAT_UV }));
  const fs = b.pos.length / 3;
  b.add(sph(0.1215, 12, 9, PI / 2 - 0.85, 1.7, 0.7, 1.35), on('head', { m: HM, color: '#ffffff', uvRect: acell(0) }));
  const fe = b.pos.length / 3;
  b.add(rbox(0.13, 0.085, 0.14, 0.04, 2), on('head', { m: mT(0, 0.565, 0.43), color: o.mask }));
  b.add(sph(0.032, 8, 6), on('head', { m: mTRS(0, 0.6, 0.5, 0, 0, 0, 1.2, 0.9, 1), color: '#2a2226' }));
  b.add(rbox(0.11, 0.035, 0.12, 0.015, 1), on('jaw', { m: mT(0, 0.525, 0.42), color: o.mask }));
  [-1, 1].forEach((s?: any) => {
    b.add(sph(0.065, 9, 7), on(s < 0 ? 'earL' : 'earR', { m: mTRS(s * 0.11, 0.6, 0.29, 0, 0, s * 0.3, 0.45, 1.15, 0.8), color: o.alt }));
    if (s < 0) { b.add(rbox(0.035, 0.03, 0.012, 0.006, 1), on('earL', { m: mTRS(-0.135, 0.62, 0.33, 0, 0.2, 0.3), color: '#ffd23f' })); }
  });
  [['fl', -1, 0.12], ['fr', 1, 0.12], ['bl', -1, -0.17], ['br', 1, -0.17]].forEach(([n, s, z]: any) => {
    b.add(cap(0.045, 0.22, 2, 8), on(n, { m: mT(s * 0.08, 0.17, z), color: '#ffffff', uvRect: COAT_UV }));
    b.add(sph(0.05, 8, 6), on(n, { m: mTRS(s * 0.08, 0.035, z + 0.02, 0, 0, 0, 1, 0.7, 1.25), color: o.belly }));
  });
  b.add(cap(0.035, 0.11, 2, 7), on('t1', { m: mTRS(0, 0.41, -0.35, PI / 2, 0, 0), color: '#ffffff', uvRect: COAT_UV }));
  b.add(cap(0.03, 0.1, 2, 7), on('t2', { m: mTRS(0, 0.41, -0.47, PI / 2, 0, 0), color: o.belly }));
  return { geo: b.build({ skinIndex: 'u16' }), K, fs, fe, o, tris: b.tris() };
}
function Dog(this: any, opts?: any) {
  opts = opts || {}; this.name = opts.name || 'Karamel';
  const r = withSeg(SEG.animal, buildDog); this.tex = animalAtlas(r.o);
  SkinnedAnimal.call(this, r.geo, r.K.B, r.K.list, this.tex, r.fs, r.fe);
  this.group = new T.Group(); this.group.name = 'dog-' + this.name; this.group.add(this.mesh);
  this.blob = makeBlob(0.8, 0.3); this.blob.scale.set(0.55, 1, 0.95); this.group.add(this.blob);
  this.head = new T.Object3D(); this.B.head.add(this.head); this.head.position.set(0, 0.2, 0);
  this.t = vrand() * 10; this.ph = 0; this.P = {}; this.tris = r.tris; this.blinkT = 2;
}
Dog.prototype = Object.create(SkinnedAnimal.prototype);
const DOG_J = ['rootY', 'hipsX', 'spX', 'nkX', 'hdX', 'hdY', 'hdZ', 'jaw', 'eL', 'eR', 'flX', 'frX', 'blX', 'brX', 't1X', 't1Y', 't2X', 'sx'];
Dog.prototype.update = function (this: any, dt?: any, s?: any) {
  s = s || {}; dt = Math.min(dt || 0, 0.1); this.t += dt;
  const t = this.t, act = s.act || (s.speed > 0.05 ? 'walk' : 'sit'), v = clamp(s.speed || (act === 'walk' ? 0.6 : 0), 0, 1);
  const P: any = {}; DOG_J.forEach((k?: any) => P[k] = 0); P.sx = 1;
  if (v > 0.02) this.ph += dt * (5 + 9 * v);
  const ph = this.ph, sn = Math.sin(ph);
  P.t1X = 0.7; P.t2X = 0.2; P.t1Y = 0.2 * Math.sin(t * 2); P.hdY = 0.3 * Math.sin(t * 0.31) * Math.sin(t * 0.17); P.eL = 0.1; P.eR = -0.1;
  let expr = 0;
  if (act === 'walk' || act === 'wag' && v > 0.05) { const A = 0.5 * Math.max(v, 0.3); P.flX = A * sn; P.brX = A * sn; P.frX = -A * sn; P.blX = -A * sn; P.rootY = 0.012 * Math.abs(Math.cos(ph)); P.eL = 0.1 + 0.15 * Math.abs(sn); P.eR = -P.eL; }
  if (act === 'sit') { P.hipsX = -0.6; P.rootY = -0.07; P.blX = -0.95; P.brX = -0.95; P.flX = 0.55; P.frX = 0.55; P.nkX = 0.15; P.t1X = 0; P.t1Y = 0.6 + 0.3 * Math.sin(t * 3); }
  if (act === 'sleep') { P.rootY = -0.2; P.flX = -1.45; P.frX = -1.45; P.blX = 1.5; P.brX = 1.5; P.nkX = 0.55; P.hdX = 0.25; P.hdY = 0.3; P.t1X = -0.3; P.t1Y = 0.8; P.sx = 1 + 0.025 * Math.sin(t * 1.5); expr = 1; P.eL = 0.25; P.eR = -0.25; }
  if (act === 'wag') { P.t1X = 1.0; P.t1Y = 0.75 * Math.sin(t * 16); P.t2X = 0.1; P.hdZ = 0.15 * Math.sin(t * 2); expr = 2; P.jaw = 0.2; if (!(v > 0.05)) { P.hipsX = -0.2; P.rootY = -0.02; P.blX = -0.3; P.brX = -0.3; } }
  if (act === 'bark') { const bk = Math.max(0, Math.sin(t * 7)); P.hdX = -0.25 * bk; P.nkX = -0.15 * bk; P.jaw = 0.45 * bk; P.flX = -0.1; P.frX = -0.1; P.t1X = 1.1; P.t1Y = 0.4 * Math.sin(t * 14); expr = bk > 0.4 ? 2 : 0; P.eL = 0.35; P.eR = -0.35; }
  this.blinkT -= dt; if (this.blinkT < 0) { this.blinkT = 2.5 + vrand() * 3; this.blinkOn = 0.14; }
  if (this.blinkOn > 0) { this.blinkOn -= dt; if (expr === 0) expr = 1; }
  const k = 1 - Math.exp(-dt * 10), J = this.P;
  DOG_J.forEach((key?: any) => { J[key] = J[key] == null ? P[key] : J[key] + (P[key] - J[key]) * k; });
  const B = this.B;
  B.root.position.y = J.rootY; B.hips.rotation.x = J.hipsX; B.hips.scale.set(J.sx, J.sx, 1); B.spine.rotation.x = J.spX - J.hipsX * 0.3;
  B.neck.rotation.x = J.nkX - J.hipsX * 0.5; B.head.rotation.set(J.hdX, J.hdY, J.hdZ); B.jaw.rotation.x = J.jaw;
  B.earL.rotation.z = J.eL; B.earR.rotation.z = J.eR;
  B.fl.rotation.x = J.flX - J.hipsX * 0.2; B.fr.rotation.x = J.frX - J.hipsX * 0.2; B.bl.rotation.x = J.blX; B.br.rotation.x = J.brX;
  B.t1.rotation.set(J.t1X, J.t1Y, 0); B.t2.rotation.x = J.t2X;
  this.setExpr(expr);
};
Dog.prototype.dispose = Cat.prototype.dispose;
CH.makeDog = function (opts?: any) { try { return new (Dog as any)(opts); } catch (e) { console.error('[chars] makeDog', e); const group = new T.Group(); group.add(C.mesh(sph(0.25, 10, 8), '#c98a4b')); return { group, update() {}, dispose() {} }; } };

/* =====================================================================
   GULLS: realistic yellow-legged gull (Larus michahellis), one SkinnedMesh each
   ===================================================================== */
const GULL_KIND: any = {
  adult: { white: '#fbfbf8', mantle: '#a3acb5', bill: '#f5c21b', spot: '#e0302a', legs: '#f2c230', iris: '#f3e6a0', tex: 'adult', scale: 1 },
  young: { white: '#ffffff', mantle: '#ffffff', bill: '#3a3330', spot: '#3a3330', legs: '#c9a9a0', iris: '#3a2e28', tex: 'young', scale: 0.97 },
  reis: { white: '#fbfbf8', mantle: '#97a1ab', bill: '#f5c21b', spot: '#e0302a', legs: '#f2c230', iris: '#f3e6a0', tex: 'adult', scale: 1.16, chain: true },
  lokum: { white: '#7cc4f2', mantle: '#f2f8ff', bill: '#f0b640', spot: '#f0b640', legs: '#e8a8a0', iris: '#ffffff', tex: 'lokum', scale: 0.4 },
  gold: { white: '#ffe9a8', mantle: '#f2c040', bill: '#ffb81c', spot: '#e0602a', legs: '#ffc93a', iris: '#fff2b0', tex: 'gold', scale: 1, glow: true }
};
const gullTexCache: any = {};
function gullTex(kind?: any) {
  if (gullTexCache[kind]) return gullTexCache[kind];
  return (gullTexCache[kind] = C.canvasTex(256, 256, (g?: any) => {
    const R = C.rng(kind === 'young' ? 77 : 11);
    const grey = kind === 'lokum' ? '#5aa9e6' : kind === 'gold' ? '#f2c040' : kind === 'young' ? '#a88d74' : '#a3acb5';
    const black = kind === 'lokum' ? '#1f3d6e' : kind === 'gold' ? '#c8861a' : kind === 'young' ? '#3a2f28' : '#1f1f24';
    const white = kind === 'gold' ? '#fff3c4' : kind === 'young' ? '#e8dcca' : '#ffffff';
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    // inner wing, top (0,0)-(128,64): leading edge at the top row, trailing edge at the bottom
    g.fillStyle = grey; g.fillRect(0, 0, 128, 64);
    g.fillStyle = white; g.fillRect(0, 52, 128, 12);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, 128, 7);
    // outer wing, top (128,0)-(256,64): grey base, black tip with white mirrors, feather notches
    g.fillStyle = grey; g.fillRect(128, 0, 128, 64);
    g.fillStyle = black; g.beginPath(); g.moveTo(178, 0); for (let i = 0; i <= 6; i++) g.lineTo(172 + i * 2 - (i % 2) * 7, i * 10.5); g.lineTo(256, 64); g.lineTo(256, 0); g.closePath(); g.fill();
    g.fillStyle = white; g.beginPath(); g.ellipse(236, 30, 9, 11, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(214, 36, 5, 6, 0, 0, TAU); g.fill();
    g.fillRect(250, 20, 6, 30);
    g.fillStyle = white; for (let i = 0; i < 4; i++) g.fillRect(132 + i * 10, 58, 6, 6);
    // undersides
    g.fillStyle = kind === 'young' ? '#cdb9a2' : kind === 'gold' ? '#ffe08a' : '#eef0f2'; g.fillRect(0, 64, 256, 64);
    g.fillStyle = kind === 'young' ? '#5a4a3e' : kind === 'gold' ? '#d9a22c' : '#3a3a40'; g.fillRect(222, 64, 34, 64);
    g.fillStyle = white; g.beginPath(); g.ellipse(238, 94, 7, 9, 0, 0, TAU); g.fill();
    // body region (0,128)-(128,256)
    g.fillStyle = kind === 'young' ? '#d8c6ae' : kind === 'gold' ? '#ffe39a' : '#ffffff'; g.fillRect(0, 128, 128, 128);
    if (kind === 'young') {
      for (let i = 0; i < 520; i++) { g.fillStyle = R.chance(0.6) ? 'rgba(95,72,55,0.55)' : 'rgba(250,240,225,0.6)'; g.beginPath(); g.ellipse(R.range(0, 128), R.range(128, 256), R.range(1.5, 3.5), R.range(1, 2.2), R.range(0, 3), 0, TAU); g.fill(); }
      for (let i = 0; i < 260; i++) { g.fillStyle = R.chance(0.5) ? 'rgba(80,60,45,0.5)' : 'rgba(240,228,210,0.55)'; g.beginPath(); g.ellipse(R.range(0, 256), R.range(0, 128), R.range(2, 5), R.range(1, 2.5), 0, 0, TAU); g.fill(); }
    }
    if (kind === 'gold') { for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,230,0.6)'; g.beginPath(); g.arc(R.range(0, 256), R.range(0, 256), R.range(0.6, 1.8), 0, TAU); g.fill(); } }
  }));
}
const GU: any = { innerTop: [0, 0.75, 0.5, 0.25], outerTop: [0.5, 0.75, 0.5, 0.25], innerBot: [0, 0.5, 0.5, 0.25], outerBot: [0.5, 0.5, 0.5, 0.25], body: [0, 0, 0.5, 0.5], white: [0.75, 0.25] };
/* tapered wing panel, span along +x from x0, leading edge at +z */
function wingPanel(x0?: any, len?: any, c0?: any, c1?: any, l0?: any, l1?: any, t0?: any, t1?: any, top?: any, bot?: any, taper?: any, segX?: any) {
  const g = new T.BoxGeometry(1, 1, 1, segX || 5, 1, 2), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const t = p.getX(i) + 0.5, zz = p.getZ(i) + 0.5, yy = p.getY(i);
    const tt = taper ? Math.pow(t, 1.5) : t;
    const c = lerp(c0, c1, tt), lead = lerp(l0, l1, t * t), th = lerp(t0, t1, t);
    p.setXYZ(i, x0 + t * len, yy * th + 0.012 * (1 - Math.pow(2 * zz - 1, 2)) * (1 - t * 0.5), lead - (1 - zz) * c);
    const ny = n.getY(i), rect = ny < -0.5 ? bot : top;
    uv.setXY(i, rect[0] + t * rect[2], rect[1] + zz * rect[3]);
  }
  g.computeVertexNormals();
  return g;
}
function buildGull(kind?: any) {
  const o = GULL_KIND[kind] || GULL_KIND.adult;
  const K = boneKit(), { mk, BI2 } = K;
  mk('root', null, 0, 0, 0); mk('body', 'root', 0, 0.26, 0); mk('neck', 'body', 0, 0.05, 0.1); mk('head', 'neck', 0, 0.07, 0.05); mk('jaw', 'head', 0, 0.01, 0.07);
  mk('tail', 'body', 0, 0.01, -0.19); mk('legL', 'body', -0.045, -0.06, 0); mk('legR', 'body', 0.045, -0.06, 0);
  mk('wL1', 'body', -0.075, 0.05, 0.04); mk('wL2', 'wL1', -0.27, 0, 0); mk('wR1', 'body', 0.075, 0.05, 0.04); mk('wR2', 'wR1', 0.27, 0, 0);
  const b = new (GB as any)({ skinIndex: 4, skinWeight: 4 });
  const on = (bone?: any, opt?: any) => Object.assign({ skinIndex: [BI2[bone], 0, 0, 0], skinWeight: [1, 0, 0, 0] }, opt);
  const bodyUV = (v?: any, u?: any, w?: any) => [GU.body[0] + u * GU.body[2], GU.body[1] + w * GU.body[3]];
  b.add(sph(0.13, 12, 8), on('body', { m: mTRS(0, 0.26, -0.03, 0.06, 0, 0, 0.92, 0.84, 1.85), color: (v?: any) => (v.y > 0.315 && Math.abs(v.x) < 0.085 && v.z < 0.12) ? o.mantle : o.white, uvFn: bodyUV }));
  b.add(sph(0.088, 9, 6), on('neck', { m: mTRS(0, 0.335, 0.125, 0, 0, 0, 0.95, 1.05, 1), color: o.white, uvFn: bodyUV }));
  b.add(sph(0.07, 11, 8), on('head', { m: mTRS(0, 0.408, 0.17, -0.15, 0, 0, 0.9, 0.92, 1.18), color: o.white, uvFn: bodyUV }));
  // bill: upper on head, lower on jaw with the red gonys spot
  b.add(cyl(0.011, 0.02, 0.115, 6), on('head', { m: mTRS(0, 0.405, 0.272, PI / 2 + 0.08, 0, 0, 1, 1, 0.75), color: o.bill, uv: GU.white }));
  b.add(sph(0.0135, 6, 4), on('head', { m: mT(0, 0.398, 0.329), color: o.bill, uv: GU.white }));
  b.add(cyl(0.008, 0.016, 0.1, 6), on('jaw', { m: mTRS(0, 0.388, 0.27, PI / 2 - 0.05, 0, 0, 1, 1, 0.7), color: o.bill, uv: GU.white }));
  b.add(sph(0.0115, 5, 3), on('jaw', { m: mT(0, 0.386, 0.305), color: o.spot, uv: GU.white }));
  [-1, 1].forEach((s?: any) => {
    b.add(sph(0.0135, 6, 4), on('head', { m: mT(s * 0.05, 0.425, 0.205), color: o.iris, uv: GU.white }));
    b.add(sph(0.0072, 5, 3), on('head', { m: mT(s * 0.0605, 0.426, 0.211), color: '#141414', uv: GU.white }));
    b.add(sph(0.0165, 6, 3), on('head', { m: mTRS(s * 0.047, 0.425, 0.203, 0, s * PI / 2.2, 0, 1, 1, 0.45), color: kind === 'young' ? '#5a4a40' : '#d8433a', uv: GU.white }));
  });
  // tail
  const tg = new T.BoxGeometry(1, 1, 1, 2, 1, 2), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const z = tp.getZ(i) + 0.5, w = lerp(0.12, 0.08, z); tp.setXYZ(i, tp.getX(i) * w, tp.getY(i) * 0.022, -0.17 - (1 - z) * 0.17); }
  tg.computeVertexNormals();
  b.add(tg, on('tail', { m: mTRS(0, 0.275, 0, 0, 0, 0), color: (v?: any) => (kind === 'young' && v.z < -0.3) ? '#3a2f28' : o.white, uvFn: bodyUV }));
  // legs + webbed feet
  [-1, 1].forEach((s?: any) => {
    const bn = s < 0 ? 'legL' : 'legR';
    b.add(cyl(0.012, 0.011, 0.19, 5, true), on(bn, { m: mT(s * 0.045, 0.11, 0.0), color: o.legs, uv: GU.white }));
    b.add(cyl(0.05, 0.05, 0.008, 3), on(bn, { m: mTRS(s * 0.045, 0.012, 0.035, 0, PI / 6 + PI / 2, 0, 1, 1, 1.0).premultiply(mT(0, 0, 0)), color: o.legs, uv: GU.white }));
  });
  // wings (right built in place, left mirrored)
  const inner = wingPanel(0.075, 0.27, 0.2, 0.17, 0.12, 0.11, 0.03, 0.018, GU.innerTop, GU.innerBot, false, 3);
  const outer = wingPanel(0.345, 0.36, 0.17, 0.03, 0.11, -0.06, 0.018, 0.006, GU.outerTop, GU.outerBot, true);
  const wM = mT(0, 0.31, 0);
  b.add(inner, on('wR1', { m: wM, color: '#ffffff' })); b.add(outer, on('wR2', { m: wM, color: '#ffffff' }));
  const mir = new T.Matrix4().makeScale(-1, 1, 1).premultiply(wM);
  b.add(inner, on('wL1', { m: mir, color: '#ffffff' })); b.add(outer, on('wL2', { m: mir, color: '#ffffff' }));
  if (o.chain) {
    b.add(tor(0.07, 0.009, 3, 12), on('neck', { m: mTRS(0, 0.315, 0.135, PI / 2 + 0.6, 0, 0, 1, 1, 1), color: '#f2b632', uv: GU.white }));
    b.add(cyl(0.02, 0.02, 0.008, 8), on('neck', { m: mTRS(0, 0.272, 0.195, PI / 2 - 0.5, 0, 0), color: '#ffd76a', uv: GU.white }));
  }
  return { geo: b.build({ skinIndex: 'u16' }), K, tris: b.tris() };
}
const QX = new T.Vector3(1, 0, 0), QY = new T.Vector3(0, 1, 0), QZ = new T.Vector3(0, 0, 1);
const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion();
const FOLD1 = (side?: any) => new T.Quaternion().setFromAxisAngle(QY, side * (PI / 2 + 0.16)).multiply(new T.Quaternion().setFromAxisAngle(QX, PI / 2 + 0.12)).premultiply(new T.Quaternion().setFromAxisAngle(QX, -0.08));
const FOLD1Q: any = { '-1': FOLD1(-1), '1': FOLD1(1) };
const FOLD2Q: any = { '-1': new T.Quaternion().setFromAxisAngle(QY, 0.06), '1': new T.Quaternion().setFromAxisAngle(QY, -0.06) };
const GJ = ['fold', 'flap', 'freq', 'dihed', 'wristZ', 'wristY', 'bodyX', 'bodyZ', 'nkX', 'hdX', 'hdY', 'hdZ', 'jaw', 'legX', 'legL', 'legR', 'tailFan', 'tailX', 'rootY'];
function Gull(this: any, opts?: any) {
  opts = opts || {};
  this.kind = GULL_KIND[opts.kind] ? opts.kind : 'adult';
  const o = GULL_KIND[this.kind], r = withSeg(SEG.gull, () => buildGull(this.kind));
  const mat = new T.MeshLambertMaterial({ vertexColors: true, map: gullTex(o.tex) });
  if (o.glow) { mat.emissive = new T.Color('#b07a10'); mat.emissiveIntensity = 0.6; }
  this.mat = mat;
  const mesh = new T.SkinnedMesh(r.geo, mat); mesh.add(r.K.B.root); mesh.castShadow = true; mesh.receiveShadow = false; mesh.frustumCulled = false;
  mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(r.K.list));
  this.mesh = mesh; this.B = r.K.B; this.tris = r.tris;
  this.group = new T.Group(); this.group.name = 'gull-' + this.kind;
  this.rig = new T.Group(); this.rig.scale.setScalar(o.scale); this.rig.add(mesh); this.group.add(this.rig);
  this.blob = makeBlob(0.5, 0.22); this.blob.scale.set(0.32, 1, 0.5); this.group.add(this.blob);
  this.beak = new T.Object3D(); this.beak.name = 'beak'; this.B.head.add(this.beak); this.beak.position.set(0, 0.012, 0.19);
  this.t = vrand() * 10; this.wph = vrand() * 6; this.wph2 = 0; this.J = {}; this.lastYaw = null; this.bank = 0; this.mode = 'stand'; this.modeT = 0;
  if (o.glow) {
    const n = 14, pos = new Float32Array(n * 3);
    const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const st = C.canvasTex(32, 32, (g?: any) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 15); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,215,90,0.9)'); gr.addColorStop(1, 'rgba(255,200,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    this.spark = new T.Points(pg, new T.PointsMaterial({ map: st, size: 0.09, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: '#ffe9a0' }));
    this.spark.frustumCulled = false; this.group.add(this.spark); this.sparkData = Array.from({ length: n }, () => ({ a: vrand() * 6, r: 0.2 + vrand() * 0.4, y: vrand() * 0.6, v: 0.2 + vrand() * 0.4 }));
  }
}
Gull.prototype.update = function (this: any, dt?: any, s?: any) {
  s = s || {}; dt = Math.min(dt || 0, 0.1); this.t += dt;
  const t = this.t, mode = s.mode || 'stand', v = clamp(s.speed == null ? 0.5 : s.speed, 0, 1);
  if (mode !== this.mode) { this.mode = mode; this.modeT = 0; } this.modeT += dt;
  const P: any = {}; GJ.forEach((k?: any) => P[k] = 0);
  P.fold = 1; P.freq = 2.6; P.hdY = 0.35 * Math.sin(t * 0.6) * Math.sin(t * 0.21 + 2); P.hdX = -0.05; P.bodyX = -0.08; P.tailFan = 1;
  switch (mode) {
    case 'walk': { this.wph2 += dt * (7 + 6 * v); const w = this.wph2; P.legL = 0.5 * Math.sin(w); P.legR = -0.5 * Math.sin(w); P.bodyZ = 0.09 * Math.sin(w); P.nkX = 0.12 + 0.14 * Math.sin(2 * w); P.hdX = -0.12 * Math.sin(2 * w); P.rootY = 0.008 * Math.abs(Math.cos(w)); break; }
    case 'stare': P.hdZ = 0.55 + 0.04 * Math.sin(t * 5); P.hdY = 0.25 + (Math.sin(t * 0.8) > 0.6 ? 0.12 : 0); P.nkX = 0.2; P.bodyX = 0.04; P.hdX = 0.05; break;
    case 'scream': { const cyc = (t % 2.6) < 1.5, pulse = cyc ? Math.max(0, Math.sin(t * 10)) : 0;
      P.fold = 0.72; P.dihed = -0.15; P.bodyX = -0.38 - 0.06 * pulse; P.nkX = -0.85 - 0.1 * pulse; P.hdX = -0.75 - 0.15 * pulse; P.jaw = cyc ? 0.25 + 0.35 * pulse : 0.02; P.hdY = 0; P.tailX = 0.25; break; }
    case 'takeoff': P.fold = 0; P.flap = 1.05; P.freq = 4.4; P.bodyX = -0.45; P.legX = -0.35; P.tailFan = 1.35; P.tailX = -0.2; P.hdY = 0; break;
    case 'fly': P.fold = 0; P.flap = 0.62; P.freq = 2.6; P.bodyX = 0.04; P.legX = 1.35; P.hdY = 0.1 * Math.sin(t * 0.7); break;
    case 'glide': P.fold = 0; P.flap = 0.05; P.freq = 1.2; P.dihed = 0.16; P.wristZ = -0.38; P.wristY = 0.28; P.bodyX = 0.05; P.legX = 1.35; P.hdY = 0.15 * Math.sin(t * 0.5); break;
    case 'land': P.fold = 0; P.flap = 0.5; P.freq = 3.2; P.dihed = 0.65; P.bodyX = -0.7; P.legX = -0.85; P.tailFan = 1.6; P.tailX = -0.45; P.hdX = 0.45; P.hdY = 0; break;
    case 'snatch': { const k = (this.modeT % 1.1) / 1.1, d = k < 0.3 ? sstep(0, 0.3, k) : 1 - sstep(0.45, 1, k);
      P.fold = 0.45; P.dihed = 0.2; P.nkX = 0.95 * d; P.hdX = 0.45 * d; P.jaw = k < 0.25 ? 0.45 : 0.04; P.bodyX = 0.3 * d; P.legL = -0.2 * d; P.legR = -0.2 * d; P.hdY = 0; break; }
  }
  // banking from heading changes in flight
  const yaw = this.group.rotation.y;
  if (this.lastYaw != null && dt > 0) { let d = yaw - this.lastYaw; while (d > PI) d -= TAU; while (d < -PI) d += TAU; this.bank = damp(this.bank, clamp(-d / dt * 0.35, -0.7, 0.7), 4, dt); }
  this.lastYaw = yaw;
  const k = 1 - Math.exp(-dt * 8), J = this.J;
  GJ.forEach((key?: any) => { J[key] = J[key] == null ? P[key] : J[key] + (P[key] - J[key]) * k; });
  this.wph += dt * TAU * J.freq;
  const B = this.B, flapA = J.flap * Math.sin(this.wph), wristFlex = -0.45 * J.flap * Math.cos(this.wph);
  B.root.position.y = J.rootY;
  B.body.rotation.set(J.bodyX, 0, J.bodyZ + (J.fold < 0.5 ? this.bank : 0));
  B.neck.rotation.x = J.nkX; B.head.rotation.set(J.hdX, J.hdY, J.hdZ); B.jaw.rotation.x = J.jaw;
  B.tail.rotation.x = J.tailX; B.tail.scale.set(J.tailFan, 1, 1);
  B.legL.rotation.x = J.legX + J.legL; B.legR.rotation.x = J.legX + J.legR;
  const f = J.fold;
  [-1, 1].forEach((side?: any) => {
    const w1 = side < 0 ? B.wL1 : B.wR1, w2 = side < 0 ? B.wL2 : B.wR2;
    _q1.setFromAxisAngle(QZ, side * (J.dihed + flapA));
    w1.quaternion.copy(_q1).slerp(FOLD1Q[side], f);
    w1.scale.set(lerp(1, 0.42, f), 1, lerp(1, 0.62, f));
    w1.position.set(side * lerp(0.075, 0.112, f), lerp(0.05, 0.035, f), lerp(0.04, 0.06, f));
    _q2.setFromAxisAngle(QZ, side * (J.wristZ + wristFlex)); _q3.setFromAxisAngle(QY, -side * J.wristY); _q2.multiply(_q3);
    w2.quaternion.copy(_q2).slerp(FOLD2Q[side], f);
    w2.scale.set(lerp(1, 0.93 / 0.42, f), 1, 1);
  });
  this.blob.visible = J.fold > 0.5 && J.legX < 0.6;
  if (this.spark) {
    this.mat.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 4);
    const a = this.spark.geometry.attributes.position;
    this.sparkData.forEach((d?: any, i?: any) => { d.y += dt * d.v * (J.flap > 0.2 ? -1.6 : 0.5); d.a += dt * 1.3; if (d.y > 0.8) d.y = 0; if (d.y < -0.4) d.y = 0.6; a.setXYZ(i, Math.cos(d.a) * d.r, 0.15 + d.y, Math.sin(d.a) * d.r); });
    a.needsUpdate = true;
  }
};
Gull.prototype.dispose = function (this: any) { if (this.group.parent) this.group.parent.remove(this.group); this.mesh.geometry.dispose(); this.mat.dispose(); };
CH.makeGull = function (opts?: any) { try { return new (Gull as any)(opts); } catch (e) { console.error('[chars] makeGull', e); const group = new T.Group(); group.add(C.mesh(sph(0.15, 10, 8), '#ffffff')); const beak = new T.Object3D(); group.add(beak); return { group, beak, update() {}, dispose() {} }; } };

/* ---------- shared tiny shader for cheap flapping birds (flock + pigeons) ---------- */
const BIRD_PARS = /* glsl */`
attribute float bpart; attribute vec4 iBird;
uniform float uTime;
void birdPose(inout vec3 p, inout vec3 n) {
  float flap = iBird.y, ph = iBird.x, fly = iBird.z, peck = iBird.w;
  if (bpart > 0.5 && bpart < 4.5) {
    float side = bpart < 2.5 ? -1.0 : 1.0;
    bool outer = bpart > 1.5 && bpart < 2.5 || bpart > 3.5;
    vec3 S = vec3(side * 0.05, p.y, 0.0);
    float a = side * (flap * sin(ph) + 0.12);
    p = mix(S + (p - S) * vec3(0.12, 1.0, 0.5), p, fly);
    if (outer) { vec3 Wp = vec3(side * WRIST, p.y, 0.0); float b = -side * 0.35 * flap * cos(ph); float cb = cos(b), sb = sin(b); vec3 q = p - Wp; p = Wp + vec3(cb * q.x - sb * q.y, sb * q.x + cb * q.y, q.z); }
    float c = cos(a), s = sin(a); vec3 q = p - S; p = S + vec3(c * q.x - s * q.y, s * q.x + c * q.y, q.z);
    n = vec3(c * n.x - s * n.y, s * n.x + c * n.y, n.z);
  }
  if (bpart > 4.5 && bpart < 5.5) { vec3 Nk = vec3(0.0, 0.16, 0.05); float a = peck; float c = cos(a), s = sin(a); vec3 q = p - Nk; p = Nk + vec3(q.x, c * q.y - s * q.z, s * q.y + c * q.z); }
  if (bpart > 5.5 && bpart < 6.5) { p.y = mix(p.y, max(p.y, 0.1), fly); }
}`;
function birdMaterial(uTime?: any, wrist?: any) {
  const m = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  m.onBeforeCompile = (sh?: any) => {
    sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n#define WRIST ' + (wrist || 0.3).toFixed(2) + '\n' + BIRD_PARS)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(normal); vec3 bpos = vec3(position); birdPose(bpos, objectNormal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = bpos;');
  };
  m.customProgramCacheKey = () => 'sbbird' + (wrist || 0.3);
  return m;
}
/* distant gull silhouette, ~28 triangles; parts: 0 body, 1 inner L, 2 outer L, 3 inner R, 4 outer R */
function buildFlockGull() {
  const b = new (GB as any)({ bpart: 1 });
  b.add(sph(0.06, 5, 3), { m: mTRS(0, 0, -0.02, 0, 0, 0, 0.9, 0.8, 3.2), color: '#f4f2ec', bpart: [0] });
  b.add(cone(0.02, 0.06, 3), { m: mTRS(0, 0, 0.22, PI / 2, 0, 0), color: '#f5c21b', bpart: [0] });
  const wing = (x0?: any, len?: any, c0?: any, c1?: any, l0?: any, l1?: any, col?: any, part?: any, sx?: any) => {
    const g = new T.PlaneGeometry(1, 1, 1, 1); g.rotateX(-PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getX(i) + 0.5, z = p.getZ(i) + 0.5; p.setXYZ(i, sx * (x0 + t * len), 0, lerp(l0, l1, t) - z * lerp(c0, c1, t)); }
    b.add(g, { color: col, bpart: [part] });
  };
  [-1, 1].forEach((s?: any) => { wing(0.05, 0.25, 0.17, 0.15, 0.08, 0.07, '#b5bdc5', s < 0 ? 1 : 3, s); wing(0.3, 0.2, 0.15, 0.06, 0.07, 0.02, '#c3cad1', s < 0 ? 2 : 4, s); wing(0.43, 0.14, 0.08, 0.02, 0.04, -0.05, '#26262b', s < 0 ? 2 : 4, s); });
  return b.build();
}
CH.makeFlock = function (scene?: any, count?: any, center?: any, radius?: any) {
  count = Math.max(1, count | 0 || 12); center = center || new T.Vector3(0, 12, -30); radius = radius || 14;
  const uTime: any = { value: 0 };
  const geo = C.geo('chars-flock-gull', () => withSeg(SEG.flock, buildFlockGull)).clone();
  const iBird = new T.InstancedBufferAttribute(new Float32Array(count * 4), 4); iBird.setUsage(T.DynamicDrawUsage); geo.setAttribute('iBird', iBird);
  const mesh = new T.InstancedMesh(geo, birdMaterial(uTime), count); mesh.frustumCulled = false; mesh.castShadow = false; mesh.name = 'gull-flock';
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if (scene) scene.add(mesh);
  const birds = Array.from({ length: count }, (_?: any, i?: any) => ({ a: vrand() * TAU, r: radius * (0.45 + vrand() * 0.55), h: (vrand() - 0.5) * 4, w: (0.18 + vrand() * 0.18) * (vrand() < 0.25 ? -1 : 1), ph: vrand() * 6, flapT: vrand() * 4, s: 0.9 + vrand() * 0.35, ox: (vrand() - 0.5) * radius * 0.5, oz: (vrand() - 0.5) * radius * 0.5 }));
  const m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(0, 0, 0, 'YXZ'), pv = new T.Vector3(), sv = new T.Vector3();
  let clock = 0;
  const api: any = {
    mesh, center, radius,
    update(dt?: any, t?: any) {
      dt = Math.min(dt || 0, 0.1); clock = t != null ? t : clock + dt; uTime.value = clock;
      for (let i = 0; i < count; i++) {
        const b = birds[i]; b.a += b.w * dt; b.flapT -= dt;
        const flapping = b.flapT < 0; if (b.flapT < -1.6) b.flapT = 3 + vrand() * 5;
        b.ph += dt * (flapping ? 15 : 3);
        pv.set(center.x + b.ox + Math.cos(b.a) * b.r, center.y + b.h + Math.sin(clock * 0.3 + i) * 0.8, center.z + b.oz + Math.sin(b.a) * b.r);
        e.set(0, -b.a + (b.w > 0 ? PI : 0), (b.w > 0 ? 1 : -1) * 0.35); q.setFromEuler(e); sv.setScalar(b.s * 2.2);
        m.compose(pv, q, sv); mesh.setMatrixAt(i, m);
        iBird.array.set([b.ph, flapping ? 0.6 : 0.06, 1, 0], i * 4);
      }
      mesh.instanceMatrix.needsUpdate = true; iBird.needsUpdate = true;
    },
    dispose() { if (mesh.parent) mesh.parent.remove(mesh); geo.dispose(); }
  };
  api.update(0, 0);
  return api;
};

/* ---------- pigeons: one InstancedMesh; peck, walk, scatter and return ---------- */
function buildPigeon() {
  const b = new (GB as any)({ bpart: 1 });
  b.add(sph(0.09, 8, 6), { m: mTRS(0, 0.12, -0.01, 0, 0, 0, 0.82, 0.78, 1.3), color: (v?: any) => v.y < 0.09 ? '#a4abb8' : '#8e97a8', bpart: [0] });
  b.add(cyl(0.035, 0.05, 0.085, 5), { m: mTRS(0, 0.13, -0.15, -PI / 2 - 0.3, 0, 0, 1, 1, 0.3), color: '#7a8292', bpart: [0] });
  b.add(cyl(0.051, 0.052, 0.022, 5), { m: mTRS(0, 0.115, -0.19, -PI / 2 - 0.3, 0, 0, 1, 1, 0.32), color: '#33363d', bpart: [0] });
  [-1, 1].forEach((s?: any) => {
    b.add(box(0.012, 0.022, 0.08), { m: mTRS(s * 0.07, 0.15, -0.05, 0, s * 0.08, 0), color: '#4a505c', bpart: [0] });
    b.add(cyl(0.007, 0.007, 0.07, 4), { m: mT(s * 0.025, 0.035, 0.0), color: '#d0605a', bpart: [6] });
  });
  b.add(sph(0.05, 8, 6), { m: mT(0, 0.2, 0.08), color: '#7d879a', bpart: [5] });
  b.add(tor(0.042, 0.016, 4, 10), { m: mTRS(0, 0.165, 0.065, PI / 2 + 0.4, 0, 0), color: (v?: any) => v.x > 0 ? '#5e9a7a' : '#8a6aa0', bpart: [5] });
  b.add(cone(0.012, 0.035, 4), { m: mTRS(0, 0.195, 0.135, PI / 2, 0, 0), color: '#3a3536', bpart: [5] });
  [-1, 1].forEach((s?: any) => { b.add(sph(0.009, 5, 4), { m: mT(s * 0.032, 0.215, 0.11), color: '#e0602a', bpart: [5] }); });
  const wing = (x0?: any, len?: any, c0?: any, c1?: any, l0?: any, l1?: any, col?: any, part?: any, sx?: any) => {
    const g = new T.PlaneGeometry(1, 1, 1, 1); g.rotateX(-PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = p.getX(i) + 0.5, z = p.getZ(i) + 0.5; p.setXYZ(i, sx * (x0 + t * len), 0.15, lerp(l0, l1, t) - z * lerp(c0, c1, t)); }
    b.add(g, { color: col, bpart: [part] });
  };
  [-1, 1].forEach((s?: any) => { wing(0.05, 0.13, 0.13, 0.11, 0.05, 0.04, '#8e97a8', s < 0 ? 1 : 3, s); wing(0.18, 0.13, 0.11, 0.04, 0.04, -0.02, '#4a505c', s < 0 ? 2 : 4, s); });
  return b.build();
}
CH.makePigeons = function (scene?: any, count?: any, area?: any) {
  count = Math.max(1, count | 0 || 12);
  let A = area || { x: 0, z: 4, r: 3 };
  if (A.isBox3) A = { x0: A.min.x, x1: A.max.x, z0: A.min.z, z1: A.max.z };
  if (A.x0 == null) { const cx = A.x != null ? A.x : (A.center ? A.center.x : 0), cz = A.z != null ? A.z : (A.center ? A.center.z : 0), r = A.r || A.radius || 3; A = { x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r }; }
  const rnd = () => ({ x: lerp(A.x0, A.x1, vrand()), z: lerp(A.z0, A.z1, vrand()) });
  const uTime: any = { value: 0 };
  const geo = C.geo('chars-pigeon', () => withSeg(1, buildPigeon)).clone();
  const iBird = new T.InstancedBufferAttribute(new Float32Array(count * 4), 4); iBird.setUsage(T.DynamicDrawUsage); geo.setAttribute('iBird', iBird);
  const mesh = new T.InstancedMesh(geo, birdMaterial(uTime, 0.18), count); mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.name = 'pigeons';
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  if (scene) scene.add(mesh);
  const P = Array.from({ length: count }, () => { const p = rnd(); return { x: p.x, y: 0, z: p.z, yaw: vrand() * TAU, tx: p.x, tz: p.z, state: 'ground', t: vrand() * 3, ph: vrand() * 6, vx: 0, vy: 0, vz: 0, fly: 0, peckT: vrand() * 2, away: 0, s: 0.78 + vrand() * 0.18 }; });
  const m = new T.Matrix4(), q = new T.Quaternion(), pv = new T.Vector3(), sv = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  let clock = 0;
  const api: any = {
    mesh, area: A,
    get flying() { return P.filter((p?: any) => p.state !== 'ground').length; },
    scatter(x?: any, z?: any, r?: any) {
      r = r || 3.5;
      P.forEach((p?: any) => {
        const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz);
        if (d < r && p.state === 'ground') { const k = 1 / Math.max(0.3, d); p.state = 'fly'; p.t = 1.2 + vrand() * 1.5; p.vx = dx * k * 2.6 + (vrand() - 0.5); p.vz = dz * k * 2.6 + (vrand() - 0.5); p.vy = 2.2 + vrand() * 1.2; p.away = 8 + vrand() * 7; }
      });
    },
    update(dt?: any) {
      dt = Math.min(dt || 0, 0.1); clock += dt; uTime.value = clock;
      for (let i = 0; i < count; i++) {
        const p = P[i];
        let peck = 0, flap = 0;
        if (p.state === 'ground') {
          p.fly = damp(p.fly, 0, 8, dt);
          const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
          if (d > 0.05) { const sp = 0.35; p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.yaw = C.angLerp(p.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6)); p.ph += dt * 14; peck = -0.25 * Math.abs(Math.sin(p.ph)); }
          else { p.t -= dt; p.peckT -= dt; if (p.peckT < 0) { p.peckT = 0.5 + vrand() * 1.8; } peck = p.peckT < 0.25 ? 1.0 * Math.sin(p.peckT / 0.25 * PI) : 0; if (p.t < 0) { p.t = 1 + vrand() * 3; const n: any = { x: clamp(p.x + (vrand() - 0.5) * 1.6, A.x0, A.x1), z: clamp(p.z + (vrand() - 0.5) * 1.6, A.z0, A.z1) }; p.tx = n.x; p.tz = n.z; } }
        } else if (p.state === 'fly') {
          p.fly = damp(p.fly, 1, 12, dt); flap = 0.9; p.ph += dt * 22;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy = Math.max(0.2, p.vy - dt * 0.8);
          p.yaw = C.angLerp(p.yaw, Math.atan2(p.vx, p.vz), Math.min(1, dt * 5));
          p.away -= dt; if (p.away < 0) { const n = rnd(); p.tx = n.x; p.tz = n.z; p.state = 'return'; }
        } else {
          p.fly = damp(p.fly, 1, 12, dt); p.ph += dt * 16; flap = 0.7;
          const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz), sp = 3.2;
          p.x += dx / Math.max(d, 0.001) * Math.min(d, sp * dt); p.z += dz / Math.max(d, 0.001) * Math.min(d, sp * dt);
          p.y = Math.max(0, Math.min(p.y, d * 0.8) - dt * 0.5);
          p.yaw = C.angLerp(p.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5));
          // touch down: fold the wings and walk the last bit
          if (p.y < 0.02 && (d < 0.6 || p.y <= 0)) { p.state = 'ground'; p.y = 0; p.t = 1 + vrand() * 2; }
        }
        q.setFromAxisAngle(up, p.yaw); pv.set(p.x, p.y, p.z); sv.setScalar(p.s);
        m.compose(pv, q, sv); mesh.setMatrixAt(i, m);
        iBird.array.set([p.ph, flap, p.fly, peck], i * 4);
      }
      mesh.instanceMatrix.needsUpdate = true; iBird.needsUpdate = true;
    },
    dispose() { if (mesh.parent) mesh.parent.remove(mesh); geo.dispose(); }
  };
  api.update(0);
  return api;
};

CH.ready = true;
CH.crowdFaces = crowdFaces;
