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

const shot = async (name, [x, z, cx, cz, zr, yi, tilt]) => {
  await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(12); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
  await p.waitForTimeout(250); await p.screenshot({ path: join(out, name + '.png'), timeout: 600000 }); console.log('ok', name);
};
await p.evaluate(() => { const M = window.__marti; M.step(0.5); M.step(0.5); });   // kulis (karakter) paneli yukarıda kulisKapat ile kapandı

const LV = Number(process.env.LV || 5);
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'set', data: { ad: 'Olcum' } }); M.command({ kind: 'esnafim', op: 'done' }); M.step(0.5); document.querySelector('.ka-go')?.click(); M.step(0.5); });   // kulis paneli açık kalırsa sim duraklı kalır
await p.evaluate((LV) => { const M = window.__marti; M.setTime(12); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.closeJobBoard?.(); M.closePanel?.();
  const ids = ['k1', 'k2', 'k3', 'k4', 'k6'], all = { k1: ['espresso', 'semsiye', 'vitrin', 'koltuk', 'isik', 'muzik', 'kitaplik', 'saksi', 'soba', 'barista'], k2: ['kahve_bar', 'semsiye', 'waffle_mak', 'buz_vitrin', 'isik', 'akvaryum', 'mangal', 'piyano', 'soba', 'sef_seti'], k3: ['fotokopi', 'pos', 'laminasyon', 'kitap_raf', 'vitrin_k', 'oyuncak', 'yazici3d', 'okuma'], k4: ['tost_mak', 'buzdolap', 'semaver_k', 'mikrodalga', 'meyve', 'masa_k', 'ekran_k', 'izgara_k'], k6: ['cay_mak', 'icecek_dolap', 'mac_tv', 'langirt', 'kupa', 'izgara_t', 'forma_duvar', 'vip'] };
  for (const id of ids) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: LV }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); }
  M.setTime(12.5); for (let i = 0; i < 120; i++) M.step(1);
  const st = document.createElement('style'); st.textContent = '#sb-vig,#sbui{visibility:hidden!important}'; document.head.appendChild(st); }, LV);
// [id, hero x, z, cam x, z, zoomRaw, yaw (×π/2), tilt]
const SPOTS = {
  kafe1: [-16.4, 37.9, -17.5, 37.9, 1.6, 1, 0.8], kafe1Dis: [-8, 37.9, -11, 37.9, 2.2, 1, 0.85],
  kafe2: [-16.4, 51.5, -17.5, 51.5, 1.6, 1, 0.8], kafe2Dis: [-8, 51.5, -11, 51.5, 2.2, 1, 0.85],
  kirtasiye: [28.6, 34.6, 28, 35.2, 1.4, 2, 0.8], okul: [50, 35.2, 48.85, 37.25, 2.2, 2, 0.8], tesis: [-53.3, 44, -54.1, 45.4, 2.2, 1, 0.8],
};
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  const [x, z, cx, cz, zr, yi, tilt] = SPOTS[id];
  await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(12); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
  await p.waitForTimeout(250); await p.screenshot({ path: join(out, `${LV}-${id}.png`), timeout: 600000 }); console.log('ok', id);
}
console.log(await p.evaluate(() => JSON.stringify(window.__marti.state().pos)));
writeFileSync(join(out, 'hatalar.txt'), errs.join('\n'));
await b.close(); srv.close(); process.exit(0);
