// PRF-15 sızıntı teşhisi: tests/browser/sizinti.mjs turunu alt adımlara (rota, büfede 45 sn, kademe, saat, ev, kulis) böler; her adımdan
// sonra doku/geometri sayısı ve canlı GL dokularının boyut farkı yazılır: hangi adımın ve hangi boyutta dokunun biriktiği görülür.
//   node tests/browser/sizinti-teshis.mjs <DIST> [tur=4]   (ör. 2026-11-21: büfe zemini kir dokusu 512x512 ve fiş plakası 96x96 böyle bulundu)
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const { gpuBellekKanca } = await import('../../tools/gpu-bellek-kanca.mjs');
const DIST = process.argv[2], TUR = +(process.argv[3] || 4);
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 800, height: 450 } })).newPage();
p.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
await p.addInitScript(gpuBellekKanca);
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(700); }
const settle = (n = 10) => p.evaluate(n => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(2, 0.1); }, n);
const snap = () => p.evaluate(() => { const i = window.__marti.info(), g = window.__gpuBellek(100000); const sz = {}; g.enBuyuk.forEach(d => { const k = d.w + 'x' + d.h; sz[k] = (sz[k] || 0) + 1; }); return { tex: i.texs, geo: i.geos, gl: g.doku, sz }; });
await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 9e9); M.simCmd('level', 40); });
const ROTA = [[0, -2], [-16.4, 37.9], [28.6, 34.6], [50, 35.2], [18.5, 49.2], [-53.3, 44], [0, -2]];
const ADIM = {
  rota: async () => { for (const [x, z] of ROTA) { await p.evaluate(([x, z]) => window.__marti.teleport(x, z), [x, z]); await settle(8); } },
  step45: async () => { await p.evaluate(() => window.__marti.step(45)); await settle(6); },
  kademe: async () => { for (const k of ['akici', 'dengeli']) { await p.evaluate(k => window.__marti.setTier(k), k); await settle(2); } },
  saat: async () => { for (const h of [9, 20, 13]) { await p.evaluate(h => window.__marti.setTime(h), h); await settle(2); } },
  ev: async () => { await p.evaluate(() => window.__marti.command({ kind: 'dekor2', arg: 'evOpen' })); await settle(4); await p.evaluate(() => window.__marti.command({ kind: 'dekor2', arg: 'evClose' })); await settle(4); },
  kulis: async () => { await p.evaluate(() => window.__marti.command({ kind: 'esnafim', op: 'open' })); await settle(2); const kg = await p.$('.kl-go'); if (kg) { await kg.click({ force: true }); await settle(2); } },
};
const top = {};
let prev = await snap();
for (let t = 0; t < TUR; t++) {
  const line = [];
  for (const [ad, f] of Object.entries(ADIM)) {
    await f(); const s = await snap();
    const dt = s.tex - prev.tex, dg = s.geo - prev.geo;
    line.push(`${ad} tex${dt >= 0 ? '+' : ''}${dt} geo${dg >= 0 ? '+' : ''}${dg}`);
    if (t > 0) { top[ad] = top[ad] || { tex: 0, geo: 0 }; top[ad].tex += dt; top[ad].geo += dg; }
    if (t > 0 && dt > 0) { const d = []; for (const k of new Set([...Object.keys(s.sz), ...Object.keys(prev.sz)])) { const x = (s.sz[k] || 0) - (prev.sz[k] || 0); if (x) d.push(k + (x > 0 ? '+' : '') + x); } line.push(`  [${d.join(' ')}]`); }
    prev = s;
  }
  console.log(`tur ${t + 1}: tex=${prev.tex} geo=${prev.geo} gl=${prev.gl} | ${line.join(', ')}`);
}
console.log('tur 2+ toplam:', JSON.stringify(top));
await b.close(); srv.close();
