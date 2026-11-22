// AR-GE arayüz okunabilirlik botu (2026-11-22): gerçek arayüz açıkken (karakter atölyesi gerçek tıklamayla geçilir) birkaç ekran
// boyutunda HUD + panelleri tarar. Kurallar (yalnız görünür, metin taşıyan öğeler):
//   U1 yazı çok küçük (< 11 px)            U2 yazı kutusundan taşıyor / kesiliyor (overflow gizli, scrollWidth > clientWidth)
//   U3 ekran dışında (kısmen)             U4 iki ayrı HUD parçası üst üste (fixed/absolute kökler, kesişim > %20 küçüğün)
//   U5 kontrast düşük (< 3:1, arka plan üst zincirden; yarı saydamlarda alfa ile karıştırılır, resim/gradyan atlanır)
// Kullanım: npx vite build --mode development --outDir dist-dev && MARTI_DIST=dist-dev node tools/build-artifact.mjs
//           MARTI_DIST=dist-dev node tests/browser/arge-ui.mjs <çıktı>
import { createServer } from 'node:http'; import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs'; import { join, resolve } from 'node:path'; import { createRequire } from 'node:module';
import { kulisKapat } from './kulis-kapat.mjs';
const require = createRequire(import.meta.url); const { chromium } = require('playwright'); const DIST = resolve(process.env.MARTI_DIST || 'dist-dev');
const out = process.argv[2] || 'arge-ui-cikti'; mkdirSync(out, { recursive: true });
const TYPES = { png: 'image/png', jpg: 'image/jpeg', glb: 'model/gltf-binary', webp: 'image/webp', json: 'application/json', ktx2: 'image/ktx2', wasm: 'application/wasm' };
const srv = createServer((req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); } const f = join(DIST, p); if (!existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[f.split('.').pop()] || 'text/javascript' }); res.end(readFileSync(f)); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const VIEWS = (process.env.VIEWS || '1280x720,1920x1080,844x390,390x844').split(',').map(v => v.split('x').map(Number));
const PANELS = (process.env.PANELS || 'gorevler,isciler,menu,tadilat,karne,ayarlar').split(',').filter(Boolean);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

function tara() {
  const lum = (r, g, b) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const ad = el => (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '') || el.tagName.toLowerCase();
  const yol = el => { const a = []; for (let e = el; e && e !== document.body && a.length < 4; e = e.parentElement) a.unshift(ad(e)); return a.join(' > '); };
  const gorunur = el => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.15) return false; } const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const W = innerWidth, H = innerHeight, bulgu = [];
  const metinli = [...document.querySelectorAll('body *')].filter(el => !['SCRIPT', 'STYLE', 'CANVAS', 'svg', 'path'].includes(el.tagName) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
  for (const el of metinli) {
    if (!gorunur(el)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), txt = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40);
    const fs = parseFloat(cs.fontSize);
    if (fs < 11) bulgu.push({ k: 'U1 küçük yazı', px: fs, txt, el: yol(el) });
    if ((cs.overflow + cs.overflowX).includes('hidden') && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis') bulgu.push({ k: 'U2 taşan yazı', fark: el.scrollWidth - el.clientWidth, txt, el: yol(el) });
    if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) bulgu.push({ k: 'U3 ekran dışı', rect: [r.left, r.top, r.right, r.bottom].map(Math.round), txt, el: yol(el) });
    // kontrast
    const fg = rgba(cs.color); let bg = null, resim = false;
    const kat = [];
    for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.backgroundImage && c.backgroundImage !== 'none') { resim = true; break; } const x = rgba(c.backgroundColor); if (x && x.a > 0) { kat.push(x); if (x.a >= 0.95) break; } }
    if (!resim && fg && kat.length && kat[kat.length - 1].a >= 0.95) {
      bg = { ...kat[kat.length - 1] }; for (let i = kat.length - 2; i >= 0; i--) { const c = kat[i]; bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) }; }
      const f = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
      const L1 = lum(f.r, f.g, f.b), L2 = lum(bg.r, bg.g, bg.b), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      if (cr < 3) bulgu.push({ k: 'U5 düşük kontrast', oran: +cr.toFixed(2), txt, el: yol(el) });
    }
  }
  // U4: sabit/mutlak konumlu kökler (başka sabit kökün içinde olmayan) kesişiyor mu
  const kokler = [...document.querySelectorAll('body *')].filter(el => { const p = getComputedStyle(el).position; if (p !== 'fixed' && p !== 'absolute') return false; if (!gorunur(el) || !el.textContent.trim()) return false; for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const q = getComputedStyle(e).position; if (q === 'fixed' || q === 'absolute') return false; } const r = el.getBoundingClientRect(); return r.width < W * 0.9 || r.height < H * 0.9; });
  for (let i = 0; i < kokler.length; i++) for (let j = i + 1; j < kokler.length; j++) {
    const a = kokler[i].getBoundingClientRect(), c = kokler[j].getBoundingClientRect();
    const ix = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left)), iy = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
    const kucuk = Math.min(a.width * a.height, c.width * c.height); if (kucuk > 0 && ix * iy / kucuk > 0.2) bulgu.push({ k: 'U4 HUD üst üste', oran: +(ix * iy / kucuk).toFixed(2), a: yol(kokler[i]) + ' «' + kokler[i].textContent.trim().slice(0, 20) + '»', b: yol(kokler[j]) + ' «' + kokler[j].textContent.trim().slice(0, 20) + '»' });
  }
  return bulgu;
}

const rapor = {};
for (const [w, h] of VIEWS) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < h || w < 900 });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await p.goto(`http://127.0.0.1:${srv.address().port}/?fresh=1&noloop&tier=dengeli&seed=3`);
  await p.waitForFunction(() => window.__marti?.ready?.(), null, { timeout: 120000 });
  await p.evaluate(() => window.__marti.play('sabri')); await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  await p.waitForTimeout(800);
  const tag = `${w}x${h}`; rapor[tag] = {};
  const kayit = async (ad) => { const bl = await p.evaluate(tara); const tek = []; const gor = new Set(); for (const x of bl) { const k = x.k + (x.el || x.a) + (x.txt || ''); if (!gor.has(k)) { gor.add(k); tek.push(x); } } rapor[tag][ad] = tek; await p.screenshot({ path: join(out, `${tag}-${ad}.png`) }); console.log(tag, ad, tek.length, 'bulgu', JSON.stringify(tek.reduce((o, x) => (o[x.k] = (o[x.k] || 0) + 1, o), {}))); };
  await kayit('atolye');
  await kulisKapat(p, 'Denetci', { ui: true });
  await p.evaluate(() => { const M = window.__marti; for (let i = 0; i < 20; i++) { M.step(0.5); M.renderFrames(1, 0.1); } });
  await p.waitForTimeout(500); await kayit('ilk-hud');
  await p.evaluate(() => { const M = window.__marti; M.simCmd('money', 250000); M.simCmd('level', 6); M.setTime(15); for (let i = 0; i < 60; i++) { M.step(1); } M.renderFrames(4, 0.1); });
  await p.waitForTimeout(400); await kayit('oyun-hud');
  for (const id of PANELS) { await p.evaluate(id => { const M = window.__marti; M.command({ kind: 'openPanel', id }); M.renderFrames(3, 0.1); }, id); await p.waitForTimeout(500); await kayit('panel-' + id); await p.evaluate(() => { const M = window.__marti; M.closePanel?.(); M.command({ kind: 'closePanel' }); M.renderFrames(2, 0.1); }); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(200); }
  rapor[tag].hatalar = errs.slice(0, 20);
  await ctx.close();
}
writeFileSync(join(out, 'rapor.json'), JSON.stringify(rapor, null, 1));
await b.close(); srv.close(); process.exit(0);
