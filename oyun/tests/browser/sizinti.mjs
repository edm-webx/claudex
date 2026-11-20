// PRF-15 + PRF-04: sızıntı avı. node tests/browser/sizinti.mjs   (DIST=klasör, TUR=20, SES=1 ile her turu yaz)
// Aynı rotayı TUR kez gezer (uzak bölgeler arası gidiş-geliş + kademe akıcı<->dengeli + Sabri'nin evi ve kulis aç/kapa + saat süpürme); her turdan sonra
// geometri / doku / shader programı / DOM düğümü / canlı WebGL bağlamı / yığın sayılır. Sayılar donanımdan bağımsızdır (SwiftShader'da da geçerli).
// Kırmızı: son yarıda geometri/doku/program/bağlam/DOM artıyorsa; yığın yalnız bilgi (Chromium'da gürültülü, eğim MB/tur yazılır).
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist'); const TUR = +(process.env.TUR || 20);
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
let errs = 0; p.on('pageerror', e => { errs++; console.log('[pageerror]', String(e).slice(0, 200)); });
await p.addInitScript(() => {
  const live = new Set(); window.__ctxLive = () => live.size;
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (t, ...a) { const c = gc.call(this, t, ...a); if (c && /webgl/.test(t)) { live.add(this); const ge = c.getExtension.bind(c); c.getExtension = n => { const e = ge(n); if (n === 'WEBGL_lose_context' && e && !e.__w) { const lc = e.loseContext.bind(e); e.loseContext = () => { live.delete(this); return lc(); }; e.__w = true; } return e; }; } return c; };
});
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
const settle = (n = 10) => p.evaluate(n => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(2, 0.1); }, n);
const sample = () => p.evaluate(() => { try { gc(); } catch { /* */ } const M = window.__marti, i = M.info(); return { geo: i.geos, tex: i.texs, prog: i.programs, ctx: window.__ctxLive(), dom: document.getElementsByTagName('*').length, heap: (performance.memory?.usedJSHeapSize || 0) / 1048576, calls: i.calls }; });
await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
const ROTA = [[0, -2], [-16.4, 37.9], [28.6, 34.6], [50, 35.2], [18.5, 49.2], [-53.3, 44], [0, -2]];
const rows = []; let evCalls = null;
for (let t = 0; t < TUR; t++) {
  for (const [x, z] of ROTA) { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); await settle(8); }
  for (const k of ['akici', process.env.TIER || 'dengeli']) { await p.evaluate(k => window.__marti.setTier(k), k); await settle(2); }   // kademe gidiş-geliş: bloom hedefleri serbest kalmalı
  for (const h of [9, 20, 13]) { await p.evaluate(h => window.__marti.setTime(h), h); await settle(2); }
  await p.evaluate(() => window.__marti.command({ kind: 'dekor2', arg: 'evOpen' })); await settle(4);   // Sabri'nin evi: ikinci WebGL bağlamı açılır
  if (t === 0) evCalls = await p.evaluate(() => { const M = window.__marti, f0 = M.info().frameNo; M.renderFrames(3, 0.1); return { cover: !!document.querySelector('.ev-ov'), anaKareCizildi: M.info().frameNo - f0 }; });   // PRF-04: örtülüyken ana sahne 0 kare çizer
  await p.evaluate(() => window.__marti.command({ kind: 'dekor2', arg: 'evClose' })); await settle(4);
  await p.evaluate(() => window.__marti.command({ kind: 'esnafim', op: 'open' })); await settle(2);   // kulis (karakter): üçüncü bağlam
  { const kg = await p.$('.kl-go'); if (kg) { await kg.click({ force: true }); await settle(2); } }
  const s = await sample(); rows.push(s); if (process.env.SES || t % 5 === 4 || t === 0) console.log(`tur ${String(t + 1).padStart(2)}  geo=${s.geo} tex=${s.tex} prog=${s.prog} ctx=${s.ctx} dom=${s.dom} heapMB=${s.heap.toFixed(1)}`);
}
const half = rows.slice(Math.floor(rows.length / 2));
const slope = k => { const n = half.length; if (n < 2) return 0; const xs = half.map((_, i) => i), my = half.reduce((a, r) => a + r[k], 0) / n, mx = (n - 1) / 2; let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (half[i][k] - my); den += (x - mx) ** 2; }); return num / den; };
const res = { geo: slope('geo'), tex: slope('tex'), prog: slope('prog'), dom: slope('dom'), ctx: half[half.length - 1].ctx - rows[0].ctx, heapMBTur: slope('heap') };
console.log('eğim (son yarı, tur başına):', JSON.stringify(res, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v));
console.log('ev odası açıkken (ana sahne kare sayısı 0 olmalı):', JSON.stringify(evCalls));
const bad = res.geo > 0.5 || res.tex > 0.5 || res.prog > 0.2 || res.dom > 2 || res.ctx > 0 || errs > 0 || !evCalls?.cover || evCalls.anaKareCizildi !== 0;
console.log(bad ? 'KIRMIZI: sızıntı var' : 'YEŞİL: sızıntı yok (yığın bilgi amaçlı)');
await b.close(); srv.close(); process.exit(bad ? 1 : 0);
