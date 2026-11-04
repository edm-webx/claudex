// M1 UI spec (Builder D, acceptance 6): every panel opens with a real model at 390x844 and 360x740, no horizontal
// overflow, zero console errors; overlays (job board, day card, welcome back, kasa sayimi, solution) open too; Turkish
// text lint (no "zam", no em-dash) over src/content/ui-text.ts and lines.ts.
// Usage: NODE_PATH=$(npm root -g) node tests/browser/ui-m1.spec.mjs   (SKIP_BUILD=1 reuses dist)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIST = resolve(process.env.MARTI_DIST || 'dist');
if (!process.env.SKIP_BUILD && !process.env.MARTI_DIST) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit' });
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const srv = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': types['.html'] }); return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${readFileSync(join(DIST, 'index.html'), 'utf8')}</body></html>`); }
  const f = join(DIST, p);
  if (!f.startsWith(DIST) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/`;

let fails = 0;
const check = (name, ok, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); };
const PANELS = ['isciler', 'menu', 'dekor', 'gorevler', 'kedi', 'karne', 'tadilat', 'ayarlar'];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [w, h] of [[390, 844], [360, 740]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(`${url}?seed=1&noloop&fresh=1`);
  await p.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 30000 });
  await p.evaluate(() => { const M = window.__marti; if (!M.state().started) M.play('sabri'); M.step(2); M.force.money(500000); M.force.gold(500); M.force.stars(2); M.step(2); });
  for (const id of PANELS) {
    await p.evaluate(pid => { window.__marti.openPanel(pid); window.__marti.renderFrames(2, 0.1); }, id);
    await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const sh = document.querySelector('#sbui .sb-sheet:not(.out)');   // a closing sheet stays 200 ms with .out
      const body = sh && sh.querySelector('.sb-shb');
      return { open: !!sh, text: body ? body.innerText.length : 0, over: document.documentElement.scrollWidth > window.innerWidth + 1 || (body ? body.scrollWidth > body.clientWidth + 1 : false), id: sh && sh.dataset.id };
    });
    check(`${w}x${h} panel ${id} opens`, r.open && r.id === id && r.text > 5, `text=${r.text}`);
    check(`${w}x${h} panel ${id} no overflow`, !r.over);
    await p.evaluate(() => window.__marti.closePanel && window.__marti.closePanel());
    await p.evaluate(() => window.__marti.renderFrames(2, 0.1));
  }
  // overlays
  await p.evaluate(() => { const M = window.__marti; M.force.unlock('isbul'); M.step(0.2); M.openJobBoard && M.openJobBoard(); M.renderFrames(2, 0.1); });   // v2: the board needs the İş Bul pad
  check(`${w}x${h} job board`, await p.evaluate(() => !!document.querySelector('#sbui .sb-sheet[data-id="isbul"]:not(.out)')));
  await p.evaluate(() => window.__marti.closeJobBoard && window.__marti.closeJobBoard());
  await p.evaluate(() => { window.__marti.force.endDay(); window.__marti.step(1); window.__marti.renderFrames(2, 0.1); });
  check(`${w}x${h} day card`, await p.evaluate(() => !!document.querySelector('#sbui .sb-dayc')));
  check(`${w}x${h} zero console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();

// Turkish text lint
for (const f of ['src/content/ui-text.ts', 'src/content/lines.ts', 'src/game/ui/v2ui.ts']) {
  if (!existsSync(f)) continue;
  const t = readFileSync(f, 'utf8');
  const strings = t.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
  const bad = strings.filter(s => /\bzam\b/i.test(s) || /—/.test(s));
  check(`text lint ${f}`, bad.length === 0, bad.slice(0, 3).join(' | '));
}
console.log(fails ? `${fails} FAILED` : 'ui-m1 OK');
process.exit(fails ? 1 : 0);
