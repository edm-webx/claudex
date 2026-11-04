// 4 açıdan iskele izometrik: node tests/browser/iso.mjs <çıktı-klasörü> [zoomRaw=3.6] [tilt=0.4]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2], zr = +(process.argv[3] || 3.6), tilt = +(process.argv[4] || 0.4); mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(true); const u = document.getElementById('sbui'); if (u) u.style.display = 'none'; const v = document.getElementById('sb-vig'); if (v) v.style.display = 'none'; });
await p.evaluate(() => { const M = window.__marti; for (const [x, z] of [[50, 40], [-40, 45], [10, 45], [24, 20], [0, 9]]) { M.teleport(x, z); for (let k = 0; k < 12; k++) M.renderFrames(3, 0.1); } });
await p.waitForTimeout(+(process.env.WAIT || 500)); await p.evaluate(t => window.__marti.camera({ tilt: t }), tilt);
await p.evaluate(([n,cx,cz]) => { window.__nf = n; window.__cx = cx; window.__cz = cz; }, [+(process.env.NF || 40), +(process.env.CX || 0), +(process.env.CZ || 2)]);
await p.setViewportSize({ width: +(process.env.W || 1440), height: +(process.env.H || 810) });
const names = ['guney', 'bati', 'kuzey', 'dogu'];
const only = process.argv[5] ? [+process.argv[5]] : [0, 1, 2, 3];
for (const i of only) {
  await p.evaluate(([i, z]) => { const M = window.__marti; M.camera({ x: +(window.__cx ?? 0), z: +(window.__cz ?? 2), zoomRaw: z, yaw: i * Math.PI / 2 }); for (let k = 0; k < (window.__nf || 40); k++) M.renderFrames(2, 0.1); }, [i, zr]);
  await p.waitForTimeout(+(process.env.WAIT || 500)); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.screenshot({ path: join(out, `iskele-iso-${i + 1}-${names[i]}.png`), timeout: 540000 }); console.log('ok', i + 1);
}
await b.close(); srv.close();
