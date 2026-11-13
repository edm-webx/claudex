// Owner: Builder A. Walk smoothness in the real page (companion of tests/unit/loop/smooth.test.ts).
// Walks at constant stick for 5 s with the loop running at tier akici and dengeli, records hero and camera x per render
// (hooks.trace) and reports per-frame displacement mean/variance and max/median. SwiftShader is slow, so the pass criterion
// is about evenness of displacement relative to the elapsed time between renders (velocity = displacement / frame time,
// max/median of it must stay near 1). Usage: node tests/browser/smooth.spec.mjs  (MARTI_DIST=<dir> to use another build)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = resolve(process.env.MARTI_DIST || 'dist');
if (!process.env.SKIP_BUILD && !process.env.MARTI_DIST) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit' });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = 0;
const stats = (xs, ts) => {
  const v = [], d = [];
  for (let i = 1; i < xs.length; i++) { d.push(xs[i] - xs[i - 1]); v.push((xs[i] - xs[i - 1]) / (ts[i] - ts[i - 1])); }
  const med = a => [...a].sort((x, y) => x - y)[a.length >> 1], mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const mv = mean(v), cv = Math.sqrt(mean(v.map(x => (x - mv) ** 2))) / Math.abs(mv);
  return { n: xs.length, velCv: cv, velMaxMed: Math.max(...v) / med(v), velMinMed: Math.min(...v) / med(v), dMaxMed: Math.max(...d) / med(d) };
};
try {
  // The real loop is driven with synthetic rAF timestamps (?noloop + hooks.frame), because SwiftShader's own frame pacing is
  // GPU-fill-bound (hundreds of ms per frame) and says nothing about phone smoothness. Everything else is the real page:
  // real sim, walk, boot interpolation, camera rig, hero, world. Renders really execute for every synthetic frame.
  const lcg = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const cases = [
    ['akici', 'vsync 60 Hz', () => 1000 / 60],
    ['dengeli', 'vsync 60 Hz', () => 1000 / 60],
    ['akici', 'jitter 15.5-18.5 ms', (() => { const r = lcg(3); return () => 15.5 + r() * 3; })()],
    ['dengeli', 'jitter 15.5-18.5 ms', (() => { const r = lcg(4); return () => 15.5 + r() * 3; })()],
    ['akici', 'rAF 30/s', () => 1000 / 30],
    ['akici', '120 Hz', () => 1000 / 120],
  ];
  for (const [tier, label, cad] of cases) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
    await page.goto(url + `?fresh=1&noloop&tier=${tier}`);
    await page.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 30000 });
    await page.evaluate(() => { window.__marti.teleport(-12, 5); window.__marti.input(1, 0); window.__marti.trace(true); });
    // 1.2 s warm-up (camera catch-up) + 3 s measured; frames sent in chunks
    const times = []; let t = 1000;
    while (t < 1000 + 4200) { t += cad(); times.push(t); }
    for (let i = 0; i < times.length; i += 40) await page.evaluate(ts => ts.forEach(x => window.__marti.frame(x)), times.slice(i, i + 40));
    const tr = await page.evaluate(() => { const r = window.__marti.trace(false); window.__marti.input(null); return r; });
    const w = tr.filter(r => r[0] > 1000 + 1200);
    const ts = w.map(r => r[0]);
    const fps = (w.length - 1) / ((ts[ts.length - 1] - ts[0]) / 1000);
    const h = stats(w.map(r => r[1]), ts), c = stats(w.map(r => r[3]), ts);
    const ok = h.velMaxMed < 1.15 && c.velMaxMed < 1.3 && errs.length === 0;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${tier.padEnd(7)} ${label.padEnd(20)} ${w.length} renders ${fps.toFixed(1)} fps | hero vel cv ${h.velCv.toFixed(3)} max/med ${h.velMaxMed.toFixed(2)} min/med ${h.velMinMed.toFixed(2)} | cam cv ${c.velCv.toFixed(3)} max/med ${c.velMaxMed.toFixed(2)} min/med ${c.velMinMed.toFixed(2)}${errs.length ? ' errors: ' + errs[0] : ''}`);
    await ctx.close();
  }
} finally { await browser.close(); srv.close(); }
process.exit(failed ? 1 : 0);
