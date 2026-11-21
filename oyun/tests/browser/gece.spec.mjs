// GRS-02: gün sonu ve şafak ölçümü. Gece kareden gün sonuna, kart açıkken ve "Yeni güne başla"dan sonraki şafak boyunca
// aynı kamera ile kareler çeker; ortalama parlaklık (Y) adımlarını ve 24 üstü saatlerin görünürlüğünü denetler.
//   node tests/browser/gece.spec.mjs [--dist KLASÖR] [--cikti KLASÖR]
// Kapılar: kart açıkken kare gece karesinden <= 3 Y farklı; şafakta 60 fps kare başına Y adımı <= 2.5 (çekimler 0.24 sn arayla);
// setTime(24) ile setTime(26.5) arasında Y farkı >= 0.5 ve saat gerçekten 26.5. Headless SwiftShader: piksel güvenilir, süre değil.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const DIST = resolve(arg('--dist', 'dist'));
const OUT = resolve(arg('--cikti', 'calisma/gece-cikti'));
mkdirSync(OUT, { recursive: true });

const globalRoot = (() => { try { return execSync('npm root -g').toString().trim(); } catch { return ''; } })();
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire(join(globalRoot, 'x.js'))('playwright')); }
const { PNG } = require('pngjs');

const mime = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.glb': 'model/gltf-binary' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(200, { 'content-type': mime['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': mime[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const meanY = buf => { const { width: w, height: h, data: d } = PNG.sync.read(buf); let s = 0; for (let i = 0; i < w * h * 4; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(s / (w * h)).toFixed(2); };
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('  sayfa hatası:', String(e).slice(0, 160)));
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
const go = await p.waitForSelector('.kl-go', { timeout: 8000 }).catch(() => null); if (go) { const inp = await p.$('input[name="ad"]'); if (inp) await inp.fill('Deneme'); await go.click({ force: true }); await p.waitForTimeout(700); }
await p.evaluate(() => { const M = window.__marti; M.izgara?.(false); M.teleport(0, -3); for (let i = 0; i < 10; i++) M.renderFrames(3, 0.1); });
const cam = () => p.evaluate(() => { const M = window.__marti; M.camera({ x: 0, z: -3, zoomRaw: 2.8, yaw: 0, tilt: 0.75 }); });
const shot = async ad => {
  await p.evaluate(() => { const st = document.createElement('style'); st.id = 'lum-giz'; st.textContent = 'body *{visibility:hidden!important}canvas{visibility:visible!important}'; document.head.appendChild(st); });
  const buf = await p.screenshot({ path: join(OUT, ad + '.png'), timeout: 300000 });
  await p.evaluate(() => document.getElementById('lum-giz')?.remove());
  return meanY(buf);
};
let fail = 0; const check = (ok, msg) => { console.log((ok ? 'tamam   ' : 'KIRMIZI ') + msg); if (!ok) fail++; };
// film strip
const serit = {};
for (const h of [8, 11, 16, 17.5, 18.5, 19.5, 20.6, 22, 24, 25, 26.5]) {
  await p.evaluate(h => { const M = window.__marti; M.setTime(h); M.renderFrames(6, 0.05); }, h); await cam(); await p.evaluate(() => window.__marti.renderFrames(4, 0.05));
  serit[h] = await shot('serit-' + String(h).replace('.', '_'));
  console.log(`saat ${String(h).padStart(4)}  ortY ${serit[h]}`);
}
const h265 = await p.evaluate(() => window.__marti.state().time);
check(Math.abs(h265 - 26.5) < 0.05, `setTime(26.5) saati ${h265}`);
check(Math.abs(serit[24] - serit[26.5]) >= 0.5, `24 ile 26.5 farklı: ${serit[24]} / ${serit[26.5]}`);
// day end: night frame, then the day rolls over behind the card
await p.evaluate(() => { const M = window.__marti; M.setTime(26.9); M.renderFrames(6, 0.05); }); await cam();
const yGece = await shot('gunsonu-0-gece');
const d0 = await p.evaluate(() => window.__marti.state().day);
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'freezeTime', on: false }); M.simCmd('endDay'); M.step(1); M.renderFrames(6, 1 / 30); });
const st = await p.evaluate(() => { const s = window.__marti.state(); return { day: s.day, time: s.time, kart: !!document.querySelector('.gs-wrap') }; });
console.log('gün dönüşü:', JSON.stringify(st));
check(st.day === d0 + 1, `gün ilerledi ${d0} -> ${st.day}`);
const yKart = await shot('gunsonu-1-kart');
check(Math.abs(yKart - yGece) <= 3, `kart açıkken dünya gece kalır: ${yGece} -> ${yKart}`);
await p.evaluate(() => { const M = window.__marti; M.command({ kind: 'yeniGun' }); });
const seri = [yKart];
for (let i = 0; i < 26; i++) { await p.evaluate(() => window.__marti.renderFrames(8, 0.03)); seri.push(await shot('gunsonu-safak-' + String(i).padStart(2, '0'))); }
let mx = 0; for (let i = 1; i < seri.length; i++) mx = Math.max(mx, Math.abs(seri[i] - seri[i - 1]));
console.log('şafak ortY:', seri.join(' '));
// 0.24 s between shots = ~14 frames at 60 fps: the per-frame step is mx / 14.4 (gate: <= 2.5 per frame, spec GRS-02)
check(mx / 14.4 <= 2.5, `şafakta kare başına en büyük adım ${(mx / 14.4).toFixed(2)} (çekimler arası ${mx.toFixed(2)}, 0.24 sn)`);
await p.evaluate(() => { const M = window.__marti; M.renderFrames(10, 0.1); });
const yGun = await shot('gunsonu-9-sabah');
check(yGun > yKart + 20, `şafak sonunda sabah: ${yKart} -> ${yGun}`);
await ctx.close(); await browser.close(); srv.close();
writeFileSync(join(OUT, 'gece.json'), JSON.stringify({ serit, gece: yGece, kart: yKart, safak: seri, sabah: yGun }, null, 1));
console.log(fail ? `gece: ${fail} kırmızı` : 'gece: yeşil');
process.exit(fail ? 1 : 0);
