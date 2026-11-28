// Devlet Hastanesi içi çekimi (2026-11-28): node tests/browser/hastane.mjs <çıktı> [id,id,...]   (önce: npx vite build && node tools/build-artifact.mjs)
// Her nokta: [kahraman x, z, kat, kamera x, z, zoomRaw, yaw (×π/2), tilt, saat]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: Number(process.env.DSF || 1) })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=6`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Denetci');
await p.evaluate(() => { const M = window.__marti; M.setTime(11); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40);
  M.closeJobBoard?.(); M.closePanel?.(); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  if (!new URLSearchParams(location.search).get('ui')) { const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); } });
const C = 1500;
const SPOTS = {
  dis: [46.95, 47.6, 0, 46.95, 51, 3.4, 0, 0.62],
  lobi: [C, 46.0, 0, C, 49, 3.6, 0, 0.85], kabul: [C - 11, 47.6, 0, C - 11, 49, 2.0, 0, 0.75], bekleme: [C + 9, 46.8, 0, C + 9.5, 47.5, 2.2, 0, 0.75],
  acil: [C - 4.6, 54.5, 0, C - 10, 54.5, 2.6, 0, 0.9], radyoloji: [C - 4.6, 63.5, 0, C - 10, 63.5, 2.6, 0, 0.9],
  eczane: [C + 4.6, 54.5, 0, C + 10, 54.5, 2.6, 0, 0.9], kafeterya: [C + 4.6, 63.5, 0, C + 10, 63.5, 2.6, 0, 0.9],
  merdiven: [C - 2.4, 51.0, 0, C, 56, 2.8, 0, 0.7], asansor: [C, 65.6, 1, C, 64, 2.6, 0, 0.7],
  dahiliye: [C - 4.6, 54.5, 1, C - 10, 54.5, 2.6, 0, 0.9], cocuk: [C - 4.6, 63.5, 1, C - 10, 63.5, 2.6, 0, 0.9], disci: [C + 4.6, 54.5, 1, C + 10, 54.5, 2.6, 0, 0.9], lab: [C + 4.6, 63.5, 1, C + 10, 63.5, 2.6, 0, 0.9],
  servis: [C - 4.6, 54.5, 2, C - 10, 54.5, 2.6, 0, 0.9], yenidogan: [C + 4.6, 54.5, 2, C + 10, 54.5, 2.6, 0, 0.9], fizik: [C + 4.6, 63.5, 2, C + 10, 63.5, 2.6, 0, 0.9],
  ameliyat: [C - 2.4, 54.5, 3, C - 9, 54.5, 2.6, 0, 0.9], yogun: [C - 4.6, 63.5, 3, C - 10, 63.5, 2.6, 0, 0.9], bashekim: [C + 4.6, 54.5, 3, C + 10, 54.5, 2.6, 0, 0.9], nobet: [C + 4.6, 63.5, 3, C + 10, 63.5, 2.6, 0, 0.9],
  oyun0: [C - 4.6, 55.2, 0, 0], oyun1: [C + 6, 47.2, 0, 0], oyun2: [C - 4.6, 55.2, 2, 0], oyunDis: [46.95, 47.0, 0, 0],
  genel0: [C, 48.5, 0, C, 56, 5.0, 0, 1.05], genel2: [C, 48.5, 2, C, 56, 5.0, 0, 1.05],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  const s = SPOTS[id]; if (!s) { console.log('?', id); continue; }
  const [x, z, kat, cx, cz, zr, yi, tilt, saat] = s;
  try {
    await p.evaluate(([x, z, kat, cx, cz, zr, yi, tilt, saat]) => { const M = window.__marti; if (saat) M.setTime(saat); M.teleport(x, z, kat); M.closePanel?.(); document.querySelectorAll('.sb-modal,.sb-full').forEach(e => e.remove()); for (let k = 0; k < 8; k++) { M.step(0.5); M.renderFrames(3, 0.1); } if (cx) M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, kat, cx, cz, zr, yi, tilt, saat]);
    await p.waitForTimeout(500); await p.screenshot({ path: join(out, `hst-${id}.png`), timeout: 300000 }); console.log('ok', id);
  } catch (e) { console.log('ERR', id, e.message.slice(0, 200)); }
}
const info = await p.evaluate(() => { const M = window.__marti; return { ajan: M.ajanlar?.()?.length ?? null, poz: M.heroPoz?.() ?? null, cizim: M.drawCost?.() ?? null }; }).catch(e => ({ e: e.message }));
writeFileSync(join(out, 'hst-hatalar.txt'), errs.join('\n') + '\n' + JSON.stringify(info)); console.log('hata', errs.length, JSON.stringify(info).slice(0, 400));
await b.close(); srv.close(); process.exit(0);
