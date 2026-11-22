// AVM katları çekimi (2026-11-21): node tests/browser/avm-kat.mjs <çıktı> [id,id,...]   (önce: npx vite build && node tools/build-artifact.mjs)
// Bütün AVM dükkânları 5. seviye, aletler tam, 3 işçi; canlı müşteri akar. Her nokta: [kahraman x, z, kat, kamera x, z, zoomRaw, yaw (×π/2), tilt]
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
const bos = process.env.BOS === '1';
await p.evaluate((bos) => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40);
  M.closeJobBoard?.(); M.closePanel?.(); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  if (!bos) { const pm = M.panelModel?.('mulk'); void pm;
    for (const id of ['k5', 'k7', 'k8', 'k9', 'k10', 'k11', 'k12', 'k13', 'k14', 'k15', 'k16', 'k17', 'k18']) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); M.command({ kind: 'mulk', op: 'adminEsya', id }); }
  }
  M.setTime(12.3); for (let i = 0; i < 90; i++) M.step(1);
  if (!new URLSearchParams(location.search).get('ui')) { const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); } }, bos);
const C = 1200.15;   // AVM diyarı (content/avm-kat.ts AVM_OX + 20.15)
const SPOTS = {   // 2026-11-22: AVM 31 x 22 m (hol 14 m, dükkânlar 8.6 x 8.6), ön sıra z 53.3, arka sıra z 61.9
  dis: [20.15, 43.0, 0, 20.15, 47, 3.4, 0, 0.62], disYakin: [20.15, 44.6, 0, 20.15, 47.5, 2.2, 0, 0.7],
  lobi: [C, 45.0, 0, C, 48, 2.4, 0, 0.8], zemin: [C, 47.0, 0, C, 55, 4.0, 0, 1.0],
  merdiven: [C - 3.2, 52.0, 0, C, 57, 2.0, 1, 0.6],
  kat1: [C - 3.2, 61.4, 1, C, 55, 4.0, 0, 1.0], kat2: [C - 3.2, 61.4, 2, C, 55, 4.0, 0, 1.0],
  makine: [C - 9.6, 53.3, 1, C - 11.8, 53.3, 1.2, 1, 0.5], makine2: [C + 9.6, 53.3, 2, C + 11.8, 53.3, 1.2, 3, 0.5],
  dukkan: [C - 7.6, 53.3, 1, C - 10.5, 53.3, 2.0, 1, 0.8], giyim: [C - 7.6, 53.3, 0, C - 10.5, 53.3, 2.0, 1, 0.8],
  cesme: [C + 4.2, 62.4, 0, C, 61, 2.4, 2, 0.7],
  eglence: [C, 47.0, 3, C, 55, 4.0, 0, 1.0, 17.4], sinema: [C - 4.2, 53, 3, C - 9, 55.6, 2.4, 1, 0.75, 11.0], sahne: [C + 3.2, 57.6, 3, C + 8, 57.6, 2.4, 3, 0.7, 17.4], gise: [C - 6, 46.2, 3, C - 7, 45.5, 1.6, 0, 0.7, 10.1],
  sinemaBufe: [C + 11.6, 46.65, 3, C + 13.0, 46.65, 1.6, 3, 0.6, 17.4], sinemaKapi: [C + 3.6, 47.2, 3, C + 8.0, 46.65, 2.6, 3, 0.75, 17.4],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  if (id === 'yukleme') { await p.evaluate(() => { const M = window.__marti; M.setTime(19.5); M.teleport(20.15, 45.75, 0); for (let k = 0; k < 4; k++) { M.step(0.2); M.renderFrames(2, 0.1); } }); await p.waitForTimeout(450); await p.screenshot({ path: join(out, 'avm-yukleme.png') }); console.log('ok yukleme'); continue; }
  const s = SPOTS[id]; if (!s) { console.log('?', id); continue; }
  const [x, z, kat, cx, cz, zr, yi, tilt, saat] = s;
  try {
    await p.evaluate(([x, z, kat, cx, cz, zr, yi, tilt, saat]) => { const M = window.__marti; if (saat) M.setTime(saat); M.teleport(x, z, kat); if (saat) for (let k = 0; k < 30; k++) M.step(0.5); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, kat, cx, cz, zr, yi, tilt, saat]);
    await p.waitForTimeout(700); await p.screenshot({ path: join(out, `avm-${id}.png`), timeout: 300000 }); console.log('ok', id);
  } catch (e) { console.log('ERR', id, e.message.slice(0, 200)); }
}
writeFileSync(join(out, 'avm-hatalar.txt'), errs.join('\n')); console.log('hata', errs.length);
await b.close(); srv.close(); process.exit(0);
