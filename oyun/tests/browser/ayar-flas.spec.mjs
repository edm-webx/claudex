// 2026-11-27 kullanıcı: menüden "Akıcı" seçince ekran şiddetli flaşladı (epilepsi). Kök neden: akıcıda FXAA geçişi açık, composer
// karede 3 kez swap ediyordu (OutputPass + GRADE + FXAA) = tek sayı; okuma/yazma tamponu her karede yer değiştirdi ve sahne bir karede
// MSAA+derinlikli hedefe, bir sonrakinde derinliksiz hedefe çizildi (30 Hz yanıp sönme). Bu test her kademeyi menüdeki yoldan
// (quality.set) seçer, kare kare canvas görüntüsü alır ve ardışık kareler arasında parlaklık/piksel sıçraması olmadığını doğrular.
// node tests/browser/ayar-flas.spec.mjs [dist] [çıktı]   (dist: npx vite build --mode olcum --outDir dist-olcum)
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const { PNG } = require('pngjs');
const DIST = resolve(process.argv[2] || 'dist-olcum'), OUT = resolve(process.argv[3] || 'tests/browser/shots-ayar-flas'); mkdirSync(OUT, { recursive: true });
if (!existsSync(join(DIST, 'index.html'))) {   // ölçüm yapısı yoksa kendisi kurar (setStage/setTime kancaları ölçüm modunda açık)
  const { execSync } = await import('node:child_process');
  execSync(`npx vite build --mode olcum --outDir ${DIST} && node tools/build-artifact.mjs`, { stdio: 'inherit', env: { ...process.env, MARTI_DIST: DIST } });
}
const types = { '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(readFileSync(join(DIST, 'index.html'))); } const f = join(DIST, p); if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
p.on('pageerror', e => console.log('[hata]', e.message.slice(0, 200)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
await p.evaluate(() => { window.__marti.play('sabri'); window.__marti.renderFrames(2, 0.1); });
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'esnafim', op: 'done' }); M.setStage(3); M.setTime(11); M.teleport(-2, -4); M.step(1); M.camera({ x: -2, z: -6, zoomRaw: 1.0, yaw: 0.4, tilt: -10 }); M.camera({ tilt: 0.5 }); M.renderFrames(3, 0.05); });
await p.evaluate(() => document.querySelectorAll('.ka-root, .hud, #hud').forEach(e => { e.style.visibility = 'hidden'; }));
// ekranda görüneni ölç (compositor çıktısı): her renderFrame'den sonra sayfa görüntüsü
const kare = async () => { await p.evaluate(() => window.__marti.renderFrames(1, 0)); return 'data:image/png;base64,' + (await p.screenshot({ timeout: 300000 })).toString('base64'); };
const oku = u => PNG.sync.read(Buffer.from(u.split(',')[1], 'base64'));
const lum = png => { let s = 0; const d = png.data; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); };
const fark = (a, b2) => { let n = 0; for (let i = 0; i < a.data.length; i += 4) { if (Math.abs(a.data[i] - b2.data[i]) + Math.abs(a.data[i + 1] - b2.data[i + 1]) + Math.abs(a.data[i + 2] - b2.data[i + 2]) > 60) n++; } return n / (a.data.length / 4); };
const rows = []; let bad = 0;
for (const t of ['dengeli', 'akici', 'sahane', 'akici', 'dengeli', 'auto']) {
  await p.evaluate(t => window.__marti.setTier(t), t);
  const L = [], F = []; let prev = null;
  for (let i = 0; i < 8; i++) { const u = await kare(); const png = oku(u); if (i < 5) writeFileSync(join(OUT, `${rows.length}-${t}-${i}.png`), Buffer.from(u.split(',')[1], 'base64')); L.push(+lum(png).toFixed(1)); if (prev) F.push(+fark(prev, png).toFixed(3)); prev = png; }
  const g = await p.evaluate(() => window.__marti.gfx());
  const dL = Math.max(...L.slice(1).map((v, i) => Math.abs(v - L[i]))), mF = Math.max(...F);
  const ok = dL < 3 && mF < 0.25 && g.postBufOk !== false;
  if (!ok) bad++;
  rows.push({ t, tier: g.tier, msaa: g.msaa, post: g.post, postBufOk: g.postBufOk, L, maxLumSicrama: +dL.toFixed(1), maxPikselFark: mF, ok });
  console.log(ok ? 'OK  ' : 'FLAŞ', t.padEnd(8), 'lum', L.join(' '), 'Δlum', dL.toFixed(1), 'piksel', mF, 'postBufOk', g.postBufOk, 'post', g.post, 'msaa', g.msaa, 'tm', g.toneMapping);
}
writeFileSync(join(OUT, 'sonuc.json'), JSON.stringify(rows, null, 1));
await b.close(); srv.close();
if (bad) { console.log(`${bad} kademede ardışık kareler arasında flaş var`); process.exit(1); }
console.log('ayar-flas: tüm kademelerde kare kare kararlı');
