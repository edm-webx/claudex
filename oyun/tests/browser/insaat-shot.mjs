// Görsel mantık denetçisi (2026-11-21): oyunu headless açar, bir aşamada canlı sim'i ilerletir, her bölge/iç mekânda
// birkaç açıdan ekran görüntüsü alır.  STAGE=10 node tests/browser/denetci.mjs <çıktı> [id,id,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGE = Number(process.env.STAGE || 10);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.text().startsWith('POS')) console.log(m.text()); if (m.text().startsWith('POS')) console.log(m.text()); if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGE}&saat=${process.env.SAAT||13}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate((STAGE) => { const M = window.__marti; M.setTime(Number(new URLSearchParams(location.search).get('saat')||13)); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul');
  try { M.simCmd('cmd', { kind: 'setStage', stage: STAGE }); } catch { /* */ }
  for (let i = 0; i < 12; i++) { M.simCmd('hire'); M.step(1); }
  const all = { k1: ['espresso', 'vitrin', 'koltuk', 'isik', 'muzik', 'kitaplik', 'saksi', 'barista'], k2: ['kahve_bar', 'waffle_mak', 'buz_vitrin', 'isik', 'akvaryum', 'mangal', 'piyano', 'sef_seti'], k3: ['fotokopi', 'pos', 'laminasyon', 'kitap_raf', 'vitrin_k', 'oyuncak', 'yazici3d', 'okuma'], k4: ['tost_mak', 'buzdolap', 'semaver_k', 'mikrodalga', 'meyve', 'masa_k', 'ekran_k', 'izgara_k'], k5: ['benmari', 'corba_kazan', 'pide_firin', 'cay_ocak', 'ocakbasi', 'doner', 'tatli_vitrin', 'led_menu', 'sef_ocak'], k6: ['cay_mak', 'icecek_dolap', 'mac_tv', 'langirt', 'kupa', 'izgara_t', 'forma_duvar', 'vip'], k7: [], k8: [], k9: [] };
  for (const id of Object.keys(all)) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); }
  M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.(); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  M.setTime(Number(new URLSearchParams(location.search).get('saat')||12.3)); for (let i = 0; i < 90; i++) M.step(1);
  if (!new URLSearchParams(location.search).get('ui')) { const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); } }, STAGE);
const SPOTS = JSON.parse(process.env.SPOTS);
const ids = (process.argv[3] || Object.keys(SPOTS).join(',')).split(',');
for (const id of ids) {
  const s = SPOTS[id]; if (!s) { console.log('?', id); continue; }
  const [x, z, cx, cz, zr, yi, tilt] = s;
  try {
    await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } console.log('POS', JSON.stringify(M.state().pos), M.state().paused, M.state().pauseWhy); M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, [x, z, cx, cz, zr, yi, tilt]);
    await p.waitForTimeout(250); await p.screenshot({ path: join(out, `${process.env.SAAT||13}-${id}.png`), timeout: 300000 }); console.log('ok', id);
  } catch (e) { console.log('ERR', id, e.message.slice(0, 200)); }
}
writeFileSync(join(out, `hatalar-${STAGE}.txt`), errs.join('\n'));
await b.close(); srv.close(); process.exit(0);
