// Zemin/bitki önce-sonra çekimi (sokak.mjs'den türedi, HUD gizli). DIST=dist node tests/browser/zemin-shot.mjs <klasör> [--only=ad]
// (eski) sokak çekimleri. node tests/browser/sokak.mjs <klasör> [--only=ad,ad]
// Her çekim: saat kur, kahramanı yere ışınla, kalabalık yayılsın diye sim'i ilerlet, kamerayı noktaya tut, çek.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
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
await kulisKapat(p, 'Sabri');
await p.evaluate(() => { const st = document.createElement('style'); st.textContent = '#sbui,#sb-vig{visibility:hidden!important}'; document.head.appendChild(st); });
const SHOTS = [
  { ad: 'kordon-yakin', saat: 11, hero: [-8, 9], cam: [-8, 10, 0.55] },
  { ad: 'kordon-genis', saat: 11, hero: [14, 9], cam: [12, 10, 1.4] },
  { ad: 'yol-yakin', saat: 11, hero: [-6, 14], cam: [-6, 18, 0.6] },
  { ad: 'cim-yaka', saat: 12, hero: [-30, 31], cam: [-30, 36, 0.7] },
  { ad: 'karsi-genis', saat: 12, hero: [0, 40], cam: [0, 44, 1.5] },
  { ad: 'meydan-yakin', saat: 12, hero: [-4, 52], cam: [-4, 54, 0.6] },
  { ad: 'park-yakin', saat: 12, hero: [0, -6], cam: [0, -4, 0.6] },
  { ad: 'gun-batimi', saat: 18, hero: [-4, 36], cam: [-4, 38, 0.8] },
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
