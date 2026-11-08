// 4 açıdan iskele izometrik: node tests/browser/iso.mjs <çıktı-klasörü> [zoomRaw=3.6] [tilt=0.4]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2], zr = +(process.argv[3] || 3.6), tilt = +(process.argv[4] || 0.4); mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); });
const walk = async (x, z, ix, iz, n, dt) => { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); const out = [];
  for (let i = 0; i < n; i++) { await p.evaluate(([ix, iz, dt]) => { const M = window.__marti; M.input(ix, iz); M.step(dt); M.renderFrames(1, 0.05); }, [ix, iz, dt]); const h = await p.evaluate(() => { const M = window.__marti; const s = M.state(); return { x: s.pos.x, z: s.pos.z }; }); out.push(h); }
  await p.evaluate(() => window.__marti.input(null)); return out; };
const a = await walk(24, 7.6, 0, 1, 52, 0.5); console.log('bridge south->north', JSON.stringify(a.filter((_, i) => i % 4 === 3)));
const bb = await walk(10, 11.0, 0, 1, 12, 0.5); console.log('off-bridge (must stop at road)', JSON.stringify(bb.slice(-1)));
const cc = await walk(-39, 30, 0, 1, 20, 0.5); console.log('pitch fence', JSON.stringify(cc.slice(-1)));
const dd = await walk(-20, 45, -1, 0, 20, 0.5); console.log('gate -> pitch', JSON.stringify(dd.slice(-1)));

await (await import('node:process')).default.exit(0);
