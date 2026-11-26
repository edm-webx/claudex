// Martı Emlak ofisi + Martı Evleri şantiyeleri (2026-11-26). DIST=... [VW=844 VH=390] node tests/browser/santiye-shot.mjs <çıktı>
// Ofiste arsa alır, a4 dükkân / a3 dükkân / a1 ev şantiyesi kurar; üç ilerleme anında kuş bakışı + yakın çeker, ustaları sayar.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', css: 'text/css' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(DIST, p === '/' ? 'index.html' : p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p === '/' ? 'text/html' : TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset="utf-8"></head><body>' + readFileSync(f, 'utf8') + '</body></html>' : readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: Number(process.env.VW || 1280), height: Number(process.env.VH || 720) }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: !!process.env.VW })).newPage();
const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=3&saat=13`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.simCmd('money', 5e6); M.simCmd('level', 12); M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.(); M.izgara?.(false); for (let i = 0; i < 10; i++) M.step(1); const v = document.getElementById('sb-vig'); if (v) v.style.display = 'none'; });
const mulk = (o) => p.evaluate(o => { const M = window.__marti; M.command({ kind: 'mulk', ...o }); M.step(0.3); }, o);
const durum = () => p.evaluate(() => { const S = window.__marti.state(), pl = (S.zones.arsa || {}).plots || {}; return JSON.stringify(Object.entries(pl).filter(([k]) => /^a/.test(k)).map(([k, v]) => [k, v.tur, v.lv, v.insaat ? v.insaat.tur + ' ' + (1 - v.insaat.left / v.insaat.total).toFixed(2) : ''])) + ' para=' + Math.round(S.money); });
const ustalar = () => p.evaluate(() => (window.__marti.ajanlar?.() ?? []).filter(a => /insaat-a/.test(a.key || '')).length);
const go = (x, z, s = 6) => p.evaluate(([x, z, s]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < s; k++) { M.step(0.5); M.renderFrames(2, 0.1); } }, [x, z, s]);
const snap = async (n, cam) => { await p.evaluate(c => { const M = window.__marti; if (c) M.camera({ x: c[0], z: c[1], zoomRaw: c[2], yaw: c[3] * Math.PI / 2, tilt: c[4] }); for (let k = 0; k < 10; k++) { M.step(0.1); M.renderFrames(2, 0.1); } }, cam); await p.waitForTimeout(250); await p.screenshot({ path: join(out, n + '.png'), timeout: 600000 }); console.log('ok', n); };
const step = (s) => p.evaluate(s => { const M = window.__marti; for (let t = 0; t < s; t += 1) M.step(1); }, s);

// 1) away from the office: buying is refused
await mulk({ op: 'arsaAl', id: 'a4' }); console.log('uzakta al:', await durum());
// 2) at the office door
await go(66, 30.6); await snap('01-ofis', [66, 31, 1.2, 2, 0.8]);
await p.evaluate(() => document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: 'mulk', bubbles: true }))); await snap('02-ofis-panel'); await p.evaluate(() => document.querySelector('.mp-x')?.click());
await p.evaluate(() => window.__marti.command({ kind: 'force', what: 'serbest', value: 1 }));   // acilis order is not this shot's subject
for (const id of ['a4', 'a3', 'a1']) await mulk({ op: 'arsaAl', id });
console.log('ofiste al:', await durum());
await mulk({ op: 'arsaKur', id: 'a4', tur: 'dukkan', tip: 'manav' }); await step(54);
await mulk({ op: 'arsaKur', id: 'a3', tur: 'dukkan', tip: 'berber' }); await mulk({ op: 'arsaKur', id: 'a1', tur: 'ev' }); await step(25);
console.log('A:', await durum(), 'ustalar', await ustalar());
await go(70.3, 47); await snap('03-santiye-A', [70.3, 42, 1.6, 2, 0.75]);
await snap('04-a3-kepce', [73, 36, 0.8, 1, 0.7]);
await snap('05-a4-mikser', [72, 44, 0.8, 1, 0.7]);
await step(60); console.log('B:', await durum(), 'ustalar', await ustalar());
await snap('06-santiye-B', [70.3, 42, 1.6, 2, 0.75]);
await snap('07-a1-ev-duvar', [67.5, 42, 0.8, 3, 0.7]);
await snap('08-a4-vinc', [72, 44, 1.0, 1, 0.7]);
await step(42); console.log('C:', await durum(), 'ustalar', await ustalar());
await snap('09-santiye-C', [70.3, 42, 1.6, 2, 0.75]);
await p.evaluate(() => document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: 'holding', bubbles: true }))); await snap('10-mulklerim'); await p.evaluate(() => document.querySelector('.mp-x')?.click());
console.log('hatalar:', errs.length);
await b.close(); srv.close(); process.exit(0);
