// Restoran gözlemci botu (2026-11-21): oyunu bir kez açar, aşama aşama (setStage) canlı sim'i ilerletir, her aşamada aynı açılardan
// ekran görüntüsü alır ve gözlem yazar: masada / sırada müşteri, mutfak personelinin hâli, pass'lardaki tabak, salon pass'ından alınan
// tabak, mutfak/koridor içine giren müşteri (olmamalı).  DIST=dist STAGES=1,2,...,10 node tests/browser/restoran-tur.mjs <çıktı> [spot,...]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const STAGES = (process.env.STAGES || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${STAGES[0]}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Gozlem'); await go.click({ force: true }); await p.waitForFunction(() => !document.querySelector('.kl-go'), null, { timeout: 20000 }).catch(() => {}); }
await p.evaluate(() => { const M = window.__marti; try { M.command({ kind: 'esnafim', op: 'done' }); } catch {} M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul'); M.closeJobBoard?.(); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st); });
const ASM = Number(process.env.ST || 10);
await p.evaluate((ASM) => { const M = window.__marti; M.setStage(ASM); M.closeJobBoard?.(); M.closePanel?.(); for (let i = 0; i < 14; i++) { M.simCmd('hire'); M.step(0.5); } M.setTime(11); M.step(60); }, ASM);
await p.keyboard.press('Escape');
const ov = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return (s.position === 'fixed' || s.position === 'absolute') && r.width > 1000 && r.height > 600 && s.visibility !== 'hidden' && s.display !== 'none' && e.tagName !== 'CANVAS'; }).map(e => e.tagName + '#' + e.id + '.' + e.className + ' bg=' + getComputedStyle(e).backgroundColor + ' op=' + getComputedStyle(e).opacity));
console.log(ov);
const SH = JSON.parse(process.env.SH);
for (const [id, v] of Object.entries(SH)) {
  await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.setTime(11); M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.4); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); M.renderFrames(6, 0.1); }, v);
  await p.waitForTimeout(300); await p.screenshot({ path: join(out, `${String(ASM).padStart(2, '0')}-${id}.png`), timeout: 300000 });
}
await b.close(); srv.close(); process.exit(0);
