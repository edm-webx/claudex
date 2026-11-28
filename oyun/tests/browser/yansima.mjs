// GRS-05: su yansıması maliyeti ve kademe kapısı. Kullanım: node tests/browser/yansima.mjs <dist-klasörü (--mode olcum)> [--kademe akici,dengeli,sahane] [--json çıktı.json]
// Aynı karede yansıma kapalı/açık çizim çağrısı ve üçgen sayısı (SwiftShader: sayılar gerçek GPU ile aynı, süre değil); akıcıda hedefin hiç oluşmadığı doğrulanır.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const DIST = resolve(process.argv[2] || 'dist'), tiers = String(arg('--kademe', 'akici,dengeli,sahane')).split(',');
const types = { '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webp': 'image/webp' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {};
for (const tier of tiers) {
  const p = await (await b.newContext({ viewport: { width: 1024, height: 576 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  await kulisKapat(p, 'Olcum');
  const row = await p.evaluate(() => {
    const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setTime(18.5); M.step(2);
    const cams = [{ x: 0, z: -12, zoomRaw: 1.4, yaw: 0, tilt: -0.9 }, { x: -8, z: -9, zoomRaw: 0.9, yaw: 0.5, tilt: -0.5 }, { x: 0, z: -3, zoomRaw: 1, yaw: 0, tilt: 0 }];
    const res = [];
    for (const c of cams) {
      M.camera(c); M.renderFrames(6, 0.1);
      const sample = () => { let calls = 0, tris = 0, n = 6; for (let i = 0; i < n; i++) { M.renderFrames(1, 0.05); const f = M.info(); calls += f.calls; tris += f.tris; } return { calls: calls / n, tris: tris / n }; };
      const on = sample(); const st = M.yansima ? M.yansima() : null;
      if (M.yansima) M.yansima(false); M.renderFrames(4, 0.1); const off = sample();
      res.push({ on, off, st }); if (M.yansima) M.yansima(true);
    }
    return res;
  });
  out[tier] = row;
  for (const r of row) console.log(tier.padEnd(8), 'kapalı', Math.round(r.off.calls), 'çağrı', Math.round(r.off.tris), 'üçgen | açık', Math.round(r.on.calls), 'çağrı', Math.round(r.on.tris), 'üçgen | fark', (100 * (r.on.calls / r.off.calls - 1)).toFixed(1) + '%', 'hedef', r.st ? `${r.st.w}x${r.st.h} geçiş=${r.st.renders}` : 'yok');
  if (errs.length) console.log('HATA', errs.slice(0, 2).join('|'));
  await p.context().close();
}
if (arg('--json')) writeFileSync(String(arg('--json')), JSON.stringify(out, null, 1));
await b.close(); srv.close();
