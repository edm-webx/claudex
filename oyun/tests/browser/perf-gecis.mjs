// BUF-29: aşama değişiminde bufe-buyume.ts yeniden inşa maliyeti. Aşama 1'den başlar, her adımda M.setStage(n): geçiş karesindeki g.bufeBuyume (yeniden inşa) ve
// diğer kare parçalarının süresi, geçiş karesi JS süresi (taban: önceki 8 karenin ortancası), geometri / çizim sayısı değişimi.
// Kullanım: MARTI_DIST=/tmp/marti-dist node tests/browser/perf-gecis.mjs [--json calisma/perf-gecis-rapor.json] [--etiket onceki]
import { createServer } from 'node:http'; import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'; import { join, resolve, dirname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const JSON_YOL = arg('--json', null), ETIKET = arg('--etiket', 'olcum');
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : f.endsWith('.glb') ? 'model/gltf-binary' : 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
const hata = []; p.on('pageerror', e => hata.push(String(e).slice(0, 160)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=1`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { await go.click({ force: true }); await p.waitForTimeout(700); }
const gecis = {};
for (let s = 2; s <= 10; s++) {
  const o = await p.evaluate((s) => {
    const M = window.__marti, cv = document.getElementById('c'), gl = cv.getContext('webgl2') || cv.getContext('webgl');
    M.perfRecord(true);
    const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const taban = []; for (let k = 0; k < 8; k++) { const t0 = performance.now(); M.renderFrames(1, 1 / 30); taban.push(performance.now() - t0); gl && gl.finish(); }
    const g0 = M.info(); M.perfGuard(true);
    M.setStage(s);
    const t0 = performance.now(); M.renderFrames(1, 1 / 30); const gecisMs = performance.now() - t0; gl && gl.finish();
    const gG = M.perfGuard(true), g1 = M.info();
    const sonra = []; for (let k = 0; k < 6; k++) { const t1 = performance.now(); M.renderFrames(1, 1 / 30); sonra.push(performance.now() - t1); gl && gl.finish(); }
    M.perfRecord(false);
    const top = Object.entries(gG).sort((a, c) => c[1].max - a[1].max).slice(0, 6).map(([k, v]) => [k, v.max]);
    return { tabanMs: med(taban), gecisKaresiMs: gecisMs, sonraMs: med(sonra), buyumeYenidenInsaMs: gG['bufeBuyume']?.max ?? null, icMekanMs: gG['icMekan']?.max ?? null, enPahaliGuardMs: Object.fromEntries(top), geos: [g0.geos, g1.geos], calls: [g0.calls, g1.calls], tris: [g0.tris, g1.tris], texs: [g0.texs, g1.texs], programs: [g0.programs, g1.programs], heapMB: [g0.heapMB, g1.heapMB] };
  }, s);
  for (const k of ['tabanMs', 'gecisKaresiMs', 'sonraMs', 'buyumeYenidenInsaMs', 'icMekanMs']) if (typeof o[k] === 'number') o[k] = Math.round(o[k] * 100) / 100;
  gecis[s] = o; console.log(`aşama ${s - 1} -> ${s}: bufeBuyume yeniden inşa ${o.buyumeYenidenInsaMs} ms, geçiş karesi ${o.gecisKaresiMs} ms (taban ${o.tabanMs}, sonra ${o.sonraMs}), geos ${o.geos}, calls ${o.calls}, tris ${o.tris}`);
}
await b.close(); srv.close();
if (JSON_YOL) { mkdirSync(dirname(resolve(JSON_YOL)), { recursive: true }); writeFileSync(resolve(JSON_YOL), JSON.stringify({ etiket: ETIKET, gecis, hata }, null, 1) + '\n'); console.log('yazıldı:', JSON_YOL); }
process.exit(0);
