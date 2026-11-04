import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
for (const [x, z] of [[0, -2], [10, 14], [0, 40], [-30, 45]]) {
  await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 15; k++) M.renderFrames(2, 0.1); }, [x, z]);
  await p.waitForTimeout(2500); await p.evaluate(() => window.__marti.renderFrames(4, 0.1));
  const i = await p.evaluate(() => { const M = window.__marti; const s = M.info(); return { calls: s.calls, tris: s.tris, geos: s.geos, texs: s.texs, fps: s.fps }; });
  console.log(`at ${x},${z}`, JSON.stringify(i));
}
await b.close(); srv.close(); process.exit(0);
