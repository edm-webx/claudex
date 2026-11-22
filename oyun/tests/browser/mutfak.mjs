// Büfe mutfağı çekimi: STAGE=10 node tests/browser/mutfak.mjs <çıktı klasörü>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage(); p.on('console', m => { if (/error/i.test(m.type() + m.text())) console.log('[c]', m.text().slice(0, 300)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=${process.env.STAGE || 10}`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.izgara(false); M.simCmd('money', 9e9); M.simCmd('unlock', 'isbul'); M.simCmd('cmd', { kind: 'setStage', stage: 10 }); for (let i = 0; i < 30; i++) { M.simCmd('hire'); M.step(1); } M.step(1); });
console.log(await p.evaluate(() => JSON.stringify(window.__marti.state().workers?.map?.(w => w.role) ?? 'n/a')));
await p.evaluate(() => { window.__marti.closeJobBoard(); window.__marti.closePanel(); window.__marti.renderFrames(2, 0.1); const h = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && /İş ve İşçi Bulma/.test(e.textContent || '')); let e = h; while (e && e.parentElement && e.parentElement.id !== 'sbui' && e.parentElement !== document.body) { if (getComputedStyle(e).position === 'absolute' || getComputedStyle(e).position === 'fixed') { if (e.getBoundingClientRect().width > 500) break; } e = e.parentElement; } if (e) e.style.display = 'none'; });
await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(500);
// BUF-07: öğle servisi: biletler, kıvılcım, duman ve kirli tabak yığını oluşsun diye sim'i ilerlet
const stepN = Number(process.env.STEPN || 120); await p.evaluate((stepN) => { const M = window.__marti; M.setTime(12.2); for (let i = 0; i < Number(0 + (stepN)); i++) M.step(1); }, stepN);
// [id, kahraman x, z, kamera zoomRaw, kamera x, kamera z]: dis = dışarıdan, ic = üstten, duvar = arka duvar (fiş rayı, menü, tava, fan), hat = ocak/ızgara hattı (buhar, duman, kıvılcım)
await p.evaluate(() => { window.__mkir = 1; });   // (geçici görünüm kancası varsa) ıslak zemin tabelasını da göster
const SHOTS = [['dis', 0, -9, 1.4, 0, -12], ['ic', 0, -14.6, 0.62, -1.5, -14.2], ['duvar', 0, -14.6, 0.62, 5.8, -16.6], ['hat', 0, -14.6, 0.5, -3.2, -15.6]].filter(r => !process.env.SHOTS || process.env.SHOTS.split(',').includes(r[0]));
for (const [id, x, z, zr, cx, cz] of SHOTS) {
  await p.evaluate(([x, z]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 8; k++) M.renderFrames(3, 0.1); }, [x, z]);
  // hat/ic: bir istasyon gerçekten pişirirken çek (görünüm hatta __mfx yayıcı sayısını yazar; yoksa beklemeden devam)
  if (id === 'hat' || id === 'ic' || id === 'duvar') await p.evaluate((id) => { const M = window.__marti; for (let i = 0; i < 300 && window.__mfx !== undefined && !(id === 'duvar' ? window.__mbil >= 2 : window.__mfx > 0); i++) { M.step(1); M.renderFrames(1, 0.05); } for (let i = 0; i < 14; i++) M.renderFrames(1, 0.07); }, id);
  await p.evaluate(([cx, cz, zr]) => { const M = window.__marti; M.camera({ x: cx, z: cz, zoomRaw: zr }); for (let k = 0; k < 6; k++) M.renderFrames(3, 0.1); }, [cx, cz, zr]);
  await p.waitForTimeout(300); await p.screenshot({ path: join(out, 'mutfak-' + id + '.png'), timeout: 300000 }); console.log('ok', id);
}
await b.close(); srv.close(); process.exit(0);
