// Character lineup spec (Builder C). Run: NODE_PATH=$(npm root -g) node tests/browser/chars.spec.mjs [page]
// 1) Serves tests/browser/chars.html with Vite, opens every view, fails on console/page errors.
// 2) Lineup parity: 'heroes' view shot vs v2 test/chars.html shot (390x844, DPR 2, mobile), SSIM on 1/4-res
//    blurred grayscale >= 0.7 (CONTRACT M0 acceptance 6). The v2 shot is taken live from the read-only v2 folder
//    unless tests/fixtures/v2-shots/chars-heroes.png exists (Builder D's capture).
// 3) Budgets on the lineup: crowd draw calls (SoA view, 50 agents) and live particles under the tier cap.
// Shots + diff go to $TMPDIR/marti-chars/.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const { createServer } = await import('vite');

const PAGE = process.argv[2] || 'tests/browser/chars.html';
const V2 = '/mnt/project-files/sosisci-oyun/3d/v2/test/chars.html';
const FIX = 'tests/fixtures/v2-shots/chars-heroes.png';
const OUT = join(os.tmpdir(), 'marti-chars'); mkdirSync(OUT, { recursive: true });
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };

// ---------- SSIM (grayscale, 1/4 res, 3x3 box blur twice, 8x8 windows) ----------
function gray(png, f) {
  const w = Math.floor(png.width / f), h = Math.floor(png.height / f), g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const o = ((y * f + j) * png.width + x * f + i) * 4; s += 0.299 * png.data[o] + 0.587 * png.data[o + 1] + 0.114 * png.data[o + 2]; }
    g[y * w + x] = s / (f * f);
  }
  return { w, h, g };
}
function blur(im) {
  const { w, h } = im; let a = im.g;
  for (let pass = 0; pass < 2; pass++) {
    const b = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { s += a[yy * w + xx]; n++; } } b[y * w + x] = s / n; }
    a = b;
  }
  return { w, h, g: a };
}
function ssim(A, B) {
  const w = Math.min(A.w, B.w), h = Math.min(A.h, B.h), C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2, W = 8;
  let sum = 0, n = 0;
  for (let y = 0; y + W <= h; y += 4) for (let x = 0; x + W <= w; x += 4) {
    let ma = 0, mb = 0; for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { ma += A.g[(y + j) * A.w + x + i]; mb += B.g[(y + j) * B.w + x + i]; }
    ma /= W * W; mb /= W * W;
    let va = 0, vb = 0, cv = 0; for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const da = A.g[(y + j) * A.w + x + i] - ma, db = B.g[(y + j) * B.w + x + i] - mb; va += da * da; vb += db * db; cv += da * db; }
    va /= W * W - 1; vb /= W * W - 1; cv /= W * W - 1;
    sum += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return sum / n;
}

async function shoot(browser, url, file, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(`[${tag}] PAGEERR ${e.message}`));
  p.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !/three(\.min)?\.js.*deprecated|GPU stall|ReadPixels/i.test(m.text())) errs.push(`[${tag}] ${m.type()} ${m.text()}`); });
  await p.goto(url + '#heroes');
  await p.waitForFunction(() => window.__chars && window.__chars.ready, null, { timeout: 60000 });
  await p.evaluate(() => window.__chars.setView('heroes'));
  await p.waitForTimeout(300);
  await p.evaluate(() => { if (window.__chars.pause) window.__chars.pause(true); window.__chars.step(45, 1 / 30); });
  await p.waitForTimeout(500);
  await p.screenshot({ path: file });
  return { ctx, p };
}

const server = await createServer({ root: process.cwd(), logLevel: 'error', server: { port: 5191, strictPort: false, hmr: false } });
await server.listen();
const base = (server.resolvedUrls?.local?.[0] || 'http://localhost:5191/').replace(/\/$/, '');
const browser = await chromium.launch({ args: ARGS });
const errs = [];
try {
  // v2 reference
  let refFile = FIX;
  if (!existsSync(FIX)) {
    refFile = join(OUT, 'v2-heroes.png');
    const { ctx } = await shoot(browser, 'file://' + V2, refFile, [], 'v2');
    await ctx.close();
  }
  const motorFile = join(OUT, 'motor-heroes.png');
  const { ctx, p } = await shoot(browser, `${base}/${PAGE}`, motorFile, errs, 'motor');
  const A = PNG.sync.read(readFileSync(refFile)), B = PNG.sync.read(readFileSync(motorFile));
  const s = ssim(blur(gray(A, 4)), blur(gray(B, 4)));
  check(s >= 0.7, `lineup SSIM vs v2 = ${s.toFixed(3)} (>= 0.7)  [${refFile} vs ${motorFile}]`);
  // diff image (abs grayscale) for eye checks
  const d = new PNG({ width: A.width, height: A.height });
  for (let i = 0; i < A.data.length; i += 4) { const v = Math.min(255, Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])); d.data[i] = v; d.data[i + 1] = v * 0.4; d.data[i + 2] = 0; d.data[i + 3] = 255; }
  writeFileSync(join(OUT, 'diff-heroes.png'), PNG.sync.write(d));
  // every view renders without errors
  const views = PAGE.includes('_base') ? ['acts', 'citizens', 'crowd', 'animals', 'gulls'] : ['acts', 'citizens', 'crowd', 'animals', 'gulls', 'faces', 'soa', 'fx', 'carry'];
  for (const v of views) {
    await p.evaluate(v => window.__chars.setView(v), v);
    const info = await p.evaluate(() => { window.__chars.pause && window.__chars.pause(true); const r = window.__chars.step(60, 1 / 30); return Object.assign(r, window.__chars.info()); });
    await p.screenshot({ path: join(OUT, `motor-${v}.png`) });
    console.log(`     view ${v}: calls=${info.calls} tris=${info.triangles} fx=${info.fxLive ?? '-'} crowd=${info.crowd ?? '-'}`);
    if (v === 'soa') check(info.crowd === 50 && info.calls <= 30, `SoA crowd: ${info.crowd} visible, ${info.calls} draw calls (scene incl. deck/sea)`);
    if (v === 'fx') check(info.fxLive > 0 && info.fxLive <= 1000, `fx live particles ${info.fxLive} (0 < n <= 1000)`);
  }
  await ctx.close();
} catch (e) { errs.push('spec: ' + (e && e.stack || e)); }
await browser.close();
await server.close();
check(errs.length === 0, 'no console/page errors' + (errs.length ? ':\n  ' + errs.slice(0, 10).join('\n  ') : ''));
console.log(fails ? `chars.spec: ${fails} failed` : 'chars.spec: all passed');
process.exit(fails ? 1 : 0);
