// Büfe mutfağı çekimi: STAGE=10 node tests/browser/mutfak.mjs <çıktı klasörü>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('console', m => { if (/error/i.test(m.type() + m.text())) console.log('[c]', m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${process.env.STAGE || 10}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('unlock', 'isbul'); M.simCmd('cmd', { kind: 'setStage', stage: 10 }); for (let i = 0; i < 30; i++) { M.simCmd('hire'); M.step(1); } M.step(1); });
console.log(await p.evaluate(() => JSON.stringify(window.__marti.state().workers?.map?.(w => w.role) ?? 'n/a')));
await p.evaluate(() => { window.__marti.closeJobBoard(); window.__marti.closePanel(); window.__marti.renderFrames(2, 0.1); const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /İş ve İşçi Bulma/.test(e.textContent || '')); let e = h; while (e && e.parentElement && e.parentElement.id !== 'sbui' && e.parentElement !== document.body) { if (getComputedStyle(e).position === 'absolute' || getComputedStyle(e).position === 'fixed') { if (e.getBoundingClientRect().width > 500) break; } e = e.parentElement; } if (e) e.style.display = 'none'; });
await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(500);
for (const [id, x, z, zr] of [['dis', 0, -9, 2], ['ic', 0, -14.6, 1]]) {
  await p.evaluate(([x, z, zr]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 8; k++) M.renderFrames(3, 0.1); M.camera({ x, z: z - (zr === 1 ? 0.4 : 3), zoomRaw: zr === 1 ? 0.9 : 1.4 }); for (let k = 0; k < 6; k++) M.renderFrames(3, 0.1); }, [x, z, zr]);
  await p.waitForTimeout(300); await p.screenshot({ path: join(out, 'mutfak-' + id + '.png'), timeout: 300000 }); console.log('ok', id);
}
await b.close(); srv.close(); process.exit(0);
