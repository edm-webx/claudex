// UX-04: okunurluk taraması. dist'i açar, #sbui içindeki görünen metinleri ölçer: 13 px altı yazı ve düşük kontrast raporlanır.
// Kullanım: npm run build:vite && node tools/build-artifact.mjs && node tools/kontrast.mjs [--w=1280 --h=720]
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from '../tests/browser/kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve('dist');
const flag = n => (process.argv.find(a => a.startsWith('--' + n + '=')) || '').split('=')[1];
const srv = createServer((req, res) => { const p = new URL(req.url, 'http://x').pathname; if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: +(flag('w') || 1280), height: +(flag('h') || 720) } })).newPage();
await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 60000 });
await p.evaluate(() => { const M = window.__marti; M.play('sabri'); M.renderFrames(2, 0.1); });
await kulisKapat(p, 'Deniz');
await p.evaluate(() => { const M = window.__marti; M.step(3); for (let i = 0; i < 6; i++) M.renderFrames(4, 0.1); });
const rapor = await p.evaluate(() => {
  const lum = ([r, g, bl]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(bl); };
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, bl, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { c: [r, g, bl], a }; };
  const bgOf = el => { let c = [255, 255, 255], layers = []; for (let e = el; e; e = e.parentElement) { const q = parse(getComputedStyle(e).backgroundColor); if (q && q.a > 0) { layers.push(q); if (q.a >= .95) break; } } for (const q of layers.reverse()) c = c.map((v, i) => v * (1 - q.a) + q.c[i] * q.a); return c; };
  const out = { kucuk: [], soluk: [], taranan: 0 };
  for (const el of document.querySelectorAll('#sbui *')) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || r.bottom < 0 || r.top > innerHeight) continue;
    out.taranan++;
    const fs = parseFloat(cs.fontSize), txt = el.textContent.trim().slice(0, 28), sel = el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0];
    if (fs < 13) out.kucuk.push({ sel, fs, txt });
    const fg = parse(cs.color); if (!fg) continue;
    if (!/[A-Za-zÇĞİÖŞÜçğıöşü0-9]/.test(txt)) continue;   // emoji/simge
    let grad = false; for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) if (getComputedStyle(e).backgroundImage !== 'none') grad = true;
    if (grad) continue;   // degrade zeminde ölçüm güvenilmez, gözle bakılır
    const bg = bgOf(el), L1 = lum(fg.c.map((v, i) => v * fg.a + bg[i] * (1 - fg.a))), L2 = lum(bg), k = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    if (k < 4.5) out.soluk.push({ sel, k: +k.toFixed(2), txt });
  }
  return out;
});
console.log(`taranan: ${rapor.taranan}, 13px altı: ${rapor.kucuk.length}, kontrast<4.5: ${rapor.soluk.length}`);
for (const x of rapor.kucuk.slice(0, 20)) console.log('  KÜÇÜK', x.fs + 'px', x.sel, JSON.stringify(x.txt));
for (const x of rapor.soluk.slice(0, 20)) console.log('  SOLUK', x.k, x.sel, JSON.stringify(x.txt));
await b.close(); srv.close();
process.exit(rapor.kucuk.length ? 1 : 0);
