// PRF-11: ilk yükleme süresi, üç ağ profilinde. node tools/yukleme-olc.mjs [--build] [--dist KLASÖR] [--profil kablolu,4g,3g] [--json çıktı.json]
// Chromium CDP Network.emulateNetworkConditions ile ağ kısıtlanır (önbellek kapalı). Her profilde ölçülen:
//   ilkBoya    : sayfanın ilk boyası (yükleme ekranı görünür; boş/siyah ekran süresi buna eşit)
//   gameJs     : game.js'in inmesi bitti
//   hazir      : __marti.ready (ilk oynanabilir kare; shader ısıtması dahil, en çok 6 sn)
//   tumVarlik  : oyun hazır olduktan sonra GLB ve dokular dahil ağ sustu (arka planda inenler)
// Ağ ve indirme süreleri donanımdan bağımsızdır; 'hazir' içindeki JS ve shader süresi SwiftShader'da gerçeğinden uzun (bilgi amaçlı).
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
let DIST = resolve(arg('--dist', 'dist'));
if (arg('--build')) {
  DIST = mkdtempSync(join(tmpdir(), 'marti-yukle-'));
  const env = { ...process.env, MARTI_DIST: DIST };
  const r1 = spawnSync('npx', ['vite', 'build', '--outDir', DIST, '--emptyOutDir'], { stdio: ['ignore', 'ignore', 'inherit'], env });
  const r2 = r1.status === 0 ? spawnSync(process.execPath, ['tools/build-artifact.mjs'], { stdio: 'inherit', env }) : r1;
  if (r2.status !== 0) { console.error('yukleme-olc: derleme başarısız'); process.exit(2); }
}
// itch.io ve çoğu statik sunucu metni (html/js) gzip'le gönderir: sunucu da öyle yapar; GLB/PNG/JPG olduğu gibi gider
const PROFIL = {
  kablolu: { latency: 5, downloadThroughput: 50e6 / 8, uploadThroughput: 10e6 / 8 },
  '4g': { latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 },
  '3g': { latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 0.75e6 / 8 },
};
const secili = String(arg('--profil', 'kablolu,4g,3g')).split(',').filter(k => PROFIL[k]);
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
const gz = new Map();
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let body, type;
  if (p === '/') { body = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); type = mime['.html']; }
  else { const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } body = readFileSync(f); type = mime[extname(f)] || 'application/octet-stream'; }
  const sik = /text|javascript/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
  if (sik) { if (!gz.has(p)) gz.set(p, gzipSync(body, { level: 9 })); body = gz.get(p); }
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', ...(sik ? { 'content-encoding': 'gzip' } : {}) }); res.end(body);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const require = createRequire(import.meta.url); const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const sonuc = {};
for (const ad of secili) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...PROFIL[ad] });
  let bayt = 0, gameJsBitti = 0, sonIstek = 0; const acik = new Set();
  cdp.on('Network.requestWillBeSent', e => { acik.add(e.requestId); });
  cdp.on('Network.loadingFinished', e => { acik.delete(e.requestId); bayt += e.encodedDataLength; sonIstek = Date.now(); });
  cdp.on('Network.responseReceived', e => { if (e.response.url.endsWith('/game.js')) p.__gameJsId = e.requestId; });
  cdp.on('Network.loadingFinished', e => { if (e.requestId === p.__gameJsId) gameJsBitti = Date.now(); });
  const t0 = Date.now();
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&tier=dengeli&seed=3`, { waitUntil: 'commit' });
  await p.waitForFunction(() => performance.getEntriesByName('first-paint').length > 0 || performance.getEntriesByType('paint').length > 0, null, { timeout: 120000, polling: 50 });
  const ilkBoya = await p.evaluate(() => Math.round((performance.getEntriesByType('paint')[0]?.startTime) || 0));
  const ekranVar = await p.evaluate(() => !!document.getElementById('yukle'));
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 300000, polling: 100 });
  const hazir = Date.now() - t0;
  // ağ sussun (2 sn boyunca açık istek yok) ya da 120 sn
  const bitis = Date.now() + 120000;
  while (Date.now() < bitis && (acik.size || Date.now() - sonIstek < 2000)) await p.waitForTimeout(250);
  const tumVarlik = sonIstek - t0;
  sonuc[ad] = { ilkBoyaMs: ilkBoya, yuklemeEkrani: ekranVar, gameJsMs: gameJsBitti ? gameJsBitti - t0 : null, hazirMs: hazir, tumVarlikMs: tumVarlik, indirilenKB: Math.round(bayt / 1024) };
  console.log(`${ad.padEnd(8)} ilk boya ${String(ilkBoya).padStart(6)} ms (yükleme ekranı ${ekranVar ? 'var' : 'YOK'})  game.js ${String(sonuc[ad].gameJsMs).padStart(6)} ms  hazır ${String(hazir).padStart(6)} ms  tüm varlık ${String(tumVarlik).padStart(6)} ms  indirilen ${sonuc[ad].indirilenKB} KB`);
  await ctx.close();
}
await browser.close(); srv.close();
const jf = arg('--json'); if (jf && jf !== true) writeFileSync(jf, JSON.stringify({ tarih: new Date().toISOString().slice(0, 16), profil: PROFIL, sonuc }, null, 1));
