// Owner: Builder A. Lifecycle spec (CONTRACT M0 acceptance 7): zero console errors on boot and over a 60 s walk;
// loseContext -> restoreContext renders again with the same state hash; hide -> loop paused + save written; show resumes.
// Usage: node tests/browser/lifecycle.spec.mjs   (builds dist first unless SKIP_BUILD=1; MARTI_DIST=<dir> to test another build)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const DIST = resolve(process.env.MARTI_DIST || 'dist');
if (!process.env.SKIP_BUILD && !process.env.MARTI_DIST) execSync('npx vite build && node tools/build-artifact.mjs', { stdio: 'inherit' });
if (!existsSync(join(DIST, 'index.html'))) { console.error('no dist/index.html'); process.exit(1); }

/** Serves the page-contract index.html wrapped in a minimal document, like the artifact host does. */
function serve(dir) {
  const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
  const srv = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p === '/' || p === '/index.html') {
      const body = readFileSync(join(dir, 'index.html'), 'utf8');
      res.writeHead(200, { 'content-type': types['.html'] });
      return res.end(`<!doctype html><html><head><meta charset="utf-8"></head><body>${body}</body></html>`);
    }
    const f = join(dir, p);
    if (!f.startsWith(dir) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}

const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); };

const { srv, url } = await serve(DIST);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function open(query) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(url + query);
  await page.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 30000 });
  return { ctx, page, errors };
}
const idbGet = (page, key) => page.evaluate(k => new Promise(res => {
  const r = indexedDB.open('marti', 1);
  r.onerror = () => res(null);
  r.onsuccess = () => { try { const g = r.result.transaction('kv').objectStore('kv').get(k); g.onsuccess = () => res(g.result ?? null); g.onerror = () => res(null); } catch { res(null); } };
}), key);

try {
  // 1) 60 s walk (sim time), hooks-driven so it is fast and deterministic; renders every 6th tick
  {
    const { ctx, page, errors } = await open('?fresh=1&noloop&seed=3');
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [0.7, 0.7], [-0.7, 0.3]];
    let moved = 0, last = (await page.evaluate(() => window.__marti.state())).pos;
    for (let s = 0; s < 60; s++) {
      const [x, z] = dirs[Math.floor(s / 4) % dirs.length];
      await page.evaluate(([x, z]) => { const m = window.__marti; m.input(x, z); for (let i = 0; i < 5; i++) { m.step(0.2); m.renderFrames(1, 0.2); } }, [x, z]);
      const p = (await page.evaluate(() => window.__marti.state())).pos;
      moved += Math.hypot(p.x - last.x, p.z - last.z); last = p;
    }
    await page.evaluate(() => window.__marti.input(null));
    const st = await page.evaluate(() => window.__marti.state());
    check('walk 60 s: sim advanced 1800 ticks', st.tick >= 1800, `tick ${st.tick}`);
    check('walk 60 s: player moved', moved > 20, `${moved.toFixed(1)} m`);
    check('walk 60 s: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));

    // 2) context loss / restore
    await page.evaluate(() => window.__marti.renderFrames(1));
    const h0 = (await page.evaluate(() => window.__marti.state())).hash;
    await page.evaluate(() => window.__marti.loseContext());
    await page.waitForTimeout(300);
    const lostOk = await page.evaluate(() => { const c = document.getElementById('c'); const gl = c.getContext('webgl2') || c.getContext('webgl'); return !!gl && gl.isContextLost(); });
    check('context: lost', lostOk);
    await page.evaluate(() => window.__marti.restoreContext());
    await page.waitForFunction(() => { const c = document.getElementById('c'); const gl = c.getContext('webgl2') || c.getContext('webgl'); return gl && !gl.isContextLost(); }, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__marti.renderFrames(2));
    const info = await page.evaluate(() => window.__marti.info());
    const h1 = (await page.evaluate(() => window.__marti.state())).hash;
    check('context: renders again after restore', info.calls > 0, `calls ${info.calls}`);
    check('context: same state hash', h0 === h1, `${h0} vs ${h1}`);
    const evs = await page.evaluate(() => window.__marti.events().map(e => e.name));
    check('context: events logged', evs.includes('contextLost') && evs.includes('contextRestored'));
    const shot = PNG.sync.read(await page.screenshot());
    const cols = new Set();
    for (let i = 0; i < shot.data.length; i += 4 * 97) cols.add(shot.data[i] >> 4 << 8 | shot.data[i + 1] >> 4 << 4 | shot.data[i + 2] >> 4);
    const px = cols.size;
    check('context: canvas not blank after restore', px > 3, `${px} colours`);
    check('context: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // 3) visibility: hide -> paused + save written; show -> resumes
  {
    const { ctx, page, errors } = await open('?fresh=1&seed=5');
    await page.evaluate(() => window.__marti.resetSave());
    await page.evaluate(() => window.__marti.input(0, 1));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__marti.input(null));
    const before = await page.evaluate(() => window.__marti.state());
    check('visibility: loop running before hide', !before.paused && before.tick > 0, `tick ${before.tick}`);
    await page.evaluate(() => window.__marti.hide());
    await page.waitForTimeout(500);
    const hid = await page.evaluate(() => window.__marti.state());
    await page.waitForTimeout(500);
    const hid2 = await page.evaluate(() => window.__marti.state());
    check('visibility: hide pauses loop', hid.paused && hid2.tick === hid.tick, `pauseWhy ${hid.pauseWhy}`);
    let rec = hid.saveMode === 'idb' ? await idbGet(page, 'marti-bufe:ptr') : await page.evaluate(() => localStorage.getItem('marti-bufe:ptr'));
    check('visibility: save written on hide', !!rec, `mode ${hid.saveMode}`);
    const slot = JSON.parse(rec || '{"slot":0}').slot;
    const raw = hid.saveMode === 'idb' ? await idbGet(page, `marti-bufe:s${slot}`) : await page.evaluate(s => localStorage.getItem(`marti-bufe:s${s}`), slot);
    const saved = raw ? JSON.parse(JSON.parse(raw).json) : null;
    check('visibility: saved player position matches', !!saved && Math.abs(saved.player.z - hid.pos.z) < 0.01, saved ? `saved z ${saved.player.z.toFixed(2)} vs ${hid.pos.z}` : 'no data');
    await page.evaluate(() => window.__marti.show());
    await page.waitForTimeout(600);
    const back = await page.evaluate(() => window.__marti.state());
    check('visibility: show resumes', !back.paused && back.tick > hid2.tick, `tick ${hid2.tick} -> ${back.tick}`);
    // reload restores the saved position
    await page.evaluate(() => window.__marti.save());
    const pz = (await page.evaluate(() => window.__marti.state())).pos.z;
    await page.goto(url + '?seed=5&noloop');
    await page.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 30000 });
    const re = await page.evaluate(() => window.__marti.state());
    check('save: reload restores player', Math.abs(re.pos.z - pz) < 0.2, `${pz} -> ${re.pos.z}`);
    check('visibility: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\nlifecycle.spec: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
