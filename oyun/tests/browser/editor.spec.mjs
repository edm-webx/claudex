// Editor spec (Builder D, CONTRACT M0 acceptance 9). Plain Node script (tools/run-browser.mjs runs it).
// select a stool, drag 1 m, undo restores, redo, save, reload -> stool at the new position; redefine() of the stool
// prefab updates every stool instance and undo restores it; zero console errors. Cleans up its override at the end.
// Env: EDITOR_URL (base URL of a running server; default: starts vite on port 5198).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function startServer() {
  const url = process.env.EDITOR_URL;
  if (url) return { base: url.replace(/\/$/, ''), stop() {} };
  // vite dev server through its JS API with file watching and HMR off: other builders edit the tree while specs run,
  // and a hot reload in the middle of a shot would navigate the page away
  const { createServer } = await import(path.join(ROOT, 'node_modules/vite/dist/node/index.js'));
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { port: 5198, strictPort: true, host: '127.0.0.1', hmr: false, watch: null }, optimizeDeps: { include: ['three', 'lil-gui'] } });
  await server.listen();
  return { base: 'http://127.0.0.1:5198', stop: () => server.close() };
}

let fails = 0, oks = 0;
const check = (ok, what, extra = '') => { if (ok) oks++; else fails++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${what}${extra ? '  ' + extra : ''}`); };
const near = (a, b, eps = 0.05) => a && b && Math.abs(a.x - b.x) < eps && Math.abs(a.z - b.z) < eps;

(async () => {
  const srv = await startServer();
  const b = await chromium.launch({ args: ARGS });
  const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  const URL = `${srv.base}/index.html?edit=1&seed=1&tier=dengeli&stage=1`; // real loop: zone (re)builds run per frame
  const boot = async () => {
    await p.goto(URL);
    // vite may reload the page once while it pre-bundles lazily imported deps (lil-gui): wait until ready stays ready
    for (let i = 0; i < 4; i++) {
      try {
        await p.waitForFunction(() => window.__marti && window.__marti.ready && window.__marti.ready() && window.__marti.editor && window.__marti.editor.state, null, { timeout: 60000 });
        await p.waitForTimeout(1500);
        if (await p.evaluate(() => !!(window.__marti && window.__marti.editor && window.__marti.editor.state))) break;
      } catch (e) { if (i === 3) throw e; }
    }
    await p.evaluate(() => { window.__marti.step && window.__marti.step(0.5); window.__marti.renderFrames && window.__marti.renderFrames(3, 1 / 30); });
    await p.waitForTimeout(300); // overrides load from IndexedDB
  };
  try {
    await boot();
    const E = (fn, ...a) => p.evaluate(([f, args]) => window.__marti.editor[f](...args), [fn, a]);
    // find a stool placement (B: prefab 'iskele.tabure', placements tabure-s1 / tabure-s2)
    const stools = await E('instances');
    const stool = stools.find(s => /tabure|stool/i.test(s.prefab) && s.visible) || stools.find(s => /tabure|stool/i.test(s.prefab));
    check(!!stool, 'a stool placement exists', stool ? `${stool.id} (${stool.prefab}), ${stools.filter(s => s.prefab === stool.prefab).length} instances` : `instances: ${stools.length}`);
    if (!stool) throw new Error('no stool');
    const id = stool.id, prefabId = stool.prefab;
    const p0 = await E('pos', id);
    await E('select', id);
    check((await E('state')).selected === id, 'select');
    const target = { x: p0.pos.x + 1, z: p0.pos.z };
    await E('drag', id, target.x, target.z);
    const moved = (await E('instances', prefabId)).find(s => s.id === id);
    check(near((await E('pos', id)).pos, target) && near(moved.pos, target), 'drag 1 m moves the stool (placement + scene object)', JSON.stringify(moved.pos));
    await E('undo');
    check(near((await E('pos', id)).pos, p0.pos), 'undo restores the old position');
    await E('redo');
    check(near((await E('pos', id)).pos, target), 'redo moves it again');
    const patch = await E('save');
    check(typeof patch === 'string' && patch.includes(id), 'save returns the TS patch', patch.split('\n')[2] || '');
    // reload: override applied from IndexedDB
    await boot();
    const after = (await p.evaluate(i => window.__marti.editor.instances().find(s => s.id === i), id));
    check(near((await E('pos', id)).pos, target) && after && near(after.pos, target), 'after reload the stool is at the new position', after ? JSON.stringify(after.pos) : 'missing');
    // prefab redefine: every stool instance rebuilds
    const before = await E('instances', prefabId);
    const n = await E('redefine', prefabId, { parts: [{ shape: 'box', size: [0.5, 1.6, 0.5], pos: [0, 0.8, 0], color: '#e0533c' }], build: null });
    const re = await E('instances', prefabId);
    const allTall = re.length >= 1 && re.every(s => Math.abs(s.h - 1.6) < 0.05);
    check(n === before.length && allTall, `redefine updates all ${before.length} stool instances`, `heights ${before.map(s => s.h).join('/')} -> ${re.map(s => s.h).join('/')}`);
    await E('undo');
    const back = await E('instances', prefabId);
    check(back.every((s, i) => Math.abs(s.h - before[i].h) < 0.02), 'undo restores the stool prefab', back.map(s => s.h).join('/'));
    // clean up: move the stool home and save, so later runs start from content positions
    await E('drag', id, p0.pos.x, p0.pos.z);
    await E('save');
    const ov = await E('overrides', 'iskele');
    check(!ov[id], 'cleanup: no override left for the stool');
    await p.screenshot({ path: path.join(process.env.TMPDIR || '/tmp', 'marti-editor.png') });
  } catch (e) { check(false, 'editor run', e.message); }
  check(errs.length === 0, 'zero console errors', errs.slice(0, 8).join(' | '));
  await b.close(); srv.stop();
  console.log(`editor: ${oks}/${oks + fails} checks pass`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('EDITOR CRASH', e); process.exit(1); });
