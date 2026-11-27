// Telefon içi menüler: her paneli açıp ekran görüntüsü alır.  DIST=... VW=844 VH=390 node calisma/telefon-menu/shot.mjs <çıktı>
// Test değildir. tests/browser/hud-shot.mjs'in yükleme kalıbını kullanır; ek olarak açık panelin ekran dışına taşıp taşmadığını ölçer.
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from '../../tests/browser/kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.DIST || 'dist');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const VW = Number(process.env.VW || 1280), VH = Number(process.env.VH || 720), tag = VW + 'x' + VH;
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm', css: 'text/css', mp3: 'audio/mpeg', ogg: 'audio/ogg' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(DIST, p === '/' ? 'index.html' : p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': p === '/' ? 'text/html' : TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset="utf-8"></head><body>' + readFileSync(f, 'utf8') + '</body></html>' : readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const touch = VW < 1000;
const p = await (await b.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: Number(process.env.DSF || 1), hasTouch: touch, isMobile: false })).newPage();
const errs = []; p.on('pageerror', e => { errs.push(e.message); console.log('ERR', e.message); });
const rapor = { tag, paneller: {}, hatalar: errs };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

// 1) ana menü (oyun başlamadan)
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dusuk&seed=3&stage=${process.env.STAGE || 3}&saat=13`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 180000 });
if (!ONLY || ONLY.includes('menu0')) {
  await p.evaluate(() => window.__marti.renderFrames(2, 0.1)); await p.mouse.click(VW / 2, VH / 2).catch(() => {}); await p.waitForTimeout(900);
  await p.screenshot({ path: join(out, tag + '-00-anamenu.png') });
  rapor.anamenu = await p.evaluate(() => [...document.querySelectorAll('.mn-menu button, .mn-foot button')].map(e => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim().slice(0, 24), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), gorunur: r.bottom <= innerHeight && r.top >= 0 && r.right <= innerWidth }; }));
}
await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
await kulisKapat(p, 'Olcum');
await p.evaluate(() => { const M = window.__marti; M.setTime(13); M.step(2); M.simCmd('money', 2e6); M.simCmd('level', 12); for (let i = 0; i < 3; i++) { M.simCmd('hire'); M.step(1); }
  M.command({ kind: 'esnafim', op: 'done' }); M.step(1); M.skipCeremony?.(); M.collectWelcome?.(); M.closeJobBoard?.(); M.closePanel?.();
  for (let i = 0; i < 40; i++) M.step(1); });
const tick = () => p.evaluate(() => { for (let k = 0; k < 4; k++) { window.__marti.step(0.1); window.__marti.renderFrames(1, 0.1); } });
const olc = () => p.evaluate(() => {
  const sec = ['.tf-bg.on .tf-ph', '#sbui .sb-sheet:not(.out)', '.mp-bg.on .mp-card', '.on-bg .on-card', '.kd-bg.on .kd-card'];
  const r = []; for (const s of sec) for (const e of document.querySelectorAll(s)) { const q = e.getBoundingClientRect(); r.push({ s, x: Math.round(q.left), y: Math.round(q.top), w: Math.round(q.width), h: Math.round(q.height), tasma: q.left < -1 || q.top < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1 }); }
  // merkez modali: ekran ortasını kaplayan büyük kutu (genişliğin %40'ı ve yüksekliğin %50'si, yatay merkez ±12%)
  const orta = r.filter(o => o.w > innerWidth * 0.4 && o.h > innerHeight * 0.5 && Math.abs(o.x + o.w / 2 - innerWidth / 2) < innerWidth * 0.12);
  return { kutular: r, orta: orta.length };
});
const ac = id => p.evaluate(id => document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: id, bubbles: true })), id);
const kapat = async () => { await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => { const M = window.__marti; M.closePanel?.(); document.querySelector('.on-bg')?.remove(); document.querySelector('.mp-bg.on [data-a="close"]')?.click(); document.querySelector('.kd-bg.on .kd-x')?.click(); }); await tick(); };
const snap = async n => { await tick(); await p.waitForTimeout(450); await tick(); await p.screenshot({ path: join(out, tag + '-' + n + '.png') }); rapor.paneller[n] = await olc(); console.log('ok', n, JSON.stringify(rapor.paneller[n])); };

const ADIM = [
  ['10-hud', async () => {}],
  ['20-telefon', async () => { await ac('telefon'); }],
  ['21-kasa', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="kasa"]'); }],
  ['22-harita', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="harita"]'); }],
  ['23-ajanda', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="gorevler"]'); }],
  ['24-mulklerim', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="holding"]'); }],
  ['25-karne', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="karne"]'); }],
  ['26-ayarlar', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="ayarlar"]'); }],
  ['27-arkadaslar', async () => { await ac('telefon'); await tick(); await p.click('.tf-app[data-app="arkadas"]'); }],
  ['30-canta', async () => { await ac('envanter'); }],
  ['31-menu', async () => { await ac('menu'); }],
  ['32-tadilat', async () => { await ac('tadilat'); }],
  ['33-ekip', async () => { await ac('isciler'); }],
  ['34-dekor', async () => { await ac('dekor'); }],
  ['35-mulk', async () => { await ac('mulk'); }],
];
for (const [n, f] of ADIM) {
  if (ONLY && !ONLY.includes(n)) continue;
  try { await f(); await snap(n); } catch (e) { console.log('ATLA', n, e.message.split('\n')[0]); rapor.paneller[n] = { hata: e.message.split('\n')[0] }; }
  await kapat(); await p.evaluate(() => { if (document.querySelector('.tf-bg.on')) document.getElementById('sbui')?.dispatchEvent(new CustomEvent('ui:open', { detail: 'telefon', bubbles: true })); }); await tick();
}
writeFileSync(join(out, tag + '-rapor.json'), JSON.stringify(rapor, null, 1));
await b.close(); srv.close(); process.exit(0);
