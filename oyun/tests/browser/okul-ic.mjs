// Martıköy İlkokulu içi çekimi (2026-11-28): node tests/browser/okul-ic.mjs <çıktı> [id,id,...]   (önce: npx vite build && node tools/build-artifact.mjs)
// Her nokta: [kahraman x, z, kamera x, z, zoomRaw, yaw (×π/2), tilt, saat]. Okul diyarı x 1350 (content/okul-ic.ts OKUL_OX).
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=6`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Denetci');
await p.evaluate(() => { const M = window.__marti; M.setTime(9); M.step(2); M.izgara?.(false); M.simCmd('money', 9e9); M.simCmd('level', 40);
  M.closeJobBoard?.(); M.closePanel?.(); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  { M.command({ kind: 'mulk', op: 'adminKafe', id: 'k4', n: 5 }); for (let i = 0; i < 2; i++) M.command({ kind: 'mulk', op: 'adminIsci', id: 'k4' }); M.command({ kind: 'mulk', op: 'adminEsya', id: 'k4' }); }
  if (!new URLSearchParams(location.search).get('ui')) { const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); } }).catch(e => console.log('kurulum', e.message.slice(0, 200)));
const C = 1350;
const SPOTS = {
  disKapi: [48.85, 31.2, 48.85, 36, 3.0, 0, 0.6, 9.5],
  meydan: [C + 2, 30.2, C, 36, 4.2, 0, 0.62, 8.65],
  toren: [C + 7, 33, C, 36, 2.6, 3, 0.55, 8.75],
  hol: [C, 42.5, C, 44, 1.9, 0, 0.75, 9.6],
  koridor: [C - 9, 48.25, C - 6, 48.25, 3.2, 0, 0.95, 10.45],
  sinif: [C - 20, 48.6, C - 20, 54.5, 2.1, 0, 0.85, 9.6],
  ingilizce: [C - 4.8, 48.6, C - 4.8, 54.5, 1.9, 0, 0.85, 9.6],
  muzik: [C + 12, 48.6, C + 12, 54.5, 2.1, 0, 0.85, 9.6],
  fen: [C + 12, 47.6, C + 12, 43.25, 2.0, 0, 0.85, 9.6],
  mudur: [C - 20, 47.6, C - 20, 43.25, 1.8, 0, 0.85, 9.7],
  sekreter: [C - 13, 47.6, C - 13, 43.25, 1.6, 0, 0.85, 9.7],
  ogretmen: [C - 6.5, 47.6, C - 6.5, 43.25, 1.8, 0, 0.85, 10.5],
  revir: [C + 5.5, 47.6, C + 5.5, 43.25, 1.5, 0, 0.85, 9.7],
  kutuphane: [C + 20, 47.6, C + 20, 43.25, 2.0, 0, 0.85, 10.5],
  kantin: [C + 20, 48.6, C + 20, 54.5, 2.1, 0, 0.85, 12.3],
  bahce: [C, 61, C - 3, 70, 4.4, 0, 0.7, 12.4],
  genel: [C, 61, C, 52, 7.5, 0, 1.05, 12.4],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
const perf = {};
for (const id of ids) {
  const s = SPOTS[id]; if (!s) { console.log('?', id); continue; }
  const [x, z, cx, cz, zr, yi, tilt, saat] = s;
  try {
    const r = await p.evaluate(([x, z, cx, cz, zr, yi, tilt, saat]) => { const M = window.__marti; M.teleport(0, 40, 0); M.step(0.5); M.setTime(saat - 0.1); M.teleport(x, z, 0); for (let k = 0; k < 12; k++) M.step(0.5); M.setTime(saat); for (let k = 0; k < 10; k++) { M.step(0.5); M.renderFrames(2, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); }
      const i = M.info(); return { calls: i.calls, tris: i.tris, fps: i.fps }; }, [x, z, cx, cz, zr, yi, tilt, saat]);
    perf[id] = r;
    await p.waitForTimeout(1600); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.screenshot({ path: join(out, `okul-${id}.png`), timeout: 300000 }); console.log('ok', id, JSON.stringify(r).slice(0, 200));
  } catch (e) { console.log('ERR', id, e.message.slice(0, 200)); }
}
writeFileSync(join(out, 'okul-hatalar.txt'), errs.join('\n')); writeFileSync(join(out, 'okul-perf.json'), JSON.stringify(perf, null, 1)); console.log('hata', errs.length);
await b.close(); srv.close(); process.exit(0);
