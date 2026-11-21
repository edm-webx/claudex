// DNY-01/02/03/15/19: yaşayan sokak çekimleri. node tests/browser/sokak.mjs <klasör> [--only=ad,ad]
// Her çekim: saat kur, kahramanı yere ışınla, kalabalık yayılsın diye sim'i ilerlet, kamerayı noktaya tut, çek.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2] || 'calisma/sokak'; mkdirSync(out, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null);
if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Sabri'); await go.click({ force: true }); await p.waitForTimeout(900); await p.evaluate(() => window.__marti.renderFrames(2, 0.1)); }
if (await p.$('.kl-go')) console.log('uyarı: kulis hâlâ açık');
const SHOTS = [
  { ad: 'kordon-09', saat: 9, hero: [14, 9], cam: [12, 8, 1.4] },
  { ad: 'ustgecit-13', saat: 13, hero: [22, 10], cam: [24, 20, 1.2] },
  { ad: 'meydan-13', saat: 13, hero: [-4, 40], cam: [-4, 45, 1.4] },
  { ad: 'karsi-18', saat: 18, hero: [0, 30.5], cam: [0, 33, 1.4] },
  { ad: 'iskele-14', saat: 14, hero: [-16, -6], cam: [-14, -8, 1.4] },
  { ad: 'gece-23', saat: 23, hero: [-10, 9], cam: [-6, 9, 1.4] },
  { ad: 'yakin-meydan-10', saat: 10, hero: [-4, 52], cam: [-4, 54, 0.7] },
  { ad: 'kopru-yan-12', saat: 12, hero: [20, 9], cam: [24, 12, 0.9], yaw: 1.2, tilt: -0.25 },
  { ad: 'yagmur-kordon-13', saat: 13, hero: [-20, 9], cam: [-20, 9, 1.0], hava: 'saganak' },
  { ad: 'yagmur-meydan-14', saat: 14, hero: [-4, 40], cam: [-4, 45, 1.3], hava: 'saganak' },
  { ad: 'balikci-15', saat: 15, hero: [-19, -10], cam: [-19, -9, 1.3] },
  { ad: 'balikci-guney-11', saat: 11, hero: [0, -15], cam: [0, -15, 1.6] },
  { ad: 'yakin-kordon-20', saat: 20, hero: [-30, 8], cam: [-30, 8, 0.7] },
];
for (const s of SHOTS) {
  if (only.length && !only.includes(s.ad)) continue;
  await p.evaluate(({ saat, hero, hava }) => { const M = window.__marti; M.setTime(saat); M.teleport(hero[0], hero[1]); M.havaZorla(hava || ''); }, s);
  // kalabalık yayılsın: 40 sn sim (karelerle), sonra kamera
  await p.evaluate(() => { const M = window.__marti; for (let i = 0; i < 40; i++) { M.step(1); if (i % 8 === 0) M.renderFrames(1, 0.05); } });
  await p.evaluate((s) => { const cam = s.cam; const M = window.__marti; M.camera({ x: cam[0], z: cam[1], zoom: cam[2], ...(s.yaw !== undefined ? { yaw: s.yaw } : {}), ...(s.tilt !== undefined ? { tilt: s.tilt } : {}) }); for (let i = 0; i < 6; i++) { M.step(0.1); M.renderFrames(3, 0.033); } }, s);
  const info = await p.evaluate(() => { const i = window.__marti.info(); return { crowd: i.counters?.['crowd.visible'], fps: i.fps }; });
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(out, s.ad + '.png'), timeout: 90000 });
  console.log('ok', s.ad, JSON.stringify(info));
}
console.log('hatalar:', errs.slice(0, 5).join(' | ') || 'yok');
await b.close(); srv.close();
