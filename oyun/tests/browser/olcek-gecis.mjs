// PRF-12: ölçek adımının maliyeti parça parça. node tests/browser/olcek-gecis.mjs   (DIST=klasör, TIER=dengeli)
// setScale çağrısı (hedeflerin yeniden boyutlanması), geçişten sonraki ilk 3 kare ve sabit karede kare süresi; her adım 3 kez.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=10&time=12`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; for (let k = 0; k < 12; k++) M.renderFrames(2, 0.1); });
const step = (v) => p.evaluate(v => {
  const M = window.__marti, gl = document.getElementById('c').getContext('webgl2'), fin = () => { gl.finish(); };   // finish: GPU (SwiftShader) work counted where it happens
  const ms = f => { const t = performance.now(); f(); fin(); return +(performance.now() - t).toFixed(1); };
  const pre = [ms(() => M.renderFrames(1, 1 / 60)), ms(() => M.renderFrames(1, 1 / 60))];
  const set = ms(() => M.setScale(v));
  const post = [0, 1, 2].map(() => ms(() => M.renderFrames(1, 1 / 60)));
  const i = M.info(), c = document.getElementById('c');
  return { v, pre, set, post, tuval: c.width + 'x' + c.height, sahne: i.sceneW + 'x' + i.sceneH };
}, v);
for (const v of [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1]) console.log(JSON.stringify(await step(v)));
await b.close(); srv.close();
