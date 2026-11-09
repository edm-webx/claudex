// İç mekan çekimleri: node tests/browser/ic.mjs <çıktı> [id,id,...]   (STAGE=10 for the halls)
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('console', m => { if (/error/i.test(m.type() + m.text())) console.log('[c]', m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${process.env.STAGE || 10}${process.env.TEMA ? "&tema=1" : ""}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.setTime(+(new URLSearchParams(location.search).get('t') || 13)); M.step(2); M.izgara(false); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  M.simCmd('money', 9e9); M.simCmd('level', 40);
  const all = { k1: ['espresso', 'vitrin', 'koltuk', 'isik', 'muzik', 'kitaplik', 'saksi', 'barista'], k2: ['kahve_bar', 'waffle_mak', 'buz_vitrin', 'isik', 'akvaryum', 'mangal', 'piyano', 'sef_seti'], k3: ['fotokopi', 'pos', 'laminasyon', 'kitap_raf', 'vitrin_k', 'oyuncak', 'yazici3d', 'okuma'], k4: ['tost_mak', 'buzdolap', 'semaver_k', 'mikrodalga', 'meyve', 'masa_k', 'ekran_k', 'izgara_k'], k5: ['benmari', 'corba_kazan', 'pide_firin', 'cay_ocak', 'ocakbasi', 'doner', 'tatli_vitrin', 'led_menu', 'sef_ocak'], k6: ['cay_mak', 'icecek_dolap', 'mac_tv', 'langirt', 'kupa', 'izgara_t', 'forma_duvar', 'vip'] };
  for (const id of Object.keys(all)) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); }
  for (const e of ['semaver_dev', 'tas_firin', 'gozleme', 'bal_kaymak', 'buz_tezgah', 'mangal_e', 'akvaryum_e', 'meze_dolap', 'piyano_s', 'sarkuteri']) M.command({ kind: 'mulk', op: 'salonEsya', e });
  if (new URLSearchParams(location.search).get('tema')) { M.command({ kind: 'mulk', op: 'tema', id: 'k1', e: 'deniz' }); M.command({ kind: 'mulk', op: 'tema', id: 'k2', e: 'bohem' }); }
  M.step(1); });
const SPOTS = { kafe1: [-16.4, 37.9, 1], kafe2: [-16.4, 51.5, 1], kirtasiye: [28.6, 34.6, 2], okul: [50, 35.2, 2], avm: [18.5, 49.2, 2], tesis: [-53.3, 44, 1], banka: [11.7, 39.2, 0], hastane: [46.95, 51.5, 2], acil: [56.5, 52.2, 3], morg: [56.5, 55.5, 3], salonW: [-17.6, -12.0, 0], salonE: [15.6, -12.0, 0] };
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  const [x, z, yi] = SPOTS[id];
  await p.evaluate(([x, z, yi]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 8; k++) M.renderFrames(3, 0.1); M.camera({ x, z, zoomRaw: +(new URLSearchParams(location.search).get('zr') || 2.0), yaw: yi * Math.PI / 2, tilt: 0.75 }); for (let k = 0; k < 20; k++) M.renderFrames(2, 0.1); }, [x, z, yi]);
  await p.waitForTimeout(300); await p.screenshot({ path: join(out, id + '.png'), timeout: 300000 }); console.log('ok', id);
  if (id === 'kirtasiye' && process.env.KT) {   // first-person counter
    await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'mulk', op: 'ktAc' }); for (let k = 0; k < 40; k++) { M.step(0.1); M.renderFrames(1, 0.1); } M.camera({ reset: true }); for (let k = 0; k < 10; k++) M.renderFrames(2, 0.1); });
    await p.waitForTimeout(500); await p.screenshot({ path: join(out, 'kirtasiye-fp.png'), timeout: 300000 }); console.log('ok fp');
  }
}
await b.close(); srv.close();
