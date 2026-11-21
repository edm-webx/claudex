// PRF-08: gece ışık havuzu. node tests/browser/isik.spec.mjs [--dist KLASÖR] [--shots KLASÖR] [--kademe akici,dengeli,sahane]
// Sınar: havuz kademeye göre 4/6/10 ve oyun boyunca sabit; gece-gündüz geçişinde shader programı artmaz; yürürken ardışık kare
// parlaklığı sıçramaz; kafe içinde ışıklar odanın lambalarına gider. --shots ile gece büfe önü / iskele / kafe içi (gece+gündüz)
// çekimleri (önce/sonra karşılaştırma için; --shots verilince eski sürümde olmayan kancalar atlanır).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const DIST = resolve(arg('--dist', 'dist')), shots = arg('--shots');
const tiers = String(arg('--kademe', 'akici,dengeli,sahane')).split(',');
const POOL = { akici: 4, dengeli: 6, sahane: 10 };
const globalRoot = (() => { try { return execSync('npm root -g').toString().trim(); } catch { return ''; } })();
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(join(globalRoot, 'x.js'))('playwright')); }
const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
if (shots) mkdirSync(shots, { recursive: true });
let fail = 0; const check = (ok, msg) => { console.log(`${ok ? 'tamam ' : 'HATA  '} ${msg}`); if (!ok) fail++; };

// mean brightness of the canvas area (screenshot -> decode in page)
const LUM = `(() => { const c = document.querySelector('canvas#c'); const w = 160, h = 90; const o = document.createElement('canvas'); o.width = w; o.height = h; const g = o.getContext('2d'); g.drawImage(c, 0, 0, w, h); const d = g.getImageData(0, 0, w, h).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (w * h) / 255; })()`;

for (const tier of tiers) {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on('pageerror', e => { console.log('  sayfa hatası:', String(e).slice(0, 160)); fail++; });
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=${tier}&seed=3&time=22&stage=3`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
  const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const ad = await p.$('input[name="ad"]'); if (ad) await ad.fill('Olcum'); await go.click({ force: true }); await p.waitForTimeout(700); }
  // keep the canvas readable for drawImage
  await p.evaluate(() => { const M = window.__marti; M.izgara?.(false); M.setTime(22); M.teleport(0, -1.5); for (let k = 0; k < 15; k++) M.renderFrames(2, 0.1); });
  await p.waitForTimeout(1500);
  const has = await p.evaluate(() => typeof window.__marti.lights === 'function');
  const L = () => p.evaluate(() => window.__marti.lights?.());
  const shot = async (ad) => { if (shots) await p.screenshot({ path: join(shots, `${tier}-${ad}.png`), timeout: 300000 }); };
  const spot = (x, z, yaw, zoom = 2.6) => p.evaluate(([x, z, yaw, zoom]) => { const M = window.__marti; M.teleport(x, z); for (let k = 0; k < 8; k++) M.renderFrames(3, 0.1); M.camera({ x, z, zoomRaw: zoom, yaw, tilt: 0.8 }); for (let k = 0; k < 20; k++) M.renderFrames(2, 0.1); }, [x, z, yaw, zoom]);

  await spot(0, -1.5, 0); await shot('gece-bufe-onu');
  await spot(0, 6, 0, 3.2); await shot('gece-iskele');
  if (has) {
    const s = await L();
    check(s.pool === POOL[tier], `${tier}: gece havuz ${s.pool} (beklenen ${POOL[tier]}), yanan ${s.active}, lamba ${s.lamps}`);
    check(s.active >= Math.min(3, POOL[tier]), `${tier}: büfe önünde en az ${Math.min(3, POOL[tier])} ışık yanıyor (${s.active})`);
    // programs must not grow across day/night
    const prog = () => p.evaluate(() => window.__marti.info().programs);
    await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.renderFrames(6, 0.1); M.setTime(22); M.renderFrames(6, 0.1); M.setTime(13); M.renderFrames(6, 0.1); });
    const p0 = await prog();
    await p.evaluate(() => { const M = window.__marti; for (const h of [22, 13, 22, 13]) { M.setTime(h); M.renderFrames(6, 0.1); } });
    const p1 = await prog();
    check(p1 <= p0, `${tier}: gece-gündüz döngüsünde program sayısı artmadı (${p0} -> ${p1})`);
    check((await L()).pool === POOL[tier], `${tier}: döngü sonrası havuz hâlâ ${POOL[tier]}`);
    // walking at night: consecutive frame brightness
    await p.evaluate(() => { const M = window.__marti; M.setTime(22); M.teleport(0, 8); M.camera({ reset: true }); for (let k = 0; k < 10; k++) M.renderFrames(2, 0.1); });
    let prev = null, maxD = 0;
    for (let k = 0; k < 40; k++) {
      // render and read in the same task (the drawing buffer is not preserved across tasks)
      const v = await p.evaluate(L => { const M = window.__marti; M.input(0, -1); M.step(0.033); M.renderFrames(1, 0.033); return (0, eval)(L); }, LUM); if (prev !== null) maxD = Math.max(maxD, Math.abs(v - prev) / Math.max(0.02, prev)); prev = v;
    }
    await p.evaluate(() => window.__marti.input(null));
    check(maxD < 0.06, `${tier}: yürürken ardışık kare parlaklık farkı en çok %${(maxD * 100).toFixed(1)} (< %6)`);
    console.log(`        ${tier}: yürüyüş sonu`, JSON.stringify(await L()));
  }
  // kafe1 inside, night and day
  await spot(-16.4, 37.9, Math.PI / 2, 2.0); await shot('gece-kafe1');
  if (has) { const s = await L(); check(s.room === 'kafe1' && s.active >= Math.min(3, POOL[tier] - 1), `${tier}: kafe1 içinde oda ışıkları (${JSON.stringify(s)})`); }
  await p.evaluate(() => { const M = window.__marti; M.setTime(13); for (let k = 0; k < 20; k++) M.renderFrames(2, 0.1); }); await shot('gunduz-kafe1');
  if (has) { const s = await L(); check(s.room === 'kafe1' && s.active >= 3, `${tier}: kafe1 içinde gündüz de lambalar loş yanıyor (${s.active})`); }
  await ctx.close();
}
await browser.close(); srv.close();
console.log(fail ? `\nisik.spec: ${fail} hata` : '\nisik.spec: hepsi tamam');
process.exit(fail ? 1 : 0);
