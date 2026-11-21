// PRF-07 görsel kanıt: node tests/browser/pop-in-shot.mjs ÇIKTI_KLASÖRÜ   (DIST=klasör)
// Kahraman iskelenin doğusunda (x 98, iskele sınırına 36 m), kamera en uzak yakınlaştırmada; eski kural (yalnız uzaklık)
// ile PRF-07 (görüşe göre) aynı karede çekilir. Eskide iskele ekranda olduğu halde sökülür.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist'), OUT = process.argv[2] || '.';
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=10&time=12`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(500); }
for (const [view, ad] of [[false, 'once-eski-kural'], [true, 'sonra-prf07']]) {
  await p.evaluate(v => { const M = window.__marti; M.zonePop({ viewAware: v }); M.camera({ zoom: 1 }); M.teleport(40, 9); for (let i = 0; i < 30; i++) M.renderFrames(1, 1 / 30); M.camera({ zoom: 2.1 }); for (let x = 40; x <= 98; x += 1) { M.teleport(x, 9); M.renderFrames(1, 1 / 30); } for (let i = 0; i < 20; i++) M.renderFrames(1, 1 / 30); }, view);
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => window.__marti.zonePop().states);
  await p.screenshot({ path: `${OUT}/pop-in-${ad}.png`, timeout: 300000 });
  console.log(ad, JSON.stringify(st));
}
await b.close(); srv.close();
