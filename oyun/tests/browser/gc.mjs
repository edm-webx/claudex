// PRF-05 ölçüm kancası: node tests/browser/gc.mjs  (DIST=klasör, KARE=1800, TIER=dengeli)
// Sabit durumda (oyuncu yerinde, hareket yok) KARE kare çizilir; CDP HeapProfiler örnekleme ile kare başı ayırma (bayt) ve en büyük çağıranlar yazılır.
// SwiftShader'da da geçerlidir: ayırma JS tarafıdır, donanımdan bağımsızdır. ?noloop: kareler renderFrames ile sürülür.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist'); const KARE = +(process.env.KARE || 1800);
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } }); const p = await ctx.newPage(); p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(p);
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${process.env.TIER || 'dengeli'}&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { for (let k = 0; k < 30; k++) window.__marti.renderFrames(2, 0.1); });
await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const t = await p.evaluate(n => { const M = window.__marti, t0 = performance.now(); for (let i = 0; i < n; i++) M.renderFrames(1, 1 / 60); return performance.now() - t0; }, KARE);
const { profile } = await cdp.send('HeapProfiler.stopSampling');
// örnekleme profili: ayrılan toplam bayt (GC'de silinenler dahil değil: sampling live+collected için includeCollectedObjects yok -> burada canlı + toplanmamış). Ayrıca sayaç: toplam yığın artışı.
const agg = new Map(); let total = 0;
(function walk(n) { const self = n.selfSize || 0; if (self) { const f = n.callFrame, k = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`; agg.set(k, (agg.get(k) || 0) + self); total += self; } (n.children || []).forEach(walk); })(profile.head);
const top = [...agg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
const m = await p.evaluate(n => { const M = window.__marti; try { gc(); } catch { /* */ } const a = performance.memory.usedJSHeapSize; return a; }, KARE);
console.log(`kare: ${KARE}  süre: ${t.toFixed(0)} ms  örneklenen ayırma toplamı: ${(total / 1024).toFixed(0)} KB  =>  ${(total / KARE).toFixed(0)} bayt/kare (örnekleme, alt sınır)`);
for (const [k, v] of top) console.log(`  ${(v / KARE).toFixed(1).padStart(8)} B/kare  ${k}`);
await b.close(); srv.close();
