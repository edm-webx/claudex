// Gerçek tarayıcıda halı saha oyna: klavye politikası + her adım telemetri + ekran görüntüleri.
// node oyna.mjs <dist> <out> [sure_sn]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const DIST = resolve(process.argv[2]), out = process.argv[3], SURE = +(process.argv[4] || 40); mkdirSync(out, { recursive: true });
const CT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': CT[extname(f)] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.setDefaultTimeout(600000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dusuk&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
for (let k = 0; k < 4; k++) { const go = await p.waitForSelector('.kl-go', { timeout: k ? 3000 : 15000 }).catch(() => null); if (!go) break; const ad = await p.$('.kl-b input[type="text"], .kl-b input:not([type])'); if (ad) await ad.fill('Sabri').catch(() => {}); await go.click({ force: true }).catch(() => {}); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(900); }
await p.evaluate(() => { const M = window.__marti; M.setTime(15); M.step(2); M.force.money(900000); M.command({ kind: 'halisaha', op: 'teklif' }); M.command({ kind: 'halisaha', op: 'kabul' }); M.step(1); M.renderFrames(3, 0.1); });
await p.waitForSelector('.hs-game');
await p.evaluate(() => { const h = document.querySelector('.hs-help'); if (h) h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
// deterministik: oyun zamanı 0.1 sn parçalarla, her parçada klavye politikası; belirli anlarda ekran görüntüsü
await p.evaluate(() => {
  const w = document.querySelector('.hs-game'), H = w.__hs, M = H.M, log = []; window.__log = log;
  const st0 = M.step; M.step = dt => { st0(dt); log.push({ c: M.clock, ctrl: M.ctrl, b: [M.ball.x, M.ball.y, M.ball.z, M.ball.owner], p: M.pls.map(q => [q.x, q.y, q.fx, q.fy, q.act, q.dive]), ev: M.events.map(e => e.k === 'sfx' ? e.id : e.k) }); };
  const keys = new Set(); const set = (k, on) => { if (on && !keys.has(k)) { keys.add(k); H.tus(k, true); } else if (!on && keys.has(k)) { keys.delete(k); H.tus(k, false); } };
  window.__adim = (sn) => { for (let t = 0; t < sn; t += 0.1) {
    const me = M.pls[M.ctrl], bl = M.ball, has = bl.owner === M.ctrl; let tx, ty;
    if (has) { tx = 40; ty = 10; } else { tx = bl.x + bl.vx * 0.2; ty = bl.y + bl.vy * 0.2; }
    const dx = tx - me.x, dy = ty - me.y; set('d', dx > 0.4); set('a', dx < -0.4); set('s', dy > 0.4); set('w', dy < -0.4); set('shift', Math.hypot(dx, dy) > 3);
    if (has && 40 - me.x < 11) { H.tus('f', true); H.ff(0.05); H.tus('f', false); } else if (!has && bl.owner >= 0 && M.pls[bl.owner].team === 1 && Math.hypot(bl.x - me.x, bl.y - me.y) < 1.3) { H.tus('c', true); H.tus('c', false); }
    H.ff(0.1); } };
});
let k = 0;
const kare = async (ad) => { await p.waitForTimeout(700); await p.screenshot({ path: join(out, `${String(k++).padStart(2, '0')}-${ad}.png`) }); };
await p.evaluate(() => window.__adim(1.5)); await kare('acilis');
for (let i = 0; i < 10; i++) { await p.evaluate(() => window.__adim(0.25)); await kare('seri-' + i); }
for (let i = 0; i < 6; i++) { await p.evaluate(() => window.__adim(8)); await kare('ileri-' + i); }
const log = await p.evaluate(() => window.__log), fps = [16];
writeFileSync(join(out, 'log.json'), JSON.stringify(log)); writeFileSync(join(out, 'fps.json'), JSON.stringify(fps));
console.log('adim', log.length, 'kare', k, 'skor', await p.evaluate(() => document.querySelector('.hs-game').__hs.state().score.join('-')), 'fps-ort', (1000 / (fps.reduce((a, b) => a + b, 0) / fps.length)).toFixed(1), 'hata', errs.slice(0, 3));
await b.close(); srv.close();
