// İşletme sarı kareleri (2026-11-21): sokak dükkânlarının satın alma / alet / tadilat kareleri ve büfe salonu kareleri, ekran görüntüsü.
//   node tests/browser/isletme-kare.mjs <çıktı>
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

const shot = async (name, [x, z, cx, cz, zr, yi, tilt]) => {
  await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
  await p.waitForTimeout(250); await p.screenshot({ path: join(out, name + '.png'), timeout: 600000 }); console.log('ok', name);
};
await p.evaluate(() => { const M = window.__marti; M.step(0.5); M.step(0.5); });   // kulis (karakter) paneli yukarıda kulisKapat ile kapandı
await p.evaluate(() => { const M = window.__marti; M.setTime(11); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 2); M.closeJobBoard?.(); M.closePanel?.(); });
// A) satılık: kilitli (seviye 2) ve açık (seviye 6) satın alma kareleri
await p.evaluate(() => { const M = window.__marti; M.simCmd('level', 6); M.step(1); });
await p.evaluate(() => { const v = document.getElementById('sb-vig'); if (v) v.style.display = 'none'; const st = document.createElement('style'); st.textContent = '#sb-vig,#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
await shot('a-kafeler-satilik', [-5.5, 44.7, -8, 44.7, 2.4, 0, 0.85]);
await shot('a-kirtasiye-kantin', [37, 30.4, 38, 31.5, 2.6, 0, 0.85]);
await p.evaluate(() => { const M = window.__marti; M.simCmd('level', 20); try { M.simCmd('cmd', { kind: 'setStage', stage: 7 }); } catch { /* */ }
  for (const id of ['k1', 'k2', 'k3', 'k4', 'k6']) M.command({ kind: 'mulk', op: 'arsaAl', id }); M.step(1); });
await shot('b-kafe-aletler', [-5.5, 38.5, -7.5, 39, 1.8, 0, 0.8]);
await shot('b-salonW', [-19.7, 5.5, -19.7, 2.5, 2.0, 0, 0.8]);
await shot('b-salonE', [15.6, -4.5, 15.6, -6.5, 2.0, 0, 0.8]);
await p.evaluate(() => { const M = window.__marti; const pd = M.pads().find(q => q.key.startsWith('isl.k1.')); if (pd) M.teleport(pd.x, pd.z); M.step(0.6); });
await shot('c-kafe-basinca', [-7, 40, -7.5, 39.5, 1.5, 0, 0.8]);
console.log(await p.evaluate(() => JSON.stringify(window.__marti.pads().filter(q => /^(isl|salon)\./.test(q.key)).map(q => [q.key, Math.round(q.x * 10) / 10, Math.round(q.z * 10) / 10]))));
writeFileSync(join(out, 'hatalar.txt'), errs.join('\n'));
await b.close(); srv.close(); process.exit(0);
