// Vapur geri geldi (2026-11-27): yanaşan vapur, inen yolcular, gece ampulleri. node tests/browser/vapur-shot.mjs <çıktı> [STAGE=1]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', opus: 'audio/ogg' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGE = Number(process.env.STAGE || 1);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGE}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.step(0.5); M.command({ kind: 'esnafim', op: 'set', data: { ad: 'Olcum' } }); M.command({ kind: 'esnafim', op: 'done' }); M.step(0.5); document.querySelector('.ka-go')?.click(); M.step(0.5); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sb-vig,#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
const shot = async (name, hour, simT, cam, kind) => {
  const info = await p.evaluate(([hour, simT, cam, kind]) => {
    const M = window.__marti; if (hour != null) M.setTime(hour); if (kind) M.simCmd('ferry', kind === 'x' ? undefined : kind);
    for (let t = 0; t < simT; t += 0.5) { M.step(0.5); M.renderFrames(1, 0.5); }
    M.camera(cam); for (let k = 0; k < 10; k++) { M.step(0.1); M.renderFrames(2, 0.1); }
    return M.ferry?.();
  }, [hour, simT, cam, kind]);
  await p.waitForTimeout(200); await p.screenshot({ path: join(out, name + '.png'), timeout: 600000 }); console.log('ok', name, JSON.stringify(info?.rt), info?.info?.cur, info?.view?.ferryVisible);
};
const yakin = { x: 20, z: -6, zoomRaw: 1.7 };
await shot('1-yanasiyor', 11, 6, { x: 24, z: -16, zoomRaw: 2.4 }, 'x');
await shot('2-yanasti', null, 5, yakin);
await shot('3-yolcular-yuruyor', null, 5, { x: 16, z: -4, zoomRaw: 1.8 });
await shot('4-ayriliyor', null, 24, { x: 22, z: -18, zoomRaw: 2.6 });
await shot('5-gece-vapur', 22.5, 60, { x: 24, z: -10, zoomRaw: 2.2 });
await shot('6-gece-yanasti', null, 14, { x: 24, z: -10, zoomRaw: 2.2 }, 'tatli');
console.log('hatalar', errs.slice(0, 5));
await b.close(); srv.close(); process.exit(0);
