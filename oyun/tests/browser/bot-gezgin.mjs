// Gezgin gözlemci bot: oyunu gerçek tarayıcıda (SwiftShader) gezer: iskele, büfe, çarşı, stadyum, Belgrad; her durakta
// konsol/sayfa hatası, NaN konum, çizim sayısı, ekran görüntüsü; ardından halı saha maçı (3B katman + HUD) ve kulüp kurma.
// Kullanım: node tests/browser/bot-gezgin.mjs   (SKIP_BUILD=1 ile dist'i yeniden kullan). Çıktı: tests/browser/shots-gezgin/*.png + gezgin-rapor.json
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const DIST = resolve('dist');
if (!process.env.SKIP_BUILD) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit' });
const OUT = resolve('tests/browser/shots-gezgin'); mkdirSync(OUT, { recursive: true });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const report = { stops: [], errors: [], findings: [] };
p.on('pageerror', e => report.errors.push('PAGEERR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/supabase|Failed to load resource|ERR_/.test(m.text())) report.errors.push('CONSOLE ' + m.text()); });
const find = (sev, where, what) => { report.findings.push({ sev, where, what }); console.log(`[${sev}] ${where}: ${what}`); };
await p.goto(`${url}?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => window.__marti.play('sabri'));
await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 5000 }).catch(() => null);   // karakter kulisi: "Sahneye çık"
if (go) { await go.click(); await p.waitForTimeout(800); }
await p.evaluate(() => window.__marti.step(2));
if (await p.$('.kl-go')) console.log('uyarı: kulis hâlâ açık');
const snap = async n => { try { await p.screenshot({ path: join(OUT, n + '.png'), timeout: 60000 }); } catch (e) { await p.waitForTimeout(1500); try { await p.screenshot({ path: join(OUT, n + '.png'), timeout: 60000 }); } catch { find('warn', n, 'ekran görüntüsü alınamadı'); } } };
const stops = [['iskele-bufe', 0, 0], ['iskele-ferry', -6, 4], ['stadyum-kapi', 404, 13], ['stadyum-saha', 425, 20], ['belgrad-durak', 806, 10], ['belgrad-orman', 840, 20], ['belgrad-derin', 870, 40]];
for (const [name, x, z] of stops) {
  await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]);
  await p.evaluate(() => { window.__marti.step(2); for (let i = 0; i < 8; i++) { window.__marti.renderFrames(5, 0.1); window.__marti.step(1); } });
  const st = await p.evaluate(() => { const s = window.__marti.state(), i = window.__marti.info(); return { pos: s.pos, calls: i.calls, tris: i.tris, fps: i.fps, realm: s.realm }; });
  report.stops.push({ name, ...st }); console.log('durak', name, JSON.stringify(st));
  if (!st.pos || !Number.isFinite(st.pos.x) || !Number.isFinite(st.pos.z)) find('bug', name, 'konum NaN');
  else if (Math.abs(st.pos.x - x) > 25) find('bug', name, `ışınlanma tutmadı: istenen ${x}, olan ${st.pos.x} (bölge duvarı?)`);
  if (!(st.calls > 0)) find('bug', name, 'çizim sayısı 0');
  if (st.tris > 1.5e6) find('perf', name, 'üçgen sayısı yüksek: ' + st.tris);
  await snap(name);
}
// yürüme: her yönde sıkışma testi büfe önünde
await p.evaluate(() => window.__marti.teleport(0, 6));
for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
  const a = await p.evaluate(() => window.__marti.state().pos);
  await p.evaluate(([dx, dz]) => { window.__marti.input(dx, dz); window.__marti.step(2); window.__marti.input(null); }, [dx, dz]);
  const c = await p.evaluate(() => window.__marti.state().pos);
  if (Math.hypot(c.x - a.x, c.z - a.z) < 0.5) find('bug', 'yürüme', `(${dx},${dz}) yönünde yürüyemiyor, ${JSON.stringify(a)}`);
}
// halı saha: teklif -> kabul -> 3B maç
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'halisaha', op: 'teklif' }); M.command({ kind: 'halisaha', op: 'kabul' }); M.step(1); M.renderFrames(3, 0.1); });
await p.waitForSelector('.hs-game', { timeout: 15000 }).catch(() => find('bug', 'halısaha', 'maç ekranı açılmadı'));
const has = await p.evaluate(() => !!document.querySelector('.hs-game')?.__hs);
if (has) {
  await p.evaluate(() => document.querySelector('.hs-game').__hs.ff(20)); await p.waitForTimeout(400); await snap('halisaha-20sn');
  await p.evaluate(() => document.querySelector('.hs-game').__hs.ff(200)); await p.waitForTimeout(400);
  const hs = await p.evaluate(() => { const s = document.querySelector('.hs-game').__hs.state(); return { over: s.over, score: s.score, st: s.stats }; });
  console.log('maç', JSON.stringify(hs)); if (!hs.over) find('bug', 'halısaha', 'maç 220 sn sonunda bitmedi');
  await snap('halisaha-sonuc');
  await p.evaluate(() => document.querySelector('.hs-game').__hs.finish());
  const z = await p.evaluate(() => window.__marti.S.zones.halisaha);
  if (!z || !z.played || !z.players) find('bug', 'çetele', 'maç sonucu çeteleye işlenmedi'); else console.log('çetele oyuncu sayısı', Object.keys(z.players).length, 'form', z.form);
}
// kulüp kurma
await p.evaluate(() => { const M = window.__marti; M.force.money(200000); M.teleport(399.5, 12.4); M.step(2); });
console.log('kulüp öncesi', JSON.stringify(await p.evaluate(() => ({ para: window.__marti.S.money, pos: window.__marti.state().pos, toast: window.__marti.events(0).slice(-3) }))));
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'mulk', op: 'takim', name: 'Gezgin Spor', renk: '#2ec4c4', renk2: '#2b2b38', arma: '🐟' }); M.step(2); });
const tk = await p.evaluate(() => window.__marti.S.zones.arsa?.takim ?? null);
if (!tk || tk.ad !== 'Gezgin Spor' || tk.arma !== '🐟') find('bug', 'kulüp', 'kulüp kurulmadı: ' + JSON.stringify(tk));
const lg = await p.evaluate(() => window.__marti.rules.rt.lig.model().tablo.flat().filter(r => r.ben).map(r => r.ad));
if (!lg.some(a => a.includes('Gezgin Spor'))) find('bug', 'lig', 'lig tablosunda kulüp adı yok: ' + JSON.stringify(lg));
await p.evaluate(() => window.__marti.openPanel?.('mulk')); await p.waitForTimeout(300); await snap('panel');
if (report.errors.length) for (const e of [...new Set(report.errors)].slice(0, 10)) find('bug', 'konsol', e);
writeFileSync(join(OUT, 'gezgin-rapor.json'), JSON.stringify(report, null, 1));
console.log(`\ngezgin: ${report.stops.length} durak, ${report.findings.length} bulgu`);
await b.close(); srv.close(); process.exit(report.findings.some(f => f.sev === 'bug') ? 1 : 0);
