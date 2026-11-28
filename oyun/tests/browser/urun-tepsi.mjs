// Ürün görseli oyun içi çekimi (2026-11-25): 10. aşama öğle servisi; tepsi (oyuncunun elinde yemekler), mutfak pass'ı, salon.
// DIST=dist node tests/browser/urun-tepsi.mjs <çıktı> [önek]   (eski dist'te elTabak yoksa tepsi çekimi boş tepsiyle olur)
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; const on = process.argv[3] || ''; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Gozlem');
await p.evaluate(() => { const M = window.__marti; try { M.command({ kind: 'esnafim', op: 'done' }); } catch {} M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.setTime(12.5); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('level', 40); M.simCmd('unlock', 'isbul'); M.closeJobBoard?.(); M.closePanel?.();
  try { M.setStage(10); } catch { M.simCmd('cmd', { kind: 'setStage', stage: 10 }); } for (let i = 0; i < 14; i++) { M.simCmd('hire'); M.step(0.5); } M.closeJobBoard?.(); M.closePanel?.();
  const st = document.createElement('style'); st.textContent = '#sbui{visibility:hidden!important}'; document.head.appendChild(st);
  M.setTime(12.5); M.teleport(30, 8); M.step(140); M.setTime(13); });
const shot = async (id) => { await p.waitForTimeout(250); await p.screenshot({ path: join(out, on + id + '.png'), timeout: 300000 }); console.log('ok', id); };
const cam = (o) => p.evaluate((o) => { const M = window.__marti; M.camera(o); for (let k = 0; k < 5; k++) M.renderFrames(3, 0.1); }, o);
// 1) tepsi: oyuncunun elinde 4 yemek (dikdörtgen tepsi için seviye 1, yuvarlak için seviye 40)
for (const [lv, ad] of [[1, 'tepsi'], [40, 'tepsi-usta']]) {
  await p.evaluate(([lv]) => { const M = window.__marti; M.simCmd('level', lv); M.teleport(-17.6, -11.0); for (let k = 0; k < 4; k++) { M.step(0.2); M.renderFrames(2, 0.1); } if (M.elTabak) M.elTabak(['iskender', 'lahmacun', 'mercimek_corbasi', 'kunefe'], lv); }, [lv]);
  await cam({ x: -17.6, z: -11.0, zoomRaw: 0.26, yaw: Math.PI, tilt: 0.65 }); await shot(ad);
}
if (process.env.SADECE_TEPSI) { await b.close(); srv.close(); process.exit(0); }
await p.evaluate(() => { const M = window.__marti; M.elTabak?.([], 40); });
// 2) pass: mutfak pass rafında en az 3 tabak birikene kadar ilerlet
await p.evaluate(() => { const M = window.__marti; M.teleport(-2.9, -12.4); for (let i = 0; i < 240; i++) { M.step(0.5); const o = M.restoranGozlem?.(); if (o && o.passYer && o.passYer.on.length >= 3) break; } for (let k = 0; k < 4; k++) M.renderFrames(2, 0.1); });
await cam({ x: -2.9, z: -13.6, zoomRaw: 0.32, yaw: 0, tilt: 0.85 }); await shot('pass');
// 3) masa: yemek yiyen (oturan) müşterinin masası
const m = await p.evaluate(() => { const M = window.__marti; for (let i = 0; i < 120; i++) { M.step(0.5); const o = M.restoranGozlem?.(); const c = o && o.cust.filter(c => c.t >= 0 && c.s === 'eat'); if (c && c.length) return c[0]; } const o = M.restoranGozlem?.(); return o && o.cust.find(c => c.t >= 0) || null; });
console.log('masa', JSON.stringify(m));
if (m) { await p.evaluate((m) => { const M = window.__marti; M.teleport(m.x + 1.5, m.z + 1.5); for (let k = 0; k < 3; k++) { M.step(0.2); M.renderFrames(2, 0.1); } }, m); await cam({ x: m.x, z: m.z, zoomRaw: 0.35, yaw: 0, tilt: 0.85 }); await shot('masa'); }
// 4) genel restoran (garsonlar tabak taşırken)
await p.evaluate(() => { const M = window.__marti; M.teleport(0, -9); for (let k = 0; k < 6; k++) { M.step(0.3); M.renderFrames(2, 0.1); } });
await cam({ x: 0, z: -11, zoomRaw: 0.9, yaw: 0, tilt: 0.95 }); await shot('genel');
console.log('hatalar', JSON.stringify(errs.slice(0, 5)));
await b.close(); srv.close(); process.exit(0);
