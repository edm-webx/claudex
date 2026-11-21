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

// ---- dünya stadyumu: önce kulüpsüz ofis, sonra kulüp kurulmuş halde 3 açı
// camera tilt is a delta: reset to the lowest pitch (0.3 rad) first, so pitch = 0.3 + o.tilt
const world = async (name, x, z, o) => { await p.evaluate(([x, z, o]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 10; k++) { M.renderFrames(3, 0.1); M.step(0.5); } M.camera({ tilt: -5 }); M.camera({ x: o.cx ?? x, z: o.cz ?? z, zoomRaw: o.zr, yaw: o.yaw, tilt: o.tilt }); for (let k = 0; k < 16; k++) M.renderFrames(2, 0.1); }, [x, z, o]); await shot(name); };
if (yalniz !== 'mac') await world('dunya-ofis-kulupsuz', 414, 12.4, { zr: 1.6, yaw: 0, tilt: 0.45 });
await p.evaluate(() => { const M = window.__marti; M.teleport(399.5, 12.4); M.step(2); M.command({ kind: 'mulk', op: 'takim', name: 'Boğaz Yıldızları', renk: '#2ec4c4', renk2: '#ff5a4e', arma: '🦅' }); M.step(2); });
if (yalniz !== 'mac') {
await world('dunya-stadyum-guney', 426, 12.4, { zr: 2.4, yaw: Math.PI, tilt: 0.35, cz: 22 });
await world('dunya-stadyum-bati', 404, 18, { zr: 2.4, yaw: -Math.PI / 2, tilt: 0.35, cx: 420, cz: 20 });
await world('dunya-kulup-binasi', 416, 12.6, { zr: 1.3, yaw: 0, tilt: 0.25, cz: 9 });
}
if (yalniz === 'dunya') { writeFileSync(join(out, pre + 'rapor.json'), JSON.stringify({ ...report, errs }, null, 1)); await b.close(); srv.close(); process.exit(0); }

// ---- maç sahnesi
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'halisaha', op: 'teklif' }); M.command({ kind: 'halisaha', op: 'kabul' }); M.step(1); M.renderFrames(3, 0.1); });
await p.waitForSelector('.hs-game');
const hasHook = await p.evaluate(() => typeof document.querySelector('.hs-game').__hs3?.cam === 'function');
const hasInfo = await p.evaluate(() => typeof document.querySelector('.hs-game').__hs3?.info === 'function');
const hs = (fn, arg) => p.evaluate(([fn, arg]) => { const w = document.querySelector('.hs-game'); return new Function('w', 'arg', fn)(w, arg); }, [fn, arg]);
const frames = n => p.waitForTimeout(n * 34);
// help/start cards (if any) must not hide the pitch
await p.keyboard.press('Enter').catch(() => {}); await p.waitForTimeout(300);
await hs('w.__hs.ff(2)'); await frames(20);
await shot('mac-acilis');
if (hasInfo) report.info.acilis = await hs('return w.__hs3.info()');
// goal: fast-forward until the score changes, then shoot during the celebration
const g = await hs(`const s0 = w.__hs.state().score.join('-'); for (let i = 0; i < 240; i++) { w.__hs.ff(0.5); if (w.__hs.state().score.join('-') !== s0) return i; } return -1;`);
await frames(12); await shot('mac-gol' + (g < 0 ? '-yok' : ''));
if (hasHook) {
  for (const c of ['korner', 'kale', 'tribun']) { await hs('w.__hs3.cam(arg)', c); await frames(16); await shot('mac-' + c); }
  for (const f of [0.25, 0.6, 1]) { await hs('w.__hs3.setFill(arg)', f); await hs('w.__hs3.cam(arg)', 'genis'); await frames(16); await shot('mac-doluluk-' + Math.round(f * 100)); report.info['fill' + f] = await hs('return w.__hs3.info()'); }
  await hs('w.__hs3.cam(null)');
}
await p.setViewportSize({ width: 430, height: 900 }); await frames(30); await shot('mac-dikey');
writeFileSync(join(out, pre + 'rapor.json'), JSON.stringify({ ...report, errs }, null, 1));
console.log(JSON.stringify(report.info), errs.slice(0, 3).join(' | '));
await b.close(); srv.close();
