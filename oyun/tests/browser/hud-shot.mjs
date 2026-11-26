// HUD envanteri (2026-11-25): oyunu UI açık açar, alt bar + mülk paneli + üst HUD ekran görüntüsü.  DIST=... node tests/browser/hud-shot.mjs <çıktı>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', css: 'text/css' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(DIST, p === "/" ? "index.html" : p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p === '/' ? 'text/html' : TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset="utf-8"></head><body>' + readFileSync(f, 'utf8') + '</body></html>' : readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: Number(process.env.VW || 1280), height: Number(process.env.VH || 720) }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: !!process.env.VW })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${process.env.STAGE || 3}&saat=13`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.simCmd('money', 2e6); M.simCmd('level', 12); for (let i = 0; i < 3; i++) { M.simCmd('hire'); M.step(1); }
  M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.();
  for (let i = 0; i < 40; i++) M.step(1); });
const snap = async n => { await p.evaluate(() => { for (let k = 0; k < 4; k++) { window.__marti.step(0.1); window.__marti.renderFrames(2, 0.1); } }); await p.waitForTimeout(300); await p.screenshot({ path: join(out, n + '.png') }); console.log('ok', n); };
await snap('01-hud');
const bar = await p.evaluate(() => [...document.querySelectorAll('#sbui *')].filter(e => e.offsetParent && e.children.length === 0 && e.textContent.trim()).slice(0, 200).map(e => e.className + ':' + e.textContent.trim().slice(0, 30)).join(' | '));
console.log('UI', bar);
for (const t of (process.env.ACTS || 'telefon,envanter').split(',')) { await p.evaluate(t => document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: t, bubbles: true })), t); await snap('02-' + t); if (t === 'telefon') await p.evaluate(() => document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: 'telefon', bubbles: true }))); else await p.keyboard.press('Escape'); }
// world spots without UI (concept backgrounds)
if (process.env.YER) { await p.addStyleTag({ content: '#sbui{visibility:hidden!important}' }); await snap('yer-bufe');
  for (const [n, sp] of Object.entries(JSON.parse(process.env.YER))) { await p.evaluate(([x, z, cx, cz, zr, yi, tilt]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 6; k++) { M.step(0.5); M.renderFrames(3, 0.1); } M.camera({ x: cx, z: cz, zoomRaw: zr, yaw: yi * Math.PI / 2, tilt }); for (let k = 0; k < 16; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, sp); await p.waitForTimeout(250); await p.screenshot({ path: join(out, 'yer-' + n + '.png'), timeout: 300000 }); console.log('ok', n); } }
await b.close(); srv.close(); process.exit(0);
