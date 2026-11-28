// GRS-17: kademe döngüsü. node tests/browser/kademe.mjs <dist (--mode olcum)> <çıktı-klasörü>
// ?tier=akici ile açar, ısıtır, sonra dengeli -> sahane -> akici -> sahane geçer; her geçişte gfx(), info().programs, karede doğan
// program sayısı (warmStats.born.draw farkı) ve ekran görüntüsü. 1280x720, DPR 1. Sayılar SwiftShader'da da geçerli (süreler değil).
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const { PNG } = require('pngjs');
const DIST = resolve(process.argv[2] || 'dist'), OUT = resolve(process.argv[3] || 'shots-kademe'); mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
p.on('pageerror', e => console.log('[hata]', e.message.slice(0, 200)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=akici&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
const lum = buf => { const png = PNG.sync.read(buf); let s = 0; const d = png.data; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setStage(3); M.setTime(11); M.teleport(-2, -4); M.step(1);
  M.camera({ x: -2, z: -6, zoomRaw: 1.0, yaw: 0.4, tilt: -10 }); M.camera({ tilt: 0.5 }); for (let k = 0; k < 20; k++) M.renderFrames(1, 0.1); });
await p.waitForTimeout(4000);
const wait = async () => { for (let i = 0; i < 120; i++) { if (!(await p.evaluate(() => window.__marti.warmBusy?.()))) return; await p.evaluate(() => window.__marti.renderFrames(1, 0.05)); await p.waitForTimeout(250); } };
const rows = [];
for (const t of ['akici', 'dengeli', 'sahane', 'akici', 'sahane']) {
  const before = await p.evaluate(() => ({ prog: window.__marti.info().programs, draw: window.__marti.warmStats()?.born.draw ?? 0 }));
  await p.evaluate(t => window.__marti.setTier(t), t);
  await wait();
  const row = await p.evaluate(() => { const M = window.__marti; M.camera({ tilt: -10 }); M.camera({ tilt: 0.5 }); for (let k = 0; k < 10; k++) M.renderFrames(1, 0.1); const ws = M.warmStats(); return { gfx: M.gfx(), prog: M.info().programs, draw: ws?.born.draw ?? 0, lastDrawBorn: ws?.lastDrawBorn?.slice(-6) ?? [], lights: M.lights?.() }; });
  const buf = await p.screenshot({ path: join(OUT, `${rows.length}-${t}.png`), timeout: 300000 });
  const r = { tier: t, programsBefore: before.prog, programsAfter: row.prog, drawBorn: row.draw - before.draw, lum: +lum(buf).toFixed(2), gfx: row.gfx, lastDrawBorn: row.lastDrawBorn, lightPool: row.lights?.pool ?? row.lights?.lights ?? null };
  rows.push(r);
  console.log(t.padEnd(8), 'db', `${r.gfx.drawingBuffer.w}x${r.gfx.drawingBuffer.h}`, 'prog', r.programsBefore, '->', r.programsAfter, 'karede-doğan', r.drawBorn, 'lum', r.lum, 'gölge', r.gfx.shadowMapSize, 'ext', r.gfx.shadowExt, 'bloom', r.gfx.bloomEnabled, 'msaa', r.gfx.msaa, 'envK', r.gfx.envK, 'castShadow', r.gfx.castShadow, 'post', r.gfx.post, r.drawBorn ? 'yeni: ' + r.lastDrawBorn.join(' ') : '');
}
writeFileSync(join(OUT, 'kademe.json'), JSON.stringify(rows, null, 1));
await b.close(); srv.close();
