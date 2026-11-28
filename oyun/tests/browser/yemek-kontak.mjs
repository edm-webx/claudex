// Ürün kontağı (2026-11-25): her yiyecek / içecek / dükkân ürününün modeli yan yana. node tests/browser/yemek-kontak.mjs <çıktı klasörü>
// Çıktı: kontak-<grup>.png (sonra) ve kontak-<grup>-once.png (eski: düz tabak + renk topu / aile modeli).
import { createRequire } from 'node:module'; import { mkdirSync } from 'node:fs'; import { join } from 'node:path';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const { createServer } = await import('vite');
const out = process.argv[2] || 'calisma/urun-gorsel/shots'; mkdirSync(out, { recursive: true });
const srv = await createServer({ server: { port: 0 }, logLevel: 'error' }); await srv.listen(); const port = srv.config.server.port || srv.httpServer.address().port;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0;
for (const grup of (process.env.GRUP || 'mutfak,dukkan,esya').split(',')) for (const once of process.env.ONCE === '0' ? [false] : [false, true]) {
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`http://127.0.0.1:${port}/tests/browser/yemek-kontak.html?grup=${grup}${once ? '&once' : ''}`);
  const r = await p.waitForFunction(() => window.__bitti, null, { timeout: 120000 }).then(h => h.jsonValue());
  await p.setViewportSize({ width: r.W, height: r.H }); await p.waitForTimeout(200);
  const f = join(out, `kontak-${grup}${once ? '-once' : ''}.png`); await p.screenshot({ path: f, fullPage: true });
  console.log(errs.length ? 'FAIL' : 'ok  ', f, r.n, 'ürün', errs.slice(0, 3).join(' | ')); if (errs.length) fail++; await p.close();
}
await b.close(); await srv.close(); process.exit(fail ? 1 : 0);
