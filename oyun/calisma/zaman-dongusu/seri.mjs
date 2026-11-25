// ZMN ekran görüntüsü serisi: node calisma/zaman-dongusu/seri.mjs [--dist dist] [--cikti calisma/zaman-dongusu/kareler] [--hepsi]
// Ana kareler (gün doğumu, öğle, gün batımı, gece, gece 04, yağmur, kar) + şafak şeridi 04:30-08:00 (15 dk) ile ortalama parlaklık adımları.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { kulisKapat } from '../../tests/browser/kulis-kapat.mjs';
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const DIST = resolve(arg('--dist', 'dist')), OUT = resolve(arg('--cikti', 'calisma/zaman-dongusu/kareler'));
mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const { PNG } = require('pngjs');
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const p = await ctx.newPage();
p.on('pageerror', e => console.log('  sayfa hatası:', String(e).slice(0, 160)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.izgara?.(false); M.teleport(-2, 4); for (let i = 0; i < 10; i++) M.renderFrames(3, 0.1); });
const meanY = buf => { const { width: w, height: h, data: d } = PNG.sync.read(buf); let s = 0; for (let i = 0; i < w * h * 4; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(s / (w * h)).toFixed(2); };
const kare = async (ad, saat, hava = '', bekle = 4) => {
  await p.evaluate(([h, k, n]) => { const M = window.__marti; M.havaZorla(k); M.setTime(h); M.camera({ x: 0, z: -3, zoomRaw: 2.8, yaw: 0, tilt: 0.75 }); for (let i = 0; i < n; i++) M.renderFrames(5, 0.2); }, [saat, hava, bekle]);
  const buf = await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 300000 });
  const y = meanY(buf); console.log(ad.padEnd(22), 'saat', saat, 'ortY', y); return y;
};
const sonuc = { ana: {}, safak: {} };
const ANA = [['1-gun-dogumu-0610', 30.17], ['2-ogle-1300', 13], ['3-gun-batimi-1940', 19.67], ['4-gece-2330', 23.5], ['5-gece-0400', 28], ['6-yagmur-1500', 15, 'saganak', 30], ['7-kar-1100', 11, 'kar', 18]];
const sadece = arg('--sadece');   // ör. --sadece 7 (sadece adı 7 ile başlayan kareler)
for (const [ad, h, k, n] of ANA) if (!sadece || ad.startsWith(sadece)) sonuc.ana[ad] = await kare(ad, h, k, n);
await p.evaluate(() => window.__marti.havaZorla(''));
if (process.argv.includes('--hepsi')) for (const h of (arg('--safak') || '28.5,29,29.5,29.75,30,30.25,30.5,31,32').split(',').map(Number)) sonuc.safak[h.toFixed(2)] = await kare('safak-' + h.toFixed(2).replace('.', '_'), +h.toFixed(2), '', 2);
writeFileSync(join(OUT, 'seri.json'), JSON.stringify(sonuc, null, 1));
await ctx.close(); await b.close(); srv.close();
