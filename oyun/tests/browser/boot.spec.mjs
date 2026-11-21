// Owner: Builder A. Boot spec (CONTRACT M0 acceptance 1/7/10 browser side): the built artifact boots at 390x844 in
// SwiftShader with zero console errors, first frame <= 4 s, hooks present, ?tier= applies, fallbacks never crash.
// Usage: node tests/browser/boot.spec.mjs   (builds dist first unless SKIP_BUILD=1; MARTI_DIST=<dir> to test another build)
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

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
  const t0 = Date.now();
  await page.goto(url + query);
  await page.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready(), null, { timeout: 30000 });
  return { ctx, page, errors, bootMs: Date.now() - t0 };
}

try {
  // 1) plain boot
  {
    const { ctx, page, errors, bootMs } = await open('?fresh=1');
    check('boot: ready', true, `${bootMs} ms`);
    check('boot: first frame <= 4 s', bootMs <= 4000, `${bootMs} ms`);
    const fail = await page.evaluate(() => getComputedStyle(document.getElementById('fail')).display);
    check('boot: #fail hidden', fail === 'none');
    // M1: a fresh boot shows the v2 title card; the session starts through the play hook (title + pick skipped)
    check('boot: title card shown', await page.evaluate(() => !!document.querySelector('.sb-title [data-play]')));
    await page.evaluate(() => window.__marti.play('sabri'));
    check('boot: play() starts the session', await page.evaluate(() => window.__marti.state().started === true && !document.querySelector('.sb-title,.sb-pickhero')));
    const st = await page.evaluate(() => window.__marti.state());
    check('boot: state() has pos/tier/time', !!st.pos && typeof st.tier === 'string' && typeof st.time === 'number', JSON.stringify({ pos: st.pos, tier: st.tier, time: st.time, saveMode: st.saveMode }));
    if (st.warnings?.length) console.log('  fallbacks in use:', st.warnings.join(' | '));
    const hooks = await page.evaluate(() => ['ready', 'step', 'render', 'renderFrames', 'state', 'info', 'setTime', 'setStage', 'setTier', 'teleport', 'camera', 'input', 'zone', 'events', 'save', 'resetSave', 'loseContext', 'restoreContext', 'hide', 'show'].filter(k => typeof window.__marti[k] !== 'function'));
    check('boot: all M0 hooks present', hooks.length === 0, hooks.join(','));
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => window.__marti.info());
    check('boot: renders (draw calls > 0)', info.calls > 0, `calls ${info.calls} tris ${info.tris} fps ${info.fps}`);
    // walk with the joystick hook, loop running
    const p0 = st.pos;
    await page.evaluate(() => window.__marti.input(1, 0));
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__marti.input(null));
    const p1 = (await page.evaluate(() => window.__marti.state())).pos;
    check('boot: loop runs, player walks', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.5, `${JSON.stringify(p0)} -> ${JSON.stringify(p1)}`);
    // touch joystick drag on the canvas, from a free patch of deck (the first walk ends beside the doner cart)
    await page.evaluate(() => window.__marti.teleport(-2, -2.6));
    await page.waitForTimeout(200);
    const before = (await page.evaluate(() => window.__marti.state())).pos;
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', 195, 600);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', 195, 600 - i * 10); await page.waitForTimeout(16); }
    await page.waitForTimeout(700);
    await touch('touchEnd', 195, 540);
    const after = (await page.evaluate(() => window.__marti.state())).pos;
    check('boot: touch joystick moves the player (up = -z)', after.z < before.z - 0.3, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    check('boot: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // 2) tiers
  for (const [tier, crowd, fps] of [['akici', 25, 30], ['dengeli', 50, 60], ['sahane', 90, 60]]) {
    const { ctx, page, errors } = await open(`?fresh=1&noloop&tier=${tier}`);
    const st = await page.evaluate(() => window.__marti.state());
    check(`tier ${tier}: applied from URL`, st.tier === tier, `crowd ${crowd} fps ${fps}`);
    check(`tier ${tier}: zero console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
  // 3) parity + noloop + time + stage params
  {
    const { ctx, page, errors } = await open('?parity=1&noloop&time=19&stage=2&tier=dengeli');
    const st = await page.evaluate(() => window.__marti.state());
    check('params: time/stage', Math.abs(st.time - 19) < 1e-6 && st.stage === 2, `time ${st.time} stage ${st.stage}`);
    const t0 = st.tick;
    await page.waitForTimeout(500);
    check('params: noloop does not tick', (await page.evaluate(() => window.__marti.state())).tick === t0);
    await page.evaluate(() => window.__marti.step(1));
    const st2 = await page.evaluate(() => window.__marti.state());
    check('params: step(1) = 30 ticks, time frozen', st2.tick === t0 + 30 && Math.abs(st2.time - 19) < 1e-6);
    await page.evaluate(() => window.__marti.setTime(9));
    check('hooks: setTime(9)', Math.abs((await page.evaluate(() => window.__marti.state())).time - 9) < 1e-6);
    await page.evaluate(() => window.__marti.teleport(3, 2));
    const p = (await page.evaluate(() => window.__marti.state())).pos;
    check('hooks: teleport', Math.abs(p.x - 3) < 0.6 && Math.abs(p.z - 2) < 0.6, JSON.stringify(p));
    check('parity: zero console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
const failed = results.filter(r => !r.ok).length;
console.log(`\nboot.spec: ${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
