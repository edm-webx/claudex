// PRF-15/PRF-11: varlık sıkıştırma ve doku akışı "görüntüyü değiştirmedi" kanıtı için sabit kareler.
//   node tools/bellek-shots.mjs <DIST> <çıktıKlasörü> [--kademe dengeli]
// Aynı tohum, ?noloop, saat 13, aynı kamera: yol (Kenney arabaları), karşı yaka (binalar + karşı yaka işçileri), yakın plan
// (doku akışı tama çıkmış NPC), orman (uzak kalabalık). Karşılaştırma: node tools/gorsel-fark.mjs önce sonra --fark fark.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const [distA, outA] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
if (!distA || !outA) { console.error('kullanım: node tools/bellek-shots.mjs <DIST> <çıktı>'); process.exit(2); }
const DIST = resolve(distA), OUT = resolve(outA); mkdirSync(OUT, { recursive: true });
const mime = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${arg('--kademe', 'dengeli')}&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.addStyleTag({ content: 'body > *:not(#app){visibility:hidden !important} #app *{visibility:visible}' });   // yalnız 3B sahne
const settle = n => p.evaluate(n => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(2, 0); }, n);
const KARE = [
  ['yol-arabalar', 6, 22, 1.0], ['karsi-yaka', -30, 45, 1.0], ['iskele-yakin', 0, -6, 0.35], ['orman', 806, 9, 1.0],
];
for (const [ad, x, z, zoom] of KARE) {
  await p.evaluate(([x, z, zoom]) => { const M = window.__marti; M.teleport(x, z); M.setTime(13); M.camera({ zoom }); }, [x, z, zoom]);
  await settle(30); await p.waitForTimeout(1500); await settle(30); await p.waitForTimeout(600); await settle(4);
  await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 180000 });
  console.log(ad, await p.evaluate(() => JSON.stringify(window.__marti.info().texs)));
}
await b.close(); srv.close();
