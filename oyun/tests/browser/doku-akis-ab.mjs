// PRF-15 doku akışı A/B: aynı oturumda, zaman durdurulmuşken (renderFrames dt=0) önce akış açık (uzaktaki NPC atlasları
// yarım), sonra akış kapalı (hepsi tam) aynı kare çekilir ve piksel piksel karşılaştırılır. Fark eşik altındaysa akış görünür
// hiçbir şeyi değiştirmiyor demektir. Ölçüm derlemesi gerekir (dokuAkis kancası): node tests/browser/doku-akis-ab.mjs --build [--cikti klasör]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { kulisKapat } from './kulis-kapat.mjs';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let DIST = resolve(process.env.DIST || 'dist');
if (arg('--build')) {
  DIST = mkdtempSync(join(tmpdir(), 'marti-akis-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r = spawnSync('npx', ['vite', 'build', '--mode', 'olcum', '--outDir', DIST, '--emptyOutDir'], { stdio: ['ignore', 'ignore', 'inherit'], env });
  if (r.status !== 0 || spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env }).status !== 0) process.exit(2);
}
const OUT = arg('--cikti') && arg('--cikti') !== true ? resolve(arg('--cikti')) : null; if (OUT) mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const mime = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 960, height: 540 } })).newPage();
let hata = 0; p.on('pageerror', e => { hata++; console.log('[pageerror]', String(e).slice(0, 200)); });
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3&stage=10`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
await kulisKapat(p, 'Olcum');
await p.addStyleTag({ content: 'body *{visibility:hidden !important} canvas#c{visibility:visible !important}' });   // yalnız 3B sahne (CSS animasyonlu ipucu eli farkı karıştırmasın)
const kare = n => p.evaluate(n => { const M = window.__marti; for (let k = 0; k < n; k++) M.renderFrames(1, 1e-9); }, n);   // dt 0 = 1/30 sayılır: 1e-9 ile zaman gerçekten durur
const KARE = [['orman', 806, 9, 1.0], ['orman-yakin', 806, 9, 0.45], ['karsi-isci', 20, 40, 0.6], ['bufe-musteri', 0, -4, 0.5]];
let kotu = 0;
for (const [ad, x, z, zoom] of KARE) {
  await p.evaluate(([x, z, zoom]) => { const M = window.__marti; M.dokuAkis(false); M.teleport(x, z); M.setTime(13); M.camera({ zoom }); M.step(20); for (let k = 0; k < 12; k++) M.renderFrames(2, 0.1); }, [x, z, zoom]);
  await p.waitForTimeout(1200); await kare(80);   // akış yerleşsin (kare başına en çok bir yeniden çizim)
  const d0 = await p.evaluate(() => window.__marti.dokuAkis());
  const A = await p.screenshot({ timeout: 180000 });
  await p.evaluate(() => window.__marti.dokuAkis(true)); await kare(Math.max(10, d0.kayit + 10));
  const d1 = await p.evaluate(() => window.__marti.dokuAkis());
  const B = await p.screenshot({ timeout: 180000 });
  const a = PNG.sync.read(A), bb = PNG.sync.read(B), diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, bb.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const oran = n / (a.width * a.height);
  if (OUT) { writeFileSync(join(OUT, ad + '-akis.png'), A); writeFileSync(join(OUT, ad + '-tam.png'), B); writeFileSync(join(OUT, ad + '-fark.png'), PNG.sync.write(diff)); }
  const ok = oran < 0.002; if (!ok) kotu++;
  console.log(`${ok ? 'aynı ' : 'FARKLI'} ${ad.padEnd(13)} fark %${(oran * 100).toFixed(3)} (${n} px)  akış: ${d0.kayit} NPC atlası, basamak ${JSON.stringify(d0.seviye ?? {})} -> zorla: ${d1.tam} tam`);
}
await b.close(); srv.close();
console.log(kotu || hata ? 'KIRMIZI' : 'YEŞİL: akış görünür pikseli değiştirmiyor');
process.exit(kotu || hata ? 1 : 0);
