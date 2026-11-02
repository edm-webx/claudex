// Hızlı ekran görüntüsü aracı. node tests/browser/shot.mjs <çıktı.png> [x z] [--tab=lig|stadyum|...] [--match] [--time=12] [--w=1280 --h=720]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const args = process.argv.slice(2), out = args[0], nums = args.slice(1).filter(a => !a.startsWith('--')).map(Number), flag = n => (args.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: +(flag('w') || 1280), height: +(flag('h') || 720) } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(t => { const M = window.__marti; if (t) M.setTime(+t); M.step(2); }, flag('time'));
if (nums.length >= 2) await p.evaluate(([x, z]) => window.__marti.teleport(x, z), nums);
await p.evaluate(() => { for (let i = 0; i < 8; i++) { window.__marti.renderFrames(5, 0.1); window.__marti.step(1); } });
if (args.includes('--club')) { await p.evaluate(() => { const M = window.__marti; M.force.money(500000); M.teleport(399.5, 12.4); M.step(2); M.command({ kind: 'mulk', op: 'takim', name: 'Boğaz Yıldızları', renk: '#2ec4c4', renk2: '#ff5a4e', arma: '🦅' }); M.step(2); }); if (nums.length >= 2) await p.evaluate(([x, z]) => window.__marti.teleport(x, z), nums); await p.evaluate(() => { for (let i = 0; i < 8; i++) { window.__marti.renderFrames(5, 0.1); window.__marti.step(1); } }); }
if (flag('tab')) { await p.evaluate(() => { const M = window.__marti; M.force.money(500000); });
  const mb = await p.$('.sb-bi[data-id="mulk"]'); if (mb) await mb.click({ force: true }); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(500); const t = await p.$(`[data-tab="${flag('tab')}"]`); if (t) await t.click({ force: true }); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(500); if (flag('scroll')) { await p.evaluate(y => { const b = document.querySelector('.mp-body'); if (b) b.scrollTop = +y; }, flag('scroll')); await p.waitForTimeout(300); } }
if (args.includes('--match')) { await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'halisaha', op: 'teklif' }); M.command({ kind: 'halisaha', op: 'kabul' }); M.step(1); M.renderFrames(3, 0.1); }); await p.waitForSelector('.hs-game'); await p.evaluate(() => document.querySelector('.hs-game').__hs.ff(15)); await p.waitForTimeout(800); }
if (flag('cam')) { const [cx, cz, cz2] = flag('cam').split(',').map(Number); await p.evaluate(([x, z, zm]) => { window.__marti.camera({ x, z, zoom: zm }); for (let i = 0; i < 4; i++) { window.__marti.renderFrames(4, 0.1); } }, [cx, cz, cz2]); }
await p.waitForTimeout(800); await p.screenshot({ path: out, timeout: 90000 });
console.log('ok', out, errs.slice(0, 3).join('|')); await b.close(); srv.close();
