// World spec (Builder B). Run: NODE_PATH=$(npm root -g) node tests/browser/world.spec.mjs
// Serves tests/browser/world.html with Vite (render + zones + pier world view, no sim/characters) and checks:
// 1) no console/page errors while booting, 4 times of day x stage 1/2;
// 2) look: shots at 09/13/19/22 x stage 1/2 (390x844, dengeli, #noart) vs v2 'nodyn' fixtures (crowd hidden):
//    mean colour dE76 per band (sky+sea, deck, promenade) and kiosk band SSIM, reported against CONTRACT 6 numbers;
// 3) acceptance 8: pier -> test-sokak -> pier through the portal 5 times per tier: zone states sim/warm/hot and back,
//    no frame where the zone under the player has no meshes, per-frame build slice <= tier budget,
//    geometries/textures back to baseline +-5 % after leaving;
// 4) acceptance 11 (B share): pier scene draw calls / triangles / textures per tier under the budgets.
// Shots go to $TMPDIR/marti-world/.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { createServer } = await import('vite');

const OUT = join(os.tmpdir(), 'marti-world'); mkdirSync(OUT, { recursive: true });
const FIX = 'tests/fixtures/v2-shots';
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const ONLY = process.argv[2] || 'all';
const BUDGET = { akici: { ms: 3, calls: 110, tris: 150e3, texs: 40 }, dengeli: { ms: 4, calls: 150, tris: 300e3, texs: 60 }, sahane: { ms: 6, calls: 190, tris: 450e3, texs: 80 } };
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const note = msg => console.log('info ' + msg);

// ---------- image metrics ----------
const lab = (r, g, b) => {
  const f = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; X = h(X); Y = h(Y); Z = h(Z);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};
function meanLab(png, y0, y1) {
  let r = 0, g = 0, b = 0, n = 0; const Y0 = Math.floor(y0 * png.height), Y1 = Math.floor(y1 * png.height);
  for (let y = Y0; y < Y1; y++) for (let x = 0; x < png.width; x++) { const o = (y * png.width + x) * 4; r += png.data[o]; g += png.data[o + 1]; b += png.data[o + 2]; n++; }
  return lab(r / n, g / n, b / n);
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function gray(png, f, y0, y1) {
  const Y0 = Math.floor(y0 * png.height / f), Y1 = Math.floor(y1 * png.height / f), w = Math.floor(png.width / f), h = Y1 - Y0, g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0; for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const o = (((y + Y0) * f + j) * png.width + x * f + i) * 4; s += 0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2]; }
    g[y * w + x] = s / (f * f);
  }
  let a = g; for (let p = 0; p < 2; p++) { const b = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += a[yy * w + xx]; n++; } } b[y * w + x] = s / n; } a = b; }
  return { w, h, g: a };
}
function ssim(A, B) {
  const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h), C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, W = 8; let sum = 0, n = 0;
  for (let y = 0; y + W <= h; y += 4) for (let x = 0; x + W <= w; x += 4) {
    let ma = 0, mb = 0; for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { ma += A.g[(y + j) * A.w + x + i]; mb += B.g[(y + j) * B.w + x + i]; }
    ma /= W * W; mb /= W * W; let va = 0, vb = 0, cv = 0;
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const da = A.g[(y + j) * A.w + x + i] - ma, db = B.g[(y + j) * B.w + x + i] - mb; va += da * da; vb += db * db; cv += da * db; }
    va /= W * W - 1; vb /= W * W - 1; cv /= W * W - 1;
    sum += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return sum / n;
}

const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5193, strictPort: false, hmr: false } });
await server.listen();
const base = (server.resolvedUrls?.local?.[0] || 'http://localhost:5193/').replace(/\/$/, '');
const browser = await chromium.launch({ args: ARGS });

async function open(query, hash = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(`${base}/tests/browser/world.html?${query}${hash}`);
  await p.waitForFunction(() => window.__world && window.__world.ready, null, { timeout: 120000 });
  return { ctx, p, errs };
}

// ---------- 2) look ----------
if (ONLY === 'all' || ONLY === 'look') {
  for (const stage of [1, 2]) for (const hh of [9, 13, 19, 22]) {
    const tag = `s${stage}-${String(hh).padStart(2, '0')}`;
    const { ctx, p, errs } = await open(`tier=dengeli&time=${hh}&stage=${stage}&x=0.2&z=-2.6`, '#noart');
    await p.evaluate(() => window.__world.frame(4, 1 / 60));
    const buf = await p.screenshot(); writeFileSync(join(OUT, tag + '.png'), buf);
    check(errs.length === 0, `${tag} no errors ${errs.slice(0, 2).join(' | ')}`);
    const ref = join(FIX, tag + '-noart.nodyn.png');
    if (existsSync(ref)) {
      const A = PNG.sync.read(buf), B = PNG.sync.read(readFileSync(ref));
      const bands = { skySea: [0, 0.2], deck: [0.22, 0.7], promenade: [0.74, 0.88] };
      const d = Object.fromEntries(Object.entries(bands).map(([k, [a, b]]) => [k, +dE(meanLab(A, a, b), meanLab(B, a, b)).toFixed(2)]));
      const s = ssim(gray(A, 4, 0.2, 0.6), gray(B, 4, 0.2, 0.6));
      check(Math.max(...Object.values(d)) <= 6, `${tag} band dE76 ${JSON.stringify(d)} (<= 6)`);
      check(s >= 0.75, `${tag} kiosk band SSIM ${s.toFixed(3)} (>= 0.75)`);
    } else note(`${tag} no v2 fixture ${ref}`);
    await ctx.close();
  }
}

// ---------- 3) + 4) streaming and budgets per tier ----------
if (ONLY === 'all' || ONLY === 'stream') {
  for (const tier of ['akici', 'dengeli', 'sahane']) {
    const B = BUDGET[tier];
    const { ctx, p, errs } = await open(`tier=${tier}&time=13&stage=1`);
    await p.evaluate(() => window.__world.animate(false));
    const pier = await p.evaluate(() => window.__world.frame(6, 1 / 60));
    check(pier.calls <= B.calls && pier.tris <= B.tris && pier.texs <= B.texs, `${tier} pier scene calls ${pier.calls}/${B.calls} tris ${pier.tris}/${B.tris} texs ${pier.texs}/${B.texs}`);
    // baseline: boot counts include the skyline/clouds uploaded on the first frame (horizon starts true, as in v2);
    // after a round trip only what the steady camera draws is re-uploaded. So: no trip may exceed boot + 5 %, and
    // trips 2..5 must stay within +-5 % of trip 1 (no growth across round trips).
    const base0 = { geos: pier.geos, texs: pier.texs };
    let worst = 0, holes = 0, ok = true, first = null; const allTrans = [];
    for (let i = 0; i < 5; i++) {
      const out = await p.evaluate(() => window.__world.walk([[0.2, 9], [110, 9]]));
      const back = await p.evaluate(() => window.__world.walk([[0.2, 9], [0.2, -2.6]]));
      worst = Math.max(worst, out.maxBuild, back.maxBuild); holes += out.holes + back.holes;
      allTrans.push(...out.trans, ...back.trans);
      ok = ok && out.states['test-sokak'] === 'hot' && out.states.iskele === 'sim' && back.states.iskele === 'hot' && (back.states['test-sokak'] === 'cold' || back.states['test-sokak'] === 'sim');
      const g = back.info.geos, t = back.info.texs;
      if (!first) first = { geos: g, texs: t };
      const tol = (v, b) => Math.abs(v - b) <= Math.max(1, b * 0.05);
      const within = g <= base0.geos * 1.05 && t <= base0.texs * 1.05 && tol(g, first.geos) && tol(t, first.texs);
      check(within, `${tier} trip ${i + 1}: home geos ${g} texs ${t} (boot ${base0.geos}/${base0.texs}, trip 1 ${first.geos}/${first.texs}), at sokak geos ${out.info.geos} texs ${out.info.texs}`);
    }
    check(ok, `${tier} states each trip: sokak hot + pier sim at the far end, pier hot + sokak sim/cold back home`);
    note(`${tier} slowest job ${JSON.stringify(await p.evaluate(() => window.__world.slowest()))}`);
    const seq = allTrans.filter(s => s.startsWith('test-sokak')).slice(0, 6).join(', ');
    check(allTrans.includes('test-sokak:sim>warm') && allTrans.includes('test-sokak:warm>hot') && allTrans.includes('iskele:warm>sim') && allTrans.includes('iskele:sim>warm'), `${tier} transitions ${seq} ...`);
    check(holes === 0, `${tier} no frame with an unbuilt zone under the player (holes ${holes})`);
    check(worst <= B.ms, `${tier} max per-frame build slice ${worst.toFixed(2)} ms (<= ${B.ms})`);
    check(errs.length === 0, `${tier} no errors ${errs.slice(0, 2).join(' | ')}`);
    await ctx.close();
  }
}

await browser.close();
await server.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
