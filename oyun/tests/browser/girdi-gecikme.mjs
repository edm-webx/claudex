// PRF-10 girdi gecikmesi (sentetik rAF): tuşa basılan an ile kahramanın çizimde ilk kıpırdadığı kare arasındaki süre.
// Gerçek ekran/kompozitör gecikmesi headless'ta ölçülemez; bu yalnız oyun içi zinciri (girdi -> 30 Hz sim -> ara değer -> çizim) ölçer.
// node tests/browser/girdi-gecikme.mjs <dist>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const DIST = resolve(process.argv[2] || 'dist');
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': extname(f) === '.js' ? 'text/javascript' : 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=akici&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri'));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(500); }
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setTime(13); M.step(2); });
for (const hz of [60, 144, 30]) {
  const res = await p.evaluate(hz => {
    const M = window.__marti, dt = 1000 / hz, out = [];
    let t = 100000 + hz * 1000;
    for (let k = 0; k < 12; k++) {
      M.input(null); M.teleport(-12, 5);
      for (let i = 0; i < 20; i++) M.frame(t += dt);
      const press = t + dt * (0.1 + 0.8 * ((k * 0.37) % 1));   // the key goes down somewhere between two frames
      const x0 = M.state().pos.x;
      M.trace(true);
      M.frame(t += dt * 0); // no-op keeps trace aligned
      let first = null, half = null;
      for (let i = 0; i < 40; i++) {
        const nt = t + dt;
        if (nt >= press && i === 0) { /* */ }
        if (t < press && nt >= press) M.input(1, 0);
        if (i === 0 && t >= press) M.input(1, 0);
        M.frame(t = nt);
      }
      const tr = M.trace(false);
      for (const r of tr) { if (r[0] < press) continue; if (first === null && r[1] - x0 > 0.001) first = r[0] - press; if (half === null && r[1] - x0 > 0.05) half = r[0] - press; }
      out.push([first, half]);
    }
    return out;
  }, hz);
  const f = res.map(r => r[0]).filter(v => v !== null).sort((a, b) => a - b), h = res.map(r => r[1]).filter(v => v !== null).sort((a, b) => a - b);
  const med = a => a[a.length >> 1];
  console.log(`${hz} Hz: ilk kıpırtı medyan ${med(f).toFixed(1)} ms, en kötü ${f[f.length - 1].toFixed(1)} ms; 5 cm medyan ${med(h).toFixed(1)} ms, en kötü ${h[h.length - 1].toFixed(1)} ms (n=${f.length})`);
}
await b.close(); srv.close();
