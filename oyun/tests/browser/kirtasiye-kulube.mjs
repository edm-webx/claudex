// Karşı yaka dükkânları denetimi (2026-11-22): beş dükkân (kafe, bistro, kırtasiye, kantin, kafeterya) tüm aletleri alınmış, işçili,
// müşterili halde içeriden ve dışarıdan ekran görüntüsü.  LV=5 node tests/browser/karsi-dukkan.mjs <çıktı> [id,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGE = Number(process.env.STAGE || 10);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGE}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');   // ad boşsa panel kapanmaz (sim duraklı kalır)


await p.evaluate(() => { const M = window.__marti; M.step(0.5); M.step(0.5); M.command({ kind: 'esnafim', op: 'set', data: { ad: 'Olcum' } }); M.command({ kind: 'esnafim', op: 'done' }); M.step(0.5); document.querySelector('.ka-go')?.click(); M.step(0.5); M.simCmd('money', 9e9); M.simCmd('level', 40); M.izgara(false); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sb-vig,#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
const SP = { dis: [26, 31, 27, 35, 1.6, 0, 0.9], yan: [22, 31, 26, 34.5, 1.3, 1, 0.8], ust: [26, 31, 27, 35, 2.4, 0, 1.2] };
for (const id of (process.argv[3] || Object.keys(SP).join(',')).split(',')) {
  const [x, z, cx, cz, zr, yi, tilt] = SP[id];
  await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(12); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
  await p.waitForTimeout(250); await p.screenshot({ path: join(out, id + '.png'), timeout: 600000 }); console.log('ok', id);
}
console.log(errs.slice(0,5));
await b.close(); srv.close(); process.exit(0);
