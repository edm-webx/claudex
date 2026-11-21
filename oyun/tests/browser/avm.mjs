// AVM mağazaları çekimi (2026-11-20): node tests/browser/avm.mjs <çıktı> [bos]   (önce: npx vite build)
// Lokanta (k5) + Martı Moda (k7) + Tekno Martı (k8) + Oyuncak Dünyası (k9): 5. seviye, tüm aletler, 2-3 işçi, canlı müşteri.
// "bos" verilirse hiçbiri alınmaz (satılık boş dükkânlar). deviceScaleFactor 1.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true }); const bos = process.argv[3] === 'bos';
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); p.on('console', m => { if (/error/i.test(m.type() + m.text())) console.log('[c]', m.text().slice(0, 300)); }); p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 400)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate((bos) => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); for (const id of ['sb-vig']) { const v = document.getElementById(id); if (v) v.style.display = 'none'; }
  M.simCmd('money', 9e9); M.simCmd('level', 40);
  if (bos) return;
  const all = { k5: ['benmari', 'corba_kazan', 'pide_firin', 'cay_ocak', 'ocakbasi', 'doner', 'tatli_vitrin', 'led_menu', 'sef_ocak'],
    k7: ['askilik', 'manken', 'prova', 'ayna', 'ayakkabi', 'aksesuar', 'led_vitrin', 'tasarim'], k8: ['demo_masa', 'tamir', 'tv_duvar', 'kulaklik_stand', 'konsol', 'vr', 'drone', 'led_e'],
    k9: ['pelus_sepet', 'balon', 'tren_pist', 'lego_duvar', 'oyun_kale', 'maskot', 'hediye_paket', 'led_o'] };
  for (const id of Object.keys(all)) { M.command({ kind: 'mulk', op: 'adminKafe', id, n: 5 }); for (let i = 0; i < 3; i++) M.command({ kind: 'mulk', op: 'adminIsci', id }); for (const e of all[id]) M.command({ kind: 'mulk', op: 'kafeEsya', id, e }); }
  const h = M.sim ? null : null; void h;
  for (let i = 0; i < 24; i++) M.step(5);
  M.step(1); }, bos);
// x = room centre (content/ic-mekan.ts), camera yaw index 2 looks from the door side into the room
const SPOTS = { dis: [20.15, 41.5, 2, 3.2], dis_yakin: [19.5, 44.2, 2, 2.2], lokanta: [26.0, 49.5, 2, 2.0], moda: [21.45, 49.5, 2, 2.0], tekno: [17.55, 49.5, 2, 2.0], oyuncak: [13.65, 49.5, 2, 2.0], ust: [20.15, 51.0, 2, 3.4] };
for (const id of Object.keys(SPOTS).filter(k => !process.argv[4] || process.argv[4].split(',').includes(k))) {
  const [x, z, yi, zr] = SPOTS[id];
  await p.evaluate(([x, z, yi, zr]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 8; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x, z, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt: 0.75 }); for (let k = 0; k < 20; k++) M.renderFrames(2, 0.1); }, [x, z, yi, zr]);
  await p.waitForTimeout(300); await p.screenshot({ path: join(out, (bos ? 'bos-' : '') + id + '.png'), timeout: 300000 }); console.log('ok', id);
}
const st = await p.evaluate(() => { const M = window.__marti; try { return JSON.stringify(M.simState ? M.simState().zones.arsa.plots : null); } catch (e) { return String(e); } });
console.log('plots', st && st.slice(0, 600));
await b.close(); srv.close();
