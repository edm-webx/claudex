// Stadyum bölgesi: oyun kamerasıyla 3 kare (HUD açık) + kuş bakışı (HUD gizli). node tests/browser/stadyum-kus.mjs <çıktı> [önek]  (önce vite build + build-artifact)
// Halı saha görsel denetimi (FUT-08/09): maç sahnesi + dünyadaki stadyum ekran görüntüleri ve çizim sayıları.
// node tests/browser/halisaha-gorsel.mjs <çıktı-klasörü> [önek] [--yalniz=mac|dunya]   (önce `npx vite build`; dist kullanılır)
// Maç: açılış, gol anı, korner, kale arkası, tribün yakın, doluluk 0.25/0.6/1, dikey. Dünya: stadyum 3 açı (+ kulüpsüz ofis).
// Maç sahnesinin hata ayıklama kancası wrap.__hs3 (ui/hali-saha-3d.ts): cam(ad|null), setFill(f), info(). Kanca yoksa
// (eski sürüm) yalnız kancasız kareler çekilir; böylece aynı betik önce/sonra karşılaştırması verir.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve, extname } from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist');
const pos = process.argv.slice(2).filter(a => !a.startsWith('--')), yalniz = (process.argv.find(a => a.startsWith('--yalniz=')) || '').split('=')[1] || '';
const out = pos[0] || 'shots-halisaha', pre = pos[1] || ''; mkdirSync(out, { recursive: true });
const CT = { '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json' };
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': CT[extname(f)] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.setDefaultTimeout(600000);   // swiftshader on a busy machine compiles the stadium shaders slowly
const errs = []; p.on('pageerror', e => errs.push(e.message));
const report = { shots: [], info: {} };
const shot = async name => { await p.waitForTimeout(400); const f = join(out, pre + name + '.png'); await p.screenshot({ path: f, timeout: 400000 }); report.shots.push(f); console.log('ok', f); };
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 90000 });
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
for (let k = 0; k < 4; k++) {   // kulis (karakter ekranı): ad yaz, sahneye çık
  const go = await p.waitForSelector('.kl-go', { timeout: k ? 3000 : 15000 }).catch(() => null); if (!go) break;
  const ad = await p.$('.kl-b input[type="text"], .kl-b input:not([type])'); if (ad) await ad.fill('Sabri').catch(() => {});
  await go.click({ force: true }).catch(() => {}); await p.evaluate(() => window.__marti.renderFrames(3, 0.1)); await p.waitForTimeout(900);
}
await p.evaluate(() => { const M = window.__marti; M.setTime(15); M.step(2); M.force.money(900000); });

await p.evaluate(() => { const M = window.__marti; M.teleport(399.5, 12.4); M.step(2); M.command({ kind: 'mulk', op: 'takim', name: 'Boğaz Yıldızları', renk: '#2ec4c4', renk2: '#ff5a4e', arma: '🦅' }); M.step(2); });
const world = async (name, x, z, o) => { await p.evaluate(([x, z, o]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 10; k++) { M.renderFrames(3, 0.1); M.step(0.5); } M.camera({ tilt: -5 }); M.camera({ x: o.cx ?? x, z: o.cz ?? z, zoomRaw: o.zr, yaw: o.yaw, tilt: o.tilt }); for (let k = 0; k < 16; k++) M.renderFrames(2, 0.1); }, [x, z, o]); await shot(name); };
const zr = +(process.env.ZR || 5), tl = +(process.env.TILT || 1.4);
await world('oyun-kamerasi-saha', 424, 16, { zr: 2.4, yaw: 0, tilt: 0.35, cz: 18 });
await world('oyun-kamerasi-sokak', 417, 6, { zr: 2.0, yaw: 0, tilt: 0.3, cz: 8 });
await world('oyun-kamerasi-bina', 398, 30.5, { zr: 1.6, yaw: 0, tilt: 0.3, cz: 27 });
await p.addStyleTag({ content: 'body *:not(#app):not(#c){visibility:hidden !important} #app,#c{visibility:visible !important}' });
await world('kus-bakisi', 422, 6, { zr, yaw: 0, tilt: tl, cx: 422, cz: 20 });
writeFileSync(join(out, pre + 'rapor.json'), JSON.stringify({ ...report, errs }, null, 1)); await b.close(); srv.close();
